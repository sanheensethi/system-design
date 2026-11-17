import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const SZ = 0.8;
const user: SceneNode = { id: 'user', kind: 'phone', at: at(-6.6, -3.5), label: 'shopper' };
const gw: SceneNode = { id: 'gw', kind: 'block', size: SZ, at: at(-3.3, -3.5), label: 'gateway', icon: 'Network', tint: 'gray' };
const orders: SceneNode = { id: 'orders', kind: 'block', size: SZ, at: at(0, -3.5), label: 'orders', icon: 'ShoppingBag', tint: 'amber' };
const pay: SceneNode = { id: 'pay', kind: 'block', size: SZ, at: at(3.3, -3.5), label: 'payments', icon: 'Receipt', tint: 'violet' };
const inv: SceneNode = { id: 'inv', kind: 'block', size: SZ, at: at(6.6, -3.5), label: 'inventory', icon: 'Boxes', tint: 'green' };
const db: SceneNode = { id: 'db', kind: 'db', at: at(6.6, -3.5), label: 'payments DB' };

const dash: SceneNode = { id: 'dash', kind: 'block', size: SZ, at: at(-6.6, 3.5), label: 'dashboard', icon: 'Activity', tint: 'green' };
const logs: SceneNode = { id: 'logs', kind: 'block', size: SZ, at: at(-3.3, 3.5), label: 'log store', icon: 'FileText', tint: 'blue' };
const metrics: SceneNode = { id: 'metrics', kind: 'block', size: SZ, at: at(0, 3.5), label: 'metrics', icon: 'Gauge', tint: 'teal' };
const traces: SceneNode = { id: 'traces', kind: 'block', size: SZ, at: at(3.3, 3.5), label: 'trace store', icon: 'Route', tint: 'violet' };
const oncall: SceneNode = { id: 'oncall', kind: 'user', at: at(6.6, 3.5), label: 'on-call' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

export const observability: Lesson = {
  id: 'observability',
  title: 'Observability: logs, metrics, traces',
  tagline: 'Make a running system explain itself, so a slow request points to its own cause.',
  minutes: 15,
  level: 'Intermediate',
  learn: [
    'Why plain text logs on each server fail once a request crosses services',
    'Structured logs, log levels, shipping pipelines and what logging costs',
    'Counters, gauges, histograms, percentiles, cardinality and the four golden signals',
    'How a trace id and span ids follow one request across services, and how sampling and OpenTelemetry fit',
    'Dashboards, health checks and synthetic probes',
    'SLOs, error budgets, burn-rate alerts, alert fatigue and on-call practice',
  ],
  metrics: [
    { key: 'p99', label: 'Checkout p99', icon: 'Timer' },
    { key: 'find', label: 'Time to find cause', icon: 'Search' },
    { key: 'pages', label: 'Pages per week', icon: 'Signal' },
    { key: 'signals', label: 'Signals', icon: 'Activity' },
  ],
  steps: [
    {
      title: 'No clues',
      tag: 'problem',
      heading: 'Checkout is slow and nothing says why',
      eli5: 'A parcel is very late. The post office has four sorting rooms, and no room wrote down when the parcel came in or went out. Nobody can tell which room held it up.',
      body: [
        'Support forwards a complaint: checkout takes 4 seconds. The request crosses a gateway and three services, each on a dozen machines. An engineer logs in to machines one by one and searches text files for the customer email.',
        'Formats differ, clocks drift by hundreds of milliseconds, and nothing ties a payments line to the order that caused it. **Observability** is the ability to answer new questions about a running system from the data it emits.',
      ],
      keyIdea: 'If the only way to learn what production is doing is to log in and search files, every incident starts from zero.',
      metrics: { p99: '4.2 s', find: '3 hours+', pages: '140', signals: 'text logs' },
      metricTones: { p99: 'bad', find: 'bad', pages: 'bad' },
      scene: {
        nodes: [
          { ...user, status: 'hot', badge: '4.2 s' },
          gw,
          { ...orders, badge: '?' },
          { ...pay, badge: '?' },
          { ...inv, badge: '?' },
        ],
        links: [link('user', 'gw'), link('gw', 'orders'), link('orders', 'pay'), link('pay', 'inv')],
        flows: [
          { path: ['user', 'gw', 'orders', 'pay', 'inv'], tone: 'request', label: 'POST /checkout', duration: 3 },
          { path: ['inv', 'pay', 'orders', 'gw', 'user'], tone: 'response', label: 'slow', duration: 3, delay: 3.1 },
        ],
        panel: {
          title: 'Finding the cause by hand',
          icon: 'Search',
          rows: [
            { text: 'Machines to search', value: '36', tone: 'bad' },
            { text: 'Log formats', value: '3', tone: 'warn' },
            { text: 'Clock drift', value: '~300 ms', tone: 'warn' },
            { text: 'Link between services', value: 'none', tone: 'bad' },
          ],
          footer: { text: 'Three hours later, still a guess', tone: 'bad' },
        },
        caption: 'Four hops, and no record of where the time went',
      },
    },
    {
      title: 'Three signals',
      tag: 'concept',
      heading: 'Logs, metrics and traces answer different questions',
      eli5: 'The post office keeps three things. A **metrics** board with counters, a **trace store** with a stamp card for each parcel, and a **log store** cabinet with a form for every event.',
      body: [
        '**Metrics** say that something is wrong and since when. **Traces** say where in the request path the time went. **Logs** say what happened in detail. Each is cheap or costly in a different way.',
        '**Monitoring** checks questions you thought of in advance, such as CPU above 80%. Observability means the data is rich enough to answer a question you did not predict.',
      ],
      keyIdea: 'Metrics detect, traces locate, logs explain. You need all three, and they must link to each other.',
      metrics: { p99: '4.2 s', find: '3 hours+', pages: '140', signals: 'logs + metrics + traces' },
      metricTones: { p99: 'bad', find: 'bad', pages: 'bad' },
      scene: {
        nodes: [
          { ...pay, status: 'hot', badge: 'p99 3.9 s' },
          { ...logs, chips: ['what happened'] },
          { ...metrics, chips: ['is it wrong, since when'] },
          { ...traces, chips: ['where the time went'] },
        ],
        links: [link('pay', 'logs', { style: 'dashed' }), link('pay', 'metrics', { style: 'dashed' }), link('pay', 'traces', { style: 'dashed' })],
        flows: [
          { path: ['pay', 'logs'], tone: 'event', duration: 1.4 },
          { path: ['pay', 'metrics'], tone: 'data', duration: 1.4, delay: 0.5 },
          { path: ['pay', 'traces'], tone: 'event', duration: 1.4, delay: 1 },
        ],
        panel: {
          title: 'The three signals',
          icon: 'Layers',
          rows: [
            { text: 'Metrics', value: 'cheap, aggregated', tone: 'good' },
            { text: 'Traces', value: 'per request, sampled', tone: 'default' },
            { text: 'Logs', value: 'detailed, most costly', tone: 'warn' },
          ],
        },
        caption: 'Three views of the same service',
      },
    },
    {
      title: 'Structured logs',
      tag: 'concept',
      heading: 'Logs: one event, one machine-readable record',
      eli5: 'Every sorting room now fills in the same form for each parcel: time, room, parcel number, what happened. All forms go into one big cabinet, the **log store**, so you can look up any parcel in seconds.',
      body: [
        'A **log** is a record of one event. Make each record **structured**: a JSON object with named fields instead of a sentence. `"order_id": 9917` can be filtered and counted. "order 9917 took a while" can only be read.',
        'Every line carries the same core fields: timestamp, service, level, a request or trace id, and the fields of the event.',
      ],
      keyIdea: 'Write logs as structured events with shared field names, so a query can filter and count them.',
      metrics: { p99: '4.2 s', find: '1 hour', pages: '140', signals: 'logs' },
      metricTones: { p99: 'bad', find: 'warn', pages: 'bad' },
      scene: {
        nodes: [{ ...pay, status: 'active', chips: ['charge_completed'] }, { ...logs, status: 'ok' }],
        links: [link('pay', 'logs', { style: 'dashed', label: 'JSON lines' })],
        flows: [{ path: ['pay', 'logs'], tone: 'event', label: '{json}', duration: 1.6 }],
        panel: {
          title: 'Same event, two shapes',
          icon: 'FileJson',
          code: 'text:  order 9917 took a while\n\njson:  {"event": "charge_completed",\n        "order_id": 9917,\n        "duration_ms": 3870}',
          footer: { text: 'Only the second can be filtered and counted', tone: 'good' },
        },
        caption: 'Every service writes the same shape of record',
      },
      code: {
        language: 'python',
        title: 'A structured log line',
        source: `import json, sys, time

def log(level, event, **fields):
    record = {
        "ts": time.time(),
        "level": level,
        "service": "payments",
        "event": event,
        **fields,
    }
    sys.stdout.write(json.dumps(record) + "\\n")   # an agent ships stdout

log("info", "charge_completed",
    trace_id=ctx.trace_id,        # ties this line to one request
    order_id=9917,
    amount_cents=4200,
    duration_ms=3870)

# {"ts": 1767000000.2, "level": "info", "service": "payments",
#  "event": "charge_completed", "trace_id": "4bf9...", "duration_ms": 3870}`,
        highlight: [4, 11, 14, 17],
      },
    },
    {
      title: 'Log levels',
      tag: 'concept',
      heading: 'Levels and a request id on every line',
      eli5: 'Each form has a box for how serious the event was. The mail room only files the serious ones by default, and every form carries the parcel number so you can pull out all forms for one parcel.',
      body: [
        'Each line has a **level**. `debug` is off in production by default, `info` records normal events, `warn` marks something recoverable and `error` marks a failed operation.',
        'Put the request or trace id in every line, at every level, so one search pulls up one request across all services.',
      ],
      keyIdea: 'Pick levels on purpose, and tag every line with a request id.',
      metrics: { p99: '4.2 s', find: '1 hour', pages: '140', signals: 'logs' },
      metricTones: { p99: 'bad', find: 'warn', pages: 'bad' },
      scene: {
        nodes: [
          { ...pay, status: 'active', chips: [{ text: 'info charge_completed', tone: 'good' }, { text: 'warn pool_wait', tone: 'warn' }, { text: 'trace_id=4bf9', tone: 'good' }] },
          { ...logs, status: 'ok' },
        ],
        links: [link('pay', 'logs', { style: 'dashed', label: 'level + trace_id' })],
        flows: [{ path: ['pay', 'logs'], tone: 'event', label: 'trace_id=4bf9', duration: 1.4 }],
        panel: {
          title: 'Levels in production',
          icon: 'List',
          rows: [
            { text: 'debug', value: 'off by default', tone: 'muted' },
            { text: 'info', value: 'charge_completed' },
            { text: 'warn', value: 'pool_wait, retry', tone: 'warn' },
            { text: 'error', value: 'charge_failed', tone: 'bad' },
          ],
          footer: { text: 'Every level carries trace_id', tone: 'muted' },
        },
        caption: 'One id on every line ties them to one request',
      },
    },
    {
      title: 'Redaction',
      tag: 'concept',
      heading: 'Never log secrets: redact in the logger',
      eli5: 'Before a clerk files a form, they black out anyone\'s secret codes with a marker. The blacking out happens at the clerk\'s desk, so the secret never reaches the cabinet.',
      body: [
        'Never log passwords, card numbers or tokens. A log store has many more readers than a database, and it keeps lines for months.',
        'Redact in the logger, inside the service, before the line leaves the process. Mask known field names and card-shaped values, so a mistake in one call site is still caught.',
      ],
      keyIdea: 'Scrub secrets inside the process that writes the line, so they never reach the log store.',
      metrics: { p99: '4.2 s', find: '1 hour', pages: '140', signals: 'logs' },
      metricTones: { p99: 'bad', find: 'warn', pages: 'bad' },
      scene: {
        nodes: [
          { ...pay, status: 'active', chips: [{ text: 'redaction in the logger', tone: 'good' }, 'card=4111 1111...'] },
          { ...logs, status: 'ok', chips: [{ text: 'card=****', tone: 'good' }] },
        ],
        links: [link('pay', 'logs', { style: 'dashed', label: 'already redacted' })],
        flows: [{ path: ['pay', 'logs'], tone: 'event', label: 'card=****', duration: 1.4 }],
        panel: {
          title: 'Raw line and stored line',
          icon: 'Shield',
          code: 'raw:    {"event": "charge", "card": "4111 1111 1111 1111",\n         "token": "sk_live_91ab"}\n\nstored: {"event": "charge", "card": "****",\n         "token": "****"}',
          footer: { text: 'The raw line never leaves the process', tone: 'good' },
        },
        caption: 'Secrets are removed before the line is shipped',
      },
    },
    {
      title: 'Log pipeline',
      tag: 'concept',
      heading: 'Shipping logs to one searchable place',
      eli5: 'A mail cart collects the forms from each sorting room and wheels them to the cabinet. A holding tray sits between, so a rush of forms never makes a room stop work.',
      body: [
        'An agent on each machine tails the process output and ships lines to a central **log store**, where one query searches every service at once. A **buffer** such as a queue sits in between, so a burst or a slow store does not block services or lose lines.',
        'At 2,000 requests per second with five lines each, that is 10,000 lines per second.',
      ],
      keyIdea: 'Ship logs off the machine through a buffer into one store, so one query covers every service.',
      metrics: { p99: '4.2 s', find: '1 hour', pages: '140', signals: 'logs' },
      metricTones: { p99: 'bad', find: 'warn', pages: 'bad' },
      scene: {
        nodes: [
          { ...pay, chips: ['agent tails stdout'] },
          { id: 'buffer', kind: 'queue', at: at(0, 0), label: 'buffer', status: 'active' },
          { ...logs, status: 'ok', badge: '10,000 lines/s' },
        ],
        links: [link('pay', 'buffer', { style: 'dashed', label: 'agent ships' }), link('buffer', 'logs', { style: 'dashed', label: 'indexes' })],
        flows: [
          { path: ['pay', 'buffer'], tone: 'event', count: 3, duration: 1.4 },
          { path: ['buffer', 'logs'], tone: 'event', count: 3, duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Log volume',
          icon: 'Table',
          rows: [
            { text: 'Requests per second', value: '2,000' },
            { text: 'Lines per request', value: '5' },
            { text: 'Lines per second', value: '10,000', tone: 'warn' },
          ],
        },
        caption: 'A buffer absorbs bursts between services and the store',
      },
    },
    {
      title: 'Log cost',
      tag: 'tradeoff',
      heading: 'Logs are the most detailed signal and the most expensive',
      eli5: 'Every form takes paper and cabinet space. The post office keeps the last week in the fast cabinet and moves older forms to a cheap basement, because full detail forever costs too much.',
      body: [
        'At about 300 bytes a line, 10,000 lines per second is roughly 260 GB a day. Keep recent days in a fast, indexed store and move older logs to cheap object storage for the retention you need, such as 7 days hot and 90 days cold.',
        'Log what you would need in an incident, sample noisy repeats, and keep debug off. More detail is useful, and every line you keep has a price.',
      ],
      keyIdea: 'Logs are priced by volume. Decide what to log, how long to keep it hot, and when to archive.',
      metrics: { p99: '4.2 s', find: '1 hour', pages: '140', signals: 'logs' },
      metricTones: { p99: 'bad', find: 'warn', pages: 'bad' },
      scene: {
        nodes: [
          { ...logs, status: 'hot', load: 88, badge: '260 GB/day' },
          { id: 'cold', kind: 'storage', at: at(0, 3.5), label: 'cold archive', status: 'ok', badge: '90 days' },
          { ...pay, chips: ['10,000 lines/s'] },
        ],
        links: [link('pay', 'logs', { style: 'dashed' }), link('logs', 'cold', { label: 'after 7 days' })],
        flows: [
          { path: ['pay', 'logs'], tone: 'event', count: 3, duration: 1.4 },
          { path: ['logs', 'cold'], tone: 'data', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Retention tiers',
          icon: 'Database',
          rows: [
            { text: 'Hot, indexed', value: '7 days', tone: 'warn' },
            { text: 'Cold, object storage', value: '90 days', tone: 'good' },
            { text: 'Debug level', value: 'off', tone: 'muted' },
          ],
          footer: { text: '10,000 lines/s × 300 B ≈ 260 GB a day', tone: 'muted' },
        },
        caption: 'Fast and costly for a week, cheap after that',
      },
    },
    {
      title: 'Metrics',
      tag: 'concept',
      heading: 'Metrics: cheap numbers over time',
      eli5: 'Each sorting room has a counter on the wall that clicks for every parcel and a clock that times each one. The **metrics** board reads all the counters every few seconds, so you can see a room slowing down.',
      body: [
        'A **metric** is a number sampled over time, with a few labels such as service and route. A **counter** only goes up, a **gauge** goes up and down, and a **histogram** counts observations into buckets.',
        'Metrics are cheap because they aggregate. A million requests cost the same few numbers as ten, so you can keep them for months. You read a counter as a rate, the increase per second over a window, written `rate(x[5m])`. The price is detail: a metric says p99 tripled at 14:05, not which request or why.',
      ],
      keyIdea: 'Metrics answer "is something wrong, and since when" for almost no cost. They do not answer "why".',
      metrics: { p99: '4.2 s', find: '1 hour', pages: '140', signals: 'logs + metrics' },
      metricTones: { p99: 'bad', find: 'warn', pages: 'bad' },
      scene: {
        nodes: [
          { ...orders, badge: 'p99 4.1 s' },
          { ...pay, status: 'hot', badge: 'p99 3.9 s' },
          { ...inv, badge: 'p99 40 ms' },
          { ...metrics, status: 'active' },
        ],
        links: [link('orders', 'metrics', { style: 'dashed' }), link('pay', 'metrics', { style: 'dashed' }), link('inv', 'metrics', { style: 'dashed' })],
        flows: [
          { path: ['orders', 'metrics'], tone: 'data', duration: 1.2 },
          { path: ['pay', 'metrics'], tone: 'data', label: 'counters, histograms', duration: 1.2, delay: 0.3 },
          { path: ['inv', 'metrics'], tone: 'data', duration: 1.2, delay: 0.6 },
        ],
        panel: {
          title: 'Three metric types',
          icon: 'Gauge',
          rows: [
            { text: 'Counter', value: 'requests, errors' },
            { text: 'Gauge', value: 'queue depth, memory' },
            { text: 'Histogram', value: 'latency buckets' },
          ],
          footer: { text: 'Per-service latency narrows the search to payments', tone: 'muted' },
        },
        caption: 'Per-service latency narrows the search',
      },
    },
    {
      title: 'Scrape or push',
      tag: 'concept',
      heading: 'How metrics reach the store',
      eli5: 'Every 15 seconds the board clerk walks to each sorting room and reads its wall counter. A room that is closed has no counter to read, so the clerk notices at once.',
      body: [
        'Each service exposes its current values at `/metrics`. The metrics server **scrapes** (pulls) every 15 seconds and stores each sample with labels and a timestamp. A dead target shows up immediately because its scrape fails.',
        'Short-lived jobs cannot wait to be scraped, so they **push** to a gateway before exiting. Counters and histograms keep their totals between scrapes, so nothing is lost, but resolution is 15 s. A gauge that spikes and falls back between two scrapes is never seen.',
      ],
      keyIdea: 'Pulling every 15 seconds makes dead targets visible. Short jobs push, and a gauge spike between two scrapes is never seen.',
      metrics: { p99: '4.2 s', find: '1 hour', pages: '140', signals: 'logs + metrics' },
      metricTones: { p99: 'bad', find: 'warn', pages: 'bad' },
      scene: {
        nodes: [{ ...pay, chips: ['GET /metrics'] }, { ...metrics, status: 'active', badge: 'scrape every 15 s' }],
        links: [link('metrics', 'pay', { arrow: 'both', label: 'pull, 15 s' })],
        flows: [
          { path: ['metrics', 'pay'], tone: 'request', label: 'GET /metrics', duration: 1.4 },
          { path: ['pay', 'metrics'], tone: 'response', label: 'samples', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'What /metrics returns',
          icon: 'Code',
          code: 'http_requests_total{route="/checkout",code="200"} 184233\nhttp_requests_total{route="/checkout",code="500"} 91\npool_in_use{service="payments"} 20\nlatency_bucket{le="0.25"} 181004',
          footer: { text: 'One text line per series and value', tone: 'muted' },
        },
        caption: 'The store comes to the service',
      },
    },
    {
      title: 'Metric storage',
      tag: 'concept',
      heading: 'A time-series database keeps months of metrics cheaply',
      eli5: 'The board clerk copies every counter reading onto a long roll of paper. Old rolls are squeezed into one line per five minutes, so a whole year fits on a small shelf.',
      body: [
        'Samples go into a **time-series database** (TSDB), built for appending timestamped numbers and reading ranges. Raw 15 s samples are kept for 15 days.',
        'Older data is **downsampled** into 5 minute **rollups** (min, max, average, sum) and kept for a year. That is how months of history stay affordable. A rollup cannot show a spike shorter than 5 minutes.',
      ],
      keyIdea: 'Keep raw samples briefly and rollups for a long time. Resolution drops as data ages.',
      metrics: { p99: '4.2 s', find: '1 hour', pages: '140', signals: 'logs + metrics' },
      metricTones: { p99: 'bad', find: 'warn', pages: 'bad' },
      scene: {
        nodes: [
          { ...metrics, status: 'active', chips: ['raw 15 s samples'] },
          { id: 'tsdb', kind: 'db', at: at(3.3, 3.5), label: 'TSDB', status: 'ok', badge: 'raw 15 d, rollups 1 y' },
        ],
        links: [link('metrics', 'tsdb', { label: 'append, then roll up' })],
        flows: [{ path: ['metrics', 'tsdb'], tone: 'data', count: 3, duration: 1.4 }],
        panel: {
          title: 'Resolution versus retention',
          icon: 'Table',
          rows: [
            { text: 'Raw samples, 15 s', value: '15 days', tone: 'warn' },
            { text: 'Rollups, 5 min', value: '1 year', tone: 'good' },
            { text: 'Short spikes', value: 'visible only in raw', tone: 'muted' },
          ],
        },
        caption: 'Fine detail for days, coarse history for a year',
      },
    },
    {
      title: 'Percentiles',
      tag: 'concept',
      heading: 'Watch percentiles, since averages hide the pain',
      eli5: 'If most parcels arrive in a day and a few take a month, saying "about two days on average" sounds fine. The few late ones are the families who complain.',
      body: [
        'A histogram lets the store estimate **percentiles**: p50 is the median and p99 is the time 99% of requests beat.',
        'If 98% of checkouts take 200 ms and 2% take 4 seconds, the average is 276 ms and looks healthy, while 1 shopper in 50 waits four seconds. Never average per-instance p99 values. Merge the histogram buckets, then compute the percentile.',
      ],
      keyIdea: 'Averages flatter you. Alert and graph on p95 or p99.',
      metrics: { p99: '4.2 s', find: '1 hour', pages: '140', signals: 'logs + metrics' },
      metricTones: { p99: 'bad', find: 'warn', pages: 'bad' },
      scene: {
        nodes: [{ ...orders, chips: [{ text: 'p50 200 ms', tone: 'good' }, { text: 'p99 4 s', tone: 'bad' }] }, { ...metrics, status: 'active' }],
        links: [link('orders', 'metrics', { style: 'dashed' })],
        flows: [{ path: ['orders', 'metrics'], tone: 'data', label: 'latency histogram', duration: 1.4 }],
        panel: {
          title: 'One day of checkouts',
          icon: 'Timer',
          rows: [
            { text: '98% of requests', value: '200 ms', tone: 'good' },
            { text: '2% of requests', value: '4,000 ms', tone: 'bad' },
            { text: 'Average', value: '276 ms (looks fine)', tone: 'warn' },
            { text: 'p99', value: '4,000 ms', tone: 'bad' },
          ],
        },
        caption: 'The average hides the slow tail',
      },
    },
    {
      title: 'Cardinality',
      tag: 'tradeoff',
      heading: 'Keep label values bounded',
      eli5: 'The wall counter gets one tally mark per kind of parcel. If you also give every single customer their own counter, the wall fills up and the board clerk cannot read them all.',
      body: [
        'Every distinct combination of label values is its own **series**, stored and indexed forever. 20 routes, 5 status codes and 3 services make 300 series. That is **cardinality**.',
        'Add a `user_id` label with 2 million users and it becomes 600 million series, enough to take the metrics system down. Put ids in logs and traces, not in labels.',
      ],
      keyIdea: 'Labels need a small, fixed set of values. Unbounded ids belong in logs and traces.',
      metrics: { p99: '4.2 s', find: '1 hour', pages: '140', signals: 'logs + metrics' },
      metricTones: { p99: 'bad', find: 'warn', pages: 'bad' },
      scene: {
        nodes: [
          { ...pay, chips: [{ text: 'user_id="u-1783920"', tone: 'bad' }] },
          { ...metrics, status: 'hot', load: 96, badge: '600M series' },
        ],
        links: [link('pay', 'metrics', { style: 'dashed', label: 'one series per user', labelTone: 'warn' })],
        flows: [{ path: ['pay', 'metrics'], tone: 'error', count: 4, duration: 1.4 }],
        panel: {
          title: 'Series count',
          icon: 'Table',
          rows: [
            { text: '20 routes × 5 codes × 3 services', value: '300', tone: 'good' },
            { text: '... × 2,000,000 user ids', value: '600,000,000', tone: 'bad' },
          ],
          footer: { text: 'Ids belong in logs and traces', tone: 'warn' },
        },
        caption: 'One unbounded label can break the store',
      },
    },
    {
      title: 'Golden signals',
      tag: 'concept',
      heading: 'Four numbers to watch on every service',
      eli5: 'For every sorting room, the **metrics** board shows four things: how long parcels take, how many arrive, how many get lost, and how full the shelves are. Those four tell you if a room is in trouble.',
      body: [
        '**Latency** is request time as percentiles, with failures tracked separately. **Traffic** is demand, such as requests per second. **Errors** is the share that fail. **Saturation** is how full the tightest resource is: CPU, memory, a connection pool or a queue.',
        'Saturation is the early warning. Latency stays flat while a pool goes from 50% to 90% used, then climbs once requests wait for a slot. Teams also use **RED** (rate, errors, duration) per service and **USE** (utilization, saturation, errors) per resource.',
      ],
      keyIdea: 'Latency, traffic, errors and saturation, per service. If you can only build one dashboard, build that one.',
      metrics: { p99: '4.2 s', find: '40 min', pages: '140', signals: 'logs + metrics' },
      metricTones: { p99: 'bad', find: 'warn', pages: 'bad' },
      scene: {
        nodes: [
          { ...pay, status: 'hot', load: 100, badge: 'pool 20/20' },
          { ...metrics, status: 'ok' },
          { ...dash, status: 'active', badge: '4 signals' },
        ],
        links: [link('pay', 'metrics', { style: 'dashed' }), link('metrics', 'dash')],
        flows: [
          { path: ['pay', 'metrics'], tone: 'data', label: 'saturation 100%', duration: 1.3 },
          { path: ['metrics', 'dash'], tone: 'response', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'Payments right now',
          icon: 'Activity',
          rows: [
            { text: 'Latency p99', value: '3.9 s', tone: 'bad' },
            { text: 'Traffic', value: '2,000 req/s', tone: 'good' },
            { text: 'Errors', value: '0.3%', tone: 'good' },
            { text: 'Saturation', value: 'pool 20 of 20', tone: 'bad' },
          ],
        },
        caption: 'Traffic is normal, errors are low, saturation is at the limit',
      },
      quiz: {
        question: 'Checkout traffic and error rate look normal, p50 latency is 180 ms, and p99 is 4 s. What should you conclude?',
        options: [
          'The system is healthy, because the median is fast',
          'A small share of requests is very slow, so look for a resource they are waiting on',
          'The metrics system is broken, since p50 and p99 disagree',
          'Traffic must be too high',
        ],
        answer: 1,
        explain: 'A fast median with a slow tail means most requests are fine and a few are stuck, often queuing for a saturated resource such as a connection pool or a lock. Averages and medians hide that tail.',
      },
    },
    {
      title: 'Traces',
      tag: 'concept',
      heading: 'Traces: one id that follows the request',
      eli5: 'The front desk sticks a tracking number on each parcel. Every sorting room stamps its time in and time out next to that number, and the stamps are kept in the **trace store**.',
      body: [
        'A **trace** is the record of one request across every service it touched. The first service creates a random **trace id**. Each unit of work inside is a **span** with its own **span id**, a start time, a duration and its parent span id.',
        'The **trace store** joins finished spans by trace id into a tree, one timeline per request.',
      ],
      keyIdea: 'A trace id created at the edge turns scattered events into one timeline.',
      metrics: { p99: '4.2 s', find: '40 min', pages: '140', signals: 'logs + metrics + traces' },
      metricTones: { p99: 'bad', find: 'warn', pages: 'bad' },
      scene: {
        nodes: [
          { ...gw, status: 'active', badge: 'new trace 4bf9' },
          { ...orders, badge: 'span a1' },
          { ...pay, badge: 'span b2' },
          { ...traces, status: 'ok' },
        ],
        links: [link('gw', 'orders'), link('orders', 'pay'), link('orders', 'traces', { style: 'dashed' }), link('pay', 'traces', { style: 'dashed' })],
        flows: [
          { path: ['gw', 'orders', 'pay'], tone: 'request', label: 'trace 4bf9', duration: 1.8 },
          { path: ['orders', 'traces'], tone: 'event', label: 'spans', duration: 1.2, delay: 1.9 },
          { path: ['pay', 'traces'], tone: 'event', duration: 1.2, delay: 2.1 },
        ],
        panel: {
          title: 'Trace 4bf9, as a tree',
          icon: 'Route',
          rows: [
            { text: 'a1 orders', value: 'parent: gateway' },
            { text: 'b2 payments', value: 'parent: a1' },
            { text: 'c3 inventory', value: 'parent: b2' },
          ],
          footer: { text: 'Same trace id, a new span id per hop', tone: 'muted' },
        },
        caption: 'Same trace id on every hop',
      },
    },
    {
      title: 'Propagation',
      tag: 'concept',
      heading: 'Context propagation: passing the id on',
      eli5: 'Each sorting room must copy the tracking number onto the next envelope it makes. If one room forgets, the parcel loses its number and the trail stops there.',
      body: [
        'On every outgoing call the caller adds a header, the W3C standard `traceparent`, carrying the trace id and its own span id. The callee reads it, starts a child span, and passes the same trace id onward.',
        'This is **context propagation**. One service that drops the header cuts the trace in two.',
      ],
      keyIdea: 'Every hop must forward the trace header, or the timeline breaks at that hop.',
      metrics: { p99: '4.2 s', find: '40 min', pages: '140', signals: 'logs + metrics + traces' },
      metricTones: { p99: 'bad', find: 'warn', pages: 'bad' },
      scene: {
        nodes: [{ ...orders, chips: ['span a1'] }, { ...pay, chips: ['span b2'] }, { ...inv, chips: [{ text: 'header dropped', tone: 'warn' }] }],
        links: [link('orders', 'pay', { label: 'traceparent' }), link('pay', 'inv', { label: 'no header', labelTone: 'warn' })],
        flows: [
          { path: ['orders', 'pay'], tone: 'request', label: '00-4bf9-a1-01', duration: 1.4 },
          { path: ['pay', 'inv'], tone: 'error', label: 'trace cut', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'The header',
          icon: 'Code',
          code: 'traceparent: 00-4bf9...-a1-01\n             |   |       |  |\n             |   trace  parent flags\n             version     span',
        },
        caption: 'A dropped header splits the trace',
      },
      code: {
        language: 'python',
        title: 'Propagating trace context by hand',
        source: `import secrets, time

def handle(request):
    # traceparent: version-traceid-parentspanid-flags
    header = request.headers.get("traceparent")
    if header:
        _, trace_id, parent_id, _ = header.split("-")
    else:
        trace_id, parent_id = secrets.token_hex(16), None   # start a trace

    span_id = secrets.token_hex(8)
    start = time.time()
    try:
        # pass the SAME trace id, and OUR span id as the parent
        return http.post("http://payments/charge", json=request.body,
            headers={"traceparent": f"00-{trace_id}-{span_id}-01"})
    finally:
        export_span(trace_id, span_id, parent_id, name="orders.checkout",
                    start=start, duration=time.time() - start)

# In practice an OpenTelemetry SDK does this for you.`,
        highlight: [7, 9, 11, 16, 18],
      },
    },
    {
      title: 'Sampling',
      tag: 'tradeoff',
      heading: 'Sampling: keep the traces that matter',
      eli5: 'Stamping and storing every parcel card costs a lot. So the office keeps one card in a hundred, plus every card for a parcel that was late or lost.',
      body: [
        'Recording every request is costly, so systems **sample**. **Head sampling** decides at the start: keep 1% at random. It is cheap but can miss the rare slow or failed request.',
        '**Tail sampling** decides after the trace finishes, so a collector keeps every slow or failed trace plus 1% of the rest. It must buffer whole traces first.',
      ],
      keyIdea: 'Head sampling is cheap and blind. Tail sampling costs memory and keeps the traces you will want.',
      metrics: { p99: '4.2 s', find: '40 min', pages: '140', signals: 'logs + metrics + traces' },
      metricTones: { p99: 'bad', find: 'warn', pages: 'bad' },
      scene: {
        nodes: [
          { ...gw, chips: ['2,000 traces/s'] },
          { id: 'sampler', kind: 'block', size: SZ, at: at(0, 0), label: 'collector', icon: 'Layers', tint: 'amber', status: 'active', badge: 'tail sampling' },
          { ...traces, status: 'ok', badge: '~3% kept (60/s)' },
        ],
        links: [link('gw', 'sampler', { style: 'dashed', label: 'all spans' }), link('sampler', 'traces', { style: 'dashed', label: 'kept' })],
        flows: [
          { path: ['gw', 'sampler'], tone: 'event', count: 4, duration: 1.4 },
          { path: ['sampler', 'traces'], tone: 'event', label: 'slow + errors', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Keep rules',
          icon: 'Scale',
          rows: [
            { text: 'Failed traces', value: '100%', tone: 'good' },
            { text: 'Slower than 1 s', value: '100%', tone: 'good' },
            { text: 'Everything else', value: '1%', tone: 'muted' },
          ],
          footer: { text: 'About 2% slow or failed + 1% of the rest = 3%, 60 of 2,000 a second', tone: 'muted' },
        },
        caption: 'Decide after the trace is complete',
      },
      quiz: {
        question: 'You must always keep traces of failed or very slow requests. Which sampling fits?',
        options: [
          'Head sampling at 1%, since it is random and fair',
          'Tail sampling, which decides once the whole trace is known',
          'No sampling, so every trace is kept in memory forever',
          'Sampling only the logs',
        ],
        answer: 1,
        explain: 'Head sampling decides before the outcome is known, so it drops most slow and failed traces along with the rest. Tail sampling waits for the whole trace and can keep the interesting ones.',
      },
    },
    {
      title: 'OpenTelemetry',
      tag: 'concept',
      heading: 'OpenTelemetry: one standard for all three signals',
      eli5: 'All sorting rooms use the same forms and the same mail cart, so the post office can change which cabinet it files them in without retraining any room.',
      body: [
        '**OpenTelemetry** (OTel) is the open standard for producing logs, metrics and traces. A library in each service creates them with a shared trace id and ships them over one protocol, **OTLP**.',
        'A **collector** receives, batches, labels and samples the data, then forwards it to any backend. Switching vendors changes collector config, not application code.',
      ],
      keyIdea: 'Instrument once with OpenTelemetry, and route the data wherever you like through a collector.',
      metrics: { p99: '4.2 s', find: '40 min', pages: '140', signals: 'logs + metrics + traces' },
      metricTones: { p99: 'bad', find: 'warn', pages: 'bad' },
      scene: {
        nodes: [
          { ...pay, chips: ['OTel SDK'] },
          { id: 'collector', kind: 'block', size: SZ, at: at(0, -1.2), label: 'collector', icon: 'Share2', tint: 'amber', status: 'active' },
          logs,
          metrics,
          traces,
        ],
        links: [
          link('pay', 'collector', { label: 'OTLP' }),
          link('collector', 'logs', { style: 'dashed' }),
          link('collector', 'metrics', { style: 'dashed' }),
          link('collector', 'traces', { style: 'dashed' }),
        ],
        flows: [
          { path: ['pay', 'collector'], tone: 'event', label: 'OTLP', duration: 1.3 },
          { path: ['collector', 'logs'], tone: 'event', duration: 1.2, delay: 1.4 },
          { path: ['collector', 'metrics'], tone: 'data', duration: 1.2, delay: 1.4 },
          { path: ['collector', 'traces'], tone: 'event', duration: 1.2, delay: 1.4 },
        ],
        caption: 'One format in, any backend out',
      },
    },
    {
      title: 'Read a trace',
      tag: 'case',
      heading: 'Case: the trace shows where 4 seconds went',
      eli5: 'We look up the late parcel by its tracking number in the **trace store**. The stamps show it sat in the payments room for almost four seconds, waiting for a free helper.',
      body: [
        'Open one slow checkout in the trace viewer. The root span at the gateway lasts 4,200 ms. Under it, orders takes 4,150 ms, and nearly all of that is one child: `payments.charge` at **3,900 ms**. Inventory takes 40 ms. Gateway and inventory are cleared at a glance: the time sits inside payments.',
        'Inside the payments span the database query runs for 12 ms. The other 3,840 ms is a span named `pool.acquire`: the request waited for a free database connection.',
      ],
      keyIdea: 'A trace turns "checkout is slow" into "this span, in this service, waited on this resource".',
      metrics: { p99: '4.2 s', find: '10 min', pages: '140', signals: 'logs + metrics + traces' },
      metricTones: { p99: 'bad', find: 'good', pages: 'bad' },
      scene: {
        nodes: [
          { ...gw, badge: '4,200 ms' },
          { ...orders, badge: '4,150 ms' },
          { ...pay, status: 'hot', badge: 'pool wait 3,840 ms' },
          { ...traces, status: 'active' },
        ],
        links: [link('gw', 'orders'), link('orders', 'pay'), link('pay', 'traces', { style: 'dashed' })],
        flows: [
          { path: ['gw', 'orders', 'pay'], tone: 'request', duration: 1.6 },
          { path: ['pay', 'traces'], tone: 'error', label: 'slow span', duration: 1.2, delay: 1.7 },
        ],
        panel: {
          title: 'Spans for trace 4bf9',
          icon: 'Route',
          rows: [
            { text: 'gateway', value: '4,200 ms' },
            { text: 'orders', value: '4,150 ms' },
            { text: 'payments.charge', value: '3,900 ms', tone: 'bad' },
            { text: 'pool.acquire', value: '3,840 ms', tone: 'bad' },
            { text: 'db query', value: '12 ms', tone: 'good' },
            { text: 'inventory', value: '40 ms', tone: 'good' },
          ],
        },
        caption: 'The time is in one span: waiting 3,840 ms for a connection',
      },
    },
    {
      title: 'Find the cause',
      tag: 'case',
      heading: 'Case: logs explain why the pool was empty',
      eli5: 'The stamp card says "waited for a helper". The trace number also opens the right forms in the cabinet, and they show an hourly job, started by the 14:05 release, that had grabbed most of the helpers.',
      body: [
        'The trace id is in every log line, so one search in the log store pulls up this request and its neighbors. They show a reconciliation job, which v212 started running every hour, holding 17 of payments\' 20 database connections.',
        'The fix is to cap the job at 5 connections and raise the pool from 20 to 40, which takes checkout p99 from 4.2 s to 300 ms. Metrics showed when, the trace showed where, and logs showed why.',
      ],
      keyIdea: 'Follow the trace id from the slow span into the logs to find the reason, not just the location.',
      metrics: { p99: '300 ms', find: '5 min', pages: '140', signals: 'logs + metrics + traces' },
      metricTones: { p99: 'good', find: 'good', pages: 'bad' },
      scene: {
        nodes: [
          { ...traces, status: 'active', chips: ['trace_id = 4bf9'] },
          { ...logs, status: 'active' },
          { ...pay, status: 'ok', badge: 'pool 6/40' },
          { ...db, status: 'ok', badge: 'query 12 ms' },
        ],
        links: [link('traces', 'logs', { label: 'same trace id' }), link('pay', 'db')],
        flows: [
          { path: ['traces', 'logs'], tone: 'handshake', label: 'look up logs', duration: 1.4 },
          { path: ['pay', 'db'], tone: 'request', duration: 1.2, delay: 1.5 },
        ],
        panel: {
          title: 'Logs for trace 4bf9',
          icon: 'FileText',
          code: '{"trace_id":"4bf9","event":"pool_wait",\n "waited_ms":3880}\n{"service":"payments","event":"reconcile_job",\n "connections_held":17,"pool_size":20}',
          footer: { text: 'The hourly job held 17 of 20 connections', tone: 'warn' },
        },
        caption: 'Metric: when. Trace: where. Logs: why.',
      },
    },
    {
      title: 'Dashboards',
      tag: 'concept',
      heading: 'Dashboards: from the spike to the request',
      eli5: 'A big board on the wall, the **dashboard**, shows the four numbers for every room. When one turns red you tap it, and it shows you a late parcel and its stamps.',
      body: [
        'A good **dashboard** opens with the golden signals for one service, and each graph leads one click deeper: from a latency spike to example traces from that minute, and from a trace to its log lines.',
        'Build in layers: one overview for "are users affected", one page per service, and deep views opened rarely. Mark deploys on the time axis, since most incidents follow a change.',
      ],
      keyIdea: 'Wire the three signals together so each one leads to the next.',
      metrics: { p99: '300 ms', find: '5 min', pages: '140', signals: 'linked' },
      metricTones: { p99: 'good', find: 'good', pages: 'bad' },
      scene: {
        nodes: [
          { ...dash, status: 'active', badge: 'p99 300 ms' },
          { ...metrics, status: 'ok', badge: '1. when' },
          { ...traces, badge: '2. where' },
          { ...logs, badge: '3. why' },
        ],
        links: [
          link('dash', 'metrics'),
          link('metrics', 'traces', { label: 'example trace' }),
          link('traces', 'logs', { label: 'trace id' }),
        ],
        flows: [
          { path: ['dash', 'metrics'], tone: 'request', label: 'spike 14:06, after v212', duration: 1.2 },
          { path: ['metrics', 'traces'], tone: 'request', duration: 1.2, delay: 1.3 },
          { path: ['traces', 'logs'], tone: 'request', duration: 1.4, delay: 2.6 },
        ],
        panel: {
          title: 'Dashboard layers',
          icon: 'Layers',
          rows: [
            { text: '1. Overview', value: 'are users hurt?' },
            { text: '2. Per service', value: 'golden signals' },
            { text: '3. Deep debug', value: 'opened rarely', tone: 'muted' },
            { text: 'Deploy marker 14:05', value: 'v212 hourly job', tone: 'warn' },
          ],
        },
        caption: 'One path from a graph to a log line',
      },
    },
    {
      title: 'Probes',
      tag: 'concept',
      heading: 'Synthetic probes: test from outside',
      eli5: 'A mystery shopper walks in the front door every minute and posts a test parcel. If it does not arrive, the office knows before any customer complains, even in the quiet night.',
      body: [
        'Metrics only see real traffic. A **synthetic probe** runs a scripted checkout every minute from outside, through the gateway like a real shopper, so a broken path is found before the first customer, even at 3 AM.',
        'Probe orders use a test account and are excluded from business metrics, so they never ship or inflate revenue.',
      ],
      keyIdea: 'A probe tests the whole path from outside, with a test account kept out of business numbers.',
      metrics: { p99: '300 ms', find: '5 min', pages: '140', signals: 'linked + probes' },
      metricTones: { p99: 'good', find: 'good', pages: 'bad' },
      scene: {
        nodes: [
          { id: 'probe', kind: 'block', size: SZ, at: at(-6.6, -3.5), label: 'probe', icon: 'Timer', tint: 'teal', status: 'active', chips: ['fake checkout / 60 s', { text: 'test account', tone: 'good' }] },
          { ...gw, status: 'ok' },
          { ...orders, status: 'ok' },
        ],
        links: [link('probe', 'gw'), link('gw', 'orders')],
        flows: [
          { path: ['probe', 'gw', 'orders'], tone: 'request', label: 'test order', duration: 1.8 },
          { path: ['orders', 'gw', 'probe'], tone: 'response', label: '200 ok', duration: 1.8, delay: 1.9 },
        ],
        panel: {
          title: 'Probe rules',
          icon: 'Signal',
          rows: [
            { text: 'Runs from', value: 'outside, via gateway' },
            { text: 'Account', value: 'test only', tone: 'good' },
            { text: 'Business metrics', value: 'excluded', tone: 'good' },
          ],
        },
        caption: 'Find breakage before a shopper does',
      },
    },
    {
      title: 'Health checks',
      tag: 'concept',
      heading: 'Health checks let the platform react on its own',
      eli5: 'A floor manager pokes each sorting room every few seconds and asks "are you ok?". A room that does not answer is restarted, and one that is just busy gets no new parcels for a while.',
      body: [
        'An orchestrator calls a health endpoint such as `/healthz` on every pod. **Liveness** failing means the process is stuck, so restart it.',
        '**Readiness** failing means the pod is alive but not ready, for example while warming up, so stop sending it traffic until it recovers.',
      ],
      keyIdea: 'Liveness decides restart. Readiness decides whether traffic is sent.',
      metrics: { p99: '300 ms', find: '5 min', pages: '140', signals: 'linked + probes' },
      metricTones: { p99: 'good', find: 'good', pages: 'bad' },
      scene: {
        nodes: [
          { id: 'orch', kind: 'block', size: SZ, at: at(-3.3, -3.5), label: 'orchestrator', icon: 'Container', tint: 'gray', status: 'active' },
          { ...pay, status: 'down', chips: ['GET /healthz', { text: 'liveness failed', tone: 'bad' }], badge: 'restarting' },
        ],
        links: [link('orch', 'pay', { arrow: 'both', label: 'poll /healthz' })],
        flows: [
          { path: ['orch', 'pay'], tone: 'request', label: 'GET /healthz', duration: 1.4 },
          { path: ['pay', 'orch'], tone: 'error', label: 'no answer', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Two kinds of health check',
          icon: 'Signal',
          rows: [
            { text: 'Liveness fails', value: 'restart the pod', tone: 'bad' },
            { text: 'Readiness fails', value: 'remove from traffic', tone: 'warn' },
            { text: 'Both pass', value: 'serve traffic', tone: 'good' },
          ],
        },
        caption: 'The platform restarts or removes a bad pod',
      },
    },
    {
      title: 'SLOs',
      tag: 'concept',
      heading: 'SLI, SLO, SLA and the error budget',
      eli5: 'The post office promises that 999 of every 1,000 parcels arrive in a day. The few it may miss are its slack, and it spends them carefully.',
      body: [
        'An **SLI** is a measured number, such as the share of checkouts that succeed in under 1 second. An **SLO** is the target for it: 99.9% over 30 days. An **SLA** is the contract with customers, usually looser, with a penalty.',
        'The gap to 100% is the **error budget**: 0.1% of 30 days is about 43 minutes of full failure. Release freely while it lasts, and slow down when it runs low.',
      ],
      keyIdea: 'An SLO turns "users feel it" into a number, and the error budget says how much failure you can afford.',
      metrics: { p99: '300 ms', find: '5 min', pages: '140', signals: 'linked + SLO' },
      metricTones: { p99: 'good', find: 'good', pages: 'bad' },
      scene: {
        nodes: [{ ...orders, status: 'ok' }, { ...metrics, status: 'active', badge: 'SLI 99.95%' }, { ...dash, badge: 'SLO 99.9%' }],
        links: [link('orders', 'metrics', { style: 'dashed' }), link('metrics', 'dash')],
        flows: [
          { path: ['orders', 'metrics'], tone: 'data', duration: 1.3 },
          { path: ['metrics', 'dash'], tone: 'response', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'Checkout reliability',
          icon: 'Gauge',
          rows: [
            { text: 'SLI', value: 'success under 1 s' },
            { text: 'SLO', value: '99.9% per 30 days' },
            { text: 'SLA', value: 'looser, with a penalty', tone: 'muted' },
            { text: 'Error budget', value: '0.1% ≈ 43 min', tone: 'warn' },
          ],
        },
        caption: 'The budget is the room left for failure',
      },
    },
    {
      title: 'Burn-rate alerts',
      tag: 'concept',
      heading: 'Alert on symptoms, measured as budget burn',
      eli5: 'A bell rings for the person **on-call** only when parcels are really arriving late for customers, and faster the quicker the slack is running out. A room that is merely busy does not ring the bell.',
      body: [
        'Page on **symptoms** users feel (checkouts failing or slow). Treat **causes** such as high CPU or one dead instance as context on a dashboard. **Burn rate** is the observed error ratio divided by the budget (0.001). A burn rate of 1 spends the budget in exactly 30 days.',
        'Burn rate 14.4 for an hour eats 2% of the month: page. A slow leak at rate 2 becomes a ticket. A short window check as well stops the page soon after recovery.',
      ],
      keyIdea: 'Page a human only when the SLO is at risk. Everything else is a ticket or a graph.',
      metrics: { p99: '300 ms', find: '5 min', pages: '140', signals: 'linked + SLO' },
      metricTones: { p99: 'good', find: 'good', pages: 'bad' },
      scene: {
        nodes: [
          { ...orders, status: 'hot', badge: '2% failing' },
          { ...metrics, status: 'active', badge: 'burn rate 20' },
          { ...oncall, status: 'active', badge: 'paged' },
        ],
        links: [link('orders', 'metrics', { style: 'dashed' }), link('metrics', 'oncall', { label: 'page' })],
        flows: [
          { path: ['orders', 'metrics'], tone: 'error', label: '500s', count: 3, duration: 1.3 },
          { path: ['metrics', 'oncall'], tone: 'event', label: 'budget burning 20x', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Burn rate to action',
          icon: 'TrendingUp',
          rows: [
            { text: 'Rate 1', value: 'budget lasts 30 days', tone: 'good' },
            { text: 'Rate 2', value: 'ticket', tone: 'warn' },
            { text: 'Rate 14.4 for 1 h', value: 'page, 2% gone', tone: 'bad' },
          ],
        },
        caption: 'The alert describes user pain, with the budget as the threshold',
      },
      code: {
        language: 'yaml',
        title: 'Prometheus: multi-window burn-rate alert',
        source: `groups:
  - name: checkout-slo            # SLO: 99.9% good, budget = 0.001
    rules:
      - alert: CheckoutBudgetBurnFast
        expr: |
          (
            sum(rate(http_requests_total{job="checkout",code=~"5.."}[1h]))
              / sum(rate(http_requests_total{job="checkout"}[1h]))
          ) > 14.4 * 0.001
          and
          (
            sum(rate(http_requests_total{job="checkout",code=~"5.."}[5m]))
              / sum(rate(http_requests_total{job="checkout"}[5m]))
          ) > 14.4 * 0.001
        labels:
          severity: page
        annotations:
          summary: "Checkout is burning its error budget 14x too fast"
          runbook: "https://wiki.internal/runbooks/checkout-errors"

# This counts 5xx only. A full SLI also counts requests slower than 1 s
# (use the le="1" histogram bucket), so slow checkouts burn budget too.`,
        highlight: [9, 14, 16, 19],
      },
    },
    {
      title: 'Alert fatigue',
      tag: 'tradeoff',
      heading: 'Too many alerts is the same as none',
      eli5: 'If the bell rings every time any room gets a little busy, the person **on-call** stops listening. Then the one ring that matters is missed.',
      body: [
        'The team started with 140 pages a week: CPU above 80%, a pod restarted, disk at 70%. Most fixed themselves. People began to acknowledge pages unread, and a real outage sat unnoticed for 25 minutes. That is **alert fatigue**.',
        'Every page must be urgent, about user impact and actionable. The cost is that symptom alerts fire later than cause alerts, and a new failure mode may slip through.',
      ],
      keyIdea: 'An alert that does not need a human right now trains the human to ignore the next one.',
      metrics: { p99: '300 ms', find: '5 min', pages: '6', signals: 'linked + SLO' },
      metricTones: { p99: 'good', find: 'good', pages: 'good' },
      scene: {
        nodes: [
          { ...orders, chips: [{ text: 'CPU 82%', tone: 'warn' }] },
          { ...metrics, status: 'active', badge: '140 to 6 pages/week' },
          { ...dash, status: 'ok', badge: 'tickets + graphs' },
          { ...oncall, status: 'ok', badge: 'sleeps' },
        ],
        links: [link('orders', 'metrics', { style: 'dashed' }), link('metrics', 'dash'), link('metrics', 'oncall', { style: 'faint' })],
        flows: [
          { path: ['orders', 'metrics'], tone: 'data', duration: 1.2 },
          { path: ['metrics', 'dash'], tone: 'event', label: 'causes become tickets', duration: 1.4, delay: 1.3 },
        ],
        panel: {
          title: 'Where each alert goes',
          icon: 'List',
          rows: [
            { text: 'CPU above 80%', value: 'dashboard', tone: 'muted' },
            { text: 'Pod restarted', value: 'ticket', tone: 'muted' },
            { text: 'Disk at 70%', value: 'ticket', tone: 'muted' },
            { text: 'Budget burning 14x', value: 'page', tone: 'bad' },
          ],
        },
        caption: 'Causes go to a dashboard. Only symptoms page.',
      },
    },
    {
      title: 'On-call',
      tag: 'concept',
      heading: 'What a page needs to be actionable',
      eli5: 'The night clerk gets a card that says what the bell means, who to wake next, and what to do first. Related bells ring as one, so the clerk is not buried.',
      body: [
        'A page carries a **runbook** link (what it means, how to check, how to roll back), the user impact and an owner. Group related alerts so one failing database sends one page, not forty.',
        'An **escalation policy** says who is next if nobody **acknowledges** in 5 minutes: the secondary, then the team lead. A rotation keeps one primary on call per week, and severity levels (sev1 pages now, sev3 waits for morning) set the urgency.',
      ],
      keyIdea: 'A good page names the impact, links a runbook, has an owner and escalates if nobody answers.',
      metrics: { p99: '300 ms', find: '5 min', pages: '6', signals: 'linked + SLO' },
      metricTones: { p99: 'good', find: 'good', pages: 'good' },
      scene: {
        nodes: [
          { ...metrics, status: 'active' },
          { ...oncall, status: 'active', badge: '1 page, not 40' },
          { id: 'runbook', kind: 'block', size: SZ, at: at(3.3, 0), label: 'runbook', icon: 'FileText', tint: 'gray' },
        ],
        links: [link('metrics', 'oncall', { label: 'grouped page' }), link('oncall', 'runbook', { style: 'dashed', label: 'link in page' })],
        flows: [
          { path: ['metrics', 'oncall'], tone: 'event', duration: 1.3 },
          { path: ['oncall', 'runbook'], tone: 'request', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'Example page',
          icon: 'Signal',
          code: 'SEV1 CheckoutBudgetBurnFast\nimpact:   2% of checkouts failing\nrunbook:  wiki/runbooks/checkout-errors\nowner:    payments team\nescalate: secondary after 5 min, lead after 15',
          footer: { text: 'Acknowledge the page to stop escalation', tone: 'muted' },
        },
        caption: 'Everything the responder needs is in the page',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'A system that can explain itself',
      eli5: 'Every room fills in forms, clicks its counters and stamps each parcel number. The board shows the numbers, and the bell rings only when customers are really waiting.',
      body: [
        '**Logs** are structured events, **metrics** are cheap numbers, and **traces** carry one id across services, sampled and collected through OpenTelemetry.',
        'Link them behind dashboards, add probes, and page on **SLO** burn rate. Finding the cause went from three hours to five minutes, and pages fell from 140 to 6 a week.',
        'After each incident, hold a blameless **postmortem**: what would have told us sooner? Add that signal, and delete noisy alerts.',
      ],
      keyIdea: 'Metrics tell you when, traces tell you where, logs tell you why, and SLO alerts tell you when to care.',
      metrics: { p99: '300 ms', find: '5 min', pages: '6', signals: 'linked + SLO' },
      metricTones: { p99: 'good', find: 'good', pages: 'good' },
      scene: {
        nodes: [{ ...logs, status: 'ok' }, { ...metrics, status: 'ok' }, { ...traces, status: 'ok' }, { ...oncall, status: 'ok' }, { ...pay, status: 'ok' }],
        links: [
          link('pay', 'logs', { style: 'dashed' }),
          link('pay', 'metrics', { style: 'dashed' }),
          link('pay', 'traces', { style: 'dashed' }),
          link('metrics', 'oncall', { style: 'faint' }),
        ],
        flows: [
          { path: ['pay', 'logs'], tone: 'event', duration: 1.2 },
          { path: ['pay', 'metrics'], tone: 'data', duration: 1.2, delay: 0.4 },
          { path: ['pay', 'traces'], tone: 'event', duration: 1.2, delay: 0.8 },
        ],
        panel: {
          title: 'Before and after',
          icon: 'TrendingUp',
          rows: [
            { text: 'Time to find cause', value: '3 h to 5 min', tone: 'good' },
            { text: 'Pages per week', value: '140 to 6', tone: 'good' },
            { text: 'Checkout p99', value: '4.2 s to 300 ms', tone: 'good' },
          ],
        },
      },
      quiz: {
        question: 'Which alert should page the on-call engineer at 3 AM?',
        options: [
          'CPU on one orders instance is above 85%',
          'A payments pod restarted once',
          'Checkout is failing fast enough to use the monthly error budget in two days',
          'Disk usage on a log shipper reached 70%',
        ],
        answer: 2,
        explain: 'Only the third describes user-facing harm measured against the SLO, and it needs action now. The others are causes that may never affect a user. They belong on a dashboard or in a ticket.',
      },
    },
  ],
};
