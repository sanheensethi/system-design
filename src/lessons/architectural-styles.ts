import type { Lesson, SceneLink, SceneNode, Tint } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const blk = (id: string, d: number, s: number, label: string, icon: string, tint: Tint, extra: Partial<SceneNode> = {}): SceneNode => ({
  id, kind: 'block', at: at(d, s), label, icon, tint, ...extra,
});
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

// Shared client-server objects
const browser: SceneNode = { id: 'browser', kind: 'client', at: at(-5.7, 0), label: 'browser' };
const phone: SceneNode = { id: 'phone', kind: 'phone', at: at(-4.5, 3.6), label: 'mobile app' };
const server = blk('server', 0, 0, 'server', 'Server', 'violet', { sub: 'owns data + rules' });
const db: SceneNode = { id: 'db', kind: 'db', at: at(4.5, 0), label: 'Postgres' };

// Layered
const web = blk('web', -1.9, 0, 'web layer', 'Globe', 'blue', { sub: 'HTTP, JSON' });
const logic = blk('logic', 1.9, 0, 'service layer', 'Cpu', 'violet', { sub: 'business rules' });
const repo = blk('repo', 5.7, 0, 'data layer', 'Database', 'teal', { sub: 'SQL lives here' });

// Event-driven
const orders = blk('orders', -5.7, 0, 'orders', 'ShoppingBag', 'amber', { sub: 'producer' });
const broker: SceneNode = { id: 'broker', kind: 'queue', at: at(-1.9, 0), label: 'event broker', sub: 'topic: orders' };
const email = blk('email', 2.5, -4.2, 'email', 'Mail', 'blue', { size: 0.72 });
const stock = blk('stock', 5.7, 0, 'inventory', 'Package', 'green', { size: 0.72 });
const analytics = blk('analytics', 2.5, 4.2, 'analytics', 'TrendingUp', 'violet', { size: 0.72 });

const payS = blk('payS', -3.6, 3.2, 'payment', 'Receipt', 'amber', { size: 0.72 });
const shipS = blk('shipS', 0, 3.2, 'shipping', 'Package', 'green', { size: 0.72 });
const mailS = blk('mailS', 3.6, 3.2, 'email', 'Mail', 'blue', { size: 0.72 });

const eventLinks = [
  link('orders', 'broker'),
  link('broker', 'email', { style: 'dashed' }),
  link('broker', 'stock', { style: 'dashed' }),
  link('broker', 'analytics', { style: 'dashed' }),
];

