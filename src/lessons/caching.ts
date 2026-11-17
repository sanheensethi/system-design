import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const users: SceneNode = { id: 'users', kind: 'block', size: 0.8, at: at(-5.4, 0), label: 'shoppers', sub: '20,000 reads/s', icon: 'Users', tint: 'blue' };
const app: SceneNode = { id: 'app', kind: 'server', at: at(-1.8, 0), label: 'app servers', sub: 'product API' };
const cache: SceneNode = { id: 'cache', kind: 'cache', at: at(1.7, -2.7), label: 'Redis', sub: '64 GB · ~1 ms' };
const db: SceneNode = { id: 'db', kind: 'db', at: at(5.2, 2.7), label: 'Postgres', sub: '~10K reads/s max' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });
const baseLinks = [link('users', 'app'), link('app', 'cache'), link('app', 'db')];

export const caching: Lesson = {
  id: 'caching',
  title: 'Caching',
  tagline: 'Keep hot data in RAM so most reads never reach the database. Part 2 covers the ways it goes wrong.',
  minutes: 12,
  level: 'Intermediate',
  learn: [
    'When a cache pays off and when it does not',
    'The cache-aside read path: miss, fill, hit, and read-through',
    'How hit rate drives database load, latency and cache size',
    'The five cache layers from browser to database',
    'TTLs, invalidation on writes, and LRU, LFU and TinyLFU eviction',
    'Write-through, write-back, write-around and refresh-ahead',
  ],
  metrics: [
    { key: 'db', label: 'DB reads', icon: 'Database' },
    { key: 'hit', label: 'Hit rate', icon: 'Gauge' },
    { key: 'latency', label: 'Avg read', icon: 'Timer' },
    { key: 'dbcpu', label: 'DB CPU', icon: 'Cpu' },
  ],
  steps: [
    {
      title: 'DB melts',
      tag: 'problem',
      heading: 'The database is drowning in reads',
      eli5: 'Every order sends the cook down to the big basement pantry. The pantry is the **database**: it has everything, but the stairs are slow, and twice as many orders arrive as the stairs can handle.',
      body: [
        'Product pages get **20,000 reads per second** at peak. A single Postgres box handles about 10,000 indexed reads per second. We are asking for double that.',
        'The database CPU sits at 100%, queries queue, and the average read climbs from 10 ms to 900 ms.',
      ],
      keyIdea: 'When every read goes to the database, peak traffic can pass what one box can serve.',
      metrics: { db: '20,000/s', hit: '-', latency: '900 ms', dbcpu: '100%' },
      metricTones: { db: 'bad', latency: 'bad', dbcpu: 'bad' },
      scene: {
        nodes: [
          { ...users, chips: ['GET /products/42'] },
          { ...app, status: 'hot', load: 90 },
          { ...db, status: 'hot', load: 100, badge: '2x over capacity' },
        ],
        links: [link('users', 'app'), link('app', 'db', { label: '20,000/s vs 10,000/s', labelTone: 'warn' })],
        flows: [
          { path: ['users', 'app'], tone: 'request', count: 5, duration: 1 },
          { path: ['app', 'db'], tone: 'request', label: 'SELECT product 42', count: 5, duration: 1, delay: 1 },
          { path: ['db', 'app'], tone: 'response', duration: 3, delay: 2.1 },
        ],
        panel: {
          title: 'Demand against capacity',
          icon: 'Gauge',
          rows: [
            { text: 'Reads asked for', value: '20,000/s' },
            { text: 'Reads Postgres can answer', value: '10,000/s', tone: 'warn' },
            { text: 'Average read', value: '900 ms', tone: 'bad' },
          ],
          footer: { text: 'Queries queue behind each other', tone: 'bad' },
        },
        caption: 'Every read hits the database',
      },
    },
    {
      title: 'Hot set',
      tag: 'concept',
      heading: 'Most reads ask for the same few things',
      eli5: 'Most families order the same few dishes. The cook keeps walking down the stairs for the same soup, over and over, when a small **cache** shelf by the stove could hold it.',
      body: [
        'Traffic is skewed. About 5% of products (15 GB of a 300 GB catalog) get 95% of the views, so the same rows are read again and again.',
        'Read replicas would help, at the cost of more database servers. A cache is usually cheaper, because the data being read barely changes.',
      ],
      keyIdea: 'When reads repeat, paying the database to answer each one again is waste.',
      metrics: { db: '20,000/s', hit: '-', latency: '900 ms', dbcpu: '100%' },
      metricTones: { db: 'bad', latency: 'bad', dbcpu: 'bad' },
      scene: {
        nodes: [
          { ...app, status: 'active', chips: ['GET /products/42', 'GET /products/42', 'GET /products/7'] },
          { ...cache, status: 'dim', badge: 'a shelf for the hot set' },
          { ...db, status: 'hot', load: 100 },
        ],
        links: [link('app', 'cache'), link('app', 'db')],
        flows: [{ path: ['app', 'db'], tone: 'request', label: 'same rows again', count: 5, duration: 1.4 }],
        panel: {
          title: 'Who asks for what',
          icon: 'Table',
          rows: [
            { text: 'Top 5% of products', value: '95% of reads', tone: 'good' },
            { text: 'Other 95% of products', value: '5% of reads', tone: 'muted' },
            { text: 'Read replica', value: 'more DB servers', tone: 'warn' },
            { text: 'Cache', value: 'one small RAM tier', tone: 'good' },
          ],
        },
        caption: 'A small hot set serves most reads',
      },
    },
    {
      title: 'Good fit',
      tag: 'concept',
      heading: 'When a cache pays off, and when it does not',
      eli5: 'A shelf only helps if the same dishes get ordered again. If every family orders something brand new, the shelf is always empty and the cook still walks down.',
      body: [
        'Cache data that is **read often and changed rarely**, and where a slightly old answer is fine. Product pages, profiles and config qualify.',
        'A cache lives in volatile memory, so it is never the only copy. A restart empties it. Uniform access over a huge dataset gives no hot set, so the hit rate stays low and the cache adds a hop for nothing.',
      ],
      keyIdea: 'Caches need skewed reads, tolerate staleness, and never hold the only copy of anything.',
      metrics: { db: '20,000/s', hit: '-', latency: '900 ms', dbcpu: '100%' },
      scene: {
        nodes: [
          { ...app, status: 'active' },
          { ...cache, status: 'active', badge: 'RAM only' },
          { ...db, badge: 'source of truth' },
        ],
        links: [link('app', 'cache'), link('app', 'db')],
        flows: [{ path: ['app', 'cache'], tone: 'request', label: 'GET product:42', duration: 1.2 }],
        panel: {
          title: 'Is it a good cache candidate?',
          icon: 'Scale',
          rows: [
            { text: 'Read often, change rarely', value: 'yes', tone: 'good' },
            { text: 'Skewed: a small hot set', value: 'yes', tone: 'good' },
            { text: 'A stale answer is tolerable', value: 'yes', tone: 'good' },
            { text: 'Uniform access, huge dataset', value: 'no', tone: 'bad' },
            { text: 'Must be exactly current', value: 'no', tone: 'bad' },
          ],
        },
        caption: 'Check the access pattern before adding a cache',
      },
    },
    {
      title: 'Cache miss',
      tag: 'concept',
      heading: 'Cache-aside: check the cache first',
      eli5: 'The cook puts a small shelf next to the stove. That shelf is the **cache**. The first time a dish is ordered the shelf is empty, so the cook still walks to the pantry, then keeps some on the shelf for next time.',
      body: [
        'We add Redis, an in-memory key-value store that answers in about **1 ms** and handles 100,000+ operations per second per node.',
        'With **cache-aside** (lazy loading), the app asks the cache first. On a **miss** it reads the database, writes the result into the cache with a TTL, and returns it. A miss costs one extra 1 ms round trip.',
      ],
      keyIdea: 'Cache-aside fills the cache on demand: miss, read the source of truth, store, return.',
      metrics: { db: '20,000/s', hit: '0%', latency: '900 ms', dbcpu: '100%' },
      metricTones: { hit: 'bad', latency: 'bad' },
      scene: {
        nodes: [
          { ...app, status: 'active' },
          { ...cache, chips: [{ text: 'GET product:42 → nil', tone: 'warn' }], badge: 'miss' },
          { ...db, status: 'active', badge: '10 ms' },
        ],
        links: [link('app', 'cache'), link('app', 'db')],
        flows: [
          { path: ['app', 'cache'], tone: 'request', label: 'GET product:42', duration: 0.9 },
          { path: ['cache', 'app'], tone: 'response', label: 'nil', duration: 0.9, delay: 1 },
          { path: ['app', 'db'], tone: 'request', label: 'SELECT', duration: 0.9, delay: 2 },
          { path: ['db', 'app'], tone: 'response', label: 'row', duration: 0.9, delay: 3 },
          { path: ['app', 'cache'], tone: 'data', label: 'SET ex=300', duration: 0.9, delay: 4 },
        ],
        panel: {
          title: 'Cache-aside, in order',
          icon: 'List',
          rows: [
            { text: '1. GET the key from Redis', value: 'nil' },
            { text: '2. SELECT from Postgres', value: '10 ms' },
            { text: '3. SET the key with a TTL', value: '300 s' },
            { text: '4. Return the row' },
            { text: 'Key design: namespace, version, id', value: 'product:v2:42' },
          ],
        },
        caption: 'Miss: read the database, then fill the cache',
      },
      code: {
        language: 'python',
        title: 'Cache-aside with Redis',
        source: `import json, redis

r = redis.Redis(host="cache.internal")
TTL = 300  # seconds

def get_product(pid):
    key = f"product:{pid}"
    cached = r.get(key)
    if cached is not None:
        return json.loads(cached)               # hit: ~1 ms
    row = db.query_one("SELECT * FROM products WHERE id = %s", pid)
    r.set(key, json.dumps(row), ex=TTL)         # fill for next time
    return row

def update_price(pid, price):
    db.execute("UPDATE products SET price = %s WHERE id = %s", price, pid)
    r.delete(f"product:{pid}")                  # invalidate after the write`,
        highlight: [8, 9, 11, 12, 17],
      },
    },
    {
      title: 'Cache hit',
      tag: 'concept',
      heading: 'The second read never touches the database',
      eli5: 'The next time someone orders that dish, it is already on the shelf by the stove. That is a **cache hit**: no stairs, no pantry, food in a blink.',
      body: [
        'The next request for product 42 finds it in Redis. One round trip, about **1 ms**, and the database does no work at all.',
        'Within minutes of a deploy the hot keys are loaded and the hit rate climbs past 90%.',
      ],
      keyIdea: 'A cache is a bet that future reads look like recent reads. With skewed traffic, that bet pays off fast.',
      metrics: { db: '2,000/s', hit: '90%', latency: '2 ms', dbcpu: '20%' },
      metricTones: { db: 'good', hit: 'good', latency: 'good', dbcpu: 'good' },
      scene: {
        nodes: [
          { ...users, chips: ['GET /products/42'] },
          { ...app, status: 'active' },
          { ...cache, status: 'ok', chips: [{ text: 'GET product:42 → hit', tone: 'good' }], badge: '1 ms' },
          { ...db, status: 'dim', load: 20 },
        ],
        links: baseLinks,
        flows: [
          { path: ['users', 'app'], tone: 'request', duration: 1 },
          { path: ['app', 'cache'], tone: 'request', label: 'GET product:42', duration: 0.8, delay: 1 },
          { path: ['cache', 'app'], tone: 'response', label: '{name, price}', duration: 0.8, delay: 1.9 },
          { path: ['app', 'users'], tone: 'response', duration: 1, delay: 2.8 },
        ],
        caption: 'Hit: answered from RAM',
      },
    },
    {
      title: 'Hit rate math',
      tag: 'concept',
      heading: 'Every point of hit rate counts',
      eli5: 'The **hit rate** is how many orders out of 100 the shelf can fill. At 95, five trips go down to the pantry. At 99, only one does, so the stairs stay almost empty.',
      body: [
        'Database load is `reads × (1 − hit rate)`. At 20,000 reads per second, 90% sends 2,000 to the database, 95% sends 1,000 and 99% sends 200. Going from 90% to 99% cuts database load by **ten times**.',
        'Average latency is `1 ms + miss rate × 10 ms`. At 95% that is 1.5 ms, against 10 ms with no cache.',
      ],
      keyIdea: 'Database load scales with the miss rate, so small gains near the top of the hit rate pay off the most.',
      metrics: { db: '1,000/s', hit: '95%', latency: '1.5 ms', dbcpu: '10%' },
      metricTones: { db: 'good', hit: 'good', latency: 'good', dbcpu: 'good' },
      scene: {
        nodes: [
          { ...users, sub: '20,000 reads/s' },
          { ...app },
          { ...cache, status: 'ok', badge: '19,000/s hits' },
          { ...db, status: 'ok', load: 10, badge: '1,000/s misses' },
        ],
        links: baseLinks,
        flows: [
          { path: ['users', 'app'], tone: 'request', count: 5, duration: 1 },
          { path: ['app', 'cache', 'app'], tone: 'response', count: 5, duration: 1.2, delay: 1 },
          { path: ['app', 'db', 'app'], tone: 'request', duration: 1.6, delay: 1.4 },
        ],
        panel: {
          title: 'DB reads per second at 20,000 reads/s',
          icon: 'Table',
          rows: [
            { text: 'No cache', value: '20,000', tone: 'bad' },
            { text: '90% hit rate', value: '2,000' },
            { text: '95% hit rate', value: '1,000', tone: 'good' },
            { text: '99% hit rate', value: '200', tone: 'good' },
          ],
        },
        caption: '19 of every 20 reads stop at the cache',
      },
      quiz: {
        question: 'Reads are 20,000/s. You raise the hit rate from 95% to 99%. How many reads per second still reach the database?',
        options: ['1,000', '800', '200', '20'],
        answer: 2,
        explain: 'The database sees the misses: 20,000 × 1% = 200 reads per second, down from 1,000 at 95%.',
      },
    },
    {
      title: 'Sizing',
      tag: 'concept',
      heading: 'Size the cache to the hot set',
      eli5: 'The shelf only needs room for the favorite dishes. Making it as big as the whole pantry would cost a lot and barely help, because the rare dishes almost never get ordered.',
      body: [
        'To size a cache, find the hot set and fit it in RAM. Here the top 5% of products, about 15 GB of the 300 GB catalog, serve 95% of reads. Redis has 64 GB, so the hot set fits with room to spare for growth and overhead.',
        'Doubling the cache past that point adds little, because the extra room only holds keys that are rarely read. Watch hit rate, evictions and memory, and stop growing when the hit rate curve flattens.',
      ],
      keyIdea: 'Hit rate climbs steeply until the hot set fits, then flattens. Pay for RAM up to that point only.',
      metrics: { db: '1,000/s', hit: '95%', latency: '1.5 ms', dbcpu: '10%' },
      metricTones: { hit: 'good' },
      scene: {
        nodes: [
          { ...app, status: 'active' },
          { ...cache, status: 'ok', badge: '64 GB holds the hot set' },
          { ...db, sub: '300 GB catalog' },
        ],
        links: [link('app', 'cache'), link('app', 'db')],
        flows: [{ path: ['app', 'cache', 'app'], tone: 'response', count: 3, duration: 1.4 }],
        panel: {
          title: 'Hit rate as the cache grows',
          icon: 'TrendingUp',
          rows: [
            { text: '8 GB (too small)', value: '60%', tone: 'warn' },
            { text: '16 GB (about the hot set)', value: '93%' },
            { text: '64 GB (room to spare)', value: '95%', tone: 'good' },
            { text: '128 GB (double)', value: '95%', tone: 'muted' },
          ],
          footer: { text: 'Past the hot set, RAM buys little', tone: 'muted' },
        },
        caption: 'The curve flattens once the hot set fits',
      },
    },
    {
      title: 'Layers',
      tag: 'concept',
      heading: 'Caches exist at every layer',
      eli5: 'A restaurant has many shelves: a tiny one at your table, a bigger one near the door, one by the stove and one in the pantry. Each saves a trip to the next place.',
      body: [
        'This lesson is about the **application cache**, but a request can be answered at five layers: the **client** (browser cache), the **CDN** at the edge, the **web server** (a reverse proxy cache), the **application** cache like Redis, and the **database** itself (the buffer pool: `shared_buffers` and the OS page cache).',
        'The closer to the user, the faster and cheaper the hit. Each layer has its own invalidation rules.',
      ],
      keyIdea: 'A read passes through up to five caches. The earliest layer that has the answer wins.',
      metrics: { db: '1,000/s', hit: '95%', latency: '1.5 ms', dbcpu: '10%' },
      scene: {
        nodes: [
          { id: 'client', kind: 'block', size: 0.8, at: at(-5.4, -2.7), label: 'browser', sub: 'layer 1', icon: 'Laptop', tint: 'blue' },
          { id: 'edge', kind: 'block', size: 0.8, at: at(-2.3, -0.9), label: 'CDN + proxy', sub: 'layers 2 and 3', icon: 'Globe', tint: 'teal', chips: ['layer 2 · CDN', 'layer 3 · proxy'] },
          { ...cache, id: 'cache', at: at(0.9, 0.9), sub: 'layer 4 · app cache', status: 'active' },
          { ...db, at: at(3.8, 4.5), label: 'Postgres', sub: 'layer 5 · buffer pool' },
        ],
        links: [link('client', 'edge'), link('edge', 'cache'), link('cache', 'db')],
        flows: [
          { path: ['client', 'edge', 'cache', 'db'], tone: 'request', label: 'only on a miss', duration: 3 },
        ],
        panel: {
          title: 'Five places a read can stop',
          icon: 'Layers',
          rows: [
            { text: '1. Browser', value: 'Cache-Control' },
            { text: '2. CDN edge', value: 'nearest POP' },
            { text: '3. Web server proxy', value: 'whole pages' },
            { text: '4. Application (Redis)', value: 'objects, rows' },
            { text: '5. Database', value: 'shared_buffers' },
          ],
        },
        caption: 'The earliest cache with the answer wins',
      },
    },
    {
      title: 'Read-through',
      tag: 'concept',
      heading: 'Read-through: the cache fetches for you',
      eli5: 'Now the shelf has a helper. When the dish is missing, the helper goes to the pantry and fills the shelf, and the cook never leaves the stove.',
      body: [
        'In **read-through**, the app only talks to the cache. On a miss the cache layer itself loads from the database and stores the value. Application code stays free of cache logic.',
        'The trade is flexibility. A cache-aside app can cache any shape it likes, and keeps working if the cache is down by reading the database. A read-through library hides that choice.',
      ],
      keyIdea: 'Read-through moves the miss logic into the cache layer. Cache-aside keeps it in your code.',
      metrics: { db: '1,000/s', hit: '95%', latency: '1.5 ms', dbcpu: '10%' },
      scene: {
        nodes: [
          { ...app, status: 'active' },
          { ...cache, status: 'active', badge: 'loads on miss' },
          { ...db },
        ],
        links: [link('app', 'cache'), link('cache', 'db')],
        flows: [
          { path: ['app', 'cache'], tone: 'request', label: 'get(product:42)', duration: 1 },
          { path: ['cache', 'db'], tone: 'request', label: 'load on miss', duration: 1, delay: 1.1 },
          { path: ['db', 'cache'], tone: 'response', label: 'row', duration: 1, delay: 2.2 },
          { path: ['cache', 'app'], tone: 'response', label: 'row', duration: 1, delay: 3.3 },
        ],
        panel: {
          title: 'Who runs the miss logic?',
          icon: 'Split',
          rows: [
            { text: 'Cache-aside', value: 'your app code' },
            { text: 'Read-through', value: 'the cache layer' },
            { text: 'Cache-aside if cache is down', value: 'read the DB', tone: 'good' },
            { text: 'Read-through if cache is down', value: 'depends on library', tone: 'warn' },
          ],
        },
        caption: 'The app never sees the miss',
      },
    },
    {
      title: 'Stale data',
      tag: 'concept',
      heading: 'Invalidate on writes',
      eli5: 'When the pantry gets a new recipe, the cook throws away the old copy on the shelf. The next order fetches the new one.',
      body: [
        'A merchant drops product 42 from $50 to $40. The database has the new price, but the cache still says $50.',
        'In cache-aside, update the database first and then **delete** the cache key. The next read misses and fetches $40. Deleting beats overwriting when two writers race.',
        'It is not airtight. A slow reader can still re-fill the old value after the delete, and a crash between UPDATE and DEL skips it. The TTL on the next step bounds both.',
      ],
      keyIdea: 'Write to the database, then delete the cache key. The next read refills it with fresh data.',
      metrics: { db: '1,000/s', hit: '95%', latency: '1.5 ms', dbcpu: '10%' },
      scene: {
        nodes: [
          { ...users, label: 'merchant', sub: 'price update', icon: 'ShoppingBag', tint: 'amber' },
          { ...app, status: 'active' },
          { ...cache, status: 'active', chips: [{ text: 'price: $50 (stale)', tone: 'warn' }], badge: 'DEL product:42' },
          { ...db, status: 'active', badge: 'price = $40' },
        ],
        links: baseLinks,
        flows: [
          { path: ['users', 'app'], tone: 'request', label: 'PUT price $40', duration: 1 },
          { path: ['app', 'db'], tone: 'request', label: 'UPDATE', duration: 0.9, delay: 1.1 },
          { path: ['db', 'app'], tone: 'response', label: 'ok', duration: 0.9, delay: 2.1 },
          { path: ['app', 'cache'], tone: 'event', label: 'DEL', duration: 0.9, delay: 3.1 },
        ],
        panel: {
          title: 'Write path order',
          icon: 'List',
          rows: [
            { text: '1. UPDATE the database', value: '$40' },
            { text: '2. DEL the cache key', value: 'gone' },
            { text: '3. Next read misses', value: 'refills' },
            { text: 'Overwrite instead of delete', value: 'race risk', tone: 'warn' },
            { text: 'Reader refills old value after DEL', value: 'stale until TTL', tone: 'warn' },
            { text: 'Crash between UPDATE and DEL', value: 'stale until TTL', tone: 'warn' },
          ],
        },
        caption: 'Update the source of truth, then drop the cached copy',
      },
    },
    {
      title: 'TTL',
      tag: 'concept',
      heading: 'A TTL caps how long a mistake lives',
      eli5: 'Every item on the shelf has a timer called a **TTL**. Even if the cook forgets to throw an old one away, it gets tossed after five minutes.',
      body: [
        'A **TTL** (time to live) on every key, here 300 seconds, is the safety net. If an invalidation is lost or a race leaves a stale value, it lives at most five minutes.',
        'A key without a TTL can be wrong forever, and the cache slowly turns into a memory leak. Short TTLs mean fresher data and more misses. Long TTLs mean the reverse.',
      ],
      keyIdea: 'Always set a TTL. It bounds staleness and stops the cache from filling with forgotten keys.',
      metrics: { db: '1,000/s', hit: '95%', latency: '1.5 ms', dbcpu: '10%' },
      scene: {
        nodes: [
          { ...app, status: 'active' },
          { ...cache, status: 'active', chips: [{ text: 'product:42 ex=300', tone: 'good' }, { text: 'banner:old (no TTL)', tone: 'bad' }] },
          { ...db, status: 'dim' },
        ],
        links: [link('app', 'cache'), link('app', 'db')],
        flows: [{ path: ['app', 'cache'], tone: 'data', label: 'SET ex=300', duration: 1.2 }],
        panel: {
          title: 'Choosing a TTL',
          icon: 'Clock',
          rows: [
            { text: 'Short (seconds)', value: 'fresh, more misses' },
            { text: 'Long (hours)', value: 'stale, fewer misses' },
            { text: 'Product page', value: '300 s', tone: 'good' },
            { text: 'No TTL', value: 'stale forever', tone: 'bad' },
          ],
        },
        caption: 'Every key expires',
      },
    },
    {
      title: 'LRU',
      tag: 'concept',
      heading: 'When the cache is full: LRU eviction',
      eli5: 'The shelf is small and the pantry is huge. When the shelf is full, the cook removes whatever has sat untouched the longest. That rule is called **LRU**.',
      body: [
        'Redis has 64 GB. The catalog has 300 GB. Something has to go when a new key arrives and memory is full.',
        '**LRU** (least recently used) evicts the key nobody has read for the longest time, so popular products stay. Redis defaults to `noeviction`, which rejects writes once memory is full, so set `maxmemory 64gb` and `maxmemory-policy allkeys-lru`. Redis LRU is approximate: it samples a few keys.',
      ],
      keyIdea: 'A cache holds only the working set. Eviction decides what stays. LRU is the common choice, but you must set `maxmemory` and `allkeys-lru`, because Redis defaults to `noeviction`.',
      metrics: { db: '1,000/s', hit: '95%', latency: '1.5 ms', dbcpu: '10%' },
      scene: {
        nodes: [
          { ...app, status: 'active' },
          { ...cache, status: 'hot', load: 95, badge: '64 / 64 GB · evict LRU', chips: [{ text: 'evicted product:12', tone: 'warn' }] },
          { ...db, status: 'dim' },
        ],
        links: [link('app', 'cache'), link('app', 'db')],
        flows: [{ path: ['app', 'cache'], tone: 'data', label: 'SET product:9917', duration: 1.2 }],
        panel: {
          title: 'Recency order, oldest first',
          icon: 'Clock',
          rows: [
            { text: 'product:12', value: 'idle 9 min', tone: 'bad' },
            { text: 'product:88', value: 'idle 4 min', tone: 'warn' },
            { text: 'product:7', value: 'idle 20 s' },
            { text: 'product:42', value: 'idle 1 s', tone: 'good' },
          ],
          footer: { text: 'Redis evicts silently and never tells the app', tone: 'muted' },
        },
        caption: 'New keys push out the least recently used ones',
      },
    },
    {
      title: 'LFU',
      tag: 'concept',
      heading: 'LFU and TinyLFU: count uses, not recency',
      eli5: 'Another rule keeps the dishes ordered the most times, not the ones ordered most lately. A one-off party that orders 50 odd dishes will not push out the family favorites.',
      body: [
        '**LFU** (least frequently used) evicts the key with the fewest reads. It does better than LRU when popularity is stable over days, and it resists a one-time scan that touches many keys once. In Redis it is `allkeys-lfu`.',
        '**TinyLFU** and W-TinyLFU are modern hybrids that use compact counters to track frequency. Caffeine, a JVM cache, uses it. Watch the eviction counter: evicted hot keys mean the cache is too small.',
      ],
      keyIdea: 'LRU favors recent keys and LFU favors popular ones. TinyLFU blends both cheaply.',
      metrics: { db: '1,000/s', hit: '95%', latency: '1.5 ms', dbcpu: '10%' },
      scene: {
        nodes: [
          { ...app, status: 'active', chips: ['scan: 50,000 cold keys'] },
          { ...cache, status: 'active', badge: 'allkeys-lfu' },
          { ...db, status: 'dim' },
        ],
        links: [link('app', 'cache'), link('app', 'db')],
        flows: [{ path: ['app', 'cache'], tone: 'data', label: 'one-time keys', count: 4, duration: 1.4 }],
        panel: {
          title: 'A one-time scan hits the cache',
          icon: 'Table',
          rows: [
            { text: 'LRU', value: 'scan evicts hot keys', tone: 'bad' },
            { text: 'LFU', value: 'hot keys survive', tone: 'good' },
            { text: 'TinyLFU', value: 'hot keys survive, small counters', tone: 'good' },
          ],
        },
        caption: 'Frequency protects the favorites from one-off bursts',
      },
    },
    {
      title: 'Write-through',
      tag: 'tradeoff',
      heading: 'Write-through: fresh cache, slower writes',
      eli5: 'With **write-through**, the cook updates the shelf and the pantry book together before saying done. The shelf is never behind, but each order takes longer to finish.',
      body: [
        'Cache-aside invalidates on writes. In **write-through**, the cache layer owns the database write: the app writes to the cache, the cache writes to the database, and only then does the app get its ack.',
        'The cache is always fresh and every write pays both latencies. If the cache write succeeds and the database write fails, the stores disagree, so roll back or retry. Use it for data read right after a write, like a profile.',
      ],
      keyIdea: 'Write-through trades write latency for a cache that is never stale.',
      metrics: { db: '1,000/s', hit: '95%', latency: '1.5 ms', dbcpu: '10%' },
      scene: {
        nodes: [
          { ...users, label: 'user', sub: 'edits profile', icon: 'User', tint: 'blue' },
          { ...app, status: 'active' },
          { ...cache, status: 'active', badge: 'updated' },
          { ...db, status: 'active', badge: 'updated' },
        ],
        links: [link('users', 'app'), link('app', 'cache'), link('cache', 'db')],
        flows: [
          { path: ['users', 'app'], tone: 'request', label: 'PUT /profile', duration: 1 },
          { path: ['app', 'cache'], tone: 'data', label: 'write', duration: 0.9, delay: 1.1 },
          { path: ['cache', 'db'], tone: 'data', label: 'UPDATE', duration: 0.9, delay: 2.1 },
          { path: ['db', 'cache', 'app', 'users'], tone: 'response', label: 'ok after both', duration: 2.4, delay: 3.1 },
        ],
        panel: {
          title: 'Write-through cost',
          icon: 'Timer',
          rows: [
            { text: 'Cache write', value: '1 ms' },
            { text: 'Database write', value: '10 ms' },
            { text: 'Ack after both', value: '~11 ms', tone: 'warn' },
            { text: 'Cache write ok, DB write fails', value: 'roll back or retry', tone: 'bad' },
            { text: 'Next read', value: 'fresh hit', tone: 'good' },
          ],
        },
        caption: 'Both stores updated before the ack',
      },
    },
    {
      title: 'Write-back',
      tag: 'tradeoff',
      heading: 'Write-back: fast writes, risky ones',
      eli5: 'With **write-back**, the cook scribbles new notes on a pad at the shelf right away and carries the stack down to the pantry later. It is fast, but if the pad gets lost first, those notes are gone.',
      body: [
        '**Write-back** (write-behind) writes only to the cache and returns at once. A background process flushes changes to the database later, often in batches. Writes are very fast.',
        'If the cache node dies before the flush, those writes are gone. Use it only where losing a few seconds of writes is acceptable, such as view counters or likes. Never for payments or orders.',
      ],
      keyIdea: 'Write-back trades durability for speed. Only use it for data you can afford to lose a little of.',
      metrics: { db: '1,000/s', hit: '95%', latency: '1.5 ms', dbcpu: '10%' },
      scene: {
        nodes: [
          { ...users, sub: 'likes, views' },
          { ...app, status: 'active' },
          { ...cache, status: 'active', chips: [{ text: '500 unflushed likes', tone: 'warn' }], badge: 'write-back buffer' },
          { ...db, badge: 'batched flush' },
        ],
        links: [...baseLinks.slice(0, 2), link('cache', 'db', { style: 'dashed', label: 'async flush' })],
        flows: [
          { path: ['users', 'app', 'cache'], tone: 'request', label: 'like +1', count: 3, duration: 1.4 },
          { path: ['cache', 'app', 'users'], tone: 'response', label: 'ok in 1 ms', duration: 1.4, delay: 1.5 },
          { path: ['cache', 'db'], tone: 'data', label: 'flush 500 likes', duration: 1.6, delay: 3 },
        ],
        panel: {
          title: 'If the cache dies before the flush',
          icon: 'Bug',
          rows: [
            { text: 'View counter', value: 'lose a few views', tone: 'good' },
            { text: 'Likes', value: 'lose a few likes', tone: 'good' },
            { text: 'Payment', value: 'money lost', tone: 'bad' },
            { text: 'Order', value: 'order lost', tone: 'bad' },
          ],
        },
        caption: 'Write-back: acknowledge from RAM, persist later',
      },
      quiz: {
        question: 'Which data is the best fit for write-back caching?',
        options: ['Payment records', 'A like counter on a post', 'Customer orders', 'A user profile that must be read right after an edit'],
        answer: 1,
        explain: 'A like counter can lose a few seconds of updates without harm. Payments and orders must never be lost, and a profile read right after an edit suits write-through.',
      },
    },
    {
      title: 'Write-around',
      tag: 'tradeoff',
      heading: 'Write-around: skip the cache on writes',
      eli5: 'New recipes go straight into the pantry book. The shelf only gets a dish when someone actually orders it, so one-off recipes never crowd it.',
      body: [
        'In **write-around**, writes go straight to the database and skip the cache. A key enters the cache only when it is read. Data that is written once and rarely read, like logs or bulk imports, never pollutes the cache.',
        'The cost is that the first read after a write is always a miss. Pair it with an invalidating delete if the key may already be cached.',
      ],
      keyIdea: 'Write-around keeps write-heavy, read-rarely data out of the cache, at the price of a first-read miss.',
      metrics: { db: '1,000/s', hit: '95%', latency: '1.5 ms', dbcpu: '10%' },
      scene: {
        nodes: [
          { ...users, label: 'importer', sub: 'bulk upload', icon: 'Package', tint: 'gray' },
          { ...app, status: 'active' },
          { ...cache, status: 'dim', badge: 'untouched' },
          { ...db, status: 'active', badge: 'new rows' },
        ],
        links: baseLinks,
        flows: [
          { path: ['users', 'app', 'db'], tone: 'request', label: 'INSERT 10,000 rows', count: 3, duration: 2 },
        ],
        panel: {
          title: 'Write patterns compared',
          icon: 'Table',
          rows: [
            { text: 'Write-through', value: 'cache + DB', tone: 'good' },
            { text: 'Write-back', value: 'cache, DB later', tone: 'warn' },
            { text: 'Write-around', value: 'DB only' },
            { text: 'First read after write-around', value: 'miss', tone: 'warn' },
          ],
        },
        caption: 'Writes bypass the cache',
      },
    },
    {
      title: 'Refresh-ahead',
      tag: 'concept',
      heading: 'Refresh-ahead: reload before it expires',
      eli5: 'A helper watches the timer on the favorite dish. Just before it runs out, the helper goes to the pantry and restocks, so nobody ever finds the shelf empty.',
      body: [
        '**Refresh-ahead** reloads an entry shortly before its TTL ends, usually only for keys that were read recently. Readers never see the slow rebuild, and latency stays flat.',
        'It suits predictable hot keys, like a homepage or a leaderboard. It wastes work on keys nobody reads again, so refresh only keys that are still being asked for.',
      ],
      keyIdea: 'Refresh-ahead hides the rebuild time for hot keys by renewing them before they expire.',
      metrics: { db: '1,000/s', hit: '95%', latency: '1.5 ms', dbcpu: '10%' },
      scene: {
        nodes: [
          { ...app, status: 'active' },
          { ...cache, status: 'ok', chips: [{ text: 'deal:today ttl 8 s left', tone: 'warn' }], badge: 'refresh now' },
          { ...db, status: 'active', badge: 'rebuild' },
        ],
        links: [link('app', 'cache'), link('app', 'db')],
        flows: [
          { path: ['app', 'db'], tone: 'request', label: 'rebuild early', duration: 1.2 },
          { path: ['db', 'app'], tone: 'response', duration: 1.2, delay: 1.3 },
          { path: ['app', 'cache'], tone: 'data', label: 'SET ex=60', duration: 1, delay: 2.6 },
        ],
        panel: {
          title: 'Refresh-ahead rule',
          icon: 'Repeat',
          rows: [
            { text: 'TTL', value: '60 s' },
            { text: 'Refresh when under', value: '10 s left', tone: 'good' },
            { text: 'Only if read recently', value: 'yes', tone: 'good' },
            { text: 'Unread keys', value: 'let expire', tone: 'muted' },
          ],
        },
        caption: 'Renew the hot key before readers notice',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Cache the hot set, and set it up on purpose',
      eli5: 'Keep the favorite dishes on the **cache** shelf by the stove, toss old ones on a timer, and decide up front how the shelf and the pantry book get updated.',
      body: [
        '**Cache-aside** checks the cache, falls back to the database on a miss and fills the cache. With skewed traffic a 95% hit rate cut database reads from 20,000 to 1,000 per second and the average read from 900 ms to 1.5 ms.',
        'Writes delete the key, every key gets a TTL, and **LRU** or **LFU** keeps the hot set in a cache smaller than the data. Pick write-through, write-back or write-around by how much staleness and loss you can accept. Part 2 covers what breaks.',
      ],
      keyIdea: 'A cache makes the database look bigger than it is, so size it to the hot set and give every key a way out.',
      metrics: { db: '1,000/s', hit: '95%', latency: '1.5 ms', dbcpu: '10%' },
      metricTones: { db: 'good', hit: 'good', latency: 'good', dbcpu: 'good' },
      scene: {
        nodes: [users, app, { ...cache, status: 'ok' }, { ...db, load: 10 }],
        links: baseLinks,
        flows: [
          { path: ['users', 'app', 'cache', 'app', 'users'], tone: 'response', count: 3, duration: 2.4 },
          { path: ['app', 'db', 'app'], tone: 'request', duration: 1.6, delay: 1 },
        ],
        panel: {
          title: 'The cache checklist',
          icon: 'List',
          rows: [
            { text: 'Skewed, read-heavy data', value: 'cache it', tone: 'good' },
            { text: 'Every key', value: 'TTL + invalidate' },
            { text: 'Eviction', value: 'maxmemory + allkeys-lru', tone: 'good' },
            { text: 'Fresh after writes', value: 'write-through' },
            { text: 'Loss is fine', value: 'write-back' },
          ],
        },
      },
      quiz: {
        question: 'Redis has 64 GB, but writes start failing once memory fills. What is the most likely cause?',
        options: [
          'The eviction policy is still the default, noeviction',
          'The TTL is too long',
          'The hit rate is too high',
          'The app uses cache-aside instead of read-through',
        ],
        answer: 0,
        explain: 'Redis defaults to noeviction and sets no memory limit unless maxmemory is configured. Set maxmemory and a policy such as allkeys-lru so it evicts instead of rejecting writes.',
      },
    },
  ],
};
