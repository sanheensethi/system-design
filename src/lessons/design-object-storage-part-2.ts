import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const fe: SceneNode = { id: 'fe', kind: 'block', at: at(0, -3.5), label: 'front end', sub: 'HTTP API', icon: 'Network', tint: 'violet' };
const m1: SceneNode = { id: 'm1', kind: 'block', size: 0.72, at: at(-4, 3.5), label: 'shard 1', sub: 'keys a to h', icon: 'Database', tint: 'amber' };
const m2: SceneNode = { id: 'm2', kind: 'block', size: 0.72, at: at(0, 3.5), label: 'shard 2', sub: 'keys i to p', icon: 'Database', tint: 'amber' };
const m3: SceneNode = { id: 'm3', kind: 'block', size: 0.72, at: at(4, 3.5), label: 'shard 3', sub: 'keys q to z', icon: 'Database', tint: 'amber' };
const n1: SceneNode = { id: 'n1', kind: 'storage', at: at(-4, 3.5), label: 'node 1', sub: 'zone A' };
const n2: SceneNode = { id: 'n2', kind: 'storage', at: at(0, 3.5), label: 'node 2', sub: 'zone B' };
const n3: SceneNode = { id: 'n3', kind: 'storage', at: at(4, 3.5), label: 'node 3', sub: 'zone C' };

