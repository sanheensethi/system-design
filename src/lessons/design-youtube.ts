import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const creator: SceneNode = { id: 'creator', kind: 'phone', at: at(-4.5, 0), label: 'creator', sub: '400 MB video' };
const viewer: SceneNode = { id: 'viewer', kind: 'client', at: at(4.5, -3), label: 'viewer', sub: 'laptop, 8 Mbps' };
const rider: SceneNode = { id: 'rider', kind: 'phone', at: at(4.5, 3), label: 'phone viewer', sub: 'on a train' };
const svc: SceneNode = { id: 'svc', kind: 'block', at: at(0, 0), label: 'video service', sub: 'to be designed', icon: 'Globe', tint: 'violet' };
const api: SceneNode = { id: 'api', kind: 'block', at: at(0, -3.6), label: 'API servers', sub: 'stateless', icon: 'Network', tint: 'violet' };
const db: SceneNode = { id: 'db', kind: 'db', at: at(4.5, -3.6), label: 'metadata DB', sub: 'SQL + replicas' };
const raw: SceneNode = { id: 'raw', kind: 'storage', at: at(0, 3.6), label: 'raw bucket', sub: 'object storage' };
const mono: SceneNode = { id: 'mono', kind: 'server', at: at(0, 0), label: 'video server', sub: 'disk + MySQL' };

const metrics = [
  { key: 'plays', label: 'Peak plays', icon: 'Activity' },
  { key: 'uploads', label: 'Peak uploads', icon: 'Download' },
  { key: 'storage', label: 'New storage', icon: 'HardDrive' },
  { key: 'egress', label: 'Egress', icon: 'Signal' },
  { key: 'ready', label: 'Upload to ready', icon: 'Timer' },
];

