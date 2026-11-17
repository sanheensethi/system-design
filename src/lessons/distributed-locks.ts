import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const w1: SceneNode = { id: 'w1', kind: 'worker', at: at(-4.2, -4), label: 'run 1', sub: 'cron host A' };
const w2: SceneNode = { id: 'w2', kind: 'worker', at: at(-4.2, 4), label: 'run 2', sub: 'cron host B' };
const lock: SceneNode = { id: 'lock', kind: 'block', at: at(0, -4), label: 'Redis lock', sub: 'lock service', icon: 'KeyRound', tint: 'violet' };
const replica: SceneNode = { id: 'replica', kind: 'cache', at: at(0, 4), label: 'Redis replica', sub: 'async copy' };
const db: SceneNode = { id: 'db', kind: 'db', at: at(3.8, 0), label: 'inventory DB', sub: 'stock table' };
const e1: SceneNode = { id: 'e1', kind: 'server', at: at(-3.6, -3.2), label: 'etcd 1' };
const e2: SceneNode = { id: 'e2', kind: 'server', at: at(0, -3.2), label: 'etcd 2', sub: 'leader' };
const e3: SceneNode = { id: 'e3', kind: 'server', at: at(3.6, -3.2), label: 'etcd 3' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });
const dbLinks = [link('w1', 'db'), link('w2', 'db')];
const lockLinks = [link('w1', 'lock', { style: 'dashed' }), link('w2', 'lock', { style: 'dashed' }), ...dbLinks];

