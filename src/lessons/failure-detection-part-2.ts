import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

// Six cluster members on a hexagon, so neighbors never stack on screen.
const a: SceneNode = { id: 'a', kind: 'server', at: at(-6, 0), label: 'node A' };
const b: SceneNode = { id: 'b', kind: 'server', at: at(-3, -5), label: 'node B' };
const c: SceneNode = { id: 'c', kind: 'server', at: at(3, -5), label: 'node C' };
const d: SceneNode = { id: 'd', kind: 'server', at: at(6, 0), label: 'node D' };
const e: SceneNode = { id: 'e', kind: 'server', at: at(3, 5), label: 'node E' };
const f: SceneNode = { id: 'f', kind: 'server', at: at(-3, 5), label: 'node F' };
const checker: SceneNode = { id: 'checker', kind: 'block', size: 0.8, at: at(0, 0), label: 'health checker', icon: 'Activity', tint: 'teal' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

export const failureDetectionPart2: Lesson = {
  id: 'failure-detection-part-2',
  title: 'Failure detection: gossip and recovery (part 2)',
  tagline: 'Scaling failure detection past one checker, and what a cluster does once it decides a node is gone.',
  minutes: 16,
  level: 'Advanced',
  learn: [
    'Why one checker and all-to-all heartbeats both stop scaling',
    'Ring neighbors as a cheaper middle ground',
    'Gossip: spreading membership through random peers, and how many rounds it needs',
    'Why gossip uses counters and local time, and why dead entries are kept for a while',
    'Indirect probes, suspicion, incarnation numbers and the SWIM loop',
    'Majority views during a partition, and how nodes join and leave',
    'What the cluster does once a node is declared dead: hinted handoff and anti-entropy',
  ],
  metrics: [
    { key: 'detect', label: 'Time to detect', icon: 'Timer' },
    { key: 'false', label: 'False alarms', icon: 'Zap' },
    { key: 'msgs', label: 'Messages/s', icon: 'Wifi' },
    { key: 'spread', label: 'Everyone knows in', icon: 'Share2' },
  ],
  steps: [
    {
      title: 'One checker',
      tag: 'problem',
      heading: 'One checker is a single point of failure',
      eli5: 'If only one teacher watches the whole class and that teacher gets lost, nobody is watching. And every kid has to wave at that one teacher.',
      body: [
        'A single health checker is simple, but it is a single point of failure. If it crashes, nobody detects anything.',
        'It also has to take in every heartbeat, so its load grows with the cluster. Doubling the nodes doubles its work.',
      ],
      keyIdea: 'One checker fails alone, and its load grows with the cluster.',
      metrics: { detect: '~6 s', false: 'rare', msgs: '6/s', spread: '1 hop' },
      metricTones: { msgs: 'warn' },
      scene: {
        nodes: [{ ...checker, status: 'hot', load: 91, badge: 'every heartbeat lands here' }, { ...a, status: 'ok' }, { ...b, status: 'ok' }, { ...d, status: 'ok' }],
        links: [link('a', 'checker', { style: 'faint' }), link('b', 'checker', { style: 'faint' }), link('d', 'checker', { style: 'faint' })],
        flows: [
          { path: ['a', 'checker'], tone: 'handshake', duration: 1 },
          { path: ['b', 'checker'], tone: 'handshake', duration: 1, delay: 0.2 },
          { path: ['d', 'checker'], tone: 'handshake', duration: 1, delay: 0.4 },
        ],
        panel: {
          title: 'Checker failure modes',
          icon: 'Server',
          rows: [
            { text: 'Checker crashes', value: 'nobody detects', tone: 'bad' },
            { text: 'Cluster doubles', value: 'checker load doubles', tone: 'warn' },
            { text: '10,000 nodes, 1 s interval', value: '10,000 msgs/s in', tone: 'bad' },
          ],
        },
        caption: 'Every node reports to one place',
      },
    },
    {
      title: 'Checker view',
      tag: 'concept',
      heading: 'The checker sees only its own network paths',
      eli5: 'If the teacher\'s glasses fog up, every kid looks missing. The kids are fine. Only the teacher\'s view is bad.',
      body: [
        'If the checker\'s own link is flaky, it sees healthy nodes as dead and tells the cluster so.',
        'The verdict reflects the path from the checker to each node, not the node itself. A single observer cannot tell the two apart.',
      ],
      keyIdea: 'One checker sees only the paths it can reach. Its bad link becomes false alarms about healthy nodes.',
      metrics: { detect: '~6 s', false: 'checker\'s mistakes', msgs: '6/s', spread: '1 hop' },
      metricTones: { false: 'bad' },
      scene: {
        nodes: [{ ...checker, status: 'hot', badge: 'its own link is flaky' }, { ...a, status: 'ok', badge: 'alive' }, { ...b, status: 'ok', badge: 'alive' }],
        links: [link('a', 'checker', { style: 'dashed', label: 'lossy link', labelTone: 'warn' }), link('b', 'checker', { style: 'faint' })],
        flows: [
          { path: ['a', 'checker'], tone: 'error', label: 'lost', duration: 1.2 },
          { path: ['checker', 'b'], tone: 'event', label: 'A is dead (wrong)', duration: 1.2, delay: 1.3 },
        ],
        caption: 'Healthy nodes look dead from the checker\'s side',
      },
    },
    {
      title: 'All to all',
      tag: 'tradeoff',
      heading: 'Everyone checking everyone grows as N squared',
      eli5: 'If every kid watches every other kid, they spend all day waving at each other and do nothing else. Three hundred kids means ninety thousand waves.',
      body: [
        'The opposite is **all-to-all**: every node heartbeats every other node. No single point of failure, but the message count grows with N². With 1,000 nodes and a 1 second interval, that is about **one million messages per second** just to say "still here".',
        'A small, critical group (a database primary and two replicas, a 5-node consensus cluster) can afford it. A large cluster needs a cost per node that stays flat.',
      ],
      keyIdea: 'A central checker does not survive its own failure, and all-to-all heartbeats grow as N². Large clusters need a third way.',
      metrics: { detect: '~6 s', false: 'rare', msgs: '1M/s at 1,000 nodes', spread: '1 hop' },
      metricTones: { msgs: 'bad' },
      scene: {
        nodes: [{ ...a, status: 'hot' }, { ...b, status: 'hot' }, { ...c, status: 'hot' }, { ...d, status: 'hot' }],
        links: [link('a', 'b', { arrow: 'both' }), link('b', 'c', { arrow: 'both' }), link('c', 'd', { arrow: 'both' }), link('a', 'd', { arrow: 'both' }), link('a', 'c', { arrow: 'both' }), link('b', 'd', { arrow: 'both' })],
        flows: [
          { path: ['a', 'b'], tone: 'handshake', duration: 0.9 },
          { path: ['b', 'c'], tone: 'handshake', duration: 0.9, delay: 0.3 },
          { path: ['c', 'd'], tone: 'handshake', duration: 0.9, delay: 0.6 },
          { path: ['d', 'a'], tone: 'handshake', duration: 0.9, delay: 0.9 },
          { path: ['a', 'c'], tone: 'handshake', duration: 0.9, delay: 1.2 },
          { path: ['d', 'b'], tone: 'handshake', label: 'every pair, every second', duration: 1.6, delay: 1.5 },
        ],
        panel: {
          title: 'Messages per second',
          icon: 'Table',
          rows: [
            { text: '6 nodes', value: '30', tone: 'good' },
            { text: '100 nodes', value: '9,900', tone: 'warn' },
            { text: '1,000 nodes', value: '~1,000,000', tone: 'bad' },
          ],
          footer: { text: 'N × (N - 1), one heartbeat per second', tone: 'muted' },
        },
        caption: 'Every pair, every second',
      },
    },
    {
      title: 'Ring neighbors',
      tag: 'tradeoff',
      heading: 'A middle path: watch only your neighbors on a ring',
      eli5: 'Put the kids in a circle and ask each one to watch only the kid on their left and right. Everyone is watched, and nobody waves at three hundred classmates.',
      body: [
        'Arrange nodes in a ring and let each heartbeat only its next one or two neighbors. Total traffic grows as N, and every node has a fixed few watchers.',
        'The catch is slow spread. A verdict has to travel around the ring, and one watcher is a thin view. Hierarchies of small groups with a leader per group have the same trade.',
      ],
      keyIdea: 'Neighbor heartbeats cut the cost to a constant per node, but a verdict spreads slowly and a node has few watchers.',
      metrics: { detect: '~6 s', false: 'rare', msgs: '2 per node/s', spread: 'N / 2 hops' },
      metricTones: { msgs: 'good', spread: 'warn' },
      scene: {
        nodes: [a, { ...b, status: 'active', badge: 'watches A and C' }, c, { ...d, status: 'dim' }],
        links: [link('b', 'a', { arrow: 'both' }), link('b', 'c', { arrow: 'both' })],
        flows: [
          { path: ['b', 'a'], tone: 'handshake', label: 'beat', duration: 1.1 },
          { path: ['b', 'c'], tone: 'handshake', label: 'beat', duration: 1.1, delay: 0.3 },
        ],
        panel: {
          title: 'Ring of 1,000 nodes',
          icon: 'Table',
          rows: [
            { text: 'Messages per second', value: '~2,000 total', tone: 'good' },
            { text: 'Watchers per node', value: '2', tone: 'warn' },
            { text: 'News travels', value: 'up to 500 hops', tone: 'bad' },
          ],
        },
        caption: 'Cheap, but a node has only two pairs of eyes',
      },
    },
    {
      title: 'Gossip',
      tag: 'concept',
      heading: 'Gossip: tell a random friend what you know',
      eli5: 'Each kid keeps a list of when they last heard from every classmate. Every minute they whisper their list to one random friend, and both keep the newest news. That whispering is **gossip**.',
      body: [
        'In a **gossip protocol**, every node keeps a membership table: for each member, a **heartbeat counter** and the local time that counter last went up. Each node increments its own counter every second.',
        'No node is special, and each sends a fixed number of messages per second however large the cluster is.',
      ],
      keyIdea: 'Gossip spreads heartbeat counters through random peers. Each node does constant work, and no single node decides alone.',
      metrics: { detect: '~10 s', false: 'rare', msgs: '1 per node/s', spread: 'a few rounds' },
      metricTones: { msgs: 'good' },
      scene: {
        nodes: [{ ...a, status: 'active', badge: 'A:812 B:640 C:377' }, { ...e, status: 'active', badge: 'merged table' }, { ...c, status: 'hot', badge: 'counter stuck' }],
        links: [link('a', 'e', { style: 'dashed', arrow: 'both' }), link('e', 'c', { style: 'faint' })],
        flows: [
          { path: ['a', 'e'], tone: 'event', label: 'my table', duration: 1.4 },
          { path: ['e', 'a'], tone: 'event', label: 'my table', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'A\'s membership table',
          icon: 'Table',
          rows: [
            { text: 'node A', value: 'counter 812, now' },
            { text: 'node B', value: 'counter 640, 1 s ago' },
            { text: 'node C', value: 'counter 377, 12 s ago', tone: 'warn' },
          ],
        },
        caption: 'Random pairs swap tables',
      },
    },
    {
      title: 'Merge rule',
      tag: 'concept',
      heading: 'One round: bump, pick a peer, keep the higher counter',
      eli5: 'When two kids compare lists, each name keeps the bigger number, because a bigger number means newer news. Nobody needs to know what time it is.',
      body: [
        'Each second a node bumps its own counter, picks a random peer and sends its table. The receiver merges entry by entry and keeps the higher counter.',
        'Higher always means newer, so the merge is the same in any order and safe to repeat. Duplicate or late messages do no harm.',
      ],
      keyIdea: 'The merge keeps the higher counter per member, so it is safe to repeat and to reorder.',
      metrics: { detect: '~10 s', false: 'rare', msgs: '1 per node/s', spread: 'a few rounds' },
      metricTones: { msgs: 'good' },
      scene: {
        nodes: [{ ...a, status: 'active', chips: ['B: 640'] }, { ...e, chips: ['B: 652'] }],
        links: [link('a', 'e', { arrow: 'both' })],
        flows: [
          { path: ['a', 'e'], tone: 'event', label: 'B: 640', duration: 1.3 },
          { path: ['e', 'a'], tone: 'event', label: 'B: 652', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'Merging B\'s entry',
          icon: 'Share2',
          rows: [
            { text: 'A holds', value: 'B: 640', tone: 'warn' },
            { text: 'E holds', value: 'B: 652', tone: 'good' },
            { text: 'After the merge, both hold', value: 'B: 652', tone: 'good' },
          ],
        },
        caption: 'The newer counter wins on both sides',
      },
      code: {
        language: 'python',
        title: 'One gossip round: bump, pick a peer, merge',
        source: `import random, time

# member id -> (heartbeat counter, local time it last increased)
table = {ME: (0, time.monotonic())}

def gossip_round():
    counter, _ = table[ME]
    table[ME] = (counter + 1, time.monotonic())       # I am alive
    peer = random.choice([m for m in table if m != ME])
    send(peer, {m: c for m, (c, _) in table.items()})

def on_gossip(their_counters):
    now = time.monotonic()
    for member, counter in their_counters.items():
        mine = table.get(member, (-1, now))[0]
        if counter > mine:                            # newer news wins
            table[member] = (counter, now)

def suspects(limit=10.0):
    now = time.monotonic()
    return [m for m, (_, t) in table.items() if now - t > limit]`,
        highlight: [8, 9, 16, 17, 21],
      },
    },
    {
      title: 'Counters, not clocks',
      tag: 'concept',
      heading: 'Why a counter, and why local time',
      eli5: 'The kids do not trust each other\'s watches, which all show different times. So each kid only counts waves, and judges quietness by their own watch.',
      body: [
        'Clocks on different machines disagree. If a heartbeat carried the sender\'s timestamp, a node with a slow clock would look permanently silent.',
        'So the table stores a counter that only goes up, plus the time **the receiver saw it rise**, on the receiver\'s own clock. Staleness is measured locally and never compared across machines.',
      ],
      keyIdea: 'Gossip compares counters across nodes and measures silence on the local clock, so it needs no synchronized time.',
      metrics: { detect: '~10 s', false: 'rare', msgs: '1 per node/s', spread: 'a few rounds' },
      metricTones: { msgs: 'good' },
      scene: {
        nodes: [{ ...a, chips: [{ text: 'clock: 12:00:00', tone: 'good' }] }, { ...e, chips: [{ text: 'clock: 11:59:41', tone: 'warn' }] }, { ...c, badge: 'counter 377' }],
        links: [link('a', 'e', { style: 'faint', label: 'clocks differ by 19 s', labelTone: 'warn' }), link('e', 'c', { style: 'faint' })],
        flows: [{ path: ['c', 'e'], tone: 'event', label: 'counter 377', duration: 1.4 }],
        panel: {
          title: 'Two ways to judge C',
          icon: 'Clock',
          rows: [
            { text: 'Sender timestamp', value: 'breaks with skewed clocks', tone: 'bad' },
            { text: 'Counter + local receive time', value: 'works', tone: 'good' },
          ],
        },
        caption: 'Each node trusts only its own watch',
      },
    },
    {
      title: 'Gossip verdict',
      tag: 'concept',
      heading: 'From a stuck counter to a verdict',
      eli5: 'If a kid\'s name stops showing up in anyone\'s whispers, the class first says "maybe lost", and later "lost". Each kid decides by their own list, with no vote.',
      body: [
        'If a member\'s counter has not risen for a while, say 10 seconds, the node marks it **suspect**, then **dead** if it stays quiet. Each node makes this call from its own table, with no vote.',
        'Nodes can briefly disagree, because their tables differ by a round or two. The tables converge, so the verdicts do too.',
      ],
      keyIdea: 'Each node judges silence from its own table. Verdicts agree because the tables converge.',
      metrics: { detect: '~10 s', false: 'rare', msgs: '1 per node/s', spread: 'a few rounds' },
      scene: {
        nodes: [{ ...a, status: 'active', chips: ['C: stuck 12 s'] }, { ...c, status: 'down', badge: 'no news' }, { ...e, chips: ['C: stuck 12 s'] }],
        links: [link('a', 'e', { style: 'dashed', arrow: 'both' }), link('a', 'c', { style: 'faint' })],
        flows: [{ path: ['a', 'e'], tone: 'event', label: 'C suspect', duration: 1.4 }, { path: ['e', 'a'], tone: 'event', label: 'C suspect', duration: 1.4, delay: 1.5 }],
        panel: {
          title: 'C\'s entry over time (example limits)',
          icon: 'Clock',
          rows: [
            { text: 'Counter rising', value: 'alive', tone: 'good' },
            { text: 'Stuck for 10 s', value: 'suspect', tone: 'warn' },
            { text: 'Stuck for 20 s', value: 'dead', tone: 'bad' },
          ],
        },
        caption: 'Each node reaches the same verdict from its own table',
      },
    },
    {
      title: 'Tombstones',
      tag: 'concept',
      heading: 'Keep dead entries for a while',
      eli5: 'After a kid is declared lost, the class keeps their name on the list for a day. If it were erased at once, an old whispered list would put the name right back.',
      body: [
        'A dead entry is kept for a cleanup period before it is deleted. If it were deleted at once, a stale table from a slow peer would bring it back as a new member.',
        'The kept entry is a **tombstone**. When it is finally deleted, every node has long since agreed, so no old table can revive it.',
      ],
      keyIdea: 'A dead entry stays as a tombstone until every node has had time to agree, so stale news cannot resurrect it.',
      metrics: { detect: '~10 s', false: 'rare', msgs: '1 per node/s', spread: 'a few rounds' },
      scene: {
        nodes: [{ ...a, chips: [{ text: 'C: dead (tombstone)', tone: 'bad' }] }, { ...e, status: 'dim', chips: [{ text: 'C: stuck 12 s', tone: 'warn' }], badge: 'slow, stale table' }, { ...c, status: 'down' }],
        links: [link('e', 'a', { style: 'dashed' }), link('a', 'c', { style: 'faint' })],
        flows: [{ path: ['e', 'a'], tone: 'event', label: 'old table: C seen', duration: 1.5 }],
        panel: {
          title: 'Why not delete at once',
          icon: 'Inbox',
          rows: [
            { text: 'Delete entry now', value: 'stale table revives C', tone: 'bad' },
            { text: 'Keep tombstone, cleanup later', value: 'stale news is ignored', tone: 'good' },
          ],
        },
        caption: 'The tombstone blocks the stale news',
      },
    },
    {
      title: 'Convergence',
      tag: 'concept',
      heading: 'How long until everyone knows?',
      eli5: 'One kid hears the news and tells a friend. Now two know, and each tells someone. Then four, then eight. A whole school hears in about the time it takes to double that many times.',
      body: [
        'Gossip spreads like a rumor. After one round, about 2 nodes know. After two, about 4. While most nodes have not heard yet, the number who know roughly **doubles each round**.',
        'Reaching N nodes takes on the order of **log₂ N** rounds, plus a few more for stragglers. For 1,000 nodes that is about 10, so with a 1 second round the whole cluster typically knows in **10 to 15 seconds**.',
      ],
      keyIdea: 'Gossip reaches all N nodes in roughly log₂ N rounds, so even very large clusters converge in seconds.',
      metrics: { detect: '~10 s', false: 'rare', msgs: '1 per node/s', spread: '~12 s at 1,000 nodes' },
      metricTones: { spread: 'good' },
      scene: {
        nodes: [{ ...a, status: 'ok', badge: 'round 1' }, { ...e, status: 'ok', badge: 'round 1' }, { ...f, status: 'ok', badge: 'round 2' }, { ...d, status: 'ok', badge: 'round 2' }, { ...b, badge: 'round 3' }],
        links: [link('a', 'e', { style: 'faint' }), link('e', 'd', { style: 'faint' }), link('a', 'f', { style: 'faint' }), link('f', 'b', { style: 'faint' })],
        flows: [
          { path: ['a', 'e'], tone: 'event', label: 'C is dead', duration: 1 },
          { path: ['a', 'f'], tone: 'event', duration: 1, delay: 1.1 },
          { path: ['e', 'd'], tone: 'event', duration: 1, delay: 1.1 },
          { path: ['f', 'b'], tone: 'event', duration: 1, delay: 2.2 },
        ],
        panel: {
          title: 'Nodes that know',
          icon: 'TrendingUp',
          rows: [
            { text: 'Round 0', value: '1' },
            { text: 'Round 1', value: '2' },
            { text: 'Round 2', value: '4' },
            { text: 'Round 3', value: '8' },
            { text: 'Round 10', value: '~1,000', tone: 'good' },
          ],
        },
        caption: '1, 2, 4, 8: the news doubles every round',
      },
      quiz: {
        question: 'A cluster of about 4,000 nodes gossips once per second to one random peer. Roughly how long until news from one node reaches all of them?',
        options: ['About 2 seconds', 'About 12 to 20 seconds', 'About 4,000 seconds', 'It never reaches all of them'],
        answer: 1,
        explain: 'log₂ 4,000 is about 12, so roughly 12 rounds to reach most nodes and a few more for the stragglers. At one round per second that is well under half a minute.',
      },
    },
    {
      title: 'Fanout',
      tag: 'tradeoff',
      heading: 'More peers per round: faster news, more messages',
      eli5: 'If each kid whispers to three friends instead of one, the news travels faster. But the whole class now makes three times the noise.',
      body: [
        'Gossiping to 3 peers per round instead of 1 means the informed group roughly quadruples each round, so 1,000 nodes need about 7 rounds instead of about 12. The cost is three times the messages.',
        'Gossip also does not give you a moment when everyone is known to agree. The view converges, and different nodes can disagree for a few seconds.',
      ],
      keyIdea: 'Fanout trades message cost for speed. Gossip converges, so expect short disagreement, never an instant of agreement.',
      metrics: { detect: '~10 s', false: 'rare', msgs: '3 per node/s', spread: '~7 s at 1,000 nodes' },
      metricTones: { spread: 'good', msgs: 'warn' },
      scene: {
        nodes: [{ ...a, status: 'active', badge: 'fanout 3' }, b, f, e],
        links: [link('a', 'b', { style: 'faint' }), link('a', 'f', { style: 'faint' }), link('a', 'e', { style: 'faint' })],
        flows: [
          { path: ['a', 'b'], tone: 'event', label: 'C is dead', duration: 1.2 },
          { path: ['a', 'f'], tone: 'event', duration: 1.2, delay: 0.2 },
          { path: ['a', 'e'], tone: 'event', duration: 1.2, delay: 0.4 },
        ],
        panel: {
          title: 'Rounds for 1,000 nodes',
          icon: 'Table',
          rows: [
            { text: 'Fanout 1', value: '~12 rounds, 1 msg/s' },
            { text: 'Fanout 3', value: '~7 rounds, 3 msg/s', tone: 'warn' },
          ],
          footer: { text: 'Approximate, including a few rounds for stragglers', tone: 'muted' },
        },
        caption: 'Three whispers per round instead of one',
      },
    },
    {
      title: 'Second opinion',
      tag: 'tradeoff',
      heading: 'Ask others before you accuse',
      eli5: 'Before calling the bathroom kid lost, the teacher asks two other kids "can you see Sam?". If anyone can, Sam is fine, and it was only the teacher who could not see.',
      body: [
        'A missed reply may mean the problem is on the path between two nodes, not in the target. **Indirect probing** handles this: when A cannot reach C, it asks a few other members to ping C on its behalf. If any of them gets an answer, C stays alive.',
        'This cuts false positives a lot, at the cost of a few extra messages and a few extra seconds before a real failure is confirmed.',
      ],
      keyIdea: 'Probe through other nodes. One node\'s bad link should never get a healthy peer evicted.',
      metrics: { detect: '~15 s', false: 'very rare', msgs: '1 to 4 per node/s', spread: '~12 s at 1,000 nodes' },
      metricTones: { false: 'good' },
      scene: {
        nodes: [{ ...a, status: 'active', badge: 'cannot reach C' }, b, { ...c, status: 'ok', badge: 'alive' }, d],
        links: [link('a', 'c', { style: 'dashed', label: 'bad link', labelTone: 'warn' }), link('a', 'b'), link('b', 'c'), link('c', 'd', { style: 'faint' })],
        flows: [
          { path: ['a', 'c'], tone: 'error', label: 'ping lost', duration: 1 },
          { path: ['a', 'b', 'c'], tone: 'request', label: 'ping C for me', duration: 1.4, delay: 1.1 },
          { path: ['c', 'b', 'a'], tone: 'response', label: 'C answered', duration: 1.4, delay: 2.6 },
        ],
        caption: 'A\'s link is broken. C is fine.',
      },
    },
    {
      title: 'Refutation',
      tag: 'concept',
      heading: 'Suspect, refute, or confirm',
      eli5: 'If even the helpers cannot find Sam, the teacher says "Sam might be lost" out loud. If Sam hears it, Sam shouts "I am here, number five!", and the class forgets the worry.',
      body: [
        'When the indirect probes fail too, C is marked **suspect** and that suspicion is gossiped. C itself will hear it. A live C answers by gossiping a higher **incarnation number**, which cancels the suspicion everywhere.',
        'Only if no refutation arrives within a set time is C declared dead.',
      ],
      keyIdea: 'A suspect gets a chance to refute the claim with a higher incarnation number before it is declared dead.',
      metrics: { detect: '~15 s', false: 'very rare', msgs: '1 to 4 per node/s', spread: '~12 s at 1,000 nodes' },
      metricTones: { false: 'good' },
      scene: {
        nodes: [{ ...a, chips: ['C suspect, inc 4'] }, { ...c, status: 'ok', badge: 'alive, inc 4 to 5' }, b],
        links: [link('a', 'b', { arrow: 'both' }), link('b', 'c', { arrow: 'both' })],
        flows: [
          { path: ['a', 'b', 'c'], tone: 'event', label: 'C suspect, inc 4', duration: 1.6 },
          { path: ['c', 'b', 'a'], tone: 'response', label: 'alive, inc 5', duration: 1.6, delay: 1.8 },
        ],
        panel: {
          title: 'Which claim wins',
          icon: 'Scale',
          rows: [
            { text: 'Suspect C at inc 4', value: 'older', tone: 'warn' },
            { text: 'Alive C at inc 5', value: 'newer, wins', tone: 'good' },
            { text: 'No refutation in time', value: 'declared dead', tone: 'bad' },
          ],
        },
        caption: 'C cancels the suspicion with a newer incarnation',
      },
    },
    {
      title: 'SWIM loop',
      tag: 'concept',
      heading: 'SWIM: probe one, ask helpers, piggyback the news',
      eli5: 'Each minute, every kid checks on just one random classmate. If that kid is quiet, they ask two helpers to check too. All news rides along on these small checks, with no extra notes.',
      body: [
        'In each protocol period (about 1 s), a node pings one random member. If there is no reply, it asks k other members to probe it. If those fail too, the target becomes suspect.',
        'Membership updates ride piggybacked on the ping and reply messages. Each node sends a fixed few messages per period, so the cost per node does not grow with N.',
      ],
      keyIdea: 'SWIM combines random probing, indirect probes, suspicion and piggybacked gossip for constant cost per node.',
      metrics: { detect: '~15 s', false: 'very rare', msgs: '1 to 4 per node/s', spread: '~12 s at 1,000 nodes' },
      metricTones: { false: 'good', msgs: 'good' },
      scene: {
        nodes: [{ ...a, status: 'active', badge: 'period: 1 s' }, { ...b, chips: ['probe C for A'] }, { ...c, status: 'hot', badge: 'no reply' }],
        links: [link('a', 'c', { style: 'dashed' }), link('a', 'b'), link('b', 'c')],
        flows: [
          { path: ['a', 'c'], tone: 'request', label: '1. ping', duration: 1 },
          { path: ['a', 'b'], tone: 'request', label: '2. ask helper', duration: 1, delay: 1.2 },
          { path: ['b', 'c'], tone: 'request', label: '3. helper pings', duration: 1, delay: 2.4 },
        ],
        panel: {
          title: 'One protocol period',
          icon: 'Repeat',
          rows: [
            { text: '1. Ping a random member', value: 'direct probe' },
            { text: '2. No reply', value: 'ask k helpers', tone: 'warn' },
            { text: '3. Still no reply', value: 'mark suspect', tone: 'warn' },
            { text: '4. No refutation in time', value: 'mark dead', tone: 'bad' },
          ],
          footer: { text: 'Updates ride on the pings. Several widely used membership libraries are built on SWIM.', tone: 'muted' },
        },
        caption: 'A fixed few messages per node per period',
      },
    },
    {
      title: 'Majority view',
      tag: 'concept',
      heading: 'When the network splits, who is dead?',
      eli5: 'A hallway door gets stuck shut and the class is split into two rooms. Each room thinks the other room vanished. The rule: only the room with most of the kids may keep making decisions.',
      body: [
        'In a **partition**, each side sees the other side as dead, and both sides run a perfectly good detector. Gossip cannot fix this, because the news cannot cross the break.',
        'A common rule is to act on a failure verdict only while you can see a **majority** of the cluster. The minority side is a choice. Consensus-style systems stop its writes. Dynamo-style systems keep writing with a sloppy quorum and hints, then reconcile after the heal.',
      ],
      keyIdea: 'A detector cannot separate "they died" from "I am cut off". Decide what each side does before you partition, not after.',
      metrics: { detect: '~15 s', false: 'both sides accuse', msgs: '1 to 4 per node/s', spread: 'blocked by split' },
      metricTones: { false: 'warn', spread: 'bad' },
      scene: {
        nodes: [{ ...a, status: 'ok', badge: 'majority: 4 of 6' }, { ...b, status: 'ok' }, { ...e, status: 'hot', badge: 'minority: 2 of 6' }, { ...f, status: 'hot' }],
        links: [link('a', 'b', { arrow: 'both' }), link('f', 'e', { arrow: 'both' }), link('b', 'e', { style: 'dashed', label: 'partition', labelTone: 'warn' })],
        flows: [
          { path: ['b', 'e'], tone: 'error', label: 'lost', duration: 1.4 },
          { path: ['a', 'b'], tone: 'event', label: 'E and F are dead', duration: 1.2, delay: 1.2 },
        ],
        panel: {
          title: 'Each side\'s view',
          icon: 'Split',
          rows: [
            { text: 'Majority side', value: 'keeps serving', tone: 'good' },
            { text: 'Minority side', value: 'stops writes, or keeps them with hints', tone: 'warn' },
            { text: 'After the heal', value: 'minority catches up' },
          ],
          footer: { text: 'Consensus stops the minority. Dynamo style keeps writing and reconciles.', tone: 'muted' },
        },
        caption: 'The split looks like two failures, one from each side',
      },
    },
    {
      title: 'Join and leave',
      tag: 'concept',
      heading: 'Joining through seeds, and leaving politely',
      eli5: 'A new kid asks one kid they already know for the class list, then starts waving. A kid who goes home says goodbye first, so nobody wastes time searching.',
      body: [
        'A new node contacts a **seed** node, gets the current member list and starts gossiping. Seeds are only a way in, not special once the node is in.',
        'A node that shuts down cleanly announces a **graceful leave**, so the others skip suspicion and act at once. Only a crash needs the timeout and the suspect path.',
      ],
      keyIdea: 'Seeds are an entry point only. A graceful leave skips detection, and only a crash needs it.',
      metrics: { detect: '~15 s', false: 'very rare', msgs: '1 to 4 per node/s', spread: '~12 s at 1,000 nodes' },
      scene: {
        nodes: [{ ...f, status: 'active', badge: 'new node' }, { ...a, badge: 'seed', chips: ['member list'] }, { ...d, status: 'ok', badge: 'leaving: goodbye' }],
        links: [link('f', 'a'), link('d', 'a', { style: 'faint' })],
        flows: [
          { path: ['f', 'a'], tone: 'handshake', label: 'join', duration: 1.2 },
          { path: ['a', 'f'], tone: 'response', label: 'member list', duration: 1.2, delay: 1.3 },
          { path: ['d', 'a'], tone: 'event', label: 'I am leaving', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'Three ways to change membership',
          icon: 'Users',
          rows: [
            { text: 'Join', value: 'ask a seed, then gossip', tone: 'good' },
            { text: 'Graceful leave', value: 'announce, no detection', tone: 'good' },
            { text: 'Crash', value: 'timeout, suspect, dead', tone: 'warn' },
          ],
        },
        caption: 'Only a crash needs the detector',
      },
    },
    {
      title: 'Sloppy quorum',
      tag: 'case',
      heading: 'After the verdict: keep writes flowing',
      eli5: 'While Sam is away, the teacher still has to hand out the homework. A write that cannot go to its usual owner goes to the next healthy kid instead.',
      body: [
        'Once C is suspected down, writes meant for it must go somewhere. With a **sloppy quorum**, the write goes to the next healthy node on the ring instead, along with a **hint** naming C as the real owner.',
        'This keeps the cluster writable during the failure. The price is that the write is not yet on its normal replica.',
      ],
      keyIdea: 'A sloppy quorum sends the write to the next healthy node, with a hint naming the real owner.',
      metrics: { detect: '~10 s', false: 'rare', msgs: '1 per node/s + hints', spread: '~12 s at 1,000 nodes' },
      scene: {
        nodes: [{ ...a, chips: ['write key 17'] }, { ...c, status: 'down', badge: 'down' }, { ...d, status: 'active', badge: 'stores hint for C', chips: ['key 17, hint: C'] }],
        links: [link('a', 'c', { style: 'dashed', label: 'unreachable', labelTone: 'warn' }), link('a', 'd'), link('d', 'c', { style: 'faint' })],
        flows: [
          { path: ['a', 'c'], tone: 'error', label: 'no ack', duration: 1.2 },
          { path: ['a', 'd'], tone: 'request', label: 'write + hint for C', duration: 1.4, delay: 1.3 },
        ],
        panel: {
          title: 'Write for key 17',
          icon: 'Inbox',
          rows: [
            { text: 'Owner', value: 'C, down', tone: 'bad' },
            { text: 'Stand-in', value: 'D, with a hint', tone: 'good' },
            { text: 'Write succeeds', value: 'yes, cluster stays up', tone: 'good' },
          ],
        },
        caption: 'D takes the write that was meant for C',
      },
    },
    {
      title: 'Hinted handoff',
      tag: 'case',
      heading: 'When C returns, D hands the writes back',
      eli5: 'D keeps a note with each homework sheet: "give this to Sam when they are back". When Sam returns, D hands the sheets over and throws the notes away.',
      body: [
        'When C returns, the stand-in node hands the hinted writes back and deletes them. This is **hinted handoff**.',
        'It only helps if C is back soon. Hints are kept for a limited time, so a long outage needs a different repair.',
      ],
      keyIdea: 'Hinted handoff repairs a short outage by returning the stored writes. A long outage needs anti-entropy.',
      metrics: { detect: '~10 s', false: 'rare', msgs: '1 per node/s + hints', spread: '~12 s at 1,000 nodes' },
      scene: {
        nodes: [{ ...c, status: 'ok', badge: 'back' }, { ...d, status: 'active', chips: ['key 17, hint: C'] }, { ...a }],
        links: [link('d', 'c'), link('a', 'd', { style: 'faint' })],
        flows: [
          { path: ['c', 'a'], tone: 'handshake', label: 'I am back', duration: 1.3 },
          { path: ['d', 'c'], tone: 'data', label: 'hand back key 17', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Handoff timeline',
          icon: 'Clock',
          rows: [
            { text: 'C down', value: 'D stores hints', tone: 'warn' },
            { text: 'C returns', value: 'D sends hints', tone: 'good' },
            { text: 'Handoff done', value: 'D deletes hints', tone: 'good' },
            { text: 'C down too long', value: 'hints expire', tone: 'bad' },
          ],
        },
        caption: 'D returns what it held for C',
      },
    },
    {
      title: 'Merkle trees',
      tag: 'concept',
      heading: 'When replicas drift: compare them with a hash tree',
      eli5: 'To check whether two kids have the same set of stickers, they compare the total first. If the totals match, they stop. If not, they compare half by half until they find the missing one.',
      body: [
        'Hints cover short outages. When a replica is gone for good, or it missed writes, **anti-entropy** repairs it by comparing data. A **Merkle tree** hashes each key range, then hashes of hashes up to one root.',
        'Two replicas compare roots. If they match, nothing is copied. If they differ, they walk down to the changed ranges. A node lost for good is replaced by streaming in a new replica, then kept in sync by the same anti-entropy. Read repair is the cheap path for hot keys.',
      ],
      keyIdea: 'Anti-entropy compares hash trees, so replicas find differences without shipping the data.',
      metrics: { detect: '~10 s', false: 'rare', msgs: '1 per node/s', spread: '~12 s at 1,000 nodes' },
      scene: {
        nodes: [{ ...d, status: 'active', badge: 'root 9f3a' }, { ...e, status: 'hot', badge: 'root 41c7' }],
        links: [link('d', 'e', { arrow: 'both', label: 'compare hashes' })],
        flows: [
          { path: ['d', 'e'], tone: 'request', label: 'root hash?', duration: 1.4 },
          { path: ['e', 'd'], tone: 'response', label: 'differs', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Hash tree, 8 buckets',
          icon: 'Hash',
          rows: [
            { text: 'Leaf', value: 'hash of one key range' },
            { text: 'Parent', value: 'hash of its two children' },
            { text: 'Root', value: 'one hash for everything' },
            { text: 'Roots equal', value: 'nothing to copy', tone: 'good' },
          ],
        },
        caption: 'One hash stands for the whole data set',
      },
    },
    {
      title: 'Walk the tree',
      tag: 'concept',
      heading: 'Descend only where the hashes differ',
      eli5: 'When the totals differ, the kids split their stickers into two piles and compare each pile. They only keep digging in the pile that does not match, until they find the missing sticker.',
      body: [
        'If the roots differ, the replicas walk down only the branches that differ. At the leaves they know exactly which key ranges to copy.',
        'The data moved is proportional to the difference, not to the size of the data set.',
      ],
      keyIdea: 'A Merkle tree finds exactly which key ranges differ, so repair copies only those.',
      metrics: { detect: '~10 s', false: 'rare', msgs: '1 per node/s', spread: '~12 s at 1,000 nodes' },
      scene: {
        nodes: [{ ...d, status: 'active', badge: 'root 9f3a' }, { ...e, status: 'hot', badge: 'root 41c7' }],
        links: [link('d', 'e', { arrow: 'both' })],
        flows: [
          { path: ['d', 'e'], tone: 'request', label: 'right half?', duration: 1.4 },
          { path: ['e', 'd'], tone: 'response', label: 'differs', duration: 1.4, delay: 1.5 },
          { path: ['d', 'e'], tone: 'data', label: 'copy bucket 3', duration: 1.4, delay: 3 },
        ],
        panel: {
          title: 'Walking down the tree',
          icon: 'Hash',
          rows: [
            { text: 'Root hash', value: 'differs', tone: 'warn' },
            { text: 'Left half', value: 'same', tone: 'good' },
            { text: 'Right half', value: 'differs', tone: 'warn' },
            { text: 'Bucket 3 of 8', value: 'differs: copy it', tone: 'bad' },
          ],
        },
        caption: 'Only the one bucket that differs is copied',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Spread the news cheaply, and repair the aftermath',
      eli5: 'Kids whisper to random friends so news spreads fast, friends double-check before raising the alarm, and a note-passing system plus a sticker count fix what went missing.',
      body: [
        'A central checker is a single point of failure and all-to-all costs N². **Gossip** converges in about log₂ N rounds at constant cost per node. Indirect probes, suspicion with incarnation numbers, and a majority rule keep a bad link from evicting a healthy node.',
        'After a verdict, hinted handoff covers short outages and Merkle trees repair the rest.',
      ],
      keyIdea: 'Detect with random probes and gossip, get a second opinion, and repair with hints and hash trees.',
      metrics: { detect: '~15 s', false: 'very rare', msgs: '1 to 4 per node/s', spread: '~12 s at 1,000 nodes' },
      metricTones: { false: 'good', spread: 'good' },
      scene: {
        nodes: [{ ...a, status: 'ok' }, { ...b, status: 'ok' }, { ...c, status: 'down', badge: 'confirmed dead' }, { ...d, status: 'ok' }, { ...e, status: 'ok' }],
        links: [link('a', 'b', { style: 'faint' }), link('d', 'e', { style: 'faint' }), link('b', 'd', { style: 'faint' }), link('a', 'e', { style: 'faint' })],
        flows: [
          { path: ['a', 'b'], tone: 'event', duration: 1 },
          { path: ['d', 'e'], tone: 'event', duration: 1, delay: 0.5 },
          { path: ['b', 'd'], tone: 'event', duration: 1, delay: 1 },
          { path: ['e', 'a'], tone: 'event', duration: 1, delay: 1.5 },
        ],
        caption: 'The cluster agrees C is gone and carries on',
      },
      quiz: {
        question: 'In a gossip cluster, node A cannot reach node C, but every other node can. What should keep C from being declared dead?',
        options: [
          'A shorter heartbeat timeout on A',
          'Indirect probes through other nodes, and C refuting the suspicion with a higher incarnation number',
          'Switching from gossip to a single central checker',
          'Raising the gossip fanout to every node',
        ],
        answer: 1,
        explain: 'The fault is on the A to C path. Asking other nodes to probe C shows it is alive, and if suspicion does spread, C cancels it by gossiping a newer incarnation.',
      },
    },
  ],
};
