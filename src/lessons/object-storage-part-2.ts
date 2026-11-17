import type { Lesson, SceneLink, SceneNode, SceneZone } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });
/** A floor zone around a node placed at (d, s). */
const zone = (id: string, d: number, s: number, label: string, tone: SceneZone['tone']): SceneZone => {
  const [x, y] = at(d, s);
  return { id, from: [x - 1.3, y - 1.3], to: [x + 1.3, y + 1.3], label, tone };
};

const api: SceneNode = { id: 'api', kind: 'gateway', at: at(0, -4.2), label: 'storage API', sub: 'inside the store' };
const zA: SceneNode = { id: 'zA', kind: 'storage', at: at(-4, 3), label: 'zone A', tint: 'blue' };
const zB: SceneNode = { id: 'zB', kind: 'storage', at: at(0, 3), label: 'zone B', tint: 'violet' };
const zC: SceneNode = { id: 'zC', kind: 'storage', at: at(4, 3), label: 'zone C', tint: 'green' };
const zones: SceneZone[] = [zone('za', -4, 3, 'building A', 'blue'), zone('zb', 0, 3, 'building B', 'violet'), zone('zc', 4, 3, 'building C', 'green')];

const phone: SceneNode = { id: 'phone', kind: 'phone', at: at(-4, -2.5), label: 'photo app', sub: '200K uploads/day' };
const app: SceneNode = { id: 'app', kind: 'block', at: at(0, -2.5), label: 'app servers', sub: 'JSON API', icon: 'Server', tint: 'violet' };
const bucket: SceneNode = { id: 'bucket', kind: 'storage', at: at(0, 2.8), label: 'bucket', sub: 'photos-prod', tint: 'teal' };
const warm: SceneNode = { id: 'warm', kind: 'storage', at: at(0, 2.8), label: 'infrequent', sub: 'after 30 days' };
const cold: SceneNode = { id: 'cold', kind: 'storage', at: at(4, 2.8), label: 'archive', sub: 'backups' };
const cdn: SceneNode = { id: 'cdn', kind: 'cdn', at: at(0, -2.5), label: 'CDN edge', sub: 'Sydney' };

