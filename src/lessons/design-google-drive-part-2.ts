import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

// Same layout as part 1: bytes along the top (s = -3.5), metadata along the bottom (s = 3.5).
const laptop: SceneNode = { id: 'laptop', kind: 'client', at: at(-5.4, 0), label: 'laptop', sub: 'desktop client' };
const phone: SceneNode = { id: 'phone', kind: 'phone', at: at(5.4, 0), label: 'phone', sub: 'same account' };
const blocks: SceneNode = { id: 'blocks', kind: 'block', at: at(-1.8, -3.5), label: 'block servers', sub: 'verify, pack', icon: 'Layers', tint: 'teal' };
const store: SceneNode = { id: 'store', kind: 'storage', at: at(1.8, -3.5), label: 'block store', sub: 'object storage' };
const api: SceneNode = { id: 'api', kind: 'block', at: at(-1.8, 3.5), label: 'API servers', sub: 'metadata calls', icon: 'Server', tint: 'violet' };
const db: SceneNode = { id: 'db', kind: 'db', at: at(1.8, 3.5), label: 'metadata DB', sub: 'SQL, sharded' };
const cache: SceneNode = { id: 'cache', kind: 'cache', at: at(-1.8, 0), label: 'meta cache', sub: 'versioned keys' };
const standby: SceneNode = { id: 'standby', kind: 'replica', at: at(5.4, 3.5), label: 'sync standby', sub: 'same commits' };
const bus: SceneNode = { id: 'bus', kind: 'queue', at: at(0, 3.5), label: 'change bus', sub: 'pub/sub' };
const notify: SceneNode = { id: 'notify', kind: 'block', at: at(3.6, 3.5), label: 'notification', sub: 'long poll', icon: 'Signal', tint: 'green' };
const gc: SceneNode = { id: 'gc', kind: 'worker', at: at(-1.8, -3.5), label: 'GC sweeper', sub: 'refs = 0' };
const cold: SceneNode = { id: 'cold', kind: 'storage', at: at(5.4, -3.5), label: 'cold tier', sub: 'idle 90+ days' };

const same = { changes: '3,500/s peak', stored: '380 PB', sync: '30 s avg', notify: '500K polls/s' };

