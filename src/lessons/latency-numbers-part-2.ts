import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const app: SceneNode = { id: 'app', kind: 'block', at: at(-5, 0), label: 'checkout app', sub: 'California', icon: 'Cpu', tint: 'blue' };
const far: SceneNode = { id: 'far', kind: 'server', at: at(5.5, 0), label: 'pricing service', sub: 'Netherlands' };
const replica: SceneNode = { id: 'replica', kind: 'replica', at: at(0, 3.8), label: 'pricing replica', sub: 'California' };
const cache: SceneNode = { id: 'cache', kind: 'cache', at: at(0, -3.8), label: 'price cache', sub: 'local RAM' };

const box = (extra: Partial<SceneNode> = {}): SceneNode => ({ id: 'box', kind: 'block', at: at(-5, 0), label: 'one server', sub: 'standard box', icon: 'Server', tint: 'blue', ...extra });

export const latencyNumbersPart2: Lesson = {
  id: 'latency-numbers-part-2',
  title: 'Latency numbers every engineer should know (part 2)',
  tagline: 'Fix the slow checkout, learn the size of data, and size one server by what it can do per second.',
  minutes: 14,
  level: 'Beginner',
  learn: [
    'Three ways to remove round trips: batch, replicate, cache',
    'The data size reference and powers of ten for napkin math',
    'A standard server box and what it can hold',
    'Throughput per node for app servers, SQL, Redis, Kafka and more',
    'Why one slow call in twenty ruins the page',
  ],
  metrics: [
    { key: 'op', label: 'Item', icon: 'Activity' },
    { key: 'value', label: 'Number', icon: 'Gauge' },
    { key: 'trips', label: 'Round trips', icon: 'Repeat' },
    { key: 'node', label: 'Per node', icon: 'Server' },
  ],
  steps: [
    {
      title: 'Count trips',
      tag: 'problem',
      heading: 'Back to the 3-second checkout',
      eli5: 'The kid still mails 20 letters to her pen pal across the ocean, one at a time. The fix is not a faster pencil. It is **fewer trips** to the mailbox.',
      body: [
        'Part 1 left the checkout page at 3 seconds: 20 sequential price lookups at 150 ms each, with the CPU idle the whole time.',
        'The code was fine. The design made 20 cross-ocean trips. There are three fixes, each one rung further down the ladder.',
      ],
      keyIdea: 'Count round trips first, then remove them: batch, move the data closer, or keep it in memory.',
      metrics: { op: 'Checkout page', value: '3 s', trips: '20 x 150 ms' },
      metricTones: { value: 'bad', trips: 'bad' },
      scene: {
        nodes: [{ ...app, status: 'hot', load: 5, badge: '3 s per page', chips: ['get_price(1)', 'get_price(2)', 'get_price(…20)'] }, { ...far, status: 'active' }],
        links: [link('app', 'far', { style: 'dashed', label: '150 ms per round trip', labelTone: 'warn' })],
        flows: [
          { path: ['app', 'far'], tone: 'request', label: 'get_price(id)', count: 3, duration: 2.4 },
          { path: ['far', 'app'], tone: 'response', count: 3, duration: 2.4, delay: 2.5 },
        ],
        panel: {
          title: 'The three fixes',
          icon: 'List',
          rows: [
            { text: 'Batch the lookups', value: '1 trip' },
            { text: 'Replicate the data', value: 'same datacenter' },
            { text: 'Cache in memory', value: 'no trip' },
          ],
        },
        caption: 'Twenty trips, one idle CPU',
      },
    },
    {
      title: 'Batch',
      tag: 'case',
      heading: 'Fix 1: batch the lookups into one call',
      eli5: 'The kid puts all 20 questions into one letter. This is called **batching**. The boat still takes the same time, but it only sails once.',
      body: [
        '**Batch** the lookups into one call: one round trip, 150 ms. A round trip costs the same whether it carries 1 item or 20, so you pay the distance once.',
        'The cost is a new endpoint on the pricing service, and a response that carries 20 prices at once.',
      ],
      keyIdea: 'A round trip costs the same for 1 item or 100. Batching pays the distance once.',
      metrics: { op: 'Batched call', value: '150 ms', trips: '1' },
      metricTones: { value: 'warn', trips: 'good' },
      scene: {
        nodes: [{ ...app, status: 'ok', badge: '150 ms per page' }, { ...far, status: 'active', chips: ['get_prices([20 ids])'] }],
        links: [link('app', 'far', { style: 'dashed', label: '1 trip · 150 ms', labelTone: 'warn' })],
        flows: [
          { path: ['app', 'far'], tone: 'request', label: 'get_prices([20 ids])', duration: 2.4 },
          { path: ['far', 'app'], tone: 'response', label: '20 prices', duration: 2.4, delay: 2.5 },
        ],
        panel: {
          title: 'Before and after',
          icon: 'Table',
          rows: [
            { text: 'One call per item', value: '20 × 150 ms = 3 s', tone: 'bad' },
            { text: 'One batched call', value: '150 ms', tone: 'good' },
          ],
          footer: { text: '20x faster, same data', tone: 'good' },
        },
        caption: 'One letter with 20 questions',
      },
      code: {
        language: 'python',
        title: 'Before and batched',
        source: `# Before: 20 round trips x 150 ms = 3 s
prices = {}
for item in cart.items:
    prices[item.id] = pricing.get_price(item.id)

# Batch: 1 round trip, about 150 ms
prices = pricing.get_prices([item.id for item in cart.items])`,
        highlight: [3, 4, 7],
      },
    },
    {
      title: 'Replicate',
      tag: 'case',
      heading: 'Fix 2: replicate the data nearby',
      eli5: 'A copy of the pen pal\'s answer book sits in the classroom next door, the **pricing replica**. The kid walks next door instead of sailing the ocean.',
      body: [
        '**Replicate** the pricing data into the California datacenter. Now the lookup is one same-datacenter round trip: `0.5 ms` instead of 150 ms. This assumes the replica is also called once per page, as a batched call. Twenty separate calls to the replica would cost 20 × 0.5 ms = 10 ms.',
        'The replica needs a sync link from the original service. Between syncs it can be a little behind.',
      ],
      keyIdea: 'Move the data to the code. A same-datacenter hop is 300x faster than a cross-ocean one.',
      metrics: { op: 'Replica lookup', value: '0.5 ms', trips: '1 (nearby)' },
      metricTones: { value: 'good', trips: 'good' },
      scene: {
        nodes: [{ ...app, status: 'ok', badge: '0.5 ms per page' }, { ...replica, status: 'active', chips: ['get_prices([20 ids])'] }, { ...far, status: 'dim' }],
        links: [
          link('app', 'replica', { label: '0.5 ms' }),
          link('far', 'replica', { style: 'faint', label: 'sync', arrow: 'end' }),
        ],
        flows: [
          { path: ['far', 'replica'], tone: 'data', duration: 2.4 },
          { path: ['app', 'replica'], tone: 'request', duration: 1.2, delay: 0.3 },
          { path: ['replica', 'app'], tone: 'response', duration: 1.2, delay: 1.6 },
        ],
        panel: {
          title: 'Latency per page',
          icon: 'Gauge',
          rows: [
            { text: 'Original design', value: '3 s', tone: 'bad' },
            { text: 'Batched', value: '150 ms', tone: 'warn' },
            { text: 'Replica, batched call', value: '0.5 ms', tone: 'good' },
            { text: 'Replica, 20 single calls', value: '10 ms', tone: 'warn' },
          ],
        },
        caption: 'The answers now live next door',
      },
      code: {
        language: 'python',
        title: 'Batched call to the replica',
        source: `# Local replica: 1 batched same-DC round trip, about 0.5 ms
prices = pricing_replica.get_prices([i.id for i in cart.items])`,
        highlight: [2],
      },
    },
    {
      title: 'Cache',
      tag: 'case',
      heading: 'Fix 3: keep prices in local memory',
      eli5: 'The kid copies the 20 answers into the notebook on her desk, the **price cache**, and checks it for a minute before asking again.',
      body: [
        '**Cache** prices in the app\'s own memory and refresh them every minute. A hit costs about `100 ns`, with no network at all.',
        'This is the lowest rung. A page with 20 lookups at 100 ns spends about 2 µs on prices, where it used to spend 3 seconds.',
      ],
      keyIdea: 'The fastest round trip is the one you never make. A local cache removes the network from the hot path.',
      metrics: { op: 'Cache hit', value: '~100 ns', trips: '0' },
      metricTones: { value: 'good', trips: 'good' },
      scene: {
        nodes: [{ ...app, status: 'ok', badge: '~2 µs per page' }, { ...cache, status: 'active', badge: 'hit · 100 ns', chips: [{ text: 'refresh every 60 s', tone: 'default' }] }, { ...far, status: 'dim' }],
        links: [link('app', 'cache'), link('far', 'cache', { style: 'faint', label: 'refresh', arrow: 'end' })],
        flows: [
          { path: ['app', 'cache', 'app'], tone: 'request', duration: 0.8 },
          { path: ['far', 'cache'], tone: 'data', duration: 3, delay: 0.5 },
        ],
        panel: {
          title: 'Down the ladder',
          icon: 'Layers',
          rows: [
            { text: 'Cross-ocean calls', value: '150 ms each', tone: 'bad' },
            { text: 'Same-DC replica', value: '0.5 ms', tone: 'good' },
            { text: 'Local memory, per lookup', value: '~100 ns', tone: 'good' },
            { text: 'Local memory, 20 lookups', value: '~2 µs', tone: 'good' },
          ],
        },
        caption: 'The notebook on the desk',
      },
      code: {
        language: 'python',
        title: 'In-memory cache',
        source: `# In-memory cache, refreshed every 60 s: ~100 ns per lookup, ~2 µs for 20
prices = {i.id: price_cache[i.id] for i in cart.items}`,
        highlight: [2],
      },
    },
    {
      title: 'Stale prices',
      tag: 'tradeoff',
      heading: 'Every fix trades something',
      eli5: 'A copy of the answer book can be out of date. If the pen pal changes an answer, the kid keeps saying the old one until the next copy arrives.',
      body: [
        'Batching needs a new endpoint. A replica or cache can serve a price that is a minute old.',
        'For a checkout page, a stale price for 60 seconds is usually fine as long as the payment step re-checks it. The faster the fix, the staler the data can be.',
      ],
      keyIdea: 'Speed comes from keeping copies, and copies lag. Decide how stale each piece of data may be.',
      metrics: { op: 'Staleness', value: 'up to 60 s', trips: '0 to 1' },
      metricTones: { value: 'warn' },
      scene: {
        nodes: [{ ...app, status: 'active' }, { ...cache, chips: [{ text: 'price: 9.99 (60 s old)', tone: 'warn' }] }, { ...far, chips: [{ text: 'price: 10.49 (now)', tone: 'good' }] }],
        links: [link('app', 'cache'), link('far', 'cache', { style: 'faint', label: 'refresh in 40 s', labelTone: 'warn' })],
        flows: [{ path: ['app', 'cache', 'app'], tone: 'request', duration: 0.9 }],
        panel: {
          title: 'What each fix costs',
          icon: 'Scale',
          rows: [
            { text: 'Batch', value: 'new endpoint', tone: 'warn' },
            { text: 'Replica', value: 'sync lag', tone: 'warn' },
            { text: 'Cache', value: 'up to 60 s stale', tone: 'warn' },
          ],
          footer: { text: 'Payment re-checks the real price', tone: 'good' },
        },
        caption: 'A copy is only as fresh as its last sync',
      },
    },
    {
      title: 'Small sizes',
      tag: 'concept',
      heading: 'Data size reference: small values',
      eli5: 'Before counting how many books fit in the school, you need to know how big one page is. Sizes are the **measuring tape** for every storage guess.',
      body: [
        'You cannot estimate storage without the size of the things you store. A char is 1 byte (UTF-8 takes 1 to 4). An int is 4 bytes. A long, an ID or a timestamp is 8.',
        'A UUID is 16 bytes raw and 36 as a string, so store it as binary when you can. A short text such as a tweet is 100 to 300 B, and a typical JSON row is 1 to 4 KB.',
      ],
      keyIdea: 'Memorize the small sizes. Multiplying them by a row count gives the storage of a table.',
      metrics: { op: 'JSON row', value: '1 to 4 KB' },
      scene: {
        nodes: [{ id: 'row', kind: 'block', at: at(0, 0), label: 'one row', sub: 'user or order', icon: 'FileJson', tint: 'amber', status: 'active', badge: '1 to 4 KB' }],
        panel: {
          title: 'Small things',
          icon: 'Table',
          rows: [
            { text: 'char (ASCII)', value: '1 B' },
            { text: 'int', value: '4 B' },
            { text: 'long, ID, timestamp', value: '8 B' },
            { text: 'UUID', value: '16 B raw, 36 B text' },
            { text: 'Tweet or short text', value: '100 to 300 B' },
            { text: 'Typical JSON row', value: '1 to 4 KB' },
          ],
        },
        caption: 'The tape measure for storage',
      },
    },
    {
      title: 'Media sizes',
      tag: 'concept',
      heading: 'Data size reference: media',
      eli5: 'A sticker is tiny and a poster is big. A video is a whole **wall of posters**, so the library fills up fast when the kids bring movies.',
      body: [
        'Media dwarfs text. A thumbnail is 10 to 50 KB. A full photo is 500 KB to 2 MB. One minute of 1080p video is about 50 MB, and 4K is about 4x that.',
        'One hour of HD video is about 3 GB. A table of rows sits in the database. The bytes of photos and video belong in object storage.',
      ],
      keyIdea: 'One photo is a thousand rows. Media sets your storage and bandwidth bill, text does not.',
      metrics: { op: 'Full photo', value: '500 KB to 2 MB' },
      scene: {
        nodes: [
          { id: 'thumb', kind: 'block', at: at(-5, 0), label: 'thumbnail', icon: 'Image', tint: 'teal', size: 0.8 },
          { id: 'photo', kind: 'block', at: at(-1.7, 0), label: 'photo', icon: 'Image', tint: 'blue', size: 0.95 },
          { id: 'video', kind: 'block', at: at(2, 0), label: 'HD video', icon: 'Webhook', tint: 'violet', size: 1.1 },
        ],
        panel: {
          title: 'Media sizes',
          icon: 'Image',
          rows: [
            { text: 'Thumbnail (compressed JPEG)', value: '10 to 50 KB' },
            { text: 'Full photo', value: '500 KB to 2 MB' },
            { text: '1 minute of HD video', value: '~50 MB' },
            { text: '1 hour of HD video', value: '~3 GB', tone: 'warn' },
          ],
          footer: { text: '4K video is about 4x HD', tone: 'muted' },
        },
        caption: 'Each step up is a factor of ten or more',
      },
    },
    {
      title: 'Powers of ten',
      tag: 'concept',
      heading: 'Powers of ten for units and sizes',
      eli5: 'Counting a huge pile of stickers is easier by tens: ten, a hundred, a thousand. Each unit is a **thousand** of the one before it.',
      body: [
        'KB is 10³ bytes, MB 10⁶, GB 10⁹, TB 10¹², PB 10¹⁵. Each step up multiplies by a thousand.',
        'With powers of ten you can size storage in your head: 10⁹ rows at 1 KB each is 10⁹ × 10³ = 10¹² bytes, which is 1 TB.',
      ],
      keyIdea: 'Capacity planning is multiplying powers of ten. You rarely need a calculator.',
      metrics: { op: '10⁹ rows x 1 KB', value: '1 TB' },
      scene: {
        nodes: [
          { id: 'rows', kind: 'block', at: at(-5, 0), label: '10⁹ rows', sub: '1 KB each', icon: 'Table', tint: 'blue' },
          { id: 'size', kind: 'block', at: at(0, 0), label: '1 TB', sub: '10¹² bytes', icon: 'HardDrive', tint: 'green', status: 'active' },
        ],
        links: [link('rows', 'size', { route: 'straight', label: '10⁹ × 10³ B' })],
        flows: [{ path: ['rows', 'size'], tone: 'data', count: 4, duration: 2 }],
        panel: {
          title: 'Powers of ten',
          icon: 'Binary',
          rows: [
            { text: 'KB · MB · GB', value: '10³ · 10⁶ · 10⁹' },
            { text: 'TB · PB', value: '10¹² · 10¹⁵' },
            { text: '10⁹ rows × 1 KB', value: '10¹² B = 1 TB', tone: 'good' },
          ],
        },
        caption: 'Rows times row size, in your head',
      },
    },
    {
      title: 'Users to QPS',
      tag: 'concept',
      heading: 'Turn daily users into QPS',
      eli5: 'A day has about a hundred thousand seconds. Spreading the kids\' questions over all those seconds tells you how many arrive each second, the **QPS**.',
      body: [
        'There are 86,400 seconds in a day, close to 10⁵, and 3.15 × 10⁷ in a year. So QPS is users × actions ÷ 10⁵. With 100M daily users doing 10 actions each: 10⁸ × 10 ÷ 10⁵ = 10,000 QPS average.',
        'Traffic is not flat. Peak is about 3x the average, so plan for 30,000 QPS at the busiest moment. The next steps use that rule.',
      ],
      keyIdea: 'QPS is users × actions ÷ 10⁵ seconds. Peak is about 3x the average.',
      metrics: { op: '100M DAU x 10 actions', value: '10,000 QPS' },
      scene: {
        nodes: [
          { id: 'users', kind: 'block', at: at(-5, 0), label: '100M users', sub: 'daily', icon: 'Users', tint: 'blue' },
          { id: 'qps', kind: 'block', at: at(0, 0), label: '10,000 QPS', sub: 'average', icon: 'Gauge', tint: 'green', status: 'active', chips: [{ text: 'peak ~30,000', tone: 'warn' }] },
        ],
        links: [link('users', 'qps', { route: 'straight', label: '× 10 actions ÷ 10⁵ s' })],
        flows: [{ path: ['users', 'qps'], tone: 'request', count: 4, duration: 2 }],
        panel: {
          title: 'Seconds and peak',
          icon: 'Clock',
          rows: [
            { text: 'Seconds in a day', value: '86,400 ≈ 10⁵' },
            { text: 'Seconds in a year', value: '3.15 × 10⁷' },
            { text: 'Seconds in a month', value: '~2.6 × 10⁶' },
            { text: 'Peak versus average', value: '~3x', tone: 'warn' },
          ],
        },
        caption: 'Users to QPS in your head',
      },
      quiz: {
        question: 'An app has 50M daily users and each does 20 actions a day. Using the 86,400 trick (about 10⁵ seconds), what is the average QPS?',
        options: ['About 100', 'About 1,000', 'About 10,000', 'About 1 million'],
        answer: 2,
        explain: '50M × 20 = 10⁹ actions a day. Dividing by about 10⁵ seconds gives about 10,000 QPS on average.',
      },
    },
    {
      title: 'Standard box',
      tag: 'concept',
      heading: 'Pick one standard server shape',
      eli5: 'Every classroom gets the same size desk and the same number of shelves. Then counting how many classrooms we need is easy, because each one is a **standard box**.',
      body: [
        'Pick one "standard box" and use it everywhere. A commodity node today has 16 to 32 cores, 64 to 128 GB of RAM, 1 to 2 TB of NVMe and 1 to 10 Gbps of network.',
        'A big node has 64 to 128 cores, 512 GB to 2 TB of RAM, 8 to 30 TB of NVMe and 25 to 100 Gbps. Default to 32 cores, 128 GB, 2 TB and 1 Gbps.',
      ],
      keyIdea: 'One standard box keeps your arithmetic consistent and easy to check.',
      metrics: { op: 'Standard box', value: '32 cores · 128 GB · 2 TB · 1 Gbps' },
      scene: {
        nodes: [box({ status: 'active', chips: ['32 cores', '128 GB RAM', '2 TB NVMe', '1 Gbps'] })],
        panel: {
          title: 'Commodity versus big node',
          icon: 'Server',
          rows: [
            { text: 'CPU', value: '16 to 32  |  64 to 128 cores' },
            { text: 'RAM', value: '64 to 128 GB  |  0.5 to 2 TB' },
            { text: 'SSD', value: '1 to 2 TB  |  8 to 30 TB' },
            { text: 'Network', value: '1 to 10  |  25 to 100 Gbps' },
          ],
          footer: { text: 'Left is commodity, right is big', tone: 'muted' },
        },
        caption: 'One box shape for every estimate',
      },
    },
    {
      title: 'Throughput',
      tag: 'concept',
      heading: 'Latency is one call, throughput is the fleet',
      eli5: '**Throughput** is how many questions one helper can answer in a minute. A kid who answers in a blink can still only answer so many before the bell rings.',
      body: [
        'Latency says how long one operation takes. **Throughput** says how many a node finishes per second, and it is the number that turns traffic into a server count.',
        'At 10,000 QPS average and 30,000 at peak, one app server cannot carry the load. You need to know per-node throughput to count boxes.',
      ],
      keyIdea: 'Latency tells you how slow one call is. Throughput per node tells you how many boxes you need.',
      metrics: { op: 'Peak QPS', value: '30,000', node: '1K to 10K (app)' },
      scene: {
        nodes: [box({ label: 'app server', status: 'hot', load: 95, badge: '30K QPS arriving' })],
        panel: {
          title: 'Why per-node numbers matter',
          icon: 'Gauge',
          rows: [
            { text: 'Traffic at peak', value: '30,000 QPS', tone: 'warn' },
            { text: 'One REST app server', value: '1K to 10K QPS' },
            { text: 'Servers needed', value: '3 to 30', tone: 'bad' },
          ],
          footer: { text: 'Peak is about 3x the average', tone: 'muted' },
        },
        caption: 'One box saturates long before the traffic does',
      },
    },
    {
      title: 'App servers',
      tag: 'concept',
      heading: 'App servers: REST and gRPC',
      eli5: 'A helper who explains each answer in long sentences handles fewer kids than one who whispers a short code. Speaking **gRPC** is the short code.',
      body: [
        'A REST or HTTP app server handles `1K to 10K` requests per second. The limits are CPU, heap and open connections.',
        'A tight gRPC service handles `10K to 50K` QPS, limited by CPU and network, because its messages are smaller and cheaper to parse.',
      ],
      keyIdea: 'App servers are CPU bound. A compact protocol raises the ceiling several times.',
      metrics: { op: 'App server', value: '1K to 50K QPS', node: '1K to 10K (REST)' },
      scene: {
        nodes: [
          { id: 'rest', kind: 'block', at: at(-3.2, 0), label: 'REST server', sub: 'HTTP + JSON', icon: 'Braces', tint: 'blue', status: 'active', load: 70, chips: ['1K to 10K QPS'] },
          { id: 'grpc', kind: 'block', at: at(3.2, 0), label: 'gRPC service', sub: 'protobuf', icon: 'Zap', tint: 'green', status: 'ok', load: 45, chips: [{ text: '10K to 50K QPS', tone: 'good' }] },
        ],
        panel: {
          title: 'Per-node throughput',
          icon: 'Gauge',
          rows: [
            { text: 'REST / HTTP app server', value: '1K to 10K QPS', tone: 'warn' },
            { text: 'gRPC service (tight)', value: '10K to 50K QPS', tone: 'good' },
          ],
          footer: { text: 'Bottleneck: CPU, heap, connections', tone: 'muted' },
        },
        caption: 'Same box, different protocol',
      },
    },
    {
      title: 'SQL ceiling',
      tag: 'concept',
      heading: 'One SQL box is about 10K reads per second',
      eli5: 'The librarian checks the shelf for every question, so she can only answer so many per minute, and she must also write each new answer in her log before replying.',
      body: [
        'A SQL database gives about `10K` reads per second, limited by buffer pool and index lookups. Writes reach about `5K` per second, limited by flushing the write-ahead log and lock contention.',
        'Read the SQL number twice. A design that needs 500K reads per second needs caches, replicas or a different store, because one box never gets there.',
      ],
      keyIdea: 'One Postgres box serves about 10K reads per second, not 100K and not 1M. Scale with replicas or caches.',
      metrics: { op: 'Postgres', value: '~10K reads · 5K writes', node: '~10K/s' },
      metricTones: { node: 'warn' },
      scene: {
        nodes: [
          { ...box({ label: 'app servers', sub: '500K reads/s needed', at: at(-5, 0) }), status: 'active' },
          { id: 'pg', kind: 'db', at: at(3, 0), label: 'Postgres', sub: 'on SSD', status: 'hot', load: 100, badge: '10K reads · 5K writes' },
        ],
        links: [link('box', 'pg', { label: '500K reads/s', labelTone: 'warn' })],
        flows: [{ path: ['box', 'pg'], tone: 'request', count: 6, duration: 1.2 }],
        panel: {
          title: 'The gap',
          icon: 'Database',
          rows: [
            { text: 'Reads needed', value: '500,000/s', tone: 'bad' },
            { text: 'One SQL box gives', value: '10,000/s', tone: 'warn' },
            { text: 'Boxes needed', value: '50', tone: 'bad' },
          ],
          footer: { text: 'Replicas or caches close the gap', tone: 'good' },
        },
        caption: 'Most junior designs fail on this number',
      },
    },
    {
      title: 'Redis speed',
      tag: 'concept',
      heading: 'Redis and Memcached stay in RAM',
      eli5: 'The desk notebook answers in a blink, so the kid answers heaps of questions a minute. She is only limited by how fast the kids can shout questions at her.',
      body: [
        'Redis and Memcached do `100K to 200K` operations per second per node, because every operation stays in RAM.',
        'The limit is network and the single-threaded event loop, not the disk. One Redis node absorbs the read traffic of about ten SQL boxes.',
      ],
      keyIdea: 'In-memory stores trade capacity for speed, and a cache in front of SQL multiplies its reach about 10x.',
      metrics: { op: 'Redis', value: '100K to 200K ops/s', node: '100K to 200K/s' },
      metricTones: { node: 'good' },
      scene: {
        nodes: [
          { ...box({ label: 'app servers', sub: 'fleet', at: at(-5, 0) }), status: 'active' },
          { id: 'redis', kind: 'cache', at: at(2, 0), label: 'Redis', sub: 'in memory', status: 'ok', load: 55, badge: '100K to 200K ops/s' },
        ],
        links: [link('box', 'redis', { label: 'RAM only' })],
        flows: [{ path: ['box', 'redis'], tone: 'request', count: 8, duration: 0.8 }],
        panel: {
          title: 'Redis against SQL',
          icon: 'Zap',
          rows: [
            { text: 'Redis / Memcached', value: '100K to 200K ops/s', tone: 'good' },
            { text: 'SQL reads', value: '~10K/s', tone: 'warn' },
          ],
          footer: { text: 'Bottleneck: network, event loop', tone: 'muted' },
        },
        caption: 'The desk notebook is very fast',
      },
    },
    {
      title: 'Kafka speed',
      tag: 'concept',
      heading: 'Kafka writes in long sequential runs',
      eli5: 'Instead of finding a spot for every answer, one helper writes each new answer on the next line of a long scroll. Writing the next line is very quick.',
      body: [
        'A **Kafka** broker takes about `1M` small messages per second. It does not seek. It appends to a log and reads it back in long runs, the sequential pattern from part 1.',
        'The limits are sequential disk throughput and the network card. Sequential beats random by orders of magnitude.',
      ],
      keyIdea: 'Sequential access turns a disk into a very fast pipe. That is why logs and queues scale.',
      metrics: { op: 'Kafka broker', value: '~1M msgs/s', node: '~1M/s' },
      metricTones: { node: 'good' },
      scene: {
        nodes: [
          { ...box({ label: 'producers', sub: 'many apps', at: at(-5, 0) }), status: 'active' },
          { id: 'kafka', kind: 'queue', at: at(2, 0), label: 'Kafka broker', sub: 'sequential log', status: 'ok', badge: '~1M msgs/s' },
        ],
        links: [link('box', 'kafka', { label: 'append only' })],
        flows: [{ path: ['box', 'kafka'], tone: 'event', count: 8, duration: 0.9 }],
        panel: {
          title: 'Why so fast',
          icon: 'Rss',
          rows: [
            { text: 'Write pattern', value: 'append to a log', tone: 'good' },
            { text: 'Disk seeks', value: 'none', tone: 'good' },
            { text: 'Bottleneck', value: 'disk stream, NIC' },
          ],
        },
        caption: 'One long scroll, written line by line',
      },
    },
    {
      title: 'Other stores',
      tag: 'concept',
      heading: 'Cassandra, Elasticsearch and S3',
      eli5: 'Each helper in the school has a different speed. The scroll writer is fastest and the one who searches every word in the library is slowest. Knowing each speed tells you how many helpers to hire.',
      body: [
        'A Cassandra or DynamoDB node does `10K to 50K` operations per second. Compactions and the commit log are the limits.',
        'An Elasticsearch shard does `1K to 5K` QPS, limited by JVM heap and segment merges. S3 gives about 3,500 writes and 5,500 reads per second per prefix, so spread keys across prefixes.',
      ],
      keyIdea: 'Every store has a per-node ceiling and a bottleneck behind it. Memorize both.',
      metrics: { op: 'Store ceilings', value: '1K to 50K per node', node: 'varies by store' },
      scene: {
        nodes: [
          { id: 'cass', kind: 'shard', at: at(-5, 0), label: 'Cassandra', sub: 'or DynamoDB', status: 'active', chips: ['10K to 50K ops/s'] },
          { id: 'es', kind: 'search', at: at(0, 0), label: 'Elasticsearch', sub: 'one shard', chips: ['1K to 5K QPS'] },
          { id: 's3', kind: 'storage', at: at(5, 0), label: 'S3', sub: 'per prefix', chips: ['3,500 w · 5,500 r'] },
        ],
        panel: {
          title: 'Per-node throughput',
          icon: 'Table',
          rows: [
            { text: 'Cassandra / DynamoDB', value: '10K to 50K ops/s' },
            { text: 'Elasticsearch shard', value: '1K to 5K QPS' },
            { text: 'S3 per prefix', value: '3,500 w · 5,500 r /s' },
          ],
          footer: { text: 'Compactions, JVM heap, partitioning', tone: 'muted' },
        },
        caption: 'Each store has its own ceiling',
      },
    },
    {
      title: 'Bandwidth',
      tag: 'case',
      heading: 'Bandwidth runs out before CPU',
      eli5: 'The hallway between classrooms is only so wide. If every kid carries a big poster through it, the hallway jams even when the helpers are not busy.',
      body: [
        'Bandwidth is QPS times payload size. At 10K QPS with 10 KB responses, that is 100 MB per second, or 800 Mbps.',
        'That nearly fills a 1 Gbps network card on the standard box while the CPU is half asleep. Bandwidth runs out before CPU more often than juniors expect.',
      ],
      keyIdea: 'Multiply QPS by payload. If the answer is near the NIC limit, the network is your bottleneck.',
      metrics: { op: '10K QPS x 10 KB', value: '800 Mbps', node: '1 Gbps NIC' },
      metricTones: { value: 'warn', node: 'warn' },
      scene: {
        nodes: [
          box({ status: 'hot', load: 40, badge: 'CPU idle', chips: [{ text: '10K QPS', tone: 'default' }, { text: '800 Mbps out', tone: 'warn' }] }),
          { id: 'clients', kind: 'block', at: at(3, 0), label: 'clients', icon: 'Users', tint: 'gray' },
        ],
        links: [link('box', 'clients', { label: '1 Gbps NIC · 800 Mbps used', labelTone: 'warn' })],
        flows: [{ path: ['box', 'clients'], tone: 'response', count: 6, duration: 1.2 }],
        panel: {
          title: 'The multiplication',
          icon: 'Cable',
          rows: [
            { text: 'QPS', value: '10,000' },
            { text: 'Payload', value: '10 KB' },
            { text: 'Bandwidth', value: '100 MB/s = 800 Mbps', tone: 'warn' },
            { text: 'NIC', value: '1 Gbps' },
          ],
          footer: { text: '80% full with an idle CPU', tone: 'warn' },
        },
        caption: 'A full hallway, a bored helper',
      },
    },
    {
      title: 'Tail latency',
      tag: 'concept',
      heading: 'One slow call in a hundred ruins the page',
      eli5: 'If the kid asks 20 friends and each one is slow once in a hundred tries, she often ends up waiting for at least one slow friend. The page is as slow as its **slowest** question.',
      body: [
        'Averages hide the slow tail. The **p50** is the median, and the **p99** is the time that 99% of calls beat. Say 1 call in 100 is slower than the p99. A page that makes 20 calls gets at least one slow call 18% of the time, because 1 minus 0.99²⁰ is about 0.18.',
        'The numbers in this lesson are typical values. Real systems have a tail, and fan-out pushes users into it. A later lesson covers how to measure and tame it.',
      ],
      keyIdea: 'More calls per page means more chances to hit the slow tail. Count calls and look beyond averages.',
      metrics: { op: '20 calls, p99 slow', value: '18% pages slow', trips: '20' },
      metricTones: { value: 'warn' },
      scene: {
        nodes: [
          { ...app, status: 'active', chips: ['20 calls per page'] },
          { id: 'fast', kind: 'service', at: at(2, -3.8), label: '19 fast calls', sub: 'typical', status: 'ok', badge: '5 ms' },
          { id: 'slow', kind: 'service', at: at(2, 3.8), label: '1 slow call', sub: 'the tail', status: 'hot', badge: '500 ms' },
        ],
        links: [link('app', 'fast'), link('app', 'slow', { label: 'page waits here', labelTone: 'warn' })],
        flows: [
          { path: ['app', 'fast', 'app'], tone: 'request', count: 3, duration: 1.2 },
          { path: ['app', 'slow', 'app'], tone: 'error', duration: 3, delay: 0.3 },
        ],
        panel: {
          title: 'Chance a page hits a slow call',
          icon: 'TrendingUp',
          rows: [
            { text: '1 call at p99', value: '1%' },
            { text: '20 calls', value: '18%', tone: 'warn' },
            { text: '100 calls', value: '63%', tone: 'bad' },
          ],
          footer: { text: '1 − 0.99ⁿ', tone: 'muted' },
        },
        caption: 'The page waits for its slowest call',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Ladder, sizes, ceilings',
      eli5: 'Know where each answer lives, how big each answer is, and how many questions one helper can take. Then you know how many helpers the school needs.',
      body: [
        'The ladder: RAM `100 ns`, SSD `150 µs`, same-datacenter `500 µs`, cross-ocean `150 ms`. Remove round trips by batching, replicating or caching.',
        'Per node: REST 1K to 10K, SQL 10K reads and 5K writes, Redis 100K to 200K, Kafka 1M. Divide peak QPS by these to count boxes, then multiply by two for headroom.',
      ],
      keyIdea: 'Know the ladder, count the hops, and divide traffic by per-node throughput to size the fleet.',
      metrics: { op: 'Toolkit', value: 'ladder + sizes', node: 'SQL 10K · Redis 100K' },
      scene: {
        nodes: [
          { ...app, status: 'ok' },
          { ...cache, status: 'ok', badge: '~100 ns' },
          { ...replica, status: 'ok', badge: '0.5 ms' },
          { ...far, badge: '150 ms' },
        ],
        links: [link('app', 'cache'), link('app', 'replica'), link('app', 'far', { style: 'dashed' })],
        flows: [
          { path: ['app', 'cache', 'app'], tone: 'response', duration: 0.8 },
          { path: ['app', 'replica', 'app'], tone: 'response', duration: 1.6 },
          { path: ['app', 'far', 'app'], tone: 'response', duration: 5 },
        ],
        panel: {
          title: 'Per-node ceilings',
          icon: 'Gauge',
          rows: [
            { text: 'REST app server', value: '1K to 10K QPS' },
            { text: 'SQL reads · writes', value: '10K · 5K /s' },
            { text: 'Redis', value: '100K to 200K /s' },
            { text: 'Kafka broker', value: '~1M msgs/s' },
          ],
        },
      },
      quiz: {
        question: 'A request handler makes 5 sequential calls to a service on another continent (150 ms each) and does 2 ms of CPU work. Which change helps most?',
        options: [
          'Move the app to a server with a faster CPU',
          'Replace the hard disks with SSDs',
          'Batch the 5 calls into one, or serve the data from the same region',
          'Add more RAM to the app server',
        ],
        answer: 2,
        explain: 'The request spends 750 ms on round trips and 2 ms computing. Only removing round trips or shortening them changes the total in a meaningful way.',
      },
    },
  ],
};
