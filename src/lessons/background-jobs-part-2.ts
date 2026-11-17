import type { Lesson, SceneLink, SceneNode } from '../engine/types';

// Screen x follows d = x - y and screen y follows s = x + y, so lay nodes out as (column, row).
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const api: SceneNode = { id: 'api', kind: 'block', at: at(-3.5, 0), label: 'web API', sub: 'enqueues jobs', icon: 'Network', tint: 'violet' };
const sched: SceneNode = { id: 'sched', kind: 'block', at: at(-3.5, -3.5), label: 'scheduler', sub: 'cron + delays', icon: 'Clock', tint: 'amber' };
const queue: SceneNode = { id: 'queue', kind: 'queue', at: at(0, 0), label: 'job queue', sub: 'billing' };
const w1: SceneNode = { id: 'w1', kind: 'worker', at: at(3, -4), label: 'worker 1' };
const w2: SceneNode = { id: 'w2', kind: 'worker', at: at(5.5, 0), label: 'worker 2' };
const w3: SceneNode = { id: 'w3', kind: 'worker', at: at(3, 4), label: 'worker 3' };
const jobs: SceneNode = { id: 'jobs', kind: 'db', at: at(-3, 4.5), label: 'jobs table', sub: 'Postgres' };
const pay: SceneNode = { id: 'pay', kind: 'block', at: at(9, 0), label: 'card processor', sub: 'payments API', icon: 'Receipt', tint: 'green' };

