import type { Lesson, SceneNode } from '../engine/types';

const phone: SceneNode = { id: 'phone', kind: 'phone', at: [-5.5, 0], label: 'mobile app', sub: '100 ms RTT' };
const gw: SceneNode = { id: 'gw', kind: 'gateway', at: [-1.5, 0], label: 'API gateway', sub: 'api.shop.example' };
const gw2: SceneNode = { id: 'gw2', kind: 'gateway', at: [0.2, 3.3], label: 'gateway 2', sub: 'stateless copy' };
const lb: SceneNode = { id: 'lb', kind: 'lb', at: [-3.2, 1.6], label: 'load balancer' };
const limiter: SceneNode = { id: 'limiter', kind: 'limiter', at: [-1, -3], label: 'rate limiter', sub: 'Redis counters' };
const users: SceneNode = { id: 'users', kind: 'service', at: [3, -3], label: 'users', sub: '/users' };
const orders: SceneNode = { id: 'orders', kind: 'service', at: [3, -1], label: 'orders', sub: '/orders' };
const catalog: SceneNode = { id: 'catalog', kind: 'service', at: [3, 1], label: 'catalog', sub: '/catalog' };
const recs: SceneNode = { id: 'recs', kind: 'service', at: [3, 3], label: 'recommend', sub: '/recs' };

const services = [users, orders, catalog, recs];
const gwLinks = services.map((s) => ({ from: 'gw', to: s.id }));

