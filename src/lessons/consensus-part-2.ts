import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

// The same five voters as part 1 (d steps by 3.2), the apps sit above the outer two.
const voter = (id: string, label: string, d: number, s: number): SceneNode => ({
  id,
  kind: 'server',
  at: at(d, s),
  label,
  sub: 'follower',
  tint: 'blue',
});
const a = voter('a', 'node A', -6.4, 2.4);
const b = voter('b', 'node B', -3.2, 0);
const c = voter('c', 'node C', 0, 2.4);
const d = voter('d', 'node D', 3.2, 0);
const e = voter('e', 'node E', 6.4, 2.4);
const client: SceneNode = { id: 'client', kind: 'client', at: at(-6.4, -5.4), label: 'app' };
const client2: SceneNode = { id: 'client2', kind: 'client', at: at(6.4, -5.4), label: 'app 2' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });
const dash = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, style: 'dashed', ...extra });

export const consensusPart2: Lesson = {
  id: 'consensus-part-2',
  title: 'Consensus and leader election (part 2)',
  tagline: 'Log repair, safe reads, what agreement costs, changing members, and where you meet consensus in real systems.',
  minutes: 17,
  level: 'Advanced',
  learn: [
    'How a leader repairs a follower whose log has diverged, and the commit rule for old entries',
    'Why nodes write to disk before replying, and how leaders serve linearizable reads',
    'What a majority costs in latency, throughput and placement across zones',
    'How membership changes, snapshots and pre-vote keep a long-running cluster healthy',
    'Raft, Paxos and ZAB, crash faults versus Byzantine faults',
    'Where consensus shows up (etcd, ZooKeeper, per-shard groups) and when not to use it',
  ],
  metrics: [
    { key: 'nodes', label: 'Voters up', icon: 'Server' },
    { key: 'term', label: 'Term', icon: 'Hash' },
    { key: 'leader', label: 'Leader', icon: 'Key' },
    { key: 'latency', label: 'Write latency', icon: 'Timer' },
  ],
  steps: [
    {
      title: 'Log repair',
      tag: 'concept',
      heading: 'The leader repairs a follower whose log has diverged',
      eli5: 'A kid\'s rule book has a rule the new captain never wrote. The captain asks "what is your last rule?", steps back until the books agree, and then makes the kid copy everything after that.',
      body: [
        'After a crash or a partition a follower\'s log can differ from the leader\'s. Each `AppendEntries` carries the index and term of the entry just before the new ones. The follower rejects the message if its own log does not match there.',
        'The leader steps back one entry at a time until the logs agree, then overwrites everything after that point. This gives the **log matching** property: the same index and term means identical logs up to there.',
      ],
      keyIdea: 'The leader makes every follower\'s log a copy of its own, starting from the last point where they agree.',
      metrics: { nodes: '5 of 5', term: '3', leader: 'D', latency: '-' },
      scene: {
        nodes: [
          { ...d, sub: 'leader', status: 'active', tint: 'green', chips: ['log: 1, 2, 3'] },
          { ...b, status: 'hot', chips: [{ text: 'log: 1, 2 (old)', tone: 'bad' }] },
          { ...a, status: 'ok', chips: ['log: 1'] },
        ],
        links: [dash('d', 'b'), dash('d', 'a')],
        flows: [
          { path: ['d', 'b'], tone: 'data', label: 'prev: 2 term 3?', duration: 1.2 },
          { path: ['b', 'd'], tone: 'error', label: 'mismatch', duration: 1.2, delay: 1.4 },
          { path: ['d', 'b'], tone: 'data', label: 'prev: 1 ok, entries 2-3', duration: 1.4, delay: 2.8 },
          { path: ['d', 'a'], tone: 'data', label: 'entries 2-3', duration: 1.4, delay: 1 },
        ],
        panel: {
          title: 'Entries as index:term',
          icon: 'List',
          code: 'D  1:t1  2:t3  3:t3\nB  1:t1  2:t2        <- conflict\nA  1:t1\n\nB drops 2:t2, copies 2:t3 3:t3',
          footer: { text: 'Same index and term means same prefix', tone: 'muted' },
        },
        caption: 'Back up one entry until the logs agree',
      },
      code: {
        language: 'python',
        title: 'AppendEntries handler on a follower',
        source: `def on_append_entries(self, term, prev_index, prev_term, entries, leader_commit):
    if term < self.current_term:
        return self.current_term, False             # stale leader
    self.role, self.current_term = "follower", term
    self.reset_election_timer()

    # the entry before the new ones must match, or the leader backs up
    if prev_index > 0 and (len(self.log) < prev_index or self.log[prev_index - 1].term != prev_term):
        return self.current_term, False

    # truncate only on a real conflict: a delayed or duplicate RPC must not wipe entries
    for i, entry in enumerate(entries):
        idx = prev_index + i
        if idx < len(self.log) and self.log[idx].term != entry.term:
            del self.log[idx:]                      # conflict: drop it and all after
        if idx >= len(self.log):
            self.log.append(entry)
    self.persist()                                  # fsync before replying
    self.commit_index = max(self.commit_index, min(leader_commit, prev_index + len(entries)))
    return self.current_term, True`,
        highlight: [7, 8, 12, 14, 15, 19],
      },
    },
    {
      title: 'Old entries',
      tag: 'concept',
      heading: 'A leader commits by counting only its own term\'s entries',
      eli5: 'A new captain finds an old rule that three books already have. The captain does not trust the count yet. First the captain writes one new rule of their own. Once that is official, the old rule is official too.',
      body: [
        'A new leader may hold entries from earlier terms that already sit on a majority. It still does not count copies to commit them. It commits an entry from its own term, and everything before it commits along with it.',
        'In a corner case an old-term entry on a majority can still be overwritten by a later leader. Committing a current-term entry closes that hole. Real leaders append a small no-op entry as soon as they win, for this reason.',
      ],
      keyIdea: 'Copies of an old-term entry do not make it safe. A committed entry from the current term does.',
      metrics: { nodes: '5 of 5', term: '3', leader: 'D', latency: '-' },
      scene: {
        nodes: [
          { ...d, sub: 'leader', status: 'active', tint: 'green', chips: [{ text: 'new entry: 3:t3 no-op', tone: 'good' }] },
          { ...c, status: 'ok', chips: ['log: 2:t2'] },
          { ...e, status: 'ok', chips: ['log: 2:t2'] },
        ],
        links: [dash('d', 'c'), dash('d', 'e')],
        flows: [
          { path: ['d', 'c'], tone: 'data', label: 'no-op 3:t3', duration: 1 },
          { path: ['d', 'e'], tone: 'data', duration: 1.2 },
          { path: ['c', 'd'], tone: 'handshake', label: 'ack', duration: 1, delay: 1.3 },
          { path: ['e', 'd'], tone: 'handshake', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'When is entry 2 (term 2) committed?',
          icon: 'Scale',
          rows: [
            { text: '2:t2 from an earlier leader (hypothetical), on 3 of 5', value: 'not enough alone', tone: 'warn' },
            { text: 'Hazard: a leader lacking 2:t2 can overwrite it', value: 'still possible', tone: 'bad' },
            { text: 'No-op 3:t3 on 3 of 5', value: 'commit', tone: 'good' },
            { text: 'Entry 2 commits with it', value: 'yes', tone: 'good' },
          ],
        },
        caption: 'A current-term entry carries the old ones with it',
      },
    },
    {
      title: 'Durable state',
      tag: 'concept',
      heading: 'Write to disk before you answer',
      eli5: 'Each kid writes the vote on paper before saying yes. If a kid forgot a vote after a nap, they could vote for two captains with the same number.',
      body: [
        'A node must persist its current term, its vote and its log before replying to any message. Otherwise a node that crashes and restarts forgets whom it voted for and can vote twice in the same term.',
        'A second vote could hand two candidates a majority in one term, and that means two leaders. This is why the vote handler calls fsync before it replies, and why a slow disk slows the whole cluster.',
      ],
      keyIdea: 'Term, vote and log are flushed to disk before the reply is sent.',
      metrics: { nodes: '5 of 5', term: '4', leader: 'none yet', latency: 'fsync 2 ms' },
      scene: {
        nodes: [
          { ...e, sub: 'rebooted', status: 'hot', chips: [{ text: 'vote forgotten?', tone: 'bad' }] },
          { ...d, sub: 'candidate', tint: 'amber', chips: ['term 4: asks E'] },
          { ...b, sub: 'candidate', tint: 'amber', chips: ['term 4: asks E'] },
        ],
        links: [dash('b', 'e', { route: 'straight' }), dash('d', 'e')],
        flows: [
          { path: ['b', 'e'], tone: 'event', label: 'vote term 4?', duration: 1.2 },
          { path: ['e', 'b'], tone: 'handshake', label: 'yes (first)', duration: 1.2, delay: 1.4 },
          { path: ['d', 'e'], tone: 'event', label: 'vote term 4?', duration: 1.2, delay: 2.8 },
          { path: ['e', 'd'], tone: 'error', label: 'yes again?!', duration: 1.2, delay: 4 },
        ],
        panel: {
          title: 'Saved before any reply',
          icon: 'HardDrive',
          rows: [
            { text: 'currentTerm', value: 'on disk', tone: 'good' },
            { text: 'votedFor', value: 'on disk', tone: 'good' },
            { text: 'log entries', value: 'on disk', tone: 'good' },
            { text: 'role, timers', value: 'memory only', tone: 'muted' },
          ],
          footer: { text: 'Without it, one term can have two leaders', tone: 'bad' },
        },
        caption: 'A forgotten vote could be given twice',
      },
    },
    {
      title: 'Stale reads',
      tag: 'case',
      heading: 'Case: a stale leader answers a read with old data',
      eli5: 'The old captain is locked behind a door and still thinks they are in charge. A kid asks "what is the rule?" and gets last week\'s answer, even though the real captain changed it.',
      body: [
        'A stale leader like B does not know it has been replaced. If it answers reads from its own state it returns 200 while the cluster has already committed 300.',
        'A client that wrote 300 and then reads 200 sees time go backwards. A **linearizable** read needs proof that the node answering is still the leader.',
      ],
      keyIdea: 'A leader that cannot reach a majority must not answer reads from local state.',
      metrics: { nodes: '2 + 3', term: '3', leader: 'D (B is stale)', latency: '-' },
      metricTones: { leader: 'warn' },
      scene: {
        nodes: [
          { ...client, status: 'hot', badge: 'reads 200?!' },
          { ...b, sub: 'stale leader', status: 'hot', tint: 'amber', chips: [{ text: 'value = 200', tone: 'bad' }] },
          { ...d, sub: 'leader', status: 'ok', tint: 'green', chips: [{ text: 'value = 300', tone: 'good' }] },
        ],
        links: [link('client', 'b', { arrow: 'both' }), link('b', 'd', { style: 'faint', route: 'straight', label: 'cut', labelTone: 'warn' })],
        flows: [
          { path: ['client', 'b'], tone: 'request', label: 'read', duration: 1.2 },
          { path: ['b', 'client'], tone: 'error', label: '200 (stale)', duration: 1.2, delay: 1.4 },
        ],
        panel: {
          title: 'Same key, two answers',
          icon: 'Table',
          rows: [
            { text: 'Node B (term 2)', value: '200', tone: 'bad' },
            { text: 'Node D (term 3)', value: '300', tone: 'good' },
          ],
          footer: { text: 'B does not know it was replaced', tone: 'warn' },
        },
        caption: 'The app wrote 300 and now reads 200',
      },
    },
    {
      title: 'Safe reads',
      tag: 'tradeoff',
      heading: 'Ways to read without going stale',
      eli5: 'Before answering, the captain can ask three kids "am I still captain?". Or the captain can trust a timer that says "you are captain for 5 more seconds". Asking a random kid is fastest but may be old news.',
      body: [
        'The leader notes its commit index, confirms with a heartbeat round that a majority still follows it, waits until the state machine has applied up to that index, then answers (**ReadIndex**). It must first have committed its no-op. A **lease** skips the round and trusts bounded clock drift.',
        'Reads from followers are fastest and may be stale. Pick per read: money and locks go through the leader, dashboards can read a follower.',
      ],
      keyIdea: 'A linearizable read costs a majority check or a lease. A follower read is cheap and may lag.',
      metrics: { nodes: '5 of 5', term: '3', leader: 'D', latency: 'read 3 ms' },
      scene: {
        nodes: [
          { ...client, status: 'ok' },
          { ...d, sub: 'leader', status: 'active', tint: 'green', chips: ['value = 300'] },
          { ...c, chips: ['still leader?'] },
          { ...e, chips: ['still leader?'] },
        ],
        links: [link('client', 'd'), dash('d', 'c'), dash('d', 'e')],
        flows: [
          { path: ['client', 'd'], tone: 'request', label: 'read', duration: 1.4 },
          { path: ['d', 'c'], tone: 'handshake', label: 'still leader?', duration: 1, delay: 1.5 },
          { path: ['d', 'e'], tone: 'handshake', duration: 1.2, delay: 1.5 },
          { path: ['c', 'd'], tone: 'handshake', label: 'yes', duration: 1, delay: 2.7 },
          { path: ['e', 'd'], tone: 'handshake', label: 'yes', duration: 1.2, delay: 2.7 },
          { path: ['d', 'client'], tone: 'response', label: '300', duration: 1.4, delay: 3.8 },
        ],
        panel: {
          title: 'Read options',
          icon: 'Table',
          rows: [
            { text: 'Through the log', value: 'slowest, safe', tone: 'warn' },
            { text: 'ReadIndex round', value: 'one RTT, safe', tone: 'good' },
            { text: 'Leader lease', value: 'no RTT, trusts clocks', tone: 'warn' },
            { text: 'Follower read', value: 'fast, maybe stale', tone: 'bad' },
          ],
          footer: { text: 'Leases trade safety margin for speed: they trust clocks', tone: 'warn' },
        },
        caption: 'Leader checks it still leads, then answers',
      },
    },
    {
      title: 'Write latency',
      tag: 'tradeoff',
      heading: 'What agreement costs: latency',
      eli5: 'Asking three kids before every decision is safe but slow. The captain can only move on once the third book has the rule, so the third-fastest kid sets the pace.',
      body: [
        'Every write waits for a disk flush on a majority and a network round trip to the second-fastest follower. In one datacenter that is a few milliseconds.',
        'Spread the 5 nodes over three regions and every write pays a cross-region round trip, often 50 to 150 ms. A slow minority such as E does not add to it.',
      ],
      keyIdea: 'Commit time is set by the second-fastest follower, not the slowest.',
      metrics: { nodes: '5 of 5', term: '3', leader: 'D', latency: '3 ms' },
      metricTones: { latency: 'good' },
      scene: {
        nodes: [
          { ...client2, status: 'ok' },
          { ...d, sub: 'leader', status: 'active', tint: 'green', chips: ['fsync + wait for 2'] },
          { ...c, badge: 'ack 1 ms' },
          { ...b, badge: 'ack 2 ms' },
          { ...e, status: 'dim', badge: 'ack 40 ms (slow)' },
        ],
        links: [link('client2', 'd'), dash('d', 'c'), dash('d', 'b'), dash('d', 'e')],
        flows: [
          { path: ['client2', 'd'], tone: 'request', label: 'write', duration: 1 },
          { path: ['d', 'c', 'd'], tone: 'data', label: '1 ms', duration: 1, delay: 1.1 },
          { path: ['d', 'b', 'd'], tone: 'data', label: '2 ms', duration: 1.5, delay: 1.1 },
          { path: ['d', 'e', 'd'], tone: 'data', duration: 3.4, delay: 1.1 },
          { path: ['d', 'client2'], tone: 'response', label: 'committed', duration: 1, delay: 2.7 },
        ],
        panel: {
          title: 'Commit time',
          icon: 'Timer',
          rows: [
            { text: 'Leader (counts itself)', value: '1 of 3' },
            { text: 'C acks', value: '1 ms', tone: 'good' },
            { text: 'B acks, majority reached', value: '2 ms', tone: 'good' },
            { text: 'E acks later', value: '40 ms', tone: 'muted' },
          ],
        },
        caption: 'Commit time = the second-fastest follower',
      },
    },
    {
      title: 'Size limits',
      tag: 'tradeoff',
      heading: 'What agreement costs: throughput and size',
      eli5: 'Only the captain can write rules, and every kid keeps the whole book. A bigger club means more kids to wait for, so the club stays small and keeps only the important rules.',
      body: [
        'All writes go through one leader, and every node stores everything. More voters make writes slower, because the majority gets bigger.',
        'Clusters are 3 or 5 nodes, rarely 7, and they hold megabytes or a few gigabytes of small, important data. Scale comes from one cluster per job, not a bigger cluster.',
      ],
      keyIdea: 'One leader sets the write ceiling. Keep the cluster small and the data small.',
      metrics: { nodes: '5 of 5', term: '3', leader: 'D', latency: '9 ms (busy)' },
      metricTones: { latency: 'warn' },
      scene: {
        nodes: [
          { ...client2, status: 'hot', badge: '8k writes/s' },
          { ...d, sub: 'leader', status: 'hot', tint: 'amber', load: 92 },
          { ...c, load: 38 },
          { ...b, load: 38 },
          { ...e, load: 38 },
        ],
        links: [link('client2', 'd'), dash('d', 'c'), dash('d', 'b'), dash('d', 'e')],
        flows: [
          { path: ['client2', 'd'], tone: 'request', count: 3, label: 'writes', duration: 1.2 },
          { path: ['d', 'c'], tone: 'data', duration: 1, delay: 1.2 },
          { path: ['d', 'b'], tone: 'data', duration: 1, delay: 1.2 },
          { path: ['d', 'e'], tone: 'data', duration: 1.2, delay: 1.2 },
        ],
        panel: {
          title: 'Typical consensus cluster',
          icon: 'Server',
          rows: [
            { text: 'Voters', value: '3 or 5, rarely 7' },
            { text: 'Data held', value: 'MB to a few GB' },
            { text: 'Write ceiling', value: 'one leader', tone: 'warn' },
          ],
        },
        caption: 'Every write funnels through D',
      },
    },
    {
      title: 'Placement',
      tag: 'tradeoff',
      heading: 'Spread voters over three failure zones',
      eli5: 'If all five kids live in one house, a flood ends the club. Put them in three houses, 2 + 2 + 1, and losing any one house still leaves three kids who can vote.',
      body: [
        'Place voters in three failure zones, 2 + 2 + 1. Lose any one zone and 3 of 5 remain. Two sites cannot do it: with 3 + 2, losing the 3-site stops the cluster, and a 2 + 2 split has no majority on either side.',
        'A small third site, even a single voter, is the fix. Remember the price: cross-zone round trips add to every commit.',
      ],
      keyIdea: 'Three zones tolerate the loss of any one. Two sites always have a fatal side.',
      metrics: { nodes: '3 of 5', term: '3', leader: 'D', latency: '8 ms' },
      metricTones: { nodes: 'warn' },
      scene: {
        zones: [
          { id: 'z1', from: [-3.4, 0.6], to: [-0.6, 5.4], label: 'zone 1: down', tone: 'red' },
          { id: 'z2', from: [0.2, -2.6], to: [2.6, 2.2], label: 'zone 2', tone: 'green' },
          { id: 'z3', from: [3.6, -3], to: [5.4, -0.8], label: 'zone 3', tone: 'green' },
        ],
        nodes: [
          { ...a, status: 'down' },
          { ...b, status: 'down' },
          { ...c, status: 'ok' },
          { ...d, sub: 'leader', status: 'active', tint: 'green' },
          { ...e, status: 'ok' },
        ],
        links: [dash('d', 'c'), dash('d', 'e')],
        flows: [
          { path: ['d', 'c'], tone: 'data', duration: 1 },
          { path: ['d', 'e'], tone: 'data', duration: 1.3 },
          { path: ['c', 'd'], tone: 'handshake', label: 'ack', duration: 1, delay: 1.2 },
        ],
        panel: {
          title: 'Layouts and a lost zone',
          icon: 'Table',
          rows: [
            { text: '2 + 2 + 1, lose a zone', value: '3 or 4 left, runs', tone: 'good' },
            { text: '3 + 2, lose the 3 zone', value: '2 left, stops', tone: 'bad' },
            { text: '2 + 2, lose a zone', value: '2 of 4, stops', tone: 'bad' },
          ],
        },
        caption: 'Zone 1 is gone and 3 of 5 still vote',
      },
      quiz: {
        question: 'You must run a Raft cluster across exactly two datacenters. What happens when the datacenter holding more voters goes down?',
        options: [
          'The other datacenter elects a leader, since it has the remaining healthy nodes',
          'The remaining voters are a minority of the full membership, so no leader can be elected and no write commits',
          'The cluster shrinks its majority to match the live nodes and carries on',
          'Both datacenters elect leaders and merge the logs later',
        ],
        answer: 1,
        explain: 'The majority is counted against the full membership. With 3 + 2 voters, losing the 3 side leaves 2 of 5. Add a small third site, even a single voter, so one site can always fail.',
      },
    },
    {
      title: 'Membership',
      tag: 'concept',
      heading: 'Changing the voter list needs care',
      eli5: 'Adding a kid to the club is risky if half the kids count to three and half count to four. A new kid first just watches and copies the rule book. Only when caught up do they get a vote.',
      body: [
        'If some nodes switch to a new member list while others still use the old one, two disjoint majorities can exist and elect two leaders. Raft changes one voter at a time through the log. Bigger moves use **joint consensus**, where both lists must agree during the switch.',
        'A new node first joins as a non-voting **learner**. It copies the log and becomes a voter once caught up, so it never slows the commit.',
      ],
      keyIdea: 'Change membership one voter at a time, and let new nodes catch up before they vote.',
      metrics: { nodes: '3 + 1 learner', term: '3', leader: 'D', latency: '3 ms' },
      scene: {
        nodes: [
          { ...d, sub: 'leader', status: 'active', tint: 'green', chips: ['voters: A, B, D'] },
          { ...b, status: 'ok' },
          { ...a, status: 'ok' },
          { ...e, sub: 'learner', status: 'dim', chips: [{ text: 'catching up', tone: 'warn' }] },
        ],
        links: [dash('d', 'b'), dash('d', 'a'), dash('d', 'e', { label: 'log copy' })],
        flows: [
          { path: ['d', 'e'], tone: 'data', label: 'entries 1..900', duration: 1.8 },
          { path: ['d', 'b'], tone: 'handshake', duration: 1, delay: 0.4 },
          { path: ['d', 'a'], tone: 'handshake', duration: 1.2, delay: 0.4 },
        ],
        panel: {
          title: 'Why one at a time',
          icon: 'Users',
          rows: [
            { text: 'Old view: 3 nodes', value: 'majority 2', tone: 'good' },
            { text: 'New view: 5 nodes', value: 'majority 3', tone: 'good' },
            { text: 'Both at once', value: '2 and 3 can be disjoint', tone: 'bad' },
          ],
          footer: { text: 'One change per step keeps majorities overlapping', tone: 'muted' },
        },
        caption: 'E copies the log before it gets a vote',
      },
    },
    {
      title: 'Snapshots',
      tag: 'concept',
      heading: 'Snapshots keep the log from growing forever',
      eli5: 'The rule book gets too thick. So every so often the club writes a one-page summary of all rules so far and tears out the old pages. A kid who missed a lot just copies the summary.',
      body: [
        'The log grows forever, so each node periodically takes a **snapshot** of its state at some index, say entry 10,000, and discards the log before it.',
        'A follower that has fallen behind the start of the leader\'s remaining log gets the snapshot instead (`InstallSnapshot`), then the newer entries. A freshly added node catches up the same way.',
      ],
      keyIdea: 'State at an index replaces the log before it. Slow or new nodes copy the snapshot.',
      metrics: { nodes: '5 of 5', term: '3', leader: 'D', latency: '3 ms' },
      scene: {
        nodes: [
          { ...d, sub: 'leader', status: 'active', tint: 'green', chips: ['snapshot @ 10000'] },
          { ...e, status: 'hot', chips: [{ text: 'log ends at 120', tone: 'bad' }] },
          { ...c, status: 'ok', chips: ['log: 10001..10250'] },
        ],
        links: [dash('d', 'e', { label: 'InstallSnapshot' }), dash('d', 'c')],
        flows: [
          { path: ['d', 'e'], tone: 'data', label: 'snapshot 4 MB', duration: 2 },
          { path: ['d', 'e'], tone: 'data', label: 'entries 10001+', duration: 1.4, delay: 2.2 },
          { path: ['d', 'c'], tone: 'handshake', duration: 1, delay: 0.5 },
        ],
        panel: {
          title: 'What D keeps on disk',
          icon: 'HardDrive',
          rows: [
            { text: 'Entries 1 to 10000', value: 'discarded', tone: 'muted' },
            { text: 'Snapshot at 10000', value: '4 MB', tone: 'good' },
            { text: 'Entries 10001 on', value: 'kept' },
          ],
        },
        caption: 'E is too far behind for entries, so it gets a snapshot',
      },
    },
    {
      title: 'Pre-vote',
      tag: 'case',
      heading: 'Case: a flaky node keeps knocking the leader down',
      eli5: 'A kid stuck behind a locked door keeps shouting "captain number 15, 16, 17!". When the door opens, everyone has to stop and listen to the big number. The fix is to first ask "would you vote for me?".',
      body: [
        'A node cut off from the others keeps timing out and raising its term: 4, 5, 6 and on. When it reconnects, its high term forces the healthy leader to step down, though nothing was wrong.',
        'The fix is **pre-vote**. Before raising its term a node asks peers "would you vote for me?". Peers that still hear a leader say no, so the lone node never inflates its term.',
      ],
      keyIdea: 'Ask first, then raise the term. A pre-vote stops a returning node from disrupting a healthy leader.',
      metrics: { nodes: '5 of 5', term: '3 (E claims 17)', leader: 'D', latency: '-' },
      metricTones: { term: 'warn' },
      scene: {
        nodes: [
          { ...e, sub: 'rejoined', status: 'hot', badge: 'term 17' },
          { ...d, sub: 'leader', status: 'active', tint: 'green', badge: 'term 3' },
          { ...c, badge: 'hears D: no' },
        ],
        links: [link('e', 'd', { arrow: 'both', label: 'reconnected', labelTone: 'warn' }), dash('d', 'c')],
        flows: [
          { path: ['e', 'c'], tone: 'event', label: 'pre-vote: would you?', duration: 1.4 },
          { path: ['c', 'e'], tone: 'error', label: 'no: I hear D', duration: 1.4, delay: 1.6 },
          { path: ['d', 'c'], tone: 'handshake', label: 'heartbeat', duration: 1, delay: 0.2 },
        ],
        panel: {
          title: 'Without and with pre-vote',
          icon: 'Shield',
          rows: [
            { text: 'Without', value: 'term 17 demotes D', tone: 'bad' },
            { text: 'With', value: 'pre-vote refused', tone: 'good' },
            { text: 'E\'s term stays', value: '3', tone: 'good' },
          ],
        },
        caption: 'Peers still hear D, so E gets no votes',
      },
    },
    {
      title: 'Crash faults',
      tag: 'concept',
      heading: 'Raft trusts its nodes to crash, never to lie',
      eli5: 'The club rules work when kids go home sick or get lost. They do not work if a kid lies about votes on purpose. That needs a much stricter club.',
      body: [
        'Raft and Paxos assume nodes crash or are slow, and never send false messages. A bug or a hacked node that lies about votes breaks the guarantees.',
        'Tolerating lying (**Byzantine**) nodes needs 3f + 1 nodes for f liars, plus heavier protocols. That is used in blockchains and some safety-critical hardware. Inside one company\'s cluster, crash faults are the usual model.',
      ],
      keyIdea: 'Crash-fault consensus needs 2f + 1 nodes to survive f failures. Byzantine tolerance needs 3f + 1.',
      metrics: { nodes: '3', term: '3', leader: 'D', latency: '-' },
      metricTones: { nodes: 'warn' },
      scene: {
        nodes: [
          { ...a, sub: 'lying node', status: 'hot', tint: 'red', chips: [{ text: 'votes for everyone', tone: 'bad' }] },
          { ...b, status: 'ok' },
          { ...c, status: 'ok' },
        ],
        links: [dash('a', 'b'), dash('b', 'c')],
        flows: [
          { path: ['a', 'b'], tone: 'error', label: 'fake vote', duration: 1.2 },
          { path: ['b', 'c'], tone: 'handshake', duration: 1.2, delay: 1.4 },
        ],
        panel: {
          title: 'Nodes needed for f faults',
          icon: 'Table',
          rows: [
            { text: 'Crash faults (Raft, Paxos)', value: '2f + 1', tone: 'good' },
            { text: 'Lying nodes (Byzantine)', value: '3f + 1', tone: 'warn' },
            { text: 'Example for f = 1', value: '3 versus 4' },
          ],
        },
        caption: 'Raft assumes honest nodes that may crash',
      },
    },
    {
      title: 'Paxos, ZAB',
      tag: 'concept',
      heading: 'Raft has older cousins: Paxos and ZAB',
      eli5: 'There are three clubs with different rule books. One is the oldest and very hard to read. One is a newer, clearer one. One is built for a toy shop. They all need three yes votes of five.',
      body: [
        '**Paxos** came first. Basic Paxos agrees on a single value, and **Multi-Paxos** chains many rounds into a log. It is correct and notoriously hard to turn into a working system.',
        'Raft is a log-first design with the same power and clearer rules. **ZAB**, used by ZooKeeper, is a close cousin built around ordered broadcast from one primary. All three need a majority and survive the same number of failures.',
      ],
      keyIdea: 'Paxos, ZAB and Raft are different recipes for the same majority-based agreement.',
      metrics: { nodes: '5', term: '-', leader: 'one primary', latency: '-' },
      scene: {
        nodes: [
          { id: 'paxos', kind: 'block', at: at(-5, 0), label: 'Paxos', sub: 'Multi-Paxos log', icon: 'Layers', tint: 'violet', chips: ['single value then log'] },
          { id: 'zab', kind: 'block', at: at(0, 0), label: 'ZAB', sub: 'ZooKeeper', icon: 'Share2', tint: 'amber', chips: ['ordered broadcast'] },
          { id: 'raft', kind: 'block', at: at(5, 0), label: 'Raft', sub: 'etcd, Consul', icon: 'Workflow', tint: 'green', chips: ['leader plus log'] },
        ],
        links: [],
        flows: [],
        panel: {
          title: 'Year, key paper, used by',
          icon: 'Table',
          rows: [
            { text: 'Paxos, 1998, The Part-Time Parliament', value: 'Chubby, Spanner' },
            { text: 'ZAB, 2011, Zab: broadcast for primary-backup', value: 'ZooKeeper' },
            { text: 'Raft, 2014, In Search of an Understandable Consensus Algorithm', value: 'etcd, Consul', tone: 'good' },
          ],
          footer: { text: 'All need a majority of the full cluster', tone: 'muted' },
        },
        caption: 'Three alternatives, one majority rule',
      },
    },
    {
      title: 'In practice',
      tag: 'case',
      heading: 'Where you meet consensus in real systems',
      eli5: 'You rarely write a club rule book yourself. You join a club that already has one, like a library or a toy shop, and trust its notice board.',
      body: [
        'You rarely implement Raft. You run a system that contains it. **etcd** (Raft) stores all cluster state for Kubernetes. **Consul** uses Raft. **ZooKeeper** uses ZAB and has long coordinated systems such as HBase and older Kafka versions.',
        'Newer Kafka versions keep their metadata in a built-in Raft quorum. MongoDB replica sets run a Raft-like election. The distributed SQL database CockroachDB and the key-value store TiKV (under TiDB) run Raft per range.',
      ],
      keyIdea: 'Most engineers use consensus through etcd, ZooKeeper or a database, and never write it.',
      metrics: { nodes: '5', term: '-', leader: 'elected', latency: '-' },
      scene: {
        nodes: [
          { id: 'etcd', kind: 'block', at: at(-6.6, 0), label: 'etcd', sub: 'Raft', icon: 'Database', tint: 'violet', chips: ['Kubernetes state'] },
          { id: 'zk', kind: 'block', at: at(-2.2, 0), label: 'ZooKeeper', sub: 'ZAB', icon: 'Network', tint: 'amber', chips: ['HBase, old Kafka'] },
          { id: 'consul', kind: 'block', at: at(2.2, 0), label: 'Consul', sub: 'Raft', icon: 'Share2', tint: 'teal', chips: ['service catalog'] },
          { id: 'kafka', kind: 'block', at: at(6.6, 0), label: 'Kafka', sub: 'built-in Raft', icon: 'Rss', tint: 'green', chips: ['cluster metadata'] },
        ],
        links: [],
        flows: [],
        panel: {
          title: 'Consensus inside products',
          icon: 'List',
          rows: [
            { text: 'etcd', value: 'Raft' },
            { text: 'Consul', value: 'Raft' },
            { text: 'ZooKeeper', value: 'ZAB' },
            { text: 'CockroachDB, TiKV (under TiDB)', value: 'Raft per range' },
            { text: 'MongoDB replica set', value: 'Raft-like election' },
          ],
        },
        caption: 'You run these. You rarely write the protocol',
      },
    },
    {
      title: 'Metadata plane',
      tag: 'case',
      heading: 'A small consensus cluster steers a big data plane',
      eli5: 'The club does not carry the toys. It keeps one small notice board that says who is captain today. Everyone else reads the board and gets on with the work.',
      body: [
        'The usual pattern is a small consensus cluster for **metadata** beside a large data plane. It answers the questions that must have one answer: which database node is primary, which shard lives on which machine, who holds a lock, what the current config is.',
        'Terabytes of user data move by ordinary replication under the leader it names.',
      ],
      keyIdea: 'Put the few facts that must never disagree in a consensus store, and let the rest of the system follow them.',
      metrics: { nodes: '5 of 5', term: '3', leader: 'D', latency: '3 ms' },
      scene: {
        nodes: [
          { id: 'app', kind: 'client', at: at(-6, -4), label: 'app' },
          { id: 'etcd', kind: 'block', at: at(0, -4), label: 'etcd', sub: '5 voters', icon: 'Database', tint: 'violet', chips: ['/db/leader = db-2'] },
          { id: 'dbp', kind: 'db', at: at(-3, 2.5), label: 'db-2', sub: 'primary', status: 'ok', badge: 'holds the key' },
          { id: 'dbr', kind: 'replica', at: at(3, 2.5), label: 'db-1', sub: 'replica' },
        ],
        links: [link('dbp', 'etcd'), link('app', 'etcd', { style: 'faint' }), link('app', 'dbp'), dash('dbp', 'dbr')],
        flows: [
          { path: ['dbp', 'etcd'], tone: 'handshake', label: 'renew lease', duration: 1.2 },
          { path: ['app', 'etcd'], tone: 'request', label: 'who is primary?', duration: 1.2, delay: 0.6 },
          { path: ['etcd', 'app'], tone: 'response', label: 'db-2', duration: 1.2, delay: 1.9 },
          { path: ['app', 'dbp'], tone: 'request', label: 'writes', duration: 1.4, delay: 3.2 },
          { path: ['dbp', 'dbr'], tone: 'data', duration: 1.2, delay: 4.7 },
        ],
        panel: {
          title: 'Two planes',
          icon: 'Layers',
          rows: [
            { text: 'Metadata, tiny', value: 'consensus', tone: 'good' },
            { text: 'User data, terabytes', value: 'plain replication' },
          ],
          footer: { text: 'Small agreed facts steer a big data plane', tone: 'muted' },
        },
        caption: 'Small agreed facts steer a big data plane',
      },
    },
    {
      title: 'Leader key',
      tag: 'case',
      heading: 'A leader key that expires if its holder dies',
      eli5: 'The notice board says "captain: db-2" but the note fades after 10 seconds unless db-2 re-inks it. If db-2 vanishes, the note fades and another kid can write their name.',
      body: [
        'A leader key is a **lease**: a timer the holder must keep renewing. If the holder dies, the key expires and another node can claim it. Patroni keeps its leader key in etcd this way.',
        'A paused holder (a long GC pause) can wake after expiry and still act as primary. The resource must reject stale writes using a token that only goes up, such as the etcd revision or term. The distributed locks lesson covers fencing.',
      ],
      keyIdea: 'A key bound to a lease turns "is the holder alive?" into a question the cluster answers by majority.',
      metrics: { nodes: '5 of 5', term: '3', leader: 'D', latency: '3 ms' },
      scene: {
        nodes: [
          { id: 'etcd', kind: 'block', at: at(0, -4), label: 'etcd', sub: 'lease TTL 10 s', icon: 'Database', tint: 'violet', chips: ['/shop/db/leader'] },
          { id: 'dbp', kind: 'db', at: at(-4, 2), label: 'db-2', sub: 'crashed', status: 'down' },
          { id: 'dbr', kind: 'replica', at: at(4, 2), label: 'db-1', sub: 'takes over', status: 'active' },
        ],
        links: [link('dbp', 'etcd', { style: 'faint', label: 'no keep-alive', labelTone: 'warn' }), link('dbr', 'etcd')],
        flows: [
          { path: ['dbr', 'etcd'], tone: 'request', label: 'put leader = db-1', duration: 1.4, delay: 0.6 },
          { path: ['etcd', 'dbr'], tone: 'response', label: 'granted', duration: 1.4, delay: 2.2 },
        ],
        panel: {
          title: 'Lease timeline',
          icon: 'Clock',
          rows: [
            { text: 'db-2 renews every 3 s', value: 'while alive', tone: 'good' },
            { text: 'db-2 crashes', value: 'no renewals', tone: 'bad' },
            { text: 'After 10 s', value: 'key expires', tone: 'warn' },
            { text: 'db-1 writes the key', value: 'new primary', tone: 'good' },
          ],
        },
        caption: 'The old holder\'s key fades, db-1 claims it',
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
      title: 'Group per shard',
      tag: 'case',
      heading: 'One Raft group per shard',
      eli5: 'A huge club splits into many small teams. Each team has its own captain and its own rule book, so many captains can write rules at the same time.',
      body: [
        'Some databases run one Raft group per shard, so every range of keys has its own leader and log. CockroachDB and TiKV work this way. Writes to different ranges commit in parallel on different leaders.',
        'Each group is small, usually 3 replicas, and a node belongs to many groups. The cluster grows by adding groups, not by growing one quorum.',
      ],
      keyIdea: 'Many small consensus groups scale writes. One giant quorum does not.',
      metrics: { nodes: '3 per group', term: 'per group', leader: 'one per range', latency: '3 ms' },
      scene: {
        nodes: [
          { ...client, status: 'ok' },
          { id: 'r1', kind: 'block', at: at(-3, 0), label: 'range a-m', sub: '3 replicas', icon: 'Layers', tint: 'blue', chips: ['leader: node 1'] },
          { id: 'r2', kind: 'block', at: at(2, -2), label: 'range n-t', sub: '3 replicas', icon: 'Layers', tint: 'green', chips: ['leader: node 2'] },
          { id: 'r3', kind: 'block', at: at(7, 0), label: 'range u-z', sub: '3 replicas', icon: 'Layers', tint: 'amber', chips: ['leader: node 3'] },
        ],
        links: [link('client', 'r1'), link('client', 'r2'), link('client', 'r3')],
        flows: [
          { path: ['client', 'r1'], tone: 'request', label: 'put ann', duration: 1.4 },
          { path: ['client', 'r2'], tone: 'request', label: 'put pam', duration: 1.4, delay: 0.1 },
          { path: ['client', 'r3'], tone: 'request', label: 'put zed', duration: 1.4, delay: 0.2 },
        ],
        panel: {
          title: 'Three groups, three leaders',
          icon: 'Table',
          rows: [
            { text: 'Keys a to m', value: 'group 1, node 1 leads' },
            { text: 'Keys n to t', value: 'group 2, node 2 leads' },
            { text: 'Keys u to z', value: 'group 3, node 3 leads' },
          ],
          footer: { text: 'Different ranges commit in parallel', tone: 'good' },
        },
        caption: 'Each range is its own small cluster',
      },
    },
    {
      title: 'Not 2PC',
      tag: 'concept',
      heading: 'Consensus is not two-phase commit',
      eli5: 'Choosing one captain is different from asking every team "are you ready?" before a joint game. The second needs everyone to say yes. The first only needs most.',
      body: [
        '**Two-phase commit** makes one transaction commit on several shards, all or none. A coordinator asks everyone to prepare, then tells them to commit. Every participant must say yes, and if the coordinator dies after prepare they wait.',
        'Consensus needs only a majority and has no single coordinator to lose. Systems that need both, such as Spanner, run two-phase commit across shards and keep each shard in a consensus group.',
      ],
      keyIdea: 'Two-phase commit needs every participant. Consensus needs a majority and survives a lost leader.',
      metrics: { nodes: '-', term: '-', leader: 'coordinator', latency: '-' },
      scene: {
        nodes: [
          { id: 'coord', kind: 'block', at: at(0, -3), label: 'coordinator', sub: 'two-phase commit', icon: 'Workflow', tint: 'gray', status: 'hot' },
          { id: 's1', kind: 'block', at: at(-4.5, 2.5), label: 'shard 1', sub: 'prepared', icon: 'Database', tint: 'blue', chips: ['yes'] },
          { id: 's2', kind: 'block', at: at(4.5, 2.5), label: 'shard 2', sub: 'prepared', icon: 'Database', tint: 'amber', chips: [{ text: 'waiting', tone: 'warn' }] },
        ],
        links: [link('coord', 's1'), link('coord', 's2')],
        flows: [
          { path: ['coord', 's1'], tone: 'request', label: 'prepare', duration: 1.4 },
          { path: ['coord', 's2'], tone: 'request', label: 'prepare', duration: 1.4 },
          { path: ['s1', 'coord'], tone: 'handshake', label: 'yes', duration: 1.4, delay: 1.5 },
          { path: ['s2', 'coord'], tone: 'handshake', label: 'yes', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Two different problems',
          icon: 'Table',
          rows: [
            { text: 'Two-phase commit', value: 'all must say yes', tone: 'warn' },
            { text: 'Consensus', value: 'a majority is enough', tone: 'good' },
            { text: 'Coordinator dies', value: '2PC waits, Raft elects', tone: 'warn' },
          ],
        },
        caption: 'All shards or none, versus a majority',
      },
    },
    {
      title: 'Last resort',
      tag: 'tradeoff',
      heading: 'Reach for consensus last, with a small cluster',
      eli5: 'A club vote is slow and serious, so the club only votes on what truly needs one answer. Everyday cookie sharing does not need a vote.',
      body: [
        'Consensus and distributed locks are a last resort. Use them when correctness demands one answer: leader choice, config, lock ownership. Add fencing when a lock guards something shared (see the leader key step).',
        'If the lock only guards a database row, a row lock (`SELECT FOR UPDATE`) is simpler. If data tolerates stale reads or merges, quorum replication is cheaper. Do not push every write through a Raft log.',
      ],
      keyIdea: 'Use consensus for the few facts that need one answer. Use cheaper tools for everything else.',
      metrics: { nodes: '3 or 5', term: '-', leader: 'one', latency: '3 ms' },
      scene: {
        nodes: [
          { id: 'cfg', kind: 'block', at: at(-5, 0), label: 'leader, config', sub: 'one answer', icon: 'Key', tint: 'violet', status: 'ok', chips: [{ text: 'consensus', tone: 'good' }] },
          { id: 'row', kind: 'block', at: at(0, 0), label: 'row lock', sub: 'inside one DB', icon: 'Database', tint: 'blue', chips: ['FOR UPDATE'] },
          { id: 'feed', kind: 'block', at: at(5, 0), label: 'feed, counters', sub: 'stale is fine', icon: 'Rss', tint: 'green', chips: ['quorum reads'] },
        ],
        links: [],
        flows: [],
        panel: {
          title: 'Pick the lightest tool',
          icon: 'Scale',
          rows: [
            { text: 'Who is leader, cluster config', value: 'consensus store', tone: 'good' },
            { text: 'Lock on a database row', value: 'row lock' },
            { text: 'Stale reads are fine', value: 'quorum replication' },
          ],
        },
        caption: 'Consensus for a few facts, not every write',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Repair, durability, reads, costs and where it runs',
      eli5: 'The club repairs wrong books, writes votes on paper first, checks that the captain is still captain before answering, and keeps a small team for the big decisions only.',
      body: [
        'The leader repairs diverged logs from the last matching entry and commits old entries through a current-term entry. Nodes flush term, vote and log to disk before replying. Linearizable reads need a majority check or a lease.',
        'A majority costs a round trip per write and caps throughput at one leader, so clusters stay small and spread over three zones. The next lesson builds on this: a distributed lock is a key in a consensus store, and its fencing token only goes up, like a term.',
      ],
      keyIdea: 'Small consensus cluster, odd size, three zones, durable writes, safe reads. Use it only for facts that need one answer.',
      metrics: { nodes: '5 of 5', term: '3', leader: 'D', latency: '3 ms' },
      metricTones: { nodes: 'good', leader: 'good', latency: 'good' },
      scene: {
        nodes: [
          { ...a, status: 'ok' },
          { ...b, status: 'ok' },
          { ...c, status: 'ok' },
          { ...d, sub: 'leader', status: 'active', tint: 'green', badge: 'term 3' },
          { ...e, status: 'ok' },
        ],
        links: [dash('d', 'a'), dash('d', 'b'), dash('d', 'c'), dash('d', 'e')],
        flows: [
          { path: ['d', 'a'], tone: 'data', duration: 1.2 },
          { path: ['d', 'b'], tone: 'data', duration: 1 },
          { path: ['d', 'c'], tone: 'data', duration: 0.8 },
          { path: ['d', 'e'], tone: 'data', duration: 0.9 },
          { path: ['b', 'd'], tone: 'handshake', label: 'ack', duration: 1, delay: 1.4 },
          { path: ['c', 'd'], tone: 'handshake', duration: 0.8, delay: 1.4 },
        ],
        panel: {
          title: 'Checklist',
          icon: 'Shield',
          rows: [
            { text: 'Odd size, 3 or 5', value: 'majority', tone: 'good' },
            { text: 'Three zones', value: '2 + 2 + 1', tone: 'good' },
            { text: 'fsync before reply', value: 'durable', tone: 'good' },
            { text: 'Reads', value: 'check or lease', tone: 'good' },
            { text: 'Scope', value: 'metadata only', tone: 'warn' },
          ],
        },
      },
      quiz: {
        question: 'A team wants every user write in their 3 TB product database to go through a 5-node Raft cluster so it is "always consistent". What is the best advice?',
        options: [
          'Do it: Raft scales writes linearly with more voters',
          'Use consensus for the small metadata that must have one answer, and replicate the bulk data normally under the leader it names',
          'Use 4 nodes so there is an even split',
          'Put the voters in one rack so commits are fast'
        ],
        answer: 1,
        explain: 'One leader limits write throughput, every node stores everything, and more voters make commits slower. Keep the consensus cluster small and for metadata, and let ordinary replication carry the bulk data.',
      },
    },
  ],
};
