import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const orders: SceneNode = { id: 'orders', kind: 'block', at: at(-4.5, -3.8), label: 'orders', sub: 'the caller', icon: 'ShoppingBag', tint: 'amber' };
const registry: SceneNode = { id: 'registry', kind: 'block', at: at(4.5, -3.8), label: 'registry', sub: 'name → addresses', icon: 'List', tint: 'violet' };
const lb: SceneNode = { id: 'lb', kind: 'block', at: at(0, -3.8), label: 'load balancer', sub: 'payments.internal', icon: 'Scale', tint: 'teal' };
const dns: SceneNode = { id: 'dns', kind: 'dns', at: at(4.5, -4.8), label: 'DNS server', sub: 'payments.internal' };
const p1: SceneNode = { id: 'p1', kind: 'server', at: at(-4.5, 3.8), label: 'payments 1', sub: '10.0.1.5' };
const p2: SceneNode = { id: 'p2', kind: 'server', at: at(0, 3.8), label: 'payments 2', sub: '10.0.1.6' };
const p3: SceneNode = { id: 'p3', kind: 'server', at: at(4.5, 3.8), label: 'payments 3', sub: '10.0.1.7' };
const p4: SceneNode = { id: 'p3', kind: 'server', at: at(4.5, 3.8), label: 'payments 4', sub: '10.0.1.9' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });
const direct = (): SceneLink[] => [link('orders', 'p1'), link('orders', 'p2'), link('orders', 'p3')];
const viaLb = (): SceneLink[] => [link('orders', 'lb'), link('lb', 'p1'), link('lb', 'p2'), link('lb', 'p3')];

