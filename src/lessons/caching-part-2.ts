import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const users: SceneNode = { id: 'users', kind: 'block', size: 0.8, at: at(-5.4, 0), label: 'shoppers', sub: '20,000 reads/s', icon: 'Users', tint: 'blue' };
const app: SceneNode = { id: 'app', kind: 'server', at: at(-1.8, 0), label: 'app servers', sub: 'product API' };
const cache: SceneNode = { id: 'cache', kind: 'cache', at: at(1.7, -2.7), label: 'Redis', sub: '64 GB · ~1 ms' };
const db: SceneNode = { id: 'db', kind: 'db', at: at(5.2, 2.7), label: 'Postgres', sub: '~10K reads/s max' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });
const baseLinks = [link('users', 'app'), link('app', 'cache'), link('app', 'db')];

export const cachingPart2: Lesson = {
  id: 'caching-part-2',
  title: 'Caching (part 2)',
  tagline: 'Stampedes, penetration and avalanches, then keeping the cache itself alive, tiered and sharded.',
  minutes: 14,
  level: 'Intermediate',
  learn: [
    'Stampedes, and how single-flight, stale-while-revalidate and jitter stop them',
    'Penetration, avalanches and warming a cold cache',
    'Cache availability: replicas, failover and circuit breakers',
    'L1 and L2 tiers and their staleness trade-off',
    'Sharding a cache with consistent hashing, Redis versus Memcached, and what to monitor',
  ],
  metrics: [
    { key: 'db', label: 'DB reads', icon: 'Database' },
    { key: 'hit', label: 'Hit rate', icon: 'Gauge' },
    { key: 'latency', label: 'Avg read', icon: 'Timer' },
    { key: 'dbcpu', label: 'DB CPU', icon: 'Cpu' },
  ],
  steps: [
    {
      title: 'Stampede',
      tag: 'case',
      heading: 'Case: the hot key expires at noon',
      eli5: 'The most popular dish runs out on the shelf at noon. Every cook runs down to the pantry for it at the same moment and the stairs jam. That crush is a **cache stampede**.',
      body: [
        'The homepage shows a deal of the day, built by a 200 ms aggregation query and cached under one key with a 60-second TTL. At noon, 10,000 people are on the homepage.',
        'The key expires. In the next 200 ms every one of those requests misses and runs the same heavy query at once. This is a **cache stampede**, or thundering herd. The database CPU hits 100% and requests for every other page start timing out.',
      ],
      keyIdea: 'A popular key expiring turns thousands of cache hits into thousands of identical database queries in the same instant.',
      metrics: { db: '10,000/s', hit: '50%', latency: '1,800 ms', dbcpu: '100%' },
      metricTones: { db: 'bad', hit: 'bad', latency: 'bad', dbcpu: 'bad' },
      scene: {
        nodes: [
          { ...users, status: 'hot', sub: '10,000 on homepage' },
          { ...app, status: 'hot', load: 90 },
          { ...cache, chips: [{ text: 'deal:today expired', tone: 'bad' }], badge: 'miss' },
          { ...db, status: 'hot', load: 100, badge: '10,000 x same query' },
        ],
        links: baseLinks,
        flows: [
          { path: ['users', 'app'], tone: 'request', count: 6, duration: 0.9 },
          { path: ['app', 'cache'], tone: 'request', count: 6, duration: 0.7, delay: 0.9 },
          { path: ['cache', 'app'], tone: 'error', label: 'miss', count: 6, duration: 0.7, delay: 1.7 },
          { path: ['app', 'db'], tone: 'request', label: 'heavy query', count: 6, duration: 1, delay: 2.5 },
        ],
        panel: {
          title: 'The noon spike',
          icon: 'Activity',
          rows: [
            { text: 'Key TTL', value: '60 s' },
            { text: 'Rebuild query', value: '200 ms', tone: 'warn' },
            { text: 'Requests in that window', value: '10,000', tone: 'bad' },
            { text: 'Rebuilds that run', value: '10,000', tone: 'bad' },
          ],
          footer: { text: 'The cache hid how little spare DB capacity there was', tone: 'bad' },
        },
        caption: 'Every request misses at the same moment',
      },
    },
    {
      title: 'Single-flight',
      tag: 'concept',
      heading: 'One rebuild, everyone else waits',
      eli5: 'Now only one cook goes down for the popular dish, and the others wait by the shelf until it is refilled. Sending just one is called **single-flight**.',
      body: [
        '**Single-flight** (request coalescing): the first request to miss takes a short lock in Redis with `SET NX` and rebuilds the value. Everyone else waits about as long as the rebuild, here about 200 ms, polling every 50 ms, then reads the fresh value.',
        'The database runs the query once instead of 10,000 times. Give the lock an expiry longer than the rebuild so a crashed rebuilder cannot block the key forever, and delete it only if the token is still yours.',
      ],
      keyIdea: 'For hot keys, make sure only one request rebuilds a value while the rest wait for it.',
      metrics: { db: '1,000/s', hit: '95%', latency: '1.5 ms', dbcpu: '10%' },
      metricTones: { db: 'good', hit: 'good', latency: 'good', dbcpu: 'good' },
      scene: {
        nodes: [
          { ...users, status: 'ok', sub: '10,000 on homepage' },
          { ...app, status: 'active', chips: [{ text: '1 holds the lock', tone: 'good' }, '9,999 wait'] },
          { ...cache, status: 'ok', badge: 'lock:deal:today' },
          { ...db, status: 'ok', load: 12, badge: '1 query' },
        ],
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
    token = uuid.uuid4().hex                                # identifies our lock
    for _ in range(20):                                     # capped: 20 x 50 ms = 1 s
        val = r.get(key)
        if val is not None:
            return json.loads(val)
        # NX = set only if absent. The lock TTL must exceed the rebuild time.
        if r.set(f"lock:{key}", token, nx=True, ex=5):
            try:
                val = loader()                              # the heavy query, ~200 ms
                r.set(key, json.dumps(val), ex=ttl + random.randint(0, 10))
                return val
            finally:
                if r.get(f"lock:{key}") == token.encode():  # only delete our own lock
                    r.delete(f"lock:{key}")                 # use a Lua script to make this atomic
        time.sleep(0.05)                                    # poll every 50 ms
    return loader()                                         # waited long enough, rebuild directly`,
        highlight: [2, 8, 11, 14, 16],
      },
    },
    {
      title: 'Stale revalidate',
      tag: 'concept',
      heading: 'Serve stale while revalidating',
      eli5: 'Keep handing out the slightly old dish while one cook fetches a fresh one. Nobody waits, and the cook starts fetching a little before the old dish is gone.',
      body: [
        '**Stale-while-revalidate** stores a soft expiry next to the value. Past it, readers still get the old value at once while one worker refreshes it in the background.',
        '**Probabilistic early expiration** needs no lock. Each read rebuilds with a probability that rises as expiry nears, so one lucky reader usually renews the key just before it dies. Refresh-ahead uses a fixed threshold. This rolls dice on every read.',
      ],
      keyIdea: 'Hand out the old value during a refresh, and let the chance of renewing grow as expiry gets closer.',
      metrics: { db: '1,000/s', hit: '95%', latency: '1.5 ms', dbcpu: '10%' },
      metricTones: { db: 'good', latency: 'good' },
      scene: {
        nodes: [
          { ...app, status: 'active', chips: ['serving stale for 1 s'] },
          { ...cache, status: 'ok', chips: [{ text: 'soft ttl passed', tone: 'warn' }] },
          { ...db, status: 'ok', badge: '1 background rebuild' },
        ],
        links: [link('app', 'cache'), link('app', 'db')],
        flows: [
          { path: ['cache', 'app'], tone: 'response', label: 'old value, instantly', duration: 1 },
          { path: ['app', 'db'], tone: 'request', label: 'refresh in background', duration: 1.2, delay: 1 },
        ],
        panel: {
          title: 'Early expiration (XFetch)',
          icon: 'Clock',
          code: `age   = now() - fetched_at
delta = 0.2          # rebuild seconds
beta  = 1.0          # eagerness
roll  = -delta * beta * log(rand())
if age + roll >= ttl:
    rebuild()        # early, no lock`,
          footer: { text: 'The roll grows as age nears the TTL', tone: 'muted' },
        },
        caption: 'Serve stale, renew a little early',
      },
    },
    {
      title: 'Jitter',
      tag: 'concept',
      heading: 'Jitter spreads expiry times',
      eli5: 'If every dish gets the same timer, they all run out together. Give each dish a slightly different timer so the shelf empties a little at a time.',
      body: [
        '**Jitter** adds a random few seconds to each TTL. Keys loaded together, such as after a deploy warm-up or a nightly import, would otherwise expire together and send one wave of misses at the database.',
        'A TTL of `60 + random(0, 10)` turns a cliff into a slope. It is also the first fix for the mass-expiry avalanche covered below.',
      ],
      keyIdea: 'Add a random offset to every TTL so keys written together do not expire together.',
      metrics: { db: '1,000/s', hit: '95%', latency: '1.5 ms', dbcpu: '10%' },
      metricTones: { db: 'good' },
      scene: {
        nodes: [
          { ...app, status: 'active', chips: ['bulk load: 5,000 keys'] },
          { ...cache, status: 'ok', chips: [{ text: 'ttl = 60 + rand(0..10)', tone: 'good' }] },
          { ...db, status: 'ok', load: 10 },
        ],
        links: [link('app', 'cache'), link('app', 'db')],
        flows: [
          { path: ['app', 'cache'], tone: 'data', label: 'SET ex=63', duration: 1 },
          { path: ['app', 'cache'], tone: 'data', label: 'SET ex=67', duration: 1, delay: 1.2 },
        ],
        panel: {
          title: 'Expiry of 5,000 keys',
          icon: 'Table',
          rows: [
            { text: 'No jitter: all expire at 12:00:00', value: '5,000 misses at once', tone: 'bad' },
            { text: 'Jitter over 10 s', value: '~500 misses/s', tone: 'good' },
          ],
          footer: { text: 'Same keys, spread across time', tone: 'muted' },
        },
        caption: 'A random offset spreads the misses',
      },
    },
    {
      title: 'Penetration',
      tag: 'case',
      heading: 'Penetration: keys that do not exist',
      eli5: 'Someone keeps asking for a dish that is not on the menu. The shelf is empty for it, so the cook runs to the pantry every time, finds nothing and runs back.',
      body: [
        '**Cache penetration**: an attacker or a bug asks for product IDs that do not exist. Every request misses the cache, hits the database and finds nothing. Nothing is ever stored, so the cache never helps.',
        'Fix it by caching the "not found" result with a short TTL, and by putting a **Bloom filter** of valid IDs in front, which rejects keys that definitely do not exist.',
      ],
      keyIdea: 'Cache the answer "does not exist" too, or filter impossible keys before they reach the database.',
      metrics: { db: '9,000/s', hit: '10%', latency: '600 ms', dbcpu: '90%' },
      metricTones: { db: 'bad', hit: 'bad', latency: 'bad', dbcpu: 'bad' },
      scene: {
        nodes: [
          { ...users, label: 'attacker', sub: 'random IDs', icon: 'Bug', tint: 'red', chips: [{ text: 'GET /products/-9981', tone: 'bad' }] },
          { ...app, status: 'hot', load: 85 },
          { ...cache, badge: 'miss, nothing to store' },
          { ...db, status: 'hot', load: 90, badge: '0 rows found' },
        ],
        links: baseLinks,
        flows: [
          { path: ['users', 'app'], tone: 'error', count: 5, duration: 1 },
          { path: ['app', 'cache', 'app'], tone: 'error', label: 'miss', duration: 1.4, delay: 1 },
          { path: ['app', 'db'], tone: 'request', label: 'SELECT id=-9981', count: 4, duration: 1.2, delay: 2.5 },
        ],
        panel: {
          title: 'Two fixes',
          icon: 'Shield',
          rows: [
            { text: 'Cache "not found"', value: 'ttl 30 s', tone: 'good' },
            { text: 'Bloom filter of valid IDs', value: 'rejects early', tone: 'good' },
            { text: 'Bloom filter says "no"', value: 'definitely absent' },
            { text: 'Bloom filter says "yes"', value: 'maybe present', tone: 'muted' },
          ],
        },
        caption: 'Misses for keys that never exist',
      },
      quiz: {
        question: 'A bot requests product IDs that do not exist, and every request reaches the database. What is the best fix?',
        options: [
          'Raise the TTL on real products',
          'Cache a short-lived "not found" marker, or filter with a Bloom filter',
          'Switch the eviction policy from LRU to LFU',
          'Move to write-through',
        ],
        answer: 1,
        explain: 'Nothing is stored for a missing key, so the cache never hits. Caching the absence or rejecting impossible keys with a Bloom filter stops those reads before the database.',
      },
    },
    {
      title: 'Avalanche',
      tag: 'case',
      heading: 'Avalanche: the whole cache goes away',
      eli5: 'The whole shelf falls over. Now every cook runs to the pantry for every dish, all at once, and the stairs jam for a long time.',
      body: [
        'A **cache avalanche** is the whole cache failing or restarting, or a huge share of keys expiring at once. The database normally sees 5% of reads (1,000/s) and can handle at most half of the full load, so 20,000/s overwhelms it.',
        'A cold cache needs minutes to refill. For the mass-expiry variant, add TTL jitter. For a dead node, keep a replica and warm any replacement before it takes traffic.',
      ],
      keyIdea: 'The database is sized for the misses. If the cache vanishes, it receives all reads at once.',
      metrics: { db: '20,000/s', hit: '0%', latency: '900 ms', dbcpu: '100%' },
      metricTones: { db: 'bad', hit: 'bad', latency: 'bad', dbcpu: 'bad' },
      scene: {
        nodes: [
          { ...users, status: 'hot' },
          { ...app, status: 'hot', load: 90 },
          { ...cache, status: 'down', badge: 'node died' },
          { ...db, status: 'hot', load: 100, badge: '20x its usual reads' },
        ],
        links: [link('users', 'app'), link('app', 'cache', { style: 'faint' }), link('app', 'db', { label: '20,000/s', labelTone: 'warn' })],
        flows: [
          { path: ['users', 'app'], tone: 'request', count: 6, duration: 0.9 },
          { path: ['app', 'cache'], tone: 'error', label: 'timeout', duration: 1, delay: 1 },
          { path: ['app', 'db'], tone: 'request', count: 6, duration: 1, delay: 2.1 },
        ],
        panel: {
          title: 'Cold cache, cold start',
          icon: 'Activity',
          rows: [
            { text: 'Normal DB load', value: '1,000/s', tone: 'good' },
            { text: 'Most the DB can handle', value: '10,000/s', tone: 'warn' },
            { text: 'DB load, cache down', value: '20,000/s', tone: 'bad' },
            { text: 'Time to refill hot set', value: 'minutes', tone: 'warn' },
          ],
        },
        caption: 'No cache means all reads reach the database',
      },
    },
    {
      title: 'Availability',
      tag: 'concept',
      heading: 'Keep the cache alive: replica and breaker',
      eli5: 'Keep a second shelf with a copy of the favorites, and put a guard on the pantry stairs who lets only a few cooks down at a time. If one shelf falls, the guard keeps the pantry from being crushed.',
      body: [
        'Run a **replica** in another zone. It copies writes asynchronously, so a failover can lose the last few writes, which a cache can afford. Preload the hot keys into a standby before it takes traffic, or it comes up cold.',
        'Add a **circuit breaker** in front of the database that caps reads near its limit, here 8,000/s of 10,000, and sheds the rest. A cache failure then stays a cache failure.',
      ],
      keyIdea: 'Replicate the cache, warm any replacement, and cap database reads so a cache failure cannot become a database outage.',
      metrics: { db: '1,000/s', hit: '95%', latency: '1.5 ms', dbcpu: '10%' },
      metricTones: { db: 'good', hit: 'good', latency: 'good', dbcpu: 'good' },
      scene: {
        nodes: [
          { ...app, at: at(-3.6, 0), status: 'active' },
          { ...cache, at: at(-0.2, -3.2), status: 'ok', label: 'Redis primary', sub: 'zone A' },
          { id: 'cache2', kind: 'cache', at: at(3.0, -3.2), label: 'Redis replica', sub: 'zone B · warm', status: 'ok' },
          { id: 'breaker', kind: 'block', size: 0.72, at: at(0.8, 4.2), label: 'circuit breaker', sub: 'cap 8,000/s', icon: 'Shield', tint: 'amber' },
          { ...db, at: at(5.6, 3.6), status: 'ok', load: 10 },
        ],
        links: [
          link('app', 'cache'),
          link('cache', 'cache2', { style: 'dashed', label: 'async copy', route: 'straight' }),
          link('app', 'breaker'),
          link('breaker', 'db'),
        ],
        flows: [
          { path: ['cache', 'cache2'], tone: 'data', label: 'copy writes', duration: 1.2 },
          { path: ['app', 'cache', 'app'], tone: 'response', duration: 1.6, delay: 1.3 },
          { path: ['app', 'breaker', 'db'], tone: 'request', label: 'misses only', duration: 1.6, delay: 3 },
        ],
        panel: {
          title: 'If the primary dies',
          icon: 'Shield',
          rows: [
            { text: 'Promote the replica', value: 'seconds' },
            { text: 'Last few writes', value: 'may be lost', tone: 'warn' },
            { text: 'Standby already warm', value: 'hot keys present', tone: 'good' },
            { text: 'Cold standby', value: 'avalanche again', tone: 'bad' },
            { text: 'Breaker open', value: 'sheds excess reads', tone: 'good' },
          ],
        },
        caption: 'A replica for the cache, a breaker for the database',
      },
    },
    {
      title: 'L1 and L2',
      tag: 'tradeoff',
      heading: 'An in-process L1 in front of Redis',
      eli5: 'Give each cook a tiny pocket shelf of their own in front of the big shelf. It is the fastest of all, but each pocket can hold an old copy that nobody can clear from across the room.',
      body: [
        'Add a small **L1** in-process cache (Caffeine, a map) in each app server in front of the shared **L2** Redis. L1 absorbs the hottest keys with no network hop and survives an L2 outage.',
        'The catch: every server holds its own L1 copy, so one `DEL` cannot clear them. Give L1 a very short TTL, a few seconds, or broadcast invalidations over pub/sub.',
      ],
      keyIdea: 'L1 is the fastest tier, and the only one a single delete cannot reach. Keep its TTL very short.',
      metrics: { db: '1,000/s', hit: '95%', latency: '1.5 ms', dbcpu: '10%' },
      metricTones: { db: 'good', hit: 'good', latency: 'good', dbcpu: 'good' },
      scene: {
        nodes: [
          { ...app, at: at(-4, -1.6), label: 'app server A', status: 'ok', chips: [{ text: 'L1: $40', tone: 'good' }], badge: 'L1 hit · 0.01 ms' },
          { ...app, id: 'app2', at: at(-0.8, 2.4), label: 'app server B', status: 'active', chips: [{ text: 'L1: $50 (stale)', tone: 'warn' }] },
          { ...cache, at: at(2.6, -1.8), status: 'ok', sub: 'L2 · product:42 = $40' },
          { ...db, at: at(5.6, 2.4), status: 'dim' },
        ],
        links: [link('app', 'cache'), link('app2', 'cache'), link('cache', 'db', { style: 'faint', label: 'on L2 miss' })],
        flows: [
          { path: ['app2', 'cache'], tone: 'request', label: 'L1 expired, GET', duration: 1.2 },
          { path: ['cache', 'app2'], tone: 'response', label: '$40', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Where a read can stop',
          icon: 'Layers',
          rows: [
            { text: 'L1 in-process', value: '~0.01 ms', tone: 'good' },
            { text: 'L2 Redis', value: '~1 ms', tone: 'good' },
            { text: 'Database', value: '~10 ms', tone: 'warn' },
            { text: 'L1 copy per server', value: 'not cleared by DEL', tone: 'warn' },
            { text: 'Fix', value: 'TTL of seconds or pub/sub' },
          ],
        },
        caption: 'Fast tier, short TTL',
      },
    },
    {
      title: 'Scale out',
      tag: 'concept',
      heading: 'Shard the cache with consistent hashing',
      eli5: 'One shelf is too small, so the kitchen gets several, with a rule for which dish lives on which shelf. Adding a shelf should move only a few dishes, not all of them.',
      body: [
        '64 GB on one node is a ceiling and a single point of failure. **Shard** the keyspace across nodes with consistent hashing: add or remove a node and only about 1/N of the keys move, where `hash mod N` moves nearly all of them. The consistent hashing lesson shows the ring.',
        'Redis adds data structures, persistence and replication. Memcached is plain key-value and multi-threaded. Either way, watch hit rate, evictions and memory.',
      ],
      keyIdea: 'Shard by consistent hashing so adding a cache node moves a fraction of the keys, not all of them.',
      metrics: { db: '1,000/s', hit: '95%', latency: '1.5 ms', dbcpu: '10%' },
      metricTones: { db: 'good', hit: 'good' },
      scene: {
        nodes: [
          { ...app, at: at(-3.2, 0), status: 'active', chips: ['hash(key) → shard'] },
          { id: 'shardA', kind: 'cache', at: at(-0.3, -2.8), label: 'shard A', sub: 'keys 0 to 33%', status: 'ok' },
          { id: 'shardB', kind: 'cache', at: at(2.6, -2.8), label: 'shard B', sub: 'keys 33 to 66%', status: 'ok' },
          { id: 'shardC', kind: 'cache', at: at(5.5, -2.8), label: 'shard C', sub: 'keys 66 to 100%', status: 'ok' },
          { id: 'shardD', kind: 'cache', at: at(2.6, 2.4), label: 'new shard D', sub: 'takes ~25% of keys', status: 'active' },
        ],
        links: [link('app', 'shardA'), link('app', 'shardB'), link('app', 'shardC'), link('app', 'shardD', { style: 'dashed' })],
        flows: [
          { path: ['app', 'shardB', 'app'], tone: 'response', label: 'GET product:42', duration: 1.6 },
          { path: ['shardA', 'shardD'], tone: 'data', label: 'move a slice', duration: 1.4, delay: 1.8 },
        ],
        panel: {
          title: 'Add a fourth node',
          icon: 'Table',
          rows: [
            { text: 'hash mod N', value: '~75% of keys move', tone: 'bad' },
            { text: 'Consistent hashing', value: '~25% of keys move', tone: 'good' },
            { text: 'Redis', value: 'structures, persistence' },
            { text: 'Memcached', value: 'plain keys, multi-threaded' },
            { text: 'Watch', value: 'hit rate, evictions, memory', tone: 'good' },
          ],
        },
        caption: 'Adding a node moves a fraction of the keys',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Plan for the moment the cache misses',
      eli5: 'Send only one cook for a popular dish, give timers different lengths, keep a spare shelf and a guard on the pantry stairs, and add shelves with a rule that moves few dishes.',
      body: [
        'Hot keys need stampede protection: **single-flight**, stale-while-revalidate and TTL **jitter**. Missing keys need negative caching or a Bloom filter. A dead cache needs replicas, a warm standby and a circuit breaker so the database sees at most half the full load.',
        'Add an in-process L1 with a very short TTL, and shard with **consistent hashing** once one node is not enough. Watch hit rate, evictions and memory.',
      ],
      keyIdea: 'A cache makes the database look bigger than it is, so design for the moment the cache misses.',
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
          title: 'The failure checklist',
          icon: 'List',
          rows: [
            { text: 'Hot keys', value: 'single-flight + jitter', tone: 'good' },
            { text: 'Missing keys', value: 'negative cache' },
            { text: 'The cache itself', value: 'replica + warm standby' },
            { text: 'The database', value: 'circuit breaker' },
            { text: 'One node too small', value: 'consistent hashing' },
          ],
        },
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
