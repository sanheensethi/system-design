import type { Lesson, SceneNode } from '../engine/types';

/** Place a node by screen column (x - y) and screen row (x + y). */
const p = (col: number, row: number): [number, number] => [(col + row) / 2, (row - col) / 2];

const clients: SceneNode = { id: 'clients', kind: 'client', at: p(-6.8, 0), label: 'clients', sub: '5,000 req/s' };
const vip: SceneNode = { id: 'vip', kind: 'lb', at: p(-3.4, 0), label: 'virtual IP', sub: '10.0.0.50' };
const primary: SceneNode = { id: 'primary', kind: 'db', at: p(0.4, -3.3), label: 'primary', sub: 'node A' };
const standby: SceneNode = { id: 'standby', kind: 'db', at: p(0.4, 3.3), label: 'standby', sub: 'node B' };
const monitor: SceneNode = { id: 'monitor', kind: 'monitor', at: p(4.2, 0), label: 'monitor', sub: 'heartbeats' };
const witness: SceneNode = { id: 'witness', kind: 'monitor', at: p(6.8, 3.2), label: 'witness', sub: 'vote 3 of 3' };

const pairLinks = [
  { from: 'clients', to: 'vip' },
  { from: 'vip', to: 'primary' },
  { from: 'vip', to: 'standby', style: 'faint' as const },
  { from: 'primary', to: 'standby', style: 'dashed' as const, label: 'replication' },
];
const watchLinks = [
  { from: 'monitor', to: 'primary', style: 'dashed' as const },
  { from: 'monitor', to: 'standby', style: 'dashed' as const },
];

