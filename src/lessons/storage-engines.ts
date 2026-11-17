import type { Lesson, SceneNode } from '../engine/types';

const app: SceneNode = { id: 'app', kind: 'server', at: [-3.5, 3.5], label: 'tracking API', sub: '50K scans/s' };
const wal: SceneNode = { id: 'wal', kind: 'queue', at: [-3.75, -0.25], label: 'WAL', sub: 'append-only file' };
const mem: SceneNode = { id: 'mem', kind: 'cache', at: [-1, 2.5], label: 'RAM table', sub: 'in memory' };
const file: SceneNode = { id: 'file', kind: 'storage', at: [1.5, -1.5], label: 'data file', sub: 'on disk' };

// B-tree: a root page above a row of leaf pages.
const root: SceneNode = { id: 'root', kind: 'storage', at: [-0.5, -4.5], label: 'root page', sub: 'key ranges' };
const leafA: SceneNode = { id: 'leafA', kind: 'storage', at: [1.1, 0.1], label: 'leaf A', sub: 'keys 1 to 400' };
const leafB: SceneNode = { id: 'leafB', kind: 'storage', at: [2.6, -1.4], label: 'leaf B', sub: 'keys 401 to 800' };
const leafC: SceneNode = { id: 'leafC', kind: 'storage', at: [4.1, -2.9], label: 'leaf C', sub: 'keys 801 to 1200' };
const pool: SceneNode = { ...mem, label: 'buffer pool', sub: 'pages cached in RAM' };

// LSM tree: a row of small fresh files above two big merged ones.
const memtable: SceneNode = { ...mem, label: 'memtable', sub: 'sorted, 64 MB' };
const s1: SceneNode = { id: 's1', kind: 'storage', at: [-1.75, -2.75], label: 'SSTable 1', sub: 'oldest' };
const s2: SceneNode = { id: 's2', kind: 'storage', at: [-0.25, -4.25], label: 'SSTable 2' };
const s3: SceneNode = { id: 's3', kind: 'storage', at: [1.25, -5.75], label: 'SSTable 3', sub: 'newest' };
const big1: SceneNode = { id: 'big1', kind: 'storage', at: [2, -0.5], label: 'level 1', sub: 'merged, sorted' };
const big2: SceneNode = { id: 'big2', kind: 'storage', at: [4, -2.5], label: 'level 2', sub: '10x larger' };

const btreeLinks = [
  { from: 'app', to: 'wal' },
  { from: 'app', to: 'mem' },
  { from: 'root', to: 'leafA' },
  { from: 'root', to: 'leafB' },
  { from: 'root', to: 'leafC' },
];

const lsmLinks = [
  { from: 'app', to: 'wal' },
  { from: 'app', to: 'mem' },
];

