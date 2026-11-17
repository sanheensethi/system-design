import type { Lesson, SceneNode } from '../engine/types';

const ann: SceneNode = { id: 'ann', kind: 'phone', at: [-2.75, 0.75], label: 'Ann', sub: 'phone' };
const ben: SceneNode = { id: 'ben', kind: 'phone', at: [-0.25, 3.25], label: 'Ben', sub: 'phone' };
const x: SceneNode = { id: 'x', kind: 'replica', at: [0.5, -0.5], label: 'node X' };
const y: SceneNode = { id: 'y', kind: 'replica', at: [1.7, -1.7], label: 'node Y' };
const z: SceneNode = { id: 'z', kind: 'replica', at: [2.9, -2.9], label: 'node Z' };
const ntp: SceneNode = { id: 'ntp', kind: 'monitor', at: [4.1, -4.1], label: 'NTP server' };

const links = [
  { from: 'ann', to: 'x' },
  { from: 'ben', to: 'y' },
  { from: 'x', to: 'y', style: 'dashed' as const },
  { from: 'y', to: 'z', style: 'dashed' as const },
];

export const clocksOrdering: Lesson = {
  id: 'clocks-ordering',
  title: 'Clocks, ordering and version vectors',
  tagline: 'Why timestamps lie in a distributed system, and how replicas tell "came after" from "happened at the same time".',
  minutes: 15,
  level: 'Advanced',
  learn: [
    'How wall clocks drift and skew between machines',
    'Why last-write-wins by timestamp silently drops writes',
    'Happens-before and Lamport clocks',
    'Vector clocks: detecting writes that were concurrent',
    'Version vectors and siblings in a Dynamo-style store',
    'Hybrid logical clocks and TrueTime, in brief',
  ],
  metrics: [
    { key: 'skew', label: 'Clock skew' },
    { key: 'lost', label: 'Writes lost' },
    { key: 'siblings', label: 'Versions kept' },
    { key: 'meta', label: 'Metadata per write' },
  ],
  steps: [
    {
      title: 'Lost edit',
      tag: 'problem',
      heading: 'The later edit lost to the earlier one',
      eli5: 'A family keeps copies of one shopping list in two rooms, and each room has its own clock. The kitchen clock runs fast. A note written there first looks newer than a note written later in the hall. **Node X** is the kitchen.',
      body: [
        'Ann sets her display name to "Ann". The write lands on node X at real time 12:00:00.000, but X\'s clock runs half a second fast, so it stamps the write **12:00:00.500**.',
        'Ann spots the typo and changes it to "Anna" 200 ms later. That write lands on node Y, whose clock is correct, and gets stamped **12:00:00.200**. The two nodes sync and keep the write with the higher timestamp. "Ann" wins on both. The correction is gone, and nothing logs an error.',
        'No code had a bug. The store trusted two clocks on two machines to agree, and they did not.',
      ],
      keyIdea: 'Comparing timestamps from different machines compares their clocks as much as their events.',
      metrics: { skew: '500 ms', lost: '1 (silent)', siblings: '1', meta: '1 timestamp' },
      scene: {
        nodes: [ann, { ...x, status: 'hot', badge: 'stamps 12:00:00.500' }, { ...y, badge: 'stamps 12:00:00.200' }],
        links: [
          { from: 'ann', to: 'x' },
          { from: 'ann', to: 'y' },
          { from: 'x', to: 'y', style: 'dashed' as const },
        ],
        flows: [
          { path: ['ann', 'x'], tone: 'request', label: 'name = Ann', duration: 1.1 },
          { path: ['ann', 'y'], tone: 'request', label: 'name = Anna (later)', duration: 1.1, delay: 1.2 },
          { path: ['x', 'y'], tone: 'data', label: 'Ann wins: .500 > .200', duration: 1.4, delay: 2.5 },
        ],
        caption: 'The newer edit carries the older timestamp',
      },
    },
    {
      title: 'Clock drift',
      tag: 'concept',
      heading: 'Every machine keeps its own, slightly wrong, time',
      eli5: 'Every room clock ticks a bit too fast or too slow. Once in a while someone checks the radio and fixes them, but in between they wander apart. The **NTP server** is the radio.',
      body: [
        'A server\'s clock is a quartz crystal, and no two run at exactly the same rate. Heat and age change the rate further. Left alone, a clock **drifts** away from true time, often by seconds over days. The difference between two machines\' clocks at one moment is their **skew**.',
        'NTP corrects clocks by asking time servers, but it can only be as accurate as the network delay it measures. Within one datacenter that is often a millisecond or better. Across the internet, or when the NTP daemon is misconfigured or blocked, it can be tens or hundreds of milliseconds, and an unsynced machine can be off by far more.',
        'Corrections cause their own trouble. When NTP finds a large error it may **step** the clock, sometimes backwards. Measure durations with a **monotonic clock**, which never jumps back, and never order events from different machines by their wall clocks alone.',
      ],
      keyIdea: 'Wall clocks drift, get corrected in jumps, and never agree exactly. Skew is a fact of life, not a bug.',
      metrics: { skew: '~1 to 500 ms', lost: '-', siblings: '1', meta: '1 timestamp' },
      scene: {
        nodes: [{ ...x, status: 'hot', badge: '+500 ms' }, { ...y, badge: '+2 ms' }, { ...z, badge: '-40 ms' }, { ...ntp, status: 'active' }],
        links: [
          { from: 'ntp', to: 'z', style: 'dashed' as const },
          { from: 'z', to: 'y', style: 'faint' as const },
          { from: 'y', to: 'x', style: 'faint' as const },
        ],
        flows: [
          { path: ['ntp', 'z'], tone: 'handshake', label: 'what time is it?', duration: 1.2 },
          { path: ['ntp', 'z', 'y'], tone: 'handshake', duration: 1.8, delay: 1.3 },
          { path: ['ntp', 'z', 'y', 'x'], tone: 'handshake', label: 'correct, then drift again', duration: 2.4, delay: 2.4 },
        ],
        caption: 'Three nodes, three different times',
      },
    },
    {
      title: 'Last write wins',
      tag: 'tradeoff',
      heading: 'Last-write-wins is a policy for throwing writes away',
      eli5: 'If two people write on the list at nearly the same moment, the family keeps only the note with the later clock time and bins the other. Sometimes the binned note was the important one.',
      body: [
        '**Last-write-wins** (LWW) resolves any conflict by keeping the value with the highest timestamp. It is simple, needs no extra metadata, and the replicas always converge to the same answer. Many stores use it by default.',
        'It loses data in two ways. With skew, a write that really came later can carry a smaller timestamp, as Ann found. And when two writes are truly **concurrent**, say Ann adds shoes to a shared cart while Ben adds socks, LWW keeps one cart and drops the other edit, even though both were valid.',
        'LWW is a fine choice when a key is written once and never changed, when values are caches that can be rebuilt, or when losing a racing update does not matter. For data where every edit counts, the store needs a way to know which writes came after which, without asking a clock.',
      ],
      keyIdea: 'LWW guarantees replicas agree. It does not guarantee they agree on the right value.',
      metrics: { skew: '500 ms', lost: '1 of 2 concurrent', siblings: '1', meta: '1 timestamp' },
      scene: {
        nodes: [ann, ben, { ...x, badge: 'cart: shoes' }, { ...y, badge: 'cart: socks' }, { ...z, status: 'hot', badge: 'keeps one cart' }],
        links,
        flows: [
          { path: ['ann', 'x'], tone: 'request', label: 'add shoes', duration: 1 },
          { path: ['ben', 'y'], tone: 'request', label: 'add socks', duration: 1 },
          { path: ['x', 'y', 'z'], tone: 'data', duration: 1.6, delay: 1.2 },
          { path: ['y', 'z'], tone: 'error', label: 'socks dropped', duration: 1.2, delay: 1.6 },
        ],
        caption: 'Two good edits in, one out',
      },
    },
    {
      title: 'Happens-before',
      tag: 'concept',
      heading: 'The order that matters is cause and effect',
      eli5: 'If Ben reads Ann\'s note and then writes his own, his note came after hers, whatever the clocks say. If neither saw the other\'s note, there is no "before". They just both wrote.',
      body: [
        'We rarely need true time. We need to know whether one event could have influenced another. Event a **happens before** b if they ran on the same node and a came first, or a sent a message that b received, or a chain of such steps links them.',
        'If neither happens before the other, the events are **concurrent**. Concurrent does not mean "at the same instant". It means neither one knew about the other. Ann\'s shoes and Ben\'s socks are concurrent even if they were a whole second apart.',
        'This gives a clear rule for conflicts. If one write happens before another, the later one may safely replace it. If they are concurrent, neither should silently win. The next steps build clocks that capture this relation without trusting physical time.',
      ],
      keyIdea: 'Order writes by what each writer had seen, not by when the clock says they happened.',
      metrics: { skew: 'irrelevant', lost: '-', siblings: '1', meta: '-' },
      scene: {
        nodes: [ann, ben, { ...x, status: 'active', badge: 'a: write v1' }, { ...y, status: 'active', badge: 'b: read v1, write v2' }],
        links: [
          { from: 'ann', to: 'x' },
          { from: 'ben', to: 'y' },
          { from: 'x', to: 'y', style: 'dashed' as const },
        ],
        flows: [
          { path: ['ann', 'x'], tone: 'request', label: 'write v1', duration: 1 },
          { path: ['x', 'y'], tone: 'data', label: 'v1 replicated', duration: 1.2, delay: 1.1 },
          { path: ['ben', 'y'], tone: 'request', label: 'edit after seeing v1', duration: 1, delay: 2.4 },
        ],
        caption: 'a happens before b because b saw a',
      },
    },
    {
      title: 'Lamport clocks',
      tag: 'concept',
      heading: 'Lamport clocks: a counter that respects causality',
      eli5: 'Every note gets a number one higher than any number its writer has seen. Read a note marked 7, and your next note is at least 8. So a reply always has a bigger number than what it replied to.',
      body: [
        'A **Lamport clock** is one integer per node. Each local event adds 1. Every message carries the sender\'s value, and the receiver sets its clock to `max(own, received) + 1`. If a happens before b, then `L(a) < L(b)`, always, whatever the wall clocks say.',
        'Break ties by node id and you get a **total order** that every node agrees on and that never contradicts causality. That is enough for things like ordering requests for a lock or replaying a log in a consistent order.',
        'The rule only works in one direction. `L(a) < L(b)` does not tell you that a happened before b. They may be concurrent, and the smaller number is just an accident of which node was busier. Lamport clocks order events. They cannot detect a conflict.',
      ],
      keyIdea: 'Lamport clocks give an order consistent with cause and effect, but cannot tell you when two events were concurrent.',
      metrics: { skew: 'irrelevant', lost: '-', siblings: '1', meta: '1 integer' },
      scene: {
        nodes: [{ ...x, status: 'active', badge: 'L = 3' }, { ...y, status: 'active', badge: 'L = 7 → 8' }, { ...z, badge: 'L = 6 → 9' }],
        links: [
          { from: 'x', to: 'y', style: 'dashed' as const },
          { from: 'y', to: 'z', style: 'dashed' as const },
        ],
        flows: [
          { path: ['x', 'y'], tone: 'event', label: 'msg, L = 3', duration: 1.2 },
          { path: ['y', 'z'], tone: 'event', label: 'msg, L = 8', duration: 1.2, delay: 1.4 },
        ],
        caption: 'Receivers jump past every number they have seen',
      },
      code: {
        language: 'python',
        title: 'A Lamport clock',
        source: `class LamportClock:
    def __init__(self, node_id):
        self.node_id, self.t = node_id, 0

    def local_event(self):              # e.g. apply a write
        self.t += 1
        return (self.t, self.node_id)

    def send(self):                     # stamp an outgoing message
        return self.local_event()

    def receive(self, remote_t):        # merge, then count this event
        self.t = max(self.t, remote_t) + 1
        return (self.t, self.node_id)

# Sorting by (t, node_id) gives one total order on every node.`,
        highlight: [6, 13, 16],
      },
    },
    {
      title: 'Vector clocks',
      tag: 'concept',
      heading: 'Vector clocks: one counter per node',
      eli5: 'Each note now carries a small tally: how many notes from each family member the writer had seen. Compare two tallies and you can tell if one writer saw the other\'s note, or if neither did.',
      body: [
        'A **vector clock** keeps one counter per node, like `{X: 2, Y: 1}`. A node bumps its own entry on each event, and on receiving a message it takes the entry-by-entry maximum before bumping its own.',
        'Compare two vectors entry by entry. If every entry of A is less than or equal to B, A **happened before** B. If B is less than or equal to A everywhere, B came first. If each is bigger somewhere, neither saw the other: they are **concurrent**.',
        'Here Ann writes on X, producing `{X: 1}`. It replicates to Y. Ben edits on Y, producing `{X: 1, Y: 1}`, which is after. Meanwhile Ann writes again on X before seeing Ben\'s edit: `{X: 2}`. Compared with `{X: 1, Y: 1}`, it is bigger on X and smaller on Y. Concurrent, and now the store knows it.',
      ],
      keyIdea: 'Vector clocks capture exactly what each write had seen, so they can tell "came after" apart from "concurrent".',
      metrics: { skew: 'irrelevant', lost: '0', siblings: '2 (detected)', meta: '1 counter per node' },
      scene: {
        nodes: [ann, ben, { ...x, status: 'active', badge: '{X:2}' }, { ...y, status: 'active', badge: '{X:1, Y:1}' }, { ...z, status: 'hot', badge: 'concurrent!' }],
        links,
        flows: [
          { path: ['ann', 'x'], tone: 'request', label: 'write again', duration: 1 },
          { path: ['ben', 'y'], tone: 'request', label: 'edit', duration: 1 },
          { path: ['x', 'y', 'z'], tone: 'data', label: '{X:2}', duration: 1.6, delay: 1.2 },
          { path: ['y', 'z'], tone: 'data', label: '{X:1, Y:1}', duration: 1.2, delay: 1.5 },
        ],
        caption: 'Neither vector dominates, so neither write wins',
      },
      code: {
        language: 'python',
        title: 'Comparing two vector clocks',
        source: `def compare(a, b):
    """a, b: dict of node -> counter."""
    nodes = a.keys() | b.keys()
    a_le_b = all(a.get(n, 0) <= b.get(n, 0) for n in nodes)
    b_le_a = all(b.get(n, 0) <= a.get(n, 0) for n in nodes)
    if a_le_b and b_le_a:
        return "equal"
    if a_le_b:
        return "before"        # b saw everything a saw: b may replace a
    if b_le_a:
        return "after"
    return "concurrent"        # each saw something the other did not

compare({"X": 1}, {"X": 1, "Y": 1})   # "before"
compare({"X": 2}, {"X": 1, "Y": 1})   # "concurrent"`,
        highlight: [4, 5, 9, 12],
      },
      quiz: {
        question: 'Write A has vector {X: 3, Y: 1}. Write B has {X: 2, Y: 2}. What is their relation?',
        options: ['A happened before B', 'B happened before A', 'They are concurrent', 'They are equal'],
        answer: 2,
        explain: 'A is ahead on X (3 > 2) and B is ahead on Y (2 > 1). Each saw something the other did not, so neither happened before the other.',
      },
    },
    {
      title: 'Siblings',
      tag: 'case',
      heading: 'Case: a shared cart keeps both edits',
      eli5: 'When the family finds two shopping lists that nobody combined, they keep both. Next time someone reads the list, they see both, combine them into one, and write the combined list back.',
      body: [
        'Dynamo-style stores attach a **version vector** to each value: one counter per replica that coordinated a write to that key. On a write, the store compares the new version with what it holds. A version that is strictly older gets discarded. A concurrent one is kept next to it as a **sibling**.',
        'Ann\'s cart `[shoes]` and Ben\'s cart `[socks]` are concurrent, so node Z stores both. The next read returns both siblings plus a **context**: the merged vector. The application merges them (for a cart, take the union, `[shoes, socks]`) and writes the result back with that context.',
        'Because the new write\'s vector dominates both siblings, the store can drop them, and the key is back to one value. Nothing was lost. The store detected the conflict and the application, which knows what a cart means, resolved it.',
      ],
      keyIdea: 'Version vectors let the store keep concurrent writes as siblings and hand the merge to code that understands the data.',
      metrics: { skew: 'irrelevant', lost: '0', siblings: '2 → 1 after merge', meta: '1 counter per replica' },
      scene: {
        nodes: [{ ...ann, status: 'active', badge: 'merge: shoes + socks' }, ben, x, y, { ...z, status: 'ok', badge: '2 siblings → 1' }],
        links: [...links, { from: 'ann', to: 'z', style: 'faint' as const }],
        flows: [
          { path: ['z', 'ann'], tone: 'response', label: '[shoes] and [socks]', duration: 1.4 },
          { path: ['ann', 'z'], tone: 'request', label: 'put [shoes, socks] + context', duration: 1.4, delay: 1.6 },
          { path: ['z', 'y', 'x'], tone: 'data', label: 'merged version', duration: 1.8, delay: 3.1 },
        ],
        caption: 'Read both, merge, write once',
      },
      code: {
        language: 'python',
        title: 'Store keeps siblings, client merges',
        source: `# store side, on node \`me\`
def put(key, value, context, me):
    held = store.get(key, [])                     # list of (vector, value)
    keep = [(v, val) for v, val in held
            if compare(v, context) not in ("before", "equal")]
    vec = dict(context)
    vec[me] = max([vec.get(me, 0)] + [v.get(me, 0) for v, _ in keep]) + 1
    store[key] = keep + [(vec, value)]           # concurrent ones stay

# client side
siblings, context = kv.get("cart:7")              # [["shoes"], ["socks"]]
merged = sorted(set().union(*siblings))           # cart rule: union
kv.put("cart:7", merged, context)                 # dominates both siblings`,
        highlight: [5, 7, 8, 12, 13],
      },
    },
    {
      title: 'The costs',
      tag: 'tradeoff',
      heading: 'What version vectors cost you',
      eli5: 'Tallies make every note a bit longer, and someone still has to sit down and combine lists. And if Ben crossed out milk on one list but Ann\'s list still has it, a simple combine brings the milk back.',
      body: [
        '**Metadata grows.** Every value carries one counter per replica that wrote it. Keying the vector by replica node, not by client, keeps it small, and stores trim old entries. Trimming too eagerly can make a stale write look concurrent, or a concurrent one look stale.',
        '**Merging is your job.** The store can say "these conflict", but only the application knows that carts merge by union and that a bank balance must not merge at all. Every reader must handle siblings, and a careless merge reintroduces lost updates.',
        '**Deletes come back.** If Ben removes socks while Ann adds shoes, a plain union restores the socks. Deletes need **tombstones**: a marker that says "removed", kept long enough for every replica to see it. Data types built to merge without conflicts (CRDTs) package these rules for counters, sets and maps.',
      ],
      keyIdea: 'Version vectors move conflict handling from the clock to the application. That is more correct and more work.',
      metrics: { skew: 'irrelevant', lost: '0', siblings: 'up to N', meta: 'grows with writers' },
      scene: {
        nodes: [ann, { ...ben, status: 'active', badge: 'removed socks' }, { ...x, badge: '[shoes, socks]' }, { ...y, badge: '[ ] + tombstone' }, { ...z, status: 'active', badge: 'union needs the tombstone' }],
        links,
        flows: [
          { path: ['ben', 'y'], tone: 'request', label: 'remove socks', duration: 1 },
          { path: ['x', 'y', 'z'], tone: 'data', duration: 1.6, delay: 1.1 },
          { path: ['y', 'z'], tone: 'data', label: 'tombstone: socks', duration: 1.2, delay: 1.4 },
        ],
        caption: 'Without a tombstone, the union brings socks back',
      },
    },
    {
      title: 'Hybrid clocks',
      tag: 'concept',
      heading: 'Hybrid logical clocks: close to real time, safe for causality',
      eli5: 'Each note gets the room clock time, but if you have already seen a note with a later time, you use that time plus a tick. The numbers look like real times and still never go backwards.',
      body: [
        'Logical clocks respect causality but their numbers mean nothing to a human, and you cannot ask for "everything as of 12:00". A **hybrid logical clock** (HLC) stamps each event with a pair: a physical time and a small counter.',
        'The physical part is the larger of the local wall clock and the largest time seen in any message. The counter breaks ties when the physical part did not move. So an HLC stays within the clock skew of real time, yet a reply is always stamped after the message that caused it, even if the replier\'s clock is behind.',
        'Some distributed SQL databases, CockroachDB among them, use HLCs to order transactions. They still assume a bound on skew: if a node\'s clock wanders past the configured maximum, the guarantees break, so those systems watch skew and shut down a node that drifts too far.',
      ],
      keyIdea: 'An HLC is a wall-clock time that is never allowed to contradict cause and effect.',
      metrics: { skew: 'bounded, e.g. 500 ms', lost: '0', siblings: '1', meta: 'time + counter' },
      scene: {
        nodes: [{ ...x, status: 'active', badge: '12:00:00.500 · 0' }, { ...y, status: 'active', badge: 'clock .200 → .500 · 1' }, z],
        links: [
          { from: 'x', to: 'y', style: 'dashed' as const },
          { from: 'y', to: 'z', style: 'dashed' as const },
        ],
        flows: [
          { path: ['x', 'y'], tone: 'event', label: 'stamped .500 · 0', duration: 1.3 },
          { path: ['y', 'z'], tone: 'event', label: 'reply .500 · 1', duration: 1.3, delay: 1.5 },
        ],
        caption: 'Y\'s clock is behind, so it borrows X\'s time and ticks the counter',
      },
    },
    {
      title: 'TrueTime',
      tag: 'concept',
      heading: 'TrueTime: know how wrong the clock is, then wait',
      eli5: 'Instead of saying "it is 12 o\'clock", the room clock says "it is between 11:59 and 12:01". Before posting a note, you wait until 12:01 has surely passed. Then nobody can post one that looks earlier.',
      body: [
        'Google\'s Spanner takes the other route: make physical time trustworthy enough to order transactions. Datacenters carry GPS receivers and atomic clocks, and the **TrueTime** API returns an interval, `[earliest, latest]`, that is guaranteed to contain the true time. The width is usually a few milliseconds.',
        'On commit, Spanner picks a timestamp and then performs **commit wait**: it holds the result until `earliest` has passed that timestamp, so the timestamp is surely in the past everywhere. Any transaction that starts afterwards gets a larger timestamp. Timestamp order then matches real-time order.',
        'The price is hardware, plus a wait of roughly the uncertainty on every commit. The lesson carries over even without the hardware: a timestamp is only as good as the bound on its error, and correct systems either measure that bound or avoid needing one.',
      ],
      keyIdea: 'If you can bound clock error tightly, you can wait it out and make timestamps match real time.',
      metrics: { skew: '± a few ms, bounded', lost: '0', siblings: '1', meta: '1 timestamp' },
      scene: {
        nodes: [{ ...x, status: 'active', badge: 'commit wait' }, { ...y, badge: 'now = [t-4 ms, t+4 ms]' }, { ...ntp, label: 'time masters', sub: 'GPS + atomic', status: 'ok' }],
        links: [
          { from: 'ntp', to: 'y', style: 'dashed' as const },
          { from: 'ntp', to: 'x', style: 'dashed' as const },
          { from: 'x', to: 'y', style: 'faint' as const },
        ],
        flows: [
          { path: ['ntp', 'y'], tone: 'handshake', label: 'time + error bound', duration: 1.2 },
          { path: ['ntp', 'x'], tone: 'handshake', duration: 1.6 },
          { path: ['x', 'y'], tone: 'data', label: 'visible after the wait', duration: 1.2, delay: 2.2 },
        ],
        caption: 'Wait out the uncertainty, then commit',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Order by what writers saw, not by what clocks say',
      eli5: 'Room clocks wander, so do not trust them to decide which note is newer. Number your notes, keep a tally of what you had seen, keep both lists when they clash, and combine them on purpose.',
      body: [
        'Wall clocks **drift** and **skew**, so **last-write-wins** by timestamp can drop a later write and always drops one of two concurrent writes. What matters is **happens-before**. **Lamport clocks** give an order consistent with it but cannot spot concurrency.',
        '**Vector clocks** and **version vectors** can: a Dynamo-style store keeps concurrent writes as **siblings** and the application merges them, with tombstones for deletes. **Hybrid logical clocks** keep timestamps near real time without breaking causality, and **TrueTime** bounds clock error tightly enough to wait it out.',
      ],
      keyIdea: 'Physical time can tell you roughly when. Only logical time can tell you what came after what.',
      metrics: { skew: 'irrelevant', lost: '0', siblings: 'merged', meta: '1 counter per replica' },
      scene: {
        nodes: [ann, ben, { ...x, status: 'ok' }, { ...y, status: 'ok' }, { ...z, status: 'ok', badge: '{X:3, Y:1}' }],
        links,
        flows: [
          { path: ['ann', 'x'], tone: 'request', duration: 1 },
          { path: ['ben', 'y'], tone: 'request', duration: 1, delay: 0.3 },
          { path: ['x', 'y', 'z'], tone: 'data', duration: 1.6, delay: 1.1 },
          { path: ['y', 'z'], tone: 'data', duration: 1.2, delay: 1.4 },
        ],
      },
      quiz: {
        question: 'Two replicas accept writes to the same key. Replica clocks can differ by up to 300 ms. Which approach guarantees that two concurrent edits are not silently lost?',
        options: [
          'Last-write-wins using wall-clock timestamps',
          'Lamport timestamps with ties broken by node id',
          'Version vectors that keep concurrent writes as siblings for the application to merge',
          'Syncing NTP more often',
        ],
        answer: 2,
        explain: 'LWW and Lamport timestamps both pick one winner, so one concurrent edit is dropped. Better NTP shrinks skew but still picks a winner. Version vectors detect that the writes were concurrent and keep both.',
      },
    },
  ],
};
