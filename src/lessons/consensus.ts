import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

// Five voters zigzag across the screen (d steps by 3.2), the apps sit above the outer two.
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
const fan = (from: string, tos: string[]) => tos.map((t) => dash(from, t));

export const consensus: Lesson = {
  id: 'consensus',
  title: 'Consensus and leader election (Raft) (part 1)',
  tagline: 'How a handful of machines agree on one leader and one history, even when some of them crash or get cut off.',
  minutes: 15,
  level: 'Advanced',
  learn: [
    'Why a timeout cannot name a leader, and what safety and liveness mean',
    'Why "who is the leader?" needs a majority vote, and why any two majorities overlap',
    'How many failures 3, 5 and 7 nodes survive, and why even sizes add cost only',
    'Roles, terms, heartbeats and election timeouts: how Raft picks exactly one leader',
    'How a log entry is replicated, committed and applied to a state machine',
    'What happens when the leader crashes, when votes split, and when a partition strands a leader in the minority',
  ],
  metrics: [
    { key: 'nodes', label: 'Voters up', icon: 'Server' },
    { key: 'quorum', label: 'Majority', icon: 'Scale' },
    { key: 'term', label: 'Term', icon: 'Hash' },
    { key: 'leader', label: 'Leader', icon: 'Key' },
    { key: 'commit', label: 'Committed entries', icon: 'Layers' },
  ],
  steps: [
    {
      title: 'Two leaders',
      tag: 'problem',
      heading: 'Two machines both believe they are in charge',
      eli5: 'Three kids run a tree house club. Two of them each shout "I am the captain!" and give different orders. Nobody knows whose orders count.',
      body: [
        'The replication lesson ended with a warning: failover is only safe when exactly one node is the primary. If one machine decides who that is, it is a single point of failure. If two machines decide, they can disagree.',
        'The link between node A and node C drops for 12 seconds. Each stops hearing the other and promotes itself. The app writes `max_connections = 200` to A, and another caller writes `max_connections = 50` to C. Both are acknowledged.',
      ],
      keyIdea: 'Any scheme where one node decides by itself can produce two leaders.',
      metrics: { nodes: '3', quorum: 'not used', term: '-', leader: 'A and C', commit: 'two histories' },
      metricTones: { leader: 'bad', commit: 'bad' },
      scene: {
        nodes: [
          { ...client, status: 'hot', badge: '200 or 50?' },
          { ...a, sub: 'thinks: leader', status: 'hot', chips: [{ text: 'value = 200', tone: 'bad' }] },
          { ...c, sub: 'thinks: leader', status: 'hot', chips: [{ text: 'value = 50', tone: 'bad' }] },
          { ...b, sub: 'confused', status: 'dim' },
        ],
        links: [
          link('client', 'a'),
          link('client', 'c'),
          link('a', 'c', { style: 'faint', route: 'straight', label: 'dropped 12 s', labelTone: 'warn' }),
          dash('a', 'b'),
          dash('b', 'c'),
        ],
        flows: [
          { path: ['client', 'a'], tone: 'request', label: 'set 200', duration: 1.2 },
          { path: ['client', 'c'], tone: 'request', label: 'set 50', duration: 1.6, delay: 0.2 },
          { path: ['a', 'b'], tone: 'data', label: 'I lead', duration: 1, delay: 1.9 },
          { path: ['c', 'b'], tone: 'error', label: 'no, I lead', duration: 1, delay: 1.9 },
        ],
        panel: {
          title: 'Both writes acknowledged',
          icon: 'Table',
          rows: [
            { text: 'node A', value: 'max_connections = 200', tone: 'bad' },
            { text: 'node C', value: 'max_connections = 50', tone: 'bad' },
            { text: 'link A to C', value: 'down 12 s', tone: 'warn' },
          ],
          footer: { text: 'Two histories, no way to merge them', tone: 'bad' },
        },
        caption: 'Both writes were acknowledged',
      },
    },
    {
      title: 'Dead or slow',
      tag: 'concept',
      heading: 'A timeout cannot tell a dead node from a slow network',
      eli5: 'A kid stops answering when you shout. Maybe they went home. Maybe they are wearing headphones. From where you stand you cannot know which.',
      body: [
        'Silence has two causes you cannot tell apart: the peer crashed, or the network between you is slow or cut. A timeout only says how long you waited.',
        'So no node can decide alone that it is the leader. The nodes need a rule that lets them **agree**, and that keeps working while some of them are down or unreachable. That rule is called **consensus**.',
      ],
      keyIdea: 'Silence does not prove a node is dead, so the decision has to be shared.',
      metrics: { nodes: '3', quorum: 'not used', term: '-', leader: 'unknown', commit: '0' },
      metricTones: { leader: 'warn' },
      scene: {
        nodes: [
          { ...a, sub: 'waiting', status: 'active', chips: [{ text: 'no reply in 2 s', tone: 'warn' }] },
          { ...b, sub: 'dead? slow?', status: 'dim' },
          { ...c, sub: 'peer' },
        ],
        links: [link('a', 'b', { label: 'silence', labelTone: 'warn' }), dash('b', 'c')],
        flows: [
          { path: ['a', 'b'], tone: 'request', label: 'are you there?', duration: 1.4 },
          { path: ['b', 'a'], tone: 'error', label: '...', duration: 1.4, delay: 2 },
        ],
        panel: {
          title: 'Why B stays silent',
          icon: 'Clock',
          rows: [
            { text: 'B crashed', value: 'never replies' },
            { text: 'Network is slow', value: 'replies late' },
            { text: 'Network is cut', value: 'B is fine, unreachable' },
          ],
          footer: { text: 'A sees the same silence in all three', tone: 'warn' },
        },
        caption: 'The same silence, three different causes',
      },
    },
    {
      title: 'Safety, liveness',
      tag: 'concept',
      heading: 'What a consensus protocol promises',
      eli5: 'The club has two promises. Never have two captains at once. And pick a captain quickly when kids can talk. If it cannot do both, it waits.',
      body: [
        'A consensus protocol gives **safety**: nodes never decide two different things, and a decided value is never lost. It also gives **liveness**: it eventually decides while enough nodes can talk to each other.',
        'No protocol can guarantee both in a network with unbounded delays and even one crash (the FLP result). Real systems always keep safety and get liveness from timeouts. When the network misbehaves they stop and wait.',
      ],
      keyIdea: 'Safety is never given up. Under a partition the system pauses instead of guessing.',
      metrics: { nodes: '3', quorum: 'not used', term: '-', leader: 'none yet', commit: '0' },
      scene: {
        nodes: [
          { ...a, sub: 'voter', status: 'ok', chips: [{ text: 'one value', tone: 'good' }] },
          { ...b, sub: 'voter', status: 'ok', chips: [{ text: 'one value', tone: 'good' }] },
          { ...c, sub: 'voter', status: 'ok', chips: [{ text: 'one value', tone: 'good' }] },
        ],
        links: [dash('a', 'b'), dash('b', 'c')],
        flows: [
          { path: ['a', 'b', 'c'], tone: 'handshake', label: 'agree', duration: 1.8 },
          { path: ['c', 'b', 'a'], tone: 'handshake', duration: 1.8, delay: 2 },
        ],
        panel: {
          title: 'Two promises',
          icon: 'Shield',
          rows: [
            { text: 'Safety', value: 'never two answers', tone: 'good' },
            { text: 'Liveness', value: 'decides when a majority talks', tone: 'warn' },
            { text: 'Under a partition', value: 'safety kept, pause', tone: 'warn' },
          ],
          footer: { text: 'Safety always wins over liveness', tone: 'muted' },
        },
        caption: 'Safety first, progress when the network allows',
      },
    },
    {
      title: 'Majority',
      tag: 'concept',
      heading: 'Nothing counts until more than half agree',
      eli5: 'The club grows to five kids and makes one rule: nothing is decided unless three of the five say yes. Two groups of three always share a kid, so two opposite decisions can never both pass.',
      body: [
        'Run an odd number of nodes, here **5**, and require a **majority** (a **quorum**) for every decision: 3 of 5. That covers electing a leader and accepting a write.',
        'Any two groups of 3 picked from 5 share at least one node. That shared node has seen the earlier decision and refuses to contradict it. Two leaders in one round would need 3 votes each, which is 6 votes from 5 nodes.',
      ],
      keyIdea: 'Two majorities always overlap in at least one node. That overlap stops two conflicting decisions.',
      metrics: { nodes: '5 of 5', quorum: '3', term: '-', leader: 'none yet', commit: '0' },
      scene: {
        nodes: [
          { ...a, sub: 'voter', status: 'active', badge: 'group 1' },
          { ...b, sub: 'voter', status: 'active', badge: 'group 1' },
          { ...c, sub: 'voter', status: 'ok', badge: 'in both' },
          { ...d, sub: 'voter', badge: 'group 2' },
          { ...e, sub: 'voter', badge: 'group 2' },
        ],
        links: [dash('a', 'b'), dash('b', 'c'), dash('c', 'd'), dash('d', 'e')],
        flows: [
          { path: ['a', 'b', 'c'], tone: 'handshake', label: '3 of 5', duration: 1.6 },
          { path: ['e', 'd', 'c'], tone: 'handshake', label: '3 of 5', duration: 1.6, delay: 1.8 },
        ],
        panel: {
          title: 'Two groups of 3 from 5',
          icon: 'Users',
          rows: [
            { text: 'Group 1', value: 'A, B, C' },
            { text: 'Group 2', value: 'C, D, E' },
            { text: 'Shared node', value: 'C', tone: 'good' },
          ],
          footer: { text: 'C refuses to contradict itself', tone: 'good' },
        },
        caption: 'Any two majorities share a node',
      },
    },
    {
      title: 'Cluster sizes',
      tag: 'concept',
      heading: 'How many failures a cluster survives',
      eli5: 'A club of five can lose two kids and still get three yes votes. A club of six needs four, so it can still lose only two. The extra kid only adds more voting.',
      body: [
        'A cluster of N nodes survives `floor((N - 1) / 2)` failures: 3 nodes survive 1, 5 survive 2, 7 survive 3. The majority is always counted against all N, dead nodes included.',
        'Four nodes need 3 for a majority and still survive only 1. Six need 4 and survive 2. An even size adds cost and a bigger majority and buys no extra safety, so run odd sizes.',
      ],
      keyIdea: 'Survivable failures are (N - 1) / 2 rounded down. Even sizes cost more and survive no more.',
      metrics: { nodes: '3 of 5', quorum: '3', term: '-', leader: 'none yet', commit: '0' },
      metricTones: { nodes: 'warn' },
      scene: {
        nodes: [
          { ...a, status: 'ok', badge: 'up' },
          { ...b, status: 'ok', badge: 'up' },
          { ...c, status: 'ok', badge: 'up' },
          { ...d, status: 'down', badge: 'failed' },
          { ...e, status: 'down', badge: 'failed' },
        ],
        links: [dash('a', 'b'), dash('b', 'c'), dash('c', 'd', { style: 'faint' }), dash('d', 'e', { style: 'faint' })],
        flows: [{ path: ['a', 'b', 'c'], tone: 'handshake', label: '3 votes', duration: 1.8 }],
        panel: {
          title: 'Cluster size and tolerance',
          icon: 'Table',
          rows: [
            { text: '3 nodes, majority 2', value: 'survives 1', tone: 'good' },
            { text: '5 nodes, majority 3', value: 'survives 2', tone: 'good' },
            { text: '7 nodes, majority 4', value: 'survives 3', tone: 'good' },
            { text: '4 nodes, majority 3', value: 'survives 1', tone: 'warn' },
            { text: '6 nodes, majority 4', value: 'survives 2', tone: 'warn' },
          ],
          footer: { text: 'Even sizes add cost, not tolerance', tone: 'muted' },
        },
        caption: 'Five nodes, two down, still a majority of 3',
      },
    },
    {
      title: 'Roles',
      tag: 'concept',
      heading: 'Raft: every node is a follower, candidate or leader',
      eli5: 'In the club, most kids are followers who do what the captain says. A kid who wants the job becomes a candidate and asks for votes. The winner is the captain.',
      body: [
        '**Raft** is the consensus algorithm most systems use today, because it was designed to be understandable. Every node is in one of three roles: **follower**, **candidate** or **leader**.',
        'Followers only answer messages. A candidate asks the others for votes. The leader is the only node that takes writes, so every client request goes through it.',
      ],
      keyIdea: 'One leader takes every write. Followers answer, and a candidate is a follower asking to lead.',
      metrics: { nodes: '3 of 3', quorum: '2', term: '1', leader: 'A', commit: '0' },
      scene: {
        nodes: [
          { ...client, status: 'ok' },
          { ...a, sub: 'leader', status: 'active', tint: 'green', chips: ['takes all writes'] },
          { ...b, sub: 'follower', chips: ['answers only'] },
          { ...c, sub: 'candidate', tint: 'amber', chips: ['asks for votes'] },
        ],
        links: [link('client', 'a'), dash('a', 'b'), dash('c', 'b')],
        flows: [
          { path: ['client', 'a'], tone: 'request', label: 'write', duration: 1.4 },
          { path: ['a', 'b'], tone: 'data', duration: 1.2, delay: 1.5 },
          { path: ['c', 'b'], tone: 'event', label: 'vote for me?', duration: 1.2, delay: 0.4 },
        ],
        panel: {
          title: 'Three roles',
          icon: 'Users',
          rows: [
            { text: 'Follower', value: 'answers, waits' },
            { text: 'Candidate', value: 'asks for votes', tone: 'warn' },
            { text: 'Leader', value: 'takes all writes', tone: 'good' },
          ],
        },
        caption: 'One leader, everyone else follows',
      },
    },
    {
      title: 'Terms',
      tag: 'concept',
      heading: 'Time is cut into numbered terms',
      eli5: 'The club counts its captains: captain number 1, then number 2, and so on. Each kid has one vote per captain number. If a kid hears a newer number, the old captain steps down.',
      body: [
        'Time is cut into numbered **terms**. A term starts with an election and has at most one leader. Each node votes at most once per term, so with the majority rule two leaders in one term are impossible.',
        'Every message carries the sender\'s term. A node that sees a higher term than its own steps down to follower at once, so a stale leader demotes itself.',
      ],
      keyIdea: 'A term is a numbered reign with at most one leader. A higher term always wins.',
      metrics: { nodes: '3 of 3', quorum: '2', term: '2', leader: 'B', commit: '0' },
      scene: {
        nodes: [
          { ...a, sub: 'old leader', status: 'hot', badge: 'term 1 > steps down' },
          { ...b, sub: 'leader', status: 'active', tint: 'green', badge: 'term 2' },
          { ...c, badge: 'term 2' },
        ],
        links: [link('a', 'b', { arrow: 'both' }), dash('b', 'c')],
        flows: [
          { path: ['a', 'b'], tone: 'request', label: 'term 1', duration: 1.2 },
          { path: ['b', 'a'], tone: 'response', label: 'term 2: step down', duration: 1.4, delay: 1.4 },
        ],
        panel: {
          title: 'Who led when',
          icon: 'Hash',
          rows: [
            { text: 'Term 1', value: 'leader A' },
            { text: 'Term 2', value: 'leader B' },
            { text: 'One vote per node', value: 'per term', tone: 'good' },
          ],
          footer: { text: 'Higher term seen: step down', tone: 'muted' },
        },
        caption: 'A higher term demotes the old leader',
      },
    },
    {
      title: 'Heartbeats',
      tag: 'concept',
      heading: 'The leader stays leader by sending heartbeats',
      eli5: 'The captain calls "still here!" every few seconds. Each kid has a secret countdown, and every call resets it. Only a kid whose countdown hits zero starts asking for votes.',
      body: [
        'The leader sends a **heartbeat** to every follower, here every 50 ms. Each follower runs an **election timeout**, picked at random between 150 and 300 ms, and resets it on every heartbeat.',
        'A follower only acts when its timer runs out. Because the leader talks three times faster than any timer, a healthy leader is never challenged.',
      ],
      keyIdea: 'Heartbeats reset every timer. A follower only starts an election after silence.',
      metrics: { nodes: '5 of 5', quorum: '3', term: '1', leader: 'A', commit: '0' },
      metricTones: { nodes: 'good' },
      scene: {
        nodes: [
          { ...a, sub: 'leader', status: 'active', tint: 'green', badge: 'term 1' },
          { ...b, chips: ['timer 210 ms'] },
          { ...c, chips: ['timer 280 ms'] },
          { ...d, chips: ['timer 190 ms'] },
          { ...e, chips: ['timer 250 ms'] },
        ],
        links: fan('a', ['b', 'c', 'd', 'e']),
        flows: [
          { path: ['a', 'b'], tone: 'handshake', label: 'heartbeat', duration: 0.8 },
          { path: ['a', 'c'], tone: 'handshake', duration: 0.9 },
          { path: ['a', 'd'], tone: 'handshake', duration: 1 },
          { path: ['a', 'e'], tone: 'handshake', duration: 1.1 },
        ],
        panel: {
          title: 'The two timers',
          icon: 'Timer',
          rows: [
            { text: 'Heartbeat', value: 'every 50 ms', tone: 'good' },
            { text: 'Election timeout', value: '150 to 300 ms, random' },
          ],
          footer: { text: 'Every heartbeat resets every timer', tone: 'muted' },
        },
        caption: 'Heartbeat every 50 ms resets every timer',
      },
    },
    {
      title: 'Append',
      tag: 'concept',
      heading: 'The leader appends the write to its log and sends it',
      eli5: 'Every kid keeps a copy of the club rule book. The captain writes a new rule in their own book first, then sends the rule to everyone else.',
      body: [
        'Each node keeps a **log**: a numbered list of commands. The app sends `set max_connections = 200` to leader A. A appends it as entry 1, tagged with term 1, and sends it to all followers in an `AppendEntries` message.',
        'Heartbeats are the same message with no entries. The leader does not answer the app yet. The entry is only a proposal until enough nodes hold it.',
      ],
      keyIdea: 'The leader writes the entry to its own log first, then asks every follower to copy it.',
      metrics: { nodes: '5 of 5', quorum: '3', term: '1', leader: 'A', commit: '0' },
      scene: {
        nodes: [
          { ...a, sub: 'leader', status: 'active', tint: 'green', chips: ['app: set 200', { text: 'log: 1 (not yet)', tone: 'warn' }] },
          { ...b },
          { ...c },
          { ...d },
          { ...e },
        ],
        links: fan('a', ['b', 'c', 'd', 'e']),
        flows: [
          { path: ['a', 'b'], tone: 'data', label: 'entry 1', duration: 0.9 },
          { path: ['a', 'c'], tone: 'data', duration: 1 },
          { path: ['a', 'd'], tone: 'data', duration: 2.2 },
          { path: ['a', 'e'], tone: 'data', duration: 2.4 },
        ],
        panel: {
          title: 'AppendEntries',
          icon: 'Code',
          code: 'term:    1\nentries: [ 1: set max_connections = 200 ]\nsent to: B, C, D, E',
          footer: { text: 'No entries means heartbeat', tone: 'muted' },
        },
        caption: 'Entry 1 is on the leader, in flight to four followers',
      },
    },
    {
      title: 'Commit',
      tag: 'concept',
      heading: 'A write is committed once a majority has stored it',
      eli5: 'Once three of the five rule books have the new rule written down, the rule is official. The captain then tells the kid who asked. The slow kids copy it later.',
      body: [
        'Each follower writes the entry to disk and acknowledges. Once the entry is on a **majority**, the leader counting itself, it is **committed**. A needs only two acks: A, B and C make 3 of 5.',
        'Then A applies the command and answers the app. D and E catch up a moment later. A slow or dead minority never blocks a write.',
      ],
      keyIdea: 'Committed means stored on a majority. The leader answers the client only after that point.',
      metrics: { nodes: '5 of 5', quorum: '3', term: '1', leader: 'A', commit: '1' },
      metricTones: { commit: 'good' },
      scene: {
        nodes: [
          { ...a, sub: 'leader', status: 'active', tint: 'green', badge: 'log: 1 committed' },
          { ...b, status: 'ok', badge: 'log: 1' },
          { ...c, status: 'ok', badge: 'log: 1' },
          { ...d, badge: 'log: 1 (late)' },
          { ...e, badge: 'log: 1 (late)' },
        ],
        links: fan('a', ['b', 'c', 'd', 'e']),
        flows: [
          { path: ['a', 'b'], tone: 'data', label: 'entry 1', duration: 0.9 },
          { path: ['a', 'c'], tone: 'data', duration: 1 },
          { path: ['a', 'd'], tone: 'data', duration: 2.2 },
          { path: ['a', 'e'], tone: 'data', duration: 2.4 },
          { path: ['b', 'a'], tone: 'handshake', label: 'ack', duration: 0.8, delay: 1.1 },
          { path: ['c', 'a'], tone: 'handshake', label: 'ack', duration: 0.8, delay: 1.2 },
        ],
        panel: {
          title: 'Counting copies',
          icon: 'Scale',
          rows: [
            { text: 'A (leader), B, C', value: '3 of 5', tone: 'good' },
            { text: 'D, E', value: 'still catching up', tone: 'muted' },
            { text: 'Reply to the app', value: 'OK, committed', tone: 'good' },
          ],
        },
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
      title: 'State machine',
      tag: 'concept',
      heading: 'Same log, same order, same state',
      eli5: 'Everyone follows the rule book from page one in order. Because all the books match, every kid ends up knowing exactly the same club rules.',
      body: [
        'A committed entry is permanent. Every node applies the same commands in the same order, so every node ends in the same state. This is called a **replicated state machine**.',
        'That is how one consensus log can run a key-value store, a lock service or a cluster config. The log is the truth, and the state is whatever you get by replaying it.',
      ],
      keyIdea: 'Consensus agrees on the order of commands. Replaying one log gives every node the same state.',
      metrics: { nodes: '5 of 5', quorum: '3', term: '1', leader: 'A', commit: '1' },
      metricTones: { nodes: 'good', commit: 'good' },
      scene: {
        nodes: [
          { ...a, sub: 'leader', tint: 'green', status: 'ok', chips: ['value = 200'] },
          { ...b, status: 'ok', chips: ['value = 200'] },
          { ...c, status: 'ok', chips: ['value = 200'] },
          { ...d, status: 'ok', chips: ['value = 200'] },
          { ...e, status: 'ok', chips: ['value = 200'] },
        ],
        links: fan('a', ['b', 'c', 'd', 'e']),
        flows: [
          { path: ['a', 'b'], tone: 'data', duration: 1 },
          { path: ['a', 'c'], tone: 'data', duration: 1 },
          { path: ['a', 'd'], tone: 'data', duration: 1.2 },
          { path: ['a', 'e'], tone: 'data', duration: 1.2 },
        ],
        panel: {
          title: 'The same log on every node',
          icon: 'List',
          code: 'index  term  command\n1      1     set max_connections = 200',
          footer: { text: 'Replay gives every node the same state', tone: 'good' },
        },
        caption: 'Five nodes, one state',
      },
    },
    {
      title: 'Leader crash',
      tag: 'case',
      heading: 'Case: the leader dies and a new one is elected',
      eli5: 'The captain goes home sick and the calls of "still here!" stop. The first kid to notice says "I will be captain number 2, who votes for me?" Three yes votes and the job is theirs.',
      body: [
        'Node A loses power and the heartbeats stop. B has the shortest timer and runs out first, about 150 ms later. B becomes a **candidate**: it raises its term to 2, votes for itself, and sends `RequestVote` to everyone.',
        'C and D grant their vote, since neither has voted in term 2. With its own vote B has 3 of 5, a majority of the full cluster. The dead node still counts in the 5. B starts sending heartbeats, which stops any other timer from firing.',
      ],
      keyIdea: 'No heartbeat, timer fires, ask for votes, win a majority.',
      metrics: { nodes: '4 of 5', quorum: '3', term: '2', leader: 'B (new)', commit: '1' },
      metricTones: { nodes: 'warn', leader: 'good' },
      scene: {
        nodes: [
          { ...a, sub: 'crashed', status: 'down', badge: 'power lost' },
          { ...b, sub: 'leader', status: 'ok', tint: 'green', badge: 'term 2: 3 votes' },
          { ...c, badge: 'voted B' },
          { ...d, badge: 'voted B' },
          { ...e },
        ],
        links: fan('b', ['a', 'c', 'd', 'e']),
        flows: [
          { path: ['b', 'c'], tone: 'event', label: 'vote for me?', duration: 0.9 },
          { path: ['b', 'd'], tone: 'event', duration: 1 },
          { path: ['b', 'e'], tone: 'event', duration: 1.1 },
          { path: ['b', 'a'], tone: 'error', duration: 1 },
          { path: ['c', 'b'], tone: 'handshake', label: 'yes', duration: 0.9, delay: 1.2 },
          { path: ['d', 'b'], tone: 'handshake', label: 'yes', duration: 1, delay: 1.2 },
          { path: ['b', 'e'], tone: 'handshake', label: 'heartbeat', duration: 1, delay: 2.6 },
          { path: ['b', 'c'], tone: 'handshake', duration: 0.9, delay: 2.6 },
          { path: ['b', 'd'], tone: 'handshake', duration: 1, delay: 2.6 },
        ],
        panel: {
          title: 'Election in term 2',
          icon: 'Users',
          rows: [
            { text: 'B votes for itself', value: '1', tone: 'good' },
            { text: 'C and D grant', value: '2 more', tone: 'good' },
            { text: 'Needed', value: '3 of 5' },
            { text: 'Leaderless gap', value: 'about 300 ms', tone: 'warn' },
          ],
        },
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
      title: 'Split vote',
      tag: 'case',
      heading: 'Case: two candidates split the vote',
      eli5: 'Two kids shout "vote for me!" at the same moment. Each gets two votes and nobody reaches three. They wait a random moment and try again, and one of them goes first.',
      body: [
        'Suppose B and D time out together. C votes for B, E votes for D, and each candidate has 2 votes. Nobody reaches 3, so that term ends with no leader.',
        'Each candidate waits a new random timeout, and one of them almost always goes first on the retry. That is why the timers are random. The cluster is leaderless for a few hundred milliseconds, and writes wait during that gap.',
      ],
      keyIdea: 'Random timeouts keep two candidates from colliding forever. A split vote costs time, not safety.',
      metrics: { nodes: '4 of 5', quorum: '3', term: '2', leader: 'none (split)', commit: '1' },
      metricTones: { leader: 'warn' },
      scene: {
        nodes: [
          { ...b, sub: 'candidate', tint: 'amber', status: 'hot', badge: '2 votes' },
          { ...c, badge: 'voted B' },
          { ...d, sub: 'candidate', tint: 'amber', status: 'hot', badge: '2 votes' },
          { ...e, badge: 'voted D' },
          { ...a, sub: 'crashed', status: 'down' },
        ],
        links: [dash('b', 'c'), dash('d', 'e'), dash('b', 'd', { style: 'faint', label: 'both want it', labelTone: 'warn' })],
        flows: [
          { path: ['b', 'c'], tone: 'event', label: 'vote for me?', duration: 1 },
          { path: ['d', 'e'], tone: 'event', label: 'vote for me?', duration: 1 },
          { path: ['c', 'b'], tone: 'handshake', label: 'yes', duration: 1, delay: 1.2 },
          { path: ['e', 'd'], tone: 'handshake', label: 'yes', duration: 1, delay: 1.2 },
        ],
        panel: {
          title: 'Term 2 tally',
          icon: 'Table',
          rows: [
            { text: 'B: itself and C', value: '2 votes, needs 3 of 5', tone: 'warn' },
            { text: 'D: itself and E', value: '2 votes, needs 3 of 5', tone: 'warn' },
            { text: 'Retry after', value: 'new random timeout' },
          ],
          footer: { text: 'No leader this term, safety intact', tone: 'warn' },
        },
        caption: 'Two candidates, four voters, no majority',
      },
    },
    {
      title: 'Vote rule',
      tag: 'concept',
      heading: 'A node with a stale log cannot win',
      eli5: 'A kid who missed the last club meeting asks to be captain. The others look at that kid\'s rule book, see a rule is missing, and say no. Only a kid with a complete book can lead.',
      body: [
        'Suppose E was slow and never received entry 1. If E became leader it would overwrite a committed write. Raft blocks this in the vote handler: a node only votes for a candidate whose log is **at least as up to date** as its own. Compare the term of the last entry first, then the log length.',
        'Entry 1 is committed, so it sits on at least 3 nodes. E needs 3 votes, so at least one voter it asks holds entry 1 and refuses. Every elected leader already holds every committed entry.',
      ],
      keyIdea: 'Voters refuse candidates with older logs, so a new leader always holds every committed entry.',
      metrics: { nodes: '4 of 5', quorum: '3', term: '2', leader: 'none', commit: '1' },
      scene: {
        nodes: [
          { ...e, sub: 'candidate', status: 'hot', tint: 'amber', chips: [{ text: 'log: empty', tone: 'bad' }] },
          { ...d, status: 'ok', chips: ['log: 1'] },
          { ...c, status: 'ok', chips: ['log: 1'] },
          { ...b, status: 'ok', chips: ['log: 1'] },
          { ...a, sub: 'crashed', status: 'down' },
        ],
        links: [dash('e', 'd'), dash('e', 'c'), dash('e', 'b')],
        flows: [
          { path: ['e', 'd'], tone: 'event', label: 'vote for me?', duration: 0.9 },
          { path: ['e', 'c'], tone: 'event', duration: 1 },
          { path: ['e', 'b'], tone: 'event', duration: 1.1 },
          { path: ['d', 'e'], tone: 'error', label: 'no: log behind', duration: 0.9, delay: 1.3 },
          { path: ['c', 'e'], tone: 'error', duration: 1, delay: 1.3 },
          { path: ['b', 'e'], tone: 'error', duration: 1.1, delay: 1.3 },
        ],
        panel: {
          title: 'Is the candidate up to date?',
          icon: 'Shield',
          rows: [
            { text: '1. Last entry term', value: 'higher wins' },
            { text: '2. Same term', value: 'longer log wins' },
            { text: 'E has no entry 1', value: 'refused', tone: 'bad' },
          ],
        },
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
      title: 'Lost writes',
      tag: 'concept',
      heading: 'Uncommitted entries can be lost, and that is safe',
      eli5: 'The captain scribbled a new rule in their own book and went home before telling anyone. The next captain never saw it. Nobody told the kid who asked that it was official, so asking again is fine.',
      body: [
        'Uncommitted entries have no majority protection. If the old leader accepted a write but crashed before a majority stored it, the new leader may never have seen it, and it is discarded.',
        'The client never got an answer for that write, so it must retry. Make those retries idempotent, for example with a request id, so a retry that did land is not applied twice.',
      ],
      keyIdea: 'A write with no OK may or may not have happened. Only a committed entry is promised.',
      metrics: { nodes: '4 of 5', quorum: '3', term: '2', leader: 'B', commit: '1' },
      metricTones: { commit: 'warn' },
      scene: {
        nodes: [
          { ...client, status: 'hot', badge: 'timeout' },
          { ...a, sub: 'crashed', status: 'down', chips: [{ text: 'entry 2: set 75', tone: 'bad' }] },
          { ...b, sub: 'leader', status: 'ok', tint: 'green', chips: ['log: 1'] },
          { ...c, status: 'ok', chips: ['log: 1'] },
        ],
        links: [link('client', 'a'), link('client', 'b', { style: 'faint' }), dash('b', 'c')],
        flows: [
          { path: ['client', 'a'], tone: 'request', label: 'set 75', duration: 1.2 },
          { path: ['a', 'client'], tone: 'error', label: 'no reply', duration: 1.2, delay: 1.5 },
          { path: ['client', 'b'], tone: 'request', label: 'retry set 75', duration: 1.4, delay: 3 },
        ],
        panel: {
          title: 'Entry 2 on the old leader',
          icon: 'Table',
          rows: [
            { text: 'Copies stored', value: '1 of 5', tone: 'bad' },
            { text: 'Committed', value: 'no', tone: 'bad' },
            { text: 'Client told OK', value: 'never' },
            { text: 'Client action', value: 'retry, idempotent', tone: 'good' },
          ],
        },
        caption: 'The new leader never saw entry 2',
      },
    },
    {
      title: 'Cut off',
      tag: 'case',
      heading: 'Case: the leader is stranded in the minority',
      eli5: 'A locked door splits the club: the captain and one kid on one side, three kids on the other. The captain keeps writing rules, but cannot get three books to hold them.',
      body: [
        'A is back as a follower. Then a switch fails and splits the cluster: leader B and node A on one side, C, D and E on the other. B does not know it is cut off and still accepts `set max_connections = 50` as entry 2.',
        'It reaches only A. Two copies are short of 3, so the entry never commits and the app gets a timeout, never an OK.',
      ],
      keyIdea: 'A leader without a majority can accept writes but cannot commit them.',
      metrics: { nodes: '2 + 3', quorum: '3', term: '2', leader: 'B (stuck)', commit: '1' },
      metricTones: { leader: 'bad' },
      scene: {
        zones: [
          { id: 'minor', from: [-2.4, 0], to: [-0.1, 4.6], label: 'minority: 2 of 5', tone: 'red' },
          { id: 'major', from: [0.3, -2.4], to: [4.8, 2.6], label: 'majority: 3 of 5', tone: 'green' },
        ],
        nodes: [
          { ...client, status: 'hot', badge: 'timeout' },
          { ...b, sub: 'stale leader', status: 'hot', tint: 'amber', chips: [{ text: 'entry 2: 2 of 5', tone: 'bad' }] },
          { ...a, badge: 'term 2' },
          { ...c, badge: 'term 2' },
        ],
        links: [link('client', 'b'), dash('b', 'a'), link('b', 'c', { style: 'faint', label: 'switch failed', labelTone: 'warn' })],
        flows: [
          { path: ['client', 'b'], tone: 'request', label: 'set 50', duration: 1.2 },
          { path: ['b', 'a'], tone: 'data', duration: 0.9, delay: 1.3 },
          { path: ['b', 'c'], tone: 'error', label: 'unreachable', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Entry 2: set 50',
          icon: 'Table',
          rows: [
            { text: 'Copies', value: 'B, A = 2 of 5', tone: 'bad' },
            { text: 'Needed', value: '3' },
            { text: 'Reply to the app', value: 'timeout', tone: 'bad' },
          ],
        },
        caption: 'Two copies are short of three',
      },
    },
    {
      title: 'New leader',
      tag: 'case',
      heading: 'Case: the majority side elects its own leader',
      eli5: 'On the other side of the door, three kids stop hearing the captain. They count to three, pick a new captain, and number that captain 3.',
      body: [
        'On the other side, heartbeats from B stop. D times out first, starts term 3, and asks for votes. C and E have never voted in term 3, so they say yes. With its own vote D has 3 of 5.',
        'B and A still sit in term 2 and have no idea. Two leaders now exist at once, in different terms. Only D can commit anything, because only D can reach a majority.',
      ],
      keyIdea: 'The majority side keeps going without waiting for the cut-off nodes.',
      metrics: { nodes: '2 + 3', quorum: '3', term: '3', leader: 'D', commit: '1' },
      metricTones: { leader: 'good' },
      scene: {
        zones: [{ id: 'major', from: [0.3, -2.4], to: [4.8, 2.6], label: 'majority: 3 of 5', tone: 'green' }],
        nodes: [
          { ...d, sub: 'leader', status: 'ok', tint: 'green', badge: 'term 3: 3 votes' },
          { ...c, status: 'ok', badge: 'voted D' },
          { ...e, status: 'ok', badge: 'voted D' },
          { ...b, sub: 'stale leader', status: 'dim', badge: 'still term 2' },
        ],
        links: [dash('d', 'c'), dash('d', 'e'), link('b', 'c', { style: 'faint', label: 'cut', labelTone: 'warn' })],
        flows: [
          { path: ['d', 'c'], tone: 'event', label: 'vote for me?', duration: 0.9 },
          { path: ['d', 'e'], tone: 'event', duration: 1.1 },
          { path: ['c', 'd'], tone: 'handshake', label: 'yes', duration: 0.9, delay: 1.2 },
          { path: ['e', 'd'], tone: 'handshake', label: 'yes', duration: 1.1, delay: 1.2 },
        ],
        panel: {
          title: 'Two leaders, two terms',
          icon: 'Users',
          rows: [
            { text: 'B, term 2', value: 'cannot commit', tone: 'bad' },
            { text: 'D, term 3', value: 'can commit', tone: 'good' },
          ],
          footer: { text: 'Only one side has a majority', tone: 'muted' },
        },
        caption: 'D wins term 3 with votes from C and E',
      },
    },
    {
      title: 'Commit on D',
      tag: 'case',
      heading: 'Case: the majority side keeps committing writes',
      eli5: 'Back on the three-kid side, someone asks the new captain for a rule. Three books copy it down, so it is official, while the stuck side still cannot get anything official.',
      body: [
        'App 2 writes `set max_connections = 300`. It lands on D, C and E: 3 of 5, committed as entry 2, and App 2 gets its OK.',
        'During the split the minority side refused work. That is the **C over A** choice from the CAP lesson: consistency over availability for the nodes that cannot reach a majority.',
      ],
      keyIdea: 'Only the majority side makes progress. The minority side pays with availability.',
      metrics: { nodes: '2 + 3', quorum: '3', term: '3', leader: 'D', commit: '2' },
      metricTones: { commit: 'good' },
      scene: {
        zones: [{ id: 'major', from: [0.3, -2.4], to: [4.8, 2.6], label: 'majority: 3 of 5', tone: 'green' }],
        nodes: [
          { ...client2, status: 'ok', badge: 'OK' },
          { ...d, sub: 'leader', status: 'active', tint: 'green', chips: ['entry 2: set 300'] },
          { ...c, status: 'ok', badge: 'log: 2' },
          { ...e, status: 'ok', badge: 'log: 2' },
        ],
        links: [link('client2', 'd'), dash('d', 'c'), dash('d', 'e')],
        flows: [
          { path: ['client2', 'd'], tone: 'request', label: 'set 300', duration: 1 },
          { path: ['d', 'c'], tone: 'data', duration: 0.8, delay: 1.1 },
          { path: ['d', 'e'], tone: 'data', duration: 0.8, delay: 1.1 },
          { path: ['d', 'client2'], tone: 'response', label: 'committed', duration: 1, delay: 2.3 },
        ],
        panel: {
          title: 'Entry 2: set 300',
          icon: 'Table',
          rows: [
            { text: 'Copies', value: 'D, C, E = 3 of 5', tone: 'good' },
            { text: 'Reply to the app', value: 'OK', tone: 'good' },
          ],
          footer: { text: 'The minority side refused work: C over A', tone: 'muted' },
        },
        caption: 'Only the side with 3 nodes can commit',
      },
    },
    {
      title: 'Heal',
      tag: 'case',
      heading: 'Case: the partition heals and one history survives',
      eli5: 'The door opens. The old captain hears "captain number 3 is in charge" and steps down. The unofficial rule in the old captain\'s book is crossed out and replaced with the official one.',
      body: [
        'When the switch is fixed, B receives a heartbeat carrying term 3, sees its own term 2 is old, and steps down. Its uncommitted entry 2 conflicts with the committed one and is deleted.',
        'Then A and B copy the real entry 2 from D. Exactly one history survives, and nothing that was ever acknowledged to a client is lost.',
      ],
      keyIdea: 'A stale leader demotes itself and its uncommitted entries are overwritten by the leader\'s log.',
      metrics: { nodes: '5 of 5', quorum: '3', term: '3', leader: 'D', commit: '2' },
      metricTones: { nodes: 'good', leader: 'good' },
      scene: {
        nodes: [
          { ...d, sub: 'leader', status: 'active', tint: 'green', badge: 'term 3' },
          { ...b, sub: 'follower', status: 'ok', badge: 'term 3: stepped down' },
          { ...a, status: 'ok', badge: 'copying entry 2' },
          { ...c, status: 'ok', badge: 'log: 2' },
        ],
        links: [dash('d', 'b'), dash('d', 'a'), dash('d', 'c')],
        flows: [
          { path: ['d', 'b'], tone: 'handshake', label: 'heartbeat: term 3', duration: 1.2 },
          { path: ['d', 'a'], tone: 'data', label: 'entry 2: set 300', duration: 1.4, delay: 1.4 },
          { path: ['d', 'b'], tone: 'data', duration: 1.2, delay: 1.4 },
        ],
        panel: {
          title: 'Node B, entry 2',
          icon: 'List',
          rows: [
            { text: 'Before', value: 'set 50, term 2', tone: 'bad' },
            { text: 'Conflict with D', value: 'deleted', tone: 'warn' },
            { text: 'After', value: 'set 300, term 3', tone: 'good' },
          ],
        },
        caption: 'One history survives',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'One leader, one log, decided by a majority',
      eli5: 'Five kids, one captain at a time, and nothing is official until three rule books have it. If the captain vanishes, three votes pick the next one. Two kids alone must wait.',
      body: [
        'No node can tell a dead peer from a slow network, so none decides alone. Raft needs a **majority** for elections and commits, and two majorities always overlap. **Terms** number the leaders, and a higher term demotes a stale one.',
        'The leader replicates its **log** and commits once a majority holds an entry. A random **election timeout** starts a new election, and only an up-to-date log can win. A minority never elects or commits. Part 2 covers log repair, reads, costs and real systems.',
      ],
      keyIdea: 'Majority overlap plus terms gives one history. N nodes survive (N - 1) / 2 failures, and the minority side always stops.',
      metrics: { nodes: '5 of 5', quorum: '3', term: '3', leader: 'D', commit: '3' },
      metricTones: { nodes: 'good', leader: 'good', commit: 'good' },
      scene: {
        nodes: [
          { ...a, status: 'ok', badge: 'log: 3' },
          { ...b, status: 'ok', badge: 'log: 3' },
          { ...c, status: 'ok', badge: 'log: 3' },
          { ...d, sub: 'leader', status: 'active', tint: 'green', badge: 'term 3' },
          { ...e, status: 'ok', badge: 'log: 3' },
        ],
        links: fan('d', ['a', 'b', 'c', 'e']),
        flows: [
          { path: ['d', 'a'], tone: 'data', duration: 1.2 },
          { path: ['d', 'b'], tone: 'data', duration: 1 },
          { path: ['d', 'c'], tone: 'data', duration: 0.8 },
          { path: ['d', 'e'], tone: 'data', duration: 0.9 },
          { path: ['a', 'd'], tone: 'handshake', label: 'ack', duration: 1.2, delay: 1.4 },
          { path: ['c', 'd'], tone: 'handshake', duration: 0.8, delay: 1.4 },
        ],
        panel: {
          title: 'Rules to keep',
          icon: 'Shield',
          rows: [
            { text: 'Majority', value: 'elects and commits', tone: 'good' },
            { text: 'Term', value: 'one leader, higher wins', tone: 'good' },
            { text: 'Vote rule', value: 'only up-to-date logs win', tone: 'good' },
            { text: 'Minority', value: 'stops', tone: 'warn' },
          ],
        },
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