export const storageEngines: Lesson = {
  id: 'storage-engines',
  title: 'Storage engines: B-tree, LSM tree, WAL',
  tagline: 'What a database does between "INSERT" and the disk, and why some engines take writes ten times faster than others.',
  minutes: 15,
  level: 'Intermediate',
  learn: [
    'How a write-ahead log makes a write durable before the data file changes',
    'How crash recovery replays the log',
    'B-tree pages, in-place updates and page splits',
    'The LSM write path: memtable, SSTables and compaction',
    'Read, write and space amplification, and which databases chose which',
  ],
  metrics: [
    { key: 'wps', label: 'Writes/s' },
    { key: 'io', label: 'Disk work per write' },
    { key: 'read', label: 'Lookup cost' },
    { key: 'crash', label: 'After a crash' },
  ],
  steps: [
    {
      title: 'Fast or safe',
      tag: 'problem',
      heading: 'Keep it in RAM and lose it, or write to disk and crawl',
      eli5: 'The library gets 50 new books a minute. If the librarian only remembers them in her head, a nap wipes them out. If she walks to the right shelf for every single book, a queue forms at the desk.',
      body: [
        'A parcel company records every barcode scan: **50,000 writes per second**. The first version of its store keeps rows in a table in RAM and saves the whole table to a file every 10 minutes. It is fast. Then a power cut hits, and up to 10 minutes of scans (30 million rows) are gone.',
        'The second version updates the data file on disk for every write and forces it to the device with `fsync` before answering. Nothing is lost now. But each row lands at a different spot in a large file, and small synced writes at scattered positions are the slowest thing a disk does. Throughput falls to about 5,000 per second.',
        'A **storage engine** is the part of a database that solves this: it decides what goes to disk, in what layout, and in what order. Two designs dominate, the **B-tree** and the **LSM tree**, and both lean on the same trick first.',
      ],
      keyIdea: 'RAM is fast and forgets. Disk remembers and is slow at scattered writes. A storage engine exists to get both speed and durability.',
      metrics: { wps: '5,000 (need 50K)', io: '1 scattered sync', read: '-', crash: 'safe, but too slow' },
      scene: {
        nodes: [{ ...app, status: 'hot', badge: 'queueing' }, { ...mem, status: 'dim' }, { ...file, status: 'hot', badge: 'fsync per row' }],
        links: [
          { from: 'app', to: 'mem' },
          { from: 'mem', to: 'file' },
        ],
        flows: [
          { path: ['app', 'mem'], tone: 'request', label: 'scan #881', count: 5, duration: 1 },
          { path: ['mem', 'file'], tone: 'data', label: 'seek, write, sync', duration: 2.8, delay: 1 },
          { path: ['file', 'mem', 'app'], tone: 'response', label: 'ok', duration: 1.4, delay: 3.9 },
        ],
        caption: 'Every write waits for a scattered disk update',
      },
    },
    {
      title: 'The WAL',
      tag: 'concept',
      heading: 'Write-ahead log: append first, organize later',
      eli5: 'The librarian keeps a notebook on the desk, the **WAL**. Every new book gets one line at the bottom of the page before anything else happens. Writing one more line is quick, and the notebook survives a nap.',
      body: [
        'Appending to the end of one file is the cheapest durable write there is. The disk never has to jump around, and the operating system can batch the work. So the engine splits a write in two.',
        'First, it appends a small record describing the change to the **write-ahead log** (WAL) and syncs it. Once that record is on disk, the write is durable and the client gets its answer. Second, it changes the table in RAM. The real data file is brought up to date later, in the background.',
        'The rule is in the name: the log record reaches disk **ahead** of the data it describes. Many commits can share one sync (**group commit**), so 50,000 writes per second may cost only a few hundred syncs.',
      ],
      keyIdea: 'A write is durable the moment its log record is synced. The data file can catch up later.',
      metrics: { wps: '50,000', io: '1 sequential append', read: 'from RAM', crash: 'log has everything' },
      scene: {
        nodes: [{ ...app, status: 'active' }, { ...wal, status: 'active', badge: 'append + sync' }, { ...mem, badge: 'updated second' }, { ...file, status: 'dim', badge: 'updated later' }],
        links: [
          { from: 'app', to: 'wal' },
          { from: 'app', to: 'mem' },
          { from: 'mem', to: 'file', style: 'dashed', label: 'background' },
        ],
        flows: [
          { path: ['app', 'wal'], tone: 'request', label: 'log record', count: 4, duration: 0.9 },
          { path: ['wal', 'app'], tone: 'handshake', label: 'synced', duration: 0.9, delay: 1 },
          { path: ['app', 'mem'], tone: 'data', label: 'apply', duration: 0.9, delay: 2 },
          { path: ['mem', 'file'], tone: 'data', duration: 2, delay: 3.2 },
        ],
        caption: 'Log first, then memory, then the data file',
      },
      code: {
        language: 'python',
        title: 'A write-ahead log in 15 lines',
        source: `import os, json

log = open("engine.wal", "ab")
table = {}                       # the in-memory copy

def put(key, value):
    record = json.dumps({"k": key, "v": value}).encode() + b"\\n"
    log.write(record)            # 1. append to the end of the log
    log.flush()
    os.fsync(log.fileno())       # 2. force it onto the device
    table[key] = value           # 3. only now change memory
    return "ok"                  # 4. safe to tell the client

def recover():
    for line in open("engine.wal", "rb"):
        rec = json.loads(line)
        table[rec["k"]] = rec["v"]   # replay in the original order`,
        highlight: [8, 10, 11, 15, 17],
      },
    },
    {
      title: 'Crash recovery',
      tag: 'case',
      heading: 'Case: the power fails mid-afternoon',
      eli5: 'The librarian dozes off and forgets what was on her desk. When she wakes, she reads the notebook from her last bookmark and redoes each line. Nothing she promised a reader is missing.',
      body: [
        'The machine loses power. Everything in RAM is gone, including changes that never reached the data file. On restart the engine opens the WAL and **replays** it: every record is applied again, in order, until memory and the data file match what clients were told.',
        'Replaying a log from the beginning of time would take hours, so the engine takes **checkpoints**. A checkpoint flushes changed data to the data file and notes the log position it covers. Recovery starts from the last checkpoint, and older log segments can be deleted.',
        'A record that was only half written when the power died fails its checksum and is ignored. That is fine, because its client never got an answer.',
      ],
      keyIdea: 'Recovery is replay: start at the last checkpoint and apply the log forward. Acknowledged writes always come back.',
      metrics: { wps: '0 (recovering)', io: 'replay', read: '-', crash: '0 acked writes lost' },
      scene: {
        nodes: [{ ...app, status: 'dim', badge: 'waiting' }, { ...wal, status: 'ok', badge: 'replay from checkpoint' }, { ...mem, status: 'down', badge: 'wiped' }, { ...file, status: 'active', badge: 'catching up' }],
        links: [
          { from: 'wal', to: 'mem' },
          { from: 'mem', to: 'file' },
        ],
        flows: [
          { path: ['wal', 'mem'], tone: 'data', label: 'redo records', count: 5, duration: 1.4 },
          { path: ['mem', 'file'], tone: 'data', duration: 1.4, delay: 1.5 },
        ],
        caption: 'RAM is empty. The log rebuilds it.',
      },
      quiz: {
        question: 'The engine acknowledged a write, then crashed before the changed data reached the data file. What happens on restart?',
        options: [
          'The write is lost, because the data file never saw it',
          'The write is recovered, because its log record was synced before the acknowledgment',
          'The client must retry, because the engine cannot know',
          'The whole data file is rebuilt from a backup',
        ],
        answer: 1,
        explain: 'The acknowledgment is only sent after the WAL record is on disk. Recovery replays that record and the change reappears.',
      },
    },
    {
      title: 'B-tree pages',
      tag: 'concept',
      heading: 'B-tree: sorted pages with signposts',
      eli5: 'The library has shelves in A to Z order, and a sign at the entrance says which aisle holds which letters. To find a book you read the sign, walk to one shelf, and look there.',
      body: [
        'The log makes writes safe. It is useless for lookups, since finding one key means reading all of it. The data file needs a layout that can be searched. The classic one is the **B-tree**.',
        'The file is cut into fixed-size **pages**, commonly 4 to 16 KB. Leaf pages hold rows in key order. Pages above them hold only key ranges and pointers to the pages below. A lookup starts at the root and follows one pointer per level.',
        'Each page points to hundreds of children, so the tree is very flat. With 400 pointers per page, three levels reach 64 million rows and four levels reach about 25 billion. The top levels stay cached in RAM, so a lookup usually costs **one or two disk reads**.',
      ],
      keyIdea: 'A B-tree keeps data sorted in fixed-size pages, so any key is three or four page hops from the root.',
      metrics: { wps: '-', io: '-', read: '1 to 2 page reads', crash: 'WAL protects pages' },
      scene: {
        nodes: [app, { ...pool, status: 'dim' }, { ...wal, status: 'dim' }, { ...root, status: 'active', badge: '512 → leaf B' }, leafA, { ...leafB, status: 'ok', badge: 'row 512' }, leafC],
        links: btreeLinks,
        flows: [
          { path: ['app', 'mem'], tone: 'request', label: 'GET 512', duration: 1 },
          { path: ['root', 'leafB'], tone: 'request', label: 'follow pointer', duration: 1.2, delay: 1.1 },
          { path: ['leafB', 'root'], tone: 'response', label: 'row', duration: 1.2, delay: 2.4 },
        ],
        caption: 'One pointer per level, straight to the right leaf',
      },
    },
    {
      title: 'In-place updates',
      tag: 'concept',
      heading: 'A B-tree write changes a page where it lies',
      eli5: 'A new book has exactly one right place on the shelves. The librarian notes it in the notebook, then squeezes it into that shelf. If the shelf is full, she splits it into two shelves and fixes the sign.',
      body: [
        'To insert key 512, the engine finds leaf B, loads it into the **buffer pool** (its page cache in RAM) if it is not there, logs the change in the WAL, and edits the page in memory. The page is now **dirty**. A background writer copies dirty pages back to their fixed positions in the file.',
        'This is an **in-place update**: every key has one home page. Reads love that. Writes pay for it in two ways. Keys arrive in random order, so the pages being changed are scattered across the file. And changing a 100-byte row eventually rewrites the whole 8 KB page.',
        'When a leaf is full, it **splits** into two half-full pages and the parent gets a new pointer. Splits keep the tree balanced, and they leave pages partly empty, commonly a third of the space.',
      ],
      keyIdea: 'B-trees update pages in place: one home per key, great for reads, scattered page writes for random inserts.',
      metrics: { wps: '10,000', io: 'WAL + 8 KB page', read: '1 to 2 page reads', crash: 'WAL protects pages' },
      scene: {
        nodes: [{ ...app, status: 'active' }, { ...pool, status: 'active', badge: 'leaf B dirty' }, { ...wal, badge: 'logged first' }, root, leafA, { ...leafB, status: 'hot', badge: 'full: split' }, leafC],
        links: [...btreeLinks, { from: 'mem', to: 'leafB', style: 'dashed', label: 'flush page' }],
        flows: [
          { path: ['app', 'wal'], tone: 'request', label: 'log insert 512', duration: 0.9 },
          { path: ['app', 'mem'], tone: 'data', label: 'edit page', duration: 0.9, delay: 1 },
          { path: ['mem', 'leafB'], tone: 'data', label: 'rewrite 8 KB', duration: 1.8, delay: 2.1 },
        ],
        caption: 'A small row change rewrites a whole page',
      },
    },
    {
      title: 'LSM memtable',
      tag: 'concept',
      heading: 'LSM tree: never go back and edit',
      eli5: 'A different library skips the shelves at first. New books go on a small sorted tray on the desk, the **memtable**. When the tray is full, the whole tray is sealed into a box in one go.',
      body: [
        'The **log-structured merge tree** (LSM tree) takes the WAL idea to its end: what if every disk write were sequential?',
        'A write appends to the WAL and inserts the key into the **memtable**, a sorted structure in RAM. That is the whole write path. No page is read from disk and nothing on disk is edited. When the memtable reaches a size limit (say 64 MB), it is written out in one sequential pass as an **SSTable** (sorted string table): an immutable file of keys in order. A fresh memtable takes over, and the matching WAL segment can be dropped.',
        'An update is a new entry with the same key. A delete is a marker called a **tombstone**. The old values stay on disk for now. On the same hardware, the parcel store now absorbs its 50,000 writes per second with room to spare.',
      ],
      keyIdea: 'An LSM write is one log append plus one in-memory insert. Disk files are written once, in order, and never modified.',
      metrics: { wps: '50,000+', io: 'sequential only', read: '?', crash: 'WAL rebuilds memtable' },
      scene: {
        nodes: [{ ...app, status: 'active' }, { ...wal, badge: 'append' }, { ...memtable, status: 'active', badge: '64 MB: flush' }, s1, s2, { ...s3, status: 'ok', badge: 'just flushed' }],
        links: [...lsmLinks, { from: 'mem', to: 's3', style: 'dashed', label: 'flush' }],
        flows: [
          { path: ['app', 'wal'], tone: 'request', count: 4, duration: 0.8 },
          { path: ['app', 'mem'], tone: 'data', label: 'insert sorted', count: 4, duration: 0.8, delay: 0.5 },
          { path: ['mem', 's3'], tone: 'data', label: 'one sequential write', duration: 1.8, delay: 2 },
        ],
        caption: 'Full memtable becomes an immutable sorted file',
      },
      code: {
        language: 'python',
        title: 'The LSM write and read paths, simplified',
        source: `MEMTABLE_LIMIT = 64 * 1024 * 1024
TOMBSTONE = object()

def put(key, value):
    wal.append(key, value)             # durable
    memtable.insert(key, value)        # sorted in RAM
    if memtable.bytes > MEMTABLE_LIMIT:
        sstables.insert(0, memtable.write_sorted_file())  # newest first
        memtable.clear(); wal.truncate()

def delete(key):
    put(key, TOMBSTONE)                # a delete is just another write

def get(key):
    if key in memtable:
        return memtable[key]
    for table in sstables:             # newest to oldest
        if not table.bloom.might_contain(key):
            continue                   # skip this file without reading it
        value = table.lookup(key)      # binary search via a sparse index
        if value is not None:
            return None if value is TOMBSTONE else value
    return None`,
        highlight: [5, 6, 8, 17, 18, 19],
      },
    },
    {
      title: 'LSM reads',
      tag: 'tradeoff',
      heading: 'The read path pays for the fast writes',
      eli5: 'Finding a book now means checking the tray, then the newest box, then the next one. Each box has a card on the lid that says "definitely not in here" for most books, so she opens very few.',
      body: [
        'A key can live in the memtable or in any SSTable, and newer entries shadow older ones. A lookup checks the memtable, then the files from newest to oldest, and stops at the first match. With many files, one read can touch many places. That is **read amplification**.',
        'Two structures keep it under control. Each SSTable carries a small sparse index, so a search inside one file is a single block read. Each also carries a **Bloom filter**: a compact bit array that answers "this key is certainly absent" or "it might be here". Most files are skipped without touching the disk.',
        'Lookups for keys that do not exist are the worst case, since every level must be ruled out. Range scans must merge results from every file. Both are cheaper in a B-tree, where each key has one home.',
      ],
      keyIdea: 'LSM reads check several sorted files. Bloom filters and sparse indexes make most of those checks free.',
      metrics: { wps: '50,000+', io: 'sequential only', read: 'memtable + up to 3 files', crash: 'WAL rebuilds memtable' },
      scene: {
        nodes: [{ ...app, status: 'active' }, { ...wal, status: 'dim' }, { ...memtable, badge: 'not here' }, { ...s1, status: 'ok', badge: 'found' }, { ...s2, status: 'dim', badge: 'filter: no' }, { ...s3, status: 'dim', badge: 'filter: no' }],
        links: [
          { from: 'app', to: 'mem' },
          { from: 'mem', to: 's3', style: 'faint' },
          { from: 's3', to: 's2', style: 'faint' },
          { from: 's2', to: 's1', style: 'faint' },
        ],
        flows: [
          { path: ['app', 'mem'], tone: 'request', label: 'GET parcel 77', duration: 0.9 },
          { path: ['mem', 's3', 's2', 's1'], tone: 'request', label: 'newest to oldest', duration: 2.2, delay: 1 },
          { path: ['s1', 'mem', 'app'], tone: 'response', label: 'row', duration: 1.6, delay: 3.3 },
        ],
        caption: 'Bloom filters skip two of the three files',
      },
    },
    {
      title: 'Compaction',
      tag: 'concept',
      heading: 'Compaction: merge the files, drop the garbage',
      eli5: 'On quiet evenings the librarian pours several small boxes into one big sorted box. Older copies of a book and books marked "removed" get thrown out on the way.',
      body: [
        'Left alone, SSTables pile up. Reads slow down, and the disk fills with overwritten values and tombstones. **Compaction** is the background job that fixes both: it merge-sorts several SSTables into new ones, keeps only the newest entry for each key, and deletes the inputs.',
        'Because the inputs are already sorted, the merge is a streaming pass with sequential reads and writes. **Leveled** compaction keeps files in levels, each about 10 times larger than the one above, with no overlapping key ranges inside a level. Reads stay cheap, and data gets rewritten more often. **Size-tiered** compaction merges files of similar size. It rewrites less and leaves more files to search.',
        'Compaction is where an LSM tree pays its bill. Each row is rewritten several times as it sinks through the levels, and the job competes with live traffic for disk and CPU. If writes outrun compaction for long, files pile up and the engine has to throttle writers.',
      ],
      keyIdea: 'Compaction turns many small sorted files into few large ones, reclaiming space and keeping reads bounded, at the cost of rewriting data in the background.',
      metrics: { wps: '50,000+', io: 'rewritten ~10x over time', read: '1 to 2 files', crash: 'WAL rebuilds memtable' },
      scene: {
        nodes: [app, { ...wal, status: 'dim' }, memtable, { ...s1, status: 'dim', badge: 'merged' }, { ...s2, status: 'dim', badge: 'merged' }, { ...s3, status: 'dim', badge: 'merged' }, { ...big1, status: 'active', badge: 'newest values only' }, big2],
        links: [
          ...lsmLinks,
          { from: 's1', to: 'big1', style: 'dashed' },
          { from: 's2', to: 'big1', style: 'dashed' },
          { from: 's3', to: 'big1', style: 'dashed' },
          { from: 'big1', to: 'big2', style: 'dashed', label: 'when full' },
        ],
        flows: [
          { path: ['s1', 'big1'], tone: 'data', count: 3, duration: 1.4 },
          { path: ['s2', 'big1'], tone: 'data', count: 3, duration: 1.4 },
          { path: ['s3', 'big1'], tone: 'data', count: 3, duration: 1.4 },
          { path: ['big1', 'big2'], tone: 'data', label: 'next level', duration: 1.6, delay: 2.2 },
        ],
        caption: 'Three small files merge into one sorted run',
      },
    },
    {
      title: 'Amplification',
      tag: 'tradeoff',
      heading: 'Three kinds of amplification, pick two to keep low',
      eli5: 'Shelves make finding quick and adding slow. Boxes make adding quick and finding slower, and some boxes hold old copies for a while. No library gets all three for free.',
      body: [
        '**Write amplification** is bytes written to disk per byte of data the user wrote. A B-tree writes the WAL record plus a whole page for a small change. An LSM tree writes the WAL, the flush, and then rewrites the row in each compaction. Both are well above 1. The LSM tree wins on throughput because all of its writes are sequential and batched.',
        '**Read amplification** is the number of disk reads per lookup. A B-tree needs one or two. An LSM tree may check several files, and Bloom filters hide most of that for point lookups.',
        '**Space amplification** is disk used per byte of live data. B-tree pages sit partly empty after splits. An LSM tree holds stale versions until compaction removes them, though its tightly packed sorted files also compress well. Tuning one of the three down pushes another up.',
      ],
      keyIdea: 'B-trees favor reads and predictable latency. LSM trees favor write throughput and compact storage. Neither is free.',
      metrics: { wps: 'B-tree 10K, LSM 50K+', io: 'random vs sequential', read: 'B-tree 1 to 2, LSM 1 to 5', crash: 'both replay a WAL' },
      scene: {
        zones: [
          { id: 'zb', from: [-1.4, -5.6], to: [0.6, -3.4], label: 'B-tree', tone: 'blue' },
          { id: 'zl', from: [1.2, -3.4], to: [5, 0.5], label: 'LSM tree', tone: 'amber' },
        ],
        nodes: [app, { ...wal, badge: 'both use it' }, { ...mem, label: 'RAM', sub: 'pages or memtable' }, { ...root, label: 'B-tree pages', sub: 'edit in place', badge: 'fast reads' }, { ...big1, label: 'SSTables', sub: 'append and merge', badge: 'fast writes' }],
        links: [
          { from: 'app', to: 'wal' },
          { from: 'app', to: 'mem' },
          { from: 'mem', to: 'root', style: 'dashed' },
          { from: 'mem', to: 'big1', style: 'dashed' },
        ],
        flows: [
          { path: ['app', 'wal'], tone: 'request', duration: 0.9 },
          { path: ['app', 'mem'], tone: 'data', duration: 0.9, delay: 0.4 },
          { path: ['mem', 'root'], tone: 'data', label: 'scattered pages', duration: 1.6, delay: 1.5 },
          { path: ['mem', 'big1'], tone: 'data', label: 'one sorted file', count: 4, duration: 1.6, delay: 1.5 },
        ],
        caption: 'Same log in front, two layouts behind',
      },
    },
    {
      title: 'Who uses what',
      tag: 'case',
      heading: 'Which databases chose which engine',
      eli5: 'A library where people mostly look things up builds shelves. A sorting depot that receives truckloads all day uses boxes. You can tell which one a place is by what it does most.',
      body: [
        '**B-tree engines**: PostgreSQL, MySQL (InnoDB), SQLite, SQL Server and Oracle. These are general-purpose relational databases, where reads, range scans and steady latency matter most. MongoDB\'s default engine, WiredTiger, also stores data in B-trees.',
        '**LSM engines**: LevelDB and RocksDB (embeddable libraries), Cassandra, ScyllaDB and HBase. This is why wide-column stores take writes so fast. Several distributed SQL databases, CockroachDB and TiDB among them, put a SQL layer on top of an LSM key-value store.',
        'Both families use a write-ahead log. The log is also the stream that replication ships to followers, which is why it showed up in the replication lesson. Choose by workload: mostly reads and ad hoc queries point to a B-tree, and sustained heavy ingest (events, metrics, messages, time series) points to an LSM tree.',
      ],
      keyIdea: 'Relational databases mostly sit on B-trees. Write-heavy and wide-column stores mostly sit on LSM trees. Everyone keeps a WAL.',
      metrics: { wps: 'by workload', io: 'by engine', read: 'by engine', crash: 'both replay a WAL' },
      scene: {
        nodes: [
          { ...app, sub: 'which engine?' },
          { ...wal, badge: 'in both' },
          { ...mem, status: 'dim', label: 'RAM' , sub: 'pages or memtable' },
          { ...root, label: 'B-tree', sub: 'Postgres, InnoDB, SQLite', status: 'ok', badge: 'read-heavy' },
          { ...big1, at: [3.5, -1], label: 'LSM tree', sub: 'RocksDB, Cassandra, HBase', status: 'ok', badge: 'write-heavy' },
        ],
        links: [
          { from: 'app', to: 'wal' },
          { from: 'app', to: 'mem' },
          { from: 'mem', to: 'root' },
          { from: 'mem', to: 'big1' },
        ],
        flows: [
          { path: ['app', 'mem', 'root'], tone: 'request', label: 'lookups, scans', duration: 2 },
          { path: ['app', 'mem', 'big1'], tone: 'data', label: 'ingest', count: 5, duration: 2, delay: 0.6 },
        ],
        caption: 'Pick the engine that matches what you do most',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Log first, then choose your layout',
      eli5: 'Write it in the notebook first, always. Then either put each book on its one right shelf, or drop it on the tray and tidy the boxes later.',
      body: [
        'A **write-ahead log** makes a write durable with one sequential append, and crash recovery replays it from the last checkpoint. That took the parcel store from 5,000 safe writes per second to 50,000.',
        'A **B-tree** keeps sorted fixed-size pages and edits them in place: one home per key, one or two reads per lookup, scattered page writes. An **LSM tree** buffers writes in a memtable, flushes immutable SSTables and merges them with compaction: sequential writes only, with more places to check on a read and background work to pay for.',
      ],
      keyIdea: 'Every engine trades read, write and space amplification. Know your read to write ratio before you pick a database.',
      metrics: { wps: '50,000+', io: 'sequential', read: '1 to 2 files', crash: '0 acked writes lost' },
      scene: {
        nodes: [app, { ...wal, status: 'ok' }, { ...memtable, status: 'ok' }, s1, s2, s3, { ...big1, status: 'ok' }, big2],
        links: [...lsmLinks, { from: 'mem', to: 's3', style: 'dashed' }, { from: 's2', to: 'big1', style: 'dashed' }, { from: 'big1', to: 'big2', style: 'dashed' }],
        flows: [
          { path: ['app', 'wal'], tone: 'request', count: 3, duration: 0.9 },
          { path: ['app', 'mem'], tone: 'data', count: 3, duration: 0.9, delay: 0.4 },
          { path: ['mem', 's3'], tone: 'data', duration: 1.4, delay: 1.5 },
          { path: ['s2', 'big1', 'big2'], tone: 'data', duration: 2, delay: 3 },
        ],
      },
      quiz: {
        question: 'A service ingests 80,000 sensor readings per second and reads them back rarely, mostly by recent time range. Which engine fits, and what is the cost?',
        options: [
          'B-tree, because in-place updates make inserts sequential',
          'LSM tree, at the cost of background compaction and reads that may check several files',
          'B-tree, because it has no write-ahead log to slow writes down',
          'LSM tree, and there is no cost because SSTables are never rewritten',
        ],
        answer: 1,
        explain: 'Heavy sustained writes suit an LSM tree: each write is a log append plus a memtable insert. The bill arrives as compaction I/O and read amplification. B-trees also use a WAL, and their random inserts touch scattered pages.',
      },
    },
  ],
};
