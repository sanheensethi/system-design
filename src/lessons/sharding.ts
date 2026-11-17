import type { Lesson, SceneNode, SceneZone } from '../engine/types';

const server: SceneNode = { id: 'server', kind: 'server', at: [-2.9, 2.9], label: 'app server' };
const router: SceneNode = { id: 'router', kind: 'gateway', at: [-0.9, 0.9], label: 'shard router', sub: 'app lib or proxy' };
const directory: SceneNode = { id: 'directory', kind: 'service', at: [1, 4.7], label: 'directory', sub: 'key → shard' };
const s0: SceneNode = { id: 's0', kind: 'shard', at: [2.2, 1.6], label: 'shard 0' };
const s1: SceneNode = { id: 's1', kind: 'shard', at: [2.2, -0.3], label: 'shard 1' };
const s2: SceneNode = { id: 's2', kind: 'shard', at: [2.2, -2.2], label: 'shard 2' };
const s3: SceneNode = { id: 's3', kind: 'shard', at: [2.2, -4.1], label: 'shard 3' };
const s4: SceneNode = { id: 's4', kind: 'shard', at: [2.2, -6.0], label: 'shard 4', sub: 'new' };

const db: SceneNode = { id: 'db', kind: 'db', at: [0.9, -0.9], label: 'primary' };
const r1: SceneNode = { id: 'r1', kind: 'replica', at: [1.1, -4.1], label: 'replica 1' };
const r2: SceneNode = { id: 'r2', kind: 'replica', at: [4.1, -1.1], label: 'replica 2' };

/** A square floor zone around a shard node. */
function zone(n: SceneNode, label: string, tone: SceneZone['tone'] = 'blue'): SceneZone {
  const h = 0.78;
  return { id: `z-${n.id}`, from: [n.at[0] - h, n.at[1] - h], to: [n.at[0] + h, n.at[1] + h], label, tone };
}

const shardLinks = [
  { from: 'server', to: 'router' },
  { from: 'router', to: 's0' },
  { from: 'router', to: 's1' },
  { from: 'router', to: 's2' },
  { from: 'router', to: 's3' },
];

const hashZones = [zone(s0, 'hash % 4 = 0'), zone(s1, 'hash % 4 = 1'), zone(s2, 'hash % 4 = 2'), zone(s3, 'hash % 4 = 3')];

