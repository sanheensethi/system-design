import type { Lesson, SceneNode } from '../engine/types';

// Layout. Upload pipeline runs along the top diagonal (x + y = -4 to 1), metadata and feed along the bottom.
const phone: SceneNode = { id: 'phone', kind: 'phone', at: [-5, 1], label: 'poster', sub: '4 MB photo' };
const raw: SceneNode = { id: 'raw', kind: 'storage', at: [-3.5, -0.5], label: 'raw bucket', sub: 'originals' };
const queue: SceneNode = { id: 'queue', kind: 'queue', at: [-2, -2], label: 'queue', sub: 'uploads' };
const workers: SceneNode = { id: 'workers', kind: 'worker', at: [-0.5, -3.5], label: 'image workers', sub: 'autoscaled' };
const rend: SceneNode = { id: 'rend', kind: 'storage', at: [2.5, -6.5], label: 'renditions', sub: '4 sizes' };
const api: SceneNode = { id: 'api', kind: 'service', at: [-1, 5], label: 'API servers', sub: 'stateless' };
const db: SceneNode = { id: 'db', kind: 'db', at: [0.5, 2.5], label: 'metadata store', sub: 'Cassandra' };
const feedCache: SceneNode = { id: 'feedCache', kind: 'cache', at: [2.5, 0.5], label: 'feed cache', sub: 'Redis zsets' };
const cdn: SceneNode = { id: 'cdn', kind: 'cdn', at: [4, -1.5], label: 'CDN edge', sub: '98% hit' };
const viewer: SceneNode = { id: 'viewer', kind: 'phone', at: [6, -3.5], label: 'follower', sub: 'on 3G' };
const mono: SceneNode = { id: 'mono', kind: 'server', at: [-0.125, -0.625], label: 'one server', sub: 'photos in MySQL' };

const uploadLinks = [
  { from: 'phone', to: 'raw' },
  { from: 'raw', to: 'queue' },
  { from: 'queue', to: 'workers' },
  { from: 'workers', to: 'rend' },
];

