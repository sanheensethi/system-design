import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const phone: SceneNode = { id: 'phone', kind: 'phone', at: at(-3.8, -3.8), label: 'mobile app', sub: '100 ms RTT' };
const gw: SceneNode = { id: 'gw', kind: 'block', at: at(0, -3.8), label: 'API gateway', sub: 'api.shop.example', icon: 'Network', tint: 'violet' };
const limiter: SceneNode = { id: 'limiter', kind: 'block', size: 0.72, at: at(3.8, -3.8), label: 'rate limiter', sub: 'Redis counters', icon: 'Gauge', tint: 'amber' };
const users: SceneNode = { id: 'users', kind: 'block', size: 0.72, at: at(-5.4, 3.8), label: 'users', sub: '/users', icon: 'Users', tint: 'blue' };
const orders: SceneNode = { id: 'orders', kind: 'block', size: 0.72, at: at(-1.8, 3.8), label: 'orders', sub: '/orders', icon: 'ShoppingBag', tint: 'amber' };
const catalog: SceneNode = { id: 'catalog', kind: 'block', size: 0.72, at: at(1.8, 3.8), label: 'catalog', sub: '/catalog', icon: 'Package', tint: 'teal' };
const recs: SceneNode = { id: 'recs', kind: 'block', size: 0.72, at: at(5.4, 3.8), label: 'recommend', sub: '/recs', icon: 'Star', tint: 'green' };
const services = [users, orders, catalog, recs];

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });
const fan = (extra: Partial<SceneLink> = {}) => services.map((s) => link('gw', s.id, extra));
const activeServices = services.map((s) => ({ ...s, status: 'active' as const }));

