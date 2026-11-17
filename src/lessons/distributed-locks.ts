import type { Lesson, SceneNode } from '../engine/types';

const w1: SceneNode = { id: 'w1', kind: 'worker', at: [-2.7, 1.7], label: 'sync run 1', sub: 'cron host A' };
const w2: SceneNode = { id: 'w2', kind: 'worker', at: [-2.4, -0.6], label: 'sync run 2', sub: 'cron host B' };
const lock: SceneNode = { id: 'lock', kind: 'cache', at: [1.7, 1.5], label: 'Redis', sub: 'lock service' };
const db: SceneNode = { id: 'db', kind: 'db', at: [1.6, -2.8], label: 'inventory DB', sub: 'stock table' };
const e1: SceneNode = { id: 'e1', kind: 'server', at: [0.8, 3.0], label: 'etcd 1' };
const e2: SceneNode = { id: 'e2', kind: 'server', at: [1.7, 1.5], label: 'etcd 2', sub: 'leader' };
const e3: SceneNode = { id: 'e3', kind: 'server', at: [3.0, 0.8], label: 'etcd 3' };

const lockLinks = [
  { from: 'w1', to: 'lock', style: 'dashed' as const },
  { from: 'w2', to: 'lock', style: 'dashed' as const },
  { from: 'w1', to: 'db' },
  { from: 'w2', to: 'db' },
];

const etcdLinks = [
  { from: 'w1', to: 'e2', style: 'dashed' as const },
  { from: 'w2', to: 'e2', style: 'dashed' as const },
  { from: 'e2', to: 'e1', style: 'faint' as const },
  { from: 'e2', to: 'e3', style: 'faint' as const },
  { from: 'w1', to: 'db' },
  { from: 'w2', to: 'db' },
];

