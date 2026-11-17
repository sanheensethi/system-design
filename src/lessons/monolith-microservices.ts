import type { Lesson, SceneLink, SceneNode, SceneZone } from '../engine/types';

const devs: SceneNode = { id: 'devs', kind: 'user', at: [-6.5, -1.5], label: 'engineers', sub: '60 people, 8 teams' };
const train: SceneNode = { id: 'train', kind: 'queue', at: [-3, -1.5], label: 'release train', sub: 'build + tests' };
const mono: SceneNode = { id: 'mono', kind: 'server', at: [0, -1.5], label: 'shop monolith', sub: 'one deployable' };
const mono2: SceneNode = { id: 'mono2', kind: 'server', at: [3, -1.5], label: 'copy 2', sub: 'same build' };
const lb: SceneNode = { id: 'lb', kind: 'lb', at: [-3, -1.5], label: 'load balancer' };
const db: SceneNode = { id: 'db', kind: 'db', at: [0, 3.5], label: 'Postgres', sub: 'one schema' };

const shoppers: SceneNode = { id: 'shoppers', kind: 'client', at: [-6.5, -1.5], label: 'shoppers' };
const catalog: SceneNode = { id: 'catalog', kind: 'block', size: 0.85, at: [-3, -1.5], label: 'catalog', icon: 'Package', tint: 'blue' };
const orders: SceneNode = { id: 'orders', kind: 'block', size: 0.85, at: [0, -1.5], label: 'orders', icon: 'ShoppingBag', tint: 'amber' };
const payments: SceneNode = { id: 'payments', kind: 'block', size: 0.85, at: [3, -1.5], label: 'payments', icon: 'Receipt', tint: 'green' };
const ordersDb: SceneNode = { id: 'ordersDb', kind: 'db', at: [0, 3.5], label: 'orders DB' };
const paymentsDb: SceneNode = { id: 'paymentsDb', kind: 'db', at: [3, 3.5], label: 'payments DB' };
const monitor: SceneNode = { id: 'monitor', kind: 'monitor', at: [3, -5], label: 'tracing', sub: 'logs, metrics' };

