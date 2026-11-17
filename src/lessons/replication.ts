import type { Lesson, SceneNode } from '../engine/types';

const client: SceneNode = { id: 'client', kind: 'client', at: [-2.9, 2.9], label: 'shop app' };
const server: SceneNode = { id: 'server', kind: 'server', at: [-1.2, 1.2], label: 'app server' };
const primary: SceneNode = { id: 'primary', kind: 'db', at: [-1.4, -2.6], label: 'primary', sub: 'takes writes' };
const r1: SceneNode = { id: 'r1', kind: 'replica', at: [1.7, -4.9], label: 'replica 1' };
const r2: SceneNode = { id: 'r2', kind: 'replica', at: [2.7, -1.9], label: 'replica 2' };
const r3: SceneNode = { id: 'r3', kind: 'replica', at: [3.7, 1.1], label: 'replica 3' };
const manager: SceneNode = { id: 'manager', kind: 'monitor', at: [-3.8, -1.6], label: 'failover manager', sub: 'Patroni' };
const server2: SceneNode = { id: 'server2', kind: 'server', at: [3.7, -5.3], label: 'app server 2' };

const userUs: SceneNode = { id: 'userUs', kind: 'phone', at: [-2.4, 3.4], label: 'user', sub: 'New York' };
const leaderUs: SceneNode = { id: 'leaderUs', kind: 'db', at: [-1.9, -0.1], label: 'leader US' };
const leaderEu: SceneNode = { id: 'leaderEu', kind: 'db', at: [0.4, -2.4], label: 'leader EU' };
const userEu: SceneNode = { id: 'userEu', kind: 'phone', at: [3.7, -2.7], label: 'user', sub: 'Berlin' };

const replicaLinks = [
  { from: 'client', to: 'server' },
  { from: 'server', to: 'primary' },
  { from: 'primary', to: 'r1', style: 'dashed' as const },
  { from: 'primary', to: 'r2', style: 'dashed' as const },
  { from: 'primary', to: 'r3', style: 'dashed' as const },
];

