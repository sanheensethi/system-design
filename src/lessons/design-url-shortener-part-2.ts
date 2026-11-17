import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const users: SceneNode = { id: 'users', kind: 'client', at: at(-6, 0), label: 'visitors', sub: 'browsers and phones' };
const app: SceneNode = { id: 'app', kind: 'block', at: at(-2, 0), label: 'link service', sub: '20 app servers', icon: 'Network', tint: 'violet' };
const cache: SceneNode = { id: 'cache', kind: 'cache', at: at(3, -4.4), label: 'Redis', sub: 'hot links, 15 GB' };
const db: SceneNode = { id: 'db', kind: 'db', at: at(3, 4.4), label: 'links DB', sub: 'one primary' };
const queue: SceneNode = { id: 'queue', kind: 'queue', at: at(3, -4.4), label: 'click events', sub: 'Kafka topic' };
const warehouse: SceneNode = { id: 'warehouse', kind: 'warehouse', at: at(3, 4.4), label: 'analytics', sub: 'clicks per minute' };
const shard1: SceneNode = { id: 'shard1', kind: 'shard', at: at(2, -4.6), label: 'shard 1', sub: '~3 TB' };
const shard2: SceneNode = { id: 'shard2', kind: 'shard', at: at(5.5, 0), label: 'shard 2', sub: '~3 TB' };
const shard3: SceneNode = { id: 'shard3', kind: 'shard', at: at(2, 4.6), label: 'shard 32', sub: '~3 TB' };
const sweeper: SceneNode = { id: 'sweeper', kind: 'worker', at: at(1.5, -6.2), label: 'expiry sweeper', sub: 'nightly batches' };
const scanner: SceneNode = { id: 'scanner', kind: 'block', at: at(1.5, -6.2), label: 'URL scanner', sub: 'blocklist feed', icon: 'Shield', tint: 'teal' };

const toShards = [link('app', 'shard1'), link('app', 'shard2'), link('app', 'shard3')];

