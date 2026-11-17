import type { Lesson, SceneLink, SceneNode } from '../engine/types';

// Screen x follows d = x - y and screen y follows s = x + y, so lay nodes out as (column, row).
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const shoppers: SceneNode = { id: 'shoppers', kind: 'client', at: at(-6, -6), label: 'shoppers', sub: '2,000 orders/s' };
const checkout: SceneNode = { id: 'checkout', kind: 'service', at: at(-2.5, -6), label: 'checkout', sub: 'publisher' };
const topic: SceneNode = { id: 'topic', kind: 'queue', at: at(0, -1.5), label: 'order.placed', sub: 'topic' };

const email: SceneNode = { id: 'email', kind: 'service', at: at(-6, 4.5), label: 'email' };
const inventory: SceneNode = { id: 'inventory', kind: 'service', at: at(-3, 4.5), label: 'inventory' };
const loyalty: SceneNode = { id: 'loyalty', kind: 'service', at: at(0, 4.5), label: 'loyalty' };
const analytics: SceneNode = { id: 'analytics', kind: 'service', at: at(3, 4.5), label: 'analytics' };
const fraud: SceneNode = { id: 'fraud', kind: 'service', at: at(6, 4.5), label: 'fraud' };

// Fan-out step only: one queue per subscription, with its service underneath.
const qEmail: SceneNode = { id: 'q-email', kind: 'queue', at: at(-5, 3), label: 'email queue' };
const qInventory: SceneNode = { id: 'q-inventory', kind: 'queue', at: at(0, 3), label: 'inventory queue' };
const qLoyalty: SceneNode = { id: 'q-loyalty', kind: 'queue', at: at(5, 3), label: 'loyalty queue' };
const emailLow: SceneNode = { ...email, at: at(-5, 7.5) };
const inventoryLow: SceneNode = { ...inventory, at: at(0, 7.5) };
const loyaltyLow: SceneNode = { ...loyalty, at: at(5, 7.5) };

const orderApi: SceneNode = { id: 'order-api', kind: 'server', at: at(5, -6), label: 'order API', sub: 'GET /orders/:id' };
const tracer: SceneNode = { id: 'tracer', kind: 'monitor', at: at(5, -5), label: 'tracing', sub: 'by correlation_id' };
const registry: SceneNode = { id: 'registry', kind: 'storage', at: at(5, -5), label: 'schema registry', sub: 'compatibility check' };

const four = [email, inventory, loyalty, analytics];
const five = [...four, fraud];

const topicLinks = (subs: SceneNode[]): SceneLink[] => [
  { from: 'shoppers', to: 'checkout' },
  { from: 'checkout', to: 'topic' },
  ...subs.map((s) => ({ from: 'topic', to: s.id })),
];