export const replication: Lesson = {
  id: 'replication',
  title: 'Replication',
  tagline: 'Copy the database to scale reads and survive a dead machine, and learn what the copies cost you.',
  minutes: 15,
  level: 'Intermediate',
  learn: [
    'How a primary streams its changes to read replicas',
    'Synchronous vs asynchronous replication and what each one risks',
    'Why replication lag breaks read-your-writes, and how to fix it',
    'How failover promotes a replica, and how split brain happens',
    'Multi-leader setups and leaderless quorums (R + W > N)',
  ],
  metrics: [
    { key: 'replicas', label: 'Replicas' },
    { key: 'reads', label: 'Read capacity' },
    { key: 'lag', label: 'Lag' },
    { key: 'commit', label: 'Commit time' },
    { key: 'risk', label: 'Data at risk' },
  ],
  steps: [
    {
      title: 'Read wall',
      tag: 'problem',
      heading: 'The database is pinned at 100% CPU',
      eli5: 'The **database** is the one storybook in the library, and thirty kids want to read it at the same time. Everyone waits in a long line, and if the book gets lost, the story is gone.',
      body: [
        'The shop is growing. At peak it serves **30K reads/s** and only **1K writes/s**: product pages, carts and order history are read far more often than they change.',
        'One SQL machine tops out around **10K reads/s**. Pages time out, and a bigger machine buys a few months at best. Worse, this one box is the only copy of the data. If its disk dies, you restore from last night\'s backup.',
      ],
      keyIdea: 'A single database is both a throughput ceiling and a single point of failure. Copies fix both, at a price.',
      metrics: { replicas: '0', reads: '10K/s (need 30K)', lag: '-', commit: '2 ms', risk: 'since last backup' },
      scene: {
        nodes: [client, { ...server, status: 'hot' }, { ...primary, label: 'database', sub: 'only copy', status: 'hot', badge: '100% CPU' }],
        links: [
          { from: 'client', to: 'server' },
          { from: 'server', to: 'primary' },
        ],
        flows: [
          { path: ['client', 'server'], tone: 'request', count: 4, duration: 1 },
          { path: ['server', 'primary'], tone: 'request', label: 'SELECT…', count: 6, duration: 1.4, delay: 0.4 },
        ],
        caption: '30 reads for every write',
      },
    },
    {
      title: 'Replicas',
      tag: 'concept',
      heading: 'One primary for writes, replicas for reads',
      eli5: 'Each **replica** is a copy of the main book. The librarian writes new pages only in the main book, helpers copy every new page over, and the kids read from the three copies.',
      body: [
        'Keep one **primary** that accepts every write. Add **read replicas** that hold full copies. Each change on the primary is recorded in its **write-ahead log** (WAL), and that log is streamed to the replicas, which replay it in the same order.',
        'The app sends writes to the primary and spreads reads across replicas. Three replicas at ~10K reads/s each cover the 30K peak, and the primary keeps its CPU for writes. Read capacity grows roughly linearly with replicas.',
        'Writes do not get any faster. Every replica replays every write, so the primary is still the ceiling for writes. That problem gets its own lesson (sharding).',
      ],
      keyIdea: 'Replication scales reads by adding copies. It does nothing for write throughput.',
      metrics: { replicas: '3', reads: '40K/s', lag: '20 ms', commit: '2 ms', risk: 'last ~20 ms' },
      scene: {
        nodes: [client, server, { ...primary, status: 'active', badge: '1K writes/s' }, { ...r1, badge: '10K reads/s' }, { ...r2, badge: '10K reads/s' }, { ...r3, badge: '10K reads/s' }],
        links: [
          ...replicaLinks,
          { from: 'server', to: 'r1', style: 'faint' },
          { from: 'server', to: 'r2', style: 'faint' },
          { from: 'server', to: 'r3', style: 'faint' },
        ],
        flows: [
          { path: ['server', 'primary'], tone: 'request', label: 'UPDATE', duration: 1 },
          { path: ['primary', 'r1'], tone: 'data', label: 'WAL', duration: 1, delay: 1.1 },
          { path: ['primary', 'r2'], tone: 'data', duration: 1.2, delay: 1.1 },
          { path: ['primary', 'r3'], tone: 'data', duration: 1.4, delay: 1.1 },
          { path: ['server', 'r1'], tone: 'request', label: 'SELECT', duration: 1.2, delay: 2.6 },
          { path: ['server', 'r2'], tone: 'request', duration: 1.2, delay: 2.6 },
          { path: ['server', 'r3'], tone: 'request', duration: 1.2, delay: 2.6 },
        ],
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
      title: 'Sync or async',
      tag: 'tradeoff',
      heading: 'Wait for the copy, or don\'t',
      eli5: '**Synchronous** means the librarian waits until one helper says "copied!" before telling you your page is saved. It takes a bit longer, but the page is safe even if the main book gets lost.',
      body: [
        'With **asynchronous** replication the primary commits locally, answers the client, and ships the change afterwards. Commits stay fast (2 ms), but if the primary dies, any writes it had not shipped yet are gone.',
        'With **synchronous** replication the primary waits until at least one replica confirms it has the change. You lose nothing on failover, but every commit pays a round trip: about 1 ms within a datacenter, 60 ms or more across regions. If that replica stalls, writes stall too.',
        'The common middle ground is **semi-synchronous**: one replica is synchronous and the rest are async. You can also choose per transaction: payments wait for the copy, a page-view counter does not.',
      ],
      keyIdea: 'Sync replication buys zero data loss with latency on every write. Async buys speed with a small window of loss.',
      metrics: { replicas: '3 (1 sync)', reads: '40K/s', lag: '20 ms', commit: '3 ms', risk: '0 committed writes' },
      scene: {
        nodes: [client, server, { ...primary, status: 'active', badge: 'waits for 1 ack' }, { ...r1, status: 'ok', badge: 'sync' }, { ...r2, badge: 'async' }, { ...r3, badge: 'async' }],
        links: [...replicaLinks],
        flows: [
          { path: ['server', 'primary'], tone: 'request', label: 'COMMIT', duration: 1 },
          { path: ['primary', 'r1'], tone: 'data', label: 'WAL', duration: 0.9, delay: 1.05 },
          { path: ['r1', 'primary'], tone: 'handshake', label: 'ack', duration: 0.9, delay: 2 },
          { path: ['primary', 'server'], tone: 'response', label: 'committed', duration: 1, delay: 3 },
          { path: ['primary', 'r2'], tone: 'data', duration: 1.4, delay: 3 },
          { path: ['primary', 'r3'], tone: 'data', duration: 1.6, delay: 3 },
        ],
      },
      code: {
        language: 'sql',
        title: 'PostgreSQL: one sync replica, opt out per transaction',
        source: `-- wait for the first healthy standby in this list
ALTER SYSTEM SET synchronous_standby_names = 'FIRST 1 (replica1, replica2)';
ALTER SYSTEM SET synchronous_commit = 'on';
SELECT pg_reload_conf();

-- a like counter can skip the wait
BEGIN;
SET LOCAL synchronous_commit = 'off';
UPDATE posts SET likes = likes + 1 WHERE id = 42;
COMMIT;`,
        highlight: [2, 8],
      },
    },
    {
      title: 'Lag',
      tag: 'concept',
      heading: 'Replicas are always a little behind',
      eli5: '**Replication lag** is how far a copy is behind the main book. When the librarian writes lots of pages fast, the helper for replica 2 falls behind, and that copy tells an older story for a while.',
      body: [
        'Async replicas trail the primary by the time it takes to ship and replay the log. On a quiet day that is **5 to 50 ms**, and nobody notices.',
        'Then a nightly job updates 2 million rows. The primary writes the WAL faster than replica 2 can replay it, and its **replication lag** climbs to 2.4 seconds. Anything read from replica 2 is now 2.4 seconds old.',
        'Lag is normal, so measure it. Alert when it passes a threshold, and take a lagging replica out of the read pool until it catches up.',
      ],
      keyIdea: 'Every async replica shows you the past. Usually the past is 20 ms ago. Under load it can be seconds.',
      metrics: { replicas: '3', reads: '40K/s', lag: '2.4 s', commit: '2 ms', risk: 'last 2.4 s' },
      scene: {
        nodes: [
          client,
          server,
          { ...primary, status: 'active', badge: 'batch job: 2M rows' },
          { ...r1, badge: 'lag 30 ms' },
          { ...r2, status: 'hot', badge: 'lag 2.4 s' },
          { ...r3, badge: 'lag 40 ms' },
        ],
        links: [...replicaLinks],
        flows: [
          { path: ['primary', 'r1'], tone: 'data', count: 3, duration: 1 },
          { path: ['primary', 'r2'], tone: 'data', label: 'backlog', count: 6, duration: 3.2 },
          { path: ['primary', 'r3'], tone: 'data', count: 3, duration: 1 },
        ],
      },
    },
    {
      title: 'Stale read',
      tag: 'case',
      heading: 'Case: "my change disappeared"',
      eli5: 'You draw a new picture in the main book, then peek at replica 2, a copy whose helper is still behind. Your picture is not there yet! Always seeing your own new page is called **read-your-writes**.',
      body: [
        'A user renames their shipping address and saves. The write goes to the primary and succeeds. The page reloads and reads the profile from replica 2, which is 2.4 seconds behind. The old address comes back.',
        'The user saves again, or files a bug report, or ships the parcel to the old address. The new address is safe on the primary. The page read from a copy that had not caught up yet.',
        'This guarantee has a name: **read-your-writes**. Other people seeing your change a second late is fine for most products. You seeing your own change vanish feels broken.',
      ],
      keyIdea: 'Async replicas break read-your-writes. Users forgive others\' changes arriving late, but not their own.',
      metrics: { replicas: '3', reads: '40K/s', lag: '2.4 s', commit: '2 ms', risk: 'last 2.4 s' },
      scene: {
        nodes: [
          { ...client, status: 'hot', badge: 'old address?!' },
          server,
          { ...primary, status: 'ok', badge: 'new address' },
          { ...r1, status: 'dim' },
          { ...r2, status: 'hot', badge: 'old address' },
          { ...r3, status: 'dim' },
        ],
        links: [...replicaLinks, { from: 'server', to: 'r2' }],
        flows: [
          { path: ['client', 'server', 'primary'], tone: 'request', label: 'save address', duration: 1.4 },
          { path: ['primary', 'server', 'client'], tone: 'response', label: '200 OK', duration: 1.4, delay: 1.5 },
          { path: ['client', 'server', 'r2'], tone: 'request', label: 'reload profile', duration: 1.4, delay: 3 },
          { path: ['r2', 'server', 'client'], tone: 'error', label: 'old row', duration: 1.4, delay: 4.5 },
          { path: ['primary', 'r2'], tone: 'data', duration: 3.5, delay: 1 },
        ],
      },
    },
    {
      title: 'Fixes',
      tag: 'concept',
      heading: 'Three ways to read your own writes',
      eli5: 'If you just added a page, the librarian lets you read from the main book, the **primary**, for a little while, so you see your page. Everyone else keeps reading the copies.',
      body: [
        '**Pin recent writers to the primary.** After a user writes, send their reads to the primary for a few seconds. It is cheap and covers most "my edit vanished" complaints.',
        '**Read from a replica that has caught up.** Remember the log position (LSN) of the user\'s last write. Only read from a replica whose replay position is at or past it, else fall back to the primary.',
        '**Pin each user to one replica.** This gives **monotonic reads**: time never goes backwards for that user, even if they never write. Without it, a refresh can jump to a more stale replica and new feed items vanish.',
      ],
      keyIdea: 'Route a user\'s reads by what they just did. Send only the reads that need fresh data to the primary, and let replicas serve the rest.',
      metrics: { replicas: '3', reads: '38K/s', lag: '2.4 s', commit: '2 ms', risk: 'last 2.4 s' },
      scene: {
        nodes: [
          { ...client, status: 'ok', badge: 'new address' },
          server,
          { ...primary, status: 'active', badge: 'recent writers' },
          r1,
          { ...r2, status: 'hot', badge: 'lag 2.4 s' },
          r3,
        ],
        links: [...replicaLinks],
        flows: [
          { path: ['client', 'server', 'primary'], tone: 'request', label: 'save', duration: 1.4 },
          { path: ['client', 'server', 'primary'], tone: 'request', label: 'reload (within 5 s)', duration: 1.4, delay: 1.6 },
          { path: ['primary', 'server', 'client'], tone: 'response', label: 'new row', duration: 1.4, delay: 3.1 },
        ],
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
      title: 'Failover',
      tag: 'case',
      heading: 'Case: the primary dies at 2 AM',
      eli5: 'The main book gets lost at night! A watcher, the failover manager, notices and picks the copy with the most pages to be the new main book. That swap is called **failover**.',
      body: [
        'Replicas also protect you from a dead machine. A **failover manager** (Patroni, RDS Multi-AZ, Orchestrator) pings the primary. After about 10 seconds without a heartbeat it declares it dead. Shorter timeouts cause false alarms, longer ones mean more downtime.',
        'It picks the replica with the most recent log position and **promotes** it: it stops replaying and starts accepting writes. The other replicas follow the new primary, and the app is repointed through DNS, a virtual IP or a proxy. The whole thing takes about **30 seconds**.',
        'With async replication, writes the old primary committed but never shipped are gone. Here that is the last ~20 ms. With a sync replica, promote that one and nothing is lost.',
      ],
      keyIdea: 'Failover turns "the database died" into 30 seconds of errors, but async replication can drop the newest writes.',
      metrics: { replicas: '2', reads: '30K/s', lag: '20 ms', commit: '2 ms', risk: 'last ~20 ms lost' },
      scene: {
        nodes: [
          client,
          server,
          { ...primary, status: 'down', badge: 'no heartbeat' },
          { ...r1, kind: 'db', label: 'new primary', status: 'ok', badge: 'promoted' },
          r2,
          r3,
          { ...manager, status: 'active', badge: '10 s timeout' },
        ],
        links: [
          { from: 'client', to: 'server' },
          { from: 'server', to: 'primary', style: 'faint' },
          { from: 'server', to: 'r1' },
          { from: 'r1', to: 'r2', style: 'dashed' },
          { from: 'r1', to: 'r3', style: 'dashed' },
          { from: 'manager', to: 'primary', style: 'dashed' },
          { from: 'manager', to: 'r1', style: 'dashed' },
        ],
        flows: [
          { path: ['manager', 'primary'], tone: 'error', label: 'heartbeat?', duration: 1 },
          { path: ['manager', 'r1'], tone: 'event', label: 'promote', duration: 1.2, delay: 1.2 },
          { path: ['server', 'r1'], tone: 'request', label: 'writes', duration: 1.2, delay: 2.6 },
          { path: ['r1', 'r2'], tone: 'data', duration: 1, delay: 3.9 },
          { path: ['r1', 'r3'], tone: 'data', duration: 1.2, delay: 3.9 },
        ],
      },
    },
    {
      title: 'Split brain',
      tag: 'tradeoff',
      heading: 'Two primaries, two histories',
      eli5: 'Oops, the old main book was not lost, only stuck in another room. Now two librarians write different stories in two main books. That mix-up is **split brain**, so helpers vote and only one book stays open for writing.',
      body: [
        'The old primary may not be dead. A network split can cut it off from the failover manager while app servers in its zone still reach it. Now there are **two primaries**, and both accept writes.',
        'Zone A sells the last pair of shoes and sets stock to 0. Zone B sells the same pair. When the network heals, the two histories cannot be merged automatically. That is **split brain**: oversold stock, lost orders and manual cleanup.',
        'The defenses are **quorum** and **fencing**. Leadership is decided by a majority of voters (3 or 5 nodes running etcd, ZooKeeper or Raft), so a cut-off minority cannot elect itself. The old primary\'s lease expires and it stops taking writes, or it gets forcibly shut down. Every leader also carries an epoch number, and storage rejects writes from an older epoch.',
      ],
      keyIdea: 'Failover is only safe if the old primary is guaranteed to stop. Use a majority vote and fence the loser.',
      metrics: { replicas: '1', reads: '20K/s', lag: 'diverging', commit: '2 ms', risk: 'conflicting writes' },
      scene: {
        zones: [
          { id: 'azA', from: [-4.6, -3.6], to: [0.2, 3.9], label: 'zone A', tone: 'blue' },
          { id: 'azB', from: [0.5, -6.2], to: [4.6, -1.5], label: 'zone B', tone: 'amber' },
        ],
        nodes: [
          client,
          server,
          { ...primary, status: 'hot', badge: 'still primary?' },
          { ...r1, kind: 'db', label: 'new primary', status: 'hot', badge: 'also primary' },
          { ...r2, status: 'dim' },
          { ...r3, status: 'dim' },
          { ...server2, status: 'active' },
        ],
        links: [
          { from: 'client', to: 'server' },
          { from: 'server', to: 'primary' },
          { from: 'server2', to: 'r1' },
          { from: 'primary', to: 'r1', style: 'dashed', label: 'network split' },
        ],
        flows: [
          { path: ['server', 'primary'], tone: 'request', label: 'stock 1 → 0', duration: 1.2 },
          { path: ['server2', 'r1'], tone: 'request', label: 'stock 1 → 0', duration: 1.2, delay: 0.3 },
          { path: ['primary', 'r1'], tone: 'error', label: 'cannot sync', duration: 1.4, delay: 1.8 },
        ],
        caption: 'Same item, sold twice',
      },
    },
    {
      title: 'Multi-leader',
      tag: 'concept',
      heading: 'Multi-leader: a writable primary in every region',
      eli5: 'Two libraries far apart each keep a main book of their own, so nobody waits for pages to cross the ocean. That is **multi-leader**. If both write on the same page, someone must pick which story stays.',
      body: [
        'With one primary in Virginia, a user in Berlin pays a cross-Atlantic round trip on every write. **Multi-leader** replication puts a leader in each region. Writes commit locally in 2 ms and the leaders replicate to each other asynchronously, about 80 ms behind.',
        'The new problem is **write conflicts**. Two users edit the same cart in both regions within that 80 ms window. Something must pick a result: **last write wins** (one edit is silently dropped), a merge rule such as "union of cart items", or application code that decides.',
        'Use it when you need local writes in several regions or offline clients that sync later. Avoid it when one primary is fast enough, because conflict handling is easy to get subtly wrong.',
      ],
      keyIdea: 'Multi-leader makes writes local and fast everywhere, and makes conflicts your problem.',
      metrics: { replicas: '2 leaders', reads: 'local', lag: '80 ms cross-region', commit: '2 ms local', risk: 'conflicts' },
      scene: {
        zones: [
          { id: 'us', from: [-3.4, -1.2], to: [-0.9, 4.4], label: 'us-east', tone: 'blue' },
          { id: 'eu', from: [-0.3, -3.6], to: [4.6, -1.4], label: 'eu-west', tone: 'violet' },
        ],
        nodes: [userUs, { ...leaderUs, status: 'active', badge: 'cart: +shoes' }, { ...leaderEu, status: 'active', badge: 'cart: +socks' }, userEu],
        links: [
          { from: 'userUs', to: 'leaderUs' },
          { from: 'userEu', to: 'leaderEu' },
          { from: 'leaderUs', to: 'leaderEu', style: 'dashed', label: '~80 ms' },
        ],
        flows: [
          { path: ['userUs', 'leaderUs'], tone: 'request', label: 'add shoes', duration: 1 },
          { path: ['userEu', 'leaderEu'], tone: 'request', label: 'add socks', duration: 1 },
          { path: ['leaderUs', 'leaderEu'], tone: 'data', duration: 1.6, delay: 1.1 },
          { path: ['leaderEu', 'leaderUs'], tone: 'data', duration: 1.6, delay: 1.1 },
        ],
        caption: 'Both edits win locally. Who wins globally?',
      },
    },
    {
      title: 'Quorums',
      tag: 'concept',
      heading: 'Leaderless: write to W, read from R',
      eli5: 'No main book here, only three copies: A, B and C. A new page counts once two copies have it, and readers always check two copies. That rule is a **quorum**, and one of the two always has the newest page.',
      body: [
        'Dynamo-style stores (Cassandra, DynamoDB, Riak) have no leader. Each key lives on **N** replicas. A write is sent to all of them and succeeds once **W** confirm. A read asks **R** replicas and keeps the newest version it sees.',
        'If **R + W > N**, every read set overlaps every write set in at least one node, so a read always reaches someone with the latest value. With N = 3, W = 2, R = 2: node C missed the write, but any 2 nodes you read include A or B.',
        'Tune the numbers to the workload. W = 1 makes writes fast but needs R = 3 to stay consistent. Stale nodes get fixed by **read repair** (the reader writes back the newest value) and by background anti-entropy.',
      ],
      keyIdea: 'Quorums replace a leader with overlap. As long as R + W > N, some node in every read has the latest write.',
      metrics: { replicas: 'N = 3', reads: 'R = 2', lag: 'C is behind', commit: 'W = 2 acks', risk: '0 if R + W > N' },
      scene: {
        nodes: [
          client,
          { ...server, label: 'coordinator', status: 'active' },
          { ...r1, label: 'node A', status: 'ok', badge: 'v2' },
          { ...r2, label: 'node B', status: 'ok', badge: 'v2' },
          { ...r3, label: 'node C', badge: 'v1 (stale)' },
        ],
        links: [
          { from: 'client', to: 'server' },
          { from: 'server', to: 'r1' },
          { from: 'server', to: 'r2' },
          { from: 'server', to: 'r3' },
        ],
        flows: [
          { path: ['server', 'r1'], tone: 'request', label: 'write v2', duration: 1 },
          { path: ['server', 'r2'], tone: 'request', duration: 1 },
          { path: ['r1', 'server'], tone: 'response', label: 'ack', duration: 1, delay: 1.1 },
          { path: ['r2', 'server'], tone: 'response', label: 'ack', duration: 1, delay: 1.1 },
          { path: ['server', 'r2'], tone: 'request', label: 'read', duration: 1, delay: 2.6 },
          { path: ['server', 'r3'], tone: 'request', duration: 1, delay: 2.6 },
          { path: ['r2', 'server'], tone: 'response', label: 'v2 wins', duration: 1, delay: 3.7 },
          { path: ['r3', 'server'], tone: 'response', label: 'v1', duration: 1, delay: 3.7 },
          { path: ['server', 'r3'], tone: 'data', label: 'read repair', duration: 1, delay: 4.9 },
        ],
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Copies scale reads and survive failure',
      eli5: 'One main book for writing, copies for reading, and a watcher ready to pick a new main book. That is **replication**. Copies are always a tiny bit behind, so read the main book when you need the newest page.',
      body: [
        'A primary streams its log to replicas. Reads scale with replicas, writes do not. Async replication is fast and can lose the newest writes on failover. Sync replication loses nothing and adds a round trip to every commit.',
        'Replicas lag, so route a user\'s reads by what they just wrote. Failover promotes the freshest replica in about 30 seconds, and it needs quorum and fencing to avoid split brain. Multi-leader trades conflicts for local writes. Leaderless stores use **R + W > N**.',
      ],
      keyIdea: 'Every copy is a little behind. Decide where that is fine, where it is not, and route reads to match.',
      metrics: { replicas: '3', reads: '40K/s', lag: '20 ms', commit: '3 ms (1 sync)', risk: '0 committed writes' },
      scene: {
        nodes: [client, server, { ...primary, status: 'ok' }, { ...r1, status: 'ok' }, { ...r2, status: 'ok' }, { ...r3, status: 'ok' }, manager],
        links: [
          ...replicaLinks,
          { from: 'server', to: 'r2', style: 'faint' },
          { from: 'manager', to: 'primary', style: 'faint' },
        ],
        flows: [
          { path: ['client', 'server', 'primary'], tone: 'request', label: 'write', duration: 1.4 },
          { path: ['primary', 'r1'], tone: 'data', duration: 1, delay: 1.5 },
          { path: ['primary', 'r2'], tone: 'data', duration: 1.2, delay: 1.5 },
          { path: ['primary', 'r3'], tone: 'data', duration: 1.4, delay: 1.5 },
          { path: ['server', 'r2', 'server'], tone: 'response', label: 'read', duration: 1.6, delay: 3 },
        ],
      },
      quiz: {
        question: 'A leaderless store keeps N = 5 copies of each key and writes wait for W = 3 acks. What is the smallest R that still guarantees a read sees the latest write?',
        options: ['1', '2', '3', '5'],
        answer: 2,
        explain: 'You need R + W > N, so R + 3 > 5 and R must be at least 3. With R = 2 the 2 nodes you read could both be among the 2 that missed the write.',
      },
    },
  ],
};
