import type { Lesson, SceneNode } from '../engine/types';

// Client-server and layered
const browser: SceneNode = { id: 'browser', kind: 'client', at: [-6, -1.5], label: 'browser' };
const web: SceneNode = { id: 'web', kind: 'gateway', at: [-3, -1.5], label: 'web layer', sub: 'HTTP, JSON' };
const logic: SceneNode = { id: 'logic', kind: 'server', at: [0, -1.5], label: 'service layer', sub: 'business rules' };
const repo: SceneNode = { id: 'repo', kind: 'service', at: [3, -1.5], label: 'data layer', sub: 'SQL lives here' };
const db: SceneNode = { id: 'db', kind: 'db', at: [3, 3.5], label: 'Postgres' };
const phone: SceneNode = { id: 'phone', kind: 'phone', at: [-6, 2.5], label: 'mobile app' };

// Event-driven
const orders: SceneNode = { id: 'orders', kind: 'service', at: [-4, -1.5], label: 'orders', sub: 'producer' };
const broker: SceneNode = { id: 'broker', kind: 'queue', at: [0, -1.5], label: 'event broker', sub: 'topic: orders' };
const email: SceneNode = { id: 'email', kind: 'worker', at: [4, -4.5], label: 'email' };
const stock: SceneNode = { id: 'stock', kind: 'worker', at: [4, -1.5], label: 'inventory' };
const analytics: SceneNode = { id: 'analytics', kind: 'worker', at: [4, 1.5], label: 'analytics' };

// Pipes and filters
const inbox: SceneNode = { id: 'inbox', kind: 'storage', at: [-6, -1.5], label: 'uploads', sub: 'raw video' };
const probe: SceneNode = { id: 'probe', kind: 'worker', at: [-3, -1.5], label: 'validate' };
const transcode: SceneNode = { id: 'transcode', kind: 'worker', at: [0, -1.5], label: 'transcode', sub: '1080p, 720p' };
const thumbs: SceneNode = { id: 'thumbs', kind: 'worker', at: [3, -1.5], label: 'thumbnails' };
const outbox: SceneNode = { id: 'outbox', kind: 'storage', at: [6, -1.5], label: 'published' };

// Peer-to-peer
const p1: SceneNode = { id: 'p1', kind: 'client', at: [-3, 0], label: 'peer A' };
const p2: SceneNode = { id: 'p2', kind: 'client', at: [0, -3], label: 'peer B' };
const p3: SceneNode = { id: 'p3', kind: 'client', at: [3, 0], label: 'peer C' };
const p4: SceneNode = { id: 'p4', kind: 'client', at: [0, 3], label: 'peer D' };
const p5: SceneNode = { id: 'p5', kind: 'client', at: [3.5, -3.5], label: 'peer E' };

// Hexagonal
const hexClient: SceneNode = { id: 'hexClient', kind: 'client', at: [-6, 0], label: 'shopper' };
const restAdapter: SceneNode = { id: 'restAdapter', kind: 'gateway', at: [-3, 0], label: 'REST adapter' };
const core: SceneNode = { id: 'core', kind: 'server', at: [0, 0], label: 'order core', sub: 'no framework imports' };
const sqlAdapter: SceneNode = { id: 'sqlAdapter', kind: 'db', at: [3, 0], label: 'Postgres adapter' };
const payAdapter: SceneNode = { id: 'payAdapter', kind: 'internet', at: [3, -4.5], label: 'card adapter', sub: 'payment provider' };
const testAdapter: SceneNode = { id: 'testAdapter', kind: 'monitor', at: [-3, 4.5], label: 'test fakes', sub: 'in-memory' };

