import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const checkout: SceneNode = { id: 'checkout', kind: 'block', at: at(-3.8, -3.8), label: 'checkout', sub: 'publisher', icon: 'ShoppingBag', tint: 'green' };
const topic: SceneNode = { id: 'topic', kind: 'block', at: at(0, -3.8), label: 'order.placed', sub: 'topic', icon: 'Rss', tint: 'violet' };

// The four first subscribers sit in a fixed row. Fraud takes the last slot when it joins.
const email: SceneNode = { id: 'email', kind: 'block', size: 0.72, at: at(-5.4, 3.8), label: 'email', icon: 'Mail', tint: 'blue' };
const inventory: SceneNode = { id: 'inventory', kind: 'block', size: 0.72, at: at(-1.8, 3.8), label: 'inventory', icon: 'Boxes', tint: 'amber' };
const loyalty: SceneNode = { id: 'loyalty', kind: 'block', size: 0.72, at: at(1.8, 3.8), label: 'loyalty', icon: 'Star', tint: 'violet' };
const analytics: SceneNode = { id: 'analytics', kind: 'block', size: 0.72, at: at(5.4, 3.8), label: 'analytics', icon: 'TrendingUp', tint: 'teal' };
const fraud: SceneNode = { id: 'fraud', kind: 'block', size: 0.72, at: at(5.4, 3.8), label: 'fraud', icon: 'Shield', tint: 'red' };

// Fan-out steps: one queue per subscription, with its service underneath.
const qEmail: SceneNode = { id: 'q-email', kind: 'queue', at: at(-3.6, 0.4), label: 'email queue' };
const qInventory: SceneNode = { id: 'q-inventory', kind: 'queue', at: at(0, 0.4), label: 'inventory queue' };
const qLoyalty: SceneNode = { id: 'q-loyalty', kind: 'queue', at: at(3.6, 0.4), label: 'loyalty queue' };
const inventoryLow: SceneNode = { ...inventory, at: at(0, 6.6) };
const loyaltyLow: SceneNode = { ...loyalty, at: at(3.6, 6.6) };

// Callback steps: topic on top, subscribers in the middle, the order API below.
const orderApi: SceneNode = { id: 'order-api', kind: 'block', at: at(0, 7.8), label: 'order API', sub: 'GET /orders/:id', icon: 'Database', tint: 'gray' };
const midEmail: SceneNode = { ...email, at: at(-3.6, 1) };
const midLoyalty: SceneNode = { ...loyalty, at: at(0, 1) };
const midFraud: SceneNode = { ...fraud, at: at(3.6, 1) };

