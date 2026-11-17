import type { Lesson, SceneNode, SceneZone } from '../engine/types';

const phone: SceneNode = { id: 'phone', kind: 'phone', at: [-4, 4], label: 'photo app', sub: '200K uploads/day' };
const app: SceneNode = { id: 'app', kind: 'server', at: [-1, 3], label: 'app servers' };
const db: SceneNode = { id: 'db', kind: 'db', at: [2, 2], label: 'Postgres', sub: 'photo rows' };
const bucket: SceneNode = { id: 'bucket', kind: 'storage', at: [0.5, -2.5], label: 'bucket', sub: 'photos-prod' };
const cdn: SceneNode = { id: 'cdn', kind: 'cdn', at: [-2.5, -1.5], label: 'CDN edge', sub: 'Sydney' };
const warm: SceneNode = { id: 'warm', kind: 'storage', at: [3.25, -2.75], label: 'infrequent', sub: 'after 30 days' };
const cold: SceneNode = { id: 'cold', kind: 'storage', at: [6, -3], label: 'archive', sub: 'backups' };

// Inside the object store: three zones, two storage nodes in each.
const api: SceneNode = { id: 'api', kind: 'gateway', at: [-7, 2], label: 'storage API' };
const a1: SceneNode = { id: 'a1', kind: 'storage', at: [-4, -1.5], label: 'node A1' };
const a2: SceneNode = { id: 'a2', kind: 'storage', at: [-4, 1.5], label: 'node A2' };
const b1: SceneNode = { id: 'b1', kind: 'storage', at: [0, -1.5], label: 'node B1' };
const b2: SceneNode = { id: 'b2', kind: 'storage', at: [0, 1.5], label: 'node B2' };
const c1: SceneNode = { id: 'c1', kind: 'storage', at: [4, -1.5], label: 'node C1' };
const c2: SceneNode = { id: 'c2', kind: 'storage', at: [4, 1.5], label: 'node C2' };

const storeZones: SceneZone[] = [
  { id: 'zoneA', from: [-5.2, -2.8], to: [-2.8, 2.8], label: 'zone A', tone: 'blue' },
  { id: 'zoneB', from: [-1.2, -2.8], to: [1.2, 2.8], label: 'zone B', tone: 'violet' },
  { id: 'zoneC', from: [2.8, -2.8], to: [5.2, 2.8], label: 'zone C', tone: 'green' },
];

const storeLinks = ['a1', 'a2', 'b1', 'b2', 'c1', 'c2'].map((id) => ({ from: 'api', to: id, style: 'faint' as const }));

