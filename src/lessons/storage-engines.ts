import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

// Write-ahead log stage
const app: SceneNode = { id: 'app', kind: 'server', at: at(-5.5, -1), label: 'tracking API', sub: '50K scans/s' };
const wal: SceneNode = { id: 'wal', kind: 'block', at: at(0, -4), label: 'WAL', sub: 'append-only file', icon: 'FileText', tint: 'amber' };
const mem: SceneNode = { id: 'mem', kind: 'cache', at: at(0, 1.5), label: 'RAM table', sub: 'in memory' };
const file: SceneNode = { id: 'file', kind: 'storage', at: at(5.5, -1), label: 'data file', sub: 'on disk' };

// B-tree stage
const bApp: SceneNode = { ...app, at: at(-6.5, -5.5) };
const pool: SceneNode = { ...mem, at: at(-6.5, 1), label: 'buffer pool', sub: 'pages cached in RAM' };
const bWal: SceneNode = { ...wal, at: at(-3, -6.5) };
const root: SceneNode = { id: 'root', kind: 'storage', tint: 'blue', at: at(0, -5.5), label: 'root page', sub: 'key ranges' };
const leafA: SceneNode = { id: 'leafA', kind: 'storage', tint: 'blue', at: at(-3.5, 1.5), label: 'leaf A', sub: 'keys 1 to 80' };
const leafB: SceneNode = { id: 'leafB', kind: 'storage', tint: 'blue', at: at(0, 1.5), label: 'leaf B', sub: 'keys 81 to 160' };
const leafC: SceneNode = { id: 'leafC', kind: 'storage', tint: 'blue', at: at(3.5, 1.5), label: 'leaf C', sub: 'keys 161 to 240' };

// LSM stage
const lApp: SceneNode = { ...app, at: at(-6.5, -3) };
const lWal: SceneNode = { ...wal, at: at(-3.5, -6.5) };
const memtable: SceneNode = { ...mem, at: at(0, -5.5), label: 'memtable', sub: 'sorted, 64 MB' };
const s3: SceneNode = { id: 's3', kind: 'storage', tint: 'amber', at: at(-3.5, 1.5), label: 'SSTable 3', sub: 'newest' };
const s2: SceneNode = { id: 's2', kind: 'storage', tint: 'amber', at: at(0, 1.5), label: 'SSTable 2' };
const s1: SceneNode = { id: 's1', kind: 'storage', tint: 'amber', at: at(3.5, 1.5), label: 'SSTable 1', sub: 'oldest' };
const l1: SceneNode = { id: 'l1', kind: 'storage', tint: 'green', at: at(0.5, 8.5), label: 'level 1', sub: 'merged, sorted' };
const l2: SceneNode = { id: 'l2', kind: 'storage', tint: 'green', at: at(5, 8.5), label: 'level 2', sub: '10x larger' };