export const pubsub: Lesson = {
  id: 'pubsub',
  title: 'Pub/sub and event-driven design',
  tagline: 'Publish one event and let any number of services react to it, then pay attention to what that freedom costs.',
  minutes: 14,
  level: 'Intermediate',
  learn: [
    'Topics, subscriptions and fan-out: one event, a copy for every subscriber',
    'How pub/sub removes the producer\'s knowledge of its consumers',
    'Thin notification events versus events that carry state',
    'Ordering, duplicates and version checks in subscribers',
    'Changing an event schema without breaking anyone',
    'Why choreographed flows are hard to debug, and when to orchestrate',
  ],
  metrics: [
    { key: 'sends', label: 'Sends per order' },
    { key: 'subs', label: 'Subscribers' },
    { key: 'latency', label: 'Checkout p99' },
    { key: 'callbacks', label: 'Order API reads' },
  ],
  steps: [
    {
      title: 'Tangled producer',
      tag: 'problem',
      heading: 'Checkout knows about every team that cares',
      eli5: 'The school office has news. A helper must walk to every classroom and say it again. Each time a new classroom opens, the helper gets a longer walk, and if she trips halfway, some rooms never hear.',
      body: [
        'The queue lesson moved the receipt email out of checkout. Since then, three more teams asked for the same thing. Checkout now sends a message to four queues after every order: email, inventory, loyalty points and analytics.',
        'Each send is fast, about 2 ms. The cost is somewhere else. Checkout holds a list of everyone who cares about an order, so every new consumer means a code change, a review and a deploy by the checkout team. The fraud team has been waiting three weeks for theirs.',
        'There is a correctness hole too. If checkout crashes after the second send, email and inventory know about order 8812 while loyalty and analytics never will.',
      ],
      keyIdea: 'A producer that sends to each consumer by name has to change every time a consumer is added, and can leave them disagreeing when it fails halfway.',
      metrics: { sends: '4', subs: '4', latency: '158 ms', callbacks: '-' },
      scene: {
        nodes: [
          shoppers,
          { ...checkout, sub: '4 queue clients', status: 'hot', badge: 'crashed after send 2' },
          { ...email, status: 'ok', badge: 'got 8812' },
          { ...inventory, status: 'ok', badge: 'got 8812' },
          { ...loyalty, status: 'dim', badge: 'never told' },
          { ...analytics, status: 'dim', badge: 'never told' },
          { ...fraud, status: 'dim', badge: 'waiting 3 weeks' },
        ],
        links: [
          { from: 'shoppers', to: 'checkout' },
          { from: 'checkout', to: 'email' },
          { from: 'checkout', to: 'inventory' },
          { from: 'checkout', to: 'loyalty', style: 'dashed' },
          { from: 'checkout', to: 'analytics', style: 'dashed' },
        ],
        flows: [
          { path: ['shoppers', 'checkout'], tone: 'request', label: 'order 8812', duration: 1 },
          { path: ['checkout', 'email'], tone: 'event', label: 'send 1', duration: 1.2, delay: 1.1 },
          { path: ['checkout', 'inventory'], tone: 'event', label: 'send 2', duration: 1.2, delay: 1.6 },
          { path: ['checkout', 'loyalty'], tone: 'error', label: 'send 3 lost', duration: 1.2, delay: 2.4 },
        ],
        caption: 'Four sends per order, and a crash between them splits the system',
      },
    },
    {
      title: 'Topics',
      tag: 'concept',
      heading: 'Publish once to a topic',
      eli5: 'Now the office speaks into one loudspeaker, the **topic**. The office says the news once and does not need to know which classrooms are listening.',
      body: [
        'In **publish/subscribe**, checkout stops addressing consumers. It publishes one **event**, a statement that something happened, to a named **topic**: `order.placed`. Publishing is a single write, so it either happened or it did not.',
        'Each interested service creates a **subscription** to the topic. The broker delivers a copy of every event to every subscription. Checkout holds one client for one topic and has no list of who is listening.',
        'Note the wording. A work queue message is a command: "send this receipt". An event is a fact in the past tense: "order 8812 was placed". The publisher states the fact, and each subscriber decides what to do about it.',
      ],
      keyIdea: 'A publisher announces a fact to a topic. Who reacts, and how, is the subscribers\' business.',
      metrics: { sends: '1', subs: '4', latency: '152 ms', callbacks: '-' },
      scene: {
        nodes: [shoppers, { ...checkout, status: 'ok', badge: '1 publish' }, { ...topic, status: 'active' }, ...four],
        links: topicLinks(four),
        flows: [
          { path: ['shoppers', 'checkout'], tone: 'request', label: 'order 8812', duration: 1 },
          { path: ['checkout', 'topic'], tone: 'event', label: 'order.placed', duration: 1, delay: 1.1 },
          { path: ['topic', 'email'], tone: 'event', duration: 1.2, delay: 2.2 },
          { path: ['topic', 'inventory'], tone: 'event', duration: 1.2, delay: 2.2 },
          { path: ['topic', 'loyalty'], tone: 'event', duration: 1.2, delay: 2.2 },
          { path: ['topic', 'analytics'], tone: 'event', duration: 1.2, delay: 2.2 },
        ],
        caption: 'One publish in, one copy out per subscription',
      },
    },
    {
      title: 'Fan-out',
      tag: 'concept',
      heading: 'Every subscription is its own queue',
      eli5: 'Each classroom has its own mailbox under the loudspeaker. A copy of the news drops into every mailbox, so a slow class can read later without making the other classes wait.',
      body: [
        'Delivering one event to many subscribers is called **fan-out**. The detail that makes it safe is that each subscription has its own backlog. With SNS you subscribe one SQS queue per service. With Kafka each service is a consumer group with its own offset. Either way, everything from the queue lesson (acks, retries, dead letters) applies per subscription.',
        'So subscribers cannot hurt each other. The loyalty service is down for a 20-minute deploy and its queue grows to 2.4 million events. Email and inventory keep running at zero lag, and loyalty catches up when it returns.',
        'Fan-out multiplies work. At 2,000 orders a second with 4 subscriptions, the broker delivers 8,000 messages a second. Every subscriber you add costs one more full copy of the stream.',
      ],
      keyIdea: 'Fan-out gives each subscriber a private copy and a private backlog, so one slow subscriber delays only itself.',
      metrics: { sends: '1', subs: '4', latency: '152 ms', callbacks: '-' },
      scene: {
        nodes: [
          shoppers,
          checkout,
          { ...topic, status: 'active' },
          qEmail,
          qInventory,
          { ...qLoyalty, status: 'hot', badge: 'depth 2.4 M' },
          { ...emailLow, status: 'ok' },
          { ...inventoryLow, status: 'ok' },
          { ...loyaltyLow, status: 'down' },
        ],
        links: [
          { from: 'shoppers', to: 'checkout' },
          { from: 'checkout', to: 'topic' },
          { from: 'topic', to: 'q-email' },
          { from: 'topic', to: 'q-inventory' },
          { from: 'topic', to: 'q-loyalty' },
          { from: 'q-email', to: 'email' },
          { from: 'q-inventory', to: 'inventory' },
          { from: 'q-loyalty', to: 'loyalty', style: 'dashed' },
        ],
        flows: [
          { path: ['checkout', 'topic'], tone: 'event', label: 'order.placed', duration: 1 },
          { path: ['topic', 'q-email', 'email'], tone: 'event', duration: 1.8, delay: 1.1 },
          { path: ['topic', 'q-inventory', 'inventory'], tone: 'event', duration: 1.8, delay: 1.1 },
          { path: ['topic', 'q-loyalty'], tone: 'event', label: 'waits', count: 3, duration: 1.2, delay: 1.1 },
        ],
        caption: 'Loyalty is down. Its queue fills while the others keep draining.',
      },
      code: {
        language: 'python',
        title: 'SNS topic fanning out to one SQS queue per service',
        source: `# Publisher (checkout): one call, no list of consumers.
sns.publish(
    TopicArn=ORDER_PLACED_TOPIC,
    Message=json.dumps(event),
    MessageAttributes={
        "event_type": {"DataType": "String", "StringValue": "order.placed"},
    },
)

# Subscriber (loyalty team), run once at setup. Checkout is not involved.
sns.subscribe(
    TopicArn=ORDER_PLACED_TOPIC,
    Protocol="sqs",
    Endpoint=LOYALTY_QUEUE_ARN,              # the team's own queue and DLQ
    Attributes={"RawMessageDelivery": "true"},
)`,
        highlight: [2, 3, 11, 13, 14],
      },
    },
    {
      title: 'Decoupling',
      tag: 'concept',
      heading: 'A new subscriber needs nothing from the publisher',
      eli5: 'A new classroom opens and hangs up its own mailbox. The office changes nothing. The catch: the office no longer knows who hears the news, or what they do with it.',
      body: [
        'The fraud team creates a subscription and starts scoring orders the same afternoon. Checkout has no code change, no deploy and no meeting. This is the main reason teams adopt events: producers and consumers can ship on separate schedules.',
        'The dependency is still there, moved from code into the **event contract**. Five services now depend on the shape and meaning of `order.placed`, and checkout cannot see them in its own codebase. A field that looks unused may be the one the fraud model needs.',
        'Events also give no answer back. Checkout cannot learn from a publish whether stock was reserved. If the caller needs a result before it can continue, use a request instead.',
      ],
      keyIdea: 'Pub/sub removes the publisher\'s knowledge of its consumers. The coupling that remains is the event contract, and it is harder to see.',
      metrics: { sends: '1', subs: '5', latency: '152 ms', callbacks: '-' },
      scene: {
        nodes: [shoppers, { ...checkout, badge: 'no change' }, { ...topic, status: 'active' }, ...four, { ...fraud, status: 'active', badge: 'new' }],
        links: topicLinks(five),
        flows: [
          { path: ['checkout', 'topic'], tone: 'event', label: 'order.placed', duration: 1 },
          { path: ['topic', 'fraud'], tone: 'event', label: 'copy 5', duration: 1.4, delay: 1.1 },
          { path: ['topic', 'email'], tone: 'event', duration: 1.4, delay: 1.1 },
          { path: ['topic', 'loyalty'], tone: 'event', duration: 1.4, delay: 1.1 },
        ],
        caption: 'Fraud subscribes by itself. Checkout is not redeployed.',
      },
    },
    {
      title: 'Thin or fat',
      tag: 'tradeoff',
      heading: 'Event notification or event-carried state',
      eli5: 'The loudspeaker can say "there is news, come to the office and ask", and every class lines up at the office door. Or it can read the whole news out loud, so nobody has to walk.',
      body: [
        'A thin **event notification** carries only identifiers: `{order_id: 8812}`. Subscribers that need details call the order API. The event is small and never stale, but five subscribers at 2,000 events a second put **10,000 reads a second** back on the publisher. The services are decoupled on paper and tied together at runtime: if the order API is down, every subscriber stalls.',
        '**Event-carried state transfer** puts the data in the event: items, totals, customer, address. Subscribers keep the parts they need in their own tables and never call back. They keep working while the order service is down.',
        'The fat event has its own costs. Messages are larger, every subscriber holds a copy that is slightly behind, and more fields in the contract means more ways to break someone. A sensible default: carry the state most subscribers need, and leave rarely used or sensitive fields behind the API.',
      ],
      keyIdea: 'Thin events keep the contract small and push load back to the publisher. Fat events remove the callback and widen the contract.',
      metrics: { sends: '1', subs: '5', latency: '152 ms', callbacks: '10,000/s' },
      scene: {
        nodes: [
          shoppers,
          checkout,
          { ...orderApi, status: 'hot', badge: '10,000 reads/s' },
          { ...topic, status: 'active', badge: '{order_id}' },
          ...five.map((s) => ({ ...s, status: 'active' as const })),
        ],
        links: [...topicLinks(five), ...five.map((s) => ({ from: s.id, to: 'order-api', style: 'faint' as const }))],
        flows: [
          { path: ['checkout', 'topic'], tone: 'event', label: 'order 8812', duration: 1 },
          { path: ['topic', 'email'], tone: 'event', duration: 1.2, delay: 1.1 },
          { path: ['topic', 'loyalty'], tone: 'event', duration: 1.2, delay: 1.1 },
          { path: ['topic', 'fraud'], tone: 'event', duration: 1.2, delay: 1.1 },
          { path: ['email', 'order-api'], tone: 'request', label: 'GET order', duration: 1.4, delay: 2.4 },
          { path: ['loyalty', 'order-api'], tone: 'request', duration: 1.4, delay: 2.4 },
          { path: ['fraud', 'order-api'], tone: 'request', duration: 1.4, delay: 2.4 },
        ],
        caption: 'Thin events: every subscriber calls back for the details',
      },
      quiz: {
        question: 'Subscribers receive `{order_id}` and each calls the order API for details. The order API goes down for ten minutes. What happens?',
        options: [
          'Nothing, because pub/sub decouples the services',
          'Events are lost, because the topic cannot deliver them',
          'Every subscriber that needs order details stalls and its backlog grows until the API returns',
          'Checkout fails, because it waits for subscribers',
        ],
        answer: 2,
        explain: 'The callback is a hidden runtime dependency. Events are still delivered, but handlers fail and retry until the API is back. Carrying the needed state in the event removes that dependency.',
      },
    },
    {
      title: 'Order, duplicates',
      tag: 'concept',
      heading: 'Events arrive twice, and in the wrong order',
      eli5: 'Two notes about the same lunch order reach a classroom: "cancel it" lands before "it was ordered". Each note has a number, so the class keeps the highest number and throws away older notes.',
      body: [
        'Every subscription is at-least-once, so duplicates are a given. Give each event a unique `event_id` and make handlers idempotent, as in the queue lesson. Fan-out adds a second problem: **ordering**.',
        'Order 8812 is placed and cancelled two seconds later. The two events are handled by different inventory consumers, and one of them retries. Inventory sees the cancel first and the placement second, and ends up holding stock for a dead order.',
        'Two tools fix this. Publish with the entity as the **ordering key** (a Kafka partition key or an SQS FIFO message group of `order_id`), so events about one order stay in sequence. And put a **version** that grows with each change into the event, so a subscriber can ignore anything older than what it already applied. The version check protects you even when the transport does not.',
      ],
      keyIdea: 'Order events per entity with a key, and carry a version so each subscriber can drop stale or repeated events by itself.',
      metrics: { sends: '1', subs: '5', latency: '152 ms', callbacks: '0' },
      scene: {
        nodes: [
          shoppers,
          checkout,
          { ...topic, label: 'orders', sub: 'key = order_id', status: 'active' },
          email,
          { ...inventory, status: 'active', badge: 'has v2, drops v1' },
          loyalty,
          analytics,
          fraud,
        ],
        links: topicLinks(five),
        flows: [
          { path: ['checkout', 'topic'], tone: 'event', label: 'placed v1', duration: 1 },
          { path: ['checkout', 'topic'], tone: 'event', label: 'cancelled v2', duration: 1, delay: 0.6 },
          { path: ['topic', 'inventory'], tone: 'event', label: 'cancelled v2', duration: 1.2, delay: 1.8 },
          { path: ['topic', 'inventory'], tone: 'error', label: 'placed v1 (late)', duration: 1.2, delay: 3.2 },
        ],
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
      title: 'Schema evolution',
      tag: 'concept',
      heading: 'Changing an event without breaking five teams',
      eli5: 'The office may add a new line to the news form, and classes that do not care skip it. It must never rename or remove a line, because some class is still reading that exact line.',
      body: [
        'Checkout renames `total` to `total_cents` on a Tuesday. Nothing fails in checkout\'s tests. An hour later loyalty is awarding zero points and analytics reports revenue of $0. A published event is a public API, and old events with the old shape may sit in backlogs or be replayed for days.',
        'The working rules are short. **Add** fields, and make them optional. Never remove, rename or change the meaning or type of a field. Subscribers ignore fields they do not know. With those rules, old consumers can read new events and new consumers can read old ones.',
        'A **schema registry** enforces this: the publisher\'s build fails if the new schema is incompatible with the registered one. When a breaking change is unavoidable, publish it as a new version next to the old one (`order.placed.v2`), move subscribers over, then retire v1.',
      ],
      keyIdea: 'Treat an event schema as a public API: additive changes only, and a new version in parallel for anything breaking.',
      metrics: { sends: '1', subs: '5', latency: '152 ms', callbacks: '0' },
      scene: {
        nodes: [
          shoppers,
          { ...checkout, status: 'active', badge: 'renamed total' },
          { ...registry, status: 'ok', badge: 'rejects rename' },
          topic,
          email,
          inventory,
          { ...loyalty, status: 'hot', badge: '0 points' },
          { ...analytics, status: 'hot', badge: 'revenue $0' },
          fraud,
        ],
        links: [...topicLinks(five), { from: 'checkout', to: 'registry', style: 'dashed' }],
        flows: [
          { path: ['checkout', 'registry'], tone: 'request', label: 'register schema', duration: 1.2 },
          { path: ['registry', 'checkout'], tone: 'error', label: 'incompatible', duration: 1.2, delay: 1.3 },
          { path: ['checkout', 'topic'], tone: 'event', label: 'total_cents', duration: 1, delay: 2.8 },
          { path: ['topic', 'loyalty'], tone: 'error', duration: 1.2, delay: 3.9 },
          { path: ['topic', 'analytics'], tone: 'error', duration: 1.2, delay: 3.9 },
        ],
        caption: 'Without the registry check, the rename ships and two subscribers break silently',
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
      title: 'Choreography',
      tag: 'case',
      heading: 'Case: the points that never arrived',
      eli5: 'A child never got her sticker. The office told the loudspeaker, one class told another, and somewhere the chain stopped. Nobody wrote down the whole chain, so the teacher must ask room by room.',
      body: [
        'A customer complains that order 8812 earned no loyalty points. In the old design you would read checkout\'s code and its logs. Now the flow is a chain of reactions: `order.placed` leads fraud to publish `order.cleared`, which leads payments to publish `payment.captured`, which is what loyalty listens for. This style, with no coordinator, is called **choreography**.',
      'The business process exists in no single file. It is spread over four services owned by four teams, and each one only shows that it handled its own event correctly. Finding the break took an engineer most of a day: fraud had held the order for review and published nothing.',
        'Three habits make choreography livable. Stamp a **correlation id** on the first event and copy it into every event it causes, so a tracing tool can draw the chain. Keep an event catalog that lists who publishes and who subscribes. Alert on things that did not happen, such as an order with no payment event after 10 minutes.',
      ],
      keyIdea: 'In a choreographed flow no component knows the whole process, so you must build the visibility yourself with correlation ids and tracing.',
      metrics: { sends: '1', subs: '5', latency: '152 ms', callbacks: '0' },
      scene: {
        nodes: [
          shoppers,
          checkout,
          { ...tracer, status: 'active', badge: 'chain stops at fraud' },
          { ...topic, label: 'event bus', sub: '4 topics' },
          email,
          inventory,
          { ...loyalty, status: 'dim', badge: 'heard nothing' },
          analytics,
          { ...fraud, status: 'hot', badge: 'held for review' },
        ],
        links: [...topicLinks(five), { from: 'fraud', to: 'tracer', style: 'faint' }, { from: 'checkout', to: 'tracer', style: 'faint' }],
        flows: [
          { path: ['checkout', 'topic'], tone: 'event', label: 'order.placed', duration: 1 },
          { path: ['topic', 'fraud'], tone: 'event', duration: 1.3, delay: 1.1 },
          { path: ['fraud', 'topic'], tone: 'error', label: 'no order.cleared', duration: 1.3, delay: 2.6 },
          { path: ['fraud', 'tracer'], tone: 'data', label: 'span req_7f3a91', duration: 1.4, delay: 2.6 },
        ],
        caption: 'The trace for one correlation id shows where the chain went quiet',
      },
    },
    {
      title: 'Orchestrate?',
      tag: 'tradeoff',
      heading: 'When one service should run the show',
      eli5: 'For a school trip, one teacher holds the checklist and tells each class what to do next. For everyday news, the loudspeaker is enough. Use the checklist when the steps must happen in order.',
      body: [
        'The alternative to choreography is **orchestration**: one service owns the process and tells the others what to do, step by step. An order workflow asks fraud for a verdict, then payments for a capture, then shipping. The steps, timeouts and failure handling live in one place you can read and query.',
        'Orchestration fits a process with a defined sequence and a business owner, where a stuck step needs a timeout and a compensating action. The cost is the coupling you started this lesson with: the orchestrator knows every participant.',
        'Events fit the opposite case: independent reactions that the core flow does not depend on, such as analytics, search indexing, notifications and cache invalidation. Most real systems mix the two. An orchestrated order flow publishes `order.completed`, and anyone may subscribe.',
      ],
      keyIdea: 'Orchestrate the steps a business process depends on. Publish events for the reactions it does not need to wait for or know about.',
      metrics: { sends: '1', subs: '5', latency: '152 ms', callbacks: '0' },
      scene: {
        nodes: [
          shoppers,
          { ...checkout, label: 'order workflow', sub: 'orchestrator', status: 'active', badge: 'step 2 of 3' },
          { ...topic, label: 'order.completed' },
          { ...email, status: 'dim' },
          { ...inventory, label: 'payments', status: 'active', badge: 'capture' },
          { ...loyalty, status: 'dim' },
          { ...analytics, status: 'dim' },
          { ...fraud, status: 'ok', badge: 'cleared' },
        ],
        links: [
          { from: 'shoppers', to: 'checkout' },
          { from: 'checkout', to: 'fraud', label: '1' },
          { from: 'checkout', to: 'inventory', label: '2' },
          { from: 'checkout', to: 'topic' },
          { from: 'topic', to: 'email', style: 'faint' },
          { from: 'topic', to: 'loyalty', style: 'faint' },
          { from: 'topic', to: 'analytics', style: 'faint' },
        ],
        flows: [
          { path: ['checkout', 'fraud', 'checkout'], tone: 'request', label: 'check', duration: 2 },
          { path: ['checkout', 'inventory', 'checkout'], tone: 'request', label: 'capture', duration: 2, delay: 2.1 },
          { path: ['checkout', 'topic'], tone: 'event', label: 'order.completed', duration: 1, delay: 4.2 },
          { path: ['topic', 'loyalty'], tone: 'event', duration: 1.2, delay: 5.3 },
          { path: ['topic', 'email'], tone: 'event', duration: 1.2, delay: 5.3 },
        ],
        caption: 'Commands for the steps that must happen, an event for everyone else',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'One fact, many independent reactions',
      eli5: 'The office says the news once into the loudspeaker. Every classroom gets its own copy in its own mailbox, numbered so old notes are ignored, on a form whose lines never get renamed.',
      body: [
        'A publisher writes one event to a **topic**, and the broker fans a copy out to every **subscription**, each with its own backlog. Subscribers come and go without the publisher changing. What they all depend on is the event contract, so evolve it additively and check it in a registry.',
        'Decide how much state events carry: thin events call back to the publisher, fat events do not. Expect duplicates and reordering, so key events by entity and version them. A choreographed chain has no owner, so add correlation ids and tracing, and orchestrate the flows that need one.',
      ],
      keyIdea: 'Pub/sub trades visible coupling in code for a shared contract and a flow you must make observable on purpose.',
      metrics: { sends: '1', subs: '5', latency: '152 ms', callbacks: '0' },
      scene: {
        nodes: [shoppers, { ...checkout, status: 'ok' }, { ...topic, status: 'ok' }, ...five.map((s) => ({ ...s, status: 'ok' as const }))],
        links: topicLinks(five),
        flows: [
          { path: ['shoppers', 'checkout', 'topic'], tone: 'event', count: 2, duration: 1.6 },
          ...five.map((s) => ({ path: ['topic', s.id], tone: 'event' as const, duration: 1.2, delay: 1.7 })),
        ],
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
