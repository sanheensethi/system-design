import type { Lesson, SceneNode } from '../engine/types';

// Screen layout: u = x - y runs left to right, v = x + y runs top to bottom.
const users: SceneNode = { id: 'users', kind: 'client', at: [-4.5, 4.5], label: 'people', sub: '70K clicks/s peak' };
const app: SceneNode = { id: 'app', kind: 'server', at: [-2.25, 2.25], label: 'link service', sub: '20 app servers' };
const db: SceneNode = { id: 'db', kind: 'db', at: [1.25, 0.25], label: 'links DB', sub: 'one primary' };
const cache: SceneNode = { id: 'cache', kind: 'cache', at: [-2.75, -1.25], label: 'Redis', sub: 'hot links, 15 GB' };
const keygen: SceneNode = { id: 'keygen', kind: 'service', at: [-6.5, 0.5], label: 'ID ranges', sub: 'counter table' };
const queue: SceneNode = { id: 'queue', kind: 'queue', at: [0.25, -3.75], label: 'click events', sub: 'Kafka topic' };
const warehouse: SceneNode = { id: 'warehouse', kind: 'warehouse', at: [2.75, -4.75], label: 'analytics', sub: 'clicks per minute' };
const shard1: SceneNode = { id: 'shard1', kind: 'shard', at: [1, 1], label: 'shard 1', sub: '~3 TB' };
const shard2: SceneNode = { id: 'shard2', kind: 'shard', at: [2.1, -0.1], label: 'shard 2', sub: '~3 TB' };
const shard3: SceneNode = { id: 'shard3', kind: 'shard', at: [3.2, -1.2], label: 'shard 32', sub: '~3 TB' };
const sweeper: SceneNode = { id: 'sweeper', kind: 'worker', at: [5, -2], label: 'expiry sweeper', sub: 'nightly batches' };
const scanner: SceneNode = { id: 'scanner', kind: 'service', at: [1.75, 3.75], label: 'URL scanner', sub: 'blocklist feed' };

const shardLinks = [
  { from: 'users', to: 'app' },
  { from: 'app', to: 'cache' },
  { from: 'app', to: 'shard1' },
  { from: 'app', to: 'shard2' },
  { from: 'app', to: 'shard3' },
];