export const architecturalStyles: Lesson = {
  id: 'architectural-styles',
  title: 'Architectural styles (part 1)',
  tagline: 'Client-server, tiers, layers and event-driven systems: what each shape is good at, what it costs, and where you have already met it.',
  minutes: 12,
  level: 'Intermediate',
  learn: [
    'What a style is, and how it differs from a single pattern',
    'Client-server, tiers and thin or thick clients',
    'Layered architecture, strict and relaxed, and where it strains',
    'Event-driven systems: producers, a broker, consumers, choreography and orchestration',
  ],
  metrics: [
    { key: 'style', label: 'Style', icon: 'Layers' },
    { key: 'optimizes', label: 'Optimizes for', icon: 'Gauge' },
    { key: 'coupling', label: 'Coupling', icon: 'Plug' },
    { key: 'scales', label: 'Scales by', icon: 'TrendingUp' },
  ],
  steps: [
    {
      title: 'No vocabulary',
      tag: 'problem',
      heading: 'Three engineers, three pictures of one system',
      eli5: 'Three friends describe the same town. One talks about streets, one about shops, one about bus routes. They mean the same town, but nobody can follow the others.',
      body: [
        'In a design review, one engineer says the new checkout is "a few layers", another calls it "event-driven", and a third says "it is just a server with a database". All three describe the same boxes, and the review stalls on words.',
      ],
      keyIdea: 'Without shared names for system shapes, design reviews argue about words instead of trade-offs.',
      metrics: { style: '?', optimizes: '?', coupling: '?', scales: '?' },
      metricTones: { style: 'bad' },
      scene: {
        nodes: [
          browser,
          { ...web, status: 'active', badge: 'layers?' },
          { ...logic, status: 'active', badge: 'events?' },
          { ...repo, status: 'active', badge: 'just a server?' },
        ],
        links: [link('browser', 'web'), link('web', 'logic'), link('logic', 'repo')],
        flows: [
          { path: ['browser', 'web', 'logic', 'repo'], tone: 'request', duration: 2.4 },
        ],
        panel: {
          title: 'Review notes',
          icon: 'List',
          rows: [
            { text: 'Engineer 1', value: '"a few layers"', tone: 'warn' },
            { text: 'Engineer 2', value: '"event-driven"', tone: 'warn' },
            { text: 'Engineer 3', value: '"a server and a DB"', tone: 'warn' },
          ],
          footer: { text: 'Same boxes, no shared words', tone: 'bad' },
        },
        caption: 'Same boxes, no shared words for them',
      },
    },
    {
      title: 'Style defined',
      tag: 'concept',
      heading: 'A style is a named shape with rules and qualities',
      eli5: 'A town can be laid out as one main street or as a ring road. Each layout has rules for how people get around and is good at some things. The layout has a name, so planners can talk about it.',
      body: [
        'An **architectural style** names three things: the kinds of components, the rules for how they connect, and the qualities the shape tends to give you. A single **pattern** such as a cache is smaller. A style shapes the whole system or a whole part of it.',
        'Naming the style tells everyone what may call what, and what the design is built to be good at.',
      ],
      keyIdea: 'A style is components plus connection rules plus the qualities that result. Name it and the listener knows what to expect.',
      metrics: { style: 'any', optimizes: 'a few qualities', coupling: 'set by the rules', scales: 'depends' },
      scene: {
        nodes: [
          blk('parts', -3.8, 0, 'components', 'Boxes', 'blue'),
          blk('rules', 0, 0, 'connection rules', 'Cable', 'violet'),
          blk('quals', 3.8, 0, 'qualities', 'Gauge', 'green'),
        ],
        links: [link('parts', 'rules'), link('rules', 'quals')],
        flows: [{ path: ['parts', 'rules', 'quals'], tone: 'handshake', duration: 2 }],
        panel: {
          title: 'Style versus pattern',
          icon: 'Layers',
          rows: [
            { text: 'Style', value: 'shape of a whole system', tone: 'good' },
            { text: 'Pattern', value: 'one local trick (cache, retry)' },
            { text: 'Architecture', value: 'your actual system' },
          ],
          footer: { text: 'A real system uses several styles', tone: 'muted' },
        },
        caption: 'Parts, rules and the qualities they buy',
      },
    },
    {
      title: 'Client-server',
      tag: 'concept',
      heading: 'Client-server: many askers, one place that answers',
      eli5: 'Many people walk into one **bakery** and ask for bread. The bakery keeps the ovens and recipes. The customers only ask and carry bread home.',
      body: [
        'In **client-server**, clients start every conversation and a server answers. The server owns the data and the rules. A browser loading a page, a phone app calling an API and an app server querying Postgres are all client-server.',
        'It optimizes for **central control**: one place to change rules and enforce security.',
      ],
      keyIdea: 'Client-server puts data and rules in one place that clients ask. It is simple to secure and reason about.',
      metrics: { style: 'client-server', optimizes: 'central control', coupling: 'client knows server', scales: 'more servers behind an LB' },
      metricTones: { optimizes: 'good' },
      scene: {
        nodes: [
          { ...browser, at: at(-4.5, -2.8), chips: ['GET /cart'] },
          { ...phone, at: at(-4.5, 2.8), chips: ['GET /cart'] },
          { ...server, status: 'active' },
          { ...db, at: at(4.5, 0) },
        ],
        links: [link('browser', 'server'), link('phone', 'server'), link('server', 'db')],
        flows: [
          { path: ['browser', 'server'], tone: 'request', label: 'GET /cart', duration: 1.1 },
          { path: ['phone', 'server'], tone: 'request', label: 'GET /cart', duration: 1.1, delay: 0.4 },
          { path: ['server', 'db', 'server'], tone: 'data', duration: 1.4, delay: 1.3 },
          { path: ['server', 'browser'], tone: 'response', duration: 1.1, delay: 2.8 },
        ],
        caption: 'Clients ask, the server decides',
      },
    },
    {
      title: 'Client-server cost',
      tag: 'tradeoff',
      heading: 'The server becomes the bottleneck and the single point of failure',
      eli5: 'If everyone only buys from one **bakery**, a long queue forms at the door. If the oven breaks, the whole town goes without bread.',
      body: [
        'Every client depends on the one server side. When load exceeds what one machine can handle, it saturates, and if it dies, every client fails together.',
        'This is why earlier lessons added load balancers, replicas and caches behind the server. Those make the server side bigger, and the style stays the same.',
      ],
      keyIdea: 'Central control costs a central bottleneck. You scale client-server by scaling the server side, not by changing the style.',
      metrics: { style: 'client-server', optimizes: 'central control', coupling: 'client knows server', scales: 'more servers behind an LB' },
      metricTones: { scales: 'warn' },
      scene: {
        nodes: [
          { ...browser, at: at(-4.5, -2.8), chips: ['example load'] },
          { ...phone, at: at(-4.5, 2.8) },
          { ...server, status: 'hot', load: 96, badge: 'one box' },
        ],
        links: [link('browser', 'server', { label: 'peak traffic', labelTone: 'warn' }), link('phone', 'server')],
        flows: [
          { path: ['browser', 'server'], tone: 'request', count: 3, duration: 0.9 },
          { path: ['phone', 'server'], tone: 'request', count: 2, duration: 0.9, delay: 0.3 },
        ],
        panel: {
          title: 'If the server fails',
          icon: 'Bug',
          rows: [
            { text: 'Browsers', value: 'blank page', tone: 'bad' },
            { text: 'Mobile app', value: 'spinner', tone: 'bad' },
            { text: 'Fix', value: 'LB + replicas + cache', tone: 'good' },
          ],
        },
        caption: 'One server side, one shared fate',
      },
    },
    {
      title: 'Tiers',
      tag: 'concept',
      heading: 'Tiers: where the work runs, and how thick the client is',
      eli5: 'A **bakery** can do everything at one counter, or have a front desk, a kitchen and a pantry in separate rooms. A thin customer only points. A thick one brings a half-made dough.',
      body: [
        'A **tier** is a separate machine or process boundary. **2-tier** is a client talking straight to a database. **3-tier** adds an app server between them, so clients never hold database credentials.',
        'A **thin client** (a browser page) does little and trusts the server. A **thick client** (a game, a desktop app) runs much of the logic itself and needs updates shipped.',
      ],
      keyIdea: 'Tiers are separate runtime boundaries. A 3-tier app keeps rules and credentials off the client.',
      metrics: { style: '3-tier client-server', optimizes: 'safe data access', coupling: 'via the app tier', scales: 'each tier on its own' },
      scene: {
        nodes: [
          browser,
          blk('app', 0, 0, 'app tier', 'Server', 'violet', { sub: 'rules, auth' }),
          { ...db, at: at(4.5, 0), sub: 'data tier' },
        ],
        links: [link('browser', 'app', { label: 'tier 1 to 2' }), link('app', 'db', { label: 'tier 2 to 3' })],
        flows: [
          { path: ['browser', 'app', 'db'], tone: 'request', duration: 2 },
          { path: ['db', 'app', 'browser'], tone: 'response', duration: 2, delay: 2.1 },
        ],
        panel: {
          title: 'Thin or thick client',
          icon: 'Laptop',
          rows: [
            { text: 'Thin (web page)', value: 'logic on server', tone: 'good' },
            { text: 'Thick (game, desktop)', value: 'logic on client', tone: 'warn' },
            { text: 'Direct to DB (2-tier)', value: 'credentials on client', tone: 'bad' },
          ],
        },
        caption: 'Clients never touch the database directly',
      },
    },
    {
      title: 'Layered',
      tag: 'concept',
      heading: 'Layered: each layer talks only to the one below',
      eli5: 'Inside the bakery, the **counter** takes your order, the kitchen bakes, and the storeroom keeps flour. The counter never walks into the storeroom. It asks the kitchen.',
      body: [
        'A **layered** application splits code by technical job. The web layer parses HTTP and formats JSON. The service layer holds business rules such as "a cart may not exceed 50 items". The data layer turns requests into SQL.',
        'Each layer calls only the layer directly below it.',
      ],
      keyIdea: 'Layers separate code by technical role and keep calls flowing one way.',
      metrics: { style: 'layered', optimizes: 'separation of concerns', coupling: 'downward only', scales: 'copies of the whole stack' },
      scene: {
        nodes: [
          browser,
          { ...web, status: 'active' },
          { ...logic, status: 'active', badge: 'cart <= 50 items' },
          { ...repo, status: 'active' },
        ],
        links: [link('browser', 'web'), link('web', 'logic'), link('logic', 'repo')],
        flows: [
          { path: ['browser', 'web'], tone: 'request', label: 'POST /cart/items', duration: 1 },
          { path: ['web', 'logic'], tone: 'request', label: 'addItem()', duration: 1, delay: 1.1 },
          { path: ['logic', 'repo'], tone: 'request', label: 'save(cart)', duration: 1, delay: 2.2 },
        ],
        caption: 'Each layer calls only the layer below',
      },
    },
    {
      title: 'Swap a layer',
      tag: 'concept',
      heading: 'Layers are familiar, and an edge layer can be swapped',
      eli5: 'Every **bakery** worker knows which room to go to. The counter can be repainted without touching the kitchen.',
      body: [
        'Most web frameworks lead you to layers, so new engineers know where to look.',
        'Because each layer only talks to the one below, you can swap the web layer for a gRPC one without touching the rules or the data layer.',
      ],
      keyIdea: 'Layers are familiar, and a top layer can be replaced while the rules stay put.',
      metrics: { style: 'layered', optimizes: 'familiarity, swappable edges', coupling: 'downward only', scales: 'copies of the whole stack' },
      metricTones: { optimizes: 'good' },
      scene: {
        nodes: [
          { ...web, label: 'gRPC layer', icon: 'Zap', tint: 'amber', status: 'ok', badge: 'swapped in' },
          { ...logic, status: 'ok', badge: 'unchanged' },
          { ...repo, status: 'ok', badge: 'unchanged' },
        ],
        links: [link('web', 'logic'), link('logic', 'repo')],
        flows: [{ path: ['web', 'logic', 'repo'], tone: 'request', duration: 2 }],
        caption: 'Swap the top layer, the rules stay',
      },
    },
    {
      title: 'Strict or relaxed',
      tag: 'concept',
      heading: 'Strict layers keep rules tight, relaxed layers skip',
      eli5: 'In a strict **bakery** the counter only talks to the kitchen. In a relaxed one the counter may also run to the storeroom, which is quicker and gets messy.',
      body: [
        '**Strict** layering allows calls only to the next layer down. **Relaxed** layering lets a layer skip down, which is faster to write and leaks rules: the web layer can now run SQL and bypass the service layer.',
      ],
      keyIdea: 'Strict layering keeps the rules in one place. Relaxed layering trades that for speed of writing.',
      metrics: { style: 'layered', optimizes: 'separation of concerns', coupling: 'downward only, or skipping', scales: 'copies of the whole stack' },
      metricTones: { coupling: 'warn' },
      scene: {
        nodes: [
          { ...web, status: 'active' },
          { ...logic, status: 'active' },
          { ...repo, status: 'active' },
        ],
        links: [link('web', 'logic'), link('logic', 'repo'), link('web', 'repo', { style: 'faint', label: 'relaxed: skips a layer', labelTone: 'warn', route: 'straight' })],
        flows: [{ path: ['web', 'logic', 'repo'], tone: 'request', duration: 2 }],
        panel: {
          title: 'Strict or relaxed',
          icon: 'Layers',
          rows: [
            { text: 'Strict', value: 'next layer down only', tone: 'good' },
            { text: 'Relaxed', value: 'may skip layers', tone: 'warn' },
          ],
        },
        caption: 'The faint link skips the service layer',
      },
    },
    {
      title: 'Layer strain',
      tag: 'tradeoff',
      heading: 'Features cut across every layer',
      eli5: 'Adding a new kind of bread means changing the counter menu, the kitchen recipe and the storeroom shelf all at once. Rooms are neat, but one job still touches all of them.',
      body: [
        'One feature, such as "add a discount code", touches every layer, so changes cut across the whole stack. And since the service layer depends on the data layer, the rules end up shaped by the database.',
        'The hexagonal style in part 2 flips that dependency around.',
      ],
      keyIdea: 'Layers split by technical role, so a business change touches all of them, and the rules lean on the database.',
      metrics: { style: 'layered', optimizes: 'separation of concerns', coupling: 'rules depend on the DB', scales: 'copies of the whole stack' },
      metricTones: { coupling: 'warn' },
      scene: {
        nodes: [
          { ...web, status: 'hot', badge: 'edit' },
          { ...logic, status: 'hot', badge: 'edit' },
          { ...repo, status: 'hot', badge: 'edit' },
        ],
        links: [link('web', 'logic'), link('logic', 'repo', { label: 'depends on', labelTone: 'warn' })],
        flows: [{ path: ['web', 'logic', 'repo'], tone: 'error', duration: 2 }],
        panel: {
          title: 'Feature: discount code',
          icon: 'Receipt',
          rows: [
            { text: 'Web layer', value: 'new request field', tone: 'warn' },
            { text: 'Service layer', value: 'new rule', tone: 'warn' },
            { text: 'Data layer', value: 'new column', tone: 'warn' },
          ],
          footer: { text: 'One feature, three layers changed', tone: 'bad' },
        },
        caption: 'One feature changes every layer',
      },
    },
    {
      title: 'Event-driven',
      tag: 'concept',
      heading: 'Event-driven: announce what happened, let others react',
      eli5: 'The bakery pins a note on the town **notice board**: "Order 812 is paid." The delivery van, the flour supplier and the bookkeeper each read it and do their own job. The bakery never calls them.',
      body: [
        'In an **event-driven** system, a component publishes an **event**, a fact in the past tense such as `OrderPlaced`, to a broker. Any number of consumers subscribe and react on their own schedule.',
        'The producer does not know who is listening.',
      ],
      keyIdea: 'Producers announce facts and never wait on consumers.',
      metrics: { style: 'event-driven', optimizes: 'loose coupling', coupling: 'via event schema', scales: 'more consumers per topic' },
      scene: {
        nodes: [
          { ...orders, status: 'active', chips: ['OrderPlaced #812'] },
          { ...broker, status: 'active' },
          email,
          stock,
          analytics,
        ],
        links: eventLinks,
        flows: [
          { path: ['orders', 'broker'], tone: 'event', label: 'OrderPlaced', duration: 1.2 },
          { path: ['broker', 'email'], tone: 'event', duration: 1, delay: 1.3 },
          { path: ['broker', 'stock'], tone: 'event', duration: 1, delay: 1.5 },
          { path: ['broker', 'analytics'], tone: 'event', duration: 1, delay: 1.7 },
        ],
        caption: 'One fact published, three independent reactions',
      },
    },
    {
      title: 'Event kinds',
      tag: 'concept',
      heading: 'Events, commands, and how much an event carries',
      eli5: 'A note on the **notice board** says what happened. A command is a note that tells one shop what to do. A note can be short, "order 812", or carry the whole order slip.',
      body: [
        'An **event** states a fact (`OrderPlaced`). A **command** asks one service to act (`ChargeCard`). Events fit broadcasting, commands fit directing.',
        'An **event notification** carries only an id, so consumers call back for details. **Event-carried state** includes the data, so they need no call. Keeping every event as the source of truth is event sourcing, a later lesson.',
      ],
      keyIdea: 'Events state facts and commands direct one service. Carrying state in the event saves callbacks and makes it bigger.',
      metrics: { style: 'event-driven', optimizes: 'loose coupling', coupling: 'via event schema', scales: 'more consumers per topic' },
      scene: {
        nodes: [
          { ...orders, status: 'active', chips: ['OrderPlaced'] },
          broker,
          { ...stock, status: 'active' },
        ],
        links: [link('orders', 'broker'), link('broker', 'stock', { style: 'dashed' })],
        flows: [
          { path: ['orders', 'broker'], tone: 'event', label: 'OrderPlaced', duration: 1.2 },
          { path: ['broker', 'stock'], tone: 'event', label: '{ id: 812 }', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Event or command',
          icon: 'List',
          rows: [
            { text: 'Event', value: 'a fact, past tense', tone: 'good' },
            { text: 'Command', value: 'a request to one service' },
            { text: 'Notification', value: 'id only, consumer calls back' },
            { text: 'Carried state', value: 'full order inside', tone: 'good' },
          ],
        },
        caption: 'A fact on the board, with just the id',
      },
    },
    {
      title: 'Extensibility',
      tag: 'concept',
      heading: 'A new reaction is a new subscriber',
      eli5: 'The bakery adds a loyalty clerk who also reads the **notice board**. The bakery does not change a thing, because it never knew who read the notes.',
      body: [
        'Adding fraud scoring means adding one more subscriber. The orders code is untouched. A slow consumer does not slow the producer, because the broker buffers, as you saw in the message queues lesson.',
      ],
      keyIdea: 'Event-driven buys loose coupling: extend behavior by adding consumers, not by editing the producer.',
      metrics: { style: 'event-driven', optimizes: 'loose coupling', coupling: 'via event schema', scales: 'more consumers per topic' },
      metricTones: { coupling: 'good' },
      scene: {
        nodes: [
          { ...orders, status: 'ok', badge: 'unchanged' },
          broker,
          { ...stock, status: 'ok' },
          blk('fraud', 2.5, 4.2, 'fraud score', 'Shield', 'red', { size: 0.72, status: 'active', badge: 'new' }),
        ],
        links: [link('orders', 'broker'), link('broker', 'stock', { style: 'dashed' }), link('broker', 'fraud', { style: 'dashed' })],
        flows: [
          { path: ['orders', 'broker'], tone: 'event', label: 'OrderPlaced', duration: 1.2 },
          { path: ['broker', 'stock'], tone: 'event', duration: 1, delay: 1.3 },
          { path: ['broker', 'fraud'], tone: 'event', duration: 1, delay: 1.5 },
        ],
        caption: 'Add a subscriber, leave the producer alone',
      },
    },
    {
      title: 'Topics, queues',
      tag: 'concept',
      heading: 'Fan-out to groups, competing consumers inside a group',
      eli5: 'Every shop that reads the **notice board** gets its own copy of each note. If two vans share one job, each note goes to just one of the vans.',
      body: [
        'With **pub/sub**, each consumer group gets every event: inventory and analytics both see #812. Inside one group the instances are **competing consumers**, so each event goes to only one of them.',
        'Add instances to a group to work faster. Add a group to give a new feature its own copy.',
      ],
      keyIdea: 'Groups fan out, instances inside a group share the work.',
      metrics: { style: 'event-driven', optimizes: 'loose coupling', coupling: 'via event schema', scales: 'instances per group' },
      metricTones: { scales: 'good' },
      scene: {
        nodes: [
          { ...broker, at: at(-4, 0), status: 'active' },
          blk('inv1', 2.5, -4.6, 'inventory 1', 'Package', 'green', { size: 0.72, sub: 'group: inventory' }),
          blk('inv2', 2.5, -0.2, 'inventory 2', 'Package', 'green', { size: 0.72, sub: 'group: inventory' }),
          { ...analytics, at: at(2.5, 4.2), sub: 'group: analytics' },
        ],
        links: [link('broker', 'inv1', { style: 'dashed' }), link('broker', 'inv2', { style: 'dashed' }), link('broker', 'analytics', { style: 'dashed' })],
        flows: [
          { path: ['broker', 'inv1'], tone: 'event', label: '#812', duration: 1.2 },
          { path: ['broker', 'inv2'], tone: 'event', label: '#813', duration: 1.2, delay: 0.3 },
          { path: ['broker', 'analytics'], tone: 'event', label: '#812, #813', duration: 1.2, delay: 0.6 },
        ],
        panel: {
          title: 'Who gets an event',
          icon: 'Rss',
          rows: [
            { text: 'Each group', value: 'every event', tone: 'good' },
            { text: 'Inside a group', value: 'one instance per event' },
          ],
        },
        caption: 'Groups get copies, instances split the load',
      },
    },
    {
      title: 'Delivery, ordering',
      tag: 'concept',
      heading: 'At-least-once delivery, ordered per key',
      eli5: 'If the van driver reads a note but forgets to tell the board, the board posts it again. Notes about the same order stay in one pile, in order.',
      body: [
        'Brokers usually promise **at-least-once** delivery. If a consumer crashes or its acknowledgement is lost, the broker sends the event again, so duplicates are normal.',
        'Order holds only per key. Events with the same **partition key**, such as the order id, land in one partition and stay in order. Across keys there is no promise.',
      ],
      keyIdea: 'At-least-once delivery explains duplicates, and a partition key keeps related events in order.',
      metrics: { style: 'event-driven', optimizes: 'loose coupling', coupling: 'via event schema', scales: 'partitions per topic' },
      scene: {
        nodes: [
          orders,
          { ...broker, status: 'active', chips: ['key = order id'] },
          { ...stock, status: 'active' },
        ],
        links: [link('orders', 'broker'), link('broker', 'stock', { style: 'dashed' })],
        flows: [
          { path: ['orders', 'broker'], tone: 'event', duration: 1.1 },
          { path: ['broker', 'stock'], tone: 'event', label: '#812', duration: 1, delay: 1.2 },
          { path: ['stock', 'broker'], tone: 'error', label: 'ack lost', duration: 1, delay: 2.3 },
          { path: ['broker', 'stock'], tone: 'event', label: '#812 again', duration: 1, delay: 3.4 },
        ],
        panel: {
          title: 'What the broker promises',
          icon: 'Hash',
          rows: [
            { text: 'Delivery', value: 'at least once', tone: 'warn' },
            { text: 'Same key', value: 'one partition, in order', tone: 'good' },
            { text: 'Different keys', value: 'no order promise', tone: 'warn' },
          ],
        },
        caption: 'A lost acknowledgement means a resend',
      },
    },
    {
      title: 'Choreography',
      tag: 'concept',
      heading: 'Choreography: each service reacts and emits its own event',
      eli5: 'Each shop reads the **notice board** and pins its own note when done. Payment pins "paid", shipping reads it and pins "shipped". Nobody is in charge, and the show still works.',
      body: [
        '**Choreography**: each service reacts to an event and emits the next one. Payment emits `PaymentTaken`, shipping reacts and emits `Shipped`, and email reacts to that.',
        'No one owns the whole flow. That keeps services loose, and it makes the flow harder to follow.',
      ],
      keyIdea: 'Choreography spreads the flow across subscribers, with no owner.',
      metrics: { style: 'event-driven', optimizes: 'loose coupling', coupling: 'events only', scales: 'more consumers per topic' },
      scene: {
        nodes: [
          { ...payS, at: at(-5.2, 0) },
          { ...broker, at: at(-1.5, 0), status: 'active', sub: 'topic: order-flow' },
          { ...shipS, at: at(2.8, -3.6) },
          { ...mailS, at: at(2.8, 3.6) },
        ],
        links: [link('payS', 'broker'), link('broker', 'shipS', { style: 'dashed' }), link('broker', 'mailS', { style: 'dashed' })],
        flows: [
          { path: ['payS', 'broker', 'shipS'], tone: 'event', label: 'PaymentTaken', duration: 1.8 },
          { path: ['shipS', 'broker', 'mailS'], tone: 'event', label: 'Shipped', duration: 1.8, delay: 2 },
        ],
        caption: 'Each step reacts to the last event',
      },
    },
    {
      title: 'Orchestration',
      tag: 'concept',
      heading: 'Orchestration: one coordinator calls each step',
      eli5: 'Instead of reading the board, the shops wait for a conductor. The conductor tells payment to go, then shipping, then email, and tracks who is done.',
      body: [
        '**Orchestration**: a coordinator calls each step in order and tracks progress. The whole flow is readable in one place.',
        'The cost is that the coordinator is a dependency every step relies on. Choose it when the order matters and you need to see where an order is stuck.',
      ],
      keyIdea: 'Orchestration puts the flow in one coordinator, which is easy to read and becomes a dependency.',
      metrics: { style: 'event-driven', optimizes: 'visible flow', coupling: 'a coordinator', scales: 'more consumers per topic' },
      scene: {
        nodes: [
          blk('coord', 0, -3.6, 'coordinator', 'Workflow', 'violet', { size: 0.72 }),
          { ...payS, at: at(-3.6, 3.2) },
          { ...shipS, at: at(0, 3.2) },
          { ...mailS, at: at(3.6, 3.2) },
        ],
        links: [link('coord', 'payS', { label: 'step 1' }), link('coord', 'shipS', { label: 'step 2' }), link('coord', 'mailS', { label: 'step 3' })],
        flows: [
          { path: ['coord', 'payS'], tone: 'request', duration: 1, delay: 0 },
          { path: ['coord', 'shipS'], tone: 'request', duration: 1, delay: 1.2 },
          { path: ['coord', 'mailS'], tone: 'request', duration: 1, delay: 2.4 },
        ],
        panel: {
          title: 'Who owns the flow',
          icon: 'Workflow',
          rows: [
            { text: 'Choreography', value: 'nobody, events only', tone: 'warn' },
            { text: 'Orchestration', value: 'the coordinator', tone: 'good' },
          ],
        },
        caption: 'A coordinator calls each step in order',
      },
    },
    {
      title: 'Late and swapped',
      tag: 'tradeoff',
      heading: 'The price: consumers see changes late and out of order',
      eli5: 'One reader of the **notice board** is slow and arrives late. Notes pinned on different boards can be read in the wrong order, so each reader checks the date on a note.',
      body: [
        'Consumers read when they can, so a slow one sees a change seconds after it happened. That is **eventual consistency**: every copy agrees in the end, not at the same moment.',
        'Order is only kept per key, so events on different keys can arrive swapped. A consumer checks a version number before it applies a change.',
      ],
      keyIdea: 'Consumers must expect events that arrive late and in a different order than they happened.',
      metrics: { style: 'event-driven', optimizes: 'loose coupling', coupling: 'via event schema', scales: 'more consumers per topic' },
      metricTones: { coupling: 'good', scales: 'warn' },
      scene: {
        nodes: [
          orders,
          { ...broker, status: 'active' },
          { ...analytics, status: 'hot', badge: '3 s behind', chips: [{ text: '#813 before #812', tone: 'warn' }] },
        ],
        links: [link('orders', 'broker'), link('broker', 'analytics', { style: 'dashed', label: 'lag', labelTone: 'warn' })],
        flows: [
          { path: ['orders', 'broker'], tone: 'event', duration: 1.2 },
          { path: ['broker', 'analytics'], tone: 'event', duration: 1.8, delay: 1.3 },
        ],
        panel: {
          title: 'Consumers must cope with',
          icon: 'Timer',
          rows: [
            { text: 'Lag', value: 'eventual consistency', tone: 'warn' },
            { text: 'Different keys', value: 'no order promise', tone: 'warn' },
            { text: 'Fix', value: 'check a version number', tone: 'good' },
          ],
        },
        caption: 'Late, and sometimes out of order',
      },
    },
    {
      title: 'Duplicates, tracing',
      tag: 'tradeoff',
      heading: 'The price: repeats, and no single place to read the flow',
      eli5: 'One reader reads the same note twice by mistake and bakes two cakes. And nobody can see which shops read a note, unless each one signs a sheet.',
      body: [
        'Because delivery is at least once, a consumer can see event #812 twice. It records handled event ids and skips repeats, so the work is **idempotent**.',
        'No single function shows what happens after an order is placed. You need a trace id on every event and an event catalog that lists who consumes what.',
      ],
      keyIdea: 'Event-driven gives you flexibility and charges for duplicate handling and for visibility.',
      metrics: { style: 'event-driven', optimizes: 'loose coupling', coupling: 'via event schema', scales: 'more consumers per topic' },
      metricTones: { coupling: 'good', scales: 'warn' },
      scene: {
        nodes: [
          orders,
          { ...broker, status: 'active' },
          { ...stock, status: 'ok', chips: ['#812 seen twice'] },
          { id: 'trace', kind: 'monitor', at: at(2.5, 4.2), label: 'tracing', sub: 'one trace id per order' },
        ],
        links: [link('orders', 'broker'), link('broker', 'stock', { style: 'dashed' }), link('broker', 'trace', { style: 'dashed' })],
        flows: [
          { path: ['orders', 'broker'], tone: 'event', duration: 1.2 },
          { path: ['broker', 'stock'], tone: 'event', count: 2, duration: 1, delay: 1.3 },
          { path: ['broker', 'trace'], tone: 'data', duration: 1, delay: 1.5 },
        ],
        panel: {
          title: 'What to build in',
          icon: 'Bug',
          rows: [
            { text: 'Duplicates', value: 'dedupe by event id', tone: 'warn' },
            { text: 'Visibility', value: 'trace id on every event', tone: 'warn' },
            { text: 'Catalog', value: 'who consumes which event', tone: 'good' },
          ],
        },
        caption: 'Repeated events, hard to follow',
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
      title: 'Part 1 recap',
      tag: 'recap',
      heading: 'Three styles down, more to go',
      eli5: 'So far the town has a bakery counter, a kitchen behind it and a notice board. Next come the car wash line, neighbors who share, and plug sockets.',
      body: [
        '**Client-server** centralizes data and rules, and you scale it by growing the server side. **Layered** splits code by role, and one feature touches every layer. **Event-driven** publishes facts that independent consumers react to, and charges for visibility.',
        'Part 2 covers pipes and filters, peer-to-peer, hexagonal and microkernel, then how to mix and choose.',
      ],
      keyIdea: 'Client-server, layered and event-driven are the common starting shapes. Each buys one quality and charges for another.',
      metrics: { style: 'three so far', optimizes: 'per part', coupling: 'varies', scales: 'varies' },
      scene: {
        nodes: [browser, { ...web, status: 'ok' }, { ...logic, status: 'ok' }, { ...repo, status: 'ok' }],
        links: [link('browser', 'web'), link('web', 'logic'), link('logic', 'repo')],
        flows: [{ path: ['browser', 'web', 'logic', 'repo'], tone: 'request', duration: 2.2 }],
        caption: 'Counter, kitchen, storeroom',
      },
      quiz: {
        question: 'A feature such as a discount code forces edits in the web, service and data code. Which weakness of layered architecture is that?',
        options: [
          'Layers cannot be swapped',
          'Features cut across every layer because layers split by technical role',
          'Layers cannot call each other',
          'Layered systems cannot use a database',
        ],
        answer: 1,
        explain: 'Layers split code by technical role, so one business change touches all of them.',
      },
    },
  ],
};
