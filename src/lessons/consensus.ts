import type { Lesson, SceneNode } from '../engine/types';

// Five voters in a zigzag row across the screen (x - y steps by 2.2), client on the left.
const client: SceneNode = { id: 'client', kind: 'client', at: [-2.7, 2.7], label: 'app' };
const a: SceneNode = { id: 'a', kind: 'server', at: [-1.1, 1.7], label: 'node A', sub: 'follower' };
const b: SceneNode = { id: 'b', kind: 'server', at: [-0.9, -0.3], label: 'node B', sub: 'follower' };
const c: SceneNode = { id: 'c', kind: 'server', at: [1.1, -0.5], label: 'node C', sub: 'follower' };
const d: SceneNode = { id: 'd', kind: 'server', at: [1.3, -2.5], label: 'node D', sub: 'follower' };
const e: SceneNode = { id: 'e', kind: 'server', at: [3.3, -2.7], label: 'node E', sub: 'follower' };
const client2: SceneNode = { id: 'client2', kind: 'client', at: [3.6, -4.6], label: 'app 2' };
const dbPrimary: SceneNode = { id: 'dbp', kind: 'db', at: [2.3, 2.9], label: 'db-2', sub: 'primary' };
const dbReplica: SceneNode = { id: 'dbr', kind: 'replica', at: [4.5, 0.7], label: 'db-1', sub: 'replica' };

const fromA = [
  { from: 'client', to: 'a' },
  { from: 'a', to: 'b', style: 'dashed' as const },
  { from: 'a', to: 'c', style: 'dashed' as const },
  { from: 'a', to: 'd', style: 'dashed' as const },
  { from: 'a', to: 'e', style: 'dashed' as const },
];

const fromB = [
  { from: 'client', to: 'b' },
  { from: 'b', to: 'a', style: 'dashed' as const },
  { from: 'b', to: 'c', style: 'dashed' as const },
  { from: 'b', to: 'd', style: 'dashed' as const },
  { from: 'b', to: 'e', style: 'dashed' as const },
];