export const serviceDiscovery: Lesson = {
  id: 'service-discovery',
  title: 'Service discovery and health checks',
  tagline: 'How services find each other when addresses change every hour, and how dead instances get taken off the list.',
  minutes: 18,
  level: 'Intermediate',
  learn: [
    'Why hard-coded addresses fail once instances come and go',
    'What a service registry stores and who writes to it',
    'Self-registration versus third-party registration',
    'Client-side versus server-side discovery, and how to choose',
    'DNS-based discovery and its caching problem',
    'Heartbeats, TTLs and how fast a dead instance is noticed',
    'Liveness versus readiness checks, and graceful shutdown',
    'Passive checks, retries and push versus poll',
    'Keeping the registry itself alive, and the consistency choice',
    'Sidecars, Consul, etcd, ZooKeeper and Kubernetes Services',
  ],
  metrics: [
    { key: 'live', label: 'Live instances', icon: 'Server' },
    { key: 'listed', label: 'Listed', icon: 'List' },
    { key: 'err', label: 'Failed calls', icon: 'Activity' },
    { key: 'detect', label: 'Time to notice', icon: 'Timer' },
  ],
  steps: [
    {
      title: 'Hard-coded',
      tag: 'problem',
      heading: 'The address in the config file is dead',
      eli5: 'A pupil has a note that says "the maths teacher is in room 5". The teacher moved to room 9 last night. The pupil keeps knocking on an empty room. **Orders** is the pupil holding the old note.',
      body: [
        'The orders service calls payments. Its config lists three payment servers by IP: `10.0.1.5`, `.6` and `.7`. That worked while servers were long-lived machines set up by hand.',
        'Now autoscaling and rolling deploys replace instances many times a day. Last night `.7` was terminated and `10.0.1.9` came up. Nobody told orders. So every third request goes to the dead address and waits for the timeout, while the new instance at `.9` sits idle.',
      ],
      keyIdea: 'In a system where instances come and go, an address written into config is wrong within hours.',
      metrics: { live: '3', listed: '3 (1 wrong)', err: '33%', detect: 'never' },
      metricTones: { err: 'bad', detect: 'bad' },
      scene: {
        nodes: [
          { ...orders, status: 'hot', chips: [{ text: 'hosts: .5 .6 .7', tone: 'warn' }] },
          { ...p1, status: 'ok' },
          { ...p2, status: 'ok' },
          { ...p3, status: 'down', badge: 'terminated' },
        ],
        links: direct(),
        flows: [
          { path: ['orders', 'p1', 'orders'], tone: 'response', duration: 1.8 },
          { path: ['orders', 'p2', 'orders'], tone: 'response', duration: 1.8, delay: 0.5 },
          { path: ['orders', 'p3'], tone: 'request', label: 'POST /charge', duration: 1.4, delay: 1 },
          { path: ['p3', 'orders'], tone: 'error', label: 'timeout', duration: 2.4, delay: 2.5 },
        ],
        panel: {
          title: 'What orders believes',
          icon: 'List',
          rows: [
            { text: '10.0.1.5', value: 'alive', tone: 'good' },
            { text: '10.0.1.6', value: 'alive', tone: 'good' },
            { text: '10.0.1.7', value: 'gone', tone: 'bad' },
            { text: '10.0.1.9', value: 'unknown', tone: 'warn' },
          ],
          footer: { text: 'Every third call times out', tone: 'bad' },
        },
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
      title: 'Cost of edits',
      tag: 'problem',
      heading: 'Fixing it by hand means redeploying every caller',
      eli5: 'Every time a teacher changes room, someone must hand a new note to every single pupil. Teachers move all day, so the notes are always out of date.',
      body: [
        'The fix is a config edit and a redeploy of every caller, each time anything moves. With 40 callers and 20 scaling events a day, that cannot be done by people.',
      ],
      keyIdea: 'Manual address updates cost one change per caller per move, which cannot keep up with autoscaling.',
      metrics: { live: '3', listed: '3 (1 wrong)', err: '33%', detect: 'a human' },
      metricTones: { err: 'bad', detect: 'bad' },
      scene: {
        nodes: [
          { ...orders, status: 'hot', chips: [{ text: 'edit + redeploy', tone: 'warn' }] },
          { ...p4, status: 'idle', badge: 'new, not in config' },
        ],
        links: [link('orders', 'p3', { style: 'dashed', label: 'unknown', labelTone: 'warn' })],
        flows: [],
        panel: {
          title: 'Change cost per day',
          icon: 'Table',
          rows: [
            { text: 'Callers', value: '40' },
            { text: 'Scaling events', value: '20', tone: 'warn' },
            { text: 'Config edits needed', value: '800', tone: 'bad' },
          ],
          footer: { text: 'Nobody will do 800 edits a day', tone: 'bad' },
        },
        caption: 'Every move means an edit in every caller',
      },
    },
    {
      title: 'The registry',
      tag: 'concept',
      heading: 'A registry: one live list of who is where',
      eli5: 'The school office keeps a board. Each teacher writes their room on it when they arrive and wipes it off when they leave. Pupils check the board. The **registry** is that board.',
      body: [
        'A **service registry** is a small, highly available database mapping a service name to the addresses of its live instances: `payments → .5, .6, .9`.',
        'Callers stop storing addresses and store a name. **Service discovery** is turning that name into a live address at call time.',
      ],
      keyIdea: 'A registry replaces addresses in config with a name resolved at run time against a live list.',
      metrics: { live: '3', listed: '3', err: '0%', detect: '-' },
      metricTones: { err: 'good' },
      scene: {
        nodes: [
          orders,
          { ...registry, status: 'active', badge: 'payments: 3 live' },
          { ...p2, status: 'ok' },
        ],
        links: [link('orders', 'registry', { style: 'dashed', label: 'lookup' }), link('p2', 'registry', { style: 'faint' })],
        flows: [
          { path: ['orders', 'registry'], tone: 'request', label: 'where is payments?', duration: 1.4 },
          { path: ['registry', 'orders'], tone: 'response', label: '.5 .6 .9', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Registry entry',
          icon: 'List',
          code: 'payments:\n  10.0.1.5:8080\n  10.0.1.6:8080\n  10.0.1.9:8080',
          footer: { text: 'One name, a live list of addresses', tone: 'good' },
        },
        caption: 'Callers read the list instead of storing it',
      },
    },
    {
      title: 'Registration',
      tag: 'concept',
      heading: 'Who writes to the registry: the instance or the platform',
      eli5: 'Either each teacher writes their own room on the board, or the caretaker who unlocks the rooms writes it for them. Either way the **registry** board stays right.',
      body: [
        'With **self-registration**, an instance registers its name, IP and port at startup and deregisters on a clean shutdown. An entry holds an id, IP:port, tags or metadata (version, zone) and a health state. Simple, and every service carries that code.',
        'With **third-party registration**, the platform that launches instances (an orchestrator or a sidecar agent) writes the entry for them. Services stay unaware that a registry exists.',
      ],
      keyIdea: 'Instances can register themselves, or the platform can do it for them. Third-party keeps service code free of registry logic.',
      metrics: { live: '3', listed: '3', err: '0%', detect: '-' },
      metricTones: { err: 'good' },
      scene: {
        nodes: [
          { ...registry, status: 'active', badge: 'payments: 3 live' },
          { ...p1, status: 'ok' },
          { id: 'platform', kind: 'block', at: at(0, 0), label: 'platform', sub: 'orchestrator', icon: 'Router', tint: 'teal' },
          { ...p4, status: 'active', badge: 'new instance' },
        ],
        links: [link('p1', 'registry', { label: 'self' }), link('platform', 'registry', { style: 'dashed', label: 'by platform' }), link('platform', 'p3', { style: 'faint', label: 'launches' })],
        flows: [
          { path: ['p1', 'registry'], tone: 'event', label: 'register payments .5', duration: 1.6 },
          { path: ['platform', 'registry'], tone: 'event', label: 'platform: add .9', duration: 1.6, delay: 1.8 },
        ],
        panel: {
          title: 'Two ways to register',
          icon: 'Table',
          rows: [
            { text: 'Self-registration', value: 'code in each service' },
            { text: 'Third-party', value: 'platform writes it' },
            { text: 'Entry holds', value: 'id, IP:port, metadata, health' },
            { text: 'Both', value: 'deregister on exit', tone: 'good' },
          ],
        },
        caption: 'Either the instance or the platform writes the entry',
      },
    },
    {
      title: 'Client-side',
      tag: 'concept',
      heading: 'Client-side discovery: the caller picks an instance',
      eli5: 'The pupil reads the board, copies the room numbers into a notebook and walks straight to one of the rooms. No one else is in the way. **Orders** is the pupil with the notebook.',
      body: [
        'In **client-side discovery** the caller asks the registry for the list, keeps it in memory, and picks an instance itself, for example by round robin. The request goes straight to a payments instance.',
        'No extra hop and no shared balancer to scale or fail. The client can be smart: skip an instance that just timed out, prefer one in its own zone.',
      ],
      keyIdea: 'Client-side discovery has no middleman and no extra hop, and it puts registry and balancing logic into every caller.',
      metrics: { live: '3', listed: '3', err: '0%', detect: '-' },
      metricTones: { err: 'good' },
      scene: {
        nodes: [
          { ...orders, status: 'active', chips: ['cached: .5 .6 .9'] },
          registry,
          { ...p2, status: 'active' },
        ],
        links: [link('orders', 'registry', { style: 'dashed', label: 'refresh 5 s' }), link('orders', 'p2')],
        flows: [
          { path: ['orders', 'registry', 'orders'], tone: 'handshake', label: 'refresh', duration: 2 },
          { path: ['orders', 'p2'], tone: 'request', label: 'POST /charge', duration: 1.4, delay: 2.2 },
          { path: ['p2', 'orders'], tone: 'response', duration: 1.4, delay: 3.7 },
        ],
        panel: {
          title: 'Client-side',
          icon: 'Route',
          rows: [
            { text: 'Extra hops', value: '0', tone: 'good' },
            { text: 'Logic lives in', value: 'every caller', tone: 'warn' },
            { text: 'List is cached', value: 'refresh it', tone: 'warn' },
          ],
        },
        caption: 'Look up, then call the instance directly',
      },
      code: {
        language: 'typescript',
        title: 'Client-side discovery with a cached list',
        source: `let cached: string[] = [];
let fetchedAt = 0;
const failed = new Map<string, number>();                // instance -> retry-after time

async function paymentsInstances(): Promise<string[]> {
  if (Date.now() - fetchedAt > 5_000) {                  // refresh every 5 s
    try {
      const res = await fetch('http://registry.internal/v1/services/payments?healthy=true',
        { signal: AbortSignal.timeout(500) });           // short fetch timeout
      cached = await res.json();                         // ["10.0.1.5:8080", ...]
    } catch {
      // Registry unreachable: keep the last known list.
    }
    fetchedAt = Date.now();                              // also on failure: do not hit the registry on every call
  }
  return cached;
}

let next = 0;
export async function charge(body: unknown) {
  const list = (await paymentsInstances()).filter((i) => (failed.get(i) ?? 0) < Date.now());
  if (list.length === 0) throw new Error('no healthy payments instances');
  const target = list[next++ % list.length];             // round robin
  try {
    return await fetch(\`http://\${target}/charge\`, { method: 'POST', body: JSON.stringify(body), signal: AbortSignal.timeout(2_000) });
  } catch (e) {
    failed.set(target, Date.now() + 30_000);             // skip this instance for 30 s
    throw e;
  }
}`,
        highlight: [6, 8, 9, 13, 22, 23],
      },
    },
    {
      title: 'Server-side',
      tag: 'concept',
      heading: 'Server-side discovery: call one stable address',
      eli5: 'Now the pupil goes to the front desk and says "maths, please". The person at the desk reads the board and walks them to the right room. The **load balancer** is the front desk.',
      body: [
        'In **server-side discovery** the caller sends requests to one stable address, such as `payments.internal`, that belongs to a load balancer. It watches the registry and forwards each request to a live instance.',
        'Callers stay simple: an ordinary HTTP client in any language. Routing, retries and health logic live in one place and change without touching callers.',
      ],
      keyIdea: 'Server-side discovery moves the lookup into a load balancer, keeping callers simple at the cost of one more hop.',
      metrics: { live: '3', listed: '3', err: '0%', detect: '-' },
      metricTones: { err: 'good' },
      scene: {
        nodes: [
          { ...orders, chips: ['knows one name'] },
          { ...lb, status: 'active' },
          { ...p2, status: 'active' },
          registry,
        ],
        links: [link('orders', 'lb'), link('lb', 'p2'), link('lb', 'registry', { style: 'dashed', label: 'watch' })],
        flows: [
          { path: ['registry', 'lb'], tone: 'data', label: 'list changed', duration: 1.4 },
          { path: ['orders', 'lb', 'p2'], tone: 'request', label: 'POST /charge', duration: 1.8, delay: 1.5 },
          { path: ['p2', 'lb', 'orders'], tone: 'response', duration: 1.8, delay: 3.4 },
        ],
        panel: {
          title: 'Server-side',
          icon: 'Scale',
          rows: [
            { text: 'Caller needs', value: 'one name', tone: 'good' },
            { text: 'Extra hops', value: '1', tone: 'warn' },
            { text: 'Balancer must be', value: 'redundant', tone: 'warn' },
          ],
        },
        caption: 'The load balancer does the lookup for everyone',
      },
    },
    {
      title: 'Which style',
      tag: 'tradeoff',
      heading: 'Choosing between client-side and server-side',
      eli5: 'Teach every pupil to read the board, or station one person at a front desk. Desk helpers are easy for pupils but need a free desk. **Orders** picks whichever suits it.',
      body: [
        'Client-side needs a discovery library in every language, so a bug fix means redeploying every service. Pick it when latency is tight and one language dominates.',
        'Pick **server-side** when many languages call you or you want routing rules in one place. This is the model from the load balancing and API gateway lessons: now you know where their backend list comes from.',
      ],
      keyIdea: 'One language and tight latency favor client-side. Many languages and central control favor server-side.',
      metrics: { live: '3', listed: '3', err: '0%', detect: '-' },
      scene: {
        nodes: [
          { ...orders, chips: ['4 languages'] },
          { ...lb, status: 'ok' },
          { ...p2, status: 'ok' },
        ],
        links: [link('orders', 'lb'), link('lb', 'p2')],
        flows: [{ path: ['orders', 'lb', 'p2', 'lb', 'orders'], tone: 'request', duration: 2.6 }],
        panel: {
          title: 'Client versus server',
          icon: 'Table',
          rows: [
            { text: 'Extra hop', value: 'server-side only', tone: 'warn' },
            { text: 'Library per language', value: 'client-side only', tone: 'warn' },
            { text: 'Central routing rules', value: 'server-side', tone: 'good' },
            { text: 'No shared proxy', value: 'client-side', tone: 'good' },
          ],
        },
        caption: 'Four languages make one balancer cheaper',
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
      title: 'DNS',
      tag: 'concept',
      heading: 'DNS-based discovery: the registry you already have',
      eli5: 'The school phone book also lists rooms, and everyone already knows how to use it. The **DNS server** is the phone book.',
      body: [
        'DNS already maps names to addresses, and every language can resolve one. Publish one **A record** per live instance under `payments.internal`. **SRV records** can carry the port too.',
        'Plain DNS knows nothing about health, and many clients just use the first address returned. Round-robin ordering spreads load only roughly.',
      ],
      keyIdea: 'DNS is universal and needs no new client code, though it has no idea which instances are healthy.',
      metrics: { live: '3', listed: '3', err: '0%', detect: '-' },
      metricTones: { err: 'good' },
      scene: {
        nodes: [
          orders,
          { ...dns, status: 'active' },
          { ...p2, status: 'ok' },
        ],
        links: [link('orders', 'dns', { style: 'dashed', label: 'resolve' }), link('orders', 'p2')],
        flows: [
          { path: ['orders', 'dns'], tone: 'request', label: 'payments.internal?', duration: 1.4 },
          { path: ['dns', 'orders'], tone: 'response', label: 'A: .5 .6 .9', duration: 1.4, delay: 1.5 },
          { path: ['orders', 'p2', 'orders'], tone: 'response', duration: 1.8, delay: 3 },
        ],
        panel: {
          title: 'Records for payments.internal',
          icon: 'Globe',
          code: 'A   10.0.1.5\nA   10.0.1.6\nA   10.0.1.9\nSRV _http._tcp 8080',
          footer: { text: 'No health information in DNS', tone: 'warn' },
        },
        caption: 'Every language can already resolve a name',
      },
    },
    {
      title: 'DNS caching',
      tag: 'case',
      heading: 'DNS caching: the answer is right, the cached copy is old',
      eli5: 'Pupils copy a phone number down and keep using it for a while, even after the room changed. **Orders** is still dialing the old number.',
      body: [
        'Each answer carries a TTL, and resolvers, operating systems and client libraries hold on to it. Some runtimes cache a lookup for the life of the process unless configured otherwise.',
        'With a 30-second TTL, a removed instance can keep receiving traffic for 30 seconds or more. So point DNS at something stable, such as a load balancer, and keep TTLs short.',
      ],
      keyIdea: 'DNS changes spread slowly. Keep TTLs short and point names at stable things.',
      metrics: { live: '3', listed: '3 (1 stale)', err: '33%', detect: '30 s (TTL)' },
      metricTones: { err: 'bad', detect: 'bad' },
      scene: {
        nodes: [
          { ...orders, status: 'hot', chips: [{ text: 'cached: .5 .6 .7', tone: 'warn' }] },
          { ...dns, status: 'active', badge: 'A: .5 .6 .9' },
          { ...p3, status: 'down', badge: 'gone' },
        ],
        links: [link('orders', 'dns', { style: 'dashed', label: 'TTL 30 s', labelTone: 'warn' }), link('orders', 'p3')],
        flows: [
          { path: ['orders', 'p3'], tone: 'request', label: 'POST /charge', duration: 1.4 },
          { path: ['p3', 'orders'], tone: 'error', label: 'timeout', duration: 2.2, delay: 1.5 },
        ],
        panel: {
          title: 'Stale for up to',
          icon: 'Clock',
          rows: [
            { text: 'Record TTL', value: '30 s', tone: 'warn' },
            { text: 'Library cache', value: 'process life?', tone: 'bad' },
            { text: 'Fix', value: 'short TTL, stable IP', tone: 'good' },
          ],
        },
        caption: 'The answer is right, the cached copy is old',
      },
    },
    {
      title: 'Heartbeats',
      tag: 'concept',
      heading: 'Heartbeats: crashed instances cannot say goodbye',
      eli5: 'Every few minutes each teacher phones the office to say "still here". If the office hears nothing for a while, it wipes that teacher off the board. The **registry** is listening for those calls.',
      body: [
        'A clean shutdown deregisters. A crash, a killed VM or a cut cable does not, so the registry would list the dead instance forever.',
        'So registrations expire. Each instance sends a **heartbeat** every 10 seconds that renews a **TTL** (a lease) of 30 seconds on its entry. Miss three in a row and the registry removes it by itself.',
      ],
      keyIdea: 'Entries must expire unless renewed. The TTL sets how long a crashed instance keeps receiving traffic.',
      metrics: { live: '2', listed: '3', err: '33%', detect: '30 s' },
      metricTones: { err: 'bad', detect: 'warn' },
      scene: {
        nodes: [
          { ...registry, status: 'active', badge: 'payments 1: lease 4 s left' },
          { ...p1, status: 'down', badge: 'crashed' },
          { ...p2, status: 'ok' },
          { ...p4, status: 'ok' },
        ],
        links: [link('p1', 'registry', { style: 'faint' }), link('p2', 'registry', { style: 'faint' }), link('p3', 'registry', { style: 'faint' })],
        flows: [
          { path: ['p2', 'registry'], tone: 'handshake', label: 'heartbeat', duration: 1.4 },
          { path: ['p3', 'registry'], tone: 'handshake', label: 'heartbeat', duration: 1.6, delay: 0.5 },
        ],
        panel: {
          title: 'Leases in the registry',
          icon: 'Clock',
          rows: [
            { text: 'payments 1', value: 'expiring', tone: 'bad' },
            { text: 'payments 2', value: '28 s left', tone: 'good' },
            { text: 'payments 4', value: '27 s left', tone: 'good' },
          ],
          footer: { text: 'No heartbeat for 30 s, entry removed', tone: 'muted' },
        },
        caption: 'Silence means the lease runs out',
      },
    },
    {
      title: 'TTL tuning',
      tag: 'tradeoff',
      heading: 'Choosing the TTL: fast detection or fewer false evictions',
      eli5: 'If the office wipes a teacher off after one missed call, a teacher stuck in a long talk vanishes by mistake. If it waits an hour, pupils knock on empty rooms. The **registry** has to pick a wait.',
      body: [
        'A long TTL keeps a dead instance listed for that whole time. A short one notices crashes fast.',
        'But with a 5-second TTL, a healthy instance is evicted after one slow network moment or a long garbage-collection pause, then reappears on its next heartbeat. Heartbeat traffic grows as well.',
      ],
      keyIdea: 'A short TTL detects crashes fast and risks evicting healthy instances. A long TTL does the reverse.',
      metrics: { live: '2', listed: '3', err: '33%', detect: '30 s' },
      metricTones: { detect: 'warn' },
      scene: {
        nodes: [
          { ...registry, status: 'active' },
          { ...p2, status: 'ok', chips: [{ text: 'TTL 5 s', tone: 'warn' }], badge: 'evicted, then back' },
          { ...p1, status: 'down' },
        ],
        links: [link('p2', 'registry', { style: 'faint', label: 'heartbeat late', labelTone: 'warn' }), link('p1', 'registry', { style: 'faint' })],
        flows: [{ path: ['p2', 'registry'], tone: 'handshake', label: 'late (GC pause)', duration: 2.4 }],
        panel: {
          title: 'TTL trade-off',
          icon: 'Scale',
          rows: [
            { text: 'TTL 5 s', value: 'fast, flappy', tone: 'warn' },
            { text: 'TTL 30 s', value: 'usual balance', tone: 'good' },
            { text: 'TTL 5 min', value: 'slow, stable', tone: 'warn' },
          ],
        },
        caption: 'A late heartbeat evicts a healthy instance, briefly',
      },
    },
    {
      title: 'Active checks',
      tag: 'concept',
      heading: 'Health checks: ask the instance, do not wait for it to speak',
      eli5: 'A heartbeat only says the teacher picked up the phone. A health check walks to the room and asks "can you teach right now?". The **load balancer** is the one walking over.',
      body: [
        'A heartbeat says the process exists. It does not say the instance can do useful work. **Health checks** ask directly: a balancer or agent probes an HTTP endpoint such as `/healthz` every few seconds.',
        'Push (heartbeats from the instance) and pull (probes from outside) can be combined. A probe also catches a hung process that still sends heartbeats from a separate thread.',
      ],
      keyIdea: 'Heartbeats prove the process is there. Probes prove it can answer.',
      metrics: { live: '3', listed: '3', err: '0%', detect: '6 s' },
      metricTones: { err: 'good' },
      scene: {
        nodes: [
          { ...lb, status: 'active', chips: ['probe every 2 s'] },
          { ...p1, status: 'ok' },
          { ...p4, status: 'down', badge: 'hung' },
        ],
        links: [link('lb', 'p1'), link('lb', 'p3', { labelTone: 'warn', label: 'no answer' })],
        flows: [
          { path: ['lb', 'p1', 'lb'], tone: 'handshake', label: '/healthz 200', duration: 1.6 },
          { path: ['lb', 'p3'], tone: 'handshake', label: '/healthz', duration: 1.4, delay: 0.4 },
          { path: ['p3', 'lb'], tone: 'error', label: 'timeout', duration: 1.6, delay: 2 },
        ],
        panel: {
          title: 'Probe results',
          icon: 'Activity',
          rows: [
            { text: 'payments 1', value: '200 OK', tone: 'good' },
            { text: 'payments 4', value: 'timeout x3', tone: 'bad' },
          ],
          footer: { text: 'Three misses in a row: out of rotation', tone: 'muted' },
        },
        caption: 'The probe finds what a heartbeat cannot',
      },
    },
    {
      title: 'Live vs ready',
      tag: 'concept',
      heading: 'Liveness and readiness are different questions',
      eli5: 'Two questions about a teacher. "Is the teacher okay?" If not, send a new one. "Is the teacher ready for pupils?" If still unpacking, send nobody in yet. The **load balancer** asks the second question.',
      body: [
        '**Liveness** asks: is this process stuck beyond repair? If the check keeps failing, the platform **restarts** it. **Readiness** asks: can it serve traffic now? If not, it is **taken out of the list** and left running, then put back when it passes.',
        'Keep them separate. A new instance loading a 20-second cache is alive and not ready. If liveness depended on the database, one blip would restart every instance and turn a short error into an outage.',
      ],
      keyIdea: 'Failing liveness means restart me. Failing readiness means stop sending me traffic for now.',
      metrics: { live: '2 ready, 1 warming', listed: '2', err: '0%', detect: '6 s' },
      metricTones: { err: 'good' },
      scene: {
        nodes: [
          orders,
          { ...lb, status: 'active', chips: ['probe every 2 s'] },
          { ...p1, status: 'ok', badge: 'ready' },
          { ...p2, status: 'ok', badge: 'ready' },
          { ...p4, status: 'dim', badge: 'alive, warming up' },
        ],
        links: viaLb(),
        flows: [
          { path: ['lb', 'p3'], tone: 'handshake', label: '/ready', duration: 1.2 },
          { path: ['p3', 'lb'], tone: 'error', label: '503 not yet', duration: 1.2, delay: 1.3 },
          { path: ['orders', 'lb', 'p2'], tone: 'request', count: 3, duration: 1.8, delay: 2.8 },
        ],
        panel: {
          title: 'Two checks',
          icon: 'Table',
          rows: [
            { text: 'Liveness fails', value: 'restart', tone: 'bad' },
            { text: 'Readiness fails', value: 'no traffic', tone: 'warn' },
            { text: 'Warming cache', value: 'alive, not ready', tone: 'good' },
          ],
        },
        caption: 'Alive is one check, ready for traffic is another',
      },
    },
    {
      title: 'Probe config',
      tag: 'concept',
      heading: 'Probes in practice: two endpoints, two thresholds',
      eli5: 'The office writes two rules on a card: how often to ask "okay?" and how often to ask "ready?". Each rule says how many misses to allow. The **load balancer** follows the card.',
      body: [
        'Give the container two endpoints. `/healthz` checks only the process. `/ready` checks what it needs to serve, such as the cache being loaded.',
        'Tune the thresholds: readiness probes run often (every 2 s) so traffic leaves quickly. Liveness probes run less often, so a slow moment does not trigger a restart. Liveness waits for the **startupProbe**, so a slow-starting service is not restarted before it is ever ready. Readiness should check only what this instance needs, not shared downstream services.',
      ],
      keyIdea: 'Probe often for readiness, rarely for liveness, and never make liveness depend on other services.',
      metrics: { live: '3', listed: '3', err: '0%', detect: '6 s' },
      metricTones: { err: 'good' },
      scene: {
        nodes: [
          { ...p1, status: 'ok', badge: 'pod' },
          { ...lb, label: 'kubelet', sub: 'runs the probes', icon: 'Activity' },
        ],
        links: [link('lb', 'p1', { label: 'probes' })],
        flows: [
          { path: ['lb', 'p1', 'lb'], tone: 'handshake', label: '/ready 200', duration: 1.8 },
          { path: ['lb', 'p1', 'lb'], tone: 'handshake', label: '/healthz 200', duration: 1.8, delay: 2 },
        ],
        panel: {
          title: 'Probe timings',
          icon: 'Timer',
          rows: [
            { text: 'Readiness every', value: '2 s x 3 = 6 s' },
            { text: 'Liveness every', value: '10 s x 3 = 30 s' },
          ],
          footer: { text: 'Out of rotation in 6 s, restarted in 30 s', tone: 'muted' },
        },
        caption: 'Fast to stop traffic, slow to restart',
      },
      code: {
        language: 'yaml',
        title: 'Kubernetes probes on the payments container',
        source: `containers:
  - name: payments
    image: shop/payments:4.2.0
    ports:
      - containerPort: 8080
    startupProbe:                # liveness and readiness wait until this passes
      httpGet: { path: /healthz, port: 8080 }
      periodSeconds: 5
      failureThreshold: 12       # up to 60 s to start
    livenessProbe:               # failing -> the kubelet restarts the container
      httpGet: { path: /healthz, port: 8080 }
      periodSeconds: 10
      timeoutSeconds: 2
      failureThreshold: 3
    readinessProbe:              # failing -> removed from the Service's endpoints
      httpGet: { path: /ready, port: 8080 }
      periodSeconds: 2
      timeoutSeconds: 1
      failureThreshold: 3        # out of rotation after about 6 s`,
        highlight: [6, 10, 13, 16],
      },
    },
    {
      title: 'Clean exit',
      tag: 'concept',
      heading: 'Rolling deploys: leave the list first, then stop',
      eli5: 'A teacher who is leaving first wipes their name off the board, finishes the pupils already in the room, and only then locks the door. The **registry** board is wiped first.',
      body: [
        'On shutdown an instance should **deregister** first. Callers keep sending new requests until their cached lists refresh, which takes longer than the poll interval or DNS TTL, so the instance keeps accepting requests until then. After that it finishes in-flight work (**connection draining**) and exits.',
        'In Kubernetes, SIGTERM and endpoint removal race each other, so a short `preStop` sleep keeps the pod serving while the removal spreads. Most platforms send a termination signal and wait a grace period.',
      ],
      keyIdea: 'Deregister, keep serving until caller caches refresh, drain in-flight requests, then exit.',
      metrics: { live: '3', listed: '2', err: '0%', detect: '5 s (cache refresh)' },
      metricTones: { err: 'good', detect: 'good' },
      scene: {
        nodes: [
          { ...registry, status: 'active', badge: 'payments: 2 live' },
          { ...p1, status: 'dim', badge: 'draining', chips: ['2 in flight'] },
          { ...p2, status: 'ok' },
        ],
        links: [link('p1', 'registry', { style: 'faint' }), link('p2', 'registry', { style: 'faint' })],
        flows: [
          { path: ['p1', 'registry'], tone: 'event', label: 'deregister', duration: 1.4 },
          { path: ['p2', 'registry'], tone: 'handshake', label: 'heartbeat', duration: 1.4, delay: 1.6 },
        ],
        panel: {
          title: 'Shutdown order',
          icon: 'List',
          rows: [
            { text: '1. Deregister', value: 'caches refresh in about 5 s', tone: 'good' },
            { text: '2. Keep serving, then drain', value: 'finish in-flight' },
            { text: '3. Exit', value: 'after grace period' },
          ],
        },
        caption: 'Leave the list before leaving the building',
      },
    },
    {
      title: 'Passive checks',
      tag: 'concept',
      heading: 'Passive checks and retries cover the gap',
      eli5: 'Between two calls from the office, a pupil who knocks and gets no answer can just try the next room on the list. **Orders** learns from its own failed knocks.',
      body: [
        'Between probes a dead instance still looks healthy. **Passive checks** watch real traffic: after a few connection errors, the caller or balancer ejects that instance for a while (**outlier detection**).',
        'Pair it with **retries** on a different instance, for idempotent calls only. A retry hides the 30-second window from users, and ejection stops the repeated failures. A refused connection is safe to retry because the request never arrived, but a timeout on a POST is not unless it carries an idempotency key.',
      ],
      keyIdea: 'Real traffic is a free health signal. Eject after repeated errors and retry elsewhere.',
      metrics: { live: '2', listed: '3', err: '2%', detect: '2 failed calls' },
      metricTones: { err: 'good', detect: 'good' },
      scene: {
        nodes: [
          { ...orders, status: 'active', chips: [{ text: 'retry on .6', tone: 'good' }, 'idempotency key'] },
          { ...p1, status: 'down', badge: 'ejected 30 s' },
          { ...p2, status: 'ok' },
        ],
        links: [link('orders', 'p1', { label: '2 errors', labelTone: 'warn' }), link('orders', 'p2')],
        flows: [
          { path: ['orders', 'p1'], tone: 'request', label: 'POST /charge', duration: 1.2 },
          { path: ['p1', 'orders'], tone: 'error', label: 'refused', duration: 1.2, delay: 1.3 },
          { path: ['orders', 'p2', 'orders'], tone: 'response', label: 'retry ok', duration: 1.8, delay: 2.8 },
        ],
        panel: {
          title: 'Passive check rule',
          icon: 'Shield',
          rows: [
            { text: 'Errors in a row', value: '2', tone: 'warn' },
            { text: 'Eject for', value: '30 s' },
            { text: 'Retry', value: 'idempotent only', tone: 'good' },
          ],
        },
        caption: 'Failed calls teach the caller who is dead',
      },
    },
    {
      title: 'Poll or watch',
      tag: 'tradeoff',
      heading: 'Spreading changes: poll the registry or watch it',
      eli5: 'Pupils can ask the board every five minutes, or the office can tap them on the shoulder when something changes. Tapping is faster but the office must remember everyone. The **registry** can do either.',
      body: [
        'With **polling**, each caller re-reads the list every 5 seconds. Simple, but a change takes up to 5 seconds to arrive and the registry takes constant read load.',
        'With a **watch**, callers keep a connection open and the registry pushes each change. Updates arrive in milliseconds, and the registry must hold many long-lived connections.',
      ],
      keyIdea: 'Polling is simple and slightly stale. Watching is fast and costs open connections.',
      metrics: { live: '3', listed: '3', err: '0%', detect: '5 s poll, 50 ms watch' },
      scene: {
        nodes: [
          { ...orders, chips: ['watching payments'] },
          { ...registry, status: 'active' },
          { ...p4, status: 'active', badge: 'new .9' },
        ],
        links: [link('orders', 'registry', { arrow: 'both', label: 'open watch' }), link('p3', 'registry', { style: 'faint' })],
        flows: [
          { path: ['p3', 'registry'], tone: 'event', label: 'register .9', duration: 1.4 },
          { path: ['registry', 'orders'], tone: 'data', label: 'pushed: +.9', duration: 1.4, delay: 1.6 },
        ],
        panel: {
          title: 'Poll versus watch',
          icon: 'Table',
          rows: [
            { text: 'Poll every 5 s', value: 'up to 5 s late', tone: 'warn' },
            { text: 'Watch', value: 'about 50 ms', tone: 'good' },
            { text: 'Watch cost', value: 'open connections', tone: 'warn' },
          ],
        },
        caption: 'A change travels to callers as fast as the link allows',
      },
    },
    {
      title: 'Registry cluster',
      tag: 'case',
      heading: 'Case: the registry itself can fail',
      eli5: 'If the office keeps its board in one room and that room floods, everyone is lost. So the office keeps three copies of the board and trusts the majority. The **registry** is three boards that agree.',
      body: [
        'Every service depends on the registry, so its failure can stop everything. Run it as a cluster of 3 or 5 nodes that agree on changes through a **consensus** protocol.',
        'It keeps working as long as a majority is up: 3 nodes survive one failure, 5 survive two. Odd sizes avoid ties. Callers reach the registry through a fixed name or a few seed addresses, and cross-region setups federate or replicate registries.',
      ],
      keyIdea: 'Run the registry as a quorum cluster: 3 nodes survive 1 failure, 5 survive 2.',
      metrics: { live: '3', listed: '3', err: '0%', detect: '6 s' },
      metricTones: { err: 'good' },
      scene: {
        nodes: [
          { ...registry, id: 'reg1', label: 'registry 1', sub: 'leader', at: at(-3.5, -4), status: 'ok' },
          { ...registry, id: 'reg2', label: 'registry 2', sub: 'follower', at: at(0.5, 0), status: 'ok' },
          { ...registry, id: 'reg3', label: 'registry 3', sub: 'down', at: at(4.5, 4), status: 'down' },
        ],
        links: [link('reg1', 'reg2', { arrow: 'both', label: 'consensus' }), link('reg2', 'reg3', { arrow: 'both', style: 'dashed' })],
        flows: [{ path: ['reg1', 'reg2', 'reg1'], tone: 'data', label: 'commit', duration: 1.8 }],
        panel: {
          title: 'Quorum',
          icon: 'Shield',
          rows: [
            { text: '3 nodes', value: 'survive 1', tone: 'good' },
            { text: '5 nodes', value: 'survive 2', tone: 'good' },
            { text: '2 of 3 up', value: 'majority holds', tone: 'good' },
          ],
        },
        caption: 'One node is down and the registry still answers',
      },
    },
    {
      title: 'Cached fallback',
      tag: 'case',
      heading: 'Case: when the registry goes dark, use the last known list',
      eli5: 'One day the board falls off the wall. Pupils who kept their notebook still find their teachers. Pupils who threw the notebook away are lost. **Orders** kept its notebook.',
      body: [
        'Callers and load balancers **cache the last known list** and keep using it when the registry cannot be reached. Existing instances stay reachable, and only changes are missed.',
        'The dangerous design is the opposite: treating "registry unreachable" as "zero instances" and dropping every backend at once. Stale data beats no data.',
      ],
      keyIdea: 'Fail static: keep the last known list when the registry is unreachable.',
      metrics: { live: '3', listed: '3 (cached)', err: '0%', detect: 'paused' },
      metricTones: { err: 'good', detect: 'warn' },
      scene: {
        nodes: [
          { ...orders, status: 'ok', chips: [{ text: 'cached .5 .6 .9', tone: 'good' }] },
          { ...registry, status: 'down', badge: 'unreachable' },
          { ...p2, status: 'ok' },
        ],
        links: [link('orders', 'registry', { style: 'dashed', label: 'no answer', labelTone: 'warn' }), link('orders', 'p2')],
        flows: [
          { path: ['orders', 'registry'], tone: 'request', label: 'refresh', duration: 1.2 },
          { path: ['registry', 'orders'], tone: 'error', label: 'no answer', duration: 1.2, delay: 1.3 },
          { path: ['orders', 'p2', 'orders'], tone: 'response', duration: 1.8, delay: 2.6 },
        ],
        panel: {
          title: 'Registry unreachable',
          icon: 'Plug',
          rows: [
            { text: 'Keep cached list', value: 'calls still work', tone: 'good' },
            { text: 'Treat as empty', value: 'total outage', tone: 'bad' },
          ],
        },
        caption: 'Stale data beats no data',
      },
    },
    {
      title: 'Consistency',
      tag: 'tradeoff',
      heading: 'Consistent or available: what a registry should prefer',
      eli5: 'During a flood, should the office stop answering until it is sure of every room, or answer with its best guess? For finding teachers, a best guess is usually fine. The **registry** can choose.',
      body: [
        'etcd, ZooKeeper and Consul are consistent (CP): the minority side cannot commit writes. Consul lets a client opt into stale reads from any server for availability. Eureka is AP and keeps answering with possibly stale data.',
        'Discovery tolerates a slightly stale list, because health checks and retries correct it. A wrong answer is cheaper than no answer, so many teams favor availability for lookups.',
      ],
      keyIdea: 'For lookups, a slightly stale answer usually beats no answer. Use strong consistency for locks and leaders.',
      metrics: { live: '3', listed: '3', err: '0%', detect: '6 s' },
      scene: {
        nodes: [
          { ...registry, id: 'reg1', label: 'registry A', sub: 'partitioned', at: at(-3.5, -3), status: 'hot' },
          { ...registry, id: 'reg2', label: 'registry B', sub: 'majority side', at: at(3.5, 3), status: 'ok' },
          { ...orders, at: at(-3.5, 3) },
        ],
        links: [link('reg1', 'reg2', { style: 'dashed', label: 'network split', labelTone: 'warn', arrow: 'none' }), link('orders', 'reg1')],
        flows: [{ path: ['orders', 'reg1'], tone: 'request', label: 'lookup', duration: 1.4 }, { path: ['reg1', 'orders'], tone: 'response', label: 'CP: refuses, AP: stale', duration: 1.4, delay: 1.5 }],
        panel: {
          title: 'During a partition',
          icon: 'Scale',
          rows: [
            { text: 'CP (etcd, ZooKeeper)', value: 'minority refuses', tone: 'warn' },
            { text: 'AP (Eureka)', value: 'answers, maybe stale', tone: 'good' },
          ],
          footer: { text: 'Pick by what a wrong answer costs', tone: 'muted' },
        },
        caption: 'The minority side must choose',
      },
    },
    {
      title: 'Sidecars',
      tag: 'concept',
      heading: 'Sidecars and service meshes: discovery next to each service',
      eli5: 'Each pupil gets a helper who walks beside them and always knows the current room numbers. The pupil just says "maths" to the helper. The **sidecar** is that helper.',
      body: [
        'A **sidecar proxy** (Envoy, Linkerd) runs beside every instance and does discovery, load balancing, retries and health checks for it. The app calls `localhost`.',
        'A **service mesh** is a fleet of sidecars fed by a control plane that holds the registry. It gives client-side speed without a library per language, at the cost of running a proxy per pod.',
      ],
      keyIdea: 'A sidecar gives client-side discovery without a library: the logic lives in a proxy beside each service.',
      metrics: { live: '3', listed: '3', err: '0%', detect: '6 s' },
      metricTones: { err: 'good' },
      scene: {
        nodes: [
          { ...orders, chips: ['call localhost'] },
          { id: 'side', kind: 'block', at: at(0, -3.8), label: 'sidecar', sub: 'proxy', icon: 'Router', tint: 'teal', status: 'active' },
          { ...registry, label: 'control plane', sub: 'pushes the list' },
          { ...p2, status: 'ok' },
        ],
        links: [link('orders', 'side', { label: 'localhost' }), link('side', 'p2'), link('registry', 'side', { style: 'dashed' })],
        flows: [
          { path: ['registry', 'side'], tone: 'data', label: 'endpoints', duration: 1.4 },
          { path: ['orders', 'side', 'p2'], tone: 'request', duration: 1.8, delay: 1.6 },
        ],
        panel: {
          title: 'Mesh trade-off',
          icon: 'Table',
          rows: [
            { text: 'Library per language', value: 'none', tone: 'good' },
            { text: 'Extra hops', value: 'local only', tone: 'good' },
            { text: 'Proxies to run', value: 'one per pod', tone: 'warn' },
          ],
        },
        caption: 'The proxy next door knows the current list',
      },
    },
    {
      title: 'The tools',
      tag: 'tradeoff',
      heading: 'Consul, etcd and ZooKeeper: ready-made or building blocks',
      eli5: 'Different schools run the office differently. One has a full office with a nurse who checks on teachers. Another has just a very reliable board and expects you to do the rest. The **registry** can be either.',
      body: [
        '**Consul** is a purpose-built registry: service catalog, health checks run by an agent on each machine, and both an HTTP API and a DNS interface. Its servers replicate with Raft.',
        '**etcd** and **ZooKeeper** are consistent key-value stores. In etcd a key is tied to a **lease** and vanishes when not renewed, and clients **watch** a prefix. In ZooKeeper an **ephemeral node** vanishes when its session ends. You write the rest.',
      ],
      keyIdea: 'Consul is a ready-made registry. etcd and ZooKeeper give leases and watches that you build discovery on.',
      metrics: { live: '3', listed: '3', err: '0%', detect: '6 s' },
      scene: {
        nodes: [
          { ...registry, status: 'active', label: 'Consul', sub: 'catalog + checks' },
          { ...p1, status: 'ok' },
          { ...p2, status: 'ok' },
        ],
        links: [link('p1', 'registry', { style: 'faint' }), link('p2', 'registry', { style: 'faint' })],
        flows: [{ path: ['p1', 'registry'], tone: 'handshake', label: 'agent check', duration: 1.4 }],
        panel: {
          title: 'What you get',
          icon: 'Table',
          rows: [
            { text: 'Consul', value: 'catalog, checks, DNS', tone: 'good' },
            { text: 'etcd', value: 'lease + watch' },
            { text: 'ZooKeeper', value: 'ephemeral nodes' },
          ],
          footer: { text: 'With etcd or ZooKeeper you write the glue', tone: 'muted' },
        },
        caption: 'Same ideas, packaged at different levels',
      },
    },
    {
      title: 'Kubernetes',
      tag: 'concept',
      heading: 'Kubernetes Services: discovery built into the platform',
      eli5: 'This school hires a caretaker who runs the board, the phone book and the front desk. Teachers do nothing. The **load balancer** box is the Service.',
      body: [
        'A **Service** gives a set of pods one stable virtual IP and a DNS name such as `payments.shop.svc.cluster.local`. The control plane (state in etcd) adds a pod to the Service\'s endpoints only while it passes its readiness probe.',
        'kube-proxy rewrites the Service IP on every node, so this is server-side discovery without a separate balancer machine. A headless Service returns pod IPs through DNS for client-side use.',
      ],
      keyIdea: 'A Kubernetes Service is server-side discovery: stable name, endpoints filtered by readiness.',
      metrics: { live: '3', listed: '3', err: '0%', detect: '6 s' },
      metricTones: { err: 'good' },
      scene: {
        nodes: [
          { ...orders, chips: ['payments.shop'] },
          { ...lb, label: 'Service', sub: 'virtual IP', status: 'active' },
          { ...registry, label: 'control plane', sub: 'endpoints in etcd' },
          { ...p2, label: 'pod 2', status: 'ok' },
        ],
        links: [link('orders', 'lb'), link('lb', 'p2'), link('registry', 'lb', { style: 'dashed', label: 'endpoints' })],
        flows: [
          { path: ['registry', 'lb'], tone: 'data', label: 'ready pods only', duration: 1.4 },
          { path: ['orders', 'lb', 'p2'], tone: 'request', duration: 1.8, delay: 1.6 },
        ],
        panel: {
          title: 'Service endpoints',
          icon: 'Container',
          rows: [
            { text: 'pod 1', value: 'ready', tone: 'good' },
            { text: 'pod 2', value: 'ready', tone: 'good' },
            { text: 'pod 3', value: 'not ready, skipped', tone: 'warn' },
          ],
        },
        caption: 'A stable name over changing pods',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Names in config, addresses at run time',
      eli5: 'Teachers write their room on the office board, phone in to say "still here", and say when they are ready for pupils. Pupils ask the board or the front desk. Nobody knocks on an empty room. The **registry** is the board.',
      body: [
        'A **registry** holds the live list. Instances (or the platform) register, renew a TTL with **heartbeats**, and expire if silent. Callers look up by name, client-side or through a balancer, with **DNS** only if you respect its caching.',
        '**Liveness** failures restart, **readiness** failures remove from rotation. Run the registry as a quorum cluster and fail static with a cached list.',
      ],
      keyIdea: 'Discovery is a live list plus honest health signals: register, heartbeat, check readiness, and route only to what is ready.',
      metrics: { live: '3', listed: '3', err: '0%', detect: '6 s' },
      metricTones: { live: 'good', err: 'good', detect: 'good' },
      scene: {
        nodes: [
          orders,
          { ...registry, status: 'ok', badge: 'payments: 3 ready' },
          { ...lb, status: 'ok' },
          { ...p2, status: 'ok' },
        ],
        links: [link('orders', 'lb'), link('lb', 'p2'), link('lb', 'registry', { style: 'dashed', label: 'watch' })],
        flows: [
          { path: ['p2', 'registry'], tone: 'handshake', label: 'heartbeat', duration: 1.4 },
          { path: ['registry', 'lb'], tone: 'data', duration: 1.2, delay: 1.5 },
          { path: ['orders', 'lb', 'p2'], tone: 'request', count: 2, duration: 1.8, delay: 2.8 },
        ],
        panel: {
          title: 'The loop',
          icon: 'Repeat',
          rows: [
            { text: 'Register', value: 'name to address' },
            { text: 'Heartbeat / probe', value: 'stay listed' },
            { text: 'Route', value: 'ready ones only', tone: 'good' },
          ],
        },
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