export const pubsub: Lesson = {
  id: 'pubsub',
  title: 'Pub/sub and event-driven design (part 1)',
  tagline: 'Publish one event and let any number of services react to it: topics, fan-out, delivery, filters and what an event should carry.',
  minutes: 14,
  level: 'Intermediate',
  learn: [
    'Topics, subscriptions and fan-out: one event, a copy for every subscriber',
    'Events versus commands, and why one slow subscriber cannot hurt the others',
    'Push and pull delivery, and filtering at the broker',
    'How pub/sub removes the producer\'s knowledge of its consumers, and the contract that remains',
    'Thin notification events versus events that carry state',
  ],
  metrics: [
    { key: 'sends', label: 'Sends per order', icon: 'Share2' },
    { key: 'subs', label: 'Subscribers', icon: 'Users' },
    { key: 'latency', label: 'Checkout p99', icon: 'Timer' },
    { key: 'callbacks', label: 'Order API reads', icon: 'Repeat' },
  ],
  steps: [
    {
      title: 'Tangled producer',
      tag: 'problem',
      heading: 'Checkout knows about every team that cares',
      eli5: 'The school office has news. A helper must walk to every classroom and say it again. Each time a new classroom opens, the helper gets a longer walk.',
      body: [
        'The queue lesson moved the receipt email out of checkout. Since then, three more teams asked for the same thing. Checkout now sends to four queues after every order: email, inventory, loyalty points and analytics.',
        'Each send is fast, about 2 ms. The cost is elsewhere. Checkout holds the list of everyone who cares, so every new consumer is a code change, a review and a deploy by the checkout team. The fraud team has waited three weeks for theirs.',
      ],
      keyIdea: 'A producer that sends to each consumer by name has to change every time a consumer is added.',
      metrics: { sends: '4', subs: '4', latency: '158 ms', callbacks: '-' },
      metricTones: { sends: 'warn' },
      scene: {
        nodes: [
          { ...checkout, sub: '4 queue clients', status: 'active', chips: ['order 8812'] },
          { ...email, status: 'active' },
          { ...inventory, status: 'active' },
          { ...loyalty, status: 'active' },
          { ...analytics, status: 'active' },
        ],
        links: [link('checkout', 'email'), link('checkout', 'inventory'), link('checkout', 'loyalty'), link('checkout', 'analytics')],
        flows: [
          { path: ['checkout', 'email'], tone: 'event', label: 'send 1', duration: 1.2 },
          { path: ['checkout', 'inventory'], tone: 'event', label: 'send 2', duration: 1.2, delay: 0.6 },
          { path: ['checkout', 'loyalty'], tone: 'event', label: 'send 3', duration: 1.2, delay: 1.2 },
          { path: ['checkout', 'analytics'], tone: 'event', label: 'send 4', duration: 1.2, delay: 1.8 },
        ],
        panel: {
          title: 'Who checkout must know',
          icon: 'List',
          rows: [
            { text: 'email queue', value: 'in code' },
            { text: 'inventory queue', value: 'in code' },
            { text: 'loyalty queue', value: 'in code' },
            { text: 'analytics queue', value: 'in code' },
            { text: 'fraud queue', value: 'waiting 3 weeks', tone: 'bad' },
          ],
          footer: { text: 'Every new consumer is a checkout deploy', tone: 'bad' },
        },
        caption: 'Four sends per order, each one named in checkout\'s code',
      },
    },
    {
      title: 'Half done',
      tag: 'case',
      heading: 'A crash between sends splits the system',
      eli5: 'The helper trips halfway down the hall. Two classrooms heard the news and two never did, and nobody can tell which is which.',
      body: [
        'There is a correctness hole too. Checkout crashes after the second send. Email and inventory know about order 8812. Loyalty and analytics never will.',
        'No transaction spans four separate queues. After a crash, services disagree about what happened, and nothing in the system records which ones are behind.',
      ],
      keyIdea: 'Several separate sends can fail halfway, and then the consumers disagree about the same order.',
      metrics: { sends: '4', subs: '4', latency: '158 ms', callbacks: '-' },
      metricTones: { sends: 'warn' },
      scene: {
        nodes: [
          { ...checkout, sub: '4 queue clients', status: 'hot', badge: 'crashed after send 2' },
          { ...email, status: 'ok', badge: 'got 8812' },
          { ...inventory, status: 'ok', badge: 'got 8812' },
          { ...loyalty, status: 'dim', badge: 'never told' },
          { ...analytics, status: 'dim', badge: 'never told' },
        ],
        links: [link('checkout', 'email'), link('checkout', 'inventory'), link('checkout', 'loyalty', { style: 'dashed' }), link('checkout', 'analytics', { style: 'dashed' })],
        flows: [
          { path: ['checkout', 'email'], tone: 'event', label: 'send 1', duration: 1.2 },
          { path: ['checkout', 'inventory'], tone: 'event', label: 'send 2', duration: 1.2, delay: 0.8 },
          { path: ['checkout', 'loyalty'], tone: 'error', label: 'send 3 lost', duration: 1.2, delay: 1.8 },
        ],
        panel: {
          title: 'Order 8812 after the crash',
          icon: 'Table',
          rows: [
            { text: 'email', value: 'knows', tone: 'good' },
            { text: 'inventory', value: 'knows', tone: 'good' },
            { text: 'loyalty', value: 'never told', tone: 'bad' },
            { text: 'analytics', value: 'never told', tone: 'bad' },
          ],
          footer: { text: 'No record of who is behind', tone: 'bad' },
        },
        caption: 'The crash leaves half the system out of date',
      },
    },
    {
      title: 'Topics',
      tag: 'concept',
      heading: 'Publish once to a topic',
      eli5: 'Now the office speaks into one loudspeaker, the **topic**. The office says the news once and does not need to know which classrooms are listening.',
      body: [
        'In **publish/subscribe**, checkout stops addressing consumers. It publishes one **event**, a statement that something happened, to a named **topic**: `order.placed`. Publishing is a single write, so it either happened or it did not.',
        'Each interested service creates a **subscription** to the topic. Checkout holds one client for one topic and has no list of who is listening.',
      ],
      keyIdea: 'A publisher announces to a topic. Who is listening is the broker\'s business, not the publisher\'s.',
      metrics: { sends: '1', subs: '4', latency: '152 ms', callbacks: '-' },
      metricTones: { sends: 'good', latency: 'good' },
      scene: {
        nodes: [
          { ...checkout, status: 'ok', badge: '1 publish' },
          { ...topic, status: 'active' },
          email,
          inventory,
          loyalty,
        ],
        links: [link('checkout', 'topic'), link('topic', 'email'), link('topic', 'inventory'), link('topic', 'loyalty')],
        flows: [
          { path: ['checkout', 'topic'], tone: 'event', label: 'order.placed', duration: 1 },
          { path: ['topic', 'email'], tone: 'event', duration: 1.2, delay: 1.1 },
          { path: ['topic', 'inventory'], tone: 'event', duration: 1.2, delay: 1.1 },
          { path: ['topic', 'loyalty'], tone: 'event', duration: 1.2, delay: 1.1 },
        ],
        panel: {
          title: 'Subscriptions on order.placed',
          icon: 'Rss',
          rows: [
            { text: 'email', value: 'subscribed' },
            { text: 'inventory', value: 'subscribed' },
            { text: 'loyalty', value: 'subscribed' },
            { text: 'analytics', value: 'subscribed' },
          ],
          footer: { text: 'Checkout holds 1 client, no list', tone: 'good' },
        },
        caption: 'One publish in, one copy out per subscription (analytics is off screen)',
      },
    },
    {
      title: 'Fact, not command',
      tag: 'concept',
      heading: 'An event states a fact in the past tense',
      eli5: 'The loudspeaker says "lunch order 8812 was placed". It does not say "kitchen, cook it". Each classroom decides for itself what that news means for them.',
      body: [
        'Note the wording. A work queue message is a **command**: "send this receipt". It has one intended receiver. An **event** is a fact in the past tense: "order 8812 was placed".',
        'The publisher states the fact. Each subscriber decides what to do about it, and the publisher neither knows nor cares.',
      ],
      keyIdea: 'Commands tell one receiver what to do. Events tell everyone what happened.',
      metrics: { sends: '1', subs: '4', latency: '152 ms', callbacks: '-' },
      scene: {
        nodes: [
          { ...checkout, status: 'active', chips: ['order 8812'] },
          { ...topic, status: 'active' },
          { ...email, status: 'active', chips: ['sends the receipt'] },
          { ...loyalty, status: 'active', chips: ['awards 59 points'] },
        ],
        links: [link('checkout', 'topic'), link('topic', 'email'), link('topic', 'loyalty')],
        flows: [
          { path: ['checkout', 'topic'], tone: 'event', label: 'was placed', duration: 1 },
          { path: ['topic', 'email'], tone: 'event', duration: 1.2, delay: 1.1 },
          { path: ['topic', 'loyalty'], tone: 'event', duration: 1.2, delay: 1.1 },
        ],
        panel: {
          title: 'Command or event',
          icon: 'Code',
          rows: [
            { text: 'Command: "send this receipt"', value: '1 receiver' },
            { text: 'Event: "order 8812 was placed"', value: 'any number', tone: 'good' },
          ],
          footer: { text: 'Name events after what happened', tone: 'muted' },
        },
        caption: 'Same fact, different reaction in each subscriber',
      },
    },
    {
      title: 'Subscriptions',
      tag: 'concept',
      heading: 'Every subscription is its own queue',
      eli5: 'Each classroom has its own mailbox under the loudspeaker. A copy of the news drops into every mailbox, so each class can read it at its own pace.',
      body: [
        'Delivering one event to many subscribers is called **fan-out**. The detail that makes it safe is that each subscription has its own backlog. With SNS you subscribe one SQS queue per service. With Kafka each service is a consumer group with its own offset.',
        'Everything from the queue lesson (acks, retries, dead letters) applies per subscription.',
      ],
      keyIdea: 'Fan-out gives each subscriber a private copy and a private backlog.',
      metrics: { sends: '1', subs: '3', latency: '152 ms', callbacks: '-' },
      scene: {
        nodes: [{ ...checkout, status: 'ok' }, { ...topic, status: 'active' }, qEmail, qInventory, qLoyalty],
        links: [link('checkout', 'topic'), link('topic', 'q-email'), link('topic', 'q-inventory'), link('topic', 'q-loyalty')],
        flows: [
          { path: ['checkout', 'topic'], tone: 'event', label: 'order.placed', duration: 1 },
          { path: ['topic', 'q-email'], tone: 'event', duration: 1.2, delay: 1.1 },
          { path: ['topic', 'q-inventory'], tone: 'event', duration: 1.2, delay: 1.1 },
          { path: ['topic', 'q-loyalty'], tone: 'event', duration: 1.2, delay: 1.1 },
        ],
        caption: 'A copy lands in each subscription\'s own queue',
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
        "is_member": {"DataType": "String", "StringValue": "true"},   # filters match attributes
    },
)

# Subscriber (loyalty team), run once at setup. Checkout is not involved.
# The queue policy must allow sns.amazonaws.com to send to this queue.
sns.subscribe(
    TopicArn=ORDER_PLACED_TOPIC,
    Protocol="sqs",
    Endpoint=LOYALTY_QUEUE_ARN,              # the team's own queue and DLQ
    Attributes={"RawMessageDelivery": "true"},
)`,
        highlight: [2, 3, 13, 15, 16],
      },
    },
    {
      title: 'Isolation',
      tag: 'case',
      heading: 'One slow subscriber delays only itself',
      eli5: 'The loyalty classroom is closed for a 20-minute fire drill. Its mailbox fills up with notes. Every other classroom keeps reading right on time, and loyalty catches up when it returns.',
      body: [
        'The loyalty service is down for a 20-minute deploy. Its queue grows to 2.4 million events.',
        'Email and inventory keep running at zero lag, because they read from their own queues. Loyalty drains its backlog when it returns. Checkout never noticed.',
      ],
      keyIdea: 'Private backlogs mean a down or slow subscriber cannot hurt the publisher or the other subscribers.',
      metrics: { sends: '1', subs: '3', latency: '152 ms', callbacks: '-' },
      metricTones: { latency: 'good' },
      scene: {
        nodes: [
          { ...topic, status: 'active' },
          { ...qInventory, at: at(0, 0.8), status: 'ok', badge: 'depth 0' },
          { ...inventoryLow, status: 'ok' },
          { ...qLoyalty, status: 'hot', badge: 'depth 2.4 M' },
          { ...loyaltyLow, status: 'down' },
        ],
        links: [link('topic', 'q-inventory'), link('topic', 'q-loyalty'), link('q-inventory', 'inventory'), link('q-loyalty', 'loyalty', { style: 'dashed' })],
        flows: [
          { path: ['topic', 'q-inventory', 'inventory'], tone: 'event', duration: 1.8 },
          { path: ['topic', 'q-loyalty'], tone: 'event', label: 'waits', count: 3, duration: 1.2 },
        ],
        panel: {
          title: 'During the 20-minute deploy',
          icon: 'Gauge',
          rows: [
            { text: 'email lag', value: '0', tone: 'good' },
            { text: 'inventory lag', value: '0', tone: 'good' },
            { text: 'loyalty backlog', value: '2.4 M events', tone: 'warn' },
            { text: 'checkout latency', value: 'unchanged', tone: 'good' },
          ],
          footer: { text: 'Loyalty catches up when it returns', tone: 'good' },
        },
        caption: 'Loyalty is down. Its queue fills while the others keep draining.',
      },
    },
    {
      title: 'Fan-out cost',
      tag: 'tradeoff',
      heading: 'Fan-out multiplies the work',
      eli5: 'Every extra classroom needs its own copy of every note. Ten classrooms means ten times the paper, even though the office only spoke once.',
      body: [
        'At 2,000 orders a second with 4 subscriptions, the broker delivers 8,000 messages a second. Every subscriber you add costs one more full copy of the stream.',
        'Checkout still publishes 2,000 events a second. The extra load lands on the broker and on each subscriber, so size those for the copies.',
      ],
      keyIdea: 'Publisher load stays flat as subscribers grow. Broker and subscriber load grow with every copy.',
      metrics: { sends: '1', subs: '4', latency: '152 ms', callbacks: '-' },
      scene: {
        nodes: [
          { ...checkout, status: 'ok', chips: ['2,000 events/s'] },
          { ...topic, status: 'hot', load: 70, badge: '8,000 out/s' },
          qEmail,
          qInventory,
          qLoyalty,
        ],
        links: [link('checkout', 'topic', { label: '2,000/s' }), link('topic', 'q-email'), link('topic', 'q-inventory'), link('topic', 'q-loyalty')],
        flows: [
          { path: ['checkout', 'topic'], tone: 'event', count: 2, duration: 1.2 },
          { path: ['topic', 'q-email'], tone: 'event', count: 2, duration: 1.2, delay: 1.3 },
          { path: ['topic', 'q-inventory'], tone: 'event', count: 2, duration: 1.2, delay: 1.3 },
          { path: ['topic', 'q-loyalty'], tone: 'event', count: 2, duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Messages per second',
          icon: 'Table',
          rows: [
            { text: 'Published by checkout', value: '2,000' },
            { text: 'Subscriptions', value: '4' },
            { text: 'Delivered by the broker', value: '8,000', tone: 'warn' },
            { text: 'With fraud added', value: '10,000', tone: 'warn' },
          ],
          footer: { text: 'Deliveries = events × subscriptions', tone: 'muted' },
        },
        caption: 'The publisher does the same work. The broker does four times as much.',
      },
    },
    {
      title: 'Push or pull',
      tag: 'concept',
      heading: 'The broker pushes, or the subscriber pulls',
      eli5: 'The office can run a note to your door (**push**), or you can walk to your mailbox when you are ready (**pull**). Running is quick. Walking lets you decide how much to carry.',
      body: [
        '**Push**: the broker calls the subscriber, usually an HTTPS endpoint. Delivery is quick, but a burst can overwhelm the subscriber, and it must reply fast so the broker can retry on failure. Push retries use exponential backoff, so a down endpoint is not hammered.',
        '**Pull**: the subscriber asks for messages when it has room. It sets its own pace, which gives natural back pressure. Kafka consumers pull. Google Pub/Sub supports both kinds of subscription.',
      ],
      keyIdea: 'Push is low latency and puts the burden on the subscriber. Pull lets the subscriber control its own load.',
      metrics: { sends: '1', subs: '4', latency: '152 ms', callbacks: '-' },
      scene: {
        nodes: [
          { ...topic, status: 'active' },
          { ...qInventory, status: 'ok' },
          { ...inventoryLow, at: at(0, 7.8), status: 'ok', chips: ['polls, 10 at a time'] },
          { ...loyalty, at: at(3.6, 6.6), status: 'active', chips: [{ text: 'POST /events', tone: 'warn' }] },
        ],
        links: [
          link('topic', 'q-inventory', { label: 'pull' }),
          link('q-inventory', 'inventory', { arrow: 'both' }),
          link('topic', 'loyalty', { label: 'push', labelTone: 'warn' }),
        ],
        flows: [
          { path: ['topic', 'q-inventory'], tone: 'event', duration: 1.2 },
          { path: ['inventory', 'q-inventory'], tone: 'request', label: 'receive 10', duration: 1.4, delay: 1.3 },
          { path: ['q-inventory', 'inventory'], tone: 'response', label: '10 events', duration: 1.4, delay: 2.8 },
          { path: ['topic', 'loyalty'], tone: 'event', label: 'HTTP POST', duration: 1.6, delay: 1.1 },
        ],
        panel: {
          title: 'Push versus pull',
          icon: 'ArrowLeftRight',
          rows: [
            { text: 'Push: latency', value: 'lowest', tone: 'good' },
            { text: 'Push: burst handling', value: 'subscriber\'s problem', tone: 'warn' },
            { text: 'Pull: pace', value: 'subscriber sets it', tone: 'good' },
            { text: 'Pull: idle polling', value: 'small cost', tone: 'muted' },
          ],
          footer: { text: 'Inventory pulls. Loyalty takes pushes.', tone: 'muted' },
        },
        caption: 'Two ways the same event reaches a subscriber',
      },
    },
    {
      title: 'Filtering',
      tag: 'concept',
      heading: 'Let the broker drop what a subscriber does not want',
      eli5: 'Loyalty only cares about lunch orders from club members. Instead of reading every note and throwing most away, the mailbox only accepts notes with a club sticker.',
      body: [
        'A subscription can carry a **filter** on event attributes. The broker checks each event and delivers a copy only when it matches. Non-matching copies never reach the subscription queue. In SNS the filter reads message attributes, so the publisher must set `is_member`.',
        'Loyalty only cares about member orders, about 40% of traffic. With a filter it receives 800 events a second instead of 2,000. Analytics keeps an empty filter and gets all of them.',
      ],
      keyIdea: 'A filter on the subscription saves delivery, storage and handler work, and keeps filtering logic out of the publisher.',
      metrics: { sends: '1', subs: '4', latency: '152 ms', callbacks: '-' },
      scene: {
        nodes: [
          { ...topic, status: 'active', chips: [{ text: 'is_member=true', tone: 'good' }, 'is_member=false'] },
          { ...loyalty, at: at(-1.8, 3.8), status: 'active', chips: ['800/s'] },
          { ...analytics, at: at(3.6, 3.8), status: 'active', chips: ['2,000/s'] },
        ],
        links: [link('topic', 'loyalty', { label: 'members only', labelTone: 'good' }), link('topic', 'analytics', { label: 'all events' })],
        flows: [
          { path: ['topic', 'loyalty'], tone: 'event', label: 'member', duration: 1.4 },
          { path: ['topic', 'analytics'], tone: 'event', label: 'member', duration: 1.4 },
          { path: ['topic', 'analytics'], tone: 'event', label: 'guest', duration: 1.4, delay: 1.7 },
        ],
        panel: {
          title: 'Loyalty subscription filter',
          icon: 'Braces',
          code: '{\n  "is_member": ["true"]\n}',
          footer: { text: 'Guest orders never reach loyalty', tone: 'good' },
        },
        caption: 'The broker filters. Loyalty never sees a guest order.',
      },
      code: {
        language: 'python',
        title: 'Attach the filter when subscribing',
        source: `sns.subscribe(
    TopicArn=ORDER_PLACED_TOPIC,
    Protocol="sqs",
    Endpoint=LOYALTY_QUEUE_ARN,
    Attributes={
        "FilterPolicy": json.dumps({"is_member": ["true"]}),
        "RawMessageDelivery": "true",
    },
)`,
        highlight: [6],
      },
    },
    {
      title: 'Topic design',
      tag: 'concept',
      heading: 'Pick topic granularity and who may touch it',
      eli5: 'The school can have one loudspeaker per kind of news, or one for everything. Only the office may speak into it. Any class may listen, but only after the office says yes.',
      body: [
        'A common default is one topic per event type or per entity, such as `order.placed` or `orders`. Per type keeps filters simple. Per entity keeps order for one key. Name topics `domain.event.v1` so owners and versions are clear.',
        'Permissions matter as much as names. Only the owning service may publish. Each consuming team gets its own subscription, granted by the topic owner.',
      ],
      keyIdea: 'Name topics by domain and event, let one owner publish, and grant each team its own subscription.',
      metrics: { sends: '1', subs: '4', latency: '152 ms', callbacks: '-' },
      scene: {
        nodes: [
          { ...checkout, status: 'ok', chips: [{ text: 'may publish', tone: 'good' }] },
          { ...topic, status: 'active', sub: 'orders.order.placed.v1' },
          { ...fraud, at: at(-1.8, 3.8), status: 'ok', chips: [{ text: 'approved', tone: 'good' }] },
          { ...loyalty, at: at(3.6, 3.8), status: 'dim', chips: [{ text: 'no grant yet', tone: 'warn' }] },
        ],
        links: [link('checkout', 'topic', { label: 'publish' }), link('topic', 'fraud', { label: 'subscribe' }), link('topic', 'loyalty', { label: 'denied', labelTone: 'warn', style: 'dashed' })],
        flows: [
          { path: ['checkout', 'topic'], tone: 'event', duration: 1.2 },
          { path: ['topic', 'fraud'], tone: 'event', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Topic rules',
          icon: 'ShieldCheck',
          rows: [
            { text: 'Granularity', value: 'one per event type', tone: 'good' },
            { text: 'Name', value: 'domain.event.v1', tone: 'good' },
            { text: 'Publish', value: 'owner only', tone: 'good' },
            { text: 'Subscribe', value: 'granted per team', tone: 'warn' },
          ],
        },
        caption: 'One owner publishes, and each consumer is granted its own subscription',
      },
    },
    {
      title: 'Lag',
      tag: 'concept',
      heading: 'Backlog age is the health signal for a subscriber',
      eli5: 'Look at how old the oldest note in a classroom mailbox is. A short pile is fine. If the oldest note is nine minutes old, that class is falling behind and needs more helpers.',
      body: [
        'Watch **consumer lag** (Kafka) or queue depth and **oldest message age** (SQS, Pub/Sub). Rising lag means a subscriber cannot keep up, even while it reports healthy.',
        'Alert on age, not only depth, since age maps to what users feel. Scale subscribers on lag, up to the partition count for Kafka.',
      ],
      keyIdea: 'Alert on backlog age per subscription, and autoscale subscribers on lag.',
      metrics: { sends: '1', subs: '4', latency: '152 ms', callbacks: '-' },
      scene: {
        nodes: [
          { ...qLoyalty, at: at(0, -3.8), status: 'hot', badge: '42k waiting', chips: [{ text: 'oldest: 9 min', tone: 'bad' }] },
          { ...loyalty, at: at(-3.6, 3.8), status: 'hot', chips: ['2 workers'] },
          { ...loyalty, id: 'loyalty-2', at: at(3.6, 3.8), status: 'active', label: 'loyalty +2', chips: ['scaled up'] },
        ],
        links: [link('q-loyalty', 'loyalty'), link('q-loyalty', 'loyalty-2', { label: 'autoscale', labelTone: 'good' })],
        flows: [
          { path: ['q-loyalty', 'loyalty'], tone: 'event', duration: 1.2 },
          { path: ['q-loyalty', 'loyalty-2'], tone: 'event', count: 2, duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Subscriber health',
          icon: 'Activity',
          rows: [
            { text: 'Queue depth', value: '42,000', tone: 'warn' },
            { text: 'Oldest message age', value: '9 min', tone: 'bad' },
            { text: 'Alert', value: 'age > 2 min', tone: 'good' },
            { text: 'Scale on', value: 'lag', tone: 'good' },
          ],
        },
        caption: 'Rising backlog age triggers an alert and more workers',
      },
    },
    {
      title: 'New subscriber',
      tag: 'concept',
      heading: 'A new subscriber needs nothing from the publisher',
      eli5: 'A new classroom opens and hangs up its own mailbox. The office changes nothing and does not even notice.',
      body: [
        'The fraud team creates a subscription and starts scoring orders the same afternoon. Checkout has no code change, no deploy and no meeting.',
        'This is the main reason teams adopt events: producers and consumers can ship on separate schedules.',
      ],
      keyIdea: 'Subscribers come and go without the publisher changing.',
      metrics: { sends: '1', subs: '5', latency: '152 ms', callbacks: '-' },
      metricTones: { subs: 'good' },
      scene: {
        nodes: [
          { ...checkout, badge: 'no change' },
          { ...topic, status: 'active' },
          inventory,
          loyalty,
          { ...fraud, status: 'active', badge: 'new' },
        ],
        links: [link('checkout', 'topic'), link('topic', 'inventory'), link('topic', 'loyalty'), link('topic', 'fraud')],
        flows: [
          { path: ['checkout', 'topic'], tone: 'event', label: 'order.placed', duration: 1 },
          { path: ['topic', 'fraud'], tone: 'event', label: 'copy 5', duration: 1.4, delay: 1.1 },
          { path: ['topic', 'inventory'], tone: 'event', duration: 1.4, delay: 1.1 },
          { path: ['topic', 'loyalty'], tone: 'event', duration: 1.4, delay: 1.1 },
        ],
        panel: {
          title: 'Fraud joins, same afternoon',
          icon: 'Shield',
          rows: [
            { text: 'Create subscription', value: 'done', tone: 'good' },
            { text: 'Checkout code change', value: 'none', tone: 'good' },
            { text: 'Checkout deploy', value: 'none', tone: 'good' },
            { text: 'Time to live', value: '1 afternoon', tone: 'good' },
          ],
          footer: { text: 'Before: 3 weeks of waiting', tone: 'muted' },
        },
        caption: 'Fraud subscribes by itself. Checkout is not redeployed.',
      },
    },
    {
      title: 'Hidden coupling',
      tag: 'tradeoff',
      heading: 'The coupling moves into the event contract',
      eli5: 'The office no longer knows who is listening. A line on the news form that looks useless to the office may be exactly what one classroom is waiting for.',
      body: [
        'The dependency is still there, moved from code into the **event contract**. Five services now depend on the shape and meaning of `order.placed`, and checkout cannot see them in its own codebase.',
        'A field that looks unused may be the one the fraud model needs. Treat the event as shared, and find out who reads it before you change it.',
      ],
      keyIdea: 'Pub/sub removes the publisher\'s knowledge of its consumers. The coupling that remains is the event contract, and it is harder to see.',
      metrics: { sends: '1', subs: '5', latency: '152 ms', callbacks: '-' },
      scene: {
        nodes: [
          { ...checkout, status: 'active', chips: [{ text: 'drop gift_wrap?', tone: 'warn' }] },
          { ...topic, status: 'active' },
          { ...loyalty, at: at(-1.8, 3.8), status: 'active', chips: ['reads total'] },
          { ...analytics, at: at(1.8, 3.8), status: 'active', chips: ['reads total'] },
          { ...fraud, at: at(5.4, 3.8), status: 'hot', chips: [{ text: 'reads gift_wrap', tone: 'bad' }] },
        ],
        links: [link('checkout', 'topic'), link('topic', 'loyalty'), link('topic', 'analytics'), link('topic', 'fraud')],
        flows: [
          { path: ['checkout', 'topic'], tone: 'event', label: 'order.placed', duration: 1 },
          { path: ['topic', 'fraud'], tone: 'event', duration: 1.2, delay: 1.1 },
        ],
        panel: {
          title: 'Who reads which field',
          icon: 'Table',
          rows: [
            { text: 'total', value: 'loyalty, analytics' },
            { text: 'customer_id', value: 'loyalty, fraud' },
            { text: 'gift_wrap', value: 'fraud only', tone: 'warn' },
          ],
          footer: { text: 'Checkout cannot see these readers', tone: 'warn' },
        },
        caption: 'Five services depend on a shape checkout cannot see',
      },
    },
    {
      title: 'No reply',
      tag: 'tradeoff',
      heading: 'Events do not give an answer back',
      eli5: 'The office shouts the news and walks on. If the office needs a yes or no from one class before it can go on, shouting into the loudspeaker is the wrong tool. It must ask that class directly.',
      body: [
        'Checkout cannot learn from a publish whether stock was reserved. The broker confirms receipt of the event, and nothing more.',
        'If the caller needs a result before it can continue, use a request. Events fit reactions that the core flow does not wait for.',
      ],
      keyIdea: 'A publish tells you the event was accepted, not what any subscriber did with it.',
      metrics: { sends: '1', subs: '5', latency: '152 ms', callbacks: '-' },
      scene: {
        nodes: [
          { ...checkout, status: 'active', chips: [{ text: 'was stock reserved?', tone: 'warn' }] },
          { ...topic, status: 'active' },
          { ...inventory, status: 'active', chips: ['reserved 2 items'] },
        ],
        links: [link('checkout', 'topic'), link('topic', 'inventory'), link('inventory', 'checkout', { style: 'dashed', label: 'no path back', labelTone: 'warn', route: 'straight' })],
        flows: [
          { path: ['checkout', 'topic'], tone: 'event', label: 'order.placed', duration: 1 },
          { path: ['topic', 'inventory'], tone: 'event', duration: 1.2, delay: 1.1 },
        ],
        panel: {
          title: 'Which tool fits',
          icon: 'Split',
          rows: [
            { text: 'Need an answer to go on', value: 'request', tone: 'good' },
            { text: 'Announce what happened', value: 'event', tone: 'good' },
            { text: 'Ask via an event', value: 'avoid', tone: 'warn' },
          ],
          footer: { text: 'The broker acks receipt only', tone: 'muted' },
        },
        caption: 'The publish returns when the broker has the event, not when anyone acted',
      },
    },
    {
      title: 'Thin events',
      tag: 'tradeoff',
      heading: 'Notification events push reads back to the publisher',
      eli5: 'The loudspeaker says "there is news, come to the office and ask". Now every classroom lines up at the office door, and the office is busier than before.',
      body: [
        'A thin **event notification** carries only identifiers: `{order_id: 8812}`. Subscribers that need details call the order API. The event is small and never stale.',
        'But five subscribers at 2,000 events a second put **10,000 reads a second** back on the publisher. The services are decoupled on paper and tied together at runtime: if the order API is down, every subscriber stalls.',
      ],
      keyIdea: 'Thin events keep the contract small and push load and a runtime dependency back to the publisher.',
      metrics: { sends: '1', subs: '5', latency: '152 ms', callbacks: '10,000/s' },
      metricTones: { callbacks: 'bad' },
      scene: {
        nodes: [
          { ...topic, at: at(0, -4.8), status: 'active', badge: '{order_id}' },
          { ...midEmail, status: 'active' },
          { ...midLoyalty, status: 'active' },
          { ...midFraud, status: 'active' },
          { ...orderApi, at: at(0, 8.6), status: 'hot', load: 94, badge: '10,000 reads/s' },
        ],
        links: [
          link('topic', 'email'),
          link('topic', 'loyalty'),
          link('topic', 'fraud'),
          link('email', 'order-api', { style: 'faint' }),
          link('loyalty', 'order-api', { style: 'faint' }),
          link('fraud', 'order-api', { style: 'faint' }),
        ],
        flows: [
          { path: ['topic', 'email'], tone: 'event', duration: 1.2 },
          { path: ['topic', 'loyalty'], tone: 'event', duration: 1.2 },
          { path: ['topic', 'fraud'], tone: 'event', duration: 1.2 },
          { path: ['email', 'order-api'], tone: 'request', label: 'GET order', duration: 1.4, delay: 1.4 },
          { path: ['loyalty', 'order-api'], tone: 'request', duration: 1.4, delay: 1.4 },
          { path: ['fraud', 'order-api'], tone: 'request', duration: 1.4, delay: 1.4 },
        ],
        panel: {
          title: 'The thin event',
          icon: 'FileJson',
          code: '{\n  "type": "order.placed",\n  "order_id": 8812\n}',
          footer: { text: '5 subscribers × 2,000/s = 10,000 reads/s', tone: 'bad' },
        },
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
      title: 'Fat events',
      tag: 'tradeoff',
      heading: 'Event-carried state removes the callback',
      eli5: 'This time the loudspeaker reads out the whole news: what was ordered, by whom, how much. Nobody walks to the office, and classes keep working even if the office door is locked.',
      body: [
        '**Event-carried state transfer** puts the data in the event: items, totals, customer, address. Subscribers keep the parts they need in their own tables and never call back.',
        'They keep working while the order service is down. The price is larger messages, about 2 KB instead of 60 bytes, and every subscriber holds a copy that is slightly behind.',
      ],
      keyIdea: 'Fat events trade bigger messages and slightly stale copies for subscribers that run on their own.',
      metrics: { sends: '1', subs: '5', latency: '152 ms', callbacks: '0' },
      metricTones: { callbacks: 'good' },
      scene: {
        nodes: [
          { ...topic, at: at(0, -4.8), status: 'active', badge: 'items, totals, customer' },
          { ...midEmail, status: 'ok', chips: ['own order table'] },
          { ...midLoyalty, status: 'ok', chips: ['own order table'] },
          { ...midFraud, status: 'ok', chips: ['own order table'] },
          { ...orderApi, status: 'down', badge: 'down, nobody cares' },
        ],
        links: [link('topic', 'email'), link('topic', 'loyalty'), link('topic', 'fraud')],
        flows: [
          { path: ['topic', 'email'], tone: 'event', label: '2 KB', duration: 1.4 },
          { path: ['topic', 'loyalty'], tone: 'event', duration: 1.4 },
          { path: ['topic', 'fraud'], tone: 'event', duration: 1.4 },
        ],
        panel: {
          title: 'Thin versus fat',
          icon: 'Table',
          rows: [
            { text: 'Event size', value: '60 B vs 2 KB' },
            { text: 'Reads on order API', value: '10,000/s vs 0', tone: 'good' },
            { text: 'Works with order API down', value: 'no vs yes', tone: 'good' },
            { text: 'Subscriber copy', value: 'slightly behind', tone: 'warn' },
          ],
          footer: { text: 'More fields, more ways to break someone', tone: 'warn' },
        },
        caption: 'Fat events: subscribers keep working while the order API is down',
      },
    },
    {
      title: 'Choosing',
      tag: 'tradeoff',
      heading: 'Carry what most subscribers need',
      eli5: 'Read out the lines most classes need. Keep the long or private bits in the office, and let the one class that needs them ask.',
      body: [
        'A sensible default: carry the state most subscribers need, such as items, totals and the customer id. Leave large, rarely used or sensitive fields behind the API.',
        'Every field you add is a field you must keep forever, and every subscriber stores a copy. The test for a field is whether most readers use it.',
      ],
      keyIdea: 'Put the shared fields in the event and leave the rest behind the API.',
      metrics: { sends: '1', subs: '5', latency: '152 ms', callbacks: '~0' },
      metricTones: { callbacks: 'good' },
      scene: {
        nodes: [
          { ...topic, at: at(0, -5.2), status: 'active', chips: ['order_id', 'items', 'total', 'customer_id'] },
          { ...midLoyalty, status: 'ok' },
          { ...midFraud, status: 'ok', chips: [{ text: 'needs card country', tone: 'warn' }] },
          { ...orderApi, status: 'ok', sub: 'rare, sensitive fields' },
        ],
        links: [link('topic', 'loyalty'), link('topic', 'fraud'), link('fraud', 'order-api', { label: 'rare call', style: 'dashed' })],
        flows: [
          { path: ['topic', 'loyalty'], tone: 'event', duration: 1.2 },
          { path: ['topic', 'fraud'], tone: 'event', duration: 1.2 },
          { path: ['fraud', 'order-api'], tone: 'request', label: 'card country', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Where each field lives',
          icon: 'List',
          rows: [
            { text: 'order_id, items, total, customer_id', value: 'in the event', tone: 'good' },
            { text: 'full order history', value: 'behind API', tone: 'warn' },
            { text: 'card details, address', value: 'behind API', tone: 'warn' },
          ],
          footer: { text: 'Most readers use it? Put it in the event', tone: 'muted' },
        },
        caption: 'The shared fields travel. The rare ones stay behind the API.',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'One fact, many independent copies',
      eli5: 'The office says the news once into the loudspeaker. Every classroom gets its own copy in its own mailbox, takes only the notes it wants, and reads at its own pace.',
      body: [
        'A publisher writes one event to a **topic**, and the broker fans a copy out to every **subscription**, each with its own backlog. Subscribers can be filtered, pushed to or pulled from, and added without the publisher changing.',
        'What they all depend on is the event contract, so decide how much state it carries. Part 2 covers duplicates, ordering, schemas and who runs the flow.',
      ],
      keyIdea: 'Pub/sub trades a list of consumers in code for a shared contract, and gives each consumer its own backlog.',
      metrics: { sends: '1', subs: '5', latency: '152 ms', callbacks: '0' },
      metricTones: { sends: 'good', latency: 'good', callbacks: 'good' },
      scene: {
        nodes: [{ ...checkout, status: 'ok' }, { ...topic, status: 'ok' }, { ...inventory, status: 'ok' }, { ...loyalty, status: 'ok' }, { ...fraud, status: 'ok' }],
        links: [link('checkout', 'topic'), link('topic', 'inventory'), link('topic', 'loyalty'), link('topic', 'fraud')],
        flows: [
          { path: ['checkout', 'topic'], tone: 'event', count: 2, duration: 1.4 },
          { path: ['topic', 'inventory'], tone: 'event', duration: 1.2, delay: 1.5 },
          { path: ['topic', 'loyalty'], tone: 'event', duration: 1.2, delay: 1.5 },
          { path: ['topic', 'fraud'], tone: 'event', duration: 1.2, delay: 1.5 },
        ],
        panel: {
          title: 'Part 1 in four lines',
          icon: 'Layers',
          rows: [
            { text: 'Publish once', value: 'to a topic', tone: 'good' },
            { text: 'Each subscription', value: 'own queue', tone: 'good' },
            { text: 'Filter, push or pull', value: 'per subscriber', tone: 'good' },
            { text: 'Event contract', value: 'shared', tone: 'warn' },
          ],
        },
      },
      quiz: {
        question: 'The loyalty service is down for 20 minutes. Email and inventory are healthy. What happens to checkout and to the other subscribers?',
        options: [
          'Checkout slows down, because it must wait for every subscriber',
          'Email and inventory stall too, because the topic delivers in lockstep',
          'Nothing changes for them. Loyalty\'s own queue grows, and it catches up when it returns',
          'The events for loyalty are lost, because it was not listening',
        ],
        answer: 2,
        explain: 'Each subscription has its own backlog. A down subscriber only delays itself, and its queue holds the events until it is back.',
      },
    },
  ],
};