export const objectStoragePart2: Lesson = {
  id: 'object-storage-part-2',
  title: 'Object storage (part 2)',
  tagline: 'How the store keeps bytes alive, how to cut the bill, how to serve them fast, and when not to use it.',
  minutes: 15,
  level: 'Intermediate',
  learn: [
    'How replication and erasure coding keep objects safe, and what each costs in disk',
    'Versioning and cross-region copies for human mistakes and lost regions',
    'Storage classes, lifecycle rules, and a CDN in front of the bucket',
    'Upload events, encryption and access control, and when object storage is the wrong tool',
  ],
  metrics: [
    { key: 'raw', label: 'Disk per 1 TB', icon: 'HardDrive' },
    { key: 'cost', label: 'Storage bill', icon: 'Receipt' },
    { key: 'read', label: 'Read latency', icon: 'Timer' },
    { key: 'safe', label: 'Survives', icon: 'Shield' },
  ],
  steps: [
    {
      title: 'Disks die',
      tag: 'problem',
      heading: 'Disks die every day, and objects must not',
      eli5: 'The art cupboard has thousands of shelves, and some shelves collapse every day. The keeper still promises that no painting is ever lost.',
      body: [
        'Inside the store sit thousands of ordinary disks, and in a fleet that size some of them fail every day. **Durability** is the promise that a stored object is not lost.',
        'It is a different promise from **availability**, which is whether you can reach the object right now. S3 advertises eleven nines of durability: with 10 million objects you would expect to lose one about every 10,000 years.',
      ],
      keyIdea: 'Durability is about never losing data. Availability is about reaching it now. Disk failure threatens the first.',
      metrics: { raw: '-', cost: '-', read: '-', safe: '?' },
      metricTones: { safe: 'bad' },
      scene: {
        nodes: [
          { ...api, status: 'active' },
          { id: 'd1', kind: 'storage', at: at(-4, 3), label: 'disk 1', sub: 'one copy', status: 'down', badge: 'failed' },
          { id: 'd2', kind: 'storage', at: at(0, 3), label: 'disk 2', status: 'ok' },
          { id: 'd3', kind: 'storage', at: at(4, 3), label: 'disk 3', status: 'ok' },
        ],
        links: [link('api', 'd1'), link('api', 'd2'), link('api', 'd3')],
        flows: [{ path: ['api', 'd1'], tone: 'error', label: 'object lost?', duration: 1.6 }],
        panel: {
          title: 'Two different promises',
          icon: 'Shield',
          rows: [
            { text: 'Durability', value: 'never lose it', tone: 'good' },
            { text: 'Availability', value: 'reach it now' },
            { text: 'S3 durability', value: '99.999999999%' },
            { text: 'Disks failing in a big fleet', value: 'every day', tone: 'warn' },
          ],
        },
        caption: 'One disk dies, the object must survive',
      },
    },
    {
      title: 'Three copies',
      tag: 'concept',
      heading: 'Durability by replication',
      eli5: 'The school photocopies every painting and keeps one copy in each of three buildings. Making those copies is **replication**. If one building floods, two copies are still safe.',
      body: [
        '**Replication** writes three full copies on nodes in three **zones**, which are separate buildings with their own power and network. The `PUT` is acknowledged once the copies are safely on disk.',
        'A background scrubber rereads objects, compares checksums, and makes a fresh copy when a disk dies or a copy rots. Reads are cheap, since any one copy is the whole object.',
      ],
      keyIdea: 'Three copies in three zones survive a dead disk or a lost building.',
      metrics: { raw: '3 TB', cost: '-', read: '-', safe: '2 losses' },
      metricTones: { raw: 'warn', safe: 'good' },
      scene: {
        zones,
        nodes: [{ ...api, status: 'active', badge: 'write 3 copies' }, { ...zA, status: 'ok', badge: 'copy 1' }, { ...zB, status: 'ok', badge: 'copy 2' }, { ...zC, status: 'ok', badge: 'copy 3' }],
        links: [link('api', 'zA'), link('api', 'zB'), link('api', 'zC')],
        flows: [
          { path: ['api', 'zA'], tone: 'data', label: 'PUT 5 MB', duration: 1.2 },
          { path: ['api', 'zB'], tone: 'data', duration: 1.5 },
          { path: ['api', 'zC'], tone: 'data', duration: 1.8 },
          { path: ['zA', 'api'], tone: 'handshake', label: 'stored x3', duration: 1, delay: 2 },
        ],
        panel: {
          title: 'Cost of three copies',
          icon: 'Copy',
          rows: [
            { text: 'Stored', value: '1 TB' },
            { text: 'Raw disk used', value: '3 TB', tone: 'warn' },
            { text: 'Survives', value: '2 lost copies', tone: 'good' },
          ],
        },
        caption: 'Inside the store: one full copy per zone',
      },
    },
    {
      title: 'Erasure coding',
      tag: 'concept',
      heading: 'Cut into fragments and add parity',
      eli5: 'Cut the painting into 4 puzzle pieces and make 2 clever spare pieces. Any 4 of the 6 can rebuild the picture. That trick is **erasure coding**, and it needs far less paper than three whole copies.',
      body: [
        '**Erasure coding** cuts an object into data fragments and computes extra parity fragments from them. With a 4 + 2 scheme a 4 MB object becomes four 1 MB data fragments plus two 1 MB parity fragments, two per zone.',
        '**Any 4 of the 6** are enough to rebuild the object. That uses **1.5 TB of raw disk per 1 TB** stored.',
      ],
      keyIdea: 'Four data fragments plus two parity fragments, spread over three zones, rebuild from any four.',
      metrics: { raw: '1.5 TB', cost: '-', read: '-', safe: '2 losses' },
      metricTones: { raw: 'good', safe: 'good' },
      scene: {
        zones,
        nodes: [
          { ...api, status: 'active', badge: 'encode 4 + 2' },
          { ...zA, status: 'ok', badge: 'data 1, data 2' },
          { ...zB, status: 'ok', badge: 'data 3, data 4' },
          { ...zC, status: 'ok', badge: 'parity 1, 2' },
        ],
        links: [link('api', 'zA'), link('api', 'zB'), link('api', 'zC')],
        flows: [
          { path: ['api', 'zA'], tone: 'data', label: '2 fragments', duration: 1.2 },
          { path: ['api', 'zB'], tone: 'data', label: '2 fragments', duration: 1.4 },
          { path: ['api', 'zC'], tone: 'data', label: '2 parity', duration: 1.6 },
        ],
        panel: {
          title: '4 MB object, 4 + 2',
          icon: 'Binary',
          rows: [
            { text: 'Data fragments', value: '4 x 1 MB' },
            { text: 'Parity fragments', value: '2 x 1 MB' },
            { text: 'Raw disk per 1 TB', value: '1.5 TB', tone: 'good' },
            { text: 'Needed to rebuild', value: 'any 4 of 6', tone: 'good' },
          ],
        },
        caption: 'Six fragments, two in each zone',
      },
    },
    {
      title: 'Zone lost',
      tag: 'case',
      heading: 'A whole zone goes dark and the object survives',
      eli5: 'A whole building floods. The puzzle pieces in the other two buildings are still enough: any 4 of the 6 rebuild the picture.',
      body: [
        'Zone B loses power, taking two fragments with it. Four fragments remain in zones A and C. That is enough, so reads keep working and the store rebuilds the missing pieces on healthy nodes.',
        'Three copies used 3 TB to survive two losses. This layout survives the same two losses on 1.5 TB.',
      ],
      keyIdea: 'Any two fragments can vanish, including a whole zone, and the object still rebuilds from the other four.',
      metrics: { raw: '1.5 TB', cost: '-', read: '-', safe: '2 losses' },
      metricTones: { raw: 'good', safe: 'good' },
      scene: {
        zones,
        nodes: [
          { ...api, status: 'active', badge: 'rebuild from 4' },
          { ...zA, status: 'ok', badge: 'data 1, 2' },
          { ...zB, status: 'down', badge: 'power lost' },
          { ...zC, status: 'ok', badge: 'parity 1, 2' },
        ],
        links: [link('api', 'zA'), link('api', 'zB', { style: 'faint' }), link('api', 'zC')],
        flows: [
          { path: ['zA', 'api'], tone: 'data', label: '2 fragments', duration: 1.2 },
          { path: ['zC', 'api'], tone: 'data', label: '2 fragments', duration: 1.4 },
          { path: ['api', 'zB'], tone: 'error', label: 'zone B is dark', duration: 1.2, delay: 0.3 },
        ],
        caption: 'Zone B is gone. Any 4 fragments rebuild the object.',
      },
    },
    {
      title: 'Coding costs',
      tag: 'tradeoff',
      heading: 'Erasure coding trades CPU and reads for disk',
      eli5: 'Rebuilding a picture from puzzle pieces takes more work than reading one photocopy. So the school photocopies the paintings that kids look at all day, and uses puzzle pieces for the old, large ones.',
      body: [
        'Writes spend CPU on the encoding math. A read gathers fragments from four nodes. Repairing one lost fragment means reading four others.',
        'A common split is to replicate small, hot objects and erasure-code large or cold ones. With a managed store you never choose. This machinery is why S3 can offer eleven nines at a few cents per GB.',
      ],
      keyIdea: 'Erasure coding gives 1.5x overhead where replication needs 3x for the same survivable losses, and pays in CPU and extra reads.',
      metrics: { raw: '1.5 TB', cost: '-', read: '-', safe: '2 losses' },
      scene: {
        nodes: [
          { id: 'rep', kind: 'block', at: at(-4, 0), label: 'replicate', sub: 'small, hot objects', icon: 'Copy', tint: 'amber' },
          { ...api, at: at(0, -3), status: 'active', load: 70 },
          { id: 'ec', kind: 'block', at: at(4, 0), label: 'erasure code', sub: 'large, cold objects', icon: 'Binary', tint: 'green' },
        ],
        links: [link('api', 'rep'), link('api', 'ec')],
        flows: [
          { path: ['api', 'rep'], tone: 'data', label: '3 copies', duration: 1.4 },
          { path: ['api', 'ec'], tone: 'data', label: '4 + 2 fragments', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Same two losses survived',
          icon: 'Scale',
          rows: [
            { text: 'Replication: disk', value: '3x', tone: 'warn' },
            { text: 'Replication: read / repair', value: '1 node', tone: 'good' },
            { text: 'Erasure 4+2: disk', value: '1.5x', tone: 'good' },
            { text: 'Erasure 4+2: read / repair', value: '4 nodes', tone: 'warn' },
          ],
        },
        caption: 'Pick by how often the object is read',
      },
      quiz: {
        question: 'A store uses 4 + 2 erasure coding. What is the raw disk used per 1 TB stored, and how many fragments can be lost?',
        options: ['3 TB, any 2 fragments', '1.5 TB, any 2 fragments', '1.5 TB, any 4 fragments', '2 TB, only 1 fragment'],
        answer: 1,
        explain: 'Six fragments for every four of data is 1.5x. Any four of the six rebuild the object, so any two can be lost.',
      },
    },
    {
      title: 'Versioning',
      tag: 'concept',
      heading: 'Versioning protects against your own mistakes',
      eli5: 'Replication saves paintings from floods but not from a child who scribbles on one or throws it away. The teacher keeps every older version in a drawer and puts a note on top instead of throwing anything out.',
      body: [
        'Copies copy mistakes too. A bad overwrite or a delete is replicated three times. Turn on **versioning** and every `PUT` of the same key keeps the old version.',
        'A `DELETE` only adds a **delete marker**. Remove the marker and the object returns. Old versions are billed, so a lifecycle rule should expire them after a while.',
      ],
      keyIdea: 'Versioning turns overwrite and delete into reversible steps. Expire old versions to keep the bill in check.',
      metrics: { raw: '1.5 TB', cost: '-', read: '-', safe: 'mistakes too' },
      metricTones: { safe: 'good' },
      scene: {
        nodes: [
          { ...app, status: 'active', chips: ['DELETE a.jpg'] },
          { ...bucket, at: at(4, -2.5), status: 'ok', badge: 'versioning on' },
          { id: 'ver', kind: 'block', at: at(0, 4), label: 'versions', sub: 'a.jpg v1, v2, marker', icon: 'Layers', tint: 'amber' },
        ],
        links: [link('app', 'bucket'), link('bucket', 'ver', { style: 'dashed' })],
        flows: [{ path: ['app', 'bucket'], tone: 'request', label: 'DELETE a.jpg', duration: 1.4 }, { path: ['bucket', 'ver'], tone: 'event', label: 'marker added', duration: 1.4, delay: 1.5 }],
        panel: {
          title: 'Key a.jpg',
          icon: 'List',
          rows: [
            { text: 'v3', value: 'delete marker', tone: 'warn' },
            { text: 'v2', value: 'kept', tone: 'good' },
            { text: 'v1', value: 'kept', tone: 'good' },
          ],
          footer: { text: 'Remove the marker to restore', tone: 'muted' },
        },
        caption: 'A delete only hides the object',
      },
    },
    {
      title: 'Other region',
      tag: 'concept',
      heading: 'Cross-region replication survives a lost region',
      eli5: 'Zones are buildings in one town. If the whole town is cut off, a copy kept in another town still lets you show the painting.',
      body: [
        'Zones protect against a building. A whole **region** can still fail or be cut off. **Cross-region replication** copies new objects to a bucket in another region, usually within seconds to minutes.',
        'It doubles storage and adds transfer cost, so use it for data you cannot lose or must serve from two places. Same-region copies are cheaper.',
      ],
      keyIdea: 'Copy to a second region only for data that must outlive a region. It costs double and lags a little.',
      metrics: { raw: '1.5 TB per region', cost: '2x', read: '-', safe: 'a lost region' },
      metricTones: { cost: 'warn', safe: 'good' },
      scene: {
        nodes: [
          { ...bucket, at: at(-4, 0), label: 'bucket', sub: 'us-east', status: 'ok' },
          { id: 'bucket2', kind: 'storage', at: at(4, 0), label: 'bucket copy', sub: 'eu-west', tint: 'teal', status: 'ok' },
          { ...app, at: at(0, -3.5) },
        ],
        links: [link('app', 'bucket'), link('bucket', 'bucket2', { label: 'async, seconds to minutes', labelTone: 'warn', style: 'dashed' })],
        flows: [
          { path: ['app', 'bucket'], tone: 'data', label: 'PUT', duration: 1.2 },
          { path: ['bucket', 'bucket2'], tone: 'data', label: 'replicate', duration: 2, delay: 1.3 },
        ],
        panel: {
          title: 'Zones vs regions',
          icon: 'Earth',
          rows: [
            { text: 'Zone copy', value: 'survives a building' },
            { text: 'Region copy', value: 'survives a region', tone: 'good' },
            { text: 'Storage and transfer', value: '2x', tone: 'warn' },
          ],
        },
        caption: 'A second region for data you cannot lose',
      },
    },
    {
      title: 'Storage classes',
      tag: 'concept',
      heading: 'Old data moves to cheaper shelves',
      eli5: 'This week\'s paintings stay in the classroom. Older ones go to the hallway cupboard, and very old ones to the attic, where space is cheap but fetching takes a long time. Each place is a **storage class**.',
      body: [
        'After a year the bucket holds 365 TB, and most of it is photos nobody has opened in months. Example prices per TB per month: standard at $23, infrequent access at $12.50, archive at $4 or less.',
        'Cheaper classes charge in other ways. Infrequent access bills each GB you read and has a minimum storage period. Archive can take minutes or hours to hand an object back, so it suits backups, not a photo a user might tap.',
      ],
      keyIdea: 'Pay for fast access only while data is hot. Cheaper classes trade retrieval speed and fees for a lower monthly price.',
      metrics: { raw: '1.5 TB', cost: '$8,400/mo all standard', read: '-', safe: '-' },
      metricTones: { cost: 'bad' },
      scene: {
        nodes: [
          { ...bucket, at: at(-4, 2.8), label: 'standard', sub: '0 to 30 days', status: 'active', badge: '$23 / TB' },
          { ...warm, status: 'ok', badge: '$12.50 / TB, per-GB reads' },
          { ...cold, status: 'ok', badge: '$4 / TB, hours to restore' },
        ],
        links: [link('bucket', 'warm', { style: 'dashed' }), link('warm', 'cold', { style: 'dashed' })],
        flows: [{ path: ['bucket', 'warm', 'cold'], tone: 'event', label: 'ages down', duration: 3 }],
        panel: {
          title: 'Example price per TB per month',
          icon: 'Receipt',
          rows: [
            { text: 'Standard', value: '$23' },
            { text: 'Infrequent access', value: '$12.50', tone: 'good' },
            { text: 'Archive', value: '$4 or less', tone: 'good' },
            { text: 'Archive restore', value: 'minutes to hours', tone: 'warn' },
          ],
        },
        caption: 'Same bucket, three price tiers',
      },
    },
    {
      title: 'Lifecycle rules',
      tag: 'concept',
      heading: 'Rules move data by age with no code',
      eli5: 'The teacher pins a note on the cupboard: "paintings older than 30 days go to the hallway". Nobody has to remember. A helper moves them on that day.',
      body: [
        'A **lifecycle rule** moves objects by age. Photos move to infrequent access after 30 days. At the end of year one that is 30 TB at standard and 335 TB at the lower price: about **$4,900 a month against $8,400** with everything in standard.',
        'Another rule sends backups to archive and expires them after a year. A third aborts unfinished multipart uploads.',
      ],
      keyIdea: 'Lifecycle rules cut the bill automatically and also clean up uploads and old versions.',
      metrics: { raw: '1.5 TB', cost: '$4,900/mo', read: '-', safe: '-' },
      metricTones: { cost: 'good' },
      scene: {
        nodes: [
          { ...phone },
          { ...bucket, at: at(0, 2.8), label: 'standard', sub: 'first 30 days', status: 'active', badge: '30 TB at $23' },
          { ...warm, at: at(4, 2.8), status: 'ok', badge: '335 TB at $12.50' },
        ],
        links: [link('phone', 'bucket'), link('bucket', 'warm', { style: 'dashed', label: 'day 30' })],
        flows: [
          { path: ['phone', 'bucket'], tone: 'data', label: 'new photos', count: 2, duration: 1.6 },
          { path: ['bucket', 'warm'], tone: 'event', label: 'lifecycle: 30 days old', count: 3, duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'Year-one bill',
          icon: 'Receipt',
          rows: [
            { text: 'All standard', value: '$8,400 / mo', tone: 'bad' },
            { text: 'With 30-day rule', value: '$4,900 / mo', tone: 'good' },
          ],
          footer: { text: '30 TB x $23 + 335 TB x $12.50', tone: 'muted' },
        },
        caption: 'The rule moves photos after 30 days',
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
        'Put a **CDN** in front (see the content delivery networks lesson). The first Sydney request misses at the edge and is fetched from the bucket. Later requests are answered in about 20 ms. The bucket stays private and accepts reads only from the CDN.',
      ],
      keyIdea: 'The bucket is the origin and the CDN is the front door. Hits are fast and cheap, and the bucket stays private.',
      metrics: { raw: '1.5 TB', cost: '$4,900/mo', read: '20 ms', safe: '-' },
      metricTones: { read: 'good' },
      scene: {
        nodes: [
          { ...phone, label: 'viewer', sub: 'Sydney' },
          { ...cdn, at: at(0, -2.5), status: 'ok', badge: 'hit, 20 ms' },
          { ...bucket, at: at(4, -2.5), sub: 'private, Virginia', badge: 'CDN reads only' },
        ],
        links: [link('phone', 'cdn', { label: '20 ms', labelTone: 'good' }), link('cdn', 'bucket', { style: 'dashed', label: 'on a miss, 200 ms', labelTone: 'warn' })],
        flows: [
          { path: ['phone', 'cdn'], tone: 'request', label: 'GET 8f3a.jpg', duration: 0.9 },
          { path: ['cdn', 'bucket', 'cdn'], tone: 'data', label: 'first time only', duration: 2.2, delay: 1 },
          { path: ['cdn', 'phone'], tone: 'response', label: 'photo', count: 3, duration: 0.9, delay: 3.3 },
        ],
        caption: 'One trip to the bucket, then the edge answers',
      },
    },
    {
      title: 'Immutable keys',
      tag: 'tradeoff',
      heading: 'Never overwrite a key, and caching gets easy',
      eli5: 'If a painting is never changed after it gets its label, the notice board can keep its copy for a whole year. A changed painting simply gets a new label.',
      body: [
        'A key that contains a UUID or a content hash always names the same bytes. Send `Cache-Control: public, max-age=31536000, immutable` and edges keep objects for a year.',
        'A changed photo gets a new key, so nothing ever needs purging. Private photos use signed CDN URLs that expire.',
      ],
      keyIdea: 'Immutable keys make every cached copy correct forever. Change the key, not the bytes.',
      metrics: { raw: '1.5 TB', cost: '$4,900/mo', read: '20 ms', safe: '-' },
      metricTones: { read: 'good' },
      scene: {
        nodes: [{ ...cdn, status: 'ok', chips: ['max-age=31536000'] }, { ...app, at: at(4, -2.5), chips: ['new photo = new key'] }, { ...bucket, at: at(0, 4.6), badge: 'never overwritten' }],
        links: [link('cdn', 'bucket', { style: 'dashed' }), link('app', 'bucket')],
        flows: [
          { path: ['app', 'bucket'], tone: 'data', label: 'PUT photos/7/new.jpg', duration: 1.6 },
          { path: ['bucket', 'cdn'], tone: 'response', label: 'cache 1 year', duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'Response headers',
          icon: 'Code',
          code: 'Cache-Control: public,\n  max-age=31536000, immutable\nETag: "8f3a9c..."\nContent-Type: image/jpeg',
          footer: { text: 'No purge calls needed', tone: 'good' },
        },
        caption: 'New bytes get a new key',
      },
    },
    {
      title: 'Upload events',
      tag: 'concept',
      heading: 'The bucket can tell you when an object lands',
      eli5: 'When a painting arrives, the keeper rings a bell. A helper hears it and makes a small copy for the notice board, so the teacher never has to.',
      body: [
        'Buckets can publish an **event** on every new object. Send it to a queue and a worker makes thumbnails, scans for malware or reads video metadata.',
        'This replaces the "done" call from the client as the trigger for slow work. Events are delivered at least once, so make the worker safe to run twice.',
      ],
      keyIdea: 'Upload events let background workers react to new objects without the app polling or the client reporting.',
      metrics: { raw: '1.5 TB', cost: '$4,900/mo', read: '20 ms', safe: '-' },
      scene: {
        nodes: [
          { ...bucket, at: at(-4, 0), status: 'active', badge: 'ObjectCreated' },
          { id: 'queue', kind: 'queue', at: at(0, -3), label: 'queue', sub: 'at least once' },
          { id: 'worker', kind: 'worker', at: at(4, 0), label: 'thumbnailer', sub: '200 px copy', status: 'active' },
        ],
        links: [link('bucket', 'queue'), link('queue', 'worker'), link('worker', 'bucket', { style: 'dashed', label: 'PUT thumbs/' })],
        flows: [
          { path: ['bucket', 'queue'], tone: 'event', label: 'new object', duration: 1.2 },
          { path: ['queue', 'worker'], tone: 'event', label: 'job', duration: 1.2, delay: 1.3 },
          { path: ['worker', 'bucket'], tone: 'data', label: 'thumbnail', duration: 1.6, delay: 2.6 },
        ],
        caption: 'New object, event, thumbnail',
      },
    },
    {
      title: 'Locks and keys',
      tag: 'concept',
      heading: 'Private by default, encrypted at rest',
      eli5: 'The cupboard is locked. Only people with the right pass can open one shelf, and every painting is wrapped in a secret code so a thief cannot read it.',
      body: [
        'Keep buckets private and turn on the provider\'s "block public access" setting. Give each service an identity with only the permissions it needs: the app can sign URLs for `photos/` and nothing else.',
        'Encrypt objects at rest, usually with a key held in a key management service. Use HTTPS for every request. Log access to the bucket so odd reads can be found.',
      ],
      keyIdea: 'Private bucket, least-privilege identities, encryption at rest and in transit, and an access log.',
      metrics: { raw: '1.5 TB', cost: '$4,900/mo', read: '20 ms', safe: 'private' },
      metricTones: { safe: 'good' },
      scene: {
        nodes: [
          { ...app, status: 'ok', chips: ['can sign photos/ only'] },
          { id: 'kms', kind: 'vault', at: at(4, -2.5), label: 'key service', sub: 'encryption keys', status: 'ok' },
          { ...bucket, at: at(0, 2.8), status: 'ok', badge: 'private, encrypted' },
        ],
        links: [link('app', 'bucket', { label: 'HTTPS' }), link('kms', 'bucket', { style: 'dashed', label: 'encrypts' })],
        flows: [
          { path: ['app', 'bucket'], tone: 'handshake', label: 'least privilege', duration: 1.4 },
          { path: ['kms', 'bucket'], tone: 'event', label: 'key for each object', duration: 1.6, delay: 1.5 },
        ],
        panel: {
          title: 'Bucket checklist',
          icon: 'Shield',
          rows: [
            { text: 'Block public access', value: 'on', tone: 'good' },
            { text: 'Encryption at rest', value: 'on', tone: 'good' },
            { text: 'HTTPS only', value: 'on', tone: 'good' },
            { text: 'Access log', value: 'on', tone: 'good' },
          ],
        },
        caption: 'Locked by default',
      },
    },
    {
      title: 'Wrong tool',
      tag: 'tradeoff',
      heading: 'When object storage is the wrong tool',
      eli5: 'The cupboard is perfect for whole paintings. It is bad for a notebook where you scribble on one line a hundred times a day, and bad for questions like "which paintings are red?".',
      body: [
        'Objects are written whole. Frequent small edits, append-heavy logs and random writes fit badly. A request takes tens of milliseconds, far slower than a local disk or a database.',
        'There are no joins or filters on contents. Small rows that you query belong in a database, shared editable files belong in a file system, and a database or VM disk needs a block volume (low-latency, fixed-size, attached to one server). Reads out of the store also cost, so serve popular objects through a CDN.',
      ],
      keyIdea: 'Use object storage for large, whole, rarely edited files. Use a database for queries and a file system for editing in place.',
      metrics: { raw: '-', cost: '-', read: 'tens of ms', safe: '-' },
      scene: {
        nodes: [
          { id: 'sql', kind: 'db', at: at(-4, 0), label: 'database', sub: 'queries, small rows', status: 'ok' },
          { ...bucket, at: at(0, -3), sub: 'large, whole files', status: 'ok' },
          { id: 'fs', kind: 'block', at: at(4, 0), label: 'file system', sub: 'edit in place', icon: 'FileText', tint: 'gray' },
        ],
        links: [link('sql', 'bucket', { style: 'faint' }), link('bucket', 'fs', { style: 'faint' })],
        panel: {
          title: 'Pick by the job',
          icon: 'Table',
          rows: [
            { text: 'Query by content', value: 'database' },
            { text: 'Photos, video, backups', value: 'object store', tone: 'good' },
            { text: 'Edit a few bytes', value: 'file system' },
            { text: 'Database or VM disk', value: 'block volume' },
            { text: 'Append to a log', value: 'queue or log' },
          ],
        },
        caption: 'Each store has its own job',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Safe, cheap and close to the user',
      eli5: 'The cupboard keeps spare puzzle pieces so nothing is lost, moves old paintings to the attic, and puts favorites on a notice board. It rings a bell for each new painting and stays locked.',
      body: [
        'The store keeps objects safe with replication (3x disk) or erasure coding (about 1.5x). **Versioning** and a second region cover human mistakes and lost regions.',
        '**Lifecycle rules** move aging data to cheaper classes. A **CDN** in front of a private bucket serves reads near users. Events drive background work. The later designs for photo sharing, video and file sync start here.',
      ],
      keyIdea: 'Durable by design, cheap by lifecycle, fast through a CDN, and used only for what it does best.',
      metrics: { raw: '1.5 TB', cost: '$4,900/mo', read: '20 ms', safe: '2 losses' },
      metricTones: { raw: 'good', cost: 'good', read: 'good', safe: 'good' },
      scene: {
        nodes: [{ ...phone, label: 'viewer' }, { ...cdn, status: 'ok' }, { ...bucket, at: at(4, -2.5), status: 'ok' }],
        links: [link('phone', 'cdn'), link('cdn', 'bucket', { style: 'dashed' })],
        flows: [{ path: ['bucket', 'cdn', 'phone'], tone: 'response', label: 'view', count: 2, duration: 2 }],
        caption: 'Private bucket, public speed',
      },
      quiz: {
        question: 'A bucket holds 365 TB and most photos are older than 30 days and rarely read. Which change cuts the monthly bill the most while keeping reads fast?',
        options: [
          'Move everything to an archive class that restores in hours',
          'A lifecycle rule that moves photos to infrequent access after 30 days',
          'Replicate every object a fourth time',
          'Delete the CDN',
        ],
        answer: 1,
        explain: 'Infrequent access stays as fast as standard but costs about half per TB. Archive would save more but makes a tapped photo take hours to return.',
      },
    },
  ],
};
