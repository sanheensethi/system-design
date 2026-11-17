import type { Lesson, SceneLink, SceneNode } from '../engine/types';

const shoppers: SceneNode = { id: 'shoppers', kind: 'client', at: [-4.75, 4.75], label: 'shoppers' };
const api: SceneNode = { id: 'api', kind: 'server', at: [-3, 3], label: 'checkout API', sub: '400 threads' };
const mailer: SceneNode = { id: 'mailer', kind: 'service', at: [1.75, -1.75], label: 'email service' };
const queue: SceneNode = { id: 'queue', kind: 'queue', at: [-0.75, 0.75], label: 'order-emails', sub: 'SQS queue' };
const w0: SceneNode = { id: 'w0', kind: 'worker', at: [-0.75, -4.25], label: 'worker 4' };
const w1: SceneNode = { id: 'w1', kind: 'worker', at: [-1, -2.5], label: 'worker 1' };
const w2: SceneNode = { id: 'w2', kind: 'worker', at: [1.75, -1.75], label: 'worker 2' };
const w3: SceneNode = { id: 'w3', kind: 'worker', at: [2.5, 1], label: 'worker 3' };
const w4: SceneNode = { id: 'w4', kind: 'worker', at: [4.5, 1], label: 'worker 5' };
const smtp: SceneNode = { id: 'smtp', kind: 'internet', at: [4.4, -4.4], label: 'email provider', sub: 'SMTP API' };
const dedupe: SceneNode = { id: 'dedupe', kind: 'cache', at: [5.75, -0.75], label: 'dedupe store', sub: 'Redis' };
const dlq: SceneNode = { id: 'dlq', kind: 'queue', at: [2.5, 3.1], label: 'dead letters', sub: 'order-emails-dlq' };

// Kafka: one topic, three partitions, two consumer groups.
const p0: SceneNode = { id: 'p0', kind: 'queue', at: [-2.75, -1.25], label: 'orders · p0' };
const p1: SceneNode = { id: 'p1', kind: 'queue', at: [-0.75, 0.75], label: 'orders · p1' };
const p2: SceneNode = { id: 'p2', kind: 'queue', at: [1.25, 2.75], label: 'orders · p2' };
const analytics: SceneNode = { id: 'analytics', kind: 'service', at: [4.5, -1], label: 'analytics', sub: 'group: analytics' };

const queueLinks: SceneLink[] = [
  { from: 'shoppers', to: 'api' },
  { from: 'api', to: 'queue' },
  { from: 'queue', to: 'w1' },
  { from: 'queue', to: 'w2' },
  { from: 'queue', to: 'w3' },
  { from: 'w1', to: 'smtp' },
  { from: 'w2', to: 'smtp' },
];

const kafkaLinks: SceneLink[] = [
  { from: 'shoppers', to: 'api' },
  { from: 'api', to: 'p0' },
  { from: 'api', to: 'p1' },
  { from: 'api', to: 'p2' },
  { from: 'p0', to: 'w1' },
  { from: 'p1', to: 'w2' },
  { from: 'p2', to: 'w3' },
  { from: 'p0', to: 'analytics', style: 'faint' },
  { from: 'p1', to: 'analytics', style: 'faint' },
  { from: 'p2', to: 'analytics', style: 'faint' },
];

const emailGroup = (sub: string) => [
  { ...w1, sub },
  { ...w2, sub },
  { ...w3, sub },
];

