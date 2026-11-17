import type { Lesson, SceneNode } from '../engine/types';

/** Place a node by screen column and screen row, so nodes in different columns never overlap. */
const P = (col: number, row: number): [number, number] => [(col + row) / 2, (row - col) / 2];

const user: SceneNode = { id: 'user', kind: 'phone', at: P(-7.5, -3.2), label: 'shopper' };
const gw: SceneNode = { id: 'gw', kind: 'gateway', at: P(-5, -3.2), label: 'gateway' };
const orders: SceneNode = { id: 'orders', kind: 'service', at: P(-2.5, -3.2), label: 'orders' };
const pay: SceneNode = { id: 'pay', kind: 'service', at: P(0, -3.2), label: 'payments' };
const inv: SceneNode = { id: 'inv', kind: 'service', at: P(2.5, -3.2), label: 'inventory' };
const db: SceneNode = { id: 'db', kind: 'db', at: P(5, -3.2), label: 'payments DB' };

const dash: SceneNode = { id: 'dash', kind: 'client', at: P(-5, 3.2), label: 'dashboard' };
const logs: SceneNode = { id: 'logs', kind: 'search', at: P(-2.5, 3.2), label: 'log store' };
const metrics: SceneNode = { id: 'metrics', kind: 'monitor', at: P(0, 3.2), label: 'metrics' };
const traces: SceneNode = { id: 'traces', kind: 'storage', at: P(2.5, 3.2), label: 'trace store' };
const oncall: SceneNode = { id: 'oncall', kind: 'user', at: P(5, 3.2), label: 'on-call' };

const pathLinks = [
  { from: 'user', to: 'gw' },
  { from: 'gw', to: 'orders' },
  { from: 'orders', to: 'pay' },
  { from: 'pay', to: 'inv' },
  { from: 'inv', to: 'db' },
];

