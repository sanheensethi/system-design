import type { Lesson, SceneNode } from '../engine/types';

const client: SceneNode = { id: 'client', kind: 'client', at: [-7, -3], label: 'checkout', sub: '20K orders/s peak' };
const app: SceneNode = { id: 'app', kind: 'server', at: [-2.5, -0.5], label: 'order API' };
const shard1: SceneNode = { id: 'shard1', kind: 'shard', at: [1.5, 3], label: 'orders shard 1', sub: 'AUTO_INCREMENT' };
const shard2: SceneNode = { id: 'shard2', kind: 'shard', at: [3, -1.5], label: 'orders shard 2', sub: 'AUTO_INCREMENT' };
const ticket: SceneNode = { id: 'ticket', kind: 'db', at: [-1, -4.5], label: 'ticket server', sub: 'one counter' };
const ticket2: SceneNode = { id: 'ticket2', kind: 'db', at: [1.5, -5.5], label: 'ticket server 2', sub: 'even numbers' };

const n1: SceneNode = { id: 'n1', kind: 'service', at: [-3.8, 0.4], label: 'node 1', sub: 'machine ID 1' };
const n2: SceneNode = { id: 'n2', kind: 'service', at: [-2.7, -0.7], label: 'node 2', sub: 'machine ID 2' };
const n3: SceneNode = { id: 'n3', kind: 'service', at: [-1.6, -1.8], label: 'node 3', sub: 'machine ID 3' };

const shardLinks = [
  { from: 'client', to: 'app' },
  { from: 'app', to: 'shard1' },
  { from: 'app', to: 'shard2' },
];

