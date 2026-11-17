import type { Lesson, SceneLink, SceneNode, Tint } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const blk = (id: string, d: number, s: number, label: string, icon: string, tint: Tint, extra: Partial<SceneNode> = {}): SceneNode => ({
  id, kind: 'block', at: at(d, s), label, icon, tint, ...extra,
});
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const orders = blk('orders', -5.7, 0, 'orders', 'ShoppingBag', 'amber', { sub: 'producer' });
const stock = blk('stock', 5.7, 0, 'inventory', 'Package', 'green', { size: 0.72 });
const broker: SceneNode = { id: 'broker', kind: 'queue', at: at(-1.9, 0), label: 'event broker', sub: 'topic: orders' };
const browser: SceneNode = { id: 'browser', kind: 'client', at: at(-5.7, 0), label: 'browser' };

// Pipes and filters
const inbox: SceneNode = { id: 'inbox', kind: 'storage', at: at(-5, 0), label: 'uploads', sub: 'raw video' };
const probe = blk('probe', -2.5, 0, 'validate', 'Shield', 'blue', { size: 0.72 });
const transcode = blk('transcode', 0, 0, 'transcode', 'Cpu', 'amber', { size: 0.72, sub: '1080p, 720p' });
const thumbs = blk('thumbs', 2.5, 0, 'thumbnails', 'Star', 'green', { size: 0.72 });
const outbox: SceneNode = { id: 'outbox', kind: 'storage', at: at(5, 0), label: 'published' };

// Peer-to-peer
const p1: SceneNode = { id: 'p1', kind: 'client', at: at(-4, 0), label: 'peer A' };
const p2: SceneNode = { id: 'p2', kind: 'client', at: at(0, -3.6), label: 'peer B' };
const p3: SceneNode = { id: 'p3', kind: 'client', at: at(4, 0), label: 'peer C' };
const p4: SceneNode = { id: 'p4', kind: 'client', at: at(0, 3.6), label: 'peer D' };
const peerLinks = [link('p1', 'p2'), link('p2', 'p3'), link('p3', 'p4'), link('p4', 'p1')];

// Hexagonal
const shopper: SceneNode = { id: 'shopper', kind: 'client', at: at(-6.5, 0), label: 'shopper' };
const rest = blk('rest', -3.3, 0, 'REST adapter', 'Plug', 'blue', { size: 0.72 });
const core = blk('core', 0, 0, 'order core', 'Cpu', 'violet', { sub: 'no framework imports' });
const sqlAd: SceneNode = { id: 'sqlAd', kind: 'db', at: at(4, -3.4), label: 'Postgres adapter' };
const payAd = blk('payAd', 4, 3.4, 'card adapter', 'Receipt', 'amber', { size: 0.72, sub: 'payment provider' });
const fakes = blk('fakes', -3.5, 3.8, 'test fakes', 'Bug', 'green', { size: 0.72, sub: 'in-memory' });