export const distributedLocks: Lesson = {
  id: 'distributed-locks',
  title: 'Distributed locks and fencing tokens',
  tagline: 'Let only one machine do a job at a time, and stop a holder that lost the lock without knowing it.',
  minutes: 18,
  level: 'Advanced',
  learn: [
    'Why a mutex inside one process cannot protect work spread over machines',
    'A lock with a TTL in Redis, safe release, and renewal',
    'The paused-process problem: an expired holder that still writes',
    'Fencing tokens: a number that only goes up, checked by the resource itself',
    'Redis failover, Redlock, and leases in etcd or ZooKeeper',
    'Waiting, retrying and picking the lock scope',
    'When you can skip the lock: row locks, conditional writes, idempotency, single owners',
  ],
  metrics: [
    { key: 'holder', label: 'Lock holder', icon: 'KeyRound' },
    { key: 'ttl', label: 'TTL left', icon: 'Timer' },
    { key: 'token', label: 'Token', icon: 'Hash' },
    { key: 'stock', label: 'SHOE-42 stock', icon: 'Package' },
  ],
  steps: [
    {
      title: 'Double run',
      tag: 'problem',
      heading: 'Two copies of the same job step on each other',
      eli5: 'Two students both want to rearrange the same study room at the same time. One puts the chairs in rows, the other in a circle, and the room ends up a mess.',
      body: [
        'Every minute a **stock sync** job reads the supplier feed and writes stock counts to the inventory DB. It runs on two cron hosts so a dead host does not stop it. With no coordination, both run every minute.',
        'Run 1 reads `SHOE-42: 5` at 10:00:00 and is slow. Run 2 reads `3` at 10:00:20 and writes it. Then run 1 writes `5`. The shop now shows two pairs that were sold.',
      ],
      keyIdea: 'Running a job on two hosts for safety means it runs twice unless something outside both hosts picks one.',
      metrics: { holder: 'nobody', ttl: '-', token: '-', stock: '5 (truth is 3)' },
      metricTones: { holder: 'bad', stock: 'bad' },
      scene: {
        nodes: [
          { ...w1, status: 'hot', chips: ['read 5 at :00'] },
          { ...w2, status: 'active', chips: ['read 3 at :20'] },
          { ...db, status: 'hot', badge: 'qty = 5 (stale)' },
        ],
        links: dbLinks,
        flows: [
          { path: ['w2', 'db'], tone: 'request', label: 'qty = 3', duration: 1.2 },
          { path: ['w1', 'db'], tone: 'error', label: 'qty = 5 (old)', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Timeline of SHOE-42',
          icon: 'Clock',
          rows: [
            { text: '10:00:00 run 1 reads', value: '5' },
            { text: '10:00:20 run 2 reads', value: '3' },
            { text: '10:00:21 run 2 writes', value: '3', tone: 'good' },
            { text: '10:00:45 run 1 writes', value: '5', tone: 'bad' },
          ],
          footer: { text: 'The slower run wins, with older data', tone: 'bad' },
        },
        caption: 'The slower run wins, with older data',
      },
    },
    {
      title: 'Local mutex',
      tag: 'concept',
      heading: 'A mutex in your code cannot see the other host',
      eli5: 'Each student has a sign on their own desk that says "busy". The other student sits in another room and never sees it, so both walk in.',
      body: [
        'Both runs also hit the supplier API, doubling the bill and the rate limit usage.',
        'A mutex in your code only works inside one process. These runs share nothing but the network and the database. You need **mutual exclusion across machines**: a lock that lives somewhere both can reach.',
      ],
      keyIdea: 'A lock must live outside the callers, in a place every caller can reach.',
      metrics: { holder: 'nobody', ttl: '-', token: '-', stock: '5 (truth is 3)' },
      metricTones: { holder: 'bad' },
      scene: {
        nodes: [
          { ...w1, status: 'active', chips: [{ text: 'local mutex: free', tone: 'warn' }] },
          { ...w2, status: 'active', chips: [{ text: 'local mutex: free', tone: 'warn' }] },
          { id: 'supplier', kind: 'block', at: at(3.8, 0), label: 'supplier API', sub: 'rate limited', icon: 'Package', tint: 'amber', status: 'hot', load: 92 },
        ],
        links: [link('w1', 'supplier', { label: '1 call/min each' }), link('w2', 'supplier', { label: '1 call/min each' })],
        flows: [
          { path: ['w1', 'supplier'], tone: 'request', label: 'GET feed', duration: 1.2 },
          { path: ['w2', 'supplier'], tone: 'request', label: 'GET feed', duration: 1.2, delay: 0.4 },
        ],
        panel: {
          title: 'Where each mutex lives',
          icon: 'Server',
          rows: [
            { text: 'run 1 mutex', value: 'host A memory' },
            { text: 'run 2 mutex', value: 'host B memory' },
            { text: 'supplier calls', value: '2 per minute', tone: 'bad' },
          ],
          footer: { text: 'Neither mutex knows the other exists', tone: 'warn' },
        },
      },
    },
    {
      title: 'Redis lock',
      tag: 'concept',
      heading: 'A lock is a key that only one caller can create',
      eli5: 'The **front desk** keeps one key to the study room. Whoever asks first gets it, and everyone else is told to come back later.',
      body: [
        'The simplest distributed lock is one Redis key. Each run tries `SET lock:stock-sync <random id> NX PX 30000`.',
        '`NX` means only if the key does not exist, so exactly one caller succeeds. Run 1 gets `OK`, run 2 gets `nil` and skips this minute.',
      ],
      keyIdea: 'Acquire with SET NX: exactly one caller creates the key.',
      metrics: { holder: 'run 1', ttl: '30 s', token: '-', stock: '3' },
      metricTones: { holder: 'good' },
      scene: {
        nodes: [
          { ...w1, status: 'active', badge: 'got it' },
          { ...w2, status: 'dim', badge: 'skip this minute' },
          { ...lock, status: 'active', chips: ['lock:stock-sync'] },
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
        panel: {
          title: 'The command',
          icon: 'Code',
          code: 'SET lock:stock-sync <id>\n    NX     only if absent\n    PX 30000   expire in 30 s',
          footer: { text: 'One winner, no race', tone: 'good' },
        },
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
      title: 'TTL expiry',
      tag: 'concept',
      heading: 'The TTL frees the lock when a holder crashes',
      eli5: 'The front desk writes a return time on the key. If a student never comes back, the time runs out and the desk lends the key to the next one.',
      body: [
        '`PX 30000` gives the key a **TTL** of 30 seconds. If the holder crashes mid-run, the key expires by itself and the next run can proceed.',
        'Without a TTL a crashed holder would block the job forever.',
      ],
      keyIdea: 'A TTL turns a stuck lock into a lock that frees itself.',
      metrics: { holder: 'run 2 (after crash)', ttl: 'expired, then 30 s', token: '-', stock: '3' },
      metricTones: { ttl: 'warn' },
      scene: {
        nodes: [
          { ...w1, status: 'down', badge: 'crashed' },
          { ...w2, status: 'active', badge: 'takes over' },
          { ...lock, status: 'active', chips: [{ text: 'TTL 30 s: gone', tone: 'warn' }] },
        ],
        links: [link('w1', 'lock', { style: 'dashed' }), link('w2', 'lock', { style: 'dashed' })],
        flows: [
          { path: ['w2', 'lock'], tone: 'request', label: 'SET NX', duration: 1, delay: 0.5 },
          { path: ['lock', 'w2'], tone: 'response', label: 'OK', duration: 1, delay: 1.6 },
        ],
        panel: {
          title: 'After the crash',
          icon: 'Timer',
          rows: [
            { text: '10:00:00 run 1 locks', value: 'TTL 30 s' },
            { text: '10:00:05 run 1 crashes', value: 'no release', tone: 'bad' },
            { text: '10:00:30 key expires', value: 'free', tone: 'good' },
          ],
          footer: { text: 'The job is stuck for at most 30 s', tone: 'muted' },
        },
      },
    },
    {
      title: 'Safe release',
      tag: 'concept',
      heading: 'Release only your own lock',
      eli5: 'Every key has the owner name on it. A student whose time ran out must not take the key back from the next student by mistake.',
      body: [
        'Store a random owner id as the value. On release, delete the key only if it still holds your id, and do the check and the delete in one atomic Lua script.',
        'Otherwise a slow run whose lock already expired would delete the next holder\'s lock.',
      ],
      keyIdea: 'Store a random owner id and release only your own lock, atomically.',
      metrics: { holder: 'run 2', ttl: '30 s', token: '-', stock: '3' },
      scene: {
        nodes: [
          { ...w1, status: 'dim', chips: [{ text: 'DEL lock (late)', tone: 'warn' }] },
          { ...w2, status: 'active', badge: 'real owner' },
          { ...lock, status: 'active', chips: ['owner: run 2'] },
        ],
        links: [link('w1', 'lock', { style: 'dashed' }), link('w2', 'lock', { style: 'dashed' })],
        flows: [
          { path: ['w1', 'lock'], tone: 'request', label: 'release(id 1)', duration: 1.2 },
          { path: ['lock', 'w1'], tone: 'error', label: '0: not yours', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Release script',
          icon: 'Shield',
          code: 'if GET key == my_id\n  then DEL key\n  else return 0',
          footer: { text: 'One atomic step', tone: 'good' },
        },
      },
    },
    {
      title: 'TTL choice',
      tag: 'tradeoff',
      heading: 'How long should the lock last?',
      eli5: 'Too short a return time and a student is thrown out mid-study. Too long and a student who wandered off keeps everyone waiting.',
      body: [
        'A short TTL frees the lock fast after a crash, but it can expire under a holder that runs long. A long TTL suits slow jobs, but a crashed holder blocks everyone until it runs out.',
        'The sync takes about 8 seconds, so a 30 second TTL leaves room. The usual answer is a medium TTL plus **renewal**.',
      ],
      keyIdea: 'A TTL trades recovery time after a crash against the risk of expiring under a live holder.',
      metrics: { holder: 'run 1', ttl: '30 s', token: '-', stock: '3' },
      metricTones: { ttl: 'warn' },
      scene: {
        nodes: [
          { ...w1, status: 'active', badge: 'job ~8 s' },
          { ...lock, status: 'active', chips: ['TTL 30 s'] },
          { ...db, status: 'ok' },
        ],
        links: [link('w1', 'lock', { style: 'dashed' }), link('w1', 'db')],
        flows: [{ path: ['w1', 'db'], tone: 'request', label: 'writes', count: 3, duration: 1.2 }],
        panel: {
          title: 'Two ways to get it wrong',
          icon: 'Scale',
          rows: [
            { text: 'TTL 5 s, job 8 s', value: 'expires under you', tone: 'bad' },
            { text: 'TTL 30 s, job 8 s', value: 'fits', tone: 'good' },
            { text: 'TTL 1 h, holder crashes', value: 'blocked 1 h', tone: 'bad' },
          ],
        },
      },
    },
    {
      title: 'Renewal',
      tag: 'concept',
      heading: 'Renew the lock while the work goes on',
      eli5: 'While the student studies, they walk to the desk every so often and ask for a fresh return time. If they stop coming, the time runs out.',
      body: [
        'A full sync can take about 45 seconds, longer than the 30 second TTL. So the holder extends the TTL every 10 seconds, about one third of the TTL. A crash stops the renewals and the lock frees itself.',
        'The extend is an atomic Lua script: `PEXPIRE` only if `GET` equals my id, the same pattern as the safe release.',
        'Renewal does not make the lock safe. It assumes the holder notices time passing.',
      ],
      keyIdea: 'Renewal narrows the gap between TTL and job time. It does not close it.',
      metrics: { holder: 'run 1', ttl: '30 s, renewed every 10 s', token: '-', stock: '3' },
      scene: {
        nodes: [
          { ...w1, status: 'active', badge: 'job ~45 s' },
          { ...lock, status: 'active', chips: ['TTL 30 s'] },
          { ...db, status: 'ok' },
        ],
        links: [link('w1', 'lock', { style: 'dashed', arrow: 'both' }), link('w1', 'db')],
        flows: [
          { path: ['w1', 'lock'], tone: 'handshake', label: 'extend', duration: 1 },
          { path: ['w1', 'lock'], tone: 'handshake', label: 'extend', duration: 1, delay: 2 },
          { path: ['w1', 'db'], tone: 'request', label: 'writes', count: 3, duration: 1.2, delay: 0.6 },
        ],
        panel: {
          title: 'Renewal timeline',
          icon: 'Repeat',
          rows: [
            { text: '10:00:00 acquire', value: 'TTL 30 s' },
            { text: '10:00:10 extend', value: 'TTL 30 s' },
            { text: '10:00:20 extend', value: 'TTL 30 s' },
            { text: '10:00:30 extend', value: 'TTL 30 s' },
            { text: '10:00:40 extend', value: 'TTL 30 s' },
            { text: '10:00:45 job done, release', value: 'free', tone: 'good' },
          ],
          footer: { text: 'Renew at one third of the TTL, only if still the owner', tone: 'muted' },
        },
      },
    },
    {
      title: 'Paused holder',
      tag: 'case',
      heading: 'Case: the lock expires while its holder is frozen',
      eli5: 'A student with the key falls asleep in the hallway. The return time passes, so the desk gives the room to someone else. The sleeper wakes up, still holding a key, and walks in anyway.',
      body: [
        'Run 1 takes the lock at 10:00:00 and reads `SHOE-42: 5`. At 10:00:02 its process freezes for 40 seconds: a long garbage collection pause, a VM migrated by the host, or a disk stall. Renewals stop with it.',
        'At 10:00:30 the lock expires. Run 2 takes it at 10:00:31 and writes `3`. At 10:00:42 run 1 wakes up, feels no time has passed, and writes `5`.',
      ],
      keyIdea: 'A holder cannot know its lock expired while it was paused. The lock alone cannot stop its late write.',
      metrics: { holder: 'run 2 (run 1 thinks it is)', ttl: 'expired at :30', token: '-', stock: '5 (stale)' },
      metricTones: { holder: 'bad', stock: 'bad' },
      scene: {
        nodes: [
          { ...w1, status: 'hot', badge: 'paused 40 s' },
          { ...w2, status: 'active', badge: 'lock since :31' },
          { ...lock, chips: ['owner: run 2'] },
          { ...db, status: 'hot', badge: 'qty = 5 (stale)' },
        ],
        links: lockLinks,
        flows: [
          { path: ['w2', 'lock'], tone: 'request', label: 'SET NX', duration: 1 },
          { path: ['lock', 'w2'], tone: 'response', label: 'OK', duration: 1, delay: 1.1 },
          { path: ['w2', 'db'], tone: 'request', label: 'qty = 3', duration: 1.2, delay: 2.2 },
          { path: ['w1', 'db'], tone: 'error', label: 'qty = 5 (woke up)', duration: 1.4, delay: 3.6 },
        ],
        panel: {
          title: 'What happened',
          icon: 'Clock',
          rows: [
            { text: '10:00:02 run 1 freezes', tone: 'warn' },
            { text: '10:00:30 lock expires' },
            { text: '10:00:31 run 2 locks, writes 3', tone: 'good' },
            { text: '10:00:42 run 1 writes 5', tone: 'bad' },
          ],
        },
        caption: 'Two holders, one of them asleep through the expiry',
      },
    },
    {
      title: 'Check first?',
      tag: 'case',
      heading: 'Checking the lock before writing does not help',
      eli5: 'Asking "do I still have the key?" at the door does not help if you fall asleep right after asking.',
      body: [
        'Checking "do I still hold the lock?" right before writing does not fix it. The pause can land between the check and the write. A slow network does the same: the write was sent in time and arrives late.',
        '**Any lock with an expiry has this gap**, in Redis, etcd or ZooKeeper.',
      ],
      keyIdea: 'No check on the holder side can close the gap between checking and writing.',
      metrics: { holder: 'run 2', ttl: 'expired at :30', token: '-', stock: '5 (stale)' },
      metricTones: { stock: 'bad' },
      scene: {
        nodes: [
          { ...w1, status: 'hot', chips: [{ text: 'check: still mine', tone: 'good' }, { text: 'paused...', tone: 'warn' }] },
          { ...lock, chips: ['owner: run 2'] },
          { ...db, status: 'hot', badge: 'qty = 5 (stale)' },
        ],
        links: [link('w1', 'lock', { style: 'dashed' }), link('w1', 'db', { label: 'slow link, 40 s', labelTone: 'warn' })],
        flows: [
          { path: ['w1', 'lock'], tone: 'request', label: 'still mine?', duration: 1 },
          { path: ['w1', 'db'], tone: 'error', label: 'write lands late', duration: 1.6, delay: 1.5 },
        ],
        panel: {
          title: 'The gap',
          icon: 'Code',
          code: 'if lock.still_mine():\n    # <- pause or slow network here\n    db.write(qty=5)',
          footer: { text: 'The check is already stale', tone: 'bad' },
        },
      },
    },
    {
      title: 'Fencing token',
      tag: 'concept',
      heading: 'Fencing tokens: a number that only goes up',
      eli5: 'Each time the desk hands out the key, it also gives a ticket with a bigger number. Run 1 held ticket 33 and run 2 holds 34.',
      body: [
        'Every time the lock service grants the lock, it also returns a **fencing token**: a number that only goes up. Run 1 got token 33. Run 2 got token 34.',
        '`SET NX` returns no token by itself, so the grant script also runs `INCR` on a counter key (`lock:stock-sync:token`) and returns the number with `OK`.',
        'The holder sends its token with every write. The DB keeps the highest token it has accepted and rejects any lower one.',
      ],
      keyIdea: 'A lock decides who should write. A fencing token decides whose writes still count.',
      metrics: { holder: 'run 2', ttl: '28 s', token: '34', stock: '3' },
      metricTones: { token: 'good' },
      scene: {
        nodes: [
          { ...w1, status: 'dim', badge: 'token 33' },
          { ...w2, status: 'active', badge: 'token 34' },
          { ...lock, chips: ['next token: 35'] },
        ],
        links: [link('w1', 'lock', { style: 'dashed' }), link('w2', 'lock', { style: 'dashed' })],
        flows: [
          { path: ['w1', 'lock'], tone: 'request', label: 'lock', duration: 1 },
          { path: ['lock', 'w1'], tone: 'response', label: 'token 33', duration: 1, delay: 1.1 },
          { path: ['w2', 'lock'], tone: 'request', label: 'lock', duration: 1, delay: 2.4 },
          { path: ['lock', 'w2'], tone: 'response', label: 'token 34', duration: 1, delay: 3.5 },
        ],
        panel: {
          title: 'Grants so far',
          icon: 'Hash',
          rows: [
            { text: 'run 1 granted', value: '33' },
            { text: 'run 2 granted', value: '34', tone: 'good' },
            { text: 'grant script runs', value: 'INCR lock:stock-sync:token' },
          ],
          footer: { text: 'Each grant is higher than the last', tone: 'muted' },
        },
      },
    },
    {
      title: 'Resource checks',
      tag: 'concept',
      heading: 'The resource enforces the token',
      eli5: 'The **room door** remembers the biggest ticket it has seen and will not open for a smaller one.',
      body: [
        'When run 1 wakes up and writes with 33, the DB has already seen 34, so the write matches zero rows and run 1 aborts.',
        'The check has to live in the resource, because only it sees writes in the order they arrive. This is the same idea as Raft\'s term number: a higher number wins, and an old leader is ignored.',
      ],
      keyIdea: 'Only the resource sees the real order of writes, so only the resource can reject stale ones.',
      metrics: { holder: 'run 2', ttl: '28 s', token: '34 (DB has seen 34)', stock: '3' },
      metricTones: { token: 'good', stock: 'good' },
      scene: {
        nodes: [
          { ...w1, status: 'hot', badge: 'token 33' },
          { ...w2, status: 'active', badge: 'token 34' },
          { ...db, status: 'ok', badge: 'max token 34' },
        ],
        links: dbLinks,
        flows: [
          { path: ['w2', 'db'], tone: 'request', label: 'qty = 3, token 34', duration: 1.2 },
          { path: ['db', 'w2'], tone: 'response', label: '1 row', duration: 1, delay: 1.3 },
          { path: ['w1', 'db'], tone: 'request', label: 'qty = 5, token 33', duration: 1.2, delay: 2.5 },
          { path: ['db', 'w1'], tone: 'error', label: '0 rows: stale', duration: 1, delay: 3.8 },
        ],
        panel: {
          title: 'The late write is refused',
          icon: 'Shield',
          rows: [
            { text: 'run 2, token 34', value: 'accepted', tone: 'good' },
            { text: 'run 1, token 33', value: 'rejected', tone: 'bad' },
          ],
          footer: { text: 'Final stock is correct: 3', tone: 'good' },
        },
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
      title: 'Redis failover',
      tag: 'tradeoff',
      heading: 'A single Redis can lose the lock on failover',
      eli5: 'The desk clerk writes down who has the key, but the note reaches the backup clerk a little later. If the first clerk quits, the backup does not know the key is out.',
      body: [
        'With a replica and failover, replication is asynchronous. The primary can grant the lock and die before the key reaches the replica. The promoted replica has no lock, and a second caller gets it.',
        'A token counter kept in that Redis can roll back the same way, and hand out a number twice.',
      ],
      keyIdea: 'Async replication can drop a granted lock, and a token counter with it.',
      metrics: { holder: 'run 1 and run 2', ttl: '-', token: 'counter rolled back', stock: '3' },
      metricTones: { holder: 'bad', token: 'bad' },
      scene: {
        nodes: [
          { ...w1, status: 'active', badge: 'has lock' },
          { ...w2, status: 'active', badge: 'also has lock' },
          { ...lock, status: 'down', label: 'Redis primary', badge: 'died' },
          { ...replica, status: 'hot', badge: 'promoted, empty' },
        ],
        links: [link('w1', 'lock', { style: 'dashed' }), link('w2', 'replica', { style: 'dashed' }), link('lock', 'replica', { style: 'faint', label: 'copy was late', labelTone: 'warn' })],
        flows: [
          { path: ['w1', 'lock'], tone: 'request', label: 'SET NX', duration: 1 },
          { path: ['lock', 'w1'], tone: 'response', label: 'OK', duration: 1, delay: 1.1 },
          { path: ['w2', 'replica'], tone: 'request', label: 'SET NX', duration: 1, delay: 2.4 },
          { path: ['replica', 'w2'], tone: 'error', label: 'OK (too)', duration: 1, delay: 3.5 },
        ],
        panel: {
          title: 'Failover race',
          icon: 'Split',
          rows: [
            { text: 'primary grants run 1', tone: 'good' },
            { text: 'primary dies, copy missed', tone: 'bad' },
            { text: 'replica grants run 2', tone: 'bad' },
          ],
        },
      },
    },
    {
      title: 'Redlock',
      tag: 'tradeoff',
      heading: 'Redlock: ask a majority of Redis nodes',
      eli5: 'Instead of one desk, the student asks five desks and needs three to say yes. It is harder to fool, but everyone must agree on what time it is.',
      body: [
        '**Redlock** asks for the key on a majority of 5 independent Redis nodes. Its safety argument depends on bounded clock drift and pauses, and it has no built-in fencing token.',
        'The holder subtracts the acquire time from the TTL and trusts the lock only for what is left.',
        'It is heavier than an efficiency lock needs and not safe enough for a correctness lock, so it sits in an awkward middle.',
      ],
      keyIdea: 'Redlock lowers the chance of losing a lock but leans on clocks and gives no token.',
      metrics: { holder: 'run 1', ttl: '30 s (clock based)', token: 'none', stock: '3' },
      metricTones: { token: 'warn' },
      scene: {
        nodes: [
          { ...w1, at: at(0, 3.6), status: 'active', badge: '3 of 5 granted (2 not shown)' },
          { id: 'ra', kind: 'cache', at: at(-3.6, -3.2), label: 'Redis A', sub: '1 of 5', status: 'ok' },
          { id: 'rb', kind: 'cache', at: at(0, -3.2), label: 'Redis B', sub: '2 of 5', status: 'ok' },
          { id: 'rc', kind: 'cache', at: at(3.6, -3.2), label: 'Redis C', sub: '3 of 5', status: 'ok' },
        ],
        links: [link('w1', 'ra', { style: 'dashed' }), link('w1', 'rb', { style: 'dashed' }), link('w1', 'rc', { style: 'dashed' })],
        flows: [
          { path: ['w1', 'ra'], tone: 'request', label: 'SET NX', duration: 1 },
          { path: ['w1', 'rb'], tone: 'request', label: 'SET NX', duration: 1, delay: 0.2 },
          { path: ['w1', 'rc'], tone: 'request', label: 'SET NX', duration: 1, delay: 0.4 },
        ],
        panel: {
          title: 'What Redlock assumes',
          icon: 'Clock',
          rows: [
            { text: 'majority grants', value: '3 of 5', tone: 'good' },
            { text: 'validity', value: 'TTL minus acquire time' },
            { text: 'clock drift', value: 'bounded', tone: 'warn' },
            { text: 'pauses', value: 'short', tone: 'warn' },
            { text: 'fencing token', value: 'none', tone: 'bad' },
          ],
        },
      },
    },
    {
      title: 'etcd lease',
      tag: 'concept',
      heading: 'A consensus lease survives failover and gives a token',
      eli5: 'The desk is run by three clerks who must agree before they hand out the key. If one clerk leaves, the other two still remember. The ticket number comes from their shared notebook.',
      body: [
        'A **lease** in **etcd** or **ZooKeeper** goes through consensus, so it survives losing a minority of nodes. In etcd the lock key is attached to a lease and vanishes when it expires. In ZooKeeper a waiter watches the previous node.',
        'The token is the etcd revision, or the zxid or sequence number in ZooKeeper.',
        'A lease still expires under a paused holder, so the resource must still check the token.',
      ],
      keyIdea: 'A consensus lease keeps the lock across failovers and comes with a monotonic token. It does not remove the pause problem, so fence anyway.',
      metrics: { holder: 'run 2', ttl: 'lease 10 s', token: 'etcd revision 1047', stock: '3' },
      metricTones: { token: 'good' },
      scene: {
        nodes: [
          { ...w2, at: at(-3.8, 3.6), status: 'active', badge: 'rev 1047' },
          { ...e1, status: 'ok' },
          { ...e2, status: 'active', chips: ['lease 10 s'] },
          { ...e3, status: 'ok' },
          { ...db, at: at(3.8, 3.6), status: 'ok', badge: 'max token 1047' },
        ],
        links: [link('w2', 'e2', { style: 'dashed' }), link('e2', 'e1', { style: 'faint' }), link('e2', 'e3', { style: 'faint' }), link('w2', 'db')],
        flows: [
          { path: ['w2', 'e2'], tone: 'request', label: 'lock', duration: 1 },
          { path: ['e2', 'e1'], tone: 'data', duration: 0.8, delay: 1.1 },
          { path: ['e2', 'e3'], tone: 'data', duration: 0.8, delay: 1.1 },
          { path: ['e2', 'w2'], tone: 'response', label: 'granted, rev 1047', duration: 1, delay: 2 },
          { path: ['w2', 'db'], tone: 'request', label: 'token 1047', duration: 1.2, delay: 3.1 },
        ],
        panel: {
          title: 'How the lease lock works',
          icon: 'Timer',
          rows: [
            { text: 'lock key attached to lease', value: 'lease 10 s' },
            { text: 'keepalive every few s', value: 'lease renewed', tone: 'good' },
            { text: 'crash: lease expires', value: 'key deleted', tone: 'warn' },
            { text: 'waiter watches the previous key', value: 'wakes on delete' },
            { text: 'token', value: 'revision, zxid or sequence', tone: 'good' },
          ],
          footer: { text: 'ZooKeeper uses an ephemeral sequential node', tone: 'muted' },
        },
        caption: 'The grant is committed on 2 of 3 before it is returned',
      },
    },
    {
      title: 'Lock waiting',
      tag: 'concept',
      heading: 'When the lock is taken: skip, or wait with backoff',
      eli5: 'If the key is out, a student can go home, or come back a bit later. If everyone knocks every second, the desk gets swamped, so each waits a little longer each time.',
      body: [
        'A loser can skip, as the sync does, or wait and retry with **backoff and jitter**. Waiting suits work that must run. Many waiters retrying in lockstep hammer the lock service.',
        'Set a maximum wait, so a stuck holder does not pile up waiters forever. After that, give up and report it.',
      ],
      keyIdea: 'Skip, or back off with jitter and a maximum wait.',
      metrics: { holder: 'run 1', ttl: '30 s', token: '-', stock: '3' },
      scene: {
        nodes: [
          { ...w1, status: 'active', badge: 'holds sku:42' },
          { ...w2, at: at(-1.2, 4), status: 'dim', chips: ['retry in 1 s', 'retry in 2 s', 'retry in 4 s'] },
          { ...lock, status: 'active', chips: ['lock:stock-sync'] },
        ],
        links: [link('w1', 'lock', { style: 'dashed' }), link('w2', 'lock', { style: 'dashed', label: 'backoff + jitter' })],
        flows: [
          { path: ['w2', 'lock'], tone: 'request', label: 'SET NX', duration: 1 },
          { path: ['lock', 'w2'], tone: 'error', label: 'nil, wait', duration: 1, delay: 1.1 },
        ],
        panel: {
          title: 'Wait policy',
          icon: 'Timer',
          rows: [
            { text: 'skip', value: 'next cron run retries', tone: 'good' },
            { text: 'wait with backoff and jitter', value: '1 s, 2 s, 4 s' },
            { text: 'maximum wait', value: '20 s, then give up', tone: 'warn' },
          ],
        },
      },
    },
    {
      title: 'Lock scope',
      tag: 'concept',
      heading: 'Lock the smallest thing that works',
      eli5: 'One key for the whole building means only one student can study at a time. One key per desk lets everyone work, and nobody shares a desk.',
      body: [
        'Lock the smallest thing that works. `lock:sku:42` instead of one lock for the whole sync lets different SKUs run in parallel.',
        'A narrow lock means less waiting and a smaller blast radius when a holder stalls. It also means more keys to manage.',
      ],
      keyIdea: 'Keep each lock as narrow as the data it guards.',
      metrics: { holder: 'run 1 and run 2 (different SKUs)', ttl: '30 s', token: '-', stock: '3' },
      metricTones: { holder: 'good' },
      scene: {
        nodes: [
          { ...w1, status: 'active', badge: 'holds sku:42' },
          { ...w2, status: 'active', badge: 'holds sku:77' },
          { ...lock, status: 'active', chips: ['lock:sku:42', 'lock:sku:77'] },
        ],
        links: [link('w1', 'lock', { style: 'dashed' }), link('w2', 'lock', { style: 'dashed' })],
        flows: [
          { path: ['w1', 'lock'], tone: 'request', label: 'SET NX sku:42', duration: 1 },
          { path: ['w2', 'lock'], tone: 'request', label: 'SET NX sku:77', duration: 1, delay: 0.2 },
          { path: ['lock', 'w1'], tone: 'response', label: 'OK', duration: 1, delay: 1.1 },
          { path: ['lock', 'w2'], tone: 'response', label: 'OK', duration: 1, delay: 1.3 },
        ],
        panel: {
          title: 'Lock scope',
          icon: 'Layers',
          rows: [
            { text: 'lock:stock-sync', value: '1 run at a time', tone: 'warn' },
            { text: 'lock:sku:42', value: 'SKUs in parallel', tone: 'good' },
          ],
          footer: { text: 'Smaller lock, less waiting', tone: 'muted' },
        },
      },
    },
    {
      title: 'Why lock?',
      tag: 'tradeoff',
      heading: 'Efficiency locks and correctness locks',
      eli5: 'If two students sometimes tidy the same room, the room just gets tidied twice. If two students write in the same diary page, the page is ruined. The second case needs the strict rules.',
      body: [
        'If a double run only repeats work (an extra supplier call, a report emailed twice), it is an **efficiency lock**. A single Redis key with a TTL is fine.',
        'If it makes data wrong (stale stock, a lost update, a double payment), it is a **correctness lock**. Use a consensus lease and a fencing token checked by every resource the holder writes to.',
        'If the lock service is unreachable, an efficiency lock fails open or skips. A correctness lock fails closed and relies on fencing.',
      ],
      keyIdea: 'If a double run only wastes work, a simple lock will do. If it corrupts data, fence every write.',
      metrics: { holder: 'run 2', ttl: 'lease 10 s', token: '1047', stock: '3' },
      scene: {
        nodes: [
          { ...w1, status: 'dim', badge: 'efficiency: skip' },
          { ...w2, status: 'active', badge: 'correctness: fence' },
          { ...lock, status: 'dim', chips: ['fine for reports'] },
          { ...db, status: 'ok', badge: 'checks token' },
        ],
        links: lockLinks,
        flows: [
          { path: ['w2', 'db'], tone: 'request', label: 'write + token', duration: 1.2 },
          { path: ['db', 'w2'], tone: 'response', label: 'accepted', duration: 1, delay: 1.3 },
        ],
        panel: {
          title: 'Which lock?',
          icon: 'Scale',
          rows: [
            { text: 'Double run wastes work', value: 'Redis key', tone: 'good' },
            { text: 'Double run corrupts data', value: 'lease + fence', tone: 'warn' },
            { text: 'Lock service down, efficiency', value: 'fail open or skip' },
            { text: 'Lock service down, correctness', value: 'fail closed', tone: 'warn' },
          ],
        },
      },
      quiz: {
        question: 'A job emails a daily digest. A rare double run sends two emails to a few users. Which choice fits best?',
        options: [
          'An etcd lease plus fencing tokens on the email provider',
          'A single Redis key with a TTL, and accept the rare double send',
          'No protection, because duplicates are impossible',
          'A Redlock across 5 nodes, because emails are correctness critical',
        ],
        answer: 1,
        explain: 'A double send is wasted work and a small annoyance, so it is an efficiency lock. A simple Redis key with a TTL is enough. The email provider could not check a fencing token anyway.',
      },
    },
    {
      title: 'Outside effects',
      tag: 'concept',
      heading: 'Side effects outside your systems need idempotency keys',
      eli5: 'The ticket number only works at doors that read it. A shop across the street ignores tickets, so you write a receipt number on every order and the shop ignores a repeat.',
      body: [
        'Fencing only protects systems that check the token. A card network or an email provider will not.',
        'For those side effects, pass an **idempotency key** so a second attempt is recognized and dropped. Derive it from the work, such as `charge-order-9001`, not from the attempt.',
      ],
      keyIdea: 'Where the resource cannot check a token, make the call safe to repeat.',
      metrics: { holder: 'run 2', ttl: 'lease 10 s', token: '1047', stock: '3' },
      scene: {
        nodes: [
          { ...w1, status: 'dim', chips: ['charge-order-9001'] },
          { ...w2, status: 'active', chips: ['charge-order-9001'] },
          { id: 'pay', kind: 'block', at: at(3.8, 0), label: 'payment API', sub: 'cannot check tokens', icon: 'Receipt', tint: 'amber', status: 'ok' },
        ],
        links: [link('w1', 'pay'), link('w2', 'pay')],
        flows: [
          { path: ['w2', 'pay'], tone: 'request', label: 'charge 18.50', duration: 1.2 },
          { path: ['pay', 'w2'], tone: 'response', label: 'charged', duration: 1, delay: 1.3 },
          { path: ['w1', 'pay'], tone: 'request', label: 'charge 18.50', duration: 1.2, delay: 2.6 },
          { path: ['pay', 'w1'], tone: 'response', label: 'same result, no new charge', duration: 1.2, delay: 3.9 },
        ],
        panel: {
          title: 'Idempotency key',
          icon: 'Key',
          rows: [
            { text: '1st call, key seen', value: 'charge', tone: 'good' },
            { text: '2nd call, same key', value: 'return old result', tone: 'good' },
          ],
        },
      },
    },
    {
      title: 'Row lock',
      tag: 'concept',
      heading: 'Let the database lock it for you',
      eli5: 'If the shared thing is one diary page, the page can have its own latch. Whoever turns the latch first writes, and the other waits or tries again.',
      body: [
        'If the shared thing is a row, a transaction with `SELECT ... FOR UPDATE` locks it, and the lock dies with the connection. A conditional write such as `UPDATE ... WHERE version = 7` is optimistic locking: the second writer matches zero rows and retries.',
        'A unique constraint stops two runs from inserting the same order. For DB-backed jobs with no single row to lock, Postgres offers `pg_advisory_lock`, a named lock held by the session.',
      ],
      keyIdea: 'When the guarded thing is a database row, the database already has the lock.',
      metrics: { holder: 'DB row lock', ttl: 'until commit', token: 'version 7', stock: '3' },
      scene: {
        nodes: [
          { ...w1, status: 'active', chips: ['FOR UPDATE'] },
          { ...w2, status: 'dim', chips: [{ text: 'waits for row', tone: 'warn' }] },
          { ...db, status: 'ok', badge: 'row SHOE-42 locked' },
        ],
        links: dbLinks,
        flows: [
          { path: ['w1', 'db'], tone: 'request', label: 'BEGIN, lock row', duration: 1.2 },
          { path: ['w2', 'db'], tone: 'request', label: 'lock row', duration: 1.2, delay: 0.5 },
          { path: ['db', 'w2'], tone: 'error', label: 'wait', duration: 1, delay: 1.8 },
        ],
        panel: {
          title: 'Three database tools',
          icon: 'Database',
          rows: [
            { text: 'SELECT ... FOR UPDATE', value: 'row lock' },
            { text: 'WHERE version = 7', value: 'optimistic' },
            { text: 'UNIQUE (order_id)', value: 'no duplicates' },
          ],
        },
      },
      code: {
        language: 'sql',
        title: 'Row lock and optimistic write',
        source: `-- pessimistic: lock the row until commit
BEGIN;
SELECT qty FROM stock WHERE sku = 'SHOE-42' FOR UPDATE;
UPDATE stock SET qty = 3 WHERE sku = 'SHOE-42';
COMMIT;

-- optimistic: the second writer matches 0 rows and retries
UPDATE stock SET qty = 3, version = 8
WHERE sku = 'SHOE-42' AND version = 7;`,
        highlight: [3, 9],
      },
    },
    {
      title: 'Idempotent work',
      tag: 'concept',
      heading: 'Make overlap harmless',
      eli5: 'If both students copy the same page from the same book, the notebook ends up right no matter who finishes last. The page stamps the date, and an older copy is ignored.',
      body: [
        'If running the sync twice writes the same correct numbers, overlap is harmless. Stamp each write with the feed\'s timestamp and accept only newer ones.',
        'The stale write from step 1 is refused without any lock. That timestamp acts as a fencing token chosen by the data.',
      ],
      keyIdea: 'When the data orders the writes, no lock is needed.',
      metrics: { holder: 'none needed', ttl: '-', token: 'feed time 10:00:20', stock: '3' },
      metricTones: { stock: 'good' },
      scene: {
        nodes: [
          { ...w1, status: 'hot', badge: 'feed time :00' },
          { ...w2, status: 'active', badge: 'feed time :20' },
          { ...db, status: 'ok', badge: 'keeps newest feed time' },
        ],
        links: dbLinks,
        flows: [
          { path: ['w2', 'db'], tone: 'request', label: 'qty 3 @ :20', duration: 1.2 },
          { path: ['w1', 'db'], tone: 'request', label: 'qty 5 @ :00', duration: 1.2, delay: 1.4 },
          { path: ['db', 'w1'], tone: 'error', label: 'older: ignored', duration: 1, delay: 2.7 },
        ],
        panel: {
          title: 'Newest feed time wins',
          icon: 'Clock',
          code: "UPDATE stock\nSET qty = :qty, fed_at = :t\nWHERE sku = :sku\n  AND fed_at < :t;",
          footer: { text: 'The data itself orders the writes', tone: 'good' },
        },
        caption: 'The data itself orders the writes',
      },
    },
    {
      title: 'Single owner',
      tag: 'concept',
      heading: 'Give each piece of work one owner',
      eli5: 'Give each student their own shelf in the room. Nobody argues over a shelf, so nobody needs the key.',
      body: [
        'Partition by key so each SKU range belongs to one worker, as Kafka assigns each partition to one consumer in a group. A single writer per partition needs no lock while ownership is stable.',
        'Ownership moves on rebalance or failover, and a paused old owner can overlap the new one. Kafka fences the old owner with an epoch number the broker checks. That is a fencing token again.',
        'A leader elected through etcd or ZooKeeper does the same for a whole job. Use a distributed lock when none of these fit.',
      ],
      keyIdea: 'Row locks, conditional writes, idempotent work and single owners remove the need for most distributed locks.',
      metrics: { holder: 'owner per range', ttl: '-', token: '-', stock: '3' },
      scene: {
        nodes: [
          { ...w1, status: 'active', badge: 'owns SKUs A to M' },
          { ...w2, status: 'active', badge: 'owns SKUs N to Z' },
          { ...db, status: 'ok' },
        ],
        links: dbLinks,
        flows: [
          { path: ['w1', 'db'], tone: 'request', label: 'SKU A..M', duration: 1.2 },
          { path: ['w2', 'db'], tone: 'request', label: 'SKU N..Z', duration: 1.2, delay: 0.4 },
        ],
        panel: {
          title: 'Ownership map',
          icon: 'Users',
          rows: [
            { text: 'run 1', value: 'SKUs A to M', tone: 'good' },
            { text: 'run 2', value: 'SKUs N to Z', tone: 'good' },
            { text: 'overlap', value: 'none' },
          ],
        },
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'A lock picks a holder. A token makes it stick.',
      eli5: 'The front desk lends the key with a numbered ticket and a return time. The room door only opens for the newest ticket, so a student who overslept cannot barge in.',
      body: [
        'A distributed lock is a key only one caller can create, with a TTL so a crashed holder does not block everyone. Redis `SET NX PX` suits efficiency. A lease in etcd or ZooKeeper survives node failures.',
        'Every lock with an expiry has the paused-process gap. **Fencing tokens** close it when the resource rejects lower tokens. First check whether a row lock, conditional write, idempotency or single owner already solves it.',
      ],
      keyIdea: 'Locks expire and holders pause. Correctness comes from the resource rejecting stale tokens.',
      metrics: { holder: 'run 2', ttl: 'lease 10 s', token: '1047', stock: '3' },
      metricTones: { token: 'good', stock: 'good' },
      scene: {
        nodes: [
          { ...w1, status: 'dim', badge: 'token 1046' },
          { ...w2, status: 'ok', badge: 'token 1047' },
          { ...e2, status: 'active', label: 'etcd', sub: '3 voters', at: at(0, 0) },
          { ...db, status: 'ok', badge: 'max token 1047' },
        ],
        links: [link('w1', 'e2', { style: 'dashed' }), link('w2', 'e2', { style: 'dashed' }), ...dbLinks],
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
