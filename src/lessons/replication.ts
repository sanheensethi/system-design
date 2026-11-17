import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const app: SceneNode = { id: 'app', kind: 'server', at: at(-7.2, -4.5), label: 'app server', sub: 'shop backend' };
const primary: SceneNode = { id: 'primary', kind: 'db', at: at(-3.6, -4.5), label: 'primary', sub: 'takes writes' };
const r1: SceneNode = { id: 'r1', kind: 'replica', at: at(-5.4, 4.5), label: 'replica 1' };
const r2: SceneNode = { id: 'r2', kind: 'replica', at: at(-1.8, 4.5), label: 'replica 2' };
const r3: SceneNode = { id: 'r3', kind: 'replica', at: at(1.8, 4.5), label: 'replica 3' };
const mgr: SceneNode = { id: 'mgr', kind: 'monitor', at: at(3.6, -4.5), label: 'failover manager', sub: 'Patroni' };

const feed = (extra: Partial<SceneLink> = {}) => [
  link('primary', 'r1', { style: 'dashed', ...extra }),
  link('primary', 'r2', { style: 'dashed', ...extra }),
  link('primary', 'r3', { style: 'dashed', ...extra }),
];

export const replication: Lesson = {
  id: 'replication',
  title: 'Replication (part 1)',
  tagline: 'Copy the database to scale reads and survive a dead machine, and learn what the copies cost you.',
  minutes: 16,
  level: 'Intermediate',
  learn: [
    'How a primary streams its change log to read replicas',
    'Synchronous, asynchronous and semi-synchronous replication, and what each one risks',
    'Why replication lag breaks read-your-writes, and the fixes',
    'How failover promotes a replica, and how split brain happens and is fenced',
  ],
  metrics: [
    { key: 'replicas', label: 'Replicas', icon: 'Copy' },
    { key: 'reads', label: 'Read capacity', icon: 'Gauge' },
    { key: 'lag', label: 'Lag', icon: 'Clock' },
    { key: 'commit', label: 'Commit time', icon: 'Timer' },
    { key: 'risk', label: 'Data at risk', icon: 'Shield' },
  ],
  steps: [
    {
      title: 'Read wall',
      tag: 'problem',
      heading: 'The database is pinned at 100% CPU',
      eli5: 'The **database** is the one storybook in the library, and thirty kids want to read it at the same time. Everyone waits in a long line.',
      body: [
        'The shop is growing. At peak it serves **30K reads/s** and only **1K writes/s**: product pages, carts and order history are read far more often than they change.',
        'One SQL machine tops out around **10K reads/s**. Pages time out, and a bigger machine buys a few months at best.',
      ],
      keyIdea: 'A single database has a throughput ceiling, and read-heavy traffic hits it first.',
      metrics: { replicas: '0', reads: '10K/s (need 30K)', lag: '-', commit: '2 ms', risk: 'since last backup' },
      metricTones: { reads: 'bad' },
      scene: {
        nodes: [
          { ...app, status: 'hot', chips: [{ text: 'timeouts', tone: 'bad' }] },
          { ...primary, label: 'database', sub: 'only copy', status: 'hot', load: 100, chips: ['SELECT * FROM products'] },
        ],
        links: [link('app', 'primary', { label: '30K reads/s', labelTone: 'warn' })],
        flows: [
          { path: ['app', 'primary'], tone: 'request', label: 'SELECT', count: 6, duration: 1.2 },
          { path: ['primary', 'app'], tone: 'error', label: 'timeout', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Peak traffic',
          icon: 'Gauge',
          rows: [
            { text: 'Reads', value: '30K/s', tone: 'warn' },
            { text: 'Writes', value: '1K/s' },
            { text: 'One machine handles', value: '10K reads/s', tone: 'bad' },
          ],
          footer: { text: '30 reads for every write', tone: 'muted' },
        },
        caption: 'Three times more demand than one box can serve',
      },
    },
    {
      title: 'One copy',
      tag: 'problem',
      heading: 'It is also the only copy of the data',
      eli5: 'There is only one storybook. If the book is lost or burned, the stories are gone, and the library has to rebuild from last night\'s photo of it.',
      body: [
        'The same box is a **single point of failure**. If its disk dies, you restore from last night\'s backup and lose every order since.',
        'Even a clean restore takes hours. During that time the shop is down.',
      ],
      keyIdea: 'One copy means one disk failure away from lost data and a long outage.',
      metrics: { replicas: '0', reads: '0 (down)', lag: '-', commit: '-', risk: 'up to 24 h of orders' },
      metricTones: { reads: 'bad', risk: 'bad' },
      scene: {
        nodes: [
          { ...app, status: 'hot' },
          { ...primary, label: 'database', sub: 'only copy', status: 'down', badge: 'disk dead' },
          { id: 'backup', kind: 'storage', at: at(3.6, -4.5), label: 'nightly backup', sub: '1 AM', status: 'ok' },
        ],
        links: [link('app', 'primary', { style: 'faint' }), link('primary', 'backup', { style: 'dashed' })],
        flows: [
          { path: ['app', 'primary'], tone: 'error', label: 'no answer', duration: 1.4 },
          { path: ['backup', 'primary'], tone: 'data', label: 'restore', duration: 2, delay: 1.6 },
        ],
        panel: {
          title: 'Disk dies at 4 PM',
          icon: 'HardDrive',
          rows: [
            { text: 'Last backup', value: '1 AM' },
            { text: 'Orders lost', value: '15 hours', tone: 'bad' },
            { text: 'Restore time', value: 'hours', tone: 'bad' },
          ],
        },
        caption: 'The backup is always behind',
      },
    },
    {
      title: 'Replicas',
      tag: 'concept',
      heading: 'One primary for writes, replicas for reads',
      eli5: 'Each **replica** is a copy of the main book. The librarian writes new pages only in the main book, helpers copy every new page over, and the kids read from the copies.',
      body: [
        'Keep one **primary** that accepts every write. Add **read replicas** that hold full copies. The app sends writes to the primary and spreads reads across the replicas.',
        'Three replicas at about 10K reads/s each cover the 30K peak, and the primary keeps its CPU for writes. Read capacity grows roughly linearly with replicas.',
      ],
      keyIdea: 'Replication scales reads by adding copies, and each copy is also a spare if a machine dies.',
      metrics: { replicas: '3', reads: '30K/s', lag: '20 ms', commit: '2 ms', risk: 'last ~20 ms' },
      metricTones: { reads: 'good' },
      scene: {
        nodes: [
          app,
          { ...primary, status: 'active', chips: [{ text: '1K writes/s', tone: 'good' }] },
          { ...r1, chips: ['10K reads/s'] },
          { ...r2, chips: ['10K reads/s'] },
          { ...r3, chips: ['10K reads/s'] },
        ],
        links: [
          link('app', 'primary'),
          link('app', 'r1', { style: 'faint' }),
          link('app', 'r2', { style: 'faint' }),
          link('app', 'r3', { style: 'faint' }),
          ...feed(),
        ],
        flows: [
          { path: ['app', 'primary'], tone: 'request', label: 'UPDATE', duration: 1 },
          { path: ['primary', 'r1'], tone: 'data', label: 'changes', duration: 1.2, delay: 1.1 },
          { path: ['primary', 'r2'], tone: 'data', duration: 1.2, delay: 1.1 },
          { path: ['primary', 'r3'], tone: 'data', duration: 1.2, delay: 1.1 },
          { path: ['app', 'r1'], tone: 'request', label: 'SELECT', duration: 1.2, delay: 2.6 },
          { path: ['app', 'r2'], tone: 'request', duration: 1.2, delay: 2.6 },
          { path: ['app', 'r3'], tone: 'request', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'Where each request goes',
          icon: 'Split',
          rows: [
            { text: 'INSERT, UPDATE, DELETE', value: 'primary' },
            { text: 'SELECT', value: 'any replica', tone: 'good' },
            { text: 'Replicas needed for 30K', value: '3' },
            { text: 'Routing layer', value: 'PgBouncer, ProxySQL' },
          ],
        },
      },
      code: {
        language: 'python',
        title: 'Route writes and reads separately',
        source: `import random

primary = connect("postgres://db-primary:5432/shop")
replicas = [connect(f"postgres://db-replica-{i}:5432/shop") for i in (1, 2, 3)]

def write(sql, *args):
    return primary.execute(sql, *args)          # every write: one place

def read(sql, *args):
    return random.choice(replicas).execute(sql, *args)   # spread reads

write("UPDATE carts SET items = %s WHERE user_id = %s", items, 7)
read("SELECT * FROM products WHERE id = %s", 42)`,
        highlight: [7, 10],
      },
    },
    {
      title: 'Write limit',
      tag: 'concept',
      heading: 'Writes do not get faster, and copies cost space',
      eli5: 'Every helper has to copy every new page the librarian writes. Adding helpers gives more kids a copy to read, but the librarian still writes at the same speed.',
      body: [
        'Every replica replays every write, so each one does the 1K writes/s work too. The primary is still the ceiling for writes. That problem gets its own lesson (sharding).',
        'Copies also cost storage. A 1 TB dataset with 3 replicas is **4 TB** on disk, plus indexes. Capacity plans multiply by the **replication factor**.',
      ],
      keyIdea: 'Replication scales reads, not writes, and multiplies your storage bill by the replication factor.',
      metrics: { replicas: '3', reads: '30K/s', lag: '20 ms', commit: '2 ms', risk: 'last ~20 ms' },
      metricTones: { reads: 'good' },
      scene: {
        nodes: [
          { ...primary, status: 'active', load: 55, chips: ['1K writes/s'] },
          { ...r1, chips: ['replays 1K/s'] },
          { ...r2, chips: ['replays 1K/s'] },
          { ...r3, chips: ['replays 1K/s'] },
        ],
        links: feed(),
        flows: [
          { path: ['primary', 'r1'], tone: 'data', count: 3, duration: 1.2 },
          { path: ['primary', 'r2'], tone: 'data', count: 3, duration: 1.2 },
          { path: ['primary', 'r3'], tone: 'data', count: 3, duration: 1.2 },
        ],
        panel: {
          title: 'What 3 replicas change',
          icon: 'Table',
          rows: [
            { text: 'Read capacity', value: '10K to 30K/s', tone: 'good' },
            { text: 'Write capacity', value: 'unchanged', tone: 'warn' },
            { text: '1 TB dataset on disk', value: '4 TB', tone: 'warn' },
          ],
        },
      },
    },
    {
      title: 'Not a backup',
      tag: 'tradeoff',
      heading: 'Replicas are not backups',
      eli5: 'The helpers copy every change the librarian makes, even a mistake. If she rips out a page, they rip it out too. You still need an old photo of the book, kept somewhere safe.',
      body: [
        'Replicas protect against **losing a machine**. They do not protect against a **logical mistake**: a `DROP TABLE`, a bad migration or a buggy deploy replicates to every copy within milliseconds.',
        'Keep backups and **point-in-time recovery** (base backup plus archived WAL). Some teams add a **delayed replica**, for example 1 hour behind, as a safety net.',
      ],
      keyIdea: 'Replication copies mistakes as fast as it copies data. Keep backups and point-in-time recovery as well.',
      metrics: { replicas: '3 + 1 delayed', reads: '30K/s', lag: '20 ms (1 h delayed)', commit: '2 ms', risk: 'mistakes copy instantly' },
      metricTones: { risk: 'bad' },
      scene: {
        nodes: [
          { ...primary, status: 'hot', chips: [{ text: 'DROP TABLE orders', tone: 'bad' }] },
          { ...r1, status: 'down', badge: 'table gone' },
          { ...r2, status: 'down', badge: 'table gone' },
          { ...r3, label: 'delayed replica', sub: '1 h behind', status: 'ok', badge: 'still has it' },
        ],
        links: [link('primary', 'r1', { style: 'dashed' }), link('primary', 'r2', { style: 'dashed' }), link('primary', 'r3', { style: 'dashed', label: '1 h delay', labelTone: 'good' })],
        flows: [
          { path: ['primary', 'r1'], tone: 'error', label: 'DROP TABLE', duration: 1.2 },
          { path: ['primary', 'r2'], tone: 'error', duration: 1.2 },
        ],
        panel: {
          title: 'What protects against what',
          icon: 'Shield',
          rows: [
            { text: 'DROP TABLE', value: 'replicates everywhere', tone: 'bad' },
            { text: 'Disk or machine dies', value: 'replicas', tone: 'good' },
            { text: 'Bad migration or bug', value: 'backup + PITR', tone: 'good' },
            { text: 'Delayed replica', value: 'optional safety net', tone: 'warn' },
          ],
        },
      },
    },
    {
      title: 'The log',
      tag: 'concept',
      heading: 'Replicas replay the primary\'s change log',
      eli5: 'The librarian keeps a diary of every change: "page 7, added a dragon". The helpers read the diary in order and make the same change in their own copy.',
      body: [
        'Each change on the primary is first appended to its **write-ahead log** (WAL). That ordered log is streamed to the replicas, which replay it in the same order. Same log in the same order gives the same data.',
        'Every entry has a position, the **LSN**. A replica knows exactly how far it has replayed.',
      ],
      keyIdea: 'Replication is shipping an ordered log. The log position tells you how far behind a copy is.',
      metrics: { replicas: '3', reads: '30K/s', lag: '20 ms', commit: '2 ms', risk: 'last ~20 ms' },
      scene: {
        nodes: [
          { ...primary, status: 'active', badge: 'LSN 0/3000A8' },
          { ...r1, badge: 'replayed 0/3000A8', status: 'ok' },
          { ...r2, badge: 'replayed 0/3000A8', status: 'ok' },
        ],
        links: [link('primary', 'r1', { style: 'dashed', label: 'stream WAL' }), link('primary', 'r2', { style: 'dashed' })],
        flows: [
          { path: ['primary', 'r1'], tone: 'data', label: 'LSN 0/3000A8', duration: 1.4 },
          { path: ['primary', 'r2'], tone: 'data', duration: 1.4 },
        ],
        panel: {
          title: 'The primary\'s log',
          icon: 'FileText',
          code: '0/300090  INSERT orders (id=9001)\n0/3000A8  UPDATE carts SET items=...\n0/3000C0  DELETE sessions (id=77)',
          footer: { text: 'Replicas replay in this exact order', tone: 'muted' },
        },
      },
    },
    {
      title: 'Log formats',
      tag: 'concept',
      heading: 'What goes into the log: statements, bytes or rows',
      eli5: 'The diary can say "add a random sticker" (each helper picks a different one), or "page 7, dragon sticker #4" (everyone does the same). The exact note is safer.',
      body: [
        '**Statement shipping** sends the SQL text. It breaks on `NOW()`, `RAND()` and triggers, because each replica computes a different answer.',
        '**Physical (WAL) shipping** sends byte-level disk changes. It is exact but tied to one engine version. **Logical (row) shipping** sends "row 7 changed to X". It is portable across versions and feeds other systems.',
      ],
      keyIdea: 'Ship the result of a change, not the instruction. Row-based logs avoid non-deterministic surprises.',
      metrics: { replicas: '3', reads: '30K/s', lag: '20 ms', commit: '2 ms', risk: 'last ~20 ms' },
      scene: {
        nodes: [
          { ...primary, status: 'active' },
          { ...r1, chips: [{ text: 'RAND() differs', tone: 'bad' }] },
          { ...r2, status: 'ok', chips: [{ text: 'row 7 = X', tone: 'good' }] },
        ],
        links: [link('primary', 'r1', { style: 'dashed', label: 'statements', labelTone: 'warn' }), link('primary', 'r2', { style: 'dashed', label: 'row changes' })],
        flows: [
          { path: ['primary', 'r1'], tone: 'error', label: 'UPDATE ... RAND()', duration: 1.4 },
          { path: ['primary', 'r2'], tone: 'data', label: 'row 7 = X', duration: 1.4 },
        ],
        panel: {
          title: 'Three log formats',
          icon: 'List',
          rows: [
            { text: 'Statement', value: 'breaks on NOW(), RAND()', tone: 'bad' },
            { text: 'Physical WAL', value: 'exact, one version', tone: 'warn' },
            { text: 'Logical rows', value: 'portable', tone: 'good' },
          ],
        },
      },
    },
    {
      title: 'New replica',
      tag: 'concept',
      heading: 'Adding a replica: snapshot, then catch up',
      eli5: 'A new helper arrives. Copy the whole book first from a photo taken at 3 PM, then read the diary from 3 PM onward until the helper is up to date.',
      body: [
        'You cannot just copy files while writes keep landing. Take a consistent **snapshot** and note its log position (LSN). Restore it on the new machine.',
        'The new replica then asks the primary for every log entry after that LSN, replays them, and joins the read pool once its lag is near zero.',
      ],
      keyIdea: 'A snapshot plus the log from its position gives a new replica without stopping the primary.',
      metrics: { replicas: '3 + 1 joining', reads: '30K/s', lag: 'catching up', commit: '2 ms', risk: 'last ~20 ms' },
      scene: {
        nodes: [
          { ...primary, status: 'active', badge: 'still taking writes' },
          { id: 'snap', kind: 'storage', at: at(3.6, -4.5), label: 'snapshot', sub: 'at LSN 0/2F0000', status: 'ok' },
          { ...r3, label: 'new replica', status: 'active', badge: 'catching up' },
        ],
        links: [link('primary', 'snap', { style: 'dashed' }), link('snap', 'r3', { style: 'dashed' }), link('primary', 'r3', { style: 'faint' })],
        flows: [
          { path: ['primary', 'snap', 'r3'], tone: 'data', label: '1: snapshot', duration: 2 },
          { path: ['primary', 'r3'], tone: 'event', label: '2: log after LSN', duration: 1.6, delay: 2.2 },
        ],
        panel: {
          title: 'Bootstrap a replica',
          icon: 'List',
          rows: [
            { text: '1. Snapshot with its LSN', value: 'copy' },
            { text: '2. Replay log after the LSN', value: 'catch up' },
            { text: '3. Lag near zero', value: 'serve reads', tone: 'good' },
          ],
        },
      },
    },
    {
      title: 'Async',
      tag: 'tradeoff',
      heading: 'Asynchronous: answer first, ship later',
      eli5: 'With **asynchronous** copying, the librarian says "saved!" right after writing in the main book, then hands the note to the helpers. It is fast, but a lost book takes the unsent notes with it.',
      body: [
        'The primary commits locally, answers the client in about **2 ms**, and ships the change afterwards. This is the default in most databases.',
        'If the primary dies before shipping, those acknowledged writes are gone. The window is the replication lag, here about 20 ms.',
      ],
      keyIdea: 'Async replication keeps commits fast and risks the newest few milliseconds of writes.',
      metrics: { replicas: '3', reads: '30K/s', lag: '20 ms', commit: '2 ms', risk: 'last ~20 ms' },
      metricTones: { commit: 'good', risk: 'warn' },
      scene: {
        nodes: [app, { ...primary, status: 'active', chips: ['COMMIT'] }, { ...r1, badge: 'not yet' }],
        links: [link('app', 'primary'), link('primary', 'r1', { style: 'dashed', label: '~20 ms later' })],
        flows: [
          { path: ['app', 'primary'], tone: 'request', label: 'COMMIT', duration: 1 },
          { path: ['primary', 'app'], tone: 'response', label: 'ok, 2 ms', duration: 1, delay: 1.1 },
          { path: ['primary', 'r1'], tone: 'data', label: 'WAL', duration: 1.4, delay: 2.2 },
        ],
        panel: {
          title: 'Timeline of one commit',
          icon: 'Clock',
          rows: [
            { text: 'Written on primary', value: '0 ms' },
            { text: 'Client told ok', value: '2 ms', tone: 'good' },
            { text: 'Reaches replicas', value: '~20 ms', tone: 'warn' },
          ],
          footer: { text: 'Primary dies at 10 ms: write lost', tone: 'bad' },
        },
      },
    },
    {
      title: 'Sync',
      tag: 'tradeoff',
      heading: 'Synchronous: wait for the copy',
      eli5: '**Synchronous** means the librarian waits until a helper calls "copied!" before telling you your page is saved. It takes a bit longer, but the page is safe even if the main book is lost.',
      body: [
        'The primary waits until **every** replica confirms it has the change. You lose nothing on failover, but every commit pays a round trip to the slowest replica: about 1 ms inside a datacenter, **60 ms or more** across regions.',
        'If any replica stalls, writes stall too. The next step relaxes this by waiting for only one.',
      ],
      keyIdea: 'Sync replication buys zero data loss with latency on every write, and any stalled replica can freeze them.',
      metrics: { replicas: '3 (all sync)', reads: '30K/s', lag: '0', commit: '3 ms', risk: '0 committed writes' },
      metricTones: { commit: 'warn', risk: 'good' },
      scene: {
        nodes: [app, { ...primary, status: 'active', badge: 'waits for all acks' }, { ...r1, status: 'ok', badge: 'sync' }, { ...r2, status: 'ok', badge: 'sync' }],
        links: [link('app', 'primary'), link('primary', 'r1', { style: 'dashed', arrow: 'both', label: '+1 ms same DC', labelTone: 'warn' }), link('primary', 'r2', { style: 'dashed', arrow: 'both' })],
        flows: [
          { path: ['app', 'primary'], tone: 'request', label: 'COMMIT', duration: 1 },
          { path: ['primary', 'r1'], tone: 'data', label: 'WAL', duration: 0.9, delay: 1.05 },
          { path: ['primary', 'r2'], tone: 'data', duration: 0.9, delay: 1.05 },
          { path: ['r1', 'primary'], tone: 'handshake', label: 'ack', duration: 0.9, delay: 2 },
          { path: ['r2', 'primary'], tone: 'handshake', label: 'ack', duration: 0.9, delay: 2 },
          { path: ['primary', 'app'], tone: 'response', label: 'committed', duration: 1, delay: 3 },
        ],
        panel: {
          title: 'Cost of waiting',
          icon: 'Timer',
          rows: [
            { text: 'Async commit', value: '2 ms', tone: 'good' },
            { text: 'Sync, same datacenter', value: '3 ms' },
            { text: 'Sync, other region', value: '60+ ms', tone: 'bad' },
          ],
          footer: { text: 'Any replica stalls: writes stall', tone: 'bad' },
        },
      },
    },
    {
      title: 'Semi-sync',
      tag: 'tradeoff',
      heading: 'Semi-sync: one waits, the rest do not',
      eli5: 'The librarian waits for just one helper to say "copied!", and the other helpers copy later. If that helper is slow, another one takes over the waiting job.',
      body: [
        '**Semi-synchronous** replication makes one replica synchronous and the rest async. A copy always exists on a second machine, and a stall elsewhere does not block commits.',
        'You can also pick per transaction: payments wait for the copy, a page-view counter does not.',
      ],
      keyIdea: 'Wait for one copy, not all of them. Choose the durability level per write.',
      metrics: { replicas: '3 (1 sync)', reads: '30K/s', lag: '20 ms', commit: '3 ms', risk: '0 committed writes' },
      metricTones: { risk: 'good' },
      scene: {
        nodes: [{ ...primary, status: 'active', badge: 'waits for 1 ack' }, { ...r1, status: 'ok', badge: 'sync' }, { ...r2, badge: 'async' }, { ...r3, badge: 'async' }],
        links: [link('primary', 'r1', { label: 'waits' }), link('primary', 'r2', { style: 'dashed' }), link('primary', 'r3', { style: 'dashed' })],
        flows: [
          { path: ['primary', 'r1'], tone: 'data', label: 'WAL', duration: 0.9 },
          { path: ['r1', 'primary'], tone: 'handshake', label: 'ack', duration: 0.9, delay: 1 },
          { path: ['primary', 'r2'], tone: 'data', duration: 1.4, delay: 2 },
          { path: ['primary', 'r3'], tone: 'data', duration: 1.6, delay: 2 },
        ],
        panel: {
          title: 'Pick per transaction',
          icon: 'Split',
          rows: [
            { text: 'Payment', value: 'wait for copy', tone: 'good' },
            { text: 'Like counter', value: 'no wait' },
          ],
        },
      },
      code: {
        language: 'sql',
        title: 'PostgreSQL: one sync replica, opt out per transaction',
        source: `-- wait for the first healthy standby in this list
ALTER SYSTEM SET synchronous_standby_names = 'FIRST 1 (replica1, replica2)';
ALTER SYSTEM SET synchronous_commit = 'on';
SELECT pg_reload_conf();

-- a like counter can skip the standby wait (still flushed locally)
BEGIN;
SET LOCAL synchronous_commit = 'local';
UPDATE posts SET likes = likes + 1 WHERE id = 42;
COMMIT;`,
        highlight: [2, 8],
      },
    },
    {
      title: 'Lag',
      tag: 'concept',
      heading: 'Async replicas are always a little behind',
      eli5: '**Replication lag** is how far a copy is behind the main book. When the librarian writes lots of pages fast, the helper for replica 2 falls behind and that copy tells an older story for a while.',
      body: [
        'On a quiet day lag is **5 to 50 ms** and nobody notices. Then a nightly job updates 2 million rows. The primary writes the log faster than replica 2 can replay it, and its lag climbs to **2.4 seconds**.',
        'Lag is normal, so measure it. Alert past a threshold, and take a lagging replica out of the read pool until it catches up.',
      ],
      keyIdea: 'Every async replica shows you the past. Usually that is 20 ms ago. Under load it can be seconds.',
      metrics: { replicas: '3', reads: '30K/s', lag: '2.4 s', commit: '2 ms', risk: 'last 2.4 s' },
      metricTones: { lag: 'bad', risk: 'bad' },
      scene: {
        nodes: [
          { ...primary, status: 'active', chips: ['batch: 2M rows'] },
          { ...r1, badge: 'lag 30 ms' },
          { ...r2, status: 'hot', load: 95, badge: 'lag 2.4 s' },
          { ...r3, badge: 'lag 40 ms' },
        ],
        links: [link('primary', 'r1', { style: 'dashed' }), link('primary', 'r2', { style: 'dashed', label: 'backlog', labelTone: 'warn' }), link('primary', 'r3', { style: 'dashed' })],
        flows: [
          { path: ['primary', 'r1'], tone: 'data', count: 3, duration: 1 },
          { path: ['primary', 'r2'], tone: 'data', count: 6, duration: 3.2 },
          { path: ['primary', 'r3'], tone: 'data', count: 3, duration: 1 },
        ],
        panel: {
          title: 'Replica lag',
          icon: 'Clock',
          rows: [
            { text: 'replica 1', value: '30 ms', tone: 'good' },
            { text: 'replica 2', value: '2.4 s', tone: 'bad' },
            { text: 'replica 3', value: '40 ms', tone: 'good' },
          ],
          footer: { text: 'Alert, then pull replica 2 from reads', tone: 'warn' },
        },
      },
    },
    {
      title: 'Stale read',
      tag: 'case',
      heading: 'Case: my change disappeared',
      eli5: 'You draw a new picture in the main book, then peek at replica 2, a copy whose helper is still behind. Your picture is not there yet! Always seeing your own new page is called **read-your-writes**.',
      body: [
        'A user saves a new shipping address. The write hits the primary and succeeds. The page reloads and reads the profile from replica 2, 2.4 seconds behind. The old address comes back.',
        'The new address is safe on the primary, but the user may save again or ship to the old one. Seeing others\' changes late is fine. Seeing your own vanish feels broken.',
      ],
      keyIdea: 'Async replicas break read-your-writes. Users forgive late changes from others, not from themselves.',
      metrics: { replicas: '3', reads: '30K/s', lag: '2.4 s', commit: '2 ms', risk: 'last 2.4 s' },
      metricTones: { lag: 'bad' },
      scene: {
        nodes: [
          { ...app, status: 'hot', badge: 'old address?!' },
          { ...primary, status: 'ok', chips: [{ text: 'address: new', tone: 'good' }] },
          { ...r2, status: 'hot', chips: [{ text: 'address: old', tone: 'bad' }] },
        ],
        links: [link('app', 'primary'), link('app', 'r2'), link('primary', 'r2', { style: 'dashed', label: 'lag 2.4 s', labelTone: 'warn' })],
        flows: [
          { path: ['app', 'primary'], tone: 'request', label: 'save address', duration: 1.2 },
          { path: ['primary', 'app'], tone: 'response', label: '200 OK', duration: 1.2, delay: 1.3 },
          { path: ['app', 'r2'], tone: 'request', label: 'reload profile', duration: 1.2, delay: 2.8 },
          { path: ['r2', 'app'], tone: 'error', label: 'old row', duration: 1.2, delay: 4.1 },
        ],
        panel: {
          title: 'The user timeline',
          icon: 'Clock',
          rows: [
            { text: '0.0 s save address', value: 'primary' },
            { text: '0.1 s 200 OK', value: 'primary', tone: 'good' },
            { text: '0.5 s reload profile', value: 'replica 2', tone: 'warn' },
            { text: 'Page shows', value: 'old address', tone: 'bad' },
          ],
        },
      },
    },
    {
      title: 'Pin writers',
      tag: 'concept',
      heading: 'Fix 1: send recent writers to the primary',
      eli5: 'If you just added a page, the librarian lets you read from the main book for a little while, so you see your page. Everyone else keeps reading the copies.',
      body: [
        'After a user writes, send their reads to the **primary** for a few seconds, longer than typical lag. It is cheap and covers most "my edit vanished" complaints.',
        'Only that user\'s reads move. Replicas keep serving everyone else, so read capacity barely drops.',
      ],
      keyIdea: 'Route a user\'s reads by what they just did. Only the reads that need fresh data go to the primary.',
      metrics: { replicas: '3', reads: '29K/s', lag: '2.4 s', commit: '2 ms', risk: 'last 2.4 s' },
      scene: {
        nodes: [
          { ...app, status: 'ok', chips: [{ text: 'wrote 2 s ago', tone: 'good' }] },
          { ...primary, status: 'active', chips: ['reads for recent writers'] },
          { ...r2, status: 'hot', badge: 'lag 2.4 s' },
        ],
        links: [link('app', 'primary'), link('app', 'r2', { style: 'faint' }), link('primary', 'r2', { style: 'dashed' })],
        flows: [
          { path: ['app', 'primary'], tone: 'request', label: 'save', duration: 1.2 },
          { path: ['app', 'primary'], tone: 'request', label: 'reload (within 5 s)', duration: 1.2, delay: 1.4 },
          { path: ['primary', 'app'], tone: 'response', label: 'new row', duration: 1.2, delay: 2.7 },
        ],
        panel: {
          title: 'Routing rule',
          icon: 'Route',
          rows: [
            { text: 'Wrote in the last 5 s', value: 'primary', tone: 'good' },
            { text: 'Everyone else', value: 'any replica' },
          ],
        },
      },
      code: {
        language: 'python',
        title: 'Read from the primary right after a write',
        source: `STICKY_SECONDS = 5

def save_address(session, user_id, address):
    primary.execute("UPDATE users SET address = %s WHERE id = %s",
                    address, user_id)
    session["wrote_at"] = time.time()

def load_profile(session, user_id):
    recent = time.time() - session.get("wrote_at", 0) < STICKY_SECONDS
    db = primary if recent else random.choice(replicas)
    return db.query_one("SELECT * FROM users WHERE id = %s", user_id)`,
        highlight: [6, 9, 10],
      },
      quiz: {
        question: 'A user changes their avatar, refreshes, and sees the old one. Replica lag is 2 seconds. What is the cheapest fix?',
        options: [
          'Make all replication synchronous',
          'Send that user\'s reads to the primary for a few seconds after they write',
          'Add two more replicas',
          'Cache avatars in Redis for an hour',
        ],
        answer: 1,
        explain: 'Only the writer needs to see the change at once. Pinning their next few seconds of reads to the primary fixes it without slowing every write. More replicas do not reduce lag, and a long cache makes it worse.',
      },
    },
    {
      title: 'Log position',
      tag: 'concept',
      heading: 'Fix 2: read from a replica that has caught up',
      eli5: 'When you write a page, the librarian hands you a ticket with a page number. You only read from a copy whose diary has reached that number. If none has, you read the main book.',
      body: [
        'Remember the **LSN** of the user\'s last write. Read only from a replica whose replayed position is at or past it, else fall back to the primary.',
        'This is more precise than a timer. It costs a position check per read and the app must track one value per session.',
      ],
      keyIdea: 'A log position turns "fresh enough" into a check you can make, instead of a guess about time.',
      metrics: { replicas: '3', reads: '29K/s', lag: '2.4 s', commit: '2 ms', risk: 'last 2.4 s' },
      scene: {
        nodes: [
          { ...app, chips: [{ text: 'my write: 0/3000A8', tone: 'good' }] },
          { ...r1, status: 'ok', badge: 'at 0/3000B0' },
          { ...r2, status: 'hot', badge: 'at 0/2FF000' },
        ],
        links: [link('app', 'r1'), link('app', 'r2', { style: 'faint' })],
        flows: [
          { path: ['app', 'r2'], tone: 'error', label: 'behind: skip', duration: 1.2 },
          { path: ['app', 'r1'], tone: 'request', label: 'SELECT', duration: 1.2, delay: 1.4 },
          { path: ['r1', 'app'], tone: 'response', label: 'new row', duration: 1.2, delay: 2.7 },
        ],
        panel: {
          title: 'Which replica can answer?',
          icon: 'Table',
          rows: [
            { text: 'Need position at least', value: '0/3000A8' },
            { text: 'replica 1 at 0/3000B0', value: 'ok', tone: 'good' },
            { text: 'replica 2 at 0/2FF000', value: 'too old', tone: 'bad' },
          ],
        },
      },
    },
    {
      title: 'Monotonic',
      tag: 'concept',
      heading: 'Fix 3: never let time run backwards',
      eli5: 'You peek at one copy and see a new picture. You peek again, but a different helper shows an older copy and the picture is gone. Staying with one helper stops that.',
      body: [
        'A user who never writes can still see odd things. One refresh hits replica 1 (new comment visible). The next hits replica 2, which is behind, so the comment vanishes.',
        '**Monotonic reads** means a user never sees older data after newer data. Pin each user to one replica, for example by hashing the user id.',
      ],
      keyIdea: 'Pin each user to one replica so their view only moves forward, even when that replica is stale.',
      metrics: { replicas: '3', reads: '29K/s', lag: '2.4 s', commit: '2 ms', risk: 'last 2.4 s' },
      scene: {
        nodes: [
          { ...app, chips: ['refresh 1', 'refresh 2'] },
          { ...r1, status: 'ok', chips: [{ text: '5 comments', tone: 'good' }] },
          { ...r2, status: 'hot', chips: [{ text: '4 comments', tone: 'bad' }] },
        ],
        links: [link('app', 'r1'), link('app', 'r2')],
        flows: [
          { path: ['app', 'r1', 'app'], tone: 'response', label: 'refresh 1: 5', duration: 1.6 },
          { path: ['app', 'r2', 'app'], tone: 'error', label: 'refresh 2: 4?!', duration: 1.6, delay: 1.8 },
        ],
        panel: {
          title: 'Same user, two refreshes',
          icon: 'Repeat',
          rows: [
            { text: 'Random replica', value: '5, then 4', tone: 'bad' },
            { text: 'Pinned to replica 1', value: '5, then 5', tone: 'good' },
          ],
          footer: { text: 'Pin with hash(user_id) % replicas', tone: 'muted' },
        },
      },
    },
    {
      title: 'Prefix reads',
      tag: 'concept',
      heading: 'Causal order can break across partitions',
      eli5: 'A story page says "the dragon left", and a later page says "why did the dragon leave?". If a copy shows the answer before the question, the story is nonsense.',
      body: [
        'A user posts a question and someone answers, but the two rows live in different partitions. Each partition is its own primary with its own replicas, and each replicates on its own clock.',
        '**Consistent prefix reads** guarantee readers see writes in the order they happened. Keep causally related writes in one partition, or track dependencies. Splitting data this way is covered in the sharding lesson.',
      ],
      keyIdea: 'Readers should see a valid prefix of history. Related writes must replicate in order.',
      metrics: { replicas: '3', reads: '29K/s', lag: 'uneven', commit: '2 ms', risk: 'out-of-order views' },
      scene: {
        nodes: [
          { ...primary, id: 'pA', at: at(-5.4, -6), label: 'shard A primary', sub: 'questions', status: 'active' },
          { ...primary, id: 'pB', at: at(1.8, -6), label: 'shard B primary', sub: 'answers', status: 'active' },
          { ...r1, id: 'rA', at: at(-5.4, 2.5), label: 'shard A replica', badge: 'lag 3 s', status: 'hot' },
          { ...r2, id: 'rB', at: at(1.8, 2.5), label: 'shard B replica', badge: 'lag 20 ms', status: 'ok' },
          { ...app, id: 'reader', at: at(-1.8, 7), label: 'reader', sub: 'one page view' },
        ],
        links: [
          link('pA', 'rA', { style: 'dashed', label: 'slow', labelTone: 'warn' }),
          link('pB', 'rB', { style: 'dashed' }),
          link('reader', 'rA', { style: 'faint' }),
          link('reader', 'rB', { style: 'faint' }),
        ],
        flows: [
          { path: ['pA', 'rA'], tone: 'data', label: 'question', duration: 3 },
          { path: ['pB', 'rB'], tone: 'data', label: 'answer', duration: 1, delay: 0.3 },
          { path: ['reader', 'rB', 'reader'], tone: 'response', label: 'sees answer', duration: 1.6, delay: 3.4 },
        ],
        panel: {
          title: 'What a reader sees',
          icon: 'List',
          rows: [
            { text: 'Answer: Because it rained', value: 'visible', tone: 'warn' },
            { text: 'Question: Why late?', value: 'missing', tone: 'bad' },
          ],
          footer: { text: 'Answer before question', tone: 'bad' },
        },
      },
    },
    {
            title: 'Detect',
      tag: 'case',
      heading: 'Case: the primary dies at 2 AM',
      eli5: 'The main book gets lost at night! A watcher, the failover manager, keeps asking "are you there?" and after ten quiet seconds decides the book is gone.',
      body: [
        'A **failover manager** (Patroni, RDS Multi-AZ, Orchestrator) pings the primary. After about **10 seconds** without a heartbeat it declares it dead.',
        'Shorter timeouts cause false alarms from a brief network blip. Longer ones mean more downtime. Every second of waiting is a second of failed writes.',
      ],
      keyIdea: 'Detecting a dead primary is a guess, and the timeout trades false alarms against downtime.',
      metrics: { replicas: '3', reads: '30K/s', lag: '20 ms', commit: 'failing', risk: 'writes down' },
      metricTones: { commit: 'bad', risk: 'bad' },
      scene: {
        nodes: [
          { ...app, status: 'hot', chips: [{ text: 'write errors', tone: 'bad' }] },
          { ...primary, status: 'down', badge: 'no heartbeat' },
          { ...mgr, status: 'active', badge: '10 s timeout' },
        ],
        links: [link('app', 'primary', { style: 'faint' }), link('mgr', 'primary', { style: 'dashed', label: 'heartbeat', labelTone: 'warn' })],
        flows: [
          { path: ['mgr', 'primary'], tone: 'error', label: 'heartbeat?', duration: 1.2 },
          { path: ['app', 'primary'], tone: 'error', label: 'write fails', duration: 1.2, delay: 1.4 },
        ],
        panel: {
          title: 'Timeout trade-off',
          icon: 'Timer',
          rows: [
            { text: '2 s timeout', value: 'false alarms', tone: 'warn' },
            { text: '10 s timeout', value: 'balanced', tone: 'good' },
            { text: '60 s timeout', value: 'long outage', tone: 'bad' },
          ],
        },
      },
    },
    {
      title: 'Promote',
      tag: 'concept',
      heading: 'Promote the freshest replica',
      eli5: 'The watcher asks every helper "how many pages have you copied?", picks the one with the most, and tells everyone: this copy is the new main book now.',
      body: [
        'The manager picks the replica with the highest replayed log position and **promotes** it: it stops replaying and starts accepting writes. The other replicas re-point to it.',
        'The app is redirected through DNS, a virtual IP or a proxy. The whole sequence takes about **30 seconds**, versus hours for a restore.',
      ],
      keyIdea: 'Failover turns the database died into about 30 seconds of write errors.',
      metrics: { replicas: '2', reads: '20K/s', lag: '20 ms', commit: '2 ms', risk: 'last ~20 ms lost' },
      metricTones: { reads: 'warn' },
      scene: {
        nodes: [
          { ...primary, status: 'down', badge: 'dead' },
          { ...r2, kind: 'db', label: 'new primary', sub: 'was replica 2', status: 'ok', badge: 'promoted' },
          { ...r1, status: 'active', badge: 'follows new primary' },
          { ...mgr, at: at(3.6, 0), status: 'active', badge: 'picks highest LSN' },
        ],
        links: [
          link('mgr', 'r2', { style: 'dashed', label: 'promote' }),
          link('r2', 'r1', { style: 'dashed', label: 'replicate' }),
          link('primary', 'r2', { style: 'faint' }),
        ],
        flows: [
          { path: ['mgr', 'r2'], tone: 'event', label: 'promote', duration: 1.4 },
          { path: ['r2', 'r1'], tone: 'data', label: 'follow me', duration: 1.4, delay: 1.6 },
        ],
        panel: {
          title: 'Failover steps',
          icon: 'List',
          rows: [
            { text: '1. Detect', value: '~10 s' },
            { text: '2. Promote freshest replica', value: '~5 s' },
            { text: '3. Re-point replicas and app', value: '~15 s' },
            { text: 'App finds new primary via', value: 'proxy, VIP or DNS' },
            { text: 'Total', value: '~30 s', tone: 'warn' },
          ],
        },
      },
    },
    {
      title: 'Lost writes',
      tag: 'tradeoff',
      heading: 'Failover can drop the newest writes',
      eli5: 'The old main book had three new pages the helpers had not copied yet. The new main book never got them, so those pages are lost, even though you were told they were saved.',
      body: [
        'With async replication, writes the old primary committed but never shipped are gone. Here that is the last ~20 ms. If the old primary comes back, those writes conflict with the new history and are usually discarded.',
        'With a sync replica, promote that one and nothing is lost. That is the case for semi-sync on important data.',
      ],
      keyIdea: 'Async failover trades a small window of lost writes for fast commits. Sync keeps them.',
      metrics: { replicas: '2', reads: '20K/s', lag: '20 ms', commit: '2 ms', risk: 'last ~20 ms lost' },
      metricTones: { risk: 'bad' },
      scene: {
        nodes: [
          { ...primary, status: 'down', chips: [{ text: 'order 9001 (unshipped)', tone: 'bad' }] },
          { ...r2, kind: 'db', label: 'new primary', status: 'ok', chips: [{ text: 'no order 9001', tone: 'warn' }] },
          { ...app, chips: [{ text: 'was told: saved', tone: 'warn' }] },
        ],
        links: [link('app', 'r2'), link('primary', 'r2', { style: 'faint', label: 'never arrived', labelTone: 'warn' })],
        flows: [
          { path: ['primary', 'r2'], tone: 'error', label: 'order 9001', duration: 1.4 },
          { path: ['app', 'r2'], tone: 'request', label: 'order 9001?', duration: 1.2, delay: 1.6 },
          { path: ['r2', 'app'], tone: 'error', label: 'not found', duration: 1.2, delay: 2.9 },
        ],
        panel: {
          title: 'What was lost',
          icon: 'Shield',
          rows: [
            { text: 'Async, lag 20 ms', value: 'last ~20 ms', tone: 'bad' },
            { text: 'Semi-sync', value: 'nothing', tone: 'good' },
          ],
          footer: { text: 'Customers saw order confirmed', tone: 'warn' },
        },
      },
    },
    {
      title: 'Split brain',
      tag: 'tradeoff',
      heading: 'Two primaries, two histories',
      eli5: 'Oops, the old main book was not lost, only stuck in another room. Now two librarians write different stories in two main books. That mix-up is **split brain**.',
      body: [
        'The old primary may not be dead. A network split can cut it off from the failover manager while app servers in its zone still reach it. Now **two primaries** accept writes.',
        'Zone A sells the last pair of shoes and sets stock to 0. Zone B sells the same pair. When the network heals the two histories cannot be merged: oversold stock, lost orders and manual cleanup.',
      ],
      keyIdea: 'If the old primary does not know it was replaced, you get two writers and data that cannot be merged.',
      metrics: { replicas: '1', reads: '20K/s', lag: 'diverging', commit: '2 ms', risk: 'conflicting writes' },
      metricTones: { lag: 'bad', risk: 'bad' },
      scene: {
        zones: [
          { id: 'azA', from: [-3.4, 0.4], to: [1.8, 3.4], label: 'zone A', tone: 'blue' },
          { id: 'azB', from: [-0.5, -4.5], to: [5, 0], label: 'zone B', tone: 'amber' },
        ],
        nodes: [
          { ...app, at: at(-4.2, 0), label: 'app A', status: 'active' },
          { ...primary, at: at(-0.8, 2.4), status: 'hot', badge: 'still primary?' },
          { ...r2, kind: 'db', at: at(3.6, -2.4), label: 'new primary', status: 'hot', badge: 'also primary' },
          { ...app, id: 'app2', at: at(7.4, 3), label: 'app B', status: 'active' },
        ],
        links: [
          link('app', 'primary'),
          link('app2', 'r2'),
          link('primary', 'r2', { style: 'dashed', label: 'network split', labelTone: 'warn' }),
        ],
        flows: [
          { path: ['app', 'primary'], tone: 'request', label: 'stock 1 to 0', duration: 1.2 },
          { path: ['app2', 'r2'], tone: 'request', label: 'stock 1 to 0', duration: 1.2, delay: 0.3 },
          { path: ['primary', 'r2'], tone: 'error', label: 'cannot sync', duration: 1.4, delay: 1.8 },
        ],
        caption: 'Same item, sold twice',
      },
    },
    {
      title: 'Fencing',
      tag: 'concept',
      heading: 'Quorum and fencing keep one leader',
      eli5: 'Helpers vote, and the main book needs a majority. The old librarian gets a note that her turn is over, and the book room refuses pages with an old turn number.',
      body: [
        'Leadership is decided by a **majority vote** of 3 or 5 nodes, run by etcd or ZooKeeper (which use Raft or a similar protocol), so a cut-off minority cannot elect itself. The consensus lesson explains how.',
        '**Fencing** stops the loser: its lease expires, or **STONITH** powers it off. Fenced storage and lock services also give each leader an **epoch** number and reject writes from an older one.',
      ],
      keyIdea: 'Failover is only safe if the old primary is guaranteed to stop. Use a majority vote and fence the loser.',
      metrics: { replicas: '2', reads: '20K/s', lag: '20 ms', commit: '2 ms', risk: 'one writer only' },
      metricTones: { risk: 'good' },
      scene: {
        nodes: [
          { ...primary, status: 'down', badge: 'fenced', chips: [{ text: 'epoch 7', tone: 'bad' }] },
          { ...r2, kind: 'db', label: 'new primary', status: 'ok', chips: [{ text: 'epoch 8', tone: 'good' }] },
          { ...mgr, at: at(3.6, 0), label: 'etcd quorum', sub: '3 voters', status: 'active' },
        ],
        links: [link('mgr', 'r2', { style: 'dashed', label: 'lease: epoch 8' }), link('primary', 'r2', { style: 'faint' })],
        flows: [
          { path: ['mgr', 'r2'], tone: 'event', label: 'epoch 8', duration: 1.4 },
          { path: ['primary', 'r2'], tone: 'error', label: 'write, epoch 7', duration: 1.4, delay: 1.6 },
        ],
        panel: {
          title: 'Guards against split brain',
          icon: 'Shield',
          rows: [
            { text: 'Majority vote', value: 'minority cannot lead', tone: 'good' },
            { text: 'Lease expiry', value: 'old primary stops', tone: 'good' },
            { text: 'Epoch check', value: 'fenced storage rejects old writes', tone: 'good' },
            { text: 'STONITH', value: 'power off the old node', tone: 'good' },
          ],
        },
      },
    },
    {
      title: 'Old primary',
      tag: 'concept',
      heading: 'The old primary returns as a replica',
      eli5: 'The lost main book turns up the next morning. It cannot just go back on the desk. It must hand in its extra pages, copy the new main book, and become a helper.',
      body: [
        'When the old primary comes back it must **not** accept writes. It is demoted and its unshipped writes are discarded, or **rewound** to the point where histories split (`pg_rewind`), or it is rebuilt from a fresh snapshot.',
        'Then it follows the new primary as an ordinary replica. Skipping this step leaves two diverging histories.',
      ],
      keyIdea: 'A returning old primary is demoted, rewound or rebuilt, and rejoins as a replica.',
      metrics: { replicas: '3', reads: '30K/s', lag: 'catching up', commit: '2 ms', risk: 'old writes discarded' },
      scene: {
        nodes: [
          { ...r2, kind: 'db', label: 'new primary', status: 'ok' },
          { ...primary, label: 'old primary', sub: 'back online', status: 'active', badge: 'demoted', chips: [{ text: 'extra: order 9001', tone: 'warn' }] },
          { ...mgr, at: at(3.6, 0), status: 'active' },
        ],
        links: [link('mgr', 'primary', { style: 'dashed', label: 'demote' }), link('r2', 'primary', { style: 'dashed', label: 'follow' })],
        flows: [
          { path: ['mgr', 'primary'], tone: 'event', label: 'demote', duration: 1.4 },
          { path: ['r2', 'primary'], tone: 'data', label: 'rewind, replay', duration: 1.6, delay: 1.6 },
        ],
        panel: {
          title: 'Rejoining safely',
          icon: 'List',
          rows: [
            { text: '1. Stop accepting writes', value: 'demote' },
            { text: '2. Discard or rewind extra writes', value: 'pg_rewind', tone: 'warn' },
            { text: '3. Follow the new primary', value: 'replica', tone: 'good' },
          ],
        },
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Copies scale reads and survive failure',
      eli5: 'One main book for writing, copies for reading, and a watcher ready to pick a new main book. That is **replication**. Copies are a tiny bit behind, so read the main book when you need the newest page.',
      body: [
        'A primary streams its log to replicas. Reads scale with replicas, writes do not. Async is fast and can lose the newest writes on failover. Sync loses nothing and adds a round trip.',
        'Lag breaks read-your-writes, so route reads by what a user just did. Failover takes about 30 seconds and needs quorum and fencing to avoid split brain.',
      ],
      keyIdea: 'Every copy is a little behind. Decide where that is fine, where it is not, and route reads to match.',
      metrics: { replicas: '3', reads: '30K/s', lag: '20 ms', commit: '3 ms (1 sync)', risk: '0 committed writes' },
      metricTones: { reads: 'good', risk: 'good' },
      scene: {
        nodes: [
          app,
          { ...primary, status: 'ok' },
          { ...r1, status: 'ok' },
          { ...r2, status: 'ok' },
          { ...r3, status: 'ok' },
        ],
        links: [link('app', 'primary'), link('app', 'r2', { style: 'faint' }), ...feed()],
        flows: [
          { path: ['app', 'primary'], tone: 'request', label: 'write', duration: 1.2 },
          { path: ['primary', 'r1'], tone: 'data', duration: 1.2, delay: 1.3 },
          { path: ['primary', 'r2'], tone: 'data', duration: 1.2, delay: 1.3 },
          { path: ['primary', 'r3'], tone: 'data', duration: 1.2, delay: 1.3 },
          { path: ['app', 'r2', 'app'], tone: 'response', label: 'read', duration: 1.6, delay: 2.8 },
        ],
        panel: {
          title: 'Checklist',
          icon: 'List',
          rows: [
            { text: 'Reads scale with replicas', value: 'yes', tone: 'good' },
            { text: 'Writes scale with replicas', value: 'no', tone: 'warn' },
            { text: 'Lag handled by routing', value: 'yes', tone: 'good' },
            { text: 'Failover fenced by quorum', value: 'yes', tone: 'good' },
          ],
        },
      },
      quiz: {
        question: 'Your primary commits asynchronously and replica lag is 50 ms. The primary crashes and a replica is promoted. What can you lose?',
        options: [
          'Nothing, replicas have every write',
          'Roughly the last 50 ms of acknowledged writes',
          'All writes from the last hour',
          'Only data from the replicas that lagged',
        ],
        answer: 1,
        explain: 'Async commits answer the client before shipping the log. Writes in flight when the primary dies never reached the replica, so about one lag window of acknowledged writes is lost. A sync replica would close that window.',
      },
    },
  ],
};