export const designUrlShortener: Lesson = {
  id: 'design-url-shortener',
  title: 'Design a URL shortener',
  tagline: 'Turn 100 million long links a day into 7-character codes, and redirect billions of clicks in a few milliseconds.',
  minutes: 18,
  level: 'Intermediate',
  learn: [
    'Turning 100M links a day into QPS, storage and code length',
    'Hash and truncate, a base 62 counter, or a pool of ready keys',
    'Caching hot links and choosing 301 or 302 with analytics in mind',
    'Sharding 91 TB by code, custom aliases and expiry',
    'Surviving a viral link and taking down a phishing link fast',
  ],
  metrics: [
    { key: 'writes', label: 'Creates' },
    { key: 'reads', label: 'Redirects' },
    { key: 'hit', label: 'Cache hit' },
    { key: 'db', label: 'DB reads' },
    { key: 'p99', label: 'p99 redirect' },
  ],
  steps: [
    {
      title: 'Requirements',
      tag: 'problem',
      heading: 'A short code for every link, clicked billions of times',
      eli5: 'Our **link service** is a post office that hands out tiny box numbers. A letter sent to a box gets forwarded to the long home address behind it, and millions of letters arrive every hour.',
      body: [
        'The product: send in a long URL, get back something like `sho.example/aZ3kQ9x`. Anyone who opens the short link lands on the original page. Owners also want custom aliases, expiry dates and click counts. The short link must stay up and must never send people to the wrong page, because it is printed on posters and buried in old emails.',
        'The numbers. **100M new links a day** is about 1,160 creates per second, call it 3,500/s at peak. Each link is clicked about 20 times over its life, so 2B redirects a day: 23K/s on average and **70K/s at peak**. We keep links for 5 years: 100M × 365 × 5 = **182 billion rows**. At about 500 bytes per row (URL, metadata, index) that is **91 TB** before any copies.',
        'One database box serves roughly 10K indexed reads per second and a few terabytes. We need 7 times the reads and 30 times the storage. Reads outnumber writes 20 to 1, and that ratio shapes every decision that follows.',
      ],
      keyIdea: 'Read-heavy, tiny records, huge count: redirects must be one fast lookup, and the data will not fit on one machine.',
      metrics: { writes: '3.5K/s peak', reads: '70K/s peak', hit: '-', db: '70K/s', p99: 'goal < 20 ms' },
      scene: {
        nodes: [{ ...users, status: 'hot' }, { ...app, status: 'active' }, { ...db, status: 'hot', badge: '91 TB · 70K reads/s' }],
        links: [
          { from: 'users', to: 'app' },
          { from: 'app', to: 'db' },
        ],
        flows: [
          { path: ['users', 'app'], tone: 'request', label: 'GET /aZ3kQ9x', count: 5, duration: 1 },
          { path: ['app', 'db'], tone: 'request', count: 5, duration: 1, delay: 1 },
          { path: ['db', 'app', 'users'], tone: 'response', label: '302', duration: 2, delay: 2.1 },
        ],
        caption: '20 redirects for every new link',
      },
    },
    {
      title: 'API',
      tag: 'concept',
      heading: 'Two endpoints, and the redirect is the one that matters',
      eli5: 'Grown-ups fill in a form at the counter to get a new box number. That form is the **API**. Letters to a box need no form at all: the clerk just reads the number and forwards them.',
      body: [
        '`POST /api/v1/links` takes a `long_url` plus an optional `alias` and `expires_at`, and returns `201` with the code. It needs an API key, so we know who owns each link and can rate limit creation per account. A client that retries after a timeout could create two links, so it sends an `Idempotency-Key` header (the API design lesson).',
        '`GET /{code}` is public and has no auth. It answers with a redirect status and a `Location` header, `404` for an unknown code and `410 Gone` for an expired or disabled one. Keep it tiny: no session, no JSON, one lookup.',
        'Owners read counts from `GET /api/v1/links/{code}/stats`. That endpoint can be a little stale, which matters later when we decide where clicks get counted.',
      ],
      keyIdea: 'The create call can afford auth and checks. The redirect call is the hot path, so it does one lookup and nothing else.',
      metrics: { writes: '3.5K/s peak', reads: '70K/s peak', hit: '-', db: '70K/s', p99: 'goal < 20 ms' },
      scene: {
        nodes: [{ ...users, label: 'owner + visitors', sub: 'API key / public' }, { ...app, status: 'active' }, db],
        links: [
          { from: 'users', to: 'app' },
          { from: 'app', to: 'db' },
        ],
        flows: [
          { path: ['users', 'app'], tone: 'request', label: 'POST /api/v1/links', duration: 1.1 },
          { path: ['app', 'db'], tone: 'data', label: 'INSERT', duration: 0.9, delay: 1.2 },
          { path: ['app', 'users'], tone: 'response', label: '201 aZ3kQ9x', duration: 1.1, delay: 2.2 },
          { path: ['users', 'app'], tone: 'request', label: 'GET /aZ3kQ9x', duration: 1.1, delay: 3.4 },
          { path: ['app', 'users'], tone: 'response', label: '302 Location', duration: 1.1, delay: 4.6 },
        ],
        caption: 'Create once, redirect many times',
      },
      code: {
        language: 'bash',
        title: 'Create a link, then follow it',
        source: `$ curl -s -X POST https://sho.example/api/v1/links \\
    -H "Authorization: Bearer $API_KEY" \\
    -H "Idempotency-Key: 7f1c-winter-mail" \\
    -d '{"long_url": "https://shop.example.com/sale/winter?utm=mail", "expires_at": "2027-01-31"}'
{"code": "aZ3kQ9x", "short_url": "https://sho.example/aZ3kQ9x"}

$ curl -sI https://sho.example/aZ3kQ9x
HTTP/1.1 302 Found
Location: https://shop.example.com/sale/winter?utm=mail

$ curl -sI https://sho.example/zzzzzzz
HTTP/1.1 404 Not Found`,
        highlight: [3, 7, 8],
      },
    },
    {
      title: 'Data model',
      tag: 'concept',
      heading: 'One row per link, read by its code',
      eli5: 'Each box number gets one index card with the home address on it. The clerk only ever looks a card up by its number, so the **data model** is just a giant drawer of cards sorted by number.',
      body: [
        'The redirect is a point lookup by `code`. No joins, no range scans, no transaction across rows. That fits a key-value or wide-column store that shards itself (the SQL and NoSQL lesson), and it fits sharded MySQL or Postgres too. The access pattern matters more than the product name.',
        'How long is a code? With 62 characters (`0-9a-zA-Z`), 6 characters give 62^6 = 56.8 billion codes, short of our 182 billion. **7 characters give 3.52 trillion**, about 19 times what five years need.',
        'Owners also want "show me my links". Scanning by `owner_id` across billions of rows is slow, so we write a second small table keyed by owner (the data modeling lesson). The redirect never reads it.',
      ],
      keyIdea: 'Design the table around the hot query. Here that is one primary-key lookup, so the code is the key.',
      metrics: { writes: '3.5K/s peak', reads: '70K/s peak', hit: '-', db: '70K/s', p99: 'goal < 20 ms' },
      scene: {
        nodes: [users, { ...app, status: 'active' }, { ...db, status: 'active', badge: 'PK = code' }],
        links: [
          { from: 'users', to: 'app' },
          { from: 'app', to: 'db' },
        ],
        flows: [
          { path: ['app', 'db'], tone: 'request', label: "WHERE code = 'aZ3kQ9x'", duration: 1.2 },
          { path: ['db', 'app'], tone: 'response', label: 'long_url', duration: 1.2, delay: 1.3 },
        ],
        caption: 'The redirect is a single key lookup',
      },
      code: {
        language: 'sql',
        title: 'The links table and its two queries',
        source: `CREATE TABLE links (
  code        VARCHAR(16) PRIMARY KEY,   -- 7 chars generated, longer for aliases
  long_url    TEXT        NOT NULL,      -- cap at 2,048 chars
  owner_id    BIGINT      NOT NULL,
  created_at  TIMESTAMP   NOT NULL,
  expires_at  TIMESTAMP,                 -- NULL means never
  status      SMALLINT    NOT NULL DEFAULT 0  -- 0 active, 1 disabled
);

-- the redirect: one primary-key lookup
SELECT long_url, expires_at, status FROM links WHERE code = 'aZ3kQ9x';

-- "my links": a separate table keyed by owner
CREATE TABLE links_by_owner (
  owner_id BIGINT, created_at TIMESTAMP, code VARCHAR(16),
  PRIMARY KEY (owner_id, created_at, code)
);`,
        highlight: [2, 11, 15],
      },
    },
    {
      title: 'Hash it',
      tag: 'case',
      heading: 'Simple design: hash the URL, keep 7 characters',
      eli5: 'The clerk makes a box number by scrambling the letters of the home address and keeping the first seven. Sometimes two addresses scramble to the same number, a **collision**, and two families would share one box.',
      body: [
        'The first design: app servers, one database, and a code made by hashing the long URL (MD5, say), writing the hash in base 62 and keeping the first 7 characters. The same URL always gets the same code, which looks like free deduplication.',
        'Truncating throws away most of the hash, so different URLs collide. The chance that a fresh code is already taken equals the share of the space in use: about **1% after year one** (36.5B of 3.52T) and **5% by year five**. Every create must read the database first and, on a hit, add a salt and hash again. Two servers can still race between the check and the insert unless the insert itself is conditional. A Bloom filter (the Bloom filters lesson) could skip most checks, but at 1% false positives it needs about 220 GB.',
        'The dedup is wrong for this product anyway. Two customers who shorten the same URL would share one code, and with it one click count and one expiry date. Mixing the owner into the hash fixes that and removes the only benefit.',
      ],
      keyIdea: 'Hash-and-truncate needs a lookup on every create, and the collision rate grows as the table fills.',
      metrics: { writes: '3.5K/s peak', reads: '70K/s peak', hit: '-', db: '73.5K/s', p99: '400 ms' },
      scene: {
        nodes: [users, { ...app, status: 'active', badge: 'md5 → 7 chars' }, { ...db, status: 'hot', badge: 'code taken (5%)' }],
        links: [
          { from: 'users', to: 'app' },
          { from: 'app', to: 'db' },
        ],
        flows: [
          { path: ['users', 'app'], tone: 'request', label: 'shorten', duration: 1 },
          { path: ['app', 'db'], tone: 'request', label: 'exists aZ3kQ9x?', duration: 1, delay: 1.1 },
          { path: ['db', 'app'], tone: 'error', label: 'taken', duration: 1, delay: 2.2 },
          { path: ['app', 'db'], tone: 'request', label: 'salt, retry', duration: 1, delay: 3.3 },
        ],
        caption: 'Every create pays a lookup, some pay two',
      },
    },
    {
      title: 'Counter',
      tag: 'concept',
      heading: 'Fix 1: a counter, written in base 62',
      eli5: 'Now the clerk tears box numbers off a numbered roll, so no two can ever match. Each clerk takes a whole strip of numbers at once from the **ID ranges** desk, so nobody waits in line for one number.',
      body: [
        'Give each link a unique integer and write it in base 62. Unique numbers give unique codes, so no existence check and no retry. The unique ID generation lesson lists the options. A Snowflake-style 64-bit ID needs 11 base 62 characters, too long, so we need IDs below 3.52 trillion.',
        '**Range leasing** does it. A tiny counter table hands each app server a block of 100,000 IDs, and the server spends them from memory. At 3,500 creates/s the counter sees one lease every 29 seconds or so. If a server crashes, its unused IDs are simply skipped. We have trillions.',
        'Sequential IDs give sequential codes, and anyone could walk the space to find private links. Multiplying the ID by a large odd constant that is not a multiple of 31, modulo 62^7, maps every ID to a different code and scatters neighbors. That hides the order from casual crawling. It is not encryption, so private pages still need their own auth.',
      ],
      keyIdea: 'A leased counter makes every code unique by construction, and a reversible scramble hides the order.',
      metrics: { writes: '3.5K/s peak', reads: '70K/s peak', hit: '-', db: '70K/s', p99: '400 ms' },
      scene: {
        nodes: [users, { ...app, status: 'active', badge: 'IDs left: 61,204' }, { ...keygen, status: 'ok' }, { ...db, status: 'hot', badge: 'no checks' }],
        links: [
          { from: 'users', to: 'app' },
          { from: 'app', to: 'keygen', style: 'dashed' },
          { from: 'app', to: 'db' },
        ],
        flows: [
          { path: ['app', 'keygen'], tone: 'request', label: 'lease 100,000', duration: 1 },
          { path: ['keygen', 'app'], tone: 'response', label: 'start 9,400,000', duration: 1, delay: 1.1 },
          { path: ['users', 'app'], tone: 'request', label: 'shorten', count: 3, duration: 1, delay: 2.2 },
          { path: ['app', 'db'], tone: 'data', label: 'INSERT, never collides', count: 3, duration: 1, delay: 3.3 },
        ],
        caption: 'Codes come from memory, the counter is touched twice a minute',
      },
      code: {
        language: 'typescript',
        title: 'Leased ID range, scrambled into a 7-character code',
        source: `const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const SPACE = 62n ** 7n;           // 3.52 trillion codes
const SCRAMBLE = 2_654_435_761n;    // odd and not a multiple of 31: a bijection mod 62^7

function toBase62(n: bigint): string {
  let s = '';
  for (let i = 0; i < 7; i++) { s = ALPHABET[Number(n % 62n)] + s; n /= 62n; }
  return s;                          // always 7 chars, zero padded
}

let next = 0n, end = 0n;
export async function newCode(): Promise<string> {
  if (next === end) {                // block used up: lease another
    next = await leaseBlock(100_000); // UPDATE counter SET v = v + 100000 RETURNING v - 100000
    end = next + 100_000n;
  }
  const id = next++;
  return toBase62((id * SCRAMBLE) % SPACE);  // neighbors land far apart
}`,
        highlight: [3, 14, 18],
      },
    },
    {
      title: 'Key choice',
      tag: 'tradeoff',
      heading: 'Hash, counter, or a pool of ready keys?',
      eli5: 'A third way: a helper prints random box numbers at night and keeps them in a **key pool** envelope. Each clerk grabs a handful in the morning, and the helper makes sure no two clerks get the same ones.',
      body: [
        'The third option is a **key generation service**. It creates random 7-character codes offline and keeps them in an "unused" table. App servers take 1,000 at a time, and the service moves each batch to "used" in one atomic step so no two servers get the same keys. Codes are random, so nobody can walk them, and no create ever checks for a collision.',
        'The price is another stateful service that must stay up. App servers buffer keys, so a short outage is absorbed, and keys a crashed server held are lost, which costs nothing in a space of 3.52 trillion.',
        'Side by side: hashing needs no coordination but pays a lookup per create and gets worse as the table fills. The counter is the simplest correct option but needs the scramble. The pool gives random codes with one more moving part. We keep the scrambled counter, and the pool is a fine answer too.',
      ],
      keyIdea: 'All three work. The question is where you pay: lookups on every create, a counter to coordinate, or a key service to run.',
      metrics: { writes: '3.5K/s peak', reads: '70K/s peak', hit: '-', db: '70K/s', p99: '400 ms' },
      scene: {
        nodes: [users, { ...app, status: 'active', badge: '1,000 keys buffered' }, { ...keygen, label: 'key pool', sub: 'random, unused', status: 'active', badge: 'unused → used' }, db],
        links: [
          { from: 'users', to: 'app' },
          { from: 'app', to: 'keygen', style: 'dashed' },
          { from: 'app', to: 'db' },
        ],
        flows: [
          { path: ['app', 'keygen'], tone: 'request', label: 'give me 1,000', duration: 1 },
          { path: ['keygen', 'app'], tone: 'response', label: 'batch 88,412', duration: 1, delay: 1.1 },
          { path: ['users', 'app', 'db'], tone: 'request', label: 'shorten', count: 2, duration: 1.6, delay: 2.2 },
        ],
        caption: 'Random keys, made ahead of time',
      },
      quiz: {
        question: 'A hash-and-truncate shortener has used 352 billion of its 3.52 trillion 7-character codes. Roughly what share of new creates hit a collision on the first try?',
        options: ['0.01%', '1%', '10%', '50%'],
        answer: 2,
        explain: 'A truncated hash behaves like a random code, so the chance it is taken equals the fraction in use: 352B / 3.52T = 10%. A counter or a key pool never collides at all.',
      },
    },
    {
      title: 'Cache',
      tag: 'concept',
      heading: 'Fix 2: keep hot links in memory',
      eli5: 'The clerk keeps cards for the busiest boxes on a little stand by the window. That stand is the **cache**, so most letters get forwarded without opening the big drawer.',
      body: [
        'Clicks are skewed. A link gets most of its clicks in its first day or two, and a small set of popular links takes a large share of all traffic. That is the shape caching loves (the caching lesson): cache-aside in Redis, keyed by code, filled on a miss with a 24-hour TTL.',
        'Sizing: if about 50 million distinct links get clicked on a busy day, at about 300 bytes each that is **15 GB**, a small Redis cluster with replicas. At a **95% hit rate** the database sees 3.5K reads/s at peak instead of 70K, and the redirect p99 falls to about 8 ms.',
        'Cache the misses too. Bots guess random codes, and every unknown code would otherwise reach the database. Storing "not found" for 60 seconds stops that cheaply.',
      ],
      keyIdea: 'Redirects are skewed and immutable, the best case for a cache: 95% of 70K reads/s never touch the database.',
      metrics: { writes: '3.5K/s peak', reads: '70K/s peak', hit: '95%', db: '3.5K/s', p99: '8 ms' },
      scene: {
        nodes: [users, app, { ...cache, status: 'ok', badge: '95% hit' }, { ...db, status: 'ok', badge: '3.5K reads/s' }],
        links: [
          { from: 'users', to: 'app' },
          { from: 'app', to: 'cache' },
          { from: 'app', to: 'db' },
        ],
        flows: [
          { path: ['users', 'app'], tone: 'request', count: 4, duration: 1 },
          { path: ['app', 'cache', 'app'], tone: 'response', label: 'GET aZ3kQ9x', count: 4, duration: 1.4, delay: 1 },
          { path: ['app', 'db', 'app'], tone: 'request', label: 'miss', duration: 1.6, delay: 1.6 },
          { path: ['app', 'users'], tone: 'response', label: '302', count: 4, duration: 1, delay: 2.6 },
        ],
        caption: '19 of every 20 lookups stop at Redis',
      },
    },
    {
      title: '301 or 302',
      tag: 'tradeoff',
      heading: '301 or 302, and where clicks get counted',
      eli5: 'A **301** tells the sender to write the home address themselves from now on, so the post office never sees those letters again. A **302** says keep sending to the box, so every letter gets counted.',
      body: [
        '**301 Moved Permanently** lets browsers cache the redirect, often for a long time. The second click never reaches us: less load, but no click count, and we can no longer change, expire or disable that link for that browser. **302 Found** says the move is temporary, so every click comes back to us.',
        'We default to 302. Owners want click stats, and we must be able to switch off a bad link. Owners who want the fastest possible hop and no stats can choose 301. A 301 with a short `Cache-Control: max-age` sits in between.',
        'Counting must not slow the redirect. The server sends the 302 at once and drops a click event (code, time, country, referrer) onto a queue (the message queues lesson). A stream job rolls them up per code per minute into the analytics store (the stream processing and data warehouse lessons). At 70K events/s and about 200 bytes each, that is 14 MB/s.',
      ],
      keyIdea: 'A 302 keeps every click visible and every link revocable. Count clicks off the hot path, through a queue.',
      metrics: { writes: '3.5K/s peak', reads: '70K/s peak', hit: '95%', db: '3.5K/s', p99: '8 ms' },
      scene: {
        nodes: [users, { ...app, status: 'active' }, { ...cache, status: 'ok' }, { ...db, status: 'dim' }, { ...queue, status: 'active', badge: '70K events/s' }, warehouse],
        links: [
          { from: 'users', to: 'app' },
          { from: 'app', to: 'cache' },
          { from: 'app', to: 'db', style: 'faint' },
          { from: 'app', to: 'queue', style: 'dashed' },
          { from: 'queue', to: 'warehouse' },
        ],
        flows: [
          { path: ['users', 'app'], tone: 'request', label: 'GET /aZ3kQ9x', duration: 1 },
          { path: ['app', 'cache', 'app'], tone: 'response', duration: 1.2, delay: 1.1 },
          { path: ['app', 'users'], tone: 'response', label: '302', duration: 1, delay: 2.4 },
          { path: ['app', 'queue'], tone: 'event', label: 'click', duration: 1, delay: 2.4 },
          { path: ['queue', 'warehouse'], tone: 'data', label: 'per-minute counts', duration: 1.2, delay: 3.5 },
        ],
        caption: 'Answer first, count afterwards',
      },
    },
    {
      title: 'Shards',
      tag: 'concept',
      heading: 'Fix 3: split 91 TB across shards',
      eli5: 'One drawer cannot hold billions of cards, so the post office uses many rooms. The box number alone tells the clerk which room to walk to. Each room is a **shard**.',
      body: [
        'The cache took the read load, but 91 TB and 182 billion rows still do not fit on one machine. Shard by `code` (the sharding lesson). Every redirect then touches exactly one shard, and new links spread evenly. Hashing the code onto a ring (the consistent hashing lesson) keeps the spread even for custom aliases too, and lets us add shards without moving everything.',
        '**32 shards** of about 3 TB each, every one with two replicas (the replication lesson), is about 275 TB on disk. Each shard sees roughly 110 cache-miss reads and 110 creates per second at peak, which is easy.',
        '"My links" would have to ask all 32 shards, so `links_by_owner` is sharded by `owner_id` instead. A create writes both. If the second write fails, a retry job finishes it, since the redirect only depends on the first.',
      ],
      keyIdea: 'Shard by the key the hot path reads. A second table sharded by owner serves the other query.',
      metrics: { writes: '3.5K/s peak', reads: '70K/s peak', hit: '95%', db: '3.5K/s over 32', p99: '8 ms' },
      scene: {
        nodes: [users, { ...app, status: 'active', badge: 'hash(code) → shard' }, { ...cache, status: 'ok' }, { ...shard1, badge: '~110 reads/s' }, { ...shard2, status: 'active', badge: 'aZ3kQ9x' }, shard3],
        links: shardLinks,
        flows: [
          { path: ['users', 'app'], tone: 'request', label: 'GET /aZ3kQ9x', duration: 1 },
          { path: ['app', 'cache'], tone: 'request', label: 'miss', duration: 0.9, delay: 1.1 },
          { path: ['app', 'shard2'], tone: 'request', duration: 1, delay: 2.1 },
          { path: ['shard2', 'app'], tone: 'response', label: 'long_url', duration: 1, delay: 3.2 },
        ],
        caption: 'The code alone picks the shard',
      },
    },
    {
      title: 'Aliases, expiry',
      tag: 'concept',
      heading: 'Custom aliases and links that expire',
      eli5: 'Some families pick a name for their box instead of a number, as long as nobody has it yet. Every box can also have a closing date, its **expiry**, and a closed box number is never handed out again.',
      body: [
        'An owner asks for `sho.example/winter-sale`. Aliases live in the same table, so creation is a **conditional insert**: write only if the code does not exist yet (`INSERT ... ON CONFLICT DO NOTHING`, or a conditional put). The loser of a race gets `409 Conflict`. Generated codes are always exactly 7 characters, so we refuse aliases of exactly 7: an alias can never take a code the counter will hand out later. Reserved words like `api` and `login` are blocked too.',
        'Expiry: on a redirect, if `expires_at` has passed, answer `410 Gone`. The cache TTL is the smaller of 24 hours and the time left, so a cached copy cannot outlive its link. A nightly background job deletes expired rows in small batches (the background jobs lesson).',
        'Never reuse an expired code. Old emails and printed flyers still carry it, and reusing it would send those readers to someone else\'s page.',
      ],
      keyIdea: 'Aliases share the namespace, so insert them conditionally. Expired codes are retired forever.',
      metrics: { writes: '3.5K/s peak', reads: '70K/s peak', hit: '95%', db: '3.5K/s over 32', p99: '8 ms' },
      scene: {
        nodes: [
          { ...users, label: 'owner', sub: 'alias: winter-sale' },
          { ...app, status: 'active' },
          cache,
          { ...shard1, status: 'active', badge: 'insert if absent' },
          shard2,
          { ...shard3, badge: 'expired rows' },
          { ...sweeper, status: 'active' },
        ],
        links: [...shardLinks, { from: 'sweeper', to: 'shard3', style: 'dashed' }],
        flows: [
          { path: ['users', 'app'], tone: 'request', label: 'POST alias', duration: 1 },
          { path: ['app', 'shard1'], tone: 'data', label: 'ON CONFLICT DO NOTHING', duration: 1.1, delay: 1.1 },
          { path: ['app', 'users'], tone: 'response', label: '201 or 409', duration: 1, delay: 2.3 },
          { path: ['sweeper', 'shard3'], tone: 'event', label: 'DELETE batch', duration: 1.2, delay: 0.6 },
        ],
        caption: 'First writer wins the alias, the sweeper clears expired rows',
      },
    },
    {
      title: 'Viral link',
      tag: 'case',
      heading: 'Case: one link takes 150K clicks a second, then turns out to be phishing',
      eli5: 'One box suddenly gets a mountain of letters, so every clerk keeps that card in a pocket for a few seconds. Then the box turns out to be a trick, and the **takedown** marks it closed everywhere at once.',
      body: [
        'A link lands in a huge push notification and its clicks jump to **150K/s**. All lookups for one key go to one Redis node, and one key cannot be split. That node pins its CPU and every other link stored there slows down. The fix is a small in-process cache in each app server for the hottest codes, with a **5-second TTL**. Redis now sees one read per server every 5 seconds for that code.',
        'An hour later the link is reported as phishing. Creation should have caught more of this: rate limit creates per account and per IP (the rate limiting lesson), check the destination against a blocklist before returning a code, and rescan later, since the page behind a URL can change after it was checked.',
        'Takedown: set `status = disabled` in the database, delete the Redis key, and in-process copies age out within 5 seconds. Visitors now get a warning page. Browsers that received a **301** would keep going straight to the scam, the strongest reason the default is 302.',
      ],
      keyIdea: 'Absorb a hot key with short local caches, and keep every copy short-lived enough that a takedown lands in seconds.',
      metrics: { writes: '3.5K/s peak', reads: '220K/s', hit: '99%', db: '3.5K/s over 32', p99: '9 ms' },
      scene: {
        nodes: [
          { ...users, status: 'hot', sub: '150K clicks/s, 1 code' },
          { ...app, status: 'active', badge: 'local cache 5 s' },
          { ...cache, status: 'hot', badge: '1 node, 1 hot key' },
          shard1,
          { ...shard2, badge: 'status = disabled' },
          shard3,
          { ...scanner, status: 'active', badge: 'phishing!' },
        ],
        links: [...shardLinks, { from: 'scanner', to: 'app', style: 'dashed' }],
        flows: [
          { path: ['users', 'app'], tone: 'request', count: 6, duration: 0.9 },
          { path: ['app', 'cache'], tone: 'request', label: '1 read / 5 s', duration: 1, delay: 1 },
          { path: ['scanner', 'app'], tone: 'event', label: 'takedown', duration: 1, delay: 2.2 },
          { path: ['app', 'shard2'], tone: 'data', label: 'disable', duration: 1, delay: 3.3 },
          { path: ['app', 'users'], tone: 'error', label: 'warning page', duration: 1, delay: 4.4 },
        ],
        caption: 'Local caches absorb the spike, and a takedown reaches every copy in 5 s',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'A tiny record, a huge count, and one fast lookup',
      eli5: 'A **URL shortener** is a post office of tiny box numbers: hand out numbers that never repeat, keep busy cards by the window, split the drawers across rooms, and be able to close a bad box fast.',
      body: [
        '100M links a day means 3.5K creates/s and 70K redirects/s at peak, 182 billion rows and 91 TB over five years, and 7 base 62 characters. Codes come from a leased, scrambled counter (or a key pool), never from a truncated hash that needs checks.',
        'Redirects hit a Redis cache at 95%, are answered with a 302 so links stay countable and revocable, and drop click events onto a queue. Rows are sharded by code, aliases are conditional inserts, expired codes are retired, and hot keys get a few seconds of local caching.',
      ],
      keyIdea: 'Make codes unique by construction, keep the redirect to one cached lookup, and keep every copy short-lived enough to revoke.',
      metrics: { writes: '3.5K/s peak', reads: '70K/s peak', hit: '95%', db: '3.5K/s over 32', p99: '8 ms' },
      scene: {
        nodes: [users, app, keygen, { ...cache, status: 'ok' }, { ...shard1, status: 'ok' }, { ...shard2, status: 'ok' }, { ...shard3, status: 'ok' }, queue],
        links: [...shardLinks, { from: 'app', to: 'keygen', style: 'dashed' }, { from: 'app', to: 'queue', style: 'dashed' }],
        flows: [
          { path: ['users', 'app', 'cache', 'app', 'users'], tone: 'response', count: 3, duration: 2.4 },
          { path: ['app', 'shard2', 'app'], tone: 'request', duration: 1.6, delay: 0.8 },
          { path: ['app', 'queue'], tone: 'event', duration: 1, delay: 2.4 },
        ],
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
