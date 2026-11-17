import type { Lesson, SceneNode } from '../engine/types';

/**
 * Ten evenly spaced slots on a circle of radius 3.8 tiles. Slot 0 is the top of the
 * screen and slot numbers increase clockwise, so slot i sits at i * 36 degrees.
 */
function slot(i: number): [number, number] {
  const t = ((225 + i * 36) * Math.PI) / 180;
  return [Math.round(3.8 * Math.cos(t) * 100) / 100, Math.round(3.8 * Math.sin(t) * 100) / 100];
}

const app: SceneNode = { id: 'app', kind: 'server', at: [-4.6, 4.6], label: 'app server', sub: '50k reads/s' };
const db: SceneNode = { id: 'db', kind: 'db', at: [4.6, -4.6], label: 'database' };

// Cache nodes. Their ring positions are deliberately uneven, like random hashes would be.
const A: SceneNode = { id: 'A', kind: 'cache', at: slot(0), label: 'cache A', sub: 'at 0°' };
const B: SceneNode = { id: 'B', kind: 'cache', at: slot(2), label: 'cache B', sub: 'at 72°' };
const C: SceneNode = { id: 'C', kind: 'cache', at: slot(4), label: 'cache C', sub: 'at 144°' };
const D: SceneNode = { id: 'D', kind: 'cache', at: slot(7), label: 'cache D', sub: 'at 252°' };
const E: SceneNode = { id: 'E', kind: 'cache', at: slot(6), label: 'cache E', sub: 'at 216°' };

// Empty points on the ring, used to draw the circle and to show keys walking clockwise.
const m1: SceneNode = { id: 'm1', kind: 'ring', at: slot(1) };
const m3: SceneNode = { id: 'm3', kind: 'ring', at: slot(3) };
const m5: SceneNode = { id: 'm5', kind: 'ring', at: slot(5) };
const m6: SceneNode = { id: 'm6', kind: 'ring', at: slot(6) };
const m8: SceneNode = { id: 'm8', kind: 'ring', at: [-3.67, 0.98] };
const m9: SceneNode = { id: 'm9', kind: 'ring', at: slot(9) };

const ringBefore = [m1, m3, m5, m6, m8, m9];
const ringAfter = [m1, m3, m5, m8, m9];

// Modulo labels for the first two steps.
const modA = { ...A, sub: 'hash % N = 0' };
const modB = { ...B, sub: 'hash % N = 1' };
const modC = { ...C, sub: 'hash % N = 2' };
const modD = { ...D, sub: 'hash % N = 3' };
const modE = { ...E, sub: 'hash % N = 4' };

// Virtual nodes: the five empty points become second positions for each cache.
const vnodes = [
  { ...m1, label: 'D·2' },
  { ...m3, label: 'E·2' },
  { ...m5, label: 'A·2' },
  { ...m8, label: 'B·2' },
  { ...m9, label: 'C·2' },
];