export const storageEngines: Lesson = {
  id: 'storage-engines',
  title: 'Storage engines: B-tree, LSM tree, WAL',
  tagline: 'What a database does between "INSERT" and the disk, and why some engines absorb heavy write loads more easily than others.',
  minutes: 18,
  level: 'Intermediate',
  learn: [
    'How a write-ahead log makes a write durable, and how group commit keeps it cheap',
    'How crash recovery replays the log from a checkpoint, and why checksums matter',
    'B-tree pages, depth, range scans, in-place updates, torn pages and page splits',
    'The LSM write path: memtable, SSTables, tombstones and Bloom filters',
    'Compaction, leveled and size-tiered, and what it costs',
    'Read, write and space amplification, and which databases chose which',
  ],
  metrics: [
    { key: 'wps', label: 'Writes/s', icon: 'Zap' },
    { key: 'io', label: 'Disk work per write', icon: 'HardDrive' },
    { key: 'read', label: 'Lookup cost', icon: 'Search' },
    { key: 'crash', label: 'After a crash', icon: 'Shield' },
  ],
  steps: [
    {
      title: 'Fast and lossy',
      tag: 'problem',
      heading: 'Keep every row in RAM and lose it all',
      eli5: 'The library gets 50 new books a minute. If the librarian only remembers them in her head, she is quick. Then she naps, and ten minutes of books vanish.',
      body: [
        'A parcel company records every barcode scan: **50,000 writes per second**. Version one keeps the rows in a table in RAM and saves the whole table to a file every 10 minutes. It is fast.',
        'Then a power cut hits. Up to 10 minutes of scans, about 30 million rows, are gone.',
      ],
      keyIdea: 'RAM is fast and forgets. Anything that was only in RAM when the power fails is lost.',
      metrics: { wps: '50,000', io: 'none until snapshot', read: 'from RAM', crash: '30M rows lost' },
      metricTones: { wps: 'good', crash: 'bad' },
      scene: {
        nodes: [{ ...app, status: 'active', chips: ['scan #881'] }, { ...mem, badge: 'every row lives here' }, { ...file, status: 'dim', badge: 'saved 10 min ago' }],
        links: [link('app', 'mem'), link('mem', 'file', { style: 'dashed', label: 'snapshot every 10 min' })],
        flows: [
          { path: ['app', 'mem'], tone: 'request', label: 'scan #881', count: 5, duration: 1 },
          { path: ['mem', 'file'], tone: 'data', label: 'whole table', duration: 2.4, delay: 1.2 },
        ],
        panel: {
          title: 'Version one: RAM table',
          icon: 'Zap',
          rows: [
            { text: 'Writes per second', value: '50,000', tone: 'good' },
            { text: 'Snapshot interval', value: '10 min' },
            { text: 'Lost in a power cut', value: 'up to 30M rows', tone: 'bad' },
          ],
        },
        caption: 'Fast, until the power goes',
      },
    },
    {
      title: 'Safe but slow',
      tag: 'problem',
      heading: 'Sync every write to disk and crawl',
      eli5: 'Now the librarian walks to the right shelf for every single book and files it before saying thanks. Nothing is lost, but a queue forms at the desk.',
      body: [
        'Version two edits the data file for every write and calls `fsync` to force it onto the device before answering. Nothing is lost now.',
        'But each row lands at a different spot in a large file. Small synced writes at scattered positions are the slowest thing a disk does, and throughput falls to about **5,000 per second**.',
      ],
      keyIdea: 'Disk remembers, but scattered synced writes are what it does worst.',
      metrics: { wps: '5,000 (need 50K)', io: '1 scattered sync', read: '-', crash: 'safe, but too slow' },
      metricTones: { wps: 'bad', crash: 'good' },
      scene: {
        nodes: [{ ...app, status: 'hot', load: 95, chips: [{ text: 'scan #881', tone: 'warn' }, { text: 'scan #882', tone: 'warn' }], badge: 'queueing' }, { ...mem, status: 'dim' }, { ...file, status: 'hot', badge: 'seek, write, fsync' }],
        links: [link('app', 'mem'), link('mem', 'file', { label: 'one scattered sync per row', labelTone: 'warn' })],
        flows: [
          { path: ['app', 'mem'], tone: 'request', label: 'scan #881', duration: 0.9 },
          { path: ['mem', 'file'], tone: 'data', label: 'seek, write, sync', duration: 2.6, delay: 1 },
          { path: ['file', 'mem', 'app'], tone: 'response', label: 'ok', duration: 1.4, delay: 3.7 },
        ],
        panel: {
          title: 'Version two: sync per row',
          icon: 'HardDrive',
          rows: [
            { text: 'Writes per second', value: '5,000', tone: 'bad' },
            { text: 'Disk work per write', value: '1 random sync', tone: 'warn' },
            { text: 'Lost in a power cut', value: '0 rows', tone: 'good' },
          ],
          footer: { text: '10x short of the 50,000 target', tone: 'bad' },
        },
        caption: 'Every write waits for a scattered disk update',
      },
    },
    {
      title: 'The engine',
      tag: 'concept',
      heading: 'The storage engine decides the layout on disk',
      eli5: 'The library has a front desk that takes questions and a back room that decides how books are stored. The back room is the **storage engine**.',
      body: [
        'A **storage engine** is the part of a database that decides what goes to disk, in what layout, and in what order. The SQL layer above it only asks it to read and write rows.',
        'Two designs dominate: the **B-tree** and the **LSM tree**. Both lean on the same trick first, a log.',
      ],
      keyIdea: 'The engine sits under the query layer and owns the disk layout. That layout decides how fast writes and reads are.',
      metrics: { wps: '-', io: 'decided by the engine', read: 'decided by the engine', crash: '-' },
      scene: {
        nodes: [
          { ...app, at: at(-6.5, -1) },
          { id: 'query', kind: 'block', icon: 'Code', tint: 'violet', at: at(-2.2, -1), label: 'query layer', sub: 'parses SQL' },
          { id: 'engine', kind: 'block', icon: 'Database', tint: 'teal', at: at(2.2, -1), label: 'storage engine', sub: 'layout and order' },
          { ...file, at: at(6.5, -1) },
        ],
        links: [link('app', 'query'), link('query', 'engine'), link('engine', 'file')],
        flows: [
          { path: ['app', 'query', 'engine', 'file'], tone: 'request', label: 'INSERT scan', duration: 3 },
        ],
        panel: {
          title: 'Two designs, one trick',
          icon: 'Layers',
          rows: [
            { text: 'B-tree', value: 'sorted pages, edited in place' },
            { text: 'LSM tree', value: 'sorted files, written once' },
            { text: 'Both start with', value: 'a write-ahead log', tone: 'good' },
          ],
        },
        caption: 'The engine turns rows into bytes on disk',
      },
    },
    {
      title: 'The WAL',
      tag: 'concept',
      heading: 'Write-ahead log: append first, organize later',
      eli5: 'The librarian keeps a notebook on the desk, the **WAL**. Every new book gets one line at the bottom of the page before anything else happens. One more line is quick, and the notebook survives a nap.',
      body: [
        'Appending to the end of one file is the cheapest durable write there is. The disk never jumps around.',
        'So the engine appends a small record to the **write-ahead log** (WAL) and syncs it. Now the write is durable and the client gets its answer. Then it changes the table in RAM. The data file catches up later.',
        'The record reaches disk **ahead** of the data it describes. Syncing every append is still the limit, about 1,000 to 5,000 writes per second. Group commit, next, fixes that.',
      ],
      keyIdea: 'A write is durable the moment its log record is synced. The data file can catch up later.',
      metrics: { wps: '1,000 to 5,000', io: '1 sequential append + sync', read: 'from RAM', crash: 'log has everything' },
      metricTones: { wps: 'warn', io: 'good', crash: 'good' },
      scene: {
        nodes: [{ ...app, status: 'active', chips: ['scan #881'] }, { ...wal, status: 'active', badge: 'append + sync' }, { ...mem, badge: 'updated second' }, { ...file, status: 'dim', badge: 'updated later' }],
        links: [link('app', 'wal'), link('app', 'mem'), link('mem', 'file', { style: 'dashed', label: 'background' })],
        flows: [
          { path: ['app', 'wal'], tone: 'request', label: 'log record', count: 4, duration: 0.9 },
          { path: ['wal', 'app'], tone: 'handshake', label: 'synced', duration: 0.9, delay: 1 },
          { path: ['app', 'mem'], tone: 'data', label: 'apply', duration: 0.9, delay: 2 },
          { path: ['mem', 'file'], tone: 'data', duration: 2, delay: 3.2 },
        ],
        panel: {
          title: 'Order of a write',
          icon: 'List',
          rows: [
            { text: '1. Append to the WAL and sync', tone: 'good' },
            { text: '2. Change the table in RAM' },
            { text: '3. Reply ok to the client' },
            { text: '4. Update the data file later', tone: 'muted' },
          ],
        },
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
      title: 'Group commit',
      tag: 'concept',
      heading: 'Many commits share one sync',
      eli5: 'The librarian does not shout "done" after every line. She writes a handful of lines, then rings the bell once for all of them.',
      body: [
        'The sync is the slow part of an append, about 0.2 to 1 ms on an SSD. One sync per write caps the log at roughly 1,000 to 5,000 writes per second. (The 5,000 in step 2 was for scattered syncs.)',
        '**Group commit** lets writes that arrive together share one sync. The engine appends 100 records, syncs once, and acknowledges all 100. So 50,000 writes per second cost only a few hundred syncs.',
      ],
      keyIdea: 'The log is cheap because the engine batches the expensive part: one sync covers many commits.',
      metrics: { wps: '50,000', io: '~500 syncs per second', read: 'from RAM', crash: 'log has everything' },
      metricTones: { wps: 'good', io: 'good' },
      scene: {
        nodes: [{ ...app, status: 'active', chips: ['scan #881', 'scan #882', 'scan #883'] }, { ...wal, status: 'active', badge: '1 sync for 100 records' }, { ...mem, status: 'dim' }],
        links: [link('app', 'wal', { label: '100 records per batch' }), link('app', 'mem')],
        flows: [
          { path: ['app', 'wal'], tone: 'request', label: '100 records', count: 5, duration: 1 },
          { path: ['wal', 'app'], tone: 'handshake', label: 'one sync, 100 acks', duration: 1, delay: 1.2 },
        ],
        panel: {
          title: 'Syncs per second at 50,000 writes',
          icon: 'Timer',
          rows: [
            { text: 'One sync per write', value: '50,000', tone: 'bad' },
            { text: 'Group of 100', value: '500', tone: 'good' },
          ],
          footer: { text: 'A sync takes about 0.2 to 1 ms on an SSD', tone: 'muted' },
        },
        caption: 'One sync, many acknowledgments',
      },
    },
    {
      title: 'Crash recovery',
      tag: 'case',
      heading: 'Case: the power fails mid-afternoon',
      eli5: 'The librarian dozes off and forgets what was on her desk. When she wakes, she reads the notebook and redoes each line. Nothing she promised a reader is missing.',
      body: [
        'The machine loses power. Everything in RAM is gone, including changes that never reached the data file.',
        'On restart the engine opens the WAL and **replays** it: every record is applied again, in order, until memory and the data file match what clients were told.',
      ],
      keyIdea: 'Recovery is replay: apply the log forward. Acknowledged writes always come back.',
      metrics: { wps: '0 (recovering)', io: 'replay', read: '-', crash: '0 acked writes lost' },
      metricTones: { wps: 'bad', crash: 'good' },
      scene: {
        nodes: [{ ...app, status: 'dim', badge: 'waiting' }, { ...wal, status: 'ok', badge: 'replay' }, { ...mem, status: 'down', badge: 'wiped' }, { ...file, status: 'active', badge: 'catching up' }],
        links: [link('wal', 'mem'), link('mem', 'file')],
        flows: [
          { path: ['wal', 'mem'], tone: 'data', label: 'redo records', count: 5, duration: 1.4 },
          { path: ['mem', 'file'], tone: 'data', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'On restart',
          icon: 'Repeat',
          rows: [
            { text: 'RAM table', value: 'empty', tone: 'bad' },
            { text: 'WAL records on disk', value: 'all intact', tone: 'good' },
            { text: 'Replay in order', value: 'RAM rebuilt', tone: 'good' },
          ],
        },
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
      title: 'Checkpoints',
      tag: 'concept',
      heading: 'Checkpoints keep the replay short',
      eli5: 'Reading the whole notebook from the first page of the year would take forever. So the librarian puts a bookmark after every shelf she has fully tidied, and starts reading from the bookmark.',
      body: [
        'Replaying a log from the beginning of time would take hours. So the engine takes **checkpoints**. A checkpoint flushes changed data to the data file and notes the log position it covers.',
        'Recovery starts at the last checkpoint, and older log segments can be deleted. That bounds both recovery time and the disk the log uses.',
      ],
      keyIdea: 'A checkpoint says everything before this log position is safely in the data file. Recovery replays only what comes after.',
      metrics: { wps: '50,000', io: 'WAL + periodic flush', read: 'from RAM', crash: 'replay since checkpoint' },
      scene: {
        nodes: [{ ...wal, badge: 'segments 1 to 9' }, { ...mem, status: 'active', badge: 'flush dirty data' }, { ...file, status: 'ok', badge: 'up to date to #9' }],
        links: [link('wal', 'mem'), link('mem', 'file', { label: 'checkpoint' })],
        flows: [
          { path: ['mem', 'file'], tone: 'data', label: 'flush', count: 4, duration: 1.6 },
          { path: ['file', 'wal'], tone: 'handshake', label: 'covers up to #9', duration: 1.6, delay: 1.8 },
        ],
        panel: {
          title: 'Recovery after a crash',
          icon: 'Clock',
          rows: [
            { text: 'Segments 1 to 9', value: 'covered, deletable', tone: 'muted' },
            { text: 'Checkpoint mark', value: 'segment 9', tone: 'good' },
            { text: 'Segments 10 to 12', value: 'replay these', tone: 'warn' },
          ],
          footer: { text: 'Minutes of replay instead of hours', tone: 'good' },
        },
        caption: 'The checkpoint is the bookmark',
      },
    },
    {
      title: 'Torn records',
      tag: 'concept',
      heading: 'A half-written record is ignored',
      eli5: 'If the librarian fell asleep halfway through writing a line, the last line is a scribble. She skips it, and nobody was told that book was shelved yet.',
      body: [
        'The power can die in the middle of an append. Each record carries a **checksum**. On replay, a record whose checksum does not match is a torn write, and the log is cut off there.',
        'That is safe. The client never got an answer for that record, because the answer only goes out after the sync completes.',
      ],
      keyIdea: 'Checksums let recovery find the exact end of the valid log. Anything after it was never acknowledged.',
      metrics: { wps: '0 (recovering)', io: 'replay', read: '-', crash: '0 acked writes lost' },
      metricTones: { crash: 'good' },
      scene: {
        nodes: [{ ...wal, status: 'active', badge: 'scan the log' }, { ...mem, status: 'active', badge: 'rebuilt up to #4' }],
        links: [link('wal', 'mem')],
        flows: [{ path: ['wal', 'mem'], tone: 'data', label: 'valid records', count: 3, duration: 1.6 }],
        panel: {
          title: 'The tail of the log',
          icon: 'FileText',
          rows: [
            { text: 'record #3  crc ok', value: 'replay', tone: 'good' },
            { text: 'record #4  crc ok', value: 'replay', tone: 'good' },
            { text: 'record #5  crc bad', value: 'stop here', tone: 'bad' },
          ],
          footer: { text: 'Record 5 was never acknowledged', tone: 'muted' },
        },
        caption: 'Replay stops at the first bad checksum',
      },
    },
    {
      title: 'B-tree pages',
      tag: 'concept',
      heading: 'B-tree: sorted pages with signposts',
      eli5: 'The library has shelves in A to Z order, and a sign at the entrance says which aisle holds which letters. To find a book you read the sign, walk to one shelf, and look there.',
      body: [
        'The log makes writes safe, but it is useless for lookups: finding one key means reading all of it. The data file needs a layout that can be searched. The classic one is the **B-tree**.',
        'The file is cut into fixed-size **pages**, commonly 4 to 16 KB. Leaf pages hold rows in key order. Pages above hold only key ranges and pointers to the pages below.',
      ],
      keyIdea: 'A B-tree keeps data sorted in fixed-size pages, with signpost pages above them.',
      metrics: { wps: '-', io: '-', read: '-', crash: 'WAL protects pages' },
      scene: {
        nodes: [{ ...root, status: 'active', badge: 'ranges and pointers' }, leafA, leafB, leafC],
        links: [link('root', 'leafA'), link('root', 'leafB'), link('root', 'leafC')],
        panel: {
          title: 'One page, 8 KB',
          icon: 'Table',
          rows: [
            { text: 'Root page', value: '1-80 A, 81-160 B, 161-240 C' },
            { text: 'Leaf page', value: 'rows in key order', tone: 'good' },
            { text: 'Page size', value: '4 to 16 KB' },
          ],
        },
        caption: 'Signposts above, sorted rows below',
      },
    },
    {
      title: 'B-tree depth',
      tag: 'concept',
      heading: 'A lookup is a few pointer hops',
      eli5: 'To find book 112 you read the sign, walk to the one shelf that holds 81 to 160, and look there. Even a huge library needs only a few signs.',
      body: [
        'A lookup starts at the root and follows one pointer per level. An internal page holds small keys, so it can point to about 400 child pages. A leaf holds fewer rows, about 80 at 100 bytes each.',
        'Three levels reach about 13 million rows and four about 5 billion. The top levels stay cached in RAM, so a lookup usually costs **one or two disk reads**.',
      ],
      keyIdea: 'Any key is three or four page hops from the root, and the top hops are already in RAM.',
      metrics: { wps: '-', io: '-', read: '1 to 2 page reads', crash: 'WAL protects pages' },
      metricTones: { read: 'good' },
      scene: {
        nodes: [{ ...bApp, status: 'active', chips: ['GET 112'] }, { ...root, status: 'active', badge: '112 → leaf B' }, { ...leafB, status: 'ok', badge: 'row 112' }],
        links: [link('app', 'root'), link('root', 'leafB')],
        flows: [
          { path: ['app', 'root'], tone: 'request', label: 'GET 112', duration: 1 },
          { path: ['root', 'leafB'], tone: 'request', label: 'follow pointer', duration: 1.2, delay: 1.1 },
          { path: ['leafB', 'root', 'app'], tone: 'response', label: 'row', duration: 1.6, delay: 2.4 },
        ],
        panel: {
          title: 'Rows reachable: 400 children, 80 per leaf',
          icon: 'Layers',
          rows: [
            { text: '2 levels', value: '32,000' },
            { text: '3 levels', value: '13 million' },
            { text: '4 levels', value: '5 billion', tone: 'good' },
          ],
          footer: { text: 'Root levels stay cached in RAM', tone: 'good' },
        },
        caption: 'One pointer per level, straight to the right leaf',
      },
    },
    {
      title: 'Range scans',
      tag: 'concept',
      heading: 'Sorted leaves make range scans cheap',
      eli5: 'The shelves are in order, so asking for every book from 70 to 170 means finding the first one and then walking along the row.',
      body: [
        'Leaf pages are in key order, and each one points to the next. A query such as keys 70 to 170 finds the first key with one lookup, then walks along the leaves.',
        'Reading neighbors is cheap. This is why `ORDER BY` and `BETWEEN` are fast in relational databases. (Strictly this is the **B+ tree** variant, which nearly every database uses.)',
      ],
      keyIdea: 'Sorted, linked leaves turn a range query into one lookup plus a short walk.',
      metrics: { wps: '-', io: '-', read: '1 lookup + sequential walk', crash: 'WAL protects pages' },
      metricTones: { read: 'good' },
      scene: {
        nodes: [{ ...bApp, status: 'active', chips: ['BETWEEN 70 AND 170'] }, { ...leafA, status: 'ok', badge: 'start: 70' }, { ...leafB, status: 'ok', badge: '81 to 160' }, { ...leafC, status: 'ok', badge: 'stop: 170' }],
        links: [link('leafA', 'leafB', { label: 'next page' }), link('leafB', 'leafC', { label: 'next page' })],
        flows: [
          { path: ['leafA', 'leafB', 'leafC'], tone: 'data', label: 'walk the leaves', count: 3, duration: 2.4 },
        ],
        panel: {
          title: 'Scan keys 70 to 170',
          icon: 'Search',
          rows: [
            { text: 'Find key 70', value: '1 lookup' },
            { text: 'Follow next pointers', value: '2 pages', tone: 'good' },
            { text: 'Stop past 170', value: 'done', tone: 'good' },
          ],
        },
        caption: 'One lookup, then walk the row',
      },
    },
    {
      title: 'In-place updates',
      tag: 'concept',
      heading: 'A B-tree write changes a page where it lies',
      eli5: 'A new book has exactly one right place on the shelves. The librarian notes it in the notebook, then squeezes it into that shelf.',
      body: [
        'To insert key 112, the engine finds leaf B and loads it into the **buffer pool**, its page cache in RAM. It logs the change in the WAL and edits the page in memory. The page is now **dirty**. A background writer later copies it back to its fixed place in the file.',
        'This is an **in-place update**: every key has one home page. Reads love that. Writes pay for it: keys arrive in random order, so dirty pages are scattered, and a 100-byte row change rewrites a whole 8 KB page.',
      ],
      keyIdea: 'B-trees update pages in place: one home per key, great for reads, scattered page writes for random inserts.',
      metrics: { wps: 'bound by random page writes', io: 'WAL + 8 KB page', read: '1 to 2 page reads', crash: 'WAL protects pages' },
      metricTones: { wps: 'warn', io: 'warn' },
      scene: {
        nodes: [{ ...bApp, status: 'active', chips: ['INSERT 112'] }, { ...bWal, badge: 'logged first' }, { ...pool, status: 'active', badge: 'leaf B dirty' }, { ...leafB, status: 'hot', badge: 'rewrite 8 KB' }],
        links: [link('app', 'wal'), link('app', 'mem'), link('mem', 'leafB', { style: 'dashed', label: 'flush page', labelTone: 'warn' })],
        flows: [
          { path: ['app', 'wal'], tone: 'request', label: 'log insert 112', duration: 0.9 },
          { path: ['app', 'mem'], tone: 'data', label: 'edit page', duration: 0.9, delay: 1 },
          { path: ['mem', 'leafB'], tone: 'data', label: 'rewrite 8 KB', duration: 1.8, delay: 2.1 },
        ],
        panel: {
          title: 'Cost and risk of one insert',
          icon: 'HardDrive',
          rows: [
            { text: 'Row changed', value: '100 bytes' },
            { text: 'Page written back', value: '8 KB', tone: 'warn' },
            { text: 'Where it lands', value: 'random spot', tone: 'warn' },
            { text: 'Crash mid-page', value: 'torn page, half old', tone: 'bad' },
            { text: 'Log replay alone', value: 'cannot fix it', tone: 'warn' },
            { text: 'Repair', value: 'full-page image or doublewrite', tone: 'good' },
          ],
          footer: { text: 'Postgres logs page images, InnoDB uses a doublewrite buffer', tone: 'muted' },
        },
        caption: 'A small change rewrites a whole page, and a crash can tear it',
      },
    },
    {
      title: 'Page splits',
      tag: 'tradeoff',
      heading: 'A full page splits in two',
      eli5: 'If a shelf is full, the librarian splits it into two shelves and fixes the sign. Now both shelves have a little room, which is handy later but wastes space.',
      body: [
        'When a leaf is full, it **splits** into two half-full pages and the parent gets a new pointer. Splits keep the tree balanced.',
        'They also leave pages partly empty, commonly a third of the space, and random inserts keep splitting. Increasing ids only fill the right edge, so they split less. A **fill factor** setting leaves room on purpose.',
      ],
      keyIdea: 'Splits keep a B-tree balanced at the price of extra page writes and some empty space.',
      metrics: { wps: 'bound by random page writes', io: 'WAL + 2 pages + parent', read: '1 to 2 page reads', crash: 'WAL protects pages' },
      metricTones: { io: 'warn' },
      scene: {
        nodes: [{ ...root, status: 'active', badge: 'new pointer added' }, { ...leafA, status: 'dim' }, { ...leafB, status: 'hot', badge: 'full: split 112' }, { ...leafC, status: 'ok', at: at(3.5, 1.5), label: 'leaf B2', sub: 'new half', badge: 'half empty' }],
        links: [link('root', 'leafA'), link('root', 'leafB'), link('leafB', 'leafC', { label: 'split', style: 'dashed' })],
        flows: [
          { path: ['leafB', 'leafC'], tone: 'data', label: 'move half the keys', count: 3, duration: 1.6 },
          { path: ['leafC', 'root'], tone: 'event', label: 'new pointer', duration: 1.6, delay: 1.8 },
        ],
        panel: {
          title: 'A split touches',
          icon: 'Split',
          rows: [
            { text: 'Old page', value: 'rewritten', tone: 'warn' },
            { text: 'New page', value: 'written', tone: 'warn' },
            { text: 'Parent page', value: 'gets a pointer' },
            { text: 'Space used per page', value: '~50 to 70%', tone: 'warn' },
          ],
        },
        caption: 'One insert can become three page writes',
      },
      quiz: {
        question: 'A leaf page is full and a new key lands in it. What does a B-tree do?',
        options: [
          'It overwrites the oldest row in that page',
          'It rewrites the whole file in sorted order',
          'It splits the page into two half-full pages and adds a pointer in the parent',
          'It appends the row to the log and leaves the page full',
        ],
        answer: 2,
        explain: 'A split keeps the tree balanced and every leaf at the same depth. The cost is extra page writes and pages that sit partly empty.',
      },
    },
    {
      title: 'LSM memtable',
      tag: 'concept',
      heading: 'LSM tree: never go back and edit',
      eli5: 'A different library skips the shelves at first. New books go on a small sorted tray on the desk, the **memtable**. Nothing is carried to a shelf yet.',
      body: [
        'The **log-structured merge tree** (LSM tree) takes the WAL idea to its end: make every disk write sequential.',
        'A write appends to the WAL and inserts the key into the **memtable**, a sorted structure in RAM. That is the whole write path. No page is read from disk and nothing on disk is edited.',
      ],
      keyIdea: 'An LSM write is one log append plus one in-memory insert.',
      metrics: { wps: '50,000+', io: 'sequential only', read: '?', crash: 'WAL rebuilds memtable' },
      metricTones: { wps: 'good', io: 'good' },
      scene: {
        nodes: [{ ...lApp, status: 'active', chips: ['scan #881', 'scan #882'] }, { ...lWal, badge: 'append' }, { ...memtable, status: 'active', badge: 'insert sorted' }],
        links: [link('app', 'wal'), link('app', 'mem')],
        flows: [
          { path: ['app', 'wal'], tone: 'request', label: 'log record', count: 4, duration: 0.8 },
          { path: ['app', 'mem'], tone: 'data', label: 'insert sorted', count: 4, duration: 0.8, delay: 0.5 },
        ],
        panel: {
          title: 'LSM write path',
          icon: 'Zap',
          rows: [
            { text: 'Append to WAL', value: 'sequential', tone: 'good' },
            { text: 'Insert in memtable', value: 'RAM only', tone: 'good' },
            { text: 'Pages read or edited', value: 'none', tone: 'good' },
          ],
        },
        caption: 'Two cheap steps per write',
      },
      code: {
        language: 'python',
        title: 'The LSM write path',
        source: `def put(key, value):
    wal.append(key, value)             # durable
    memtable.insert(key, value)        # sorted in RAM
    return "ok"`,
        highlight: [2, 3],
      },
    },
    {
      title: 'Flush to SSTable',
      tag: 'concept',
      heading: 'A full memtable becomes an immutable file',
      eli5: 'When the tray is full, the librarian seals everything on it into a labeled box in one go. She never opens a sealed box to change it.',
      body: [
        'When the memtable reaches a size limit (say 64 MB), it is written out in one sequential pass as an **SSTable** (sorted string table): an immutable file of keys in order. A fresh memtable takes over and the matching WAL segment can be dropped.',
        'Each SSTable has a sparse index with one entry per block, so a search inside one file is a binary search and a single block read. The parcel store now absorbs 50,000 writes per second with room to spare.',
      ],
      keyIdea: 'Disk files are written once, in order, and never modified.',
      metrics: { wps: '50,000+', io: 'one big sequential write', read: '?', crash: 'WAL rebuilds memtable' },
      metricTones: { wps: 'good', io: 'good' },
      scene: {
        nodes: [{ ...memtable, status: 'active', badge: '64 MB: flush' }, { ...s2, status: 'dim' }, { ...s3, status: 'ok', badge: 'just flushed' }],
        links: [link('mem', 's3', { style: 'dashed', label: 'flush' })],
        flows: [{ path: ['mem', 's3'], tone: 'data', label: 'one sequential write', count: 4, duration: 2 }],
        panel: {
          title: 'Inside an SSTable',
          icon: 'Layers',
          rows: [
            { text: 'Data blocks', value: 'keys in order, ~4 KB each' },
            { text: 'Sparse index', value: 'first key of each block' },
            { text: 'Bloom filter', value: 'which keys are absent' },
          ],
          footer: { text: 'Never edited after it is written', tone: 'good' },
        },
        caption: 'Full memtable becomes a sorted file',
      },
      code: {
        language: 'python',
        title: 'Flushing the memtable',
        source: `MEMTABLE_LIMIT = 64 * 1024 * 1024

def maybe_flush():
    if memtable.bytes > MEMTABLE_LIMIT:
        sstables.insert(0, memtable.write_sorted_file())  # newest first
        memtable.clear()
        wal.truncate()`,
        highlight: [4, 5, 7],
      },
    },
    {
      title: 'Deletes',
      tag: 'concept',
      heading: 'A delete is a newer entry',
      eli5: 'To remove a book, the librarian adds a card that says "removed" to a newer box. The old card stays in the old box for now.',
      body: [
        'A delete does not remove anything. It writes a marker called a **tombstone** as the newest entry for the key. The old value stays in its file, hidden behind the tombstone.',
        'So a delete frees no space at first. The tombstone must be kept until compaction has merged it with every older copy of that key.',
      ],
      keyIdea: 'An LSM tree never edits in place. A delete is a newer entry that shadows the old one.',
      metrics: { wps: '50,000+', io: 'sequential only', read: '?', crash: 'WAL rebuilds memtable' },
      scene: {
        nodes: [{ ...lApp, status: 'active', chips: ['DELETE parcel 12'] }, { ...memtable, badge: 'parcel 12: tombstone' }, { ...s1, status: 'dim', badge: 'parcel 12: in transit' }],
        links: [link('app', 'mem'), link('mem', 's1', { style: 'faint', label: 'shadows' })],
        flows: [{ path: ['app', 'mem'], tone: 'request', label: 'tombstone', duration: 1.2 }],
        panel: {
          title: 'Parcel 12, several versions',
          icon: 'List',
          rows: [
            { text: 'memtable (newest)', value: 'TOMBSTONE', tone: 'warn' },
            { text: 'SSTable 1 (old)', value: 'in transit', tone: 'muted' },
            { text: 'An update instead', value: 'new entry: delivered' },
          ],
          footer: { text: 'Reads trust the newest entry', tone: 'muted' },
        },
        caption: 'The newest entry wins',
      },
      code: {
        language: 'python',
        title: 'A delete is just another write',
        source: `TOMBSTONE = object()

def delete(key):
    put(key, TOMBSTONE)`,
        highlight: [4],
      },
    },
    {
      title: 'LSM reads',
      tag: 'tradeoff',
      heading: 'The read path pays for the fast writes',
      eli5: 'Finding a book now means checking the tray, then the newest box, then the next one. With many boxes that is a lot of opening.',
      body: [
        'A key can live in the memtable or in any SSTable, and newer entries shadow older ones. A lookup checks the memtable, then the files from newest to oldest, and stops at the first match. That is **read amplification**.',
        'A key that does not exist is the worst case: every file must be ruled out. Range scans must merge results from every file. Both are cheaper in a B-tree, where each key has one home.',
      ],
      keyIdea: 'With many files, one LSM read can touch many places. A key that is missing touches all of them.',
      metrics: { wps: '50,000+', io: 'sequential only', read: 'memtable + 3 files', crash: 'WAL rebuilds memtable' },
      metricTones: { read: 'warn' },
      scene: {
        nodes: [{ ...lApp, status: 'active', chips: ['GET parcel 77'] }, { ...memtable, badge: 'not here' }, { ...s3, status: 'active', badge: 'disk read: no' }, { ...s2, status: 'active', badge: 'disk read: no' }, { ...s1, status: 'ok', badge: 'found' }],
        links: [link('app', 'mem'), link('mem', 's3', { style: 'faint' }), link('s3', 's2', { style: 'faint' }), link('s2', 's1', { style: 'faint' })],
        flows: [
          { path: ['app', 'mem'], tone: 'request', label: 'GET parcel 77', duration: 0.9 },
          { path: ['mem', 's3', 's2', 's1'], tone: 'request', label: 'newest to oldest', duration: 2.4, delay: 1 },
          { path: ['s1', 'mem', 'app'], tone: 'response', label: 'row', duration: 1.6, delay: 3.5 },
        ],
        panel: {
          title: 'Without any shortcut',
          icon: 'Search',
          rows: [
            { text: 'Memtable', value: 'miss' },
            { text: 'SSTable 3 and 2', value: '2 wasted reads', tone: 'warn' },
            { text: 'SSTable 1', value: 'hit', tone: 'good' },
          ],
        },
        caption: 'Three disk reads for one row',
      },
    },
    {
      title: 'Bloom filters',
      tag: 'concept',
      heading: 'Bloom filters skip files that cannot hold the key',
      eli5: 'Each box has a card on the lid that says "definitely not in here" for most books. The librarian reads the lid and opens very few boxes.',
      body: [
        'Each SSTable carries a **Bloom filter**: a compact bit array that answers "certainly absent" or "might be here". It never says absent for a key that is present, so skipping is always safe.',
        'A false "might be here" is rare, about 1% with 10 bits per key, and only costs a wasted read. Most files are skipped without touching the disk, even for keys that do not exist.',
      ],
      keyIdea: 'A Bloom filter has no false negatives. It turns most missed reads into a cheap RAM check.',
      metrics: { wps: '50,000+', io: 'sequential only', read: 'memtable + 1 file', crash: 'WAL rebuilds memtable' },
      metricTones: { read: 'good' },
      scene: {
        nodes: [{ ...lApp, status: 'active', chips: ['GET parcel 77'] }, { ...memtable, badge: 'not here' }, { ...s3, status: 'dim', badge: 'filter: no' }, { ...s2, status: 'dim', badge: 'filter: no' }, { ...s1, status: 'ok', badge: 'filter: maybe, found' }],
        links: [link('app', 'mem'), link('mem', 's3', { style: 'faint' }), link('s3', 's2', { style: 'faint' }), link('s2', 's1', { style: 'faint' })],
        flows: [
          { path: ['app', 'mem'], tone: 'request', label: 'GET parcel 77', duration: 0.9 },
          { path: ['mem', 's3', 's2', 's1'], tone: 'request', label: 'filters skip 2 files', duration: 1.8, delay: 1 },
          { path: ['s1', 'mem', 'app'], tone: 'response', label: 'row', duration: 1.6, delay: 2.9 },
        ],
        panel: {
          title: 'Bloom filter answers',
          icon: 'Shield',
          rows: [
            { text: '"Certainly absent"', value: 'skip the file', tone: 'good' },
            { text: '"Might be here"', value: 'read one block', tone: 'warn' },
            { text: 'False "might be"', value: '~1% at 10 bits/key' },
          ],
        },
        caption: 'Filters skip two of the three files',
      },
      code: {
        language: 'python',
        title: 'get() with a Bloom check',
        source: `def get(key):
    if key in memtable:
        v = memtable[key]
        return None if v is TOMBSTONE else v
    for table in sstables:             # newest to oldest
        if not table.bloom.might_contain(key):
            continue                   # skip this file
        v = table.lookup(key)          # sparse index, one block
        if v is not None:
            return None if v is TOMBSTONE else v
    return None`,
        highlight: [3, 4, 6, 7],
      },
    },
    {
      title: 'Compaction',
      tag: 'concept',
      heading: 'Compaction: merge the files, drop the garbage',
      eli5: 'On quiet evenings the librarian pours several small boxes into one big sorted box. Older copies of a book and books marked "removed" get thrown out on the way.',
      body: [
        'Left alone, SSTables pile up. Reads slow down, and the disk fills with overwritten values and tombstones. **Compaction** merge-sorts several SSTables into a new one, keeps only the newest entry for each key, and deletes the inputs.',
        'The inputs are already sorted, so the merge is a streaming pass with sequential reads and writes. A tombstone is dropped once no older copy remains.',
      ],
      keyIdea: 'Compaction turns many small sorted files into few large ones, reclaiming space and keeping reads bounded.',
      metrics: { wps: '50,000+', io: 'sequential, plus merges', read: '1 to 2 files', crash: 'WAL rebuilds memtable' },
      metricTones: { read: 'good' },
      scene: {
        nodes: [{ ...s3, status: 'dim', badge: 'merged' }, { ...s2, status: 'dim', badge: 'merged' }, { ...s1, status: 'dim', badge: 'merged' }, { ...l1, status: 'active', badge: 'newest values only' }],
        links: [link('s3', 'l1', { style: 'dashed' }), link('s2', 'l1', { style: 'dashed' }), link('s1', 'l1', { style: 'dashed' })],
        flows: [
          { path: ['s3', 'l1'], tone: 'data', count: 3, duration: 1.6 },
          { path: ['s2', 'l1'], tone: 'data', count: 3, duration: 1.6 },
          { path: ['s1', 'l1'], tone: 'data', count: 3, duration: 1.6 },
        ],
        panel: {
          title: 'Before and after',
          icon: 'Layers',
          rows: [
            { text: 'Files', value: '3 → 1', tone: 'good' },
            { text: 'Copies of parcel 77', value: '3 → 1', tone: 'good' },
            { text: 'Parcel 12 and its tombstone', value: 'both dropped', tone: 'good' },
          ],
        },
        caption: 'Three small files merge into one sorted run',
      },
    },
    {
      title: 'Leveled or tiered',
      tag: 'tradeoff',
      heading: 'Two ways to decide what to merge',
      eli5: 'The librarian can keep each shelf of boxes sorted so a book is in only one box per shelf, or she can merge boxes of the same size when she has time. One tidies more, the other tidies less.',
      body: [
        '**Leveled** compaction keeps files in levels, each about 10 times larger than the one above, with no overlapping key ranges inside a level. Reads stay cheap. Data is rewritten more often.',
        '**Size-tiered** compaction merges files of similar size. It rewrites less and leaves more files to search, with temporary space needed for big merges.',
      ],
      keyIdea: 'Leveled favors reads and space. Size-tiered favors write throughput.',
      metrics: { wps: '50,000+', io: 'leveled ~10x rewrite', read: '1 to 2 files', crash: 'WAL rebuilds memtable' },
      scene: {
        nodes: [
          { ...l1, at: at(-4, -3), status: 'active', sub: 'ranges do not overlap', badge: 'full: push down' },
          { ...l2, at: at(1, -3), sub: '10x larger', badge: 'leveled' },
          { id: 't1', kind: 'storage', tint: 'amber', at: at(-5, 3), label: 'file A', sub: 'similar size' },
          { id: 't2', kind: 'storage', tint: 'amber', at: at(-1, 3), label: 'file B', sub: 'similar size' },
          { id: 'tm', kind: 'storage', tint: 'amber', at: at(4, 3), label: 'one big file', sub: 'merged', badge: 'size-tiered', status: 'ok' },
        ],
        links: [link('l1', 'l2', { style: 'dashed', label: 'when full' }), link('t1', 't2', { style: 'faint' }), link('t2', 'tm', { style: 'dashed', label: 'merge alike' })],
        flows: [
          { path: ['l1', 'l2'], tone: 'data', label: 'next level', duration: 1.6 },
          { path: ['t1', 't2', 'tm'], tone: 'data', label: 'merge', count: 3, duration: 2, delay: 1.8 },
        ],
        panel: {
          title: 'Leveled vs size-tiered',
          icon: 'Scale',
          rows: [
            { text: 'Leveled: rewrites', value: 'more', tone: 'warn' },
            { text: 'Leveled: files per read', value: 'few', tone: 'good' },
            { text: 'Tiered: rewrites', value: 'fewer', tone: 'good' },
            { text: 'Tiered: files per read', value: 'more', tone: 'warn' },
          ],
        },
        caption: 'Leveled pushes down, size-tiered merges alike',
      },
      quiz: {
        question: 'Which compaction strategy rewrites data less often, at the price of more files to search on a read?',
        options: [
          'Leveled compaction',
          'Size-tiered compaction',
          'Neither, both rewrite every row the same number of times',
          'Compaction is skipped, so no files are rewritten',
        ],
        answer: 1,
        explain: 'Size-tiered merges files of similar size, so each row is rewritten fewer times. Key ranges overlap across files, which makes reads check more of them. Leveled does the opposite.',
      },
    },
    {
      title: 'Compaction cost',
      tag: 'tradeoff',
      heading: 'Compaction is where an LSM tree pays its bill',
      eli5: 'Tidying the boxes takes the librarian away from the desk. If new books arrive faster than she can tidy, she has to tell people to wait.',
      body: [
        'Each row is rewritten several times as it sinks through the levels, about 10 times with leveled compaction. The job competes with live traffic for disk and CPU.',
        'If writes outrun compaction for long, files pile up and the engine **throttles writers** (a write stall) until compaction catches up. Watch the pending-compaction backlog.',
      ],
      keyIdea: 'Background merging has a real cost: extra disk I/O, latency spikes, and stalls when it falls behind.',
      metrics: { wps: '50,000 → 12,000', io: 'rewritten ~10x', read: 'more files', crash: 'WAL rebuilds memtable' },
      metricTones: { wps: 'bad', io: 'warn', read: 'warn' },
      scene: {
        nodes: [{ ...lApp, status: 'hot', badge: 'writes throttled', chips: [{ text: 'scan #9001', tone: 'warn' }] }, { ...memtable, status: 'hot', badge: 'full, waiting to flush' }, { ...l1, status: 'hot', load: 96, badge: 'compacting' }],
        links: [link('app', 'mem', { label: 'stall', labelTone: 'warn' }), link('mem', 'l1', { style: 'dashed' })],
        flows: [
          { path: ['app', 'mem'], tone: 'request', label: 'slowed down', duration: 2.4 },
          { path: ['mem', 'l1'], tone: 'data', duration: 2, delay: 1 },
        ],
        panel: {
          title: 'Compaction falling behind (example)',
          icon: 'Gauge',
          rows: [
            { text: 'Files waiting to merge', value: '48', tone: 'bad' },
            { text: 'Disk busy with merges', value: '96%', tone: 'bad' },
            { text: 'Writes allowed', value: '12,000 / s', tone: 'warn' },
          ],
          footer: { text: 'Writers are slowed to protect reads', tone: 'warn' },
        },
        caption: 'Merging cannot keep up with ingest',
      },
    },
    {
      title: 'Amplification',
      tag: 'tradeoff',
      heading: 'Three costs, and tuning one raises another',
      eli5: 'Shelves make finding quick and adding slow. Boxes make adding quick and finding slower, and some boxes hold old copies for a while. No library gets all three for free.',
      body: [
        '**Write amplification** is bytes written to disk per byte the user wrote. **Read amplification** is disk reads per lookup. **Space amplification** is disk used per byte of live data.',
        'A B-tree reads little and writes scattered pages. An LSM tree writes sequentially and pays in compaction and extra reads. Its tightly packed files also compress well. Pushing one cost down pushes another up.',
      ],
      keyIdea: 'B-trees favor reads and predictable latency. LSM trees favor write throughput and compact storage. Neither is free.',
      metrics: { wps: 'B-tree scattered, LSM sequential', io: 'random vs sequential', read: 'B-tree 1 to 2, LSM 1 to 5', crash: 'both replay a WAL' },
      scene: {
        zones: [
          { id: 'zb', from: [-3.8, -3], to: [-1.4, -1], label: 'B-tree', tone: 'blue' },
          { id: 'zl', from: [1.2, -3], to: [5, 1], label: 'LSM tree', tone: 'amber' },
        ],
        nodes: [
          { ...bApp, at: at(-6.5, -1) },
          { id: 'btree', kind: 'block', icon: 'Table', tint: 'blue', at: at(-1, -5), label: 'B-tree pages', sub: 'edit in place' },
          { id: 'lsm', kind: 'block', icon: 'Layers', tint: 'amber', at: at(4, -1), label: 'SSTables', sub: 'append and merge' },
        ],
        links: [link('app', 'btree'), link('app', 'lsm')],
        flows: [
          { path: ['app', 'btree'], tone: 'data', label: 'scattered pages', duration: 1.8 },
          { path: ['app', 'lsm'], tone: 'data', label: 'one sorted file', count: 4, duration: 1.8 },
        ],
        panel: {
          title: 'Where each engine pays',
          icon: 'Scale',
          rows: [
            { text: 'Write: B-tree', value: 'WAL + whole page', tone: 'warn' },
            { text: 'Write: LSM', value: 'WAL + flush + merges', tone: 'warn' },
            { text: 'Read: B-tree', value: '1 to 2 reads', tone: 'good' },
            { text: 'Read: LSM', value: '1 to 5 files', tone: 'warn' },
            { text: 'Space: B-tree', value: 'half-empty pages' },
            { text: 'Space: LSM', value: 'stale copies' },
          ],
        },
        caption: 'Same log in front, two layouts behind',
      },
    },
    {
      title: 'Who uses what',
      tag: 'case',
      heading: 'Which databases chose which engine, and how to choose',
      eli5: 'A library where people mostly look things up builds shelves. A sorting depot that receives truckloads all day uses boxes. You can tell which one a place is by what it does most.',
      body: [
        '**B-tree engines**: PostgreSQL, MySQL (InnoDB), SQLite, SQL Server, Oracle and MongoDB\'s WiredTiger. **LSM engines**: LevelDB, RocksDB, Cassandra, ScyllaDB and HBase. CockroachDB and TiDB put a SQL layer on an LSM key-value store.',
        'Both families keep a WAL, and that log is also the stream replication ships to followers. Choose by workload: reads and ad hoc queries point to a B-tree. Sustained heavy ingest (events, metrics, time series) points to an LSM tree.',
      ],
      keyIdea: 'Relational databases mostly sit on B-trees. Write-heavy and wide-column stores mostly sit on LSM trees. Everyone keeps a WAL.',
      metrics: { wps: 'by workload', io: 'by engine', read: 'by engine', crash: 'both replay a WAL' },
      scene: {
        nodes: [
          { ...app, at: at(-6.5, -1), sub: 'which engine?' },
          { id: 'btree', kind: 'block', icon: 'Table', tint: 'blue', at: at(-0.5, -5), label: 'B-tree', sub: 'read-heavy', badge: 'steady latency', status: 'ok' },
          { id: 'lsm', kind: 'block', icon: 'Layers', tint: 'amber', at: at(-0.5, 3), label: 'LSM tree', sub: 'write-heavy', badge: 'fast ingest', status: 'ok' },
          { id: 'wal', kind: 'block', icon: 'FileText', tint: 'gray', at: at(-3.5, -1), label: 'WAL', sub: 'in both', size: 0.7 },
        ],
        links: [link('app', 'wal'), link('wal', 'btree'), link('wal', 'lsm')],
        flows: [
          { path: ['app', 'wal', 'btree'], tone: 'request', label: 'lookups, scans', duration: 2 },
          { path: ['app', 'wal', 'lsm'], tone: 'data', label: 'ingest', count: 5, duration: 2, delay: 0.6 },
        ],
        panel: {
          title: 'Engines in the wild',
          icon: 'Database',
          rows: [
            { text: 'Postgres, InnoDB, SQLite', value: 'B-tree', tone: 'good' },
            { text: 'SQL Server, Oracle, WiredTiger', value: 'B-tree', tone: 'good' },
            { text: 'RocksDB, Cassandra, HBase', value: 'LSM', tone: 'warn' },
            { text: 'ScyllaDB, LevelDB', value: 'LSM', tone: 'warn' },
            { text: 'CockroachDB, TiDB', value: 'SQL on LSM' },
          ],
        },
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
        'A **B-tree** edits sorted pages in place: one or two reads per lookup, scattered page writes. An **LSM tree** buffers writes in a memtable, flushes SSTables and merges them: sequential writes, more places to read, background work to pay for.',
      ],
      keyIdea: 'Every engine trades read, write and space amplification. Know your read to write ratio before you pick a database.',
      metrics: { wps: '50,000+', io: 'sequential', read: '1 to 2 files', crash: '0 acked writes lost' },
      metricTones: { wps: 'good', crash: 'good' },
      scene: {
        nodes: [{ ...lApp, status: 'ok' }, { ...lWal, status: 'ok' }, { ...memtable, status: 'ok' }, { ...s3, status: 'ok' }, { ...l1, status: 'ok' }],
        links: [link('app', 'wal'), link('app', 'mem'), link('mem', 's3', { style: 'dashed' }), link('s3', 'l1', { style: 'dashed' })],
        flows: [
          { path: ['app', 'wal'], tone: 'request', count: 3, duration: 0.9 },
          { path: ['app', 'mem'], tone: 'data', count: 3, duration: 0.9, delay: 0.4 },
          { path: ['mem', 's3'], tone: 'data', duration: 1.4, delay: 1.5 },
          { path: ['s3', 'l1'], tone: 'data', duration: 1.6, delay: 3 },
        ],
        panel: {
          title: 'Remember',
          icon: 'List',
          rows: [
            { text: 'WAL', value: 'durable by one append', tone: 'good' },
            { text: 'B-tree', value: 'reads, ranges, steady latency' },
            { text: 'LSM tree', value: 'writes, compaction bill' },
          ],
        },
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
