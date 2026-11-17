import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place a node by screen column (sx) and screen row (sy). Same sy = one horizontal row on screen. */
const p = (sx: number, sy: number): [number, number] => [(sy + sx) / 2, (sy - sx) / 2];

// Callers.
const client: SceneNode = { id: 'client', kind: 'client', at: p(-7.5, 0), label: 'cart service' };
const phone: SceneNode = { id: 'phone', kind: 'phone', at: p(-6.2, -5.6), label: 'shopper phone' };

// The early single-box designs.
const store: SceneNode = { id: 'store', kind: 'db', at: p(0, 0), label: 'KV store', sub: 'get / put' };

// Six of the storage nodes, drawn as a ring. Clockwise on screen: A (top), B, C, D (bottom), E, F.
const A: SceneNode = { id: 'A', kind: 'shard', at: p(0, -6), label: 'node A' };
const B: SceneNode = { id: 'B', kind: 'shard', at: p(3.4, -3), label: 'node B' };
const C: SceneNode = { id: 'C', kind: 'shard', at: p(3.4, 3), label: 'node C' };
const D: SceneNode = { id: 'D', kind: 'shard', at: p(0, 6), label: 'node D' };
const E: SceneNode = { id: 'E', kind: 'shard', at: p(-3.4, 3), label: 'node E' };
const F: SceneNode = { id: 'F', kind: 'shard', at: p(-3.4, -3), label: 'node F' };
const key: SceneNode = { id: 'key', kind: 'ring', at: p(1.7, -4.5), label: 'cart:42' };

// Inside one node: the LSM write and read path.
const coord: SceneNode = { id: 'coord', kind: 'server', at: p(-7, 0), label: 'coordinator' };
const log: SceneNode = { id: 'log', kind: 'queue', at: p(-3.5, -3.5), label: 'commit log', sub: 'append only' };
const mem: SceneNode = { id: 'mem', kind: 'cache', at: p(-3.5, 3), label: 'memtable', sub: 'sorted, in RAM' };
const bloom: SceneNode = { id: 'bloom', kind: 'limiter', at: p(0.5, 3), label: 'bloom filters' };
const sst1: SceneNode = { id: 'sst1', kind: 'storage', at: p(1, -3.5), label: 'SSTable 1', sub: 'newest' };
const sst2: SceneNode = { id: 'sst2', kind: 'storage', at: p(4.5, 3), label: 'SSTable 2' };
const sst3: SceneNode = { id: 'sst3', kind: 'storage', at: p(5, -3.5), label: 'SSTable 3', sub: 'oldest' };

const ring = [A, B, C, D, E, F];
const ringLinks: SceneLink[] = [
  { from: 'A', to: 'B', style: 'faint' },
  { from: 'B', to: 'C', style: 'faint' },
  { from: 'C', to: 'D', style: 'faint' },
  { from: 'D', to: 'E', style: 'faint' },
  { from: 'E', to: 'F', style: 'faint' },
  { from: 'F', to: 'A', style: 'faint' },
];