export const uniqueIds: Lesson = {
  id: 'unique-ids',
  title: 'Unique ID generation',
  tagline: 'Hand out billions of IDs across many machines without two ever matching, and keep them small and sortable.',
  minutes: 14,
  level: 'Intermediate',
  learn: [
    'Why auto-increment collides once a table is sharded',
    'UUID v4 and v7: random versus time-ordered 128-bit IDs',
    'Ticket servers and handing out ID ranges in batches',
    'The Snowflake layout: timestamp, machine and sequence bits',
    'Clock skew, sortability, and how to choose a scheme',
  ],
  metrics: [
    { key: 'size', label: 'ID size' },
    { key: 'sorted', label: 'Time sortable' },
    { key: 'coord', label: 'Coordination' },
    { key: 'rate', label: 'Max rate' },
  ],
  steps: [
    {
      title: 'Collision',
      tag: 'problem',
      heading: 'Two shards both created order 1001',
      eli5: 'A deli has two counters, each with its own roll of number tickets starting at 1. Two customers end up holding ticket 1001, and the kitchen cannot tell whose sandwich is whose.',
      body: [
        'The orders table outgrew one machine and was split into two shards by customer. Each shard kept its `AUTO_INCREMENT` primary key. Each counter is unique only inside its own database.',
        'Within an hour both shards have issued order **1001**. Support looks up "order 1001" and finds two. A payment event that says "order 1001 paid" can mark the wrong one. Merging both shards into the analytics warehouse fails on duplicate keys.',
        'We need IDs that are unique across every machine, fit in a `BIGINT` index, and do not need a network call to a single counter for every insert. Ideally they also sort by creation time.',
      ],
      keyIdea: 'An auto-increment counter is unique only inside one database. Shard the table and the counters collide.',
      metrics: { size: '64 bits', sorted: 'per shard', coord: 'none (broken)', rate: '-' },
      scene: {
        nodes: [client, { ...app, status: 'active' }, { ...shard1, status: 'hot', badge: 'order 1001' }, { ...shard2, status: 'hot', badge: 'order 1001' }],
        links: shardLinks,
        flows: [
          { path: ['client', 'app'], tone: 'request', label: 'place order', count: 3, duration: 1 },
          { path: ['app', 'shard1'], tone: 'request', label: 'INSERT', duration: 1, delay: 1.1 },
          { path: ['app', 'shard2'], tone: 'request', label: 'INSERT', duration: 1, delay: 1.1 },
          { path: ['shard1', 'app'], tone: 'error', label: 'id 1001', duration: 1, delay: 2.2 },
          { path: ['shard2', 'app'], tone: 'error', label: 'id 1001', duration: 1, delay: 2.2 },
        ],
        caption: 'Two counters, one number',
      },
    },
    {
      title: 'Offsets',
      tag: 'concept',
      heading: 'Quick patch: step the counters apart',
      eli5: 'The deli gives counter one only odd tickets and counter two only even tickets. They can never print the same number, until a third counter opens.',
      body: [
        'MySQL can step each counter by the number of shards: shard 1 issues 1, 3, 5 and shard 2 issues 2, 4, 6. No two shards can produce the same value.',
        'It works and it is brittle. Adding a third shard means changing the step everywhere and making sure new values never overlap old ones. IDs carry no creation time, and order across shards is meaningless. Every insert still needs the database to assign the ID, so the app cannot know it before the write.',
        'Fine for two fixed databases. Not a plan for a fleet that grows.',
      ],
      keyIdea: 'Counter offsets avoid collisions for a fixed number of databases, and become a migration every time that number changes.',
      metrics: { size: '64 bits', sorted: 'no', coord: 'fixed shard count', rate: 'per DB' },
      scene: {
        nodes: [client, app, { ...shard1, status: 'ok', sub: 'offset 1, step 2', badge: '1, 3, 5' }, { ...shard2, status: 'ok', sub: 'offset 2, step 2', badge: '2, 4, 6' }],
        links: shardLinks,
        flows: [
          { path: ['app', 'shard1'], tone: 'request', duration: 1 },
          { path: ['app', 'shard2'], tone: 'request', duration: 1 },
          { path: ['shard1', 'app'], tone: 'response', label: '1003', duration: 1, delay: 1.1 },
          { path: ['shard2', 'app'], tone: 'response', label: '1004', duration: 1, delay: 1.1 },
        ],
        caption: 'Odd and even never meet',
      },
      code: {
        language: 'sql',
        title: 'MySQL: interleaved counters on two shards',
        source: `-- on shard 1
SET GLOBAL auto_increment_increment = 2;  -- step
SET GLOBAL auto_increment_offset    = 1;  -- 1, 3, 5, ...

-- on shard 2
SET GLOBAL auto_increment_increment = 2;
SET GLOBAL auto_increment_offset    = 2;  -- 2, 4, 6, ...

-- a third shard means a new step on every server
-- and care that new values skip the ones already used`,
        highlight: [2, 3, 7, 9],
      },
    },
    {
      title: 'UUID v4',
      tag: 'concept',
      heading: 'UUID v4: so random it never repeats',
      eli5: 'Each counter prints tickets with a long string of random letters. The chance that two match is so tiny it never happens, but the tickets are long and in no order at all.',
      body: [
        'A **UUID v4** is 128 bits, of which 122 are random. Any machine can generate one locally with no coordination. You would need to generate around a billion per second for decades before a collision became likely, so in practice it does not happen.',
        'The costs show up in the database. At 16 bytes it is twice the size of a `BIGINT`, and every secondary index stores a copy of the primary key. Worse, the values are random, so each insert lands on a random page of the B-tree index. The storage engines lesson showed what that means: scattered page writes, more page splits, and a working set that no longer fits in RAM.',
        'They also say nothing about time, and `3f2a9c1e-...` is clumsy in a URL or on a support call.',
      ],
      keyIdea: 'UUID v4 removes coordination entirely and pays with size and random inserts that hurt B-tree indexes.',
      metrics: { size: '128 bits', sorted: 'no', coord: 'none', rate: 'unlimited' },
      scene: {
        nodes: [client, { ...app, badge: 'uuid4()' }, { ...shard1, sub: 'B-tree on id', status: 'hot', badge: 'random page' }, { ...shard2, sub: 'B-tree on id', status: 'hot', badge: 'random page' }],
        links: shardLinks,
        flows: [
          { path: ['client', 'app'], tone: 'request', duration: 1 },
          { path: ['app', 'shard1'], tone: 'request', label: '3f2a9c1e-...', duration: 1.1, delay: 1.1 },
          { path: ['app', 'shard2'], tone: 'request', label: 'a7710b4d-...', duration: 1.1, delay: 1.1 },
        ],
        caption: 'Unique anywhere, ordered nowhere',
      },
    },
    {
      title: 'UUID v7',
      tag: 'concept',
      heading: 'UUID v7: put the time first',
      eli5: 'Now each long ticket starts with the time it was printed, then the random letters. Sorting tickets by their text also sorts them by when they were printed.',
      body: [
        '**UUID v7**, standardized in RFC 9562 (2024), keeps the 128-bit format but fills the first 48 bits with the Unix time in milliseconds. Most of the rest is random.',
        'Because the time comes first, new IDs are larger than old ones. Inserts land at the right edge of the index, like auto-increment, and the hot pages stay in memory. You can sort by ID to get creation order and range-scan by time.',
        'It is still 16 bytes, and it reveals roughly when a record was created. For many teams it is the default choice today: no coordination, decent index behavior, and library support in most languages.',
      ],
      keyIdea: 'UUID v7 keeps UUIDs coordination-free and makes them time-ordered, which fixes most of the index pain.',
      metrics: { size: '128 bits', sorted: 'by ms', coord: 'none', rate: 'unlimited' },
      scene: {
        nodes: [client, { ...app, badge: 'uuid7()' }, { ...shard1, sub: 'B-tree on id', status: 'ok', badge: 'append at right edge' }, { ...shard2, sub: 'B-tree on id', status: 'ok', badge: 'append at right edge' }],
        links: shardLinks,
        flows: [
          { path: ['client', 'app'], tone: 'request', duration: 1 },
          { path: ['app', 'shard1'], tone: 'request', label: '0192f3a1-...', duration: 1.1, delay: 1.1 },
          { path: ['app', 'shard2'], tone: 'request', label: '0192f3a2-...', duration: 1.1, delay: 1.1 },
        ],
        caption: 'Timestamp prefix, random tail',
      },
    },
    {
      title: 'Ticket server',
      tag: 'concept',
      heading: 'Ticket server: one counter for everyone',
      eli5: 'The deli puts a single ticket machine by the door that serves every counter. Numbers are short and in order, but if that machine jams, nobody gets served.',
      body: [
        'Another option keeps IDs as small 64-bit numbers: a dedicated **ticket server**, a tiny database whose only job is an auto-increment counter. Every app server asks it for the next ID.',
        'It gives compact, nearly ordered numbers, and it is easy to run. It is also a single point of failure and a network hop on every insert. A common fix is two ticket servers, one issuing odd and one even numbers, with clients alternating between them. Order across the two is then only approximate.',
        'The bigger win is **batching**: ask for a block of 1,000 IDs at once and hand them out from memory. One round trip per thousand orders, and the server can be down briefly without anyone noticing. A crashed app server simply wastes the rest of its block, which leaves gaps.',
      ],
      keyIdea: 'A central counter gives short ordered IDs. Batching ranges hides its latency, and a second server hides most of its failures.',
      metrics: { size: '64 bits', sorted: 'roughly', coord: '1 call per 1,000 IDs', rate: 'high with batches' },
      scene: {
        nodes: [client, { ...app, status: 'active', badge: 'block 41,000 to 41,999' }, shard1, shard2, { ...ticket, status: 'active', badge: 'next block: 42,000' }, { ...ticket2, status: 'dim' }],
        links: [...shardLinks, { from: 'app', to: 'ticket' }, { from: 'app', to: 'ticket2', style: 'faint' }],
        flows: [
          { path: ['app', 'ticket'], tone: 'request', label: 'give me 1,000', duration: 1 },
          { path: ['ticket', 'app'], tone: 'response', label: '41,000 to 41,999', duration: 1, delay: 1.1 },
          { path: ['app', 'shard1'], tone: 'request', label: 'id 41,000', duration: 1, delay: 2.3 },
          { path: ['app', 'shard2'], tone: 'request', label: 'id 41,001', duration: 1, delay: 2.6 },
        ],
        caption: 'One round trip per thousand IDs',
      },
    },
    {
      title: 'Snowflake',
      tag: 'concept',
      heading: 'Snowflake: build the ID from time, machine and a counter',
      eli5: 'Each counter prints tickets reading "time, counter number, then 1, 2, 3 within that second". Two counters can never print the same ticket, and nobody has to ask the door machine.',
      body: [
        'A **Snowflake ID** packs three fields into one 64-bit integer, generated locally on each machine. The top bit stays 0 so the number is positive. The next **41 bits** hold milliseconds since a custom epoch, enough for about 69 years. Then **10 bits** of machine ID (1,024 generators) and **12 bits** of sequence (4,096 IDs per millisecond per machine).',
        'Two machines never collide because their machine IDs differ. One machine never collides with itself because the sequence counts up within a millisecond and resets when the millisecond changes. Each generator can issue about **4 million IDs per second** with no network call.',
        'The bit split is a design choice. Fewer machine bits and more sequence bits suit a few very busy generators. Some variants add a datacenter field. The fixed part is the order: time first, so IDs sort by creation.',
      ],
      keyIdea: 'Snowflake gets uniqueness from the machine ID and the sequence, and ordering from putting the timestamp in the high bits.',
      metrics: { size: '64 bits', sorted: 'by ms', coord: 'machine IDs only', rate: '4M/s per node' },
      scene: {
        nodes: [client, { ...n1, status: 'active', badge: 't | 1 | 0' }, { ...n2, status: 'active', badge: 't | 2 | 0' }, { ...n3, status: 'active', badge: 't | 3 | 0' }, shard1, shard2],
        links: [
          { from: 'client', to: 'n2' },
          { from: 'n1', to: 'shard1' },
          { from: 'n2', to: 'shard1' },
          { from: 'n3', to: 'shard2' },
        ],
        flows: [
          { path: ['client', 'n2'], tone: 'request', count: 3, duration: 1 },
          { path: ['n1', 'shard1'], tone: 'request', label: 'id from node 1', duration: 1.2, delay: 1 },
          { path: ['n2', 'shard1'], tone: 'request', label: 'id from node 2', duration: 1.2, delay: 1.2 },
          { path: ['n3', 'shard2'], tone: 'request', label: 'id from node 3', duration: 1.2, delay: 1.4 },
        ],
        caption: '41 bits time, 10 bits machine, 12 bits sequence',
      },
      code: {
        language: 'python',
        title: 'A Snowflake generator',
        source: `import threading, time

EPOCH_MS = 1_704_067_200_000            # 2024-01-01, our custom epoch

class Snowflake:
    def __init__(self, machine_id):
        assert 0 <= machine_id < 1024    # 10 bits
        self.machine_id = machine_id
        self.last_ms, self.seq = -1, 0
        self.lock = threading.Lock()

    def next_id(self):
        with self.lock:
            now = int(time.time() * 1000)
            if now < self.last_ms:                   # clock went backwards
                raise RuntimeError("clock moved back, refusing to issue IDs")
            if now == self.last_ms:
                self.seq = (self.seq + 1) & 0xFFF    # 12 bits
                if self.seq == 0:                    # 4,096 used this ms
                    while now <= self.last_ms:
                        now = int(time.time() * 1000)
            else:
                self.seq = 0
            self.last_ms = now
            return ((now - EPOCH_MS) << 22) | (self.machine_id << 12) | self.seq`,
        highlight: [15, 16, 18, 19, 25],
      },
      quiz: {
        question: 'With 12 sequence bits, what is the most IDs one Snowflake generator can issue in one millisecond?',
        options: ['1,024', '4,096', '65,536', 'Unlimited'],
        answer: 1,
        explain: '2 to the 12th is 4,096. The 4,097th request in the same millisecond waits for the clock to tick, which caps one generator at about 4 million IDs per second.',
      },
    },
    {
      title: 'Machine IDs',
      tag: 'tradeoff',
      heading: 'Who hands out the machine IDs?',
      eli5: 'Every counter needs its own counter number painted on it. If two counters get painted with the same number, they will print matching tickets.',
      body: [
        'Snowflake pushes all coordination into one place: no two live generators may share a machine ID. Get that wrong and duplicates come back, silently.',
        'Static config works for a fixed fleet. With autoscaling or containers, generators usually claim an ID at startup from a coordination service (etcd or ZooKeeper) with a lease, and give it up when they stop. If a node loses its lease, it must stop issuing IDs before another node can take the same number.',
        'The ID also leaks information. Anyone can read the creation time from it, and sequential-looking IDs let outsiders estimate your order volume. If that matters, expose a separate opaque ID in public URLs.',
      ],
      keyIdea: 'Snowflake is only as unique as its machine ID assignment. Lease the IDs, and stop issuing when the lease is lost.',
      metrics: { size: '64 bits', sorted: 'by ms', coord: 'lease at startup', rate: '4M/s per node' },
      scene: {
        nodes: [client, { ...n1, status: 'ok' }, { ...n2, status: 'ok' }, { ...n3, status: 'active', badge: 'claims ID 3' }, { ...ticket, kind: 'monitor', label: 'etcd', sub: 'machine ID leases', status: 'active', badge: '3 of 1,024 taken' }],
        links: [
          { from: 'client', to: 'n2' },
          { from: 'n1', to: 'ticket', style: 'faint' },
          { from: 'n2', to: 'ticket', style: 'faint' },
          { from: 'n3', to: 'ticket' },
        ],
        flows: [
          { path: ['n3', 'ticket'], tone: 'handshake', label: 'lease a machine ID', duration: 1.1 },
          { path: ['ticket', 'n3'], tone: 'response', label: 'ID 3, 30 s lease', duration: 1.1, delay: 1.2 },
          { path: ['n1', 'ticket'], tone: 'handshake', label: 'renew', duration: 1, delay: 2.5 },
        ],
        caption: 'Coordinate once at startup, never per ID',
      },
    },
    {
      title: 'Clock skew',
      tag: 'case',
      heading: 'Case: the clock jumps back 40 ms',
      eli5: 'The clock on one counter is fixed and set back a little. If the counter keeps printing, it can print a time it already used, with the same numbers as before.',
      body: [
        'Node 2\'s clock has drifted ahead. A time sync **steps** it back 40 ms. For the next 40 ms, the generator sees timestamps it has already used, and its sequence restarts at 0. It would print IDs it already issued. Those are duplicate primary keys, or worse, two orders with the same ID on different shards.',
        'The generator must remember the last timestamp it used and never go below it. If the clock moves back a little, wait until it passes the last value. If it moves back a lot, refuse to issue IDs and raise an alarm. Running the time daemon in a mode that slews (slows the clock gradually) avoids most steps.',
        'Skew between machines is a softer problem. IDs from node 1 and node 2 are ordered only to within their clock difference. Snowflake IDs are **roughly sorted** (k-sorted), not a strict global order.',
      ],
      keyIdea: 'A time-based ID generator must never reuse a timestamp. Wait out small backward jumps and stop on large ones.',
      metrics: { size: '64 bits', sorted: 'within clock skew', coord: 'lease at startup', rate: '0 while waiting' },
      scene: {
        nodes: [client, n1, { ...n2, status: 'hot', badge: 'clock -40 ms: waiting' }, n3, { ...shard1, status: 'ok', badge: 'no duplicates' }, shard2],
        links: [
          { from: 'client', to: 'n2' },
          { from: 'n1', to: 'shard1' },
          { from: 'n2', to: 'shard1' },
          { from: 'n3', to: 'shard2' },
        ],
        flows: [
          { path: ['client', 'n2'], tone: 'request', label: 'place order', duration: 1 },
          { path: ['n2', 'shard1'], tone: 'error', label: 'reuse t = 1005?', duration: 1.2, delay: 1.1 },
          { path: ['n2', 'shard1'], tone: 'request', label: 'after t > 1005', duration: 1.2, delay: 3 },
        ],
        caption: 'Better to pause 40 ms than issue a duplicate',
      },
    },
    {
      title: 'Choosing',
      tag: 'tradeoff',
      heading: 'Choosing an ID scheme',
      eli5: 'A small deli is fine with one ticket roll. A busy chain with many counters prints the time and counter number on each ticket, or uses long random tickets when nobody cares about order.',
      body: [
        '**Single database**: keep auto-increment. It is compact and ordered, and the problem in this lesson does not exist yet. **UUID v4**: when any service, including offline clients, must mint IDs and order does not matter. **UUID v7**: the same freedom, plus time order that keeps B-tree indexes healthy.',
        '**Ticket server with batches**: when you need short 64-bit numbers and can run one more small, replicated service. **Snowflake**: high volume, 64-bit columns, time order, no per-ID network call, and you can manage machine IDs and clocks.',
        'One trap with time-ordered IDs: do not range-shard on them. All new writes land on the newest range and one shard runs hot. Hash the ID, or shard by another key such as customer.',
      ],
      keyIdea: 'Pick by size, ordering and how much coordination you can afford. Then shard by hash, not by a time-ordered ID.',
      metrics: { size: '64 or 128 bits', sorted: 'v7, ticket, Snowflake', coord: 'from none to central', rate: 'all far above 20K/s' },
      scene: {
        nodes: [client, { ...n1, status: 'ok' }, { ...n2, status: 'ok' }, { ...n3, status: 'ok' }, { ...shard1, sub: 'hash(id) mod 2', status: 'ok' }, { ...shard2, sub: 'hash(id) mod 2', status: 'ok' }],
        links: [
          { from: 'client', to: 'n2' },
          { from: 'n1', to: 'shard2' },
          { from: 'n2', to: 'shard1' },
          { from: 'n3', to: 'shard2' },
        ],
        flows: [
          { path: ['client', 'n2'], tone: 'request', count: 3, duration: 1 },
          { path: ['n1', 'shard2'], tone: 'request', duration: 1.2, delay: 1 },
          { path: ['n2', 'shard1'], tone: 'request', duration: 1.2, delay: 1.2 },
          { path: ['n3', 'shard2'], tone: 'request', duration: 1.2, delay: 1.4 },
        ],
        caption: 'Hashing spreads time-ordered IDs over shards',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Unique everywhere without asking anyone',
      eli5: 'Every counter prints its own tickets, and no two tickets ever match: the time, the counter number and a little count make each one different.',
      body: [
        'Per-database **auto-increment** collides after sharding, and counter offsets only patch a fixed fleet. **UUID v4** needs no coordination and scatters index writes. **UUID v7** adds a time prefix. A **ticket server** hands out short ordered numbers, best in batches.',
        '**Snowflake** builds 64-bit IDs from 41 bits of time, 10 of machine and 12 of sequence: about 4 million per second per node, sortable, with coordination only when machine IDs are assigned. It must never reuse a timestamp after a clock step.',
      ],
      keyIdea: 'Put time in the high bits for order, a unique source in the middle for safety, and a counter at the bottom for speed.',
      metrics: { size: '64 bits', sorted: 'by ms', coord: 'machine IDs only', rate: '4M/s per node' },
      scene: {
        nodes: [client, n1, n2, n3, { ...shard1, status: 'ok' }, { ...shard2, status: 'ok' }],
        links: [
          { from: 'client', to: 'n2' },
          { from: 'n1', to: 'shard1' },
          { from: 'n2', to: 'shard1' },
          { from: 'n3', to: 'shard2' },
        ],
        flows: [
          { path: ['client', 'n2', 'shard1'], tone: 'request', count: 3, duration: 1.8 },
          { path: ['n3', 'shard2'], tone: 'request', count: 2, duration: 1.2, delay: 0.6 },
        ],
      },
      quiz: {
        question: 'Two Snowflake generators produce the same ID. Clocks are fine. What is the most likely cause?',
        options: [
          'The sequence field is too small',
          'Both generators were given the same machine ID',
          'The timestamp field overflowed',
          'Snowflake IDs are random and can collide by chance',
        ],
        answer: 1,
        explain: 'With sane clocks, the machine ID is what keeps generators apart. Two nodes sharing one, for example after a lease was not released or a config was copied, will issue identical IDs.',
      },
    },
  ],
};
