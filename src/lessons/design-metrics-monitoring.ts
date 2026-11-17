import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const srv: SceneNode = { id: 'srv', kind: 'server', at: at(-6, 0), label: 'app servers', sub: '50,000 hosts' };
const col: SceneNode = { id: 'col', kind: 'service', at: at(-3, 0), label: 'collector', sub: 'scrapes every 10 s' };
const queue: SceneNode = { id: 'queue', kind: 'queue', at: at(0, 0), label: 'ingest queue', sub: 'partitioned log' };
const tsdb: SceneNode = { id: 'tsdb', kind: 'db', at: at(3, 0), label: 'time-series DB', sub: '10M series' };
const dash: SceneNode = { id: 'dash', kind: 'monitor', at: at(6, 3.5), label: 'dashboards', sub: '10,000 panels' };
const query: SceneNode = { id: 'query', kind: 'block', size: 0.8, at: at(3, 3.5), label: 'query service', icon: 'Search', tint: 'violet' };
const evalr: SceneNode = { id: 'eval', kind: 'worker', at: at(0, 3.5), label: 'rule evaluator', sub: '20,000 rules' };
const amgr: SceneNode = { id: 'amgr', kind: 'block', size: 0.8, at: at(-3, 3.5), label: 'alert manager', icon: 'Bell', tint: 'amber' };
const pager: SceneNode = { id: 'pager', kind: 'phone', at: at(-6, 3.5), label: 'on-call phone', sub: 'page' };