export const observability: Lesson = {
  id: 'observability',
  title: 'Observability: logs, metrics, traces',
  tagline: 'Make a running system explain itself, so a slow request points to its own cause.',
  minutes: 14,
  level: 'Intermediate',
  learn: [
    'Why plain text logs on each server fail once a request crosses services',
    'Structured logs, and what belongs in every log line',
    'Counters, gauges, histograms and the four golden signals',
    'How a trace id and span ids follow one request across services',
    'Alerting on user-facing symptoms tied to an SLO, and avoiding alert fatigue',
  ],
  metrics: [
    { key: 'p99', label: 'Checkout p99' },
    { key: 'find', label: 'Time to find cause' },
    { key: 'pages', label: 'Pages per week' },
    { key: 'signals', label: 'Signals' },
  ],
  steps: [
    {
      title: 'No clues',
      tag: 'problem',
      heading: 'Checkout is slow and nothing says why',
      eli5: 'A parcel is very late. The post office has four sorting rooms, and no room wrote down when the parcel came in or went out. Nobody can tell which room held it up.',
      body: [
        'Support forwards a complaint: checkout takes 4 seconds. A checkout request passes through the gateway and three services (orders, payments, inventory) before it reaches a database. Each service runs on a dozen machines.',
        'An engineer logs in to machines one by one and searches text files for the customer email. Each service prints lines in its own format, clocks differ by a few hundred milliseconds, and nothing ties a line in payments to the request that caused it in orders.',
        'Three hours later the cause is still a guess. The system works, yet it cannot describe what it is doing. **Observability** is the ability to answer new questions about a running system from the data it emits, without shipping new code first.',
      ],
      keyIdea: 'If the only way to learn what production is doing is to log in and search files, every incident starts from zero.',
      metrics: { p99: '4.2 s', find: '3 hours+', pages: '140', signals: 'text logs' },
      scene: {
        nodes: [
          { ...user, status: 'hot', badge: '4.2 s' },
          gw,
          { ...orders, badge: '?' },
          { ...pay, badge: '?' },
          { ...inv, badge: '?' },
          db,
        ],
        links: pathLinks,
        flows: [
          { path: ['user', 'gw', 'orders', 'pay', 'inv', 'db'], tone: 'request', label: 'POST /checkout', duration: 3.2 },
          { path: ['db', 'inv', 'pay', 'orders', 'gw', 'user'], tone: 'response', label: 'slow', duration: 3.2, delay: 3.3 },
        ],
        caption: 'Four hops, and no record of where the time went',
      },
    },
    {
      title: 'Structured logs',
      tag: 'concept',
      heading: 'Logs: one event, one machine-readable record',
      eli5: 'Every sorting room now fills in the same form for each parcel: time, room, parcel number, what happened. All forms go into one big cabinet, the **log store**, so you can look up any parcel in seconds.',
      body: [
        'A **log** is a record of one event. The first fix is to make each record **structured**: a JSON object with named fields instead of a sentence. `"order_id": 9917` can be filtered and counted. "order 9917 took a while" can only be read.',
        'Every line carries the same core fields: timestamp, service, level, a request or trace id, and the fields specific to the event. An agent on each machine ships the lines to a central **log store**, where one query searches every service at once.',
        'Logs are the most detailed signal and the most expensive. At 2,000 requests per second, five lines per request is 10,000 lines per second. Log what you would need in an incident, keep debug level off by default, and never log passwords, card numbers or tokens.',
      ],
      keyIdea: 'Write logs as structured events with shared field names, and send them to one searchable place.',
      metrics: { p99: '4.2 s', find: '1 hour', pages: '140', signals: 'logs' },
      scene: {
        nodes: [user, gw, { ...orders, status: 'active' }, { ...pay, status: 'active' }, { ...inv, status: 'active' }, db, { ...logs, status: 'ok', badge: '10,000 lines/s' }],
        links: [
          ...pathLinks,
          { from: 'orders', to: 'logs', style: 'dashed' },
          { from: 'pay', to: 'logs', style: 'dashed' },
          { from: 'inv', to: 'logs', style: 'dashed' },
        ],
        flows: [
          { path: ['user', 'gw', 'orders', 'pay', 'inv', 'db'], tone: 'request', duration: 2.4 },
          { path: ['orders', 'logs'], tone: 'event', label: '{json}', duration: 1.2, delay: 0.9 },
          { path: ['pay', 'logs'], tone: 'event', duration: 1.2, delay: 1.4 },
          { path: ['inv', 'logs'], tone: 'event', duration: 1.2, delay: 1.9 },
        ],
        caption: 'Every service ships the same shape of record',
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
      title: 'Metrics',
      tag: 'concept',
      heading: 'Metrics: cheap numbers over time',
      eli5: 'Each sorting room has a counter on the wall that clicks for every parcel and a clock that times each one. The **metrics** board reads all the counters every few seconds, so you can see a room slowing down.',
      body: [
        'A **metric** is a number sampled over time, with a few labels such as service and route. Three types cover most needs. A **counter** only goes up (requests served, errors). A **gauge** goes up and down (queue depth, memory in use). A **histogram** counts observations into buckets, which gives you percentiles.',
        'Metrics are cheap because they aggregate. A million requests cost the same few numbers as ten requests, so you can keep them for months and graph them instantly. The price is detail: a metric tells you that p99 latency tripled at 14:05, and cannot tell you which request or why.',
        'Watch percentiles, since averages hide the pain. If 98% of checkouts take 200 ms and 2% take 4 seconds, the average is 276 ms and looks healthy. Also keep label values bounded. A label per user id creates millions of series and can take the metrics system down.',
      ],
      keyIdea: 'Metrics answer "is something wrong, and since when" for almost no cost. They do not answer "why".',
      metrics: { p99: '4.2 s', find: '1 hour', pages: '140', signals: 'logs + metrics' },
      scene: {
        nodes: [
          user,
          gw,
          { ...orders, badge: 'p99 4.1 s' },
          { ...pay, status: 'hot', badge: 'p99 3.9 s' },
          { ...inv, badge: 'p99 40 ms' },
          db,
          logs,
          { ...metrics, status: 'active', badge: 'scrape every 15 s' },
        ],
        links: [
          ...pathLinks,
          { from: 'metrics', to: 'orders', style: 'dashed' },
          { from: 'metrics', to: 'pay', style: 'dashed' },
          { from: 'metrics', to: 'inv', style: 'dashed' },
        ],
        flows: [
          { path: ['user', 'gw', 'orders', 'pay', 'inv', 'db'], tone: 'request', count: 3, duration: 2.4 },
          { path: ['orders', 'metrics'], tone: 'data', duration: 1.1, delay: 1 },
          { path: ['pay', 'metrics'], tone: 'data', label: 'counters, histograms', duration: 1.1, delay: 1 },
          { path: ['inv', 'metrics'], tone: 'data', duration: 1.1, delay: 1 },
        ],
        caption: 'Per-service latency narrows the search to payments',
      },
    },
    {
      title: 'Golden signals',
      tag: 'concept',
      heading: 'Four numbers to watch on every service',
      eli5: 'For every sorting room, the **metrics** board shows four things: how long parcels take, how many arrive, how many get lost, and how full the shelves are. Those four tell you if a room is in trouble.',
      body: [
        'You could graph a thousand things. The **four golden signals** are the short list that describes how a request-serving system is doing from the outside.',
        '**Latency**: how long requests take, as percentiles, with failed requests tracked separately so fast errors do not flatter the number. **Traffic**: demand, usually requests per second. **Errors**: the share of requests that fail. **Saturation**: how full the most constrained resource is, such as CPU, memory, a connection pool or a queue.',
        'Saturation is the early warning. Latency stays flat while a pool goes from 50% to 90% used, then climbs steeply once requests start waiting for a free slot. Here payments shows its database connection pool at 20 of 20 in use.',
      ],
      keyIdea: 'Latency, traffic, errors and saturation, per service. If you can only build one dashboard, build that one.',
      metrics: { p99: '4.2 s', find: '40 min', pages: '140', signals: 'logs + metrics' },
      scene: {
        nodes: [
          user,
          gw,
          orders,
          { ...pay, status: 'hot', badge: 'pool 20/20' },
          inv,
          db,
          { ...dash, status: 'active', badge: '4 signals' },
          { ...metrics, status: 'ok' },
        ],
        links: [...pathLinks, { from: 'pay', to: 'metrics', style: 'dashed' }, { from: 'metrics', to: 'dash' }],
        flows: [
          { path: ['user', 'gw', 'orders', 'pay'], tone: 'request', count: 4, duration: 1.6 },
          { path: ['pay', 'metrics'], tone: 'data', label: 'saturation 100%', duration: 1.2, delay: 1.2 },
          { path: ['metrics', 'dash'], tone: 'response', duration: 1.2, delay: 2.5 },
        ],
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
        'A **trace** is the record of one request across every service it touched. The first service creates a random **trace id**. Each unit of work inside the request is a **span** with its own **span id**, a start time, a duration and the id of its parent span.',
        'The ids travel with the request. On every outgoing call the caller adds a header (the W3C standard is `traceparent`) carrying the trace id and its own span id. The callee reads it, starts a child span, and passes the same trace id onward. This is **context propagation**, and one service that drops the header cuts the trace in two.',
        'Each service sends its finished spans to a **trace store**, which joins them by trace id into a tree. Recording every request is costly, so systems **sample**: keep perhaps 1% at random, plus all traces that were slow or failed.',
      ],
      keyIdea: 'A trace id created at the edge and passed on every call turns scattered events into one timeline.',
      metrics: { p99: '4.2 s', find: '40 min', pages: '140', signals: 'logs + metrics + traces' },
      scene: {
        nodes: [
          user,
          { ...gw, status: 'active', badge: 'new trace 4bf9' },
          { ...orders, badge: 'span a1' },
          { ...pay, badge: 'span b2' },
          { ...inv, badge: 'span c3' },
          db,
          { ...traces, status: 'ok', badge: 'joins by trace id' },
        ],
        links: [
          ...pathLinks,
          { from: 'orders', to: 'traces', style: 'dashed' },
          { from: 'pay', to: 'traces', style: 'dashed' },
          { from: 'inv', to: 'traces', style: 'dashed' },
        ],
        flows: [
          { path: ['user', 'gw'], tone: 'request', duration: 0.8 },
          { path: ['gw', 'orders', 'pay', 'inv'], tone: 'request', label: 'traceparent: 4bf9', duration: 2, delay: 0.9 },
          { path: ['orders', 'traces'], tone: 'event', label: 'spans', duration: 1.1, delay: 3 },
          { path: ['pay', 'traces'], tone: 'event', duration: 1.1, delay: 3.2 },
          { path: ['inv', 'traces'], tone: 'event', duration: 1.1, delay: 3.4 },
        ],
        caption: 'Same trace id on every hop, a new span id per hop',
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
      title: 'Read a trace',
      tag: 'case',
      heading: 'Case: the trace shows where 4 seconds went',
      eli5: 'We look up the late parcel by its tracking number in the **trace store**. The stamps show it sat in the payments room for almost four seconds, waiting for a free helper.',
      body: [
        'Open one slow checkout in the trace viewer. The root span at the gateway lasts 4,200 ms. Under it, orders takes 4,150 ms, and nearly all of that is one child: `payments.charge` at **3,900 ms**. Inventory takes 40 ms. Three services are cleared in ten seconds.',
        'Inside the payments span the database query itself runs for 12 ms. The other 3,880 ms is a span named `pool.acquire`: the request waited for a free database connection. Payments has a pool of 20 connections and a nightly reconciliation job was holding most of them.',
        'The trace id is in every log line, so one search in the log store pulls up the exact lines for this request, including the job that held the connections. Metric showed when, trace showed where, logs showed why.',
      ],
      keyIdea: 'A trace turns "checkout is slow" into "this span, in this service, waited on this resource".',
      metrics: { p99: '4.2 s', find: '5 min', pages: '140', signals: 'logs + metrics + traces' },
      scene: {
        nodes: [
          user,
          { ...gw, badge: '4,200 ms' },
          { ...orders, badge: '4,150 ms' },
          { ...pay, status: 'hot', badge: 'pool wait 3,880 ms' },
          { ...inv, status: 'ok', badge: '40 ms' },
          { ...db, status: 'ok', badge: 'query 12 ms' },
          { ...logs, badge: 'trace_id = 4bf9' },
          { ...traces, status: 'active' },
        ],
        links: [...pathLinks, { from: 'pay', to: 'traces', style: 'dashed' }, { from: 'traces', to: 'logs', style: 'dashed', label: 'same id' }],
        flows: [
          { path: ['user', 'gw', 'orders', 'pay'], tone: 'request', duration: 1.4 },
          { path: ['pay', 'traces'], tone: 'error', label: 'slow span', duration: 1.2, delay: 1.5 },
          { path: ['traces', 'logs'], tone: 'handshake', label: 'look up logs', duration: 1.2, delay: 2.8 },
        ],
        caption: 'The time is in one span: waiting for a connection',
      },
    },
    {
      title: 'Dashboards',
      tag: 'concept',
      heading: 'Dashboards: from the spike to the request',
      eli5: 'A big board on the wall, the **dashboard**, shows the four numbers for every room. When one turns red you tap it, and it shows you a late parcel and its stamps.',
      body: [
        'The three signals are strongest when they link to each other. A good **dashboard** opens with the golden signals for one service, and each graph leads one click deeper: from a latency spike to example traces from that minute, and from a trace to its log lines.',
        'Build dashboards in layers. One overview answers "are users affected" with a handful of graphs. One page per service shows its golden signals and its dependencies. Deep debugging views come last and are opened rarely.',
        'Mark deploys and config changes on the time axis. Most incidents start with a change, and a vertical line at 14:05 labelled "payments v212" next to a latency jump at 14:06 saves a lot of guessing.',
      ],
      keyIdea: 'Metrics detect, traces locate, logs explain. Wire them together so each one leads to the next.',
      metrics: { p99: '300 ms', find: '5 min', pages: '140', signals: 'linked' },
      scene: {
        nodes: [
          { ...dash, status: 'active', badge: 'p99 back to 300 ms' },
          { ...logs, badge: '3. why' },
          { ...metrics, status: 'ok', badge: '1. when' },
          { ...traces, badge: '2. where' },
          { ...pay, status: 'ok', badge: 'pool 6/40' },
        ],
        links: [
          { from: 'pay', to: 'metrics', style: 'dashed' },
          { from: 'dash', to: 'metrics' },
          { from: 'metrics', to: 'traces', label: 'example trace' },
          { from: 'traces', to: 'logs', label: 'trace id' },
        ],
        flows: [
          { path: ['pay', 'metrics'], tone: 'data', duration: 1.1 },
          { path: ['dash', 'metrics'], tone: 'request', label: 'spike at 14:06', duration: 1.1, delay: 1.2 },
          { path: ['metrics', 'traces'], tone: 'request', duration: 1.1, delay: 2.4 },
          { path: ['traces', 'logs'], tone: 'request', duration: 1.4, delay: 3.6 },
        ],
        caption: 'One path from a graph to a log line',
      },
    },
    {
      title: 'SLO alerts',
      tag: 'concept',
      heading: 'Alert on symptoms, measured against an SLO',
      eli5: 'A bell rings for the person **on-call** only when parcels are really arriving late for customers. A room that is merely busy does not ring the bell.',
      body: [
        'Nobody watches dashboards at 3 AM, so alerts do. The rule is to page on **symptoms** users feel (checkouts failing or slow) and treat **causes** (high CPU, a full disk, one dead instance) as context on a dashboard or a ticket for the morning.',
        'A **service level objective** makes "users feel it" precise. Say 99.9% of checkouts must succeed in under 1 second over 30 days. The remaining 0.1% is the **error budget**: about 43 minutes of full failure per month.',
        'Alert on how fast the budget burns. A burn rate of 1 uses the budget in exactly 30 days. A burn rate of 14.4 sustained for an hour eats 2% of the month and deserves a page. A slow leak at burn rate 2 becomes a ticket. Checking a short window as well stops the page soon after recovery.',
      ],
      keyIdea: 'Page a human only when the SLO is at risk. Everything else is a ticket or a graph.',
      metrics: { p99: '300 ms', find: '5 min', pages: '140', signals: 'linked + SLO' },
      scene: {
        nodes: [
          user,
          gw,
          { ...orders, status: 'hot', badge: '2% failing' },
          { ...dash, badge: 'SLO 99.9%' },
          { ...metrics, status: 'active', badge: 'burn rate 20' },
          { ...oncall, status: 'active', badge: 'paged' },
        ],
        links: [
          { from: 'user', to: 'gw' },
          { from: 'gw', to: 'orders' },
          { from: 'orders', to: 'metrics', style: 'dashed' },
          { from: 'metrics', to: 'oncall', label: 'page' },
          { from: 'metrics', to: 'dash' },
        ],
        flows: [
          { path: ['user', 'gw', 'orders'], tone: 'request', count: 4, duration: 1.4 },
          { path: ['orders', 'gw', 'user'], tone: 'error', label: '500', duration: 1.4, delay: 1.5 },
          { path: ['orders', 'metrics'], tone: 'data', duration: 1.1, delay: 1.5 },
          { path: ['metrics', 'oncall'], tone: 'event', label: 'budget burning 20x', duration: 1.3, delay: 2.8 },
        ],
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
          runbook: "https://wiki.internal/runbooks/checkout-errors"`,
        highlight: [9, 14, 16, 19],
      },
    },
    {
      title: 'Alert fatigue',
      tag: 'tradeoff',
      heading: 'Too many alerts is the same as none',
      eli5: 'If the bell rings every time any room gets a little busy, the person **on-call** stops listening. Then the one ring that matters is missed.',
      body: [
        'The team started with 140 pages a week: CPU above 80%, a pod restarted, disk at 70%. Most resolved by themselves and needed no action. People began to acknowledge pages without reading them, and a real outage sat unnoticed for 25 minutes. That is **alert fatigue**.',
        'Every page should be urgent, about real user impact, and actionable by the person who receives it. Each one links to a runbook. Anything that fails that test is deleted, turned into a ticket, or fixed at the source. Group related alerts so one failing database produces one page, not forty.',
        'There is a cost on the other side. Fewer, symptom-based alerts fire later than a cause-based alert would, and a brand-new failure mode may slip through. Review every incident for "what would have told us sooner" and add that signal with care.',
      ],
      keyIdea: 'An alert that does not need a human right now trains the human to ignore the next one.',
      metrics: { p99: '300 ms', find: '5 min', pages: '6', signals: 'linked + SLO' },
      scene: {
        nodes: [
          { ...orders, badge: 'CPU 82%' },
          { ...pay, badge: 'pod restarted' },
          { ...inv, badge: 'disk 70%' },
          { ...dash, status: 'ok', badge: 'tickets + graphs' },
          { ...metrics, status: 'active', badge: '140 to 6 pages/week' },
          { ...oncall, status: 'ok', badge: 'sleeps' },
        ],
        links: [
          { from: 'orders', to: 'metrics', style: 'dashed' },
          { from: 'pay', to: 'metrics', style: 'dashed' },
          { from: 'inv', to: 'metrics', style: 'dashed' },
          { from: 'metrics', to: 'dash' },
          { from: 'metrics', to: 'oncall', style: 'faint' },
        ],
        flows: [
          { path: ['orders', 'metrics'], tone: 'data', duration: 1.1 },
          { path: ['pay', 'metrics'], tone: 'data', duration: 1.1 },
          { path: ['inv', 'metrics'], tone: 'data', duration: 1.1 },
          { path: ['metrics', 'dash'], tone: 'event', label: 'cause alerts become tickets', duration: 1.4, delay: 1.3 },
        ],
        caption: 'Causes go to a dashboard. Only symptoms page.',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'A system that can explain itself',
      eli5: 'Every room fills in forms, clicks its counters and stamps each parcel number. The board shows the numbers, and the bell rings only when customers are really waiting.',
      body: [
        '**Logs** are detailed events, structured and searchable in one place. **Metrics** are cheap numbers over time: watch latency, traffic, errors and saturation on every service. **Traces** carry a trace id and span ids across services so one request becomes one timeline.',
        'Link the three by trace id and put them behind layered dashboards. Alert on symptoms measured against an **SLO** and its error budget, and keep pages rare enough that each one is read. Finding the slow checkout went from three hours to five minutes, and pages fell from 140 a week to 6.',
      ],
      keyIdea: 'Metrics tell you when, traces tell you where, logs tell you why, and SLO alerts tell you when to care.',
      metrics: { p99: '300 ms', find: '5 min', pages: '6', signals: 'linked + SLO' },
      scene: {
        nodes: [user, gw, { ...orders, status: 'ok' }, { ...pay, status: 'ok' }, { ...inv, status: 'ok' }, logs, { ...metrics, status: 'ok' }, traces, oncall],
        links: [
          { from: 'user', to: 'gw' },
          { from: 'gw', to: 'orders' },
          { from: 'orders', to: 'pay' },
          { from: 'pay', to: 'inv' },
          { from: 'orders', to: 'logs', style: 'dashed' },
          { from: 'pay', to: 'metrics', style: 'dashed' },
          { from: 'inv', to: 'traces', style: 'dashed' },
          { from: 'metrics', to: 'oncall', style: 'faint' },
        ],
        flows: [
          { path: ['user', 'gw', 'orders', 'pay', 'inv'], tone: 'request', duration: 2 },
          { path: ['orders', 'logs'], tone: 'event', duration: 1.1, delay: 1 },
          { path: ['pay', 'metrics'], tone: 'data', duration: 1.1, delay: 1.4 },
          { path: ['inv', 'traces'], tone: 'event', duration: 1.1, delay: 1.8 },
        ],
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