export const backgroundJobsPart2: Lesson = {
  id: 'background-jobs-part-2',
  title: 'Background jobs and schedulers (part 2)',
  tagline: 'Run jobs later or on a schedule, fire each tick once, chain jobs into pipelines and keep the whole system visible.',
  minutes: 15,
  level: 'Intermediate',
  learn: [
    'Delayed jobs and cron jobs, and what to do with a missed tick',
    'How a replicated scheduler avoids firing the same job twice',
    'Multi-step pipelines (DAGs) and checkpoints for long jobs',
    'Priority queues, starvation and protecting downstream services',
    'Autoscaling workers, what operators need to see, and how to pick a tool',
  ],
  metrics: [
    { key: 'latency', label: 'Reminder delay', icon: 'Timer' },
    { key: 'depth', label: 'Queue depth', icon: 'Inbox' },
    { key: 'age', label: 'Oldest job', icon: 'Clock' },
    { key: 'runs', label: 'Billing runs tonight', icon: 'Repeat' },
  ],
  steps: [
    {
      title: 'Sleeping worker',
      tag: 'problem',
      heading: 'A reminder that waits seven days',
      eli5: 'A slip says "bake this in a week". A baker is told to stand at the oven for seven days holding it. That baker cannot bake anything else, and if he goes home the slip is forgotten.',
      body: [
        'The product asks: "Email a reminder if the invoice is unpaid after 7 days." The quick version is a job that sleeps for 7 days and then sends the email.',
        'A sleeping worker is a wasted worker. A sleep-based design would tie up 4,100 of them for 4,100 pending reminders. A deploy during the sleep loses the timer, because the timer lived in memory.',
      ],
      keyIdea: 'Never implement a delay by sleeping inside a worker. It wastes capacity and a restart forgets the timer.',
      metrics: { latency: '7 days', depth: '4,100', age: '-', runs: '-' },
      metricTones: { depth: 'bad' },
      scene: {
        nodes: [
          { ...api, chips: ['remind in 7 days'] },
          { ...queue, status: 'active', sub: 'reminders' },
          { ...w1, status: 'hot', load: 5, badge: 'sleep(7 days)', chips: [{ text: 'idle but busy', tone: 'warn' }] },
          { ...w2, status: 'hot', load: 5, badge: 'sleep(7 days)' },
          { ...w3, status: 'down', badge: 'deploy: timer lost' },
        ],
        links: [link('api', 'queue'), link('queue', 'w1'), link('queue', 'w2'), link('queue', 'w3')],
        flows: [
          { path: ['api', 'queue', 'w1'], tone: 'event', label: 'send in 7 days', duration: 2 },
          { path: ['api', 'queue', 'w2'], tone: 'event', duration: 2, delay: 0.5 },
        ],
        panel: {
          title: 'Cost of sleeping',
          icon: 'Timer',
          rows: [
            { text: 'Pending reminders', value: '4,100', tone: 'warn' },
            { text: 'Workers a sleep-based design would tie up', value: '4,100', tone: 'bad' },
            { text: 'Survives a deploy', value: 'no', tone: 'bad' },
          ],
        },
        caption: 'Workers sit asleep and a restart erases the promise',
      },
    },
    {
      title: 'Delayed jobs',
      tag: 'concept',
      heading: 'Run this, but not yet',
      eli5: 'Slips that say "bake tomorrow at 9" wait in a drawer sorted by time. An **alarm clock** checks the drawer every second and moves the slips that are due onto the rail.',
      body: [
        'A **delayed job** is a durable row with a `run_at` in the future, kept in an indexed Postgres column or a Redis sorted set. Backoff already used it. So do "delete the export file 24 hours after it was built" and "retry the webhook in 5 minutes".',
        'A **scheduler** polls for rows where `run_at <= now()` and hands them to workers. With a one-second poll, jobs fire within about a second of their time.',
      ],
      keyIdea: 'A delay is data: a durable job with a run_at time, promoted to the queue by a scheduler when it is due.',
      metrics: { latency: '7 days, +1 s', depth: '2', age: '3 s', runs: '-' },
      metricTones: { latency: 'good' },
      scene: {
        nodes: [
          { ...api, chips: ['remind in 7 days'] },
          { ...jobs, at: at(0, 0), status: 'active', badge: '4,100 waiting on run_at' },
          { ...sched, at: at(3.5, 0), status: 'active', badge: 'polls every 1 s' },
          { ...queue, at: at(7, 0), status: 'active' },
        ],
        links: [link('api', 'jobs'), link('sched', 'jobs', { style: 'dashed', arrow: 'both' }), link('sched', 'queue')],
        flows: [
          { path: ['api', 'jobs'], tone: 'data', label: 'run_at = +7 days', duration: 1.4 },
          { path: ['sched', 'jobs'], tone: 'request', label: 'run_at <= now?', duration: 1.2, delay: 1.8 },
          { path: ['sched', 'queue'], tone: 'event', label: 'due now', duration: 1.2, delay: 3.2 },
        ],
        panel: {
          title: 'Index on run_at',
          icon: 'Table',
          code: 'SELECT id FROM jobs\n WHERE state = \'queued\'\n   AND run_at <= now()\n ORDER BY run_at\n LIMIT 100;',
          footer: { text: 'The job waits in the table, not in a worker', tone: 'good' },
        },
        caption: 'The job waits in the table until the scheduler says it is due',
      },
    },
    {
      title: 'Cron jobs',
      tag: 'concept',
      heading: 'Recurring work on a schedule',
      eli5: 'The **alarm clock** also rings every night at 2. It bakes nothing. It only hangs a "bake the morning bread" slip on the rail, and the bakers do the rest.',
      body: [
        'A **cron job** is a schedule plus a job template: `0 2 * * *` means every day at 02:00. Here it starts the nightly billing run for 80,000 subscriptions.',
        'The scheduler should only enqueue. It writes one `billing_run` job, and that job enqueues 80,000 small `charge_subscription` jobs. The work gets parallelism, retries per customer and inspectable state. The parent tracks a counter of finished children, or uses the DAG join covered later.',
      ],
      keyIdea: 'The scheduler decides when. It enqueues a job and lets workers do the work, so scheduled work is retried and observed like any other job.',
      metrics: { latency: '20 ms', depth: '80,000', age: '4 min', runs: '1' },
      metricTones: { depth: 'warn' },
      scene: {
        nodes: [
          { ...sched, at: at(-3.5, 0), status: 'active', badge: '02:00 fired' },
          { ...queue, at: at(0, 0), status: 'active', badge: '80,000 charge jobs' },
          { ...w2, status: 'active', badge: 'parallel' },
          pay,
        ],
        links: [link('sched', 'queue'), link('queue', 'w2'), link('w2', 'pay')],
        flows: [
          { path: ['sched', 'queue'], tone: 'event', label: 'billing_run 11-27', duration: 1.2 },
          { path: ['queue', 'w2', 'pay'], tone: 'event', label: 'charge', count: 3, duration: 1.8, delay: 1.4 },
        ],
        panel: {
          title: 'One tick, many jobs',
          icon: 'Repeat',
          rows: [
            { text: 'Schedule', value: '0 2 * * *' },
            { text: 'billing_run jobs', value: '1' },
            { text: 'charge_subscription jobs', value: '80,000', tone: 'warn' },
            { text: 'Retries per customer', value: 'yes', tone: 'good' },
          ],
        },
        caption: 'One tick, one parent job, 80,000 child jobs',
      },
    },
    {
      title: 'Missed ticks',
      tag: 'tradeoff',
      heading: 'What happens to a tick nobody saw',
      eli5: 'The alarm clock was unplugged from 1:55 to 2:10. Should the bakers bake the morning bread late, or skip tonight? For wedding cakes, bake late. For a daily sign, skip it.',
      body: [
        'If the scheduler was down from 01:55 to 02:10, the 02:00 tick passed unseen. Decide per job what a missed tick means: billing catches up once, a cache refresh skips.',
        'Compute each tick from the schedule and a stored last-fired time, never from "now". That time is the newest `scheduled_at` per job in `cron_fires`. Pin the time zone: a `0 2 * * *` in a local zone skips or repeats an hour at daylight saving changes, so schedule in UTC.',
      ],
      keyIdea: 'Pick catch-up or skip for each scheduled job, and schedule in UTC so clock changes cannot skip or repeat a tick.',
      metrics: { latency: '20 ms', depth: '1', age: '15 min late', runs: '1' },
      metricTones: { age: 'warn' },
      scene: {
        nodes: [
          { ...sched, at: at(-3.5, 0), status: 'down', badge: 'down 01:55 to 02:10' },
          { ...jobs, at: at(0, 0), label: 'cron_fires', sub: 'max scheduled_at per job', status: 'active', badge: 'billing: 11-26 02:00' },
          { ...queue, at: at(3.5, 0), status: 'ok', badge: 'billing_run, 15 min late' },
        ],
        links: [link('sched', 'jobs', { style: 'dashed' }), link('sched', 'queue')],
        flows: [
          { path: ['sched', 'jobs'], tone: 'request', label: 'what did I miss?', duration: 1.3 },
          { path: ['sched', 'queue'], tone: 'event', label: 'catch up once', duration: 1.3, delay: 1.7 },
        ],
        panel: {
          title: 'Missed tick policy',
          icon: 'Clock',
          rows: [
            { text: 'billing_run', value: 'run late, once', tone: 'good' },
            { text: 'warm_cache every 1 min', value: 'skip missed' },
            { text: 'cleanup_old_rows', value: 'run late, once' },
            { text: 'Schedule time zone', value: 'UTC', tone: 'good' },
          ],
        },
        caption: 'The policy is stored per job, so recovery is predictable',
      },
    },
    {
      title: 'Double fire',
      tag: 'case',
      heading: 'Case: three schedulers, three billing runs',
      eli5: 'The bakery buys three alarm clocks in case one breaks. At 2 all three ring and three bread slips go up. The fix: slips are stamped with the date, and the rail refuses a second slip with the same stamp.',
      body: [
        'One scheduler is a single point of failure, so the team runs three replicas. At 02:00 each one enqueues `billing_run`, and 80,000 customers are charged **three times**.',
        '**Leader election** lets replicas compete for a short lease in a coordination store, and only the holder fires. A leader paused by a long GC can wake after its lease expired and fire anyway, while a new leader already did.',
      ],
      keyIdea: 'Run several schedulers for availability, and elect a leader to cut duplicates. Leader election alone still leaves a window.',
      metrics: { latency: '20 ms', depth: '240,000', age: '4 min', runs: '3 (should be 1)' },
      metricTones: { depth: 'bad', runs: 'bad' },
      scene: {
        nodes: [
          { id: 'sched-a', kind: 'block', at: at(-7, -3.5), label: 'scheduler A', icon: 'Clock', tint: 'amber', status: 'hot', badge: 'thinks it leads' },
          { id: 'sched-b', kind: 'block', at: at(-3, 0), label: 'scheduler B', icon: 'Clock', tint: 'amber', status: 'active', badge: 'real leader' },
          { id: 'sched-c', kind: 'block', at: at(-7, 3.5), label: 'scheduler C', icon: 'Clock', tint: 'amber', status: 'hot', badge: 'thinks it leads' },
          { ...queue, status: 'hot', badge: '3 billing_run' },
        ],
        links: [link('sched-a', 'queue'), link('sched-b', 'queue'), link('sched-c', 'queue')],
        flows: [
          { path: ['sched-a', 'queue'], tone: 'event', label: 'billing_run', duration: 1.3 },
          { path: ['sched-b', 'queue'], tone: 'event', label: 'billing_run', duration: 1.3, delay: 0.3 },
          { path: ['sched-c', 'queue'], tone: 'event', label: 'billing_run', duration: 1.3, delay: 0.6 },
        ],
        caption: 'Every replica that believes it leads fires the tick',
      },
    },
    {
      title: 'Unique tick',
      tag: 'concept',
      heading: 'Make each tick unique',
      eli5: 'Every slip is stamped with the job name and the date. The rail has a rule: if a slip with that stamp is already there, throw the new one away. Three clocks can ring and only one slip stays.',
      body: [
        'Give each firing a deterministic key: the job name plus the **scheduled** time, never the clock reading. Insert it under a unique constraint. All three replicas may try, and the database lets exactly one row in.',
        'This does not depend on anyone\'s belief about who leads. Making `billing_run` itself idempotent covers whatever is left.',
      ],
      keyIdea: 'Deduplicate by name and scheduled time with a unique key, so the store rejects every firing after the first.',
      metrics: { latency: '20 ms', depth: '80,000', age: '4 min', runs: '3 tried, 1 ran' },
      metricTones: { depth: 'warn', runs: 'good' },
      scene: {
        nodes: [
          { id: 'sched-a', kind: 'block', at: at(-7, -3.5), label: 'scheduler A', icon: 'Clock', tint: 'amber', status: 'hot', badge: 'insert rejected' },
          { id: 'sched-b', kind: 'block', at: at(-3, 0), label: 'scheduler B', icon: 'Clock', tint: 'amber', status: 'ok', badge: 'inserted' },
          { id: 'sched-c', kind: 'block', at: at(-7, 3.5), label: 'scheduler C', icon: 'Clock', tint: 'amber', status: 'hot', badge: 'insert rejected' },
          { ...jobs, at: at(0, 0), label: 'cron_fires', sub: 'UNIQUE (job, time)', status: 'ok' },
          { ...queue, at: at(3.5, 0), status: 'active', badge: '1 billing_run' },
        ],
        links: [link('sched-a', 'jobs'), link('sched-b', 'jobs'), link('sched-c', 'jobs'), link('jobs', 'queue')],
        flows: [
          { path: ['sched-b', 'jobs', 'queue'], tone: 'event', label: 'fire 02:00', duration: 1.8 },
          { path: ['sched-a', 'jobs'], tone: 'error', label: 'duplicate', duration: 1.3, delay: 0.5 },
          { path: ['sched-c', 'jobs'], tone: 'error', label: 'duplicate', duration: 1.3, delay: 0.8 },
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
        'Month-end close: build 400 account statements in parallel, then one summary that needs all of them, then email the finance team. Drawn out, that is a **DAG** (directed acyclic graph): nodes are jobs, edges mean "runs after".',
        'A workflow engine stores the graph and each node\'s state. When a job succeeds it enqueues the downstream jobs whose dependencies are all met. A failed node is retried alone, and the 399 statements that succeeded are not rebuilt.',
      ],
      keyIdea: 'Break long work into small jobs with explicit dependencies, so a failure repeats one step and the rest of the progress is kept.',
      metrics: { latency: '20 ms', depth: '400', age: '50 s', runs: '1' },
      scene: {
        nodes: [
          { id: 'stmts', kind: 'block', at: at(-3.5, 0), label: 'statements', sub: '400 in parallel', icon: 'FileText', tint: 'blue', status: 'ok', badge: '399 done, 1 retry' },
          { id: 'summary', kind: 'block', at: at(0, 0), label: 'summary', sub: 'needs all 400', icon: 'Table', tint: 'violet', status: 'dim', badge: 'blocked' },
          { id: 'email', kind: 'block', at: at(3.5, 0), label: 'email finance', sub: 'needs summary', icon: 'Mail', tint: 'green', status: 'dim' },
          { ...jobs, at: at(0, 6), status: 'active', badge: 'state per node' },
        ],
        links: [link('stmts', 'summary', { label: 'then' }), link('summary', 'email', { label: 'then' }), link('summary', 'jobs', { style: 'dashed' })],
        flows: [
          { path: ['stmts', 'jobs'], tone: 'error', label: 'retry 212 only', duration: 1.4 },
          { path: ['stmts', 'summary'], tone: 'event', label: 'all 400 done', duration: 1.2, delay: 2.2 },
          { path: ['summary', 'email'], tone: 'event', duration: 1.2, delay: 3.6 },
        ],
        caption: 'The summary waits for every statement. One failure retries one node.',
      },
    },
    {
      title: 'Checkpoints',
      tag: 'concept',
      heading: 'Save progress inside a long job',
      eli5: 'A baker is icing a 900-layer cake and faints at layer 600. The next baker should read the note "layers 1 to 600 done" and carry on, not start over.',
      body: [
        'A single export that takes an hour is risky. A crash at minute 55 wastes 55 minutes and the retry may crash again.',
        'Apply the pipeline thinking inside the job: **checkpoint** progress ("pages 1 to 600 done") in the job row. A retry reads the checkpoint and continues from page 601.',
      ],
      keyIdea: 'Write a checkpoint into the job row as you go, so a retry resumes and does not start from zero.',
      metrics: { latency: '20 ms', depth: '1', age: '55 min', runs: '2' },
      metricTones: { runs: 'warn' },
      scene: {
        nodes: [
          { ...w2, at: at(-3.5, 0), status: 'down', badge: 'crashed at page 600' },
          { ...jobs, at: at(0, 0), status: 'active', badge: 'checkpoint: page 600' },
          { ...w3, at: at(3.5, 0), status: 'active', badge: 'resumes at 601' },
        ],
        links: [link('w2', 'jobs', { style: 'faint' }), link('jobs', 'w3')],
        flows: [
          { path: ['w2', 'jobs'], tone: 'data', label: 'page 600 done', duration: 1.3 },
          { path: ['jobs', 'w3'], tone: 'event', label: 'resume from 601', duration: 1.3, delay: 2 },
        ],
        panel: {
          title: 'Job row',
          icon: 'Table',
          rows: [
            { text: 'type', value: 'export_pdf' },
            { text: 'attempt', value: '2', tone: 'warn' },
            { text: 'checkpoint', value: 'pages 1 to 600', tone: 'good' },
            { text: 'remaining', value: '300 pages' },
          ],
        },
        caption: 'The retry continues where the last attempt stopped',
      },
    },
    {
      title: 'Priorities',
      tag: 'tradeoff',
      heading: 'Not all jobs are equally urgent',
      eli5: 'A huge order for 500 cookies fills the rail, and a birthday cake due in ten minutes is stuck behind it. So the bakery keeps two rails, and one baker only ever serves the urgent rail.',
      body: [
        'A backfill enqueues 500,000 thumbnail jobs. They share one queue with password-reset emails. At 400 jobs a second across the pool, a reset email waits behind 20 minutes of thumbnails. Users give up.',
        'The usual fix is a queue per class of work, each with its own workers: `critical` for anything a person is waiting on, `default` for ordinary work, `bulk` for backfills.',
      ],
      keyIdea: 'Separate urgent work from bulk work, so a backfill cannot sit in front of a password reset.',
      metrics: { latency: '20 ms', depth: '4 / 500,000', age: '1 s / 20 min', runs: '1' },
      metricTones: { depth: 'warn', age: 'warn' },
      scene: {
        nodes: [
          { ...api, at: at(-6.5, 0) },
          { ...queue, id: 'qhigh', at: at(-2.5, -3.5), label: 'critical', sub: 'password resets', status: 'ok', badge: 'depth 4' },
          { ...queue, id: 'qlow', at: at(-2.5, 3.5), label: 'bulk', sub: 'thumbnail backfill', status: 'hot', badge: 'depth 500,000' },
          { ...w1, at: at(2, -3.5), status: 'ok', badge: 'critical only' },
          { ...w3, at: at(2, 3.5), status: 'active', badge: 'bulk only' },
        ],
        links: [link('api', 'qhigh'), link('api', 'qlow'), link('qhigh', 'w1'), link('qlow', 'w3')],
        flows: [
          { path: ['api', 'qhigh', 'w1'], tone: 'event', label: 'reset email', duration: 2.2 },
          { path: ['qlow', 'w3'], tone: 'event', label: 'thumbnail', count: 4, duration: 1.2, delay: 0.4 },
        ],
        caption: 'The reset email skips half a million thumbnails',
      },
    },
    {
      title: 'Starvation',
      tag: 'tradeoff',
      heading: 'Strict priority can starve the low classes',
      eli5: 'If the urgent rail never empties, the bakers never look at the other rail, and its slips sit there for days. So some bakers are told: you only ever serve the ordinary rail.',
      body: [
        'A single queue with a priority number works too, but if high-priority jobs never stop arriving, low ones **starve** and never run.',
        'Reserve capacity. Give each class at least one dedicated worker, or use weights so the pool takes about 6 critical jobs for every 3 default and 1 bulk. Then set a target per class: critical within 5 seconds, bulk within a day.',
      ],
      keyIdea: 'Reserve capacity for every class, or weight the pool, so low priority waits longer but never forever.',
      metrics: { latency: '20 ms', depth: '4 / 500,000', age: '1 s / 2 h', runs: '1' },
      metricTones: { age: 'warn' },
      scene: {
        nodes: [
          { ...queue, id: 'qhigh', at: at(-3.5, -3.5), label: 'critical', status: 'ok', badge: 'depth 4' },
          { ...queue, id: 'qlow', at: at(-3.5, 3.5), label: 'bulk', status: 'active', badge: 'depth 500,000' },
          { ...w2, at: at(3.5, 0), status: 'active', badge: 'weighted 6:1', load: 70 },
        ],
        links: [link('qhigh', 'w2', { label: '6 of 7 turns' }), link('qlow', 'w2', { label: '1 of 7 turns' })],
        flows: [
          { path: ['qhigh', 'w2'], tone: 'event', label: 'critical', count: 3, duration: 1.3 },
          { path: ['qlow', 'w2'], tone: 'event', label: 'bulk', duration: 1.3, delay: 1.5 },
        ],
        panel: {
          title: 'Targets per class',
          icon: 'Gauge',
          rows: [
            { text: 'critical', value: 'within 5 s', tone: 'good' },
            { text: 'default', value: 'within 1 min' },
            { text: 'bulk', value: 'within 1 day', tone: 'warn' },
          ],
          footer: { text: 'Every class has a worker that is never taken away', tone: 'good' },
        },
        caption: 'Bulk is slower but always gets some turns',
      },
      quiz: {
        question: 'A single queue serves jobs strictly by priority. During a sale, high-priority jobs arrive nonstop and the nightly reports never run. What is this called and what helps?',
        options: [
          'A dead letter, so add retries',
          'Starvation, so reserve dedicated workers or weights for each class',
          'A double fire, so add a unique key',
          'Back pressure, so drop the high-priority jobs',
        ],
        answer: 1,
        explain: 'Strict priority lets the busiest class take all capacity. Reserving workers or weights for every class gives each one a guaranteed share.',
      },
    },
    {
      title: 'Rate limits',
      tag: 'concept',
      heading: 'Do not let your workers flatten a partner',
      eli5: 'Fifty bakers all rush to the same flour supplier at once and the supplier closes the door. So the shop decides: at most ten bakers may talk to the supplier at a time.',
      body: [
        'Fifty workers can send 50 calls at once to a partner that allows 10 a second. It answers `429`, the jobs fail, retry, and fail again.',
        'Set a **concurrency limit** per job type or per downstream service, such as 10 `charge_subscription` jobs at a time, or a token bucket of 10 per second. Jobs over the limit wait in the queue instead of failing.',
      ],
      keyIdea: 'Cap how many jobs of a kind run at once, so the queue absorbs the burst and the partner is never overrun.',
      metrics: { latency: '20 ms', depth: '80,000', age: '4 min', runs: '1' },
      scene: {
        nodes: [
          { ...queue, status: 'active', badge: '80,000 waiting' },
          { ...w2, at: at(4.5, 0), status: 'active', badge: '50 workers', load: 60 },
          { id: 'limiter', kind: 'limiter', at: at(8.5, 0), label: 'limit 10', sub: 'at once', status: 'ok' },
          { ...pay, at: at(12.5, 0) },
        ],
        links: [link('queue', 'w2'), link('w2', 'limiter', { label: 'max 10 in flight' }), link('limiter', 'pay')],
        flows: [
          { path: ['queue', 'w2', 'limiter', 'pay'], tone: 'request', label: 'charge', count: 3, duration: 2.4 },
        ],
        panel: {
          title: 'Without and with a limit',
          icon: 'Gauge',
          rows: [
            { text: 'Calls at once, no limit', value: '50', tone: 'bad' },
            { text: 'Partner allows', value: '10 / s' },
            { text: 'Responses, no limit', value: '429s', tone: 'bad' },
            { text: 'Calls at once, with limit', value: '10', tone: 'good' },
          ],
        },
        caption: 'The queue waits so the partner does not have to refuse',
      },
    },
    {
      title: 'Scaling',
      tag: 'concept',
      heading: 'Size the pool and scale it on queue age',
      eli5: 'If slips pile up and the oldest one is getting stale, hire more bakers for the evening. When the rail is empty, send them home.',
      body: [
        'Capacity is arithmetic. Three workers at 40 seconds a job finish 4.5 exports a minute. A month-end spike brings 90 exports a minute. After one minute 90 are waiting, and a new arrival waits about 20 minutes. Keeping up needs 60 workers.',
        'Scale the worker pool on queue depth or, better, the **age of the oldest job**: add workers while age passes its target, remove them when the queue is empty. Workers are stateless, so this is safe.',
      ],
      keyIdea: 'Workers scale separately from the web tier. Add them when the oldest job grows older than its target.',
      metrics: { latency: '20 ms', depth: '90', age: '1 min', runs: '1' },
      metricTones: { age: 'warn', depth: 'warn' },
      scene: {
        nodes: [
          { ...queue, at: at(-3, 0), status: 'hot', badge: '90 jobs' },
          { id: 'scaler', kind: 'block', at: at(0, 5), label: 'autoscaler', sub: 'watches oldest age', icon: 'TrendingUp', tint: 'teal', status: 'active' },
          { ...w1, status: 'active' },
          { ...w2, status: 'active' },
          { ...w3, status: 'active', badge: '+ 57 more' },
        ],
        links: [link('queue', 'w1'), link('queue', 'w2'), link('queue', 'w3'), link('queue', 'scaler', { style: 'dashed' })],
        flows: [
          { path: ['queue', 'scaler'], tone: 'data', label: 'oldest: 1 min', duration: 1.3 },
          { path: ['scaler', 'queue', 'w3'], tone: 'event', label: 'add workers', duration: 2, delay: 1.6 },
        ],
        panel: {
          title: 'Capacity at 40 s per job',
          icon: 'Gauge',
          rows: [
            { text: '3 workers', value: '4.5 / min' },
            { text: '60 workers', value: '90 / min', tone: 'good' },
            { text: 'Scale up when oldest age >', value: 'its target', tone: 'warn' },
          ],
        },
        caption: 'More workers while the oldest job is too old',
      },
    },
    {
      title: 'Visibility',
      tag: 'concept',
      heading: 'What operators need to see and do',
      eli5: 'A chalkboard in the bakery shows how many slips are waiting, how old the oldest one is, and which cakes burned. If the 2 o\'clock alarm never rang, the chalkboard says so too.',
      body: [
        'Background work fails quietly, because no user watches a spinner. Per queue, track depth, the **age of the oldest job**, throughput, failure rate and run time percentiles. Keep per-job history: every attempt, error and duration. Give operators controls: retry, cancel, pause a queue.',
        'A cron job that throws is easy to notice. One that never started produces no error. Record every expected run and alert when a run is **missing**, for example no successful `billing_run` by 03:00.',
      ],
      keyIdea: 'Measure the age of the oldest job per queue, keep per-job history, and alert when a scheduled run does not happen.',
      metrics: { latency: '20 ms', depth: '2', age: '3 s', runs: '0 by 03:00' },
      metricTones: { runs: 'bad' },
      scene: {
        nodes: [
          { ...sched, at: at(-3.5, 0), status: 'ok' },
          { ...queue, status: 'ok' },
          { id: 'dash', kind: 'monitor', at: at(3.5, 0), label: 'job dashboard', sub: 'depth, age, failures', status: 'active', badge: 'no billing_run by 03:00' },
          { ...jobs, at: at(-3, 7), status: 'ok', badge: '3 dead jobs' },
        ],
        links: [link('sched', 'queue'), link('queue', 'dash', { style: 'faint' }), link('queue', 'jobs', { style: 'dashed' })],
        flows: [
          { path: ['sched', 'queue', 'dash'], tone: 'data', label: 'tick recorded', duration: 2 },
          { path: ['queue', 'jobs'], tone: 'data', label: 'attempt history', duration: 1.3, delay: 1.6 },
        ],
        panel: {
          title: 'Alerts',
          icon: 'Activity',
          rows: [
            { text: 'critical oldest age', value: '> 30 s page', tone: 'bad' },
            { text: 'dead jobs', value: '> 0 ticket', tone: 'warn' },
            { text: 'billing_run missing', value: 'by 03:00 page', tone: 'bad' },
            { text: 'failure rate', value: '> 5%', tone: 'warn' },
          ],
        },
        caption: 'Depth, oldest age, dead jobs and missing runs on one screen',
      },
    },
    {
      title: 'Which tool',
      tag: 'tradeoff',
      heading: 'Where to run it: table, Redis, broker or engine',
      eli5: 'A small shop can run on a notebook and a rail. A big bakery buys a proper order system. A bakery with long multi-day cakes hires a planner who remembers every step.',
      body: [
        'A Postgres jobs table, as in this lesson, is the simplest and keeps jobs in the same transaction as your data. Thousands of jobs a second is common with `SKIP LOCKED`. Redis-backed libraries (Sidekiq, BullMQ, Celery) are very fast, but they can lose jobs if Redis loses data and persistence is not configured.',
        'A broker like SQS or RabbitMQ gives managed, durable queues. A workflow engine like Temporal stores every step and handles retries, timers and DAGs for you. Start simple and move up when the pain is real.',
      ],
      keyIdea: 'Pick the simplest store that meets your volume and durability, and adopt a workflow engine when jobs become long, multi-step processes.',
      metrics: { latency: '20 ms', depth: '2', age: '3 s', runs: '1' },
      scene: {
        nodes: [
          { id: 't1', kind: 'block', at: at(-10.5, 0), label: 'Postgres table', sub: 'simple, transactional', icon: 'Database', tint: 'blue', status: 'ok' },
          { id: 't2', kind: 'block', at: at(-3.5, 0), label: 'Redis library', sub: 'fast, less durable', icon: 'Zap', tint: 'amber' },
          { id: 't3', kind: 'block', at: at(3.5, 0), label: 'Broker', sub: 'SQS, RabbitMQ', icon: 'Inbox', tint: 'violet' },
          { id: 't4', kind: 'block', at: at(10.5, 0), label: 'Workflow engine', sub: 'Temporal', icon: 'Workflow', tint: 'teal' },
        ],
        links: [link('t1', 't2', { style: 'faint', label: 'faster' }), link('t2', 't3', { style: 'faint', label: 'durable' }), link('t3', 't4', { style: 'faint', label: 'multi-step' })],
        panel: {
          title: 'Rough fit',
          icon: 'Scale',
          rows: [
            { text: 'Postgres table', value: 'often thousands / s' },
            { text: 'Redis library', value: 'very fast, check durability', tone: 'warn' },
            { text: 'Broker', value: 'managed, durable' },
            { text: 'Workflow engine', value: 'long, multi-step', tone: 'good' },
          ],
        },
        caption: 'Move up one rung only when the current one hurts',
      },
    },
    {
      title: 'Recap 2',
      tag: 'recap',
      heading: 'Fire once, depend correctly, watch everything',
      eli5: 'The alarm clock hangs slips, only one slip per stamp stays, cakes with steps wait for each other, urgent slips have their own rail, and the chalkboard tells the boss what is stuck.',
      body: [
        'A scheduler turns time into jobs, for delays and cron, and only enqueues. Replicate it for availability and deduplicate each tick with a unique key on the scheduled time. Decide what a missed tick means.',
        'Pipelines run as DAGs with checkpoints. Split queues by urgency and reserve capacity, cap concurrency to protect partners, scale on oldest-job age, and alert on missing runs.',
      ],
      keyIdea: 'A job system is a queue plus durable state, time and visibility. Most of its bugs are jobs that ran twice or never ran.',
      metrics: { latency: '20 ms', depth: '2', age: '3 s', runs: '1' },
      metricTones: { runs: 'good' },
      scene: {
        nodes: [
          { ...sched, at: at(-3.5, -3.5), status: 'ok' },
          { ...queue, at: at(0, 0), status: 'ok' },
          { ...w2, status: 'ok' },
          { ...jobs, status: 'ok' },
          { id: 'dash', kind: 'monitor', at: at(3, 6.5), label: 'dashboard', status: 'ok' },
        ],
        links: [link('sched', 'queue'), link('queue', 'w2'), link('queue', 'jobs', { style: 'dashed' }), link('jobs', 'dash', { style: 'faint' })],
        flows: [
          { path: ['sched', 'queue'], tone: 'event', duration: 1.2 },
          { path: ['queue', 'w2'], tone: 'event', duration: 1.2, delay: 1.4 },
          { path: ['jobs', 'dash'], tone: 'data', duration: 1.2, delay: 2.4 },
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
