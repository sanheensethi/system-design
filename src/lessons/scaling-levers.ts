import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const users: SceneNode = { id: 'users', kind: 'user', at: at(-5, 0), label: 'shoppers' };
const lb: SceneNode = { id: 'lb', kind: 'lb', at: at(-6, 0), label: 'load balancer' };
const app: SceneNode = { id: 'app', kind: 'server', at: at(2.5, 0), label: 'app server', sub: '32 cores · 128 GB' };
const app2: SceneNode = { id: 'app2', kind: 'server', at: at(-1.5, -4), label: 'app 2', sub: '32 cores' };
const app3: SceneNode = { id: 'app3', kind: 'server', at: at(-1.5, 4), label: 'app 3', sub: '32 cores' };
const db: SceneNode = { id: 'db', kind: 'db', at: at(7, 0), label: 'database', sub: 'Postgres primary' };
const redis: SceneNode = { id: 'redis', kind: 'cache', at: at(4.2, 4.2), label: 'Redis', sub: 'sessions' };
const replica: SceneNode = { id: 'replica', kind: 'replica', at: at(5.5, 3.4), label: 'read replica' };
const shardB: SceneNode = { id: 'shardB', kind: 'db', at: at(5.5, 3.4), label: 'shard B', sub: 'users M to Z' };
const queue: SceneNode = { id: 'queue', kind: 'queue', at: at(5.5, 0), label: 'job queue' };
const worker: SceneNode = { id: 'worker', kind: 'worker', at: at(9, 0), label: 'workers', sub: 'email, images' };

const appC: SceneNode = { ...app, at: at(0, 0) };
const dbC: SceneNode = { ...db, at: at(5, 0) };
const bigApp: SceneNode = { ...appC, size: 1.4, label: 'big server', sub: '128 cores · 1 TB' };

const fleet = (badge = '+2 more'): SceneNode[] => [{ ...app, label: 'app 1', sub: '32 cores', badge }, app2, app3];
const fleetLinks = (): SceneLink[] => ['app', 'app2', 'app3'].map((id) => link('lb', id));

const metrics = [
  { key: 'traffic', label: 'Traffic', icon: 'Activity' },
  { key: 'cpu', label: 'App CPU', icon: 'Cpu' },
  { key: 'p99', label: 'p99 latency', icon: 'Timer' },
  { key: 'servers', label: 'App servers', icon: 'Server' },
  { key: 'db', label: 'DB load', icon: 'Database' },
];

