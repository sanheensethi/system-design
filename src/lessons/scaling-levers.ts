import type { Lesson, SceneNode } from '../engine/types';

const users: SceneNode = { id: 'users', kind: 'user', at: [-4, 3], label: 'shoppers' };
const lb: SceneNode = { id: 'lb', kind: 'lb', at: [-1.8, 1.8], label: 'load balancer' };
const app: SceneNode = { id: 'app', kind: 'server', at: [0.6, -0.6], label: 'app server', sub: '32 cores · 128 GB' };
const app2: SceneNode = { id: 'app2', kind: 'server', at: [-2.2, -1], label: 'app 2', sub: '32 cores' };
const app3: SceneNode = { id: 'app3', kind: 'server', at: [1.2, 2.4], label: 'app 3', sub: '32 cores' };
const db: SceneNode = { id: 'db', kind: 'db', at: [1.75, -1.75], label: 'database', sub: 'Postgres primary' };
const redis: SceneNode = { id: 'redis', kind: 'cache', at: [-1.25, -4.75], label: 'Redis', sub: 'sessions' };
const replica: SceneNode = { id: 'replica', kind: 'replica', at: [1.6, -4.4], label: 'read replica' };
const shardB: SceneNode = { id: 'shardB', kind: 'db', at: [4.25, -1.75], label: 'shard B', sub: 'users M to Z' };
const queue: SceneNode = { id: 'queue', kind: 'queue', at: [4.5, 1.5], label: 'job queue' };
const worker: SceneNode = { id: 'worker', kind: 'worker', at: [6.25, 0.75], label: 'workers', sub: 'email, images' };

// Five servers in the story, three on stage: app 1 carries a "+2 more" badge for the rest.
const fleet = (badge = '+2 more'): SceneNode[] => [
  { ...app, label: 'app 1', sub: '32 cores', badge },
  app2,
  app3,
];

const fleetLinks = ['app', 'app2', 'app3'].map((id) => ({ from: 'lb', to: id }));

