import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const phone: SceneNode = { id: 'phone', kind: 'phone', at: at(-4, -2.5), label: 'photo app', sub: '200K uploads/day' };
const app: SceneNode = { id: 'app', kind: 'block', at: at(0, -2.5), label: 'app servers', sub: 'JSON API', icon: 'Server', tint: 'violet' };
const db: SceneNode = { id: 'db', kind: 'db', at: at(4, -2.5), label: 'Postgres', sub: 'photo rows' };
const bucket: SceneNode = { id: 'bucket', kind: 'storage', at: at(0, 2.8), label: 'bucket', sub: 'photos-prod', tint: 'teal' };

export const objectStorage: Lesson = {
  id: 'object-storage',
  title: 'Object storage (part 1)',
  tagline: 'Move photos, videos and backups out of database rows into a store built for bytes, and upload to it directly.',
  minutes: 15,
  level: 'Intermediate',
  learn: [
    'Why large files hurt a database, and what a bucket, a key and metadata are',
    'The flat namespace, key design, and what the consistency promise covers',
    'Direct uploads with pre-signed URLs, so file bytes skip your app servers',
    'Safe signing rules, signed downloads, and multipart upload for large files on bad connections',
  ],
  metrics: [
    { key: 'db', label: 'DB growth', icon: 'Database' },
    { key: 'app', label: 'Bytes via app', icon: 'Server' },
    { key: 'flight', label: 'Uploads in flight', icon: 'Activity' },
    { key: 'resend', label: 'Resend on failure', icon: 'Repeat' },
  ],
  steps: [
    {
      title: 'Fat rows',
      tag: 'problem',
      heading: 'The photos live inside the database',
      eli5: 'The teacher keeps a thin notebook with one line per child. That notebook is the **database**. Now every child glues a big painting onto their line, and the notebook is too fat to open.',
      body: [
        'A photo app stores each upload in Postgres, in a `BYTEA` column next to the caption and the owner. It was the quickest thing to build and it worked for the first thousand users.',
        'Now people upload **200,000 photos a day** at about 5 MB each. That is **1 TB of new data every day** in a database whose other tables add up to 40 GB.',
      ],
      keyIdea: 'A database is built for many small rows it can index and join. Megabyte blobs get none of that benefit.',
      metrics: { db: '1 TB/day', app: '1 TB/day', flight: '-', resend: '-' },
      metricTones: { db: 'bad', app: 'bad' },
      scene: {
        nodes: [
          { ...phone, chips: ['POST photo 5 MB'] },
          { ...app, status: 'active' },
          { ...db, status: 'hot', sub: 'rows + 5 MB photos', badge: '+1 TB every day', load: 90 },
        ],
        links: [link('phone', 'app'), link('app', 'db')],
        flows: [
          { path: ['phone', 'app'], tone: 'request', label: 'POST photo 5 MB', count: 3, duration: 1.6 },
          { path: ['app', 'db'], tone: 'data', label: 'INSERT bytea', count: 3, duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'One day of uploads',
          icon: 'Table',
          rows: [
            { text: 'Photos per day', value: '200,000' },
            { text: 'Size of each', value: '5 MB' },
            { text: 'New data per day', value: '1 TB', tone: 'bad' },
            { text: 'All other tables', value: '40 GB', tone: 'good' },
          ],
          footer: { text: 'Photos outgrow everything else by 25x a day', tone: 'bad' },
        },
        caption: 'Every photo becomes a 5 MB row',
      },
    },
    {
      title: 'Heavy rows',
      tag: 'problem',
      heading: 'Big rows slow down everything around them',
      eli5: 'A notebook full of glued-on paintings is slow to flip. The teacher cannot find the small notes, and photocopying the whole thing for the other classrooms takes all night.',
      body: [
        'Reading a photo drags megabytes through the memory cache and pushes out the small hot rows the cache exists for. Every photo is also written to the write-ahead log and shipped to each replica.',
        'The nightly backup used to take 10 minutes and now runs for hours, all on the most expensive disk you own.',
      ],
      keyIdea: 'Blobs tax the cache, the log, the replicas and the backup, so every query on small rows gets slower.',
      metrics: { db: '1 TB/day', app: '1 TB/day', flight: '-', resend: '-' },
      metricTones: { db: 'bad', app: 'bad' },
      scene: {
        nodes: [
          { ...db, status: 'hot', load: 94 },
          { id: 'cache', kind: 'cache', at: at(0, -2.5), label: 'buffer cache', sub: 'small hot rows', status: 'hot', badge: 'evicted by photos' },
          { id: 'replica', kind: 'replica', at: at(4, 3.8), label: 'replica', sub: 'lagging', status: 'hot' },
        ],
        links: [link('cache', 'db', { arrow: 'both' }), link('db', 'replica', { label: 'WAL: every photo', labelTone: 'warn' })],
        flows: [
          { path: ['db', 'cache'], tone: 'data', label: '5 MB photo', duration: 1.4 },
          { path: ['db', 'replica'], tone: 'data', label: 'copy of 5 MB', count: 3, duration: 1.8, delay: 1.5 },
        ],
        panel: {
          title: 'What gets worse',
          icon: 'TrendingUp',
          rows: [
            { text: 'Nightly backup', value: '10 min to hours', tone: 'bad' },
            { text: 'Cache for hot rows', value: 'pushed out', tone: 'bad' },
            { text: 'Replica copying', value: '1 TB/day', tone: 'bad' },
            { text: 'Disk used', value: 'most expensive', tone: 'warn' },
          ],
        },
        caption: 'One kind of data hurts four things',
      },
    },
    {
      title: 'Bucket and key',
      tag: 'concept',
      heading: 'An object store keeps bytes under a name',
      eli5: 'Paintings move to an art cupboard. Each one gets a shelf label, and that label is its **key**. The cupboard does one job: hand back the painting for a label.',
      body: [
        'An **object store** (Amazon S3, Google Cloud Storage, Azure Blob Storage, Cloudflare R2, or MinIO if you host it yourself) is cheap, durable storage for files. You create a **bucket**, a named container, and put **objects** in it.',
        'Each object has a **key** such as `photos/7/8f3a9c.jpg`, the bytes, and a little **metadata**: content type, size, a checksum and any tags you add.',
      ],
      keyIdea: 'An object is a key, some bytes and metadata, living in a named bucket.',
      metrics: { db: '1 TB/day', app: '1 TB/day', flight: '-', resend: '-' },
      scene: {
        nodes: [
          { ...bucket, at: at(-4, 0), status: 'active' },
          { id: 'key', kind: 'block', at: at(0, -3.6), label: 'key', sub: 'photos/7/8f3a9c.jpg', icon: 'Key', tint: 'amber' },
          { id: 'bytes', kind: 'block', at: at(4, 0), label: 'bytes', sub: '5 MB JPEG', icon: 'Image', tint: 'blue' },
          { id: 'meta', kind: 'block', at: at(0, 3.6), label: 'metadata', sub: 'type, size, checksum', icon: 'List', tint: 'green' },
        ],
        links: [link('bucket', 'key'), link('bucket', 'bytes'), link('bucket', 'meta')],
        flows: [{ path: ['key', 'bucket', 'bytes'], tone: 'request', label: 'key finds bytes', duration: 2 }],
        panel: {
          title: 'Where to use one',
          icon: 'HardDrive',
          rows: [
            { text: 'Images, video, uploads' },
            { text: 'Backups and build artifacts' },
            { text: 'Logs and data-lake files' },
          ],
          footer: { text: 'Anything large that is not row-like', tone: 'muted' },
        },
        caption: 'Key to bytes, with metadata attached',
      },
    },
    {
      title: 'Flat names',
      tag: 'concept',
      heading: 'The namespace is flat and the API is plain HTTP',
      eli5: 'The cupboard has no rooms or drawers, only labels. A label like "paintings/maya/cat" is one long name. You can ask for every label starting with "paintings/maya", but you cannot repaint half of one.',
      body: [
        'The API works on whole objects over HTTP: `PUT`, `GET`, `DELETE`, and `LIST` by key prefix. A slash in a key is an ordinary character. The folders in a console are a prefix filter.',
        'You cannot edit the middle of an object. To change one, upload a replacement under the same key.',
      ],
      keyIdea: 'Objects are written and read whole by key. Folders are only a prefix filter on a flat list.',
      metrics: { db: '1 TB/day', app: '1 TB/day', flight: '-', resend: '-' },
      scene: {
        nodes: [
          { ...app, chips: ['PUT photos/7/a.jpg', 'GET photos/7/a.jpg'] },
          { ...bucket, at: at(4, 2.8), status: 'active', chips: ['LIST prefix photos/7/'] },
          { id: 'prefix', kind: 'block', size: 0.8, at: at(-4, 2.8), label: 'folders', sub: 'only a prefix filter', icon: 'Layers', tint: 'gray' },
        ],
        links: [link('app', 'bucket', { label: 'HTTPS' }), link('prefix', 'bucket', { style: 'dashed' })],
        flows: [
          { path: ['app', 'bucket'], tone: 'request', label: 'PUT whole object', duration: 1.4 },
          { path: ['bucket', 'app'], tone: 'response', label: '200', duration: 1.2, delay: 1.5 },
        ],
        panel: {
          title: 'The whole API',
          icon: 'Code',
          code: 'PUT    /photos/7/a.jpg   write all\nGET    /photos/7/a.jpg   read all\nDELETE /photos/7/a.jpg   remove\nGET    /?prefix=photos/7/ list keys',
          footer: { text: 'No edit-in-place, no joins', tone: 'muted' },
        },
        caption: 'Four calls on whole objects',
      },
    },
    {
      title: 'Row plus key',
      tag: 'concept',
      heading: 'Split the photo: facts in a row, bytes in a bucket',
      eli5: 'The notebook only writes down the shelf label, so it is thin again. To see a painting, you read the label and walk to the cupboard.',
      body: [
        'The database goes back to what it is good at. Each photo is one small row with the owner, the caption and the object key. "Photos by user 7, newest first" is still a SQL query.',
        'The store cannot answer that kind of question, so the row and the object always travel as a pair.',
      ],
      keyIdea: 'Searchable facts go in a database row, raw bytes go in a bucket, and the object key joins them.',
      metrics: { db: '100 MB/day', app: '1 TB/day', flight: '-', resend: '-' },
      metricTones: { db: 'good' },
      scene: {
        nodes: [
          { ...app, status: 'active' },
          { ...db, status: 'ok', badge: 'key + caption', sub: '~500 bytes a row' },
          { ...bucket, status: 'active', badge: '5 MB object' },
        ],
        links: [link('app', 'db'), link('app', 'bucket')],
        flows: [
          { path: ['app', 'bucket'], tone: 'data', label: 'PUT photos/7/8f3a.jpg', duration: 1.4 },
          { path: ['app', 'db'], tone: 'request', label: 'INSERT key', duration: 1, delay: 1.5 },
        ],
        panel: {
          title: 'A photos row',
          icon: 'Table',
          rows: [
            { text: 'user_id', value: '7' },
            { text: 'object_key', value: 'photos/7/8f3a.jpg' },
            { text: 'bytes', value: '5,242,880' },
            { text: 'caption', value: 'my cat' },
          ],
          footer: { text: 'About 500 bytes, not 5 MB', tone: 'good' },
        },
        caption: 'The row is small. The photo is somewhere else.',
      },
      code: {
        language: 'python',
        title: 'Store the bytes in the bucket and the key in the row',
        source: `import boto3, uuid

s3 = boto3.client("s3")
BUCKET = "photos-prod"

def save_photo(user_id, data, caption):
    key = f"photos/{user_id}/{uuid.uuid4()}.jpg"
    s3.put_object(Bucket=BUCKET, Key=key, Body=data,
                  ContentType="image/jpeg")
    db.execute(
        "INSERT INTO photos (user_id, object_key, bytes, caption)"
        " VALUES (%s, %s, %s, %s)",
        user_id, key, len(data), caption)    # the row stores only the key
    return key`,
        highlight: [7, 8, 11, 13],
      },
    },
    {
      title: 'Key design',
      tag: 'concept',
      heading: 'Spread keys so no one partition gets hot',
      eli5: 'If every painting label starts with today\'s date, all children crowd at one cupboard door. Start labels with a random code and the children spread across all the doors.',
      body: [
        'Keys that share a leading pattern, such as a timestamp, can land on one internal partition and make it a hot spot.',
        'S3 allows about 3,500 writes and 5,500 reads per second per prefix, so sequential prefixes only hurt past that or on other stores.',
        'Lead with a well-spread id and put dates later. Never put emails in a key, since keys show up in URLs and logs.',
      ],
      keyIdea: 'Begin keys with a well-spread value. A random id after a user id keeps load even and keeps keys private.',
      metrics: { db: '100 MB/day', app: '1 TB/day', flight: '-', resend: '-' },
      scene: {
        nodes: [
          { id: 'p1', kind: 'storage', at: at(-4, 3.6), label: 'partition 1', sub: '2024-06-01/...', status: 'hot', load: 95 },
          { id: 'p2', kind: 'storage', at: at(0, 3.6), label: 'partition 2', status: 'dim', load: 5 },
          { id: 'p3', kind: 'storage', at: at(4, 3.6), label: 'partition 3', status: 'dim', load: 5 },
          { ...app, chips: ['PUT 2024-06-01/a.jpg'] },
        ],
        links: [link('app', 'p1', { label: 'date-first keys', labelTone: 'warn' }), link('app', 'p2', { style: 'faint' }), link('app', 'p3', { style: 'faint' })],
        flows: [{ path: ['app', 'p1'], tone: 'error', label: 'all writes pile on', count: 4, duration: 1.8 }],
        panel: {
          title: 'Two key shapes',
          icon: 'Key',
          rows: [
            { text: '2024-06-01/user7/a.jpg', value: 'hot spot', tone: 'bad' },
            { text: 'photos/7/8f3a9c.jpg', value: 'spread out', tone: 'good' },
            { text: 'S3: about 3,500 PUT/s per prefix', tone: 'muted' },
          ],
          footer: { text: 'Hashed or random prefixes avoid hot partitions', tone: 'muted' },
        },
        caption: 'Same-looking keys stack on one partition',
      },
    },
    {
      title: 'Consistency',
      tag: 'concept',
      heading: 'What you read right after a write',
      eli5: 'After a child puts a painting in the cupboard, the next child asking for that label gets it. The long list of everything in the cupboard is also right, but it shows only a page at a time and cannot tell you which paintings are red.',
      body: [
        'Since December 2020, S3 is **strongly consistent** for `GET` and `LIST`: after a successful `PUT`, the next `GET` or `LIST` sees it. Other S3-compatible stores may still list eventually, so check yours.',
        'Still, do not use `LIST` as your index. It returns at most 1,000 keys per call, it is slow, and it cannot filter on content. Your database row is the source of truth for which photos exist.',
      ],
      keyIdea: 'Reads and lists of a written key are current on S3. Use the database, not LIST, to know what exists.',
      metrics: { db: '100 MB/day', app: '1 TB/day', flight: '-', resend: '-' },
      scene: {
        nodes: [
          { ...app, status: 'active' },
          { ...bucket, at: at(4, -2.5), status: 'ok', badge: 'new bytes' },
          { ...db, at: at(0, 4), status: 'ok', badge: 'source of truth' },
        ],
        links: [link('app', 'bucket'), link('app', 'db')],
        flows: [
          { path: ['app', 'bucket'], tone: 'data', label: 'PUT a.jpg', duration: 1.2 },
          { path: ['app', 'bucket', 'app'], tone: 'response', label: 'GET a.jpg: new bytes', duration: 1.8, delay: 1.3 },
          { path: ['app', 'db'], tone: 'request', label: 'which photos exist?', duration: 1.2, delay: 3.2 },
        ],
        panel: {
          title: 'After PUT returns 200',
          icon: 'Clock',
          rows: [
            { text: 'GET the same key', value: 'new bytes', tone: 'good' },
            { text: 'Overwrite then GET', value: 'new version', tone: 'good' },
            { text: 'LIST: consistent on S3, but paginated and not an index', tone: 'warn' },
          ],
        },
        caption: 'Ask the database what exists, the bucket for bytes',
      },
      quiz: {
        question: 'Photo keys look like `2024-06-01/user7/a.jpg` and traffic is heavy. What is the best change?',
        options: [
          'Start keys with a well-spread value such as a user id or random id, and put the date later',
          'Put the date even earlier in the key',
          'Use one very long key per photo',
          'Move the bytes back into Postgres',
        ],
        answer: 0,
        explain: 'Keys that share a leading pattern can pile onto one partition. A well-spread prefix keeps load even.',
      },
    },
    {
      title: 'Proxy tax',
      tag: 'case',
      heading: 'Case: every byte still crosses the app servers',
      eli5: 'Every child hands their painting to the teacher, and the teacher walks it to the cupboard. The teacher is a **proxy**, a go-between, and does nothing else all day.',
      body: [
        'The database is healthy again, but uploads still go phone to app server to bucket. On a 5 Mbit/s uplink a 5 MB photo takes 8 seconds, and the server buffers it the whole time.',
        'At the evening peak about 25 uploads start per second, so around **200 are in flight**. Each pins a worker and megabytes of memory on a machine sized for 50 ms JSON requests. Every byte also moves twice, in and out.',
      ],
      keyIdea: 'An app server that relays file bytes spends workers and bandwidth on a job the store could take directly.',
      metrics: { db: '100 MB/day', app: '1 TB/day', flight: '200', resend: '-' },
      metricTones: { app: 'bad', flight: 'bad' },
      scene: {
        nodes: [
          { ...phone, chips: ['5 MB, 8 s'] },
          { ...app, status: 'hot', load: 92, badge: '200 uploads in flight' },
          bucket,
        ],
        links: [link('phone', 'app', { label: '5 Mbit/s uplink', labelTone: 'warn' }), link('app', 'bucket', { label: 'same 5 MB again', labelTone: 'warn' })],
        flows: [
          { path: ['phone', 'app'], tone: 'data', label: '5 MB, 8 s', count: 5, duration: 2.6 },
          { path: ['app', 'bucket'], tone: 'data', label: 'relay', count: 5, duration: 1.6, delay: 2.2 },
        ],
        panel: {
          title: 'Evening peak',
          icon: 'Gauge',
          rows: [
            { text: 'Uploads starting', value: '25 / s' },
            { text: 'Seconds each', value: '8 s' },
            { text: 'In flight', value: '200', tone: 'bad' },
            { text: 'App work done on bytes', value: 'none', tone: 'warn' },
          ],
        },
        caption: 'The app relays bytes it never looks at',
      },
    },
    {
      title: 'Pre-signed URL',
      tag: 'concept',
      heading: 'A signed link grants one narrow permission',
      eli5: 'The teacher writes a hall pass: "this child may put one painting on shelf 42 in the next five minutes". That pass is a **pre-signed URL**. The cupboard keeper checks the teacher\'s signature, not the teacher.',
      body: [
        'A **pre-signed URL** is an ordinary object URL with a signature in its query string. Your server builds it with its own credentials.',
        'The signature covers one method, one bucket, one key and an expiry time. The store checks it on its own and never calls your app.',
      ],
      keyIdea: 'Your server signs a narrow, short-lived permission, and the store can verify it without asking you.',
      metrics: { db: '100 MB/day', app: '200 MB/day', flight: '-', resend: '-' },
      scene: {
        nodes: [
          { ...app, status: 'ok', badge: 'signs with its key' },
          { id: 'sig', kind: 'block', at: at(0, 4), label: 'signed URL', sub: 'PUT, key, 5 min', icon: 'Key', tint: 'amber' },
          { ...bucket, at: at(4, 2.8), status: 'active', badge: 'checks signature' },
        ],
        links: [link('app', 'sig'), link('sig', 'bucket', { label: 'no call to app' })],
        flows: [{ path: ['app', 'sig', 'bucket'], tone: 'handshake', label: 'signature ok', duration: 2.2 }],
        panel: {
          title: 'What the signature covers',
          icon: 'Shield',
          rows: [
            { text: 'Method', value: 'PUT' },
            { text: 'Bucket', value: 'photos-prod' },
            { text: 'Key', value: 'photos/7/8f3a.jpg' },
            { text: 'Expires', value: '5 minutes', tone: 'good' },
          ],
          footer: { text: 'Anything else is rejected', tone: 'muted' },
        },
        caption: 'One permission, checked by the store itself',
      },
    },
    {
      title: 'Upload slot',
      tag: 'concept',
      heading: 'Step one: the app hands out an upload slot',
      eli5: 'A child asks the teacher for a hall pass. The teacher checks who they are, picks the shelf, writes the pass, and jots "painting coming" in the notebook.',
      body: [
        'The phone asks the app for an upload slot. The app checks the user, picks the key, signs a PUT URL that lasts 5 minutes and saves a `pending` row.',
        'This is a tiny JSON request. No photo bytes touch the app.',
      ],
      keyIdea: 'The app does the thinking: who, which key, how long. It never sees the photo.',
      metrics: { db: '100 MB/day', app: '200 MB/day', flight: '-', resend: '-' },
      metricTones: { app: 'good' },
      scene: {
        nodes: [
          { ...phone, chips: ['upload slot?'] },
          { ...app, status: 'ok', badge: 'checks user, signs' },
          { ...db, status: 'active', badge: 'row: pending' },
        ],
        links: [link('phone', 'app'), link('app', 'db')],
        flows: [
          { path: ['phone', 'app'], tone: 'request', label: 'upload slot?', duration: 0.9 },
          { path: ['app', 'db'], tone: 'request', label: 'INSERT pending', duration: 0.9, delay: 1 },
          { path: ['app', 'phone'], tone: 'response', label: 'signed PUT URL, 5 min', duration: 1.2, delay: 2 },
        ],
        caption: 'Small requests to the app',
      },
      code: {
        language: 'python',
        title: 'Hand out a 5-minute upload URL',
        source: `ALLOWED = {"image/jpeg"}

def create_upload(user_id, content_type):
    if content_type not in ALLOWED:
        raise ValueError("unsupported type")
    key = f"photos/{user_id}/{uuid.uuid4()}.jpg"   # the server picks the key
    url = s3.generate_presigned_url(
        "put_object",
        Params={"Bucket": BUCKET, "Key": key, "ContentType": content_type},   # whitelisted above
        ExpiresIn=300,                              # valid for 5 minutes
    )
    db.execute("INSERT INTO photos (user_id, object_key, status)"
               " VALUES (%s, %s, 'pending')", user_id, key)
    return {"upload_url": url, "key": key}`,
        highlight: [5, 6, 9, 11],
      },
    },
    {
      title: 'Send, confirm',
      tag: 'concept',
      heading: 'Step two: bytes go to the bucket, then the app confirms',
      eli5: 'The child walks to the cupboard alone with the pass and puts the painting on shelf 42. Then they tell the teacher, who checks it is there and ticks the notebook.',
      body: [
        'The phone sends the bytes straight to the bucket, then tells the app it is done. The app asks the store whether the object exists and how big it is, and marks the row `ready`.',
        'Uploads leave your servers entirely. Peak load on them drops from megabytes to a few small requests.',
      ],
      keyIdea: 'Big bytes flow between the client and the store. The app only confirms the result.',
      metrics: { db: '100 MB/day', app: '200 MB/day', flight: '~0', resend: '-' },
      metricTones: { app: 'good', flight: 'good' },
      scene: {
        nodes: [phone, { ...app, status: 'ok', load: 12 }, { ...db, status: 'ok', badge: 'row: ready' }, { ...bucket, status: 'active', badge: 'checks signature' }],
        links: [link('phone', 'app'), link('app', 'db'), link('phone', 'bucket', { label: 'direct' })],
        flows: [
          { path: ['phone', 'bucket'], tone: 'data', label: 'PUT 5 MB', count: 3, duration: 2 },
          { path: ['phone', 'app'], tone: 'request', label: 'done', duration: 0.9, delay: 2.2 },
          { path: ['app', 'bucket', 'app'], tone: 'request', label: 'HEAD: exists?', duration: 1.2, delay: 3.2 },
          { path: ['app', 'db'], tone: 'request', label: 'mark ready', duration: 0.9, delay: 4.5 },
        ],
        caption: 'Big bytes to the bucket, small calls to the app',
      },
      code: {
        language: 'python',
        title: 'Upload with the URL, then confirm',
        source: `# The client sends the bytes to the bucket, never to this server:
#   curl -X PUT -H "Content-Type: image/jpeg" --data-binary @cat.jpg "$upload_url"

def confirm_upload(user_id, key):
    head = s3.head_object(Bucket=BUCKET, Key=key)   # is it there, how big is it
    if head["ContentLength"] > MAX_BYTES:           # a signed PUT cannot cap size
        s3.delete_object(Bucket=BUCKET, Key=key)
        raise ValueError("too large")
    db.execute("UPDATE photos SET status = 'ready', bytes = %s"
               " WHERE object_key = %s AND user_id = %s",
               head["ContentLength"], key, user_id)`,
        highlight: [2, 5, 6, 7],
      },
    },
    {
      title: 'Safe signing',
      tag: 'tradeoff',
      heading: 'Five rules keep direct uploads safe',
      eli5: 'A good hall pass names one child, one shelf and a short time. If the pass is lost, nobody can use it for long, and the teacher picks the shelf so nobody overwrites a friend\'s painting.',
      body: [
        'The server chooses the key, never the client. The server also whitelists the content type and checks the size, because a pre-signed PUT cannot cap `Content-Length`. A pre-signed POST with a `content-length-range` condition can, and `confirm_upload` should delete any object above the limit. The expiry is short. The bucket stays private. A cleanup job deletes `pending` rows that never finished, along with their objects.',
        'Public write access or a secret key inside the mobile app lets anyone overwrite anything.',
      ],
      keyIdea: 'Server-chosen key, validated type and size, short expiry, private bucket, and cleanup of abandoned uploads.',
      metrics: { db: '100 MB/day', app: '200 MB/day', flight: '~0', resend: '-' },
      scene: {
        nodes: [
          { ...app, status: 'ok' },
          { ...bucket, at: at(4, -2.5), status: 'ok', badge: 'private' },
          { id: 'cleanup', kind: 'worker', at: at(0, 2.8), label: 'cleanup job', sub: 'pending > 1 day', status: 'active' },
        ],
        links: [link('app', 'bucket', { label: 'signed, 5 min' }), link('cleanup', 'bucket', { style: 'dashed', label: 'delete orphans' })],
        flows: [
          { path: ['app', 'bucket'], tone: 'handshake', label: 'signature ok', duration: 1.4 },
          { path: ['cleanup', 'bucket'], tone: 'event', label: 'abandoned upload', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Signing rules',
          icon: 'Shield',
          rows: [
            { text: 'Key chosen by', value: 'server', tone: 'good' },
            { text: 'Type and size', value: 'validated server-side', tone: 'good' },
            { text: 'Expiry', value: '5 minutes', tone: 'good' },
            { text: 'Bucket', value: 'private', tone: 'good' },
            { text: 'Stale pending rows', value: 'deleted', tone: 'good' },
            { text: 'Unchecked size', value: '50 GB in a 5 MB slot', tone: 'bad' },
          ],
        },
        caption: 'Narrow, short, private, cleaned up',
      },
    },
    {
      title: 'Signed reads',
      tag: 'concept',
      heading: 'Private photos are read with signed links too',
      eli5: 'To look at a private painting, a child asks the teacher for a viewing pass. The pass works for a few minutes and only for that painting.',
      body: [
        'Downloads of private photos use signed `GET` URLs the same way. The app checks the viewer may see the photo, then signs a link for that key with a short expiry.',
        'Public photos can skip this and be served through a CDN. That comes in part 2.',
      ],
      keyIdea: 'Reads follow the same pattern as writes: check access in the app, then let the store serve the bytes.',
      metrics: { db: '100 MB/day', app: '200 MB/day', flight: '~0', resend: '-' },
      scene: {
        nodes: [{ ...phone, label: 'viewer', sub: 'friend of user 7' }, { ...app, status: 'ok', badge: 'may they see it?' }, { ...bucket, status: 'active', badge: 'serves the bytes' }],
        links: [link('phone', 'app'), link('phone', 'bucket', { label: 'direct' })],
        flows: [
          { path: ['phone', 'app'], tone: 'request', label: 'open photo 8f3a', duration: 0.9 },
          { path: ['app', 'phone'], tone: 'response', label: 'signed GET URL, 5 min', duration: 1, delay: 1 },
          { path: ['phone', 'bucket', 'phone'], tone: 'data', label: 'GET 5 MB', count: 2, duration: 2, delay: 2.2 },
        ],
        panel: {
          title: 'Signed GET',
          icon: 'Download',
          code: 'GET /photos/7/8f3a.jpg\n  ?X-Amz-Expires=300\n  &X-Amz-Signature=9b1c...',
          footer: { text: 'Expired links answer 403', tone: 'muted' },
        },
        caption: 'Check in the app, download from the bucket',
      },
    },
    {
      title: 'Big uploads',
      tag: 'problem',
      heading: 'A 2 GB video over hotel Wi-Fi',
      eli5: 'A child is carrying a giant poster to the cupboard. A door slams at the very end and the poster is ruined, so the child must start from the beginning.',
      body: [
        'The app adds video. A creator uploads a 2 GB file over hotel Wi-Fi, and the connection drops at 90%.',
        'With a single `PUT` the upload starts again from zero. Each retry risks the same failure, and a long upload is likely to hit one.',
      ],
      keyIdea: 'One long request fails as a whole, so the bigger the file, the worse the odds.',
      metrics: { db: '100 MB/day', app: '200 MB/day', flight: '-', resend: '2 GB' },
      metricTones: { resend: 'bad' },
      scene: {
        nodes: [
          { ...phone, label: 'creator', sub: '2 GB video', status: 'hot', chips: [{ text: 'PUT 2 GB', tone: 'warn' }] },
          { ...bucket, at: at(4, -2.5), status: 'dim', badge: 'nothing stored' },
        ],
        links: [link('phone', 'bucket', { label: 'hotel Wi-Fi', labelTone: 'warn' })],
        flows: [{ path: ['phone', 'bucket'], tone: 'error', label: 'dropped at 90%', count: 3, duration: 2.4 }],
        panel: {
          title: 'One big PUT',
          icon: 'Wifi',
          rows: [
            { text: 'File size', value: '2 GB' },
            { text: 'Sent before drop', value: '1.8 GB', tone: 'warn' },
            { text: 'Resent after drop', value: '2 GB', tone: 'bad' },
          ],
          footer: { text: 'Start again from zero', tone: 'bad' },
        },
        caption: 'One long request fails as a whole',
      },
    },
    {
      title: 'Multipart',
      tag: 'concept',
      heading: 'Big files go up in numbered parts',
      eli5: 'A giant poster will not fit through the door in one piece. The child cuts it into numbered strips and carries a few at a time. That is a **multipart upload**. A dropped strip is the only one fetched again.',
      body: [
        '**Multipart upload**: the app starts the upload and returns an upload ID plus a signed URL for each part, so the client holds no credentials. The client cuts the file into 100 parts of 20 MB, PUTs each to its URL in parallel and collects each ETag.',
        'A part that fails is sent again alone. The client sends the ETags to the app, which calls `CompleteMultipartUpload`. Readers see nothing until that call succeeds.',
      ],
      keyIdea: 'Parts make a large upload resumable and parallel: a failure costs one part, never the whole file.',
      metrics: { db: '100 MB/day', app: '200 MB/day', flight: '-', resend: '20 MB' },
      metricTones: { resend: 'good' },
      scene: {
        nodes: [
          { ...phone, label: 'creator', sub: '2 GB video', status: 'active' },
          { ...app, badge: 'starts upload, signs parts' },
          { ...bucket, at: at(4, -2.5), status: 'active', badge: '99 of 100 parts' },
        ],
        links: [link('phone', 'app'), link('phone', 'bucket', { label: '4 parts at a time' })],
        flows: [
          { path: ['phone', 'app'], tone: 'request', label: 'start: ID + 100 part URLs', duration: 1.2 },
          { path: ['phone', 'bucket'], tone: 'data', label: 'parts 36, 38, 39', count: 3, duration: 1.8, delay: 1.4 },
          { path: ['phone', 'bucket'], tone: 'error', label: 'part 37 dropped', duration: 1.8, delay: 1.8 },
          { path: ['phone', 'bucket'], tone: 'data', label: 'part 37 again', duration: 1.8, delay: 4 },
          { path: ['phone', 'app', 'bucket'], tone: 'request', label: 'complete: parts + ETags', duration: 1.6, delay: 6 },
        ],
        caption: 'One lost part costs 20 MB, the other 99 are kept',
      },
      code: {
        language: 'python',
        title: 'Multipart upload, app side',
        source: `def start_multipart(user_id, parts):
    key = f"videos/{user_id}/{uuid.uuid4()}.mp4"
    up = s3.create_multipart_upload(Bucket=BUCKET, Key=key)
    urls = [s3.generate_presigned_url(
                "upload_part", ExpiresIn=3600,
                Params={"Bucket": BUCKET, "Key": key,
                        "UploadId": up["UploadId"], "PartNumber": n})
            for n in range(1, parts + 1)]
    return {"key": key, "upload_id": up["UploadId"], "part_urls": urls}

def finish_multipart(key, upload_id, etags):    # etags collected by the client
    s3.complete_multipart_upload(
        Bucket=BUCKET, Key=key, UploadId=upload_id,
        MultipartUpload={"Parts": [{"PartNumber": i + 1, "ETag": e}
                                   for i, e in enumerate(etags)]})`,
        highlight: [3, 4, 5, 12],
      },
      quiz: {
        question: 'A 2 GB upload is split into 100 parts of 20 MB. The network drops while part 37 is in flight. Parts 1 to 36 already succeeded. What has to be sent again?',
        options: ['The whole 2 GB file', 'Parts 1 to 37', 'Only part 37', 'Nothing, the store fills in the gap'],
        answer: 2,
        explain: 'Each part is stored and checksummed on its own. The client retries part 37, continues with the rest, and then sends the complete call that lists all 100 parts.',
      },
    },
    {
      title: 'Part limits',
      tag: 'tradeoff',
      heading: 'Part sizes, limits and abandoned uploads',
      eli5: 'Strips cannot be too tiny or the child walks forever, and the cupboard keeper only lets a poster have so many strips. Leftover strips from posters nobody finished still take shelf space.',
      body: [
        'In S3 every part except the last must be at least 5 MB, and one upload can have up to 10,000 parts. Bigger parts mean fewer calls. Smaller parts mean cheaper retries.',
        'Parts of an upload nobody completes stay on disk and on your bill. Set a rule that aborts unfinished uploads after a few days.',
      ],
      keyIdea: 'Pick a part size between the limits, and always abort stale multipart uploads.',
      metrics: { db: '100 MB/day', app: '200 MB/day', flight: '-', resend: '20 MB' },
      scene: {
        nodes: [
          { ...phone, label: 'creator', sub: 'gave up at part 60', status: 'dim' },
          { ...bucket, at: at(4, -2.5), status: 'hot', badge: '60 orphan parts', sub: 'still billed' },
          { id: 'rule', kind: 'block', at: at(0, 2.8), label: 'abort rule', sub: 'after 7 days', icon: 'Clock', tint: 'green' },
        ],
        links: [link('phone', 'bucket', { style: 'faint' }), link('rule', 'bucket', { style: 'dashed', label: 'clean up' })],
        flows: [{ path: ['rule', 'bucket'], tone: 'event', label: 'abort upload', duration: 1.6 }],
        panel: {
          title: 'S3 multipart limits',
          icon: 'List',
          rows: [
            { text: 'Smallest part', value: '5 MB (not the last)' },
            { text: 'Most parts', value: '10,000' },
            { text: 'Our parts', value: '100 x 20 MB', tone: 'good' },
            { text: 'Abandoned parts', value: 'still billed', tone: 'bad' },
          ],
        },
        caption: 'Unfinished uploads cost money until aborted',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Rows in the database, bytes in the bucket',
      eli5: 'The notebook lists shelf labels. Children carry paintings to the **bucket**, our art cupboard, with a hall pass, and big posters go in numbered strips. Part 2 looks inside the cupboard.',
      body: [
        'Large files do not belong in database rows. Put the bytes in a **bucket** under a server-chosen, well-spread **key** and keep a small row that points to it.',
        'Hand clients **pre-signed URLs** so uploads and downloads skip your app servers, and use **multipart upload** for large files. Part 2 covers durability, cost tiers, the CDN and safety.',
      ],
      keyIdea: 'The app server grants permission, the object store carries the bytes, and the database remembers where they are.',
      metrics: { db: '100 MB/day', app: '200 MB/day', flight: '~0', resend: '20 MB' },
      metricTones: { db: 'good', app: 'good', flight: 'good', resend: 'good' },
      scene: {
        nodes: [phone, { ...app, status: 'ok' }, { ...db, status: 'ok' }, { ...bucket, status: 'ok' }],
        links: [link('phone', 'app'), link('app', 'db'), link('phone', 'bucket', { label: 'signed PUT' })],
        flows: [
          { path: ['phone', 'app', 'phone'], tone: 'request', label: 'get signed URL', duration: 1.6 },
          { path: ['phone', 'bucket'], tone: 'data', label: 'upload', count: 2, duration: 1.6, delay: 1.7 },
        ],
        caption: 'Small calls to the app, big bytes to the bucket',
      },
      quiz: {
        question: 'Users upload 5 MB photos. You want the bytes to skip your app servers while the bucket stays private. Which design does that?',
        options: [
          'Make the bucket publicly writable and let clients pick any key',
          'Ship the storage account\'s secret key inside the mobile app',
          'The app returns a short-lived pre-signed PUT URL for a key the server chose, and the client uploads to it',
          'The app accepts the upload and writes it to a BYTEA column',
        ],
        answer: 2,
        explain: 'A pre-signed URL grants one narrow permission for a few minutes, so the bucket stays private and the secret key never leaves the server. Public write access or an embedded secret lets anyone overwrite anything.',
      },
    },
  ],
};