export const designInstagram: Lesson = {
  id: 'design-instagram',
  title: 'Design Instagram',
  tagline: 'Take a 4 MB phone photo, turn it into four sizes, and show it to a billion people a day without melting the origin.',
  minutes: 22,
  level: 'Advanced',
  learn: [
    'Scale numbers, the API and the data model for photo sharing',
    'Direct-to-storage uploads with pre-signed URLs',
    'An async image pipeline that makes renditions and runs safety checks',
    'Why the CDN carries 98% of the traffic',
    'Feed fan-out, the celebrity problem and follow backfill',
    'Likes, comments, storage tiering, failures and deletion',
  ],
  metrics: [
    { key: 'uploads', label: 'Uploads' },
    { key: 'reads', label: 'Feed reads' },
    { key: 'egress', label: 'Egress' },
    { key: 'storage', label: 'New storage' },
    { key: 'p99', label: 'Feed p99' },
  ],
  steps: [
    {
      title: 'Requirements',
      tag: 'problem',
      heading: 'Photos in, a feed out',
      eli5: 'A school has an art wall. Kids hand in drawings, and every other kid wants to see their friends’ drawings on the wall. The **photo app** is that school wall for a billion kids.',
      body: [
        'Scope: a user **uploads** a photo (or a carousel of up to 10), sees a **home feed** of accounts they follow, opens a **profile grid**, and can like, comment and save. Every photo must come in several sizes for different screens.',
        'Targets: **1 billion daily users**, **100 million uploads a day**, **20 billion feed reads a day**, feed p99 under **400 ms**. A phone photo is 4 MB going in, and we keep it plus about 1.25 MB of renditions. Video, stories and search are out of scope.',
      ],
      keyIdea: 'Photo sharing is a modest write path that moves big files and a giant read path that moves images to the whole planet.',
      metrics: { uploads: '100M/day', reads: '20B/day', egress: '?', storage: '?', p99: 'target < 400 ms' },
      metricTones: { reads: 'warn' },
      scene: {
        nodes: [
          { ...phone, status: 'active' },
          { ...mono, kind: 'internet', label: 'photo app', sub: 'to be designed', badge: '?' },
          { ...viewer, badge: '20B reads/day' },
        ],
        links: [
          { from: 'phone', to: 'mono' },
          { from: 'mono', to: 'viewer' },
        ],
        flows: [
          { path: ['phone', 'mono'], tone: 'request', label: '4 MB', duration: 2.2 },
          { path: ['mono', 'viewer'], tone: 'response', count: 4, duration: 1.2, delay: 0.8 },
        ],
        caption: '100M photos in, 20B feed reads out, every day',
      },
    },
    {
      title: 'Napkin math',
      tag: 'concept',
      heading: 'Where the bytes land',
      eli5: 'Count how many drawings arrive each minute and how many kids walk past the wall. The **numbers** tell you the wall needs far more space for looking than for handing in.',
      body: [
        'Uploads: 100M / 86,400 is about **1,200 per second**, peak near 5,000. Inbound is about 4.8 GB/s, near 40 Gbps. Stored: 1.25 MB of renditions plus the 4 MB original is about 5.3 MB per photo, so 530 TB a day and **190 PB a year**, about 150 PB of it originals.',
        'Reads: 20B / 86,400 is about **230,000 per second**. Assume about 5 thumbnails of 40 KB per feed open, so 200 KB per read: 46 GB/s, about **370 Gbps**. No origin survives that, so 98% of image bytes must come from the CDN.',
      ],
      keyIdea: 'Reads outnumber writes about 200 to 1, and 370 Gbps of egress forces the CDN into the design from day one.',
      metrics: { uploads: '1,200/s', reads: '230k/s', egress: '370 Gbps', storage: '190 PB/yr', p99: 'target < 400 ms' },
      metricTones: { egress: 'bad', reads: 'warn' },
      scene: {
        nodes: [{ ...phone, badge: '1,200/s' }, { ...mono, kind: 'internet', label: 'photo app', sub: 'to be designed' }, { ...viewer, badge: '230k/s' }],
        links: [{ from: 'phone', to: 'mono' }, { from: 'mono', to: 'viewer' }],
        flows: [
          { path: ['phone', 'mono'], tone: 'request', label: '40 Gbps in', duration: 2 },
          { path: ['mono', 'viewer'], tone: 'response', count: 5, label: '370 Gbps out', duration: 1, delay: 0.6 },
        ],
        panel: {
          title: 'Napkin math',
          icon: 'calculator',
          rows: [
            { text: 'Uploads', value: '1,200/s avg, 5,000 peak' },
            { text: 'Ingress', value: '4.8 GB/s (40 Gbps)' },
            { text: 'Stored per photo', value: '1.25 MB + 4 MB original' },
            { text: 'Stored per year', value: '~190 PB (originals ~150)' },
            { text: 'Feed reads', value: '230,000/s' },
            { text: 'Egress at 5 x 40 KB per open', value: '46 GB/s (370 Gbps)', tone: 'bad' },
          ],
          footer: { text: '98% of this must come from the CDN', tone: 'warn' },
        },
      },
    },
    {
      title: 'API',
      tag: 'concept',
      heading: 'Six endpoints, no image bytes',
      eli5: 'The front desk of the school takes small notes, like "put this drawing up" or "show me the wall". The **API** handles notes, and the drawings go in through a different door.',
      body: [
        'Uploading takes two calls: `POST /v1/photos/upload-url` returns a signed URL for the bytes, then `POST /v1/photos` creates the post with caption and photo ids. Reading uses `GET /v1/feed?cursor=` and `GET /v1/users/{id}/photos?cursor=`. Likes and comments are `POST` calls on a photo.',
        'Both list endpoints use a **cursor** (the last seen photo id), never an offset. New posts keep arriving, and offsets would shift pages under the reader. The API moves JSON only. Image bytes use their own road.',
      ],
      keyIdea: 'Keep the API to small JSON calls and page every list with a cursor so a moving feed never skips or repeats.',
      metrics: { uploads: '1,200/s', reads: '230k/s', egress: '370 Gbps', storage: '190 PB/yr', p99: 'target < 400 ms' },
      scene: {
        nodes: [phone, { ...api, status: 'active', chips: ['POST /photos', 'GET /feed?cursor='] }, { ...db, status: 'active' }, viewer],
        links: [{ from: 'phone', to: 'api' }, { from: 'api', to: 'db' }, { from: 'viewer', to: 'api', style: 'dashed' }],
        flows: [
          { path: ['phone', 'api'], tone: 'request', label: 'POST /photos', duration: 1.2 },
          { path: ['api', 'db'], tone: 'request', label: 'INSERT', duration: 0.9, delay: 1.3 },
          { path: ['viewer', 'api'], tone: 'request', label: 'GET /feed', duration: 1.3, delay: 2.4 },
        ],
        panel: {
          title: 'Endpoints',
          icon: 'plug',
          rows: [
            { text: 'POST /v1/photos/upload-url', value: 'signed PUT' },
            { text: 'POST /v1/photos', value: 'create post' },
            { text: 'GET /v1/feed', value: 'cursor, 20' },
            { text: 'GET /v1/users/{id}/photos', value: 'cursor' },
            { text: 'POST /v1/photos/{id}/like', value: 'like' },
            { text: 'POST /v1/photos/{id}/comments', value: 'comment' },
          ],
        },
      },
    },
    {
      title: 'Data model',
      tag: 'concept',
      heading: 'Metadata in a store, bytes in a bucket',
      eli5: 'The school keeps a list of who drew what, and the drawings sit in a big cupboard. The list is the **metadata store**, and each line holds a cupboard shelf number.',
      body: [
        'Metadata is small and keyed: `photos`, `renditions`, `likes` and `comments` are sharded by photo id, `follow_graph` is sharded SQL, and `feeds` is a Redis sorted set per user backed by Cassandra. Photo ids are **time-ordered 64-bit ids** (timestamp, shard, sequence), so they sort by time.',
        'Blobs are huge and never edited, so they live in object storage. The row holds only the key, with a hash prefix so writes spread over many partitions.',
      ],
      keyIdea: 'Small structured rows go in a sharded store, immutable image bytes go in object storage, and the row holds the key.',
      metrics: { uploads: '1,200/s', reads: '230k/s', egress: '370 Gbps', storage: '190 PB/yr', p99: 'target < 400 ms' },
      scene: {
        nodes: [{ ...api, status: 'active' }, { ...db, status: 'active', badge: 'rows only' }, { ...rend, label: 'object store', sub: 'blobs by key' }],
        links: [{ from: 'api', to: 'db' }, { from: 'db', to: 'rend', style: 'dashed', label: 's3_key' }],
        flows: [{ path: ['api', 'db'], tone: 'request', label: 'photo row', duration: 1.2 }],
        panel: {
          title: 'Tables',
          icon: 'table',
          rows: [
            { text: 'photos', value: 'by photo_id' },
            { text: 'renditions', value: 'photo_id, size, key' },
            { text: 'likes, comments', value: 'by photo_id' },
            { text: 'feeds', value: 'Redis zset per user' },
            { text: 'follow_graph', value: 'sharded SQL' },
            { text: 'photo_id', value: '64-bit: time + shard + seq' },
          ],
          footer: { text: 'Blobs: key = hash prefix + photo_id', tone: 'muted' },
        },
      },
      code: {
        language: 'sql',
        title: 'Core tables (Cassandra-style CQL)',
        source: `CREATE TABLE photos (
  photo_id   bigint PRIMARY KEY,   -- 64-bit: timestamp + shard + sequence
  user_id    bigint,
  caption    text,
  status     text,                 -- uploaded | processed | blocked | deleted
  created_at timestamp
);

CREATE TABLE renditions (
  photo_id bigint, size int,       -- 320, 640, 1080, 0 = original
  s3_key   text, bytes int,
  PRIMARY KEY (photo_id, size)
);`,
        highlight: [5, 12],
      },
    },
    {
      title: 'Naive design',
      tag: 'problem',
      heading: 'v1: photos in the database',
      eli5: 'Imagine gluing every drawing into the school’s order book. The book gets heavy, slow to carry and impossible to copy. That is the **single server** with photos in MySQL.',
      body: [
        'The simplest design: the client POSTs the photo to one server, which saves the bytes in a database column and serves the feed from the same rows.',
        'It breaks at once. 4 MB rows bloat the database, backups crawl, and each upload pins a worker thread for seconds while bytes stream through the app. At 1,200 uploads per second that is thousands of busy threads doing no useful work.',
      ],
      keyIdea: 'A database is for small rows. Large blobs in it bloat backups, waste connections and make every read expensive.',
      metrics: { uploads: '1,200/s', reads: '230k/s', egress: '370 Gbps', storage: '190 PB/yr', p99: '> 2 s' },
      metricTones: { p99: 'bad' },
      scene: {
        nodes: [{ ...phone, chips: ['POST 4 MB'] }, { ...mono, status: 'hot', load: 96 }, { ...viewer, badge: 'spinner' }],
        links: [{ from: 'phone', to: 'mono', label: '4 MB body', labelTone: 'warn' }, { from: 'mono', to: 'viewer' }],
        flows: [
          { path: ['phone', 'mono'], tone: 'request', count: 3, duration: 1.4 },
          { path: ['mono', 'viewer'], tone: 'error', duration: 1.6, delay: 0.8, label: 'timeout' },
        ],
        panel: {
          title: 'What breaks',
          icon: 'triangle-alert',
          rows: [
            { text: 'DB row size', value: '4 MB', tone: 'bad' },
            { text: 'Threads held per upload', value: 'seconds', tone: 'bad' },
            { text: 'Backups', value: 'petabytes', tone: 'bad' },
          ],
        },
      },
    },
    {
      title: 'Direct upload',
      tag: 'concept',
      heading: 'v2: signed URL, straight to storage',
      eli5: 'Instead of handing drawings to the front desk, the desk gives each kid a numbered ticket for the cupboard. The kid walks to the cupboard and puts the drawing in. The **object store** takes it directly.',
      body: [
        'The client asks the API for a **pre-signed URL**, a short-lived link for one upload to one key. A plain pre-signed PUT cannot cap size, so use a pre-signed **POST** with `content-length-range` 10 MB, or check size in the worker. It uploads straight to the raw bucket, then calls `POST /photos` with the key.',
        'The app never touches the bytes, so it stays stateless and cheap. Uploads never followed by `POST /photos` are orphans, and a lifecycle rule deletes them after a day.',
      ],
      keyIdea: 'Pre-signed URLs let clients write straight to object storage, so app servers only handle tiny JSON calls.',
      metrics: { uploads: '1,200/s', reads: '230k/s', egress: '370 Gbps', storage: '190 PB/yr', p99: 'ok on upload' },
      scene: {
        nodes: [phone, { ...api, status: 'active', badge: 'no bytes' }, { ...raw, status: 'active' }, db],
        links: [
          { from: 'phone', to: 'api', style: 'dashed' },
          { from: 'phone', to: 'raw', label: 'signed PUT' },
          { from: 'api', to: 'db' },
        ],
        flows: [
          { path: ['phone', 'api'], tone: 'request', label: 'upload-url', duration: 1 },
          { path: ['api', 'phone'], tone: 'response', label: 'signed URL', duration: 1, delay: 1.1 },
          { path: ['phone', 'raw'], tone: 'data', label: '4 MB', duration: 1.6, delay: 2.3 },
          { path: ['phone', 'api', 'db'], tone: 'request', label: 'POST /photos', duration: 1.6, delay: 4 },
        ],
        panel: {
          title: 'Signed URL',
          icon: 'key-round',
          rows: [
            { text: 'Allows', value: 'one PUT' },
            { text: 'Key', value: 'raw/ab/7712093' },
            { text: 'Expires', value: '10 min' },
            { text: 'Size cap', value: 'POST policy, 10 MB' },
            { text: 'Orphaned uploads', value: 'lifecycle rule deletes' },
          ],
        },
      },
    },
    {
      title: 'Image pipeline',
      tag: 'concept',
      heading: 'v3: process after upload, off the request',
      eli5: 'Once a drawing is in the cupboard, a helper makes small, medium and large copies at a copier. The kid does not wait. The **image workers** are those helpers.',
      body: [
        'Encoding JPEG or WebP is CPU heavy, so it happens after the upload. The raw bucket emits a `photo_uploaded` event to a queue (see the message queues lesson). A pool of **image workers**, autoscaled on queue depth, reads each original, makes three renditions and writes them to the rendition bucket.',
        'The poster never waits for this. The photo shows to others only once `status = processed`, and the client polls or gets a push when it flips.',
      ],
      keyIdea: 'Push the CPU-heavy work behind a queue so uploads return fast and the worker pool scales on backlog.',
      metrics: { uploads: '1,200/s', reads: '230k/s', egress: '370 Gbps', storage: '6 GB/s', p99: 'ok on upload' },
      scene: {
        nodes: [phone, { ...raw, status: 'active' }, queue, { ...workers, status: 'active', load: 55 }, rend],
        links: uploadLinks,
        flows: [
          { path: ['phone', 'raw'], tone: 'data', label: '4 MB', duration: 1.2 },
          { path: ['raw', 'queue'], tone: 'event', label: 'photo_uploaded', duration: 1, delay: 1.3 },
          { path: ['queue', 'workers'], tone: 'event', duration: 1, delay: 2.4 },
          { path: ['workers', 'rend'], tone: 'data', count: 4, duration: 1.2, delay: 3.5 },
        ],
        panel: {
          title: 'Worker steps',
          icon: 'list-checks',
          rows: [
            { text: '1. Read original from raw' },
            { text: '2. Make 320, 640, 1080 px' },
            { text: '3. Write each to renditions' },
            { text: '4. Safety scan' },
            { text: '5. Set status = processed' },
          ],
        },
      },
    },
    {
      title: 'Renditions',
      tag: 'concept',
      heading: 'One photo, four sizes',
      eli5: 'A tiny phone and a big screen need different drawing sizes. The copier makes a small, medium and large copy so each kid gets one that fits.',
      body: [
        'A 4 MB original on a 3G phone makes users leave. So each photo gets **renditions** at 320, 640 and 1080 px (WebP where supported) plus the original. The renditions total about 1.25 MB, and with the 4 MB original that is about 5.3 MB per photo.',
        'The client asks for the size that fits its screen. A feed thumbnail is about 40 KB, and a full-screen view is larger. Renditions are written once and never edited, so each key caches forever.',
      ],
      keyIdea: 'Generate a few fixed sizes once, and let each device pick the smallest one that looks right.',
      metrics: { uploads: '1,200/s', reads: '230k/s', egress: '370 Gbps', storage: '5.3 MB/photo', p99: 'ok on upload' },
      scene: {
        nodes: [{ ...workers, status: 'active' }, { ...rend, status: 'ok', badge: '4 keys' }, { ...viewer, badge: 'asks 320 px' }],
        links: [{ from: 'workers', to: 'rend' }, { from: 'viewer', to: 'rend', style: 'dashed' }],
        flows: [
          { path: ['workers', 'rend'], tone: 'data', count: 4, duration: 1.3 },
          { path: ['viewer', 'rend'], tone: 'request', label: '/320/7712093', duration: 1.5, delay: 1.5 },
        ],
        panel: {
          title: 'Renditions',
          icon: 'image',
          rows: [
            { text: '320 px', value: '~40 KB' },
            { text: '640 px', value: '~210 KB' },
            { text: '1080 px', value: '~1 MB' },
            { text: 'Original', value: '4 MB, deep archive later' },
          ],
          footer: { text: 'Renditions ~1.25 MB + original 4 MB = ~5.3 MB', tone: 'muted' },
        },
      },
    },
    {
      title: 'Checkpoint',
      tag: 'tradeoff',
      heading: 'Quiz: where the bytes go',
      eli5: 'A kid shows up with a big drawing. The school lets the kid use the cupboard door and makes copies later. The front desk just sends a ticket.',
      body: [
        'Check the upload half before moving to reads. A signed URL keeps the bytes off the app, and the queue keeps the CPU work off the request.',
      ],
      keyIdea: 'The upload path avoids the app server for bytes and avoids the request for CPU.',
      metrics: { uploads: '1,200/s', reads: '230k/s', egress: '370 Gbps', storage: '5.3 MB/photo', p99: 'ok on upload' },
      scene: {
        nodes: [phone, api, raw, queue, workers],
        links: [{ from: 'phone', to: 'api', style: 'dashed' }, ...uploadLinks.slice(0, 3)],
        flows: [{ path: ['phone', 'raw', 'queue', 'workers'], tone: 'data', duration: 3 }],
      },
      quiz: {
        question: 'Why does the client upload to a pre-signed URL instead of POSTing the photo to the API?',
        options: [
          'It makes the photo smaller',
          'App servers never hold a thread for the bytes, and storage scales on its own',
          'It removes the need for a metadata row',
          'It lets the CDN skip caching',
        ],
        answer: 1,
        explain: 'The signed URL points at object storage. The API only issues the URL and records the key, so it stays stateless and cheap at 1,200 uploads per second.',
      },
    },
    {
      title: 'CDN',
      tag: 'concept',
      heading: 'v4: the CDN takes the egress',
      eli5: 'Instead of every kid walking to the one cupboard, the school puts copies on small boards in each hallway. Most kids never reach the cupboard. Those boards are the **CDN**.',
      body: [
        'Image URLs point at the CDN, not the bucket (see the CDN lesson). A nearby edge serves the cached rendition, and only a miss goes to the origin bucket. With a 98% hit rate, the 370 Gbps of egress (about 5 thumbnails per feed open) shrinks to about **7 Gbps** at the origin.',
        'Images are immutable, so one cache key per rendition lives for a long time. If a user deletes a photo, you purge that key, and new posts never need invalidation.',
      ],
      keyIdea: 'A 98% CDN hit rate turns 370 Gbps of egress into a single-digit Gbps origin load.',
      metrics: { uploads: '1,200/s', reads: '230k/s', egress: '7 Gbps origin', storage: '5.3 MB/photo', p99: 'image ~50 ms' },
      metricTones: { egress: 'good' },
      scene: {
        nodes: [{ ...rend, status: 'ok' }, { ...cdn, status: 'active', chips: [{ text: 'hit 98%', tone: 'good' }, 'miss 2%'] }, { ...viewer, status: 'ok', badge: '50 ms' }],
        links: [{ from: 'rend', to: 'cdn', label: '7 Gbps' }, { from: 'cdn', to: 'viewer', label: '370 Gbps' }],
        flows: [
          { path: ['cdn', 'viewer'], tone: 'response', count: 5, duration: 1, delay: 0.2 },
          { path: ['viewer', 'cdn', 'rend'], tone: 'request', label: 'miss', duration: 1.8, delay: 1.4 },
        ],
        panel: {
          title: 'Hit rate math',
          icon: 'gauge',
          rows: [
            { text: 'Edge egress', value: '370 Gbps' },
            { text: 'Hit rate', value: '98%', tone: 'good' },
            { text: 'Origin egress', value: '7.4 Gbps', tone: 'good' },
          ],
        },
      },
    },
    {
      title: 'Naive feed',
      tag: 'problem',
      heading: 'Building the feed on every read',
      eli5: 'Each time a kid asks for the wall, a helper runs around collecting every friend’s newest drawing. With 500 friends that helper never finishes.',
      body: [
        'The simplest feed is **fan-out on read**: look up who you follow, fetch each one’s latest photos, merge by time, return 20. For a user following 500 accounts that is 500 lookups per open, at 230,000 opens per second.',
        'It works at tiny scale and misses the 400 ms p99 at real scale. The news feed lesson covers the general trade-off. Here it matters most because the feed is the hot path.',
      ],
      keyIdea: 'Gathering a feed at read time costs one lookup per followed account, which is too slow on the hottest endpoint.',
      metrics: { uploads: '1,200/s', reads: '230k/s', egress: '7 Gbps origin', storage: '5.3 MB/photo', p99: '1.8 s' },
      metricTones: { p99: 'bad' },
      scene: {
        nodes: [{ ...viewer, at: [-5, 1], badge: 'opens app' }, { ...api, status: 'hot', load: 92 }, { ...db, status: 'hot', badge: '500 queries' }],
        links: [{ from: 'viewer', to: 'api' }, { from: 'api', to: 'db', label: '500 lookups', labelTone: 'warn' }],
        flows: [
          { path: ['viewer', 'api'], tone: 'request', label: 'GET /feed', duration: 1 },
          { path: ['api', 'db'], tone: 'request', count: 5, duration: 0.8, delay: 1.1 },
          { path: ['api', 'viewer'], tone: 'error', label: '1.8 s', duration: 1.2, delay: 2.4 },
        ],
        panel: {
          title: 'Read cost',
          icon: 'timer',
          rows: [
            { text: 'Follows', value: '500' },
            { text: 'Lookups per open', value: '500', tone: 'bad' },
            { text: 'Opens', value: '230k/s' },
            { text: 'p99', value: '1.8 s', tone: 'bad' },
          ],
        },
      },
    },
    {
      title: 'Fan-out on write',
      tag: 'concept',
      heading: 'v5: pre-build each feed',
      eli5: 'Instead, when a kid hangs a drawing, a helper immediately puts a note on each friend’s own board. Opening the wall is just reading your own board. That is **fan-out on write**.',
      body: [
        'When a photo reaches `processed`, a fan-out worker reads the author’s followers and pushes the photo id into each follower’s **Redis sorted set**, scored by time. A feed read is then one `ZREVRANGE` of 20 ids plus a batch fetch of metadata. Cassandra backs the sets in case Redis loses one.',
        'Reads become cheap and flat. Writes grow with follower count, so an account with 500 followers means 500 small inserts, done off the request path.',
      ],
      keyIdea: 'Pay once at post time so every feed read is a single cache lookup.',
      metrics: { uploads: '1,200/s', reads: '230k/s', egress: '7 Gbps origin', storage: '5.3 MB/photo', p99: '90 ms' },
      metricTones: { p99: 'good' },
      scene: {
        nodes: [{ ...workers, label: 'fan-out workers', status: 'active' }, { ...feedCache, status: 'active', badge: 'zset per user' }, { ...api, load: 30 }, { ...viewer, status: 'ok', badge: '90 ms' }],
        links: [{ from: 'workers', to: 'feedCache', style: 'dashed' }, { from: 'viewer', to: 'api' }, { from: 'api', to: 'feedCache' }],
        flows: [
          { path: ['workers', 'feedCache'], tone: 'event', count: 3, label: 'ZADD', duration: 1.2 },
          { path: ['viewer', 'api', 'feedCache'], tone: 'request', label: 'ZREVRANGE 20', duration: 1.8, delay: 1.4 },
          { path: ['feedCache', 'viewer'], tone: 'response', duration: 1.4, delay: 3.2 },
        ],
        panel: {
          title: 'Feed of user 42',
          icon: 'list',
          code: 'ZADD feed:42 1731800000 7712093\nZADD feed:42 1731799800 7711950\nZREVRANGE feed:42 0 19\nZREMRANGEBYRANK feed:42 0 -501',
          footer: { text: 'Keep the newest 500 ids per user', tone: 'muted' },
        },
      },
    },
    {
      title: 'Celebrity posts',
      tag: 'tradeoff',
      heading: 'The 300-million-follower problem',
      eli5: 'If one famous kid hangs a drawing, the helper must write 300 million notes. Better to skip the notes and let fans look at the famous kid’s board when they open the wall.',
      body: [
        'Fan-out on write breaks for huge accounts. One post from an account with 300 million followers means 300 million inserts, which floods the queue and delays everyone else.',
        'The fix is **hybrid**: normal accounts fan out on write, and accounts above a follower threshold (say 1 million) are **pulled at read time**. The feed service merges the precomputed set with the celebrity’s own posts from `photos_by_user`, a handful of lookups at most.',
      ],
      keyIdea: 'Push for normal accounts, pull for celebrities, and merge the two at read time.',
      metrics: { uploads: '1,200/s', reads: '230k/s', egress: '7 Gbps origin', storage: '5.3 MB/photo', p99: '110 ms' },
      scene: {
        nodes: [
          { ...queue, label: 'fan-out queue', status: 'hot', badge: '300M writes' },
          { ...workers, label: 'fan-out workers', status: 'hot', load: 98 },
          { ...feedCache, status: 'hot' },
          { ...api, status: 'ok', label: 'feed service', badge: 'merge' },
          { ...db, label: 'photos_by_user', sub: 'celeb posts', status: 'active' },
        ],
        links: [{ from: 'queue', to: 'workers' }, { from: 'workers', to: 'feedCache', label: 'skip above 1M', labelTone: 'warn' }, { from: 'api', to: 'feedCache', label: 'precomputed set' }, { from: 'api', to: 'db', label: 'pull celeb' }],
        flows: [
          { path: ['queue', 'workers'], tone: 'error', count: 3, duration: 1 },
          { path: ['api', 'feedCache'], tone: 'request', label: 'precomputed', duration: 1.2, delay: 1.4 },
          { path: ['api', 'db'], tone: 'request', label: 'pull celeb', duration: 1.2, delay: 2.7 },
        ],
        panel: {
          title: 'Fan-out rule',
          icon: 'split',
          rows: [
            { text: 'Under 1M followers', value: 'push on write' },
            { text: 'Over 1M followers', value: 'pull on read', tone: 'warn' },
            { text: 'Reader merges', value: 'set + ~5 pulls' },
          ],
        },
      },
    },
    {
      title: 'New follows',
      tag: 'case',
      heading: 'Follow, unfollow and missed posts',
      eli5: 'When a kid starts being your friend, their old drawings are not on your board yet. The helper copies a few recent ones over, and removes them if you stop being friends.',
      body: [
        'Edge case: you follow someone at 12:00:00.500, and they post at 12:00:00.600. If the fan-out worker used a follower list snapshotted just before your follow, you miss the photo. Fix it by reading the follower list at fan-out time, and by **backfilling** their last few posts into your feed when you follow.',
        'Unfollow removes that author’s ids from your set, or the feed service filters them at read time. Private accounts add a check: the feed only shows posts from approved follows.',
      ],
      keyIdea: 'Backfill recent posts on follow and read the follower list at fan-out time, so nothing falls into the gap.',
      metrics: { uploads: '1,200/s', reads: '230k/s', egress: '7 Gbps origin', storage: '5.3 MB/photo', p99: '110 ms' },
      scene: {
        nodes: [{ ...viewer, at: [-5, 1], label: 'new follower', badge: 'follows A' }, { ...api, label: 'follow service' }, { ...db, label: 'follow graph', sub: 'sharded SQL' }, { ...feedCache, badge: '+ 10 recent' }],
        links: [{ from: 'viewer', to: 'api' }, { from: 'api', to: 'db' }, { from: 'api', to: 'feedCache', style: 'dashed' }],
        flows: [
          { path: ['viewer', 'api'], tone: 'request', label: 'follow A', duration: 1 },
          { path: ['api', 'db'], tone: 'request', duration: 1, delay: 1.1 },
          { path: ['api', 'feedCache'], tone: 'data', label: 'backfill', count: 3, duration: 1.2, delay: 2.3 },
        ],
        panel: {
          title: 'Race at 12:00:00',
          icon: 'clock',
          rows: [
            { text: '.500 you follow A' },
            { text: '.600 A posts' },
            { text: 'Snapshot taken .400', value: 'miss', tone: 'bad' },
            { text: 'Read list at fan-out', value: 'caught', tone: 'good' },
          ],
        },
      },
    },
    {
      title: 'Likes and comments',
      tag: 'concept',
      heading: 'Engagement is write-heavy and hot',
      eli5: 'Every kid who likes a drawing adds a tally mark. A famous drawing gets millions of marks, so the school keeps a running count on the side instead of counting marks each time.',
      body: [
        'A like first does an insert-if-not-exists into `likes (photo_id, user_id)`, so a double tap or retry hits the same row. Only a new row triggers an `INCR` on the sharded **counter** in cache, so duplicates never inflate it. A periodic job reconciles counters from the table.',
        'A viral photo makes one partition hot. Split its counter across shards and sum on read (see the sharding lesson). Comments are append-only rows keyed by `photo_id`, paged by cursor, and counts may lag briefly.',
      ],
      keyIdea: 'Insert the like row first, bump the sharded counter only when the row was new, and reconcile from the table.',
      metrics: { uploads: '1,200/s', reads: '230k/s', egress: '7 Gbps origin', storage: '5.3 MB/photo', p99: '110 ms' },
      scene: {
        nodes: [{ ...viewer, at: [-5, 1], label: 'fans', badge: '50k likes/s' }, { ...api, label: 'engagement svc' }, { ...feedCache, label: 'like counters', sub: 'split in 16', status: 'hot' }, { ...db, label: 'likes table' }],
        links: [{ from: 'viewer', to: 'api' }, { from: 'api', to: 'feedCache' }, { from: 'api', to: 'db' }],
        flows: [
          { path: ['viewer', 'api'], tone: 'request', count: 3, label: 'like', duration: 1 },
          { path: ['api', 'db'], tone: 'request', label: 'insert if new', duration: 1, delay: 1 },
          { path: ['api', 'feedCache'], tone: 'event', label: 'INCR if new', duration: 1, delay: 2.2 },
        ],
        panel: {
          title: 'Hot photo',
          icon: 'heart',
          code: 'INSERT INTO likes (photo_id, user_id)\n  VALUES (7712093, 42) IF NOT EXISTS\n-- only if applied (row was new):\nINCR likes:7712093:{rand 0..15}\n-- read: sum the 16 shards\n-- cron: recount from likes, fix drift',
        },
      },
    },
    {
      title: 'Checkpoint 2',
      tag: 'tradeoff',
      heading: 'Quiz: feeds',
      eli5: 'Choosing when to write the notes: before friends look, or when they look. Famous kids are different, because their notes would fill the whole school.',
      body: [
        'Test the feed trade-off before looking at storage and failures.',
      ],
      keyIdea: 'Fan-out on write for most, fan-out on read for the very large.',
      metrics: { uploads: '1,200/s', reads: '230k/s', egress: '7 Gbps origin', storage: '5.3 MB/photo', p99: '110 ms' },
      scene: {
        nodes: [workers, feedCache, api, viewer],
        links: [{ from: 'workers', to: 'feedCache', style: 'dashed' }, { from: 'api', to: 'feedCache' }, { from: 'viewer', to: 'api' }],
        flows: [{ path: ['viewer', 'api', 'feedCache'], tone: 'request', duration: 2 }],
      },
      quiz: {
        question: 'An account with 300 million followers posts a photo. What does the hybrid design do?',
        options: [
          'Fan out the photo id to all 300 million feeds immediately',
          'Skip fan-out and pull that account’s latest posts when each follower reads their feed',
          'Block the post until the queue is empty',
          'Store the photo only on the CDN',
        ],
        answer: 1,
        explain: 'Above a follower threshold the post is pulled at read time and merged into the precomputed feed, so one post never creates 300 million writes.',
      },
    },
    {
      title: 'Storage tiers',
      tag: 'concept',
      heading: 'Old photos cool down',
      eli5: 'New drawings are looked at every day, so they stay on the front board. Old ones go to the back shelf, where it takes longer to fetch them but costs less to keep.',
      body: [
        'At about 190 PB a year, fast storage for everything is a waste. **Hot** (0 to 30 days): standard storage, edge cached. **Warm** (30 to 90 days): infrequent-access class, still instant and cheaper (30 days is its minimum). **Cold** (over 90 days): renditions go to an instant-retrieval archive class, originals to deep archive.',
        'A grid thumbnail must load in milliseconds, so renditions never leave instant classes. Originals are about 150 PB a year and never served, so hours to restore is fine.',
      ],
      keyIdea: 'Match storage cost to access frequency with age-based tiers, and archive the originals first.',
      metrics: { uploads: '1,200/s', reads: '230k/s', egress: '7 Gbps origin', storage: '190 PB/yr, tiered', p99: '110 ms' },
      scene: {
        nodes: [
          { ...rend, label: 'hot tier', sub: '0 to 30 days', status: 'ok', at: [-4, -1] },
          { ...raw, id: 'warm', label: 'warm tier', sub: '30 to 90 days', at: [-1, -0.5] },
          { ...raw, id: 'cold', label: 'cold tier', sub: 'over 90 days', status: 'dim', at: [2, 0] },
        ],
        links: [{ from: 'rend', to: 'warm', label: 'age 30 d' }, { from: 'warm', to: 'cold', label: 'age 90 d' }],
        flows: [{ path: ['rend', 'warm', 'cold'], tone: 'data', duration: 3 }],
        panel: {
          title: 'Lifecycle',
          icon: 'archive',
          rows: [
            { text: 'Hot', value: 'fast, edge cached' },
            { text: 'Warm', value: 'cheaper, instant' },
            { text: 'Cold renditions', value: 'instant archive' },
            { text: 'Cold originals', value: 'deep archive, hours' },
          ],
          footer: { text: 'Originals move down first', tone: 'muted' },
        },
      },
    },
    {
      title: 'Profile grid',
      tag: 'concept',
      heading: 'The profile read path',
      eli5: 'A kid’s own page lists all their drawings, newest first. The school keeps that list in order, so flipping pages is quick.',
      body: [
        'The profile grid reads `photos` by `user_id`, newest first, 12 to 24 at a time with a cursor. Add a table keyed by `user_id` and clustered by time descending, so the page is one partition read. Thumbnails come from the CDN.',
        'Deep scrolling into old posts reads renditions from the warm and cold tiers. That works because renditions stay on instant-retrieval classes and the grid asks for the smallest one. Only originals sit in deep archive, and the grid never reads them.',
      ],
      keyIdea: 'Cluster the profile table by user and time so a page of the grid is one partition read.',
      metrics: { uploads: '1,200/s', reads: '230k/s', egress: '7 Gbps origin', storage: '190 PB/yr, tiered', p99: '110 ms' },
      scene: {
        nodes: [{ ...viewer, at: [-5, 1], label: 'visitor' }, { ...api, label: 'profile service' }, { ...db, label: 'photos_by_user' }, cdn],
        links: [{ from: 'viewer', to: 'api' }, { from: 'api', to: 'db' }, { from: 'cdn', to: 'viewer', style: 'dashed' }],
        flows: [
          { path: ['viewer', 'api', 'db'], tone: 'request', label: 'cursor=7711000', duration: 1.8 },
          { path: ['cdn', 'viewer'], tone: 'response', count: 3, label: '320 px', duration: 1.2, delay: 2 },
        ],
        panel: {
          title: 'Query',
          icon: 'table',
          code: "SELECT photo_id FROM photos_by_user\nWHERE user_id = 42\n  AND photo_id < 7711000\nORDER BY photo_id DESC LIMIT 24;",
        },
      },
    },
    {
      title: 'Worker crash',
      tag: 'case',
      heading: 'A burst, a crash and a backlog',
      eli5: 'Suppose the copier jams or a hundred kids rush in at once. The drawings wait in a line and nothing is lost. More helpers join until the line is short.',
      body: [
        'A new year’s midnight can push uploads from 1,200 to 5,000 per second. The queue absorbs the burst and autoscaling adds workers by queue depth. If a worker crashes mid-photo, its lease expires and another reruns it. Output keys are fixed, so a rerun overwrites partial files and the step is idempotent.',
        'A poison photo that always crashes goes to a dead-letter queue after a few tries, and the post shows a failure to its owner. The backlog is visible: processing delay is the metric to alert on.',
      ],
      keyIdea: 'A queue, leases, idempotent outputs and a dead-letter queue turn crashes and bursts into delay instead of loss.',
      metrics: { uploads: '5,000/s peak', reads: '230k/s', egress: '7 Gbps origin', storage: '190 PB/yr, tiered', p99: 'processing 40 s' },
      metricTones: { uploads: 'warn', p99: 'warn' },
      scene: {
        nodes: [{ ...queue, status: 'hot', badge: '200k backlog' }, { ...workers, status: 'hot', load: 95, label: 'image workers', badge: 'scaling 40 to 120' }, { ...rend, status: 'active' }],
        links: [{ from: 'queue', to: 'workers' }, { from: 'workers', to: 'rend' }],
        flows: [
          { path: ['queue', 'workers'], tone: 'event', count: 4, duration: 1 },
          { path: ['workers', 'rend'], tone: 'data', count: 3, duration: 1.2, delay: 1.2 },
        ],
        panel: {
          title: 'Burst response',
          icon: 'activity',
          rows: [
            { text: 'Upload rate', value: '1,200 to 5,000/s', tone: 'warn' },
            { text: 'Autoscale on', value: 'queue depth' },
            { text: 'Crash', value: 'lease expires, rerun', tone: 'good' },
            { text: 'Poison photo', value: 'dead-letter queue' },
          ],
        },
      },
    },
    {
      title: 'Edge failure',
      tag: 'case',
      heading: 'When an edge or the origin goes down',
      eli5: 'If one hallway board is taken down, kids walk to the next hallway. If the cupboard is closed, the boards still show what they have.',
      body: [
        'If one CDN edge fails, DNS and anycast route viewers to the next nearest one, at slightly higher latency. If the origin bucket is unreachable, edges keep serving cached renditions, and only the 2% of misses fail. Object storage keeps copies in multiple zones (see the replication lesson).',
        'The feed degrades gracefully too. If a Redis feed set is lost, the feed service rebuilds it from Cassandra, or serves the pull-based feed for that user while it rebuilds. A slower feed is better than an empty one.',
      ],
      keyIdea: 'Cached edges keep serving through an origin outage, and a lost feed rebuilds from its durable store.',
      metrics: { uploads: '1,200/s', reads: '230k/s', egress: '7 Gbps origin', storage: '190 PB/yr, tiered', p99: '180 ms' },
      scene: {
        nodes: [{ ...rend, status: 'down', badge: 'origin down' }, { ...cdn, status: 'ok', chips: [{ text: 'serves cache', tone: 'good' }] }, { ...viewer, status: 'ok', badge: 'still loads' }],
        links: [{ from: 'rend', to: 'cdn', style: 'dashed' }, { from: 'cdn', to: 'viewer' }],
        flows: [
          { path: ['cdn', 'viewer'], tone: 'response', count: 4, duration: 1 },
          { path: ['cdn', 'rend'], tone: 'error', label: '2% miss', duration: 1.4, delay: 1.2 },
        ],
        panel: {
          title: 'During the outage',
          icon: 'shield-check',
          rows: [
            { text: 'Cached images', value: '98% served', tone: 'good' },
            { text: 'Misses', value: '2% fail', tone: 'warn' },
            { text: 'Feed set lost', value: 'rebuild from Cassandra' },
          ],
        },
      },
    },
    {
      title: 'Safety',
      tag: 'concept',
      heading: 'Scan, block, delete',
      eli5: 'Before a drawing goes on the wall, a teacher checks that it is allowed. If a kid asks to take theirs down, every copy on every board must go.',
      body: [
        'The pipeline runs NSFW and abuse classifiers on each upload before `processed`. A blocked photo never reaches any feed, and borderline cases go to human review. Strip location metadata (EXIF) from served renditions unless the user opted in.',
        'Deletion is a pipeline too. Mark the row deleted, remove ids from feed sets lazily, delete the rendition keys, and **purge the CDN**. Until the purge lands, the feed service filters by status so a deleted photo is hidden at once.',
      ],
      keyIdea: 'Scan before publishing, and treat delete as a pipeline that hides first and purges everywhere after.',
      metrics: { uploads: '1,200/s', reads: '230k/s', egress: '7 Gbps origin', storage: '190 PB/yr, tiered', p99: '110 ms' },
      scene: {
        nodes: [{ ...raw, status: 'active' }, { ...workers, label: 'safety scan', sub: 'ML classifier', status: 'active' }, { ...rend, status: 'ok' }, { ...cdn, badge: 'purge on delete' }],
        links: [{ from: 'raw', to: 'workers' }, { from: 'workers', to: 'rend' }, { from: 'rend', to: 'cdn', style: 'dashed' }],
        flows: [
          { path: ['raw', 'workers'], tone: 'request', label: 'scan', duration: 1.2 },
          { path: ['workers', 'rend'], tone: 'data', label: 'pass', duration: 1.2, delay: 1.3 },
          { path: ['rend', 'cdn'], tone: 'event', label: 'purge', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'Status flow',
          icon: 'shield',
          rows: [
            { text: 'uploaded', value: 'hidden' },
            { text: 'processed', value: 'visible', tone: 'good' },
            { text: 'blocked', value: 'never shown', tone: 'bad' },
            { text: 'deleted', value: 'hide, then purge' },
          ],
        },
      },
    },
    {
      title: 'Production',
      tag: 'concept',
      heading: 'The full post lifecycle',
      eli5: 'Drawing goes in the cupboard, gets copied, passes the teacher, lands on friends’ boards, and a note tells friends it is up. Every helper has one small job.',
      body: [
        'Putting it together: the client PUTs to the raw bucket, the event reaches the queue, workers make renditions and run the scan, metadata and keys are committed, a fan-out worker writes to follower feeds, and the notification service (see the notification system lesson) pings followers who opted in.',
        'Reads go through the API gateway to the feed service, Redis, and Cassandra on a miss. Image bytes go through the CDN. Each stage scales on its own, and the queue keeps them apart.',
      ],
      keyIdea: 'A queue separates upload, processing and fan-out, so each stage scales and fails on its own.',
      metrics: { uploads: '1,200/s', reads: '230k/s', egress: '7 Gbps origin', storage: '190 PB/yr, tiered', p99: '110 ms' },
      metricTones: { egress: 'good', p99: 'good' },
      scene: {
        nodes: [raw, workers, rend, { ...feedCache, status: 'ok' }, { ...cdn, status: 'ok' }],
        links: [{ from: 'raw', to: 'workers' }, { from: 'workers', to: 'rend' }, { from: 'workers', to: 'feedCache', style: 'dashed' }, { from: 'rend', to: 'cdn' }],
        flows: [
          { path: ['raw', 'workers', 'rend'], tone: 'data', duration: 3.2 },
          { path: ['workers', 'feedCache'], tone: 'event', label: 'fan-out', duration: 1.4, delay: 3.2 },
          { path: ['rend', 'cdn'], tone: 'data', duration: 1, delay: 3.2 },
        ],
        panel: {
          title: 'Post lifecycle',
          icon: 'workflow',
          rows: [
            { text: '1. PUT raw' },
            { text: '2. Event, then workers' },
            { text: '3. Renditions + scan' },
            { text: '4. Commit metadata' },
            { text: '5. Fan-out to feeds' },
            { text: '6. Notify followers' },
          ],
        },
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Bytes on one road, notes on another',
      eli5: 'Drawings go to the cupboard, helpers copy them, hallway boards show them, and each kid has their own list of friends’ drawings. That is the whole **photo app**.',
      body: [
        'Uploads use signed URLs straight to object storage, then a queue feeds an autoscaled image pipeline that makes renditions and runs safety checks. A CDN with a 98% hit rate carries 370 Gbps of reads, so the origin sees about 7.',
        'Feeds are pre-built in Redis for normal accounts and pulled for celebrities, with backfill on follow. Likes use idempotent rows and sharded counters, tiering controls the 190 PB a year, and failures show up as delay, not loss.',
      ],
      keyIdea: 'Keep bytes off the API, push CPU work behind a queue, serve images from the CDN, and pre-build feeds except for the biggest accounts.',
      metrics: { uploads: '1,200/s', reads: '230k/s', egress: '7 Gbps origin', storage: '190 PB/yr, tiered', p99: '110 ms' },
      metricTones: { egress: 'good', p99: 'good' },
      scene: {
        nodes: [raw, workers, { ...rend, status: 'ok' }, { ...cdn, status: 'ok' }, viewer],
        links: [{ from: 'raw', to: 'workers' }, { from: 'workers', to: 'rend' }, { from: 'rend', to: 'cdn' }, { from: 'cdn', to: 'viewer' }],
        flows: [
          { path: ['raw', 'workers', 'rend'], tone: 'data', duration: 3.2 },
          { path: ['rend', 'cdn'], tone: 'data', duration: 1, delay: 3.2 },
          { path: ['cdn', 'viewer'], tone: 'response', count: 3, duration: 1, delay: 1 },
        ],
      },
      quiz: {
        question: 'Which choice does the most to cut the 370 Gbps image egress?',
        options: [
          'A bigger app server fleet',
          'Serving renditions from a CDN with a 98% hit rate',
          'Storing images in the metadata database',
          'Polling the feed less often',
        ],
        answer: 1,
        explain: 'Renditions are immutable and cacheable, so the CDN serves 98% of bytes and the origin only sees the misses, about 7 Gbps.',
      },
    },
  ],
};
