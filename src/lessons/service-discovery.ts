import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place a node by screen column (sx) and screen row (sy). Same sy = one horizontal row on screen. */
const p = (sx: number, sy: number): [number, number] => [(sy + sx) / 2, (sy - sx) / 2];

const orders: SceneNode = { id: 'orders', kind: 'service', at: p(-7.5, 0), label: 'orders', sub: 'the caller' };
const registry: SceneNode = { id: 'registry', kind: 'search', at: p(-3.5, -4.5), label: 'registry', sub: 'name → addresses' };
const router: SceneNode = { id: 'router', kind: 'lb', at: p(-3.5, 2), label: 'load balancer', sub: 'payments.internal' };
const dns: SceneNode = { id: 'dns', kind: 'dns', at: p(-3.5, -4.5), label: 'DNS server', sub: 'payments.internal' };
const p1: SceneNode = { id: 'p1', kind: 'server', at: p(0.5, -3), label: 'payments 1', sub: '10.0.1.5' };
const p2: SceneNode = { id: 'p2', kind: 'server', at: p(3.5, 0), label: 'payments 2', sub: '10.0.1.6' };
const p3: SceneNode = { id: 'p3', kind: 'server', at: p(6.5, 3), label: 'payments 3', sub: '10.0.1.7' };
const p4: SceneNode = { id: 'p3', kind: 'server', at: p(6.5, 3), label: 'payments 4', sub: '10.0.1.9' };

const direct: SceneLink[] = [
  { from: 'orders', to: 'p1' },
  { from: 'orders', to: 'p2' },
  { from: 'orders', to: 'p3' },
];
const lookup: SceneLink = { from: 'orders', to: 'registry', style: 'dashed', label: 'lookup' };
const registrations: SceneLink[] = [
  { from: 'p1', to: 'registry', style: 'faint' },
  { from: 'p2', to: 'registry', style: 'faint' },
  { from: 'p3', to: 'registry', style: 'faint' },
];
const viaRouter: SceneLink[] = [
  { from: 'orders', to: 'router' },
  { from: 'router', to: 'p1' },
  { from: 'router', to: 'p2' },
  { from: 'router', to: 'p3' },
  { from: 'router', to: 'registry', style: 'dashed', label: 'watch' },
];

