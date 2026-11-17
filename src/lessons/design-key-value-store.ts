import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place a node by screen column (sx) and screen row (sy). Same sy = one horizontal row on screen. */
const p = (sx: number, sy: number): [number, number] => [(sy + sx) / 2, (sy - sx) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

// Callers.
const client: SceneNode = { id: 'client', kind: 'client', at: p(-7.5, 0), label: 'cart service' };
const phone: SceneNode = { id: 'phone', kind: 'phone', at: p(-7.5, -7.5), label: 'shopper phone' };

// The early single-box designs.
const store: SceneNode = { id: 'store', kind: 'db', at: p(0, 0), label: 'KV store', sub: 'get / put' };

// Six of the storage nodes, drawn as a ring. Clockwise on screen: A (top), B, C, D (bottom), E, F.
const A: SceneNode = { id: 'A', kind: 'shard', at: p(0, -6), label: 'node A' };
const B: SceneNode = { id: 'B', kind: 'shard', at: p(3.4, -3), label: 'node B' };
const C: SceneNode = { id: 'C', kind: 'shard', at: p(3.4, 3), label: 'node C' };
const D: SceneNode = { id: 'D', kind: 'shard', at: p(0, 6), label: 'node D' };
const F: SceneNode = { id: 'F', kind: 'shard', at: p(-3.4, -3), label: 'node F' };

export const designKeyValueStore: Lesson = {
  id: 'design-key-value-store',
  title: 'Design a key-value store (part 1)',
  tagline: 'Build a Dynamo-style store for 10 billion keys: requirements, partitioning, replication and quorums.',
  minutes: 18,
  level: 'Advanced',
  learn: [
    'Requirements, scale numbers and why this store chooses availability',
    'The get, put and delete API, the context you hand back, and the flat data model',
    'Partitioning on a hash ring with virtual nodes, and which node coordinates a request',
    'Replicating to N nodes across failure domains, and surviving a datacenter outage',
    'Tuning R and W per request, what R + W > N buys, resizing for quorum reads, and read repair',
  ],
  metrics: [
    { key: 'nodes', label: 'Nodes', icon: 'Server' },
    { key: 'ops', label: 'Peak ops', icon: 'Zap' },
    { key: 'data', label: 'Data', icon: 'Database' },
    { key: 'p99', label: 'p99 latency', icon: 'Timer' },
    { key: 'quorum', label: 'Quorum', icon: 'Scale' },
  ],
  steps: [
    {
      title: 'Requirements',
      tag: 'problem',
      heading: 'A cart store that never refuses a write',
      eli5: 'The shop needs a giant notebook where any name can be looked up and written down. The **key-value store** is that notebook, and it must take new notes even when some helpers are sick.',
      body: [
        'The shop keeps carts, sessions and user settings in one internal **key-value store**. The API is two calls, `get(key)` and `put(key, value)`. Values are small blobs under 10 KB, about 1 KB on average, and the store never looks inside them.',
        'Scale: **10 billion keys**, about **10 TB**. Peak traffic is **300K reads/s and 200K writes/s**, with a p99 under **10 ms**. A shopper who cannot add to a cart is a lost sale.',
      ],
      keyIdea: 'Write the numbers first: 500K ops/s, 10 TB, p99 under 10 ms, and writes that keep working during failures.',
      metrics: { nodes: '?', ops: '500K/s', data: '10 TB', p99: '< 10 ms target', quorum: '-' },
      scene: {
        nodes: [
          { ...phone, chips: ['add to cart'] },
          { ...client, chips: ['get cart:42'] },
          { ...store, sub: '10B keys?', badge: '500K ops/s', status: 'active' },
        ],
        links: [link('phone', 'store'), link('client', 'store')],
        flows: [
          { path: ['client', 'store'], tone: 'request', label: 'put cart:42', count: 3, duration: 1.2 },
          { path: ['phone', 'store'], tone: 'request', label: 'get cart:42', count: 3, duration: 1.2, delay: 0.6 },
        ],
        panel: {
          title: 'The brief',
          icon: 'List',
          rows: [
            { text: 'Keys', value: '10 billion' },
            { text: 'Data', value: '10 TB' },
            { text: 'Reads at peak', value: '300K/s' },
            { text: 'Writes at peak', value: '200K/s' },
            { text: 'p99 latency', value: '< 10 ms', tone: 'good' },
          ],
        },
        caption: 'Two calls, a lot of keys',
      },
    },
    {
      title: 'Scale math',
      tag: 'concept',
      heading: 'First estimate: 20 nodes, before any copies',
      eli5: 'Before hiring helpers, count the pages and count how fast one helper writes. That tells you how many helpers the **cluster** needs.',
      body: [
        '10 TB split over nodes of 500 GB means **20 nodes**. 500K ops/s over 20 nodes is 25K ops/s each, close to what one node can do from SSD with an LSM engine (about 30K ops/s).',
        'This is a floor. Copies for safety, quorum reads and headroom for background work will raise it, and we will redo the sum at each step.',
      ],
      keyIdea: 'Size from two numbers: bytes per node and ops per node. Take whichever needs more machines.',
      metrics: { nodes: '20', ops: '500K/s', data: '500 GB per node', p99: '< 10 ms target', quorum: '1 copy' },
      scene: {
        nodes: [
          { id: 'sizeData', kind: 'block', at: p(-3.6, 0), label: '10 TB', sub: 'by size', icon: 'HardDrive', tint: 'blue' },
          { id: 'sizeOps', kind: 'block', at: p(3.6, 0), label: '500K ops/s', sub: 'by throughput', icon: 'Zap', tint: 'amber' },
          { id: 'fleet', kind: 'block', at: p(0, 5), label: '20 nodes', sub: '500 GB, 25K ops/s each', icon: 'Server', tint: 'green' },
        ],
        links: [link('sizeData', 'fleet', { label: '10 TB / 500 GB' }), link('sizeOps', 'fleet', { label: '500K / 25K' })],
        flows: [
          { path: ['sizeData', 'fleet'], tone: 'data', duration: 1.4 },
          { path: ['sizeOps', 'fleet'], tone: 'data', duration: 1.4, delay: 0.4 },
        ],
        panel: {
          title: 'Per-node budget',
          icon: 'Table',
          rows: [
            { text: 'Disk per node', value: '500 GB' },
            { text: 'Ops per node (SSD, LSM)', value: '~30K/s' },
            { text: 'By size', value: '20 nodes' },
            { text: 'By ops', value: '17 to 20 nodes' },
          ],
          footer: { text: 'Floor: 20 nodes, with no copies yet', tone: 'muted' },
        },
        caption: 'Whichever limit needs more machines wins',
      },
    },
    {
      title: 'AP stance',
      tag: 'tradeoff',
      heading: 'Availability first: an AP store',
      eli5: 'If two helpers cannot hear each other, either they stop taking notes until they can, or they keep writing and sort out differences later. The shop picks **keep writing**.',
      body: [
        'In the terms of the CAP and PACELC lesson, a partition forces a choice. A **CP** store refuses writes it cannot confirm. An **AP** store keeps accepting them and lets copies disagree for a while.',
        'A cart that rejects an add loses a sale, and a briefly stale item costs little. So we pick **AP**. R and W then give eventual consistency, or read-your-writes when R + W > N. A feature that needs strong consistency, such as stock counts, belongs on a CP store or a compare-and-set service.',
      ],
      keyIdea: 'Pick the failure stance before the design. Here a refused write costs more than a stale read.',
      metrics: { nodes: '20', ops: '500K/s', data: '500 GB per node', p99: '< 10 ms target', quorum: 'tunable' },
      metricTones: { quorum: 'good' },
      scene: {
        nodes: [
          { ...client, chips: ['put cart:42'] },
          { id: 'cp', kind: 'block', at: p(0, -5), label: 'CP store', sub: 'refuses when split', icon: 'Shield', tint: 'red', status: 'down' },
          { id: 'ap', kind: 'block', at: p(0, 5), label: 'AP store', sub: 'keeps accepting', icon: 'Zap', tint: 'green', status: 'ok' },
        ],
        links: [link('client', 'cp', { label: 'link split', labelTone: 'warn' }), link('client', 'ap', { label: 'link split', labelTone: 'warn' })],
        flows: [
          { path: ['client', 'cp'], tone: 'request', label: 'put', duration: 1.2 },
          { path: ['cp', 'client'], tone: 'error', label: 'rejected', duration: 1.2, delay: 1.3 },
          { path: ['client', 'ap'], tone: 'request', label: 'put', duration: 1.2, delay: 2.8 },
          { path: ['ap', 'client'], tone: 'response', label: 'ok', duration: 1.2, delay: 4.1 },
        ],
        panel: {
          title: 'During a partition',
          icon: 'Scale',
          rows: [
            { text: 'CP: write while split', value: 'error', tone: 'bad' },
            { text: 'AP: write while split', value: 'ok, may conflict', tone: 'good' },
            { text: 'Cart add refused', value: 'lost sale', tone: 'bad' },
            { text: 'Cart briefly stale', value: 'minor', tone: 'good' },
          ],
        },
        caption: 'The business picks the side',
      },
    },
    {
      title: 'API',
      tag: 'concept',
      heading: 'Two calls, plus a version you hand back',
      eli5: 'When you read a page, the helper also gives you a little stamp. When you write the page again, you hand the stamp back, so the helper knows which page you started from. The stamp is the **context**.',
      body: [
        '`get(key)` returns the value and an opaque **context**: the version information the store keeps for that key. `put(key, context, value)` sends it back, so the store knows which version this write was based on. `delete(key, context)` does the same and writes a tombstone. Callers never edit the context.',
        'Usually `get` returns one value. After concurrent writes it can return two or more **siblings** with one merged context, and the caller combines them. That is the price of never refusing a write.',
      ],
      keyIdea: 'Every read hands out a version, every write hands it back. That is how the store tells an update from a conflict.',
      metrics: { nodes: '20', ops: '500K/s', data: '500 GB per node', p99: '< 10 ms target', quorum: 'tunable' },
      scene: {
        nodes: [client, { ...store, status: 'active', chips: ['get / put'] }],
        links: [link('client', 'store', { arrow: 'both' })],
        flows: [
          { path: ['client', 'store'], tone: 'request', label: 'get cart:42', duration: 1.1 },
          { path: ['store', 'client'], tone: 'response', label: 'values + ctx', duration: 1.1, delay: 1.2 },
          { path: ['client', 'store'], tone: 'request', label: 'put(ctx, value)', duration: 1.1, delay: 2.6 },
        ],
        panel: {
          title: 'The contract',
          icon: 'Code',
          code: 'get(key) -> (values[], ctx)\nput(key, ctx, value) -> ok\ndelete(key, ctx) -> ok\n\nvalues[] has 1 entry, or\nsiblings after a conflict',
        },
      },
      code: {
        language: 'python',
        title: 'Adding an item to a cart with the store API',
        source: `# get returns every value the store could not order, plus one context
values, ctx = kv.get("cart:42")

# siblings exist only after concurrent writes: merge them in the app
cart = set()
for v in values:
    cart |= set(json.loads(v))

cart.add("sku-981")
# pass ctx back so this version supersedes everything we just read
kv.put("cart:42", ctx, json.dumps(sorted(cart)))`,
        highlight: [2, 7, 11],
      },
    },
    {
      title: 'Data model',
      tag: 'concept',
      heading: 'A flat record, and what it rules out',
      eli5: 'Every page in the notebook has a name at the top and a blob of notes below. You can only find a page by its exact name, never by "all pages that mention socks".',
      body: [
        'The data model is flat: a key, the value bytes, a version vector, and an optional expiry time (**TTL**) so sessions clean themselves up. The store never parses the value.',
        'There are no secondary indexes and no queries across keys. Keys are hashed for placement, so range scans are off the table too. Need to find carts by user? Keep a second key such as `user:7:carts` that points at them.',
      ],
      keyIdea: 'Giving up queries is what buys the scale. Lookups by exact key are the only fast path.',
      metrics: { nodes: '20', ops: '500K/s', data: '500 GB per node', p99: '< 10 ms target', quorum: 'tunable' },
      scene: {
        nodes: [
          { id: 'record', kind: 'block', at: p(-3.6, 0), label: 'record', sub: 'key, value, vector, TTL', icon: 'FileJson', tint: 'blue', status: 'active' },
          { id: 'fast', kind: 'block', size: 0.8, at: p(3.6, -3), label: 'get by key', sub: 'fast', icon: 'Key', tint: 'green', status: 'ok' },
          { id: 'slow', kind: 'block', size: 0.8, at: p(3.6, 3), label: 'range or search', sub: 'not offered', icon: 'Search', tint: 'red', status: 'dim' },
        ],
        links: [link('record', 'fast'), link('record', 'slow', { style: 'dashed' })],
        flows: [{ path: ['record', 'fast'], tone: 'response', label: 'cart:42', duration: 1.4 }],
        panel: {
          title: 'One record',
          icon: 'FileJson',
          code: 'key:     cart:42\nvalue:   [bytes, ~1 KB]\nvector:  {B:3, C:2}\nexpires: 2026-12-01',
          footer: { text: 'No index on the value', tone: 'muted' },
        },
        caption: 'Exact-key lookups only',
      },
    },
    {
      title: 'One box',
      tag: 'case',
      heading: 'One big server, and the three ways it breaks',
      eli5: 'One helper with one notebook is easy. But the notebook is too small, one helper cannot write fast enough, and if she goes home sick, nobody can read anything. That helper is a **single point of failure**.',
      body: [
        'The simplest store is a hash map on one machine: keys in RAM, a log on disk for restarts. For a prototype it is perfect, and lookups take microseconds.',
        'At our numbers it fails three ways. **Size**: 10 TB does not fit in the 512 GB of RAM a large server carries. **Throughput**: one node from disk handles about 30K ops/s, and we need 500K. **Failure**: when it reboots, every cart is unreachable.',
      ],
      keyIdea: 'One machine runs out of memory, throughput and luck at the same time.',
      metrics: { nodes: '1', ops: '30K/s max', data: '10 TB on 1 box', p99: '900 ms', quorum: '1 copy' },
      metricTones: { nodes: 'bad', ops: 'bad', data: 'bad', p99: 'bad', quorum: 'bad' },
      scene: {
        nodes: [
          { ...client, status: 'hot', badge: 'timeouts' },
          { ...store, label: 'one big server', sub: '512 GB RAM', status: 'hot', load: 100, chips: [{ text: '500K ops/s asked', tone: 'bad' }, { text: '30K ops/s served', tone: 'warn' }] },
        ],
        links: [link('client', 'store', { label: '500K ops/s', labelTone: 'warn' })],
        flows: [
          { path: ['client', 'store'], tone: 'request', count: 6, duration: 1 },
          { path: ['store', 'client'], tone: 'error', label: 'timeout', duration: 1.4, delay: 1.2 },
        ],
        panel: {
          title: 'Three limits',
          icon: 'Gauge',
          rows: [
            { text: 'Size: 10 TB vs 512 GB RAM', value: 'fails', tone: 'bad' },
            { text: 'Throughput: 500K vs 30K', value: 'fails', tone: 'bad' },
            { text: 'Reboot', value: 'all carts down', tone: 'bad' },
          ],
        },
        caption: 'Too big, too slow, and the only copy',
      },
    },
    {
      title: 'Bigger box',
      tag: 'tradeoff',
      heading: 'Why a bigger box only delays the problem',
      eli5: 'A bigger notebook and a faster pen help for a month. Then there are more names again, and still only one helper who can get sick.',
      body: [
        'Compression and keeping only hot keys in RAM buy some room. Neither fixes throughput, and neither fixes the **single point of failure**.',
        'Scaling up gets costly fast: a machine twice as big costs more than twice as much, and there is a ceiling. The data has to be split across machines, and then copied.',
      ],
      keyIdea: 'Vertical scaling postpones the limit. Splitting the keys and copying them removes it.',
      metrics: { nodes: '1', ops: '60K/s max', data: '10 TB on 1 box', p99: '300 ms', quorum: '1 copy' },
      metricTones: { nodes: 'bad', ops: 'warn', p99: 'warn', quorum: 'bad' },
      scene: {
        nodes: [
          { id: 'small', kind: 'db', size: 0.8, at: p(-4, 0), label: 'one server', sub: '30K ops/s', status: 'hot', load: 100 },
          { id: 'huge', kind: 'db', size: 1.3, at: p(4, 0), label: 'bigger server', sub: '60K ops/s, 3x the cost', status: 'hot', load: 95 },
          { id: 'target', kind: 'block', at: p(0, 5.5), label: '500K ops/s', sub: 'what we need', icon: 'Zap', tint: 'amber' },
        ],
        links: [link('small', 'target', { style: 'dashed', label: 'short by 470K', labelTone: 'warn' }), link('huge', 'target', { style: 'dashed', label: 'short by 440K', labelTone: 'warn' })],
        flows: [],
        panel: {
          title: 'Scale up',
          icon: 'TrendingUp',
          rows: [
            { text: 'Compress values', value: '+30% room' },
            { text: 'Hot keys in RAM', value: 'faster reads' },
            { text: 'Throughput gap', value: 'still 8x', tone: 'bad' },
            { text: 'Single point of failure', value: 'still there', tone: 'bad' },
          ],
        },
        caption: 'Scale out instead',
      },
    },
    {
      title: 'Hash ring',
      tag: 'concept',
      heading: 'Spread the keys around a hash ring',
      eli5: 'The helpers sit in a big circle. Each name gets a spot on the circle, and the first helper sitting clockwise from that spot keeps its page. That circle is the **ring**.',
      body: [
        'Use the ring from the consistent hashing lesson. Hash each key to a position, and the first node clockwise owns it. `cart:42` lands just before node B, so B owns it.',
        'Twenty nodes at about 25K ops/s and 500 GB each cover the load, and adding a node later moves only one arc of keys.',
      ],
      keyIdea: 'Consistent hashing splits 10 TB across equal peers, and growing the cluster moves only a small slice of keys.',
      metrics: { nodes: '20', ops: '500K/s', data: '500 GB per node', p99: '4 ms', quorum: '1 copy' },
      metricTones: { p99: 'good' },
      scene: {
        nodes: [A, { ...B, status: 'active', badge: 'owns cart:42', chips: [{ text: 'cart:42', tone: 'good' }] }, C, D, F],
        links: [link('A', 'B', { style: 'faint' }), link('B', 'C', { style: 'faint' }), link('C', 'D', { style: 'faint' }), link('F', 'A', { style: 'faint' })],
        flows: [{ path: ['A', 'B'], tone: 'request', label: 'hash(cart:42) lands here', duration: 1.6 }],
        panel: {
          title: 'Ring positions',
          icon: 'Hash',
          rows: [
            { text: 'hash(cart:42)', value: '0x6f..', tone: 'good' },
            { text: 'next node clockwise', value: 'B', tone: 'good' },
            { text: 'nodes shown', value: '5 of 20', tone: 'muted' },
          ],
          footer: { text: 'Add a node: one arc moves', tone: 'muted' },
        },
        caption: '5 of 20 nodes shown',
      },
    },
    {
      title: 'Virtual nodes',
      tag: 'concept',
      heading: 'Give each machine many tokens',
      eli5: 'If every helper held just one big slice of the circle, one unlucky helper might get most of the pages. So each helper takes many small slices spread around the circle. Those slices are **virtual nodes**.',
      body: [
        'Give each physical node many **virtual nodes**, say 256 tokens. Load evens out, and a bigger machine can take more tokens than a small one.',
        'When a node dies, its arcs scatter across many neighbors instead of landing on one. A new node takes small slices from many nodes, so all of them share the streaming work.',
      ],
      keyIdea: 'Many tokens per machine smooth the load, weight big machines, and spread the work when a node leaves or joins.',
      metrics: { nodes: '20', ops: '500K/s', data: '500 GB per node', p99: '4 ms', quorum: '1 copy' },
      metricTones: { p99: 'good' },
      scene: {
        nodes: [
          { id: 'one', kind: 'shard', at: p(-4, -3), label: '1 token each', sub: 'uneven arcs', status: 'hot', load: 92 },
          { id: 'many', kind: 'shard', at: p(4, -3), label: '256 tokens each', sub: 'even load', status: 'ok', load: 50 },
          { id: 'big', kind: 'block', at: p(0, 4), label: 'big machine', sub: '512 tokens', icon: 'Server', tint: 'violet' },
        ],
        links: [link('one', 'big', { style: 'faint' }), link('many', 'big', { style: 'faint' })],
        flows: [{ path: ['many', 'big'], tone: 'data', label: 'more tokens', duration: 1.5 }],
        panel: {
          title: 'Token count',
          icon: 'Layers',
          rows: [
            { text: 'Load spread with 1 token', value: '2x to 3x skew', tone: 'bad' },
            { text: 'Load spread with 256', value: 'within 10%', tone: 'good' },
            { text: 'Node dies', value: 'arcs scatter', tone: 'good' },
            { text: 'Machine twice as big', value: '2x tokens' },
          ],
        },
        caption: 'Tokens are how the ring stays fair',
      },
      quiz: {
        question: 'A new storage machine has twice the disk and CPU of the others. How do you make it carry twice the load on a ring with virtual nodes?',
        options: ['Give it twice as many tokens', 'Give it a single token', 'Raise W for its keys', 'Put it in its own region'],
        answer: 0,
        explain: 'Each token owns one arc of the ring. Twice the tokens means about twice the keys, with no change to the algorithm.',
      },
    },
    {
      title: 'Coordinator',
      tag: 'concept',
      heading: 'No leader: whoever gets the request coordinates',
      eli5: 'A family asks any helper at the door. That helper looks at the circle and passes the request to the page\'s owner, who takes charge. A family that keeps a copy of the circle can walk straight to the owner.',
      body: [
        'There is no leader. A client sends a request to any node. That node hashes the key and **forwards** it to a node that holds a copy of the key, and that node acts as the **coordinator**. Gossip gives every node the ring, so any node can route.',
        'A client that keeps a copy of the ring skips the forwarding hop. A plain client pays one extra hop. Only nodes that hold the key coordinate, which keeps version vectors small in part 2.',
      ],
      keyIdea: 'Every node can route, so there is no leader to bottleneck or lose. The coordinator is a node that holds the key.',
      metrics: { nodes: '20', ops: '500K/s', data: '500 GB per node', p99: '4 ms', quorum: '1 copy' },
      metricTones: { p99: 'good' },
      scene: {
        nodes: [
          { ...client, chips: ['put cart:42'] },
          { id: 'map', kind: 'block', size: 0.8, at: p(-7.5, 7), label: 'ring map', sub: 'smart client', icon: 'Route', tint: 'violet' },
          { ...F, status: 'active', badge: 'receives, forwards' },
          { ...B, status: 'ok', badge: 'coordinator' },
        ],
        links: [link('client', 'F', { label: 'any node' }), link('F', 'B', { label: 'forward' }), link('client', 'map', { style: 'faint' })],
        flows: [
          { path: ['client', 'F'], tone: 'request', label: 'put cart:42', duration: 1 },
          { path: ['F', 'B'], tone: 'request', label: 'forward', duration: 1.2, delay: 1.1 },
          { path: ['B', 'F', 'client'], tone: 'response', label: 'ok', duration: 1.6, delay: 2.5 },
        ],
        panel: {
          title: 'Routing options',
          icon: 'Route',
          rows: [
            { text: 'Any node receives, owner coordinates', value: '+1 hop' },
            { text: 'Client holds ring map', value: '0 extra hops', tone: 'good' },
            { text: 'Stale ring map', value: 'owner re-routes', tone: 'warn' },
          { text: 'Coordinator', value: 'a node holding the key' },
          ],
        },
        caption: 'The first node to hear it routes it',
      },
    },
    {
      title: 'Replicate',
      tag: 'concept',
      heading: 'Keep N = 3 copies on the next nodes clockwise',
      eli5: 'A page written by only one helper is lost if she gets sick. So the owner and the next two helpers clockwise each write it down. Those three helpers are the page\'s **preference list**.',
      body: [
        'One copy dies with its disk. Walk clockwise from the key and store it on the first **N = 3** distinct machines: B, C and D for `cart:42`. That list is the key\'s **preference list**. With virtual nodes, the walk skips tokens owned by a machine already on the list.',
        'The owner B coordinates, and C or D could as well. Every write lands three times: 200K writes/s become 600K replica writes/s, and 30 TB at 500 GB a node needs **60 nodes**.',
      ],
      keyIdea: 'Each key lives on the next N distinct machines clockwise, so no single failure takes its only copy.',
      metrics: { nodes: '60', ops: '500K/s', data: '30 TB (3 copies)', p99: '4 ms', quorum: 'N = 3' },
      metricTones: { quorum: 'good' },
      scene: {
        nodes: [
          { ...B, badge: 'coordinator, copy 1', status: 'active' },
          { ...C, status: 'ok', badge: 'copy 2' },
          { ...D, status: 'ok', badge: 'copy 3' },
          A,
        ],
        links: [link('B', 'C'), link('B', 'D'), link('A', 'B', { style: 'faint' })],
        flows: [
          { path: ['B', 'C'], tone: 'data', label: 'write', duration: 1.3 },
          { path: ['B', 'D'], tone: 'data', duration: 1.3 },
        ],
        panel: {
          title: 'Preference list for cart:42',
          icon: 'Copy',
          rows: [
            { text: '1st clockwise', value: 'B', tone: 'good' },
            { text: '2nd distinct machine', value: 'C', tone: 'good' },
            { text: '3rd distinct machine', value: 'D', tone: 'good' },
            { text: 'Replica writes', value: '600K/s' },
          ],
        },
        caption: 'Preference list: B, C, D',
      },
      code: {
        language: 'python',
        title: 'Walk the ring to build a preference list',
        source: `import bisect, hashlib

def h(s): return int(hashlib.md5(s.encode()).hexdigest(), 16)

tokens = sorted((h(f"{n}#{i}"), n) for n in nodes for i in range(256))
points = [t for t, _ in tokens]

def preference_list(key, n=3):
    i = bisect.bisect(points, h(key)) % len(tokens)
    out = []
    while len(out) < n:
        node = tokens[i % len(tokens)][1]
        if node not in out:          # skip tokens of a machine already chosen
            out.append(node)
        i += 1
    return out`,
        highlight: [5, 9, 13, 14],
      },
    },
    {
      title: 'Zones',
      tag: 'concept',
      heading: 'Spread the copies across failure domains',
      eli5: 'If all three helpers share one room and the lights go out, nobody can read the page. So the three helpers sit in three different rooms.',
      body: [
        'Put the copies in different failure domains. If B, C and D sit in three availability zones, a whole zone can go dark and two copies survive. The preference list skips nodes in a zone it already used.',
        'Copies in another region also survive a datacenter outage. The cost is cross-region latency on any write that waits for them, so a common pattern is W = 2 inside the home region and asynchronous copies to the other one.',
      ],
      keyIdea: 'Copies only help if they fail independently. Spread them across racks, zones and regions.',
      metrics: { nodes: '60', ops: '500K/s', data: '30 TB (3 copies)', p99: '4 ms', quorum: 'N = 3' },
      metricTones: { quorum: 'good' },
      scene: {
        nodes: [
          { ...B, at: p(3.4, -4.5), status: 'active', sub: 'zone 1', badge: 'coordinator, copy 1' },
          { ...C, at: p(3.4, 4.5), status: 'ok', sub: 'zone 2', badge: 'copy 2' },
          { ...D, status: 'down', sub: 'zone 3', badge: 'zone dark' },
        ],
        links: [link('B', 'C'), link('B', 'D', { style: 'dashed', label: 'zone down', labelTone: 'warn' })],
        flows: [
          { path: ['B', 'C'], tone: 'data', duration: 1.3 },
          { path: ['B', 'D'], tone: 'error', duration: 1.3 },
        ],
        panel: {
          title: 'One zone lost',
          icon: 'Shield',
          rows: [
            { text: 'Copies left', value: '2 of 3', tone: 'good' },
            { text: 'Reads and writes', value: 'still serve', tone: 'good' },
            { text: 'All 3 in one zone', value: 'data offline', tone: 'bad' },
            { text: 'Region outage', value: 'needs 2nd region', tone: 'warn' },
          ],
        },
        caption: 'Zone 3 goes dark, two copies stay up',
      },
    },
    {
      title: 'Quorums',
      tag: 'concept',
      heading: 'Write to 3, wait for W, read from R',
      eli5: 'The writer waits until two of the three helpers say "written!", and a reader asks two helpers and keeps the newest page. Two plus two is more than three, so they always share a helper. That rule is a **quorum**.',
      body: [
        'The coordinator, itself one of the 3 replicas, sends each write to the others and replies once **W** have acknowledged, counting its own. A read asks **R** replicas and returns the newest version. With **N = 3, R = 2, W = 2**, R + W > N, so every read overlaps the latest write on at least one node.',
        'Since the coordinator waits only for the fastest two of three, one slow replica does not hold up the reply.',
      ],
      keyIdea: 'If R + W > N, a read always meets at least one replica holding the latest acknowledged write.',
      metrics: { nodes: '60', ops: '500K/s', data: '30 TB (3 copies)', p99: '6 ms', quorum: 'N=3 R=2 W=2' },
      metricTones: { quorum: 'good' },
      scene: {
        nodes: [
          { ...B, status: 'active', badge: 'coordinator, waits for 2' },
          { ...C, status: 'ok', badge: 'ack' },
          { ...D, status: 'hot', badge: 'slow, 40 ms', load: 88 },
          F,
          client,
        ],
        links: [link('client', 'F'), link('F', 'B', { label: 'forward' }), link('B', 'C'), link('B', 'D', { label: '40 ms', labelTone: 'warn' })],
        flows: [
          { path: ['client', 'F', 'B'], tone: 'request', label: 'put W=2', duration: 1.6 },
          { path: ['B', 'C'], tone: 'request', duration: 1.2, delay: 1.7 },
          { path: ['B', 'D'], tone: 'request', duration: 3, delay: 1.7 },
          { path: ['C', 'B'], tone: 'response', label: 'ack', duration: 1.2, delay: 3 },
          { path: ['B', 'F', 'client'], tone: 'response', label: 'ok after 2', duration: 1.6, delay: 4.3 },
        ],
        panel: {
          title: 'N = 3, R = 2, W = 2',
          icon: 'Scale',
          rows: [
            { text: 'Write needs', value: '2 acks of 3' },
            { text: 'Read needs', value: '2 answers of 3' },
            { text: 'R + W', value: '4 > 3', tone: 'good' },
            { text: 'Read overlaps latest write', value: 'always', tone: 'good' },
          ],
        },
        caption: 'The reply goes out after the fastest two acks',
      },
      code: {
        language: 'python',
        title: 'Coordinator: write to N, return after W acks',
        source: `async def put(key, ctx, value, w=2):
    replicas = ring.preference_list(key, n=3)
    if self.node_id not in replicas:
        return await forward(replicas[0], "put", key, ctx, value)
    version = ctx.next(coordinator=self.node_id)   # only nodes holding the key bump a counter
    calls = [send_write(r, key, version, value) for r in replicas]
    acks = 0
    for done in asyncio.as_completed(calls, timeout=0.05):
        try:
            await done
            acks += 1
        except (TimeoutError, NodeDown):
            continue
        if acks >= w:
            return version          # the slower copies keep going in the background
    raise QuorumFailed(f"{acks}/{w} acks for {key}")`,
        highlight: [3, 4, 5, 15],
      },
      quiz: {
        question: 'N = 3 and W = 2. One of the three replicas for a key is down. What happens to writes for that key?',
        options: [
          'They fail until the node comes back',
          'They succeed with acks from the two healthy replicas',
          'They succeed only if R is raised to 3',
          'They wait in a queue on the client',
        ],
        answer: 1,
        explain: 'W = 2 needs two acks out of three, and two replicas are healthy. What is lost is the third copy of each new write, which hinted handoff in part 2 deals with.',
      },
    },
    {
      title: 'Tuning',
      tag: 'tradeoff',
      heading: 'Tune R and W per request',
      eli5: 'Some notes matter a lot and some matter little. For a note nobody will miss, one helper saying "written" is enough. For an important one, wait for more helpers.',
      body: [
        'The knobs can change per request. A session store can use W = 1 for speed and accept a rare stale read. A read-heavy catalog can use R = 1 and W = 3, so reads are fast and writes pay.',
        'W = 3 blocks when any replica is down. R = 1 with W = 1 is fastest and can return stale data. The default R = W = 2 balances both.',
      ],
      keyIdea: 'R and W trade latency, freshness and availability per request. Pick them per use case.',
      metrics: { nodes: '60', ops: '500K/s', data: '30 TB (3 copies)', p99: '6 ms', quorum: 'tunable' },
      metricTones: { quorum: 'good' },
      scene: {
        nodes: [
          { id: 'fast', kind: 'block', size: 0.85, at: p(-4.5, -3), label: 'R=1, W=1', sub: 'sessions', icon: 'Zap', tint: 'amber' },
          { id: 'mid', kind: 'block', size: 0.85, at: p(0, 3), label: 'R=2, W=2', sub: 'carts', icon: 'Scale', tint: 'blue' },
          { id: 'safe', kind: 'block', size: 0.85, at: p(4.5, -3), label: 'R=1, W=3', sub: 'catalog', icon: 'Shield', tint: 'green' },
        ],
        links: [link('fast', 'mid', { style: 'faint' }), link('mid', 'safe', { style: 'faint' })],
        flows: [],
        panel: {
          title: 'Settings compared',
          icon: 'Table',
          rows: [
            { text: 'R=1, W=1 (R+W = 2)', value: 'fast, can be stale', tone: 'warn' },
            { text: 'R=2, W=2 (R+W = 4)', value: 'fresh, 1 node may be down', tone: 'good' },
            { text: 'R=1, W=3 (R+W = 4)', value: 'fast reads, writes need all 3', tone: 'warn' },
          ],
        },
        caption: 'Three settings, three personalities',
      },
    },
    {
      title: 'Resize',
      tag: 'tradeoff',
      heading: 'Quorum reads cost more nodes, and we want headroom',
      eli5: 'Asking two helpers for every read keeps them busier. And helpers who are always at full speed have no time to tidy up, so the shop hires a few more.',
      body: [
        'With R = 2, every read touches two copies: 600K replica reads plus 600K replica writes per second. Over 60 nodes that is 20K ops/s each, 67% of the 30K a node can do.',
        'That leaves no room for compaction, hint replay, repair streaming or a dead neighbor. Size to about 55% busy instead: **70 nodes**, about 17K ops/s and 430 GB each.',
      ],
      keyIdea: 'Never size to the stated maximum. Leave room for background work and failures.',
      metrics: { nodes: '70', ops: '500K/s', data: '430 GB per node', p99: '6 ms', quorum: 'N=3 R=2 W=2' },
      metricTones: { nodes: 'good', quorum: 'good' },
      scene: {
        nodes: [
          { id: 'rw', kind: 'block', at: p(-3.6, 0), label: '600K writes/s', sub: 'N = 3 copies', icon: 'Database', tint: 'blue' },
          { id: 'rr', kind: 'block', at: p(3.6, 0), label: '600K reads/s', sub: 'R = 2 copies', icon: 'Search', tint: 'amber' },
          { id: 'fleet70', kind: 'block', at: p(0, 5), label: '70 nodes', sub: '17K ops/s, 430 GB each', icon: 'Server', tint: 'green', status: 'ok' },
        ],
        links: [link('rw', 'fleet70'), link('rr', 'fleet70')],
        flows: [
          { path: ['rw', 'fleet70'], tone: 'data', duration: 1.4 },
          { path: ['rr', 'fleet70'], tone: 'data', duration: 1.4, delay: 0.4 },
        ],
        panel: {
          title: 'Sizing with headroom',
          icon: 'Table',
          rows: [
            { text: 'Replica ops', value: '1.2M/s' },
            { text: '60 nodes', value: '20K each, 67%', tone: 'warn' },
            { text: '70 nodes', value: '17K each, 57%', tone: 'good' },
            { text: 'Disk at 70 nodes', value: '430 GB each' },
          ],
          footer: { text: 'Headroom pays for compaction, repair and a dead node', tone: 'muted' },
        },
        caption: 'Run at about half speed on purpose',
      },
    },
    {
      title: 'Read repair',
      tag: 'concept',
      heading: 'Reads fix stale copies as they go',
      eli5: 'When a reader asks two helpers and one has an older page, the reader copies the new page back to that helper right then. That is **read repair**.',
      body: [
        'When the two read answers differ, the coordinator compares their version vectors. `{B:3, C:2}` is ahead of `{B:2, C:2}` in every slot, so it is the newer one. The coordinator returns it and writes it back to the stale replica in the background.',
        'That is **read repair**. Hot keys heal quickly. Cold keys wait for the repair jobs in part 2.',
      ],
      keyIdea: 'Every read is a free chance to heal a stale replica, but only for keys that are actually read.',
      metrics: { nodes: '70', ops: '500K/s', data: '430 GB per node', p99: '6 ms', quorum: 'N=3 R=2 W=2' },
      metricTones: { quorum: 'good' },
      scene: {
        nodes: [
          F,
          { ...B, status: 'active', badge: 'coordinator', chips: [{ text: '{B:3,C:2}', tone: 'good' }] },
          { ...C, status: 'hot', chips: [{ text: '{B:2,C:2}', tone: 'warn' }] },
          client,
        ],
        links: [link('client', 'F'), link('F', 'B'), link('B', 'C')],
        flows: [
          { path: ['client', 'F', 'B'], tone: 'request', label: 'get R=2', duration: 1.6 },
          { path: ['B', 'C'], tone: 'request', duration: 1.2, delay: 1.7 },
          { path: ['B', 'F', 'client'], tone: 'response', label: '{B:3,C:2}', duration: 1.6, delay: 3.1 },
          { path: ['B', 'C'], tone: 'data', label: 'repair', duration: 1.2, delay: 4.8 },
        ],
        panel: {
          title: 'Read repair',
          icon: 'Repeat',
          rows: [
            { text: 'B holds {B:3,C:2}', value: 'newer', tone: 'good' },
            { text: 'C holds {B:2,C:2}', value: 'stale', tone: 'warn' },
            { text: 'Client gets', value: 'the newer one', tone: 'good' },
            { text: 'Background write to C', value: 'repairs it' },
          ],
        },
        caption: 'Stale replica C gets the newer version on the way out',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Part 1: a ring of copies with tunable quorums',
      eli5: 'The helpers sit in a circle with many seats each, every page is written by three of them in three rooms, and readers and writers agree on how many to ask. That circle is the **key-value store**.',
      body: [
        'We chose availability (**AP**) and sized for 500K ops/s and 10 TB. A **hash ring** with virtual nodes splits keys, any node can **coordinate**, **N = 3** copies across zones protect them, and **R = 2, W = 2** keep reads fresh while ignoring one slow replica. Seventy nodes at about 430 GB each carry the load with room to spare.',
        'Part 2 covers conflicting writes, what each node does on disk, how the cluster detects and repairs failures, and how it rebalances and handles hot keys.',
      ],
      keyIdea: 'Ring, copies, quorums. Part 2 handles conflicts, storage and failure repair.',
      metrics: { nodes: '70', ops: '500K/s', data: '30 TB (3 copies)', p99: '6 ms', quorum: 'N=3 R=2 W=2' },
      metricTones: { nodes: 'good', p99: 'good', quorum: 'good' },
      scene: {
        nodes: [client, { ...F, status: 'ok', badge: 'forwards' }, { ...B, status: 'ok', badge: 'coordinator' }, { ...C, status: 'ok' }, { ...D, status: 'ok' }],
        links: [link('client', 'F'), link('F', 'B'), link('B', 'C'), link('B', 'D')],
        flows: [
          { path: ['client', 'F', 'B'], tone: 'request', label: 'put', duration: 1.6 },
          { path: ['B', 'C'], tone: 'data', duration: 1.3, delay: 1.7 },
          { path: ['B', 'D'], tone: 'data', duration: 1.3, delay: 1.7 },
        ],
        panel: {
          title: 'Part 1 design',
          icon: 'List',
          rows: [
            { text: 'Stance', value: 'AP' },
            { text: 'Placement', value: 'ring, 256 tokens' },
            { text: 'Copies', value: 'N = 3, 3 zones' },
            { text: 'Quorum', value: 'R = 2, W = 2' },
            { text: 'Fleet', value: '70 nodes, 57% busy' },
          ],
        },
      },
      quiz: {
        question: 'With N = 3, which setting guarantees a read sees the latest acknowledged write and still allows one replica to be down?',
        options: ['R = 1, W = 1', 'R = 2, W = 2', 'R = 1, W = 3', 'R = 3, W = 1'],
        answer: 1,
        explain: 'R = 2 and W = 2 give R + W = 4 > 3, and each needs only two of three nodes. R = 1, W = 3 also overlaps but cannot write with a node down, and R = 3, W = 1 cannot read with one down.',
      },
    },
  ],
};
