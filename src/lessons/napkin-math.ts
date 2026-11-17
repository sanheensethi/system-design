import type { Lesson, SceneNode } from '../engine/types';

const users: SceneNode = { id: 'users', kind: 'phone', at: [-5.5, 1.5], label: '500M users', sub: 'daily active' };
const lb: SceneNode = { id: 'lb', kind: 'lb', at: [-2.5, 0], label: 'load balancer' };
const app: SceneNode = { id: 'app', kind: 'server', at: [0, -1.5], label: 'app servers', sub: 'timeline API' };
const cache: SceneNode = { id: 'cache', kind: 'cache', at: [2.5, -4], label: 'timeline cache', sub: 'Redis' };
const db: SceneNode = { id: 'db', kind: 'db', at: [3.5, -0.5], label: 'tweet DB', sub: 'sharded by user_id' };
const media: SceneNode = { id: 'media', kind: 'storage', at: [1.5, 3], label: 'media store', sub: 'object storage' };
const cdn: SceneNode = { id: 'cdn', kind: 'cdn', at: [-2, 3], label: 'CDN', sub: 'edge caches' };

export const napkinMath: Lesson = {
  id: 'napkin-math',
  title: 'Napkin math: capacity estimation',
  tagline: 'Turn "500 million users" into QPS, storage, bandwidth and a server count in five minutes.',
  minutes: 12,
  level: 'Beginner',
  learn: [
    'The 86,400 trick: from daily users to requests per second',
    'Why you size for peak traffic, not the average',
    'How to estimate storage over years, with replication',
    'Why bandwidth often runs out before CPU',
    'How per-node throughput turns QPS into a server count',
  ],
  metrics: [
    { key: 'dau', label: 'DAU' },
    { key: 'qps', label: 'Read QPS' },
    { key: 'storage', label: 'Storage / yr' },
    { key: 'bandwidth', label: 'Egress' },
    { key: 'servers', label: 'Servers' },
  ],
  steps: [
    {
      title: 'How many?',
      tag: 'problem',
      heading: 'Your manager asks how many servers to buy',
      eli5: 'Half a billion kids want to visit your new library, and someone asks how many librarians, the app servers, to hire. Working that out with quick, rough sums is called **capacity estimation**.',
      body: [
        'You are building a Twitter-sized product. Before anyone writes code, your manager asks a plain question: how many servers, how much disk, how much bandwidth?',
        'One engineer says "Postgres can handle it". Another wants a thousand machines. Both are guessing, and a guess can be off by 100x in either direction. That is the difference between a design that falls over on launch day and one that wastes millions.',
        'You do not need a spreadsheet. You need a handful of assumptions, powers of ten, and about five minutes of arithmetic.',
      ],
      keyIdea: 'Capacity estimation is about getting the order of magnitude right. Being off by 2x is fine. Being off by 100x is a different system.',
      metrics: { dau: '500M', servers: '?' },
      scene: {
        nodes: [users, { ...app, status: 'active', badge: '? servers' }],
        links: [{ from: 'users', to: 'app', style: 'dashed' }],
        flows: [{ path: ['users', 'app'], tone: 'request', count: 5, duration: 1.6 }],
        caption: 'Half a billion people, one blank whiteboard',
      },
    },
    {
      title: 'Assumptions',
      tag: 'concept',
      heading: 'Write the assumptions down first',
      eli5: 'First write down your best guesses. Each kid reads the notice board 50 times a day and pins up a new note only once in a while. These guesses are your **assumptions**, and anyone can check them.',
      body: [
        'Every estimate starts with numbers you state out loud, so others can challenge them. For our Twitter clone: **500M daily active users** (5 × 10⁸). Each user loads the timeline **50 times a day** and posts **0.2 tweets a day**.',
        'A tweet is about 300 bytes of text plus 200 bytes of metadata. Call it **1 KB** once you add indexes. One in ten tweets carries a 500 KB image. We keep data for **5 years** and store **3 copies** of everything.',
        'Write these on the board before any math. If an assumption turns out wrong, you change one line and redo the arithmetic.',
      ],
      keyIdea: 'Stated assumptions make an estimate checkable. Hidden ones make it a guess.',
      metrics: { dau: '500M' },
      scene: {
        nodes: [{ ...users, status: 'active', badge: '50 reads · 0.2 posts / day' }, app],
        links: [{ from: 'users', to: 'app' }],
        flows: [
          { path: ['users', 'app'], tone: 'request', label: 'load timeline', count: 5, duration: 1.6 },
          { path: ['users', 'app'], tone: 'event', label: 'post tweet', duration: 1.6, delay: 0.8 },
        ],
      },
    },
    {
      title: '86,400 trick',
      tag: 'concept',
      heading: 'From daily users to requests per second',
      eli5: 'A day is about 100,000 seconds long. Share out all the visits of one day over those seconds and you learn how many kids the librarians must help each second. That number is the **QPS**.',
      body: [
        'A day has 86,400 seconds, which is close to **10⁵**. So average QPS is `DAU × actions per user ÷ 86,400`. With 10 actions per user, QPS is about DAU divided by 10,000.',
        'Writes: 5 × 10⁸ users × 0.2 tweets = 10⁸ tweets a day. Divide by 86,400 and you get about **1,150 writes per second**.',
        'Reads: 5 × 10⁸ × 50 = 2.5 × 10¹⁰ timeline loads a day, or about **290,000 reads per second**. That is a 250:1 read-to-write ratio. This system is about reading, and the design will follow from that.',
      ],
      keyIdea: 'Average QPS ≈ DAU × actions ÷ 10⁵. The read-to-write ratio tells you which side of the system to design first.',
      metrics: { dau: '500M', qps: '290K avg' },
      scene: {
        nodes: [users, { ...app, status: 'active', badge: '290K reads/s · 1,150 writes/s' }],
        links: [{ from: 'users', to: 'app' }],
        flows: [
          { path: ['users', 'app'], tone: 'request', label: '290K/s', count: 8, duration: 1.4 },
          { path: ['users', 'app'], tone: 'event', label: '1,150/s', duration: 1.4, delay: 0.7 },
        ],
      },
    },
    {
      title: 'Peak',
      tag: 'concept',
      heading: 'Size for the peak, not the average',
      eli5: 'The library is never evenly busy. After school it gets about three times as crowded, and that busiest time is the **peak**. Hire enough librarians for then, or the line goes out the door.',
      body: [
        'Traffic is never flat. Evenings, big sports games and breaking news all spike it. A **3x peak-to-average** multiplier is a safe default. Chat and streaming apps can hit 5x to 10x, while internal business tools sit closer to 2x.',
        'Peak reads: 290K × 3 ≈ **870K reads per second**. Peak writes: 1,150 × 3 ≈ **3,500 writes per second**.',
        'A system sized for the average falls over every evening. Everything from here on uses the peak numbers.',
      ],
      keyIdea: 'Multiply the average by 3 and design for that number, because the peak is when systems break.',
      metrics: { dau: '500M', qps: '870K peak' },
      scene: {
        nodes: [users, { ...app, status: 'hot', badge: '870K reads/s at peak' }],
        links: [{ from: 'users', to: 'app' }],
        flows: [
          { path: ['users', 'app'], tone: 'request', count: 14, duration: 1.2 },
          { path: ['users', 'app'], tone: 'event', count: 2, duration: 1.2, delay: 0.5 },
        ],
        caption: '9 pm, a big match goes to extra time',
      },
    },
    {
      title: 'Storage',
      tag: 'concept',
      heading: 'Storage: records × size × years × copies',
      eli5: '**Storage** is shelf space. Count the notes pinned up each day, times their size, times the years you keep them, times three copies. Picture posters need far more room, so they get their own warehouse, the media store.',
      body: [
        'Tweet text: 10⁸ tweets a day × 365 × 1 KB ≈ **36.5 TB a year**. Over 5 years that is about 180 TB, and with 3 copies it is **540 TB**. Big, but a sharded database handles it.',
        'Media: 10% of tweets carry a 500 KB image, so the average tweet carries 50 KB of image. 10⁸ × 365 × 50 KB ≈ **1.8 PB a year**. Over 5 years with 3 copies that is **27 PB**.',
        'Media is 50x bigger than text. That split decides the architecture: the database holds metadata in terabytes, and an object store holds the bytes in petabytes. Remember indexes add another 20 to 50% on top.',
      ],
      keyIdea: 'Always multiply by retention and by replication. Then look at which kind of data dominates, because it gets its own store.',
      metrics: { dau: '500M', qps: '870K peak', storage: '~1.8 PB' },
      scene: {
        nodes: [
          users,
          app,
          { ...db, status: 'active', badge: '540 TB (5 yr, 3x)' },
          { ...media, status: 'hot', badge: '27 PB (5 yr, 3x)' },
        ],
        links: [
          { from: 'users', to: 'app' },
          { from: 'app', to: 'db' },
          { from: 'app', to: 'media' },
        ],
        flows: [
          { path: ['users', 'app'], tone: 'event', label: 'new tweet', duration: 1.2 },
          { path: ['app', 'db'], tone: 'data', label: 'row · 1 KB', duration: 1.2, delay: 1.25 },
          { path: ['app', 'media'], tone: 'data', label: 'image · 500 KB', duration: 1.8, delay: 1.25 },
        ],
      },
    },
    {
      title: 'Bandwidth',
      tag: 'concept',
      heading: 'Bandwidth: QPS × payload',
      eli5: '**Bandwidth** is how much the library can carry out its doors each second. Picture posters are too much for those doors, so the CDN, little booths in every neighborhood, hands out copies close to home.',
      body: [
        'Text egress at peak: 870K reads per second × 1 KB = 870 MB/s, about **7 Gbps**. A single commodity server has a 1 to 10 Gbps network card, so text alone needs several machines just for the network.',
        'Images are far bigger. If origin servers sent every image themselves, egress would be in the terabits. So images go through a **CDN**: edges near users serve cached copies, and the origin only sees cache misses. Plan around 100 Gbps at the edge and 10 Gbps at the origin.',
        'Engineers new to this often size for CPU and forget the network card. At 10K QPS with a 10 KB payload you already push 800 Mbps, nearly a full 1 Gbps link.',
      ],
      keyIdea: 'Bandwidth often runs out before CPU. Serve big, popular objects from a CDN.',
      metrics: { dau: '500M', qps: '870K peak', storage: '~1.8 PB', bandwidth: '7 Gbps text' },
      scene: {
        nodes: [users, app, db, media, { ...cdn, status: 'active', badge: '~100 Gbps edge' }],
        links: [
          { from: 'users', to: 'app' },
          { from: 'app', to: 'db' },
          { from: 'app', to: 'media' },
          { from: 'users', to: 'cdn' },
          { from: 'cdn', to: 'media', style: 'dashed', label: 'misses only' },
        ],
        flows: [
          { path: ['app', 'users'], tone: 'response', label: 'timeline · 7 Gbps', count: 4, duration: 1.4 },
          { path: ['cdn', 'users'], tone: 'response', label: 'images', count: 6, duration: 1.2, delay: 0.3 },
          { path: ['media', 'cdn'], tone: 'data', label: 'miss', duration: 1.6, delay: 1 },
        ],
      },
    },
    {
      title: 'Servers',
      tag: 'concept',
      heading: 'Servers: peak QPS ÷ per-node capacity × 2',
      eli5: 'Take the busiest crowd, divide by how many kids one librarian can help, then double it in case half are out sick. That gives the number of **app servers**: about 200 librarians at the timeline desk.',
      body: [
        'Use the per-node throughput numbers. A REST app server handles up to about 10K QPS. Timeline reads: 870K ÷ 10K ≈ 87 nodes. Double it so you can lose half the fleet and keep serving, about 175, and round up to **~200 timeline nodes**.',
        'Timeline cache: 500M users × 800 cached tweet IDs × 8 bytes ≈ 3.2 TB. At 100 GB per Redis node that is about 32 nodes, **60+ with replicas**. The tweet database: 3,500 writes per second is easy, so 20 shards with 2 copies gives **40 nodes**.',
        'Add 20 to 50 nodes for ingesting tweets and fanning them out, and the whole system needs roughly **350 servers**. That is a long way from one box, and a long way from ten thousand.',
      ],
      keyIdea: 'Servers = peak QPS ÷ what one node can do × 2. Run the same formula for every tier.',
      metrics: { dau: '500M', qps: '870K peak', storage: '~1.8 PB', bandwidth: '7 Gbps text', servers: '~350' },
      scene: {
        nodes: [
          users,
          { ...lb, status: 'active' },
          { ...app, badge: '~200 nodes' },
          { ...cache, badge: '3.2 TB · 60+ nodes' },
          { ...db, badge: '20 shards · 40 nodes' },
          media,
          cdn,
        ],
        links: [
          { from: 'users', to: 'lb' },
          { from: 'lb', to: 'app' },
          { from: 'app', to: 'cache' },
          { from: 'app', to: 'db' },
          { from: 'app', to: 'media' },
          { from: 'users', to: 'cdn' },
          { from: 'cdn', to: 'media', style: 'dashed' },
        ],
        flows: [
          { path: ['users', 'lb', 'app', 'cache'], tone: 'request', count: 4, duration: 1.8 },
          { path: ['cache', 'app', 'lb', 'users'], tone: 'response', count: 4, duration: 1.8, delay: 1.9 },
        ],
      },
      code: {
        language: 'python',
        title: 'The whole estimate in 20 lines',
        source: `DAY = 86_400                      # ~10^5 seconds

dau            = 500e6
reads_per_user = 50                # timeline loads per day
posts_per_user = 0.2
tweet_bytes    = 1_000             # text + metadata + index
peak_factor    = 3
node_qps       = 10_000            # one REST app server

read_qps   = dau * reads_per_user / DAY       # ~290K
write_qps  = dau * posts_per_user / DAY       # ~1,150
peak_reads = read_qps * peak_factor           # ~870K

text_tb_yr  = dau * posts_per_user * 365 * tweet_bytes / 1e12
egress_gbps = peak_reads * tweet_bytes * 8 / 1e9
app_nodes   = peak_reads / node_qps * 2       # x2 for headroom

print(f"reads {read_qps:,.0f}/s, peak {peak_reads:,.0f}/s")
print(f"writes {write_qps:,.0f}/s, text {text_tb_yr:.1f} TB/yr")
print(f"egress {egress_gbps:.1f} Gbps, app nodes {app_nodes:.0f}")`,
        highlight: [10, 12, 16],
      },
    },
    {
      title: 'Instagram',
      tag: 'case',
      heading: 'Case: same users, different shape',
      eli5: 'A second library has just as many kids, but they mostly borrow giant picture posters. Now the hard part is carrying posters, so the **CDN** booths near each home do nearly all of the handing out.',
      body: [
        'Run the same formulas for Instagram with 500M DAU. Each user posts 0.1 times a day and views 20 feed items. Writes: about **580 posts per second**. Reads: about 115K per second average, **350K at peak**. Fewer reads than Twitter.',
        'Now the payload. Photos average 2 MB and reels 20 MB, with 30% of posts being reels. Uploads come to about **370 TB a day**, or 135 PB a year. Peak egress is 350K × 2 MB = 700 GB/s, about **5.6 Tbps**.',
        'No origin can push 5.6 Tbps. With a CDN that hits 95% of the time, origin traffic drops to about 280 Gbps. The feed service itself needs only 70 nodes, 140 with headroom. The arithmetic says this is a media pipeline problem.',
      ],
      keyIdea: 'The same DAU can produce very different systems. Let the biggest number in your estimate pick the architecture.',
      metrics: { dau: '500M', qps: '350K peak', storage: '135 PB', bandwidth: '5.6 Tbps', servers: '140 feed' },
      scene: {
        nodes: [
          { ...users, label: '500M users', sub: 'Instagram' },
          lb,
          { ...app, label: 'feed service', sub: 'metadata only', badge: '140 nodes' },
          { ...cache, status: 'dim' },
          { ...db, label: 'post DB', status: 'ok', badge: '580 writes/s' },
          { ...media, status: 'hot', badge: '370 TB / day' },
          { ...cdn, status: 'active', badge: '95% hit' },
        ],
        links: [
          { from: 'users', to: 'lb' },
          { from: 'lb', to: 'app' },
          { from: 'app', to: 'db' },
          { from: 'users', to: 'cdn' },
          { from: 'cdn', to: 'media', style: 'dashed' },
          { from: 'app', to: 'media' },
        ],
        flows: [
          { path: ['cdn', 'users'], tone: 'response', label: '2 MB photos', count: 8, duration: 1.2 },
          { path: ['media', 'cdn'], tone: 'data', label: '5% misses', duration: 1.8, delay: 0.6 },
          { path: ['users', 'lb', 'app', 'media'], tone: 'event', label: 'upload', duration: 2.4, delay: 1.2 },
        ],
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
      title: 'Read results',
      tag: 'tradeoff',
      heading: 'What the numbers tell you',
      eli5: 'When a very famous kid pins up one note, a copy must go into the cubby of each of 100 million fans, the timeline cache. That copying is called **fan-out**, and the sums show it is the hardest job here.',
      body: [
        'Back to Twitter. The database takes 3,500 writes per second at peak, which a few shards handle easily. The hard part is the read path and **fan-out**: when a celebrity with 100M followers tweets, up to 100M cached timelines need that tweet.',
        'Keep the precision honest. Round to one significant figure and use powers of ten. If one assumption feels shaky, double it and see whether the design changes. If 100 timeline loads a day instead of 50 still fits the plan, move on.',
      ],
      keyIdea: 'Estimates exist to point at the hard problem. Round hard, test the shaky assumptions, and let the biggest number guide the design.',
      metrics: { dau: '500M', qps: '870K peak', storage: '~1.8 PB', bandwidth: '7 Gbps text', servers: '~350' },
      scene: {
        nodes: [
          users,
          lb,
          { ...app, status: 'active', badge: 'fan-out' },
          { ...cache, status: 'hot', badge: '100M timeline writes' },
          { ...db, status: 'ok', badge: '3,500 writes/s · fine' },
          media,
          cdn,
        ],
        links: [
          { from: 'users', to: 'lb' },
          { from: 'lb', to: 'app' },
          { from: 'app', to: 'cache' },
          { from: 'app', to: 'db' },
          { from: 'app', to: 'media' },
          { from: 'users', to: 'cdn' },
        ],
        flows: [
          { path: ['users', 'lb', 'app'], tone: 'event', label: 'celebrity tweet', duration: 1.6 },
          { path: ['app', 'db'], tone: 'data', label: '1 row', duration: 1, delay: 1.7 },
          { path: ['app', 'cache'], tone: 'data', label: 'x 100M', count: 10, duration: 1.4, delay: 1.7 },
        ],
      },
      quiz: {
        question: 'An app has 100M daily active users, and each does 10 actions a day. Roughly what is the average QPS?',
        options: ['About 1,000', 'About 10,000', 'About 100,000', 'About 1,000,000'],
        answer: 1,
        explain: '10⁸ users × 10 actions = 10⁹ actions a day. Divide by about 10⁵ seconds in a day and you get 10⁴, so about 10,000 QPS.',
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
      metrics: { dau: '500M', qps: '870K peak', storage: '~1.8 PB', bandwidth: '7 Gbps text', servers: '~350' },
      scene: {
        nodes: [users, { ...lb, status: 'ok' }, { ...app, status: 'ok' }, cache, db, media, cdn],
        links: [
          { from: 'users', to: 'lb' },
          { from: 'lb', to: 'app' },
          { from: 'app', to: 'cache' },
          { from: 'app', to: 'db' },
          { from: 'app', to: 'media' },
          { from: 'users', to: 'cdn' },
          { from: 'cdn', to: 'media', style: 'dashed' },
        ],
        flows: [
          { path: ['users', 'lb', 'app', 'cache'], tone: 'request', count: 3, duration: 1.8 },
          { path: ['cache', 'app', 'lb', 'users'], tone: 'response', count: 3, duration: 1.8, delay: 1.9 },
          { path: ['cdn', 'users'], tone: 'response', count: 4, duration: 1.2, delay: 0.5 },
        ],
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
