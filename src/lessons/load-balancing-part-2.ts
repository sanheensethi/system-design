import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const users: SceneNode = { id: 'users', kind: 'block', at: at(-5.4, -4.4), label: 'users', sub: '5,000 req/s', icon: 'Users', tint: 'blue' };
const lb: SceneNode = { id: 'lb', kind: 'block', at: at(0, -4.4), label: 'load balancer', sub: 'VIP 203.0.113.5', icon: 'Split', tint: 'violet' };
const lb2: SceneNode = { id: 'lb2', kind: 'block', at: at(5.4, -4.4), label: 'standby LB', sub: 'passive', icon: 'Split', tint: 'gray' };
const pool: SceneNode = { id: 'pool', kind: 'block', at: at(0, 3.4), label: 'app pool', sub: '4 servers', icon: 'Boxes', tint: 'green' };
const app1: SceneNode = { id: 'app1', kind: 'server', size: 0.85, at: at(-5.4, 3.4), label: 'app 1', sub: '10.0.0.11' };
const app2: SceneNode = { id: 'app2', kind: 'server', size: 0.85, at: at(-1.8, 3.4), label: 'app 2', sub: '10.0.0.12' };
const app3: SceneNode = { id: 'app3', kind: 'server', size: 0.85, at: at(1.8, 3.4), label: 'app 3', sub: '10.0.0.13' };

const l7: SceneNode = { id: 'l7', kind: 'block', at: at(5.4, -4.4), label: 'L7 proxies', sub: 'route by path', icon: 'Split', tint: 'violet', status: 'active' };