export const designKeyValueStore: Lesson = {
  id: 'design-key-value-store',
  title: 'Design a key-value store',
  tagline: 'Build a Dynamo-style store for 10 billion keys that keeps taking writes while machines fail.',
  minutes: 20,
  level: 'Advanced',
  learn: [
    'Requirements and scale numbers for an always-writable store',
    'Partitioning on a hash ring and replicating to N nodes',
    'Tuning R and W per request, and what R + W > N buys',
    'Detecting and keeping conflicting writes with version vectors',
    'The per-node write and read path: commit log, memtable, SSTables',
    'Gossip membership, hinted handoff and Merkle tree repair',
  ],
  metrics: [
    { key: 'nodes', label: 'Nodes' },
    { key: 'ops', label: 'Peak ops' },
    { key: 'data', label: 'Data' },
    { key: 'p99', label: 'p99 latency' },
    { key: 'quorum', label: 'Quorum' },
  ],
  steps: [
    {
      title: 'Requirements',
      tag: 'problem',
      heading: 'A cart store that never refuses a write',
      eli5: 'The shop needs a giant notebook where any name can be looked up and written down. The **key-value store** is that notebook, and it must take new notes even on a day when some of its helpers are sick.',
      body: [
        'The shop keeps carts, sessions and user settings in one internal **key-value store**. The API is two calls, `get(key)` and `put(key, value)`. Values are small blobs under 10 KB, about 1 KB on average, and the store never looks inside them.',
        'Scale: **10 billion keys**, about **10 TB** of data. Peak traffic is **300K reads/s and 200K writes/s**. The target is a p99 under **10 ms**, and the store must keep taking writes when machines or links fail. A shopper who cannot add to a cart is a lost sale.',
        'That last line decides the design. In the terms of the CAP and PACELC lesson this is an **AP** system: during a partition it stays available and lets copies disagree for a while. Consistency becomes a knob, and conflicts become something the design has to handle.',
      ],
      keyIdea: 'Write the numbers and the failure stance first: 500K ops/s, 10 TB, p99 under 10 ms, and writes that keep working during failures.',
      metrics: { nodes: '?', ops: '500K/s', data: '10 TB', p99: '< 10 ms target', quorum: '-' },
      scene: {
        nodes: [client, { ...store, sub: '10B keys?', badge: '500K ops/s' }],
        links: [{ from: 'client', to: 'store' }],
        flows: [
          { path: ['client', 'store'], tone: 'request', label: 'put cart:42', count: 3, duration: 1.2 },
          { path: ['client', 'store'], tone: 'request', label: 'get cart:42', count: 3, duration: 1.2, delay: 0.6 },
        ],
        caption: '300K reads/s and 200K writes/s at peak',
      },
    },
    {
      title: 'API and data',
      tag: 'concept',
      heading: 'Two calls, plus a version you hand back',
      eli5: 'When you read a page, the helper also gives you a little stamp. When you write the page again, you hand the stamp back, so the helper knows which page you started from. The stamp is the **context**.',
      body: [
        '`get(key)` returns the value and an opaque **context**: the version information the store keeps for that key. `put(key, context, value)` sends the context back, so the store knows which version this write was based on. Callers never edit the context.',
        'Usually `get` returns one value. After concurrent writes it can return two or more **siblings** with one merged context, and the caller decides how to combine them. That is the price of never refusing a write.',
        'The data model is flat: a key, the value bytes, a version vector, and an optional expiry time. There are no secondary indexes and no queries across keys. Keys are hashed for placement, so range scans are off the table too.',
      ],
      keyIdea: 'Every read hands out a version, every write hands it back. That is how the store tells an update from a conflict.',
      metrics: { nodes: '?', ops: '500K/s', data: '10 TB', p99: '< 10 ms target', quorum: '-' },
      scene: {
        nodes: [client, { ...store, status: 'active' }],
        links: [{ from: 'client', to: 'store' }],
        flows: [
          { path: ['client', 'store'], tone: 'request', label: 'get cart:42', duration: 1.1 },
          { path: ['store', 'client'], tone: 'response', label: 'values + ctx', duration: 1.1, delay: 1.2 },
          { path: ['client', 'store'], tone: 'request', label: 'put(ctx, value)', duration: 1.1, delay: 2.6 },
        ],
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
      title: 'One box',
      tag: 'case',
      heading: 'One big server, and the three ways it breaks',
      eli5: 'One helper with one notebook is easy. But the notebook is too small for all the names, one helper cannot write fast enough, and if she goes home sick, nobody can read anything. That helper is a **single point of failure**.',
      body: [
        'The simplest store is a hash map on one machine: keys in RAM, a log on disk for restarts. For a prototype it is perfect, and lookups take microseconds.',
        'At our numbers it fails in three ways. **Size**: 10 TB does not fit in the 512 GB of RAM a large server carries. **Throughput**: one node serving from disk handles about 30K ops/s, and we need 500K. **Failure**: when it reboots, every cart in the shop is unreachable until it returns.',
        'Compression and keeping only hot keys in RAM buy a little room. Neither fixes throughput or the **single point of failure**. The data has to be split across machines, and then copied.',
      ],
      keyIdea: 'One machine runs out of memory, throughput and luck at the same time. Split the keys, then copy them.',
      metrics: { nodes: '1', ops: '30K/s max', data: '10 TB on 1 box', p99: '900 ms', quorum: '1 copy' },
      scene: {
        nodes: [{ ...client, status: 'hot', badge: 'timeouts' }, { ...store, label: 'one big server', sub: '512 GB RAM', status: 'hot', badge: '100% CPU' }],
        links: [{ from: 'client', to: 'store' }],
        flows: [
          { path: ['client', 'store'], tone: 'request', count: 6, duration: 1 },
          { path: ['store', 'client'], tone: 'error', label: 'timeout', duration: 1.4, delay: 1.2 },
        ],
        caption: 'Too big, too slow, and the only copy',
      },
    },
    {
      title: 'Partition',
      tag: 'concept',
      heading: 'Spread the keys around a hash ring',
      eli5: 'The helpers sit in a big circle. Each name gets a spot on the circle, and the first helper sitting clockwise from that spot keeps its page. That circle is the **ring**.',
      body: [
        'Use the ring from the consistent hashing lesson. Hash each key to a position, and the first node clockwise owns it. `cart:42` lands just before node B, so B owns it. Twenty nodes at about 25K ops/s and 500 GB each cover the load with some headroom, and adding a node later moves only one arc of keys.',
        'Give each physical node many **virtual nodes**, say 256 tokens. Load evens out, and a bigger machine can take more tokens than a small one. When a node dies, its arcs scatter across many neighbors instead of landing on one.',
        'There is no leader. The node that receives a request acts as the **coordinator**: it hashes the key, finds the owner and forwards. A client that keeps a copy of the ring can go straight to the owner and save a hop.',
      ],
      keyIdea: 'Consistent hashing splits 10 TB across equal peers, and growing the cluster moves only a small slice of keys.',
      metrics: { nodes: '20', ops: '500K/s', data: '500 GB per node', p99: '4 ms', quorum: '1 copy' },
      scene: {
        nodes: [client, ...ring.map((n) => (n.id === 'B' ? { ...n, status: 'active' as const, badge: 'owns cart:42' } : n.id === 'F' ? { ...n, badge: 'coordinator' } : n)), key],
        links: [...ringLinks, { from: 'client', to: 'F' }],
        flows: [
          { path: ['client', 'F'], tone: 'request', label: 'put cart:42', duration: 1 },
          { path: ['F', 'B'], tone: 'request', label: 'forward', duration: 1.2, delay: 1.1 },
          { path: ['B', 'F', 'client'], tone: 'response', label: 'ok', duration: 1.6, delay: 2.5 },
        ],
        caption: '6 of 20 nodes shown',
      },
    },
    {
      title: 'Replicate',
      tag: 'concept',
      heading: 'Keep N = 3 copies on the next nodes clockwise',
      eli5: 'A page written by only one helper is lost if she gets sick. So the owner and the next two helpers clockwise each write it down. Those three helpers are the page\'s **preference list**.',
      body: [
        'One copy dies with its disk. Walk clockwise from the key and store it on the first **N = 3** distinct machines: B, C and D for `cart:42`. That list is the key\'s **preference list**. With virtual nodes, the walk skips tokens owned by a machine already on the list.',
        'Put the copies in different failure domains. If B, C and D sit in three availability zones, a whole zone can go dark and two copies survive. Copies in another region also survive a datacenter outage, at the cost of cross-region latency on any write that waits for them.',
        'Every write now lands three times: 200K writes/s become 600K replica writes/s. With reads still served by one copy, the cluster grows to **30 nodes** holding **30 TB**, about 1 TB each.',
      ],
      keyIdea: 'Each key lives on the next N distinct machines clockwise, spread across zones, so no single failure takes its only copy.',
      metrics: { nodes: '30', ops: '500K/s', data: '30 TB (3 copies)', p99: '4 ms', quorum: 'N = 3' },
      scene: {
        nodes: [
          client,
          A,
          { ...B, status: 'active', sub: 'zone 1', badge: 'copy 1' },
          { ...C, status: 'active', sub: 'zone 2', badge: 'copy 2' },
          { ...D, status: 'active', sub: 'zone 3', badge: 'copy 3' },
          E,
          { ...F, badge: 'coordinator' },
          key,
        ],
        links: [...ringLinks, { from: 'client', to: 'F' }],
        flows: [
          { path: ['client', 'F'], tone: 'request', label: 'put cart:42', duration: 1 },
          { path: ['F', 'B'], tone: 'data', duration: 1.1, delay: 1.1 },
          { path: ['F', 'C'], tone: 'data', duration: 1.3, delay: 1.1 },
          { path: ['F', 'D'], tone: 'data', duration: 1.3, delay: 1.1 },
        ],
        caption: 'Preference list for cart:42: B, C, D',
      },
    },
    {
      title: 'Quorums',
      tag: 'concept',
      heading: 'Tune R and W per request',
      eli5: 'The writer waits until two of the three helpers say "written!", and a reader asks two helpers and keeps the newest page. Two plus two is more than three, so they always share a helper. That rule is a **quorum**.',
      body: [
        'The coordinator sends each write to all 3 replicas and replies once **W** have acknowledged. A read asks **R** replicas and returns the newest version. With **N = 3, R = 2, W = 2**, R + W > N, so every read overlaps the latest write on at least one node, as the replication lesson showed.',
        'The knobs can change per request. A session store can use W = 1 for speed and accept a rare stale read. A read-heavy catalog can use R = 1 and W = 3. Since the coordinator waits only for the fastest two of three, one slow replica does not hold up the reply.',
        'Reads now touch two copies: 600K replica reads plus 600K replica writes per second. At 30K ops/s per node that is **40 nodes**, 750 GB each. When the two read answers differ, the coordinator writes the newer version back to the stale replica. That is **read repair**.',
      ],
      keyIdea: 'R and W trade latency for freshness per request. Keep R + W > N for reads that must see the last write.',
      metrics: { nodes: '40', ops: '500K/s', data: '750 GB per node', p99: '6 ms', quorum: 'N=3 R=2 W=2' },
      scene: {
        nodes: [
          client,
          { ...A, status: 'dim' },
          { ...B, status: 'ok', badge: 'ack' },
          { ...C, status: 'ok', badge: 'ack' },
          { ...D, status: 'hot', badge: 'slow, 40 ms' },
          { ...E, status: 'dim' },
          { ...F, status: 'active', badge: 'waits for 2' },
        ],
        links: [...ringLinks, { from: 'client', to: 'F' }],
        flows: [
          { path: ['client', 'F'], tone: 'request', label: 'put W=2', duration: 1 },
          { path: ['F', 'B'], tone: 'request', duration: 1, delay: 1.1 },
          { path: ['F', 'C'], tone: 'request', duration: 1.2, delay: 1.1 },
          { path: ['F', 'D'], tone: 'request', duration: 3, delay: 1.1 },
          { path: ['B', 'F'], tone: 'response', label: 'ack', duration: 1, delay: 2.2 },
          { path: ['C', 'F'], tone: 'response', label: 'ack', duration: 1.2, delay: 2.4 },
          { path: ['F', 'client'], tone: 'response', label: 'ok after 2', duration: 1, delay: 3.7 },
        ],
        caption: 'The reply goes out after the fastest two acks',
      },
      code: {
        language: 'python',
        title: 'Coordinator: write to N, return after W acks',
        source: `async def put(key, ctx, value, w=2):
    replicas = ring.preference_list(key, n=3)
    version = ctx.next(coordinator=self.node_id)   # bump this node's counter
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
        highlight: [2, 6, 12, 13],
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
        explain: 'W = 2 needs two acks out of three, and two replicas are healthy. What is lost is the third copy of each new write, which the hinted handoff step deals with.',
      },
    },
    {
      title: 'Conflicts',
      tag: 'tradeoff',
      heading: 'Two edits, no winner: version vectors and siblings',
      eli5: 'Two kids change the same page through two helpers who cannot hear each other. Each helper adds a tally mark with her own name. The marks show neither change saw the other, so both pages are kept. The marks are a **version vector**.',
      body: [
        'A link between zones flaps. A shopper adds socks on a phone, coordinated by B, while a laptop tab adds shoes, coordinated by C. Both writes started from the version `{B:2, C:2}` and both succeed. Now `cart:42` has two versions.',
        'Wall clocks cannot pick a winner safely, as the clocks and version vectors lesson showed: last-write-wins would silently drop the socks or the shoes. Each version carries a **version vector**, one counter per coordinator. `{B:3, C:2}` and `{B:2, C:3}` are each ahead in one slot, so the writes were **concurrent** and both are kept as siblings. When one vector is ahead in every slot, the older version is dropped.',
        'The next `get` returns both siblings, and the cart code from the API step merges them as a union. A union has one flaw: an item deleted on one side can come back. Vectors also grow with every coordinator that touches a key, so stores trim the oldest entries past a limit, at the risk of reporting a false conflict.',
      ],
      keyIdea: 'Version vectors tell "newer" from "concurrent". The store keeps concurrent writes and lets the application merge them.',
      metrics: { nodes: '40', ops: '500K/s', data: '750 GB per node', p99: '6 ms', quorum: 'N=3 R=2 W=2' },
      scene: {
        nodes: [
          client,
          phone,
          { ...A, status: 'dim' },
          { ...B, status: 'active', badge: '{B:3, C:2} socks' },
          { ...C, status: 'active', badge: '{B:2, C:3} shoes' },
          { ...D, status: 'hot', badge: 'keeps both' },
          { ...E, status: 'dim' },
          { ...F, status: 'dim' },
        ],
        links: [...ringLinks, { from: 'phone', to: 'B' }, { from: 'client', to: 'C' }, { from: 'B', to: 'C', style: 'dashed', label: 'link down' }],
        flows: [
          { path: ['phone', 'B'], tone: 'request', label: 'add socks', duration: 1.3 },
          { path: ['client', 'C'], tone: 'request', label: 'add shoes', duration: 1.3 },
          { path: ['B', 'C'], tone: 'error', duration: 1, delay: 1.4 },
          { path: ['B', 'D'], tone: 'data', duration: 1.6, delay: 1.5 },
          { path: ['C', 'D'], tone: 'data', duration: 1, delay: 1.5 },
        ],
        caption: 'Neither vector is ahead in every slot: siblings',
      },
    },
    {
      title: 'Node internals',
      tag: 'concept',
      heading: 'Inside one node: commit log, memtable, SSTables',
      eli5: 'Each helper first scribbles a new note in a diary so it cannot be lost, then copies it onto a neat whiteboard. When the whiteboard is full, she prints it as a sorted booklet called an **SSTable**.',
      body: [
        'Each node takes about 15K replica writes per second, so every write must be cheap. Nodes use the LSM design from the storage engines lesson. A write is appended to the **commit log** (one sequential disk write), inserted into the **memtable**, a sorted map in RAM, and acknowledged. That takes well under a millisecond.',
        'When the memtable reaches its size limit, say 128 MB, it is written out as an immutable sorted file, an **SSTable**, and the matching log segment can be deleted. Background **compaction** merges SSTables and drops overwritten versions and expired deletion markers.',
        'A read checks the memtable first. It then asks one **bloom filter** per SSTable, from the bloom filters lesson, to skip files that surely lack the key, reads the few that might have it, and returns the newest version. Most reads open one or two files.',
      ],
      keyIdea: 'Writes are an append plus a RAM insert. Reads pay for it, and bloom filters keep that bill small.',
      metrics: { nodes: '40', ops: '500K/s', data: '750 GB per node', p99: '6 ms', quorum: 'N=3 R=2 W=2' },
      scene: {
        nodes: [
          { ...coord, label: 'node B', sub: 'write and read path' },
          { ...log, status: 'active' },
          { ...mem, status: 'active', badge: '128 MB limit' },
          bloom,
          sst1,
          { ...sst2, status: 'ok', badge: 'has cart:42' },
          sst3,
        ],
        links: [
          { from: 'coord', to: 'log' },
          { from: 'coord', to: 'mem' },
          { from: 'mem', to: 'sst1', style: 'dashed', label: 'flush' },
          { from: 'mem', to: 'bloom' },
          { from: 'bloom', to: 'sst1', style: 'faint' },
          { from: 'bloom', to: 'sst2', style: 'faint' },
          { from: 'bloom', to: 'sst3', style: 'faint' },
        ],
        flows: [
          { path: ['coord', 'log'], tone: 'request', label: 'append', duration: 1 },
          { path: ['coord', 'mem'], tone: 'request', label: 'insert', duration: 1, delay: 1 },
          { path: ['mem', 'sst1'], tone: 'data', label: 'flush when full', duration: 1.4, delay: 2.1 },
          { path: ['coord', 'mem', 'bloom'], tone: 'request', label: 'get cart:42', duration: 1.6, delay: 3.6 },
          { path: ['bloom', 'sst2'], tone: 'request', label: 'maybe here', duration: 1, delay: 5.3 },
          { path: ['sst2', 'bloom', 'mem', 'coord'], tone: 'response', duration: 1.8, delay: 6.4 },
        ],
        caption: 'Write: log then RAM. Read: RAM, filters, then files',
      },
    },
    {
      title: 'Gossip',
      tag: 'concept',
      heading: 'Gossip: every node learns who is alive',
      eli5: 'Every second each helper whispers her list of "who I heard from lately" to one random friend. The news goes around the circle fast. When nobody has heard from helper C for a while, she is marked away. That is **gossip**.',
      body: [
        'No master tracks membership, so nodes run the gossip protocol from the failure detection lesson. Each node keeps a table of every member with a heartbeat counter. Once a second it bumps its own counter and swaps tables with a random peer, keeping the higher counter for each member.',
        'With 40 nodes, news reaches everyone in a handful of rounds, a few seconds. If C\'s counter stops rising for longer than the timeout, peers mark C as down. A suspicion threshold such as phi accrual stops one long garbage collection pause from condemning a healthy node.',
        'Gossip also spreads the ring itself: which tokens each node owns. A new node contacts a few **seed** nodes, learns the ring, claims tokens, and the news travels the same way. A node marked down keeps its place on the ring. Removing it takes an operator, so a 10 minute reboot moves no data.',
      ],
      keyIdea: 'Gossip gives every node the same picture of the ring and of who is down, without any central coordinator.',
      metrics: { nodes: '40', ops: '500K/s', data: '750 GB per node', p99: '6 ms', quorum: 'N=3 R=2 W=2' },
      scene: {
        nodes: [
          { ...A, badge: 'hb 905' },
          { ...B, badge: 'hb 911' },
          { ...C, status: 'down', badge: 'hb 812, stuck' },
          { ...D, badge: 'hb 899' },
          { ...E, status: 'active', badge: 'C suspect' },
          { ...F, badge: 'hb 920' },
        ],
        links: [...ringLinks, { from: 'A', to: 'D', style: 'faint' }, { from: 'F', to: 'B', style: 'faint' }],
        flows: [
          { path: ['A', 'D'], tone: 'event', label: 'my table', duration: 1.4 },
          { path: ['F', 'B'], tone: 'event', duration: 1.2, delay: 0.4 },
          { path: ['E', 'C'], tone: 'error', label: 'no answer', duration: 1.2, delay: 1 },
          { path: ['E', 'F'], tone: 'event', label: 'C is down', duration: 1, delay: 2.4 },
          { path: ['D', 'E'], tone: 'event', duration: 1, delay: 2.8 },
        ],
        caption: 'Tables spread peer to peer, one random friend per second',
      },
    },
    {
      title: 'Hinted handoff',
      tag: 'case',
      heading: 'Case: node C reboots during the evening peak',
      eli5: 'Helper C steps out for a while. Helper E keeps C\'s new pages on sticky notes marked "for C". When C comes back, E hands the notes over. That is a **hinted handoff**.',
      body: [
        'At 8 PM node C, one of the three replicas for `cart:42`, goes down for a 10 minute reboot. With W = 2, writes still succeed on B and D, but each one C misses has only two copies. If B fails too, those carts sit on a single disk.',
        'With a **sloppy quorum**, the coordinator writes to the first N healthy nodes on the ring, which is now B, D and E. E stores its copy with a **hint**: "this belongs to C". When gossip reports C is back, E replays the hinted writes to C and deletes them. No write was refused, and C catches up in seconds.',
        'Two limits. Hints are kept for a bounded window, often a few hours, so a longer outage needs the next step. And when reads and writes see different sets of healthy nodes, as in a network split, R + W > N no longer guarantees overlap.',
      ],
      keyIdea: 'For short outages, a neighbor holds the missing copy with a note and hands it back when the owner returns.',
      metrics: { nodes: '39 up', ops: '500K/s', data: '750 GB per node', p99: '7 ms', quorum: 'sloppy, W=2' },
      scene: {
        nodes: [
          client,
          { ...A, status: 'dim' },
          { ...B, status: 'ok', badge: 'copy' },
          { ...C, status: 'down', badge: 'rebooting' },
          { ...D, status: 'ok', badge: 'copy' },
          { ...E, status: 'active', badge: 'hint: for C' },
          { ...F, badge: 'coordinator' },
        ],
        links: [...ringLinks, { from: 'client', to: 'F' }, { from: 'E', to: 'C', style: 'dashed', label: 'handoff' }],
        flows: [
          { path: ['client', 'F'], tone: 'request', label: 'put cart:42', duration: 1 },
          { path: ['F', 'B'], tone: 'data', duration: 1.1, delay: 1.1 },
          { path: ['F', 'D'], tone: 'data', duration: 1.3, delay: 1.1 },
          { path: ['F', 'E'], tone: 'data', label: 'write + hint', duration: 1.1, delay: 1.1 },
          { path: ['E', 'C'], tone: 'data', label: 'replay when back', duration: 1.6, delay: 3 },
        ],
        caption: 'C is skipped, E holds its writes for later',
      },
    },
    {
      title: 'Merkle repair',
      tag: 'case',
      heading: 'Case: six hours offline, and Merkle trees find the gap',
      eli5: 'Helper C was away all day. Instead of reading every page aloud, C and D compare a short summary of each chapter, then of each page, and copy only the pages that differ. Those summaries form a **Merkle tree**.',
      body: [
        'At 3 AM C loses a network card and stays offline for six hours, longer than the hint window. Its 750 GB is mostly right but missing six hours of writes. Copying all 750 GB from neighbors would work, slowly. Anti-entropy should move only the differences.',
        'Each node builds a **Merkle tree** per key range: hash the keys into buckets, hash each bucket, then hash pairs of hashes up to one root. Two replicas compare roots. If the roots match, the range is in sync. If not, they compare children and descend only into branches that differ.',
        'The data moved is proportional to the differences, not to the 750 GB. The same comparison runs on a schedule as background **repair**, catching what read repair and hints missed, such as a dropped hint or a corrupted block.',
      ],
      keyIdea: 'Hints cover short outages. Merkle trees cover everything else, and they cost bandwidth in proportion to what actually differs.',
      metrics: { nodes: '40', ops: '500K/s', data: '750 GB per node', p99: '6 ms', quorum: 'N=3 R=2 W=2' },
      scene: {
        nodes: [
          { ...A, status: 'dim' },
          { ...B, status: 'dim' },
          { ...C, status: 'active', badge: 'root 7c02' },
          { ...D, status: 'ok', badge: 'root a91f' },
          { ...E, status: 'dim' },
          { ...F, status: 'dim' },
        ],
        links: [...ringLinks, { from: 'C', to: 'D', label: 'compare' }],
        flows: [
          { path: ['C', 'D'], tone: 'handshake', label: 'root hash?', duration: 1 },
          { path: ['D', 'C'], tone: 'handshake', label: 'children', duration: 1, delay: 1.1 },
          { path: ['C', 'D'], tone: 'handshake', label: 'descend', duration: 1, delay: 2.2 },
          { path: ['D', 'C'], tone: 'data', label: '40 buckets', count: 3, duration: 1.4, delay: 3.4 },
        ],
        caption: 'Walk down only where the hashes differ',
      },
      code: {
        language: 'python',
        title: 'Find the buckets two replicas disagree on',
        source: `def diff(local, remote, node=ROOT):
    """Return the key buckets where two replicas disagree."""
    if local.hash(node) == remote.hash(node):
        return []                          # whole subtree matches: skip it
    if node.is_leaf():
        return [node.bucket]               # stream just this bucket
    out = []
    for child in node.children():
        out += diff(local, remote, child)  # only walk branches that differ
    return out

# a million buckets per range: a few thousand hash checks find 40 bad ones
for bucket in diff(tree_c, tree_d):
    stream_bucket(bucket, src="D", dst="C")`,
        highlight: [3, 4, 9, 14],
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'A ring of equal nodes that keeps taking writes',
      eli5: 'The helpers sit in a circle, each page is written by three of them, and they whisper who is around. Sticky notes cover short absences and chapter summaries fix long ones. That circle is a **key-value store**.',
      body: [
        'Requirements set the stance: 500K ops/s, 10 TB, p99 under 10 ms, and always writable. A **hash ring** with virtual nodes splits the keys, **N = 3** copies across zones protect them, and **R = 2, W = 2** keep reads fresh while ignoring one slow replica. Forty nodes at 750 GB each carry the load.',
        'Concurrent writes are kept as siblings with **version vectors** and merged by the app. Each node writes to a **commit log** and **memtable**, flushes **SSTables** and reads through bloom filters. **Gossip** tracks membership, **hinted handoff** covers short outages, and **Merkle tree** repair fixes long ones.',
      ],
      keyIdea: 'Every node does the same job, so any node can fail. Each failure mode gets its own repair mechanism.',
      metrics: { nodes: '40', ops: '500K/s', data: '30 TB (3 copies)', p99: '6 ms', quorum: 'N=3 R=2 W=2' },
      scene: {
        nodes: [client, ...ring.map((n) => ({ ...n, status: 'ok' as const })), key],
        links: [...ringLinks, { from: 'client', to: 'F' }],
        flows: [
          { path: ['client', 'F'], tone: 'request', label: 'put', duration: 1 },
          { path: ['F', 'B'], tone: 'data', duration: 1.1, delay: 1.1 },
          { path: ['F', 'C'], tone: 'data', duration: 1.3, delay: 1.1 },
          { path: ['F', 'D'], tone: 'data', duration: 1.3, delay: 1.1 },
          { path: ['A', 'E'], tone: 'event', label: 'gossip', duration: 1.6, delay: 2.6 },
        ],
      },
      quiz: {
        question: 'Node C was offline for 10 minutes and has just come back. Which mechanism brings it up to date fastest, without comparing its whole data set?',
        options: ['Merkle tree anti-entropy', 'Hinted handoff from the nodes that held its writes', 'Gossip', 'Raising R to 3'],
        answer: 1,
        explain: 'During the outage, nodes like E stored C\'s writes with hints. They replay exactly those writes when C returns. Merkle repair is for gaps longer than the hint window, and gossip only tells nodes that C is back.',
      },
    },
  ],
};
