import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const users: SceneNode = { id: 'users', kind: 'client', at: at(-6, 0), label: 'visitors', sub: 'browsers and phones' };
const app: SceneNode = { id: 'app', kind: 'block', at: at(-2, 0), label: 'link service', sub: '20 app servers', icon: 'Network', tint: 'violet' };
const db: SceneNode = { id: 'db', kind: 'db', at: at(3.5, 0), label: 'links DB', sub: 'one primary' };
const keys: SceneNode = { id: 'keys', kind: 'block', at: at(1.5, -6.2), label: 'ID ranges', sub: 'counter table', icon: 'Hash', tint: 'amber' };
const checker: SceneNode = { id: 'checker', kind: 'block', at: at(1.5, -6.2), label: 'URL check', sub: 'scheme, size, blocklist', icon: 'Shield', tint: 'teal' };

export const designUrlShortener: Lesson = {
  id: 'design-url-shortener',
  title: 'Design a URL shortener (part 1)',
  tagline: 'Turn 100 million long links a day into 7-character codes. Part 1 covers the numbers, the API, the data model and how to make codes. Part 2 covers caching, sharding and abuse.',
  minutes: 15,
  level: 'Intermediate',
  learn: [
    'Turning 100M links a day into QPS, storage and code length',
    'The create and redirect endpoints, and the checks on a new URL',
    'A links table keyed by code, and a second table for "my links"',
    'Hash and truncate, a base 62 counter, or a pool of ready keys',
    'Why truncated hashes collide and how a leased counter never does',
  ],
  metrics: [
    { key: 'writes', label: 'Creates', icon: 'Zap' },
    { key: 'reads', label: 'Redirects', icon: 'Repeat' },
    { key: 'db', label: 'DB reads', icon: 'Database' },
    { key: 'p99', label: 'p99', icon: 'Timer' },
  ],
  steps: [
    {
      title: 'Requirements',
      tag: 'problem',
      heading: 'A short code for every link, clicked billions of times',
      eli5: 'Our **link service** is a post office that hands out tiny box numbers. A letter sent to a box gets forwarded to the long home address behind it, and millions of letters arrive every hour.',
      body: [
        'The product: send in a long URL, get back something like `sho.example/aZ3kQ9x`. Anyone who opens the short link lands on the original page.',
        'The short link is printed on posters and buried in old emails, so it must stay up and must never send people to the wrong page.',
      ],
      keyIdea: 'A shortener does two jobs: make a code, and turn the code back into the long URL fast and correctly.',
      metrics: { writes: '?', reads: '?', db: '?', p99: 'goal < 20 ms' },
      scene: {
        nodes: [{ ...users, chips: ['sho.example/aZ3kQ9x'] }, { ...app, status: 'active' }, db],
        links: [link('users', 'app', { label: 'GET /aZ3kQ9x' }), link('app', 'db')],
        flows: [
          { path: ['users', 'app', 'db'], tone: 'request', label: 'aZ3kQ9x?', duration: 1.8 },
          { path: ['db', 'app', 'users'], tone: 'response', label: '302 long URL', duration: 1.8, delay: 1.9 },
        ],
        panel: {
          title: 'What owners ask for',
          icon: 'List',
          rows: [
            { text: 'Short link from a long URL' },
            { text: 'Redirect when someone opens it' },
            { text: 'Custom alias, like /winter-sale' },
            { text: 'Expiry date' },
            { text: 'Click counts' },
            { text: 'Never the wrong page', tone: 'good' },
          ],
        },
        caption: 'Create once, redirect many times',
      },
    },
    {
      title: 'Traffic',
      tag: 'concept',
      heading: 'Traffic: 100M new links a day',
      eli5: 'Lots of families ask the post office for a new box every day, and lots more send letters to boxes that already exist. Letters to boxes far outnumber new boxes.',
      body: [
        '**100M new links a day** is about 1,160 creates per second. Call it 3,500/s at peak.',
        'Each link is clicked about 20 times over its life, so 2B redirects a day: 23K/s on average and **70K/s at peak**. Reads outnumber writes 20 to 1, and that ratio shapes every decision that follows.',
      ],
      keyIdea: 'Read-heavy: 20 redirects for every new link, 70K/s at peak.',
      metrics: { writes: '3.5K/s peak', reads: '70K/s peak', db: '70K/s', p99: 'goal < 20 ms' },
      metricTones: { reads: 'warn' },
      scene: {
        nodes: [{ ...users, status: 'hot' }, { ...app, status: 'active', chips: ['POST 3.5K/s', { text: 'GET 70K/s', tone: 'warn' }] }, { ...db, status: 'dim' }],
        links: [link('users', 'app', { label: '70K clicks/s peak', labelTone: 'warn' }), link('app', 'db', { style: 'faint' })],
        flows: [
          { path: ['users', 'app'], tone: 'request', label: 'GET', count: 5, duration: 1 },
          { path: ['users', 'app'], tone: 'data', label: 'POST', duration: 1.2, delay: 1.2 },
        ],
        panel: {
          title: 'Requests per second',
          icon: 'Gauge',
          rows: [
            { text: 'Creates, average', value: '1,160/s' },
            { text: 'Creates, peak', value: '3,500/s' },
            { text: 'Redirects a day', value: '2B' },
            { text: 'Redirects, average', value: '23K/s' },
            { text: 'Redirects, peak', value: '70K/s', tone: 'warn' },
          ],
        },
        caption: '20 redirects for every new link',
      },
    },
    {
      title: 'Storage',
      tag: 'concept',
      heading: 'Storage: 182 billion rows, 91 TB',
      eli5: 'The post office keeps one index card per box for five years. Billions of cards will not fit in one drawer, and one clerk cannot look up that many cards each second.',
      body: [
        'We keep links for 5 years: 100M × 365 × 5 = **182 billion rows**. At about 500 bytes per row (URL, metadata, index) that is **91 TB** before any copies.',
        'One database box serves roughly 10K indexed reads per second and a few terabytes. We need 7 times the reads and 30 times the storage.',
      ],
      keyIdea: 'Tiny records, huge count: redirects must be one fast lookup, and the data will not fit on one machine.',
      metrics: { writes: '3.5K/s peak', reads: '70K/s peak', db: '70K/s', p99: 'goal < 20 ms' },
      metricTones: { db: 'bad' },
      scene: {
        nodes: [users, { ...app, status: 'active' }, { ...db, status: 'hot', load: 100, badge: '91 TB · 70K reads/s' }],
        links: [link('users', 'app'), link('app', 'db', { label: '70K reads/s vs 10K', labelTone: 'warn' })],
        flows: [
          { path: ['app', 'db'], tone: 'request', count: 5, duration: 1 },
          { path: ['db', 'app'], tone: 'error', label: 'slow', duration: 1.4, delay: 1.1 },
        ],
        panel: {
          title: 'One box vs what we need',
          icon: 'HardDrive',
          rows: [
            { text: 'Rows in 5 years', value: '182B' },
            { text: 'Data size', value: '91 TB', tone: 'warn' },
            { text: 'One box, storage', value: 'a few TB' },
            { text: 'One box, reads', value: '10K/s' },
            { text: 'Gap', value: '7x reads, 30x data', tone: 'bad' },
          ],
        },
        caption: 'One database box falls short on both counts',
      },
    },
    {
      title: 'Create API',
      tag: 'concept',
      heading: 'Create a link: the endpoint that can afford checks',
      eli5: 'Grown-ups fill in a form at the counter to get a new box number. That form is the **API**, and the clerk checks who is asking before handing out a number.',
      body: [
        '`POST /api/v1/links` takes a `long_url` plus an optional `alias` and `expires_at`, and returns `201` with the code. It needs an API key, so we know who owns each link and can rate limit creation per account.',
        'A client that retries after a timeout could create two links, so it sends an `Idempotency-Key` header (the API design lesson).',
      ],
      keyIdea: 'The create call can afford auth, rate limits and checks. Only 1 call in 21 is a create.',
      metrics: { writes: '3.5K/s peak', reads: '70K/s peak', db: '70K/s', p99: 'goal < 20 ms' },
      scene: {
        nodes: [{ ...users, label: 'owner', sub: 'has an API key' }, { ...app, status: 'active', chips: ['POST /api/v1/links'] }, db],
        links: [link('users', 'app', { label: 'Bearer API key' }), link('app', 'db')],
        flows: [
          { path: ['users', 'app'], tone: 'request', label: 'POST', duration: 1.1 },
          { path: ['app', 'db'], tone: 'data', label: 'INSERT', duration: 0.9, delay: 1.2 },
          { path: ['app', 'users'], tone: 'response', label: '201 aZ3kQ9x', duration: 1.1, delay: 2.2 },
        ],
        panel: {
          title: 'What a create call carries',
          icon: 'KeyRound',
          rows: [
            { text: 'Authorization', value: 'API key' },
            { text: 'Rate limit', value: 'per account' },
            { text: 'Idempotency-Key', value: 'safe retries' },
            { text: 'Body', value: 'long_url, alias?, expires_at?' },
            { text: 'Success', value: '201 + code', tone: 'good' },
          ],
        },
        caption: 'Create once, with checks',
      },
      code: {
        language: 'bash',
        title: 'Create a link',
        source: `$ curl -s -X POST https://sho.example/api/v1/links \\
    -H "Authorization: Bearer $API_KEY" \\
    -H "Idempotency-Key: 7f1c-winter-mail" \\
    -H "Content-Type: application/json" \\
    -d '{"long_url": "https://shop.example.com/sale/winter?utm=mail", "expires_at": "2027-01-31"}'
{"code": "aZ3kQ9x", "short_url": "https://sho.example/aZ3kQ9x"}`,
        highlight: [2, 3, 4],
      },
    },
    {
      title: 'Redirect API',
      tag: 'concept',
      heading: 'Redirect: the hot path does one lookup',
      eli5: 'Letters to a box need no form at all. The clerk reads the number on the envelope and forwards the letter, or says there is no such box.',
      body: [
        '`GET /{code}` is public and has no auth. It answers with a redirect status and a `Location` header, `404` for an unknown code and `410 Gone` for an expired or disabled one.',
        'Keep it tiny: no session, no JSON, one lookup.',
      ],
      keyIdea: 'The redirect call is the hot path, so it does one lookup and nothing else.',
      metrics: { writes: '3.5K/s peak', reads: '70K/s peak', db: '70K/s', p99: 'goal < 20 ms' },
      scene: {
        nodes: [{ ...users, chips: ['GET /aZ3kQ9x'] }, { ...app, status: 'active' }, { ...db, status: 'active' }],
        links: [link('users', 'app'), link('app', 'db')],
        flows: [
          { path: ['users', 'app', 'db'], tone: 'request', label: 'aZ3kQ9x?', duration: 1.8 },
          { path: ['db', 'app', 'users'], tone: 'response', label: '302 Location', duration: 1.8, delay: 1.9 },
        ],
        panel: {
          title: 'Answers to GET /{code}',
          icon: 'Route',
          rows: [
            { text: 'Known code', value: '302 + Location', tone: 'good' },
            { text: 'Unknown code', value: '404' },
            { text: 'Expired or disabled', value: '410 Gone', tone: 'warn' },
            { text: 'Auth or session', value: 'none' },
          ],
        },
        caption: 'Public, tiny, one lookup',
      },
      code: {
        language: 'bash',
        title: 'Follow a short link',
        source: `$ curl -sI https://sho.example/aZ3kQ9x
HTTP/1.1 302 Found
Location: https://shop.example.com/sale/winter?utm=mail

$ curl -sI https://sho.example/zzzzzzz
HTTP/1.1 404 Not Found`,
        highlight: [2, 3],
      },
    },
    {
      title: 'Stats API',
      tag: 'concept',
      heading: 'Click counts come from a separate, slower endpoint',
      eli5: 'Families can ask how many letters came to their box. The clerk reads that from a tally book kept in the back, which can be a little behind, so the front counter stays fast.',
      body: [
        'Owners read counts from `GET /api/v1/links/{code}/stats`. It needs an API key and checks that the caller owns the link.',
        'That endpoint can be a little stale. It reads from an analytics store rather than the links table, which matters later when we decide where clicks get counted.',
      ],
      keyIdea: 'Stats may lag by minutes, so they never need to sit on the redirect path.',
      metrics: { writes: '3.5K/s peak', reads: '70K/s peak', db: '70K/s', p99: 'goal < 20 ms' },
      scene: {
        nodes: [
          { ...users, label: 'owner', sub: 'has an API key', chips: ['GET .../stats'] },
          { ...app, status: 'active' },
          { id: 'warehouse', kind: 'warehouse', at: at(3.5, 0), label: 'analytics', sub: 'clicks per minute' },
        ],
        links: [link('users', 'app'), link('app', 'warehouse')],
        flows: [
          { path: ['users', 'app', 'warehouse'], tone: 'request', label: 'stats', duration: 1.8 },
          { path: ['warehouse', 'app', 'users'], tone: 'response', label: '1,204 clicks', duration: 1.8, delay: 1.9 },
        ],
        panel: {
          title: 'Stats endpoint',
          icon: 'TrendingUp',
          rows: [
            { text: 'Reads from', value: 'analytics store' },
            { text: 'Freshness', value: 'minutes old', tone: 'warn' },
            { text: 'Caller', value: 'link owner only' },
          ],
        },
        caption: 'Slow and stale is fine here',
      },
    },
    {
      title: 'Check URLs',
      tag: 'concept',
      heading: 'Check every long URL before issuing a code',
      eli5: 'Before giving out a box number, the clerk looks at the home address on the form. If it is scribbled nonsense or points to a known trick, the clerk says no.',
      body: [
        'Accept only `http` and `https`, so nothing like `javascript:` slips through. Cap the length at 2,048 characters and normalize the URL (lowercase host, no fragment noise).',
        'Reject our own domain, which would loop. Check the host against a blocklist before returning a code. Bad requests get `400`.',
      ],
      keyIdea: 'Every bad URL we refuse at create time is one less takedown later.',
      metrics: { writes: '3.5K/s peak', reads: '70K/s peak', db: '70K/s', p99: 'goal < 20 ms' },
      scene: {
        nodes: [{ ...users, label: 'owner', chips: [{ text: 'javascript:alert(1)', tone: 'bad' }] }, { ...app, status: 'active' }, checker, { ...db, status: 'dim' }],
        links: [link('users', 'app'), link('app', 'checker', { style: 'dashed' }), link('app', 'db', { style: 'faint' })],
        flows: [
          { path: ['users', 'app'], tone: 'request', label: 'POST', duration: 1 },
          { path: ['app', 'checker'], tone: 'request', label: 'check', duration: 1, delay: 1.1 },
          { path: ['checker', 'app'], tone: 'error', label: 'bad scheme', duration: 1, delay: 2.2 },
          { path: ['app', 'users'], tone: 'error', label: '400', duration: 1, delay: 3.3 },
        ],
        panel: {
          title: 'Rules at create time',
          icon: 'Shield',
          rows: [
            { text: 'Scheme', value: 'http or https' },
            { text: 'Length', value: '2,048 chars max' },
            { text: 'Host', value: 'not our own domain' },
            { text: 'Blocklist', value: 'known bad hosts' },
            { text: 'Failure', value: '400', tone: 'warn' },
          ],
        },
        caption: 'Refuse bad URLs before they get a code',
      },
    },
    {
      title: 'Data model',
      tag: 'concept',
      heading: 'One row per link, read by its code',
      eli5: 'Each box number gets one index card with the home address on it. The clerk only ever looks a card up by its number, so the **data model** is just a giant drawer of cards sorted by number.',
      body: [
        'The redirect is a point lookup by `code`. No joins, no range scans, no transaction across rows.',
        'That fits a key-value or wide-column store that shards itself (the SQL and NoSQL lesson), and it fits sharded MySQL or Postgres too. The access pattern matters more than the product name.',
      ],
      keyIdea: 'Design the table around the hot query. Here that is one primary-key lookup, so the code is the key.',
      metrics: { writes: '3.5K/s peak', reads: '70K/s peak', db: '70K/s', p99: 'goal < 20 ms' },
      scene: {
        nodes: [users, { ...app, status: 'active' }, { ...db, status: 'active', badge: 'PK = code' }],
        links: [link('users', 'app'), link('app', 'db')],
        flows: [
          { path: ['app', 'db'], tone: 'request', label: "WHERE code = 'aZ3kQ9x'", duration: 1.4 },
          { path: ['db', 'app'], tone: 'response', label: 'long_url', duration: 1.2, delay: 1.5 },
        ],
        panel: {
          title: 'links table',
          icon: 'Table',
          rows: [
            { text: 'code', value: 'primary key' },
            { text: 'long_url', value: 'up to 2,048 chars' },
            { text: 'owner_id', value: 'who made it' },
            { text: 'created_at, expires_at', value: 'NULL = never' },
            { text: 'status', value: '0 active, 1 disabled' },
          ],
        },
        caption: 'The redirect is a single key lookup',
      },
      code: {
        language: 'sql',
        title: 'The links table and the redirect query',
        source: `CREATE TABLE links (
  code        VARCHAR(16) PRIMARY KEY,   -- 7 chars generated, longer for aliases
  long_url    TEXT        NOT NULL,      -- cap at 2,048 chars
  owner_id    BIGINT      NOT NULL,
  created_at  TIMESTAMP   NOT NULL,
  expires_at  TIMESTAMP,                 -- NULL means never
  status      SMALLINT    NOT NULL DEFAULT 0  -- 0 active, 1 disabled
);

-- the redirect: one primary-key lookup
SELECT long_url, expires_at, status FROM links WHERE code = 'aZ3kQ9x';`,
        highlight: [2, 11],
      },
    },
    {
      title: 'My links',
      tag: 'concept',
      heading: 'A second table answers "show me my links"',
      eli5: 'Families also want a list of all their own boxes. Searching every card in the big drawer would take forever, so the clerk keeps a small second drawer sorted by family name.',
      body: [
        'Owners also want "show me my links". Scanning by `owner_id` across billions of rows is slow, so we write a second small table keyed by owner (the data modeling lesson).',
        'The table keeps a denormalized copy of `long_url` and `status`, so a dashboard page needs no lookups in the links table. The key sorts `created_at` descending for newest first, and the API pages with a cursor (the last `created_at` seen). The redirect never reads this table.',
      ],
      keyIdea: 'One table per query shape: the hot path keeps its own lean table.',
      metrics: { writes: '3.5K/s peak', reads: '70K/s peak', db: '70K/s', p99: 'goal < 20 ms' },
      scene: {
        nodes: [
          { ...users, label: 'owner', chips: ['GET /api/v1/links'] },
          { ...app, status: 'active' },
          { ...db, at: at(3.5, -4.4), status: 'dim', sub: 'by code' },
          { id: 'ownerdb', kind: 'db', at: at(3.5, 4.4), label: 'by owner', sub: 'links_by_owner', status: 'active', badge: 'PK = owner_id' },
        ],
        links: [link('users', 'app'), link('app', 'db', { style: 'faint' }), link('app', 'ownerdb')],
        flows: [
          { path: ['users', 'app'], tone: 'request', label: 'my links', duration: 1 },
          { path: ['app', 'ownerdb'], tone: 'request', label: 'owner_id = 42', duration: 1.2, delay: 1.1 },
          { path: ['ownerdb', 'app', 'users'], tone: 'response', label: 'newest 50, with cursor', duration: 1.8, delay: 2.4 },
        ],
        panel: {
          title: 'Two tables, two questions',
          icon: 'Table',
          rows: [
            { text: 'links', value: 'key: code' },
            { text: 'Used by', value: 'every redirect' },
            { text: 'links_by_owner', value: 'key: owner_id, created_at DESC' },
            { text: 'Used by', value: 'the dashboard, paged by cursor' },
            { text: 'Extra columns', value: 'long_url, status (copied)' },
          ],
        },
        caption: 'Same data, laid out for a second question',
      },
      code: {
        language: 'sql',
        title: 'The second table',
        source: `-- "my links": a separate table keyed by owner
CREATE TABLE links_by_owner (
  owner_id BIGINT, created_at TIMESTAMP, code VARCHAR(16),
  long_url TEXT, status VARCHAR(8),        -- denormalized copy
  PRIMARY KEY (owner_id, created_at DESC, code)
);`,
        highlight: [1, 3, 4],
      },
    },
    {
      title: 'Code length',
      tag: 'concept',
      heading: 'How long is a code? Seven characters',
      eli5: 'A box number made of letters and digits gets many more combinations than digits alone. We need enough numbers that a new box never runs out, even after five years.',
      body: [
        'With 62 characters (`0-9a-zA-Z`), 6 characters give 62^6 = 56.8 billion codes, short of our 182 billion.',
        '**7 characters give 3.52 trillion**, about 19 times what five years need. That slack matters later, because random codes collide more as the space fills.',
      ],
      keyIdea: '7 base 62 characters is the smallest length with room to spare.',
      metrics: { writes: '3.5K/s peak', reads: '70K/s peak', db: '70K/s', p99: 'goal < 20 ms' },
      scene: {
        nodes: [users, { ...app, status: 'active', chips: ['aZ3kQ9x'] }, { ...db, badge: '182B links' }],
        links: [link('users', 'app'), link('app', 'db')],
        flows: [{ path: ['users', 'app'], tone: 'request', label: 'shorten', duration: 1.2 }, { path: ['app', 'users'], tone: 'response', label: 'aZ3kQ9x', duration: 1.2, delay: 1.3 }],
        panel: {
          title: 'Codes in base 62',
          icon: 'Binary',
          rows: [
            { text: '6 characters', value: '56.8B', tone: 'bad' },
            { text: '7 characters', value: '3.52T', tone: 'good' },
            { text: '8 characters', value: '218T' },
            { text: 'Need in 5 years', value: '182B' },
          ],
          footer: { text: '7 chars is about 19x headroom', tone: 'good' },
        },
        caption: '62^7 = 3.52 trillion',
      },
    },
    {
      title: 'Hash it',
      tag: 'case',
      heading: 'Simple design: hash the URL, keep 7 characters',
      eli5: 'The clerk makes a box number by scrambling the letters of the home address and keeping the first seven. The same address always scrambles to the same number.',
      body: [
        'The first design: app servers, one database, and a code made by hashing the long URL (MD5, say), writing the hash in base 62 and keeping the first 7 characters.',
        'The same URL always gets the same code, which looks like free deduplication.',
      ],
      keyIdea: 'Hash-and-truncate needs no coordination between servers, which is why it is tempting.',
      metrics: { writes: '3.5K/s peak', reads: '70K/s peak', db: '73.5K/s', p99: '400 ms' },
      scene: {
        nodes: [users, { ...app, status: 'active', chips: ['md5 → 7 chars'] }, { ...db, status: 'active' }],
        links: [link('users', 'app'), link('app', 'db')],
        flows: [
          { path: ['users', 'app'], tone: 'request', label: 'shorten', duration: 1 },
          { path: ['app', 'db'], tone: 'data', label: 'INSERT aZ3kQ9x', duration: 1.1, delay: 1.1 },
        ],
        panel: {
          title: 'Code from a hash',
          icon: 'Hash',
          code: 'md5(long_url)\n  -> 128-bit hash\n  -> write in base 62\n  -> keep the first 7 chars',
          footer: { text: 'Same URL, same code', tone: 'muted' },
        },
        caption: 'Hash, truncate, insert',
      },
    },
    {
      title: 'Collisions',
      tag: 'case',
      heading: 'Truncating throws away the guarantee',
      eli5: 'Keeping only seven letters of a long scramble means two different addresses can end up with the same box number, a **collision**. The more boxes exist, the more often it happens.',
      body: [
        'The chance that a fresh code is already taken equals the share of the space in use: about **1% after year one** (36.5B of 3.52T) and **5% by year five**.',
        'Every create must read the database first and, on a hit, add a salt and hash again. Two servers can still race between the check and the insert unless the insert is conditional. A Bloom filter (the Bloom filters lesson) could skip most checks, but at 1% false positives it needs about 220 GB.',
      ],
      keyIdea: 'Hash-and-truncate needs a lookup on every create, and the collision rate grows as the table fills.',
      metrics: { writes: '3.5K/s peak', reads: '70K/s peak', db: '73.5K/s', p99: '400 ms' },
      metricTones: { db: 'warn', p99: 'bad' },
      scene: {
        nodes: [users, { ...app, status: 'active', chips: ['md5 → 7 chars'] }, { ...db, status: 'hot', badge: 'code taken (5%)' }],
        links: [link('users', 'app'), link('app', 'db', { label: 'check, then insert', labelTone: 'warn' })],
        flows: [
          { path: ['users', 'app'], tone: 'request', label: 'shorten', duration: 1 },
          { path: ['app', 'db'], tone: 'request', label: 'exists aZ3kQ9x?', duration: 1, delay: 1.1 },
          { path: ['db', 'app'], tone: 'error', label: 'taken', duration: 1, delay: 2.2 },
          { path: ['app', 'db'], tone: 'request', label: 'salt, retry', duration: 1, delay: 3.3 },
        ],
        panel: {
          title: 'Chance a new code is taken',
          icon: 'Bug',
          rows: [
            { text: 'After year 1', value: '1%' },
            { text: 'After year 5', value: '5%', tone: 'warn' },
            { text: 'Every create', value: 'reads first', tone: 'warn' },
            { text: 'Bloom filter at 1% error', value: '~220 GB' },
          ],
        },
        caption: 'Every create pays a lookup, some pay two',
      },
    },
    {
      title: 'Dedup trap',
      tag: 'case',
      heading: 'The free deduplication is wrong for this product',
      eli5: 'Two families ask for a box with the same home address. If they get the same box number, their letters mix together, and closing one family\'s box closes the other\'s.',
      body: [
        'Two customers who shorten the same URL would share one code, and with it one click count and one expiry date.',
        'Mixing the owner into the hash fixes that, and it removes the only benefit of hashing.',
      ],
      keyIdea: 'Per-owner links need per-owner codes, so the dedup argument for hashing falls away.',
      metrics: { writes: '3.5K/s peak', reads: '70K/s peak', db: '73.5K/s', p99: '400 ms' },
      scene: {
        nodes: [
          { ...users, at: at(-6, -3.4), id: 'users', label: 'team A', sub: 'owner 17' },
          { id: 'usersB', kind: 'client', at: at(-6, 3.4), label: 'team B', sub: 'owner 42' },
          { ...app, status: 'active' },
          { ...db, status: 'hot', badge: 'one row, two owners' },
        ],
        links: [link('users', 'app'), link('usersB', 'app'), link('app', 'db')],
        flows: [
          { path: ['users', 'app', 'db'], tone: 'request', label: 'same URL', duration: 1.6 },
          { path: ['usersB', 'app', 'db'], tone: 'request', label: 'same URL', duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'One code, two owners',
          icon: 'Copy',
          rows: [
            { text: 'Click counts', value: 'mixed together', tone: 'bad' },
            { text: 'Expiry', value: 'one date for both', tone: 'bad' },
            { text: 'Disable', value: 'hits both', tone: 'bad' },
            { text: 'Fix: hash owner too', value: 'no dedup left', tone: 'warn' },
          ],
        },
        caption: 'Same long URL, same code, shared fate',
      },
    },
    {
      title: 'Counter',
      tag: 'concept',
      heading: 'Fix 1: a counter, written in base 62',
      eli5: 'Now the clerk tears box numbers off a numbered roll, so no two can ever match. Writing the number with letters and digits makes it short.',
      body: [
        'Give each link a unique integer and write it in base 62. Unique numbers give unique codes, so no existence check and no retry. The unique ID generation lesson lists the options.',
        'A Snowflake-style 64-bit ID needs 11 base 62 characters, too long, so we need IDs below 3.52 trillion.',
      ],
      keyIdea: 'Unique integers make unique codes by construction.',
      metrics: { writes: '3.5K/s peak', reads: '70K/s peak', db: '70K/s', p99: '400 ms' },
      scene: {
        nodes: [users, { ...app, status: 'active', chips: ['id 9,400,000 → 000DrmU'] }, { ...db, status: 'ok', badge: 'no checks' }],
        links: [link('users', 'app'), link('app', 'db')],
        flows: [
          { path: ['users', 'app'], tone: 'request', label: 'shorten', duration: 1 },
          { path: ['app', 'db'], tone: 'data', label: 'INSERT, never collides', duration: 1.2, delay: 1.1 },
        ],
        panel: {
          title: 'Integer to code',
          icon: 'Binary',
          rows: [
            { text: 'id', value: '9,400,000' },
            { text: 'base 62', value: 'DrmU' },
            { text: 'padded to 7', value: '000DrmU', tone: 'good' },
            { text: '64-bit Snowflake', value: '11 chars, too long', tone: 'warn' },
          ],
        },
        caption: 'A number in, a code out',
      },
    },
    {
      title: 'Range leasing',
      tag: 'concept',
      heading: 'Lease blocks of IDs so servers never wait in line',
      eli5: 'Each clerk takes a whole strip of numbers off the roll at once from the **ID ranges** desk and tears them off one by one. Nobody queues for each single number.',
      body: [
        'A tiny counter table hands each app server a block of 100,000 IDs, and the server spends them from memory. At 3,500 creates/s the counter sees one lease every 29 seconds or so.',
        'If a server crashes, its unused IDs are simply skipped. We have trillions.',
      ],
      keyIdea: 'Lease IDs in blocks and the shared counter is touched twice a minute.',
      metrics: { writes: '3.5K/s peak', reads: '70K/s peak', db: '70K/s', p99: '400 ms' },
      scene: {
        nodes: [users, { ...app, status: 'active', badge: 'IDs left: 61,204' }, { ...keys, status: 'ok' }, db],
        links: [link('users', 'app'), link('app', 'keys', { style: 'dashed', label: 'lease' }), link('app', 'db')],
        flows: [
          { path: ['app', 'keys'], tone: 'request', label: 'lease 100,000', duration: 1 },
          { path: ['keys', 'app'], tone: 'response', label: 'start 9,400,000', duration: 1, delay: 1.1 },
          { path: ['users', 'app'], tone: 'request', label: 'shorten', count: 3, duration: 1, delay: 2.2 },
          { path: ['app', 'db'], tone: 'data', label: 'INSERT', count: 3, duration: 1, delay: 3.3 },
        ],
        panel: {
          title: 'Leasing in numbers',
          icon: 'Receipt',
          rows: [
            { text: 'Block size', value: '100,000 IDs' },
            { text: 'Lease rate at peak', value: '1 per ~29 s' },
            { text: 'Crashed server', value: 'unused IDs skipped' },
            { text: 'Space left', value: 'trillions', tone: 'good' },
          ],
        },
        caption: 'Codes come from memory, the counter is touched twice a minute',
      },
    },
    {
      title: 'Scramble',
      tag: 'concept',
      heading: 'Scramble the counter so codes are hard to walk casually',
      eli5: 'Numbers off the roll come out one, two, three, so a nosy kid could guess every box. The clerk shuffles each number into a far-away one first, so neighbors look unrelated.',
      body: [
        'Sequential IDs give sequential codes, and anyone could walk the space to find private links. Multiplying the ID by a large odd constant that is not a multiple of 31, modulo 62^7, maps every ID to a different code and scatters neighbors.',
        'That hides the order from casual crawling. A linear scramble is recoverable: two codes from consecutive creates reveal the constant. For real unguessability use a keyed permutation (a small Feistel network over 62^7) or the random key pool. Private pages still need auth.',
      ],
      keyIdea: 'A reversible scramble makes codes hard to walk casually, and it costs one multiplication.',
      metrics: { writes: '3.5K/s peak', reads: '70K/s peak', db: '70K/s', p99: '400 ms' },
      scene: {
        nodes: [users, { ...app, status: 'active', chips: ['id 9,400,000 → iBoQZmU', 'id 9,400,001 → iEiuJmV'] }, { ...db, status: 'ok' }],
        links: [link('users', 'app'), link('app', 'db')],
        flows: [
          { path: ['users', 'app'], tone: 'request', label: 'shorten', duration: 1 },
          { path: ['app', 'db'], tone: 'data', label: 'INSERT iBoQZmU', duration: 1.2, delay: 1.1 },
        ],
        panel: {
          title: 'Why scramble',
          icon: 'Shield',
          rows: [
            { text: 'Unscrambled', value: 'neighbors are guessable', tone: 'bad' },
            { text: 'Scrambled', value: 'neighbors look random', tone: 'good' },
            { text: 'Every ID', value: 'maps to its own code' },
            { text: 'Two known codes', value: 'reveal the constant', tone: 'warn' },
            { text: 'Private pages', value: 'still need auth', tone: 'warn' },
          ],
        },
        caption: 'Neighbors land far apart',
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
      title: 'Key pool',
      tag: 'concept',
      heading: 'Option 3: a pool of ready keys',
      eli5: 'A third way: a helper prints random box numbers at night and keeps them in a **key pool** envelope. Each clerk grabs a handful in the morning, and the helper makes sure no two clerks get the same ones.',
      body: [
        'A **key generation service** creates random 7-character codes offline and keeps them in an "unused" table. App servers take 1,000 at a time, and the service moves each batch to "used" in one atomic step so no two servers get the same keys.',
        'Codes are random, so nobody can walk them, and no create ever checks for a collision.',
      ],
      keyIdea: 'A key pool hands out random, never-repeated codes made ahead of time.',
      metrics: { writes: '3.5K/s peak', reads: '70K/s peak', db: '70K/s', p99: '400 ms' },
      scene: {
        nodes: [users, { ...app, status: 'active', badge: '1,000 keys buffered' }, { ...keys, label: 'key pool', sub: 'random, unused', status: 'active', badge: 'unused → used' }, db],
        links: [link('users', 'app'), link('app', 'keys', { style: 'dashed', label: 'batch' }), link('app', 'db')],
        flows: [
          { path: ['app', 'keys'], tone: 'request', label: 'give me 1,000', duration: 1 },
          { path: ['keys', 'app'], tone: 'response', label: 'batch 88,412', duration: 1, delay: 1.1 },
          { path: ['users', 'app', 'db'], tone: 'request', label: 'shorten', count: 2, duration: 1.6, delay: 2.2 },
        ],
        panel: {
          title: 'Key pool',
          icon: 'KeyRound',
          rows: [
            { text: 'Codes', value: 'random, made offline' },
            { text: 'Batch per server', value: '1,000' },
            { text: 'Handout', value: 'atomic, no repeats', tone: 'good' },
            { text: 'Keys on a crashed server', value: 'lost, harmless' },
          ],
        },
        caption: 'Random keys, made ahead of time',
      },
    },
    {
      title: 'Key pool risks',
      tag: 'tradeoff',
      heading: 'The pool is one more service that must stay up',
      eli5: 'If the helper who prints box numbers is out sick, clerks keep using the handful they already hold. That buys time, but not forever.',
      body: [
        'The price is another stateful service. App servers buffer keys, so a short outage is absorbed, and keys a crashed server held are lost, which costs nothing in a space of 3.52 trillion.',
        'Run the pool with a standby and alert when the unused table runs low.',
      ],
      keyIdea: 'A buffer in each app server turns a pool outage into a delay rather than an error.',
      metrics: { writes: '3.5K/s peak', reads: '70K/s peak', db: '70K/s', p99: '400 ms' },
      scene: {
        nodes: [users, { ...app, status: 'active', badge: '1,000 keys buffered', chips: [{ text: 'creates still work', tone: 'good' }] }, { ...keys, label: 'key pool', sub: 'random, unused', status: 'down' }, db],
        links: [link('users', 'app'), link('app', 'keys', { style: 'dashed', label: 'unreachable', labelTone: 'warn' }), link('app', 'db')],
        flows: [
          { path: ['users', 'app', 'db'], tone: 'request', label: 'shorten', count: 2, duration: 1.6 },
          { path: ['app', 'keys'], tone: 'error', label: 'refill fails', duration: 1.2, delay: 1.8 },
        ],
        panel: {
          title: 'When the pool is down',
          icon: 'Activity',
          rows: [
            { text: 'Buffered keys', value: 'keep creates running', tone: 'good' },
            { text: 'Buffer runs out', value: 'creates fail', tone: 'bad' },
            { text: 'Mitigation', value: 'standby + low alert' },
          ],
        },
        caption: 'A buffer buys time, not safety',
      },
    },
    {
      title: 'Key choice',
      tag: 'tradeoff',
      heading: 'Hash, counter, or a pool of ready keys?',
      eli5: 'Three ways to print box numbers: scramble the address, tear off a numbered roll, or grab from a pre-printed envelope. All work, and each has a different chore.',
      body: [
        'Hashing needs no coordination but pays a lookup per create and gets worse as the table fills. The counter is the simplest correct option but needs the scramble. The pool gives random codes with one more moving part.',
        'We keep the scrambled counter, and the pool is a fine answer too.',
      ],
      keyIdea: 'All three work. The question is where you pay: lookups on every create, a counter to coordinate, or a key service to run.',
      metrics: { writes: '3.5K/s peak', reads: '70K/s peak', db: '70K/s', p99: '400 ms' },
      scene: {
        nodes: [
          { id: 'hash', kind: 'block', at: at(-5, 0), label: 'hash', sub: 'lookup per create', icon: 'Hash', tint: 'red' },
          { id: 'counter', kind: 'block', at: at(0, 0), label: 'counter', sub: 'leased + scrambled', icon: 'Binary', tint: 'green', status: 'ok', badge: 'our pick' },
          { id: 'pool', kind: 'block', at: at(5, 0), label: 'key pool', sub: 'one more service', icon: 'KeyRound', tint: 'amber' },
        ],
        links: [],
        flows: [],
        panel: {
          title: 'Where you pay',
          icon: 'Scale',
          rows: [
            { text: 'Hash', value: 'DB lookup, collisions grow', tone: 'bad' },
            { text: 'Counter', value: 'coordinate ranges', tone: 'good' },
            { text: 'Key pool', value: 'run a key service', tone: 'warn' },
          ],
        },
        caption: 'Pick the chore you prefer',
      },
      quiz: {
        question: 'A hash-and-truncate shortener has used 352 billion of its 3.52 trillion 7-character codes. Roughly what share of new creates hit a collision on the first try?',
        options: ['0.01%', '1%', '10%', '50%'],
        answer: 2,
        explain: 'A truncated hash behaves like a random code, so the chance it is taken equals the fraction in use: 352B / 3.52T = 10%. A counter or a key pool never collides at all.',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Numbers, endpoints, a table, and codes that never repeat',
      eli5: 'A **URL shortener** is a post office of tiny box numbers: work out how many boxes you need, keep one card per box, and hand out numbers that never repeat.',
      body: [
        '100M links a day means 3.5K creates/s and 70K redirects/s at peak, 182 billion rows and 91 TB over five years, and 7 base 62 characters. The redirect is one lookup by code.',
        'Codes come from a leased, scrambled counter (or a key pool), never from a truncated hash that needs checks. Part 2 adds caching, sharding and abuse handling.',
      ],
      keyIdea: 'Make codes unique by construction, and keep the redirect to one lookup by code.',
      metrics: { writes: '3.5K/s peak', reads: '70K/s peak', db: '70K/s', p99: '400 ms' },
      scene: {
        nodes: [users, { ...app, status: 'ok' }, { ...keys, status: 'ok' }, { ...db, status: 'hot', load: 100 }],
        links: [link('users', 'app'), link('app', 'keys', { style: 'dashed' }), link('app', 'db', { label: '70K reads/s vs 10K', labelTone: 'warn' })],
        flows: [
          { path: ['users', 'app', 'db'], tone: 'request', label: 'aZ3kQ9x?', duration: 1.8 },
          { path: ['db', 'app', 'users'], tone: 'response', label: '302', duration: 1.8, delay: 1.9 },
          { path: ['app', 'keys'], tone: 'request', label: 'lease', duration: 1, delay: 0.5 },
        ],
        panel: {
          title: 'Settled so far',
          icon: 'List',
          rows: [
            { text: 'Code length', value: '7 chars, base 62', tone: 'good' },
            { text: 'Code source', value: 'leased, scrambled counter', tone: 'good' },
            { text: 'Redirect', value: 'one lookup by code', tone: 'good' },
            { text: 'Still open', value: 'DB at 70K reads/s', tone: 'bad' },
          ],
        },
        caption: 'The database is still the bottleneck',
      },
      quiz: {
        question: 'Why do we use 7 characters in base 62 rather than 6?',
        options: [
          '6 characters give 56.8B codes, fewer than the 182B links we store in 5 years',
          '7 characters make the URL easier to type',
          'A 6-character code cannot be written in base 62',
          '7 characters give a faster database lookup',
        ],
        answer: 0,
        explain: '62^6 is 56.8 billion, short of 182 billion. 62^7 is 3.52 trillion, about 19 times the need, which also leaves room for aliases and random codes.',
      },
    },
  ],
};
