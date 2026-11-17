import type { Lesson, SceneNode } from '../engine/types';

// Main layout. Top row (x + y = -4) is the upload pipeline, bottom row (x + y = 2.5) is metadata and playback.
const creator: SceneNode = { id: 'creator', kind: 'phone', at: [-5, 1], label: 'creator', sub: '400 MB upload' };
const raw: SceneNode = { id: 'raw', kind: 'storage', at: [-3.7, -0.3], label: 'raw bucket', sub: 'originals' };
const queue: SceneNode = { id: 'queue', kind: 'queue', at: [-2.4, -1.6], label: 'job queue', sub: 'transcode tasks' };
const workers: SceneNode = { id: 'workers', kind: 'worker', at: [-1.1, -2.9], label: 'encoders', sub: 'autoscaled pool' };
const rend: SceneNode = { id: 'rend', kind: 'storage', at: [0.2, -4.2], label: 'renditions', sub: 'HLS segments' };
const rider: SceneNode = { id: 'rider', kind: 'phone', at: [1.5, -5.5], label: 'phone viewer', sub: 'on a train' };
const api: SceneNode = { id: 'api', kind: 'server', at: [-1.75, 4.25], label: 'API servers', sub: 'stateless' };
const db: SceneNode = { id: 'db', kind: 'db', at: [-0.45, 2.95], label: 'metadata DB', sub: 'sharded SQL' };
const cache: SceneNode = { id: 'cache', kind: 'cache', at: [0.85, 1.65], label: 'meta cache', sub: 'Redis' };
const origin: SceneNode = { id: 'origin', kind: 'server', at: [2.15, 0.35], label: 'origin servers', sub: 'long-tail videos' };
const cdn: SceneNode = { id: 'cdn', kind: 'cdn', at: [3.45, -0.95], label: 'CDN edge', sub: 'hot segments' };
const viewer: SceneNode = { id: 'viewer', kind: 'client', at: [4.75, -2.25], label: 'viewer', sub: 'laptop, 8 Mbps' };

// The naive single box.
const mono: SceneNode = { id: 'mono', kind: 'server', at: [-0.125, -0.625], label: 'video server', sub: 'disk + MySQL' };

// Transcoding DAG layout (its own nodes).
const dsrc: SceneNode = { id: 'dsrc', kind: 'storage', at: [-3.7, 3.7], label: 'raw video', sub: '5 min, 400 MB' };
const dsplit: SceneNode = { id: 'dsplit', kind: 'worker', at: [-2.3, 2.3], label: 'inspect + split', sub: '75 segments' };
const encHd: SceneNode = { id: 'encHd', kind: 'worker', at: [-2.55, -0.75], label: 'encode HD', sub: '1080p, 720p' };
const encSd: SceneNode = { id: 'encSd', kind: 'worker', at: [0.75, 2.55], label: 'encode SD', sub: '480p, 360p, 240p' };
const thumbs: SceneNode = { id: 'thumbs', kind: 'worker', at: [-1.15, -2.15], label: 'thumbnails', sub: '3 frames' };
const audio: SceneNode = { id: 'audio', kind: 'worker', at: [2.15, 1.15], label: 'audio', sub: 'AAC 128 kbps' };
const pack: SceneNode = { id: 'pack', kind: 'worker', at: [1.9, -1.9], label: 'package', sub: 'HLS playlists' };
const dout: SceneNode = { id: 'dout', kind: 'storage', at: [3.3, -3.3], label: 'renditions', sub: '5 qualities' };

const uploadLinks = [
  { from: 'creator', to: 'raw' },
  { from: 'raw', to: 'queue' },
  { from: 'queue', to: 'workers' },
  { from: 'workers', to: 'rend' },
];

