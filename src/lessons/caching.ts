import type { Lesson, SceneNode } from '../engine/types';

const users: SceneNode = { id: 'users', kind: 'client', at: [-5.5, 0], label: 'shoppers', sub: '20,000 reads/s' };
const app: SceneNode = { id: 'app', kind: 'server', at: [-1.5, 0], label: 'app servers', sub: 'product API' };
const cache: SceneNode = { id: 'cache', kind: 'cache', at: [2, -2.6], label: 'Redis', sub: '64 GB · ~1 ms' };
const db: SceneNode = { id: 'db', kind: 'db', at: [3.5, 1.5], label: 'Postgres', sub: '~10K reads/s max' };

const baseLinks = [
  { from: 'users', to: 'app' },
  { from: 'app', to: 'cache' },
  { from: 'app', to: 'db' },
];

export const caching: Lesson = {
  id: 'caching',
  title: 'Caching',
  tagline: 'Keep hot data in RAM so most reads never reach the database, and learn the ways it goes wrong.',
  minutes: 13,
  level: 'Intermediate',
  learn: [
    'The cache-aside read path: miss, fill, hit',
    'How hit rate drives database load and latency',
    'TTLs, invalidation on writes, and LRU eviction',
    'Write-through versus write-back',
    'Cache stampedes on a hot key and how to stop them',
  ],
  metrics: [
    { key: 'db', label: 'DB reads' },
    { key: 'hit', label: 'Hit rate' },
    { key: 'latency', label: 'Avg read' },
    { key: 'dbcpu', label: 'DB CPU' },
  ],
  steps: [
    {
      title: 'DB melts',
      tag: 'problem',
      heading: 'The database is drowning in reads',
      eli5: 'Every order sends the cook down to the big basement pantry. The pantry is the **database**: it has everything, but the stairs are slow, and twice as many orders arrive as the stairs can handle.',
      body: [
        'Product pages get **20,000 reads per second** at peak. A single Postgres box handles about 10,000 indexed reads per second. We are asking for double that.',
        'The database CPU sits at 100%, queries queue, and the average read climbs from 10 ms to 900 ms. Yet most of those reads ask for the same few thousand popular products, over and over.',
        'Read replicas would help, at the cost of more database servers. A cache is usually cheaper, because the data being read barely changes.',
      ],
      keyIdea: 'When most reads ask for the same small set of data, paying the database to answer each one again is waste.',
      metrics: { db: '20,000/s', hit: '-', latency: '900 ms', dbcpu: '100%' },
      scene: {
        nodes: [users, { ...app, status: 'hot', badge: 'waiting on DB' }, { ...db, status: 'hot', badge: '2x over capacity' }],
        links: [{ from: 'users', to: 'app' }, { from: 'app', to: 'db' }],
        flows: [
          { path: ['users', 'app'], tone: 'request', count: 5, duration: 1 },
          { path: ['app', 'db'], tone: 'request', label: 'SELECT product 42', count: 5, duration: 1, delay: 1 },
          { path: ['db', 'app'], tone: 'response', duration: 3, delay: 2.1 },
        ],
        caption: 'Every read hits the database',
      },
    },
    {
      title: 'Cache miss',
      tag: 'concept',
      heading: 'Cache-aside: check the cache first',
      eli5: 'The cook puts a small shelf next to the stove. That shelf is the **cache**. The first time a dish is ordered the shelf is empty, so the cook still walks to the pantry, then keeps some on the shelf for next time.',
      body: [
        'We add Redis, an in-memory key-value store that answers in about **1 ms** and handles 100,000+ operations per second per node.',
        'With **cache-aside** (also called lazy loading), the app asks the cache first. On a **miss** it reads the database, writes the result into the cache with a TTL, and returns it. The cache only ever holds data someone asked for.',
        'A miss costs a little more than going straight to the database: one extra cache round trip of about 1 ms. While the cache is cold, the database is still overloaded. The payoff comes on the next request.',
      ],
      keyIdea: 'Cache-aside fills the cache on demand: miss, read the source of truth, store, return.',
      metrics: { db: '20,000/s', hit: '0%', latency: '900 ms', dbcpu: '100%' },
      scene: {
        nodes: [users, { ...app, status: 'active' }, { ...cache, badge: 'miss' }, { ...db, status: 'active', badge: '10 ms' }],
        links: baseLinks,
        flows: [
          { path: ['app', 'cache'], tone: 'request', label: 'GET product:42', duration: 0.9 },
          { path: ['cache', 'app'], tone: 'response', label: 'nil', duration: 0.9, delay: 1 },
          { path: ['app', 'db'], tone: 'request', label: 'SELECT', duration: 0.9, delay: 2 },
          { path: ['db', 'app'], tone: 'response', label: 'row', duration: 0.9, delay: 3 },
          { path: ['app', 'cache'], tone: 'data', label: 'SET ex=300', duration: 0.9, delay: 4 },
        ],
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
        'Product traffic is skewed. Roughly 20% of products get 80% of the views, so a cache that holds the popular fifth of the catalog answers most requests. Within minutes of a deploy the hot keys are loaded and the hit rate climbs past 90%.',
      ],
      keyIdea: 'A cache is a bet that future reads look like recent reads. With skewed traffic, that bet pays off fast.',
      metrics: { db: '2,000/s', hit: '90%', latency: '2 ms', dbcpu: '20%' },
      scene: {
        nodes: [users, app, { ...cache, status: 'ok', badge: 'hit' }, { ...db, status: 'dim' }],
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
        'Database load is `reads × (1 − hit rate)`. At 20,000 reads per second, a 90% hit rate sends 2,000 to the database. At 95% it is 1,000. At 99% it is 200. Going from 90% to 99% cuts database load by **ten times**.',
        'Average latency follows the same shape: `1 ms + miss rate × 10 ms`. At 95% that is 1.5 ms, against 10 ms with no cache, and the slow tail now only hits the 5% of misses.',
        'To size the cache, take the hot set (the 20% of data that serves 80% of reads) and fit that in RAM. Doubling the cache past that point adds little.',
      ],
      keyIdea: 'Database load scales with the miss rate, so small gains near the top of the hit rate pay off the most.',
      metrics: { db: '1,000/s', hit: '95%', latency: '1.5 ms', dbcpu: '10%' },
      scene: {
        nodes: [users, { ...app, badge: '20,000 reads/s' }, { ...cache, status: 'ok', badge: '19,000/s hits' }, { ...db, status: 'ok', badge: '1,000/s misses' }],
        links: baseLinks,
        flows: [
          { path: ['users', 'app'], tone: 'request', count: 5, duration: 1 },
          { path: ['app', 'cache', 'app'], tone: 'response', count: 5, duration: 1.2, delay: 1 },
          { path: ['app', 'db', 'app'], tone: 'request', duration: 1.6, delay: 1.4 },
        ],
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
      title: 'Stale data',
      tag: 'concept',
      heading: 'TTL and invalidation on writes',
      eli5: 'When the pantry gets a new recipe, the cook throws away the old one on the shelf. Every shelf item also has a timer called a **TTL**, so even a forgotten old one gets tossed after five minutes.',
      body: [
        'A merchant drops the price of product 42 from $50 to $40. The database has the new price, but the cache still says $50. Shoppers now see a stale price.',
        'In cache-aside, the write path updates the database first and then **deletes** the cache key. The next read misses and fetches $40. Deleting is safer than overwriting, because two racing writers cannot leave an old value behind as easily.',
        'A **TTL** on every key (here 300 seconds) is the safety net. If an invalidation is lost, the wrong value lives at most five minutes. A key without a TTL can be wrong forever, and the cache slowly turns into a memory leak.',
      ],
      keyIdea: 'Write to the database, then delete the cache key. Always set a TTL to cap how long a mistake can live.',
      metrics: { db: '1,000/s', hit: '95%', latency: '1.5 ms', dbcpu: '10%' },
      scene: {
        nodes: [{ ...users, label: 'merchant', sub: 'price update' }, { ...app, status: 'active' }, { ...cache, status: 'active', badge: 'DEL product:42' }, { ...db, status: 'active', badge: 'price = $40' }],
        links: baseLinks,
        flows: [
          { path: ['users', 'app'], tone: 'request', label: 'PUT price $40', duration: 1 },
          { path: ['app', 'db'], tone: 'request', label: 'UPDATE', duration: 0.9, delay: 1.1 },
          { path: ['db', 'app'], tone: 'response', label: 'ok', duration: 0.9, delay: 2.1 },
          { path: ['app', 'cache'], tone: 'event', label: 'DEL', duration: 0.9, delay: 3.1 },
        ],
        caption: 'Update the source of truth, then drop the cached copy',
      },
    },
    {
      title: 'Eviction',
      tag: 'concept',
      heading: 'When the cache is full: LRU eviction',
      eli5: 'The shelf is small and the pantry is huge. When the shelf is full, the cook removes whatever has sat untouched the longest. That rule is called **LRU**.',
      body: [
        'Redis has 64 GB. The catalog has 300 GB. Something has to go when a new key arrives and memory is full.',
        '**LRU** (least recently used) evicts the key nobody has read for the longest time. It matches skewed traffic well: popular products keep getting touched and stay, while the long tail cycles through. **LFU** (least frequently used) does better when popularity is stable over days.',
        'In Redis you pick this with `maxmemory-policy allkeys-lru`. Watch the eviction counter. If hot keys are being evicted, the hit rate drops and the cache is too small for the hot set.',
      ],
      keyIdea: 'A cache holds only the working set. Eviction decides what stays, and LRU is the usual default.',
      metrics: { db: '1,000/s', hit: '95%', latency: '1.5 ms', dbcpu: '10%' },
      scene: {
        nodes: [users, { ...app, status: 'active' }, { ...cache, status: 'hot', badge: '64 / 64 GB · evict LRU' }, { ...db, status: 'dim' }],
        links: baseLinks,
        flows: [
          { path: ['app', 'cache'], tone: 'data', label: 'SET product:9917', duration: 1 },
          { path: ['cache', 'app'], tone: 'response', label: 'evicted product:12', duration: 1, delay: 1.1 },
        ],
        caption: 'New keys push out the least recently used ones',
      },
    },
    {
      title: 'Write strategies',
      tag: 'tradeoff',
      heading: 'Write-through or write-back?',
      eli5: 'With **write-back**, the cook scribbles new notes on a pad at the shelf right away and carries the stack down to the pantry later. It is fast, but if the pad gets lost first, those notes are gone.',
      body: [
        'Cache-aside invalidates on writes. Two other patterns put the cache on the write path. **Write-through** writes to the cache and the database together and returns once both succeed. The cache is always fresh for recently written data, and every write pays both latencies.',
        '**Write-back** (write-behind) writes only to the cache and returns at once. A background process flushes changes to the database later, often in batches. Writes are very fast, but if the cache node dies before the flush, those writes are gone.',
        'Use write-through for data that is read right after it is written, such as a user profile. Use write-back only where losing a few seconds of writes is acceptable, such as view counters or likes. Never for payments or orders.',
      ],
      keyIdea: 'Write-through trades write latency for freshness. Write-back trades durability for speed.',
      metrics: { db: '1,000/s', hit: '95%', latency: '1.5 ms', dbcpu: '10%' },
      scene: {
        nodes: [{ ...users, sub: 'likes, profile edits' }, { ...app, status: 'active' }, { ...cache, status: 'active', badge: 'write-back buffer' }, { ...db, badge: 'batched flush' }],
        links: [...baseLinks, { from: 'cache', to: 'db', style: 'dashed', label: 'async flush' }],
        flows: [
          { path: ['users', 'app', 'cache'], tone: 'request', label: 'like +1', count: 3, duration: 1.4 },
          { path: ['cache', 'app', 'users'], tone: 'response', label: 'ok in 1 ms', duration: 1.4, delay: 1.5 },
          { path: ['cache', 'db'], tone: 'data', label: 'flush 500 likes', duration: 1.6, delay: 3 },
        ],
        caption: 'Write-back: acknowledge from RAM, persist later',
      },
    },
    {
      title: 'Stampede',
      tag: 'case',
      heading: 'Case: the hot key expires at noon',
      eli5: 'The most popular dish runs out on the shelf at noon. Every cook runs down to the pantry for it at the same moment and the stairs jam. That crush is a **cache stampede**.',
      body: [
        'The homepage shows a deal of the day, built by a 200 ms aggregation query and cached under one key with a 60-second TTL. At noon, 10,000 people are on the homepage.',
        'The key expires. In the next 200 ms every one of those requests misses and runs the same heavy query at once. This is a **cache stampede**, or thundering herd. The database CPU jumps to 100%, the query slows to seconds, and requests for every other page start timing out.',
        'The cache was hiding how little spare capacity the database had. One expiry exposed it.',
      ],
      keyIdea: 'A popular key expiring turns thousands of cache hits into thousands of identical database queries in the same instant.',
      metrics: { db: '10,000/s', hit: '50%', latency: '1,800 ms', dbcpu: '100%' },
      scene: {
        nodes: [
          { ...users, status: 'hot', sub: '10,000 on homepage' },
          { ...app, status: 'hot' },
          { ...cache, badge: 'deal:today expired' },
          { ...db, status: 'hot', badge: '10,000 x same query' },
        ],
        links: baseLinks,
        flows: [
          { path: ['users', 'app'], tone: 'request', count: 6, duration: 0.9 },
          { path: ['app', 'cache'], tone: 'request', count: 6, duration: 0.7, delay: 0.9 },
          { path: ['cache', 'app'], tone: 'error', label: 'miss', count: 6, duration: 0.7, delay: 1.7 },
          { path: ['app', 'db'], tone: 'request', label: 'heavy query', count: 6, duration: 1, delay: 2.5 },
        ],
        caption: 'Every request misses at the same moment',
      },
    },
    {
      title: 'Stop the herd',
      tag: 'concept',
      heading: 'One rebuild, everyone else waits',
      eli5: 'Now only one cook goes down for the popular dish, and the others wait by the shelf until it is refilled. Sending just one is called **single-flight**.',
      body: [
        '**Single-flight** (request coalescing): the first request to miss takes a short lock in Redis with `SET NX` and rebuilds the value. Everyone else waits a few milliseconds and reads the fresh value. The database runs the query once instead of 10,000 times.',
        '**Stale-while-revalidate** goes further: keep serving the old value while one worker refreshes it in the background, so nobody waits. **Jitter** adds a random few seconds to each TTL, so keys written together do not all expire together.',
      ],
      keyIdea: 'For hot keys, make sure only one request ever rebuilds a value, and never let many keys expire on the same tick.',
      metrics: { db: '1,000/s', hit: '95%', latency: '1.5 ms', dbcpu: '10%' },
      scene: {
        nodes: [users, { ...app, status: 'active', badge: '1 holds lock' }, { ...cache, status: 'ok', badge: 'lock:deal:today' }, { ...db, status: 'ok', badge: '1 query' }],
        links: baseLinks,
        flows: [
          { path: ['app', 'cache'], tone: 'request', label: 'SET lock NX', duration: 0.8 },
          { path: ['app', 'db'], tone: 'request', label: 'rebuild once', duration: 1, delay: 0.9 },
          { path: ['db', 'app'], tone: 'response', duration: 1, delay: 2 },
          { path: ['app', 'cache'], tone: 'data', label: 'SET deal:today', duration: 0.8, delay: 3.1 },
          { path: ['cache', 'app'], tone: 'response', label: 'waiters read it', count: 4, duration: 0.8, delay: 4 },
        ],
        caption: 'One request rebuilds, the rest reuse it',
      },
      code: {
        language: 'python',
        title: 'Single-flight rebuild with a Redis lock',
        source: `def get_hot(key, loader, ttl=60):
    val = r.get(key)
    if val is not None:
        return json.loads(val)
    # Only one caller rebuilds. NX = set only if the lock is absent.
    if r.set(f"lock:{key}", "1", nx=True, ex=5):
        try:
            val = loader()                                  # the heavy query
            jitter = random.randint(0, 10)                  # spread expiries
            r.set(key, json.dumps(val), ex=ttl + jitter)
            return val
        finally:
            r.delete(f"lock:{key}")
    time.sleep(0.05)                                        # wait, then reread
    return get_hot(key, loader, ttl)`,
        highlight: [6, 8, 9, 10, 14],
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Cache the hot set, and plan for its failures',
      eli5: 'Keep the favorite dishes on the **cache** shelf by the stove, toss old ones on a timer, and never let all the cooks rush the pantry stairs at once.',
      body: [
        '**Cache-aside** checks the cache, falls back to the database on a miss and fills the cache. With skewed traffic a 95% hit rate cut database reads from 20,000 to 1,000 per second and the average read from 900 ms to 1.5 ms.',
        'Writes delete the key, every key gets a TTL, and **LRU** keeps the hot set in a cache smaller than the data. Write-through and write-back move the cache onto the write path, with a cost in latency or durability. Hot keys need stampede protection: single-flight, stale-while-revalidate and TTL jitter.',
      ],
      keyIdea: 'A cache makes the database look bigger than it is, so design for the moment the cache misses.',
      metrics: { db: '1,000/s', hit: '95%', latency: '1.5 ms', dbcpu: '10%' },
      scene: {
        nodes: [users, app, { ...cache, status: 'ok' }, db],
        links: baseLinks,
        flows: [
          { path: ['users', 'app', 'cache', 'app', 'users'], tone: 'response', count: 3, duration: 2.4 },
          { path: ['app', 'db', 'app'], tone: 'request', duration: 1.6, delay: 1 },
        ],
      },
      quiz: {
        question: 'A popular key with a 60 s TTL expires and the database spikes to 100% CPU every minute. Which fix addresses the cause?',
        options: [
          'Remove the TTL so the key never expires',
          'Add more app servers',
          'Let only one request rebuild the key (single-flight) or serve stale while one refreshes',
          'Switch the eviction policy from LRU to LFU',
        ],
        answer: 2,
        explain: 'The spike comes from many requests rebuilding the same key at once. Single-flight or stale-while-revalidate makes it one rebuild. Removing the TTL trades the stampede for stale data.',
      },
    },
  ],
};
