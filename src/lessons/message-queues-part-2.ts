import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const api: SceneNode = { id: 'api', kind: 'block', at: at(-3.6, 0), label: 'checkout API', icon: 'ShoppingBag', tint: 'violet' };
const db: SceneNode = { id: 'db', kind: 'db', at: at(-3.6, 6.6), label: 'orders DB' };
const p0: SceneNode = { id: 'p0', kind: 'queue', at: at(0, -6.2), label: 'orders · p0' };
const p1: SceneNode = { id: 'p1', kind: 'queue', at: at(0, 0), label: 'orders · p1' };
const p2: SceneNode = { id: 'p2', kind: 'queue', at: at(0, 6.2), label: 'orders · p2' };
const email: SceneNode = { id: 'email', kind: 'block', at: at(3.6, -4), label: 'email', sub: 'group: email', icon: 'Mail', tint: 'amber' };
const analytics: SceneNode = { id: 'analytics', kind: 'block', at: at(3.6, 4), label: 'analytics', sub: 'group: analytics', icon: 'TrendingUp', tint: 'blue' };
const stock: SceneNode = { id: 'stock', kind: 'block', at: at(7.2, 0), label: 'inventory', sub: 'group: stock', icon: 'Package', tint: 'green' };
const log: SceneNode = { id: 'log', kind: 'queue', at: at(0, 0), label: 'orders topic', sub: 'Kafka log' };
const topic: SceneNode = { id: 'topic', kind: 'queue', at: at(0, 0), label: 'order-placed', sub: 'pub/sub topic' };
const relay: SceneNode = { id: 'relay', kind: 'block', at: at(0, 6.6), label: 'outbox relay', icon: 'Repeat', tint: 'teal' };

