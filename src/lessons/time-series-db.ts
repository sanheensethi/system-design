import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const hosts: SceneNode = { id: 'hosts', kind: 'server', at: at(-4, -3), label: '10,000 hosts', sub: '100 metrics each' };
const collector: SceneNode = { id: 'collector', kind: 'block', at: at(0, -3), label: 'collector', sub: 'every 10 s', icon: 'Inbox', tint: 'blue' };
const pg: SceneNode = { id: 'db', kind: 'db', at: at(4, -4), label: 'Postgres', sub: 'metrics table' };
const tsdb: SceneNode = { id: 'db', kind: 'block', at: at(4, -4), label: 'time-series DB', icon: 'Database', tint: 'teal' };
const dash: SceneNode = { id: 'dash', kind: 'block', at: at(4, 4), label: 'dashboard', sub: 'Grafana', icon: 'Activity', tint: 'violet' };

const k1: SceneNode = { id: 'k1', kind: 'shard', at: at(-4, 3), label: 'chunk Mon', sub: 'sealed' };
const k2: SceneNode = { id: 'k2', kind: 'shard', at: at(0, 3), label: 'chunk Tue', sub: 'sealed' };
const k3: SceneNode = { id: 'k3', kind: 'shard', at: at(4, -4), label: 'chunk Wed', sub: 'open' };

const head: SceneNode = { id: 'head', kind: 'cache', at: at(0, 3), label: 'head block', sub: 'recent points' };
const wal: SceneNode = { id: 'wal', kind: 'block', at: at(-4, 3), label: 'write-ahead log', sub: 'on disk', icon: 'FileText', tint: 'amber' };
const blocks: SceneNode = { id: 'blocks', kind: 'storage', at: at(4, -4), label: 'compressed blocks', sub: 'on disk' };

const raw: SceneNode = { id: 'raw', kind: 'storage', at: at(-4, 3), label: 'raw 10 s', sub: 'kept 15 days' };
const m1: SceneNode = { id: 'm1', kind: 'storage', at: at(0, 3), label: '1-min rollups', sub: 'kept 90 days' };
const h1: SceneNode = { id: 'h1', kind: 'storage', at: at(4, 4), label: '1-hour rollups', sub: 'kept 2 years' };
const rollup: SceneNode = { id: 'rollup', kind: 'block', at: at(0, -3), label: 'rollup job', icon: 'Repeat', tint: 'amber' };

const seriesIdx: SceneNode = { id: 'seriesIdx', kind: 'block', at: at(0, 3), label: 'series index', sub: 'tag → series IDs', icon: 'Search', tint: 'blue' };

