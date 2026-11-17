import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const users: SceneNode = { id: 'users', kind: 'phone', at: at(-5.4, 0), label: '500M users', sub: 'daily active' };
const lb: SceneNode = { id: 'lb', kind: 'lb', at: at(-5.4, -6.4), label: 'load balancer' };
const app: SceneNode = { id: 'app', kind: 'server', at: at(-1.8, 0), label: 'app servers', sub: 'timeline API' };
const cache: SceneNode = { id: 'cache', kind: 'cache', at: at(1.8, 0), label: 'timeline cache', sub: 'Redis' };
const db: SceneNode = { id: 'db', kind: 'db', at: at(1.8, -6.4), label: 'tweet DB', sub: 'sharded by user_id' };
const media: SceneNode = { id: 'media', kind: 'storage', at: at(1.8, 6.4), label: 'media store', sub: 'object storage' };
const cdn: SceneNode = { id: 'cdn', kind: 'cdn', at: at(-1.8, 6.4), label: 'CDN', sub: 'edge caches' };

export const napkinMathPart2: Lesson = {
  id: 'napkin-math-part-2',
  title: 'Napkin math (part 2): servers, cache and case studies',
  tagline: 'Turn peak QPS into a server count, size the cache, then run the same sums for Instagram.',
  minutes: 14,
  level: 'Beginner',
  learn: [
    'A standard server shape and the throughput one node can handle',
    'How per-node throughput turns QPS into a server count',
    'Sizing a cache with the 80/20 rule',
    'The Twitter write path, shards and total fleet',
    'Instagram: same users, different shape, and what the biggest number tells you',
    'Rounding, sanity checks and what napkin math leaves out',
  ],
  metrics: [
    { key: 'dau', label: 'DAU', icon: 'Users' },
    { key: 'qps', label: 'Read QPS', icon: 'Activity' },
    { key: 'storage', label: 'Storage / yr', icon: 'HardDrive' },
    { key: 'bandwidth', label: 'Egress', icon: 'Download' },
    { key: 'servers', label: 'Servers', icon: 'Server' },
  ],
  steps: [
    {
      title: 'QPS to boxes',
      tag: 'problem',
      heading: 'We have 870K QPS. How many machines?',
      eli5: 'Back at the library, we know about 870,000 kids crowd in each second at the busiest time. Now we must decide how many librarians, the **app servers**, to hire for that crowd.',
      body: [
        'Part 1 ended with peak numbers: 870K reads per second, 3,500 writes per second. One server will not take that. Ten thousand servers would be a waste.',
        'To turn QPS into a count you need two things: what one box looks like, and how much traffic one box handles.',
      ],
      keyIdea: 'Server count needs a standard server and a per-node throughput. Both come from memorized tables.',
      metrics: { dau: '500M', qps: '870K peak', servers: '?' },
      metricTones: { qps: 'warn', servers: 'warn' },
      scene: {
        nodes: [users, { ...app, status: 'hot', load: 100, chips: [{ text: '870K reads/s', tone: 'bad' }] }, { id: 'boss', kind: 'block', at: at(-1.8, -7.6), label: 'manager', sub: 'how many boxes?', icon: 'User', tint: 'amber' }],
        links: [link('users', 'app', { label: '870K / s', labelTone: 'warn' }), link('boss', 'app', { style: 'dashed' })],
        flows: [{ path: ['users', 'app'], tone: 'request', count: 14, duration: 1.2 }],
        panel: {
          title: 'What we know',
          icon: 'Gauge',
          rows: [
            { text: 'Peak reads', value: '870K / s', tone: 'warn' },
            { text: 'Peak writes', value: '3,500 / s' },
            { text: 'One server handles', value: '?', tone: 'bad' },
          ],
        },
      },
    },
    {
      title: 'Standard box',
      tag: 'concept',
      heading: 'Pick one standard server and use it everywhere',
      eli5: 'Decide that every librarian has the same desk, the same stack of books and the same door. Then every sum uses the same size of librarian, and anyone can check your math.',
      body: [
        'A commodity node today has 16 to 32 cores, 64 to 128 GB of RAM, 1 to 2 TB of NVMe SSD and a 1 to 10 Gbps network card. A big node has 64 to 128 cores, up to 2 TB of RAM and 25 to 100 Gbps.',
        'In an interview, default to **32 cores, 128 GB RAM, 2 TB SSD and 1 Gbps** for every server. It keeps your arithmetic consistent and easy to check.',
      ],
      keyIdea: 'Use one standard box and say so. Consistency matters more than precision.',
      scene: {
        nodes: [
          { id: 'cpu', kind: 'block', at: at(-5.1, 0), label: 'CPU', sub: '32 cores', icon: 'Cpu', tint: 'blue' },
          { id: 'ram', kind: 'block', at: at(-1.7, 0), label: 'RAM', sub: '128 GB', icon: 'Layers', tint: 'green' },
          { id: 'ssd', kind: 'block', at: at(1.7, 0), label: 'SSD', sub: '2 TB NVMe', icon: 'HardDrive', tint: 'amber' },
          { id: 'nic', kind: 'block', at: at(5.1, 0), label: 'network', sub: '1 Gbps', icon: 'Cable', tint: 'violet' },
        ],
        links: [link('cpu', 'ram', { route: 'straight', arrow: 'none' }), link('ram', 'ssd', { route: 'straight', arrow: 'none' }), link('ssd', 'nic', { route: 'straight', arrow: 'none' })],
        panel: {
          title: 'Server shapes',
          icon: 'Server',
          rows: [
            { text: 'CPU', value: '16 to 32 · big 64 to 128 cores' },
            { text: 'RAM', value: '64 to 128 GB · big up to 2 TB' },
            { text: 'SSD', value: '1 to 2 TB · big 8 to 30 TB' },
            { text: 'Network', value: '1 to 10 Gbps · big 25 to 100' },
          ],
          footer: { text: 'Default: 32 cores, 128 GB, 2 TB, 1 Gbps', tone: 'muted' },
        },
      },
    },
    {
      title: 'App throughput',
      tag: 'concept',
      heading: 'How much one node handles: app tier and SQL',
      eli5: 'A librarian can help only so many kids a second, and a shelf clerk fewer still. Knowing each helper\'s speed is what lets you divide the crowd into a number of helpers.',
      body: [
        'A REST or HTTP app server handles **1K to 10K QPS**, limited by CPU, heap and connections. A tight gRPC service reaches 10K to 50K. A SQL database does about **10K reads** and **5K writes** per second.',
        'Read the SQL line twice. One SQL box gives about 10K reads a second, not 100K and not 1M. "Postgres can handle it" fails for a million QPS. You need replicas or a different store.',
      ],
      keyIdea: 'One SQL box gives about 10K reads a second. A million QPS needs a different design.',
      scene: {
        nodes: [
          { ...app, status: 'active', chips: ['REST 1K to 10K QPS', 'gRPC 10K to 50K'] },
          { ...db, at: at(1.8, 0), status: 'hot', chips: [{ text: 'reads ~10K QPS', tone: 'warn' }, { text: 'writes ~5K QPS', tone: 'warn' }] },
          { ...cache, at: at(5.4, 0), chips: ['100K to 200K ops/s'] },
        ],
        links: [link('app', 'db', { route: 'straight' }), link('db', 'cache', { route: 'straight', style: 'dashed' })],
        panel: {
          title: 'Per-node throughput',
          icon: 'Table',
          rows: [
            { text: 'REST / HTTP app server', value: '1K to 10K QPS' },
            { text: 'gRPC service', value: '10K to 50K QPS' },
            { text: 'SQL reads', value: '~10K QPS', tone: 'warn' },
            { text: 'SQL writes', value: '~5K QPS', tone: 'warn' },
            { text: 'Redis / Memcached', value: '100K to 200K ops/s', tone: 'good' },
          ],
        },
      },
    },
    {
      title: 'Store throughput',
      tag: 'concept',
      heading: 'How much one node handles: the other stores',
      eli5: 'Different helpers have different speeds. The mailroom clerk sorts a million letters a second, the person finding old books takes much longer. Pick the helper that matches the job.',
      body: [
        'Cassandra or DynamoDB nodes manage 10K to 50K ops per second, limited by compaction and the commit log. A Kafka broker moves about 1M small messages a second, limited by disk and NIC.',
        'An Elasticsearch shard does 1K to 5K QPS, limited by JVM heap. An S3 prefix allows 3,500 writes and 5,500 reads per second, so you spread keys across prefixes.',
      ],
      keyIdea: 'Each store has a different ceiling and a different bottleneck. Match the store to the load.',
      scene: {
        nodes: [
          { id: 'nosql', kind: 'shard', at: at(-5.1, 0), label: 'Cassandra', sub: '10K to 50K ops/s' },
          { id: 'kafka', kind: 'queue', at: at(-1.7, 0), label: 'Kafka broker', sub: '~1M msgs/s' },
          { id: 'es', kind: 'search', at: at(1.7, 0), label: 'Elasticsearch', sub: '1K to 5K QPS' },
          { id: 's3', kind: 'storage', at: at(5.1, 0), label: 'S3 prefix', sub: '3.5K writes · 5.5K reads' },
        ],
        panel: {
          title: 'More ceilings',
          icon: 'Gauge',
          rows: [
            { text: 'Cassandra / DynamoDB node', value: '10K to 50K ops/s' },
            { text: 'Kafka broker', value: '~1M msgs/s', tone: 'good' },
            { text: 'Elasticsearch shard', value: '1K to 5K QPS', tone: 'warn' },
            { text: 'S3 per prefix', value: '3,500 W · 5,500 R / s' },
          ],
          footer: { text: 'Bottlenecks: compaction, disk, JVM heap, partitions', tone: 'muted' },
        },
      },
    },
    {
      title: 'Server count',
      tag: 'concept',
      heading: 'Servers = peak QPS ÷ per-node QPS × 2',
      eli5: 'Take the busiest crowd, divide by how many kids one librarian can help, then double it in case half are out sick. That gives the number of **app servers**: about 200 librarians at the timeline desk.',
      body: [
        'Timeline reads: 870K ÷ 10K ≈ **87 nodes**. We use the top of the REST range because these are cheap, cache-backed lookups with small payloads. We use 2x headroom for simplicity: about 175, rounded up to **~200 timeline nodes**.',
        'The choice matters. At 2K per node the same formula gives about 870 nodes, so say which per-node figure you picked.',
      ],
      keyIdea: 'Servers = peak QPS ÷ what one node can do × 2. Run the same formula for every tier.',
      metrics: { dau: '500M', qps: '870K peak', servers: '~200 app' },
      scene: {
        nodes: [users, { ...lb, status: 'active' }, { ...app, badge: '~200 nodes', status: 'ok' }],
        links: [link('users', 'lb'), link('lb', 'app')],
        flows: [
          { path: ['users', 'lb', 'app'], tone: 'request', count: 4, duration: 1.8 },
          { path: ['app', 'lb', 'users'], tone: 'response', count: 4, duration: 1.8, delay: 1.9 },
        ],
        panel: {
          title: 'Timeline tier',
          icon: 'Server',
          rows: [
            { text: 'Peak reads', value: '870K / s' },
            { text: '÷ 10K per node', value: '87 nodes' },
            { text: '× 2 headroom', value: '175 nodes' },
            { text: 'Round up', value: '~200 nodes', tone: 'good' },
            { text: 'Sensitivity: 2K per node, 2x', value: '~870 nodes', tone: 'warn' },
          ],
        },
      },
    },
    {
      title: 'Cache 80/20',
      tag: 'concept',
      heading: 'Cache size: 20% of the table',
      eli5: 'Most kids ask for the same few popular books. Keep the popular fifth on the front desk and you answer most requests without walking to the back shelves. That front desk is the **cache**.',
      body: [
        'The **80/20 rule**: about 20% of keys serve 80% of traffic. Size your cache at 20% of the table. For a 1 TB table, a 200 GB cache catches most reads.',
        'The other 20% of 870K, about 174K reads a second, still reaches the database: roughly 17 SQL nodes at 10K each. The timeline cache holds nearly every active timeline, so its hit rate is far higher.',
      ],
      keyIdea: 'Cache size ≈ 20% of the table. The misses still load the database.',
      scene: {
        nodes: [app, { ...cache, status: 'active', badge: '200 GB' }, { ...db, at: at(1.8, -6.4), badge: '1 TB table' }],
        links: [link('app', 'cache', { label: '80% of reads' }), link('app', 'db', { style: 'dashed', label: '20%' })],
        flows: [
          { path: ['app', 'cache', 'app'], tone: 'request', count: 4, duration: 1.4 },
          { path: ['app', 'db'], tone: 'request', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'The 80/20 rule',
          icon: 'Scale',
          code: '1 TB table\n20% of keys = 80% of reads\ncache = 20% × 1 TB = 200 GB\n\nmiss load = 20% × 870K\n          ≈ 174K reads/s\n÷ 10K per SQL node ≈ 17',
        },
      },
    },
    {
      title: 'Timeline cache',
      tag: 'concept',
      heading: 'Sizing the timeline cache: 3.2 TB',
      eli5: 'Each of the 500 million kids gets a cubby holding 800 small slips, one per note they follow. Add up all the slips to see how big the cubby wall must be.',
      body: [
        'Timeline cache: 500M users × 800 cached tweet IDs × 8 bytes ≈ **3.2 TB**. At 100 GB of RAM per Redis node, that is about 32 nodes.',
        'Add replicas so a node failure does not empty the cache, and you land on **60+ nodes**.',
      ],
      keyIdea: 'Cache nodes = hot bytes ÷ RAM per node, doubled for replicas.',
      metrics: { dau: '500M', qps: '870K peak', servers: '~260' },
      scene: {
        nodes: [{ ...app, status: 'ok' }, { ...cache, status: 'active', badge: '3.2 TB · 60+ nodes' }, { ...db, status: 'ok' }],
        links: [link('app', 'cache'), link('app', 'db', { style: 'dashed' })],
        flows: [
          { path: ['app', 'cache'], tone: 'request', label: 'GET timeline', count: 3, duration: 1.4 },
          { path: ['cache', 'app'], tone: 'response', count: 3, duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Timeline cache math',
          icon: 'Database',
          code: '500M users\n× 800 tweet IDs × 8 B\n= 3.2 TB hot data\n÷ 100 GB per node = 32\n× 2 replicas = 60+ nodes',
        },
      },
    },
    {
      title: 'Write path',
      tag: 'concept',
      heading: 'The write path is the small part',
      eli5: 'Pinning new notes is easy work. A few clerks cover it. The extra clerks are there to copy each note into the cubbies of followers, and that copying is the real job.',
      body: [
        'The database takes 3,500 writes ÷ 5,000 per node, about 1 node. The load is fan-out: with 200 average followers, 3,500 × 200 = **700K timeline-cache writes a second**. At 10K per ingest node that is **~70 ingest nodes**.',
        'DB nodes follow data size. 540 TB ÷ 16 TB per storage-dense node ≈ 34, so **40 DB nodes**. On the standard 2 TB box it would be about 270.',
      ],
      keyIdea: 'Write throughput is rarely the limit here. Fan-out writes and data size set the node count.',
      metrics: { dau: '500M', qps: '870K peak', servers: '~370' },
      scene: {
        nodes: [users, { ...app, id: 'app', label: 'ingest nodes', sub: '~70', chips: [{ text: 'POST /tweet', tone: 'default' }] }, { ...db, at: at(1.8, 0), status: 'ok', badge: '40 nodes · 16 TB each' }],
        links: [link('users', 'app'), link('app', 'db')],
        flows: [{ path: ['users', 'app', 'db'], tone: 'event', label: '3,500/s', count: 2, duration: 2.2 }],
        panel: {
          title: 'Write path',
          icon: 'Database',
          rows: [
            { text: 'Peak writes', value: '3,500 / s' },
            { text: '÷ 5,000 per node', value: '~1 node', tone: 'good' },
            { text: 'Fan-out: 3,500 × 200 followers', value: '700K / s', tone: 'warn' },
            { text: '÷ 10K per ingest node', value: '~70 nodes', tone: 'warn' },
            { text: '540 TB ÷ 16 TB per node', value: '~34, use 40' },
          ],
        },
      },
    },
    {
      title: 'Whole fleet',
      tag: 'concept',
      heading: 'Adding up: about 370 servers',
      eli5: 'Add the librarians, the cubby wall and the shelf clerks, and the library needs roughly 370 helpers. That is a long way from one helper, and a long way from ten thousand.',
      body: [
        'Timeline nodes ~200, cache 60+, tweet database 40, ingest ~70. The whole system needs roughly **370 servers**.',
        'The same formula ran for every tier: peak load ÷ per-node capacity, with 2x headroom where it applies. The code below does the whole estimate.',
      ],
      keyIdea: 'Run one formula per tier, then add. About 370 servers puts the system between one box and ten thousand.',
      metrics: { dau: '500M', qps: '870K peak', storage: '~1.8 PB', bandwidth: '~350 Gbps', servers: '~370' },
      metricTones: { servers: 'good' },
      scene: {
        nodes: [
          users,
          { ...lb, status: 'ok' },
          { ...app, status: 'ok', badge: '~200 nodes' },
          { ...cache, badge: '60+ nodes' },
          { ...db, badge: '40 nodes' },
        ],
        links: [link('users', 'lb'), link('lb', 'app'), link('app', 'cache'), link('app', 'db')],
        flows: [
          { path: ['users', 'lb', 'app', 'cache'], tone: 'request', count: 4, duration: 1.8 },
          { path: ['cache', 'app', 'lb', 'users'], tone: 'response', count: 4, duration: 1.8, delay: 1.9 },
        ],
        panel: {
          title: 'Fleet total',
          icon: 'Server',
          rows: [
            { text: 'Timeline app', value: '~200' },
            { text: 'Timeline cache', value: '60+' },
            { text: 'Tweet DB', value: '40' },
            { text: 'Ingest and fan-out', value: '~70' },
            { text: 'Total', value: '~370', tone: 'good' },
          ],
        },
      },
      code: {
        language: 'python',
        title: 'The whole estimate in code',
        source: `DAY = 86_400                      # ~10^5 seconds

dau, reads_per_user, posts_per_user = 500e6, 50, 0.2
followers, tweet_bytes, peak_factor = 200, 1_000, 3
app_qps, ingest_qps = 10_000, 10_000   # per node
cache_gb, db_tb = 100, 16              # RAM / disk per node

read_qps    = dau * reads_per_user / DAY          # ~290K
write_qps   = dau * posts_per_user / DAY          # ~1,150
peak_reads  = read_qps * peak_factor              # ~870K
peak_writes = write_qps * peak_factor             # ~3,500

text_tb_yr   = dau * posts_per_user * 365 * tweet_bytes / 1e12
app_nodes    = peak_reads / app_qps * 2           # x2 for headroom
cache_nodes  = dau * 800 * 8 / 1e9 / cache_gb * 2 # 3.2 TB, 2 replicas
db_nodes     = text_tb_yr * 5 * 3 / db_tb         # 540 TB / 16 TB
ingest_nodes = peak_writes * followers / ingest_qps
total = app_nodes + cache_nodes + db_nodes + ingest_nodes

print(f"peak reads {peak_reads:,.0f}/s, writes {peak_writes:,.0f}/s")
print(f"app {app_nodes:.0f}, cache {cache_nodes:.0f}, db {db_nodes:.0f}, ingest {ingest_nodes:.0f}")
print(f"total {total:.0f} servers")`,
        highlight: [14, 15, 16, 17, 18],
      },
    },
    {
      title: 'Instagram',
      tag: 'case',
      heading: 'Case: same users, different shape',
      eli5: 'A second library has just as many kids, but they mostly borrow giant picture posters. Before counting anything, ask how often a kid posts and how often a kid looks. The answers differ.',
      body: [
        'Run the formulas for Instagram with 500M DAU. Each user posts 0.1 times a day and views 20 feed items. Writes: 5 × 10⁷ posts a day, about **580 posts per second** and 1,750 at peak.',
        'Reads: 10¹⁰ feed views a day, about 115K per second average, **350K at peak**. That is fewer reads than Twitter.',
      ],
      keyIdea: 'Same DAU, different habits, different QPS. Redo the assumptions for each product.',
      metrics: { dau: '500M', qps: '350K peak' },
      scene: {
        nodes: [
          { ...users, label: '500M users', sub: 'Instagram' },
          { ...app, label: 'feed service', sub: 'metadata only', chips: [{ text: 'GET /feed', tone: 'default' }], badge: '350K reads/s' },
          { ...db, label: 'post DB', status: 'ok', badge: '580 writes/s' },
        ],
        links: [link('users', 'app'), link('app', 'db')],
        flows: [
          { path: ['users', 'app'], tone: 'request', count: 6, duration: 1.4 },
          { path: ['users', 'app', 'db'], tone: 'event', label: '580/s', duration: 2, delay: 0.7 },
        ],
        panel: {
          title: 'Instagram traffic',
          icon: 'Activity',
          rows: [
            { text: 'Posts / user / day', value: '0.1' },
            { text: 'Feed views / user / day', value: '20' },
            { text: 'Writes avg → peak', value: '580 → 1,750 / s' },
            { text: 'Reads avg → peak', value: '115K → 350K / s' },
          ],
        },
      },
    },
    {
      title: 'IG storage',
      tag: 'case',
      heading: 'Instagram storage: 135 PB a year',
      eli5: 'Posters are fat. Photos are 2 megabytes and reels are 20, so every day the media warehouse takes in 370 terabytes. The notes about each poster are a tiny extra cabinet.',
      body: [
        'Photos average 2 MB and reels 20 MB, with 30% of posts being reels. Photos: 70 TB a day. Reels: 300 TB a day. Uploads come to about **370 TB a day**, or **135 PB a year**.',
        'Five years with 3 copies is about 2 EB, so cost is the real constraint. Metadata is small: 9 × 10¹⁰ posts × 2 KB is 180 TB, and 540 TB with copies.',
      ],
      keyIdea: 'Compute each data type on its own. Media sets the storage bill.',
      metrics: { dau: '500M', qps: '350K peak', storage: '135 PB' },
      metricTones: { storage: 'bad' },
      scene: {
        nodes: [
          { ...app, label: 'feed service', sub: 'metadata only' },
          { ...db, label: 'post DB', status: 'ok', badge: '540 TB metadata' },
          { ...media, status: 'hot', badge: '370 TB / day' },
        ],
        links: [link('app', 'db'), link('app', 'media', { label: 'uploads' })],
        flows: [{ path: ['app', 'media'], tone: 'data', label: 'photo 2 MB · reel 20 MB', count: 3, duration: 1.8 }],
        panel: {
          title: 'Daily uploads',
          icon: 'HardDrive',
          code: 'photos: 5×10⁷ × 70% × 2 MB  = 70 TB\nreels:  5×10⁷ × 30% × 20 MB = 300 TB\ntotal:  370 TB a day\nyear:   370 × 365 ≈ 135 PB\n5 yr × 3 copies ≈ 2 EB',
        },
      },
    },
    {
      title: 'IG bandwidth',
      tag: 'case',
      heading: 'Instagram egress: 5.6 Tbps',
      eli5: 'Now the hard part is carrying posters out of the doors. The **CDN** booths near each home hand out almost all of them, and the library only restocks the few they lack.',
      body: [
        'Peak egress is 350K × 2 MB = 700 GB/s, about **5.6 Tbps**. We serve each feed photo at its stored 2 MB, and count reels as a separate video stream. No origin can push that. With a 95% CDN hit rate, origin traffic drops to about **280 Gbps**.',
        'Edge-cache the popular posts. The origin sees only the 5% of misses.',
      ],
      keyIdea: 'No origin serves terabits. The CDN hit rate decides whether the design is possible.',
      metrics: { dau: '500M', qps: '350K peak', storage: '135 PB', bandwidth: '5.6 Tbps' },
      metricTones: { bandwidth: 'bad' },
      scene: {
        nodes: [{ ...users, label: '500M users', sub: 'Instagram' }, { ...cdn, status: 'active', badge: '95% hit' }, { ...media, status: 'hot', badge: '280 Gbps origin' }],
        links: [link('users', 'cdn', { label: '5.6 Tbps', labelTone: 'warn' }), link('cdn', 'media', { style: 'dashed', label: '5% misses' })],
        flows: [
          { path: ['cdn', 'users'], tone: 'response', label: '2 MB photos', count: 8, duration: 1.2 },
          { path: ['media', 'cdn'], tone: 'data', label: '5% misses', duration: 1.8, delay: 0.6 },
        ],
        panel: {
          title: 'Egress at peak',
          icon: 'Globe',
          rows: [
            { text: 'Peak reads', value: '350K / s' },
            { text: '× 2 MB payload', value: '700 GB/s' },
            { text: 'In bits', value: '5.6 Tbps', tone: 'bad' },
            { text: 'Origin with 95% hits', value: '280 Gbps', tone: 'warn' },
          ],
        },
      },
      code: {
        language: 'python',
        title: 'Why Instagram needs a CDN',
        source: `peak_reads   = 350_000        # feed items per second
avg_payload  = 2e6            # bytes, one photo
cdn_hit_rate = 0.95

egress_bps = peak_reads * avg_payload * 8
origin_bps = egress_bps * (1 - cdn_hit_rate)

print(f"total  {egress_bps / 1e12:.1f} Tbps")   # 5.6 Tbps
print(f"origin {origin_bps / 1e9:.0f} Gbps")    # 280 Gbps`,
        highlight: [5, 6],
      },
    },
    {
      title: 'IG servers',
      tag: 'case',
      heading: 'Instagram servers: a media pipeline',
      eli5: 'Counting librarians for the feed desk is easy: 140. The extra work is the loading dock where posters arrive and the workshop that resizes them. The sums say this is a dock problem.',
      body: [
        'The feed service: 350K ÷ 5K per node = 70 nodes, 140 with headroom. We use 5K, half of Twitter\'s 10K, because each feed request assembles posts from several services. Uploads: 1,750 peak × 7.4 MB blended (70% photos at 2 MB, 30% reels at 20 MB) ≈ 13 GB/s, about 104 Gbps.',
        'That is roughly 100 upload nodes at 1 Gbps each, plus a separate transcoding fleet. The object store, about 2 EB, is managed (S3 or GCS), so cost is the constraint. This is a media pipeline problem.',
      ],
      keyIdea: 'Let the biggest number in your estimate pick the architecture.',
      metrics: { dau: '500M', qps: '350K peak', storage: '135 PB', bandwidth: '5.6 Tbps', servers: '140 feed' },
      scene: {
        nodes: [
          { ...users, label: '500M users', sub: 'Instagram' },
          { ...lb, at: at(-1.8, -7.6) },
          { ...app, label: 'feed service', sub: 'metadata only', status: 'ok', badge: '140 nodes' },
          { ...media, status: 'hot', badge: '13 GB/s ingest' },
        ],
        links: [link('users', 'lb'), link('lb', 'app'), link('app', 'media', { label: 'upload' })],
        flows: [
          { path: ['users', 'lb', 'app'], tone: 'request', count: 3, duration: 1.8 },
          { path: ['users', 'lb', 'app', 'media'], tone: 'event', label: 'upload', duration: 2.4, delay: 1.2 },
        ],
        panel: {
          title: 'Instagram fleet',
          icon: 'Server',
          rows: [
            { text: 'Feed service, 5K per node, 2x', value: '140 nodes' },
            { text: 'Uploads at peak', value: '1,750 × 7.4 MB' },
            { text: 'Ingest bandwidth', value: '13 GB/s ≈ 104 Gbps', tone: 'warn' },
            { text: 'Upload nodes at 1 Gbps', value: '~100', tone: 'warn' },
            { text: 'Object store (2 EB)', value: 'managed, cost bound', tone: 'bad' },
          ],
        },
      },
    },
    {
      title: 'Read results',
      tag: 'tradeoff',
      heading: 'What the numbers tell you',
      eli5: 'When a very famous kid pins up one note, a copy must go into the cubby of each of 100 million fans, the timeline cache. That copying is called **fan-out**, and the sums show it is the hardest job here.',
      body: [
        'Back to Twitter. The database takes 3,500 writes a second, which is easy. The hard part is **fan-out**: 3,500 × 200 followers is 700K cache writes a second, and one celebrity with 100M followers needs 100M more.',
        'The usual answer is hybrid. Push the tweet into follower timelines for normal users, and pull a celebrity\'s tweets at read time instead.',
      ],
      keyIdea: 'Estimates exist to point at the hard problem. Let the biggest number guide the design.',
      metrics: { dau: '500M', qps: '870K peak', storage: '~1.8 PB', bandwidth: '~350 Gbps', servers: '~370' },
      scene: {
        nodes: [users, { ...app, status: 'active', badge: 'fan-out' }, { ...cache, status: 'hot', badge: '100M timeline writes' }, { ...db, status: 'ok', badge: '3,500 writes/s · fine' }],
        links: [link('users', 'app'), link('app', 'cache'), link('app', 'db')],
        flows: [
          { path: ['users', 'app'], tone: 'event', label: 'celebrity tweet', duration: 1.6 },
          { path: ['app', 'db'], tone: 'data', label: '1 row', duration: 1, delay: 1.7 },
          { path: ['app', 'cache'], tone: 'data', label: 'x 100M', count: 10, duration: 1.4, delay: 1.7 },
        ],
        panel: {
          title: 'Where it hurts',
          icon: 'Share2',
          rows: [
            { text: 'DB writes at peak', value: '3,500 / s, easy', tone: 'good' },
            { text: 'One celebrity tweet', value: '1 row, 100M cache writes', tone: 'bad' },
          ],
        },
      },
      quiz: {
        question: 'Which result of the Twitter estimate points at the hardest design problem?',
        options: ['3,500 writes a second', 'Fan-out of a tweet to millions of cached timelines', '36.5 TB of text a year', '370 servers in total'],
        answer: 1,
        explain: 'The database handles 3,500 writes easily, and the fleet is modest. The multiplier from one celebrity tweet to 100M timeline updates is the number that stresses the design.',
      },
    },
    {
      title: 'Sanity checks',
      tag: 'tradeoff',
      heading: 'Round hard, then test your guesses',
      eli5: 'Do sums with round numbers so you do not get stuck. If a guess feels shaky, pretend it is twice as big. If your plan still works, you can stop worrying about it.',
      body: [
        'Precision is not expected. Turn 99,987 ÷ 9.1 into 100,000 ÷ 10 and write down the units. "5" could be KB or MB.',
        'If one assumption feels shaky, double it and see whether the design changes. If 100 timeline loads a day instead of 50 still fits the plan, move on.',
      ],
      keyIdea: 'Round to one significant figure, label units and stress-test the shaky guesses.',
      scene: {
        nodes: [
          { id: 'round', kind: 'block', at: at(-3.6, 0), label: 'round', sub: '1 digit', icon: 'Scale', tint: 'blue' },
          { id: 'units', kind: 'block', at: at(0, 0), label: 'label units', sub: '5 MB, not 5', icon: 'FileText', tint: 'amber' },
          { id: 'double', kind: 'block', at: at(3.6, 0), label: 'double it', sub: 'does it still fit?', icon: 'Repeat', tint: 'green' },
        ],
        links: [link('round', 'units', { route: 'straight' }), link('units', 'double', { route: 'straight' })],
        panel: {
          title: 'Habits',
          icon: 'List',
          rows: [
            { text: '99,987 ÷ 9.1', value: '100,000 ÷ 10', tone: 'good' },
            { text: '50 loads a day → 100', value: '870K → 1.7M QPS' },
            { text: 'Plan still fits?', value: 'then move on', tone: 'good' },
          ],
        },
      },
    },
    {
      title: 'Beyond capacity',
      tag: 'concept',
      heading: 'What napkin math leaves out',
      eli5: 'Counting helpers tells you how many to hire. It does not tell you how fast one kid gets served, how often the library is closed, or what it costs. Those need their own numbers.',
      body: [
        'Capacity answers "how many". It says nothing about how fast one request is, so you also need **latency numbers**: memory is fast, disk is slow, cross-region hops cost tens of milliseconds.',
        'It also ignores uptime, which is measured in **nines** (99.9% allows about 8.8 hours of downtime a year), and cost, which dominated the Instagram storage line. Each has its own lesson.',
      ],
      keyIdea: 'Capacity is one of the numbers. Latency, availability and cost each need their own estimate.',
      scene: {
        nodes: [
          { id: 'cap', kind: 'block', at: at(-5.1, 0), label: 'capacity', sub: 'how many', icon: 'Server', tint: 'green', status: 'ok' },
          { id: 'lat', kind: 'block', at: at(-1.7, 0), label: 'latency', sub: 'how fast', icon: 'Timer', tint: 'blue' },
          { id: 'nines', kind: 'block', at: at(1.7, 0), label: 'availability', sub: 'how often up', icon: 'Shield', tint: 'violet' },
          { id: 'cost', kind: 'block', at: at(5.1, 0), label: 'cost', sub: 'how much', icon: 'Receipt', tint: 'amber' },
        ],
        panel: {
          title: 'Four questions',
          icon: 'Table',
          rows: [
            { text: 'Capacity', value: 'this lesson', tone: 'good' },
            { text: 'Latency', value: 'ms per hop' },
            { text: '99.9% uptime', value: '~8.8 h down / year' },
            { text: 'Cost', value: 'dominates at PB scale', tone: 'warn' },
          ],
        },
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Six formulas, five minutes',
      eli5: 'Six quick sums tell you how many librarians, shelves and doors the library needs. That is **napkin math**: say your guesses out loud, round the numbers, and see which one comes out biggest.',
      body: [
        'Average QPS = DAU × actions ÷ 86,400. Peak = average × 3. Storage = records × size × years × copies. Bandwidth = QPS × payload. Servers = peak QPS ÷ per-node capacity × 2. Cache = about 20% of the hot data.',
        'State your assumptions, round to powers of ten, and read the result. For Twitter the numbers point at fan-out and caching. For Instagram they point at the CDN and the media pipeline.',
      ],
      keyIdea: 'Napkin math turns a vague scale into a short list of hard problems. Do it before you draw a single box.',
      metrics: { dau: '500M', qps: '870K peak', storage: '~1.8 PB', bandwidth: '~350 Gbps', servers: '~370' },
      scene: {
        nodes: [users, { ...lb, status: 'ok' }, { ...app, status: 'ok' }, cache, db],
        links: [link('users', 'lb'), link('lb', 'app'), link('app', 'cache'), link('app', 'db')],
        flows: [
          { path: ['users', 'lb', 'app', 'cache'], tone: 'request', count: 3, duration: 1.8 },
          { path: ['cache', 'app', 'lb', 'users'], tone: 'response', count: 3, duration: 1.8, delay: 1.9 },
        ],
        panel: {
          title: 'The six formulas',
          icon: 'Table',
          code: 'QPS     = DAU × actions ÷ 86,400\npeak    = QPS × 3\nstorage = records × size × years × copies\nbw      = QPS × payload\nservers = peak ÷ per-node × 2\ncache   = 20% × hot data',
        },
      },
      quiz: {
        question: 'A chat app has 50M daily users who each send 40 messages a day. Peak is 5x average, and one app node handles 5K QPS. With 2x headroom, about how many app nodes do you need?',
        options: ['About 4', 'About 45', 'About 450', 'About 4,500'],
        answer: 1,
        explain: '50M × 40 = 2 × 10⁹ messages a day, about 23K per second. Peak is 5x, about 115K. Divide by 5K per node for 23 nodes, then double it: about 46.',
      },
    },
  ],
};
