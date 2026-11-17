import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [Math.round(((s + d) / 2) * 100) / 100, Math.round(((s - d) / 2) * 100) / 100];

/** A point on the ring at a clockwise angle from the top of the screen, at radius r tiles. */
const pol = (deg: number, r = 1): [number, number] => {
  const t = (deg * Math.PI) / 180;
  return at(7.5 * r * Math.sin(t), -5.5 * r * Math.cos(t));
};

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

// Modulo-era scenes: an app, some cache nodes and a database laid out left to right.
const app: SceneNode = { id: 'app', kind: 'block', at: at(-4.4, 0), label: 'app server', sub: '50k reads/s', icon: 'Server', tint: 'blue' };
const db: SceneNode = { id: 'db', kind: 'db', at: at(4.4, 0), label: 'database' };
const pool: SceneNode = { id: 'pool', kind: 'block', at: at(0, 0), label: 'cache nodes', icon: 'Layers', tint: 'teal' };
const cx: SceneNode = { id: 'cx', kind: 'cache', at: at(-1.5, -3.4), label: 'cache C' };
const cy: SceneNode = { id: 'cy', kind: 'cache', at: at(1.5, 3.4), label: 'cache E', sub: 'new, empty' };

// Ring-era scenes. Angles are deliberately uneven, like random hashes.
const A: SceneNode = { id: 'A', kind: 'cache', at: pol(0), label: 'cache A', sub: 'at 0°' };
const B: SceneNode = { id: 'B', kind: 'cache', at: pol(72), label: 'cache B', sub: 'at 72°' };
const C: SceneNode = { id: 'C', kind: 'cache', at: pol(144), label: 'cache C', sub: 'at 144°' };
const D: SceneNode = { id: 'D', kind: 'cache', at: pol(252), label: 'cache D', sub: 'at 252°' };
const E: SceneNode = { id: 'E', kind: 'cache', at: pol(216), label: 'cache E', sub: 'at 216°' };
// Keys sit inside the circle so they never crowd the caches.
const key = (id: string, label: string, deg: number): SceneNode => ({ id, kind: 'ring', at: pol(deg, 0.4), label, sub: `at ${deg}°` });

