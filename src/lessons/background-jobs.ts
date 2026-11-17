import type { Lesson, SceneLink, SceneNode } from '../engine/types';

// Screen x follows d = x - y and screen y follows s = x + y, so lay nodes out as (column, row).
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const user: SceneNode = { id: 'user', kind: 'client', at: at(-9, 0), label: 'accountant', sub: 'Export 2026' };
const api: SceneNode = { id: 'api', kind: 'server', at: at(-6, 0), label: 'web API', sub: '30 s timeout' };
const queue: SceneNode = { id: 'queue', kind: 'queue', at: at(-2.5, 0), label: 'job queue', sub: 'exports' };
const w1: SceneNode = { id: 'w1', kind: 'worker', at: at(1, -3.25), label: 'worker 1' };
const w2: SceneNode = { id: 'w2', kind: 'worker', at: at(3.75, 0), label: 'worker 2' };
const w3: SceneNode = { id: 'w3', kind: 'worker', at: at(1, 3.25), label: 'worker 3' };
const files: SceneNode = { id: 'files', kind: 'storage', at: at(6.75, 0), label: 'file store', sub: 'finished PDFs' };
const jobs: SceneNode = { id: 'jobs', kind: 'db', at: at(-2.5, 6.75), label: 'jobs table', sub: 'Postgres' };
const sched: SceneNode = { id: 'sched', kind: 'service', at: at(-4.5, -6.75), label: 'scheduler', sub: 'cron + delays' };
const schedA: SceneNode = { id: 'sched-a', kind: 'service', at: at(-7.5, -6.75), label: 'scheduler A' };
const schedB: SceneNode = { id: 'sched', kind: 'service', at: at(-4.5, -6.75), label: 'scheduler B' };
const schedC: SceneNode = { id: 'sched-c', kind: 'service', at: at(-1.5, -6.75), label: 'scheduler C' };
const dash: SceneNode = { id: 'dash', kind: 'monitor', at: at(6.75, -6.5), label: 'job dashboard', sub: 'depth, age, failures' };

// Priority step: two queues in the same screen column.
const qHigh: SceneNode = { id: 'queue', kind: 'queue', at: at(-2.5, -3.5), label: 'critical', sub: 'password resets' };
const qLow: SceneNode = { id: 'q-low', kind: 'queue', at: at(-2.5, 3.5), label: 'bulk', sub: 'thumbnail backfill' };

const workers = [w1, w2, w3];

const baseLinks: SceneLink[] = [
  { from: 'user', to: 'api' },
  { from: 'api', to: 'queue' },
  { from: 'queue', to: 'w1' },
  { from: 'queue', to: 'w2' },
  { from: 'queue', to: 'w3' },
  { from: 'w2', to: 'files' },
];