export const apiGatewayPart2: Lesson = {
  id: 'api-gateway-part-2',
  title: 'Reverse proxies and API gateways (part 2)',
  tagline: 'Aggregation, backends for frontends, caching, resilience, the god box trap and gateway versus mesh.',
  minutes: 12,
  level: 'Intermediate',
  learn: [
    'Transformation, validation, aggregation and backends for frontends',
    'Caching and observability at the gateway',
    'Timeouts and circuit breakers so one slow service stays local',
    'Why a fat gateway becomes a bottleneck, and how to keep it thin and replicated',
    'Gateway versus service mesh, and build versus buy',
  ],
  metrics: [
    { key: 'trips', label: 'Client round trips', icon: 'Repeat' },
    { key: 'latency', label: 'Home screen', icon: 'Timer' },
    { key: 'auth', label: 'Auth code copies', icon: 'Key' },
    { key: 'overhead', label: 'Time in gateway', icon: 'Gauge' },
  ],
  steps: [
    {
      title: 'Still chatty',
      tag: 'problem',
      heading: 'The gateway routes, but the phone still does the work',
      eli5: 'The front desk now sends guests to the right back room, but the guest still walks to four rooms and carries back four heavy trays. The desk can do more than point.',
      body: [
        'Part 1 gave the shop one door with auth and limits. The home screen still makes four calls, each returning a full resource, and a malformed request still reaches a service before it fails.',
        'The gateway sees every request, so it can validate, reshape and combine them. That is where it starts to earn its keep, and where it can start to overreach.',
      ],
      keyIdea: 'A routing-only gateway leaves round trips and bad requests for clients and services to deal with.',
      metrics: { trips: '4', latency: '440 ms', auth: '1', overhead: '0.8 ms' },
      metricTones: { trips: 'bad', latency: 'bad' },
      scene: {
        nodes: [{ ...phone, status: 'hot', badge: '4 round trips' }, { ...gw, status: 'active' }, users, orders],
        links: [link('phone', 'gw', { label: '4G · 100 ms each', labelTone: 'warn' }), link('gw', 'users'), link('gw', 'orders')],
        flows: [
          { path: ['phone', 'gw', 'users', 'gw', 'phone'], tone: 'request', label: '1', duration: 1.8 },
          { path: ['phone', 'gw', 'orders', 'gw', 'phone'], tone: 'request', label: '2', duration: 1.8, delay: 1.9 },
        ],
        panel: {
          title: 'Still on the client',
          icon: 'List',
          rows: [
            { text: 'Round trips per screen', value: '4', tone: 'bad' },
            { text: 'Bad requests reach services', value: 'yes', tone: 'warn' },
            { text: 'Payload shape', value: 'whatever services send', tone: 'warn' },
          ],
        },
        caption: 'Routed, but still four trips',
      },
    },
    {
      title: 'Transform',
      tag: 'concept',
      heading: 'Transform and validate requests',
      eli5: 'The desk checks the order slip is filled in properly before it goes to the kitchen, and can translate a slip written in another language.',
      body: [
        'The gateway can validate a request against a schema and answer `400` for malformed JSON, missing fields or oversized bodies, before any service spends CPU on it.',
        'It can also **transform**: add or strip headers, rename fields for old clients, or translate protocols, for example public REST to internal gRPC.',
      ],
      keyIdea: 'Cheap structural checks and format translation belong at the edge. Business rules do not.',
      metrics: { trips: '4', latency: '440 ms', auth: '1', overhead: '1 ms' },
      scene: {
        nodes: [{ ...phone, chips: [{ text: 'POST /orders', tone: 'warn' }] }, { ...gw, status: 'active', badge: 'schema check' }, { ...orders, chips: ['gRPC CreateOrder'] }],
        links: [link('phone', 'gw', { label: 'REST + JSON' }), link('gw', 'orders', { label: 'gRPC' })],
        flows: [
          { path: ['phone', 'gw'], tone: 'request', label: '{"qty": "two"}', duration: 1.2 },
          { path: ['gw', 'phone'], tone: 'error', label: '400', duration: 1, delay: 1.3 },
          { path: ['phone', 'gw', 'orders'], tone: 'request', label: '{"qty": 2}', duration: 1.6, delay: 2.5 },
        ],
        panel: {
          title: 'Gateway checks',
          icon: 'Code',
          rows: [
            { text: 'JSON is well formed', value: 'yes', tone: 'good' },
            { text: 'qty is a number', value: 'no, 400', tone: 'bad' },
            { text: 'Body under 1 MB', value: 'yes', tone: 'good' },
          ],
        },
        caption: 'Malformed calls never reach a service',
      },
    },
    {
      title: 'Aggregation',
      tag: 'concept',
      heading: 'One call from the phone, four calls inside',
      eli5: 'The guest used to make four trips. Now the guest asks the front desk once, the desk calls all four back rooms at the same time and hands over one tray. That is **aggregation**.',
      body: [
        'The gateway can offer one endpoint, `GET /home`, that calls the four services **in parallel** and merges the results.',
        'Inside the datacenter a round trip is about 0.5 ms. Four parallel calls finish in the time of the slowest one, say 30 ms. The phone pays one 100 ms round trip instead of four, so the home screen drops from 420 ms to about 140 ms.',
      ],
      keyIdea: 'Move fan-out from the slow link to the fast one. Aggregate inside the datacenter and send the client one response.',
      metrics: { trips: '1', latency: '120 ms', auth: '1', overhead: '11 ms' },
      metricTones: { trips: 'good', latency: 'good', auth: 'good' },
      scene: {
        nodes: [phone, { ...gw, status: 'active', badge: 'GET /home · 4 calls' }, ...activeServices.filter((x) => x.id !== 'catalog')],
        links: [link('phone', 'gw', { label: '1 trip · 100 ms' }), ...fan({ label: undefined }).filter((l) => l.to !== 'catalog')],
        flows: [
          { path: ['phone', 'gw'], tone: 'request', label: 'GET /home', duration: 1.2 },
          ...['users', 'orders', 'recs'].map((id) => ({ path: ['gw', id], tone: 'request' as const, duration: 0.8, delay: 1.3 })),
          ...['users', 'orders', 'recs'].map((id) => ({ path: [id, 'gw'], tone: 'response' as const, duration: 0.8, delay: 2.2 })),
          { path: ['gw', 'phone'], tone: 'response', label: 'one JSON', duration: 1.2, delay: 3.1 },
        ],
        caption: 'Parallel calls inside, one round trip outside',
      },
      quiz: {
        question: 'Mobile RTT is 100 ms, in-datacenter calls take 30 ms each. Why does a /home aggregation endpoint cut latency so much?',
        options: [
          'The gateway caches every response forever',
          'It replaces four sequential 100 ms mobile round trips with one, and runs the inner calls in parallel on a fast network',
          'Services respond faster when called by a gateway',
          'It compresses the responses better than the services can',
        ],
        answer: 1,
        explain: 'The expensive part was the mobile round trips. Fan-out on the 0.5 ms datacenter network costs little, and parallel calls cost only as much as the slowest one.',
      },
    },
    {
      title: 'BFF',
      tag: 'concept',
      heading: 'One gateway per client type: the BFF',
      eli5: 'The phone guest wants a small tray, and the big-screen guest wants a full banquet. So the hotel keeps one desk for each kind of guest, each packing the tray its guest likes.',
      body: [
        'A gateway built for one client type is a **backend for frontend** (BFF). The mobile BFF returns a small payload with only the fields the screen shows. The web BFF returns more.',
        'Each BFF is owned by the client team, so a new screen does not wait on a shared gateway team. GraphQL servers often fill this role.',
      ],
      keyIdea: 'A BFF shapes responses for one client and lets that client team move without a shared bottleneck.',
      metrics: { trips: '1', latency: '120 ms', auth: '1', overhead: '11 ms' },
      scene: {
        nodes: [
          { ...phone, at: at(-5.2, -5) },
          { id: 'web', kind: 'client', at: at(5.2, -5), label: 'web app', sub: 'wide screen' },
          { ...gw, id: 'bffm', at: at(-1.8, -0.5), label: 'mobile BFF', sub: '3 KB payload', tint: 'blue' },
          { ...gw, id: 'bffw', at: at(1.8, -0.5), label: 'web BFF', sub: '20 KB payload', tint: 'teal' },
          { ...orders, at: at(0, 4.4) },
        ],
        links: [link('phone', 'bffm'), link('web', 'bffw'), link('bffm', 'orders'), link('bffw', 'orders')],
        flows: [
          { path: ['phone', 'bffm', 'orders'], tone: 'request', duration: 1.6 },
          { path: ['web', 'bffw', 'orders'], tone: 'request', duration: 1.6, delay: 0.8 },
        ],
        panel: {
          title: 'Same data, two shapes',
          icon: 'Layers',
          rows: [
            { text: 'Mobile BFF', value: '3 KB, 6 fields' },
            { text: 'Web BFF', value: '20 KB, 25 fields' },
          ],
          footer: { text: 'Each owned by its client team', tone: 'muted' },
        },
        caption: 'Each client gets the response it needs',
      },
    },
    {
      title: 'Edge cache',
      tag: 'concept',
      heading: 'The gateway can cache responses',
      eli5: 'If many guests ask for the same menu, the desk keeps a copy and hands it out without bothering the kitchen.',
      body: [
        'For public reads such as `GET /catalog/42`, the gateway can keep the response for 30 seconds and serve repeats itself. The catalog service sees one call instead of thousands.',
        'Cache only responses that are the same for every user, and respect `Cache-Control`. Per-user data in a shared cache leaks between users.',
      ],
      keyIdea: 'Cache shared, read-only responses at the gateway. Never cache per-user data in a shared cache.',
      metrics: { trips: '1', latency: '120 ms', auth: '1', overhead: '1 ms' },
      scene: {
        nodes: [phone, { ...gw, status: 'ok', badge: 'cache hit', chips: [{ text: 'GET /catalog/42', tone: 'good' }] }, { ...catalog, status: 'dim', chips: ['1 call / 30 s'] }],
        links: [link('phone', 'gw'), link('gw', 'catalog', { style: 'dashed', label: 'only on a miss' })],
        flows: [
          { path: ['phone', 'gw', 'phone'], tone: 'response', label: 'cached', count: 3, duration: 1.4 },
          { path: ['gw', 'catalog'], tone: 'request', duration: 1.2, delay: 1.6 },
        ],
        panel: {
          title: 'Cache rules',
          icon: 'Timer',
          rows: [
            { text: 'GET /catalog/42', value: 'cache 30 s', tone: 'good' },
            { text: 'GET /users/me', value: 'never', tone: 'bad' },
            { text: 'Honor Cache-Control', value: 'yes' },
          ],
        },
        caption: 'Repeat reads stop at the gateway',
      },
    },
    {
      title: 'Observe',
      tag: 'concept',
      heading: 'One place to see every request',
      eli5: 'Every guest passes the desk, so the desk can count visitors, time each errand and stamp each slip with a number to follow it through the hotel.',
      body: [
        'Every request crosses the gateway, so it is the natural place for access logs, request counts, error rates and latency percentiles per route and per client.',
        'It also stamps each request with a **correlation id** header. Every service logs that id, so one slow request can be followed across four services.',
      ],
      keyIdea: 'The gateway sees all traffic, so it is the cheapest place to measure it and to start a trace.',
      metrics: { trips: '1', latency: '120 ms', auth: '1', overhead: '11 ms' },
      scene: {
        nodes: [phone, { ...gw, status: 'active', chips: [{ text: 'X-Request-Id: a7f3' }] }, { id: 'monitor', kind: 'monitor', at: at(3.8, -3.8), label: 'metrics + logs' }, orders],
        links: [link('phone', 'gw'), link('gw', 'monitor', { style: 'dashed' }), link('gw', 'orders')],
        flows: [
          { path: ['phone', 'gw', 'orders'], tone: 'request', label: 'id a7f3', duration: 1.6 },
          { path: ['gw', 'monitor'], tone: 'event', label: 'p99, errors', duration: 1, delay: 1 },
        ],
        panel: {
          title: 'Per route, per client',
          icon: 'Activity',
          rows: [
            { text: 'GET /orders p99', value: '48 ms', tone: 'good' },
            { text: '5xx rate', value: '0.02%', tone: 'good' },
            { text: 'Top caller', value: 'ios 4.2' },
          ],
        },
        caption: 'One door, one set of dashboards',
      },
    },
    {
      title: 'Slow service',
      tag: 'case',
      heading: 'Case: one slow service ties up the gateway',
      eli5: 'The kitchen takes forever on one dish. Every waiter at the desk is stuck holding a tray for that kitchen, and no one is left to take any other order.',
      body: [
        'Recommendations starts answering in 30 seconds. Gateway workers wait for it, the pool fills up and `/users` and `/orders` calls queue behind them.',
        'A **timeout** per route bounds the wait. A bounded **retry** helps only for idempotent calls and only with backoff. Retries add load to a sick service.',
      ],
      keyIdea: 'Without per-route timeouts, one slow backend can exhaust the gateway for everyone.',
      metrics: { trips: '1', latency: '30 s', auth: '1', overhead: '30 s' },
      metricTones: { latency: 'bad', overhead: 'bad' },
      scene: {
        nodes: [phone, { ...gw, status: 'hot', load: 92, badge: 'workers all busy' }, { ...recs, status: 'hot', badge: '30 s', at: at(0, 3.8) }],
        links: [link('phone', 'gw'), link('gw', 'recs', { label: 'no timeout', labelTone: 'warn' })],
        flows: [
          { path: ['phone', 'gw', 'recs'], tone: 'request', count: 3, duration: 2.2 },
          { path: ['gw', 'phone'], tone: 'error', label: 'queued', duration: 1.4, delay: 2.4 },
        ],
        panel: {
          title: 'Worker pool',
          icon: 'Cpu',
          rows: [
            { text: 'Waiting on recs', value: '95 of 100', tone: 'bad' },
            { text: 'Left for /users, /orders', value: '5', tone: 'bad' },
          ],
        },
        caption: 'One sick service starves healthy routes',
      },
    },
    {
      title: 'Circuit breaker',
      tag: 'concept',
      heading: 'Circuit breakers fail fast',
      eli5: 'After the kitchen fails five times in a row, the desk stops sending slips there for a minute and says "sorry, no soup today" right away. Then it tries one slip to see if the kitchen is back.',
      body: [
        'A **circuit breaker** counts failures per backend. Past a threshold it opens: calls fail at once with a `503` or a fallback such as an empty recommendations list.',
        'After a pause it lets one trial request through. If that works, the breaker closes. The slow service gets room to recover and the gateway stays free.',
      ],
      keyIdea: 'Fail fast on a sick backend, then probe it, so one failure stays local.',
      metrics: { trips: '1', latency: '120 ms', auth: '1', overhead: '11 ms' },
      metricTones: { latency: 'good' },
      scene: {
        nodes: [phone, { ...gw, status: 'ok', load: 30, badge: 'breaker open for recs' }, { ...recs, status: 'down', at: at(0, 3.8) }],
        links: [link('phone', 'gw'), link('gw', 'recs', { style: 'faint', label: 'blocked 60 s', labelTone: 'warn' })],
        flows: [
          { path: ['phone', 'gw'], tone: 'request', duration: 1 },
          { path: ['gw', 'phone'], tone: 'response', label: 'home, recs empty', duration: 1.2, delay: 1.1 },
        ],
        panel: {
          title: 'Breaker states',
          icon: 'Zap',
          rows: [
            { text: 'Closed', value: 'calls flow', tone: 'good' },
            { text: 'Open', value: 'fail at once', tone: 'bad' },
            { text: 'Half open', value: 'one trial call', tone: 'warn' },
          ],
        },
        caption: 'The home screen still loads, minus recommendations',
      },
    },
    {
      title: 'God box',
      tag: 'case',
      heading: 'Case: the gateway that knew too much',
      eli5: 'The front desk started doing everyone else\'s job, even working out prices. One hard sum jammed the desk, and since every guest goes through the **API gateway** desk, the whole hotel stopped.',
      body: [
        'A year later the gateway holds discount rules, response rewriting for three app versions and a custom checkout flow. Every team ships changes to it.',
        'On Friday a bad regex in a pricing rule pins gateway CPU at 100%. Every request to every service passes through it, so the whole product is down, including services that never touched pricing.',
      ],
      keyIdea: 'Business logic in the gateway turns a routing layer into a shared single point of failure for the whole company.',
      metrics: { trips: '1', latency: 'timeout', auth: '1', overhead: '8 s' },
      metricTones: { latency: 'bad', overhead: 'bad' },
      scene: {
        nodes: [{ ...phone, badge: 'spinner' }, { ...gw, status: 'hot', load: 100, badge: 'pricing regex' }, { ...users, status: 'dim' as const }, { ...recs, status: 'dim' as const }],
        links: [link('phone', 'gw'), link('gw', 'users', { style: 'faint' }), link('gw', 'recs', { style: 'faint' })],
        flows: [
          { path: ['phone', 'gw'], tone: 'request', count: 4, duration: 1.2 },
          { path: ['gw', 'phone'], tone: 'error', label: '504', duration: 1.4, delay: 2.4 },
        ],
        caption: 'One bad rule, every service unreachable',
      },
    },
    {
      title: 'Keep it thin',
      tag: 'tradeoff',
      heading: 'Keep the gateway thin',
      eli5: 'Keep the desk job small: check keys, count rings, point the way and write things down. Cooking, pricing and cleaning stay in the back rooms.',
      body: [
        'The rule of thumb: the gateway does **auth, rate limiting, routing and observability**. Pricing, checkout and data rewriting belong in services, or in a BFF owned by the client team.',
        'Each feature you push into the gateway saves effort in many services, and raises the cost of every gateway change. Stop at the cross-cutting concerns.',
      ],
      keyIdea: 'A gateway should be boring: generic, and free of business rules.',
      metrics: { trips: '1', latency: '120 ms', auth: '1', overhead: '11 ms' },
      metricTones: { overhead: 'good' },
      scene: {
        nodes: [
          { ...gw, status: 'ok' },
          { id: 'inside', kind: 'block', size: 0.72, at: at(-3.8, 3.8), label: 'belongs here', sub: 'auth · limits · routes · logs', icon: 'Shield', tint: 'green' },
          { id: 'outside', kind: 'block', size: 0.72, at: at(3.8, 3.8), label: 'belongs elsewhere', sub: 'pricing · checkout', icon: 'Receipt', tint: 'red' },
        ],
        links: [link('gw', 'inside'), link('gw', 'outside', { style: 'faint' })],
        panel: {
          title: 'Gateway or service?',
          icon: 'Scale',
          rows: [
            { text: 'Validate JWT', value: 'gateway', tone: 'good' },
            { text: 'Rate limit', value: 'gateway', tone: 'good' },
            { text: 'VIP discount', value: 'pricing service', tone: 'bad' },
            { text: 'Checkout flow', value: 'checkout service', tone: 'bad' },
          ],
        },
        caption: 'Cross-cutting plumbing yes, business rules no',
      },
    },
    {
      title: 'Replicate',
      tag: 'tradeoff',
      heading: 'Run several stateless copies behind a balancer',
      eli5: 'Open a second desk that works the same way. The **load balancer** is the doorman who sends each guest to whichever desk is free, so if one desk closes the hotel still works.',
      body: [
        'A single gateway is a single point of failure. Run several **stateless** instances behind a load balancer, with shared state such as rate-limit counters in Redis.',
        'Stateless means any instance can handle any request, so you can add copies under load and replace them during a deploy.',
      ],
      keyIdea: 'Stateless copies behind a load balancer remove the gateway as a single point of failure.',
      metrics: { trips: '1', latency: '120 ms', auth: '1', overhead: '11 ms' },
      metricTones: { overhead: 'good' },
      scene: {
        nodes: [
          { ...phone, at: at(-5.8, -3.8) },
          { id: 'lb', kind: 'block', at: at(-2.2, -3.8), label: 'load balancer', icon: 'Split', tint: 'teal', status: 'active' },
          { ...gw, at: at(1.5, -7), status: 'ok' },
          { ...gw, id: 'gw2', at: at(1.5, -0.5), label: 'gateway 2', sub: 'stateless copy', status: 'ok' },
          { id: 'backend', kind: 'block', size: 0.72, at: at(5.8, -3.8), label: 'services', icon: 'Boxes', tint: 'blue' },
        ],
        links: [link('phone', 'lb'), link('lb', 'gw'), link('lb', 'gw2'), link('gw', 'backend'), link('gw2', 'backend')],
        flows: [
          { path: ['phone', 'lb', 'gw', 'backend'], tone: 'request', duration: 1.8 },
          { path: ['phone', 'lb', 'gw2', 'backend'], tone: 'request', duration: 1.8, delay: 0.9 },
        ],
        caption: 'Lose one copy and traffic keeps flowing',
      },
    },
    {
      title: 'Gateway vs mesh',
      tag: 'concept',
      heading: 'North-south is the gateway, east-west is the mesh',
      eli5: 'The front desk handles guests coming in from outside. Staff talking to each other in the corridors use their own walkie-talkies. That is a different tool.',
      body: [
        'The gateway handles **north-south** traffic: clients from outside calling in. Calls between services are **east-west** traffic, and a **service mesh** (Istio, Linkerd) handles those with sidecar proxies.',
        'The mesh gives service-to-service mTLS, retries and tracing. The gateway does not replace it, and the mesh does not replace the gateway.',
      ],
      keyIdea: 'Use a gateway for traffic entering the system and a mesh for traffic between services.',
      metrics: { trips: '1', latency: '120 ms', auth: '1', overhead: '11 ms' },
      scene: {
        nodes: [phone, { ...gw, status: 'active' }, { ...orders, at: at(-3.8, 3.8), chips: ['sidecar'] }, { ...users, at: at(3.8, 3.8), chips: ['sidecar'] }],
        links: [link('phone', 'gw', { label: 'north-south' }), link('gw', 'orders'), link('orders', 'users', { label: 'east-west · mesh', arrow: 'both' })],
        flows: [
          { path: ['phone', 'gw', 'orders'], tone: 'request', duration: 1.6 },
          { path: ['orders', 'users'], tone: 'request', label: 'mTLS', duration: 1.4, delay: 1.8 },
        ],
        panel: {
          title: 'Two tools, two directions',
          icon: 'ArrowLeftRight',
          rows: [
            { text: 'Gateway', value: 'client to services' },
            { text: 'Service mesh', value: 'service to service' },
          ],
        },
        caption: 'Edge in, mesh between',
      },
    },
    {
      title: 'Build or buy',
      tag: 'tradeoff',
      heading: 'Pick a product, rarely build one',
      eli5: 'You can hire a trained front desk team or train your own. Training your own means you also have to keep them trained forever.',
      body: [
        'Common choices: Kong, Tyk, Apigee, AWS API Gateway, Azure API Management, Envoy or Nginx with config. Managed gateways cost per request and remove the operations work.',
        'Self-hosted ones cost engineers but are cheaper at high volume. A gateway written from scratch is rarely worth it.',
      ],
      keyIdea: 'Start with a managed or open-source gateway. Build your own only for a need no product meets.',
      metrics: { trips: '1', latency: '120 ms', auth: '1', overhead: '11 ms' },
      scene: {
        nodes: [
          { id: 'managed', kind: 'block', at: at(-3.8, -1.5), label: 'managed', sub: 'AWS, Azure, Apigee', icon: 'Globe', tint: 'blue' },
          { id: 'selfhost', kind: 'block', at: at(3.8, -1.5), label: 'self-hosted', sub: 'Kong, Envoy, Nginx', icon: 'Server', tint: 'violet' },
        ],
        links: [],
        panel: {
          title: 'Trade-offs',
          icon: 'Scale',
          rows: [
            { text: 'Managed: ops work', value: 'low', tone: 'good' },
            { text: 'Managed: cost at scale', value: 'per request', tone: 'warn' },
            { text: 'Self-hosted: ops work', value: 'yours', tone: 'warn' },
            { text: 'Self-hosted: cost at scale', value: 'lower', tone: 'good' },
          ],
        },
        caption: 'Operations time against per-request cost',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'One front door, kept simple',
      eli5: 'A hotel works best with one front desk, the **API gateway**, that checks keys, counts bell rings and points the way. The cooking and cleaning stay in the back rooms.',
      body: [
        'A **reverse proxy** terminates TLS, compresses and logs for the servers behind it. An **API gateway** adds routing, auth, rate limits, quotas, aggregation and observability.',
        'Together they replace four copies of auth with one and four mobile round trips with one. Keep the gateway thin, run several stateless copies, and push business logic back into the services.',
      ],
      keyIdea: 'Centralize the plumbing every service needs, and nothing more.',
      metrics: { trips: '1', latency: '120 ms', auth: '1', overhead: '11 ms' },
      metricTones: { trips: 'good', latency: 'good', auth: 'good', overhead: 'good' },
      scene: {
        nodes: [phone, { ...gw, status: 'ok' }, limiter, users, recs],
        links: [link('phone', 'gw'), link('gw', 'limiter', { style: 'dashed' }), link('gw', 'users'), link('gw', 'recs')],
        flows: [
          { path: ['phone', 'gw'], tone: 'request', label: 'GET /home', duration: 1.2 },
          { path: ['gw', 'users'], tone: 'request', duration: 0.8, delay: 1.3 },
          { path: ['gw', 'recs'], tone: 'request', duration: 0.8, delay: 1.3 },
          { path: ['gw', 'phone'], tone: 'response', duration: 1.2, delay: 2.3 },
        ],
        caption: 'Auth, limits, routes and one round trip',
      },
      quiz: {
        question: 'A team wants to add a "10% off for VIP users" rule to the API gateway because every request already passes through it. What is the best response?',
        options: [
          'Do it, the gateway is the fastest place to apply it',
          'Put it in the pricing service. The gateway should stay limited to auth, rate limits, routing and observability',
          'Put it in the load balancer instead',
          'Do it, but only on one gateway instance',
        ],
        answer: 1,
        explain: 'Business rules in the gateway make every gateway deploy risky for the whole product. Pricing logic belongs with the service that owns prices.',
      },
    },
  ],
};