export const designUrlShortenerPart2: Lesson = {
  id: 'design-url-shortener-part-2',
  title: 'Design a URL shortener (part 2)',
  tagline: 'Cache the hot links, count clicks off the hot path, shard 91 TB, handle aliases, expiry, a viral link and a takedown.',
  minutes: 16,
  level: 'Intermediate',
  learn: [
    'Caching hot links in Redis, and caching misses too',
    'Choosing 301 or 302, and counting clicks through a queue',
    'Sharding 91 TB by code and keeping the owner table in step',
    'Custom aliases, expiry and why expired codes are never reused',
    'Surviving a viral link, taking down a phishing link fast, and staying available',
  ],
  metrics: [
    { key: 'reads', label: 'Redirects', icon: 'Repeat' },
    { key: 'hit', label: 'Cache hit', icon: 'Gauge' },
    { key: 'db', label: 'DB reads', icon: 'Database' },
    { key: 'p99', label: 'p99 redirect', icon: 'Timer' },
  ],
  steps: [
    {
      title: 'Hot database',
      tag: 'problem',
      heading: 'Part 1 left one problem: 70K reads/s on a database that does 10K',
      eli5: 'Every letter still makes the clerk walk to the big drawer. The clerk can only walk so fast, and a long line of families builds up outside.',
      body: [
        'Codes are unique and the redirect is one lookup. But 70K lookups a second still land on a store that handles about 10K.',
        'Reads outnumber writes 20 to 1, so we fix the read side first.',
      ],
      keyIdea: 'Seven times too many reads is a caching problem before it is a sharding problem.',
      metrics: { reads: '70K/s peak', hit: '-', db: '70K/s', p99: '400 ms' },
      metricTones: { db: 'bad', p99: 'bad' },
      scene: {
        nodes: [{ ...users, status: 'hot' }, { ...app, status: 'active' }, { ...db, status: 'hot', load: 100, badge: '70K reads/s' }],
        links: [link('users', 'app', { label: '70K clicks/s' }), link('app', 'db', { label: '10K/s is the limit', labelTone: 'warn' })],
        flows: [
          { path: ['users', 'app', 'db'], tone: 'request', count: 5, duration: 1.6 },
          { path: ['db', 'app', 'users'], tone: 'error', label: 'slow', duration: 1.8, delay: 1.7 },
        ],
        panel: {
          title: 'Read load',
          icon: 'Gauge',
          rows: [
            { text: 'Redirects at peak', value: '70K/s' },
            { text: 'One DB box', value: '10K/s', tone: 'warn' },
            { text: 'Gap', value: '7x', tone: 'bad' },
          ],
        },
        caption: 'The database is the bottleneck',
      },
    },
    {
      title: 'Cache',
      tag: 'concept',
      heading: 'Fix 2: keep hot links in memory',
      eli5: 'The clerk keeps cards for the busiest boxes on a little stand by the window. That stand is the **cache**, so most letters get forwarded without opening the big drawer.',
      body: [
        'Clicks are skewed. A link gets most of its clicks in its first day or two, and a small set of popular links takes a large share of all traffic. That is the shape caching loves (the caching lesson).',
        'Use cache-aside in Redis, keyed by code, filled on a miss with a 24-hour TTL.',
      ],
      keyIdea: 'Redirects are skewed and rarely change, the best case for a cache.',
      metrics: { reads: '70K/s peak', hit: '95%', db: '3.5K/s', p99: '8 ms' },
      metricTones: { hit: 'good', db: 'good', p99: 'good' },
      scene: {
        nodes: [users, { ...app, status: 'active' }, { ...cache, status: 'ok', badge: '95% hit' }, { ...db, status: 'ok', badge: '3.5K reads/s' }],
        links: [link('users', 'app'), link('app', 'cache'), link('app', 'db', { style: 'faint' })],
        flows: [
          { path: ['users', 'app'], tone: 'request', count: 4, duration: 1 },
          { path: ['app', 'cache', 'app'], tone: 'response', label: 'GET aZ3kQ9x', count: 4, duration: 1.4, delay: 1 },
          { path: ['app', 'db', 'app'], tone: 'request', label: 'miss', duration: 1.6, delay: 1.6 },
          { path: ['app', 'users'], tone: 'response', label: '302', count: 4, duration: 1, delay: 2.6 },
        ],
        panel: {
          title: 'Cache-aside lookup',
          icon: 'Zap',
          rows: [
            { text: '1. Ask Redis for the code' },
            { text: '2. Hit: answer at once', tone: 'good' },
            { text: '3. Miss: read the database', tone: 'warn' },
            { text: '4. Store with a 24 h TTL' },
          ],
        },
        caption: '19 of every 20 lookups stop at Redis',
      },
    },
    {
      title: 'Cache sizing',
      tag: 'concept',
      heading: 'Sizing the cache: 15 GB covers a busy day',
      eli5: 'The stand by the window only needs room for the boxes people ask about today, not every box ever made. That is a small stand.',
      body: [
        'If about 50 million distinct links get clicked on a busy day, at about 300 bytes each that is **15 GB**, a small Redis cluster with replicas.',
        'At a **95% hit rate** the database sees 3.5K reads/s at peak instead of 70K, and the redirect p99 falls to about 8 ms.',
      ],
      keyIdea: '95% of 70K reads/s never touch the database, and the cache is only 15 GB.',
      metrics: { reads: '70K/s peak', hit: '95%', db: '3.5K/s', p99: '8 ms' },
      metricTones: { hit: 'good', db: 'good', p99: 'good' },
      scene: {
        nodes: [{ ...app, status: 'active' }, { ...cache, status: 'ok', badge: '95% hit', load: 40 }, { ...db, status: 'ok', load: 35, badge: '3.5K reads/s' }],
        links: [link('app', 'cache', { label: '66.5K/s' }), link('app', 'db', { label: '3.5K/s' })],
        flows: [
          { path: ['app', 'cache', 'app'], tone: 'response', count: 4, duration: 1.4 },
          { path: ['app', 'db', 'app'], tone: 'request', duration: 1.6, delay: 1 },
        ],
        panel: {
          title: 'Cache math',
          icon: 'Table',
          rows: [
            { text: 'Distinct links on a busy day', value: '50M' },
            { text: 'Bytes per entry', value: '~300' },
            { text: 'Cache size', value: '15 GB', tone: 'good' },
            { text: 'DB reads at 95% hit', value: '3.5K/s', tone: 'good' },
            { text: 'p99 redirect', value: '~8 ms', tone: 'good' },
          ],
        },
        caption: 'A small cache absorbs most of the traffic',
      },
    },
    {
      title: 'Cache misses',
      tag: 'concept',
      heading: 'Cache the misses too',
      eli5: 'Some kids shout random box numbers that do not exist. The clerk writes "no such box" on a sticky note for a minute, so they stop walking to the drawer for each shout.',
      body: [
        'Bots guess random codes, and every unknown code would otherwise reach the database.',
        'Storing "not found" for 60 seconds stops that cheaply. A guessable custom alias such as `/winter-sale` may be requested before it exists, so a successful create deletes the negative cache entry for that code, or writes the positive one. The TTL then only protects codes that stay missing.',
      ],
      keyIdea: 'A short-lived "not found" entry shields the database from guessing bots.',
      metrics: { reads: '70K/s peak', hit: '95%', db: '3.5K/s', p99: '8 ms' },
      scene: {
        nodes: [{ ...users, label: 'bot', sub: 'guesses codes', chips: [{ text: 'GET /zzzzzzz', tone: 'warn' }] }, { ...app, status: 'active' }, { ...cache, status: 'ok', badge: 'zzzzzzz = not found, 60 s' }, { ...db, status: 'dim' }],
        links: [link('users', 'app'), link('app', 'cache'), link('app', 'db', { style: 'faint' })],
        flows: [
          { path: ['users', 'app'], tone: 'request', label: 'GET /zzzzzzz', count: 3, duration: 1 },
          { path: ['app', 'cache', 'app'], tone: 'response', label: 'not found', duration: 1.4, delay: 1.1 },
          { path: ['app', 'users'], tone: 'error', label: '404', duration: 1, delay: 2.6 },
        ],
        panel: {
          title: 'Negative caching',
          icon: 'Search',
          rows: [
            { text: 'First guess', value: 'one DB read' },
            { text: 'Next 60 s', value: 'answered by Redis', tone: 'good' },
            { text: 'Database load', value: 'protected', tone: 'good' },
            { text: 'Successful create', value: 'deletes the negative entry', tone: 'good' },
          ],
        },
        caption: 'Unknown codes stop at the cache',
      },
    },
    {
      title: '301 or 302',
      tag: 'tradeoff',
      heading: '301 or 302: who remembers the redirect',
      eli5: 'A **301** tells the sender to write the home address themselves from now on, so the post office never sees those letters again. A **302** says keep sending to the box, so every letter gets counted.',
      body: [
        '**301 Moved Permanently** lets browsers cache the redirect, often for a long time. The second click never reaches us: less load, but no click count, and we can no longer change, expire or disable that link for that browser.',
        '**302 Found** says the move is temporary, so every click comes back to us. Owners who want the fastest hop and no stats can opt in to 301 per link.',
      ],
      keyIdea: 'A 302 keeps every click visible and every link revocable.',
      metrics: { reads: '70K/s peak', hit: '95%', db: '3.5K/s', p99: '8 ms' },
      scene: {
        nodes: [
          { ...users, chips: [{ text: '301: browser remembers', tone: 'warn' }, { text: '302: asks us again', tone: 'good' }] },
          { ...app, status: 'active' },
          { ...cache, status: 'ok' },
        ],
        links: [link('users', 'app', { label: '302 = every click returns', labelTone: 'good' }), link('app', 'cache')],
        flows: [
          { path: ['users', 'app'], tone: 'request', label: 'GET /aZ3kQ9x', duration: 1 },
          { path: ['app', 'cache', 'app'], tone: 'response', duration: 1.2, delay: 1.1 },
          { path: ['app', 'users'], tone: 'response', label: '302', duration: 1, delay: 2.4 },
        ],
        panel: {
          title: '301 vs 302',
          icon: 'Route',
          rows: [
            { text: '301, repeat visit', value: 'skips us', tone: 'warn' },
            { text: '301, click count', value: 'lost', tone: 'bad' },
            { text: '301, takedown', value: 'cannot reach', tone: 'bad' },
            { text: '302, repeat visit', value: 'hits us', tone: 'good' },
            { text: '302, click count', value: 'complete', tone: 'good' },
          ],
        },
        caption: 'We default to 302',
      },
    },
    {
      title: 'Count clicks',
      tag: 'concept',
      heading: 'Count clicks off the hot path, through a queue',
      eli5: 'The clerk forwards the letter right away, then drops a tally slip in a basket. Someone else adds up the slips later, so counting never slows the line.',
      body: [
        'The server sends the 302 at once and drops a click event (code, time, country, referrer) onto a queue (the message queues lesson). A stream job rolls them up per code per minute into the analytics store (the stream processing and data warehouse lessons).',
        'At 70K events/s and about 200 bytes each, that is 14 MB/s. Events are delivered at least once, so the rollup should tolerate a few duplicates.',
      ],
      keyIdea: 'Answer first, count afterwards, so analytics never adds latency.',
      metrics: { reads: '70K/s peak', hit: '95%', db: '3.5K/s', p99: '8 ms' },
      scene: {
        nodes: [{ ...app, status: 'active' }, { ...queue, status: 'active', badge: '70K events/s' }, warehouse, { ...users, status: 'ok' }],
        links: [link('users', 'app'), link('app', 'queue', { style: 'dashed' }), link('queue', 'warehouse', { label: 'per-minute counts' })],
        flows: [
          { path: ['app', 'users'], tone: 'response', label: '302', duration: 1, delay: 0 },
          { path: ['app', 'queue'], tone: 'event', label: 'click', duration: 1, delay: 0.2 },
          { path: ['queue', 'warehouse'], tone: 'data', label: 'rollup', duration: 1.2, delay: 1.4 },
        ],
        panel: {
          title: 'A click event',
          icon: 'Receipt',
          code: '{ code: "aZ3kQ9x",\n  at: "2027-01-05T10:02:11Z",\n  country: "DE",\n  referrer: "mail" }\n~200 bytes, 70K/s = 14 MB/s',
          footer: { text: 'Never block the redirect on this', tone: 'good' },
        },
        caption: 'Answer first, count afterwards',
      },
    },
    {
      title: 'Shards',
      tag: 'concept',
      heading: 'Fix 3: split 91 TB across shards',
      eli5: 'One drawer cannot hold billions of cards, so the post office uses many rooms. The box number alone tells the clerk which room to walk to. Each room is a **shard**.',
      body: [
        'The cache took the read load, but 91 TB and 182 billion rows still do not fit on one machine. Shard by `code` (the sharding lesson). Every redirect then touches exactly one shard, and new links spread evenly.',
        'Hashing the code onto a ring (the consistent hashing lesson) keeps the spread even for custom aliases too, and lets us add shards without moving everything.',
      ],
      keyIdea: 'Shard by the key the hot path reads. The code alone picks the shard.',
      metrics: { reads: '70K/s peak', hit: '95%', db: '3.5K/s over 32', p99: '8 ms' },
      scene: {
        nodes: [{ ...users }, { ...app, status: 'active', chips: ['hash(code) → shard'] }, shard1, { ...shard2, status: 'active', badge: 'aZ3kQ9x' }, shard3],
        links: [link('users', 'app'), ...toShards],
        flows: [
          { path: ['users', 'app'], tone: 'request', label: 'GET /aZ3kQ9x', duration: 1 },
          { path: ['app', 'shard2'], tone: 'request', duration: 1, delay: 1.1 },
          { path: ['shard2', 'app'], tone: 'response', label: 'long_url', duration: 1, delay: 2.2 },
        ],
        panel: {
          title: 'Why shard by code',
          icon: 'Split',
          rows: [
            { text: 'Redirect touches', value: '1 shard', tone: 'good' },
            { text: 'New links', value: 'spread evenly', tone: 'good' },
            { text: 'Add shards', value: 'via hash ring' },
          ],
        },
        caption: 'The code alone picks the shard',
      },
    },
    {
      title: 'Shard sizing',
      tag: 'concept',
      heading: '32 shards of 3 TB, each with two replicas',
      eli5: 'Thirty-two rooms, each with two spare copies of its cards in other buildings. If a room floods, a copy takes over.',
      body: [
        '**32 shards** of about 3 TB each, every one with two replicas (the replication lesson), is about 275 TB on disk.',
        'Each shard sees roughly 110 cache-miss reads and 110 creates per second at peak, which is easy.',
      ],
      keyIdea: '91 TB with replicas is about 275 TB, and each shard works at a relaxed pace.',
      metrics: { reads: '70K/s peak', hit: '95%', db: '110/s per shard', p99: '8 ms' },
      metricTones: { db: 'good' },
      scene: {
        nodes: [{ ...app, status: 'active' }, { ...shard1, status: 'ok', load: 12 }, { ...shard2, status: 'ok', load: 12 }, { ...shard3, status: 'ok', load: 12 }],
        links: toShards,
        flows: [{ path: ['app', 'shard2', 'app'], tone: 'request', duration: 1.6 }],
        panel: {
          title: 'Capacity per shard',
          icon: 'HardDrive',
          rows: [
            { text: 'Shards', value: '32' },
            { text: 'Size each', value: '~3 TB' },
            { text: 'Copies', value: 'primary + 2 replicas' },
            { text: 'Disk in total', value: '~275 TB' },
            { text: 'Load per shard', value: '110 reads + 110 writes /s', tone: 'good' },
          ],
        },
        caption: 'Small, even slices',
      },
    },
    {
      title: 'Owner shards',
      tag: 'concept',
      heading: 'The owner table is sharded by owner_id instead',
      eli5: 'The "my boxes" drawer is sorted by family name, so one family is always in one room. Making a new box means writing two cards, one in each place.',
      body: [
        '"My links" would have to ask all 32 shards if it lived by code, so `links_by_owner` is sharded by `owner_id` instead.',
        'A create writes both. If the second write fails, the failure is recorded durably (an outbox row or queue message) and a retry job finishes it, since the redirect only depends on the first.',
      ],
      keyIdea: 'Each table is sharded by its own hot key, and the less important write can be retried later.',
      metrics: { reads: '70K/s peak', hit: '95%', db: '3.5K/s over 32', p99: '8 ms' },
      scene: {
        nodes: [{ ...app, status: 'active' }, { ...shard2, label: 'links shard', sub: 'by code', status: 'active', badge: 'write 1' }, { id: 'ownerShard', kind: 'shard', at: at(2, 4.6), label: 'owner shard', sub: 'by owner_id', status: 'active', badge: 'write 2' }, { id: 'retry', kind: 'worker', at: at(2, -4.6), label: 'retry job', sub: 'finishes write 2' }],
        links: [link('app', 'shard2'), link('app', 'ownerShard'), link('retry', 'ownerShard', { style: 'dashed' })],
        flows: [
          { path: ['app', 'shard2'], tone: 'data', label: 'insert by code', duration: 1.1 },
          { path: ['app', 'ownerShard'], tone: 'data', label: 'insert by owner', duration: 1.1, delay: 1.2 },
          { path: ['retry', 'ownerShard'], tone: 'event', label: 'from outbox', duration: 1.1, delay: 2.4 },
        ],
        panel: {
          title: 'Two writes per create',
          icon: 'Table',
          rows: [
            { text: 'links', value: 'shard by code' },
            { text: 'links_by_owner', value: 'shard by owner_id' },
            { text: 'Redirect depends on', value: 'links only', tone: 'good' },
            { text: 'Second write fails', value: 'outbox row, retry later', tone: 'warn' },
          ],
        },
        caption: 'The redirect never waits for the listing',
      },
      quiz: {
        question: 'Why is `links_by_owner` sharded by `owner_id` rather than by `code`?',
        options: [
          'Listing one owner\'s links then reads a single shard instead of all 32',
          'Owner ids are shorter than codes',
          'It lets the redirect skip the cache',
          'It removes the need for replicas',
        ],
        answer: 0,
        explain: 'A table should be sharded by the key its main query uses. "My links" asks for one owner, so sharding by owner_id keeps that query on one shard. The redirect uses the other table, sharded by code.',
      },
    },
    {
      title: 'Aliases',
      tag: 'concept',
      heading: 'Custom aliases are a conditional insert',
      eli5: 'Some families pick a name for their box instead of a number, as long as nobody has it yet. The first family to write it down gets it.',
      body: [
        'An owner asks for `sho.example/winter-sale`. Aliases live in the same table, so creation is a **conditional insert**: write only if the code does not exist yet (`INSERT ... ON CONFLICT DO NOTHING`, or a conditional put). The loser of a race gets `409 Conflict`.',
        'Generated codes are always exactly 7 characters, so we refuse aliases of exactly 7: an alias can never take a code the counter will hand out later. Reserved words like `api` and `login` are blocked too.',
      ],
      keyIdea: 'Aliases share the namespace, so insert them conditionally and keep them out of the generated length.',
      metrics: { reads: '70K/s peak', hit: '95%', db: '3.5K/s over 32', p99: '8 ms' },
      scene: {
        nodes: [{ ...users, label: 'owner', sub: 'alias: winter-sale' }, { ...app, status: 'active' }, { ...shard1, status: 'active', badge: 'insert if absent' }],
        links: [link('users', 'app'), link('app', 'shard1')],
        flows: [
          { path: ['users', 'app'], tone: 'request', label: 'POST alias', duration: 1 },
          { path: ['app', 'shard1'], tone: 'data', label: 'ON CONFLICT DO NOTHING', duration: 1.1, delay: 1.1 },
          { path: ['app', 'users'], tone: 'response', label: '201 or 409', duration: 1, delay: 2.3 },
        ],
        panel: {
          title: 'Alias rules',
          icon: 'Key',
          rows: [
            { text: 'Insert', value: 'only if absent' },
            { text: 'Lost the race', value: '409 Conflict', tone: 'warn' },
            { text: 'Exactly 7 characters', value: 'refused', tone: 'bad' },
            { text: 'api, login, ...', value: 'reserved', tone: 'bad' },
          ],
        },
        caption: 'First writer wins the alias',
      },
    },
    {
      title: 'Expiry',
      tag: 'concept',
      heading: 'Expiry: 410 on read, a sweeper in the background',
      eli5: 'Every box can have a closing date, its **expiry**. Letters sent after that get a "box closed" note, and a night cleaner later blanks out the old cards but keeps the box number.',
      body: [
        'On a redirect, if `expires_at` has passed, answer `410 Gone`. The cache TTL is the smaller of 24 hours and the time left, so a cached copy cannot outlive its link.',
        'A nightly background job shrinks expired rows to tombstones in small batches (the background jobs lesson). It keeps `code` and `status = expired` and drops `long_url` and the metadata. It never deletes the row, so the code stays taken.',
      ],
      keyIdea: 'Check expiry on every read, and shrink rows to tombstones lazily in the background.',
      metrics: { reads: '70K/s peak', hit: '95%', db: '3.5K/s over 32', p99: '8 ms' },
      scene: {
        nodes: [{ ...app, status: 'active' }, { ...cache, status: 'ok', badge: 'TTL = min(24 h, time left)' }, { ...shard3, at: at(3, 4.4), badge: 'expired rows' }, { ...sweeper, at: at(-6, -3.4), status: 'active' }],
        links: [link('app', 'cache'), link('app', 'shard3'), link('sweeper', 'shard3', { style: 'dashed' })],
        flows: [
          { path: ['app', 'cache', 'app'], tone: 'response', label: '410 Gone', duration: 1.4 },
          { path: ['sweeper', 'shard3'], tone: 'event', label: 'tombstone batch', duration: 1.2, delay: 1.5 },
        ],
        panel: {
          title: 'Expiry handling',
          icon: 'Clock',
          rows: [
            { text: 'Expired on read', value: '410 Gone' },
            { text: 'Cache TTL', value: 'min(24 h, time left)' },
            { text: 'Cleanup', value: 'nightly tombstones, small batches' },
          ],
        },
        caption: 'Reads check expiry, the sweeper leaves tombstones',
      },
    },
    {
      title: 'Never reuse',
      tag: 'tradeoff',
      heading: 'Never reuse an expired code',
      eli5: 'A closed box number is never handed to a new family. Old letters and flyers still carry it, and they must not land in a stranger\'s hands.',
      body: [
        'Old emails and printed flyers still carry the code, and reusing it would send those readers to someone else\'s page.',
        'The space is 3.52 trillion codes, so retiring codes forever costs nothing. Generated codes are safe because the counter never repeats an ID. Custom aliases are the codes at risk, so an expired alias keeps its tombstone row and the conditional insert keeps failing.',
      ],
      keyIdea: 'Codes are cheap and old links live on in the wild, so retire them forever.',
      metrics: { reads: '70K/s peak', hit: '95%', db: '3.5K/s over 32', p99: '8 ms' },
      scene: {
        nodes: [{ ...users, label: 'old flyer', sub: 'printed in 2025', chips: ['/aZ3kQ9x'] }, { ...app, status: 'active' }, { ...shard2, at: at(4, 0), badge: 'tombstone: expired' }],
        links: [link('users', 'app'), link('app', 'shard2')],
        flows: [
          { path: ['users', 'app', 'shard2'], tone: 'request', label: 'aZ3kQ9x', duration: 1.6 },
          { path: ['shard2', 'app', 'users'], tone: 'error', label: '410, not a stranger\'s page', duration: 1.8, delay: 1.7 },
        ],
        panel: {
          title: 'Why codes are retired',
          icon: 'Receipt',
          rows: [
            { text: 'Codes available', value: '3.52T' },
            { text: 'Used in 5 years', value: '182B' },
            { text: 'Reuse risk', value: 'wrong page for old readers', tone: 'bad' },
          ],
        },
        caption: 'Retired for good',
      },
    },
    {
      title: 'Viral link',
      tag: 'case',
      heading: 'Case: one link takes 150K clicks a second',
      eli5: 'One box suddenly gets a mountain of letters, so every clerk keeps that one card in a pocket for a few seconds. The shared stand is no longer swamped.',
      body: [
        'A link lands in a huge push notification and its clicks jump to **150K/s**. All lookups for one key go to one Redis node, and one key cannot be split. That node pins its CPU and every other link stored there slows down.',
        'The fix is a small in-process cache in each app server for the hottest codes, with a **5-second TTL**. Redis now sees one read per server every 5 seconds for that code.',
      ],
      keyIdea: 'A short local cache absorbs a hot key that a single Redis node cannot.',
      metrics: { reads: '220K/s', hit: '99%', db: '3.5K/s over 32', p99: '9 ms' },
      metricTones: { reads: 'warn', hit: 'good' },
      scene: {
        nodes: [{ ...users, status: 'hot', sub: '150K clicks/s, 1 code' }, { ...app, status: 'active', badge: 'local cache 5 s' }, { ...cache, status: 'hot', load: 95, badge: '1 node, 1 hot key' }],
        links: [link('users', 'app', { label: '150K/s', labelTone: 'warn' }), link('app', 'cache', { label: '1 read / 5 s per server', labelTone: 'good' })],
        flows: [
          { path: ['users', 'app'], tone: 'request', count: 6, duration: 0.9 },
          { path: ['app', 'cache'], tone: 'request', label: '1 read / 5 s', duration: 1, delay: 1 },
          { path: ['app', 'users'], tone: 'response', label: '302', count: 4, duration: 1, delay: 2.2 },
        ],
        panel: {
          title: 'Hot key rescue',
          icon: 'Zap',
          rows: [
            { text: 'One code at peak', value: '150K/s', tone: 'warn' },
            { text: 'Redis node for that key', value: 'pinned CPU', tone: 'bad' },
            { text: 'Local cache TTL', value: '5 s', tone: 'good' },
            { text: 'Redis reads, per server', value: '1 per 5 s', tone: 'good' },
          ],
        },
        caption: 'Local caches absorb the spike',
      },
    },
    {
      title: 'Abuse checks',
      tag: 'case',
      heading: 'An hour later the link is reported as phishing',
      eli5: 'The box turns out to be a trick. The post office should have been checking addresses and limiting how many boxes one person can open, and should keep re-checking later.',
      body: [
        'Creation should have caught more of this: rate limit creates per account and per IP (the rate limiting lesson), and check the destination against a blocklist before returning a code.',
        'Rescan later too, since the page behind a URL can change after it was checked.',
      ],
      keyIdea: 'A page can turn bad after it passed the check, so scan at create time and again later.',
      metrics: { reads: '220K/s', hit: '99%', db: '3.5K/s over 32', p99: '9 ms' },
      scene: {
        nodes: [{ ...users, label: 'attacker', sub: 'many accounts', status: 'hot' }, { ...app, status: 'active', chips: [{ text: '429 too many creates', tone: 'warn' }] }, { ...scanner, status: 'active', badge: 'rescans old links' }],
        links: [link('users', 'app', { label: 'rate limited', labelTone: 'warn' }), link('scanner', 'app', { style: 'dashed' })],
        flows: [
          { path: ['users', 'app'], tone: 'request', count: 4, duration: 1 },
          { path: ['app', 'users'], tone: 'error', label: '429', duration: 1, delay: 1.1 },
          { path: ['scanner', 'app'], tone: 'event', label: 'phishing!', duration: 1, delay: 2.3 },
        ],
        panel: {
          title: 'Layers of defense',
          icon: 'Shield',
          rows: [
            { text: 'Rate limit', value: 'per account and IP' },
            { text: 'Blocklist at create', value: 'before the code' },
            { text: 'Rescan later', value: 'pages change', tone: 'warn' },
            { text: 'Takedown path', value: 'must be fast', tone: 'warn' },
          ],
        },
        caption: 'Check early, check again later',
      },
    },
    {
      title: 'Takedown',
      tag: 'case',
      heading: 'Takedown: every copy dies within 5 seconds',
      eli5: 'The post office marks the box closed in the big drawer, tears the card off the window stand, and every clerk\'s pocket card expires in a few seconds. Visitors see a warning note.',
      body: [
        'Set `status = disabled` in the database, delete the Redis key, and in-process copies age out within 5 seconds. Visitors now get a warning page.',
        'Browsers that received a **301** would keep going straight to the scam, the strongest reason the default is 302.',
      ],
      keyIdea: 'Keep every copy short-lived enough that a takedown lands in seconds.',
      metrics: { reads: '70K/s peak', hit: '95%', db: '3.5K/s over 32', p99: '8 ms' },
      scene: {
        nodes: [{ ...users, status: 'ok' }, { ...app, status: 'active', badge: 'local copy: 5 s left' }, { ...cache, status: 'dim', badge: 'key deleted' }, { ...shard2, at: at(3, 4.4), status: 'down', badge: 'status = disabled' }],
        links: [link('users', 'app'), link('app', 'cache', { style: 'faint' }), link('app', 'shard2')],
        flows: [
          { path: ['app', 'shard2'], tone: 'data', label: 'disable', duration: 1 },
          { path: ['app', 'cache'], tone: 'data', label: 'DEL key', duration: 1, delay: 1.1 },
          { path: ['app', 'users'], tone: 'error', label: 'warning page', duration: 1, delay: 2.3 },
        ],
        panel: {
          title: 'Takedown steps',
          icon: 'Bug',
          rows: [
            { text: '1. Set status = disabled', value: 'database' },
            { text: '2. Delete the Redis key', value: 'cache' },
            { text: '3. Local copies expire', value: 'within 5 s', tone: 'good' },
            { text: '301 in a browser', value: 'cannot be recalled', tone: 'bad' },
          ],
        },
        caption: 'A takedown reaches every copy in 5 s',
      },
    },
    {
      title: 'Availability',
      tag: 'concept',
      heading: 'Keep redirects up when parts fail',
      eli5: 'If the front stand breaks, clerks still walk to the big drawer. If one room floods, its spare copy opens. The lines slow down but letters keep moving.',
      body: [
        'Redirects matter more than creates, because links live in old emails and on posters. If Redis fails, requests fall through to the shards, slower but correct. A shard failure promotes one of its replicas.',
        'Creates can wait: the key buffer and retry jobs absorb short outages in the ID service or the owner table.',
      ],
      keyIdea: 'Protect the redirect path first, and let creates and listings degrade gracefully.',
      metrics: { reads: '70K/s peak', hit: '0%', db: '70K/s over 32', p99: '35 ms' },
      metricTones: { hit: 'bad', p99: 'warn' },
      scene: {
        nodes: [{ ...app, status: 'active' }, { ...cache, status: 'down', badge: 'Redis down' }, { ...shard1, at: at(6, 0), status: 'ok', load: 40 }, { ...shard2, at: at(3, 4.4), status: 'ok', load: 40, badge: 'replica promoted' }],
        links: [link('app', 'cache', { style: 'faint' }), link('app', 'shard1'), link('app', 'shard2')],
        flows: [
          { path: ['app', 'cache'], tone: 'error', label: 'timeout', duration: 1 },
          { path: ['app', 'shard1', 'app'], tone: 'response', label: 'direct read', duration: 1.6, delay: 1.2 },
        ],
        panel: {
          title: 'Failure and fallback',
          icon: 'Activity',
          rows: [
            { text: 'Redis down', value: 'read shards, slower', tone: 'warn' },
            { text: 'Shard down', value: 'replica takes over', tone: 'good' },
            { text: 'Key service down', value: 'buffer covers creates' },
            { text: 'Owner table behind', value: 'retry job' },
          ],
        },
        caption: 'Slower, but still correct',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'A tiny record, a huge count, and one fast lookup',
      eli5: 'A **URL shortener** is a post office of tiny box numbers: keep busy cards by the window, split the drawers across rooms, and be able to close a bad box fast.',
      body: [
        'Redirects hit a Redis cache at 95%, are answered with a 302 so links stay countable and revocable, and drop click events onto a queue. Rows are sharded by code, aliases are conditional inserts, expired codes are retired, and hot keys get a few seconds of local caching.',
        'Codes come from a leased, scrambled counter (or a key pool), as in part 1.',
      ],
      keyIdea: 'Make codes unique by construction, keep the redirect to one cached lookup, and keep every copy short-lived enough to revoke.',
      metrics: { reads: '70K/s peak', hit: '95%', db: '3.5K/s over 32', p99: '8 ms' },
      metricTones: { hit: 'good', db: 'good', p99: 'good' },
      scene: {
        nodes: [users, { ...app, status: 'ok' }, { ...cache, status: 'ok' }, { ...shard2, status: 'ok' }, { ...queue, at: at(3, 4.4), status: 'ok' }],
        links: [link('users', 'app'), link('app', 'cache'), link('app', 'shard2'), link('app', 'queue', { style: 'dashed' })],
        flows: [
          { path: ['users', 'app', 'cache', 'app', 'users'], tone: 'response', count: 3, duration: 2.4 },
          { path: ['app', 'shard2', 'app'], tone: 'request', duration: 1.6, delay: 0.8 },
          { path: ['app', 'queue'], tone: 'event', duration: 1, delay: 2.4 },
        ],
        panel: {
          title: 'The finished design',
          icon: 'List',
          rows: [
            { text: 'Cache hit rate', value: '95%', tone: 'good' },
            { text: 'Redirect', value: '302, counted by queue' },
            { text: 'Storage', value: '32 shards by code' },
            { text: 'Hot key', value: '5 s local cache' },
            { text: 'Takedown', value: 'seconds, not hours', tone: 'good' },
          ],
        },
      },
      quiz: {
        question: 'A link was hijacked to point at a scam page, and you disable it. Which past choice means some visitors keep reaching the scam for a long time anyway?',
        options: [
          'Caching links in Redis with a 24-hour TTL',
          'Answering redirects with 301 Moved Permanently',
          'A 5-second in-process cache on each app server',
          'Sharding links by code',
        ],
        answer: 1,
        explain: 'You can delete your own Redis key, and the 5-second local copies expire on their own. A 301 lives in each visitor\'s browser, out of your reach, so those browsers skip your server and go straight to the scam.',
      },
    },
  ],
};