export const messageQueuesPart2: Lesson = {
  id: 'message-queues-part-2',
  title: 'Message queues (part 2)',
  tagline: 'Logs that remember, fan-out to many systems, the outbox, and what to do when the queue only grows.',
  minutes: 14,
  level: 'Intermediate',
  learn: [
    'Queue versus log, partitions, consumer groups and offsets',
    'Choosing partition keys and avoiding hot partitions',
    'Replay, retention and compacted topics',
    'Pub/sub fan-out to many subscribers',
    'The dual write problem and the outbox pattern',
    'Back pressure, load shedding and how to pick a broker',
  ],
  metrics: [
    { key: 'latency', label: 'Checkout p99', icon: 'Timer' },
    { key: 'depth', label: 'Lag or depth', icon: 'Inbox' },
    { key: 'groups', label: 'Readers', icon: 'Users' },
    { key: 'rate', label: 'Events/s', icon: 'Activity' },
    { key: 'failed', label: 'Lost events', icon: 'Bug' },
  ],
  steps: [
    {
      title: 'Many readers',
      tag: 'problem',
      heading: 'Three systems want the same order event',
      eli5: 'The post office now has a letter that the delivery team, the accounting team and the toy-stock team all need to read. A bin that throws letters away after one carrier takes them cannot serve all three.',
      body: [
        'Besides email, analytics and inventory also need every order. With a work queue each message goes to one consumer, so the first to read it takes it away from the others.',
        'Copying each event by hand into three queues works, but every new reader means changing the producer.',
      ],
      keyIdea: 'A work queue hands each job to one reader. Several independent readers need something else.',
      metrics: { latency: '150 ms', depth: '~0', groups: '3 wanted', rate: '2,000/s', failed: '0' },
      scene: {
        nodes: [{ ...api, status: 'ok' }, { ...log, kind: 'queue', label: 'order-emails', sub: 'work queue', status: 'active' }, { ...email, at: at(3.6, -4) }, { ...analytics, status: 'hot', badge: 'starved' }],
        links: [link('api', 'log'), link('log', 'email'), link('log', 'analytics', { style: 'faint' })],
        flows: [{ path: ['api', 'log', 'email'], tone: 'event', label: 'order 8812', duration: 1.8 }],
        panel: {
          title: 'One message, one reader',
          icon: 'Table',
          rows: [
            { text: 'email takes it', value: 'gone', tone: 'warn' },
            { text: 'analytics sees it', value: 'never', tone: 'bad' },
          ],
        },
        caption: 'Whoever reads first, wins',
      },
    },
    {
      title: 'Logs',
      tag: 'tradeoff',
      heading: 'A queue forgets, a log remembers',
      eli5: 'A mail bin forgets a letter once it is delivered. A **log** is a big book where every letter is written down and kept for a week. Each team reads it with their own bookmark.',
      body: [
        'A work queue says "do this job once, then forget it". A **log** such as **Kafka** says "here is an event, anyone who cares can read it, now or next week".',
        'Events stay for the retention period, often 7 days, whether anyone read them or not. Reading does not remove anything.',
      ],
      keyIdea: 'Use a queue to hand out jobs. Use a log when several systems need the same events.',
      metrics: { latency: '150 ms', depth: 'lag 0', groups: '2', rate: '2,000/s', failed: '0' },
      scene: {
        nodes: [{ ...api, status: 'ok' }, { ...log, status: 'active', badge: 'kept 7 days' }, { ...email, status: 'active' }, { ...analytics, status: 'active' }],
        links: [link('api', 'log'), link('log', 'email'), link('log', 'analytics')],
        flows: [
          { path: ['api', 'log'], tone: 'event', label: 'order 8812', duration: 1 },
          { path: ['log', 'email'], tone: 'event', duration: 1, delay: 1.1 },
          { path: ['log', 'analytics'], tone: 'event', duration: 1, delay: 1.1 },
        ],
        panel: {
          title: 'Queue versus log',
          icon: 'Scale',
          rows: [
            { text: 'Work queue', value: 'do once, then forget' },
            { text: 'Log', value: 'read any time, many times', tone: 'good' },
          ],
        },
        caption: 'Two readers, one copy of each event',
      },
    },
    {
      title: 'Partitions',
      tag: 'concept',
      heading: 'A topic is split into partitions',
      eli5: 'The big book has three columns. Each family\'s letters always go in the same column, so one family\'s letters stay in order. Columns also let three readers work at once.',
      body: [
        'A **topic** is split into **partitions**. Order is guaranteed within a partition, not across them.',
        'A **partition key** such as `user_id` picks the partition, so one user\'s events stay in order. Partitions are the unit of parallelism.',
      ],
      keyIdea: 'Order lives inside one partition. Choose the key so related events share a partition.',
      metrics: { latency: '150 ms', depth: 'lag 0', groups: '2', rate: '2,000/s', failed: '0' },
      scene: {
        nodes: [{ ...api, status: 'ok' }, { ...p0, status: 'active' }, { ...p1, status: 'active' }, { ...p2, status: 'active' }],
        links: [link('api', 'p0'), link('api', 'p1'), link('api', 'p2')],
        flows: [
          { path: ['api', 'p0'], tone: 'event', label: 'key user:7', duration: 1 },
          { path: ['api', 'p1'], tone: 'event', label: 'key user:3', duration: 1, delay: 0.3 },
          { path: ['api', 'p2'], tone: 'event', label: 'key user:9', duration: 1, delay: 0.6 },
        ],
        panel: {
          title: 'hash(key) mod 3',
          icon: 'Hash',
          rows: [
            { text: 'user:7', value: 'p0' },
            { text: 'user:3', value: 'p1' },
            { text: 'user:9', value: 'p2' },
          ],
          footer: { text: 'Same key, same partition, same order', tone: 'good' },
        },
        caption: 'The key chooses the partition',
      },
    },
    {
      title: 'Consumer groups',
      tag: 'concept',
      heading: 'Each group reads everything, at its own offset',
      eli5: 'Each team keeps its own bookmark, the **offset**. Inside one team, each column of the book is read by exactly one person.',
      body: [
        'A **consumer group** reads all partitions of a topic. Inside a group, each partition goes to exactly one consumer, and the group keeps its own **offset** per partition. With 3 partitions, a 4th consumer sits idle.',
        'Commit the offset after processing, not before, or a crash loses events. When a consumer joins or dies, a **rebalance** reassigns partitions and pauses the group briefly.',
      ],
      keyIdea: 'Groups are independent readers. Partitions cap how many consumers in one group can work.',
      metrics: { latency: '150 ms', depth: 'lag 0', groups: '2', rate: '2,000/s', failed: '0' },
      scene: {
        nodes: [{ ...p0, status: 'active' }, { ...p1, status: 'active' }, { ...p2, status: 'active' }, { ...email, status: 'active', chips: ['3 consumers, 1 per partition'] }, { ...analytics, status: 'active' }],
        links: [link('p0', 'email'), link('p1', 'email'), link('p2', 'email'), link('p0', 'analytics'), link('p1', 'analytics'), link('p2', 'analytics')],
        flows: [
          { path: ['p0', 'email'], tone: 'event', duration: 1.2 },
          { path: ['p1', 'analytics'], tone: 'event', duration: 1.2, delay: 0.4 },
          { path: ['p2', 'email'], tone: 'event', duration: 1.2, delay: 0.8 },
        ],
        panel: {
          title: 'Offsets per partition',
          icon: 'Users',
          rows: [
            { text: 'email, p0', value: '1,804,220' },
            { text: 'email, p1', value: '1,790,015' },
            { text: 'email, p2', value: '1,801,340' },
            { text: 'analytics, p0', value: '1,804,190' },
            { text: 'if you add a 4th email consumer', value: 'idle', tone: 'warn' },
          ],
        },
        caption: 'Each group keeps its own place',
      },
    },
    {
      title: 'Hot partition',
      tag: 'tradeoff',
      heading: 'A bad key overloads one partition',
      eli5: 'If one huge family sends most of the mail, their column fills up while the other two columns sit empty. One reader is swamped and the rest wait.',
      body: [
        'One merchant sends 60% of the orders. Keying by `merchant_id` puts 60% of the traffic in one partition, and that consumer falls behind while the others idle.',
        'Pick a high-cardinality key such as `order_id`, or add a salt to spread a big key. You trade away ordering across that key.',
      ],
      keyIdea: 'Partition by a key with many evenly used values, or one partition becomes the bottleneck.',
      metrics: { latency: '150 ms', depth: 'lag 90,000 on p0', groups: '2', rate: '2,000/s', failed: '0' },
      metricTones: { depth: 'bad' },
      scene: {
        nodes: [{ ...p0, status: 'hot', badge: '60% of traffic' }, { ...p1, status: 'idle', badge: '20%' }, { ...p2, status: 'idle', badge: '20%' }, { ...email, load: 98, status: 'hot' }],
        links: [link('p0', 'email', { label: 'lag growing', labelTone: 'warn' })],
        flows: [{ path: ['p0', 'email'], tone: 'event', count: 5, duration: 1.4 }],
        panel: {
          title: 'Key choices',
          icon: 'Key',
          rows: [
            { text: 'merchant_id', value: 'skewed', tone: 'bad' },
            { text: 'order_id', value: 'even', tone: 'good' },
            { text: 'merchant_id + salt', value: 'spread, no order', tone: 'warn' },
          ],
        },
        caption: 'One partition does most of the work',
      },
    },
    {
      title: 'Replay',
      tag: 'case',
      heading: 'Case: fix a bug by reading history again',
      eli5: 'The analytics team counted wrong all morning. The big book still has every letter, so they move their bookmark back to 8 in the morning and read again. The other teams keep their own bookmark.',
      body: [
        'A deploy at 08:00 made analytics count every refund as a sale. By 14:00 the dashboard is wrong by six hours.',
        'With a work queue those messages would be gone. With a log, stop the group, move its offset back to 08:00, deploy the fix, and let it read the six hours again. Email never notices.',
        'Reset or recompute the analytics state for that window, or make the sink upsert by event id, or the six hours count twice. Replay only works while the events are still inside retention.',
      ],
      keyIdea: 'A log keeps events after they are read, so a consumer can rewind its offset and rebuild its state.',
      metrics: { latency: '150 ms', depth: 'lag 6 h → 0', groups: '2', rate: '2,000/s', failed: '0' },
      scene: {
        nodes: [{ ...p0, status: 'active' }, { ...p1, status: 'active' }, { ...email, badge: 'unaffected', status: 'ok' }, { ...analytics, status: 'hot', badge: 'rewound to 08:00' }],
        links: [link('p0', 'email'), link('p1', 'analytics')],
        flows: [{ path: ['p1', 'analytics'], tone: 'data', label: 'replay', count: 4, duration: 1.4 }],
        caption: 'Analytics reads six hours again. Email keeps its place.',
      },
      code: {
        language: 'bash',
        title: 'Rewind one consumer group',
        source: `# Consumers in the group must be stopped first
kafka-consumer-groups.sh --bootstrap-server kafka:9092 \\
  --group analytics --topic orders \\
  --reset-offsets --to-datetime 2026-11-27T08:00:00.000 \\
  --execute

# Also reset the analytics totals for 08:00 onward, or upsert by event id.
# Restart analytics with the fix. Group "email" keeps its own offsets.`,
        highlight: [3, 4],
      },
    },
    {
      title: 'Retention',
      tag: 'concept',
      heading: 'Retention and compacted topics',
      eli5: 'The big book cannot grow forever. The post office either tears out pages older than a week, or keeps only the latest letter for each family, like a phone book.',
      body: [
        '**Retention** is time or size based: keep 7 days, or 500 GB, or forever. Old segments are deleted whatever their readers did.',
        'A **compacted topic** keeps only the latest value per key. It acts as a changelog, so a new consumer can rebuild a table such as "current address per user" by reading it once.',
      ],
      keyIdea: 'Time retention keeps history for replay. Compaction keeps the latest state per key.',
      metrics: { latency: '150 ms', depth: 'lag 0', groups: '2', rate: '2,000/s', failed: '0' },
      scene: {
        nodes: [{ ...p0, status: 'active', label: 'orders · 7 days' }, { ...p1, label: 'profiles · compacted', status: 'active' }, { ...analytics, status: 'ok' }],
        links: [link('p0', 'analytics'), link('p1', 'analytics')],
        flows: [{ path: ['p1', 'analytics'], tone: 'data', label: 'latest per key', duration: 1.6 }],
        panel: {
          title: 'Keys in profiles',
          icon: 'Table',
          rows: [
            { text: 'user:7  addr A', value: 'dropped', tone: 'muted' },
            { text: 'user:7  addr B', value: 'kept', tone: 'good' },
            { text: 'user:3  addr C', value: 'kept', tone: 'good' },
          ],
        },
        caption: 'Compaction keeps the newest record per key',
      },
    },
    {
      title: 'Durability',
      tag: 'concept',
      heading: 'What stops a broker crash from losing events',
      eli5: 'The big book has two photocopies kept in other rooms. The clerk only says "written down!" once the copies exist, so a fire in one room loses nothing.',
      body: [
        'A log is only as durable as its copies. Use **replication factor 3** and a producer setting of `acks=all` with `min.insync.replicas=2`, so a write counts only after two brokers have it.',
        'Kafka **transactions** give exactly-once only inside Kafka. Part 1 called exactly-once a marketing term for the wider system: external side effects still need idempotent consumers.',
      ],
      keyIdea: 'Replicas plus acks=all stop a broker crash from losing events. Exactly-once stops at the edge of Kafka.',
      metrics: { latency: '150 ms', depth: 'lag 0', groups: '2', rate: '2,000/s', failed: '0' },
      metricTones: { failed: 'good' },
      scene: {
        nodes: [
          { ...api, status: 'ok' },
          { ...log, label: 'p0 leader', sub: 'broker 1', status: 'active' },
          { id: 'rep1', kind: 'queue', at: at(3.6, -4), label: 'p0 replica', sub: 'broker 2', status: 'ok' },
          { id: 'rep2', kind: 'queue', at: at(3.6, 4), label: 'p0 replica', sub: 'broker 3', status: 'ok' },
        ],
        links: [link('api', 'log', { label: 'acks=all' }), link('log', 'rep1', { label: 'copy' }), link('log', 'rep2', { label: 'copy' })],
        flows: [
          { path: ['api', 'log'], tone: 'event', label: 'order 8812', duration: 1 },
          { path: ['log', 'rep1'], tone: 'data', duration: 1, delay: 1.1 },
          { path: ['log', 'rep2'], tone: 'data', duration: 1, delay: 1.1 },
          { path: ['log', 'api'], tone: 'response', label: 'ack', duration: 1, delay: 2.3 },
        ],
        panel: {
          title: 'No-loss settings',
          icon: 'Settings',
          rows: [
            { text: 'replication.factor', value: '3', tone: 'good' },
            { text: 'producer acks', value: 'all', tone: 'good' },
            { text: 'min.insync.replicas', value: '2' },
            { text: 'Kafka transactions', value: 'exactly-once inside Kafka only', tone: 'warn' },
          ],
        },
        caption: 'Acked means two brokers have it',
      },
    },
    {
      title: 'Fan-out',
      tag: 'concept',
      heading: 'Pub/sub: publish once, deliver to many',
      eli5: 'The clerk announces "an order was placed!" once. Each team that signed up gets its own copy in its own bin, and each team empties its own bin at its own speed.',
      body: [
        'In **pub/sub** the producer publishes an event to a **topic** and knows nothing about readers. Each **subscriber** gets its own copy, often in its own queue (SNS to SQS, or Google Pub/Sub subscriptions).',
        'Adding a new subscriber changes nothing for the producer. Each subscriber has its own retries and DLQ.',
      ],
      keyIdea: 'Pub/sub decouples the producer from how many systems care.',
      metrics: { latency: '150 ms', depth: '~0', groups: '3', rate: '2,000/s', failed: '0' },
      scene: {
        nodes: [{ ...api, status: 'ok' }, { ...topic, status: 'active' }, { ...email, at: at(3.6, -4), status: 'ok', chips: ['own queue + DLQ'] }, { ...analytics, status: 'ok', chips: ['own queue + DLQ'] }, { ...stock, at: at(7.2, 0), status: 'ok' }],
        links: [link('api', 'topic'), link('topic', 'email'), link('topic', 'analytics'), link('topic', 'stock')],
        flows: [
          { path: ['api', 'topic'], tone: 'event', label: 'order placed', duration: 1 },
          { path: ['topic', 'email'], tone: 'event', duration: 1, delay: 1.1 },
          { path: ['topic', 'analytics'], tone: 'event', duration: 1, delay: 1.1 },
          { path: ['topic', 'stock'], tone: 'event', duration: 1.6, delay: 1.1 },
        ],
        caption: 'One publish, three copies',
      },
    },
    {
      title: 'Dual write',
      tag: 'problem',
      heading: 'Saving the order and publishing the event can disagree',
      eli5: 'The clerk writes the order in the ledger, then walks to the mail bin to post the notice. If the clerk faints in between, the ledger says "ordered" and nobody ever gets the notice.',
      body: [
        'Checkout writes the order to the database, then publishes `order placed` to the broker. These are two systems with no shared transaction.',
        'If the service crashes between them, the order exists but the event is lost forever. Reverse the order and you publish events for orders that never saved.',
      ],
      keyIdea: 'You cannot atomically write to a database and a broker. One of them can fail alone.',
      metrics: { latency: '150 ms', depth: '~0', groups: '3', rate: '2,000/s', failed: '1 per crash' },
      metricTones: { failed: 'bad' },
      scene: {
        nodes: [{ ...api, status: 'hot', badge: 'crash here' }, { ...db, status: 'ok', badge: 'order saved' }, { ...topic, status: 'idle', badge: 'nothing arrived' }],
        links: [link('api', 'db'), link('api', 'topic', { style: 'dashed', label: 'never sent', labelTone: 'warn' })],
        flows: [{ path: ['api', 'db'], tone: 'request', label: '1: INSERT order', duration: 1.2 }, { path: ['api', 'topic'], tone: 'error', label: '2: lost', duration: 1.2, delay: 1.6 }],
        caption: 'The order is saved and the event is gone',
      },
    },
    {
      title: 'Outbox',
      tag: 'concept',
      heading: 'The outbox pattern',
      eli5: 'The clerk writes the order and a "to be announced" note on the same page of the ledger, in one go. A helper then reads the notes and posts them, and crosses each off once posted.',
      body: [
        'Write the order and an `outbox` row in the **same database transaction**. Either both exist or neither does.',
        'A separate **relay** publishes outbox rows in order per aggregate, then deletes or archives them. It may publish twice after a crash, so consumers stay idempotent.',
      ],
      keyIdea: 'Put the event in the same transaction as the data, then publish from there.',
      metrics: { latency: '150 ms', depth: '~0', groups: '3', rate: '2,000/s', failed: '0' },
      metricTones: { failed: 'good' },
      scene: {
        nodes: [{ ...api, status: 'ok' }, { ...db, status: 'active', badge: 'orders + outbox' }, { ...relay, status: 'active' }, { ...topic, at: at(3.6, 6.6), status: 'ok' }],
        links: [link('api', 'db', { label: 'one transaction' }), link('relay', 'db', { arrow: 'both' }), link('relay', 'topic')],
        flows: [
          { path: ['api', 'db'], tone: 'request', label: 'order + event', duration: 1.2 },
          { path: ['relay', 'topic'], tone: 'event', label: 'publish', duration: 1.4, delay: 1.6 },
        ],
        panel: {
          title: 'One transaction',
          icon: 'Code',
          code: 'BEGIN;\n INSERT INTO orders ...;\n INSERT INTO outbox\n   (topic, payload) ...;\nCOMMIT;',
          footer: { text: 'Relay: poll with SKIP LOCKED, or tail the WAL (Debezium CDC)', tone: 'muted' },
        },
        caption: 'Save and announce become one atomic step',
      },
    },
    {
      title: 'Back pressure',
      tag: 'tradeoff',
      heading: 'When the queue only grows',
      eli5: 'If letters arrive faster than carriers can ever deliver, the bin overflows no matter how big it is. The clerk has to say "slow down, please" to the people in line.',
      body: [
        'If inflow stays above outflow, the backlog grows without end. The unbounded queue that reached 2.4 M messages is what motivated a bound: message age passes minutes and old messages become useless.',
        '**Back pressure** pushes the limit back to the producer. RabbitMQ has `max-length`. SQS and Kafka cannot bound depth, so the producer or API checks depth and returns `429 Retry-After`.',
      ],
      keyIdea: 'An unbounded queue only hides overload. Bound it and tell producers to slow down.',
      metrics: { latency: '150 ms', depth: '1,000,000 (at limit)', groups: '1', rate: 'in 2,000/s, out 1,200/s', failed: '0' },
      metricTones: { depth: 'warn' },
      scene: {
        nodes: [{ ...api, status: 'hot', badge: '429 Retry-After' }, { ...log, label: 'order-emails', sub: 'limit: 1 M', status: 'hot', badge: 'at limit' }, { ...email, at: at(3.6, 0), status: 'hot', load: 95 }],
        links: [link('api', 'log'), link('log', 'email')],
        flows: [{ path: ['api', 'log'], tone: 'event', count: 4, duration: 1.2 }, { path: ['log', 'api'], tone: 'error', label: 'slow down', duration: 1.2, delay: 1.4 }],
        panel: {
          title: 'Limits',
          icon: 'Gauge',
          rows: [
            { text: 'Max depth', value: '1,000,000' },
            { text: 'At limit', value: 'producer returns 429', tone: 'warn' },
            { text: 'Client', value: 'retry with backoff', tone: 'good' },
          ],
        },
        caption: 'The limit pushes back to the producer',
      },
    },
    {
      title: 'Shed load',
      tag: 'concept',
      heading: 'Drop what is least valuable',
      eli5: 'When the mail room is drowning, the post office throws out the junk mail first and keeps the bills and the urgent letters.',
      body: [
        '**Load shedding** drops low-value work on purpose when you cannot keep up. Marketing emails can be dropped or delayed. Receipts and password resets cannot.',
        'Combine it with the priority lanes from part 1: shed the bulk lane first. A message past its useful age, such as a 10 minute old "your code is 123456", can be dropped on read.',
      ],
      keyIdea: 'When you cannot do everything, choose what to drop. Do not let the queue choose by accident.',
      metrics: { latency: '150 ms', depth: '240,000 → 60,000', groups: '1', rate: '2,000/s', failed: '0 receipts' },
      scene: {
        nodes: [{ id: 'urgent', kind: 'queue', at: at(0, -6.2), label: 'urgent', status: 'ok' }, { id: 'bulk', kind: 'queue', at: at(0, 6.2), label: 'bulk', status: 'hot', badge: 'shedding' }, { ...email, at: at(3.6, 0), status: 'active' }],
        links: [link('urgent', 'email'), link('bulk', 'email', { style: 'dashed' })],
        flows: [{ path: ['urgent', 'email'], tone: 'event', label: 'reset', duration: 1.4 }, { path: ['bulk', 'email'], tone: 'error', label: 'dropped', count: 3, duration: 1.2, delay: 0.6 }],
        panel: {
          title: 'What gets dropped',
          icon: 'List',
          rows: [
            { text: 'Password reset', value: 'keep', tone: 'good' },
            { text: 'Receipt', value: 'keep', tone: 'good' },
            { text: 'Marketing', value: 'drop when late', tone: 'warn' },
          ],
        },
        caption: 'Shed the bulk lane first',
      },
    },
    {
      title: 'Choosing',
      tag: 'tradeoff',
      heading: 'Which broker for which job',
      eli5: 'A mail bin is right for handing out jobs. The big book is right when many teams need the same letters. An announcement board is right when you just want to tell everyone.',
      body: [
        'Work queues: **SQS**, **RabbitMQ**, **BullMQ** and **Sidekiq** for background jobs, retries and DLQs. Logs: **Kafka**, **Kinesis**, **Pulsar** and **Redpanda** for replay and many readers.',
        '**Google Pub/Sub** works in both modes. Start with a managed work queue. Add a log when a second team needs the same events.',
      ],
      keyIdea: 'Pick the simplest broker that covers who reads, whether you need replay, and how much order you need.',
      metrics: { latency: '150 ms', depth: '~0', groups: '3', rate: '2,000/s', failed: '0' },
      scene: {
        nodes: [{ ...api, status: 'ok' }, { id: 'wq', kind: 'queue', at: at(0, -6.2), label: 'work queue', sub: 'SQS, RabbitMQ', status: 'active' }, { id: 'lg', kind: 'queue', at: at(0, 0), label: 'log', sub: 'Kafka, Kinesis', status: 'active' }, { id: 'ps', kind: 'queue', at: at(0, 6.2), label: 'pub/sub', sub: 'SNS, Google Pub/Sub', status: 'active' }],
        links: [link('api', 'wq'), link('api', 'lg'), link('api', 'ps')],
        flows: [{ path: ['api', 'wq'], tone: 'event', duration: 1.2 }, { path: ['api', 'lg'], tone: 'event', duration: 1.2, delay: 0.3 }, { path: ['api', 'ps'], tone: 'event', duration: 1.2, delay: 0.6 }],
        panel: {
          title: 'Rule of thumb',
          icon: 'Table',
          rows: [
            { text: 'Jobs for one worker pool', value: 'work queue' },
            { text: 'Many readers, replay', value: 'log', tone: 'good' },
            { text: 'Tell everyone', value: 'pub/sub' },
          ],
        },
        caption: 'Match the tool to who reads',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Logs, fan-out and limits',
      eli5: 'The mail bin hands out jobs. The big book lets many teams read the same letters with their own bookmarks. The ledger note makes sure no announcement is lost, and a limit stops the bin from overflowing.',
      body: [
        'A **log** keeps events for many independent consumer groups, with partitions for order and parallelism, and offsets for replay. Pub/sub fans one event out to many subscribers.',
        'Use the **outbox** so saving and publishing cannot disagree. Bound queues, apply **back pressure**, and shed the least valuable work first.',
      ],
      keyIdea: 'Pick the broker by who reads and whether they replay. Bound everything, and publish through the outbox.',
      metrics: { latency: '150 ms', depth: 'lag 0', groups: '3', rate: '2,000/s', failed: '0' },
      metricTones: { latency: 'good', failed: 'good' },
      scene: {
        nodes: [{ ...api, status: 'ok' }, { ...db, status: 'ok' }, { ...relay, status: 'ok' }, { ...log, at: at(3.6, 6.6), status: 'ok' }],
        links: [link('api', 'db'), link('relay', 'db', { arrow: 'both' }), link('relay', 'log')],
        flows: [{ path: ['api', 'db'], tone: 'request', duration: 1.2 }, { path: ['relay', 'log'], tone: 'event', duration: 1.4, delay: 1.3 }],
        caption: 'Atomic save, durable log, many readers',
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
