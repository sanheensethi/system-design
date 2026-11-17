import type { Lesson, SceneLink, SceneNode, SceneZone } from '../engine/types';

/** Place a node by screen column (x - y) and screen row (x + y), so spacing on screen is easy to reason about. */
const p = (col: number, row: number): [number, number] => [(row + col) / 2, (row - col) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const client: SceneNode = { id: 'client', kind: 'phone', at: p(-10.8, 0), label: 'shopper' };
const edge: SceneNode = { id: 'edge', kind: 'block', at: p(-7.2, 0), label: 'API gateway', sub: 'the front door', icon: 'Network', tint: 'violet' };
const orders: SceneNode = { id: 'orders', kind: 'block', at: p(-3.6, 0), label: 'orders', sub: 'Go', icon: 'ShoppingBag', tint: 'amber' };
const opx: SceneNode = { id: 'opx', kind: 'block', at: p(0, 0), label: 'sidecar', sub: 'orders proxy', icon: 'Router', tint: 'teal' };
const ppx: SceneNode = { id: 'ppx', kind: 'block', at: p(3.6, -4.5), label: 'sidecar', sub: 'payments proxy', icon: 'Router', tint: 'teal' };
const pay: SceneNode = { id: 'pay', kind: 'block', at: p(7.2, -4.5), label: 'payments', sub: 'Java', icon: 'Receipt', tint: 'green' };
const spx: SceneNode = { id: 'spx', kind: 'block', at: p(3.6, 4.5), label: 'sidecar', sub: 'stock proxy', icon: 'Router', tint: 'teal' };
const stock: SceneNode = { id: 'stock', kind: 'block', at: p(7.2, 4.5), label: 'stock', sub: 'Python', icon: 'Package', tint: 'blue' };
const cp: SceneNode = { id: 'cp', kind: 'block', at: p(0, -9), label: 'control plane', sub: 'config and certs', icon: 'Workflow', tint: 'violet' };
const metrics: SceneNode = { id: 'metrics', kind: 'monitor', at: p(7.2, 0), label: 'metrics' };

// Payments instances behind one proxy, and the canary build in the lower slot.
const payA: SceneNode = { ...pay, id: 'payA', at: p(7.2, -7.5), sub: '10.0.1.4' };
const payB: SceneNode = { ...pay, id: 'payB', at: p(7.2, 0), sub: '10.0.1.5' };
const payC: SceneNode = { ...pay, id: 'payC', at: p(7.2, 7.5), sub: '10.0.1.6' };
const pay2: SceneNode = { ...pay, id: 'pay2', at: p(7.2, 4.5), label: 'payments v2', sub: 'new build', tint: 'blue' };

const pod = (id: string, label: string, a: SceneNode, b: SceneNode): SceneZone => ({
  id,
  label,
  tone: 'blue',
  from: [Math.min(a.at[0], b.at[0]) - 0.75, Math.min(a.at[1], b.at[1]) - 0.75],
  to: [Math.max(a.at[0], b.at[0]) + 0.75, Math.max(a.at[1], b.at[1]) + 0.75],
});

export const serviceMesh: Lesson = {
  id: 'service-mesh',
  title: 'Service mesh and sidecars',
  tagline: 'Move retries, encryption and metrics out of every service and into a proxy that sits beside it.',
  minutes: 16,
  level: 'Advanced',
  learn: [
    'Why network code copied into every service drifts apart',
    'What a sidecar proxy does, how traffic reaches it, and how the data plane and control plane split the work',
    'Load balancing, timeouts, retries, circuit breaking, metrics and tracing done by the proxy',
    'How mutual TLS gives every service an identity, and how policies use it',
    'Shifting 5% of traffic to a new version, mirroring traffic and injecting faults',
    'What a mesh costs in latency and operations, and when a library or a gateway is enough',
  ],
  metrics: [
    { key: 'impl', label: 'Network code', icon: 'Code' },
    { key: 'mtls', label: 'Encrypted calls', icon: 'Shield' },
    { key: 'lat', label: 'Added per call', icon: 'Timer' },
    { key: 'parts', label: 'Proxies to run', icon: 'Boxes' },
  ],
  steps: [
    {
      title: 'Four copies',
      tag: 'problem',
      heading: 'Every team wrote its own network code',
      eli5: 'A school has many classrooms that pass notes to each other. Every classroom made up its own rules for what to do when a note gets lost, and no two sets of rules match.',
      body: [
        'The shop runs **40 services** in four languages: Go, Java, Python and Node. Each one calls others over the network, so each needs timeouts, retries, encryption and request metrics.',
        'Four languages means four libraries, written by different teams in different years. The Go client retries twice with backoff. The Python client retries five times with no pause. Only 12 of the 40 services encrypt their calls.',
      ],
      keyIdea: 'Network behavior that lives inside each service gets written many times and drifts apart.',
      metrics: { impl: '4 libraries', mtls: '30%', lat: '0 ms', parts: '0' },
      metricTones: { impl: 'bad', mtls: 'bad' },
      scene: {
        nodes: [
          { ...orders, chips: [{ text: 'retry x2, backoff', tone: 'good' }] },
          { ...pay, chips: [{ text: 'metrics: svc_latency', tone: 'warn' }] },
          { ...stock, chips: [{ text: 'retry x5, no wait', tone: 'bad' }] },
        ],
        links: [link('orders', 'pay', { label: 'TLS' }), link('orders', 'stock', { label: 'plain text', labelTone: 'warn' }), link('stock', 'pay', { label: 'plain text', labelTone: 'warn' })],
        flows: [
          { path: ['orders', 'pay'], tone: 'request', label: 'charge', duration: 1.2 },
          { path: ['orders', 'stock'], tone: 'request', label: 'reserve', duration: 1.2 },
          { path: ['stock', 'pay'], tone: 'request', label: 'check', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Same job, four versions',
          icon: 'Code',
          rows: [
            { text: 'Go client', value: 'retry x2, backoff', tone: 'good' },
            { text: 'Python client', value: 'retry x5, no pause', tone: 'bad' },
            { text: 'Java client', value: 'no retries', tone: 'warn' },
            { text: 'Encrypted calls', value: '12 of 40', tone: 'bad' },
          ],
          footer: { text: 'Metric names differ in every language', tone: 'warn' },
        },
        caption: 'Same job, written four different ways',
      },
    },
    {
      title: 'Retry storm',
      tag: 'case',
      heading: 'Case: a slowdown becomes an outage',
      eli5: 'One teacher gets slow at answering notes. A classroom with no patience keeps resending its note instantly, so the teacher is buried and cannot answer anyone.',
      body: [
        'Last month payments slowed down. The Python callers retried instantly, five times per call, and turned a slowdown into an outage.',
        'Fixing the retry rule meant a code change and a deploy in every service that had copied it. That is 40 deploys, and one team always misses the ticket.',
      ],
      keyIdea: 'A rule that lives in many codebases can only be changed one deploy at a time, and the slowest team sets the pace.',
      metrics: { impl: '4 libraries', mtls: '30%', lat: 'seconds', parts: '0' },
      metricTones: { lat: 'bad' },
      scene: {
        nodes: [
          { ...orders, chips: ['POST /charge'] },
          { ...stock, status: 'hot', chips: [{ text: 'retry x5, no wait', tone: 'bad' }] },
          { ...pay, status: 'hot', load: 98, chips: [{ text: '5x the calls', tone: 'bad' }] },
        ],
        links: [link('orders', 'pay'), link('stock', 'pay', { label: 'instant retries', labelTone: 'warn' })],
        flows: [
          { path: ['orders', 'pay'], tone: 'request', label: 'charge', duration: 1.2 },
          { path: ['stock', 'pay'], tone: 'error', label: 'retry storm', count: 5, duration: 0.9, delay: 1.3 },
        ],
        panel: {
          title: 'The fix, by hand',
          icon: 'List',
          rows: [
            { text: 'Change the retry rule', value: '1 line' },
            { text: 'Services to edit and deploy', value: '40', tone: 'bad' },
            { text: 'Time until all are fixed', value: 'weeks', tone: 'bad' },
          ],
        },
        caption: 'The storm is easy to cause and slow to fix',
      },
    },
    {
      title: 'The sidecar',
      tag: 'concept',
      heading: 'Put a proxy beside every service',
      eli5: 'Each classroom gets a hall helper who stands at its door. The class hands every note to its helper, and the helper carries it. That helper is the **sidecar**.',
      body: [
        'A **sidecar** is a small proxy process that runs next to each service instance, in the same pod, and handles all traffic in and out of it. The service believes it is talking straight to `payments`. In fact it is talking to its own proxy.',
        'The proxy owns what used to be library code: timeouts, retries, load balancing, encryption and metrics. It is the same binary beside every service, whatever language that service uses.',
      ],
      keyIdea: 'A sidecar takes network behavior out of the service and puts one identical implementation next to all of them.',
      metrics: { impl: '1 proxy', mtls: '30%', lat: '~1 ms', parts: '400' },
      metricTones: { impl: 'good' },
      scene: {
        zones: [pod('podOrders', 'orders pod', orders, opx), pod('podPay', 'payments pod', ppx, pay)],
        nodes: [orders, { ...opx, status: 'active', badge: 'takes all traffic' }, { ...ppx, status: 'active' }, pay],
        links: [link('orders', 'opx', { label: 'localhost' }), link('opx', 'ppx', { label: 'network' }), link('ppx', 'pay', { label: 'localhost' })],
        flows: [
          { path: ['orders', 'opx'], tone: 'request', label: 'POST /charge', duration: 0.9 },
          { path: ['opx', 'ppx'], tone: 'request', duration: 1.1, delay: 1 },
          { path: ['ppx', 'pay'], tone: 'request', duration: 0.9, delay: 2.2 },
          { path: ['pay', 'ppx', 'opx', 'orders'], tone: 'response', label: '200', duration: 2, delay: 3.2 },
        ],
        caption: 'Service to proxy, proxy to proxy, proxy to service',
      },
    },
    {
      title: 'Interception',
      tag: 'concept',
      heading: 'How traffic ends up in the proxy',
      eli5: 'The school moves a door so every note a class tries to send lands in the helper\'s hands first. The class never has to know the helper is there.',
      body: [
        'When the pod starts, the platform adds network rules that redirect every outbound call from the service to its proxy, and every inbound call through the proxy first. In Istio the proxy listens on port `15001` for outbound and `15006` for inbound.',
        'The service code does not change and never learns the proxy address. Envoy is the proxy most meshes use. Linkerd ships its own small one.',
      ],
      keyIdea: 'The platform redirects traffic into the sidecar, so the service needs no code change to use it.',
      metrics: { impl: '1 proxy', mtls: '30%', lat: '~1 ms', parts: '400' },
      scene: {
        zones: [pod('podOrders', 'orders pod', orders, opx)],
        nodes: [orders, { ...opx, status: 'active', chips: [{ text: 'listens :15001', tone: 'good' }] }, ppx],
        links: [link('orders', 'opx', { label: 'redirected' }), link('opx', 'ppx', { label: 'network' })],
        flows: [
          { path: ['orders', 'opx'], tone: 'request', label: 'to payments:80', duration: 1.2 },
          { path: ['opx', 'ppx'], tone: 'request', label: 'to payments pod', duration: 1.4, delay: 1.3 },
        ],
        panel: {
          title: 'Rules added at pod start',
          icon: 'Route',
          code: 'outbound  any port  ->  127.0.0.1:15001\ninbound   any port  ->  127.0.0.1:15006\n# the proxy itself is exempt,\n# so its own calls do not loop',
          footer: { text: 'The service still dials payments', tone: 'muted' },
        },
        caption: 'The call to payments is caught on the way out',
      },
    },
    {
      title: 'Data plane',
      tag: 'concept',
      heading: 'The data plane carries every request',
      eli5: 'All the hall helpers together carry every note in the school. Every note passes two helpers: the sender\'s and the receiver\'s.',
      body: [
        'All the sidecars together are the **data plane**. With 40 services at about 10 instances each, that is **400 proxies**, and every call between services passes through two of them: the caller\'s and the receiver\'s.',
        'Because every proxy runs the same code and the same rules, behavior is uniform for every caller, in every language.',
      ],
      keyIdea: 'The data plane is the set of proxies on the request path. One implementation serves every call.',
      metrics: { impl: 'sidecars', mtls: '30%', lat: '~1 ms', parts: '400' },
      scene: {
        nodes: [orders, { ...opx, status: 'active', chips: ['POST /charge'] }, { ...ppx, status: 'active', chips: ['POST /charge'] }, pay, { ...spx, chips: ['POST /reserve'] }],
        links: [link('orders', 'opx'), link('opx', 'ppx'), link('ppx', 'pay'), link('opx', 'spx')],
        flows: [
          { path: ['orders', 'opx', 'ppx', 'pay'], tone: 'request', label: 'charge', duration: 2 },
          { path: ['orders', 'opx', 'spx'], tone: 'request', label: 'reserve', duration: 2, delay: 0.4 },
        ],
        panel: {
          title: 'The fleet',
          icon: 'Boxes',
          rows: [
            { text: 'Services', value: '40' },
            { text: 'Instances per service', value: '~10' },
            { text: 'Proxies on the path', value: '400', tone: 'warn' },
            { text: 'Proxies per call', value: '2' },
          ],
        },
        caption: 'Every call crosses the caller\'s proxy and the receiver\'s',
      },
    },
    {
      title: 'Load balancing',
      tag: 'concept',
      heading: 'The proxy picks an instance for each request',
      eli5: 'The class has three teachers to send notes to. The helper keeps a list of which teachers are free and hands each new note to the least busy one.',
      body: [
        'The proxy holds a live list of healthy `payments` instances, kept current by the control plane. It chooses one for every **request**, using a policy such as round robin or least requests.',
        'That matters for `gRPC` and HTTP/2. One long-lived connection carries thousands of requests, so a plain connection-level balancer pins them all to one instance. A request-aware proxy spreads them.',
      ],
      keyIdea: 'A sidecar balances per request across the live instance list, which a connection-level balancer cannot do for HTTP/2.',
      metrics: { impl: 'sidecars', mtls: '30%', lat: '~1 ms', parts: '400' },
      scene: {
        nodes: [{ ...opx, status: 'active', chips: ['least requests'] }, { ...payA, chips: ['in flight: 3'] }, { ...payB, chips: ['in flight: 2'] }, { ...payC, chips: ['in flight: 3'] }],
        links: [link('opx', 'payA'), link('opx', 'payB'), link('opx', 'payC')],
        flows: [
          { path: ['opx', 'payA'], tone: 'request', duration: 1.4 },
          { path: ['opx', 'payB'], tone: 'request', duration: 1.4, delay: 0.5 },
          { path: ['opx', 'payC'], tone: 'request', duration: 1.4, delay: 1 },
        ],
        panel: {
          title: 'One HTTP/2 connection',
          icon: 'Scale',
          rows: [
            { text: 'Connection-level balancer', value: 'all 8 to one', tone: 'bad' },
            { text: 'Request-level proxy', value: '3 / 2 / 3', tone: 'good' },
          ],
        },
        caption: 'Each request gets its own pick',
      },
    },
    {
      title: 'Retries',
      tag: 'concept',
      heading: 'One timeout and retry rule for every caller',
      eli5: 'If a teacher drops a note, the helper picks up a fresh copy and tries once more, the same way at every door. The class never sees the drop.',
      body: [
        'A call to payments gets a 2 second deadline and at most 2 retries on connection failures and `5xx` responses, from every caller, in every language.',
        'The retry happens inside the proxy, so the calling service never sees the first `503`. The rule is one block of config, pushed once.',
      ],
      keyIdea: 'Timeouts and retries become one policy applied by the proxy, so the rule is written once.',
      metrics: { impl: 'sidecars', mtls: '30%', lat: '~1 ms', parts: '400' },
      metricTones: { impl: 'good' },
      scene: {
        nodes: [orders, { ...opx, status: 'active', badge: 'retry 1 of 2' }, { ...ppx, status: 'active' }, { ...pay, chips: [{ text: '503 then 200', tone: 'warn' }] }],
        links: [link('orders', 'opx'), link('opx', 'ppx', { label: '2 s deadline' }), link('ppx', 'pay')],
        flows: [
          { path: ['orders', 'opx', 'ppx', 'pay'], tone: 'request', label: 'charge', duration: 1.6 },
          { path: ['pay', 'ppx', 'opx'], tone: 'error', label: '503', duration: 1.2, delay: 1.7 },
          { path: ['opx', 'ppx', 'pay'], tone: 'request', label: 'retry', duration: 1.2, delay: 3 },
          { path: ['pay', 'ppx', 'opx', 'orders'], tone: 'response', label: '200', duration: 1.6, delay: 4.3 },
        ],
        caption: 'The proxy retries. The service never sees the 503',
      },
      code: {
        language: 'yaml',
        title: 'Istio: one retry policy for every caller of payments',
        source: `apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:
  name: payments
spec:
  hosts:
    - payments
  http:
    - route:
        - destination:
            host: payments
      timeout: 2s                 # whole call, retries included
      retries:
        attempts: 2
        perTryTimeout: 500ms
        retryOn: 5xx,connect-failure`,
        highlight: [12, 14, 15, 16],
      },
    },
    {
      title: 'Circuit breaking',
      tag: 'concept',
      heading: 'Stop calling an instance that keeps failing',
      eli5: 'If one teacher keeps dropping notes, the helper stops sending notes there for a while and uses the other teachers. It checks back later to see if that teacher is better.',
      body: [
        '**Outlier detection** removes an instance after a run of failures, for example 5 straight `5xx` responses, for 30 seconds. Then it gets a trial. This protects callers from one bad instance.',
        '**Connection limits** cap how many requests may queue for a service. Past the cap the proxy answers `503` at once instead of letting the queue grow. Failing fast leaves a struggling service room to recover.',
      ],
      keyIdea: 'The proxy ejects failing instances and sheds excess load early, so one weak spot does not drag callers down with it.',
      metrics: { impl: 'sidecars', mtls: '30%', lat: '~1 ms', parts: '400' },
      scene: {
        nodes: [{ ...opx, status: 'active' }, { ...payA, status: 'ok' }, { ...payB, status: 'down', chips: [{ text: '5 x 503: ejected 30 s', tone: 'bad' }] }, { ...payC, status: 'ok' }],
        links: [link('opx', 'payA'), link('opx', 'payB', { style: 'faint', label: 'skipped', labelTone: 'warn' }), link('opx', 'payC')],
        flows: [
          { path: ['opx', 'payA'], tone: 'request', duration: 1.4 },
          { path: ['opx', 'payC'], tone: 'request', duration: 1.4, delay: 0.7 },
        ],
        caption: 'The failing instance gets no traffic for 30 seconds',
      },
      code: {
        language: 'yaml',
        title: 'Istio: eject failing instances, fail fast past a queue cap',
        source: `apiVersion: networking.istio.io/v1
kind: DestinationRule
metadata:
  name: payments
spec:
  host: payments
  trafficPolicy:
    connectionPool:
      http:
        http1MaxPendingRequests: 100  # beyond this, 503 at once
    outlierDetection:
      consecutive5xxErrors: 5
      interval: 10s
      baseEjectionTime: 30s
      maxEjectionPercent: 50          # never eject the whole pool`,
        highlight: [10, 12, 14, 15],
      },
    },
    {
      title: 'Metrics',
      tag: 'concept',
      heading: 'Every proxy reports the same numbers',
      eli5: 'Every helper writes the same tally on the office wall: how many notes, how many dropped, how long they took. Nobody had to teach the classes to count.',
      body: [
        'Each proxy records the same numbers for every call: request count, error rate and latency. They come out under one naming scheme, so a single dashboard works for every service.',
        'You get a full map of who calls whom, and a slow or failing pair stands out, without adding one line of metrics code to a service.',
      ],
      keyIdea: 'Uniform proxy metrics give a service-to-service map and per-pair error and latency numbers with no service code.',
      metrics: { impl: 'sidecars', mtls: '30%', lat: '~1 ms', parts: '400' },
      metricTones: { impl: 'good' },
      scene: {
        nodes: [opx, { ...ppx, status: 'active', badge: 'same stats' }, { ...pay, chips: ['503 then 200'] }, { ...metrics, status: 'ok' }],
        links: [link('opx', 'ppx'), link('ppx', 'pay'), link('ppx', 'metrics', { style: 'dashed', label: 'scrape' })],
        flows: [
          { path: ['opx', 'ppx', 'pay'], tone: 'request', duration: 1.6 },
          { path: ['ppx', 'metrics'], tone: 'event', label: 'stats', duration: 1, delay: 1.8 },
        ],
        panel: {
          title: 'orders to payments, last minute',
          icon: 'Activity',
          rows: [
            { text: 'Requests', value: '120 / s' },
            { text: 'Errors', value: '0.4%', tone: 'good' },
            { text: 'Latency p50', value: '38 ms' },
            { text: 'Latency p99', value: '180 ms', tone: 'warn' },
          ],
        },
        caption: 'Same stats from every proxy',
      },
    },
    {
      title: 'Tracing',
      tag: 'concept',
      heading: 'Traces need one small favor from the service',
      eli5: 'Each helper stamps a ticket number on the note it carries. When a class writes a new note because of an old one, it must copy the ticket number over, or the trail breaks.',
      body: [
        'Proxies create a trace span for each hop and send it to a tracing backend. A trace shows one checkout across every service it touched, with the time spent in each.',
        'There is one catch. The proxy cannot tell that an outgoing call was caused by an incoming one. The service must copy trace headers (`traceparent`, `x-request-id`) from request to downstream calls, or the trace splits in two.',
      ],
      keyIdea: 'The mesh produces the spans, but the service still has to forward the trace headers to stitch them into one trace.',
      metrics: { impl: 'sidecars', mtls: '30%', lat: '~1 ms', parts: '400' },
      scene: {
        nodes: [{ ...orders, chips: [{ text: 'copies trace headers', tone: 'good' }] }, opx, { ...ppx, chips: ['trace 7f3a'] }, pay],
        links: [link('orders', 'opx'), link('opx', 'ppx'), link('ppx', 'pay')],
        flows: [
          { path: ['orders', 'opx', 'ppx', 'pay'], tone: 'request', label: 'trace 7f3a', duration: 2 },
          { path: ['pay', 'ppx', 'opx', 'orders'], tone: 'response', duration: 2, delay: 2.1 },
        ],
        panel: {
          title: 'Trace 7f3a: checkout, 212 ms',
          icon: 'Route',
          rows: [
            { text: 'orders', value: '212 ms' },
            { text: 'payments', value: '120 ms' },
            { text: 'stock', value: '45 ms' },
            { text: 'If headers are dropped', value: '2 broken traces', tone: 'bad' },
          ],
        },
        caption: 'One trace id travels with the request',
      },
    },
    {
      title: 'Control plane',
      tag: 'concept',
      heading: 'The control plane tells the proxies what to do',
      eli5: 'The school office writes the rules and hands every helper the same sheet. The office never carries a note itself. That office is the **control plane**.',
      body: [
        'Nobody edits 400 proxy configs by hand. The **control plane** is a small set of servers that holds your rules, watches which instances exist, and pushes config to every sidecar. A change reaches the fleet in seconds, with no service deploy.',
        'It is **off the request path**. If it goes down, proxies keep serving with the last config they received. What stops is change: new rules, new instances and certificate renewals wait.',
      ],
      keyIdea: 'The control plane configures the proxies and stays out of the request path, so losing it freezes changes and leaves traffic flowing.',
      metrics: { impl: 'sidecars', mtls: '30%', lat: '~1 ms', parts: '400 + control' },
      scene: {
        nodes: [{ ...cp, status: 'active', badge: 'push rules' }, opx, ppx, spx, orders],
        links: [link('cp', 'opx', { style: 'dashed' }), link('cp', 'ppx', { style: 'dashed' }), link('cp', 'spx', { style: 'dashed' }), link('orders', 'opx')],
        flows: [
          { path: ['cp', 'opx'], tone: 'event', label: 'config', duration: 1.2 },
          { path: ['cp', 'ppx'], tone: 'event', duration: 1.2 },
          { path: ['cp', 'spx'], tone: 'event', duration: 1.6 },
          { path: ['orders', 'opx', 'ppx'], tone: 'request', duration: 1.8, delay: 1.6 },
        ],
        caption: 'Rules flow down the dashed lines, requests never do',
      },
      quiz: {
        question: 'The control plane crashes and stays down for ten minutes. What happens to calls between services that were already running?',
        options: [
          'They all fail, because every request is routed through the control plane',
          'They keep working with the last config the proxies received, but new rules and new instances are not picked up',
          'The proxies switch themselves off and services talk to each other directly',
          'Only encrypted calls fail',
        ],
        answer: 1,
        explain: 'The control plane sits off the request path. Proxies hold their config in memory and keep using it. What you lose is change: config pushes, discovery of new instances and certificate renewals.',
      },
    },
    {
      title: 'Mutual TLS',
      tag: 'concept',
      heading: 'Mutual TLS: both sides prove who they are',
      eli5: 'Every hall helper wears a badge from the school office. Two helpers show each other their badges before a note changes hands, and they pass it in a sealed envelope. That is **mutual TLS**.',
      body: [
        'In ordinary TLS only the server shows a certificate. In **mutual TLS** (mTLS) the caller shows one too. Each sidecar holds a certificate naming its service, such as `orders`, issued by the control plane and rotated every few hours.',
        'Every internal call is encrypted, so card numbers cannot be read off the wire, and each proxy knows who is calling. Services still send plain HTTP to their sidecar. Before, this was a project in each of four languages.',
      ],
      keyIdea: 'mTLS gives every service a verified identity and encrypts every hop, without any service handling a certificate.',
      metrics: { impl: 'sidecars', mtls: '100%', lat: '~1 ms', parts: '400 + control' },
      metricTones: { mtls: 'good' },
      scene: {
        nodes: [{ ...opx, status: 'ok', chips: [{ text: 'cert: orders', tone: 'good' }] }, { ...ppx, status: 'ok', chips: [{ text: 'cert: payments', tone: 'good' }] }, { ...cp, badge: 'issues certs' }],
        links: [link('cp', 'opx', { style: 'dashed' }), link('cp', 'ppx', { style: 'dashed' }), link('opx', 'ppx', { label: 'encrypted', arrow: 'both' })],
        flows: [
          { path: ['cp', 'opx'], tone: 'data', label: 'cert', duration: 1 },
          { path: ['cp', 'ppx'], tone: 'data', label: 'cert', duration: 1 },
          { path: ['opx', 'ppx'], tone: 'handshake', label: 'I am orders', duration: 1, delay: 1.2 },
          { path: ['ppx', 'opx'], tone: 'handshake', label: 'I am payments', duration: 1, delay: 2.3 },
          { path: ['opx', 'ppx'], tone: 'request', label: 'charge', duration: 1.4, delay: 3.4 },
        ],
        caption: 'Both proxies show a certificate before any data moves',
      },
      code: {
        language: 'yaml',
        title: 'Istio: require mTLS for the whole mesh',
        source: `apiVersion: security.istio.io/v1
kind: PeerAuthentication
metadata:
  name: default
  namespace: istio-system        # root namespace = whole mesh
spec:
  mtls:
    mode: STRICT                 # refuse plain-text calls`,
        highlight: [5, 8],
      },
    },
    {
      title: 'Authorization',
      tag: 'concept',
      heading: 'Rules written against identities',
      eli5: 'The office tells the payments teacher\'s helper: only accept notes from the orders class. A note from any other class is turned away at the door, whatever it says.',
      body: [
        'Because each proxy knows the caller\'s verified identity, you can write rules like "only `orders` may call `payments`". A call from `stock` is refused with `403` before it reaches the service.',
        'Network location no longer decides trust. Someone who gets onto the network still has no certificate for a service they are not.',
      ],
      keyIdea: 'mTLS identities turn access rules into config: allow named services, refuse the rest, without trusting the network.',
      metrics: { impl: 'sidecars', mtls: '100%', lat: '~1 ms', parts: '400 + control' },
      metricTones: { mtls: 'good' },
      scene: {
        nodes: [orders, opx, { ...ppx, status: 'active', chips: [{ text: 'allow: orders', tone: 'good' }] }, pay, spx],
        links: [link('orders', 'opx'), link('opx', 'ppx'), link('ppx', 'pay'), link('spx', 'ppx', { route: 'straight', label: 'cert: stock', labelTone: 'warn' })],
        flows: [
          { path: ['orders', 'opx', 'ppx', 'pay'], tone: 'request', label: 'charge', duration: 1.8 },
          { path: ['spx', 'ppx'], tone: 'request', label: 'charge', duration: 1.2, delay: 1.9 },
          { path: ['ppx', 'spx'], tone: 'error', label: '403', duration: 1.2, delay: 3.2 },
        ],
        caption: 'Only orders gets through to payments',
      },
      code: {
        language: 'yaml',
        title: 'Istio: only orders may call payments',
        source: `apiVersion: security.istio.io/v1
kind: AuthorizationPolicy
metadata:
  name: payments-callers
  namespace: shop
spec:
  selector:
    matchLabels:
      app: payments
  action: ALLOW
  rules:
    - from:
        - source:
            principals: ["cluster.local/ns/shop/sa/orders"]`,
        highlight: [10, 14],
      },
    },
    {
      title: 'Traffic shifting',
      tag: 'concept',
      heading: 'Send 5% of calls to the new version',
      eli5: 'A new teacher starts in the room next door. The office tells the helpers to take 1 note in every 20 to the new teacher, and watches how it goes before sending more.',
      body: [
        'Payments v2 is ready. Without a mesh, the share of traffic a version gets follows its share of instances: to give v2 5% you would run 19 old instances for each new one.',
        'With a mesh, routing is a rule in the caller\'s proxy. You write "95% to v1, 5% to v2" and the control plane pushes it out. One v2 instance takes exactly 5%.',
      ],
      keyIdea: 'A mesh separates how much traffic a version receives from how many instances it has, which makes a gradual release a config change.',
      metrics: { impl: 'sidecars', mtls: '100%', lat: '~1 ms', parts: '400 + control' },
      scene: {
        nodes: [orders, { ...opx, status: 'active', badge: 'split 95 / 5' }, { ...pay, label: 'payments v1', chips: ['95%'] }, { ...pay2, status: 'ok', chips: [{ text: '5%', tone: 'good' }] }, cp],
        links: [link('orders', 'opx'), link('opx', 'pay'), link('opx', 'pay2'), link('cp', 'opx', { style: 'dashed' })],
        flows: [
          { path: ['cp', 'opx'], tone: 'event', label: 'weights', duration: 1 },
          { path: ['orders', 'opx', 'pay'], tone: 'request', count: 6, duration: 2, delay: 1.2 },
          { path: ['orders', 'opx', 'pay2'], tone: 'request', label: '1 in 20', duration: 2, delay: 1.8 },
        ],
        caption: 'The split happens in the caller\'s proxy',
      },
      code: {
        language: 'yaml',
        title: 'Istio: weighted routing (v1 and v2 are subsets from a DestinationRule)',
        source: `apiVersion: networking.istio.io/v1
kind: VirtualService
metadata:
  name: payments
spec:
  hosts:
    - payments
  http:
    - route:
        - destination:
            host: payments
            subset: v1
          weight: 95
        - destination:
            host: payments
            subset: v2
          weight: 5               # raise in steps, or set to 0 to back out`,
        highlight: [13, 17],
      },
    },
    {
      title: 'Ramp up',
      tag: 'concept',
      heading: 'Raise the weight, or set it back to zero',
      eli5: 'If the new teacher does well, the office sends more notes there. If notes start getting lost, it tells every helper to stop at once, and they all stop within seconds.',
      body: [
        'The proxies already report error rate and latency per version. If v2 looks healthy you move to 25%, 50%, 100%. If its errors climb, you set the weight back to 0 and it takes effect in seconds, with no rollback deploy.',
        'The same mechanism routes by header, so testers who send `x-canary: true` reach v2 before any shopper does.',
      ],
      keyIdea: 'Per-version metrics decide each step of the ramp, and backing out is another weight change.',
      metrics: { impl: 'sidecars', mtls: '100%', lat: '~1 ms', parts: '400 + control' },
      scene: {
        nodes: [{ ...opx, status: 'active' }, { ...pay, label: 'payments v1' }, { ...pay2, status: 'ok', chips: [{ text: 'errors 0.3%', tone: 'good' }] }, { ...cp, badge: 'weight 25' }],
        links: [link('opx', 'pay'), link('opx', 'pay2'), link('cp', 'opx', { style: 'dashed' })],
        flows: [
          { path: ['cp', 'opx'], tone: 'event', label: 'weight 25', duration: 1 },
          { path: ['opx', 'pay'], tone: 'request', count: 3, duration: 1.6, delay: 1.2 },
          { path: ['opx', 'pay2'], tone: 'request', duration: 1.6, delay: 1.4 },
        ],
        panel: {
          title: 'Ramp plan for v2',
          icon: 'TrendingUp',
          rows: [
            { text: '5%', value: 'errors 0.2%', tone: 'good' },
            { text: '25%', value: 'errors 0.3%', tone: 'good' },
            { text: '50%', value: 'p99 +40 ms', tone: 'warn' },
            { text: 'Back out: weight 0', value: 'seconds', tone: 'muted' },
          ],
          footer: { text: 'Header x-canary: true always reaches v2', tone: 'muted' },
        },
        caption: 'The numbers decide the next step',
      },
    },
    {
      title: 'Mirror and faults',
      tag: 'concept',
      heading: 'Test with copies of live traffic, and with planted faults',
      eli5: 'The helper makes a photocopy of each note for the new teacher to practice on and throws the answer away. The office can also tell a helper to delay a note on purpose, to see who copes.',
      body: [
        '**Mirroring** sends a copy of live requests to v2 and discards its replies, so v2 sees real traffic with no shopper affected. Only mirror calls that are safe to repeat.',
        '**Fault injection** makes the proxy add a delay or return an error for a share of calls, such as 10% delayed by 3 s. It tests whether callers handle a slow dependency before a real one hits.',
      ],
      keyIdea: 'Mirroring and fault injection let you test a version and its callers on live traffic without risking shoppers.',
      metrics: { impl: 'sidecars', mtls: '100%', lat: '~1 ms', parts: '400 + control' },
      scene: {
        nodes: [orders, { ...opx, status: 'active', badge: 'mirror 100%' }, { ...pay, label: 'payments v1', chips: [{ text: '10% delayed 3 s', tone: 'warn' }] }, { ...pay2, chips: [{ text: 'copies, replies dropped', tone: 'good' }] }],
        links: [link('orders', 'opx'), link('opx', 'pay'), link('opx', 'pay2', { style: 'dashed', label: 'mirror' })],
        flows: [
          { path: ['orders', 'opx', 'pay'], tone: 'request', label: 'charge', duration: 2 },
          { path: ['opx', 'pay2'], tone: 'data', label: 'copy', duration: 1.4, delay: 1.4 },
          { path: ['pay', 'opx', 'orders'], tone: 'response', duration: 1.8, delay: 2.1 },
        ],
        panel: {
          title: 'Istio route options',
          icon: 'Code',
          code: 'mirror:\n  host: payments\n  subset: v2\nmirrorPercentage: { value: 100 }\nfault:\n  delay:\n    percentage: { value: 10 }\n    fixedDelay: 3s',
        },
        caption: 'The copy goes to v2. The shopper only sees v1',
      },
    },
    {
      title: 'Two directions',
      tag: 'concept',
      heading: 'The gateway faces out, the mesh works inside',
      eli5: 'The guard at the front gate checks everyone coming in from the street. The hall helpers handle notes between classrooms inside. Both jobs are needed in a big school.',
      body: [
        'Traffic from the internet into your system is **north-south**. An **API gateway** handles it: TLS, authentication and rate limits at the front door.',
        'Calls between your own services are **east-west**. The mesh handles those. Many systems run both, a gateway at the edge and a mesh inside.',
      ],
      keyIdea: 'A gateway covers north-south traffic and a mesh covers east-west traffic, and they work together.',
      metrics: { impl: 'sidecars', mtls: '100%', lat: '~1 ms', parts: '400 + control' },
      scene: {
        nodes: [client, { ...edge, status: 'active' }, orders, opx, ppx],
        links: [link('client', 'edge', { label: 'north-south' }), link('edge', 'orders'), link('orders', 'opx'), link('opx', 'ppx', { label: 'east-west · mTLS' })],
        flows: [
          { path: ['client', 'edge', 'orders'], tone: 'request', label: 'checkout', duration: 1.8 },
          { path: ['orders', 'opx', 'ppx'], tone: 'request', label: 'charge', duration: 1.8, delay: 1.9 },
        ],
        panel: {
          title: 'Who does what',
          icon: 'ArrowLeftRight',
          rows: [
            { text: 'Gateway', value: 'TLS, auth, limits' },
            { text: 'Mesh', value: 'mTLS, retries, routing' },
            { text: 'Gateway sees', value: 'the internet' },
            { text: 'Mesh sees', value: 'service to service' },
          ],
        },
        caption: 'Two layers, two directions of traffic',
      },
    },
    {
      title: 'Double retries',
      tag: 'case',
      heading: 'Case: the retries nobody removed',
      eli5: 'A class sends the same note three times when it hears nothing back. Its helper also tries three times for each one. The poor teacher at the other end gets nine notes.',
      body: [
        'The team turns on mesh retries with 3 attempts. The orders service still has its old library, which also makes 3 attempts. Nobody deleted it.',
        'Each library attempt becomes 3 proxy attempts, so one checkout can send **9 calls** to a service that is already struggling. Retries at two layers multiply. The mesh made the storm from step 2 worse.',
      ],
      keyIdea: 'Retries at two layers multiply, so a mesh does not remove the need to think about them.',
      metrics: { impl: 'library + sidecar', mtls: '100%', lat: 'seconds', parts: '400 + control' },
      metricTones: { impl: 'bad', lat: 'bad' },
      scene: {
        nodes: [{ ...orders, status: 'hot', chips: [{ text: 'library: 3 attempts', tone: 'warn' }] }, { ...opx, status: 'hot', chips: [{ text: 'proxy: 3 attempts', tone: 'warn' }] }, { ...pay, status: 'hot', load: 95, badge: '9 calls' }],
        links: [link('orders', 'opx'), link('opx', 'pay', { label: '3 x 3 = 9', labelTone: 'warn' })],
        flows: [
          { path: ['orders', 'opx'], tone: 'request', count: 3, duration: 1 },
          { path: ['opx', 'pay'], tone: 'request', count: 9, duration: 1.4, delay: 1 },
          { path: ['pay', 'opx'], tone: 'error', label: '503', count: 3, duration: 1.4, delay: 2.5 },
        ],
        caption: '3 attempts times 3 attempts is 9 calls',
      },
      quiz: {
        question: 'The orders library retries 3 times, and the mesh proxy also retries 3 times. One checkout fails against payments. How many calls can reach payments?',
        options: ['3', '6', '9', '12'],
        answer: 2,
        explain: 'Each of the 3 library attempts is retried up to 3 times by the proxy, so the attempts multiply to 9. Keep retries in one layer and cap them with a budget.',
      },
    },
    {
      title: 'Safe retries',
      tag: 'case',
      heading: 'Keep retries in one layer, and only for safe calls',
      eli5: 'The office should let only one person resend notes, and never resend a note that says "give her a cookie". The cookie would be handed out twice.',
      body: [
        'The proxy sees bytes and status codes. It cannot know that repeating `POST /charge` might bill a card twice. Retry only what is safe to repeat, or give the call an idempotency key so the receiver can drop the duplicate.',
        'Keep retries in one layer, cap the total with a retry budget (for example, retries may add at most 20% extra load), and let the proxy stop calling an instance that keeps failing.',
      ],
      keyIdea: 'Retry in one layer, with a budget, and only for calls that are safe to repeat.',
      metrics: { impl: 'sidecars', mtls: '100%', lat: '~1 ms', parts: '400 + control' },
      metricTones: { impl: 'good' },
      scene: {
        nodes: [{ ...orders, chips: [{ text: 'no retries here', tone: 'good' }] }, { ...opx, status: 'ok', chips: [{ text: 'budget: 20%', tone: 'good' }] }, pay],
        links: [link('orders', 'opx'), link('opx', 'pay')],
        flows: [
          { path: ['orders', 'opx', 'pay'], tone: 'request', label: 'POST /charge key=a91', duration: 1.8 },
          { path: ['pay', 'opx', 'orders'], tone: 'response', label: '200', duration: 1.8, delay: 1.9 },
        ],
        panel: {
          title: 'What may be retried',
          icon: 'Repeat',
          rows: [
            { text: 'GET /orders/9001', value: 'safe', tone: 'good' },
            { text: 'PUT /orders/9001', value: 'safe, same result', tone: 'good' },
            { text: 'POST /charge', value: 'only with a key', tone: 'warn' },
            { text: 'POST /charge, no key', value: 'never', tone: 'bad' },
          ],
        },
        caption: 'The receiver drops a duplicate key',
      },
    },
    {
      title: 'Latency',
      tag: 'tradeoff',
      heading: 'What the mesh costs: latency',
      eli5: 'Every note now passes through two extra pairs of hands, so it arrives a little later. One note barely notices. A note that makes six trips notices more.',
      body: [
        'Every call crosses two proxies. Assume the pair adds about **1 ms**. A checkout that fans out through 6 calls pays about 6 ms more, and the slow tail grows more than the average does.',
        'For a 200 ms page that is noise. For a service with a 5 ms budget it is a real share.',
      ],
      keyIdea: 'A mesh adds about a millisecond per call, which hurts only where the latency budget is tight.',
      metrics: { impl: 'sidecars', mtls: '100%', lat: '~1 ms', parts: '400 + control' },
      metricTones: { lat: 'warn' },
      scene: {
        nodes: [orders, { ...opx, status: 'hot', chips: [{ text: '+0.5 ms', tone: 'warn' }] }, { ...ppx, status: 'hot', chips: [{ text: '+0.5 ms', tone: 'warn' }] }, pay],
        links: [link('orders', 'opx'), link('opx', 'ppx', { label: '+1 ms per call', labelTone: 'warn' }), link('ppx', 'pay')],
        flows: [
          { path: ['orders', 'opx', 'ppx', 'pay'], tone: 'request', duration: 2.6 },
          { path: ['pay', 'ppx', 'opx', 'orders'], tone: 'response', duration: 2.6, delay: 2.7 },
        ],
        panel: {
          title: 'Extra time in a checkout',
          icon: 'Timer',
          rows: [
            { text: 'One call', value: '+1 ms' },
            { text: 'Checkout, 6 calls', value: '+6 ms', tone: 'warn' },
            { text: 'Against a 200 ms page', value: '3%', tone: 'good' },
            { text: 'Against a 5 ms budget', value: '120%', tone: 'bad' },
          ],
        },
        caption: 'Two extra hops on every call',
      },
    },
    {
      title: 'Run cost',
      tag: 'tradeoff',
      heading: 'What the mesh costs: memory and people',
      eli5: 'The school has to hire, train and look after a helper for every single door. And if the office hands out a bad rule sheet, every helper follows it at once.',
      body: [
        '**Resources.** 400 sidecars each need memory and CPU. At 50 MB each, that is 20 GB of RAM spent on plumbing before any business logic runs.',
        '**Operations.** The mesh is a distributed system of its own. Someone upgrades 400 proxies without dropping traffic, keeps the control plane healthy and debugs requests with two more hops. A bad config push reaches every proxy as fast as a good one.',
      ],
      keyIdea: 'A mesh trades duplicated code in services for a new layer that someone has to run.',
      metrics: { impl: 'sidecars', mtls: '100%', lat: '~1 ms', parts: '400 + control' },
      metricTones: { parts: 'warn' },
      scene: {
        nodes: [{ ...opx, status: 'hot', chips: [{ text: '50 MB', tone: 'warn' }] }, { ...ppx, status: 'hot', chips: [{ text: '50 MB', tone: 'warn' }] }, { ...spx, status: 'hot', chips: [{ text: '50 MB', tone: 'warn' }] }, { ...cp, status: 'hot', badge: 'yours to run' }],
        links: [link('cp', 'opx', { style: 'dashed' }), link('cp', 'ppx', { style: 'dashed' }), link('cp', 'spx', { style: 'dashed' })],
        flows: [{ path: ['cp', 'ppx'], tone: 'event', label: 'bad config', duration: 1.6 }, { path: ['cp', 'spx'], tone: 'event', duration: 1.6 }],
        panel: {
          title: 'The bill',
          icon: 'Server',
          rows: [
            { text: 'Sidecar memory, 400 x 50 MB', value: '20 GB', tone: 'warn' },
            { text: 'Proxies to upgrade', value: '400', tone: 'warn' },
            { text: 'Control plane', value: 'a new system', tone: 'warn' },
            { text: 'Bad push reaches', value: 'all proxies', tone: 'bad' },
          ],
        },
        caption: '400 extra processes and one new system',
      },
    },
    {
      title: 'Newer designs',
      tag: 'tradeoff',
      heading: 'Lighter ways to run a mesh',
      eli5: 'Instead of a helper at every door, the school puts one helper in each hallway. The cost drops. The hall helpers still have to be trained and looked after.',
      body: [
        'Newer designs share one proxy per machine instead of one per pod, or do part of the work in the kernel with eBPF. Istio\'s ambient mode and Cilium Service Mesh take these routes.',
        'They cut memory and per-pod overhead. They do not remove the control plane or the need to operate the mesh. Istio, Linkerd and Consul Connect are the common choices.',
      ],
      keyIdea: 'Shared-proxy and kernel designs lower the cost of a mesh without removing the operational work.',
      metrics: { impl: 'shared proxy', mtls: '100%', lat: '<1 ms', parts: '10 + control' },
      metricTones: { parts: 'good' },
      scene: {
        zones: [pod('node1', 'machine 1', orders, opx), pod('node2', 'machine 2', ppx, pay)],
        nodes: [orders, { ...opx, label: 'node proxy', sub: 'one per machine', status: 'ok', chips: [{ text: 'shared by every pod', tone: 'good' }] }, { ...ppx, label: 'node proxy', sub: 'one per machine', status: 'ok' }, pay],
        links: [link('orders', 'opx'), link('opx', 'ppx', { label: 'mTLS' }), link('ppx', 'pay')],
        flows: [
          { path: ['orders', 'opx', 'ppx', 'pay'], tone: 'request', duration: 2.4 },
          { path: ['pay', 'ppx', 'opx', 'orders'], tone: 'response', duration: 2.4, delay: 2.5 },
        ],
        caption: 'One proxy per machine instead of one per pod',
      },
    },
    {
      title: 'Need a mesh?',
      tag: 'tradeoff',
      heading: 'When a library or a gateway is enough',
      eli5: 'A tiny school with five classrooms does not need a helper at every door. One guard at the front gate and one shared rule sheet do the job.',
      body: [
        '**One language, a handful of services:** a shared client library gives the same timeouts, retries and metrics with no extra hops. Its weakness is upgrades, since every service must pick up each new version. With 8 services that is an afternoon.',
        '**A mesh earns its place** with dozens of services in several languages, a requirement to encrypt and authorize every internal call, or frequent gradual releases. A team with 6 services in Go would be buying 400 problems to solve 6.',
      ],
      keyIdea: 'Pick the smallest tool that makes network behavior uniform: a library for one language, a gateway for the edge, a mesh for many services in many languages.',
      metrics: { impl: 'shared library', mtls: 'edge only', lat: '0 ms', parts: '1 gateway' },
      scene: {
        nodes: [client, { ...edge, status: 'active', chips: ['TLS, auth, limits'] }, { ...orders, chips: ['shared lib'] }, { ...pay, chips: ['shared lib'] }, { ...stock, sub: 'Go', chips: ['shared lib'] }],
        links: [link('client', 'edge'), link('edge', 'orders'), link('orders', 'pay'), link('orders', 'stock')],
        flows: [
          { path: ['client', 'edge', 'orders'], tone: 'request', label: 'checkout', duration: 1.6 },
          { path: ['orders', 'pay'], tone: 'request', duration: 1.2, delay: 1.7 },
          { path: ['orders', 'stock'], tone: 'request', duration: 1.2, delay: 1.7 },
          { path: ['orders', 'edge', 'client'], tone: 'response', duration: 1.6, delay: 3 },
        ],
        caption: 'Small system: a gateway at the edge, a library inside',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'One proxy beside every service, one place to set the rules',
      eli5: 'Helpers at every door carry the notes, check badges and follow one rule sheet from the office. It works well in a big school and is too much for a tiny one.',
      body: [
        'A **sidecar** next to each service takes over load balancing, timeouts, retries, circuit breaking, encryption and metrics. The proxies form the **data plane**. The **control plane** pushes rules and certificates and stays off the request path.',
        '**mTLS** encrypts every internal call and names each caller. **Traffic shifting** turns a release into a weight. The cost is about 1 ms per call, 400 more processes and a system to run. With few services or one language, a library plus a gateway is the better deal.',
      ],
      keyIdea: 'A mesh pays off when the cost of keeping network behavior consistent across services is higher than the cost of running the mesh.',
      metrics: { impl: 'sidecars', mtls: '100%', lat: '~1 ms', parts: '400 + control' },
      metricTones: { impl: 'good', mtls: 'good', lat: 'warn', parts: 'warn' },
      scene: {
        nodes: [orders, { ...opx, status: 'ok' }, { ...ppx, status: 'ok' }, pay, { ...cp, status: 'ok' }],
        links: [link('orders', 'opx'), link('opx', 'ppx'), link('ppx', 'pay'), link('cp', 'opx', { style: 'faint' }), link('cp', 'ppx', { style: 'faint' })],
        flows: [
          { path: ['orders', 'opx', 'ppx', 'pay'], tone: 'request', duration: 2 },
          { path: ['pay', 'ppx', 'opx', 'orders'], tone: 'response', duration: 2, delay: 2.2 },
          { path: ['cp', 'ppx'], tone: 'event', duration: 1.2, delay: 4.3 },
        ],
      },
      quiz: {
        question: 'A team runs 6 services, all in Go, behind an API gateway. They want consistent timeouts and retries on internal calls. What is the most sensible first step?',
        options: [
          'Install a service mesh so every pod gets a sidecar',
          'Put the internal calls through the API gateway as well',
          'Share one client library with the timeout and retry rules built in',
          'Let each service keep its own rules and document them',
        ],
        answer: 2,
        explain: 'With one language and 6 services, a shared library gives uniform behavior with no extra hops and nothing new to operate. A mesh starts to pay off with many services, several languages, or a need for mTLS on every internal call.',
      },
    },
  ],
};