export const timeSeriesDb: Lesson = {
  id: 'time-series-db',
  title: 'Time-series databases',
  tagline: 'Store billions of timestamped points cheaply and answer "what happened over this window" in milliseconds.',
  minutes: 16,
  level: 'Intermediate',
  learn: [
    'What makes time-series data different: append-only, ordered, read as ranges',
    'Why a general-purpose database struggles with metrics at scale',
    'Time partitioning, and why dropping a chunk beats DELETE',
    'Push and pull ingestion, the write-ahead log, the head block and late points',
    'Delta-of-delta and XOR compression, from 70 bytes a point to under 2',
    'Downsampling and retention tiers',
    'Tags, series and the cardinality problem, and how to guard against it',
    'Typical queries, metric types, counter rates, scaling out and when not to use a TSDB',
  ],
  metrics: [
    { key: 'writes', label: 'Ingest', icon: 'Download' },
    { key: 'bytes', label: 'Bytes per point', icon: 'Binary' },
    { key: 'disk', label: 'Disk per day', icon: 'HardDrive' },
    { key: 'query', label: '6 h chart', icon: 'Timer' },
    { key: 'series', label: 'Series', icon: 'Hash' },
  ],
  steps: [
    {
      title: 'Metrics table',
      tag: 'problem',
      heading: 'A billion rows a day in an ordinary table',
      eli5: 'Every classroom has a thermometer, and every few seconds a kid writes each reading in one big class **notebook**. By Friday the notebook is so thick nobody can find Tuesday afternoon.',
      body: [
        'A team monitors **10,000 hosts**. Each reports 100 metrics (CPU, memory, disk, latency) every 10 seconds. That is **100,000 points per second**, or **8.6 billion rows a day**, inserted into a Postgres table `metrics(time, host, metric, value)`.',
        'The dashboard asks for "CPU of host web-17 over the last 6 hours" and takes **40 seconds**.',
      ],
      keyIdea: 'Metrics are many tiny writes that never change and are read back as time ranges. A general table pays full price for features this data never uses.',
      metrics: { writes: '100K points/s', bytes: '~70 B', disk: '600 GB', query: '40 s', series: '1M' },
      metricTones: { query: 'bad', disk: 'bad' },
      scene: {
        nodes: [hosts, { ...collector, status: 'active' }, { ...pg, status: 'hot', badge: '8.6B rows/day', load: 92 }, { ...dash, at: at(1, 4), status: 'hot', badge: '40 s to load' }],
        links: [link('hosts', 'collector'), link('collector', 'db', { label: '100K inserts/s', labelTone: 'warn' }), link('dash', 'db')],
        flows: [
          { path: ['hosts', 'collector'], tone: 'data', count: 5, duration: 1 },
          { path: ['collector', 'db'], tone: 'data', label: 'INSERT x 100K/s', count: 5, duration: 1, delay: 1 },
          { path: ['dash', 'db'], tone: 'request', label: 'web-17 CPU, 6 h', duration: 1.2, delay: 0.5 },
          { path: ['db', 'dash'], tone: 'response', duration: 3.2, delay: 1.8 },
        ],
        panel: {
          title: 'Fleet and load',
          icon: 'Table',
          rows: [
            { text: 'Hosts x metrics', value: '10,000 x 100' },
            { text: 'Every 10 s', value: '1M points' },
            { text: 'Per day', value: '8.6B rows', tone: 'warn' },
          ],
          footer: { text: 'Every 10 seconds, a million new rows', tone: 'bad' },
        },
        caption: 'Every 10 seconds, a million new rows',
      },
    },
    {
      title: 'Series',
      tag: 'concept',
      heading: 'A series is one metric from one source',
      eli5: 'Each thermometer has its own list of readings, written one after another and never changed. One list per thermometer is a **series**.',
      body: [
        'A **series** is a metric name plus **tags** (also called labels): `cpu_usage{host="web-17", region="eu"}`. Each series is a list of **points**, a timestamp and a value. Our fleet has about a million series.',
        'Writes are append-only and arrive roughly in time order, and reads are ranges and aggregates over recent data. A store built for that shape can give up row updates.',
      ],
      keyIdea: 'Name plus tags pick the series. Time picks the points inside it.',
      metrics: { writes: '100K points/s', bytes: '~70 B', disk: '600 GB', query: '40 s', series: '1M' },
      scene: {
        nodes: [{ ...hosts, status: 'active' }, { ...collector, status: 'active', chips: ['cpu{host=web-17}'] }, { ...tsdb, status: 'active' }],
        links: [link('hosts', 'collector'), link('collector', 'db')],
        flows: [
          { path: ['hosts', 'collector'], tone: 'data', label: '10:00:00 61.2', duration: 1 },
          { path: ['collector', 'db'], tone: 'data', label: '10:00:10 63.0', duration: 1, delay: 1.1 },
        ],
        panel: {
          title: 'One series, many points',
          icon: 'List',
          code: 'cpu_usage{host="web-17", region="eu"}\n10:00:00  61.2\n10:00:10  63.0\n10:00:20  62.4\n10:00:30  62.4',
          footer: { text: '1M series x 1 point per 10 s', tone: 'muted' },
        },
        caption: 'Name + tags pick the series. Time picks the points.',
      },
    },
    {
      title: 'Row overhead',
      tag: 'concept',
      heading: 'Bookkeeping costs more than the data',
      eli5: 'The class notebook writes the room name and the date on every single line. That **overhead** is bigger than the readings themselves.',
      body: [
        'Postgres stores each point as a row with a header of about 23 bytes, the repeated host and metric values, and alignment padding. The data you care about is 16 bytes, a timestamp and a float.',
        'With one B-tree index entry added, a point costs **about 70 bytes**: roughly 600 GB of disk a day.',
      ],
      keyIdea: 'Most of the disk holds row headers, repeated labels and index entries, not the values.',
      metrics: { writes: '100K points/s', bytes: '~70 B', disk: '600 GB', query: '40 s', series: '1M' },
      metricTones: { bytes: 'bad', disk: 'bad' },
      scene: {
        nodes: [{ ...collector, status: 'active' }, { ...pg, status: 'hot', badge: '70 B per point' }],
        links: [link('collector', 'db')],
        flows: [{ path: ['collector', 'db'], tone: 'data', label: '16 B of data', count: 4, duration: 1.2 }],
        panel: {
          title: 'One row, in bytes',
          icon: 'Table',
          rows: [
            { text: 'Row header', value: '23 B', tone: 'warn' },
            { text: 'Host + metric, repeated', value: '~20 B', tone: 'warn' },
            { text: 'Time + value (the data)', value: '16 B', tone: 'good' },
            { text: 'Index entry + padding', value: '~11 B', tone: 'warn' },
          ],
          footer: { text: '~70 B x 8.6B rows = 600 GB a day', tone: 'bad' },
        },
        caption: 'Bookkeeping costs more than the data',
      },
    },
    {
      title: 'Index churn',
      tag: 'concept',
      heading: 'The index is touched at random',
      eli5: 'The big alphabetical list at the back of the notebook gets a new entry for every reading. Each entry goes on a different page, so the helper keeps flipping all over the book.',
      body: [
        'An index on `(host, metric, time)` puts the million series in different parts of the tree. Each batch of 100,000 inserts touches pages all over the index.',
        'The index stops fitting in memory, and every insert risks a random disk read.',
      ],
      keyIdea: 'Random index updates are slow at 100,000 inserts a second. Append-only data has no need for them.',
      metrics: { writes: '100K points/s', bytes: '~70 B', disk: '600 GB', query: '40 s', series: '1M' },
      metricTones: { writes: 'warn' },
      scene: {
        nodes: [{ ...collector, status: 'active' }, { ...pg, status: 'hot', load: 95, badge: 'index > RAM' }],
        links: [link('collector', 'db', { label: '100K inserts/s', labelTone: 'warn' })],
        flows: [{ path: ['collector', 'db'], tone: 'error', label: 'random index pages', count: 5, duration: 1.2 }],
        panel: {
          title: 'One batch of 100K inserts',
          icon: 'Network',
          rows: [
            { text: 'Series touched', value: 'up to 1M' },
            { text: 'Index pages touched', value: 'all over', tone: 'warn' },
            { text: 'Fits in memory', value: 'no', tone: 'bad' },
            { text: 'Disk reads per insert', value: 'random', tone: 'bad' },
          ],
        },
        caption: 'Every insert risks a random disk read',
      },
    },
    {
      title: 'Slow deletes',
      tag: 'concept',
      heading: 'Deleting old data is as costly as writing it',
      eli5: 'To throw out last week\'s readings, a kid erases them one line at a time. Then someone has to tidy the empty gaps. It takes all night.',
      body: [
        'Old data has to go. A nightly `DELETE` of yesterday\'s billions of rows marks them dead one by one and runs for hours.',
        'Vacuum then rewrites pages to reclaim the space, all while new data keeps arriving.',
      ],
      keyIdea: 'Row-by-row deletes plus vacuum make retention a heavy job. Append-only data deserves a cheaper way to expire.',
      metrics: { writes: '100K points/s', bytes: '~70 B', disk: '600 GB', query: '40 s', series: '1M' },
      scene: {
        nodes: [
          { id: 'cleanup', kind: 'block', at: at(-4, -3), label: 'nightly DELETE', sub: 'cleanup job', icon: 'Timer', tint: 'red', status: 'hot', badge: 'hours of vacuum' },
          { ...pg, status: 'hot', load: 90 },
          { ...collector, at: at(0, 3), status: 'active' },
        ],
        links: [link('cleanup', 'db'), link('collector', 'db')],
        flows: [
          { path: ['cleanup', 'db'], tone: 'error', label: 'DELETE 8.6B rows', duration: 2.4 },
          { path: ['collector', 'db'], tone: 'data', label: 'new rows still arriving', count: 3, duration: 1.4, delay: 0.6 },
        ],
        panel: {
          title: 'What a DELETE costs',
          icon: 'List',
          rows: [
            { text: 'Rows marked dead', value: '8.6B', tone: 'bad' },
            { text: 'Vacuum rewrites pages', value: 'hours', tone: 'bad' },
            { text: 'Space back at once', value: 'no', tone: 'warn' },
          ],
        },
        caption: 'Deleting is as costly as inserting',
      },
    },
    {
      title: 'Time chunks',
      tag: 'concept',
      heading: 'Partition by time into chunks',
      eli5: 'Start a fresh notebook page every day. Kids only ever write on today\'s page, and old pages are put away. Each page is a **chunk**.',
      body: [
        'A time-series store splits data into **chunks** by time window, here one per day. All writes go to the newest chunk, so its index is small and stays in memory. Older chunks are **sealed**: nothing writes to them again, so they can be compressed and moved to cheaper disk.',
        'A query for the last 6 hours only opens the chunks that overlap it. The other chunks are skipped without reading a byte, so the 40-second query now touches one chunk.',
      ],
      keyIdea: 'Time chunks keep writes on a small hot index and let queries skip whole windows.',
      metrics: { writes: '100K points/s', bytes: '~70 B', disk: '600 GB', query: '2 s', series: '1M' },
      metricTones: { query: 'good' },
      scene: {
        nodes: [
          { ...collector, status: 'active' },
          { ...k3, status: 'active', badge: 'all writes here' },
          { ...k2, status: 'dim' },
          { ...dash, at: at(-4, 4), status: 'ok', badge: 'reads 1 chunk' },
        ],
        links: [link('collector', 'k3'), link('dash', 'k3'), link('dash', 'k2', { style: 'faint' })],
        flows: [
          { path: ['collector', 'k3'], tone: 'data', label: 'append', count: 3, duration: 1.4 },
          { path: ['dash', 'k3', 'dash'], tone: 'request', label: 'last 6 h', duration: 1.8, delay: 1.6 },
        ],
        panel: {
          title: 'Chunks by day',
          icon: 'Layers',
          rows: [
            { text: 'Tue', value: 'sealed, skipped', tone: 'muted' },
            { text: 'Wed', value: 'open, written', tone: 'good' },
            { text: 'Query touches', value: '1 chunk', tone: 'good' },
          ],
        },
        caption: 'Write to today, skip the rest',
      },
    },
    {
      title: 'Drop chunks',
      tag: 'concept',
      heading: 'Retention is dropping a file',
      eli5: 'To throw out old readings, tear out the old pages. That takes a second. There is nothing to erase line by line.',
      body: [
        '**Retention** becomes cheap. Deleting data older than 15 days is "drop the chunk for day 16", which removes a file. There are no dead rows and no vacuum.',
        'TimescaleDB does this inside Postgres. Prometheus, InfluxDB and VictoriaMetrics use their own block formats with the same idea.',
      ],
      keyIdea: 'Dropping a whole chunk replaces billions of row deletes with one file removal.',
      metrics: { writes: '100K points/s', bytes: '~70 B', disk: '600 GB', query: '2 s', series: '1M' },
      scene: {
        nodes: [
          { ...collector, status: 'active' },
          { ...k1, status: 'down', badge: 'day 16: dropped' },
          { ...k2, status: 'dim' },
          { ...k3, status: 'active', badge: 'all writes here' },
        ],
        links: [link('collector', 'k3')],
        flows: [{ path: ['collector', 'k3'], tone: 'data', label: 'append', count: 2, duration: 1.4 }],
        panel: {
          title: 'DELETE vs drop chunk',
          icon: 'Table',
          rows: [
            { text: 'DELETE 8.6B rows', value: 'hours + vacuum', tone: 'bad' },
            { text: 'Drop 1 chunk', value: 'one file', tone: 'good' },
            { text: 'Dead rows left', value: 'none', tone: 'good' },
          ],
        },
        caption: 'Drop the oldest, keep writing',
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
      title: 'Push or pull',
      tag: 'concept',
      heading: 'How points get in: push or pull',
      eli5: 'Either each thermometer shouts its reading to the hall monitor (**push**), or the hall monitor walks round and asks each one (**pull**).',
      body: [
        'With **push**, agents send points to the database (InfluxDB, Timestream). With **pull**, the server **scrapes** a `/metrics` endpoint on every host each interval (Prometheus).',
        'Pull makes a dead host visible, because the scrape fails. Push suits short-lived jobs and devices behind a firewall. In push systems, agents and collectors **batch** their writes. In Prometheus the pull server is the database itself and writes scraped samples straight into its head.',
      ],
      keyIdea: 'Push suits short-lived or firewalled sources, pull gives you a free health check. Push senders batch their writes, and a pulling database writes what it scrapes directly.',
      metrics: { writes: '100K points/s', bytes: '~70 B', disk: '600 GB', query: '2 s', series: '1M' },
      scene: {
        nodes: [
          { ...hosts, chips: ['/metrics'] },
          { ...tsdb, at: at(0, -3), label: 'Prometheus', sub: 'scrapes directly', status: 'active', badge: 'writes to its head' },
        ],
        links: [link('db', 'hosts', { label: 'scrape', arrow: 'both' })],
        flows: [
          { path: ['db', 'hosts'], tone: 'request', label: 'GET /metrics', duration: 1.2 },
          { path: ['hosts', 'db'], tone: 'response', label: '100 samples', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Push vs pull',
          icon: 'ArrowLeftRight',
          rows: [
            { text: 'Push', value: 'jobs, devices' },
            { text: 'Pull', value: 'dead host = failed scrape', tone: 'good' },
            { text: 'Push senders', value: 'batch writes', tone: 'good' },
          ],
        },
        caption: 'The puller is the database',
      },
    },
    {
      title: 'WAL and head',
      tag: 'concept',
      heading: 'New points land in memory and a log',
      eli5: 'The newest readings sit on a small whiteboard where they are quick to add. A carbon copy goes in a drawer so nothing is lost if the board gets wiped.',
      body: [
        'New points go into a **head block** in memory and, first, into a **write-ahead log** on disk (the WAL). If the process crashes, it replays the log to rebuild the head.',
        'The head holds recent points, compressed in small chunks as they arrive. When it covers about 2 hours, a flush writes an immutable block to disk. The WAL is what makes the in-memory data safe, and writes stay sequential.',
      ],
      keyIdea: 'A log makes the in-memory head safe, and flushing it as a sealed block keeps all disk writes sequential.',
      metrics: { writes: '100K points/s', bytes: '~70 B', disk: '600 GB', query: '2 s', series: '1M' },
      scene: {
        nodes: [
          { ...collector, status: 'active' },
          { ...wal, status: 'active', badge: 'append first' },
          { ...head, status: 'active', badge: 'last ~2 h, in memory' },
          { ...blocks, status: 'ok' },
        ],
        links: [link('collector', 'wal'), link('collector', 'head'), link('head', 'blocks', { style: 'dashed', label: 'every 2 h' })],
        flows: [
          { path: ['collector', 'wal'], tone: 'data', label: 'log', duration: 1.2 },
          { path: ['collector', 'head'], tone: 'data', label: 'append', count: 3, duration: 1.2, delay: 0.3 },
          { path: ['head', 'blocks'], tone: 'data', label: 'flush', duration: 1.6, delay: 2 },
        ],
        panel: {
          title: 'Write path',
          icon: 'Workflow',
          rows: [
            { text: '1. Append to the WAL', value: 'durable' },
            { text: '2. Add to the head', value: 'in memory' },
            { text: '3. Flush every 2 h', value: 'sealed block' },
          ],
          footer: { text: 'After a crash: replay the WAL', tone: 'muted' },
        },
        caption: 'Log first, memory second, block later',
      },
    },
    {
      title: 'Late points',
      tag: 'concept',
      heading: 'Points that arrive late or out of order',
      eli5: 'A kid hands in a reading ten minutes late. If the page is still open, it goes in. If the page was already put away, the teacher has to decide what to do.',
      body: [
        'Networks delay and retry, so a point stamped 10:00:20 can arrive after 10:00:40. Some stores accept late points within a configured window. Prometheus rejects out-of-order samples by default and needs `out_of_order_time_window` to accept them.',
        'A point for a sealed block is the hard case. Many stores reject it, some write a small overlay block, and merging happens later in the background.',
      ],
      keyIdea: 'A store may absorb a bounded amount of lateness if you configure it. Older points are rejected or merged later, so know your store\'s rule.',
      metrics: { writes: '100K points/s', bytes: '~70 B', disk: '600 GB', query: '2 s', series: '1M' },
      scene: {
        nodes: [
          { ...collector, status: 'active', chips: [{ text: '10:00:20 (late)', tone: 'warn' }] },
          { ...head, status: 'active', badge: 'window is a setting' },
          { ...blocks, status: 'dim', badge: 'sealed' },
        ],
        links: [link('collector', 'head'), link('collector', 'blocks', { style: 'faint' })],
        flows: [
          { path: ['collector', 'head'], tone: 'data', label: 'late, sorted in', duration: 1.4 },
          { path: ['collector', 'blocks'], tone: 'error', label: 'too old', duration: 1.6, delay: 1.6 },
        ],
        panel: {
          title: 'Where a late point goes',
          icon: 'Clock',
          rows: [
            { text: 'out_of_order_time_window', value: '2h (setting, off by default)' },
            { text: 'Inside the window', value: 'sorted in', tone: 'good' },
            { text: 'Into a sealed block', value: 'reject or overlay', tone: 'warn' },
          ],
        },
        caption: 'Late is fine up to a limit',
      },
    },
    {
      title: 'Timestamps',
      tag: 'concept',
      heading: 'Delta-of-delta for timestamps',
      eli5: 'The readings come at 10:00:00, :10, :20, :30. Instead of writing every time, write "ten seconds later, same as before". That tick mark is **compression**.',
      body: [
        'Inside a chunk, each series\' points are stored as two columns: timestamps and values. Neighbors in each column are nearly the same.',
        'Points arrive every 10 s, so the deltas are 10, 10, 10 and the **delta-of-delta** is 0, which costs a single bit. Only jitter costs more.',
      ],
      keyIdea: 'Regular timestamps collapse to one bit each when you store the change in the change.',
      metrics: { writes: '100K points/s', bytes: '~70 B', disk: '600 GB', query: '2 s', series: '1M' },
      scene: {
        nodes: [{ ...head, at: at(-4, -3), status: 'active', badge: 'raw point: 16 B' }, { ...blocks, at: at(4, -4), status: 'ok', badge: 'timestamps: 1 bit' }],
        links: [link('head', 'blocks', { label: 'delta-of-delta' })],
        flows: [{ path: ['head', 'blocks'], tone: 'data', label: 'delta-of-delta', duration: 2 }],
        panel: {
          title: 'Timestamps for one series',
          icon: 'Binary',
          rows: [
            { text: '10:00:00, :10, :20, :30', value: 'raw times' },
            { text: 'Deltas', value: '10, 10, 10' },
            { text: 'Delta of deltas', value: '0, 0', tone: 'good' },
            { text: 'Cost of a zero', value: '1 bit', tone: 'good' },
          ],
        },
        caption: 'Same gap again costs one bit',
      },
      quiz: {
        question: 'A series has timestamps 1000, 1010, 1020, 1031 (seconds). What delta-of-delta values does the encoder store after the first two points?',
        options: ['10, 10, 11', '0, 1', '1010, 1020, 1031', '0, 0'],
        answer: 1,
        explain: 'The deltas are 10, 10 and 11. The deltas of those deltas are 0 and 1. A zero costs one bit, and a small number like 1 costs only a few bits.',
      },
    },
    {
      title: 'Values',
      tag: 'concept',
      heading: 'XOR for values, and what it adds up to',
      eli5: 'The readings go 20, 20, 20, 21. Write "same" for repeats and only note the small change. The page then holds far more.',
      body: [
        '**Values** are XORed with the previous value. An unchanged value XORs to zero and costs one bit. A small change leaves only a few meaningful bits in the middle.',
        'Facebook\'s Gorilla paper reported about 1.37 bytes per point with these two tricks, and Prometheus uses the same idea. Here a point drops from about 70 bytes to **1.4**, and a day from 600 GB to **12 GB**.',
      ],
      keyIdea: 'Slowly changing values compress to a bit or two, so a TSDB stores points 30 to 50 times smaller.',
      metrics: { writes: '100K points/s', bytes: '1.4 B', disk: '12 GB', query: '300 ms', series: '1M' },
      metricTones: { bytes: 'good', disk: 'good' },
      scene: {
        nodes: [{ ...head, at: at(-4, -3), status: 'active', badge: 'raw point: 16 B' }, { ...blocks, at: at(4, -4), status: 'ok', badge: '1.4 B per point' }, { ...dash, status: 'ok' }],
        links: [link('head', 'blocks', { label: 'delta-of-delta + XOR' }), link('dash', 'blocks')],
        flows: [
          { path: ['head', 'blocks'], tone: 'data', label: 'delta-of-delta + XOR', duration: 2 },
          { path: ['dash', 'blocks', 'dash'], tone: 'request', label: 'decode a range', duration: 1.8, delay: 2.2 },
        ],
        panel: {
          title: 'Before and after',
          icon: 'HardDrive',
          rows: [
            { text: 'Postgres row', value: '~70 B', tone: 'bad' },
            { text: 'Gorilla-style point', value: '~1.4 B', tone: 'good' },
            { text: 'Disk per day', value: '600 GB to 12 GB', tone: 'good' },
          ],
          footer: { text: 'XOR with the previous value: same = 0', tone: 'muted' },
        },
        caption: 'Compress neighbors, not rows',
      },
    },
    {
      title: 'Why downsample',
      tag: 'tradeoff',
      heading: 'A year of 10-second points is too much',
      eli5: 'After a week, nobody wants every single reading. A poster of the whole year only has room for one dot per hour.',
      body: [
        'A one-year chart of one series at 10-second resolution is 3.15 million points. A screen is about 2,000 pixels wide, so almost all of those points are wasted.',
        '**Downsampling** precomputes coarser summaries: per minute, then per hour. A year at 1-hour resolution is 8,760 points.',
      ],
      keyIdea: 'Old data is read at coarse resolution, so store it that way.',
      metrics: { writes: '100K points/s', bytes: '1.4 B', disk: '12 GB', query: '300 ms', series: '1M' },
      scene: {
        nodes: [{ ...raw, status: 'hot', badge: '3.15M pts/series/yr' }, { ...h1, status: 'ok', badge: '8,760 pts/series/yr' }, { ...dash, label: '1-year chart', at: at(0, -3), status: 'active', badge: '~2,000 px wide' }],
        links: [link('dash', 'raw', { style: 'faint' }), link('dash', 'h1')],
        flows: [
          { path: ['dash', 'raw'], tone: 'error', label: '3.15M points', duration: 1.6 },
          { path: ['dash', 'h1', 'dash'], tone: 'request', label: '8,760 points', duration: 1.8, delay: 1.8 },
        ],
        panel: {
          title: 'One series, one year',
          icon: 'Table',
          rows: [
            { text: 'At 10 s', value: '3,150,000 points', tone: 'bad' },
            { text: 'At 1 min', value: '525,600 points' },
            { text: 'At 1 h', value: '8,760 points', tone: 'good' },
          ],
        },
        caption: 'Most points never reach a pixel',
      },
    },
    {
      title: 'Retention tiers',
      tag: 'tradeoff',
      heading: 'Three resolutions, three retention periods',
      eli5: 'The club keeps every reading for two weeks, hourly highs and lows for three months, and daily summaries for years. Older pages get blurrier on purpose.',
      body: [
        'A **rollup job** writes each tier from the one below it. Raw points are kept 15 days, 1-minute rollups 90 days, 1-hour rollups 2 years. Queries pick the tier that matches their window.',
        'You lose the ability to zoom into a 10-second spike from last March. That is usually the right trade.',
      ],
      keyIdea: 'Each tier has its own retention. Detail lives for days and summaries live for years.',
      metrics: { writes: '100K points/s', bytes: '1.4 B', disk: '12 GB', query: '300 ms', series: '1M' },
      scene: {
        nodes: [{ ...raw, status: 'active' }, { ...m1, status: 'ok' }, { ...h1, status: 'ok' }, { ...rollup, status: 'active' }],
        links: [link('raw', 'rollup', { style: 'dashed' }), link('rollup', 'm1', { style: 'dashed' }), link('rollup', 'h1', { style: 'dashed' })],
        flows: [
          { path: ['raw', 'rollup'], tone: 'data', label: 'every minute', duration: 1.2 },
          { path: ['rollup', 'm1'], tone: 'data', duration: 1.2, delay: 1.3 },
          { path: ['rollup', 'h1'], tone: 'data', duration: 1.4, delay: 1.3 },
        ],
        panel: {
          title: 'Retention tiers',
          icon: 'Layers',
          rows: [
            { text: 'Raw, 10 s', value: '15 days' },
            { text: '1-minute rollups', value: '90 days' },
            { text: '1-hour rollups', value: '2 years', tone: 'good' },
          ],
        },
        caption: 'Older data, coarser data',
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
      title: 'Safe summaries',
      tag: 'tradeoff',
      heading: 'Keep summaries that combine correctly',
      eli5: 'If the poster only says "average 20", you cannot rebuild a day from it. Writing down the total and how many readings lets you always work out the right average.',
      body: [
        'Store `min`, `max`, `sum` and `count`, so an average over a longer window is `sum / count` and stays correct. An average of averages is wrong when buckets have different counts.',
        'Percentiles cannot be combined at all. Keep histograms or sketches if you need p99 later.',
      ],
      keyIdea: 'Store min, max, sum and count. Averages of averages and combined percentiles give wrong answers.',
      metrics: { writes: '100K points/s', bytes: '1.4 B', disk: '12 GB', query: '300 ms', series: '1M' },
      scene: {
        nodes: [{ ...rollup, status: 'active' }, { ...m1, status: 'ok', badge: 'min max sum count' }, { ...dash, status: 'active', label: 'avg over 2 min' }],
        links: [link('rollup', 'm1', { style: 'dashed' }), link('dash', 'm1')],
        flows: [
          { path: ['rollup', 'm1'], tone: 'data', label: 'min max sum n', duration: 1.4 },
          { path: ['dash', 'm1', 'dash'], tone: 'request', label: 'sum / count', duration: 1.8, delay: 1.6 },
        ],
        panel: {
          title: 'Two buckets',
          icon: 'Scale',
          rows: [
            { text: 'A: 10 points, avg 50', value: 'sum 500' },
            { text: 'B: 90 points, avg 10', value: 'sum 900' },
            { text: 'Average of averages', value: '30', tone: 'bad' },
            { text: 'sum / count', value: '14', tone: 'good' },
          ],
          footer: { text: 'Percentiles: keep a histogram or sketch', tone: 'warn' },
        },
        caption: 'Combine sums and counts, never averages',
      },
      quiz: {
        question: 'Bucket A has 10 points averaging 50. Bucket B has 90 points averaging 10. What is the correct overall average?',
        options: ['30', '14', '25', '60'],
        answer: 1,
        explain: 'Sums are 500 and 900 over 100 points, so 1,400 / 100 = 14. The average of averages, 30, ignores that B has nine times as many points.',
      },
    },
    {
      title: 'Tags',
      tag: 'concept',
      heading: 'Finding series by their tags',
      eli5: 'Every reading list has stickers: "floor 2", "science room". A box of cards lists, for each sticker, which lists carry it. That card box is the **series index**.',
      body: [
        'A dashboard asks for `cpu_usage` where `region="eu"` and `service="checkout"`, grouped by host. The database first has to find which series match.',
        'The **series index** is an inverted index (as in the search index lesson) from each `tag=value` pair to series IDs. The query intersects two lists, gets 400 IDs, and reads only those points in the time window.',
      ],
      keyIdea: 'An inverted index from tag values to series IDs makes "all series matching these tags" a fast lookup.',
      metrics: { writes: '100K points/s', bytes: '1.4 B', disk: '12 GB', query: '200 ms', series: '1M' },
      scene: {
        nodes: [{ ...dash, at: at(-4, -3), status: 'active' }, { ...seriesIdx, at: at(0, -3), status: 'active', chips: ['region=eu', 'service=checkout'] }, { ...tsdb, status: 'ok', badge: '400 series' }],
        links: [link('dash', 'seriesIdx'), link('seriesIdx', 'db')],
        flows: [
          { path: ['dash', 'seriesIdx'], tone: 'request', label: 'which series?', duration: 1.2 },
          { path: ['seriesIdx', 'db'], tone: 'response', label: '400 IDs', duration: 1.2, delay: 1.3 },
          { path: ['db', 'dash'], tone: 'data', label: 'their points, last 6 h', duration: 2.2, delay: 2.6 },
        ],
        panel: {
          title: 'Inverted index',
          icon: 'Search',
          rows: [
            { text: 'region=eu', value: '120K series' },
            { text: 'service=checkout', value: '1.6K series' },
            { text: 'Intersection', value: '400 series', tone: 'good' },
          ],
        },
        caption: 'Tags select series, time selects points',
      },
    },
    {
      title: 'Cardinality',
      tag: 'case',
      heading: 'Case: someone adds a user_id tag',
      eli5: 'A kid puts a sticker with every visitor\'s name on the readings. Now there is a separate list for every visitor, millions of them. Too many different stickers is the **cardinality** problem.',
      body: [
        'A developer adds `user_id` as a tag on `http_latency`. There are 2 million active users. Multiply by 50 endpoints and 5 status codes and one metric makes **500 million series**. The number of distinct series is the **cardinality**.',
        'Every series costs memory: an index entry, a head buffer, its own compressed stream. Ingesters run out of memory, queries crawl, and most of those series hold a handful of points.',
      ],
      keyIdea: 'Series count is the product of tag value counts. One unbounded tag can turn a million series into hundreds of millions.',
      metrics: { writes: '100K points/s', bytes: '1.4 B', disk: '12 GB', query: 'timeout', series: '500M' },
      metricTones: { query: 'bad', series: 'bad' },
      scene: {
        nodes: [
          { ...collector, at: at(-4, -3), status: 'hot', chips: [{ text: '+user_id tag', tone: 'bad' }] },
          { ...seriesIdx, at: at(0, 3), status: 'hot', badge: '1M to 500M series' },
          { ...tsdb, status: 'down', badge: 'out of memory', load: 100 },
          { ...dash, status: 'hot', badge: 'timeout' },
        ],
        links: [link('collector', 'db'), link('dash', 'seriesIdx'), link('seriesIdx', 'db')],
        flows: [
          { path: ['collector', 'db'], tone: 'error', label: 'new series per user', count: 6, duration: 1.1 },
          { path: ['dash', 'seriesIdx'], tone: 'error', label: 'scan 500M IDs', duration: 2.4, delay: 1.2 },
        ],
        panel: {
          title: 'Series for http_latency',
          icon: 'Hash',
          rows: [
            { text: 'Users', value: '2,000,000' },
            { text: 'Endpoints', value: 'x 50' },
            { text: 'Status codes', value: 'x 5' },
            { text: 'Series', value: '500,000,000', tone: 'bad' },
          ],
        },
        caption: 'Each new tag value is a new series',
      },
    },
    {
      title: 'Guard rails',
      tag: 'tradeoff',
      heading: 'Keep cardinality bounded',
      eli5: 'The teacher makes a rule: stickers can only name a room, never a visitor. If a kid brings 1,000 new stickers, the teacher says no at the door.',
      body: [
        'Never use unbounded values (user IDs, request IDs, emails, URLs with IDs in them) as tags. Put per-request detail in logs or traces.',
        'Set **per-metric series limits** above the legitimate maximum. Our 10,000 hosts already make 10,000 series for each per-host metric, so the limit is 50,000. A user_id tag would blow far past it, so one bad deploy is rejected at ingest instead of taking the cluster down. Alert on series growth too.',
      ],
      keyIdea: 'Tags are for bounded things you filter and group by. Reject runaway series at the door.',
      metrics: { writes: '100K points/s', bytes: '1.4 B', disk: '12 GB', query: '200 ms', series: '1M' },
      metricTones: { series: 'good' },
      scene: {
        nodes: [
          { ...collector, status: 'active', chips: [{ text: '+user_id tag', tone: 'bad' }] },
          { id: 'limit', kind: 'block', at: at(0, 3), label: 'series limit', sub: '50,000 per metric', icon: 'Shield', tint: 'amber', status: 'active' },
          { ...tsdb, status: 'ok', badge: '1M series' },
        ],
        links: [link('collector', 'limit'), link('limit', 'db')],
        flows: [
          { path: ['collector', 'limit'], tone: 'data', count: 4, duration: 1.2 },
          { path: ['limit', 'db'], tone: 'data', label: 'bounded tags only', duration: 1.4, delay: 1.3 },
          { path: ['limit', 'collector'], tone: 'error', label: 'rejected: limit hit', duration: 1.4, delay: 2.8 },
        ],
        panel: {
          title: 'Good and bad tags',
          icon: 'Shield',
          rows: [
            { text: 'region, service, status', value: 'bounded', tone: 'good' },
            { text: 'host', value: '10,000', tone: 'good' },
            { text: 'user_id, request_id', value: 'unbounded', tone: 'bad' },
          ],
        },
        caption: 'One bad deploy cannot sink the cluster',
      },
    },
    {
      title: 'Queries',
      tag: 'concept',
      heading: 'The questions a TSDB answers well',
      eli5: 'The club asks the same few things: what is it now, what was the hottest hour today, which room is warmest. Grouping readings into hours to answer them is **bucketing**.',
      body: [
        'Almost every query is **latest value**, **range plus bucket** (average per minute over 6 hours, one line per host), or **top-k** (the 5 hosts with the highest CPU).',
        'Each is a time filter (chunk pruning), a tag filter (series index), then a scan of compressed points stored next to each other. The 6-hour chart that took 40 seconds now takes about **200 ms**.',
      ],
      keyIdea: 'Time filter, tag filter, scan a compressed range, aggregate per bucket. A TSDB makes that one path fast.',
      metrics: { writes: '100K points/s', bytes: '1.4 B', disk: '12 GB', query: '200 ms', series: '1M' },
      metricTones: { query: 'good' },
      scene: {
        nodes: [{ ...dash, at: at(-4, -3), status: 'active', badge: '200 ms' }, { ...tsdb, at: at(0, -3), status: 'ok', badge: '1 chunk, 400 series' }],
        links: [link('dash', 'db', { arrow: 'both' })],
        flows: [
          { path: ['dash', 'db'], tone: 'request', label: 'avg per minute, 6 h', duration: 1 },
          { path: ['db', 'dash'], tone: 'response', label: '360 points per host', duration: 1, delay: 1.1 },
          { path: ['dash', 'db'], tone: 'request', label: 'top 5 CPU now', duration: 1, delay: 2.4 },
          { path: ['db', 'dash'], tone: 'response', duration: 1, delay: 3.5 },
        ],
        panel: {
          title: 'Three common shapes',
          icon: 'Code',
          rows: [
            { text: 'Latest value', value: 'last(value, time)' },
            { text: 'Range + bucket', value: 'time_bucket + avg' },
            { text: 'Top-k', value: 'ORDER BY ... LIMIT 5' },
          ],
        },
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
      title: 'Counter rate',
      tag: 'concept',
      heading: 'Metric types, and why counters need a rate',
      eli5: 'A visitor counter on the door only ever goes up. What you want to know is how many came in per minute, and what to do if someone resets the counter to zero.',
      body: [
        'Metric types differ. A **gauge** (CPU) goes up and down, so average it. A **counter** (`requests_total`) only goes up, so take its **rate**. A **histogram** (latency buckets) takes a quantile. Averaging a counter is the classic mistake.',
        'The rate is the **increase per second**: `rate(requests_total[5m])`.',
        'A counter resets to zero when a process restarts. The rate function spots the drop and treats it as a reset, so the graph does not show a huge negative spike.',
      ],
      keyIdea: 'Chart the per-second increase of a counter, and let the query engine handle resets.',
      metrics: { writes: '100K points/s', bytes: '1.4 B', disk: '12 GB', query: '200 ms', series: '1M' },
      scene: {
        nodes: [{ ...hosts, at: at(-4, -3), chips: ['requests_total'] }, { ...tsdb, at: at(0, -3), status: 'ok' }, { ...dash, at: at(4, -4), status: 'active', chips: ['rate(…[5m])'] }],
        links: [link('hosts', 'db'), link('db', 'dash')],
        flows: [
          { path: ['hosts', 'db'], tone: 'data', label: '1200, 1500, 0 (restart)', duration: 1.6 },
          { path: ['db', 'dash'], tone: 'response', label: '30 req/s, no negative dip', duration: 1.6, delay: 1.8 },
        ],
        panel: {
          title: 'Type decides the query',
          icon: 'TrendingUp',
          rows: [
            { text: 'Gauge: CPU, memory', value: 'avg or max' },
            { text: 'Counter: requests_total', value: 'rate', tone: 'good' },
            { text: 'Histogram: latency buckets', value: 'histogram_quantile' },
          ],
          footer: { text: 'Rate treats a drop (1800 to 0) as a reset', tone: 'good' },
        },
        caption: 'Slope of a counter, reset-aware',
      },
    },
    {
      title: 'Shard and replicate',
      tag: 'concept',
      heading: 'One node is not the end of the story',
      eli5: 'When one notebook is not enough, give each class its own and keep a spare copy of each. To see everything, ask every class and combine the answers.',
      body: [
        'Beyond one node, shard series across servers by a hash of their name and tags, and replicate each shard so a node loss loses nothing.',
        'A query **fans out** to every shard, and a query node merges the partial results into one answer.',
      ],
      keyIdea: 'Shard by series hash, replicate for safety, and fan queries out then merge.',
      metrics: { writes: '100K points/s', bytes: '1.4 B', disk: '12 GB', query: '200 ms', series: '1M' },
      scene: {
        nodes: [
          { ...collector, at: at(-4, -3), status: 'active' },
          { id: 'shardA', kind: 'shard', at: at(0, -3), label: 'shard A', sub: 'series hash 0 to 4' },
          { id: 'shardB', kind: 'shard', at: at(0, 3), label: 'shard B', sub: 'series hash 5 to 9' },
          { ...dash, at: at(4, 4), status: 'active', label: 'query node', sub: 'merges results' },
        ],
        links: [link('collector', 'shardA'), link('collector', 'shardB'), link('dash', 'shardA'), link('dash', 'shardB')],
        flows: [
          { path: ['collector', 'shardA'], tone: 'data', label: 'hash(series)', duration: 1.4 },
          { path: ['collector', 'shardB'], tone: 'data', duration: 1.4, delay: 0.3 },
          { path: ['dash', 'shardA', 'dash'], tone: 'request', label: 'fan out', duration: 1.8, delay: 2 },
          { path: ['dash', 'shardB', 'dash'], tone: 'request', duration: 1.8, delay: 2.2 },
        ],
        panel: {
          title: 'Scaling out',
          icon: 'Split',
          rows: [
            { text: 'Shard', value: 'hash of series' },
            { text: 'Replicate', value: '2 or 3 copies', tone: 'good' },
            { text: 'Query', value: 'fan out, then merge' },
          ],
        },
        caption: 'Spread series, keep copies, merge answers',
      },
    },
    {
      title: 'Long-term storage',
      tag: 'concept',
      heading: 'Old blocks move to object storage',
      eli5: 'Last year\'s pages go to a big binder in the library. When you want a long chart, you look at the shelf and the binder together.',
      body: [
        'Prometheus itself is a single node. Long-term stores such as Thanos, Mimir and VictoriaMetrics move old blocks to cheap **object storage**.',
        'A query spans both the recent data on the nodes and the archived blocks, and the results are joined.',
      ],
      keyIdea: 'Archive old blocks in object storage and let queries span both tiers.',
      metrics: { writes: '100K points/s', bytes: '1.4 B', disk: '12 GB', query: '200 ms', series: '1M' },
      scene: {
        nodes: [
          { id: 'shardA', kind: 'shard', at: at(-4, -3), label: 'shard A', sub: 'recent blocks' },
          { id: 'objstore', kind: 'storage', at: at(4, -4), label: 'object storage', sub: 'old blocks' },
          { ...dash, at: at(0, 3), status: 'active', label: 'query node', sub: 'spans both' },
        ],
        links: [link('shardA', 'objstore', { style: 'dashed', label: 'upload' }), link('dash', 'shardA'), link('dash', 'objstore')],
        flows: [
          { path: ['shardA', 'objstore'], tone: 'data', label: 'old blocks', duration: 1.6 },
          { path: ['dash', 'shardA', 'dash'], tone: 'request', label: 'last week', duration: 1.8, delay: 1.8 },
          { path: ['dash', 'objstore', 'dash'], tone: 'request', label: 'last year', duration: 1.8, delay: 2 },
        ],
        panel: {
          title: 'Long-term retention',
          icon: 'Layers',
          rows: [
            { text: 'Recent', value: 'on the nodes' },
            { text: 'Old blocks', value: 'object storage', tone: 'good' },
            { text: 'Query', value: 'spans both' },
          ],
        },
        caption: 'Archive the old, query across both',
      },
    },
    {
      title: 'Choosing',
      tag: 'tradeoff',
      heading: 'Which store, and when not to use one',
      eli5: 'A notebook for readings is great. It is a bad place to keep the class birthday list or a list of who owes whom. Those go in their own books.',
      body: [
        'Options: **TimescaleDB** (Postgres extension, SQL), **InfluxDB**, **Prometheus** (pull, monitoring), **VictoriaMetrics**, **QuestDB**, **Amazon Timestream**. Pick on query language, scale and who runs it.',
        'Updating one old point, joining with business tables or running a transaction across series is awkward or impossible. Keep that data in a normal database and query both side by side.',
      ],
      keyIdea: 'Use a TSDB for metrics, IoT and ticks. Keep transactional and relational data elsewhere.',
      metrics: { writes: '100K points/s', bytes: '1.4 B', disk: '12 GB', query: '200 ms', series: '1M' },
      scene: {
        nodes: [
          { ...tsdb, at: at(-4, -3), status: 'ok', badge: 'metrics, IoT, ticks' },
          { id: 'sql', kind: 'db', at: at(4, -4), label: 'Postgres', sub: 'orders, users' },
          { ...dash, at: at(0, 3), status: 'active', chips: ['join metrics + orders'] },
        ],
        links: [link('dash', 'db'), link('dash', 'sql')],
        flows: [
          { path: ['dash', 'db', 'dash'], tone: 'request', label: 'CPU over time', duration: 1.8 },
          { path: ['dash', 'sql', 'dash'], tone: 'request', label: 'orders by id', duration: 1.8, delay: 2 },
        ],
        panel: {
          title: 'Which one for what',
          icon: 'Scale',
          rows: [
            { text: 'Metrics, IoT, ticks', value: 'TSDB', tone: 'good' },
            { text: 'Updates, transactions', value: 'normal DB', tone: 'warn' },
            { text: 'Joins with business data', value: 'query both', tone: 'warn' },
          ],
        },
        caption: 'Each data shape in its own store',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Built for append, range and aggregate',
      eli5: 'One page per day, only the changes written down, old pages shrunk to hourly highs and lows, and a few stickers per list. That is how the **time-series** notebook stays thin and quick.',
      body: [
        'Time-series data is append-only, time-ordered and read as ranges. A general table spends about 70 bytes and a random index update per point. A TSDB splits data into **time chunks** and compresses timestamps with **delta-of-delta** and values with XOR, down to under 2 bytes a point.',
        '**Retention** drops whole chunks, **downsampling** keeps min, max, sum and count for older data, and tags select series. **Cardinality** is the limit to watch.',
      ],
      keyIdea: 'A time-series database wins by matching the data\'s shape: chunk by time, compress neighbors, shrink the past, and keep tags bounded.',
      metrics: { writes: '100K points/s', bytes: '1.4 B', disk: '12 GB', query: '200 ms', series: '1M' },
      metricTones: { bytes: 'good', disk: 'good', query: 'good' },
      scene: {
        nodes: [hosts, collector, { ...tsdb, status: 'ok' }, { ...dash, status: 'ok' }],
        links: [link('hosts', 'collector'), link('collector', 'db'), link('dash', 'db')],
        flows: [
          { path: ['hosts', 'collector', 'db'], tone: 'data', count: 3, duration: 1.8 },
          { path: ['dash', 'db', 'dash'], tone: 'request', label: 'range query', duration: 1.8, delay: 2 },
        ],
        panel: {
          title: 'Before and after',
          icon: 'Gauge',
          rows: [
            { text: 'Bytes per point', value: '70 to 1.4', tone: 'good' },
            { text: 'Disk per day', value: '600 GB to 12 GB', tone: 'good' },
            { text: '6 h chart', value: '40 s to 200 ms', tone: 'good' },
          ],
        },
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