export const designYoutube: Lesson = {
  id: 'design-youtube',
  title: 'Design YouTube',
  tagline: 'Take a 400 MB phone video, turn it into five streamable qualities in two minutes, and serve 11 PB a day without going broke.',
  minutes: 24,
  level: 'Advanced',
  learn: [
    'Scale numbers, the API and the data model for a video platform',
    'Uploads through pre-signed URLs, in resumable parts, straight to object storage',
    'The transcoding pipeline as a DAG of small tasks spread over a worker pool',
    'Renditions, segments and adaptive bitrate streaming',
    'What the CDN costs, and how to treat the long tail of cold videos',
    'Pipeline failures, upload surges and keeping uploads and videos safe',
  ],
  metrics: [
    { key: 'plays', label: 'Peak plays' },
    { key: 'uploads', label: 'Peak uploads' },
    { key: 'storage', label: 'New storage' },
    { key: 'egress', label: 'Egress' },
    { key: 'ready', label: 'Upload to ready' },
  ],
  steps: [
    {
      title: 'Requirements',
      tag: 'problem',
      heading: 'Two flows, very different sizes',
      eli5: 'A bakery takes giant cakes from bakers and sells slices to a whole city. The **video service** is that bakery: few cakes come in, millions of slices go out.',
      body: [
        'Scope it to the two flows that matter: a creator **uploads** a video, and viewers **watch** it on phones, laptops and TVs, anywhere in the world. Comments, likes and recommendations are out of scope. Assume **20 million daily viewers** watching 6 videos each, and **100,000 uploads a day** averaging 400 MB (about five minutes of phone video).',
        'Do the napkin math from the napkin math lesson. Plays: 120 million a day, about 1,400 per second, so **3,000 per second at peak**. Uploads: just over 1 per second, 3 at peak. Raw storage: 100,000 x 400 MB = **40 TB a day** before we make any copies. If an average play streams 90 MB, egress is 120 million x 90 MB, about **11 PB a day**, roughly 1 Tbps around the clock.',
        'The ratio tells you where the money goes. Writes are tiny in count and huge in bytes, reads are bytes out to the whole planet. Targets: a new video is playable within **5 minutes** of upload, playback starts in under 2 seconds, and nothing a creator uploads is ever lost.',
      ],
      keyIdea: 'A video platform is a small write path that makes huge files and a giant read path that ships bytes, and the bytes out dominate the cost.',
      metrics: { plays: '3,000/s', uploads: '3/s', storage: '40 TB/day raw', egress: '11 PB/day', ready: 'target < 5 min' },
      scene: {
        nodes: [
          { ...creator, status: 'active' },
          { ...mono, kind: 'internet', label: 'video service', sub: 'to be designed', badge: '?' },
          { ...viewer, badge: '120M plays/day' },
          rider,
        ],
        links: [
          { from: 'creator', to: 'mono' },
          { from: 'mono', to: 'viewer' },
          { from: 'mono', to: 'rider' },
        ],
        flows: [
          { path: ['creator', 'mono'], tone: 'request', label: '400 MB', duration: 2.4 },
          { path: ['mono', 'viewer'], tone: 'response', count: 4, duration: 1.2, delay: 0.6 },
          { path: ['mono', 'rider'], tone: 'response', count: 4, duration: 1.2, delay: 1 },
        ],
        caption: '100K uploads in, 120M plays out, every day',
      },
    },
    {
      title: 'API and data',
      tag: 'concept',
      heading: 'A small API and a status column',
      eli5: 'The bakery keeps an order book. Each cake gets a line saying who baked it and whether it is still in the oven, ready to sell, or burnt. That book is the **metadata database**.',
      body: [
        'Uploads take three calls. `POST /v1/videos` creates the video row and returns where to send the bytes. The client sends the bytes. `POST /v1/videos/{id}/complete` says it is done. Watching takes one: `GET /v1/videos/{id}` returns the title, the status and a **manifest URL** the player streams from. The video bytes never go through this API, as you will see.',
        'The data model has two worlds. **Metadata** (title, owner, status, duration, which qualities exist) is small, structured and read constantly, so it lives in a SQL database. **Blobs** (the original file, the encoded segments, thumbnails) are huge and immutable, so they live in object storage and the database only holds their keys.',
        'The `status` column drives the whole lifecycle: `uploading`, `processing`, `ready`, `failed` or `blocked`. Every part of the system moves a video forward by changing that one field, and the watch page shows the video only when it reads `ready`.',
      ],
      keyIdea: 'Keep small structured metadata in SQL and big immutable blobs in object storage, joined by a key, and drive the lifecycle with one status field.',
      metrics: { plays: '3,000/s', uploads: '3/s', storage: '40 TB/day raw', egress: '11 PB/day', ready: 'target < 5 min' },
      scene: {
        nodes: [creator, { ...api, status: 'active' }, { ...db, status: 'active', badge: 'status column' }, viewer],
        links: [
          { from: 'creator', to: 'api' },
          { from: 'api', to: 'db' },
          { from: 'viewer', to: 'api', style: 'dashed' },
        ],
        flows: [
          { path: ['creator', 'api'], tone: 'request', label: 'POST /videos', duration: 1.2 },
          { path: ['api', 'db'], tone: 'request', label: 'INSERT uploading', duration: 0.9, delay: 1.3 },
          { path: ['viewer', 'api'], tone: 'request', label: 'GET /videos/42', duration: 1.4, delay: 2.4 },
          { path: ['api', 'viewer'], tone: 'response', label: 'manifest URL', duration: 1.4, delay: 3.9 },
        ],
        caption: 'The API moves metadata, and bytes take another road',
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
      title: 'Simple design',
      tag: 'concept',
      heading: 'Version one: one server does everything',
      eli5: 'At first one baker does it all in a single shop: takes in cakes, re-bakes them, and hands whole cakes to every customer at the door. That one shop is the **video server**.',
      body: [
        'The first design fits on a whiteboard. The creator POSTs the file to a **video server**. It saves the file to local disk, runs one encode to a standard 1080p MP4, writes a MySQL row, and serves the MP4 back to anyone who asks for it.',
        'At a few hundred uploads a day this works. Encoding a five-minute video on one machine takes several minutes, so a creator waits, and viewers download one 190 MB file per play.',
        'Keep the numbers in mind: 40 TB of raw files plus 19 TB of MP4s land every day, and every play pulls the whole file whether the viewer watches ten seconds or five minutes.',
      ],
      keyIdea: 'Start with the simplest thing that works, then find exactly which numbers break it.',
      metrics: { plays: '3,000/s', uploads: '3/s', storage: '59 TB/day', egress: '23 PB/day', ready: '20 min' },
      scene: {
        nodes: [creator, { ...mono, status: 'active', badge: 'upload, encode, serve' }, viewer, rider],
        links: [
          { from: 'creator', to: 'mono' },
          { from: 'mono', to: 'viewer' },
          { from: 'mono', to: 'rider' },
        ],
        flows: [
          { path: ['creator', 'mono'], tone: 'request', label: 'POST 400 MB', duration: 2.2 },
          { path: ['mono', 'viewer'], tone: 'response', label: 'whole MP4', duration: 1.6, delay: 2.4 },
          { path: ['mono', 'rider'], tone: 'response', label: 'whole MP4', duration: 1.6, delay: 2.8 },
        ],
        caption: 'One box takes uploads, encodes and serves',
      },
    },
    {
      title: 'Where it breaks',
      tag: 'case',
      heading: 'The single server fails four ways at once',
      eli5: 'Cakes pile up at the door, the one oven is always busy, customers queue around the block, and the train rider cannot carry a whole cake. The **video server** is overwhelmed.',
      body: [
        '**Uploads tie up the server.** A 400 MB upload over a 10 Mbps home connection takes about five minutes. Hundreds of them in flight hold threads and memory, and a dropped connection at 95% means starting over.',
        '**Encoding is slow and serial.** One machine encoding one quality at a time falls behind a queue of uploads, so "ready" drifts to 20 minutes and beyond. **Playback is one file for everyone.** The 1080p MP4 needs about 5 Mbps. The rider on a train with 1 Mbps stalls every few seconds, and an old TV may not play the codec at all.',
        '**Egress is impossible.** 23 PB a day is over 2 Tbps on average from one place. Viewers in Sydney cross an ocean for every byte. No single network link or server comes close.',
      ],
      keyIdea: 'Upload bytes, encode CPU and playback bandwidth are three separate scaling problems, and none of them belong on the app server.',
      metrics: { plays: '3,000/s', uploads: '3/s', storage: '59 TB/day', egress: '23 PB/day', ready: '20+ min' },
      scene: {
        nodes: [
          { ...creator, status: 'hot', badge: 'upload reset at 95%' },
          { ...mono, status: 'hot', badge: 'CPU 100%, 2 Tbps?' },
          { ...viewer, status: 'hot', badge: 'from far away' },
          { ...rider, status: 'down', badge: 'buffering' },
        ],
        links: [
          { from: 'creator', to: 'mono' },
          { from: 'mono', to: 'viewer' },
          { from: 'mono', to: 'rider' },
        ],
        flows: [
          { path: ['creator', 'mono'], tone: 'error', label: 'connection lost', duration: 2 },
          { path: ['mono', 'viewer'], tone: 'response', count: 3, duration: 2.4, delay: 0.5 },
          { path: ['mono', 'rider'], tone: 'error', label: '5 Mbps file, 1 Mbps link', duration: 2.6, delay: 1 },
        ],
        caption: 'Uploads, encoding and playback all choke on one box',
      },
    },
    {
      title: 'Direct upload',
      tag: 'concept',
      heading: 'Fix 1: upload in parts, straight to object storage',
      eli5: 'Instead of handing the cake to the shopkeeper, the baker gets a signed ticket to drop it at the warehouse door, sliced into boxes so a dropped box can be sent again. That ticket is a **pre-signed URL**.',
      body: [
        'As in the object storage lesson, the API server stops touching bytes. `POST /videos` writes the row as `uploading`, starts a **multipart upload** in the raw bucket and returns one **pre-signed URL** per 16 MB part. Each URL allows exactly one PUT to one key and expires in an hour, so a leaked URL is worth little.',
        'The 400 MB file becomes 25 parts. The client sends 4 at a time, which fills a fast link better than one stream. If the train goes into a tunnel, the client asks which parts landed and resends only the missing ones: a **resumable upload**. On `complete`, storage stitches the parts into one object and the API flips the row to `processing`.',
        'For far-away creators, upload to the nearest region or an edge ingest point and copy to the main region in the background. The API servers now handle three small JSON calls per upload, and scaling them is the load balancing lesson again.',
      ],
      keyIdea: 'Let clients send big bytes straight to object storage with short-lived, single-purpose URLs, in parts that can be retried one at a time.',
      metrics: { plays: '3,000/s', uploads: '3/s', storage: '59 TB/day', egress: '23 PB/day', ready: '20 min' },
      scene: {
        nodes: [
          { ...creator, status: 'active', badge: '4 parts in flight' },
          { ...raw, status: 'active', badge: '25 x 16 MB' },
          { ...api, status: 'ok', badge: 'no video bytes' },
          db,
        ],
        links: [
          { from: 'creator', to: 'api' },
          { from: 'api', to: 'db' },
          { from: 'creator', to: 'raw', label: 'pre-signed PUT' },
        ],
        flows: [
          { path: ['creator', 'api'], tone: 'request', label: 'POST /videos', duration: 1 },
          { path: ['api', 'creator'], tone: 'response', label: '25 part URLs', duration: 1, delay: 1.1 },
          { path: ['creator', 'raw'], tone: 'data', label: 'part n', count: 4, duration: 1.4, delay: 2.2 },
          { path: ['creator', 'api'], tone: 'request', label: 'complete', duration: 1, delay: 3.8 },
          { path: ['api', 'db'], tone: 'request', label: 'processing', duration: 0.9, delay: 4.9 },
        ],
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
      title: 'Transcode DAG',
      tag: 'concept',
      heading: 'Fix 2: transcoding as a graph of small tasks',
      eli5: 'The kitchen cuts the cake into 75 slices, and many cooks frost slices at the same time: big ones, small ones, plus the box photos. Drawn as arrows, the plan is a **DAG**.',
      body: [
        'Transcoding turns one camera file into the formats and sizes every device can play. It is CPU heavy, so we split it into a **directed acyclic graph** of tasks. **Inspect** checks the file is a real, decodable video. **Split** cuts it into 4-second segments at keyframes, so each segment can be encoded on its own. Then **encode** tasks run per segment per quality, **audio** and **thumbnails** run beside them, and **package** writes the playlists when every encode is done.',
        'A five-minute video gives 75 segments x 5 qualities = 375 small encode tasks. A scheduler walks the graph and puts every task whose inputs are ready onto the job queue, and a pool of encoder workers pulls from it (the background jobs lesson). Spread over 100 cores, a job that took 20 minutes serially finishes in about **2 minutes**.',
        'The graph is data, so different pipelines are just different graphs. A creator who supplies a thumbnail skips that node. A partner channel adds a watermark node. Intermediate segments sit in temporary storage, so a failed task reruns from its inputs instead of from the start.',
      ],
      keyIdea: 'Cut the video at keyframes into segments and run encodes as independent tasks in a DAG, so time to ready depends on the worker pool size, not the video length.',
      metrics: { plays: '3,000/s', uploads: '3/s', storage: '77 TB/day', egress: '23 PB/day', ready: '2 min' },
      scene: {
        nodes: [
          dsrc,
          { ...dsplit, status: 'active' },
          { ...encHd, status: 'active', badge: '150 tasks' },
          { ...encSd, status: 'active', badge: '225 tasks' },
          thumbs,
          audio,
          pack,
          { ...dout, status: 'ok' },
        ],
        links: [
          { from: 'dsrc', to: 'dsplit' },
          { from: 'dsplit', to: 'encHd' },
          { from: 'dsplit', to: 'encSd' },
          { from: 'dsplit', to: 'thumbs' },
          { from: 'dsplit', to: 'audio' },
          { from: 'encHd', to: 'pack' },
          { from: 'encSd', to: 'pack' },
          { from: 'audio', to: 'pack' },
          { from: 'pack', to: 'dout' },
          { from: 'thumbs', to: 'dout', style: 'dashed' },
        ],
        flows: [
          { path: ['dsrc', 'dsplit'], tone: 'data', duration: 1 },
          { path: ['dsplit', 'encHd'], tone: 'event', count: 3, duration: 1, delay: 1.1 },
          { path: ['dsplit', 'encSd'], tone: 'event', count: 3, duration: 1, delay: 1.1 },
          { path: ['dsplit', 'thumbs'], tone: 'event', duration: 1, delay: 1.1 },
          { path: ['dsplit', 'audio'], tone: 'event', duration: 1, delay: 1.1 },
          { path: ['encHd', 'pack'], tone: 'data', count: 2, duration: 1, delay: 2.4 },
          { path: ['encSd', 'pack'], tone: 'data', count: 2, duration: 1, delay: 2.4 },
          { path: ['pack', 'dout'], tone: 'data', label: 'playlists', duration: 1, delay: 3.6 },
        ],
        caption: 'Independent tasks run in parallel, package waits for all',
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
      title: 'Adaptive bitrate',
      tag: 'concept',
      heading: 'Fix 3: many qualities, chosen every 4 seconds',
      eli5: 'Each slice comes in big, medium and small. When the road is clear the delivery kid brings big slices. In a traffic jam he brings small ones, so the customer never waits. That switching is **adaptive bitrate**.',
      body: [
        'The encoders produced a **bitrate ladder**: 1080p at 5 Mbps, 720p at 2.8, 480p at 1.4, 360p at 0.8 and 240p at 0.4, each cut into the same 4-second segments. A **master playlist** (HLS) or manifest (DASH) lists the ladder, and each quality has its own playlist of segment URLs. All of it is plain HTTP files.',
        'The player measures how fast the last segments arrived and how much video it has buffered, then picks the quality for the **next** segment. The laptop on 8 Mbps climbs to 1080p. The train rider drops to 360p in the tunnel and climbs back after it, with no stall and no restart, because segments of every quality line up on the same timestamps.',
        'Streaming segment by segment also cuts egress. A viewer who quits after a minute fetched one minute of video, and phones fetch small renditions. The average play falls from a 190 MB file to about 90 MB, which halves egress to **11 PB a day**.',
      ],
      keyIdea: 'Encode a ladder of qualities cut into aligned segments, and let the player pick a quality per segment from measured bandwidth and buffer.',
      metrics: { plays: '3,000/s', uploads: '3/s', storage: '77 TB/day', egress: '11 PB/day', ready: '2 min' },
      scene: {
        nodes: [
          { ...rend, status: 'active', badge: '5 qualities' },
          { ...cdn, status: 'active' },
          { ...viewer, status: 'ok', badge: '1080p' },
          { ...rider, status: 'ok', badge: '360p in tunnel' },
        ],
        links: [
          { from: 'rend', to: 'cdn' },
          { from: 'cdn', to: 'viewer' },
          { from: 'cdn', to: 'rider' },
        ],
        flows: [
          { path: ['viewer', 'cdn'], tone: 'request', label: 'master.m3u8', duration: 1 },
          { path: ['cdn', 'viewer'], tone: 'response', label: 'seg 12 @ 1080p', count: 3, duration: 1, delay: 1.1 },
          { path: ['rider', 'cdn'], tone: 'request', label: 'seg 12 @ 360p', duration: 1, delay: 0.5 },
          { path: ['cdn', 'rider'], tone: 'response', count: 3, duration: 1, delay: 1.6 },
          { path: ['rend', 'cdn'], tone: 'data', duration: 1.2, delay: 2.8 },
        ],
        caption: 'Same segment numbers, different qualities per viewer',
      },
      quiz: {
        question: 'Halfway through a video, a viewer’s bandwidth drops from 8 Mbps to 1 Mbps. What does an adaptive bitrate player do?',
        options: [
          'Restarts the video at a lower quality',
          'Keeps fetching 1080p and waits for the buffer to refill',
          'Requests the next segments from a lower rendition listed in the manifest',
          'Asks the server to re-encode the video at 1 Mbps',
        ],
        answer: 2,
        explain: 'Every rendition is cut into segments on the same timestamps, so the player switches to a smaller rendition at the next segment boundary. Nothing is re-encoded and playback does not restart.',
      },
    },
    {
      title: 'CDN and cold',
      tag: 'tradeoff',
      heading: 'Fix 4: the CDN for hot videos, cheaper paths for the long tail',
      eli5: 'Corner shops near every street keep the popular slices. Rare cakes stay in the central kitchen and get sent out only when someone asks. The corner shops are the **CDN**.',
      body: [
        'Playback goes through a **CDN**, as in the content delivery networks lesson. Segments are immutable, so they cache perfectly: a long TTL, versioned URLs, no purges. A popular video is fetched from storage once per edge and then served from a few kilometers away to millions of viewers. At an assumed 1 cent per GB, 11 PB a day is still about **$110,000 a day**, which is why the bill gets attention.',
        'Views are heavily skewed. A small share of videos gets most of the plays, and most videos are watched a handful of times. A cold video is a cache miss at every edge, takes edge space from hot ones, and still pays for five renditions forever. So treat the tail differently: encode new uploads to two or three qualities and add the full ladder once views pass a threshold, serve long-tail segments from your own **origin servers** where bandwidth is cheaper, push regional hits only to that region, and move originals nobody has watched in a year to an archive storage class.',
        'The catch is that every one of these rules needs view data and has edge cases. A cold video that goes viral needs its missing qualities encoded fast, so the on-demand path must be quick and well tested.',
      ],
      keyIdea: 'Popularity decides where a video lives: hot videos at the edge in every quality, cold ones in fewer qualities on cheaper storage and servers.',
      metrics: { plays: '3,000/s', uploads: '3/s', storage: '55 TB/day', egress: '11 PB/day', ready: '2 min' },
      scene: {
        nodes: [
          { ...rend, status: 'active' },
          { ...origin, status: 'active', badge: 'tail: 2 qualities' },
          { ...cdn, status: 'ok', badge: 'hit 97%' },
          { ...viewer, badge: 'viral video' },
          { ...rider, badge: 'cold video' },
        ],
        links: [
          { from: 'rend', to: 'cdn' },
          { from: 'rend', to: 'origin' },
          { from: 'origin', to: 'rider', style: 'dashed' },
          { from: 'cdn', to: 'viewer' },
        ],
        flows: [
          { path: ['cdn', 'viewer'], tone: 'response', label: 'edge hit', count: 4, duration: 1 },
          { path: ['rend', 'origin'], tone: 'data', duration: 1.2, delay: 1 },
          { path: ['origin', 'rider'], tone: 'response', label: 'from origin', duration: 1.6, delay: 2.3 },
        ],
        caption: 'Hot segments at the edge, the long tail from origin',
      },
    },
    {
      title: 'Metadata',
      tag: 'concept',
      heading: 'Fix 5: metadata database, replicas and cache',
      eli5: 'The order book is copied for the clerks who only read it, and the most asked-about pages are pinned to the wall. The wall is the **cache**.',
      body: [
        'Each watch page, feed tile and search result reads metadata, so 3,000 plays a second becomes about **30,000 metadata reads** a second. Writes are rare: new videos, status changes, edits. Put **read replicas** behind the primary and a **cache** in front, keyed by `video_id`, as in the caching lesson. At a 98% hit rate the database sees about 600 reads a second.',
        'A billion rows outgrow one machine, so shard `videos` by a hash of `video_id` (the sharding lesson). The by-owner index for a channel page is a second table sharded by `owner_id`. View counts are too hot to update row by row, so count them in a stream and write totals every few seconds.',
        'The pipeline reports back through the queue. When `publish` finishes, a **completion handler** updates the row to `ready`, writes the rendition list and deletes the cache key. The watch page then shows the video, and a notification tells the creator.',
      ],
      keyIdea: 'Metadata is small and read-heavy: replicas and a cache for reads, sharding by video id for size, and status changes arriving as events from the pipeline.',
      metrics: { plays: '3,000/s', uploads: '3/s', storage: '55 TB/day', egress: '11 PB/day', ready: '2 min' },
      scene: {
        nodes: [
          workers,
          { ...queue, badge: 'done events' },
          { ...api, status: 'active' },
          { ...db, badge: '600 reads/s' },
          { ...cache, status: 'ok', badge: 'hit 98%' },
          { ...origin, id: 'replica', kind: 'replica', label: 'read replicas', sub: 'x 3' },
          viewer,
        ],
        links: [
          { from: 'workers', to: 'queue' },
          { from: 'queue', to: 'api', style: 'dashed' },
          { from: 'api', to: 'db' },
          { from: 'api', to: 'cache' },
          { from: 'db', to: 'replica', style: 'dashed' },
          { from: 'viewer', to: 'api' },
        ],
        flows: [
          { path: ['viewer', 'api'], tone: 'request', label: 'GET /videos/42', duration: 1.4 },
          { path: ['api', 'cache'], tone: 'request', duration: 0.8, delay: 1.5 },
          { path: ['cache', 'api'], tone: 'response', label: 'hit', duration: 0.8, delay: 2.4 },
          { path: ['workers', 'queue', 'api'], tone: 'event', label: 'video ready', duration: 1.6, delay: 0.6 },
          { path: ['api', 'db'], tone: 'request', label: 'status=ready', duration: 0.9, delay: 2.4 },
          { path: ['db', 'replica'], tone: 'data', duration: 0.9, delay: 3.4 },
        ],
        caption: 'Reads hit the cache, and the pipeline reports back by event',
      },
    },
    {
      title: 'Pipeline failures',
      tag: 'case',
      heading: 'Case: crashed workers, bad files and a 10x upload surge',
      eli5: 'Each cook signs out one slice for ten minutes. That sign-out is a **lease**: if the cook faints, the slice goes back on the pile for another cook. A rotten cake goes straight back to its baker.',
      body: [
        'Sort errors into two kinds. **Recoverable**: a worker dies or a segment encode times out. Each task is taken with a **lease** (the background jobs lesson). If the worker stops heartbeating, the lease expires and the task goes back on the queue for another worker. Outputs are written to fixed keys like `720p/seg_0042.ts`, so a rerun overwrites instead of duplicating. After three failed tries the task goes to a **dead-letter queue** for a human.',
        '**Non-recoverable**: the file is corrupt or not a video. Inspect catches it in seconds, stops the graph, sets the status to `failed` and tells the creator why. Retrying a broken file only burns CPU.',
        'Then the crisis: a big live event ends and uploads jump from 3 to **30 a second**. Queue depth climbs past 40,000 tasks and time to ready reaches 35 minutes. Nothing is lost, since the queue absorbs the burst (the message queues lesson). The pool autoscales on queue depth, and a priority queue runs short videos and big channels first. Within half an hour ready time is back to 3 minutes.',
      ],
      keyIdea: 'Retry recoverable failures per task with leases and idempotent outputs, fail fast on bad input, and let the queue absorb surges while workers scale on its depth.',
      metrics: { plays: '3,000/s', uploads: '30/s', storage: '55 TB/day', egress: '11 PB/day', ready: '35 min' },
      scene: {
        nodes: [
          { ...creator, badge: '10x uploads' },
          raw,
          { ...queue, status: 'hot', badge: 'depth 40,000' },
          { ...workers, status: 'hot', badge: '1 node down' },
          rend,
          { ...cache, id: 'dlq', kind: 'queue', label: 'dead letters', sub: 'after 3 tries' },
          api,
          { ...db, badge: 'bad file: failed' },
        ],
        links: [...uploadLinks, { from: 'queue', to: 'dlq', style: 'dashed' }, { from: 'api', to: 'db' }, { from: 'workers', to: 'api', style: 'dashed' }],
        flows: [
          { path: ['creator', 'raw'], tone: 'data', count: 6, duration: 1 },
          { path: ['raw', 'queue'], tone: 'event', count: 6, duration: 0.9, delay: 0.8 },
          { path: ['queue', 'workers'], tone: 'request', count: 3, duration: 0.9, delay: 1.7 },
          { path: ['workers', 'queue'], tone: 'error', label: 'lease expired, requeue', duration: 1, delay: 2.7 },
          { path: ['queue', 'dlq'], tone: 'error', label: 'poison task', duration: 1, delay: 3.6 },
          { path: ['workers', 'api', 'db'], tone: 'error', label: 'corrupt file', duration: 1.8, delay: 2 },
        ],
        caption: 'The queue absorbs the surge, failed tasks retry or park',
      },
    },
    {
      title: 'Safety',
      tag: 'tradeoff',
      heading: 'Safe uploads, protected videos and takedowns',
      eli5: 'The bakery checks every cake before selling it, stamps its name on the box, and locks special cakes so only paying customers get the key. That key comes from the **key server**.',
      body: [
        '**Uploads are hostile input.** Pre-signed URLs are scoped to one key, expire fast and carry a size limit. Media parsers have a long record of security bugs, so inspect and encode run in sandboxed workers with no network access beyond storage. The same pass checks for known banned content by hash and runs classifiers, and a video can go to `blocked` before it is ever `ready`. User flags trigger the same path later: set `blocked`, and every page stops serving it.',
        '**Protect paid or premium videos.** Encrypt segments with AES and hand keys only to signed-in, entitled players through a license or **key server**, or use a full DRM system for studio content. Playback URLs can be signed with short expiry so the CDN refuses hot-linked requests. A visible watermark helps prove ownership after a copy leaks.',
        'Each layer costs something: DRM adds a license round trip before playback starts, and moderation adds minutes to time to ready for borderline videos. Most platforms apply the heavy options per channel or per video.',
      ],
      keyIdea: 'Treat every upload as untrusted, sandbox the code that parses it, and protect valuable videos with encryption, signed URLs and keys that only entitled viewers receive.',
      metrics: { plays: '3,000/s', uploads: '3/s', storage: '55 TB/day', egress: '11 PB/day', ready: '3 min' },
      scene: {
        nodes: [
          creator,
          raw,
          { ...workers, status: 'active', badge: 'sandbox: scan + mark' },
          rend,
          { ...api, badge: 'URL expires 1 h' },
          { ...origin, id: 'keys', kind: 'vault', label: 'key server', sub: 'licenses' },
          cdn,
          { ...viewer, status: 'ok', badge: 'entitled' },
        ],
        links: [
          { from: 'creator', to: 'raw' },
          { from: 'raw', to: 'workers' },
          { from: 'workers', to: 'rend' },
          { from: 'rend', to: 'cdn' },
          { from: 'cdn', to: 'viewer' },
          { from: 'viewer', to: 'keys', style: 'dashed' },
          { from: 'creator', to: 'api', style: 'dashed' },
        ],
        flows: [
          { path: ['creator', 'raw'], tone: 'data', label: 'signed PUT', duration: 1.2 },
          { path: ['raw', 'workers'], tone: 'request', label: 'scan', duration: 1, delay: 1.3 },
          { path: ['workers', 'rend'], tone: 'data', label: 'encrypted segs', duration: 1, delay: 2.4 },
          { path: ['viewer', 'keys'], tone: 'handshake', label: 'license?', duration: 1.2, delay: 1 },
          { path: ['keys', 'viewer'], tone: 'handshake', label: 'key', duration: 1.2, delay: 2.3 },
          { path: ['cdn', 'viewer'], tone: 'response', count: 3, duration: 1, delay: 3.6 },
        ],
        caption: 'Scan on the way in, keys on the way out',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Two pipelines, sized for their own bottleneck',
      eli5: 'Cakes come in the back door with a ticket, get cut and baked into many sizes, and corner shops hand out slices sized to each customer’s road. The whole thing is a **video platform**.',
      body: [
        'Upload: three small API calls and pre-signed, resumable multipart uploads straight to the raw bucket. Processing: a DAG of per-segment tasks on a queue-fed, autoscaled worker pool, ready in about 2 minutes, with leases, idempotent outputs and a dead-letter queue for failures. Playback: a five-step bitrate ladder in 4-second segments, served by the CDN, chosen per segment by the player.',
        'Around it: sharded metadata with replicas and a cache, status driven by pipeline events, popularity-based treatment of the long tail to keep storage near 55 TB a day, and sandboxing, encryption and signed URLs for safety. Egress at 11 PB a day stays the biggest bill, which is why every byte saved on the read path matters most.',
      ],
      keyIdea: 'Separate the paths by what they move: JSON through the API, uploads to object storage, CPU work to a queue of small tasks, and video bytes through the CDN.',
      metrics: { plays: '3,000/s', uploads: '3/s', storage: '55 TB/day', egress: '11 PB/day', ready: '2 min' },
      scene: {
        nodes: [creator, raw, queue, workers, { ...rend, status: 'ok' }, api, db, { ...cdn, status: 'ok' }, viewer],
        links: [...uploadLinks, { from: 'creator', to: 'api', style: 'dashed' }, { from: 'api', to: 'db' }, { from: 'rend', to: 'cdn' }, { from: 'cdn', to: 'viewer' }],
        flows: [
          { path: ['creator', 'raw', 'queue', 'workers', 'rend'], tone: 'data', duration: 3.2 },
          { path: ['rend', 'cdn'], tone: 'data', duration: 1, delay: 3.2 },
          { path: ['cdn', 'viewer'], tone: 'response', count: 3, duration: 1, delay: 1 },
          { path: ['creator', 'api', 'db'], tone: 'request', duration: 1.6, delay: 0.3 },
        ],
      },
      quiz: {
        question: 'An encoder crashes while encoding segment 42 of a video at 720p. What should the pipeline do?',
        options: [
          'Restart the whole video from the inspect step',
          'Let the task lease expire and rerun only that segment task on another worker',
          'Mark the video as failed and ask the creator to upload again',
          'Skip segment 42 and package the rest',
        ],
        answer: 1,
        explain: 'Tasks are small and independent. The lease returns the one task to the queue, another worker reruns it from the saved segment, and because output keys are fixed the rerun overwrites any partial result.',
      },
    },
  ],
};
