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

export const apiGateway: Lesson = {
  id: 'api-gateway',
  title: 'Reverse proxies and API gateways (part 1)',
  tagline: 'One front door for many services: TLS, routing, auth, rate limits and aggregation in a single place.',
  minutes: 12,
  level: 'Intermediate',
  learn: [
    'What a reverse proxy does and how it differs from a load balancer',
    'TLS termination, compression and the other connection-level jobs',
    'Routing by path, canary splits and finding live instances',
    'Checking auth, rate limits and quotas once, at the edge',
  ],
  metrics: [
    { key: 'trips', label: 'Client round trips', icon: 'Repeat' },
    { key: 'latency', label: 'Home screen', icon: 'Timer' },
    { key: 'auth', label: 'Auth code copies', icon: 'Key' },
    { key: 'overhead', label: 'Time in gateway', icon: 'Gauge' },
  ],
  steps: [
    {
      title: 'Many doors',
      tag: 'problem',
      heading: 'The app talks to every service directly',
      eli5: 'A hotel guest must walk to four back rooms alone, and each room checks the room key in its own way. That is a lot of walking, and one sloppy checker lets in a guest with an old key.',
      body: [
        'The shop split into four services: users, orders, catalog and recommendations. The mobile app calls each one on its own public address.',
        'Every service terminates TLS, validates tokens, sets CORS headers and writes access logs in its own slightly different way. Last month the orders team shipped a token check that accepted expired tokens.',
      ],
      keyIdea: 'When clients talk to many services directly, cross-cutting work gets copied everywhere and drifts apart.',
      metrics: { trips: '4', latency: '440 ms', auth: '4', overhead: '-' },
      metricTones: { trips: 'bad', latency: 'bad', auth: 'bad' },
      scene: {
        nodes: [phone, ...services.map((s) => ({ ...s, badge: 'own TLS + auth' }))],
        links: services.map((s) => link('phone', s.id, { style: 'dashed' })),
        flows: [
          { path: ['phone', 'users'], tone: 'request', duration: 1 },
          { path: ['phone', 'orders'], tone: 'request', duration: 1, delay: 1 },
          { path: ['phone', 'catalog'], tone: 'request', duration: 1, delay: 2 },
          { path: ['phone', 'recs'], tone: 'request', duration: 1, delay: 3 },
        ],
        panel: {
          title: 'Same plumbing, four copies',
          icon: 'List',
          rows: [
            { text: 'TLS certificates', value: '4 places', tone: 'warn' },
            { text: 'Token validation', value: '4 versions', tone: 'bad' },
            { text: 'CORS and logging', value: '4 styles', tone: 'warn' },
          ],
          footer: { text: 'One copy accepts expired tokens', tone: 'bad' },
        },
        caption: 'Four public endpoints, four copies of the same plumbing',
      },
    },
    {
      title: 'Slow screen',
      tag: 'problem',
      heading: 'The home screen pays for four mobile round trips',
      eli5: 'The guest walks to the four rooms one after another. Every walk is slow because the corridor is long, so the guest waits a long time before seeing anything.',
      body: [
        'The home screen needs all four services, one after another over a 100 ms mobile link. That is **400 ms** of round trips before anything renders, plus about 30 ms of server time.',
        'Each new service makes the screen slower and the app more fragile. The app also has to know every address, so moving a service breaks old app versions.',
      ],
      keyIdea: 'Round trips on the slow client link are the expensive part, and direct calls multiply them.',
      metrics: { trips: '4', latency: '440 ms', auth: '4', overhead: '-' },
      metricTones: { trips: 'bad', latency: 'bad' },
      scene: {
        nodes: [{ ...phone, status: 'hot', badge: '4 round trips' }, users, orders, recs],
        links: [
          link('phone', 'users', { label: '4G · 100 ms each', labelTone: 'warn' }),
          link('phone', 'orders'),
          link('phone', 'recs'),
        ],
        flows: [
          { path: ['phone', 'users', 'phone'], tone: 'request', label: '1', duration: 1.4 },
          { path: ['phone', 'orders', 'phone'], tone: 'request', label: '2', duration: 1.4, delay: 1.5 },
          { path: ['phone', 'recs', 'phone'], tone: 'request', label: '3', duration: 1.4, delay: 3 },
        ],
        panel: {
          title: 'Home screen timeline',
          icon: 'Timer',
          rows: [
            { text: '4 round trips x 100 ms', value: '400 ms', tone: 'bad' },
            { text: 'Server time', value: '30 ms' },
            { text: 'Render', value: '440 ms', tone: 'bad' },
          ],
        },
        caption: 'Four sequential trips on a slow link',
      },
    },
    {
      title: 'Reverse proxy',
      tag: 'concept',
      heading: 'A reverse proxy becomes the front door',
      eli5: 'The **reverse proxy** is the hotel front desk. Guests talk only to the desk, and the desk passes each request to the right back room, so nobody outside needs to know where the rooms are.',
      body: [
        'A **reverse proxy** accepts connections on behalf of the servers behind it. Clients see one hostname and never learn the internal layout.',
        'Services can move or split without touching clients. The price is one extra hop, about 50 to 500 microseconds inside a datacenter.',
      ],
      keyIdea: 'A reverse proxy is one stable address in front of a changing backend.',
      metrics: { trips: '4', latency: '440 ms', auth: '4', overhead: '0.3 ms' },
      metricTones: { overhead: 'good' },
      scene: {
        nodes: [phone, { ...gw, label: 'reverse proxy', status: 'active', badge: 'one hostname' }, ...services.slice(0, 3)],
        links: [link('phone', 'gw', { label: 'HTTPS' }), ...fan().slice(0, 3)],
        flows: [
          { path: ['phone', 'gw', 'orders'], tone: 'request', label: 'GET /orders', duration: 1.8 },
          { path: ['orders', 'gw', 'phone'], tone: 'response', duration: 1.8, delay: 1.9 },
        ],
        panel: {
          title: 'What the client sees',
          icon: 'Globe',
          rows: [
            { text: 'Hostname', value: 'api.shop.example' },
            { text: 'Internal hosts', value: 'hidden', tone: 'good' },
            { text: 'Extra hop', value: '50-500 µs', tone: 'muted' },
          ],
        },
        caption: 'One address in front, many servers behind',
      },
    },
    {
      title: 'TLS ends here',
      tag: 'concept',
      heading: 'TLS termination: certificates in one place',
      eli5: 'Guests show their keys only to the front desk. Inside the hotel everyone already trusts each other, so the back rooms never handle keys at all.',
      body: [
        '**TLS termination** means the proxy does the TLS handshake and holds the certificate. Traffic inside the datacenter travels as plain HTTP, or as a second TLS hop if policy demands it.',
        'Certificates renew in one place. Services stop caring about ciphers, key rotation and handshake CPU.',
      ],
      keyIdea: 'Terminate TLS at the proxy so certificates and handshake cost live in one place.',
      metrics: { trips: '4', latency: '440 ms', auth: '4', overhead: '0.3 ms' },
      scene: {
        nodes: [phone, { ...gw, label: 'reverse proxy', status: 'active', badge: 'TLS ends here' }, orders],
        links: [link('phone', 'gw', { label: 'HTTPS · encrypted' }), link('gw', 'orders', { label: 'HTTP · plain' })],
        flows: [
          { path: ['phone', 'gw'], tone: 'handshake', label: 'TLS hello', duration: 1 },
          { path: ['gw', 'phone'], tone: 'handshake', label: 'cert', duration: 1, delay: 1.05 },
          { path: ['phone', 'gw', 'orders'], tone: 'request', label: 'GET /orders', duration: 1.6, delay: 2.2 },
        ],
        panel: {
          title: 'Who holds what',
          icon: 'Shield',
          rows: [
            { text: 'Certificate and key', value: 'proxy only', tone: 'good' },
            { text: 'Handshake CPU', value: 'proxy only', tone: 'good' },
            { text: 'Inside the datacenter', value: 'plain HTTP' },
          ],
        },
        caption: 'Encrypted outside, plain inside',
      },
    },
    {
      title: 'Offloading',
      tag: 'concept',
      heading: 'The proxy takes the other connection chores too',
      eli5: 'The front desk also hangs coats, signs guests in and keeps a few spare towels. The back rooms do only the cooking and the cleaning.',
      body: [
        'Besides TLS, a proxy compresses responses with gzip or brotli, writes one access log, keeps a pool of warm connections to each backend and caches static files.',
        'It can also enforce an IP allowlist and request size limits. This is **offloading**: work every backend would otherwise repeat moves to the edge.',
      ],
      keyIdea: 'Offloading moves repeated connection-level work off every backend and onto one proxy.',
      metrics: { trips: '4', latency: '410 ms', auth: '4', overhead: '0.4 ms' },
      scene: {
        nodes: [phone, { ...gw, label: 'reverse proxy', status: 'active' }, orders],
        links: [link('phone', 'gw', { label: 'gzip · 12 KB' }), link('gw', 'orders', { label: 'warm connection' })],
        flows: [
          { path: ['phone', 'gw', 'orders'], tone: 'request', duration: 1.6 },
          { path: ['orders', 'gw'], tone: 'response', label: '48 KB', duration: 1, delay: 1.7 },
          { path: ['gw', 'phone'], tone: 'response', label: '12 KB', duration: 1, delay: 2.8 },
        ],
        panel: {
          title: 'Jobs the proxy absorbs',
          icon: 'Layers',
          rows: [
            { text: 'Compression', value: '48 KB to 12 KB', tone: 'good' },
            { text: 'Connection pooling', value: 'reused' },
            { text: 'Static file cache', value: 'hit' },
            { text: 'IP allowlist', value: 'enforced' },
          ],
        },
        caption: 'Chores done once, at the door',
      },
    },
    {
      title: 'LB vs gateway',
      tag: 'concept',
      heading: 'Load balancer, reverse proxy, API gateway',
      eli5: 'The **load balancer** is the doorman who sends each guest to a free desk. The front desk talks to guests. The **API gateway** desk also knows the hotel menu and checks every request against it.',
      body: [
        'A **load balancer** fans traffic out across copies of one service. A **reverse proxy** stands in front of servers and hides them. Most layer 7 load balancers are reverse proxies.',
        'An **API gateway** is a reverse proxy that also knows your API: auth, rate limits, routing by path, transformation and aggregation across many services.',
      ],
      keyIdea: 'Each layer adds knowledge: the balancer knows servers, the proxy knows connections, the gateway knows your API.',
      metrics: { trips: '4', latency: '440 ms', auth: '4', overhead: '0.3 ms' },
      scene: {
        nodes: [
          { id: 'lb', kind: 'block', at: at(-3.8, -3.8), label: 'load balancer', sub: 'spreads load', icon: 'Split', tint: 'teal' },
          { id: 'rp', kind: 'block', at: at(0, -3.8), label: 'reverse proxy', sub: 'TLS, logs', icon: 'Shield', tint: 'blue' },
          { ...gw, at: at(3.8, -3.8), status: 'active', sub: 'API aware' },
        ],
        links: [link('lb', 'rp', { label: 'adds' }), link('rp', 'gw', { label: 'adds' })],
        panel: {
          title: 'What each one knows',
          icon: 'Layers',
          rows: [
            { text: 'Load balancer', value: 'which server is free' },
            { text: 'Reverse proxy', value: '+ TLS, compression, logs' },
            { text: 'API gateway', value: '+ auth, limits, routes' },
          ],
        },
        caption: 'Nginx and Envoy can play all three roles',
      },
    },
    {
      title: 'Route by path',
      tag: 'concept',
      heading: 'Routing: the path decides the service',
      eli5: 'The **API gateway** is a front desk with a list: food questions go to the kitchen, laundry questions go to the laundry. If the kitchen moves, only the list changes.',
      body: [
        'Its first job is **routing**: `/users/*` goes to the users service, `/orders/*` to orders, and so on. Routes can also match on host, method or header.',
        'Routes are config, so teams can split a service or move it to new hosts by changing one line. The public API stays stable.',
      ],
      keyIdea: 'The gateway maps public URLs to internal services, so the public API stays stable while the backend changes.',
      metrics: { trips: '4', latency: '440 ms', auth: '4', overhead: '0.3 ms' },
      scene: {
        nodes: [phone, { ...gw, status: 'active' }, users, orders, catalog],
        links: [link('phone', 'gw'), link('gw', 'users'), link('gw', 'orders'), link('gw', 'catalog')],
        flows: [
          { path: ['phone', 'gw', 'users'], tone: 'request', label: '/users/me', duration: 1.6 },
          { path: ['phone', 'gw', 'catalog'], tone: 'request', label: '/catalog/42', duration: 1.6, delay: 0.8 },
          { path: ['phone', 'gw', 'orders'], tone: 'request', label: '/orders', duration: 1.6, delay: 1.6 },
        ],
        panel: {
          title: 'Route table',
          icon: 'Route',
          rows: [
            { text: '/users/*', value: 'users.internal' },
            { text: '/orders/*', value: 'orders.internal' },
            { text: '/catalog/*', value: 'catalog.internal' },
          ],
        },
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
      title: 'Canary routes',
      tag: 'concept',
      heading: 'Routing can also split and rewrite',
      eli5: 'The desk can send one guest in twenty to the new kitchen to see if they like it, and rewrite the order slip so the old kitchen and the new one both understand it.',
      body: [
        'The gateway can strip a prefix, rewrite a header or send 5% of `/catalog` traffic to a canary build. If errors rise, set the weight back to zero.',
        'Versioned paths such as `/v1` and `/v2` can point at different deployments, so old app versions keep working while new ones move on.',
      ],
      keyIdea: 'Weighted routes let you ship a new version to a few users first and roll back with one config edit.',
      metrics: { trips: '4', latency: '440 ms', auth: '4', overhead: '0.3 ms' },
      scene: {
        nodes: [
          { ...gw, status: 'active' },
          { ...catalog, id: 'catalog', label: 'catalog v1', at: at(-3.2, 3.8), chips: ['95% of traffic'] },
          { ...catalog, id: 'catalogv2', label: 'catalog v2', sub: 'canary', at: at(3.2, 3.8), tint: 'green', chips: [{ text: '5% of traffic', tone: 'warn' }] },
        ],
        links: [link('gw', 'catalog', { label: 'weight 95' }), link('gw', 'catalogv2', { label: 'weight 5' })],
        flows: [
          { path: ['gw', 'catalog'], tone: 'request', count: 4, duration: 1.4 },
          { path: ['gw', 'catalogv2'], tone: 'request', duration: 1.4, delay: 0.6 },
        ],
        panel: {
          title: 'Rollout dial',
          icon: 'Split',
          rows: [
            { text: 'v1 weight', value: '95' },
            { text: 'v2 weight', value: '5', tone: 'warn' },
            { text: 'v2 error rate', value: '0.1%', tone: 'good' },
          ],
          footer: { text: 'Errors rise: set v2 to 0', tone: 'muted' },
        },
        caption: 'A small slice of traffic tries the new build',
      },
    },
    {
      title: 'Find instances',
      tag: 'concept',
      heading: 'How the gateway finds live instances',
      eli5: 'The back rooms move staff around all day. The desk keeps a board listing who is on shift now, and crosses names off when someone goes home.',
      body: [
        'Instances come and go: deploys, crashes, autoscaling. A static host list goes stale in minutes.',
        'The gateway asks a **service registry** (Consul, Kubernetes, Eureka) for the healthy addresses behind each route, and drops an instance after failed **health checks**. Config names a service, not an IP.',
      ],
      keyIdea: 'Routes point at service names. A registry and health checks turn names into live addresses.',
      metrics: { trips: '4', latency: '440 ms', auth: '4', overhead: '0.4 ms' },
      scene: {
        nodes: [
          { ...gw, status: 'active' },
          { id: 'registry', kind: 'block', size: 0.72, at: at(4, -3.8), label: 'registry', sub: 'who is alive', icon: 'List', tint: 'gray' },
          { ...orders, id: 'orders', label: 'orders A', at: at(-3.2, 3.8), status: 'ok' },
          { ...orders, id: 'orders2', label: 'orders B', at: at(3.2, 3.8), status: 'down', badge: 'health check failed' },
        ],
        links: [link('gw', 'registry', { label: 'who is alive?', arrow: 'both' }), link('gw', 'orders'), link('gw', 'orders2', { style: 'faint' })],
        flows: [
          { path: ['gw', 'registry', 'gw'], tone: 'request', label: 'orders?', duration: 1.4 },
          { path: ['gw', 'orders'], tone: 'request', duration: 1.2, delay: 1.5 },
        ],
        panel: {
          title: 'Registry answer for orders',
          icon: 'List',
          rows: [
            { text: '10.0.4.11:8080', value: 'healthy', tone: 'good' },
            { text: '10.0.4.12:8080', value: 'failing', tone: 'bad' },
          ],
          footer: { text: 'Only healthy addresses get traffic', tone: 'good' },
        },
        caption: 'Names resolve to whatever is alive now',
      },
    },
    {
      title: 'Auth once',
      tag: 'concept',
      heading: 'Check identity once, at the edge',
      eli5: 'The front desk checks your room key once. That is **authentication**: proving who you are. Then it tells the back room your name.',
      body: [
        'The gateway validates the token on every request: signature, expiry, audience. A bad token gets a `401` before it reaches any service.',
        'On success it forwards the request with a trusted header such as `X-User-Id: 42`. One implementation, reviewed once, patched once.',
      ],
      keyIdea: 'Authenticate at the gateway so one reviewed implementation protects every service.',
      metrics: { trips: '4', latency: '440 ms', auth: '1', overhead: '0.5 ms' },
      metricTones: { auth: 'good' },
      scene: {
        nodes: [{ ...phone, chips: [{ text: 'Bearer eyJ...' }] }, { ...gw, status: 'active', badge: 'JWT ok · user 42' }, { ...orders, status: 'active', chips: ['X-User-Id: 42'] }],
        links: [link('phone', 'gw'), link('gw', 'orders')],
        flows: [
          { path: ['phone', 'gw', 'orders'], tone: 'request', label: 'Bearer eyJ...', duration: 1.6 },
          { path: ['phone', 'gw'], tone: 'request', label: 'expired token', duration: 1, delay: 1.8 },
          { path: ['gw', 'phone'], tone: 'error', label: '401', duration: 1, delay: 2.9 },
        ],
        panel: {
          title: 'Token checks at the gateway',
          icon: 'KeyRound',
          rows: [
            { text: 'Signature', value: 'valid', tone: 'good' },
            { text: 'Expiry', value: 'not past', tone: 'good' },
            { text: 'Audience', value: 'shop-api', tone: 'good' },
          ],
          footer: { text: 'Fail any check: 401 at the door', tone: 'muted' },
        },
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
      title: 'Authn vs authz',
      tag: 'tradeoff',
      heading: 'Who you are, versus what you may do',
      eli5: 'The desk knows your name, but only the kitchen knows whether you may order from the staff menu. So the desk checks the name and the kitchen checks the permission.',
      body: [
        'The gateway answers who you are. It can also apply coarse **authorization**, such as "this API key may only call `/catalog`".',
        'Fine-grained rules (may user 42 see order 9001?) stay in the service that owns the data. The gateway does not have that data and should not.',
      ],
      keyIdea: 'Authenticate and apply coarse scopes at the gateway. Authorize per object in the owning service.',
      metrics: { trips: '4', latency: '440 ms', auth: '1', overhead: '0.5 ms' },
      scene: {
        nodes: [{ ...gw, status: 'active', badge: 'user 42, scope: orders' }, { ...orders, status: 'active', chips: [{ text: 'order 9001 is yours?' }] }, { ...users, status: 'dim' }],
        links: [link('gw', 'orders'), link('gw', 'users', { style: 'faint' })],
        flows: [
          { path: ['gw', 'orders'], tone: 'request', label: 'GET /orders/9001', duration: 1.4 },
          { path: ['orders', 'gw'], tone: 'error', label: '403', duration: 1.2, delay: 1.5 },
        ],
        panel: {
          title: 'Who decides what',
          icon: 'Shield',
          rows: [
            { text: 'Valid token?', value: 'gateway' },
            { text: 'Scope allows /orders?', value: 'gateway' },
            { text: 'Owns order 9001?', value: 'orders service', tone: 'warn' },
          ],
        },
        caption: 'The service owns the data, so it owns the verdict',
      },
      quiz: {
        question: 'The gateway validated the JWT for user 42. Who should check that user 42 owns order 9001?',
        options: [
          'The gateway, because it already read the token',
          'The orders service, because it owns the order data',
          'The mobile app, before it sends the request',
          'The load balancer',
        ],
        answer: 1,
        explain: 'The gateway proves identity and can apply coarse scopes. Only the service that owns the data can say who may see a given record.',
      },
    },
    {
      title: 'Rate limits',
      tag: 'case',
      heading: 'Case: a buggy app release retries in a loop',
      eli5: 'One guest rings the desk bell over and over. The **rate limiter** is the tally sheet beside the desk: after 100 rings in a minute the desk says wait, so the back rooms stay calm.',
      body: [
        'A new app version retries failed calls with no backoff. A few thousand phones start sending **2,000 requests per second** to `/orders`, ten times normal.',
        'The gateway enforces a **rate limit** per API key or user, for example a token bucket of 100 requests per minute. Over the limit, the client gets `429 Too Many Requests` with a `Retry-After` header and orders never sees the flood.',
      ],
      keyIdea: 'Rate limiting at the gateway protects every service behind it from one misbehaving client.',
      metrics: { trips: '4', latency: '440 ms', auth: '1', overhead: '0.8 ms' },
      scene: {
        nodes: [
          { ...phone, status: 'hot', badge: '2,000 req/s' },
          { ...gw, status: 'active' },
          { ...limiter, status: 'active', badge: 'user 42: 100/min' },
          { ...orders, status: 'ok', chips: [{ text: 'normal load', tone: 'good' }] },
        ],
        links: [link('phone', 'gw'), link('gw', 'limiter', { style: 'dashed' }), link('gw', 'orders')],
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
      title: 'Shared counters',
      tag: 'concept',
      heading: 'Counters live in a shared store',
      eli5: 'There are several front desks. If each kept its own tally sheet, a guest could ring 100 times at each desk. So all desks write on one shared sheet.',
      body: [
        'With several gateway instances, a counter in local memory lets a client send 100 requests to each one. Counters live in a shared store such as Redis, so every instance enforces the same limit.',
        'The cost is one extra call, under 1 ms, on every request. The next lessons on caching and rate limiting go deeper.',
      ],
      keyIdea: 'A limit enforced by many gateways needs one shared counter, or it is not a limit.',
      metrics: { trips: '4', latency: '440 ms', auth: '1', overhead: '0.8 ms' },
      scene: {
        nodes: [
          { ...gw, id: 'gw', at: at(-3.8, -3.8), label: 'gateway 1', status: 'active' },
          { ...gw, id: 'gw2', at: at(3.8, -3.8), label: 'gateway 2', sub: 'stateless copy', status: 'active' },
          { ...limiter, at: at(0, 0.5), size: 1, label: 'Redis', sub: 'user 42: 61/100', status: 'active' },
        ],
        links: [link('gw', 'limiter', { label: 'INCR', arrow: 'both' }), link('gw2', 'limiter', { label: 'INCR', arrow: 'both' })],
        flows: [
          { path: ['gw', 'limiter', 'gw'], tone: 'request', label: '60', duration: 1.4 },
          { path: ['gw2', 'limiter', 'gw2'], tone: 'request', label: '61', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Local vs shared counters',
          icon: 'Gauge',
          rows: [
            { text: 'Local memory, 2 gateways', value: 'allows 200', tone: 'bad' },
            { text: 'Shared Redis counter', value: 'allows 100', tone: 'good' },
          ],
        },
        caption: 'Both gateways count in the same place',
      },
    },
    {
      title: 'Quotas',
      tag: 'concept',
      heading: 'Quotas and plans for API customers',
      eli5: 'The desk also keeps a monthly meal allowance per guest. Free guests get 10 meals, paying guests get 1,000, and the desk stops serving when the allowance is gone.',
      body: [
        'A rate limit smooths bursts per minute. A **quota** caps total use per day or month, tied to an API key and a plan.',
        'The gateway counts usage per key and answers `429` once the quota is spent. The same counters feed billing and the usage dashboard.',
      ],
      keyIdea: 'Rate limits protect the system from bursts. Quotas enforce what each customer paid for.',
      metrics: { trips: '4', latency: '440 ms', auth: '1', overhead: '0.8 ms' },
      scene: {
        nodes: [phone, { ...gw, status: 'active', badge: 'key: free-plan' }, { ...limiter, label: 'usage store', sub: 'per key, per month', status: 'active' }],
        links: [link('phone', 'gw'), link('gw', 'limiter', { arrow: 'both' })],
        flows: [
          { path: ['phone', 'gw'], tone: 'request', label: 'x-api-key', duration: 1.2 },
          { path: ['gw', 'limiter', 'gw'], tone: 'request', duration: 1.2, delay: 1.3 },
          { path: ['gw', 'phone'], tone: 'error', label: '429 quota used', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'Plans',
          icon: 'Table',
          rows: [
            { text: 'Free', value: '10,000 calls / month', tone: 'warn' },
            { text: 'Pro', value: '1,000,000 / month' },
            { text: 'Rate limit, all plans', value: 'per minute' },
          ],
        },
        caption: 'Same counters, a different question',
      },
    },
    {
      title: 'Part 1 recap',
      tag: 'recap',
      heading: 'The edge does the plumbing once',
      eli5: 'The front desk, the **API gateway**, now checks keys once, counts bell rings on one shared sheet and sends each guest to the right back room. Part 2 teaches the desk to carry trays.',
      body: [
        'A **reverse proxy** hides the servers and ends TLS. An **API gateway** adds routing, auth, rate limits and quotas, and finds live instances through a registry.',
        'Four copies of auth became one, and the shared counter makes limits real across many gateways. Part 2 covers aggregation, BFFs, resilience, the god box trap and gateway versus mesh.',
      ],
      keyIdea: 'Centralize auth, limits and routing at the edge, and keep the counters in a shared store.',
      metrics: { trips: '4', latency: '440 ms', auth: '1', overhead: '0.8 ms' },
      metricTones: { auth: 'good' },
      scene: {
        nodes: [phone, { ...gw, status: 'ok' }, limiter, users, orders],
        links: [link('phone', 'gw'), link('gw', 'limiter', { style: 'dashed' }), link('gw', 'users'), link('gw', 'orders')],
        flows: [
          { path: ['phone', 'gw', 'orders'], tone: 'request', label: 'Bearer eyJ...', duration: 1.6 },
          { path: ['gw', 'phone'], tone: 'error', label: '429', duration: 1, delay: 1.8 },
        ],
        caption: 'Auth, limits and routes, once',
      },
      quiz: {
        question: 'Three gateway instances each keep their own in-memory counter for a 100 requests per minute limit. How many requests per minute can one client send?',
        options: [
          '100, because each gateway sees the same client',
          'Up to 300, because each instance counts separately',
          '33, because the limit is split between instances',
          'Unlimited, because counters in memory are ignored',
        ],
        answer: 1,
        explain: 'Each instance enforces 100 on its own, so a client spread across three gets 300. A shared Redis counter makes the limit global.',
      },
    },
  ],
};
