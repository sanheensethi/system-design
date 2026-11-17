import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const checkout: SceneNode = { id: 'checkout', kind: 'block', at: at(-3.8, -3.8), label: 'checkout', sub: 'publisher', icon: 'ShoppingBag', tint: 'green' };
const topic: SceneNode = { id: 'topic', kind: 'block', at: at(0, -3.8), label: 'order.placed', sub: 'topic', icon: 'Rss', tint: 'violet' };
const email: SceneNode = { id: 'email', kind: 'block', size: 0.72, at: at(0, 3.8), label: 'email', icon: 'Mail', tint: 'blue' };
const inventory: SceneNode = { id: 'inventory', kind: 'block', size: 0.72, at: at(0, 3.8), label: 'inventory', icon: 'Boxes', tint: 'amber' };
const loyalty: SceneNode = { id: 'loyalty', kind: 'block', size: 0.72, at: at(3.6, 3.8), label: 'loyalty', icon: 'Star', tint: 'violet' };
const analytics: SceneNode = { id: 'analytics', kind: 'block', size: 0.72, at: at(3.6, 3.8), label: 'analytics', icon: 'TrendingUp', tint: 'teal' };
const fraud: SceneNode = { id: 'fraud', kind: 'block', size: 0.72, at: at(-3.6, 3.8), label: 'fraud', icon: 'Shield', tint: 'red' };
const payments: SceneNode = { id: 'payments', kind: 'block', size: 0.72, at: at(0, 3.8), label: 'payments', icon: 'Receipt', tint: 'green' };

