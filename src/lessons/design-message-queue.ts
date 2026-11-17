import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

// Eli5 world: a big post office. Producers drop letters at the counter, the sorting room is the broker,
// shelves are partitions, a bookmark on a shelf is an offset, a team of mail carriers is a consumer group.
const prod: SceneNode = { id: 'prod', kind: 'service', at: at(-4.8, 0), label: 'producers', sub: 'apps and services' };
const broker: SceneNode = { id: 'broker', kind: 'block', at: at(0, 0), label: 'broker', sub: 'one machine', icon: 'Inbox', tint: 'violet' };
const cons: SceneNode = { id: 'cons', kind: 'worker', at: at(4.8, 0), label: 'consumers', sub: 'billing, search' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

export const designMessageQueue: Lesson = {
  id: 'design-message-queue',
  title: 'Design a distributed message queue (part 1)',
  tagline: 'From one overloaded queue server to a partitioned, replicated log that takes a million messages a second.',
  minutes: 15,
  level: 'Advanced',
  learn: [
    'Requirements and scale numbers for a queue at 1M messages per second',
    'The produce, fetch and commit API, and the topic, partition, segment and record data model',
    'Why a single queue server breaks, and why an append-only log fixes the storage',
    'Segments, sparse indexes and retention',
    'Partitions, keys and ordering, batching and zero-copy reads',
    'Leader and follower replication, acks and in-sync replicas',
  ],
  metrics: [
    { key: 'rate', label: 'Throughput', icon: 'Gauge' },
    { key: 'p99', label: 'Produce p99', icon: 'Timer' },
    { key: 'loss', label: 'Loss risk', icon: 'Shield' },
    { key: 'brokers', label: 'Brokers', icon: 'Server' },
  ],
  steps: [
    {
      title: 'One queue',
      tag: 'problem',
      heading: 'One queue server, one bad Friday night',
      eli5: 'A post office has one tiny sorting table. When everyone shows up at once the letters pile up, and if the table tips over, every letter on it is gone.',
      body: [
        'A growing shop sends every order, click and payment event through one queue server. Producers push, consumers pull. It worked at 500 messages a second.',
        'Friday at 20:00 the rate hits 40,000 a second. Memory fills, the server swaps, producers time out and retry, and then the process restarts. Everything that was only in RAM is gone.',
      ],
      keyIdea: 'A queue on one machine has one disk, one NIC, one memory and one failure. All four become the limit at once.',
      metrics: { rate: '40k/s', p99: '4 s', loss: 'high', brokers: '1' },
      metricTones: { rate: 'warn', p99: 'bad', loss: 'bad' },
      scene: {
        nodes: [
          { ...prod, chips: [{ text: 'retrying', tone: 'warn' }] },
          { ...broker, tint: 'gray', status: 'hot', load: 97, chips: [{ text: 'RAM only', tone: 'bad' }] },
          { ...cons, chips: [{ text: 'starved', tone: 'warn' }] },
        ],
        links: [link('prod', 'broker', { label: '40k msgs/s', labelTone: 'warn' }), link('broker', 'cons')],
        flows: [
          { path: ['prod', 'broker'], tone: 'request', label: 'send', count: 3, duration: 1.2 },
          { path: ['broker', 'prod'], tone: 'error', label: 'timeout', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Friday 20:00',
          icon: 'Activity',
          rows: [
            { text: 'Memory used', value: '98%', tone: 'bad' },
            { text: 'Producer timeouts', value: '31%', tone: 'bad' },
            { text: 'Messages in RAM', value: '1.2M', tone: 'warn' },
            { text: 'After a restart', value: '0', tone: 'bad' },
          ],
          footer: { text: 'The backlog is the data. A crash deletes it.', tone: 'bad' },
        },
        caption: 'A single in-memory queue under a spike',
      },
    },
    {
      title: 'Requirements',
      tag: 'concept',
      heading: 'What the queue must do, and what it must survive',
      eli5: 'Before building a bigger post office, write down the rules: every letter must arrive, letters from one sender stay in order, and a fire in one building must not lose any mail.',
      body: [
        '**Functional:** producers publish messages to a named **topic**. Consumers read them in order, can read the same topic in several independent groups, and can replay old messages.',
        '**Non-functional:** high throughput, low latency, **durable** once acknowledged, ordered per key, scalable by adding machines, and available through a broker or zone failure.',
      ],
      keyIdea: 'Name the guarantees first. Durability, ordering and replay decide the whole design.',
      metrics: { rate: '1M/s peak', p99: '< 20 ms', loss: 'none once acked', brokers: '?' },
      scene: {
        nodes: [
          { ...prod, status: 'active' },
          { ...broker, label: 'message queue', sub: 'to be designed', status: 'active' },
          { ...cons, status: 'active', chips: ['group: billing', 'group: search'] },
        ],
        links: [link('prod', 'broker', { label: 'publish' }), link('broker', 'cons', { label: 'read, replay' })],
        flows: [
          { path: ['prod', 'broker', 'cons'], tone: 'event', label: 'message', count: 2, duration: 2 },
        ],
        panel: {
          title: 'Requirements',
          icon: 'List',
          rows: [
            { text: 'Delivery', value: 'at least once' },
            { text: 'Order', value: 'per key' },
            { text: 'Durability', value: 'survive 1 broker', tone: 'good' },
            { text: 'Retention', value: '3 days, replay' },
            { text: 'Availability', value: '99.95%' },
          ],
          footer: { text: 'Out of scope: message transforms, a UI', tone: 'muted' },
        },
        caption: 'The contract with producers and consumers',
      },
    },
    {
      title: 'Scale numbers',
      tag: 'concept',
      heading: 'A million messages a second is a gigabyte a second',
      eli5: 'Count how many letters arrive each second, how heavy they are, and how long you keep them. That tells you how many shelves and buildings the post office needs.',
      body: [
        'Peak is 1M messages per second at about 1 KB each: **1 GB/s in**. Three consumer groups read everything, so **3 GB/s out**.',
        'Keep 3 days: 1 GB/s x 86,400 s x 3 is about 260 TB, and with 3 copies about **780 TB**. Writes with 3 replicas total 3 GB/s, about 100 MB/s of disk writes per broker across 30. The 5 GB/s of reads and replication is served mostly from page cache. Storage drives the count: about **30 brokers**, each holding around 26 TB. Treat these as estimates.',
      ],
      keyIdea: 'Storage and bandwidth, not CPU, set the size. Work out the byte rate before drawing boxes.',
      metrics: { rate: '1 GB/s in', p99: '< 20 ms', loss: 'none once acked', brokers: '~30' },
      scene: {
        nodes: [
          { ...prod, chips: ['1M msgs/s'] },
          { ...broker, label: 'cluster', sub: '~30 brokers', chips: ['1 GB/s in', '3 GB/s out'] },
          { ...cons, chips: ['3 groups'] },
        ],
        links: [link('prod', 'broker', { label: '1 GB/s' }), link('broker', 'cons', { label: '3 GB/s' })],
        panel: {
          title: 'Napkin math',
          icon: 'Table',
          rows: [
            { text: '1M msgs/s x 1 KB', value: '1 GB/s' },
            { text: 'Per day', value: '86 TB' },
            { text: '3 days retained', value: '260 TB' },
            { text: 'x 3 replicas', value: '780 TB', tone: 'warn' },
            { text: 'Brokers at 26 TB each', value: '~30', tone: 'good' },
          ],
          footer: { text: 'See the napkin math lesson for the method', tone: 'muted' },
        },
        caption: 'Bytes per second and days of retention',
      },
    },
    {
      title: 'API',
      tag: 'concept',
      heading: 'Three verbs: produce, fetch and commit',
      eli5: 'The post office counter has three jobs. Drop a letter in, take a pile of letters out starting from your bookmark, and move your bookmark forward.',
      body: [
        '`produce(topic, key, value)` appends a record and returns the **partition** and **offset** it landed at. `fetch(topic, partition, offset, maxBytes)` returns a batch starting at an offset.',
        '`commit(group, partition, offset)` records how far a consumer group has read. Admin calls create topics and change retention. Reads are pulls, so slow consumers never overload a broker.',
      ],
      keyIdea: 'A small API: append, read from an offset, remember the offset. The offset is the whole consumer contract.',
      metrics: { rate: '1M/s peak', p99: '< 20 ms', loss: 'none once acked', brokers: '~30' },
      scene: {
        nodes: [
          { ...prod, chips: ['produce(orders, k, v)'] },
          { id: 'api', kind: 'block', at: at(0, 0), label: 'queue API', sub: 'produce, fetch, commit', icon: 'Network', tint: 'violet' },
          { ...cons, chips: ['fetch(orders, 1, 4821)', 'commit(billing, 1, 4900)'] },
        ],
        links: [link('prod', 'api'), link('api', 'cons')],
        flows: [
          { path: ['prod', 'api'], tone: 'request', label: 'produce', duration: 1.2 },
          { path: ['api', 'prod'], tone: 'response', label: 'p1 @ 4821', duration: 1.2, delay: 1.3 },
          { path: ['cons', 'api'], tone: 'request', label: 'fetch from 4821', duration: 1.2, delay: 2.6 },
          { path: ['api', 'cons'], tone: 'response', label: 'batch', duration: 1.2, delay: 3.9 },
        ],
        panel: {
          title: 'Wire API',
          icon: 'Code',
          code: 'produce(topic, key, value)\n  -> { partition, offset }\nfetch(topic, partition, offset, maxBytes)\n  -> records[]\ncommit(group, partition, offset)\ncreateTopic(name, partitions, replicas)',
          footer: { text: 'Pull model: the consumer sets the pace', tone: 'muted' },
        },
        caption: 'Append, read from an offset, remember the offset',
      },
      code: {
        language: 'typescript',
        title: 'A client session',
        source: `// produce: append a record, learn where it landed
const ack = await producer.send({ topic: 'orders', key: 'order-17', value: payload });
// ack = { partition: 1, offset: 4821 }

// consume: pull a batch from a position, then commit the next offset
const batch = await consumer.poll({ group: 'billing', maxBytes: 1_048_576, waitMs: 500 });
for (const record of batch.records) await handle(record);
await consumer.commit(batch.lastOffset + 1);`,
        highlight: [2, 6, 8],
      },
    },
    {
      title: 'Data model',
      tag: 'concept',
      heading: 'Topic, partition, segment, record',
      eli5: 'A **topic** is one mail route. The route has numbered shelves, each shelf is a long row of letters in arrival order, and every letter has a number on it.',
      body: [
        'A **topic** is a named stream split into **partitions**. A partition is an ordered, append-only list of **records**. Each record gets a sequential **offset**, starting at 0, within its partition.',
        'On disk a partition is a set of **segment** files. A record holds a key, a value, a timestamp and headers. Metadata (topics, partition leaders, group offsets) lives in a small separate store.',
      ],
      keyIdea: 'The offset is the address. Topic plus partition plus offset names one record forever.',
      metrics: { rate: '1M/s peak', p99: '< 20 ms', loss: 'none once acked', brokers: '~30' },
      scene: {
        nodes: [
          { id: 'topic', kind: 'block', at: at(-5.4, 0), label: 'topic', sub: 'orders', icon: 'Layers', tint: 'violet' },
          { id: 'part', kind: 'queue', at: at(-1.8, 0), label: 'partition 1', sub: 'offsets 0 to 4821' },
          { id: 'seg', kind: 'storage', at: at(1.8, 0), label: 'segment file', sub: '1 GB each' },
          { id: 'meta', kind: 'db', at: at(5.4, 0), label: 'metadata', sub: 'leaders, offsets' },
        ],
        links: [link('topic', 'part', { label: '200 partitions' }), link('part', 'seg'), link('part', 'meta', { style: 'faint', route: 'straight' })],
        panel: {
          title: 'One record',
          icon: 'FileText',
          rows: [
            { text: 'offset', value: '4821' },
            { text: 'timestamp', value: '20:00:03.114' },
            { text: 'key', value: 'order-17' },
            { text: 'value', value: '~1 KB bytes' },
            { text: 'headers', value: 'trace-id, tries' },
          ],
          footer: { text: 'Offsets order records inside one partition only', tone: 'muted' },
        },
        caption: 'A topic is partitions, a partition is segments',
      },
    },
    {
      title: 'Simple design',
      tag: 'concept',
      heading: 'The simplest thing that works: a table on a server',
      eli5: 'Start with one clerk and one notebook. Writing a letter into the notebook is easy, and crossing it off when a carrier takes it is easy too.',
      body: [
        'One broker process takes `produce` calls and writes each message as a row in a SQL table. Consumers claim a row, process it, then mark it done or delete it.',
        'Claiming uses `FOR UPDATE SKIP LOCKED` so two consumers never take the same row. This is a good design for a few thousand jobs a second, and plenty of real systems stop here.',
      ],
      keyIdea: 'A database table is a fine queue until the write rate, the size or the failure risk outgrows one machine.',
      metrics: { rate: '2k/s', p99: '30 ms', loss: 'low', brokers: '1' },
      metricTones: { rate: 'good', p99: 'good' },
      scene: {
        nodes: [
          { ...prod, at: at(-5.4, 0) },
          { ...broker, size: 0.8, at: at(-1.8, 0), label: 'broker', sub: 'one process' },
          { id: 'table', kind: 'db', at: at(1.8, 0), label: 'queue table', sub: 'one row per msg' },
          { ...cons, at: at(5.4, 0) },
        ],
        links: [link('prod', 'broker'), link('broker', 'table'), link('table', 'cons')],
        flows: [
          { path: ['prod', 'broker', 'table'], tone: 'request', label: 'INSERT', duration: 1.8 },
          { path: ['cons', 'table'], tone: 'request', label: 'claim one row', duration: 1.4, delay: 2 },
          { path: ['table', 'cons'], tone: 'response', label: 'row', duration: 1.4, delay: 3.5 },
        ],
        panel: {
          title: 'Why it works at small scale',
          icon: 'Database',
          rows: [
            { text: 'Durable', value: 'on disk', tone: 'good' },
            { text: 'Claim is atomic', value: 'SKIP LOCKED', tone: 'good' },
            { text: 'Retries', value: 'a status column' },
          ],
          footer: { text: 'Fine up to roughly a few thousand msgs/s', tone: 'muted' },
        },
        caption: 'Rows in a table, one broker in front',
      },
      code: {
        language: 'sql',
        title: 'A queue as a table',
        source: `CREATE TABLE queue (
  id BIGSERIAL PRIMARY KEY, topic TEXT, body BYTEA,
  taken_by TEXT, taken_at TIMESTAMPTZ
);
-- a consumer claims one row without blocking the others
UPDATE queue SET taken_by = $1, taken_at = now()
WHERE id = (SELECT id FROM queue WHERE taken_by IS NULL
            ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED)
RETURNING *;`,
        highlight: [6, 8],
      },
    },
    {
      title: 'It breaks',
      tag: 'case',
      heading: 'Where the simple design breaks at 1M messages a second',
      eli5: 'Now a whole country mails through one clerk. The notebook is full, the clerk cannot write fast enough, and one sick day stops all mail.',
      body: [
        'Every message is a random-ish write plus an update and a delete, with indexes to maintain. One database handles thousands of those a second, not a million. Table bloat then slows every claim.',
        '780 TB cannot live on one machine. And one machine means one failure: the queue is down, and the backlog may be gone. We need to split the load, store sequentially and copy the data.',
      ],
      keyIdea: 'Three limits show up together: write rate, total size and a single failure point. Each gets its own fix.',
      metrics: { rate: '1M/s', p99: '4 s', loss: 'high', brokers: '1' },
      metricTones: { rate: 'bad', p99: 'bad', loss: 'bad' },
      scene: {
        nodes: [
          { ...prod, at: at(-5.4, 0), chips: [{ text: '1M msgs/s', tone: 'warn' }] },
          { ...broker, size: 0.8, at: at(-1.8, 0), tint: 'gray', status: 'hot', load: 100 },
          { id: 'table', kind: 'db', at: at(1.8, 0), label: 'queue table', sub: '3 TB and growing', status: 'hot', chips: [{ text: 'index churn', tone: 'bad' }] },
          { ...cons, at: at(5.4, 0), chips: [{ text: 'claims time out', tone: 'warn' }] },
        ],
        links: [link('prod', 'broker', { labelTone: 'warn', label: 'backlog' }), link('broker', 'table'), link('table', 'cons')],
        flows: [
          { path: ['prod', 'broker', 'table'], tone: 'error', label: 'slow', count: 3, duration: 1.8 },
        ],
        panel: {
          title: 'Three limits',
          icon: 'Gauge',
          rows: [
            { text: 'Write rate', value: '~10k/s vs 1M/s', tone: 'bad' },
            { text: 'Data size', value: '780 TB vs 1 disk', tone: 'bad' },
            { text: 'Failure', value: 'one box, one loss', tone: 'bad' },
          ],
          footer: { text: 'Fix: sequential log, partitions, replicas', tone: 'good' },
        },
        caption: 'One machine, one table, three ceilings',
      },
    },
    {
      title: 'Append-only log',
      tag: 'concept',
      heading: 'Store messages as an append-only log',
      eli5: 'Instead of moving letters around a notebook, the clerk only ever writes on the next empty line at the bottom. Writing at the end is fast, and nothing gets rearranged.',
      body: [
        'A partition becomes one file that only grows at the end. Appending is a **sequential write**, which a disk does at hundreds of MB/s. A random write on a spinning disk manages around a hundred operations a second.',
        'Writes land in the OS **page cache** and are flushed later, by design. Safety comes from `acks=all` across brokers, not an fsync per message. Tail reads are served from memory.',
      ],
      keyIdea: 'Never update in place. Append at the end, read by offset. Sequential IO is what makes a million writes a second possible.',
      metrics: { rate: '100 MB/s per broker', p99: '5 ms', loss: 'low', brokers: '1' },
      metricTones: { rate: 'good', p99: 'good' },
      scene: {
        nodes: [
          { ...prod, at: at(-5.4, 0) },
          { ...broker, size: 0.8, at: at(-1.8, 0), label: 'broker', sub: 'append only', status: 'active' },
          { id: 'pcache', kind: 'cache', at: at(1.8, 0), label: 'page cache', sub: 'RAM, OS managed' },
          { id: 'log', kind: 'storage', at: at(5.4, 0), label: 'log file', sub: 'grows at the end', chips: [{ text: '+ offset 4822', tone: 'good' }] },
        ],
        links: [link('prod', 'broker'), link('broker', 'pcache'), link('pcache', 'log', { label: 'flush later' })],
        flows: [
          { path: ['prod', 'broker', 'pcache', 'log'], tone: 'data', label: 'append', count: 3, duration: 2.4 },
        ],
        panel: {
          title: 'Disk, roughly',
          icon: 'HardDrive',
          rows: [
            { text: 'Random write, HDD', value: '~100 ops/s', tone: 'bad' },
            { text: 'Sequential write, HDD', value: '100+ MB/s', tone: 'good' },
            { text: 'Tail reads', value: 'from RAM', tone: 'good' },
          ],
          footer: { text: 'The storage engines lesson covers log-structured IO', tone: 'muted' },
        },
        caption: 'Write at the end, read by offset',
      },
      quiz: {
        question: 'Why can a log-structured broker take far more writes per second than a table-backed queue on the same disk?',
        options: [
          'It compresses every message to a single byte',
          'It appends sequentially and never updates in place',
          'It keeps every message only in RAM',
          'It skips writing to disk until the consumer asks',
        ],
        answer: 1,
        explain: 'Sequential appends avoid seeks and index maintenance. The OS page cache batches the flushes, and consumers near the tail read from memory.',
      },
    },
    {
      title: 'Segments',
      tag: 'concept',
      heading: 'Segments, a sparse index and retention',
      eli5: 'One endless scroll is hard to handle, so the clerk cuts it into numbered rolls. Old rolls get thrown away on schedule, and a card at the front of each roll says where to find a letter.',
      body: [
        'A partition is split into **segments**: when the active one reaches 1 GB it is closed and a new one starts. A segment is named by its first offset. A **sparse index** stores one entry per few KB, so a lookup jumps close and scans a little.',
        '**Retention** deletes whole old segments by age or total size, which is a cheap file delete. Very old segments can move to object storage. A topic can instead use **compaction**, which keeps only the latest record per key. It backs the consumer offsets topic and changelogs.',
      ],
      keyIdea: 'Deleting a closed segment costs nothing, and a sparse index finds any offset with one jump and a short scan.',
      metrics: { rate: '100 MB/s per broker', p99: '5 ms', loss: 'low', brokers: '1' },
      scene: {
        nodes: [
          { id: 's0', kind: 'storage', at: at(-5.4, 0), label: 'segment 0', sub: 'offsets 0 to 999k', status: 'dim', chips: [{ text: 'older than 3 days', tone: 'warn' }] },
          { id: 's1', kind: 'storage', at: at(-1.8, 0), label: 'segment 1', sub: '1M to 1.99M' },
          { id: 's2', kind: 'storage', at: at(1.8, 0), label: 'active segment', sub: '2M and growing', status: 'active' },
          { id: 'idx', kind: 'cache', at: at(5.4, 0), label: 'sparse index', sub: 'offset to byte' },
        ],
        links: [link('s0', 's1', { arrow: 'none', style: 'faint' }), link('s1', 's2', { arrow: 'none', style: 'faint' }), link('s2', 'idx', { style: 'faint' })],
        flows: [
          { path: ['idx', 's1'], tone: 'request', label: 'offset 1.5M', duration: 1.6 },
        ],
        panel: {
          title: 'Partition directory',
          icon: 'List',
          code: '00000000.log    deleted at 3 days\n00000000.index\n01000000.log    closed, 1 GB\n01000000.index\n02000000.log    active\n02000000.index',
          footer: { text: 'Retention removes whole files', tone: 'good' },
        },
        caption: 'Roll at 1 GB, delete by age',
      },
      code: {
        language: 'yaml',
        title: 'Per-topic storage settings (Kafka-style names)',
        source: `segment.bytes: 1073741824      # close the segment at 1 GB
retention.ms: 259200000        # delete segments older than 3 days
retention.bytes: -1            # no size cap per partition
index.interval.bytes: 4096     # one index entry every 4 KB
cleanup.policy: delete         # or compact: keep the latest record per key`,
        highlight: [1, 2],
      },
    },
    {
      title: 'Partitions',
      tag: 'concept',
      heading: 'Split a topic into partitions across brokers',
      eli5: 'One shelf cannot hold the whole country mail. Build 200 shelves and spread them over 30 buildings, so many clerks write at the same time.',
      body: [
        'A topic gets N partitions and each lives on one broker (its leader). Producers write to many partitions in parallel, and a consumer group reads many in parallel. That is how throughput scales out.',
        'Size N from the byte rate: at about 10 MB/s per partition, 1 GB/s needs 100 partitions. Plan **200** for headroom. The count is fixed up front, so keys map with `hash(key) % N`, not a hash ring.',
      ],
      keyIdea: 'The partition is the unit of parallelism, storage and ordering. Total throughput is partitions times per-partition rate.',
      metrics: { rate: '1 GB/s', p99: '8 ms', loss: 'low', brokers: '30' },
      metricTones: { rate: 'good' },
      scene: {
        nodes: [
          { ...prod, at: at(-5.4, 0) },
          { id: 'p0', kind: 'queue', at: at(-1.4, -4.4), label: 'partition 0', sub: 'broker 1' },
          { id: 'p1', kind: 'queue', at: at(2.2, 0), label: 'partition 1', sub: 'broker 2' },
          { id: 'p2', kind: 'queue', at: at(5.8, 4.4), label: 'partition 2', sub: 'broker 3' },
        ],
        links: [link('prod', 'p0'), link('prod', 'p1'), link('prod', 'p2')],
        flows: [
          { path: ['prod', 'p0'], tone: 'event', duration: 1.6 },
          { path: ['prod', 'p1'], tone: 'event', duration: 1.6, delay: 0.3 },
          { path: ['prod', 'p2'], tone: 'event', duration: 1.6, delay: 0.6 },
        ],
        panel: {
          title: 'Sizing partitions',
          icon: 'Split',
          rows: [
            { text: 'Target per partition', value: '10 MB/s' },
            { text: 'Needed for 1 GB/s', value: '100' },
            { text: 'Chosen (2x headroom)', value: '200', tone: 'good' },
            { text: 'Per broker (30)', value: '~7 leaders' },
          ],
          footer: { text: 'The sharding lesson covers the same idea for databases', tone: 'muted' },
        },
        caption: 'Many shelves, many clerks',
      },
    },
    {
      title: 'Keys, order',
      tag: 'concept',
      heading: 'Order holds inside a partition, so choose the key',
      eli5: 'All letters for one house go on the same shelf, so they stay in the order they came. Letters for different houses on different shelves have no order between them.',
      body: [
        'The producer picks the partition: `hash(key) % N` when there is a key, round-robin when there is not. All messages for `order-17` land on one partition and are read in the order they were written.',
        'There is no order across partitions. If a consumer needs global order the topic must have one partition, which caps throughput. Almost no design needs that. Order per entity is enough.',
      ],
      keyIdea: 'Key by the entity whose events must stay in order: user, order, account. Order is a per-partition promise.',
      metrics: { rate: '1 GB/s', p99: '8 ms', loss: 'low', brokers: '30' },
      scene: {
        nodes: [
          { ...prod, at: at(-5.4, 0), chips: ['key=order-17', 'key=order-90'] },
          { id: 'p0', kind: 'queue', at: at(-1.4, -4.4), label: 'partition 0', sub: 'hash % 200 = 0', chips: ['order-90 #1', 'order-90 #2'] },
          { id: 'p1', kind: 'queue', at: at(2.2, 0), label: 'partition 1', sub: 'hash % 200 = 1', status: 'active', chips: ['order-17 #1', 'order-17 #2', 'order-17 #3'] },
          { id: 'p2', kind: 'queue', at: at(5.8, 4.4), label: 'partition 2', sub: 'no key: round robin', status: 'dim' },
        ],
        links: [link('prod', 'p0'), link('prod', 'p1'), link('prod', 'p2', { style: 'faint' })],
        flows: [
          { path: ['prod', 'p1'], tone: 'event', label: 'order-17', count: 3, duration: 1.8 },
          { path: ['prod', 'p0'], tone: 'event', label: 'order-90', count: 2, duration: 1.8, delay: 0.5 },
        ],
        panel: {
          title: 'Choosing the partition',
          icon: 'Hash',
          code: 'partition = hash(key) % N\n  key present   -> same key, same shelf\n  key missing   -> spread evenly\n\norder-17: created, paid, shipped\n  read in exactly that order',
          footer: { text: 'No order between partitions', tone: 'warn' },
        },
        caption: 'Same key, same partition, same order',
      },
    },
    {
      title: 'Batching',
      tag: 'concept',
      heading: 'Batch, compress and copy without copying',
      eli5: 'A mail carrier takes a whole tray of letters in one trip, not one letter per trip. The truck is loaded straight from the shelf without anyone re-handling each letter.',
      body: [
        'Producers send one compressed **batch** per partition, closed when full or when `linger` ends. 1M msgs/s over 200 partitions is 5,000 per partition per second, so 5 ms of linger gives about 25 messages per batch and 40k requests a second. 50 ms gives about 250 and 4k.',
        'On reads the broker uses **zero-copy**: bytes go from the page cache to the network card without passing through application memory. Consumers fetch whole batches, so the cost per message is tiny.',
      ],
      keyIdea: 'Per-request overhead dominates small messages. Amortize it with batches, and skip copies on the read path.',
      metrics: { rate: '1 GB/s', p99: '12 ms', loss: 'low', brokers: '30' },
      scene: {
        nodes: [
          { ...prod, at: at(-5.4, 0), chips: [{ text: 'batch: ~25 msgs per partition', tone: 'good' }, 'lz4 compressed'] },
          { ...broker, size: 0.8, at: at(-1.8, 0), label: 'broker', sub: '40k requests/s' },
          { id: 'pcache', kind: 'cache', at: at(1.8, 0), label: 'page cache', sub: 'tail of the log' },
          { ...cons, at: at(5.4, 0), chips: [{ text: 'fetch: 1 MB', tone: 'good' }] },
        ],
        links: [link('prod', 'broker'), link('broker', 'pcache'), link('pcache', 'cons', { label: 'zero-copy' })],
        flows: [
          { path: ['prod', 'broker', 'pcache'], tone: 'data', label: '25 msgs', duration: 1.8 },
          { path: ['pcache', 'cons'], tone: 'response', label: 'sendfile', duration: 1.6, delay: 2 },
        ],
        panel: {
          title: 'Why batches win',
          icon: 'Package',
          rows: [
            { text: 'One request per message', value: '1M req/s', tone: 'bad' },
            { text: '5 ms linger, ~25 per batch', value: '40k req/s', tone: 'good' },
            { text: 'Compression (typical)', value: '2x to 4x smaller' },
            { text: '50 ms linger, ~250 per batch', value: '4k req/s' },
          ],
          footer: { text: 'Latency budget: 5 ms linger inside 20 ms p99', tone: 'muted' },
        },
        caption: 'Fewer, bigger, cheaper',
      },
    },
    {
      title: 'Replication',
      tag: 'concept',
      heading: 'Copy every partition to other brokers',
      eli5: 'Each shelf has two photocopies kept in other buildings. If one building burns down, a copy is already waiting, with the same letters in the same order.',
      body: [
        'Each partition has one **leader** and two **followers**, on three different brokers. Producers write to the leader, and followers pull from it, appending the same records in the same order.',
        'Consumers read from the leader by default. With replication factor 3, one broker can die and every partition still has two copies. The replication lesson covers leaders and followers in general.',
      ],
      keyIdea: 'A partition is a leader plus followers. One writer keeps the order simple, and the copies carry the durability.',
      metrics: { rate: '1 GB/s', p99: '12 ms', loss: 'survives 1 broker', brokers: '30' },
      metricTones: { loss: 'good' },
      scene: {
        nodes: [
          { ...prod, at: at(-5.4, 0) },
          { id: 'lead', kind: 'queue', at: at(-0.6, 0), label: 'partition 1', sub: 'leader, broker 2', status: 'active' },
          { id: 'f1', kind: 'replica', at: at(4.4, -3.8), label: 'follower', sub: 'broker 5' },
          { id: 'f2', kind: 'replica', at: at(4.4, 3.8), label: 'follower', sub: 'broker 9' },
        ],
        links: [link('prod', 'lead'), link('lead', 'f1', { label: 'copy' }), link('lead', 'f2', { label: 'copy' })],
        flows: [
          { path: ['prod', 'lead'], tone: 'request', label: 'produce', duration: 1.4 },
          { path: ['lead', 'f1'], tone: 'data', label: 'offset 4821', duration: 1.4, delay: 1.5 },
          { path: ['lead', 'f2'], tone: 'data', label: 'offset 4821', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Replica placement',
          icon: 'Copy',
          rows: [
            { text: 'Replication factor', value: '3' },
            { text: 'Storage cost', value: '3x, 780 TB' },
            { text: 'Followers fetch like consumers', value: 'pull' },
            { text: 'Brokers lost without data loss', value: '2 copies left', tone: 'good' },
          ],
          footer: { text: 'Never two replicas of a partition on one broker', tone: 'muted' },
        },
        caption: 'One leader, two followers, same order',
      },
    },
    {
      title: 'Acks, ISR',
      tag: 'tradeoff',
      heading: 'When is a write really safe? Acks and the in-sync set',
      eli5: 'The clerk can say "got it" right away, after the first copy is made, or only after every copy is made. A faster reply risks losing the letter. A slower one never does.',
      body: [
        'The **ISR** (in-sync replicas) is the leader plus followers that are caught up. With `acks=all` the leader answers only after every ISR member has the record. `min.insync.replicas=2` refuses writes if fewer than 2 remain. Consumers read only up to the **high watermark**, the offset every ISR member has.',
        '`acks=1` waits for the leader alone and loses data if it dies first. `acks=all` adds a few ms and survives one broker failure.',
      ],
      keyIdea: 'Durability is a dial. acks=all with min ISR 2 buys safety for a few milliseconds of latency.',
      metrics: { rate: '1 GB/s', p99: '15 ms', loss: 'none once acked', brokers: '30' },
      metricTones: { p99: 'good', loss: 'good' },
      scene: {
        nodes: [
          { ...prod, at: at(-5.4, 0), chips: [{ text: 'acks=all', tone: 'good' }] },
          { id: 'lead', kind: 'queue', at: at(-0.6, 0), label: 'partition 1', sub: 'leader', status: 'active', chips: ['ISR: leader, f1', 'high watermark: 4821'] },
          { id: 'f1', kind: 'replica', at: at(4.4, -3.8), label: 'follower 1', sub: 'in sync', status: 'ok' },
          { id: 'f2', kind: 'replica', at: at(4.4, 3.8), label: 'follower 2', sub: 'lagging', status: 'dim', badge: 'out of ISR' },
        ],
        links: [link('prod', 'lead'), link('lead', 'f1'), link('lead', 'f2', { style: 'dashed' })],
        flows: [
          { path: ['prod', 'lead'], tone: 'request', label: 'produce', duration: 1.2 },
          { path: ['lead', 'f1'], tone: 'data', duration: 1.2, delay: 1.3 },
          { path: ['f1', 'lead', 'prod'], tone: 'response', label: 'ack', duration: 1.8, delay: 2.6 },
        ],
        panel: {
          title: 'What each setting risks',
          icon: 'Shield',
          rows: [
            { text: 'acks=0', value: 'lost if broker drops it', tone: 'bad' },
            { text: 'acks=1', value: 'lost if leader dies', tone: 'warn' },
            { text: 'acks=all, min ISR 2', value: 'survives 1 failure', tone: 'good' },
            { text: 'High watermark', value: 'consumers see only fully copied records' },
          ],
          footer: { text: 'A slow follower leaves the ISR instead of stalling writes', tone: 'muted' },
        },
        caption: 'Wait for the in-sync copies, ignore the laggard',
      },
      code: {
        language: 'yaml',
        title: 'Durable producer and topic settings',
        source: `producer:
  acks: all
  retries: 2147483647
  delivery.timeout.ms: 30000
topic:
  replication.factor: 3
  min.insync.replicas: 2      # with 3 copies, 1 may be down`,
        highlight: [2, 7],
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Part 1 recap: a log, split and copied',
      eli5: 'The big post office writes letters only at the end of numbered shelves, spreads 200 shelves over 30 buildings, keeps photocopies in other buildings, and says "got it" only after the copies exist.',
      body: [
        'The simple table-backed queue broke on write rate, size and a single point of failure. We stored messages as an **append-only log** in **segments**, split topics into **partitions**, ordered by **key**, and cut per-message cost with **batches** and **zero-copy**.',
        'Each partition has a **leader** and followers, and `acks=all` with a minimum ISR makes an acknowledged write safe. Part 2 covers consumers, delivery guarantees, the control plane and failures.',
      ],
      keyIdea: 'Throughput comes from sequential logs and partitions. Durability comes from replicas and acks.',
      metrics: { rate: '1 GB/s', p99: '15 ms', loss: 'none once acked', brokers: '30' },
      metricTones: { rate: 'good', p99: 'good', loss: 'good' },
      scene: {
        nodes: [
          { ...prod, at: at(-5.4, 0), chips: ['batch, acks=all'] },
          { id: 'p', kind: 'block', size: 0.8, at: at(-1.8, 0), label: 'partitions', sub: '200, keyed', icon: 'Split', tint: 'violet' },
          { id: 'log', kind: 'storage', at: at(1.8, 0), label: 'log segments', sub: '3 days' },
          { id: 'rep', kind: 'replica', at: at(5.4, 0), label: 'replicas', sub: 'x3, ISR 2' },
        ],
        links: [link('prod', 'p'), link('p', 'log'), link('log', 'rep', { label: 'copy' })],
        flows: [
          { path: ['prod', 'p', 'log', 'rep'], tone: 'event', label: 'record', count: 2, duration: 2.6 },
        ],
        panel: {
          title: 'Part 1 checklist',
          icon: 'List',
          rows: [
            { text: 'Append-only segments', value: 'fast writes', tone: 'good' },
            { text: 'Partitions + keys', value: 'scale, order', tone: 'good' },
            { text: 'Batch + zero-copy', value: 'cheap per message', tone: 'good' },
            { text: 'Replicas + acks', value: 'durable', tone: 'good' },
            { text: 'Consumers, failures', value: 'part 2', tone: 'muted' },
          ],
        },
        caption: 'Write path done: fast, ordered per key, durable',
      },
      quiz: {
        question: 'A producer uses acks=all, replication factor 3 and min.insync.replicas=2. One follower falls far behind and leaves the ISR. What happens to writes?',
        options: [
          'Writes stop until the follower catches up',
          'Writes continue, acknowledged by the leader and the other follower',
          'Writes continue but are acknowledged by the leader alone',
          'The leader switches to acks=0 automatically',
        ],
        answer: 1,
        explain: 'The ISR is now the leader plus one follower, which still meets the minimum of 2. Writes keep flowing with two copies. If a second replica dropped out, writes would be refused.',
      },
    },
  ],
};
