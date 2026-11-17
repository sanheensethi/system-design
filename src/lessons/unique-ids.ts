import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const app: SceneNode = { id: 'app', kind: 'block', at: at(-4, 0), label: 'order API', sub: 'creates orders', icon: 'ShoppingBag', tint: 'blue' };
const shard1: SceneNode = { id: 'shard1', kind: 'shard', at: at(3.6, -3.4), label: 'shard 1', sub: 'orders A to M' };
const shard2: SceneNode = { id: 'shard2', kind: 'shard', at: at(3.6, 3.4), label: 'shard 2', sub: 'orders N to Z' };
const ticket: SceneNode = { id: 'ticket', kind: 'db', at: at(0, -3.8), label: 'ticket server', sub: 'one counter' };
const ticket2: SceneNode = { id: 'ticket2', kind: 'db', at: at(0, 3.8), label: 'ticket server 2', sub: 'even numbers' };
const n1: SceneNode = { id: 'n1', kind: 'block', size: 0.8, at: at(-3.6, 3.6), label: 'node 1', sub: 'machine 1', icon: 'Hash', tint: 'violet' };
const n2: SceneNode = { id: 'n2', kind: 'block', size: 0.8, at: at(0, 3.6), label: 'node 2', sub: 'machine 2', icon: 'Hash', tint: 'violet' };
const n3: SceneNode = { id: 'n3', kind: 'block', size: 0.8, at: at(3.6, 3.6), label: 'node 3', sub: 'machine 3', icon: 'Hash', tint: 'violet' };
const etcd: SceneNode = { id: 'etcd', kind: 'monitor', at: at(0, -3.6), label: 'etcd', sub: 'machine ID leases' };
const db: SceneNode = { id: 'db', kind: 'db', at: at(3.8, 0), label: 'orders DB', sub: 'primary key index' };
const gen: SceneNode = { id: 'gen', kind: 'block', at: at(-3.6, 0), label: 'ID generator', sub: 'in the app', icon: 'Binary', tint: 'violet' };

