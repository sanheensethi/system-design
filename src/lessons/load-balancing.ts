import type { Lesson, SceneNode } from '../engine/types';

const users: SceneNode = { id: 'users', kind: 'client', at: [-5.5, 0], label: 'users', sub: '5,000 req/s' };
const lb: SceneNode = { id: 'lb', kind: 'lb', at: [-2, 0], label: 'load balancer', sub: 'VIP 203.0.113.5' };
const lb2: SceneNode = { id: 'lb2', kind: 'lb', at: [-2, 2.6], label: 'standby LB', sub: 'passive' };
const app1: SceneNode = { id: 'app1', kind: 'server', at: [2.5, -1], label: 'app 1', sub: '10.0.0.11' };
const app2: SceneNode = { id: 'app2', kind: 'server', at: [2.5, 1], label: 'app 2', sub: '10.0.0.12' };
const app3: SceneNode = { id: 'app3', kind: 'server', at: [2.5, -3], label: 'app 3', sub: '10.0.0.13' };
const app4: SceneNode = { id: 'app4', kind: 'server', at: [2.5, 3], label: 'app 4', sub: '10.0.0.14' };

const pool = [app1, app2, app3, app4];
const poolLinks = pool.map((s) => ({ from: 'lb', to: s.id }));

export const loadBalancing: Lesson = {
  id: 'load-balancing',
  title: 'Load balancing',
  tagline: 'Spread traffic across a pool of servers, route around the dead ones, and avoid a new single point of failure.',
  minutes: 12,
  level: 'Beginner',
  learn: [
    'Why one server stops scaling and what a load balancer adds',
    'Round robin, least connections and hash-based routing',
    'How health checks pull a dead server out of rotation',
    'The difference between L4 and L7 balancing',
    'Why the load balancer itself needs a standby',
  ],
  metrics: [
    { key: 'qps', label: 'Traffic' },
    { key: 'load', label: 'Load per server' },
    { key: 'p99', label: 'p99 latency' },
    { key: 'errors', label: 'Errors' },
    { key: 'healthy', label: 'Healthy' },
  ],
  steps: [
    {
      title: 'One server',
      tag: 'problem',
      heading: 'One server, five thousand requests a second',
      eli5: 'The restaurant has one waiter, app 1, and five thousand hungry families arriving at once. Being asked to do more than you can handle is called **overload**, and families start leaving hungry.',
      body: [
        'The shop launched a sale. Traffic went from 800 to **5,000 requests per second** and every one of them lands on a single app server.',
        'A typical HTTP app server handles 1,000 to 10,000 QPS depending on the work per request. Ours tops out near 2,000. Past that, requests queue for CPU, the p99 climbs to 2.4 seconds and timeouts turn into errors.',
        'A bigger box only delays the problem. And if this one machine reboots, the whole shop is offline.',
      ],
      keyIdea: 'One server is a ceiling on capacity and a single point of failure at the same time.',
      metrics: { qps: '5,000/s', load: '250%', p99: '2.4 s', errors: '18%', healthy: '1 / 1' },
      scene: {
        nodes: [users, { ...app1, status: 'hot', badge: '250% CPU' }],
        links: [{ from: 'users', to: 'app1' }],
        flows: [
          { path: ['users', 'app1'], tone: 'request', count: 6, duration: 1.2 },
          { path: ['app1', 'users'], tone: 'error', label: '503', duration: 1.4, delay: 1.4 },
        ],
        caption: 'Every request hits the same machine',
      },
    },
    {
      title: 'Add a pool',
      tag: 'concept',
      heading: 'Put a load balancer in front of a pool',
      eli5: 'The **load balancer** is the host at the door. Families only talk to the host, who sends each one to one of four waiters, so no waiter is swamped.',
      body: [
        'We run four copies of the app and put a **load balancer** (LB) in front. Clients only know one address, the LB\'s virtual IP. The LB picks a backend for each request and forwards it.',
        'With 5,000 QPS over four servers, each sees about 1,250, or 63% of its capacity. That leaves headroom for spikes and for losing a server.',
        'The pool is now elastic. Add a fifth server to the `upstream` list and it starts taking traffic. Remove one and the others absorb its share.',
      ],
      keyIdea: 'A load balancer turns many servers into one address, so you scale by adding machines instead of buying bigger ones.',
      metrics: { qps: '5,000/s', load: '63%', p99: '80 ms', errors: '0%', healthy: '4 / 4' },
      scene: {
        nodes: [users, { ...lb, status: 'active' }, ...pool.map((s) => ({ ...s, badge: '1,250/s' }))],
        links: [{ from: 'users', to: 'lb' }, ...poolLinks],
        flows: [
          { path: ['users', 'lb'], tone: 'request', count: 4, duration: 1 },
          { path: ['lb', 'app3'], tone: 'request', duration: 1, delay: 1 },
          { path: ['lb', 'app1'], tone: 'request', duration: 1, delay: 1.2 },
          { path: ['lb', 'app2'], tone: 'request', duration: 1, delay: 1.4 },
          { path: ['lb', 'app4'], tone: 'request', duration: 1, delay: 1.6 },
        ],
        caption: 'One public address, four backends',
      },
      code: {
        language: 'bash',
        title: 'nginx.conf: an upstream pool',
        source: `upstream shop_app {
    least_conn;                       # pick the least busy backend
    server 10.0.0.11:8080;
    server 10.0.0.12:8080;
    server 10.0.0.13:8080 max_fails=3 fail_timeout=10s;
    server 10.0.0.14:8080 weight=2;   # bigger box, twice the share
}

server {
    listen 443 ssl;
    location / {
        proxy_pass http://shop_app;
        proxy_next_upstream error timeout;   # retry on another backend
    }
}`,
        highlight: [1, 2, 5, 6, 12],
      },
    },
    {
      title: 'Round robin',
      tag: 'concept',
      heading: 'Round robin: take turns',
      eli5: '**Round robin** means the host takes turns: the first family goes to app 1, the next to app 2, then app 3, then app 4, and around again. It is fair when every family orders about the same amount.',
      body: [
        'The simplest algorithm is **round robin**. Request 1 goes to app 1, request 2 to app 2, and so on, then back to the start. **Weighted** round robin gives a bigger box a bigger share.',
        'Round robin assumes every request costs about the same. For a page that renders in 20 ms, that holds well enough and the load comes out even.',
      ],
      keyIdea: 'Round robin is fair by count. It is only fair by load when requests cost about the same.',
      metrics: { qps: '5,000/s', load: '63%', p99: '80 ms', errors: '0%', healthy: '4 / 4' },
      scene: {
        nodes: [users, { ...lb, badge: 'next: app 1' }, ...pool],
        links: [{ from: 'users', to: 'lb' }, ...poolLinks],
        flows: [
          { path: ['users', 'lb', 'app1'], tone: 'request', label: '#1', duration: 1.4 },
          { path: ['users', 'lb', 'app2'], tone: 'request', label: '#2', duration: 1.4, delay: 0.7 },
          { path: ['users', 'lb', 'app3'], tone: 'request', label: '#3', duration: 1.4, delay: 1.4 },
          { path: ['users', 'lb', 'app4'], tone: 'request', label: '#4', duration: 1.4, delay: 2.1 },
        ],
        caption: '1, 2, 3, 4, repeat',
      },
    },
    {
      title: 'Least connections',
      tag: 'case',
      heading: 'Case: one slow request type breaks round robin',
      eli5: 'Waiter app 3 is stuck with slow tables that take forever. With **least connections**, the host looks at who is serving the fewest tables right now and sends the next family there.',
      body: [
        'Admins start exporting order reports. Each export holds a connection for 30 seconds. Round robin keeps handing app 3 its turn, and app 3 piles up 40 open connections while the others sit at 8.',
        '**Least connections** fixes this. The LB tracks open connections per backend and sends each new request to the least busy one. Slow work naturally steers traffic away from the server doing it.',
        'A cheap variant at large scale is **power of two choices**: pick two backends at random and send to the less loaded. It is nearly as good and needs no global view.',
      ],
      keyIdea: 'When request cost varies, balance by current load, measured as open connections.',
      metrics: { qps: '5,000/s', load: '63%', p99: '95 ms', errors: '0%', healthy: '4 / 4' },
      scene: {
        nodes: [
          users,
          { ...lb, status: 'active', badge: 'least_conn' },
          { ...app1, badge: '8 conns' },
          { ...app2, badge: '9 conns' },
          { ...app3, status: 'hot', badge: '40 conns · exports' },
          { ...app4, badge: '7 conns' },
        ],
        links: [{ from: 'users', to: 'lb' }, ...poolLinks.map((l) => (l.to === 'app3' ? { ...l, style: 'faint' as const } : l))],
        flows: [
          { path: ['users', 'lb'], tone: 'request', count: 3, duration: 1 },
          { path: ['lb', 'app4'], tone: 'request', duration: 1, delay: 1 },
          { path: ['lb', 'app1'], tone: 'request', duration: 1, delay: 1.3 },
          { path: ['lb', 'app2'], tone: 'request', duration: 1, delay: 1.6 },
        ],
        caption: 'New requests skip the busy server',
      },
    },
    {
      title: 'Affinity',
      tag: 'tradeoff',
      heading: 'Hashing and sticky sessions',
      eli5: 'The host uses your family name to pick a waiter, so you always get app 2, who remembers your favorite meal. That is **hash-based routing**. It is quick, but some waiters end up busier than others.',
      body: [
        'Sometimes you want the same client to land on the same backend. Each app server keeps a local cache of user carts, so sending user 42 to app 2 every time means warm cache hits.',
        '**Hash-based routing** does this: `hash(user_id) mod N` picks the server. Plain modulo reshuffles almost every user when N changes, so real systems use **consistent hashing**, which moves only about 1/N of keys when a server joins or leaves.',
        'The cost is uneven load. A few heavy users can pin one server hot, and **sticky sessions** that store login state on one box lose that state when it dies. Keep session data in a shared store and use affinity only for cache warmth.',
      ],
      keyIdea: 'Affinity buys cache hits at the price of even load. Never make correctness depend on it.',
      metrics: { qps: '5,000/s', load: '55 to 80%', p99: '70 ms', errors: '0%', healthy: '4 / 4' },
      scene: {
        nodes: [
          users,
          { ...lb, badge: 'hash(user_id)' },
          app1,
          { ...app2, status: 'active', badge: 'user 42 · warm cache' },
          app3,
          { ...app4, badge: 'user 7' },
        ],
        links: [{ from: 'users', to: 'lb' }, ...poolLinks],
        flows: [
          { path: ['users', 'lb', 'app2'], tone: 'request', label: 'user 42', duration: 1.6 },
          { path: ['users', 'lb', 'app2'], tone: 'request', label: 'user 42', duration: 1.6, delay: 1.2 },
          { path: ['users', 'lb', 'app4'], tone: 'request', label: 'user 7', duration: 1.6, delay: 0.6 },
        ],
        caption: 'The same key always lands on the same server',
      },
      quiz: {
        question: 'Your pool uses hash(user_id) mod 4. You add a fifth server. What happens to cache affinity?',
        options: [
          'Nothing, users keep their servers',
          'About 1 in 5 users move to the new server',
          'Most users map to a different server, so most local caches go cold',
          'The load balancer rejects traffic until caches warm up',
        ],
        answer: 2,
        explain: 'Changing N in a modulo hash remaps almost every key. Consistent hashing exists to limit the move to roughly 1/N of keys.',
      },
    },
    {
      title: 'Health checks',
      tag: 'case',
      heading: 'Case: app 3 dies at 2 a.m.',
      eli5: 'Every few seconds the host asks each waiter if they are okay. That question is a **health check**. App 3 does not answer three times in a row, so the host stops sending families there.',
      body: [
        'App 3 runs out of memory and stops answering. Without health awareness, the LB keeps sending it one request in four, and a quarter of users see errors.',
        'The LB probes every backend with a **health check**, say `GET /healthz` every 5 seconds. After 3 failures in a row it marks the server down and stops routing to it. When probes pass again, it slowly adds the server back.',
        'Now 5,000 QPS runs on three servers at 83% load. That is why you size a pool so it survives losing one member (**N+1**). With only two servers, losing one would double the load on the survivor.',
      ],
      keyIdea: 'Health checks turn a dead server into reduced capacity instead of user-facing errors. Size the pool so the survivors can carry the load.',
      metrics: { qps: '5,000/s', load: '83%', p99: '110 ms', errors: '0%', healthy: '3 / 4' },
      scene: {
        nodes: [
          users,
          { ...lb, status: 'active', badge: 'app 3 removed' },
          { ...app1, badge: '1,667/s' },
          { ...app2, badge: '1,667/s' },
          { ...app3, status: 'down', badge: '3 failed checks' },
          { ...app4, badge: '1,667/s' },
        ],
        links: [{ from: 'users', to: 'lb' }, ...poolLinks.map((l) => (l.to === 'app3' ? { ...l, style: 'dashed' as const } : l))],
        flows: [
          { path: ['lb', 'app3'], tone: 'handshake', label: 'GET /healthz', duration: 1 },
          { path: ['app3', 'lb'], tone: 'error', label: 'timeout', duration: 1, delay: 1.1 },
          { path: ['users', 'lb', 'app1'], tone: 'request', duration: 1.4, delay: 0.4 },
          { path: ['users', 'lb', 'app2'], tone: 'request', duration: 1.4, delay: 0.9 },
          { path: ['users', 'lb', 'app4'], tone: 'request', duration: 1.4, delay: 1.4 },
        ],
        caption: 'Failed probes pull the server out of rotation',
      },
      code: {
        language: 'python',
        title: 'A health check that means something',
        source: `@app.get("/healthz")
def healthz():
    # Liveness alone is not enough. Check what a real request needs.
    try:
        db.execute("SELECT 1", timeout=0.2)
    except Exception:
        return Response("db unreachable", status=503)
    if app.shutting_down:
        return Response("draining", status=503)   # graceful deploys
    return Response("ok", status=200)`,
        highlight: [5, 7, 8, 9],
      },
    },
    {
      title: 'L4 vs L7',
      tag: 'tradeoff',
      heading: 'L4 or L7: how much should the LB see?',
      eli5: 'An **L7** host reads what you want, then sends dinner orders to app 1 and app 2 and dessert orders to app 3 and app 4. A simpler, faster host would only look at which door you came through.',
      body: [
        'An **L4** balancer works on TCP or UDP. It sees IP and port, picks a backend per connection and shuffles packets. It is very fast, sometimes kernel level. Examples are AWS NLB, LVS and HAProxy in `mode tcp`.',
        'An **L7** balancer terminates HTTP. It reads headers, cookies, path and method, so it can send `/api/*` to one pool and `/images/*` to another, set sticky cookies and retry a failed request elsewhere. Examples are nginx, Envoy, AWS ALB and HAProxy in `mode http`.',
        'The common setup runs L7 at the edge for HTTPS and routing. L4 is kept for databases, internal gRPC planes and raw TCP protocols.',
      ],
      keyIdea: 'L4 is fast and blind to content. L7 costs more CPU per request and can route on anything in the request.',
      metrics: { qps: '5,000/s', load: '63%', p99: '80 ms', errors: '0%', healthy: '4 / 4' },
      scene: {
        nodes: [users, { ...lb, status: 'active', badge: 'L7 · reads path' }, { ...app1, sub: 'pool: api' }, { ...app2, sub: 'pool: api' }, { ...app3, sub: 'pool: images' }, { ...app4, sub: 'pool: images' }],
        links: [{ from: 'users', to: 'lb' }, ...poolLinks],
        flows: [
          { path: ['users', 'lb', 'app1'], tone: 'request', label: 'GET /api/cart', duration: 1.6 },
          { path: ['users', 'lb', 'app3'], tone: 'request', label: 'GET /images/42.jpg', duration: 1.6, delay: 0.9 },
          { path: ['users', 'lb', 'app2'], tone: 'request', label: 'POST /api/order', duration: 1.6, delay: 1.8 },
        ],
        caption: 'L7 routes by path. L4 would only see TCP :443',
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
      scene: {
        nodes: [users, { ...lb, status: 'down', badge: 'NIC failure' }, ...pool.map((s) => ({ ...s, status: 'dim' as const }))],
        links: [{ from: 'users', to: 'lb' }, ...poolLinks.map((l) => ({ ...l, style: 'faint' as const }))],
        flows: [
          { path: ['users', 'lb'], tone: 'request', count: 3, duration: 1.2 },
          { path: ['lb', 'users'], tone: 'error', label: 'connection refused', duration: 1.2, delay: 1.3 },
        ],
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
        'When heartbeats stop, the passive claims the virtual IP and starts serving within one to three seconds. Clients never change the address they connect to. Cloud LBs such as AWS ALB do the same thing behind the scenes across availability zones.',
        'Active-active is the other option: both LBs serve, and DNS or anycast spreads clients across them. You get double the capacity, but each must be able to carry everything alone.',
      ],
      keyIdea: 'Pair the load balancer and float the address between them, so a failure costs seconds instead of an outage.',
      metrics: { qps: '5,000/s', load: '63%', p99: '80 ms', errors: '0%', healthy: '4 / 4' },
      scene: {
        nodes: [users, { ...lb, status: 'down', sub: 'was active' }, { ...lb2, status: 'ok', sub: 'now owns VIP', badge: 'took over in 2 s' }, ...pool],
        links: [
          { from: 'users', to: 'lb2' },
          { from: 'lb', to: 'lb2', style: 'dashed', label: 'heartbeat' },
          ...pool.map((s) => ({ from: 'lb2', to: s.id })),
        ],
        flows: [
          { path: ['users', 'lb2'], tone: 'request', count: 3, duration: 1.2 },
          { path: ['lb2', 'app1'], tone: 'request', duration: 1, delay: 1.2 },
          { path: ['lb2', 'app2'], tone: 'request', duration: 1, delay: 1.4 },
          { path: ['lb2', 'app4'], tone: 'request', duration: 1, delay: 1.6 },
          { path: ['lb2', 'app3'], tone: 'request', duration: 1, delay: 1.8 },
        ],
        caption: 'The standby claims the virtual IP',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'What a load balancer gives you',
      eli5: 'A **load balancer** is a host who shares families among the waiters, skips any waiter who is not well, and has a backup host standing by. The restaurant stays open even when someone goes home.',
      body: [
        'A load balancer spreads requests across a pool, so capacity grows by adding servers. **Least connections** is a good default, round robin works for uniform requests, and hashing gives affinity at the cost of even load.',
        '**Health checks** turn a dead server into lost capacity instead of errors, as long as the pool is sized N+1. Pick **L7** when you need to route by content and **L4** when you need raw speed. Then make the LB itself redundant with an active-passive pair.',
      ],
      keyIdea: 'Scale out behind one address, route around failures, and never leave a single box on the path of every request.',
      metrics: { qps: '5,000/s', load: '63%', p99: '80 ms', errors: '0%', healthy: '4 / 4' },
      scene: {
        nodes: [users, { ...lb, status: 'ok', sub: 'active' }, lb2, ...pool],
        links: [{ from: 'users', to: 'lb' }, { from: 'lb', to: 'lb2', style: 'dashed', label: 'heartbeat' }, ...poolLinks],
        flows: [
          { path: ['users', 'lb', 'app1'], tone: 'request', duration: 1.4 },
          { path: ['users', 'lb', 'app4'], tone: 'request', duration: 1.4, delay: 0.5 },
          { path: ['app1', 'lb', 'users'], tone: 'response', duration: 1.4, delay: 1.5 },
          { path: ['app4', 'lb', 'users'], tone: 'response', duration: 1.4, delay: 2 },
        ],
      },
      quiz: {
        question: 'A pool of 3 servers each handles 2,000 QPS at most. Peak traffic is 5,000 QPS. One server fails. What happens?',
        options: [
          'Nothing, the LB spreads 5,000 QPS over the other two',
          'The two survivors need 2,500 QPS each, so they overload. The pool was not sized for N+1',
          'The health check fixes the failed server automatically',
          'Round robin keeps sending traffic to the failed server forever',
        ],
        answer: 1,
        explain: 'Health checks stop traffic to the dead server, but the survivors must carry the full load. 5,000 over 2 servers is 2,500 each, above capacity. You need a fourth server for N+1.',
      },
    },
  ],
};