export const scalingLevers: Lesson = {
  id: 'scaling-levers',
  title: 'Scaling up, scaling out, and the five levers',
  tagline: 'Watch one server get hot, grow, hit the ceiling, and then multiply.',
  minutes: 15,
  level: 'Beginner',
  learn: [
    'The five hard limits of a single machine, including failure',
    'Vertical scaling: when a bigger box is the right answer, and when it runs out',
    'Why app servers must be stateless before you add more',
    'Horizontal scaling behind a load balancer, with headroom for failure',
    'Fix the database cheaply first: query tuning, then a bigger primary',
    'The five levers: cache, replicate, partition, asynchronize, localize, and what each one costs',
    'Multi data center setup: geo-DNS routing, regional data and data center failover',
  ],
  metrics,
  steps: [
    {
      title: 'One hot box',
      tag: 'problem',
      heading: 'The shop outgrew its server',
      eli5: 'The toy shop has one clerk, the **app server**, and a long line of shoppers. The clerk works as fast as possible, and the line still keeps growing.',
      body: [
        'The shop runs on one app server with 32 cores and 128 GB of RAM, talking to one Postgres database. A year ago it served 1K requests per second without breaking a sweat.',
        'Today it gets **6K QPS**. CPU sits at 95%, requests queue up, and the slowest 1% of requests (the **p99**) take 2.1 seconds. Customers abandon carts.',
      ],
      keyIdea: 'Every growing system hits a point where one machine is not enough. The question is what to do next, and in what order.',
      metrics: { traffic: '6K QPS', cpu: '95%', p99: '2.1 s', servers: '1', db: '2.4K reads/s' },
      metricTones: { cpu: 'bad', p99: 'bad' },
      scene: {
        nodes: [
          { ...users, chips: [{ text: '6K req/s', tone: 'warn' }] },
          { ...appC, status: 'hot', load: 95, chips: [{ text: 'queue growing', tone: 'bad' }] },
          { ...dbC, sub: '2.4K reads/s' },
        ],
        links: [link('users', 'app'), link('app', 'db')],
        flows: [
          { path: ['users', 'app'], tone: 'request', count: 8, duration: 1.4 },
          { path: ['app', 'users'], tone: 'response', count: 2, duration: 2.6, delay: 1.5 },
        ],
        panel: {
          title: 'One year of growth',
          icon: 'TrendingUp',
          rows: [
            { text: 'A year ago', value: '1K QPS', tone: 'good' },
            { text: 'Today', value: '6K QPS', tone: 'warn' },
            { text: 'App CPU', value: '95%', tone: 'bad' },
            { text: 'p99 latency', value: '2.1 s', tone: 'bad' },
          ],
          footer: { text: 'Customers abandon carts', tone: 'bad' },
        },
        caption: 'Requests pile up faster than one box can answer',
      },
    },
    {
      title: 'Four limits',
      tag: 'concept',
      heading: 'Four limits of raw capacity',
      eli5: 'One clerk can run out of four things: thinking speed, counter space, storage room, or door width. Whichever runs out first is the **bottleneck**.',
      body: [
        'A machine has ceilings you can measure. **CPU**: 64 to 128 cores per socket. **RAM**: 1 to 4 TB on large servers. **Disk**: about 30 TB per NVMe drive. **Network**: 10 to 100 Gbps per card.',
        'Our shop is hitting the first one. The fix depends on which limit you hit, so find the bottleneck before you buy hardware.',
      ],
      keyIdea: 'Name the limit you are hitting before you pick a fix: CPU, RAM, disk or network.',
      metrics: { traffic: '6K QPS', cpu: '95%', p99: '2.1 s', servers: '1', db: '2.4K reads/s' },
      metricTones: { cpu: 'bad', p99: 'bad' },
      scene: {
        nodes: [
          { ...appC, status: 'hot', load: 95, badge: 'CPU is the bottleneck' },
          { ...dbC, status: 'ok' },
        ],
        links: [link('app', 'db')],
        flows: [{ path: ['app', 'db'], tone: 'request', count: 3, duration: 1, delay: 0.3 }],
        panel: {
          title: 'One big machine, at most',
          icon: 'Cpu',
          rows: [
            { text: 'CPU', value: '64 to 128 cores', tone: 'bad' },
            { text: 'RAM', value: '1 to 4 TB' },
            { text: 'Disk', value: '~30 TB per NVMe' },
            { text: 'Network', value: '10 to 100 Gbps' },
          ],
          footer: { text: 'Our shop hits CPU first', tone: 'warn' },
        },
      },
    },
    {
      title: 'Failure limit',
      tag: 'concept',
      heading: 'The fifth limit is failure',
      eli5: 'Even a super clerk gets sick sometimes, or goes on a training day. If the shop has only one clerk, every such day closes the whole shop. So you always need a second clerk.',
      body: [
        '**99.9% uptime** allows about 8.8 hours of downtime a year. One disk failure on a single box, plus a rebuild from backup, can use that whole budget in one night.',
        'Planned work counts too. Kernel patches and deploys need reboots, and each reboot takes the shop offline. One box is a **single point of failure**, however big it is. Even an infinitely fast machine needs a second one.',
      ],
      keyIdea: 'A downtime budget of 8.8 hours a year cannot survive one box. Availability needs a second machine, and performance is the bonus.',
      metrics: { traffic: '6K QPS', cpu: '95%', p99: '2.1 s', servers: '1', db: '2.4K reads/s' },
      metricTones: { servers: 'bad' },
      scene: {
        nodes: [
          { ...users, chips: ['GET /cart'] },
          { ...appC, status: 'down', badge: 'disk failed' },
          { ...dbC, status: 'dim' },
        ],
        links: [link('users', 'app'), link('app', 'db', { style: 'faint' })],
        flows: [{ path: ['users', 'app'], tone: 'error', label: 'no reply', count: 3, duration: 1.4 }],
        panel: {
          title: 'The downtime budget',
          icon: 'Bug',
          rows: [
            { text: '99.9% uptime allows', value: '~8.8 h per year' },
            { text: 'Disk failure and rebuild', value: 'hours', tone: 'bad' },
            { text: 'Patches and deploys', value: 'a reboot each', tone: 'warn' },
            { text: 'Shop while it is down', value: 'offline', tone: 'bad' },
          ],
          footer: { text: 'A second machine is insurance, even if the first is fast', tone: 'warn' },
        },
        caption: 'One server, one single point of failure',
      },
    },
    {
      title: 'Scale up',
      tag: 'concept',
      heading: 'Scale up: buy a bigger box',
      eli5: '**Vertical scaling** means swapping the clerk for a much bigger, faster super clerk, the big server. Nothing else in the shop changes, and the line melts away.',
      body: [
        '**Vertical scaling** means moving to a bigger machine: 128 cores and 1 TB of RAM instead of 32 cores and 128 GB. The code does not change. There is no new failure mode to learn and no data to split.',
        'Overnight, CPU drops to 30% and p99 falls to 90 ms. For many products this is the right first move. It is cheap in engineering time, and a single big box goes further than most people expect.',
      ],
      keyIdea: 'Scaling up buys capacity with zero code changes. Try it first when you can, and know where it ends.',
      metrics: { traffic: '6K QPS', cpu: '30%', p99: '90 ms', servers: '1 (big)', db: '2.4K reads/s' },
      metricTones: { cpu: 'good', p99: 'good' },
      scene: {
        nodes: [users, { ...bigApp, status: 'ok', load: 30 }, dbC],
        links: [link('users', 'app'), link('app', 'db')],
        flows: [
          { path: ['users', 'app'], tone: 'request', count: 4, duration: 1.4 },
          { path: ['app', 'users'], tone: 'response', count: 4, duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Same code, bigger box',
          icon: 'Server',
          rows: [
            { text: 'Cores', value: '32 to 128' },
            { text: 'RAM', value: '128 GB to 1 TB' },
            { text: 'CPU', value: '95% to 30%', tone: 'good' },
            { text: 'p99', value: '2.1 s to 90 ms', tone: 'good' },
          ],
          footer: { text: 'No code changes', tone: 'good' },
        },
      },
    },
    {
      title: 'Size ceiling',
      tag: 'tradeoff',
      heading: 'Scaling up runs out of size and money',
      eli5: 'Even the biggest super clerk gets swamped when the crowd keeps growing, and no bigger clerk exists to hire. The last, biggest clerk costs far more than two ordinary ones.',
      body: [
        'Growth continues. At **20K QPS** the big box is pegged at 100% and p99 is 3.5 seconds. You can buy one more size up, but prices grow faster than capacity, and eventually there is no bigger box to buy.',
        'A bigger box is also still one box, so every patch and failure still takes the shop offline. Past the ceiling, you need more machines.',
      ],
      keyIdea: 'Vertical scaling has a hard ceiling on size, and the last steps cost the most per unit of capacity.',
      metrics: { traffic: '20K QPS', cpu: '100%', p99: '3.5 s', servers: '1 (max)', db: '8K reads/s' },
      metricTones: { cpu: 'bad', p99: 'bad' },
      scene: {
        nodes: [
          { ...users, chips: [{ text: '20K req/s', tone: 'warn' }] },
          { ...bigApp, status: 'hot', load: 100, badge: 'largest size' },
          { ...dbC, sub: '8K reads/s' },
        ],
        links: [link('users', 'app'), link('app', 'db')],
        flows: [
          { path: ['users', 'app'], tone: 'request', count: 12, duration: 1.2 },
          { path: ['app', 'users'], tone: 'error', label: 'timeout', count: 2, duration: 1.6, delay: 1.3 },
        ],
        panel: {
          title: 'Price versus capacity',
          icon: 'Scale',
          rows: [
            { text: 'Traffic', value: '20K QPS', tone: 'warn' },
            { text: 'App CPU', value: '100%', tone: 'bad' },
            { text: 'p99', value: '3.5 s', tone: 'bad' },
            { text: 'Next size up', value: 'costs far more per core', tone: 'warn' },
          ],
          footer: { text: 'Eventually no bigger box exists', tone: 'bad' },
        },
        caption: 'One box, as big as it gets',
      },
    },
    {
      title: 'Sticky trap',
      tag: 'problem',
      heading: 'A second server, and shoppers get logged out',
      eli5: 'With two clerks, the second one does not know you, because the first kept your name in their head. You come back and have to introduce yourself again.',
      body: [
        'The obvious next move: put a **load balancer** in front and run a second big box. Within minutes, support tickets arrive. Customers get logged out and their carts vanish, at random.',
        'The cause: each server kept login sessions in its own memory. When the load balancer sends your next request to the other server, it has never heard of you.',
      ],
      keyIdea: 'State kept inside a server breaks the moment a second server exists.',
      metrics: { traffic: '20K QPS', cpu: '50%', p99: '95 ms', servers: '2 (big)', db: '8K reads/s' },
      scene: {
        nodes: [
          { ...users, chips: ['GET /cart'] },
          { ...lb, at: at(-1.5, 0), status: 'active' },
          { ...bigApp, at: at(3, -4.6), label: 'big server 1', sub: 'knows you' },
          { ...app2, size: 1.4, at: at(3, 4.6), label: 'big server 2', sub: 'who are you?', status: 'hot' },
        ],
        links: [link('users', 'lb'), link('lb', 'app'), link('lb', 'app2')],
        flows: [
          { path: ['users', 'lb', 'app2'], tone: 'request', label: 'GET /cart', duration: 1.6 },
          { path: ['app2', 'lb', 'users'], tone: 'error', label: 'please log in', duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'Where the session lives',
          icon: 'KeyRound',
          rows: [
            { text: 'Server 1 memory', value: 'session sid=9f2', tone: 'good' },
            { text: 'Server 2 memory', value: 'empty', tone: 'bad' },
          ],
          footer: { text: 'Server 2 has never heard of you', tone: 'bad' },
        },
        caption: 'The second request lands on the other server',
      },
    },
    {
      title: 'Stateless',
      tag: 'concept',
      heading: 'Move the state out of the server',
      eli5: 'A **stateless** clerk keeps nothing in their head. Names and carts go in Redis, one shared notebook that every clerk reads, so any clerk can serve any shopper.',
      body: [
        'The fix is to make app servers **stateless**. Sessions, carts and uploads go to a shared store such as Redis, a database or object storage. Any server can then handle any request.',
        'A quick patch is sticky sessions, where the balancer pins a shopper to one server. It works, but that server still dies with its sessions and load stays uneven. Shared state is the real fix.',
      ],
      keyIdea: 'A server you can add or kill at any moment holds no state of its own. Move state to a shared store first.',
      metrics: { traffic: '20K QPS', cpu: '50%', p99: '95 ms', servers: '2 (big)', db: '8K reads/s' },
      metricTones: { p99: 'good' },
      scene: {
        nodes: [
          { ...lb, at: at(-5, 0), status: 'active' },
          { ...bigApp, at: at(0, -4.6), label: 'big server 1', sub: 'stateless' },
          { ...app2, size: 1.4, at: at(0, 4.6), label: 'big server 2', sub: 'stateless' },
          { ...redis, at: at(5, 0), status: 'ok', badge: 'shared sessions', chips: ['session:9f2'] },
        ],
        links: [link('lb', 'app'), link('lb', 'app2'), link('app', 'redis', { style: 'dashed' }), link('app2', 'redis', { style: 'dashed' })],
        flows: [
          { path: ['lb', 'app2'], tone: 'request', label: 'GET /cart', duration: 1.2 },
          { path: ['app2', 'redis', 'app2'], tone: 'data', label: 'session lookup', duration: 1.4, delay: 1.3 },
        ],
        panel: {
          title: 'Where the state goes',
          icon: 'Database',
          rows: [
            { text: 'Sessions', value: 'Redis', tone: 'good' },
            { text: 'Carts', value: 'Redis or database', tone: 'good' },
            { text: 'Uploads', value: 'object storage', tone: 'good' },
            { text: 'Server memory', value: 'nothing durable' },
          ],
          footer: { text: 'Any server can handle any request', tone: 'good' },
        },
        caption: 'Every server reads the same notebook',
      },
      code: {
        language: 'python',
        title: 'Move the session out of the process',
        source: `# Before: sessions live in this process's memory
SESSIONS = {}

def login(req):
    sid = new_session_id()
    SESSIONS[sid] = req.user.id          # only this server knows
    return set_cookie("sid", sid)

# After: sessions live in Redis, shared by every server
def login(req):
    sid = new_session_id()
    redis.set(f"session:{sid}", req.user.id, ex=86_400)
    return set_cookie("sid", sid)

def current_user(req):
    return redis.get(f"session:{req.cookies['sid']}")`,
        highlight: [6, 12, 16],
      },
    },
    {
      title: 'Scale out',
      tag: 'concept',
      heading: 'Scale out: many small, identical boxes',
      eli5: '**Horizontal scaling** means hiring more regular clerks. A greeter at the door, the load balancer, sends each shopper to a clerk. When the shop gets busier, you hire one more.',
      body: [
        '**Horizontal scaling** means adding more machines of the same size. With state in Redis, the servers are interchangeable, so they can be cheap commodity boxes. Five 32-core servers each take about 4K QPS at 55% CPU.',
        'Need more capacity next month? Add a sixth box. Cost now grows in a straight line with traffic.',
      ],
      keyIdea: 'Stateless servers behind a load balancer scale by adding boxes. Capacity and cost grow together, one box at a time.',
      metrics: { traffic: '20K QPS', cpu: '55%', p99: '85 ms', servers: '5', db: '8K reads/s' },
      metricTones: { cpu: 'good', p99: 'good' },
      scene: {
        nodes: [{ ...lb, status: 'active' }, ...fleet('+2 more · 4K QPS each').map((n) => ({ ...n, load: 55 })), db],
        links: [...fleetLinks(), link('app', 'db')],
        flows: [
          { path: ['lb', 'app2'], tone: 'request', duration: 0.8 },
          { path: ['lb', 'app'], tone: 'request', count: 3, duration: 0.8, delay: 0.2 },
          { path: ['lb', 'app3'], tone: 'request', duration: 0.8, delay: 0.4 },
        ],
        panel: {
          title: 'Capacity grows with the fleet',
          icon: 'Layers',
          rows: [
            { text: 'Servers', value: '5 × 32 cores' },
            { text: 'Per server', value: '4K QPS', tone: 'good' },
            { text: 'CPU each', value: '55%', tone: 'good' },
            { text: 'Next month', value: 'add a sixth' },
          ],
        },
        caption: 'Five interchangeable servers, one front door',
      },
    },
    {
      title: 'Health checks',
      tag: 'concept',
      heading: 'The balancer keeps the fleet healthy',
      eli5: 'The greeter peeks at each clerk every few seconds. A clerk who does not wave back is skipped until they are well again. The shop keeps a spare greeter too.',
      body: [
        'The load balancer runs **health checks** every few seconds. A server that stops answering leaves the rotation within seconds and rejoins once it is healthy again.',
        'The balancer is itself run as a redundant pair (active-passive, or anycast), so it is not a new single point of failure.',
      ],
      keyIdea: 'Health checks pull a dead server out of rotation in seconds. The balancer is a redundant pair too.',
      metrics: { traffic: '20K QPS', cpu: '55%', p99: '85 ms', servers: '5', db: '8K reads/s' },
      metricTones: { p99: 'good' },
      scene: {
        nodes: [
          { ...lb, status: 'active', chips: ['GET /healthz'] },
          { ...lb, id: 'lb2', at: at(-9, 2.5), label: 'standby balancer', sub: 'passive pair', status: 'dim' },
          { ...app, label: 'app 1', sub: '200 OK', status: 'ok' },
          { ...app2, sub: '200 OK', status: 'ok' },
          { ...app3, sub: 'no reply', status: 'down' },
        ],
        links: [
          link('lb', 'lb2', { style: 'dashed', label: 'heartbeat' }),
          link('lb', 'app', { label: 'every 5 s' }),
          link('lb', 'app2'),
          link('lb', 'app3', { style: 'faint' }),
        ],
        flows: [
          { path: ['lb', 'app', 'lb'], tone: 'handshake', label: '200', duration: 1.2 },
          { path: ['lb', 'app2', 'lb'], tone: 'handshake', label: '200', duration: 1.2, delay: 0.3 },
          { path: ['lb', 'app3'], tone: 'error', label: 'timeout', duration: 1.2, delay: 0.6 },
        ],
        panel: {
          title: 'Deploys use the same check',
          icon: 'Repeat',
          rows: [
            { text: 'app 1', value: 'v1.42, serving', tone: 'good' },
            { text: 'app 2', value: 'v1.42, serving', tone: 'good' },
            { text: 'app 3', value: 'v1.43, restarting', tone: 'warn' },
          ],
          footer: { text: 'Rolling deploy: one server at a time, no downtime', tone: 'good' },
        },
      },
    },
    {
      title: 'Autoscaling',
      tag: 'concept',
      heading: 'Let a rule add the boxes for you',
      eli5: 'A manager watches how tired the clerks look. When the average clerk is too tired, the manager hires one more. When the shop quiets down, one goes home.',
      body: [
        'An **autoscaler** watches a metric, usually average CPU, and changes the number of copies. The target here is 60% CPU, with a floor of 5 copies and a ceiling of 20.',
        'The floor keeps headroom for a lost node. The ceiling stops a bug or an attack from running up the bill.',
      ],
      keyIdea: 'An autoscaler turns a CPU target into a server count. Set a floor for safety and a ceiling for cost.',
      metrics: { traffic: '20K QPS', cpu: '55%', p99: '85 ms', servers: '5 to 20', db: '8K reads/s' },
      scene: {
        nodes: [
          { id: 'hpa', kind: 'block', at: at(-3, 0), label: 'autoscaler', sub: 'target CPU 60%', icon: 'Gauge', tint: 'violet' },
          { ...app, label: 'web pods', sub: 'replicas: 5', badge: 'min 5 · max 20', status: 'active', at: at(2, 0.4) },
        ],
        links: [link('hpa', 'app', { label: 'add or remove', arrow: 'end' })],
        flows: [{ path: ['app', 'hpa'], tone: 'data', label: 'avg CPU 55%', duration: 1.4 }],
        panel: {
          title: 'The scaling rule',
          icon: 'Gauge',
          rows: [
            { text: 'Target CPU', value: '60%' },
            { text: 'Minimum copies', value: '5', tone: 'good' },
            { text: 'Maximum copies', value: '20', tone: 'warn' },
            { text: 'Current', value: '5 copies at 55%' },
          ],
          footer: { text: 'Floor for safety, ceiling for cost', tone: 'muted' },
        },
      },
      code: {
        language: 'yaml',
        title: 'Five copies, plus an autoscaler',
        source: `apiVersion: apps/v1
kind: Deployment
metadata: { name: web }
spec:
  replicas: 5                    # identical, stateless copies
  selector: { matchLabels: { app: web } }
  template:
    metadata: { labels: { app: web } }
    spec:
      containers:
        - name: web
          image: shop/web:1.42
          readinessProbe:          # only ready pods get traffic
            httpGet: { path: /healthz, port: 8080 }
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata: { name: web }
spec:
  scaleTargetRef: { apiVersion: apps/v1, kind: Deployment, name: web }
  minReplicas: 5
  maxReplicas: 20
  metrics:
    - type: Resource
      resource: { name: cpu, target: { type: Utilization, averageUtilization: 60 } }`,
        highlight: [5, 13, 14, 21, 22, 25],
      },
    },
    {
      title: 'Lose a node',
      tag: 'case',
      heading: 'Case: app 3 dies at 2 am',
      eli5: 'Clerk app 3 goes home sick in the night. The greeter, the load balancer, notices and sends shoppers to the other four, who have spare energy for this.',
      body: [
        'A disk fails and app 3 stops answering. The load balancer misses two health checks, takes it out of rotation, and spreads its traffic over the other four.',
        'Each survivor now takes 5K QPS at 70% CPU. p99 rises from 85 ms to 110 ms and nobody gets paged for an outage. With the single big box, the same disk failure would have taken the whole shop offline.',
      ],
      keyIdea: 'Horizontal scaling buys availability as well as capacity.',
      metrics: { traffic: '20K QPS', cpu: '70%', p99: '110 ms', servers: '4 of 5', db: '8K reads/s' },
      metricTones: { cpu: 'warn', p99: 'warn', servers: 'warn' },
      scene: {
        nodes: [
          { ...lb, status: 'active', badge: 'health check failed' },
          { ...app, label: 'app 1', sub: '+2 more · 5K QPS each', load: 70 },
          { ...app2, load: 70 },
          { ...app3, status: 'down', badge: 'down' },
        ],
        links: [link('lb', 'app'), link('lb', 'app2'), link('lb', 'app3', { style: 'faint' })],
        flows: [
          { path: ['lb', 'app3'], tone: 'error', label: 'no reply', duration: 1 },
          { path: ['lb', 'app2'], tone: 'request', count: 2, duration: 0.8, delay: 0.4 },
          { path: ['lb', 'app'], tone: 'request', count: 3, duration: 0.8, delay: 0.6 },
        ],
        panel: {
          title: 'Before and after',
          icon: 'Server',
          rows: [
            { text: 'Servers in rotation', value: '5 to 4', tone: 'warn' },
            { text: 'QPS each', value: '4K to 5K' },
            { text: 'CPU each', value: '55% to 70%', tone: 'warn' },
            { text: 'p99', value: '85 to 110 ms', tone: 'warn' },
          ],
          footer: { text: 'Degraded, not down', tone: 'good' },
        },
      },
      quiz: {
        question: 'Why can the load balancer send a logged-in shopper to any of the remaining four servers?',
        options: [
          'The load balancer copies each session to every server',
          'Sessions live in a shared store, so every server can look them up',
          'The shopper is always pinned to app 1',
          'Health checks re-create sessions on the new server',
        ],
        answer: 1,
        explain: 'Because the servers are stateless, any server can read the session from Redis. That is what makes them interchangeable.',
      },
    },
    {
      title: 'Headroom',
      tag: 'tradeoff',
      heading: 'Size the fleet for a missing node',
      eli5: 'Clerks should never all be at full stretch. If each keeps some spare energy, the shop copes the day one is out. That spare energy is called **headroom**.',
      body: [
        'Plan for **headroom**: the fleet must carry peak traffic with a server missing. N+1 (one spare) is the minimum. Many teams run 2N, double the servers, so a whole rack or zone can fail.',
        'Our five servers at 55% CPU survive one loss at 70%. Run them at 90% and a single failure pushes the survivors past 100%, which can cascade into a full outage.',
      ],
      keyIdea: 'Size for the failure case, not the happy path. Headroom is what turns a lost node into a non-event.',
      metrics: { traffic: '20K QPS', cpu: '70%', p99: '110 ms', servers: '4 of 5', db: '8K reads/s' },
      scene: {
        nodes: [
          { ...app, label: '5 servers', sub: 'at 55% CPU', status: 'ok', load: 55, at: at(-4.5, 0) },
          { ...app2, label: '4 left', sub: 'at 70% CPU', status: 'active', load: 70, at: at(0, -3.4) },
          { ...app3, label: '4 left', sub: 'at 90% start', status: 'hot', load: 100, at: at(4.5, 3.4) },
        ],
        links: [link('app', 'app2', { label: 'lose 1', labelTone: 'warn' }), link('app', 'app3', { label: 'lose 1, run hot', labelTone: 'warn' })],
        flows: [],
        panel: {
          title: 'Same failure, two fleets',
          icon: 'Scale',
          rows: [
            { text: '5 servers at 55%', value: '70% after loss', tone: 'good' },
            { text: '5 servers at 90%', value: '112% after loss, overload', tone: 'bad' },
            { text: 'Minimum spare', value: 'N+1', tone: 'warn' },
            { text: 'Zone-safe', value: '2N' },
          ],
          footer: { text: 'Overload on survivors cascades', tone: 'bad' },
        },
      },
    },
    {
      title: 'Hot database',
      tag: 'problem',
      heading: 'The database is the next hot box',
      eli5: 'The clerks are fine now, but they all crowd into one stockroom, the database. You cannot hire a copy of it the way you hired clerks, because it holds the real toys.',
      body: [
        'A holiday sale pushes traffic to **26K QPS**. The app tier is fine at 70% CPU. The database is not: it now sees 10.4K reads per second, past the ~10K that one Postgres node handles, and p99 jumps to 900 ms.',
        'You cannot clone the database the way you cloned the app servers, because it holds the state. Every copy would disagree with the others.',
      ],
      keyIdea: 'Stateless tiers scale by cloning. Stateful tiers need something smarter.',
      metrics: { traffic: '26K QPS', cpu: '70%', p99: '900 ms', servers: '5', db: '10.4K reads/s' },
      metricTones: { p99: 'bad', db: 'bad' },
      scene: {
        nodes: [
          { ...lb, at: at(-5, 0) },
          { ...app, at: at(0, 0), label: 'app tier', sub: '5 servers', badge: '70% CPU', status: 'ok' },
          { ...db, at: at(5, 0), status: 'hot', load: 100, badge: '10.4K reads/s · limit ~10K' },
        ],
        links: [link('lb', 'app'), link('app', 'db')],
        flows: [
          { path: ['lb', 'app'], tone: 'request', count: 5, duration: 1 },
          { path: ['app', 'db'], tone: 'request', count: 6, duration: 1.2, delay: 0.5 },
        ],
        panel: {
          title: 'Five app servers, one database',
          icon: 'Database',
          rows: [
            { text: 'App tier CPU', value: '70%', tone: 'good' },
            { text: 'DB reads', value: '10.4K/s', tone: 'bad' },
            { text: 'One node handles', value: '~10K/s' },
            { text: 'p99', value: '900 ms', tone: 'bad' },
          ],
          footer: { text: 'The shared state is the bottleneck', tone: 'bad' },
        },
        caption: 'Five app servers, one database',
      },
    },
    {
      title: 'Tune first',
      tag: 'concept',
      heading: 'Tune and scale up the database before any lever',
      eli5: 'Before building new stockrooms, check if the clerks are just searching badly. A good index card finds a toy fast. A bigger stockroom is the next cheap fix.',
      body: [
        'Check slow queries and missing indexes first. One full table scan can cost more than a thousand indexed reads. Add connection pooling so idle connections stop eating memory.',
        'If the database is still hot, scale the primary up to a bigger box. Only then pull the levers. The indexes and query tuning lesson covers the first step in depth.',
      ],
      keyIdea: 'Cheapest first: tune queries and indexes, then a bigger primary, then the levers.',
      metrics: { traffic: '26K QPS', cpu: '70%', p99: '900 ms', servers: '5', db: '10.4K reads/s' },
      metricTones: { p99: 'bad', db: 'bad' },
      scene: {
        nodes: [
          { id: 't1', kind: 'block', size: 0.8, at: at(-5, 0), label: 'tune queries', sub: 'indexes, pooling', icon: 'Search', tint: 'amber' },
          { id: 't2', kind: 'block', size: 0.8, at: at(0, 0), label: 'bigger primary', sub: 'more CPU and RAM', icon: 'TrendingUp', tint: 'gray' },
          { id: 't3', kind: 'block', size: 0.8, at: at(5, 0), label: 'five levers', sub: 'only then', icon: 'Boxes', tint: 'green' },
        ],
        links: [link('t1', 't2', { label: 'still hot' }), link('t2', 't3', { label: 'still hot' })],
        flows: [{ path: ['t1', 't2', 't3'], tone: 'request', duration: 2.4 }],
        panel: {
          title: 'Cheapest first',
          icon: 'Search',
          rows: [
            { text: 'Missing index', value: 'full table scan', tone: 'bad' },
            { text: 'Connection pooling', value: 'fewer idle connections', tone: 'good' },
            { text: 'Bigger primary', value: 'no code change', tone: 'good' },
            { text: 'Levers', value: 'last, they add complexity', tone: 'warn' },
          ],
          footer: { text: 'Next: indexes and query tuning lesson', tone: 'muted' },
        },
      },
    },
    {
      title: 'Five levers',
      tag: 'concept',
      heading: 'Every design is a mix of five levers',
      eli5: 'If tuning is not enough, you have five tricks: keep favorites close, copy the stockroom, split it, do chores later, and open shops near faraway kids. Those are the **five levers**.',
      body: [
        '**Cache**: keep hot data in RAM. **Replicate**: copy data for reads and survival. **Partition**: split data so each node owns a slice. **Asynchronize**: answer now, do the work later. **Localize**: move data close to users.',
        'When you are stuck, ask which lever you have not pulled yet. Each one buys capacity and charges you somewhere.',
      ],
      keyIdea: 'Stateful tiers scale with five levers: cache, replicate, partition, asynchronize, localize.',
      metrics: { traffic: '26K QPS', cpu: '70%', p99: '900 ms', servers: '5', db: '10.4K reads/s' },
      scene: {
        nodes: [
          { id: 'l1', kind: 'block', size: 0.72, at: at(-6, 0), label: 'cache', sub: 'hot data in RAM', icon: 'Zap', tint: 'amber' },
          { id: 'l2', kind: 'block', size: 0.72, at: at(-3, 0), label: 'replicate', sub: 'copies of data', icon: 'Copy', tint: 'blue' },
          { id: 'l3', kind: 'block', size: 0.72, at: at(0, 0), label: 'partition', sub: 'one slice each', icon: 'Split', tint: 'green' },
          { id: 'l4', kind: 'block', size: 0.72, at: at(3, 0), label: 'asynchronize', sub: 'do it later', icon: 'Inbox', tint: 'violet' },
          { id: 'l5', kind: 'block', size: 0.72, at: at(6, 0), label: 'localize', sub: 'data near users', icon: 'Earth', tint: 'gray' },
        ],
        links: [link('l1', 'l2', { style: 'dashed' }), link('l2', 'l3', { style: 'dashed' }), link('l3', 'l4', { style: 'dashed' }), link('l4', 'l5', { style: 'dashed' })],
        flows: [],
        panel: {
          title: 'Which lever for which pain',
          icon: 'Scale',
          rows: [
            { text: 'Reads too heavy', value: 'cache, replicate', tone: 'good' },
            { text: 'Writes too heavy', value: 'partition', tone: 'good' },
            { text: 'Slow work', value: 'asynchronize', tone: 'good' },
            { text: 'Users far away', value: 'localize', tone: 'good' },
          ],
          footer: { text: 'Each lever has a price', tone: 'warn' },
        },
      },
    },
    {
      title: 'Cache lever',
      tag: 'case',
      heading: 'Cache: absorb the hot reads in RAM',
      eli5: 'The clerks copy the most-asked toy facts into the shared notebook, so they rarely walk to the stockroom. That quick copy is a **cache**.',
      body: [
        'Most of the load is reads of product pages, which are the same for everyone. Redis already holds sessions, so it also keeps hot products. It answers 90% of reads, and database reads drop to about 1K per second.',
        'A cache is a bet that most requests look like recent requests. When the bet is wrong (uniform access over TBs of data) it holds nothing useful. The cost is stale data and hard invalidation.',
      ],
      keyIdea: 'Cache first for read-heavy, skewed load. It trades freshness for a lot of capacity.',
      metrics: { traffic: '26K QPS', cpu: '70%', p99: '70 ms', servers: '5', db: '1K reads/s' },
      metricTones: { p99: 'good', db: 'good' },
      scene: {
        nodes: [
          { ...app, at: at(-4.5, 0), label: 'app tier', sub: '5 servers', status: 'ok' },
          { ...redis, at: at(0, -3.4), sub: 'sessions + products', status: 'active', badge: '90% hit', chips: [{ text: 'GET product:7', tone: 'good' }] },
          { ...db, at: at(4.5, 3.4), status: 'ok', sub: '1K reads/s', load: 15 },
        ],
        links: [link('app', 'redis'), link('app', 'db')],
        flows: [
          { path: ['app', 'redis', 'app'], tone: 'request', label: 'GET product', count: 4, duration: 1.2 },
          { path: ['app', 'db', 'app'], tone: 'request', label: 'miss', duration: 1.6, delay: 1 },
        ],
        panel: {
          title: 'What the cache buys',
          icon: 'Zap',
          rows: [
            { text: 'Hit rate', value: '90%', tone: 'good' },
            { text: 'DB reads', value: '10.4K to 1K/s', tone: 'good' },
            { text: 'p99', value: '900 to 70 ms', tone: 'good' },
            { text: 'Price', value: 'stale data', tone: 'warn' },
          ],
          footer: { text: 'A cached price can be a minute stale', tone: 'warn' },
        },
      },
    },
    {
      title: 'Replicate',
      tag: 'case',
      heading: 'Replicate: copy the data to a second node',
      eli5: 'A second stockroom copies the first. If the first stockroom floods, or the notebook is lost, the second one takes over and helps with the looking.',
      body: [
        'With the cache, reads are only 1K per second, so a replica is mostly about survival. If the cache is cold or down, reads jump back to 10K per second and would need 2 nodes. A **read replica** serves those misses.',
        'If the primary dies, a replica is promoted in about 30 seconds. Replication is asynchronous, so failover can lose the last few writes. Synchronous replication avoids that but slows every write.',
      ],
      keyIdea: 'Replicas buy survival and spare read capacity. Async copies can lose the last few writes on failover.',
      metrics: { traffic: '26K QPS', cpu: '70%', p99: '60 ms', servers: '5', db: '1K reads/s' },
      metricTones: { p99: 'good' },
      scene: {
        nodes: [
          { ...app, at: at(-4.5, 0), label: 'app tier', sub: '5 servers', status: 'ok' },
          { ...db, at: at(0, -3.4), status: 'ok', sub: 'writes + hot reads' },
          { ...replica, at: at(4.5, 3.4), status: 'active', badge: 'serves cache misses' },
        ],
        links: [link('app', 'db'), link('app', 'replica'), link('db', 'replica', { style: 'dashed', label: 'replication' })],
        flows: [
          { path: ['app', 'db'], tone: 'request', label: 'write', duration: 1.2 },
          { path: ['db', 'replica'], tone: 'data', label: 'WAL', count: 2, duration: 1.2, delay: 0.8 },
          { path: ['app', 'replica', 'app'], tone: 'request', label: 'read', duration: 1.6, delay: 1.6 },
        ],
        panel: {
          title: 'Primary and replica',
          icon: 'Copy',
          rows: [
            { text: 'Writes', value: 'primary only' },
            { text: 'Reads if cache is cold', value: '10K/s, 2 nodes', tone: 'good' },
            { text: 'Failover', value: '~30 s', tone: 'good' },
            { text: 'Async failover', value: 'last writes may be lost', tone: 'warn' },
            { text: 'Price', value: 'every write is copied', tone: 'warn' },
          ],
        },
      },
    },
    {
      title: 'Replica lag',
      tag: 'tradeoff',
      heading: 'The price of a replica is lag',
      eli5: 'The second stockroom copies from the first a few seconds late. If you ask it for the toy that just arrived, it may say it is not there yet.',
      body: [
        'A replica trails the primary by milliseconds to seconds. A shopper who saves a new address and reloads may read an old one, because the read hit the replica. This breaks **read-your-writes**.',
        'Checkout and payment keep reading from the primary. Product pages are fine with a replica.',
      ],
      keyIdea: 'Read from replicas only where slightly old data is fine. Read your own writes from the primary.',
      metrics: { traffic: '26K QPS', cpu: '70%', p99: '60 ms', servers: '5', db: '1K reads/s' },
      scene: {
        nodes: [
          { ...app, at: at(-4.5, 0), label: 'app tier', sub: '5 servers', chips: ['UPDATE address'] },
          { ...db, at: at(0, -3.4), status: 'ok', sub: 'address: 9 Elm St' },
          { ...replica, at: at(4.5, 3.4), status: 'active', sub: 'address: 4 Oak Ave', badge: 'lag ~50 ms' },
        ],
        links: [link('app', 'db'), link('db', 'replica', { style: 'dashed', label: '~50 ms behind', labelTone: 'warn' })],
        flows: [
          { path: ['app', 'db'], tone: 'request', label: 'new address', duration: 1.2 },
          { path: ['app', 'replica', 'app'], tone: 'error', label: 'old address', duration: 1.6, delay: 1.3 },
        ],
        panel: {
          title: 'Where to read',
          icon: 'Table',
          rows: [
            { text: 'Product pages', value: 'replica', tone: 'good' },
            { text: 'Checkout', value: 'primary', tone: 'warn' },
            { text: 'Payment', value: 'primary', tone: 'warn' },
            { text: 'Own profile just saved', value: 'primary', tone: 'warn' },
          ],
          footer: { text: 'Lag is milliseconds to seconds', tone: 'muted' },
        },
      },
      quiz: {
        question: 'A shopper saves a new address and reloads the page, but still sees the old one. What is the most likely cause?',
        options: [
          'The cache is full',
          'The read went to a replica that had not yet applied the write',
          'The load balancer lost the session',
          'The primary rejected the write',
        ],
        answer: 1,
        explain: 'Replicas trail the primary by milliseconds to seconds. Reads that must see the shopper\'s own writes should go to the primary.',
      },
    },
    {
      title: 'Partition',
      tag: 'concept',
      heading: 'Partition: plan for write growth',
      eli5: 'New deliveries still all go into one stockroom. To **partition** is to split it in two: each kid gets a number, and shard 0 and shard 1 each take half of the numbers. Each room handles half of the work.',
      body: [
        'Caches and replicas do nothing for writes. The primary takes all 2.6K writes per second against a limit near 5K. That is fine today, so this is planned for next year\'s growth.',
        '**Partition** (shard) the data by `hash(user_id)`. Each of two shards owns half the users and takes 1.3K writes per second. Past the biggest single node, partitioning is the only way to scale writes.',
      ],
      keyIdea: 'Past the biggest single node, only partitioning adds write capacity and room for data.',
      metrics: { traffic: '26K QPS', cpu: '65%', p99: '60 ms', servers: '5', db: '1.3K writes/s per shard' },
      metricTones: { db: 'good' },
      scene: {
        nodes: [
          { ...app, at: at(-4.5, 0), label: 'app tier', sub: 'picks a shard', status: 'ok' },
          { ...db, label: 'shard 0', sub: 'hash 0', status: 'ok', badge: '1.3K writes/s', at: at(0, -3.4) },
          { ...shardB, label: 'shard 1', sub: 'hash 1', status: 'ok', badge: '1.3K writes/s', at: at(4.5, 3.4) },
        ],
        links: [link('app', 'db'), link('app', 'shardB')],
        flows: [
          { path: ['app', 'db'], tone: 'request', label: 'user 17', duration: 1.2 },
          { path: ['app', 'shardB'], tone: 'request', label: 'user 42', duration: 1.2, delay: 0.4 },
        ],
        panel: {
          title: 'Write load per node',
          icon: 'Split',
          rows: [
            { text: 'One primary', value: '2.6K writes/s', tone: 'warn' },
            { text: 'One node tops out', value: '~5K writes/s' },
            { text: 'Two shards', value: '1.3K each', tone: 'good' },
          ],
          footer: { text: 'hash(user_id) picks shard 0 or shard 1', tone: 'muted' },
        },
      },
    },
    {
      title: 'Shard costs',
      tag: 'tradeoff',
      heading: 'The shard key decides your fate',
      eli5: 'Splitting by kid number works because kids are spread evenly. Split orders by the day they were placed, and today\'s orders all land in one room while the other sits empty.',
      body: [
        'Pick a key that spreads load evenly and keeps most queries on one shard. Sharding `orders` by `created_at` sends every new order to the newest shard, while older shards sit idle.',
        'Hashing `user_id` spreads writes and keeps one shopper\'s orders together.',
      ],
      keyIdea: 'A good shard key spreads writes evenly and keeps most queries on one shard.',
      metrics: { traffic: '26K QPS', cpu: '65%', p99: '60 ms', servers: '5', db: '1.3K writes/s per shard' },
      scene: {
        nodes: [
          { ...app, at: at(-4.5, 0), label: 'app tier', status: 'ok' },
          { ...db, label: 'shard 0', sub: 'orders by created_at: old', status: 'dim', at: at(0, -3.4) },
          { ...shardB, label: 'shard 1', sub: 'orders by created_at: today', status: 'hot', load: 100, badge: 'all new orders', at: at(4.5, 3.4) },
        ],
        links: [link('app', 'db', { style: 'faint' }), link('app', 'shardB')],
        flows: [{ path: ['app', 'shardB'], tone: 'request', label: 'new order', count: 5, duration: 1.2 }],
        panel: {
          title: 'Choosing a shard key',
          icon: 'Hash',
          rows: [
            { text: 'user_id (hashed)', value: 'even spread', tone: 'good' },
            { text: 'created_at', value: 'one hot shard', tone: 'bad' },
            { text: 'Query across users', value: 'hits every shard', tone: 'warn' },
            { text: 'Rebalancing later', value: 'hard', tone: 'warn' },
          ],
        },
      },
    },
    {
      title: 'Asynchronize',
      tag: 'concept',
      heading: 'Asynchronize: answer now, work later',
      eli5: 'Slow chores like gift wrapping go in a basket, the job queue, for helpers to do later. The shopper pays and leaves at once instead of waiting.',
      body: [
        'Order confirmation emails and image resizing go on a queue and run on workers, so checkout returns as soon as the order is saved. The cheapest latency win is work you do not do while the user waits.',
        'The costs: every async hop is a new failure mode, results arrive eventually, and ordering and retries need care.',
      ],
      keyIdea: 'Async work makes responses fast by doing less while the user waits. Queues also let producers and consumers scale on their own.',
      metrics: { traffic: '26K QPS', cpu: '65%', p99: '60 ms', servers: '5', db: '1.3K writes/s per shard' },
      scene: {
        nodes: [
          { ...app, label: 'app tier', status: 'ok', at: at(-3, 0) },
          { ...queue, status: 'active', badge: 'emails · thumbnails', at: at(1.5, 0) },
          { ...worker, status: 'active', at: at(6, 0) },
        ],
        links: [link('app', 'queue'), link('queue', 'worker')],
        flows: [
          { path: ['app', 'queue'], tone: 'event', label: 'send email', duration: 1.2 },
          { path: ['queue', 'worker'], tone: 'event', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Sync or async',
          icon: 'Workflow',
          rows: [
            { text: 'Save the order', value: 'sync', tone: 'good' },
            { text: 'Confirmation email', value: 'async' },
            { text: 'Thumbnails', value: 'async' },
            { text: 'Price', value: 'eventual, retries', tone: 'warn' },
          ],
        },
      },
    },
    {
      title: 'Localize',
      tag: 'concept',
      heading: 'Localize: put data near the user',
      eli5: 'A shopper far away waits a long time for the main shop. Open a small branch near them and keep copies of the popular toys there.',
      body: [
        'The speed of light is a constant you cannot negotiate. New York to Singapore is about 230 ms round trip and always will be. If users are global, put bytes and compute near them: CDNs for static files, multi-region databases for dynamic data, edge workers for logic.',
        'Traffic reaches the nearest region through geo-DNS. The price is consistency across oceans, data residency rules and more infrastructure.',
      ],
      keyIdea: 'Localize when users are global. It is the hardest lever because consistency now spans oceans.',
      metrics: { traffic: '26K QPS', cpu: '65%', p99: '60 ms', servers: '5', db: '1.3K writes/s per shard' },
      scene: {
        nodes: [
          { id: 'sg', kind: 'user', at: at(-5, 0), label: 'shopper', sub: 'Singapore' },
          { id: 'edge', kind: 'cdn', at: at(-0.5, 0), label: 'regional edge', sub: 'Singapore', status: 'ok' },
          { id: 'home', kind: 'block', size: 0.9, at: at(5, 0), label: 'home region', sub: 'New York', icon: 'Server', tint: 'blue' },
        ],
        links: [
          link('sg', 'edge', { label: '~10 ms', labelTone: 'good' }),
          link('edge', 'home', { label: '230 ms round trip', labelTone: 'warn' }),
        ],
        flows: [
          { path: ['sg', 'edge', 'sg'], tone: 'request', label: 'cached page', duration: 1.2 },
          { path: ['edge', 'home'], tone: 'request', label: 'only on miss', duration: 1.6, delay: 1.4 },
        ],
        panel: {
          title: 'Ways to localize',
          icon: 'Earth',
          rows: [
            { text: 'Static files', value: 'CDN' },
            { text: 'Dynamic data', value: 'multi-region database' },
            { text: 'Logic', value: 'edge workers' },
            { text: 'Routing', value: 'geo-DNS' },
          ],
          footer: { text: 'Own lesson: multi-region and geo routing', tone: 'muted' },
        },
        caption: 'Move the data, not the speed of light',
      },
    },
    {
      title: 'Multi data center',
      tag: 'case',
      heading: 'Localize at scale: several data centers',
      eli5: 'The shop opens a second branch in another city with its own copy of the toy list. A signpost sends each shopper to the nearest branch. If one branch closes, the signpost points everyone to the other.',
      body: [
        '**Geo-DNS** answers each lookup with the nearest region, and each region keeps a replicated copy of the data. Reads are served locally. Writes go to one home region or are merged across regions.',
        'If a whole data center is lost, DNS stops answering with it and shifts traffic to the survivor. The multi-region lesson covers routing, data and failover in depth.',
      ],
      keyIdea: 'Several data centers give nearby users speed and survive the loss of a whole region.',
      metrics: { traffic: '26K QPS', cpu: '65%', p99: '60 ms', servers: '5', db: '1.3K writes/s per shard' },
      metricTones: { servers: 'warn' },
      scene: {
        nodes: [
          { id: 'eu', kind: 'user', at: at(-6.5, 0), label: 'shopper', sub: 'Berlin' },
          { id: 'dns', kind: 'block', size: 0.8, at: at(-2, 0), label: 'geo-DNS', sub: 'nearest healthy region', icon: 'Globe', tint: 'violet' },
          { id: 'rUS', kind: 'block', size: 0.9, at: at(3, -3.4), label: 'US region', sub: 'data center lost', icon: 'Server', tint: 'blue', status: 'down' },
          { id: 'rEU', kind: 'block', size: 0.9, at: at(3, 3.4), label: 'EU region', sub: 'replicated data', icon: 'Server', tint: 'green', status: 'active' },
        ],
        links: [
          link('eu', 'dns'),
          link('dns', 'rUS', { style: 'faint' }),
          link('dns', 'rEU', { label: 'rerouted', labelTone: 'good' }),
          link('rUS', 'rEU', { style: 'dashed', label: 'replication' }),
        ],
        flows: [
          { path: ['eu', 'dns', 'rEU'], tone: 'request', label: 'GET /cart', duration: 1.6 },
          { path: ['dns', 'rUS'], tone: 'error', label: 'no reply', duration: 1.2, delay: 1.7 },
        ],
        panel: {
          title: 'Three jobs of a multi data center setup',
          icon: 'Earth',
          rows: [
            { text: 'Routing', value: 'geo-DNS to nearest region', tone: 'good' },
            { text: 'Data', value: 'replicated per region', tone: 'good' },
            { text: 'Failover', value: 'move a lost region\'s traffic', tone: 'warn' },
            { text: 'Price', value: 'cross-region consistency', tone: 'warn' },
          ],
          footer: { text: 'Own lesson: multi-region and geo routing', tone: 'muted' },
        },
        caption: 'Lose a whole region, keep the shop open',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Up, then out, then pull the levers',
      eli5: 'First try a bigger clerk, then hire more clerks behind a greeter. For the stockroom, pull the **five levers**: keep favorites close, copy it, split it, do chores later, and open shops near faraway kids.',
      body: [
        'Scale **up** first when you can. It costs no code, but it has a size ceiling and stays a single point of failure. Scale **out** next: make app servers stateless, put them behind a load balancer, and size the fleet with headroom for a lost node.',
        'The stateful tier gets tuning and a bigger primary first, then the five levers. Cache and replicate for reads, partition for writes and data size, asynchronize slow work, and localize for distant users. Each one charges you in consistency or complexity.',
      ],
      keyIdea: 'Clone the stateless parts, and pull the right lever for the stateful parts. Know what each lever costs before you pull it.',
      metrics: { traffic: '26K QPS', cpu: '65%', p99: '60 ms', servers: '5', db: '1.3K writes/s per shard' },
      metricTones: { cpu: 'good', p99: 'good', db: 'good' },
      scene: {
        nodes: [
          { id: 'r1', kind: 'block', size: 0.8, at: at(-5, 0), label: 'scale up', sub: 'bigger box', icon: 'TrendingUp', tint: 'gray' },
          { id: 'r2', kind: 'block', size: 0.8, at: at(0, 0), label: 'scale out', sub: 'stateless fleet', icon: 'Layers', tint: 'blue' },
          { id: 'r3', kind: 'block', size: 0.8, at: at(5, 0), label: 'five levers', sub: 'stateful tier', icon: 'Boxes', tint: 'green' },
        ],
        links: [link('r1', 'r2', { label: 'ceiling hit' }), link('r2', 'r3', { label: 'database hot' })],
        flows: [{ path: ['r1', 'r2', 'r3'], tone: 'request', duration: 2.4 }],
        panel: {
          title: 'The five levers and prices',
          icon: 'Scale',
          rows: [
            { text: 'Cache', value: 'stale reads' },
            { text: 'Replicate', value: 'lag, write copies' },
            { text: 'Partition', value: 'cross-shard queries' },
            { text: 'Asynchronize', value: 'eventual results' },
            { text: 'Localize', value: 'multi-region consistency' },
          ],
        },
      },
      quiz: {
        question: 'Your app servers are stateless behind a load balancer. The database primary is at 90% CPU, almost all of it from writes. Which lever helps most?',
        options: [
          'Add more app servers',
          'Add read replicas',
          'Partition the data across shards',
          'Put a bigger load balancer in front',
        ],
        answer: 2,
        explain: 'Every replica must apply every write, so replicas do not reduce write load. More app servers send even more writes. Partitioning splits the writes so each shard handles a fraction of them.',
      },
    },
  ],
};
