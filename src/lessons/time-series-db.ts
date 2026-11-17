import type { Lesson, SceneNode } from '../engine/types';

const hosts: SceneNode = { id: 'hosts', kind: 'server', at: [-4, 4], label: '10,000 hosts', sub: '100 metrics each' };
const collector: SceneNode = { id: 'collector', kind: 'worker', at: [-1, 3], label: 'collector', sub: 'every 10 s' };
const pg: SceneNode = { id: 'pg', kind: 'db', at: [2, 2], label: 'Postgres', sub: 'metrics table' };
const tsdb: SceneNode = { id: 'tsdb', kind: 'db', at: [2, 2], label: 'time-series DB' };
const dash: SceneNode = { id: 'dash', kind: 'monitor', at: [0.5, -2.5], label: 'dashboard', sub: 'Grafana' };
const dashSide: SceneNode = { ...dash, at: [5, 1] };

const k1: SceneNode = { id: 'k1', kind: 'shard', at: [-1, -2], label: 'chunk Mon', sub: 'sealed' };
const k2: SceneNode = { id: 'k2', kind: 'shard', at: [1.75, -2.75], label: 'chunk Tue', sub: 'sealed' };
const k3: SceneNode = { id: 'k3', kind: 'shard', at: [4.5, -3.5], label: 'chunk Wed', sub: 'open' };

const head: SceneNode = { id: 'head', kind: 'cache', at: [0.5, -2.5], label: 'head block', sub: 'last 2 h, in memory' };
const blocks: SceneNode = { id: 'blocks', kind: 'storage', at: [3.75, -2.75], label: 'compressed blocks', sub: 'on disk' };

const raw: SceneNode = { id: 'raw', kind: 'storage', at: [-1, -2], label: 'raw 10 s', sub: 'kept 15 days' };
const m1: SceneNode = { id: 'm1', kind: 'storage', at: [1.75, -2.75], label: '1-min rollups', sub: 'kept 90 days' };
const h1: SceneNode = { id: 'h1', kind: 'storage', at: [4.5, -3.5], label: '1-hour rollups', sub: 'kept 2 years' };
const rollup: SceneNode = { id: 'rollup', kind: 'worker', at: [2, 2], label: 'rollup job' };

const seriesIdx: SceneNode = { id: 'seriesIdx', kind: 'search', at: [0.5, -2.5], label: 'series index', sub: 'tag → series IDs' };

