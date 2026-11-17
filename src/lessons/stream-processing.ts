import type { Lesson, SceneLink, SceneNode } from '../engine/types';

// Screen x follows d = x - y and screen y follows s = x + y, so lay nodes out as (column, row).
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const phones: SceneNode = { id: 'phones', kind: 'phone', at: at(-9, 0), label: 'phones', sub: '50,000 clicks/s' };
const tunnel: SceneNode = { id: 'tunnel', kind: 'phone', at: at(-9, -5), label: 'phone in tunnel', sub: 'offline 2 min' };
const kafka: SceneNode = { id: 'kafka', kind: 'queue', at: at(-5.5, 0), label: 'clicks topic', sub: 'Kafka, 32 partitions' };
const filter: SceneNode = { id: 'filter', kind: 'worker', at: at(-2, 0), label: 'filter', sub: 'drop bots, dupes' };
const counter: SceneNode = { id: 'counter', kind: 'worker', at: at(1.5, 0), label: 'count per ad', sub: 'keyBy ad_id' };
const dash: SceneNode = { id: 'dash', kind: 'db', at: at(5, 0), label: 'dashboard DB', sub: 'per-minute counts' };
const ckpt: SceneNode = { id: 'ckpt', kind: 'storage', at: at(3, 6), label: 'checkpoints', sub: 'S3, every 30 s' };

// Step 1 only: the hourly batch pipeline.
const files: SceneNode = { id: 'files', kind: 'storage', at: at(-2, 0), label: 'hourly files', sub: 'S3' };
const batch: SceneNode = { id: 'batch', kind: 'worker', at: at(1.5, 0), label: 'batch job', sub: 'runs at :05' };

const pipe: SceneLink[] = [
  { from: 'phones', to: 'kafka' },
  { from: 'kafka', to: 'filter' },
  { from: 'filter', to: 'counter' },
  { from: 'counter', to: 'dash' },
];