export const designMetricsMonitoring: Lesson = {
  id: 'design-metrics-monitoring',
  title: 'Design metrics monitoring and alerting',
  tagline: 'Collect 1M data points a second from 50,000 servers, keep them queryable, and page someone within a minute when it matters.',
  minutes: 20,
  level: 'Advanced',
  learn: [
    'The data model: series, labels, counters, gauges and histograms',
    'Write and query APIs, and the simple design that works for 200 servers',
    'Push versus pull, sharded collectors, and a queue that absorbs bursts',
    'Storage sharding, compression, cardinality limits, downsampling and retention',
    'Alert rules, evaluator scaling, grouping, escalation, and who monitors the monitor',
  ],
  metrics: [
    { key: 'ingest', label: 'Ingest', icon: 'Download' },
    { key: 'series', label: 'Active series', icon: 'Database' },
    { key: 'qp99', label: 'Query p99', icon: 'Timer' },
    { key: 'alert', label: 'Breach to page', icon: 'Clock' },
    { key: 'store', label: 'Raw storage/day', icon: 'HardDrive' },
  ],
  steps: [
    {
      title: 'Requirements',
      tag: 'problem',
      heading: 'Find out a service is sick before customers do',
      eli5: 'A hospital has 50,000 patients and nobody takes temperatures. The first sign of a fever is a patient shouting. We want a **ward round** that checks everyone every few seconds and rings a bell.',
      body: [
        'A company runs **50,000 servers**. Each exposes about **200 metrics** (CPU, request counts, queue depth). Sampled every 10 s, that is **10M series** and **1M data points a second**.',
        'Engineers want dashboards that load in about a second, and an alert within a minute. That 60 s is **pipeline latency** (scrape to notify) after the `for` window of the rule. The system must stay up when all else is down.',
      ],
      keyIdea: 'Metrics monitoring is a write-heavy pipeline with two readers: humans on dashboards and rules that page people.',
      metrics: { ingest: '1M pts/s', series: '10M', qp99: 'goal 1 s', alert: 'pipeline 60 s', store: '-' },
      metricTones: { ingest: 'warn' },
      scene: {
        nodes: [
          { ...srv, status: 'hot', badge: '10M series' },
          { ...dash, at: at(3, 0), status: 'dim', chips: [{ text: 'no data yet', tone: 'warn' }] },
          { ...pager, at: at(0, 3.5), chips: [{ text: 'customer tweeted first', tone: 'bad' }] },
        ],
        links: [link('srv', 'dash', { label: '1M points/s?', labelTone: 'warn' })],
        flows: [{ path: ['srv', 'dash'], tone: 'data', count: 3, label: 'metrics', duration: 1.6 }],
        panel: {
          title: 'Requirements',
          icon: 'List',
          rows: [
            { text: 'Servers', value: '50,000' },
            { text: 'Series', value: '10M' },
            { text: 'Sample interval', value: '10 s' },
            { text: 'Data fresh within', value: '15 s' },
            { text: 'Dashboard query', value: '< 1 s' },
            { text: 'Pipeline to page', value: '< 60 s', tone: 'good' },
          ],
          footer: { text: 'Losing a few samples is fine. Losing alerts is not.', tone: 'muted' },
        },
        caption: 'Scale and goals before any boxes',
      },
    },
    {
      title: 'Data model',
      tag: 'concept',
      heading: 'A metric is a named series of timestamped numbers',
      eli5: 'Each **patient chart** has a name at the top and a long column of readings, one line per check: time, number. To find all fevers in ward 3, we read the labels on top.',
      body: [
        'A **series** is a metric name plus **labels**, with a list of `(timestamp, value)` points. `cpu_usage{host="a1", az="us-1"}` is one series. Change one label value and it is a different series.',
        'Writes are append-only and in time order. Reads ask for a name, a label filter and a time range, then aggregate: "average CPU for az us-1 over 1 hour".',
      ],
      keyIdea: 'Series identity is name plus labels. The labels you choose decide how many series you must store.',
      metrics: { ingest: '1M pts/s', series: '10M', qp99: '-', alert: '-', store: '-' },
      scene: {
        nodes: [
          { ...srv, chips: ['cpu_usage', '{host="a1", az="us-1"}'] },
          { ...tsdb, at: at(0, 0), status: 'active', badge: 'append only' },
        ],
        links: [link('srv', 'tsdb', { label: '(time, value)' })],
        flows: [{ path: ['srv', 'tsdb'], tone: 'data', count: 3, label: '0.62', duration: 1.6 }],
        panel: {
          title: 'One series',
          icon: 'Table',
          rows: [
            { text: 'cpu_usage{host=a1}  12:00:00', value: '0.62' },
            { text: 'cpu_usage{host=a1}  12:00:10', value: '0.64' },
            { text: 'cpu_usage{host=a1}  12:00:20', value: '0.91', tone: 'warn' },
            { text: 'cpu_usage{host=a2}  12:00:00', value: '0.31', tone: 'muted' },
          ],
          footer: { text: 'Different host label, different series', tone: 'muted' },
        },
        caption: 'Name plus labels is the series identity',
      },
    },
    {
      title: 'Metric types',
      tag: 'concept',
      heading: 'Counters, gauges and histograms answer different questions',
      eli5: 'A **counter** is the number of visits to the ward, only ever going up. A gauge is the temperature right now, up and down. A histogram counts how many patients fall in each fever range.',
      body: [
        'A **counter** only increases (requests served). You read it as a rate: `rate(x[1m])`. A **gauge** goes up and down (memory in use). A **histogram** counts values into buckets so you can compute p99 latency.',
        'Never store a pre-computed p99 per host. You cannot average percentiles. Store bucket counts and compute the percentile at query time (see the latency percentiles lesson).',
      ],
      keyIdea: 'Counters give rates, gauges give levels, and histogram buckets give percentiles you can still merge across hosts.',
      metrics: { ingest: '1M pts/s', series: '10M', qp99: '-', alert: '-', store: '-' },
      scene: {
        nodes: [
          { ...srv, chips: ['requests_total  counter', 'mem_bytes  gauge', 'latency_bucket  histogram'] },
          { ...tsdb, at: at(0, 0), label: 'time-series DB', sub: 'stores raw values' },
        ],
        links: [link('srv', 'tsdb')],
        flows: [{ path: ['srv', 'tsdb'], tone: 'data', count: 3, duration: 1.6 }],
        panel: {
          title: 'Latency histogram buckets',
          icon: 'TrendingUp',
          rows: [
            { text: 'le=0.05 s', value: '9,100' },
            { text: 'le=0.1 s', value: '9,700' },
            { text: 'le=0.5 s', value: '9,980' },
            { text: 'le=+Inf', value: '10,000' },
          ],
          footer: { text: 'p99 sits in the 0.1 to 0.5 s bucket', tone: 'good' },
        },
        caption: 'Three shapes of number',
      },
      code: {
        language: 'bash',
        title: 'What a host exposes at /metrics',
        source: `# TYPE http_requests_total counter
http_requests_total{route="/cart",status="200"} 1834221
# TYPE memory_bytes gauge
memory_bytes{host="a1"} 4.2e9
# TYPE latency_seconds histogram
latency_seconds_bucket{route="/cart",le="0.1"} 9700
latency_seconds_bucket{route="/cart",le="0.5"} 9980
latency_seconds_bucket{route="/cart",le="+Inf"} 10000
latency_seconds_count{route="/cart"} 10000`,
        highlight: [2, 4, 6, 7, 8],
      },
    },
    {
      title: 'APIs',
      tag: 'concept',
      heading: 'Two APIs: a batched write and a range query',
      eli5: 'The **nurse** drops a stack of chart pages on the desk in one go. Later a doctor asks for one patient\'s readings between two times. Dropping off and looking up are different jobs.',
      body: [
        'The **write API** takes a batch: many series, many points, one request. Sending points one at a time would cost 1M requests a second. Batches cut that to a few thousand.',
        'The **query API** takes an expression, a time range and a **step** (the gap between points returned). The step lets the server pick a coarse or fine resolution.',
      ],
      keyIdea: 'Write in big batches. Query with a range and a step so the server controls how much it reads.',
      metrics: { ingest: '1M pts/s', series: '10M', qp99: '-', alert: '-', store: '-' },
      scene: {
        nodes: [
          { ...col, at: at(-3, 0), chips: [{ text: 'POST /write', tone: 'good' }] },
          { ...tsdb, at: at(0, 0), status: 'active' },
          { ...query, at: at(3.2, 3.5), chips: [{ text: 'GET /query_range', tone: 'good' }] },
          { ...dash, at: at(6.4, 3.5), sub: 'graph panels' },
        ],
        links: [link('col', 'tsdb'), link('tsdb', 'query'), link('query', 'dash')],
        flows: [
          { path: ['col', 'tsdb'], tone: 'data', label: '5,000 points', duration: 1.4 },
          { path: ['dash', 'query', 'tsdb'], tone: 'request', label: 'avg cpu, 1 h', duration: 1.8, delay: 1.5 },
        ],
        panel: {
          title: 'Query parameters',
          icon: 'Code',
          rows: [
            { text: 'query', value: 'avg(cpu{az=us-1})' },
            { text: 'start, end', value: '1 hour' },
            { text: 'step', value: '30 s', tone: 'good' },
          ],
          footer: { text: '120 points back, however many series match', tone: 'muted' },
        },
        caption: 'Batch in, aggregate out',
      },
      code: {
        language: 'bash',
        title: 'Write a batch, then query a range',
        source: `# write: many series, many points, one request
curl -X POST https://metrics.internal/api/v1/write \\
  -d '{"series":[
        {"name":"cpu_usage","labels":{"host":"a1","az":"us-1"},
         "points":[[1731500000,0.62],[1731500010,0.64]]}
      ]}'

# query: an expression, a range and a step
curl "https://metrics.internal/api/v1/query_range?\\
query=avg(cpu_usage{az=\\"us-1\\"})&start=1731496400&end=1731500000&step=30"`,
        highlight: [2, 3, 4, 9, 10],
      },
    },
    {
      title: 'Simple design',
      tag: 'concept',
      heading: 'The first version: one collector, one database, one dashboard',
      eli5: 'At a small clinic with 20 patients, one **nurse** does the round and writes everything in one notebook. Anyone can read the notebook. It works fine.',
      body: [
        'For 200 servers a single **collector** scrapes every host, writes to one time-series database, and Grafana-style dashboards query it. That is 4K points a second and about 40K series.',
        'A single node handles this on a laptop-sized budget. Everything we add from here exists because one of these three boxes runs out of room.',
      ],
      keyIdea: 'Start with the simplest pipeline. Each later piece answers a specific limit this one hits.',
      metrics: { ingest: '4K pts/s', series: '40K', qp99: '80 ms', alert: '-', store: '-' },
      metricTones: { qp99: 'good' },
      scene: {
        nodes: [
          { ...srv, sub: '200 hosts' },
          { ...col, at: at(-2, 0) },
          { ...tsdb, at: at(2, 0), load: 12, sub: '40K series' },
          { ...dash, at: at(6, 0), sub: 'a few dashboards' },
        ],
        links: [link('srv', 'col'), link('col', 'tsdb'), link('tsdb', 'dash')],
        flows: [
          { path: ['col', 'srv', 'col'], tone: 'request', label: 'scrape', duration: 1.4 },
          { path: ['col', 'tsdb'], tone: 'data', label: 'batch', duration: 1.2, delay: 1.5 },
          { path: ['dash', 'tsdb', 'dash'], tone: 'request', duration: 1.4, delay: 2.8 },
        ],
        panel: {
          title: 'At 200 servers',
          icon: 'Gauge',
          rows: [
            { text: 'Points per second', value: '4K', tone: 'good' },
            { text: 'DB load', value: '12%', tone: 'good' },
            { text: 'Dashboard query', value: '80 ms', tone: 'good' },
          ],
          footer: { text: 'Plenty of headroom', tone: 'good' },
        },
        caption: 'Fine until the fleet grows 250 times',
      },
    },
    {
      title: 'Where it breaks',
      tag: 'case',
      heading: 'At 50,000 servers every box in the line is overloaded',
      eli5: 'Now the clinic is a city hospital. One nurse cannot reach 50,000 beds, one notebook cannot hold the pages, and a doctor flipping through it blocks the nurse from writing.',
      body: [
        'The fleet grew 250 times. One collector cannot scrape 50,000 hosts in 10 s. One database node tops out near 100K points a second, and we need **1M**. Raw data is 16 bytes a point: **1.4 TB a day**.',
        'Reads and writes also fight. A dashboard scanning a week of data stalls ingest, so graphs show holes.',
      ],
      keyIdea: 'Three limits show up at once: collection fan-out, write throughput, and storage. Reads compete with writes on the same disks.',
      metrics: { ingest: '1M pts/s', series: '10M', qp99: '12 s', alert: 'late', store: '1.4 TB' },
      metricTones: { qp99: 'bad', alert: 'bad', store: 'bad' },
      scene: {
        nodes: [
          { ...srv, status: 'hot' },
          { ...col, at: at(-2, 0), status: 'hot', load: 100 },
          { ...tsdb, at: at(2, 0), status: 'hot', load: 100, badge: 'disk 98%' },
          { ...dash, at: at(6, 0), status: 'dim', chips: [{ text: 'gaps in graphs', tone: 'bad' }] },
        ],
        links: [link('srv', 'col'), link('col', 'tsdb', { label: '1M pts/s', labelTone: 'bad' }), link('tsdb', 'dash')],
        flows: [
          { path: ['srv', 'col', 'tsdb'], tone: 'error', count: 4, label: 'dropped', duration: 1.6 },
          { path: ['dash', 'tsdb'], tone: 'request', label: '7-day query', duration: 1.4, delay: 1.7 },
        ],
        panel: {
          title: 'Why it falls over',
          icon: 'Gauge',
          rows: [
            { text: 'Writes needed', value: '1M/s', tone: 'bad' },
            { text: 'One node ceiling', value: '~100K/s', tone: 'warn' },
            { text: 'Raw bytes per day', value: '1.4 TB', tone: 'bad' },
            { text: '7-day dashboard scan', value: 'stalls ingest', tone: 'bad' },
          ],
          footer: { text: '1M x 16 B x 86,400 s = 1.4 TB', tone: 'muted' },
        },
        caption: 'Collection, writes, storage and reads all fail',
      },
    },
    {
      title: 'Push or pull',
      tag: 'tradeoff',
      heading: 'Pull from the server, or let the server push',
      eli5: 'Either the **nurse** walks to each bed and reads the chart (pull), or each patient shouts their number to the desk (push). Walking shows who is too sick to answer.',
      body: [
        '**Pull**: collectors fetch `/metrics` on a schedule, using the service discovery lesson to find targets. A failed fetch is itself a signal, `up = 0`. Servers need no config about where to send data.',
        '**Push**: each host sends to an endpoint. It suits short batch jobs and hosts behind firewalls, but a silent host and a dead host look the same. Many systems run pull for services and push for batch jobs.',
      ],
      keyIdea: 'Pull gives free health checks and central control. Push reaches short-lived jobs and closed networks. Most fleets need both.',
      metrics: { ingest: '1M pts/s', series: '10M', qp99: '-', alert: '-', store: '-' },
      scene: {
        nodes: [
          { ...srv, at: at(-6, 0), chips: ['/metrics'] },
          { id: 'sd', kind: 'block', size: 0.8, at: at(-3, 3.5), label: 'service discovery', icon: 'Network', tint: 'teal' },
          { ...col, at: at(0, 0), status: 'active' },
          { id: 'batch', kind: 'worker', at: at(-3, -3.5), label: 'nightly job', sub: 'lives 90 s' },
        ],
        links: [link('col', 'srv', { label: 'pull', style: 'dashed' }), link('sd', 'col'), link('batch', 'col', { label: 'push' })],
        flows: [
          { path: ['sd', 'col'], tone: 'event', label: 'target list', duration: 1.2 },
          { path: ['col', 'srv'], tone: 'request', label: 'GET /metrics', duration: 1.2, delay: 1.3 },
          { path: ['srv', 'col'], tone: 'response', label: 'up = 1', duration: 1.2, delay: 2.5 },
          { path: ['batch', 'col'], tone: 'data', label: 'push on exit', duration: 1.2, delay: 3.7 },
        ],
        panel: {
          title: 'Pull versus push',
          icon: 'Scale',
          rows: [
            { text: 'Pull: dead host is visible', value: 'up = 0', tone: 'good' },
            { text: 'Pull: short jobs', value: 'missed', tone: 'warn' },
            { text: 'Push: short jobs', value: 'covered', tone: 'good' },
            { text: 'Push: dead vs silent', value: 'same', tone: 'warn' },
          ],
        },
        caption: 'Run pull for services, push for batch jobs',
      },
    },
    {
      title: 'Sharded collectors',
      tag: 'concept',
      heading: 'Split the 50,000 targets across a pool of collectors',
      eli5: 'One nurse cannot do the whole city hospital, so each nurse gets a set of wards. If a nurse falls ill, a neighbor takes over those wards, and nobody else changes their route.',
      body: [
        '**Consistent hashing** (see that lesson) gives each of 25 collectors about 2,000 hosts. Adding or losing one moves only its share.',
        'Run each slice on a **hot-standby pair**. Both scrape, but only the lease holder forwards to the queue. On lease loss the standby takes over. The cost is double scrape load. If both forwarded, the queue would see 2M points a second and writers would dedupe on (series, timestamp).',
      ],
      keyIdea: 'Hash targets to collectors so the pool can grow, shrink and fail without a full reshuffle. Pair them so one failure drops nothing.',
      metrics: { ingest: '1M pts/s', series: '10M', qp99: '-', alert: '-', store: '-' },
      metricTones: { ingest: 'good' },
      scene: {
        nodes: [
          { ...srv, at: at(-6, 0), sub: '2,000 per collector' },
          { ...col, id: 'colA', at: at(-2, -2.5), label: 'collector A', sub: 'hash slice 1', load: 38 },
          { ...col, id: 'colB', at: at(0.5, 2.5), label: 'collector B', sub: 'standby for slice 1', load: 38 },
          { ...queue, at: at(4, 0), label: 'ingest queue', sub: 'next step' },
        ],
        links: [link('srv', 'colA'), link('srv', 'colB'), link('colA', 'queue'), link('colB', 'queue', { style: 'dashed', label: 'on lease loss' })],
        flows: [
          { path: ['colA', 'srv', 'colA'], tone: 'request', label: 'scrape', duration: 1.4 },
          { path: ['colB', 'srv', 'colB'], tone: 'request', duration: 1.4, delay: 0.2 },
          { path: ['colA', 'queue'], tone: 'data', label: 'batch', duration: 1.2, delay: 1.6 },
        ],
        panel: {
          title: 'Collector pool',
          icon: 'Server',
          rows: [
            { text: 'Targets', value: '50,000' },
            { text: 'Collectors (pairs)', value: '25 x 2' },
            { text: 'Targets per slice', value: '2,000', tone: 'good' },
            { text: 'One collector dies', value: '0 gaps', tone: 'good' },
          ],
        },
        caption: 'Hash slices, each scraped by a pair',
      },
      quiz: {
        question: 'Why assign scrape targets to collectors with consistent hashing instead of hash mod N?',
        options: [
          'It makes scrapes faster',
          'Adding or losing a collector moves only a small share of targets',
          'It removes the need for service discovery',
          'It lets collectors skip the pair setup',
        ],
        answer: 1,
        explain: 'With hash mod N, changing N moves almost every target. Consistent hashing moves only the share owned by the collector that joined or left, so scrape schedules stay stable.',
      },
    },
    {
      title: 'Ingest queue',
      tag: 'concept',
      heading: 'A queue between collectors and storage absorbs bursts',
      eli5: 'The nurses drop their chart pages in a **tray** at the desk. A clerk files them as fast as possible. If the clerk steps out for a minute, the tray fills and nothing is lost.',
      body: [
        'Collectors write to a **partitioned log** (the message queues lesson), keyed by series hash. Writers consume from it and write to storage. A slow or restarting database no longer drops data.',
        'Only the active collector of each pair writes, so the queue is sized for about 1M points a second (2M if standbys also sent). It keeps about 24 hours. It also feeds a second consumer later, such as the alert evaluator, so one write serves several readers.',
      ],
      keyIdea: 'The queue decouples collection from storage. Bursts and restarts become lag, not loss.',
      metrics: { ingest: '1M pts/s', series: '10M', qp99: '-', alert: '-', store: '-' },
      scene: {
        nodes: [
          { ...col, at: at(-6, 0), label: 'collectors', sub: '25 pairs' },
          { ...queue, at: at(-2, 0), chips: ['partition = hash(series)'], badge: '24 h retention' },
          { id: 'writer', kind: 'worker', at: at(2, 0), label: 'writers', sub: 'consume + batch' },
          { ...tsdb, at: at(6, 0), sub: 'storage next' },
        ],
        links: [link('col', 'queue'), link('queue', 'writer'), link('writer', 'tsdb')],
        flows: [
          { path: ['col', 'queue'], tone: 'event', count: 3, label: 'batches', duration: 1.4 },
          { path: ['queue', 'writer', 'tsdb'], tone: 'data', label: 'batched write', duration: 1.8, delay: 1.5 },
        ],
        panel: {
          title: 'Queue settings',
          icon: 'Inbox',
          rows: [
            { text: 'Partitions', value: '64' },
            { text: 'Key', value: 'series hash' },
            { text: 'Retention', value: '24 h' },
            { text: 'DB down 10 min', value: 'lag, no loss', tone: 'good' },
          ],
          footer: { text: 'Writers catch up when the DB returns', tone: 'good' },
        },
        caption: 'A buffer between scraping and storing',
      },
    },
    {
      title: 'Sharded storage',
      tag: 'concept',
      heading: 'Shard the series across 20 nodes, three copies each',
      eli5: 'The chart archive is now twenty big cabinets. A rule decides which cabinet holds each patient, and each cabinet has two duplicates in other rooms in case one catches fire.',
      body: [
        'Series are placed by a hash of name plus labels, so one series lives on one shard. 20 shards hold **500K series** and take **50K points a second** each. Every replica applies every write, so each node runs at half its ~100K/s ceiling.',
        'Each shard is **replicated 3 times** across zones. A write succeeds once 2 of 3 copies have it.',
      ],
      keyIdea: 'Hash by series so a series stays together, replicate for durability, and a write needs a quorum rather than all copies.',
      metrics: { ingest: '1M pts/s', series: '10M', qp99: '-', alert: '-', store: '1.4 TB' },
      metricTones: { ingest: 'good' },
      scene: {
        nodes: [
          { id: 'writer', kind: 'worker', at: at(-6, 0), label: 'writers', sub: 'hash(series) % 20' },
          { id: 's1', kind: 'shard', at: at(-3, -3.5), label: 'shard 1', sub: '500K series', load: 55 },
          { id: 's2', kind: 'shard', at: at(0, 0), label: 'shard 2', sub: '500K series', load: 52 },
          { id: 's3', kind: 'shard', at: at(3, 3.5), label: 'shard 20', sub: '500K series', load: 58 },
        ],
        links: [link('writer', 's1'), link('writer', 's2'), link('writer', 's3')],
        flows: [
          { path: ['writer', 's1'], tone: 'data', label: '50K/s', duration: 1.4 },
          { path: ['writer', 's2'], tone: 'data', duration: 1.4, delay: 0.2 },
          { path: ['writer', 's3'], tone: 'data', duration: 1.4, delay: 0.4 },
        ],
        panel: {
          title: 'Per shard',
          icon: 'Database',
          rows: [
            { text: 'Series', value: '500K' },
            { text: 'Points per second', value: '~50K', tone: 'good' },
            { text: 'Node ceiling', value: '~100K/s' },
            { text: 'Replicas', value: '3, across zones' },
            { text: 'Write acknowledged at', value: '2 of 3' },
          ],
          footer: { text: '20 shards x 50K = 1M points/s', tone: 'good' },
        },
        caption: 'One series, one shard, three copies',
      },
    },
    {
      title: 'Compression',
      tag: 'concept',
      heading: 'Time-series data compresses by about 10 times',
      eli5: 'Instead of writing "10:00:00, 10:00:10, 10:00:20" on every line, the clerk writes the first time and then just "+10, +10". Numbers that barely change shrink to almost nothing.',
      body: [
        'Timestamps arrive at a steady interval, so store the **delta of deltas**: usually 0, which costs one bit. Floats that change slowly are **XOR**-ed with the previous value, and the leading and trailing zero bits are dropped.',
        'A 16-byte point becomes about **1.5 bytes**. Raw storage falls from 1.4 TB to about **130 GB a day**. This is why a purpose-built time-series store beats a plain table.',
      ],
      keyIdea: 'Regular timestamps and slowly changing values compress extremely well. Design the storage format around that.',
      metrics: { ingest: '1M pts/s', series: '10M', qp99: '-', alert: '-', store: '130 GB' },
      metricTones: { store: 'good' },
      scene: {
        nodes: [
          { id: 'writer', kind: 'worker', at: at(-3, 0), label: 'writers', sub: 'encode blocks' },
          { ...tsdb, id: 's1', kind: 'shard', at: at(2, 0), label: 'shard', sub: 'compressed blocks', status: 'ok' },
          { id: 'cold', kind: 'storage', at: at(5, 3.5), label: 'block files', sub: '2 h blocks' },
        ],
        links: [link('writer', 's1'), link('s1', 'cold', { style: 'dashed', label: 'flush' })],
        flows: [{ path: ['writer', 's1'], tone: 'data', label: '1.5 B / point', duration: 1.4 }, { path: ['s1', 'cold'], tone: 'data', duration: 1.4, delay: 1.5 }],
        panel: {
          title: 'Storage per day',
          icon: 'HardDrive',
          rows: [
            { text: 'Raw 16 B per point', value: '1.4 TB', tone: 'bad' },
            { text: 'Compressed 1.5 B', value: '130 GB', tone: 'good' },
            { text: '15 days, 3 replicas', value: '~6 TB' },
          ],
          footer: { text: '1M x 1.5 B x 86,400 s = 130 GB', tone: 'muted' },
        },
        caption: 'Same data, a tenth of the bytes',
      },
      code: {
        language: 'python',
        title: 'Delta-of-delta for timestamps',
        source: `def encode_timestamps(ts):
    out = [ts[0]]                 # first one in full
    prev, prev_delta = ts[0], 0
    for t in ts[1:]:
        delta = t - prev          # 10, 10, 10, 11, 10 ...
        dod = delta - prev_delta  # 0, 0, 0, 1, -1 ...
        out.append(dod)           # mostly 0: one bit each
        prev, prev_delta = t, delta
    return out

encode_timestamps([100, 110, 120, 130, 141, 151])
# -> [100, 10, 0, 0, 1, -1]`,
        highlight: [5, 6, 7, 12],
      },
    },
    {
      title: 'Cardinality',
      tag: 'case',
      heading: 'One bad label can create billions of series',
      eli5: 'Someone starts a separate chart page for every visitor who walks through the lobby, not just every patient. The archive fills with millions of pages that each have one line.',
      body: [
        'Series count is the product of each label\'s distinct values. Add `user_id` (5M users) to an 80,000-series metric and you get 400 billion possible series. The cap drops the excess, so the index grows from 10M to about 40M and holds.',
        'Enforce a **per-metric series cap** (say 100K) at the collector, alert on drops, and keep unbounded values (user IDs, URLs) in logs. Authenticate writers and give each team a quota.',
      ],
      keyIdea: 'Cardinality, not data volume, is what kills a metrics system. Cap it where data enters.',
      metrics: { ingest: '1M pts/s', series: '10M to 40M, then capped', qp99: '9 s', alert: '-', store: '130 GB' },
      metricTones: { series: 'bad', qp99: 'bad' },
      scene: {
        nodes: [
          { ...srv, status: 'hot', chips: [{ text: 'requests{user_id="u8812"}', tone: 'bad' }] },
          { ...col, at: at(-2, 0), chips: [{ text: 'cap: 100K per metric', tone: 'good' }] },
          { ...tsdb, at: at(2, 0), status: 'hot', load: 92, badge: 'index too big' },
        ],
        links: [link('srv', 'col'), link('col', 'tsdb')],
        flows: [
          { path: ['srv', 'col'], tone: 'data', count: 4, label: 'new series', duration: 1.4 },
          { path: ['col', 'tsdb'], tone: 'error', label: 'over cap: dropped', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Series per metric',
          icon: 'Table',
          rows: [
            { text: '{service}', value: '400' },
            { text: '{service, status}', value: '2,000' },
            { text: '{service, status, route}', value: '80,000', tone: 'warn' },
            { text: '+ user_id (5M users)', value: '400 billion', tone: 'bad' },
          ],
          footer: { text: '80,000 x 5M = 400 billion', tone: 'warn' },
        },
        caption: 'The index grows with distinct label values',
      },
    },
    {
      title: 'Retention',
      tag: 'concept',
      heading: 'Keep recent data sharp, and older data coarse',
      eli5: 'The hospital keeps minute-by-minute charts for two weeks. After that a clerk replaces each hour with one summary line, and after two years only the daily summary stays.',
      body: [
        'Nobody graphs one-month-old data at 10 s resolution. A **downsampling job** rolls raw points into 1-minute then 1-hour summaries (min, max, sum, count), and old tiers move to cheap object storage.',
        'Keep **raw for 15 days**, **1-minute for 90 days**, **1-hour for 2 years**. Storing min, max, sum and count keeps averages and peaks correct, which a single averaged number would lose.',
      ],
      keyIdea: 'Resolution decays with age. Rollups keep min, max, sum and count so answers stay correct while storage drops 360 times.',
      metrics: { ingest: '1M pts/s', series: '10M', qp99: '-', alert: '-', store: '130 GB' },
      scene: {
        nodes: [
          { id: 's1', kind: 'shard', at: at(-4, 0), label: 'raw tier', sub: '10 s, 15 days', status: 'active' },
          { id: 'roll', kind: 'worker', at: at(0, 0), label: 'rollup job', sub: 'min max sum count' },
          { id: 'cold', kind: 'storage', at: at(4, 0), label: 'object storage', sub: '1 min, 1 h tiers' },
        ],
        links: [link('s1', 'roll'), link('roll', 'cold')],
        flows: [
          { path: ['s1', 'roll'], tone: 'data', label: '6 points in', duration: 1.4 },
          { path: ['roll', 'cold'], tone: 'data', label: '1 point out', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Tiers',
          icon: 'Layers',
          rows: [
            { text: 'Raw, 10 s', value: '15 days, 8,640/day' },
            { text: '1 minute', value: '90 days, 1,440/day' },
            { text: '1 hour', value: '2 years, 24/day' },
          ],
          footer: { text: 'Points per series per day drop 6x, then 360x', tone: 'good' },
        },
        caption: 'Older means coarser and cheaper',
      },
      quiz: {
        question: 'A 1-hour rollup stores only the average of each hour. What is lost?',
        options: [
          'Nothing, the average is enough for every question',
          'Peaks and troughs, so a 30-second CPU spike disappears',
          'The series name',
          'The timestamps',
        ],
        answer: 1,
        explain: 'An average hides a short spike. Storing min, max, sum and count per bucket keeps the peaks and still lets you recompute correct averages across buckets.',
      },
    },
    {
      title: 'Query path',
      tag: 'concept',
      heading: 'Pick the tier from the range, and cache what dashboards repeat',
      eli5: 'A doctor asking about this week reads the fine chart. A doctor asking about last year reads the yearly summary. A wall board shows the same answer to everyone, so we write it down once.',
      body: [
        'A **query service** reads the finest tier that fits the range, fans out to shards and merges.',
        '10,000 panels refreshing every 30 s is about **330 queries a second**, mostly repeats. A **result cache** keyed by query and window serves most. Heavy panels read **recording rules** (per-service error rate precomputed every 30 s), not raw series.',
      ],
      keyIdea: 'Match resolution to the range, then cache repeated queries. Reads stay fast without touching ingest.',
      metrics: { ingest: '1M pts/s', series: '10M', qp99: '0.9 s', alert: '-', store: '130 GB' },
      metricTones: { qp99: 'good' },
      scene: {
        nodes: [
          { ...dash, at: at(-5, 0), chips: ['10,000 panels / 30 s', 'recording rules / 30 s'] },
          { ...query, at: at(-1, 0), size: 0.8 },
          { id: 'cache', kind: 'cache', at: at(-1, 3.5), label: 'result cache', sub: 'query + window', status: 'ok' },
          { ...tsdb, at: at(4, 0), label: 'storage tiers', sub: 'raw, 1 min, 1 h' },
        ],
        links: [link('dash', 'query'), link('query', 'cache', { style: 'dashed' }), link('query', 'tsdb')],
        flows: [
          { path: ['dash', 'query', 'cache', 'query', 'dash'], tone: 'request', label: 'cache hit', duration: 2, count: 1 },
          { path: ['query', 'tsdb'], tone: 'request', label: 'miss: newest slice', duration: 1.4, delay: 2.1 },
        ],
        panel: {
          title: 'Tier by range',
          icon: 'Layers',
          rows: [
            { text: 'Last 1 hour', value: 'raw 10 s' },
            { text: 'Last 30 days', value: '1 minute' },
            { text: 'Last year', value: '1 hour' },
            { text: 'Cache hit rate', value: '~90%', tone: 'good' },
          ],
          footer: { text: '330 queries/s becomes ~33 reaching storage', tone: 'good' },
        },
        caption: 'Right tier, plus a cache for repeats',
      },
    },
    {
      title: 'Alert rules',
      tag: 'concept',
      heading: 'An alert is a query that must stay true for a while',
      eli5: 'The **alarm bell** rings when a fever is above 39 degrees, but only if the nurse checks again and it is still high five minutes later. One odd reading should not wake the doctor.',
      body: [
        'A **rule** is a query, a threshold and a `for` duration, evaluated every 30 s. Once true it is **pending**, and after the whole `for` period it is **firing**.',
        '`for` filters blips but adds delay: this rule takes about 5.5 min from breach to page. Fast pages use a `for: 1m` rule on a short window. Tuning `for` and `group_wait` trades noise for speed. Alert on **symptoms** users feel, not causes like one disk at 90%.',
      ],
      keyIdea: 'A rule is query plus threshold plus duration. The duration trades noise against detection time.',
      metrics: { ingest: '1M pts/s', series: '10M', qp99: '-', alert: '~5.5 min', store: '-' },
      scene: {
        nodes: [
          { ...evalr, at: at(-3, 0), chips: ['every 30 s'] },
          { ...tsdb, at: at(2, 0), label: 'recent data', sub: 'last 2 hours' },
          { ...amgr, at: at(5, 3.5), chips: [{ text: 'HighErrorRate FIRING', tone: 'bad' }] },
        ],
        links: [link('eval', 'tsdb'), link('eval', 'amgr', { label: 'firing' })],
        flows: [
          { path: ['eval', 'tsdb', 'eval'], tone: 'request', label: 'error rate?', duration: 1.6 },
          { path: ['eval', 'amgr'], tone: 'event', label: 'alert', duration: 1.4, delay: 1.7 },
        ],
        panel: {
          title: 'Rule life cycle',
          icon: 'Activity',
          rows: [
            { text: 'ok', value: 'query false', tone: 'good' },
            { text: 'pending', value: 'true, timer running', tone: 'warn' },
            { text: 'firing', value: 'true for 5 min', tone: 'bad' },
            { text: 'resolved', value: 'false again', tone: 'good' },
          ],
        },
        caption: 'ok, pending, firing, resolved',
      },
      code: {
        language: 'yaml',
        title: 'One alert rule',
        source: `alert: HighErrorRate
expr: |
  sum(rate(http_requests_total{status=~"5.."}[5m]))
    / sum(rate(http_requests_total[5m])) > 0.02
for: 5m
labels:
  severity: page
  team: checkout
annotations:
  summary: "Checkout 5xx above 2% for 5 minutes"
  runbook: "https://wiki.internal/runbooks/checkout-5xx"`,
        highlight: [3, 4, 5, 7, 11],
      },
    },
    {
      title: 'Rule evaluators',
      tag: 'concept',
      heading: '20,000 rules every 30 seconds, kept off the dashboard path',
      eli5: 'There are 20,000 alarm checks to do every half minute. Several **alarm nurses** split the list, and they read a small board of recent readings so they never wait behind a doctor reading old archives.',
      body: [
        '20,000 rules every 30 s is about **670 queries a second**. Shard the rule list across evaluators by rule ID, using consistent hashing, with a standby for each shard.',
        'Evaluators read a **recent-data tier**: the last 2 hours in memory, fed from the ingest queue. They do not share a query path with dashboards, so a heavy dashboard cannot delay an alert.',
      ],
      keyIdea: 'Alerting is a latency-critical reader. Give it its own data tier and its own workers, so nothing else can slow it.',
      metrics: { ingest: '1M pts/s', series: '10M', qp99: '0.9 s', alert: 'pipeline < 60 s', store: '130 GB' },
      metricTones: { alert: 'good' },
      scene: {
        nodes: [
          { id: 'rules', kind: 'service', at: at(-6, 0), label: 'rule store', sub: '20,000 rules' },
          { ...evalr, id: 'eval1', at: at(-3, -2.5), label: 'evaluator 1', sub: 'rules 0 to 9,999', load: 45 },
          { ...evalr, id: 'eval2', at: at(0, 2.5), label: 'evaluator 2', sub: 'rules 10,000+', load: 47 },
          { id: 'hot', kind: 'cache', at: at(4, 0), label: 'recent tier', sub: '2 h in memory', status: 'ok' },
        ],
        links: [link('rules', 'eval1'), link('rules', 'eval2'), link('eval1', 'hot'), link('eval2', 'hot')],
        flows: [
          { path: ['rules', 'eval1'], tone: 'event', label: 'rule set', duration: 1.2 },
          { path: ['eval1', 'hot', 'eval1'], tone: 'request', duration: 1.6, delay: 1.3 },
          { path: ['eval2', 'hot', 'eval2'], tone: 'request', duration: 1.6, delay: 1.5 },
        ],
        panel: {
          title: 'Evaluation load',
          icon: 'Cpu',
          rows: [
            { text: 'Rules', value: '20,000' },
            { text: 'Interval', value: '30 s' },
            { text: 'Queries per second', value: '~670' },
            { text: 'Dashboards share path?', value: 'no', tone: 'good' },
          ],
        },
        caption: 'Rules sharded, data tier separate',
      },
      quiz: {
        question: 'Why should alert evaluators read from a separate recent-data tier instead of the dashboard query path?',
        options: [
          'Dashboards need older data than alerts',
          'A slow or heavy dashboard query must never delay an alert',
          'Alerts do not need fresh data',
          'It reduces the number of rules',
        ],
        answer: 1,
        explain: 'Alerts are time-critical. Sharing a path with ad hoc dashboard queries lets a heavy scan add seconds of delay exactly when the system is struggling.',
      },
    },
    {
      title: 'Alert manager',
      tag: 'concept',
      heading: '400 firing alerts should become one page',
      eli5: 'When a power cut rings 400 bells at once, a **bell keeper** says "one problem: the power" and wakes one doctor. The keeper also knows which bells to mute while the electricians work.',
      body: [
        'The **alert manager** receives firing alerts and does four things: **group** alerts that share labels (one page for a bad rack), **dedupe** repeats, **silence** planned maintenance, and **inhibit** low-value alerts when a bigger one explains them.',
        '`group_wait: 30s` delays the first page, so count it inside the 60 s pipeline. State lives in a small replicated store, so a restart forgets no silences.',
      ],
      keyIdea: 'Grouping, dedupe, silences and inhibition turn a flood of alerts into a short list of human problems.',
      metrics: { ingest: '1M pts/s', series: '10M', qp99: '-', alert: 'pipeline < 60 s', store: '-' },
      scene: {
        nodes: [
          { ...evalr, at: at(-4, 0), chips: [{ text: '400 firing', tone: 'bad' }] },
          { ...amgr, at: at(0, 0), size: 0.9, status: 'active', chips: ['group by rack', 'dedupe', 'silence'] },
          { ...pager, at: at(4, 0), badge: '1 page' },
        ],
        links: [link('eval', 'amgr'), link('amgr', 'pager')],
        flows: [
          { path: ['eval', 'amgr'], tone: 'event', count: 4, label: '400 alerts', duration: 1.4 },
          { path: ['amgr', 'pager'], tone: 'event', label: 'rack-17 down', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Noise controls',
          icon: 'Bell',
          rows: [
            { text: 'Group', value: 'one page per rack' },
            { text: 'Dedupe', value: 'same alert, one page' },
            { text: 'Silence', value: 'planned maintenance' },
            { text: 'Inhibit', value: 'rack down hides host down' },
          ],
          footer: { text: '400 alerts to 1 page', tone: 'good' },
        },
        caption: 'Many alerts in, few pages out',
      },
      code: {
        language: 'yaml',
        title: 'Routing in the alert manager',
        source: `route:
  group_by: [alertname, rack]
  group_wait: 30s        # collect siblings before the first page
  repeat_interval: 4h    # do not re-page for an unchanged alert
  receiver: chat
  routes:
    - match: { severity: page }
      receiver: oncall-pager
inhibit_rules:
  - source_match: { alertname: RackDown }
    target_match: { alertname: HostDown }
    equal: [rack]`,
        highlight: [2, 3, 4, 7, 9, 10],
      },
    },
    {
      title: 'Delivery',
      tag: 'concept',
      heading: 'Get the page through, then escalate if nobody answers',
      eli5: 'The bell keeper rings the first doctor\'s phone. If nobody says "I\'ve got it" within five minutes, the keeper rings the second doctor. A message that is lost gets sent again.',
      body: [
        'Notifications go to several **receivers**: chat for warnings, a paging service for pages, email for tickets. Sends are retried with backoff, as in the notification system lesson. Pages are sent through two providers.',
        'An **escalation policy** pages the primary on-call, then the secondary after 5 minutes without an acknowledgment, then the manager. Each alert links to a **runbook** so the first minute is not spent searching.',
      ],
      keyIdea: 'Delivery needs retries, a second channel and an escalation path. An unseen page is the same as no page.',
      metrics: { ingest: '1M pts/s', series: '10M', qp99: '-', alert: 'pipeline < 60 s', store: '-' },
      scene: {
        nodes: [
          { ...amgr, at: at(-4, 0) },
          { id: 'chat', kind: 'service', at: at(0, -3.5), label: 'chat', sub: 'warnings' },
          { ...pager, at: at(0, 3.5), label: 'primary on-call', badge: 'no ack 5 min' },
          { id: 'second', kind: 'phone', at: at(4, 3.5), label: 'secondary', sub: 'escalated', status: 'active' },
        ],
        links: [link('amgr', 'chat'), link('amgr', 'pager'), link('pager', 'second', { style: 'dashed', label: 'escalate' })],
        flows: [
          { path: ['amgr', 'chat'], tone: 'event', label: 'warning', duration: 1.2 },
          { path: ['amgr', 'pager'], tone: 'event', label: 'PAGE', duration: 1.2, delay: 1.3 },
          { path: ['amgr', 'second'], tone: 'event', label: 'after 5 min', duration: 1.6, delay: 2.6 },
        ],
        panel: {
          title: 'Escalation policy',
          icon: 'Route',
          rows: [
            { text: '0 min', value: 'primary on-call' },
            { text: '5 min, no ack', value: 'secondary', tone: 'warn' },
            { text: '15 min, no ack', value: 'engineering manager', tone: 'bad' },
          ],
          footer: { text: 'Every page links to a runbook', tone: 'muted' },
        },
        caption: 'Deliver, retry, escalate',
      },
    },
    {
      title: 'Watch the watcher',
      tag: 'case',
      heading: 'If the monitor dies, silence looks like good news',
      eli5: 'If the bell keeper falls asleep, no bells ring and everyone thinks the ward is calm. So a night guard from another building listens for a heartbeat and raises the alarm when it stops.',
      body: [
        'A broken alert pipeline sends nothing. Add a **dead man\'s switch**: a rule that always fires, sent every minute as a heartbeat. An **external watchdog** in another region pages if it hears nothing for 3 minutes.',
        'Run this meta-monitor on separate hardware, ideally another provider, and keep its dashboards independent. A monitor that shares fate with the system it watches fails at the worst time.',
      ],
      keyIdea: 'Alert on the absence of the heartbeat from outside the system. The watcher must not share failure modes with what it watches.',
      metrics: { ingest: '1M pts/s', series: '10M', qp99: '-', alert: 'watchdog 3 min', store: '-' },
      scene: {
        nodes: [
          { ...evalr, at: at(-4, 0), status: 'down', chips: [{ text: 'heartbeat stopped', tone: 'bad' }] },
          { id: 'watch', kind: 'monitor', at: at(0, 3.5), label: 'external watchdog', sub: 'other region, other provider', status: 'active' },
          { ...pager, at: at(4, 0), badge: 'monitoring is down', status: 'hot' },
        ],
        links: [link('eval', 'watch', { label: 'heartbeat / 1 min', style: 'dashed' }), link('watch', 'pager')],
        flows: [
          { path: ['eval', 'watch'], tone: 'event', label: 'always-firing', duration: 1.4 },
          { path: ['watch', 'pager'], tone: 'error', label: 'no beat for 3 min', duration: 1.4, delay: 1.6 },
        ],
        panel: {
          title: 'Dead man\'s switch',
          icon: 'Shield',
          rows: [
            { text: 'Heartbeat every', value: '1 min' },
            { text: 'Page after silence', value: '3 min', tone: 'warn' },
            { text: 'Runs in', value: 'separate region' },
          ],
          footer: { text: 'The watcher shares no fate with the watched', tone: 'good' },
        },
        caption: 'No heartbeat means page a human',
      },
    },
    {
      title: 'Storage failure',
      tag: 'case',
      heading: 'A shard node dies and nothing is lost',
      eli5: 'One archive cabinet floods. Two other rooms hold identical copies, and the tray at the desk still holds the newest pages, so the clerk refiles them once a new cabinet is ready.',
      body: [
        'Shard 2 loses a node. Writes still reach 2 of 3 replicas and reads use the survivors. A new replica is copied from a peer, then replays the queue.',
        'Graphs show a gap, never a zero. Per-host absence is `up == 0`. Whole-service silence needs `absent(metric{job="checkout"})` per critical job or a `count by (job)` drop rule. A bare `absent(up)` fires only if no host reports.',
      ],
      keyIdea: 'Replication and a replayable queue make a node loss a non-event. Missing data must look missing, and must be alertable.',
      metrics: { ingest: '1M pts/s', series: '10M', qp99: '1.1 s', alert: 'pipeline < 60 s', store: '130 GB' },
      metricTones: { ingest: 'good' },
      scene: {
        nodes: [
          { ...queue, at: at(-7.5, 0), sub: 'replays from offset' },
          { id: 's1', kind: 'shard', at: at(-3.6, -3.5), label: 'shard 2 replica A', sub: 'zone 1', status: 'down' },
          { id: 's2', kind: 'shard', at: at(0, 0), label: 'shard 2 replica B', sub: 'zone 2', status: 'ok' },
          { id: 's3', kind: 'shard', at: at(3.6, 3.5), label: 'shard 2 replica C', sub: 'zone 3', status: 'ok' },
        ],
        links: [link('queue', 's1', { style: 'faint' }), link('queue', 's2'), link('queue', 's3')],
        flows: [
          { path: ['queue', 's2'], tone: 'data', label: 'write ok', duration: 1.4 },
          { path: ['queue', 's3'], tone: 'data', duration: 1.4, delay: 0.2 },
          { path: ['queue', 's1'], tone: 'error', label: 'node down', duration: 1.4, delay: 0.4 },
        ],
        panel: {
          title: 'What survives',
          icon: 'Shield',
          rows: [
            { text: 'Writes (2 of 3 ack)', value: 'succeed', tone: 'good' },
            { text: 'Reads', value: 'from B and C', tone: 'good' },
            { text: 'Rebuild', value: 'copy + replay', tone: 'warn' },
            { text: 'Gap in a graph', value: 'shown as gap', tone: 'muted' },
          ],
        },
        caption: 'Two copies still answer, the queue replays',
      },
    },
    {
      title: 'Load spike',
      tag: 'case',
      heading: 'A mass restart triples active series, so shed the least important first',
      eli5: 'A fire drill sends every patient into the hall with a new wristband. The nurses suddenly have three times as many names to write. The clerk files the urgent charts first and skips the hallway doodles.',
      body: [
        'A rolling restart gives 50,000 hosts fresh labels. Ingest stays near **1M a second**, but **active series** triple to 30M, and creating series is the costly part. Flushed scrape buffers add a catch-up burst of up to **3M a second**.',
        'The queue absorbs the burst. Then collectors **shed by priority**: tier 1 (alerts, SLOs) is never dropped, tier 3 (debug) is sampled or dropped first.',
      ],
      keyIdea: 'Under overload, drop deliberately by priority. Never let a flood of debug data starve the metrics that page people.',
      metrics: { ingest: '1M, burst 3M', series: '30M active', qp99: '1.4 s', alert: 'pipeline < 60 s', store: '130 GB' },
      metricTones: { ingest: 'warn', series: 'warn', alert: 'good' },
      scene: {
        nodes: [
          { ...srv, status: 'hot', badge: 'rolling restart' },
          { ...col, at: at(-2, 0), status: 'hot', load: 88, chips: [{ text: 'tier 3 sampled 1 in 10', tone: 'warn' }] },
          { ...queue, at: at(2, 0), load: 70, badge: 'lag 40 s' },
          { id: 'writer', kind: 'worker', at: at(6, 0), label: 'writers', sub: 'catching up', load: 90 },
        ],
        links: [link('srv', 'col'), link('col', 'queue', { label: 'burst 3M/s', labelTone: 'warn' }), link('queue', 'writer')],
        flows: [
          { path: ['srv', 'col'], tone: 'data', count: 4, label: 'new series', duration: 1.4 },
          { path: ['col', 'queue'], tone: 'event', count: 2, label: 'tier 1 kept', duration: 1.4, delay: 1.5 },
          { path: ['queue', 'writer'], tone: 'data', duration: 1.6, delay: 3 },
        ],
        panel: {
          title: 'Shedding tiers',
          icon: 'Scale',
          rows: [
            { text: 'Tier 1: alerts, SLOs', value: 'never dropped', tone: 'good' },
            { text: 'Tier 2: dashboards', value: 'delayed', tone: 'warn' },
            { text: 'Tier 3: debug', value: 'sampled or dropped', tone: 'bad' },
          ],
          footer: { text: 'Queue lag is the signal to start shedding', tone: 'muted' },
        },
        caption: 'Absorb the burst, then shed by priority',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Recap: scrape, buffer, store, query, alert, and watch the watcher',
      eli5: 'Nurses do rounds, drop pages in a tray, a clerk files them in copied cabinets, doctors read the right chart, a bell keeper rings one doctor, and a guard in another building listens for the heartbeat.',
      body: [
        'Collectors in hashed, paired slices scrape 50,000 hosts into a queue. Writers shard series across 20 replicated, compressed shards, and rollups keep older data coarse. Caps stop cardinality blowups.',
        'Queries pick a tier and hit a cache. Rule evaluators read a separate recent tier, the alert manager groups and escalates, and an external watchdog guards the pipeline.',
      ],
      keyIdea: 'Separate the paths: collection, storage, dashboards and alerting each get their own capacity, so one cannot starve another.',
      metrics: { ingest: '1M pts/s', series: '10M', qp99: '0.9 s', alert: 'pipeline < 60 s', store: '130 GB' },
      metricTones: { ingest: 'good', qp99: 'good', alert: 'good', store: 'good' },
      scene: {
        nodes: [
          { ...col, at: at(-6, 0), label: 'collectors', sub: '25 pairs' },
          { ...queue, at: at(-2, 0) },
          { ...tsdb, at: at(2, 0), label: 'sharded TSDB', sub: '20 x 3 replicas', status: 'ok' },
          { ...evalr, at: at(5, 3.5), sub: 'recent tier' },
          { ...pager, at: at(8, 3.5) },
        ],
        links: [link('col', 'queue'), link('queue', 'tsdb'), link('queue', 'eval', { style: 'dashed' }), link('eval', 'pager')],
        flows: [
          { path: ['col', 'queue', 'tsdb'], tone: 'data', label: '1M pts/s', duration: 2 },
          { path: ['queue', 'eval', 'pager'], tone: 'event', label: 'page', duration: 2, delay: 2.1 },
        ],
        panel: {
          title: 'Final numbers',
          icon: 'List',
          rows: [
            { text: 'Ingest', value: '1M points/s', tone: 'good' },
            { text: 'Storage per day', value: '130 GB', tone: 'good' },
            { text: 'Dashboard p99', value: '0.9 s', tone: 'good' },
            { text: 'Pipeline latency', value: '< 60 s', tone: 'good' },
          ],
        },
        caption: 'Four separate paths, one pipeline',
      },
      quiz: {
        question: 'Disk use on the metrics store has doubled overnight with no new servers. What should you check first?',
        options: [
          'Whether a new label with many distinct values created a flood of new series',
          'Whether dashboards are refreshing too often',
          'Whether the alert manager has too many silences',
          'Whether collectors are paired',
        ],
        answer: 0,
        explain: 'Storage and index size follow the number of distinct series. A new high-cardinality label (user IDs, request IDs) multiplies series without adding servers, which is why a per-metric cap exists at the collector.',
      },
    },
  ],
};
