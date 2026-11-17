import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const ana: SceneNode = { id: 'ana', kind: 'phone', at: at(-6, 0), label: 'Ana', sub: 'writes' };
const leader: SceneNode = { id: 'leader', kind: 'db', at: at(-2.6, 0), label: 'leader', sub: 'takes writes' };
const repA: SceneNode = { id: 'repA', kind: 'replica', at: at(0.8, -3.6), label: 'replica A', sub: 'caught up' };
const repB: SceneNode = { id: 'repB', kind: 'replica', at: at(3.6, 3.6), label: 'replica B', sub: '2 s behind' };
const ben: SceneNode = { id: 'ben', kind: 'phone', at: at(6.2, -3.6), label: 'Ben', sub: 'reads' };
const cara: SceneNode = { id: 'cara', kind: 'phone', at: at(6.6, 3.6), label: 'Cara', sub: 'reads' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

export const consistencyModelsPart2: Lesson = {
  id: 'consistency-models-part-2',
  title: 'Consistency models (part 2)',
  tagline: 'The top of the ladder: sequential, linearizable, quorums, the price of each rung and what real databases offer.',
  minutes: 15,
  level: 'Advanced',
  learn: [
    'Sequential versus linearizable, and why real time matters',
    'Linearizable versus serializable',
    'Quorums: R + W > N, and why they are not enough',
    'The cost of strong reads and bounded staleness',
    'What Postgres, DynamoDB, Cassandra, MongoDB, etcd and ZooKeeper actually offer',
  ],
  metrics: [
    { key: 'model', label: 'Guarantee', icon: 'Layers' },
    { key: 'anomaly', label: 'Still possible', icon: 'Bug' },
    { key: 'latency', label: 'Read latency', icon: 'Timer' },
    { key: 'avail', label: 'Reads in a partition', icon: 'Signal' },
  ],
  steps: [
    {
      title: 'Phone gap',
      tag: 'problem',
      heading: 'Ana saved the time, called Cara, and Cara saw the old one',
      eli5: 'Ana pins the new practice time on the main board, then phones Cara. Cara walks to a hallway board that has not been updated and reads the old time.',
      body: [
        'Ana changes the meeting time to 7, waits for the save to finish, and phones Cara. Cara opens the chat and a replica returns "meet at 6".',
        'No session or causal rule was broken, because the phone call happened outside the system. We need a rung that ties ordering to real time. First, the one below it.',
      ],
      keyIdea: 'Session and causal rules only know about operations inside the system. A phone call is invisible to them.',
      metrics: { model: 'causal', anomaly: 'stale vs real time', latency: '2 ms local', avail: 'yes' },
      metricTones: { anomaly: 'bad' },
      scene: {
        nodes: [
          { ...ana, badge: 'saved: meet at 7' },
          { ...leader, badge: 'meet at 7' },
          { ...repB, status: 'hot', badge: 'meet at 6' },
          { ...cara, status: 'hot', badge: 'reads old time' },
        ],
        links: [link('ana', 'leader'), link('leader', 'repB', { style: 'dashed' }), link('cara', 'repB'), link('ana', 'cara', { style: 'faint', label: 'phone call', route: 'straight' })],
        flows: [
          { path: ['ana', 'leader'], tone: 'request', label: 'meet at 7', duration: 1 },
          { path: ['ana', 'cara'], tone: 'event', label: '"check the chat"', duration: 1.4, delay: 1.2 },
          { path: ['cara', 'repB', 'cara'], tone: 'error', label: 'meet at 6', duration: 1.6, delay: 2.8 },
        ],
        panel: {
          title: 'Timeline',
          icon: 'Clock',
          rows: [
            { text: 't=0 Ana saves', value: 'meet at 7', tone: 'good' },
            { text: 't=1 s Ana phones Cara', value: 'outside the system', tone: 'muted' },
            { text: 't=2 s Cara reads', value: 'meet at 6', tone: 'bad' },
          ],
        },
        caption: 'The write finished before the read started, and still lost',
      },
    },
    {
      title: 'Sequential',
      tag: 'concept',
      heading: 'Sequential consistency: one order, maybe late',
      eli5: 'Now every hallway board shows notices in the exact same order as the main board. A board can still be a few minutes behind the main one.',
      body: [
        '**Sequential consistency** says all clients see all writes in one single order, and that order respects each client\'s own sequence of operations. Nobody sees writes in a different order from anyone else.',
        'It does not promise recency. The single order can lag real time, so the phone-call gap from step 1 is still legal.',
      ],
      keyIdea: 'Sequential consistency agrees on one order of history for everyone, without promising that you are reading the present.',
      metrics: { model: 'sequential', anomaly: 'stale vs real time', latency: '2 ms local', avail: 'stale reads only' },
      metricTones: { model: 'good', anomaly: 'warn' },
      scene: {
        nodes: [
          { ...leader, badge: 'order: 1, 2, 3' },
          { ...repA, badge: 'saw 1, 2, 3' },
          { ...repB, badge: 'saw 1, 2' },
          { ...ben, badge: 'sees 1, 2, 3' },
          { ...cara, badge: 'sees 1, 2' },
        ],
        links: [link('leader', 'repA', { style: 'dashed' }), link('leader', 'repB', { style: 'dashed' }), link('ben', 'repA'), link('cara', 'repB')],
        flows: [
          { path: ['leader', 'repA'], tone: 'data', label: '1, 2, 3', duration: 1 },
          { path: ['leader', 'repB'], tone: 'data', label: '1, 2', duration: 2, delay: 0.2 },
          { path: ['repA', 'ben'], tone: 'response', duration: 0.9, delay: 1.4 },
          { path: ['repB', 'cara'], tone: 'response', duration: 0.9, delay: 2.4 },
        ],
        panel: {
          title: 'Same order, different distance',
          icon: 'List',
          rows: [
            { text: 'Ben (A)', value: '1, 2, 3', tone: 'good' },
            { text: 'Cara (B)', value: '1, 2', tone: 'warn' },
          ],
          footer: { text: 'Cara is behind, but never out of order', tone: 'muted' },
        },
        caption: 'Prefixes of the same history',
      },
    },
    {
      title: 'Single log',
      tag: 'concept',
      heading: 'Where sequential comes from: one replicated log',
      eli5: 'The main board keeps a numbered list of every notice. Each hallway board copies the list in order, so all boards agree on the order, though some have copied less.',
      body: [
        'A single leader replicating its log in order gives roughly this shape: every follower replays the same sequence, and some are further behind than others.',
        'ZooKeeper documents its reads this way and offers a `sync` call for when you need the latest.',
      ],
      keyIdea: 'One ordered log gives sequential reads. Asking the leader to catch you up gives something stronger.',
      metrics: { model: 'sequential', anomaly: 'stale vs real time', latency: '2 ms local, sync adds a hop', avail: 'stale reads only' },
      scene: {
        nodes: [{ ...leader, badge: 'log: 1, 2, 3' }, { ...repB, badge: 'replayed 1, 2' }, { ...cara, chips: [{ text: 'sync, then read', tone: 'good' }] }],
        links: [link('leader', 'repB', { style: 'dashed' }), link('cara', 'repB')],
        flows: [
          { path: ['cara', 'repB'], tone: 'request', label: 'sync', duration: 1 },
          { path: ['repB', 'leader'], tone: 'request', label: 'catch me up', duration: 1, delay: 1.1 },
          { path: ['leader', 'repB'], tone: 'data', label: 'entry 3', duration: 1, delay: 2.2 },
          { path: ['repB', 'cara'], tone: 'response', label: 'latest', duration: 1, delay: 3.3 },
        ],
        panel: {
          title: 'ZooKeeper reads',
          icon: 'Code',
          code: 'read      -> local, sequential\nsync()    -> follower catches up\nread      -> sees earlier writes',
        },
        caption: 'sync trades a hop for freshness',
      },
    },
    {
      title: 'Linearizable',
      tag: 'concept',
      heading: 'Linearizability: behave like a single copy',
      eli5: 'Now the school acts as if there were only the main board. The moment a notice is pinned, anyone who looks anywhere sees it. Nobody can ever catch an old version.',
      body: [
        '**Linearizability** is the top rung. The system behaves as if there were one copy of the data and every operation took effect at a single instant between its start and its end.',
        'Once any read returns the new value, every read that starts afterwards, from anyone, returns it too. That closes the phone-call gap: if Ana\'s write finished before Cara\'s read began, Cara sees it on any replica.',
      ],
      keyIdea: 'Linearizable means one copy in real time: after a write completes, nobody anywhere can read the old value.',
      metrics: { model: 'linearizable', anomaly: 'none', latency: '1 majority round trip', avail: 'majority side only' },
      metricTones: { model: 'good', anomaly: 'good', latency: 'warn', avail: 'warn' },
      scene: {
        nodes: [{ ...ana, status: 'ok', badge: 'write acked' }, { ...leader, status: 'active', badge: 'meet at 7' }, { ...cara, status: 'ok', badge: 'meet at 7' }],
        links: [link('ana', 'leader'), link('cara', 'leader')],
        flows: [
          { path: ['ana', 'leader', 'ana'], tone: 'request', label: 'write: meet at 7', duration: 1.8 },
          { path: ['cara', 'leader'], tone: 'request', label: 'read', duration: 1, delay: 2.2 },
          { path: ['leader', 'cara'], tone: 'response', label: 'meet at 7', duration: 1, delay: 3.3 },
        ],
        panel: {
          title: 'The real-time rule',
          icon: 'Clock',
          rows: [
            { text: 'Ana\'s write finishes', value: 't = 40 ms' },
            { text: 'Cara\'s read starts', value: 't = 60 ms' },
            { text: 'Cara must see', value: 'meet at 7', tone: 'good' },
          ],
        },
        caption: 'After a write completes, every later read sees it',
      },
    },
    {
      title: 'Getting there',
      tag: 'concept',
      heading: 'How a system proves it is current',
      eli5: 'Before answering, the main board asks the two hallway boards, "am I still the boss?" Only when most of them say yes does it read out the notice.',
      body: [
        'Reads either go to a leader that confirms it is still leader (a lease, or a round of heartbeats with a majority), or go through the consensus log.',
        'etcd does this by default and lets you ask for a cheaper, possibly stale read.',
      ],
      keyIdea: 'Linearizable reads pay for a majority check. Cheaper reads skip it and may be stale.',
      metrics: { model: 'linearizable', anomaly: 'none', latency: '1 majority round trip', avail: 'majority side only' },
      metricTones: { latency: 'warn' },
      scene: {
        nodes: [
          { ...leader, status: 'active', badge: 'confirms with majority' },
          { ...repA, label: 'follower A', sub: 'votes', status: 'ok' },
          { ...repB, label: 'follower B', sub: 'votes', status: 'ok' },
          { ...cara, status: 'ok', badge: 'meet at 7' },
        ],
        links: [link('leader', 'repA', { style: 'dashed' }), link('leader', 'repB', { style: 'dashed' }), link('cara', 'leader')],
        flows: [
          { path: ['cara', 'leader'], tone: 'request', label: 'read', duration: 1 },
          { path: ['leader', 'repA'], tone: 'handshake', label: 'still leader?', duration: 0.8, delay: 1.1 },
          { path: ['leader', 'repB'], tone: 'handshake', duration: 0.8, delay: 1.1 },
          { path: ['repA', 'leader'], tone: 'handshake', label: 'yes', duration: 0.8, delay: 2 },
          { path: ['leader', 'cara'], tone: 'response', label: 'meet at 7', duration: 1, delay: 3 },
        ],
        panel: {
          title: 'Read path',
          icon: 'Route',
          rows: [
            { text: '1 client asks leader', value: '1 hop' },
            { text: '2 leader asks majority', value: '1 round trip', tone: 'warn' },
            { text: '3 majority says yes', value: 'still leader', tone: 'good' },
            { text: '4 leader answers', value: 'latest value', tone: 'good' },
          ],
        },
        caption: 'The read waits until the leader proves it is current',
      },
      code: {
        language: 'bash',
        title: 'etcd: linearizable by default, stale on request',
        source: `# default: linearizable read, goes through the quorum
etcdctl get /chat/meeting-time

# serializable read: answered by the local member, may be stale
etcdctl get /chat/meeting-time --consistency=s

# compare-and-swap that only works with linearizable storage:
# take the lock only if nobody holds it
etcdctl txn <<'EOF'
create("/locks/report") = "0"

put /locks/report "worker-7"

EOF`,
        highlight: [2, 5, 10, 12],
      },
    },
    {
      title: 'Serializable',
      tag: 'concept',
      heading: 'Linearizable is not the same as serializable',
      eli5: 'One rule is about the order of whole shopping trips at the checkout. The other is about whether the price board is up to date. A shop can get one right and the other wrong.',
      body: [
        '**Serializable** is about transactions: many operations behave as if they ran one at a time. **Linearizable** is about a single object: reads and writes obey real time. They are different axes, and people mix them up.',
        '**Strict serializability** gives both, and Spanner offers it. A database can be serializable and still return a stale read from a lagging follower.',
      ],
      keyIdea: 'Serializable orders transactions. Linearizable orders single operations against real time. You can have one without the other.',
      metrics: { model: 'serializable vs linearizable', anomaly: 'depends on which', latency: 'varies', avail: 'varies' },
      scene: {
        nodes: [{ ...ana, chips: ['BEGIN ... COMMIT'] }, leader, { ...cara, chips: ['read x'] }],
        links: [link('ana', 'leader'), link('cara', 'leader')],
        flows: [
          { path: ['ana', 'leader', 'ana'], tone: 'request', label: 'transaction', duration: 1.8 },
          { path: ['cara', 'leader', 'cara'], tone: 'request', label: 'single read', duration: 1.8, delay: 2 },
        ],
        panel: {
          title: 'Two different axes',
          icon: 'Scale',
          rows: [
            { text: 'Serializable', value: 'transactions in some order' },
            { text: 'Linearizable', value: 'one object, real time' },
            { text: 'Strict serializable', value: 'both (Spanner)', tone: 'good' },
          ],
          footer: { text: 'Check which one a vendor means by "strong"', tone: 'warn' },
        },
        caption: 'Isolation of transactions versus recency of a value',
      },
    },
    {
      title: 'Quorums',
      tag: 'concept',
      heading: 'Quorums: make reads and writes overlap',
      eli5: 'There are three boards. A notice is written on two of them, and a reader checks two of them. Any two boards share at least one board, so a reader always meets a board with the newest notice.',
      body: [
        'Leaderless stores keep N copies. A write waits for W acks and a read asks R copies, then takes the newest version. If **R + W > N**, every read set overlaps every write set in at least one copy.',
        'With N = 3, W = 2 and R = 2 the overlap is guaranteed. With W = 1 and R = 1 a read can miss the write entirely.',
      ],
      keyIdea: 'R + W > N makes read and write groups overlap, so a read meets at least one copy with the latest acknowledged write.',
      metrics: { model: 'quorum', anomaly: 'depends on R and W', latency: '2 of 3 replies', avail: 'survives 1 node down' },
      scene: {
        nodes: [
          { ...ana, label: 'client', sub: 'W = 2, R = 2' },
          { ...leader, label: 'node 1', sub: 'copy', badge: 'v2' },
          { ...repA, label: 'node 2', sub: 'copy', badge: 'v2' },
          { ...repB, label: 'node 3', sub: 'copy', badge: 'v1' },
        ],
        links: [link('ana', 'leader'), link('ana', 'repA', { style: 'faint' }), link('ana', 'repB', { style: 'faint' })],
        flows: [
          { path: ['ana', 'leader'], tone: 'request', label: 'write v2', duration: 1 },
          { path: ['ana', 'repA'], tone: 'request', label: 'write v2', duration: 1.2 },
          { path: ['repA', 'ana'], tone: 'response', label: 'read: v2', duration: 1.2, delay: 2 },
          { path: ['repB', 'ana'], tone: 'response', label: 'read: v1', duration: 1.4, delay: 2 },
        ],
        panel: {
          title: 'Settings for N = 3',
          icon: 'Table',
          rows: [
            { text: 'W=2, R=2', value: '4 > 3, overlap', tone: 'good' },
            { text: 'W=3, R=1', value: '4 > 3, slow writes', tone: 'warn' },
            { text: 'W=1, R=3', value: '4 > 3, slow reads', tone: 'warn' },
            { text: 'W=1, R=1', value: '2 < 3, may miss', tone: 'bad' },
          ],
        },
        caption: 'The reader always meets a fresh copy, and takes the newest version',
      },
    },
    {
      title: 'Quorum gaps',
      tag: 'concept',
      heading: 'Why a quorum is not automatically linearizable',
      eli5: 'Even with the overlap rule, a notice half written on one board can be read by some people and missed by others. Rules about counting boards do not give one perfect copy.',
      body: [
        'A write that fails after reaching one node can still be read later, then vanish. A **sloppy quorum** writes to stand-in nodes outside the key\'s usual set, so overlap is lost. Concurrent writes still need conflict resolution.',
        'Cassandra adds lightweight transactions, a Paxos round, for compare-and-set. For true linearizability use consensus.',
      ],
      keyIdea: 'Overlap is necessary, not sufficient. Partial writes, sloppy quorums and concurrent writes still break the single-copy illusion.',
      metrics: { model: 'quorum', anomaly: 'partial writes visible, then gone', latency: '2 of 3 replies', avail: 'survives 1 node down' },
      metricTones: { anomaly: 'bad' },
      scene: {
        nodes: [
          { ...ana, label: 'writer', sub: 'W = 2', status: 'hot', badge: 'timed out' },
          { ...leader, label: 'node 1', sub: 'copy', badge: 'v2 (partial)' },
          { ...repA, label: 'node 2', sub: 'copy', badge: 'v1' },
          { ...repB, label: 'node 3', sub: 'copy', badge: 'v1' },
          { ...ben, label: 'reader', sub: 'R = 1', status: 'hot', badge: 'v2, then v1' },
        ],
        links: [
          link('ana', 'leader'),
          link('ana', 'repA', { style: 'faint', label: 'lost', labelTone: 'warn' }),
          link('ana', 'repB', { style: 'faint' }),
          link('ben', 'leader'),
          link('ben', 'repA', { label: 'seen, then gone', labelTone: 'warn' }),
        ],
        flows: [
          { path: ['ana', 'leader'], tone: 'request', label: 'write v2', duration: 1 },
          { path: ['ana', 'repA'], tone: 'error', label: 'lost', duration: 1, delay: 0.2 },
          { path: ['ana', 'repB'], tone: 'error', label: 'lost', duration: 1, delay: 0.2 },
          { path: ['leader', 'ben'], tone: 'response', label: 'read 1: v2', duration: 1, delay: 1.8 },
          { path: ['repA', 'ben'], tone: 'error', label: 'read 2: v1', duration: 1, delay: 3.2 },
        ],
        panel: {
          title: 'Ways overlap breaks',
          icon: 'Bug',
          rows: [
            { text: 'Failed write left on 1 node', value: 'seen, then gone', tone: 'bad' },
            { text: 'Sloppy quorum', value: 'stand-in nodes', tone: 'warn' },
            { text: 'Concurrent writes', value: 'need a merge rule', tone: 'warn' },
          ],
        },
        caption: 'Counting acks does not give one copy',
      },
      quiz: {
        question: 'A key has N = 3 copies. Writes wait for W = 2 acks and reads ask R = 1 copy. Does every read see the latest acknowledged write?',
        options: ['Yes, a write majority is enough', 'No, R + W = 3 is not greater than N', 'Yes, if the clocks are synchronized', 'Only if the reader asks the leader'],
        answer: 1,
        explain: 'The overlap rule needs R + W > N, and 1 + 2 = 3. The single copy the reader asks may be the one that missed the write. Even with overlap, partial writes and sloppy quorums can still break linearizability.',
      },
    },
    {
      title: 'The price',
      tag: 'tradeoff',
      heading: 'What each rung costs in latency and in a partition',
      eli5: 'Checking the main board is slower than glancing at the hallway board. And when the school hallway is blocked, the hallway boards still answer but the main board cannot be reached.',
      body: [
        'Each rung up costs round trips. A linearizable operation pays a majority round trip: about 1 ms in one datacenter, 70+ ms across regions.',
        'During a partition the minority side cannot reach a majority, so it must refuse linearizable requests, while eventual and causal replicas keep answering. That is the C versus A choice in CAP, plus the latency half of **PACELC**: even with no partition, stronger means slower.',
      ],
      keyIdea: 'Stronger guarantees cost latency always and availability during partitions. Weaker ones keep answering.',
      metrics: { model: 'per rung', anomaly: 'shrinks as you climb', latency: '2 ms to 70+ ms', avail: 'minority side refuses strong reads' },
      metricTones: { latency: 'warn', avail: 'warn' },
      scene: {
        nodes: [
          { ...leader, status: 'active', sub: 'majority side' },
          { ...repA, status: 'ok', sub: 'majority side' },
          { ...repB, status: 'down', sub: 'cut off' },
          { ...cara, chips: [{ text: 'strong read', tone: 'bad' }, { text: 'stale read', tone: 'good' }] },
        ],
        links: [link('leader', 'repA', { style: 'dashed' }), link('leader', 'repB', { style: 'faint', label: 'partition', labelTone: 'warn' }), link('cara', 'repB')],
        flows: [
          { path: ['cara', 'repB'], tone: 'request', label: 'strong read', duration: 1.2 },
          { path: ['repB', 'cara'], tone: 'error', label: 'refused', duration: 1.2, delay: 1.3 },
          { path: ['cara', 'repB', 'cara'], tone: 'response', label: 'stale read: ok', duration: 1.8, delay: 2.8 },
        ],
        panel: {
          title: 'Cost by rung',
          icon: 'Scale',
          rows: [
            { text: 'Eventual', value: '2 ms, answers', tone: 'good' },
            { text: 'Causal', value: '2 ms, answers', tone: 'good' },
            { text: 'Sequential', value: '2 ms, stale reads', tone: 'warn' },
            { text: 'Linearizable', value: '70+ ms, may refuse', tone: 'bad' },
          ],
        },
        caption: 'The cut-off side serves stale reads or refuses strong ones',
      },
    },
    {
      title: 'Bounded stale',
      tag: 'concept',
      heading: 'A middle rung: stale, but only this stale',
      eli5: 'The school says a hallway board may be at most five minutes old. Boards that are older are skipped, and readers walk to a fresher one.',
      body: [
        'Some stores offer reads that are at most K versions or T seconds behind. Azure Cosmos DB calls it **bounded staleness**. You can build it yourself: route a read to a replica only if its lag is under your limit.',
        'It caps how wrong a read can be without paying a majority round trip. The bound is a worst case, not the typical lag.',
      ],
      keyIdea: 'Bounded staleness turns "eventually" into "within 5 seconds". Use it where a fixed delay is acceptable.',
      metrics: { model: 'bounded staleness', anomaly: 'stale within the bound', latency: '2 ms local', avail: 'mostly' },
      metricTones: { model: 'good' },
      scene: {
        nodes: [leader, { ...repA, status: 'ok', badge: 'lag 0.2 s' }, { ...repB, status: 'hot', badge: 'lag 8 s' }, { ...ben, chips: [{ text: 'max lag 5 s', tone: 'good' }] }],
        links: [link('leader', 'repA', { style: 'dashed' }), link('leader', 'repB', { style: 'dashed' }), link('ben', 'repA'), link('ben', 'repB', { style: 'faint' })],
        flows: [
          { path: ['ben', 'repA', 'ben'], tone: 'response', label: 'lag ok', duration: 1.5 },
          { path: ['ben', 'repB'], tone: 'error', label: 'too far behind', duration: 1.2, delay: 2 },
        ],
        panel: {
          title: 'Lag check, limit 5 s',
          icon: 'Gauge',
          rows: [
            { text: 'replica A', value: '0.2 s, use', tone: 'good' },
            { text: 'replica B', value: '8 s, skip', tone: 'bad' },
          ],
        },
        caption: 'Skip any replica past the staleness bound',
      },
    },
    {
      title: 'Username race',
      tag: 'case',
      heading: 'Case: two people claim the same username',
      eli5: 'Two pupils each look at a different hallway board, see the last locker free, and both write their name on it. Only a single trusted board can stop that.',
      body: [
        'Signups for the name "mina" arrive in Berlin and in Ohio within 50 ms. Each region checks its own replica, finds the name free, and creates the account. Now two users own one name.',
        'No read-your-writes or causal guarantee prevents this, because neither client did anything wrong from its own point of view.',
      ],
      keyIdea: 'Two local "yes" answers can both be true on stale copies. Only a single agreed order prevents the double claim.',
      metrics: { model: 'eventual or causal', anomaly: 'duplicate username', latency: '2 ms local', avail: 'yes' },
      metricTones: { anomaly: 'bad' },
      scene: {
        zones: [
          { id: 'eu', from: [3, -2.3], to: [6, 0.8], label: 'Berlin', tone: 'violet' },
          { id: 'us', from: [-2.4, -5.8], to: [2.2, -1.2], label: 'Ohio', tone: 'blue' },
        ],
        nodes: [
          { ...repA, label: 'replica US', sub: 'local check', status: 'hot', badge: '"mina" free' },
          { ...repB, label: 'replica EU', sub: 'local check', status: 'hot', badge: '"mina" free' },
          { ...ben, label: 'Ben', sub: 'wants "mina"', status: 'hot' },
          { ...cara, label: 'Cara', sub: 'wants "mina"', status: 'hot' },
        ],
        links: [link('ben', 'repA'), link('cara', 'repB')],
        flows: [
          { path: ['ben', 'repA'], tone: 'request', label: 'is "mina" free?', duration: 1 },
          { path: ['cara', 'repB'], tone: 'request', label: 'is "mina" free?', duration: 1 },
          { path: ['repA', 'ben'], tone: 'error', label: 'yes', duration: 1, delay: 1.1 },
          { path: ['repB', 'cara'], tone: 'error', label: 'yes', duration: 1, delay: 1.1 },
        ],
        caption: 'Two local "yes" answers, one name',
      },
    },
    {
      title: 'Pay per key',
      tag: 'tradeoff',
      heading: 'Spend linearizability on the few keys that need it',
      eli5: 'Only the locker list needs the single trusted board. The lunch menu can stay on the hallway boards. Walking to the main board for everything would take all day.',
      body: [
        'Uniqueness constraints, locks, leader election, "last seat on the plane" and balances that must not go below zero all need everyone to agree on the latest value right now. That is **linearizability**, often for just one key or one row.',
        'A cross-region linearizable operation pays at least one round trip, often 70 ms or more, and the minority side must refuse it during a partition.',
      ],
      keyIdea: 'Use linearizability where two clients racing on the same value would break an invariant. Pay for it only there.',
      metrics: { model: 'linearizable for one key', anomaly: 'none for that key', latency: '70+ ms cross-region', avail: 'majority side only' },
      metricTones: { anomaly: 'good', latency: 'warn', avail: 'warn' },
      scene: {
        nodes: [
          { ...leader, status: 'active', label: 'name register', sub: 'one agreed order', badge: 'mina: Ben' },
          { ...ben, label: 'Ben (Ohio)', status: 'ok', badge: 'got "mina"' },
          { ...cara, label: 'Cara (Berlin)', status: 'hot', badge: '"mina" taken' },
        ],
        links: [link('ben', 'leader', { label: '70 ms', labelTone: 'warn' }), link('cara', 'leader', { label: '70 ms', labelTone: 'warn' })],
        flows: [
          { path: ['ben', 'leader', 'ben'], tone: 'request', label: 'claim "mina"', duration: 1.8 },
          { path: ['cara', 'leader'], tone: 'request', label: 'claim "mina"', duration: 1, delay: 2 },
          { path: ['leader', 'cara'], tone: 'error', label: 'taken', duration: 1, delay: 3.1 },
        ],
        panel: {
          title: 'Needs one agreed order',
          icon: 'Key',
          rows: [
            { text: 'Unique usernames', value: 'one key', tone: 'warn' },
            { text: 'Locks, leader election', value: 'one key', tone: 'warn' },
            { text: 'Last seat on a flight', value: 'one row', tone: 'warn' },
            { text: 'Like counts, feeds', value: 'eventual is fine', tone: 'good' },
          ],
        },
        caption: 'One register decides, the loser gets "taken"',
      },
    },
    {
      title: 'Real databases',
      tag: 'tradeoff',
      heading: 'What Postgres, DynamoDB and Cassandra give you',
      eli5: 'Each school picks its own rule. Some let you choose per question: glance at the nearest hallway board, or walk to the main board when it really matters.',
      body: [
        '**PostgreSQL or MySQL with one primary**: reads on the primary see every committed write. Async replicas are eventually consistent, and session routing adds read-your-writes.',
        '**DynamoDB**: reads are eventually consistent by default, and `ConsistentRead` is a per-request flag that costs twice the read capacity. **Cassandra**: you choose per query, from `ONE` to `QUORUM` to `ALL`, and lightweight transactions add a consensus round for compare-and-set.',
      ],
      keyIdea: 'Most databases offer several rungs per request. Pick the cheapest one that removes the anomaly your feature cannot tolerate.',
      metrics: { model: 'per request', anomaly: 'depends on the rung', latency: '2 ms to 70+ ms', avail: 'trade per request' },
      scene: {
        nodes: [leader, repA, { ...ben, badge: 'feed: eventual' }, { ...cara, badge: 'balance: conditional update' }],
        links: [link('leader', 'repA', { style: 'dashed' }), link('ben', 'repA'), link('cara', 'leader')],
        flows: [
          { path: ['ben', 'repA', 'ben'], tone: 'response', label: 'cheap read', count: 3, duration: 1.4 },
          { path: ['cara', 'leader', 'cara'], tone: 'request', label: 'IF balance = 100', duration: 2.4, delay: 0.5 },
        ],
        panel: {
          title: 'Rung by system',
          icon: 'Database',
          rows: [
            { text: 'Postgres primary', value: 'strong', tone: 'good' },
            { text: 'DynamoDB default', value: 'eventual', tone: 'warn' },
            { text: 'DynamoDB ConsistentRead', value: 'strong', tone: 'good' },
            { text: 'Cassandra ONE', value: 'fast, may be stale', tone: 'warn' },
            { text: 'Cassandra QUORUM', value: 'overlap, not linearizable', tone: 'warn' },
            { text: 'Cassandra IF (LWT)', value: 'Paxos, linearizable', tone: 'good' },
          ],
        },
        caption: 'Same data, different rung per request',
      },
      code: {
        language: 'python',
        title: 'Choosing the rung per request (DynamoDB and Cassandra)',
        source: `# DynamoDB: default read may be stale; this one sees all acknowledged writes
item = table.get_item(Key={"user_id": "u42"}, ConsistentRead=True)

# Cassandra: the feed tolerates staleness, the balance check does not
from cassandra import ConsistencyLevel
from cassandra.query import SimpleStatement

feed = SimpleStatement("SELECT * FROM feed WHERE user_id = %s",
                       consistency_level=ConsistencyLevel.ONE)
session.execute(feed, [user_id])

# balance must not go below zero: QUORUM read-then-write can race, so compare-and-set
read = SimpleStatement("SELECT balance FROM wallets WHERE user_id = %s",
                       consistency_level=ConsistencyLevel.QUORUM)
old = session.execute(read, [user_id]).one().balance

debit = SimpleStatement(
    "UPDATE wallets SET balance = %s WHERE user_id = %s IF balance = %s",
    consistency_level=ConsistencyLevel.QUORUM,
    serial_consistency_level=ConsistencyLevel.SERIAL)
result = session.execute(debit, [old - 10, user_id, old])
if not result.was_applied:
    ...  # another debit won the race, re-read and retry`,
        highlight: [2, 18, 20, 21],
      },
    },
    {
      title: 'More databases',
      tag: 'tradeoff',
      heading: 'What MongoDB, etcd and ZooKeeper give you',
      eli5: 'Other schools follow the same idea. One lets each class choose how careful to be. Two others always send big questions to the main board.',
      body: [
        '**MongoDB**: causally consistent sessions, plus read and write concerns up to `linearizable` for single-document reads. **etcd**: writes go through consensus and reads are linearizable by default, with an opt-in cheaper stale read.',
        '**ZooKeeper**: writes are linearizable, reads are local and sequential unless you call `sync` first. "Strong" means different things to different vendors, so read the documentation for the exact wording.',
      ],
      keyIdea: 'Read each database\'s documentation for what "strong" means. Most let you pick the rung per operation, and that is the main design lever.',
      metrics: { model: 'per vendor', anomaly: 'read the docs', latency: '2 ms to 70+ ms', avail: 'trade per request' },
      scene: {
        nodes: [
          { ...leader, label: 'etcd leader', sub: 'consensus' },
          { ...repA, label: 'follower', sub: 'votes', status: 'ok' },
          { ...ben, badge: 'Mongo: causal session' },
          { ...cara, badge: 'etcd: linearizable' },
        ],
        links: [link('leader', 'repA', { style: 'dashed' }), link('ben', 'repA'), link('cara', 'leader')],
        flows: [
          { path: ['ben', 'repA', 'ben'], tone: 'response', label: 'causal read', duration: 1.5 },
          { path: ['cara', 'leader', 'cara'], tone: 'request', label: 'quorum read', duration: 2.4, delay: 0.5 },
        ],
        panel: {
          title: 'Strongest read offered',
          icon: 'Shield',
          rows: [
            { text: 'MongoDB', value: 'linearizable concern', tone: 'good' },
            { text: 'etcd', value: 'linearizable (default)', tone: 'good' },
            { text: 'ZooKeeper', value: 'sequential, sync for latest', tone: 'warn' },
          ],
        },
        caption: 'Read the docs for the exact wording',
      },
    },
    {
      title: 'Recap 2',
      tag: 'recap',
      heading: 'Each rung removes one anomaly and adds one cost',
      eli5: 'Old hallway boards are fine for lunch menus. For who gets the last locker, everyone checks the main board, even if the walk takes longer.',
      body: [
        '**Eventual** allows everything. The session rules stop your own edits vanishing and time running backwards. **Causal** keeps causes first and still answers in a partition. **Sequential** gives one order, possibly late. **Linearizable** behaves like one copy.',
        'Each climb costs round trips and partition availability. Feeds can be eventual, profile edits need read-your-writes, and usernames, locks and balances need linearizability.',
      ],
      keyIdea: 'Name the anomaly your feature cannot tolerate, then buy the cheapest rung that removes it.',
      metrics: { model: 'per operation', anomaly: 'chosen', latency: '2 ms to 70+ ms', avail: 'chosen' },
      scene: {
        nodes: [{ ...ana, status: 'ok' }, { ...leader, status: 'ok' }, { ...repA, status: 'ok' }, { ...repB, status: 'ok', sub: 'caught up' }, { ...ben, status: 'ok' }],
        links: [link('ana', 'leader'), link('leader', 'repA', { style: 'dashed' }), link('leader', 'repB', { style: 'dashed' }), link('ben', 'repA')],
        flows: [
          { path: ['ana', 'leader'], tone: 'request', duration: 1 },
          { path: ['leader', 'repA'], tone: 'data', duration: 0.9, delay: 1.1 },
          { path: ['leader', 'repB'], tone: 'data', duration: 1.1, delay: 1.1 },
          { path: ['repA', 'ben'], tone: 'response', duration: 0.9, delay: 2.3 },
        ],
        panel: {
          title: 'Pick per operation',
          icon: 'Layers',
          rows: [
            { text: 'Feeds, counters', value: 'eventual', tone: 'good' },
            { text: 'Profile edits', value: 'read-your-writes', tone: 'good' },
            { text: 'Chat threads', value: 'causal', tone: 'good' },
            { text: 'Usernames, locks, balances', value: 'linearizable', tone: 'warn' },
          ],
        },
      },
      quiz: {
        question: 'Ana finishes saving a new meeting time, then calls Cara, who reads the old time from a replica. Which is the weakest model that forbids this?',
        options: ['Causal consistency', 'Sequential consistency', 'Monotonic reads', 'Linearizability'],
        answer: 3,
        explain: 'The write completed before Cara\'s read started, in real time. Only linearizability ties ordering to real time. Sequential and causal allow Cara\'s replica to be behind because the phone call is outside the system.',
      },
    },
  ],
};
