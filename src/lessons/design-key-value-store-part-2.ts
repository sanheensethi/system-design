import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place a node by screen column (sx) and screen row (sy). Same sy = one horizontal row on screen. */
const p = (sx: number, sy: number): [number, number] => [(sy + sx) / 2, (sy - sx) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const client: SceneNode = { id: 'client', kind: 'client', at: p(-7.5, 0), label: 'cart service' };
const phone: SceneNode = { id: 'phone', kind: 'phone', at: p(-7.5, -7.5), label: 'shopper phone' };

// Six of the storage nodes, drawn as a ring. Clockwise on screen: A (top), B, C, D (bottom), E, F.
const A: SceneNode = { id: 'A', kind: 'shard', at: p(0, -6), label: 'node A' };
const B: SceneNode = { id: 'B', kind: 'shard', at: p(3.4, -3), label: 'node B' };
const C: SceneNode = { id: 'C', kind: 'shard', at: p(3.4, 3), label: 'node C' };
const D: SceneNode = { id: 'D', kind: 'shard', at: p(0, 6), label: 'node D' };
const E: SceneNode = { id: 'E', kind: 'shard', at: p(-3.4, 3), label: 'node E' };
const F: SceneNode = { id: 'F', kind: 'shard', at: p(-3.4, -3), label: 'node F' };

// Inside one node: the LSM write and read path.
const coord: SceneNode = { id: 'coord', kind: 'block', at: p(-7, 0), label: 'node B', sub: 'write and read path', icon: 'Server', tint: 'blue' };
const log: SceneNode = { id: 'log', kind: 'queue', at: p(-3.5, -3.5), label: 'commit log', sub: 'append only' };
const mem: SceneNode = { id: 'mem', kind: 'cache', at: p(-3.5, 4), label: 'memtable', sub: 'sorted, in RAM' };
const bloom: SceneNode = { id: 'bloom', kind: 'limiter', at: p(0.5, 3), label: 'bloom filters' };
const sst1: SceneNode = { id: 'sst1', kind: 'storage', at: p(1, -3.5), label: 'SSTable 1', sub: 'newest' };
const sst2: SceneNode = { id: 'sst2', kind: 'storage', at: p(4.5, 3), label: 'SSTable 2' };
const sst3: SceneNode = { id: 'sst3', kind: 'storage', at: p(5, -4.5), label: 'SSTable 3', sub: 'oldest' };

export const designKeyValueStorePart2: Lesson = {
  id: 'design-key-value-store-part-2',
  title: 'Design a key-value store (part 2)',
  tagline: 'Conflicting writes, the LSM storage engine on each node, and how the cluster detects and repairs failures.',
  minutes: 18,
  level: 'Advanced',
  learn: [
    'Why last-write-wins loses data, and how version vectors detect concurrent writes',
    'Siblings, app-level merges, deletes with tombstone grace periods, and vector trimming',
    'The per-node write and read path: commit log, memtable, SSTables, compaction, bloom filters',
    'Gossip membership and phi accrual failure detection',
    'Hinted handoff, Merkle tree repair, and replacing a dead node',
    'Rebalancing when nodes join or leave, and what to do about hot keys',
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
      title: 'Concurrent edits',
      tag: 'problem',
      heading: 'Two edits to one cart, at the same moment',
      eli5: 'Two kids change the same page through two helpers who cannot hear each other. Both changes are real, and neither helper knows about the other.',
      body: [
        'A shopper adds socks on a phone, coordinated by B, while a laptop tab adds shoes, coordinated by C. Both writes started from the version `{B:2, C:2}` and both succeed, since this is an AP store.',
        'No outage is needed for this. Any two writes that start from the same version conflict, even with R + W > N. A flapping link between zones is just one common cause. Neither version is wrong, and the store must decide what to do with both.',
      ],
      keyIdea: 'An always-writable store will accept conflicting writes. The design must say what happens next.',
      metrics: { nodes: '70', ops: '500K/s', data: '430 GB per node', p99: '6 ms', quorum: 'N=3 R=2 W=2' },
      metricTones: { quorum: 'warn' },
      scene: {
        nodes: [
          { ...phone, chips: ['add socks'] },
          { ...client, chips: ['add shoes'] },
          { ...B, status: 'active', chips: [{ text: 'cart + socks', tone: 'good' }] },
          { ...C, status: 'active', chips: [{ text: 'cart + shoes', tone: 'good' }] },
        ],
        links: [link('phone', 'B'), link('client', 'C'), link('B', 'C', { style: 'dashed', label: 'not yet synced', labelTone: 'warn' })],
        flows: [
          { path: ['phone', 'B'], tone: 'request', label: 'add socks', duration: 1.3 },
          { path: ['client', 'C'], tone: 'request', label: 'add shoes', duration: 1.3 },
          { path: ['B', 'C'], tone: 'error', duration: 1, delay: 1.5 },
        ],
        caption: 'Both writes start from {B:2, C:2}',
      },
    },
    {
      title: 'Why not LWW',
      tag: 'tradeoff',
      heading: 'Last write wins loses an item',
      eli5: 'If you keep only the page with the later time on its clock, one kid\'s change vanishes. And two clocks in two rooms never agree exactly, so the "later" one may be wrong.',
      body: [
        'The simple answer is **last-write-wins** (LWW): keep the version with the higher timestamp. As the clocks and version vectors lesson showed, wall clocks drift by milliseconds or more, so the "later" write may be the earlier one.',
        'Either way, LWW silently drops the socks or the shoes. For a cart that is a bug the shopper notices. LWW is fine for data where the latest value is all that matters, such as a last-seen time.',
      ],
      keyIdea: 'LWW is cheap and silently loses data. Use it only where a lost write does not matter.',
      metrics: { nodes: '70', ops: '500K/s', data: '430 GB per node', p99: '6 ms', quorum: 'N=3 R=2 W=2' },
      metricTones: { quorum: 'bad' },
      scene: {
        nodes: [
          { ...B, chips: [{ text: 'socks @ 10:00:00.120', tone: 'default' }] },
          { ...C, chips: [{ text: 'shoes @ 10:00:00.118', tone: 'default' }] },
          { ...D, status: 'hot', badge: 'keeps socks only' },
        ],
        links: [link('B', 'D'), link('C', 'D')],
        flows: [
          { path: ['B', 'D'], tone: 'data', label: 'socks', duration: 1.4 },
          { path: ['C', 'D'], tone: 'error', label: 'shoes dropped', duration: 1.4, delay: 0.6 },
        ],
        panel: {
          title: 'Last write wins',
          icon: 'Clock',
          rows: [
            { text: 'Clock skew between B and C', value: 'up to 100 ms', tone: 'warn' },
            { text: 'Gap between the writes', value: '2 ms', tone: 'warn' },
            { text: 'Winner', value: 'a coin flip', tone: 'bad' },
            { text: 'Loser', value: 'gone', tone: 'bad' },
          ],
        },
        caption: 'The clocks cannot order these writes',
      },
    },
    {
      title: 'Version vectors',
      tag: 'concept',
      heading: 'A counter per coordinator tells newer from concurrent',
      eli5: 'Each helper adds a tally mark with her own name whenever she changes a page. Compare the marks: if one page has at least as many marks everywhere, it is newer. If each has some the other lacks, both are kept.',
      body: [
        'Each version carries a **version vector**: one counter per coordinator that has touched the key. B bumps its slot, C bumps its slot.',
        '`{B:3, C:2}` and `{B:2, C:3}` are each ahead in one slot, so neither descends from the other. The writes were **concurrent**. When one vector is ahead or equal in every slot, the older version is dropped.',
      ],
      keyIdea: 'Version vectors tell "newer" from "concurrent" without trusting any clock.',
      metrics: { nodes: '70', ops: '500K/s', data: '430 GB per node', p99: '6 ms', quorum: 'N=3 R=2 W=2' },
      scene: {
        nodes: [
          { ...B, status: 'active', chips: [{ text: '{B:3, C:2} socks' }] },
          { ...C, status: 'active', chips: [{ text: '{B:2, C:3} shoes' }] },
          { ...D, status: 'hot', badge: 'keeps both' },
        ],
        links: [link('B', 'D'), link('C', 'D')],
        flows: [
          { path: ['B', 'D'], tone: 'data', duration: 1.4 },
          { path: ['C', 'D'], tone: 'data', duration: 1.4, delay: 0.3 },
        ],
        panel: {
          title: 'Compare two vectors',
          icon: 'Binary',
          rows: [
            { text: '{B:3,C:2} vs {B:2,C:2}', value: 'newer, drop old', tone: 'good' },
            { text: '{B:3,C:2} vs {B:2,C:3}', value: 'concurrent', tone: 'warn' },
            { text: 'Concurrent result', value: 'keep both', tone: 'warn' },
          ],
          footer: { text: 'Neither is ahead in every slot', tone: 'muted' },
        },
        caption: 'Neither vector is ahead in every slot',
      },
    },
    {
      title: 'Siblings',
      tag: 'concept',
      heading: 'Return siblings and let the app merge',
      eli5: 'The next time someone asks for the page, the helper hands over both versions and says "you decide". The kid combines them into one page and writes it back with the stamp.',
      body: [
        'The next `get` returns both **siblings** with one merged context. The cart code from the API step merges them as a union, then `put`s the result back with that context, which supersedes both.',
        'The store does not know what the bytes mean, so only the app can merge correctly. Merge rules differ: a cart unions items, a counter takes the max.',
      ],
      keyIdea: 'The store keeps what it cannot order and returns it. The application knows how to combine it.',
      metrics: { nodes: '70', ops: '500K/s', data: '430 GB per node', p99: '6 ms', quorum: 'N=3 R=2 W=2' },
      scene: {
        nodes: [client, { ...D, status: 'active', chips: [{ text: 'socks', tone: 'warn' }, { text: 'shoes', tone: 'warn' }] }, { id: 'merge', kind: 'block', size: 0.8, at: p(-7.5, 7), label: 'merge', sub: 'union', icon: 'Layers', tint: 'violet' }],
        links: [link('client', 'D', { arrow: 'both' }), link('client', 'merge', { style: 'faint' })],
        flows: [
          { path: ['client', 'D'], tone: 'request', label: 'get cart:42', duration: 1.1 },
          { path: ['D', 'client'], tone: 'response', label: 'socks + shoes + ctx', duration: 1.3, delay: 1.2 },
          { path: ['client', 'D'], tone: 'request', label: 'put(ctx, both)', duration: 1.2, delay: 2.8 },
        ],
        panel: {
          title: 'After the merge',
          icon: 'Code',
          code: 'before: [socks] + [shoes]\nmerge:  union\nafter:  [socks, shoes]\nvector: {B:3, C:3, D:1}',
        },
        caption: 'One put with the merged context resolves it',
      },
      quiz: {
        question: 'Vector X is {B:3, C:2} and vector Y is {B:2, C:3}. What does the store do with the two versions?',
        options: ['Keeps X because B has the higher counter', 'Keeps both as siblings', 'Keeps the one with the later wall-clock time', 'Drops both and asks the client to retry'],
        answer: 1,
        explain: 'X is ahead in slot B and Y is ahead in slot C, so neither descends from the other. The writes were concurrent, and both are kept as siblings for the app to merge.',
      },
    },
    {
      title: 'Deletes',
      tag: 'tradeoff',
      heading: 'A union merge can bring deleted items back',
      eli5: 'One kid crosses socks off the list while the other kid, who never saw that, writes her own copy. Merge the two pages by adding everything together, and the socks are back.',
      body: [
        'A union has one flaw. A shopper removes socks on one side while a stale sibling still lists them, and the union puts them back. So removals are stored as marked entries, a **tombstone** per removed item. `delete(key)` writes one too.',
        'Stores cannot know every replica has seen a tombstone, so they keep it for a fixed grace period (Cassandra: 10 days). Repair must finish inside that window, or a replica that missed the delete revives it (**zombie data**). TTL expiry is dropped at compaction.',
      ],
      keyIdea: 'Record deletes as tombstones, and run repair more often than the grace period.',
      metrics: { nodes: '70', ops: '500K/s', data: '430 GB per node', p99: '6 ms', quorum: 'N=3 R=2 W=2' },
      metricTones: { quorum: 'warn' },
      scene: {
        nodes: [
          { ...B, chips: [{ text: 'cart: shoes', tone: 'good' }, { text: 'socks removed', tone: 'warn' }] },
          { ...C, chips: [{ text: 'cart: shoes, socks', tone: 'default' }] },
          { id: 'union', kind: 'block', size: 0.85, at: p(0, 6), label: 'merge', sub: 'union', icon: 'Layers', tint: 'red', status: 'hot', badge: 'socks are back' },
        ],
        links: [link('B', 'union'), link('C', 'union')],
        flows: [
          { path: ['B', 'union'], tone: 'data', duration: 1.4 },
          { path: ['C', 'union'], tone: 'data', duration: 1.4, delay: 0.3 },
        ],
        panel: {
          title: 'Why tombstones',
          icon: 'List',
          rows: [
            { text: 'Union without tombstone', value: 'socks return', tone: 'bad' },
            { text: 'Tombstone: socks removed', value: 'merge keeps it gone', tone: 'good' },
            { text: 'Cleanup', value: 'after grace period', tone: 'muted' },
            { text: 'Repair slower than grace', value: 'zombie data', tone: 'bad' },
          ],
        },
        caption: 'Absence cannot tell removed from never added',
      },
    },
    {
      title: 'Vector size',
      tag: 'tradeoff',
      heading: 'Vectors grow, so stores trim them',
      eli5: 'Every helper who touches a page adds her name to the tally. After many helpers the tally is longer than the page. So the shop rubs out the oldest names.',
      body: [
        'A vector gets one entry per coordinator that has written the key. Only nodes holding the key coordinate, so that is usually 3 entries. Stand-ins during sloppy quorums add more over time, so stores cap the size and trim the oldest entries by timestamp.',
        'Trimming is lossy. A missing slot reads as 0, so rarely two concurrent versions look ordered and one is silently dropped, or ordered ones look concurrent and cost an extra sibling. Trim only old entries, and keep coordinators few.',
      ],
      keyIdea: 'Trimming bounds vector size at a small price: rarely a concurrent write looks old and is dropped, or an ordered one shows up as a sibling.',
      metrics: { nodes: '70', ops: '500K/s', data: '430 GB per node', p99: '6 ms', quorum: 'N=3 R=2 W=2' },
      scene: {
        nodes: [
          { id: 'full', kind: 'block', size: 0.85, at: p(-4, 0), label: 'vector, 24 entries', sub: 'stand-ins pile up', icon: 'Binary', tint: 'red', status: 'hot' },
          { id: 'trim', kind: 'block', size: 0.85, at: p(4, 0), label: 'vector, 10 entries', sub: 'oldest dropped', icon: 'Binary', tint: 'green', status: 'ok' },
        ],
        links: [link('full', 'trim', { label: 'trim oldest' })],
        flows: [{ path: ['full', 'trim'], tone: 'data', duration: 1.5 }],
        panel: {
          title: 'Trimming trade',
          icon: 'Scale',
          rows: [
            { text: 'Bytes per vector', value: '~12 B per entry' },
            { text: 'Limit', value: '10 entries' },
            { text: 'Risk', value: 'false order or extra sibling', tone: 'warn' },
            { text: 'Lost writes', value: 'rare, accepted', tone: 'warn' },
            { text: 'Mitigation', value: 'age threshold, few coordinators', tone: 'good' },
          ],
        },
        caption: 'Bounded metadata, occasional extra merge',
      },
    },
    {
      title: 'Write path',
      tag: 'concept',
      heading: 'A write is a log append plus a RAM insert',
      eli5: 'Each helper first scribbles a new note in a diary so it cannot be lost, then copies it onto a neat whiteboard. Writing in a diary is fast, because she only adds to the end.',
      body: [
        'Each node takes about 9K replica writes per second, so every write must be cheap. Nodes use the LSM design from the storage engines lesson.',
        'A write is appended to the **commit log** (one sequential disk write), inserted into the **memtable**, a sorted map in RAM, and acknowledged. Whether the append is fsynced first is a policy: per write (safest, slowest), in batches, or on a timer (fastest, can lose the last moments on power loss). Replicas cover that tail, part of why W = 2.',
      ],
      keyIdea: 'Sequential append plus a RAM insert makes writes fast and survivable. No random disk write is needed.',
      metrics: { nodes: '70', ops: '500K/s', data: '430 GB per node', p99: '6 ms', quorum: 'N=3 R=2 W=2' },
      scene: {
        nodes: [coord, { ...log, status: 'active', chips: ['append'] }, { ...mem, status: 'active', chips: ['insert'] }],
        links: [link('coord', 'log'), link('coord', 'mem')],
        flows: [
          { path: ['coord', 'log'], tone: 'request', label: 'append', duration: 1 },
          { path: ['coord', 'mem'], tone: 'request', label: 'insert', duration: 1, delay: 1 },
          { path: ['mem', 'coord'], tone: 'response', label: 'ack', duration: 1, delay: 2.1 },
        ],
        panel: {
          title: 'Cost of one write',
          icon: 'Timer',
          rows: [
            { text: 'Commit log append', value: 'sequential', tone: 'good' },
            { text: 'Memtable insert', value: 'RAM', tone: 'good' },
            { text: 'fsync policy', value: 'per write, batch or timer', tone: 'warn' },
          { text: 'Total, timed fsync', value: '< 1 ms', tone: 'good' },
          ],
          footer: { text: 'A process crash replays the log into the memtable', tone: 'muted' },
        },
        caption: 'Log first, so a process crash loses nothing',
      },
    },
    {
      title: 'SSTables',
      tag: 'concept',
      heading: 'A full memtable becomes an SSTable',
      eli5: 'When the whiteboard is full, the helper prints it as a sorted booklet called an **SSTable**, and erases the board. A booklet is never edited again.',
      body: [
        'When the memtable reaches its size limit, say 128 MB, it is written out as an immutable sorted file, an **SSTable**. The matching commit log segment can then be deleted.',
        'Files are never edited in place. A newer value for a key goes into a newer file or the memtable. A read collects versions from the memtable and files, drops any dominated by a newer vector and returns the rest as siblings.',
      ],
      keyIdea: 'Immutable sorted files make writes sequential and safe. A newer vector shadows the versions it descends from.',
      metrics: { nodes: '70', ops: '500K/s', data: '430 GB per node', p99: '6 ms', quorum: 'N=3 R=2 W=2' },
      scene: {
        nodes: [{ ...log, chips: ['segment freed'] }, { ...mem, status: 'hot', load: 95, badge: '128 MB limit' }, { ...sst1, status: 'active', badge: 'new file' }],
        links: [link('log', 'mem', { style: 'faint' }), link('mem', 'sst1', { style: 'dashed', label: 'flush' })],
        flows: [{ path: ['mem', 'sst1'], tone: 'data', label: 'flush when full', duration: 1.5 }],
        panel: {
          title: 'Flush',
          icon: 'HardDrive',
          rows: [
            { text: 'Memtable size', value: '128 MB' },
            { text: 'On flush', value: 'sorted file written' },
            { text: 'Log segment', value: 'deleted' },
            { text: 'File edits later', value: 'never', tone: 'good' },
          ],
        },
        caption: 'Memory to disk in one sorted pass',
      },
    },
    {
      title: 'Compaction',
      tag: 'concept',
      heading: 'Compaction merges files in the background',
      eli5: 'After a while there are many booklets with old copies of the same page. A helper in the quiet hours merges them into one clean booklet and throws away the outdated pages.',
      body: [
        'Flushes pile up SSTables, and every extra file makes reads slower. Background **compaction** merges several into one larger sorted file, keeps the versions no newer vector dominates, and drops overwritten versions, expired TTL records and tombstones past their grace period.',
        'The cost is extra disk writes, called write amplification, and a burst of I/O. Compaction is rate limited so it does not steal from live traffic.',
      ],
      keyIdea: 'Compaction pays disk I/O in the background to keep reads from touching too many files.',
      metrics: { nodes: '70', ops: '500K/s', data: '430 GB per node', p99: '6 ms', quorum: 'N=3 R=2 W=2' },
      scene: {
        nodes: [sst1, sst3, { id: 'merged', kind: 'storage', at: p(0, 4.5), label: 'merged SSTable', sub: 'live versions only', status: 'ok' }],
        links: [link('sst1', 'merged'), link('sst3', 'merged')],
        flows: [
          { path: ['sst1', 'merged'], tone: 'data', duration: 1.5 },
          { path: ['sst3', 'merged'], tone: 'data', duration: 1.5, delay: 0.3 },
        ],
        panel: {
          title: 'What compaction does',
          icon: 'Layers',
          rows: [
            { text: 'Keeps live versions per key', tone: 'good' },
            { text: 'Drops overwritten versions' },
            { text: 'Drops expired TTLs and old tombstones' },
            { text: 'Cost: extra disk writes', value: 'rate limited', tone: 'warn' },
          ],
        },
        caption: 'Fewer files, faster reads',
      },
      quiz: {
        question: 'Why does a node write to an append-only commit log before the memtable?',
        options: ['So reads are faster', 'So a crash can replay the log and rebuild the memtable', 'To avoid compaction', 'To order concurrent writes by time'],
        answer: 1,
        explain: 'The memtable is in RAM and vanishes on a process crash. After a process crash, replaying the log restores the acknowledged writes. After a power loss an unsynced tail can be missing, and the other replicas cover it.',
      },
    },
    {
      title: 'Read path',
      tag: 'concept',
      heading: 'Reads check RAM, then bloom filters, then files',
      eli5: 'To find a page, first look on the whiteboard. Then ask a short checklist for each booklet: "could this name be in here?" Only open the booklets that say maybe.',
      body: [
        'A read checks the memtable first. It then asks one **bloom filter** per SSTable, from the bloom filters lesson, to skip files that surely lack the key.',
        'It reads the few files that might have it and combines what it finds: versions dominated by a newer vector are dropped and the rest return as siblings. Most reads open one or two files, so reads stay in the single-digit milliseconds.',
      ],
      keyIdea: 'Bloom filters turn "look in every file" into "look in one or two". That keeps LSM reads cheap.',
      metrics: { nodes: '70', ops: '500K/s', data: '430 GB per node', p99: '6 ms', quorum: 'N=3 R=2 W=2' },
      scene: {
        nodes: [coord, { ...mem, chips: ['miss'] }, bloom, { ...sst2, status: 'ok', badge: 'has cart:42' }, { ...sst3, status: 'dim', chips: ['skipped'] }],
        links: [link('coord', 'mem'), link('mem', 'bloom'), link('bloom', 'sst2', { style: 'faint' }), link('bloom', 'sst3', { style: 'faint' })],
        flows: [
          { path: ['coord', 'mem', 'bloom'], tone: 'request', label: 'get cart:42', duration: 1.6 },
          { path: ['bloom', 'sst2'], tone: 'request', label: 'maybe here', duration: 1, delay: 1.7 },
          { path: ['sst2', 'bloom', 'mem', 'coord'], tone: 'response', duration: 1.8, delay: 2.8 },
        ],
        panel: {
          title: 'Read steps',
          icon: 'Search',
          rows: [
            { text: '1. Memtable', value: 'miss' },
            { text: '2. Bloom filters', value: '1 maybe, 2 no', tone: 'good' },
            { text: '3. Open SSTable 2', value: 'found', tone: 'good' },
          ],
          footer: { text: 'Files opened: 1 of 3', tone: 'good' },
        },
        caption: 'RAM, filters, then the files that might hold it',
      },
    },
    {
      title: 'Gossip',
      tag: 'concept',
      heading: 'Gossip: every node learns who is alive',
      eli5: 'Every second each helper whispers her list of "who I heard from lately" to one random friend. The news goes around the circle fast. That is **gossip**.',
      body: [
        'No master tracks membership, so nodes run the gossip protocol from the failure detection lesson. Each node keeps a table of every member with a heartbeat counter. Once a second it bumps its own counter and swaps tables with a random peer, keeping the higher counter for each member.',
        'With 70 nodes, news reaches everyone in a handful of rounds, a few seconds.',
      ],
      keyIdea: 'Gossip gives every node the same picture of the cluster, without any central coordinator.',
      metrics: { nodes: '70', ops: '500K/s', data: '430 GB per node', p99: '6 ms', quorum: 'N=3 R=2 W=2' },
      scene: {
        nodes: [{ ...A, chips: ['hb 905'] }, { ...B, chips: ['hb 911'] }, { ...D, chips: ['hb 899'] }, { ...F, chips: ['hb 920'] }],
        links: [link('A', 'D', { style: 'faint', arrow: 'both' }), link('F', 'B', { style: 'faint', arrow: 'both' })],
        flows: [
          { path: ['A', 'D'], tone: 'event', label: 'my table', duration: 1.4 },
          { path: ['F', 'B'], tone: 'event', label: 'my table', duration: 1.4, delay: 0.5 },
        ],
        panel: {
          title: 'A gossip round',
          icon: 'Rss',
          rows: [
            { text: 'Bump own counter', value: 'every 1 s' },
            { text: 'Pick a random peer', value: '1 per round' },
            { text: 'Merge: keep higher counter' },
            { text: 'Whole cluster knows', value: 'a few seconds', tone: 'good' },
          ],
        },
        caption: 'Tables spread peer to peer',
      },
    },
    {
      title: 'Ring by gossip',
      tag: 'concept',
      heading: 'Gossip also carries the ring itself',
      eli5: 'A new helper walks up to a few helpers who always stand in the same spots, learns the circle, picks her seats, and the news of her seats whispers around too.',
      body: [
        'Gossip spreads which tokens each node owns. A new node contacts a few **seed** nodes, learns the ring, claims tokens, and the news travels the same way.',
        'A node marked down keeps its place on the ring. Removing it takes an operator, so a 10 minute reboot moves no data.',
      ],
      keyIdea: 'Membership and token ownership ride the same gossip. Down is temporary, removed is a decision.',
      metrics: { nodes: '71', ops: '500K/s', data: '430 GB per node', p99: '6 ms', quorum: 'N=3 R=2 W=2' },
      scene: {
        nodes: [
          { id: 'seed', kind: 'block', size: 0.8, at: p(-4, -3), label: 'seed node', sub: 'well-known address', icon: 'Key', tint: 'violet' },
          { id: 'newNode', kind: 'shard', at: p(-4, 3.5), label: 'new node G', status: 'active', badge: 'joining' },
          { ...B, status: 'ok' },
        ],
        links: [link('newNode', 'seed', { label: 'hello' }), link('seed', 'B', { style: 'faint' })],
        flows: [
          { path: ['newNode', 'seed'], tone: 'handshake', label: 'hello', duration: 1.2 },
          { path: ['seed', 'newNode'], tone: 'response', label: 'ring + tokens', duration: 1.2, delay: 1.3 },
          { path: ['newNode', 'seed', 'B'], tone: 'event', label: 'G owns 256 tokens', duration: 1.6, delay: 2.7 },
        ],
        panel: {
          title: 'Join steps',
          icon: 'Plug',
          rows: [
            { text: '1. Contact a seed', value: 'learn the ring' },
            { text: '2. Claim tokens', value: '256' },
            { text: '3. Stream data in', value: 'from many nodes' },
            { text: 'Node marked down', value: 'tokens kept', tone: 'good' },
          ],
        },
        caption: 'One new node joins through a seed',
      },
    },
    {
      title: 'Phi detector',
      tag: 'concept',
      heading: 'Deciding a node is down without false alarms',
      eli5: 'If a helper is quiet for a moment, maybe she is just thinking. The shop waits longer when she is usually slow, and shorter when she usually answers at once. That is **phi accrual**.',
      body: [
        'If C\'s counter stops rising, peers start to suspect it. A fixed timeout fires on a long garbage collection pause and condemns a healthy node.',
        'A suspicion score such as **phi accrual** compares the current silence with C\'s own history of heartbeat gaps. A node that normally beats every second is suspected faster than one that is often slow.',
      ],
      keyIdea: 'Suspect a node relative to its own past behavior, and mark it down only when the score crosses a threshold.',
      metrics: { nodes: '70 (1 suspect)', ops: '500K/s', data: '430 GB per node', p99: '6 ms', quorum: 'N=3 R=2 W=2' },
      metricTones: { nodes: 'warn' },
      scene: {
        nodes: [{ ...C, status: 'down', badge: 'hb 812, stuck' }, { ...E, status: 'active', chips: [{ text: 'C suspect', tone: 'warn' }] }, { ...F, chips: ['C is down'] }],
        links: [link('E', 'C', { style: 'dashed', label: 'no answer', labelTone: 'warn' }), link('E', 'F', { style: 'faint' })],
        flows: [
          { path: ['E', 'C'], tone: 'error', label: 'no answer', duration: 1.2 },
          { path: ['E', 'F'], tone: 'event', label: 'C is down', duration: 1, delay: 1.5 },
        ],
        panel: {
          title: 'Phi score for C',
          icon: 'Activity',
          rows: [
            { text: 'Usual gap between beats', value: '1.0 s' },
            { text: 'Silence now', value: '6 s', tone: 'warn' },
            { text: 'Phi', value: '9', tone: 'bad' },
            { text: 'Threshold', value: '8' },
          ],
          footer: { text: 'Over threshold: mark C down', tone: 'bad' },
        },
        caption: 'The score rises with silence',
      },
    },
    {
      title: 'Hinted handoff',
      tag: 'case',
      heading: 'Case: node C reboots during the evening peak',
      eli5: 'Helper C steps out for a while. Helper E keeps C\'s new pages on sticky notes marked "for C". When C comes back, E hands the notes over. That is a **hinted handoff**.',
      body: [
        'At 8 PM node C, one of the three replicas for `cart:42`, goes down for a 10 minute reboot. With W = 2, writes still succeed on B and D, but each one C misses has only two copies.',
        'With a **sloppy quorum**, the coordinator writes to the first N healthy nodes on the ring: B, D and E. E stores its copy with a **hint**: "this belongs to C". When gossip reports C is back, E replays the hinted writes and deletes them.',
      ],
      keyIdea: 'For short outages, a neighbor holds the missing copy with a note and hands it back when the owner returns.',
      metrics: { nodes: '69 up', ops: '500K/s', data: '430 GB per node', p99: '7 ms', quorum: 'sloppy, W=2' },
      metricTones: { nodes: 'warn', quorum: 'warn' },
      scene: {
        nodes: [
          { ...B, status: 'active', badge: 'coordinator, copy' },
          { ...C, status: 'down', badge: 'rebooting' },
          { ...D, status: 'ok', badge: 'copy' },
          { ...E, status: 'active', chips: [{ text: 'hint: for C', tone: 'warn' }] },
        ],
        links: [link('B', 'D'), link('B', 'E'), link('E', 'C', { style: 'dashed', label: 'handoff' })],
        flows: [
          { path: ['B', 'D'], tone: 'data', duration: 1.3 },
          { path: ['B', 'E'], tone: 'data', label: 'write + hint', duration: 1.1 },
          { path: ['E', 'C'], tone: 'data', label: 'replay when back', duration: 1.6, delay: 2.2 },
        ],
        caption: 'C is skipped, E holds its writes for later',
      },
    },
    {
      title: 'Handoff limits',
      tag: 'tradeoff',
      heading: 'What sloppy quorums give up',
      eli5: 'Sticky notes only work for a short absence. And if a reader and a writer ask different sets of helpers, they might never meet the same one.',
      body: [
        'Hints are kept for a bounded window, often a few hours, so a longer outage needs Merkle repair.',
        'When reads and writes see different sets of healthy nodes, as in a network split, R + W > N no longer guarantees overlap. A read can miss a write that sits as a hint on a stand-in node. Sloppy quorums trade freshness for availability.',
      ],
      keyIdea: 'Hinted handoff keeps writes accepted, and it weakens the overlap guarantee while it is in use.',
      metrics: { nodes: '69 up', ops: '500K/s', data: '430 GB per node', p99: '7 ms', quorum: 'sloppy, W=2' },
      metricTones: { quorum: 'bad' },
      scene: {
        nodes: [
          { ...E, status: 'active', chips: [{ text: 'hint for C', tone: 'warn' }] },
          { ...C, status: 'down', badge: 'down 6 h' },
          { id: 'ttl', kind: 'block', size: 0.8, at: p(-7, 3), label: 'hint window', sub: 'a few hours', icon: 'Clock', tint: 'amber', status: 'hot' },
        ],
        links: [link('E', 'C', { style: 'dashed', label: 'handoff', labelTone: 'warn' }), link('ttl', 'E', { style: 'faint' })],
        flows: [{ path: ['E', 'C'], tone: 'error', label: 'hints expired', duration: 1.6 }],
        panel: {
          title: 'Limits',
          icon: 'Scale',
          rows: [
            { text: 'Hint kept for', value: 'a few hours', tone: 'warn' },
            { text: 'Outage longer', value: 'needs Merkle repair', tone: 'warn' },
            { text: 'Split cluster', value: 'R + W > N may fail', tone: 'bad' },
          ],
        },
        caption: 'Available, with a weaker guarantee',
      },
    },
    {
      title: 'Long outage',
      tag: 'case',
      heading: 'Case: six hours offline, past the hint window',
      eli5: 'Helper C was away all day, longer than any sticky note lasts. She is mostly up to date but missing a day of pages. Copying the whole notebook would take ages.',
      body: [
        'At 3 AM C loses a network card and stays offline for six hours, past the hint window. The cluster took about 4.3B writes meanwhile, but traffic is skewed to active carts and sessions, so about 5% of keys changed. C\'s 430 GB is mostly right.',
        'Copying all 430 GB from neighbors would work, slowly. Anti-entropy should move only the differences.',
      ],
      keyIdea: 'When hints expire, the replica needs a way to find exactly which keys it missed.',
      metrics: { nodes: '69 up', ops: '500K/s', data: '430 GB per node', p99: '7 ms', quorum: 'N=3 R=2 W=2' },
      metricTones: { nodes: 'warn' },
      scene: {
        nodes: [{ ...C, status: 'down', badge: 'offline 6 h' }, { ...D, status: 'ok', badge: 'has all writes' }, { id: 'gap', kind: 'block', size: 0.8, at: p(-4, 0), label: '6 hours missed', sub: '~5% of keys changed', icon: 'Clock', tint: 'red' }],
        links: [link('D', 'C', { label: '430 GB full copy?', labelTone: 'warn' }), link('gap', 'C', { style: 'faint' })],
        flows: [{ path: ['D', 'C'], tone: 'data', label: 'too much to copy', count: 3, duration: 1.8 }],
        panel: {
          title: 'The gap',
          icon: 'Gauge',
          rows: [
            { text: 'C data size', value: '430 GB' },
            { text: 'Writes in 6 h, cluster', value: '4.3B' },
            { text: 'Keys changed (skewed)', value: '~5%, 21M on C', tone: 'warn' },
            { text: 'Full copy', value: 'hours', tone: 'bad' },
          ],
        },
        caption: 'Find the gap, copy only the gap',
      },
    },
    {
      title: 'Merkle repair',
      tag: 'case',
      heading: 'Merkle trees find the gap',
      eli5: 'Helper C was away all day. Instead of reading every page aloud, C and D compare a short summary of each chapter, then of each page, and copy only the pages that differ. Those summaries form a **Merkle tree**.',
      body: [
        'Each node builds a **Merkle tree** per key range: hash the keys into about 64M buckets (about 6 keys each), hash each bucket, then hash pairs up to one root. Replicas compare roots and descend only into branches that differ. Here about 28% of buckets differ, so C streams about 120 GB, not 430 GB.',
        'Merkle trees pay off most when only a small fraction changed, which is why hints cover short gaps and repair covers the rest.',
      ],
      keyIdea: 'Hints cover short outages. Merkle trees cover the rest, at a cost in proportion to what differs. The same comparison runs on a schedule as background repair.',
      metrics: { nodes: '70', ops: '500K/s', data: '430 GB per node', p99: '6 ms', quorum: 'N=3 R=2 W=2' },
      scene: {
        nodes: [{ ...C, status: 'active', badge: 'root 7c02' }, { ...D, status: 'ok', badge: 'root a91f' }, { id: 'diff', kind: 'block', size: 0.8, at: p(-4, 0), label: '18M buckets differ', sub: 'of 64M, about 28%', icon: 'Binary', tint: 'amber' }],
        links: [link('C', 'D', { label: 'compare', arrow: 'both' }), link('diff', 'C', { style: 'faint' })],
        flows: [
          { path: ['C', 'D'], tone: 'handshake', label: 'root hash?', duration: 1 },
          { path: ['D', 'C'], tone: 'handshake', label: 'children', duration: 1, delay: 1.1 },
          { path: ['C', 'D'], tone: 'handshake', label: 'descend', duration: 1, delay: 2.2 },
          { path: ['D', 'C'], tone: 'data', label: '120 GB', count: 3, duration: 1.4, delay: 3.4 },
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

# 64M buckets per node, 18M differ: millions of hash checks, not 430M key compares
for bucket in diff(tree_c, tree_d):
    stream_bucket(bucket, src="D", dst="C")`,
        highlight: [3, 4, 9, 14],
      },
    },
    {
      title: 'Dead node',
      tag: 'case',
      heading: 'A node that never comes back',
      eli5: 'If helper C never returns, the shop hires a new helper, gives her C\'s seats, and each neighbor copies over the pages she should now keep.',
      body: [
        'A permanent failure is a decision. An operator removes C (or an automatic policy does after a long outage). Its arcs go to the next nodes on the ring, and each new owner streams its missing ranges from the surviving replicas, using Merkle comparison to move only what is absent.',
        'Because C held 256 tokens, the work spreads over many nodes. Replace the machine and the new one takes over the same tokens, then streams them in. Keep one spare of capacity free so the streaming fits.',
      ],
      keyIdea: 'Permanent loss triggers re-replication from survivors. Virtual nodes spread that work so no one neighbor is crushed.',
      metrics: { nodes: '69', ops: '500K/s', data: '440 GB per node', p99: '8 ms', quorum: 'N=3 R=2 W=2' },
      metricTones: { nodes: 'warn', p99: 'warn' },
      scene: {
        nodes: [
          { ...C, status: 'down', badge: 'removed' },
          { id: 'newC', kind: 'shard', at: p(7, 0), label: 'node C2', status: 'active', badge: 'streaming', load: 70 },
          { ...B, status: 'ok', chips: ['range stream'] },
          { ...D, status: 'ok', chips: ['range stream'] },
        ],
        links: [link('B', 'newC'), link('D', 'newC')],
        flows: [
          { path: ['B', 'newC'], tone: 'data', label: 'copies', duration: 1.6 },
          { path: ['D', 'newC'], tone: 'data', label: 'copies', duration: 1.6, delay: 0.4 },
        ],
        panel: {
          title: 'Replace a node',
          icon: 'Repeat',
          rows: [
            { text: 'Remove C from the ring', value: 'operator' },
            { text: 'C2 takes C\'s tokens' },
            { text: 'C2 streams ranges from replicas', value: 'many sources', tone: 'good' },
            { text: 'Cluster stays writable', value: 'throughout', tone: 'good' },
          ],
        },
        caption: 'Survivors rebuild the lost copy',
      },
    },
    {
      title: 'Rebalancing',
      tag: 'concept',
      heading: 'Scaling out and in moves small arcs',
      eli5: 'A new helper joins the circle and takes a few seats. Each neighbor hands over just the pages for those seats, a few at a time, so nobody stops working.',
      body: [
        'Scaling out is automatic. A new node claims its tokens and streams the arcs it now owns from the current replicas, a small slice from each of many nodes. It serves reads once it has caught up, and the old owners then drop the moved data.',
        'Scaling in is the reverse: a decommissioned node streams its arcs to the new owners before it leaves. Streaming is rate limited so live traffic keeps its p99.',
      ],
      keyIdea: 'With many tokens, a node joining or leaving moves a thin slice of keys from many peers, not a big block from one.',
      metrics: { nodes: '70 to 71', ops: '500K/s', data: '430 GB per node', p99: '6 ms', quorum: 'N=3 R=2 W=2' },
      scene: {
        nodes: [
          { id: 'newG', kind: 'shard', at: p(-5, 0), label: 'new node G', status: 'active', badge: 'streaming in', load: 55 },
          { ...A, status: 'ok', chips: ['slice of arc'] },
          { ...B, status: 'ok', chips: ['slice of arc'] },
          { ...D, status: 'ok', chips: ['slice of arc'] },
        ],
        links: [link('A', 'newG'), link('B', 'newG'), link('D', 'newG')],
        flows: [
          { path: ['A', 'newG'], tone: 'data', duration: 1.6 },
          { path: ['B', 'newG'], tone: 'data', duration: 1.6, delay: 0.3 },
          { path: ['D', 'newG'], tone: 'data', duration: 1.6, delay: 0.6 },
        ],
        panel: {
          title: 'Scale out, scale in',
          icon: 'Repeat',
          rows: [
            { text: 'New node claims', value: '256 tokens' },
            { text: 'Keys moved', value: '~1/71 of all' },
            { text: 'Source of the data', value: 'many peers', tone: 'good' },
            { text: 'Serves reads', value: 'after catch-up' },
            { text: 'Decommission', value: 'streams out first' },
          ],
        },
        caption: 'Every peer gives a thin slice',
      },
    },
    {
      title: 'Hot keys',
      tag: 'tradeoff',
      heading: 'One popular key overloads its three nodes',
      eli5: 'The shop spreads pages evenly, but if everybody wants the same page, the three helpers who hold it get swamped, however many other helpers are free.',
      body: [
        'The ring spreads keys evenly, not traffic. A flash-sale item can draw 100K reads/s, which is 200K replica reads on the same 3 nodes at R = 2, far past the 30K ops/s each can serve. More nodes do not help, because the key still hashes to one place.',
        'Fixes: cache the key in the client or coordinator for a second, read it from more copies, or split it into `item:7#0` to `#7` and combine on read (or spread writes over the parts). A cache trades freshness for relief.',
      ],
      keyIdea: 'Even placement does not mean even load. Hot keys need a cache or a split key on top of the ring.',
      metrics: { nodes: '70', ops: '500K/s', data: '430 GB per node', p99: '40 ms on hot key', quorum: 'N=3 R=2 W=2' },
      metricTones: { p99: 'bad' },
      scene: {
        nodes: [
          { ...client, chips: [{ text: 'item:7 100K/s', tone: 'warn' }] },
          { id: 'hotcache', kind: 'cache', at: p(-3.5, 4.5), label: 'hot-key cache', sub: 'TTL 1 s', status: 'ok' },
          { ...B, status: 'hot', load: 96, chips: ['item:7'] },
          { ...C, status: 'hot', load: 94 },
          { ...D, status: 'hot', load: 95 },
        ],
        links: [link('client', 'hotcache'), link('hotcache', 'B', { label: '1 in 100 misses' }), link('B', 'C', { style: 'faint' }), link('B', 'D', { style: 'faint' })],
        flows: [
          { path: ['client', 'hotcache'], tone: 'request', label: 'get item:7', count: 4, duration: 1.2 },
          { path: ['hotcache', 'B'], tone: 'request', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'One key, three nodes',
          icon: 'Gauge',
          rows: [
            { text: 'Reads on item:7', value: '100K/s' },
            { text: 'Replica reads, R = 2', value: '200K/s on 3 nodes', tone: 'bad' },
            { text: 'Cache in front', value: 'absorbs ~99%', tone: 'good' },
            { text: 'Split key item:7#0..7', value: '8 sets of nodes', tone: 'good' },
            { text: 'Cost', value: 'stale for the TTL', tone: 'warn' },
          ],
        },
        caption: 'The ring balances keys, not traffic',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Every failure mode has its own repair',
      eli5: 'Two kids edit one page, and the notebook keeps both until someone combines them. Sticky notes cover short absences and chapter summaries fix long ones. That is a **key-value store** that keeps writing.',
      body: [
        'Concurrent writes are kept as siblings with **version vectors** and merged by the app, with tombstones for deletes. Each node writes to a **commit log** and **memtable**, flushes **SSTables**, compacts them and reads through bloom filters.',
        '**Gossip** tracks membership, **hinted handoff** covers short outages, **Merkle tree** repair fixes long ones, and a dead node is replaced by streaming from survivors. Joins and leaves stream arcs the same way, and hot keys need a cache or split keys on top of the ring.',
      ],
      keyIdea: 'Every node does the same job, so any node can fail. Each failure mode gets its own repair mechanism.',
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
          title: 'Failure, then repair',
          icon: 'Shield',
          rows: [
            { text: 'Concurrent writes', value: 'version vectors' },
            { text: 'Stale copy on read', value: 'read repair' },
            { text: 'Short outage', value: 'hinted handoff' },
            { text: 'Long outage', value: 'Merkle repair' },
            { text: 'Dead node', value: 'stream from survivors' },
            { text: 'Hot key', value: 'cache or split key' },
          ],
        },
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