export const designObjectStoragePart2: Lesson = {
  id: 'design-object-storage-part-2',
  title: 'Design S3-style object storage (part 2)',
  tagline: 'Shard the catalog, then survive hot keys, dead disks, lost zones, crashes and cost pressure.',
  minutes: 17,
  level: 'Advanced',
  learn: [
    'Sharding the metadata service, and why LIST pushes you toward range partitions',
    'Hot key ranges, strongly consistent metadata, versioning and delete markers',
    'Multipart uploads and packing small objects',
    'Checksums, scrubbing, repair and the failure cases: dead node, lost zone, crash mid-upload',
    'Garbage collection, auth and encryption, cross-region copies and storage tiers',
  ],
  metrics: [
    { key: 'meta', label: 'Metadata', icon: 'Database' },
    { key: 'rps', label: 'Peak requests', icon: 'Gauge' },
    { key: 'dur', label: 'Durability', icon: 'Shield' },
    { key: 'avail', label: 'Availability', icon: 'Activity' },
    { key: 'cost', label: 'Raw per 1 byte', icon: 'Layers' },
  ],
  steps: [
    {
      title: 'Catalog limit',
      tag: 'problem',
      heading: 'The catalog is now the bottleneck',
      eli5: 'The shelf rooms grew easily. But one catalog office with 100 billion cards and a queue out the door cannot keep up.',
      body: [
        'Part 1 left one metadata service. It holds 100 TB of rows and takes every `PUT`, `GET`, `LIST` and `DELETE`: 50,000 requests a second at peak.',
        'Adding disks to the bytes tier was easy. The catalog is different: every request touches it, and one machine cannot hold or serve that.',
      ],
      keyIdea: 'Bytes scale by adding nodes. Metadata is on the path of every request, so it must shard.',
      metrics: { meta: '100 TB', rps: '50,000/s', dur: '11 nines', avail: '99.99%', cost: '1.5x' },
      metricTones: { rps: 'bad', meta: 'bad' },
      scene: {
        nodes: [fe, { id: 'meta', kind: 'block', at: at(0, 3.5), label: 'metadata', sub: '100 TB', icon: 'Database', tint: 'amber', status: 'hot', load: 97 }],
        links: [link('fe', 'meta', { label: '50,000 req/s', labelTone: 'warn' })],
        flows: [{ path: ['fe', 'meta'], tone: 'error', label: 'slow', count: 3, duration: 1.4 }],
        panel: { title: 'One metadata box', icon: 'Gauge', rows: [{ text: 'Rows', value: '100 billion', tone: 'bad' }, { text: 'Requests', value: '50,000/s', tone: 'bad' }, { text: 'If it fails', value: 'everything stops', tone: 'bad' }] },
        caption: 'Every request waits in this queue',
      },
    },
    {
      title: 'Shard metadata',
      tag: 'concept',
      heading: 'Shard the metadata by bucket and key',
      eli5: 'Open many catalog offices. Each one owns a slice of the alphabet, and a signpost tells you which office to visit.',
      body: [
        'Split rows across shards by `(bucket, key)`. A small routing layer maps a key to its shard. The sharding and consistent hashing lessons cover the mechanics, and large stores partition metadata this way.',
        'A `GET` or `PUT` now touches exactly one shard. At 1 TB per shard, 100 TB needs about 100 shards, each serving a few hundred requests a second.',
      ],
      keyIdea: 'Route each key to one shard. Point reads and writes then scale by adding shards.',
      metrics: { meta: '100 shards', rps: '50,000/s', dur: '11 nines', avail: '99.99%', cost: '1.5x' },
      metricTones: { meta: 'good' },
      scene: {
        nodes: [fe, m1, m2, m3],
        links: [link('fe', 'm1'), link('fe', 'm2'), link('fe', 'm3')],
        flows: [
          { path: ['fe', 'm2'], tone: 'request', label: 'GET k=maple', duration: 1.5 },
          { path: ['m2', 'fe'], tone: 'response', label: 'row', duration: 1.5, delay: 1.6 },
        ],
        panel: { title: 'Routing', icon: 'Split', rows: [{ text: 'Hash or range of key', value: 'picks shard' }, { text: 'Rows per shard', value: '~1 billion' }, { text: 'Load per shard', value: '~500 req/s', tone: 'good' }] },
        caption: 'One key, one shard',
      },
    },
    {
      title: 'LIST problem',
      tag: 'tradeoff',
      heading: 'LIST wants sorted keys, and hashing scatters them',
      eli5: 'Visitors also ask "show me everything starting with photos/2026/". If cards are dealt to offices at random, every office has to be asked.',
      body: [
        '`LIST prefix=photos/2026/` must return keys in order. With hash partitioning, those keys sit on every shard, so a listing fans out to all of them and merges.',
        '**Range partitioning** keeps neighbors together: shard 1 owns `a` to `h`, and a prefix lives on one or two shards. The cost is that range boundaries must adapt to hot spots.',
      ],
      keyIdea: 'Hashing spreads load evenly but breaks ordered listing. Range partitions keep prefixes together.',
      metrics: { meta: '100 shards', rps: '50,000/s', dur: '11 nines', avail: '99.99%', cost: '1.5x' },
      scene: {
        nodes: [{ ...fe, chips: ['LIST photos/2026/'] }, m1, m2, m3],
        links: [link('fe', 'm1', { label: 'range', labelTone: 'good' }), link('fe', 'm2'), link('fe', 'm3')],
        flows: [{ path: ['fe', 'm2'], tone: 'request', label: 'prefix on 1 shard', duration: 1.5 }],
        panel: {
          title: 'Hash versus range',
          icon: 'Table',
          rows: [
            { text: 'Hash: point GET', value: '1 shard', tone: 'good' },
            { text: 'Hash: LIST prefix', value: 'all shards', tone: 'bad' },
            { text: 'Range: point GET', value: '1 shard', tone: 'good' },
            { text: 'Range: LIST prefix', value: '1 to 2 shards', tone: 'good' },
            { text: 'Range: hot keys', value: 'needs splitting', tone: 'warn' },
          ],
        },
        caption: 'Order or even spread, hard to get both',
      },
      quiz: {
        question: 'Why does a LIST by prefix push a store toward range partitioning of metadata?',
        options: ['Range partitions are faster for point reads', 'Keys with the same prefix sit on few shards, so no fan-out to all shards', 'Hashing cannot be used across zones', 'Range partitioning needs no routing table'],
        answer: 1,
        explain: 'Listing returns ordered keys under a prefix. Range partitions keep them together, so a listing touches one or two shards. The cost is that hot ranges must be split.',
      },
    },
    {
      title: 'Hot range',
      tag: 'case',
      heading: 'Case: a timestamp prefix makes one shard burn',
      eli5: 'A customer names every treasure with today\'s date. All new cards land in the same office, and that clerk is swamped while the others nap.',
      body: [
        'Keys like `logs/2026-11-17T10:42/...` all land at the end of the range. One shard takes every write while the rest idle. Customers are told to spread prefixes (see the object storage lessons on key design).',
        'The store also protects itself: it watches per-range load and **splits** a hot range in two, moving half to a new shard, automatically and with no downtime.',
      ],
      keyIdea: 'Sequential keys make a hot range. The store splits busy ranges, and good key design avoids them.',
      metrics: { meta: '101 shards', rps: '50,000/s', dur: '11 nines', avail: '99.99%', cost: '1.5x' },
      metricTones: { avail: 'warn' },
      scene: {
        nodes: [fe, { ...m1, load: 12 }, { ...m2, label: 'shard 2', sub: 'logs/2026-11', status: 'hot', load: 95, chips: ['10,000 writes/s'] }, { ...m3, load: 10 }],
        links: [link('fe', 'm1'), link('fe', 'm2'), link('fe', 'm3')],
        flows: [{ path: ['fe', 'm2'], tone: 'request', label: 'PUT logs/...', count: 3, duration: 1.2 }],
        panel: { title: 'Split rule', icon: 'Split', rows: [{ text: 'Range load above limit', tone: 'bad' }, { text: 'Split at median key' }, { text: 'Move half to a new shard' }, { text: 'Routing table updated', tone: 'good' }] },
        caption: 'Watch load, split ranges',
      },
    },
    {
      title: 'Consistent shards',
      tag: 'concept',
      heading: 'Each shard is replicated and strongly consistent',
      eli5: 'Each catalog office keeps three identical card drawers and a clerk vote. A card counts as written only when most drawers have it, so no reader gets an old answer.',
      body: [
        'Each shard is a small replica group run by consensus (see the consensus lesson): a leader orders writes and a majority must acknowledge. The commit point from part 1 is this majority write.',
        'Reads go to the leader or a caught-up replica, so a `GET` right after a `PUT` returns the new object. This gives strong read-after-write and listing consistency.',
      ],
      keyIdea: 'Consensus per shard makes the commit point durable and reads strongly consistent.',
      metrics: { meta: '101 shards x 3', rps: '50,000/s', dur: '11 nines', avail: '99.99%', cost: '1.5x' },
      scene: {
        nodes: [{ ...m2, label: 'leader', sub: 'shard 2', status: 'active' }, { ...m1, id: 'f1', label: 'follower', sub: 'zone A' }, { ...m3, id: 'f2', label: 'follower', sub: 'zone C' }],
        links: [link('m2', 'f1', { label: 'log' }), link('m2', 'f2')],
        flows: [
          { path: ['m2', 'f1'], tone: 'data', label: 'append', duration: 1.3 },
          { path: ['m2', 'f2'], tone: 'data', label: 'append', duration: 1.3, delay: 0.1 },
          { path: ['f1', 'm2'], tone: 'response', label: 'ack', duration: 1.1, delay: 1.5 },
        ],
        panel: { title: 'Majority commit', icon: 'Shield', rows: [{ text: 'Replicas per shard', value: '3' }, { text: 'Acks needed', value: '2', tone: 'good' }, { text: 'GET after PUT', value: 'new object', tone: 'good' }] },
        caption: 'Two of three drawers must agree',
      },
    },
    {
      title: 'Versioning',
      tag: 'concept',
      heading: 'Versioning and delete markers live in metadata',
      eli5: 'Keep every old card instead of erasing it. "Throw away" just adds a new card on top that says deleted. The older treasure is still on its shelf.',
      body: [
        'With versioning on, each `PUT` adds a row `(bucket, key, versionId)` and the newest becomes current. Old bytes stay. `GET key` reads the latest row. `GET key?version=v1` reads an old one.',
        'A `DELETE` writes a **delete marker** as the newest version. The object looks gone, yet older versions remain and can be restored by removing the marker.',
      ],
      keyIdea: 'Versions are extra metadata rows. A delete is a marker row, not an erase.',
      metrics: { meta: '101 shards x 3', rps: '50,000/s', dur: '11 nines', avail: '99.99%', cost: '1.5x' },
      scene: {
        nodes: [{ ...fe, chips: ['DELETE a.jpg'] }, { ...m2, at: at(-3.5, 3.5), size: 1, chips: ['v3 delete marker', 'v2', 'v1'] }, { ...n2, at: at(3.5, 3.5), label: 'bytes', sub: 'v1, v2 kept' }],
        links: [link('fe', 'm2'), link('m2', 'n2', { style: 'dashed' })],
        flows: [{ path: ['fe', 'm2'], tone: 'request', label: 'write marker', duration: 1.5 }],
        panel: { title: 'Key a.jpg', icon: 'Table', rows: [{ text: 'v3', value: 'delete marker', tone: 'warn' }, { text: 'v2', value: '1.2 MB' }, { text: 'v1', value: '1.0 MB' }, { text: 'GET a.jpg', value: '404', tone: 'warn' }] },
        caption: 'Newest row wins',
      },
    },
    {
      title: 'Multipart',
      tag: 'concept',
      heading: 'Multipart upload: parts first, one commit to finish',
      eli5: 'A giant treasure arrives in parts. The librarian shelves each part as it comes and keeps a pending list. When the owner says done, the card is written all at once.',
      body: [
        '`CreateMultipartUpload` returns an `uploadId`. Create writes an upload record in metadata, and each part is registered under it. Parts upload on their own, in parallel and retryable, and stay invisible to readers.',
        '`Complete` sends the part list. The service checks every part, builds one chunk map, and commits one row. Until then nothing is readable. `Abort` frees the parts. Parts must be 5 MB to 5 GB with at most 10,000 parts, so a 5 TB object needs parts of at least about 500 MB.',
      ],
      keyIdea: 'Parts are stored invisibly. Complete is one metadata commit that makes the whole object appear.',
      metrics: { meta: '101 shards x 3', rps: '50,000/s', dur: '11 nines', avail: '99.99%', cost: '1.5x' },
      scene: {
        nodes: [{ id: 'client', kind: 'client', at: at(-4.5, -3.5), label: 'client', sub: 'uploader' }, { ...fe, chips: ['upload u-81'] }, { ...n1, at: at(-1, 4), chips: ['parts 1, 3'] }, { ...n2, at: at(4, 3.5), chips: ['part 2'] }],
        links: [link('client', 'fe'), link('fe', 'n1'), link('fe', 'n2')],
        flows: [
          { path: ['client', 'fe', 'n1'], tone: 'data', label: 'part 1, 3', count: 2, duration: 1.6 },
          { path: ['client', 'fe', 'n2'], tone: 'data', label: 'part 2', duration: 1.6, delay: 0.3 },
        ],
        panel: { title: 'Lifecycle', icon: 'List', rows: [{ text: 'Create', value: 'uploadId' }, { text: 'Part size 5 MB to 5 GB, max 10,000 parts' }, { text: 'Upload parts', value: 'parallel' }, { text: 'Complete', value: 'one commit', tone: 'good' }, { text: 'Abort or expire', value: 'free parts' }] },
        caption: 'Invisible until Complete',
      },
    },
    {
      title: 'Small objects',
      tag: 'tradeoff',
      heading: 'Billions of tiny objects need packing',
      eli5: 'A million tiny stickers, each in its own big box, would waste the shelves and swamp the catalog. So the librarian pastes many stickers into one album.',
      body: [
        'A million tiny objects mean a million chunk records and seeks, plus allocation overhead for each. Small objects are **packed** into large append-only files.',
        'Metadata then stores `(file, offset, length)`. Deletes leave holes that a background **compaction** reclaims by copying live objects into a new file.',
      ],
      keyIdea: 'Pack small objects into big append-only files, and compact them later to reclaim deleted space.',
      metrics: { meta: '101 shards x 3', rps: '50,000/s', dur: '11 nines', avail: '99.99%', cost: '1.5x' },
      scene: {
        nodes: [{ ...fe, chips: ['PUT 4 KB'] }, { ...m2, at: at(-3.5, 3.5), chips: ['file 7, off 8192'] }, { ...n2, at: at(3.5, 3.5), label: 'pack file 7', sub: '64 MB, append only', chips: ['1,200 objects'] }],
        links: [link('fe', 'n2', { label: 'append' }), link('fe', 'm2')],
        flows: [{ path: ['fe', 'n2'], tone: 'data', label: 'append', duration: 1.4 }, { path: ['fe', 'm2'], tone: 'request', label: 'file, offset', duration: 1.4, delay: 1.5 }],
        panel: { title: 'Pack record', icon: 'Boxes', rows: [{ text: 'file', value: '7' }, { text: 'offset', value: '8192' }, { text: 'length', value: '4096' }, { text: 'Compaction', value: 'later', tone: 'muted' }] },
        caption: 'One big file, many tiny objects',
      },
      quiz: {
        question: 'What does metadata store for an object packed into a pack file?',
        options: ['The whole 64 MB pack file', '(file, offset, length)', 'A separate chunk per object', 'Only the checksum'],
        answer: 1,
        explain: 'The object lives inside a shared append-only file, so metadata records which file, where it starts and how long it is. Compaction later rewrites live objects into a new file and updates these records.',
      },
    },
    {
      title: 'Checksums',
      tag: 'concept',
      heading: 'Checksums on every read, and a scrubber for cold data',
      eli5: 'Every piece has a tiny stamp. A helper walks the shelves all night, checking stamps, so a damaged piece is found before anyone asks for it.',
      body: [
        'Disks silently flip bits. Every chunk stores a checksum, verified on each read and each write. A mismatch means the front end reads another copy and the bad one is queued for repair.',
        'Cold data may not be read for years, so a background **scrubber** reads every chunk every few weeks and verifies it. Without it, rot would pile up unseen until too many copies were bad.',
      ],
      keyIdea: 'Verify on every read, and scrub in the background so silent damage is repaired early.',
      metrics: { meta: '101 shards x 3', rps: '50,000/s', dur: '11 nines', avail: '99.99%', cost: '1.5x' },
      scene: {
        nodes: [{ ...fe, chips: ['GET a.jpg'] }, { ...n1, status: 'hot', badge: 'crc bad' }, { ...n2, status: 'ok', badge: 'crc ok' }],
        links: [link('fe', 'n1'), link('fe', 'n2')],
        flows: [
          { path: ['fe', 'n1'], tone: 'error', label: 'mismatch', duration: 1.4 },
          { path: ['fe', 'n2'], tone: 'data', label: 'read another copy or rebuild from fragments', duration: 1.4, delay: 1.5 },
        ],
        panel: { title: 'Integrity', icon: 'Shield', rows: [{ text: 'Verify on read', tone: 'good' }, { text: 'Verify on write', tone: 'good' }, { text: 'Scrub every chunk', value: 'every few weeks' }, { text: 'Bad copy', value: 'queued for repair', tone: 'warn' }] },
        caption: 'Bad copy found, good copy served',
      },
    },
    {
      title: 'Node dies',
      tag: 'case',
      heading: 'Failure: a node dies, and repair runs everywhere at once',
      eli5: 'A shelf room goes dark. Helpers notice, look up which pieces were there, and every other room makes a fresh copy at the same time.',
      body: [
        'Storage nodes send **heartbeats** to the control plane (see the failure detection lesson). Missed beats for a short timeout mark a node dead, so a reboot does not trigger mass copying. The metadata then lists every chunk it held.',
        'Chunks are spread over thousands of nodes, so thousands of peers each copy a small share. A 20 TB disk rebuilds in minutes to hours, not days. Faster repair means a smaller window for a second failure.',
      ],
      keyIdea: 'Wide spreading makes repair parallel. A short repair window is what keeps durability high.',
      metrics: { meta: '101 shards x 3', rps: '50,000/s', dur: '11 nines', avail: '99.99%', cost: '1.5x' },
      scene: {
        nodes: [{ ...n1, status: 'down', badge: 'no heartbeat' }, { ...n2, status: 'ok', chips: ['copying 10 GB'] }, { ...n3, status: 'ok', chips: ['copying 10 GB'] }, { id: 'ctl', kind: 'monitor', at: at(0, -3.5), label: 'repair queue', sub: '20 TB to rebuild' }],
        links: [link('ctl', 'n2'), link('ctl', 'n3')],
        flows: [
          { path: ['ctl', 'n2'], tone: 'event', label: 'rebuild', duration: 1.3 },
          { path: ['ctl', 'n3'], tone: 'event', label: 'rebuild', duration: 1.3, delay: 0.2 },
          { path: ['n2', 'n3'], tone: 'data', label: 'new copy', duration: 1.3, delay: 1.5 },
        ],
        panel: { title: 'Repair math', icon: 'Timer', rows: [{ text: 'Lost data', value: '20 TB' }, { text: 'Helpers copying', value: '~2,000 nodes' }, { text: 'Per helper', value: '~10 GB' }, { text: 'Back to 3 copies', value: 'minutes', tone: 'good' }] },
        caption: 'Everyone shares the rebuild',
      },
    },
    {
      title: 'Zone lost',
      tag: 'case',
      heading: 'Failure: a whole zone goes dark',
      eli5: 'A whole wing of the library loses power. Treasures are still readable from the other two wings, and the library keeps serving visitors.',
      body: [
        'Copies sit in three zones and erasure fragments spread across three or more. Losing one zone leaves two copies of every replicated chunk, and enough fragments to rebuild the coded ones. Reads continue, a little slower.',
        'Writes still reach a majority of metadata replicas in the other zones. Repair then rebuilds missing copies if the zone stays out. A single-zone loss costs no data and no availability.',
      ],
      keyIdea: 'Place copies and metadata replicas across zones, so one zone is a slow day and not an outage.',
      metrics: { meta: '101 shards x 3', rps: '50,000/s', dur: '11 nines', avail: '99.99%', cost: '1.5x' },
      metricTones: { avail: 'good' },
      scene: {
        nodes: [fe, { ...n1, status: 'down', badge: 'zone A out' }, { ...n2, status: 'ok' }, { ...n3, status: 'ok' }],
        links: [link('fe', 'n1'), link('fe', 'n2'), link('fe', 'n3')],
        flows: [
          { path: ['fe', 'n2'], tone: 'request', label: 'GET', duration: 1.4 },
          { path: ['n2', 'fe'], tone: 'response', label: 'bytes', duration: 1.4, delay: 1.5 },
        ],
        panel: { title: 'One zone out', icon: 'Activity', rows: [{ text: 'Copies left', value: '2 of 3', tone: 'good' }, { text: 'Data lost', value: '0', tone: 'good' }, { text: 'Reads', value: 'served', tone: 'good' }, { text: 'Second zone lost', value: 'data at risk', tone: 'bad' }] },
        caption: 'Two zones still hold everything',
      },
    },
    {
      title: 'Orphans, GC',
      tag: 'case',
      heading: 'Failure: a crash mid-upload, and garbage collection',
      eli5: 'A visitor drops a treasure on the shelf and walks off before the card is written. A night helper compares shelves against cards and clears what no card claims.',
      body: [
        'If a front end dies between storing bytes and the metadata commit, the chunks are **orphans**. Deleted objects, aborted multipart parts and overwritten versions also leave unreferenced chunks.',
        'A **garbage collector** lists chunks on nodes, checks each against metadata, and deletes unreferenced ones. Chunks referenced by an open upload record are live until Complete, Abort or expiry. A 24 h grace period applies only to single PUTs in flight.',
      ],
      keyIdea: 'Metadata is the source of truth. Anything unreferenced and old enough is garbage.',
      metrics: { meta: '101 shards x 3', rps: '50,000/s', dur: '11 nines', avail: '99.99%', cost: '1.5x' },
      scene: {
        nodes: [{ id: 'gc', kind: 'worker', at: at(-4.5, -3.5), label: 'garbage collector', sub: 'nightly' }, { ...m2, at: at(0, -3.5), size: 0.72 }, { ...n2, at: at(4, 3.5), chips: ['orphan chunk c77'], status: 'dim' }],
        links: [link('gc', 'm2', { label: 'is c77 used?' }), link('gc', 'n2', { label: 'delete', style: 'dashed' })],
        flows: [
          { path: ['gc', 'm2'], tone: 'request', label: 'c77?', duration: 1.3 },
          { path: ['m2', 'gc'], tone: 'response', label: 'unknown', duration: 1.3, delay: 1.4 },
          { path: ['gc', 'n2'], tone: 'event', label: 'delete if older than 24 h', duration: 1.5, delay: 2.9 },
        ],
        panel: { title: 'GC rules', icon: 'List', rows: [{ text: 'Chunk with no metadata row or open upload' }, { text: 'Single PUT older than the grace period', value: '24 h' }, { text: 'Then delete', tone: 'good' }, { text: 'Open multipart parts', value: 'left alone', tone: 'muted' }] },
        caption: 'Check, wait, delete',
      },
    },
    {
      title: 'Auth, encryption',
      tag: 'concept',
      heading: 'Access control and encryption at rest',
      eli5: 'The door guard checks each visitor\'s pass and the room rules before anything moves. The treasures are also sealed in locked boxes, and the keys sit in a separate safe.',
      body: [
        'Every request is authenticated (signed, see the authentication lesson) and checked against bucket and object policies before the front end touches data. Pre-signed URLs carry a signature and an expiry.',
        'Chunks are encrypted at rest with a per-object data key, and that key is wrapped by a master key in a key service (see the encryption lesson). Stolen disks then hold only ciphertext.',
      ],
      keyIdea: 'Check policy before reading any data, and encrypt chunks with keys that live in a separate vault.',
      metrics: { meta: '101 shards x 3', rps: '50,000/s', dur: '11 nines', avail: '99.99%', cost: '1.5x' },
      scene: {
        nodes: [{ id: 'client', kind: 'client', at: at(-4.5, -3.5), label: 'client', sub: 'signed request' }, { ...fe, chips: ['policy: allow'] }, { id: 'kms', kind: 'vault', at: at(-1, 3.5), label: 'key service', sub: 'master keys' }, { ...n2, at: at(4, 3.5), sub: 'ciphertext only' }],
        links: [link('client', 'fe'), link('fe', 'kms'), link('fe', 'n2')],
        flows: [
          { path: ['client', 'fe'], tone: 'request', label: 'signed GET', duration: 1.2 },
          { path: ['fe', 'kms'], tone: 'handshake', label: 'unwrap key', duration: 1.2, delay: 1.3 },
          { path: ['n2', 'fe'], tone: 'data', label: 'decrypt', duration: 1.2, delay: 2.6 },
        ],
        panel: { title: 'Per request', icon: 'Key', rows: [{ text: 'Verify signature', tone: 'good' }, { text: 'Check bucket policy', tone: 'good' }, { text: 'Unwrap data key', tone: 'good' }, { text: 'Decrypt and stream' }] },
        caption: 'Policy first, keys in a vault',
      },
    },
    {
      title: 'Cross region',
      tag: 'concept',
      heading: 'Cross-region replication for a lost region',
      eli5: 'A second library in another city gets a copy of the cards and treasures a little later. If the first city floods, the second one still has everything.',
      body: [
        'Zones survive a building. A lost **region** needs a copy elsewhere. Replication is asynchronous: the commit finishes in the home region and an event queue ships the object over (see the multi-region lesson).',
        'The trade is a lag of seconds to minutes. Objects committed just before the region failed may not have arrived. Customers who need less lag pay for faster replication.',
      ],
      keyIdea: 'Cross-region copies are asynchronous: cheap and safe against disasters, at the cost of a small gap.',
      metrics: { meta: '101 shards x 3', rps: '50,000/s', dur: '11 nines', avail: '99.99%', cost: '3x' },
      metricTones: { cost: 'warn' },
      scene: {
        nodes: [{ ...fe, label: 'region A', sub: 'home' }, { id: 'q', kind: 'queue', at: at(0, 3.5), label: 'replication', sub: 'event queue' }, { id: 'feb', kind: 'block', at: at(4.5, -3.5), label: 'region B', sub: 'copy', icon: 'Globe', tint: 'teal' }],
        links: [link('fe', 'q'), link('q', 'feb', { label: 'async, seconds behind', labelTone: 'warn' })],
        flows: [
          { path: ['fe', 'q'], tone: 'event', label: 'object committed', duration: 1.3 },
          { path: ['q', 'feb'], tone: 'data', label: 'copy', duration: 1.6, delay: 1.5 },
        ],
        panel: { title: 'Region pair', icon: 'Globe', rows: [{ text: 'Replication', value: 'async' }, { text: 'Typical lag', value: 'seconds', tone: 'warn' }, { text: 'Region lost', value: 'failover to B', tone: 'good' }] },
        caption: 'Safe across regions, a little behind',
      },
    },
    {
      title: 'Cold tiers',
      tag: 'tradeoff',
      heading: 'Cost: move cold data to cheaper storage',
      eli5: 'Treasures nobody asks for go to the back warehouse. Fetching them takes longer, but the rent is much lower.',
      body: [
        'Most bytes are cold. A lifecycle policy moves objects by age to cheaper tiers: bigger erasure-coded stripes, slower disks, denser racks. Metadata still says where they are, so the key never changes.',
        'The cost is slower first byte and sometimes a retrieval fee. See the object storage lessons for the customer view. For the provider, tiers turn the 1.5x raw overhead into a lever over the bill.',
      ],
      keyIdea: 'Age drives placement: hot data on fast media, cold data coded wide on cheap disks.',
      metrics: { meta: '101 shards x 3', rps: '50,000/s', dur: '11 nines', avail: '99.99%', cost: '1.4x cold' },
      metricTones: { cost: 'good' },
      scene: {
        nodes: [{ ...m2, at: at(0, -3.5), chips: ['age 90 days'] }, { ...n1, label: 'hot tier', sub: 'copies, fast disks' }, { ...n3, label: 'cold tier', sub: 'wide coding, dense' }],
        links: [link('m2', 'n1'), link('m2', 'n3', { label: 'lifecycle move' })],
        flows: [{ path: ['n1', 'n3'], tone: 'data', label: 'after 90 days', duration: 1.8 }],
        panel: { title: 'Tier trade', icon: 'Receipt', rows: [{ text: 'Hot: 3 copies', value: '3x raw' }, { text: 'Warm: 8 + 4', value: '1.5x raw' }, { text: 'Cold: 10 + 4 on dense disks', value: '1.4x raw', tone: 'good' }, { text: 'Cold first byte', value: 'slower', tone: 'warn' }] },
        caption: 'Colder means cheaper per byte',
      },
    },
    {
      title: 'Recap 2',
      tag: 'recap',
      heading: 'The whole design on one page',
      eli5: 'The library has greeters, sharded catalog offices with three drawers each, many shelf rooms in different wings, night helpers that check and clean, and a sister library in another city.',
      body: [
        'Stateless front ends stream bytes to storage nodes and commit metadata last. Metadata is range-sharded, replicated by consensus and split when hot. Objects are chunked, placed across zones, copied or erasure coded.',
        'Checksums, a scrubber, parallel repair and garbage collection keep eleven nines. Versioning, multipart, packing, encryption, cross-region copies and tiers cover the rest.',
      ],
      keyIdea: 'Split control from data, commit last, spread across failure domains, and repair fast.',
      metrics: { meta: '101 shards x 3', rps: '50,000/s', dur: '11 nines', avail: '99.99%', cost: '1.5x' },
      metricTones: { dur: 'good', avail: 'good', cost: 'good' },
      scene: {
        nodes: [{ id: 'client', kind: 'client', at: at(-4.5, -3.5), label: 'client', sub: 'SDK' }, fe, m1, n2, n3],
        links: [link('client', 'fe'), link('fe', 'm1'), link('fe', 'n2'), link('fe', 'n3')],
        flows: [
          { path: ['client', 'fe', 'n2'], tone: 'data', label: 'bytes', duration: 1.6 },
          { path: ['fe', 'm1'], tone: 'request', label: 'commit', duration: 1.2, delay: 1.7 },
        ],
        panel: { title: 'Design summary', icon: 'List', rows: [{ text: 'Front end, metadata, nodes', tone: 'good' }, { text: 'Range shards, consensus', tone: 'good' }, { text: 'Copies or 8 + 4 across zones', tone: 'good' }, { text: 'Scrub, repair, GC', tone: 'good' }, { text: 'Async cross-region, tiers', tone: 'good' }] },
        caption: 'Durability from layers, not one trick',
      },
      quiz: {
        question: 'A front end crashes after storing a chunk but before the metadata commit. What happens to the chunk?',
        options: ['Readers see a corrupt object', 'It is an orphan that the garbage collector removes after a grace period', 'The metadata service rolls back automatically', 'It is kept forever as a version'],
        answer: 1,
        explain: 'No metadata row means no object exists, so readers never see it. The chunk is unreferenced, and garbage collection deletes it once it is older than the grace period.',
      },
    },
  ],
};