export const scalingLevers: Lesson = {
  id: 'scaling-levers',
  title: 'Scaling up, scaling out, and the five levers',
  tagline: 'Watch one server get hot, grow, hit the ceiling, and then multiply.',
  minutes: 12,
  level: 'Beginner',
  learn: [
    'The five hard limits of a single machine',
    'Vertical scaling: when a bigger box is the right answer, and when it runs out',
    'Why app servers must be stateless before you add more',
    'Horizontal scaling behind a load balancer, with headroom for failure',
    'The five levers: partition, replicate, cache, asynchronize, localize',
  ],
  metrics: [
    { key: 'traffic', label: 'Traffic' },
    { key: 'cpu', label: 'App CPU' },
    { key: 'p99', label: 'p99 latency' },
    { key: 'servers', label: 'App servers' },
    { key: 'db', label: 'DB load' },
  ],
  steps: [
    {
      title: 'One hot box',
      tag: 'problem',
      heading: 'The shop outgrew its server',
      eli5: 'The toy shop has one clerk, the **app server**, and a long line of shoppers. The clerk works as fast as possible, and the line still keeps growing.',
      body: [
        'The shop runs on one app server with 32 cores and 128 GB of RAM, talking to one Postgres database. A year ago it served 1K requests per second without breaking a sweat.',
        'Today it gets **6K QPS**. CPU sits at 95%, requests queue up behind each other, and the slowest 1% of requests (the **p99**) take 2.1 seconds. Customers abandon carts.',
        'You have two ways to get more capacity: make the box bigger, or add more boxes. This lesson walks through both, in the order most teams meet them.',
      ],
      keyIdea: 'Every growing system hits a point where one machine is not enough. The question is what to do next, and in what order.',
      metrics: { traffic: '6K QPS', cpu: '95%', p99: '2.1 s', servers: '1', db: '2.4K reads/s' },
      scene: {
        nodes: [users, { ...app, status: 'hot', badge: 'CPU 95%' }, db],
        links: [
          { from: 'users', to: 'app' },
          { from: 'app', to: 'db' },
        ],
        flows: [
          { path: ['users', 'app'], tone: 'request', count: 8, duration: 1.4 },
          { path: ['app', 'users'], tone: 'response', count: 2, duration: 2.6, delay: 1.5 },
        ],
        caption: 'Requests pile up faster than one box can answer',
      },
    },
    {
      title: 'Five ceilings',
      tag: 'concept',
      heading: 'Five limits every machine hits',
      eli5: 'One clerk can run out of five things: thinking speed, counter space, storage room, door width, or good health. Whichever runs out first is the **bottleneck**, and a sick clerk closes the whole shop.',
      body: [
        'A single machine runs out in five ways. **CPU**: 64 to 128 cores per socket. **RAM**: 1 to 4 TB on large servers. **Disk**: about 30 TB per NVMe drive. **Network**: 10 to 100 Gbps per card. **Failure**: a server fails about once every 3 years on average, and when it does, everything on it stops.',
        'Our shop is hitting the first one: CPU. The fix you pick depends on which limit you hit, so always find the bottleneck before you buy hardware.',
        'The last limit matters even when performance is fine. Even an infinitely fast machine would still need a second machine for the day the first one dies.',
      ],
      keyIdea: 'Distributed systems answer one of five limits: CPU, RAM, disk, network or failure. Name the one you are hitting.',
      metrics: { traffic: '6K QPS', cpu: '95%', p99: '2.1 s', servers: '1', db: '2.4K reads/s' },
      scene: {
        nodes: [users, { ...app, status: 'hot', badge: 'CPU · RAM · disk · net · failure' }, db],
        links: [
          { from: 'users', to: 'app' },
          { from: 'app', to: 'db' },
        ],
        flows: [
          { path: ['users', 'app'], tone: 'request', count: 8, duration: 1.4 },
          { path: ['app', 'db'], tone: 'request', count: 3, duration: 1, delay: 0.6 },
        ],
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
      scene: {
        nodes: [users, { ...app, size: 1.4, status: 'ok', label: 'big server', sub: '128 cores · 1 TB', badge: 'CPU 30%' }, db],
        links: [
          { from: 'users', to: 'app' },
          { from: 'app', to: 'db' },
        ],
        flows: [
          { path: ['users', 'app'], tone: 'request', count: 4, duration: 1.4 },
          { path: ['app', 'users'], tone: 'response', count: 4, duration: 1.4, delay: 1.5 },
        ],
      },
    },
    {
      title: 'The ceiling',
      tag: 'tradeoff',
      heading: 'Where scaling up runs out',
      eli5: 'Even the biggest super clerk gets swamped when the crowd keeps growing, and no bigger clerk exists to hire. If that one clerk takes a break, the shop closes. That makes the clerk a **single point of failure**.',
      body: [
        'Growth continues. At **20K QPS** the big box is pegged at 100% and p99 is 3.5 seconds. You can buy one more size up, but prices grow faster than capacity, and eventually there is no bigger box to buy.',
        'Worse, it is still one box. A kernel patch means a reboot, and a reboot means the whole shop is offline. A single machine cannot give you 99.9% uptime, however big it is.',
        'Scaling up delays the problem. It does not remove the single point of failure, and it has a hard ceiling.',
      ],
      keyIdea: 'Vertical scaling has a ceiling on size and on availability. Past it, you need more machines.',
      metrics: { traffic: '20K QPS', cpu: '100%', p99: '3.5 s', servers: '1 (max)', db: '7K reads/s' },
      scene: {
        nodes: [users, { ...app, size: 1.4, status: 'hot', label: 'big server', sub: '128 cores · 1 TB', badge: 'largest size · CPU 100%' }, db],
        links: [
          { from: 'users', to: 'app' },
          { from: 'app', to: 'db' },
        ],
        flows: [
          { path: ['users', 'app'], tone: 'request', count: 12, duration: 1.2 },
          { path: ['app', 'users'], tone: 'error', label: 'timeout', count: 2, duration: 1.6, delay: 1.3 },
        ],
        caption: 'One box, as big as it gets',
      },
    },
    {
      title: 'Stateless first',
      tag: 'concept',
      heading: 'Before adding servers, move the state out',
      eli5: 'With two clerks, the second one does not know you, because the first kept your name in their head. A **stateless** clerk keeps nothing in their head. It all goes in Redis, one shared notebook that every clerk reads.',
      body: [
        'The obvious next move: put a **load balancer** in front and run a second big box. Within minutes, support tickets arrive. Customers get logged out and their carts vanish, at random.',
        'The cause: each server kept login sessions in its own memory. When the load balancer sends your next request to the other server, it has never heard of you.',
        'The fix is to make app servers **stateless**. Sessions, carts and uploads go to a shared store such as Redis, a database or object storage. Any server can then handle any request, and you can add or remove servers freely.',
      ],
      keyIdea: 'A server you can add or kill at any moment holds no state of its own. Move state to a shared store first.',
      metrics: { traffic: '20K QPS', cpu: '50%', p99: '95 ms', servers: '2 (big)', db: '7K reads/s' },
      scene: {
        nodes: [
          users,
          { ...lb, status: 'active' },
          { ...app, size: 1.4, label: 'big server 1', sub: '128 cores' },
          { ...app2, size: 1.4, label: 'big server 2', sub: '128 cores', status: 'hot', badge: 'who are you?' },
          db,
          { ...redis, status: 'ok', badge: 'shared sessions' },
        ],
        links: [
          { from: 'users', to: 'lb' },
          { from: 'lb', to: 'app' },
          { from: 'lb', to: 'app2' },
          { from: 'app', to: 'db' },
          { from: 'app', to: 'redis', style: 'dashed' },
          { from: 'app2', to: 'redis', style: 'dashed' },
        ],
        flows: [
          { path: ['users', 'lb', 'app2'], tone: 'request', label: 'GET /cart', duration: 1.6 },
          { path: ['app2', 'lb', 'users'], tone: 'error', label: 'please log in', duration: 1.6, delay: 1.7 },
          { path: ['app2', 'redis', 'app2'], tone: 'data', label: 'session lookup', duration: 1.4, delay: 3.4 },
        ],
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
        '**Horizontal scaling** means adding more machines of the same size. With state in Redis, the servers are interchangeable, so they can also be cheap commodity boxes. Five 32-core servers each take about 4K QPS at 55% CPU.',
        'The load balancer spreads requests (least-connections is a good default) and runs **health checks**. A server that stops answering leaves the rotation within seconds. Deploys roll one server at a time with no downtime.',
        'Need more capacity next month? Add a sixth box. Cost now grows in a straight line with traffic, and an autoscaler can do the adding for you.',
      ],
      keyIdea: 'Stateless servers behind a load balancer scale by adding boxes. Capacity and cost grow together, one box at a time.',
      metrics: { traffic: '20K QPS', cpu: '55%', p99: '85 ms', servers: '5', db: '8K reads/s' },
      scene: {
        nodes: [users, { ...lb, status: 'active' }, ...fleet('+2 more · 4K QPS each'), db, redis],
        links: [...fleetLinks, { from: 'users', to: 'lb' }, { from: 'app', to: 'db' }, { from: 'app', to: 'redis', style: 'dashed' }],
        flows: [
          { path: ['users', 'lb'], tone: 'request', count: 5, duration: 1 },
          { path: ['lb', 'app2'], tone: 'request', duration: 0.8, delay: 1 },
          { path: ['lb', 'app'], tone: 'request', count: 3, duration: 0.8, delay: 1.2 },
          { path: ['lb', 'app3'], tone: 'request', duration: 0.8, delay: 1.4 },
        ],
        caption: 'Five interchangeable servers, one front door',
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
      eli5: 'Clerk app 3 goes home sick in the night. The greeter, the load balancer, notices and sends shoppers to the other four, who have spare energy for this. That spare energy is called **headroom**.',
      body: [
        'A disk fails and app 3 stops answering. The load balancer misses two health checks, takes it out of rotation, and spreads its traffic over the other four.',
        'Each survivor now takes 5K QPS at 70% CPU. p99 rises from 85 ms to 110 ms and nobody gets paged for an outage. This is why the sizing formula doubles the server count: you plan for **headroom**. N+1 (one spare) is the minimum, and many teams run 2N.',
        'With the single big box, the same disk failure would have taken the whole shop offline.',
      ],
      keyIdea: 'Horizontal scaling buys availability as well as capacity. Size the fleet so it still copes with a node missing.',
      metrics: { traffic: '20K QPS', cpu: '70%', p99: '110 ms', servers: '4 of 5', db: '8K reads/s' },
      scene: {
        nodes: [
          users,
          { ...lb, status: 'active', badge: 'health check failed' },
          ...fleet('+2 more · 5K QPS each').map((n) => (n.id === 'app3' ? { ...n, status: 'down' as const, badge: 'down' } : n)),
          db,
          redis,
        ],
        links: [...fleetLinks.map((l) => (l.to === 'app3' ? { ...l, style: 'faint' as const } : l)), { from: 'users', to: 'lb' }, { from: 'app', to: 'db' }],
        flows: [
          { path: ['lb', 'app3'], tone: 'error', label: 'no reply', duration: 1 },
          { path: ['users', 'lb'], tone: 'request', count: 4, duration: 1, delay: 0.4 },
          { path: ['lb', 'app2'], tone: 'request', count: 2, duration: 0.8, delay: 1.4 },
          { path: ['lb', 'app'], tone: 'request', count: 3, duration: 0.8, delay: 1.6 },
        ],
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
      title: 'Five levers',
      tag: 'concept',
      heading: 'The database is the next hot box',
      eli5: 'The clerks are fine now, but they all crowd into one stockroom, the database. You cannot hire a copy of it the way you hired clerks, because it holds the real toys. Fixing it takes the **five levers**.',
      body: [
        'A holiday sale pushes traffic to **26K QPS**. The app tier is fine at 70% CPU. The database is not: it now sees 10.4K reads per second, past the ~10K that one Postgres node handles, and p99 jumps to 900 ms.',
        'You cannot clone the database the way you cloned the app servers, because it holds the state. This is where the **five levers** come in. Every design is some combination of them: **partition** (split data so each node owns a slice), **replicate** (copy data for reads and survival), **cache** (keep hot data in RAM), **asynchronize** (answer now, do the work later), and **localize** (move data close to users).',
        'Each lever has a price: cross-shard queries, replication lag, stale reads, eventual consistency, or multi-region complexity. When you are stuck, ask which lever you have not pulled yet.',
      ],
      keyIdea: 'Stateless tiers scale by cloning. Stateful tiers scale with five levers: partition, replicate, cache, asynchronize, localize.',
      metrics: { traffic: '26K QPS', cpu: '70%', p99: '900 ms', servers: '5', db: '10.4K reads/s' },
      scene: {
        nodes: [users, lb, ...fleet(), { ...db, status: 'hot', badge: '10.4K reads/s · limit ~10K' }, redis],
        links: [...fleetLinks, { from: 'users', to: 'lb' }, { from: 'app', to: 'db' }, { from: 'app2', to: 'db' }, { from: 'app3', to: 'db' }],
        flows: [
          { path: ['users', 'lb'], tone: 'request', count: 6, duration: 1 },
          { path: ['app', 'db'], tone: 'request', count: 3, duration: 1.2, delay: 0.5 },
          { path: ['app2', 'db'], tone: 'request', count: 3, duration: 1.2, delay: 0.7 },
          { path: ['app3', 'db'], tone: 'request', count: 3, duration: 1.2, delay: 0.9 },
        ],
        caption: 'Five app servers, one database',
      },
    },
    {
      title: 'Read levers',
      tag: 'case',
      heading: 'Case: cache and replicate the reads',
      eli5: 'The clerks copy the most-asked toy facts into Redis, the shared notebook, so they rarely walk to the stockroom. That quick copy is a **cache**. A second stockroom, the read replica, copies the first and helps with the looking.',
      body: [
        'Most of the load is reads of product pages, which are the same for everyone. Pull the **cache** lever: Redis already holds sessions, so it also keeps hot products. It answers 90% of reads, and database reads drop to about 1K per second.',
        'Then pull **replicate**: a read replica takes a copy of every write and serves the reads the cache misses. If the primary dies, the replica can be promoted in about 30 seconds.',
        'The costs are real. A cached price can be a minute stale, and a replica lags the primary by milliseconds to seconds. Checkout and payment keep reading from the primary.',
      ],
      keyIdea: 'For read-heavy load, cache first and replicate second. Both trade a little freshness for a lot of capacity.',
      metrics: { traffic: '26K QPS', cpu: '70%', p99: '70 ms', servers: '5', db: '1K reads/s' },
      scene: {
        nodes: [
          users,
          lb,
          ...fleet(),
          { ...db, status: 'ok', badge: '1K reads/s' },
          { ...redis, label: 'Redis', sub: 'sessions + products', status: 'active', badge: '90% hit' },
          { ...replica, status: 'active', badge: 'lag ~50 ms' },
        ],
        links: [
          ...fleetLinks,
          { from: 'users', to: 'lb' },
          { from: 'app', to: 'redis' },
          { from: 'app', to: 'db' },
          { from: 'db', to: 'replica', style: 'dashed', label: 'replication' },
        ],
        flows: [
          { path: ['app', 'redis', 'app'], tone: 'request', label: 'GET product', count: 4, duration: 1.2 },
          { path: ['app', 'db', 'app'], tone: 'request', label: 'miss', duration: 1.6, delay: 1 },
          { path: ['db', 'replica'], tone: 'data', label: 'WAL', count: 2, duration: 1.2, delay: 0.5 },
        ],
      },
    },
    {
      title: 'Write levers',
      tag: 'tradeoff',
      heading: 'Partition the writes, defer the slow work',
      eli5: 'New deliveries still all go into one stockroom. To **partition** is to split it in two: shard A for kids named A to L, shard B for M to Z. Slow chores like gift wrapping go in a basket, the job queue, for workers to do later.',
      body: [
        'Caches and replicas do nothing for writes. Every replica must apply every write, so the primary still takes all 2.6K writes per second, and one Postgres node tops out around 5K. Next year\'s growth breaks it.',
        '**Partition** is the lever that adds write capacity. Split users by `user_id` into shards, so shard A owns half the users and shard B the other half. Each shard takes 1.3K writes per second. The cost: queries across users now touch every shard, and moving data between shards later is hard.',
        '**Asynchronize** the side effects. Order confirmation emails and image resizing go on a queue and run on workers, so checkout returns as soon as the order is saved. The fifth lever, **localize**, moves data near far-away users. It gets its own lesson.',
      ],
      keyIdea: 'Only partitioning adds write capacity. Async work makes responses fast by doing less while the user waits.',
      metrics: { traffic: '26K QPS', cpu: '65%', p99: '60 ms', servers: '5', db: '1.3K writes/s per shard' },
      scene: {
        nodes: [
          users,
          lb,
          ...fleet(),
          { ...db, label: 'shard A', sub: 'users A to L', status: 'ok', badge: '1.3K writes/s' },
          { ...shardB, status: 'ok', badge: '1.3K writes/s' },
          { ...redis, sub: 'sessions + products' },
          { ...replica, status: 'dim' },
          { ...queue, status: 'active', badge: 'emails · thumbnails' },
          { ...worker, status: 'active' },
        ],
        links: [
          ...fleetLinks,
          { from: 'users', to: 'lb' },
          { from: 'app', to: 'db' },
          { from: 'app2', to: 'shardB' },
          { from: 'db', to: 'replica', style: 'faint' },
          { from: 'app3', to: 'queue' },
          { from: 'queue', to: 'worker' },
        ],
        flows: [
          { path: ['app', 'db'], tone: 'request', label: 'user Ana', duration: 1.2 },
          { path: ['app2', 'shardB'], tone: 'request', label: 'user Zoe', duration: 1.2, delay: 0.3 },
          { path: ['app3', 'queue'], tone: 'event', label: 'send email', duration: 1.2, delay: 0.6 },
          { path: ['queue', 'worker'], tone: 'event', duration: 1.2, delay: 1.9 },
        ],
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Up, then out, then pull the levers',
      eli5: 'First try a bigger clerk, then hire more clerks behind a greeter. For the stockroom, pull the **five levers**: split it, copy it, keep favorites close, do chores later, and open shops near faraway kids.',
      body: [
        'Scale **up** first when you can. It costs no code, but it has a size ceiling and stays a single point of failure. Scale **out** next: make app servers stateless, put them behind a load balancer, and size the fleet with headroom for a lost node.',
        'The stateful tier needs the five levers. Cache and replicate for reads, partition for writes and data size, asynchronize slow work, and localize for distant users. Each one buys capacity and charges you in consistency or complexity.',
      ],
      keyIdea: 'Clone the stateless parts, and pull the right lever for the stateful parts. Know what each lever costs before you pull it.',
      metrics: { traffic: '26K QPS', cpu: '65%', p99: '60 ms', servers: '5', db: '1.3K writes/s per shard' },
      scene: {
        nodes: [
          users,
          { ...lb, status: 'ok' },
          ...fleet(),
          { ...db, label: 'shard A', sub: 'users A to L' },
          shardB,
          { ...redis, sub: 'sessions + products' },
          replica,
          queue,
          worker,
        ],
        links: [
          ...fleetLinks,
          { from: 'users', to: 'lb' },
          { from: 'app', to: 'redis' },
          { from: 'app', to: 'db' },
          { from: 'app2', to: 'shardB' },
          { from: 'db', to: 'replica', style: 'dashed' },
          { from: 'app3', to: 'queue' },
          { from: 'queue', to: 'worker' },
        ],
        flows: [
          { path: ['users', 'lb', 'app'], tone: 'request', count: 3, duration: 1.4 },
          { path: ['app', 'redis', 'app'], tone: 'request', duration: 1.2, delay: 1.5 },
          { path: ['app', 'lb', 'users'], tone: 'response', count: 3, duration: 1.4, delay: 2.8 },
          { path: ['app3', 'queue', 'worker'], tone: 'event', duration: 2, delay: 1 },
        ],
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
