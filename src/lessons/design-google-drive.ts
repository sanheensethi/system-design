import type { Lesson, SceneNode } from '../engine/types';

// Main layout. Top row (x + y = -4) carries file bytes, bottom row (x + y = 2.5) carries metadata and notifications.
const laptop: SceneNode = { id: 'laptop', kind: 'client', at: [-5.25, 1.25], label: 'laptop', sub: 'desktop client' };
const blocks: SceneNode = { id: 'blocks', kind: 'service', at: [-3.7, -0.3], label: 'block servers', sub: 'compress, encrypt' };
const store: SceneNode = { id: 'store', kind: 'storage', at: [-2.3, -1.7], label: 'block store', sub: 'object storage' };
const vault: SceneNode = { id: 'vault', kind: 'vault', at: [-0.9, -3.1], label: 'KMS', sub: 'data keys' };
const api: SceneNode = { id: 'api', kind: 'server', at: [-0.75, 3.25], label: 'API servers', sub: 'metadata calls' };
const cache: SceneNode = { id: 'cache', kind: 'cache', at: [0.55, 1.95], label: 'meta cache', sub: 'versioned keys' };
const db: SceneNode = { id: 'db', kind: 'db', at: [1.85, 0.65], label: 'metadata DB', sub: 'SQL, sharded' };
const notify: SceneNode = { id: 'notify', kind: 'service', at: [3.15, -0.65], label: 'notification', sub: 'long poll' };
const phone: SceneNode = { id: 'phone', kind: 'phone', at: [4.45, -1.95], label: 'phone', sub: 'same account' };

// Extra nodes that appear in one or two steps, placed on free spots of the same grid.
const single: SceneNode = { id: 'single', kind: 'server', at: [-0.375, -0.375], label: 'one server', sub: 'disk + MySQL' };
const bus: SceneNode = { id: 'bus', kind: 'queue', at: [-0.9, -3.1], label: 'change bus', sub: 'pub/sub' };
const standby: SceneNode = { id: 'standby', kind: 'replica', at: [-0.9, -3.1], label: 'sync standby', sub: 'same commits' };
const cold: SceneNode = { id: 'cold', kind: 'storage', at: [-0.9, -3.1], label: 'cold tier', sub: 'idle 90+ days' };
const gc: SceneNode = { id: 'gc', kind: 'worker', at: [-3.7, -0.3], label: 'GC sweeper', sub: 'refs = 0' };
const notify2: SceneNode = { id: 'notify2', kind: 'service', at: [-0.1, -3.9], label: 'notification 2', sub: 'takes reconnects' };

