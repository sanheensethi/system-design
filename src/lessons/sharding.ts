import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const COLS = [-4.8, -1.6, 1.6, 4.8];
const COLS5 = [-6.4, -3.2, 0, 3.2, 6.4];

const app: SceneNode = { id: 'app', kind: 'server', at: at(0, -3.8), label: 'app server' };
const router: SceneNode = { id: 'router', kind: 'block', at: at(0, -3.8), label: 'shard router', sub: 'library or proxy', icon: 'Split', tint: 'violet' };
const shard = (i: number, extra: Partial<SceneNode> = {}): SceneNode => ({ id: `s${i}`, kind: 'shard', at: at(COLS[i], 3.8), label: `shard ${i}`, ...extra });
const shard5 = (i: number, extra: Partial<SceneNode> = {}): SceneNode => ({ id: `s${i}`, kind: 'shard', at: at(COLS5[i], 3.8), label: `shard ${i}`, ...extra });

const db: SceneNode = { id: 'db', kind: 'db', at: at(-3.2, 3.8), label: 'primary', sub: 'PostgreSQL' };
const r1: SceneNode = { id: 'r1', kind: 'replica', at: at(3.2, 3.8), label: 'replica' };

const fanTo = (ids: string[], extra: Partial<SceneLink> = {}) => ids.map((id) => link('router', id, extra));
const all4 = ['s0', 's1', 's2', 's3'];

