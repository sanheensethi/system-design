import type { Lesson, SceneLink, SceneNode } from '../engine/types';

// Screen x follows d = x - y and screen y follows s = x + y, so lay nodes out as (column, row).
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const user: SceneNode = { id: 'user', kind: 'client', at: at(-7, 0), label: 'accountant', sub: 'Export 2026' };
const api: SceneNode = { id: 'api', kind: 'block', at: at(-3.5, 0), label: 'web API', sub: '30 s timeout', icon: 'Network', tint: 'violet' };
const queue: SceneNode = { id: 'queue', kind: 'queue', at: at(0, 0), label: 'job queue', sub: 'exports' };
const w1: SceneNode = { id: 'w1', kind: 'worker', at: at(3, -4), label: 'worker 1' };
const w2: SceneNode = { id: 'w2', kind: 'worker', at: at(5.5, 0), label: 'worker 2' };
const w3: SceneNode = { id: 'w3', kind: 'worker', at: at(3, 4), label: 'worker 3' };
const files: SceneNode = { id: 'files', kind: 'storage', at: at(9, 0), label: 'file store', sub: 'finished PDFs' };
const jobs: SceneNode = { id: 'jobs', kind: 'db', at: at(-3, 4.5), label: 'jobs table', sub: 'Postgres' };