const layeredLinks = [
  { from: 'browser', to: 'web' },
  { from: 'web', to: 'logic' },
  { from: 'logic', to: 'repo' },
  { from: 'repo', to: 'db' },
];
const eventLinks = [
  { from: 'orders', to: 'broker' },
  { from: 'broker', to: 'email', style: 'dashed' as const },
  { from: 'broker', to: 'stock', style: 'dashed' as const },
  { from: 'broker', to: 'analytics', style: 'dashed' as const },
];
const pipeLinks = [
  { from: 'inbox', to: 'probe' },
  { from: 'probe', to: 'transcode' },
  { from: 'transcode', to: 'thumbs' },
  { from: 'thumbs', to: 'outbox' },
];
const peerLinks = [
  { from: 'p1', to: 'p2' },
  { from: 'p2', to: 'p3' },
  { from: 'p3', to: 'p4' },
  { from: 'p4', to: 'p1' },
  { from: 'p2', to: 'p5' },
  { from: 'p5', to: 'p3' },
];
const hexLinks = [
  { from: 'hexClient', to: 'restAdapter' },
  { from: 'restAdapter', to: 'core', label: 'driving port' },
  { from: 'core', to: 'sqlAdapter', label: 'OrderStore port' },
  { from: 'core', to: 'payAdapter', label: 'Payments port' },
  { from: 'testAdapter', to: 'core', style: 'dashed' as const },
];

