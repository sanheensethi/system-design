import type { Lesson, SceneNode } from '../engine/types';

// Six cluster members in a zigzag row, so neighbors never stack on screen.
const a: SceneNode = { id: 'a', kind: 'server', at: [-3.5, 2], label: 'node A' };
const b: SceneNode = { id: 'b', kind: 'server', at: [-0.9, 2.4], label: 'node B' };
const c: SceneNode = { id: 'c', kind: 'server', at: [-1.3, -0.2], label: 'node C' };
const d: SceneNode = { id: 'd', kind: 'server', at: [1.3, 0.2], label: 'node D' };
const e: SceneNode = { id: 'e', kind: 'server', at: [0.9, -2.4], label: 'node E' };
const f: SceneNode = { id: 'f', kind: 'server', at: [3.5, -2], label: 'node F' };
const checker: SceneNode = { id: 'checker', kind: 'monitor', at: [-4, 4], label: 'health checker' };

const toChecker = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ from: id, to: 'checker', style: 'faint' as const }));
const mesh = [
  { from: 'a', to: 'b', style: 'faint' as const },
  { from: 'b', to: 'c', style: 'faint' as const },
  { from: 'c', to: 'd', style: 'faint' as const },
  { from: 'd', to: 'e', style: 'faint' as const },
  { from: 'e', to: 'f', style: 'faint' as const },
  { from: 'a', to: 'c', style: 'faint' as const },
  { from: 'd', to: 'f', style: 'faint' as const },
];