export const sharding: Lesson = {
  id: 'sharding',
  title: 'Sharding',
  tagline: 'When one primary cannot take the writes, split the data so each machine owns a slice.',
  minutes: 18,
  level: 'Intermediate',
  learn: [
    'When sharding is the answer, and which cheaper levers come first',
    'Functional partitioning versus splitting the rows of one table',
    'Range, hash, compound and directory sharding, and what each is good at',
    'How to choose a shard key, and what a hot partition does to it',
    'Cross-shard queries, joins, transactions and secondary indexes',
    'Unique ids on sharded tables, and why resharding hurts',
    'Logical shards and online data moves',
  ],
  metrics: [
    { key: 'shards', label: 'Shards', icon: 'Split' },
    { key: 'writes', label: 'Total writes', icon: 'Zap' },
    { key: 'hottest', label: 'Hottest node', icon: 'Gauge' },
    { key: 'size', label: 'Data per node', icon: 'HardDrive' },
    { key: 'moved', label: 'Data moved', icon: 'ArrowLeftRight' },
  ],
  steps: [
    {
      title: 'Write wall',
      tag: 'problem',
      heading: 'Replicas did not save us this time',
      eli5: 'The toy shop keeps every toy in one giant stockroom, the **primary**, and trucks bring new toys faster than it can shelve them. Copies of the room do not help, because each copy must shelve every toy too.',
      body: [
        'A social app keeps users, posts and ads in one PostgreSQL primary. Peak traffic is now **24K writes/s**, and one primary sustains roughly 5K to 20K depending on hardware. The database holds **16 TB**, well past the 2 to 10 TB where backups and schema changes become painful.',
        'Adding replicas does not help. Every replica must replay every write, so each one is as busy as the primary.',
      ],
      keyIdea: 'Replicas scale reads. When writes or data size outgrow one machine, you have to split the data itself.',
      metrics: { shards: '1', writes: '24K/s', hottest: '24K w/s', size: '16 TB', moved: '-' },
      metricTones: { hottest: 'bad', size: 'bad' },
      scene: {
        nodes: [
          { ...app, chips: ['INSERT post'] },
          { ...db, status: 'hot', load: 98, badge: '24K writes/s · 16 TB' },
          { ...r1, status: 'hot', load: 95, badge: 'replays 24K/s' },
        ],
        links: [link('app', 'db', { label: '24K writes/s', labelTone: 'warn' }), link('db', 'r1', { style: 'dashed', label: 'every write copied' })],
        flows: [
          { path: ['app', 'db'], tone: 'request', label: 'INSERT post', count: 6, duration: 1.4 },
          { path: ['db', 'r1'], tone: 'data', count: 4, duration: 1.2, delay: 1.5 },
        ],
        panel: {
          title: 'One primary, three limits',
          icon: 'Gauge',
          rows: [
            { text: 'Write rate', value: '24K/s vs 5K-20K', tone: 'bad' },
            { text: 'Database size', value: '16 TB vs 2-10 TB', tone: 'bad' },
            { text: 'Replica write load', value: 'same as primary', tone: 'warn' },
          ],
        },
        caption: 'Every copy carries every write',
      },
    },
    {
      title: 'Cheaper first',
      tag: 'tradeoff',
      heading: 'Try the cheaper levers before you shard',
      eli5: 'Before building new stockrooms, the shop tidies the shelves, adds a front counter for popular toys, and buys a bigger room. Only when the room is still too small does it split the toys across rooms.',
      body: [
        'Sharding costs a lot: every query, join and migration gets harder. Do the cheap things first. Add indexes and fix slow queries. Cache hot reads. Send reads to replicas. Archive old rows. Buy a bigger machine.',
        'Most of these cut reads or size, not the write rate. When writes or storage still exceed one machine after them, sharding is the lever left.',
      ],
      keyIdea: 'Shard last. It is the only lever that adds write capacity, and the one that costs the most to run.',
      metrics: { shards: '1', writes: '24K/s', hottest: '24K w/s', size: '16 TB', moved: '-' },
      scene: {
        nodes: [
          { id: 'cache', kind: 'block', at: at(-3.2, -3.8), label: 'cache', sub: 'reads only', icon: 'Zap', tint: 'amber' },
          { ...db, at: at(3.2, -3.8), status: 'hot', load: 97 },
          { ...r1, at: at(0, 3.8), label: 'replicas', sub: 'reads only' },
        ],
        links: [link('cache', 'db'), link('db', 'r1', { style: 'dashed' })],
        flows: [{ path: ['db', 'r1'], tone: 'data', count: 3, duration: 1.4 }],
        panel: {
          title: 'Levers before sharding',
          icon: 'List',
          rows: [
            { text: 'Indexes, query fixes', value: 'cuts CPU', tone: 'good' },
            { text: 'Cache hot reads', value: 'cuts reads', tone: 'good' },
            { text: 'Read replicas', value: 'cuts reads', tone: 'good' },
            { text: 'Archive old rows', value: 'cuts size', tone: 'good' },
            { text: 'Bigger machine', value: 'buys time', tone: 'warn' },
            { text: 'Write rate past one primary', value: 'needs shards', tone: 'bad' },
          ],
        },
        caption: 'Most levers help reads, not writes',
      },
    },
    {
      title: 'By feature',
      tag: 'concept',
      heading: 'Functional partitioning: one database per feature',
      eli5: 'The shop stops keeping everything in one room. Dolls get a doll room, trains get a train room. Each room is smaller, but the train room can still fill up on its own.',
      body: [
        '**Functional partitioning** (also called vertical partitioning or federation) moves whole tables to their own databases by feature: users in one, posts in another, ads in a third. Each database gets its own primary and its own write budget.',
        'It is easy and the app barely changes. The limit is that one feature can still outgrow one machine, and joins between features now cross databases.',
      ],
      keyIdea: 'Splitting by feature is the cheap first split. It stops helping once a single table is too big for one machine.',
      metrics: { shards: '3 dbs', writes: '24K/s', hottest: '17K w/s', size: '16 TB', moved: '-' },
      metricTones: { hottest: 'warn' },
      scene: {
        nodes: [
          { ...app, chips: ['GET /feed'] },
          { id: 'f-users', kind: 'block', size: 0.8, at: at(-3.6, 3.8), label: 'users db', sub: '2K w/s', icon: 'Users', tint: 'blue' },
          { id: 'f-posts', kind: 'block', size: 0.8, at: at(0, 3.8), label: 'posts db', sub: '17K w/s', icon: 'FileText', tint: 'red', status: 'hot' },
          { id: 'f-ads', kind: 'block', size: 0.8, at: at(3.6, 3.8), label: 'ads db', sub: '5K w/s', icon: 'Receipt', tint: 'amber' },
        ],
        links: [link('app', 'f-users'), link('app', 'f-posts'), link('app', 'f-ads')],
        flows: [{ path: ['app', 'f-posts'], tone: 'request', label: 'INSERT post', count: 4, duration: 1.4 }],
        panel: {
          title: 'What is left',
          icon: 'Table',
          rows: [
            { text: 'Writes spread by feature', value: 'yes', tone: 'good' },
            { text: 'Posts db alone', value: '17K w/s, 14 TB', tone: 'bad' },
            { text: 'Join users with posts', value: 'app does it', tone: 'warn' },
          ],
        },
        caption: 'The posts table is still one machine',
      },
    },
    {
      title: 'Split rows',
      tag: 'concept',
      heading: 'Sharding: each machine owns a slice of the rows',
      eli5: '**Sharding** splits the toys into four smaller stockrooms, so each room shelves only a quarter of the deliveries. Every toy has a home room, and each room only handles its own toys.',
      body: [
        '**Sharding** (also called horizontal partitioning) splits the rows of one table across several independent databases. Each **shard** holds a slice and takes only the writes for that slice.',
        'Start again from the single 24K writes/s, 16 TB database of the first step, and split its rows. Four shards turn it into **6K writes/s and 4 TB** per machine. Each shard owns 1/N of the data and 1/N of the writes.',
      ],
      keyIdea: 'Sharding is the lever that adds write capacity and storage. Each shard owns 1/N of the data and 1/N of the writes.',
      metrics: { shards: '4', writes: '24K/s', hottest: '6K w/s', size: '4 TB', moved: '-' },
      metricTones: { hottest: 'good', size: 'good' },
      scene: {
        nodes: [router, shard(0, { badge: '6K w/s', load: 35 }), shard(1, { badge: '6K w/s', load: 35 }), shard(2, { badge: '6K w/s', load: 35 }), shard(3, { badge: '6K w/s', load: 35 })],
        links: fanTo(all4),
        flows: [0, 1, 2, 3].map((i) => ({ path: ['router', `s${i}`], tone: 'request' as const, duration: 1.2, delay: i * 0.2 })),
        panel: {
          title: 'Before and after',
          icon: 'Split',
          rows: [
            { text: 'Writes per machine', value: '24K/s → 6K/s', tone: 'good' },
            { text: 'Data per machine', value: '16 TB → 4 TB', tone: 'good' },
          ],
        },
        caption: 'Four machines, a quarter each',
      },
    },
    {
      title: 'Router',
      tag: 'concept',
      heading: 'The shard router sends each query home',
      eli5: 'The shopkeeper at the door, the **shard router**, looks at each toy, knows which room it lives in, and sends the family to the right door.',
      body: [
        'Something must know which shard holds which row. That is the **shard router**: a library in the app, or a proxy such as Vitess vtgate or mongos.',
        'It reads the **shard key** from each query and forwards the query to one shard. The app talks to the router as if it were one database.',
      ],
      keyIdea: 'The router hides the split. It needs the shard key in every query to know where to go.',
      metrics: { shards: '4', writes: '24K/s', hottest: '6K w/s', size: '4 TB', moved: '-' },
      scene: {
        nodes: [
          { ...app, at: at(-4.8, -3.8), chips: ['user 42'] },
          { ...router, status: 'active', chips: ['key = user_id'] },
          shard(2, { status: 'ok', badge: 'user 42 lives here' }),
        ],
        links: [link('app', 'router'), link('router', 's2', { label: 'one shard' })],
        flows: [
          { path: ['app', 'router'], tone: 'request', label: 'user 42', duration: 1 },
          { path: ['router', 's2'], tone: 'request', duration: 1.2, delay: 1.1 },
        ],
        panel: {
          title: 'Router job',
          icon: 'Route',
          rows: [
            { text: 'Read shard key', value: 'user_id = 42' },
            { text: 'Pick the shard', value: 'shard 2' },
            { text: 'Forward the query', value: '1 hop' },
          ],
        },
      },
    },
    {
      title: 'Shard replicas',
      tag: 'concept',
      heading: 'Each shard still has its own replicas',
      eli5: 'Each stockroom keeps a spare copy of its shelf list in another building. If one room burns down, its own spare takes over. The other rooms are untouched.',
      body: [
        'Sharding does not replace replication. Each shard is a small primary with its own replicas for reads and failover. A failure takes out one slice, not the whole data set.',
        'Sharding adds write capacity. Replication adds read capacity and durability. Big systems use both.',
      ],
      keyIdea: 'Sharding and replication solve different problems. Production setups have shards, and replicas inside each shard.',
      metrics: { shards: '4', writes: '24K/s', hottest: '6K w/s', size: '4 TB', moved: '-' },
      scene: {
        nodes: [
          shard(0, { at: at(0, -3.8), status: 'ok', badge: 'primary, 6K w/s' }),
          { id: 'ra', kind: 'replica', at: at(-3.2, 3.8), label: 'replica A', sub: 'reads' },
          { id: 'rb', kind: 'replica', at: at(3.2, 3.8), label: 'replica B', sub: 'failover' },
        ],
        links: [link('s0', 'ra', { style: 'dashed' }), link('s0', 'rb', { style: 'dashed' })],
        flows: [
          { path: ['s0', 'ra'], tone: 'data', count: 3, duration: 1.3 },
          { path: ['s0', 'rb'], tone: 'data', count: 3, duration: 1.3, delay: 0.2 },
        ],
        panel: {
          title: 'Two levers',
          icon: 'Layers',
          rows: [
            { text: 'Sharding', value: 'more writes, more space', tone: 'good' },
            { text: 'Replication', value: 'more reads, survive loss', tone: 'good' },
          ],
        },
      },
    },
    {
      title: 'Range',
      tag: 'concept',
      heading: 'Range sharding: each shard owns a span of keys',
      eli5: '**Range sharding** sorts toys by the month they arrived: an August room, a September room, and so on. Finding all September toys is easy, because they all sit together.',
      body: [
        '**Range sharding** gives each shard a continuous span of the key. Shard posts by month: shard 0 holds August, shard 1 September, and so on.',
        'Neighbors stay together, so range queries are cheap. "All posts from September" touches one shard.',
      ],
      keyIdea: 'Range sharding keeps neighbors together, which makes scans cheap.',
      metrics: { shards: '4', writes: '24K/s', hottest: '-', size: '4 TB', moved: '-' },
      scene: {
        nodes: [
          { ...router, chips: ['month = Sep'] },
          shard(0, { sub: 'Aug' }),
          shard(1, { sub: 'Sep', status: 'active', badge: 'one shard' }),
          shard(2, { sub: 'Oct' }),
          shard(3, { sub: 'Nov' }),
        ],
        links: fanTo(all4),
        flows: [{ path: ['router', 's1'], tone: 'request', label: 'posts in Sep', duration: 1.4 }],
        panel: {
          title: 'Key spans',
          icon: 'Table',
          rows: [
            { text: 'shard 0', value: 'Aug' },
            { text: 'shard 1', value: 'Sep', tone: 'good' },
            { text: 'shard 2', value: 'Oct' },
            { text: 'shard 3', value: 'Nov' },
          ],
          footer: { text: 'Range scan hits 1 shard', tone: 'good' },
        },
      },
    },
    {
      title: 'Range hotspot',
      tag: 'case',
      heading: 'Case: every new post lands on the same shard',
      eli5: 'Every toy that arrives today has today\'s month, so the delivery truck always unloads into the November room. The other three rooms sit quiet with old toys.',
      body: [
        'Every post written today has today\'s date, so **all 24K writes/s land on shard 3** while the other three hold old data. You sharded and still have one machine taking every write.',
        'Range sharding works when writes spread across the key space, such as usernames A to F, G to M. It fails with keys that only grow: timestamps and auto-increment ids.',
      ],
      keyIdea: 'A key that only grows sends every new write to the last range. Never range-shard on time or a counter alone.',
      metrics: { shards: '4', writes: '24K/s', hottest: '24K w/s', size: '4 TB', moved: '-' },
      metricTones: { hottest: 'bad' },
      scene: {
        nodes: [
          { ...router, chips: ['created_at = today'] },
          shard(0, { status: 'dim', sub: 'Aug' }),
          shard(1, { status: 'dim', sub: 'Sep' }),
          shard(2, { status: 'dim', sub: 'Oct' }),
          shard(3, { status: 'hot', sub: 'Nov (today)', load: 99, badge: '24K w/s' }),
        ],
        links: fanTo(all4, { style: 'faint' }),
        flows: [{ path: ['router', 's3'], tone: 'request', label: 'created_at = today', count: 6, duration: 1.4 }],
        panel: {
          title: 'Writes per shard',
          icon: 'Gauge',
          rows: [
            { text: 'shard 0, 1, 2', value: '0 w/s', tone: 'muted' },
            { text: 'shard 3', value: '24K w/s', tone: 'bad' },
          ],
          footer: { text: 'Same bottleneck as before', tone: 'bad' },
        },
      },
    },
    {
      title: 'Hash',
      tag: 'concept',
      heading: 'Hash sharding: scramble the key, spread the load',
      eli5: '**Hash sharding** gives each toy a number from a scrambling machine, and the number picks the room. Toys spread evenly over all four rooms, but toys that arrived together now sit in different rooms.',
      body: [
        '**Hash sharding** runs the shard key through a hash function and takes the result modulo the number of shards: `shard = hash(user_id) % 4`. A good hash scatters even sequential ids evenly, so each shard gets about a quarter of the writes.',
        'The price is range queries. Users 1000 to 2000 are spread over all four shards, so a range means asking every shard.',
      ],
      keyIdea: 'Hashing trades range scans for an even spread. For write-heavy tables that is usually the right trade.',
      metrics: { shards: '4', writes: '24K/s', hottest: '6.1K w/s', size: '4 TB', moved: '-' },
      metricTones: { hottest: 'good' },
      scene: {
        nodes: [
          { ...router, chips: ['hash(user_id) % 4'] },
          shard(0, { status: 'ok', badge: '5.9K' }),
          shard(1, { status: 'ok', badge: '6.1K' }),
          shard(2, { status: 'ok', badge: '6.0K' }),
          shard(3, { status: 'ok', badge: '6.0K' }),
        ],
        links: fanTo(all4),
        flows: [[8, 2], [9, 0], [10, 3], [11, 1]].map(([u, sh], i) => ({ path: ['router', `s${sh}`], tone: 'request' as const, label: `user ${u}`, duration: 1.2, delay: i * 0.3 })),
        panel: {
          title: 'user_id → shard',
          icon: 'Hash',
          rows: [
            { text: 'user 8', value: 'shard 2' },
            { text: 'user 9', value: 'shard 0' },
            { text: 'user 10', value: 'shard 3' },
            { text: 'user 11', value: 'shard 1' },
          ],
          footer: { text: 'Neighbors land apart', tone: 'muted' },
        },
      },
      code: {
        language: 'python',
        title: 'Routing a write by hash',
        source: `import hashlib

N_SHARDS = 4
shards = [connect(f"postgres://posts-shard-{i}:5432/app") for i in range(N_SHARDS)]

def shard_for(user_id: int) -> int:
    digest = hashlib.md5(str(user_id).encode()).digest()
    return int.from_bytes(digest[:8], "big") % N_SHARDS

def save_post(user_id: int, body: str):
    db = shards[shard_for(user_id)]          # one shard, chosen by the key
    db.execute("INSERT INTO posts (user_id, body) VALUES (%s, %s)",
               (user_id, body))`,
        highlight: [8, 11],
      },
    },
    {
      title: 'Compound key',
      tag: 'concept',
      heading: 'Compound keys: hash the first part, sort the rest',
      eli5: 'The shop first picks a room by scrambling the owner\'s name, then inside the room lines the owner\'s toys up by date. One owner stays in one room, and their toys are still in order.',
      body: [
        'A **compound key** has two parts. Hash the first part (`user_id`) to pick the shard. Keep the second part (`created_at`) sorted inside that shard. Cassandra and DynamoDB call these the partition key and the sort key.',
        'Now "user 7\'s posts from last week" is one shard and one sorted range scan. You keep even spread across users and cheap ranges inside one user.',
      ],
      keyIdea: 'Hash to spread, sort within. A compound key gives even load across users and fast range scans for one user.',
      metrics: { shards: '4', writes: '24K/s', hottest: '6.1K w/s', size: '4 TB', moved: '-' },
      scene: {
        nodes: [
          { ...router, chips: ['user 7, last week'] },
          shard(2, { status: 'active', badge: 'sorted by created_at' }),
          shard(0, { status: 'dim' }),
        ],
        links: [link('router', 's2'), link('router', 's0', { style: 'faint' })],
        flows: [{ path: ['router', 's2'], tone: 'request', label: 'user 7, range', duration: 1.4 }],
        panel: {
          title: 'On shard 2',
          icon: 'Table',
          code: 'PRIMARY KEY (\n  user_id,      -- hashed: picks shard\n  created_at    -- sorted inside it\n)',
          footer: { text: '1 shard, 1 range scan', tone: 'good' },
        },
      },
    },
    {
      title: 'Directory',
      tag: 'concept',
      heading: 'Directory sharding: a lookup table decides',
      eli5: 'The **directory** is a notebook that says which room each customer has. The shopkeeper checks it first, and can move one big customer into a room of their own by changing one line.',
      body: [
        '**Directory sharding** keeps an explicit map from key to shard. The router asks "where does tenant 42 live?" and gets back "shard 2". You can move one big customer to its own shard by updating a row.',
        'The directory is now on every request path. It must be fast and highly available, so it is cached in the router and stored in something replicated, such as etcd or a small SQL table with replicas.',
      ],
      keyIdea: 'A directory buys full control over placement, at the cost of one more lookup and one more thing that must never go down.',
      metrics: { shards: '4', writes: '24K/s', hottest: '6.1K w/s', size: '4 TB', moved: '-' },
      scene: {
        nodes: [
          { ...router, at: at(-3.6, -3.8), status: 'active', chips: ['tenant 42'] },
          { id: 'directory', kind: 'block', at: at(3.6, -3.8), label: 'directory', sub: 'key → shard', icon: 'List', tint: 'teal', status: 'active' },
          shard(2, { status: 'ok', badge: 'big tenant 42' }),
        ],
        links: [link('router', 'directory', { arrow: 'both', style: 'dashed' }), link('router', 's2')],
        flows: [
          { path: ['router', 'directory'], tone: 'request', label: 'where is 42?', duration: 0.9 },
          { path: ['directory', 'router'], tone: 'response', label: 'shard 2', duration: 0.9, delay: 1 },
          { path: ['router', 's2'], tone: 'request', duration: 1.2, delay: 2 },
        ],
        panel: {
          title: 'Directory table',
          icon: 'Table',
          rows: [
            { text: 'tenants 1-40', value: 'shard 0' },
            { text: 'tenants 41, 43-90', value: 'shard 1' },
            { text: 'tenant 42 only', value: 'shard 2', tone: 'warn' },
            { text: 'tenants 91+', value: 'shard 3' },
          ],
          footer: { text: 'Move a tenant: update one row', tone: 'good' },
        },
      },
    },
    {
      title: 'Shard key',
      tag: 'tradeoff',
      heading: 'Choosing the shard key',
      eli5: 'The **shard key** is the label the shopkeeper sorts by. Sort by owner, and all of one kid\'s toys sit in one room, so one trip fetches them all.',
      body: [
        'The shard key is the hardest part to change later, so check three things. **Cardinality**: enough distinct values to spread across many shards (country has about 200, user_id has millions). **Even load**: no single value takes a large share of the traffic. **Query locality**: the most common queries include the key, so they hit one shard.',
        'Start from your top queries, then pick the key that keeps them on one shard.',
      ],
      keyIdea: 'A good shard key spreads writes evenly and keeps the most common query on a single shard.',
      metrics: { shards: '4', writes: '24K/s', hottest: '6.1K w/s', size: '4 TB', moved: '-' },
      scene: {
        nodes: [
          { ...router, chips: ['posts of user 7'] },
          shard(2, { status: 'active', badge: 'all of user 7' }),
        ],
        links: [link('router', 's2')],
        flows: [
          { path: ['router', 's2'], tone: 'request', duration: 1.2 },
          { path: ['s2', 'router'], tone: 'response', label: '20 posts', duration: 1.2, delay: 1.4 },
        ],
        panel: {
          title: 'Candidate keys for posts',
          icon: 'KeyRound',
          rows: [
            { text: 'user_id', value: 'passes all three', tone: 'good' },
            { text: 'post_id', value: 'scatters a user', tone: 'warn' },
            { text: 'created_at', value: 'uneven load', tone: 'bad' },
            { text: 'country', value: '~200 values', tone: 'bad' },
          ],
        },
        caption: 'One user, one shard, one query',
      },
      quiz: {
        question: 'A chat app\'s most common query is "last 50 messages in conversation X". Which shard key fits best?',
        options: ['hash(message_id)', 'conversation_id', 'sent_at (range)', 'sender\'s country'],
        answer: 1,
        explain: 'conversation_id keeps every message of a conversation on one shard, so the top query touches one machine, and there are millions of conversations to spread. message_id scatters the conversation, sent_at piles new writes on one shard, and country has low cardinality.',
      },
    },
    {
      title: 'Celebrity',
      tag: 'case',
      heading: 'Case: one user melts one shard',
      eli5: 'One super popular toy brings a huge crowd, and they all squeeze into shard 1, the room where it lives. That crowded room is a **hot partition**. Scrambling cannot help, because one toy lives in one room.',
      body: [
        'A pop star with 80 million followers posts. Their posts and everything attached to them (likes, replies, view counters) live on the shard that owns their `user_id`. For the next hour shard 1 takes **14K writes/s** while the others take 3K.',
        'This is a **hot partition**, also called the celebrity problem. Hashing does not help, because it is all one key and one key always maps to one shard.',
      ],
      keyIdea: 'An even hash spreads keys, not traffic. One hot key still lands on one shard.',
      metrics: { shards: '4', writes: '24K/s', hottest: '14K w/s', size: '4 TB', moved: '-' },
      metricTones: { hottest: 'bad' },
      scene: {
        nodes: [
          { ...router, chips: [{ text: 'likes on @popstar', tone: 'warn' }] },
          shard(0, { badge: '3K' }),
          shard(1, { status: 'hot', load: 96, badge: '14K w/s', sub: '@popstar' }),
          shard(2, { badge: '3K' }),
          shard(3, { badge: '4K' }),
        ],
        links: fanTo(all4),
        flows: [
          { path: ['router', 's1'], tone: 'request', label: 'likes on @popstar', count: 7, duration: 1.3 },
          { path: ['router', 's0'], tone: 'request', duration: 1.3, delay: 0.5 },
          { path: ['router', 's3'], tone: 'request', duration: 1.3, delay: 0.9 },
        ],
        panel: {
          title: 'Writes per shard',
          icon: 'Gauge',
          rows: [
            { text: 'shard 0', value: '3K', tone: 'good' },
            { text: 'shard 1 (@popstar)', value: '14K', tone: 'bad' },
            { text: 'shard 2', value: '3K', tone: 'good' },
            { text: 'shard 3', value: '4K', tone: 'good' },
          ],
        },
      },
    },
    {
      title: 'Hot key fixes',
      tag: 'tradeoff',
      heading: 'Fixes target the hot key itself',
      eli5: 'For the one crowded toy, the shop keeps eight copies of its shelf slot in eight rooms, puts a display at the front, or gives it a room of its own.',
      body: [
        '**Split the key.** Add a suffix (`popstar:7#0` to `popstar:7#7`) so the key becomes 8 sub-keys that spread over all 4 shards. A read must then fan in over all 8 slices.',
        '**Cache it.** Put a cache in front of its reads. **Isolate it.** Give known celebrities their own dedicated shard through a directory entry. Pick by what is hot: writes need splitting, reads need caching.',
      ],
      keyIdea: 'A single hot key needs its own treatment: split it, cache it, or isolate it.',
      metrics: { shards: '4', writes: '24K/s', hottest: '6.5K w/s', size: '4 TB', moved: '-' },
      metricTones: { hottest: 'good' },
      scene: {
        nodes: [
          { ...router, chips: ['popstar:7#0..#7'] },
          shard(0, { status: 'ok', badge: '#0, #4' }),
          shard(1, { status: 'ok', badge: '#1, #5' }),
          shard(2, { status: 'ok', badge: '#2, #6' }),
          shard(3, { status: 'ok', badge: '#3, #7' }),
        ],
        links: fanTo(all4),
        flows: [0, 1, 2, 3].map((i) => ({ path: ['router', `s${i}`], tone: 'request' as const, label: `popstar:7#${i}`, duration: 1.2, delay: i * 0.25 })),
        panel: {
          title: 'Three fixes',
          icon: 'Split',
          rows: [
            { text: 'Split key with suffix', value: 'spreads writes', tone: 'good' },
            { text: 'Cache in front', value: 'absorbs reads', tone: 'good' },
            { text: 'Dedicated shard', value: 'isolates damage', tone: 'good' },
          ],
          footer: { text: 'Split key: read must fan in 8 slices', tone: 'warn' },
        },
      },
    },
    {
      title: 'Cross-shard',
      tag: 'tradeoff',
      heading: 'Queries without the shard key go everywhere',
      eli5: 'Someone asks for every red toy, but the rooms are not sorted by color. The shopkeeper has to ask all four rooms and wait for the slowest one. That is **scatter-gather**.',
      body: [
        '"Top posts tagged #f1 this week" does not mention a user, so the router cannot know where the rows are. It sends the query to **every shard** and merges the results. This is **scatter-gather**: it costs N times the work, and the answer waits for the slowest shard.',
        'The usual answer is to store data in the shape you query: keep a copy of the tag index in a search engine or a separate table sharded by tag.',
      ],
      keyIdea: 'Every query that lacks the shard key becomes N queries. Design so the hot paths always carry it.',
      metrics: { shards: '4', writes: '24K/s', hottest: '6.1K w/s', size: '4 TB', moved: '-' },
      metricTones: { hottest: 'warn' },
      scene: {
        nodes: [
          { ...router, status: 'active', chips: ['tag = f1'], badge: 'merge + sort' },
          shard(0, { badge: '40 ms' }),
          shard(1, { badge: '45 ms' }),
          shard(2, { status: 'hot', badge: '140 ms (slowest)' }),
          shard(3, { badge: '42 ms' }),
        ],
        links: fanTo(all4),
        flows: [
          ...[0, 1, 2, 3].map((i) => ({ path: ['router', `s${i}`], tone: 'request' as const, duration: 1, delay: 0 })),
          { path: ['s0', 'router'], tone: 'response' as const, duration: 1, delay: 1.2 },
          { path: ['s1', 'router'], tone: 'response' as const, duration: 1, delay: 1.3 },
          { path: ['s3', 'router'], tone: 'response' as const, duration: 1, delay: 1.4 },
          { path: ['s2', 'router'], tone: 'response' as const, duration: 1, delay: 2.6 },
        ],
        panel: {
          title: 'Cost of no key',
          icon: 'Timer',
          rows: [
            { text: 'Shards queried', value: '4 of 4', tone: 'warn' },
            { text: 'Rows merged', value: '4 x 20', tone: 'warn' },
            { text: 'Latency', value: 'slowest, 140 ms', tone: 'bad' },
          ],
        },
      },
      code: {
        language: 'sql',
        title: 'One shard or all of them',
        source: `-- routed: the shard key is in the WHERE clause, 1 shard
SELECT * FROM posts
WHERE user_id = 7
ORDER BY created_at DESC LIMIT 20;

-- scatter-gather: no shard key, runs on all 4 shards
SELECT * FROM posts
WHERE tag = 'f1'
ORDER BY likes DESC LIMIT 20;
-- router merges 4 x 20 rows, re-sorts, keeps the top 20`,
        highlight: [3, 8, 10],
      },
    },
    {
      title: 'Joins',
      tag: 'tradeoff',
      heading: 'Joins across shards happen in the app',
      eli5: 'A parent wants each doll with its matching dress, but they sit in different rooms. The shopkeeper fetches both and matches them at the counter. Better still, keep a doll and its dress in the same room.',
      body: [
        'The database cannot join a row on shard 0 with a row on shard 3. The app fetches both sides and joins them in memory, which costs two round trips and extra code.',
        'Two ways to avoid it. **Co-locate** rows that join together by giving them the same shard key. Or **denormalize**: copy the few fields you need into the row you already read.',
      ],
      keyIdea: 'Put data that is joined together on one shard, or copy what you need. Otherwise the app pays for every join.',
      metrics: { shards: '4', writes: '24K/s', hottest: '6.1K w/s', size: '4 TB', moved: '-' },
      scene: {
        nodes: [
          { ...app, chips: ['join user 7 + posts'] },
          shard(0, { sub: 'user 7', status: 'active' }),
          shard(3, { sub: 'posts of user 7', status: 'active' }),
        ],
        links: [link('app', 's0'), link('app', 's3')],
        flows: [
          { path: ['app', 's0'], tone: 'request', label: 'get user', duration: 1 },
          { path: ['app', 's3'], tone: 'request', label: 'get posts', duration: 1 },
          { path: ['s0', 'app'], tone: 'response', duration: 1, delay: 1.2 },
          { path: ['s3', 'app'], tone: 'response', duration: 1, delay: 1.3 },
        ],
        panel: {
          title: 'Three ways to join',
          icon: 'Table',
          rows: [
            { text: 'Fetch both, join in app', value: '2 round trips', tone: 'warn' },
            { text: 'Same shard key', value: 'join stays local', tone: 'good' },
            { text: 'Denormalize', value: 'no join needed', tone: 'good' },
          ],
        },
      },
      quiz: {
        question: 'An order and its line items are always read and written together. How should they be sharded?',
        options: ['Orders by order_id, items by item_id', 'Both by order_id, so they share a shard', 'Items by created_at', 'Orders on one shard, all items on another'],
        answer: 1,
        explain: 'Sharding both tables by order_id puts an order and its items on the same shard. The join and the write stay local, with no cross-shard transaction.',
      },
    },
    {
      title: 'Cross-shard writes',
      tag: 'tradeoff',
      heading: 'Writes across shards need agreement',
      eli5: 'A parent wants to swap a toy from the doll room with one from the train room, all at once. No single shopkeeper can do both, so two keepers must agree before either one moves a toy.',
      body: [
        'A transaction across two shards needs **two-phase commit**: every shard prepares, then all commit, and locks are held in between. A **saga** instead runs one local transaction per shard and undoes finished steps if a later one fails. Both are slower and more complex than a single-shard write, so design to avoid them.',
      ],
      keyIdea: 'Put data that is updated together on one shard. Cross-shard writes cost extra round trips and locks.',
      metrics: { shards: '4', writes: '24K/s', hottest: '6.1K w/s', size: '4 TB', moved: '-' },
      scene: {
        nodes: [
          { ...router, chips: ['move 10 from A to B'] },
          shard(0, { sub: 'account A', status: 'active', badge: '-10' }),
          shard(3, { sub: 'account B', status: 'active', badge: '+10' }),
        ],
        links: [link('router', 's0', { label: 'prepare, commit', labelTone: 'warn' }), link('router', 's3', { label: 'prepare, commit', labelTone: 'warn' })],
        flows: [
          { path: ['router', 's0'], tone: 'handshake', label: 'prepare', duration: 1 },
          { path: ['router', 's3'], tone: 'handshake', label: 'prepare', duration: 1 },
          { path: ['s0', 'router'], tone: 'response', label: 'ok', duration: 1, delay: 1.2 },
          { path: ['s3', 'router'], tone: 'response', label: 'ok', duration: 1, delay: 1.2 },
          { path: ['router', 's0'], tone: 'request', label: 'commit', duration: 1, delay: 2.4 },
          { path: ['router', 's3'], tone: 'request', label: 'commit', duration: 1, delay: 2.4 },
        ],
        panel: {
          title: 'Two shards, two rounds',
          icon: 'Repeat',
          rows: [
            { text: 'Single shard write', value: '1 round trip', tone: 'good' },
            { text: 'Two-phase commit', value: '2 rounds, locks held', tone: 'warn' },
            { text: 'Saga', value: 'steps + undo', tone: 'warn' },
          ],
        },
      },
    },
    {
      title: 'Local index',
      tag: 'concept',
      heading: 'Secondary indexes: each shard indexes its own rows',
      eli5: 'Each stockroom keeps its own list of toys by color. To find every red toy in the shop, you must read all four lists, because each list covers only its own room.',
      body: [
        'Queries often filter on a column that is not the shard key, such as `email`. The simple option is a **local index**: each shard indexes only its own rows.',
        'Writes stay fast because they touch one shard. Reads by `email` still scatter to every shard, since any shard may hold the match.',
      ],
      keyIdea: 'A local secondary index is cheap to write and slow to read by anything other than the shard key.',
      metrics: { shards: '4', writes: '24K/s', hottest: '6.1K w/s', size: '4 TB', moved: '-' },
      scene: {
        nodes: [
          { ...router, chips: ['email = a@x.com'] },
          shard(0, { badge: 'local email idx' }),
          shard(1, { badge: 'local email idx' }),
          shard(2, { badge: 'local email idx', status: 'active' }),
          shard(3, { badge: 'local email idx' }),
        ],
        links: fanTo(all4),
        flows: all4.map((id, i) => ({ path: ['router', id], tone: 'request' as const, duration: 1.2, delay: i * 0.1 })),
        panel: {
          title: 'Local index',
          icon: 'Search',
          rows: [
            { text: 'Write', value: '1 shard', tone: 'good' },
            { text: 'Read by shard key', value: '1 shard', tone: 'good' },
            { text: 'Read by email', value: 'all shards', tone: 'bad' },
          ],
        },
      },
    },
    {
      title: 'Global index',
      tag: 'tradeoff',
      heading: 'A global index trades write cost for fast reads',
      eli5: 'The shop keeps one master list of toys by color in the front office. Finding red toys is one look. But every new toy now needs two updates: its room, and the master list.',
      body: [
        'A **global index** is its own sharded table keyed by `email`. A lookup reads one index shard, which holds the user_id, then one data shard.',
        'The cost is on writes: creating or changing a user row now updates two shards, the data shard and the email index shard, and the index is usually updated async, so it can lag a little behind the data.',
      ],
      keyIdea: 'A global index makes reads fast and writes costlier, and it is often slightly stale.',
      metrics: { shards: '4', writes: '24K/s', hottest: '6.1K w/s', size: '4 TB', moved: '-' },
      scene: {
        nodes: [
          { ...router, chips: ['email = a@x.com'] },
          { id: 'eidx', kind: 'block', at: at(-3.2, 3.8), label: 'email index', sub: 'sharded by email', icon: 'Search', tint: 'teal', status: 'active', badge: 'a@x.com → user 7' },
          shard(2, { at: at(3.2, 3.8), status: 'ok', badge: 'user 7' }),
        ],
        links: [link('router', 'eidx'), link('router', 's2')],
        flows: [
          { path: ['router', 'eidx'], tone: 'request', label: 'a@x.com', duration: 1 },
          { path: ['eidx', 'router'], tone: 'response', label: 'user 7', duration: 1, delay: 1.1 },
          { path: ['router', 's2'], tone: 'request', label: 'user 7', duration: 1.2, delay: 2.2 },
          { path: ['s2', 'eidx'], tone: 'event', label: 'async update', duration: 1.4, delay: 3.6 },
        ],
        panel: {
          title: 'Global index',
          icon: 'Search',
          rows: [
            { text: 'Read by email', value: '2 shards', tone: 'good' },
            { text: 'Write a user row', value: '2 shards', tone: 'warn' },
            { text: 'Freshness', value: 'may lag', tone: 'warn' },
          ],
        },
      },
    },
    {
      title: 'Unique ids',
      tag: 'concept',
      heading: 'Sharded tables need ids that do not collide',
      eli5: 'If every stockroom numbers its toys 1, 2, 3, two rooms will hand out the same number. Each toy needs a ticket number that no room can repeat.',
      body: [
        'An auto-increment id is per database. Shard 0 and shard 3 both hand out id 1001 and collide. A single central counter becomes a bottleneck and a single point of failure.',
        'A **Snowflake-style id** assembles 64 bits locally: a timestamp, a machine id and a per-millisecond sequence. It needs no coordination and sorts roughly by time.',
      ],
      keyIdea: 'Generate ids without asking a central counter. Timestamp + machine + sequence gives unique, time-sorted ids.',
      metrics: { shards: '4', writes: '24K/s', hottest: '6.1K w/s', size: '4 TB', moved: '-' },
      scene: {
        nodes: [
          shard(0, { at: at(-3.2, -3.8), status: 'hot', chips: [{ text: 'id = 1001', tone: 'bad' }] }),
          shard(3, { at: at(3.2, -3.8), status: 'hot', chips: [{ text: 'id = 1001', tone: 'bad' }] }),
          { id: 'idgen', kind: 'block', at: at(0, 3.8), label: 'id built locally', sub: 'time + machine + seq', icon: 'Binary', tint: 'green', status: 'ok' },
        ],
        links: [link('s0', 'idgen', { style: 'dashed' }), link('s3', 'idgen', { style: 'dashed' })],
        flows: [
          { path: ['s0', 'idgen'], tone: 'request', label: 'new id', duration: 1.3 },
          { path: ['s3', 'idgen'], tone: 'request', label: 'new id', duration: 1.3, delay: 0.3 },
        ],
        panel: {
          title: '64-bit id layout',
          icon: 'Binary',
          rows: [
            { text: 'timestamp', value: '41 bits' },
            { text: 'machine id', value: '10 bits' },
            { text: 'sequence', value: '12 bits' },
          ],
          footer: { text: '4096 ids per ms per machine', tone: 'muted' },
        },
      },
      code: {
        language: 'python',
        title: 'A Snowflake-style id',
        source: `import time

EPOCH = 1_700_000_000_000      # custom start, in ms

def next_id(machine: int, seq: int) -> int:
    ms = int(time.time() * 1000) - EPOCH
    return (ms << 22) | (machine << 12) | seq   # 41 + 10 + 12 bits

# machine is 0..1023, seq counts 0..4095 within one millisecond`,
        highlight: [6, 7],
      },
    },
    {
      title: 'Resharding',
      tag: 'case',
      heading: 'Case: adding a fifth shard moves 80% of the data',
      eli5: 'The shop opens a fifth room, shard 4, and the room-picking rule changes for almost every toy. Four out of five toys must be carried to a different room. That big move is **resharding**.',
      body: [
        'Growth continues and the team adds shard 4. With `hash % 4` changed to `hash % 5`, a key stays put only if both give the same answer. That is true for just **20% of keys**. The other 80% belong somewhere else: **12.8 TB** of the 16 TB has to move.',
        'The fix is a placement scheme where adding one shard moves only its fair share, about 1/5 of the keys. That is **consistent hashing**, the next lesson.',
      ],
      keyIdea: 'With hash % N, changing N reshuffles almost everything. Plan for growth before you need it.',
      metrics: { shards: '5', writes: '24K/s', hottest: '4.8K w/s', size: '3.2 TB', moved: '80% · 12.8 TB' },
      metricTones: { moved: 'bad' },
      scene: {
        nodes: [
          shard5(0, { status: 'hot' }),
          shard5(1, { status: 'hot' }),
          shard5(2, { status: 'hot' }),
          shard5(3, { status: 'hot' }),
          shard5(4, { status: 'active', sub: 'new', badge: 'filling...' }),
        ],
        links: [link('s0', 's1', { style: 'faint', route: 'straight' }), link('s1', 's2', { style: 'faint', route: 'straight' }), link('s2', 's3', { style: 'faint', route: 'straight' }), link('s3', 's4', { style: 'faint', route: 'straight' })],
        flows: [
          { path: ['s0', 's1'], tone: 'data', duration: 1.4 },
          { path: ['s1', 's2'], tone: 'data', duration: 1.4, delay: 0.3 },
          { path: ['s2', 's3'], tone: 'data', duration: 1.4, delay: 0.6 },
          { path: ['s3', 's4'], tone: 'data', label: 'move rows', count: 3, duration: 1.4, delay: 0.9 },
        ],
        panel: {
          title: 'hash % 4 → hash % 5',
          icon: 'ArrowLeftRight',
          rows: [
            { text: 'Keys that stay', value: '20%', tone: 'good' },
            { text: 'Keys that move', value: '80%', tone: 'bad' },
            { text: 'Data to move', value: '12.8 TB of 16', tone: 'bad' },
          ],
        },
        caption: '80% of keys change owner',
      },
      code: {
        language: 'python',
        title: 'How many keys move from % 4 to % 5?',
        source: `keys = range(1_000_000)          # pretend these are hash values

moved = sum(1 for h in keys if h % 4 != h % 5)
print(moved / len(keys))          # 0.8  -> 80% change shard

# with consistent hashing, adding a 5th node moves about 1/5 of keys`,
        highlight: [3, 4],
      },
    },
    {
      title: 'Logical shards',
      tag: 'concept',
      heading: 'Pre-split into many logical shards',
      eli5: 'The shop labels toys with 1,024 small bins from day one, and puts several bins in each room. A new room just takes over a few whole bins. No toy is relabeled.',
      body: [
        'Create far more **logical shards** than machines, say 1,024, and map each to a physical node. The key picks the logical shard with `hash % 1024`, and that never changes.',
        'To add capacity, move whole logical shards to the new machine and update the map. Only the moved bins travel, and no key gets a new logical shard.',
      ],
      keyIdea: 'Fix the number of logical shards early. Growing then means moving whole logical shards, not rehashing keys.',
      metrics: { shards: '1024 logical', writes: '24K/s', hottest: '6K → 4.8K w/s', size: '4 TB → 3.2 TB', moved: '1/5 only' },
      metricTones: { moved: 'good' },
      scene: {
        nodes: [
          { id: 'm4', kind: 'db', at: at(0, -3.8), label: 'machine 4', sub: 'new', status: 'active', chips: ['bins 204'] },
          { id: 'm0', kind: 'db', at: at(-4.8, 3.8), label: 'machine 0', chips: ['bins 205'] },
          { id: 'm1', kind: 'db', at: at(-1.6, 3.8), label: 'machine 1', chips: ['bins 205'] },
          { id: 'm2', kind: 'db', at: at(1.6, 3.8), label: 'machine 2', chips: ['bins 205'] },
          { id: 'm3', kind: 'db', at: at(4.8, 3.8), label: 'machine 3', chips: ['bins 205'] },
        ],
        links: [link('m0', 'm4', { style: 'dashed' }), link('m1', 'm4', { style: 'dashed' }), link('m2', 'm4', { style: 'dashed' }), link('m3', 'm4', { style: 'dashed' })],
        flows: ['m0', 'm1', 'm2', 'm3'].map((m, i) => ({ path: [m, 'm4'], tone: 'data' as const, label: i === 0 ? 'move bins' : undefined, duration: 1.6, delay: i * 0.3 })),
        panel: {
          title: 'Add machine 4',
          icon: 'Split',
          rows: [
            { text: 'Key to logical shard', value: 'hash % 1024, fixed', tone: 'good' },
            { text: 'Bins moved', value: '~51 per old machine, 205 total', tone: 'good' },
            { text: 'Rows rehashed', value: '0', tone: 'good' },
          ],
        },
      },
    },
    {
      title: 'Online move',
      tag: 'concept',
      heading: 'Moving a shard while traffic keeps flowing',
      eli5: 'The shop carries a bin to the new room while customers still shop. New toys go on both shelves first. Then old toys are carried over without replacing fresher ones, counts are checked, and customers switch rooms.',
      body: [
        'A live move has five stages. First start **dual-write** (or capture a change log), so every new write reaches old and new. Then **backfill** existing rows by copy, throttled, and never overwrite a newer row. Verify counts and checksums, switch reads to the new shard, then stop dual-write and delete the old copy.',
        'Throughout, both shards still serve traffic, so throttle the backfill. A rollback stays possible until the old data is deleted.',
      ],
      keyIdea: 'Dual-write, backfill, verify, switch, delete. Keep the old copy until the new one is proven.',
      metrics: { shards: '5', writes: '24K/s', hottest: '4.8K w/s', size: '3.2 TB', moved: '1/5 · 3.2 TB' },
      scene: {
        nodes: [
          { ...router, status: 'active', chips: ['dual-write'] },
          shard5(1, { sub: 'old', status: 'hot', load: 78 }),
          shard5(4, { sub: 'new', status: 'active', badge: 'catching up' }),
        ],
        links: [link('router', 's1'), link('router', 's4'), link('s1', 's4', { style: 'dashed', route: 'straight', label: 'backfill copy' })],
        flows: [
          { path: ['router', 's1'], tone: 'request', label: 'write', duration: 1.2 },
          { path: ['router', 's4'], tone: 'request', label: 'write', duration: 1.2 },
          { path: ['s1', 's4'], tone: 'data', count: 3, duration: 1.6, delay: 1.5 },
        ],
        panel: {
          title: 'Online move stages',
          icon: 'List',
          rows: [
            { text: '1. Start dual-write', value: 'old + new', tone: 'warn' },
            { text: '2. Backfill by copy', value: 'throttled, keep newer rows' },
            { text: '3. Verify', value: 'row counts, checksums' },
            { text: '4. Switch reads', value: 'to new', tone: 'good' },
            { text: '5. Stop dual-write, delete old', value: 'last', tone: 'good' },
          ],
        },
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Split the data, then live with the seams',
      eli5: 'One stockroom got too full, so the shop split its toys into rooms. That is **sharding**. Pick the sorting label with care, so the rooms fill evenly and most trips need only one room.',
      body: [
        'Shard when writes or data size outgrow one primary and cheaper levers are spent. **Range** keeps neighbors together and suffers on growing keys. **Hash** spreads load and loses range scans. **Directory** gives full control and adds a lookup.',
        'Choose a key with high cardinality, even load and query locality. Watch for hot keys, keep the key in hot queries, plan ids and indexes, and expect `% N` resharding to move most of the data.',
      ],
      keyIdea: 'Sharding buys write capacity. The shard key decides whether you also get even load and single-shard queries.',
      metrics: { shards: '4', writes: '24K/s', hottest: '6.1K w/s', size: '4 TB', moved: '-' },
      metricTones: { hottest: 'good', size: 'good' },
      scene: {
        nodes: [router, shard(0, { status: 'ok' }), shard(1, { status: 'ok' }), shard(2, { status: 'ok' }), shard(3, { status: 'ok' })],
        links: fanTo(all4),
        flows: all4.map((id, i) => ({ path: ['router', id], tone: 'request' as const, duration: 1.2, delay: i * 0.2 })),
        panel: {
          title: 'Sharding checklist',
          icon: 'List',
          rows: [
            { text: 'Cheaper levers spent', value: 'yes', tone: 'good' },
            { text: 'Key: cardinality, load, locality', value: 'checked', tone: 'good' },
            { text: 'Hot keys', value: 'split, cache, isolate', tone: 'warn' },
            { text: 'Ids and indexes', value: 'planned', tone: 'good' },
            { text: 'Growth', value: 'logical shards', tone: 'good' },
          ],
        },
      },
      quiz: {
        question: 'You shard by hash(user_id) % 8 and need to grow to 9 shards. Roughly how much data has to move?',
        options: ['About 11%', 'About 50%', 'About 89%', 'None, only new users go to shard 8'],
        answer: 2,
        explain: 'A key stays only if h % 8 equals h % 9, which holds for 8 of every 72 values (about 11%). So about 89% moves. Consistent hashing would move only about 1/9.',
      },
    },
  ],
};