export const backgroundJobs: Lesson = {
  id: 'background-jobs',
  title: 'Background jobs and schedulers',
  tagline: 'Move slow work out of the request, run it later or on a schedule, and make sure it runs once.',
  minutes: 14,
  level: 'Intermediate',
  learn: [
    'Why slow work does not belong inside an HTTP request',
    'The job lifecycle: queued, running, succeeded, retrying, dead',
    'Leases, heartbeats and retries with backoff',
    'Delayed jobs, cron jobs and multi-step pipelines',
    'How a replicated scheduler avoids firing the same job twice',
    'Priority queues and what operators need to see',
  ],
  metrics: [
    { key: 'latency', label: 'Export request' },
    { key: 'depth', label: 'Queue depth' },
    { key: 'age', label: 'Oldest job' },
    { key: 'runs', label: 'Billing runs tonight' },
  ],
  steps: [
    {
      title: 'Slow request',
      tag: 'problem',
      heading: 'A 40-second task inside a 30-second request',
      eli5: 'A customer asks the bakery for a big wedding cake and stands at the **counter** while it bakes. The line behind her cannot move, and she gives up before the cake is done.',
      body: [
        'An accounting app has an "Export year as PDF" button. Building the file means reading 12,000 invoices and rendering 900 pages. It takes about **40 seconds**. The load balancer gives up on any request after 30.',
        'So the user waits half a minute, sees an error and clicks again. The first export is still running on the server, now with a second one next to it. Each holds a web thread and a database connection the whole time. Twenty impatient accountants at month end can tie up the whole API.',
        'The work is fine. The place it runs is wrong. An HTTP request is for things that finish in well under a second.',
      ],
      keyIdea: 'Work that takes longer than a user will wait should not run inside the request that asked for it.',
      metrics: { latency: '30 s, then 504', depth: '-', age: '-', runs: '-' },
      scene: {
        nodes: [
          { ...user, badge: 'clicks again' },
          { ...api, status: 'hot', badge: '2 exports running' },
          { ...jobs, id: 'appdb', label: 'app database', at: at(-2.5, 0), status: 'hot', badge: '12,000 invoices' },
        ],
        links: [
          { from: 'user', to: 'api' },
          { from: 'api', to: 'appdb' },
        ],
        flows: [
          { path: ['user', 'api', 'appdb'], tone: 'request', label: 'POST /export', duration: 1.6 },
          { path: ['appdb', 'api'], tone: 'response', duration: 3, delay: 1.7 },
          { path: ['api', 'user'], tone: 'error', label: '504 after 30 s', duration: 1, delay: 2.6 },
          { path: ['user', 'api', 'appdb'], tone: 'request', label: 'retry', duration: 1.6, delay: 3.8 },
        ],
        caption: 'The request times out, the work keeps running, and the retry doubles it',
      },
    },
    {
      title: 'Enqueue',
      tag: 'concept',
      heading: 'Take the order now, do the work later',
      eli5: 'The counter writes the cake order on a slip, hangs it on the rail, and hands the customer a ticket number right away. **Bakers** in the back take slips off the rail and bake.',
      body: [
        'The API stops doing the export. It writes a **job** (`{type: "export_pdf", account: 77, year: 2026}`) to a queue and answers `202 Accepted` with a job id in about 20 ms. A pool of **workers**, separate processes with no HTTP port, pull jobs and run them.',
        'The user needs a way to learn the result. The simple version: the browser polls `GET /jobs/j_5521` every few seconds and shows a progress bar, then a download link when the status is `succeeded`. A push over a websocket or an email with the link also work.',
        'Workers scale separately from the web tier. Three workers at 40 seconds a job finish 4.5 exports a minute. If month end needs more, add workers. The API does not change.',
      ],
      keyIdea: 'Accept the request, hand back a job id, and let a worker pool do the slow part at its own pace.',
      metrics: { latency: '20 ms', depth: '2', age: '3 s', runs: '-' },
      scene: {
        nodes: [
          { ...user, badge: 'job j_5521' },
          { ...api, status: 'ok', badge: '202 in 20 ms' },
          { ...queue, status: 'active' },
          w1,
          { ...w2, status: 'active', badge: 'rendering' },
          w3,
          files,
        ],
        links: baseLinks,
        flows: [
          { path: ['user', 'api'], tone: 'request', label: 'POST /export', duration: 1 },
          { path: ['api', 'queue'], tone: 'event', label: 'export_pdf', duration: 0.9, delay: 1.1 },
          { path: ['api', 'user'], tone: 'response', label: '202 + job id', duration: 1, delay: 1.2 },
          { path: ['queue', 'w2'], tone: 'event', duration: 1.2, delay: 2.2 },
          { path: ['w2', 'files'], tone: 'data', label: 'report.pdf', duration: 1.2, delay: 3.6 },
        ],
        caption: 'The request ends in 20 ms. The export finishes 40 seconds later.',
      },
    },
    {
      title: 'Job states',
      tag: 'concept',
      heading: 'A job is a small state machine',
      eli5: 'Every slip has a stamp: waiting, baking, done, or burnt. A baker who takes a slip rings a bell every few minutes. If the bell stops, the slip goes back on the rail for another baker.',
      body: [
        'Each job has a row that records where it is: `queued`, `running`, `succeeded`, `failed` (will retry) or `dead` (gave up). The row also holds the attempt count, the last error and timestamps. That row is what the progress bar reads and what an operator searches at 3 am.',
        'The hard transition is `running`. A worker can be killed by a deploy or run out of memory mid-job, and a job stuck in `running` forever is a silent failure. So a worker takes a **lease**: it claims the job until a deadline and extends that deadline with a **heartbeat** every 10 seconds while it works.',
        'A sweeper returns any `running` job with an expired lease to `queued`. This is the visibility timeout from the queue lesson, stretched to fit jobs that run for minutes or hours.',
      ],
      keyIdea: 'Track every job\'s state in durable storage, and use a lease with heartbeats so a job whose worker died is picked up again.',
      metrics: { latency: '20 ms', depth: '2', age: '3 s', runs: '-' },
      scene: {
        nodes: [
          user,
          api,
          { ...queue, status: 'active' },
          w1,
          { ...w2, status: 'down', badge: 'killed mid-job' },
          { ...w3, status: 'active', badge: 'attempt 2' },
          { ...jobs, status: 'active', badge: 'j_5521 lease expired' },
        ],
        links: [...baseLinks.slice(0, 5), { from: 'queue', to: 'jobs', style: 'dashed' }, { from: 'w3', to: 'jobs', style: 'faint' }],
        flows: [
          { path: ['queue', 'w2'], tone: 'event', label: 'j_5521', duration: 1.1 },
          { path: ['jobs', 'queue'], tone: 'error', label: 'no heartbeat 30 s', duration: 1.3, delay: 1.6 },
          { path: ['queue', 'w3'], tone: 'event', label: 'j_5521 again', duration: 1.1, delay: 3 },
          { path: ['w3', 'jobs'], tone: 'data', label: 'heartbeat', count: 2, duration: 1.2, delay: 4.2 },
        ],
        caption: 'Worker 2 dies. Its lease runs out and worker 3 takes the job.',
      },
      code: {
        language: 'sql',
        title: 'Claim one job with a 30-second lease (Postgres)',
        source: `UPDATE jobs
   SET state = 'running',
       attempts = attempts + 1,
       locked_by = :worker_id,
       lease_until = now() + interval '30 seconds'
 WHERE id = (
        SELECT id FROM jobs
         WHERE (state = 'queued' AND run_at <= now())
            OR (state = 'running' AND lease_until < now())   -- worker died
         ORDER BY priority DESC, run_at
         LIMIT 1
           FOR UPDATE SKIP LOCKED                            -- no two workers claim one row
       )
RETURNING id, type, payload, attempts;

-- While working, every 10 s:
UPDATE jobs SET lease_until = now() + interval '30 seconds'
 WHERE id = :id AND locked_by = :worker_id;`,
        highlight: [5, 9, 12, 17],
      },
      quiz: {
        question: 'A worker is killed halfway through an export. Nothing else changes. How does the job get finished?',
        options: [
          'The API notices and runs the export itself',
          'The worker\'s lease expires because heartbeats stopped, and the job becomes claimable by another worker',
          'The job stays in "running" until someone deletes it',
          'The user has to click Export again',
        ],
        answer: 1,
        explain: 'A dead worker cannot report its own failure. The lease is a deadline that only a live worker keeps extending, so its expiry is the signal to hand the job to someone else.',
      },
    },
    {
      title: 'Retries',
      tag: 'concept',
      heading: 'Retry with backoff, and know when to stop',
      eli5: 'If the oven is too hot and a cake burns, the baker waits a little before trying again, then waits longer each time. After five burnt cakes the slip goes in the "ask the boss" box.',
      body: [
        'Jobs fail for two kinds of reasons. **Transient** failures fix themselves: the PDF renderer timed out, the database failed over. **Permanent** failures never will: the account was deleted, the payload is malformed. Retry the first kind and fail the second kind at once.',
        'Retrying immediately hammers a dependency that is already struggling. Use **exponential backoff**: wait 10 s, then 20, 40, 80, 160. Add random **jitter** so a thousand jobs that failed together do not all come back together. Cap the attempts, here at 5, and move the job to `dead` with its last error.',
        'A retried job runs its code again from the top, so it must be safe to repeat. An export that overwrites `exports/77/2026.pdf` is naturally safe. A job that charges a card needs the idempotency key from the queue lesson.',
      ],
      keyIdea: 'Retry transient failures with growing, jittered delays and a hard cap. Everything a job does must be safe to do again.',
      metrics: { latency: '20 ms', depth: '2', age: '70 s', runs: '-' },
      scene: {
        nodes: [
          user,
          api,
          { ...queue, status: 'active', badge: 'retry in 40 s' },
          { ...w1, status: 'hot', badge: 'renderer timeout' },
          w2,
          w3,
          { ...jobs, status: 'active', badge: 'attempt 3 of 5' },
        ],
        links: [...baseLinks.slice(0, 5), { from: 'queue', to: 'jobs', style: 'dashed' }],
        flows: [
          { path: ['queue', 'w1'], tone: 'event', label: 'j_5530', duration: 1.1 },
          { path: ['w1', 'queue'], tone: 'error', label: 'failed, back off', duration: 1.1, delay: 1.3 },
          { path: ['queue', 'jobs'], tone: 'data', label: 'run_at = now + 40 s', duration: 1.3, delay: 2.5 },
        ],
        caption: 'Each failure pushes the next attempt further out',
      },
      code: {
        language: 'python',
        title: 'Worker loop: backoff, jitter and a dead state',
        source: `MAX_ATTEMPTS = 5
BASE = 10  # seconds

def run(job):
    try:
        HANDLERS[job.type](job.payload)
        jobs.mark(job.id, state="succeeded")
    except PermanentError as e:                  # bad input: retrying cannot help
        jobs.mark(job.id, state="dead", error=str(e))
    except Exception as e:
        if job.attempts >= MAX_ATTEMPTS:
            jobs.mark(job.id, state="dead", error=str(e))
            return
        delay = BASE * 2 ** (job.attempts - 1)   # 10, 20, 40, 80 s
        delay += random.uniform(0, delay * 0.2)  # jitter: spread the herd
        jobs.mark(job.id, state="queued", error=str(e),
                  run_at=now() + timedelta(seconds=delay))`,
        highlight: [8, 9, 11, 14, 15, 17],
      },
    },
    {
      title: 'Delayed jobs',
      tag: 'concept',
      heading: 'Run this, but not yet',
      eli5: 'Some slips say "bake this tomorrow at 9". They wait in a drawer sorted by time. An **alarm clock** checks the drawer every second and moves the slips that are due onto the rail.',
      body: [
        'Backoff already used the idea: a job with a `run_at` in the future. The same mechanism covers product features. "Email a reminder if the invoice is unpaid after 7 days." "Delete the export file 24 hours after it was built." "Retry the webhook in 5 minutes."',
        'A **delayed job** sits in a store ordered by `run_at`: an indexed column in Postgres or a sorted set in Redis. A **scheduler** process polls for rows where `run_at <= now()` and makes them available to workers. With a one-second poll, jobs fire within about a second of their time.',
        'Do not implement a delay by sleeping inside a worker. A sleeping worker is a wasted worker, and a deploy during the sleep loses the timer. Write the intent down and let the scheduler wake it.',
      ],
      keyIdea: 'A delay is data: a durable job with a run_at time, promoted to the queue by a scheduler when it is due.',
      metrics: { latency: '20 ms', depth: '2', age: '3 s', runs: '-' },
      scene: {
        nodes: [
          user,
          api,
          { ...sched, status: 'active', badge: 'polls every 1 s' },
          { ...queue, status: 'active' },
          ...workers,
          { ...jobs, status: 'active', badge: '4,100 waiting on run_at' },
        ],
        links: [...baseLinks.slice(0, 5), { from: 'sched', to: 'queue' }, { from: 'queue', to: 'jobs', style: 'dashed' }],
        flows: [
          { path: ['api', 'queue', 'jobs'], tone: 'data', label: 'remind in 7 days', duration: 1.8 },
          { path: ['sched', 'queue'], tone: 'event', label: 'due now', duration: 1.2, delay: 2.2 },
          { path: ['queue', 'w3'], tone: 'event', label: 'send reminder', duration: 1.1, delay: 3.5 },
        ],
        caption: 'The job waits in the table until the scheduler says it is due',
      },
    },
    {
      title: 'Cron jobs',
      tag: 'concept',
      heading: 'Recurring work on a schedule',
      eli5: 'The **alarm clock** also rings every night at 2. It does not bake anything. It only hangs a "bake the morning bread" slip on the rail, and the bakers do the rest.',
      body: [
        'A **cron job** is a schedule plus a job template: `0 2 * * *` means every day at 02:00. Here it starts the nightly billing run, which charges 80,000 subscriptions. Other typical users are report generation, cleanup of old rows and cache warming.',
        'The scheduler should only enqueue. It writes one `billing_run` job for tonight, and that job enqueues 80,000 small `charge_subscription` jobs. Now the heavy work gets everything the worker pool already has: parallelism, retries per customer, and state you can inspect. A scheduler that does the work itself has none of that.',
        'Decide what happens to a missed tick. If the scheduler was down from 01:55 to 02:10, should billing run late or skip the night? For billing, run late. For "refresh a cache every minute", skip. Make it a per-job setting.',
      ],
      keyIdea: 'The scheduler decides when. It enqueues a job and lets workers do the work, so scheduled work is retried and observed like any other job.',
      metrics: { latency: '20 ms', depth: '80,000', age: '4 min', runs: '1' },
      scene: {
        nodes: [
          { ...sched, status: 'active', badge: '02:00 fired' },
          { ...queue, sub: 'billing', status: 'active', badge: '80,000 charge jobs' },
          ...workers.map((w) => ({ ...w, status: 'active' as const })),
          { ...files, id: 'pay', kind: 'internet', label: 'card processor', sub: 'payments API' },
        ],
        links: [
          { from: 'sched', to: 'queue' },
          { from: 'queue', to: 'w1' },
          { from: 'queue', to: 'w2' },
          { from: 'queue', to: 'w3' },
          { from: 'w2', to: 'pay' },
        ],
        flows: [
          { path: ['sched', 'queue'], tone: 'event', label: 'billing_run 11-27', duration: 1.2 },
          { path: ['queue', 'w1'], tone: 'event', count: 3, duration: 1.1, delay: 1.4 },
          { path: ['queue', 'w2', 'pay'], tone: 'event', label: 'charge', count: 3, duration: 1.8, delay: 1.4 },
          { path: ['queue', 'w3'], tone: 'event', count: 3, duration: 1.1, delay: 1.4 },
        ],
        caption: 'One tick, one parent job, 80,000 child jobs',
      },
    },
    {
      title: 'Double fire',
      tag: 'case',
      heading: 'Case: three schedulers, three billing runs',
      eli5: 'The bakery buys three alarm clocks in case one breaks. At 2 all three ring and three bread slips go up. The fix: slips are stamped with the date, and the rail refuses a second slip with the same stamp.',
      body: [
        'One scheduler is a single point of failure: if it dies at 01:59, nobody is billed. So the team runs three replicas. At 02:00 each replica\'s clock says it is time, each enqueues `billing_run`, and 80,000 customers are charged **three times**.',
        'The usual first fix is **leader election**: replicas compete for a lock with a short lease in a coordination store, and only the holder fires. That removes most duplicates. It cannot remove all of them. A leader that pauses for a long garbage collection can wake up after its lease expired, still believing it leads, while a new leader has already fired.',
        'So add a guard that does not depend on anyone\'s belief. Give each firing a deterministic key, the job name plus the **scheduled** time (never the actual clock reading), and insert it under a unique constraint. All three replicas may try. The database lets exactly one row in.',
      ],
      keyIdea: 'Run several schedulers for availability, and make each tick unique by name and scheduled time so the store rejects every firing after the first.',
      metrics: { latency: '20 ms', depth: '80,000', age: '4 min', runs: '3 → 1' },
      scene: {
        nodes: [
          { ...schedA, status: 'hot', badge: 'insert rejected' },
          { ...schedB, status: 'ok', badge: 'leader, inserted' },
          { ...schedC, status: 'hot', badge: 'insert rejected' },
          { ...queue, sub: 'billing', status: 'active', badge: '1 billing_run' },
          ...workers,
          { ...jobs, label: 'cron_fires', sub: 'UNIQUE (job, time)', status: 'ok' },
        ],
        links: [
          { from: 'sched-a', to: 'queue' },
          { from: 'sched', to: 'queue' },
          { from: 'sched-c', to: 'queue' },
          { from: 'queue', to: 'jobs', style: 'dashed' },
          { from: 'queue', to: 'w1' },
          { from: 'queue', to: 'w2' },
          { from: 'queue', to: 'w3' },
        ],
        flows: [
          { path: ['sched', 'queue', 'jobs'], tone: 'event', label: 'fire 02:00', duration: 1.8 },
          { path: ['sched-a', 'queue'], tone: 'error', label: 'duplicate', duration: 1.3, delay: 0.5 },
          { path: ['sched-c', 'queue'], tone: 'error', label: 'duplicate', duration: 1.3, delay: 0.8 },
          { path: ['queue', 'w2'], tone: 'event', label: 'billing_run', duration: 1.1, delay: 2.4 },
        ],
        caption: 'Three replicas fire. The unique key admits one.',
      },
      code: {
        language: 'sql',
        title: 'One firing per (job, scheduled time), whoever tries',
        source: `CREATE TABLE cron_fires (
  job_name     text        NOT NULL,
  scheduled_at timestamptz NOT NULL,       -- the tick, e.g. 02:00:00, not now()
  fired_by     text        NOT NULL,
  PRIMARY KEY (job_name, scheduled_at)
);

-- Every replica runs this in one transaction at each tick.
WITH claim AS (
  INSERT INTO cron_fires (job_name, scheduled_at, fired_by)
  VALUES ('billing_run', '2026-11-27 02:00:00+00', :replica_id)
  ON CONFLICT DO NOTHING
  RETURNING job_name, scheduled_at
)
INSERT INTO jobs (type, payload, state, run_at)
SELECT 'billing_run', jsonb_build_object('for', scheduled_at), 'queued', now()
  FROM claim;                              -- 0 rows for the losers`,
        highlight: [3, 5, 12, 17],
      },
    },
    {
      title: 'Pipelines',
      tag: 'concept',
      heading: 'Jobs that depend on other jobs',
      eli5: 'A wedding cake has steps: bake the layers, then ice them, then add flowers. Layers can bake side by side, but icing must wait until every layer is out of the oven.',
      body: [
        'Some work is a sequence of jobs with dependencies. Month-end close: build 400 account statements in parallel, then one summary that needs all of them, then email the finance team. Drawn out, that is a **DAG** (directed acyclic graph): nodes are jobs, edges mean "runs after".',
        'A workflow engine stores the graph and each node\'s state. When a job succeeds it checks which downstream jobs now have every dependency met and enqueues those. A failed node is retried alone. After a crash you resume from the failed node, and the 399 statements that succeeded are not rebuilt.',
        'For very long single jobs, apply the same thinking inside the job: **checkpoint** progress ("pages 1 to 600 done") so a retry continues where the last attempt stopped.',
      ],
      keyIdea: 'Break long work into small jobs with explicit dependencies, so a failure repeats one step and the rest of the progress is kept.',
      metrics: { latency: '20 ms', depth: '400', age: '50 s', runs: '1' },
      scene: {
        nodes: [
          { ...sched, label: 'workflow engine', sub: 'month-end DAG', status: 'active' },
          { ...queue, status: 'active' },
          { ...w1, label: 'statements', sub: '400 in parallel', status: 'ok', badge: '399 done, 1 retry' },
          { ...w2, label: 'summary', sub: 'needs all 400', status: 'dim', badge: 'blocked' },
          { ...files, kind: 'worker', label: 'email finance', sub: 'needs summary', status: 'dim' },
          { ...jobs, status: 'active', badge: 'state per node' },
        ],
        links: [
          { from: 'sched', to: 'queue' },
          { from: 'queue', to: 'w1' },
          { from: 'w1', to: 'w2', label: 'then' },
          { from: 'w2', to: 'files', label: 'then' },
          { from: 'queue', to: 'jobs', style: 'dashed' },
        ],
        flows: [
          { path: ['sched', 'queue', 'w1'], tone: 'event', label: 'statement 212', duration: 1.8 },
          { path: ['w1', 'queue'], tone: 'error', label: 'retry 212 only', duration: 1.1, delay: 2 },
          { path: ['queue', 'w1'], tone: 'event', duration: 1.1, delay: 3.2 },
          { path: ['w1', 'w2'], tone: 'event', label: 'all 400 done', duration: 1.2, delay: 4.5 },
        ],
        caption: 'The summary waits for every statement. One failure retries one node.',
      },
    },
    {
      title: 'Priorities',
      tag: 'tradeoff',
      heading: 'Not all jobs are equally urgent',
      eli5: 'A huge order for 500 cookies fills the rail, and a birthday cake due in ten minutes is stuck behind it. So the bakery keeps two rails, and one baker only ever serves the urgent rail.',
      body: [
        'A backfill enqueues 500,000 thumbnail jobs. They share one queue with password-reset emails. At 400 jobs a second across the pool, a reset email now waits behind 20 minutes of thumbnails. Users give up.',
        'The usual fix is a queue per class of work, each with its own workers: a `critical` queue for anything a person is waiting on, `default` for ordinary work, `bulk` for backfills. A single queue with a priority number works too, but strict priority has a failure of its own: if high-priority jobs never stop arriving, low ones **starve** and never run.',
        'Guard against starvation by reserving capacity. Give each class at least one dedicated worker, or use weights so the pool takes roughly 6 critical jobs for every 3 default and 1 bulk. Then set expectations per class: critical within 5 seconds, bulk within a day.',
      ],
      keyIdea: 'Separate urgent work from bulk work, and reserve capacity for every class so nothing waits forever.',
      metrics: { latency: '20 ms', depth: '4 / 500,000', age: '1 s / 20 min', runs: '1' },
      scene: {
        nodes: [
          user,
          api,
          { ...qHigh, status: 'ok', badge: 'depth 4' },
          { ...qLow, status: 'hot', badge: 'depth 500,000' },
          { ...w1, status: 'ok', badge: 'critical only' },
          { ...w2, status: 'active', badge: 'weighted 6:1' },
          { ...w3, status: 'active', badge: 'bulk only' },
        ],
        links: [
          { from: 'user', to: 'api' },
          { from: 'api', to: 'queue' },
          { from: 'api', to: 'q-low' },
          { from: 'queue', to: 'w1' },
          { from: 'queue', to: 'w2' },
          { from: 'q-low', to: 'w2', style: 'faint' },
          { from: 'q-low', to: 'w3' },
        ],
        flows: [
          { path: ['user', 'api', 'queue', 'w1'], tone: 'event', label: 'reset email', duration: 2.2 },
          { path: ['q-low', 'w3'], tone: 'event', label: 'thumbnail', count: 4, duration: 1.2 },
          { path: ['queue', 'w2'], tone: 'event', count: 3, duration: 1.2, delay: 1 },
          { path: ['q-low', 'w2'], tone: 'event', duration: 1.4, delay: 2.6 },
        ],
        caption: 'The reset email skips half a million thumbnails',
      },
    },
    {
      title: 'Visibility',
      tag: 'concept',
      heading: 'What operators need to see and do',
      eli5: 'A chalkboard in the bakery shows how many slips are waiting, how old the oldest one is, and which cakes burned. If the 2 o\'clock alarm never rang, the chalkboard says so too.',
      body: [
        'Background work fails quietly. No user is watching a spinner, so nobody reports it. The system has to report on itself. Per queue, track depth, the **age of the oldest job**, throughput, failure rate and run time percentiles. Alert on age against the target for that class: a critical job older than 30 seconds is a page.',
        'Per job, keep the history: every attempt, its error, its duration, which worker ran it. Give operators safe controls: retry a dead job, cancel a queued one, pause a queue during an incident.',
        'Scheduled jobs need the reverse alarm. A cron job that throws is easy to notice. A cron job that never started produces no error at all. Record every expected run and alert when a run is **missing**, for example no successful `billing_run` by 03:00.',
      ],
      keyIdea: 'Measure the age of the oldest job per queue, keep per-job history, and alert when a scheduled run does not happen.',
      metrics: { latency: '20 ms', depth: '2', age: '3 s', runs: '1' },
      scene: {
        nodes: [
          { ...sched, status: 'ok' },
          { ...queue, status: 'ok' },
          ...workers,
          { ...jobs, status: 'ok', badge: '3 dead jobs' },
          { ...dash, status: 'active', badge: 'no billing_run by 03:00?' },
        ],
        links: [
          { from: 'sched', to: 'queue' },
          { from: 'queue', to: 'w1' },
          { from: 'queue', to: 'w2' },
          { from: 'queue', to: 'w3' },
          { from: 'queue', to: 'jobs', style: 'dashed' },
          { from: 'w2', to: 'dash', style: 'faint' },
          { from: 'sched', to: 'dash', style: 'faint' },
        ],
        flows: [
          { path: ['sched', 'dash'], tone: 'data', label: 'tick recorded', duration: 1.8 },
          { path: ['w2', 'dash'], tone: 'data', label: 'run time, errors', duration: 1.4, delay: 0.8 },
          { path: ['queue', 'jobs'], tone: 'data', label: 'attempt history', duration: 1.3, delay: 1.6 },
        ],
        caption: 'Depth, oldest age, dead jobs and missing runs on one screen',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Accept fast, work later, fire once',
      eli5: 'The counter hands out tickets fast, bakers work from slips on the rail, burnt cakes are tried again with a pause, the alarm clock only hangs slips, and the chalkboard shows what is stuck.',
      body: [
        'Slow work leaves the request: the API enqueues a job and returns an id, and workers run it. Each job is a state machine in durable storage, protected by a lease and heartbeats, retried with jittered backoff and parked as `dead` after a cap.',
        'A scheduler turns time into jobs, for delays and for cron, and only enqueues. Replicate it for availability and deduplicate each tick with a unique key on the scheduled time. Split queues by urgency, reserve capacity for each class, and watch oldest-job age and missing runs.',
      ],
      keyIdea: 'A job system is a queue plus durable state, time and visibility. Most of its bugs are jobs that ran twice or never ran.',
      metrics: { latency: '20 ms', depth: '2', age: '3 s', runs: '1' },
      scene: {
        nodes: [
          user,
          { ...api, status: 'ok' },
          { ...sched, status: 'ok' },
          { ...queue, status: 'ok' },
          ...workers.map((w) => ({ ...w, status: 'ok' as const })),
          files,
          jobs,
        ],
        links: [...baseLinks, { from: 'sched', to: 'queue' }, { from: 'queue', to: 'jobs', style: 'dashed' }],
        flows: [
          { path: ['user', 'api', 'queue'], tone: 'event', duration: 1.6 },
          { path: ['sched', 'queue'], tone: 'event', duration: 1.2, delay: 0.6 },
          { path: ['queue', 'w2', 'files'], tone: 'event', count: 2, duration: 1.8, delay: 1.8 },
          { path: ['queue', 'w1'], tone: 'event', duration: 1.1, delay: 2.2 },
        ],
      },
      quiz: {
        question: 'You run three scheduler replicas with leader election, and a nightly job still fired twice last month. What closes the gap?',
        options: [
          'Go back to a single scheduler',
          'Shorten the leader lease',
          'Insert each firing under a unique key of job name plus scheduled time, so a second insert is rejected',
          'Add more workers',
        ],
        answer: 2,
        explain: 'A paused leader can act after its lease expired, so election alone leaves a window. A unique constraint on the tick does not depend on what any replica believes, and making the job idempotent covers what is left.',
      },
    },
  ],
};