const box: SceneZone = { id: 'deployable', from: [-4.4, -2.9], to: [4.4, -0.1], label: 'one deployable', tone: 'blue' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

export const monolithMicroservices: Lesson = {
  id: 'monolith-microservices',
  title: 'Monolith, modular monolith, microservices',
  tagline: 'Start with one deployable, learn where it hurts as teams grow, and know what a split costs before you pay for it.',
  minutes: 20,
  level: 'Intermediate',
  learn: [
    'Why one deployable is the right start for a small team',
    'The symptoms that show a monolith has outgrown its team structure',
    'How a modular monolith gets clean boundaries without a network',
    'How to extract a service step by step with the strangler fig pattern',
    'What a split costs: network calls, data ownership and operations',
    'How services talk, and how to tell when not to split',
  ],
  metrics: [
    { key: 'deploys', label: 'Deploys', icon: 'Package' },
    { key: 'lead', label: 'Commit to prod', icon: 'Timer' },
    { key: 'hops', label: 'Network hops / checkout', icon: 'Route' },
    { key: 'units', label: 'Deployables', icon: 'Boxes' },
    { key: 'avail', label: 'Checkout availability', icon: 'Gauge' },
  ],
  steps: [
    {
      title: 'Release train',
      tag: 'problem',
      heading: 'Sixty engineers, one release a week',
      eli5: 'Sixty cooks share one kitchen with one door. Nothing leaves until every dish on the big tray is ready, so one burnt dish holds up dinner for everyone.',
      body: [
        'An online shop runs as one application: catalog, orders and payments share one codebase, one build and one Postgres schema. Eight teams, **60 engineers**, all commit to it.',
        'The full test suite takes 45 minutes and fails for someone most days, so the company ships on a weekly **release train**. A payments fix waits six days behind an unfinished catalog feature.',
      ],
      keyIdea: 'The first sign a monolith is in trouble is slow, risky releases. Load is rarely the reason.',
      metrics: { deploys: '1/week', lead: '6 days', hops: '0', units: '1', avail: '99.9%' },
      metricTones: { deploys: 'bad', lead: 'bad' },
      scene: {
        nodes: [
          devs,
          { ...train, status: 'hot', badge: '200 commits waiting', chips: ['catalog feature', { text: 'payments fix', tone: 'warn' }] },
          { ...mono, badge: 'v412' },
          db,
        ],
        links: [link('devs', 'train'), link('train', 'mono', { label: 'weekly', labelTone: 'warn' }), link('mono', 'db')],
        flows: [
          { path: ['devs', 'train'], tone: 'data', label: 'commit', count: 6, duration: 1 },
          { path: ['train', 'mono'], tone: 'event', label: 'weekly release', duration: 2.4, delay: 2 },
        ],
        panel: {
          title: 'Why a fix waits',
          icon: 'Timer',
          rows: [
            { text: 'Test suite, every change', value: '45 min', tone: 'bad' },
            { text: 'Release cadence', value: 'weekly', tone: 'warn' },
            { text: 'Payments fix, wait', value: '6 days', tone: 'bad' },
            { text: 'Suspects when it breaks', value: '200 commits', tone: 'bad' },
          ],
          footer: { text: 'The servers are fine. The shared release is the problem.', tone: 'muted' },
        },
        caption: 'Every team ships through the same queue',
      },
    },
    {
      title: 'Why it started',
      tag: 'concept',
      heading: 'One deployable was the right first choice',
      eli5: 'When the restaurant had five cooks, one small kitchen was perfect. Everyone could reach every shelf, and a dish went from stove to table in a minute.',
      body: [
        'Three years earlier the same shop had five engineers. A **monolith** (one codebase, one process, one database) let them ship ten times a day. A feature touching catalog, orders and payments was one pull request and one deploy.',
        'Calls between parts of the system were plain function calls: nanoseconds, never lost, never retried.',
      ],
      keyIdea: 'A monolith gives a small team function calls and one deploy. You give both up when you split.',
      metrics: { deploys: '10/day', lead: '20 min', hops: '0', units: '1', avail: '99.9%' },
      metricTones: { deploys: 'good', lead: 'good' },
      scene: {
        nodes: [{ ...devs, sub: '5 people, 1 team' }, { ...train, sub: '4 min build', status: 'ok' }, { ...mono, status: 'ok' }, db],
        links: [link('devs', 'train'), link('train', 'mono'), link('mono', 'db')],
        flows: [{ path: ['devs', 'train', 'mono'], tone: 'data', label: 'commit to prod', duration: 1.8 }],
        panel: {
          title: 'The small-team deal',
          icon: 'Users',
          rows: [
            { text: 'Engineers', value: '5' },
            { text: 'Build time', value: '4 min', tone: 'good' },
            { text: 'Deploys', value: '10/day', tone: 'good' },
            { text: 'Call between parts', value: 'nanoseconds', tone: 'good' },
          ],
        },
        caption: 'Small team: every change ships in minutes',
      },
    },
    {
      title: 'One transaction',
      tag: 'concept',
      heading: 'Order and payment commit as one unit',
      eli5: 'In the one small kitchen there is one order slip. Writing the dish and ticking it paid happens on the same slip at the same moment, so it can never be half done.',
      body: [
        'Placing an order and recording the payment sit inside **one database transaction**. Both rows commit, or neither does. The data cannot end up half written.',
        'Debugging is just as direct. A slow checkout is one stack trace in one process, so nothing has to be stitched together.',
      ],
      keyIdea: 'In a monolith one transaction covers everything a request changes. That guarantee is the next thing a split costs you.',
      metrics: { deploys: '10/day', lead: '20 min', hops: '0', units: '1', avail: '99.9%' },
      scene: {
        nodes: [shoppers, { ...mono, status: 'active', chips: ['placeOrder()'] }, { ...db, badge: '1 transaction' }],
        links: [link('shoppers', 'mono'), link('mono', 'db')],
        flows: [
          { path: ['shoppers', 'mono'], tone: 'request', label: 'POST /checkout', duration: 1.2 },
          { path: ['mono', 'db'], tone: 'request', label: 'BEGIN ... COMMIT', duration: 1, delay: 1.3 },
          { path: ['db', 'mono'], tone: 'response', duration: 1, delay: 2.4 },
        ],
        panel: {
          title: 'One atomic unit',
          icon: 'Database',
          code: 'BEGIN;\n  INSERT INTO orders  ...;\n  INSERT INTO charges ...;\nCOMMIT;\n-- both rows, or neither',
        },
        caption: 'Both writes commit together or not at all',
      },
    },
    {
      title: 'Scales out',
      tag: 'concept',
      heading: 'A monolith scales out fine. People do not.',
      eli5: 'If more families arrive, open a second kitchen with the same recipes and let the host split the families between them. That helps with crowds. It does nothing for cooks bumping elbows.',
      body: [
        'The app is stateless, so you run more copies behind a load balancer, as in the load balancing lesson. Traffic is not what hurts a monolith.',
        'What it does not scale is the number of people changing it at once. Ten more copies of the server give sixty engineers no more room to work.',
        'Scaling is also all-or-nothing per deployable: if only payments is hot, you still run full copies of everything. And every copy shares one database, which becomes the first load limit (see the replication and sharding lessons).',
      ],
      keyIdea: 'Copies of a monolith add capacity for requests. They add nothing for the people editing the code.',
      metrics: { deploys: '1/week', lead: '6 days', hops: '0', units: '1', avail: '99.9%' },
      scene: {
        nodes: [lb, { ...mono, status: 'ok', load: 40 }, { ...mono2, status: 'ok', load: 40 }, db],
        links: [link('lb', 'mono'), link('lb', 'mono2'), link('mono', 'db'), link('mono2', 'db')],
        flows: [
          { path: ['lb', 'mono', 'db'], tone: 'request', duration: 1.6 },
          { path: ['lb', 'mono2', 'db'], tone: 'request', duration: 1.6, delay: 0.8 },
        ],
        panel: {
          title: 'What adding copies fixes',
          icon: 'Scale',
          rows: [
            { text: 'Requests per second', value: 'scales', tone: 'good' },
            { text: 'Build and test time', value: 'same 45 min', tone: 'bad' },
            { text: 'Teams sharing a release', value: 'still 8', tone: 'bad' },
            { text: 'Scale one hot module alone', value: 'no', tone: 'bad' },
            { text: 'Database', value: 'one, shared', tone: 'warn' },
          ],
        },
        caption: 'More copies, same single release',
      },
    },
    {
      title: 'Tangled code',
      tag: 'concept',
      heading: 'Nothing stopped one part reaching into another',
      eli5: 'Now sixty cooks reach across each other for the same shelves. The pastry cook moves a jar, and the grill cook cannot find the salt.',
      body: [
        'Nothing stopped the catalog code from reading the `payments` tables directly, so over three years it did. Orders code calls private helpers deep inside payments. A change to one table breaks code owned by three other teams.',
        'This is a **big ball of mud**: the code is in one place, and so is every dependency between its parts.',
      ],
      keyIdea: 'The damage comes from code and data with no boundaries. A single deployable only makes missing boundaries cheap to ignore.',
      metrics: { deploys: '1/week', lead: '6 days', hops: '0', units: '1', avail: '99.9%' },
      metricTones: { deploys: 'bad', lead: 'bad' },
      scene: {
        zones: [box],
        nodes: [
          { ...catalog, status: 'hot' },
          { ...orders, status: 'hot' },
          { ...payments, status: 'hot', badge: 'called from everywhere' },
          { ...db, status: 'hot', badge: 'everyone writes everything' },
        ],
        links: [link('catalog', 'orders'), link('orders', 'payments'), link('catalog', 'db'), link('orders', 'db'), link('payments', 'db')],
        flows: [
          { path: ['catalog', 'db'], tone: 'error', label: 'SELECT FROM payments', duration: 1.4 },
          { path: ['orders', 'payments'], tone: 'error', label: 'private helper', duration: 1.2, delay: 0.6 },
          { path: ['payments', 'db'], tone: 'request', duration: 1.2, delay: 1.2 },
        ],
        panel: {
          title: 'Who touches payments data',
          icon: 'Bug',
          rows: [
            { text: 'Catalog code', value: 'SELECT', tone: 'bad' },
            { text: 'Orders code', value: 'private helpers', tone: 'bad' },
            { text: 'Payments team', value: 'owner on paper', tone: 'warn' },
          ],
        },
        caption: 'One process, and no walls inside it',
      },
    },
    {
      title: 'What mud costs',
      tag: 'concept',
      heading: "Without walls, every change is everyone's change",
      eli5: 'Because every cook uses every shelf, the whole kitchen must be checked before any dish goes out. And if one cook sets a pan on fire, everyone has to leave.',
      body: [
        'Tests for everything must run on every change, so the 45-minute build never shrinks. Teams queue behind each other, and when the release goes bad, any of 200 commits could be the cause.',
        'The **blast radius** is the whole process. One memory leak in the image resizer restarts the process that takes payments.',
      ],
      keyIdea: 'Shared code means a shared build, a shared queue and a shared blast radius.',
      metrics: { deploys: '1/week', lead: '6 days', hops: '0', units: '1', avail: '99.9%' },
      metricTones: { avail: 'warn' },
      scene: {
        zones: [box],
        nodes: [
          { ...catalog, status: 'hot', load: 96, chips: [{ text: 'image resizer leak', tone: 'bad' }] },
          { ...orders, status: 'dim' },
          { ...payments, status: 'down', badge: 'restarted too' },
        ],
        links: [link('catalog', 'orders'), link('orders', 'payments')],
        flows: [{ path: ['catalog', 'orders', 'payments'], tone: 'error', label: 'process restart', duration: 2.2 }],
        panel: {
          title: 'The shared bill',
          icon: 'Gauge',
          rows: [
            { text: 'Tests run per change', value: 'everything', tone: 'bad' },
            { text: 'Teams in one queue', value: '8', tone: 'bad' },
            { text: 'Blast radius', value: 'whole process', tone: 'bad' },
          ],
        },
        caption: 'One leak, one restart, everything down',
      },
    },
    {
      title: "Conway's law",
      tag: 'concept',
      heading: 'Code ends up shaped like the teams that wrote it',
      eli5: 'The kitchen layout ends up following who talks to whom. If nobody plans it, the layout follows the chatter. So decide the layout on purpose and give each station its own cooks.',
      body: [
        "**Conway's law** says a system's structure ends up matching the communication structure of the organization that builds it. Eight teams with unclear ownership give unclear module edges.",
        'So make the structure deliberate: each team owns one module, which is the inverse Conway move. Boundaries that cut across teams create meetings instead of independence.',
      ],
      keyIdea: 'Pick boundaries by who owns what. A good boundary is one a single team can change without asking others.',
      metrics: { deploys: '1/week', lead: '6 days', hops: '0', units: '1', avail: '99.9%' },
      scene: {
        nodes: [
          { ...catalog, badge: 'team A' },
          { ...orders, badge: 'team B' },
          { ...payments, badge: 'team C' },
        ],
        links: [link('catalog', 'orders', { style: 'faint' }), link('orders', 'payments', { style: 'faint' })],
        panel: {
          title: 'Where to draw a boundary',
          icon: 'Users',
          rows: [
            { text: 'Team A owns', value: 'catalog', tone: 'good' },
            { text: 'Team B owns', value: 'orders', tone: 'good' },
            { text: 'Team C owns', value: 'payments', tone: 'good' },
            { text: 'Own data', value: 'good', tone: 'good' },
            { text: 'Change needs 3 teams', value: 'wrong line', tone: 'bad' },
          ],
        },
        caption: 'Boundaries follow ownership',
      },
    },
    {
      title: 'Modular monolith',
      tag: 'concept',
      heading: 'Draw the walls inside the process first',
      eli5: 'We keep one kitchen but paint lines on the floor. Each station has its own shelves, and a cook who needs something from another station asks at its counter.',
      body: [
        'A **modular monolith** is still one deployable, split into modules. Each module exposes a small public interface and owns its tables. Other modules call the interface and nothing else.',
        'In the database each module gets its own schema and role. Tests run per module, so most builds drop from 45 minutes to about 8 and the train can leave daily.',
      ],
      keyIdea: 'A modular monolith buys most of the team independence of services while calls stay in-process and data stays in one database.',
      metrics: { deploys: '1/day', lead: '1 day', hops: '0', units: '1', avail: '99.9%' },
      metricTones: { deploys: 'good', lead: 'good' },
      scene: {
        zones: [box],
        nodes: [
          { ...catalog, status: 'ok' },
          { ...orders, status: 'active', chips: ['getPrice()', 'charge()'] },
          { ...payments, status: 'ok' },
          { ...db, sub: '3 schemas, 3 roles' },
        ],
        links: [
          link('orders', 'catalog', { label: 'function call' }),
          link('orders', 'payments', { label: 'function call' }),
          link('orders', 'db'),
        ],
        flows: [
          { path: ['orders', 'catalog'], tone: 'request', label: 'getPrice()', duration: 0.9 },
          { path: ['orders', 'payments'], tone: 'request', label: 'charge()', duration: 0.9, delay: 1 },
          { path: ['orders', 'db'], tone: 'data', label: 'orders schema', duration: 1, delay: 2 },
        ],
        panel: {
          title: 'The module rules',
          icon: 'Layers',
          rows: [
            { text: 'Talk to others via', value: 'public interface', tone: 'good' },
            { text: 'Tables', value: 'own schema + role', tone: 'good' },
            { text: 'Build per module', value: '~8 min', tone: 'good' },
            { text: 'Releases', value: 'daily train', tone: 'good' },
          ],
        },
        caption: 'Same process, enforced module boundaries',
      },
    },
    {
      title: 'Enforce it',
      tag: 'concept',
      heading: 'Let the build police the boundary',
      eli5: 'A painted line only works if someone checks it. So the host at the counter turns away any cook who walks into another station without going through its window.',
      body: [
        'Rules that rely on goodwill break when people are in a hurry. A lint rule or an architecture test fails the pull request if `catalog` imports from inside `payments`.',
        'Many companies stop at this step for years. It is cheap, it keeps function calls and transactions, and it leaves the door open to extract a service later.',
      ],
      keyIdea: 'A boundary that the build does not check will erode. Make a crossing fail the pull request.',
      metrics: { deploys: '1/day', lead: '1 day', hops: '0', units: '1', avail: '99.9%' },
      scene: {
        nodes: [
          { ...catalog, status: 'ok' },
          { ...orders, status: 'ok' },
          { ...payments, status: 'active', badge: 'index.ts only' },
        ],
        links: [
          link('orders', 'payments', { label: 'public API' }),
          link('catalog', 'payments', { style: 'dashed', label: 'build fails', labelTone: 'warn' }),
        ],
        flows: [
          { path: ['orders', 'payments'], tone: 'request', label: 'charge()', duration: 1.1 },
          { path: ['catalog', 'payments'], tone: 'error', label: 'import ledger', duration: 1.1, delay: 1.3 },
        ],
        panel: {
          title: 'What CI says',
          icon: 'Shield',
          rows: [
            { text: 'orders imports payments', value: 'passes', tone: 'good' },
            { text: 'catalog imports payments/ledger', value: 'fails', tone: 'bad' },
          ],
        },
        caption: 'A crossing fails the pull request',
      },
      code: {
        language: 'typescript',
        title: 'A module boundary the build enforces',
        source: `// payments/index.ts: the ONLY file other modules may import
export interface PaymentsApi {
  charge(orderId: string, cents: number): Promise<ChargeResult>;
  refund(chargeId: string): Promise<void>;
}
export const payments: PaymentsApi = createPayments();

// orders/checkout.ts
import { payments } from '../payments';          // allowed
// import { ledger } from '../payments/ledger';  // build fails

// architecture.test.ts: runs in CI on every pull request
test('modules only import public APIs', () => {
  for (const imp of crossModuleImports('src')) {
    expect(imp.target).toMatch(/^src\\/[a-z]+\\/index\\.ts$/);
  }
});`,
        highlight: [2, 3, 9, 10, 15],
      },
      quiz: {
        question: 'A 12-person team has a tangled monolith and slow releases. Traffic is modest. What is the best first move?',
        options: [
          'Split it into one service per database table',
          'Enforce module boundaries inside the monolith and give each module its own tables',
          'Rewrite the system in a faster language',
          'Add more app servers behind the load balancer',
        ],
        answer: 1,
        explain: 'The problem is missing boundaries. A modular monolith fixes that with no network calls and no new infrastructure. More servers do nothing for a tangled codebase.',
      },
    },
    {
      title: 'Real reasons',
      tag: 'concept',
      heading: 'Split a module out only for a specific reason',
      eli5: 'A station moves to its own shop only when it needs something the kitchen cannot give it, like its own license, its own opening hours or much more space.',
      body: [
        'Payments has reasons the other modules lack. It falls under card-industry audit rules, so keeping it small shrinks the audit. It needs a slower, more careful release process. Its team wants to ship a fix without waiting for the catalog tests.',
        'Other good reasons: a very different scaling profile, or a team that needs full ownership. "Services are modern" is not on the list.',
      ],
      keyIdea: 'Extract a service when a module needs to deploy, scale or be secured differently from the rest.',
      metrics: { deploys: '1/day', lead: '1 day', hops: '0', units: '1', avail: '99.9%' },
      scene: {
        nodes: [
          { ...catalog, status: 'dim' },
          { ...orders, status: 'dim' },
          { ...payments, status: 'active', chips: ['card audit rules', 'careful releases', { text: 'own cadence', tone: 'good' }] },
        ],
        links: [link('orders', 'catalog', { style: 'faint' }), link('orders', 'payments')],
        panel: {
          title: 'Reasons that count',
          icon: 'Scale',
          rows: [
            { text: 'Different release cadence', value: 'yes', tone: 'good' },
            { text: 'Different scaling profile', value: 'yes', tone: 'good' },
            { text: 'Compliance boundary', value: 'yes', tone: 'good' },
            { text: 'Team needs full ownership', value: 'yes', tone: 'good' },
            { text: '"Services are modern"', value: 'no', tone: 'bad' },
          ],
        },
        caption: 'Payments has a concrete reason',
      },
    },
    {
      title: 'First split',
      tag: 'concept',
      heading: 'Payments becomes its own service',
      eli5: 'The dessert station moves to its own little shop next door, with its own fridge and its own door. A runner now carries orders between the two.',
      body: [
        'Payments becomes a **service**: its own repository, deploy pipeline and database, reached over HTTP or gRPC. The rest stays one monolith.',
        'Because the module already had a narrow public interface, the change is mostly swapping an in-process call for a client that speaks the same interface over the network.',
      ],
      keyIdea: 'A clean module boundary makes extraction small: same interface, new transport.',
      metrics: { deploys: '1/day + 5/day', lead: '1 day / 30 min', hops: '1', units: '2', avail: '99.8%' },
      scene: {
        zones: [{ ...box, to: [1.4, -0.1], label: 'shop monolith' }],
        nodes: [
          { ...orders, label: 'shop', icon: 'Boxes', status: 'active', chips: ['catalog + orders'] },
          { ...payments, status: 'ok', badge: 'own pipeline', sub: 'separate service' },
          { ...ordersDb, label: 'shop DB' },
          { ...paymentsDb, status: 'ok' },
        ],
        links: [link('orders', 'payments', { label: 'HTTP' }), link('orders', 'ordersDb'), link('payments', 'paymentsDb')],
        flows: [
          { path: ['orders', 'payments'], tone: 'request', label: 'POST /charges', duration: 1 },
          { path: ['payments', 'paymentsDb'], tone: 'data', duration: 0.9, delay: 1.1 },
          { path: ['payments', 'orders'], tone: 'response', label: '201', duration: 1, delay: 2.1 },
        ],
        panel: {
          title: 'One call, new transport',
          icon: 'Code',
          code: 'before: payments.charge(id, cents)\nafter:  POST /charges\n        { orderId, cents }',
        },
        caption: 'Payments leaves the monolith, with its data',
      },
    },
    {
      title: 'Strangler fig',
      tag: 'concept',
      heading: 'Move traffic over slowly, never rewrite in one go',
      eli5: 'Open the new dessert shop, but at first send only one family in ten to it. If the new shop is good, send more. Close the old counter when nobody uses it.',
      body: [
        'The **strangler fig** pattern puts a router in front of the old and new code. A small share of traffic goes to the new path, and if errors rise you route back.',
        'Each step is small and reversible. Routing is only the traffic half of the job. The data moves in its own phases: copy and sync to the new database, dual write, switch reads, switch writes, then remove the old schema.',
      ],
      keyIdea: 'Extract by routing traffic gradually. Every step is reversible and the old path stays until the new one is proven.',
      metrics: { deploys: '1/day + 5/day', lead: '1 day / 30 min', hops: '1', units: '2', avail: '99.8%' },
      scene: {
        nodes: [
          shoppers,
          { id: 'router', kind: 'gateway', at: [-3, -1.5], label: 'router' },
          { ...mono, at: [2, -3.5], label: 'old payments code', sub: 'inside monolith', status: 'dim' },
          { ...payments, at: [2, 0.5], status: 'active' },
        ],
        links: [
          link('shoppers', 'router'),
          link('router', 'mono', { label: '90%' }),
          link('router', 'payments', { label: '10%' }),
        ],
        flows: [
          { path: ['shoppers', 'router', 'mono'], tone: 'request', count: 3, duration: 1.8 },
          { path: ['router', 'payments'], tone: 'request', duration: 1.2, delay: 1.0 },
        ],
        panel: {
          title: 'Traffic and data, in phases',
          icon: 'Route',
          rows: [
            { text: 'Traffic share', value: '5% to 100%' },
            { text: '1. Copy and sync data', value: 'backfill' },
            { text: '2. Dual write', value: 'both DBs' },
            { text: '3. Switch reads', value: 'new DB' },
            { text: '4. Switch writes', value: 'new DB' },
            { text: '5. Remove old schema', value: 'delete old code', tone: 'good' },
          ],
          footer: { text: 'Errors rise? Route back in seconds.', tone: 'muted' },
        },
        caption: 'The new service grows around the old code',
      },
    },
    {
      title: 'Network tax',
      tag: 'tradeoff',
      heading: 'Cost one: a function call became a network call',
      eli5: 'Inside one kitchen you hand a plate to the next cook. Between shops, a runner carries it down the street. The runner is slower, and slower still when the street is busy.',
      body: [
        'Split all three modules and a checkout that was two function calls becomes two network round trips. Each adds about 1 to 2 ms on a good day inside one datacenter, plus serialization, and far more at the tail when a service is busy.',
        'A function call costs nanoseconds. A hop costs a million times more, and a chatty page multiplies it.',
      ],
      keyIdea: 'Every service boundary adds latency. Design calls to be few and coarse.',
      metrics: { deploys: '20/day', lead: '30 min', hops: '2', units: '3', avail: '99.7%' },
      metricTones: { hops: 'warn' },
      scene: {
        nodes: [shoppers, { ...catalog, status: 'ok' }, { ...orders, status: 'active', chips: ['waits on 2 calls'] }, { ...payments, status: 'ok' }],
        links: [
          link('shoppers', 'orders'),
          link('orders', 'catalog', { label: '1 to 2 ms', labelTone: 'warn', arrow: 'both' }),
          link('orders', 'payments', { label: '1 to 2 ms', labelTone: 'warn', arrow: 'both' }),
        ],
        flows: [
          { path: ['shoppers', 'orders'], tone: 'request', label: 'POST /checkout', duration: 1.1 },
          { path: ['orders', 'catalog', 'orders'], tone: 'request', label: 'price?', duration: 1.4, delay: 1.2 },
          { path: ['orders', 'payments', 'orders'], tone: 'request', label: 'charge', duration: 1.4, delay: 2.7 },
        ],
        panel: {
          title: 'Cost of one call',
          icon: 'Timer',
          rows: [
            { text: 'In-process call', value: 'nanoseconds', tone: 'good' },
            { text: 'Same-datacenter hop', value: '1 to 2 ms', tone: 'warn' },
            { text: 'Busy service, tail', value: 'much more', tone: 'bad' },
          ],
        },
        caption: 'Two function calls became two round trips',
      },
    },
    {
      title: 'No answer',
      tag: 'tradeoff',
      heading: 'A network call has a third outcome: no answer',
      eli5: 'The runner leaves with the order and never comes back. Did the dessert shop make it or not? You cannot tell, so give the order a number and let the shop ignore a repeat.',
      body: [
        'A function call either returns or the whole process is dead. A network call can return nothing, and you cannot tell whether the charge happened.',
        'So every call needs a timeout, a bounded retry and an **idempotency key**, so a retried charge does not bill the customer twice.',
      ],
      keyIdea: 'Assume any call can time out after the work was done. Make every retry safe with an idempotency key.',
      metrics: { deploys: '20/day', lead: '30 min', hops: '2', units: '3', avail: '99.7%' },
      metricTones: { avail: 'warn' },
      scene: {
        nodes: [
          { ...orders, status: 'active', chips: ['attempt 1: timeout', 'attempt 2: same key'] },
          { ...payments, status: 'down', badge: 'no answer' },
          { ...paymentsDb, badge: 'charged?' },
        ],
        links: [link('orders', 'payments', { label: '800 ms timeout', labelTone: 'warn' }), link('payments', 'paymentsDb')],
        flows: [
          { path: ['orders', 'payments'], tone: 'error', label: 'charge ... timeout', duration: 1.8 },
          { path: ['orders', 'payments'], tone: 'handshake', label: 'retry, same key', duration: 1.2, delay: 2.0 },
        ],
        panel: {
          title: 'Possible outcomes',
          icon: 'Bug',
          rows: [
            { text: 'Returned a result', value: 'known', tone: 'good' },
            { text: 'Crashed before work', value: 'safe to retry', tone: 'warn' },
            { text: 'Worked, reply lost', value: 'double charge?', tone: 'bad' },
          ],
          footer: { text: 'Same key means the second try is ignored', tone: 'good' },
        },
        caption: 'Did the charge happen? The caller cannot know',
      },
      code: {
        language: 'typescript',
        title: 'What charge() looks like once it crosses a network',
        source: `async function charge(orderId: string, cents: number): Promise<ChargeResult> {
  const key = \`charge-\${orderId}\`;             // same key on every retry
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch('http://payments.internal/charges', {
        method: 'POST',
        headers: { 'Idempotency-Key': key },
        body: JSON.stringify({ orderId, cents }),
        signal: AbortSignal.timeout(800),      // never wait forever
      });
      if (res.ok) return res.json();
      if (res.status < 500) throw new PaymentRejected(await res.text());
    } catch (err) {
      if (err instanceof PaymentRejected) throw err;
    }
    await sleep(100 * 2 ** attempt + Math.random() * 100);   // backoff + jitter
  }
  throw new PaymentUnavailable(orderId);       // caller must handle this
}`,
        highlight: [2, 7, 9, 16, 17],
      },
    },
    {
      title: 'Availability',
      tag: 'tradeoff',
      heading: 'A chain of services is less available than any one',
      eli5: 'If every runner is on time nine days in ten, a dinner that needs three runners is on time less often than any single runner.',
      body: [
        'Availability multiplies. If each service is up 99.9% of the time and checkout needs all three: `0.999 × 0.999 × 0.999 = 99.7%`.',
        'That is roughly 26 hours of downtime a year, up from under 9. Circuit breakers and fallbacks win some of it back, and each one is code you now own.',
      ],
      keyIdea: 'Every synchronous dependency lowers the ceiling. Fewer hops in the checkout path means higher availability.',
      metrics: { deploys: '20/day', lead: '30 min', hops: '2', units: '3', avail: '99.7%' },
      metricTones: { avail: 'bad' },
      scene: {
        nodes: [
          { ...catalog, badge: '99.9%' },
          { ...orders, badge: '99.9%', status: 'active' },
          { ...payments, badge: '99.9%' },
        ],
        links: [link('catalog', 'orders', { arrow: 'both' }), link('orders', 'payments', { arrow: 'both' })],
        flows: [{ path: ['catalog', 'orders', 'payments'], tone: 'request', label: 'checkout', duration: 2.2 }],
        panel: {
          title: 'Downtime per year',
          icon: 'Gauge',
          rows: [
            { text: 'One service, 99.9%', value: '8.8 hours', tone: 'good' },
            { text: 'Three in a chain, 99.7%', value: '26 hours', tone: 'bad' },
            { text: 'Circuit breaker + fallback', value: 'wins some back', tone: 'warn' },
          ],
        },
        caption: 'Multiply the nines',
      },
    },
    {
      title: 'Data ownership',
      tag: 'tradeoff',
      heading: 'Cost two: one service, one database',
      eli5: 'Each shop now has its own fridge with its own lock. To learn what is in the dessert shop fridge, you have to ask the dessert shop. You cannot open it yourself.',
      body: [
        'A service that shares a database with another service is not independent. Any schema change still needs both teams.',
        'So the rule is **one service, one database**, and nobody else touches it. Others get data by calling the owner or by receiving events.',
      ],
      keyIdea: 'Independence needs private data. A shared database keeps two services as one unit of change.',
      metrics: { deploys: '20/day', lead: '30 min', hops: '2', units: '3', avail: '99.7%' },
      scene: {
        nodes: [{ ...orders, status: 'active' }, { ...payments, status: 'active' }, { ...ordersDb, status: 'ok' }, { ...paymentsDb, status: 'ok' }],
        links: [
          link('orders', 'ordersDb'),
          link('payments', 'paymentsDb'),
          link('orders', 'payments', { label: 'HTTP' }),
          link('ordersDb', 'paymentsDb', { style: 'dashed', label: 'no direct access', labelTone: 'warn' }),
        ],
        panel: {
          title: 'Shared vs private data',
          icon: 'Database',
          rows: [
            { text: 'Shared database', value: 'both teams per change', tone: 'bad' },
            { text: 'Private database', value: 'change alone', tone: 'good' },
            { text: 'Others read data via', value: 'API or events', tone: 'muted' },
          ],
        },
        caption: 'Each service guards its own data',
      },
    },
    {
      title: 'Lost join',
      tag: 'tradeoff',
      heading: 'The join you used for free is gone',
      eli5: 'Before, the cook could see the dish and the bill on one slip. Now the bill lives in another shop, so you must phone them or keep a copy of their latest numbers.',
      body: [
        '"Orders with product names and payment status" was one SQL query. Now it is a call to each service stitched together in code (option A), or a local copy of the data kept up to date by events from the owners (option B).',
        'The copy can lag the owner by a few seconds. Your code and your users must tolerate that.',
      ],
      keyIdea: 'Splitting data trades joins for API calls or event-fed copies that are slightly stale.',
      metrics: { deploys: '20/day', lead: '30 min', hops: '2', units: '3', avail: '99.7%' },
      scene: {
        nodes: [
          { ...catalog, chips: ['ProductRenamed'] },
          { ...orders, status: 'active' },
          { ...payments, chips: ['PaymentCaptured'] },
          { ...ordersDb, badge: 'order_view', status: 'active' },
        ],
        links: [link('catalog', 'orders', { label: 'events' }), link('payments', 'orders', { label: 'events', route: 'straight' }), link('orders', 'ordersDb')],
        flows: [
          { path: ['catalog', 'orders'], tone: 'event', label: 'ProductRenamed', duration: 1.2 },
          { path: ['payments', 'orders'], tone: 'event', label: 'PaymentCaptured', duration: 1.2, delay: 1.1 },
          { path: ['orders', 'ordersDb'], tone: 'data', label: 'update copy', duration: 1, delay: 2.4 },
        ],
        panel: {
          title: 'Two ways to join now',
          icon: 'Table',
          rows: [
            { text: 'A: call each owner, merge', value: 'more hops', tone: 'warn' },
            { text: 'B: local copy from events', value: 'stale by seconds', tone: 'warn' },
            { text: 'Monolith join', value: 'one query', tone: 'good' },
          ],
        },
        caption: 'The data you need now arrives by events',
      },
      code: {
        language: 'sql',
        title: 'The query you lose when the data splits',
        source: `-- Monolith: one query, one consistent snapshot
SELECT o.id, p.name, c.status
FROM   orders   o
JOIN   products p ON p.id = o.product_id
JOIN   charges  c ON c.order_id = o.id
WHERE  o.user_id = 42;

-- Services: orders DB can only see its own tables.
-- Option A: call catalog and payments per order, merge in code.
-- Option B: keep a local copy, updated by events from the owners.
CREATE TABLE order_view (
  order_id      uuid PRIMARY KEY,
  product_name  text,          -- copied from ProductRenamed events
  charge_status text,          -- copied from PaymentCaptured events
  updated_at    timestamptz    -- may lag the owner by a few seconds
);`,
        highlight: [4, 5, 13, 14, 15],
      },
    },
    {
      title: 'Lost transaction',
      tag: 'tradeoff',
      heading: 'No shared transaction means sagas',
      eli5: 'Writing the dish in one shop and ticking it paid in another can no longer happen on one slip. So do one, then the other, and if the second fails, undo the first.',
      body: [
        '"Create the order and charge the card" can no longer commit or roll back as one unit. You use a **saga**: a sequence of local transactions with a compensating step (refund) if a later one fails.',
        'It is usually driven by events published through an outbox. The distributed transactions lesson covers the mechanics. In between steps the system is visibly inconsistent, and your code and support team must cope.',
      ],
      keyIdea: 'Splitting data trades atomic transactions for sagas. This is usually the most expensive part of a split.',
      metrics: { deploys: '20/day', lead: '30 min', hops: '2', units: '3', avail: '99.7%' },
      scene: {
        nodes: [
          { ...orders, status: 'active', chips: ['order PENDING'] },
          { ...payments, status: 'active' },
          { ...ordersDb, status: 'active', badge: 'local commit 1' },
          { ...paymentsDb, status: 'active', badge: 'local commit 2' },
        ],
        links: [link('orders', 'ordersDb'), link('payments', 'paymentsDb'), link('orders', 'payments', { label: 'events' })],
        flows: [
          { path: ['orders', 'ordersDb'], tone: 'data', label: 'INSERT order', duration: 1 },
          { path: ['orders', 'payments'], tone: 'event', label: 'OrderPlaced', duration: 1.2, delay: 1.1 },
          { path: ['payments', 'paymentsDb'], tone: 'data', label: 'INSERT charge', duration: 1, delay: 2.4 },
          { path: ['payments', 'orders'], tone: 'event', label: 'PaymentCaptured', duration: 1.2, delay: 3.5 },
        ],
        panel: {
          title: 'The saga',
          icon: 'Workflow',
          rows: [
            { text: '1. Save order as PENDING', value: 'commit', tone: 'good' },
            { text: '2. Charge the card', value: 'commit', tone: 'good' },
            { text: '3. Mark order PAID', value: 'commit', tone: 'good' },
            { text: 'If 2 fails: cancel order', value: 'compensate', tone: 'warn' },
          ],
        },
        caption: 'Two local commits, joined by events',
      },
      quiz: {
        question: 'The orders service saved an order as PENDING, but the charge in payments failed. What does a saga do?',
        options: [
          'Roll back both databases in one distributed commit',
          'Run a compensating step, such as cancelling the pending order',
          'Leave the order PENDING forever',
          "Retry the whole checkout from the shopper's browser",
        ],
        answer: 1,
        explain: 'Each service commits locally, so nothing rolls back for free. A saga defines a compensating action for each step, such as cancelling the order, to undo earlier commits.',
      },
    },
    {
      title: 'Ops bill',
      tag: 'tradeoff',
      heading: 'Cost three: you now operate a distributed system',
      eli5: 'One kitchen needed one manager, one cleaning rota and one fire alarm. Three shops need three of each, plus someone who can follow an order as it passes through all of them.',
      body: [
        'One deployable meant one pipeline, one dashboard, one log stream and one on-call rota. Three services means three of each, and a real estate means dozens.',
        'A slow checkout used to be one stack trace. Now it crosses three processes, so you need **distributed tracing**: a trace id passed on every call, stitched into one timeline.',
      ],
      keyIdea: 'Microservices move complexity out of the code and into operations.',
      metrics: { deploys: '20/day', lead: '30 min', hops: '2', units: '3', avail: '99.7%' },
      scene: {
        nodes: [
          { ...catalog, badge: 'pipeline 1' },
          { ...orders, badge: 'pipeline 2' },
          { ...payments, badge: 'pipeline 3' },
          { ...monitor, status: 'active', badge: 'trace 7f3a: 3 spans' },
        ],
        links: [link('orders', 'catalog'), link('orders', 'payments'), link('payments', 'monitor', { style: 'faint' })],
        flows: [
          { path: ['orders', 'catalog'], tone: 'request', label: 'trace-id 7f3a', duration: 1 },
          { path: ['orders', 'payments'], tone: 'request', label: 'trace-id 7f3a', duration: 1, delay: 1.1 },
          { path: ['payments', 'monitor'], tone: 'event', label: 'spans', count: 3, duration: 1, delay: 2.2 },
        ],
        panel: {
          title: 'Per service, every time',
          icon: 'Activity',
          rows: [
            { text: 'Pipeline and deploys', value: 'x3' },
            { text: 'Dashboards, logs, on-call', value: 'x3' },
            { text: 'Service discovery, secrets', value: 'x3' },
            { text: 'Capacity plan', value: 'x3' },
          ],
          footer: { text: 'Without a trace id, three teams say their dashboard looks fine', tone: 'warn' },
        },
        caption: 'Three of everything, plus tooling to see across them',
      },
    },
    {
      title: 'Hidden costs',
      tag: 'tradeoff',
      heading: 'Compatibility, tests and a platform team',
      eli5: 'Three shops also need agreed menus that do not change overnight, and someone who builds the delivery bikes and the shared phone line.',
      body: [
        'Callers deploy at different times, so APIs must evolve in a backward-compatible way, with v1 and v2 live together. **Contract tests** (consumer-driven contracts) check that a change does not break a caller without running slow, flaky end-to-end suites.',
        'Local development gets heavier too. The fix for all of this is tooling, and tooling needs people: for the 60-engineer company, about 5 on a platform team. For a 20-person company, the same team would be a quarter of the staff.',
      ],
      keyIdea: 'Microservices need contract tests and a platform. A small company pays for them out of the same engineers who build features.',
      metrics: { deploys: '20/day', lead: '30 min', hops: '2', units: '3', avail: '99.7%' },
      metricTones: { lead: 'warn' },
      scene: {
        nodes: [
          { id: 'platform', kind: 'block', size: 0.85, at: [-3, -1.5], label: 'platform team', icon: 'Cpu', tint: 'violet', badge: '~5 of 60 engineers' },
          { ...orders, status: 'active' },
          { ...payments },
        ],
        links: [link('platform', 'orders', { label: 'pipelines, tooling' }), link('orders', 'payments', { label: 'v1 and v2 APIs' })],
        flows: [{ path: ['platform', 'orders', 'payments'], tone: 'data', label: 'tooling', duration: 2 }],
        panel: {
          title: 'What a platform covers',
          icon: 'Layers',
          rows: [
            { text: 'Local dev environment', value: 'fix: shared dev tooling', tone: 'warn' },
            { text: 'API changes', value: 'fix: v1 and v2 live', tone: 'warn' },
            { text: 'End-to-end tests slow, flaky', value: 'fix: contract tests', tone: 'warn' },
            { text: 'Platform share of a 20-person team', value: '1 in 4', tone: 'bad' },
          ],
        },
        caption: 'Someone must build the paved road',
      },
    },
    {
      title: 'How they talk',
      tag: 'concept',
      heading: 'Calls and events',
      eli5: 'The runner can wait at the counter for an answer, or leave a note on the order spike and walk away. Waiting is simple, notes keep working when a shop is closed.',
      body: [
        "A **synchronous call** (HTTP or gRPC) gets an answer now, but ties the caller's availability to the callee. An **event** on a queue lets the caller move on and the consumer catch up later.",
        'The API gateway and service discovery are covered in the gateway lesson.',
      ],
      keyIdea: 'Use calls when you need the answer now. Use events when the work can finish later and a failure must not spread.',
      metrics: { deploys: '20/day', lead: '30 min', hops: '2', units: '3', avail: '99.7%' },
      scene: {
        nodes: [
          { ...orders, status: 'active' },
          { id: 'bus', kind: 'queue', at: [0, 3.5], label: 'event queue', sub: 'OrderPlaced' },
          { ...payments, at: [3, 3.5] },
          { id: 'notifications', kind: 'block', size: 0.85, at: [-4, 3.5], label: 'notifications', icon: 'Bell', tint: 'violet', status: 'down', badge: 'offline, catches up later' },
        ],
        links: [link('orders', 'bus', { label: 'event' }), link('bus', 'payments', { label: 'consume' }), link('bus', 'notifications', { label: 'consume' })],
        flows: [
          { path: ['orders', 'bus'], tone: 'event', label: 'OrderPlaced', duration: 1.2 },
          { path: ['bus', 'payments'], tone: 'event', duration: 1.2, delay: 1.4 },
          { path: ['bus', 'notifications'], tone: 'error', label: 'waits in queue', duration: 1.2, delay: 1.4 },
        ],
        panel: {
          title: 'Call or event',
          icon: 'ArrowLeftRight',
          rows: [
            { text: 'Sync call', value: 'answer now, coupled', tone: 'warn' },
            { text: 'Event', value: 'later, decoupled', tone: 'good' },
          ],
        },
        caption: 'Wait for an answer, or leave a note',
      },
    },
    {
      title: 'Fake split',
      tag: 'case',
      heading: 'Case: twelve services that deploy as one',
      eli5: 'A restaurant splits into twelve tiny shops, but they all still share one fridge. Now every dish needs twelve runners, and nobody can change a shelf without asking everyone.',
      body: [
        'A 15-person startup splits its monolith into twelve services in one quarter, one per noun in the data model. They keep one shared database "for now".',
        'A year later every feature touches four services and needs a coordinated release in a fixed order. A page load fans out into 30 internal calls. This shape is a **distributed monolith**: every cost of services, none of the independence.',
      ],
      keyIdea: 'If services must be released together or share a database, you have a monolith with network calls in the middle of it.',
      metrics: { deploys: '1/week', lead: '8 days', hops: '30', units: '12', avail: '98.8%' },
      metricTones: { deploys: 'bad', lead: 'bad', hops: 'bad', units: 'bad', avail: 'bad' },
      scene: {
        nodes: [
          { ...catalog, label: 'prices', status: 'hot' },
          { ...orders, label: 'carts', status: 'hot', load: 90, chips: [{ text: '30 calls per page', tone: 'bad' }] },
          { ...payments, label: 'stock', status: 'hot' },
          { ...db, label: 'shared DB', sub: '12 services write here', status: 'hot', badge: 'schema lock-in' },
        ],
        links: [link('orders', 'catalog'), link('orders', 'payments'), link('catalog', 'db'), link('orders', 'db'), link('payments', 'db')],
        flows: [
          { path: ['orders', 'catalog', 'orders', 'payments', 'orders'], tone: 'request', label: 'chatty calls', count: 4, duration: 2.4 },
          { path: ['catalog', 'db'], tone: 'error', duration: 1.2, delay: 0.6 },
          { path: ['payments', 'db'], tone: 'error', duration: 1.2, delay: 1.4 },
        ],
        panel: {
          title: 'The Tuesday test',
          icon: 'Clock',
          rows: [
            { text: 'Change one service alone?', value: 'no', tone: 'bad' },
            { text: 'Deploy it without telling anyone?', value: 'no', tone: 'bad' },
            { text: 'Verdict', value: 'distributed monolith', tone: 'bad' },
          ],
          footer: { text: 'More services will make it worse', tone: 'bad' },
        },
        caption: 'Separate processes, still one unit of change',
      },
    },
    {
      title: 'When to split',
      tag: 'tradeoff',
      heading: 'A short checklist before you split anything',
      eli5: 'Open a second shop only when the first kitchen is truly too crowded, you know which station should move, and you can afford the runners and a second manager.',
      body: [
        '**Stay on a monolith** (ideally a modular one) when the team is small enough to coordinate by talking, when the domain is still changing shape, or when nobody is free to run pipelines, tracing and on-call for many services.',
        '**Split a module out** when its team is blocked by the shared release, it scales very differently, it needs isolation, or it needs a different technology. Split one at a time and measure lead time. Sixty engineers with eight teams might run ten to twenty services. Five should run one.',
      ],
      keyIdea: 'Microservices solve an organizational problem: many teams shipping independently. Without that problem, they are mostly cost.',
      metrics: { deploys: '20/day', lead: '30 min', hops: '2', units: '3', avail: '99.7%' },
      metricTones: { deploys: 'good', lead: 'good' },
      scene: {
        nodes: [
          { ...catalog, status: 'ok', badge: 'team A' },
          { ...orders, status: 'ok', badge: 'team B' },
          { ...payments, status: 'ok', badge: 'team C' },
          { ...db, label: 'own DB each', sub: 'one per service' },
        ],
        links: [link('orders', 'catalog'), link('orders', 'payments'), link('orders', 'db')],
        flows: [
          { path: ['orders', 'catalog', 'orders'], tone: 'request', duration: 1.4 },
          { path: ['orders', 'payments', 'orders'], tone: 'request', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Split when',
          icon: 'Split',
          rows: [
            { text: 'Team blocked by shared release', value: 'yes', tone: 'good' },
            { text: 'Very different scaling', value: 'yes', tone: 'good' },
            { text: 'Compliance or security isolation', value: 'yes', tone: 'good' },
            { text: 'Small team, shifting domain', value: 'stay', tone: 'warn' },
            { text: 'No one to run the platform', value: 'stay', tone: 'warn' },
          ],
        },
        caption: 'One team per service, each with its own data',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Boundaries first, network last',
      eli5: 'Start with one kitchen. When it gets crowded, mark out stations. Move a station to its own shop only when it really needs its own door, and remember every shop needs runners and a manager.',
      body: [
        'A **monolith** gives a small team function calls, one transaction and one deploy. It hurts when many teams share one build and when nothing stops code from reaching into other code. A **modular monolith** fixes that with enforced interfaces and per-module tables.',
        '**Microservices** add independent deploys and scaling. You pay with network latency and partial failure, the loss of joins and shared transactions, and a platform to operate it all. Shared database or joint releases make a distributed monolith.',
      ],
      keyIdea: 'Get the module boundaries right while calls are still cheap. Promote a module to a service only when it has a concrete reason to deploy on its own.',
      metrics: { deploys: '20/day', lead: '30 min', hops: '2', units: '3', avail: '99.7%' },
      scene: {
        nodes: [shoppers, { ...orders, status: 'ok' }, payments, ordersDb],
        links: [link('shoppers', 'orders'), link('orders', 'payments'), link('orders', 'ordersDb')],
        flows: [
          { path: ['shoppers', 'orders', 'payments', 'orders', 'shoppers'], tone: 'request', count: 2, duration: 2.8 },
          { path: ['orders', 'ordersDb'], tone: 'data', duration: 1, delay: 1 },
        ],
        panel: {
          title: 'The ladder',
          icon: 'Boxes',
          rows: [
            { text: '1. Monolith', value: 'small team' },
            { text: '2. Modular monolith', value: 'default next step', tone: 'good' },
            { text: '3. Extract with a reason', value: 'strangler fig', tone: 'good' },
            { text: 'Skip to 3 with no reason', value: 'cost only', tone: 'bad' },
          ],
        },
        caption: 'Climb only as far as you need',
      },
      quiz: {
        question: 'Checkout calls four services in sequence, and each is available 99.9% of the time. With no fallbacks, roughly how available is checkout?',
        options: ['99.99%', '99.9%', '99.6%', '96%'],
        answer: 2,
        explain: 'Availabilities in a chain multiply: 0.999 to the fourth power is about 0.996. Each extra synchronous dependency lowers the ceiling, which is why chatty service chains are fragile.',
      },
    },
  ],
};