export const designGoogleDrivePart2: Lesson = {
  id: 'design-google-drive-part-2',
  title: 'Design Google Drive (part 2)',
  tagline: 'Strong metadata, instant notifications, conflicts, sharing, history, cost and failures.',
  minutes: 18,
  level: 'Advanced',
  learn: [
    'Why file metadata needs a transaction, and how sharding and a standby protect it',
    'Versioned cache keys so a cache never shows an old version as current',
    'Long polling with a change cursor, which also brings offline devices up to date',
    'Conflicts, rename, delete, trash and sharing permissions',
    'Version history, garbage collection, cold storage and failure handling',
  ],
  metrics: [
    { key: 'changes', label: 'File changes', icon: 'Repeat' },
    { key: 'stored', label: 'Stored, logical', icon: 'HardDrive' },
    { key: 'sync', label: 'Sync delay', icon: 'Timer' },
    { key: 'notify', label: 'Notify load', icon: 'Signal' },
  ],
  steps: [
    {
      title: 'Transaction',
      tag: 'concept',
      heading: 'Fix 3: a commit is one transaction',
      eli5: 'The card box is updated in one careful move, so nobody ever sees a card that points at a missing page. That all-or-nothing move is a **transaction**.',
      body: [
        'Blocks can be eventually consistent, metadata cannot. If the phone sees version 15 before all its blocks exist, it downloads a broken file.',
        'So a commit is one **ACID transaction** (the transactions lesson): check the blocks exist, insert the version rows, move the file pointer, append to the change journal. All of it or none of it.',
      ],
      keyIdea: 'A version becomes visible in one transaction, only after all its blocks exist.',
      metrics: same,
      scene: {
        nodes: [{ ...laptop, chips: ['commit v15'] }, { ...api, status: 'active' }, { ...db, status: 'active', badge: 'one transaction' }],
        links: [link('laptop', 'api'), link('api', 'db')],
        flows: [
          { path: ['laptop', 'api'], tone: 'request', label: 'commit v15', duration: 1 },
          { path: ['api', 'db'], tone: 'request', label: 'BEGIN ... COMMIT', duration: 1.2, delay: 1.1 },
        ],
        panel: {
          title: 'Inside the transaction',
          icon: 'Shield',
          rows: [
            { text: '1. Bump refs, count rows', value: 'short: need_blocks' },
            { text: '2. Insert version rows', value: 'v15' },
            { text: '3. Move the file pointer', value: 'latest_ver = 15' },
            { text: '4. Append to the journal', value: 'seq 1042 + commit id' },
          ],
          footer: { text: 'All of it, or none of it', tone: 'good' },
        },
        caption: 'The version appears whole or not at all',
      },
    },
    {
      title: 'Sharding',
      tag: 'concept',
      heading: 'Shard by namespace, keep a synchronous standby',
      eli5: 'Each kid’s notebooks live in one cupboard, so one visit is enough. Each cupboard has a twin that is updated at the same moment, so if it burns the twin is current.',
      body: [
        'A relational database gives the transaction directly. Shard by **namespace id** (the sharding lesson), so a whole tree or shared folder lives on one shard and every commit is a single-shard transaction.',
        '3,500 commits a second over ~40 shards is light. Each shard has a **synchronous standby** in another zone, so failover loses no commit. Metadata size sets the shard count. A huge shared namespace gets its own shard or is split, and moving one means copy, then flip the map.',
      ],
      keyIdea: 'Shard by namespace so every commit is single-shard, and replicate synchronously so no commit is lost.',
      metrics: same,
      scene: {
        nodes: [
          { ...api, status: 'active' },
          { ...db, label: 'shard 7', sub: 'namespace 77', status: 'active', load: 40 },
          { ...standby, status: 'ok' },
          { id: 'db2', kind: 'db', at: at(-5.4, 3.5), label: 'shard 8', sub: 'namespace 78', status: 'dim' },
        ],
        links: [
          link('api', 'db'),
          link('api', 'db2', { style: 'faint' }),
          link('db', 'standby', { label: 'sync', style: 'dashed' }),
        ],
        flows: [
          { path: ['api', 'db'], tone: 'request', label: 'commit ns 77', duration: 1.2 },
          { path: ['db', 'standby'], tone: 'data', label: 'ack before commit', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Why this shape',
          icon: 'Split',
          rows: [
            { text: 'Shard key', value: 'namespace id' },
            { text: 'Commits a second', value: '3,500 over ~40 shards' },
            { text: 'Per shard', value: '~90/s, light', tone: 'good' },
            { text: 'Metadata per shard', value: '~3B block rows + versions' },
            { text: 'Huge shared namespace', value: 'split or own shard', tone: 'warn' },
            { text: 'On failover', value: 'no commit lost', tone: 'good' },
          ],
        },
        caption: 'A commit touches one shard and one standby',
      },
    },
    {
      title: 'Cache',
      tag: 'concept',
      heading: 'The cache must not show an older version',
      eli5: 'A sticky note on the front desk says "notebook is on page 14". If the office updated it to 15, the note must change too, or kids will copy the wrong pages.',
      body: [
        'Cache entries are keyed with the version (`file:9001:v15`), and a commit deletes the pointer key.',
        'A device that was just told "version 15 exists" reads from the primary if the cache or a replica still says 14.',
      ],
      keyIdea: 'Version the cache keys and fall back to the primary when a device knows it is behind.',
      metrics: same,
      scene: {
        nodes: [
          { ...api, status: 'active' },
          { ...cache, at: at(-5.4, 3.5), chips: [{ text: 'DEL file:9001', tone: 'warn' }] },
          { ...db, status: 'active' },
          { ...phone, chips: ['told: v15'] },
        ],
        links: [link('api', 'db'), link('api', 'cache'), link('phone', 'api', { style: 'dashed' })],
        flows: [
          { path: ['api', 'cache'], tone: 'event', label: 'invalidate', duration: 0.9 },
          { path: ['phone', 'api'], tone: 'request', label: 'read v15', duration: 1.2, delay: 1 },
          { path: ['api', 'db'], tone: 'request', label: 'cache says 14: ask primary', duration: 1.2, delay: 2.3 },
        ],
        panel: {
          title: 'Cache keys',
          icon: 'Database',
          rows: [
            { text: 'file:9001:v14', value: 'old, never reused', tone: 'muted' },
            { text: 'file:9001:v15', value: 'new key' },
            { text: 'file:9001:latest', value: 'deleted on commit', tone: 'warn' },
            { text: 'Device behind?', value: 'read the primary', tone: 'good' },
          ],
        },
        caption: 'A stale answer is never shown as current',
      },
    },
    {
      title: 'Long poll',
      tag: 'concept',
      heading: 'Fix 4: hold a request open until something changes',
      eli5: 'Each kid leaves a call open with the office, and the office says "new pages!" the moment something changes. That waiting call is a **long poll**.',
      body: [
        'Replace the 60-second poll with a **long poll**, as in the real-time lesson. Each device sends `GET /notify?ns=77&cursor=1041` and the notification server holds it open for up to 60 seconds.',
        'When a commit lands, the API publishes "namespace 77 changed" on a **pub/sub** bus (the pub/sub lesson). The server holding that namespace’s devices answers at once.',
      ],
      keyIdea: 'Hold the request open and answer the moment a commit lands.',
      metrics: { ...same, sync: '2 s', notify: '30M held conns' },
      metricTones: { sync: 'good' },
      scene: {
        nodes: [
          { ...laptop, chips: ['commit v15'] },
          { ...api, status: 'active' },
          { ...bus, at: at(1.8, 3.5), status: 'active' },
          { ...notify, at: at(5.4, 3.5), status: 'active' },
          { ...phone, at: at(5.4, -5.5), chips: ['GET /notify?ns=77'] },
        ],
        links: [link('laptop', 'api'), link('api', 'bus'), link('bus', 'notify'), link('notify', 'phone', { label: 'held open', arrow: 'both' })],
        flows: [
          { path: ['phone', 'notify'], tone: 'request', label: 'wait for ns 77', duration: 1 },
          { path: ['laptop', 'api'], tone: 'request', label: 'commit', duration: 1, delay: 1 },
          { path: ['api', 'bus', 'notify'], tone: 'event', label: 'ns 77 changed', duration: 1.6, delay: 2.2 },
          { path: ['notify', 'phone'], tone: 'event', label: 'changed', duration: 0.9, delay: 3.9 },
        ],
        panel: {
          title: 'Polling vs long polling',
          icon: 'Timer',
          rows: [
            { text: 'Poll every 60 s', value: '500K req/s, 30 s late', tone: 'bad' },
            { text: 'Long poll, 60 s hold', value: 'few requests, 2 s', tone: 'good' },
          ],
        },
        caption: 'The held request returns the moment a namespace changes',
      },
    },
    {
      title: 'Cursor',
      tag: 'concept',
      heading: 'The nudge carries no data, the cursor does',
      eli5: 'The office only says "something changed". The kid then asks "what is new since page 1041?" and brings home just those pages. No separate mailbox is needed.',
      body: [
        'The answer carries only "something changed". The device calls `changes?cursor=1041`, gets the list, downloads the blocks it lacks, and opens a new long poll.',
        'A laptop asleep for a week does the same on wake: it asks for everything after its cursor. The journal is the inbox, so no per-device queue is needed.',
      ],
      keyIdea: 'A notification is a nudge. The change journal and each device’s cursor are the source of truth.',
      metrics: { ...same, sync: '2 s', notify: '30M held conns' },
      metricTones: { sync: 'good' },
      scene: {
        nodes: [
          { ...laptop, status: 'dim', chips: ['asleep for a week'] },
          { ...phone, at: at(5.4, 0), status: 'active', chips: ['cursor 1041'] },
          { ...api, status: 'active' },
          { ...db, badge: 'journal seq 1042' },
        ],
        links: [link('phone', 'api', { style: 'dashed' }), link('api', 'db')],
        flows: [
          { path: ['phone', 'api'], tone: 'request', label: 'changes?cursor=1041', duration: 1.4 },
          { path: ['api', 'db'], tone: 'request', label: 'seq > 1041', duration: 1, delay: 1.5 },
          { path: ['api', 'phone'], tone: 'response', label: 'file 9001 is v15', duration: 1.4, delay: 2.6 },
        ],
        panel: {
          title: 'Journal for namespace 77',
          icon: 'List',
          rows: [
            { text: 'seq 1040', value: 'file 12, v3', tone: 'muted' },
            { text: 'seq 1041', value: 'device cursor', tone: 'warn' },
            { text: 'seq 1042', value: 'file 9001, v15', tone: 'good' },
          ],
          footer: { text: 'Cursor moves to 1042 after sync', tone: 'muted' },
        },
        caption: 'Ask for everything after the cursor',
      },
    },
    {
      title: 'Why not WebSocket',
      tag: 'tradeoff',
      heading: 'Long poll sizing, and why not WebSocket',
      eli5: 'A phone call that stays open all day is overkill for a message once in a while. A short waiting call that works on every phone line is plenty.',
      body: [
        'WebSocket would work, but traffic is one-way and rare, a few events per device per day, and plain HTTP passes every proxy and firewall.',
        '30 million held connections at about 500,000 per server is around **60 notification servers**. Changes show up in about **2 seconds**.',
      ],
      keyIdea: 'Pick the simplest transport that meets the 5 second target. Rare one-way events do not need a duplex socket.',
      metrics: { ...same, sync: '2 s', notify: '30M held conns' },
      scene: {
        nodes: [
          { ...notify, at: at(-1.8, 0), status: 'active', load: 55, chips: ['500K held conns'] },
          { ...phone, at: at(3.6, 0), chips: ['GET /notify'] },
          { ...bus, at: at(-1.8, 3.5), status: 'ok' },
        ],
        links: [link('bus', 'notify'), link('notify', 'phone', { label: 'plain HTTP, any proxy', arrow: 'both' })],
        flows: [{ path: ['bus', 'notify', 'phone'], tone: 'event', label: 'changed', duration: 2 }],
        panel: {
          title: 'Transport choice',
          icon: 'Scale',
          rows: [
            { text: 'Long poll', value: 'passes proxies', tone: 'good' },
            { text: 'WebSocket', value: 'two-way, not needed', tone: 'muted' },
            { text: 'Connections', value: '30 M' },
            { text: 'Per server', value: '~500 K' },
            { text: 'Servers', value: '~60' },
          ],
        },
        caption: 'About 60 boxes hold every device’s waiting call',
      },
    },
    {
      title: 'Conflicts',
      tag: 'case',
      heading: 'Case: two devices edit the same file offline',
      eli5: 'Two kids fix the same page on a trip. The first one back gets it filed. The second keeps their page as a separate copy to compare. That clash is a **conflict**.',
      body: [
        'Ana edits `report.docx` on her laptop on a plane, and her phone edits the same file on version 14. The laptop commits version 15 first. Then the phone commits with base version 14.',
        'The commit checks the base version in the same transaction that moves the pointer. It fails with a **conflict**: first committed wins. The phone saves `report (phone conflicted copy).docx` and downloads version 15.',
      ],
      keyIdea: 'Commit with a base version and compare-and-set the pointer. The loser of a race becomes a conflicted copy, so no edit is silently lost.',
      metrics: { ...same, sync: '2 s', notify: '30M held conns' },
      scene: {
        nodes: [
          { ...laptop, status: 'ok', chips: [{ text: 'base 14, won v15', tone: 'good' }] },
          { ...api, status: 'active' },
          { ...db, status: 'active', badge: 'latest_ver = 15' },
          { ...phone, status: 'hot', chips: [{ text: 'base 14: conflict', tone: 'bad' }] },
        ],
        links: [link('laptop', 'api'), link('api', 'db'), link('phone', 'api')],
        flows: [
          { path: ['laptop', 'api', 'db'], tone: 'request', label: 'commit base 14', duration: 1.6 },
          { path: ['phone', 'api'], tone: 'request', label: 'commit base 14', duration: 1.2, delay: 1.8 },
          { path: ['api', 'phone'], tone: 'error', label: 'conflict: now v15', duration: 1.2, delay: 3.1 },
          { path: ['phone', 'api'], tone: 'request', label: 'save conflicted copy', duration: 1.2, delay: 4.4 },
        ],
        panel: {
          title: 'Race for version 15',
          icon: 'Repeat',
          rows: [
            { text: 'Laptop, base 14', value: 'wins, v15', tone: 'good' },
            { text: 'Phone, base 14', value: 'conflict', tone: 'bad' },
            { text: 'Phone edit', value: 'kept as new file', tone: 'good' },
          ],
        },
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
-- Rows updated must equal the 2 distinct hashes, else ROLLBACK, need_blocks.

-- 3. Append to the journal; the namespace counter serializes commits.
UPDATE namespaces SET next_seq = next_seq + 1
 WHERE namespace_id = 77 RETURNING next_seq;  -- 1042
INSERT INTO changes VALUES (77, 1042, 9001, 15, :commit_id);
COMMIT;`,
        highlight: [3, 5, 6, 13, 17, 19],
      },
      quiz: {
        question: 'Two offline devices both edit version 14 of a Word file. The first commits v15. What should the second commit do?',
        options: [
          'Overwrite v15, the latest writer always wins',
          'Fail the base-version check and save its edit as a conflicted copy',
          'Silently merge the two binary files',
          'Wait on a lock held since the device went offline',
        ],
        answer: 1,
        explain: 'The compare-and-set on the base version fails, so nothing is overwritten. The edit survives as a separate file and the user merges by hand. A binary Word file cannot be auto-merged.',
      },
    },
    {
      title: 'Move and delete',
      tag: 'concept',
      heading: 'Rename, move and delete are metadata only',
      eli5: 'Moving a notebook to another shelf only changes the label on the index card. The pages do not move. Throwing one away just puts it in a bin for a while.',
      body: [
        'Rename and move change `path` in one commit and append a journal row. No block moves, so moving a 10 GB folder costs one small write.',
        'Delete is a commit that marks the file deleted. It sits in **trash** for 30 days, and restore is a new version that points at the old block list.',
      ],
      keyIdea: 'Files are pointers. Moving, renaming and deleting only touch the pointer.',
      metrics: { ...same, sync: '2 s', notify: '30M held conns' },
      scene: {
        nodes: [
          { ...laptop, chips: ['mv /taxes /archive'] },
          { ...api, status: 'active' },
          { ...db, at: at(5.4, 3.5), status: 'active', badge: 'path changed, blocks untouched' },
          { ...store, status: 'dim', badge: '0 bytes moved' },
        ],
        links: [link('laptop', 'api'), link('api', 'db'), link('api', 'store', { style: 'faint' })],
        flows: [
          { path: ['laptop', 'api', 'db'], tone: 'request', label: 'move 10 GB folder', duration: 1.8 },
        ],
        panel: {
          title: 'What each action writes',
          icon: 'FileText',
          rows: [
            { text: 'Rename or move', value: 'path update', tone: 'good' },
            { text: 'Delete', value: 'tombstone version', tone: 'warn' },
            { text: 'Trash window', value: '30 days' },
            { text: 'Restore', value: 'new version, old blocks', tone: 'good' },
          ],
        },
        caption: 'Pointers move, bytes stay',
      },
    },
    {
      title: 'Sharing',
      tag: 'concept',
      heading: 'Sharing: a folder is its own namespace',
      eli5: 'A shared folder is a notebook with its own card box, and a list of which kids may open it. Every kid’s office phone line listens to that box too.',
      body: [
        'A shared folder becomes its own **namespace** with a member list and roles (viewer, editor). Each member’s tree mounts it, and children inherit its permissions. A link token grants access to anyone holding it. Every call checks the role. Moving a file across namespaces copies block refs, and the bytes are re-keyed for the destination.',
        'A commit in a shared namespace notifies every member’s devices, each tracking one cursor per mounted namespace.',
      ],
      keyIdea: 'A shared folder is a namespace with its own journal, so sharing reuses commits, cursors and notifications.',
      metrics: { ...same, sync: '2 s', notify: '30M held conns' },
      scene: {
        nodes: [
          { ...laptop, chips: ['Ana: editor'] },
          { ...api, status: 'active', chips: ['check role'] },
          { id: 'shared', kind: 'block', at: at(1.8, 3.5), label: 'shared folder', sub: 'namespace 90', icon: 'Share2', tint: 'amber', status: 'active' },
          { ...phone, chips: ['Ben: viewer'] },
        ],
        links: [link('laptop', 'api'), link('api', 'shared'), link('phone', 'api', { style: 'dashed' })],
        flows: [
          { path: ['laptop', 'api', 'shared'], tone: 'request', label: 'commit ns 90', duration: 1.8 },
          { path: ['phone', 'api'], tone: 'request', label: 'changes?ns=90', duration: 1.2, delay: 2 },
          { path: ['api', 'phone'], tone: 'response', label: 'allowed: viewer', duration: 1.2, delay: 3.3 },
        ],
        panel: {
          title: 'Members of namespace 90',
          icon: 'Users',
          rows: [
            { text: 'Ana', value: 'editor' },
            { text: 'Ben', value: 'viewer' },
            { text: 'Ben commits', value: 'denied 403', tone: 'bad' },
            { text: 'Block by guessed hash', value: 'denied', tone: 'good' },
            { text: 'Anyone with the link', value: 'token, revocable' },
            { text: 'Move to another namespace', value: 'copy refs, re-key', tone: 'warn' },
          ],
        },
        caption: 'Permissions are checked on every call',
      },
    },
    {
      title: 'Version history',
      tag: 'tradeoff',
      heading: 'History is cheap, so set a retention policy',
      eli5: 'The office keeps old copies of each notebook, but old copies share most pages with the new one, so they take little room. It still throws out very old ones.',
      body: [
        'Version 15 of the deck shares 49 of 50 blocks with version 14, so keeping it costs one 4 MB block. Busy files still pile up versions.',
        'Set a **retention policy**: keep every version for 30 days, then one per day, and cap the count. History adds about 10% on top of current data, bringing storage to **420 PB**.',
      ],
      keyIdea: 'Versions share blocks, so history costs little. Retention keeps it bounded.',
      metrics: { ...same, stored: '420 PB', sync: '2 s', notify: '30M held conns' },
      scene: {
        nodes: [
          { ...api, at: at(-5.4, 3.5), status: 'dim' },
          { ...db, at: at(-1.8, 3.5), status: 'active', badge: 'v1..v15 share blocks' },
          { ...store, badge: '+4 MB for v15' },
        ],
        links: [link('api', 'db'), link('db', 'store', { style: 'dashed', label: 'hash lists' })],
        flows: [{ path: ['db', 'store'], tone: 'data', label: '49 shared, 1 new', duration: 1.8 }],
        panel: {
          title: 'Retention policy',
          icon: 'Clock',
          rows: [
            { text: 'Days 0 to 30', value: 'every version', tone: 'good' },
            { text: 'After 30 days', value: 'one a day' },
            { text: 'Cap', value: 'max versions', tone: 'warn' },
            { text: 'Storage with history', value: '+10%, 420 PB' },
          ],
        },
        caption: 'Versions are lists of shared hashes',
      },
    },
    {
      title: 'Garbage collection',
      tag: 'concept',
      heading: 'Delete blocks only when nothing points at them',
      eli5: 'When old copies are thrown out, some pages are left that no card points to. A tidy-up helper bins them, but waits a week in case a kid is still carrying one in.',
      body: [
        'When versions expire, their blocks lose a reference. A **garbage collector** deletes blocks whose `refs` reach zero.',
        'It waits for a grace period first, because a block uploaded a second ago may belong to a commit that has not finished. The commit transaction increments `refs`, and the sweeper deletes only if `refs` is still 0 inside its own transaction.',
      ],
      keyIdea: 'Reference counts say what is garbage. A grace period protects uploads still in flight.',
      metrics: { ...same, stored: '420 PB', sync: '2 s', notify: '30M held conns' },
      scene: {
        nodes: [
          { ...gc, status: 'active' },
          { ...store, badge: 'refs = 0 for 7 days' },
          { ...db, at: at(5.4, 3.5), badge: 'refs per block' },
        ],
        links: [link('gc', 'store'), link('gc', 'db', { style: 'dashed' })],
        flows: [
          { path: ['db', 'gc'], tone: 'event', label: 'refs = 0 for 7 days', duration: 1.4 },
          { path: ['gc', 'store'], tone: 'error', label: 'delete block', duration: 1, delay: 1.5 },
        ],
        panel: {
          title: 'Why wait',
          icon: 'Clock',
          rows: [
            { text: 'Block uploaded 1 s ago', value: 'refs = 0', tone: 'warn' },
            { text: 'Its commit', value: 'not finished', tone: 'warn' },
            { text: 'Grace period', value: '7 days', tone: 'good' },
            { text: 'Dedup hit while sweeping', value: 'delete only if refs = 0', tone: 'good' },
            { text: 'Early delete', value: 'breaks the commit', tone: 'bad' },
          ],
        },
        caption: 'Sweep only what is old and unreferenced',
      },
    },
    {
      title: 'Cold storage',
      tag: 'tradeoff',
      heading: 'Most bytes are cold, so store them cheaper',
      eli5: 'Most notebooks are never opened again. The office moves dusty ones to the basement, which is cheap but slower to fetch from. The basement is **cold storage**.',
      body: [
        'A lifecycle rule (the object storage lesson) moves blocks unread for 90 days to a **cold** class that costs several times less per GB.',
        'First reads are slower and each retrieval has a fee. In a typical drive most bytes are cold, so this is the biggest saving on the storage bill.',
      ],
      keyIdea: 'Cold storage trades slow, priced reads for a much lower cost per GB, and most bytes are rarely read.',
      metrics: { ...same, stored: '420 PB', sync: '2 s', notify: '30M held conns' },
      scene: {
        nodes: [
          { ...store, badge: 'hot: 30%' },
          { ...cold, status: 'ok', badge: 'cold: 70%' },
          { ...db, at: at(-1.8, 3.5), badge: 'last read dates' },
        ],
        links: [link('store', 'cold', { label: 'lifecycle: idle 90 days' }), link('db', 'store', { style: 'dashed' })],
        flows: [{ path: ['store', 'cold'], tone: 'data', label: 'idle 90 days', count: 3, duration: 1.8 }],
        panel: {
          title: 'Hot vs cold',
          icon: 'Scale',
          rows: [
            { text: 'Share of bytes, hot', value: '30%' },
            { text: 'Share of bytes, cold', value: '70%', tone: 'good' },
            { text: 'Cost per GB, cold', value: 'several times less', tone: 'good' },
            { text: 'First read', value: 'slower, fee', tone: 'warn' },
          ],
        },
        caption: 'Idle blocks move down a tier',
      },
    },
    {
      title: 'Notify failure',
      tag: 'case',
      heading: 'Case: a notification server dies with 500,000 connections',
      eli5: 'One office phone line dies and half a million kids redial at once. If each waits a random few seconds first, the other lines cope. That random wait is **jitter**.',
      body: [
        'A server crashes and 500,000 long polls drop in the same second. If every device reconnects at once, the other servers take a connection storm. Clients reconnect with exponential backoff and **jitter** (the timeouts and retries lesson), spreading the herd over about 30 seconds.',
        'On reconnect each device asks for changes after its cursor, so no change is missed. Sync delay spikes to 30 seconds for those devices, then returns to 2.',
      ],
      keyIdea: 'Notifications can be lost. The journal recovers them.',
      metrics: { ...same, sync: '30 s spike', notify: '500K reconnecting' },
      metricTones: { sync: 'warn', notify: 'bad' },
      scene: {
        nodes: [
          { ...notify, at: at(-3.6, 0), status: 'down', badge: 'crashed' },
          { id: 'notify2', kind: 'block', at: at(3.6, 0), label: 'notification 2', sub: 'takes reconnects', icon: 'Signal', tint: 'green', status: 'hot', load: 88 },
          { ...phone, at: at(0, -5), status: 'active', chips: [{ text: 'reconnect in 0 to 30 s', tone: 'warn' }] },
          { ...api, at: at(0, 3.5), status: 'ok' },
        ],
        links: [
          link('phone', 'notify', { style: 'faint' }),
          link('phone', 'notify2', { label: 'jittered', labelTone: 'warn' }),
          link('phone', 'api', { style: 'dashed' }),
        ],
        flows: [
          { path: ['notify', 'phone'], tone: 'error', label: 'connection lost', duration: 1 },
          { path: ['phone', 'notify2'], tone: 'request', label: 'reconnect', duration: 1.6, delay: 1.2 },
          { path: ['phone', 'api'], tone: 'request', label: 'changes?cursor=1042', duration: 1.6, delay: 3 },
        ],
        panel: {
          title: 'Recovery',
          icon: 'Repeat',
          rows: [
            { text: 'Dropped connections', value: '500,000', tone: 'bad' },
            { text: 'Reconnect spread', value: '~30 s with jitter', tone: 'good' },
            { text: 'Missed changes', value: '0, cursor replay', tone: 'good' },
            { text: 'Delay for these devices', value: '30 s, then 2 s', tone: 'warn' },
          ],
        },
        caption: 'Lost nudges are recovered from the change journal',
      },
    },
    {
      title: 'Block server fails',
      tag: 'case',
      heading: 'Case: a block server dies mid-upload',
      eli5: 'The mail room clerk faints with half a notebook on the desk. Nothing was filed in the card box yet, so no kid sees a half notebook. The kid hands the rest to another clerk.',
      body: [
        'The commit never happened, so no device sees a half file. The client resends the missing blocks to another block server.',
        'That is safe because blocks are keyed by hash. A repeated upload of the same hash writes the same bytes.',
      ],
      keyIdea: 'Upload is idempotent and visible only at commit, so a dead block server costs a retry.',
      metrics: { ...same, sync: '2 s', notify: '30M held conns' },
      scene: {
        nodes: [
          { ...laptop, status: 'active', chips: ['retry missing blocks'] },
          { ...blocks, status: 'down', badge: 'died mid-upload' },
          { id: 'blocks2', kind: 'block', at: at(-1.8, 3.5), label: 'block servers', sub: 'another box', icon: 'Layers', tint: 'teal', status: 'active' },
          { ...store, at: at(1.8, 0), status: 'ok' },
        ],
        links: [link('laptop', 'blocks', { style: 'faint' }), link('laptop', 'blocks2'), link('blocks2', 'store')],
        flows: [
          { path: ['laptop', 'blocks'], tone: 'error', label: 'connection reset', duration: 1 },
          { path: ['laptop', 'blocks2', 'store'], tone: 'data', label: 'resend by hash', duration: 1.8, delay: 1.2 },
        ],
        panel: {
          title: 'Why it is safe',
          icon: 'Shield',
          rows: [
            { text: 'Commit happened', value: 'no', tone: 'good' },
            { text: 'Half file visible', value: 'never', tone: 'good' },
            { text: 'Retry of same hash', value: 'same bytes', tone: 'good' },
          ],
        },
        caption: 'Resend to any other block server',
      },
    },
    {
      title: 'Primary fails',
      tag: 'case',
      heading: 'Case: a metadata primary dies',
      eli5: 'The head librarian’s card box is lost in a fire. The twin box was updated at the same moment, so the office swaps to it and nothing is missing.',
      body: [
        'The synchronous standby is promoted (the failover lesson). Writes pause for a few seconds, and no committed version is lost.',
        'Clients retry the commit with the same commit id. If it had already landed, the server finds that id in the journal and returns the existing version. The base-version check alone cannot tell a repeat from a conflict.',
      ],
      keyIdea: 'Synchronous replication turns a lost primary into a short write pause, not data loss.',
      metrics: { ...same, sync: '2 s', notify: '30M held conns' },
      metricTones: { sync: 'warn' },
      scene: {
        nodes: [
          { ...api, status: 'active', chips: [{ text: 'writes paused ~5 s', tone: 'warn' }] },
          { ...db, status: 'down', badge: 'primary died' },
          { ...standby, at: at(5.4, 3.5), status: 'ok', badge: 'promoted' },
        ],
        links: [link('api', 'db', { style: 'faint' }), link('db', 'standby', { style: 'dashed', label: 'sync copy' }), link('api', 'standby', { route: 'straight' })],
        flows: [{ path: ['api', 'standby'], tone: 'request', label: 'commit retry', duration: 1.8, delay: 1 }],
        panel: {
          title: 'Failover',
          icon: 'Repeat',
          rows: [
            { text: 'Standby had every commit', value: 'yes', tone: 'good' },
            { text: 'Writes paused', value: 'seconds', tone: 'warn' },
            { text: 'Committed versions lost', value: '0', tone: 'good' },
          ],
        },
        caption: 'Promote the twin, retry the commit',
      },
    },
    {
      title: 'Region fails',
      tag: 'case',
      heading: 'Case: a storage region goes down',
      eli5: 'A whole building of cupboards is closed. Every page also has a copy in a second building, so the office fetches from there.',
      body: [
        'Blocks are replicated to a second region. Reads fail over to it, and new uploads go to the healthy region and replicate back later. Metadata has an async cross-region replica, which sets the disaster-recovery RPO.',
        'Because blocks are immutable and named by hash, two regions never disagree about a block. They only disagree about whether a copy exists yet.',
      ],
      keyIdea: 'Immutable, hash-named blocks replicate without conflicts, so a region loss is a routing change.',
      metrics: { ...same, sync: '2 s', notify: '30M held conns' },
      scene: {
        nodes: [
          { ...blocks, at: at(-5.4, 0), status: 'active' },
          { ...store, at: at(-1.8, -3.5), label: 'region A', sub: 'primary copy', status: 'down', badge: 'region down' },
          { id: 'store2', kind: 'storage', at: at(-1.8, 3.5), label: 'region B', sub: 'replica copy', status: 'ok' },
          { ...phone, chips: ['GET /blocks/9f1c'] },
        ],
        links: [link('blocks', 'store', { style: 'faint' }), link('blocks', 'store2', { label: 'failover' }), link('phone', 'blocks', { style: 'dashed' })],
        flows: [{ path: ['phone', 'blocks', 'store2'], tone: 'request', label: 'read from region B', duration: 2 }],
        panel: {
          title: 'Region loss',
          icon: 'Globe',
          rows: [
            { text: 'Block copies', value: '2 regions' },
            { text: 'Metadata', value: 'async replica, DR RPO', tone: 'warn' },
            { text: 'Stored figure', value: 'logical, before replication', tone: 'muted' },
            { text: 'Reads', value: 'switch to B', tone: 'good' },
            { text: 'New uploads', value: 'land in B', tone: 'good' },
            { text: 'Block conflicts', value: 'none, hash-named', tone: 'good' },
          ],
        },
        caption: 'Read from the other region',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Hash the blocks, commit the metadata, nudge the devices',
      eli5: 'Pages with fingerprints, only changed pages carried in, one careful card box, and a quick call when something changes: together they make a **sync service**.',
      body: [
        'Metadata: files point at immutable versions, versions list block hashes, and a commit is one transaction on a namespace-sharded SQL database with a synchronous standby. A base-version check turns races into conflicted copies.',
        'Devices hold long polls, get a nudge in about 2 seconds, and read the change journal from their cursor, which also brings offline devices up to date.',
      ],
      keyIdea: 'Separate content from metadata: content is immutable, hash-named and stored anywhere, while metadata is small, transactional and the only thing that defines what a file is.',
      metrics: { changes: '3,500/s peak', stored: '420 PB', sync: '2 s', notify: '30M held conns' },
      metricTones: { sync: 'good' },
      scene: {
        nodes: [{ ...laptop, status: 'ok' }, { ...api, status: 'ok' }, { ...db, status: 'ok' }, { ...phone, status: 'ok' }],
        links: [link('laptop', 'api'), link('api', 'db'), link('phone', 'api', { style: 'dashed' })],
        flows: [
          { path: ['laptop', 'api', 'db'], tone: 'request', label: 'commit', duration: 1.6 },
          { path: ['api', 'phone'], tone: 'event', label: 'changed', duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'Metadata path',
          icon: 'Database',
          rows: [
            { text: 'Commit', value: 'one transaction' },
            { text: 'Conflicts', value: 'conflicted copy' },
            { text: 'Notify', value: 'long poll, ~2 s', tone: 'good' },
            { text: 'Catch up', value: 'journal + cursor' },
            { text: 'Storage', value: '420 PB, tiered', tone: 'good' },
          ],
        },
        caption: 'The metadata path completes the design',
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