export const sharding: Lesson = {
  id: 'sharding',
  title: 'Sharding',
  tagline: 'When one primary cannot take the writes, split the data so each machine owns a slice.',
  minutes: 14,
  level: 'Intermediate',
  learn: [
    'When sharding is the answer, and when replicas are enough',
    'Range, hash and directory sharding, and what each is good at',
    'How to choose a shard key',
    'Hot partitions and the celebrity problem',
    'Why cross-shard queries and resharding hurt',
  ],
  metrics: [
    { key: 'shards', label: 'Shards' },
    { key: 'writes', label: 'Total writes' },
    { key: 'hottest', label: 'Hottest node' },
    { key: 'size', label: 'Data per node' },
    { key: 'moved', label: 'Data moved' },
  ],
  steps: [
    {
      title: 'Write wall',
      tag: 'problem',
      heading: 'Replicas did not save us this time',
      eli5: 'The toy shop keeps every toy in one giant stockroom, the **primary**, and trucks bring new toys faster than it can shelve them. Copies of the room do not help, because each copy must shelve every toy too.',
      body: [
        'A social app stores every post in one PostgreSQL primary. Peak traffic is now **24K writes/s**, and one primary sustains roughly 5K to 20K depending on hardware. The table holds **16 TB**, well past the 2 to 10 TB where backups and schema changes become painful.',
        'Adding replicas does not help. Every replica must replay every write, so each one is as busy as the primary. Every copy carries the full write load.',
      ],
      keyIdea: 'Replicas scale reads. When writes or data size outgrow one machine, you have to split the data itself.',
      metrics: { shards: '1', writes: '24K/s', hottest: '24K w/s', size: '16 TB', moved: '-' },
      scene: {
        nodes: [server, { ...db, status: 'hot', badge: '24K writes/s · 16 TB' }, { ...r1, status: 'hot', badge: 'replays 24K/s' }, { ...r2, status: 'hot', badge: 'replays 24K/s' }],
        links: [
          { from: 'server', to: 'db' },
          { from: 'db', to: 'r1', style: 'dashed' },
          { from: 'db', to: 'r2', style: 'dashed' },
        ],
        flows: [
          { path: ['server', 'db'], tone: 'request', label: 'INSERT post', count: 6, duration: 1.4 },
          { path: ['db', 'r1'], tone: 'data', count: 4, duration: 1.2, delay: 0.8 },
          { path: ['db', 'r2'], tone: 'data', count: 4, duration: 1.2, delay: 0.8 },
        ],
        caption: 'Every copy carries every write',
      },
    },
    {
      title: 'Split data',
      tag: 'concept',
      heading: 'Sharding: each machine owns a slice',
      eli5: '**Sharding** splits the toys into four smaller stockrooms, so each room shelves only a quarter of the deliveries. The shopkeeper at the door, the shard router, knows which room each toy goes to.',
      body: [
        '**Sharding** (also called partitioning) splits the rows across several independent databases. Each **shard** holds a slice and takes only the writes for that slice. Four shards turn 24K writes/s and 16 TB into **6K writes/s and 4 TB** per machine.',
        'Something must know which shard holds which row. That is the **shard router**: a library in the app, or a proxy such as Vitess vtgate or mongos. It looks at the **shard key** of each query and sends it to the right place.',
        'Each shard still gets its own replicas for reads and failover. Sharding and replication solve different problems, and big systems use both.',
      ],
      keyIdea: 'Sharding is the lever that adds write capacity and storage. Each shard owns 1/N of the data and 1/N of the writes.',
      metrics: { shards: '4', writes: '24K/s', hottest: '6K w/s', size: '4 TB', moved: '-' },
      scene: {
        zones: [zone(s0, 'slice 0'), zone(s1, 'slice 1'), zone(s2, 'slice 2'), zone(s3, 'slice 3')],
        nodes: [server, { ...router, status: 'active' }, { ...s0, badge: '6K w/s' }, { ...s1, badge: '6K w/s' }, { ...s2, badge: '6K w/s' }, { ...s3, badge: '6K w/s' }],
        links: shardLinks,
        flows: [
          { path: ['server', 'router'], tone: 'request', count: 4, duration: 1 },
          { path: ['router', 's0'], tone: 'request', duration: 1.2, delay: 1.1 },
          { path: ['router', 's1'], tone: 'request', duration: 1.2, delay: 1.1 },
          { path: ['router', 's2'], tone: 'request', duration: 1.2, delay: 1.1 },
          { path: ['router', 's3'], tone: 'request', duration: 1.2, delay: 1.1 },
        ],
      },
    },
    {
      title: 'Range',
      tag: 'concept',
      heading: 'Range sharding: each shard owns a span of keys',
      eli5: '**Range sharding** sorts toys by the month they arrived: an August room, a September room, and so on. Finding all September toys is easy, but every toy that arrives today goes to the same room.',
      body: [
        '**Range sharding** gives each shard a continuous span of the key. Shard posts by month and shard 0 holds August, shard 1 September, and so on. Range queries are cheap: "all posts from September" touches one shard.',
        'Now look at where new posts go. Every post written today has today\'s date, so **all 24K writes/s land on shard 3** while the other three sit idle with old data. You sharded and still have one machine taking every write.',
        'Range sharding works when writes spread across the key space, such as usernames A to F, G to M. It fails with keys that only grow: timestamps and auto-increment ids.',
      ],
      keyIdea: 'Range sharding keeps neighbors together, which is great for scans and terrible when every new key is a neighbor of the last one.',
      metrics: { shards: '4', writes: '24K/s', hottest: '24K w/s', size: '4 TB', moved: '-' },
      scene: {
        zones: [zone(s0, 'Aug', 'gray'), zone(s1, 'Sep', 'gray'), zone(s2, 'Oct', 'gray'), zone(s3, 'Nov (today)', 'red')],
        nodes: [server, router, { ...s0, status: 'dim' }, { ...s1, status: 'dim' }, { ...s2, status: 'dim' }, { ...s3, status: 'hot', badge: '24K w/s' }],
        links: shardLinks,
        flows: [
          { path: ['server', 'router'], tone: 'request', count: 4, duration: 1 },
          { path: ['router', 's3'], tone: 'request', label: 'created_at = today', count: 6, duration: 1.4, delay: 1.1 },
        ],
      },
    },
    {
      title: 'Hash',
      tag: 'concept',
      heading: 'Hash sharding: scramble the key, spread the load',
      eli5: '**Hash sharding** gives each toy a number from a scrambling machine, and the number picks the room. Toys spread evenly over all four rooms, but toys that arrived together now sit in different rooms.',
      body: [
        '**Hash sharding** runs the shard key through a hash function and takes the result modulo the number of shards: `shard = hash(user_id) % 4`. A good hash scatters even sequential ids evenly, so each shard gets about a quarter of the writes.',
        'The price is range queries. Users 1000 to 2000 are now spread over all four shards, so "everything in this range" means asking every shard.',
        'Most systems pick hash sharding on an id. Keep the `% N` in mind, though. It comes back to hurt us when we add a fifth shard.',
      ],
      keyIdea: 'Hashing trades range scans for an even spread. For write-heavy tables that is usually the right trade.',
      metrics: { shards: '4', writes: '24K/s', hottest: '6.1K w/s', size: '4 TB', moved: '-' },
      scene: {
        zones: hashZones,
        nodes: [server, { ...router, badge: 'hash(user_id) % 4' }, { ...s0, status: 'ok', badge: '5.9K' }, { ...s1, status: 'ok', badge: '6.1K' }, { ...s2, status: 'ok', badge: '6.0K' }, { ...s3, status: 'ok', badge: '6.0K' }],
        links: shardLinks,
        flows: [
          { path: ['server', 'router'], tone: 'request', count: 4, duration: 1 },
          { path: ['router', 's0'], tone: 'request', label: 'user 8', duration: 1.2, delay: 1.1 },
          { path: ['router', 's1'], tone: 'request', label: 'user 9', duration: 1.2, delay: 1.3 },
          { path: ['router', 's2'], tone: 'request', label: 'user 10', duration: 1.2, delay: 1.5 },
          { path: ['router', 's3'], tone: 'request', label: 'user 11', duration: 1.2, delay: 1.7 },
        ],
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
      title: 'Directory',
      tag: 'concept',
      heading: 'Directory sharding: a lookup table decides',
      eli5: 'The **directory** is a notebook that says which room each customer has. The shopkeeper checks it first, and can move one big customer into a room of their own by changing one line.',
      body: [
        '**Directory sharding** keeps an explicit map from key to shard. The router asks the directory "where does tenant 42 live?" and gets back "shard 2".',
        'This is the most flexible scheme. You can move one big customer to its own shard, or rebalance one key at a time, by updating a row. SaaS products with uneven tenants often use it.',
        'The directory is now on every request path. It must be fast and highly available, so it is cached in the router and stored in something replicated, such as etcd or a small SQL table with replicas.',
      ],
      keyIdea: 'A directory buys full control over placement, at the cost of one more lookup and one more thing that must never go down.',
      metrics: { shards: '4', writes: '24K/s', hottest: '6.1K w/s', size: '4 TB', moved: '-' },
      scene: {
        zones: [zone(s0, 'tenants 1-40'), zone(s1, 'tenants 41, 43-90'), zone(s2, 'tenant 42 only', 'amber'), zone(s3, 'tenants 91+')],
        nodes: [server, { ...router, status: 'active' }, { ...directory, status: 'active', badge: '42 → shard 2' }, s0, s1, { ...s2, status: 'ok', badge: 'big tenant' }, s3],
        links: [...shardLinks, { from: 'router', to: 'directory', style: 'dashed' }],
        flows: [
          { path: ['server', 'router'], tone: 'request', label: 'tenant 42', duration: 1 },
          { path: ['router', 'directory'], tone: 'request', label: 'where is 42?', duration: 0.9, delay: 1.1 },
          { path: ['directory', 'router'], tone: 'response', label: 'shard 2', duration: 0.9, delay: 2.1 },
          { path: ['router', 's2'], tone: 'request', duration: 1.2, delay: 3.1 },
        ],
      },
    },
    {
      title: 'Shard key',
      tag: 'tradeoff',
      heading: 'Choosing the shard key',
      eli5: 'The **shard key** is the label the shopkeeper sorts by. Sort by owner, and all of one kid\'s toys sit in one room, so one trip fetches them all.',
      body: [
        'The shard key is the hardest part to change later, so check three things. **Cardinality**: enough distinct values to spread across many shards (country has about 200, user_id has millions). **Even load**: no single value takes a large share of the traffic. **Query locality**: the most common queries include the key, so they hit one shard.',
        'For posts, `user_id` passes all three: loading one user\'s profile reads one shard. `post_id` spreads writes perfectly but scatters each user\'s posts over every shard. `created_at` fails even load, as we saw.',
        'Start from your top queries, then pick the key that keeps them on one shard.',
      ],
      keyIdea: 'A good shard key spreads writes evenly and keeps the most common query on a single shard.',
      metrics: { shards: '4', writes: '24K/s', hottest: '6.1K w/s', size: '4 TB', moved: '-' },
      scene: {
        zones: hashZones,
        nodes: [server, { ...router, badge: 'key = user_id' }, s0, s1, { ...s2, status: 'active', badge: 'all of user 7' }, s3],
        links: shardLinks,
        flows: [
          { path: ['server', 'router'], tone: 'request', label: 'posts of user 7', duration: 1 },
          { path: ['router', 's2'], tone: 'request', duration: 1.2, delay: 1.1 },
          { path: ['s2', 'router', 'server'], tone: 'response', label: '20 posts', duration: 1.6, delay: 2.4 },
        ],
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
        'The fixes target the hot key itself. Split its writes by adding a suffix (`user:42#0` to `user:42#7`) so they spread over 8 shards, then fan in on read. Put a cache in front of its reads. Or give known celebrities their own dedicated shard through a directory entry.',
      ],
      keyIdea: 'An even hash spreads keys, not traffic. A single hot key needs its own treatment: split it, cache it, or isolate it.',
      metrics: { shards: '4', writes: '24K/s', hottest: '14K w/s', size: '4 TB', moved: '-' },
      scene: {
        zones: [zone(s0, 'hash % 4 = 0'), zone(s1, '@popstar lives here', 'red'), zone(s2, 'hash % 4 = 2'), zone(s3, 'hash % 4 = 3')],
        nodes: [server, router, { ...s0, badge: '3K' }, { ...s1, status: 'hot', badge: '14K w/s' }, { ...s2, badge: '3K' }, { ...s3, badge: '4K' }],
        links: shardLinks,
        flows: [
          { path: ['server', 'router'], tone: 'request', count: 5, duration: 1 },
          { path: ['router', 's1'], tone: 'request', label: 'likes on @popstar', count: 7, duration: 1.3, delay: 1 },
          { path: ['router', 's0'], tone: 'request', duration: 1.3, delay: 1.4 },
          { path: ['router', 's3'], tone: 'request', duration: 1.3, delay: 1.8 },
        ],
      },
    },
    {
      title: 'Cross-shard',
      tag: 'tradeoff',
      heading: 'Queries without the shard key go everywhere',
      eli5: 'Someone asks for every red toy, but the rooms are not sorted by color. The shopkeeper has to ask all four rooms and wait for the slowest one. That is **scatter-gather**.',
      body: [
        '"Top posts tagged #f1 this week" does not mention a user, so the router cannot know where the rows are. It sends the query to **every shard** and merges the results. This is **scatter-gather**: it costs N times the work, and the answer waits for the slowest shard.',
        'Joins across shards are worse. The database cannot join a row on shard 0 with a row on shard 3, so the app fetches both and joins in memory. A transaction across two shards needs two-phase commit or a saga, and both are slow and complex.',
        'The usual answer is to store data in the shape you query: keep a copy of the tag index in a search engine or a separate table sharded by tag.',
      ],
      keyIdea: 'Every query that lacks the shard key becomes N queries. Design so the hot paths always carry it.',
      metrics: { shards: '4', writes: '24K/s', hottest: '6.1K w/s', size: '4 TB', moved: '-' },
      scene: {
        zones: hashZones,
        nodes: [server, { ...router, status: 'active', badge: 'merge + sort' }, s0, s1, { ...s2, status: 'hot', badge: '140 ms (slowest)' }, s3],
        links: shardLinks,
        flows: [
          { path: ['server', 'router'], tone: 'request', label: 'tag = f1', duration: 1 },
          { path: ['router', 's0'], tone: 'request', duration: 1, delay: 1.1 },
          { path: ['router', 's1'], tone: 'request', duration: 1, delay: 1.1 },
          { path: ['router', 's2'], tone: 'request', duration: 1, delay: 1.1 },
          { path: ['router', 's3'], tone: 'request', duration: 1, delay: 1.1 },
          { path: ['s0', 'router'], tone: 'response', duration: 1, delay: 2.2 },
          { path: ['s1', 'router'], tone: 'response', duration: 1, delay: 2.3 },
          { path: ['s3', 'router'], tone: 'response', duration: 1, delay: 2.4 },
          { path: ['s2', 'router'], tone: 'response', duration: 1, delay: 3.6 },
        ],
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
      title: 'Resharding',
      tag: 'case',
      heading: 'Case: adding a fifth shard moves 80% of the data',
      eli5: 'The shop opens a fifth room, shard 4, and the room-picking rule changes for almost every toy. Four out of five toys must be carried to a different room. That big move is **resharding**.',
      body: [
        'Growth continues and the team adds shard 4. With `hash % 4` changed to `hash % 5`, a key stays put only if both give the same answer. That is true for just **20% of keys**. The other 80% now belong somewhere else: **12.8 TB** of the 16 TB has to move.',
        'Moving it live is a project: copy rows in the background, write to both old and new locations, verify, switch reads over, then delete. Meanwhile every shard is busy sending data while still serving traffic.',
        'The fix is a placement scheme where adding one shard moves only its fair share, about 1/5 of the keys. That is **consistent hashing**, the next lesson.',
      ],
      keyIdea: 'With hash % N, changing N reshuffles almost everything. Plan for growth before you need it.',
      metrics: { shards: '5', writes: '24K/s', hottest: '6.1K w/s', size: '3.2 TB', moved: '80% · 12.8 TB' },
      scene: {
        zones: [zone(s0, 'hash % 5 = 0'), zone(s1, 'hash % 5 = 1'), zone(s2, 'hash % 5 = 2'), zone(s3, 'hash % 5 = 3'), zone(s4, 'hash % 5 = 4', 'green')],
        nodes: [server, router, { ...s0, status: 'hot' }, { ...s1, status: 'hot' }, { ...s2, status: 'hot' }, { ...s3, status: 'hot' }, { ...s4, status: 'active', badge: 'filling…' }],
        links: [...shardLinks, { from: 'router', to: 's4' }],
        flows: [
          { path: ['s0', 's1'], tone: 'data', duration: 1.4 },
          { path: ['s1', 's2'], tone: 'data', duration: 1.4, delay: 0.3 },
          { path: ['s2', 's3'], tone: 'data', duration: 1.4, delay: 0.6 },
          { path: ['s3', 's4'], tone: 'data', label: 'move rows', count: 3, duration: 1.4, delay: 0.9 },
          { path: ['s2', 's1'], tone: 'data', duration: 1.4, delay: 1.6 },
          { path: ['s1', 's0'], tone: 'data', duration: 1.4, delay: 1.9 },
        ],
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
      title: 'Recap',
      tag: 'recap',
      heading: 'Split the data, then live with the seams',
      eli5: 'One stockroom got too full, so the shop split its toys into rooms. That is **sharding**. Pick the sorting label with care, so the rooms fill evenly and most trips need only one room.',
      body: [
        'Shard when writes or data size outgrow one primary. Replicas will not help there. **Range** keeps neighbors together and suffers on growing keys. **Hash** spreads load and loses range scans. **Directory** gives full control and adds a lookup.',
        'Choose a shard key with high cardinality, even load and query locality. Watch for hot keys, keep the shard key in hot queries to avoid scatter-gather, and expect resharding with `% N` to move most of the data.',
      ],
      keyIdea: 'Sharding buys write capacity. The shard key decides whether you also get even load and single-shard queries.',
      metrics: { shards: '4', writes: '24K/s', hottest: '6.1K w/s', size: '4 TB', moved: '-' },
      scene: {
        zones: hashZones,
        nodes: [server, router, { ...s0, status: 'ok' }, { ...s1, status: 'ok' }, { ...s2, status: 'ok' }, { ...s3, status: 'ok' }],
        links: shardLinks,
        flows: [
          { path: ['server', 'router'], tone: 'request', count: 4, duration: 1 },
          { path: ['router', 's0'], tone: 'request', duration: 1.2, delay: 1.1 },
          { path: ['router', 's1'], tone: 'request', duration: 1.2, delay: 1.3 },
          { path: ['router', 's2'], tone: 'request', duration: 1.2, delay: 1.5 },
          { path: ['router', 's3'], tone: 'request', duration: 1.2, delay: 1.7 },
        ],
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