export const consensus: Lesson = {
  id: 'consensus',
  title: 'Consensus and leader election (Raft)',
  tagline: 'How a handful of machines agree on one leader and one history, even when some of them crash or get cut off.',
  minutes: 18,
  level: 'Advanced',
  learn: [
    'Why "who is the leader?" needs a majority vote, and why any two majorities overlap',
    'Terms, election timeouts and votes: how Raft picks exactly one leader',
    'How a log entry is replicated and when it counts as committed',
    'What happens when the leader crashes, and when a partition strands it in the minority',
    'Where consensus is used (etcd, ZooKeeper, metadata stores) and what it costs',
  ],
  metrics: [
    { key: 'nodes', label: 'Voters up' },
    { key: 'quorum', label: 'Majority' },
    { key: 'term', label: 'Term' },
    { key: 'leader', label: 'Leader' },
    { key: 'commit', label: 'Committed entries' },
  ],
  steps: [
    {
      title: 'Two leaders',
      tag: 'problem',
      heading: 'Two machines both believe they are in charge',
      eli5: 'Three kids run a tree house club. Two of them each shout "I am the captain!" and give different orders. Nobody knows whose orders count.',
      body: [
        'The replication lesson ended with a warning: failover is only safe if exactly one node is the primary. Something has to decide who that is. If that something is one machine, it is a single point of failure. If it is two machines, they can disagree.',
        'Here the link between node A and node C drops for 12 seconds. Each one stops hearing the other, assumes it died, and promotes itself. The app writes `max_connections = 200` to A. Another caller writes `max_connections = 50` to C. Both writes are acknowledged.',
        'A timeout cannot tell a dead node from a slow network, so no node can decide alone that it is the leader. The nodes need a rule that lets them **agree**, and that keeps working when some of them are down or unreachable. That rule is called **consensus**.',
      ],
      keyIdea: 'Silence does not prove a node is dead. Any scheme where one node decides by itself can produce two leaders.',
      metrics: { nodes: '3', quorum: 'not used', term: '-', leader: 'A and C', commit: 'two histories' },
      scene: {
        nodes: [
          { ...client, status: 'hot', badge: '200 or 50?' },
          { ...a, sub: 'thinks: leader', status: 'hot', badge: 'value = 200' },
          { ...b, sub: 'confused', status: 'dim' },
          { ...c, sub: 'thinks: leader', status: 'hot', badge: 'value = 50' },
        ],
        links: [
          { from: 'client', to: 'a' },
          { from: 'a', to: 'b', style: 'dashed' },
          { from: 'b', to: 'c', style: 'dashed' },
        ],
        flows: [
          { path: ['client', 'a'], tone: 'request', label: 'set 200', duration: 1.2 },
          { path: ['a', 'b'], tone: 'data', label: 'I lead', duration: 1, delay: 1.3 },
          { path: ['c', 'b'], tone: 'error', label: 'no, I lead', duration: 1, delay: 1.3 },
        ],
        caption: 'Both writes were acknowledged',
      },
    },
    {
      title: 'Majority',
      tag: 'concept',
      heading: 'Nothing counts until more than half agree',
      eli5: 'The club grows to five kids and makes one rule: nothing is decided unless three of the five say yes. Two groups of three always share a kid, so two opposite decisions can never both pass.',
      body: [
        'Run an odd number of nodes, here **5**, and require a **majority** (a **quorum**) for every decision: 3 of 5. That covers electing a leader and accepting a write.',
        'The whole design rests on one fact. Any two groups of 3 picked from 5 share at least one node. That shared node has seen the earlier decision and will refuse to contradict it. Two leaders in the same round would need 3 votes each, which means 6 votes from 5 nodes.',
        'A cluster of N nodes survives `floor((N - 1) / 2)` failures: 3 nodes survive 1, 5 survive 2, 7 survive 3. Four nodes need 3 for a majority and still survive only 1, so even sizes add cost and no safety.',
      ],
      keyIdea: 'Two majorities always overlap in at least one node. That overlap is what stops two conflicting decisions.',
      metrics: { nodes: '5 of 5', quorum: '3', term: '-', leader: 'none yet', commit: '0' },
      scene: {
        nodes: [
          client,
          { ...a, sub: 'voter', status: 'active', badge: 'group 1' },
          { ...b, sub: 'voter', status: 'active', badge: 'group 1' },
          { ...c, sub: 'voter', status: 'ok', badge: 'in both' },
          { ...d, sub: 'voter', badge: 'group 2' },
          { ...e, sub: 'voter', badge: 'group 2' },
        ],
        links: [
          { from: 'a', to: 'b', style: 'dashed' },
          { from: 'b', to: 'c', style: 'dashed' },
          { from: 'c', to: 'd', style: 'dashed' },
          { from: 'd', to: 'e', style: 'dashed' },
        ],
        flows: [
          { path: ['a', 'b', 'c'], tone: 'handshake', label: '3 of 5', duration: 1.6 },
          { path: ['e', 'd', 'c'], tone: 'handshake', label: '3 of 5', duration: 1.6, delay: 1.8 },
        ],
        caption: 'Any two majorities share a node',
      },
    },
    {
      title: 'Terms',
      tag: 'concept',
      heading: 'Raft: one leader per term, kept alive by heartbeats',
      eli5: 'The club counts its captains: captain number 1, then number 2, and so on. The captain calls "still here!" every few seconds. Each kid has one vote per captain number.',
      body: [
        '**Raft** is the consensus algorithm most systems use today, because it was designed to be understandable. Every node is in one of three roles: **follower**, **candidate** or **leader**. All writes go through the leader.',
        'Time is cut into numbered **terms**. A term starts with an election and has at most one leader. Each node votes at most once per term, so with the majority rule two leaders in one term are impossible. Every message carries the sender\'s term, and a node that sees a higher term than its own steps down to follower at once.',
        'The leader sends a **heartbeat** to every follower, here every 50 ms. Each follower runs an **election timeout** picked at random between 150 and 300 ms, and resets it on every heartbeat. A follower only acts when its timer runs out.',
      ],
      keyIdea: 'A term is a numbered reign with at most one leader. A higher term always wins, so stale leaders demote themselves.',
      metrics: { nodes: '5 of 5', quorum: '3', term: '1', leader: 'A', commit: '0' },
      scene: {
        nodes: [
          client,
          { ...a, sub: 'leader', status: 'active', badge: 'term 1' },
          { ...b, badge: 'timer 210 ms' },
          { ...c, badge: 'timer 280 ms' },
          { ...d, badge: 'timer 190 ms' },
          { ...e, badge: 'timer 250 ms' },
        ],
        links: fromA,
        flows: [
          { path: ['a', 'b'], tone: 'handshake', label: 'heartbeat', duration: 0.8 },
          { path: ['a', 'c'], tone: 'handshake', duration: 0.9 },
          { path: ['a', 'd'], tone: 'handshake', duration: 1 },
          { path: ['a', 'e'], tone: 'handshake', duration: 1.1 },
        ],
        caption: 'Heartbeat every 50 ms resets every timer',
      },
    },
    {
      title: 'Log',
      tag: 'concept',
      heading: 'A write is committed once a majority has stored it',
      eli5: 'Every kid keeps a copy of the club rule book. The captain writes a new rule, the others copy it down, and once three books have it the rule is official.',
      body: [
        'Each node keeps a **log**: a numbered list of commands. The app sends `set max_connections = 200` to leader A. A appends it as entry 1 (tagged with term 1) and sends it to all followers in an `AppendEntries` message. Heartbeats are the same message with no entries.',
        'Each follower writes the entry to disk and acknowledges. Once the entry is on a **majority**, the leader counting itself, it is **committed**. A needs only two acks: A, B and C make 3 of 5. Then A applies the command and answers the app. D and E catch up a moment later, and a slow or dead minority never blocks a write.',
        'A committed entry is permanent. Every node applies the same commands in the same order, so every node ends in the same state. This is called a **replicated state machine**.',
      ],
      keyIdea: 'Committed means stored on a majority. The leader answers the client only after that point.',
      metrics: { nodes: '5 of 5', quorum: '3', term: '1', leader: 'A', commit: '1' },
      scene: {
        nodes: [
          { ...client, status: 'ok', badge: 'OK' },
          { ...a, sub: 'leader', status: 'active', badge: 'log: 1 ✓' },
          { ...b, status: 'ok', badge: 'log: 1' },
          { ...c, status: 'ok', badge: 'log: 1' },
          { ...d, badge: 'log: 1 (late)' },
          { ...e, badge: 'log: 1 (late)' },
        ],
        links: fromA,
        flows: [
          { path: ['client', 'a'], tone: 'request', label: 'set 200', duration: 1 },
          { path: ['a', 'b'], tone: 'data', label: 'entry 1', duration: 0.9, delay: 1.1 },
          { path: ['a', 'c'], tone: 'data', duration: 1, delay: 1.1 },
          { path: ['a', 'd'], tone: 'data', duration: 2.2, delay: 1.1 },
          { path: ['a', 'e'], tone: 'data', duration: 2.4, delay: 1.1 },
          { path: ['b', 'a'], tone: 'handshake', label: 'ack', duration: 0.8, delay: 2.2 },
          { path: ['c', 'a'], tone: 'handshake', label: 'ack', duration: 0.8, delay: 2.2 },
          { path: ['a', 'client'], tone: 'response', label: 'committed', duration: 1, delay: 3.1 },
        ],
        caption: 'A + B + C = 3 of 5: committed',
      },
      code: {
        language: 'python',
        title: 'The leader advances its commit index',
        source: `def on_append_ack(self, follower, match_index):
    # match_index: highest log entry known to be stored on that follower
    self.match_index[follower] = match_index
    self.match_index[self.id] = len(self.log)       # the leader counts itself

    majority = len(self.peers) // 2 + 1             # 5 nodes -> 3
    # the highest index that at least 'majority' nodes have stored
    n = sorted(self.match_index.values(), reverse=True)[majority - 1]

    # only commit by counting copies for entries from the current term
    if n > self.commit_index and self.log[n - 1].term == self.current_term:
        self.commit_index = n
        self.apply_and_reply_up_to(n)               # now answer the client`,
        highlight: [6, 8, 11, 12],
      },
    },
    {
      title: 'Leader crash',
      tag: 'case',
      heading: 'Case: the leader dies and a new one is elected',
      eli5: 'The captain goes home sick and the calls of "still here!" stop. The first kid to notice says "I will be captain number 2, who votes for me?" Three yes votes and the job is theirs.',
      body: [
        'Node A loses power. The heartbeats stop. B has the shortest timer and runs out first, about 150 ms later. B becomes a **candidate**: it raises its term to 2, votes for itself, and sends `RequestVote` to everyone.',
        'C and D have not voted in term 2, so they grant their vote. With its own vote B has 3 of 5, a majority of the full cluster (the dead node still counts in the 5). B becomes leader for term 2 and starts sending heartbeats, which stops any other timer from firing.',
        'The random timers matter. If two followers time out together they can split the vote, and nobody reaches 3. That term ends with no leader, each waits a new random timeout, and one of them almost always goes first on the retry. The cluster is without a leader for a few hundred milliseconds, and writes wait during that gap.',
      ],
      keyIdea: 'No heartbeat, timer fires, ask for votes, win a majority. Random timeouts keep two candidates from colliding forever.',
      metrics: { nodes: '4 of 5', quorum: '3', term: '2', leader: 'B (new)', commit: '1' },
      scene: {
        nodes: [
          client,
          { ...a, sub: 'crashed', status: 'down', badge: 'power lost' },
          { ...b, sub: 'leader', status: 'ok', badge: 'term 2: 3 votes' },
          { ...c, badge: 'voted B' },
          { ...d, badge: 'voted B' },
          { ...e, badge: 'voted B' },
        ],
        links: fromB,
        flows: [
          { path: ['b', 'c'], tone: 'event', label: 'vote for me?', duration: 0.9 },
          { path: ['b', 'd'], tone: 'event', duration: 1 },
          { path: ['b', 'e'], tone: 'event', duration: 1.1 },
          { path: ['b', 'a'], tone: 'error', duration: 1 },
          { path: ['c', 'b'], tone: 'handshake', label: 'yes', duration: 0.9, delay: 1.2 },
          { path: ['d', 'b'], tone: 'handshake', label: 'yes', duration: 1, delay: 1.2 },
          { path: ['b', 'e'], tone: 'handshake', label: 'heartbeat', duration: 1, delay: 2.6 },
          { path: ['b', 'c'], tone: 'handshake', duration: 0.9, delay: 2.6 },
        ],
        caption: 'About 300 ms without a leader',
      },
      quiz: {
        question: 'A 5-node Raft cluster has lost 2 nodes. A third node now crashes. What can the remaining 2 nodes do?',
        options: [
          'Elect a leader between them, because 2 of the 2 live nodes agree',
          'Keep accepting writes and reconcile when the others return',
          'Nothing that needs a commit: they cannot elect a leader or commit writes until a third node returns',
          'Shrink the cluster to 2 nodes automatically and carry on',
        ],
        answer: 2,
        explain: 'A majority is counted against the full membership of 5, so it stays 3. Two nodes cannot tell "three nodes died" from "we are the cut-off side of a partition", so they must stop. That refusal is what prevents two leaders.',
      },
    },
    {
      title: 'Vote rule',
      tag: 'concept',
      heading: 'A node with a stale log cannot win',
      eli5: 'A kid who missed the last club meeting asks to be captain. The others look at that kid\'s rule book, see a rule is missing, and say no. Only a kid with a complete book can lead.',
      body: [
        'Suppose E was slow and never received entry 1. If E became leader it would overwrite a committed write. Raft blocks this with one check in the vote handler: a node only votes for a candidate whose log is **at least as up to date** as its own. Compare the term of the last entry first, then the log length.',
        'Entry 1 is committed, so it sits on at least 3 nodes. E needs 3 votes, so at least one voter it asks holds entry 1, and that voter refuses. The overlap of majorities guarantees every elected leader already has every committed entry.',
        'Uncommitted entries have no such protection. If the old leader accepted a write but crashed before a majority stored it, the new leader may never have seen it, and it is discarded. The client never got an answer for that write, so it must retry. Make those retries idempotent.',
      ],
      keyIdea: 'Voters refuse candidates with older logs, so a new leader always holds every committed entry. Uncommitted entries can be lost, and the client was never told they succeeded.',
      metrics: { nodes: '4 of 5', quorum: '3', term: '2', leader: 'B', commit: '1' },
      scene: {
        nodes: [
          client,
          { ...a, sub: 'crashed', status: 'down' },
          { ...b, status: 'ok', badge: 'log: 1' },
          { ...c, status: 'ok', badge: 'log: 1' },
          { ...d, status: 'ok', badge: 'log: 1' },
          { ...e, sub: 'candidate', status: 'hot', badge: 'log: empty' },
        ],
        links: [
          { from: 'e', to: 'b', style: 'dashed' },
          { from: 'e', to: 'c', style: 'dashed' },
          { from: 'e', to: 'd', style: 'dashed' },
        ],
        flows: [
          { path: ['e', 'd'], tone: 'event', label: 'vote for me?', duration: 0.9 },
          { path: ['e', 'c'], tone: 'event', duration: 1 },
          { path: ['e', 'b'], tone: 'event', duration: 1.1 },
          { path: ['d', 'e'], tone: 'error', label: 'no: log behind', duration: 0.9, delay: 1.3 },
          { path: ['c', 'e'], tone: 'error', duration: 1, delay: 1.3 },
          { path: ['b', 'e'], tone: 'error', duration: 1.1, delay: 1.3 },
        ],
        caption: 'What if lagging E had timed out first?',
      },
      code: {
        language: 'python',
        title: 'RequestVote handler on every node',
        source: `def on_request_vote(self, term, candidate, last_log_term, last_log_index):
    if term < self.current_term:
        return self.current_term, False             # stale candidate
    if term > self.current_term:
        self.current_term, self.voted_for = term, None
        self.role = "follower"                      # higher term: step down

    my_last_term = self.log[-1].term if self.log else 0
    log_ok = (last_log_term, last_log_index) >= (my_last_term, len(self.log))

    if log_ok and self.voted_for in (None, candidate):
        self.voted_for = candidate                  # one vote per term
        self.persist()                              # fsync before replying
        self.reset_election_timer()
        return self.current_term, True
    return self.current_term, False`,
        highlight: [9, 11, 12, 13],
      },
    },
    {
      title: 'Partition',
      tag: 'case',
      heading: 'Case: the leader is stranded in the minority',
      eli5: 'A locked door splits the club: the captain and one kid on one side, three kids on the other. The captain cannot collect three yes votes any more. The three pick captain number 3 and carry on.',
      body: [
        'A is back as a follower. Then a switch fails and splits the cluster: leader B and node A on one side, C, D and E on the other. B does not know it is cut off and still accepts `set max_connections = 50` as entry 2. It reaches only A. Two copies are short of 3, so the entry never commits and the app gets a timeout, never an OK.',
        'On the other side, heartbeats from B stop. D times out, starts term 3, and wins with votes from C and E. App 2 writes `set max_connections = 300`. It lands on D, C and E: 3 of 5, committed.',
        'When the switch is fixed, B receives a heartbeat carrying term 3, sees its own term 2 is old, and steps down. Its uncommitted entry 2 conflicts with the committed one and is deleted, then A and B copy the real entry 2 from D. Exactly one history survives. During the split the minority side refused work: that is the **C over A** choice from the CAP lesson.',
      ],
      keyIdea: 'A leader without a majority can accept writes but cannot commit them. Only the majority side makes progress, so there is never a second history.',
      metrics: { nodes: '2 + 3', quorum: '3', term: '3', leader: 'D (B is stale)', commit: '2' },
      scene: {
        zones: [
          { id: 'minor', from: [-1.7, -0.9], to: [-0.3, 2.3], label: 'minority: 2 of 5', tone: 'red' },
          { id: 'major', from: [0.5, -3.3], to: [3.9, 0.1], label: 'majority: 3 of 5', tone: 'green' },
        ],
        nodes: [
          { ...client, status: 'hot', badge: 'timeout' },
          { ...a, badge: 'term 2' },
          { ...b, sub: 'stale leader', status: 'hot', badge: '2 of 5: stuck' },
          { ...c, status: 'ok', badge: 'term 3' },
          { ...d, sub: 'leader', status: 'ok', badge: '3 of 5: commit' },
          { ...e, status: 'ok', badge: 'term 3' },
          client2,
        ],
        links: [
          { from: 'client', to: 'b' },
          { from: 'b', to: 'a', style: 'dashed' },
          { from: 'b', to: 'c', style: 'faint', label: 'cut' },
          { from: 'client2', to: 'd' },
          { from: 'd', to: 'c', style: 'dashed' },
          { from: 'd', to: 'e', style: 'dashed' },
        ],
        flows: [
          { path: ['client', 'b'], tone: 'request', label: 'set 50', duration: 1.2 },
          { path: ['b', 'a'], tone: 'data', duration: 0.9, delay: 1.3 },
          { path: ['b', 'c'], tone: 'error', label: 'unreachable', duration: 1.2, delay: 1.3 },
          { path: ['client2', 'd'], tone: 'request', label: 'set 300', duration: 1, delay: 0.4 },
          { path: ['d', 'c'], tone: 'data', duration: 0.8, delay: 1.5 },
          { path: ['d', 'e'], tone: 'data', duration: 0.8, delay: 1.5 },
          { path: ['d', 'client2'], tone: 'response', label: 'committed', duration: 1, delay: 2.5 },
        ],
        caption: 'Only the side with 3 nodes can commit',
      },
    },
    {
      title: 'Costs',
      tag: 'tradeoff',
      heading: 'What agreement costs you',
      eli5: 'Asking three kids before every decision is safe but slow. So the club votes only on the big things, like who is captain. Nobody votes on every single cookie.',
      body: [
        '**Latency.** Every write waits for a disk flush on a majority and a network round trip to the second-fastest follower. In one datacenter that is a few milliseconds. Spread the 5 nodes over three regions and every write pays a cross-region round trip.',
        '**Throughput and size.** All writes go through one leader, and every node stores everything. More voters make writes slower, because the majority gets bigger. Clusters are 3 or 5 nodes, rarely 7, and they hold megabytes or a few gigabytes of small, important data.',
        '**Reads need care too.** A stale leader like B in the last step does not know it has been replaced. If it answers reads from local state it can return old data. For a linearizable read the leader first confirms it still leads, with a heartbeat round to a majority or a time-bound lease. Reads from followers are faster and may be stale.',
      ],
      keyIdea: 'Consensus buys one agreed history at the price of a majority round trip per write. Use it for small, critical state.',
      metrics: { nodes: '5 of 5', quorum: '3', term: '3', leader: 'D', commit: '2' },
      scene: {
        nodes: [
          client,
          { ...a, badge: 'ack 2 ms' },
          { ...b, badge: 'ack 2 ms' },
          { ...c, badge: 'ack 1 ms' },
          { ...d, sub: 'leader', status: 'active', badge: 'fsync + wait for 2' },
          { ...e, status: 'dim', badge: 'ack 40 ms (slow)' },
          client2,
        ],
        links: [
          { from: 'client2', to: 'd' },
          { from: 'd', to: 'a', style: 'dashed' },
          { from: 'd', to: 'b', style: 'dashed' },
          { from: 'd', to: 'c', style: 'dashed' },
          { from: 'd', to: 'e', style: 'dashed' },
        ],
        flows: [
          { path: ['client2', 'd'], tone: 'request', label: 'write', duration: 1 },
          { path: ['d', 'c', 'd'], tone: 'data', label: '1 ms', duration: 1, delay: 1.1 },
          { path: ['d', 'b', 'd'], tone: 'data', label: '2 ms', duration: 1.5, delay: 1.1 },
          { path: ['d', 'e', 'd'], tone: 'data', duration: 3.4, delay: 1.1 },
          { path: ['d', 'client2'], tone: 'response', label: 'committed', duration: 1, delay: 2.7 },
        ],
        caption: 'Commit time = the second-fastest follower',
      },
    },
    {
      title: 'In practice',
      tag: 'case',
      heading: 'Where you meet consensus: the small cluster that decides',
      eli5: 'The club does not carry the toys. It keeps one small notice board that says who is captain today. Everyone else reads the board and gets on with the work.',
      body: [
        'You rarely implement Raft. You run a system that contains it. **etcd** (Raft) stores all cluster state for Kubernetes. **ZooKeeper** uses ZAB, a close cousin, and has long coordinated systems such as HBase and older Kafka versions. **Consul** uses Raft. Newer Kafka versions keep their metadata in a built-in Raft quorum.',
        'The usual pattern is a small consensus cluster for **metadata** beside a large data plane. The consensus cluster answers the questions that must have one answer: which database node is primary, which shard lives on which machine, who holds a lock, what the current config is. Terabytes of user data move by ordinary replication under the leader it names.',
        'Some databases go further and run one Raft group per shard, so every range of keys has its own leader and log (CockroachDB and TiKV work this way). The failover manager from the replication lesson fits here too: Patroni keeps its leader key in etcd, so the majority vote happens there.',
      ],
      keyIdea: 'Put the few facts that must never disagree in a consensus store, and let the rest of the system follow them.',
      metrics: { nodes: '5 of 5', quorum: '3', term: '3', leader: 'D', commit: '3' },
      scene: {
        zones: [{ id: 'etcd', from: [-1.7, -3.3], to: [3.9, 2.3], label: 'etcd: 5 voters', tone: 'violet' }],
        nodes: [
          client,
          { ...a, label: 'etcd A' },
          { ...b, label: 'etcd B' },
          { ...c, label: 'etcd C' },
          { ...d, label: 'etcd D', sub: 'leader', status: 'active', badge: '/db/leader = db-2' },
          { ...e, label: 'etcd E' },
          { ...dbPrimary, status: 'ok', badge: 'holds the key' },
          dbReplica,
        ],
        links: [
          { from: 'dbp', to: 'c' },
          { from: 'client', to: 'a', style: 'faint' },
          { from: 'client', to: 'dbp' },
          { from: 'dbp', to: 'dbr', style: 'dashed' },
        ],
        flows: [
          { path: ['dbp', 'c'], tone: 'handshake', label: 'renew lease', duration: 1.2 },
          { path: ['client', 'a'], tone: 'request', label: 'who is primary?', duration: 1.2, delay: 0.6 },
          { path: ['a', 'client'], tone: 'response', label: 'db-2', duration: 1.2, delay: 1.9 },
          { path: ['client', 'dbp'], tone: 'request', label: 'writes', duration: 1.4, delay: 3.2 },
          { path: ['dbp', 'dbr'], tone: 'data', duration: 1.2, delay: 4.7 },
        ],
        caption: 'Small agreed facts steer a big data plane',
      },
      code: {
        language: 'bash',
        title: 'A leader key in etcd that expires if its holder dies',
        source: `# a lease is a timer the holder must keep renewing
etcdctl lease grant 10
# lease 694d81a2b3c4d5e6 granted with TTL(10s)

# the key lives only as long as the lease
etcdctl put /shop/db/leader db-2 --lease=694d81a2b3c4d5e6
etcdctl lease keep-alive 694d81a2b3c4d5e6

# anyone can ask; the answer went through Raft
etcdctl get /shop/db/leader

# cluster view: which member leads, and its Raft term
etcdctl endpoint status --cluster -w table`,
        highlight: [2, 6, 10],
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'One leader, one log, decided by a majority',
      eli5: 'Five kids, one captain at a time, and nothing is official until three rule books have it. If the captain vanishes, three votes pick the next one. Two kids alone must wait.',
      body: [
        'A node cannot tell a dead peer from a slow network, so no node decides alone. Raft requires a **majority** for elections and for commits, and two majorities always overlap. **Terms** number the leaders, each node votes once per term, and a higher term demotes a stale leader.',
        'The leader appends to its **log**, replicates, and commits once a majority has stored the entry. When heartbeats stop, a random **election timeout** fires and a candidate with an up-to-date log wins. A minority can never elect or commit, so a partition costs availability on one side and never creates two histories.',
        'The next lesson uses this directly: a distributed lock is a key in a consensus store, and its fencing token is a number that only goes up, much like a term.',
      ],
      keyIdea: 'Majority overlap plus terms gives one history. N nodes survive (N - 1) / 2 failures, and the minority side always stops.',
      metrics: { nodes: '5 of 5', quorum: '3', term: '3', leader: 'D', commit: '3' },
      scene: {
        nodes: [
          { ...client, status: 'ok' },
          { ...a, status: 'ok', badge: 'log: 3' },
          { ...b, status: 'ok', badge: 'log: 3' },
          { ...c, status: 'ok', badge: 'log: 3' },
          { ...d, sub: 'leader', status: 'active', badge: 'term 3' },
          { ...e, status: 'ok', badge: 'log: 3' },
        ],
        links: [
          { from: 'client', to: 'd' },
          { from: 'd', to: 'a', style: 'dashed' },
          { from: 'd', to: 'b', style: 'dashed' },
          { from: 'd', to: 'c', style: 'dashed' },
          { from: 'd', to: 'e', style: 'dashed' },
        ],
        flows: [
          { path: ['client', 'd'], tone: 'request', label: 'write', duration: 1.4 },
          { path: ['d', 'a'], tone: 'data', duration: 1.2, delay: 1.5 },
          { path: ['d', 'b'], tone: 'data', duration: 1, delay: 1.5 },
          { path: ['d', 'c'], tone: 'data', duration: 0.8, delay: 1.5 },
          { path: ['d', 'e'], tone: 'data', duration: 0.9, delay: 1.5 },
          { path: ['d', 'client'], tone: 'response', label: 'committed', duration: 1.4, delay: 2.8 },
        ],
      },
      quiz: {
        question: 'A leader in term 4 accepts a write, replicates it to 1 of its 4 followers, then gets partitioned away with that follower. The other 3 nodes elect a leader in term 5. What happens to the write?',
        options: [
          'It is committed, because the old leader accepted it',
          'It was never committed (2 of 5 copies), the client got no success reply, and it is discarded when the old leader rejoins',
          'Both leaders keep their own version and an operator merges them',
          'The term 5 leader fetches it from the old leader during the partition',
        ],
        answer: 1,
        explain: 'Commit needs 3 of 5 copies and this entry has 2. The old leader cannot answer the client with success. When it sees term 5 it steps down and its conflicting uncommitted entry is overwritten by the new leader\'s log.',
      },
    },
  ],
};