export const failureDetection: Lesson = {
  id: 'failure-detection',
  title: 'Failure detection: heartbeats and gossip',
  tagline: 'How a cluster decides that one of its machines has died, when it can never be sure.',
  minutes: 13,
  level: 'Advanced',
  learn: [
    'Why a remote node that is slow looks exactly like one that is dead',
    'Heartbeats and timeouts, and how to choose the timeout',
    'False positives: what a wrong "dead" verdict costs',
    'Phi accrual: a suspicion level in place of a yes or no',
    'Gossip: spreading membership through random peers',
    'How many rounds gossip needs to reach every node',
  ],
  metrics: [
    { key: 'detect', label: 'Time to detect' },
    { key: 'false', label: 'False alarms' },
    { key: 'msgs', label: 'Messages/s' },
    { key: 'spread', label: 'Everyone knows in' },
  ],
  steps: [
    {
      title: 'Slow or dead',
      tag: 'problem',
      heading: 'Node C stopped answering. Is it dead?',
      eli5: 'On a school trip, one kid does not answer when the teacher calls. Maybe they are lost, or maybe they are in the bathroom. From where the teacher stands, both look exactly the same. **Node C** is that quiet kid.',
      body: [
        'A six-node storage cluster splits its data across the members. Node C owns a slice of the keys. Requests to it have gone unanswered for 4 seconds.',
        'Many different things look the same from outside. C may have crashed. It may be alive but frozen in an 8 second garbage collection pause. Its network link may be down while it keeps serving others. Or it may be overloaded and answering everything late. The only signal you have is silence.',
        'Over an unreliable network there is no way to tell these apart for certain. Yet the cluster must decide. If C is dead, another node has to take over its keys. If C is alive and you act anyway, two nodes may both think they own the same keys.',
      ],
      keyIdea: 'A remote node that is slow and one that is dead send you the same thing: nothing. Failure detection is always a guess.',
      metrics: { detect: '?', false: '?', msgs: '-', spread: '-' },
      scene: {
        nodes: [a, b, { ...c, status: 'hot', badge: 'silent 4 s' }, d, e, f],
        links: mesh,
        flows: [
          { path: ['a', 'c'], tone: 'request', label: 'read key 17', duration: 1.2 },
          { path: ['d', 'c'], tone: 'request', duration: 1.2, delay: 0.4 },
          { path: ['c', 'a'], tone: 'error', label: 'no reply', duration: 2.4, delay: 1.3 },
        ],
        caption: 'Crashed, paused or cut off? It all looks like silence.',
      },
    },
    {
      title: 'Heartbeats',
      tag: 'concept',
      heading: 'Heartbeats: "I am alive" on a timer',
      eli5: 'The teacher says: wave at me every minute. If a kid has not waved for five minutes, the teacher starts looking for them. The wave is a **heartbeat**.',
      body: [
        'Each node sends a small **heartbeat** message to a health checker every second. The checker records the time of the last heartbeat from each node.',
        'If no heartbeat arrives for longer than a **timeout**, here 5 seconds, the checker marks the node dead and tells the rest of the cluster. Detection time is roughly the timeout plus one interval.',
        'The variant where the checker sends a ping and waits for a reply works the same way. Either way the decision is made on a timer, so everything in the previous lesson about choosing timeouts applies here too.',
      ],
      keyIdea: 'A heartbeat turns "is it alive?" into "has it spoken recently?", which you can measure.',
      metrics: { detect: '~6 s', false: '?', msgs: '6/s', spread: '1 hop' },
      scene: {
        nodes: [{ ...checker, status: 'active', badge: 'timeout 5 s' }, a, b, { ...c, status: 'down', badge: 'last seen 6 s ago' }, d, e, f],
        links: toChecker,
        flows: [
          { path: ['a', 'checker'], tone: 'handshake', label: 'alive', duration: 1 },
          { path: ['b', 'checker'], tone: 'handshake', duration: 1, delay: 0.2 },
          { path: ['d', 'checker'], tone: 'handshake', duration: 1.2, delay: 0.4 },
          { path: ['e', 'checker'], tone: 'handshake', duration: 1.2, delay: 0.6 },
          { path: ['f', 'checker'], tone: 'handshake', duration: 1.4, delay: 0.8 },
          { path: ['checker', 'b'], tone: 'event', label: 'C is dead', duration: 1, delay: 2.4 },
        ],
        caption: 'Five nodes check in. C has gone quiet.',
      },
      code: {
        language: 'python',
        title: 'Heartbeat sender and timeout checker',
        source: `import time

INTERVAL, TIMEOUT = 1.0, 5.0          # seconds
last_seen = {}                        # node id -> monotonic time

def on_heartbeat(node_id):            # runs on the checker
    last_seen[node_id] = time.monotonic()

def check_loop():
    while True:
        now = time.monotonic()
        for node_id, seen in list(last_seen.items()):
            if now - seen > TIMEOUT:
                mark_dead(node_id)    # hand its keys to others
                del last_seen[node_id]
        time.sleep(INTERVAL)

def heartbeat_loop(me):               # runs on every node
    while True:
        send(CHECKER, {"type": "alive", "from": me})
        time.sleep(INTERVAL)`,
        highlight: [7, 13, 14, 20],
      },
    },
    {
      title: 'The timeout',
      tag: 'tradeoff',
      heading: 'Short timeouts lie, long ones are slow',
      eli5: 'If the teacher panics after one missed wave, the bathroom kid causes a search party every day. If the teacher waits an hour, a lost kid stays lost for an hour.',
      body: [
        'A **short timeout** detects a real crash fast, but it also fires on a node that is merely paused, overloaded or behind a busy network link. That is a **false positive**: a healthy node declared dead.',
        'A **long timeout** almost never lies, but a crashed node keeps receiving requests until the timer runs out. With a 30 second timeout, every request routed to it in that window fails or waits.',
        'Measure what "normal" looks like before picking. If heartbeats on your network sometimes arrive 3 seconds late during busy periods, a 2 second timeout will produce false alarms every day. Most clusters land somewhere between a few seconds and about 30.',
      ],
      keyIdea: 'Every timeout trades detection speed against false alarms. You cannot have both at zero.',
      metrics: { detect: '~3 s', false: '4/day', msgs: '6/s', spread: '1 hop' },
      scene: {
        nodes: [{ ...checker, status: 'active', badge: 'timeout 2 s' }, a, b, { ...c, status: 'hot', badge: 'heartbeat 3 s late' }, d, e, f],
        links: toChecker,
        flows: [
          { path: ['a', 'checker'], tone: 'handshake', duration: 1 },
          { path: ['d', 'checker'], tone: 'handshake', duration: 1.2, delay: 0.3 },
          { path: ['c', 'checker'], tone: 'handshake', label: 'late but alive', duration: 3.2, delay: 0.2 },
          { path: ['checker', 'b'], tone: 'error', label: 'C is dead (wrong)', duration: 1, delay: 2.2 },
        ],
        caption: 'The checker gives up just before the heartbeat lands',
      },
      quiz: {
        question: 'Heartbeats go out every 1 s. Under load, they occasionally arrive up to 4 s apart. Which timeout avoids routine false alarms while still detecting crashes reasonably fast?',
        options: ['1 s', '2 s', '8 s', '5 minutes'],
        answer: 2,
        explain: 'The timeout has to sit above the worst normal gap of 4 s, with some margin. 8 s does that and still detects a crash within about 9 s. One or two seconds fire on normal delays, and five minutes leaves a dead node in service far too long.',
      },
    },
    {
      title: 'False alarm',
      tag: 'case',
      heading: 'Case: the garbage collector that got a node evicted',
      eli5: 'The bathroom kid comes back and says "I am here!", but the teacher already gave their seat to someone else. Now two kids think the seat is theirs.',
      body: [
        'Node C hits a 7 second garbage collection pause. With a 5 second timeout, the cluster declares it dead and node D starts serving C\'s keys. It also starts copying data to restore the replica count, which loads the network and the disks.',
        'Two seconds later C wakes up and carries on as if nothing happened. For a moment both C and D accept writes for the same keys. When C\'s heartbeats resume it rejoins, and the copying runs again in reverse. If this repeats, the node **flaps** in and out of the cluster and the rebalancing never stops.',
        'Defenses: a **suspect** state before **dead**, so one missed timeout does not trigger expensive action. A node that was declared dead must rejoin with a new **incarnation number**, so its stale claims lose to newer ones. And anything that must never have two owners, such as a primary, needs a lease or fencing token, as covered in the replication lesson.',
      ],
      keyIdea: 'Assume the detector will sometimes be wrong. Make a wrong "dead" verdict cheap and safe, not just rare.',
      metrics: { detect: '~6 s', false: '1 eviction', msgs: '6/s', spread: '1 hop' },
      scene: {
        nodes: [{ ...checker, status: 'active' }, a, b, { ...c, status: 'hot', badge: 'back after GC' }, { ...d, status: 'hot', badge: 'took over C\'s keys' }, e, f],
        links: [...toChecker, { from: 'c', to: 'd', style: 'dashed' as const }],
        flows: [
          { path: ['checker', 'd'], tone: 'event', label: 'take C\'s keys', duration: 1.2 },
          { path: ['c', 'd'], tone: 'data', label: 'rebalance', count: 3, duration: 1.4, delay: 1.3 },
          { path: ['c', 'checker'], tone: 'handshake', label: 'I am alive!', duration: 1.2, delay: 2.4 },
        ],
        caption: 'A pause looked like a crash, and both nodes claim the keys',
      },
    },
    {
      title: 'Phi accrual',
      tag: 'concept',
      heading: 'Phi accrual: how suspicious, not yes or no',
      eli5: 'A smart teacher remembers that Sam always waves late, but Mia never does. A missing wave from Mia is more worrying than one from Sam. The **phi** score is how worried the teacher is.',
      body: [
        'A fixed timeout treats every node and every network the same. The **phi accrual detector** instead keeps a history of the gaps between heartbeats from each node, and turns "time since the last one" into a suspicion level called **phi** (φ).',
        'Phi answers: given how this node usually behaves, how unlikely is a silence this long? φ = 1 means a healthy node would stay silent this long about 10% of the time. φ = 2 means about 1%, φ = 3 about 0.1%. Each step of 1 is ten times more sure.',
        'Each consumer picks its own threshold. A load balancer might stop routing at a low φ, while a rebalancer waits for a high one before moving data. Cassandra uses this detector with a default threshold of 8. On a jittery network the history widens and the detector becomes patient by itself.',
      ],
      keyIdea: 'Phi accrual adapts to each node\'s normal timing and gives a confidence score, so each action can pick its own threshold.',
      metrics: { detect: 'adapts', false: 'rare', msgs: '6/s', spread: '1 hop' },
      scene: {
        nodes: [{ ...checker, status: 'active', badge: 'φ per node' }, { ...a, badge: 'φ 0.2' }, { ...b, badge: 'φ 0.4' }, { ...c, status: 'hot', badge: 'φ 6.1 suspect' }, { ...d, badge: 'φ 0.3' }, e, f],
        links: toChecker,
        flows: [
          { path: ['a', 'checker'], tone: 'handshake', duration: 1 },
          { path: ['b', 'checker'], tone: 'handshake', duration: 1, delay: 0.5 },
          { path: ['d', 'checker'], tone: 'handshake', duration: 1.2, delay: 1 },
          { path: ['e', 'checker'], tone: 'handshake', duration: 1.2, delay: 1.5 },
          { path: ['f', 'checker'], tone: 'handshake', duration: 1.4, delay: 2 },
        ],
        caption: 'Suspicion grows smoothly the longer C stays quiet',
      },
      code: {
        language: 'python',
        title: 'Phi from heartbeat history (exponential model)',
        source: `import math, time
from collections import deque

class PhiDetector:
    def __init__(self, window=1000):
        self.gaps = deque(maxlen=window)     # recent gaps between heartbeats
        self.last = None

    def heartbeat(self):
        now = time.monotonic()
        if self.last is not None:
            self.gaps.append(now - self.last)
        self.last = now

    def phi(self):
        mean = sum(self.gaps) / len(self.gaps)
        silent = time.monotonic() - self.last
        # P(still alive) = e^(-silent/mean), and phi = -log10 of that
        return silent / mean * math.log10(math.e)

# mark_down = detector.phi() > 8`,
        highlight: [12, 17, 19, 21],
      },
    },
    {
      title: 'Scaling it',
      tag: 'concept',
      heading: 'One checker, or everyone checking everyone?',
      eli5: 'One teacher cannot watch three hundred kids at once. If every kid watches every other kid, they do nothing but wave all day.',
      body: [
        'A single health checker is simple, but it is a single point of failure, and the cluster depends on its view of the network. If the checker\'s own link is flaky, it sees healthy nodes as dead.',
        'The opposite is **all-to-all**: every node heartbeats every other node. No single point of failure, but the message count grows with N². With 1,000 nodes and a 1 second interval, that is about **one million messages per second** just to say "still here".',
        'A small, critical group (a database primary and two replicas, a 5-node consensus cluster) can afford all-to-all. A cluster of hundreds or thousands needs something whose cost per node stays flat as the cluster grows.',
      ],
      keyIdea: 'A central checker does not survive its own failure, and all-to-all heartbeats grow as N². Large clusters need a third way.',
      metrics: { detect: '~6 s', false: 'rare', msgs: '1M/s at 1,000 nodes', spread: '1 hop' },
      scene: {
        nodes: [a, b, c, d, e, f],
        links: mesh,
        flows: [
          { path: ['a', 'b'], tone: 'handshake', duration: 0.9 },
          { path: ['a', 'c'], tone: 'handshake', duration: 0.9 },
          { path: ['b', 'c'], tone: 'handshake', duration: 0.9, delay: 0.3 },
          { path: ['c', 'd'], tone: 'handshake', duration: 0.9, delay: 0.3 },
          { path: ['d', 'e'], tone: 'handshake', duration: 0.9, delay: 0.6 },
          { path: ['e', 'f'], tone: 'handshake', duration: 0.9, delay: 0.6 },
          { path: ['d', 'f'], tone: 'handshake', duration: 0.9, delay: 0.9 },
          { path: ['f', 'a'], tone: 'handshake', label: 'N x N messages', duration: 1.6, delay: 0.9 },
        ],
        caption: 'Every pair, every second',
      },
    },
    {
      title: 'Gossip',
      tag: 'concept',
      heading: 'Gossip: tell a random friend what you know',
      eli5: 'Each kid keeps a list of when they last heard from every classmate. Every minute they whisper their list to one random friend, and both keep the newest news. That whispering is **gossip**.',
      body: [
        'In a **gossip protocol**, every node keeps a membership table: for each member, a **heartbeat counter** and the local time that counter last went up. Each node increments its own counter every second.',
        'Every second, each node picks one or a few **random peers** and sends them its table. The receiver merges entry by entry, keeping the higher counter. A counter going up anywhere in the cluster eventually reaches everyone, carried hop by hop.',
        'If a member\'s counter has not risen for a while, say 10 seconds, the node marks it **suspect**, then **dead** if it stays quiet. No node is special, and each one sends a fixed number of messages per second however large the cluster is.',
      ],
      keyIdea: 'Gossip spreads heartbeat counters through random peers. Each node does constant work, and no single node decides alone.',
      metrics: { detect: '~10 s', false: 'rare', msgs: '1 per node/s', spread: 'a few rounds' },
      scene: {
        nodes: [{ ...a, status: 'active', badge: 'A:812 B:640 C:377' }, b, { ...c, status: 'hot', badge: 'counter stuck' }, d, { ...e, status: 'active', badge: 'merged table' }, f],
        links: [...mesh, { from: 'a', to: 'e', style: 'dashed' as const }],
        flows: [
          { path: ['a', 'e'], tone: 'event', label: 'my table', duration: 1.4 },
          { path: ['e', 'a'], tone: 'event', label: 'my table', duration: 1.4, delay: 1.5 },
          { path: ['d', 'b'], tone: 'event', duration: 1.4, delay: 0.5 },
          { path: ['f', 'd'], tone: 'event', duration: 1.2, delay: 1 },
        ],
        caption: 'Random pairs swap tables and keep the higher counters',
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
      title: 'Convergence',
      tag: 'concept',
      heading: 'How long until everyone knows?',
      eli5: 'One kid hears the news and tells a friend. Now two know, and each tells someone. Then four, then eight. A whole school hears in about the time it takes to double that many times.',
      body: [
        'Gossip spreads like a rumor. After one round, about 2 nodes know. After two, about 4. While most nodes have not heard yet, the number who know roughly **doubles each round**.',
        'So reaching N nodes takes on the order of **log₂ N** rounds, plus a few more to catch the last stragglers, since late in the process most picks land on nodes that already know. For 1,000 nodes, log₂ 1,000 is about 10. With a 1 second round, the whole cluster typically knows in **10 to 15 seconds**.',
        'Doubling the cluster adds about one round. Gossiping to 3 peers per round instead of 1 shortens it further, at three times the messages. What gossip does not give you is a moment when everyone is known to agree. The view converges, and different nodes can disagree for a few seconds.',
      ],
      keyIdea: 'Gossip reaches all N nodes in roughly log₂ N rounds, so even very large clusters converge in seconds.',
      metrics: { detect: '~10 s', false: 'rare', msgs: '1 per node/s', spread: '~12 s at 1,000 nodes' },
      scene: {
        nodes: [{ ...a, status: 'ok', badge: 'round 1' }, { ...b, status: 'ok', badge: 'round 2' }, { ...c, status: 'down' }, { ...d, status: 'ok', badge: 'round 2' }, { ...e, status: 'ok', badge: 'round 1' }, { ...f, badge: 'round 3' }],
        links: mesh,
        flows: [
          { path: ['a', 'e'], tone: 'event', label: 'C is dead', duration: 1 },
          { path: ['a', 'b'], tone: 'event', duration: 1, delay: 1.1 },
          { path: ['e', 'd'], tone: 'event', duration: 1, delay: 1.1 },
          { path: ['d', 'f'], tone: 'event', duration: 1, delay: 2.2 },
        ],
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
      title: 'Second opinion',
      tag: 'tradeoff',
      heading: 'Ask others before you accuse',
      eli5: 'Before calling the bathroom kid lost, the teacher asks two other kids "can you see Sam?". If anyone can, Sam is fine, and it was only the teacher who could not see.',
      body: [
        'A missed reply may mean the problem is on the path between two nodes, not in the target. **Indirect probing** handles this: when A cannot reach C, it asks a few other members to ping C on its behalf. If any of them gets an answer, C stays alive.',
        'When the probes fail too, C is marked **suspect** and that suspicion is gossiped. C itself will hear it. A live C answers by gossiping a higher **incarnation number**, which cancels the suspicion everywhere. Only if no refutation arrives within a set time is C declared dead.',
        'This combination of random probing, indirect probes, suspicion and gossip comes from the SWIM protocol, and several widely used membership libraries are built on it. It cuts false positives a lot, at the cost of a few extra seconds before a real failure is confirmed.',
      ],
      keyIdea: 'Probe through other nodes and let a suspect refute the claim. One node\'s bad link should never get a healthy peer evicted.',
      metrics: { detect: '~15 s', false: 'very rare', msgs: '1 to 4 per node/s', spread: '~12 s at 1,000 nodes' },
      scene: {
        nodes: [{ ...a, status: 'active', badge: 'cannot reach C' }, b, { ...c, status: 'ok', badge: 'alive, inc 4' }, d, e, f],
        links: [
          { from: 'a', to: 'c', style: 'dashed' as const, label: 'bad link' },
          { from: 'a', to: 'b' },
          { from: 'b', to: 'c' },
          { from: 'c', to: 'd' },
          { from: 'a', to: 'd', style: 'faint' as const },
        ],
        flows: [
          { path: ['a', 'c'], tone: 'error', label: 'ping lost', duration: 1 },
          { path: ['a', 'b', 'c'], tone: 'request', label: 'ping C for me', duration: 1.4, delay: 1.1 },
          { path: ['c', 'b', 'a'], tone: 'response', label: 'C answered', duration: 1.4, delay: 2.6 },
          { path: ['a', 'd', 'c'], tone: 'request', duration: 1.4, delay: 1.1 },
        ],
        caption: 'A\'s link is broken. C is fine.',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Guess carefully, spread the news cheaply',
      eli5: 'Kids wave on a timer, the teacher worries more the longer someone is quiet, friends double-check before raising the alarm, and news spreads by whispering to random friends.',
      body: [
        'You cannot tell slow from dead, so every detector guesses. **Heartbeats** with a **timeout** are the basic tool, and the timeout trades detection speed against **false positives**. **Phi accrual** learns each node\'s normal timing and reports a suspicion level that each action can threshold differently.',
        'A central checker is a single point of failure and all-to-all heartbeats cost N². **Gossip** spreads heartbeat counters through random peers at constant cost per node and converges in about log₂ N rounds. Indirect probes and a suspect state with incarnation numbers keep a bad link from evicting a healthy node.',
      ],
      keyIdea: 'Detection is a guess, so make it adaptive, get a second opinion, and design for the times it is wrong.',
      metrics: { detect: '~15 s', false: 'very rare', msgs: '1 to 4 per node/s', spread: '~12 s at 1,000 nodes' },
      scene: {
        nodes: [{ ...a, status: 'ok' }, { ...b, status: 'ok' }, { ...c, status: 'down', badge: 'confirmed dead' }, { ...d, status: 'ok' }, { ...e, status: 'ok' }, { ...f, status: 'ok' }],
        links: mesh,
        flows: [
          { path: ['a', 'b'], tone: 'event', duration: 1 },
          { path: ['d', 'e'], tone: 'event', duration: 1, delay: 0.5 },
          { path: ['e', 'f'], tone: 'event', duration: 1, delay: 1 },
          { path: ['b', 'a'], tone: 'event', duration: 1, delay: 1.5 },
        ],
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
