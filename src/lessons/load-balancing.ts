import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const users: SceneNode = { id: 'users', kind: 'block', at: at(-5.4, -4.4), label: 'users', sub: '5,000 req/s', icon: 'Users', tint: 'blue' };
const lb: SceneNode = { id: 'lb', kind: 'block', at: at(0, -4.4), label: 'load balancer', sub: 'VIP 203.0.113.5', icon: 'Split', tint: 'violet' };
const pool: SceneNode = { id: 'pool', kind: 'block', at: at(0, 3.4), label: 'app pool', sub: '4 servers', icon: 'Boxes', tint: 'green' };
const app1: SceneNode = { id: 'app1', kind: 'server', size: 0.85, at: at(-5.4, 3.4), label: 'app 1', sub: '10.0.0.11' };
const app2: SceneNode = { id: 'app2', kind: 'server', size: 0.85, at: at(-1.8, 3.4), label: 'app 2', sub: '10.0.0.12' };
const app3: SceneNode = { id: 'app3', kind: 'server', size: 0.85, at: at(1.8, 3.4), label: 'app 3', sub: '10.0.0.13' };
const app4: SceneNode = { id: 'app4', kind: 'server', size: 0.85, at: at(5.4, 3.4), label: 'app 4', sub: '10.0.0.14' };

const apps = [app1, app2, app3, app4];
const fan = (extra: Partial<SceneLink> = {}) => apps.map((s) => link('lb', s.id, extra));
const fanExcept = (id: string, style: SceneLink['style']) => apps.map((s) => link('lb', s.id, s.id === id ? { style } : {}));

