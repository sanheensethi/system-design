import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const app: SceneNode = { id: 'app', kind: 'server', at: at(-4.2, -3.6), label: 'app server', sub: 'one of 400' };
const lib: SceneNode = { id: 'lib', kind: 'block', size: 0.8, at: at(-0.6, -3.6), label: 'client lib', sub: 'knows the ring', icon: 'Hash', tint: 'violet' };
const db: SceneNode = { id: 'db', kind: 'db', at: at(0, 8.8), label: 'database', sub: 'source of truth' };
const n1: SceneNode = { id: 'n1', kind: 'cache', at: at(-4.2, 0.8), label: 'node A', sub: '512 GB' };
const n2: SceneNode = { id: 'n2', kind: 'cache', at: at(-1.4, 0.8), label: 'node B', sub: '512 GB' };
const n3: SceneNode = { id: 'n3', kind: 'cache', at: at(1.4, 0.8), label: 'node C', sub: '512 GB' };
const n4: SceneNode = { id: 'n4', kind: 'cache', at: at(4.2, 0.8), label: 'node D', sub: '512 GB' };

export const designDistributedCache: Lesson = {
  id: 'design-distributed-cache',
  title: 'Design a distributed cache',
  tagline: 'Pool the RAM of two thousand boxes into one key-value cache that answers in under a millisecond and survives losing nodes.',
  minutes: 22,
  level: 'Advanced',
  learn: [
    'Size a cache tier from working set, QPS and value size',
    'The GET, SET and DEL API, TTLs, and what a node stores in memory',
    'Why hash modulo N fails, and how the ring and virtual nodes fix it',
    'Client-side routing, hot keys, replicas and the gutter pool',
    'Write patterns, the delete race, and invalidation from the database log',
    'Multi-tier caching, cold starts, request coalescing and negative caching',
  ],
  metrics: [
    { key: 'qps', label: 'Cache QPS', icon: 'Gauge' },
    { key: 'hit', label: 'Hit ratio', icon: 'Target' },
    { key: 'p99', label: 'p99 read', icon: 'Timer' },
    { key: 'dbqps', label: 'DB QPS', icon: 'Database' },
  ],
  steps: [
    {
      title: 'Requirements',
      tag: 'problem',
      heading: 'A database that cannot take 20 million reads a second',
      eli5: 'A giant library has one basement archive. Thousands of readers shout for the same few popular books all day, and the one archivist cannot keep up.',
      body: [
        '**Functional:** `GET`, `SET` and `DEL` on string keys, values up to 1 MB, a TTL on every key, and optional replicas.',
        '**Non-functional:** p99 read under 1 ms, scale to thousands of nodes, and survive a node dying without a stampede on the database. The product serves 20M reads per second from a 1 PB hot set, spread over 400 app servers (about 50k reads/s each).',
      ],
      keyIdea: 'A distributed cache is RAM pooled across many boxes, addressed by key, whose job is to keep the database at a calm load.',
      metrics: { qps: '20M/s', hit: '?', p99: '< 1 ms goal', dbqps: '20M/s' },
      metricTones: { dbqps: 'bad' },
      scene: {
        nodes: [
          { ...app, status: 'active', chips: ['50k reads/s'] },
          { ...db, status: 'hot', load: 100, badge: 'dead at 50k/s' },
        ],
        links: [link('app', 'db', { label: 'every read', labelTone: 'warn' })],
        flows: [{ path: ['app', 'db'], tone: 'request', count: 4, label: 'GET user:42', duration: 1.2 }],
        panel: {
          title: 'The target',
          icon: 'Target',
          rows: [
            { text: 'Reads', value: '20M/s' },
            { text: 'App servers', value: '400, 20M/s total' },
            { text: 'Hot working set', value: '1 PB' },
            { text: 'Read p99', value: '< 1 ms' },
            { text: 'Value size p50', value: '1 KB' },
            { text: 'Database can serve', value: '~50k/s', tone: 'bad' },
          ],
        },
        caption: 'The database alone is 400 times too small',
      },
    },
    {
      title: 'Sizing',
      tag: 'concept',
      heading: 'Napkin math: 2,000 nodes, and RAM sets the count',
      eli5: 'Each front-room shelf holds only so many books. To hold the whole popular collection you count how many shelves you need, then check the hallway is wide enough for the readers.',
      body: [
        '1 PB of hot data on 512 GB nodes is about **2,000 nodes**. 20M reads/s over 2,000 nodes is **10k QPS per node**.',
        'One core serves roughly 100k small GETs per second, so CPU use is about 10% of one core. With 1 KB values the cluster moves 20 GB/s, which is 160 Gbps total or about 80 Mbps per node, tiny for a 10 Gbps NIC.',
        'Both CPU and network sit far below their limits, so RAM capacity sets the node count. Throughput becomes the limit only with large values or hot keys.',
      ],
      keyIdea: 'Size the tier from working set over node RAM, then check QPS per node and bandwidth. With small values RAM sets the node count, and throughput only bites with large values or hot keys.',
      metrics: { qps: '20M/s', hit: '?', p99: '< 1 ms goal', dbqps: '?' },
      scene: {
        nodes: [
          { ...app, size: 0.9 },
          { ...n2, chips: ['10k QPS'], load: 10 },
          { ...n3, chips: ['10k QPS'], load: 10 },
        ],
        links: [link('app', 'n2'), link('app', 'n3')],
        flows: [
          { path: ['app', 'n2'], tone: 'request', label: 'GET', duration: 1 },
          { path: ['n2', 'app'], tone: 'response', label: '1 KB', duration: 1, delay: 1.1 },
        ],
        panel: {
          title: 'Capacity math',
          icon: 'Calculator',
          rows: [
            { text: '1 PB / 512 GB', value: '~2,000 nodes' },
            { text: '20M / 2,000', value: '10k QPS/node' },
            { text: 'One core serves', value: '~100k GET/s', tone: 'good' },
            { text: '20 GB/s total', value: '160 Gbps' },
            { text: 'Per node', value: '~80 Mbps of 10 Gbps', tone: 'muted' },
            { text: 'At 70% RAM utilization', value: '~2,900 nodes', tone: 'muted' },
          ],
        },
        caption: 'CPU and NIC have headroom, RAM sets the count',
      },
    },
    {
      title: 'API',
      tag: 'concept',
      heading: 'The API: three verbs and a TTL',
      eli5: 'The front desk understands three phrases: "bring me the book called X", "keep this book under name X for a while", and "throw away X".',
      body: [
        '`GET key` returns the value or a miss. `SET key value ttl` stores it and replaces any old one. `DEL key` removes it.',
        'Values are opaque bytes up to 1 MB, so the cache never parses them. Every key carries a **TTL**, so even a missed invalidation heals itself when the time runs out.',
      ],
      keyIdea: 'The cache API is deliberately tiny. Opaque values and a TTL on every key keep nodes simple and mistakes self-healing.',
      metrics: { qps: '20M/s', hit: '?', p99: '< 1 ms goal', dbqps: '?' },
      scene: {
        nodes: [
          { ...app, chips: ['GET user:42'] },
          { ...lib, label: 'cache API', sub: 'GET SET DEL', status: 'active' },
          { ...n2, chips: [{ text: 'hit: 1 KB', tone: 'good' }] },
        ],
        links: [link('app', 'lib'), link('lib', 'n2')],
        flows: [
          { path: ['app', 'lib', 'n2'], tone: 'request', label: 'GET user:42', duration: 1.6 },
          { path: ['n2', 'lib', 'app'], tone: 'response', label: 'value', duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'The whole contract',
          icon: 'Code',
          code: 'GET key              -> value | miss\nSET key value ttl    -> ok\nDEL key              -> ok\n\nvalue: opaque bytes, max 1 MB\nttl:   seconds, always set',
        },
        caption: 'Three verbs, opaque values',
      },
      code: {
        language: 'typescript',
        title: 'The client interface',
        source: `interface Cache {
  get(key: string): Promise<Uint8Array | null>;      // null means miss
  set(key: string, value: Uint8Array, ttlSec: number): Promise<void>;
  del(key: string): Promise<void>;
}

// Typical use: cache-aside with a TTL
async function getUser(id: string) {
  const hit = await cache.get(\`user:\${id}\`);
  if (hit) return decode(hit);
  const row = await db.queryUser(id);
  await cache.set(\`user:\${id}\`, encode(row), 300);
  return row;
}`,
        highlight: [2, 3, 9, 11],
      },
    },
    {
      title: 'Inside a node',
      tag: 'concept',
      heading: 'Data model: slabs, a hash table and an LRU per slab',
      eli5: 'Each shelf is split into sections for thin books, medium books and fat books. When a section is full, the book nobody has touched longest goes out to make room.',
      body: [
        'A node keeps a **hash table** from key to item, and items in RAM. A **slab allocator** splits memory into size classes (say 96 B, 120 B, 152 B and so on up to 1 MB), so freed space is reused without fragmentation.',
        'Each slab class has its own **LRU** list. When a class is full, the least recently used item goes. An expired TTL is checked lazily on read, with a background sweep for the rest.',
      ],
      keyIdea: 'A node is a hash table plus slab classes with an LRU each. Memory is fixed, so eviction is normal and not a failure.',
      metrics: { qps: '10k/node', hit: '?', p99: '< 1 ms goal', dbqps: '?' },
      scene: {
        nodes: [{ ...n2, at: at(0, 0), size: 1.3, status: 'active', label: 'cache node', sub: '512 GB RAM', chips: ['hash table', 'slab classes', 'LRU per slab'] }],
        panel: {
          title: 'One item in memory',
          icon: 'Table',
          rows: [
            { text: 'key', value: 'user:42' },
            { text: 'value', value: 'opaque bytes' },
            { text: 'expires_at', value: 'now + 300 s' },
            { text: 'slab class', value: '1 KB chunk' },
            { text: 'LRU links', value: 'prev, next' },
          ],
          footer: { text: 'Full class: evict least recently used', tone: 'muted' },
        },
        caption: 'Fixed RAM, so eviction is part of normal life',
      },
    },
    {
      title: 'One node',
      tag: 'concept',
      heading: 'The simple design: one cache in front of the database',
      eli5: 'Put one shelf of popular books by the front door. Readers check the shelf first and only bother the basement when the book is missing.',
      body: [
        'Start with **cache-aside**, covered in the caching lesson. The app asks the cache first. On a miss it reads the database and stores the result with a TTL.',
        'At a 99.9% hit ratio the database sees 0.1% of the traffic. That is the whole point of the tier, as long as one box can hold the data and take the load.',
      ],
      keyIdea: 'One cache node plus cache-aside already removes almost all reads from the database. The rest of the lesson is what to do when one box is not enough.',
      metrics: { qps: '20k/s', hit: '99.9%', p99: '0.5 ms', dbqps: '20/s' },
      metricTones: { hit: 'good', dbqps: 'good' },
      scene: {
        nodes: [{ ...app, chips: ['GET user:42'] }, { ...n2, status: 'ok', badge: 'hit' }, { ...db, status: 'dim' }],
        links: [link('app', 'n2'), link('n2', 'db', { style: 'dashed', label: '0.1% miss' })],
        flows: [
          { path: ['app', 'n2'], tone: 'request', label: 'GET', duration: 1.2 },
          { path: ['n2', 'app'], tone: 'response', label: 'hit', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Per 20,000 reads/s',
          icon: 'Gauge',
          rows: [
            { text: 'Served by cache', value: '19,980', tone: 'good' },
            { text: 'Reach the database', value: '20', tone: 'good' },
          ],
        },
        caption: 'Cache-aside with one node',
      },
    },
    {
      title: 'One box breaks',
      tag: 'case',
      heading: 'Where one node breaks: RAM, bandwidth and a single point of failure',
      eli5: 'One shelf cannot hold the whole collection, one shelf cannot hand out books fast enough, and when the shelf falls over every reader runs to the basement at once.',
      body: [
        'A single box has maybe 512 GB of RAM against a 1 PB working set. It tops out near 100k GETs per second and one NIC, far short of 20M.',
        'It is also one failure domain. When it dies, 100% of reads hit the database in the same second. We need many nodes, and a rule for which key lives where.',
      ],
      keyIdea: 'One node fails three ways at once: not enough memory, not enough throughput, and its death puts all traffic on the database.',
      metrics: { qps: '20M/s', hit: '0.05%', p99: 'timeouts', dbqps: '20M/s' },
      metricTones: { hit: 'bad', p99: 'bad', dbqps: 'bad' },
      scene: {
        nodes: [{ ...app, size: 0.9 }, { ...n2, status: 'hot', load: 100, badge: '0.05% of data' }, { ...db, status: 'hot', load: 100 }],
        links: [link('app', 'n2', { label: '20M/s', labelTone: 'warn' }), link('n2', 'db', { label: 'misses', labelTone: 'warn' })],
        flows: [
          { path: ['app', 'n2'], tone: 'request', count: 4, duration: 1.1 },
          { path: ['n2', 'db'], tone: 'error', count: 3, label: 'miss', duration: 1.3, delay: 0.4 },
        ],
        panel: {
          title: 'One node versus the target',
          icon: 'Scale',
          rows: [
            { text: 'RAM', value: '512 GB of 1 PB', tone: 'bad' },
            { text: 'Reads', value: '100k of 20M/s', tone: 'bad' },
            { text: 'If it dies', value: '100% to DB', tone: 'bad' },
          ],
        },
        caption: 'One node cannot hold the set or the load',
      },
    },
    {
      title: 'Modulo N',
      tag: 'concept',
      heading: 'First attempt: node = hash(key) % N',
      eli5: 'Give every book a number and every shelf a number. Divide the book number by the shelf count and the leftover tells you the shelf. Simple, and no map is needed.',
      body: [
        'Hash the key, take it modulo the node count. Every client computes the same answer with no coordination, and keys spread evenly.',
        'It works fine while `N` never changes. That condition is the catch: in a fleet of 2,000 boxes, nodes are added and removed every week.',
      ],
      keyIdea: 'Modulo hashing gives even spread and zero coordination, but it ties every key to the value of N.',
      metrics: { qps: '20M/s', hit: '99.9%', p99: '0.5 ms', dbqps: '20k/s' },
      metricTones: { hit: 'good' },
      scene: {
        nodes: [{ ...lib, label: 'hash % 4', sub: 'client lib', status: 'active' }, n1, n2, n3, n4],
        links: [link('lib', 'n1', { label: '0' }), link('lib', 'n2', { label: '1' }), link('lib', 'n3', { label: '2' }), link('lib', 'n4', { label: '3' })],
        flows: [{ path: ['lib', 'n3'], tone: 'request', label: 'user:42 -> 2', duration: 1.4 }],
        panel: {
          title: 'N = 4',
          icon: 'Hash',
          rows: [
            { text: 'hash(user:42) = 4,217', value: '% 4 = 1' },
            { text: 'hash(user:77) = 9,130', value: '% 4 = 2' },
            { text: 'hash(cart:5) = 3,555', value: '% 4 = 3' },
          ],
          footer: { text: 'Same N on every client, same answer', tone: 'good' },
        },
        caption: 'Every client agrees without talking',
      },
    },
    {
      title: 'Reshuffle',
      tag: 'case',
      heading: 'Case: add one node and 80% of the cache goes cold',
      eli5: 'The library adds a fifth shelf and renumbers the sums. Almost every book now belongs on a different shelf, so every reader walks to an empty spot and then to the basement.',
      body: [
        'Go from N = 4 to N = 5. A key keeps its node only when `h % 4 == h % 5`, so about 80% of keys move. For 2,000 nodes going to 2,001, it is over 99.9%.',
        'Those keys are now looked up on a node that never saw them. Hit ratio collapses and the database eats a stampede. The caching lesson covers the stampede itself. The cause here is the hash rule.',
      ],
      keyIdea: 'With modulo hashing, changing N relocates almost every key. Growing or losing one node looks like flushing the whole cache.',
      metrics: { qps: '20M/s', hit: '20%', p99: '40 ms', dbqps: '16M/s' },
      metricTones: { hit: 'bad', p99: 'bad', dbqps: 'bad' },
      quiz: {
        question: 'A fleet using hash(key) % N grows from 2,000 to 2,001 nodes. Roughly how many keys keep their node?',
        options: ['About 99.9%, one node is a tiny change', 'About 0.05%, nearly all keys move', 'Exactly half of them', 'None, the cache is flushed on purpose'],
        answer: 1,
        explain: 'A key stays only when h % 2000 equals h % 2001, which is rare. Nearly all keys move, so the hit ratio collapses and the database takes the load. Consistent hashing exists to prevent this.',
      },
      scene: {
        nodes: [{ ...lib, label: 'hash % 5', sub: 'N changed', status: 'active' }, { ...n2, status: 'hot', badge: 'cold' }, { ...n3, status: 'hot', badge: 'cold' }, { ...db, status: 'hot', load: 100 }],
        links: [link('lib', 'n2'), link('lib', 'n3'), link('n2', 'db', { style: 'dashed' }), link('n3', 'db', { style: 'dashed' })],
        flows: [
          { path: ['lib', 'n2', 'db'], tone: 'error', label: 'miss', count: 3, duration: 1.6 },
          { path: ['lib', 'n3', 'db'], tone: 'error', label: 'miss', count: 3, duration: 1.6, delay: 0.5 },
        ],
        panel: {
          title: 'Keys that keep their node',
          icon: 'Table',
          rows: [
            { text: '4 to 5 nodes', value: '20%', tone: 'warn' },
            { text: '100 to 101 nodes', value: '~1%', tone: 'bad' },
            { text: '2,000 to 2,001 nodes', value: '~0.05%', tone: 'bad' },
          ],
          footer: { text: 'The database takes the stampede', tone: 'bad' },
        },
        caption: 'One new node, a near-total reshuffle',
      },
    },
    {
      title: 'The ring',
      tag: 'concept',
      heading: 'Fix: place nodes and keys on a ring',
      eli5: 'Instead of numbering shelves, stand them around a big circular hallway. A book goes to the first shelf you meet walking clockwise from where the book sits. A new shelf only takes books from its neighbor.',
      body: [
        'The consistent hashing lesson explains the ring in full. Nodes and keys hash onto the same circle, and a key belongs to the first node clockwise.',
        'Adding a node steals keys from one neighbor only. Removing one hands its keys to the next node. On average only **1/N** of keys move, so one node out of 2,000 moves 0.05%.',
      ],
      keyIdea: 'On a ring a membership change moves about 1/N of the keys, not nearly all of them.',
      metrics: { qps: '20M/s', hit: '99.85%', p99: '0.6 ms', dbqps: '30k/s' },
      metricTones: { hit: 'good' },
      scene: {
        nodes: [
          { ...n1, at: at(-3.2, -1.6), label: 'node A', sub: 'at 0°' },
          { ...n2, at: at(0, -3.4), label: 'node B', sub: 'at 120°' },
          { ...n3, at: at(3.2, -1.6), label: 'node C', sub: 'at 240°', status: 'dim' },
          { id: 'n5', kind: 'cache', at: at(0, 2.6), label: 'node E', sub: 'new', status: 'active', chips: ['takes 1/N'] },
        ],
        links: [link('n1', 'n2', { style: 'faint', route: 'straight' }), link('n2', 'n3', { style: 'faint', route: 'straight' }), link('n3', 'n5', { style: 'faint', route: 'straight' }), link('n5', 'n1', { style: 'faint', route: 'straight' })],
        flows: [{ path: ['n1', 'n5'], tone: 'data', label: 'only these keys move', duration: 1.6 }],
        panel: {
          title: 'Keys moved when one node joins',
          icon: 'Hash',
          rows: [
            { text: 'Modulo hashing', value: '~99.95%', tone: 'bad' },
            { text: 'Consistent hashing', value: '~1/N', tone: 'good' },
          ],
          footer: { text: 'Only one neighbor gives keys up', tone: 'good' },
        },
        caption: 'A join touches one neighbor',
      },
    },
    {
      title: 'Virtual nodes',
      tag: 'tradeoff',
      heading: 'Virtual nodes smooth out the uneven slices',
      eli5: 'If each shelf stands in just one spot in the hallway, bad luck can give one shelf a huge stretch of books. Standing each shelf in many small spots evens it out.',
      body: [
        'With one point per node, random placement leaves some nodes owning 3 times the arc of others. That node runs hot while its neighbors idle.',
        'Give each physical node **100 to 200 virtual nodes** at different ring positions. Load evens out, and a failed node spreads its keys over many peers instead of dumping them on one. More vnodes tighten the spread further, at the cost of a larger ring table.',
      ],
      keyIdea: 'Virtual nodes trade a bigger ring table for even load and gentle failure handover.',
      metrics: { qps: '20M/s', hit: '99.85%', p99: '0.6 ms', dbqps: '30k/s' },
      metricTones: { hit: 'good' },
      scene: {
        nodes: [
          { ...n1, at: at(-3.4, 0), status: 'hot', load: 88, badge: '3x arc' },
          { ...n2, at: at(0, 0), load: 31 },
          { ...n3, at: at(3.4, 0), load: 30 },
        ],
        panel: {
          title: 'Load per node, 150 vnodes each',
          icon: 'Gauge',
          rows: [
            { text: '1 point per node', value: 'max 3x average', tone: 'bad' },
            { text: '150 vnodes per node', value: 'max ~1.3x average', tone: 'good' },
            { text: 'Ring table, 2,000 nodes', value: '300k entries', tone: 'muted' },
          ],
          footer: { text: 'A failed node spreads over many peers', tone: 'good' },
        },
        caption: 'Bad luck on the ring, fixed by many small slices',
      },
      code: {
        language: 'python',
        title: 'A ring with virtual nodes',
        source: `import bisect, hashlib

def h(s):
    return int(hashlib.md5(s.encode()).hexdigest(), 16)

class Ring:
    def __init__(self, nodes, vnodes=150):
        self.points = {}
        for n in nodes:
            for i in range(vnodes):
                self.points[h(f"{n}#{i}")] = n
        self.keys = sorted(self.points)

    def node_for(self, key):
        i = bisect.bisect(self.keys, h(key)) % len(self.keys)
        return self.points[self.keys[i]]`,
        highlight: [9, 10, 14, 15],
      },
    },
    {
      title: 'Client routing',
      tag: 'concept',
      heading: 'The client holds the ring, so servers stay dumb',
      eli5: 'Each librarian carries a copy of the shelf map. Shelves never talk to each other, they only hand out books. Everyone just needs the same map.',
      body: [
        'Memcached nodes know nothing about each other. The **client library** holds the ring, picks the node and keeps a connection pool. No router sits in the middle and no extra hop adds latency.',
        'The price is agreement: every client must hold the same ring. At large scale a sidecar proxy on each app host (mcrouter is the well-known one) owns the ring, pooling and failover, and apps talk to `localhost`. Ring changes are pushed from service discovery.',
      ],
      keyIdea: 'Client-side partitioning keeps nodes simple and fast. The cost is that every client must see the same ring.',
      metrics: { qps: '20M/s', hit: '99.9%', p99: '0.6 ms', dbqps: '20k/s' },
      metricTones: { hit: 'good' },
      scene: {
        nodes: [
          { ...app, chips: ['localhost:11211'] },
          { ...lib, label: 'sidecar', sub: 'ring + pool', status: 'active' },
          { ...n2, status: 'ok' },
          { id: 'sd', kind: 'monitor', at: at(4.2, -3.6), label: 'discovery', sub: 'ring v57' },
        ],
        links: [link('app', 'lib'), link('lib', 'n2'), link('sd', 'lib', { style: 'dashed', label: 'ring updates' })],
        flows: [
          { path: ['app', 'lib', 'n2'], tone: 'request', label: 'GET', duration: 1.6 },
          { path: ['sd', 'lib'], tone: 'event', label: 'v57', duration: 1.4, delay: 0.4 },
        ],
        panel: {
          title: 'What the sidecar does',
          icon: 'Network',
          rows: [
            { text: 'Hash key on the ring', value: 'picks a node' },
            { text: 'Pool connections', value: 'per node' },
            { text: 'Fail over', value: 'gutter pool' },
            { text: 'Apply ring version', value: 'from discovery' },
          ],
        },
        caption: 'Smart edge, dumb servers',
      },
    },
    {
      title: 'Hot key',
      tag: 'case',
      heading: 'Case: one celebrity key melts one node',
      eli5: 'A new bestseller sits on exactly one shelf, and half the town wants it today. That shelf has a long line while the other shelves are empty, no matter how many shelves exist.',
      body: [
        'Hashing spreads keys evenly, not requests. A viral post or a hot config key can send 500k reads per second at one node that handles 100k.',
        'Fix by copying the hot key. A client-side **L1** with a 1 to 5 s TTL absorbs most of it. Or store the key under `key#0` to `key#7`, each landing on a different node, and read a random one. The sidecar can detect hot keys by counting.',
      ],
      keyIdea: 'Consistent hashing balances keys but not traffic. A hot key needs copies, either in a near cache or under several derived keys.',
      metrics: { qps: '20M/s', hit: '99.9%', p99: '30 ms on node C', dbqps: '20k/s' },
      metricTones: { p99: 'bad' },
      scene: {
        nodes: [{ ...lib, at: at(-4.2, -3.6), label: 'sidecar', sub: 'counts keys', status: 'active' }, { ...n2, status: 'ok', load: 25 }, { ...n3, status: 'hot', load: 98, badge: 'post:viral', chips: [{ text: '500k reads/s', tone: 'bad' }] }, { ...n4, status: 'ok', load: 22 }],
        links: [link('lib', 'n2'), link('lib', 'n3', { label: 'hot', labelTone: 'warn' }), link('lib', 'n4')],
        flows: [{ path: ['lib', 'n3'], tone: 'request', count: 5, label: 'post:viral', duration: 1 }],
        panel: {
          title: 'Spreading a hot key',
          icon: 'Copy',
          rows: [
            { text: 'Near cache (L1) with 2 s TTL', value: 'removes ~99%', tone: 'good' },
            { text: 'Keys post:viral#0..7', value: '8 nodes share it', tone: 'good' },
            { text: 'Cost', value: 'writes hit 8 keys', tone: 'warn' },
          ],
        },
        caption: 'Even key placement, uneven traffic',
      },
    },
    {
      title: 'Replicas',
      tag: 'tradeoff',
      heading: 'Do you replicate cache data at all?',
      eli5: 'The library can keep one copy of each book on its shelf, keep a second copy on a backup shelf, or keep a small spare shelf just for when a main shelf closes.',
      body: [
        'A cache is not the source of truth, so the default is **no replicas**. A node dies, its keys miss, and the database refills them. That is cheap but means a cold period.',
        'The alternatives: **replicas per key** (write both, read either, eventually consistent, good for hot keys or other regions) and a **gutter pool**, a small spare cluster that catches reads for failed nodes.',
      ],
      keyIdea: 'Replicating a cache costs RAM and consistency. Choose by how much a cold period would hurt the database.',
      metrics: { qps: '20M/s', hit: '99.9%', p99: '0.6 ms', dbqps: '20k/s' },
      metricTones: { hit: 'good' },
      scene: {
        nodes: [{ ...n1, label: 'node A', status: 'active' }, { id: 'n1b', kind: 'cache', at: at(-1.4, 0.8), label: 'node A copy', sub: 'replica', tint: 'teal' }, { id: 'gut', kind: 'cache', at: at(3.2, 0.8), label: 'gutter', sub: 'small spare pool', tint: 'amber' }],
        links: [link('n1', 'n1b', { style: 'dashed', label: 'copy' })],
        flows: [{ path: ['n1', 'n1b'], tone: 'data', label: 'SET', duration: 1.4 }],
        panel: {
          title: 'Three strategies',
          icon: 'Table',
          rows: [
            { text: 'No replicas', value: 'cheap, cold period', tone: 'warn' },
            { text: 'Gutter pool', value: 'absorbs outages', tone: 'good' },
            { text: 'Replica per key', value: '2x RAM, stale reads', tone: 'warn' },
          ],
        },
        caption: 'More copies cost RAM and consistency',
      },
    },
    {
      title: 'Node dies',
      tag: 'case',
      heading: 'Failure: a node dies and the gutter pool catches the fall',
      eli5: 'Shelf C is closed for repairs. Readers are sent to the small spare shelf first. The spare fills with those books, so the basement hears only a trickle instead of a roar.',
      body: [
        'The sidecar sees node C time out and marks it down. Its 1/N of the keys would all go to the database at once.',
        'Instead it retries those keys on the **gutter pool** (about 1% of the fleet) and fills them there with a short TTL such as 10 s. Each key hits the database at most once per TTL, and the gutter returns the rest. A hot node carries far more than 1/N of the traffic, which is why the gutter matters.',
      ],
      keyIdea: 'A gutter pool turns a node outage into a trickle of database reads, at the price of briefly stale gutter data.',
      metrics: { qps: '20M/s', hit: '99.95%', p99: '0.9 ms', dbqps: '30k/s' },
      metricTones: { hit: 'warn', dbqps: 'warn' },
      scene: {
        nodes: [{ ...lib, label: 'sidecar', sub: 'C is down', status: 'active' }, { ...n3, status: 'down' }, { id: 'gut', kind: 'cache', at: at(-2.4, 0.8), label: 'gutter', sub: '10 s TTL', tint: 'amber', status: 'ok' }, { ...db, at: at(3, 8.8) }],
        links: [link('lib', 'n3', { style: 'dashed' }), link('lib', 'gut', { label: 'retry' }), link('gut', 'db', { style: 'dashed', label: 'few misses' })],
        flows: [
          { path: ['lib', 'gut'], tone: 'request', label: 'GET', duration: 1.2 },
          { path: ['gut', 'db'], tone: 'request', label: 'once per key', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Reads for the keys of node C',
          icon: 'Shield',
          rows: [
            { text: 'No gutter', value: '100% to database', tone: 'bad' },
            { text: 'With gutter, 10 s TTL', value: '1 DB read per key per 10 s', tone: 'good' },
          ],
          footer: { text: 'Gutter data may be up to 10 s stale', tone: 'warn' },
        },
        caption: 'A small spare pool buffers the outage',
      },
    },
    {
      title: 'Write patterns',
      tag: 'tradeoff',
      heading: 'Keeping the cache and database in step',
      eli5: 'When a book is replaced in the basement, the front shelf still holds the old edition. You can swap it right away, throw it out, or let the librarian swap it later.',
      body: [
        'The caching lesson covers these in depth. In a cluster, the choice is per use case. **Write-through** writes both synchronously, so writes are slower. **Write-around** writes the database only and the cache fills on the next read. **Write-behind** writes the cache and flushes later, fast but lossy on a crash.',
        'For most read-heavy data, use cache-aside invalidation: write the database, then delete the key and let the next read refill. Deleting is safer than updating, because there is no wrong value to write.',
      ],
      keyIdea: 'Prefer delete over update when the database changes. Deleting never writes a wrong value into the cache.',
      metrics: { qps: '20M/s', hit: '99.9%', p99: '0.6 ms', dbqps: '20k/s' },
      metricTones: { hit: 'good' },
      quiz: {
        question: 'Why do most teams invalidate by deleting the key rather than writing the new value into the cache?',
        options: ['Deletes are faster than writes', 'A delete cannot leave a stale or out-of-order value in the cache', 'Deletes bypass the TTL', 'Cache nodes cannot store updated values'],
        answer: 1,
        explain: 'A delete only forces a refill from the source of truth. An update races with other writers and can leave an older value behind that no one notices until the TTL expires.',
      },
      scene: {
        nodes: [{ ...app, chips: ['UPDATE user 42'] }, { ...n2, chips: [{ text: 'DEL user:42', tone: 'warn' }] }, { ...db, status: 'active', badge: 'committed' }],
        links: [link('app', 'db', { label: '1: write' }), link('app', 'n2', { label: '2: delete' })],
        flows: [
          { path: ['app', 'db'], tone: 'request', label: 'UPDATE', duration: 1.3 },
          { path: ['app', 'n2'], tone: 'request', label: 'DEL', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'Write patterns',
          icon: 'Table',
          rows: [
            { text: 'Write-through', value: 'both, slower writes' },
            { text: 'Write-around', value: 'DB only, fill on read' },
            { text: 'Cache-aside invalidation', value: 'write DB, then DEL', tone: 'good' },
            { text: 'Write-behind', value: 'fast, loses on crash', tone: 'warn' },
          ],
        },
        caption: 'Cache-aside invalidation: write DB, then DEL',
      },
    },
    {
      title: 'Delete race',
      tag: 'case',
      heading: 'The race that leaves stale data after a delete',
      eli5: 'A reader fetches the old edition from the basement. Before they reach the front shelf, the librarian swaps the book and removes the old one. Then the reader puts the old edition back on the shelf.',
      body: [
        'Reader R reads the old row from the database. Writer W updates the row and deletes the key. Then R, slow, sets the old value in the cache. Now the cache holds stale data until the TTL ends.',
        'Mitigations: a short TTL as a backstop, a **version or lease token** so a stale `SET` is rejected, and a delayed second delete a second after the write.',
      ],
      keyIdea: 'Delete-then-refill can race with a slow reader. A lease token or a short TTL bounds the damage.',
      metrics: { qps: '20M/s', hit: '99.9%', p99: '0.6 ms', dbqps: '20k/s' },
      metricTones: { hit: 'good' },
      scene: {
        nodes: [{ ...app, label: 'reader R', chips: ['read v1'] }, { ...n2, badge: 'stale v1', status: 'hot' }, { ...db, status: 'active', badge: 'now v2' }],
        links: [link('app', 'db'), link('app', 'n2', { label: 'late SET v1', labelTone: 'warn' })],
        flows: [
          { path: ['app', 'db', 'app'], tone: 'request', label: 'read v1', duration: 1.4 },
          { path: ['app', 'n2'], tone: 'error', label: 'SET v1 (late)', duration: 1.4, delay: 1.6 },
        ],
        panel: {
          title: 'The interleaving',
          icon: 'Clock',
          code: '1  R reads row     -> v1\n2  W writes row    -> v2\n3  W deletes key\n4  R sets key      -> v1   (stale)\n5  cache keeps v1 until TTL',
        },
        caption: 'A slow reader writes back old data',
      },
    },
    {
      title: 'Log invalidation',
      tag: 'concept',
      heading: 'Invalidate from the database log, not the app',
      eli5: 'Instead of every clerk remembering to tell the front shelf, one helper reads the basement ledger and removes the old books in order. Nobody can forget.',
      body: [
        '**Change data capture** tails the database log (for example with Debezium). A consumer turns each committed change into a `DEL` for the affected keys, in commit order.',
        'Apps no longer need to remember to invalidate, so no code path misses one. Invalidations land a few hundred milliseconds late, so keep the TTL as a backstop. Failed DELs are retried from the log. CDC does not close the slow-reader race from the previous step, so keep the lease or version check and the TTL.',
      ],
      keyIdea: 'Driving invalidation from the commit log removes the forgotten-delete bug class and keeps the app out of the cache write path.',
      metrics: { qps: '20M/s', hit: '99.9%', p99: '0.6 ms', dbqps: '20k/s' },
      metricTones: { hit: 'good' },
      scene: {
        nodes: [{ ...db, at: at(-4.2, 0), status: 'active', badge: 'commit log' }, { id: 'cdc', kind: 'worker', at: at(-1, -3), label: 'CDC consumer', sub: 'ordered' }, { ...n2, at: at(2.2, 0.8), chips: [{ text: 'DEL user:42', tone: 'good' }] }, { ...n3, at: at(4.8, -3), status: 'dim' }],
        links: [link('db', 'cdc', { label: 'binlog' }), link('cdc', 'n2'), link('cdc', 'n3', { style: 'faint' })],
        flows: [
          { path: ['db', 'cdc'], tone: 'event', label: 'row 42 changed', duration: 1.4 },
          { path: ['cdc', 'n2'], tone: 'request', label: 'DEL', duration: 1.2, delay: 1.5 },
        ],
        panel: {
          title: 'Why it helps',
          icon: 'Workflow',
          rows: [
            { text: 'Ordered by commit', value: 'no lost or reordered deletes', tone: 'good' },
            { text: 'Any writer covered', value: 'apps, jobs, admins', tone: 'good' },
            { text: 'Delay', value: '~100s of ms', tone: 'warn' },
          ],
        },
        caption: 'The log is the single source of invalidations',
      },
    },
    {
      title: 'Cache tiers',
      tag: 'concept',
      heading: 'Three tiers: process, cluster, database',
      eli5: 'A reader first checks the book in their own bag, then the front-room shelf, and only then the basement. Each stop is slower and bigger than the one before.',
      body: [
        '**L1** is an in-process LRU (Caffeine or Guava), about 10 microseconds, holding the hottest 1% with a 30 s TTL for general data (hot keys that must stay fresh use 1 to 5 s). **L2** is the cluster, about 500 microseconds, holding the working set.',
        '**L3** is the database at 5 to 50 ms. Each tier cuts traffic to the next, and L1 also shields hot keys. The tradeoff is staleness: L1 copies cannot be invalidated across 400 hosts, so keep their TTL short.',
      ],
      keyIdea: 'Each tier trades size for speed. L1 protects L2 from hot keys, and its TTL bounds how stale a read can be.',
      metrics: { qps: '20M/s', hit: '99.9%', p99: '0.6 ms', dbqps: '20k/s' },
      metricTones: { hit: 'good', p99: 'good' },
      scene: {
        nodes: [{ ...app, chips: [{ text: 'L1: 10 us', tone: 'good' }] }, { ...n2, label: 'L2 cluster', sub: '~500 us', status: 'ok' }, { ...db, label: 'L3 database', sub: '5 to 50 ms' }],
        links: [link('app', 'n2', { label: 'L1 miss' }), link('n2', 'db', { style: 'dashed', label: 'L2 miss' })],
        flows: [{ path: ['app', 'n2', 'app'], tone: 'request', label: 'L1 miss', duration: 1.6 }],
        panel: {
          title: 'Per 1,000 reads',
          icon: 'Layers',
          rows: [
            { text: 'Served by L1', value: '~600', tone: 'good' },
            { text: 'Served by L2', value: '~399' },
            { text: 'Reach L3', value: '~1', tone: 'good' },
          ],
          footer: { text: 'L1 TTL 30 s means up to 30 s stale', tone: 'warn' },
        },
        caption: 'Each tier cuts traffic to the next',
      },
    },
    {
      title: 'Cold start',
      tag: 'case',
      heading: 'Case: a cold cache, and the miss-rate math behind it',
      eli5: 'A brand new front room has empty shelves. Every reader goes to the basement until the shelves fill up, and the archivist cannot keep up with all of them.',
      body: [
        'The tier is the pressure valve. At a 99.9% hit ratio the database sees 20k QPS. At 99% it sees 200k, and a cold cache is 20M. The database is sized for the first number.',
        'So never bring up a cold fleet in one go. **Stagger** it: add 1% of capacity at a time, or **warm** new nodes by replaying hot keys before they take traffic.',
      ],
      keyIdea: 'Database load equals QPS times miss ratio. A tiny drop in hit ratio multiplies it, so grow and restart the cache slowly.',
      metrics: { qps: '20M/s', hit: '0%', p99: 'timeouts', dbqps: '20M/s' },
      metricTones: { hit: 'bad', p99: 'bad', dbqps: 'bad' },
      scene: {
        nodes: [{ ...n2, status: 'dim', badge: 'empty' }, { ...n3, status: 'dim', badge: 'empty' }, { ...db, status: 'hot', load: 100 }],
        links: [link('n2', 'db', { style: 'dashed' }), link('n3', 'db', { style: 'dashed' })],
        flows: [
          { path: ['n2', 'db'], tone: 'error', count: 4, duration: 1.3 },
          { path: ['n3', 'db'], tone: 'error', count: 4, duration: 1.3, delay: 0.3 },
        ],
        panel: {
          title: 'DB load at 20M reads/s',
          icon: 'Database',
          rows: [
            { text: 'Hit ratio 99.9%', value: '20k/s', tone: 'good' },
            { text: 'Hit ratio 99%', value: '200k/s', tone: 'warn' },
            { text: 'Hit ratio 0% (cold)', value: '20M/s', tone: 'bad' },
          ],
          footer: { text: 'Warm first, or add 1% at a time', tone: 'muted' },
        },
        caption: 'A cold fleet is the same as no cache',
      },
    },
    {
      title: 'Coalescing',
      tag: 'concept',
      heading: 'Request coalescing: one miss, one database read',
      eli5: 'Fifty readers ask for the same missing book at once. One of them walks to the basement and the other forty-nine wait and share the copy when it arrives.',
      body: [
        'When a popular key expires, thousands of clients miss it in the same millisecond and all hit the database. The caching lesson calls this a stampede.',
        'In the cluster, the sidecar keeps a map of in-flight misses. The first miss reads the database. The rest wait on the same future. A **lease token** on the node does the same across hosts.',
      ],
      keyIdea: 'Coalescing turns N identical misses into one database read.',
      metrics: { qps: '20M/s', hit: '99.9%', p99: '0.6 ms', dbqps: '20k/s' },
      metricTones: { hit: 'good' },
      scene: {
        nodes: [{ ...lib, label: 'sidecar', sub: 'in-flight map', status: 'active', chips: ['50 waiting'] }, { ...n2, badge: 'miss' }, { ...db, status: 'ok', badge: '1 read' }],
        links: [link('lib', 'n2'), link('lib', 'db', { style: 'dashed', label: '1 request' })],
        flows: [
          { path: ['lib', 'n2'], tone: 'request', count: 4, label: 'GET hot:9', duration: 1.2 },
          { path: ['lib', 'db', 'lib'], tone: 'request', label: 'one read', duration: 1.8, delay: 1.3 },
        ],
        panel: {
          title: 'Same key, 50 misses',
          icon: 'Users',
          rows: [
            { text: 'Without coalescing', value: '50 DB reads', tone: 'bad' },
            { text: 'With coalescing', value: '1 DB read', tone: 'good' },
          ],
        },
        caption: 'First miss fetches, the rest wait',
      },
    },
    {
      title: 'Early refresh',
      tag: 'concept',
      heading: 'Refresh before the TTL ends',
      eli5: 'A librarian notices a popular book is close to its return date and quietly fetches a fresh copy beforehand, so readers never see an empty spot.',
      body: [
        'Coalescing handles the miss, but a hot key still stalls a request each time it expires. **Probabilistic early refresh** fixes that.',
        'As a key ages toward its TTL, each read refreshes it with a probability that rises with age, such as `(age / ttl)^k` with k = 10. This is the idea behind the XFetch algorithm. One lucky reader rebuilds it early while everyone else still hits. Add random jitter to TTLs so many keys do not expire together.',
      ],
      keyIdea: 'Refresh hot keys a little before they expire, at random, so expiry never becomes a visible cliff.',
      metrics: { qps: '20M/s', hit: '99.95%', p99: '0.5 ms', dbqps: '10k/s' },
      metricTones: { hit: 'good', p99: 'good' },
      scene: {
        nodes: [{ ...app, chips: ['GET hot:9'] }, { ...n2, status: 'ok', badge: 'age 270 of 300 s' }, { ...db, status: 'active' }],
        links: [link('app', 'n2'), link('n2', 'db', { style: 'dashed', label: 'early rebuild' })],
        flows: [
          { path: ['app', 'n2', 'app'], tone: 'response', label: 'still a hit', duration: 1.5 },
          { path: ['n2', 'db', 'n2'], tone: 'data', label: 'lucky refresh', duration: 1.5, delay: 1.6 },
        ],
        panel: {
          title: 'Refresh chance by age',
          icon: 'Clock',
          rows: [
            { text: 'Age 50% of TTL', value: '~0.1%' },
            { text: 'Age 90% of TTL', value: '~35%' },
            { text: 'Age 99% of TTL', value: '~90%', tone: 'good' },
          ],
          footer: { text: 'k = 10, tune per workload', tone: 'muted' },
        },
        caption: 'One reader refreshes early, others keep hitting',
      },
    },
    {
      title: 'Negative cache',
      tag: 'concept',
      heading: 'Cache the answer "does not exist"',
      eli5: 'People keep asking for a book that the library never had. The librarian pins a note on the front desk saying "we do not have this" for a little while.',
      body: [
        'A key with no row is never cached, so every lookup falls through to the database. A bug, a crawler or an attacker can ask for `user:-1` a million times a second.',
        '**Negative caching** stores a tombstone value for the missing key with a short TTL, for example 10 s. A **Bloom filter** in front of the cache can also reject ids that cannot exist.',
      ],
      keyIdea: 'Cache misses on non-existent keys too, with a short TTL, or they bypass the cache every time.',
      metrics: { qps: '20M/s', hit: '99.9%', p99: '0.6 ms', dbqps: '20k/s' },
      metricTones: { hit: 'good' },
      scene: {
        nodes: [{ ...app, chips: ['GET user:-1'] }, { ...n2, status: 'ok', chips: [{ text: 'user:-1 = NONE (10 s)', tone: 'good' }] }, { ...db, status: 'dim' }],
        links: [link('app', 'n2'), link('n2', 'db', { style: 'faint' })],
        flows: [
          { path: ['app', 'n2'], tone: 'request', label: 'GET', duration: 1.2 },
          { path: ['n2', 'app'], tone: 'response', label: 'does not exist', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Missing key, 1M lookups',
          icon: 'Search',
          rows: [
            { text: 'No negative cache', value: '1M DB reads', tone: 'bad' },
            { text: 'Tombstone, 10 s TTL', value: '1 per 10 s', tone: 'good' },
          ],
          footer: { text: 'Keep the TTL short so new rows appear', tone: 'warn' },
        },
        caption: 'The database never hears about it',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'The whole cache, end to end',
      eli5: 'The library keeps popular books on many front shelves, uses one shared map to find the right shelf, keeps a spare shelf for emergencies, and tidies old copies so readers rarely visit the basement.',
      body: [
        'Size from working set and QPS. Route with a ring and virtual nodes in the client. Keep a gutter pool for outages and copies for hot keys. Invalidate by deleting, ideally from the database log.',
        'Layer L1 over L2, coalesce misses, refresh early, cache negatives, and grow the fleet slowly. Each choice protects the database.',
      ],
      keyIdea: 'A distributed cache exists to keep database load at a calm level. Every design decision is about avoiding a miss storm.',
      metrics: { qps: '20M/s', hit: '99.9%', p99: '0.5 ms', dbqps: '20k/s' },
      metricTones: { qps: 'good', hit: 'good', p99: 'good', dbqps: 'good' },
      quiz: {
        question: 'One node in a 2,000 node ring dies and the gutter pool is empty. What protects the database best?',
        options: ['Rehash everything with N minus 1', 'Retry its keys on the gutter pool with a short TTL, with coalescing', 'Send those reads straight to the database', 'Flush the whole cache and start over'],
        answer: 1,
        explain: 'Only 1/N of the keys are affected. The gutter pool plus coalescing sends about one database read per key per TTL. Rehashing everything moves almost every key and makes things worse.',
      },
      scene: {
        nodes: [{ ...app, status: 'ok', chips: ['L1'] }, { ...lib, label: 'sidecar', sub: 'ring + coalesce', status: 'ok' }, { ...n2, status: 'ok', label: 'L2 ring', sub: '2,000 nodes' }, { ...db, status: 'ok', badge: '20k/s' }],
        links: [link('app', 'lib'), link('lib', 'n2'), link('n2', 'db', { style: 'dashed' })],
        flows: [{ path: ['app', 'lib', 'n2', 'lib', 'app'], tone: 'request', label: 'GET', duration: 2 }],
        panel: {
          title: 'Design checklist',
          icon: 'ListChecks',
          rows: [
            { text: 'Consistent ring + vnodes', value: 'keys stay put', tone: 'good' },
            { text: 'Gutter pool', value: 'outage buffer', tone: 'good' },
            { text: 'Delete + CDC', value: 'fresh data', tone: 'good' },
            { text: 'Coalesce + early refresh', value: 'no stampede', tone: 'good' },
          ],
        },
        caption: '99.9% hits keep the database calm',
      },
    },
  ],
};
