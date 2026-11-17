import type { Lesson, SceneNode, SceneZone } from '../engine/types';

const devs: SceneNode = { id: 'devs', kind: 'user', at: [-6.5, -1.5], label: 'engineers', sub: '60 people, 8 teams' };
const train: SceneNode = { id: 'train', kind: 'queue', at: [-3, -1.5], label: 'release train', sub: 'build + tests' };
const mono: SceneNode = { id: 'mono', kind: 'server', at: [0, -1.5], label: 'shop monolith', sub: 'one deployable' };
const db: SceneNode = { id: 'db', kind: 'db', at: [0, 3.5], label: 'Postgres', sub: 'one schema' };

const shoppers: SceneNode = { id: 'shoppers', kind: 'client', at: [-6.5, -1.5], label: 'shoppers' };
const catalog: SceneNode = { id: 'catalog', kind: 'service', at: [-3, -1.5], label: 'catalog' };
const orders: SceneNode = { id: 'orders', kind: 'service', at: [0, -1.5], label: 'orders' };
const payments: SceneNode = { id: 'payments', kind: 'service', at: [3, -1.5], label: 'payments' };
const catalogDb: SceneNode = { id: 'catalogDb', kind: 'db', at: [-3, 3.5], label: 'catalog DB' };
const ordersDb: SceneNode = { id: 'ordersDb', kind: 'db', at: [0, 3.5], label: 'orders DB' };
const paymentsDb: SceneNode = { id: 'paymentsDb', kind: 'db', at: [3, 3.5], label: 'payments DB' };
const monitor: SceneNode = { id: 'monitor', kind: 'monitor', at: [3, -5], label: 'tracing', sub: 'logs, metrics' };

const oneDeployable: SceneZone = { id: 'deployable', from: [-4.4, -2.9], to: [4.4, -0.1], label: 'one deployable', tone: 'blue' };

const splitLinks = [
  { from: 'shoppers', to: 'orders' },
  { from: 'orders', to: 'catalog', label: 'HTTP' },
  { from: 'orders', to: 'payments', label: 'HTTP' },
  { from: 'catalog', to: 'catalogDb' },
  { from: 'orders', to: 'ordersDb' },
  { from: 'payments', to: 'paymentsDb' },
];