export const apiGateway: Lesson = {
  id: 'api-gateway',
  title: 'Reverse proxies and API gateways',
  tagline: 'One front door for many services: TLS, routing, auth, rate limits and aggregation in a single place.',
  minutes: 11,
  level: 'Intermediate',
  learn: [
    'What a reverse proxy does and what an API gateway adds on top',
    'Routing by path to different services',
    'Checking auth and rate limits once, at the edge',
    'Aggregating calls to save mobile round trips',
    'Why a fat gateway becomes a bottleneck, and how to keep it thin',
  ],
  metrics: [
    { key: 'trips', label: 'Client round trips' },
    { key: 'latency', label: 'Home screen' },
    { key: 'auth', label: 'Auth code copies' },
    { key: 'overhead', label: 'Gateway hop' },
  ],
  steps: [
    {
      title: 'Many doors',
      tag: 'problem',
      heading: 'The app talks to every service directly',
      eli5: 'A hotel guest must walk to four back rooms on their own, and each **service** room checks the room key in its own way. That is a lot of walking, and one sloppy checker lets in a guest with an old key.',
      body: [
        'The shop split into four services: users, orders, catalog and recommendations. The mobile app calls each one on its own public address.',
        'Every service now terminates TLS, validates login tokens, sets CORS headers and writes access logs, each in its own slightly different way. Last month the orders team shipped a token check that accepted expired tokens.',
        'The home screen needs all four, one after another over a 100 ms mobile link. That is **400 ms** of round trips before anything renders.',
      ],
      keyIdea: 'When clients talk to many services directly, cross-cutting work gets copied everywhere and drifts apart.',
      metrics: { trips: '4', latency: '430 ms', auth: '4', overhead: '-' },
      scene: {
        nodes: [phone, ...services.map((s) => ({ ...s, badge: 'own TLS + auth' }))],
        links: services.map((s) => ({ from: 'phone', to: s.id, style: 'dashed' as const })),
        flows: [
          { path: ['phone', 'users'], tone: 'request', duration: 1 },
          { path: ['phone', 'orders'], tone: 'request', duration: 1, delay: 1 },
          { path: ['phone', 'catalog'], tone: 'request', duration: 1, delay: 2 },
          { path: ['phone', 'recs'], tone: 'request', duration: 1, delay: 3 },
        ],
        caption: 'Four public endpoints, four copies of the same plumbing',
      },
    },
    {
      title: 'Reverse proxy',
      tag: 'concept',
      heading: 'A reverse proxy becomes the front door',
      eli5: 'The **reverse proxy** is the hotel front desk. Guests talk only to the desk, and the desk passes each request to the right back room, so nobody outside needs to know where the rooms are.',
      body: [
        'A **reverse proxy** accepts connections on behalf of the servers behind it. Clients see one hostname. The proxy terminates TLS, compresses responses, logs every request and forwards plain HTTP inside the datacenter.',
        'This is **TLS termination**: certificates live in one place and the services stop caring about them. The internal network layout is hidden, so you can move or split services without touching clients.',
        'The price is one extra hop, about 50 to 500 microseconds inside a datacenter. Nginx, Envoy, HAProxy and Caddy all play this role. A load balancer is a reverse proxy that also fans out across copies of one service.',
      ],
      keyIdea: 'A reverse proxy centralizes connection-level work (TLS, compression, logging) and hides what sits behind it.',
      metrics: { trips: '4', latency: '420 ms', auth: '4', overhead: '0.3 ms' },
      scene: {
        nodes: [phone, { ...gw, label: 'reverse proxy', status: 'active', badge: 'TLS ends here' }, ...services],
        links: [{ from: 'phone', to: 'gw', label: 'HTTPS' }, ...gwLinks.map((l) => ({ ...l, label: undefined }))],
        flows: [
          { path: ['phone', 'gw'], tone: 'handshake', label: 'TLS hello', duration: 1 },
          { path: ['gw', 'phone'], tone: 'handshake', label: 'cert', duration: 1, delay: 1.05 },
          { path: ['phone', 'gw', 'orders'], tone: 'request', label: 'GET /orders', duration: 1.6, delay: 2.2 },
        ],
        caption: 'One hostname, one certificate, plain HTTP inside',
      },
    },
    {
      title: 'Route by path',
      tag: 'concept',
      heading: 'Routing: the path decides the service',
      eli5: 'The **API gateway** is a front desk with a list: food questions go to the kitchen, laundry questions go to the laundry. If the kitchen moves, only the list changes.',
      body: [
        'An **API gateway** is a reverse proxy that knows about your API. Its first job is **routing**: `/users/*` goes to the users service, `/orders/*` to orders, and so on.',
        'Routes are config, so teams can split a service or move it to new hosts by changing one line. The gateway can also strip a prefix, rewrite a header or send 5% of `/catalog` traffic to a canary build.',
      ],
      keyIdea: 'The gateway maps public URLs to internal services, so the public API stays stable while the backend changes.',
      metrics: { trips: '4', latency: '420 ms', auth: '4', overhead: '0.3 ms' },
      scene: {
        nodes: [phone, { ...gw, status: 'active', badge: 'route table' }, ...services],
        links: [{ from: 'phone', to: 'gw' }, ...gwLinks],
        flows: [
          { path: ['phone', 'gw', 'users'], tone: 'request', label: '/users/me', duration: 1.6 },
          { path: ['phone', 'gw', 'catalog'], tone: 'request', label: '/catalog/42', duration: 1.6, delay: 0.8 },
          { path: ['phone', 'gw', 'orders'], tone: 'request', label: '/orders', duration: 1.6, delay: 1.6 },
        ],
        caption: 'Each path prefix maps to one service',
      },
      code: {
        language: 'yaml',
        title: 'Declarative gateway config (Kong style)',
        source: `services:
  - name: users
    url: http://users.internal:8080
    routes: [{ paths: ["/users"] }]
  - name: orders
    url: http://orders.internal:8080
    routes: [{ paths: ["/orders"] }]
    plugins:
      - name: jwt                  # auth checked at the edge
      - name: rate-limiting
        config: { minute: 100, policy: redis }
  - name: catalog
    url: http://catalog.internal:8080
    routes: [{ paths: ["/catalog"] }]`,
        highlight: [4, 7, 9, 10, 11],
      },
    },
    {
      title: 'Auth once',
      tag: 'concept',
      heading: 'Check identity once, at the edge',
      eli5: 'The front desk checks your room key once. That is **authentication**: proving who you are. Then it tells the back room your name, and the back room still decides what you may have.',
      body: [
        'The gateway validates the token on every request: signature, expiry, audience. A bad token gets a `401` before it reaches any service.',
        'On success the gateway forwards the request with a trusted header such as `X-User-Id: 42`. Services read the header and skip their own token parsing. One implementation, reviewed once, patched once.',
        'Services still decide **authorization** (may user 42 see order 9001?). The gateway answers who you are. The service answers what you may do, because only it knows the data.',
      ],
      keyIdea: 'Authenticate at the gateway, authorize in the service that owns the data.',
      metrics: { trips: '4', latency: '420 ms', auth: '1', overhead: '0.5 ms' },
      scene: {
        nodes: [phone, { ...gw, status: 'active', badge: 'JWT ok · user 42' }, users, { ...orders, status: 'active', badge: 'X-User-Id: 42' }, catalog, recs],
        links: [{ from: 'phone', to: 'gw' }, ...gwLinks],
        flows: [
          { path: ['phone', 'gw', 'orders'], tone: 'request', label: 'Bearer eyJ…', duration: 1.6 },
          { path: ['phone', 'gw'], tone: 'request', label: 'expired token', duration: 1, delay: 1.8 },
          { path: ['gw', 'phone'], tone: 'error', label: '401', duration: 1, delay: 2.9 },
        ],
        caption: 'Bad tokens stop at the gateway',
      },
      code: {
        language: 'python',
        title: 'Gateway middleware: authenticate, then forward',
        source: `def authenticate(request):
    token = request.headers.get("Authorization", "").removeprefix("Bearer ")
    try:
        claims = jwt.decode(token, PUBLIC_KEY, algorithms=["RS256"],
                            audience="shop-api")   # checks exp too
    except jwt.InvalidTokenError:
        return Response(status=401)
    # Never trust this header from outside: overwrite it.
    request.headers["X-User-Id"] = claims["sub"]
    return forward(request, route_for(request.path))`,
        highlight: [4, 5, 7, 9],
      },
    },
    {
      title: 'Rate limits',
      tag: 'case',
      heading: 'Case: a buggy app release retries in a loop',
      eli5: 'One guest rings the desk bell over and over. The **rate limiter** is the tally sheet beside the desk: after 100 rings in a minute the desk says wait, so the back rooms stay calm.',
      body: [
        'A new app version retries failed calls with no backoff. A few thousand phones start sending **2,000 requests per second** to `/orders`, ten times normal.',
        'The gateway enforces a **rate limit** per API key or user: a token bucket of 100 requests per minute with small bursts allowed. Over the limit, the client gets `429 Too Many Requests` with a `Retry-After` header and the orders service never sees the flood.',
        'Counters live in a shared store such as Redis, so every gateway instance enforces the same limit.',
      ],
      keyIdea: 'Rate limiting at the gateway protects every service behind it from one misbehaving client.',
      metrics: { trips: '4', latency: '420 ms', auth: '1', overhead: '0.8 ms' },
      scene: {
        nodes: [
          { ...phone, status: 'hot', badge: '2,000 req/s' },
          { ...gw, status: 'active' },
          { ...limiter, status: 'active', badge: 'user 42: 100/min' },
          users,
          { ...orders, status: 'ok', badge: 'normal load' },
          catalog,
          recs,
        ],
        links: [{ from: 'phone', to: 'gw' }, { from: 'gw', to: 'limiter', style: 'dashed' }, ...gwLinks],
        flows: [
          { path: ['phone', 'gw'], tone: 'request', count: 6, duration: 1 },
          { path: ['gw', 'limiter'], tone: 'request', label: 'INCR', duration: 0.6, delay: 1 },
          { path: ['gw', 'phone'], tone: 'error', label: '429', count: 4, duration: 1, delay: 1.7 },
          { path: ['gw', 'orders'], tone: 'request', duration: 1, delay: 1.7 },
        ],
        caption: 'Excess requests are rejected at the door',
      },
    },
    {
      title: 'Aggregation',
      tag: 'concept',
      heading: 'One call from the phone, four calls inside',
      eli5: 'The guest used to make four trips. Now the guest asks the front desk once, the desk calls all four back rooms at the same time and hands over one tray. That is **aggregation**.',
      body: [
        'The home screen still costs four mobile round trips. The gateway can offer one endpoint, `GET /home`, that calls the four services **in parallel** and merges the results.',
        'Inside the datacenter a round trip is about 0.5 ms. Four parallel calls finish in the time of the slowest one, say 30 ms. The phone pays one 100 ms round trip instead of four. Home screen time drops from 420 ms to about 140 ms.',
        'A gateway built for one client type is called a **backend for frontend** (BFF): one for mobile, one for web, each shaping the payload its client needs. GraphQL servers often fill this role.',
      ],
      keyIdea: 'Move fan-out from the slow link to the fast one. Aggregate inside the datacenter and send the client one response.',
      metrics: { trips: '1', latency: '140 ms', auth: '1', overhead: '30 ms' },
      scene: {
        nodes: [phone, { ...gw, status: 'active', badge: 'GET /home · fan-out' }, ...services.map((s) => ({ ...s, status: 'active' as const }))],
        links: [{ from: 'phone', to: 'gw' }, ...gwLinks],
        flows: [
          { path: ['phone', 'gw'], tone: 'request', label: 'GET /home', duration: 1.2 },
          ...services.map((s) => ({ path: ['gw', s.id], tone: 'request' as const, duration: 0.8, delay: 1.3 })),
          ...services.map((s) => ({ path: [s.id, 'gw'], tone: 'response' as const, duration: 0.8, delay: 2.2 })),
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
      title: 'God box',
      tag: 'case',
      heading: 'Case: the gateway that knew too much',
      eli5: 'The front desk started doing everyone else\'s job, even working out prices. One hard sum jammed the desk, and since every guest goes through the **API gateway** desk, the whole hotel stopped.',
      body: [
        'A year later the gateway holds discount rules, response rewriting for three app versions and a custom checkout flow. Every team ships changes to it, and it deploys twice a week with a long checklist.',
        'On Friday a bad regex in a pricing rule spikes gateway CPU to 100%. Every request to every service passes through the gateway, so the whole product is down, including services that never touched pricing.',
        'A gateway sits on the path of every request. Each piece of business logic added there widens the blast radius of every deploy.',
      ],
      keyIdea: 'Business logic in the gateway turns a routing layer into a shared single point of failure for the whole company.',
      metrics: { trips: '1', latency: 'timeout', auth: '1', overhead: '8 s' },
      scene: {
        nodes: [
          { ...phone, badge: 'spinner' },
          { ...gw, status: 'hot', badge: 'CPU 100% · pricing regex' },
          ...services.map((s) => ({ ...s, status: 'dim' as const })),
        ],
        links: [{ from: 'phone', to: 'gw' }, ...gwLinks.map((l) => ({ ...l, style: 'faint' as const }))],
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
      heading: 'Keep the gateway thin and replicated',
      eli5: 'Keep the desk job small, and open a second desk that works the same way. The **load balancer** is the doorman who sends each guest to whichever desk is free.',
      body: [
        'The rule of thumb: the gateway does **auth, rate limiting, routing and observability**. Pricing, checkout and data rewriting belong in services, or in a BFF owned by the client team.',
        'Run the gateway as several **stateless** instances behind a load balancer, with shared state (rate-limit counters) in Redis. Set a timeout per route so one slow service cannot tie up every gateway worker.',
        'The trade-off is real. Each feature you push into the gateway saves effort in many services, and raises the cost of every gateway change. Stop at the cross-cutting concerns.',
      ],
      keyIdea: 'A gateway should be boring: generic, stateless, replicated, and free of business rules.',
      metrics: { trips: '1', latency: '140 ms', auth: '1', overhead: '1 ms' },
      scene: {
        nodes: [phone, { ...lb, status: 'active' }, { ...gw, status: 'ok', badge: 'auth · limit · route' }, { ...gw2, status: 'ok' }, limiter, ...services],
        links: [
          { from: 'phone', to: 'lb' },
          { from: 'lb', to: 'gw' },
          { from: 'lb', to: 'gw2' },
          { from: 'gw', to: 'limiter', style: 'dashed' },
          ...gwLinks,
          { from: 'gw2', to: 'catalog' },
          { from: 'gw2', to: 'recs' },
        ],
        flows: [
          { path: ['phone', 'lb', 'gw', 'orders'], tone: 'request', duration: 1.8 },
          { path: ['phone', 'lb', 'gw2', 'catalog'], tone: 'request', duration: 1.8, delay: 0.9 },
          { path: ['orders', 'gw', 'lb', 'phone'], tone: 'response', duration: 1.8, delay: 1.9 },
        ],
        caption: 'Stateless copies behind a load balancer',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'One front door, kept simple',
      eli5: 'A hotel works best with one front desk, the **API gateway**, that checks keys, counts bell rings and points the way. The cooking and cleaning stay in the back rooms.',
      body: [
        'A **reverse proxy** terminates TLS, compresses and logs for the servers behind it. An **API gateway** adds API-aware work: routing by path, authentication, rate limiting and aggregation.',
        'Together they replace four copies of auth with one and four mobile round trips with one. Keep the gateway thin and stateless, run several copies, and push business logic back into the services.',
      ],
      keyIdea: 'Centralize the plumbing every service needs, and nothing more.',
      metrics: { trips: '1', latency: '140 ms', auth: '1', overhead: '1 ms' },
      scene: {
        nodes: [phone, { ...gw, status: 'ok' }, limiter, ...services],
        links: [{ from: 'phone', to: 'gw' }, { from: 'gw', to: 'limiter', style: 'dashed' }, ...gwLinks],
        flows: [
          { path: ['phone', 'gw'], tone: 'request', label: 'GET /home', duration: 1.2 },
          { path: ['gw', 'users'], tone: 'request', duration: 0.8, delay: 1.3 },
          { path: ['gw', 'recs'], tone: 'request', duration: 0.8, delay: 1.3 },
          { path: ['gw', 'phone'], tone: 'response', duration: 1.2, delay: 2.3 },
        ],
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