export const consistentHashing: Lesson = {
  id: 'consistent-hashing',
  title: 'Consistent hashing',
  tagline: 'Add a cache node without throwing away almost every cached key.',
  minutes: 15,
  level: 'Intermediate',
  learn: [
    'Why `hash(key) % N` reshuffles almost every key when N changes',
    'The hash ring and the clockwise walk from key to node',
    'Why adding or removing a node moves only about 1/N of keys, and how to find those keys',
    'Why plain rings are lumpy, and how virtual nodes even out load and spread failures',
    'Replicas on the ring, and where it runs: Dynamo, Cassandra, CDNs, cache clients',
    'Alternatives and limits: rendezvous hashing, jump hash, bounded loads, hot keys',
  ],
  metrics: [
    { key: 'nodes', label: 'Cache nodes', icon: 'Server' },
    { key: 'moved', label: 'Keys moved', icon: 'Split' },
    { key: 'hit', label: 'Hit rate', icon: 'Gauge' },
    { key: 'db', label: 'DB load', icon: 'Database' },
    { key: 'skew', label: 'Busiest node', icon: 'Scale' },
  ],
  steps: [
    {
      title: 'Add a node',
      tag: 'problem',
      heading: 'One more cache node, and the database falls over',
      eli5: 'Four teachers each know their own group of kids by heart. A fifth teacher, **cache** E, joins and the kids count off into new groups. Now most teachers face strangers and must run to the office, the database, for every name.',
      body: [
        'Four cache nodes sit in front of the database. The app serves 50,000 reads a second, 95% come from cache, and the database sees a calm 2,500 queries a second.',
        'Traffic grows, so you add a fifth node. Within seconds the hit rate drops to **19%** and the database takes **40,500** queries a second. Nothing is broken, yet almost every key now lives somewhere it was never cached.',
      ],
      keyIdea: 'How you map keys to nodes decides what happens when the cluster changes size. A bad mapping turns a routine scale-up into an outage.',
      metrics: { nodes: '4 → 5', moved: '80%', hit: '19%', db: '40,500 QPS' },
      metricTones: { moved: 'bad', hit: 'bad', db: 'bad' },
      scene: {
        nodes: [
          { ...app, status: 'hot', chips: ['GET user:42'] },
          { ...cx, status: 'active', badge: 'miss' },
          { ...cy, status: 'active' },
          { ...db, status: 'hot', load: 97, chips: [{ text: 'SELECT ...', tone: 'bad' }] },
        ],
        links: [link('app', 'cx'), link('app', 'cy'), link('app', 'db', { style: 'dashed', label: '40,500 QPS', labelTone: 'warn' })],
        flows: [
          { path: ['app', 'cx'], tone: 'request', label: 'GET user:42', duration: 1.1 },
          { path: ['cx', 'app'], tone: 'error', label: 'miss', duration: 1.1, delay: 1.2 },
          { path: ['app', 'db'], tone: 'request', label: 'SELECT ...', count: 5, duration: 1.4, delay: 2.4 },
        ],
        panel: {
          title: 'Before and after the 5th node',
          icon: 'Table',
          rows: [
            { text: 'Hit rate', value: '95% → 19%', tone: 'bad' },
            { text: 'DB queries per second', value: '2,500 → 40,500', tone: 'bad' },
          ],
          footer: { text: '4 out of 5 keys now miss', tone: 'bad' },
        },
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
        'Change N and the answer changes for almost every key. A key whose hash is 7 went to node `7 % 4 = 3`. Now it goes to `7 % 5 = 2`, which has never seen it.',
      ],
      keyIdea: 'With `hash % N`, the node for a key depends on N, so any change to N remaps keys.',
      metrics: { nodes: '4 → 5', moved: '80%', hit: '19%', db: '40,500 QPS' },
      metricTones: { moved: 'bad' },
      scene: {
        nodes: [
          { ...app, chips: ['key hash = 7'] },
          { ...cx, label: 'node 3', sub: 'had key 7', status: 'dim' },
          { ...cy, label: 'node 2', sub: 'gets key 7', status: 'hot', badge: 'miss' },
          { ...db, status: 'active' },
        ],
        links: [link('app', 'cx', { style: 'faint' }), link('app', 'cy')],
        flows: [
          { path: ['app', 'cx'], tone: 'request', label: 'before: 7 % 4 = 3', duration: 1.2 },
          { path: ['app', 'cy'], tone: 'error', label: 'after: 7 % 5 = 2', duration: 1.2, delay: 1.4 },
        ],
        panel: { title: 'Same key, new answer', icon: 'Hash', code: '7 % 4 = 3   node 3 has it\n7 % 5 = 2   node 2 never saw it', footer: { text: 'N changed, so the answer changed', tone: 'bad' } },
        caption: 'The remainder depends on N',
      },
    },
    {
      title: 'How much moves',
      tag: 'concept',
      heading: 'Going from N to N + 1 nodes moves about N/(N + 1) of keys',
      eli5: 'A kid keeps the same teacher only if the old count and the new count give the same number. That is rare, and rarer with more teachers, so almost every kid moves.',
      body: [
        'A key stays put only when both remainders match, which happens about 1 in N times. With N old nodes and one added, about **N/(N + 1)** of keys move. For N = 4 that is 4/5 = **80%**.',
        'Going from 10 to 11 moves 91%. The bigger the cluster, the closer a resize gets to a full cache flush.',
      ],
      keyIdea: 'With `hash % N`, going from N to N + 1 nodes remaps about N/(N + 1) of all keys, so every resize is a near-total cache flush.',
      metrics: { nodes: '4 → 5', moved: '80%', hit: '19%', db: '40,500 QPS' },
      metricTones: { moved: 'bad' },
      scene: {
        nodes: [{ ...app }, { ...pool, status: 'hot', badge: 'flushed' }, { ...db, status: 'hot', load: 97 }],
        links: [link('app', 'pool'), link('pool', 'db', { style: 'dashed', label: 'misses', labelTone: 'warn' })],
        flows: [
          { path: ['app', 'pool'], tone: 'request', count: 3, duration: 1.3 },
          { path: ['pool', 'db'], tone: 'error', count: 4, duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'Keys that move when N grows by 1',
          icon: 'Table',
          rows: [
            { text: '4 → 5 nodes', value: '80%', tone: 'warn' },
            { text: '10 → 11 nodes', value: '91%', tone: 'bad' },
            { text: '20 → 21 nodes', value: '95%', tone: 'bad' },
            { text: '100 → 101 nodes', value: '99%', tone: 'bad' },
          ],
          footer: { text: 'The bigger the cluster, the worse a resize', tone: 'bad' },
        },
        caption: 'Every resize is a near-total flush',
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
      title: 'The goal',
      tag: 'concept',
      heading: 'What we want: move only the keys that must move',
      eli5: 'When a new teacher joins, only a few kids should walk over to them. Everyone else keeps their teacher and their friends.',
      body: [
        'A fair share for a new node is **1/N** of the keys, with N the new cluster size, so 1 in 5 when the fifth node arrives. A perfect scheme moves exactly those and leaves the other 80% in place.',
        'This is the idea behind **consistent hashing**, introduced in a 1997 paper by Karger and colleagues at MIT. The same need appears in sharded databases, CDNs and cache clusters.',
      ],
      keyIdea: 'Consistent hashing is built so that resizing the cluster moves about 1/N of keys (N the new size) instead of N/(N + 1) of them.',
      metrics: { nodes: '4 → 5', moved: '~1/N', hit: '~76%', db: '~12,000 QPS' },
      metricTones: { moved: 'good' },
      scene: {
        nodes: [{ ...app }, { ...cx, label: 'cache C', sub: 'keys stay', status: 'ok' }, { ...cy, status: 'active', badge: 'takes 1/5' }, { ...db }],
        links: [link('app', 'cx'), link('app', 'cy'), link('app', 'db', { style: 'faint' })],
        flows: [
          { path: ['app', 'cx'], tone: 'response', label: 'hit', duration: 1.2 },
          { path: ['app', 'cy'], tone: 'request', label: 'a few keys', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Fair move when going 4 → 5',
          icon: 'Scale',
          rows: [
            { text: 'Modulo moves', value: '80%', tone: 'bad' },
            { text: 'Ideal moves (1/N)', value: '20%', tone: 'good' },
          ],
          footer: { text: 'Same new node, a quarter of the churn', tone: 'good' },
        },
        caption: 'Only the new node\'s share should move',
      },
    },
    {
      title: 'The ring',
      tag: 'concept',
      heading: 'Bend the hash space into a circle',
      eli5: 'Paint a big circle on the playground. That circle is the **ring**. Every spot on it has an angle, and spots never change when more teachers come.',
      body: [
        'Take the full output range of the hash, say 0 to 2³² − 1, and join the ends so it forms a **ring**. Every position is an angle from 0° to 360°, and 0 sits at the top.',
        'Keys and nodes will both be hashed into this one space. Its shape never depends on how many nodes exist.',
      ],
      keyIdea: 'The hash range is bent into a circle, and its shape does not depend on N.',
      metrics: { nodes: '0', hit: '-', db: '-' },
      scene: {
        nodes: [
          { id: 'r0', kind: 'ring', at: pol(0), label: '0', sub: 'top' },
          { id: 'r90', kind: 'ring', at: pol(90), label: '2³⁰ × 1', sub: '90°' },
          { id: 'r180', kind: 'ring', at: pol(180), label: '2³¹', sub: '180°' },
          { id: 'r270', kind: 'ring', at: pol(270), label: '3 × 2³⁰', sub: '270°' },
        ],
        links: [link('r0', 'r90', { route: 'straight' }), link('r90', 'r180', { route: 'straight' }), link('r180', 'r270', { route: 'straight' }), link('r270', 'r0', { route: 'straight' })],
        panel: {
          title: 'The hash space',
          icon: 'Hash',
          rows: [
            { text: 'Smallest value', value: '0' },
            { text: 'Largest value', value: '2³² − 1' },
            { text: 'After the largest', value: 'wraps to 0°' },
          ],
        },
        caption: 'Hash space 0 to 2³² − 1, wrapped into a circle, clockwise from the top',
      },
    },
    {
      title: 'Place nodes',
      tag: 'concept',
      heading: 'Hash each server onto the circle',
      eli5: 'Each teacher stands on a spot picked by their name, caches A to D. Teachers do not move when another one joins or leaves.',
      body: [
        'Hash each **node** onto the ring using its name or IP. Cache A lands at 0°, B at 72°, C at 144°, D at 252°.',
        'A node\'s position depends only on its own name. Adding E later does not move A, B, C or D, and that independence is what makes the ring work.',
      ],
      keyIdea: 'A node\'s position comes from hashing its own name, so it never depends on N.',
      metrics: { nodes: '4', hit: '95%', db: '2,500 QPS', skew: '1.2×' },
      metricTones: { hit: 'good', db: 'good' },
      scene: {
        nodes: [
          { ...A, status: 'active', chips: ['hash("cache-A")'] },
          { ...B, status: 'active' },
          { ...C, status: 'active' },
          { ...D, status: 'active' },
        ],
        panel: {
          title: 'Positions on the ring',
          icon: 'Hash',
          rows: [
            { text: 'hash("cache-A")', value: '0°' },
            { text: 'hash("cache-B")', value: '72°' },
            { text: 'hash("cache-C")', value: '144°' },
            { text: 'hash("cache-D")', value: '252°' },
          ],
          footer: { text: 'Names in, angles out. N is not an input.', tone: 'muted' },
        },
        caption: 'Four nodes hashed onto the same circle',
      },
    },
    {
      title: 'Walk clockwise',
      tag: 'concept',
      heading: 'A key belongs to the next node clockwise',
      eli5: 'Each kid also gets a spot from their name, then walks **clockwise** until they bump into a teacher. That teacher is theirs. A kid past the last teacher keeps walking to teacher A.',
      body: [
        'Hash the key onto the ring and walk **clockwise** until you hit a node. That node owns the key. Pass 360° and you wrap to 0°.',
        '`user:42` hashes to 190°, and the first node clockwise is D at 252°. `cart:9` lands at 300° and wraps around to A. `img:7` lands at 40° and stops at B.',
      ],
      keyIdea: 'Hash the key, then walk clockwise to the first node. That node owns it.',
      metrics: { nodes: '4', hit: '95%', db: '2,500 QPS', skew: '1.2×' },
      metricTones: { hit: 'good' },
      scene: {
        nodes: [A, B, { ...D, status: 'active', badge: 'owns user:42' }, key('k1', 'user:42', 190)],
        flows: [{ path: ['k1', 'D'], tone: 'request', label: '190° → 252°', duration: 1.6 }],
        panel: {
          title: 'Three lookups',
          icon: 'Route',
          rows: [
            { text: 'user:42 at 190°', value: 'D' },
            { text: 'cart:9 at 300°, wraps', value: 'A' },
            { text: 'img:7 at 40°', value: 'B' },
          ],
        },
        caption: 'Hash the key, then walk clockwise to the first node',
      },
    },
    {
      title: 'Arcs',
      tag: 'concept',
      heading: 'Each node owns the arc behind it',
      eli5: 'Every teacher looks after the stretch of circle just behind them, back to the previous teacher. A bigger stretch means more kids.',
      body: [
        'A node owns the **arc** between its counterclockwise neighbor and itself. D owns 144° to 252°, which is 30% of the ring. A owns 252° to 360°, also 30%.',
        'Load follows arc size. Keep that in mind, because it matters in two steps.',
      ],
      keyIdea: 'Each node owns the arc that ends at its position, and its share of keys is the size of that arc.',
      metrics: { nodes: '4', hit: '95%', db: '2,500 QPS', skew: '1.2×' },
      scene: {
        nodes: [
          { ...A, badge: '30%' },
          { ...B, badge: '20%' },
          { ...C, badge: '20%' },
          { ...D, status: 'active', badge: '30%' },
        ],
        panel: {
          title: 'Arc each node owns',
          icon: 'Scale',
          rows: [
            { text: 'A: 252° to 360°', value: '30%' },
            { text: 'B: 0° to 72°', value: '20%' },
            { text: 'C: 72° to 144°', value: '20%' },
            { text: 'D: 144° to 252°', value: '30%' },
          ],
          footer: { text: 'Fair share would be 25% each', tone: 'muted' },
        },
        caption: 'Arc size equals share of keys',
      },
    },
    {
      title: 'Fast lookup',
      tag: 'concept',
      heading: 'Finding the node is a binary search',
      eli5: 'The teachers wrote their spots on a sorted list. To find a kid\'s teacher, you look down the list for the first spot after the kid\'s own spot.',
      body: [
        'Keep the node positions in a sorted array. To place a key, hash it and binary search for the first position at or after it. That is **O(log N)**.',
        'If the search runs off the end of the array, wrap to index 0. That is the wrap past 360°.',
      ],
      keyIdea: 'A lookup is one hash plus one binary search over sorted node positions, wrapping at the end.',
      metrics: { nodes: '4', hit: '95%', db: '2,500 QPS' },
      scene: {
        nodes: [
          { ...app, chips: ['get("user:42")'] },
          { id: 'ring', kind: 'block', at: at(0, 0), label: 'sorted ring', sub: '[0, 72, 144, 252]', icon: 'List', tint: 'violet', status: 'active' },
          { ...D, at: at(4.4, 0), status: 'ok', badge: 'owner' },
        ],
        links: [link('app', 'ring'), link('ring', 'D')],
        flows: [
          { path: ['app', 'ring'], tone: 'request', label: 'hash = 190°', duration: 1.3 },
          { path: ['ring', 'D'], tone: 'response', label: 'first ≥ 190° is 252°', duration: 1.5, delay: 1.4 },
        ],
        panel: { title: 'Lookup cost', icon: 'Timer', rows: [{ text: 'Hash the key', value: '1 hash' }, { text: 'Find next position', value: 'O(log N)' }, { text: 'Past the last one', value: 'wrap to 0' }] },
        caption: 'Sorted positions, then bisect',
      },
      code: {
        language: 'python',
        title: 'Lookup on a sorted ring',
        source: `import bisect

points = [0, 72, 144, 252]            # sorted node positions
owner = {0: "A", 72: "B", 144: "C", 252: "D"}

def get(h):
    i = bisect.bisect_left(points, h)   # first position >= h
    return owner[points[i % len(points)]]  # wrap past the end

print(get(190))   # D
print(get(300))   # A, wrapped around`,
        highlight: [6, 7],
      },
    },
    {
      title: 'Add a node',
      tag: 'case',
      heading: 'Adding E moves one arc and nothing else',
      eli5: 'Teacher E steps onto the circle. Only the kids who now bump into E first switch teachers, and they all come from teacher D. Everyone else stays put. That gentle change is **consistent hashing**.',
      body: [
        'Cache E hashes to 216°, inside D\'s arc. Keys between 144° and 216° now reach E before they reach D. `user:42` at 190° goes to E.',
        'Every other key finds the same node as before. On average a new node takes about **1/N** of the keys, with N the new cluster size, here **20%**, all from its clockwise neighbor.',
      ],
      keyIdea: 'Adding a node only steals keys from its clockwise neighbor. About 1/N of keys move, and the rest of the cache stays warm.',
      metrics: { nodes: '5', moved: '20%', hit: '76%', db: '12,000 QPS', skew: '1.5×' },
      metricTones: { moved: 'good', hit: 'warn', db: 'warn' },
      scene: {
        nodes: [
          { ...C, badge: 'unchanged' },
          { ...D, badge: 'gave away 144°-216°' },
          { ...E, status: 'active', badge: 'new: +20% of keys' },
          key('k1', 'user:42', 190),
        ],
        flows: [{ path: ['k1', 'E'], tone: 'request', label: 'user:42 now → E', duration: 1.6 }],
        panel: {
          title: 'Who changed',
          icon: 'Split',
          rows: [
            { text: 'E', value: 'gains 20%', tone: 'good' },
            { text: 'D', value: 'loses 20%', tone: 'warn' },
            { text: 'A, B, C', value: 'no change', tone: 'good' },
          ],
          footer: { text: 'Modulo would have moved 80%', tone: 'good' },
        },
        caption: 'Only keys in E\'s new arc move',
      },
    },
    {
      title: 'Moving keys',
      tag: 'concept',
      heading: 'Finding which keys must move',
      eli5: 'The new teacher asks only the teacher behind them to hand over the kids standing in the new stretch. Nobody else gets asked.',
      body: [
        'The affected range is from E\'s counterclockwise neighbor (C at 144°) up to E (216°). Those keys are currently owned by E\'s clockwise neighbor, D.',
        'A cache can skip the copy and let misses refill E from the database, so E warms up over minutes. A data store streams that range from D to E instead, so no data is lost.',
      ],
      keyIdea: 'On a join, the moving range is bounded by the new node and its counterclockwise neighbor, and only the clockwise neighbor has to hand it over.',
      metrics: { nodes: '5', moved: '20%', hit: '76%', db: '12,000 QPS' },
      metricTones: { hit: 'warn' },
      scene: {
        nodes: [{ ...C, status: 'dim', sub: 'range start 144°' }, { ...E, status: 'active', badge: 'range end 216°' }, { ...D, status: 'ok', badge: 'hands over' }],
        flows: [{ path: ['D', 'E'], tone: 'data', label: 'keys 144° to 216°', count: 3, duration: 1.8 }],
        panel: {
          title: 'Join steps',
          icon: 'List',
          rows: [
            { text: '1. E hashes to 216°' },
            { text: '2. Range is (144°, 216°]' },
            { text: '3. D streams it to E' },
            { text: '4. D deletes its copy' },
          ],
          footer: { text: 'Caches may skip 3 and refill on misses', tone: 'muted' },
        },
        caption: 'One neighbor hands over one range',
      },
    },
    {
      title: 'Lose a node',
      tag: 'case',
      heading: 'When B dies, only B\'s keys move',
      eli5: 'Teacher B goes home sick. B\'s kids keep walking around the circle and all end up with teacher C, the next **node**. Nobody else moves, but C now has twice as many kids.',
      body: [
        'Cache B crashes. Its keys, the arc from 0° to 72°, walk clockwise past the empty spot and land on C. `img:7` at 40° now goes to C.',
        'Again only one arc moved, here 20% of keys. With modulo, losing one node out of five would remap 80% of everything.',
      ],
      keyIdea: 'A failed node\'s keys all go to its clockwise neighbor, and nothing else moves.',
      metrics: { nodes: '4', moved: '20%', hit: '76%', db: '12,000 QPS', skew: '1.6×' },
      metricTones: { moved: 'good', hit: 'warn' },
      scene: {
        nodes: [A, { ...B, status: 'down', badge: 'down' }, { ...C, status: 'hot', load: 80, badge: '+20% from B' }, key('k2', 'img:7', 40)],
        flows: [
          { path: ['k2', 'B'], tone: 'error', label: 'B is gone', duration: 1.2 },
          { path: ['k2', 'C'], tone: 'request', label: 'img:7 → C', duration: 1.6, delay: 1.3 },
        ],
        panel: {
          title: 'Arcs after B fails',
          icon: 'Split',
          rows: [
            { text: 'A, D, E', value: 'unchanged', tone: 'good' },
            { text: 'C before', value: '20%' },
            { text: 'C after', value: '40%', tone: 'bad' },
          ],
          footer: { text: 'One neighbor absorbs everything', tone: 'warn' },
        },
        caption: 'B\'s whole arc falls to the next node clockwise',
      },
    },
    {
      title: 'Uneven load',
      tag: 'tradeoff',
      heading: 'A few random points make lumpy arcs',
      eli5: 'The teachers stand at random spots, so the gaps between them are uneven. Teacher A has a long stretch of circle with lots of kids walking in. Teacher C has a tiny one and is nearly alone.',
      body: [
        'Take a healthy ring of four live nodes with one point each. Arc sizes are random, so A owns 40% of the ring and C owns 14%, where each node should hold 25%.',
        'A is at **1.6×** its fair share, so it runs hot and fills its network link first. C sits mostly idle. A bigger A does not fix the shape of the ring.',
      ],
      keyIdea: 'One point per node gives random arc sizes. Load follows arc size, so a few nodes always end up overloaded.',
      metrics: { nodes: '4', hit: '95%', db: '2,500 QPS', skew: '1.6×' },
      metricTones: { skew: 'bad' },
      scene: {
        nodes: [
          { ...A, status: 'hot', load: 92, sub: 'at 0°', badge: '40%' },
          { ...B, at: pol(90), sub: 'at 90°', badge: '25%' },
          { ...C, at: pol(140), sub: 'at 140°', status: 'dim', badge: '14%' },
          { ...D, at: pol(216), sub: 'at 216°', badge: '21%' },
          key('k3', 'cart:9', 300),
        ],
        flows: [{ path: ['k3', 'A'], tone: 'request', label: 'most keys land here', count: 4, duration: 1.8 }],
        panel: {
          title: 'Share of keys, healthy ring',
          icon: 'Scale',
          rows: [
            { text: 'A', value: '40%', tone: 'bad' },
            { text: 'B', value: '25%' },
            { text: 'D', value: '21%' },
            { text: 'C', value: '14%', tone: 'muted' },
          ],
          footer: { text: 'Fair share is 25% each', tone: 'bad' },
        },
        caption: 'Fair share is 25% each. A has 40%, C has 14%.',
      },
    },
    {
      title: 'Virtual nodes',
      tag: 'concept',
      heading: 'Give every node many points on the ring',
      eli5: 'Give each teacher a helper in the same color shirt, standing somewhere else on the circle. These are **virtual nodes**. A kid who bumps into a helper belongs to that teacher, so the groups come out fair.',
      body: [
        'Instead of one position per node, hash each node many times: `A#0`, `A#1`, … `A#149`. Each of these **virtual nodes** owns a small arc, and the physical node owns the sum of them.',
        'The scene shows two points each for A and B. Real systems use 100 to 256.',
      ],
      keyIdea: 'Virtual nodes turn one big random arc per node into many small ones that sum to the node\'s share.',
      metrics: { nodes: '3', hit: '95%', db: '2,500 QPS', skew: '1.1×' },
      scene: {
        nodes: [
          { ...A, status: 'active', sub: 'A#0 at 0°' },
          { id: 'A2', kind: 'ring', at: pol(180), label: 'A#1', sub: 'belongs to A', status: 'active' },
          { ...B, status: 'ok', sub: 'B#0 at 72°' },
          { id: 'B2', kind: 'ring', at: pol(288), label: 'B#1', sub: 'belongs to B', status: 'ok' },
          { ...C, sub: 'C#0 at 144°' },
        ],
        panel: {
          title: 'Points per node',
          icon: 'Hash',
          rows: [
            { text: 'Classic ring', value: '1 point' },
            { text: 'With virtual nodes', value: '100 to 256', tone: 'good' },
            { text: 'Owner of a point', value: 'its physical node' },
          ],
        },
        caption: 'Two points per node shown. Production rings use 100 or more.',
      },
    },
    {
      title: 'Even load',
      tag: 'tradeoff',
      heading: 'Many small arcs average out',
      eli5: 'Lots of small stretches of the circle, scattered around, add up to about the same total for every teacher. Fewer fights over who got the long stretch.',
      body: [
        'Many small random arcs sum to nearly equal totals. With 150 virtual nodes each, five caches end up between 18% and 23% of keys, so the busiest is about **1.1×** its fair share.',
        'The price is memory and lookups over a bigger sorted array, 750 points instead of 5. More points means smoother load but slower membership changes, so teams tune it.',
      ],
      keyIdea: 'More virtual nodes give smoother load, at the cost of a bigger ring to store and update.',
      metrics: { nodes: '5', hit: '95%', db: '2,500 QPS', skew: '1.1×' },
      metricTones: { skew: 'good', hit: 'good' },
      scene: {
        nodes: [
          { ...A, status: 'ok', badge: '20%' },
          { ...B, status: 'ok', badge: '22%' },
          { ...C, status: 'ok', badge: '19%' },
          { ...E, status: 'ok', badge: '20%' },
          { ...D, status: 'ok', badge: '19%' },
        ],
        panel: {
          title: 'Points vs smoothness',
          icon: 'Scale',
          rows: [
            { text: '1 point each', value: 'lumpy', tone: 'bad' },
            { text: '10 points each', value: 'better', tone: 'warn' },
            { text: '150 points each', value: '1.1× busiest', tone: 'good' },
          ],
          footer: { text: 'Bigger machines can get more points', tone: 'muted' },
        },
        caption: 'Five nodes with 150 points each',
      },
    },
    {
      title: 'Spread failures',
      tag: 'concept',
      heading: 'A dead node\'s keys scatter across the survivors',
      eli5: 'When teacher B goes home sick, B\'s helpers stand all over the circle, so B\'s kids go to many different teachers. No single teacher gets swamped.',
      body: [
        'B\'s many small arcs each sit just before a different node. When B dies, its keys go to A, C, D and E in small slices instead of landing on one neighbor.',
        'Each survivor picks up about a quarter of B\'s 20%, so its load rises by about 5 points instead of 20.',
      ],
      keyIdea: 'With virtual nodes a failure is shared by all survivors, so no single neighbor takes the full hit.',
      metrics: { nodes: '4', moved: '20%', hit: '76%', db: '12,000 QPS', skew: '1.1×' },
      metricTones: { moved: 'good', skew: 'good' },
      scene: {
        nodes: [A, { ...B, status: 'down', badge: 'down' }, C, E, D],
        flows: [
          { path: ['B', 'A'], tone: 'data', label: '+5%', duration: 1.6 },
          { path: ['B', 'C'], tone: 'data', label: '+5%', duration: 1.6, delay: 0.2 },
          { path: ['B', 'E'], tone: 'data', label: '+5%', duration: 1.6, delay: 0.4 },
          { path: ['B', 'D'], tone: 'data', label: '+5%', duration: 1.6, delay: 0.6 },
        ],
        panel: {
          title: 'B\'s 20% after it fails',
          icon: 'Split',
          rows: [
            { text: 'One point each', value: 'C takes +20%', tone: 'bad' },
            { text: 'Virtual nodes', value: 'each takes ~+5%', tone: 'good' },
          ],
        },
        caption: 'B\'s keys are shared out',
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
    {
      title: 'Build the ring',
      tag: 'concept',
      heading: 'A working hash ring in 20 lines',
      eli5: 'The ring is just a list of spots in order, each tagged with a teacher. To find a kid\'s teacher you look for the next spot in the list.',
      body: [
        '`add` hashes `node#0` to `node#149` and keeps all positions sorted. `get` binary searches for the first position at or after the key and wraps with a modulo.',
        'Adding E touches only E\'s new points, and every key not between one of those points and its predecessor keeps its owner.',
      ],
      keyIdea: 'A ring is a sorted list of hashed points with an owner map, plus one bisect per lookup.',
      metrics: { nodes: '5', moved: '~18%', hit: '95%', skew: '1.1×' },
      scene: {
        nodes: [
          { ...app, chips: ['ring.get("user:42")'] },
          { id: 'ring', kind: 'block', at: at(0, 0), label: 'hash ring', sub: '750 points', icon: 'Hash', tint: 'violet', status: 'active' },
          { id: 'cache', kind: 'cache', at: at(4.4, 0), label: 'owner', status: 'ok' },
        ],
        links: [link('app', 'ring'), link('ring', 'cache')],
        flows: [
          { path: ['app', 'ring'], tone: 'request', label: 'hash + bisect', duration: 1.4 },
          { path: ['ring', 'cache'], tone: 'response', duration: 1.2, delay: 1.5 },
        ],
        panel: { title: 'Cost per operation', icon: 'Timer', rows: [{ text: 'get', value: 'O(log P)' }, { text: 'add node', value: 'V inserts' }, { text: 'P = points, V = vnodes' }] },
        caption: 'Sorted points plus bisect',
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
      title: 'Hot keys',
      tag: 'tradeoff',
      heading: 'One celebrity key beats any ring',
      eli5: 'If one kid is so popular that everyone asks for them, even a fair circle sends the whole crowd to one teacher. The fix is to give that kid a few look-alike name tags.',
      body: [
        'Virtual nodes even out keys on average. They cannot split one key, and a single key always lives on one node. If `celeb:1` gets 30,000 reads a second, that node is slammed.',
        'Fixes live outside the ring: a short in-process cache on each app server, or **key splitting** into `celeb:1#0` to `celeb:1#3` so reads spread over four nodes.',
      ],
      keyIdea: 'The ring balances many keys, not one hot key. Cache it near the client or split it into several keys.',
      metrics: { nodes: '5', hit: '95%', db: '2,500 QPS', skew: '3×' },
      metricTones: { skew: 'bad' },
      scene: {
        nodes: [
          { ...app, chips: [{ text: 'GET celeb:1 × 30k/s', tone: 'warn' }] },
          { ...C, at: at(2.5, -3.6), status: 'hot', load: 97, sub: 'owns celeb:1' },
          { id: 'local', kind: 'block', at: at(-0.2, 4.4), label: 'local cache', sub: 'per app server', icon: 'Zap', tint: 'green' },
          { ...E, at: at(3.8, 3.6), label: 'cache E', sub: 'celeb:1#1', status: 'ok' },
        ],
        links: [link('app', 'C', { label: 'all reads', labelTone: 'warn' }), link('app', 'local'), link('app', 'E')],
        flows: [
          { path: ['app', 'C'], tone: 'error', count: 4, duration: 1.4 },
          { path: ['app', 'local'], tone: 'response', label: '1 s TTL', duration: 1.2, delay: 1.5 },
          { path: ['app', 'E'], tone: 'request', label: 'split key', duration: 1.4, delay: 2.4 },
        ],
        panel: {
          title: 'Ways to cool a hot key',
          icon: 'Zap',
          rows: [
            { text: 'Local cache with short TTL', value: 'cuts reads', tone: 'good' },
            { text: 'Split into key#0 to key#3', value: 'spreads reads', tone: 'good' },
            { text: 'More vnodes', value: 'no effect', tone: 'bad' },
          ],
        },
        caption: 'One key still lives on one node',
      },
    },
    {
      title: 'Replicas',
      tag: 'concept',
      heading: 'Copies go to the next nodes clockwise',
      eli5: 'Big schools keep spare copies. A kid\'s name goes to the first teacher they bump into and to the next two around the circle. Each one is a **replica**, so a sick teacher loses nothing.',
      body: [
        'To replicate, keep walking clockwise and store the key on the next **N distinct** nodes, usually 3. `user:42` goes to E, then D, then A.',
        'With virtual nodes the walk skips points that belong to a node already chosen. Otherwise two copies could sit on one machine.',
      ],
      keyIdea: 'Replication comes from the same walk: the key lives on the next N distinct physical nodes clockwise.',
      metrics: { nodes: '5', hit: '95%', db: '2,500 QPS', skew: '1.1×' },
      scene: {
        nodes: [key('k1', 'user:42', 190), { ...E, status: 'active', badge: 'replica 1' }, { ...D, status: 'ok', badge: 'replica 2' }, { ...A, status: 'ok', badge: 'replica 3' }],
        flows: [
          { path: ['k1', 'E'], tone: 'request', label: 'write user:42', duration: 1.4 },
          { path: ['E', 'D'], tone: 'data', label: 'copy', duration: 1.2, delay: 1.5 },
          { path: ['D', 'A'], tone: 'data', label: 'copy', duration: 1.4, delay: 2.8 },
        ],
        panel: { title: 'Replication factor 3', icon: 'Copy', rows: [{ text: 'Replica 1', value: 'E at 216°' }, { text: 'Replica 2', value: 'D at 252°' }, { text: 'Replica 3', value: 'A at 360°' }], footer: { text: 'Distinct machines only', tone: 'muted' } },
        caption: 'Dynamo style: a key lives on the next 3 distinct nodes clockwise',
      },
    },
    {
      title: 'Same ring everywhere',
      tag: 'concept',
      heading: 'Every client must agree on the ring',
      eli5: 'Every kid who asks needs the same list of teachers. If two kids hold different lists, they walk to different teachers for the same name.',
      body: [
        'Clients or coordinators compute the owner themselves, so they all need the same node list. Cassandra and Dynamo nodes share it by **gossip**, and cache clients read it from config or a service registry.',
        'During a change, two views can briefly differ and one key may be asked of two nodes. The result is an extra miss, so caches tolerate it. Databases route through a coordinator.',
      ],
      keyIdea: 'The ring only works if everyone computes it from the same member list, so membership is shared by gossip or a registry.',
      metrics: { nodes: '5', hit: '90%', db: '5,000 QPS' },
      metricTones: { hit: 'warn' },
      scene: {
        nodes: [
          { id: 'c1', kind: 'block', at: at(-4, -3.6), label: 'client 1', sub: 'sees A B C D', icon: 'Laptop', tint: 'blue' },
          { id: 'c2', kind: 'block', at: at(-4, 3.6), label: 'client 2', sub: 'sees A B C D E', icon: 'Laptop', tint: 'amber', status: 'active' },
          { ...D, at: at(3, -3.6), status: 'dim', badge: 'client 1 asks D' },
          { ...E, at: at(3, 3.6), status: 'active', badge: 'client 2 asks E' },
        ],
        links: [link('c1', 'D'), link('c2', 'E')],
        flows: [
          { path: ['c1', 'D'], tone: 'request', label: 'user:42', duration: 1.5 },
          { path: ['c2', 'E'], tone: 'request', label: 'user:42', duration: 1.5, delay: 0.3 },
        ],
        panel: { title: 'Sharing the member list', icon: 'Share2', rows: [{ text: 'Gossip between nodes', value: 'Dynamo, Cassandra' }, { text: 'Config or registry', value: 'cache clients' }, { text: 'Stale view', value: 'extra miss', tone: 'warn' }] },
        caption: 'Two views, two answers for one key',
      },
    },
    {
      title: 'In the wild',
      tag: 'case',
      heading: 'Where you will meet the ring',
      eli5: 'The same circle runs many places: which teacher keeps your name, which store holds a poster, which helper handles your friend\'s calls. Only the **ring** idea stays the same.',
      body: [
        '**Dynamo** and **Cassandra** place data on a ring of tokens. Cassandra 4.0 defaults to 16 tokens per node with a smarter allocator. **CDNs** use it to pick which edge server caches a URL, and Akamai came out of the 1997 paper\'s authors.',
        '**Memcached** clients (ketama) and Envoy\'s ring hash use it to keep each key or session on the same backend.',
      ],
      keyIdea: 'Consistent hashing shows up wherever a key must find its machine and machines come and go: databases, CDNs, cache clusters and sticky load balancing.',
      metrics: { nodes: '5', hit: '95%', db: '2,500 QPS', skew: '1.1×' },
      scene: {
        nodes: [
          { id: 'w1', kind: 'block', at: at(-3.6, -3), label: 'Cassandra', sub: 'token ring', icon: 'Database', tint: 'violet' },
          { id: 'w2', kind: 'block', at: at(3.6, -3), label: 'CDN edge', sub: 'URL → server', icon: 'Globe', tint: 'blue' },
          { id: 'w3', kind: 'block', at: at(-3.6, 3), label: 'Memcached', sub: 'ketama client', icon: 'Layers', tint: 'teal' },
          { id: 'w4', kind: 'block', at: at(3.6, 3), label: 'Envoy', sub: 'ring hash LB', icon: 'Network', tint: 'amber' },
        ],
        panel: { title: 'What the key is', icon: 'KeyRound', rows: [{ text: 'Cassandra', value: 'partition key' }, { text: 'CDN', value: 'URL' }, { text: 'Memcached', value: 'cache key' }, { text: 'Envoy', value: 'header or cookie' }] },
        caption: 'Same ring, different keys',
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
      title: 'Other schemes',
      tag: 'tradeoff',
      heading: 'Rendezvous, jump hash and bounded loads',
      eli5: 'There are other ways to pick a teacher. Let every teacher shout a score for each kid and the highest wins, or count off in a clever way, or cap how many kids one teacher may take.',
      body: [
        '**Rendezvous hashing** scores each node for a key and picks the highest. It moves only the keys it must and needs no ring, but a lookup costs O(N). **Jump hash** uses no memory and is perfectly even, but nodes must be numbered 0 to N−1 and only the last can leave.',
        '**Bounded loads** caps each node at a multiple of the average, say 1.25×, and spills extra keys to the next node on the ring.',
      ],
      keyIdea: 'Pick the ring for flexible membership, rendezvous for small clusters, jump hash for numbered shards, and add bounded loads to cap hotspots.',
      metrics: { nodes: '5', skew: '1.1×' },
      scene: {
        nodes: [
          { id: 'o1', kind: 'block', at: at(-3.6, -3), label: 'Ring', sub: 'O(log N)', icon: 'Hash', tint: 'violet' },
          { id: 'o2', kind: 'block', at: at(3.6, -3), label: 'Rendezvous', sub: 'highest score', icon: 'Scale', tint: 'blue' },
          { id: 'o3', kind: 'block', at: at(-3.6, 3), label: 'Jump hash', sub: 'no memory', icon: 'Zap', tint: 'green' },
          { id: 'o4', kind: 'block', at: at(3.6, 3), label: 'Bounded', sub: 'caps at 1.25×', icon: 'Gauge', tint: 'amber' },
        ],
        panel: {
          title: 'Trade-offs',
          icon: 'Table',
          rows: [
            { text: 'Ring + vnodes', value: 'any node leaves' },
            { text: 'Rendezvous', value: 'O(N) lookup', tone: 'warn' },
            { text: 'Jump hash', value: 'only last leaves', tone: 'warn' },
            { text: 'Bounded loads', value: 'caps hot nodes', tone: 'good' },
          ],
        },
        caption: 'Four ways to pick an owner',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Change the cluster, keep the cache',
      eli5: 'Counting off reshuffles everybody when a teacher joins. With **consistent hashing**, teachers and helpers stand on a circle, kids walk to the next one, and a new teacher only takes a few kids.',
      body: [
        '`hash(key) % N` remaps about N/(N + 1) of keys when N nodes become N + 1. The ring hashes keys and nodes into one circular space, and each key belongs to the next node clockwise.',
        'Adding or removing a node moves about **1/N** of keys, with N the new cluster size. One point per node makes lumpy arcs and dumps failures on one neighbor, so real systems use many **virtual nodes**.',
      ],
      keyIdea: 'Consistent hashing makes membership changes cheap: about 1/N of keys move, and virtual nodes keep the load even.',
      metrics: { nodes: '5', moved: '~1/N', hit: '95%', db: '2,500 QPS', skew: '1.1×' },
      metricTones: { moved: 'good', hit: 'good', db: 'good', skew: 'good' },
      scene: {
        nodes: [{ ...A, status: 'ok' }, { ...B, status: 'ok' }, { ...C, status: 'ok' }, { ...E, status: 'ok' }, { ...D, status: 'ok' }],
        flows: [{ path: ['A', 'B'], tone: 'data', duration: 1.4 }, { path: ['C', 'E'], tone: 'data', duration: 1.4, delay: 0.7 }],
        panel: { title: 'Keep these', icon: 'Star', rows: [{ text: 'Modulo resize', value: 'N/(N + 1) moves', tone: 'bad' }, { text: 'Ring resize', value: '~1/N moves', tone: 'good' }, { text: 'Fix lumpy arcs', value: 'virtual nodes', tone: 'good' }] },
      },
      quiz: {
        question: 'A ring has 9 nodes and you add a 10th. About what share of keys move?',
        options: ['About 10%, taken from the neighbors of the new points', 'About 90%', 'About 50%', 'None'],
        answer: 0,
        explain: 'A new node takes about 1/N of the keys with N the new size, here 1 in 10. A modulo scheme would move about 90%.',
      },
    },
  ],
};