export const monolithMicroservices: Lesson = {
  id: 'monolith-microservices',
  title: 'Monolith, modular monolith, microservices',
  tagline: 'Start with one deployable, learn where it hurts as teams grow, and know what a split costs before you pay for it.',
  minutes: 15,
  level: 'Intermediate',
  learn: [
    'Why one deployable is the right start for a small team',
    'The symptoms that show a monolith has outgrown its team structure',
    'How a modular monolith gets clean boundaries without a network',
    'What a split costs: network calls, data ownership and operations',
    'How to tell when not to split',
  ],
  metrics: [
    { key: 'deploys', label: 'Deploys' },
    { key: 'lead', label: 'Commit to prod' },
    { key: 'hops', label: 'Network hops / checkout' },
    { key: 'units', label: 'Deployables' },
    { key: 'avail', label: 'Checkout availability' },
  ],
  steps: [
    {
      title: 'Release train',
      tag: 'problem',
      heading: 'Sixty engineers, one release a week',
      eli5: 'Sixty cooks share one kitchen with one door. Nothing leaves until every dish on the big tray is ready, so one burnt dish holds up dinner for everyone.',
      body: [
        'An online shop runs as one application: catalog, orders and payments live in one codebase, build into one artifact and talk to one Postgres schema. Eight teams, **60 engineers**, all commit to it.',
        'The full test suite takes 45 minutes and fails for someone most days, so the company ships on a weekly **release train**. A fix for a payments bug waits six days behind an unfinished catalog feature. When the release goes bad, 200 commits are suspects.',
        'Nothing here is a traffic problem. The servers are fine. The pain is that every team shares one build, one release and one blast radius.',
      ],
      keyIdea: 'The first sign a monolith is in trouble is slow, risky releases. Load is rarely the reason.',
      metrics: { deploys: '1/week', lead: '6 days', hops: '0', units: '1', avail: '99.9%' },
      scene: {
        nodes: [devs, { ...train, status: 'hot', badge: '200 commits waiting' }, { ...mono, badge: 'v412' }, db],
        links: [{ from: 'devs', to: 'train' }, { from: 'train', to: 'mono', label: 'weekly' }, { from: 'mono', to: 'db' }],
        flows: [
          { path: ['devs', 'train'], tone: 'data', label: 'commit', count: 6, duration: 1 },
          { path: ['train', 'mono'], tone: 'event', label: 'weekly release', duration: 2.4, delay: 2 },
        ],
        caption: 'Every team ships through the same queue',
      },
    },
    {
      title: 'Why it started',
      tag: 'concept',
      heading: 'One deployable was the right first choice',
      eli5: 'When the restaurant had five cooks, one small kitchen was perfect. Everyone could reach every shelf, and a dish went from stove to table in a minute.',
      body: [
        'Three years earlier the same shop had five engineers. A **monolith** (one codebase, one process, one database) let them ship ten times a day. A feature that touched catalog, orders and payments was one pull request and one deploy.',
        'Calls between parts of the system were plain function calls: nanoseconds, never lost, never retried. Placing an order and recording the payment sat inside **one database transaction**, so the data could not end up half written. Debugging meant reading one stack trace.',
        'Scaling was also simple. The app is stateless, so you run more copies behind a load balancer, as in the load balancing lesson. A monolith scales out fine. What it does not scale is the number of people changing it at once.',
      ],
      keyIdea: 'A monolith gives a small team function calls, one transaction and one deploy. Those are worth a lot, and you give them up when you split.',
      metrics: { deploys: '10/day', lead: '20 min', hops: '0', units: '1', avail: '99.9%' },
      scene: {
        nodes: [{ ...devs, sub: '5 people, 1 team' }, { ...train, sub: '4 min build', status: 'ok' }, { ...mono, status: 'ok' }, { ...db, badge: '1 transaction' }],
        links: [{ from: 'devs', to: 'train' }, { from: 'train', to: 'mono' }, { from: 'mono', to: 'db' }],
        flows: [
          { path: ['devs', 'train', 'mono'], tone: 'data', label: 'commit to prod', duration: 1.6 },
          { path: ['mono', 'db'], tone: 'request', label: 'BEGIN ... COMMIT', duration: 1, delay: 1.8 },
          { path: ['db', 'mono'], tone: 'response', duration: 1, delay: 2.9 },
        ],
        caption: 'Small team: every change ships in minutes',
      },
    },
    {
      title: 'Where it hurts',
      tag: 'concept',
      heading: 'The code tangled as the team grew',
      eli5: 'Now sixty cooks reach across each other for the same shelves. The pastry cook moves a jar, and the grill cook cannot find the salt.',
      body: [
        'Nothing stopped the catalog code from reading the `payments` tables directly, so over three years it did. Orders code calls private helpers deep inside payments. A change to one table breaks code owned by three other teams.',
        'This is a **big ball of mud**: the code is in one place, and so is every dependency between its parts. The costs follow from that. Tests for everything must run on every change. Teams queue behind each other. One memory leak in the image resizer restarts the process that takes payments.',
        'Notice what the cause is. The trouble comes from missing boundaries, and a single deployable only makes missing boundaries cheap to ignore. That points to the first fix, and it does not involve a network.',
      ],
      keyIdea: 'The damage comes from code and data with no boundaries. Fix the boundaries first, then decide whether anything needs its own process.',
      metrics: { deploys: '1/week', lead: '6 days', hops: '0', units: '1', avail: '99.9%' },
      scene: {
        zones: [oneDeployable],
        nodes: [
          { ...catalog, status: 'hot', badge: 'reads payment tables' },
          { ...orders, status: 'hot' },
          { ...payments, status: 'hot', badge: 'called from everywhere' },
          { ...db, status: 'hot', badge: 'everyone writes everything' },
        ],
        links: [
          { from: 'catalog', to: 'orders' },
          { from: 'orders', to: 'payments' },
          { from: 'catalog', to: 'db' },
          { from: 'orders', to: 'db' },
          { from: 'payments', to: 'db' },
        ],
        flows: [
          { path: ['catalog', 'db'], tone: 'error', label: 'SELECT FROM payments', duration: 1.4 },
          { path: ['orders', 'payments'], tone: 'error', label: 'private helper', duration: 1.2, delay: 0.6 },
          { path: ['payments', 'db'], tone: 'request', duration: 1.2, delay: 1.2 },
        ],
        caption: 'One process, and no walls inside it',
      },
    },
    {
      title: 'Modular monolith',
      tag: 'concept',
      heading: 'Draw the walls inside the process first',
      eli5: 'We keep one kitchen but paint lines on the floor. Each station has its own shelves, and a cook who needs something from another station asks at its counter.',
      body: [
        'A **modular monolith** is still one deployable, split into modules with enforced rules. Each module exposes a small public interface. Other modules may call that interface and nothing else. Each module owns its tables, and no other module queries them.',
        'The rules are checked by the build, so they hold when people are in a hurry. A lint rule or an architecture test fails the pull request if `catalog` imports from inside `payments`. In the database, each module gets its own schema and its own database role.',
        'You keep function calls, one transaction where you need one, and one thing to deploy. Tests can run per module, so the build drops from 45 minutes to about 8 for most changes, and the train can leave daily. Many companies stop here for years.',
      ],
      keyIdea: 'A modular monolith buys most of the team independence of services while calls stay in-process and data stays in one database.',
      metrics: { deploys: '1/day', lead: '1 day', hops: '0', units: '1', avail: '99.9%' },
      scene: {
        zones: [oneDeployable],
        nodes: [
          { ...catalog, status: 'ok' },
          { ...orders, status: 'active', badge: 'calls public API only' },
          { ...payments, status: 'ok' },
          { ...db, sub: '3 schemas, 3 roles' },
        ],
        links: [
          { from: 'orders', to: 'catalog', label: 'function call' },
          { from: 'orders', to: 'payments', label: 'function call' },
          { from: 'orders', to: 'db' },
        ],
        flows: [
          { path: ['orders', 'catalog'], tone: 'request', label: 'getPrice()', duration: 0.9 },
          { path: ['orders', 'payments'], tone: 'request', label: 'charge()', duration: 0.9, delay: 1 },
          { path: ['orders', 'db'], tone: 'data', label: 'orders schema', duration: 1, delay: 2 },
        ],
        caption: 'Same process, enforced module boundaries',
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
      title: 'First split',
      tag: 'concept',
      heading: 'Split out the one module with a real reason',
      eli5: 'The dessert station gets so busy it moves to its own little shop next door, with its own fridge and its own door. A runner now carries orders between the two.',
      body: [
        'Payments has reasons the other modules lack. It falls under card-industry audit rules, so keeping it small shrinks the audit. It needs a slower, more careful release process. And its team wants to ship a fix without waiting for the catalog tests.',
        'So payments becomes a **service**: its own repository, its own deploy pipeline, its own database, reached over HTTP or gRPC. Because the module already had a narrow public interface, the change is mostly swapping an in-process call for a client that speaks the same interface over the network.',
        'Good reasons to split are specific: a different release cadence, a very different scaling profile, a compliance boundary, or a team that needs full ownership. "Services are modern" is not on that list.',
      ],
      keyIdea: 'Extract a service when a module needs to deploy, scale or be secured differently from the rest. A clean module boundary makes the extraction small.',
      metrics: { deploys: '1/day + 5/day', lead: '1 day / 30 min', hops: '1', units: '2', avail: '99.8%' },
      scene: {
        zones: [{ ...oneDeployable, to: [1.4, -0.1], label: 'shop monolith' }],
        nodes: [
          shoppers,
          catalog,
          { ...orders, status: 'active' },
          { ...payments, status: 'ok', badge: 'own pipeline', sub: 'separate service' },
          { ...ordersDb, label: 'shop DB' },
          { ...paymentsDb, status: 'ok' },
        ],
        links: [
          { from: 'shoppers', to: 'orders' },
          { from: 'orders', to: 'catalog' },
          { from: 'orders', to: 'payments', label: 'HTTP' },
          { from: 'orders', to: 'ordersDb' },
          { from: 'payments', to: 'paymentsDb' },
        ],
        flows: [
          { path: ['shoppers', 'orders'], tone: 'request', label: 'POST /checkout', duration: 1.2 },
          { path: ['orders', 'payments'], tone: 'request', label: 'POST /charges', duration: 1, delay: 1.3 },
          { path: ['payments', 'paymentsDb'], tone: 'data', duration: 0.9, delay: 2.4 },
          { path: ['payments', 'orders'], tone: 'response', label: '201', duration: 1, delay: 3.4 },
        ],
        caption: 'Payments leaves the monolith, with its data',
      },
    },
    {
      title: 'Network tax',
      tag: 'tradeoff',
      heading: 'Cost one: a function call became a network call',
      eli5: 'Inside one kitchen you hand a plate to the next cook. Between shops, a runner carries it down the street. The runner is slower, and sometimes the runner never comes back.',
      body: [
        'Go further and split all three modules. A checkout that used to be two function calls is now two network round trips. Each adds about 1 to 2 ms on a good day inside one datacenter, plus serialization, and far more at the tail when a service is busy.',
        'The bigger change is failure. A function call either returns or the whole process is dead. A network call has a third outcome: **no answer**. You cannot tell whether the charge happened. So every call needs a timeout, a bounded retry and an **idempotency key**, so a retried charge does not bill the customer twice.',
        'Availability multiplies. If each service is up 99.9% of the time and checkout needs all three, checkout is up about `0.999 × 0.999 × 0.999 = 99.7%`. That is roughly 26 hours of downtime a year, up from under 9. Circuit breakers and fallbacks win some of it back, and each one is code you now own.',
      ],
      keyIdea: 'Every service boundary adds latency and a new way to fail. A chain of services is less available than any one of them.',
      metrics: { deploys: '20/day', lead: '30 min', hops: '2', units: '3', avail: '99.7%' },
      scene: {
        nodes: [
          shoppers,
          { ...catalog, badge: '99.9%' },
          { ...orders, status: 'active', badge: 'waits on 2 calls' },
          { ...payments, status: 'down', badge: 'no answer' },
          catalogDb,
          ordersDb,
          paymentsDb,
        ],
        links: splitLinks,
        flows: [
          { path: ['shoppers', 'orders'], tone: 'request', label: 'POST /checkout', duration: 1.1 },
          { path: ['orders', 'catalog', 'orders'], tone: 'request', label: 'price? 2 ms', duration: 1.4, delay: 1.2 },
          { path: ['orders', 'payments'], tone: 'error', label: 'charge ... timeout', duration: 1.8, delay: 2.7 },
          { path: ['orders', 'payments'], tone: 'handshake', label: 'retry, same key', duration: 1.2, delay: 4.6 },
        ],
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
        highlight: [2, 7, 9, 16, 18],
      },
    },
    {
      title: 'Data ownership',
      tag: 'tradeoff',
      heading: 'Cost two: no shared database, no shared transaction',
      eli5: 'Each shop now has its own fridge with its own lock. To learn what is in the dessert shop fridge, you have to ask the dessert shop. You cannot open it yourself.',
      body: [
        'A service that shares a database with another service is not independent. Any schema change still needs both teams, so the rule is **one service, one database**, and nobody else touches it.',
        'Two things you used for free are gone. The first is the **join**. "Orders with product names and payment status" was one SQL query. Now it is a call to each service stitched together in code, or a copy of the data kept up to date by events.',
        'The second is the **transaction**. "Create the order and charge the card" can no longer commit or roll back as one unit. You need a saga: a sequence of local transactions with a compensating step (refund the charge) if a later one fails, usually driven by events published through an outbox. The distributed transactions lesson covers the mechanics. In between steps, the system is visibly inconsistent, and your code and your support team must cope with that.',
      ],
      keyIdea: 'Splitting data trades joins and atomic transactions for API calls, copied data and sagas. This is usually the most expensive part of a split.',
      metrics: { deploys: '20/day', lead: '30 min', hops: '2', units: '3', avail: '99.7%' },
      scene: {
        nodes: [
          shoppers,
          catalog,
          { ...orders, status: 'active', badge: 'order PENDING' },
          { ...payments, status: 'active' },
          catalogDb,
          { ...ordersDb, status: 'active', badge: 'local commit 1' },
          { ...paymentsDb, status: 'active', badge: 'local commit 2' },
        ],
        links: [...splitLinks, { from: 'ordersDb', to: 'paymentsDb', style: 'dashed' as const, label: 'no join, no shared txn' }],
        flows: [
          { path: ['orders', 'ordersDb'], tone: 'data', label: 'INSERT order', duration: 1 },
          { path: ['orders', 'payments'], tone: 'event', label: 'OrderPlaced', duration: 1.2, delay: 1.1 },
          { path: ['payments', 'paymentsDb'], tone: 'data', label: 'INSERT charge', duration: 1, delay: 2.4 },
          { path: ['payments', 'orders'], tone: 'event', label: 'PaymentCaptured', duration: 1.2, delay: 3.5 },
        ],
        caption: 'Two local commits, joined by events',
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
      title: 'Ops bill',
      tag: 'tradeoff',
      heading: 'Cost three: you now operate a distributed system',
      eli5: 'One kitchen needed one manager, one cleaning rota and one fire alarm. Three shops need three of each, plus someone who can follow an order as it passes through all of them.',
      body: [
        'One deployable meant one pipeline, one dashboard, one log stream and one on-call rota. Three services means three of each, and a real microservice estate means dozens. Each service also needs service discovery, its own secrets and its own capacity plan.',
        'A slow checkout used to be one stack trace. Now the request crosses three processes, so you need **distributed tracing**: a trace id passed on every call, so the hops can be stitched back into one timeline. Without it, an incident is three teams each saying their own dashboard looks fine.',
        'Local development gets heavier, API changes need versioning because callers deploy at different times, and end-to-end tests become slow and flaky. All of this is solvable with a platform team and good tooling. For a company of 20 engineers that platform team is a quarter of the staff.',
      ],
      keyIdea: 'Microservices move complexity out of the code and into operations. You need the people and tooling to carry it.',
      metrics: { deploys: '20/day', lead: '30 min', hops: '2', units: '3', avail: '99.7%' },
      scene: {
        nodes: [
          shoppers,
          { ...catalog, badge: 'pipeline 1' },
          { ...orders, badge: 'pipeline 2' },
          { ...payments, badge: 'pipeline 3' },
          catalogDb,
          ordersDb,
          paymentsDb,
          { ...monitor, status: 'active', badge: 'trace 7f3a: 3 spans' },
        ],
        links: [...splitLinks, { from: 'payments', to: 'monitor', style: 'faint' as const }],
        flows: [
          { path: ['shoppers', 'orders', 'payments'], tone: 'request', label: 'trace-id 7f3a', duration: 1.8 },
          { path: ['orders', 'catalog'], tone: 'request', label: 'trace-id 7f3a', duration: 1, delay: 0.9 },
          { path: ['payments', 'monitor'], tone: 'event', label: 'spans', count: 3, duration: 1, delay: 2 },
        ],
        caption: 'Three of everything, plus tooling to see across them',
      },
    },
    {
      title: 'Fake split',
      tag: 'case',
      heading: 'Case: twelve services that deploy as one',
      eli5: 'A restaurant splits into twelve tiny shops, but they all still share one fridge. Now every dish needs twelve runners, and nobody can change a shelf without asking everyone.',
      body: [
        'A 15-person startup splits its monolith into twelve services in one quarter, one per noun in the data model: users, carts, prices, stock and so on. They keep one shared database "for now".',
        'A year later every feature touches four services and needs a coordinated release in a fixed order. A page load fans out into 30 internal calls. One slow service takes the site down. The team has every cost from the last three steps and none of the independence. This shape has a name: the **distributed monolith**.',
        'The quick test for it: can one team change and deploy its service on a Tuesday afternoon without telling anyone? If the honest answer is no, the boundaries are in the wrong place, and more services will make it worse.',
      ],
      keyIdea: 'If services must be released together or share a database, you have a monolith with network calls in the middle of it.',
      metrics: { deploys: '1/week', lead: '8 days', hops: '30', units: '12', avail: '98.8%' },
      scene: {
        nodes: [
          shoppers,
          { ...catalog, label: 'prices', status: 'hot' },
          { ...orders, label: 'carts', status: 'hot', badge: '30 calls per page' },
          { ...payments, label: 'stock', status: 'hot' },
          { ...db, label: 'shared DB', sub: '12 services write here', status: 'hot', badge: 'schema lock-in' },
        ],
        links: [
          { from: 'shoppers', to: 'orders' },
          { from: 'orders', to: 'catalog' },
          { from: 'orders', to: 'payments' },
          { from: 'catalog', to: 'db' },
          { from: 'orders', to: 'db' },
          { from: 'payments', to: 'db' },
        ],
        flows: [
          { path: ['shoppers', 'orders'], tone: 'request', duration: 1 },
          { path: ['orders', 'catalog', 'orders', 'payments', 'orders'], tone: 'request', label: 'chatty calls', count: 4, duration: 2.4, delay: 1 },
          { path: ['catalog', 'db'], tone: 'error', duration: 1.2, delay: 1.6 },
          { path: ['payments', 'db'], tone: 'error', duration: 1.2, delay: 2.4 },
        ],
        caption: 'Separate processes, still one unit of change',
      },
    },
    {
      title: 'When to split',
      tag: 'tradeoff',
      heading: 'A short checklist before you split anything',
      eli5: 'Open a second shop only when the first kitchen is truly too crowded, you know which station should move, and you can afford the runners and a second manager.',
      body: [
        '**Stay on a monolith** (ideally a modular one) when the team is small enough to coordinate by talking, when the domain is still changing shape so boundaries drawn today will be wrong in six months, or when nobody is free to run pipelines, tracing and on-call for many services.',
        '**Split a module out** when it meets a specific need: its team is blocked by the shared release, it scales very differently (a video transcoder next to a CRUD app), it must be isolated for security or compliance, or it needs a different technology. Split one at a time and measure whether lead time improved.',
        'The count of services is not a goal. A useful rule of thumb is that a service should belong to one team, and a team should be able to own a handful. Sixty engineers with eight teams might run ten to twenty services. Five engineers should run one.',
      ],
      keyIdea: 'Microservices solve an organizational problem: many teams shipping independently. Without that problem, they are mostly cost.',
      metrics: { deploys: '20/day', lead: '30 min', hops: '2', units: '3', avail: '99.7%' },
      scene: {
        nodes: [
          shoppers,
          { ...catalog, status: 'ok', badge: 'team A' },
          { ...orders, status: 'ok', badge: 'team B' },
          { ...payments, status: 'ok', badge: 'team C' },
          catalogDb,
          ordersDb,
          paymentsDb,
        ],
        links: splitLinks,
        flows: [
          { path: ['shoppers', 'orders'], tone: 'request', duration: 1 },
          { path: ['orders', 'catalog', 'orders'], tone: 'request', duration: 1.4, delay: 1 },
          { path: ['orders', 'payments', 'orders'], tone: 'request', duration: 1.4, delay: 2.4 },
          { path: ['orders', 'shoppers'], tone: 'response', duration: 1, delay: 3.9 },
        ],
        caption: 'One team per service, each with its own data',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Boundaries first, network last',
      eli5: 'Start with one kitchen. When it gets crowded, mark out stations. Move a station to its own shop only when it really needs its own door, and remember every shop needs runners and a manager.',
      body: [
        'A **monolith** gives a small team function calls, one transaction and one deploy. It hurts when many teams share one build and one release, and when nothing stops code from reaching into other code. A **modular monolith** fixes the second problem with enforced interfaces and per-module tables, at no runtime cost.',
        '**Microservices** add independent deploys and scaling per service. You pay with network latency and partial failure (three 99.9% services in a chain give 99.7%), with the loss of joins and shared transactions, and with a platform to deploy, trace and operate it all. Services that share a database or must release together are a distributed monolith.',
      ],
      keyIdea: 'Get the module boundaries right while calls are still cheap. Promote a module to a service only when it has a concrete reason to deploy on its own.',
      metrics: { deploys: '20/day', lead: '30 min', hops: '2', units: '3', avail: '99.7%' },
      scene: {
        nodes: [shoppers, catalog, { ...orders, status: 'ok' }, payments, catalogDb, ordersDb, paymentsDb],
        links: splitLinks,
        flows: [
          { path: ['shoppers', 'orders', 'payments', 'orders', 'shoppers'], tone: 'request', count: 2, duration: 2.8 },
          { path: ['orders', 'ordersDb'], tone: 'data', duration: 1, delay: 1 },
          { path: ['payments', 'paymentsDb'], tone: 'data', duration: 1, delay: 1.6 },
        ],
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
