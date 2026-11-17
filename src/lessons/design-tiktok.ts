import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const phone: SceneNode = { id: 'phone', kind: 'phone', at: at(-5.7, 0), label: 'viewer', sub: 'swiping up' };
const creator: SceneNode = { id: 'creator', kind: 'phone', at: at(-5.7, 0), label: 'creator', sub: '30 s clip' };

export const designTiktok: Lesson = {
  id: 'design-tiktok',
  title: 'Design TikTok',
  tagline: 'Serve an endless feed of short videos that feels like it reads your mind, to 1.5 billion people a day.',
  minutes: 26,
  level: 'Advanced',
  learn: [
    'Scale numbers: views, uploads, storage and CDN egress',
    'The API, the data model and the simplest design that works for ten thousand users',
    'Upload, transcoding into 15 assets per video, moderation and CDN delivery',
    'The recommender funnel: two-tower embeddings, ANN retrieval, a heavy ranker and business rules',
    'The real-time feedback loop, cold start for users and for videos, and client prefetch',
    'Engagement counters, creator analytics, and how the feed survives failures and viral spikes',
  ],
  metrics: [
    { key: 'dau', label: 'Daily users', icon: 'Users' },
    { key: 'qps', label: 'Feed views', icon: 'Gauge' },
    { key: 'store', label: 'New storage', icon: 'HardDrive' },
    { key: 'egress', label: 'CDN egress', icon: 'Download' },
    { key: 'loop', label: 'Signal to feed', icon: 'Timer' },
  ],
  steps: [
    {
      title: 'Requirements',
      tag: 'problem',
      heading: 'An endless feed that guesses what you want next',
      eli5:
        'Picture a giant **library** of picture books. Every kid who walks in wants a pile of books they will love, handed over before they even ask, forever.',
      body: [
        'Users swipe through an infinite vertical feed of **15 to 60 second videos**. It must be personal, so two people never see the same feed. They like, comment, share, save and follow.',
        'Creators record, edit and upload. They also want analytics and a way to earn money. Harmful videos must come down **within minutes**.',
      ],
      keyIdea: 'The product is a feed that feels personal and never buffers. Everything else supports that.',
      metrics: { dau: '1.5B', qps: '-', store: '-', egress: '-', loop: '-' },
      scene: {
        nodes: [
          { ...phone, chips: ['swipe up', { text: 'next video in 0 ms', tone: 'good' }] },
          { id: 'feed', kind: 'block', at: at(0, 0), label: 'feed', sub: 'personal', icon: 'Rss', tint: 'violet' },
          { id: 'videos', kind: 'storage', at: at(5.7, 0), label: 'videos', sub: 'billions' },
        ],
        links: [link('phone', 'feed'), link('feed', 'videos')],
        flows: [
          { path: ['phone', 'feed', 'videos'], tone: 'request', label: 'what next?', duration: 1.8 },
          { path: ['videos', 'feed', 'phone'], tone: 'response', label: 'video 1', duration: 1.8, delay: 1.9 },
        ],
        panel: {
          title: 'What it must do',
          icon: 'List',
          rows: [
            { text: 'Personal infinite feed', value: 'core' },
            { text: 'Like, comment, share, save, follow' },
            { text: 'Upload: record, edit, music' },
            { text: 'Creator analytics, monetization' },
            { text: 'Remove harmful content', value: 'minutes', tone: 'warn' },
          ],
        },
        caption: 'One feed per person, 1.5 billion people',
      },
    },
    {
      title: 'Scale math',
      tag: 'concept',
      heading: 'The numbers set the shape of the design',
      eli5:
        'Imagine the library has 1.5 billion visitors a day, and each one reads about 70 books. You cannot hire one librarian per visitor, so the numbers decide how the library is built.',
      body: [
        '1.5B daily users watch about 70 videos each: **100B views a day**, or `100B / 86,400 s` = **1.2M feed requests per second**. Each request scores about 1,000 candidates, so the ranker makes about **1.2B predictions per second**, served by batched GPU inference with caching.',
        'Uploads peak near **400M videos a day**. Delivery moves `100B x 10 MB` = **1 EB a day**, roughly **100 Tbps** sustained.',
      ],
      keyIdea: 'Three numbers dominate: 1.2M feed requests per second, 1.2B ranker scores per second and 100 Tbps of delivery.',
      metrics: { dau: '1.5B', qps: '1.2M/s', store: '-', egress: '~100 Tbps', loop: '-' },
      metricTones: { qps: 'warn', egress: 'bad' },
      scene: {
        nodes: [
          { ...phone, sub: '70 videos a day' },
          { id: 'feed', kind: 'block', at: at(0, 0), label: 'feed', sub: '1.2M req/s', icon: 'Gauge', tint: 'violet', chips: [{ text: '1.2B scores/s', tone: 'warn' }] },
          { id: 'cdn', kind: 'cdn', at: at(5.7, 0), label: 'video delivery', sub: '100 Tbps', chips: [{ text: '1 EB/day', tone: 'bad' }] },
        ],
        links: [link('phone', 'feed'), link('phone', 'cdn', { style: 'faint', route: 'straight' })],
        flows: [
          { path: ['phone', 'feed'], tone: 'request', label: '1.2M/s', duration: 1.4 },
          { path: ['cdn', 'phone'], tone: 'data', label: '10 MB', count: 3, duration: 1.8, delay: 1.5 },
        ],
        panel: {
          title: 'Back-of-envelope',
          icon: 'Table',
          rows: [
            { text: 'Views per day', value: '100B' },
            { text: 'Feed requests', value: '100B / 86,400 = 1.2M/s' },
            { text: 'Ranker scores', value: '1,000 per request = 1.2B/s', tone: 'warn' },
            { text: 'Egress', value: '100B x 10 MB = 1 EB/day', tone: 'bad' },
            { text: 'Uploads at peak', value: '400M/day' },
          ],
        },
        caption: 'Compute-heavy feed, bandwidth-heavy video',
      },
    },
    {
      title: 'The API',
      tag: 'concept',
      heading: 'Four calls carry the whole product',
      eli5:
        'Visitors only do a few things at the library desk: ask for the next pile of books, tell the librarian what they thought, hand in a new book, and ask for the book itself.',
      body: [
        '`GET /feed` returns a short page of video ids with their CDN URLs, not the video bytes. `POST /events` reports what the client saw: watched, skipped, liked.',
        'Uploads use `POST /videos`, which answers with a pre-signed storage URL (see the object storage lesson). The client sends the file straight there. Cursor paging fits poorly because the feed is generated per request, so each call is just "give me the next 10 for this user".',
      ],
      keyIdea: 'The feed API returns ids and URLs. Bytes travel on a different path, and feedback travels back as events.',
      metrics: { dau: '1.5B', qps: '1.2M/s', store: '-', egress: '~100 Tbps', loop: '-' },
      scene: {
        nodes: [
          { ...phone, chips: ['GET /feed', 'POST /events'] },
          { id: 'api', kind: 'block', at: at(0, -3.4), label: 'API', sub: 'stateless', icon: 'Network', tint: 'violet' },
          { id: 'store', kind: 'storage', at: at(0, 3.4), label: 'object store', sub: 'uploads' },
        ],
        links: [link('phone', 'api'), link('phone', 'store', { label: 'pre-signed URL', style: 'dashed' })],
        flows: [
          { path: ['phone', 'api'], tone: 'request', label: 'GET /feed', duration: 1.3 },
          { path: ['api', 'phone'], tone: 'response', label: '10 ids + URLs', duration: 1.3, delay: 1.4 },
          { path: ['phone', 'store'], tone: 'data', label: 'PUT video', duration: 1.6, delay: 2.9 },
        ],
        panel: {
          title: 'The four calls',
          icon: 'Code',
          code: 'GET  /feed?n=10\nPOST /events\nPOST /videos     -> upload URL\nGET  <cdn-url>   -> chunks',
          footer: { text: 'Ids and URLs from the API, bytes from the CDN', tone: 'muted' },
        },
      },
      code: {
        language: 'bash',
        title: 'What a client sends and gets back',
        source: `# ask for the next page of the feed
curl "https://api.example/feed?n=10" -H "Authorization: Bearer $TOKEN"
# -> {"items":[{"id":"v81","url":"https://cdn.example/v81/1080/seg0.mp4"}, ...]}

# report what happened on screen
curl -X POST https://api.example/events -d '{
  "video":"v81","watched_ms":420,"duration_ms":18000,"action":"skip"}'`,
        highlight: [2, 6, 7],
      },
    },
    {
      title: 'Data model',
      tag: 'concept',
      heading: 'Metadata is small. Video and events are huge',
      eli5:
        'The library keeps a small card for every book (title, who wrote it), a huge shelf for the books themselves, and a never-ending notebook of who read what.',
      body: [
        '**Users, videos and follows** are small structured rows, a fit for a sharded SQL or wide-column store (see the sharding lesson). A video row holds creator, caption, music id, status and asset keys.',
        'Video files live in **object storage**. **Events** (every watch and skip) are append-only and flow to a log. **Embeddings** for users and videos live in a feature store, a key-value store tuned for fast reads.',
      ],
      keyIdea: 'Four stores for four shapes of data: rows, blobs, an event log and a feature store.',
      metrics: { dau: '1.5B', qps: '1.2M/s', store: '-', egress: '~100 Tbps', loop: '-' },
      scene: {
        nodes: [
          { id: 'meta', kind: 'db', at: at(-5.7, 0), label: 'metadata', sub: 'users, videos' },
          { id: 'blobs', kind: 'storage', at: at(-1.9, 0), label: 'video files', sub: 'object store' },
          { id: 'events', kind: 'queue', at: at(1.9, 0), label: 'event log', sub: 'append only' },
          { id: 'fstore', kind: 'cache', at: at(5.7, 0), label: 'feature store', sub: 'embeddings' },
        ],
        links: [],
        flows: [],
        panel: {
          title: 'Core records',
          icon: 'Table',
          rows: [
            { text: 'video', value: 'id, creator, caption, music, status' },
            { text: 'user', value: 'id, region, follows' },
            { text: 'event', value: 'user, video, action, ms' },
            { text: 'embedding', value: '256 floats per user or video' },
          ],
        },
        caption: 'Each shape of data gets its own store',
      },
    },
    {
      title: 'Simple design',
      tag: 'concept',
      heading: 'Version one: one server, one database, newest first',
      eli5:
        'On day one the library is a single room with one librarian. New books go on the front shelf, and every kid gets the newest ones first.',
      body: [
        'Ten thousand users need little more than an **app server**, a SQL database and a disk of videos. The feed is `ORDER BY created_at DESC` over the accounts you follow.',
        'It works. Uploads save the file to disk, the server reads the bytes back out, and the player streams them. The trouble starts when the numbers on the previous steps arrive.',
        'Sizing it with the same method: `10K x 70 views x 10 MB` = **7 TB a day**, about **650 Mbps** of video, and `700K views / 86,400 s` = about **8 feed requests per second**.',
      ],
      keyIdea: 'A chronological feed over one server is a fine start. It has no personalization and no room to grow.',
      metrics: { dau: '10K', qps: '8 /s', store: '7 TB/day', egress: '650 Mbps', loop: 'none' },
      scene: {
        nodes: [
          phone,
          { id: 'app', kind: 'server', at: at(-1.9, 0), label: 'app server', sub: 'feed + files', chips: ['ORDER BY created_at'] },
          { id: 'db', kind: 'db', at: at(2.6, -3.4), label: 'SQL', sub: 'videos, users' },
          { id: 'disk', kind: 'storage', at: at(2.6, 3.4), label: 'video disk', sub: 'local' },
        ],
        links: [link('phone', 'app'), link('app', 'db'), link('app', 'disk')],
        flows: [
          { path: ['phone', 'app', 'db', 'app', 'phone'], tone: 'request', label: 'GET /feed', duration: 2.2 },
          { path: ['phone', 'app', 'disk', 'app', 'phone'], tone: 'data', label: 'video bytes', duration: 2.2, delay: 2.4 },
        ],
        panel: {
          title: 'The feed query',
          icon: 'Code',
          code: 'SELECT id FROM videos\nWHERE creator IN (follows)\nORDER BY created_at DESC\nLIMIT 10;',
        },
      },
    },
    {
      title: 'Where it breaks',
      tag: 'case',
      heading: 'At 1.5B users, every part of version one fails',
      eli5:
        'Now a billion kids come in. One librarian cannot carry books for everybody, the front shelf shows everyone the same books, and the hallway jams with people lugging heavy books.',
      body: [
        'The server is the **bandwidth path** for every video byte, so it saturates first. One disk cannot hold 30 PB a day. A raw upload plays badly on a phone, because it was never converted to smaller sizes.',
        'Worst of all, **newest-first is not personal**. A new user follows nobody and sees nothing. The recommender is what keeps people watching, so it is the center of the design.',
      ],
      keyIdea: 'Bytes, storage and personalization each need their own fix. The next steps add them one at a time.',
      metrics: { dau: '1.5B', qps: '1.2M/s', store: '30 PB/day', egress: '~100 Tbps', loop: 'none' },
      metricTones: { store: 'bad', egress: 'bad', loop: 'bad' },
      scene: {
        nodes: [
          phone,
          { id: 'app', kind: 'server', at: at(-1.9, 0), label: 'app server', sub: 'feed + files', status: 'hot', load: 99, chips: [{ text: 'bytes through me', tone: 'bad' }] },
          { id: 'db', kind: 'db', at: at(2.6, -3.4), label: 'SQL', sub: 'videos, users', status: 'hot' },
          { id: 'disk', kind: 'storage', at: at(2.6, 3.4), label: 'video disk', sub: 'full', status: 'down' },
        ],
        links: [link('phone', 'app'), link('app', 'db'), link('app', 'disk')],
        flows: [{ path: ['phone', 'app'], tone: 'error', label: 'timeout', duration: 1.4 }],
        panel: {
          title: 'What gives out',
          icon: 'Bug',
          rows: [
            { text: 'Server NIC', value: 'saturated', tone: 'bad' },
            { text: 'One disk vs 30 PB/day', value: 'full', tone: 'bad' },
            { text: 'Raw upload on 4G', value: 'stalls', tone: 'warn' },
            { text: 'New user feed', value: 'empty', tone: 'warn' },
          ],
        },
      },
    },
    {
      title: 'Upload path',
      tag: 'concept',
      heading: 'Bytes go straight to storage, work goes through a queue',
      eli5:
        'A new author does not walk the book through the front desk. They drop it in the back-room **box**, and a note on the job board tells the copy room to start.',
      body: [
        'The app server hands the creator a **pre-signed URL** and steps aside. The phone uploads straight to object storage in resumable parts, as in the YouTube lesson.',
        'When the last part lands, an event goes on a **job queue** (see the message queues lesson). A pool of **transcoders** pulls jobs, so a surge of uploads waits in the queue and never hits the API.',
      ],
      keyIdea: 'Move the bytes out of the API and put the slow work behind a queue.',
      metrics: { dau: '1.5B', qps: '1.2M/s', store: '30 PB/day', egress: '~100 Tbps', loop: 'none' },
      scene: {
        nodes: [
          { ...creator, chips: ['PUT part 3 of 8'] },
          { id: 'raw', kind: 'storage', at: at(-1.9, 0), label: 'raw store', sub: 'originals' },
          { id: 'queue', kind: 'queue', at: at(1.9, 0), label: 'job queue', sub: 'transcode tasks' },
          { id: 'enc', kind: 'worker', at: at(5.7, 0), label: 'transcoders', sub: 'autoscaled pool' },
        ],
        links: [link('creator', 'raw', { label: 'resumable', style: 'dashed' }), link('raw', 'queue'), link('queue', 'enc')],
        flows: [
          { path: ['creator', 'raw'], tone: 'data', label: 'video parts', count: 3, duration: 1.6 },
          { path: ['raw', 'queue'], tone: 'event', label: 'uploaded', duration: 1.2, delay: 1.7 },
          { path: ['queue', 'enc'], tone: 'event', label: 'job', duration: 1.2, delay: 3 },
        ],
        panel: {
          title: 'Why a queue',
          icon: 'Inbox',
          rows: [
            { text: 'Peak uploads', value: '400M/day = 4.6K/s' },
            { text: 'Spike over capacity', value: 'waits, no loss', tone: 'good' },
            { text: 'Worker dies', value: 'job retried', tone: 'good' },
          ],
        },
      },
    },
    {
      title: 'Transcoding',
      tag: 'concept',
      heading: 'One upload becomes 15 assets',
      eli5:
        'The copy room makes every book in five sizes and three kinds of paper, so a tiny pocket book, a big picture book and everything between all exist for each kid.',
      body: [
        'Each video is encoded at **5 resolutions** in **3 codecs** (H.264, H.265 and AV1): 15 assets. At about 5 MB each, that is **75 MB per video**, and `400M x 75 MB` = **30 PB of new storage a day**.',
        'Fresh videos are hot, and most views come in the first days. Storage tiers them: hot assets on fast disks and in CDN caches, old ones on **cold storage**, recoverable on demand.',
      ],
      keyIdea: 'Many renditions let each phone play the best one it can. A hot to cold lifecycle keeps 30 PB a day affordable.',
      metrics: { dau: '1.5B', qps: '1.2M/s', store: '30 PB/day', egress: '~100 Tbps', loop: 'none' },
      metricTones: { store: 'warn' },
      scene: {
        nodes: [
          { id: 'raw', kind: 'storage', at: at(-5.7, 0), label: 'raw video', sub: '1 upload' },
          { id: 'enc', kind: 'worker', at: at(-1.9, 0), label: 'transcoders', sub: '5 x 3 = 15 jobs', status: 'active', load: 72 },
          { id: 'hot', kind: 'storage', at: at(1.9, 0), label: 'hot assets', sub: '75 MB per video' },
          { id: 'cold', kind: 'storage', at: at(5.7, 0), label: 'cold tier', sub: 'old videos', tint: 'gray' },
        ],
        links: [link('raw', 'enc'), link('enc', 'hot'), link('hot', 'cold', { style: 'dashed', label: 'after weeks' })],
        flows: [
          { path: ['raw', 'enc'], tone: 'data', duration: 1.2 },
          { path: ['enc', 'hot'], tone: 'data', label: '15 assets', count: 3, duration: 1.4, delay: 1.3 },
          { path: ['hot', 'cold'], tone: 'event', label: 'age out', duration: 1.4, delay: 3 },
        ],
        panel: {
          title: 'Per video',
          icon: 'Table',
          rows: [
            { text: 'Resolutions', value: '5' },
            { text: 'Codecs', value: 'H.264, H.265, AV1' },
            { text: 'Assets', value: '5 x 3 = 15' },
            { text: 'Size', value: '15 x 5 MB = 75 MB' },
            { text: 'Per day', value: '400M x 75 MB = 30 PB', tone: 'warn' },
          ],
        },
      },
      quiz: {
        question: 'A video is encoded at 5 resolutions in 3 codecs and each asset averages 5 MB. What does 400M uploads a day add?',
        options: ['About 2 PB a day', 'About 30 PB a day', 'About 400 PB a day'],
        answer: 1,
        explain: '5 x 3 = 15 assets, 15 x 5 MB = 75 MB per video, and 400M x 75 MB is 30 PB. Tiering old videos to cold storage keeps the bill sane.',
      },
    },
    {
      title: 'Moderation',
      tag: 'concept',
      heading: 'Check a video before the world can see it',
      eli5:
        'Before a new book goes on the shelf, a helper flips through it. Easy books pass quickly. Odd ones go to a grown-up reader, and a bad book gets pulled back off the shelf.',
      body: [
        'Each upload passes **automated classifiers** over its frames, audio, caption and text on screen. Clear passes publish. Clear violations are blocked. The unsure middle goes to a **human review queue**.',
        'Removal must reach every copy in minutes. Flip `status` in the metadata DB, then **purge the CDN**. The feed also filters by status, so a flagged video stops being recommended at once.',
      ],
      keyIdea: 'Gate on the way in, and keep a fast kill switch for what slips through. The target is minutes, not days.',
      metrics: { dau: '1.5B', qps: '1.2M/s', store: '30 PB/day', egress: '~100 Tbps', loop: 'none' },
      scene: {
        nodes: [
          { id: 'hot', kind: 'storage', at: at(-5.7, 0), label: 'new assets', sub: 'status: pending' },
          { id: 'scan', kind: 'block', at: at(-1.9, 0), label: 'classifiers', sub: 'frames, audio, text', icon: 'Shield', tint: 'red' },
          { id: 'review', kind: 'user', at: at(2.6, -3.4), label: 'reviewers', sub: 'unsure cases' },
          { id: 'meta', kind: 'db', at: at(2.6, 3.4), label: 'metadata', sub: 'status flag' },
        ],
        links: [link('hot', 'scan'), link('scan', 'review', { label: 'borderline' }), link('scan', 'meta', { label: 'clear' })],
        flows: [
          { path: ['hot', 'scan'], tone: 'data', duration: 1.2 },
          { path: ['scan', 'meta'], tone: 'response', label: 'published', duration: 1.3, delay: 1.3 },
          { path: ['scan', 'review'], tone: 'event', label: 'review', duration: 1.3, delay: 2.8 },
        ],
        panel: {
          title: 'Verdicts',
          icon: 'Shield',
          rows: [
            { text: 'Clearly fine', value: 'publish', tone: 'good' },
            { text: 'Unsure', value: 'human queue', tone: 'warn' },
            { text: 'Clear violation', value: 'block', tone: 'bad' },
            { text: 'Reported later', value: 'flag + CDN purge', tone: 'warn' },
          ],
          footer: { text: 'Target: harmful video gone in minutes', tone: 'good' },
        },
      },
    },
    {
      title: 'CDN delivery',
      tag: 'concept',
      heading: 'The API sends a URL. A CDN sends the video',
      eli5:
        'Instead of the library mailing every book from one building, small **book boxes** on every street corner hold copies of what the neighborhood reads. Kids grab books from the corner.',
      body: [
        'The feed API returns **URLs**. The phone fetches video from the nearest of **400+ CDN edge locations**, in **2 second fragments**, so the first fragment plays while the rest downloads (see the CDN lesson).',
        'Egress of about **100 Tbps** is too big for any one origin. Popular videos sit in edge caches. A miss goes to the origin store and fills the edge for the next viewer.',
      ],
      keyIdea: 'Keep the API tiny and let a CDN carry 100 Tbps. Short fragments make the first frame fast.',
      metrics: { dau: '1.5B', qps: '1.2M/s', store: '30 PB/day', egress: '~100 Tbps', loop: 'none' },
      scene: {
        nodes: [
          { ...phone, chips: ['frag 1 of 8 plays'] },
          { id: 'api', kind: 'block', at: at(0, -3.8), label: 'feed API', sub: 'ids + URLs', icon: 'Network', tint: 'violet' },
          { id: 'cdn', kind: 'cdn', at: at(0, 3.8), label: 'CDN edge', sub: '400+ locations', status: 'ok' },
          { id: 'origin', kind: 'storage', at: at(5.7, 3.8), label: 'origin store', sub: 'on a miss only' },
        ],
        links: [link('phone', 'api'), link('phone', 'cdn'), link('cdn', 'origin', { style: 'dashed' })],
        flows: [
          { path: ['phone', 'api'], tone: 'request', label: 'GET /feed', duration: 1.2 },
          { path: ['api', 'phone'], tone: 'response', label: 'URLs', duration: 1.2, delay: 1.3 },
          { path: ['cdn', 'phone'], tone: 'data', label: '2 s fragment', count: 3, duration: 1.4, delay: 2.7 },
        ],
        panel: {
          title: 'Delivery numbers',
          icon: 'Download',
          rows: [
            { text: 'Average video', value: '10 MB' },
            { text: 'Daily egress', value: '100B x 10 MB = 1 EB' },
            { text: 'Sustained', value: '~100 Tbps', tone: 'warn' },
            { text: 'Fragment length', value: '2 s', tone: 'good' },
          ],
        },
      },
    },
    {
      title: 'Feed funnel',
      tag: 'concept',
      heading: 'Pick 10 videos out of a billion in three narrowing stages',
      eli5:
        'The librarian cannot read a billion books to choose one pile. First she grabs a thousand that look right from the shelves. Then she reads those closely and keeps the best few.',
      body: [
        'Scoring a billion videos per request is impossible. So the feed is a **funnel**. **Retrieval** is cheap and wide: 1B videos down to about **1,000**. **Ranking** is heavy and precise: 1,000 down to **10**.',
        'Then **business rules** shape the final list, and the client prefetches 3 videos. Each stage trades accuracy for cost, and all of them share about **200 ms** to answer.',
      ],
      keyIdea: 'Cheap and wide first, then expensive and narrow. The funnel is how a billion videos fit inside a swipe.',
      metrics: { dau: '1.5B', qps: '1.2M/s', store: '30 PB/day', egress: '~100 Tbps', loop: 'none' },
      scene: {
        nodes: [
          { id: 'retr', kind: 'block', at: at(-5.7, 0), label: 'retrieval', sub: '1B to 1,000', icon: 'Search', tint: 'blue', size: 0.85 },
          { id: 'rank', kind: 'block', at: at(-1.9, 0), label: 'ranking', sub: '1,000 to 10', icon: 'Cpu', tint: 'violet', size: 0.85 },
          { id: 'rules', kind: 'block', at: at(1.9, 0), label: 'rules', sub: '10 to a list', icon: 'Scale', tint: 'amber', size: 0.85 },
          { ...phone, at: at(5.7, 0), label: 'viewer', sub: 'prefetch 3' },
        ],
        links: [link('retr', 'rank'), link('rank', 'rules'), link('rules', 'phone')],
        flows: [{ path: ['retr', 'rank', 'rules', 'phone'], tone: 'data', label: 'candidates', count: 2, duration: 3 }],
        panel: {
          title: 'Latency budget, about 200 ms',
          icon: 'Timer',
          rows: [
            { text: 'Embedding fetch', value: '~10 ms' },
            { text: 'Retrieval, 1B to 1,000', value: '~40 ms' },
            { text: 'Ranking, 1,000 to 10', value: '~100 ms', tone: 'warn' },
            { text: 'Rules and safety', value: '~20 ms' },
            { text: 'Network and slack', value: '~30 ms' },
            { text: 'Total', value: '~200 ms', tone: 'good' },
          ],
        },
      },
    },
    {
      title: 'Two towers',
      tag: 'concept',
      heading: 'Turn users and videos into vectors that can be compared',
      eli5:
        'The library gives every kid and every book a secret code made of numbers. Books whose codes sit close to a kid\'s code are the ones that kid tends to love.',
      body: [
        'A **two-tower model** has one neural net for users and one for videos. Each outputs an **embedding**, a vector of 256 numbers. A high **dot product** means the user probably likes the video.',
        'The user tower output is **precomputed** into the feature store and mixed with real-time signals such as the last 5 watches. Video embeddings come from content and engagement and are indexed ahead of time. Both towers are trained offline from the event log and refreshed on a regular schedule.',
      ],
      keyIdea: 'Similarity of two vectors replaces scoring every pair. All the expensive work happens before the request arrives.',
      metrics: { dau: '1.5B', qps: '1.2M/s', store: '30 PB/day', egress: '~100 Tbps', loop: 'none' },
      scene: {
        nodes: [
          { id: 'fstore', kind: 'cache', at: at(-5.7, 0), label: 'feature store', sub: 'user + last 5 watches' },
          { id: 'ut', kind: 'block', at: at(-1.4, -3.4), label: 'user tower', sub: '256-dim', icon: 'User', tint: 'blue', size: 0.85 },
          { id: 'vt', kind: 'block', at: at(-1.4, 3.4), label: 'video tower', sub: '256-dim', icon: 'Layers', tint: 'green', size: 0.85 },
          { id: 'match', kind: 'block', at: at(3.6, 0), label: 'dot product', sub: 'closer = better', icon: 'Binary', tint: 'violet', size: 0.85 },
        ],
        links: [link('fstore', 'ut'), link('ut', 'match', { label: 'user_emb' }), link('vt', 'match', { label: 'video_emb' })],
        flows: [
          { path: ['fstore', 'ut', 'match'], tone: 'data', duration: 2 },
          { path: ['vt', 'match'], tone: 'data', duration: 1.4, delay: 0.6 },
        ],
        panel: {
          title: 'Score',
          icon: 'Binary',
          code: 'u = user_tower(user_features)\nv = video_tower(video_features)\n\nscore = dot(u, v)\n# 256 floats each',
        },
      },
      code: {
        language: 'python',
        title: 'A two-tower score in a few lines',
        source: `import numpy as np

def embed(tower, features):
    return tower(features)          # 256 floats

user_emb  = embed(user_tower, user_feats)      # computed ahead, then mixed
video_emb = video_index[video_id]              # precomputed per video

score = float(np.dot(user_emb, video_emb))     # higher = more similar`,
        highlight: [4, 6, 7, 9],
      },
    },
    {
      title: 'Retrieval',
      tag: 'concept',
      heading: 'Nearest neighbor search finds 1,000 candidates fast',
      eli5:
        'The librarian does not compare your code to every book. The shelves are sorted into neighborhoods, so she walks to the right one and picks the closest books there.',
      body: [
        'With 1B video embeddings, an exact search is far too slow. **Approximate nearest neighbor** indexes such as **ScaNN** or **HNSW** return very close matches in milliseconds, at the price of occasionally missing the true best.',
        'The same stage mixes in other sources: **trending near me**, **same creator** and **music match**. Together they return the top **1,000 candidates**.',
      ],
      keyIdea: 'ANN trades a little recall for a lot of speed. Extra candidate sources keep the pool varied.',
      metrics: { dau: '1.5B', qps: '1.2M/s', store: '30 PB/day', egress: '~100 Tbps', loop: 'none' },
      scene: {
        nodes: [
          { id: 'emb', kind: 'block', at: at(-5.7, 0), label: 'user embedding', sub: '256-dim', icon: 'User', tint: 'blue', size: 0.85 },
          { id: 'ann', kind: 'search', at: at(-2.9, -3.8), label: 'ANN index', sub: '1B video vectors' },
          { id: 'src', kind: 'block', at: at(-1.0, 3.8), label: 'other sources', sub: 'trending, creator, music', icon: 'TrendingUp', tint: 'amber', size: 0.85 },
          { id: 'cand', kind: 'block', at: at(3.2, 0), label: 'candidates', sub: 'top 1,000', icon: 'List', tint: 'green', size: 0.85 },
        ],
        links: [link('emb', 'ann'), link('emb', 'src'), link('ann', 'cand'), link('src', 'cand')],
        flows: [
          { path: ['emb', 'ann', 'cand'], tone: 'request', label: 'nearest 800', duration: 2 },
          { path: ['emb', 'src', 'cand'], tone: 'request', label: '200 more', duration: 2, delay: 0.5 },
        ],
        panel: {
          title: 'Why approximate',
          icon: 'Search',
          rows: [
            { text: 'Exact over 1B', value: 'seconds', tone: 'bad' },
            { text: 'ANN (ScaNN, HNSW)', value: 'milliseconds', tone: 'good' },
            { text: 'Cost', value: 'rare missed best', tone: 'warn' },
            { text: 'Output', value: '1,000 candidates' },
          ],
        },
      },
    },
    {
      title: 'Ranking',
      tag: 'concept',
      heading: 'A heavy model scores 1,000 candidates for this user',
      eli5:
        'Now the librarian reads the thousand books properly. She guesses for each one whether you will finish it, giggle at it, show a friend or put it down, and keeps the best ten.',
      body: [
        'The **ranker** is a heavy model (a DLRM or Transformer) that sees user, video and context features together. It predicts `P(watch)`, `P(like)`, `P(comment)`, `P(share)` and `P(skip)`.',
        'A **utility score** weighs those into one number and the top 10 win. 1,000 candidates at 1.2M requests a second is **1.2B predictions per second**. That takes batched GPU inference and cached features.',
      ],
      keyIdea: 'Ranking is where compute goes. It can afford rich features because it only sees 1,000 candidates, scored in batches on GPUs.',
      metrics: { dau: '1.5B', qps: '1.2M/s', store: '30 PB/day', egress: '~100 Tbps', loop: 'none' },
      metricTones: { qps: 'warn' },
      scene: {
        nodes: [
          { id: 'cand', kind: 'block', at: at(-5.7, 0), label: 'candidates', sub: 'top 1,000', icon: 'List', tint: 'green', size: 0.85 },
          { id: 'rank', kind: 'worker', at: at(-1.2, -3.2), label: 'ranker', sub: 'GPU fleet', status: 'active', load: 78 },
          { id: 'fstore', kind: 'cache', at: at(-1.2, 3.4), label: 'feature store', sub: 'user + video + context' },
          { id: 'top', kind: 'block', at: at(3.6, 0), label: 'top 10', sub: 'by utility', icon: 'Star', tint: 'violet', size: 0.85 },
        ],
        links: [link('cand', 'rank'), link('fstore', 'rank'), link('rank', 'top')],
        flows: [
          { path: ['cand', 'rank'], tone: 'request', label: '1,000', duration: 1.4 },
          { path: ['fstore', 'rank'], tone: 'data', label: 'features', duration: 1.4, delay: 0.3 },
          { path: ['rank', 'top'], tone: 'response', label: '10', duration: 1.4, delay: 1.7 },
        ],
        panel: {
          title: 'Predicted per video',
          icon: 'Cpu',
          rows: [
            { text: 'P(watch to end)', value: '0.62', tone: 'good' },
            { text: 'P(like)', value: '0.08' },
            { text: 'P(comment)', value: '0.01' },
            { text: 'P(share)', value: '0.02' },
            { text: 'P(skip)', value: '0.21', tone: 'warn' },
          ],
          footer: { text: 'Illustrative numbers. Weighted into one utility score', tone: 'muted' },
        },
      },
    },
    {
      title: 'Rules',
      tag: 'concept',
      heading: 'Business rules shape the final ten',
      eli5:
        'Before the pile goes to the kid, a helper checks it. No two books by the same author in a row, a sticker book slipped in now and then, and nothing too scary.',
      body: [
        'The model picks by predicted engagement, and engagement alone makes a boring feed. The last stage applies rules: **no same creator twice in a row**, **an ad every 4 or 5 videos** and a final **safety filter**.',
        'Rules are simple code, not models, so product and policy teams can change them in minutes. The result is the list of 10 that `GET /feed` returns.',
      ],
      keyIdea: 'Rules fix what a score cannot see: variety, ads and policy. They are cheap to change.',
      metrics: { dau: '1.5B', qps: '1.2M/s', store: '30 PB/day', egress: '~100 Tbps', loop: 'none' },
      scene: {
        nodes: [
          { id: 'top', kind: 'block', at: at(-5.7, 0), label: 'top 10', sub: 'by utility', icon: 'Star', tint: 'violet', size: 0.85 },
          { id: 'rules', kind: 'block', at: at(-1.9, 0), label: 'rules', sub: 'diversity, ads', icon: 'Scale', tint: 'amber', size: 0.85 },
          { id: 'ads', kind: 'block', at: at(2.6, -3.4), label: 'ad server', sub: 'every 4-5 videos', icon: 'Receipt', tint: 'teal', size: 0.8 },
          { id: 'safe', kind: 'block', at: at(2.6, 3.4), label: 'safety filter', sub: 'status check', icon: 'Shield', tint: 'red', size: 0.8 },
        ],
        links: [link('top', 'rules'), link('ads', 'rules'), link('safe', 'rules')],
        flows: [
          { path: ['top', 'rules'], tone: 'data', label: '10', duration: 1.3 },
          { path: ['ads', 'rules'], tone: 'event', label: 'ad slot', duration: 1.3, delay: 1.4 },
          { path: ['safe', 'rules'], tone: 'event', label: 'drop flagged', duration: 1.3, delay: 2.8 },
        ],
        panel: {
          title: 'Final pass',
          icon: 'Scale',
          rows: [
            { text: 'Same creator twice', value: 'spaced out' },
            { text: 'Ads', value: 'every 4 to 5', tone: 'warn' },
            { text: 'Flagged video', value: 'removed', tone: 'bad' },
          ],
        },
      },
    },
    {
      title: 'Tradeoffs',
      tag: 'tradeoff',
      heading: 'Every strength in this feed has a cost',
      eli5:
        'A librarian who guesses well, grabs books early and learns fast is wonderful. She also wastes some trips, and she may keep handing you only the kind of book you already like.',
      body: [
        'The **two-tower retrieval plus ranker** scales to 1B candidates, but the retriever and ranker optimize different goals, so a video retrieval misses is never ranked.',
        '**Heavy prefetch** wastes bandwidth on skipped videos, and a **fast feedback loop** risks a **filter bubble**.',
      ],
      keyIdea: 'Scaling, smoothness and personalization are each bought with bias, waste or a wellbeing risk.',
      metrics: { dau: '1.5B', qps: '1.2M/s', store: '30 PB/day', egress: '~100 Tbps', loop: 'none' },
      scene: {
        nodes: [
          { id: 'retr', kind: 'block', at: at(-3.8, 0), label: 'retrieval', sub: 'cheap, wide', icon: 'Search', tint: 'blue', size: 0.85, chips: [{ text: 'misses some', tone: 'warn' }] },
          { id: 'rank', kind: 'block', at: at(0, 0), label: 'ranker', sub: 'heavy, precise', icon: 'Cpu', tint: 'violet', size: 0.85, chips: [{ text: 'prefetch 3, some wasted', tone: 'warn' }] },
          { ...phone, at: at(3.8, 0), label: 'viewer', sub: 'sees what you like', chips: [{ text: 'filter bubble', tone: 'warn' }] },
        ],
        links: [link('retr', 'rank'), link('rank', 'phone')],
        flows: [{ path: ['retr', 'rank', 'phone'], tone: 'data', duration: 2.6 }],
        panel: {
          title: 'Choice, pro and con',
          icon: 'Scale',
          rows: [
            { text: 'Two-tower + ranker', value: 'scales, but biased', tone: 'warn' },
            { text: 'Heavy prefetch', value: 'smooth, wastes data', tone: 'warn' },
            { text: 'Fast signal loop', value: 'sharp, bubble risk', tone: 'warn' },
          ],
        },
      },
      quiz: {
        question: 'Why is the feed a funnel (retrieval, then ranking) and not a single heavy model over every video?',
        options: [
          'The heavy model cannot be trained on that many videos',
          'Scoring a billion videos per request is far too costly, so a cheap stage cuts it to about 1,000 first',
          'Retrieval gives more accurate scores than ranking',
        ],
        answer: 1,
        explain: 'At 1.2M requests a second, running a heavy model on 1B videos each time is impossible. Cheap retrieval narrows the field so the expensive ranker only sees about 1,000.',
      },
    },
    {
      title: 'Feedback loop',
      tag: 'concept',
      heading: 'A skip at 0.5 seconds shapes your next swipe',
      eli5:
        'When you frown at a book, the librarian scribbles it on a sticky note, and the note reaches her desk before you finish the page. Your next pile already knows.',
      body: [
        'The client sends the event to an ingest topic in **Kafka** within about 100 ms. **Flink**, keyed by `user_id`, joins it with video features and updates a "recent activity" vector in the **feature store** (see the stream processing lesson).',
        'The next `GET /feed` reads fresh features. Action to influence takes **under 5 seconds**. Batch jobs still refresh the big model.',
        'Each view emits several events, so the topic carries **1.2M+ events per second**.'
      ],
      keyIdea: 'Events stream into features within seconds, so the very next feed already reflects what you just did.',
      metrics: { dau: '1.5B', qps: '1.2M/s', store: '30 PB/day', egress: '~100 Tbps', loop: '< 5 s' },
      metricTones: { loop: 'good' },
      scene: {
        nodes: [
          { ...phone, at: at(-3.8, 0), chips: ['skip at 0.5 s'] },
          { id: 'kafka', kind: 'queue', at: at(0, -3.6), label: 'Kafka', sub: 'event topic' },
          { id: 'flink', kind: 'worker', at: at(3.8, 0), label: 'Flink', sub: 'keyed by user_id', status: 'active' },
          { id: 'fstore', kind: 'cache', at: at(0, 3.6), label: 'feature store', sub: 'Redis + files on S3' },
        ],
        links: [link('phone', 'kafka', { label: '100 ms' }), link('kafka', 'flink'), link('flink', 'fstore'), link('fstore', 'phone', { label: 'next feed' })],
        flows: [
          { path: ['phone', 'kafka'], tone: 'event', label: 'skip', duration: 1.1 },
          { path: ['kafka', 'flink'], tone: 'event', duration: 1.1, delay: 1.2 },
          { path: ['flink', 'fstore'], tone: 'data', label: 'update', duration: 1.1, delay: 2.4 },
          { path: ['fstore', 'phone'], tone: 'response', label: 'fresh', duration: 1.1, delay: 3.6 },
        ],
        panel: {
          title: 'Loop latency',
          icon: 'Timer',
          rows: [
            { text: 'Client to Kafka', value: '~100 ms' },
            { text: 'Join in Flink', value: 'seconds' },
            { text: 'Feature store updated', value: '< 5 s', tone: 'good' },
            { text: 'Typical batch recommender', value: 'hours', tone: 'bad' },
          ],
        },
      },
      code: {
        language: 'json',
        title: 'A skip event on the wire',
        source: `{
  "user_id": 8812,
  "video_id": "v81",
  "action": "skip",
  "watched_ms": 500,
  "duration_ms": 18000,
  "ts": 1760000000123
}`,
        highlight: [3, 4],
      },
    },
    {
      title: 'New user',
      tag: 'case',
      heading: 'A brand new user has no history to learn from',
      eli5:
        'A kid who has never visited gets the books the whole neighborhood likes. After a few visits the librarian has seen enough to start guessing for just that kid.',
      body: [
        'With no embedding yet, the feed starts from **location-based trending** and **popular templates**. Every watch, skip and replay is a strong signal early on.',
        'After about **20 watches**, the user embedding converges and personal retrieval takes over. The first 20 videos are the most valuable of the whole lifetime.',
      ],
      keyIdea: 'Start from what is popular nearby, then hand over to personal signals as the history grows.',
      metrics: { dau: '1.5B', qps: '1.2M/s', store: '30 PB/day', egress: '~100 Tbps', loop: '< 5 s' },
      scene: {
        nodes: [
          { ...phone, at: at(-5.7, 0), label: 'new user', sub: 'no history', chips: [{ text: '0 watches', tone: 'warn' }] },
          { id: 'trend', kind: 'block', at: at(-1.9, 0), label: 'local trending', sub: 'region + templates', icon: 'TrendingUp', tint: 'amber', size: 0.85 },
          { id: 'emb', kind: 'block', at: at(1.9, 0), label: 'user embedding', sub: 'forming', icon: 'User', tint: 'blue', size: 0.85, chips: [{ text: '7 of 20 watches', tone: 'warn' }] },
          { id: 'pers', kind: 'block', at: at(5.7, 0), label: 'personal feed', sub: 'after about 20', icon: 'Star', tint: 'green', size: 0.85, status: 'dim' },
        ],
        links: [link('phone', 'trend'), link('phone', 'emb', { style: 'faint', route: 'straight' }), link('emb', 'pers', { style: 'dashed' })],
        flows: [
          { path: ['trend', 'phone'], tone: 'response', label: 'popular here', duration: 1.6 },
          { path: ['phone', 'emb'], tone: 'event', label: 'watches', count: 3, duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'Cold start ladder',
          icon: 'Layers',
          rows: [
            { text: '0 watches', value: 'local trending' },
            { text: 'About 5', value: 'trending + rough taste', tone: 'warn' },
            { text: 'About 20', value: 'embedding converges', tone: 'good' },
          ],
        },
      },
    },
    {
      title: 'New video',
      tag: 'case',
      heading: 'A new video has no views, yet it must find an audience',
      eli5:
        'A brand new book has no readers yet. The librarian guesses its type from the cover and words, shows it to 200 kids, and if they love it she shows it to many more.',
      body: [
        'A **content embedding** built from visuals, audio, caption, OCR text and creator features gives the video a starting spot in embedding space, so it can be retrieved on day zero.',
        'Then **traffic-shaped rollout**: show it to 200 random users and measure completion rate. If high, expand to 2K, then 20K, and so on. A creator with 0 followers can go viral in about 6 hours.',
      ],
      keyIdea: 'Place a new video by its content, then let real viewers vote in widening rings.',
      metrics: { dau: '1.5B', qps: '1.2M/s', store: '30 PB/day', egress: '~100 Tbps', loop: '< 5 s' },
      scene: {
        nodes: [
          { id: 'vid', kind: 'block', at: at(-5.7, 0), label: 'new video', sub: 'content embedding', icon: 'Layers', tint: 'green', size: 0.85 },
          { id: 'pilot', kind: 'user', at: at(-1.9, 0), label: 'pilot group', sub: '200 users', chips: ['completion 78%'] },
          { id: 'mon', kind: 'monitor', at: at(1.9, 0), label: 'completion rate', sub: 'watch to end' },
          { id: 'wide', kind: 'user', at: at(5.7, 0), label: 'wider ring', sub: '2K, then 20K', status: 'ok' },
        ],
        links: [link('vid', 'pilot'), link('pilot', 'mon'), link('mon', 'wide', { label: 'if high' })],
        flows: [
          { path: ['vid', 'pilot'], tone: 'data', label: '200 views', duration: 1.3 },
          { path: ['pilot', 'mon'], tone: 'event', label: 'completion', duration: 1.3, delay: 1.4 },
          { path: ['mon', 'wide'], tone: 'response', label: 'expand', duration: 1.3, delay: 2.8 },
        ],
        panel: {
          title: 'Rollout rings',
          icon: 'TrendingUp',
          rows: [
            { text: 'Ring 1', value: '200 viewers' },
            { text: 'Ring 2 (if completion high)', value: '2K viewers', tone: 'good' },
            { text: 'Ring 3', value: '20K viewers', tone: 'good' },
            { text: 'Completion low', value: 'stop growing', tone: 'warn' },
          ],
        },
      },
    },
    {
      title: 'Prefetch',
      tag: 'concept',
      heading: 'Load the next three videos before the swipe',
      eli5:
        'While you read one book, a helper quietly slides the next three into your bag. When you finish, the next one is already in your hands.',
      body: [
        'The client plays video 1 and **prefetches the next 3** in the background, at least their first fragments. A swipe lands on bytes already in memory, so the user sees **no buffering**.',
        'The price is wasted data for skipped videos, which matters on metered phone plans. Many apps limit prefetch on weak or costly connections.',
      ],
      keyIdea: 'Hide network latency by spending bandwidth. Tune how far ahead to fetch to the connection.',
      metrics: { dau: '1.5B', qps: '1.2M/s', store: '30 PB/day', egress: '~100 Tbps', loop: '< 5 s' },
      metricTones: { egress: 'warn' },
      scene: {
        nodes: [
          { ...phone, at: at(-5.7, 0), chips: [{ text: 'playing #1', tone: 'good' }, 'ready #2', 'ready #3', 'loading #4'] },
          { id: 'api', kind: 'block', at: at(0, -3.8), label: 'feed API', sub: '10 ids + URLs', icon: 'Network', tint: 'violet', size: 0.85 },
          { id: 'cdn', kind: 'cdn', at: at(0, 3.8), label: 'CDN edge', sub: 'nearest of 400+' },
        ],
        links: [link('phone', 'api'), link('phone', 'cdn')],
        flows: [
          { path: ['phone', 'api'], tone: 'request', label: 'GET /feed', duration: 1.1 },
          { path: ['api', 'phone'], tone: 'response', label: 'URLs', duration: 1.1, delay: 1.2 },
          { path: ['cdn', 'phone'], tone: 'data', label: '#2, #3, #4', count: 3, duration: 1.5, delay: 2.5 },
        ],
        panel: {
          title: 'Prefetch tradeoff',
          icon: 'Download',
          rows: [
            { text: 'Swipe wait', value: '~0 ms', tone: 'good' },
            { text: 'Videos prefetched', value: '3' },
            { text: 'Skipped before play', value: 'data wasted', tone: 'warn' },
          ],
        },
      },
    },
    {
      title: 'Counters',
      tag: 'concept',
      heading: 'Likes, shares and creator analytics ride the same event stream',
      eli5:
        'Every time a kid claps for a book, a helper adds a tally mark. At closing time the authors get a full report from the same tally notes.',
      body: [
        'A popular video takes thousands of likes a second, a hot row. Events land in the log, and a stream job **batches them into counters** so the database sees few large updates (see the hot key ideas in the sharding lesson).',
        'The same stream also lands in a **warehouse** for **creator analytics**, views by hour and audience, and for payout and monetization (see the data warehouse lesson). One log feeds three uses.',
      ],
      keyIdea: 'Write once to the event log and let counters, analytics and training all read from it.',
      metrics: { dau: '1.5B', qps: '1.2M/s', store: '30 PB/day', egress: '~100 Tbps', loop: '< 5 s' },
      scene: {
        nodes: [
          { ...phone, at: at(-5.7, 0), chips: ['like', 'share'] },
          { id: 'log', kind: 'queue', at: at(-1.9, 0), label: 'event log', sub: 'likes, watches' },
          { id: 'cnt', kind: 'cache', at: at(2.6, -3.4), label: 'counters', sub: 'batched writes' },
          { id: 'wh', kind: 'warehouse', at: at(2.6, 3.4), label: 'warehouse', sub: 'creator analytics' },
        ],
        links: [link('phone', 'log'), link('log', 'cnt'), link('log', 'wh')],
        flows: [
          { path: ['phone', 'log'], tone: 'event', label: 'like', count: 3, duration: 1.3 },
          { path: ['log', 'cnt'], tone: 'data', label: '+4,200', duration: 1.3, delay: 1.5 },
          { path: ['log', 'wh'], tone: 'data', label: 'hourly', duration: 1.3, delay: 2.9 },
        ],
        panel: {
          title: 'One log, three readers',
          icon: 'Inbox',
          rows: [
            { text: 'Counters', value: 'likes, shares' },
            { text: 'Creator analytics', value: 'views, audience' },
            { text: 'Model training', value: 'watch signals' },
          ],
        },
      },
    },
    {
      title: 'Feature outage',
      tag: 'case',
      heading: 'The feature store goes down mid-evening',
      eli5:
        'The librarian\'s notebook of what every kid likes falls in the lake. She still has to hand out books, so she gives each kid a pile that is popular in town instead of one made just for them.',
      body: [
        'Without features the ranker cannot score, and `GET /feed` would error for everyone. A **timeout** and a **circuit breaker** stop slow requests piling up.',
        'The API **degrades**: serve a cached list of **region-popular videos** plus the last feed the user saw. The feed is less personal, but never empty. Replicas bring the store back (see the failover lesson).',
      ],
      keyIdea: 'A less personal feed is better than no feed. Design the fallback before the outage.',
      metrics: { dau: '1.5B', qps: '1.2M/s', store: '30 PB/day', egress: '~100 Tbps', loop: 'stale' },
      metricTones: { loop: 'bad' },
      scene: {
        nodes: [
          { id: 'api', kind: 'block', at: at(-5.7, 0), label: 'feed API', sub: 'circuit breaker', icon: 'Network', tint: 'violet', size: 0.85, status: 'active' },
          { id: 'fstore', kind: 'cache', at: at(-0.4, -3.6), label: 'feature store', sub: 'unreachable', status: 'down' },
          { id: 'pop', kind: 'cache', at: at(-0.4, 3.6), label: 'popular cache', sub: 'by region', status: 'ok' },
          { ...phone, at: at(4.6, 0), sub: 'still scrolling', chips: [{ text: 'generic feed', tone: 'warn' }] },
        ],
        links: [link('api', 'fstore'), link('api', 'pop'), link('api', 'phone')],
        flows: [
          { path: ['api', 'fstore'], tone: 'error', label: 'timeout', duration: 1.3 },
          { path: ['api', 'pop'], tone: 'request', label: 'fallback', duration: 1.2, delay: 1.5 },
          { path: ['pop', 'api', 'phone'], tone: 'response', label: 'popular 10', duration: 1.8, delay: 2.8 },
        ],
        panel: {
          title: 'Degrade, do not fail',
          icon: 'Shield',
          rows: [
            { text: 'Feature store', value: 'down', tone: 'bad' },
            { text: 'Feed requests', value: 'still served', tone: 'good' },
            { text: 'Personalization', value: 'reduced', tone: 'warn' },
          ],
        },
      },
    },
    {
      title: 'Viral spike',
      tag: 'case',
      heading: 'One video goes viral and every viewer asks for it at once',
      eli5:
        'Suddenly every kid in town wants the same book, and all of them run to the one corner box that does not have it yet. One call to the main library should be enough for everybody.',
      body: [
        'A new hit is not in any edge cache yet, so many viewers miss at once and all ask the origin for the same fragment: a **thundering herd**. The origin store gets hammered.',
        '**Request collapsing** at the edge sends one origin fetch per fragment while others wait for it. A middle **shield cache** adds a layer, so only a few requests ever reach the origin (see the CDN lesson).',
      ],
      keyIdea: 'Collapse duplicate misses at the edge and add a shield layer so one hot video cannot flatten the origin.',
      metrics: { dau: '1.5B', qps: '1.2M/s', store: '30 PB/day', egress: '~100 Tbps', loop: '< 5 s' },
      metricTones: { egress: 'warn' },
      scene: {
        nodes: [
          { id: 'users', kind: 'user', at: at(-5.7, 0), label: 'viewers', sub: 'millions at once', chips: [{ text: 'GET seg0', tone: 'warn' }] },
          { id: 'edge', kind: 'cdn', at: at(-1.9, 0), label: 'CDN edge', sub: 'collapses misses', status: 'hot', load: 88 },
          { id: 'shield', kind: 'cache', at: at(1.9, 0), label: 'shield cache', sub: 'regional' },
          { id: 'origin', kind: 'storage', at: at(5.7, 0), label: 'origin store', sub: '1 fetch per fragment', status: 'ok' },
        ],
        links: [link('users', 'edge'), link('edge', 'shield'), link('shield', 'origin')],
        flows: [
          { path: ['users', 'edge'], tone: 'request', label: 'millions', count: 4, duration: 1.2 },
          { path: ['edge', 'shield', 'origin'], tone: 'request', label: '1', duration: 1.6, delay: 1.3 },
          { path: ['origin', 'shield', 'edge', 'users'], tone: 'data', label: 'fragment', duration: 2.2, delay: 3 },
        ],
        panel: {
          title: 'Requests reaching each layer',
          icon: 'Layers',
          rows: [
            { text: 'Viewers asking', value: 'millions' },
            { text: 'Edge to shield', value: 'one per location', tone: 'good' },
            { text: 'Shield to origin', value: 'one per fragment', tone: 'good' },
          ],
        },
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'The whole design on one page',
      eli5:
        'The library has a back-room copy machine, a helper that checks new books, little book boxes on every corner, and a librarian who picks your pile and learns from every frown in seconds.',
      body: [
        'Creators upload straight to object storage. A queue feeds **transcoders** (15 assets per video), **moderation** gates publishing, and a **CDN** serves 2 second fragments at about 100 Tbps.',
        'The feed is a **funnel**: ANN retrieval to 1,000, a heavy ranker to 10, rules to the final list. A **Kafka and Flink loop** refreshes features in under 5 seconds, and fallbacks keep the feed alive.',
      ],
      keyIdea: 'Bytes on a CDN, work behind queues, a three-stage funnel for choice, and a stream loop for freshness.',
      metrics: { dau: '1.5B', qps: '1.2M/s', store: '30 PB/day', egress: '~100 Tbps', loop: '< 5 s' },
      metricTones: { loop: 'good' },
      scene: {
        nodes: [
          { ...phone, at: at(-5.7, 0), sub: 'swiping' },
          { id: 'feed', kind: 'block', at: at(-1.9, -3.4), label: 'feed funnel', sub: '1B to 10', icon: 'Rss', tint: 'violet', size: 0.85 },
          { id: 'loop', kind: 'worker', at: at(-1.9, 3.4), label: 'stream loop', sub: 'Kafka + Flink' },
          { id: 'cdn', kind: 'cdn', at: at(3.2, 0), label: 'CDN', sub: '2 s fragments', status: 'ok' },
        ],
        links: [link('phone', 'feed'), link('phone', 'loop'), link('phone', 'cdn', { style: 'dashed' })],
        flows: [
          { path: ['phone', 'feed'], tone: 'request', label: 'GET /feed', duration: 1.2 },
          { path: ['phone', 'loop'], tone: 'event', label: 'events', duration: 1.2, delay: 1.3 },
          { path: ['cdn', 'phone'], tone: 'data', label: 'video', duration: 1.4, delay: 2.6 },
        ],
        panel: {
          title: 'Design recap',
          icon: 'Table',
          rows: [
            { text: 'Upload', value: 'pre-signed, queued' },
            { text: 'Storage', value: '15 assets, 75 MB' },
            { text: 'Feed', value: '1B > 1,000 > 10' },
            { text: 'Freshness', value: '< 5 s', tone: 'good' },
            { text: 'Failure', value: 'popular fallback', tone: 'good' },
          ],
        },
      },
      quiz: {
        question: 'A user skips three videos in a row. Which part of the design lets the very next feed reflect that?',
        options: [
          'A nightly batch job retrains the model',
          'Skip events stream through Kafka and Flink into the feature store within seconds',
          'The CDN edge caches a different video list',
        ],
        answer: 1,
        explain: 'Events go to Kafka, Flink updates the user\'s recent-activity features, and the next feed reads them. A batch job would leave the feed hours stale.',
      },
    },
  ],
};
