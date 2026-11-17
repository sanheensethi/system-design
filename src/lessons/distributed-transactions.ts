import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const client: SceneNode = { id: 'client', kind: 'client', at: at(-4.4, -4.4), label: 'shopper' };
const order: SceneNode = { id: 'order', kind: 'block', at: at(0, -4.4), label: 'order svc', sub: 'orders DB', icon: 'ShoppingBag', tint: 'blue' };
const coord: SceneNode = { id: 'coord', kind: 'block', at: at(4.4, -4.4), label: 'coordinator', sub: 'transaction manager', icon: 'Scale', tint: 'violet' };
const payment: SceneNode = { id: 'payment', kind: 'block', at: at(0, 4.4), label: 'payment svc', sub: 'payments DB', icon: 'Receipt', tint: 'green' };
const inventory: SceneNode = { id: 'inventory', kind: 'block', at: at(4.4, 4.4), label: 'inventory svc', sub: 'stock DB', icon: 'Package', tint: 'amber' };
const orderDb: SceneNode = { id: 'orderDb', kind: 'db', at: at(-4.4, 0), label: 'orders DB', sub: 'orders + outbox' };
const relay: SceneNode = { id: 'relay', kind: 'worker', at: at(0, 0), label: 'outbox relay' };
const kafka: SceneNode = { id: 'kafka', kind: 'queue', at: at(4.4, 0), label: 'Kafka', sub: 'order events' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

export const distributedTransactions: Lesson = {
  id: 'distributed-transactions',
  title: 'Distributed transactions: 2PC, sagas, outbox',
  tagline: 'Keep one business action consistent when its data lives in several services that cannot share a transaction.',
  minutes: 22,
  level: 'Advanced',
  learn: [
    'Why one checkout across two services has no single transaction to rely on',
    'Two-phase commit, and why a crashed coordinator leaves everyone blocked',
    'Sagas: local transactions with compensating actions, orchestrated or choreographed',
    'Saga isolation anomalies, pivot steps, try-confirm-cancel and stuck sagas',
    'The dual-write problem, and how the transactional outbox fixes it',
    'Why every consumer in this world must be idempotent',
  ],
  metrics: [
    { key: 'order', label: 'Order', icon: 'ShoppingBag' },
    { key: 'payment', label: 'Payment', icon: 'Receipt' },
    { key: 'stock', label: 'Stock', icon: 'Package' },
    { key: 'risk', label: 'Risk', icon: 'Shield' },
  ],
  steps: [
    {
      title: 'Half done',
      tag: 'problem',
      heading: 'The order was saved, the payment was not',
      eli5: 'A **travel agent** books your hotel, then the phone line to the train company goes dead. Now you have a hotel room and no way to get there.',
      body: [
        'A shopper checks out a pair of shoes for $80. Three things must happen: the order service records the order, the payment service charges the card, and the inventory service takes one pair out of stock. Each service owns its own database.',
        'The order service commits order 9001 and calls payment. The call times out. If it crashes now, the order sits there with no payment and no reserved stock.',
      ],
      keyIdea: 'Once one action spans several databases, the all-or-nothing guarantee is no longer free.',
      metrics: { order: '9001 saved', payment: 'unknown (timeout)', stock: 'not reserved', risk: 'half-finished checkout' },
      metricTones: { order: 'good', payment: 'bad', stock: 'bad', risk: 'bad' },
      scene: {
        nodes: [
          { ...client, status: 'hot', badge: 'spinner...' },
          { ...order, status: 'ok', badge: 'order 9001 saved' },
          { ...payment, status: 'hot', badge: 'charged?' },
          { ...inventory, status: 'dim', badge: 'never called' },
        ],
        links: [link('client', 'order'), link('order', 'payment', { label: 'timeout', labelTone: 'warn' }), link('order', 'inventory', { style: 'dashed' })],
        flows: [
          { path: ['client', 'order'], tone: 'request', label: 'checkout $80', duration: 1.2 },
          { path: ['order', 'payment'], tone: 'request', label: 'charge', duration: 1.2, delay: 1.3 },
          { path: ['payment', 'order'], tone: 'error', label: 'timeout', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'Three databases, one checkout',
          icon: 'Table',
          rows: [
            { text: 'orders DB', value: 'order 9001', tone: 'good' },
            { text: 'payments DB', value: 'charge? unknown', tone: 'bad' },
            { text: 'stock DB', value: 'untouched', tone: 'warn' },
          ],
          footer: { text: 'No shared COMMIT', tone: 'bad' },
        },
        caption: 'Three databases, no shared COMMIT',
      },
    },
    {
      title: 'One database',
      tag: 'concept',
      heading: 'Inside one database, atomic commit is free',
      eli5: 'In a single shop with one cash desk, the shopkeeper writes the sale and takes the stock in one go. Either both happen or neither does.',
      body: [
        'In one database you wrap the work in `BEGIN ... COMMIT`. The engine guarantees **atomicity**: all the writes land, or none do. A crash in the middle rolls everything back.',
        'That guarantee lives in one engine with one log. The moment the order, the charge and the stock sit in three engines, no single log can promise it.',
      ],
      keyIdea: 'Atomic commit is a feature of one database engine. Across engines you must build it.',
      metrics: { order: 'saved', payment: 'charged', stock: 'reserved', risk: 'none: one engine' },
      metricTones: { order: 'good', payment: 'good', stock: 'good', risk: 'good' },
      scene: {
        nodes: [
          { ...order, status: 'active', chips: ['BEGIN', 'INSERT order + charge', 'UPDATE stock', 'COMMIT'] },
          { id: 'one', kind: 'db', at: at(0, 4.4), label: 'one database', sub: 'one log', status: 'ok', badge: 'all or nothing' },
        ],
        links: [link('order', 'one', { label: 'one transaction' })],
        flows: [{ path: ['order', 'one'], tone: 'request', label: 'COMMIT', duration: 1.4 }],
        panel: {
          title: 'One engine',
          icon: 'Database',
          code: 'BEGIN;\nINSERT INTO orders ...;\nINSERT INTO charges ...;\nUPDATE stock ...;\nCOMMIT;  -- all or nothing',
        },
        caption: 'A single log decides for everything',
      },
    },
    {
      title: 'Unknown outcome',
      tag: 'concept',
      heading: 'A timeout does not say what happened',
      eli5: 'You send a letter asking the hotel to book you. No reply comes. Maybe the letter got lost, or the hotel booked you and the reply got lost. You cannot tell which.',
      body: [
        'When the order service calls payment and hears nothing, three things could be true: the request never arrived, the charge ran and the reply was lost, or payment is still working.',
        'Retrying blindly risks a double charge. Giving up risks a charge with no order. Every protocol in this lesson exists to handle this ambiguity safely.',
      ],
      keyIdea: 'A network call can succeed, fail or vanish. The caller only sees a missing reply.',
      metrics: { order: 'waiting', payment: 'unknown', stock: 'not reserved', risk: 'cannot tell what happened' },
      metricTones: { payment: 'bad', risk: 'bad' },
      scene: {
        nodes: [
          { ...order, status: 'active', badge: 'no reply after 3 s' },
          { ...payment, status: 'dim', badge: 'A, B or C?' },
        ],
        links: [link('order', 'payment', { label: 'no reply', labelTone: 'warn' })],
        flows: [
          { path: ['order', 'payment'], tone: 'request', label: 'charge $80', duration: 1.4 },
          { path: ['payment', 'order'], tone: 'error', label: '?', duration: 1.4, delay: 1.6 },
        ],
        panel: {
          title: 'What the order service knows',
          icon: 'Clock',
          rows: [
            { text: 'Request sent', value: 'yes', tone: 'good' },
            { text: 'Reply received', value: 'no', tone: 'bad' },
            { text: 'A: request never arrived', tone: 'muted' },
            { text: 'B: charged, reply lost', tone: 'muted' },
            { text: 'C: still working', tone: 'muted' },
            { text: 'Card charged', value: 'unknown', tone: 'warn' },
          ],
        },
        caption: 'Silence is not a failure message',
      },
    },
    {
      title: '2PC prepare',
      tag: 'concept',
      heading: 'Two-phase commit, phase 1: ask everyone to prepare',
      eli5: 'The agent calls the hotel and the train: "Can you hold a spot for me?" Each one writes the hold in its book and says yes or no.',
      body: [
        '**Two-phase commit (2PC)** adds a **coordinator**. In phase 1 it sends **prepare** to every participant. Each one does the work, writes it durably, keeps its row locks, and votes **yes** or **no**.',
        'A yes vote is a promise: "I can commit this, even if I crash and restart."',
      ],
      keyIdea: 'In phase 1 each participant does the work, locks it and promises it can commit.',
      metrics: { order: 'waiting for votes', payment: 'prepared, locks held', stock: 'prepared, locks held', risk: 'locks held until decision' },
      metricTones: { payment: 'warn', stock: 'warn', risk: 'warn' },
      scene: {
        nodes: [
          { ...coord, status: 'active', badge: 'asking for votes' },
          { ...payment, status: 'ok', badge: 'vote: yes' },
          { ...inventory, status: 'ok', badge: 'vote: yes' },
        ],
        links: [link('coord', 'payment', { style: 'dashed' }), link('coord', 'inventory', { style: 'dashed' })],
        flows: [
          { path: ['coord', 'payment'], tone: 'request', label: 'prepare', duration: 1.2 },
          { path: ['coord', 'inventory'], tone: 'request', label: 'prepare', duration: 1.2 },
          { path: ['payment', 'coord'], tone: 'handshake', label: 'yes', duration: 1.2, delay: 1.5 },
          { path: ['inventory', 'coord'], tone: 'handshake', label: 'yes', duration: 1.2, delay: 1.5 },
        ],
        panel: {
          title: 'After voting yes',
          icon: 'KeyRound',
          rows: [
            { text: 'Work written to disk', value: 'durable', tone: 'good' },
            { text: 'Row locks', value: 'held', tone: 'warn' },
            { text: 'Can roll back alone?', value: 'no', tone: 'bad' },
          ],
        },
        caption: 'Phase 1: prepare and vote',
      },
    },
    {
      title: '2PC commit',
      tag: 'concept',
      heading: 'Phase 2: the coordinator decides for all',
      eli5: 'Only when both say yes does the agent call back and say "Book it." If either says no, the agent tells both to drop their holds.',
      body: [
        'If every vote was yes, the coordinator writes **commit** to its own log and tells everyone to commit. If any vote was no, or one did not answer, it tells everyone to roll back.',
        'The decision is the coordinator\'s alone, and it is written down before anyone hears it. PostgreSQL has `PREPARE TRANSACTION` and `COMMIT PREPARED` for exactly this.',
      ],
      keyIdea: '2PC gets atomicity across databases by making everyone promise first, then letting one coordinator decide.',
      metrics: { order: 'CONFIRMED', payment: '$80 charged', stock: '1 reserved', risk: 'locks released' },
      metricTones: { order: 'good', payment: 'good', stock: 'good', risk: 'good' },
      scene: {
        nodes: [
          { ...coord, status: 'active', badge: 'decision: commit' },
          { ...payment, status: 'ok', badge: 'committed' },
          { ...inventory, status: 'ok', badge: 'committed' },
        ],
        links: [link('coord', 'payment', { style: 'dashed' }), link('coord', 'inventory', { style: 'dashed' })],
        flows: [
          { path: ['coord', 'payment'], tone: 'response', label: 'commit', duration: 1.2 },
          { path: ['coord', 'inventory'], tone: 'response', label: 'commit', duration: 1.2 },
        ],
        panel: {
          title: 'Decision rule',
          icon: 'Scale',
          rows: [
            { text: 'All votes yes', value: 'COMMIT', tone: 'good' },
            { text: 'Any vote no', value: 'ROLLBACK', tone: 'bad' },
            { text: 'Any vote missing', value: 'ROLLBACK', tone: 'bad' },
          ],
          footer: { text: 'Logged before anyone is told', tone: 'muted' },
        },
        caption: 'Phase 2: commit or roll back, everywhere',
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
        highlight: [4, 9, 12],
      },
    },
    {
      title: 'Blocking',
      tag: 'tradeoff',
      heading: 'When the coordinator dies, everyone waits',
      eli5: 'The hotel and the train both said yes and are holding your spots. Then the agent goes silent. Neither dares to give your spot away or confirm it, so the spots stay blocked for everyone.',
      body: [
        'After a yes vote a participant cannot roll back on its own, and it does not know the decision, so it cannot commit either. If the coordinator crashes now, every participant is **in doubt** and keeps its row locks until the coordinator returns and reads its log.',
        'Those locks block every other checkout for `SHOE-42`. A coordinator that is down for 5 minutes means 5 minutes of stuck rows. That is why 2PC is called a **blocking** protocol.',
      ],
      keyIdea: '2PC is atomic but blocking: a participant that voted yes cannot move until the coordinator decides.',
      metrics: { order: 'stuck', payment: 'in doubt, locked', stock: 'in doubt, locked', risk: 'rows locked until coordinator returns' },
      metricTones: { order: 'bad', payment: 'bad', stock: 'bad', risk: 'bad' },
      scene: {
        nodes: [
          { ...coord, status: 'down', badge: 'crashed' },
          { ...payment, status: 'hot', load: 92, badge: 'locked: order-9001' },
          { ...inventory, status: 'hot', load: 88, badge: 'locked: SHOE-42' },
        ],
        links: [link('coord', 'payment', { style: 'dashed', label: 'silence', labelTone: 'warn' }), link('coord', 'inventory', { style: 'dashed' })],
        flows: [
          { path: ['payment', 'coord'], tone: 'error', label: 'decision?', duration: 1.2 },
          { path: ['inventory', 'coord'], tone: 'error', label: 'decision?', duration: 1.2, delay: 0.3 },
        ],
        panel: {
          title: 'A participant in doubt',
          icon: 'Clock',
          rows: [
            { text: 'Voted yes', value: 'yes', tone: 'good' },
            { text: 'Can commit alone?', value: 'no', tone: 'bad' },
            { text: 'Can roll back alone?', value: 'no', tone: 'bad' },
            { text: 'Locks', value: 'held', tone: 'bad' },
          ],
        },
        caption: 'No decision, so no one can let go',
      },
      quiz: {
        question: 'In 2PC, a participant voted yes and then the coordinator crashed. What can the participant do?',
        options: [
          'Roll back on its own to free the locks',
          'Commit on its own, since it voted yes',
          'Wait, holding its locks, until the coordinator returns or another node learns the decision',
          'Ask a different participant to decide',
        ],
        answer: 2,
        explain: 'A yes vote is a promise to commit if told to, so it cannot roll back alone. It does not know the decision, so it cannot commit alone either. It waits with locks held.',
      },
    },
    {
      title: '2PC cost',
      tag: 'tradeoff',
      heading: 'What 2PC costs even when nothing crashes',
      eli5: 'Before anyone books anything, the agent has to phone every shop twice and wait for every single one to pick up. If one shop is closed, no one books.',
      body: [
        'Two round trips plus forced disk writes, with locks held throughout. Every participant must be up: three services at 99.9% give about 99.7%.',
        'A card processor has no prepare step, so it cannot join. Spanner, CockroachDB and TiDB replicate the coordinator and each participant with Raft or Paxos, so a lost node leaves no rows in doubt. That is why 2PC suits one database cluster.',
      ],
      keyIdea: '2PC costs latency, held locks and combined availability. It fits inside one database cluster, rarely across services.',
      metrics: { order: 'commit in 2 round trips', payment: 'locks held ~40 ms', stock: 'locks held ~40 ms', risk: 'availability 99.7%' },
      metricTones: { order: 'warn', payment: 'warn', stock: 'warn', risk: 'warn' },
      scene: {
        nodes: [
          { ...order, status: 'active', badge: 'begin' },
          { ...coord, status: 'active' },
          { ...payment, status: 'active', load: 55 },
          { ...inventory, status: 'active', load: 55 },
        ],
        links: [link('order', 'coord'), link('coord', 'payment', { style: 'dashed', label: '2 round trips', labelTone: 'warn' }), link('coord', 'inventory', { style: 'dashed' })],
        flows: [
          { path: ['order', 'coord'], tone: 'request', label: 'begin', duration: 1 },
          { path: ['coord', 'payment', 'coord'], tone: 'request', label: 'prepare / yes', duration: 1.6, delay: 1.1 },
          { path: ['coord', 'inventory', 'coord'], tone: 'request', label: 'prepare / yes', duration: 1.6, delay: 1.1 },
        ],
        panel: {
          title: 'The price list',
          icon: 'Gauge',
          rows: [
            { text: 'Round trips', value: '2 + forced writes', tone: 'warn' },
            { text: 'Locks held', value: 'across both phases', tone: 'warn' },
            { text: 'All participants up', value: 'required', tone: 'bad' },
            { text: '3 x 99.9%', value: '99.7%', tone: 'warn' },
          ],
        },
        caption: 'Slow even on a good day',
      },
    },
    {
      title: 'Saga',
      tag: 'concept',
      heading: 'Sagas: a chain of local commits, each with an undo',
      eli5: 'The agent books the hotel first, for real. Then the train. Every booking comes with a known way to cancel it.',
      body: [
        'A **saga** splits the action into steps. Each step is an ordinary local transaction in one service, committed right away. For each step you also write a **compensating action** that undoes its business effect.',
        'Checkout as a saga: create order 9001 as `PENDING`, charge $80, reserve one pair, mark the order `CONFIRMED`. No locks are held between steps, and no service waits on another to commit.',
      ],
      keyIdea: 'A saga trades atomic commit for a sequence of local commits plus a planned undo for each one.',
      metrics: { order: 'PENDING', payment: '$80 charged', stock: 'reserving...', risk: 'intermediate states visible' },
      metricTones: { order: 'warn', payment: 'good', stock: 'warn', risk: 'warn' },
      scene: {
        nodes: [
          { ...order, status: 'active', badge: '1. PENDING' },
          { ...payment, status: 'ok', badge: '2. charged $80' },
          { ...inventory, status: 'active', badge: '3. reserve 1' },
        ],
        links: [link('order', 'payment'), link('order', 'inventory', { style: 'dashed' })],
        flows: [
          { path: ['order', 'payment'], tone: 'request', label: 'charge', duration: 1 },
          { path: ['payment', 'order'], tone: 'response', label: 'ok', duration: 1, delay: 1.1 },
          { path: ['order', 'inventory'], tone: 'request', label: 'reserve', duration: 1.2, delay: 2.2 },
        ],
        panel: {
          title: 'Step and its undo',
          icon: 'Repeat',
          rows: [
            { text: 'create order PENDING', value: 'cancel order' },
            { text: 'charge $80', value: 'refund $80' },
            { text: 'reserve 1 pair', value: 'release 1 pair' },
          ],
          footer: { text: 'Each step commits on its own', tone: 'muted' },
        },
        caption: 'Each step commits on its own',
      },
    },
    {
      title: 'Compensate',
      tag: 'case',
      heading: 'Case: out of stock after the card was charged',
      eli5: 'The train is sold out. The agent does not pretend the hotel was never booked. It calls the hotel and cancels, and you get your money back.',
      body: [
        'The last pair of `SHOE-42` sold a second earlier. Inventory answers `out of stock`. The saga undoes the finished steps in reverse: refund the $80, then mark order 9001 `CANCELLED`.',
        'The charge stays in the history, followed by a refund line. Retries can run a compensation twice, so make it idempotent: a refund key like `refund:9001` makes two refunds one.',
      ],
      keyIdea: 'When a saga step fails, undo the finished steps in reverse with new, cancelling facts.',
      metrics: { order: 'CANCELLED', payment: 'refunded $80', stock: 'out of stock', risk: 'charge visible for ~2 s' },
      metricTones: { order: 'warn', payment: 'good', stock: 'bad', risk: 'warn' },
      scene: {
        nodes: [
          { ...order, status: 'active', badge: 'CANCELLED' },
          { ...payment, status: 'ok', badge: 'refund $80' },
          { ...inventory, status: 'hot', badge: 'qty 0' },
        ],
        links: [link('order', 'payment'), link('order', 'inventory', { style: 'dashed' })],
        flows: [
          { path: ['inventory', 'order'], tone: 'error', label: 'out of stock', duration: 1.2 },
          { path: ['order', 'payment'], tone: 'event', label: 'refund', duration: 1, delay: 1.3 },
          { path: ['payment', 'order'], tone: 'response', label: 'refunded', duration: 1, delay: 2.4 },
        ],
        panel: {
          title: 'Payment history',
          icon: 'Receipt',
          rows: [
            { text: 'charge order 9001', value: '+ $80.00' },
            { text: 'refund order 9001', value: '- $80.00', tone: 'good' },
          ],
          footer: { text: 'Both lines stay on the statement', tone: 'muted' },
        },
        caption: 'Undo in reverse order',
      },
      code: {
        language: 'python',
        title: 'An idempotent refund',
        source: `def refund(order_id):
    # the same key on every retry: the processor refunds once
    psp.refund(charge_id=f"charge:{order_id}",
               idempotency_key=f"refund:{order_id}")
    payments.mark_refunded(order_id)   # upsert, safe to repeat`,
        highlight: [3, 4],
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
      title: 'Undo rules',
      tag: 'concept',
      heading: 'Some steps cannot be undone, so order the saga around them',
      eli5: 'Once the train has left the station, you cannot cancel it. So the agent books the cancellable parts first and the train last.',
      body: [
        'Steps fall in three kinds. **Compensatable** steps can be undone. The **pivot** is the point of no return, such as a courier pickup. **Retriable** steps after the pivot cannot fail for business reasons, so they retry until they succeed, such as sending the receipt.',
        'This order differs from the earlier saga on purpose. Stock moves first here because it fails most often, so a failure there costs no refund. Then the charge, then the pivot, then the receipt.',
      ],
      keyIdea: 'Order saga steps as compensatable, then pivot, then retriable, with the riskiest step first.',
      metrics: { order: 'PENDING', payment: 'compensatable', stock: 'compensatable', risk: 'pivot not yet passed' },
      metricTones: { order: 'warn', payment: 'good', stock: 'good', risk: 'warn' },
      scene: {
        nodes: [
          { ...order, status: 'active' },
          { ...inventory, status: 'ok', badge: '1. reserve (undoable)' },
          { ...payment, status: 'ok', badge: '2. charge (undoable)' },
          { id: 'courier', kind: 'block', at: at(-4.4, 0), label: 'courier svc', sub: 'pivot step', icon: 'Route', tint: 'red', status: 'hot', badge: '3. pickup (pivot)' },
          { id: 'receipt', kind: 'block', at: at(4.4, -4.4), label: 'receipt svc', sub: 'retriable step', icon: 'Mail', tint: 'teal', status: 'active', badge: '4. send receipt (retry)' },
        ],
        links: [link('order', 'inventory'), link('order', 'payment'), link('order', 'courier', { style: 'dashed' }), link('order', 'receipt', { style: 'dashed' })],
        flows: [
          { path: ['order', 'inventory'], tone: 'request', label: '1', duration: 1 },
          { path: ['order', 'payment'], tone: 'request', label: '2', duration: 1, delay: 1.1 },
          { path: ['order', 'courier'], tone: 'request', label: '3: no way back', duration: 1.2, delay: 2.2 },
          { path: ['order', 'receipt'], tone: 'request', label: '4: retry until sent', duration: 1.2, delay: 3.5 },
        ],
        panel: {
          title: 'Step order',
          icon: 'List',
          rows: [
            { text: '1. reserve stock', value: 'undo: release', tone: 'good' },
            { text: '2. charge card', value: 'undo: refund', tone: 'good' },
            { text: '3. courier pickup', value: 'pivot: no undo', tone: 'bad' },
            { text: '4. send receipt', value: 'retry until done', tone: 'warn' },
          ],
        },
        caption: 'Risky steps go before the pivot',
      },
    },
    {
      title: 'No isolation',
      tag: 'tradeoff',
      heading: 'Sagas have no isolation, so others see half-done work',
      eli5: 'While the agent is still booking, a friend peeks at the notebook and sees a hotel booked and no train. The friend might act on that half-finished picture.',
      body: [
        'Between the charge and the refund, other code could see a charged payment for an order that will not ship. Two sagas can also touch the same row and overwrite each other, or one can read what a failing saga is about to undo.',
        'Design around it. Mark rows with a **semantic lock** such as `status = PENDING`. Show "processing" to users. Re-read a value before changing it. Order steps so the hard-to-undo ones run last.',
      ],
      keyIdea: 'Sagas give up isolation. Counter it with pending states, semantic locks and careful step order.',
      metrics: { order: 'PENDING', payment: '$80 charged', stock: 'reserving', risk: 'readers see half-done work' },
      metricTones: { order: 'warn', payment: 'warn', stock: 'warn', risk: 'bad' },
      scene: {
        nodes: [
          { ...client, status: 'active', chips: [{ text: 'GET /orders/9001', tone: 'warn' }] },
          { ...order, status: 'hot', chips: [{ text: 'status: PENDING', tone: 'warn' }] },
          { ...payment, status: 'ok', badge: 'charged, may be refunded' },
        ],
        links: [link('client', 'order', { label: 'reads mid-saga', labelTone: 'warn' }), link('order', 'payment')],
        flows: [
          { path: ['client', 'order'], tone: 'request', label: 'what is my status?', duration: 1.3 },
          { path: ['order', 'client'], tone: 'response', label: 'PENDING: processing', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'Countermeasures',
          icon: 'Shield',
          rows: [
            { text: 'Semantic lock', value: 'status = PENDING' },
            { text: 'Honest UI', value: '"processing"' },
            { text: 'Re-read before write', value: 'version check' },
            { text: 'Risky steps', value: 'run last', tone: 'good' },
          ],
        },
        caption: 'Others can see the middle of the saga',
      },
    },
    {
      title: 'Orchestration',
      tag: 'concept',
      heading: 'Orchestration: one component runs the saga',
      eli5: 'One agent keeps the checklist. It calls the hotel, ticks it off, calls the train, ticks it off. If something fails, it knows exactly what to cancel.',
      body: [
        'In **orchestration** one component, the orchestrator, calls each service in turn, records progress, and runs the compensations on failure. The whole flow lives in one place, which makes it easy to read, change and debug.',
        'The orchestrator must persist its progress so a crash resumes the saga. Workflow engines such as Temporal or AWS Step Functions do that part for you.',
      ],
      keyIdea: 'An orchestrator keeps the saga readable in one place, as long as it saves its own progress.',
      metrics: { order: 'CONFIRMED', payment: '$80 charged', stock: '1 reserved', risk: 'orchestrator must persist state' },
      metricTones: { order: 'good', payment: 'good', stock: 'good', risk: 'warn' },
      scene: {
        nodes: [
          { ...coord, label: 'orchestrator', sub: 'saga log', status: 'active', badge: 'step 2 of 2' },
          { ...payment, status: 'ok', badge: 'step 1 done' },
          { ...inventory, status: 'ok', badge: 'step 2 done' },
        ],
        links: [link('coord', 'payment', { arrow: 'both' }), link('coord', 'inventory', { arrow: 'both' })],
        flows: [
          { path: ['coord', 'payment'], tone: 'request', label: 'charge', duration: 1 },
          { path: ['payment', 'coord'], tone: 'response', label: 'ok', duration: 1, delay: 1.1 },
          { path: ['coord', 'inventory'], tone: 'request', label: 'reserve', duration: 1, delay: 2.2 },
          { path: ['inventory', 'coord'], tone: 'response', label: 'ok', duration: 1, delay: 3.3 },
        ],
        panel: {
          title: 'Saga log for order 9001',
          icon: 'List',
          rows: [
            { text: 'charge', value: 'done', tone: 'good' },
            { text: 'reserve', value: 'done', tone: 'good' },
            { text: 'confirm order', value: 'next', tone: 'warn' },
          ],
        },
        caption: 'The orchestrator calls, records and undoes',
      },
      code: {
        language: 'python',
        title: 'A minimal saga orchestrator',
        source: `STEPS = [(payments.charge, payments.refund), (inventory.reserve, inventory.release)]

def run_checkout(order_id, step=0):
    for i in range(step, len(STEPS)):
        action, compensate = STEPS[i]
        saga_log.save(order_id, i)            # intent first, so a crash resumes here
        try:
            action(order_id)                  # idempotent: a resume may repeat it
        except (BusinessError, Timeout):      # a timeout may have run the step
            for _, undo in reversed(STEPS[:i + 1]):
                undo(order_id)                # idempotent, safe if it never ran
            orders.set_status(order_id, "CANCELLED")
            return
    orders.set_status(order_id, "CONFIRMED")

def resume(order_id):
    run_checkout(order_id, saga_log.last_step(order_id))`,
        highlight: [6, 8, 9, 16],
      },
    },
    {
      title: 'Choreography',
      tag: 'concept',
      heading: 'Choreography: each service reacts to events',
      eli5: 'There is no boss. When the order desk finishes, it shouts "order placed!". The hotel hears it, books, and shouts "paid!". The train hears that and books next.',
      body: [
        'In **choreography** there is no central driver. The order service publishes `OrderPlaced`, payment reacts and publishes `PaymentCharged`, inventory reacts to that. If inventory emits `StockFailed`, payment reacts by refunding and emits `PaymentRefunded`, and the order service cancels.',
        'Services stay loosely coupled. The flow exists only as the sum of who listens to what.',
      ],
      keyIdea: 'In choreography each service listens for events and emits its own. Nobody holds the whole flow.',
      metrics: { order: 'PENDING', payment: 'reacting', stock: 'waiting', risk: 'flow is implicit' },
      metricTones: { risk: 'warn' },
      scene: {
        nodes: [
          { ...order, status: 'active', chips: [{ text: 'emits OrderPlaced', tone: 'good' }] },
          { ...kafka, at: at(-4.4, 0), status: 'active' },
          { ...payment, status: 'active', chips: ['on OrderPlaced', { text: 'emits PaymentCharged', tone: 'good' }] },
          { ...inventory, status: 'active', badge: 'on PaymentCharged' },
        ],
        links: [link('order', 'kafka', { style: 'dashed' }), link('kafka', 'payment', { style: 'dashed' }), link('kafka', 'inventory', { style: 'dashed' })],
        flows: [
          { path: ['order', 'kafka'], tone: 'event', label: 'OrderPlaced', duration: 1.2 },
          { path: ['kafka', 'payment'], tone: 'event', duration: 1.2, delay: 1.3 },
          { path: ['payment', 'kafka'], tone: 'event', label: 'PaymentCharged', duration: 1.2, delay: 2.6 },
          { path: ['kafka', 'inventory'], tone: 'event', duration: 1.2, delay: 3.9 },
          { path: ['inventory', 'kafka'], tone: 'error', label: 'StockFailed', duration: 1.2, delay: 5.2 },
          { path: ['kafka', 'payment'], tone: 'error', duration: 1.2, delay: 6.5 },
          { path: ['payment', 'kafka'], tone: 'event', label: 'PaymentRefunded', duration: 1.2, delay: 7.8 },
          { path: ['kafka', 'order'], tone: 'event', duration: 1.2, delay: 9.1 },
        ],
        panel: {
          title: 'Event, listener, reaction',
          icon: 'List',
          rows: [
            { text: 'OrderPlaced: payment', value: 'charge' },
            { text: 'PaymentCharged: inventory', value: 'reserve' },
            { text: 'StockFailed: payment', value: 'refund', tone: 'warn' },
            { text: 'PaymentRefunded: order', value: 'cancel', tone: 'warn' },
          ],
          footer: { text: 'Undo is also event-driven', tone: 'muted' },
        },
        caption: 'Events pass the baton, and the undo',
      },
    },
    {
      title: 'Who drives',
      tag: 'tradeoff',
      heading: 'Orchestration or choreography',
      eli5: 'A boss with a checklist is easy to follow but is one more person to hire. Shops shouting to each other need no boss, but nobody can see the whole plan.',
      body: [
        'Choreography gets hard to see with five or more steps, and cycles are easy to create. Orchestration adds a component that must stay up and keep state, and it couples services to one coordinator.',
        'A reasonable default: choreography for two or three steps, orchestration once the flow has branches, timeouts or many compensations.',
      ],
      keyIdea: 'Pick by how complex the flow is: events for short flows, an orchestrator once the flow branches.',
      metrics: { order: 'PENDING', payment: '$80 charged', stock: 'reserving', risk: 'flow hard to see' },
      metricTones: { order: 'warn', payment: 'good', stock: 'warn', risk: 'warn' },
      scene: {
        nodes: [
          { ...coord, label: 'orchestrator', sub: 'calls each service', at: at(-4.4, -4.4), status: 'ok' },
          { ...kafka, label: 'event queue', sub: 'services listen', at: at(4.4, -4.4), status: 'ok' },
          { ...payment, at: at(-2.2, 4.4), status: 'ok' },
          { ...inventory, at: at(2.2, 4.4), status: 'ok' },
        ],
        links: [
          link('coord', 'payment', { label: 'orchestrated' }),
          link('coord', 'inventory'),
          link('kafka', 'payment', { style: 'dashed', label: 'events' }),
          link('kafka', 'inventory', { style: 'dashed' }),
        ],
        panel: {
          title: 'Compared',
          icon: 'Scale',
          rows: [
            { text: 'Flow readable in one place', value: 'orchestration', tone: 'good' },
            { text: 'Loose coupling', value: 'choreography', tone: 'good' },
            { text: 'Single point to keep alive', value: 'orchestration', tone: 'warn' },
            { text: 'Cycles and hidden flow', value: 'choreography', tone: 'warn' },
          ],
        },
        caption: 'Neither is free',
      },
    },
    {
      title: 'Try-confirm-cancel',
      tag: 'concept',
      heading: 'TCC: reserve first, confirm or cancel later',
      eli5: 'The agent asks each shop to put your name on a hold ticket. Once every shop has a ticket, the agent calls each to confirm. If any shop has no ticket, the agent cancels all the tickets.',
      body: [
        '**Try-confirm-cancel** (TCC) gives a saga some isolation. **Try** reserves the resource without finishing it, such as holding $80 on the card. **Confirm** makes it final. **Cancel** releases the hold.',
        'Other readers see a reservation, not a finished charge. The price is that every service must expose three operations, and holds need an expiry so a lost confirm does not freeze money forever.',
      ],
      keyIdea: 'TCC replaces do and undo with reserve, confirm and cancel, so half-done work looks like a hold.',
      metrics: { order: 'trying', payment: '$80 held', stock: '1 held', risk: 'holds need expiry' },
      metricTones: { payment: 'warn', stock: 'warn', risk: 'warn' },
      scene: {
        nodes: [
          { ...coord, label: 'TCC driver', status: 'active', badge: 'all tried: confirm' },
          { ...payment, status: 'ok', chips: [{ text: 'try: hold $80', tone: 'good' }] },
          { ...inventory, status: 'ok', chips: [{ text: 'try: hold 1 pair', tone: 'good' }] },
        ],
        links: [link('coord', 'payment', { arrow: 'both' }), link('coord', 'inventory', { arrow: 'both' })],
        flows: [
          { path: ['coord', 'payment'], tone: 'request', label: 'try', duration: 1.1 },
          { path: ['coord', 'inventory'], tone: 'request', label: 'try', duration: 1.1 },
          { path: ['coord', 'payment'], tone: 'response', label: 'confirm', duration: 1.1, delay: 1.6 },
          { path: ['coord', 'inventory'], tone: 'response', label: 'confirm', duration: 1.1, delay: 1.6 },
        ],
        panel: {
          title: 'Three operations per service',
          icon: 'List',
          rows: [
            { text: 'Try', value: 'reserve' },
            { text: 'Confirm', value: 'make final', tone: 'good' },
            { text: 'Cancel', value: 'release', tone: 'warn' },
            { text: 'Hold expiry', value: '15 min', tone: 'muted' },
          ],
        },
        caption: 'Reserve, then confirm or cancel',
      },
    },
    {
      title: 'Stuck sagas',
      tag: 'case',
      heading: 'Case: a saga that never finishes',
      eli5: 'The agent booked the hotel, then went home sick. Without a plan, the hotel holds your room forever. Someone must notice the checklist is stale and finish the job.',
      body: [
        'A service stays down or an orchestrator restarts mid-flow, and order 9001 sits at `PENDING` with the card charged.',
        'Give every step a **timeout** and backoff retries, and persist saga state. Park exhausted sagas in a **dead-letter** list with an alert. Log each step with the order id.',
        'Compensations are retried until they succeed and reach dead letters only after alerting. A **reconciliation job** compares orders, payments and stock as the last safety net.',
      ],
      keyIdea: 'Every saga needs timeouts, retries, saved state, a dead-letter path and a trace id.',
      metrics: { order: 'PENDING 2 days', payment: '$80 charged', stock: 'unknown', risk: 'stuck, needs a human' },
      metricTones: { order: 'bad', payment: 'warn', stock: 'bad', risk: 'bad' },
      scene: {
        nodes: [
          { ...coord, label: 'orchestrator', sub: 'saga log', status: 'hot', badge: 'restarted: resume' },
          { ...inventory, status: 'down', badge: 'down 20 min' },
          { id: 'dlq', kind: 'queue', at: at(0, 0), label: 'dead letters', sub: 'needs a human', status: 'hot', badge: '3 stuck' },
        ],
        links: [link('coord', 'inventory', { label: 'retry with backoff', labelTone: 'warn' }), link('coord', 'dlq', { style: 'dashed' })],
        flows: [
          { path: ['coord', 'inventory'], tone: 'error', label: 'retry 5 of 5', duration: 1.4 },
          { path: ['coord', 'dlq'], tone: 'event', label: 'park + alert', duration: 1.4, delay: 1.6 },
        ],
        panel: {
          title: 'Saga safety net',
          icon: 'Shield',
          rows: [
            { text: 'Step timeout', value: '5 s', tone: 'good' },
            { text: 'Retries', value: '5, exponential backoff' },
            { text: 'State saved', value: 'every step', tone: 'good' },
            { text: 'Trace id', value: 'order-9001', tone: 'muted' },
            { text: 'Reconciliation job', value: 'nightly, compares orders vs charges', tone: 'good' },
          ],
        },
        caption: 'Make the stuck ones visible',
      },
      quiz: {
        question: 'An orchestrator restarts in the middle of a saga. What lets it carry on correctly?',
        options: [
          'It restarts the saga from step 1 and hopes steps are idempotent',
          'It reads its persisted saga log and resumes from the last recorded step',
          'It asks the shopper to check out again',
          'It rolls back everything with a 2PC abort',
        ],
        answer: 1,
        explain: 'The orchestrator saves progress after each step. On restart it reads that log and continues, or runs the compensations if the saga had already failed.',
      },
    },
    {
      title: 'Dual write',
      tag: 'case',
      heading: 'Case: the order is saved but the event never leaves',
      eli5: 'The agent writes your booking in the notebook, and is about to post a letter to the train company when the lights go out. The notebook says booked. The train company never hears about it.',
      body: [
        'Choreography and many orchestrators depend on events. The obvious code commits the order, then publishes `OrderPlaced` to Kafka. That is a **dual write**: two systems, two separate writes, and no transaction around both.',
        'A crash between the commit and the publish loses the event, and order 9001 stays `PENDING` forever. Swap the order and you get the opposite: the event goes out, the commit fails, and payment charges for an order that does not exist.',
      ],
      keyIdea: 'Writing to a database and a broker as two separate steps will, sooner or later, do one without the other.',
      metrics: { order: 'PENDING forever', payment: 'never asked', stock: 'never asked', risk: 'lost event' },
      metricTones: { order: 'bad', payment: 'warn', stock: 'warn', risk: 'bad' },
      scene: {
        nodes: [
          { ...order, status: 'down', badge: 'crashed after commit' },
          { ...orderDb, status: 'ok', badge: 'order 9001' },
          { ...kafka, status: 'dim', badge: 'no event' },
        ],
        links: [link('order', 'orderDb'), link('order', 'kafka', { style: 'faint', label: 'never sent', labelTone: 'warn' })],
        flows: [
          { path: ['order', 'orderDb'], tone: 'request', label: 'COMMIT', duration: 1.2 },
          { path: ['order', 'kafka'], tone: 'error', label: 'publish (lost)', duration: 1.4, delay: 1.4 },
        ],
        panel: {
          title: 'The two writes',
          icon: 'Code',
          code: 'db.commit(order)       # done\n# --- crash here ---\nkafka.send(OrderPlaced)  # never runs',
          footer: { text: 'Two systems, no shared transaction', tone: 'bad' },
        },
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
        'A separate **relay** then publishes outbox rows to Kafka and marks them sent.',
      ],
      keyIdea: 'Commit the state change and its event in one local transaction, and let a relay publish the event afterwards.',
      metrics: { order: 'PENDING', payment: 'event on the way', stock: 'event on the way', risk: 'event cannot be lost' },
      metricTones: { order: 'warn', risk: 'good' },
      scene: {
        nodes: [
          { ...order, status: 'active' },
          { ...orderDb, status: 'ok', badge: 'order + outbox row' },
          { ...relay, sub: 'polls every 200 ms', status: 'active' },
          { ...kafka, status: 'active', badge: 'OrderPlaced' },
        ],
        links: [link('order', 'orderDb'), link('relay', 'orderDb', { style: 'dashed' }), link('relay', 'kafka')],
        flows: [
          { path: ['order', 'orderDb'], tone: 'request', label: 'one COMMIT', duration: 1.2 },
          { path: ['orderDb', 'relay'], tone: 'data', label: 'new row', duration: 1, delay: 1.4 },
          { path: ['relay', 'kafka'], tone: 'event', label: 'publish', duration: 1, delay: 2.6 },
        ],
        panel: {
          title: 'One transaction, two rows',
          icon: 'Database',
          rows: [
            { text: 'orders: 9001', value: 'PENDING', tone: 'good' },
            { text: 'outbox: order-placed', value: 'unsent', tone: 'good' },
          ],
          footer: { text: 'Both rows, or neither', tone: 'good' },
        },
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
      title: 'Relay options',
      tag: 'tradeoff',
      heading: 'Polling or change data capture',
      eli5: 'The helper can flip through the notebook every few minutes, or watch the page and post a letter the moment a new note appears. Watching is faster but needs a sharper helper.',
      body: [
        '**Polling** runs a query every few hundred milliseconds. It is easy to build and adds a little load and delay. **Change data capture** (CDC), for example Debezium reading the write-ahead log, picks up rows as they commit with low delay and no polling query.',
        'CDC needs log access and more setup. Either way the relay can crash after publishing and before marking a row sent, so it publishes that row again on restart. The outbox gives **at-least-once** delivery.',
      ],
      keyIdea: 'Polling is simple, CDC is faster. Both deliver at least once, never exactly once.',
      metrics: { order: 'PENDING', payment: 'event on the way', stock: 'event on the way', risk: 'duplicates possible' },
      metricTones: { risk: 'warn' },
      scene: {
        nodes: [
          { ...orderDb, status: 'ok', chips: ['write-ahead log'] },
          { ...relay, label: 'relay', sub: 'polling or CDC', status: 'active', badge: 'sent? crashed: resend' },
          { ...kafka, status: 'active' },
        ],
        links: [link('relay', 'orderDb', { style: 'dashed' }), link('relay', 'kafka')],
        flows: [
          { path: ['orderDb', 'relay'], tone: 'data', label: 'new row', duration: 1.1 },
          { path: ['relay', 'kafka'], tone: 'event', label: 'publish', duration: 1.1, delay: 1.3 },
        ],
        panel: {
          title: 'Two ways to find new rows',
          icon: 'Gauge',
          rows: [
            { text: 'Polling', value: '~200 ms delay, easy' },
            { text: 'CDC (Debezium)', value: '~10 ms delay, more setup' },
            { text: 'Delivery', value: 'at least once', tone: 'warn' },
          ],
        },
        caption: 'Same outbox, two ways to read it',
      },
    },
    {
      title: 'Idempotent',
      tag: 'concept',
      heading: 'Consumers must survive the same event twice',
      eli5: 'Sometimes the helper posts the same letter twice. The train company keeps a list of letters it has already handled, and throws away any copy it has seen before.',
      body: [
        'The outbox relay, Kafka redeliveries and saga retries all produce duplicates. If payment handles `OrderPlaced` for order 9001 twice and charges twice, the outbox made things worse.',
        'Make every consumer **idempotent**. Each event carries a unique id. The consumer records handled ids in a `processed_events` table, in the same local transaction as its own change. A duplicate hits the unique key, and the consumer skips it.',
      ],
      keyIdea: 'Outbox plus idempotent consumers turns at-least-once delivery into effects that happen effectively once.',
      metrics: { order: 'PENDING', payment: 'charged once', stock: '1 reserved', risk: 'duplicate dropped' },
      metricTones: { payment: 'good', stock: 'good', risk: 'good' },
      scene: {
        nodes: [
          { ...relay, at: at(-4.4, -4.4), sub: 'restarted: resend', status: 'hot' },
          { ...kafka, at: at(0, -4.4), sub: 'event 7f3a x2', status: 'active' },
          { ...payment, sub: 'seen 7f3a: skip', status: 'ok' },
          { ...inventory, sub: 'seen 7f3a: skip', status: 'ok' },
        ],
        links: [link('relay', 'kafka'), link('kafka', 'payment', { style: 'dashed' }), link('kafka', 'inventory', { style: 'dashed' })],
        flows: [
          { path: ['relay', 'kafka'], tone: 'event', label: '7f3a', duration: 1 },
          { path: ['relay', 'kafka'], tone: 'event', label: '7f3a again', duration: 1, delay: 1.2 },
          { path: ['kafka', 'payment'], tone: 'event', count: 2, duration: 1.2, delay: 2.3 },
          { path: ['kafka', 'inventory'], tone: 'event', count: 2, duration: 1.2, delay: 2.3 },
        ],
        panel: {
          title: 'processed_events',
          icon: 'Table',
          rows: [
            { text: '7f3a', value: 'handled, charge made', tone: 'good' },
            { text: '7f3a (copy)', value: 'unique key hit: skip', tone: 'warn' },
          ],
        },
        caption: 'Same event twice, one effect',
      },
      code: {
        language: 'sql',
        title: 'Record the event id and do the work in one transaction',
        source: `BEGIN;
INSERT INTO processed_events (event_id) VALUES ('7f3a')
ON CONFLICT DO NOTHING;
-- 0 rows inserted: a duplicate, so skip the work
-- 1 row inserted: do the work in this same transaction
INSERT INTO charges (order_id, amount) VALUES (9001, 80.00);
COMMIT;`,
        highlight: [2, 3, 6],
      },
    },
    {
      title: 'Idempotency key',
      tag: 'concept',
      heading: 'Calls to outside systems need an idempotency key',
      eli5: 'When the agent phones the hotel twice, it says the same booking number both times. The hotel sees the number again and says "already done".',
      body: [
        'For calls to systems you do not control, such as a card processor, send an **idempotency key** like `charge:9001` with the request. The provider stores the result under that key and returns it for any repeat, so a retry after a timeout cannot charge twice.',
        'This also answers the unknown-outcome problem from the start: after a timeout, retry with the same key and learn what happened.',
      ],
      keyIdea: 'A stable idempotency key makes a retry after a timeout safe, even across the network boundary.',
      metrics: { order: 'PENDING', payment: 'charged once', stock: 'not reserved', risk: 'retry is safe' },
      metricTones: { payment: 'good', risk: 'good' },
      scene: {
        nodes: [
          { ...order, status: 'active', chips: ['POST /charges', 'Idempotency-Key: charge:9001'] },
          { id: 'psp', kind: 'block', at: at(0, 4.4), label: 'card processor', sub: 'outside system', icon: 'Receipt', tint: 'green', status: 'ok', badge: 'same key: replay result' },
        ],
        links: [link('order', 'psp', { label: 'retry after timeout', labelTone: 'warn' })],
        flows: [
          { path: ['order', 'psp'], tone: 'request', label: 'charge:9001', duration: 1.2 },
          { path: ['order', 'psp'], tone: 'request', label: 'charge:9001 (retry)', duration: 1.2, delay: 1.5 },
          { path: ['psp', 'order'], tone: 'response', label: 'same result', duration: 1.2, delay: 3 },
        ],
        panel: {
          title: 'Processor key store',
          icon: 'Key',
          rows: [
            { text: 'charge:9001', value: '$80, succeeded', tone: 'good' },
            { text: 'retry of charge:9001', value: 'returns stored result', tone: 'good' },
          ],
        },
        caption: 'The key turns a retry into a lookup',
      },
    },
    {
      title: 'Choosing',
      tag: 'tradeoff',
      heading: 'Which tool, and when to avoid the problem',
      eli5: 'If one shop sells both the room and the ticket, you pay once at one counter and nothing can go half wrong. Only split the booking across shops when you have to.',
      body: [
        '**Avoid it first.** If two pieces of data must always change together, keep them in one service and one database. Many sagas exist only because a service boundary cuts through one business rule.',
        '**2PC** fits when all participants are databases you control, the transaction is short, and you can live with blocking. **Saga plus outbox plus idempotent consumers** is the usual answer across microservices: you give up isolation, and you get availability and a clear record of every step and undo.',
      ],
      keyIdea: 'Keep data that must change together in one database when you can. Across services, use a saga with an outbox and idempotent consumers.',
      metrics: { order: 'CONFIRMED', payment: '$80 charged once', stock: '1 reserved', risk: 'eventually consistent' },
      metricTones: { order: 'good', payment: 'good', stock: 'good', risk: 'warn' },
      scene: {
        nodes: [
          { id: 'one', kind: 'block', at: at(-4, -2), label: 'one database', sub: 'plain transaction', icon: 'Database', tint: 'green', status: 'ok' },
          { id: 'twopc', kind: 'block', at: at(0, 2), label: '2PC', sub: 'databases you control', icon: 'Scale', tint: 'violet', status: 'ok' },
          { id: 'sagabox', kind: 'block', at: at(4, -2), label: 'saga + outbox', sub: 'across services', icon: 'Workflow', tint: 'blue', status: 'ok' },
        ],
        panel: {
          title: 'Pick in this order',
          icon: 'List',
          rows: [
            { text: '1. Same service, same DB', value: 'avoid it', tone: 'good' },
            { text: '2. Databases you control', value: '2PC', tone: 'warn' },
            { text: '3. Across microservices', value: 'saga + outbox', tone: 'good' },
          ],
        },
        caption: 'The cheapest transaction is the one you avoid',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'One business action, many databases',
      eli5: 'The agent either gets a firm yes from everyone before booking, or books step by step and cancels if something fails. Every message is noted in the notebook first, and every shop ignores copies.',
      body: [
        'One checkout across services has no shared transaction. **2PC** makes participants prepare and vote, then a coordinator decides. It is atomic, holds locks, and blocks when the coordinator dies.',
        'A **saga** commits each step locally and runs **compensating actions** in reverse on failure, with no isolation in between. The **outbox** removes the dual-write gap, and **idempotent consumers** absorb the duplicates it creates.',
      ],
      keyIdea: 'Across services, consistency comes from local commits, planned undos, an outbox for events, and consumers that ignore repeats.',
      metrics: { order: 'CONFIRMED', payment: '$80 charged once', stock: '1 reserved', risk: 'eventually consistent' },
      metricTones: { order: 'good', payment: 'good', stock: 'good', risk: 'warn' },
      scene: {
        nodes: [
          { ...order, status: 'ok' },
          { ...orderDb, status: 'ok' },
          { ...relay, status: 'ok' },
          { ...kafka, status: 'ok' },
        ],
        links: [link('order', 'orderDb'), link('relay', 'orderDb', { style: 'dashed' }), link('relay', 'kafka')],
        flows: [
          { path: ['order', 'orderDb'], tone: 'request', label: 'commit + outbox', duration: 1.2 },
          { path: ['orderDb', 'relay', 'kafka'], tone: 'event', duration: 1.6, delay: 1.3 },
        ],
        caption: 'Local commit, event out, effects once',
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