export const designYoutube: Lesson = {
  id: 'design-youtube',
  title: 'Design YouTube (part 1)',
  tagline: 'Take a 400 MB phone video in, split it into small tasks and turn it into five streamable qualities in two minutes.',
  minutes: 16,
  level: 'Advanced',
  learn: [
    'Scale numbers, the API and the data model for a video platform',
    'Why one server cannot take uploads, encode and serve playback',
    'Uploads through pre-signed URLs, in resumable parts, straight to object storage',
    'Containers, codecs and why every video must be transcoded',
    'The transcoding pipeline as a DAG of small tasks spread over a worker pool, and how to size the fleet',
  ],
  metrics,
  steps: [
    {
      title: 'Requirements',
      tag: 'problem',
      heading: 'Two flows, very different sizes',
      eli5: 'A bakery takes giant cakes from bakers and sells slices to a whole city. The **video service** is that bakery: few cakes come in, millions of slices go out.',
      body: [
        'Scope it to the two flows that matter: a creator **uploads** a video, and viewers **watch** it on phones, laptops and TVs, anywhere in the world. Comments, likes, search and recommendations are out of scope.',
        'Targets: a new video is playable within **5 minutes** of upload, playback starts in under 2 seconds, and nothing a creator uploads is ever lost.',
      ],
      keyIdea: 'A video platform is two flows, upload and watch, with very different sizes and very different goals.',
      metrics: { plays: '?', uploads: '?', storage: '?', egress: '?', ready: 'target < 5 min' },
      metricTones: { ready: 'good' },
      scene: {
        nodes: [{ ...creator, status: 'active', chips: ['upload 400 MB'] }, { ...svc, badge: '?' }, { ...viewer, chips: ['play'] }, rider],
        links: [link('creator', 'svc'), link('svc', 'viewer'), link('svc', 'rider')],
        flows: [
          { path: ['creator', 'svc'], tone: 'request', label: '400 MB', duration: 2.4 },
          { path: ['svc', 'viewer'], tone: 'response', count: 4, duration: 1.2, delay: 0.6 },
          { path: ['svc', 'rider'], tone: 'response', count: 4, duration: 1.2, delay: 1 },
        ],
        panel: {
          title: 'Targets',
          icon: 'Gauge',
          rows: [
            { text: 'Playable after upload', value: '< 5 min', tone: 'good' },
            { text: 'Playback start', value: '< 2 s', tone: 'good' },
            { text: 'Uploaded video lost', value: 'never', tone: 'good' },
            { text: 'Out of scope', value: 'comments, likes, search', tone: 'muted' },
          ],
        },
        caption: 'One small write path, one giant read path',
      },
    },
    {
      title: 'Napkin math',
      tag: 'concept',
      heading: 'Writes are small in count and huge in bytes',
      eli5: 'The bakery gets 100,000 giant cakes a day but sells 120 million slices. Most of the work is carrying slices out the door.',
      body: [
        'Assume **20 million daily viewers** watching 6 videos each, and **100,000 uploads a day** averaging 400 MB (about five minutes of phone video). Plays: 120 million a day, about 1,400 per second, so **3,000 per second at peak**. Uploads: just over 1 per second, 3 at peak.',
        'Raw storage: 100,000 x 400 MB = **40 TB a day** before any copies. If every play sends the whole 190 MB file, egress is 120 million x 190 MB, about **23 PB a day**, roughly 2 Tbps around the clock. Bytes out dominate the cost.',
      ],
      keyIdea: 'Writes are few and large, reads are bytes out to the whole planet, and the bytes out dominate the cost.',
      metrics: { plays: '3,000/s', uploads: '3/s', storage: '40 TB/day raw', egress: '23 PB/day', ready: 'target < 5 min' },
      metricTones: { egress: 'bad', storage: 'warn' },
      scene: {
        nodes: [{ ...creator, badge: '100K uploads/day' }, svc, { ...viewer, badge: '120M plays/day' }],
        links: [link('creator', 'svc'), link('svc', 'viewer')],
        flows: [
          { path: ['creator', 'svc'], tone: 'request', label: '40 TB/day in', duration: 2 },
          { path: ['svc', 'viewer'], tone: 'response', label: '23 PB/day out', count: 4, duration: 1.2, delay: 1 },
        ],
        panel: {
          title: 'Napkin math',
          icon: 'Table',
          rows: [
            { text: 'Plays: 120M / 86,400 s', value: '1,400/s' },
            { text: 'Peak plays', value: '3,000/s' },
            { text: 'Uploads: 100K x 400 MB', value: '40 TB/day' },
            { text: 'Egress: 120M x 190 MB', value: '23 PB/day', tone: 'bad' },
          ],
          footer: { text: 'Roughly 2 Tbps out, around the clock', tone: 'warn' },
        },
        caption: 'About 575 times more bytes out than in',
      },
    },
    {
      title: 'The API',
      tag: 'concept',
      heading: 'Three upload calls and one watch call',
      eli5: 'The baker fills out a small order slip at the front desk. The slip says where to drop the cake. The cake itself never goes through the desk.',
      body: [
        'Uploads take three calls. `POST /v1/videos` creates the video row and returns where to send the bytes. The client sends the bytes. `POST /v1/videos/{id}/complete` says it is done.',
        'Watching takes one: `GET /v1/videos/{id}` returns the title, the status and a **manifest URL** the player streams from. The video bytes never go through this API, as you will see.',
      ],
      keyIdea: 'The API moves small JSON. Video bytes take another road.',
      metrics: { plays: '3,000/s', uploads: '3/s', storage: '40 TB/day raw', egress: '23 PB/day', ready: 'target < 5 min' },
      scene: {
        nodes: [creator, { ...api, status: 'active', chips: ['POST /v1/videos'] }, { ...db, badge: 'status column' }, { ...viewer, at: at(0, 3.6), chips: ['GET /v1/videos/42'] }],
        links: [link('creator', 'api'), link('api', 'db'), link('viewer', 'api', { style: 'dashed' })],
        flows: [
          { path: ['creator', 'api'], tone: 'request', label: 'POST /videos', duration: 1.2 },
          { path: ['api', 'db'], tone: 'request', label: 'INSERT uploading', duration: 0.9, delay: 1.3 },
          { path: ['viewer', 'api'], tone: 'request', label: 'GET /videos/42', duration: 1.4, delay: 2.4 },
          { path: ['api', 'viewer'], tone: 'response', label: 'manifest URL', duration: 1.4, delay: 3.9 },
        ],
        panel: {
          title: 'The whole API',
          icon: 'Code',
          code: 'POST /v1/videos            create row\nPUT  <signed url>          send bytes\nPOST /v1/videos/{id}/complete\nGET  /v1/videos/{id}       status + manifest',
        },
        caption: 'The API moves metadata, and bytes take another road',
      },
    },
    {
      title: 'Data model',
      tag: 'concept',
      heading: 'Small metadata in SQL, big blobs in object storage',
      eli5: 'The order book holds short notes about each cake. The cakes themselves sit in the warehouse, and each note says which shelf. The book is the **metadata database**.',
      body: [
        '**Metadata** (title, owner, status, duration, which qualities exist) is small, structured and read constantly, so it lives in a SQL database. **Blobs** (the original file, the encoded segments, thumbnails) are huge and immutable, so they live in object storage.',
        'The database only holds their keys. Video ids are time-ordered unique numbers, so new rows land together and ids sort by age.',
      ],
      keyIdea: 'Keep small structured metadata in SQL and big immutable blobs in object storage, joined by a key.',
      metrics: { plays: '3,000/s', uploads: '3/s', storage: '40 TB/day raw', egress: '23 PB/day', ready: 'target < 5 min' },
      scene: {
        nodes: [{ ...api, at: at(-4.5, 0) }, { ...db, at: at(0, -3.6), status: 'active', badge: 'rows: small' }, { ...raw, at: at(0, 3.6), status: 'active', badge: 'blobs: huge' }],
        links: [link('api', 'db', { label: 'title, status' }), link('api', 'raw', { label: 'key only', style: 'dashed' })],
        flows: [
          { path: ['api', 'db'], tone: 'request', label: 'row', duration: 1.2 },
          { path: ['db', 'raw'], tone: 'data', label: 'raw_key', duration: 1.4, delay: 1.3, count: 1 },
        ],
        panel: {
          title: 'Two worlds',
          icon: 'Table',
          rows: [
            { text: 'Metadata: title, owner, status', value: 'SQL' },
            { text: 'Original file, segments', value: 'object storage' },
            { text: 'Thumbnails', value: 'object storage' },
            { text: 'Link between them', value: 'a key' },
          ],
        },
        caption: 'Rows hold keys, storage holds the bytes',
      },
      code: {
        language: 'sql',
        title: 'Metadata tables (blobs live in object storage)',
        source: `CREATE TABLE videos (
  video_id     BIGINT PRIMARY KEY,      -- time-ordered unique id
  owner_id     BIGINT NOT NULL,
  title        TEXT NOT NULL,
  status       TEXT NOT NULL,           -- uploading | processing | ready | failed | blocked
  duration_s   INT,
  raw_key      TEXT,                    -- e.g. raw/7712093/original.mov
  manifest_url TEXT,                    -- master playlist on the CDN
  created_at   TIMESTAMPTZ NOT NULL
);

CREATE TABLE renditions (
  video_id     BIGINT REFERENCES videos,
  height       INT,                     -- 1080, 720, 480, 360, 240
  bitrate_kbps INT,
  prefix       TEXT,                    -- folder of 4-second segments
  PRIMARY KEY (video_id, height)
);

CREATE INDEX videos_by_owner ON videos (owner_id, created_at DESC);`,
        highlight: [5, 7, 8, 16],
      },
    },
    {
      title: 'Status column',
      tag: 'concept',
      heading: 'One status field drives the whole lifecycle',
      eli5: 'Each cake has a sticker on its box: in the oven, ready to sell, or burnt. Every helper changes the sticker, and the shop only displays cakes marked ready.',
      body: [
        'The `status` column moves through `uploading`, `processing`, `ready`, `failed` or `blocked`. Every part of the system moves a video forward by changing that one field.',
        'The watch page shows the video only when it reads `ready`. A creator sees the other states on their own channel page.',
      ],
      keyIdea: 'One status field is the contract between the API, the pipeline and the watch page.',
      metrics: { plays: '3,000/s', uploads: '3/s', storage: '40 TB/day raw', egress: '23 PB/day', ready: 'target < 5 min' },
      scene: {
        nodes: [{ ...api, at: at(-4.5, 0) }, { ...db, at: at(0, 0), status: 'active', badge: 'status = ?' }, { ...viewer, at: at(4.5, 0), chips: [{ text: 'only ready', tone: 'good' }] }],
        links: [link('api', 'db'), link('viewer', 'db', { style: 'dashed', arrow: 'none' })],
        flows: [
          { path: ['api', 'db'], tone: 'request', label: 'uploading', duration: 1.2 },
          { path: ['api', 'db'], tone: 'request', label: 'processing', duration: 1.2, delay: 1.6 },
          { path: ['api', 'db'], tone: 'request', label: 'ready', duration: 1.2, delay: 3.2 },
        ],
        panel: {
          title: 'Status lifecycle',
          icon: 'Route',
          rows: [
            { text: 'uploading', value: 'bytes arriving' },
            { text: 'processing', value: 'encoders working' },
            { text: 'ready', value: 'watchable', tone: 'good' },
            { text: 'failed', value: 'bad file', tone: 'bad' },
            { text: 'blocked', value: 'policy', tone: 'warn' },
          ],
        },
        caption: 'Every part moves a video forward by editing one field',
      },
    },
    {
      title: 'Simple design',
      tag: 'concept',
      heading: 'Version one: one server does everything',
      eli5: 'At first one baker does it all in a single shop: takes in cakes, re-bakes them, and hands whole cakes to every customer at the door. That one shop is the **video server**.',
      body: [
        'The creator POSTs the file to a **video server**. It saves the file to local disk, runs one encode to a standard 1080p MP4, writes a MySQL row, and serves the MP4 back to anyone who asks.',
        'At a few hundred uploads a day this works. Keep the numbers in mind: 40 TB of raw files plus 19 TB of MP4s land every day, and every play pulls the whole 190 MB file whether the viewer watches ten seconds or five minutes.',
      ],
      keyIdea: 'Start with the simplest thing that works, then find exactly which numbers break it.',
      metrics: { plays: '3,000/s', uploads: '3/s', storage: '59 TB/day', egress: '23 PB/day', ready: '20 min' },
      metricTones: { egress: 'bad', ready: 'bad' },
      scene: {
        nodes: [creator, { ...mono, status: 'active', badge: 'upload, encode, serve' }, viewer, rider],
        links: [link('creator', 'mono'), link('mono', 'viewer'), link('mono', 'rider')],
        flows: [
          { path: ['creator', 'mono'], tone: 'request', label: 'POST 400 MB', duration: 2.2 },
          { path: ['mono', 'viewer'], tone: 'response', label: 'whole MP4', duration: 1.6, delay: 2.4 },
          { path: ['mono', 'rider'], tone: 'response', label: 'whole MP4', duration: 1.6, delay: 2.8 },
        ],
        panel: {
          title: 'Per day, one box',
          icon: 'HardDrive',
          rows: [
            { text: 'Raw files', value: '40 TB' },
            { text: 'One 1080p MP4 each', value: '19 TB' },
            { text: 'Bytes per play', value: '190 MB', tone: 'warn' },
          ],
        },
        caption: 'One box takes uploads, encodes and serves',
      },
    },
    {
      title: 'Upload pain',
      tag: 'case',
      heading: 'Break 1: uploads tie up the server',
      eli5: 'A baker walks cake to the shop very slowly. While one baker stands at the counter, nobody else gets served. A dropped cake means walking back to the start.',
      body: [
        'A 400 MB upload over a 10 Mbps home connection takes about five minutes. Hundreds of them in flight hold threads and memory on the **video server**.',
        'A dropped connection at 95% means starting over from zero.',
      ],
      keyIdea: 'Slow, huge uploads should not hold an app server, and a failure late in the upload should not cost the whole file.',
      metrics: { plays: '3,000/s', uploads: '3/s', storage: '59 TB/day', egress: '23 PB/day', ready: '20 min' },
      metricTones: { ready: 'bad' },
      scene: {
        nodes: [{ ...creator, status: 'hot', badge: 'reset at 95%' }, { ...mono, status: 'hot', load: 92, chips: [{ text: '300 uploads open', tone: 'warn' }] }, viewer],
        links: [link('creator', 'mono', { label: '10 Mbps · 5 min', labelTone: 'warn' }), link('mono', 'viewer')],
        flows: [
          { path: ['creator', 'mono'], tone: 'error', label: 'connection lost', duration: 2.2 },
          { path: ['mono', 'viewer'], tone: 'response', duration: 1.4, delay: 1 },
        ],
        panel: {
          title: 'One upload',
          icon: 'Timer',
          rows: [
            { text: '400 MB at 10 Mbps', value: '~5 min', tone: 'warn' },
            { text: 'Drop at 95%', value: 'start over', tone: 'bad' },
          ],
        },
        caption: 'Slow clients hold the server hostage',
      },
    },
    {
      title: 'Encode pain',
      tag: 'case',
      heading: 'Break 2: encoding is slow and serial',
      eli5: 'The one oven bakes one cake at a time. Orders pile up on the counter, and each baker waits longer than the last.',
      body: [
        'One machine encoding one quality at a time falls behind a queue of uploads. Encoding is CPU work, and it competes with serving traffic for the same cores.',
        'One 1080p encode alone takes about 20 minutes, so "ready" drifts there and beyond, far past the 5 minute target.',
      ],
      keyIdea: 'Encoding is a CPU problem that has to scale on its own, away from the app server.',
      metrics: { plays: '3,000/s', uploads: '3/s', storage: '59 TB/day', egress: '23 PB/day', ready: '20+ min' },
      metricTones: { ready: 'bad' },
      scene: {
        nodes: [{ ...creator, chips: ['1080p MP4', 'waiting...'] }, { ...mono, status: 'hot', load: 100, badge: 'one encode at a time' }, { ...viewer, status: 'down', badge: 'not ready yet' }],
        links: [link('creator', 'mono'), link('mono', 'viewer')],
        flows: [
          { path: ['creator', 'mono'], tone: 'request', count: 3, duration: 1.2 },
          { path: ['mono', 'viewer'], tone: 'error', label: 'ready in 20 min', duration: 2, delay: 1.4 },
        ],
        panel: {
          title: 'Ready time',
          icon: 'Clock',
          rows: [
            { text: 'Target', value: '5 min', tone: 'good' },
            { text: 'One serial encoder', value: '20+ min', tone: 'bad' },
          ],
        },
        caption: 'Uploads queue behind one busy encoder',
      },
    },
    {
      title: 'Playback pain',
      tag: 'case',
      heading: 'Break 3: one file for everyone, from one place',
      eli5: 'Every customer gets the same giant cake, even the one on a bicycle with one hand. And everyone must walk to the one shop, however far away.',
      body: [
        'The 1080p MP4 needs about 5 Mbps. The rider on a train with 1 Mbps stalls every few seconds, and an old TV may not play the codec at all.',
        '**Egress is impossible.** 23 PB a day is over 2 Tbps on average from one place, and viewers in Sydney cross an ocean for every byte. No single link or server comes close.',
      ],
      keyIdea: 'Upload bytes, encode CPU and playback bandwidth are three separate scaling problems, and none belong on the app server.',
      metrics: { plays: '3,000/s', uploads: '3/s', storage: '59 TB/day', egress: '23 PB/day', ready: '20+ min' },
      metricTones: { egress: 'bad', ready: 'bad' },
      scene: {
        nodes: [{ ...mono, at: at(-4.5, 0), status: 'hot', badge: '2 Tbps?' }, { ...viewer, status: 'hot', badge: 'far away' }, { ...rider, status: 'down', badge: 'buffering' }],
        links: [link('mono', 'viewer', { label: 'across an ocean', labelTone: 'warn' }), link('mono', 'rider', { label: '1 Mbps train', labelTone: 'warn' })],
        flows: [
          { path: ['mono', 'viewer'], tone: 'response', count: 3, duration: 2.4 },
          { path: ['mono', 'rider'], tone: 'error', label: '5 Mbps file, 1 Mbps link', duration: 2.6, delay: 0.6 },
        ],
        panel: {
          title: 'One MP4 for all',
          icon: 'Signal',
          rows: [
            { text: '1080p MP4 needs', value: '5 Mbps' },
            { text: 'Train rider has', value: '1 Mbps', tone: 'bad' },
            { text: 'Egress from one place', value: '2+ Tbps', tone: 'bad' },
          ],
        },
        caption: 'One file, one place, every device',
      },
    },
    {
      title: 'Direct upload',
      tag: 'concept',
      heading: 'Fix 1: upload straight to object storage',
      eli5: 'Instead of handing the cake to the shopkeeper, the baker gets a signed ticket to drop it at the warehouse door. That ticket is a **pre-signed URL**.',
      body: [
        'The API server stops touching bytes. `POST /videos` writes the row as `uploading`, starts a **multipart upload** in the raw bucket and returns **pre-signed URLs**.',
        'Each URL allows exactly one PUT to one key and expires in an hour, so a leaked URL is worth little. The API now handles three small JSON calls per upload.',
      ],
      keyIdea: 'Let clients send big bytes straight to object storage with short-lived, single-purpose URLs.',
      metrics: { plays: '3,000/s', uploads: '3/s', storage: '59 TB/day', egress: '23 PB/day', ready: '20 min' },
      scene: {
        nodes: [{ ...creator, status: 'active' }, { ...api, at: at(0, -3.6), status: 'ok', badge: 'no video bytes' }, { ...raw, at: at(0, 3.6), status: 'active' }, { ...db, at: at(4.5, -3.6) }],
        links: [link('creator', 'api'), link('api', 'db'), link('creator', 'raw', { label: 'pre-signed PUT' })],
        flows: [
          { path: ['creator', 'api'], tone: 'request', label: 'POST /videos', duration: 1 },
          { path: ['api', 'db'], tone: 'request', label: 'uploading', duration: 0.9, delay: 1.1 },
          { path: ['api', 'creator'], tone: 'response', label: 'signed URLs', duration: 1, delay: 2.1 },
          { path: ['creator', 'raw'], tone: 'data', label: '400 MB', duration: 1.8, delay: 3.2 },
        ],
        panel: {
          title: 'One signed URL',
          icon: 'KeyRound',
          rows: [
            { text: 'Allowed action', value: 'one PUT' },
            { text: 'Allowed key', value: 'one object' },
            { text: 'Expires', value: '1 hour', tone: 'good' },
          ],
        },
        caption: 'Bytes go to the bucket, the API only signs and records',
      },
      code: {
        language: 'python',
        title: 'Start a resumable upload with pre-signed part URLs (boto3)',
        source: `import boto3

s3 = boto3.client("s3")
BUCKET, PART = "raw-videos", 16 * 1024 * 1024    # 16 MB parts

def start_upload(owner_id, video_id, size_bytes):
    key = f"raw/{video_id}/original"
    up = s3.create_multipart_upload(Bucket=BUCKET, Key=key)
    n_parts = -(-size_bytes // PART)                # ceiling division
    urls = [
        s3.generate_presigned_url(
            "upload_part",
            Params={"Bucket": BUCKET, "Key": key,
                    "UploadId": up["UploadId"], "PartNumber": n},
            ExpiresIn=3600)                         # dies in one hour
        for n in range(1, n_parts + 1)
    ]
    db.insert_video(video_id, owner_id, status="uploading", raw_key=key)
    return {"uploadId": up["UploadId"], "partSize": PART, "urls": urls}

def parts_already_uploaded(video_id, upload_id):    # used to resume
    r = s3.list_parts(Bucket=BUCKET, Key=f"raw/{video_id}/original", UploadId=upload_id)
    return {p["PartNumber"] for p in r.get("Parts", [])}`,
        highlight: [8, 11, 15, 18, 21, 22],
      },
    },
    {
      title: 'Resumable parts',
      tag: 'concept',
      heading: 'Send 25 parts, resend only the missing ones',
      eli5: 'The baker packs the cake into 25 small boxes and carries four at a time. If a box is dropped in a tunnel, only that box is carried again.',
      body: [
        'The 400 MB file becomes 25 parts of 16 MB. The client sends 4 at a time, which fills a fast link better than one stream.',
        'In a tunnel, the client asks the **API** which parts landed (it cannot list them itself, that needs credentials) and gets fresh URLs for the missing ones, since old ones may have expired. That is a **resumable upload**.',
        'On `complete` the client sends each part number and its **ETag**. The API completes the multipart upload, sets `processing` and enqueues the transcode graph.',
      ],
      keyIdea: 'Split big uploads into parts that are sent in parallel and retried one at a time.',
      metrics: { plays: '3,000/s', uploads: '3/s', storage: '59 TB/day', egress: '23 PB/day', ready: '20 min' },
      scene: {
        nodes: [{ ...creator, status: 'active', chips: ['4 parts in flight'] }, { ...raw, status: 'active', badge: '18 of 25 landed' }, { ...api, status: 'ok' }],
        links: [link('creator', 'raw', { label: 'tunnel: 7 parts lost', labelTone: 'warn' }), link('creator', 'api', { style: 'dashed', arrow: 'both' })],
        flows: [
          { path: ['creator', 'raw'], tone: 'data', label: 'part n', count: 4, duration: 1.4 },
          { path: ['creator', 'api'], tone: 'request', label: 'list parts?', duration: 1, delay: 1.6 },
          { path: ['api', 'creator'], tone: 'response', label: 'fresh URLs', duration: 1, delay: 2.7 },
          { path: ['creator', 'raw'], tone: 'data', label: 'resend 7', count: 3, duration: 1.4, delay: 3.8 },
        ],
        panel: {
          title: 'Parts of 400 MB',
          icon: 'Layers',
          rows: [
            { text: 'Part size', value: '16 MB' },
            { text: 'Parts', value: '25' },
            { text: 'In flight', value: '4' },
            { text: 'After a tunnel', value: 'resend 7 only', tone: 'good' },
          ],
        },
        caption: 'Only the missing parts travel again',
      },
      code: {
        language: 'python',
        title: 'Resume through the API, then complete the upload',
        source: `def resume_upload(video_id, upload_id, n_parts):    # client calls the API
    have = parts_already_uploaded(video_id, upload_id)
    missing = [n for n in range(1, n_parts + 1) if n not in have]
    return {"urls": sign_parts(video_id, upload_id, missing)}   # fresh 1 h URLs

def complete_upload(video_id, upload_id, parts):    # [{PartNumber, ETag}, ...]
    key = f"raw/{video_id}/original"
    s3.complete_multipart_upload(Bucket=BUCKET, Key=key, UploadId=upload_id,
                                 MultipartUpload={"Parts": parts})
    db.set_status(video_id, "processing")
    queue.enqueue_dag(video_id)                     # starts inspect and split`,
        highlight: [4, 8, 10, 11],
      },
      quiz: {
        question: 'A 400 MB upload loses its connection after 18 of 25 parts landed. What should the client do?',
        options: [
          'Start the whole upload again with a new URL',
          'Ask the API which parts landed, get fresh URLs and resend only the 7 missing parts',
          'Ask the API server to fetch the file from the phone',
          'Wait until the user retries from the beginning',
        ],
        answer: 1,
        explain: 'Each part is its own PUT, so storage keeps the parts that arrived. The API lists them and returns fresh URLs, the client resends the rest and then calls complete with every ETag.',
      },
    },
    {
      title: 'Upload speed',
      tag: 'tradeoff',
      heading: 'Uploading from far away',
      eli5: 'A baker in a faraway town drops cakes at a local pickup box, and a truck carries them to the main warehouse overnight. That is faster for the baker.',
      body: [
        'For far-away creators, upload to the nearest region or an edge ingest point and copy to the main region in the background. The creator sees a fast upload, and the copy runs on fast links between data centers.',
        'The pipeline starts once the object lands in the main bucket, so time to ready still counts from that moment.',
      ],
      keyIdea: 'Shorten the slow last mile with a nearby ingest point, and copy to the home region in the background.',
      metrics: { plays: '3,000/s', uploads: '3/s', storage: '59 TB/day', egress: '23 PB/day', ready: '20 min' },
      scene: {
        nodes: [{ ...creator, badge: 'Sydney' }, { id: 'edge', kind: 'cdn', at: at(0, 0), label: 'ingest point', sub: 'nearby', status: 'active' }, { ...raw, at: at(4.5, 0), label: 'main bucket', sub: 'home region' }],
        links: [link('creator', 'edge', { label: 'fast local hop', labelTone: 'good' }), link('edge', 'raw', { label: 'background copy' })],
        flows: [
          { path: ['creator', 'edge'], tone: 'data', label: '400 MB', duration: 1.4 },
          { path: ['edge', 'raw'], tone: 'data', label: 'copy', duration: 2, delay: 1.6 },
        ],
        panel: {
          title: 'Two hops',
          icon: 'Route',
          rows: [
            { text: 'Creator to ingest point', value: 'short, fast', tone: 'good' },
            { text: 'Ingest to main bucket', value: 'background copy' },
            { text: 'Creator waits for', value: 'near hop only', tone: 'good' },
          ],
        },
        caption: 'The creator waits for the near hop only',
      },
    },
    {
      title: 'Codecs',
      tag: 'concept',
      heading: 'Containers and codecs: what a video file really is',
      eli5: 'A cake box is the **container** and the recipe that squeezes the cake small is the codec. Different shops open different boxes, and some recipes only work in some shops.',
      body: [
        'A **container** is the basket that holds video, audio and metadata. You see it in the extension: `.mov`, `.mp4`, `.avi`. A **codec** compresses and decompresses the pictures to shrink size. Common ones are H.264, VP9 and HEVC.',
        'Phones record in one format, and TVs, browsers and old devices each support another. So the platform must transcode: change codec, resolution and bitrate for every device and every network.',
      ],
      keyIdea: 'A video file is a container around a codec stream, and no single format plays everywhere, so every upload gets transcoded.',
      metrics: { plays: '3,000/s', uploads: '3/s', storage: '59 TB/day', egress: '23 PB/day', ready: '20 min' },
      scene: {
        nodes: [{ ...creator, chips: ['.mov, HEVC'] }, { id: 'enc', kind: 'block', at: at(0, 0), label: 'transcoder', sub: 'codec + size', icon: 'Binary', tint: 'amber', status: 'active' }, { ...viewer, chips: ['.mp4, H.264'] }, { ...rider, chips: ['360p, 0.8 Mbps'] }],
        links: [link('creator', 'enc'), link('enc', 'viewer'), link('enc', 'rider')],
        flows: [
          { path: ['creator', 'enc'], tone: 'data', label: 'camera file', duration: 1.4 },
          { path: ['enc', 'viewer'], tone: 'response', label: 'H.264', duration: 1.4, delay: 1.6 },
          { path: ['enc', 'rider'], tone: 'response', label: 'small', duration: 1.4, delay: 1.9 },
        ],
        panel: {
          title: 'Video file anatomy',
          icon: 'Package',
          rows: [
            { text: 'Container', value: '.mp4 / .mov' },
            { text: 'Video codec', value: 'H.264 / VP9' },
            { text: 'Audio codec', value: 'AAC' },
            { text: 'Metadata', value: 'duration, tracks' },
          ],
        },
        caption: 'Same video, different boxes and recipes',
      },
    },
    {
      title: 'Transcode DAG',
      tag: 'concept',
      heading: 'Fix 2: transcoding as a graph of small tasks',
      eli5: 'The kitchen cuts the cake into 75 slices, and many cooks frost slices at the same time, plus one takes the box photos. Drawn as arrows, the plan is a **DAG**.',
      body: [
        'Transcoding is CPU heavy, so split it into a **directed acyclic graph** of tasks. **Inspect** checks the file is a real, decodable video. **Split** cuts it into 4-second segments at keyframes, so each segment can be encoded on its own.',
        'Then **encode** tasks run per segment per quality, **audio** and **thumbnails** run beside them, and **package** writes the playlists when every encode is done.',
      ],
      keyIdea: 'Cut the video at keyframes into segments, and run encodes as independent tasks in a graph.',
      metrics: { plays: '3,000/s', uploads: '3/s', storage: '77 TB/day', egress: '23 PB/day', ready: '2 min' },
      metricTones: { ready: 'good' },
      scene: {
        nodes: [
          { ...raw, at: at(-5.4, 0), label: 'raw video', sub: '5 min, 400 MB' },
          { id: 'split', kind: 'block', at: at(-1.8, 0), label: 'inspect + split', sub: '75 segments', icon: 'Split', tint: 'blue', status: 'active' },
          { id: 'enc', kind: 'block', at: at(1.8, -3), label: 'encode', sub: 'per segment, per quality', icon: 'Binary', tint: 'amber', status: 'active' },
          { id: 'side', kind: 'block', at: at(1.8, 3), label: 'audio + thumbs', sub: 'AAC, 3 frames', icon: 'Image', tint: 'teal' },
          { id: 'pack', kind: 'block', at: at(5.4, 0), label: 'package', sub: 'HLS playlists', icon: 'Package', tint: 'green' },
        ],
        links: [link('raw', 'split'), link('split', 'enc'), link('split', 'side'), link('enc', 'pack'), link('side', 'pack', { style: 'dashed' })],
        flows: [
          { path: ['raw', 'split'], tone: 'data', duration: 1 },
          { path: ['split', 'enc'], tone: 'event', count: 3, duration: 1, delay: 1.1 },
          { path: ['split', 'side'], tone: 'event', duration: 1, delay: 1.1 },
          { path: ['enc', 'pack'], tone: 'data', count: 2, duration: 1, delay: 2.4 },
          { path: ['side', 'pack'], tone: 'data', duration: 1, delay: 2.4 },
        ],
        panel: {
          title: 'The graph',
          icon: 'Workflow',
          rows: [
            { text: 'inspect, split', value: 'first' },
            { text: 'encode, audio, thumbnails', value: 'in parallel' },
            { text: 'package', value: 'waits for all', tone: 'warn' },
          ],
        },
        caption: 'Independent tasks run in parallel, package waits for all',
      },
    },
    {
      title: 'GOP split',
      tag: 'concept',
      heading: 'Cut at GOP boundaries, on the client or the server',
      eli5: 'A cake is easiest to cut along the lines already drawn on it. A newer baker pre-cuts at the lines before the trip, and the kitchen cuts any uncut cake itself.',
      body: [
        'A **GOP** (group of pictures) is a run of frames that starts at a keyframe and decodes on its own. Cutting only at GOP boundaries is what lets each 4-second segment be encoded alone.',
        'A newer client can run this cut before upload as a **preprocessor**. Older clients send one file, so the server always keeps its own split step.',
      ],
      keyIdea: 'Segments must start at keyframes, and a capable client can do that cut early, but the server always keeps the step.',
      metrics: { plays: '3,000/s', uploads: '3/s', storage: '77 TB/day', egress: '23 PB/day', ready: '20 min' },
      scene: {
        nodes: [{ ...creator, chips: ['newer client: cuts'] }, { ...raw, at: at(0, 0), label: 'raw bucket', sub: 'segments or one file' }, { id: 'split', kind: 'block', at: at(4.5, 0), label: 'server split', sub: 'always kept', icon: 'Split', tint: 'blue', status: 'active' }],
        links: [link('creator', 'raw'), link('raw', 'split')],
        flows: [
          { path: ['creator', 'raw'], tone: 'data', label: 'GOP-aligned', duration: 1.4 },
          { path: ['raw', 'split'], tone: 'event', label: 'older clients', duration: 1.2, delay: 1.6 },
        ],
        panel: {
          title: 'Who cuts the video',
          icon: 'Split',
          rows: [
            { text: 'Newer client', value: 'cuts at keyframes', tone: 'good' },
            { text: 'Older client', value: 'sends one file', tone: 'muted' },
            { text: 'Server split step', value: 'always kept' },
          ],
        },
        caption: 'Cut at keyframes, and let capable clients help',
      },
    },
    {
      title: 'Parallel math',
      tag: 'concept',
      heading: '375 small tasks finish in about 2 minutes',
      eli5: 'One cook frosting 375 slices takes all afternoon. A hundred cooks each frost a few, and the cake is done before the coffee cools.',
      body: [
        'A five-minute video gives 75 segments x 5 qualities = **375 small encode tasks**. At about 30 seconds per 4-second segment encode, that is 11,250 core-seconds, roughly 3 hours on one core.',
        'On 100 cores the tasks run in 3.75 waves of 30 s, about **2 minutes**. Time to ready depends on pool size, and only weakly on video length once the pool is large.',
      ],
      keyIdea: 'Time to ready is set mostly by the size of the worker pool, and only weakly by video length when the pool is large.',
      metrics: { plays: '3,000/s', uploads: '3/s', storage: '77 TB/day', egress: '23 PB/day', ready: '2 min' },
      metricTones: { ready: 'good' },
      scene: {
        nodes: [
          { id: 'split', kind: 'block', at: at(-4.5, 0), label: 'split', sub: '75 segments', icon: 'Split', tint: 'blue' },
          { id: 'pool', kind: 'worker', at: at(0, 0), label: 'encoder pool', sub: '100 cores', status: 'active', load: 70, badge: '375 tasks' },
          { id: 'pack', kind: 'block', at: at(4.5, 0), label: 'package', sub: 'HLS playlists', icon: 'Package', tint: 'green', status: 'ok' },
        ],
        links: [link('split', 'pool'), link('pool', 'pack')],
        flows: [
          { path: ['split', 'pool'], tone: 'event', count: 4, duration: 1.2 },
          { path: ['pool', 'pack'], tone: 'data', count: 4, duration: 1.2, delay: 1.4 },
        ],
        panel: {
          title: 'Serial vs parallel',
          icon: 'Timer',
          rows: [
            { text: '75 segments x 5 qualities', value: '375 tasks' },
            { text: 'One core, 30 s per task', value: '~3 hours', tone: 'bad' },
            { text: '100 cores, 3.75 waves', value: '~2 min', tone: 'good' },
          ],
        },
        caption: 'Many small tasks, many workers',
      },
    },
    {
      title: 'Fleet size',
      tag: 'concept',
      heading: 'Size the whole encoder fleet',
      eli5: 'One cake needs a hundred cooks for two minutes. The bakery gets a cake every second, so the kitchen needs thousands of cooks, plus extra for the rush.',
      body: [
        'Fleet size is uploads per second x core-seconds per upload. About 1.2 uploads a second x 11,250 core-seconds is roughly **13,000 cores** around the clock. At the 3 a second peak it is about 34,000.',
        'The steady figure is the **autoscale floor**, and the peak factor sets the ceiling. The pool shrinks overnight and grows with the day.',
      ],
      keyIdea: 'Uploads per second times core-seconds per upload gives the steady fleet, and a peak factor sets how far to scale.',
      metrics: { plays: '3,000/s', uploads: '3/s', storage: '77 TB/day', egress: '23 PB/day', ready: '2 min' },
      metricTones: { ready: 'good' },
      scene: {
        nodes: [{ ...creator, badge: '1.2 uploads/s' }, { id: 'pool', kind: 'worker', at: at(0, 0), label: 'encoder fleet', sub: '13,000 cores', status: 'active', load: 60 }, { id: 'scaler', kind: 'block', at: at(4.5, 0), label: 'autoscaler', sub: 'floor 13,000', icon: 'Gauge', tint: 'violet' }],
        links: [link('creator', 'pool'), link('scaler', 'pool', { style: 'dashed' })],
        flows: [
          { path: ['creator', 'pool'], tone: 'event', label: '375 tasks each', count: 3, duration: 1.4 },
          { path: ['scaler', 'pool'], tone: 'request', label: 'set size', duration: 1.2, delay: 1.6 },
        ],
        panel: {
          title: 'Fleet sizing',
          icon: 'Calculator',
          rows: [
            { text: 'Core-seconds per upload', value: '11,250' },
            { text: 'Uploads per second', value: '1.2' },
            { text: 'Steady fleet', value: '~13,000 cores', tone: 'good' },
            { text: 'Peak at 3 uploads/s', value: '~34,000 cores', tone: 'warn' },
          ],
        },
        caption: 'Rate times work per upload gives the fleet',
      },
    },
    {
      title: 'Workers',
      tag: 'concept',
      heading: 'A scheduler, a task queue and a pool of workers',
      eli5: 'A kitchen manager reads the plan and posts the next jobs on a board. Cooks grab a job, finish it, and the manager posts what that job unlocked.',
      body: [
        'A **scheduler** walks the graph and puts every task whose inputs are ready onto the **task queue**. A pool of encoder **workers** pulls from it, and a resource manager decides which worker takes which task.',
        'Intermediate segments sit in temporary storage, so a failed task reruns from its inputs instead of from the start of the video.',
      ],
      keyIdea: 'The scheduler releases ready tasks to a queue, and a pool of workers pulls them, so the pool scales on its own.',
      metrics: { plays: '3,000/s', uploads: '3/s', storage: '77 TB/day', egress: '23 PB/day', ready: '2 min' },
      scene: {
        nodes: [
          { id: 'sched', kind: 'block', at: at(-5, 0), label: 'DAG scheduler', sub: 'walks the graph', icon: 'Workflow', tint: 'violet', status: 'active' },
          { id: 'queue', kind: 'queue', at: at(-1.7, 0), label: 'task queue', sub: 'ready tasks', badge: 'depth 375' },
          { id: 'pool', kind: 'worker', at: at(1.7, 0), label: 'encoder pool', sub: 'autoscaled', status: 'active' },
          { id: 'tmp', kind: 'storage', at: at(5, 0), label: 'temp storage', sub: 'segments' },
        ],
        links: [link('sched', 'queue'), link('queue', 'pool'), link('pool', 'tmp'), link('pool', 'sched', { style: 'dashed', label: 'task done' })],
        flows: [
          { path: ['sched', 'queue'], tone: 'event', count: 3, duration: 1 },
          { path: ['queue', 'pool'], tone: 'request', count: 3, duration: 1, delay: 1.1 },
          { path: ['pool', 'tmp'], tone: 'data', duration: 1, delay: 2.2 },
        ],
        panel: {
          title: 'Who does what',
          icon: 'List',
          rows: [
            { text: 'Scheduler', value: 'what is ready?' },
            { text: 'Task queue', value: 'buffer' },
            { text: 'Workers', value: 'run one task' },
            { text: 'Temp storage', value: 'inputs for retries' },
          ],
        },
        caption: 'Ready tasks flow to whichever worker is free',
      },
    },
    {
      title: 'DAG as config',
      tag: 'concept',
      heading: 'The graph is data, so pipelines are configurable',
      eli5: 'The kitchen plan is a written recipe card. A birthday cake adds a candle step, and a plain cake skips it. Nobody rebuilds the kitchen.',
      body: [
        'Different pipelines are just different graphs. A creator who supplies a thumbnail skips that node. A partner channel adds a watermark node. The scheduler reads the config and builds the graph for each upload.',
      ],
      keyIdea: 'Describe the pipeline as a graph in config, so new variants need no new code.',
      metrics: { plays: '3,000/s', uploads: '3/s', storage: '77 TB/day', egress: '23 PB/day', ready: '2 min' },
      scene: {
        nodes: [
          { id: 'cfg', kind: 'block', at: at(-4.5, 0), label: 'pipeline config', sub: 'yaml', icon: 'FileCode', tint: 'gray' },
          { id: 'sched', kind: 'block', at: at(0, 0), label: 'DAG scheduler', sub: 'builds graph', icon: 'Workflow', tint: 'violet', status: 'active' },
          { id: 'pool', kind: 'worker', at: at(4.5, 0), label: 'encoder pool', sub: 'autoscaled' },
        ],
        links: [link('cfg', 'sched'), link('sched', 'pool')],
        flows: [
          { path: ['cfg', 'sched'], tone: 'data', label: 'graph', duration: 1.2 },
          { path: ['sched', 'pool'], tone: 'event', count: 3, duration: 1.2, delay: 1.4 },
        ],
        panel: {
          title: 'Variants',
          icon: 'Table',
          rows: [
            { text: 'Standard upload', value: 'full graph' },
            { text: 'Custom thumbnail', value: 'skip thumbs' },
            { text: 'Partner channel', value: '+ watermark' },
          ],
        },
        caption: 'Same engine, different graphs',
      },
      code: {
        language: 'yaml',
        title: 'A pipeline described as a DAG',
        source: `pipeline: standard-upload
tasks:
  inspect:  { run: probe, retries: 2 }
  split:    { run: segment, after: [inspect], seconds: 4, cut_on: keyframe }
  enc_hd:   { run: encode, after: [split], per_segment: true,
              ladder: [1080p@5000k, 720p@2800k] }
  enc_sd:   { run: encode, after: [split], per_segment: true,
              ladder: [480p@1400k, 360p@800k, 240p@400k] }
  audio:    { run: encode_audio, after: [inspect], codec: aac, kbps: 128 }
  thumbs:   { run: thumbnails, after: [inspect], count: 3, skip_if: custom_thumb }
  package:  { run: package_hls, after: [enc_hd, enc_sd, audio] }
  publish:  { run: set_status, after: [package, thumbs], status: ready }`,
        highlight: [4, 5, 7, 10, 11, 12],
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Part 1: bytes in, qualities out',
      eli5: 'Cakes come in the back door with a ticket, get cut into slices and frosted by many cooks at once. Part two is how the slices reach every customer.',
      body: [
        'Upload: three small API calls and pre-signed, resumable multipart uploads straight to the raw bucket. Processing: a graph of per-segment tasks on a queue-fed, autoscaled worker pool, ready in about 2 minutes.',
        'Part two covers playback: adaptive bitrate streaming, the CDN and its cost, the metadata path, failures and safety.',
      ],
      keyIdea: 'Separate the paths by what they move: JSON through the API, uploads to object storage, CPU work to a queue of small tasks.',
      metrics: { plays: '3,000/s', uploads: '3/s', storage: '77 TB/day', egress: '23 PB/day', ready: '2 min' },
      metricTones: { ready: 'good' },
      scene: {
        nodes: [
          creator,
          { ...raw, at: at(-1.5, 3.6), status: 'ok' },
          { id: 'pool', kind: 'worker', at: at(1.5, 0), label: 'encoder pool', sub: 'autoscaled', status: 'ok' },
          { id: 'rend', kind: 'storage', at: at(4.5, 3.6), label: 'renditions', sub: '5 qualities', status: 'ok' },
          { ...api, at: at(-1.5, -3.6), status: 'ok' },
        ],
        links: [link('creator', 'api', { style: 'dashed' }), link('creator', 'raw'), link('raw', 'pool'), link('pool', 'rend')],
        flows: [
          { path: ['creator', 'raw', 'pool', 'rend'], tone: 'data', duration: 3.2 },
          { path: ['creator', 'api'], tone: 'request', duration: 1.2, delay: 0.3 },
        ],
        panel: {
          title: 'Part 1 in numbers',
          icon: 'Gauge',
          rows: [
            { text: 'Parts per upload', value: '25 x 16 MB' },
            { text: 'Encode tasks', value: '375' },
            { text: 'Time to ready', value: '~2 min', tone: 'good' },
          ],
        },
      },
      quiz: {
        question: 'Why does adding encoder workers shorten time to ready for a long video?',
        options: [
          'Each worker encodes the whole video faster',
          'The video is cut into segments that encode independently, so more workers run more tasks at once',
          'Workers compress the original upload before it arrives',
          'The CDN takes over encoding from the workers',
        ],
        answer: 1,
        explain: 'Segments cut at keyframes can be encoded alone, so the 375 tasks spread over the pool. Time depends on pool size, and the graph only waits at the package step.',
      },
    },
  ],
};
