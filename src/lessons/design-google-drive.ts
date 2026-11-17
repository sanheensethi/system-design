import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

// Layout: the byte path runs along the top (s = -3.5), the metadata path along the bottom (s = 3.5).
const laptop: SceneNode = { id: 'laptop', kind: 'client', at: at(-5.4, 0), label: 'laptop', sub: 'desktop client' };
const phone: SceneNode = { id: 'phone', kind: 'phone', at: at(5.4, 0), label: 'phone', sub: 'same account' };
const single: SceneNode = { id: 'single', kind: 'server', at: at(0, 0), label: 'one server', sub: 'disk + MySQL' };
const blocks: SceneNode = { id: 'blocks', kind: 'block', at: at(-1.8, -3.5), label: 'block servers', sub: 'verify, pack', icon: 'Layers', tint: 'teal' };
const store: SceneNode = { id: 'store', kind: 'storage', at: at(1.8, -3.5), label: 'block store', sub: 'object storage' };
const vault: SceneNode = { id: 'vault', kind: 'vault', at: at(5.4, -3.5), label: 'KMS', sub: 'data keys' };
const api: SceneNode = { id: 'api', kind: 'block', at: at(-1.8, 3.5), label: 'API servers', sub: 'metadata calls', icon: 'Server', tint: 'violet' };
const db: SceneNode = { id: 'db', kind: 'db', at: at(1.8, 3.5), label: 'metadata DB', sub: 'SQL, sharded' };

const same = { changes: '3,500/s peak', upload: '600 TB/day', stored: '500 PB', sync: 'target < 5 s' };

