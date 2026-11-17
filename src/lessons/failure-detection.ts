import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

// Cluster members on a hexagon, so neighbors never stack on screen.
const a: SceneNode = { id: 'a', kind: 'server', at: at(-6, 0), label: 'node A' };
const b: SceneNode = { id: 'b', kind: 'server', at: at(-3, -5), label: 'node B' };
const c: SceneNode = { id: 'c', kind: 'server', at: at(3, -5), label: 'node C' };
const d: SceneNode = { id: 'd', kind: 'server', at: at(6, 0), label: 'node D' };
const checker: SceneNode = { id: 'checker', kind: 'block', size: 0.8, at: at(0, 0), label: 'health checker', icon: 'Activity', tint: 'teal' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

export const failureDetection: Lesson = {
  id: 'failure-detection',
  title: 'Failure detection: heartbeats and timeouts (part 1)',
  tagline: 'How a cluster decides that one of its machines has died, when it can never be sure.',
  minutes: 15,
  level: 'Advanced',
  learn: [
    'Why a remote node that is slow looks exactly like one that is dead',
    'What a detector promises: completeness and accuracy',
    'Heartbeats, pings, leases and deep health checks',
    'How to choose a timeout, and what a wrong "dead" verdict costs',
    'Making a wrong verdict cheap: a suspect state and fencing',
    'Phi accrual: a suspicion level in place of a yes or no',
    'Part 2 covers scaling the detector with gossip, indirect probes and what happens after a verdict',
  ],
  metrics: [
    { key: 'detect', label: 'Time to detect', icon: 'Timer' },
    { key: 'false', label: 'False alarms', icon: 'Zap' },
    { key: 'msgs', label: 'Messages/s', icon: 'Wifi' },
    { key: 'spread', label: 'Everyone knows in', icon: 'Share2' },
  ],
  steps: [
    {
      title: 'Slow or dead',
      tag: 'problem',
      heading: 'Node C stopped answering. Is it dead?',
      eli5: 'On a school trip, one kid does not answer when the teacher calls. Maybe they are lost, or maybe they are in the bathroom. From where the teacher stands, both look the same. **Node C** is that quiet kid.',
      body: [
        'A six-node storage cluster splits its keys across the members. Node C owns a slice of them. Requests to it have gone unanswered for 4 seconds.',
        'The cluster must decide now. If C is dead, another node has to take over its keys. If C is alive and you act anyway, two nodes may both think they own the same keys.',
      ],
      keyIdea: 'The only signal you get from a remote node is a reply or silence, and silence is all you have to decide on.',
      metrics: { detect: '?', false: '?', msgs: '-', spread: '-' },
      metricTones: { detect: 'warn', false: 'warn' },
      scene: {
        nodes: [
          { ...a, chips: ['read key 17'] },
          { ...c, status: 'hot', badge: 'silent 4 s' },
          { ...d, chips: ['read key 17'] },
        ],
        links: [link('a', 'c', { style: 'faint' }), link('d', 'c', { style: 'faint' })],
        flows: [
          { path: ['a', 'c'], tone: 'request', label: 'read key 17', duration: 1.2 },
          { path: ['d', 'c'], tone: 'request', duration: 1.2, delay: 0.4 },
          { path: ['c', 'a'], tone: 'error', label: 'no reply', duration: 2.4, delay: 1.3 },
        ],
        panel: {
          title: 'What A knows about C',
          icon: 'Search',
          rows: [
            { text: 'Requests sent', value: '2' },
            { text: 'Replies received', value: '0', tone: 'bad' },
            { text: 'Silent for', value: '4 s', tone: 'warn' },
            { text: 'Is C dead?', value: 'unknown', tone: 'warn' },
          ],
        },
        caption: 'Crashed, paused or cut off? It all looks like silence.',
      },
    },
    {
      title: 'Four faults',
      tag: 'concept',
      heading: 'Four different faults, one symptom',
      eli5: 'The quiet kid could be lost, asleep, behind a closed door, or just very slow at answering. The teacher cannot see through the door, so every case looks the same.',
      body: [
        'C may have **crashed**. It may be alive but frozen in an 8 second garbage collection pause. Its network link may be down while it keeps serving others. Or it may be overloaded and answering everything late.',
        'Over an unreliable network there is no way to tell these apart for certain. Every failure detector is a guess, and the rest of this lesson is about guessing well.',
      ],
      keyIdea: 'Crashed, paused, cut off and overloaded all send the same thing: nothing. Failure detection is always a guess.',
      metrics: { detect: '?', false: '?', msgs: '-', spread: '-' },
      metricTones: { detect: 'warn', false: 'warn' },
      scene: {
        nodes: [{ ...a, status: 'active', badge: 'sees silence' }, { ...c, status: 'hot', badge: 'which fault?' }, { ...d, status: 'dim' }],
        links: [link('a', 'c', { style: 'dashed', label: 'no reply', labelTone: 'warn' })],
        flows: [{ path: ['a', 'c'], tone: 'request', label: 'ping', duration: 1.2 }, { path: ['c', 'a'], tone: 'error', label: 'silence', duration: 2, delay: 1.3 }],
        panel: {
          title: 'Same symptom, four causes',
          icon: 'Bug',
          rows: [
            { text: 'Process crashed', value: 'silence', tone: 'bad' },
            { text: 'GC pause, 8 s', value: 'silence', tone: 'warn' },
            { text: 'Link down', value: 'silence', tone: 'warn' },
            { text: 'Overloaded, answers late', value: 'silence', tone: 'warn' },
          ],
          footer: { text: 'Only the first one needs a takeover', tone: 'muted' },
        },
        caption: 'Four different worlds, one observation',
      },
    },
    {
      title: 'Two promises',
      tag: 'concept',
      heading: 'What a detector promises: completeness and accuracy',
      eli5: 'A good teacher wants two things. Every lost kid gets found sooner or later, and no kid gets called lost when they are only in the bathroom. Getting both perfectly is not possible.',
      body: [
        '**Completeness** means every node that really crashed is eventually noticed by the others. **Accuracy** means no healthy node is wrongly declared dead.',
        'On a network that can delay messages without limit, you cannot have both perfectly. Real detectors keep completeness and accept some accuracy errors, then limit the damage those errors do.',
      ],
      keyIdea: 'Completeness (catch every crash) and accuracy (never accuse a live node) pull against each other. Real systems keep the first and manage the second.',
      metrics: { detect: '?', false: '?', msgs: '-', spread: '-' },
      metricTones: { detect: 'warn', false: 'warn' },
      scene: {
        nodes: [{ ...checker, status: 'active', badge: 'the detector' }, { ...c, status: 'down', badge: 'really crashed' }, { ...a, status: 'ok', badge: 'alive' }],
        links: [link('c', 'checker', { style: 'dashed', label: 'silence', labelTone: 'warn' }), link('a', 'checker', { style: 'faint' })],
        flows: [
          { path: ['checker', 'c'], tone: 'event', label: 'dead: correct', duration: 1.3 },
          { path: ['checker', 'a'], tone: 'error', label: 'dead: wrong', duration: 1.3, delay: 1.5 },
        ],
        panel: {
          title: 'Two ways to be right',
          icon: 'Scale',
          rows: [
            { text: 'Completeness', value: 'every crash is caught', tone: 'good' },
            { text: 'Accuracy', value: 'no live node accused', tone: 'good' },
            { text: 'Both at once, any network', value: 'impossible', tone: 'bad' },
          ],
          footer: { text: 'Keep completeness, bound the accuracy errors', tone: 'muted' },
        },
        caption: 'One correct verdict and one wrong one',
      },
    },
    {
      title: 'Heartbeats',
      tag: 'concept',
      heading: 'Heartbeats: "I am alive" on a timer',
      eli5: 'The teacher says: wave at me every minute. If a kid has not waved for five minutes, the teacher starts looking for them. The wave is a **heartbeat**, and the teacher is the **health checker**.',
      body: [
        'Each node sends a small **heartbeat** message to a health checker every second. The checker records the time of the last heartbeat from each node.',
        'If no heartbeat arrives for longer than a **timeout**, here 5 seconds, the checker marks the node dead and tells the cluster. Detection time is roughly the timeout plus one interval.',
      ],
      keyIdea: 'A heartbeat turns "is it alive?" into "has it spoken recently?", which you can measure.',
      metrics: { detect: '~6 s', false: '?', msgs: '6/s', spread: '1 hop' },
      scene: {
        nodes: [{ ...checker, status: 'active', badge: 'timeout 5 s' }, a, b, { ...c, status: 'down', badge: 'last seen 6 s ago' }],
        links: [link('a', 'checker', { style: 'faint' }), link('b', 'checker', { style: 'faint' }), link('c', 'checker', { style: 'faint' })],
        flows: [
          { path: ['a', 'checker'], tone: 'handshake', label: 'alive', duration: 1 },
          { path: ['b', 'checker'], tone: 'handshake', duration: 1, delay: 0.2 },
          { path: ['checker', 'b'], tone: 'event', label: 'C is dead', duration: 1, delay: 2.4 },
        ],
        panel: {
          title: 'Last heartbeat seen',
          icon: 'Clock',
          rows: [
            { text: 'node A', value: '0.4 s ago', tone: 'good' },
            { text: 'node B', value: '0.7 s ago', tone: 'good' },
            { text: 'node C', value: '6 s ago, over timeout', tone: 'bad' },
          ],
        },
        caption: 'Two nodes check in. C has gone quiet.',
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
      title: 'Leases',
      tag: 'concept',
      heading: 'A heartbeat can be a lease that expires',
      eli5: 'Each kid holds a ticket that is good for five minutes. Waving renews the ticket. If the ticket runs out, the kid is counted as gone, and nobody has to remember to check.',
      body: [
        'Many systems store the heartbeat as a **lease** with a time to live. A node renews its lease every second, and the store drops it after 5 seconds. Expiry is the failure signal. etcd leases and ZooKeeper sessions work this way.',
        'Raft does the same with a randomized election timeout, around 150 to 300 ms. A follower that hears no leader heartbeat in that time starts an election.',
      ],
      keyIdea: 'A lease turns the timeout into expiry. The silence that kills a lease is the same silence that marks a node dead.',
      metrics: { detect: '~5 s', false: '?', msgs: '6/s', spread: '1 hop' },
      scene: {
        nodes: [{ id: 'leases', kind: 'block', size: 0.8, at: at(0, 0), label: 'lease store', icon: 'KeyRound', tint: 'violet', status: 'active' }, { ...a, chips: ['renew lease'] }, { ...c, status: 'down', badge: 'lease expired' }],
        links: [link('a', 'leases', { style: 'faint' }), link('c', 'leases', { style: 'faint' })],
        flows: [
          { path: ['a', 'leases'], tone: 'handshake', label: 'renew, ttl 5 s', duration: 1.2 },
          { path: ['leases', 'a'], tone: 'response', label: 'ok', duration: 1, delay: 1.3 },
        ],
        panel: {
          title: 'Lease table',
          icon: 'Table',
          rows: [
            { text: 'node A', value: 'expires in 4.1 s', tone: 'good' },
            { text: 'node B', value: 'expires in 3.6 s', tone: 'good' },
            { text: 'node C', value: 'expired, removed', tone: 'bad' },
            { text: 'Raft election timeout', value: '150 to 300 ms, random' },
          ],
        },
        caption: 'No renewal, no lease, no member',
      },
    },
    {
      title: 'Push or pull',
      tag: 'concept',
      heading: 'Who speaks first: heartbeat or ping',
      eli5: 'The teacher can wait for kids to wave, or walk up and ask "are you okay?". Asking takes more effort, but it tests that the kid can really answer.',
      body: [
        'A pushed **heartbeat** costs the checker nothing to start, and it needs no member list. A **ping** works the other way: the checker asks and waits for the reply, so it tests the path in both directions.',
        'Both decide on a timer. A ping can also carry a question that needs real work, which a bare heartbeat cannot.',
      ],
      keyIdea: 'Both styles decide on a timer. A ping tests the round trip, and it can carry a real health check.',
      metrics: { detect: '~6 s', false: '?', msgs: '6/s', spread: '1 hop' },
      scene: {
        nodes: [{ ...checker, status: 'active' }, { ...a, chips: ['heartbeat'] }, { ...b, chips: ['ping, then read'] }],
        links: [link('a', 'checker', { style: 'faint' }), link('checker', 'b', { arrow: 'both' })],
        flows: [
          { path: ['a', 'checker'], tone: 'handshake', label: 'alive', duration: 1.2 },
          { path: ['checker', 'b'], tone: 'request', label: 'ping', duration: 1.2, delay: 1.3 },
          { path: ['b', 'checker'], tone: 'response', label: 'read ok', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'Two ways to ask the same question',
          icon: 'ArrowLeftRight',
          rows: [
            { text: 'Heartbeat', value: 'node starts it' },
            { text: 'Ping', value: 'checker starts it' },
            { text: 'Heartbeat proves', value: 'process is running' },
            { text: 'Deep ping proves', value: 'it can do real work', tone: 'good' },
          ],
        },
        caption: 'A pushed heartbeat on the left, a pulled ping on the right',
      },
    },
    {
      title: 'Deep checks',
      tag: 'concept',
      heading: 'Up but not working: the gray failure',
      eli5: 'A kid can wave from the back of the room while being too sick to do any homework. The wave says "I am here". Only a real question shows whether they can still work.',
      body: [
        'A heartbeat thread can keep running while the request handlers are stuck, so a node looks alive and serves nothing. This is a **gray failure**: partly broken, never fully down.',
        'A **liveness** check says the process runs. A **readiness** check does a real read or write and says it can take traffic. Route on readiness, and restart on liveness.',
      ],
      keyIdea: 'Liveness says the process runs. Readiness says it can serve. A heartbeat alone cannot catch a node that is up but stuck.',
      metrics: { detect: '~6 s', false: '?', msgs: '6/s', spread: '1 hop' },
      scene: {
        nodes: [{ ...checker, status: 'active' }, { ...c, status: 'hot', load: 96, badge: 'handlers stuck', chips: [{ text: 'heartbeat: ok', tone: 'good' }, { text: 'read: timeout', tone: 'bad' }] }, { ...a, status: 'ok' }],
        links: [link('c', 'checker', { style: 'faint' }), link('checker', 'a', { style: 'faint' })],
        flows: [
          { path: ['c', 'checker'], tone: 'handshake', label: 'alive', duration: 1.2 },
          { path: ['checker', 'c'], tone: 'request', label: 'deep ping: read', duration: 1.2, delay: 1.3 },
          { path: ['c', 'checker'], tone: 'error', label: 'no reply', duration: 2, delay: 2.6 },
        ],
        panel: {
          title: 'Liveness vs readiness',
          icon: 'Gauge',
          rows: [
            { text: 'Liveness (heartbeat)', value: 'passes', tone: 'good' },
            { text: 'Readiness (real read)', value: 'fails', tone: 'bad' },
            { text: 'Verdict', value: 'stop routing to C', tone: 'warn' },
          ],
        },
        caption: 'C waves, but cannot do real work',
      },
    },
    {
      title: 'The timeout',
      tag: 'tradeoff',
      heading: 'Short timeouts lie, long ones are slow',
      eli5: 'If the teacher panics after one missed wave, the bathroom kid causes a search party every day. If the teacher waits an hour, a lost kid stays lost for an hour.',
      body: [
        'A **short timeout** detects a real crash fast, but it also fires on a node that is paused, overloaded or behind a busy link. That is a **false positive**: a healthy node declared dead.',
        'A **long timeout** almost never lies, but a crashed node keeps receiving requests until the timer runs out. With a 30 second timeout, every request routed to it in that window fails or waits.',
      ],
      keyIdea: 'Every timeout trades detection speed against false alarms. You cannot have both at zero.',
      metrics: { detect: '~3 s', false: '4/day', msgs: '6/s', spread: '1 hop' },
      metricTones: { detect: 'good', false: 'bad' },
      scene: {
        nodes: [{ ...checker, status: 'active', badge: 'timeout 2 s' }, { ...c, status: 'hot', badge: 'heartbeat 3 s late' }, b],
        links: [link('c', 'checker', { style: 'faint' }), link('b', 'checker', { style: 'faint' })],
        flows: [
          { path: ['c', 'checker'], tone: 'handshake', label: 'late but alive', duration: 3.2 },
          { path: ['checker', 'b'], tone: 'error', label: 'C is dead (wrong)', duration: 1, delay: 2.2 },
        ],
        panel: {
          title: 'Two timeouts, two costs',
          icon: 'Timer',
          rows: [
            { text: '2 s timeout: detects in', value: '~3 s', tone: 'good' },
            { text: '2 s timeout: false alarms', value: '4 per day', tone: 'bad' },
            { text: '30 s timeout: detects in', value: '~31 s', tone: 'bad' },
            { text: '30 s timeout: false alarms', value: 'almost none', tone: 'good' },
          ],
        },
        caption: 'The checker gives up just before the heartbeat lands',
      },
    },
    {
      title: 'Pick the number',
      tag: 'tradeoff',
      heading: 'Measure normal first, then set the timeout',
      eli5: 'Before picking how long to wait, the teacher notes how late the slowest kid usually waves. Then they wait a little longer than that.',
      body: [
        'Measure the gaps between heartbeats on your own network. If they sometimes arrive 3 seconds late during busy periods, a 2 second timeout will produce false alarms every day.',
        'Set the timeout above the worst normal gap with margin. Most clusters land between a few seconds and about 30.',
      ],
      keyIdea: 'Pick the timeout from measured gaps, with margin above the worst normal one, never from a guess.',
      metrics: { detect: '~9 s', false: 'rare', msgs: '6/s', spread: '1 hop' },
      metricTones: { detect: 'good', false: 'good' },
      scene: {
        nodes: [{ ...checker, status: 'active', badge: 'timeout 8 s' }, { ...c, chips: ['gap up to 4 s'] }, a],
        links: [link('c', 'checker', { style: 'faint', label: 'busy hours', labelTone: 'warn' }), link('a', 'checker', { style: 'faint' })],
        flows: [
          { path: ['c', 'checker'], tone: 'handshake', label: 'late but in time', duration: 2.6 },
          { path: ['a', 'checker'], tone: 'handshake', duration: 1, delay: 0.5 },
        ],
        panel: {
          title: 'Heartbeat gaps, last hour',
          icon: 'Table',
          rows: [
            { text: 'Interval', value: '1 s' },
            { text: 'Median gap', value: '1.0 s' },
            { text: 'Worst normal gap', value: '4.0 s', tone: 'warn' },
            { text: 'Timeout 2 s', value: 'fires daily', tone: 'bad' },
            { text: 'Timeout 8 s', value: 'quiet', tone: 'good' },
          ],
        },
        caption: 'The timeout sits above the worst normal gap',
      },
      quiz: {
        question: 'Heartbeats go out every 1 s. Under load, they occasionally arrive up to 4 s apart. Which timeout avoids routine false alarms while still detecting crashes reasonably fast?',
        options: ['1 s', '2 s', '8 s', '5 minutes'],
        answer: 2,
        explain: 'The timeout has to sit above the worst normal gap of 4 s, with some margin. 8 s does that and still detects a crash within about 9 s. One or two seconds fire on normal delays, and five minutes leaves a dead node in service far too long.',
      },
    },
    {
      title: 'GC pause',
      tag: 'case',
      heading: 'Case: the garbage collector that got a node evicted',
      eli5: 'The bathroom kid is gone a bit too long. The teacher gives their seat to another kid and starts moving their things over, and then the first kid walks back in.',
      body: [
        'Node C hits a 7 second garbage collection pause. With a 5 second timeout, the cluster declares it dead and node D starts serving C\'s keys.',
        'D also copies C\'s data to a healthy node, A, to restore the replica count, which loads the network and the disks. All of that work was triggered by a node that was never dead.',
      ],
      keyIdea: 'A long pause is indistinguishable from a crash, and the cluster reacts with real, expensive work.',
      metrics: { detect: '~6 s', false: '1 eviction', msgs: '6/s', spread: '1 hop' },
      metricTones: { false: 'bad' },
      scene: {
        nodes: [{ ...checker, status: 'active', badge: 'timeout 5 s' }, { ...c, status: 'hot', badge: 'GC pause 7 s' }, { ...d, status: 'hot', load: 88, badge: 'took over C\'s keys' }, a],
        links: [link('c', 'checker', { style: 'faint' }), link('checker', 'd'), link('d', 'a', { style: 'dashed' })],
        flows: [
          { path: ['checker', 'd'], tone: 'event', label: 'take C\'s keys', duration: 1.2 },
          { path: ['d', 'a'], tone: 'data', label: 'copy replicas', count: 3, duration: 1.4, delay: 1.3 },
        ],
        panel: {
          title: 'Timeline',
          icon: 'Clock',
          rows: [
            { text: '0 s', value: 'C pauses', tone: 'warn' },
            { text: '5 to 6 s', value: 'declared dead', tone: 'bad' },
            { text: '5 to 6 s', value: 'D starts copying to A', tone: 'warn' },
            { text: '7 s', value: 'C wakes up' },
          ],
        },
        caption: 'A pause looked like a crash',
      },
    },
    {
      title: 'Two owners',
      tag: 'case',
      heading: 'C wakes up and both nodes own key 17',
      eli5: 'The first kid is back in their seat, and another kid is sitting in it too. Both think it is theirs, and both start doing the homework that belongs to that seat.',
      body: [
        'C wakes up and carries on as if nothing happened. For a moment both C and D accept writes for the same keys. When C\'s heartbeats resume it rejoins, and the copying runs again in reverse.',
        'Two owners can accept different values for one key. A wrong verdict is therefore a correctness risk as well as a cost.',
      ],
      keyIdea: 'A wrong verdict leaves two owners for the same keys, which is a correctness problem, not only extra work.',
      metrics: { detect: '~6 s', false: '1 eviction', msgs: '6/s + copies', spread: '1 hop' },
      metricTones: { false: 'bad', msgs: 'warn' },
      scene: {
        nodes: [{ ...c, status: 'hot', badge: 'back, accepts writes', chips: ['write key 17'] }, { ...d, status: 'hot', badge: 'owns key 17', chips: ['write key 17'] }, { ...checker, status: 'active' }],
        links: [link('c', 'd', { style: 'dashed', label: 'both own key 17', labelTone: 'warn' }), link('c', 'checker', { style: 'faint' })],
        flows: [
          { path: ['c', 'checker'], tone: 'handshake', label: 'I am alive!', duration: 1.2 },
          { path: ['d', 'c'], tone: 'data', label: 'copy back', count: 3, duration: 1.4, delay: 1.3 },
        ],
        panel: {
          title: 'Split ownership',
          icon: 'Split',
          rows: [
            { text: 'Owners of key 17', value: 'C and D', tone: 'bad' },
            { text: 'Writes accepted by C', value: 'yes', tone: 'warn' },
            { text: 'Writes accepted by D', value: 'yes', tone: 'warn' },
            { text: 'Rebalance runs', value: 'again, reversed', tone: 'bad' },
          ],
        },
        caption: 'Both nodes claim the same keys',
      },
    },
    {
      title: 'Flapping',
      tag: 'case',
      heading: 'Repeated wrong verdicts feed on themselves',
      eli5: 'If the seat swap happens again every day, the teacher spends the whole morning moving kids around and never teaches. The busy teacher then misses waves from other kids too.',
      body: [
        'If this repeats, the node **flaps** in and out of the cluster and the rebalancing never stops.',
        'The load from rebalancing can slow other nodes enough to make them miss heartbeats. They get evicted too, which starts more rebalancing. A small false alarm becomes an outage.',
      ],
      keyIdea: 'Flapping is a feedback loop: eviction causes load, load causes missed heartbeats, missed heartbeats cause eviction.',
      metrics: { detect: '~6 s', false: '3 evictions in a row', msgs: '6/s + copies', spread: '1 hop' },
      metricTones: { false: 'bad', msgs: 'bad' },
      scene: {
        nodes: [{ ...c, status: 'hot', badge: 'evicted 3 times' }, { ...d, status: 'hot', load: 93, badge: 'rebalancing' }, { ...a, status: 'hot', load: 86, badge: 'slow, missing beats' }],
        links: [link('c', 'd', { style: 'dashed', label: 'copy, copy back', labelTone: 'warn' }), link('d', 'a', { style: 'dashed' })],
        flows: [
          { path: ['d', 'c'], tone: 'data', label: 'copy', count: 3, duration: 1.4 },
          { path: ['d', 'a'], tone: 'data', label: 'more load', count: 2, duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'The loop',
          icon: 'Repeat',
          rows: [
            { text: '1. Node looks dead', value: 'evicted', tone: 'warn' },
            { text: '2. Data is copied', value: 'disks and network busy', tone: 'warn' },
            { text: '3. Peers get slow', value: 'beats arrive late', tone: 'bad' },
            { text: '4. Peers look dead', value: 'back to step 1', tone: 'bad' },
          ],
        },
        caption: 'The cure for one false alarm creates the next',
      },
    },
    {
      title: 'Suspect first',
      tag: 'tradeoff',
      heading: 'Add a suspect state before declaring dead',
      eli5: 'The teacher first writes "maybe lost" on the board, and only moves the seat after a few more minutes. A kid who walks back in during that time gets crossed off the list at once.',
      body: [
        'Add a **suspect** state before **dead**, so one missed timeout does not trigger expensive action. A suspect node gets time to answer.',
        'Here the checker waits 5 s of silence to mark C suspect, then a further 5 s grace period before it marks C dead. A beat that arrives during the grace period clears the suspicion. Part 2 adds incarnation numbers, which let a live node overrule a stale accusation without a central checker.',
      ],
      keyIdea: 'Suspect before dead delays costly action, and a node that answers in the grace period is never evicted.',
      metrics: { detect: '~11 s', false: 'cheaper', msgs: '6/s', spread: '1 hop' },
      metricTones: { false: 'good' },
      scene: {
        nodes: [{ ...checker, status: 'active', badge: 'C: suspect, grace 5 s' }, { ...c, status: 'ok', badge: 'beat in grace period' }, { ...d }],
        links: [link('c', 'checker', { style: 'faint' }), link('checker', 'd', { style: 'faint' })],
        flows: [
          { path: ['checker', 'd'], tone: 'event', label: 'C is suspect', duration: 1.2 },
          { path: ['c', 'checker'], tone: 'handshake', label: 'alive', duration: 1.2, delay: 1.3 },
          { path: ['checker', 'd'], tone: 'event', label: 'C cleared', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'Node states',
          icon: 'Workflow',
          rows: [
            { text: 'Alive', value: 'beats arriving', tone: 'good' },
            { text: 'Suspect', value: 'after 5 s silent, no costly action', tone: 'warn' },
            { text: 'Dead', value: 'after 5 s more of silence', tone: 'bad' },
            { text: 'Back', value: 'a beat clears the suspicion' },
          ],
        },
        caption: 'C answers during the grace period, so nothing is evicted',
      },
    },
    {
      title: 'Fencing',
      tag: 'tradeoff',
      heading: 'Assume the detector is wrong and make it safe',
      eli5: 'Each seat gets a numbered ticket, and the homework box only accepts the newest ticket number. A kid with an old ticket can sit down, but the box ignores what they hand in.',
      body: [
        'Anything that must never have two owners, such as a primary, needs a lease or a **fencing token**, as covered in the replication lesson. The storage layer rejects writes that carry an older token.',
        'The detector decides who is probably dead. The fence makes sure a wrong guess cannot corrupt data.',
      ],
      keyIdea: 'Do not rely on the detector for safety. Fence the old owner, so a wrong "dead" verdict costs little.',
      metrics: { detect: '~6 s', false: 'cheap', msgs: '6/s', spread: '1 hop' },
      metricTones: { false: 'good' },
      scene: {
        nodes: [{ ...c, status: 'hot', badge: 'token 40 (old)', chips: ['write key 17'] }, { id: 'store', kind: 'db', at: at(0, 4.5), label: 'storage', badge: 'accepts token 41+', status: 'active' }, { ...d, badge: 'token 41', chips: ['write key 17'] }],
        links: [link('c', 'store', { label: 'rejected', labelTone: 'warn' }), link('d', 'store')],
        flows: [
          { path: ['c', 'store'], tone: 'error', label: 'token 40: rejected', duration: 1.4 },
          { path: ['d', 'store'], tone: 'request', label: 'token 41: ok', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Fencing token',
          icon: 'Shield',
          rows: [
            { text: 'New owner gets', value: 'token 41', tone: 'good' },
            { text: 'Old owner still holds', value: 'token 40', tone: 'warn' },
            { text: 'Storage rule', value: 'reject lower tokens', tone: 'good' },
          ],
          footer: { text: 'Wrong verdicts still happen, but they cost little', tone: 'muted' },
        },
        caption: 'The storage layer turns away the old owner',
      },
    },
    {
      title: 'Phi accrual',
      tag: 'concept',
      heading: 'Phi accrual: how suspicious, not yes or no',
      eli5: 'A smart teacher remembers that Sam waves every three minutes, but Mia waves every minute. Three quiet minutes from Mia is more worrying than three from Sam. The **phi** score is how worried the teacher is.',
      body: [
        'A fixed timeout treats every node and every network the same. The **phi accrual detector** instead keeps a history of the gaps between heartbeats from each node, and turns "time since the last one" into a suspicion level called **phi** (φ).',
        'Phi answers: given how this node usually behaves, how unlikely is a silence this long? A node that normally beats every 1 s going quiet for 3 s is worrying. A node that normally beats every 3 s is routine at the same 3 s.',
      ],
      keyIdea: 'Phi accrual learns each node\'s normal gap, so the same silence means different things for different nodes.',
      metrics: { detect: 'adapts', false: 'rare', msgs: '6/s', spread: '1 hop' },
      metricTones: { false: 'good' },
      scene: {
        nodes: [{ ...checker, status: 'active', badge: 'φ per node' }, { ...a, badge: 'φ 0.4', chips: ['mean gap 3 s'] }, { ...c, status: 'hot', badge: 'φ 1.3', chips: ['mean gap 1 s'] }],
        links: [link('a', 'checker', { style: 'faint' }), link('c', 'checker', { style: 'faint' })],
        flows: [{ path: ['a', 'checker'], tone: 'handshake', duration: 1 }],
        panel: {
          title: 'Same 3 s of silence',
          icon: 'Gauge',
          rows: [
            { text: 'Node C (mean gap 1 s)', value: 'φ 1.3, worrying', tone: 'warn' },
            { text: 'Node A (mean gap 3 s)', value: 'φ 0.4, routine', tone: 'good' },
            { text: 'Fixed 5 s timeout', value: 'treats both alike', tone: 'warn' },
          ],
        },
        caption: 'Suspicion grows smoothly the longer C stays quiet',
      },
    },
    {
      title: 'The phi scale',
      tag: 'concept',
      heading: 'Reading phi: each point is ten times more sure',
      eli5: 'The teacher\'s worry counter goes up by one each time the odds of "they are just late" drop ten times. Seven on the counter means very unlikely to be just late.',
      body: [
        'φ = 1 means a healthy node would stay silent this long about 10% of the time. φ = 2 means about 1%, φ = 3 about 0.1%. Each step of 1 is ten times more sure.',
        'With a mean gap of 1 second, φ reaches 8 after about 18 seconds of silence. Cassandra uses this detector with a default threshold of 8. On a slow or jittery network the mean gap grows and the detector becomes patient by itself.',
      ],
      keyIdea: 'Phi is a log scale of unlikeliness: 1 is a 10% chance, 3 is 0.1%, 8 is about one in a hundred million.',
      metrics: { detect: 'adapts', false: 'rare', msgs: '6/s', spread: '1 hop' },
      metricTones: { false: 'good' },
      scene: {
        nodes: [{ ...checker, status: 'active', badge: 'threshold 8' }, { ...c, status: 'hot', badge: 'φ 6.1', chips: ['silent 14 s'] }],
        links: [link('c', 'checker', { style: 'faint' })],
        flows: [{ path: ['c', 'checker'], tone: 'handshake', label: '...', duration: 2.4 }],
        panel: {
          title: 'Silence to phi (mean gap 1 s)',
          icon: 'Table',
          rows: [
            { text: '2.3 s silent', value: 'φ 1, 10% chance' },
            { text: '4.6 s silent', value: 'φ 2, 1% chance' },
            { text: '6.9 s silent', value: 'φ 3, 0.1% chance' },
            { text: '14 s silent', value: 'φ 6, suspect', tone: 'warn' },
            { text: '18 s silent', value: 'φ 8, convict', tone: 'bad' },
          ],
        },
        caption: 'The longer the silence, the less likely C is just late',
      },
    },
    {
      title: 'Phi in code',
      tag: 'concept',
      heading: 'Computing phi from a window of gaps',
      eli5: 'The teacher keeps a notebook of how long each kid usually takes between waves. Looking at the notebook and the clock, the teacher works out how worried to be.',
      body: [
        'Keep the last 1,000 gaps per node. The mean gap and the time since the last heartbeat give phi. This version assumes gaps follow an exponential shape, which keeps the math to one line. It uses only the mean, so it ignores how spread out the gaps are.',
        'Cassandra\'s version does the same bookkeeping. Other implementations fit a normal curve, which is stricter for nodes with very steady timing.',
      ],
      keyIdea: 'Phi needs only a window of recent gaps and the time since the last heartbeat.',
      metrics: { detect: 'adapts', false: 'rare', msgs: '6/s', spread: '1 hop' },
      metricTones: { false: 'good' },
      scene: {
        nodes: [{ ...checker, status: 'active', badge: '1,000 gaps' }, { ...c, badge: 'φ 6.1' }],
        links: [link('c', 'checker', { style: 'faint' })],
        flows: [{ path: ['c', 'checker'], tone: 'handshake', label: 'beat', duration: 1.2 }],
        panel: {
          title: 'The formula',
          icon: 'Code',
          code: 'mean  = average(recent gaps)\nsilent = now - last_beat\nP(alive) = e^(-silent / mean)\nphi = -log10(P(alive))\n     = silent / mean * 0.434',
          footer: { text: 'mark_down when phi is above the threshold', tone: 'muted' },
        },
        caption: 'One number per node, updated on every check',
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
      title: 'Thresholds',
      tag: 'tradeoff',
      heading: 'Each action picks its own threshold',
      eli5: 'Moving a kid\'s seat is a big job, so the teacher waits until very worried. Just not asking that kid to carry the snacks is easy, so a little worry is enough.',
      body: [
        'Phi is a score, not a verdict, so each consumer picks its own line. A router can stop sending requests at a low φ, because skipping a node for a moment costs almost nothing.',
        'A rebalancer waits for a high φ before moving data, because copying terabytes on a false alarm is expensive. One detector serves both.',
      ],
      keyIdea: 'Cheap, reversible actions use a low threshold. Expensive ones use a high threshold. A yes or no timeout cannot do both.',
      metrics: { detect: '~5 s to 18 s', false: 'rare', msgs: '6/s', spread: '1 hop' },
      metricTones: { false: 'good' },
      scene: {
        nodes: [{ ...c, status: 'hot', badge: 'φ 5' }, { id: 'router', kind: 'block', at: at(-5, 3), label: 'router', sub: 'threshold φ 2', icon: 'Route', tint: 'blue', status: 'active' }, { id: 'rebal', kind: 'block', at: at(5, 3), label: 'rebalancer', sub: 'threshold φ 8', icon: 'Split', tint: 'amber' }],
        links: [link('c', 'router'), link('c', 'rebal')],
        flows: [
          { path: ['c', 'router'], tone: 'event', label: 'φ 5 > 2: skip C', duration: 1.4 },
          { path: ['c', 'rebal'], tone: 'event', label: 'φ 5 < 8: wait', duration: 1.4, delay: 0.5 },
        ],
        panel: {
          title: 'One score, two decisions',
          icon: 'Gauge',
          rows: [
            { text: 'Router at φ 5', value: 'stops sending to C', tone: 'good' },
            { text: 'Rebalancer at φ 5', value: 'waits', tone: 'good' },
            { text: 'Rebalancer at φ 8', value: 'moves C\'s data', tone: 'warn' },
          ],
        },
        caption: 'Same suspicion, different reactions',
      },
      quiz: {
        question: 'A router and a data rebalancer both read the same phi score for node C. Which setup fits best?',
        options: [
          'Both act at φ 8, so they always agree',
          'The router acts at a low φ such as 2, and the rebalancer waits for a high φ such as 8',
          'The rebalancer acts at a low φ, because moving data early is safer',
          'Neither can use phi, because phi only works with a central checker',
        ],
        answer: 1,
        explain: 'Skipping a node in the router is cheap and reversible, so a little suspicion is enough. Moving terabytes is expensive, so the rebalancer waits for strong evidence. The score lets each consumer choose its own line.',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Part 1: guess carefully, and expect to be wrong sometimes',
      eli5: 'Kids wave on a timer, the teacher waits a bit longer than the slowest usual wave, writes "maybe lost" before moving seats, and worries more the longer someone is quiet.',
      body: [
        'You cannot tell slow from dead, so every detector guesses. **Heartbeats** and **leases** with a **timeout** are the basic tool, and a deep check catches a node that is up but stuck.',
        'Pick the timeout from measured gaps. Add a suspect state and fencing so a wrong verdict is cheap. **Phi accrual** reports a suspicion level that each action thresholds on its own. Part 2 scales this with gossip.',
      ],
      keyIdea: 'Detection is a guess, so make it adaptive, and design for the times it is wrong.',
      metrics: { detect: '~9 s', false: 'cheap', msgs: '6/s', spread: '1 hop' },
      metricTones: { false: 'good' },
      scene: {
        nodes: [{ ...checker, status: 'ok', badge: 'one view' }, { ...a, status: 'ok' }, { ...c, status: 'down', badge: 'confirmed dead' }, { ...d, status: 'ok' }],
        links: [link('a', 'checker', { style: 'faint' }), link('d', 'checker', { style: 'faint' }), link('c', 'checker', { style: 'faint' })],
        flows: [
          { path: ['a', 'checker'], tone: 'handshake', duration: 1 },
          { path: ['d', 'checker'], tone: 'handshake', duration: 1, delay: 0.4 },
          { path: ['checker', 'a'], tone: 'event', label: 'C is dead', duration: 1, delay: 1.5 },
        ],
        caption: 'A single checker works for small clusters. Part 2 shows what happens at scale.',
      },
      quiz: {
        question: 'A node pauses for 7 s in garbage collection and is declared dead with a 5 s timeout. Which defense makes this mistake cheapest?',
        options: [
          'A shorter timeout of 1 s, so the mistake happens sooner',
          'A suspect state before dead, plus fencing tokens so the returning node cannot write over the new owner',
          'Removing heartbeats and trusting client errors only',
          'Declaring every silent node dead for good, with no rejoin',
        ],
        answer: 1,
        explain: 'A suspect state delays costly action, and a fencing token makes the storage layer reject the old owner\'s writes. The detector can still be wrong, but the damage stays small. A shorter timeout makes false alarms more common.',
      },
    },
  ],
};