export const loadBalancingPart2: Lesson = {
  id: 'load-balancing-part-2',
  title: 'Load balancing (part 2)',
  tagline: 'How much the load balancer should read, where TLS ends, how retries work, and how to keep the balancer itself from failing.',
  minutes: 12,
  level: 'Beginner',
  learn: [
    'The difference between L4 and L7 balancing, and where each belongs',
    'TLS termination and forwarded headers',
    'Retrying safely on another backend',
    'Active-passive and active-active load balancer pairs',
    'DNS round robin and global load balancing',
  ],
  metrics: [
    { key: 'qps', label: 'Traffic', icon: 'Activity' },
    { key: 'load', label: 'Load per server', icon: 'Gauge' },
    { key: 'p99', label: 'p99 latency', icon: 'Timer' },
    { key: 'errors', label: 'Errors', icon: 'Bug' },
    { key: 'healthy', label: 'Healthy', icon: 'Server' },
  ],
  steps: [
    {
      title: 'L4',
      tag: 'concept',
      heading: 'L4: balance connections, see no content',
      eli5: 'An **L4** host only looks at which door you walked through, and sends you to a waiter without reading anything you say. That makes the host very fast.',
      body: [
        'An **L4** balancer works on TCP or UDP. It sees IP and port, picks a backend per connection and shuffles packets. It is very fast, sometimes kernel level.',
        'Examples are AWS NLB, LVS and HAProxy in `mode tcp`. It fits databases, internal gRPC planes and raw TCP protocols, and it can run health checks at the TCP level.',
      ],
      keyIdea: 'L4 is fast and blind to content. It routes connections, not requests.',
      metrics: { qps: '5,000/s', load: '63%', p99: '75 ms', errors: '0%', healthy: '4 / 4' },
      metricTones: { p99: 'good' },
      scene: {
        nodes: [users, { ...lb, status: 'active', sub: 'L4 · TCP', chips: ['sees TCP :443 only'] }, pool],
        links: [link('users', 'lb'), link('lb', 'pool', { label: 'per connection' })],
        flows: [
          { path: ['users', 'lb', 'pool'], tone: 'request', label: 'TCP :443', duration: 1.6 },
          { path: ['users', 'lb', 'pool'], tone: 'request', label: 'TCP :443', duration: 1.6, delay: 1 },
        ],
        panel: {
          title: 'What an L4 LB sees',
          icon: 'Cable',
          rows: [
            { text: 'Source IP, port', value: 'visible' },
            { text: 'Destination IP, port', value: 'visible' },
            { text: 'URL, headers, cookies', value: 'hidden', tone: 'bad' },
          ],
          footer: { text: 'AWS NLB, LVS, HAProxy tcp', tone: 'muted' },
        },
        caption: 'Packets pass through, content stays sealed',
      },
    },
    {
      title: 'L7',
      tag: 'concept',
      heading: 'L7: read the request, route by content',
      eli5: 'An **L7** host reads what you want, then sends dinner orders to app 1 and app 2 and dessert orders to app 3 and app 4.',
      body: [
        'An **L7** balancer terminates HTTP. It reads headers, cookies, path and method, so it can send `/api/*` to one pool and `/images/*` to another, set sticky cookies and retry a failed request elsewhere.',
        'Examples are nginx, Envoy, AWS ALB and HAProxy in `mode http`. The price is more CPU per request.',
      ],
      keyIdea: 'L7 can route on anything in the request. It costs more CPU and a bigger attack surface than L4.',
      metrics: { qps: '5,000/s', load: '63%', p99: '80 ms', errors: '0%', healthy: '4 / 4' },
      metricTones: { p99: 'good' },
      scene: {
        nodes: [
          { ...lb, status: 'active', sub: 'L7 · HTTP', chips: ['reads the path'] },
          { ...app1, at: at(-3.6, 3.4), sub: 'pool: api' },
          { ...app2, at: at(0, 3.4), sub: 'pool: api' },
          { ...app3, at: at(3.6, 3.4), sub: 'pool: images' },
        ],
        links: [link('lb', 'app1', { label: '/api/*' }), link('lb', 'app2', { label: '/api/*' }), link('lb', 'app3', { label: '/images/*' })],
        flows: [
          { path: ['lb', 'app1'], tone: 'request', label: 'GET /api/cart', duration: 1.4 },
          { path: ['lb', 'app3'], tone: 'request', label: 'GET /images/42.jpg', duration: 1.4, delay: 0.9 },
          { path: ['lb', 'app2'], tone: 'request', label: 'POST /api/order', duration: 1.4, delay: 1.8 },
        ],
        panel: {
          title: 'Routing rules',
          icon: 'Route',
          code: 'location /api/    -> pool api\nlocation /images/ -> pool images\ncookie SERVERID   -> sticky\nbackend fails     -> retry',
          footer: { text: 'nginx, Envoy, ALB, HAProxy http', tone: 'muted' },
        },
        caption: 'The path decides the pool',
      },
    },
    {
      title: 'L4 vs L7',
      tag: 'tradeoff',
      heading: 'Which layer where?',
      eli5: 'A fast host at the street door can be a quick pointer. Inside, a careful host who reads orders is worth the extra effort. Many restaurants use both.',
      body: [
        'The common setup runs L7 at the edge for HTTPS, routing and auth. L4 is kept for databases and raw TCP protocols. gRPC needs L7, since many requests share one HTTP/2 connection.',
        'Some stacks stack them: an L4 balancer spreads connections across a fleet of L7 proxies, which then route requests to the pools.',
      ],
      keyIdea: 'Use L7 where you need to understand requests and L4 where raw speed or any TCP protocol matters.',
      metrics: { qps: '5,000/s', load: '63%', p99: '80 ms', errors: '0%', healthy: '4 / 4' },
      scene: {
        nodes: [users, { ...lb, id: 'lb', sub: 'L4 edge', label: 'L4 balancer', tint: 'blue', icon: 'Cable' }, l7, pool],
        links: [link('users', 'lb'), link('lb', 'l7', { label: 'connections' }), link('l7', 'pool', { label: 'requests' })],
        flows: [
          { path: ['users', 'lb', 'l7', 'pool'], tone: 'request', duration: 2.2 },
          { path: ['users', 'lb', 'l7', 'pool'], tone: 'request', duration: 2.2, delay: 1.1 },
        ],
        panel: {
          title: 'Typical split',
          icon: 'Layers',
          rows: [
            { text: 'Public web and API', value: 'L7' },
            { text: 'Database, raw TCP', value: 'L4' },
            { text: 'Internal gRPC', value: 'L7 (per request)' },
            { text: 'Huge edge fleets', value: 'L4 then L7' },
          ],
        },
        caption: 'Fast connection spread, smart request routing',
      },
      quiz: {
        question: 'You need `/api/*` to go to one pool and `/images/*` to another, with sticky cookies. Which balancer fits?',
        options: [
          'L4, because it is faster',
          'L7, because it can read the path and cookies',
          'Either, they see the same data',
          'DNS round robin',
        ],
        answer: 1,
        explain: 'Only an L7 balancer parses HTTP, so it can route by path and set cookies. L4 sees IP and port only. DNS round robin spreads clients and cannot read requests.',
      },
    },
    {
      title: 'TLS offload',
      tag: 'concept',
      heading: 'Terminate TLS at the load balancer',
      eli5: 'The host takes the secret-code envelopes at the door, opens them and passes the plain notes inside. Waiters never need to learn the secret code or keep the key.',
      body: [
        'An L7 LB can **terminate TLS**: it decrypts HTTPS, reads the request, and talks plain HTTP to the backends over the private network. Certificates live in one place and backends skip the crypto cost.',
        'Backends lose the client\'s IP, so the LB adds `X-Forwarded-For`. Where policy demands it, re-encrypt to the backend as well.',
      ],
      keyIdea: 'Terminating TLS at the LB centralizes certificates and saves backend CPU. Pass the client IP in a header.',
      metrics: { qps: '5,000/s', load: '55%', p99: '78 ms', errors: '0%', healthy: '4 / 4' },
      metricTones: { load: 'good' },
      scene: {
        nodes: [users, { ...lb, status: 'active', sub: 'holds the TLS cert', chips: ['decrypts HTTPS'] }, pool],
        links: [link('users', 'lb', { label: 'HTTPS (encrypted)' }), link('lb', 'pool', { label: 'HTTP on private net' })],
        flows: [
          { path: ['users', 'lb'], tone: 'handshake', label: 'TLS handshake', duration: 1.2 },
          { path: ['users', 'lb', 'pool'], tone: 'request', label: 'GET /cart', duration: 1.8, delay: 1.3 },
        ],
        panel: {
          title: 'Headers added by the LB',
          icon: 'Shield',
          code: 'X-Forwarded-For:   198.51.100.7\nX-Forwarded-Proto: https\nX-Request-Id:      7f3a9c',
          footer: { text: 'Backends see the LB as the client', tone: 'muted' },
        },
        caption: 'Encrypted outside, plain inside',
      },
    },
    {
      title: 'Retries',
      tag: 'tradeoff',
      heading: 'Retry on another backend, carefully',
      eli5: 'If a waiter drops your soup, the host quietly asks another waiter to bring a new one. But for an order that is already paid, a second try could charge you twice.',
      body: [
        'With `proxy_next_upstream error timeout`, a failed request is retried on another backend. Users often never notice a server dying.',
        'Retry only **idempotent** requests, such as `GET`. A retried `POST /orders` may create two orders. Also cap the retries, or a slow pool gets extra load exactly when it can least handle it.',
      ],
      keyIdea: 'Retry safe requests on a different backend, with a limit, so retries do not become the outage.',
      metrics: { qps: '5,000/s', load: '70%', p99: '140 ms', errors: '0.2%', healthy: '3 / 4' },
      metricTones: { p99: 'warn' },
      scene: {
        nodes: [
          { ...lb, status: 'active', chips: ['retries: 1'] },
          { ...app2, status: 'down', chips: [{ text: 'GET /cart', tone: 'bad' }] },
          { ...app3, status: 'ok', chips: [{ text: 'GET /cart', tone: 'good' }] },
        ],
        links: [link('lb', 'app2', { style: 'dashed', label: 'timeout', labelTone: 'warn' }), link('lb', 'app3', { label: 'retry' })],
        flows: [
          { path: ['lb', 'app2'], tone: 'request', label: 'GET /cart', duration: 1.1 },
          { path: ['app2', 'lb'], tone: 'error', label: 'timeout', duration: 1, delay: 1.2 },
          { path: ['lb', 'app3'], tone: 'request', label: 'GET /cart (retry)', duration: 1.1, delay: 2.4 },
        ],
        panel: {
          title: 'Safe to retry?',
          icon: 'Repeat',
          rows: [
            { text: 'GET, HEAD', value: 'yes', tone: 'good' },
            { text: 'PUT, DELETE', value: 'if idempotent' },
            { text: 'POST /orders', value: 'risk: duplicates', tone: 'bad' },
          ],
          footer: { text: 'Cap retries, add a time budget', tone: 'warn' },
        },
        caption: 'A second backend gets the retry',
      },
    },
    {
      title: 'LB goes down',
      tag: 'case',
      heading: 'Case: we moved the single point of failure',
      eli5: 'All four waiters are ready, but the host at the door is out sick, so no family can get in. The load balancer has become a **single point of failure**.',
      body: [
        'Four healthy app servers, and the shop is down anyway. The machine running the load balancer lost its network card, and every client was pointed at its address.',
        'We removed the single point of failure from the app tier and created a new one in front of it. Anything that every request passes through needs a backup.',
      ],
      keyIdea: 'A component that every request crosses must itself be redundant, or it caps your availability.',
      metrics: { qps: '0/s', load: '0%', p99: '-', errors: '100%', healthy: '4 / 4' },
      metricTones: { qps: 'bad', errors: 'bad' },
      scene: {
        nodes: [users, { ...lb, status: 'down', chips: [{ text: 'NIC failure', tone: 'bad' }] }, { ...pool, status: 'dim', sub: '4 healthy servers' }],
        links: [link('users', 'lb', { label: 'connection refused', labelTone: 'warn' }), link('lb', 'pool', { style: 'faint' })],
        flows: [
          { path: ['users', 'lb'], tone: 'request', count: 3, duration: 1.2 },
          { path: ['lb', 'users'], tone: 'error', label: 'refused', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Availability math',
          icon: 'Gauge',
          rows: [
            { text: 'App tier', value: '4 servers, redundant', tone: 'good' },
            { text: 'Load balancer', value: '1 box, no backup', tone: 'bad' },
            { text: 'Whole shop', value: 'only as good as the LB', tone: 'bad' },
          ],
        },
        caption: 'Healthy servers, but no way to reach them',
      },
    },
    {
      title: 'Active-passive',
      tag: 'concept',
      heading: 'An active-passive pair behind a floating IP',
      eli5: 'Now two hosts work the door. One greets families while the standby LB watches. If the first host stops, the standby steps into the very same spot within two seconds. This is an **active-passive** pair.',
      body: [
        'Run two load balancers. The **active** one owns the virtual IP. The **passive** one watches it with heartbeats over VRRP (the `keepalived` daemon is the classic tool).',
        'When heartbeats stop, the passive claims the VIP and serves within one to three seconds. Clients never change the address they connect to. Cloud LBs do the same across availability zones.',
      ],
      keyIdea: 'Pair the load balancer and float the address between them, so a failure costs seconds instead of an outage.',
      metrics: { qps: '5,000/s', load: '63%', p99: '80 ms', errors: '0%', healthy: '4 / 4' },
      metricTones: { errors: 'good', healthy: 'good' },
      scene: {
        nodes: [users, { ...lb, status: 'down', sub: 'was active' }, { ...lb2, tint: 'violet', status: 'ok', sub: 'now owns the VIP', badge: 'took over in 2 s' }, pool],
        links: [link('users', 'lb2', { route: 'straight' }), link('lb', 'lb2', { style: 'dashed', label: 'heartbeat lost', labelTone: 'warn' }), link('lb2', 'pool')],
        flows: [
          { path: ['users', 'lb2'], tone: 'request', count: 3, duration: 1.4 },
          { path: ['lb2', 'pool'], tone: 'request', count: 3, duration: 1.2, delay: 1.5 },
        ],
        panel: {
          title: 'Failover timeline',
          icon: 'Clock',
          rows: [
            { text: '0 s', value: 'active LB dies' },
            { text: '1 s', value: 'heartbeats missed', tone: 'warn' },
            { text: '2 s', value: 'standby claims the VIP', tone: 'good' },
          ],
        },
        caption: 'The standby claims the virtual IP',
      },
    },
    {
      title: 'Active-active',
      tag: 'tradeoff',
      heading: 'Active-active: both serve, each can carry it all',
      eli5: 'Instead of one host standing by, both hosts greet families at once. If one goes home, the other can still seat everyone, as long as one host alone can manage the whole crowd.',
      body: [
        'Active-active means both LBs serve traffic, and DNS or anycast spreads clients across them. Both boxes serve traffic day to day.',
        'Each LB must be able to carry everything alone, or a failure just moves the overload to the survivor. So safe failover capacity is one box, the same as with a passive standby.',
      ],
      keyIdea: 'Active-active uses both boxes day to day, but each must carry the full load alone to be a real backup.',
      metrics: { qps: '5,000/s', load: '60%', p99: '80 ms', errors: '0%', healthy: '4 / 4' },
      metricTones: { errors: 'good', load: 'warn' },
      scene: {
        nodes: [
          users,
          { ...lb, chips: ['2,500 req/s'], load: 60 },
          { ...lb2, label: 'load balancer', sub: 'VIP 203.0.113.6', tint: 'violet', chips: ['2,500 req/s'], load: 60 },
          pool,
        ],
        links: [link('users', 'lb', { label: 'DNS: 2 addresses' }), link('users', 'lb2'), link('lb', 'pool'), link('lb2', 'pool')],
        flows: [
          { path: ['users', 'lb', 'pool'], tone: 'request', duration: 1.6 },
          { path: ['users', 'lb2', 'pool'], tone: 'request', duration: 1.6, delay: 0.8 },
        ],
        panel: {
          title: 'Active-passive vs active-active',
          icon: 'Scale',
          rows: [
            { text: 'Active-passive', value: 'standby idle, simple' },
            { text: 'Active-active', value: 'both used, more complex' },
            { text: 'Each LB at 60%', value: 'one fails, survivor at 120%', tone: 'bad' },
            { text: 'Sizing rule', value: 'each carries 100%, run under 50%', tone: 'warn' },
          ],
        },
        caption: 'Both serve, either can take over',
      },
    },
    {
      title: 'DNS level',
      tag: 'tradeoff',
      heading: 'DNS round robin and global balancing',
      eli5: 'Before families even reach the restaurant, a phone book can point them to different restaurants in different towns. The book cannot tell if a restaurant is closed.',
      body: [
        '**DNS round robin** lists several IPs for one name. It is free, but it has no health awareness and clients cache answers for the DNS TTL, so a dead node hurts for minutes.',
        '**Global load balancing** (geo DNS or anycast) sends users to the nearest healthy region, with a local LB inside each. It sits above the LB tier, not instead of it.',
      ],
      keyIdea: 'DNS spreads clients across regions and LBs. It cannot see health in real time, so keep the local LB.',
      metrics: { qps: '5,000/s', load: '63%', p99: '80 ms', errors: '0%', healthy: '4 / 4' },
      scene: {
        nodes: [
          users,
          { id: 'dns', kind: 'dns', at: at(0, -4.4), label: 'geo DNS', sub: 'TTL 60 s', status: 'active' },
          { ...lb, id: 'lbeu', at: at(-3.2, 3.4), label: 'LB eu', sub: 'Frankfurt' },
          { ...lb, id: 'lbus', at: at(3.2, 3.4), label: 'LB us', sub: 'Virginia' },
        ],
        links: [link('users', 'dns'), link('dns', 'lbeu', { label: 'EU users' }), link('dns', 'lbus', { label: 'US users' })],
        flows: [
          { path: ['users', 'dns'], tone: 'handshake', label: 'shop.example?', duration: 1.1 },
          { path: ['dns', 'users'], tone: 'response', label: 'nearest LB', duration: 1.1, delay: 1.2 },
          { path: ['users', 'dns', 'lbeu'], tone: 'request', duration: 1.6, delay: 2.5 },
        ],
        panel: {
          title: 'DNS as a balancer',
          icon: 'Earth',
          rows: [
            { text: 'Spreads load', value: 'yes', tone: 'good' },
            { text: 'Sees health live', value: 'no', tone: 'bad' },
            { text: 'Changes take effect', value: 'after TTL', tone: 'warn' },
          ],
          footer: { text: 'Each region still runs its own LB', tone: 'muted' },
        },
        caption: 'DNS picks a region, the LB picks a server',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'The load balancer layer',
      eli5: 'The host can only point at doors (**L4**) or read orders (**L7**). Whichever kind of host you pick, keep a second one ready, so the restaurant stays open when one goes home.',
      body: [
        'Pick **L7** to route by content and **L4** for raw speed, and often use both. Terminate TLS at the LB, and retry only requests that are safe to repeat.',
        'The LB is on every request path, so run a pair: **active-passive** with a floating IP, or **active-active** with each able to carry all traffic. DNS spreads clients across regions.',
      ],
      keyIdea: 'Choose the layer by what you must see, and never leave a single load balancer on the path of every request.',
      metrics: { qps: '5,000/s', load: '63%', p99: '80 ms', errors: '0%', healthy: '4 / 4' },
      metricTones: { load: 'good', p99: 'good', errors: 'good', healthy: 'good' },
      scene: {
        nodes: [users, { ...lb, status: 'ok', sub: 'active' }, { ...lb2, status: 'idle' }, pool],
        links: [link('users', 'lb'), link('lb', 'lb2', { style: 'dashed', label: 'heartbeat' }), link('lb', 'pool')],
        flows: [
          { path: ['users', 'lb', 'pool'], tone: 'request', duration: 1.6 },
          { path: ['pool', 'lb', 'users'], tone: 'response', duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'The checklist',
          icon: 'List',
          rows: [
            { text: 'Layer', value: 'L7 edge, L4 for TCP' },
            { text: 'TLS', value: 'ends at the LB', tone: 'good' },
            { text: 'Retries', value: 'safe requests only', tone: 'good' },
            { text: 'LB redundancy', value: 'active-passive pair', tone: 'good' },
            { text: 'Global', value: 'geo DNS over local LBs' },
          ],
        },
        caption: 'One address, many servers, no single box',
      },
      quiz: {
        question: 'Two active-active load balancers each run at 60% of their capacity. One fails. What happens?',
        options: [
          'The survivor runs at 60% and nothing changes',
          'The survivor must take 120% of its capacity, so it overloads. Each LB needs to carry all traffic alone',
          'DNS stops sending traffic to either LB',
          'The failed LB heals itself through VRRP',
        ],
        answer: 1,
        explain: 'Active-active only protects you if either box can carry the whole load. At 60% each, the survivor sees 120% and fails too. Keep each LB under 50% in normal operation.',
      },
    },
  ],
};
