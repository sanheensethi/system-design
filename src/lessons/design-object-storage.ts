import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const client: SceneNode = { id: 'client', kind: 'client', at: at(-4.5, -3.5), label: 'client', sub: 'SDK or browser' };
const fe: SceneNode = { id: 'fe', kind: 'block', at: at(0, -3.5), label: 'front end', sub: 'HTTP API', icon: 'Network', tint: 'violet' };
const meta: SceneNode = { id: 'meta', kind: 'block', size: 0.72, at: at(-4, 3.5), label: 'metadata', sub: 'who owns what', icon: 'Database', tint: 'amber' };
const n1: SceneNode = { id: 'n1', kind: 'storage', at: at(0, 3.5), label: 'node 1', sub: 'rack A' };
const n2: SceneNode = { id: 'n2', kind: 'storage', at: at(4, 3.5), label: 'node 2', sub: 'rack B' };

export const designObjectStorage: Lesson = {
  id: 'design-object-storage',
  title: 'Design S3-style object storage (part 1)',
  tagline: 'Build the storage service itself: API, data model, the metadata and data split, chunks, replicas and erasure coding.',
  minutes: 16,
  level: 'Advanced',
  learn: [
    'Requirements and scale numbers for a store holding 100 PB and 100 billion objects',
    'The API and the two datasets behind it: metadata and immutable bytes',
    'Why one server breaks, and the split into front end, metadata service and storage nodes',
    'The write path with a single commit point, and the read path with checksums',
    'Chunking big objects, rack-aware placement, and erasure coding versus copies',
  ],
  metrics: [
    { key: 'objects', label: 'Objects', icon: 'Boxes' },
    { key: 'data', label: 'User data', icon: 'HardDrive' },
    { key: 'rps', label: 'Peak requests', icon: 'Gauge' },
    { key: 'dur', label: 'Durability', icon: 'Shield' },
    { key: 'raw', label: 'Raw per 1 byte', icon: 'Layers' },
  ],
  steps: [
    {
      title: 'The promise',
      tag: 'problem',
      heading: 'Customers hand us their files and expect them back, forever',
      eli5: 'Picture a giant library where people leave their treasures. The **store** is the whole library. Nobody may ever lose a treasure, even when a shelf collapses.',
      body: [
        'You are building the service behind buckets and keys, the way S3 does. Teams already use object storage as a customer (see the object storage lessons). Now you are the provider.',
        'The brief is blunt: keep every object, never lose one, answer fast, and cost little. A lost customer file is not a bug ticket. It is a lawsuit.',
      ],
      keyIdea: 'The product is a promise: store any object, return the exact bytes, never lose them.',
      metrics: { objects: '100 billion', data: '100 PB', rps: '?', dur: '?', raw: '?' },
      scene: {
        nodes: [client, { ...fe, tint: 'gray' }, { id: 'store', kind: 'storage', at: at(4, 3.5), label: 'the store', sub: '100 PB?', status: 'hot' }],
        links: [link('client', 'fe', { label: 'PUT, GET' }), link('fe', 'store')],
        flows: [
          { path: ['client', 'fe', 'store'], tone: 'request', label: 'PUT photo.jpg', duration: 1.8 },
          { path: ['store', 'fe', 'client'], tone: 'response', label: '200 OK', duration: 1.8, delay: 1.9 },
        ],
        panel: {
          title: 'What we must build',
          icon: 'List',
          rows: [
            { text: 'Never lose an object', tone: 'bad' },
            { text: 'Any size, bytes to terabytes' },
            { text: 'Millions of customers' },
            { text: 'Cheap per gigabyte' },
          ],
        },
        caption: 'Files go in, the same bytes come out',
      },
    },
    {
      title: 'Requirements',
      tag: 'concept',
      heading: 'Functional and non-functional requirements',
      eli5: 'The library needs rules on the door. You can drop off, fetch, and throw away a treasure. And the library promises it never loses one and never closes.',
      body: [
        'Functional: create buckets, `PUT` an object, `GET` it (whole or a byte range), `DELETE` it, `LIST` a bucket by prefix, keep old versions, and upload big files in parts.',
        'Non-functional: **eleven nines** durability, 99.99% availability, objects up to 5 TB, strong read-after-write, and the lowest cost per byte we can reach. Latency matters less than for a database. Durability matters most.',
      ],
      keyIdea: 'Durability and cost drive this design. Latency is a secondary goal.',
      metrics: { objects: '100 billion', data: '100 PB', rps: '?', dur: '99.999999999%', raw: '?' },
      metricTones: { dur: 'good' },
      scene: {
        nodes: [client, fe, { ...n1, label: 'storage', sub: 'bytes' }],
        links: [link('client', 'fe'), link('fe', 'n1')],
        flows: [{ path: ['client', 'fe', 'n1'], tone: 'request', label: 'PUT', duration: 1.6 }],
        panel: {
          title: 'Requirements',
          icon: 'Table',
          rows: [
            { text: 'PUT, GET, DELETE, LIST', value: 'API' },
            { text: 'Versioning, multipart', value: 'API' },
            { text: 'Durability', value: '11 nines', tone: 'good' },
            { text: 'Availability', value: '99.99%', tone: 'good' },
            { text: 'Largest object', value: '5 TB' },
            { text: 'Read after write', value: 'strong' },
          ],
        },
        caption: 'Durability first, then cost',
      },
    },
    {
      title: 'Scale',
      tag: 'concept',
      heading: 'Napkin math: what 100 PB means',
      eli5: 'Count the library: 100 billion treasures, and 50,000 visitors a second at the busiest hour. We also need a catalog card for each treasure.',
      body: [
        'Assume 100 PB of user data in 100 billion objects, so the average object is 1 MB. Peak load is 50,000 requests a second. See the napkin math lessons for the method.',
        'Metadata is about 1 KB per object, so **100 TB** of catalog. The bytes need 20 TB disks: 5,000 disks for one copy, and 15,000 for three. Eleven nines at this size means about one lost object a year.',
      ],
      keyIdea: 'Two datasets, two scales: 100 PB of bytes and 100 TB of metadata. Neither fits one machine.',
      metrics: { objects: '100 billion', data: '100 PB', rps: '50,000/s', dur: '11 nines', raw: '?' },
      scene: {
        nodes: [{ ...fe, chips: ['50,000 req/s'] }, { ...meta, chips: ['100 TB'] }, { ...n1, label: 'bytes', sub: '100 PB', chips: ['5,000 disks per copy'] }],
        links: [link('fe', 'meta'), link('fe', 'n1')],
        flows: [
          { path: ['fe', 'meta'], tone: 'request', duration: 1.4 },
          { path: ['fe', 'n1'], tone: 'request', duration: 1.4, delay: 0.3 },
        ],
        panel: {
          title: 'Sizing',
          icon: 'Gauge',
          rows: [
            { text: 'Average object', value: '1 MB' },
            { text: 'Metadata, 1 KB each', value: '100 TB' },
            { text: '100 PB / 20 TB disk', value: '5,000 disks' },
            { text: 'Three copies', value: '15,000 disks', tone: 'warn' },
            { text: 'Expected loss at 11 nines', value: '~1 object/year' },
          ],
        },
        caption: 'Bytes and catalog both outgrow a machine',
      },
    },
    {
      title: 'The API',
      tag: 'concept',
      heading: 'A small HTTP API over buckets and keys',
      eli5: 'Visitors only know a few words at the desk: put this in, give me that back, what do you have, and throw it away. Each treasure has a box name and a label.',
      body: [
        'The API is REST over HTTPS (see the API styles lesson). The path is `/{bucket}/{key}`. The key is a flat string, and slashes in it are just characters that make prefixes.',
        '`GET` accepts a `Range` header for partial reads. `LIST` takes a prefix and a continuation token, and returns a page. There is no rename and no append: an object is replaced as a whole.',
      ],
      keyIdea: 'A handful of verbs on bucket plus key. Objects are replaced whole, never edited in place.',
      metrics: { objects: '100 billion', data: '100 PB', rps: '50,000/s', dur: '11 nines', raw: '?' },
      scene: {
        nodes: [{ ...client, chips: ['GET /photos/a.jpg'] }, { ...fe, tint: 'green', label: 'S3-style API', sub: 'bucket + key' }, { ...n1, label: 'storage', sub: 'bytes' }],
        links: [link('client', 'fe', { label: 'HTTPS' }), link('fe', 'n1')],
        flows: [
          { path: ['client', 'fe', 'n1'], tone: 'request', label: 'GET Range: 0-99', duration: 1.8 },
          { path: ['n1', 'fe', 'client'], tone: 'response', label: '206 + bytes', duration: 1.8, delay: 1.9 },
        ],
        panel: {
          title: 'The whole surface',
          icon: 'Code',
          code: 'PUT    /{bucket}/{key}\nGET    /{bucket}/{key}  Range\nHEAD   /{bucket}/{key}\nDELETE /{bucket}/{key}\nGET    /{bucket}?prefix=&token=',
        },
        caption: 'Five verbs cover almost everything',
      },
      code: {
        language: 'bash',
        title: 'The API in curl',
        source: `# write, then read back the first 100 bytes
curl -X PUT https://store.example/photos/2026/a.jpg \\
     -H "Content-Length: 1048576" --data-binary @a.jpg
curl -H "Range: bytes=0-99" https://store.example/photos/2026/a.jpg

# list one page under a prefix
curl "https://store.example/photos?prefix=2026/&max=1000"
curl -X DELETE https://store.example/photos/2026/a.jpg`,
        highlight: [2, 4, 7],
      },
    },
    {
      title: 'Data model',
      tag: 'concept',
      heading: 'Two datasets: tiny metadata and huge immutable bytes',
      eli5: 'Every treasure has two parts: the treasure itself in a box on a shelf, and a catalog card saying which shelf. Boxes never change. Only the card does.',
      body: [
        'An object is **immutable bytes** plus a **metadata record**: bucket, key, version, size, checksum, content type, and the list of places the bytes live.',
        'The two behave differently. Bytes are huge, written once, read many times. Metadata is small, queried by key, and updated on every `PUT` and `DELETE`. Each gets its own storage design.',
      ],
      keyIdea: 'Bytes are written once and never edited. Metadata is the small, changing part that points at them.',
      metrics: { objects: '100 billion', data: '100 PB', rps: '50,000/s', dur: '11 nines', raw: '?' },
      scene: {
        nodes: [{ ...meta, size: 1, chips: ['1 KB per object'] }, { ...n1, label: 'bytes', sub: 'immutable', chips: ['written once'] }],
        links: [link('meta', 'n1', { label: 'points to' })],
        flows: [{ path: ['meta', 'n1'], tone: 'data', label: 'chunk map', duration: 1.6 }],
        panel: {
          title: 'One metadata row',
          icon: 'Table',
          rows: [
            { text: 'bucket / key', value: 'photos / 2026/a.jpg' },
            { text: 'version', value: 'v7f3' },
            { text: 'size, etag', value: '1 MB, md5' },
            { text: 'chunks', value: 'c91 on n1, n2, n3' },
          ],
          footer: { text: 'Tiny and mutable, versus huge and fixed', tone: 'muted' },
        },
        caption: 'The card changes. The box does not.',
      },
      code: {
        language: 'typescript',
        title: 'The metadata record',
        source: `interface ObjectMeta {
  bucket: string;
  key: string;
  versionId: string;      // new on every PUT
  size: number;           // bytes
  etag: string;           // checksum of the whole object
  contentType: string;
  chunks: ChunkRef[];     // where the bytes live
}
interface ChunkRef { id: string; size: number; nodes: string[]; crc: number }`,
        highlight: [3, 8],
      },
    },
    {
      title: 'Simple design',
      tag: 'concept',
      heading: 'The simplest version: one server, local disks, one database',
      eli5: 'Start tiny: one librarian with one shelf room and one card drawer. Treasures go on the shelf, and the librarian writes a card.',
      body: [
        'One app server accepts the `PUT`, writes the bytes to its local disks, and inserts a row into a SQL database. A `GET` looks up the row, then reads the file.',
        'It works for a demo, and it is a good first answer in an interview. Then the numbers arrive.',
      ],
      keyIdea: 'One server plus one database is the right first sketch. Name where it breaks.',
      metrics: { objects: '1 million', data: '1 TB', rps: '200/s', dur: '1 disk', raw: '1x' },
      scene: {
        nodes: [client, { ...fe, label: 'one server', sub: 'app + disks', status: 'active' }, { id: 'sql', kind: 'db', at: at(4, 3.5), label: 'SQL', sub: 'rows' }],
        links: [link('client', 'fe'), link('fe', 'sql')],
        flows: [
          { path: ['client', 'fe'], tone: 'request', label: 'PUT a.jpg', duration: 1.4 },
          { path: ['fe', 'sql'], tone: 'request', label: 'INSERT row', duration: 1.4, delay: 1.5 },
          { path: ['sql', 'fe', 'client'], tone: 'response', label: '200', duration: 1.6, delay: 3 },
        ],
        panel: { title: 'Day one', icon: 'Server', rows: [{ text: 'Files on local disk' }, { text: 'Rows in SQL' }, { text: 'Fine for 1 TB', tone: 'good' }] },
        caption: 'Works until it does not',
      },
    },
    {
      title: 'Breaks',
      tag: 'tradeoff',
      heading: 'Where the simple design breaks',
      eli5: 'One librarian cannot carry 100 billion treasures. If the shelf room floods, every treasure is gone. And the card drawer cannot hold 100 billion cards.',
      body: [
        '**Capacity:** a server holds about 240 TB, so 100 PB needs hundreds of servers. **Durability:** one disk dies and the object is gone. A fleet of thousands loses disks every week.',
        '**Metadata:** 100 TB of rows and 50,000 requests a second do not fit one database. **Availability:** one server down means the whole store is down.',
      ],
      keyIdea: 'Capacity, durability, metadata size and availability all fail at once. Each needs its own fix.',
      metrics: { objects: '100 billion', data: '100 PB', rps: '50,000/s', dur: '1 disk', raw: '1x' },
      metricTones: { dur: 'bad', rps: 'bad' },
      scene: {
        nodes: [client, { ...fe, label: 'one server', sub: '240 TB max', status: 'hot', load: 98 }, { id: 'sql', kind: 'db', at: at(4, 3.5), label: 'SQL', sub: '100 TB?', status: 'down' }],
        links: [link('client', 'fe', { label: '50,000 req/s', labelTone: 'warn' }), link('fe', 'sql')],
        flows: [{ path: ['client', 'fe', 'sql'], tone: 'error', label: 'timeout', duration: 1.8 }],
        panel: {
          title: 'Four cracks',
          icon: 'Bug',
          rows: [
            { text: 'Capacity: 240 TB vs 100 PB', tone: 'bad' },
            { text: 'Durability: one disk, one copy', tone: 'bad' },
            { text: 'Metadata: 100 TB in one DB', tone: 'bad' },
            { text: 'Availability: one box', tone: 'bad' },
          ],
        },
        caption: 'Every limit is hit together',
      },
    },
    {
      title: 'Split planes',
      tag: 'concept',
      heading: 'Split into a front end, a metadata service and storage nodes',
      eli5: 'Hire three kinds of staff. Greeters at the door, a catalog office with the cards, and many shelf rooms with the treasures. Each can grow on its own.',
      body: [
        'The **front end** is stateless: it authenticates, parses the request and streams bytes. The **metadata service** maps keys to chunk locations. **Storage nodes** hold chunk bytes on disks.',
        'This is the control plane (metadata) apart from the data plane (bytes), as in the book chapter on distributed file systems. Bytes never pass through the metadata service.',
      ],
      keyIdea: 'Stateless front ends, a small metadata service and many dumb storage nodes. Each scales on its own.',
      metrics: { objects: '100 billion', data: '100 PB', rps: '50,000/s', dur: '?', raw: '?' },
      scene: {
        nodes: [client, fe, meta, n1, n2],
        links: [link('client', 'fe'), link('fe', 'meta', { label: 'control' }), link('fe', 'n1', { label: 'data' }), link('fe', 'n2')],
        flows: [
          { path: ['client', 'fe'], tone: 'request', duration: 1.2 },
          { path: ['fe', 'meta'], tone: 'request', label: 'where?', duration: 1.2, delay: 1.3 },
          { path: ['fe', 'n1'], tone: 'data', label: 'bytes', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'Three roles',
          icon: 'Split',
          rows: [
            { text: 'Front end', value: 'stateless, many' },
            { text: 'Metadata service', value: 'small, sharded' },
            { text: 'Storage nodes', value: 'disks, thousands' },
          ],
        },
        caption: 'Control plane and data plane',
      },
    },
    {
      title: 'Write path',
      tag: 'concept',
      heading: 'A PUT writes the bytes first and commits metadata last',
      eli5: 'The greeter puts the treasure on a shelf first. Only when it is safely there does the catalog office write the card. No card means the treasure does not exist yet.',
      body: [
        'The front end asks the metadata or placement service which storage nodes should take each chunk, then streams the body to them. It waits for every replica to acknowledge (or a quorum), and retries on another node if one fails. Only then does it write the metadata record. That write is the **commit point**.',
        'Before it, the object does not exist for any reader. After it, every reader sees it. A crash in between leaves stray bytes but never a half-visible object.',
      ],
      keyIdea: 'Bytes first, metadata last. The metadata write is the single moment the object becomes real.',
      metrics: { objects: '100 billion', data: '100 PB', rps: '50,000/s', dur: '?', raw: '?' },
      scene: {
        nodes: [{ ...client, chips: ['PUT a.jpg'] }, fe, meta, { ...n1, status: 'active' }],
        links: [link('client', 'fe'), link('fe', 'n1'), link('fe', 'meta')],
        flows: [
          { path: ['client', 'fe'], tone: 'request', label: '1 body', duration: 1.1 },
          { path: ['fe', 'n1'], tone: 'data', label: '2 bytes', duration: 1.1, delay: 1.2 },
          { path: ['n1', 'fe'], tone: 'response', label: '3 ack', duration: 1.0, delay: 2.4 },
          { path: ['fe', 'meta'], tone: 'request', label: '4 commit', duration: 1.1, delay: 3.5 },
          { path: ['fe', 'client'], tone: 'response', label: '5 200', duration: 1.1, delay: 4.7 },
        ],
        panel: {
          title: 'Order matters',
          icon: 'List',
          rows: [
            { text: '1 to 2 get target nodes, stream bytes' },
            { text: '3 wait for acks, retry a failed node' },
            { text: '4 write metadata', value: 'commit', tone: 'good' },
            { text: '5 answer 200' },
          ],
          footer: { text: 'Crash before step 4: no object, no harm', tone: 'good' },
        },
        caption: 'One commit makes it visible',
      },
      code: {
        language: 'typescript',
        title: 'PUT in the front end',
        source: `async function put(bucket: string, key: string, body: Readable) {
  const chunks = await writeChunks(body);      // bytes land on nodes, acked
  const etag = checksum(chunks);
  await metadata.commit({                      // the commit point
    bucket, key, versionId: newId(), chunks, etag,
  });
  return { status: 200, etag };
}`,
        highlight: [2, 4],
      },
      quiz: {
        question: 'Why does the front end write metadata only after the bytes are stored?',
        options: [
          'Metadata writes are slower than byte writes',
          'A crash in between then leaves stray bytes, never an object that points at missing data',
          'Storage nodes cannot accept writes before metadata exists',
          'It lets the client skip waiting for an answer',
        ],
        answer: 1,
        explain: 'The metadata record is the commit point. Writing it last means a visible object always has its bytes. The stray bytes from a crash are cleaned up later by garbage collection.',
      },
    },
    {
      title: 'Read path',
      tag: 'concept',
      heading: 'A GET looks up the chunks, then streams them back',
      eli5: 'A visitor asks for a treasure. The catalog office says which shelf rooms hold it. The greeter fetches it, checks it is not damaged, and hands it over.',
      body: [
        'The front end reads the metadata row, picks a healthy node for each chunk, and streams the bytes to the client. For a `Range` request it fetches only the chunks that overlap the range.',
        'Each chunk carries a checksum. If one fails to match, the front end reads another copy and the bad one is flagged for repair.',
      ],
      keyIdea: 'Metadata finds the chunks, nodes serve the bytes, and a checksum guards every read.',
      metrics: { objects: '100 billion', data: '100 PB', rps: '50,000/s', dur: '?', raw: '?' },
      scene: {
        nodes: [{ ...client, chips: ['GET a.jpg'] }, fe, meta, { ...n1, status: 'ok', badge: 'crc ok' }],
        links: [link('client', 'fe'), link('fe', 'meta'), link('fe', 'n1')],
        flows: [
          { path: ['client', 'fe', 'meta'], tone: 'request', label: '1 lookup', duration: 1.6 },
          { path: ['meta', 'fe', 'n1'], tone: 'response', label: '2 chunk on n1', duration: 1.6, delay: 1.7 },
          { path: ['n1', 'fe', 'client'], tone: 'data', label: '3 bytes', duration: 1.8, delay: 3.4 },
        ],
        panel: {
          title: 'Read steps',
          icon: 'Download',
          rows: [{ text: 'Find row by bucket + key' }, { text: 'Pick a healthy node' }, { text: 'Stream chunk, verify crc', tone: 'good' }],
        },
        caption: 'Lookup, fetch, verify',
      },
    },
    {
      title: 'Chunks',
      tag: 'concept',
      heading: 'Big objects are cut into fixed-size chunks',
      eli5: 'A giant treasure will not fit on one shelf, so the librarian cuts it into same-size pieces and spreads them over many shelves. The card lists every piece.',
      body: [
        'Each object is split into chunks of 64 MB (GFS used 64 MB, HDFS 128 MB). A 5 TB object is about 78,000 chunks, spread over thousands of disks, and read in parallel.',
        'The chunk map lives in the metadata row. Small objects are one short chunk. Chunking also lets a failed upload retry one chunk, not the whole file.',
      ],
      keyIdea: 'Fixed-size chunks spread one object over many disks and make reads, uploads and repairs parallel.',
      metrics: { objects: '100 billion', data: '100 PB', rps: '50,000/s', dur: '?', raw: '?' },
      scene: {
        nodes: [{ ...fe, chips: ['5 TB object'] }, { ...n1, chips: ['chunk 1', 'chunk 4'] }, { ...n2, chips: ['chunk 2', 'chunk 5'] }, { id: 'n3', kind: 'storage', at: at(-4, 3.5), label: 'node 3', sub: 'rack C', chips: ['chunk 3'] }],
        links: [link('fe', 'n3'), link('fe', 'n1'), link('fe', 'n2')],
        flows: [
          { path: ['fe', 'n3'], tone: 'data', label: '64 MB', duration: 1.4 },
          { path: ['fe', 'n1'], tone: 'data', label: '64 MB', duration: 1.4, delay: 0.2 },
          { path: ['fe', 'n2'], tone: 'data', label: '64 MB', duration: 1.4, delay: 0.4 },
        ],
        panel: {
          title: 'Chunk math',
          icon: 'Boxes',
          rows: [
            { text: 'Chunk size', value: '64 MB' },
            { text: '1 MB object', value: '1 chunk' },
            { text: '5 TB object', value: '~78,000 chunks' },
          ],
        },
        caption: 'Many chunks, many disks, in parallel',
      },
    },
    {
      title: 'Placement',
      tag: 'concept',
      heading: 'Each chunk goes to three nodes in different failure domains',
      eli5: 'The librarian keeps three copies of every piece, on shelves in different rooms. If one room floods, the other two still hold it.',
      body: [
        'A chunk is copied to three nodes on different racks, ideally in different zones, so one rack or building failing never takes every copy (see the replication lesson). Eleven nines comes from three copies plus fast repair of any lost one.',
        'The client does not send three copies. It sends one stream and the nodes **chain** it: node 1 forwards to node 2, then node 3. That uses every network card and keeps data flow apart from control flow.',
      ],
      keyIdea: 'Spread copies across racks and zones, and pipeline the bytes down a chain of replicas.',
      metrics: { objects: '100 billion', data: '100 PB', rps: '50,000/s', dur: '11 nines', raw: '3x' },
      metricTones: { raw: 'warn' },
      scene: {
        nodes: [fe, { ...n1, sub: 'zone A', status: 'active' }, { ...n2, sub: 'zone B' }, { id: 'n3', kind: 'storage', at: at(-4, 3.5), label: 'node 3', sub: 'zone C' }],
        links: [link('fe', 'n1'), link('n1', 'n2', { style: 'dashed' }), link('n2', 'n3', { style: 'dashed', route: 'straight' })],
        flows: [
          { path: ['fe', 'n1'], tone: 'data', label: 'chunk', duration: 1.2 },
          { path: ['n1', 'n2'], tone: 'data', label: 'forward', duration: 1.2, delay: 1.3 },
          { path: ['n2', 'n3'], tone: 'data', label: 'forward', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'Three copies',
          icon: 'Copy',
          rows: [
            { text: 'Copies', value: '3, in 3 zones' },
            { text: 'Disk used per byte', value: '3x', tone: 'warn' },
            { text: 'Survives', value: '2 lost copies', tone: 'good' },
          ],
        },
        caption: 'The write pipeline chains replicas',
      },
    },
    {
      title: 'Erasure coding',
      tag: 'tradeoff',
      heading: 'Erasure coding survives more losses for half the disk',
      eli5: 'Instead of three whole copies, the librarian cuts a treasure into 8 pieces and makes 4 magic spare pieces. Any 8 of the 12 rebuild it. That needs far fewer shelves.',
      body: [
        'With 8 data fragments and 4 parity fragments, any 8 of 12 rebuild the chunk. Four losses are survivable at **1.5x** disk instead of 3x. At 100 PB that saves roughly 150 PB of disk.',
        'The price: a read needs 8 fetches, and a repair reads 8 fragments to rebuild one. Stores often keep small or hot data as copies and big, colder data erasure coded.',
      ],
      keyIdea: 'Erasure coding trades extra reads and CPU for far less disk. Use it for big, colder data.',
      metrics: { objects: '100 billion', data: '100 PB', rps: '50,000/s', dur: '11 nines', raw: '1.5x' },
      metricTones: { raw: 'good', dur: 'good' },
      scene: {
        nodes: [{ ...fe, chips: ['chunk 64 MB'] }, { ...n1, label: '8 data', sub: 'fragments', chips: ['8 MB each'] }, { ...n2, label: '4 parity', sub: 'fragments', tint: 'violet' }],
        links: [link('fe', 'n1'), link('fe', 'n2')],
        flows: [
          { path: ['fe', 'n1'], tone: 'data', label: '8 pieces', count: 3, duration: 1.4 },
          { path: ['fe', 'n2'], tone: 'event', label: '4 parity', count: 2, duration: 1.4, delay: 0.3 },
        ],
        panel: {
          title: 'Copies vs 8 + 4',
          icon: 'Scale',
          rows: [
            { text: '3 copies: disk per byte', value: '3x', tone: 'warn' },
            { text: '8 + 4: disk per byte', value: '1.5x', tone: 'good' },
            { text: '100 PB stored as copies', value: '300 PB' },
            { text: '100 PB stored as 8 + 4', value: '150 PB', tone: 'good' },
            { text: 'Read cost', value: '8 fetches', tone: 'warn' },
          ],
        },
        caption: 'Half the disk, more work per read',
      },
    },
    {
      title: 'Recap 1',
      tag: 'recap',
      heading: 'Part 1 recap: the core, and what is still open',
      eli5: 'So far the library has greeters, a catalog office and many shelf rooms, and every treasure is cut up and kept safe in pieces. Next: a huge catalog and what happens when things fail.',
      body: [
        'We split control from data, wrote bytes first and committed metadata last, cut objects into chunks, and placed them across racks with copies or erasure coding.',
        'Open: the metadata service must shard to hold 100 TB, listing and hot keys, versioning, multipart, small objects, repair, and failures. That is part 2.',
      ],
      keyIdea: 'Bytes are chunked, spread and protected. The metadata service is the next bottleneck.',
      metrics: { objects: '100 billion', data: '100 PB', rps: '50,000/s', dur: '11 nines', raw: '1.5x' },
      metricTones: { dur: 'good', raw: 'good' },
      scene: {
        nodes: [client, fe, meta, n1, n2],
        links: [link('client', 'fe'), link('fe', 'meta'), link('fe', 'n1'), link('fe', 'n2')],
        flows: [
          { path: ['client', 'fe', 'n1'], tone: 'data', label: 'bytes', duration: 1.6 },
          { path: ['fe', 'meta'], tone: 'request', label: 'commit', duration: 1.2, delay: 1.7 },
        ],
        panel: {
          title: 'Decisions so far',
          icon: 'List',
          rows: [
            { text: 'Control plane vs data plane', tone: 'good' },
            { text: 'Commit metadata last', tone: 'good' },
            { text: '64 MB chunks', tone: 'good' },
            { text: '3 zones, 8 + 4 coding', tone: 'good' },
            { text: 'Metadata sharding', value: 'part 2', tone: 'warn' },
          ],
        },
        caption: 'Next: scale the catalog',
      },
      quiz: {
        question: 'A 64 MB chunk is stored as 8 data and 4 parity fragments. What is the disk cost per byte, and how many fragments can be lost?',
        options: ['3x, any 2', '1.5x, any 4', '1.5x, any 8', '1.25x, any 12'],
        answer: 1,
        explain: 'Twelve fragments for eight fragments of data is 1.5x. Any 8 of the 12 rebuild the chunk, so any 4 can be lost.',
      },
    },
  ],
};
