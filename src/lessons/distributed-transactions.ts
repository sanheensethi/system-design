import type { Lesson, SceneNode } from '../engine/types';

const client: SceneNode = { id: 'client', kind: 'client', at: [-3, 3], label: 'shopper' };
const order: SceneNode = { id: 'order', kind: 'service', at: [-3.1, -0.1], label: 'order svc', sub: 'orders DB' };
const payment: SceneNode = { id: 'payment', kind: 'service', at: [-1.6, -1.6], label: 'payment svc', sub: 'payments DB' };
const inventory: SceneNode = { id: 'inventory', kind: 'service', at: [-0.1, -3.1], label: 'inventory svc', sub: 'stock DB' };
const coord: SceneNode = { id: 'coord', kind: 'server', at: [1.75, 1.75], label: 'coordinator', sub: 'transaction manager' };
const orderDb: SceneNode = { id: 'orderDb', kind: 'db', at: [0.25, 3.25], label: 'orders DB', sub: 'orders + outbox' };
const relay: SceneNode = { id: 'relay', kind: 'worker', at: [1.75, 1.75], label: 'outbox relay' };
const kafka: SceneNode = { id: 'kafka', kind: 'queue', at: [3.25, 0.25], label: 'Kafka', sub: 'order events' };

const sagaLinks = [
  { from: 'client', to: 'order' },
  { from: 'order', to: 'payment' },
  { from: 'order', to: 'inventory', style: 'dashed' as const },
];

const coordLinks = [
  { from: 'client', to: 'order' },
  { from: 'order', to: 'coord' },
  { from: 'coord', to: 'payment', style: 'dashed' as const },
  { from: 'coord', to: 'inventory', style: 'dashed' as const },
];

const outboxLinks = [
  { from: 'client', to: 'order' },
  { from: 'order', to: 'orderDb' },
  { from: 'relay', to: 'orderDb', style: 'dashed' as const },
  { from: 'relay', to: 'kafka' },
  { from: 'kafka', to: 'payment', style: 'dashed' as const },
  { from: 'kafka', to: 'inventory', style: 'dashed' as const },
];