export const objectStorage: Lesson = {
  id: 'object-storage',
  title: 'Object storage',
  tagline: 'Move photos, videos and backups out of database rows and into a store built for bytes.',
  minutes: 14,
  level: 'Intermediate',
  learn: [
    'Why large files hurt a database, and what a bucket, a key and metadata are',
    'Direct uploads with pre-signed URLs, so file bytes skip your app servers',
    'Multipart upload for large files on bad connections',
    'How replication and erasure coding keep objects safe, and what each costs in disk',
    'Storage classes, lifecycle rules, and a CDN in front of the bucket',
  ],
  metrics: [
    { key: 'db', label: 'DB growth' },
    { key: 'app', label: 'Bytes via app' },
    { key: 'raw', label: 'Disk per 1 TB' },
    { key: 'cost', label: 'Storage bill (year 1)' },
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
        'Everything the database does slows down with it. Reading a photo drags megabytes through the memory cache and pushes out the small hot rows that cache exists for. Every photo is written to the write-ahead log and shipped to each replica. The nightly backup used to take 10 minutes and now runs for hours. All of this sits on the most expensive disk you own.',
      ],
      keyIdea: 'A database is built for many small rows it can index and join. Megabyte blobs get none of that benefit and tax everything else.',
      metrics: { db: '1 TB/day', app: '1 TB/day', raw: '-', cost: '-' },
      scene: {
        nodes: [phone, { ...app, status: 'active' }, { ...db, status: 'hot', sub: 'rows + 5 MB photos', badge: '+1 TB every day' }],
        links: [
          { from: 'phone', to: 'app' },
          { from: 'app', to: 'db' },
        ],
        flows: [
          { path: ['phone', 'app'], tone: 'request', label: 'POST photo 5 MB', count: 3, duration: 1.6 },
          { path: ['app', 'db'], tone: 'data', label: 'INSERT bytea', count: 3, duration: 1.6, delay: 1.7 },
        ],
        caption: 'Every photo becomes a 5 MB row',
      },
    },
    {
      title: 'Buckets and keys',
      tag: 'concept',
      heading: 'Bytes go in a bucket, the row keeps the key',
      eli5: 'Paintings move to the art cupboard. Each one gets a shelf label, and that label is its **key**. The notebook only writes down the label, so it is thin again.',
      body: [
        'An **object store** (Amazon S3, Google Cloud Storage, Azure Blob Storage, or MinIO if you host it yourself) does one job: keep bytes under a name. You create a **bucket**, which is a named container. Each **object** in it has a **key** such as `photos/7/8f3a9c.jpg`, the bytes, and a little **metadata**: content type, size, a checksum and any tags you add.',
        'The API is plain HTTP on whole objects: PUT, GET, DELETE, and LIST by key prefix. The namespace is flat. A slash in a key is an ordinary character, and the folders a console shows you are a prefix filter. You cannot edit the middle of an object. To change one you upload a replacement.',
        'The database goes back to what it is good at. Each photo is one small row with the owner, the caption and the object key. "Photos by user 7, newest first" is still a SQL query. The store cannot answer that kind of question, so the row and the object always travel as a pair.',
      ],
      keyIdea: 'Split the photo in two: searchable facts in a database row, raw bytes in a bucket, joined by the object key.',
      metrics: { db: '100 MB/day', app: '1 TB/day', raw: '-', cost: '-' },
      scene: {
        nodes: [phone, { ...app, status: 'active' }, { ...db, status: 'ok', badge: 'key + caption' }, { ...bucket, status: 'active', badge: '5 MB object' }],
        links: [
          { from: 'phone', to: 'app' },
          { from: 'app', to: 'db' },
          { from: 'app', to: 'bucket' },
        ],
        flows: [
          { path: ['phone', 'app'], tone: 'request', label: 'POST photo', duration: 1.2 },
          { path: ['app', 'bucket'], tone: 'data', label: 'PUT photos/7/8f3a.jpg', duration: 1.4, delay: 1.3 },
          { path: ['app', 'db'], tone: 'request', label: 'INSERT key', duration: 1, delay: 2.8 },
        ],
        caption: 'The row is about 500 bytes. The photo is somewhere else.',
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
      title: 'Proxy tax',
      tag: 'case',
      heading: 'Case: every byte still crosses the app servers',
      eli5: 'Every child hands their painting to the teacher, and the teacher walks it to the cupboard. The teacher is a **proxy**, a go-between, and does nothing else all day.',
      body: [
        'The database is healthy again, but uploads still go phone to app server to bucket. On a phone uplink of about 5 Mbit/s, a 5 MB photo takes 8 seconds. For those 8 seconds an app server holds the connection open and buffers the file.',
        'At the evening peak that is about 25 uploads starting per second, so around **200 uploads in flight** at any moment. Each one pins a worker and several megabytes of memory on a machine that was sized for 50 ms JSON requests.',
        'You also move every byte twice: once into your servers and once out to the bucket. The app adds nothing to those bytes on the way through. It only checks who the user is, which takes one small request.',
      ],
      keyIdea: 'An app server that relays file bytes spends its workers and bandwidth on a job the object store could take directly.',
      metrics: { db: '100 MB/day', app: '1 TB/day', raw: '-', cost: '-' },
      scene: {
        nodes: [phone, { ...app, status: 'hot', badge: '200 uploads in flight' }, { ...db, status: 'dim' }, bucket],
        links: [
          { from: 'phone', to: 'app' },
          { from: 'app', to: 'db', style: 'faint' },
          { from: 'app', to: 'bucket' },
        ],
        flows: [
          { path: ['phone', 'app'], tone: 'data', label: '5 MB, 8 s', count: 5, duration: 2.6 },
          { path: ['app', 'bucket'], tone: 'data', label: 'same 5 MB again', count: 5, duration: 1.6, delay: 2.2 },
        ],
        caption: 'The app relays bytes it never looks at',
      },
    },
    {
      title: 'Pre-signed URL',
      tag: 'concept',
      heading: 'Let the client upload straight to the bucket',
      eli5: 'The teacher writes a hall pass: "this child may put one painting on shelf 42 in the next five minutes". That pass is a **pre-signed URL**. The child walks to the cupboard alone.',
      body: [
        'A **pre-signed URL** is an ordinary object URL with a signature in its query string. Your server builds it with its own credentials. The signature covers exactly one permission: this method, this bucket, this key, until this expiry time. The store checks the signature by itself and never calls your app.',
        'The upload becomes three small steps. The phone asks the app for an upload slot. The app checks the user, picks the key, signs a PUT URL that lasts 5 minutes and saves a `pending` row. The phone sends the bytes straight to the bucket, then tells the app it is done. The app confirms the object exists and marks the row `ready`.',
        'Three rules keep this safe. The server chooses the key, never the client. The expiry is short. The bucket stays private, and downloads of private photos use signed GET URLs the same way. A cleanup job deletes `pending` rows that never finished, along with their objects.',
      ],
      keyIdea: 'Your server signs a narrow, short-lived permission. The bytes then flow between the client and the store without touching your servers.',
      metrics: { db: '100 MB/day', app: '200 MB/day', raw: '-', cost: '-' },
      scene: {
        nodes: [phone, { ...app, status: 'ok', badge: 'signs URLs only' }, db, { ...bucket, status: 'active', badge: 'checks signature' }],
        links: [
          { from: 'phone', to: 'app' },
          { from: 'app', to: 'db' },
          { from: 'phone', to: 'bucket', label: 'direct' },
        ],
        flows: [
          { path: ['phone', 'app'], tone: 'request', label: 'upload slot?', duration: 0.9 },
          { path: ['app', 'phone'], tone: 'response', label: 'signed PUT URL, 5 min', duration: 0.9, delay: 1 },
          { path: ['phone', 'bucket'], tone: 'data', label: 'PUT 5 MB', count: 3, duration: 2, delay: 2 },
          { path: ['phone', 'app', 'db'], tone: 'request', label: 'done, mark ready', duration: 1.4, delay: 4.2 },
        ],
        caption: 'Small requests to the app, big bytes to the bucket',
      },
      code: {
        language: 'python',
        title: 'Hand out a 5-minute upload URL',
        source: `def create_upload(user_id, content_type):
    key = f"photos/{user_id}/{uuid.uuid4()}.jpg"   # the server picks the key
    url = s3.generate_presigned_url(
        "put_object",
        Params={"Bucket": BUCKET, "Key": key, "ContentType": content_type},
        ExpiresIn=300,                              # valid for 5 minutes
    )
    db.execute("INSERT INTO photos (user_id, object_key, status)"
               " VALUES (%s, %s, 'pending')", user_id, key)
    return {"upload_url": url, "key": key}

# The client sends the bytes to the bucket, never to this server:
#   curl -X PUT -H "Content-Type: image/jpeg" --data-binary @cat.jpg "$upload_url"

def confirm_upload(user_id, key):
    head = s3.head_object(Bucket=BUCKET, Key=key)   # is it there, how big is it
    db.execute("UPDATE photos SET status = 'ready', bytes = %s"
               " WHERE object_key = %s AND user_id = %s",
               head["ContentLength"], key, user_id)`,
        highlight: [2, 3, 6, 16],
      },
    },
    {
      title: 'Multipart upload',
      tag: 'concept',
      heading: 'Big files go up in numbered parts',
      eli5: 'A giant poster will not fit through the door in one piece. The child cuts it into numbered strips and carries a few at a time. That is a **multipart upload**. A dropped strip is the only one fetched again.',
      body: [
        'The app adds video. A creator uploads a 2 GB file over hotel Wi-Fi, and the connection drops at 90%. With a single PUT the upload starts again from zero.',
        '**Multipart upload** fixes this. The client opens an upload and gets an upload ID. It cuts the file into parts, here 100 parts of 20 MB, and sends them with their part numbers, several in parallel. The store returns a checksum for each part. A part that fails is sent again alone. A final "complete" call lists the parts in order, and the store assembles them into one object. Readers see nothing until that call succeeds.',
        'In S3 every part except the last must be at least 5 MB, and one upload can have up to 10,000 parts. Parts of an upload that nobody completes stay on disk and on your bill, so set a rule that aborts unfinished uploads after a few days.',
      ],
      keyIdea: 'Parts make a large upload resumable and parallel: a failure costs one part, never the whole file.',
      metrics: { db: '100 MB/day', app: '200 MB/day', raw: '-', cost: '-' },
      scene: {
        nodes: [
          { ...phone, label: 'creator', sub: '2 GB video', status: 'active' },
          { ...app, badge: '100 signed part URLs' },
          { ...db, status: 'dim' },
          { ...bucket, status: 'active', badge: '99 of 100 parts' },
        ],
        links: [
          { from: 'phone', to: 'app' },
          { from: 'app', to: 'db', style: 'faint' },
          { from: 'phone', to: 'bucket', label: '4 parts at a time' },
        ],
        flows: [
          { path: ['phone', 'bucket'], tone: 'data', label: 'parts 36, 38, 39', count: 3, duration: 1.8 },
          { path: ['phone', 'bucket'], tone: 'error', label: 'part 37 dropped', duration: 1.8, delay: 0.4 },
          { path: ['phone', 'bucket'], tone: 'data', label: 'part 37 again', duration: 1.8, delay: 2.6 },
          { path: ['phone', 'bucket'], tone: 'request', label: 'complete: parts 1..100', duration: 1.2, delay: 4.6 },
        ],
        caption: 'One lost part costs 20 MB, the other 99 are kept',
      },
      quiz: {
        question: 'A 2 GB upload is split into 100 parts of 20 MB. The network drops while part 37 is in flight. Parts 1 to 36 already succeeded. What has to be sent again?',
        options: ['The whole 2 GB file', 'Parts 1 to 37', 'Only part 37', 'Nothing, the store fills in the gap'],
        answer: 2,
        explain: 'Each part is stored and checksummed on its own. The client retries part 37, continues with the rest, and then sends the complete call that lists all 100 parts.',
      },
    },
    {
      title: 'Three copies',
      tag: 'concept',
      heading: 'Durability by replication',
      eli5: 'The school photocopies every painting and keeps one copy in each of three buildings. Making those copies is **replication**. If one building floods, two copies are still safe.',
      body: [
        'Now look inside the store. It runs on thousands of ordinary disks, and in a fleet that size some disks die every day. **Durability** is the promise that a stored object is not lost. It is a different promise from availability, which is whether you can reach the object right now.',
        'The simplest protection is **replication**: write three full copies on nodes in three **zones**, which are separate buildings with their own power and network. The PUT is acknowledged once the copies are safely on disk. A background scrubber rereads objects, compares checksums, and makes a fresh copy when a disk dies or a copy rots.',
        'Reads are cheap, since any one copy is the whole object. The cost is disk: **3 TB of raw capacity for every 1 TB** you store.',
      ],
      keyIdea: 'Three copies in three zones survive a dead disk or a lost building, and you pay for three times the disk.',
      metrics: { db: '100 MB/day', app: '200 MB/day', raw: '3 TB', cost: '-' },
      scene: {
        zones: storeZones,
        nodes: [
          { ...api, status: 'active' },
          { ...a1, status: 'ok', badge: 'copy 1' },
          { ...a2, status: 'dim' },
          { ...b1, status: 'ok', badge: 'copy 2' },
          { ...b2, status: 'dim' },
          { ...c1, status: 'ok', badge: 'copy 3' },
          { ...c2, status: 'dim' },
        ],
        links: storeLinks,
        flows: [
          { path: ['api', 'a1'], tone: 'data', label: 'PUT 5 MB', duration: 1.2 },
          { path: ['api', 'b1'], tone: 'data', duration: 1.5 },
          { path: ['api', 'c1'], tone: 'data', duration: 1.8 },
          { path: ['a1', 'api'], tone: 'handshake', label: 'stored x3', duration: 1, delay: 2 },
        ],
        caption: 'Inside the store: one full copy per zone',
      },
    },
    {
      title: 'Erasure coding',
      tag: 'tradeoff',
      heading: 'Same safety with half the disk',
      eli5: 'Cut the painting into 4 puzzle pieces and make 2 clever spare pieces. Any 4 of the 6 can rebuild the picture. That trick is **erasure coding**, and it needs far less paper than three whole copies.',
      body: [
        '**Erasure coding** cuts an object into data fragments and computes extra parity fragments from them. With a 4 + 2 scheme a 4 MB object becomes four 1 MB data fragments plus two 1 MB parity fragments, each on a different node, two per zone. **Any 4 of the 6** are enough to rebuild the object.',
        'That survives two lost fragments, which covers a whole zone going dark, and it uses **1.5 TB of raw disk per 1 TB** stored. Three copies used 3 TB to survive two losses.',
        'The price is work. Writes spend CPU on the encoding math. A read gathers fragments from four nodes. Repairing one lost fragment means reading four others. A common split is to replicate small, hot objects and erasure-code large or cold ones. With a managed store you never choose. This machinery is why S3 can advertise eleven nines of durability at a few cents per GB.',
      ],
      keyIdea: 'Erasure coding trades CPU and extra reads for disk: 1.5x overhead where replication needs 3x for the same number of survivable losses.',
      metrics: { db: '100 MB/day', app: '200 MB/day', raw: '1.5 TB', cost: '-' },
      scene: {
        zones: storeZones,
        nodes: [
          { ...api, status: 'active', badge: 'encode 4 + 2' },
          { ...a1, status: 'ok', badge: 'data 1' },
          { ...a2, status: 'ok', badge: 'data 2' },
          { ...b1, status: 'down', badge: 'lost' },
          { ...b2, status: 'down', badge: 'lost' },
          { ...c1, status: 'ok', badge: 'parity 1' },
          { ...c2, status: 'ok', badge: 'parity 2' },
        ],
        links: storeLinks,
        flows: [
          { path: ['a1', 'api'], tone: 'data', label: 'fragment', duration: 1.2 },
          { path: ['a2', 'api'], tone: 'data', duration: 1.2 },
          { path: ['c1', 'api'], tone: 'data', duration: 1.4 },
          { path: ['c2', 'api'], tone: 'data', duration: 1.4 },
          { path: ['api', 'b1'], tone: 'error', label: 'zone B is dark', duration: 1.2, delay: 0.3 },
        ],
        caption: 'Zone B is gone. Any 4 fragments rebuild the object.',
      },
    },
    {
      title: 'Storage classes',
      tag: 'concept',
      heading: 'Old data moves to cheaper shelves',
      eli5: 'This week\'s paintings stay in the classroom. Older ones go to the hallway cupboard, and very old ones to the attic, where space is cheap but fetching takes a long time. Each place is a **storage class**.',
      body: [
        'After a year the bucket holds 365 TB, and most of it is photos nobody has opened in months. Stores sell **storage classes** for this. Take these example prices per TB per month: standard at $23, infrequent access at $12.50, archive at $4 or less.',
        'The cheaper classes charge in other ways. Infrequent access is as fast as standard but bills for each GB you read and has a minimum storage period. Archive can take minutes or hours to hand an object back. That makes archive right for backups and wrong for a photo a user might tap on.',
        'A **lifecycle rule** moves objects by age with no code. Here photos move to infrequent access after 30 days. At the end of year one that is 30 TB at standard and 335 TB at the lower price: about **$4,900 a month against $8,400** with everything in standard. Another rule sends backups to archive, and a third aborts unfinished multipart uploads.',
      ],
      keyIdea: 'Pay for fast access only while data is hot. Lifecycle rules move it to cheaper classes as it ages.',
      metrics: { db: '100 MB/day', app: '200 MB/day', raw: '1.5 TB', cost: '$4,900/mo' },
      scene: {
        nodes: [
          phone,
          { ...bucket, label: 'standard', sub: '0 to 30 days', status: 'active', badge: '30 TB at $23' },
          { ...warm, status: 'ok', badge: '335 TB at $12.50' },
          { ...cold, badge: 'hours to restore' },
        ],
        links: [
          { from: 'phone', to: 'bucket' },
          { from: 'bucket', to: 'warm', style: 'dashed', label: 'day 30' },
          { from: 'warm', to: 'cold', style: 'dashed' },
        ],
        flows: [
          { path: ['phone', 'bucket'], tone: 'data', label: 'new photos', count: 2, duration: 1.6 },
          { path: ['bucket', 'warm'], tone: 'event', label: 'lifecycle: 30 days old', count: 3, duration: 1.6, delay: 1.7 },
          { path: ['warm', 'cold'], tone: 'event', label: 'backups/', duration: 1.6, delay: 3.4 },
        ],
        caption: 'Same bucket, three price tiers',
      },
      code: {
        language: 'json',
        title: 'S3 lifecycle configuration',
        source: `{
  "Rules": [
    {
      "ID": "photos-cool-down",
      "Status": "Enabled",
      "Filter": { "Prefix": "photos/" },
      "Transitions": [{ "Days": 30, "StorageClass": "STANDARD_IA" }]
    },
    {
      "ID": "backups-to-archive",
      "Status": "Enabled",
      "Filter": { "Prefix": "backups/" },
      "Transitions": [{ "Days": 30, "StorageClass": "GLACIER" }],
      "Expiration": { "Days": 365 }
    },
    {
      "ID": "abort-stale-uploads",
      "Status": "Enabled",
      "Filter": { "Prefix": "" },
      "AbortIncompleteMultipartUpload": { "DaysAfterInitiation": 7 }
    }
  ]
}`,
        highlight: [7, 13, 14, 20],
      },
    },
    {
      title: 'CDN in front',
      tag: 'concept',
      heading: 'Serve downloads from the edge',
      eli5: 'The cupboard is in one school, far from the children in Sydney. A notice board near them shows a copy of each popular painting. That board is the **CDN**, and it only asks the cupboard once.',
      body: [
        'The bucket lives in one region, say Virginia. A viewer in Sydney pays about 200 ms of round trip before the first byte of each photo, and you pay the store for every byte that leaves it.',
        'Put a **CDN** in front (see the content delivery networks lesson). The first Sydney request for a photo misses at the edge and is fetched from the bucket. Later requests are answered from the edge in about 20 ms. The bucket stays private and accepts reads only from the CDN, so nobody can go around it.',
        'Object keys make this easy. A key that contains a UUID or a content hash always names the same bytes, so you can send `Cache-Control: public, max-age=31536000, immutable`. A changed photo is a new key, and nothing ever needs purging. Private photos use signed CDN URLs that expire.',
      ],
      keyIdea: 'The bucket is the origin and the CDN is the front door. Immutable keys let edges cache objects for a year.',
      metrics: { db: '100 MB/day', app: '200 MB/day', raw: '1.5 TB', cost: '$4,900/mo' },
      scene: {
        nodes: [
          { ...phone, label: 'viewer', sub: 'Sydney' },
          { ...cdn, status: 'ok', badge: 'hit · 20 ms' },
          { ...bucket, sub: 'private · Virginia', badge: 'CDN reads only' },
          { ...app, status: 'dim' },
          { ...db, status: 'dim' },
        ],
        links: [
          { from: 'phone', to: 'cdn' },
          { from: 'cdn', to: 'bucket', style: 'dashed', label: 'on a miss' },
          { from: 'phone', to: 'app', style: 'faint' },
          { from: 'app', to: 'db', style: 'faint' },
        ],
        flows: [
          { path: ['phone', 'cdn'], tone: 'request', label: 'GET 8f3a.jpg', duration: 0.9 },
          { path: ['cdn', 'bucket', 'cdn'], tone: 'data', label: 'first time only', duration: 2.2, delay: 1 },
          { path: ['cdn', 'phone'], tone: 'response', label: 'photo', count: 3, duration: 0.9, delay: 3.3 },
        ],
        caption: 'One trip to the bucket, then the edge answers',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Rows in the database, bytes in the bucket',
      eli5: 'The notebook lists shelf labels. Children carry paintings to the **bucket**, our art cupboard, with a hall pass. Spare pieces keep them safe, old ones go to the attic, and notice boards show the favorites.',
      body: [
        'Large files do not belong in database rows. Put the bytes in a **bucket** under a server-chosen **key** and keep a small row that points to it. Hand clients **pre-signed URLs** so uploads and downloads skip your app servers, and use **multipart upload** for anything large.',
        'The store keeps objects safe with replication (3x disk) or erasure coding (about 1.5x). **Lifecycle rules** move aging data to cheaper classes and clean up abandoned uploads. A **CDN** in front of a private bucket serves reads close to users. The later designs for photo sharing, video and file sync all start from this layout.',
      ],
      keyIdea: 'The app server grants permission, the object store carries the bytes, and the database remembers where they are.',
      metrics: { db: '100 MB/day', app: '200 MB/day', raw: '1.5 TB', cost: '$4,900/mo' },
      scene: {
        nodes: [phone, { ...app, status: 'ok' }, { ...db, status: 'ok' }, { ...bucket, status: 'ok' }, { ...cdn, sub: 'near users', status: 'ok' }],
        links: [
          { from: 'phone', to: 'app' },
          { from: 'app', to: 'db' },
          { from: 'phone', to: 'bucket', label: 'signed PUT' },
          { from: 'phone', to: 'cdn' },
          { from: 'cdn', to: 'bucket', style: 'dashed' },
        ],
        flows: [
          { path: ['phone', 'app', 'phone'], tone: 'request', label: 'get signed URL', duration: 1.6 },
          { path: ['phone', 'bucket'], tone: 'data', label: 'upload', count: 2, duration: 1.6, delay: 1.7 },
          { path: ['bucket', 'cdn', 'phone'], tone: 'response', label: 'view', count: 2, duration: 2, delay: 3.4 },
        ],
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