export const designGoogleDrive: Lesson = {
  id: 'design-google-drive',
  title: 'Design Google Drive (part 1)',
  tagline: 'Keep every device in sync with a 500 PB store, while sending only the bytes that changed.',
  minutes: 14,
  level: 'Advanced',
  learn: [
    'Scope, scale numbers, the sync API and a metadata model built from versions and blocks',
    'Why whole-file upload and polling break, and what a single server cannot do',
    'Splitting files into hashed blocks, dedup per namespace, and delta sync',
    'Content-defined chunking, compression and encryption on block servers',
    'Resumable uploads for 10 GB files',
  ],
  metrics: [
    { key: 'changes', label: 'File changes', icon: 'Repeat' },
    { key: 'upload', label: 'Bytes uploaded', icon: 'Download' },
    { key: 'stored', label: 'Stored, logical', icon: 'HardDrive' },
    { key: 'sync', label: 'Sync delay', icon: 'Timer' },
  ],
  steps: [
    {
      title: 'Goal',
      tag: 'problem',
      heading: 'Every device, the same files, within seconds',
      eli5: 'Your homework notebook has copies at home, at school and at grandma’s, and every copy must match. The **school office** keeps the master copy for millions of kids.',
      body: [
        'Scope: upload and download any file up to 10 GB, sync it across a user’s devices, keep version history, and share folders. Real-time co-editing is out of scope.',
        'Needs, in order: **never lose a file**, sync fast, use little bandwidth (many devices are phones on metered data), and stay available.',
      ],
      keyIdea: 'A sync service is judged on what users feel: no file is ever lost, changes appear everywhere fast, and it does not eat their data plan.',
      metrics: { ...same, upload: '?', stored: '?' },
      scene: {
        nodes: [
          { ...laptop, status: 'active', chips: ['saves report.docx'] },
          { ...single, kind: 'internet', label: 'sync service', sub: 'to be designed', badge: '?' },
          { ...phone, chips: [{ text: 'must match', tone: 'warn' }] },
        ],
        links: [link('laptop', 'single'), link('single', 'phone', { label: 'within 5 s', labelTone: 'warn' })],
        flows: [
          { path: ['laptop', 'single'], tone: 'request', label: 'changed file', duration: 1.4 },
          { path: ['single', 'phone'], tone: 'event', label: 'new version', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Requirements, in priority order',
          icon: 'List',
          rows: [
            { text: 'Never lose a file', value: '1', tone: 'good' },
            { text: 'Sync across devices fast', value: '2' },
            { text: 'Spend little bandwidth', value: '3' },
            { text: 'Stay available', value: '4' },
            { text: 'Real-time co-editing', value: 'out of scope', tone: 'muted' },
          ],
        },
        caption: 'A change on the laptop must reach the phone',
      },
    },
    {
      title: 'Numbers',
      tag: 'concept',
      heading: 'Scale: 100 million users, 500 PB, 3,500 changes a second',
      eli5: 'The school office holds notebooks for a hundred million kids. Each kid fixes a few pages a day, so the **office** sees thousands of fixes every second.',
      body: [
        '**100 million** users, **25 million** daily actives with about 2.5 devices each, so up to **30 million** devices online at peak. At 5 GB each that is **500 PB**.',
        'Each active user saves about 4 changed files a day at 6 MB: 100 million changes a day, 1,200 a second, **3,500 at peak**. Whole-file uploads would be 600 TB a day. A change must reach the phone in **under 5 seconds**.',
      ],
      keyIdea: 'The data volume is huge but the request rate is modest, so the design effort goes into bytes and fan-out, not raw QPS.',
      metrics: same,
      scene: {
        nodes: [
          { ...laptop, chips: ['4 changes/day, 6 MB'] },
          { ...single, kind: 'internet', label: 'sync service', sub: 'to be designed', badge: '3,500/s peak' },
          { ...phone, chips: ['30M devices online'] },
        ],
        links: [link('laptop', 'single'), link('single', 'phone')],
        flows: [
          { path: ['laptop', 'single'], tone: 'request', label: 'change', count: 3, duration: 1.4 },
          { path: ['single', 'phone'], tone: 'event', label: 'sync', count: 3, duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Estimates',
          icon: 'Table',
          rows: [
            { text: 'Registered users', value: '100 M' },
            { text: 'Daily actives', value: '25 M' },
            { text: 'Devices online at peak', value: '30 M' },
            { text: 'Logical data (5 GB each)', value: '500 PB' },
            { text: 'Changes a day', value: '100 M, 1,200/s' },
            { text: 'Whole-file uploads a day', value: '600 TB', tone: 'warn' },
          ],
        },
        caption: 'Big data, modest request rate',
      },
    },
    {
      title: 'Sync API',
      tag: 'concept',
      heading: 'The API is built around a commit',
      eli5: 'A kid hands the office the list of pages in the new notebook. The office answers "done" or "send me these pages first". That hand-in is a **commit**.',
      body: [
        '`POST /files/{id}/commit` sends the base version, a client commit id and the ordered list of block hashes. The server answers "done, you are version 15" or "first send me these blocks", which the client uploads with `PUT /blocks/{hash}`.',
        'Other devices call `GET /changes?cursor=1041` to learn what changed, and `GET /blocks/{hash}` to fetch content.',
      ],
      keyIdea: 'A commit names the content by hash. The server asks only for what it lacks.',
      metrics: same,
      scene: {
        nodes: [
          { ...laptop, status: 'active', chips: ['commit base 14'] },
          { ...api, status: 'active', chips: ['version 15'] },
          { ...phone, chips: ['changes?cursor=1041'] },
        ],
        links: [link('laptop', 'api'), link('phone', 'api', { style: 'dashed' })],
        flows: [
          { path: ['laptop', 'api'], tone: 'request', label: 'commit v15', duration: 1.2 },
          { path: ['api', 'laptop'], tone: 'response', label: 'need 3 blocks', duration: 1.2, delay: 1.3 },
          { path: ['phone', 'api'], tone: 'request', label: 'changes?cursor=1041', duration: 1.4, delay: 2.6 },
          { path: ['api', 'phone'], tone: 'response', label: 'file 9001 is v15', duration: 1.4, delay: 4.1 },
        ],
        panel: {
          title: 'Endpoints',
          icon: 'Code',
          code: 'POST /files/{id}/commit (commit_id)\nPUT  /blocks/{hash}\nGET  /blocks/{hash}\nGET  /changes?cursor=1041\nGET  /files/{id}/versions',
          footer: { text: 'Content moves by hash, metadata by commit', tone: 'muted' },
        },
        caption: 'Commit names the blocks, devices read the journal',
      },
    },
    {
      title: 'Data model',
      tag: 'concept',
      heading: 'Files are versions, versions are lists of blocks',
      eli5: 'The office keeps an index card for each notebook listing its pages in order. That card box is the **metadata database**. The pages themselves sit in a filing cabinet.',
      body: [
        'A **namespace** is the root of one user’s tree, or of one shared folder. A file points at its latest **version**, an ordered list of block hashes that never changes once written. A **block** row says how many versions use those bytes. A small **namespaces** row holds the next journal number.',
        'The **changes** table is a journal per namespace: each commit appends the next sequence number, and each device remembers the last one it has seen.',
      ],
      keyIdea: 'Model a file as a pointer to an immutable version, and a version as an ordered list of content hashes. The bytes live elsewhere.',
      metrics: same,
      scene: {
        nodes: [{ ...laptop, chips: ['commit v15'] }, { ...api, status: 'active' }, { ...db, status: 'active', badge: 'files, versions, blocks' }],
        links: [link('laptop', 'api'), link('api', 'db')],
        flows: [
          { path: ['laptop', 'api'], tone: 'request', label: 'commit v15', duration: 1.2 },
          { path: ['api', 'db'], tone: 'request', label: 'INSERT version', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Five tables',
          icon: 'Table',
          rows: [
            { text: 'files', value: 'path, latest_ver' },
            { text: 'version_blocks', value: 'version, seq, hash' },
            { text: 'blocks', value: 'hash, size, refs' },
            { text: 'changes', value: 'seq, file, version, commit id' },
            { text: 'namespaces', value: 'id, next_seq' },
          ],
          footer: { text: 'Block bytes live in object storage', tone: 'muted' },
        },
        caption: 'Metadata is small, the bytes are somewhere else',
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
  commit_id    UUID,                    -- client commit id, makes retries idempotent
  PRIMARY KEY (namespace_id, seq)
);
CREATE TABLE namespaces (
  namespace_id BIGINT PRIMARY KEY,
  next_seq     BIGINT NOT NULL          -- next journal number
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
        'One server with a big disk and MySQL. The client uploads the whole file on every save. The server writes it under `/data/{user}/{path}`, records a row, and keeps the old file as the previous version.',
        'Other devices **poll**: every 60 seconds each asks "anything new?" and downloads the whole file if so. For a team of a hundred this is fine. The problems are all about size.',
      ],
      keyIdea: 'Whole-file upload plus polling is correct and simple, which makes it the right baseline to measure against.',
      metrics: { ...same, sync: '30 s avg' },
      scene: {
        nodes: [laptop, { ...single, status: 'active', chips: ['/data/{user}/{path}'] }, phone],
        links: [link('laptop', 'single', { label: 'whole file' }), link('phone', 'single', { label: 'poll every 60 s' })],
        flows: [
          { path: ['laptop', 'single'], tone: 'request', label: 'PUT whole file', duration: 1.6 },
          { path: ['phone', 'single'], tone: 'request', label: 'anything new?', duration: 1.2, delay: 0.6 },
          { path: ['single', 'phone'], tone: 'response', label: 'whole file', duration: 1.4, delay: 2.2 },
        ],
        panel: {
          title: 'Version one',
          icon: 'Server',
          rows: [
            { text: 'Upload', value: 'whole file' },
            { text: 'Notify', value: 'poll every 60 s' },
            { text: 'Storage', value: 'one disk' },
            { text: 'Metadata', value: 'MySQL' },
          ],
        },
        caption: 'Upload the whole file, poll once a minute',
      },
    },
    {
      title: 'Bandwidth',
      tag: 'case',
      heading: 'Breaks first: a typo costs 200 MB',
      eli5: 'A kid fixes one word and recopies the whole notebook, then every other kid recopies it too. That is a lot of paper for one word.',
      body: [
        'Fix a typo in a 200 MB slide deck and the laptop uploads 200 MB, then every other device downloads 200 MB.',
        'Across the fleet that is 600 TB a day in and more going out, almost all of it bytes the server already had.',
      ],
      keyIdea: 'Whole-file transfer pays for the entire file on every tiny edit, in both directions.',
      metrics: { ...same, sync: '30 s avg' },
      metricTones: { upload: 'bad' },
      scene: {
        nodes: [
          { ...laptop, status: 'hot', chips: [{ text: 'fix 1 typo', tone: 'warn' }] },
          { ...single, status: 'hot', load: 92 },
          { ...phone, chips: [{ text: 'download 200 MB', tone: 'bad' }] },
        ],
        links: [
          link('laptop', 'single', { label: '200 MB upload', labelTone: 'warn' }),
          link('single', 'phone', { label: '200 MB download', labelTone: 'warn' }),
        ],
        flows: [
          { path: ['laptop', 'single'], tone: 'error', label: '200 MB again', duration: 2 },
          { path: ['single', 'phone'], tone: 'error', label: '200 MB', duration: 2, delay: 2.1 },
        ],
        panel: {
          title: 'One typo',
          icon: 'Download',
          rows: [
            { text: 'Bytes that changed', value: '12 B', tone: 'good' },
            { text: 'Bytes uploaded', value: '200 MB', tone: 'bad' },
            { text: 'Per extra device', value: '200 MB', tone: 'bad' },
            { text: 'Whole fleet, a day', value: '600 TB', tone: 'bad' },
          ],
        },
        caption: 'Most bytes already exist on the server',
      },
    },
    {
      title: 'Polling',
      tag: 'case',
      heading: 'Breaks second: 500,000 polls a second',
      eli5: 'Thirty million kids phone the office every minute to ask "anything new?". Nearly every answer is "no", and a real change still waits half a minute.',
      body: [
        '30 million online devices asking every 60 seconds is **500,000 requests a second**. Almost every answer is "nothing new".',
        'A change also waits for the next poll: 30 seconds on average, six times the 5 second target.',
      ],
      keyIdea: 'Polling burns most of its requests on empty answers and still reacts slowly.',
      metrics: { ...same, sync: '30 s avg' },
      metricTones: { sync: 'bad' },
      scene: {
        nodes: [
          { ...single, status: 'hot', load: 95, chips: [{ text: '500K polls/s', tone: 'bad' }] },
          { ...phone, status: 'hot', badge: '30 s behind' },
          { ...laptop, chips: ['saved 2 s ago'] },
        ],
        links: [link('phone', 'single', { label: 'every 60 s', labelTone: 'warn' }), link('laptop', 'single')],
        flows: [
          { path: ['phone', 'single'], tone: 'request', label: 'anything new?', count: 5, duration: 0.9 },
          { path: ['single', 'phone'], tone: 'response', label: 'no', count: 5, duration: 0.9, delay: 1 },
        ],
        panel: {
          title: 'Polling math',
          icon: 'Timer',
          rows: [
            { text: 'Devices online', value: '30 M' },
            { text: 'Poll interval', value: '60 s' },
            { text: 'Requests a second', value: '500,000', tone: 'bad' },
            { text: 'Answers with news', value: 'almost none', tone: 'warn' },
            { text: 'Average delay', value: '30 s vs 5 s', tone: 'bad' },
          ],
        },
        caption: 'Most polls carry nothing new',
      },
    },
    {
      title: 'Storage',
      tag: 'case',
      heading: 'Breaks third: one box cannot hold 500 PB safely',
      eli5: 'One cupboard cannot hold every notebook, and if it burns down every kid loses their homework. The office needs many cupboards and spare copies.',
      body: [
        '500 PB is about 30,000 disks of 16 TB, far past one machine. And one dead server must never lose a file.',
        'A single box fails on capacity and on safety. Data needs a distributed store with copies, and metadata needs its own careful home.',
      ],
      keyIdea: 'Capacity and durability both need many machines, with copies of every block.',
      metrics: { ...same, sync: '30 s avg' },
      metricTones: { stored: 'bad' },
      scene: {
        nodes: [
          { ...laptop, chips: ['report.docx'] },
          { ...single, status: 'down', badge: 'disk full or dead' },
          { ...store, at: at(5.4, 0), status: 'dim', badge: 'needed: 500 PB' },
        ],
        links: [link('laptop', 'single'), link('single', 'store', { style: 'faint' })],
        flows: [{ path: ['laptop', 'single'], tone: 'error', label: 'no space left', duration: 1.6 }],
        panel: {
          title: 'What one box means',
          icon: 'HardDrive',
          rows: [
            { text: 'Data to hold', value: '500 PB' },
            { text: 'Disks of 16 TB', value: '~30,000', tone: 'bad' },
            { text: 'Copies of each file', value: '1', tone: 'bad' },
            { text: 'If the box dies', value: 'files lost', tone: 'bad' },
          ],
          footer: { text: 'Fails the "never lose a file" rule', tone: 'bad' },
        },
        caption: 'One machine, one copy, no safety',
      },
    },
    {
      title: 'Blocks',
      tag: 'concept',
      heading: 'Fix 1: split files into hashed blocks',
      eli5: 'Notebooks are cut into numbered pages, and each page gets a fingerprint stamp. The stamp is a **hash**, and the office files each page under its stamp.',
      body: [
        'The client splits each file into **4 MB blocks** and computes a SHA-256 **hash** of each. A 200 MB deck becomes 50 blocks and 50 hashes.',
        'Blocks are stored in object storage under their namespace and hash, as in the object storage lesson. The metadata only lists hashes in order.',
      ],
      keyIdea: 'Address blocks by their content hash. The same bytes always get the same name.',
      metrics: { ...same, stored: '500 PB' },
      scene: {
        nodes: [
          { ...laptop, status: 'active', chips: ['report.docx 200 MB'], badge: '50 blocks' },
          blocks,
          { ...store, badge: 'key = (namespace, hash)' },
        ],
        links: [link('laptop', 'blocks'), link('blocks', 'store')],
        flows: [{ path: ['laptop', 'blocks', 'store'], tone: 'data', label: '4 MB block', count: 3, duration: 1.8 }],
        panel: {
          title: 'The deck as blocks',
          icon: 'Hash',
          rows: [
            { text: 'block 0', value: '9f1c…' },
            { text: 'block 1', value: '03ab…' },
            { text: 'block 2', value: 'e77d…' },
            { text: '… 47 more', value: '4 MB each', tone: 'muted' },
          ],
        },
        caption: 'Bytes get named by their hash',
      },
    },
    {
      title: 'Dedup',
      tag: 'concept',
      heading: 'Commit hashes first, upload only what is missing',
      eli5: 'Before carrying pages in, the kid reads out the stamps. The office says "I have 47 of those, bring me the other 3". Skipping pages the office has is **dedup**.',
      body: [
        'Before uploading, the client commits the hash list. The server checks which hashes the namespace already owns and asks only for the rest.',
        'This gives **dedup** for free: a copied file, a file moved between folders, or the same photo saved twice uploads zero blocks.',
      ],
      keyIdea: 'Say "I already have that" before any bytes move.',
      metrics: { ...same, upload: '450 TB/day', stored: '430 PB' },
      metricTones: { upload: 'good' },
      scene: {
        nodes: [
          { ...laptop, status: 'active', badge: '50 hashes' },
          { ...api, status: 'active' },
          { ...db, at: at(5.4, 3.5), badge: '47 already owned' },
          blocks,
          { ...store, badge: '+3 blocks' },
        ],
        links: [link('laptop', 'api'), link('api', 'db'), link('laptop', 'blocks'), link('blocks', 'store')],
        flows: [
          { path: ['laptop', 'api'], tone: 'request', label: 'commit 50 hashes', duration: 1 },
          { path: ['api', 'db'], tone: 'request', label: 'which are new?', duration: 0.9, delay: 1.1 },
          { path: ['api', 'laptop'], tone: 'response', label: 'send 3', duration: 1, delay: 2.1 },
          { path: ['laptop', 'blocks', 'store'], tone: 'data', label: '3 blocks', count: 3, duration: 1.6, delay: 3.2 },
        ],
        panel: {
          title: 'The commit answer',
          icon: 'Copy',
          rows: [
            { text: 'Hashes sent', value: '50' },
            { text: 'Already owned', value: '47', tone: 'good' },
            { text: 'Missing, upload these', value: '3', tone: 'warn' },
          ],
        },
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
      title: 'Dedup scope',
      tag: 'tradeoff',
      heading: 'Dedup per namespace, not across users',
      eli5: 'If the office said "someone already has that page" to anyone, a nosy kid could learn who owns which pages. So each kid’s pages are only matched against their own.',
      body: [
        'Global dedup across users saves more disk, but it leaks information: upload a file, see whether it was skipped, and you learn that someone already stores it.',
        'So dedup is scoped to the **namespace**. In our model that still cuts uploads to about 450 TB a day.',
      ],
      keyIdea: 'Cross-user dedup trades a privacy leak for disk. This design keeps dedup inside one namespace.',
      metrics: { ...same, upload: '450 TB/day', stored: '430 PB' },
      scene: {
        nodes: [
          { id: 'ns77', kind: 'block', at: at(-5.4, -3.5), label: 'namespace 77', sub: 'Ana', icon: 'Users', tint: 'blue', status: 'active' },
          { id: 'ns78', kind: 'block', at: at(-5.4, 3.5), label: 'namespace 78', sub: 'Ben', icon: 'Users', tint: 'amber' },
          { ...store, at: at(0, 0), badge: 'key = (namespace, hash)' },
        ],
        links: [
          link('ns77', 'store', { label: 'skip: Ana has it' }),
          link('ns78', 'store', { label: 'upload: Ben never sent it', labelTone: 'warn' }),
        ],
        flows: [
          { path: ['ns77', 'store'], tone: 'response', label: 'already stored', duration: 1.4 },
          { path: ['ns78', 'store'], tone: 'data', label: 'same photo, uploads', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Scope of dedup',
          icon: 'Shield',
          rows: [
            { text: 'Per namespace', value: 'safe, 450 TB/day', tone: 'good' },
            { text: 'Across all users', value: 'less disk', tone: 'warn' },
            { text: 'But upload speed leaks', value: '"someone has it"', tone: 'bad' },
          ],
        },
        caption: 'Skipping an upload tells you something',
      },
    },
    {
      title: 'Delta sync',
      tag: 'concept',
      heading: 'Fix 2: delta sync uploads only changed blocks',
      eli5: 'Change one page and you only bring that page. Sending only changed pages is **delta sync**, and the other kids only fetch that one page too.',
      body: [
        'Fix a typo on slide 30 and only the block holding slide 30 gets a new hash. The laptop uploads 4 MB instead of 200 MB, and the phone downloads the same 4 MB.',
        'Version 15 simply lists 49 old hashes and 1 new one.',
      ],
      keyIdea: 'A changed block is a new hash. Every untouched block keeps its old name and never travels again.',
      metrics: { ...same, upload: '180 TB/day', stored: '380 PB' },
      metricTones: { upload: 'good' },
      scene: {
        nodes: [
          { ...laptop, status: 'active', chips: [{ text: '1 of 50 changed', tone: 'good' }] },
          { ...blocks, status: 'active' },
          { ...store, status: 'ok' },
        ],
        links: [link('laptop', 'blocks', { label: '4 MB, not 200 MB' }), link('blocks', 'store')],
        flows: [{ path: ['laptop', 'blocks', 'store'], tone: 'data', label: 'block 30', duration: 2 }],
        panel: {
          title: 'Version 14 to 15',
          icon: 'Layers',
          rows: [
            { text: 'blocks 0 to 29', value: 'same hashes', tone: 'muted' },
            { text: 'block 30', value: 'new hash', tone: 'warn' },
            { text: 'blocks 31 to 49', value: 'same hashes', tone: 'muted' },
            { text: 'Uploaded', value: '4 MB of 200 MB', tone: 'good' },
          ],
        },
        caption: 'One changed block, one small upload',
      },
      quiz: {
        question: 'A user changes a few words in the middle of a 200 MB file without changing its length. Blocks are 4 MB. Roughly how much does the laptop upload?',
        options: ['200 MB', '100 MB', 'About 4 MB', 'Nothing, the server keeps a diff'],
        answer: 2,
        explain: 'Only the block that contains the changed bytes gets a new hash, so one 4 MB block is sent (less after compression). Every other hash matches a block the server already has.',
      },
    },
    {
      title: 'Chunking',
      tag: 'tradeoff',
      heading: 'Fixed blocks have one weakness: inserts',
      eli5: 'If you add a line at the top of the notebook, every page boundary slides down and every page looks new. Cutting pages at natural breaks keeps most of them the same.',
      body: [
        'Inserting bytes near the start of a file shifts every later 4 MB boundary, so every block gets a new hash.',
        '**Content-defined chunking** cuts blocks where a rolling hash of the data hits a pattern. Boundaries follow the content, so most blocks survive an insert.',
      ],
      keyIdea: 'Fixed boundaries break after an insert. Boundaries chosen from the content stay stable.',
      metrics: { ...same, upload: '180 TB/day', stored: '380 PB' },
      scene: {
        nodes: [
          { ...laptop, status: 'active', chips: [{ text: 'insert 1 line at top', tone: 'warn' }] },
          { ...blocks, label: 'chunker', sub: 'rolling hash' },
          { ...store, status: 'ok' },
        ],
        links: [link('laptop', 'blocks'), link('blocks', 'store')],
        flows: [{ path: ['laptop', 'blocks', 'store'], tone: 'data', label: '2 new blocks', duration: 1.8 }],
        panel: {
          title: 'After inserting a line at the top',
          icon: 'Scale',
          rows: [
            { text: 'Fixed 4 MB blocks', value: '50 of 50 change', tone: 'bad' },
            { text: 'Content-defined chunks', value: '1 to 2 change', tone: 'good' },
            { text: 'Cost', value: 'more CPU on client', tone: 'warn' },
          ],
        },
        caption: 'Cut where the content says, not where the ruler says',
      },
    },
    {
      title: 'Block servers',
      tag: 'concept',
      heading: 'Block servers verify, compress, then encrypt',
      eli5: 'A **block server** is the mail room. It checks each page matches its stamp, folds it small when it can, seals it in an envelope, and files it.',
      body: [
        'Block servers check each block’s hash, then **compress** it when it helps. Text and office files shrink a lot. JPEG and MP4 do not, so skip those. This runs after the bytes arrive, so it cuts stored bytes only, not upload traffic.',
        'Then they **encrypt**. Compress first, because encrypted data looks random and will not compress. Each namespace has a data key, wrapped by a key in the **KMS**.',
      ],
      keyIdea: 'Verify, compress, then encrypt, in that order, in one tier you control.',
      metrics: { ...same, upload: '180 TB/day', stored: '380 PB' },
      scene: {
        nodes: [
          { ...laptop, chips: ['block 30, 4 MB'] },
          { ...blocks, status: 'active', chips: ['verify', 'gzip', 'AES'] },
          { ...store, status: 'ok', badge: '1.4 MB sealed' },
          { ...vault, badge: 'wraps data key' },
        ],
        links: [link('laptop', 'blocks'), link('blocks', 'store'), link('blocks', 'vault', { style: 'dashed' })],
        flows: [
          { path: ['laptop', 'blocks'], tone: 'data', label: 'block 30 (4 MB)', duration: 1.3 },
          { path: ['blocks', 'vault'], tone: 'handshake', label: 'data key', duration: 0.9, delay: 1.4 },
          { path: ['vault', 'blocks'], tone: 'handshake', duration: 0.9, delay: 2.3 },
          { path: ['blocks', 'store'], tone: 'data', label: '1.4 MB sealed', duration: 1.1, delay: 3.3 },
        ],
        panel: {
          title: 'On the way in',
          icon: 'Package',
          rows: [
            { text: '1. Verify SHA-256', value: 'matches', tone: 'good' },
            { text: '2. Compress', value: '4 MB to 1.4 MB' },
            { text: '3. Encrypt AES', value: 'data key from KMS' },
            { text: 'JPEG, MP4', value: 'skip compression', tone: 'muted' },
          ],
        },
        caption: 'Compress first, because ciphertext will not shrink',
      },
    },
    {
      title: 'Presigned URLs',
      tag: 'tradeoff',
      heading: 'Why not upload straight to storage?',
      eli5: 'The kid could walk pages straight into the cabinet room. But then every kid must fold and seal pages the same way, and nobody checks the stamps.',
      body: [
        'Pre-signed URLs save a hop, but every client (Windows, macOS, iOS, Android, web) must implement compression and encryption identically. The server cannot verify a block matches its hash before it lands.',
        'Block servers keep that logic in one place.',
      ],
      keyIdea: 'One extra hop buys one implementation of compression and encryption, and a hash check before storage.',
      metrics: { ...same, upload: '180 TB/day', stored: '380 PB' },
      metricTones: { upload: 'good' },
      scene: {
        nodes: [laptop, { ...blocks, status: 'active' }, store],
        links: [
          link('laptop', 'blocks', { label: 'one code path' }),
          link('blocks', 'store'),
          link('laptop', 'store', { style: 'dashed', label: 'presigned: 5 client copies', labelTone: 'warn' }),
        ],
        flows: [{ path: ['laptop', 'blocks', 'store'], tone: 'data', label: 'block', duration: 1.8 }],
        panel: {
          title: 'Two ways to upload',
          icon: 'Scale',
          rows: [
            { text: 'Presigned URL', value: 'saves a hop', tone: 'good' },
            { text: 'Presigned URL', value: '5 clients must match', tone: 'bad' },
            { text: 'Presigned URL', value: 'no hash check', tone: 'bad' },
            { text: 'Block servers', value: 'one place for the logic', tone: 'good' },
          ],
        },
        caption: 'Keep the byte logic on the server',
      },
    },
    {
      title: 'Big files',
      tag: 'case',
      heading: 'Case: a 10 GB upload dies halfway',
      eli5: 'A kid carries a 2,500-page notebook and trips at page 1,200. Because every page has a stamp, the office remembers what arrived and the kid carries only the rest.',
      body: [
        'A 10 GB file is 2,560 blocks. On a phone the connection will drop. Because blocks are keyed by hash, a retry is safe: ask the server which hashes are missing and send only those.',
        'The client keeps no special upload session. Re-running the commit finds block 1,200 onward missing and resumes there.',
      ],
      keyIdea: 'Content-addressed blocks make uploads resumable for free: the missing list is the resume point.',
      metrics: { ...same, upload: '180 TB/day', stored: '380 PB' },
      scene: {
        nodes: [
          { ...laptop, status: 'hot', chips: [{ text: '10 GB, 2,560 blocks', tone: 'warn' }] },
          { ...blocks, status: 'active' },
          { ...store, badge: '1,200 blocks kept', status: 'ok' },
        ],
        links: [link('laptop', 'blocks', { label: 'wifi drops at block 1,200', labelTone: 'warn' }), link('blocks', 'store')],
        flows: [
          { path: ['laptop', 'blocks', 'store'], tone: 'data', label: 'blocks 1,200 onward', count: 3, duration: 2 },
        ],
        panel: {
          title: 'Resume',
          icon: 'Repeat',
          rows: [
            { text: 'Blocks in the file', value: '2,560' },
            { text: 'Stored before the drop', value: '1,200', tone: 'good' },
            { text: 'Commit says missing', value: '1,360', tone: 'warn' },
            { text: 'Re-sent after resume', value: '1,360 only', tone: 'good' },
          ],
        },
        caption: 'A retry is the same commit again',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Part 1 recap: name the bytes, send only what changed',
      eli5: 'Pages with fingerprints, only changed pages carried in, folded and sealed by the mail room. The **block** pipeline keeps the office small and the kids’ bags light.',
      body: [
        'Files split into 4 MB blocks named by hash. Dedup per namespace, delta sync for edits, content-defined chunking for inserts. Block servers verify, compress, then encrypt into object storage, and uploads resume from a missing list.',
        'Uploads fell from 600 to 180 TB a day. Part 2 covers metadata, notifications, conflicts, sharing, history and failures.',
      ],
      keyIdea: 'Content is immutable and named by hash, so most of the sync problem becomes "which hashes does the server lack?".',
      metrics: { ...same, upload: '180 TB/day', stored: '380 PB' },
      metricTones: { upload: 'good', stored: 'good' },
      scene: {
        nodes: [{ ...laptop, status: 'ok' }, { ...blocks, status: 'ok' }, { ...store, status: 'ok' }, vault],
        links: [link('laptop', 'blocks'), link('blocks', 'store'), link('blocks', 'vault', { style: 'dashed' })],
        flows: [{ path: ['laptop', 'blocks', 'store'], tone: 'data', label: 'changed blocks', duration: 1.8 }],
        panel: {
          title: 'Bytes pipeline',
          icon: 'Layers',
          rows: [
            { text: 'Split', value: '4 MB, hashed' },
            { text: 'Dedup', value: 'per namespace' },
            { text: 'Send', value: 'changed blocks only', tone: 'good' },
            { text: 'Store', value: 'compressed, encrypted' },
            { text: 'Uploads', value: '600 to 180 TB/day', tone: 'good' },
          ],
        },
        caption: 'The byte path is done',
      },
      quiz: {
        question: 'A user copies a 1 GB folder into another folder in the same account. How many bytes of content does the client upload?',
        options: ['1 GB, a copy is a new file', 'About half, after compression', 'Almost none, the hashes already exist in the namespace', 'Only the file names, but the blocks are re-encrypted and re-sent'],
        answer: 2,
        explain: 'The commit lists block hashes the namespace already owns, so the server asks for nothing. Only metadata rows are written.',
      },
    },
  ],
};