export const backgroundJobs: Lesson = {
  id: 'background-jobs',
  title: 'Background jobs and schedulers (part 1)',
  tagline: 'Move slow work out of the request and make sure a job that runs twice, or fails, does no harm.',
  minutes: 14,
  level: 'Intermediate',
  learn: [
    'Why slow work does not belong inside an HTTP request',
    'Reporting job progress and enqueuing atomically with the database write',
    'The job lifecycle: queued, running, succeeded, dead, with a retry as queued plus a later run_at',
    'Leases, heartbeats and why every job must be safe to run twice',
    'Retries with backoff, dead letters, timeouts and graceful shutdown',
  ],
  metrics: [
    { key: 'latency', label: 'Export request', icon: 'Timer' },
    { key: 'depth', label: 'Queue depth', icon: 'Inbox' },
    { key: 'age', label: 'Oldest job', icon: 'Clock' },
    { key: 'runs', label: 'Attempts', icon: 'Repeat' },
  ],
  steps: [
    {
      title: 'Slow request',
      tag: 'problem',
      heading: 'A 40-second task inside a 30-second request',
      eli5: 'A customer asks the bakery for a big wedding cake and stands at the **counter** while it bakes. The line behind her cannot move, and she gives up before the cake is done.',
      body: [
        'An "Export year as PDF" button reads 12,000 invoices and renders 900 pages. That takes about **40 seconds**. The load balancer gives up on any request after 30.',
        'The user sees an error and clicks again. The first export is still running and now a second one joins it. Each holds a web thread and a database connection for the full 40 seconds, and a web pool has a fixed number of threads. Twenty impatient accountants at month end can use them all and block everyone else.',
      ],
      keyIdea: 'The work is fine. The place it runs is wrong: work that takes longer than a user will wait should not run inside the request that asked for it.',
      metrics: { latency: '30 s, then 504', depth: '-', age: '-', runs: '2 exports' },
      metricTones: { latency: 'bad', runs: 'bad' },
      scene: {
        nodes: [
          { ...user, badge: 'clicks again' },
          { ...api, status: 'hot', load: 95, chips: [{ text: '2 copies of POST /export', tone: 'warn' }] },
          { id: 'appdb', kind: 'db', at: at(3.5, 0), label: 'app database', sub: '12,000 invoices', status: 'hot' },
        ],
        links: [link('user', 'api', { label: 'LB cuts off at 30 s', labelTone: 'warn' }), link('api', 'appdb')],
        flows: [
          { path: ['user', 'api', 'appdb'], tone: 'request', label: 'POST /export', duration: 1.6 },
          { path: ['appdb', 'api'], tone: 'response', duration: 2.4, delay: 1.7 },
          { path: ['api', 'user'], tone: 'error', label: '504 after 30 s', duration: 1, delay: 2.8 },
          { path: ['user', 'api', 'appdb'], tone: 'request', label: 'retry', duration: 1.6, delay: 4.1 },
        ],
        panel: {
          title: 'One export at month end',
          icon: 'Timer',
          rows: [
            { text: 'Render time', value: '40 s', tone: 'bad' },
            { text: 'Load balancer limit', value: '30 s' },
            { text: 'Copies running after a retry', value: '2', tone: 'warn' },
            { text: 'Web threads held', value: '2, for 40 s each', tone: 'warn' },
          ],
          footer: { text: 'The user gets an error and the work still runs', tone: 'bad' },
        },
        caption: 'The request times out, the work keeps running, and the retry doubles it',
      },
    },
    {
      title: 'Enqueue',
      tag: 'concept',
      heading: 'Take the order now, do the work later',
      eli5: 'The counter writes the cake order on a slip, hangs it on the rail, and hands the customer a ticket number right away. **Bakers** in the back take slips off the rail and bake.',
      body: [
        'The API stops doing the export. It writes a **job** to a queue and answers `202 Accepted` with a job id in about 20 ms.',
        'A pool of **workers**, separate processes with no HTTP port, pull jobs and run them. The job is small data, not code: a type and the arguments.',
      ],
      keyIdea: 'Accept the request, hand back a job id, and let a worker pool do the slow part at its own pace.',
      metrics: { latency: '20 ms', depth: '2', age: '3 s', runs: '1' },
      metricTones: { latency: 'good' },
      scene: {
        nodes: [
          { ...user, badge: 'job j_5521' },
          { ...api, status: 'ok', chips: [{ text: '202 in 20 ms', tone: 'good' }] },
          { ...queue, status: 'active' },
          { ...w2, status: 'active', badge: 'rendering' },
          files,
        ],
        links: [link('user', 'api'), link('api', 'queue'), link('queue', 'w2'), link('w2', 'files')],
        flows: [
          { path: ['user', 'api'], tone: 'request', label: 'POST /export', duration: 1 },
          { path: ['api', 'queue'], tone: 'event', label: 'export_pdf', duration: 0.9, delay: 1.1 },
          { path: ['api', 'user'], tone: 'response', label: '202 + job id', duration: 1, delay: 1.2 },
          { path: ['queue', 'w2'], tone: 'event', duration: 1.2, delay: 2.2 },
          { path: ['w2', 'files'], tone: 'data', label: 'report.pdf', duration: 1.2, delay: 3.6 },
        ],
        panel: {
          title: 'The job is just data',
          icon: 'FileJson',
          code: '{\n  "id": "j_5521",\n  "type": "export_pdf",\n  "account": 77,\n  "year": 2026\n}',
          footer: { text: 'A worker looks up the handler by type', tone: 'muted' },
        },
        caption: 'The request ends in 20 ms. The export finishes 40 seconds later.',
      },
    },
    {
      title: 'Progress',
      tag: 'concept',
      heading: 'How the user learns the result',
      eli5: 'The customer holds a **ticket number**. She asks the counter "is number 5521 ready?" every few minutes, and the counter looks at the chalkboard to answer.',
      body: [
        'The browser polls `GET /jobs/j_5521` every few seconds. The API reads the job row and returns its state and a progress number. When the state is `succeeded`, the response carries a download link.',
        'A websocket push or an email with the link also work. Polling is the simplest and survives reconnects, because the state lives in the database and not in a connection.',
      ],
      keyIdea: 'Give every job an id and a status row, so any client can ask "is it done?" at any time.',
      metrics: { latency: '20 ms', depth: '2', age: '3 s', runs: '1' },
      scene: {
        nodes: [
          user,
          { ...api, chips: ['GET /jobs/j_5521'] },
          { ...jobs, at: at(0, 0), status: 'active', badge: 'j_5521 running 60%' },
          { ...w2, status: 'active' },
        ],
        links: [link('user', 'api', { label: 'poll every 3 s' }), link('api', 'jobs'), link('w2', 'jobs', { style: 'faint' })],
        flows: [
          { path: ['w2', 'jobs'], tone: 'data', label: 'progress 60%', duration: 1.3 },
          { path: ['user', 'api', 'jobs'], tone: 'request', label: 'status?', duration: 1.6, delay: 1.5 },
          { path: ['jobs', 'api', 'user'], tone: 'response', label: 'running, 60%', duration: 1.6, delay: 3.2 },
        ],
        panel: {
          title: 'What a poll returns',
          icon: 'Table',
          rows: [
            { text: 'queued', value: '{ state }' },
            { text: 'running', value: '{ state, progress: 60 }', tone: 'warn' },
            { text: 'succeeded', value: '{ state, url }', tone: 'good' },
            { text: 'dead', value: '{ state, error }', tone: 'bad' },
          ],
        },
        caption: 'The worker writes progress and the API only reads it',
      },
    },
    {
      title: 'Outbox',
      tag: 'case',
      heading: 'Case: the order is saved but the job is lost',
      eli5: 'The counter writes the order in the big book, then walks to hang the slip on the rail. If she faints in between, the book says "ordered" and no baker ever hears about it.',
      body: [
        'Saving an invoice and enqueuing its PDF job are two writes to two systems. A crash after the first leaves an invoice and no job.',
        'The fix is a **transactional outbox**: insert the job row in the same transaction as the invoice, and a relay moves committed rows to the queue.',
        'With a Postgres jobs table you can skip the relay, because workers claim rows from it directly. The relay is for a separate broker. It marks rows sent after publishing, so a crash in between sends a row twice.',
      ],
      keyIdea: 'Write the job in the same transaction as the data it belongs to, and let a relay forward it, so a crash cannot lose it.',
      metrics: { latency: '20 ms', depth: '2', age: '3 s', runs: '1' },
      scene: {
        nodes: [
          { ...api, status: 'ok' },
          { ...jobs, at: at(0, 0), label: 'app database', sub: 'invoices + jobs', status: 'ok', badge: 'one transaction' },
          { id: 'relay', kind: 'block', at: at(3.5, 0), label: 'relay', sub: 'polls new rows', icon: 'Repeat', tint: 'teal', status: 'active' },
          { ...queue, at: at(7, 0) },
        ],
        links: [link('api', 'jobs'), link('jobs', 'relay', { style: 'dashed' }), link('relay', 'queue')],
        flows: [
          { path: ['api', 'jobs'], tone: 'request', label: 'invoice + job', duration: 1.3 },
          { path: ['jobs', 'relay'], tone: 'data', label: 'committed rows', duration: 1.2, delay: 1.6 },
          { path: ['relay', 'queue'], tone: 'event', label: 'export_pdf', duration: 1.2, delay: 3 },
        ],
        panel: {
          title: 'Both rows or neither',
          icon: 'Database',
          code: 'BEGIN;\n  INSERT INTO invoices ...;\n  INSERT INTO jobs\n    (type, payload, state)\n  VALUES (\'export_pdf\', ..., \'queued\');\nCOMMIT;   -- crash before this: nothing exists',
          footer: { text: 'The relay may send twice, so jobs must tolerate repeats', tone: 'warn' },
        },
        caption: 'A crash between two writes can no longer lose the job',
      },
    },
    {
      title: 'Job states',
      tag: 'concept',
      heading: 'A job is a small state machine',
      eli5: 'Every slip has a stamp: waiting, baking, done, or burnt. The stamp is what the customer reads on the chalkboard, and what the boss checks at 3 am.',
      body: [
        'Each job has a row that records where it is: `queued`, `running`, `succeeded` or `dead` (gave up). A retry is not a separate state: the job goes back to `queued` with a `run_at` in the future. The row also holds the attempt count, the last error and timestamps.',
        'That row is what the progress bar reads and what an operator searches at 3 am. The hard transition is `running`, because a worker can vanish while holding a job.',
      ],
      keyIdea: 'Track every job\'s state in durable storage. A job with no state row is a job nobody can find.',
      metrics: { latency: '20 ms', depth: '2', age: '3 s', runs: '1' },
      scene: {
        nodes: [
          { ...queue, status: 'active' },
          { ...w2, status: 'active', badge: 'attempt 1' },
          { ...jobs, status: 'active' },
        ],
        links: [link('queue', 'w2'), link('queue', 'jobs', { style: 'dashed' }), link('w2', 'jobs', { style: 'faint' })],
        flows: [
          { path: ['queue', 'w2'], tone: 'event', label: 'j_5521', duration: 1.2 },
          { path: ['w2', 'jobs'], tone: 'data', label: 'state = running', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'Job lifecycle',
          icon: 'Workflow',
          rows: [
            { text: 'queued', value: 'waiting, or retrying at run_at' },
            { text: 'running', value: 'a worker holds it', tone: 'warn' },
            { text: 'succeeded', value: 'done', tone: 'good' },
            { text: 'dead', value: 'gave up', tone: 'bad' },
          ],
        },
        caption: 'One row per job, updated at every transition',
      },
    },
    {
      title: 'Leases',
      tag: 'concept',
      heading: 'A worker borrows a job, it does not own it',
      eli5: 'A baker who takes a slip rings a bell every few minutes. As long as the bell rings, nobody else touches that slip.',
      body: [
        'A job stuck in `running` forever is a silent failure. So a worker takes a **lease**: it claims the job until a deadline, here 30 seconds.',
        'While it works, it extends the deadline with a **heartbeat** every 10 seconds. `FOR UPDATE SKIP LOCKED` makes sure two workers never claim the same row.',
      ],
      keyIdea: 'A lease is a deadline that only a live worker keeps extending. Its expiry is the signal that the worker is gone.',
      metrics: { latency: '20 ms', depth: '2', age: '3 s', runs: '1' },
      scene: {
        nodes: [
          { ...queue, status: 'active' },
          { ...w2, status: 'active', badge: 'lease 30 s' },
          { ...jobs, status: 'active', badge: 'lease_until = now + 30 s' },
        ],
        links: [link('queue', 'w2'), link('w2', 'jobs', { label: 'heartbeat every 10 s' })],
        flows: [
          { path: ['queue', 'w2'], tone: 'event', label: 'claim j_5521', duration: 1.2 },
          { path: ['w2', 'jobs'], tone: 'data', label: 'extend lease', count: 2, duration: 1.4, delay: 1.5 },
        ],
        caption: 'The worker keeps its claim alive by checking in',
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
            OR (state = 'running' AND lease_until < now()    -- worker died
                AND attempts < :max_attempts)                -- poison job stops here
         ORDER BY priority DESC, run_at
         LIMIT 1
           FOR UPDATE SKIP LOCKED                            -- no two workers claim one row
       )
RETURNING id, type, payload, attempts;

-- While working, every 10 s:
UPDATE jobs SET lease_until = now() + interval '30 seconds'
 WHERE id = :id AND locked_by = :worker_id;
-- 0 rows updated means the lease was lost: stop work (see the Twice step).`,
        highlight: [5, 9, 12, 17],
      },
    },
    {
      title: 'Expiry',
      tag: 'concept',
      heading: 'When the worker dies, the lease runs out',
      eli5: 'A baker faints in the middle of a cake. The bell stops ringing, so after a while the slip goes back on the rail and another baker picks it up.',
      body: [
        'A worker can be killed by a deploy or run out of memory mid-job. It cannot report its own failure. The heartbeats just stop.',
        'A sweeper, or the next claim query, treats any `running` job with an expired lease as claimable and returns it to `queued`. This is the visibility timeout from the queue lesson, stretched to fit jobs that run for minutes.',
      ],
      keyIdea: 'No heartbeat means no owner. The job goes back to the queue and another worker takes it.',
      metrics: { latency: '20 ms', depth: '3', age: '30 s', runs: '2' },
      metricTones: { age: 'warn', runs: 'warn' },
      scene: {
        nodes: [
          { ...queue, status: 'active' },
          { ...w2, status: 'down', badge: 'killed mid-job' },
          { ...w3, status: 'active', badge: 'attempt 2' },
          { ...jobs, status: 'active', badge: 'j_5521 lease expired', chips: [{ text: 'no heartbeat 30 s', tone: 'bad' }] },
        ],
        links: [link('queue', 'w2'), link('queue', 'w3'), link('queue', 'jobs', { style: 'dashed' }), link('w3', 'jobs', { style: 'faint' })],
        flows: [
          { path: ['queue', 'w2'], tone: 'event', label: 'j_5521', duration: 1.1 },
          { path: ['jobs', 'queue'], tone: 'error', label: 'lease expired', duration: 1.3, delay: 1.6 },
          { path: ['queue', 'w3'], tone: 'event', label: 'j_5521 again', duration: 1.1, delay: 3 },
          { path: ['w3', 'jobs'], tone: 'data', label: 'heartbeat', count: 2, duration: 1.2, delay: 4.2 },
        ],
        caption: 'Worker 2 dies. Its lease runs out and worker 3 takes the job.',
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
      title: 'Twice',
      tag: 'case',
      heading: 'Case: the "dead" worker was only slow',
      eli5: 'A baker is just slow, not fainted. The bell stopped, so a second baker took the slip. Now two cakes are being baked for one order.',
      body: [
        'A worker paused by a 40-second garbage collection wakes up after its lease expired. Worker 3 already runs the same job, so both now write results.',
        'A job queue promises **at-least-once** delivery, never exactly once. A **fencing token**, here the attempt number, helps. The check lives in the jobs table: the final update uses `WHERE id = :id AND attempts = :my_attempt AND locked_by = :me`. Once attempt 2 has claimed the job, the update from the stale worker touches 0 rows and it stops.',
      ],
      keyIdea: 'Leases give at-least-once, which means a job can run twice. Plan for it, and fence stale writers with an attempt number.',
      metrics: { latency: '20 ms', depth: '2', age: '3 s', runs: '2 at once' },
      metricTones: { runs: 'bad' },
      scene: {
        nodes: [
          { ...w2, status: 'hot', badge: 'woke after GC pause', chips: [{ text: 'attempt 1', tone: 'warn' }] },
          { ...w3, status: 'active', chips: [{ text: 'attempt 2', tone: 'good' }] },
          { ...jobs, at: at(9, 0), status: 'active', chips: [{ text: 'accepts 2, rejects 1', tone: 'good' }] },
        ],
        links: [link('w2', 'jobs', { label: 'attempt 1', labelTone: 'warn' }), link('w3', 'jobs', { label: 'attempt 2' })],
        flows: [
          { path: ['w3', 'jobs'], tone: 'data', label: 'update, attempt 2', duration: 1.4 },
          { path: ['w2', 'jobs'], tone: 'error', label: '0 rows, attempt 1', duration: 1.4, delay: 1.8 },
        ],
        panel: {
          title: 'Fencing in the jobs table',
          icon: 'Shield',
          code: "UPDATE jobs SET state = 'succeeded'\n WHERE id = :id\n   AND attempts = :my_attempt\n   AND locked_by = :me;\n-- stale worker: 0 rows, stop",

          footer: { text: 'Even so, make the job itself safe to repeat', tone: 'warn' },
        },
        caption: 'The late worker cannot overwrite the newer attempt',
      },
    },
    {
      title: 'Idempotent',
      tag: 'concept',
      heading: 'Make every job safe to repeat',
      eli5: 'If two bakers bake the same cake, no harm is done when the extra one goes in the bin. It would be a problem only if each one also charged the customer.',
      body: [
        'A retried job runs its code again from the top. An export that overwrites `exports/77/2026.pdf` is naturally safe. Setting `status = paid` and inserting a row with a unique key are also safe. The same idea works at enqueue time: give an ordinary job a dedup key, such as `export:77:2026`, under a unique constraint, so a double click enqueues one job.',
        'Charging a card is not. Send an idempotency key, such as `charge:sub_881:2026-11`. The processor returns the first result for every repeat of that key.',
      ],
      keyIdea: 'Assume every job runs more than once. Use overwrites, unique keys and idempotency keys so the second run changes nothing.',
      metrics: { latency: '20 ms', depth: '2', age: '3 s', runs: '2, one charge' },
      metricTones: { runs: 'good' },
      scene: {
        nodes: [
          { ...w2, status: 'active', chips: ['charge sub_881'] },
          { ...w3, status: 'active', chips: ['charge sub_881'] },
          { id: 'pay', kind: 'block', at: at(9, 0), label: 'card processor', sub: 'payments API', icon: 'Receipt', tint: 'green', status: 'ok', chips: [{ text: 'charged once', tone: 'good' }] },
        ],
        links: [link('w2', 'pay'), link('w3', 'pay')],
        flows: [
          { path: ['w2', 'pay'], tone: 'request', label: 'key charge:sub_881', duration: 1.5 },
          { path: ['w3', 'pay'], tone: 'request', label: 'same key', duration: 1.5, delay: 1.8 },
          { path: ['pay', 'w3'], tone: 'response', label: 'first result', duration: 1.2, delay: 3.4 },
        ],
        caption: 'Same key, same answer, one charge',
      },
      code: {
        language: 'python',
        title: 'A charge job that is safe to repeat',
        source: `def charge_subscription(job):
    key = f"charge:{job.sub_id}:{job.period}"       # same on every attempt
    result = processor.charge(
        customer=job.customer_id,
        amount=job.amount,
        idempotency_key=key,                         # repeat returns the first result
    )
    db.execute(
        "UPDATE subscriptions SET paid_through = %s WHERE id = %s",
        (job.period_end, job.sub_id),                # setting a value is safe to redo
    )`,
        highlight: [2, 6, 9],
      },
      quiz: {
        question: 'Your retried job sends a welcome email. After a worker crash, some users get two. What is the right fix?',
        options: [
          'Retry fewer times',
          'Record "welcome sent for user 42" under a unique key and skip the send if it already exists',
          'Make the worker never crash',
          'Send the email from the web request instead',
        ],
        answer: 1,
        explain: 'You cannot stop crashes or duplicate deliveries. You can make a repeat harmless by recording the effect under a unique key and checking it first.',
      },
    },
    {
      title: 'Which failure',
      tag: 'concept',
      heading: 'Transient or permanent',
      eli5: 'If the oven is broken for a minute, trying again soon is smart. If the slip says "cake for a customer who does not exist", trying again will never help.',
      body: [
        '**Transient** failures fix themselves: the PDF renderer timed out, the database failed over. Retry them.',
        '**Permanent** failures never will: the account was deleted, the payload is malformed. Retrying wastes workers and delays other jobs, so mark the job `dead` at once.',
      ],
      keyIdea: 'Classify each error. Retry the ones that can heal and fail the others immediately.',
      metrics: { latency: '20 ms', depth: '2', age: '3 s', runs: '1' },
      scene: {
        nodes: [
          { ...w1, status: 'hot', badge: 'renderer timeout' },
          { ...w2, status: 'hot', badge: 'account deleted' },
          { ...queue, status: 'active' },
          { ...jobs },
        ],
        links: [link('queue', 'w1'), link('queue', 'w2'), link('queue', 'jobs', { style: 'dashed' })],
        flows: [
          { path: ['w1', 'queue'], tone: 'error', label: 'transient: retry', duration: 1.3 },
          { path: ['w2', 'queue', 'jobs'], tone: 'error', label: 'permanent: dead', duration: 1.8, delay: 1.5 },
        ],
        panel: {
          title: 'Errors by kind',
          icon: 'Bug',
          rows: [
            { text: 'Timeout, 503, deadlock', value: 'retry', tone: 'warn' },
            { text: 'Database failover', value: 'retry', tone: 'warn' },
            { text: 'Account deleted', value: 'dead now', tone: 'bad' },
            { text: 'Malformed payload', value: 'dead now', tone: 'bad' },
          ],
        },
        caption: 'Healing errors go back to the queue, hopeless ones stop',
      },
    },
    {
      title: 'Backoff',
      tag: 'concept',
      heading: 'Retry later, with growing, random gaps',
      eli5: 'If the oven is too hot and a cake burns, the baker waits a little before trying again, then waits longer each time. Bakers also wait different amounts, so they do not all crowd the oven at once.',
      body: [
        'Retrying immediately hammers a dependency that is already struggling. Use **exponential backoff**: wait 10 s, then 20, 40, 80. The fifth failure goes to `dead`.',
        'Add random **jitter** so a thousand jobs that failed together do not all come back together. The next attempt time is stored as `run_at`.',
      ],
      keyIdea: 'Space retries out with doubling delays plus jitter, so a recovering dependency is not hit by a stampede.',
      metrics: { latency: '20 ms', depth: '2', age: '30 s', runs: '3' },
      metricTones: { age: 'warn' },
      scene: {
        nodes: [
          { ...queue, status: 'active', badge: 'retry in 40 s' },
          { ...w1, status: 'hot', badge: 'renderer timeout' },
          { ...jobs, status: 'active', badge: 'attempt 3 of 5' },
        ],
        links: [link('queue', 'w1'), link('queue', 'jobs', { style: 'dashed' })],
        flows: [
          { path: ['queue', 'w1'], tone: 'event', label: 'j_5530', duration: 1.1 },
          { path: ['w1', 'queue'], tone: 'error', label: 'failed, back off', duration: 1.1, delay: 1.3 },
          { path: ['queue', 'jobs'], tone: 'data', label: 'run_at = now + 40 s', duration: 1.3, delay: 2.5 },
        ],
        panel: {
          title: 'Delay before each retry',
          icon: 'Timer',
          rows: [
            { text: 'After attempt 1', value: '10 s + jitter' },
            { text: 'After attempt 2', value: '20 s + jitter' },
            { text: 'After attempt 3', value: '40 s + jitter', tone: 'warn' },
            { text: 'After attempt 4', value: '80 s + jitter' },
            { text: 'After attempt 5', value: 'dead', tone: 'bad' },
          ],
        },
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
      title: 'Dead letters',
      tag: 'concept',
      heading: 'After the cap, park the job for a human',
      eli5: 'After five burnt cakes the slip goes in the "ask the boss" box with a note saying what went wrong. The boss fixes the oven, then puts the slips back on the rail.',
      body: [
        'Cap attempts, here at 5, and move the job to `dead` with its last error. This is a **dead letter queue**. A **poison job** that kills its worker every time never reaches the error path, so the claim query skips expired leases at the cap and a sweeper marks them `dead`.',
        'Dead jobs are not garbage. Alert on their count, find the bug, ship the fix, then **replay** them in bulk. The replay is safe only because jobs are idempotent.',
      ],
      keyIdea: 'Stop retrying after a cap, keep the failed job and its error, and replay it once the cause is fixed.',
      metrics: { latency: '20 ms', depth: '2', age: '3 s', runs: '5, then dead' },
      metricTones: { runs: 'bad' },
      scene: {
        nodes: [
          { ...queue, status: 'active' },
          { ...w1, status: 'hot', badge: 'attempt 5 failed' },
          { id: 'dlq', kind: 'block', at: at(3.5, 4), label: 'dead jobs', sub: 'last error kept', icon: 'Inbox', tint: 'red', status: 'hot', badge: '3 waiting' },
          { id: 'ops', kind: 'block', at: at(-3.5, 4), label: 'operator', sub: 'fixes, replays', icon: 'User', tint: 'blue' },
        ],
        links: [link('queue', 'w1'), link('w1', 'dlq', { label: 'after 5 tries', labelTone: 'warn' }), link('ops', 'dlq', { style: 'dashed', arrow: 'both' })],
        flows: [
          { path: ['w1', 'dlq'], tone: 'error', label: 'dead + error', duration: 1.5 },
          { path: ['ops', 'dlq', 'queue'], tone: 'event', label: 'replay after fix', duration: 2.2, delay: 1.8 },
        ],
        panel: {
          title: 'A dead job record',
          icon: 'List',
          rows: [
            { text: 'type', value: 'export_pdf' },
            { text: 'attempts', value: '5 of 5', tone: 'bad' },
            { text: 'last error', value: 'PDF renderer 500', tone: 'bad' },
            { text: 'actions', value: 'retry, delete' },
          ],
        },
        caption: 'Dead jobs wait for a person and can be replayed',
      },
    },
    {
      title: 'Stopping jobs',
      tag: 'concept',
      heading: 'Timeouts and deploys',
      eli5: 'A cake that has been in the oven for three hours is stuck, even if the baker keeps ringing the bell. And when the shop closes, bakers finish the cake in hand and take no new slips.',
      body: [
        'A heartbeat proves the worker is alive, not that the job is moving. A hung job holds a worker forever. Give every job type a hard **timeout**, such as 120 seconds for an export, and fail the attempt when it passes.',
        'On deploy the worker gets `SIGTERM`. It stops claiming new jobs and finishes the current one within about 30 seconds. If it cannot, the lease expires and another worker retries.',
      ],
      keyIdea: 'Bound every job with a timeout, and let workers drain on shutdown so a deploy does not turn into a wave of retries.',
      metrics: { latency: '20 ms', depth: '2', age: '3 s', runs: '1' },
      scene: {
        nodes: [
          { ...queue, status: 'active' },
          { ...w1, status: 'hot', badge: 'stuck 120 s', chips: [{ text: 'timeout: kill', tone: 'bad' }] },
          { ...w2, status: 'dim', badge: 'SIGTERM: draining', chips: [{ text: 'no new jobs', tone: 'warn' }] },
        ],
        links: [link('queue', 'w1'), link('queue', 'w2', { style: 'faint' })],
        flows: [
          { path: ['w1', 'queue'], tone: 'error', label: 'timeout, retry', duration: 1.4 },
          { path: ['queue', 'w2'], tone: 'event', label: 'none while draining', duration: 1.3, delay: 1.8 },
        ],
        panel: {
          title: 'Per-type limits',
          icon: 'Timer',
          rows: [
            { text: 'export_pdf', value: 'timeout 120 s' },
            { text: 'send_email', value: 'timeout 10 s' },
            { text: 'charge_subscription', value: 'timeout 30 s' },
            { text: 'Drain on SIGTERM', value: 'up to 30 s', tone: 'good' },
          ],
        },
        caption: 'Hung jobs are cut off, finishing jobs are left alone',
      },
    },
    {
      title: 'Housekeeping',
      tag: 'concept',
      heading: 'Cancel, clean up and keep secrets out',
      eli5: 'A customer calls to cancel her cake, so the slip is pulled off the rail. Old slips are binned after a month, and nobody writes a credit card number on a slip.',
      body: [
        '**Cancellation** is a state change: set a `cancelled` flag on a queued job so no worker claims it. A running job checks the flag between steps and stops. Finished rows pile up, so keep results for a set time, such as 30 days, then delete them in a nightly cleanup job.',
        'Keep secrets and personal data out of payloads. Store an id such as `account: 77` and let the worker load the data, so job rows, logs and dead letters hold nothing sensitive.',
      ],
      keyIdea: 'Let jobs be cancelled, delete finished rows on a schedule, and store ids in payloads, not secrets.',
      metrics: { latency: '20 ms', depth: '2', age: '3 s', runs: '1' },
      scene: {
        nodes: [
          { ...api, status: 'ok', chips: [{ text: 'cancel j_5521', tone: 'warn' }] },
          { ...jobs, at: at(0, 0), status: 'active', badge: 'cancelled = true' },
          { ...w2, status: 'active', badge: 'checks flag, stops' },
        ],
        links: [link('api', 'jobs'), link('w2', 'jobs', { style: 'faint' })],
        flows: [
          { path: ['api', 'jobs'], tone: 'request', label: 'cancel', duration: 1.3 },
          { path: ['jobs', 'w2'], tone: 'data', label: 'flag seen', duration: 1.3, delay: 1.6 },
        ],
        panel: {
          title: 'Housekeeping rules',
          icon: 'List',
          rows: [
            { text: 'Cancel a queued job', value: 'never claimed' },
            { text: 'Cancel a running job', value: 'stops at next check', tone: 'warn' },
            { text: 'Keep finished rows', value: '30 days' },
            { text: 'Payload holds', value: 'ids, no secrets', tone: 'good' },
          ],
        },
        caption: 'Cancel by flag, delete by schedule, store ids not secrets',
      },
    },
    {
      title: 'Recap 1',
      tag: 'recap',
      heading: 'Accept fast, track state, survive failure',
      eli5: 'The counter hands out tickets fast, bakers work from slips on the rail, a bell keeps a slip claimed, a burnt cake is tried again with a pause, and slips that keep failing go to the boss.',
      body: [
        'Slow work leaves the request: the API enqueues a job in the same transaction as its data and returns an id. Each job is a state row, claimed with a lease and heartbeats.',
        'Delivery is at-least-once, so every job is idempotent. Failures are classified, retried with jittered backoff, capped at 5 and parked as dead. Timeouts and graceful drains stop jobs cleanly. Part 2 covers time and operations.',
      ],
      keyIdea: 'A job runs at least once, so make it safe to repeat, and give failure a bounded, visible path.',
      metrics: { latency: '20 ms', depth: '2', age: '3 s', runs: '1' },
      metricTones: { latency: 'good' },
      scene: {
        nodes: [
          { ...user, status: 'ok' },
          { ...api, status: 'ok' },
          { ...queue, status: 'ok' },
          { ...w2, status: 'ok' },
          { ...jobs, status: 'ok' },
        ],
        links: [link('user', 'api'), link('api', 'queue'), link('queue', 'w2'), link('queue', 'jobs', { style: 'dashed' })],
        flows: [
          { path: ['user', 'api', 'queue'], tone: 'event', duration: 1.6 },
          { path: ['queue', 'w2'], tone: 'event', duration: 1.2, delay: 1.8 },
          { path: ['w2', 'jobs'], tone: 'data', label: 'succeeded', duration: 1.3, delay: 3.2 },
        ],
      },
      quiz: {
        question: 'A job calls a flaky partner API and fails at 02:00 along with 5,000 other jobs. You retry them all after exactly 30 seconds and the partner falls over again. What should the retry policy have?',
        options: [
          'A fixed 30-second delay and unlimited attempts',
          'Exponential backoff with random jitter and an attempt cap, then a dead state',
          'Immediate retry so the work finishes sooner',
          'Deleting the jobs after the first failure',
        ],
        answer: 1,
        explain: 'Growing delays give the partner room to recover, jitter spreads the 5,000 jobs out, and the cap with a dead state stops a hopeless job from looping forever.',
      },
    },
  ],
};
