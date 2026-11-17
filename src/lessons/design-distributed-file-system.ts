import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

// A diagonal path across the stage, left to right.
const p1 = at(-4.5, -3.2);
const p2 = at(0, 0);
const p3 = at(4.5, 3.2);

const client: SceneNode = { id: 'client', kind: 'client', at: p1, label: 'client', sub: 'data job' };
const master: SceneNode = { id: 'master', kind: 'block', at: at(0, -3.2), label: 'master', sub: 'metadata only', icon: 'Database', tint: 'violet' };
const cs1: SceneNode = { id: 'cs1', kind: 'storage', at: at(-4.4, 3.6), label: 'chunkserver 1', sub: 'rack A' };
const cs2: SceneNode = { id: 'cs2', kind: 'storage', at: at(0, 3.6), label: 'chunkserver 2', sub: 'rack A' };
const cs3: SceneNode = { id: 'cs3', kind: 'storage', at: at(4.4, 3.6), label: 'chunkserver 3', sub: 'rack B' };

export const designDistributedFileSystem: Lesson = {
  id: 'design-distributed-file-system',
  title: 'Design a distributed file system',
  tagline: 'Build a GFS or HDFS style file system for 10 PB of huge files: chunks, one master, replicas, write pipelines and failure handling.',
  minutes: 16,
  level: 'Advanced',
  learn: [
    'Requirements and the workload assumptions that shape the whole design',
    'The API, and the three maps behind it: namespace, file to chunks, chunk to servers',
    'Why one file server breaks, and the split into one master and many chunkservers',
    'Read path, replicas with rack awareness, heartbeats, and the write pipeline with a primary',
    'Record append and its relaxed consistency, checksums, master memory math and the operation log',
    'Master failover, re-replication after server and rack loss, lazy deletion, stale replicas and federation',
  ],
  metrics: [
    { key: 'data', label: 'Data', icon: 'HardDrive' },
    { key: 'servers', label: 'Chunkservers', icon: 'Server' },
    { key: 'tput', label: 'Aggregate read', icon: 'Gauge' },
    { key: 'ram', label: 'Master RAM', icon: 'Cpu' },
    { key: 'copies', label: 'Copies', icon: 'Copy' },
  ],
  steps: [
    {
      title: 'The ask',
      tag: 'problem',
      heading: 'Ten petabytes of giant files on cheap machines',
      eli5: 'A town wants a library with millions of giant encyclopedias. One room and one librarian cannot hold or find them all, and shelves sometimes collapse.',
      body: [
        'A company crawls the web, logs every request and trains models. The data piles up: **10 PB** today, in files of many gigabytes each. Jobs scan whole files from start to end.',
        'No single machine holds it. The fleet is about 1,000 cheap servers with 10,000 disks, so something is always broken. Store the files, find them fast, never lose a byte.',
      ],
      keyIdea: 'A distributed file system presents one big, reliable disk on top of thousands of small, unreliable ones.',
      metrics: { data: '10 PB', servers: '?', tput: '?', ram: '-', copies: '?' },
      scene: {
        nodes: [
          { ...client, sub: 'crawl, logs, ML' },
          { id: 'fs', kind: 'block', at: p2, label: 'file system', sub: 'to design', icon: 'HardDrive', tint: 'gray', status: 'active', badge: '10 PB' },
          { id: 'disks', kind: 'storage', at: p3, label: '10,000 disks', sub: 'cheap servers' },
        ],
        links: [link('client', 'fs'), link('fs', 'disks')],
        flows: [
          { path: ['client', 'fs', 'disks'], tone: 'request', label: 'read 1 TB file', duration: 2 },
          { path: ['disks', 'fs', 'client'], tone: 'data', label: 'stream', count: 3, duration: 2, delay: 2.1 },
        ],
        panel: {
          title: 'Requirements',
          icon: 'List',
          rows: [
            { text: 'Data stored', value: '10 PB' },
            { text: 'File size', value: 'GBs to TBs' },
            { text: 'Machines', value: '~1,000, commodity' },
            { text: 'Disk failures', value: '~1 a day', tone: 'warn' },
            { text: 'Aggregate read rate', value: '100 GB/s', tone: 'good' },
          ],
          footer: { text: 'Failures are routine, not rare', tone: 'warn' },
        },
        caption: 'One namespace over thousands of disks',
      },
    },
    {
      title: 'Workload',
      tag: 'concept',
      heading: 'Design for the workload you really have',
      eli5: 'In this library the books are huge, people read them cover to cover, and new pages only get added at the end. Shelves break all the time, and the librarians expect it.',
      body: [
        'Five assumptions shape everything: **failures are normal**, **files are huge**, **reads are long sequential scans**, **writes mostly append**, and **throughput beats latency**.',
        'Random overwrites and millisecond reads are missing on purpose. Giving them up is what makes petabyte scale affordable.',
      ],
      keyIdea: 'Pick the access pattern first. Dropping random writes and low latency is the trade that buys scale.',
      metrics: { data: '10 PB', servers: '~1,000', tput: '100 GB/s', ram: '-', copies: '?' },
      scene: {
        nodes: [
          { ...client, id: 'writer', label: 'writer', sub: 'log pipeline' },
          { id: 'file', kind: 'block', at: p2, label: 'big file', sub: '40 GB log', icon: 'FileText', tint: 'blue' },
          { id: 'scan', kind: 'worker', at: p3, label: 'scan job', sub: 'reads it all' },
        ],
        links: [link('writer', 'file'), link('file', 'scan')],
        flows: [
          { path: ['writer', 'file'], tone: 'event', label: 'append', count: 2, duration: 1.4 },
          { path: ['file', 'scan'], tone: 'data', label: 'sequential scan', count: 4, duration: 1.8, delay: 1.5 },
        ],
        panel: {
          title: 'Design assumptions',
          icon: 'Table',
          rows: [
            { text: 'Component failures', value: 'the norm' },
            { text: 'Files', value: 'GB and up' },
            { text: 'Reads', value: 'sequential streams' },
            { text: 'Writes', value: 'mostly append' },
            { text: 'Goal', value: 'bandwidth over latency', tone: 'good' },
          ],
        },
        caption: 'Appended once, scanned many times',
      },
    },
    {
      title: 'API',
      tag: 'concept',
      heading: 'A small API with no seek-and-overwrite',
      eli5: 'At the front desk you can ask only a few things: make a new set, find a set, read it, add pages at the end, or throw it out. No scribbling in the middle of old pages.',
      body: [
        'Clients use a library with a short list: `create`, `open`, `read`, `append`, `delete`, `rename` and directory listing. Paths look like `/logs/web-0412`.',
        'The missing calls matter: no cheap random write and no in-place edit. `record_append` lets many writers add to one file safely.',
      ],
      keyIdea: 'The API is small on purpose. Every call you leave out is a guarantee the system no longer has to keep.',
      metrics: { data: '10 PB', servers: '~1,000', tput: '100 GB/s', ram: '-', copies: '?' },
      scene: {
        nodes: [
          client,
          { id: 'api', kind: 'block', at: p2, label: 'client library', sub: 'the API', icon: 'Code', tint: 'violet' },
          { id: 'fs', kind: 'block', at: p3, label: 'file system', sub: 'chunks and copies', icon: 'HardDrive', tint: 'gray' },
        ],
        links: [link('client', 'api'), link('api', 'fs')],
        flows: [
          { path: ['client', 'api', 'fs'], tone: 'request', label: 'append(/logs/web-0412)', duration: 2 },
          { path: ['fs', 'api', 'client'], tone: 'response', label: 'ok', duration: 1.6, delay: 2.1 },
        ],
        panel: {
          title: 'What the API offers',
          icon: 'Braces',
          rows: [
            { text: 'create, open, delete, rename', value: 'yes', tone: 'good' },
            { text: 'read(path, offset, length)', value: 'yes', tone: 'good' },
            { text: 'append, record_append', value: 'yes', tone: 'good' },
            { text: 'overwrite in the middle', value: 'avoid', tone: 'bad' },
            { text: 'hard links, permissions tricks', value: 'no', tone: 'muted' },
          ],
        },
        caption: 'Few verbs, all of them cheap to scale',
      },
      code: {
        language: 'typescript',
        title: 'The client library surface',
        source: `interface DfsClient {
  create(path: string): Promise<FileHandle>;
  open(path: string): Promise<FileHandle>;
  delete(path: string): Promise<void>;
  list(dir: string): Promise<string[]>;
}
interface FileHandle {
  read(offset: number, length: number): Promise<Uint8Array>;
  append(data: Uint8Array): Promise<number>;        // you pick the file end
  recordAppend(data: Uint8Array): Promise<number>;  // system picks the offset
}`,
        highlight: [8, 9, 10],
      },
    },
    {
      title: 'Data model',
      tag: 'concept',
      heading: 'Three maps hold the whole system',
      eli5: 'The **card catalog** says which volumes make up each set and which shelves hold each volume. The shelves hold volumes only. They do not know what set a volume belongs to.',
      body: [
        'The **namespace** maps a path to a file. A file maps to an ordered list of **chunk handles**, each a unique 64-bit id. A handle maps to a version number and to the servers that hold it.',
        'Path to file, file to handles and handle to version are permanent state, saved in the log. Handle to servers is soft state, rebuilt from what servers report, which a later step explains.',
      ],
      keyIdea: 'Names, chunk lists and versions are logged. Locations are soft state that servers re-report.',
      metrics: { data: '10 PB', servers: '~1,000', tput: '100 GB/s', ram: '-', copies: '?' },
      scene: {
        nodes: [
          { id: 'ns', kind: 'block', at: p1, label: 'namespace', sub: 'path to file', icon: 'List', tint: 'blue' },
          { id: 'chunks', kind: 'block', at: p2, label: 'file to chunks', sub: 'ordered handles', icon: 'Table', tint: 'amber' },
          { id: 'where', kind: 'block', at: p3, label: 'chunk to servers', sub: 'soft state', icon: 'Server', tint: 'green' },
        ],
        links: [link('ns', 'chunks'), link('chunks', 'where')],
        flows: [{ path: ['ns', 'chunks', 'where'], tone: 'request', label: '/logs/web-0412', duration: 2.4 }],
        panel: {
          title: 'One file, resolved',
          icon: 'Code',
          code: '/logs/web-0412 -> [h91, h92, h93]   (logged)\nh91 -> v7                           (logged)\nh92 -> v7                           (logged)\nh91 @ cs12, cs40, cs77              (rebuilt from reports)\nh92 @ cs03, cs40, cs91              (rebuilt from reports)',
          footer: { text: 'Versions are persistent, locations are soft state', tone: 'muted' },
        },
        caption: 'Name, then chunk list, then locations',
      },
    },
    {
      title: 'Three walls',
      tag: 'tradeoff',
      heading: 'Where it breaks: space, speed and one lost disk',
      eli5: 'At first the library is one room with one librarian. Now the one shelf is full, the one librarian is swamped, and if the shelf collapses every book on it is gone. All three problems arrive together.',
      body: [
        'One file server in front of a disk array is the right start for a few terabytes. Past that, **space**: 10 PB needs about 500 such machines. **Speed**: assume one machine is capped near 1 GB/s by its network card, so scanning one 1 TB file takes about **17 minutes**, and 100 GB/s would need 100 such machines. **Safety**: one dead disk loses every file on it.',
        'All three have the same cure. Cut files into pieces, spread the pieces over many machines, and keep extra copies.',
      ],
      keyIdea: 'Size, throughput and durability each outgrow one machine, and one design change fixes all three.',
      metrics: { data: '20 TB (full)', servers: '1', tput: '~1 GB/s', ram: '-', copies: '1' },
      metricTones: { data: 'bad', tput: 'bad', copies: 'bad' },
      scene: {
        nodes: [
          client,
          { id: 'server', kind: 'server', at: p2, label: 'file server', sub: 'NIC at 1 GB/s', status: 'hot', load: 97 },
          { id: 'disk', kind: 'storage', at: p3, label: 'disk array', sub: '20 TB', status: 'down', badge: 'full, then dead' },
        ],
        links: [link('client', 'server', { label: '1 TB scan', labelTone: 'warn' }), link('server', 'disk')],
        flows: [{ path: ['client', 'server'], tone: 'error', label: 'waiting...', duration: 2.4 }],
        panel: {
          title: 'The arithmetic',
          icon: 'Timer',
          rows: [
            { text: '10 PB / 20 TB per machine', value: '500 machines', tone: 'bad' },
            { text: '1 TB / 1 GB/s (NIC cap)', value: '~17 min', tone: 'bad' },
            { text: '100 GB/s / 1 GB/s', value: '100 machines', tone: 'bad' },
            { text: 'One disk dies', value: 'files gone', tone: 'bad' },
          ],
          footer: { text: 'Split, spread and copy', tone: 'warn' },
        },
        caption: 'Three limits, one machine',
      },
    },
    {
      title: 'Chunks',
      tag: 'concept',
      heading: 'Cut every file into 64 MB chunks',
      eli5: 'Each giant set is split into **chunks**, like volumes. The volumes go on different shelves, so many readers can carry different volumes at the same time.',
      body: [
        'A 1 TB file becomes about **16,000 chunks** of 64 MB (HDFS uses 128 MB). Each chunk lives on a different server, so one scan reads from many disks at once.',
        'Big chunks keep the bookkeeping small and make each read long enough to hide the disk seek. The price: a 1 KB file still costs a catalog entry.',
      ],
      keyIdea: 'Large fixed-size chunks turn one slow disk into many fast ones, and keep the metadata count small.',
      metrics: { data: '10 PB', servers: '~1,000', tput: '100 GB/s', ram: '-', copies: '1' },
      metricTones: { tput: 'good', servers: 'good' },
      scene: {
        nodes: [
          { id: 'bigfile', kind: 'block', at: at(0, -3.2), label: 'big file', sub: '1 TB', icon: 'FileText', tint: 'blue' },
          { ...cs1, sub: 'chunks 1, 4', chips: ['chunk 1', 'chunk 4'] },
          { ...cs2, sub: 'chunks 2, 5', chips: ['chunk 2', 'chunk 5'] },
          { ...cs3, sub: 'chunks 3, 6', chips: ['chunk 3', 'chunk 6'] },
        ],
        links: [link('bigfile', 'cs1'), link('bigfile', 'cs2'), link('bigfile', 'cs3')],
        flows: [
          { path: ['bigfile', 'cs1'], tone: 'data', label: '64 MB', duration: 1.6 },
          { path: ['bigfile', 'cs2'], tone: 'data', label: '64 MB', duration: 1.6, delay: 0.3 },
          { path: ['bigfile', 'cs3'], tone: 'data', label: '64 MB', duration: 1.6, delay: 0.6 },
        ],
        panel: {
          title: 'Chunk math',
          icon: 'Table',
          rows: [
            { text: 'Chunk size', value: '64 MB (GFS)' },
            { text: 'HDFS block size', value: '128 MB' },
            { text: '1 TB file', value: '~16,000 chunks' },
            { text: 'Read from', value: 'many disks at once', tone: 'good' },
          ],
        },
        caption: 'One file, spread over many servers',
      },
    },
    {
      title: 'The master',
      tag: 'concept',
      heading: 'One master for names, many servers for bytes',
      eli5: 'One **librarian** keeps only the card catalog and tells readers which shelf to visit. Readers then fetch the volumes themselves, so the librarian never carries a book.',
      body: [
        'Split the job. A single **master** keeps all metadata: the namespace and the chunk maps. **Chunkservers** store chunks as plain local files and know nothing about file names.',
        'The master never carries file data, so it stays small and quick. Bytes move directly between clients and chunkservers.',
      ],
      keyIdea: 'Separate the control plane (one small master) from the data plane (thousands of chunkservers).',
      metrics: { data: '10 PB', servers: '~1,000', tput: '100 GB/s', ram: 'small', copies: '1' },
      scene: {
        nodes: [client, master, { ...cs1, sub: 'holds chunks' }, { ...cs2, sub: 'holds chunks' }],
        links: [link('client', 'master'), link('client', 'cs1'), link('client', 'cs2')],
        flows: [
          { path: ['client', 'master'], tone: 'request', label: 'where is it?', duration: 1.2 },
          { path: ['master', 'client'], tone: 'response', label: 'cs1', duration: 1.2, delay: 1.3 },
          { path: ['client', 'cs1'], tone: 'request', label: 'read', duration: 1.2, delay: 2.6 },
          { path: ['cs1', 'client'], tone: 'data', label: 'bytes', count: 3, duration: 1.4, delay: 3.9 },
        ],
        panel: {
          title: 'Who holds what',
          icon: 'Layers',
          rows: [
            { text: 'Master', value: 'names + chunk maps' },
            { text: 'Chunkserver', value: 'chunk bytes only' },
            { text: 'Client', value: 'talks to both' },
          ],
          footer: { text: 'Metadata is tiny, data is huge', tone: 'good' },
        },
        caption: 'Control path and data path are separate',
      },
    },
    {
      title: 'Copies',
      tag: 'concept',
      heading: 'Three copies, placed across racks',
      eli5: 'Every volume gets three copies on different shelves, in two buildings. If one building floods, the other still has a copy.',
      body: [
        'Every chunk is stored **3 times** by default. The master places them rack-aware: two copies on different machines in one rack, the third in another rack.',
        'Two copies share cheap in-rack bandwidth, and the third survives losing a whole rack. The replication lesson covers the general trade.',
        'The raw capacity is 10 PB x 3 copies = **30 PB**, which spread over 1,000 servers is **30 TB per server**.',
      ],
      keyIdea: 'Replicas must sit in different failure domains. A copy on the same rack as the first is only half protection.',
      metrics: { data: '10 PB', servers: '~1,000', tput: '100 GB/s', ram: 'small', copies: '3' },
      metricTones: { copies: 'good' },
      scene: {
        nodes: [
          { id: 'chunk', kind: 'block', at: at(0, -3.2), label: 'chunk h91', sub: '64 MB', icon: 'Package', tint: 'amber' },
          { ...cs1, status: 'ok', chips: ['h91'] },
          { ...cs2, status: 'ok', chips: ['h91'] },
          { ...cs3, status: 'ok', chips: ['h91'] },
        ],
        links: [link('chunk', 'cs1'), link('chunk', 'cs2'), link('chunk', 'cs3')],
        zones: [
          { id: 'rackA', from: [-1.6, 0.6], to: [2.8, 5.2], label: 'rack A', tone: 'blue' },
          { id: 'rackB', from: [3.0, -1.6], to: [5.2, 1.0], label: 'rack B', tone: 'green' },
        ],
        flows: [
          { path: ['chunk', 'cs1'], tone: 'data', label: 'copy 1', duration: 1.4 },
          { path: ['chunk', 'cs2'], tone: 'data', label: 'copy 2', duration: 1.4, delay: 0.4 },
          { path: ['chunk', 'cs3'], tone: 'data', label: 'copy 3', duration: 1.4, delay: 0.8 },
        ],
        panel: {
          title: 'Placement rule',
          icon: 'Copy',
          rows: [
            { text: 'Copy 1', value: 'rack A, machine 1' },
            { text: 'Copy 2', value: 'rack A, machine 2' },
            { text: 'Copy 3', value: 'rack B', tone: 'good' },
          ],
          footer: { text: 'One rack can die, a copy survives', tone: 'good' },
        },
        caption: 'Rack-aware placement',
      },
    },
    {
      title: 'Cost of copies',
      tag: 'tradeoff',
      heading: 'Three copies cost 3x, erasure coding costs 1.5x',
      eli5: 'Keeping three full copies of every volume needs three times the shelves. For old volumes nobody opens, the library can store a few coded summary pages instead, and rebuild a lost volume from them.',
      body: [
        '3x replication means **30 PB raw** for 10 PB of data. Erasure coding such as **6+3** splits a chunk group into 6 data pieces plus 3 parity pieces on 9 servers. Any 6 pieces rebuild the data, so it survives 3 losses at **1.5x** cost, or 15 PB raw.',
        'The price is repair and CPU. Rebuilding one lost piece reads 6 others across the network and decodes them, while a replica is a plain copy. HDFS 3.0 uses erasure coding for cold data and keeps 3 copies for hot data.',
      ],
      keyIdea: 'Replicas are cheap to repair and fast to read. Erasure codes are cheap to store. Use copies for hot data and codes for cold.',
      metrics: { data: '10 PB', servers: '~1,000', tput: '100 GB/s', ram: 'small', copies: '3x or 1.5x' },
      metricTones: { copies: 'good' },
      scene: {
        nodes: [
          { id: 'data', kind: 'block', at: p1, label: '10 PB data', sub: 'logical size', icon: 'HardDrive', tint: 'blue' },
          { id: 'rep', kind: 'block', at: p2, label: '3x copies', sub: '30 PB raw', icon: 'Copy', tint: 'amber', chips: ['hot data'] },
          { id: 'ec', kind: 'block', at: p3, label: 'erasure 6+3', sub: '15 PB raw', icon: 'Layers', tint: 'green', chips: ['cold data'] },
        ],
        links: [link('data', 'rep'), link('rep', 'ec', { label: 'cool down' })],
        flows: [
          { path: ['data', 'rep'], tone: 'data', label: '3 full copies', duration: 1.6 },
          { path: ['rep', 'ec'], tone: 'data', label: 're-encode', duration: 1.6, delay: 1.8 },
        ],
        panel: {
          title: 'Replicas versus codes',
          icon: 'Table',
          rows: [
            { text: '3x replication', value: '30 PB raw' },
            { text: '6+3 erasure code', value: '15 PB raw', tone: 'good' },
            { text: 'Repair one loss, replica', value: 'copy 1 chunk', tone: 'good' },
            { text: 'Repair one loss, code', value: 'read 6, decode', tone: 'warn' },
          ],
          footer: { text: 'Hot data: copies. Cold data: codes', tone: 'muted' },
        },
        caption: 'Storage cost against repair cost',
      },
    },
    {
      title: 'Read path',
      tag: 'concept',
      heading: 'Ask the master once, then read from a server',
      eli5: 'A reader asks the librarian once, gets the shelf numbers, walks to the nearest shelf and keeps the note, so the next visit skips the desk.',
      body: [
        'The client turns a byte offset into a chunk index (offset divided by 64 MB), asks the master once, and gets the handle plus the replica list. It reads from the **nearest** replica and **caches** the answer.',
        'A 1 TB scan needs about 16,000 lookups of a few hundred bytes. The master sees almost no traffic, because bytes never pass through it.',
      ],
      keyIdea: 'One small lookup per chunk, then data flows directly. Caching locations keeps the master off the hot path.',
      metrics: { data: '10 PB', servers: '~1,000', tput: '100 GB/s', ram: 'small', copies: '3' },
      scene: {
        nodes: [
          { ...client, chips: ['read(web-0412, 200 MB)'] },
          master,
          { ...cs1, status: 'active', badge: 'nearest' },
          { ...cs2, status: 'dim' },
          { ...cs3, status: 'dim' },
        ],
        links: [link('client', 'master'), link('client', 'cs1'), link('client', 'cs2', { style: 'faint' }), link('client', 'cs3', { style: 'faint' })],
        flows: [
          { path: ['client', 'master'], tone: 'request', label: 'file, chunk #3', duration: 1.2 },
          { path: ['master', 'client'], tone: 'response', label: 'h93 @ cs1, cs2, cs3', duration: 1.2, delay: 1.3 },
          { path: ['client', 'cs1'], tone: 'request', label: 'read h93', duration: 1.2, delay: 2.6 },
          { path: ['cs1', 'client'], tone: 'data', label: 'bytes', count: 3, duration: 1.4, delay: 3.9 },
        ],
        panel: {
          title: 'Master load for a 1 TB scan',
          icon: 'Gauge',
          rows: [
            { text: 'Lookups', value: '~16,000', tone: 'good' },
            { text: 'Bytes per lookup', value: '~100s' },
            { text: 'Bytes through master', value: '0', tone: 'good' },
          ],
          footer: { text: 'Cached locations avoid repeat asks', tone: 'good' },
        },
        caption: 'Metadata from the master, bytes from a chunkserver',
      },
      code: {
        language: 'typescript',
        title: 'Read a range that sits inside one chunk',
        source: `const CHUNK = 64 * 1024 * 1024;

async function read(path: string, offset: number, len: number) {
  const index = Math.floor(offset / CHUNK);
  let loc = cache.get(path + ':' + index);
  if (!loc) {
    loc = await master.lookup(path, index);
    cache.set(path + ':' + index, loc);
  }
  const replica = nearest(loc.servers);
  return replica.readChunk(loc.handle, offset % CHUNK, len);
}`,
        highlight: [4, 7, 10, 11],
      },
      quiz: {
        question: 'Why does the client read bytes straight from a chunkserver instead of through the master?',
        options: [
          'Chunkservers are faster at encryption',
          'The master would become the bandwidth bottleneck for the whole cluster',
          'The master cannot store file names',
          'It lets clients skip the lookup entirely',
        ],
        answer: 1,
        explain: 'The master is one machine. If 100 GB/s of data flowed through it, it would cap the system. It handles tiny lookups only, and the data path scales with the number of chunkservers.',
      },
    },
    {
      title: 'Heartbeats',
      tag: 'concept',
      heading: 'Servers report in, the master listens',
      eli5: 'Every shelf sends the librarian a short note every few seconds: I am here, and I have this much room. Once when it opens, and then rarely, it sends the full list of its volumes. The librarian does not memorize it. He just listens.',
      body: [
        'Chunkservers send the master a small **heartbeat** every few seconds: free space, load and recent changes. The master replies with orders: copy this chunk, delete that one.',
        'The full **chunk report** goes at startup and then rarely (HDFS: hourly). At 30 TB a server holds about 480,000 chunks, too many to send every few seconds.',
        'The master does not save chunk locations on disk. It learns them from the chunk reports, so only the server holds the truth about its disks.',
      ],
      keyIdea: 'Locations are soft state rebuilt from heartbeats. The server is the source of truth for what it stores.',
      metrics: { data: '10 PB', servers: '~1,000', tput: '100 GB/s', ram: 'small', copies: '3' },
      scene: {
        nodes: [master, { ...cs1, status: 'ok' }, { ...cs2, status: 'ok' }, { ...cs3, status: 'ok' }],
        links: [link('master', 'cs1', { style: 'dashed', arrow: 'both' }), link('master', 'cs2', { style: 'dashed', arrow: 'both' }), link('master', 'cs3', { style: 'dashed', arrow: 'both' })],
        flows: [
          { path: ['cs1', 'master'], tone: 'event', label: 'heartbeat', duration: 1.4 },
          { path: ['cs2', 'master'], tone: 'event', label: 'heartbeat', duration: 1.4, delay: 0.3 },
          { path: ['cs3', 'master'], tone: 'event', label: 'full report on boot', duration: 1.4, delay: 0.6 },
          { path: ['master', 'cs2'], tone: 'response', label: 'copy h92', duration: 1.4, delay: 2 },
        ],
        panel: {
          title: 'Two kinds of message',
          icon: 'Activity',
          code: 'heartbeat, every few seconds\ndisk_free: 7.2 TB\nload: 31%\nnew: [h104]\nreply: [copy h92 to cs2]\nfull report, on boot only\nchunks: [h91, h95, ...]',
          footer: { text: 'Silence means the server may be down', tone: 'muted' },
        },
        caption: 'Small heartbeats, full report on boot',
      },
    },
    {
      title: 'Write pipeline',
      tag: 'concept',
      heading: 'Push data down a chain, not out in a fan',
      eli5: 'To add pages, the reader hands them to the nearest shelf, which passes them to the next shelf, then the next. Nobody waits in a long line at one shelf.',
      body: [
        'To write, the client asks the master which servers hold the chunk and which is **primary**. It pushes the bytes to the **nearest** replica only. That replica forwards to the next, which forwards to the last.',
        'Each machine uses its own outbound link in full, and the client uploads the data once. Total time is about one transfer, not three.',
      ],
      keyIdea: 'Data flows along a chain to use every network link. Who decides the order is a separate question.',
      metrics: { data: '10 PB', servers: '~1,000', tput: '100 GB/s', ram: 'small', copies: '3' },
      scene: {
        nodes: [{ ...client, chips: ['append 8 MB'] }, master, { ...cs1, badge: 'nearest' }, cs2, cs3],
        links: [link('client', 'master'), link('client', 'cs1'), link('cs1', 'cs2'), link('cs2', 'cs3')],
        flows: [
          { path: ['client', 'master'], tone: 'request', label: 'who has it?', duration: 1.1 },
          { path: ['master', 'client'], tone: 'response', label: 'primary + replicas', duration: 1.1, delay: 1.2 },
          { path: ['client', 'cs1'], tone: 'data', label: '8 MB', duration: 1.1, delay: 2.5 },
          { path: ['cs1', 'cs2'], tone: 'data', label: '8 MB', duration: 1.1, delay: 3.2 },
          { path: ['cs2', 'cs3'], tone: 'data', label: '8 MB', duration: 1.1, delay: 3.9 },
        ],
        panel: {
          title: 'Steps so far',
          icon: 'List',
          rows: [
            { text: '1. Ask master for replicas' },
            { text: '2. Push to nearest replica' },
            { text: '3. Replicas forward in a chain' },
            { text: '4. Data buffered, not yet applied', tone: 'muted' },
          ],
          footer: { text: 'Nothing is visible to readers yet', tone: 'muted' },
        },
        caption: 'A pipeline over the network',
      },
    },
    {
      title: 'Commit order',
      tag: 'concept',
      heading: 'The primary decides the order',
      eli5: 'One shelf is the boss for this volume. It decides in what order pages go in and tells the other shelves, so all three copies end up the same.',
      body: [
        'When all replicas hold the bytes in memory, the client sends a **commit** to the primary. It gives the write a serial number, applies it, and tells the others to apply in that same order.',
        'The primary holds a time-limited **lease** from the master, so only one server orders writes for a chunk at a time. Data takes a chain, control goes through the primary.',
        'If a write fails on one replica, the region can be left inconsistent across copies. The client sees the error and retries.',
      ],
      keyIdea: 'Separate data flow (a chain for bandwidth) from control flow (one primary for order).',
      metrics: { data: '10 PB', servers: '~1,000', tput: '100 GB/s', ram: 'small', copies: '3' },
      scene: {
        nodes: [client, { ...cs1, status: 'ok', badge: 'secondary' }, { ...cs2, status: 'active', badge: 'primary, lease' }, { ...cs3, status: 'ok', badge: 'secondary' }],
        links: [link('client', 'cs2'), link('cs1', 'cs2', { arrow: 'both' }), link('cs2', 'cs3', { arrow: 'both' })],
        flows: [
          { path: ['client', 'cs2'], tone: 'request', label: 'commit', duration: 1.2 },
          { path: ['cs2', 'cs1'], tone: 'event', label: 'apply #17', duration: 1.2, delay: 1.3 },
          { path: ['cs2', 'cs3'], tone: 'event', label: 'apply #17', duration: 1.2, delay: 1.3 },
          { path: ['cs1', 'cs2'], tone: 'response', label: 'ack', duration: 1.1, delay: 2.6 },
          { path: ['cs3', 'cs2'], tone: 'response', label: 'ack', duration: 1.1, delay: 2.6 },
          { path: ['cs2', 'client'], tone: 'response', label: 'done', duration: 1.2, delay: 3.8 },
        ],
        panel: {
          title: 'Commit steps',
          icon: 'Workflow',
          rows: [
            { text: 'Client commits to primary' },
            { text: 'Primary assigns serial #17' },
            { text: 'Secondaries apply in order' },
            { text: 'All ack, primary replies', tone: 'good' },
          ],
          footer: { text: 'Same order on all 3 copies', tone: 'good' },
        },
        caption: 'One primary serializes the writes',
      },
    },
    {
      title: 'Record append',
      tag: 'tradeoff',
      heading: 'Append is at least once, and that is allowed',
      eli5: 'If a helper drops a page halfway, the reader hands it over again. A shelf may end up with a repeated page or a blank gap, so readers learn to skip blanks and repeats.',
      body: [
        'With `record_append` the system picks the offset. The record lands **at least once** at the same offset on all replicas. If one replica fails, the client retries, so some copies hold a duplicate or padding.',
        'This is not POSIX. It keeps writes fast, and readers deal with the mess: a checksum per record skips junk, and a record id drops repeats.',
      ],
      keyIdea: 'Relaxed consistency is cheap. Applications that tolerate duplicates and padding get high write throughput.',
      metrics: { data: '10 PB', servers: '~1,000', tput: '100 GB/s', ram: 'small', copies: '3' },
      scene: {
        nodes: [
          { ...client, badge: 'retries' },
          { ...cs1, chips: ['100: A, 164: A'] },
          { ...cs2, status: 'active', badge: 'primary', chips: ['off 100: A', 'off 164: A'] },
          { ...cs3, status: 'hot', chips: [{ text: 'off 100: junk', tone: 'bad' }, 'off 164: A'] },
        ],
        links: [link('client', 'cs2'), link('cs2', 'cs1'), link('cs2', 'cs3')],
        flows: [
          { path: ['client', 'cs2', 'cs3'], tone: 'request', label: 'append A', duration: 1.8 },
          { path: ['cs3', 'cs2', 'client'], tone: 'error', label: 'failed', duration: 1.8, delay: 1.9 },
          { path: ['client', 'cs2', 'cs1'], tone: 'request', label: 'retry A', duration: 1.8, delay: 3.8 },
        ],
        panel: {
          title: 'What the readers see',
          icon: 'Table',
          rows: [
            { text: 'A at offset 100', value: 'on cs1, cs2', tone: 'warn' },
            { text: 'Junk at offset 100', value: 'on cs3', tone: 'bad' },
            { text: 'A at offset 164', value: 'on all 3', tone: 'good' },
          ],
          footer: { text: 'Skip bad checksums, drop repeat ids', tone: 'muted' },
        },
        caption: 'A retry leaves duplicates and padding behind',
      },
      code: {
        language: 'typescript',
        title: 'A reader that tolerates at-least-once',
        source: `const seen = new Set<string>();

for (const rec of scanRecords(file)) {
  if (!checksumOk(rec)) continue;   // padding or torn write
  if (seen.has(rec.id)) continue;   // duplicate from a retry
  seen.add(rec.id);
  handle(rec.payload);
}`,
        highlight: [4, 5],
      },
    },
    {
      title: 'Checksums',
      tag: 'concept',
      heading: 'Disks lie, so every block carries a checksum',
      eli5: 'Every page has a tiny stamp from when it was shelved. If the stamp does not match, the page got smudged, so the reader takes the same page from another copy.',
      body: [
        'Each chunk is cut into 64 KB blocks with a 32-bit **checksum** each. A server verifies a block before returning it, and scrubs idle chunks in the background to catch rot early.',
        'On a mismatch the client reads another replica. The server tells the master, which clones a good copy to replace the bad one.',
      ],
      keyIdea: 'Verify on every read and scrub in the background. Silent corruption is repaired from the other replicas.',
      metrics: { data: '10 PB', servers: '~1,000', tput: '100 GB/s', ram: 'small', copies: '3' },
      scene: {
        nodes: [client, master, { ...cs1, status: 'hot', chips: [{ text: 'h91 block 7: bad', tone: 'bad' }] }, { ...cs2, status: 'ok', chips: [{ text: 'h91 ok', tone: 'good' }] }],
        links: [link('client', 'cs1'), link('client', 'cs2'), link('cs1', 'master', { style: 'dashed' })],
        flows: [
          { path: ['client', 'cs1'], tone: 'request', label: 'read h91', duration: 1.2 },
          { path: ['cs1', 'client'], tone: 'error', label: 'checksum mismatch', duration: 1.2, delay: 1.3 },
          { path: ['cs1', 'master'], tone: 'event', label: 'report bad copy', duration: 1.4, delay: 2.6 },
          { path: ['client', 'cs2'], tone: 'request', label: 'read h91', duration: 1.2, delay: 4 },
          { path: ['cs2', 'client'], tone: 'data', label: 'good bytes', duration: 1.2, delay: 5.3 },
        ],
        panel: {
          title: 'Checksum layout',
          icon: 'Shield',
          rows: [
            { text: 'Block size', value: '64 KB' },
            { text: 'Checksum', value: '32 bits' },
            { text: 'Overhead', value: '~0.006%' },
            { text: 'Checked', value: 'on read + scrub', tone: 'good' },
          ],
        },
        caption: 'A bad block is detected, then repaired',
      },
    },
    {
      title: 'Master memory',
      tag: 'case',
      heading: 'Case: the whole catalog fits in one machine RAM',
      eli5: 'The card catalog is small enough to sit on the librarian desk. Millions of volumes only need a short line each, so he never walks to a back room.',
      body: [
        '10 PB divided by 64 MB is about 160 million chunks. At roughly 64 bytes of metadata each, that is **about 10 GB**. File names add a little more with prefix compression. One server holds it in RAM.',
        'RAM makes every lookup fast, and lets the master scan its whole state in the background for re-replication and cleanup.',
      ],
      keyIdea: 'Big chunks make metadata tiny. Ten petabytes of data needs about ten gigabytes of index.',
      metrics: { data: '10 PB', servers: '~1,000', tput: '100 GB/s', ram: '~10 GB', copies: '3' },
      metricTones: { ram: 'good' },
      scene: {
        nodes: [
          { ...master, status: 'ok', load: 25, badge: '10 GB in RAM' },
          { id: 'ns', kind: 'block', size: 0.72, at: at(-4, 3.6), label: 'namespace', sub: 'paths, trees', icon: 'List', tint: 'blue' },
          { id: 'map', kind: 'block', size: 0.72, at: at(4, 3.6), label: 'chunk map', sub: '160M entries', icon: 'Table', tint: 'amber' },
        ],
        links: [link('master', 'ns'), link('master', 'map')],
        flows: [
          { path: ['master', 'ns'], tone: 'request', label: 'lookup', duration: 1.2 },
          { path: ['master', 'map'], tone: 'request', label: 'lookup', duration: 1.2, delay: 0.5 },
        ],
        panel: {
          title: 'Napkin math',
          icon: 'Cpu',
          rows: [
            { text: '10 PB / 64 MB', value: '~160M chunks' },
            { text: '160M x 64 B', value: '~10 GB', tone: 'good' },
            { text: 'Server RAM', value: 'fits easily', tone: 'good' },
          ],
          footer: { text: 'See the napkin math lesson', tone: 'muted' },
        },
        caption: 'Metadata is a rounding error next to the data',
      },
      quiz: {
        question: 'A 10 PB file system uses 64 MB chunks and about 64 bytes of master metadata per chunk. Roughly how much master RAM is that?',
        options: ['About 100 MB', 'About 10 GB', 'About 10 TB', 'About 1 PB'],
        answer: 1,
        explain: '10 PB / 64 MB is around 160 million chunks, and 160 million times 64 bytes is about 10 GB. That is why one master can hold the whole chunk map in memory.',
      },
    },
    {
      title: 'Operation log',
      tag: 'concept',
      heading: 'RAM is fast and forgetful, so log every change',
      eli5: 'The librarian writes every change in a notebook before he does it, and copies the notebook to another building. After a fire he just reads the notebook again.',
      body: [
        'The master appends each namespace and file-to-chunk change to an **operation log** and replicates it to remote disks. It replies to the client only after the log is flushed.',
        'Now and then it writes a **checkpoint** of its state. A restart loads the latest checkpoint and replays a short log tail. Chunk locations are not logged.',
      ],
      keyIdea: 'Log first, apply second, checkpoint often. A restart is a checkpoint load plus a short replay.',
      metrics: { data: '10 PB', servers: '~1,000', tput: '100 GB/s', ram: '~10 GB', copies: '3' },
      scene: {
        nodes: [
          master,
          { id: 'oplog', kind: 'queue', at: at(-4.4, 3.2), label: 'operation log', sub: 'append only' },
          { id: 'remote', kind: 'storage', at: at(0, 3.2), label: 'log copies', sub: '2 other racks' },
          { id: 'ckpt', kind: 'storage', at: at(4.4, 3.2), label: 'checkpoint', sub: 'state snapshot' },
        ],
        links: [link('master', 'oplog'), link('oplog', 'remote'), link('master', 'ckpt', { style: 'dashed' })],
        flows: [
          { path: ['master', 'oplog'], tone: 'event', label: 'create /logs/x', duration: 1.2 },
          { path: ['oplog', 'remote'], tone: 'data', label: 'replicate', duration: 1.4, delay: 1.3 },
          { path: ['master', 'ckpt'], tone: 'data', label: 'snapshot', duration: 1.6, delay: 2.8 },
        ],
        panel: {
          title: 'Recovery',
          icon: 'Code',
          code: '#8801 create /logs/web-0412\n#8802 add-chunk h91\n#8803 add-chunk h92\ncheckpoint taken at #8800\nrestart: load + replay 3 lines',
          footer: { text: 'Chunk locations come from heartbeats', tone: 'muted' },
        },
        caption: 'Durable history, quick restart',
      },
    },
    {
      title: 'Master failover',
      tag: 'case',
      heading: 'Case: the master dies',
      eli5: 'A second librarian reads the same notebook all day. If the first one faints, the second sits down at the desk. Readers who already hold shelf notes keep reading meanwhile.',
      body: [
        'A **standby master** follows the log stream, and chunkservers also report to it (as in HDFS HA). When heartbeats stop, an election picks it as the new master, as in the consensus lesson.',
        'Failover takes seconds to minutes. Cached reads keep working, writes only while primary leases last, and new lookups retry against the standby.',
        'The old master is **fenced** so two masters never act at once.',
      ],
      keyIdea: 'A hot standby fed by the log turns a single point of failure into a short pause.',
      metrics: { data: '10 PB', servers: '~1,000', tput: '100 GB/s (cached)', ram: '~10 GB', copies: '3' },
      metricTones: { tput: 'warn' },
      scene: {
        nodes: [
          client,
          { ...master, status: 'down', sub: 'crashed' },
          { id: 'standby', kind: 'block', at: at(4.4, -3.2), label: 'standby', sub: 'was following log', icon: 'Database', tint: 'amber', status: 'active', badge: 'takes over' },
          { ...cs1, status: 'ok' },
        ],
        links: [link('master', 'standby', { style: 'dashed', label: 'log stream' }), link('client', 'master', { style: 'faint' }), link('client', 'cs1')],
        flows: [
          { path: ['client', 'cs1'], tone: 'request', label: 'cached read', duration: 1.2 },
          { path: ['cs1', 'client'], tone: 'data', label: 'bytes', count: 2, duration: 1.2, delay: 1.3 },
          { path: ['client', 'standby'], tone: 'request', label: 'new lookup, after retry', duration: 1.8, delay: 2.8 },
        ],
        panel: {
          title: 'During failover',
          icon: 'Shield',
          rows: [
            { text: 'Reads with cached locations', value: 'keep working', tone: 'good' },
            { text: 'Writes', value: 'until leases expire', tone: 'warn' },
            { text: 'New lookups and creates', value: 'wait', tone: 'warn' },
            { text: 'Standby has the log', value: 'no lost updates', tone: 'good' },
            { text: 'Old master', value: 'fenced off', tone: 'good' },
          ],
          footer: { text: 'Locations rebuilt from chunk reports', tone: 'muted' },
        },
        caption: 'Data path survives, control path pauses',
      },
    },
    {
      title: 'Server dies',
      tag: 'case',
      heading: 'Case: a chunkserver dies and the cluster heals itself',
      eli5: 'A shelf collapses. The librarian sees its notes stopped and finds volumes that now have two copies. He asks other shelves to copy them onto a spare shelf.',
      body: [
        'The master sees missed heartbeats, but waits a timeout of several minutes before it declares the server dead, so a quick reboot does not trigger 30 TB of copying. After that, every chunk it held is down to **2 copies**. The master queues them, the ones with the fewest copies first.',
        'Surviving replicas clone the chunks to other servers in parallel. At a throttled 10 GB/s, a tenth of the cluster read bandwidth, 30 TB heals in about 50 minutes and client reads stay fast.',
      ],
      keyIdea: 'Re-replication restores the copy count automatically. Spreading chunks widely makes the repair fast.',
      metrics: { data: '10 PB', servers: '999', tput: '100 GB/s', ram: '~10 GB', copies: '2 then 3' },
      metricTones: { copies: 'warn' },
      scene: {
        nodes: [
          master,
          { ...cs1, status: 'down', sub: 'died', badge: 'no heartbeat' },
          { ...cs2, status: 'active', chips: ['h91'] },
          { ...cs3, status: 'active', chips: ['h91'] },
          { id: 'cs4', kind: 'storage', at: at(-2.2, 10), label: 'chunkserver 4', sub: 'spare space', status: 'ok' },
        ],
        links: [link('master', 'cs1', { style: 'faint' }), link('master', 'cs2', { style: 'dashed' }), link('cs2', 'cs4', { style: 'dashed' })],
        flows: [
          { path: ['master', 'cs2'], tone: 'event', label: 'clone h91 to cs4', duration: 1.4 },
          { path: ['cs2', 'cs4'], tone: 'data', label: 'h91 (64 MB)', count: 3, duration: 1.8, delay: 1.5 },
        ],
        panel: {
          title: 'Repair queue',
          icon: 'Activity',
          rows: [
            { text: 'Chunks with 1 copy', value: 'first', tone: 'bad' },
            { text: 'Chunks with 2 copies', value: 'next', tone: 'warn' },
            { text: 'Chunks with 3 copies', value: 'healthy', tone: 'good' },
            { text: 'Wait before declaring dead', value: 'minutes' },
            { text: 'Clone traffic', value: 'throttled, 10 GB/s' },
          ],
          footer: { text: 'See the failure detection lesson', tone: 'muted' },
        },
        caption: 'Under-replicated chunks are cloned',
      },
    },
    {
      title: 'Rack dies',
      tag: 'case',
      heading: 'Case: a whole rack loses power',
      eli5: 'A whole building loses power. Because every volume has a copy in the other building, readers keep reading while the librarian makes new copies.',
      body: [
        'The power to one rack fails and 40 servers vanish at once. Chunks with two copies in that rack drop to **1 live copy**. Chunks with one copy there drop to 2. None lose all three, because the third copy sits in another rack.',
        'Reads go to the surviving replicas, and the master repairs the 1-copy chunks first, cloning them to other racks. Writes pay a cost: one of three copies must cross racks, where bandwidth is scarcer.',
      ],
      keyIdea: 'Rack-aware placement turns correlated failures into degraded reads, never lost data.',
      metrics: { data: '10 PB', servers: '960', tput: '96 GB/s', ram: '~10 GB', copies: 'worst case 1 then 3' },
      metricTones: { copies: 'bad', servers: 'warn' },
      scene: {
        nodes: [
          client,
          master,
          { ...cs1, status: 'down', chips: ['h91'] },
          { ...cs2, status: 'down', chips: ['h91'] },
          { ...cs3, status: 'ok', chips: [{ text: 'h91 live', tone: 'good' }] },
        ],
        links: [link('client', 'master'), link('client', 'cs3')],
        zones: [
          { id: 'rackA', from: [-1.6, 0.6], to: [2.8, 5.2], label: 'rack A: power loss', tone: 'red' },
          { id: 'rackB', from: [3.0, -1.6], to: [5.2, 1.0], label: 'rack B', tone: 'green' },
        ],
        flows: [
          { path: ['client', 'master'], tone: 'request', label: 'where is h91?', duration: 1.2 },
          { path: ['master', 'client'], tone: 'response', label: 'cs3', duration: 1.2, delay: 1.3 },
          { path: ['client', 'cs3', 'client'], tone: 'data', label: 'read', duration: 1.6, delay: 2.6 },
        ],
        panel: {
          title: 'After the failure',
          icon: 'Table',
          rows: [
            { text: 'Chunks with 2 copies in rack A', value: '1 live left', tone: 'bad' },
            { text: 'Chunks with 1 copy in rack A', value: '2 live left', tone: 'warn' },
            { text: 'Master action', value: 're-replicate', tone: 'warn' },
          ],
          footer: { text: 'No chunk lost', tone: 'good' },
        },
        caption: 'One surviving rack keeps the data',
      },
    },
    {
      title: 'Lazy delete',
      tag: 'concept',
      heading: 'Deletes are lazy, and garbage collection cleans up',
      eli5: 'Throwing out a set only puts it in a bin for a few days. Later a cleaner takes the volumes off the shelves, so a mistake can still be undone.',
      body: [
        'A delete just **renames** the file to a hidden name with a timestamp. After a grace period (days) a background scan drops it from the namespace. A mistake can be undone until then.',
        'Snapshots use copy-on-write: the master drops leases on the chunks, the snapshot shares them, and the first write after it clones the chunk.',
        'Chunks that no file references are orphans. A heartbeat reply tells the server to delete them. It is simple and works even when a server was offline during the delete.',
      ],
      keyIdea: 'Lazy deletion is simple, safe against mistakes and tolerant of servers that were away.',
      metrics: { data: '10 PB', servers: '~1,000', tput: '100 GB/s', ram: '~10 GB', copies: '3' },
      scene: {
        nodes: [client, { ...master, status: 'active' }, { ...cs1, chips: [{ text: 'h91 orphan', tone: 'warn' }] }, cs2],
        links: [link('client', 'master'), link('master', 'cs1', { style: 'dashed' }), link('master', 'cs2', { style: 'dashed' })],
        flows: [
          { path: ['client', 'master'], tone: 'request', label: 'delete /logs/old', duration: 1.2 },
          { path: ['master', 'client'], tone: 'response', label: 'renamed', duration: 1.2, delay: 1.3 },
          { path: ['master', 'cs1'], tone: 'event', label: 'delete h91', duration: 1.4, delay: 3.2 },
        ],
        panel: {
          title: 'A delete in three moves',
          icon: 'Code',
          code: 'delete /logs/web-0301\n-> rename /.trash/web-0301@t\n(grace period: undelete works)\nscan: expired -> drop the file\nh91 has no file -> orphan\nheartbeat reply: delete h91',
          footer: { text: 'Space comes back later, in the background', tone: 'muted' },
        },
        caption: 'Rename now, reclaim space later',
      },
    },
    {
      title: 'Stale copies',
      tag: 'concept',
      heading: 'Version numbers catch the copy that missed a write',
      eli5: 'A shelf that was away misses a new edition. Every volume carries an edition number, so the librarian can tell its old volume is out of date and ignores it.',
      body: [
        'Each chunk has a **version number**. The master bumps it each time it grants a new primary lease. A server that was down during a write comes back with an older version.',
        'The master sees the old version in the heartbeat, never hands that replica to a reader, and removes it in garbage collection. Clients never read stale data from it.',
      ],
      keyIdea: 'A per-chunk version lets the master tell a current replica from one that missed a mutation.',
      metrics: { data: '10 PB', servers: '~1,000', tput: '100 GB/s', ram: '~10 GB', copies: '3' },
      scene: {
        nodes: [
          master,
          { ...cs1, status: 'dim', sub: 'was offline', chips: [{ text: 'h91 v6', tone: 'warn' }] },
          { ...cs2, status: 'ok', chips: [{ text: 'h91 v7', tone: 'good' }] },
          { ...cs3, status: 'ok', chips: [{ text: 'h91 v7', tone: 'good' }] },
        ],
        links: [link('cs1', 'master', { style: 'dashed' }), link('cs2', 'master', { style: 'dashed' }), link('cs3', 'master', { style: 'dashed' })],
        flows: [
          { path: ['cs1', 'master'], tone: 'event', label: 'h91 v6', duration: 1.4 },
          { path: ['cs2', 'master'], tone: 'event', label: 'h91 v7', duration: 1.4, delay: 0.3 },
          { path: ['master', 'cs1'], tone: 'response', label: 'stale, delete', duration: 1.4, delay: 2 },
        ],
        panel: {
          title: 'The master check',
          icon: 'Table',
          rows: [
            { text: 'Current version', value: 'v7' },
            { text: 'cs1 reports', value: 'v6, stale', tone: 'warn' },
            { text: 'cs2, cs3 report', value: 'v7, current', tone: 'good' },
            { text: 'cs1 copy', value: 'never served', tone: 'good' },
          ],
        },
        caption: 'Stale replicas are ignored and collected',
      },
    },
    {
      title: 'Beyond one master',
      tag: 'tradeoff',
      heading: 'When metadata outgrows one machine',
      eli5: 'When one catalog gets too big, the library splits it into several catalogs, each for some sets, all sharing the same shelves.',
      body: [
        'Many small files break the 10 GB math, because each file costs a catalog entry. The fix is **federation**: several masters, each owning a part of the namespace, all sharing the same chunkservers (HDFS Federation).',
        'The other path is an object store, where metadata is partitioned by consistent hashing. See the consistent hashing and object storage design lessons.',
      ],
      keyIdea: 'One master is a design choice, not a law. Shard the namespace when the metadata no longer fits.',
      metrics: { data: '10 PB', servers: '~1,000', tput: '100 GB/s', ram: '~10 GB each', copies: '3' },
      scene: {
        nodes: [
          client,
          { id: 'mA', kind: 'block', at: at(-1.6, -3.2), size: 0.85, label: 'master A', sub: '/logs/*', icon: 'Database', tint: 'violet' },
          { id: 'mB', kind: 'block', at: at(3, -3.2), size: 0.85, label: 'master B', sub: '/ml/*', icon: 'Database', tint: 'teal' },
          { id: 'pool', kind: 'storage', at: at(0.8, 3.6), label: 'shared chunkservers', sub: '1,000 machines' },
        ],
        links: [link('client', 'mA'), link('client', 'mB'), link('mA', 'pool', { style: 'dashed' }), link('mB', 'pool', { style: 'dashed' })],
        flows: [
          { path: ['client', 'mA'], tone: 'request', label: '/logs/web-0412', duration: 1.4 },
          { path: ['client', 'mB'], tone: 'request', label: '/ml/model-7', duration: 1.4, delay: 1.5 },
          { path: ['mA', 'pool'], tone: 'event', label: 'orders', duration: 1.4, delay: 3 },
        ],
        panel: {
          title: 'Scaling the master',
          icon: 'Layers',
          rows: [
            { text: 'Master A namespace', value: '/logs' },
            { text: 'Master B namespace', value: '/ml' },
            { text: 'Chunkservers', value: 'shared by both' },
            { text: 'Alternative', value: 'object store', tone: 'muted' },
          ],
          footer: { text: 'Metadata grows with files, not bytes', tone: 'warn' },
        },
        caption: 'Several masters over one pool of disks',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'One master, many chunkservers, three copies',
      eli5: 'One catalog librarian, many shelves, big volumes and three copies of each. That is how a huge library never loses a book, even when shelves collapse.',
      body: [
        'Huge files are cut into 64 MB chunks, three copies each, spread over racks. A single master holds the small metadata in RAM, backed by a log and a standby. Clients read and write bytes directly.',
        'Writes use a chain for data and a primary for order. Record append is at least once, so readers dedupe. Heartbeats, checksums, versions and re-replication keep it healthy.',
      ],
      keyIdea: 'Trade POSIX for scale: big chunks, a small master, replicated data and a client that tolerates the rough edges.',
      metrics: { data: '10 PB', servers: '~1,000', tput: '100 GB/s', ram: '~10 GB', copies: '3' },
      metricTones: { data: 'good', tput: 'good', copies: 'good' },
      scene: {
        nodes: [client, master, { ...cs1, status: 'ok' }, { ...cs3, status: 'ok' }],
        links: [link('client', 'master'), link('client', 'cs1'), link('master', 'cs3', { style: 'dashed' })],
        flows: [
          { path: ['client', 'master'], tone: 'request', label: 'lookup', duration: 1.1 },
          { path: ['master', 'client'], tone: 'response', label: 'locations', duration: 1.1, delay: 1.2 },
          { path: ['client', 'cs1'], tone: 'data', label: 'bytes', count: 3, duration: 1.4, delay: 2.5 },
          { path: ['cs3', 'master'], tone: 'event', label: 'heartbeat', duration: 1.4, delay: 3 },
        ],
        panel: {
          title: 'The design in six lines',
          icon: 'List',
          rows: [
            { text: 'Chunks', value: '64 MB' },
            { text: 'Copies', value: '3, rack-aware' },
            { text: 'Master', value: 'metadata in RAM + log' },
            { text: 'Writes', value: 'chain + primary' },
            { text: 'Append', value: 'at least once' },
            { text: 'Repair', value: 'heartbeats + clones', tone: 'good' },
          ],
        },
        caption: 'The whole system on one screen',
      },
      quiz: {
        question: 'A chunkserver dies and its chunks drop to 2 copies. What restores the third copy?',
        options: [
          'Clients notice and rewrite the files',
          'The master sees missing heartbeats and orders surviving replicas to clone the chunks elsewhere',
          'The primary replica copies its data to the client',
          'Nothing, two copies are enough',
        ],
        answer: 1,
        explain: 'The master tracks heartbeats and chunk counts. When a server goes silent it queues the under-replicated chunks, fewest copies first, and tells surviving replicas to clone them onto other servers.',
      },
    },
  ],
};