export const architecturalStyles: Lesson = {
  id: 'architectural-styles',
  title: 'Architectural styles',
  tagline: 'Six shapes that most systems are built from, what each one is good at, and where you have already met them.',
  minutes: 14,
  level: 'Intermediate',
  learn: [
    'Client-server and layered architecture, and why they are the default',
    'Event-driven systems: producers, a broker and independent consumers',
    'Pipes and filters for staged data processing',
    'Peer-to-peer systems with no central server',
    'Hexagonal architecture (ports and adapters) for keeping business rules testable',
  ],
  metrics: [
    { key: 'style', label: 'Style' },
    { key: 'optimizes', label: 'Optimizes for' },
    { key: 'coupling', label: 'Coupling' },
    { key: 'scales', label: 'Scales by' },
  ],
  steps: [
    {
      title: 'No vocabulary',
      tag: 'problem',
      heading: 'Three engineers, three pictures of one system',
      eli5: 'Three friends describe the same town. One talks about streets, one about shops, one about the bus routes. They all mean the same town, but nobody can follow the others.',
      body: [
        'In a design review, one engineer says the new checkout is "a few layers", another calls it "event-driven", and a third says "it is just a server with a database". All three are describing the same boxes on the same whiteboard, and the review stalls on words.',
        'An **architectural style** is a named shape: a set of component types, the rules for how they connect, and the qualities that shape tends to give you. Naming the style tells everyone what is allowed to call what, and what the system is built to be good at.',
        'This lesson covers six styles. Real systems mix several, and seeing which style each part uses is most of the skill.',
      ],
      keyIdea: 'A style is a shared shorthand: name it and everyone knows the parts, the allowed connections and the qualities it buys.',
      metrics: { style: '?', optimizes: '?', coupling: '?', scales: '?' },
      scene: {
        nodes: [browser, { ...web, status: 'active', badge: 'layers?' }, { ...logic, status: 'active', badge: 'events?' }, { ...repo, status: 'active', badge: 'just a server?' }, db],
        links: layeredLinks,
        flows: [
          { path: ['browser', 'web', 'logic', 'repo', 'db'], tone: 'request', duration: 2.4 },
          { path: ['db', 'repo', 'logic', 'web', 'browser'], tone: 'response', duration: 2.4, delay: 2.5 },
        ],
        caption: 'Same boxes, no shared words for them',
      },
    },
    {
      title: 'Client-server',
      tag: 'concept',
      heading: 'Client-server: many askers, one place that answers',
      eli5: 'Many people walk into one **bakery** and ask for bread. The bakery keeps the ovens and the recipes, and the customers only ask and carry bread home.',
      body: [
        'In **client-server**, clients start every conversation and a server answers. The server owns the data and the rules, and clients hold little more than the screen. A browser loading a page, a phone app calling an API and an app server querying Postgres are all client-server.',
        'It optimizes for **central control**: one place to change the rules, enforce security and keep data consistent. Clients can be thin and many. The cost is that the server is the bottleneck and the single point of failure, which is why the earlier lessons added load balancers, replicas and caches behind it.',
        'It is the default shape of the web, and nearly every other style here runs on top of it.',
      ],
      keyIdea: 'Client-server puts data and rules in one place that clients ask. It is simple to secure and reason about, and you scale it by scaling the server side.',
      metrics: { style: 'client-server', optimizes: 'central control', coupling: 'client knows server', scales: 'more servers behind an LB' },
      scene: {
        nodes: [browser, phone, { ...web, label: 'server', sub: 'owns data + rules', status: 'active' }, { ...db, at: [0, 3.5] }],
        links: [{ from: 'browser', to: 'web' }, { from: 'phone', to: 'web' }, { from: 'web', to: 'db' }],
        flows: [
          { path: ['browser', 'web'], tone: 'request', label: 'GET /cart', duration: 1.1 },
          { path: ['phone', 'web'], tone: 'request', label: 'GET /cart', duration: 1.1, delay: 0.4 },
          { path: ['web', 'db', 'web'], tone: 'data', duration: 1.4, delay: 1.3 },
          { path: ['web', 'browser'], tone: 'response', duration: 1.1, delay: 2.8 },
          { path: ['web', 'phone'], tone: 'response', duration: 1.1, delay: 3 },
        ],
        caption: 'Clients ask, the server decides',
      },
    },
    {
      title: 'Layered',
      tag: 'concept',
      heading: 'Layered: each layer talks only to the one below',
      eli5: 'Inside the bakery, the **counter** takes your order, the kitchen bakes, and the storeroom keeps flour. The counter never walks into the storeroom. It asks the kitchen.',
      body: [
        'A **layered** (n-tier) application splits code by technical job. The web layer parses HTTP and formats JSON. The service layer holds business rules such as "a cart may not exceed 50 items". The data layer turns requests into SQL. Each layer calls only the layer directly below it.',
        'It optimizes for **separation of concerns** and familiarity. Most web frameworks lead you here, new engineers know where to look, and you can swap the web layer for a gRPC one without touching the rules.',
        'The weak spot shows as the app grows. One feature, such as "add a discount code", touches every layer, so changes cut across the whole stack. And because the business layer depends on the data layer, the rules end up shaped by the database, which the hexagonal style later in this lesson flips around.',
      ],
      keyIdea: 'Layers separate code by technical role and keep calls flowing one way. They are easy to start with, but features cut across every layer.',
      metrics: { style: 'layered', optimizes: 'separation of concerns', coupling: 'downward only', scales: 'copies of the whole stack' },
      scene: {
        nodes: [browser, { ...web, status: 'active' }, { ...logic, status: 'active', badge: 'cart <= 50 items' }, { ...repo, status: 'active' }, db],
        links: [...layeredLinks, { from: 'web', to: 'repo', style: 'faint' as const, label: 'not allowed' }],
        flows: [
          { path: ['browser', 'web'], tone: 'request', label: 'POST /cart/items', duration: 1 },
          { path: ['web', 'logic'], tone: 'request', label: 'addItem()', duration: 1, delay: 1.1 },
          { path: ['logic', 'repo'], tone: 'request', label: 'save(cart)', duration: 1, delay: 2.2 },
          { path: ['repo', 'db'], tone: 'data', label: 'INSERT', duration: 1, delay: 3.3 },
        ],
        caption: 'Each layer calls only the layer below',
      },
    },
    {
      title: 'Event-driven',
      tag: 'concept',
      heading: 'Event-driven: announce what happened, let others react',
      eli5: 'The bakery pins a note on the town **notice board**: "Order 812 is paid." The delivery van, the flour supplier and the bookkeeper each read it and do their own job. The bakery never calls them.',
      body: [
        'In an **event-driven** system, a component publishes an **event**, a fact in the past tense such as `OrderPlaced`, to a broker. Any number of consumers subscribe and react on their own schedule. The producer does not know who is listening.',
        'It optimizes for **loose coupling and extensibility**. Adding fraud scoring means adding one more subscriber, with no change to the orders code. A slow consumer does not slow the producer, because the broker buffers, as you saw in the message queues lesson.',
        'The cost is visibility. There is no single function that shows what happens after an order is placed, so you need tracing and good event catalogs. Consumers see changes late (eventual consistency), and they must handle duplicates and out-of-order events.',
      ],
      keyIdea: 'Producers announce facts and never wait on consumers. That makes adding behavior cheap and following the full flow harder.',
      metrics: { style: 'event-driven', optimizes: 'loose coupling', coupling: 'via event schema', scales: 'more consumers per topic' },
      scene: {
        nodes: [{ ...orders, status: 'active' }, { ...broker, status: 'active', badge: 'OrderPlaced #812' }, { ...email, status: 'ok' }, { ...stock, status: 'ok' }, { ...analytics, status: 'ok', badge: '3 s behind' }],
        links: eventLinks,
        flows: [
          { path: ['orders', 'broker'], tone: 'event', label: 'OrderPlaced', duration: 1.2 },
          { path: ['broker', 'email'], tone: 'event', duration: 1, delay: 1.3 },
          { path: ['broker', 'stock'], tone: 'event', duration: 1, delay: 1.5 },
          { path: ['broker', 'analytics'], tone: 'event', duration: 1.6, delay: 1.7 },
        ],
        caption: 'One fact published, three independent reactions',
      },
      quiz: {
        question: 'Marketing wants a loyalty-points feature that reacts to every completed order. In an event-driven design, what changes in the orders service?',
        options: [
          'It must call the new loyalty service after each order',
          'Nothing: the loyalty service subscribes to the existing OrderPlaced events',
          'It must write to the loyalty database directly',
          'It must wait for loyalty to confirm before returning to the shopper',
        ],
        answer: 1,
        explain: 'The producer publishes facts without knowing its consumers. A new reaction is a new subscriber, so the orders service is untouched.',
      },
    },
    {
      title: 'Pipes and filters',
      tag: 'concept',
      heading: 'Pipes and filters: a line of single-purpose stages',
      eli5: 'The town **car wash** is a line of stations: soap, brushes, rinse, dryer. Each station does one job and passes the car on. Add a wax station, and nobody else changes.',
      body: [
        'In **pipes and filters**, data flows through a chain of stages. Each **filter** reads input, does one transformation and writes output to a **pipe** that feeds the next stage. A filter knows nothing about who is before or after it, only the format it reads and writes.',
        'It optimizes for **throughput and reuse**. A video platform can validate an upload, transcode it to several resolutions and cut thumbnails, with a queue between stages so each one scales on its own. The slow transcode stage gets 40 workers, and the cheap validation stage gets 2. Unix shell pipelines, ETL jobs and stream processors all use this shape.',
        'It fits badly with interactive request and response, because the end-to-end time is the sum of every stage. Errors also need a plan: a bad record halfway down the line needs a dead-letter place to go.',
      ],
      keyIdea: 'Pipes and filters split processing into independent stages joined by a common format, so each stage can be scaled, swapped or reused.',
      metrics: { style: 'pipes and filters', optimizes: 'throughput', coupling: 'data format only', scales: 'workers per stage' },
      scene: {
        nodes: [inbox, probe, { ...transcode, status: 'hot', badge: '40 workers' }, thumbs, { ...outbox, status: 'ok' }],
        links: pipeLinks,
        flows: [
          { path: ['inbox', 'probe'], tone: 'data', label: 'raw.mov', duration: 1 },
          { path: ['probe', 'transcode'], tone: 'data', label: 'valid', duration: 1, delay: 1.1 },
          { path: ['transcode', 'thumbs'], tone: 'data', label: '3 renditions', duration: 1, delay: 2.2 },
          { path: ['thumbs', 'outbox'], tone: 'data', label: '+ thumbnails', duration: 1, delay: 3.3 },
        ],
        caption: 'Each stage does one job and hands off',
      },
      code: {
        language: 'bash',
        title: 'The oldest pipes and filters: a shell pipeline',
        source: `# Top 5 IPs hitting /checkout with 5xx errors in today's access log.
# Every command is a filter. Every | is a pipe.
cat access.log \\
  | grep ' /checkout ' \\
  | awk '$9 >= 500 { print $1 }' \\
  | sort \\
  | uniq -c \\
  | sort -rn \\
  | head -5

# Swap a stage without touching the others:
#   cat  ->  zcat access.log.gz     (read compressed logs)
#   head -5  ->  head -20           (show more)`,
        highlight: [3, 4, 5, 7, 9],
      },
    },
    {
      title: 'Peer-to-peer',
      tag: 'concept',
      heading: 'Peer-to-peer: everyone is both client and server',
      eli5: 'Neighbors lend each other tools over the fence. There is no tool shop. If you have a ladder you lend it, and if you need a drill you borrow one from whoever has it.',
      body: [
        'In **peer-to-peer**, every node can request and serve. File sharing systems such as BitTorrent split a file into pieces. Each peer downloads pieces from several others and uploads the pieces it already has, so a popular file gets faster as more people want it.',
        'It optimizes for **no central bottleneck and capacity that grows with users**. The cost is control. Peers come and go, some are slow and some may lie, so data must be verified (usually with hashes) and the system must find content without a central index. Many systems keep a small central piece, such as a tracker or bootstrap list, just to help peers find each other.',
        'Inside datacenters you have met a quieter form: databases such as Cassandra treat every node as an equal peer, using gossip to share cluster state, with no single leader.',
      ],
      keyIdea: 'Peer-to-peer removes the central server, so capacity grows with every member, at the price of trust, discovery and consistency.',
      metrics: { style: 'peer-to-peer', optimizes: 'no central bottleneck', coupling: 'shared protocol', scales: 'every new peer adds capacity' },
      scene: {
        nodes: [{ ...p1, badge: 'has pieces 1-40' }, p2, { ...p3, status: 'active', badge: 'needs piece 17' }, p4, p5],
        links: peerLinks,
        flows: [
          { path: ['p1', 'p2', 'p3'], tone: 'data', label: 'piece 17', duration: 1.6 },
          { path: ['p4', 'p3'], tone: 'data', label: 'piece 18', duration: 1.2, delay: 0.6 },
          { path: ['p3', 'p5'], tone: 'data', label: 'piece 2', duration: 1.2, delay: 1.8 },
          { path: ['p5', 'p2'], tone: 'data', label: 'piece 9', duration: 1.2, delay: 2.4 },
        ],
        caption: 'Every peer downloads and uploads at once',
      },
    },
    {
      title: 'Hexagonal',
      tag: 'concept',
      heading: 'Hexagonal: business rules in the middle, plugs on the edge',
      eli5: 'The bakery kitchen has standard **plug sockets**. Any oven, mixer or test lamp that fits the socket works. Swap the oven brand, and the recipes do not change at all.',
      body: [
        '**Hexagonal architecture**, also called **ports and adapters**, puts the business rules in a core that imports no web framework, database driver or vendor SDK. The core declares **ports**: interfaces in its own words, such as `OrderStore` or `Payments`. **Adapters** on the edge implement them: a REST adapter drives the core, a Postgres adapter and a card-provider adapter are driven by it.',
        'Compared with layers, the dependency points the other way. The core does not depend on the database. The database adapter depends on the core’s interface. That is the whole trick.',
        'It optimizes for **testability and replaceable infrastructure**. Tests plug in-memory fakes into the same ports and run thousands of business-rule tests in seconds with no database. Moving from one payment provider to another is a new adapter. The cost is more interfaces and indirection, which is overhead for a simple CRUD app.',
      ],
      keyIdea: 'Hexagonal architecture makes infrastructure depend on the business core through ports, so the rules can be tested and the edges replaced on their own.',
      metrics: { style: 'hexagonal', optimizes: 'testable core', coupling: 'adapters depend on core', scales: 'copies of the whole app' },
      scene: {
        nodes: [hexClient, restAdapter, { ...core, status: 'active' }, sqlAdapter, payAdapter, { ...testAdapter, status: 'ok', badge: '2,000 tests in 4 s' }],
        links: hexLinks,
        flows: [
          { path: ['hexClient', 'restAdapter', 'core'], tone: 'request', label: 'place order', duration: 1.6 },
          { path: ['core', 'payAdapter'], tone: 'request', label: 'Payments.charge', duration: 1, delay: 1.7 },
          { path: ['core', 'sqlAdapter'], tone: 'data', label: 'OrderStore.save', duration: 1, delay: 2.8 },
          { path: ['testAdapter', 'core'], tone: 'handshake', label: 'fakes plug in', duration: 1.2, delay: 0.5 },
        ],
        caption: 'The core defines ports, the edges plug in',
      },
      code: {
        language: 'typescript',
        title: 'A port in the core, two adapters on the edge',
        source: `// core/ports.ts: the core's own words, no imports from pg or any SDK
export interface OrderStore {
  save(order: Order): Promise<void>;
  byId(id: string): Promise<Order | null>;
}

// core/placeOrder.ts: pure business rules
export async function placeOrder(store: OrderStore, cart: Cart): Promise<Order> {
  if (cart.items.length === 0) throw new EmptyCart();
  const order = Order.fromCart(cart);
  await store.save(order);
  return order;
}

// adapters/postgresOrderStore.ts: production
export class PostgresOrderStore implements OrderStore { /* SQL here */ }

// test/fakes.ts: same port, no database
export class InMemoryOrderStore implements OrderStore {
  private rows = new Map<string, Order>();
  async save(o: Order) { this.rows.set(o.id, o); }
  async byId(id: string) { return this.rows.get(id) ?? null; }
}`,
        highlight: [2, 8, 16, 19],
      },
    },
    {
      title: 'Mixed styles',
      tag: 'case',
      heading: 'Case: one shop, four styles at once',
      eli5: 'Our town has a bakery with a counter and kitchen, a notice board, a car wash and neighbors lending tools. One town, many patterns, each where it fits.',
      body: [
        'Take one online shop. Browsers and phones talk to it as **client-server**. Inside, the checkout service is **hexagonal**, so its pricing rules have fast tests. When an order completes it publishes `OrderPlaced`, and email, inventory and analytics react: **event-driven**.',
        'Product videos go through a **pipes and filters** chain of workers. The shop’s session store is a cluster of equal nodes that gossip with each other, a small **peer-to-peer** piece inside the datacenter.',
        'Nobody chose "the architecture" once. Each part picked the style whose strengths matched its job. When you describe a design, name the style per part: it tells the listener what to expect from each box.',
      ],
      keyIdea: 'Real systems combine styles. Pick the style per part of the system, based on what that part needs to be good at.',
      metrics: { style: 'mixed', optimizes: 'per part', coupling: 'varies', scales: 'per part' },
      scene: {
        nodes: [
          { ...browser, sub: 'client-server' },
          { ...web, label: 'checkout', sub: 'hexagonal inside' },
          { ...logic, kind: 'queue', label: 'event broker', sub: 'event-driven' },
          { ...repo, kind: 'worker', label: 'video workers', sub: 'pipes and filters' },
          { ...db, kind: 'cache', label: 'session cluster', sub: 'peer nodes' },
        ],
        links: [
          { from: 'browser', to: 'web' },
          { from: 'web', to: 'logic' },
          { from: 'logic', to: 'repo', style: 'dashed' as const },
          { from: 'web', to: 'db', style: 'faint' as const },
        ],
        flows: [
          { path: ['browser', 'web'], tone: 'request', label: 'checkout', duration: 1.1 },
          { path: ['web', 'logic'], tone: 'event', label: 'OrderPlaced', duration: 1.1, delay: 1.2 },
          { path: ['logic', 'repo'], tone: 'event', duration: 1.1, delay: 2.4 },
          { path: ['web', 'db'], tone: 'data', label: 'session', duration: 1.4, delay: 0.6 },
        ],
        caption: 'Each part uses the style that suits its job',
      },
    },
    {
      title: 'Choosing',
      tag: 'tradeoff',
      heading: 'What each style buys and what it costs',
      eli5: 'Each part of town is shaped for its job. The bakery wants one tidy counter, the car wash wants a line, and the notice board wants anyone to read it. Pick the shape for the job.',
      body: [
        '**Client-server** and **layered** buy simplicity and central control, and cost a central bottleneck and features that cut across layers. **Event-driven** buys loose coupling and easy extension, and costs visibility and immediate consistency. **Pipes and filters** buys throughput and per-stage scaling, and costs end-to-end latency.',
        '**Peer-to-peer** buys capacity that grows with members and no single point of failure, and costs trust and coordination. **Hexagonal** buys a testable core and swappable infrastructure, and costs extra interfaces.',
        'A useful habit: before choosing, write down the two qualities this part must be best at (for example "fast to change" and "never loses an order"). Then pick the style whose strengths match, and check that you can live with its costs.',
      ],
      keyIdea: 'Every style is a trade. Choose by naming the qualities a part most needs, then accept the costs that come with the matching style.',
      metrics: { style: 'compare', optimizes: 'your top 2 qualities', coupling: 'varies', scales: 'varies' },
      scene: {
        nodes: [{ ...orders, status: 'active', badge: 'must not lose orders' }, { ...broker, badge: 'durable log' }, { ...email, status: 'ok' }, { ...stock, status: 'ok' }, { ...analytics, status: 'ok' }],
        links: eventLinks,
        flows: [
          { path: ['orders', 'broker'], tone: 'event', label: 'OrderPlaced', duration: 1.1 },
          { path: ['broker', 'stock'], tone: 'event', duration: 1, delay: 1.2 },
          { path: ['broker', 'email'], tone: 'event', duration: 1, delay: 1.4 },
          { path: ['broker', 'analytics'], tone: 'event', duration: 1, delay: 1.6 },
        ],
        caption: 'Name the qualities first, then pick the shape',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Six shapes, each with a job',
      eli5: 'Our town has a bakery counter, a kitchen behind it, a notice board, a car wash line, neighbors who share, and plug sockets for any oven. Each shape fits one kind of job.',
      body: [
        '**Client-server** centralizes data and rules. **Layered** splits code by technical role with calls flowing down. **Event-driven** publishes facts that independent consumers react to. **Pipes and filters** chains single-purpose stages. **Peer-to-peer** makes every node both client and server. **Hexagonal** keeps business rules in a core that infrastructure plugs into through ports.',
        'Real systems combine them, one style per part. Naming the style in a design review tells everyone the parts, the allowed connections and the qualities to expect.',
      ],
      keyIdea: 'Know the six shapes well enough to spot them, name them, and pick one per part based on what that part must do best.',
      metrics: { style: 'all six', optimizes: 'per part', coupling: 'varies', scales: 'varies' },
      scene: {
        nodes: [hexClient, restAdapter, { ...core, status: 'ok' }, sqlAdapter, payAdapter, testAdapter],
        links: hexLinks,
        flows: [
          { path: ['hexClient', 'restAdapter', 'core', 'sqlAdapter'], tone: 'request', duration: 2.2 },
          { path: ['core', 'payAdapter'], tone: 'request', duration: 1, delay: 1.4 },
        ],
      },
      quiz: {
        question: 'A team wants to run thousands of pricing-rule tests in seconds without a database, and expects to change payment provider next year. Which style fits that part best?',
        options: ['Peer-to-peer', 'Pipes and filters', 'Hexagonal (ports and adapters)', 'Plain client-server'],
        answer: 2,
        explain: 'Hexagonal keeps the rules in a core that talks to storage and payments through ports. Tests plug in fakes, and a new payment provider is a new adapter.',
      },
    },
  ],
};