export const distributedTransactions: Lesson = {
  id: 'distributed-transactions',
  title: 'Distributed transactions: 2PC, sagas, outbox',
  tagline: 'Keep one business action consistent when its data lives in several services that cannot share a transaction.',
  minutes: 18,
  level: 'Advanced',
  learn: [
    'Why one checkout across two services has no single transaction to rely on',
    'Two-phase commit, and why a crashed coordinator leaves everyone blocked',
    'Sagas: local transactions with compensating actions, orchestrated or choreographed',
    'The dual-write problem, and how the transactional outbox fixes it',
    'Why every consumer in this world must be idempotent',
  ],
  metrics: [
    { key: 'order', label: 'Order' },
    { key: 'payment', label: 'Payment' },
    { key: 'stock', label: 'Stock' },
    { key: 'risk', label: 'Risk' },
  ],
  steps: [
    {
      title: 'Half done',
      tag: 'problem',
      heading: 'The order was saved, the payment was not',
      eli5: 'A **travel agent** books your hotel, then the phone line to the train company goes dead. Now you have a hotel room and no way to get there.',
      body: [
        'A shopper checks out a pair of shoes for $80. Three things must happen: the order service records the order, the payment service charges the card, and the inventory service takes one pair out of stock. Each service owns its own database.',
        'Inside one database you would wrap all three in `BEGIN ... COMMIT` and get all or nothing. Here there is no shared transaction. The order service commits order 9001, calls payment, and the call times out. Did the charge happen? It cannot tell. If it crashes now, the order sits there with no payment and no reserved stock.',
        'Every option without a plan is bad: an order without a charge, a charge without an order, or stock reserved for a cart that was abandoned. This lesson covers the three tools for this problem: **two-phase commit**, **sagas** and the **transactional outbox**.',
      ],
      keyIdea: 'A single database gives you atomic commits. Once one action spans several databases, you have to build that guarantee yourself.',
      metrics: { order: '9001 saved', payment: 'unknown (timeout)', stock: 'not reserved', risk: 'half-finished checkout' },
      scene: {
        nodes: [
          { ...client, status: 'hot', badge: 'spinner...' },
          { ...order, status: 'ok', badge: 'order 9001 saved' },
          { ...payment, status: 'hot', badge: 'charged?' },
          { ...inventory, status: 'dim', badge: 'never called' },
        ],
        links: sagaLinks,
        flows: [
          { path: ['client', 'order'], tone: 'request', label: 'checkout $80', duration: 1.2 },
          { path: ['order', 'payment'], tone: 'request', label: 'charge', duration: 1.2, delay: 1.3 },
          { path: ['payment', 'order'], tone: 'error', label: 'timeout', duration: 1.2, delay: 2.6 },
        ],
        caption: 'Three databases, no shared COMMIT',
      },
    },
    {
      title: 'Two-phase',
      tag: 'concept',
      heading: 'Two-phase commit: ask everyone, then decide',
      eli5: 'The agent calls the hotel and the train: "Can you hold a spot for me?" Only when both say yes does the agent call back and say "Book it." If either says no, both holds are dropped.',
      body: [
        '**Two-phase commit (2PC)** adds a **coordinator**. In phase 1 it sends **prepare** to every participant. Each one does the work, writes it durably, keeps its row locks, and votes **yes** or **no**. A yes vote is a promise: "I can commit this, even if I crash and restart."',
        'In phase 2, if every vote was yes, the coordinator writes **commit** to its own log and tells everyone to commit. If any vote was no, or a participant did not answer, it tells everyone to roll back. The decision is the coordinator\'s alone, and it is written down before anyone hears it.',
        'Some databases expose this directly. PostgreSQL has `PREPARE TRANSACTION` and `COMMIT PREPARED`, and the XA standard lets a transaction manager drive several databases and message brokers this way.',
      ],
      keyIdea: '2PC gets atomicity across databases by making everyone promise first, then having one coordinator decide for all.',
      metrics: { order: 'waiting for votes', payment: 'prepared, locks held', stock: 'prepared, locks held', risk: 'locks held until decision' },
      scene: {
        nodes: [
          client,
          { ...order, status: 'active' },
          { ...payment, status: 'ok', badge: 'vote: yes' },
          { ...inventory, status: 'ok', badge: 'vote: yes' },
          { ...coord, status: 'active', badge: 'decision: commit' },
        ],
        links: coordLinks,
        flows: [
          { path: ['order', 'coord'], tone: 'request', label: 'begin', duration: 1 },
          { path: ['coord', 'payment'], tone: 'request', label: 'prepare', duration: 1, delay: 1.1 },
          { path: ['coord', 'inventory'], tone: 'request', label: 'prepare', duration: 1, delay: 1.1 },
          { path: ['payment', 'coord'], tone: 'handshake', label: 'yes', duration: 1, delay: 2.2 },
          { path: ['inventory', 'coord'], tone: 'handshake', label: 'yes', duration: 1, delay: 2.2 },
          { path: ['coord', 'payment'], tone: 'response', label: 'commit', duration: 1, delay: 3.4 },
          { path: ['coord', 'inventory'], tone: 'response', label: 'commit', duration: 1, delay: 3.4 },
        ],
        caption: 'Phase 1: prepare and vote. Phase 2: commit.',
      },
      code: {
        language: 'sql',
        title: 'PostgreSQL as a 2PC participant',
        source: `-- phase 1, on the payments database
BEGIN;
INSERT INTO charges (order_id, amount) VALUES (9001, 80.00);
PREPARE TRANSACTION 'order-9001';  -- durable, locks kept, vote yes

-- phase 1, on the stock database
BEGIN;
UPDATE stock SET qty = qty - 1 WHERE sku = 'SHOE-42' AND qty > 0;
PREPARE TRANSACTION 'order-9001';

-- phase 2, after the coordinator logged its decision
COMMIT PREPARED 'order-9001';      -- on both databases
-- or, if any vote was no or missing:
-- ROLLBACK PREPARED 'order-9001';`,
        highlight: [4, 12],
      },
    },
    {
      title: 'Blocking',
      tag: 'tradeoff',
      heading: 'When the coordinator dies, everyone waits',
      eli5: 'The hotel and the train both said yes and are holding your spots. Then the agent goes silent. Neither dares to give your spot away or confirm it, so the spots stay blocked for everyone.',
      body: [
        'The weak point is the gap after a participant votes yes. It promised to commit if told to, so it cannot roll back on its own. It also does not know the decision, so it cannot commit. If the coordinator crashes now, every participant is **in doubt** and keeps its row locks until the coordinator comes back and reads its log.',
        'Those locks block every other checkout for `SHOE-42`. A coordinator that is down for 5 minutes means 5 minutes of stuck rows. That is why 2PC is called a **blocking** protocol.',
        'It is also slow: two round trips plus forced disk writes, with locks held throughout, and every participant must be up for anything to commit. Distributed SQL databases still use it between their own shards, with the coordinator\'s state replicated by consensus so it is never lost. Across independent microservices, and across APIs like a card processor that cannot prepare, it is rarely an option.',
      ],
      keyIdea: '2PC is atomic but blocking: a participant that voted yes cannot move until the coordinator decides.',
      metrics: { order: 'stuck', payment: 'in doubt, locked', stock: 'in doubt, locked', risk: 'rows locked until coordinator returns' },
      scene: {
        nodes: [
          { ...client, status: 'hot', badge: 'waiting' },
          { ...order, status: 'hot' },
          { ...payment, status: 'hot', badge: 'voted yes: locked' },
          { ...inventory, status: 'hot', badge: 'voted yes: locked' },
          { ...coord, status: 'down', badge: 'crashed' },
        ],
        links: coordLinks,
        flows: [
          { path: ['payment', 'coord'], tone: 'error', label: 'decision?', duration: 1.2 },
          { path: ['inventory', 'coord'], tone: 'error', label: 'decision?', duration: 1.2, delay: 0.3 },
        ],
        caption: 'No decision, so no one can let go',
      },
    },
    {
      title: 'Saga',
      tag: 'concept',
      heading: 'Sagas: a chain of local commits, each with an undo',
      eli5: 'The agent books the hotel first, for real. Then the train. If the train is sold out, the agent calls the hotel back and cancels. Every booking comes with a known way to cancel it.',
      body: [
        'A **saga** splits the action into steps. Each step is an ordinary local transaction in one service, committed right away. For each step you also write a **compensating action** that undoes its business effect.',
        'Checkout as a saga: create order 9001 as `PENDING`, charge $80, reserve one pair of shoes, mark the order `CONFIRMED`. The compensations are: refund the $80, release the pair, mark the order `CANCELLED`. No locks are held between steps, and no service waits on another to commit.',
        'A compensation adds a new fact that cancels the old one. A charge that happened stays in the payment history, followed by a refund. The card statement shows both lines, and that is the honest record.',
      ],
      keyIdea: 'A saga trades atomic commit for a sequence of local commits plus a planned undo for each one.',
      metrics: { order: 'PENDING', payment: '$80 charged', stock: 'reserving...', risk: 'intermediate states visible' },
      scene: {
        nodes: [
          client,
          { ...order, status: 'active', badge: '1. PENDING' },
          { ...payment, status: 'ok', badge: '2. charged $80' },
          { ...inventory, status: 'active', badge: '3. reserve 1' },
        ],
        links: sagaLinks,
        flows: [
          { path: ['client', 'order'], tone: 'request', label: 'checkout', duration: 1 },
          { path: ['order', 'payment'], tone: 'request', label: 'charge', duration: 1, delay: 1.1 },
          { path: ['payment', 'order'], tone: 'response', label: 'ok', duration: 1, delay: 2.2 },
          { path: ['order', 'inventory'], tone: 'request', label: 'reserve', duration: 1.2, delay: 3.3 },
        ],
        caption: 'Each step commits on its own',
      },
    },
    {
      title: 'Compensate',
      tag: 'case',
      heading: 'Case: out of stock after the card was charged',
      eli5: 'The train is sold out. The agent does not pretend the hotel was never booked. It calls the hotel and cancels, and you get your money back.',
      body: [
        'The last pair of `SHOE-42` sold a second earlier. Inventory answers `out of stock`. The saga now runs the compensations for the steps that succeeded, in reverse order: refund the $80, then mark order 9001 `CANCELLED` and tell the shopper.',
        'Between the charge and the refund, other code could see a charged payment for an order that will not ship. Sagas give **no isolation**. You design for it: show the order as "processing", order the steps so the hard-to-undo ones run last, and put cheap, likely-to-fail checks such as stock first.',
        'A compensation must not fail for business reasons, and it may run more than once if a retry happens. Make it idempotent: refunding order 9001 twice must produce one refund.',
      ],
      keyIdea: 'When a saga step fails, undo the finished steps in reverse. Intermediate states are visible, so order steps to keep them harmless.',
      metrics: { order: 'CANCELLED', payment: 'refunded $80', stock: 'out of stock', risk: 'charge visible for ~2 s' },
      scene: {
        nodes: [
          { ...client, badge: 'sorry, sold out' },
          { ...order, status: 'active', badge: 'CANCELLED' },
          { ...payment, status: 'ok', badge: 'refund $80' },
          { ...inventory, status: 'hot', badge: 'qty 0' },
        ],
        links: sagaLinks,
        flows: [
          { path: ['inventory', 'order'], tone: 'error', label: 'out of stock', duration: 1.2 },
          { path: ['order', 'payment'], tone: 'event', label: 'refund', duration: 1, delay: 1.3 },
          { path: ['payment', 'order'], tone: 'response', label: 'refunded', duration: 1, delay: 2.4 },
          { path: ['order', 'client'], tone: 'response', label: 'cancelled', duration: 1.2, delay: 3.5 },
        ],
        caption: 'Undo in reverse order',
      },
      quiz: {
        question: 'A saga charges the card, then books a courier, then reserves stock. Stock runs out often. What is the best change?',
        options: [
          'Wrap all three steps in one 2PC transaction',
          'Reserve stock first, since it fails most often and is cheapest to undo',
          'Skip compensations and fix failures by hand',
          'Retry the stock step until it succeeds',
        ],
        answer: 1,
        explain: 'Put the step most likely to fail, and cheapest to undo, first. Then a stock failure needs no refund and no courier cancellation. 2PC is not available across a card processor, and retrying will not create shoes.',
      },
    },
    {
      title: 'Who drives',
      tag: 'tradeoff',
      heading: 'Orchestration or choreography',
      eli5: 'Either one agent calls the hotel and the train in turn and keeps the checklist, or each shop tells the next one when it is done. One has a boss with the full picture, the other has no boss at all.',
      body: [
        'In **orchestration** one component, the orchestrator, runs the saga. It calls each service in turn, records progress, and runs the compensations on failure. The whole flow lives in one place, which makes it easy to read, change and debug. The orchestrator must persist its progress so a crash resumes the saga. Workflow engines such as Temporal or AWS Step Functions do that part for you.',
        'In **choreography** there is no central driver. The order service publishes `OrderPlaced`, payment reacts and publishes `PaymentCharged`, inventory reacts to that, and a failure event triggers the compensations. Services stay loosely coupled, but the flow exists only as the sum of who listens to what. With five or more steps it gets hard to see, and easy to create cycles.',
        'A reasonable default: choreography for two or three steps, orchestration once the flow has branches, timeouts or many compensations.',
      ],
      keyIdea: 'Orchestration puts the saga in one readable place. Choreography spreads it across events. Pick by how complex the flow is.',
      metrics: { order: 'CONFIRMED', payment: '$80 charged', stock: '1 reserved', risk: 'orchestrator must persist state' },
      scene: {
        nodes: [
          client,
          { ...order, status: 'ok', badge: 'CONFIRMED' },
          { ...payment, status: 'ok', badge: 'step 1 done' },
          { ...inventory, status: 'ok', badge: 'step 2 done' },
          { ...coord, label: 'orchestrator', sub: 'saga log', status: 'active', badge: 'step 2 of 2' },
        ],
        links: coordLinks,
        flows: [
          { path: ['order', 'coord'], tone: 'request', label: 'start saga', duration: 1 },
          { path: ['coord', 'payment'], tone: 'request', label: 'charge', duration: 1, delay: 1.1 },
          { path: ['payment', 'coord'], tone: 'response', label: 'ok', duration: 1, delay: 2.2 },
          { path: ['coord', 'inventory'], tone: 'request', label: 'reserve', duration: 1, delay: 3.3 },
          { path: ['inventory', 'coord'], tone: 'response', label: 'ok', duration: 1, delay: 4.4 },
        ],
      },
      code: {
        language: 'python',
        title: 'A minimal saga orchestrator',
        source: `STEPS = [
    (payments.charge,   payments.refund),
    (inventory.reserve, inventory.release),
]

def run_checkout(order_id):
    done = []
    for action, compensate in STEPS:
        try:
            action(order_id)                      # a local transaction in that service
            done.append(compensate)
            saga_log.save(order_id, len(done))    # resume from here after a crash
        except BusinessError:
            for undo in reversed(done):
                undo(order_id)                    # must be idempotent
            orders.set_status(order_id, "CANCELLED")
            return
    orders.set_status(order_id, "CONFIRMED")`,
        highlight: [10, 12, 14, 15],
      },
    },
    {
      title: 'Dual write',
      tag: 'case',
      heading: 'Case: the order is saved but the event never leaves',
      eli5: 'The agent writes your booking in the notebook, and is about to post a letter to the train company when the lights go out. The notebook says booked. The train company never hears about it.',
      body: [
        'Choreography and many orchestrators depend on events. The obvious code commits the order, then publishes `OrderPlaced` to Kafka. That is a **dual write**: two systems, two separate writes, and no transaction around both.',
        'If the process crashes between the commit and the publish, the order exists and the event is lost. Payment never charges, and order 9001 stays `PENDING` forever. Swap the order of the writes and you get the opposite failure: the event goes out, the commit fails, and payment charges for an order that does not exist.',
        'Retrying the publish does not help if the process is gone. A deploy that restarts pods during peak traffic produces exactly this kind of crash, a few times a week.',
      ],
      keyIdea: 'Writing to a database and a broker as two separate steps will, sooner or later, do one without the other.',
      metrics: { order: 'PENDING forever', payment: 'never asked', stock: 'never asked', risk: 'lost event' },
      scene: {
        nodes: [
          client,
          { ...order, status: 'down', badge: 'crashed after commit' },
          { ...orderDb, status: 'ok', badge: 'order 9001' },
          { ...kafka, status: 'dim', badge: 'no event' },
          { ...payment, status: 'dim' },
          { ...inventory, status: 'dim' },
        ],
        links: [
          { from: 'client', to: 'order' },
          { from: 'order', to: 'orderDb' },
          { from: 'order', to: 'kafka', style: 'faint' },
          { from: 'kafka', to: 'payment', style: 'dashed' },
          { from: 'kafka', to: 'inventory', style: 'dashed' },
        ],
        flows: [
          { path: ['client', 'order'], tone: 'request', label: 'checkout', duration: 1 },
          { path: ['order', 'orderDb'], tone: 'request', label: 'COMMIT', duration: 1.2, delay: 1.1 },
          { path: ['order', 'kafka'], tone: 'error', label: 'publish (never sent)', duration: 1.4, delay: 2.5 },
        ],
        caption: 'Two writes, no transaction around both',
      },
    },
    {
      title: 'Outbox',
      tag: 'concept',
      heading: 'The transactional outbox: one commit, then a relay',
      eli5: 'The agent writes the booking and a "letter to send" note on the same notebook page, in one go. A **helper** reads the notebook and posts every letter that is not marked sent yet.',
      body: [
        'Write the event into the same database as the order, inside the same transaction. An `outbox` table holds one row per event. Either both rows commit or neither does, so there is no gap between "saved" and "announced".',
        'A separate **relay** publishes outbox rows to Kafka and marks them sent. It can poll the table every few hundred milliseconds, or use **change data capture** (for example Debezium reading the database\'s write-ahead log) to pick up new rows as they commit.',
        'The relay can crash after publishing and before marking a row sent. On restart it publishes that row again. The outbox gives you **at-least-once** delivery, so the next step matters.',
      ],
      keyIdea: 'Commit the state change and its event in one local transaction, and let a relay publish the event afterwards.',
      metrics: { order: 'PENDING', payment: 'event on the way', stock: 'event on the way', risk: 'duplicates possible' },
      scene: {
        nodes: [
          client,
          { ...order, status: 'active' },
          { ...orderDb, status: 'ok', badge: 'order + outbox row' },
          { ...relay, status: 'active', badge: 'polls every 200 ms' },
          { ...kafka, status: 'active', badge: 'OrderPlaced' },
          payment,
          inventory,
        ],
        links: outboxLinks,
        flows: [
          { path: ['client', 'order'], tone: 'request', label: 'checkout', duration: 1 },
          { path: ['order', 'orderDb'], tone: 'request', label: 'one COMMIT', duration: 1.2, delay: 1.1 },
          { path: ['orderDb', 'relay'], tone: 'data', label: 'new row', duration: 1, delay: 2.5 },
          { path: ['relay', 'kafka'], tone: 'event', label: 'publish', duration: 1, delay: 3.6 },
          { path: ['kafka', 'payment'], tone: 'event', duration: 1.2, delay: 4.7 },
          { path: ['kafka', 'inventory'], tone: 'event', duration: 1.2, delay: 4.7 },
        ],
        caption: 'The event cannot be lost once the order exists',
      },
      code: {
        language: 'sql',
        title: 'Write the order and its event together',
        source: `BEGIN;
INSERT INTO orders (id, user_id, total, status)
VALUES (9001, 7, 80.00, 'PENDING');

INSERT INTO outbox (id, topic, payload)
VALUES (gen_random_uuid(), 'order-placed',
        '{"order_id": 9001, "total": 80.00}');
COMMIT;                          -- both rows, or neither

-- the relay, in a loop:
SELECT id, topic, payload FROM outbox
WHERE  published_at IS NULL
ORDER  BY created_at LIMIT 100;
-- publish each row to Kafka, then:
UPDATE outbox SET published_at = now() WHERE id = ANY(:sent_ids);`,
        highlight: [5, 8, 15],
      },
    },
    {
      title: 'Idempotent',
      tag: 'concept',
      heading: 'Consumers must survive the same event twice',
      eli5: 'Sometimes the helper posts the same letter twice. The train company keeps a list of letters it has already handled, and throws away any copy it has seen before.',
      body: [
        'The outbox relay, Kafka redeliveries and saga retries all produce duplicates. If payment handles `OrderPlaced` for order 9001 twice and charges twice, the outbox just made things worse.',
        'Make every consumer **idempotent**. Each event carries a unique id. The consumer records handled ids in a `processed_events` table, in the same local transaction as its own change. A duplicate hits the unique key, and the consumer skips it.',
        'For calls to outside systems, such as the card processor, send an **idempotency key** like `charge:9001`, so the provider drops a repeated request too. With the outbox on the sending side and idempotent consumers on the receiving side, each effect happens once.',
      ],
      keyIdea: 'Outbox plus idempotent consumers turns at-least-once delivery into effects that happen exactly once.',
      metrics: { order: 'PENDING', payment: 'charged once', stock: '1 reserved', risk: 'duplicate dropped' },
      scene: {
        nodes: [
          order,
          { ...orderDb, status: 'ok' },
          { ...relay, status: 'hot', badge: 'restarted: resend' },
          { ...kafka, status: 'active', badge: 'event 7f3a x2' },
          { ...payment, status: 'ok', badge: 'seen 7f3a: skip' },
          { ...inventory, status: 'ok', badge: 'seen 7f3a: skip' },
        ],
        links: outboxLinks.filter((l) => l.from !== 'client'),
        flows: [
          { path: ['relay', 'kafka'], tone: 'event', label: '7f3a', duration: 1 },
          { path: ['relay', 'kafka'], tone: 'event', label: '7f3a again', duration: 1, delay: 1.2 },
          { path: ['kafka', 'payment'], tone: 'event', count: 2, duration: 1.2, delay: 2.3 },
          { path: ['kafka', 'inventory'], tone: 'event', count: 2, duration: 1.2, delay: 2.3 },
        ],
        caption: 'Same event twice, one effect',
      },
    },
    {
      title: 'Choosing',
      tag: 'tradeoff',
      heading: 'Which tool, and when to avoid the problem',
      eli5: 'If one shop sells both the room and the ticket, you pay once at one counter and nothing can go half wrong. Only split the booking across shops when you have to.',
      body: [
        '**Avoid it first.** If two pieces of data must always change together, consider keeping them in one service and one database, where a plain transaction works. Many sagas exist only because a service boundary was drawn through the middle of one business rule.',
        '**2PC** fits when all participants are databases you control that support it, the transaction is short, and you can live with blocking on coordinator failure. In practice that mostly means inside a single distributed database.',
        '**Saga plus outbox plus idempotent consumers** is the usual answer across microservices. You give up isolation and immediate consistency. You get services that stay available when one of them is slow, and a clear record of every step and every undo.',
      ],
      keyIdea: 'Keep data that must change together in one database when you can. Across services, use a saga with an outbox and idempotent consumers.',
      metrics: { order: 'CONFIRMED', payment: '$80 charged once', stock: '1 reserved', risk: 'eventually consistent' },
      scene: {
        nodes: [
          client,
          { ...order, status: 'ok', badge: 'CONFIRMED' },
          { ...orderDb, status: 'ok' },
          relay,
          kafka,
          { ...payment, status: 'ok', badge: 'charged once' },
          { ...inventory, status: 'ok', badge: 'reserved' },
        ],
        links: outboxLinks,
        flows: [
          { path: ['order', 'orderDb'], tone: 'request', label: 'commit + outbox', duration: 1.2 },
          { path: ['orderDb', 'relay', 'kafka'], tone: 'event', duration: 1.6, delay: 1.3 },
          { path: ['kafka', 'payment'], tone: 'event', duration: 1.2, delay: 3 },
          { path: ['kafka', 'inventory'], tone: 'event', duration: 1.2, delay: 3 },
        ],
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'One business action, many databases',
      eli5: 'The agent either gets a firm yes from everyone before booking, or books step by step and cancels if something fails. Every message is noted in the notebook first, and every shop ignores copies.',
      body: [
        'One checkout across services has no shared transaction. **2PC** makes participants prepare and vote, then a coordinator decides. It is atomic, holds locks, and blocks when the coordinator dies.',
        'A **saga** commits each step locally and runs **compensating actions** in reverse on failure, with no isolation in between. **Orchestration** keeps the flow in one place, **choreography** spreads it over events. The **transactional outbox** removes the dual-write gap, and **idempotent consumers** absorb the duplicates it creates.',
      ],
      keyIdea: 'Across services, consistency comes from local commits, planned undos, an outbox for events, and consumers that ignore repeats.',
      metrics: { order: 'CONFIRMED', payment: '$80 charged once', stock: '1 reserved', risk: 'eventually consistent' },
      scene: {
        nodes: [
          { ...client, status: 'ok', badge: 'order confirmed' },
          { ...order, status: 'ok' },
          { ...orderDb, status: 'ok' },
          relay,
          kafka,
          { ...payment, status: 'ok' },
          { ...inventory, status: 'ok' },
        ],
        links: outboxLinks,
        flows: [
          { path: ['client', 'order', 'orderDb'], tone: 'request', label: 'checkout', duration: 1.6 },
          { path: ['orderDb', 'relay', 'kafka'], tone: 'event', duration: 1.6, delay: 1.7 },
          { path: ['kafka', 'payment'], tone: 'event', duration: 1.2, delay: 3.4 },
          { path: ['kafka', 'inventory'], tone: 'event', duration: 1.2, delay: 3.4 },
          { path: ['order', 'client'], tone: 'response', label: 'confirmed', duration: 1.2, delay: 4.8 },
        ],
      },
      quiz: {
        question: 'A service updates a row and then publishes an event to Kafka. Once a week an event goes missing after a deploy. What is the right fix?',
        options: [
          'Publish the event before updating the row',
          'Retry the publish three times with backoff',
          'Insert the event into an outbox table in the same transaction as the row, and have a relay publish it',
          'Wrap the row update and the publish in a 2PC transaction with Kafka',
        ],
        answer: 2,
        explain: 'The bug is a dual write: a crash between the two writes loses the event. Retries cannot run if the process is gone, and publishing first just reverses the failure. The outbox makes the event part of the same local commit, and the relay delivers it at least once, so consumers must also be idempotent.',
      },
    },
  ],
};
