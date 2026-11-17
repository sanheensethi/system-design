import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const shoppers: SceneNode = { id: 'shoppers', kind: 'client', at: at(-7.2, 0), label: 'shoppers' };
const api: SceneNode = { id: 'api', kind: 'block', at: at(-3.6, 0), label: 'checkout API', sub: '400 threads', icon: 'ShoppingBag', tint: 'violet' };
const mailer: SceneNode = { id: 'mailer', kind: 'block', at: at(0, 0), label: 'email service', icon: 'Mail', tint: 'amber' };
const queue: SceneNode = { id: 'queue', kind: 'queue', at: at(0, 0), label: 'order-emails', sub: 'SQS queue' };
const pool: SceneNode = { id: 'pool', kind: 'block', at: at(3.6, 0), label: 'email workers', sub: '3 workers', icon: 'Cpu', tint: 'teal' };
const smtp: SceneNode = { id: 'smtp', kind: 'internet', at: at(7.2, 0), label: 'email provider', sub: 'SMTP API' };
const w1: SceneNode = { id: 'w1', kind: 'worker', at: at(3.6, -6.2), label: 'worker 1' };
const w2: SceneNode = { id: 'w2', kind: 'worker', at: at(3.6, 0), label: 'worker 2' };
const w3: SceneNode = { id: 'w3', kind: 'worker', at: at(3.6, 6.2), label: 'worker 3' };
const dedupe: SceneNode = { id: 'dedupe', kind: 'cache', at: at(7.2, 6.2), label: 'dedupe store', sub: 'Redis' };
const dlq: SceneNode = { id: 'dlq', kind: 'queue', at: at(0, 6.6), label: 'dead letters', sub: 'order-emails-dlq' };

const mainLinks = [link('shoppers', 'api'), link('api', 'queue'), link('queue', 'pool'), link('pool', 'smtp')];