export const messageQueues: Lesson = {
  id: 'message-queues',
  title: 'Message queues and streams',
  tagline: 'Stop a slow email provider from taking down checkout, then learn what a queue does not promise.',
  minutes: 13,
  level: 'Intermediate',
  learn: [
    'Why a synchronous call chain fails under a traffic spike',
    'Producers, consumers, and how a queue absorbs a burst',
    'Scaling consumers on queue depth',
    'At-least-once delivery: acks, retries and idempotent consumers',
    'Dead-letter queues, and work queues compared with Kafka-style logs',
  ],
  metrics: [
    { key: 'latency', label: 'Checkout p99' },
    { key: 'depth', label: 'Queue depth' },
    { key: 'workers', label: 'Workers' },
    { key: 'rate', label: 'Emails/s' },
    { key: 'failed', label: 'Failed orders' },
  ],
  steps: [
    {
      title: 'Spike',
      tag: 'problem',
      heading: 'A slow email provider takes down checkout',
      eli5: 'At the post office, the clerk, our checkout API, takes your letter and makes you wait at the counter until it is delivered across town. That is a **synchronous** call. When delivery is slow, the line goes out the door.',
      body: [
        'Checkout saves the order, then calls the email service to send a receipt, and only then answers the shopper. On a normal day that is 150 ms of work plus 250 ms for the email: a 400 ms checkout at 200 orders a second.',
        'Black Friday brings **2,000 orders a second**. The email provider slows to 2 seconds per message. Each checkout now holds an API thread for over 2 seconds, so 2,000 orders a second would need more than 4,000 threads. The API has 400.',
        'Requests pile up, time out at 30 seconds, and 35% of orders fail. Customers cannot pay you because a receipt email is slow.',
      ],
      keyIdea: 'In a synchronous chain, the slowest dependency sets the speed of everything upstream, even work the user is not waiting for.',
      metrics: { latency: '30 s (timeouts)', rate: '200/s', failed: '35%' },
      scene: {
        nodes: [
          { ...shoppers, sub: '2,000 orders/s' },
          { ...api, status: 'hot', badge: '400/400 threads busy' },
          { ...mailer, status: 'hot', badge: 'waiting' },
          { ...smtp, status: 'hot', badge: '2 s per email' },
        ],
        links: [
          { from: 'shoppers', to: 'api' },
          { from: 'api', to: 'mailer' },
          { from: 'mailer', to: 'smtp' },
        ],
        flows: [
          { path: ['shoppers', 'api', 'mailer', 'smtp'], tone: 'request', label: 'checkout', count: 5, duration: 2.4 },
          { path: ['smtp', 'mailer'], tone: 'response', duration: 2.6, delay: 2.5 },
          { path: ['api', 'shoppers'], tone: 'error', label: '504 timeout', count: 3, duration: 1.2, delay: 1.5 },
        ],
        caption: 'Every checkout waits for an email to be sent',
      },
    },
    {
      title: 'Add a queue',
      tag: 'concept',
      heading: 'Put a queue between the order and the email',
      eli5: 'Now the clerk drops your letter in a mail bin, the **queue**, and says "all done!" right away. Mail carriers, the workers, take letters from the bin and deliver them when they can.',
      body: [
        'The shopper does not need the email to arrive before seeing "order confirmed". So the API writes a small message, `{order_id, email}`, to a **queue** and answers right away. Writing to the queue takes about 2 ms.',
        'The API is now a **producer**. Separate **consumers**, here three email workers, pull messages from the queue and talk to the provider at their own pace.',
        'Checkout is back to 150 ms, and it no longer cares how slow email is. The two sides are **decoupled**: either can be slow, redeployed or scaled without the other noticing.',
      ],
      keyIdea: 'A queue turns "do it now" into "do it soon". The producer finishes in milliseconds, whatever happens downstream.',
      metrics: { latency: '150 ms', depth: '~0', workers: '3', rate: '200/s', failed: '0%' },
      scene: {
        nodes: [
          { ...shoppers, sub: '200 orders/s' },
          { ...api, status: 'ok', badge: '150 ms' },
          { ...queue, status: 'active' },
          ...emailGroup('400 emails/s'),
          smtp,
        ],
        links: queueLinks,
        flows: [
          { path: ['shoppers', 'api'], tone: 'request', label: 'checkout', duration: 1 },
          { path: ['api', 'queue'], tone: 'event', label: 'order 8812', duration: 0.9, delay: 1 },
          { path: ['api', 'shoppers'], tone: 'response', label: 'confirmed', duration: 1, delay: 1.1 },
          { path: ['queue', 'w2', 'smtp'], tone: 'event', label: 'send receipt', duration: 1.8, delay: 2 },
        ],
        caption: 'Producer on the left, consumers on the right',
      },
    },
    {
      title: 'Absorb bursts',
      tag: 'concept',
      heading: 'The queue soaks up the spike',
      eli5: 'On a busy day, letters come in faster than the three carriers can deliver them. The pile in the bin grows, and its size is the **queue depth**. Nobody waits at the counter. Letters just arrive a bit late.',
      body: [
        'Black Friday again: 2,000 orders a second arrive and three workers send 1,200 emails a second. The difference, 800 messages a second, waits in the queue.',
        'After a five-minute spike the **queue depth** is 240,000 messages and the oldest one has waited about 200 seconds. Checkout is still 150 ms and no order fails. The cost moved somewhere harmless: receipts arrive a few minutes late.',
        'Watch two numbers on any queue: depth, and the **age of the oldest message**. Depth that keeps growing after the spike ends means consumers are too slow for normal traffic.',
      ],
      keyIdea: 'A queue converts a spike into a backlog. Users feel the producer\'s speed, while the backlog is drained at the consumers\' speed.',
      metrics: { latency: '150 ms', depth: '240,000', workers: '3', rate: '1,200/s', failed: '0%' },
      scene: {
        nodes: [
          { ...shoppers, sub: '2,000 orders/s' },
          { ...api, status: 'ok', badge: '150 ms' },
          { ...queue, status: 'hot', badge: 'depth 240,000' },
          ...emailGroup('400 emails/s').map((w) => ({ ...w, status: 'active' as const })),
          smtp,
        ],
        links: queueLinks,
        flows: [
          { path: ['shoppers', 'api', 'queue'], tone: 'event', count: 6, duration: 1.4 },
          { path: ['queue', 'w1', 'smtp'], tone: 'event', count: 2, duration: 2, delay: 0.4 },
          { path: ['queue', 'w2', 'smtp'], tone: 'event', count: 2, duration: 2, delay: 0.8 },
          { path: ['queue', 'w3'], tone: 'event', count: 2, duration: 1.2, delay: 1.2 },
        ],
        caption: '2,000 in, 1,200 out: the backlog grows by 800 a second',
      },
    },
    {
      title: 'Scale out',
      tag: 'concept',
      heading: 'Add consumers when the backlog grows',
      eli5: 'When the pile gets too big, the post office calls in two more carriers, workers 4 and 5, and the bin empties fast. Adding helpers like this is **scaling out**. It stops helping once the town cannot take mail any faster.',
      body: [
        'Consumers are interchangeable, so you add more. An autoscaling rule watches queue depth and adds a worker for every 50,000 waiting messages, up to five. Five workers send **2,000 emails a second**.',
        'The spike ends and inflow falls back to 200 a second. Five workers drain 1,800 a second more than arrives, so the 240,000 backlog is gone in about two minutes. Then the extra workers scale back in.',
        'There is a ceiling. The provider accepts 2,500 emails a second. Add a tenth worker and it only collects `429 Too Many Requests`. Scaling consumers moves the bottleneck downstream, so know where it goes next.',
      ],
      keyIdea: 'Queues let you scale producers and consumers separately. Scale consumers on depth or message age, up to what the next dependency can take.',
      metrics: { latency: '150 ms', depth: '240,000 → 0', workers: '5', rate: '2,000/s', failed: '0%' },
      scene: {
        nodes: [
          { ...shoppers, sub: '200 orders/s' },
          { ...api, status: 'ok' },
          { ...queue, status: 'active', badge: 'draining' },
          { ...w0, status: 'active', badge: 'new' },
          ...emailGroup('400 emails/s').map((w) => ({ ...w, status: 'active' as const })),
          { ...w4, status: 'active', badge: 'new' },
          { ...smtp, badge: 'limit 2,500/s' },
        ],
        links: [...queueLinks, { from: 'queue', to: 'w0' }, { from: 'queue', to: 'w4' }, { from: 'w0', to: 'smtp' }],
        flows: [
          { path: ['queue', 'w0', 'smtp'], tone: 'event', count: 2, duration: 1.8 },
          { path: ['queue', 'w1', 'smtp'], tone: 'event', count: 2, duration: 1.8, delay: 0.3 },
          { path: ['queue', 'w2', 'smtp'], tone: 'event', count: 2, duration: 1.8, delay: 0.6 },
          { path: ['queue', 'w3'], tone: 'event', count: 2, duration: 1.1, delay: 0.9 },
          { path: ['queue', 'w4'], tone: 'event', count: 2, duration: 1.3, delay: 1.2 },
        ],
        caption: 'Five workers drain the backlog in about two minutes',
      },
    },
    {
      title: 'Acks',
      tag: 'concept',
      heading: 'A message is gone only when a consumer says so',
      eli5: 'A carrier must come back and say "delivered!" before a letter is crossed off the list. That is an **ack**. If worker 2 trips and never reports back, worker 3 delivers it again, so it might arrive twice.',
      body: [
        'When worker 2 receives a message, the queue hides it from everyone else for a **visibility timeout**, say 30 seconds. The worker sends the email, then **acks** by deleting the message. Only then is it gone.',
        'If worker 2 crashes mid-message, it never acks. After 30 seconds the message reappears and worker 3 picks it up. Nothing is lost, and this is called **at-least-once** delivery.',
        'The catch is in the name. If worker 2 sent the email and crashed just before the ack, the email goes out **twice**. A queue that never loses messages will sometimes deliver one more than once.',
      ],
      keyIdea: 'Ack after the work is done. You get no lost messages in exchange for occasional duplicates.',
      metrics: { latency: '150 ms', depth: '1,200', workers: '4 of 5', rate: '1,600/s', failed: '0%' },
      scene: {
        nodes: [
          shoppers,
          api,
          { ...queue, status: 'active', badge: 'hidden 30 s' },
          ...emailGroup('400 emails/s').map((w) =>
            w.id === 'w2' ? { ...w, status: 'down' as const, badge: 'crashed, no ack' } : w.id === 'w3' ? { ...w, status: 'active' as const, badge: 'retry' } : w,
          ),
          smtp,
        ],
        links: queueLinks,
        flows: [
          { path: ['queue', 'w2'], tone: 'event', label: 'order 8812', duration: 1.1 },
          { path: ['w2', 'smtp'], tone: 'event', label: 'sent?', duration: 1, delay: 1.2 },
          { path: ['queue', 'w3'], tone: 'event', label: 'redelivered after 30 s', duration: 1.4, delay: 2.8 },
          { path: ['w3', 'queue'], tone: 'response', label: 'ack (delete)', duration: 1.2, delay: 4.4 },
        ],
        caption: 'No ack in 30 s, so the message comes back for another worker',
      },
      quiz: {
        question: 'A worker sends the receipt email, then crashes before deleting the message. What happens next?',
        options: [
          'The message is lost, because it was already received',
          'After the visibility timeout the message reappears, and the customer may get a second email',
          'The queue detects the email was sent and drops the message',
          'The message goes straight to the dead-letter queue',
        ],
        answer: 1,
        explain: 'The queue only knows the message was never acked. It redelivers it, which is why consumers must be safe to run twice.',
      },
    },
    {
      title: 'Idempotency',
      tag: 'concept',
      heading: 'Make running twice the same as running once',
      eli5: 'Before delivering, the carrier checks a notebook, the dedupe store, to see if this letter was already delivered. If it was, they skip it. Being safe to do twice is called **idempotent**.',
      body: [
        'Since duplicates will happen, the consumer must be **idempotent**: handling the same message twice has the same effect as handling it once.',
        'Give every message an **idempotency key** that names the effect, here `receipt:{order_id}`. Before the side effect, check whether that key is already done. After it, record it. Pass the same key to the provider when it supports one, so a duplicate that slips through on their side is dropped too.',
        '"Exactly once" at the transport layer is almost always a marketing term. In practice you get it from at-least-once delivery plus an idempotent consumer.',
      ],
      keyIdea: 'At-least-once delivery plus an idempotent consumer is how real systems get exactly-once effects.',
      metrics: { latency: '150 ms', depth: '~0', workers: '5', rate: '2,000/s', failed: '0%' },
      scene: {
        nodes: [
          shoppers,
          api,
          { ...queue, status: 'active' },
          ...emailGroup('400 emails/s').map((w) => (w.id === 'w3' ? { ...w, status: 'active' as const, badge: 'duplicate, skip' } : w)),
          smtp,
          { ...dedupe, status: 'ok', badge: 'receipt:8812 = done' },
        ],
        links: [...queueLinks, { from: 'w3', to: 'dedupe' }],
        flows: [
          { path: ['queue', 'w3'], tone: 'event', label: 'order 8812 again', duration: 1.2 },
          { path: ['w3', 'dedupe'], tone: 'request', label: 'GET receipt:8812', duration: 1, delay: 1.3 },
          { path: ['dedupe', 'w3'], tone: 'response', label: 'done', duration: 1, delay: 2.4 },
          { path: ['w3', 'queue'], tone: 'response', label: 'ack, no email', duration: 1.2, delay: 3.5 },
        ],
        caption: 'The second delivery is acked without sending a second email',
      },
      code: {
        language: 'python',
        title: 'An idempotent SQS consumer',
        source: `def handle(msg):
    order = json.loads(msg["Body"])
    key = f"receipt:{order['order_id']}"           # names the effect, not the delivery
    if redis.get(key) == b"done":
        return ack(msg)                             # duplicate: skip the side effect
    send_receipt(order, idempotency_key=key)        # provider dedupes on the key too
    redis.set(key, "done", ex=7 * 86400)            # remember it for a week
    ack(msg)                                        # only now remove it from the queue

def ack(msg):
    sqs.delete_message(QueueUrl=QUEUE, ReceiptHandle=msg["ReceiptHandle"])

while True:
    resp = sqs.receive_message(QueueUrl=QUEUE, MaxNumberOfMessages=10,
                               WaitTimeSeconds=20, VisibilityTimeout=30)
    for msg in resp.get("Messages", []):
        handle(msg)   # an exception means no ack, so SQS redelivers in 30 s`,
        highlight: [3, 4, 5, 7, 8],
      },
    },
    {
      title: 'Dead letters',
      tag: 'case',
      heading: 'Case: the message that fails forever',
      eli5: 'One letter has a wrong address and comes back every time. After five tries the post office puts it in a special box, the **dead-letter queue**, for a grown-up to look at. The carriers get on with the other mail.',
      body: [
        'Order 9001 has a malformed email address. The provider rejects it every time, the worker throws, the message comes back, and the cycle repeats. A **poison message** like this burns worker time forever and fills the logs with the same stack trace.',
        'Set a limit: after 5 failed receives, the queue moves the message to a **dead-letter queue** (DLQ). The main queue keeps flowing, and the bad message waits for a human with its full payload intact.',
        'A DLQ only helps if someone looks at it. Alert when its depth goes above zero, fix the cause, then redrive the messages back to the main queue.',
      ],
      keyIdea: 'Retries handle temporary failures. A dead-letter queue catches permanent ones so they stop blocking everything else.',
      metrics: { latency: '150 ms', depth: '~0', workers: '5', rate: '2,000/s', failed: '1 in DLQ' },
      scene: {
        nodes: [
          shoppers,
          api,
          { ...queue, status: 'active', badge: 'receive #5' },
          ...emailGroup('400 emails/s').map((w) => (w.id === 'w3' ? { ...w, status: 'hot' as const, badge: 'bad address' } : w)),
          smtp,
          { ...dlq, status: 'hot', badge: '1 message' },
        ],
        links: [...queueLinks, { from: 'queue', to: 'dlq', style: 'dashed' }],
        flows: [
          { path: ['queue', 'w3'], tone: 'event', label: 'order 9001', duration: 1.1 },
          { path: ['w3', 'queue'], tone: 'error', label: 'failed', duration: 1.1, delay: 1.2 },
          { path: ['queue', 'dlq'], tone: 'error', label: 'after 5 tries', duration: 1.4, delay: 2.5 },
          { path: ['queue', 'w1', 'smtp'], tone: 'event', count: 2, duration: 1.8, delay: 0.5 },
        ],
        caption: 'The poison message is parked, and the rest keeps flowing',
      },
      code: {
        language: 'json',
        title: 'SQS redrive policy on order-emails',
        source: `{
  "VisibilityTimeout": "30",
  "RedrivePolicy": {
    "deadLetterTargetArn": "arn:aws:sqs:us-east-1:123456789012:order-emails-dlq",
    "maxReceiveCount": "5"
  }
}`,
        highlight: [4, 5],
      },
    },
    {
      title: 'Logs',
      tag: 'tradeoff',
      heading: 'A queue forgets, a log remembers',
      eli5: 'A mail bin forgets a letter once it is delivered. A **log** is a big book where every letter is written down and kept for a week. The email carriers and the analytics team each read it with their own bookmark.',
      body: [
        'A work queue says "do this job once, then forget it". An acked message is deleted. A **log** such as **Kafka** says "here is an event, anyone who cares can read it, now or next week". Events stay for the retention period, often 7 days, whether anyone read them or not.',
        'A topic is split into **partitions**. Order is guaranteed within a partition, so keying by `user_id` keeps one user\'s events in order. Each **consumer group** reads every partition and tracks its own **offset**. Inside a group, each partition goes to exactly one consumer.',
        'Here the email group and the analytics group read the same events independently. That also caps parallelism: with 3 partitions, a fourth email worker would sit idle.',
      ],
      keyIdea: 'Use a queue to hand out jobs. Use a log when several systems need the same events, in order, with the option to read them again.',
      metrics: { latency: '150 ms', depth: 'lag 0', workers: '3 + 1', rate: '2,000/s', failed: '0%' },
      scene: {
        nodes: [
          shoppers,
          api,
          { ...p0, status: 'active' },
          { ...p1, status: 'active' },
          { ...p2, status: 'active' },
          ...emailGroup('group: email'),
          { ...analytics, status: 'active', badge: 'offset 1,804,220' },
        ],
        links: kafkaLinks,
        flows: [
          { path: ['api', 'p0'], tone: 'event', label: 'key user:7', duration: 1 },
          { path: ['api', 'p1'], tone: 'event', label: 'key user:3', duration: 1, delay: 0.3 },
          { path: ['api', 'p2'], tone: 'event', label: 'key user:9', duration: 1, delay: 0.6 },
          { path: ['p0', 'w1'], tone: 'event', duration: 1, delay: 1.2 },
          { path: ['p1', 'w2'], tone: 'event', duration: 1, delay: 1.5 },
          { path: ['p2', 'w3'], tone: 'event', duration: 1, delay: 1.8 },
          { path: ['p0', 'analytics'], tone: 'event', duration: 1.6, delay: 1.2 },
          { path: ['p2', 'analytics'], tone: 'event', duration: 1.2, delay: 1.8 },
        ],
        caption: 'One topic, three partitions, two groups reading the same events',
      },
    },
    {
      title: 'Replay',
      tag: 'case',
      heading: 'Case: fix a bug by reading history again',
      eli5: 'The analytics team counted wrong all morning. The big book still has every letter, so they move their bookmark, the **offset**, back to 8 in the morning and read again. The carriers keep their own bookmark.',
      body: [
        'A deploy at 08:00 made the analytics service count every refund as a sale. By 14:00 the revenue dashboard is wrong by six hours of data.',
        'With a work queue those messages would be gone. With a log they are still there. Stop the analytics consumers, move the group\'s offset back to 08:00, deploy the fix, and let it read the six hours again.',
        'The email group never notices, because it has its own offset. Replay is safe only if the consumer is idempotent, for the same reason as before: some events will be processed twice.',
      ],
      keyIdea: 'A log keeps events after they are read, so a consumer can rewind its offset and rebuild its state after a bug.',
      metrics: { latency: '150 ms', depth: 'lag 6 h → 0', workers: '3 + 1', rate: '2,000/s', failed: '0%' },
      scene: {
        nodes: [
          shoppers,
          api,
          p0,
          p1,
          p2,
          ...emailGroup('group: email').map((w) => ({ ...w, badge: 'unaffected' })),
          { ...analytics, status: 'hot', badge: 'rewound to 08:00' },
        ],
        links: kafkaLinks,
        flows: [
          { path: ['p0', 'analytics'], tone: 'data', label: 'replay', count: 4, duration: 1.4 },
          { path: ['p1', 'analytics'], tone: 'data', count: 4, duration: 1.4, delay: 0.3 },
          { path: ['p2', 'analytics'], tone: 'data', count: 4, duration: 1.4, delay: 0.6 },
        ],
        caption: 'Analytics reads six hours again. Email keeps its own place.',
      },
      code: {
        language: 'bash',
        title: 'Rewind one consumer group',
        source: `# Consumers in the group must be stopped first
kafka-consumer-groups.sh --bootstrap-server kafka:9092 \\
  --group analytics --topic orders \\
  --reset-offsets --to-datetime 2026-11-27T08:00:00.000 \\
  --execute

# Restart analytics with the fix. Group "email" keeps its own offsets.`,
        highlight: [3, 4],
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Decouple, absorb, retry safely',
      eli5: 'The clerk drops letters in the bin, the **queue**, and customers never wait. Carriers deliver at their own speed, check the notebook to avoid doubles, and put impossible letters in the special box.',
      body: [
        'A queue between a fast producer and a slow consumer keeps user-facing latency flat and turns spikes into a backlog. Scale consumers on depth or message age, up to what the next dependency allows.',
        'Delivery is **at-least-once**: ack after the work, expect duplicates, make consumers idempotent, and park poison messages in a DLQ. Reach for a **log** like Kafka when several consumers need the same ordered events, or a way to replay them.',
      ],
      keyIdea: 'Queues trade immediacy for resilience. The price is duplicates and delay, and idempotent consumers pay most of it.',
      metrics: { latency: '150 ms', depth: '~0', workers: '3 to 5', rate: '2,000/s', failed: '0%' },
      scene: {
        nodes: [
          shoppers,
          { ...api, status: 'ok' },
          { ...queue, status: 'ok' },
          ...emailGroup('400 emails/s').map((w) => ({ ...w, status: 'ok' as const })),
          smtp,
          dedupe,
          dlq,
        ],
        links: [...queueLinks, { from: 'w3', to: 'dedupe' }, { from: 'queue', to: 'dlq', style: 'dashed' }],
        flows: [
          { path: ['shoppers', 'api', 'queue'], tone: 'event', count: 3, duration: 1.4 },
          { path: ['queue', 'w2', 'smtp'], tone: 'event', count: 2, duration: 1.8, delay: 1 },
          { path: ['w3', 'dedupe'], tone: 'request', duration: 1, delay: 1.6 },
        ],
      },
      quiz: {
        question: 'A consumer charges a credit card for each message on an at-least-once queue. What protects customers from being charged twice?',
        options: [
          'Turning on the queue\'s exactly-once mode',
          'A longer visibility timeout',
          'An idempotency key per order, checked before charging and passed to the payment provider',
          'A dead-letter queue',
        ],
        answer: 2,
        explain: 'Redelivery will happen eventually. Only the consumer can make a second delivery harmless, by recognizing the order it already charged.',
      },
    },
  ],
};