export const loadBalancing: Lesson = {
  id: 'load-balancing',
  title: 'Load balancing (part 1)',
  tagline: 'Spread traffic across a pool of servers, pick a routing algorithm, and route around the dead ones.',
  minutes: 13,
  level: 'Beginner',
  learn: [
    'Why one server stops scaling and what a load balancer adds',
    'Round robin, weighted, least connections, power of two choices and hashing',
    'Sticky sessions and why shared session storage is safer',
    'Health checks, draining, rolling deploys and sizing a pool for N+1',
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
      title: 'One server',
      tag: 'problem',
      heading: 'One server, five thousand requests a second',
      eli5: 'The restaurant has one waiter and five thousand hungry families arrive at once. Being asked to do more than you can handle is called **overload**, and families start leaving hungry.',
      body: [
        'The shop launched a sale. Traffic went from 800 to **5,000 requests per second** and every request lands on one app server.',
        'A typical HTTP app server handles 1,000 to 10,000 QPS. Ours tops out near 2,000. Past that, requests queue for CPU and timeouts turn into errors.',
      ],
      keyIdea: 'One server is a ceiling on capacity and a single point of failure at the same time.',
      metrics: { qps: '5,000/s', load: '250%', p99: '2.4 s', errors: '18%', healthy: '1 / 1' },
      metricTones: { load: 'bad', p99: 'bad', errors: 'bad' },
      scene: {
        nodes: [users, { ...app1, at: at(0, -4.4), status: 'hot', load: 100, badge: '250% of capacity' }],
        links: [link('users', 'app1', { label: '5,000 req/s', labelTone: 'warn' })],
        flows: [
          { path: ['users', 'app1'], tone: 'request', count: 6, duration: 1.2 },
          { path: ['app1', 'users'], tone: 'error', label: '503', duration: 1.4, delay: 1.4 },
        ],
        panel: {
          title: 'App 1 under the sale',
          icon: 'Gauge',
          rows: [
            { text: 'Capacity', value: '2,000 req/s' },
            { text: 'Arriving', value: '5,000 req/s', tone: 'bad' },
            { text: 'p99 latency', value: '2.4 s', tone: 'bad' },
            { text: 'Errors', value: '18%', tone: 'bad' },
          ],
          footer: { text: 'The queue grows until requests time out', tone: 'bad' },
        },
        caption: 'Every request hits the same machine',
      },
    },
    {
      title: 'Bigger box?',
      tag: 'problem',
      heading: 'A bigger box only delays the problem',
      eli5: 'Hiring one very fast waiter helps for a while. But if that waiter goes home sick, the whole restaurant stops serving.',
      body: [
        'We can buy a machine twice as large. That buys time, and it costs more per request. There is always a biggest machine you can buy.',
        'Worse, if this one box reboots, the whole shop is offline. Scaling up leaves a single point of failure in place.',
      ],
      keyIdea: 'Scaling up has a hard limit and keeps one machine that everything depends on.',
      metrics: { qps: '5,000/s', load: '125%', p99: '900 ms', errors: '6%', healthy: '1 / 1' },
      metricTones: { load: 'bad', errors: 'warn' },
      scene: {
        nodes: [users, { ...app1, at: at(0, -4.4), size: 1.15, status: 'hot', load: 100, badge: '2x bigger, 4,000 req/s' }],
        links: [link('users', 'app1')],
        flows: [
          { path: ['users', 'app1'], tone: 'request', count: 5, duration: 1.2 },
          { path: ['app1', 'users'], tone: 'error', label: 'reboot: nothing answers', duration: 1.4, delay: 1.4 },
        ],
        panel: {
          title: 'Scale up or scale out',
          icon: 'TrendingUp',
          rows: [
            { text: 'Bigger server', value: 'ceiling, one box', tone: 'warn' },
            { text: 'More servers', value: 'add as needed', tone: 'good' },
            { text: 'If one dies', value: 'all down vs a slice', tone: 'warn' },
          ],
          footer: { text: 'We need a way to use many servers', tone: 'muted' },
        },
        caption: 'Even a big machine is still one machine',
      },
    },
    {
      title: 'Add a pool',
      tag: 'concept',
      heading: 'Put a load balancer in front of a pool',
      eli5: 'The **load balancer** is the host at the door. Families only talk to the host, who sends each one to one of four waiters, so no waiter is swamped.',
      body: [
        'We run four copies of the app and put a **load balancer** (LB) in front. It picks a backend for each request and forwards it.',
        'With 5,000 QPS over four servers, each sees about 1,250, or 63% of its 2,000 capacity. That leaves headroom for spikes.',
      ],
      keyIdea: 'A load balancer turns many servers into one address, so you scale by adding machines instead of buying bigger ones.',
      metrics: { qps: '5,000/s', load: '63%', p99: '80 ms', errors: '0%', healthy: '4 / 4' },
      metricTones: { load: 'good', p99: 'good', errors: 'good', healthy: 'good' },
      scene: {
        nodes: [{ ...lb, status: 'active', chips: ['5,000 req/s in'] }, ...apps.map((s) => ({ ...s, load: 63, chips: ['1,250 req/s'] }))],
        links: fan(),
        flows: [
          { path: ['lb', 'app3'], tone: 'request', duration: 1, delay: 0.2 },
          { path: ['lb', 'app1'], tone: 'request', duration: 1, delay: 0.4 },
          { path: ['lb', 'app2'], tone: 'request', duration: 1, delay: 0.6 },
          { path: ['lb', 'app4'], tone: 'request', duration: 1, delay: 0.8 },
        ],
        panel: {
          title: 'The math',
          icon: 'Gauge',
          rows: [
            { text: 'Arriving', value: '5,000 req/s' },
            { text: 'Servers', value: '4' },
            { text: 'Each handles', value: '1,250 req/s', tone: 'good' },
            { text: 'Capacity used', value: '63%', tone: 'good' },
          ],
        },
        caption: 'One front door, four backends',
      },
    },
    {
      title: 'One address',
      tag: 'concept',
      heading: 'Clients see one address, backends stay private',
      eli5: 'Families only know the restaurant\'s front door. The kitchen and its waiters are behind it, and no family needs to know how many waiters there are.',
      body: [
        'Clients only know one public address, the LB\'s virtual IP (**VIP**). The backends sit on private addresses such as `10.0.0.11` that the internet cannot reach.',
        'The pool is now elastic. Add a fifth server to the `upstream` list and it takes traffic. Remove one and the others absorb its share, with no client change.',
      ],
      keyIdea: 'One public VIP hides the pool, so you can grow, shrink and replace servers without clients noticing.',
      metrics: { qps: '5,000/s', load: '63%', p99: '80 ms', errors: '0%', healthy: '4 / 4' },
      metricTones: { load: 'good', errors: 'good' },
      scene: {
        nodes: [users, { ...lb, status: 'active' }, pool],
        links: [link('users', 'lb', { label: 'public: 203.0.113.5' }), link('lb', 'pool', { label: 'private: 10.0.0.0/24' })],
        flows: [
          { path: ['users', 'lb'], tone: 'request', count: 3, duration: 1 },
          { path: ['lb', 'pool'], tone: 'request', count: 3, duration: 1, delay: 1.1 },
        ],
        panel: {
          title: 'Who knows what',
          icon: 'Network',
          rows: [
            { text: 'Clients know', value: 'the VIP only', tone: 'good' },
            { text: 'LB knows', value: '4 backend IPs' },
            { text: 'Add server 5', value: 'edit one list', tone: 'good' },
          ],
        },
        caption: 'The pool grows and shrinks behind the VIP',
      },
      code: {
        language: 'bash',
        title: 'nginx.conf: an upstream pool',
        source: `upstream shop_app {
    least_conn;                       # pick the least busy backend
    server 10.0.0.11:8080;
    server 10.0.0.12:8080;
    server 10.0.0.13:8080;
    server 10.0.0.14:8080;
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
        'The simplest algorithm is **round robin**. Request 1 goes to app 1, request 2 to app 2, and so on, then back to the start.',
        'It assumes every request costs about the same. For a page that renders in 20 ms, that holds well enough and the load comes out even.',
      ],
      keyIdea: 'Round robin is fair by count. It is only fair by load when requests cost about the same.',
      metrics: { qps: '5,000/s', load: '63%', p99: '80 ms', errors: '0%', healthy: '4 / 4' },
      metricTones: { load: 'good', p99: 'good' },
      scene: {
        nodes: [{ ...lb, badge: 'next: app 1', chips: ['round robin'] }, ...apps],
        links: fan(),
        flows: [
          { path: ['lb', 'app1'], tone: 'request', label: '#1', duration: 1.2 },
          { path: ['lb', 'app2'], tone: 'request', label: '#2', duration: 1.2, delay: 0.6 },
          { path: ['lb', 'app3'], tone: 'request', label: '#3', duration: 1.2, delay: 1.2 },
          { path: ['lb', 'app4'], tone: 'request', label: '#4', duration: 1.2, delay: 1.8 },
        ],
        panel: {
          title: 'The turn order',
          icon: 'Repeat',
          code: 'req 1 -> app 1\nreq 2 -> app 2\nreq 3 -> app 3\nreq 4 -> app 4\nreq 5 -> app 1',
          footer: { text: 'No state needed, very cheap', tone: 'muted' },
        },
        caption: '1, 2, 3, 4, repeat',
      },
    },
    {
      title: 'Weighted',
      tag: 'concept',
      heading: 'Weighted round robin: bigger boxes get bigger shares',
      eli5: 'One waiter is twice as fast as the others. The host gives that waiter two families for every one that the other waiters get. This is **weighted** turn taking.',
      body: [
        'Pools are not always identical during a migration. Say app 4 is a box twice as big as the rest, with 4,000 QPS capacity against 2,000.',
        '**Weighted** round robin gives each backend a weight. With weights 1, 1, 1 and 2, the shares are 1,000, 1,000, 1,000 and 2,000 req/s. Every server sits at 50%.',
      ],
      keyIdea: 'Weights let a mixed fleet carry traffic in proportion to its capacity.',
      metrics: { qps: '5,000/s', load: '50%', p99: '70 ms', errors: '0%', healthy: '4 / 4' },
      metricTones: { load: 'good' },
      scene: {
        nodes: [
          { ...lb, chips: ['weights 1 : 1 : 1 : 2'] },
          { ...app1, load: 50, chips: ['1,000/s'] },
          { ...app2, load: 50, chips: ['1,000/s'] },
          { ...app3, load: 50, chips: ['1,000/s'] },
          { ...app4, size: 1.1, sub: '2x box', load: 50, chips: ['2,000/s'] },
        ],
        links: fan(),
        flows: [
          { path: ['lb', 'app1'], tone: 'request', duration: 1.1 },
          { path: ['lb', 'app4'], tone: 'request', count: 2, duration: 1.1, delay: 0.5 },
          { path: ['lb', 'app2'], tone: 'request', duration: 1.1, delay: 1 },
          { path: ['lb', 'app3'], tone: 'request', duration: 1.1, delay: 1.5 },
        ],
        panel: {
          title: 'Share by weight',
          icon: 'Scale',
          rows: [
            { text: 'app 1, 2, 3 (weight 1)', value: '1,000 req/s each' },
            { text: 'app 4 (weight 2)', value: '2,000 req/s' },
            { text: 'Load on each', value: '50%', tone: 'good' },
          ],
        },
        caption: 'The 2x box takes a double share',
      },
    },
    {
      title: 'Least connections',
      tag: 'case',
      heading: 'Case: one slow request type breaks round robin',
      eli5: 'Waiter app 3 is stuck with slow tables that take forever. With **least connections**, the host looks at who is serving the fewest tables right now and sends the next family there.',
      body: [
        'Admins start exporting order reports. Each export holds a connection for 30 seconds. Round robin keeps handing app 3 its turn, and app 3 piles up 40 open connections while the others sit at 8.',
        '**Least connections** fixes this. The LB tracks open connections per backend and sends each new request to the least busy one.',
      ],
      keyIdea: 'When request cost varies, balance by current load, measured as open connections.',
      metrics: { qps: '5,000/s', load: '63%', p99: '95 ms', errors: '0%', healthy: '4 / 4' },
      metricTones: { p99: 'warn' },
      scene: {
        nodes: [
          { ...lb, status: 'active', badge: 'least_conn' },
          { ...app1, chips: ['8 conns'] },
          { ...app2, chips: ['9 conns'] },
          { ...app3, status: 'hot', load: 92, chips: [{ text: '40 conns', tone: 'bad' }, { text: 'exports', tone: 'warn' }] },
          { ...app4, chips: ['7 conns'] },
        ],
        links: fanExcept('app3', 'faint'),
        flows: [
          { path: ['lb', 'app4'], tone: 'request', duration: 1, delay: 0.2 },
          { path: ['lb', 'app1'], tone: 'request', duration: 1, delay: 0.6 },
          { path: ['lb', 'app2'], tone: 'request', duration: 1, delay: 1 },
        ],
        panel: {
          title: 'Open connections now',
          icon: 'Cable',
          rows: [
            { text: 'app 1', value: '8' },
            { text: 'app 2', value: '9' },
            { text: 'app 3', value: '40', tone: 'bad' },
            { text: 'app 4', value: '7', tone: 'good' },
          ],
          footer: { text: 'Next request goes to app 4', tone: 'good' },
        },
        caption: 'New requests skip the busy server',
      },
    },
    {
      title: 'Two choices',
      tag: 'concept',
      heading: 'Power of two choices: random, with one cheap check',
      eli5: 'With hundreds of waiters, the host cannot count every table. So the host peeks at two waiters picked at random and sends the family to whichever has fewer tables.',
      body: [
        'At large scale, tracking every backend\'s load is costly, and many LBs would need to share that view. **Power of two choices** skips it.',
        'Pick two backends at random and send to the less loaded. It needs no global view and comes close to least connections. Random only is much worse.',
      ],
      keyIdea: 'Comparing just two random backends gives most of the benefit of least connections for almost no cost.',
      metrics: { qps: '5,000/s', load: '63%', p99: '85 ms', errors: '0%', healthy: '4 / 4' },
      metricTones: { load: 'good' },
      scene: {
        nodes: [
          { ...lb, chips: ['pick 2 at random'] },
          app1,
          { ...app2, status: 'active', chips: [{ text: '12 conns', tone: 'warn' }] },
          app3,
          { ...app4, status: 'ok', chips: [{ text: '7 conns', tone: 'good' }] },
        ],
        links: [link('lb', 'app2', { style: 'dashed', label: 'candidate' }), link('lb', 'app4', { label: 'winner' }), link('lb', 'app1', { style: 'faint' }), link('lb', 'app3', { style: 'faint' })],
        flows: [
          { path: ['lb', 'app2'], tone: 'handshake', label: 'load?', duration: 0.9 },
          { path: ['lb', 'app4'], tone: 'handshake', label: 'load?', duration: 0.9, delay: 0.2 },
          { path: ['lb', 'app4'], tone: 'request', duration: 1, delay: 1.3 },
        ],
        panel: {
          title: 'Per request',
          icon: 'Repeat',
          rows: [
            { text: 'Random picks', value: 'app 2, app 4' },
            { text: 'Loads', value: '12 vs 7' },
            { text: 'Request goes to', value: 'app 4', tone: 'good' },
          ],
        },
        caption: 'Two random candidates, the lighter one wins',
      },
      quiz: {
        question: 'Your LB must pick the least busy of 2,000 backends for every request. Which approach costs the least while still avoiding hot servers?',
        options: [
          'Scan all 2,000 backends for the lowest connection count on every request',
          'Pick two backends at random and send to the less loaded one',
          'Send everything to the first backend until it fails',
          'Pick one backend at random and never compare',
        ],
        answer: 1,
        explain: 'Power of two choices does one cheap comparison and gets close to the best result. Scanning everything is costly, and a single random pick leaves some servers much busier than others.',
      },
    },
    {
      title: 'Hashing',
      tag: 'concept',
      heading: 'Hash routing: the same key, the same server',
      eli5: 'The host uses your family name to pick a waiter, so you always get app 2, who remembers your favorite meal. That is **hash-based routing**. It is quick, but some waiters end up busier than others.',
      body: [
        'Sometimes you want the same client on the same backend. Each app server keeps a local cache of user carts, so sending user 42 to app 2 every time means warm cache hits.',
        '**Hash-based routing** does this: `hash(user_id) mod N` picks the server. The cost is uneven load, since a few heavy users can pin one server hot. An L4 LB only sees IPs and ports, so it hashes the source IP, which NAT skews. Hashing a cookie or user id needs L7 (part 2).',
      ],
      keyIdea: 'Hashing buys cache hits at the price of even load.',
      metrics: { qps: '5,000/s', load: '55 to 80%', p99: '70 ms', errors: '0%', healthy: '4 / 4' },
      metricTones: { load: 'warn', p99: 'good' },
      scene: {
        nodes: [
          { ...lb, chips: ['hash(user_id) mod 4'] },
          { ...app1, load: 55 },
          { ...app2, status: 'active', load: 80, chips: [{ text: 'user 42', tone: 'good' }, 'warm cache'] },
          { ...app3, load: 55 },
          { ...app4, load: 60, chips: ['user 7'] },
        ],
        links: fan(),
        flows: [
          { path: ['lb', 'app2'], tone: 'request', label: 'user 42', duration: 1.2 },
          { path: ['lb', 'app4'], tone: 'request', label: 'user 7', duration: 1.2, delay: 0.6 },
          { path: ['lb', 'app2'], tone: 'request', label: 'user 42', duration: 1.2, delay: 1.4 },
        ],
        panel: {
          title: 'hash(user_id) mod 4',
          icon: 'Hash',
          rows: [
            { text: 'user 42', value: 'app 2' },
            { text: 'user 7', value: 'app 4' },
            { text: 'user 42 again', value: 'app 2, cache hit', tone: 'good' },
            { text: 'Hash key', value: 'L4: source IP, skewed by NAT' },
            { text: 'Hash key', value: 'L7: cookie, header, user id' },
          ],
          footer: { text: 'Heavy users can overload one server', tone: 'warn' },
        },
        caption: 'The same key always lands on the same server',
      },
    },
    {
      title: 'Consistent hashing',
      tag: 'tradeoff',
      heading: 'Plain modulo reshuffles. Consistent hashing does not.',
      eli5: 'If the host assigns waiters by family name and a fifth waiter joins, almost every family gets a new waiter. A smarter seating chart only moves about one family in five.',
      body: [
        'Plain `mod N` reshuffles almost every user when N changes. Add a fifth server and most local caches go cold at once.',
        '**Consistent hashing** places servers and keys on a ring, so adding or removing a server moves only about 1/N of the keys. Each server gets many **virtual nodes** on the ring to even out the slices.',
      ],
      keyIdea: 'Use consistent hashing when affinity matters and the pool changes. Modulo hashing breaks on every resize.',
      metrics: { qps: '5,000/s', load: '55 to 80%', p99: '70 ms', errors: '0%', healthy: '5 / 5' },
      metricTones: { p99: 'good' },
      scene: {
        nodes: [
          { ...lb, chips: ['consistent hash'] },
          { ...app2, at: at(-5.4, 3.4), chips: ['keeps its keys'] },
          { ...app3, at: at(-1.8, 3.4), chips: ['keeps its keys'] },
          { ...app4, at: at(1.8, 3.4), chips: ['keeps its keys'] },
          { id: 'app5', kind: 'server', size: 0.85, at: at(5.4, 3.4), label: 'app 5', sub: 'new server', status: 'ok', badge: 'takes 20% of keys' },
        ],
        links: ['app2', 'app3', 'app4', 'app5'].map((id) => link('lb', id)),
        flows: [
          { path: ['lb', 'app5'], tone: 'data', label: '1/5 of keys move', count: 2, duration: 1.4 },
          { path: ['lb', 'app2'], tone: 'request', label: 'user 42 stays', duration: 1.4, delay: 1 },
        ],
        panel: {
          title: 'Add a 5th server',
          icon: 'Hash',
          rows: [
            { text: 'mod N: keys that move', value: 'about 80%', tone: 'bad' },
            { text: 'Consistent: keys that move', value: 'about 20%', tone: 'good' },
            { text: 'Virtual nodes', value: 'many ring points per server, even slices' },
          ],
          footer: { text: 'Fewer cold caches after a resize', tone: 'good' },
        },
        caption: 'Only the new server\'s slice moves',
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
      title: 'Sticky sessions',
      tag: 'tradeoff',
      heading: 'Sticky sessions pin a user to one box',
      eli5: 'The host tells you "your waiter is app 2" and writes it on your hand. That works until app 2 goes home sick, and then nobody remembers what you had ordered.',
      body: [
        '**Sticky sessions** keep a user on one backend, usually through a cookie such as `SERVERID=app2` that the LB sets and reads. Login state can then live in that server\'s memory.',
        'When app 2 dies, those sessions vanish and users get logged out. Keep session data in a shared store, and use affinity only for cache warmth. Never let correctness depend on it.',
      ],
      keyIdea: 'Never make correctness depend on affinity. Store sessions in a shared place so any server can answer.',
      metrics: { qps: '5,000/s', load: '70%', p99: '90 ms', errors: '2%', healthy: '3 / 4' },
      metricTones: { errors: 'warn' },
      scene: {
        nodes: [
          { ...lb, chips: ['cookie SERVERID'] },
          { ...app2, status: 'down', chips: [{ text: 'sessions lost', tone: 'bad' }] },
          { ...app3, status: 'active', chips: [{ text: 'sessions read from store', tone: 'good' }] },
          { id: 'store', kind: 'cache', at: at(0, 9.4), label: 'session store', sub: 'shared Redis', status: 'ok' },
        ],
        links: [link('lb', 'app2', { style: 'dashed' }), link('lb', 'app3'), link('app3', 'store', { label: 'any server can read', arrow: 'both' })],
        flows: [
          { path: ['lb', 'app2'], tone: 'error', label: 'cookie: app2', duration: 1.2 },
          { path: ['lb', 'app3'], tone: 'request', label: 're-routed', duration: 1.2, delay: 1.3 },
          { path: ['app3', 'store', 'app3'], tone: 'data', label: 'load session', duration: 1.4, delay: 2.3 },
        ],
        panel: {
          title: 'Where does login live?',
          icon: 'KeyRound',
          rows: [
            { text: 'In app 2 memory', value: 'lost on crash', tone: 'bad' },
            { text: 'In shared store', value: 'survives, any server', tone: 'good' },
          ],
        },
        caption: 'Shared sessions make stickiness optional',
      },
    },
    {
      title: 'Health checks',
      tag: 'case',
      heading: 'Case: app 3 dies at 2 a.m.',
      eli5: 'Every few seconds the host asks each waiter if they are okay. That question is a **health check**. App 3 does not answer three times in a row, so the host stops sending families there.',
      body: [
        'App 3 runs out of memory and stops answering. Without health awareness, the LB keeps sending it one request in four, and a quarter of users see errors.',
        'The LB runs an **active health check**: `GET /healthz` every 5 seconds. After 3 failures in a row it marks the server down and stops routing to it.',
      ],
      keyIdea: 'Health checks turn a dead server into reduced capacity instead of user-facing errors.',
      metrics: { qps: '5,000/s', load: '83%', p99: '110 ms', errors: '0%', healthy: '3 / 4' },
      metricTones: { load: 'warn', errors: 'good', healthy: 'warn' },
      scene: {
        nodes: [
          { ...lb, status: 'active', badge: 'app 3 removed' },
          { ...app1, load: 83 },
          { ...app2, load: 83 },
          { ...app3, status: 'down', chips: [{ text: '3 failed checks', tone: 'bad' }] },
          { ...app4, load: 83 },
        ],
        links: fanExcept('app3', 'dashed'),
        flows: [
          { path: ['lb', 'app3'], tone: 'handshake', label: 'GET /healthz', duration: 1 },
          { path: ['app3', 'lb'], tone: 'error', label: 'timeout', duration: 1, delay: 1.1 },
          { path: ['lb', 'app1'], tone: 'request', duration: 1, delay: 1.6 },
          { path: ['lb', 'app2'], tone: 'request', duration: 1, delay: 1.9 },
          { path: ['lb', 'app4'], tone: 'request', duration: 1, delay: 2.2 },
        ],
        panel: {
          title: 'Probe settings',
          icon: 'Activity',
          rows: [
            { text: 'Probe', value: 'GET /healthz' },
            { text: 'Interval', value: '5 s' },
            { text: 'Failures to mark down', value: '3', tone: 'warn' },
            { text: 'Time to detect', value: 'about 15 s' },
          ],
          footer: { text: 'Shorter intervals detect faster but add load', tone: 'muted' },
        },
        caption: 'Failed probes pull the server out of rotation',
      },
    },
    {
      title: 'Passive checks',
      tag: 'concept',
      heading: 'Passive checks watch real traffic',
      eli5: 'Besides asking each waiter "are you okay?", the host also notices when a waiter keeps dropping plates. After a few spills the host stops sending families that way.',
      body: [
        'Active probes can miss a server that answers `/healthz` but fails real requests. **Passive checks** watch live traffic instead.',
        'In nginx, `max_fails=3 fail_timeout=10s` takes a server out for 10 seconds after 3 failures. There is no probe interval, but 3 real requests fail first. Open source nginx has no active probes. They need nginx Plus, HAProxy or Envoy.',
      ],
      keyIdea: 'Active checks find a dead server before users do. Passive checks catch a server that looks alive but fails real work. Use both.',
      metrics: { qps: '5,000/s', load: '83%', p99: '120 ms', errors: '0.1%', healthy: '3 / 4' },
      metricTones: { errors: 'warn', load: 'warn' },
      scene: {
        nodes: [
          { ...lb, status: 'active' },
          { ...app1 },
          { ...app3, at: at(3.6, 4.4), status: 'hot', load: 95, chips: [{ text: '500', tone: 'bad' }, { text: '500', tone: 'bad' }] },
        ],
        links: [link('lb', 'app1'), link('lb', 'app3', { style: 'dashed', label: 'ejected 10 s', labelTone: 'warn' })],
        flows: [
          { path: ['lb', 'app3', 'lb'], tone: 'error', label: '500', duration: 1.4 },
          { path: ['lb', 'app1'], tone: 'request', label: 'retried here', duration: 1.2, delay: 1.5 },
        ],
        panel: {
          title: 'Active vs passive',
          icon: 'Activity',
          rows: [
            { text: 'Active', value: 'probes on a timer' },
            { text: 'Passive', value: 'counts real failures' },
            { text: 'Passive downside', value: 'users hit the errors', tone: 'warn' },
            { text: 'Count 500s too', value: 'proxy_next_upstream error timeout http_500' },
          ],
        },
        caption: 'Three real failures eject the server',
      },
    },
    {
      title: 'Recovery',
      tag: 'concept',
      heading: 'Bring a server back slowly',
      eli5: 'When app 3 feels better, the host does not send it ten families at once. The host starts with one, then two, then more, until the waiter is back up to full speed.',
      body: [
        'When probes pass again, the LB should not flood the server. A restarted app has cold caches and cold connection pools, and a full share would knock it over again.',
        '**Slow start** ramps its share from near zero to full over, say, 30 seconds. Many LBs also require several passing probes in a row before trusting a server again.',
      ],
      keyIdea: 'Recovering servers need a ramp. A full share on a cold server can take it down a second time.',
      metrics: { qps: '5,000/s', load: '70%', p99: '100 ms', errors: '0%', healthy: '4 / 4' },
      metricTones: { healthy: 'good', errors: 'good' },
      scene: {
        nodes: [
          { ...lb, status: 'active', chips: ['slow_start 30s'] },
          { ...app1, load: 60, chips: ['1,500/s'] },
          { ...app3, status: 'ok', load: 20, sub: 'recovering', chips: [{ text: '300/s, ramping', tone: 'good' }] },
        ],
        links: [link('lb', 'app1'), link('lb', 'app3', { label: 'ramp up' })],
        flows: [
          { path: ['lb', 'app1'], tone: 'request', count: 3, duration: 1.1 },
          { path: ['lb', 'app3'], tone: 'request', duration: 1.1, delay: 0.8 },
        ],
        panel: {
          title: 'Share for app 3',
          icon: 'TrendingUp',
          rows: [
            { text: '0 s', value: '5%' },
            { text: '10 s', value: '35%' },
            { text: '20 s', value: '70%' },
            { text: '30 s', value: '100%', tone: 'good' },
          ],
        },
        caption: 'Traffic grows as the server warms up',
      },
    },
    {
      title: 'N+1 sizing',
      tag: 'tradeoff',
      heading: 'Size the pool to survive losing one',
      eli5: 'If one waiter goes home sick, the others must carry the extra tables. Hire enough waiters that three can still serve the whole room.',
      body: [
        'Now 5,000 QPS runs on three servers at 83%. That is why you size a pool so it survives losing one member (**N+1**).',
        'With three servers, losing one leaves two at 2,500 req/s each (125%), so they overload. Four servers leave 83% after one failure. That is tight, so teams usually keep more headroom.',
      ],
      keyIdea: 'Capacity is what remains after the worst expected failure, so add one server beyond the load you need.',
      metrics: { qps: '5,000/s', load: '83%', p99: '110 ms', errors: '0%', healthy: '3 / 4' },
      metricTones: { load: 'warn' },
      scene: {
        nodes: [
          { ...lb, chips: ['5,000 req/s'] },
          { ...app1, load: 83, chips: ['1,667/s'] },
          { ...app2, load: 83, chips: ['1,667/s'] },
          { ...app3, status: 'down', chips: ['0/s'] },
          { ...app4, load: 83, chips: ['1,667/s'] },
        ],
        links: fanExcept('app3', 'faint'),
        flows: [
          { path: ['lb', 'app1'], tone: 'request', duration: 1.1 },
          { path: ['lb', 'app2'], tone: 'request', duration: 1.1, delay: 0.4 },
          { path: ['lb', 'app4'], tone: 'request', duration: 1.1, delay: 0.8 },
        ],
        panel: {
          title: 'Pool sizing at 5,000 req/s',
          icon: 'Scale',
          rows: [
            { text: '4 servers, all up', value: '63% each', tone: 'good' },
            { text: '4 servers, 1 down', value: '83% each', tone: 'warn' },
            { text: '3 servers, 1 down', value: '125% each', tone: 'bad' },
          ],
          footer: { text: 'Plan for the failure, not only the average', tone: 'muted' },
        },
        caption: 'The survivors carry the full load',
      },
    },
    {
      title: 'Deep checks',
      tag: 'concept',
      heading: 'A health check that means something',
      eli5: 'Asking a waiter "are you standing up?" tells you little. A better question is "can you reach the kitchen?" But if the kitchen is closed, every waiter fails together.',
      body: [
        'Split the checks. `/livez` proves the process is alive. `/readyz` is a **deep check** that touches what a request needs, such as the database, with a short timeout.',
        'The catch: if the shared database is slow, every server fails `/readyz` at once and the LB would remove the whole pool. A panic threshold makes the LB route to all backends anyway.',
      ],
      keyIdea: 'Check what a real request needs, but do not let one shared dependency take the whole pool out.',
      metrics: { qps: '5,000/s', load: '63%', p99: '80 ms', errors: '0%', healthy: '4 / 4' },
      metricTones: { healthy: 'good' },
      scene: {
        nodes: [
          { ...lb, status: 'active' },
          { ...app1, status: 'ok', chips: [{ text: '200 ok', tone: 'good' }] },
          { id: 'db', kind: 'db', at: at(0, 9.4), label: 'database', sub: 'shared', status: 'active' },
        ],
        links: [link('lb', 'app1', { label: 'GET /readyz' }), link('app1', 'db', { label: 'SELECT 1, 200 ms limit' })],
        flows: [
          { path: ['lb', 'app1'], tone: 'handshake', label: 'GET /readyz', duration: 1 },
          { path: ['app1', 'db', 'app1'], tone: 'request', label: 'SELECT 1', duration: 1.4, delay: 1.1 },
          { path: ['app1', 'lb'], tone: 'response', label: '200 ok', duration: 1, delay: 2.6 },
        ],
        panel: {
          title: 'Shallow vs deep',
          icon: 'Search',
          rows: [
            { text: 'Shallow', value: 'process is up' },
            { text: 'Deep', value: 'can reach the database', tone: 'good' },
            { text: 'Deep risk', value: 'db slow, pool removed', tone: 'warn' },
            { text: 'If all fail', value: 'LB routes to all anyway (panic threshold)', tone: 'good' },
          ],
        },
        caption: 'The probe touches what real requests touch',
      },
      code: {
        language: 'python',
        title: 'A health check that means something',
        source: `@app.get("/livez")
def livez():
    return Response("ok", status=200)   # process only, no dependencies

@app.get("/readyz")
def readyz():
    if app.shutting_down:
        return Response("draining", status=503)   # drain signal
    try:
        db.execute("SELECT 1", timeout=0.2)   # short timeout
    except Exception:
        return Response("db unreachable", status=503)
    return Response("ok", status=200)`,
        highlight: [5, 7, 8, 10],
      },
    },
    {
      title: 'Draining',
      tag: 'concept',
      heading: 'Drain a server before a deploy',
      eli5: 'Before a waiter goes on break, the host stops seating new families at that table. The waiter finishes serving the families already there, and then leaves.',
      body: [
        'A deploy restarts a server. If the LB keeps sending it traffic, in-flight requests are cut off. **Connection draining** stops new requests and lets current ones finish, up to a limit such as 30 seconds.',
        'The app starts returning 503 from `/readyz`, as in the code above. The LB sees it, stops routing and waits. A rolling deploy repeats this one server at a time, and N+1 sizing covers the gap.',
      ],
      keyIdea: 'Drain, deploy, then add back, one server at a time. Users never see the restart.',
      metrics: { qps: '5,000/s', load: '83%', p99: '110 ms', errors: '0%', healthy: '3 / 4' },
      metricTones: { errors: 'good' },
      scene: {
        nodes: [
          { ...lb, status: 'active' },
          { ...app1, load: 83, chips: ['1,667/s'] },
          { ...app2, status: 'dim', sub: 'draining', chips: [{ text: '3 requests finishing', tone: 'warn' }, { text: 'no new requests', tone: 'warn' }] },
          { ...app3, load: 83, chips: ['1,667/s'] },
        ],
        links: [link('lb', 'app1'), link('lb', 'app2', { style: 'dashed', label: 'draining 30 s', labelTone: 'warn' }), link('lb', 'app3')],
        flows: [
          { path: ['app2', 'lb'], tone: 'response', label: '503 /readyz', duration: 1.1 },
          { path: ['lb', 'app1'], tone: 'request', duration: 1, delay: 1.3 },
          { path: ['lb', 'app3'], tone: 'request', duration: 1, delay: 1.6 },
        ],
        panel: {
          title: 'Rolling deploy of one server',
          icon: 'Workflow',
          rows: [
            { text: '1. Fail /healthz', value: 'LB stops new traffic' },
            { text: '2. Finish in-flight', value: 'up to 30 s' },
            { text: '3. Deploy and restart', value: '' },
            { text: '4. Pass checks', value: 'slow start back', tone: 'good' },
          ],
        },
        caption: 'No new requests, no cut-off ones',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Part 1: pool, algorithms and health',
      eli5: 'A **load balancer** is a host who shares families among the waiters and skips any waiter who is not well. Next time we look at how much the host reads, and what happens when the host goes home.',
      body: [
        'A load balancer spreads requests across a pool behind one address, so capacity grows by adding servers. **Least connections** is a good default, round robin works for uniform requests, and hashing gives affinity at the cost of even load.',
        '**Health checks** turn a dead server into lost capacity if the pool is sized N+1. Drain servers before deploys and bring them back slowly.',
      ],
      keyIdea: 'Scale out behind one address, route around failures, and size the pool for losing a server.',
      metrics: { qps: '5,000/s', load: '63%', p99: '80 ms', errors: '0%', healthy: '4 / 4' },
      metricTones: { load: 'good', p99: 'good', errors: 'good', healthy: 'good' },
      scene: {
        nodes: [users, { ...lb, status: 'ok' }, pool],
        links: [link('users', 'lb'), link('lb', 'pool')],
        flows: [
          { path: ['users', 'lb', 'pool'], tone: 'request', duration: 1.6 },
          { path: ['pool', 'lb', 'users'], tone: 'response', duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'Part 1 checklist',
          icon: 'List',
          rows: [
            { text: 'Algorithm', value: 'least conn by default' },
            { text: 'Affinity', value: 'consistent hash, shared sessions' },
            { text: 'Health checks', value: 'active and passive', tone: 'good' },
            { text: 'Pool size', value: 'N+1', tone: 'good' },
          ],
          footer: { text: 'Part 2: L4 vs L7, TLS, failover of the LB', tone: 'muted' },
        },
        caption: 'One address, many servers, route around failures',
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