export const serviceDiscovery: Lesson = {
  id: 'service-discovery',
  title: 'Service discovery and health checks',
  tagline: 'How services find each other when addresses change every hour, and how dead instances get taken off the list.',
  minutes: 14,
  level: 'Intermediate',
  learn: [
    'Why hard-coded addresses fail once instances come and go',
    'What a service registry stores and who writes to it',
    'Client-side versus server-side discovery',
    'DNS-based discovery and its caching problem',
    'Heartbeats, TTLs and how fast a dead instance is noticed',
    'Liveness versus readiness checks',
    'What Consul, etcd, ZooKeeper and Kubernetes Services each provide',
  ],
  metrics: [
    { key: 'live', label: 'Live instances' },
    { key: 'listed', label: 'Listed' },
    { key: 'err', label: 'Failed calls' },
    { key: 'detect', label: 'Time to notice' },
  ],
  steps: [
    {
      title: 'Hard-coded',
      tag: 'problem',
      heading: 'The address in the config file is dead',
      eli5: 'A pupil has a note that says "the maths teacher is in room 5". The teacher moved to room 9 last night. The pupil keeps knocking on an empty room. **Orders** is the pupil holding the old note.',
      body: [
        'The orders service calls the payments service. Its config file lists three payment servers by IP address: `10.0.1.5`, `10.0.1.6` and `10.0.1.7`. That worked while servers were long-lived machines someone set up by hand.',
        'Now an autoscaler and rolling deploys replace instances many times a day. Last night `10.0.1.7` was terminated and a new instance came up at `10.0.1.9`. Nobody told orders.',
        'Orders still sends every third request to the dead address and waits for a timeout. One third of payment calls fail, and the brand-new instance at `.9` sits idle. Fixing it means editing config and redeploying every caller, each time anything moves.',
      ],
      keyIdea: 'In a system where instances come and go, an address written into config is wrong within hours.',
      metrics: { live: '3', listed: '3 (1 wrong)', err: '33%', detect: 'never' },
      scene: {
        nodes: [
          { ...orders, status: 'hot', badge: 'config: .5 .6 .7' },
          { ...p1, status: 'ok' },
          { ...p2, status: 'ok' },
          { ...p3, status: 'down', badge: 'terminated' },
        ],
        links: direct,
        flows: [
          { path: ['orders', 'p1', 'orders'], tone: 'response', duration: 1.8 },
          { path: ['orders', 'p2', 'orders'], tone: 'response', duration: 1.8, delay: 0.5 },
          { path: ['orders', 'p3'], tone: 'request', label: 'POST /charge', duration: 1.4, delay: 1 },
          { path: ['p3', 'orders'], tone: 'error', label: 'timeout', duration: 2.4, delay: 2.5 },
        ],
        caption: 'One of three hard-coded addresses no longer exists',
      },
      code: {
        language: 'yaml',
        title: 'orders/config.yaml: the problem',
        source: `payments:
  timeout_ms: 2000
  hosts:
    - 10.0.1.5:8080
    - 10.0.1.6:8080
    - 10.0.1.7:8080     # terminated last night; its replacement is 10.0.1.9`,
        highlight: [6],
      },
    },
    {
      title: 'The registry',
      tag: 'concept',
      heading: 'A registry: one live list of who is where',
      eli5: 'The school office keeps a board: each teacher writes their room number on it when they arrive and wipes it off when they leave. Pupils check the board. The **registry** is that board.',
      body: [
        'A **service registry** is a small, highly available database that maps a service name to the addresses of its live instances: `payments → 10.0.1.5:8080, 10.0.1.6:8080, 10.0.1.9:8080`.',
        'Instances keep it current. On startup an instance **registers** its name, IP and port. On a clean shutdown it **deregisters**. This can be done by the instance itself or by the platform that launched it.',
        'Callers stop storing addresses and store a name. **Service discovery** is the act of turning that name into a live address at call time. There are two places to do the lookup: in the client, or in something that sits in front of the service.',
      ],
      keyIdea: 'A registry replaces addresses in config with a name that is resolved at run time against a live list.',
      metrics: { live: '3', listed: '3', err: '0%', detect: '-' },
      scene: {
        nodes: [
          orders,
          { ...registry, status: 'active', badge: 'payments: 3 live' },
          { ...p1, status: 'ok' },
          { ...p2, status: 'ok' },
          { ...p4, status: 'active', badge: 'new: registers' },
        ],
        links: [lookup, ...registrations],
        flows: [
          { path: ['p3', 'registry'], tone: 'event', label: 'register payments 10.0.1.9', duration: 1.8 },
          { path: ['orders', 'registry'], tone: 'request', label: 'where is payments?', duration: 1.4, delay: 2 },
          { path: ['registry', 'orders'], tone: 'response', label: '.5 .6 .9', duration: 1.4, delay: 3.5 },
        ],
        caption: 'Instances write to the registry, callers read from it',
      },
    },
    {
      title: 'Client-side',
      tag: 'concept',
      heading: 'Client-side discovery: the caller picks an instance',
      eli5: 'The pupil reads the board, copies the room numbers into a notebook and walks straight to one of the rooms. No one else is in the way. **Orders** is the pupil with the notebook.',
      body: [
        'In **client-side discovery** the caller asks the registry for the list, keeps it in memory, and picks an instance itself, for example by round robin. The request goes straight from orders to a payments instance.',
        'There is no extra network hop and no shared load balancer to scale or to fail. The client can also be smart: skip an instance that just timed out, prefer one in the same zone.',
        'The price is that every caller needs this logic. With services in three languages you maintain three discovery libraries, and a bug fix means redeploying every service. The client also caches the list, so it must refresh often or subscribe to changes.',
      ],
      keyIdea: 'Client-side discovery has no middleman and no extra hop, and it puts registry and balancing logic into every caller.',
      metrics: { live: '3', listed: '3', err: '0%', detect: '-' },
      scene: {
        nodes: [
          { ...orders, status: 'active', badge: 'cached list, picks one' },
          registry,
          p1,
          { ...p2, status: 'active' },
          p4,
        ],
        links: [lookup, ...direct],
        flows: [
          { path: ['orders', 'registry', 'orders'], tone: 'handshake', label: 'refresh every 5 s', duration: 2 },
          { path: ['orders', 'p2'], tone: 'request', label: 'POST /charge', duration: 1.4, delay: 2.2 },
          { path: ['p2', 'orders'], tone: 'response', duration: 1.4, delay: 3.7 },
        ],
        caption: 'Look up, then call the instance directly',
      },
      code: {
        language: 'typescript',
        title: 'Client-side discovery with a cached list',
        source: `let cached: string[] = [];
let fetchedAt = 0;

async function paymentsInstances(): Promise<string[]> {
  if (Date.now() - fetchedAt > 5_000) {                  // refresh every 5 s
    try {
      const res = await fetch('http://registry.internal/v1/services/payments?healthy=true');
      cached = await res.json();                         // ["10.0.1.5:8080", ...]
      fetchedAt = Date.now();
    } catch {
      // Registry unreachable: keep using the last known list.
    }
  }
  return cached;
}

let next = 0;
export async function charge(body: unknown) {
  const list = await paymentsInstances();
  const target = list[next++ % list.length];             // round robin
  return fetch(\`http://\${target}/charge\`, { method: 'POST', body: JSON.stringify(body) });
}`,
        highlight: [5, 7, 8, 11, 20],
      },
    },
    {
      title: 'Server-side',
      tag: 'concept',
      heading: 'Server-side discovery: call one stable address',
      eli5: 'Now the pupil just goes to the front desk and says "maths, please". The person at the desk reads the board and walks them to the right room. The **load balancer** is the front desk.',
      body: [
        'In **server-side discovery** the caller sends requests to one stable address, such as `payments.internal`, that belongs to a load balancer or gateway. That component watches the registry and forwards each request to a live instance.',
        'Callers stay simple: an ordinary HTTP client in any language. Routing rules, retries and health logic live in one place and can change without touching the callers.',
        'In exchange you add a network hop to every call, and the load balancer becomes something that must itself be redundant and scaled. This is the model from the load balancing and API gateway lessons. Now you know where their list of backends comes from.',
      ],
      keyIdea: 'Server-side discovery moves the lookup into a load balancer, keeping callers simple at the cost of one more hop.',
      metrics: { live: '3', listed: '3', err: '0%', detect: '-' },
      scene: {
        nodes: [
          { ...orders, badge: 'knows one name' },
          registry,
          { ...router, status: 'active', badge: 'picks an instance' },
          p1,
          p2,
          { ...p4, status: 'active' },
        ],
        links: [...viaRouter, ...registrations],
        flows: [
          { path: ['registry', 'router'], tone: 'data', label: 'list changed', duration: 1.4 },
          { path: ['orders', 'router', 'p3'], tone: 'request', label: 'POST /charge', duration: 1.8, delay: 1.5 },
          { path: ['p3', 'router', 'orders'], tone: 'response', duration: 1.8, delay: 3.4 },
        ],
        caption: 'The load balancer does the lookup for everyone',
      },
    },
    {
      title: 'DNS',
      tag: 'concept',
      heading: 'DNS-based discovery: the registry you already have',
      eli5: 'The school phone book also lists rooms, and everyone already knows how to use it. But pupils copy a number down and keep using it for a while, even after the room has changed. The **DNS server** is the phone book.',
      body: [
        'DNS already maps names to addresses, and every language can resolve a name. Publish one **A record** per live instance under `payments.internal`, and callers get the current set of IPs. **SRV records** can carry the port as well.',
        'The weakness is caching. Each answer carries a TTL, and resolvers, operating systems and client libraries hold on to it. Some runtimes cache a lookup for the life of the process unless configured otherwise. With a 30-second TTL, a removed instance can keep receiving traffic for 30 seconds or more.',
        'Plain DNS also knows nothing about health, and many clients just use the first address returned. So DNS discovery works best when the records point at something stable, such as a load balancer or a virtual IP, and when TTLs are short.',
      ],
      keyIdea: 'DNS is universal and simple, and its caching means changes spread slowly. Keep TTLs short and point names at stable things.',
      metrics: { live: '3', listed: '3 + 1 cached', err: 'up to 25%', detect: '30 s (TTL)' },
      scene: {
        nodes: [
          { ...orders, status: 'hot', badge: 'cached .7 for 30 s' },
          { ...dns, status: 'active', badge: 'A: .5 .6 .9' },
          p1,
          p2,
          { ...p4, badge: 'new, not yet seen' },
        ],
        links: [{ from: 'orders', to: 'dns', style: 'dashed', label: 'resolve' }, { from: 'orders', to: 'p1' }, { from: 'orders', to: 'p2' }],
        flows: [
          { path: ['orders', 'dns'], tone: 'request', label: 'payments.internal?', duration: 1.4 },
          { path: ['dns', 'orders'], tone: 'response', label: 'TTL 30', duration: 1.4, delay: 1.5 },
          { path: ['orders', 'p1', 'orders'], tone: 'response', duration: 1.8, delay: 3 },
          { path: ['orders', 'p2', 'orders'], tone: 'response', duration: 1.8, delay: 3.4 },
        ],
        caption: 'The answer is right, the cached copy is old',
      },
      quiz: {
        question: 'Your services are written in four languages, and you want callers to stay as simple as possible. Which discovery style fits best?',
        options: [
          'Client-side discovery with a library per language',
          'Server-side discovery: callers use one stable name, a load balancer finds the instances',
          'Hard-coded IP lists refreshed by a nightly script',
          'DNS with a 24-hour TTL',
        ],
        answer: 1,
        explain: 'Server-side discovery keeps lookup and balancing in one component, so callers need only a plain HTTP client. Client-side discovery would mean four libraries to maintain.',
      },
    },
    {
      title: 'Heartbeats',
      tag: 'concept',
      heading: 'Heartbeats and TTLs: crashed instances cannot say goodbye',
      eli5: 'Every few minutes each teacher phones the office to say "still here". If the office hears nothing for a while, it wipes that teacher off the board. The **registry** is listening for those calls.',
      body: [
        'A clean shutdown deregisters. A crash, a killed VM or a cut network cable does not. The registry would list the dead instance forever.',
        'So registrations expire. Each instance sends a **heartbeat** every 10 seconds, which renews a **TTL** (a lease) of 30 seconds on its entry. If three heartbeats in a row are missed, the lease runs out and the registry removes the entry by itself.',
        'The two numbers are a trade-off. A dead instance stays listed for up to 30 seconds, and with three instances that is a third of calls failing unless callers retry on another instance. Shorter TTLs notice faster, and they also evict healthy instances after one slow network moment or a long pause.',
      ],
      keyIdea: 'Entries must expire unless renewed. The TTL sets how long a crashed instance keeps receiving traffic.',
      metrics: { live: '2', listed: '3', err: '33%', detect: '30 s' },
      scene: {
        nodes: [
          orders,
          { ...registry, status: 'active', badge: 'payments 1: lease 4 s left' },
          { ...p1, status: 'down', badge: 'crashed' },
          { ...p2, status: 'ok' },
          { ...p4, status: 'ok' },
        ],
        links: [lookup, ...registrations],
        flows: [
          { path: ['p2', 'registry'], tone: 'handshake', label: 'heartbeat', duration: 1.4 },
          { path: ['p3', 'registry'], tone: 'handshake', label: 'heartbeat', duration: 1.6, delay: 0.5 },
          { path: ['registry', 'orders'], tone: 'event', label: 'payments 1 expired', duration: 1.6, delay: 2.4 },
        ],
        caption: 'No heartbeat for 30 seconds, entry removed',
      },
    },
    {
      title: 'Health checks',
      tag: 'concept',
      heading: 'Liveness and readiness are different questions',
      eli5: 'Two questions about a teacher. "Is the teacher okay?" If not, send a new one. "Is the teacher ready for pupils?" If they are still unpacking, wait and send nobody in yet. The **load balancer** asks the second question.',
      body: [
        'A heartbeat says the process exists. It does not say the instance can do useful work. **Health checks** ask directly, usually with an HTTP endpoint that something probes every few seconds.',
        '**Liveness** asks: is this process stuck beyond repair, for example deadlocked? If the check keeps failing, the platform **restarts** the instance. **Readiness** asks: can it serve traffic right now? If that fails, the instance is **taken out of the list** and left running, then put back when it passes.',
        'Keep them separate. A new instance that is still loading a 20-second cache is alive and not ready. If a liveness check depended on the database, one database blip would restart every instance at once and turn a short error into a full outage.',
      ],
      keyIdea: 'Failing liveness means restart me. Failing readiness means stop sending me traffic for now.',
      metrics: { live: '2 ready, 1 warming', listed: '2', err: '0%', detect: '6 s' },
      scene: {
        nodes: [
          orders,
          { ...registry, badge: 'payments: 2 ready' },
          { ...router, status: 'active', badge: 'probe every 2 s' },
          { ...p1, status: 'ok', badge: 'ready' },
          { ...p2, status: 'ok', badge: 'ready' },
          { ...p4, status: 'dim', badge: 'alive, warming up' },
        ],
        links: viaRouter,
        flows: [
          { path: ['router', 'p1', 'router'], tone: 'handshake', label: '/ready 200', duration: 1.6 },
          { path: ['router', 'p3'], tone: 'handshake', label: '/ready', duration: 1.2, delay: 0.4 },
          { path: ['p3', 'router'], tone: 'error', label: '503 not yet', duration: 1.2, delay: 1.7 },
          { path: ['orders', 'router', 'p2'], tone: 'request', count: 3, duration: 1.8, delay: 3 },
        ],
        caption: 'Alive is one check, ready for traffic is another',
      },
      code: {
        language: 'yaml',
        title: 'Kubernetes probes on the payments container',
        source: `containers:
  - name: payments
    image: shop/payments:4.2.0
    ports:
      - containerPort: 8080
    livenessProbe:               # failing -> the kubelet restarts the container
      httpGet: { path: /healthz, port: 8080 }
      periodSeconds: 10
      failureThreshold: 3
    readinessProbe:              # failing -> removed from the Service's endpoints
      httpGet: { path: /ready, port: 8080 }
      periodSeconds: 2
      failureThreshold: 3        # out of rotation after about 6 s`,
        highlight: [6, 10, 12, 13],
      },
    },
    {
      title: 'Registry down',
      tag: 'case',
      heading: 'Case: the registry itself goes dark',
      eli5: 'One day the office board falls off the wall. Pupils who kept their notebook can still find their teachers. Pupils who threw the notebook away and trusted only the board are lost. **Orders** kept its notebook.',
      body: [
        'Every service depends on the registry, so its failure is the one that can stop everything. Two defenses are standard.',
        'First, run the registry as a cluster of 3 or 5 nodes that agree on changes through a **consensus** protocol. It keeps working as long as a majority is up, so 3 nodes survive one failure and 5 survive two.',
        'Second, callers and load balancers **cache the last known list** and keep using it when the registry cannot be reached. Existing instances stay reachable. Only changes are missed. The dangerous design is the opposite one: treating "registry unreachable" as "zero instances" and dropping every backend at once.',
      ],
      keyIdea: 'Run the registry as a quorum cluster, and make clients fall back to their last known list when it is unreachable.',
      metrics: { live: '3', listed: '3 (cached)', err: '0%', detect: 'paused' },
      scene: {
        nodes: [
          { ...orders, status: 'ok', badge: 'using cached list' },
          { ...registry, status: 'down', badge: 'unreachable' },
          { ...p1, status: 'ok' },
          { ...p2, status: 'ok' },
          { ...p4, status: 'ok' },
        ],
        links: [lookup, ...direct],
        flows: [
          { path: ['orders', 'registry'], tone: 'request', label: 'refresh', duration: 1.2 },
          { path: ['registry', 'orders'], tone: 'error', label: 'no answer', duration: 1.2, delay: 1.3 },
          { path: ['orders', 'p1', 'orders'], tone: 'response', duration: 1.8, delay: 2.6 },
          { path: ['orders', 'p2', 'orders'], tone: 'response', duration: 1.8, delay: 3 },
          { path: ['orders', 'p3', 'orders'], tone: 'response', duration: 1.8, delay: 3.4 },
        ],
        caption: 'Stale data beats no data',
      },
    },
    {
      title: 'The tools',
      tag: 'tradeoff',
      heading: 'What Consul, etcd, ZooKeeper and Kubernetes give you',
      eli5: 'Different schools run the office in different ways. One has a full office with a nurse who checks on teachers. Another just has a very reliable board and expects you to do the rest. The **registry** box can be any of them.',
      body: [
        '**Consul** is a purpose-built registry: a service catalog, built-in health checks run by an agent on each machine, and both an HTTP API and a DNS interface for lookups. Its servers replicate with Raft.',
        '**etcd** and **ZooKeeper** are consistent key-value stores that you build discovery on. In etcd, a key is attached to a **lease** and disappears when the lease is not renewed, and clients **watch** a prefix for changes. In ZooKeeper, an instance creates an **ephemeral node** that vanishes when its session ends. Both give you the heartbeat and TTL pattern as a primitive, and you write the rest.',
        '**Kubernetes** does it for you. A **Service** gives a set of pods one stable virtual IP and a DNS name such as `payments.shop.svc.cluster.local`. The control plane (which stores its state in etcd) adds a pod to the Service\'s endpoints only while it passes its readiness probe. That is server-side discovery with DNS on top.',
      ],
      keyIdea: 'Consul is a ready-made registry, etcd and ZooKeeper are building blocks, and a Kubernetes Service is discovery built into the platform.',
      metrics: { live: '3', listed: '3', err: '0%', detect: '6 s' },
      scene: {
        nodes: [
          { ...orders, badge: 'calls payments by name' },
          { ...registry, status: 'active', label: 'control plane', sub: 'endpoints in etcd', badge: 'ready pods only' },
          { ...router, status: 'active', label: 'Service', sub: 'stable virtual IP' },
          { ...p1, status: 'ok', label: 'pod 1' },
          { ...p2, status: 'ok', label: 'pod 2' },
          { ...p4, status: 'ok', label: 'pod 3' },
        ],
        links: viaRouter,
        flows: [
          { path: ['registry', 'router'], tone: 'data', label: 'endpoints update', duration: 1.4 },
          { path: ['orders', 'router', 'p1'], tone: 'request', duration: 1.8, delay: 1.5 },
          { path: ['orders', 'router', 'p2'], tone: 'request', duration: 1.8, delay: 1.9 },
          { path: ['orders', 'router', 'p3'], tone: 'request', duration: 1.8, delay: 2.3 },
        ],
        caption: 'A Kubernetes Service: stable name, changing pods',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Names in config, addresses at run time',
      eli5: 'Teachers write their room on the office board, phone in to say "still here", and say when they are ready for pupils. Pupils ask the board or the front desk. Nobody knocks on an empty room. The **registry** is the board.',
      body: [
        'Hard-coded addresses break as soon as instances are replaced. A **registry** holds the live list. Instances register, renew a TTL with **heartbeats**, and expire if they go silent.',
        'With **client-side discovery** the caller reads the registry and picks an instance. With **server-side discovery** a load balancer does it behind one stable name. **DNS** can serve as the lookup, as long as you respect its caching.',
        '**Liveness** failures restart an instance. **Readiness** failures remove it from rotation. The registry must be a quorum cluster and callers must survive its absence with a cached list. Consul, etcd, ZooKeeper and Kubernetes Services package these same ideas at different levels.',
      ],
      keyIdea: 'Discovery is a live list plus honest health signals: register, heartbeat, check readiness, and route only to what is ready.',
      metrics: { live: '3', listed: '3', err: '0%', detect: '6 s' },
      scene: {
        nodes: [
          orders,
          { ...registry, status: 'ok', badge: 'payments: 3 ready' },
          { ...router, status: 'ok' },
          { ...p1, status: 'ok' },
          { ...p2, status: 'ok' },
          { ...p4, status: 'ok' },
        ],
        links: [...viaRouter, ...registrations],
        flows: [
          { path: ['p1', 'registry'], tone: 'handshake', label: 'heartbeat', duration: 1.4 },
          { path: ['registry', 'router'], tone: 'data', duration: 1.2, delay: 1.5 },
          { path: ['orders', 'router', 'p2'], tone: 'request', count: 2, duration: 1.8, delay: 2.8 },
          { path: ['p2', 'router', 'orders'], tone: 'response', count: 2, duration: 1.8, delay: 4.7 },
        ],
        caption: 'Register, heartbeat, check, route',
      },
      quiz: {
        question: 'A payments instance has started and is still loading its cache for 20 seconds. Which check should fail during that time, and what should happen?',
        options: [
          'Liveness should fail, so the instance is restarted',
          'Readiness should fail, so it gets no traffic until it is ready',
          'Both should fail, so it is restarted and removed',
          'Neither: it should receive traffic and return errors until warm',
        ],
        answer: 1,
        explain: 'The process is healthy, just not ready. Failing readiness keeps it out of rotation without killing it. Failing liveness would restart it, and it would never finish warming up.',
      },
    },
  ],
};