export const failover: Lesson = {
  id: 'failover',
  title: 'Failover: active-passive, active-active',
  tagline: 'Keep a spare ready, detect the failure, switch traffic over, and make sure the old node really stops.',
  minutes: 15,
  level: 'Intermediate',
  learn: [
    'Why redundancy only helps if failover works',
    'Hot, warm and cold standby, and what each costs',
    'Heartbeats, timeouts and promotion of a standby',
    'Moving traffic with a virtual IP or a DNS switch',
    'Split brain, quorum and fencing',
    'RTO and RPO, active-active capacity, and failback',
  ],
  metrics: [
    { key: 'rto', label: 'Downtime (RTO)' },
    { key: 'rpo', label: 'Data lost (RPO)' },
    { key: 'spare', label: 'Standby' },
    { key: 'cost', label: 'Cost' },
  ],
  steps: [
    {
      title: 'One box',
      tag: 'problem',
      heading: 'The only server dies at 3 AM',
      eli5: 'A class has one teacher and no substitute. When the teacher is sick, the class just sits there until someone finds a replacement. The teacher is a **single point of failure**.',
      body: [
        'The order database runs on one machine. At 3 AM its power supply fails. Every request now errors. The on-call engineer wakes up, logs in, finds a new machine, restores last night\'s backup and replays what logs survived.',
        'That takes about **2 hours**, and every order since the 1 AM backup that the logs do not cover is gone. Nothing was wrong with the software. One part broke, and nothing else could take its place.',
        'A component whose failure takes the whole system down is a **single point of failure**. Failover is the practice of keeping a second one ready and switching to it, ideally without a human.',
      ],
      keyIdea: 'If one part can take the whole system down, it is a single point of failure, and recovery is as slow as a human.',
      metrics: { rto: '2 hours', rpo: 'up to 2 hours', spare: 'none', cost: '1x' },
      scene: {
        nodes: [clients, vip, { ...primary, label: 'database', sub: 'only copy', status: 'down', badge: 'power failure' }],
        links: [{ from: 'clients', to: 'vip' }, { from: 'vip', to: 'primary' }],
        flows: [
          { path: ['clients', 'vip'], tone: 'request', count: 4, duration: 1 },
          { path: ['vip', 'primary'], tone: 'error', label: 'connection refused', count: 3, duration: 1.2, delay: 1 },
        ],
        caption: 'One machine, no spare',
      },
    },
    {
      title: 'Redundancy',
      tag: 'concept',
      heading: 'A second copy, kept ready',
      eli5: 'The school hires a substitute who sits in the next room and follows the lesson plan. If the teacher falls ill, the **standby** walks in and carries on.',
      body: [
        'Add a second node, the **standby**, and stream every change from the primary to it. Traffic still goes to the primary. The standby holds a near-current copy and waits.',
        'On paper the gain is large. If each node is up 99.9% of the time and they fail independently, the chance both are down at once is 0.1% x 0.1%, so the pair is up 99.9999% of the time.',
        'Two assumptions hide in that number. The failures must be independent: two nodes on the same power circuit or the same bad config push fail together. And the switch must work every time. Most real outages of redundant systems come from the failover itself.',
      ],
      keyIdea: 'Redundancy removes a single point of failure only if failures are independent and the switch to the spare works.',
      metrics: { rto: '-', rpo: 'seconds', spare: '1 node', cost: '2x' },
      scene: {
        nodes: [clients, vip, { ...primary, status: 'active', badge: 'serves traffic' }, { ...standby, badge: 'follows the log' }],
        links: pairLinks,
        flows: [
          { path: ['clients', 'vip', 'primary'], tone: 'request', count: 3, duration: 1.6 },
          { path: ['primary', 'standby'], tone: 'data', label: 'WAL stream', count: 2, duration: 1.4, delay: 1.7 },
        ],
        caption: 'Active-passive: one serves, one waits',
      },
    },
    {
      title: 'Standby types',
      tag: 'tradeoff',
      heading: 'Hot, warm and cold standby',
      eli5: 'A cold spare is a teacher you must phone and drive in. A warm one is in the building. A hot one sits in the classroom, ready to talk the second the teacher stops. Closer costs more.',
      body: [
        '**Cold standby**: backups plus spare hardware or a template to build from. Nothing runs until disaster. Recovery takes hours, and you lose everything since the last backup. It is cheap.',
        '**Warm standby**: a running replica that receives changes, often on a smaller machine, not serving traffic. Promote it and maybe resize it. Recovery takes minutes. You lose the replication lag, often seconds.',
        '**Hot standby**: a full-size node kept in sync, often with synchronous replication, ready to take writes at once. Recovery takes seconds and can lose nothing. You pay for a second full machine that mostly waits.',
      ],
      keyIdea: 'The closer a standby is to ready, the faster the recovery and the higher the bill.',
      metrics: { rto: 'hours / minutes / seconds', rpo: 'backup / lag / 0', spare: 'cold, warm or hot', cost: '1.1x / 1.5x / 2x' },
      scene: {
        nodes: [clients, vip, { ...primary, status: 'active' }, { ...standby, status: 'ok', label: 'hot standby', badge: 'in sync, full size' }],
        links: pairLinks,
        flows: [
          { path: ['clients', 'vip', 'primary'], tone: 'request', duration: 1.6 },
          { path: ['primary', 'standby'], tone: 'data', label: 'sync', duration: 0.9, delay: 1.7 },
          { path: ['standby', 'primary'], tone: 'handshake', label: 'ack', duration: 0.9, delay: 2.7 },
        ],
        caption: 'A hot standby confirms each write',
      },
    },
    {
      title: 'Heartbeats',
      tag: 'concept',
      heading: 'Knowing the primary is gone',
      eli5: 'The principal knocks on the classroom door every second. If three knocks in a row get no answer, the teacher is counted as gone. Those knocks are **heartbeats**.',
      body: [
        'A **monitor** sends the primary a small check every second: a ping, a TCP connect, or better, a tiny query such as `SELECT 1`. A reply is a **heartbeat**.',
        'One missed heartbeat proves little. A garbage collection pause or a dropped packet can cause it. So the monitor waits for several misses in a row, for example **3 misses at 1 second**, before it declares the primary dead.',
        'The timeout is a trade. Short timeouts detect real failures fast and also fail over on hiccups, which causes its own outage. Long timeouts are calm and slow. Most setups land between 5 and 30 seconds.',
      ],
      keyIdea: 'A node is declared dead after several missed heartbeats. The timeout trades detection speed against false alarms.',
      metrics: { rto: '3 s to detect', rpo: '-', spare: 'hot', cost: '2x' },
      scene: {
        nodes: [clients, vip, { ...primary, status: 'down', badge: 'no reply x3' }, standby, { ...monitor, status: 'active', badge: '1 s interval' }],
        links: [...pairLinks, ...watchLinks],
        flows: [
          { path: ['monitor', 'primary'], tone: 'handshake', label: 'SELECT 1', count: 3, duration: 1 },
          { path: ['primary', 'monitor'], tone: 'error', label: 'timeout', duration: 1, delay: 1.2 },
          { path: ['monitor', 'standby'], tone: 'handshake', label: 'still alive?', duration: 1, delay: 2.4 },
          { path: ['standby', 'monitor'], tone: 'response', label: 'ok', duration: 1, delay: 3.5 },
        ],
        caption: 'Three misses in a row: declare it dead',
      },
      code: {
        language: 'python',
        title: 'A heartbeat loop with a miss counter',
        source: `INTERVAL = 1.0      # seconds between checks
MAX_MISSES = 3      # declare dead after 3 misses in a row

def watch(primary, on_dead):
    misses = 0
    while True:
        try:
            primary.query("SELECT 1", timeout=0.5)
            misses = 0                       # healthy: reset
        except (TimeoutError, ConnectionError):
            misses += 1
            if misses >= MAX_MISSES:
                on_dead(primary)             # start failover once
                return
        time.sleep(INTERVAL)`,
        highlight: [2, 9, 11, 12, 13],
      },
    },
    {
      title: 'Promotion',
      tag: 'concept',
      heading: 'Promote the standby, then move the traffic',
      eli5: 'The substitute steps up to the front, and the sign on the classroom door now points to her. Families keep using the same door. Moving the sign is the **virtual IP** switch.',
      body: [
        '**Promotion** turns the standby into the primary. It stops replaying the log, finishes applying what it has, and starts accepting writes.',
        'Then clients must find it. With a **virtual IP**, clients always connect to one address, `10.0.0.50`. The new primary claims it and announces the change on the local network (a gratuitous ARP), so traffic moves within a second or two. This works inside one network segment.',
        'Across networks, use a **DNS switch**: update the record to the new node\'s address. Clients and resolvers cache the old answer until its TTL runs out, so keep the TTL short (30 to 60 seconds), and expect some clients to hold on longer. A proxy or load balancer in front can also redirect traffic, as long as it is not a single point of failure itself.',
      ],
      keyIdea: 'Failover is promote, then redirect. A virtual IP moves in seconds inside one network. DNS is slower, bounded by the TTL.',
      metrics: { rto: '~15 s', rpo: '0 (sync standby)', spare: 'promoted', cost: '2x' },
      scene: {
        nodes: [
          clients,
          { ...vip, status: 'active', badge: 'now points to B' },
          { ...primary, label: 'old primary', status: 'down' },
          { ...standby, label: 'new primary', status: 'ok', badge: 'promoted' },
          { ...monitor, status: 'active' },
        ],
        links: [
          { from: 'clients', to: 'vip' },
          { from: 'vip', to: 'primary', style: 'faint' },
          { from: 'vip', to: 'standby' },
          ...watchLinks,
        ],
        flows: [
          { path: ['monitor', 'standby'], tone: 'event', label: 'promote', duration: 1 },
          { path: ['standby', 'vip'], tone: 'event', label: 'claim 10.0.0.50', duration: 1, delay: 1.1 },
          { path: ['clients', 'vip', 'standby'], tone: 'request', count: 3, duration: 1.6, delay: 2.3 },
        ],
        caption: 'Same address, new machine behind it',
      },
      code: {
        language: 'bash',
        title: 'Promotion steps on the standby (simplified)',
        source: `# 1. Stop replaying and start accepting writes
pg_ctl promote -D /var/lib/postgresql/data

# 2. Take over the virtual IP
ip addr add 10.0.0.50/24 dev eth0

# 3. Tell the switches and neighbors where the IP lives now
arping -U -c 3 -I eth0 10.0.0.50

# In practice a tool such as keepalived or Patroni runs
# these steps, and only after the old node is fenced.`,
        highlight: [2, 5, 8, 11],
      },
    },
    {
      title: 'RTO and RPO',
      tag: 'tradeoff',
      heading: 'Two numbers that define "recovered"',
      eli5: 'Two questions for the school: how long was the class without a teacher, and how much of the lesson was forgotten? The first is **RTO**, the second is **RPO**.',
      body: [
        '**RTO** (recovery time objective) is how long the service may be down. It adds up detection, promotion and redirect: 3 s + 5 s + a few seconds of reconnects is roughly 15 s for a hot standby with a virtual IP.',
        '**RPO** (recovery point objective) is how much recent data you may lose, measured in time. With async replication it is the lag at the moment of failure. With synchronous replication to the standby it is zero, at the price of a round trip on every commit.',
        'Set both per system, from the business side. A payments ledger may need RPO 0 and RTO under a minute. An analytics dashboard can accept an hour of each. The targets decide the standby type, the replication mode and the bill.',
      ],
      keyIdea: 'RTO is how long you are down, RPO is how much data you lose. Pick them first, then build the failover to meet them.',
      metrics: { rto: '15 s', rpo: '0', spare: 'hot, sync', cost: '2x + commit latency' },
      scene: {
        nodes: [clients, { ...vip, badge: 'RTO: 15 s' }, { ...primary, label: 'old primary', status: 'down' }, { ...standby, label: 'new primary', status: 'ok', badge: 'RPO: 0' }, monitor],
        links: [{ from: 'clients', to: 'vip' }, { from: 'vip', to: 'standby' }, ...watchLinks],
        flows: [
          { path: ['clients', 'vip', 'standby'], tone: 'request', count: 3, duration: 1.6 },
          { path: ['standby', 'vip', 'clients'], tone: 'response', count: 3, duration: 1.6, delay: 1.7 },
        ],
        caption: 'Down for 15 seconds, nothing lost',
      },
      quiz: {
        question: 'A warm standby uses async replication with about 4 s of lag, and failover takes 3 minutes end to end. What are the RTO and RPO?',
        options: ['RTO 4 s, RPO 3 min', 'RTO 3 min, RPO about 4 s', 'RTO 3 min, RPO 0', 'RTO 0, RPO 4 s'],
        answer: 1,
        explain: 'RTO is the time until service is back: 3 minutes. RPO is the data you can lose: whatever had not reached the standby, about 4 seconds of writes.',
      },
    },
    {
      title: 'Split brain',
      tag: 'case',
      heading: 'Case: the primary was not dead',
      eli5: 'The principal knocks, hears nothing through a thick door, and sends in the substitute. But the teacher was still teaching. Now two classes get different homework. That is **split brain**.',
      body: [
        'A network switch between the monitor and node A fails. Node A is healthy and some app servers can still reach it. The monitor sees three missed heartbeats and promotes node B.',
        'Now both nodes accept writes. A customer\'s refund lands on A, and their new order lands on B. When the network heals there are two histories with no clean way to merge them. This is **split brain**, and it is worse than downtime because it damages data quietly.',
        'The root cause: a failed heartbeat only says "I cannot reach it". It does not say "it has stopped". Safe failover needs a way to make sure the old primary stops.',
      ],
      keyIdea: 'A missed heartbeat cannot tell a dead node from an unreachable one. Promoting without stopping the old node risks two primaries.',
      metrics: { rto: '15 s', rpo: 'conflicting writes', spare: 'two primaries', cost: 'manual cleanup' },
      scene: {
        nodes: [
          clients,
          vip,
          { ...primary, status: 'hot', badge: 'still taking writes' },
          { ...standby, label: 'new primary', status: 'hot', badge: 'also taking writes' },
          { ...monitor, status: 'active', badge: 'cannot reach A' },
        ],
        links: [
          { from: 'clients', to: 'vip' },
          { from: 'vip', to: 'primary' },
          { from: 'vip', to: 'standby' },
          { from: 'monitor', to: 'primary', style: 'faint', label: 'link down' },
          { from: 'monitor', to: 'standby', style: 'dashed' },
        ],
        flows: [
          { path: ['monitor', 'primary'], tone: 'error', label: 'heartbeat lost', duration: 1 },
          { path: ['monitor', 'standby'], tone: 'event', label: 'promote', duration: 1, delay: 1.1 },
          { path: ['clients', 'vip', 'primary'], tone: 'request', label: 'refund', duration: 1.5, delay: 2.2 },
          { path: ['clients', 'vip', 'standby'], tone: 'request', label: 'new order', duration: 1.5, delay: 2.4 },
        ],
        caption: 'Two primaries, two histories',
      },
    },
    {
      title: 'Fencing',
      tag: 'concept',
      heading: 'Quorum and fencing: only one primary, ever',
      eli5: 'Now the principal, a teacher and the caretaker vote before any swap, and the old teacher\'s key is taken away first. A teacher with no key cannot teach. That key-taking is **fencing**.',
      body: [
        '**Quorum**: failover decisions need a majority of an odd number of voters, here node B, the monitor and a **witness** in a third location. A node cut off on the minority side cannot win a vote, so it cannot promote itself, and a primary that loses contact with the majority demotes itself.',
        '**Fencing** makes sure the old primary cannot act. Options include cutting its power through a management interface (often called STONITH, "shoot the other node in the head"), revoking its storage or network access, or letting its lease expire before the new primary starts.',
        'A **fencing token** covers the last gap. Each promotion gets a higher epoch number, and storage or downstream services reject writes that carry an older one. Even if the old primary wakes up and tries to write, its epoch 7 loses to epoch 8.',
      ],
      keyIdea: 'Decide by majority vote, stop the old primary before the new one starts, and reject writes from older epochs.',
      metrics: { rto: '20 s', rpo: '0', spare: 'hot + witness', cost: '2x + small witness' },
      scene: {
        nodes: [
          clients,
          vip,
          { ...primary, status: 'down', badge: 'fenced: epoch 7' },
          { ...standby, label: 'new primary', status: 'ok', badge: 'epoch 8' },
          { ...monitor, status: 'active', badge: '2 of 3 votes' },
          { ...witness, status: 'active' },
        ],
        links: [
          { from: 'clients', to: 'vip' },
          { from: 'vip', to: 'standby' },
          { from: 'monitor', to: 'primary', style: 'dashed', label: 'power off' },
          { from: 'monitor', to: 'standby', style: 'dashed' },
          { from: 'witness', to: 'monitor', style: 'dashed' },
          { from: 'witness', to: 'standby', style: 'dashed' },
        ],
        flows: [
          { path: ['witness', 'monitor'], tone: 'handshake', label: 'vote: A is out', duration: 1 },
          { path: ['monitor', 'primary'], tone: 'error', label: 'fence', duration: 1, delay: 1.1 },
          { path: ['monitor', 'standby'], tone: 'event', label: 'promote, epoch 8', duration: 1, delay: 2.2 },
          { path: ['clients', 'vip', 'standby'], tone: 'request', count: 2, duration: 1.5, delay: 3.3 },
        ],
        caption: 'Majority decides, the loser is fenced first',
      },
      code: {
        language: 'python',
        title: 'Storage that rejects stale leaders',
        source: `class Storage:
    def __init__(self):
        self.highest_epoch = 0

    def write(self, epoch, key, value):
        # A new primary always carries a higher epoch than the last one.
        if epoch < self.highest_epoch:
            raise PermissionError(f"stale leader: epoch {epoch}")
        self.highest_epoch = epoch
        self.data[key] = value

store.write(8, "order:991", "paid")      # new primary: accepted
store.write(7, "order:991", "refunded")  # old primary wakes up: rejected`,
        highlight: [7, 8, 9, 13],
      },
    },
    {
      title: 'Active-active',
      tag: 'tradeoff',
      heading: 'Active-active: both nodes serve',
      eli5: 'Two teachers each run half the class. If one leaves, the other takes everyone. That only works if each teacher could handle the whole class alone. Both teaching is **active-active**.',
      body: [
        'In **active-passive** the standby idles. In **active-active** every node serves traffic all the time. Stateless app servers behind a load balancer are the easy case: when one dies, the balancer stops sending it requests. Nothing needs promoting.',
        'The catch is headroom. Two nodes sharing 5,000 req/s each run at 2,500. If one fails, the survivor takes all 5,000. Keep each node under **50%** of its capacity, or under 67% with three nodes, or failover turns into overload and a second outage.',
        'For databases, active-active means every node accepts writes, which brings back write conflicts. It is common for stateless tiers and caches, and much harder for the primary copy of data. The multi-region lesson covers how to split or merge writes.',
      ],
      keyIdea: 'Active-active wastes no idle machine, but each node must keep enough spare capacity to absorb a failed peer\'s share.',
      metrics: { rto: '~3 s (drop from pool)', rpo: '0 (stateless)', spare: 'none idle', cost: '2x, 50% utilized' },
      scene: {
        nodes: [
          clients,
          { ...vip, label: 'load balancer', sub: 'health checks' },
          { ...primary, kind: 'server', label: 'node A', sub: 'stateless app', status: 'active', badge: '2,500 req/s · 45%' },
          { ...standby, kind: 'server', label: 'node B', sub: 'stateless app', status: 'active', badge: '2,500 req/s · 45%' },
        ],
        links: [
          { from: 'clients', to: 'vip' },
          { from: 'vip', to: 'primary' },
          { from: 'vip', to: 'standby' },
        ],
        flows: [
          { path: ['clients', 'vip'], tone: 'request', count: 4, duration: 1 },
          { path: ['vip', 'primary'], tone: 'request', count: 2, duration: 1, delay: 1.1 },
          { path: ['vip', 'standby'], tone: 'request', count: 2, duration: 1, delay: 1.1 },
        ],
        caption: 'Each node keeps room for the other\'s load',
      },
    },
    {
      title: 'Failback',
      tag: 'concept',
      heading: 'Bringing the old primary back',
      eli5: 'When the first teacher recovers, she does not storm back in mid-lesson. She sits in the next room as the new substitute and catches up on notes. Returning later, on purpose, is **failback**.',
      body: [
        'Node A is repaired. It cannot just rejoin as primary: its data stopped at the moment of failure, and it may hold a few writes that never reached B. Those must be discarded or reviewed, then A rewinds to B\'s history (`pg_rewind` in Postgres) or is rebuilt from a fresh copy.',
        'A rejoins as the **standby**. Many teams leave it there: the roles have swapped and nothing is wrong with that. If the old layout matters, for example A is in the preferred zone, switch back in a planned window, with a controlled switchover that loses nothing.',
        'Avoid automatic failback. A node that crashes, recovers, takes over and crashes again makes the system **flap** between primaries, with an outage at every swap.',
      ],
      keyIdea: 'The recovered node rejoins as a standby. Switch back later, on purpose, never automatically.',
      metrics: { rto: '0 (planned)', rpo: '0', spare: 'node A, resynced', cost: '2x' },
      scene: {
        nodes: [
          clients,
          vip,
          { ...primary, label: 'standby', sub: 'node A', status: 'active', badge: 'rewound, catching up' },
          { ...standby, label: 'primary', sub: 'node B', status: 'ok' },
          monitor,
        ],
        links: [
          { from: 'clients', to: 'vip' },
          { from: 'vip', to: 'standby' },
          { from: 'vip', to: 'primary', style: 'faint' },
          { from: 'standby', to: 'primary', style: 'dashed', label: 'replication' },
          ...watchLinks,
        ],
        flows: [
          { path: ['clients', 'vip', 'standby'], tone: 'request', count: 2, duration: 1.6 },
          { path: ['standby', 'primary'], tone: 'data', label: 'WAL stream', count: 3, duration: 1.4, delay: 1.7 },
        ],
        caption: 'Roles swapped. A follows B now.',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'A spare, a detector, a switch and a fence',
      eli5: 'A good school keeps a substitute ready, checks on the teacher often, moves the door sign fast, takes the old key away, and practices the swap before it is needed.',
      body: [
        'Redundancy removes single points of failure if failures are independent. A **cold, warm or hot standby** trades cost for recovery speed. **Heartbeats** with a timeout detect failure. **Promotion** plus a **virtual IP** or **DNS switch** moves traffic. **RTO** and **RPO** set the targets.',
        'A missed heartbeat cannot tell dead from unreachable, so use a **quorum** with a witness and **fence** the old primary, with epochs as the last line of defense against split brain. **Active-active** skips the idle spare but needs headroom for a failed peer. After repair, fail back on purpose.',
        'Failover code runs rarely, so it rots. Test it on a schedule, in production if you can, and time it against your RTO.',
      ],
      keyIdea: 'Failover is only as good as its last test. Detect, fence, promote, redirect, and practice all four.',
      metrics: { rto: '15 to 20 s', rpo: '0', spare: 'hot + witness', cost: '2x' },
      scene: {
        nodes: [clients, vip, { ...primary, status: 'ok' }, { ...standby, status: 'ok' }, { ...monitor, status: 'ok' }, witness],
        links: [...pairLinks, ...watchLinks, { from: 'witness', to: 'monitor', style: 'faint' }],
        flows: [
          { path: ['clients', 'vip', 'primary'], tone: 'request', duration: 1.6 },
          { path: ['primary', 'standby'], tone: 'data', duration: 1.2, delay: 1.7 },
          { path: ['monitor', 'primary'], tone: 'handshake', duration: 1, delay: 0.5 },
        ],
      },
      quiz: {
        question: 'A network split cuts the primary off from the monitor, but app servers can still reach it. What prevents two primaries after the standby is promoted?',
        options: [
          'A shorter heartbeat timeout',
          'Asynchronous replication',
          'A majority vote plus fencing of the old primary, with writes from older epochs rejected',
          'A longer DNS TTL',
        ],
        answer: 2,
        explain: 'A shorter timeout makes false failovers more likely. Only a quorum decision plus fencing (power off, lease expiry, or epoch checks) guarantees the old primary stops accepting writes.',
      },
    },
  ],
};