export const messageQueues: Lesson = {
  id: 'message-queues',
  title: 'Message queues (part 1)',
  tagline: 'Stop a slow email provider from taking down checkout, then learn what a queue does and does not promise.',
  minutes: 15,
  level: 'Intermediate',
  learn: [
    'Why a synchronous call chain fails under a traffic spike',
    'Producers, consumers, brokers, and how a queue absorbs a burst',
    'Queue depth, message age, and scaling consumers up to a downstream limit',
    'At-most-once, at-least-once and exactly-once delivery, acks and visibility timeouts',
    'Retries with backoff, idempotent consumers, dead-letter queues and redrive',
    'Ordering and priority queues. Part 2 covers logs, pub/sub, the outbox and back pressure.',
  ],
  metrics: [
    { key: 'latency', label: 'Checkout p99', icon: 'Timer' },
    { key: 'depth', label: 'Queue depth', icon: 'Inbox' },
    { key: 'workers', label: 'Workers', icon: 'Cpu' },
    { key: 'rate', label: 'Emails/s', icon: 'Mail' },
    { key: 'failed', label: 'Failed orders', icon: 'Bug' },
  ],
  steps: [
    {
      title: 'Spike',
      tag: 'problem',
      heading: 'Checkout waits for a receipt email',
      eli5: 'At the post office, the clerk, our **checkout API**, takes your letter and makes you stand at the counter until it is delivered across town. When delivery is slow, the line goes out the door.',
      body: [
        'Checkout saves the order, calls the email service for a receipt, and only then answers the shopper. Normally that is 150 ms of work plus 250 ms of email: **400 ms** a checkout at 200 orders a second.',
        'Black Friday brings **2,000 orders a second** and the email provider slows to 2 seconds a message. That needs over 4,000 threads. The API has 400.',
      ],
      keyIdea: 'In a synchronous chain, the slowest dependency sets the speed of everything upstream.',
      metrics: { latency: '400 ms', rate: '200/s', failed: '0%' },
      metricTones: { latency: 'warn' },
      scene: {
        nodes: [
          { ...shoppers, sub: '2,000 orders/s' },
          { ...api, status: 'hot', load: 100, chips: ['400 of 400 threads'] },
          { ...mailer, status: 'hot', badge: 'waiting' },
          { ...smtp, status: 'hot', badge: '2 s per email' },
        ],
        links: [link('shoppers', 'api'), link('api', 'mailer', { label: 'blocks until sent', labelTone: 'warn' }), link('mailer', 'smtp')],
        flows: [
          { path: ['shoppers', 'api', 'mailer', 'smtp'], tone: 'request', label: 'checkout', count: 4, duration: 2.4 },
          { path: ['smtp', 'mailer'], tone: 'response', duration: 2, delay: 2.5 },
        ],
        panel: {
          title: 'Thread math',
          icon: 'Table',
          rows: [
            { text: 'Normal day', value: '200/s × 0.4 s = 80 threads', tone: 'good' },
            { text: 'Black Friday', value: '2,000/s × 2.15 s = 4,300', tone: 'bad' },
            { text: 'API has', value: '400 threads', tone: 'warn' },
          ],
        },
        caption: 'Every checkout waits for an email to be sent',
      },
    },
    {
      title: 'Timeouts',
      tag: 'case',
      heading: 'Customers cannot pay because a receipt is slow',
      eli5: 'The line at the counter grows so long that people give up and walk out without sending their letter. The clerk was busy waiting on a delivery nobody in line cared about.',
      body: [
        'Requests wait for a thread, hit the 30 second timeout, and fail. 400 threads at 2.15 s each serve only about **186 orders a second** of 2,000, so about **90% of orders fail.**',
        'The shopper wanted to pay, not to wait for a receipt. The email sits in the request path anyway, so its slowness becomes checkout failure.',
      ],
      keyIdea: 'Work the user does not wait for should not sit in the path the user does wait for.',
      metrics: { latency: '30 s (timeouts)', rate: '~186/s served of 2,000/s', failed: '~90%' },
      metricTones: { latency: 'bad', failed: 'bad' },
      scene: {
        nodes: [
          { ...shoppers, status: 'hot', badge: '504 timeout' },
          { ...api, status: 'hot', load: 100 },
          { ...smtp, status: 'hot', badge: '2 s per email' },
        ],
        links: [link('shoppers', 'api', { label: '30 s timeout', labelTone: 'warn' }), link('api', 'smtp')],
        flows: [
          { path: ['shoppers', 'api'], tone: 'request', label: 'checkout', count: 4, duration: 1.4 },
          { path: ['api', 'shoppers'], tone: 'error', label: '504', count: 2, duration: 1.2, delay: 1.5 },
        ],
        panel: {
          title: 'Orders in the last minute',
          icon: 'Table',
          rows: [
            { text: 'Completed (400 ÷ 2.15 s = 186/s)', value: '~9 percent', tone: 'warn' },
            { text: 'Timed out at 30 s', value: '~90 percent', tone: 'bad' },
          ],
        },
        caption: 'A receipt email is costing sales',
      },
    },
    {
      title: 'Add a queue',
      tag: 'concept',
      heading: 'Put a queue between the order and the email',
      eli5: 'Now the clerk drops your letter in a mail bin, the **queue**, and says "all done!" right away. Nobody waits at the counter for delivery.',
      body: [
        'The shopper does not need the email before seeing "order confirmed". So the API writes a small message, `{order_id, email}`, to a **queue** and answers. The write takes about 2 ms.',
        'Checkout is back to **150 ms**, whatever the email provider is doing.',
      ],
      keyIdea: 'A queue turns "do it now" into "do it soon". The producer finishes in milliseconds, whatever happens downstream.',
      metrics: { latency: '150 ms', depth: '~0', workers: '3', rate: '200/s', failed: '0%' },
      metricTones: { latency: 'good', failed: 'good' },
      scene: {
        nodes: [
          { ...shoppers, sub: '200 orders/s' },
          { ...api, status: 'ok', badge: '150 ms' },
          { ...queue, status: 'active', chips: ['{order_id, email}'] },
        ],
        links: [link('shoppers', 'api'), link('api', 'queue', { label: 'write ~2 ms' })],
        flows: [
          { path: ['shoppers', 'api'], tone: 'request', label: 'checkout', duration: 1 },
          { path: ['api', 'queue'], tone: 'event', label: 'order 8812', duration: 0.9, delay: 1 },
          { path: ['api', 'shoppers'], tone: 'response', label: 'confirmed', duration: 1, delay: 1.1 },
        ],
        caption: 'Confirm first, send the email soon',
      },
    },
    {
      title: 'Roles',
      tag: 'concept',
      heading: 'Producers, consumers and the broker',
      eli5: 'The clerk who drops letters in the bin is the **producer**. The mail carriers who take them out are **consumers**. The bin and its shelves are the **broker**.',
      body: [
        'The API is a **producer**. Email workers are **consumers** that pull messages and talk to the provider at their own pace. The **broker** (here SQS) stores messages in between.',
        'The two sides are **decoupled**: either can be slow, redeployed or scaled without the other noticing.',
      ],
      keyIdea: 'Decoupling means each side can fail, slow down or change on its own schedule.',
      metrics: { latency: '150 ms', depth: '~0', workers: '3', rate: '200/s', failed: '0%' },
      metricTones: { latency: 'good' },
      scene: {
        nodes: [
          { ...api, status: 'ok' },
          { ...queue, status: 'active' },
          { ...pool, status: 'active', chips: ['pulls at its own pace'] },
          smtp,
        ],
        links: mainLinks.slice(1),
        flows: [
          { path: ['api', 'queue'], tone: 'event', label: 'produce', duration: 1 },
          { path: ['queue', 'pool'], tone: 'event', label: 'consume', duration: 1, delay: 1.1 },
          { path: ['pool', 'smtp'], tone: 'event', label: 'send receipt', duration: 1.4, delay: 2.2 },
        ],
        panel: {
          title: 'Who does what',
          icon: 'Workflow',
          rows: [
            { text: 'Producer', value: 'checkout API' },
            { text: 'Broker', value: 'SQS order-emails' },
            { text: 'Consumer', value: 'email workers' },
          ],
        },
        caption: 'Producer, broker, consumer',
      },
    },
    {
      title: 'Absorb bursts',
      tag: 'concept',
      heading: 'The queue soaks up the spike',
      eli5: 'On a busy day letters arrive faster than three carriers can deliver. The pile in the bin grows, and its size is the **queue depth**. Letters arrive a bit late, and nobody waits at the counter.',
      body: [
        'Black Friday again: 2,000 orders a second arrive and three workers send 1,200 emails a second. The 800 a second difference waits in the queue.',
        'After a five-minute spike the **queue depth** is 240,000 and the oldest message has waited about 200 seconds. Checkout is still 150 ms and no order fails.',
      ],
      keyIdea: 'A queue converts a spike into a backlog. Users feel the producer\'s speed, and the backlog drains at the consumers\' speed.',
      metrics: { latency: '150 ms', depth: '240,000', workers: '3', rate: '1,200/s', failed: '0%' },
      metricTones: { latency: 'good', depth: 'warn', failed: 'good' },
      scene: {
        nodes: [
          { ...shoppers, sub: '2,000 orders/s' },
          { ...api, status: 'ok', badge: '150 ms' },
          { ...queue, status: 'hot', badge: 'depth 240,000' },
          { ...pool, status: 'active', load: 80 },
        ],
        links: mainLinks.slice(0, 3),
        flows: [
          { path: ['shoppers', 'api', 'queue'], tone: 'event', count: 6, duration: 1.4 },
          { path: ['queue', 'pool'], tone: 'event', count: 2, duration: 1.4, delay: 0.5 },
        ],
        panel: {
          title: 'After 5 minutes',
          icon: 'Table',
          rows: [
            { text: 'In', value: '2,000/s' },
            { text: 'Out', value: '1,200/s' },
            { text: 'Backlog grows', value: '+800/s', tone: 'warn' },
            { text: 'Receipt delay', value: '~200 s', tone: 'warn' },
          ],
          footer: { text: 'Receipts are late. No order fails.', tone: 'good' },
        },
        caption: '2,000 in, 1,200 out: the backlog grows by 800 a second',
      },
    },
    {
      title: 'Queue health',
      tag: 'concept',
      heading: 'Watch depth and the age of the oldest message',
      eli5: 'A tall pile in the bin is fine on a busy morning. A pile that is still tall after the rush means the carriers are too slow, and a letter at the bottom has waited all day.',
      body: [
        'Two numbers matter on any queue: **depth** and the **age of the oldest message**. Age is what a user feels as delay.',
        'Depth that keeps growing after the spike ends means consumers are too slow for normal traffic. Alert on age, not just depth.',
      ],
      keyIdea: 'Depth says how much is waiting. Age says how long. Alert when either keeps climbing.',
      metrics: { latency: '150 ms', depth: '240,000', workers: '3', rate: '1,200/s', failed: '0%' },
      metricTones: { depth: 'warn' },
      scene: {
        nodes: [
          { ...queue, status: 'hot', badge: 'depth 240,000' },
          { id: 'monitor', kind: 'monitor', at: at(3.6, 0), label: 'alerts', sub: 'age and depth', status: 'active' },
          { ...pool, at: at(7.2, 0), status: 'dim' },
        ],
        links: [link('queue', 'monitor', { style: 'dashed' }), link('queue', 'pool', { style: 'faint' })],
        flows: [{ path: ['queue', 'monitor'], tone: 'data', label: 'metrics', duration: 1.4 }],
        panel: {
          title: 'Queue metrics',
          icon: 'Gauge',
          rows: [
            { text: 'Depth', value: '240,000', tone: 'warn' },
            { text: 'Oldest message', value: '200 s', tone: 'warn' },
            { text: 'Depth after spike ends', value: 'still rising?', tone: 'bad' },
          ],
          footer: { text: 'Rising after the spike: add consumers', tone: 'warn' },
        },
        caption: 'Age is what users feel',
      },
    },
    {
      title: 'Scale out',
      tag: 'concept',
      heading: 'Add consumers when the backlog grows',
      eli5: 'When the pile gets too big, the post office calls in two more carriers and the bin empties fast. Adding helpers is **scaling out**.',
      body: [
        'Consumers are interchangeable, so you add more. An autoscaling rule adds a worker per 50,000 waiting messages, up to five. Five workers send **2,000 emails a second**.',
        'When inflow falls back to 200 a second, five workers drain 1,800 a second faster than it arrives. The 240,000 backlog is gone in about two minutes, then the extra workers scale back in.',
      ],
      keyIdea: 'Scale consumers on depth or message age. Producers and consumers scale separately.',
      metrics: { latency: '150 ms', depth: '240,000 → 0', workers: '5', rate: '2,000/s', failed: '0%' },
      metricTones: { workers: 'good', rate: 'good' },
      scene: {
        nodes: [
          { ...api, status: 'ok' },
          { ...queue, status: 'active', badge: 'draining' },
          { ...pool, sub: '5 workers', status: 'active', badge: '+2 new', load: 70 },
          smtp,
        ],
        links: mainLinks.slice(1),
        flows: [
          { path: ['queue', 'pool'], tone: 'event', count: 4, duration: 1.2 },
          { path: ['pool', 'smtp'], tone: 'event', count: 3, duration: 1.6, delay: 0.8 },
        ],
        panel: {
          title: 'Drain time',
          icon: 'Timer',
          rows: [
            { text: 'Backlog', value: '240,000' },
            { text: 'Out minus in', value: '2,000 − 200 = 1,800/s' },
            { text: 'Time to empty', value: '~133 s', tone: 'good' },
          ],
        },
        caption: 'Five workers drain the backlog in about two minutes',
      },
    },
    {
      title: 'Ceiling',
      tag: 'tradeoff',
      heading: 'Scaling consumers moves the bottleneck',
      eli5: 'More carriers help until the town can only take so much mail at once. Extra carriers then stand at the town gate being told "too many, slow down".',
      body: [
        'The email provider accepts 2,500 emails a second. Each worker sends 400, so a seventh worker would push past the limit and only collect `429 Too Many Requests`.',
        'Scaling consumers moves the bottleneck downstream. Know where it goes next, and cap the worker count there.',
      ],
      keyIdea: 'Consumers can scale only as far as the next dependency can take.',
      metrics: { latency: '150 ms', depth: '~0', workers: '7', rate: '2,500/s (capped)', failed: '0%' },
      metricTones: { workers: 'warn', rate: 'warn' },
      scene: {
        nodes: [
          { ...queue, status: 'active' },
          { ...pool, sub: '7 workers', status: 'hot', load: 95 },
          { ...smtp, status: 'hot', badge: 'limit 2,500/s' },
        ],
        links: [link('queue', 'pool'), link('pool', 'smtp', { label: '429 Too Many Requests', labelTone: 'warn' })],
        flows: [
          { path: ['queue', 'pool', 'smtp'], tone: 'event', count: 4, duration: 1.6 },
          { path: ['smtp', 'pool'], tone: 'error', label: '429', count: 2, duration: 1.2, delay: 1.2 },
        ],
        panel: {
          title: 'Throughput by worker count',
          icon: 'Table',
          rows: [
            { text: '5 workers', value: '2,000/s', tone: 'good' },
            { text: '6 workers', value: '2,400/s', tone: 'good' },
            { text: '7 workers', value: '2,800/s wanted, 2,500 allowed', tone: 'bad' },
          ],
        },
        caption: 'The provider, not the queue, is now the limit',
      },
    },
    {
      title: 'Guarantees',
      tag: 'concept',
      heading: 'Three delivery guarantees',
      eli5: 'A carrier can promise "I will try once and not look back", "I will keep trying until you say it arrived", or "it arrives exactly once". The middle one is the one that is honest and easy to keep.',
      body: [
        '**At-most-once**: deliver and forget. Fast, and fine for metrics or best-effort telemetry, but a crash loses the message. **At-least-once**: redeliver until acknowledged. Nothing is lost, but duplicates happen.',
        '**Exactly-once** at the transport layer is almost always a marketing term. Real systems get exactly-once effects from at-least-once plus an idempotent consumer.',
      ],
      keyIdea: 'Pick at-least-once for anything that matters, then make consumers safe to run twice.',
      metrics: { latency: '150 ms', depth: '~0', workers: '5', rate: '2,000/s', failed: '0%' },
      scene: {
        nodes: [
          { ...queue, status: 'active' },
          { ...pool, sub: '5 workers' },
          { ...smtp },
        ],
        links: [link('queue', 'pool'), link('pool', 'smtp')],
        flows: [{ path: ['queue', 'pool', 'smtp'], tone: 'event', count: 2, duration: 1.8 }],
        panel: {
          title: 'Delivery semantics',
          icon: 'Scale',
          rows: [
            { text: 'At-most-once', value: 'may lose, fine for metrics', tone: 'bad' },
            { text: 'At-least-once', value: 'may duplicate', tone: 'warn' },
            { text: 'Exactly-once', value: 'idempotent consumer', tone: 'good' },
          ],
        },
        caption: 'Choose the failure you can live with',
      },
    },
    {
      title: 'Acks',
      tag: 'concept',
      heading: 'A message is gone only when a consumer says so',
      eli5: 'A carrier must come back and say "delivered!" before a letter is crossed off the list. That is an **ack**. Until then the letter stays in the bin, just hidden from other carriers.',
      body: [
        'When worker 2 receives a message, the queue hides it from everyone else for a **visibility timeout**, say 30 seconds.',
        'The worker sends the email, then **acks** by deleting the message. Only then is it gone. Set the timeout above your p99 processing time, and extend it with `ChangeMessageVisibility` for long jobs.',
      ],
      keyIdea: 'Ack after the work is done, never before.',
      metrics: { latency: '150 ms', depth: '1,200', workers: '3', rate: '1,200/s', failed: '0%' },
      scene: {
        nodes: [{ ...queue, status: 'active', badge: 'hidden 30 s' }, { ...w2, status: 'active' }, smtp],
        links: [link('queue', 'w2'), link('w2', 'smtp')],
        flows: [
          { path: ['queue', 'w2'], tone: 'event', label: 'order 8812', duration: 1.1 },
          { path: ['w2', 'smtp'], tone: 'event', label: 'send', duration: 1, delay: 1.2 },
          { path: ['w2', 'queue'], tone: 'response', label: 'ack (delete)', duration: 1.2, delay: 2.4 },
        ],
        panel: {
          title: 'Life of one message',
          icon: 'List',
          rows: [
            { text: '1. Receive', value: 'hidden 30 s' },
            { text: '2. Do the work', value: 'send email' },
            { text: '3. Ack', value: 'deleted', tone: 'good' },
          ],
        },
        caption: 'Hidden while worked on, deleted on ack',
      },
    },
    {
      title: 'Crash',
      tag: 'case',
      heading: 'A crashed worker never acks, so the message returns',
      eli5: 'Carrier 2 trips on the way and never reports back. After a while the letter reappears in the bin and carrier 3 delivers it. Nothing is lost.',
      body: [
        'If worker 2 crashes mid-message it never acks. After 30 seconds the message becomes visible again and worker 3 picks it up.',
        'Nothing is lost. This is what **at-least-once** delivery looks like in practice.',
      ],
      keyIdea: 'An unacked message is redelivered after the visibility timeout, so a crash loses no work.',
      metrics: { latency: '150 ms', depth: '1,200', workers: '2 of 3', rate: '800/s', failed: '0%' },
      metricTones: { workers: 'warn' },
      scene: {
        nodes: [
          { ...queue, status: 'active', badge: 'reappears after 30 s' },
          { ...w2, status: 'down', badge: 'crashed, no ack' },
          { ...w3, status: 'active', badge: 'retry' },
        ],
        links: [link('queue', 'w2'), link('queue', 'w3')],
        flows: [
          { path: ['queue', 'w2'], tone: 'event', label: 'order 8812', duration: 1.1 },
          { path: ['queue', 'w3'], tone: 'event', label: 'redelivered', duration: 1.4, delay: 2.4 },
        ],
        panel: {
          title: 'Visibility timeout',
          icon: 'Timer',
          rows: [
            { text: 'SQS default', value: '30 s' },
            { text: 'Shorter than the job', value: 'duplicate, no crash needed', tone: 'bad' },
            { text: 'Set above p99 run time', value: 'extend for long jobs', tone: 'good' },
          ],
        },
        caption: 'No ack in 30 s, so another worker gets it',
      },
    },
    {
      title: 'Duplicates',
      tag: 'tradeoff',
      heading: 'The price of never losing a message',
      eli5: 'If carrier 2 delivered the letter and then tripped before reporting, carrier 3 delivers it again. The neighbor gets two copies.',
      body: [
        'Suppose worker 2 sent the email, then crashed just before the ack. The message returns and the email goes out **twice**.',
        'A queue that never loses messages will sometimes deliver one more than once. You get no lost messages in exchange for occasional duplicates.',
      ],
      keyIdea: 'At-least-once means no losses and some duplicates. Consumers have to cope.',
      metrics: { latency: '150 ms', depth: '~0', workers: '3', rate: '1,200/s', failed: '0%' },
      scene: {
        nodes: [
          { ...queue, status: 'active' },
          { ...w2, status: 'down', badge: 'sent, crashed before ack' },
          { ...w3, status: 'hot', badge: 'sends it again' },
          smtp,
        ],
        links: [link('queue', 'w2'), link('queue', 'w3'), link('w2', 'smtp'), link('w3', 'smtp')],
        flows: [
          { path: ['w2', 'smtp'], tone: 'event', label: 'receipt #1', duration: 1.2 },
          { path: ['queue', 'w3', 'smtp'], tone: 'event', label: 'receipt #2', duration: 1.6, delay: 2.4 },
        ],
        panel: {
          title: 'Customer inbox',
          icon: 'Mail',
          rows: [
            { text: 'Receipt for order 8812', value: '2 copies', tone: 'bad' },
          ],
          footer: { text: 'Harmless for email, costly for charges', tone: 'warn' },
        },
        caption: 'Sent twice, because the ack never arrived',
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
      title: 'Retries',
      tag: 'concept',
      heading: 'Retry, and back off',
      eli5: 'If the town gate is closed, a carrier says "could not deliver" and tries again later. Waiting a bit longer each time, and not all at the same moment, keeps everyone from crowding the gate.',
      body: [
        'SQS has no nack. A worker fails by not deleting the message, so it reappears after the visibility timeout, or by calling `ChangeMessageVisibility`. **Nack** is the RabbitMQ and generic term.',
        'Use **exponential backoff** with jitter: 1 s, 2 s, 4 s, 8 s plus a random amount. On SQS, set the visibility timeout per receive count, because a fixed 30 s cannot do it.',
      ],
      keyIdea: 'Retry temporary failures with growing, randomized delays.',
      metrics: { latency: '150 ms', depth: '~0', workers: '3', rate: '1,200/s', failed: '0%' },
      scene: {
        nodes: [{ ...queue, status: 'active' }, { ...w1, status: 'hot', badge: 'fails' }, { ...smtp, status: 'hot', badge: '503' }],
        links: [link('queue', 'w1'), link('w1', 'smtp')],
        flows: [
          { path: ['queue', 'w1', 'smtp'], tone: 'event', duration: 1.4 },
          { path: ['smtp', 'w1'], tone: 'error', label: '503', duration: 1, delay: 1.5 },
          { path: ['w1', 'queue'], tone: 'error', label: 'fail, retry later', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'Retry schedule',
          icon: 'Repeat',
          rows: [
            { text: 'Attempt 1 fails', value: 'wait ~1 s' },
            { text: 'Attempt 2 fails', value: 'wait ~2 s' },
            { text: 'Attempt 3 fails', value: 'wait ~4 s' },
            { text: 'Attempt 4 fails', value: 'wait ~8 s' },
            { text: '503 and 429', value: 'retry', tone: 'good' },
            { text: '400, bad address', value: 'dead-letter now', tone: 'warn' },
          ],
          footer: { text: 'Plus random jitter on every wait', tone: 'muted' },
        },
        caption: 'Each retry waits longer than the last',
      },
    },
    {
      title: 'Idempotency',
      tag: 'concept',
      heading: 'Make running twice the same as running once',
      eli5: 'Before delivering, the carrier checks a notebook, the **dedupe store**, to see if this letter was already delivered. If so, they skip it. Being safe to do twice is called **idempotent**.',
      body: [
        'Since duplicates will happen, the consumer must be **idempotent**: handling a message twice has the same effect as once.',
        'Give each message an **idempotency key** that names the effect, here `receipt:{order_id}`. Before the side effect, check whether the key is done. After it, record it.',
      ],
      keyIdea: 'Key the effect, not the delivery.',
      metrics: { latency: '150 ms', depth: '~0', workers: '5', rate: '2,000/s', failed: '0%' },
      scene: {
        nodes: [
          { ...queue, status: 'active' },
          { ...w3, status: 'active', badge: 'duplicate, skip' },
          { ...dedupe, status: 'ok', badge: 'receipt:8812 = done' },
        ],
        links: [link('queue', 'w3'), link('w3', 'dedupe', { arrow: 'both' })],
        flows: [
          { path: ['queue', 'w3'], tone: 'event', label: 'order 8812 again', duration: 1.2 },
          { path: ['w3', 'dedupe'], tone: 'request', label: 'GET receipt:8812', duration: 1, delay: 1.3 },
          { path: ['dedupe', 'w3'], tone: 'response', label: 'done', duration: 1, delay: 2.4 },
          { path: ['w3', 'queue'], tone: 'response', label: 'ack, no email', duration: 1.2, delay: 3.5 },
        ],
        caption: 'The second delivery is acked without a second email',
      },
    },
    {
      title: 'Idempotent code',
      tag: 'concept',
      heading: 'An idempotent consumer in code',
      eli5: 'The carrier\'s routine is always the same: look in the notebook, deliver only if the letter is not there, write it down, then tell the post office it is done.',
      body: [
        'Claim the key atomically with `SET NX` before sending, mark it `done` after, and ack last. A plain GET then SET is a race when two copies are in flight, for example after a visibility timeout expires.',
        'If the provider supports idempotency keys, pass the key too. If a crash lands between the send and the record, that catches the repeat.',
      ],
      keyIdea: 'At-least-once delivery plus an idempotent consumer gives exactly-once effects.',
      metrics: { latency: '150 ms', depth: '~0', workers: '5', rate: '2,000/s', failed: '0%' },
      scene: {
        nodes: [{ ...queue, status: 'active' }, { ...w2, status: 'active' }, dedupe, smtp],
        links: [link('queue', 'w2'), link('w2', 'dedupe'), link('w2', 'smtp')],
        flows: [
          { path: ['queue', 'w2'], tone: 'event', duration: 1 },
          { path: ['w2', 'dedupe'], tone: 'request', label: 'check key', duration: 1, delay: 1.1 },
          { path: ['w2', 'smtp'], tone: 'event', label: 'send + key', duration: 1.4, delay: 2.2 },
        ],
        caption: 'Check, send, record, ack',
      },
      code: {
        language: 'python',
        title: 'An idempotent SQS consumer',
        source: `def handle(msg):
    order = json.loads(msg["Body"])
    key = f"receipt:{order['order_id']}"           # names the effect, not the delivery
    if redis.get(key) == b"done":
        return ack(msg)                             # duplicate: skip the side effect
    if not redis.set(key, "inflight", nx=True, ex=120):   # atomic claim, no check-then-act race
        return                                      # another worker holds it: let SQS redeliver
    send_receipt(order, idempotency_key=key)        # if the provider supports idempotency keys
    redis.set(key, "done", ex=7 * 86400)            # remember it for a week
    ack(msg)                                        # only now remove it from the queue

def ack(msg):
    sqs.delete_message(QueueUrl=QUEUE, ReceiptHandle=msg["ReceiptHandle"])

while True:
    # WaitTimeSeconds=20 is long polling: wait up to 20 s for messages, fewer empty calls
    resp = sqs.receive_message(QueueUrl=QUEUE, MaxNumberOfMessages=10,
                               WaitTimeSeconds=20, VisibilityTimeout=30)
    for msg in resp.get("Messages", []):
        handle(msg)   # an exception means no ack, so SQS redelivers in 30 s`,
        highlight: [4, 6, 8, 9, 10],
      },
    },
    {
      title: 'Dead letters',
      tag: 'case',
      heading: 'Case: the message that fails forever',
      eli5: 'One letter has a wrong address and comes back every time. After five tries the post office puts it in a special box, the **dead-letter queue**, so the carriers can get on with the other mail.',
      body: [
        'Order 9001 has a malformed email address. The provider rejects it every time, the worker throws, the message returns, and the cycle repeats. This **poison message** burns worker time and fills the logs.',
        'Set a limit: after 5 failed receives the queue moves it to a **dead-letter queue** (DLQ). Give the DLQ a longer retention than the source queue (default 4 days), or the message expires unseen.',
      ],
      keyIdea: 'Retries handle temporary failures. A dead-letter queue catches permanent ones so they stop blocking everything else.',
      metrics: { latency: '150 ms', depth: '~0', workers: '3', rate: '1,200/s', failed: '1 in DLQ' },
      metricTones: { failed: 'warn' },
      scene: {
        nodes: [{ ...queue, status: 'active', badge: 'receive #5' }, { ...w3, status: 'hot', badge: 'bad address' }, { ...dlq, status: 'hot', badge: '1 message' }],
        links: [link('queue', 'w3'), link('queue', 'dlq', { style: 'dashed', label: 'after 5 tries' })],
        flows: [
          { path: ['queue', 'w3'], tone: 'event', label: 'order 9001', duration: 1.1 },
          { path: ['w3', 'queue'], tone: 'error', label: 'failed', duration: 1.1, delay: 1.2 },
          { path: ['queue', 'dlq'], tone: 'error', label: 'parked', duration: 1.4, delay: 2.5 },
        ],
        caption: 'The poison message is parked, the rest keeps flowing',
      },
      code: {
        language: 'json',
        title: 'Queue attributes for set-queue-attributes',
        source: `{
  "VisibilityTimeout": "30",
  "RedrivePolicy": "{\\"deadLetterTargetArn\\":\\"arn:aws:sqs:us-east-1:123456789012:order-emails-dlq\\",\\"maxReceiveCount\\":\\"5\\"}"
}`,
        highlight: [3],
      },
    },
    {
      title: 'Redrive',
      tag: 'concept',
      heading: 'A DLQ only helps if someone looks at it',
      eli5: 'The special box is useless if nobody opens it. A grown-up must read the stuck letters, fix the cause, and put them back in the bin.',
      body: [
        'Alarm when the DLQ depth goes above zero. The message keeps its full payload, so you can see why it failed.',
        'Fix the cause, then **redrive**: move the messages back to the main queue. Redrive is safe only because consumers are idempotent.',
      ],
      keyIdea: 'Alert on the DLQ, fix the cause, then redrive.',
      metrics: { latency: '150 ms', depth: '~0', workers: '3', rate: '1,200/s', failed: '1 → 0' },
      scene: {
        nodes: [
          { ...dlq, status: 'hot', badge: 'alert: depth 1' },
          { ...queue, status: 'ok' },
          { id: 'monitor', kind: 'monitor', at: at(-3.6, 6.6), label: 'on-call', status: 'active' },
        ],
        links: [link('dlq', 'queue', { label: 'redrive after fix' }), link('dlq', 'monitor', { style: 'dashed' })],
        flows: [
          { path: ['dlq', 'monitor'], tone: 'error', label: 'page', duration: 1.2 },
          { path: ['dlq', 'queue'], tone: 'event', label: 'order 9001', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'DLQ routine',
          icon: 'List',
          rows: [
            { text: '1. Alert at depth > 0' },
            { text: '2. Read the payload' },
            { text: '3. Fix the cause' },
            { text: '4. Redrive to main queue', tone: 'good' },
          ],
        },
        caption: 'Park, inspect, fix, redrive',
      },
    },
    {
      title: 'Ordering',
      tag: 'tradeoff',
      heading: 'Order costs throughput',
      eli5: 'With many carriers, letters can arrive in a different order than they were posted. To keep one family\'s letters in order, one carrier must handle all of them.',
      body: [
        'With several consumers, a standard queue gives only best-effort ordering. Message 2 can finish before message 1.',
        'A **FIFO queue** keeps order per `MessageGroupId`, such as `user_id`, at lower throughput. One poison message stalls its whole group, so FIFO needs a DLQ and a low `maxReceiveCount`.',
      ],
      keyIdea: 'Strict order means less parallelism. Order only the messages that must be ordered, by key.',
      metrics: { latency: '150 ms', depth: '~0', workers: '3', rate: '300/s (FIFO cap)', failed: '0%' },
      metricTones: { rate: 'warn' },
      scene: {
        nodes: [{ ...queue, label: 'order-events', sub: 'FIFO by user_id', status: 'active' }, { ...w1, status: 'active' }, { ...w2, status: 'active' }],
        links: [link('queue', 'w1'), link('queue', 'w2')],
        flows: [
          { path: ['queue', 'w1'], tone: 'event', label: 'user 7: created', duration: 1.1 },
          { path: ['queue', 'w1'], tone: 'event', label: 'user 7: paid', duration: 1.1, delay: 1.2 },
          { path: ['queue', 'w2'], tone: 'event', label: 'user 3: created', duration: 1.1, delay: 0.5 },
        ],
        panel: {
          title: 'Ordering options',
          icon: 'Table',
          rows: [
            { text: 'Standard queue', value: 'best effort, fast' },
            { text: 'FIFO per key', value: 'ordered per user', tone: 'good' },
            { text: 'FIFO cap', value: '~300 msg/s per action, 3,000 batched', tone: 'warn' },
            { text: 'Duplicates', value: 'MessageDeduplicationId, 5 min', tone: 'muted' },
            { text: 'One consumer', value: 'global order, slow', tone: 'warn' },
          ],
        },
        caption: 'One key always goes to one worker at a time',
      },
    },
    {
      title: 'Priority',
      tag: 'concept',
      heading: 'Urgent work needs its own lane',
      eli5: 'A letter marked "urgent" should not wait behind a thousand newsletters. The post office keeps a separate bin for urgent mail and checks it first.',
      body: [
        'Password-reset emails should not sit behind 200,000 marketing emails. Many brokers have no true priority, so the usual fix is **separate queues** per priority.',
        'Give the urgent queue its own workers, or poll it first. Starving the low lane is the risk, so keep a floor of workers there.',
      ],
      keyIdea: 'Use one queue per priority, with workers reserved for the urgent lane.',
      metrics: { latency: '150 ms', depth: '200,000 bulk, 0 urgent', workers: '5', rate: '2,000/s', failed: '0%' },
      scene: {
        nodes: [
          { ...api, status: 'ok' },
          { id: 'urgent', kind: 'queue', at: at(0, -6), label: 'urgent', sub: 'password resets', status: 'ok' },
          { id: 'bulk', kind: 'queue', at: at(0, 6.6), label: 'bulk', sub: 'marketing', status: 'hot', badge: 'depth 200,000' },
          { ...pool, status: 'active' },
        ],
        links: [link('api', 'urgent'), link('api', 'bulk'), link('urgent', 'pool', { label: 'checked first' }), link('bulk', 'pool')],
        flows: [
          { path: ['api', 'urgent', 'pool'], tone: 'event', label: 'reset', duration: 1.6 },
          { path: ['api', 'bulk', 'pool'], tone: 'event', count: 3, duration: 1.8, delay: 0.6 },
        ],
        caption: 'Urgent mail skips the newsletter pile',
      },
    },
    {
      title: 'Wrong tool',
      tag: 'tradeoff',
      heading: 'When a queue is the wrong tool',
      eli5: 'If you need the answer before you leave the counter, a mail bin cannot help. And a huge parcel does not fit in the bin: you leave it in the back room and drop in a note saying where it is.',
      body: [
        'A queue is wrong when the user needs the result now, such as a card authorization. Use a direct call. Otherwise the shopper may see "confirmed" before the email exists, so the UI must accept **eventual consistency**.',
        'SQS caps a message at 256 KB. Use the **claim check** pattern: store the payload in S3 and queue only the pointer. Put a `version` field in every message so consumers survive schema changes.',
      ],
      keyIdea: 'Queue work nobody waits for. Keep big payloads out of the queue and pass a pointer.',
      metrics: { latency: '150 ms', depth: '~0', workers: '3', rate: '2,000/s', failed: '0%' },
      scene: {
        nodes: [
          { ...api, status: 'ok' },
          { id: 'blob', kind: 'storage', at: at(0, -6.2), label: 'S3 bucket', sub: 'invoice.pdf, 4 MB', status: 'active' },
          { ...queue, status: 'active', chips: ['{order_id, s3_key, v2}'] },
          { ...pool, status: 'active' },
        ],
        links: [link('api', 'blob', { label: 'payload' }), link('api', 'queue', { label: 'pointer only' }), link('queue', 'pool')],
        flows: [
          { path: ['api', 'blob'], tone: 'data', label: '4 MB', duration: 1.2 },
          { path: ['api', 'queue', 'pool'], tone: 'event', label: 's3_key', duration: 1.6, delay: 1.2 },
        ],
        panel: {
          title: 'Queue or call?',
          icon: 'Scale',
          rows: [
            { text: 'User needs the result now', value: 'direct call', tone: 'warn' },
            { text: 'Receipt can be late', value: 'queue', tone: 'good' },
            { text: 'Message over 256 KB', value: 'claim check via S3' },
            { text: 'UI after enqueue', value: 'confirmed, email coming', tone: 'muted' },
          ],
        },
        caption: 'Queue the pointer, store the parcel',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Decouple, absorb, retry safely',
      eli5: 'The clerk drops letters in the bin, the **queue**, so customers never wait. Carriers deliver at their own speed, check the notebook to avoid doubles, and put impossible letters in the special box.',
      body: [
        'A queue between a fast producer and a slow consumer keeps latency flat and turns spikes into a backlog. Scale consumers on depth or age, up to the next dependency\'s limit.',
        'Delivery is **at-least-once**: ack after the work, retry with backoff, make consumers idempotent, and park poison messages in a DLQ. Part 2 covers logs, fan-out, the outbox and back pressure.',
      ],
      keyIdea: 'Queues trade immediacy for resilience. The price is duplicates and delay, and idempotent consumers pay most of it.',
      metrics: { latency: '150 ms', depth: '~0', workers: '3 to 5', rate: '2,000/s', failed: '0%' },
      metricTones: { latency: 'good', failed: 'good' },
      scene: {
        nodes: [{ ...api, status: 'ok' }, { ...queue, status: 'ok' }, { ...pool, status: 'ok' }, { ...dlq, at: at(0, 6.6) }, smtp],
        links: [link('api', 'queue'), link('queue', 'pool'), link('pool', 'smtp'), link('queue', 'dlq', { style: 'dashed' })],
        flows: [{ path: ['api', 'queue', 'pool', 'smtp'], tone: 'event', count: 3, duration: 2.2 }],
        caption: 'Decoupled, absorbed, safe to retry',
      },
      quiz: {
        question: 'A consumer on an at-least-once queue sees the same order twice. Which design keeps the effect to one?',
        options: [
          'A longer visibility timeout',
          'Acking before doing the work',
          'An idempotency key per order, checked before the side effect',
          'A bigger dead-letter queue',
        ],
        answer: 2,
        explain: 'Duplicates cannot be ruled out. Only the consumer can make a second delivery harmless, by recognizing work it already did.',
      },
    },
  ],
};