export const streamProcessing: Lesson = {
  id: 'stream-processing',
  title: 'Stream processing',
  tagline: 'Count ad clicks per minute as they happen, and get the right answer when events arrive late, twice or out of order.',
  minutes: 15,
  level: 'Advanced',
  learn: [
    'Batch and stream processing, and when results need to be fresh',
    'A streaming job as a graph of operators, partitioned by key',
    'Stateful aggregation with local state and checkpoints',
    'Tumbling, sliding and session windows',
    'Event time, processing time, watermarks and late data',
    'What exactly-once means in practice, and where Flink and Kafka Streams fit',
  ],
  metrics: [
    { key: 'lag', label: 'Dashboard lag' },
    { key: 'rate', label: 'Clicks/s' },
    { key: 'state', label: 'Job state' },
    { key: 'late', label: 'Late clicks' },
  ],
  steps: [
    {
      title: 'Hourly batch',
      tag: 'problem',
      heading: 'Advertisers see their spend an hour late',
      eli5: 'The post office counts letters only once an hour, by emptying the whole sack on a table. By the time the count is done, the count is already old.',
      body: [
        'An ad platform charges per click and shows advertisers their spend. Click events land in hourly files on S3. A batch job starts five minutes after each hour and takes about 20 minutes to count the 180 million clicks in it. The dashboard is between **25 and 85 minutes** behind.',
        'The money follows the lag. A campaign with a $1,000 daily budget runs out at 10:07. The ad server only learns at 11:25 and keeps showing the ad for 78 minutes of clicks the advertiser will not pay for. The platform eats the overspend.',
        'Running the batch every minute does not fix it. Each run would reread files, start up and shut down, and the cost per run stays the same while the data per run shrinks.',
      ],
      keyIdea: 'When an answer is worth more the sooner you have it, waiting to collect a full batch costs money.',
      metrics: { lag: '25 to 85 min', rate: '50,000/s', state: '-', late: '-' },
      scene: {
        nodes: [
          phones,
          { ...kafka, sub: 'Kafka' },
          { ...files, status: 'active', badge: '10:00 to 11:00' },
          { ...batch, status: 'hot', badge: 'running 20 min' },
          { ...dash, status: 'hot', badge: 'data from 10:00' },
        ],
        links: [
          { from: 'phones', to: 'kafka' },
          { from: 'kafka', to: 'files' },
          { from: 'files', to: 'batch' },
          { from: 'batch', to: 'dash' },
        ],
        flows: [
          { path: ['phones', 'kafka', 'files'], tone: 'event', count: 6, duration: 1.6 },
          { path: ['files', 'batch'], tone: 'data', label: 'read 180 M rows', duration: 2.2, delay: 1.8 },
          { path: ['batch', 'dash'], tone: 'data', label: 'hour totals', duration: 1.2, delay: 4.2 },
        ],
        caption: 'The count for 10:00 arrives after 11:00',
      },
    },
    {
      title: 'Stream vs batch',
      tag: 'concept',
      heading: 'Process each event as it arrives',
      eli5: 'Instead of emptying the sack once an hour, a clerk stands at the belt and adds one to a tally as each letter goes past. The tally is always nearly up to date.',
      body: [
        '**Batch processing** runs over a bounded input: a day of files, a table snapshot. It reads everything, computes, writes a result and stops. **Stream processing** runs over an unbounded input that never ends. The job runs forever, reads each event moments after it is produced, and keeps its results up to date.',
        'The clicks are already in a Kafka topic. A stream job reads it directly and updates the count for each ad within seconds. The dashboard lag drops from about an hour to **about 15 seconds**, most of which is waiting for slow events, as we will see.',
        'Batch is still useful. It is simpler, easy to rerun on a whole day, and good for reports where an hour is fine. Many teams run both: a stream for fresh numbers and a nightly batch over the raw events as the billing record that the stream is checked against.',
      ],
      keyIdea: 'A batch job answers a question about data that has stopped. A stream job keeps answering it while data keeps coming.',
      metrics: { lag: '~15 s', rate: '50,000/s', state: '-', late: '-' },
      scene: {
        nodes: [phones, kafka, { ...filter, status: 'active' }, { ...counter, status: 'active', badge: 'ad 311: 4,820' }, { ...dash, status: 'ok', badge: '15 s old' }],
        links: pipe,
        flows: [
          { path: ['phones', 'kafka'], tone: 'event', count: 4, duration: 1 },
          { path: ['kafka', 'filter', 'counter'], tone: 'event', count: 4, duration: 1.6, delay: 0.8 },
          { path: ['counter', 'dash'], tone: 'data', label: 'ad 311 +1', duration: 1, delay: 2.4 },
        ],
        caption: 'Every click updates a running count',
      },
    },
    {
      title: 'Operators',
      tag: 'concept',
      heading: 'A job is a graph of operators',
      eli5: 'The belt passes several clerks. The first throws out junk mail. The next sends each letter to the clerk in charge of its street, so every street\'s letters are always counted by the same clerk.',
      body: [
        'A stream job is a graph of **operators**: a source that reads Kafka, a filter that drops bot clicks, an aggregation that counts, and a sink that writes results. Each operator runs as many parallel instances, here 32, one per Kafka partition.',
        'Counting per ad needs every click for an ad to reach the same instance. A **keyBy** on `ad_id` does that: it hashes the key and sends each event over the network to the instance that owns the key. This shuffle is the most expensive part of most jobs, so filter and shrink events before it.',
        'Operators like the filter are **stateless**: each event is handled alone. The counter is **stateful**: its answer depends on everything it has seen. Stateless operators are easy to scale and restart. Stateful ones are where the hard problems live.',
      ],
      keyIdea: 'Stream jobs are graphs of parallel operators. Partitioning by key sends all events for one key to one instance, which makes per-key state possible.',
      metrics: { lag: '~15 s', rate: '50,000/s', state: '-', late: '-' },
      scene: {
        nodes: [
          phones,
          { ...kafka, badge: 'source' },
          { ...filter, status: 'active', badge: 'stateless, x32' },
          { ...counter, status: 'active', badge: 'stateful, x32' },
          { ...dash, badge: 'sink' },
        ],
        links: [...pipe.slice(0, 2), { from: 'filter', to: 'counter', label: 'shuffle by ad_id' }, pipe[3]],
        flows: [
          { path: ['kafka', 'filter'], tone: 'event', count: 4, duration: 1 },
          { path: ['filter', 'kafka'], tone: 'error', label: 'bot, dropped', duration: 1, delay: 1.1 },
          { path: ['filter', 'counter'], tone: 'event', label: 'ad 311', count: 3, duration: 1.2, delay: 1.2 },
          { path: ['counter', 'dash'], tone: 'data', duration: 1, delay: 2.6 },
        ],
        caption: 'Source, filter, shuffle by key, count, sink',
      },
    },
    {
      title: 'State',
      tag: 'concept',
      heading: 'Where the running counts live',
      eli5: 'Each clerk keeps her tally sheet on her own desk, so she never walks to the office to add one. Every half minute she photocopies the sheet into a safe, in case her desk catches fire.',
      body: [
        'With 2 million active ads, the counter holds millions of small counters, about 2 GB in total. Updating a remote database for every click would mean 50,000 network writes a second. Instead each instance keeps **local state** for the keys it owns, in memory or in an embedded store such as RocksDB on local disk. An update is a local read and write.',
        'Local state dies with the machine, so the job takes a **checkpoint** every 30 seconds: a consistent snapshot of every operator\'s state, plus the Kafka offsets it had read up to, written to S3.',
        'When an instance crashes, the job restores all operators from the last checkpoint and rewinds Kafka to the saved offsets. Up to 30 seconds of clicks are read again, and because state was rewound to the same point, each one is counted once.',
      ],
      keyIdea: 'Keep state local to the operator for speed, and checkpoint it together with the input offsets so a restart resumes from one consistent point.',
      metrics: { lag: '~15 s', rate: '50,000/s', state: '2 GB', late: '-' },
      scene: {
        nodes: [
          phones,
          { ...kafka, badge: 'offsets saved' },
          filter,
          { ...counter, status: 'active', badge: 'RocksDB, 2 GB' },
          dash,
          { ...ckpt, status: 'active', badge: 'checkpoint 4,112' },
        ],
        links: [...pipe, { from: 'counter', to: 'ckpt', style: 'dashed' }],
        flows: [
          { path: ['kafka', 'filter', 'counter'], tone: 'event', count: 4, duration: 1.6 },
          { path: ['counter', 'ckpt'], tone: 'data', label: 'snapshot + offsets', duration: 1.6, delay: 1.8 },
          { path: ['counter', 'dash'], tone: 'data', duration: 1, delay: 2 },
        ],
        caption: 'State stays on the worker. A copy goes to S3 every 30 seconds.',
      },
    },
    {
      title: 'Windows',
      tag: 'concept',
      heading: 'Tumbling, sliding and session windows',
      eli5: 'The clerk can start a fresh tally sheet every minute, or keep a sheet for "the last five minutes" that is updated every minute, or keep one sheet per customer until that customer stops sending letters for half an hour.',
      body: [
        'A count over an endless stream needs edges. A **window** groups events by time. A **tumbling** window has a fixed size and no overlap: clicks per ad for 10:00 to 10:01, then 10:01 to 10:02. Each click lands in exactly one window. This is what billing uses.',
        'A **sliding** (hopping) window has a size and a smaller step: the last 5 minutes, updated every minute. Windows overlap, so each click counts in 5 of them. It suits "trending ads right now".',
        'A **session** window has no fixed size. It is per key and closes after a gap with no events, say 30 minutes without a click from that user. It fits "what did a user do in one visit". Session windows can merge when a late event bridges two sessions, which makes them the most expensive kind.',
      ],
      keyIdea: 'Pick the window from the question: tumbling for totals per period, sliding for recent trends, session for bursts of activity per key.',
      metrics: { lag: '~15 s', rate: '50,000/s', state: '2.4 GB', late: '-' },
      scene: {
        nodes: [
          phones,
          kafka,
          filter,
          { ...counter, label: 'windowed count', status: 'active', badge: '10:00 to 10:01 closing' },
          { ...dash, status: 'ok', badge: 'ad 311 @ 10:00 = 812' },
        ],
        links: pipe,
        flows: [
          { path: ['kafka', 'filter', 'counter'], tone: 'event', count: 5, duration: 1.6 },
          { path: ['counter', 'dash'], tone: 'data', label: 'window result', duration: 1.2, delay: 2.2 },
        ],
        caption: 'One result per ad per window when the window closes',
      },
      code: {
        language: 'sql',
        title: 'The three windows in Flink SQL',
        source: `-- Tumbling: clicks per ad per minute (billing)
SELECT ad_id, window_start, COUNT(*) AS clicks
FROM TABLE(TUMBLE(TABLE clicks, DESCRIPTOR(event_time), INTERVAL '1' MINUTE))
GROUP BY ad_id, window_start, window_end;

-- Sliding: last 5 minutes, refreshed every minute (trending)
SELECT ad_id, window_end, COUNT(*) AS clicks
FROM TABLE(HOP(TABLE clicks, DESCRIPTOR(event_time),
               INTERVAL '1' MINUTE, INTERVAL '5' MINUTE))
GROUP BY ad_id, window_start, window_end;

-- Session: one window per user, closed by 30 minutes of silence
SELECT user_id, window_start, window_end, COUNT(*) AS clicks
FROM TABLE(SESSION(TABLE clicks PARTITION BY user_id,
                   DESCRIPTOR(event_time), INTERVAL '30' MINUTE))
GROUP BY user_id, window_start, window_end;`,
        highlight: [3, 8, 9, 14, 15],
      },
      quiz: {
        question: 'A sliding window is 5 minutes long and advances every 1 minute. In how many windows is a single click counted?',
        options: ['1', '2', '5', '60'],
        answer: 2,
        explain: 'Windows start every minute and each lasts 5 minutes, so any moment is covered by 5 overlapping windows. That also means 5 times the state of a tumbling window.',
      },
    },
    {
      title: 'Event time',
      tag: 'concept',
      heading: 'When it happened is not when it arrived',
      eli5: 'A letter postmarked Monday can reach the sorting belt on Wednesday. If the clerk counts it as Wednesday mail, Monday\'s count is wrong. So the clerk reads the postmark.',
      body: [
        'Each click has two times. **Event time** is when the user tapped, stamped by the phone. **Processing time** is when the job sees it. Usually they are a second apart. A phone in a tunnel taps at 10:00:58 and only reaches the network at 10:03:10.',
        'Windows by processing time are simple and always on time, but they put that click in the 10:03 minute. Billing per minute is then wrong, and replaying yesterday\'s data gives different answers from the first run, because everything is "processed" today.',
        'Windows by **event time** give the right minute and repeatable results. The price is that events arrive out of order, so the job can never be quite sure that a minute is finished. Some clicks for 10:00 may still be on their way.',
      ],
      keyIdea: 'Window on event time for correct and repeatable results, and accept that events will arrive out of order.',
      metrics: { lag: '~15 s', rate: '50,000/s', state: '2.4 GB', late: '-' },
      scene: {
        nodes: [
          phones,
          { ...tunnel, status: 'hot', badge: 'tapped 10:00:58' },
          kafka,
          filter,
          { ...counter, label: 'windowed count', status: 'active', badge: 'now 10:03:10' },
          dash,
        ],
        links: [...pipe, { from: 'tunnel', to: 'kafka', style: 'dashed' }],
        flows: [
          { path: ['phones', 'kafka', 'filter', 'counter'], tone: 'event', count: 3, duration: 2 },
          { path: ['tunnel', 'kafka', 'filter', 'counter'], tone: 'event', label: 'event_time 10:00:58', duration: 2.6, delay: 1.5 },
        ],
        caption: 'The click belongs to 10:00, though it arrives at 10:03',
      },
    },
    {
      title: 'Watermarks',
      tag: 'concept',
      heading: 'Watermarks decide when a window is done',
      eli5: 'The post office puts a card on the belt saying "all letters postmarked before 10:01 are now in". When the clerk sees the card, she closes the 10:00 sheet and sends the total.',
      body: [
        'A **watermark** is a marker flowing with the events that says: no more events with an event time earlier than T are expected. When the watermark passes 10:01, the window 10:00 to 10:01 fires and its count goes to the sink.',
        'The common rule is "largest event time seen, minus a fixed delay". With a 10-second delay, the job waits until it sees an event stamped 10:01:10 before closing 10:00. A longer delay catches more stragglers and makes every result later. That delay is most of the 15-second dashboard lag.',
        'Each Kafka partition produces its own watermark, and an operator moves at the pace of its **slowest** input. One partition with no traffic stops every window from closing. Set an idle timeout so quiet partitions are ignored.',
      ],
      keyIdea: 'A watermark is the job\'s guess that event time T is complete. Its delay trades result latency against how many events arrive too late.',
      metrics: { lag: '~15 s', rate: '50,000/s', state: '2.4 GB', late: '0.2%' },
      scene: {
        nodes: [
          phones,
          { ...kafka, badge: 'p7 idle' },
          filter,
          { ...counter, label: 'windowed count', status: 'active', badge: 'watermark 10:01:00' },
          { ...dash, status: 'ok', badge: '10:00 window fired' },
        ],
        links: pipe,
        flows: [
          { path: ['kafka', 'filter', 'counter'], tone: 'event', count: 3, duration: 1.6 },
          { path: ['kafka', 'filter', 'counter'], tone: 'handshake', label: 'watermark 10:01', duration: 1.6, delay: 1.8 },
          { path: ['counter', 'dash'], tone: 'data', label: '10:00 counts', duration: 1.2, delay: 3.5 },
        ],
        caption: 'The watermark passes 10:01, so the 10:00 window closes',
      },
      code: {
        language: 'sql',
        title: 'Event time and a 10-second watermark on the Kafka source',
        source: `CREATE TABLE clicks (
  click_id   STRING,
  ad_id      BIGINT,
  user_id    BIGINT,
  event_time TIMESTAMP(3),                               -- stamped by the phone
  WATERMARK FOR event_time AS event_time - INTERVAL '10' SECOND
) WITH (
  'connector' = 'kafka',
  'topic' = 'clicks',
  'properties.bootstrap.servers' = 'kafka:9092',
  'properties.group.id' = 'ad-counts',
  'scan.startup.mode' = 'group-offsets',
  'format' = 'json'
);

-- A partition with no events for 30 s stops holding back the watermark.
SET 'table.exec.source.idle-timeout' = '30 s';`,
        highlight: [5, 6, 17],
      },
    },
    {
      title: 'Late data',
      tag: 'case',
      heading: 'Case: the click that missed its window',
      eli5: 'The tunnel letter arrives after the 10:00 sheet was sent. The clerk can throw it away, or send a corrected 10:00 total, or put it in a box that the night shift recounts.',
      body: [
        'The tunnel click, stamped 10:00:58, arrives at 10:03:10. The watermark passed 10:01 two minutes ago and the 10:00 window has already fired. In this job about 0.2% of clicks arrive behind the watermark. For a large advertiser that is real money.',
        'There are three options, and most systems use more than one. **Drop** late events but count them in a metric, so you know how big the gap is. Allow **lateness**: keep window state for an extra period, say 10 minutes, and emit a corrected count when a late event lands. The sink then has to accept updates to a row it already has. Or **reconcile**: a nightly batch over all raw events produces the billing numbers, and the stream serves the fast, nearly right dashboard.',
        'Whatever you choose, make the choice on purpose. Late data silently dropped shows up later as an invoice that does not match the advertiser\'s own logs.',
      ],
      keyIdea: 'Some events always arrive after the watermark. Decide whether to drop, correct or reconcile them, and measure how many there are.',
      metrics: { lag: '~15 s', rate: '50,000/s', state: '2.9 GB', late: '0.2%' },
      scene: {
        nodes: [
          phones,
          { ...tunnel, status: 'active', badge: 'arrives 10:03:10' },
          kafka,
          filter,
          { ...counter, label: 'windowed count', status: 'hot', badge: '10:00 kept 10 min' },
          { ...dash, status: 'active', badge: 'ad 311 @ 10:00: 812 → 813' },
        ],
        links: [...pipe, { from: 'tunnel', to: 'kafka', style: 'dashed' }],
        flows: [
          { path: ['tunnel', 'kafka', 'filter', 'counter'], tone: 'error', label: 'late: 10:00:58', duration: 2.4 },
          { path: ['counter', 'dash'], tone: 'data', label: 'corrected count', duration: 1.2, delay: 2.6 },
        ],
        caption: 'Allowed lateness turns a lost click into a correction',
      },
    },
    {
      title: 'Exactly-once',
      tag: 'concept',
      heading: 'Exactly-once, and what it really covers',
      eli5: 'If the clerk\'s desk burns, she gets her sheet back from the safe and rereads the letters since that copy. The final tally counts each letter once, even though she read some of them twice.',
      body: [
        'Stream engines advertise **exactly-once**. What they promise is exactly-once **state**: after a crash and restore, each event affects the operators\' state once. It does not mean each event is processed once. Events after the last checkpoint are read and processed again.',
        'The output is a separate problem. If the job wrote a window result to the sink and then crashed, the replay writes it again. Two ways to make the output exactly-once. A **transactional sink** writes inside a transaction that commits only when the checkpoint completes, as Kafka transactions allow. Readers then see results only after each checkpoint, so output lags by up to 30 seconds. Or an **idempotent sink**: write each result keyed by `(ad_id, window_start)` as an upsert, so a repeat overwrites the same row with the same value.',
        'Two more conditions. The source must be replayable from an offset, which Kafka is. And duplicates created before the job, such as a phone retrying a click upload, are new events to the engine. Remove those with a `click_id` and a dedup step.',
      ],
      keyIdea: 'Checkpoints give exactly-once state. End-to-end exactly-once also needs a replayable source, a transactional or idempotent sink, and dedup of upstream retries.',
      metrics: { lag: '~15 s', rate: '50,000/s', state: '2.9 GB', late: '0.2%' },
      scene: {
        nodes: [
          phones,
          { ...kafka, badge: 'rewind to checkpoint' },
          filter,
          { ...counter, status: 'down', badge: 'crashed, restoring' },
          { ...dash, status: 'ok', badge: 'upsert, same row' },
          { ...ckpt, status: 'active', badge: 'checkpoint 4,112' },
        ],
        links: [...pipe, { from: 'counter', to: 'ckpt', style: 'dashed' }],
        flows: [
          { path: ['ckpt', 'counter'], tone: 'data', label: 'restore state', duration: 1.4 },
          { path: ['kafka', 'filter', 'counter'], tone: 'event', label: 'replay 30 s', count: 3, duration: 1.8, delay: 1.5 },
          { path: ['counter', 'dash'], tone: 'data', label: 'same result again', duration: 1.2, delay: 3.5 },
        ],
        caption: 'State rewinds with the offsets. The sink absorbs the repeat.',
      },
      code: {
        language: 'sql',
        title: 'An idempotent sink: replays overwrite, never add',
        source: `CREATE TABLE ad_clicks_per_minute (
  ad_id        bigint      NOT NULL,
  window_start timestamptz NOT NULL,
  clicks       bigint      NOT NULL,
  PRIMARY KEY (ad_id, window_start)
);

-- The job writes each window result like this. Writing it twice,
-- or writing a later correction, leaves one correct row.
INSERT INTO ad_clicks_per_minute (ad_id, window_start, clicks)
VALUES (:ad_id, :window_start, :clicks)
ON CONFLICT (ad_id, window_start)
DO UPDATE SET clicks = EXCLUDED.clicks;   -- set the value, never clicks + 1`,
        highlight: [5, 12, 13],
      },
    },
    {
      title: 'Which engine',
      tag: 'tradeoff',
      heading: 'Where Flink and Kafka Streams fit',
      eli5: 'A big post office has its own sorting hall with many clerks, for mail from everywhere. A small shop has one clerk at the counter who sorts only the shop\'s own mail. Both count letters well.',
      body: [
        '**Apache Flink** is a cluster that runs jobs. It reads from and writes to many systems (Kafka, files, databases, change streams), handles very large state, and has strong event-time support, windows and SQL. The cost is a platform to run: a cluster, deployments, checkpoint storage, upgrades. It suits a shared streaming platform and jobs like this one.',
        '**Kafka Streams** is a Java library inside your own service. It reads from Kafka and writes to Kafka, keeps state in local RocksDB backed up to Kafka changelog topics, and scales by running more copies of your app, up to the partition count. Exactly-once comes from Kafka transactions. It suits one team building a Kafka-in, Kafka-out service without operating a cluster.',
        'Spark Structured Streaming works in small micro-batches and fits teams already on Spark. Before choosing any of them, ask whether you need a stream at all. If numbers a few minutes old are fine, a query every minute against a database may be the simplest correct answer.',
      ],
      keyIdea: 'Flink is a platform for many sources and large state. Kafka Streams is a library for Kafka-to-Kafka services. Neither beats a simple query when minutes of lag are fine.',
      metrics: { lag: '~15 s', rate: '50,000/s', state: '2.9 GB', late: '0.2%' },
      scene: {
        nodes: [
          phones,
          kafka,
          { ...filter, status: 'active' },
          { ...counter, status: 'active' },
          dash,
          { ...ckpt, label: 'state backup', sub: 'S3 or changelog topic' },
        ],
        links: [...pipe, { from: 'counter', to: 'ckpt', style: 'dashed' }],
        zones: [{ id: 'engine', from: [-2, -1.75], to: [1.75, 2], label: 'Flink job or Kafka Streams app', tone: 'violet' }],
        flows: [
          { path: ['kafka', 'filter', 'counter'], tone: 'event', count: 4, duration: 1.6 },
          { path: ['counter', 'dash'], tone: 'data', duration: 1.2, delay: 1.8 },
          { path: ['counter', 'ckpt'], tone: 'data', duration: 1.4, delay: 2.2 },
        ],
        caption: 'The same operators, run by a cluster or embedded in an app',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Fresh answers from data that never stops',
      eli5: 'Clerks at the belt throw out junk, pass each letter to its street\'s clerk, tally by postmark, close a sheet when the "all in" card passes, fix totals for late letters, and copy their sheets into the safe.',
      body: [
        'A stream job is a graph of operators reading an unbounded source. Keyed partitioning sends each key to one instance, which keeps local state and checkpoints it with the input offsets. Windows (tumbling, sliding, session) turn an endless stream into finished answers.',
        'Window on event time, close windows with watermarks, and decide on purpose what happens to late events. Exactly-once covers state. For outputs, add a transactional or idempotent sink and dedup upstream retries. Choose Flink for a platform, Kafka Streams for a Kafka-native service, and a plain query when minutes of lag are fine.',
      ],
      keyIdea: 'Stream processing trades the certainty of a finished batch for fresh answers, and watermarks, state and idempotent sinks win most of that certainty back.',
      metrics: { lag: '~15 s', rate: '50,000/s', state: '2.9 GB', late: '0.2%' },
      scene: {
        nodes: [phones, kafka, { ...filter, status: 'ok' }, { ...counter, status: 'ok' }, { ...dash, status: 'ok' }, ckpt],
        links: [...pipe, { from: 'counter', to: 'ckpt', style: 'dashed' }],
        flows: [
          { path: ['phones', 'kafka', 'filter', 'counter'], tone: 'event', count: 3, duration: 2 },
          { path: ['counter', 'dash'], tone: 'data', duration: 1.2, delay: 2.1 },
        ],
      },
      quiz: {
        question: 'A Flink job with exactly-once checkpoints crashes and restarts. The sink appends `clicks + n` to a database row for every window result. What can go wrong?',
        options: [
          'Nothing, exactly-once covers the whole pipeline',
          'Results written after the last checkpoint are written again on replay, so some counts are added twice',
          'Late events are lost',
          'The watermark resets to zero',
        ],
        answer: 1,
        explain: 'Exactly-once applies to the job\'s state. Output already written before the crash is produced again during replay. An upsert keyed by (ad_id, window_start) or a transactional sink makes the repeat harmless.',
      },
    },
  ],
};