export const architecturalStylesPart2: Lesson = {
  id: 'architectural-styles-part-2',
  title: 'Architectural styles (part 2)',
  tagline: 'Pipes and filters, peer-to-peer, hexagonal and microkernel, then how to mix styles and choose between them.',
  minutes: 14,
  level: 'Intermediate',
  learn: [
    'Pipes and filters for staged data processing, with back pressure and dead letters',
    'Peer-to-peer systems, structured and unstructured, and hybrids',
    'Hexagonal architecture (ports and adapters) and the microkernel plug-in shape',
    'How styles mix in one system, and how to choose',
  ],
  metrics: [
    { key: 'style', label: 'Style', icon: 'Layers' },
    { key: 'optimizes', label: 'Optimizes for', icon: 'Gauge' },
    { key: 'coupling', label: 'Coupling', icon: 'Plug' },
    { key: 'scales', label: 'Scales by', icon: 'TrendingUp' },
  ],
  steps: [
    {
      title: 'Beyond three',
      tag: 'problem',
      heading: 'Some work does not fit a counter, a kitchen and a notice board',
      eli5: 'The town also washes cars in a line, lends tools over fences and plugs different ovens into one kitchen. The bakery counter alone cannot describe any of that.',
      body: [
        'A video platform must process uploads in stages. A file-sharing app has no central server at all. A checkout service needs rules that survive a change of database or payment provider.',
        'None of these is well described by client-server, layers or events alone. They need other shapes.',
      ],
      keyIdea: 'Staged processing, crowds without a center, and swappable infrastructure each need their own style.',
      metrics: { style: '?', optimizes: '?', coupling: '?', scales: '?' },
      metricTones: { style: 'bad' },
      scene: {
        nodes: [
          { ...inbox, chips: ['raw.mov'] },
          { ...p1, at: at(0, -4.2), chips: ['no server?'] },
          { ...core, status: 'hot', badge: 'knows Postgres', at: at(4.5, 0) },
        ],
        links: [],
        flows: [],
        panel: {
          title: 'Three problems',
          icon: 'List',
          rows: [
            { text: 'Uploads', value: 'many stages', tone: 'warn' },
            { text: 'File sharing', value: 'no central server', tone: 'warn' },
            { text: 'Checkout rules', value: 'glued to the DB', tone: 'warn' },
          ],
        },
        caption: 'Three jobs, no matching shape yet',
      },
    },
    {
      title: 'Pipes and filters',
      tag: 'concept',
      heading: 'Pipes and filters: a line of single-purpose stages',
      eli5: 'The town **car wash** is a line of stations: soap, brushes, rinse, dryer. Each station does one job and passes the car on. Add a wax station, and nobody else changes.',
      body: [
        'In **pipes and filters**, data flows through a chain of stages. Each **filter** reads input, does one transformation and writes output to a **pipe** that feeds the next stage.',
        'A filter knows nothing about who is before or after it, only the format it reads and writes.',
      ],
      keyIdea: 'Pipes and filters split processing into independent stages joined by a common format.',
      metrics: { style: 'pipes and filters', optimizes: 'throughput and reuse', coupling: 'data format only', scales: 'workers per stage' },
      scene: {
        nodes: [inbox, probe, transcode, thumbs, outbox],
        links: [link('inbox', 'probe'), link('probe', 'transcode'), link('transcode', 'thumbs'), link('thumbs', 'outbox')],
        flows: [
          { path: ['inbox', 'probe'], tone: 'data', label: 'raw.mov', duration: 1 },
          { path: ['probe', 'transcode'], tone: 'data', label: 'valid', duration: 1, delay: 1.1 },
          { path: ['transcode', 'thumbs'], tone: 'data', label: '3 renditions', duration: 1, delay: 2.2 },
          { path: ['thumbs', 'outbox'], tone: 'data', label: '+ thumbnails', duration: 1, delay: 3.3 },
        ],
        caption: 'Each stage does one job and hands off',
      },
      code: {
        language: 'bash',
        title: 'The oldest pipes and filters: a shell pipeline',
        source: `# Top 5 IPs hitting /checkout with 5xx errors in today's access log.
# Every command is a filter. Every | is a pipe.
cat access.log \\
  | grep ' /checkout ' \\
  | awk '$9 >= 500 { print $1 }' \\
  | sort \\
  | uniq -c \\
  | sort -rn \\
  | head -5

# Swap a stage without touching the others:
#   cat  ->  zcat access.log.gz     (read compressed logs)
#   head -5  ->  head -20           (show more)`,
        highlight: [3, 4, 5, 7, 9],
      },
    },
    {
      title: 'Scaling stages',
      tag: 'concept',
      heading: 'Each stage scales on its own',
      eli5: 'Soaking is quick but the dryer is slow, so the car wash buys more dryers and keeps one soap station. You buy more of only what is slow.',
      body: [
        'Put a queue between stages and each one scales alone. The slow transcode stage gets 40 workers, and the cheap validation stage gets 2.',
        'Unix pipelines, ETL jobs and stream processors all use this shape.',
      ],
      keyIdea: 'Queues between stages let you add workers exactly where the bottleneck is.',
      metrics: { style: 'pipes and filters', optimizes: 'throughput', coupling: 'data format only', scales: 'workers per stage' },
      metricTones: { scales: 'good' },
      scene: {
        nodes: [
          { ...probe, chips: ['2 workers'], load: 30 },
          { ...transcode, status: 'hot', load: 92, chips: [{ text: '40 workers', tone: 'good' }] },
          { ...thumbs, chips: ['4 workers'], load: 45 },
        ],
        links: [link('probe', 'transcode', { label: 'queue' }), link('transcode', 'thumbs', { label: 'queue' })],
        flows: [
          { path: ['probe', 'transcode'], tone: 'data', count: 2, duration: 1.2 },
          { path: ['transcode', 'thumbs'], tone: 'data', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Workers per stage',
          icon: 'Cpu',
          rows: [
            { text: 'validate', value: '2', tone: 'good' },
            { text: 'transcode', value: '40', tone: 'warn' },
            { text: 'thumbnails', value: '4', tone: 'good' },
          ],
          footer: { text: 'Spend where the line is slow', tone: 'muted' },
        },
        caption: 'Workers go where the slow stage is',
      },
    },
    {
      title: 'Pipe latency',
      tag: 'tradeoff',
      heading: 'End-to-end time is the sum of every stage',
      eli5: 'A car goes through every station, so a car wash always takes a few minutes, even when each station is quick.',
      body: [
        'Pipes and filters fit badly with interactive request and response, because end-to-end time is the sum of every stage plus the waits in the queues between them.',
        'The style is built for throughput: many files per hour, each one slow.',
      ],
      keyIdea: 'The style is built for throughput, so expect high latency for each single item.',
      metrics: { style: 'pipes and filters', optimizes: 'throughput', coupling: 'data format only', scales: 'workers per stage' },
      metricTones: { optimizes: 'good' },
      scene: {
        nodes: [
          { ...probe, chips: ['1 s'] },
          { ...transcode, chips: [{ text: '90 s', tone: 'warn' }] },
          { ...thumbs, chips: ['4 s'] },
        ],
        links: [link('probe', 'transcode', { label: 'queue' }), link('transcode', 'thumbs', { label: 'queue' })],
        flows: [
          { path: ['probe', 'transcode'], tone: 'data', duration: 1.2 },
          { path: ['transcode', 'thumbs'], tone: 'data', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'End-to-end time',
          icon: 'Timer',
          rows: [
            { text: 'validate', value: '1 s' },
            { text: 'transcode', value: '90 s', tone: 'warn' },
            { text: 'thumbnails', value: '4 s' },
          ],
          footer: { text: 'Sum: 95 s, fine for upload, bad for a page load', tone: 'warn' },
        },
        caption: 'Each stage adds to the wait',
      },
    },
    {
      title: 'Pipe failures',
      tag: 'tradeoff',
      heading: 'Bad records go aside, and a full queue pushes back',
      eli5: 'One broken car cannot clog the line, so it is pulled out to a side bay for a mechanic. If the dryer queue is full, the front of the line is told to wait.',
      body: [
        'A bad record halfway down the line goes to a **dead-letter** place, so one corrupt file does not block the rest. Someone inspects it later.',
        'A full queue must slow its producer. That is **back pressure**, and it keeps memory from blowing up.',
      ],
      keyIdea: 'Plan for failure: dead letters for bad records, and back pressure from a full queue to its producer.',
      metrics: { style: 'pipes and filters', optimizes: 'throughput', coupling: 'data format only', scales: 'workers per stage' },
      scene: {
        nodes: [
          { ...probe, at: at(-3.6, -1.8) },
          { ...transcode, at: at(0, 1.8), status: 'hot', load: 92, badge: 'queue full' },
          blk('dead', 3.6, 4.4, 'dead letters', 'Inbox', 'red', { size: 0.72, badge: '3 bad files' }),
        ],
        links: [
          link('probe', 'transcode', { label: 'queue' }),
          link('transcode', 'probe', { label: 'back pressure', labelTone: 'warn', style: 'dashed' }),
          link('transcode', 'dead', { style: 'dashed' }),
        ],
        flows: [
          { path: ['probe', 'transcode'], tone: 'data', duration: 1.4 },
          { path: ['transcode', 'probe'], tone: 'error', label: 'slow down', duration: 1.4, delay: 1.5 },
          { path: ['transcode', 'dead'], tone: 'error', label: 'corrupt.mov', duration: 1.2, delay: 3 },
        ],
        caption: 'Bad records leave the line, slow stages push back',
      },
    },
    {
      title: 'Peer-to-peer',
      tag: 'concept',
      heading: 'Peer-to-peer: everyone is both client and server',
      eli5: 'Neighbors lend each other tools over the fence. There is no tool shop. If you have a ladder you lend it, and if you need a drill you borrow one from whoever has it.',
      body: [
        'In **peer-to-peer**, every node can request and serve. BitTorrent splits a file into pieces. Each peer downloads pieces from several others and uploads the pieces it already has.',
        'A popular file gets faster as more people want it.',
      ],
      keyIdea: 'Peer-to-peer removes the central server, so capacity grows with every member.',
      metrics: { style: 'peer-to-peer', optimizes: 'no central bottleneck', coupling: 'shared protocol', scales: 'every new peer adds capacity' },
      metricTones: { scales: 'good' },
      scene: {
        nodes: [
          { ...p1, chips: ['has pieces 1-40'] },
          p2,
          { ...p3, status: 'active', chips: ['needs piece 17'] },
          p4,
        ],
        links: peerLinks,
        flows: [
          { path: ['p1', 'p2', 'p3'], tone: 'data', label: 'piece 17', duration: 1.6 },
          { path: ['p4', 'p3'], tone: 'data', label: 'piece 18', duration: 1.2, delay: 0.6 },
          { path: ['p3', 'p4'], tone: 'data', label: 'piece 2', duration: 1.2, delay: 1.8 },
        ],
        caption: 'Every peer downloads and uploads at once',
      },
    },
    {
      title: 'Finding peers',
      tag: 'concept',
      heading: 'Finding content without a central index',
      eli5: 'If there is no tool shop, how do you know who has a drill? You ask the neighbors, or you use a notice at the gate that lists who owns what.',
      body: [
        '**Unstructured** networks flood a query to neighbors, which works but gets noisy as the network grows. **Hybrid** systems keep a small central piece, drawn here as a tracker, only to help peers find each other.',
        'A third answer, the distributed hash table, comes next.',
      ],
      keyIdea: 'Discovery is the hard part. Flooding, a small tracker and a hash table are the common answers.',
      metrics: { style: 'peer-to-peer', optimizes: 'no central bottleneck', coupling: 'shared protocol', scales: 'every new peer adds capacity' },
      scene: {
        nodes: [
          blk('tracker', 0, -3.6, 'tracker', 'Search', 'gray', { size: 0.72, sub: 'who has what' }),
          { ...p1, at: at(-3.6, 2.4) },
          { ...p3, at: at(3.6, 2.4), status: 'active' },
        ],
        links: [link('p1', 'tracker', { style: 'dashed' }), link('p3', 'tracker', { style: 'dashed' }), link('p1', 'p3')],
        flows: [
          { path: ['p3', 'tracker'], tone: 'request', label: 'who has it?', duration: 1.2 },
          { path: ['tracker', 'p3'], tone: 'response', label: 'peer A', duration: 1.2, delay: 1.3 },
          { path: ['p1', 'p3'], tone: 'data', label: 'pieces', duration: 1.4, delay: 2.6 },
        ],
        panel: {
          title: 'Discovery options',
          icon: 'Search',
          rows: [
            { text: 'Unstructured', value: 'flood the neighbors' },
            { text: 'Structured (DHT)', value: 'next step', tone: 'good' },
            { text: 'Hybrid', value: 'small central tracker', tone: 'good' },
          ],
        },
        caption: 'A tiny index helps peers meet',
      },
    },
    {
      title: 'DHT lookup',
      tag: 'concept',
      heading: 'A hash table spread across the peers',
      eli5: 'Every neighbor looks after one street of the town directory. To find who has a drill, you work out which street it is filed under and ask that neighbor.',
      body: [
        'In a **distributed hash table** (DHT), the key space is split among peers. `hash(song.mp3)` gives 170, and the peer that owns 128 to 191 holds the answer.',
        'Each peer knows a few others and every hop gets closer to the key, so a lookup takes about log2 of the peer count in hops.',
      ],
      keyIdea: 'A DHT maps hash(key) to the peer that owns it in a few hops, with no central index.',
      metrics: { style: 'peer-to-peer', optimizes: 'no central bottleneck', coupling: 'shared protocol', scales: 'lookups in log N hops' },
      metricTones: { scales: 'good' },
      scene: {
        nodes: [
          { ...p1, sub: 'owns 0-63', status: 'active', chips: ['hash = 170'] },
          { ...p2, sub: 'owns 64-127' },
          { ...p3, sub: 'owns 128-191', status: 'ok' },
          { ...p4, sub: 'owns 192-255' },
        ],
        links: peerLinks,
        flows: [
          { path: ['p1', 'p2'], tone: 'request', label: 'who owns 170?', duration: 1.2 },
          { path: ['p2', 'p3'], tone: 'request', label: 'closer: ask C', duration: 1.2, delay: 1.3 },
          { path: ['p3', 'p1'], tone: 'response', label: 'I have it', duration: 1.6, delay: 2.6 },
        ],
        panel: {
          title: 'Lookup for song.mp3',
          icon: 'Hash',
          rows: [
            { text: 'hash(song.mp3)', value: '170' },
            { text: 'Range 128-191', value: 'peer C owns it', tone: 'good' },
            { text: 'Hops', value: 'about log2 of peers' },
          ],
        },
        caption: 'The hash picks the peer, a few hops find it',
      },
    },
    {
      title: 'Peer trust',
      tag: 'tradeoff',
      heading: 'No boss means trust and consistency are yours to solve',
      eli5: 'A neighbor might lend you a bent ladder, or never give it back. Without a shop owner you check every tool yourself.',
      body: [
        'Peers come and go, some are slow, and some may lie, so data must be verified, usually with hashes. A piece that fails its hash is dropped and fetched again from another peer.',
        'With no coordinator, peers can also hold different copies for a while, so expect weaker consistency.',
      ],
      keyIdea: 'Peer-to-peer gives up control: verify what peers send, and expect churn and weaker consistency.',
      metrics: { style: 'peer-to-peer', optimizes: 'no central bottleneck', coupling: 'shared protocol', scales: 'every new peer adds capacity' },
      metricTones: { coupling: 'warn' },
      scene: {
        nodes: [
          { ...p1, status: 'ok' },
          { ...p2, status: 'down', badge: 'left' },
          { ...p3, status: 'active', chips: [{ text: 'hash mismatch', tone: 'bad' }] },
          { ...p4, status: 'hot', badge: 'sends bad data' },
        ],
        links: peerLinks,
        flows: [
          { path: ['p1', 'p4'], tone: 'data', label: 'piece 2', duration: 1.2 },
          { path: ['p4', 'p3'], tone: 'error', label: 'bad piece', duration: 1.4, delay: 1.3 },
        ],
        panel: {
          title: 'Checks every peer runs',
          icon: 'Hash',
          rows: [
            { text: 'Piece hash', value: 'matches the manifest', tone: 'good' },
            { text: 'Bad sender', value: 'drop and re-fetch', tone: 'warn' },
            { text: 'Peer gone', value: 'ask another', tone: 'warn' },
          ],
        },
        caption: 'Verify every piece, peers come and go',
      },
    },
    {
      title: 'Gossip',
      tag: 'case',
      heading: 'Case: Cassandra nodes as equal peers',
      eli5: 'Every neighbor tells two others what they know, such as who moved away. Soon the whole street knows, and nobody needed a town crier.',
      body: [
        'Cassandra uses the peer idea inside a datacenter: every node is an equal peer with no leader. Each node regularly tells a few random neighbors which nodes are up, and **gossip** spreads that news through the cluster in seconds.',
        'Data is copied to several peers, so reads can briefly disagree until the copies catch up.',
      ],
      keyIdea: 'Gossip spreads cluster state with no leader, and the price is copies that agree a little later.',
      metrics: { style: 'peer-to-peer', optimizes: 'no single leader', coupling: 'shared protocol', scales: 'every new node adds capacity' },
      scene: {
        nodes: [
          { ...p1, label: 'node 1', status: 'ok' },
          { ...p2, label: 'node 2', status: 'ok' },
          { ...p3, label: 'node 3', status: 'ok' },
          { ...p4, label: 'node 4', status: 'down', badge: 'crashed' },
        ],
        links: peerLinks,
        flows: [
          { path: ['p3', 'p2'], tone: 'handshake', label: 'node 4 is down', duration: 1.2 },
          { path: ['p2', 'p1'], tone: 'handshake', label: 'node 4 is down', duration: 1.2, delay: 1.3 },
        ],
        caption: 'News of a crash spreads node to node',
      },
    },
    {
      title: 'Hexagonal',
      tag: 'concept',
      heading: 'Hexagonal: business rules in the middle, plugs on the edge',
      eli5: 'The bakery kitchen has standard **plug sockets**. Any oven, mixer or test lamp that fits the socket works. Swap the oven brand, and the recipes do not change at all.',
      body: [
        '**Hexagonal architecture**, also called **ports and adapters**, puts the business rules in a core that imports no web framework, database driver or vendor SDK.',
        'The core declares **ports**: interfaces in its own words, such as `OrderStore` or `Payments`. **Adapters** on the edge implement them.',
      ],
      keyIdea: 'The core owns the rules and names the ports. Adapters plug into the ports.',
      metrics: { style: 'hexagonal', optimizes: 'testable core', coupling: 'adapters depend on core', scales: 'copies of the whole app' },
      scene: {
        nodes: [shopper, rest, { ...core, status: 'active' }, sqlAd, payAd],
        links: [
          link('shopper', 'rest'),
          link('rest', 'core', { label: 'driving port' }),
          link('core', 'sqlAd', { label: 'OrderStore port' }),
          link('core', 'payAd', { label: 'Payments port' }),
        ],
        flows: [
          { path: ['shopper', 'rest', 'core'], tone: 'request', label: 'place order', duration: 1.6 },
          { path: ['core', 'payAd'], tone: 'request', label: 'Payments.charge', duration: 1, delay: 1.7 },
          { path: ['core', 'sqlAd'], tone: 'data', label: 'OrderStore.save', duration: 1, delay: 2.8 },
        ],
        caption: 'The core defines ports, the edges plug in',
      },
    },
    {
      title: 'Flipped dependency',
      tag: 'concept',
      heading: 'The dependency points inward',
      eli5: 'In the bakery, the recipe book does not say which oven to buy. The ovens are built to fit the recipe book. The recipe stays still when the oven changes.',
      body: [
        'Compared with layers, the dependency points the other way. The core does not depend on the database. The database adapter depends on the core’s interface. That is the whole trick.',
        'Adapters that call the core are **driving** (REST). Adapters the core calls are **driven** (Postgres, card provider).',
      ],
      keyIdea: 'Infrastructure depends on the core through ports, never the reverse.',
      metrics: { style: 'hexagonal', optimizes: 'testable core', coupling: 'adapters depend on core', scales: 'copies of the whole app' },
      metricTones: { coupling: 'good' },
      scene: {
        nodes: [
          { ...rest, label: 'REST adapter', sub: 'driving' },
          { ...core, status: 'active' },
          { ...sqlAd, sub: 'driven' },
        ],
        links: [
          link('rest', 'core', { label: 'depends on core', labelTone: 'default' }),
          link('sqlAd', 'core', { label: 'implements port', route: 'straight' }),
        ],
        flows: [
          { path: ['rest', 'core'], tone: 'request', duration: 1.4 },
          { path: ['core', 'sqlAd'], tone: 'data', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Who imports whom',
          icon: 'ArrowLeftRight',
          rows: [
            { text: 'Layered', value: 'rules import the DB', tone: 'warn' },
            { text: 'Hexagonal', value: 'DB adapter imports rules', tone: 'good' },
          ],
        },
        caption: 'Arrows point at the core',
      },
    },
    {
      title: 'Ports in code',
      tag: 'concept',
      heading: 'One port, a real adapter and a fake',
      eli5: 'The same plug socket takes the real oven on a normal day. For practice, you plug in a toy oven that is instant and safe.',
      body: [
        'Tests plug in-memory fakes into the same ports and run thousands of business-rule tests in seconds with no database. Moving to another payment provider is a new adapter.',
        'The cost is more interfaces and indirection, which is overhead for a simple CRUD app.',
      ],
      keyIdea: 'Hexagonal makes rules fast to test and infrastructure replaceable, at the price of extra indirection.',
      metrics: { style: 'hexagonal', optimizes: 'testable core', coupling: 'adapters depend on core', scales: 'copies of the whole app' },
      metricTones: { optimizes: 'good' },
      scene: {
        nodes: [
          { ...fakes, status: 'ok', badge: '2,000 tests in 4 s' },
          { ...core, status: 'active', at: at(0, -1) },
          { ...payAd, at: at(4, -1) },
        ],
        links: [link('fakes', 'core', { style: 'dashed', label: 'fakes plug in' }), link('core', 'payAd', { label: 'Payments port' })],
        flows: [
          { path: ['fakes', 'core'], tone: 'handshake', duration: 1.4 },
          { path: ['core', 'payAd'], tone: 'request', duration: 1.2, delay: 1.5 },
        ],
        panel: {
          title: 'Test run',
          icon: 'Bug',
          rows: [
            { text: 'With real Postgres', value: '12 min', tone: 'bad' },
            { text: 'With in-memory fakes', value: '4 s', tone: 'good' },
          ],
        },
        caption: 'Same port, a fake for tests',
      },
      code: {
        language: 'typescript',
        title: 'A port in the core, two adapters on the edge',
        source: `// core/ports.ts: the core's own words, no imports from pg or any SDK
export interface OrderStore {
  save(order: Order): Promise<void>;
  byId(id: string): Promise<Order | null>;
}

// core/placeOrder.ts: pure business rules
export async function placeOrder(store: OrderStore, cart: Cart): Promise<Order> {
  if (cart.items.length === 0) throw new EmptyCart();
  const order = Order.fromCart(cart);
  await store.save(order);
  return order;
}

// adapters/postgresOrderStore.ts: production
export class PostgresOrderStore implements OrderStore { /* SQL here */ }

// test/fakes.ts: same port, no database
export class InMemoryOrderStore implements OrderStore {
  private rows = new Map<string, Order>();
  async save(o: Order) { this.rows.set(o.id, o); }
  async byId(id: string) { return this.rows.get(id) ?? null; }
}`,
        highlight: [2, 8, 16, 19],
      },
      quiz: {
        question: 'In a hexagonal design, which way does the source-code dependency between the business core and the Postgres adapter point?',
        options: [
          'The core imports the Postgres adapter',
          'The Postgres adapter implements an interface owned by the core',
          'Both import a shared SQL library',
          'Neither depends on the other, and they never talk',
        ],
        answer: 1,
        explain: 'The core declares the OrderStore port. The adapter implements it, so the dependency points inward at the core.',
      },
    },
    {
      title: 'Microkernel',
      tag: 'concept',
      heading: 'Microkernel: a small core with plug-ins',
      eli5: 'The bakery has one basic oven and a rack of add-on trays: bagel tray, pie tray. The oven stays small, and you add what you need.',
      body: [
        'A **microkernel** (plug-in) style keeps a small stable core and puts features in plug-ins loaded at the edge. IDEs, browsers with extensions and build tools work this way.',
        'It optimizes for extensibility. The cost is a plug-in contract that is hard to change once others depend on it.',
      ],
      keyIdea: 'Microkernel keeps the core small and lets plug-ins add features. The plug-in interface becomes a long-lived promise.',
      metrics: { style: 'microkernel', optimizes: 'extensibility', coupling: 'plug-in contract', scales: 'more plug-ins' },
      scene: {
        nodes: [
          blk('kernel', 0, 0, 'editor core', 'Cpu', 'violet', { sub: 'small, stable' }),
          blk('lint', -3.6, -3.4, 'linter', 'Bug', 'green', { size: 0.72 }),
          blk('theme', 3.6, -3.4, 'themes', 'Star', 'amber', { size: 0.72 }),
          blk('git', 0, 5, 'git plug-in', 'Code', 'blue', { size: 0.72 }),
        ],
        links: [link('lint', 'kernel', { style: 'dashed' }), link('theme', 'kernel', { style: 'dashed' }), link('git', 'kernel', { style: 'dashed' })],
        flows: [
          { path: ['lint', 'kernel'], tone: 'handshake', duration: 1.2 },
          { path: ['git', 'kernel'], tone: 'handshake', duration: 1.2, delay: 0.5 },
          { path: ['theme', 'kernel'], tone: 'handshake', duration: 1.2, delay: 1 },
        ],
        caption: 'The core is small, features plug in',
      },
    },
    {
      title: 'Style vs deployment',
      tag: 'concept',
      heading: 'A style is not a deployment unit',
      eli5: 'Whether the bakery has one shop or ten branches is a separate question from how the rooms inside are arranged. The room layout can be the same in both.',
      body: [
        'A **monolith** ships as one deployable. **Microservices** ship as many. Both can be layered, hexagonal or event-driven inside. The next lessons cover when to split.',
        'Do not confuse "layered" (code structure) with "3-tier" (runtime boundaries).',
      ],
      keyIdea: 'Styles describe structure and connections. How many deployables you ship is a separate decision.',
      metrics: { style: 'any', optimizes: 'varies', coupling: 'varies', scales: 'varies' },
      scene: {
        nodes: [
          blk('mono', -3.2, 0, 'monolith', 'Boxes', 'gray', { sub: 'layered inside' }),
          blk('s1', 3.2, -3.4, 'orders', 'ShoppingBag', 'amber', { size: 0.72, sub: 'hexagonal inside' }),
          blk('s2', 3.2, 3.4, 'catalog', 'Package', 'green', { size: 0.72, sub: 'layered inside' }),
        ],
        links: [link('s1', 's2', { style: 'dashed', arrow: 'both' })],
        flows: [{ path: ['s1', 's2'], tone: 'event', duration: 1.6 }],
        panel: {
          title: 'Two separate questions',
          icon: 'Split',
          rows: [
            { text: 'Inside a unit', value: 'which style?' },
            { text: 'How many units', value: 'one or many?' },
          ],
          footer: { text: 'Answer them separately', tone: 'muted' },
        },
        caption: 'Any style fits one unit or many',
      },
    },
    {
      title: 'Mixed styles',
      tag: 'case',
      heading: 'Case: one shop, five styles at once',
      eli5: 'Our town runs a bakery counter, plug sockets in the kitchen, a notice board, a car wash and neighbors lending tools. Five shapes in one town, each where it fits.',
      body: [
        'Browsers and phones talk to the shop as **client-server**. The checkout service is **hexagonal** inside, so its pricing rules have fast tests. It reads shopper sessions from a cluster of equal gossiping nodes, a small **peer-to-peer** piece, and publishes `OrderPlaced` for **event-driven** reactions.',
        'Product videos run separately: uploads feed a **pipes and filters** chain that checkout never calls.',
      ],
      keyIdea: 'Real systems combine styles. Pick one per part, based on what that part needs.',
      metrics: { style: 'mixed', optimizes: 'per part', coupling: 'varies', scales: 'per part' },
      scene: {
        nodes: [
          { ...browser, at: at(-4.5, -3), sub: 'client-server' },
          blk('checkout', -1, -3, 'checkout', 'ShoppingBag', 'amber', { sub: 'hexagonal inside' }),
          { id: 'bus', kind: 'queue', at: at(3, -3), label: 'event broker', sub: 'event-driven' },
          blk('video', -2, 3.4, 'video workers', 'Cpu', 'blue', { size: 0.72, sub: 'pipes and filters', chips: ['fed by uploads'] }),
          { id: 'sess', kind: 'cache', at: at(3, 3.4), label: 'session cluster', sub: 'peer nodes' },
        ],
        links: [
          link('browser', 'checkout'),
          link('checkout', 'bus', { style: 'dashed' }),
          link('checkout', 'sess'),
        ],
        flows: [
          { path: ['browser', 'checkout'], tone: 'request', label: 'checkout', duration: 1.1 },
          { path: ['checkout', 'bus'], tone: 'event', label: 'OrderPlaced', duration: 1.1, delay: 1.2 },
          { path: ['checkout', 'sess'], tone: 'data', label: 'read session', duration: 1.4, delay: 0.6 },
        ],
        caption: 'Each part uses its own style, video runs on its own',
      },
    },
    {
      title: 'Choosing',
      tag: 'tradeoff',
      heading: 'What each style buys and what it costs',
      eli5: 'Each part of town is shaped for its job. The bakery wants one tidy counter, the car wash wants a line, and the notice board wants anyone to read it. Pick the shape for the job.',
      body: [
        '**Client-server** and **layered** buy simplicity and control, and cost a central bottleneck and cross-cutting features. **Event-driven** buys loose coupling, and costs visibility and consistency. **Pipes and filters** buys throughput, and costs latency.',
        '**Peer-to-peer** buys growing capacity, and costs trust and coordination. **Hexagonal** buys a testable core, and costs extra interfaces. **Microkernel** buys extensibility, and costs a rigid plug-in contract.',
      ],
      keyIdea: 'Every style is a trade: each buys one quality and charges for another.',
      metrics: { style: 'compare', optimizes: 'your top 2 qualities', coupling: 'varies', scales: 'varies' },
      scene: {
        nodes: [
          blk('cs', -3.6, -3.2, 'client-server', 'Server', 'violet', { size: 0.72 }),
          blk('ev', 3.6, -3.2, 'event-driven', 'Rss', 'amber', { size: 0.72 }),
          blk('pf', -3.6, 3.4, 'pipes and filters', 'Workflow', 'blue', { size: 0.72 }),
          blk('hx', 3.6, 3.4, 'hexagonal', 'Plug', 'green', { size: 0.72 }),
        ],
        links: [],
        flows: [],
        panel: {
          title: 'Buys and costs',
          icon: 'Scale',
          rows: [
            { text: 'Client-server', value: 'control / bottleneck' },
            { text: 'Event-driven', value: 'loose / hard to trace' },
            { text: 'Pipes and filters', value: 'throughput / latency' },
            { text: 'Peer-to-peer', value: 'capacity / trust' },
            { text: 'Hexagonal', value: 'testable / more interfaces' },
            { text: 'Microkernel', value: 'extensible / rigid plug-ins' },
          ],
        },
        caption: 'No style is free',
      },
    },
    {
      title: 'Pick two qualities',
      tag: 'tradeoff',
      heading: 'A habit for choosing',
      eli5: 'Before building a new room, the town asks what the room must be best at. Then it picks the shape that fits, and accepts the downsides.',
      body: [
        'Write down the two qualities this part must be best at, for example "easy to add new reactions" and "checkout stays fast". Then pick the style whose strengths match, and check that you can live with its costs.',
        'A quality such as "never lose an order" is a different job. Events only help there with a durable log, at-least-once delivery and an idempotent consumer.',
      ],
      keyIdea: 'Name the qualities a part most needs first, then accept the costs of the style that matches.',
      metrics: { style: 'choose', optimizes: 'your top 2 qualities', coupling: 'varies', scales: 'varies' },
      scene: {
        nodes: [
          { ...orders, status: 'active', chips: [{ text: 'add reactions easily', tone: 'good' }] },
          { ...broker },
          { ...stock, status: 'ok' },
        ],
        links: [link('orders', 'broker'), link('broker', 'stock', { style: 'dashed' })],
        flows: [
          { path: ['orders', 'broker'], tone: 'event', label: 'OrderPlaced', duration: 1.1 },
          { path: ['broker', 'stock'], tone: 'event', duration: 1, delay: 1.2 },
        ],
        panel: {
          title: 'Order service',
          icon: 'Gauge',
          rows: [
            { text: 'Quality 1', value: 'easy to add reactions', tone: 'good' },
            { text: 'Quality 2', value: 'checkout stays fast', tone: 'good' },
            { text: 'Style that fits', value: 'event-driven', tone: 'good' },
            { text: 'Accepted cost', value: 'duplicates, harder to trace', tone: 'warn' },
          ],
        },
        caption: 'Name the qualities first, then pick the shape',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Shapes, each with a job',
      eli5: 'Our town has a bakery counter, a kitchen behind it, a notice board, a car wash line, neighbors who share, and plug sockets for any oven. Each shape fits one kind of job.',
      body: [
        '**Client-server** centralizes data and rules. **Layered** splits code by role. **Event-driven** publishes facts for independent consumers. **Pipes and filters** chains stages. **Peer-to-peer** makes every node both client and server. **Hexagonal** plugs infrastructure into a core. **Microkernel** plugs features into a small core.',
        'Real systems combine them, one style per part.',
      ],
      keyIdea: 'Know the shapes well enough to spot and name them, then pick one per part for what that part must do best.',
      metrics: { style: 'all', optimizes: 'per part', coupling: 'varies', scales: 'varies' },
      scene: {
        nodes: [shopper, rest, { ...core, status: 'ok' }, sqlAd, payAd],
        links: [link('shopper', 'rest'), link('rest', 'core'), link('core', 'sqlAd'), link('core', 'payAd')],
        flows: [
          { path: ['shopper', 'rest', 'core', 'sqlAd'], tone: 'request', duration: 2.2 },
          { path: ['core', 'payAd'], tone: 'request', duration: 1, delay: 1.4 },
        ],
        caption: 'A core with plugs on the edge',
      },
      quiz: {
        question: 'A team wants to run thousands of pricing-rule tests in seconds without a database, and expects to change payment provider next year. Which style fits that part best?',
        options: ['Peer-to-peer', 'Pipes and filters', 'Hexagonal (ports and adapters)', 'Plain client-server'],
        answer: 2,
        explain: 'Hexagonal keeps the rules in a core that talks to storage and payments through ports. Tests plug in fakes, and a new payment provider is a new adapter.',
      },
    },
  ],
};