export const timeSeriesDb: Lesson = {
  id: 'time-series-db',
  title: 'Time-series databases',
  tagline: 'Store billions of timestamped points cheaply and answer "what happened over this window" in milliseconds.',
  minutes: 14,
  level: 'Intermediate',
  learn: [
    'What makes time-series data different: append-only, ordered, read as ranges',
    'Why a general-purpose database struggles with metrics at scale',
    'Time partitioning, and why dropping a chunk beats DELETE',
    'Delta-of-delta and XOR compression, from 70 bytes a point to under 2',
    'Downsampling and retention tiers',
    'Tags, series and the cardinality problem',
  ],
  metrics: [
    { key: 'writes', label: 'Ingest' },
    { key: 'bytes', label: 'Bytes per point' },
    { key: 'disk', label: 'Disk per day' },
    { key: 'query', label: '6 h chart' },
    { key: 'series', label: 'Series' },
  ],
  steps: [
    {
      title: 'Metrics table',
      tag: 'problem',
      heading: 'A billion rows a day in an ordinary table',
      eli5: 'Every classroom has a thermometer, and every few seconds a kid writes each reading in one big class **notebook**. By Friday the notebook is so thick nobody can find Tuesday afternoon.',
      body: [
        'A team monitors **10,000 hosts**. Each reports 100 metrics (CPU, memory, disk, request latency) every 10 seconds. That is **100,000 points per second**, or **8.6 billion rows a day**, inserted into a Postgres table `metrics(time, host, metric, value)`.',
        'Each point carries 16 bytes of real data, a timestamp and a float. Once you add the row header, the host and metric columns and a B-tree index entry, it costs **about 70 bytes**: roughly 600 GB of disk a day.',
        'The dashboard asks for "CPU of host web-17 over the last 6 hours" and takes 40 seconds. Old data has to go, so a nightly `DELETE` of yesterday\'s billions of rows runs for hours and leaves dead rows for vacuum to clean up.',
      ],
      keyIdea: 'Metrics are many tiny writes that never change and are read back as time ranges. A general table pays full price for features this data never uses.',
      metrics: { writes: '100K points/s', bytes: '~70 B', disk: '600 GB', query: '40 s', series: '1M' },
      scene: {
        nodes: [hosts, { ...collector, status: 'active' }, { ...pg, status: 'hot', badge: '8.6B rows/day' }, { ...dash, status: 'hot', badge: '40 s to load' }],
        links: [
          { from: 'hosts', to: 'collector' },
          { from: 'collector', to: 'pg' },
          { from: 'dash', to: 'pg' },
        ],
        flows: [
          { path: ['hosts', 'collector'], tone: 'data', count: 5, duration: 1 },
          { path: ['collector', 'pg'], tone: 'data', label: 'INSERT x 100K/s', count: 5, duration: 1, delay: 1 },
          { path: ['dash', 'pg'], tone: 'request', label: 'web-17 CPU, 6 h', duration: 1.2, delay: 0.5 },
          { path: ['pg', 'dash'], tone: 'response', duration: 3.2, delay: 1.8 },
        ],
        caption: 'Every 10 seconds, a million new rows',
      },
    },
    {
      title: 'Data shape',
      tag: 'concept',
      heading: 'What time-series data looks like',
      eli5: 'Each thermometer has its own list of readings, written one after another and never changed. One list per thermometer is a **series**.',
      body: [
        'A **series** is one metric from one source, named by a metric name plus **tags** (also called labels): `cpu_usage{host="web-17", region="eu"}`. Each series is a list of **points**, a timestamp and a value. Our fleet has about a million series.',
        'The workload has a strong shape. Writes are **append-only** and arrive roughly in time order. Points are almost never updated. Recent data is read all the time and old data hardly at all. Reads are **ranges and aggregates**: one series or a group of them over a window, averaged or maxed per minute.',
        'A time-series database is built around those facts. It keeps each series\' points together, sorted by time, and gives up general features like row updates and multi-row transactions that this data does not need.',
      ],
      keyIdea: 'Time-series data is append-only, time-ordered and read as ranges. A store built for that shape can be far cheaper and faster.',
      metrics: { writes: '100K points/s', bytes: '~70 B', disk: '600 GB', query: '40 s', series: '1M' },
      scene: {
        nodes: [
          { ...hosts, status: 'active' },
          { ...collector, status: 'active', badge: 'cpu{host=web-17}' },
          { ...tsdb, status: 'active', badge: 'append in time order' },
          { ...dash, badge: 'last 6 h, per minute' },
        ],
        links: [
          { from: 'hosts', to: 'collector' },
          { from: 'collector', to: 'tsdb' },
          { from: 'dash', to: 'tsdb' },
        ],
        flows: [
          { path: ['hosts', 'collector'], tone: 'data', label: '10:00:00 61.2', duration: 1 },
          { path: ['collector', 'tsdb'], tone: 'data', label: '10:00:10 63.0', duration: 1, delay: 1.1 },
          { path: ['dash', 'tsdb', 'dash'], tone: 'request', label: 'range query', duration: 1.8, delay: 2.3 },
        ],
        caption: 'Name + tags pick the series. Time picks the points.',
      },
    },
    {
      title: 'Why not SQL',
      tag: 'concept',
      heading: 'Where a general database spends its effort',
      eli5: 'The class notebook writes the room name and the date on every single line and keeps a big alphabetical list at the back. That **overhead** is bigger than the readings themselves.',
      body: [
        '**Per-row overhead.** Postgres stores each point as a row with a header of about 23 bytes, the repeated host and metric values, and alignment padding. The data you care about is 16 bytes. Most of the disk holds bookkeeping.',
        '**Index churn.** An index on `(host, metric, time)` puts the million series in different parts of the tree. Each batch of 100,000 inserts touches pages all over the index, so the index stops fitting in memory and every insert risks a random disk read.',
        '**Deletes are expensive.** Removing old points with `DELETE` marks billions of rows dead one by one. Vacuum then has to rewrite pages to reclaim space, all while new data keeps arriving.',
      ],
      keyIdea: 'A general database pays per-row overhead, random index updates and row-by-row deletes. None of that buys anything for append-only metrics.',
      metrics: { writes: '100K points/s', bytes: '~70 B', disk: '600 GB', query: '40 s', series: '1M' },
      scene: {
        nodes: [
          hosts,
          { ...collector, status: 'active' },
          { ...pg, status: 'hot', badge: '23 B header per row' },
          { ...dash, label: 'nightly DELETE', sub: 'cleanup job', status: 'hot', badge: 'hours of vacuum' },
        ],
        links: [
          { from: 'hosts', to: 'collector' },
          { from: 'collector', to: 'pg' },
          { from: 'dash', to: 'pg' },
        ],
        flows: [
          { path: ['collector', 'pg'], tone: 'data', label: 'random index pages', count: 5, duration: 1.2 },
          { path: ['dash', 'pg'], tone: 'error', label: 'DELETE 8.6B rows', duration: 2.4, delay: 0.6 },
        ],
        caption: 'Bookkeeping costs more than the data',
      },
    },
    {
      title: 'Time chunks',
      tag: 'concept',
      heading: 'Partition by time, drop whole chunks',
      eli5: 'Start a fresh notebook page every day. Kids only ever write on today\'s page. To throw out old readings, you tear out the old pages, which takes a second. Each page is a **chunk**.',
      body: [
        'A time-series store splits data into **chunks** by time window, here one per day. All writes go to the newest chunk, so its index is small and stays in memory. Older chunks are **sealed**: nothing writes to them again, so they can be compressed and moved to cheaper disk.',
        'A query for the last 6 hours only opens the chunks that overlap that window. The others are skipped without reading a byte. The 40-second dashboard query now touches one chunk.',
        '**Retention** becomes cheap. Deleting data older than 15 days is "drop the chunk for day 16", which removes a file. There are no dead rows and no vacuum. TimescaleDB does this inside Postgres. Prometheus, InfluxDB and VictoriaMetrics use their own block formats with the same idea.',
      ],
      keyIdea: 'Time chunks keep writes on a small hot index, let queries skip whole windows, and turn retention into dropping files.',
      metrics: { writes: '100K points/s', bytes: '~70 B', disk: '600 GB', query: '2 s', series: '1M' },
      scene: {
        nodes: [
          hosts,
          { ...collector, status: 'active' },
          { ...k1, status: 'down', badge: 'day 16: dropped' },
          { ...k2, status: 'dim' },
          { ...k3, status: 'active', badge: 'all writes here' },
          { ...dashSide, status: 'ok', badge: 'reads 1 chunk' },
        ],
        links: [
          { from: 'hosts', to: 'collector' },
          { from: 'collector', to: 'k3' },
          { from: 'dash', to: 'k3' },
          { from: 'dash', to: 'k2', style: 'faint' },
        ],
        flows: [
          { path: ['hosts', 'collector'], tone: 'data', count: 3, duration: 1 },
          { path: ['collector', 'k3'], tone: 'data', label: 'append', count: 3, duration: 1.4, delay: 1 },
          { path: ['dash', 'k3', 'dash'], tone: 'request', label: 'last 6 h', duration: 1.8, delay: 2.6 },
        ],
        caption: 'Write to today, skip the rest, drop the oldest',
      },
      code: {
        language: 'sql',
        title: 'TimescaleDB: daily chunks, compression and retention',
        source: `CREATE TABLE metrics (
  time   TIMESTAMPTZ NOT NULL,
  host   TEXT        NOT NULL,
  metric TEXT        NOT NULL,
  value  DOUBLE PRECISION
);

-- one chunk per day, created automatically as data arrives
SELECT create_hypertable('metrics', 'time',
                         chunk_time_interval => INTERVAL '1 day');

-- compress sealed chunks, grouping each series' points together
ALTER TABLE metrics SET (timescaledb.compress,
                         timescaledb.compress_segmentby = 'host, metric');
SELECT add_compression_policy('metrics', INTERVAL '1 day');

-- retention: drop whole chunks older than 15 days
SELECT add_retention_policy('metrics', INTERVAL '15 days');`,
        highlight: [9, 10, 14, 15, 18],
      },
    },
    {
      title: 'Compression',
      tag: 'concept',
      heading: 'Store the change, not the value',
      eli5: 'The readings go 20, 20, 20, 21. Instead of writing every number, write "same as before" in a tiny tick mark. Writing only the change is **compression**, and the page holds far more.',
      body: [
        'Inside a chunk, each series\' points are stored together as two columns: timestamps and values. Neighbors in each column are nearly the same, and the encoding takes advantage of that.',
        '**Timestamps** use **delta-of-delta**. Points arrive every 10 s, so the times `10:00:00, :10, :20, :30` have deltas of 10, 10, 10, and the delta of those deltas is 0, which costs a single bit. Only jitter costs more. **Values** are XORed with the previous value. An unchanged value XORs to zero and costs one bit. A small change leaves only a few meaningful bits in the middle.',
        'Facebook\'s Gorilla paper reported about 1.37 bytes per point with these two tricks, and Prometheus uses the same idea. Here that takes a point from about 70 bytes to about **1.4**, and a day from 600 GB to about **12 GB**. New points sit uncompressed in a memory **head block** until their window closes and they are written out.',
      ],
      keyIdea: 'Regular timestamps and slowly changing values compress to a bit or two per field, so a TSDB stores points 30 to 50 times smaller.',
      metrics: { writes: '100K points/s', bytes: '1.4 B', disk: '12 GB', query: '300 ms', series: '1M' },
      scene: {
        nodes: [
          hosts,
          { ...collector, status: 'active' },
          { ...head, status: 'active', badge: '16 B per point' },
          { ...blocks, status: 'ok', badge: '1.4 B per point' },
          { ...dashSide, status: 'ok' },
        ],
        links: [
          { from: 'hosts', to: 'collector' },
          { from: 'collector', to: 'head' },
          { from: 'head', to: 'blocks', style: 'dashed', label: 'every 2 h' },
          { from: 'dash', to: 'blocks' },
          { from: 'dash', to: 'head' },
        ],
        flows: [
          { path: ['collector', 'head'], tone: 'data', label: 'append', count: 4, duration: 1 },
          { path: ['head', 'blocks'], tone: 'data', label: 'delta-of-delta + XOR', duration: 2, delay: 1.2 },
          { path: ['dash', 'blocks', 'dash'], tone: 'request', label: 'decode a range', duration: 1.8, delay: 3.4 },
        ],
        caption: 'Recent points in memory, sealed blocks compressed',
      },
      quiz: {
        question: 'A series has timestamps 1000, 1010, 1020, 1031 (seconds). What delta-of-delta values does the encoder store after the first two points?',
        options: ['10, 10, 11', '0, 1', '1010, 1020, 1031', '0, 0'],
        answer: 1,
        explain: 'The deltas are 10, 10 and 11. The deltas of those deltas are 0 and 1. A zero costs one bit, and a small number like 1 costs only a few bits.',
      },
    },
    {
      title: 'Downsampling',
      tag: 'tradeoff',
      heading: 'Keep detail for days, summaries for years',
      eli5: 'After a week, the club stops keeping every reading. It keeps each hour\'s highest, lowest and average temperature. Shrinking old data like this is **downsampling**.',
      body: [
        'A one-year chart of one series at 10-second resolution is 3.15 million points. A screen is about 2,000 pixels wide, so almost all of those points are wasted. **Downsampling** precomputes coarser summaries: per minute, then per hour. A year at 1-hour resolution is 8,760 points.',
        'Each tier gets its own **retention**: raw points for 15 days, 1-minute rollups for 90 days, 1-hour rollups for 2 years. Queries pick the tier that matches their window. You lose the ability to zoom into a 10-second spike from last March. That is usually the right trade.',
        'Choose the summaries carefully. Store `min`, `max`, `sum` and `count`, so an average over a longer window is `sum / count` and stays correct. An average of averages is wrong when buckets have different counts. Percentiles cannot be combined at all, so keep histograms or sketches if you need p99 later.',
      ],
      keyIdea: 'Old data is read at coarse resolution, so store it that way. Keep summaries that combine correctly: min, max, sum and count.',
      metrics: { writes: '100K points/s', bytes: '1.4 B', disk: '12 GB', query: '300 ms', series: '1M' },
      scene: {
        nodes: [
          { ...collector, status: 'active' },
          { ...raw, status: 'active', badge: '3.15M pts/series/yr' },
          { ...m1, status: 'ok', badge: 'min max sum count' },
          { ...h1, status: 'ok', badge: '8,760 pts/series/yr' },
          { ...rollup, status: 'active' },
          { ...dashSide, label: '1-year chart', status: 'ok' },
        ],
        links: [
          { from: 'collector', to: 'raw' },
          { from: 'raw', to: 'rollup', style: 'dashed' },
          { from: 'rollup', to: 'm1', style: 'dashed' },
          { from: 'rollup', to: 'h1', style: 'dashed' },
          { from: 'dash', to: 'h1' },
        ],
        flows: [
          { path: ['collector', 'raw'], tone: 'data', count: 3, duration: 1 },
          { path: ['raw', 'rollup'], tone: 'data', label: 'every minute', duration: 1.2, delay: 1.1 },
          { path: ['rollup', 'm1'], tone: 'data', duration: 1.2, delay: 2.4 },
          { path: ['rollup', 'h1'], tone: 'data', duration: 1.4, delay: 2.4 },
          { path: ['dash', 'h1', 'dash'], tone: 'request', label: 'last year', duration: 1.8, delay: 4 },
        ],
        caption: 'Three resolutions, three retention periods',
      },
      code: {
        language: 'sql',
        title: 'A 1-minute rollup that refreshes itself',
        source: `CREATE MATERIALIZED VIEW metrics_1m
WITH (timescaledb.continuous) AS
SELECT time_bucket('1 minute', time) AS bucket,
       host, metric,
       min(value)   AS min_v,
       max(value)   AS max_v,
       sum(value)   AS sum_v,     -- avg = sum / count, safe to combine
       count(*)     AS n
FROM metrics
GROUP BY bucket, host, metric;

SELECT add_continuous_aggregate_policy('metrics_1m',
  start_offset      => INTERVAL '1 hour',
  end_offset        => INTERVAL '1 minute',
  schedule_interval => INTERVAL '1 minute');

SELECT add_retention_policy('metrics_1m', INTERVAL '90 days');`,
        highlight: [2, 3, 7, 8, 17],
      },
    },
    {
      title: 'Tags',
      tag: 'concept',
      heading: 'Finding series by their tags',
      eli5: 'Every reading list has stickers: "floor 2", "science room". A box of cards lists, for each sticker, which lists carry it. That card box is the **series index**.',
      body: [
        'A dashboard rarely asks for one series. It asks for `cpu_usage` where `region="eu"` and `service="checkout"`, grouped by host. The database first has to find which series match.',
        'It keeps a **series index**: an inverted index (the same structure as in the search index lesson) from each `tag=value` pair to the IDs of the series that carry it. The query intersects the lists for `region=eu` and `service=checkout`, gets 400 series IDs, and reads only their points in the time window.',
        'Tags are for things you filter and group by, and they should have a limited set of values: region, service, host, status code. Every distinct combination of tag values creates a new series.',
      ],
      keyIdea: 'Tags name series, and an inverted index from tag values to series IDs makes "all series matching these tags" a fast lookup.',
      metrics: { writes: '100K points/s', bytes: '1.4 B', disk: '12 GB', query: '200 ms', series: '1M' },
      scene: {
        nodes: [
          hosts,
          collector,
          { ...seriesIdx, status: 'active', badge: 'region=eu ∩ service=checkout' },
          { ...tsdb, status: 'ok', badge: '400 series' },
          { ...dashSide, status: 'active' },
        ],
        links: [
          { from: 'hosts', to: 'collector' },
          { from: 'collector', to: 'tsdb' },
          { from: 'dash', to: 'seriesIdx' },
          { from: 'dash', to: 'tsdb' },
        ],
        flows: [
          { path: ['dash', 'seriesIdx'], tone: 'request', label: 'which series?', duration: 1.2 },
          { path: ['seriesIdx', 'dash'], tone: 'response', label: '400 IDs', duration: 1.2, delay: 1.3 },
          { path: ['dash', 'tsdb', 'dash'], tone: 'data', label: 'their points, last 6 h', duration: 2, delay: 2.6 },
        ],
        caption: 'Tags select series, time selects points',
      },
    },
    {
      title: 'Cardinality',
      tag: 'case',
      heading: 'Case: someone adds a user_id tag',
      eli5: 'A kid puts a sticker with every visitor\'s name on the readings. Now there is a separate list for every visitor, millions of them. Too many different stickers is the **cardinality** problem.',
      body: [
        'A developer wants latency per customer and adds `user_id` as a tag on `http_latency`. There are 2 million active users. Multiply by 50 endpoints and 5 status codes and that one metric can produce hundreds of millions of series. The number of distinct series is the **cardinality**.',
        'Every series costs memory: an entry in the series index, a buffer in the head block, its own compressed stream. The ingesters run out of memory and restart, queries that touch the series index crawl, and the bill jumps. Most of those series hold a handful of points and are never read.',
        'The fix is a rule. Never use unbounded values (user IDs, request IDs, email addresses, full URLs with IDs in them) as tags. Put per-request detail in logs or traces. Set per-metric series limits so one bad deploy is rejected at ingest instead of taking the cluster down.',
      ],
      keyIdea: 'Series count is the product of tag value counts. One unbounded tag can turn a million series into hundreds of millions.',
      metrics: { writes: '100K points/s', bytes: '1.4 B', disk: '12 GB', query: 'timeout', series: '500M' },
      scene: {
        nodes: [
          { ...hosts, status: 'active', sub: 'new deploy' },
          { ...collector, status: 'hot', badge: '+user_id tag' },
          { ...seriesIdx, status: 'hot', badge: '1M → 500M series' },
          { ...tsdb, status: 'down', badge: 'out of memory' },
          { ...dashSide, status: 'hot', badge: 'timeout' },
        ],
        links: [
          { from: 'hosts', to: 'collector' },
          { from: 'collector', to: 'tsdb' },
          { from: 'dash', to: 'seriesIdx' },
          { from: 'dash', to: 'tsdb' },
        ],
        flows: [
          { path: ['hosts', 'collector'], tone: 'data', count: 6, duration: 0.9 },
          { path: ['collector', 'tsdb'], tone: 'error', label: 'new series per user', count: 6, duration: 1.1, delay: 1 },
          { path: ['dash', 'seriesIdx'], tone: 'error', label: 'scan 500M IDs', duration: 2.4, delay: 1.5 },
        ],
        caption: 'Each new tag value is a new series',
      },
    },
    {
      title: 'Queries',
      tag: 'concept',
      heading: 'The questions a TSDB answers well',
      eli5: 'The club asks the same few things: what is it now, what was the hottest hour today, which room warms up fastest. Grouping readings into hours to answer them is **bucketing**.',
      body: [
        'Almost every query is one of a few shapes. **Latest value**: what is it right now. **Range plus bucket**: average or max per minute over the last 6 hours, one line per host. **Rate**: counters such as `requests_total` only go up, so the useful number is the increase per second, with care for counters that reset to zero when a process restarts. **Top-k**: the 5 hosts with the highest CPU right now.',
        'Each one is a time filter (chunk pruning), a tag filter (series index), then a scan of compressed points that are stored next to each other. That is why the 6-hour chart that took 40 seconds in Postgres now takes about **200 ms**.',
        'The trade-off is everything else. Updating one old point, joining with business tables or running a transaction across series ranges from awkward to impossible. Keep that data in a normal database and query the two side by side.',
      ],
      keyIdea: 'Time filter, tag filter, scan a compressed range, aggregate per bucket. A TSDB makes that one path fast and accepts that other paths are slow.',
      metrics: { writes: '100K points/s', bytes: '1.4 B', disk: '12 GB', query: '200 ms', series: '1M' },
      scene: {
        nodes: [{ ...hosts, status: 'dim' }, collector, { ...tsdb, status: 'ok', badge: '1 chunk, 400 series' }, { ...dash, status: 'active', badge: '200 ms' }],
        links: [
          { from: 'hosts', to: 'collector' },
          { from: 'collector', to: 'tsdb' },
          { from: 'dash', to: 'tsdb' },
        ],
        flows: [
          { path: ['dash', 'tsdb'], tone: 'request', label: 'avg per minute, 6 h', duration: 1 },
          { path: ['tsdb', 'dash'], tone: 'response', label: '360 points per host', duration: 1, delay: 1.1 },
          { path: ['dash', 'tsdb'], tone: 'request', label: 'top 5 CPU now', duration: 1, delay: 2.4 },
          { path: ['tsdb', 'dash'], tone: 'response', duration: 1, delay: 3.5 },
        ],
        caption: 'Prune by time, select by tag, aggregate by bucket',
      },
      code: {
        language: 'sql',
        title: 'Typical queries in TimescaleDB',
        source: `-- range + bucket: average CPU per minute, last 6 hours, per host
SELECT time_bucket('1 minute', time) AS minute, host, avg(value)
FROM metrics
WHERE metric = 'cpu_usage' AND time > now() - INTERVAL '6 hours'
GROUP BY minute, host
ORDER BY minute;

-- latest value per host
SELECT host, last(value, time) AS cpu_now
FROM metrics
WHERE metric = 'cpu_usage' AND time > now() - INTERVAL '1 minute'
GROUP BY host;

-- top 5 hosts by CPU over the last 5 minutes
SELECT host, avg(value) AS cpu
FROM metrics
WHERE metric = 'cpu_usage' AND time > now() - INTERVAL '5 minutes'
GROUP BY host ORDER BY cpu DESC LIMIT 5;`,
        highlight: [2, 4, 9, 17, 18],
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Built for append, range and aggregate',
      eli5: 'One page per day, only the changes written down, old pages shrunk to hourly highs and lows, and a few stickers per list. That is how the **time-series** notebook stays thin and quick.',
      body: [
        'Time-series data is append-only, time-ordered and read as ranges. A general table spends about 70 bytes and a random index update per point. A TSDB groups points by series, splits them into **time chunks**, and compresses timestamps with **delta-of-delta** and values with XOR, down to under 2 bytes a point.',
        '**Retention** drops whole chunks. **Downsampling** keeps min, max, sum and count at coarser resolution for older data. Tags select series through an inverted index, and **cardinality**, the number of distinct series, is the limit to watch: no unbounded values in tags.',
      ],
      keyIdea: 'A time-series database wins by matching the data\'s shape: chunk by time, compress neighbors, shrink the past, and keep tags bounded.',
      metrics: { writes: '100K points/s', bytes: '1.4 B', disk: '12 GB', query: '200 ms', series: '1M' },
      scene: {
        nodes: [hosts, collector, { ...tsdb, status: 'ok' }, { ...dash, status: 'ok' }],
        links: [
          { from: 'hosts', to: 'collector' },
          { from: 'collector', to: 'tsdb' },
          { from: 'dash', to: 'tsdb' },
        ],
        flows: [
          { path: ['hosts', 'collector', 'tsdb'], tone: 'data', count: 3, duration: 1.8 },
          { path: ['dash', 'tsdb', 'dash'], tone: 'request', label: 'range query', duration: 1.8, delay: 2 },
        ],
      },
      quiz: {
        question: 'A metric has tags region (5 values), service (40 values) and status (6 values). A developer adds request_id. What happens?',
        options: [
          'Nothing much, tags are free',
          'Series count goes from at most 1,200 to roughly one new series per request, and memory use explodes',
          'Compression improves because there are more series',
          'Queries get faster because each series is smaller',
        ],
        answer: 1,
        explain: 'Series count is the product of distinct tag values: 5 × 40 × 6 = 1,200. A request ID is unique per request, so every request creates a new series with its own index entry and buffer. That detail belongs in logs or traces.',
      },
    },
  ],
};