export const uniqueIds: Lesson = {
  id: 'unique-ids',
  title: 'Unique ID generation',
  tagline: 'Hand out billions of IDs across many machines without two ever matching, and keep them small and sortable.',
  minutes: 18,
  level: 'Intermediate',
  learn: [
    'Why auto-increment collides once a table is sharded, and what a good ID needs',
    'UUID v4 and v7, plus ULID, KSUID and ObjectId: random versus time-ordered IDs',
    'Ticket servers and handing out ID ranges in batches',
    'The Snowflake layout: timestamp, machine and sequence bits, and how to tune them',
    'Machine ID leases, clock skew, ID leakage and sharding by hash',
    'How to choose a scheme',
  ],
  metrics: [
    { key: 'size', label: 'ID size', icon: 'Binary' },
    { key: 'sorted', label: 'Time sortable', icon: 'Clock' },
    { key: 'coord', label: 'Coordination', icon: 'Network' },
    { key: 'rate', label: 'Max rate', icon: 'Gauge' },
  ],
  steps: [
    {
      title: 'Collision',
      tag: 'problem',
      heading: 'Two shards both created order 1001',
      eli5: 'A deli has two counters, each with its own roll of number tickets starting at 1. Two customers end up holding ticket 1001, and the kitchen cannot tell whose sandwich is whose.',
      body: [
        'The orders table outgrew one machine and was split into two shards by customer. Each shard kept its `AUTO_INCREMENT` primary key, and each counter is unique only inside its own database.',
        'Within an hour both shards have issued order **1001**. Support looks up "order 1001" and finds two.',
      ],
      keyIdea: 'An auto-increment counter is unique only inside one database. Shard the table and the counters collide.',
      metrics: { size: '64 bits', sorted: 'per shard', coord: 'none (broken)', rate: '-' },
      metricTones: { coord: 'bad' },
      scene: {
        nodes: [
          { ...app, status: 'active', chips: ['place order'] },
          { ...shard1, status: 'hot', badge: 'order 1001' },
          { ...shard2, status: 'hot', badge: 'order 1001' },
        ],
        links: [link('app', 'shard1'), link('app', 'shard2')],
        flows: [
          { path: ['app', 'shard1'], tone: 'request', label: 'INSERT', duration: 1 },
          { path: ['app', 'shard2'], tone: 'request', label: 'INSERT', duration: 1 },
          { path: ['shard1', 'app'], tone: 'error', label: 'id 1001', duration: 1, delay: 1.1 },
          { path: ['shard2', 'app'], tone: 'error', label: 'id 1001', duration: 1, delay: 1.1 },
        ],
        panel: {
          title: 'Lookup: order 1001',
          icon: 'Search',
          rows: [
            { text: 'shard 1', value: 'Ana, 2 pizzas', tone: 'warn' },
            { text: 'shard 2', value: 'Raj, 1 salad', tone: 'warn' },
          ],
          footer: { text: 'Two rows, one key', tone: 'bad' },
        },
        caption: 'Two counters, one number',
      },
    },
    {
      title: 'Damage',
      tag: 'problem',
      heading: 'What a duplicate ID breaks',
      eli5: 'Two customers hold ticket 1001. When the kitchen calls "1001 is ready", the wrong person walks off with the sandwich, and the ledger at the end of the day will not add up.',
      body: [
        'A payment event that says "order 1001 paid" can mark the wrong order. Merging both shards into the analytics warehouse fails on duplicate keys. Foreign keys and caches keyed by order ID point at the wrong row.',
        'IDs are the glue between systems, so a collision spreads. Duplicates are cheap to prevent and very expensive to clean up.',
      ],
      keyIdea: 'An ID is a join key for the whole company. One collision corrupts every system that stores it.',
      metrics: { size: '64 bits', sorted: 'per shard', coord: 'none (broken)', rate: '-' },
      metricTones: { coord: 'bad' },
      scene: {
        nodes: [
          { ...shard1, status: 'hot', badge: 'order 1001' },
          { id: 'pay', kind: 'block', at: at(0, 0), label: 'payments', sub: '"1001 paid"', icon: 'Receipt', tint: 'amber', status: 'hot' },
          { id: 'wh', kind: 'warehouse', at: at(3.6, 3.4), label: 'warehouse', sub: 'merge both shards', status: 'down', badge: 'duplicate key' },
        ],
        links: [link('shard1', 'pay'), link('pay', 'wh')],
        flows: [
          { path: ['shard1', 'pay'], tone: 'event', label: 'order 1001', duration: 1.2 },
          { path: ['pay', 'wh'], tone: 'error', label: 'which one?', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Who holds the ID',
          icon: 'Key',
          rows: [
            { text: 'Payments table', value: 'marks wrong order', tone: 'bad' },
            { text: 'Warehouse load', value: 'duplicate key error', tone: 'bad' },
            { text: 'Cache by order ID', value: 'serves wrong row', tone: 'bad' },
          ],
        },
        caption: 'One collision, three broken systems',
      },
    },
    {
      title: 'Requirements',
      tag: 'concept',
      heading: 'What a good ID needs',
      eli5: 'A good ticket is short, never repeats, roughly follows the order people arrived, and can be printed at any counter without phoning anyone.',
      body: [
        'We need IDs that are **unique** across every machine, **numeric** so they fit a `BIGINT` index, and **64 bits or less**. Ideally they **sort by creation time**.',
        'The generator must handle **20,000 IDs per second** at peak (our checkout peaks at 20K orders/s) without a network call to one counter for every insert.',
      ],
      keyIdea: 'Unique, compact, time-ordered, fast, and no per-ID coordination. Each scheme trades some of these away.',
      metrics: { size: '64 bits', sorted: 'wanted', coord: 'none wanted', rate: '20K/s peak' },
      scene: {
        nodes: [
          { ...app, chips: ['20K orders/s'] },
          { ...gen, at: at(0, 0), status: 'active' },
          { ...db, status: 'ok' },
        ],
        links: [link('app', 'gen'), link('gen', 'db')],
        flows: [{ path: ['app', 'gen', 'db'], tone: 'request', label: 'new ID', count: 3, duration: 1.8 }],
        panel: {
          title: 'Requirements',
          icon: 'List',
          rows: [
            { text: 'Unique everywhere', value: 'must' },
            { text: 'Fits in 64 bits', value: 'BIGINT' },
            { text: 'Sorted by time', value: 'ideal' },
            { text: 'Rate', value: '20,000/s peak' },
            { text: 'Per-ID network call', value: 'avoid', tone: 'warn' },
          ],
        },
        caption: 'Mint IDs locally, make them unique and sortable',
      },
    },
    {
      title: 'Offsets',
      tag: 'concept',
      heading: 'Quick patch: step the counters apart',
      eli5: 'The deli gives counter one only odd tickets and counter two only even tickets. They can never print the same number.',
      body: [
        'MySQL can step each counter by the number of shards: shard 1 issues 1, 3, 5 and shard 2 issues 2, 4, 6. This is the multi-master replication idea of giving each database a lane. No two shards can produce the same value.',
      ],
      keyIdea: 'Counter offsets avoid collisions for a fixed number of databases.',
      metrics: { size: '64 bits', sorted: 'no', coord: 'fixed shard count', rate: 'per DB' },
      metricTones: { size: 'good', sorted: 'bad' },
      scene: {
        nodes: [
          app,
          { ...shard1, status: 'ok', sub: 'offset 1, step 2', badge: '1, 3, 5' },
          { ...shard2, status: 'ok', sub: 'offset 2, step 2', badge: '2, 4, 6' },
        ],
        links: [link('app', 'shard1'), link('app', 'shard2')],
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
      title: 'Offset limits',
      tag: 'tradeoff',
      heading: 'Why offsets do not scale',
      eli5: 'The deli opens a third counter. Now every counter must be told a new step, and the new tickets must not overlap the old ones. Nobody wants to do that on a busy day.',
      body: [
        'Adding a third shard means changing the step everywhere and making sure new values never overlap old ones. IDs carry no creation time, and order across shards is meaningless.',
        'Every insert still needs the database to assign the ID, so the app cannot know it before the write. Fine for two fixed databases. Not a plan for a fleet that grows.',
      ],
      keyIdea: 'Offsets turn every change in shard count into a migration, and the app still waits for the database to learn its own ID.',
      metrics: { size: '64 bits', sorted: 'no', coord: 'migration on growth', rate: 'per DB' },
      metricTones: { coord: 'bad', sorted: 'bad' },
      scene: {
        nodes: [
          app,
          { ...shard1, badge: 'step 2, must become 3' },
          { ...shard2, badge: 'step 2, must become 3' },
          { id: 'shard3', kind: 'shard', at: at(0, 0), label: 'shard 3', sub: 'new', status: 'hot', badge: 'offset 3?' },
        ],
        links: [link('app', 'shard1'), link('app', 'shard2'), link('app', 'shard3')],
        flows: [{ path: ['app', 'shard3'], tone: 'error', label: 'overlaps 3, 5, 7?', duration: 1.4 }],
        panel: {
          title: 'Cost of adding shard 3',
          icon: 'Table',
          rows: [
            { text: 'Reconfigure shard 1', value: 'step 3', tone: 'warn' },
            { text: 'Reconfigure shard 2', value: 'step 3', tone: 'warn' },
            { text: 'Skip used values', value: 'by hand', tone: 'bad' },
            { text: 'Time order', value: 'none', tone: 'bad' },
          ],
        },
        caption: 'Every new shard changes the rules',
      },
    },
    {
      title: 'UUID v4',
      tag: 'concept',
      heading: 'UUID v4: so random it never repeats',
      eli5: 'Each counter prints tickets with a long string of random letters. Any counter can print one with no phone call, and two matching tickets almost never happen.',
      body: [
        'A **UUID v4** is 128 bits, of which 122 are random. Any machine, including a phone or an offline client, can generate one locally with no coordination.',
        'Because the ID exists before the insert, a retry can reuse it, which makes the write safe to repeat.',
      ],
      keyIdea: 'UUID v4 removes coordination entirely: generate anywhere, before the write.',
      metrics: { size: '128 bits', sorted: 'no', coord: 'none', rate: 'unlimited' },
      metricTones: { coord: 'good', rate: 'good', sorted: 'bad' },
      scene: {
        nodes: [
          { ...app, chips: ['uuid4()'] },
          { ...shard1, status: 'ok' },
          { ...shard2, status: 'ok' },
        ],
        links: [link('app', 'shard1'), link('app', 'shard2')],
        flows: [
          { path: ['app', 'shard1'], tone: 'request', label: '3f2a9c1e-...', duration: 1.2 },
          { path: ['app', 'shard2'], tone: 'request', label: 'a7710b4d-...', duration: 1.2 },
        ],
        panel: {
          title: 'UUID v4 layout',
          icon: 'Binary',
          rows: [
            { text: 'Total size', value: '128 bits' },
            { text: 'Random bits', value: '122', tone: 'good' },
            { text: 'Version and variant', value: '6 bits' },
            { text: 'Needs a central counter', value: 'no', tone: 'good' },
          ],
        },
        caption: 'Unique anywhere, no questions asked',
      },
    },
    {
      title: 'Collision odds',
      tag: 'concept',
      heading: 'How unlikely is a UUID v4 collision?',
      eli5: 'There are so many possible random tickets that even if a thousand counters each printed a million a second, you would wait about 85 years before expecting even one matching pair.',
      body: [
        'By the birthday bound, a 50% chance of any collision needs about **2.7 quintillion** (2 to the 61st) IDs. At a billion IDs per second that takes roughly 85 years.',
        'In practice a duplicate is far less likely than a disk or bug losing the row. Treat collisions as a non-issue, but keep the primary key constraint anyway.',
      ],
      keyIdea: 'Random 122-bit IDs collide so rarely that the real risk is a broken random generator, not chance.',
      metrics: { size: '128 bits', sorted: 'no', coord: 'none', rate: 'unlimited' },
      metricTones: { coord: 'good' },
      scene: {
        nodes: [
          { id: 'many', kind: 'block', at: at(-3.6, 0), label: '1 billion/s', sub: 'every machine', icon: 'Zap', tint: 'amber' },
          { id: 'space', kind: 'block', at: at(0, 0), label: '2^122 values', sub: 'random space', icon: 'Binary', tint: 'violet' },
          { id: 'key', kind: 'block', at: at(3.6, 0), label: 'PK constraint', sub: 'last line of defense', icon: 'Shield', tint: 'green' },
        ],
        links: [link('many', 'space'), link('space', 'key')],
        flows: [{ path: ['many', 'space', 'key'], tone: 'request', label: 'uuid4()', count: 3, duration: 2 }],
        panel: {
          title: '50% chance of one duplicate',
          icon: 'Gauge',
          rows: [
            { text: 'IDs needed', value: '2.7 quintillion' },
            { text: 'Rate', value: '1 billion/s' },
            { text: 'Time to get there', value: '~85 years', tone: 'good' },
          ],
        },
        caption: 'Chance is not the risk. A bad random source is',
      },
    },
    {
      title: 'UUID cost',
      tag: 'tradeoff',
      heading: 'The price of UUID v4: size and random inserts',
      eli5: 'Long random tickets are bulky, and the deli files them in random drawers, so the cook runs all over the kitchen to find a drawer for each new one.',
      body: [
        'At 16 bytes it is twice the size of a `BIGINT`, and every secondary index stores a copy of the primary key. As text it is 36 bytes, so store it as binary.',
        'The values are random, so each insert lands on a random page of the B-tree. That means scattered page writes, more page splits, and a working set that no longer fits in RAM. They also say nothing about time.',
      ],
      keyIdea: 'UUID v4 pays for coordination-free IDs with double the key size and random B-tree inserts.',
      metrics: { size: '128 bits', sorted: 'no', coord: 'none', rate: 'unlimited' },
      metricTones: { size: 'warn', sorted: 'bad' },
      scene: {
        nodes: [
          { ...app, badge: 'uuid4()' },
          { ...db, status: 'hot', load: 88, badge: 'random page every insert' },
        ],
        links: [link('app', 'db', { label: 'random keys', labelTone: 'warn' })],
        flows: [{ path: ['app', 'db'], tone: 'request', label: 'a7710b4d-...', count: 3, duration: 1.5 }],
        panel: {
          title: 'Key size',
          icon: 'Table',
          rows: [
            { text: 'BIGINT', value: '8 B', tone: 'good' },
            { text: 'UUID as binary', value: '16 B', tone: 'warn' },
            { text: 'UUID as text', value: '36 B', tone: 'bad' },
            { text: 'Insert position', value: 'random page', tone: 'bad' },
          ],
          footer: { text: 'Indexes copy the key, so the cost multiplies', tone: 'warn' },
        },
        caption: 'Scattered writes thrash the index',
      },
    },
    {
      title: 'UUID v7',
      tag: 'concept',
      heading: 'UUID v7: put the time first',
      eli5: 'Now each long ticket starts with the time it was printed, then the random letters. Sorting tickets by their text also sorts them by when they were printed.',
      body: [
        '**UUID v7**, standardized in RFC 9562 (2024), keeps the 128-bit format but fills the first 48 bits with the Unix time in milliseconds. Most of the rest is random.',
        'New IDs are larger than old ones, so inserts land at the right edge of the index, like auto-increment, and the hot pages stay in memory. Sorting by ID gives creation order.',
      ],
      keyIdea: 'UUID v7 keeps UUIDs coordination-free and makes them time-ordered, which fixes most of the index pain.',
      metrics: { size: '128 bits', sorted: 'by ms', coord: 'none', rate: 'unlimited' },
      metricTones: { sorted: 'good', coord: 'good' },
      scene: {
        nodes: [
          { ...app, badge: 'uuid7()' },
          { ...db, status: 'ok', load: 35, badge: 'append at right edge' },
        ],
        links: [link('app', 'db')],
        flows: [
          { path: ['app', 'db'], tone: 'request', label: '0192f3a1-...', duration: 1.2 },
          { path: ['app', 'db'], tone: 'request', label: '0192f3a2-...', duration: 1.2, delay: 0.7 },
        ],
        panel: {
          title: 'UUID v7 layout',
          icon: 'Binary',
          rows: [
            { text: 'Unix time in ms', value: '48 bits', tone: 'good' },
            { text: 'Version and variant', value: '6 bits' },
            { text: 'Random', value: '74 bits' },
          ],
          footer: { text: 'Time first means sorted by creation', tone: 'good' },
        },
        caption: 'Timestamp prefix, random tail',
      },
      quiz: {
        question: 'Why does UUID v7 insert into a B-tree faster than UUID v4?',
        options: [
          'It is smaller than v4',
          'Its time prefix makes new IDs larger than old ones, so inserts hit the right edge of the index',
          'It needs no random bits',
          'It is generated by the database',
        ],
        answer: 1,
        explain: 'Both are 16 bytes. v7 starts with a millisecond timestamp, so inserts append near the same hot pages instead of landing on random ones.',
      },
    },
    {
      title: 'Other formats',
      tag: 'concept',
      heading: 'ULID, KSUID and ObjectId: the same idea, other layouts',
      eli5: 'Other delis print tickets the same way, time first and random after, but with different lengths and letters.',
      body: [
        '**ULID** is 48 bits of ms time plus 80 random, written as 26 characters. **KSUID** is 32 bits of seconds plus 128 random, 27 characters. MongoDB\'s **ObjectId** is 12 bytes: 4 of seconds, 5 random, 3 counter.',
        'All three put time first and need no coordination. They pre-date UUID v7, which now makes them mostly a legacy or taste choice.',
      ],
      keyIdea: 'ULID, KSUID and ObjectId are time-prefixed IDs like UUID v7. Pick by size, text format and library support.',
      metrics: { size: '96 to 160 bits', sorted: 'by ms or s', coord: 'none', rate: 'unlimited' },
      metricTones: { coord: 'good' },
      scene: {
        nodes: [
          { id: 'ulid', kind: 'block', at: at(-3.6, 0), label: 'ULID', sub: '128 bits', icon: 'Hash', tint: 'blue' },
          { id: 'ksuid', kind: 'block', at: at(0, 0), label: 'KSUID', sub: '160 bits', icon: 'Hash', tint: 'teal' },
          { id: 'oid', kind: 'block', at: at(3.6, 0), label: 'ObjectId', sub: '96 bits', icon: 'Hash', tint: 'green' },
        ],
        links: [],
        flows: [],
        panel: {
          title: 'Time first, random after',
          icon: 'Table',
          rows: [
            { text: 'ULID', value: '48 time + 80 random' },
            { text: 'KSUID', value: '32 time (s) + 128 random' },
            { text: 'ObjectId', value: '4 time + 5 random + 3 counter' },
          ],
        },
        caption: 'Three more time-prefixed IDs',
      },
    },
    {
      title: 'Ticket server',
      tag: 'concept',
      heading: 'Ticket server: one counter for everyone',
      eli5: 'The deli puts a single ticket machine by the door that serves every counter. Numbers are short and in order, but if that machine jams, nobody gets served.',
      body: [
        'To keep IDs as small 64-bit numbers, run a dedicated **ticket server**: a tiny database whose only job is an auto-increment counter. Every app server asks it for the next ID.',
        'It gives compact, nearly ordered numbers and is easy to run. It is also a single point of failure and a network hop on every insert.',
      ],
      keyIdea: 'A central counter gives short ordered IDs, and costs a hop per ID plus a single point of failure.',
      metrics: { size: '64 bits', sorted: 'roughly', coord: '1 call per ID', rate: 'bound by one DB' },
      metricTones: { coord: 'bad', size: 'good' },
      scene: {
        nodes: [
          { ...app, at: at(-4, 0), chips: ['place order'] },
          { ...ticket, at: at(0, 0), status: 'hot', load: 78, badge: 'next: 42,000' },
          { ...db, at: at(4, 0), status: 'ok' },
        ],
        links: [link('app', 'ticket', { label: '1 round trip per ID', labelTone: 'warn' }), link('app', 'db', { style: 'faint' })],
        flows: [
          { path: ['app', 'ticket'], tone: 'request', label: 'next id?', duration: 1 },
          { path: ['ticket', 'app'], tone: 'response', label: '42,000', duration: 1, delay: 1.1 },
        ],
        caption: 'Short IDs, one hop each',
      },
    },
    {
      title: 'Two tickets',
      tag: 'tradeoff',
      heading: 'Two ticket servers: odd and even',
      eli5: 'The deli adds a second ticket machine that prints only even numbers, so if one jams the other keeps going. The numbers are only roughly in order now.',
      body: [
        'A common fix is two ticket servers, one issuing odd and one even numbers, with clients alternating between them. If one dies, the other keeps issuing.',
        'Order across the two is only approximate, and adding a third brings back the offset problem.',
      ],
      keyIdea: 'A second ticket server hides most failures, at the cost of looser ordering.',
      metrics: { size: '64 bits', sorted: 'approx', coord: '1 call per ID', rate: '2x one DB' },
      metricTones: { sorted: 'warn' },
      scene: {
        nodes: [
          { ...app, at: at(-4, 0) },
          { ...ticket, at: at(0, -4), sub: 'odd numbers', status: 'ok', badge: '1, 3, 5' },
          { ...ticket2, at: at(3, 3.4), status: 'ok', badge: '2, 4, 6' },
        ],
        links: [link('app', 'ticket'), link('app', 'ticket2')],
        flows: [
          { path: ['app', 'ticket'], tone: 'request', label: 'next odd', duration: 1.2 },
          { path: ['ticket', 'app'], tone: 'response', label: '41', duration: 1.2, delay: 1.3 },
          { path: ['app', 'ticket2'], tone: 'request', label: 'next even', duration: 1.2, delay: 2.6 },
        ],
        caption: 'Two lanes, one survives a crash',
      },
    },
    {
      title: 'Batching',
      tag: 'concept',
      heading: 'Batching: take a thousand tickets at once',
      eli5: 'Instead of walking to the door machine for every ticket, each counter grabs a strip of 1,000 tickets and tears them off one by one.',
      body: [
        'Ask for a block of 1,000 IDs at once and hand them out from memory. That is one round trip per thousand orders, and the ticket server can be down briefly without anyone noticing.',
        'A crashed app server simply wastes the rest of its block, which leaves gaps. Gaps are harmless, but IDs are no longer a gapless count.',
        'Each app server holds its own block, so order holds inside a block and is only coarse across servers.',
      ],
      keyIdea: 'Batching ranges hides the ticket server latency and outages. The price is gaps after a crash.',
      metrics: { size: '64 bits', sorted: 'per block', coord: '1 call per 1,000 IDs', rate: 'high with batches' },
      metricTones: { coord: 'good', rate: 'good' },
      scene: {
        nodes: [
          { ...app, at: at(-4, 0), status: 'active', badge: 'block 41,000 to 41,999' },
          { ...ticket, at: at(0, 0), status: 'ok', badge: 'next block: 42,000' },
          { ...db, at: at(4, 0), status: 'ok' },
        ],
        links: [link('app', 'ticket', { label: '1 call per 1,000 IDs' }), link('app', 'db', { style: 'faint' })],
        flows: [
          { path: ['app', 'ticket'], tone: 'request', label: 'give me 1,000', duration: 1 },
          { path: ['ticket', 'app'], tone: 'response', label: '41,000 to 41,999', duration: 1, delay: 1.1 },
          { path: ['app', 'db'], tone: 'request', label: 'id 41,000', duration: 1, delay: 2.3 },
        ],
        panel: {
          title: 'After a crash',
          icon: 'Table',
          rows: [
            { text: 'Block issued', value: '41,000 to 41,999' },
            { text: 'Used before crash', value: '41,000 to 41,310' },
            { text: 'Wasted', value: '689 IDs', tone: 'warn' },
          ],
        },
        caption: 'One round trip per thousand IDs',
      },
    },
    {
      title: 'Snowflake',
      tag: 'concept',
      heading: 'Snowflake: build the ID from time, machine and a counter',
      eli5: 'Each counter prints tickets reading "time, counter number, then 1, 2, 3 within that second". Nobody has to ask the door machine.',
      body: [
        'A **Snowflake ID** packs three fields into one 64-bit integer, generated locally on each machine. The top bit stays 0 so the number is positive. The next **41 bits** hold milliseconds since a custom epoch, about 69 years. Then **10 bits** of machine ID and **12 bits** of sequence.',
      ],
      keyIdea: 'Snowflake gets ordering from putting the timestamp in the high bits.',
      metrics: { size: '64 bits', sorted: 'by ms', coord: 'machine IDs only', rate: '4M/s per node' },
      metricTones: { size: 'good', sorted: 'good', coord: 'good' },
      scene: {
        nodes: [
          { ...gen, at: at(0, 0), status: 'active', badge: 'no network call' },
          { ...db, status: 'ok' },
        ],
        links: [link('gen', 'db')],
        flows: [{ path: ['gen', 'db'], tone: 'request', label: 'id', count: 3, duration: 1.5 }],
        panel: {
          title: '64-bit Snowflake layout',
          icon: 'Binary',
          rows: [
            { text: 'Sign bit', value: '1 bit, always 0' },
            { text: 'Timestamp (ms since epoch)', value: '41 bits', tone: 'good' },
            { text: 'Machine ID', value: '10 bits' },
            { text: 'Sequence', value: '12 bits' },
          ],
          footer: { text: 'Time first, so IDs sort by creation', tone: 'good' },
        },
        caption: '41 bits time, 10 bits machine, 12 bits sequence',
      },
    },
    {
      title: 'Why unique',
      tag: 'concept',
      heading: 'Why Snowflake IDs never collide',
      eli5: 'Two counters never print the same ticket because each has its own counter number on it. One counter never repeats because it counts up within the second.',
      body: [
        'Two machines never collide because their machine IDs differ. One machine never collides with itself because the sequence counts up within a millisecond and resets when the millisecond changes.',
        'The sequence holds 4,096 values, so each generator can issue about **4 million IDs per second** with no network call. The 4,097th request in a millisecond waits for the clock to tick.',
      ],
      keyIdea: 'Machine ID separates generators and sequence separates IDs inside one millisecond.',
      metrics: { size: '64 bits', sorted: 'by ms', coord: 'machine IDs only', rate: '4M/s per node' },
      metricTones: { rate: 'good' },
      scene: {
        nodes: [
          { ...n1, status: 'active', badge: 't | 1 | 0' },
          { ...n2, status: 'active', badge: 't | 2 | 0' },
          { ...n3, status: 'active', badge: 't | 3 | 0' },
          { ...db, at: at(0, -4.6), status: 'ok' },
        ],
        links: [link('n1', 'db'), link('n2', 'db'), link('n3', 'db')],
        flows: [
          { path: ['n1', 'db'], tone: 'request', label: 'id from node 1', duration: 1.2 },
          { path: ['n2', 'db'], tone: 'request', label: 'id from node 2', duration: 1.2, delay: 0.3 },
          { path: ['n3', 'db'], tone: 'request', label: 'id from node 3', duration: 1.2, delay: 0.6 },
        ],
        caption: 'Same millisecond, three different IDs',
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
                if self.last_ms - now > 100:         # large jump: stop
                    raise RuntimeError("clock moved back over 100 ms")
                while now < self.last_ms:            # small jump: wait it out
                    now = int(time.time() * 1000)
            if now == self.last_ms:
                self.seq = (self.seq + 1) & 0xFFF    # 12 bits
                if self.seq == 0:                    # 4,096 used this ms
                    while now <= self.last_ms:
                        now = int(time.time() * 1000)
            else:
                self.seq = 0
            self.last_ms = now
            return ((now - EPOCH_MS) << 22) | (self.machine_id << 12) | self.seq`,
        highlight: [15, 16, 17, 18, 21, 22, 28],
      },
      quiz: {
        question: 'With 12 sequence bits, what is the most IDs one Snowflake generator can issue in one millisecond?',
        options: ['1,024', '4,096', '65,536', 'Unlimited'],
        answer: 1,
        explain: '2 to the 12th is 4,096. The 4,097th request in the same millisecond waits for the clock to tick, which caps one generator at about 4 million IDs per second.',
      },
    },
    {
      title: 'Bit budget',
      tag: 'tradeoff',
      heading: 'Tuning the bit split',
      eli5: 'The deli can print a ticket with more room for the time or more room for the counter, as long as the ticket stays the same size.',
      body: [
        'The split is a design choice. Fewer machine bits and more sequence bits suit a few very busy generators. Fewer sequence bits and more timestamp bits suit low traffic that must last for decades. Some variants add a datacenter field.',
        'Instagram uses 41 time, 13 shard and 10 sequence bits. Sonyflake uses 39 bits of 10 ms time, 8 sequence and 16 machine bits. The fixed part is the order: time first.',
      ],
      keyIdea: 'Bits are a budget. Spend them on lifetime, fleet size or per-machine rate, but keep time in the high bits.',
      metrics: { size: '64 bits', sorted: 'by ms', coord: 'machine IDs only', rate: 'depends on split' },
      scene: {
        nodes: [
          { id: 'sf', kind: 'block', at: at(-3.6, 0), label: 'Snowflake', sub: '41 | 10 | 12', icon: 'Binary', tint: 'violet' },
          { id: 'ig', kind: 'block', at: at(0, 0), label: 'Instagram', sub: '41 | 13 | 10', icon: 'Binary', tint: 'amber' },
          { id: 'sony', kind: 'block', at: at(3.6, 0), label: 'Sonyflake', sub: '39 | 16 | 8', icon: 'Binary', tint: 'teal' },
        ],
        links: [],
        flows: [],
        panel: {
          title: 'Time | machine | sequence',
          icon: 'Table',
          rows: [
            { text: 'Snowflake', value: '41 | 10 | 12 bits' },
            { text: 'Instagram', value: '41 | 13 shard | 10 bits' },
            { text: 'Sonyflake', value: '39 (10 ms) | 16 | 8 bits' },
          ],
          footer: { text: 'Same 64 bits, different bets', tone: 'muted' },
        },
        caption: 'Same size, different split',
      },
    },
    {
      title: 'Machine IDs',
      tag: 'tradeoff',
      heading: 'Who hands out the machine IDs?',
      eli5: 'Every counter needs its own counter number painted on it. If two counters get painted with the same number, they will print matching tickets.',
      body: [
        'Snowflake pushes all coordination into one place: no two live generators may share a machine ID. Get that wrong and duplicates come back, silently.',
        'Static config works for a fixed fleet. With autoscaling or containers, a generator claims an ID at startup from a coordination service (etcd or ZooKeeper) with a lease, and gives it up when it stops.',
      ],
      keyIdea: 'Snowflake is only as unique as its machine ID assignment. Coordinate once at startup, never per ID.',
      metrics: { size: '64 bits', sorted: 'by ms', coord: 'lease at startup', rate: '4M/s per node' },
      metricTones: { coord: 'warn' },
      scene: {
        nodes: [
          { ...n3, at: at(-3.6, 3.6), status: 'active', badge: 'claims ID 3' },
          { ...etcd, at: at(0, -3.6), status: 'active', badge: '3 of 1,024 taken' },
          { ...n1, at: at(3.6, 3.6), status: 'ok' },
        ],
        links: [link('n3', 'etcd', { label: 'lease', arrow: 'both' }), link('n1', 'etcd', { style: 'faint' })],
        flows: [
          { path: ['n3', 'etcd'], tone: 'handshake', label: 'lease a machine ID', duration: 1.1 },
          { path: ['etcd', 'n3'], tone: 'response', label: 'ID 3, 30 s lease', duration: 1.1, delay: 1.2 },
          { path: ['n1', 'etcd'], tone: 'handshake', label: 'renew', duration: 1, delay: 2.5 },
        ],
        caption: 'Coordinate once at startup, never per ID',
      },
    },
    {
      title: 'Lost lease',
      tag: 'case',
      heading: 'Case: a node loses its lease',
      eli5: 'A counter loses its painted number. It must stop printing at once, or the next counter given that number will print matching tickets.',
      body: [
        'If a node cannot renew its lease, it must stop issuing IDs before another node can take the same number. Renew at 1/3 of the TTL and stop issuing at 2/3, leaving a safety margin. A new owner waits out the full TTL before using the ID.',
        'The generator holds only its last timestamp. After a restart it reads that back or waits out one lease period, so it never reuses a millisecond. A node paused by GC or a VM freeze must re-check its lease before its next ID.',
      ],
      keyIdea: 'A generator that loses its lease must stop, and a restart must never reuse a timestamp it already used.',
      metrics: { size: '64 bits', sorted: 'by ms', coord: 'lease at startup', rate: '0 while paused' },
      metricTones: { rate: 'bad' },
      scene: {
        nodes: [
          { ...n2, at: at(-3.6, 3.6), status: 'down', badge: 'lease expired: stopped' },
          { ...etcd, at: at(0, -3.6), status: 'active', badge: 'ID 2 free after 30 s' },
          { ...n3, at: at(3.6, 3.6), status: 'ok', badge: 'takes ID 2 later' },
        ],
        links: [link('n2', 'etcd', { label: 'network cut', labelTone: 'warn', style: 'dashed' }), link('n3', 'etcd', { style: 'faint' })],
        flows: [
          { path: ['n2', 'etcd'], tone: 'error', label: 'renew failed', duration: 1.2 },
          { path: ['etcd', 'n3'], tone: 'response', label: 'ID 2 after expiry', duration: 1.2, delay: 1.6 },
        ],
        caption: 'Stop first, hand over later',
      },
    },
    {
      title: 'Clock skew',
      tag: 'case',
      heading: 'Case: the clock jumps back 40 ms',
      eli5: 'The clock on one counter is fixed and set back a little. If the counter keeps printing, it can print a time it already used, with the same numbers as before.',
      body: [
        'Node 2\'s clock has drifted ahead. A time sync **steps** it back 40 ms. For the next 40 ms the generator sees timestamps it already used, and its sequence restarts at 0. It would print IDs it already issued.',
        'The generator must remember the last timestamp it used and never go below it. Wait out a small backward jump. On a large one, refuse to issue IDs and raise an alarm. A time daemon that slews (slows the clock gradually) avoids most steps.',
      ],
      keyIdea: 'A time-based ID generator must never reuse a timestamp. Wait out small backward jumps and stop on large ones.',
      metrics: { size: '64 bits', sorted: 'by ms', coord: 'lease at startup', rate: '0 while waiting' },
      metricTones: { rate: 'warn' },
      scene: {
        nodes: [
          { ...n2, at: at(-3.6, 0), status: 'hot', badge: 'clock -40 ms: waiting', chips: [{ text: 'reuse t = 1005?', tone: 'bad' }] },
          { ...db, at: at(3.8, 0), status: 'ok', badge: 'no duplicates' },
        ],
        links: [link('n2', 'db', { label: 'paused 40 ms', labelTone: 'warn' })],
        flows: [
          { path: ['n2', 'db'], tone: 'error', label: 'reuse t = 1005?', duration: 1.2 },
          { path: ['n2', 'db'], tone: 'request', label: 'after t > 1005', duration: 1.2, delay: 2.5 },
        ],
        panel: {
          title: 'Backward jump rule',
          icon: 'Clock',
          rows: [
            { text: 'Jump under 100 ms', value: 'wait it out', tone: 'good' },
            { text: 'Jump over 100 ms', value: 'stop and alert', tone: 'bad' },
          ],
          footer: { text: 'Better to pause 40 ms than issue a duplicate', tone: 'muted' },
        },
        caption: 'Never go below the last timestamp',
      },
    },
    {
      title: 'Skew between nodes',
      tag: 'concept',
      heading: 'Skew between machines: only roughly sorted',
      eli5: 'Two counters have clocks a few seconds apart, so a later ticket from a slow counter can show an earlier time than a ticket from a fast one. They are in order only roughly.',
      body: [
        'IDs from node 1 and node 2 are ordered only to within their clock difference. Snowflake IDs are **roughly sorted** (k-sorted), not a strict global order.',
        'Run NTP to keep clocks within a few milliseconds. If you need strict cross-machine order, use a single sequencer or logical clocks instead.',
      ],
      keyIdea: 'Time-ordered IDs are sorted to within clock skew. Do not use them where strict order matters.',
      metrics: { size: '64 bits', sorted: 'within clock skew', coord: 'NTP', rate: '4M/s per node' },
      metricTones: { sorted: 'warn' },
      scene: {
        nodes: [
          { ...n1, at: at(-3.6, 0), chips: ['clock +5 ms'], badge: 'id 100' },
          { ...n2, at: at(3.6, 0), chips: ['clock -5 ms'], badge: 'id 98' },
          { ...db, at: at(0, -3.8), status: 'ok' },
        ],
        links: [link('n1', 'db'), link('n2', 'db')],
        flows: [
          { path: ['n1', 'db'], tone: 'request', label: 'created first: 100', duration: 1.2 },
          { path: ['n2', 'db'], tone: 'request', label: 'created second: 98', duration: 1.2, delay: 0.4 },
        ],
        panel: {
          title: 'Sorted by ID',
          icon: 'List',
          rows: [
            { text: '98 (node 2, created later)', value: 'first', tone: 'warn' },
            { text: '100 (node 1, created earlier)', value: 'second', tone: 'warn' },
          ],
          footer: { text: 'Wrong order within the skew window', tone: 'warn' },
        },
        caption: 'Sorted only within the clock difference',
      },
    },
    {
      title: 'ID leakage',
      tag: 'tradeoff',
      heading: 'IDs leak information',
      eli5: 'If tickets show the time and a running number, a stranger can read when the deli was busy and how many sandwiches it sold.',
      body: [
        'Anyone can read the creation time from a time-ordered ID. Sequential-looking IDs let outsiders estimate your order volume or guess neighbors like `/orders/1002`.',
        'IDs are not secrets. Check access on every request, and if it matters, expose a separate random opaque ID in public URLs.',
        'A 64-bit ID is larger than the safe integer limit in JavaScript (2 to the 53rd), so browsers and JSON parsers silently round it. Send IDs as strings in JSON and APIs when clients may be JavaScript.',
      ],
      keyIdea: 'A time-ordered ID reveals when and how much. Keep internal IDs internal and expose an opaque one.',
      metrics: { size: '64 bits', sorted: 'by ms', coord: 'machine IDs only', rate: '4M/s per node' },
      scene: {
        nodes: [
          { id: 'spy', kind: 'user', at: at(-3.6, 0), label: 'outsider', chips: [{ text: 'GET /orders/1002', tone: 'warn' }] },
          { ...app, at: at(0, 0), label: 'order API', status: 'active' },
          { ...db, at: at(3.8, 0), status: 'ok' },
        ],
        links: [link('spy', 'app', { label: 'guessing IDs', labelTone: 'warn' }), link('app', 'db')],
        flows: [
          { path: ['spy', 'app'], tone: 'request', label: '/orders/1002', duration: 1.2 },
          { path: ['app', 'spy'], tone: 'error', label: '403 not yours', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'What an ID tells a stranger',
          icon: 'Search',
          rows: [
            { text: 'Creation time', value: 'readable', tone: 'warn' },
            { text: 'Volume per day', value: 'estimable', tone: 'warn' },
            { text: 'Neighbor IDs', value: 'guessable', tone: 'bad' },
            { text: '64-bit ID in JavaScript', value: 'send as string', tone: 'warn' },
          ],
          footer: { text: 'Authorize every request. Use opaque public IDs', tone: 'good' },
        },
        caption: 'The ID is not a secret',
      },
    },
    {
      title: 'Shard by hash',
      tag: 'tradeoff',
      heading: 'Do not range-shard on a time-ordered ID',
      eli5: 'If tickets are handed to counters by ranges of time, the newest range gets every customer. One counter is swamped and the others stand idle.',
      body: [
        'With range sharding on a time-ordered ID, all new writes land on the newest range and one shard runs hot.',
        'Hash the ID, or shard by another key such as customer. Hashing spreads time-ordered IDs evenly, at the cost of cheap time-range scans across shards.',
      ],
      keyIdea: 'Time-ordered IDs make the newest range the hot range. Hash them before choosing a shard.',
      metrics: { size: '64 bits', sorted: 'by ms', coord: 'machine IDs only', rate: 'bound by one shard' },
      metricTones: { rate: 'bad' },
      scene: {
        nodes: [
          { ...app, at: at(-4, 0) },
          { ...shard1, at: at(3.6, -4.2), sub: 'old IDs', status: 'dim', load: 8 },
          { ...shard2, at: at(3.6, 4.2), sub: 'newest range', status: 'hot', load: 95, chips: [{ text: 'all new writes', tone: 'bad' }] },
        ],
        links: [link('app', 'shard1', { style: 'faint' }), link('app', 'shard2')],
        flows: [{ path: ['app', 'shard2'], tone: 'request', label: 'ids 9,000+', count: 3, duration: 1.4 }],
        panel: {
          title: 'Shard key choice',
          icon: 'Split',
          rows: [
            { text: 'range(id)', value: 'newest shard hot', tone: 'bad' },
            { text: 'hash(id) mod N', value: 'even spread', tone: 'good' },
            { text: 'customer ID', value: 'even, keeps data together', tone: 'good' },
          ],
        },
        caption: 'Hashing spreads time-ordered IDs',
      },
    },
    {
      title: 'Choosing',
      tag: 'tradeoff',
      heading: 'Choosing an ID scheme',
      eli5: 'A small deli is fine with one ticket roll. A busy chain prints the time and counter number on each ticket, or uses long random tickets when nobody cares about order.',
      body: [
        '**Single database**: keep auto-increment. **UUID v4**: any service, including offline clients, mints IDs and order does not matter. **UUID v7**: the same freedom, with time order that keeps indexes healthy.',
        '**Ticket server with batches**: short 64-bit numbers and one more small, replicated service. **Snowflake**: high volume, 64-bit columns, time order, no per-ID call, and you can manage machine IDs and clocks.',
      ],
      keyIdea: 'Pick by size, ordering and how much coordination you can afford.',
      metrics: { size: '64 or 128 bits', sorted: 'v7, ticket, Snowflake', coord: 'from none to central', rate: 'ticket server needs batches, others unbounded' },
      scene: {
        nodes: [
          { id: 'c1', kind: 'block', at: at(-3.6, -3.6), label: 'Auto-increment', sub: 'one database', icon: 'Database', tint: 'gray' },
          { id: 'c2', kind: 'block', at: at(3.6, -3.6), label: 'UUID v4 / v7', sub: 'no coordination', icon: 'Binary', tint: 'blue' },
          { id: 'c3', kind: 'block', at: at(-3.6, 3.6), label: 'Ticket server', sub: 'batched ranges', icon: 'Receipt', tint: 'amber' },
          { id: 'c4', kind: 'block', at: at(3.6, 3.6), label: 'Snowflake', sub: '64-bit, sorted', icon: 'Hash', tint: 'violet' },
        ],
        links: [],
        flows: [],
        panel: {
          title: 'Pick one',
          icon: 'Scale',
          rows: [
            { text: 'Auto-increment', value: 'one DB only' },
            { text: 'UUID v7', value: '128 bit, sorted, free' },
            { text: 'Ticket server', value: '64 bit, one service' },
            { text: 'Snowflake', value: '64 bit, sorted, leases' },
            { text: 'Rate to 20K/s', value: 'ticket server needs batches', tone: 'warn' },
          ],
        },
        caption: 'Four schemes, four sets of tradeoffs',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Unique everywhere without asking anyone',
      eli5: 'Every counter prints its own tickets, and no two tickets ever match: the time, the counter number and a little count make each one different.',
      body: [
        'Per-database **auto-increment** collides after sharding, and offsets only patch a fixed fleet. **UUID v4** needs no coordination and scatters index writes. **UUID v7** adds a time prefix. A **ticket server** hands out short ordered numbers, best in batches.',
        '**Snowflake** builds 64-bit IDs from 41 bits of time, 10 of machine and 12 of sequence: about 4 million per second per node, sortable, with coordination only when machine IDs are assigned. It must never reuse a timestamp after a clock step.',
      ],
      keyIdea: 'Put time in the high bits for order, a unique source in the middle for safety, and a counter at the bottom for speed.',
      metrics: { size: '64 bits', sorted: 'by ms', coord: 'machine IDs only', rate: '4M/s per node' },
      metricTones: { size: 'good', sorted: 'good', coord: 'good', rate: 'good' },
      scene: {
        nodes: [
          { ...n1, status: 'ok' },
          { ...n2, status: 'ok' },
          { ...n3, status: 'ok' },
          { ...db, at: at(0, -4.2), status: 'ok', badge: 'no duplicates' },
        ],
        links: [link('n1', 'db'), link('n2', 'db'), link('n3', 'db')],
        flows: [
          { path: ['n1', 'db'], tone: 'request', count: 2, duration: 1.4 },
          { path: ['n2', 'db'], tone: 'request', count: 2, duration: 1.4, delay: 0.3 },
          { path: ['n3', 'db'], tone: 'request', count: 2, duration: 1.4, delay: 0.6 },
        ],
        caption: 'Time, machine, sequence',
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