export const consistentHashing: Lesson = {
  id: 'consistent-hashing',
  title: 'Consistent hashing',
  tagline: 'Add a cache node without throwing away almost every cached key.',
  minutes: 12,
  level: 'Intermediate',
  learn: [
    'Why `hash(key) % N` reshuffles almost every key when N changes',
    'The hash ring and the clockwise walk from key to node',
    'Why adding or removing a node moves only about 1/N of keys',
    'How virtual nodes even out load and spread failures',
    'Where it runs in production: Dynamo, Cassandra, CDNs, cache clients',
  ],
  metrics: [
    { key: 'nodes', label: 'Cache nodes' },
    { key: 'moved', label: 'Keys moved' },
    { key: 'hit', label: 'Hit rate' },
    { key: 'db', label: 'DB load' },
    { key: 'skew', label: 'Busiest node' },
  ],
  steps: [
    {
      title: 'Add a node',
      tag: 'problem',
      heading: 'One more cache node, and the database falls over',
      eli5: 'Four teachers each know their own group of kids by heart. A fifth teacher, **cache** E, joins and the kids count off into new groups. Now most teachers face strangers and must run to the office, the database, for every name.',
      body: [
        'Four cache nodes sit in front of the database. The app serves 50,000 reads a second, 95% of them come from cache, and the database sees a calm 2,500 queries a second.',
        'Traffic is growing, so you add a fifth cache node. Within seconds the hit rate drops to **19%** and the database is taking **40,500** queries a second. Pages time out. Nothing is broken, yet almost every key now lives somewhere it was never cached.',
      ],
      keyIdea: 'How you map keys to nodes decides what happens when the cluster changes size. A bad mapping turns a routine scale-up into an outage.',
      metrics: { nodes: '4 → 5', moved: '80%', hit: '19%', db: '40,500 QPS' },
      scene: {
        nodes: [
          { ...app, status: 'hot' },
          modA,
          modB,
          { ...modC, status: 'active', badge: 'miss' },
          modD,
          { ...modE, status: 'active', badge: 'new, empty' },
          { ...db, status: 'hot', badge: '40,500 QPS' },
        ],
        links: [
          { from: 'app', to: 'C' },
          { from: 'app', to: 'db', style: 'dashed' },
        ],
        flows: [
          { path: ['app', 'C'], tone: 'request', label: 'GET user:42', duration: 1.1 },
          { path: ['C', 'app'], tone: 'error', label: 'miss', duration: 1.1, delay: 1.2 },
          { path: ['app', 'db'], tone: 'request', label: 'SELECT …', count: 5, duration: 1.4, delay: 2.4 },
        ],
        caption: 'After adding one node, 4 out of 5 keys miss',
      },
    },
    {
      title: 'Why modulo',
      tag: 'concept',
      heading: 'Modulo ties every key to N',
      eli5: 'The kids were grouped by counting off: one, two, three, four. That counting rule is **modulo**. Add a fifth teacher and they count to five, so almost every kid lands with a new teacher.',
      body: [
        'The client picked a node with `hash(key) % N`. It is simple and spreads keys evenly, as long as N never changes.',
        'Change N and the answer changes for almost every key. A key whose hash is 7 went to node `7 % 4 = 3`. Now it goes to node `7 % 5 = 2`, which has never seen it. A key stays put only when both remainders happen to match, which is about 1 in N of the time.',
        'So going from 4 to 5 nodes moves about **(N − 1)/N = 80%** of keys. Going from 10 to 11 moves 91%. The bigger the cluster, the worse a resize gets.',
      ],
      keyIdea: 'With `hash % N`, changing N by one remaps about (N − 1)/N of all keys, so every resize is a near-total cache flush.',
      metrics: { nodes: '4 → 5', moved: '80%', hit: '19%', db: '40,500 QPS' },
      scene: {
        nodes: [
          app,
          { ...modA, status: 'ok', badge: '20 % 5 = 0, stays' },
          modB,
          { ...modC, status: 'hot', badge: 'miss' },
          { ...modD, status: 'dim', badge: 'had key 7' },
          modE,
          { ...db, status: 'hot' },
        ],
        links: [
          { from: 'app', to: 'A' },
          { from: 'app', to: 'C' },
          { from: 'app', to: 'D', style: 'faint' },
        ],
        flows: [
          { path: ['app', 'D'], tone: 'request', label: 'before: 7 % 4 = 3', duration: 1.2 },
          { path: ['app', 'C'], tone: 'error', label: 'after: 7 % 5 = 2', duration: 1.2, delay: 1.4 },
          { path: ['app', 'A'], tone: 'response', label: '20 % 4 = 20 % 5 = 0', duration: 1.2, delay: 2.8 },
        ],
        caption: 'Only keys whose two remainders match stay put',
      },
      code: {
        language: 'python',
        title: 'Count the damage',
        source: `keys = range(1_000_000)          # hash(key) is just a number

moved = sum(1 for k in keys if k % 4 != k % 5)
print(f"4 -> 5 nodes:  {moved / len(keys):.0%} moved")    # 80%

moved = sum(1 for k in keys if k % 10 != k % 11)
print(f"10 -> 11 nodes: {moved / len(keys):.0%} moved")   # 91%`,
        highlight: [3, 4, 7],
      },
      quiz: {
        question: 'A 20-node cache cluster uses `hash(key) % N`. You add one node. Roughly what share of keys now map to a different node?',
        options: ['About 5%', 'About 50%', 'About 95%', 'None, existing keys keep their node'],
        answer: 2,
        explain: 'A key stays only if `h % 20 == h % 21`, which is true for about 1 in 21 keys. The other 20/21, about 95%, move.',
      },
    },
    {
      title: 'The ring',
      tag: 'concept',
      heading: 'Bend the hash space into a circle',
      eli5: 'Paint a big circle on the playground. That circle is the **ring**. Each teacher, caches A to D, stands on a spot on it, and that spot never changes when more teachers come.',
      body: [
        'Take the full output range of the hash, say 0 to 2³² − 1, and join the ends so it forms a **ring**. Every position on the ring is an angle from 0° to 360°.',
        'Now hash each **node** onto the same ring, using its name or IP. Cache A lands at 0°, B at 72°, C at 144°, D at 252°. The positions do not depend on how many nodes there are, and that independence is what makes the ring work.',
      ],
      keyIdea: 'Keys and nodes are hashed into the same circular space, and a node\'s position never depends on N.',
      metrics: { nodes: '4', hit: '95%', db: '2,500 QPS', skew: '1.2×' },
      scene: {
        nodes: [app, { ...A, status: 'active' }, { ...B, status: 'active' }, { ...C, status: 'active' }, { ...D, status: 'active' }, ...ringBefore, db],
        caption: 'Hash space 0 to 2³² − 1, wrapped into a circle, clockwise from the top',
      },
    },
    {
      title: 'Walk clockwise',
      tag: 'concept',
      heading: 'A key belongs to the next node clockwise',
      eli5: 'Each kid gets a spot on the circle too, then walks **clockwise** until they bump into a teacher. That teacher is theirs. A kid past the last teacher keeps walking around to teacher A.',
      body: [
        'To place a key, hash it onto the ring and walk **clockwise** until you hit a node. That node owns the key. If you pass 360° you wrap around to 0°.',
        '`user:42` hashes to 190°. Walking clockwise, the first node is D at 252°. `cart:9` lands at 300° and wraps around to A. `img:7` lands at 40° and stops at B.',
        'Each node therefore owns the **arc** between its counterclockwise neighbor and itself. D owns 144° to 252°, which is 30% of the ring.',
      ],
      keyIdea: 'Each node owns the arc that ends at its position. Lookups are a binary search for the next node clockwise.',
      metrics: { nodes: '4', hit: '95%', db: '2,500 QPS', skew: '1.2×' },
      scene: {
        nodes: [app, A, B, C, { ...D, status: 'active', badge: 'user:42' }, ...ringBefore, db],
        flows: [
          { path: ['app', 'm5', 'm6', 'D'], tone: 'request', label: 'user:42 → 190°', duration: 2 },
          { path: ['app', 'm8', 'm9', 'A'], tone: 'request', label: 'cart:9 → 300°', duration: 2, delay: 2.1 },
          { path: ['app', 'm1', 'B'], tone: 'request', label: 'img:7 → 40°', duration: 1.6, delay: 4.2 },
        ],
        caption: 'Hash the key, then walk clockwise to the first node',
      },
    },
    {
      title: 'Add a node',
      tag: 'case',
      heading: 'Adding E moves one arc and nothing else',
      eli5: 'Teacher E steps onto the circle. Only the kids who now bump into E first switch teachers, and they all come from teacher D. Everyone else stays put. That gentle change is **consistent hashing**.',
      body: [
        'Cache E hashes to 216°, inside D\'s arc. From now on, keys between 144° and 216° walk clockwise into E before they reach D. `user:42` at 190° now goes to E.',
        'Every other key still finds the same node it found before. Only E\'s new arc moved, here **20%** of keys, all of them taken from D. On average a new node takes about **1/N** of the keys, compared with (N − 1)/N under modulo.',
        'The hit rate dips from 95% to 76% and the database goes to 12,000 queries a second for a few minutes while E warms up. That is a bump, where modulo gave us an outage.',
      ],
      keyIdea: 'Adding a node only steals keys from its clockwise neighbor. About 1/N of keys move, and the rest of the cache stays warm.',
      metrics: { nodes: '5', moved: '20%', hit: '76%', db: '12,000 QPS', skew: '1.5×' },
      scene: {
        nodes: [
          app,
          { ...A, badge: 'unchanged' },
          { ...B, badge: 'unchanged' },
          { ...C, badge: 'unchanged' },
          { ...D, badge: 'gave 144° to 216°' },
          { ...E, status: 'active', badge: 'new: +20% of keys' },
          ...ringAfter,
          { ...db, status: 'active' },
        ],
        flows: [
          { path: ['app', 'm5', 'E'], tone: 'request', label: 'user:42 → E', duration: 1.6 },
          { path: ['E', 'db'], tone: 'request', label: 'warm up', count: 2, duration: 1.4, delay: 1.7 },
          { path: ['app', 'm8', 'm9', 'A'], tone: 'response', label: 'cart:9 still → A', duration: 2, delay: 3.2 },
        ],
        caption: 'Only keys in E\'s new arc move',
      },
    },
    {
      title: 'Lose a node',
      tag: 'case',
      heading: 'When B dies, only B\'s keys move',
      eli5: 'Teacher B goes home sick. B\'s kids keep walking around the circle and all end up with teacher C, the next **node**. Nobody else moves, but C now has twice as many kids.',
      body: [
        'Cache B crashes. Its keys, the arc from 0° to 72°, keep walking clockwise past the empty spot and land on C. `img:7` at 40° now goes to C.',
        'Again only one arc moved, here 20% of keys. A, D and E do not notice. With modulo, losing one node out of five would have remapped 80% of everything, because N changed from 5 to 4.',
        'There is a catch. All of B\'s load landed on **one** neighbor. C was holding 20% of keys and now holds 40%.',
      ],
      keyIdea: 'A failed node\'s keys all go to its clockwise neighbor. Little moves, but that neighbor takes the whole hit.',
      metrics: { nodes: '4', moved: '20%', hit: '76%', db: '12,000 QPS', skew: '1.6×' },
      scene: {
        nodes: [
          app,
          A,
          { ...B, status: 'down', badge: 'down' },
          { ...C, status: 'hot', badge: '+20% from B' },
          D,
          E,
          ...ringAfter,
          db,
        ],
        flows: [
          { path: ['app', 'm1', 'm3', 'C'], tone: 'request', label: 'img:7 → 40° → C', duration: 2 },
          { path: ['C', 'db'], tone: 'request', label: 'misses', count: 3, duration: 1.4, delay: 2.1 },
        ],
        caption: 'B\'s whole arc falls to the next node clockwise',
      },
    },
    {
      title: 'Uneven load',
      tag: 'tradeoff',
      heading: 'A few random points make lumpy arcs',
      eli5: 'The teachers stand at random spots, so the gaps between them are uneven. Teacher C has a long stretch of circle, an **arc**, with lots of kids walking in. Teacher D has a tiny one and is nearly alone.',
      body: [
        'With one point per node, arc sizes are random. Look at the shares now: C owns 40% of the ring, D owns 10%. In a fair world each of the four live nodes would hold 25%.',
        'C is the busiest node at **1.6×** its fair share, so it runs hot, evicts more and fills its network link first. D sits mostly idle. Buying a bigger C does not fix the shape of the ring.',
        'Both problems have the same cause. Arcs are uneven from the start, and a failure dumps a whole arc onto a single neighbor.',
      ],
      keyIdea: 'One point per node gives random arc sizes. Load follows arc size, so a few nodes always end up overloaded.',
      metrics: { nodes: '4', hit: '95%', db: '2,500 QPS', skew: '1.6×' },
      scene: {
        nodes: [
          app,
          { ...A, badge: '30%' },
          { ...B, status: 'down' },
          { ...C, status: 'hot', badge: '40%' },
          { ...D, status: 'dim', badge: '10%' },
          { ...E, badge: '20%' },
          ...ringAfter,
          db,
        ],
        flows: [{ path: ['app', 'm1', 'm3', 'C'], tone: 'request', count: 4, duration: 1.8 }],
        caption: 'Fair share is 25% each. C has 40%, D has 10%.',
      },
    },
    {
      title: 'Virtual nodes',
      tag: 'concept',
      heading: 'Give every node many points on the ring',
      eli5: 'Give each teacher a helper in the same color shirt, standing somewhere else on the circle. These are **virtual nodes**. A kid who bumps into a helper belongs to that teacher, so the groups come out fair.',
      body: [
        'Instead of one position per node, hash each node many times: `A#0`, `A#1`, … `A#149`. Each of these **virtual nodes** owns a small arc, and the physical node owns the sum of them. The scene shows two per node. Real systems use 100 to 256.',
        'Many small random arcs add up to nearly equal totals. With 150 virtual nodes each, five caches end up between 18% and 23% of keys, so the busiest is about **1.1×** its fair share.',
        'Failures spread too. If B dies, its arc after D·2 goes to E and its arc after D goes to C. With 150 points, B\'s keys scatter across every survivor. Bigger machines can get more points than small ones.',
      ],
      keyIdea: 'Virtual nodes turn a few big random arcs into many small ones, which evens out load and spreads a failed node\'s keys across the whole cluster.',
      metrics: { nodes: '5', hit: '95%', db: '2,500 QPS', skew: '1.1×' },
      scene: {
        nodes: [
          app,
          { ...A, status: 'ok', badge: '20%' },
          { ...B, status: 'ok', badge: '20%' },
          { ...C, status: 'ok', badge: '20%' },
          { ...D, status: 'ok', badge: '20%' },
          { ...E, status: 'ok', badge: '20%' },
          ...vnodes,
          db,
        ],
        flows: [
          { path: ['app', 'm5', 'E'], tone: 'request', label: 'user:42 → E', duration: 1.6 },
          { path: ['app', 'm8', 'm9'], tone: 'request', label: 'cart:9 → C·2', duration: 1.6, delay: 1.8 },
          { path: ['m9', 'C'], tone: 'response', label: 'C·2 belongs to C', duration: 1.2, delay: 3.4 },
        ],
        caption: 'Two points per node shown. Production rings use 100 or more.',
      },
      code: {
        language: 'python',
        title: 'A hash ring with virtual nodes',
        source: `import bisect, hashlib

def h(s: str) -> int:
    return int(hashlib.md5(s.encode()).hexdigest(), 16)

class HashRing:
    def __init__(self, nodes, vnodes=150):
        self.vnodes, self.points, self.owner = vnodes, [], {}
        for node in nodes:
            self.add(node)

    def add(self, node):
        for i in range(self.vnodes):               # many points per node
            p = h(f"{node}#{i}")
            bisect.insort(self.points, p)          # keep positions sorted
            self.owner[p] = node

    def get(self, key):
        i = bisect.bisect(self.points, h(key))     # first point clockwise
        return self.owner[self.points[i % len(self.points)]]  # wrap past the top

ring = HashRing(["A", "B", "C", "D"])
ring.add("E")          # moves about 18% of keys, all into E`,
        highlight: [13, 14, 15, 19, 20],
      },
    },
    {
      title: 'In the wild',
      tag: 'case',
      heading: 'Where you will meet the ring',
      eli5: 'Big schools use the same circle to keep spare copies. A kid\'s name goes to the first teacher they bump into and to the next two around the circle. Each one is a **replica**, so a sick teacher loses nothing.',
      body: [
        '**Dynamo** and **Cassandra** place data on a ring of tokens and store each key on the next N distinct nodes clockwise (usually 3), so replication comes from the same walk. Cassandra 4.0 defaults to 16 tokens per node with a smarter allocator.',
        '**CDNs** use it to pick which edge server caches a URL. The idea comes from a 1997 MIT paper whose authors went on to found Akamai. **Cache clients** for Memcached (ketama) and load balancers such as Envoy\'s ring hash use it to keep each key or session on the same backend.',
      ],
      keyIdea: 'Consistent hashing shows up wherever a key must find "its" machine and machines come and go: partitioned databases, CDNs, cache clusters and sticky load balancing.',
      metrics: { nodes: '5', hit: '95%', db: '2,500 QPS', skew: '1.1×' },
      scene: {
        nodes: [
          app,
          A,
          { ...B, status: 'ok', badge: 'replica 3' },
          C,
          { ...D, status: 'ok', badge: 'replica 2' },
          { ...E, status: 'active', badge: 'replica 1' },
          ...vnodes,
          db,
        ],
        flows: [
          { path: ['app', 'm5', 'E'], tone: 'request', label: 'write user:42', duration: 1.6 },
          { path: ['E', 'D'], tone: 'data', label: 'copy', duration: 1, delay: 1.7 },
          { path: ['D', 'm8', 'B'], tone: 'data', label: 'copy', duration: 1.6, delay: 2.8 },
        ],
        caption: 'Dynamo style: a key lives on the next 3 distinct nodes clockwise',
      },
      code: {
        language: 'yaml',
        title: 'cassandra.yaml',
        source: `# Each node claims this many points (tokens) on the ring
num_tokens: 16

# Place new tokens so load stays even for a replication factor of 3
allocate_tokens_for_local_replication_factor: 3

# Hash function that maps partition keys onto the ring
partitioner: org.apache.cassandra.dht.Murmur3Partitioner`,
        highlight: [2, 5],
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Change the cluster, keep the cache',
      eli5: 'Counting off reshuffles everybody when a teacher joins. With **consistent hashing**, teachers and helpers stand on a circle, kids walk to the next one, and a new teacher only takes a few kids.',
      body: [
        '`hash(key) % N` remaps about (N − 1)/N of keys whenever N changes. The ring hashes keys and nodes into one circular space, and each key belongs to the next node clockwise.',
        'Adding or removing a node moves about **1/N** of keys. One point per node makes lumpy arcs and dumps failures on a single neighbor, so real systems give each node many **virtual nodes**.',
      ],
      keyIdea: 'Consistent hashing makes membership changes cheap: about 1/N of keys move, and virtual nodes keep the load even.',
      metrics: { nodes: '5', moved: '~1/N', hit: '95%', db: '2,500 QPS', skew: '1.1×' },
      scene: {
        nodes: [
          app,
          { ...A, status: 'ok' },
          { ...B, status: 'ok' },
          { ...C, status: 'ok' },
          { ...D, status: 'ok' },
          { ...E, status: 'ok' },
          ...vnodes,
          { ...db, status: 'ok' },
        ],
        flows: [
          { path: ['app', 'm5', 'E'], tone: 'request', duration: 1.6 },
          { path: ['app', 'm1', 'm3'], tone: 'request', duration: 1.6, delay: 0.8 },
          { path: ['app', 'm8', 'm9'], tone: 'request', duration: 1.6, delay: 1.6 },
        ],
      },
      quiz: {
        question: 'Your ring has 4 cache nodes with one point each. One node holds 40% of keys and runs hot. What is the best fix?',
        options: [
          'Switch back to `hash(key) % N`',
          'Give each node 100 or more virtual nodes on the ring',
          'Use a longer hash, such as SHA-256 instead of MD5',
          'Move the hot node to a bigger machine and change nothing else',
        ],
        answer: 1,
        explain: 'The problem is a few large random arcs. Many virtual nodes per machine average the arcs out, so each node lands close to 25%. A better hash still produces random arcs, and a bigger box only hides the skew.',
      },
    },
  ],
};
