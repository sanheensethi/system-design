import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place a node by screen column (x - y) and screen row (x + y). */
const p = (col: number, row: number): [number, number] => [(col + row) / 2, (row - col) / 2];

const clients: SceneNode = { id: 'clients', kind: 'client', at: p(-10, 0), label: 'clients', sub: '5,000 req/s' };
const vip: SceneNode = { id: 'vip', kind: 'block', at: p(-5.5, 0), label: 'virtual IP', sub: '10.0.0.50', icon: 'Network', tint: 'teal' };
const primary: SceneNode = { id: 'primary', kind: 'db', at: p(-1, -5), label: 'primary', sub: 'node A' };
const standby: SceneNode = { id: 'standby', kind: 'db', at: p(-1, 5), label: 'standby', sub: 'node B' };
const monitor: SceneNode = { id: 'monitor', kind: 'block', at: p(5, 0), label: 'monitor', sub: 'heartbeats', icon: 'Activity', tint: 'amber' };
const witness: SceneNode = { id: 'witness', kind: 'block', at: p(9.5, 0), label: 'witness', sub: 'third location', icon: 'Shield', tint: 'violet' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });
const watch = [link('monitor', 'primary', { style: 'dashed' }), link('monitor', 'standby', { style: 'dashed' })];

export const failover: Lesson = {
  id: 'failover',
  title: 'Failover: active-passive, active-active',
  tagline: 'Keep a spare ready, detect the failure, switch traffic over, and make sure the old node really stops.',
  minutes: 18,
  level: 'Intermediate',
  learn: [
    'Why redundancy only helps if failures are independent and failover works',
    'The nines, and what each level of availability asks of you',
    'Hot, warm and cold standby, and what each costs',
    'Health checks, heartbeats, timeouts and slow-but-alive nodes',
    'Automatic or manual failover, promotion, and moving traffic with a virtual IP or DNS',
    'What clients do during the switch: reconnects, retries and idempotency',
    'RTO and RPO, and sync versus async replication',
    'Split brain, quorum, fencing and epoch tokens',
    'Active-active capacity, failback and testing failover on a schedule',
  ],
  metrics: [
    { key: 'rto', label: 'Downtime (RTO)', icon: 'Timer' },
    { key: 'rpo', label: 'Data lost (RPO)', icon: 'DatabaseZap' },
    { key: 'spare', label: 'Standby', icon: 'Copy' },
    { key: 'cost', label: 'Cost', icon: 'Receipt' },
  ],
  steps: [
    {
      title: 'One box',
      tag: 'problem',
      heading: 'The only server dies at 3 AM',
      eli5: 'A class has one teacher and no substitute. When the teacher is sick, the class just sits there until someone finds a replacement. The teacher is a **single point of failure**.',
      body: [
        'The order database runs on one machine. At 3 AM its power supply fails and every request errors. The on-call engineer wakes up, finds a new machine, restores last night\'s backup and replays what logs survived.',
        'That takes about **2 hours**, and every order since the 1 AM backup that the logs do not cover is gone. Nothing was wrong with the software. One part broke, and nothing could take its place.',
      ],
      keyIdea: 'If one part can take the whole system down, it is a single point of failure, and recovery is as slow as a human.',
      metrics: { rto: '2 hours', rpo: 'up to 2 hours', spare: 'none', cost: '1x' },
      metricTones: { rto: 'bad', rpo: 'bad', spare: 'bad', cost: 'good' },
      scene: {
        nodes: [
          { ...clients, chips: [{ text: 'INSERT order', tone: 'warn' }] },
          vip,
          { ...primary, label: 'database', sub: 'only copy', status: 'down', badge: 'power failure' },
        ],
        links: [link('clients', 'vip'), link('vip', 'primary')],
        flows: [
          { path: ['clients', 'vip'], tone: 'request', count: 4, duration: 1 },
          { path: ['vip', 'primary'], tone: 'error', label: 'connection refused', count: 3, duration: 1.2, delay: 1 },
        ],
        panel: {
          title: 'The night of the outage',
          icon: 'Clock',
          rows: [
            { text: 'Last backup', value: '01:00' },
            { text: 'Power supply fails', value: '03:00', tone: 'bad' },
            { text: 'Engineer paged and logged in', value: '03:15', tone: 'warn' },
            { text: 'New machine, restore, replay logs', value: '05:00', tone: 'warn' },
            { text: 'Orders since the backup', value: 'gone', tone: 'bad' },
          ],
        },
        caption: 'One machine, no spare',
      },
    },
    {
      title: 'Single point',
      tag: 'concept',
      heading: 'What failover means',
      eli5: 'The school wants a second adult ready to take over the moment the first one cannot teach. Keeping that person ready and sending the class to them is **failover**.',
      body: [
        'A component whose failure takes the whole system down is a **single point of failure**. Every layer has some: the database, the load balancer, the power feed, even the monitoring.',
        '**Failover** is keeping a second component ready and switching to it when the first fails, ideally without a human. Four jobs make it work: a spare, a way to detect failure, a switch that moves traffic, and a guarantee that the old one stops.',
      ],
      keyIdea: 'Failover is four jobs: keep a spare, detect failure, move the traffic, and stop the old node.',
      metrics: { rto: '-', rpo: '-', spare: 'plan: 1 spare', cost: '-' },
      scene: {
        nodes: [
          { ...vip, status: 'active' },
          { ...primary, status: 'active' },
          { ...standby, badge: 'the spare' },
          monitor,
        ],
        links: [link('vip', 'primary'), link('vip', 'standby', { style: 'faint' }), ...watch],
        flows: [{ path: ['monitor', 'primary'], tone: 'handshake', label: 'alive?', duration: 1.2 }],
        panel: {
          title: 'The four jobs',
          icon: 'List',
          rows: [
            { text: '1. A spare that is ready', value: 'standby' },
            { text: '2. Notice the failure', value: 'monitor' },
            { text: '3. Move the traffic', value: 'virtual IP' },
            { text: '4. Stop the old node', value: 'fencing' },
          ],
        },
        caption: 'Spare, detector, switch and fence',
      },
    },
    {
      title: 'The nines',
      tag: 'concept',
      heading: 'What each level of availability asks for',
      eli5: 'A school that can close for 4 days a year needs one substitute. A school that may close for 5 minutes a year needs a whole second building and practice drills.',
      body: [
        'Availability targets turn into allowed downtime a year. **99%** is 3.6 days, **99.9%** is 8.8 hours, **99.99%** is 52 minutes, **99.999%** is about 5 minutes.',
        'Each extra nine changes the design. 99% fits a single region with basic high availability. 99.9% needs multiple zones and automatic failover. 99.99% needs multiple regions and failover you have tested. 99.999% needs active-active with no single control plane.',
      ],
      keyIdea: 'Every extra nine cuts the allowed downtime by 10x and demands faster, more automatic, better tested failover.',
      metrics: { rto: '8.8 h to 5 min a year', rpo: '-', spare: 'more per nine', cost: 'rises per nine' },
      metricTones: { cost: 'warn' },
      scene: {
        nodes: [{ ...primary, status: 'ok' }, { ...standby, status: 'ok' }, { ...vip, status: 'active' }],
        links: [link('vip', 'primary'), link('vip', 'standby', { style: 'faint' }), link('primary', 'standby', { style: 'dashed' })],
        flows: [{ path: ['primary', 'standby'], tone: 'data', count: 2, duration: 1.4 }],
        panel: {
          title: 'Downtime allowed per year',
          icon: 'Gauge',
          rows: [
            { text: '99%  single region, basic HA', value: '3.6 days', tone: 'bad' },
            { text: '99.9%  multi-zone, auto failover', value: '8.8 h', tone: 'warn' },
            { text: '99.99%  multi-region, tested failover', value: '52 min' },
            { text: '99.999%  active-active, no single control plane', value: '5 min', tone: 'good' },
          ],
        },
        caption: 'Each nine needs a better failover',
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
      ],
      keyIdea: 'A standby fed by a stream of changes turns one machine failure into a short switch instead of a rebuild.',
      metrics: { rto: '-', rpo: 'seconds', spare: '1 node', cost: '2x' },
      metricTones: { rpo: 'good', cost: 'warn' },
      scene: {
        nodes: [clients, vip, { ...primary, status: 'active', badge: 'serves traffic' }, { ...standby, badge: 'follows the log' }],
        links: [link('clients', 'vip'), link('vip', 'primary'), link('vip', 'standby', { style: 'faint' }), link('primary', 'standby', { style: 'dashed', label: 'replication' })],
        flows: [
          { path: ['clients', 'vip', 'primary'], tone: 'request', count: 3, duration: 1.6 },
          { path: ['primary', 'standby'], tone: 'data', label: 'WAL stream', count: 2, duration: 1.4, delay: 1.7 },
        ],
        panel: {
          title: 'Two nodes, each 99.9% up',
          icon: 'Copy',
          rows: [
            { text: 'One node down', value: '0.1%', tone: 'warn' },
            { text: 'Both down at once', value: '0.1% x 0.1%' },
            { text: 'The pair is up', value: '99.9999%', tone: 'good' },
          ],
          footer: { text: 'Only if failures are independent', tone: 'muted' },
        },
        caption: 'Active-passive: one serves, one waits',
      },
    },
    {
      title: 'Independence',
      tag: 'case',
      heading: 'Case: both nodes died together',
      eli5: 'Two substitutes who both ride the same bus are no help when the bus breaks down. Spares must come from different places.',
      body: [
        'The 99.9999% figure hides two assumptions. The failures must be **independent**: two nodes on the same power circuit, the same rack switch or the same bad config push fail together, and the pair is only as reliable as one.',
        'Spread the pair across racks, then zones. And the switch must work every time. Most real outages of redundant systems come from the failover itself, not from the first failure.',
      ],
      keyIdea: 'Redundancy only helps when the copies fail independently. Put them on different power, racks and zones.',
      metrics: { rto: 'outage', rpo: '-', spare: 'shared fate', cost: '2x for 1x' },
      metricTones: { rto: 'bad', spare: 'bad', cost: 'bad' },
      scene: {
        nodes: [
          { ...primary, status: 'down', badge: 'same rack' },
          { ...standby, status: 'down', badge: 'same rack' },
          { id: 'power', kind: 'block', at: p(5, 0), label: 'rack power', sub: 'one feed', icon: 'Zap', tint: 'red', status: 'down' },
        ],
        links: [link('power', 'primary'), link('power', 'standby')],
        flows: [
          { path: ['power', 'primary'], tone: 'error', label: 'power lost', duration: 1.3 },
          { path: ['power', 'standby'], tone: 'error', label: 'power lost', duration: 1.3, delay: 0.1 },
        ],
        panel: {
          title: 'Shared fate to avoid',
          icon: 'Bug',
          rows: [
            { text: 'Same power circuit', value: 'both down', tone: 'bad' },
            { text: 'Same rack switch', value: 'both down', tone: 'bad' },
            { text: 'Same bad config push', value: 'both down', tone: 'bad' },
            { text: 'Different zones', value: 'independent', tone: 'good' },
          ],
        },
        caption: 'Two copies, one cause of failure',
      },
    },
    {
      title: 'Standby types',
      tag: 'tradeoff',
      heading: 'Cold, warm and hot standby',
      eli5: 'A cold spare is a teacher you must phone and drive in. A warm one is in the building. A hot one sits in the classroom, ready to talk the second the teacher stops. Closer costs more.',
      body: [
        '**Cold**: backups plus spare hardware or a template. Nothing runs until disaster. Recovery takes hours and loses everything since the last backup. Cheap.',
        '**Warm**: a running replica on a smaller machine, not serving traffic. Promote and maybe resize. Minutes to recover, and you lose the replication lag.',
        '**Hot**: a full-size node kept in sync, ready for writes at once. Seconds to recover, possibly no loss, and you pay for a second full machine.',
      ],
      keyIdea: 'The closer a standby is to ready, the faster the recovery and the higher the bill.',
      metrics: { rto: 'hours / minutes / seconds', rpo: 'backup / lag / 0', spare: 'cold, warm or hot', cost: '1.1x / 1.5x / 2x' },
      scene: {
        nodes: [
          { ...primary, status: 'active' },
          { ...standby, status: 'ok', label: 'hot standby', badge: 'in sync, full size' },
          { id: 'backup', kind: 'storage', at: p(-6, 5), label: 'backups', sub: 'cold copy', tint: 'gray' },
        ],
        links: [link('primary', 'standby', { style: 'dashed', label: 'sync' }), link('primary', 'backup', { style: 'faint', label: 'nightly' })],
        flows: [
          { path: ['primary', 'standby'], tone: 'data', label: 'sync', duration: 0.9 },
          { path: ['standby', 'primary'], tone: 'handshake', label: 'ack', duration: 0.9, delay: 1 },
        ],
        panel: {
          title: 'Standby ladder',
          icon: 'Table',
          rows: [
            { text: 'Cold: backups, nothing running', value: 'hours, 1.1x', tone: 'bad' },
            { text: 'Warm: small replica running', value: 'minutes, 1.5x', tone: 'warn' },
            { text: 'Hot: full size, in sync', value: 'seconds, 2x', tone: 'good' },
          ],
        },
        caption: 'A hot standby confirms each write',
      },
    },
    {
      title: 'Health checks',
      tag: 'concept',
      heading: 'What "healthy" means',
      eli5: 'There is a difference between "the teacher is in the building" and "the teacher can actually teach today". A teacher who answers the knock but speaks too slowly still fails the second question.',
      body: [
        'A ping proves the machine is on, and a TCP connect proves the port is open. A **deep check** runs a tiny query such as `SELECT 1`. Separate **liveness** (restart it?) from **readiness** (send it traffic?).',
        'Real failures are often **gray**: the node answers `SELECT 1` in 3 ms, but real queries take 8 s because a disk is dying. Check latency and error rate on real traffic, and let several observers vote.',
      ],
      keyIdea: 'Check what you depend on: a query beats a ping, and real-traffic latency beats both. Slow is the hardest failure to see.',
      metrics: { rto: '-', rpo: '-', spare: 'hot', cost: '2x' },
      scene: {
        nodes: [{ ...monitor, status: 'active' }, { ...primary, status: 'hot', load: 95, chips: [{ text: 'SELECT 1: 3 ms', tone: 'good' }, { text: 'orders: 8,000 ms', tone: 'bad' }] }, { ...standby, status: 'idle', badge: 'alive, not ready' }],
        links: watch,
        flows: [
          { path: ['monitor', 'primary'], tone: 'handshake', label: 'SELECT 1', duration: 1.2 },
          { path: ['primary', 'monitor'], tone: 'response', label: 'ok', duration: 1.2, delay: 1.3 },
          { path: ['monitor', 'standby'], tone: 'handshake', label: 'lag?', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'Three depths of check',
          icon: 'Activity',
          rows: [
            { text: 'ping', value: 'machine is on' },
            { text: 'TCP connect', value: 'port is open', tone: 'warn' },
            { text: 'SELECT 1', value: 'database answers', tone: 'good' },
            { text: 'Real order query p99', value: '8 s, gray failure', tone: 'bad' },
            { text: 'Standby readiness', value: 'caught up?', tone: 'good' },
          ],
        },
        caption: 'Ask the question that matters, on real traffic',
      },
    },
    {
      title: 'Heartbeats',
      tag: 'concept',
      heading: 'Knowing the primary is gone',
      eli5: 'The principal knocks on the classroom door every few seconds. If three knocks in a row get no answer, the teacher is counted as gone. Those knocks are **heartbeats**.',
      body: [
        'A **monitor** sends the primary a check every 3 seconds. A reply is a **heartbeat**.',
        'One missed heartbeat proves little. A garbage collection pause or a dropped packet can cause it. So the monitor waits for several misses in a row, for example **3 misses at 3 seconds**, about 9 s, before it declares the primary dead.',
      ],
      keyIdea: 'A node is declared dead after several missed heartbeats in a row, never after one.',
      metrics: { rto: '9 s to detect', rpo: '-', spare: 'hot', cost: '2x' },
      metricTones: { rto: 'good' },
      scene: {
        nodes: [{ ...monitor, status: 'active', badge: '3 s interval' }, { ...primary, status: 'down', badge: 'no reply x3' }, standby],
        links: watch,
        flows: [
          { path: ['monitor', 'primary'], tone: 'handshake', label: 'SELECT 1', count: 3, duration: 1 },
          { path: ['primary', 'monitor'], tone: 'error', label: 'timeout', duration: 1, delay: 1.2 },
          { path: ['monitor', 'standby'], tone: 'handshake', label: 'still alive?', duration: 1, delay: 2.4 },
          { path: ['standby', 'monitor'], tone: 'response', label: 'ok', duration: 1, delay: 3.5 },
        ],
        panel: {
          title: 'Miss counter',
          icon: 'Timer',
          rows: [
            { text: 'Miss 1: could be a hiccup', value: '3 s' },
            { text: 'Miss 2: suspicious', value: '6 s', tone: 'warn' },
            { text: 'Miss 3: declare dead', value: '9 s', tone: 'bad' },
          ],
        },
        caption: 'Three misses in a row: declare it dead',
      },
      code: {
        language: 'python',
        title: 'A heartbeat loop with a miss counter',
        source: `INTERVAL = 3.0      # seconds between checks
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
      title: 'Timeout trade',
      tag: 'tradeoff',
      heading: 'How long to wait before declaring death',
      eli5: 'If the principal gives up after one missed knock, the substitute barges in whenever the teacher sneezes. If the principal waits an hour, the class sits idle. The wait time needs a balance.',
      body: [
        'Short timeouts detect real failures fast and also fail over on hiccups, and a needless failover is its own outage. Long timeouts are calm and slow.',
        'Most setups land between **5 and 30 seconds**. Detection time is the first slice of your RTO, so it sets the floor for everything after it.',
      ],
      keyIdea: 'The timeout trades detection speed against false alarms, and it is the first part of your downtime.',
      metrics: { rto: '1 s to 30 s to detect', rpo: '-', spare: 'hot', cost: '2x' },
      metricTones: { rto: 'warn' },
      scene: {
        nodes: [{ ...monitor, status: 'active' }, { ...primary, status: 'active', badge: 'GC pause 2 s' }, { ...standby, label: 'standby', badge: 'ready to promote' }],
        links: watch,
        flows: [
          { path: ['monitor', 'primary'], tone: 'handshake', label: 'SELECT 1', duration: 1.2 },
          { path: ['primary', 'monitor'], tone: 'response', label: 'late reply', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Choosing the timeout',
          icon: 'Scale',
          rows: [
            { text: '1 s: fast', value: 'false alarms', tone: 'bad' },
            { text: '5 to 30 s: typical', value: 'balanced', tone: 'good' },
            { text: 'Our example: 3 misses x 3 s', value: '9 s', tone: 'good' },
            { text: '2 min: calm', value: 'long outage', tone: 'warn' },
          ],
          footer: { text: 'A pointless failover is an outage you caused', tone: 'warn' },
        },
        caption: 'Fast detection or fewer false alarms',
      },
      quiz: {
        question: 'A team cuts the heartbeat timeout from 15 s to 1 s to reduce downtime. A 3-second garbage collection pause now happens. What is the most likely result?',
        options: [
          'Nothing, the primary recovers on its own',
          'A needless failover, which is a second outage',
          'The standby becomes faster',
          'Replication lag drops to zero',
        ],
        answer: 1,
        explain: 'A short timeout declares a slow but healthy primary dead. The failover itself interrupts service, so tighter detection can add outages. Tune the timeout to the pauses your nodes really have.',
      },
    },
    {
      title: 'Auto or manual',
      tag: 'tradeoff',
      heading: 'Who pulls the trigger',
      eli5: 'Should the principal swap the teacher automatically, or phone the head teacher first? Automatic is faster. A person is slower but notices when the alarm is wrong.',
      body: [
        '**Automatic** failover meets a tight RTO and works at 3 AM, but acts on bad information when the monitor itself is confused. **Manual** failover waits for a human, adds minutes, and keeps a person in the loop for risky cases.',
        'Many teams automate the safe cases (a clear crash, a quorum agrees) and page a human for the unclear ones. Whichever you pick, the decision needs a single decider, so two monitors never promote two nodes.',
      ],
      keyIdea: 'Automate failover for clear failures with a quorum, and send ambiguous ones to a person. Only one decider may act.',
      metrics: { rto: 'seconds / minutes', rpo: '-', spare: 'hot', cost: '2x' },
      scene: {
        nodes: [{ ...monitor, status: 'active', badge: 'one decider' }, { ...primary, status: 'down' }, { ...standby, badge: 'waiting for the order' }],
        links: watch,
        flows: [
          { path: ['monitor', 'primary'], tone: 'error', label: 'no reply x3', duration: 1.2 },
          { path: ['monitor', 'standby'], tone: 'event', label: 'promote?', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Automatic versus manual',
          icon: 'Scale',
          rows: [
            { text: 'Automatic: RTO', value: 'seconds', tone: 'good' },
            { text: 'Automatic: risk', value: 'acts on bad data', tone: 'warn' },
            { text: 'Manual: RTO', value: 'minutes', tone: 'warn' },
            { text: 'Manual: risk', value: 'human judgment', tone: 'good' },
            { text: 'The monitor itself', value: '3 replicas on etcd', tone: 'good' },
          ],
        },
        caption: 'One decider, clear cases automatic',
      },
    },
    {
      title: 'Virtual IP',
      tag: 'concept',
      heading: 'Promote, then move the virtual IP',
      eli5: 'The substitute steps up and starts teaching. Families always walk to the same classroom door, and the sign on it now points to the new teacher. Moving the sign is the **virtual IP** switch.',
      body: [
        '**Promotion** turns the standby into the primary: it finishes applying its log and starts accepting writes. Clients always connect to `10.0.0.50`, so the new primary claims it and announces it (a gratuitous ARP). Traffic moves in a second or two.',
        'This works inside one network segment only. A tool such as keepalived or Patroni runs these steps, only after the old node is fenced. The new primary starts with cold caches.',
      ],
      keyIdea: 'Failover is promote, then redirect. A virtual IP lets clients keep one address while the machine behind it changes.',
      metrics: { rto: '~21 s', rpo: 'lag (async) or 0 (sync)', spare: 'promoted', cost: '2x' },
      metricTones: { rto: 'good', rpo: 'good' },
      scene: {
        nodes: [
          clients,
          { ...vip, status: 'active', badge: 'now points to B' },
          { ...primary, label: 'old primary', status: 'down' },
          { ...standby, label: 'new primary', status: 'ok', badge: 'promoted' },
        ],
        links: [link('clients', 'vip'), link('vip', 'primary', { style: 'faint' }), link('vip', 'standby')],
        flows: [
          { path: ['standby', 'vip'], tone: 'event', label: 'claim 10.0.0.50', duration: 1.1 },
          { path: ['clients', 'vip', 'standby'], tone: 'request', count: 3, duration: 1.6, delay: 1.2 },
        ],
        panel: {
          title: 'Same address, new machine',
          icon: 'Network',
          rows: [
            { text: 'Clients connect to', value: '10.0.0.50' },
            { text: 'After: behind it', value: 'node B', tone: 'good' },
            { text: 'Switch time', value: '1 to 2 s', tone: 'good' },
            { text: 'The VIP holder itself', value: 'VRRP pair', tone: 'good' },
            { text: 'Memory caches', value: 'cold at first', tone: 'warn' },
          ],
        },
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
      title: 'DNS switch',
      tag: 'tradeoff',
      heading: 'Across networks: DNS or a proxy',
      eli5: 'If the new teacher is in another building, the sign on the door cannot help. Instead the school changes the room number printed on the map, and families who kept an old map walk to the wrong place for a while.',
      body: [
        'Across networks, update the DNS record to the new node\'s address. Resolvers and clients cache the old answer until its **TTL** runs out, so keep the TTL short (30 to 60 seconds), and expect some clients to hold on longer.',
        'A proxy or load balancer in front can redirect traffic instantly, as long as it is not a single point of failure itself.',
      ],
      keyIdea: 'DNS failover is bounded by the TTL and by clients that ignore it. A proxy is faster but must be redundant too.',
      metrics: { rto: '30 to 90 s (DNS TTL)', rpo: 'lag (async) or 0 (sync)', spare: 'promoted', cost: '2x' },
      metricTones: { rto: 'warn' },
      scene: {
        nodes: [
          { id: 'dns', kind: 'block', at: p(-5.5, 0), label: 'DNS', sub: 'db.example.com', icon: 'Globe', tint: 'blue', status: 'active' },
          { ...primary, label: 'old primary', status: 'down' },
          { ...standby, label: 'new primary', status: 'ok' },
          { ...clients, chips: [{ text: 'cached: node A', tone: 'warn' }] },
        ],
        links: [link('clients', 'dns', { label: 'resolve' }), link('dns', 'primary', { style: 'faint' }), link('dns', 'standby')],
        flows: [
          { path: ['clients', 'dns'], tone: 'request', label: 'db.example.com?', duration: 1.2 },
          { path: ['dns', 'clients'], tone: 'response', label: 'node B (TTL 30 s)', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'The DNS record',
          icon: 'Globe',
          rows: [
            { text: 'db.example.com', value: 'A: node B' },
            { text: 'TTL', value: '30 to 60 s', tone: 'warn' },
            { text: 'Clients with old answer', value: 'still on A', tone: 'bad' },
          ],
          footer: { text: 'Some clients ignore the TTL', tone: 'warn' },
        },
        caption: 'DNS moves traffic as fast as caches expire',
      },
    },
    {
      title: 'Client retry',
      tag: 'concept',
      heading: 'What clients do during the switch',
      eli5: 'Families waiting at the door should knock again after a pause, not shout all at once. Each family waits a slightly different time, so the door is not crowded.',
      body: [
        'For about 20 seconds, connections fail. Clients need a connection pool that drops dead connections, retries with **exponential backoff and jitter**, and a timeout, so 5,000 req/s of clients do not hammer the new primary in the same instant.',
      ],
      keyIdea: 'Clients must retry with exponential backoff and jitter, so the new primary is not hit by every client at once.',
      metrics: { rto: '~21 s of errors', rpo: 'lag (async) or 0 (sync)', spare: 'promoted', cost: '2x' },
      scene: {
        nodes: [
          { ...clients, chips: [{ text: 'POST /orders', tone: 'warn' }, { text: 'retry in 0.8 s', tone: 'warn' }] },
          { ...vip, status: 'active' },
          { ...standby, label: 'new primary', status: 'ok' },
        ],
        links: [link('clients', 'vip'), link('vip', 'standby')],
        flows: [
          { path: ['clients', 'vip'], tone: 'error', label: 'refused', duration: 1.1 },
          { path: ['clients', 'vip', 'standby'], tone: 'request', label: 'retry', duration: 1.6, delay: 1.5 },
        ],
        panel: {
          title: 'Retry schedule (jittered)',
          icon: 'Repeat',
          rows: [
            { text: 'Try 1 fails', value: 'now' },
            { text: 'Try 2', value: '+0.5 to 1 s', tone: 'warn' },
            { text: 'Try 3', value: '+1 to 2 s', tone: 'warn' },
            { text: 'Try 4', value: '+2 to 4 s', tone: 'good' },
          ],
          footer: { text: 'Random delays spread the herd', tone: 'good' },
        },
        caption: 'Back off and add jitter',
      },
    },
    {
      title: 'Idempotency',
      tag: 'concept',
      heading: 'A retry must not double-apply',
      eli5: 'If a family asks "add this to my lunch order" twice, the school must not charge them twice. Each request carries a ticket number, and the office ignores a number it has already seen.',
      body: [
        'The first write can succeed on the new primary while its acknowledgment is lost. The client sees a timeout and retries, so the same write arrives twice.',
        'Make writes **idempotent**: the client sends a unique request id, and the database rejects a second row with the same id. The retry then changes nothing and still gets an ok.',
      ],
      keyIdea: 'A request id with a unique key makes a retry safe: the second try is ignored.',
      metrics: { rto: '~21 s of errors', rpo: 'lag (async) or 0 (sync)', spare: 'promoted', cost: '2x' },
      scene: {
        nodes: [
          { ...clients, chips: [{ text: 'POST id=a91', tone: 'warn' }, { text: 'no ack, retry', tone: 'warn' }] },
          { ...vip, status: 'active' },
          { ...standby, label: 'new primary', status: 'ok', chips: [{ text: 'a91 applied', tone: 'good' }, { text: 'a91 again: ignored', tone: 'good' }] },
        ],
        links: [link('clients', 'vip'), link('vip', 'standby')],
        flows: [
          { path: ['clients', 'vip', 'standby'], tone: 'request', label: 'POST a91', duration: 1.4 },
          { path: ['standby', 'vip'], tone: 'error', label: 'ack lost', duration: 1.1, delay: 1.5 },
          { path: ['clients', 'vip', 'standby'], tone: 'request', label: 'retry a91', duration: 1.4, delay: 2.8 },
        ],
        panel: {
          title: 'Two tries, one order',
          icon: 'Repeat',
          rows: [
            { text: 'Try 1: written, ack lost', value: 'applied', tone: 'good' },
            { text: 'Try 2: same id a91', value: 'ignored, replies ok', tone: 'good' },
            { text: 'Without an id', value: 'order twice', tone: 'bad' },
          ],
          footer: { text: 'Same request id on every try', tone: 'good' },
        },
        caption: 'The retry is ignored, not repeated',
      },
      code: {
        language: 'sql',
        title: 'A unique request id makes the write safe to retry',
        source: `CREATE TABLE orders (
  request_id text PRIMARY KEY,
  total      numeric
);
INSERT INTO orders (request_id, total)
VALUES ('a91', 42.00)
ON CONFLICT (request_id) DO NOTHING;`,
        highlight: [2, 7],
      },
    },
    {
      title: 'RTO and RPO',
      tag: 'tradeoff',
      heading: 'Two numbers that define "recovered"',
      eli5: 'Two questions for the school: how long was the class without a teacher, and how much of the lesson was forgotten? The first is **RTO**, the second is **RPO**.',
      body: [
        '**RTO** (recovery time objective) is how long the service may be down: detection, promotion and redirect added up. 9 s + 5 s + about 7 s of reconnects is roughly 21 s for a hot standby with a virtual IP.',
        '**RPO** (recovery point objective) is how much recent data you may lose. **Async** replication loses the lag at failure. **Sync** waits for the standby on every commit, so RPO is zero, but a dead standby can stall writes unless the primary degrades to async.',
      ],
      keyIdea: 'RTO is how long you are down, RPO is how much data you lose. Pick them first, then build the failover to meet them.',
      metrics: { rto: '21 s', rpo: '0', spare: 'hot, sync', cost: '2x + commit latency' },
      metricTones: { rto: 'good', rpo: 'good', cost: 'warn' },
      scene: {
        nodes: [
          { ...vip, badge: 'RTO: 21 s' },
          { ...primary, label: 'old primary', status: 'down' },
          { ...standby, label: 'new primary', status: 'ok', badge: 'RPO: 0' },
          monitor,
        ],
        links: [link('vip', 'standby'), ...watch],
        flows: [
          { path: ['vip', 'standby'], tone: 'request', count: 3, duration: 1.6 },
          { path: ['standby', 'vip'], tone: 'response', count: 3, duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'Where the 21 s goes',
          icon: 'Timer',
          rows: [
            { text: 'Detect (3 misses x 3 s)', value: '9 s' },
            { text: 'Promote', value: '5 s' },
            { text: 'Redirect and reconnect', value: '~7 s' },
            { text: 'Data lost (sync)', value: '0', tone: 'good' },
            { text: 'Sync, standby dies', value: 'writes stall', tone: 'warn' },
          ],
          footer: { text: 'Async would lose the lag, say 4 s of writes', tone: 'warn' },
        },
        caption: 'Down for 21 seconds, nothing lost',
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
        'Now both nodes accept writes. A refund lands on A, a new order lands on B. When the network heals there are two histories with no clean merge. **Split brain** damages data quietly, which is worse than downtime.',
      ],
      keyIdea: 'A missed heartbeat cannot tell a dead node from an unreachable one. Promoting without stopping the old node risks two primaries.',
      metrics: { rto: '21 s', rpo: 'conflicting writes', spare: 'two primaries', cost: 'manual cleanup' },
      metricTones: { rpo: 'bad', spare: 'bad', cost: 'bad' },
      scene: {
        nodes: [
          clients,
          { ...primary, status: 'hot', badge: 'still taking writes', chips: [{ text: 'refund #771', tone: 'warn' }] },
          { ...standby, label: 'new primary', status: 'hot', badge: 'also taking writes', chips: [{ text: 'order #772', tone: 'warn' }] },
          { ...monitor, status: 'active', badge: 'cannot reach A' },
        ],
        links: [
          link('clients', 'primary'),
          link('clients', 'standby'),
          link('monitor', 'primary', { style: 'faint', label: 'link down', labelTone: 'warn' }),
          link('monitor', 'standby', { style: 'dashed' }),
        ],
        flows: [
          { path: ['monitor', 'primary'], tone: 'error', label: 'heartbeat lost', duration: 1 },
          { path: ['monitor', 'standby'], tone: 'event', label: 'promote', duration: 1, delay: 1.1 },
          { path: ['clients', 'primary'], tone: 'request', label: 'refund', duration: 1.5, delay: 2.2 },
          { path: ['clients', 'standby'], tone: 'request', label: 'new order', duration: 1.5, delay: 2.4 },
        ],
        caption: 'Two primaries, two histories',
      },
    },
    {
      title: 'Quorum',
      tag: 'concept',
      heading: 'Decide by majority vote',
      eli5: 'Now the principal, a teacher and the caretaker vote before any swap. A teacher shut alone in a cupboard cannot gather two votes, so she cannot declare herself in charge.',
      body: [
        '**Quorum**: failover needs a majority of an odd number of voters: node A, node B and a **witness** in a third location. The monitor only counts votes. B and the witness agree A is out, so 2 of 3 win.',
        'A cut-off node cannot win a vote. A primary that cannot renew its lease with the majority steps down on its own. The consensus lesson covers how that voting works.',
      ],
      keyIdea: 'Odd number of voters, majority wins. The cut-off minority cannot promote, and a primary cut off from the majority steps down.',
      metrics: { rto: '21 s', rpo: '0', spare: 'hot + witness', cost: '2x + small witness' },
      scene: {
        nodes: [
          { ...monitor, status: 'active', badge: 'counts votes' },
          { ...standby, label: 'node B', status: 'active', badge: 'votes: A is out' },
          { ...witness, status: 'active', badge: 'votes: A is out' },
          { ...primary, status: 'dim', badge: 'minority of 1' },
        ],
        links: [link('witness', 'monitor', { style: 'dashed' }), link('witness', 'standby', { style: 'dashed' }), link('monitor', 'primary', { style: 'faint' })],
        flows: [
          { path: ['witness', 'monitor'], tone: 'handshake', label: 'vote: A is out', duration: 1.1 },
          { path: ['standby', 'monitor'], tone: 'handshake', label: 'vote: A is out', duration: 1.1, delay: 0.3 },
        ],
        panel: {
          title: 'The vote',
          icon: 'Users',
          rows: [
            { text: 'Node B', value: 'A is out', tone: 'good' },
            { text: 'Witness (third site)', value: 'A is out', tone: 'good' },
            { text: 'Node A (cut off)', value: '1 vote of 3, no majority', tone: 'bad' },
            { text: 'Monitor', value: 'counts, no vote', tone: 'muted' },
          ],
          footer: { text: '2 of 3 wins', tone: 'good' },
        },
        caption: 'A majority picks the new primary',
      },
    },
    {
      title: 'Fencing',
      tag: 'concept',
      heading: 'Fence the old primary first',
      eli5: 'Before the substitute starts, the caretaker takes the old teacher\'s classroom key. A teacher with no key cannot teach, even if she is still standing in the hall. That key-taking is **fencing**.',
      body: [
        '**Fencing** makes sure the old primary cannot act. Options include cutting its power through a management interface (often called STONITH, "shoot the other node in the head"), revoking its storage or network access, or letting its lease expire before the new primary starts.',
        'Order matters: fence first, promote second. Promote first and there is a window with two primaries.',
      ],
      keyIdea: 'Stop the old primary before the new one starts: cut power, revoke access, or let its lease expire.',
      metrics: { rto: '21 s', rpo: '0', spare: 'hot + witness', cost: '2x + small witness' },
      scene: {
        nodes: [
          { ...monitor, status: 'active' },
          { ...primary, status: 'down', badge: 'fenced' },
          { ...standby, label: 'new primary', status: 'ok' },
        ],
        links: [link('monitor', 'primary', { style: 'dashed', label: 'power off' }), link('monitor', 'standby', { style: 'dashed' })],
        flows: [
          { path: ['monitor', 'primary'], tone: 'error', label: 'fence', duration: 1.1 },
          { path: ['monitor', 'standby'], tone: 'event', label: 'then promote', duration: 1.1, delay: 1.4 },
        ],
        panel: {
          title: 'Ways to fence',
          icon: 'Shield',
          rows: [
            { text: 'STONITH: cut the power', value: 'strongest' , tone: 'good' },
            { text: 'Revoke storage or network', value: 'strong', tone: 'good' },
            { text: 'Lease expires first', value: 'needs clocks', tone: 'warn' },
          ],
          footer: { text: 'Fence, then promote', tone: 'good' },
        },
        caption: 'The loser is fenced before the winner starts',
      },
    },
    {
      title: 'Epoch token',
      tag: 'concept',
      heading: 'Fencing tokens: the last line of defense',
      eli5: 'Every new teacher gets a bigger badge number. The school office ignores any note stamped with an old number, so a sleepy old teacher who wakes up cannot change the grades.',
      body: [
        'Fencing can fail, for example a paused process that wakes up late. A **fencing token** covers the gap. Each promotion gets a higher **epoch** number, and storage or downstream services reject writes that carry an older one.',
        'Even if the old primary wakes up and tries to write, its epoch 7 loses to epoch 8.',
      ],
      keyIdea: 'Each promotion gets a higher epoch, and the data layer rejects writes from older epochs.',
      metrics: { rto: '21 s', rpo: '0', spare: 'hot + witness', cost: '2x + small witness' },
      metricTones: { rpo: 'good' },
      scene: {
        nodes: [
          { ...primary, status: 'down', badge: 'woke up, epoch 7', chips: [{ text: 'write epoch 7', tone: 'bad' }] },
          { ...standby, label: 'new primary', status: 'ok', badge: 'epoch 8', chips: [{ text: 'write epoch 8', tone: 'good' }] },
          { id: 'store', kind: 'storage', at: p(5.5, 0), label: 'storage', sub: 'highest epoch: 8', status: 'active' },
        ],
        links: [link('primary', 'store', { style: 'faint' }), link('standby', 'store')],
        flows: [
          { path: ['standby', 'store'], tone: 'request', label: 'epoch 8: accepted', duration: 1.4 },
          { path: ['primary', 'store'], tone: 'error', label: 'epoch 7: rejected', duration: 1.4, delay: 1.5 },
        ],
        caption: 'Stale leaders are rejected at the storage',
      },
      code: {
        language: 'python',
        title: 'Storage that rejects stale leaders',
        source: `class Storage:
    def __init__(self):
        self.highest_epoch = 0
        self.data = {}

    def write(self, epoch, key, value):
        # A new primary always carries a higher epoch than the last one.
        if epoch < self.highest_epoch:
            raise PermissionError(f"stale leader: epoch {epoch}")
        self.highest_epoch = epoch
        self.data[key] = value

store = Storage()
store.write(8, "order:991", "paid")      # new primary: accepted
store.write(7, "order:991", "refunded")  # old primary wakes up: rejected`,
        highlight: [8, 9, 10, 15],
      },
      quiz: {
        question: 'The old primary was paused for 40 s by a long garbage collection and wakes up after node B was promoted with epoch 8. It sends a write with epoch 7. What happens?',
        options: [
          'The write is accepted because it came first',
          'The storage rejects it because 7 is lower than the highest epoch seen',
          'The monitor demotes node B',
          'The write is applied after a merge',
        ],
        answer: 1,
        explain: 'The storage remembers epoch 8 and refuses anything lower. The stale primary cannot damage data even though it believes it is still in charge.',
      },
    },
    {
      title: 'Active-active',
      tag: 'tradeoff',
      heading: 'Active-active: both nodes serve',
      eli5: 'Two teachers each run half the class, so no one sits idle. Both teaching all day is **active-active**.',
      body: [
        'In **active-passive** the standby idles. In **active-active** every node serves traffic all the time. Stateless app servers behind a load balancer are the easy case: when one dies, the balancer stops sending it requests. Nothing needs promoting.',
        'For databases, active-active means every node accepts writes, which brings back write conflicts. It is common for stateless tiers and caches, and much harder for the primary copy of data. The multi-region lesson covers how to split or merge writes.',
      ],
      keyIdea: 'Active-active wastes no idle machine and needs no promotion for stateless tiers. For data it brings write conflicts back.',
      metrics: { rto: '~3 s (drop from pool)', rpo: '0 (stateless)', spare: 'none idle', cost: '2x, 50% utilized' },
      metricTones: { rto: 'good', rpo: 'good' },
      scene: {
        nodes: [
          clients,
          { ...vip, label: 'load balancer', sub: 'health checks', icon: 'Scale', status: 'active' },
          { ...primary, kind: 'server', label: 'node A', sub: 'stateless app', status: 'active', load: 45, chips: ['2,500 req/s'] },
          { ...standby, kind: 'server', label: 'node B', sub: 'stateless app', status: 'active', load: 45, chips: ['2,500 req/s'] },
        ],
        links: [link('clients', 'vip'), link('vip', 'primary'), link('vip', 'standby')],
        flows: [
          { path: ['clients', 'vip'], tone: 'request', count: 4, duration: 1 },
          { path: ['vip', 'primary'], tone: 'request', count: 2, duration: 1, delay: 1.1 },
          { path: ['vip', 'standby'], tone: 'request', count: 2, duration: 1, delay: 1.1 },
        ],
        caption: 'Both serve, and the balancer drops a dead one',
      },
    },
    {
      title: 'Headroom',
      tag: 'case',
      heading: 'Case: the survivor takes everything',
      eli5: 'Two teachers each teach half the class. If one leaves, the other teaches everyone, which only works if she was not already worn out at half.',
      body: [
        'Two nodes sharing 5,000 req/s each run at 2,500. If one fails, the survivor takes all 5,000. Keep each node under **50%** of its capacity, or under 67% with three nodes, or failover turns into overload and a second outage.',
        'This is the N+1 rule: size the fleet so that losing any one node still leaves enough capacity.',
      ],
      keyIdea: 'Each node must keep spare capacity for a failed peer: under 50% with two nodes, under 67% with three.',
      metrics: { rto: '~3 s', rpo: '0', spare: 'N+1 headroom', cost: '2x, 50% utilized' },
      metricTones: { spare: 'warn' },
      scene: {
        nodes: [
          { ...vip, label: 'load balancer', sub: 'health checks', icon: 'Scale', status: 'active' },
          { ...primary, kind: 'server', label: 'node A', sub: 'stateless app', status: 'down' },
          { ...standby, kind: 'server', label: 'node B', sub: 'stateless app', status: 'hot', load: 90, chips: [{ text: '5,000 req/s', tone: 'warn' }] },
        ],
        links: [link('vip', 'primary', { style: 'faint' }), link('vip', 'standby')],
        flows: [{ path: ['vip', 'standby'], tone: 'request', count: 4, duration: 1.2 }],
        panel: {
          title: 'Utilization before a failure',
          icon: 'Gauge',
          rows: [
            { text: '2 nodes at 45%', value: '90% after loss', tone: 'good' },
            { text: '2 nodes at 70%', value: '140%, overload', tone: 'bad' },
            { text: '3 nodes at 60%', value: '90% after loss', tone: 'good' },
          ],
          footer: { text: 'Limit: 50% with 2 nodes, 67% with 3', tone: 'muted' },
        },
        caption: 'Failover should not become overload',
      },
      quiz: {
        question: 'Three stateless servers share 6,000 req/s evenly, and each can handle 3,000. One server fails. What is each survivor\'s load, and is it safe?',
        options: [
          '2,000 req/s each, no failure is possible',
          '3,000 req/s each, at 100%: no headroom, so it is risky',
          '4,000 req/s each, overload',
          '1,500 req/s each, safe',
        ],
        answer: 1,
        explain: '6,000 across 2 survivors is 3,000 each, exactly at capacity. The 67% rule says three nodes should run at about 2,000 each before a failure, which is 67% of 3,000, so this fleet was already at its limit and should be larger.',
      },
    },
    {
      title: 'Failback',
      tag: 'concept',
      heading: 'Bringing the old primary back',
      eli5: 'When the first teacher recovers, she does not storm back in mid-lesson. She sits in the next room as the new substitute and catches up on notes. Returning later, on purpose, is **failback**.',
      body: [
        'Node A is repaired. It cannot rejoin as primary: its data stopped at the failure, and it may hold writes that never reached B. Those are reviewed, then A rewinds to B\'s history (`pg_rewind` in Postgres) or is rebuilt from a fresh copy.',
        'A rejoins as the **standby**. Many teams leave it there. To restore the old layout, use a planned switchover that loses nothing. Avoid automatic failback: a node that crashes, recovers and takes over again makes the system **flap**, with an outage at every swap.',
      ],
      keyIdea: 'The recovered node rejoins as a standby. Switch back later, on purpose, never automatically.',
      metrics: { rto: '0 (planned)', rpo: '0', spare: 'node A, resynced', cost: '2x' },
      metricTones: { rto: 'good', rpo: 'good' },
      scene: {
        nodes: [
          { ...vip, status: 'active' },
          { ...primary, label: 'standby', sub: 'node A', status: 'active', badge: 'rewound, catching up' },
          { ...standby, label: 'primary', sub: 'node B', status: 'ok' },
          monitor,
        ],
        links: [link('vip', 'standby'), link('vip', 'primary', { style: 'faint' }), link('standby', 'primary', { style: 'dashed', label: 'replication' }), ...watch],
        flows: [
          { path: ['vip', 'standby'], tone: 'request', count: 2, duration: 1.4 },
          { path: ['standby', 'primary'], tone: 'data', label: 'WAL stream', count: 3, duration: 1.4, delay: 1.5 },
        ],
        caption: 'Roles swapped. A follows B now.',
      },
    },
    {
      title: 'Game day',
      tag: 'concept',
      heading: 'Test the failover on a schedule',
      eli5: 'A school runs a fire drill so everyone knows the way out before a real fire. Swapping the teacher on purpose, with a stopwatch, is the same kind of **drill**.',
      body: [
        'Failover code runs rarely, so it rots. Schedule a **game day**: kill the primary on purpose, then time detection, promotion and redirect against your RTO. Start in staging, then run it in production with people watching.',
        'Write the result down and fix whichever step ran over. Chaos tools can run the kill on a schedule. A drill that passes proves the switch still works today.',
      ],
      keyIdea: 'Kill the primary on purpose, time every phase against the RTO, and fix what ran over.',
      metrics: { rto: '23 s measured', rpo: '0', spare: 'hot + witness', cost: '2x + drill time' },
      metricTones: { rto: 'warn', rpo: 'good' },
      scene: {
        nodes: [
          { ...monitor, status: 'active' },
          { ...primary, status: 'down', badge: 'killed on purpose' },
          { ...standby, label: 'new primary', status: 'ok' },
          { ...vip, status: 'active' },
        ],
        links: [link('vip', 'standby'), link('vip', 'primary', { style: 'faint' }), ...watch],
        flows: [
          { path: ['monitor', 'primary'], tone: 'error', label: 'no reply x3', duration: 1.2 },
          { path: ['monitor', 'standby'], tone: 'event', label: 'promote', duration: 1.2, delay: 1.3 },
          { path: ['standby', 'vip'], tone: 'event', label: 'claim VIP', duration: 1.1, delay: 2.6 },
        ],
        panel: {
          title: 'Game day result',
          icon: 'Timer',
          rows: [
            { text: 'Detect (target 9 s)', value: '9 s', tone: 'good' },
            { text: 'Promote (target 5 s)', value: '6 s', tone: 'warn' },
            { text: 'Redirect (target 7 s)', value: '8 s', tone: 'warn' },
            { text: 'Total (RTO 21 s)', value: '23 s, over by 2 s', tone: 'bad' },
          ],
          footer: { text: 'Fix the slow step, then run it again', tone: 'warn' },
        },
        caption: 'Time the real switch against the RTO',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'A spare, a detector, a switch and a fence',
      eli5: 'A good school keeps a substitute ready, checks on the teacher often, moves the door sign fast, takes the old key away, and practices the swap before it is needed.',
      body: [
        'Redundancy helps only with independent failures. **Heartbeats** with a timeout detect failure, **promotion** plus a **virtual IP** or **DNS switch** moves traffic, and **RTO** and **RPO** set the targets. A **quorum** with a witness, **fencing** and epochs prevent split brain.',
        '**Active-active** skips the idle spare but needs headroom. After repair, fail back on purpose. A scheduled **game day** keeps the whole path honest and timed against the RTO.',
      ],
      keyIdea: 'Failover is only as good as its last test. Detect, fence, promote, redirect, and practice all four.',
      metrics: { rto: '~21 s', rpo: '0', spare: 'hot + witness', cost: '2x' },
      metricTones: { rto: 'good', rpo: 'good' },
      scene: {
        nodes: [{ ...vip, status: 'active' }, { ...primary, status: 'ok' }, { ...standby, status: 'ok' }, { ...monitor, status: 'ok' }, witness],
        links: [link('vip', 'primary'), link('vip', 'standby', { style: 'faint' }), link('primary', 'standby', { style: 'dashed', label: 'replication' }), ...watch, link('witness', 'monitor', { style: 'faint' })],
        flows: [
          { path: ['vip', 'primary'], tone: 'request', duration: 1.4 },
          { path: ['primary', 'standby'], tone: 'data', duration: 1.2, delay: 1.5 },
          { path: ['monitor', 'primary'], tone: 'handshake', duration: 1, delay: 0.5 },
        ],
        panel: {
          title: 'Failover checklist',
          icon: 'List',
          rows: [
            { text: 'Independent spare', value: 'hot', tone: 'good' },
            { text: 'Detect, with a timeout', value: '5 to 30 s' },
            { text: 'Quorum, then fence', value: 'epoch +1', tone: 'good' },
            { text: 'Promote and redirect', value: 'VIP or DNS' },
            { text: 'Test on a schedule', value: 'timed vs RTO', tone: 'good' },
          ],
        },
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