export const designGoogleDrive: Lesson = {
  id: 'design-google-drive',
  title: 'Design Google Drive',
  tagline: 'Keep every device in sync with a 500 PB store, while sending only the bytes that changed.',
  minutes: 24,
  level: 'Advanced',
  learn: [
    'Scale numbers, the sync API and a metadata model built from versions and blocks',
    'Splitting files into blocks, dedup by block hash, and delta sync',
    'Compression and encryption on block servers, with blocks in object storage',
    'Why file metadata needs strong consistency, and how a transaction gives it',
    'Telling other devices about changes with long polling and a change cursor',
    'Conflict handling, version history, garbage collection and storage cost',
  ],
  metrics: [
    { key: 'changes', label: 'File changes' },
    { key: 'upload', label: 'Bytes uploaded' },
    { key: 'stored', label: 'Stored' },
    { key: 'sync', label: 'Sync delay' },
    { key: 'notify', label: 'Notify load' },
  ],
  steps: [
    {
      title: 'Requirements',
      tag: 'problem',
      heading: 'Every device, the same files, within seconds',
      eli5: 'Your homework notebook has copies at home, at school and at grandma’s, and every copy must match. The **school office** keeps the master copy for millions of kids.',
      body: [
        'Scope: upload and download files of any type up to 10 GB, sync them across a user’s devices, keep version history, and share folders. Real-time co-editing of documents is out of scope. Nonfunctional needs, in order: **never lose a file**, sync fast, use little bandwidth (many devices are phones on metered data), and stay available.',
        'Numbers to design against: **100 million** registered users, **25 million** daily actives with about 2.5 devices each, and up to **30 million** devices online at peak. Users store 5 GB on average, so **500 PB** of logical data. Each active user saves about 4 changed files a day averaging 6 MB: 100 million changes a day, roughly 1,200 per second, **3,500 per second at peak**.',
        'If every change uploaded the whole file, that would be 600 TB a day. The target is that a change saved on the laptop shows up on the phone in **under 5 seconds**.',
      ],
      keyIdea: 'A sync service is judged on three things users feel: no file is ever lost, changes appear everywhere fast, and it does not eat their data plan.',
      metrics: { changes: '3,500/s peak', upload: '600 TB/day', stored: '500 PB', sync: 'target < 5 s', notify: '30M devices' },
      scene: {
        nodes: [
          { ...laptop, status: 'active', badge: 'saves report.docx' },
          { ...single, kind: 'internet', label: 'sync service', sub: 'to be designed', badge: '?' },
          { ...phone, badge: 'must match' },
        ],
        links: [
          { from: 'laptop', to: 'single' },
          { from: 'single', to: 'phone' },
        ],
        flows: [
          { path: ['laptop', 'single'], tone: 'request', label: 'changed file', duration: 1.4 },
          { path: ['single', 'phone'], tone: 'event', label: 'within 5 s', duration: 1.4, delay: 1.5 },
        ],
        caption: '30M devices online, each expecting the latest files',
      },
    },
    {
      title: 'API and data',
      tag: 'concept',
      heading: 'Files are versions, versions are lists of blocks',
      eli5: 'The office keeps an index card for each notebook listing its pages in order. That card box is the **metadata database**. The pages themselves sit in a filing cabinet.',
      body: [
        'The API is built around a **commit**. `POST /files/{id}/commit` sends the base version and the ordered list of block hashes for the new content. The server answers either "done, you are version 15" or "first send me these blocks", which the client uploads with `PUT /blocks/{hash}`. Other devices call `GET /changes?cursor=1041` to learn what changed and `GET /blocks/{hash}` to fetch content. `GET /files/{id}/versions` lists history.',
        'In the data model a **namespace** is the root of one user’s tree, or of one shared folder. A file has a pointer to its latest version. A **version** is an ordered list of block hashes, and its rows never change once written. A **block** row records that this namespace owns those bytes and how many versions point at them. The **changes** table is a journal per namespace: every commit appends one row with the next sequence number, and each device remembers the last number it has seen.',
      ],
      keyIdea: 'Model a file as a pointer to an immutable version, and a version as an ordered list of content hashes. The bytes live elsewhere.',
      metrics: { changes: '3,500/s peak', upload: '600 TB/day', stored: '500 PB', sync: 'target < 5 s', notify: '30M devices' },
      scene: {
        nodes: [laptop, { ...api, status: 'active' }, { ...db, status: 'active', badge: 'files, versions, blocks' }, phone],
        links: [
          { from: 'laptop', to: 'api' },
          { from: 'api', to: 'db' },
          { from: 'phone', to: 'api', style: 'dashed' },
        ],
        flows: [
          { path: ['laptop', 'api'], tone: 'request', label: 'commit v15', duration: 1.2 },
          { path: ['api', 'db'], tone: 'request', label: 'INSERT version', duration: 1, delay: 1.3 },
          { path: ['phone', 'api'], tone: 'request', label: 'changes?cursor=1041', duration: 1.4, delay: 2.4 },
          { path: ['api', 'phone'], tone: 'response', label: 'file 9001 is v15', duration: 1.4, delay: 3.9 },
        ],
        caption: 'Commits write versions, devices read the change journal',
      },
      code: {
        language: 'sql',
        title: 'Metadata tables (block bytes live in object storage)',
        source: `CREATE TABLE files (
  namespace_id BIGINT, file_id BIGINT,
  path         TEXT NOT NULL,
  latest_ver   INT NOT NULL,
  PRIMARY KEY (namespace_id, file_id)
);
CREATE TABLE version_blocks (          -- append-only recipe of each version
  namespace_id BIGINT, file_id BIGINT, version INT,
  seq          INT,                     -- position of the block in the file
  block_hash   BYTEA,                   -- SHA-256 of the plaintext block
  PRIMARY KEY (namespace_id, file_id, version, seq)
);
CREATE TABLE blocks (
  namespace_id BIGINT, block_hash BYTEA,
  size_bytes   INT,
  refs         INT NOT NULL,            -- versions that use this block
  PRIMARY KEY (namespace_id, block_hash)
);
CREATE TABLE changes (                  -- journal that devices read by cursor
  namespace_id BIGINT, seq BIGINT,
  file_id      BIGINT, version INT,
  PRIMARY KEY (namespace_id, seq)
);`,
        highlight: [4, 7, 10, 15, 18],
      },
    },
    {
      title: 'Simple design',
      tag: 'concept',
      heading: 'Version one: one server, whole files, polling',
      eli5: 'At first one clerk with one cupboard keeps every notebook, and every kid phones each minute to ask if anything is new. That clerk is the **single server**.',
      body: [
        'The first version is one server with a big disk and MySQL. The client uploads the whole file on every save. The server writes it under `/data/{user}/{path}`, records a row, and keeps the old file as the previous version.',
        'Other devices find out by **polling**: every 60 seconds each one asks "anything new since my last check?" If yes, it downloads the whole new file.',
        'For a team of a hundred people this is fine and easy to reason about. Nothing here is wrong yet. The problems are all about size.',
      ],
      keyIdea: 'Whole-file upload plus polling is correct and simple, which makes it the right baseline to measure against.',
      metrics: { changes: '3,500/s peak', upload: '600 TB/day', stored: '500 PB', sync: '30 s avg', notify: '500K polls/s' },
      scene: {
        nodes: [laptop, { ...single, status: 'active', badge: 'whole files' }, phone],
        links: [
          { from: 'laptop', to: 'single' },
          { from: 'phone', to: 'single' },
        ],
        flows: [
          { path: ['laptop', 'single'], tone: 'request', label: 'PUT whole file', duration: 1.6 },
          { path: ['phone', 'single'], tone: 'request', label: 'anything new?', duration: 1.2, delay: 0.6 },
          { path: ['single', 'phone'], tone: 'response', label: 'whole file', duration: 1.4, delay: 2.2 },
        ],
        caption: 'Upload the whole file, poll once a minute',
      },
    },
    {
      title: 'Where it breaks',
      tag: 'case',
      heading: 'Bytes, polls and one disk',
      eli5: 'Kids recopy the whole notebook to fix one word, the cupboard is full, and the phone never stops ringing with "anything new?" The **single server** cannot keep up.',
      body: [
        '**Bandwidth.** Fix a typo in a 200 MB slide deck and the laptop uploads 200 MB, then every other device downloads 200 MB. Across the fleet that is 600 TB a day in and more going out, most of it bytes the server already had.',
        '**Polling.** 30 million online devices asking every 60 seconds is **500,000 requests a second**, and almost every answer is "nothing new". Even so, a change takes 30 seconds on average to show up, six times the target.',
        '**Storage and safety.** 500 PB is tens of thousands of disks, and one dead server must never lose a file. A single box fails on all three counts.',
      ],
      keyIdea: 'Sending whole files and polling wastes most of the work, and one machine can neither hold the data nor survive losing it.',
      metrics: { changes: '3,500/s peak', upload: '600 TB/day', stored: '500 PB', sync: '30 s avg', notify: '500K polls/s' },
      scene: {
        nodes: [
          { ...laptop, status: 'hot', badge: '200 MB for a typo' },
          { ...single, status: 'hot', badge: 'disk full, 500K polls/s' },
          { ...phone, status: 'hot', badge: '30 s behind' },
        ],
        links: [
          { from: 'laptop', to: 'single' },
          { from: 'phone', to: 'single' },
        ],
        flows: [
          { path: ['laptop', 'single'], tone: 'error', label: '200 MB again', duration: 2 },
          { path: ['phone', 'single'], tone: 'request', label: 'anything new?', count: 5, duration: 0.9 },
          { path: ['single', 'phone'], tone: 'response', label: 'no', count: 5, duration: 0.9, delay: 1 },
        ],
        caption: 'Most bytes and most polls carry nothing new',
      },
    },
    {
      title: 'Blocks',
      tag: 'concept',
      heading: 'Fix 1: split files into hashed blocks',
      eli5: 'Notebooks are cut into numbered pages, and each page gets a fingerprint stamp. Two identical pages share one stamp, so the office files that page once. The stamp is a **hash**.',
      body: [
        'The client splits each file into **4 MB blocks** and computes a SHA-256 **hash** of each. A 200 MB deck becomes 50 blocks and 50 hashes. Blocks are stored in object storage under their hash, as in the object storage lesson, and the metadata only lists hashes in order.',
        'Before uploading, the client commits the hash list. The server checks which hashes the namespace already owns and asks only for the rest. This gives **dedup** for free: a copied file, a file moved between folders, or the same photo saved twice uploads zero blocks.',
        'Dedup is scoped to the namespace on purpose. Global dedup across users saves more disk, but it leaks information: by uploading a file and seeing whether it was skipped, an attacker learns that someone already stores it. In our model namespace dedup cuts uploads to about 450 TB a day.',
      ],
      keyIdea: 'Address blocks by their content hash, so the server can say "I already have that" before any bytes move.',
      metrics: { changes: '3,500/s peak', upload: '450 TB/day', stored: '430 PB', sync: '30 s avg', notify: '500K polls/s' },
      scene: {
        nodes: [
          { ...laptop, status: 'active', badge: '50 hashes' },
          blocks,
          { ...store, badge: 'key = hash' },
          { ...api, status: 'active' },
          { ...db, badge: '47 already owned' },
        ],
        links: [
          { from: 'laptop', to: 'api' },
          { from: 'api', to: 'db' },
          { from: 'laptop', to: 'blocks' },
          { from: 'blocks', to: 'store' },
        ],
        flows: [
          { path: ['laptop', 'api'], tone: 'request', label: 'commit 50 hashes', duration: 1 },
          { path: ['api', 'db'], tone: 'request', label: 'which are new?', duration: 0.9, delay: 1.1 },
          { path: ['api', 'laptop'], tone: 'response', label: 'send 3', duration: 1, delay: 2.1 },
          { path: ['laptop', 'blocks', 'store'], tone: 'data', label: '3 blocks', count: 3, duration: 1.6, delay: 3.2 },
        ],
        caption: 'Only blocks the server lacks are uploaded',
      },
      code: {
        language: 'python',
        title: 'Client: hash blocks, upload only what the server lacks',
        source: `import hashlib

BLOCK = 4 * 1024 * 1024                     # 4 MB

def block_hashes(path):
    out = []
    with open(path, "rb") as f:
        while chunk := f.read(BLOCK):
            out.append(hashlib.sha256(chunk).hexdigest())
    return out

def sync_file(path, file_id, base_version):
    hashes = block_hashes(path)
    resp = api.commit(file_id, base_version, hashes)
    if resp["status"] == "need_blocks":
        for i, h in enumerate(hashes):
            if h in resp["missing"]:
                api.put_block(h, read_block(path, i))   # safe to retry: keyed by hash
        resp = api.commit(file_id, base_version, hashes)
    return resp                              # {"status": "ok", "version": 15} or a conflict`,
        highlight: [9, 14, 15, 18, 19],
      },
    },
    {
      title: 'Delta sync',
      tag: 'concept',
      heading: 'Fix 2: delta sync, compression and encryption',
      eli5: 'Change one page and you only bring that page, folded small and sealed in an envelope. Sending only changed pages is **delta sync**.',
      body: [
        'Blocks give **delta sync** on edits. Fix a typo on slide 30 and only the block holding slide 30 gets a new hash, so the laptop uploads 4 MB instead of 200 MB, and the phone downloads the same 4 MB. Fixed-size blocks have one weakness: inserting bytes near the start shifts every later boundary. **Content-defined chunking**, which cuts blocks where a rolling hash of the data hits a pattern, keeps most boundaries stable after an insert.',
        'The **block servers** handle bytes on the way into storage. They check each block’s hash, **compress** it when it helps (text and office files shrink a lot, JPEG and MP4 do not, so skip those), then **encrypt** it. Compress first: encrypted data looks random and will not compress. Each namespace has a data key, wrapped by a key in the **KMS**, as in the encryption lesson.',
        'Why not upload straight to storage with pre-signed URLs? It saves a hop, but then every client (Windows, macOS, iOS, Android, web) must implement compression and encryption identically, and the server cannot verify a block matches its hash before it lands. Block servers keep that logic in one place. Uploads fall to about **180 TB a day**.',
      ],
      keyIdea: 'Upload only blocks whose hash changed, compress what compresses, then encrypt, all in one server tier you control.',
      metrics: { changes: '3,500/s peak', upload: '180 TB/day', stored: '380 PB', sync: '30 s avg', notify: '500K polls/s' },
      scene: {
        nodes: [
          { ...laptop, status: 'active', badge: '1 of 50 changed' },
          { ...blocks, status: 'active', badge: 'verify, gzip, AES' },
          { ...store, status: 'ok' },
          { ...vault, badge: 'wrap data key' },
        ],
        links: [
          { from: 'laptop', to: 'blocks' },
          { from: 'blocks', to: 'store' },
          { from: 'blocks', to: 'vault', style: 'dashed' },
        ],
        flows: [
          { path: ['laptop', 'blocks'], tone: 'data', label: 'block 30 (4 MB)', duration: 1.3 },
          { path: ['blocks', 'vault'], tone: 'handshake', label: 'data key', duration: 0.9, delay: 1.4 },
          { path: ['vault', 'blocks'], tone: 'handshake', duration: 0.9, delay: 2.3 },
          { path: ['blocks', 'store'], tone: 'data', label: '1.4 MB sealed', duration: 1.1, delay: 3.3 },
        ],
        caption: 'One changed block, compressed then encrypted',
      },
      quiz: {
        question: 'A user changes a few words in the middle of a 200 MB file without changing its length. Blocks are 4 MB. Roughly how much does the laptop upload?',
        options: ['200 MB', '100 MB', 'About 4 MB', 'Nothing, the server keeps a diff'],
        answer: 2,
        explain: 'Only the block that contains the changed bytes gets a new hash, so one 4 MB block is sent (less after compression). Every other hash matches a block the server already has.',
      },
    },
    {
      title: 'Metadata',
      tag: 'concept',
      heading: 'Fix 3: a strongly consistent metadata database',
      eli5: 'The card box is updated in one careful move, so nobody ever sees a card that points at a missing page. That all-or-nothing move is a **transaction**.',
      body: [
        'Blocks can be eventually consistent, metadata cannot. If the phone sees version 15 before all its blocks exist, it downloads a broken file. If two devices disagree on the latest version, one of them overwrites the other. So a commit is one **ACID transaction** (the transactions lesson): check every block exists, insert the version rows, move the file pointer, append to the change journal. All of it or none of it.',
        'A relational database gives this directly. Shard by **namespace id** (the sharding lesson), so a whole tree, or a whole shared folder, lives on one shard and every commit is a single-shard transaction. 3,500 commits a second spread over a few dozen shards is a light load per shard. Each shard has a **synchronous standby**, so a failover never loses a committed version.',
        'The cache must not undo this. Cache entries are keyed with the version (`file:9001:v15`), commits delete the pointer key, and a device that was just told "version 15 exists" reads from the primary if the cache or a replica still says 14.',
      ],
      keyIdea: 'A version becomes visible in one transaction, only after all its blocks exist, and caches or replicas never get to show an older answer as current.',
      metrics: { changes: '3,500/s peak', upload: '180 TB/day', stored: '380 PB', sync: '30 s avg', notify: '500K polls/s' },
      scene: {
        nodes: [
          laptop,
          { ...api, status: 'active' },
          { ...cache, badge: 'DEL file:9001' },
          { ...db, status: 'active', badge: 'one transaction' },
          { ...standby, status: 'ok' },
          phone,
        ],
        links: [
          { from: 'laptop', to: 'api' },
          { from: 'api', to: 'db' },
          { from: 'api', to: 'cache' },
          { from: 'db', to: 'standby', style: 'dashed', label: 'sync' },
          { from: 'phone', to: 'api', style: 'dashed' },
        ],
        flows: [
          { path: ['laptop', 'api'], tone: 'request', label: 'commit v15', duration: 1 },
          { path: ['api', 'db'], tone: 'request', label: 'BEGIN ... COMMIT', duration: 1, delay: 1.1 },
          { path: ['db', 'standby'], tone: 'data', label: 'ack before commit', duration: 1, delay: 2.2 },
          { path: ['api', 'cache'], tone: 'event', label: 'invalidate', duration: 0.8, delay: 3.3 },
          { path: ['phone', 'api'], tone: 'request', label: 'read v15', duration: 1.2, delay: 4.2 },
        ],
        caption: 'All of a commit becomes visible at once, or none of it',
      },
    },
    {
      title: 'Notify devices',
      tag: 'concept',
      heading: 'Fix 4: long polling and a change cursor',
      eli5: 'Each kid leaves a call open with the office, and the office says "new pages!" the moment something changes. That waiting call is a **long poll**.',
      body: [
        'Replace the 60-second poll with a **long poll**, as in the real-time lesson. Each device sends `GET /notify?ns=77&cursor=1041` and the notification server holds it open for up to 60 seconds. When a commit lands, the API publishes "namespace 77 changed" on a **pub/sub** bus (the pub/sub lesson). The server holding that namespace’s devices answers their open calls at once.',
        'The answer carries no file data, only "something changed". The device then asks the API for `changes?cursor=1041`, gets the list, downloads the blocks it lacks, and opens a new long poll. A laptop that was asleep for a week does the same thing when it wakes: it asks for everything after its cursor. No per-device inbox is needed, because the journal is the inbox.',
        'Why not WebSocket? It would work, but traffic here is one-way and rare, a few events per device per day, and plain HTTP requests pass every proxy and firewall. 30 million held connections at about 500,000 per server is around 60 notification servers, and changes now show up in about **2 seconds**.',
      ],
      keyIdea: 'A notification is only a nudge. The change journal and each device’s cursor are the source of truth, which also covers devices that were offline.',
      metrics: { changes: '3,500/s peak', upload: '180 TB/day', stored: '380 PB', sync: '2 s', notify: '30M held conns' },
      scene: {
        nodes: [
          laptop,
          { ...api, status: 'active' },
          db,
          { ...bus, status: 'active' },
          { ...notify, status: 'active', badge: '500K open per box' },
          { ...phone, status: 'ok', badge: 'cursor 1041 to 1042' },
        ],
        links: [
          { from: 'laptop', to: 'api' },
          { from: 'api', to: 'db' },
          { from: 'api', to: 'bus' },
          { from: 'bus', to: 'notify' },
          { from: 'notify', to: 'phone' },
          { from: 'phone', to: 'api', style: 'dashed' },
        ],
        flows: [
          { path: ['phone', 'notify'], tone: 'request', label: 'wait for ns 77', duration: 1 },
          { path: ['laptop', 'api', 'db'], tone: 'request', label: 'commit', duration: 1.6, delay: 0.8 },
          { path: ['api', 'bus', 'notify'], tone: 'event', label: 'ns 77 changed', duration: 1.6, delay: 2.4 },
          { path: ['notify', 'phone'], tone: 'event', label: 'changed', duration: 0.9, delay: 4 },
          { path: ['phone', 'api'], tone: 'request', label: 'changes?cursor=1041', duration: 1.4, delay: 5 },
        ],
        caption: 'Held request returns the moment the namespace changes',
      },
    },
    {
      title: 'Conflicts',
      tag: 'case',
      heading: 'Case: two devices edit the same file offline',
      eli5: 'Two kids fix the same page on a trip. The first one back gets it filed. The second keeps their page as a separate copy to compare. That clash is a **conflict**.',
      body: [
        'Ana edits `report.docx` on her laptop on a plane, and her phone edits the same file on version 14 at the same time. The laptop lands first and commits version 15. Then the phone commits with base version 14.',
        'The commit checks that the file is still on the base version, in the same transaction that moves the pointer. It is not, so the phone’s commit fails with a **conflict**: first committed wins. Nothing is lost: the phone saves its edit as a new file, `report (phone conflicted copy).docx`, then downloads version 15. Ana sees both and merges by hand.',
        'Automatic merging works for plain text with a three-way merge, but not for a binary Word or Photoshop file. Live co-editing (operational transforms or CRDTs) is a different product. The sync layer’s job is narrower: never silently drop either edit.',
      ],
      keyIdea: 'Commit with a base version and compare-and-set the pointer. The loser of a race becomes a conflicted copy, so no edit is silently lost.',
      metrics: { changes: '3,500/s peak', upload: '180 TB/day', stored: '380 PB', sync: '2 s', notify: '30M held conns' },
      scene: {
        nodes: [
          { ...laptop, status: 'ok', badge: 'base 14, won: v15' },
          { ...api, status: 'active' },
          { ...db, status: 'active', badge: 'latest_ver = 15' },
          { ...phone, status: 'hot', badge: 'base 14: conflict' },
        ],
        links: [
          { from: 'laptop', to: 'api' },
          { from: 'api', to: 'db' },
          { from: 'phone', to: 'api' },
        ],
        flows: [
          { path: ['laptop', 'api', 'db'], tone: 'request', label: 'commit base 14', duration: 1.6 },
          { path: ['phone', 'api'], tone: 'request', label: 'commit base 14', duration: 1.2, delay: 1.8 },
          { path: ['api', 'phone'], tone: 'error', label: 'conflict: now v15', duration: 1.2, delay: 3.1 },
          { path: ['phone', 'api'], tone: 'request', label: 'save conflicted copy', duration: 1.2, delay: 4.4 },
        ],
        caption: 'First commit wins, the second becomes its own file',
      },
      code: {
        language: 'sql',
        title: 'Commit with a compare-and-set on the base version',
        source: `BEGIN;
-- 1. Claim the next version only if nobody committed since our base.
UPDATE files SET latest_ver = latest_ver + 1
 WHERE namespace_id = 77 AND file_id = 9001
   AND latest_ver = 14                  -- base_version sent by the device
RETURNING latest_ver;                   -- 0 rows: conflict, ROLLBACK

-- 2. Record the recipe for version 15 (all blocks already verified).
INSERT INTO version_blocks VALUES
  (77, 9001, 15, 0, '\\x9f1c...'), (77, 9001, 15, 1, '\\x03ab...');
UPDATE blocks SET refs = refs + 1
 WHERE namespace_id = 77 AND block_hash IN ('\\x9f1c...', '\\x03ab...');

-- 3. Append to the journal; the namespace counter serializes commits.
UPDATE namespaces SET next_seq = next_seq + 1
 WHERE namespace_id = 77 RETURNING next_seq;  -- 1042
INSERT INTO changes VALUES (77, 1042, 9001, 15);
COMMIT;`,
        highlight: [3, 5, 6, 16, 18],
      },
    },
    {
      title: 'Versions and cost',
      tag: 'tradeoff',
      heading: 'Version history, garbage collection and cold storage',
      eli5: 'The office keeps old copies of each notebook, throws out pages no card points to, and moves dusty notebooks to the basement. The basement is **cold storage**.',
      body: [
        'History is cheap with blocks. Version 15 of the deck shares 49 of 50 blocks with version 14, so keeping it costs one 4 MB block. Busy files still pile up versions, so set a **retention policy**: keep every version for 30 days, then one per day, and cap the count. In our model, history adds about 10% on top of current data, bringing storage to **420 PB**.',
        'When versions expire, their blocks lose a reference. A **garbage collector** deletes blocks whose `refs` reach zero, but only after a grace period, because a block uploaded a second ago may belong to a commit that has not finished yet. Deleting it early would break that commit.',
        'Most of a drive is rarely opened. A lifecycle rule (the object storage lesson) moves blocks unread for 90 days to a **cold storage** class that costs several times less per GB, with slower first reads and a fee per retrieval. In a typical drive most bytes are cold, so this is the single biggest saving on the storage bill.',
      ],
      keyIdea: 'Versions share blocks, so history is cheap. Retention, reference-counted garbage collection and a cold tier keep 500 PB affordable.',
      metrics: { changes: '3,500/s peak', upload: '180 TB/day', stored: '420 PB', sync: '2 s', notify: '30M held conns' },
      scene: {
        nodes: [
          { ...gc, status: 'active' },
          { ...store, badge: 'hot: 30%' },
          { ...cold, status: 'ok', badge: 'cold: 70%' },
          { ...api, status: 'dim' },
          { ...db, badge: 'v1..v15 share blocks' },
        ],
        links: [
          { from: 'gc', to: 'store' },
          { from: 'store', to: 'cold', label: 'lifecycle' },
          { from: 'gc', to: 'db', style: 'dashed' },
          { from: 'api', to: 'db' },
        ],
        flows: [
          { path: ['db', 'gc'], tone: 'event', label: 'refs = 0 for 7 days', duration: 1.4 },
          { path: ['gc', 'store'], tone: 'error', label: 'delete block', duration: 1, delay: 1.5 },
          { path: ['store', 'cold'], tone: 'data', label: 'idle 90 days', count: 3, duration: 1.4, delay: 2.6 },
        ],
        caption: 'Expired blocks are swept, idle ones move to the cold tier',
      },
    },
    {
      title: 'Failures',
      tag: 'case',
      heading: 'Case: a notification server dies with 500,000 connections',
      eli5: 'One office phone line dies and half a million kids redial at once. If each waits a random few seconds first, the other lines cope. That random wait is **jitter**.',
      body: [
        'A notification server crashes, and 500,000 long polls drop in the same second. If every device reconnects at once, the other servers take a connection storm on top of their own load and the next one falls over. Clients reconnect with exponential backoff and **jitter** (the timeouts and retries lesson), spreading the herd over about 30 seconds. On reconnect each device asks for changes after its cursor, so no change is missed even though notifications were lost. Sync delay spikes to 30 seconds for those devices, then returns to 2.',
        'Other parts fail more quietly. A **block server** dies mid-upload: the commit never happened, so no device sees a half file, and the client resends missing blocks to another server, which is safe because blocks are keyed by hash. A **metadata primary** dies: its synchronous standby is promoted (the failover lesson), writes pause for seconds and no committed version is lost. A storage **region** goes down: blocks are replicated to a second region and read from there.',
      ],
      keyIdea: 'Design each failure so the source of truth is untouched: notifications can be lost, uploads can be retried, and only committed metadata matters.',
      metrics: { changes: '3,500/s peak', upload: '180 TB/day', stored: '420 PB', sync: '30 s spike', notify: '500K reconnecting' },
      scene: {
        nodes: [
          laptop,
          blocks,
          store,
          { ...notify2, status: 'hot', badge: 'jittered reconnects' },
          api,
          db,
          { ...notify, status: 'down', badge: 'crashed' },
          { ...phone, status: 'active', badge: 'resume at cursor' },
        ],
        links: [
          { from: 'laptop', to: 'blocks' },
          { from: 'blocks', to: 'store' },
          { from: 'api', to: 'db' },
          { from: 'phone', to: 'notify', style: 'faint' },
          { from: 'phone', to: 'notify2' },
          { from: 'phone', to: 'api', style: 'dashed' },
        ],
        flows: [
          { path: ['notify', 'phone'], tone: 'error', label: 'connection lost', duration: 1 },
          { path: ['phone', 'notify2'], tone: 'request', label: 'reconnect after 0 to 30 s', duration: 1.6, delay: 1.2 },
          { path: ['phone', 'api'], tone: 'request', label: 'changes?cursor=1042', duration: 1.6, delay: 3 },
          { path: ['laptop', 'blocks', 'store'], tone: 'data', duration: 1.6, delay: 0.5 },
        ],
        caption: 'Lost nudges are recovered from the change journal',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Hash the blocks, commit the metadata, nudge the devices',
      eli5: 'Pages with fingerprints, only changed pages carried in, one careful card box, and a quick call when something changes: together they make a **sync service**.',
      body: [
        'Bytes: files split into 4 MB blocks named by their hash, deduplicated per namespace, sent only when changed, compressed then encrypted on block servers, stored in object storage with a cold tier. Uploads fell from 600 to 180 TB a day.',
        'Metadata: files point at immutable versions, versions list block hashes, and a commit is one transaction on a namespace-sharded SQL database with a synchronous standby. A base-version check turns races into conflicted copies. Devices hold long polls, get a nudge in about 2 seconds, and read the change journal from their cursor, which also brings offline devices up to date.',
      ],
      keyIdea: 'Separate content from metadata: content is immutable, hash-named and eventually stored anywhere, while metadata is small, transactional and the only thing that defines what a file is.',
      metrics: { changes: '3,500/s peak', upload: '180 TB/day', stored: '420 PB', sync: '2 s', notify: '30M held conns' },
      scene: {
        nodes: [laptop, blocks, { ...store, status: 'ok' }, vault, api, cache, { ...db, status: 'ok' }, notify, { ...phone, status: 'ok' }],
        links: [
          { from: 'laptop', to: 'blocks' },
          { from: 'blocks', to: 'store' },
          { from: 'blocks', to: 'vault', style: 'dashed' },
          { from: 'laptop', to: 'api' },
          { from: 'api', to: 'cache' },
          { from: 'api', to: 'db' },
          { from: 'api', to: 'notify', style: 'dashed' },
          { from: 'notify', to: 'phone' },
        ],
        flows: [
          { path: ['laptop', 'blocks', 'store'], tone: 'data', duration: 1.6 },
          { path: ['laptop', 'api', 'db'], tone: 'request', label: 'commit', duration: 1.6, delay: 1.7 },
          { path: ['api', 'notify', 'phone'], tone: 'event', duration: 1.6, delay: 3.4 },
        ],
      },
      quiz: {
        question: 'A phone misses a notification because its notification server crashed. How does it still get the new version?',
        options: [
          'It does not, the change is lost until the file is edited again',
          'The server keeps a queue of missed messages per device and replays it',
          'On reconnect it asks for all changes after its saved cursor in the change journal',
          'The laptop resends the file directly to the phone',
        ],
        answer: 2,
        explain: 'Notifications are only nudges. The change journal per namespace is the record, and each device keeps the last sequence number it has seen, so asking for changes after that cursor returns everything it missed.',
      },
    },
  ],
};