export const pubsubPart2: Lesson = {
  id: 'pubsub-part-2',
  title: 'Pub/sub and event-driven design (part 2)',
  tagline: 'Make event-driven systems correct and debuggable: duplicates, ordering, replay, schemas, choreography and fan-out at scale.',
  minutes: 18,
  level: 'Intermediate',
  learn: [
    'Duplicates, ordering keys and version checks in subscribers',
    'Retention, replay and dead-letter queues per subscription',
    'The dual-write problem and the outbox pattern',
    'Changing an event schema without breaking anyone',
    'Why choreographed flows are hard to debug, and when to orchestrate',
    'Fan-out on write versus on read for feeds, and how to pick a broker',
  ],
  metrics: [
    { key: 'dupes', label: 'Duplicates applied', icon: 'Copy' },
    { key: 'stale', label: 'Stale events applied', icon: 'Clock' },
    { key: 'lag', label: 'Worst lag', icon: 'Timer' },
    { key: 'trace', label: 'Time to find a break', icon: 'Search' },
  ],
  steps: [
    {
      title: 'Twice',
      tag: 'problem',
      heading: 'Durable subscriptions deliver at least once',
      eli5: 'Sometimes the same note drops into a mailbox twice, because the helper was not sure the first one arrived. If a class does the job twice, two lunches get cooked. So each note has a number, and the class checks it first.',
      body: [
        'Every durable subscription (SNS+SQS, Kafka, Google Pub/Sub) delivers at least once, so duplicates are a given. Fire-and-forget brokers deliver at most once. A subscriber processes an event, crashes before it acks, and the broker delivers it again.',
        'Give each event a unique `event_id` and make handlers idempotent, as in the queue lesson. The email service records ids it has handled, and skips the repeat.',
      ],
      keyIdea: 'Assume every event can arrive twice. Dedupe on `event_id`, or make the effect safe to repeat.',
      metrics: { dupes: '0', stale: '-', lag: '-', trace: '-' },
      metricTones: { dupes: 'good' },
      scene: {
        nodes: [
          { ...topic, status: 'active' },
          { ...email, status: 'active', chips: [{ text: 'evt_01JCQ4M8ZT', tone: 'warn' }] },
          { id: 'seen', kind: 'db', at: at(5, 5), label: 'processed ids', sub: 'event_id' },
        ],
        links: [link('topic', 'email'), link('email', 'seen', { arrow: 'both' })],
        flows: [
          { path: ['topic', 'email'], tone: 'event', label: 'evt_01 (1st)', duration: 1.2 },
          { path: ['email', 'seen'], tone: 'request', label: 'new id', duration: 1.2, delay: 1.3 },
          { path: ['topic', 'email'], tone: 'error', label: 'evt_01 (again)', duration: 1.2, delay: 3 },
          { path: ['email', 'seen'], tone: 'request', label: 'seen it', duration: 1.2, delay: 4.3 },
        ],
        panel: {
          title: 'Email service log',
          icon: 'List',
          rows: [
            { text: 'evt_01JCQ4M8ZT', value: 'receipt sent', tone: 'good' },
            { text: 'evt_01JCQ4M8ZT (again)', value: 'skipped', tone: 'good' },
          ],
          footer: { text: 'One receipt, however many deliveries', tone: 'good' },
        },
        caption: 'The second delivery is recognized and skipped',
      },
    },
    {
      title: 'Atomic dedupe',
      tag: 'concept',
      heading: 'The id check and the effect must commit together',
      eli5: 'If the helper cooks the lunch and then forgets to tick the list, the lunch gets cooked twice. If it ticks first and then drops the tray, nobody eats. Tick and cook must happen as one move.',
      body: [
        'A seen-ids table alone is not enough. Send the email, crash before recording the id, and the retry sends it again. Record first and crash before sending, and the effect is lost.',
        'Commit the id and the effect atomically: one DB transaction, or an idempotent downstream call keyed by `event_id`. Keep ids at least as long as the broker retention window.',
      ],
      keyIdea: 'Record the id and apply the effect atomically, and keep ids as long as events can be redelivered.',
      metrics: { dupes: '0', stale: '-', lag: '-', trace: '-' },
      metricTones: { dupes: 'good' },
      scene: {
        nodes: [
          { ...email, status: 'active', chips: [{ text: 'crash here', tone: 'bad' }] },
          { id: 'seen', kind: 'db', at: at(5, 5), label: 'processed ids', sub: 'TTL >= retention', status: 'ok' },
        ],
        links: [link('email', 'seen', { label: 'one transaction', labelTone: 'good', arrow: 'both' })],
        flows: [
          { path: ['email', 'seen'], tone: 'request', label: 'id + effect', duration: 1.4 },
          { path: ['seen', 'email'], tone: 'response', label: 'commit', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Two crash points',
          icon: 'AlertTriangle',
          rows: [
            { text: 'Effect, then crash', value: 'duplicate', tone: 'bad' },
            { text: 'Record, then crash', value: 'lost effect', tone: 'bad' },
            { text: 'Atomic commit', value: 'exactly one', tone: 'good' },
            { text: 'Seen-ids TTL', value: '>= retention', tone: 'warn' },
          ],
        },
        caption: 'The id and the effect succeed or fail together',
      },
    },
    {
      title: 'Wrong order',
      tag: 'case',
      heading: 'Fan-out adds a second problem: ordering',
      eli5: 'Two notes about the same lunch order reach a classroom: "cancel it" lands before "it was ordered". The class cancels something that does not exist yet, then orders it.',
      body: [
        'Order 8812 is placed and cancelled two seconds later. The two events are handled by different inventory consumers, and one of them retries.',
        'Inventory sees the cancel first and the placement second, and ends up holding stock for a dead order.',
      ],
      keyIdea: 'Parallel consumers and retries can reorder events about the same thing, so arrival order is not event order.',
      metrics: { dupes: '0', stale: '1', lag: '-', trace: '-' },
      metricTones: { stale: 'bad' },
      scene: {
        nodes: [
          { ...checkout, chips: ['placed, then cancelled'] },
          { ...topic, status: 'active' },
          { ...inventory, status: 'hot', badge: 'holds stock for a dead order' },
        ],
        links: [link('checkout', 'topic'), link('topic', 'inventory')],
        flows: [
          { path: ['checkout', 'topic'], tone: 'event', label: 'placed', duration: 1 },
          { path: ['checkout', 'topic'], tone: 'event', label: 'cancelled', duration: 1, delay: 0.6 },
          { path: ['topic', 'inventory'], tone: 'event', label: 'cancelled', duration: 1.2, delay: 1.8 },
          { path: ['topic', 'inventory'], tone: 'error', label: 'placed (late)', duration: 1.2, delay: 3.2 },
        ],
        panel: {
          title: 'What inventory saw',
          icon: 'Table',
          rows: [
            { text: '1st to arrive', value: 'cancelled', tone: 'warn' },
            { text: '2nd to arrive', value: 'placed', tone: 'bad' },
            { text: 'Final state', value: 'stock held', tone: 'bad' },
          ],
          footer: { text: 'The order was cancelled, the stock is still held', tone: 'bad' },
        },
        caption: 'The placement arrives after the cancel it should have preceded',
      },
    },
    {
      title: 'Ordering key',
      tag: 'concept',
      heading: 'Key events by entity so one order stays in sequence',
      eli5: 'All notes about lunch order 8812 go into the same mailbox slot, one after another. Notes about other orders can go anywhere, since they do not mix.',
      body: [
        'Publish with the entity as the **ordering key**: a Kafka partition key or an SQS FIFO message group of `order_id`. Events with one key go to one partition and are handled in sequence.',
        'Ordering holds only per key, so orders 8812 and 9001 may overtake each other. Limits: changing the partition count remaps keys, and a hot key serializes onto one partition. Publish in commit order, for example by ordering the outbox relay by id per entity.',
      ],
      keyIdea: 'Order is kept per key, not across the topic. Choose the entity whose events must stay in sequence.',
      metrics: { dupes: '0', stale: '0', lag: '-', trace: '-' },
      metricTones: { stale: 'good' },
      scene: {
        nodes: [
          { ...checkout, status: 'ok' },
          { ...topic, label: 'orders', sub: 'key = order_id', status: 'active' },
          { id: 'p0', kind: 'queue', at: at(-3.6, 2.4), label: 'partition 0', chips: ['8812 placed', '8812 cancelled'] },
          { id: 'p1', kind: 'queue', at: at(3.6, 2.4), label: 'partition 1', chips: ['9001 placed'] },
        ],
        links: [link('checkout', 'topic'), link('topic', 'p0', { label: 'hash(8812)' }), link('topic', 'p1', { label: 'hash(9001)' })],
        flows: [
          { path: ['checkout', 'topic'], tone: 'event', label: '8812 placed', duration: 1 },
          { path: ['checkout', 'topic'], tone: 'event', label: '8812 cancelled', duration: 1, delay: 0.7 },
          { path: ['topic', 'p0'], tone: 'event', count: 2, duration: 1.4, delay: 1.9 },
          { path: ['topic', 'p1'], tone: 'event', label: '9001', duration: 1.4, delay: 1.9 },
        ],
        panel: {
          title: 'Same key, same partition',
          icon: 'Hash',
          rows: [
            { text: 'Events for order 8812', value: 'in order', tone: 'good' },
            { text: 'Events for order 9001', value: 'in order', tone: 'good' },
            { text: '8812 against 9001', value: 'no guarantee', tone: 'muted' },
            { text: 'Hot key', value: 'one partition does all the work', tone: 'warn' },
          ],
        },
        caption: 'The key picks the partition, and a partition is read in sequence',
      },
    },
    {
      title: 'Versions',
      tag: 'concept',
      heading: 'A version lets each subscriber drop stale events itself',
      eli5: 'Each note also carries a number that goes up every time the order changes. The class keeps the highest number it has seen and throws away any older note that shows up late.',
      body: [
        'Put a **version** that grows with each change into the event. The subscriber ignores anything older than what it already applied. The version check protects you even when the transport does not keep order.',
        'It also absorbs duplicates for free: the same version applied twice changes nothing.',
      ],
      keyIdea: 'Carry a version so each subscriber can drop stale or repeated events by itself.',
      metrics: { dupes: '0', stale: '0', lag: '-', trace: '-' },
      metricTones: { dupes: 'good', stale: 'good' },
      scene: {
        nodes: [
          { ...topic, label: 'orders', sub: 'key = order_id' },
          { ...inventory, status: 'active', badge: 'has v2, drops v1' },
          { id: 'view', kind: 'db', at: at(5, 5), label: 'order_view', sub: 'status + version' },
        ],
        links: [link('topic', 'inventory'), link('inventory', 'view')],
        flows: [
          { path: ['topic', 'inventory'], tone: 'event', label: 'cancelled v2', duration: 1.2 },
          { path: ['inventory', 'view'], tone: 'data', label: 'apply v2', duration: 1.2, delay: 1.3 },
          { path: ['topic', 'inventory'], tone: 'error', label: 'placed v1 (late)', duration: 1.2, delay: 3 },
        ],
        panel: {
          title: 'Version check',
          icon: 'Code',
          rows: [
            { text: 'Stored version', value: '2' },
            { text: 'Arriving: placed v1', value: '1 < 2, drop', tone: 'good' },
            { text: 'Arriving: cancelled v2 again', value: '2 = 2, no-op', tone: 'good' },
          ],
          footer: { text: 'Ack the event and move on', tone: 'good' },
        },
        caption: 'The late v1 event is older than what inventory already applied',
      },
      code: {
        language: 'sql',
        title: 'Inventory keeps only the newest version of each order',
        source: `-- Runs for every delivery of an order event. Safe to run twice,
-- and safe to run out of order.
INSERT INTO order_view (order_id, status, version, updated_at)
VALUES (:order_id, :status, :version, now())
ON CONFLICT (order_id) DO UPDATE
   SET status     = EXCLUDED.status,
       version    = EXCLUDED.version,
       updated_at = now()
 WHERE order_view.version < EXCLUDED.version;   -- stale or duplicate: no-op

-- 0 rows changed means the event was old news. Ack it and move on.`,
        highlight: [5, 9],
      },
    },
    {
      title: 'Replay',
      tag: 'concept',
      heading: 'Retention lets a subscriber rewind',
      eli5: 'Some loudspeakers keep a notebook of every announcement. A brand new class can read the notebook from page one. A loudspeaker with no notebook only tells you what is said while you are in the room.',
      body: [
        'A log such as Kafka keeps events for a retention period, 7 days by default, and each subscriber tracks its own **offset**. Reset it to replay: a new subscriber starts from the beginning, and a bug fix reprocesses last week.',
        'SQS deletes a message once acked and holds unacked ones 4 days by default, 14 at most. Classic SNS keeps no history (SNS FIFO topics can archive and replay).',
        'Replay re-delivers old events, so handlers must be idempotent (event_id or version) and side-effecting consumers need a replay mode.',
      ],
      keyIdea: 'Replay needs retention. Without it, a subscriber that missed an event or had a bug cannot recover it.',
      metrics: { dupes: '0', stale: '0', lag: '6 days', trace: '-' },
      metricTones: { lag: 'warn' },
      scene: {
        nodes: [
          { id: 'log', kind: 'queue', at: at(0, -3.8), label: 'order log', sub: '7 days retained', status: 'active' },
          { ...loyalty, status: 'ok', chips: ['offset: live'] },
          { ...analytics, at: at(-3.6, 3.8), status: 'hot', chips: [{ text: 'offset reset to day 1', tone: 'warn' }] },
        ],
        links: [link('log', 'loyalty'), link('log', 'analytics')],
        flows: [
          { path: ['log', 'loyalty'], tone: 'event', label: 'newest', duration: 1.2 },
          { path: ['log', 'analytics'], tone: 'data', label: 'replay', count: 3, duration: 1.4 },
        ],
        panel: {
          title: 'How long events live',
          icon: 'Clock',
          rows: [
            { text: 'Kafka log', value: '7 days, rewindable', tone: 'good' },
            { text: 'SQS queue', value: '4 days, 14 max', tone: 'warn' },
            { text: 'Classic SNS topic', value: 'no history', tone: 'bad' },
            { text: 'Replay re-runs handlers', value: 'idempotent, replay mode', tone: 'warn' },
          ],
          footer: { text: 'Analytics rebuilds a bad report by replaying', tone: 'muted' },
        },
        caption: 'Analytics replays last week while loyalty stays at the live edge',
      },
    },
    {
      title: 'Poison events',
      tag: 'concept',
      heading: 'One bad event gets its own dead-letter queue',
      eli5: 'One note in the loyalty mailbox is smudged and nobody can read it. After five tries, the class puts it in a "to be looked at" tray and goes on with the others. Other classes never saw the problem.',
      body: [
        'A **poison event** is one that a handler can never process, such as a malformed payload. Retried forever, it blocks the partition or message group on ordered subscriptions, and wastes capacity and retries on unordered ones.',
        'Each subscription has its own **dead-letter queue**. After 5 failed receives, the event is moved aside. SQS and Google Pub/Sub have this built in, while Kafka needs an application-level dead-letter topic. Alert when the DLQ is not empty, then fix the bug and redrive the events.',
      ],
      keyIdea: 'Park poison events in a per-subscription dead-letter queue so they block no one, and alert on its depth.',
      metrics: { dupes: '0', stale: '0', lag: '0', trace: '-' },
      metricTones: { lag: 'good' },
      scene: {
        nodes: [
          { id: 'q-loyalty', kind: 'queue', at: at(0, -3.8), label: 'loyalty queue', status: 'active', chips: [{ text: 'order 7731: bad payload', tone: 'bad' }] },
          { ...loyalty, at: at(-3.6, 3.8), status: 'hot' },
          { id: 'dlq', kind: 'queue', at: at(3.6, 3.8), label: 'loyalty DLQ', status: 'hot', badge: '1 parked' },
        ],
        links: [link('q-loyalty', 'loyalty'), link('q-loyalty', 'dlq', { label: 'after 5 tries', labelTone: 'warn' })],
        flows: [
          { path: ['q-loyalty', 'loyalty'], tone: 'event', label: '7731', duration: 1.2 },
          { path: ['loyalty', 'q-loyalty'], tone: 'error', label: 'fails', duration: 1.2, delay: 1.3 },
          { path: ['q-loyalty', 'dlq'], tone: 'event', label: '7731 parked', duration: 1.4, delay: 3 },
        ],
        panel: {
          title: 'Redrive policy',
          icon: 'Code',
          code: '{\n  "deadLetterTargetArn": "loyalty-dlq",\n  "maxReceiveCount": 5\n}',
          footer: { text: 'Alert when DLQ depth > 0', tone: 'warn' },
        },
        caption: 'The bad event leaves the line, and everything behind it moves on',
      },
    },
    {
      title: 'Dual write',
      tag: 'problem',
      heading: 'Saving the order and publishing the event can disagree',
      eli5: 'The office writes the order in its notebook, then walks to the loudspeaker. If the office faints in between, the order is in the notebook and nobody ever heard it.',
      body: [
        'Checkout saves order 8812 to its database and then publishes `order.placed`. These are two systems and no transaction spans both.',
        'If checkout crashes between them, the order exists and the event never goes out. Reverse the order of the steps and you get the opposite bug: an event for an order that was never saved.',
      ],
      keyIdea: 'A database write and a publish to a broker cannot be made atomic by ordering them carefully.',
      metrics: { dupes: '0', stale: '0', lag: '-', trace: '-' },
      scene: {
        nodes: [
          { ...checkout, status: 'hot', badge: 'crashed here' },
          { id: 'orders-db', kind: 'db', at: at(-3.6, 3.8), label: 'orders', sub: 'saved 8812', status: 'ok' },
          { ...topic, status: 'dim' },
        ],
        links: [link('checkout', 'orders-db'), link('checkout', 'topic', { style: 'dashed', label: 'two systems, one crash', labelTone: 'warn' })],
        flows: [
          { path: ['checkout', 'orders-db'], tone: 'request', label: 'INSERT 8812', duration: 1.2 },
          { path: ['checkout', 'topic'], tone: 'error', label: 'never sent', duration: 1.2, delay: 1.5 },
        ],
        panel: {
          title: 'After the crash',
          icon: 'Table',
          rows: [
            { text: 'Orders table', value: 'has 8812', tone: 'good' },
            { text: 'order.placed for 8812', value: 'never published', tone: 'bad' },
            { text: 'Loyalty, inventory', value: 'never hear', tone: 'bad' },
          ],
          footer: { text: 'Saved but silent', tone: 'bad' },
        },
        caption: 'The order exists and nobody was told',
      },
    },
    {
      title: 'Outbox',
      tag: 'concept',
      heading: 'Write the event to the database in the same transaction',
      eli5: 'The office writes the order and a "tell the loudspeaker" slip in the same notebook page, at once. A helper then reads the slips and does the announcing, and checks them off.',
      body: [
        'The **outbox pattern**: in one local transaction, insert the order and a row in an `outbox` table. A separate relay reads unsent rows, publishes them, and marks them sent. Change-data-capture tools can do the relay by reading the database log.',
        'The relay may publish a row twice if it crashes after publishing and before marking. That is fine, because subscribers already dedupe on `event_id`.',
      ],
      keyIdea: 'Commit the event with the data it describes, then publish it from the outbox. You get at-least-once, never silence.',
      metrics: { dupes: '0', stale: '0', lag: '< 1 s', trace: '-' },
      metricTones: { lag: 'good' },
      scene: {
        nodes: [
          { ...checkout, status: 'ok' },
          { id: 'orders-db', kind: 'db', at: at(-3.6, 3.8), label: 'orders + outbox', sub: 'one transaction', status: 'ok' },
          { id: 'relay', kind: 'block', size: 0.72, at: at(0, 3.8), label: 'relay', icon: 'Workflow', tint: 'amber', status: 'active' },
          { ...topic, at: at(3.6, -3.8), status: 'active' },
        ],
        links: [link('checkout', 'orders-db', { label: 'BEGIN ... COMMIT' }), link('relay', 'orders-db', { label: 'poll' }), link('relay', 'topic', { label: 'publish' })],
        flows: [
          { path: ['checkout', 'orders-db'], tone: 'request', label: 'order + outbox row', duration: 1.4 },
          { path: ['relay', 'orders-db'], tone: 'request', label: 'unsent?', duration: 1.2, delay: 1.6 },
          { path: ['relay', 'topic'], tone: 'event', label: 'order.placed', duration: 1.4, delay: 3 },
        ],
        caption: 'The event is saved with the order, and published afterwards',
      },
      code: {
        language: 'sql',
        title: 'Order and event in one transaction',
        source: `BEGIN;
INSERT INTO orders (id, customer_id, total)
VALUES (8812, 4410, 59.90);

INSERT INTO outbox (event_id, type, payload, sent_at)
VALUES ('evt_01JCQ4M8ZT', 'order.placed',
        '{"order_id": 8812, "version": 1}', NULL);
COMMIT;

-- The relay: publish rows where sent_at IS NULL, then set sent_at.`,
        highlight: [2, 5, 9],
      },
      quiz: {
        question: 'Checkout saves an order and then publishes the event, and crashes between the two. How does the outbox pattern fix this?',
        options: [
          'It publishes the event first, so the order is always announced',
          'It writes the event row in the same database transaction as the order, and a relay publishes it afterwards',
          'It wraps the database and the broker in one distributed transaction',
          'It removes duplicates, so the event can be sent twice',
        ],
        answer: 1,
        explain: 'The order and its outbox row commit together or not at all. The relay publishes unsent rows later, at least once, and subscribers dedupe on event_id.',
      },
    },
    {
      title: 'Rename',
      tag: 'case',
      heading: 'A renamed field breaks two subscribers silently',
      eli5: 'The office renames a line on the news form from "price" to "price in cents". Nothing breaks in the office. The class that reads that line now sees nothing and writes down zero.',
      body: [
        'Checkout renames `total` to `total_cents` on a Tuesday. Nothing fails in checkout\'s tests. An hour later loyalty is awarding zero points and analytics reports revenue of $0.',
        'A published event is a public API. Old events with the old shape may also sit in backlogs or be replayed for days.',
      ],
      keyIdea: 'An event schema is a public API. A change that passes the publisher\'s tests can still break subscribers.',
      metrics: { dupes: '0', stale: '0', lag: '-', trace: '1 hour' },
      metricTones: { trace: 'bad' },
      scene: {
        nodes: [
          { ...checkout, status: 'active', badge: 'renamed total', chips: ['total_cents'] },
          { ...topic, status: 'active' },
          { ...loyalty, status: 'hot', badge: '0 points', at: at(-3.6, 3.8) },
          { ...analytics, status: 'hot', badge: 'revenue $0', at: at(3.6, 3.8) },
        ],
        links: [link('checkout', 'topic'), link('topic', 'loyalty'), link('topic', 'analytics')],
        flows: [
          { path: ['checkout', 'topic'], tone: 'event', label: 'total_cents', duration: 1 },
          { path: ['topic', 'loyalty'], tone: 'error', label: 'no "total"', duration: 1.2, delay: 1.1 },
          { path: ['topic', 'analytics'], tone: 'error', label: 'no "total"', duration: 1.2, delay: 1.1 },
        ],
        panel: {
          title: 'One hour after the deploy',
          icon: 'Table',
          rows: [
            { text: 'Checkout tests', value: 'pass', tone: 'good' },
            { text: 'Loyalty points', value: '0 awarded', tone: 'bad' },
            { text: 'Analytics revenue', value: '$0', tone: 'bad' },
          ],
          footer: { text: 'Nobody got an error', tone: 'bad' },
        },
        caption: 'The rename ships and two subscribers break silently',
      },
    },
    {
      title: 'Additive rules',
      tag: 'concept',
      heading: 'Add fields. Never remove or rename them',
      eli5: 'The office may add a new line to the news form, and classes that do not care skip it. It must never rename or remove a line, because some class is still reading that exact line.',
      body: [
        '**Add** fields, and make them optional. Never remove, rename or change the meaning or type of a field. Subscribers ignore fields they do not know.',
        'With those rules, old consumers can read new events and new consumers can read old ones. Both directions matter, because backlogs and replays mix old and new shapes.',
      ],
      keyIdea: 'Additive-only changes keep every old and new publisher and subscriber compatible.',
      metrics: { dupes: '0', stale: '0', lag: '-', trace: '-' },
      scene: {
        nodes: [
          { ...checkout, status: 'ok', chips: [{ text: '+ total_cents', tone: 'good' }, 'total'] },
          { ...topic, status: 'active' },
          { ...loyalty, status: 'ok', at: at(-3.6, 3.8), chips: ['reads total'] },
          { ...fraud, at: at(3.6, 3.8), status: 'ok', chips: ['reads total_cents'] },
        ],
        links: [link('checkout', 'topic'), link('topic', 'loyalty'), link('topic', 'fraud')],
        flows: [
          { path: ['checkout', 'topic'], tone: 'event', label: 'total + total_cents', duration: 1 },
          { path: ['topic', 'loyalty'], tone: 'event', duration: 1.2, delay: 1.1 },
          { path: ['topic', 'fraud'], tone: 'event', duration: 1.2, delay: 1.1 },
        ],
        panel: {
          title: 'Safe and unsafe changes',
          icon: 'List',
          rows: [
            { text: 'Add an optional field', value: 'safe', tone: 'good' },
            { text: 'Remove a field', value: 'breaks readers', tone: 'bad' },
            { text: 'Rename a field', value: 'breaks readers', tone: 'bad' },
            { text: 'Change type or meaning', value: 'breaks readers', tone: 'bad' },
          ],
        },
        caption: 'The old field stays. The new one sits beside it.',
      },
    },
    {
      title: 'Registry',
      tag: 'concept',
      heading: 'A schema registry fails the build before the break ships',
      eli5: 'A strict librarian keeps the official copy of the news form. Before the office may print a new version, she checks that no old line was removed. If one was, the office cannot print it.',
      body: [
        'A **schema registry** stores each event schema and checks compatibility. The publisher\'s build fails if the new schema is incompatible with the registered one.',
        'The rename from the last case is caught on the developer\'s laptop, where it costs minutes instead of an incident.',
      ],
      keyIdea: 'Check schema compatibility automatically, so a breaking change is rejected before it is published.',
      metrics: { dupes: '0', stale: '0', lag: '-', trace: '0' },
      metricTones: { trace: 'good' },
      scene: {
        nodes: [
          { ...checkout, status: 'active', badge: 'renamed total' },
          { id: 'registry', kind: 'block', at: at(3.6, -3.8), label: 'schema registry', sub: 'compatibility check', icon: 'FileJson', tint: 'teal', status: 'ok' },
          { ...topic, status: 'dim', at: at(0, 3.8) },
        ],
        links: [link('checkout', 'registry', { label: 'register schema' }), link('checkout', 'topic', { style: 'dashed' })],
        flows: [
          { path: ['checkout', 'registry'], tone: 'request', label: 'register schema', duration: 1.4 },
          { path: ['registry', 'checkout'], tone: 'error', label: 'incompatible', duration: 1.4, delay: 1.5 },
        ],
        caption: 'The build fails and nothing is published',
      },
      code: {
        language: 'json',
        title: 'An event envelope that can evolve',
        source: `{
  "event_id": "evt_01JCQ4M8ZT",
  "type": "order.placed",
  "schema_version": 3,
  "occurred_at": "2026-11-27T09:14:02Z",
  "correlation_id": "req_7f3a91",
  "data": {
    "order_id": 8812,
    "version": 1,
    "customer_id": 4410,
    "total": 59.90,
    "currency": "USD",
    "gift_wrap": true
  }
}`,
        highlight: [2, 4, 6, 9, 13],
      },
    },
    {
      title: 'New version',
      tag: 'concept',
      heading: 'For a breaking change, run two versions side by side',
      eli5: 'If the form truly must change a line, the office prints a new form, form number 2, and uses both for a while. Classes switch over one by one, and the old form is thrown away at the end.',
      body: [
        'When a breaking change is unavoidable, publish it as a new topic or type next to the old one: `order.placed.v2`. For a time, checkout publishes both.',
        'Move subscribers over one team at a time, check that nobody still reads v1, then retire it. The price is a period of double publishing.',
      ],
      keyIdea: 'Run the old and new versions in parallel, migrate subscribers, then retire the old one.',
      metrics: { dupes: '0', stale: '0', lag: '-', trace: '-' },
      scene: {
        nodes: [
          { ...checkout, at: at(-5.4, -3.8), status: 'ok', chips: ['publishes both'] },
          { ...topic, id: 'topic-v1', at: at(-1.8, -3.8), label: 'order.placed', sub: 'v1, to retire', status: 'dim' },
          { ...topic, id: 'topic-v2', at: at(1.8, -3.8), label: 'order.placed.v2', sub: 'v2', status: 'active' },
          { ...loyalty, at: at(-1.8, 3.8), status: 'active', chips: [{ text: 'still on v1', tone: 'warn' }] },
          { ...fraud, at: at(1.8, 3.8), status: 'ok', chips: ['moved to v2'] },
        ],
        links: [link('checkout', 'topic-v1'), link('checkout', 'topic-v2'), link('topic-v1', 'loyalty'), link('topic-v2', 'fraud')],
        flows: [
          { path: ['checkout', 'topic-v1'], tone: 'event', duration: 1.2 },
          { path: ['checkout', 'topic-v2'], tone: 'event', duration: 1.2 },
          { path: ['topic-v1', 'loyalty'], tone: 'event', duration: 1.2, delay: 1.3 },
          { path: ['topic-v2', 'fraud'], tone: 'event', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Migration',
          icon: 'List',
          rows: [
            { text: 'Fraud', value: 'on v2', tone: 'good' },
            { text: 'Loyalty', value: 'on v1', tone: 'warn' },
            { text: 'Retire v1 when', value: 'all moved' },
          ],
        },
        caption: 'Two topics for a while, then one',
      },
    },
    {
      title: 'Choreography',
      tag: 'concept',
      heading: 'Without a coordinator, services react to each other',
      eli5: 'Nobody holds the checklist. When the news arrives, one class does its part and shouts the next piece of news. The next class hears it and does its part. The job gets done as a chain of shouts.',
      body: [
        'Flows can become a chain of reactions: `order.placed` leads fraud to publish `order.cleared`, which leads payments to publish `payment.captured`, which is what loyalty listens for.',
        'This style, with no coordinator, is called **choreography**. Each service only knows its own input and output events.',
      ],
      keyIdea: 'In choreography each service reacts to events and emits its own, and no service owns the whole process.',
      metrics: { dupes: '0', stale: '0', lag: '-', trace: '-' },
      scene: {
        nodes: [
          { ...topic, label: 'event bus', sub: '4 topics' },
          { ...fraud, status: 'active', chips: ['order.cleared'] },
          { ...payments, status: 'active', chips: ['payment.captured'] },
          { ...loyalty, status: 'active', chips: ['awards points'] },
        ],
        links: [link('topic', 'fraud'), link('topic', 'payments'), link('topic', 'loyalty')],
        flows: [
          { path: ['topic', 'fraud'], tone: 'event', label: 'order.placed', duration: 1.2 },
          { path: ['fraud', 'topic'], tone: 'event', label: 'order.cleared', duration: 1.2, delay: 1.4 },
          { path: ['topic', 'payments'], tone: 'event', duration: 1.2, delay: 2.8 },
          { path: ['payments', 'topic'], tone: 'event', label: 'payment.captured', duration: 1.2, delay: 4.2 },
          { path: ['topic', 'loyalty'], tone: 'event', duration: 1.2, delay: 5.6 },
        ],
        panel: {
          title: 'The chain',
          icon: 'Route',
          rows: [
            { text: 'order.placed', value: 'fraud listens' },
            { text: 'order.cleared', value: 'payments listens' },
            { text: 'payment.captured', value: 'loyalty listens' },
          ],
          footer: { text: 'No file shows the whole flow', tone: 'warn' },
        },
        caption: 'Each event triggers the next service in the chain',
      },
    },
    {
      title: 'Missing points',
      tag: 'case',
      heading: 'Case: the points that never arrived',
      eli5: 'A child never got her sticker. The office told the loudspeaker, one class told another, and somewhere the chain stopped. Nobody wrote down the whole chain, so the teacher must ask room by room.',
      body: [
        'A customer complains that order 8812 earned no loyalty points. In the old design you would read checkout\'s code and its logs. Now the process is spread over four services owned by four teams, and each only shows that it handled its own event correctly.',
        'Finding the break took an engineer most of a day: fraud had held the order for review and published nothing.',
      ],
      keyIdea: 'In a choreographed flow no component knows the whole process, and a silent break is hard to find.',
      metrics: { dupes: '0', stale: '0', lag: '-', trace: '1 day' },
      metricTones: { trace: 'bad' },
      scene: {
        nodes: [
          { ...topic, label: 'event bus', sub: '4 topics' },
          { ...fraud, status: 'hot', badge: 'held for review' },
          { ...payments, status: 'dim', badge: 'heard nothing' },
          { ...loyalty, status: 'dim', badge: 'heard nothing' },
        ],
        links: [link('topic', 'fraud'), link('topic', 'payments', { style: 'dashed' }), link('topic', 'loyalty', { style: 'dashed' })],
        flows: [
          { path: ['topic', 'fraud'], tone: 'event', label: 'order.placed', duration: 1.2 },
          { path: ['fraud', 'topic'], tone: 'error', label: 'no order.cleared', duration: 1.2, delay: 1.5 },
        ],
        panel: {
          title: 'Hunting one order',
          icon: 'Search',
          rows: [
            { text: 'Teams to ask', value: '4', tone: 'warn' },
            { text: 'Each team\'s logs', value: 'look fine', tone: 'warn' },
            { text: 'Time to find the break', value: 'most of a day', tone: 'bad' },
          ],
          footer: { text: 'Fraud held the order and said nothing', tone: 'bad' },
        },
        caption: 'The chain went quiet at fraud, and nothing said so',
      },
    },
    {
      title: 'Visibility',
      tag: 'concept',
      heading: 'Build the visibility yourself',
      eli5: 'Give every note a ticket number, and copy that number onto every follow-up note. Now the teacher can ask "show me everything with ticket 7f3a" and see the whole chain on one page.',
      body: [
        'Stamp a **correlation id** on the first event and copy it into every event it causes, so a tracing tool can draw the chain. Keep an event catalog that lists who publishes and who subscribes.',
        'Alert on things that did not happen, such as an order with no payment event after 10 minutes. The day-long hunt becomes a minute.',
      ],
      keyIdea: 'Correlation ids, a catalog and alerts on missing events give a choreographed flow the visibility it lacks.',
      metrics: { dupes: '0', stale: '0', lag: '-', trace: '1 minute' },
      metricTones: { trace: 'good' },
      scene: {
        nodes: [
          { ...topic, label: 'event bus', sub: '4 topics' },
          { ...fraud, status: 'hot', badge: 'held for review' },
          { id: 'tracer', kind: 'block', at: at(3.6, 3.8), label: 'tracing', sub: 'by correlation_id', icon: 'Search', tint: 'teal', status: 'active', badge: 'chain stops at fraud' },
        ],
        links: [link('topic', 'fraud'), link('fraud', 'tracer', { style: 'faint' }), link('topic', 'tracer', { style: 'faint' })],
        flows: [
          { path: ['topic', 'fraud'], tone: 'event', label: 'req_7f3a91', duration: 1.2 },
          { path: ['fraud', 'tracer'], tone: 'data', label: 'span req_7f3a91', duration: 1.4, delay: 1.4 },
          { path: ['topic', 'tracer'], tone: 'data', label: 'span req_7f3a91', duration: 1.4, delay: 1.4 },
        ],
        panel: {
          title: 'Three habits',
          icon: 'List',
          rows: [
            { text: 'Correlation id on every event', value: 'traces the chain', tone: 'good' },
            { text: 'Event catalog', value: 'who publishes, who listens', tone: 'good' },
            { text: 'Alert: no payment in 10 min', value: 'finds silence', tone: 'good' },
          ],
        },
        caption: 'The trace for one correlation id shows where the chain went quiet',
      },
    },
    {
      title: 'Orchestrate?',
      tag: 'tradeoff',
      heading: 'When one service should run the show',
      eli5: 'For a school trip, one teacher holds the checklist and tells each class what to do next. When the steps must happen in order, a checklist is better than a chain of shouts.',
      body: [
        '**Orchestration**: one service owns the process and tells the others what to do, step by step. An order workflow asks fraud for a verdict, then payments for a capture, then shipping. The steps, timeouts and failure handling live in one place you can read and query.',
        'It fits a process with a defined sequence and a business owner, where a stuck step needs a timeout and a compensating action. The cost is the coupling you started with: the orchestrator knows every participant.',
      ],
      keyIdea: 'Orchestrate the steps a business process depends on, and accept that the orchestrator knows its participants.',
      metrics: { dupes: '0', stale: '0', lag: '-', trace: '1 minute' },
      metricTones: { trace: 'good' },
      scene: {
        nodes: [
          { ...checkout, label: 'order workflow', sub: 'orchestrator', status: 'active', badge: 'step 2 of 3' },
          { ...fraud, status: 'ok', badge: 'cleared' },
          { ...payments, status: 'active', chips: ['capture'] },
        ],
        links: [link('checkout', 'fraud', { label: '1' }), link('checkout', 'payments', { label: '2' })],
        flows: [
          { path: ['checkout', 'fraud', 'checkout'], tone: 'request', label: 'check', duration: 2 },
          { path: ['checkout', 'payments', 'checkout'], tone: 'request', label: 'capture', duration: 2, delay: 2.1 },
        ],
        panel: {
          title: 'Why orchestrate',
          icon: 'Workflow',
          rows: [
            { text: 'Steps in a fixed order', value: 'one place', tone: 'good' },
            { text: 'Timeouts, compensation', value: 'one place', tone: 'good' },
            { text: 'Orchestrator knows', value: 'every participant', tone: 'warn' },
          ],
        },
        caption: 'Commands in sequence, with the state in one place',
      },
    },
    {
      title: 'Mix both',
      tag: 'tradeoff',
      heading: 'Orchestrate the core, publish the rest',
      eli5: 'The teacher runs the trip checklist. When the trip is over, the loudspeaker says "trip done", and anyone who cares can react: the newsletter, the photo club, the lost-property office.',
      body: [
        'Events fit the opposite case: independent reactions that the core flow does not depend on, such as analytics, search indexing, notifications and cache invalidation.',
        'Most real systems mix the two. An orchestrated order flow publishes `order.completed`, and anyone may subscribe.',
      ],
      keyIdea: 'Use commands for the steps a process needs, and an event for everyone else who wants to react.',
      metrics: { dupes: '0', stale: '0', lag: '-', trace: '1 minute' },
      metricTones: { trace: 'good' },
      scene: {
        nodes: [
          { ...checkout, label: 'order workflow', sub: 'orchestrator', status: 'ok', badge: 'done' },
          { ...topic, label: 'order.completed', status: 'active' },
          { ...email, at: at(-3.6, 3.8), status: 'active' },
          { ...analytics, at: at(0, 3.8), status: 'active' },
          { ...loyalty, at: at(3.6, 3.8), status: 'active' },
        ],
        links: [link('checkout', 'topic'), link('topic', 'email'), link('topic', 'analytics'), link('topic', 'loyalty')],
        flows: [
          { path: ['checkout', 'topic'], tone: 'event', label: 'order.completed', duration: 1.2 },
          { path: ['topic', 'email'], tone: 'event', duration: 1.2, delay: 1.3 },
          { path: ['topic', 'analytics'], tone: 'event', duration: 1.2, delay: 1.3 },
          { path: ['topic', 'loyalty'], tone: 'event', duration: 1.2, delay: 1.3 },
        ],
        caption: 'A command-driven core, with events for the optional reactions',
      },
    },
    {
      title: 'Feed on write',
      tag: 'case',
      heading: 'Fan-out on write: copy each post into every follower\'s feed',
      eli5: 'When a child draws a picture, the teacher puts a copy in the mailbox of every friend. Reading the mailbox later is instant, because the copies are already there.',
      body: [
        'Pub/sub fan-out also drives feeds. When a user posts, a worker copies the post id into the feed of each follower. With 200 followers, one post is 200 small writes.',
        'Reading a feed is then one lookup, since it was built ahead of time. Work moves from read time to write time.',
      ],
      keyIdea: 'Fan-out on write does the work at post time so that reads are one cheap lookup.',
      metrics: { dupes: '0', stale: '0', lag: '2 s', trace: '-' },
      metricTones: { lag: 'good' },
      scene: {
        nodes: [
          { id: 'author', kind: 'user', at: at(-3.8, -3.8), label: 'author', sub: '200 followers', status: 'active' },
          { id: 'fanout', kind: 'block', at: at(0, -3.8), label: 'feed fan-out', sub: 'worker', icon: 'Share2', tint: 'violet', status: 'active', chips: ['1 post'] },
          { id: 'feeds', kind: 'cache', at: at(0, 3.8), label: 'follower feeds', sub: '200 inboxes', status: 'ok', badge: '200 writes' },
        ],
        links: [link('author', 'fanout'), link('fanout', 'feeds', { label: 'copy to each follower' })],
        flows: [
          { path: ['author', 'fanout'], tone: 'event', label: 'post 42', duration: 1.2 },
          { path: ['fanout', 'feeds'], tone: 'data', label: 'x 200', count: 3, duration: 1.4, delay: 1.3 },
        ],
        panel: {
          title: 'Cost split',
          icon: 'Table',
          rows: [
            { text: 'Write cost per post', value: '200 writes', tone: 'warn' },
            { text: 'Read cost per feed view', value: '1 lookup', tone: 'good' },
          ],
          footer: { text: 'Reads are fast, writes are heavy', tone: 'muted' },
        },
        caption: 'One post becomes one small write per follower',
      },
    },
    {
      title: 'Celebrity problem',
      tag: 'tradeoff',
      heading: 'Mix fan-out on write with fan-out on read',
      eli5: 'A teacher with five million friends cannot copy her picture into five million mailboxes. Instead, friends look at her wall when they open their own mailbox, and the two piles are mixed.',
      body: [
        'A user with 5 million followers makes one post into 5 million writes, a spike that delays everyone behind it. So the hybrid: push posts for normal users, and for celebrities skip the copy.',
        'When a follower opens the feed, the reader merges their prepared feed with the latest posts from the few celebrities they follow. This is fan-out on read.',
      ],
      keyIdea: 'Push for ordinary accounts, pull for huge ones, and merge at read time.',
      metrics: { dupes: '0', stale: '0', lag: '2 s', trace: '-' },
      metricTones: { lag: 'warn' },
      scene: {
        nodes: [
          { id: 'star', kind: 'user', at: at(-3.8, -3.8), label: 'celebrity', sub: '5 M followers', status: 'hot', badge: '5 M writes?' },
          { id: 'celeb-posts', kind: 'storage', at: at(0, -3.8), label: 'celebrity posts', sub: 'read on demand', status: 'active' },
          { id: 'feeds', kind: 'cache', at: at(-3.6, 3.8), label: 'prepared feeds', sub: 'normal accounts', status: 'ok' },
          { id: 'reader', kind: 'phone', at: at(3.6, 3.8), label: 'follower', sub: 'opens feed', status: 'active' },
        ],
        links: [link('star', 'celeb-posts', { label: 'no fan-out' }), link('celeb-posts', 'reader', { label: 'pull and merge' }), link('feeds', 'reader')],
        flows: [
          { path: ['star', 'celeb-posts'], tone: 'event', label: 'post', duration: 1.2 },
          { path: ['feeds', 'reader'], tone: 'data', label: 'prepared', duration: 1.4, delay: 1.4 },
          { path: ['celeb-posts', 'reader'], tone: 'data', label: 'latest', duration: 1.4, delay: 1.4 },
        ],
        panel: {
          title: 'Hybrid feed',
          icon: 'Split',
          rows: [
            { text: 'Normal accounts', value: 'push on write', tone: 'good' },
            { text: 'Celebrities', value: 'pull on read', tone: 'good' },
            { text: 'Reader', value: 'merges both', tone: 'muted' },
          ],
        },
        caption: 'The celebrity post is fetched when needed, not copied 5 million times',
      },
    },
    {
      title: 'Which broker',
      tag: 'tradeoff',
      heading: 'Pick the broker by what you must guarantee',
      eli5: 'Some loudspeakers keep a notebook, some only shout. Some are fast but forget. Choose by what the school cannot afford to lose.',
      body: [
        '**SNS plus SQS** gives managed fan-out with a private queue per service. **Kafka** keeps a replayable log with partition-key ordering and consumer groups. **Google Pub/Sub** offers push and pull, ordering keys, filters and dead-letter topics.',
        '**NATS core** and **Redis Pub/Sub** are fire and forget: a subscriber that is offline misses the message. Use them for ephemeral signals, never for orders.',
      ],
      keyIdea: 'Match the broker to your needs for retention, replay, ordering and loss. Only fire-and-forget brokers may drop events.',
      metrics: { dupes: '0', stale: '0', lag: '-', trace: '-' },
      scene: {
        nodes: [
          { ...topic, label: 'your topic', sub: 'which broker?', status: 'active' },
          { id: 'kafka', kind: 'queue', at: at(-3.6, 3.8), label: 'Kafka', sub: 'log, replay', status: 'ok' },
          { id: 'sns', kind: 'queue', at: at(0, 3.8), label: 'SNS + SQS', sub: 'managed queues', status: 'ok' },
          { id: 'redis', kind: 'queue', at: at(3.6, 3.8), label: 'Redis Pub/Sub', sub: 'fire and forget', status: 'dim', badge: 'can drop' },
        ],
        links: [link('topic', 'kafka'), link('topic', 'sns'), link('topic', 'redis', { style: 'dashed' })],
        flows: [
          { path: ['topic', 'kafka'], tone: 'event', duration: 1.4 },
          { path: ['topic', 'sns'], tone: 'event', duration: 1.4 },
          { path: ['topic', 'redis'], tone: 'error', label: 'lost if offline', duration: 1.4 },
        ],
        panel: {
          title: 'What each one gives you',
          icon: 'Table',
          rows: [
            { text: 'Kafka', value: 'replay, key order', tone: 'good' },
            { text: 'SNS + SQS', value: 'managed fan-out', tone: 'good' },
            { text: 'Google Pub/Sub', value: 'push, pull, filters', tone: 'good' },
            { text: 'NATS core, Redis', value: 'may drop', tone: 'bad' },
          ],
        },
        caption: 'Retention and delivery guarantees differ a lot between brokers',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Correct, observable and evolvable',
      eli5: 'Number every note so repeats and old ones are ignored. Keep the form additive. Give every chain a ticket number so the teacher can follow it, and use a checklist when the steps must go in order.',
      body: [
        'Expect duplicates and reordering, so key events by entity and version them. Keep events with the data they describe using an outbox, park poison events in a dead-letter queue, and keep retention for replay.',
        'Evolve schemas additively and check them in a registry. A choreographed chain has no owner, so add correlation ids and tracing, and orchestrate the flows that need one. Next topics: event sourcing and CQRS, which build on event logs.',
      ],
      keyIdea: 'Pub/sub trades visible coupling in code for a shared contract and a flow you must make observable on purpose.',
      metrics: { dupes: '0', stale: '0', lag: '< 1 s', trace: '1 minute' },
      metricTones: { dupes: 'good', stale: 'good', lag: 'good', trace: 'good' },
      scene: {
        nodes: [{ ...checkout, status: 'ok' }, { ...topic, status: 'ok' }, { ...inventory, at: at(-3.6, 3.8), status: 'ok' }, { ...loyalty, at: at(0, 3.8), status: 'ok' }, { ...fraud, at: at(3.6, 3.8), status: 'ok' }],
        links: [link('checkout', 'topic'), link('topic', 'inventory'), link('topic', 'loyalty'), link('topic', 'fraud')],
        flows: [
          { path: ['checkout', 'topic'], tone: 'event', count: 2, duration: 1.4 },
          { path: ['topic', 'inventory'], tone: 'event', duration: 1.2, delay: 1.5 },
          { path: ['topic', 'loyalty'], tone: 'event', duration: 1.2, delay: 1.5 },
          { path: ['topic', 'fraud'], tone: 'event', duration: 1.2, delay: 1.5 },
        ],
        panel: {
          title: 'Part 2 in four lines',
          icon: 'Layers',
          rows: [
            { text: 'Duplicates, order', value: 'event_id, key, version', tone: 'good' },
            { text: 'Never lose an event', value: 'outbox, DLQ, retention', tone: 'good' },
            { text: 'Schemas', value: 'additive, registry', tone: 'good' },
            { text: 'Flows', value: 'trace or orchestrate', tone: 'good' },
          ],
        },
      },
      quiz: {
        question: 'A subscriber applies `order.cancelled` (version 2) and then receives a delayed `order.placed` (version 1) for the same order. What should it do?',
        options: [
          'Apply it, because events must be processed in arrival order',
          'Send it to the dead-letter queue',
          'Compare versions, see that 1 is older than the stored 2, ack the event and change nothing',
          'Ask the publisher to resend both events',
        ],
        answer: 2,
        explain: 'Delivery order is not guaranteed across retries and consumers. A version carried in the event lets the subscriber recognize stale news and drop it safely.',
      },
    },
  ],
};
