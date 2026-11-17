import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const client: SceneNode = { id: 'client', kind: 'client', at: at(-5, 0), label: 'readers', sub: 'browsers, scripts' };
const app: SceneNode = { id: 'app', kind: 'server', at: at(-1.7, 0), label: 'paste service', sub: 'stateless app' };
const db: SceneNode = { id: 'db', kind: 'db', at: at(1.7, -3.8), label: 'metadata DB', sub: 'Postgres' };
const store: SceneNode = { id: 'store', kind: 'storage', at: at(1.7, 3.8), label: 'object store', sub: 'paste bodies' };
const cache: SceneNode = { id: 'cache', kind: 'cache', at: at(-1.7, -3.4), label: 'Redis', sub: 'hot bodies' };
const cdn: SceneNode = { id: 'cdn', kind: 'cdn', at: at(-5, -3.4), label: 'CDN edge', sub: '/raw/{code}' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

export const designPastebin: Lesson = {
  id: 'design-pastebin',
  title: 'Design Pastebin',
  tagline: 'Share a block of text through a short link: a URL shortener whose value is a blob, and the storage, cache and expiry choices that follow.',
  minutes: 17,
  level: 'Intermediate',
  learn: [
    'Turning 1M pastes a day into QPS and terabytes, and seeing it is a size problem',
    'Keeping metadata in a database and paste bodies in object storage',
    'A cache for hot pastes, a CDN for raw text, and privacy modes',
    'Expiry done cheaply: lazy checks, partition drops and lifecycle rules',
    'Abuse scanning, client-side encryption, and surviving cache and upload failures',
  ],
  metrics: [
    { key: 'writes', label: 'Creates', icon: 'Upload' },
    { key: 'reads', label: 'Reads', icon: 'Download' },
    { key: 'p99', label: 'p99 read', icon: 'Timer' },
    { key: 'stored', label: 'Stored', icon: 'HardDrive' },
    { key: 'hit', label: 'Cache hit', icon: 'Zap' },
  ],
  steps: [
    {
      title: 'Requirements',
      tag: 'problem',
      heading: 'A share link for any block of text, up to 1 MB',
      eli5: 'Our **paste service** is a library desk. You hand over a note, the librarian files it and gives you a ticket number. Anyone with the ticket can come read the note, until it is thrown away.',
      body: [
        'A user pastes text (up to **1 MB**) and gets back a short URL. Anyone with the URL reads it. Pastes expire (default 7 days, or 10 minutes, 1 hour, 1 day, 1 month, never) and can be **public**, **unlisted** or **private**. Syntax highlighting happens in the browser.',
        'Targets: **1M new pastes a day**, 5 reads per paste, p99 read under **300 ms**, kept for up to 5 years.',
      ],
      keyIdea: 'Pastebin looks like a URL shortener, but the value behind the code is a block of text, not a link.',
      metrics: { writes: '1M/day', reads: '5M/day', p99: 'goal < 300 ms', stored: '?', hit: '-' },
      scene: {
        nodes: [
          { ...client, chips: ['POST /paste', 'GET /3xYz9aQ2'] },
          { ...app, status: 'active' },
          { ...db, label: 'database', sub: 'everything' },
        ],
        links: [link('client', 'app', { label: 'HTTPS' }), link('app', 'db')],
        flows: [
          { path: ['client', 'app', 'db'], tone: 'request', label: 'paste up to 1 MB', duration: 1.8 },
          { path: ['db', 'app', 'client'], tone: 'response', label: 'short URL', duration: 1.8, delay: 1.9 },
        ],
        panel: {
          title: 'What we promise',
          icon: 'ClipboardList',
          rows: [
            { text: 'Paste size', value: 'up to 1 MB' },
            { text: 'Expiry', value: '10 min to never' },
            { text: 'Privacy', value: 'public, unlisted, private' },
            { text: 'Read latency', value: 'p99 < 300 ms' },
            { text: 'Highlighting', value: 'in the browser', tone: 'muted' },
          ],
        },
        caption: 'Hand over text, get a ticket, share the ticket',
      },
    },
    {
      title: 'Scale numbers',
      tag: 'concept',
      heading: 'The numbers say size, not speed',
      eli5: 'The library gets a million notes a day but only a few people ask at the desk each second. The desk is fine. The shelves are what fill up.',
      body: [
        '1M writes a day is about **12 per second**, 35 at peak. At 5 reads per paste, 5M reads is **58 per second**, 175 at peak. One small cluster handles that.',
        'Size is the hard part. At 10 KB average, a day is **10 GB** and a year is **3.6 TB**, Five years is 18 TB if nothing expired, but most pastes expire in days, so the live total is 10 to 15 TB. The metadata (about 500 B a row) is only 180 GB a year. Bandwidth is about 5 Mbps.',
      ],
      keyIdea: 'Pastebin has a storage problem, not a QPS problem. Design around terabytes of blobs.',
      metrics: { writes: '12/s (35 peak)', reads: '58/s (175 peak)', p99: 'goal < 300 ms', stored: '3.6 TB/yr', hit: '-' },
      metricTones: { stored: 'warn' },
      scene: {
        nodes: [
          { ...app, chips: ['12 writes/s', '58 reads/s'], status: 'active' },
          { ...db, label: 'metadata', sub: '500 B a row', badge: '180 GB/yr' },
          { ...store, status: 'hot', badge: '3.6 TB/yr' },
        ],
        links: [link('app', 'db'), link('app', 'store')],
        flows: [
          { path: ['app', 'db'], tone: 'data', label: '500 B', duration: 1.2 },
          { path: ['app', 'store'], tone: 'data', label: '10 KB', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Back of the envelope',
          icon: 'Calculator',
          rows: [
            { text: 'Writes: 1M / 86,400', value: '12/s' },
            { text: 'Reads: 5M / 86,400', value: '58/s' },
            { text: 'Bodies: 1M x 10 KB', value: '10 GB/day', tone: 'warn' },
            { text: 'Bodies, 5 years (18 TB if none expired)', value: '10 to 15 TB', tone: 'bad' },
            { text: 'Metadata: 1M x 500 B', value: '500 MB/day', tone: 'good' },
            { text: 'Bandwidth: 58 x 10 KB', value: '~5 Mbps', tone: 'good' },
          ],
        },
        caption: 'Tiny traffic, big shelves',
      },
    },
    {
      title: 'API',
      tag: 'concept',
      heading: 'One write endpoint and three ways to read',
      eli5: 'At the desk you fill in a small form to file a note. To read one you give the ticket number and say how you want it: nicely formatted, as plain paper, or as a data sheet.',
      body: [
        '`POST /api/v1/paste` takes `content`, `ttl`, `privacy` and `lang`, and answers `201` with the `code`, the URL and `expires_at`. A retry after a timeout must not make two pastes, so the client sends an idempotency key (the API design lesson).',
        '`GET /{code}` returns the HTML page, `GET /raw/{code}` returns `text/plain`, and `GET /api/v1/paste/{code}` returns JSON. `DELETE` needs auth. Unknown code is `404`, expired is `410`.',
      ],
      keyIdea: 'Writes are rare and authenticated. Reads are public, and the raw read is the simplest and most cacheable.',
      metrics: { writes: '12/s (35 peak)', reads: '58/s (175 peak)', p99: 'goal < 300 ms', stored: '-', hit: '-' },
      scene: {
        nodes: [
          { ...client, chips: ['POST /api/v1/paste'] },
          { id: 'api', kind: 'block', at: at(-1.7, 0), label: 'Paste API', sub: '4 endpoints', icon: 'Network', tint: 'violet' },
          { ...db, label: 'database', sub: 'later: split in two', status: 'dim' },
        ],
        links: [link('client', 'api', { label: 'HTTPS' }), link('api', 'db')],
        flows: [
          { path: ['client', 'api'], tone: 'request', label: 'POST + Idempotency-Key', duration: 1.4 },
          { path: ['api', 'client'], tone: 'response', label: '201 {code}', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Endpoints',
          icon: 'Code',
          code: 'POST   /api/v1/paste        create\nGET    /{code}               HTML page\nGET    /raw/{code}           text/plain\nGET    /api/v1/paste/{code}  JSON\nDELETE /api/v1/paste/{code}  auth',
          footer: { text: '404 unknown, 410 expired or removed', tone: 'muted' },
        },
        caption: 'Create once, read in three shapes',
      },
      code: {
        language: 'bash',
        title: 'Create a paste, then read it raw',
        source: `curl -X POST https://paste.example/api/v1/paste \\
     -H "Idempotency-Key: 7f3c-91ab" \\
     -d '{"content": "print(1)", "ttl": "1w",
          "privacy": "unlisted", "lang": "python"}'
# 201 {"code": "3xYz9aQ2",
#      "url": "https://paste.example/3xYz9aQ2",
#      "expires_at": "2026-11-24T10:00:00Z"}

curl https://paste.example/raw/3xYz9aQ2
# print(1)`,
        highlight: [2, 3, 4, 9],
      },
    },
    {
      title: 'Data model',
      tag: 'concept',
      heading: 'One row per paste, keyed by its code',
      eli5: 'Every note gets an index card with its ticket number, who left it, who may read it and when to throw it away. The card is small. The note itself is what can be huge.',
      body: [
        'The lookup is always by `code`, so `code` is the primary key. The row records `privacy`, `lang`, `user_id` (null for anonymous), `status`, `created_at` and `expires_at`.',
        'The first draft also puts the text in a `content` column. Hold that thought. Reads are point lookups, so the database is a good fit. The question is whether it is a good home for 1 MB values.',
      ],
      keyIdea: 'Everything we look up by is small. Only the body is big, and that difference drives the whole design.',
      metrics: { writes: '12/s (35 peak)', reads: '58/s (175 peak)', p99: '-', stored: '500 B + body per row', hit: '-' },
      scene: {
        nodes: [
          { ...app },
          { ...db, label: 'pastes table', sub: 'primary key: code', status: 'active', chips: ['code = 3xYz9aQ2'] },
        ],
        links: [link('app', 'db', { label: 'SELECT ... WHERE code = ?' })],
        flows: [
          { path: ['app', 'db'], tone: 'request', label: 'by code', duration: 1.2 },
          { path: ['db', 'app'], tone: 'response', label: 'one row', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'pastes row',
          icon: 'Table',
          rows: [
            { text: 'code', value: 'primary key' },
            { text: 'privacy, lang', value: 'small' },
            { text: 'user_id', value: 'nullable' },
            { text: 'status', value: 'ok or blocked' },
            { text: 'created_at, expires_at', value: 'timestamps' },
            { text: 'content', value: 'up to 1 MB', tone: 'warn' },
          ],
          footer: { text: 'Small fields and one big one', tone: 'warn' },
        },
        caption: 'The row is small, except for one column',
      },
      code: {
        language: 'sql',
        title: 'First draft of the table',
        source: `CREATE TABLE pastes (
  code        varchar(10)  PRIMARY KEY,
  content     text         NOT NULL,   -- up to 1 MB
  lang        varchar(20),
  privacy     text         NOT NULL,   -- public | unlisted | private
  status      text         NOT NULL DEFAULT 'ok',  -- ok | blocked
  user_id     uuid,
  created_at  timestamptz  NOT NULL DEFAULT now(),
  expires_at  timestamptz              -- null = never
);`,
        highlight: [3],
      },
    },
    {
      title: 'Version one',
      tag: 'concept',
      heading: 'The simple design: app server plus one database',
      eli5: 'One librarian files each note straight into the card drawer, card and note together. For a small library this is perfect, and nobody has to learn anything fancy.',
      body: [
        'Browser to app server to Postgres, with the body in the `content` column. A write is one `INSERT`, a read is one `SELECT`. It is correct, easy to reason about and fine for the first month.',
        'Match the design to the stated scale and extend from there. Drawing shards and queues before they are needed is the usual way to over-engineer a first answer.',
      ],
      keyIdea: 'Start with the plain design and let the numbers tell you where it breaks.',
      metrics: { writes: '12/s (35 peak)', reads: '58/s (175 peak)', p99: '40 ms', stored: '10 GB after day 1', hit: '-' },
      metricTones: { p99: 'good' },
      scene: {
        nodes: [
          { ...client },
          { ...app, status: 'active' },
          { ...db, label: 'Postgres', sub: 'body in a text column', at: at(1.7, 0), status: 'active' },
        ],
        links: [link('client', 'app'), link('app', 'db')],
        flows: [
          { path: ['client', 'app', 'db'], tone: 'request', label: 'INSERT code + body', duration: 1.8 },
          { path: ['db', 'app', 'client'], tone: 'response', label: '201', duration: 1.8, delay: 1.9 },
        ],
        panel: {
          title: 'Version one',
          icon: 'Layers',
          rows: [
            { text: 'Write', value: '1 INSERT', tone: 'good' },
            { text: 'Read', value: '1 SELECT', tone: 'good' },
            { text: 'Moving parts', value: '2', tone: 'good' },
          ],
          footer: { text: 'Fine at day one', tone: 'good' },
        },
        caption: 'Card and note in the same drawer',
      },
    },
    {
      title: 'Where it breaks',
      tag: 'case',
      heading: 'Megabyte values choke the database',
      eli5: 'Nobody files a whole encyclopedia in the tiny card drawer. The drawer jams, the librarian waits at the desk while the huge note is squeezed in, and copying the drawer takes all night.',
      body: [
        'Large values in a text column are stored out of line (TOAST in Postgres), which hurts cache locality. At 10 GB a day the database grows by **3.6 TB a year**, so backups and restores take longer every month.',
        'A 1 MB upload also keeps an app thread and a database connection busy while the bytes are written. A few of those at once starve the cheap, small reads.',
      ],
      keyIdea: 'Do not keep big blobs in your OLTP database. It grows without bound and slows everything else.',
      metrics: { writes: '12/s (35 peak)', reads: '58/s (175 peak)', p99: '250 ms and rising', stored: '3.6 TB/yr in the DB', hit: '-' },
      metricTones: { p99: 'bad', stored: 'bad' },
      scene: {
        nodes: [
          { ...client, chips: [{ text: 'POST 1 MB', tone: 'warn' }] },
          { ...app, status: 'hot', load: 78, chips: [{ text: '3 threads stuck', tone: 'bad' }] },
          { ...db, label: 'Postgres', sub: 'body in a text column', at: at(1.7, 0), status: 'hot', load: 91, badge: '3.6 TB/yr' },
        ],
        links: [link('client', 'app', { label: '1 MB per upload', labelTone: 'warn' }), link('app', 'db', { labelTone: 'bad', label: 'slow write' })],
        flows: [
          { path: ['client', 'app', 'db'], tone: 'request', label: '1 MB', count: 3, duration: 2.4 },
          { path: ['db', 'app', 'client'], tone: 'error', label: 'slow', duration: 2, delay: 2.6 },
        ],
        panel: {
          title: 'What gets worse',
          icon: 'TriangleAlert',
          rows: [
            { text: 'Database size', value: '+3.6 TB/yr', tone: 'bad' },
            { text: 'Backup and restore', value: 'hours, then days', tone: 'bad' },
            { text: 'Page cache for small rows', value: 'diluted', tone: 'warn' },
            { text: '1 MB write holds a thread', value: 'seconds', tone: 'warn' },
          ],
        },
        caption: 'Great for rows, wrong for blobs',
      },
    },
    {
      title: 'Split the blob',
      tag: 'concept',
      heading: 'Metadata in the database, the body in object storage',
      eli5: 'The index card stays in the drawer, but the note goes to the big warehouse out back. The card just says which box and shelf the note sits on.',
      body: [
        'Replace `content` with an `object_key` and a `size_bytes`. The body goes to **object storage** (the object storage lesson) and the row keeps only the key, so every row stays around 500 B. Blobs are written once and never edited, which is what object stores do best.',
        'The database now holds 180 GB a year of small rows. The bucket takes the terabytes at a lower price per GB, with no backup chore for us. This split is the main design move for any content-hosting system.',
      ],
      keyIdea: 'Store the big thing where big things live, and keep a pointer to it in the row.',
      metrics: { writes: '12/s (35 peak)', reads: '58/s (175 peak)', p99: '-', stored: 'DB 180 GB/yr, bucket 3.6 TB/yr written', hit: '-' },
      metricTones: { stored: 'good' },
      scene: {
        nodes: [
          { ...app, at: at(-4.4, 0), status: 'active' },
          { ...db, at: at(-0.8, -3.8), status: 'ok', chips: ['500 B rows'] },
          { ...store, at: at(0.8, 3.8), status: 'active', chips: ['10 KB bodies'] },
        ],
        links: [link('app', 'db', { label: 'metadata' }), link('app', 'store', { label: 'body' })],
        flows: [
          { path: ['app', 'store'], tone: 'data', label: 'PUT body', duration: 1.6 },
          { path: ['app', 'db'], tone: 'request', label: 'INSERT code + key', duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'After the split',
          icon: 'Split',
          rows: [
            { text: 'Database row', value: '~500 B', tone: 'good' },
            { text: 'Database growth', value: '180 GB/yr', tone: 'good' },
            { text: 'Bucket writes', value: '3.6 TB/yr', tone: 'default' },
            { text: 'Pointer', value: 'object_key', tone: 'muted' },
          ],
        },
        caption: 'The card stays here, the note goes to the warehouse',
      },
    },
    {
      title: 'Write path',
      tag: 'concept',
      heading: 'Make a code, upload the body, then insert the row',
      eli5: 'The librarian picks a ticket number nobody has used, carries the note to the warehouse first, and only then writes the card. A card always points at a note that is really there.',
      body: [
        'The code is 8 random base 62 characters (the unique IDs lesson): 218 trillion values, enough for 1.8B pastes, and unguessable, which unlisted pastes need. The primary key on `code` catches a rare collision and we retry. Partitioning later keeps that guarantee (see Drop partitions).',
        'Order matters: upload the body, then insert the row. A crash between the two leaves an orphan blob (harmless, cleaned later), never a row pointing at nothing.',
      ],
      keyIdea: 'Write the blob first and the row second, so a visible row always has a body behind it.',
      metrics: { writes: '12/s (35 peak)', reads: '58/s (175 peak)', p99: '-', stored: 'DB 180 GB/yr, bucket 3.6 TB/yr written', hit: '-' },
      scene: {
        nodes: [
          { ...app, at: at(-4.4, 0), status: 'active' },
          { ...db, at: at(-0.8, -3.8), chips: ['2: INSERT row'] },
          { ...store, at: at(0.8, 3.8), chips: ['1: PUT body'] },
        ],
        links: [link('app', 'store', { label: '1' }), link('app', 'db', { label: '2' })],
        flows: [
          { path: ['app', 'store', 'app'], tone: 'data', label: '1: PUT body', duration: 1.8 },
          { path: ['app', 'db', 'app'], tone: 'request', label: '2: INSERT row', duration: 1.8, delay: 1.9 },
        ],
        panel: {
          title: 'Why this order',
          icon: 'ListOrdered',
          rows: [
            { text: 'Crash after the upload', value: 'orphan blob', tone: 'warn' },
            { text: 'Crash after the insert', value: 'impossible', tone: 'muted' },
            { text: 'Collision on code', value: 'retry', tone: 'good' },
          ],
          footer: { text: 'Orphans cost money, dangling rows cost trust', tone: 'muted' },
        },
        caption: 'Blob first, row second',
      },
      code: {
        language: 'python',
        title: 'Create a paste',
        source: `def create_paste(content, ttl, privacy, lang, user_id):
    if len(content) > 1_000_000:
        raise TooLarge()
    for _ in range(3):
        code = random_base62(8)
        key = f"pastes/{ttl}/{today()}/{code}"
        store.put(key, gzip(content))          # body first
        try:
            db.insert(code, key, len(content), lang,
                      privacy, user_id, expiry_for(ttl))
            return code
        except UniqueViolation:
            store.delete(key)                  # new code, retry
    raise Unavailable()`,
        highlight: [5, 7, 8, 9, 12],
      },
      quiz: {
        question: 'Why does the paste service upload the body before it inserts the metadata row?',
        options: [
          'Object storage is faster than the database',
          'A crash in between can only leave a harmless orphan blob, never a row that points at a missing body',
          'The database cannot store the object key until the upload finishes',
          'It lets the code be generated after the write',
        ],
        answer: 1,
        explain: 'Readers find pastes through the row. If the row came first, a crash would leave a link that returns an error forever. An orphan blob is invisible and can be swept up later.',
      },
    },
    {
      title: 'Idempotent create',
      tag: 'concept',
      heading: 'A retry with the same key returns the same code',
      eli5: 'You hand the librarian a note with a **receipt number** you wrote yourself. If you come back with the same receipt number, she gives you the same ticket instead of filing a second copy.',
      body: [
        'The client sends an `Idempotency-Key` (the API design lesson). The service reserves it in Redis with `SET NX` for 24 hours, and the value is the `code`. A repeat finds that code and reuses it instead of making a new one.',
        'Then it checks for a row with that code. If one exists, it returns the same `201` answer at once. If not, the first try died half way, so it carries on. The blob key is built from the code, so a second upload overwrites the first.',
      ],
      keyIdea: 'Store the key with its code before writing, and a retry can only ever resume the same paste.',
      metrics: { writes: '12/s (35 peak)', reads: '58/s (175 peak)', p99: '-', stored: '-', hit: '-' },
      scene: {
        nodes: [
          { ...client, at: at(-7, 0), chips: [{ text: 'retry, same key', tone: 'warn' }] },
          { ...app, at: at(-3.6, 0), status: 'active' },
          { ...cache, at: at(-0.8, -3.4), sub: 'idem:{key} = code', status: 'ok' },
          { ...db, at: at(2.4, -3.8), chips: ['row exists?'] },
        ],
        links: [link('client', 'app', { label: 'Idempotency-Key' }), link('app', 'cache'), link('app', 'db')],
        flows: [
          { path: ['client', 'app', 'cache', 'app'], tone: 'request', label: 'key seen: code', duration: 1.8 },
          { path: ['app', 'db', 'app'], tone: 'request', label: 'row exists?', duration: 1.4, delay: 1.9 },
          { path: ['app', 'client'], tone: 'response', label: 'same 201 {code}', duration: 1.2, delay: 3.4 },
        ],
        panel: {
          title: 'Retry rules',
          icon: 'Repeat',
          rows: [
            { text: 'First request', value: 'new code, key reserved' },
            { text: 'Repeat, row exists', value: 'same 201 and code', tone: 'good' },
            { text: 'Repeat, no row yet', value: 'resume with that code', tone: 'good' },
            { text: 'Key scope and life', value: 'per caller, 24 h', tone: 'muted' },
          ],
          footer: { text: 'A retry never mints a second code', tone: 'good' },
        },
        caption: 'Same receipt number, same ticket',
      },
      code: {
        language: 'python',
        title: 'Reserve the key before writing',
        source: `def create_paste(idem_key, content, ttl, privacy, lang, user_id):
    fresh = random_base62(8)
    prior = redis.set(f"idem:{idem_key}", fresh,
                      nx=True, ex=86400, get=True)
    code = prior or fresh               # a repeat reuses its code
    if db.exists(code):
        return code                     # already created
    return write_blob_then_row(code, content, ttl,
                               privacy, lang, user_id)`,
        highlight: [3, 5, 6, 7],
      },
    },
    {
      title: 'Read path',
      tag: 'case',
      heading: 'Every read costs two network hops',
      eli5: 'To read a note, the librarian first checks the index card, then walks to the warehouse to fetch it. When 1,000 people want the same popular note, that walk happens 1,000 times.',
      body: [
        'A read does a metadata lookup (a few ms), then an object store fetch (tens of ms to first byte), then returns the text. Two hops fit the 300 ms goal, but the cost is paid again and again for the same paste.',
        'One hot paste linked from a forum gets 1,000 reads and so 1,000 object store GETs, each billed and each a little slower than memory. Nothing remembers a paste between requests.',
      ],
      keyIdea: 'Pastes are immutable and a few are read very often, which is the ideal case for a cache.',
      metrics: { writes: '12/s (35 peak)', reads: '58/s (175 peak)', p99: '120 ms', stored: '-', hit: '0%' },
      metricTones: { hit: 'bad' },
      scene: {
        nodes: [
          { ...client, at: at(-4.4, 0), chips: ['GET /3xYz9aQ2'] },
          { ...app, at: at(-1.2, 0), status: 'active' },
          { ...db, at: at(2, -3.8), chips: ['hop 1: ~5 ms'] },
          { ...store, at: at(2, 3.8), status: 'hot', chips: [{ text: 'hop 2: ~40 ms', tone: 'warn' }, { text: '1,000 GETs, same paste', tone: 'bad' }] },
        ],
        links: [link('client', 'app'), link('app', 'db'), link('app', 'store')],
        flows: [
          { path: ['client', 'app', 'db', 'app'], tone: 'request', label: 'lookup', duration: 1.8 },
          { path: ['app', 'store', 'app', 'client'], tone: 'request', label: 'fetch body', duration: 2.2, delay: 1.9 },
        ],
        panel: {
          title: 'One read, one paste',
          icon: 'Timer',
          rows: [
            { text: 'Metadata lookup', value: '~5 ms' },
            { text: 'Object store first byte', value: '~40 ms', tone: 'warn' },
            { text: 'Total p99 (illustrative)', value: '~120 ms' },
            { text: 'Repeat reads cached', value: 'none', tone: 'bad' },
          ],
        },
        caption: 'The same walk to the warehouse, again and again',
      },
    },
    {
      title: 'Cache bodies',
      tag: 'concept',
      heading: 'Keep hot paste bodies in Redis',
      eli5: 'The librarian keeps a small cart by the desk with the notes people keep asking for. Most requests are answered from the cart without a trip to the warehouse.',
      body: [
        'Read the row first, a ~5 ms point lookup, and run the privacy, expiry and blocked checks. Only then look in Redis by `code` for the body (the caching lesson). On a miss, fetch the blob and fill the cache. A paste never changes, so there is no invalidation problem, only a TTL (1 hour).',
        'Skip pastes over about **200 KB**. A cold megabyte paste would push out hundreds of hot small ones, so those bodies always come from the object store.',
      ],
      keyIdea: 'Check the row first, then cache only the body, so a cache hit can never skip a privacy, expiry or blocked check.',
      metrics: { writes: '12/s (35 peak)', reads: '58/s (175 peak)', p99: '~120 ms', stored: '-', hit: '80%' },
      metricTones: { p99: 'good', hit: 'good' },
      scene: {
        nodes: [
          { ...app, at: at(-4.4, 0), status: 'active' },
          { ...cache, at: at(-1.2, -3.2), status: 'ok', badge: 'hit 80%', chips: [{ text: 'TTL 1 h', tone: 'good' }] },
          { ...db, at: at(2, -3.8), status: 'active', chips: ['row + checks first'] },
          { ...store, at: at(2, 3.8), status: 'dim' },
        ],
        links: [link('app', 'cache'), link('app', 'db'), link('app', 'store', { style: 'faint' })],
        flows: [
          { path: ['app', 'db', 'app'], tone: 'request', label: 'row + checks', duration: 1.4 },
          { path: ['app', 'cache', 'app'], tone: 'request', label: 'GET body', duration: 1.4, delay: 1.5 },
          { path: ['app', 'store', 'app'], tone: 'request', label: 'miss: fetch body', duration: 2, delay: 3.1 },
          { path: ['app', 'cache'], tone: 'data', label: 'fill', duration: 1.2, delay: 5.2 },
        ],
        panel: {
          title: 'Cache rules',
          icon: 'Zap',
          rows: [
            { text: 'Order', value: 'row, checks, then body', tone: 'good' },
            { text: 'Key', value: 'paste:{code}' },
            { text: 'TTL', value: '1 hour' },
            { text: 'Size cap', value: '200 KB', tone: 'warn' },
            { text: 'Hit versus miss', value: '~15 ms vs ~120 ms' },
          ],
          footer: { text: 'Hit rate of 80% is an assumption to measure', tone: 'muted' },
        },
        caption: 'Most repeat reads end at the cart',
      },
      code: {
        language: 'python',
        title: 'Read through the cache',
        source: `def get_paste(code):
    row = db.get(code)                    # ~5 ms, raises 404 / 410
    check_access(row, user)               # blocked, privacy, expiry
    body = redis.get(f"paste:{code}")
    if body: return body
    body = gunzip(store.get(row.object_key))
    if row.size_bytes <= 200_000:
        redis.setex(f"paste:{code}", ttl_for(row), body)
    return body`,
        highlight: [2, 3, 4, 8],
      },
    },
    {
      title: 'Privacy modes',
      tag: 'concept',
      heading: 'Public, unlisted and private differ in who can find the code',
      eli5: 'Some notes sit on the open shelf, some only get found by people holding the ticket, and some are locked in a drawer that needs your library card. The ticket alone is not enough for the last kind.',
      body: [
        '**Public** pastes can be listed and indexed. **Unlisted** pastes work for anyone with the URL, and the random 8 character code is the secret, so we never list them or let search engines index them. **Private** pastes need a login and a check that `user_id` matches.',
        'Privacy is read from the row on every request. A private body must never sit in a shared cache or on a CDN without that check, so the row and auth check run first and Redis only supplies the body after them.',
      ],
      keyIdea: 'Unlisted means a secret link. Private means an identity check on every read.',
      metrics: { writes: '12/s (35 peak)', reads: '58/s (175 peak)', p99: '~120 ms', stored: '-', hit: '80%' },
      scene: {
        nodes: [
          { ...client, at: at(-4.4, 0), chips: ['GET /3xYz9aQ2'] },
          { ...app, at: at(-1.2, 0), status: 'active', chips: [{ text: 'check privacy', tone: 'warn' }] },
          { ...db, at: at(2, -3.8), chips: ['privacy = private', 'user_id = 42'] },
        ],
        links: [link('client', 'app', { label: 'session cookie' }), link('app', 'db')],
        flows: [
          { path: ['client', 'app', 'db', 'app'], tone: 'request', label: 'row + owner?', duration: 2 },
          { path: ['app', 'client'], tone: 'response', label: '200 or 403', duration: 1.2, delay: 2.1 },
        ],
        panel: {
          title: 'Three modes',
          icon: 'Lock',
          rows: [
            { text: 'public', value: 'listed, indexed', tone: 'good' },
            { text: 'unlisted', value: 'anyone with the code' },
            { text: 'private', value: 'owner login only', tone: 'warn' },
          ],
          footer: { text: 'Unlisted safety rests on unguessable codes', tone: 'muted' },
        },
        caption: 'Same storage, different gate at the door',
      },
    },
    {
      title: 'Expiry on read',
      tag: 'concept',
      heading: 'An expired paste is gone the moment you check',
      eli5: 'Every note has a throw-away date on its card. When someone asks for it, the librarian looks at the date first. If it has passed, the answer is "gone", even if the night cleaner has not come yet.',
      body: [
        'The TTL choices are fixed: 10 minutes, 1 hour, 1 day, 1 week (the default), 1 month, never. The app turns the choice into `expires_at`. A read compares it to the clock and answers `410 Gone` when it has passed.',
        'This makes expiry exact without any background job. The row is checked before Redis, so a cached body is never served late. Still set the Redis TTL to the smaller of 1 hour and the time left, so memory frees on time.',
      ],
      keyIdea: 'Check the date on every read. Deleting the bytes can happen later and does not affect what readers see.',
      metrics: { writes: '12/s (35 peak)', reads: '58/s (175 peak)', p99: '~120 ms', stored: '-', hit: '80%' },
      scene: {
        nodes: [
          { ...client, at: at(-4.4, 0), chips: ['GET /oldPaste'] },
          { ...app, at: at(-1.2, 0), status: 'active' },
          { ...db, at: at(2, -3.8), chips: [{ text: 'expires_at < now()', tone: 'bad' }] },
        ],
        links: [link('client', 'app'), link('app', 'db')],
        flows: [
          { path: ['client', 'app', 'db', 'app'], tone: 'request', label: 'lookup', duration: 1.8 },
          { path: ['app', 'client'], tone: 'error', label: '410 Gone', duration: 1.2, delay: 1.9 },
        ],
        panel: {
          title: 'Expiry rules',
          icon: 'Hourglass',
          code: 'ttl choices: 10m 1h 1d 1w 1M never\nexpires_at = created_at + ttl\nread: now() > expires_at -> 410\ncache TTL = min(1h, expires_at - now())',
        },
        caption: 'The date on the card decides',
      },
    },
    {
      title: 'Cleanup cost',
      tag: 'case',
      heading: 'Deleting a million rows a night hurts',
      eli5: 'The night cleaner reads every card in the whole drawer to find the old ones, then pulls them out one by one. With a million new cards a day, the cleaner never finishes before morning.',
      body: [
        'Readers no longer see expired pastes, but their bytes still cost money. The obvious fix is a nightly cron: find rows with `expires_at < now()` and delete them, plus their blobs.',
        'At 1M expiries a day that is a million single-row deletes. Each leaves dead tuples behind for vacuum, and the object deletes add a million API calls. The sweeper competes with live traffic and slowly falls behind.',
      ],
      keyIdea: 'Row-by-row deletion at this volume is a workload of its own, so make expiry cheap by design.',
      metrics: { writes: '12/s (35 peak)', reads: '58/s (175 peak)', p99: '~160 ms at 2 am', stored: 'growing', hit: '80%' },
      metricTones: { p99: 'warn', stored: 'warn' },
      scene: {
        nodes: [
          { id: 'sweeper', kind: 'worker', at: at(-4.4, 0), label: 'nightly sweeper', sub: 'cron job', status: 'hot', chips: [{ text: 'DELETE 1M rows', tone: 'bad' }] },
          { ...db, at: at(-0.8, -3.8), status: 'hot', load: 88, badge: 'dead tuples' },
          { ...store, at: at(0.8, 3.8), chips: [{ text: '1M delete calls', tone: 'warn' }] },
        ],
        links: [link('sweeper', 'db'), link('sweeper', 'store')],
        flows: [
          { path: ['sweeper', 'db'], tone: 'request', label: 'DELETE ... WHERE expired', count: 3, duration: 1.6 },
          { path: ['sweeper', 'store'], tone: 'request', label: 'DELETE object', count: 3, duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'Nightly sweep',
          icon: 'Trash2',
          rows: [
            { text: 'Rows to delete', value: '~1M/day', tone: 'warn' },
            { text: 'Object delete calls', value: '~1M/day', tone: 'warn' },
            { text: 'Vacuum load', value: 'heavy', tone: 'bad' },
            { text: 'Falls behind', value: 'as volume grows', tone: 'bad' },
          ],
        },
        caption: 'The cleaner competes with the readers',
      },
    },
    {
      title: 'Drop partitions',
      tag: 'concept',
      heading: 'Partition by expiry date and drop whole weeks',
      eli5: 'Instead of one big card drawer, there is one drawer per week of throw-away dates. When a week is over, the cleaner takes the whole drawer to the bin in one go.',
      body: [
        'Range-partition `pastes` by `expiry_week`, one partition per week (the sharding lesson). A past week is removed with `DROP`, a metadata change with no per-row work. Never-expiring pastes sit in week 0, which is never dropped.',
        'The catch is lookup. Reads arrive with only a code, and Postgres cannot enforce a unique `code` across partitions. So the code ends in 2 characters that encode its expiry week. A read prunes to one partition, and the key (code, expiry_week) keeps codes unique.',
      ],
      keyIdea: 'Group data by when it dies, and deletion becomes one cheap operation instead of a million.',
      metrics: { writes: '12/s (35 peak)', reads: '58/s (175 peak)', p99: '~120 ms', stored: 'DB bounded', hit: '80%' },
      metricTones: { stored: 'good' },
      scene: {
        nodes: [
          { id: 'sweeper', kind: 'worker', at: at(-4.4, 0), label: 'weekly job', sub: 'DROP PARTITION', status: 'active' },
          { ...db, at: at(-0.8, -3.8), label: 'pastes', sub: 'partitioned by week', status: 'ok', chips: ['week 46: dropped', 'week 47', 'week 48'] },
        ],
        links: [link('sweeper', 'db', { label: 'one statement' })],
        flows: [{ path: ['sweeper', 'db'], tone: 'request', label: 'DROP week 46', duration: 1.6 }],
        panel: {
          title: 'Partitions by expires_at',
          icon: 'Boxes',
          rows: [
            { text: 'Week 46 (past)', value: 'DROP', tone: 'good' },
            { text: 'Week 47 (now)', value: 'live' },
            { text: 'Week 48', value: 'live' },
            { text: 'Lookup', value: 'week tag in the code', tone: 'good' },
            { text: 'Never expires', value: 'week 0, never dropped', tone: 'muted' },
          ],
          footer: { text: 'O(1) reclaim, no vacuum storm', tone: 'good' },
        },
        caption: 'One drawer per week, bin the old one whole',
      },
      code: {
        language: 'sql',
        title: 'Weekly partitions',
        source: `CREATE TABLE pastes (
  code        varchar(10)  NOT NULL,  -- 8 random + 2 week chars
  expiry_week smallint     NOT NULL,  -- weeks since launch, 0 = never
  object_key  varchar(200) NOT NULL,
  size_bytes  int          NOT NULL,
  lang        varchar(20),
  privacy     text         NOT NULL,
  user_id     uuid,
  status      text         NOT NULL DEFAULT 'ok',  -- ok | blocked
  created_at  timestamptz  NOT NULL DEFAULT now(),
  expires_at  timestamptz,
  PRIMARY KEY (code, expiry_week)
) PARTITION BY RANGE (expiry_week);

CREATE TABLE pastes_w47 PARTITION OF pastes
  FOR VALUES FROM (47) TO (48);

DROP TABLE pastes_w44;   -- reclaim a whole week`,
        highlight: [2, 11, 12, 17],
      },
    },
    {
      title: 'Lifecycle rules',
      tag: 'concept',
      heading: 'Let the bucket delete expired bodies by itself',
      eli5: 'The warehouse also gets a rule on each shelf: "throw out boxes after one week." The warehouse staff do it on their own, so our cleaner never walks there.',
      body: [
        'Object stores run **lifecycle rules** that delete objects a set number of days after creation, per key prefix. That works because TTLs are a short fixed list: the key is `pastes/1w/2026/11/17/{code}`, and a rule on `pastes/1w/` expires objects after 7 days.',
        'Deletion is lazy, usually within a day or so, and not to the second. That is fine, since the row check already hides the paste. "Never" pastes live under a prefix with no rule.',
      ],
      keyIdea: 'A small, fixed set of TTLs lets storage rules do the deleting, with no code of ours in the path.',
      metrics: { writes: '12/s (35 peak)', reads: '58/s (175 peak)', p99: '~120 ms', stored: 'bucket bounded', hit: '80%' },
      metricTones: { stored: 'good' },
      scene: {
        nodes: [
          { ...app, at: at(-4.4, 0), chips: ['PUT pastes/1w/...'] },
          { ...store, at: at(0.8, 3.8), status: 'ok', label: 'bucket', sub: 'lifecycle rules on' },
          { ...db, at: at(-0.8, -3.8), status: 'dim' },
        ],
        links: [link('app', 'store'), link('app', 'db', { style: 'faint' })],
        flows: [{ path: ['app', 'store'], tone: 'data', label: 'key has the ttl prefix', duration: 1.6 }],
        panel: {
          title: 'Rules by prefix',
          icon: 'CalendarClock',
          rows: [
            { text: 'pastes/10m/', value: 'expire after 1 day', tone: 'muted' },
            { text: 'pastes/1d/', value: 'expire after 1 day' },
            { text: 'pastes/1w/', value: 'expire after 7 days' },
            { text: 'pastes/1M/', value: 'expire after 30 days' },
            { text: 'pastes/never/', value: 'no rule', tone: 'warn' },
          ],
          footer: { text: 'Deletes run on the store, a day of slack is fine', tone: 'muted' },
        },
        caption: 'The warehouse empties its own shelves',
      },
      quiz: {
        question: 'Why does Pastebin allow only a short fixed list of expiry choices?',
        options: [
          'Users cannot pick dates reliably',
          'Redis can only cache six TTL values',
          'It lets partitions and bucket lifecycle rules (one per prefix) remove expired data cheaply',
          'The 410 status code needs a known set of values',
        ],
        answer: 2,
        explain: 'Weekly partitions and per-prefix lifecycle rules only work when expiry falls into a few predictable groups. Free-form dates would force row-by-row cleanup again.',
      },
    },
    {
      title: 'CDN for raw',
      tag: 'tradeoff',
      heading: 'Serve raw text from the edge',
      eli5: 'Branch libraries around the country keep photocopies of the popular notes. A reader grabs a copy from the nearest branch instead of the main warehouse across the sea.',
      body: [
        'A paste body never changes, so `GET /raw/{code}` is cacheable. A CDN edge keeps it for about 10 minutes (the CDN lesson), and readers on other continents skip the long trip to our region. Public and unlisted pastes qualify. Private ones never do.',
        'The price: a deleted or expired paste can still be served from an edge for up to 10 minutes, and a takedown needs an explicit purge. For this product that delay is an acceptable trade.',
      ],
      keyIdea: 'Immutable bodies are ideal edge content. Accept a short staleness window and keep private pastes out.',
      metrics: { writes: '12/s (35 peak)', reads: '58/s (175 peak)', p99: '40 ms far away', stored: '-', hit: '90% at the edge' },
      metricTones: { p99: 'good', hit: 'good' },
      scene: {
        nodes: [
          { ...client, at: at(-4.4, 0) },
          { ...cdn, at: at(-1.2, -3.2), status: 'ok', chips: [{ text: 'Cache-Control: 10 min', tone: 'good' }] },
          { ...app, at: at(2, 0), label: 'origin', sub: 'app + cache + store' },
        ],
        links: [link('client', 'cdn', { label: 'nearest edge' }), link('cdn', 'app', { label: 'miss only', style: 'dashed' })],
        flows: [
          { path: ['client', 'cdn', 'client'], tone: 'request', label: 'GET /raw/3xYz9aQ2', duration: 1.6 },
          { path: ['cdn', 'app'], tone: 'request', label: 'miss', duration: 1.4, delay: 1.8 },
        ],
        panel: {
          title: 'Edge policy',
          icon: 'Globe',
          rows: [
            { text: '/raw/{code} public', value: 'cache 10 min', tone: 'good' },
            { text: '/raw/{code} unlisted', value: 'cache 10 min', tone: 'good' },
            { text: 'private', value: 'never cached', tone: 'warn' },
            { text: 'Takedown', value: 'explicit purge', tone: 'warn' },
          ],
        },
        caption: 'A photocopy near the reader',
      },
    },
    {
      title: 'Async cleanup',
      tag: 'concept',
      heading: 'Deletes and takedowns go through a queue',
      eli5: 'When someone asks to destroy a note, the clerk drops a slip in a tray. A helper later pulls the card, empties the box, and tells every branch to toss its copy.',
      body: [
        'Some removals cannot wait for a lifecycle rule: a user `DELETE`, or an abuse takedown. The app marks the row and publishes `paste_removed` to a queue (the message queues lesson). A worker deletes the blob, the row, the Redis key, and sends a CDN purge.',
        'Every step is safe to repeat, so the queue can redeliver without harm. The same worker also acts as a backstop that clears blobs for the nearest-expiring partition if a lifecycle rule lags.',
      ],
      keyIdea: 'Keep slow, multi-system cleanup off the request path and make each delete idempotent.',
      metrics: { writes: '12/s (35 peak)', reads: '58/s (175 peak)', p99: '~120 ms', stored: '-', hit: '80%' },
      scene: {
        nodes: [
          { ...app, at: at(-4.4, 0), chips: ['DELETE /paste/3xYz9aQ2'] },
          { id: 'queue', kind: 'queue', at: at(-1.2, -3.2), label: 'paste_removed', sub: 'Kafka topic' },
          { id: 'worker', kind: 'worker', at: at(1.6, -1.2), label: 'cleanup worker', sub: 'idempotent', status: 'active' },
          { ...store, at: at(4.6, 1.8), status: 'dim' },
        ],
        links: [link('app', 'queue'), link('queue', 'worker'), link('worker', 'store')],
        flows: [
          { path: ['app', 'queue'], tone: 'event', label: 'paste_removed', duration: 1.4 },
          { path: ['queue', 'worker', 'store'], tone: 'event', label: 'delete blob, row, cache', duration: 2, delay: 1.5 },
        ],
        panel: {
          title: 'Worker steps',
          icon: 'ListChecks',
          rows: [
            { text: 'Delete object', value: '404 is fine' },
            { text: 'Delete row', value: 'no-op if gone' },
            { text: 'Delete Redis key', value: 'safe to repeat' },
            { text: 'Purge CDN path', value: 'safe to repeat' },
          ],
          footer: { text: 'At least once delivery is enough', tone: 'good' },
        },
        caption: 'A slip in the tray, a helper does the rest',
      },
    },
    {
      title: 'Multi-region',
      tag: 'tradeoff',
      heading: 'More regions cost more, so sell them as a tier',
      eli5: 'A second library across the sea keeps its own desk, cart and drawer. Copying every box over there costs real money, so only members who pay for it get a copy of their notes.',
      body: [
        'Each region runs its own app pool, Redis and database shards (the multi-region lesson). Read traffic goes to the nearest region, and the CDN already covers most raw reads.',
        'Copying object storage across regions doubles the bytes stored. That is worth it for an enterprise tier that needs fast reads and a copy surviving a regional outage. The free tier keeps one copy and stays cheap.',
      ],
      keyIdea: 'Replicate blobs across regions only for the users who pay for the extra durability and speed.',
      metrics: { writes: '12/s (35 peak)', reads: '58/s (175 peak)', p99: '~100 ms global', stored: '2x for enterprise', hit: '85%' },
      metricTones: { stored: 'warn' },
      scene: {
        nodes: [
          { id: 'appA', kind: 'server', at: at(-4.5, -1.8), label: 'region A', sub: 'app + Redis + DB', status: 'active' },
          { id: 'storeA', kind: 'storage', at: at(-1, 1.8), label: 'bucket A', sub: 'primary copy' },
          { id: 'storeB', kind: 'storage', at: at(2.8, -1.8), label: 'bucket B', sub: 'enterprise replica', status: 'ok' },
          { id: 'appB', kind: 'server', at: at(5.8, 1.8), label: 'region B', sub: 'app + Redis + DB' },
        ],
        links: [link('appA', 'storeA'), link('storeA', 'storeB', { label: 'replicate', style: 'dashed' }), link('storeB', 'appB')],
        flows: [
          { path: ['appA', 'storeA'], tone: 'data', label: 'PUT', duration: 1.4 },
          { path: ['storeA', 'storeB'], tone: 'data', label: 'copy (enterprise)', duration: 1.8, delay: 1.5 },
        ],
        panel: {
          title: 'Free versus enterprise',
          icon: 'Globe',
          rows: [
            { text: 'Free tier', value: '1 bucket, CDN for reads', tone: 'good' },
            { text: 'Enterprise', value: 'cross-region replication', tone: 'warn' },
            { text: 'Storage cost', value: '2x', tone: 'warn' },
          ],
        },
        caption: 'Pay for a second copy only when it earns its keep',
      },
    },
    {
      title: 'Abuse',
      tag: 'case',
      heading: 'Pastebin attracts spam, leaked secrets and malware',
      eli5: 'A guard stands at the door counting how many notes each visitor hands in. Another helper checks fresh notes against a list of known bad ones and locks away any match.',
      body: [
        'Anyone can post anonymously, so expect spam floods, leaked credentials and malware dumps. The gateway rate limits creation per IP and per account (the rate limiting lesson) and runs cheap spam filters, so most abuse never reaches the app.',
        'A scan must not slow a write. After upload, the service publishes an event with the content hash. A scanner checks it against known-bad lists and, on a match, flips the row to `blocked`. Reads then return an error and the cleanup path purges the copies.',
      ],
      keyIdea: 'Throttle at the gateway, scan after the write, and quarantine by changing one row.',
      metrics: { writes: '12/s (35 peak)', reads: '58/s (175 peak)', p99: '~120 ms', stored: '-', hit: '80%' },
      scene: {
        nodes: [
          { id: 'gateway', kind: 'limiter', at: at(-4.4, 0), label: 'gateway', sub: 'rate limit + spam', status: 'active', chips: [{ text: '20 pastes/h per IP', tone: 'warn' }] },
          { ...app, at: at(-1.2, 0) },
          { id: 'scanner', kind: 'service', at: at(2, -3.8), label: 'abuse scanner', sub: 'hash lookup', status: 'active' },
          { ...db, at: at(2, 3.8), chips: [{ text: 'status = blocked', tone: 'bad' }] },
        ],
        links: [link('gateway', 'app'), link('app', 'scanner', { label: 'event', style: 'dashed' }), link('scanner', 'db')],
        flows: [
          { path: ['gateway', 'app'], tone: 'request', label: 'allowed', duration: 1.2 },
          { path: ['app', 'scanner'], tone: 'event', label: 'content hash', duration: 1.4, delay: 1.3 },
          { path: ['scanner', 'db'], tone: 'error', label: 'quarantine', duration: 1.4, delay: 2.8 },
        ],
        panel: {
          title: 'Layers of defense',
          icon: 'ShieldAlert',
          rows: [
            { text: 'Gateway', value: 'rate limits, spam filter', tone: 'good' },
            { text: 'After upload', value: 'hash scan, async' },
            { text: 'On a match', value: 'row = blocked', tone: 'bad' },
            { text: 'Then', value: 'purge cache and CDN', tone: 'muted' },
          ],
        },
        caption: 'Guard at the door, helper checking the shelves',
      },
    },
    {
      title: 'Client-side work',
      tag: 'tradeoff',
      heading: 'Highlight in the browser, optionally encrypt there too',
      eli5: 'The librarian files the plain note and lets each reader add their own colored pens at home. For secret notes, you can lock the note in a box before handing it over and keep the key to yourself.',
      body: [
        'The server stores raw text. The browser does syntax highlighting, which keeps server CPU out of reads and cache entries small. The `lang` field is a hint, and a cheap heuristic can guess it when the user leaves it empty.',
        'For end-to-end encryption the browser encrypts the text and puts the key in the URL fragment, `paste.example/3xYz9aQ2#key`. Browsers never send the fragment to the server, so we hold only ciphertext. The cost is that our abuse scanner cannot read it.',
      ],
      keyIdea: 'Do display work on the client. If the user wants secrecy from us, the key must never reach us.',
      metrics: { writes: '12/s (35 peak)', reads: '58/s (175 peak)', p99: '~120 ms', stored: '-', hit: '80%' },
      scene: {
        nodes: [
          { ...client, label: 'browser', sub: 'encrypts + highlights', chips: [{ text: '#key stays here', tone: 'good' }] },
          { ...app, status: 'active', chips: ['sees ciphertext only'] },
          { ...store, at: at(1.7, 0), chips: ['ciphertext'] },
        ],
        links: [link('client', 'app'), link('app', 'store')],
        flows: [
          { path: ['client', 'app', 'store'], tone: 'data', label: 'encrypted body', duration: 2 },
          { path: ['store', 'app', 'client'], tone: 'response', label: 'ciphertext', duration: 2, delay: 2.1 },
        ],
        panel: {
          title: 'The link',
          icon: 'KeyRound',
          code: 'https://paste.example/3xYz9aQ2#k=Zq8...\n\nsent to server:   /3xYz9aQ2\nstays in browser: #k=Zq8...',
          footer: { text: 'Server cannot decrypt or scan', tone: 'warn' },
        },
        caption: 'The key rides in the fragment',
      },
    },
    {
      title: 'Redis down',
      tag: 'case',
      heading: 'When the cache dies, protect the database',
      eli5: 'The cart by the desk is knocked over. Everyone now asks for notes at the same moment, so the librarian lets only a few walk to the warehouse at a time and tells the rest to wait.',
      body: [
        'Redis fails or restarts empty. The row lookup was always the job of the database, so the new load lands on the bucket: all 58 reads a second (175 at peak) now fetch bodies from it. That is survivable at this scale, but a viral paste could pile on top (the thundering herd, as in the caching lesson).',
        'Fall through to the bucket, but cap that path with a rate limit and collapse concurrent misses for one code into a single fetch. Latency rises. Nothing breaks.',
      ],
      keyIdea: 'A cache is an accelerator. Losing it should cost speed, never availability.',
      metrics: { writes: '12/s (35 peak)', reads: '58/s (175 peak)', p99: '~200 ms', stored: '-', hit: '0%' },
      metricTones: { p99: 'warn', hit: 'bad' },
      scene: {
        nodes: [
          { ...app, at: at(-4.4, 0), status: 'active', chips: [{ text: 'fallthrough limit: 200/s', tone: 'warn' }] },
          { ...cache, at: at(-1.2, -3.2), status: 'down' },
          { ...db, at: at(2, -3.8), status: 'active', load: 55 },
          { ...store, at: at(2, 3.8), status: 'active' },
        ],
        links: [link('app', 'cache', { style: 'faint' }), link('app', 'db'), link('app', 'store')],
        flows: [
          { path: ['app', 'cache'], tone: 'error', label: 'timeout', duration: 1.2 },
          { path: ['app', 'db', 'app', 'store', 'app'], tone: 'request', label: 'limited fallthrough', duration: 2.4, delay: 1.3 },
        ],
        panel: {
          title: 'Survival plan',
          icon: 'LifeBuoy',
          rows: [
            { text: 'Cache timeout', value: 'short, 20 ms', tone: 'good' },
            { text: 'Fallthrough', value: 'rate limited', tone: 'good' },
            { text: 'Same code, many misses', value: 'one fetch', tone: 'good' },
            { text: 'Latency', value: 'up, still < 300 ms', tone: 'warn' },
          ],
        },
        caption: 'Slower, not down',
      },
    },
    {
      title: 'Half writes',
      tag: 'case',
      heading: 'A crash between upload and insert leaves an orphan',
      eli5: 'The librarian carries a note to the warehouse, then faints before writing the card. The box has no card and nobody can find it. A weekly check finds boxes with no card and clears them.',
      body: [
        'Blob first, row second means a crash between the two leaves an **orphan** blob with no row. Readers never see it, but it still costs money. A reconcile job lists objects older than a day and deletes those with no matching row.',
        'If the object store is unavailable, the write fails with `503`. The client retries with the same idempotency key, so a retry that got through before does not create a second paste.',
      ],
      keyIdea: 'Order the writes so the failure is invisible to readers, then sweep the leftovers.',
      metrics: { writes: '12/s (35 peak)', reads: '58/s (175 peak)', p99: '~120 ms', stored: 'orphans < 0.01%', hit: '80%' },
      metricTones: { stored: 'good' },
      scene: {
        nodes: [
          { ...app, at: at(-4.4, 0), status: 'down', badge: 'crash after PUT' },
          { ...store, at: at(0.8, 3.8), chips: [{ text: 'orphan blob', tone: 'warn' }] },
          { ...db, at: at(-0.8, -3.8), chips: [{ text: 'no row', tone: 'bad' }] },
          { id: 'reconciler', kind: 'worker', at: at(4, 0), label: 'reconcile job', sub: 'daily', status: 'active' },
        ],
        links: [link('app', 'store'), link('reconciler', 'store'), link('reconciler', 'db')],
        flows: [
          { path: ['reconciler', 'db'], tone: 'request', label: 'key has a row?', duration: 1.4 },
          { path: ['reconciler', 'store'], tone: 'request', label: 'DELETE orphan', duration: 1.6, delay: 1.5 },
        ],
        panel: {
          title: 'Reconcile',
          icon: 'ScanSearch',
          rows: [
            { text: 'List objects older than 1 day', value: 'step 1' },
            { text: 'Look up each key in the DB', value: 'step 2' },
            { text: 'No row found', value: 'delete', tone: 'warn' },
            { text: 'Client retry', value: 'same Idempotency-Key', tone: 'good' },
          ],
        },
        caption: 'Invisible to readers, cleaned up later',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Pastebin is a URL shortener with a blob behind each code',
      eli5: 'A library with index cards in a small drawer, notes in a big warehouse, a cart by the desk, branch copies, a guard at the door and a self-cleaning shelf. Each part fixes one problem.',
      body: [
        'Requirements gave 12 writes and 58 reads a second but 3.6 TB a year of bodies written, so the design splits metadata (Postgres, partitioned by expiry) from bodies (object storage with lifecycle rules). Redis caches hot bodies, a CDN serves raw text.',
        'Failures are handled with lazy expiry checks, a queue for deletes, an abuse scanner, a limited fallthrough when Redis dies, and a reconcile job for orphans.',
      ],
      keyIdea: 'Put each kind of data where it belongs, and make expiry, caching and failure each one cheap decision.',
      metrics: { writes: '12/s (35 peak)', reads: '58/s (175 peak)', p99: '< 300 ms', stored: 'DB 180 GB/yr, bucket 3.6 TB/yr written', hit: '80%' },
      metricTones: { p99: 'good', hit: 'good', stored: 'good' },
      scene: {
        nodes: [
          { ...cdn, at: at(-4.8, 0), status: 'ok' },
          { ...app, at: at(-1.6, 0), status: 'active' },
          { ...cache, at: at(-3.2, 5.4), status: 'ok' },
          { ...db, at: at(2.2, -3.8), status: 'ok', sub: 'weekly partitions' },
          { ...store, at: at(1.6, 3.8), status: 'ok', sub: 'lifecycle rules' },
        ],
        links: [link('cdn', 'app'), link('app', 'cache'), link('app', 'db'), link('app', 'store')],
        flows: [
          { path: ['cdn', 'app', 'cache', 'app'], tone: 'request', label: 'raw read', duration: 2 },
          { path: ['app', 'db', 'app', 'store', 'app'], tone: 'request', label: 'on a miss', duration: 2.6, delay: 2.1 },
        ],
        panel: {
          title: 'The finished design',
          icon: 'CheckCircle',
          rows: [
            { text: 'Metadata', value: 'Postgres, by expiry week', tone: 'good' },
            { text: 'Bodies', value: 'object store + lifecycle', tone: 'good' },
            { text: 'Hot reads', value: 'Redis + CDN', tone: 'good' },
            { text: 'Removals', value: 'queue + worker', tone: 'good' },
            { text: 'Abuse', value: 'gateway + async scan', tone: 'good' },
          ],
        },
        caption: 'Every part answers one problem',
      },
      quiz: {
        question: 'What is the defining design move for Pastebin compared with a URL shortener?',
        options: [
          'Sharding the database by code',
          'Using a counter instead of random codes',
          'Keeping bodies in object storage and only a key in the database row',
          'Replacing the cache with a CDN',
        ],
        answer: 2,
        explain: 'The workload is about size. Moving up to 1 MB bodies out of the database keeps rows small, backups quick and storage cheap, and every later choice builds on that.',
      },
    },
  ],
};