export const distributedLocks: Lesson = {
  id: 'distributed-locks',
  title: 'Distributed locks and fencing tokens',
  tagline: 'Let only one machine do a job at a time, and stop a holder that lost the lock without knowing it.',
  minutes: 16,
  level: 'Advanced',
  learn: [
    'Why a mutex inside one process cannot protect work spread over machines',
    'A lock with a TTL in Redis, and a lease in etcd or ZooKeeper',
    'The paused-process problem: an expired holder that still writes',
    'Fencing tokens: a number that only goes up, checked by the resource itself',
    'When you can skip the lock: row locks, conditional writes, idempotency, single owners',
  ],
  metrics: [
    { key: 'holder', label: 'Lock holder' },
    { key: 'ttl', label: 'TTL left' },
    { key: 'token', label: 'Token' },
    { key: 'stock', label: 'SHOE-42 stock' },
  ],
  steps: [
    {
      title: 'Double run',
      tag: 'problem',
      heading: 'Two copies of the same job step on each other',
      eli5: 'Two students both want to rearrange the same study room at the same time. One puts the chairs in rows, the other in a circle, and the room ends up a mess.',
      body: [
        'Every minute a **stock sync** job reads the supplier\'s feed and writes the stock counts into the inventory DB. It runs on two cron hosts so a dead host does not stop it. Without coordination, both copies run every minute.',
        'Run 1 reads the feed at 10:00:00 and sees `SHOE-42: 5`. It is slow. Run 2 reads at 10:00:20, sees `3`, and writes `3`. Then run 1 finishes and writes `5`. The shop now shows two pairs that were sold. Both runs also hit the supplier API, doubling the bill and the rate limit usage.',
        'A mutex in your code only works inside one process. These runs live on different machines and share nothing but the network and the database. You need **mutual exclusion across machines**: a lock that lives somewhere both can reach.',
      ],
      keyIdea: 'Running a job on two hosts for safety means it runs twice unless something outside both hosts picks one.',
      metrics: { holder: 'nobody', ttl: '-', token: '-', stock: '5 (truth is 3)' },
      scene: {
        nodes: [
          { ...w1, status: 'hot', badge: 'read 5 at :00' },
          { ...w2, status: 'active', badge: 'read 3 at :20' },
          { ...db, status: 'hot', badge: 'qty = 5 (stale)' },
        ],
        links: [
          { from: 'w1', to: 'db' },
          { from: 'w2', to: 'db' },
        ],
        flows: [
          { path: ['w2', 'db'], tone: 'request', label: 'qty = 3', duration: 1.2 },
          { path: ['w1', 'db'], tone: 'error', label: 'qty = 5 (old)', duration: 1.4, delay: 1.5 },
        ],
        caption: 'The slower run wins, with older data',
      },
    },
    {
      title: 'Redis lock',
      tag: 'concept',
      heading: 'A lock is a key that only one caller can create',
      eli5: 'The **front desk** keeps one key to the study room. Whoever asks first gets it, and everyone else is told to come back later.',
      body: [
        'The simplest distributed lock is one Redis key. Each run tries `SET lock:stock-sync <random id> NX PX 30000`. `NX` means "only if the key does not exist", so exactly one caller succeeds. The loser skips this minute.',
        '`PX 30000` gives the key a **TTL** of 30 seconds. If the holder crashes mid-run, the key expires by itself and the next run can proceed. Without a TTL a crashed holder would block the job forever.',
        'The random id matters on release. Delete the key only if it still holds your id, and do the check and the delete in one atomic Lua script. Otherwise a slow run whose lock already expired would delete the next holder\'s lock.',
      ],
      keyIdea: 'Acquire with SET NX and a TTL, store a random owner id, and release only your own lock.',
      metrics: { holder: 'run 1', ttl: '30 s', token: '-', stock: '3' },
      scene: {
        nodes: [
          { ...w1, status: 'active', badge: 'got it' },
          { ...w2, status: 'dim', badge: 'skip this minute' },
          { ...lock, status: 'active', badge: 'lock:stock-sync' },
          { ...db, status: 'ok', badge: 'qty = 3' },
        ],
        links: lockLinks,
        flows: [
          { path: ['w1', 'lock'], tone: 'request', label: 'SET NX', duration: 1 },
          { path: ['w2', 'lock'], tone: 'request', label: 'SET NX', duration: 1, delay: 0.2 },
          { path: ['lock', 'w1'], tone: 'response', label: 'OK', duration: 1, delay: 1.1 },
          { path: ['lock', 'w2'], tone: 'error', label: 'nil', duration: 1, delay: 1.3 },
          { path: ['w1', 'db'], tone: 'request', label: 'qty = 3', duration: 1.2, delay: 2.3 },
        ],
      },
      code: {
        language: 'python',
        title: 'A Redis lock with a TTL and a safe release',
        source: `import uuid, redis
r = redis.Redis(host="redis-1")

RELEASE = """
if redis.call('get', KEYS[1]) == ARGV[1] then
    return redis.call('del', KEYS[1])
end
return 0
"""

def run_stock_sync():
    me = str(uuid.uuid4())                         # owner id for this run
    got = r.set("lock:stock-sync", me, nx=True, px=30_000)
    if not got:
        return                                     # someone else is syncing
    try:
        sync_all_skus()                            # should finish well within 30 s
    finally:
        r.eval(RELEASE, 1, "lock:stock-sync", me)  # delete only if still mine`,
        highlight: [13, 19],
      },
    },
    {
      title: 'TTL choice',
      tag: 'tradeoff',
      heading: 'How long should the lock last?',
      eli5: 'The front desk writes a return time on the key. Too short and the student is thrown out mid-study. Too long and a student who wandered off keeps everyone waiting.',
      body: [
        'A short TTL frees the lock quickly after a crash, but if the job runs past it, the lock expires under a holder that is still working. A long TTL is safer for slow jobs, but a crashed holder blocks everyone until it runs out.',
        'The usual answer is a medium TTL plus **renewal**. The sync takes about 8 seconds, the TTL is 30 seconds, and the holder extends it every 10 seconds while it works. A crash stops the renewals, and the lock is free within 30 seconds.',
        'Renewal does not make the lock safe. It assumes the holder notices time passing. The next step shows what happens when it cannot.',
      ],
      keyIdea: 'A TTL trades recovery time after a crash against the risk of expiring under a live holder. Renewal narrows the gap and does not close it.',
      metrics: { holder: 'run 1', ttl: '30 s, renewed every 10 s', token: '-', stock: '3' },
      scene: {
        nodes: [
          { ...w1, status: 'active', badge: 'job ~8 s' },
          { ...w2, status: 'dim' },
          { ...lock, status: 'active', badge: 'TTL 30 s' },
          db,
        ],
        links: lockLinks,
        flows: [
          { path: ['w1', 'lock'], tone: 'handshake', label: 'extend', duration: 1 },
          { path: ['w1', 'lock'], tone: 'handshake', label: 'extend', duration: 1, delay: 2 },
          { path: ['w1', 'db'], tone: 'request', label: 'writes', count: 3, duration: 1.2, delay: 0.6 },
        ],
        caption: 'Renew at one third of the TTL',
      },
    },
    {
      title: 'Paused holder',
      tag: 'case',
      heading: 'Case: the lock expires while its holder is frozen',
      eli5: 'A student with the key falls asleep in the hallway. The return time passes, so the desk gives the room to someone else. The sleeper wakes up, still holding a key, and walks in anyway.',
      body: [
        'Run 1 takes the lock at 10:00:00 and reads `SHOE-42: 5` from the feed. At 10:00:02 its process freezes for 40 seconds: a long garbage collection pause, a VM migrated by the cloud host, or a disk stall. Its renewals stop with it.',
        'At 10:00:30 the lock expires. Run 2 takes it at 10:00:31, reads `3`, and writes `3`. At 10:00:42 run 1 wakes up. From its own point of view no time has passed, and it writes `5`. Stale data again, this time with a lock in place.',
        'Checking "do I still hold the lock?" right before writing does not fix it, because the pause can land between the check and the write. A slow network does the same thing: the write was sent in time and arrives late. **Any lock with an expiry has this gap**, whether it lives in Redis, etcd or ZooKeeper.',
      ],
      keyIdea: 'A holder cannot know its lock expired while it was paused. The lock alone cannot stop its late write.',
      metrics: { holder: 'run 2 (run 1 thinks it is)', ttl: 'expired at :30', token: '-', stock: '5 (stale)' },
      scene: {
        nodes: [
          { ...w1, status: 'hot', badge: 'paused 40 s' },
          { ...w2, status: 'active', badge: 'lock since :31' },
          { ...lock, badge: 'owner: run 2' },
          { ...db, status: 'hot', badge: 'qty = 5 (stale)' },
        ],
        links: lockLinks,
        flows: [
          { path: ['w2', 'lock'], tone: 'request', label: 'SET NX', duration: 1 },
          { path: ['lock', 'w2'], tone: 'response', label: 'OK', duration: 1, delay: 1.1 },
          { path: ['w2', 'db'], tone: 'request', label: 'qty = 3', duration: 1.2, delay: 2.2 },
          { path: ['w1', 'db'], tone: 'error', label: 'qty = 5 (woke up)', duration: 1.4, delay: 3.6 },
        ],
        caption: 'Two holders, one of them asleep through the expiry',
      },
    },
    {
      title: 'Fencing',
      tag: 'concept',
      heading: 'Fencing tokens: let the resource say no',
      eli5: 'Each time the desk hands out the key, it also gives a ticket with a bigger number. The **room door** remembers the biggest ticket it has seen and will not open for a smaller one.',
      body: [
        'Every time the lock service grants the lock, it also returns a **fencing token**: a number that only goes up. Run 1 got token 33. Run 2 got token 34.',
        'The holder sends its token with every write, and the **resource checks it**. The inventory DB stores the highest token it has accepted and rejects any write carrying a lower one. When run 1 wakes up and writes with 33, the DB has already seen 34, so the write matches zero rows and run 1 aborts.',
        'The check has to live in the resource, because the resource is the only party that sees the writes in the order they actually arrive. This is the same idea as Raft\'s term number: a higher number wins, and an old leader is ignored.',
      ],
      keyIdea: 'A lock decides who should write. A fencing token, checked by the resource, decides whose writes still count.',
      metrics: { holder: 'run 2', ttl: '28 s', token: '34 (DB has seen 34)', stock: '3' },
      scene: {
        nodes: [
          { ...w1, status: 'hot', badge: 'token 33' },
          { ...w2, status: 'active', badge: 'token 34' },
          { ...lock, badge: 'next token: 35' },
          { ...db, status: 'ok', badge: 'max token 34' },
        ],
        links: lockLinks,
        flows: [
          { path: ['w2', 'db'], tone: 'request', label: 'qty = 3, token 34', duration: 1.2 },
          { path: ['db', 'w2'], tone: 'response', label: '1 row', duration: 1, delay: 1.3 },
          { path: ['w1', 'db'], tone: 'request', label: 'qty = 5, token 33', duration: 1.2, delay: 2.5 },
          { path: ['db', 'w1'], tone: 'error', label: '0 rows: stale', duration: 1, delay: 3.8 },
        ],
        caption: 'The late write is refused by the DB',
      },
      code: {
        language: 'sql',
        title: 'The resource enforces the token in the write itself',
        source: `-- the lock service gave this run token 34
UPDATE stock
SET    qty   = 3,
       fence = 34
WHERE  sku = 'SHOE-42'
  AND  fence <= 34;      -- a lower token matches no row

-- run 1 wakes up later with token 33:
UPDATE stock
SET    qty = 5, fence = 33
WHERE  sku = 'SHOE-42'
  AND  fence <= 33;      -- fence is 34, so 0 rows updated: abort`,
        highlight: [6, 12],
      },
      quiz: {
        question: 'Run 1 holds token 33 and is paused. Run 2 takes the lock with token 34 but has not written yet when run 1 wakes and writes with 33. What happens?',
        options: [
          'The DB rejects run 1, because the lock service already issued 34',
          'The DB accepts run 1, because the highest token it has seen is still below 33. Run 2\'s write with 34 then replaces it',
          'Both writes are rejected until an operator steps in',
          'Run 1\'s write is accepted and run 2\'s later write is rejected',
        ],
        answer: 1,
        explain: 'The DB only knows the tokens that reached it. Run 1\'s write lands first and is accepted. Run 2\'s write with 34 then wins, and any further write from 33 is refused. The final state is correct, which is the guarantee fencing gives.',
      },
    },
    {
      title: 'Which service',
      tag: 'tradeoff',
      heading: 'Redis lock or consensus lease?',
      eli5: 'One front desk with one clerk is quick, but if the clerk is swapped mid-shift the new one may not know the key is out. A desk run by three clerks who must agree keeps a reliable list.',
      body: [
        'A single Redis node is fast and simple. With a replica and automatic failover, though, replication is asynchronous: the primary can grant the lock and die before the key reaches the replica. The promoted replica has no lock, and a second caller gets it. A counter kept in that Redis for tokens can also roll back the same way.',
        '**Redlock** asks for the key on a majority of 5 independent Redis nodes. Its safety argument depends on bounded clock drift and pauses, and it has no built-in fencing token, so it is still debated as a correctness lock.',
        'A **lease** in **etcd** or **ZooKeeper** is written through consensus, so a grant survives the loss of a minority of nodes. They also give you a token for free: the etcd revision of the lock key, or the zxid or sequence number of a ZooKeeper node. A lease still expires when its holder is paused, so you still need the resource to check the token.',
      ],
      keyIdea: 'A consensus lease keeps the lock across failovers and comes with a monotonic token. It does not remove the pause problem, so fence anyway.',
      metrics: { holder: 'run 2', ttl: 'lease 10 s', token: 'etcd revision 1047', stock: '3' },
      scene: {
        zones: [{ id: 'etcd', from: [0.3, 0.2], to: [3.7, 3.6], label: 'etcd: 3 voters', tone: 'violet' }],
        nodes: [
          { ...w1, status: 'dim' },
          { ...w2, status: 'active', badge: 'rev 1047' },
          { ...e1, status: 'ok' },
          { ...e2, status: 'active', badge: 'lease 10 s' },
          { ...e3, status: 'ok' },
          { ...db, status: 'ok', badge: 'max token 1047' },
        ],
        links: etcdLinks,
        flows: [
          { path: ['w2', 'e2'], tone: 'request', label: 'lock', duration: 1 },
          { path: ['e2', 'e1'], tone: 'data', duration: 0.8, delay: 1.1 },
          { path: ['e2', 'e3'], tone: 'data', duration: 0.8, delay: 1.1 },
          { path: ['e2', 'w2'], tone: 'response', label: 'granted, rev 1047', duration: 1, delay: 2 },
          { path: ['w2', 'db'], tone: 'request', label: 'token 1047', duration: 1.2, delay: 3.1 },
        ],
        caption: 'The grant is committed on 2 of 3 before it is returned',
      },
    },
    {
      title: 'Why lock?',
      tag: 'tradeoff',
      heading: 'Efficiency locks and correctness locks',
      eli5: 'If two students sometimes tidy the same room, the room just gets tidied twice. If two students write in the same diary page, the page is ruined. The second case needs the strict rules.',
      body: [
        'Ask what breaks if two holders run at once. If the answer is "we do some work twice" (an extra supplier API call, a report emailed twice), it is an **efficiency lock**. A single Redis key with a TTL is fine, and the rare double run is acceptable.',
        'If the answer is "data becomes wrong" (stale stock, a lost update, a double payment), it is a **correctness lock**. Then you need a consensus-backed lease and a fencing token checked by every resource the holder writes to.',
        'Fencing only protects systems that check the token. A card network or an email provider will not. For those side effects, pass an **idempotency key** so a second attempt is recognized and dropped.',
      ],
      keyIdea: 'If a double run only wastes work, a simple lock will do. If it corrupts data, fence every write and make outside side effects idempotent.',
      metrics: { holder: 'run 2', ttl: 'lease 10 s', token: '1047', stock: '3' },
      scene: {
        nodes: [
          { ...w1, status: 'dim', badge: 'efficiency: skip' },
          { ...w2, status: 'active', badge: 'correctness: fence' },
          { ...lock, status: 'dim', badge: 'fine for reports' },
          { ...db, status: 'ok', badge: 'checks token' },
        ],
        links: lockLinks,
        flows: [
          { path: ['w2', 'db'], tone: 'request', label: 'write + token', duration: 1.2 },
          { path: ['db', 'w2'], tone: 'response', label: 'accepted', duration: 1, delay: 1.3 },
        ],
      },
    },
    {
      title: 'No lock',
      tag: 'concept',
      heading: 'Often you do not need a distributed lock at all',
      eli5: 'Sometimes the room has a lock built into its own door, or each student gets their own room. Then nobody needs to queue at the front desk.',
      body: [
        '**Let the database do it.** If the shared thing is a row, a transaction with `SELECT ... FOR UPDATE` locks it, and the lock dies with the connection. A conditional write such as `UPDATE ... WHERE version = 7` gives optimistic locking: the second writer matches zero rows and retries. A unique constraint stops two runs from inserting the same order.',
        '**Make the work idempotent.** If running the sync twice writes the same correct numbers, overlap is harmless. Stamp each write with the feed\'s timestamp and accept only newer ones, and the stale write from step 1 is refused without any lock. That timestamp acts as a fencing token chosen by the data.',
        '**Give each piece of work one owner.** Partition by key so each SKU range belongs to one worker, as Kafka assigns each partition to one consumer in a group. A single writer per partition needs no lock. Use a distributed lock when none of these fit.',
      ],
      keyIdea: 'Row locks, conditional writes, idempotent work and single owners remove the need for most distributed locks.',
      metrics: { holder: 'none needed', ttl: '-', token: 'feed time 10:00:20', stock: '3' },
      scene: {
        nodes: [
          { ...w1, status: 'hot', badge: 'feed time :00' },
          { ...w2, status: 'active', badge: 'feed time :20' },
          { ...db, status: 'ok', badge: 'keeps newest feed time' },
        ],
        links: [
          { from: 'w1', to: 'db' },
          { from: 'w2', to: 'db' },
        ],
        flows: [
          { path: ['w2', 'db'], tone: 'request', label: 'qty 3 @ :20', duration: 1.2 },
          { path: ['w1', 'db'], tone: 'request', label: 'qty 5 @ :00', duration: 1.2, delay: 1.4 },
          { path: ['db', 'w1'], tone: 'error', label: 'older: ignored', duration: 1, delay: 2.7 },
        ],
        caption: 'The data itself orders the writes',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'A lock picks a holder. A token makes it stick.',
      eli5: 'The front desk lends the key with a numbered ticket and a return time. The room door only opens for the newest ticket, so a student who overslept cannot barge in.',
      body: [
        'A distributed lock is a key that only one caller can create, with a TTL so a crashed holder does not block everyone. Redis `SET NX PX` works for efficiency. A lease in etcd or ZooKeeper survives node failures because it goes through consensus.',
        'Every lock with an expiry has the paused-process gap: a frozen holder wakes up and writes after its lock moved on. **Fencing tokens** close it, as long as the resource rejects lower tokens. Before reaching for a lock, check whether a row lock, a conditional write, idempotency or a single owner already solves the problem.',
      ],
      keyIdea: 'Locks expire and holders pause. Correctness comes from the resource rejecting stale tokens.',
      metrics: { holder: 'run 2', ttl: 'lease 10 s', token: '1047', stock: '3' },
      scene: {
        zones: [{ id: 'etcd', from: [0.3, 0.2], to: [3.7, 3.6], label: 'etcd: 3 voters', tone: 'violet' }],
        nodes: [
          { ...w1, status: 'dim', badge: 'token 1046' },
          { ...w2, status: 'ok', badge: 'token 1047' },
          e1,
          { ...e2, status: 'active' },
          e3,
          { ...db, status: 'ok', badge: 'max token 1047' },
        ],
        links: etcdLinks,
        flows: [
          { path: ['w2', 'e2'], tone: 'request', label: 'lock', duration: 1 },
          { path: ['e2', 'w2'], tone: 'response', label: 'token', duration: 1, delay: 1.1 },
          { path: ['w2', 'db'], tone: 'request', label: 'write + 1047', duration: 1.2, delay: 2.2 },
          { path: ['w1', 'db'], tone: 'error', label: '1046: refused', duration: 1.2, delay: 3.5 },
        ],
      },
      quiz: {
        question: 'Your job holds an etcd lease with a 10 s TTL and checks "is my lease still valid?" right before every write to S3-style object storage, which cannot check tokens. Is this safe for correctness?',
        options: [
          'Yes, etcd uses consensus, so the lease cannot be lost',
          'Yes, because the check runs right before each write',
          'No, a pause or slow network between the check and the write lets a stale write land. Use a store that checks a token, or make the write safe to repeat or reorder',
          'No, but a 60 s TTL would make it safe',
        ],
        answer: 2,
        explain: 'Consensus protects the lock record, not the holder. The process can freeze after the check, and the write can arrive after the lease moved on. Only a resource that rejects stale tokens, or writes that are harmless when late or repeated, close that gap. A longer TTL only makes it rarer.',
      },
    },
  ],
};
