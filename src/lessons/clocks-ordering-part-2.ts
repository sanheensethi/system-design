import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const ann: SceneNode = { id: 'ann', kind: 'phone', at: at(-5.2, -2), label: 'Ann', sub: 'phone' };
const ben: SceneNode = { id: 'ben', kind: 'phone', at: at(-5.2, 2.6), label: 'Ben', sub: 'phone' };
const x: SceneNode = { id: 'x', kind: 'block', at: at(-1.8, -2), label: 'node X', sub: 'replica', icon: 'Server', tint: 'blue' };
const y: SceneNode = { id: 'y', kind: 'block', at: at(1.8, 2.6), label: 'node Y', sub: 'replica', icon: 'Server', tint: 'violet' };
const z: SceneNode = { id: 'z', kind: 'block', at: at(6, 0.6), label: 'node Z', sub: 'replica', icon: 'Server', tint: 'teal' };
const ntp: SceneNode = { id: 'ntp', kind: 'block', at: at(2.4, -5.2), label: 'time server', sub: 'NTP', icon: 'Clock', tint: 'amber' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });
const sync = (extra: Partial<SceneLink> = {}): SceneLink[] => [
  link('x', 'y', { style: 'dashed', ...extra }),
  link('y', 'z', { style: 'dashed', ...extra }),
];

export const clocksOrderingPart2: Lesson = {
  id: 'clocks-ordering-part-2',
  title: 'Clocks, ordering and version vectors (part 2)',
  tagline: 'Vector clocks and version vectors detect concurrent writes. CRDTs, hybrid clocks and TrueTime push further.',
  minutes: 18,
  level: 'Advanced',
  learn: [
    'Vector clocks: detecting writes that were concurrent',
    'Version vectors and siblings in a Dynamo-style store, with read repair',
    'The cost of version vectors: metadata growth and pruning',
    'Tombstones for deletes, and CRDTs for automatic merges',
    'Hybrid logical clocks and TrueTime',
  ],
  metrics: [
    { key: 'skew', label: 'Clock skew', icon: 'Clock' },
    { key: 'lost', label: 'Writes lost', icon: 'Bug' },
    { key: 'siblings', label: 'Versions kept', icon: 'Copy' },
    { key: 'meta', label: 'Metadata per write', icon: 'Hash' },
  ],
  steps: [
    {
      title: 'Need more',
      tag: 'problem',
      heading: 'Lamport numbers cannot say whether two edits clashed',
      eli5: 'The family numbers every note, but a bigger number never says whether the writer had seen the other note. The **hall** needs a way to tell "after" from "never saw".',
      body: [
        'Ann adds shoes on X and Ben adds socks on Y. Their Lamport numbers are 2 and 9. The store can sort them, but it cannot tell whether Ben saw Ann\'s edit.',
        'To keep both edits, the store needs a record of what each writer had seen.',
      ],
      keyIdea: 'To catch a conflict, a write must carry a summary of what its writer had seen.',
      metrics: { skew: 'irrelevant', lost: '1 of 2', siblings: '1', meta: '1 integer' },
      metricTones: { lost: 'bad' },
      scene: {
        nodes: [ann, ben, { ...x, chips: ['shoes, L = 2'] }, { ...y, chips: ['socks, L = 9'], status: 'hot' }],
        links: [link('ann', 'x'), link('ben', 'y'), link('x', 'y', { style: 'dashed', label: 'conflict? unknown', labelTone: 'warn' })],
        flows: [
          { path: ['ann', 'x'], tone: 'request', label: 'add shoes', duration: 1 },
          { path: ['ben', 'y'], tone: 'request', label: 'add socks', duration: 1, delay: 0.4 },
        ],
        panel: {
          title: 'What the store knows',
          icon: 'Hash',
          rows: [
            { text: 'Order', value: 'shoes, then socks' },
            { text: 'Did Ben see shoes?', value: 'unknown', tone: 'bad' },
          ],
        },
        caption: 'A number cannot say who saw what',
      },
    },
    {
      title: 'Vector clocks',
      tag: 'concept',
      heading: 'Vector clocks: one counter per node',
      eli5: 'Each note now carries a small tally: how many notes from each family member the writer had seen. Compare two tallies and you can tell if one writer saw the other\'s note, or if neither did.',
      body: [
        'A **vector clock** keeps one counter per node, like `{X: 2, Y: 1}`. Each entry counts events from that node.',
        'The vector records exactly which events the writer had seen, so two vectors can be compared.',
      ],
      keyIdea: 'A vector clock is a summary of everything a writer had seen, node by node.',
      metrics: { skew: 'irrelevant', lost: '-', siblings: '1', meta: '1 counter per node' },
      scene: {
        nodes: [{ ...x, status: 'active', badge: '{X:2, Y:0}' }, { ...y, status: 'active', badge: '{X:1, Y:1}' }, { ...z, badge: '{X:0, Y:0}' }],
        links: sync(),
        panel: {
          title: 'Reading {X:2, Y:1}',
          icon: 'Braces',
          rows: [
            { text: 'X entry = 2', value: 'saw 2 events from X' },
            { text: 'Y entry = 1', value: 'saw 1 event from Y' },
          ],
        },
        caption: 'One counter per node',
      },
    },
    {
      title: 'Update rules',
      tag: 'concept',
      heading: 'Bump your own entry, merge what you hear',
      eli5: 'When you write a note, add one to your own line on the tally. When you read someone else\'s note, copy the bigger number on every line, then add one to yours.',
      body: [
        'A node bumps its own entry on each event. On receiving a message it takes the entry-by-entry maximum, then bumps its own.',
        'That keeps each vector equal to everything the node has seen so far.',
      ],
      keyIdea: 'Entry-wise maximum merges knowledge. The own-entry bump records the new event.',
      metrics: { skew: 'irrelevant', lost: '-', siblings: '1', meta: '1 counter per node' },
      scene: {
        nodes: [{ ...x, status: 'active', badge: '{X:1}' }, { ...y, status: 'active', badge: '{X:1, Y:1}' }, { ...z, badge: '{X:1, Y:1, Z:1}' }],
        links: sync(),
        flows: [
          { path: ['x', 'y'], tone: 'event', label: '{X:1}', duration: 1.3 },
          { path: ['y', 'z'], tone: 'event', label: '{X:1, Y:1}', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'Update rules',
          icon: 'Braces',
          rows: [
            { text: 'Local event on X', value: 'X += 1' },
            { text: 'Receive a vector', value: 'entry-wise max' },
            { text: 'Then count the receive', value: 'own += 1' },
          ],
        },
        caption: 'Merged by maximum',
      },
    },
    {
      title: 'Before and after',
      tag: 'concept',
      heading: 'If one vector is at least as big everywhere, it came later',
      eli5: 'Lay two tallies side by side. If one is at least as big on every line, that writer saw everything the other saw, so their note is the newer one.',
      body: [
        'Compare two vectors entry by entry. If every entry of A is less than or equal to B, A **happened before** B. If B is less than or equal to A everywhere, B came first.',
        'The newer write may safely replace the older one.',
      ],
      keyIdea: 'A vector that dominates another has seen everything the other saw.',
      metrics: { skew: 'irrelevant', lost: '0', siblings: '1', meta: '1 counter per node' },
      metricTones: { lost: 'good' },
      scene: {
        nodes: [{ ...x, status: 'active', chips: ['A = {X:1}'] }, { ...y, status: 'active', chips: ['B = {X:1, Y:1}'] }, { ...z, status: 'ok', badge: 'keeps B' }],
        links: sync(),
        flows: [
          { path: ['x', 'y'], tone: 'data', label: '{X:1}', duration: 1.3 },
          { path: ['y', 'z'], tone: 'data', label: '{X:1, Y:1}', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: '{X:1} vs {X:1, Y:1}',
          icon: 'Scale',
          rows: [
            { text: 'X entry', value: '1 = 1' },
            { text: 'Y entry', value: '0 < 1' },
            { text: 'Verdict', value: 'A before B', tone: 'good' },
          ],
          footer: { text: 'B saw A, so B replaces A', tone: 'good' },
        },
        caption: 'B has seen all of A',
      },
    },
    {
      title: 'Concurrent verdict',
      tag: 'concept',
      heading: 'If each is bigger somewhere, the writes were concurrent',
      eli5: 'If each tally is bigger on a different line, neither writer saw the other\'s note. Neither is newer, so the family keeps both.',
      body: [
        'If each vector is bigger somewhere, neither saw the other: the writes are **concurrent**.',
        'Vector clocks capture exactly what each write had seen, so they tell "came after" apart from "concurrent".',
      ],
      keyIdea: 'Neither vector dominates, so neither write wins.',
      metrics: { skew: 'irrelevant', lost: '0', siblings: '2 (detected)', meta: '1 counter per node' },
      metricTones: { lost: 'good', siblings: 'good' },
      scene: {
        nodes: [{ ...x, status: 'active', chips: ['A = {X:2}'] }, { ...y, status: 'active', chips: ['B = {X:1, Y:1}'] }, { ...z, status: 'hot', badge: 'concurrent!' }],
        links: sync(),
        flows: [
          { path: ['x', 'z'], tone: 'data', label: '{X:2}', duration: 1.6 },
          { path: ['y', 'z'], tone: 'data', label: '{X:1, Y:1}', duration: 1.6, delay: 0.5 },
        ],
        panel: {
          title: '{X:2} vs {X:1, Y:1}',
          icon: 'Scale',
          rows: [
            { text: 'X entry', value: '2 > 1, A ahead' },
            { text: 'Y entry', value: '0 < 1, B ahead', tone: 'warn' },
            { text: 'Verdict', value: 'concurrent', tone: 'bad' },
          ],
          footer: { text: 'Neither vector dominates, so neither write wins', tone: 'warn' },
        },
        caption: 'Neither vector dominates',
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
      title: 'Worked example',
      tag: 'case',
      heading: 'Three writes, one conflict found',
      eli5: 'Ann writes a note in the kitchen. Ben reads it in the hall and adds to it. Before Ann hears about that, she writes another. The tallies show the second kitchen note and Ben\'s note never saw each other.',
      body: [
        'Ann writes on X, producing `{X: 1}`. It replicates to Y. Ben edits on Y, producing `{X: 1, Y: 1}`, which is after.',
        'Meanwhile Ann writes again on X before seeing Ben\'s edit: `{X: 2}`. Against `{X: 1, Y: 1}` it is bigger on X and smaller on Y. Concurrent, and now the store knows it.',
      ],
      keyIdea: 'The store did not need a clock to find the conflict. The vectors were enough.',
      metrics: { skew: 'irrelevant', lost: '0', siblings: '2 (detected)', meta: '1 counter per node' },
      metricTones: { lost: 'good' },
      scene: {
        nodes: [ann, ben, { ...x, status: 'active', chips: ['{X:1}', '{X:2}'] }, { ...y, status: 'active', chips: ['{X:1, Y:1}'] }, { ...z, status: 'hot', badge: 'concurrent!' }],
        links: [link('ann', 'x'), link('ben', 'y'), ...sync()],
        flows: [
          { path: ['ann', 'x'], tone: 'request', label: 'write again', duration: 1 },
          { path: ['ben', 'y'], tone: 'request', label: 'edit', duration: 1 },
          { path: ['x', 'z'], tone: 'data', label: '{X:2}', duration: 1.6, delay: 1.2 },
          { path: ['y', 'z'], tone: 'data', label: '{X:1, Y:1}', duration: 1.2, delay: 1.5 },
        ],
        panel: {
          title: 'The three writes',
          icon: 'List',
          rows: [
            { text: 'Ann writes on X', value: '{X:1}' },
            { text: 'Ben edits on Y after v1', value: '{X:1, Y:1}', tone: 'good' },
            { text: 'Ann writes again on X', value: '{X:2}', tone: 'warn' },
          ],
          footer: { text: '{X:2} vs {X:1, Y:1} is concurrent', tone: 'warn' },
        },
        caption: 'The second write on X never saw Ben\'s edit',
      },
    },
    {
      title: 'Version vectors',
      tag: 'concept',
      heading: 'Version vectors: the same idea, kept per stored value',
      eli5: 'The tally now sits on each stored list, not on each person. Each list says how many times each room has changed it, so any room can tell which list is newer or whether they clash.',
      body: [
        'Dynamo-style stores attach a **version vector** to each value: one counter per replica that coordinated a write to that key.',
        'The same comparison rules apply, but the counters live with the data.',
      ],
      keyIdea: 'A version vector is a vector clock attached to a stored value, keyed by the replicas that wrote it.',
      metrics: { skew: 'irrelevant', lost: '0', siblings: '1 or more', meta: '1 counter per replica' },
      scene: {
        nodes: [{ ...x, chips: [{ text: 'cart: [shoes]', icon: 'ShoppingBag' }], badge: '{X:1}' }, { ...y, chips: [{ text: 'cart: [shoes, hat]', icon: 'ShoppingBag' }], badge: '{X:1, Y:1}' }, { ...z, badge: 'holds {X:1}' }],
        links: sync(),
        panel: {
          title: 'Value plus version',
          icon: 'Table',
          rows: [
            { text: 'Key', value: 'cart:7' },
            { text: 'Value', value: '[shoes, hat]' },
            { text: 'Version vector', value: '{X:1, Y:1}' },
          ],
        },
        caption: 'The version rides with the value',
      },
    },
    {
      title: 'Compare on write',
      tag: 'concept',
      heading: 'On every write, older versions go and concurrent ones stay',
      eli5: 'When a new list arrives, the room checks its tally against the list on the fridge. Older list: throw it away. A clashing list: keep both.',
      body: [
        'On a write, the store compares the new version with what it holds.',
        'A strictly older version is discarded. A concurrent one is kept next to it.',
      ],
      keyIdea: 'The store throws away only what a newer write has provably seen.',
      metrics: { skew: 'irrelevant', lost: '0', siblings: '1 or more', meta: '1 counter per replica' },
      scene: {
        nodes: [{ ...y, chips: ['put {X:1, Y:1}'] }, { ...z, status: 'active', badge: 'holds {X:1}' }, { ...x, chips: ['{X:2}'] }],
        links: sync(),
        flows: [{ path: ['y', 'z'], tone: 'data', label: 'put {X:1, Y:1}', duration: 1.6 }],
        panel: {
          title: 'Z compares on write',
          icon: 'Scale',
          rows: [
            { text: 'Held {X:1} vs new {X:1, Y:1}', value: 'before', tone: 'good' },
            { text: 'Action', value: 'drop the old one', tone: 'good' },
            { text: 'Held {X:2} vs new {X:1, Y:1}', value: 'concurrent', tone: 'warn' },
            { text: 'Action', value: 'keep both' },
          ],
        },
        caption: 'Older versions go, concurrent ones stay',
      },
    },
    {
      title: 'Read repair',
      tag: 'concept',
      heading: 'Vectors show which replica is stale',
      eli5: 'When the family reads the list from two rooms and one copy is clearly older, the reader fixes it on the spot. The tallies show which copy is the old one.',
      body: [
        'On a read the coordinator asks several replicas. If one version dominates another, the stale replica is behind and gets the newer value. This is **read repair**.',
        'Dynamo also runs background **anti-entropy** with Merkle trees to catch keys nobody reads.',
      ],
      keyIdea: 'Comparing version vectors tells a store which replica is behind and what to copy to it.',
      metrics: { skew: 'irrelevant', lost: '0', siblings: '1', meta: '1 counter per replica' },
      metricTones: { lost: 'good' },
      scene: {
        nodes: [ann, { ...y, status: 'ok', chips: ['{X:1, Y:1}'] }, { ...z, status: 'hot', chips: ['{X:1}'], badge: 'stale' }],
        links: [link('ann', 'y', { label: 'get cart:7', arrow: 'both' }), link('y', 'z', { style: 'dashed', label: 'repair', labelTone: 'good' })],
        flows: [
          { path: ['ann', 'y'], tone: 'request', label: 'get', duration: 1.1 },
          { path: ['y', 'z'], tone: 'data', label: 'repair {X:1, Y:1}', duration: 1.4, delay: 1.3 },
        ],
        panel: {
          title: 'Read repair',
          icon: 'RefreshCw',
          rows: [
            { text: 'Y holds', value: '{X:1, Y:1}' },
            { text: 'Z holds', value: '{X:1}', tone: 'warn' },
            { text: 'Y dominates Z', value: 'copy Y to Z', tone: 'good' },
          ],
        },
        caption: 'The newer version heals the stale replica',
      },
    },
    {
      title: 'Siblings',
      tag: 'case',
      heading: 'Case: a shared cart keeps both edits',
      eli5: 'When the family finds two shopping lists that nobody combined, they keep both on the fridge. Next time someone reads the list, they see both and can combine them.',
      body: [
        'Ann\'s cart `[shoes]` and Ben\'s cart `[socks]` are concurrent, so node Z stores both as **siblings**. The next read returns both plus a **context**: the merged vector.',
        'The application merges them (for a cart, take the union, `[shoes, socks]`) and writes the result back with that context.',
      ],
      keyIdea: 'Version vectors let the store keep concurrent writes as siblings and hand the merge to code that understands the data.',
      metrics: { skew: 'irrelevant', lost: '0', siblings: '2 siblings', meta: '1 counter per replica' },
      metricTones: { lost: 'good', siblings: 'warn' },
      scene: {
        nodes: [{ ...ann, status: 'active', badge: 'merge: shoes + socks' }, { ...z, status: 'hot', chips: ['[shoes] {X:2}', '[socks] {Y:1}'] }, y],
        links: [link('z', 'ann', { label: 'get cart:7', arrow: 'both' }), link('z', 'y', { style: 'dashed' })],
        flows: [
          { path: ['z', 'ann'], tone: 'response', label: '[shoes] and [socks] + context', duration: 1.6 },
          { path: ['ann', 'z'], tone: 'request', label: 'put [shoes, socks] + context', duration: 1.6, delay: 1.8 },
        ],
        panel: {
          title: 'What a read returns',
          icon: 'Copy',
          rows: [
            { text: 'Sibling 1', value: '[shoes]' },
            { text: 'Sibling 2', value: '[socks]' },
            { text: 'Context', value: '{X:2, Y:1}' },
          ],
        },
        caption: 'Read returns both siblings and a context',
      },
    },
    {
      title: 'Merge and write',
      tag: 'case',
      heading: 'Writing the merge back collapses the siblings',
      eli5: 'Ann combines the two lists into one and writes on it that she saw both. Now her list is newer than both old ones, so the family throws those away and keeps just hers.',
      body: [
        'Because the new write\'s vector dominates both siblings, the store can drop them, and the key is back to one value.',
        'Nothing was lost. The store detected the conflict and the application, which knows what a cart means, resolved it.',
      ],
      keyIdea: 'The context sent back with a write is what lets the store know the new value replaces both siblings.',
      metrics: { skew: 'irrelevant', lost: '0', siblings: '2 → 1 after merge', meta: '1 counter per replica' },
      metricTones: { lost: 'good', siblings: 'good' },
      scene: {
        nodes: [{ ...ann, status: 'active' }, { ...z, status: 'ok', chips: ['[shoes, socks]'], badge: '2 siblings → 1' }, { ...y, chips: ['[shoes, socks]'] }],
        links: [link('ann', 'z', { label: 'put + context' }), link('z', 'y', { style: 'dashed', label: 'merged version' })],
        flows: [
          { path: ['ann', 'z'], tone: 'request', label: 'put [shoes, socks] + context', duration: 1.6 },
          { path: ['z', 'y'], tone: 'data', label: 'merged version', duration: 1.4, delay: 1.8 },
        ],
        panel: {
          title: 'New write vs siblings',
          icon: 'Copy',
          rows: [
            { text: 'vs [shoes] {X:2}', value: 'after', tone: 'good' },
            { text: 'vs [socks] {Y:1}', value: 'after', tone: 'good' },
            { text: 'Result', value: '1 value', tone: 'good' },
          ],
        },
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
      title: 'Lost context',
      tag: 'tradeoff',
      heading: 'A write without the context piles up siblings',
      eli5: 'If Ann writes her combined list but forgets to say she saw the other two, the family thinks she saw nothing. Now there are three lists on the fridge.',
      body: [
        'With an empty context the new write has not seen either sibling, so it is concurrent with both.',
        'The store keeps all three. Always send back the context from the read.',
      ],
      keyIdea: 'The context is what proves a write saw the siblings. Drop it and the conflict grows.',
      metrics: { skew: 'irrelevant', lost: '0', siblings: '3 siblings', meta: '1 counter per replica' },
      metricTones: { siblings: 'bad' },
      scene: {
        nodes: [{ ...ann, status: 'active', chips: [{ text: 'put, context = {}', tone: 'warn' }] }, { ...z, status: 'hot', chips: ['[shoes] {X:2}', '[socks] {Y:1}', { text: '[shoes, socks] {Z:1}', tone: 'bad' }], badge: '3 siblings' }],
        links: [link('ann', 'z', { label: 'empty context', labelTone: 'warn' })],
        flows: [{ path: ['ann', 'z'], tone: 'request', label: 'put [shoes, socks], no context', duration: 1.6 }],
        panel: {
          title: 'New write vs siblings',
          icon: 'Copy',
          rows: [
            { text: 'vs [shoes] {X:2}', value: 'concurrent', tone: 'warn' },
            { text: 'vs [socks] {Y:1}', value: 'concurrent', tone: 'warn' },
            { text: 'Result', value: '3 siblings', tone: 'bad' },
          ],
        },
        caption: 'No context, no collapse',
      },
      quiz: {
        question: 'A key holds siblings [shoes] and [socks]. A client writes [shoes, socks] but sends an empty context. What does the store hold afterwards?',
        options: ['One value, [shoes, socks]', 'Three siblings', 'Only [shoes, socks], because it is newest', 'An error is returned'],
        answer: 1,
        explain: 'With an empty context the new write has not seen either sibling, so it is concurrent with both. The store keeps all three. Always send back the context from the read.',
      },
    },
    {
      title: 'Metadata cost',
      tag: 'tradeoff',
      heading: 'Metadata grows with the writers',
      eli5: 'Tallies make every note a bit longer, and the more family members write, the longer they get.',
      body: [
        'Keying the vector by replica, not by client, keeps it small. Key by client and every new client adds an entry for good. Stores also prune: Dynamo caps it at 10 entries, and over-eager pruning makes writes look falsely concurrent.',
        'Replica keying is not free. Two clients writing through the same coordinator can get vectors that look ordered, so one write silently overwrites the other or siblings pile up. Dotted version vectors fix this, as in Riak.',
      ],
      keyIdea: 'Version vectors cost bytes that grow with the number of writers.',
      metrics: { skew: 'irrelevant', lost: '0', siblings: 'up to N', meta: 'grows with writers' },
      metricTones: { meta: 'warn' },
      scene: {
        nodes: [{ ...x, chips: ['{X:9, Y:4, Z:2, W:1, ...}'], badge: 'vector grows' }, { ...y, status: 'dim' }, { ...z, status: 'dim' }],
        links: sync({ style: 'faint' }),
        panel: {
          title: 'Keyed by',
          icon: 'Hash',
          rows: [
            { text: 'Replica', value: 'small, bounded', tone: 'good' },
            { text: 'Client', value: 'grows with clients', tone: 'bad' },
            { text: 'Pruned too eagerly', value: 'false conflicts', tone: 'warn' },
          ],
        },
        caption: 'Every writer adds an entry',
      },
    },
    {
      title: 'Merge is yours',
      tag: 'tradeoff',
      heading: 'The store detects conflicts. Your code resolves them',
      eli5: 'The fridge can show you two clashing lists, but only the family knows how to combine them. Shopping lists merge by joining, but a note about how much money is left must not be joined at all.',
      body: [
        'The store can say "these conflict", but only the application knows that carts merge by union and that a bank balance must not merge at all.',
        'Every reader must handle siblings, and a careless merge reintroduces lost updates.',
      ],
      keyIdea: 'Version vectors move conflict handling from the clock to the application. That is more correct and more work.',
      metrics: { skew: 'irrelevant', lost: '0 if merged well', siblings: 'up to N', meta: 'grows with writers' },
      scene: {
        nodes: [{ ...z, status: 'active', chips: ['sibling A', 'sibling B'] }, { ...ann, chips: ['merge()'], status: 'active' }, { ...ben, status: 'dim' }],
        links: [link('z', 'ann', { arrow: 'both', label: 'siblings out, merge in' })],
        panel: {
          title: 'Merge rule per data type',
          icon: 'Split',
          rows: [
            { text: 'Shopping cart', value: 'union', tone: 'good' },
            { text: 'Profile name', value: 'pick one, ask user', tone: 'warn' },
            { text: 'Account balance', value: 'never merge', tone: 'bad' },
          ],
        },
        caption: 'Only the application knows what a merge means',
      },
    },
    {
      title: 'Tombstones',
      tag: 'tradeoff',
      heading: 'Deletes come back unless you leave a tombstone',
      eli5: 'If Ben crosses out milk on one list but Ann\'s list still has it, a plain combine brings the milk back. Ben leaves a note saying "milk removed", and keeps it until every room has seen it.',
      body: [
        'The cart already holds [socks]. Ben removes socks and Ann adds shoes from a copy that still has socks, so a plain union restores the socks. Deletes need **tombstones**: a marker saying "removed", kept long enough for every replica to see it.',
        'Tombstones take space until they can be purged. Purge one before every replica has seen it and the delete comes back. Cassandra keeps them for gc_grace_seconds, 10 days by default.',
      ],
      keyIdea: 'A delete is a fact that must travel and be kept.',
      metrics: { skew: 'irrelevant', lost: '0', siblings: 'merged', meta: 'plus tombstones' },
      metricTones: { meta: 'warn' },
      scene: {
        nodes: [{ ...ben, status: 'active', chips: ['remove socks'] }, { ...y, chips: ['[ ] + tombstone'] }, { ...x, chips: ['[shoes, socks]'] }, { ...z, status: 'active', badge: 'union needs the tombstone' }],
        links: [link('ben', 'y'), ...sync()],
        flows: [
          { path: ['ben', 'y'], tone: 'request', label: 'remove socks', duration: 1 },
          { path: ['y', 'z'], tone: 'data', label: 'tombstone: socks', duration: 1.3, delay: 1.2 },
          { path: ['x', 'y', 'z'], tone: 'data', duration: 1.6, delay: 1.4 },
        ],
        panel: {
          title: 'Merge on Z',
          icon: 'Table',
          rows: [
            { text: 'Union without a tombstone', value: '[shoes, socks]', tone: 'bad' },
            { text: 'Union with a tombstone', value: '[shoes]', tone: 'good' },
          ],
          footer: { text: 'Keep the tombstone until all replicas have seen it', tone: 'muted' },
        },
        caption: 'Without a tombstone, the union brings socks back',
      },
    },
    {
      title: 'Avoid conflicts',
      tag: 'concept',
      heading: 'Often it is cheaper to prevent the conflict',
      eli5: 'Instead of sorting out clashing lists afterwards, the family can pick one person who writes the list, or check the list has not changed before adding to it.',
      body: [
        'A single leader or consensus gives every write one total order, so there is nothing to merge. A compare-and-set write carries the version it read and fails if the key has moved on.',
        'Vector siblings and CRDTs accept concurrent writes and resolve them later. Fencing tokens use the same idea for paused processes: a lock carries a rising number and the store rejects any older one.',
      ],
      keyIdea: 'Detect conflicts only when you must accept concurrent writes. Otherwise order the writes.',
      metrics: { skew: 'irrelevant', lost: '0', siblings: 'depends', meta: 'depends' },
      scene: {
        nodes: [{ ...ann, status: 'active', chips: ['put if version = 4'] }, { ...z, status: 'ok', chips: ['version 5'] }, { ...ben, status: 'dim' }],
        links: [link('ann', 'z', { label: 'conditional write' }), link('ben', 'z', { label: 'stale version', labelTone: 'warn', style: 'dashed' })],
        flows: [{ path: ['ann', 'z'], tone: 'request', label: 'version 4 ok', duration: 1.4 }],
        panel: {
          title: 'Ways to handle concurrent writes',
          icon: 'Split',
          rows: [
            { text: 'Single leader', value: 'one total order', tone: 'good' },
            { text: 'Compare-and-set', value: 'stale write rejected', tone: 'good' },
            { text: 'Vector siblings', value: 'app merges', tone: 'warn' },
            { text: 'CRDT', value: 'type merges', tone: 'good' },
          ],
        },
        caption: 'Order the writes if you can',
      },
    },
    {
      title: 'CRDTs',
      tag: 'concept',
      heading: 'CRDTs: data types that merge without conflicts',
      eli5: 'Some lists come with built-in rules so that any two copies can be combined in any order and still end up the same. The family never has to decide how to combine.',
      body: [
        '**CRDTs** (conflict-free replicated data types) package merge rules for counters, sets and maps. The merge gives the same result whatever the order, and merging twice changes nothing.',
        'Tombstones and the rules for adds and removes live inside the type.',
      ],
      keyIdea: 'A CRDT builds the merge into the data type, so replicas converge without application code.',
      metrics: { skew: 'irrelevant', lost: '0', siblings: 'merged', meta: 'type-specific' },
      metricTones: { lost: 'good', siblings: 'good' },
      scene: {
        nodes: [{ ...x, chips: ['set: {shoes}'] }, { ...y, chips: ['set: {socks}'] }, { ...z, status: 'ok', badge: 'set: {shoes, socks}' }],
        links: sync({ label: 'merge' }),
        flows: [
          { path: ['x', 'z'], tone: 'data', label: '{shoes}', duration: 1.5 },
          { path: ['y', 'z'], tone: 'data', label: '{socks}', duration: 1.5, delay: 0.4 },
        ],
        panel: {
          title: 'Merge must be',
          icon: 'Split',
          rows: [
            { text: 'Order-free', value: 'a + b = b + a', tone: 'good' },
            { text: 'Grouping-free', value: '(a + b) + c = a + (b + c)', tone: 'good' },
            { text: 'Repeat-safe', value: 'a + a = a', tone: 'good' },
          ],
        },
        caption: 'Any order, same result',
      },
    },
    {
      title: 'Counter CRDT',
      tag: 'case',
      heading: 'A counter that cannot lose an increment',
      eli5: 'Each family member keeps their own tally of snacks eaten. The total is everyone\'s tallies added up, so nobody\'s count gets overwritten.',
      body: [
        'A grow-only counter (**G-counter**) gives each replica its own slot. A replica only increments its own slot, and merging takes the maximum per slot.',
        'The value is the sum of all slots. Two concurrent increments both survive.',
      ],
      keyIdea: 'One slot per replica and max-merge make concurrent increments add up instead of overwrite.',
      metrics: { skew: 'irrelevant', lost: '0', siblings: 'merged', meta: '1 slot per replica' },
      metricTones: { lost: 'good' },
      scene: {
        nodes: [{ ...x, chips: ['{X:3, Y:0}'] }, { ...y, chips: ['{X:0, Y:2}'] }, { ...z, status: 'ok', badge: '{X:3, Y:2} = 5' }],
        links: sync(),
        flows: [
          { path: ['x', 'z'], tone: 'data', label: '{X:3}', duration: 1.5 },
          { path: ['y', 'z'], tone: 'data', label: '{Y:2}', duration: 1.5, delay: 0.4 },
        ],
        panel: {
          title: 'G-counter on Z',
          icon: 'Hash',
          rows: [
            { text: 'X slot', value: 'max(3, 0) = 3' },
            { text: 'Y slot', value: 'max(0, 2) = 2' },
            { text: 'Value', value: '3 + 2 = 5', tone: 'good' },
          ],
        },
        caption: 'Max per slot, sum for the value',
      },
      code: {
        language: 'python',
        title: 'A grow-only counter',
        source: `class GCounter:
    def __init__(self, me):
        self.me, self.slots = me, {}

    def incr(self):
        self.slots[self.me] = self.slots.get(self.me, 0) + 1

    def merge(self, other):             # safe in any order, any number of times
        for n, c in other.slots.items():
            self.slots[n] = max(self.slots.get(n, 0), c)

    def value(self):
        return sum(self.slots.values())`,
        highlight: [6, 9, 10, 13],
      },
    },
    {
      title: 'Hybrid clocks',
      tag: 'concept',
      heading: 'Hybrid logical clocks: close to real time, safe for causality',
      eli5: 'Each note gets the room clock time, but if you have already seen a note with a later time, you use that time plus a tick. The numbers look like real times and still never go backwards.',
      body: [
        'Logical clocks respect causality but their numbers mean nothing to a human. A **hybrid logical clock** (HLC) stamps each event with a pair: a physical time and a small counter.',
        'The stamps stay close to real time, and a reply is always stamped after its cause.',
      ],
      keyIdea: 'An HLC is a wall-clock time that is never allowed to contradict cause and effect.',
      metrics: { skew: 'bounded, e.g. 500 ms', lost: '0', siblings: '1', meta: 'time + counter' },
      metricTones: { skew: 'good' },
      scene: {
        nodes: [{ ...x, status: 'active', badge: '12:00:00.500 · 0' }, { ...y, status: 'active', badge: '12:00:00.200 · 0' }, z],
        links: sync(),
        panel: {
          title: 'An HLC stamp',
          icon: 'Clock',
          rows: [
            { text: 'Physical part', value: 'wall-clock time' },
            { text: 'Counter', value: 'breaks ties' },
          ],
          footer: { text: 'Readable like a time, ordered like a Lamport clock', tone: 'muted' },
        },
        caption: 'Time plus a counter',
      },
    },
    {
      title: 'HLC rule',
      tag: 'case',
      heading: 'A node with a slow clock borrows the larger time',
      eli5: 'The hall clock is behind. When it hears about a kitchen note timed later than its own clock, it uses the kitchen time and adds a tick, so its reply never looks older than the note it answers.',
      body: [
        'The physical part is the larger of the local wall clock and the largest time seen in any message. The counter breaks ties.',
        'Here Y\'s clock reads .200 but X stamped .500, so Y replies at .500 with counter 1.',
      ],
      keyIdea: 'Take the maximum of local time and heard time, and tick the counter when the time does not advance.',
      metrics: { skew: 'bounded, e.g. 500 ms', lost: '0', siblings: '1', meta: 'time + counter' },
      metricTones: { skew: 'good' },
      scene: {
        nodes: [{ ...x, status: 'active', badge: '12:00:00.500 · 0' }, { ...y, status: 'active', badge: 'clock .200 → .500 · 1' }, z],
        links: sync(),
        flows: [
          { path: ['x', 'y'], tone: 'event', label: 'stamped .500 · 0', duration: 1.3 },
          { path: ['y', 'z'], tone: 'event', label: 'reply .500 · 1', duration: 1.3, delay: 1.5 },
        ],
        panel: {
          title: 'Y receives .500 · 0',
          icon: 'Clock',
          rows: [
            { text: 'Y wall clock', value: '.200' },
            { text: 'Largest time seen', value: '.500' },
            { text: 'Physical part', value: '.500', tone: 'good' },
            { text: 'Counter', value: '1', tone: 'good' },
          ],
          footer: { text: 'Y\'s clock is behind, so it borrows X\'s time', tone: 'muted' },
        },
        caption: 'Y borrows X\'s time and ticks the counter',
      },
    },
    {
      title: 'HLC in use',
      tag: 'case',
      heading: 'CockroachDB uses HLCs and bounds the skew',
      eli5: 'The family allows room clocks to be a little off. A room whose clock wanders past that limit is sent out until its clock is fixed.',
      body: [
        'CockroachDB stamps transactions with HLCs but assumes a maximum clock offset (500 ms by default). A node that drifts past it shuts itself down.',
        'The bound keeps timestamps meaningful, and it needs NTP or similar to hold.',
      ],
      keyIdea: 'An HLC stays safe on causality, and the skew bound is what keeps it close to real time.',
      metrics: { skew: 'max 500 ms', lost: '0', siblings: '1', meta: 'time + counter' },
      metricTones: { skew: 'warn' },
      scene: {
        nodes: [{ ...x, status: 'ok', badge: 'offset 20 ms' }, { ...y, status: 'ok', badge: 'offset 80 ms' }, { ...z, status: 'down', badge: 'offset 600 ms, shut down' }],
        links: [link('x', 'z', { style: 'faint', label: 'over the bound', labelTone: 'warn' }), link('x', 'y', { style: 'dashed' })],
        panel: {
          title: 'Max offset 500 ms',
          icon: 'Gauge',
          rows: [
            { text: 'X', value: '20 ms', tone: 'good' },
            { text: 'Y', value: '80 ms', tone: 'good' },
            { text: 'Z', value: '600 ms', tone: 'bad' },
          ],
          footer: { text: 'A node past the bound stops serving', tone: 'warn' },
        },
        caption: 'Over the bound, the node stops',
      },
    },
    {
      title: 'TrueTime',
      tag: 'concept',
      heading: 'TrueTime: a clock that says how wrong it might be',
      eli5: 'Instead of saying "it is 12 o\'clock", the room clock says "it is between 11:59 and 12:01". The honest range is the useful part.',
      body: [
        'Google\'s Spanner makes physical time trustworthy enough to order transactions. Datacenters carry GPS receivers and atomic clocks, and the **TrueTime** API returns `[earliest, latest]`, guaranteed to contain the true time.',
        'The width is usually a few milliseconds.',
      ],
      keyIdea: 'If you can bound clock error tightly, you know the range the true time is in.',
      metrics: { skew: '± a few ms, bounded', lost: '0', siblings: '1', meta: '1 timestamp' },
      metricTones: { skew: 'good' },
      scene: {
        nodes: [{ ...ntp, label: 'time masters', sub: 'GPS + atomic', status: 'ok' }, { ...x, status: 'active' }, { ...y, chips: ['now = [t-4 ms, t+4 ms]'] }],
        links: [link('ntp', 'x', { style: 'dashed' }), link('ntp', 'y', { style: 'dashed' })],
        flows: [
          { path: ['ntp', 'y'], tone: 'handshake', label: 'time + error bound', duration: 1.2 },
          { path: ['ntp', 'x'], tone: 'handshake', duration: 1.6 },
        ],
        panel: {
          title: 'TrueTime answer',
          icon: 'Clock',
          rows: [
            { text: 'earliest', value: 't - 4 ms' },
            { text: 'latest', value: 't + 4 ms' },
            { text: 'True time', value: 'inside, guaranteed', tone: 'good' },
          ],
        },
        caption: 'The clock reports its own error',
      },
    },
    {
      title: 'Commit wait',
      tag: 'concept',
      heading: 'Wait out the uncertainty, then commit',
      eli5: 'Before posting a note, you wait until the latest possible time has passed. Then nobody can post a note that looks earlier than yours.',
      body: [
        'On commit, Spanner picks a timestamp and does a **commit wait** until `earliest` has passed it. Timestamp order then matches real-time order.',
        'The price is hardware, plus a wait of roughly the uncertainty on every commit.',
      ],
      keyIdea: 'A timestamp is only as good as its error bound, and waiting spends that bound to make order exact.',
      metrics: { skew: '± a few ms, bounded', lost: '0', siblings: '1', meta: '1 timestamp' },
      metricTones: { skew: 'good' },
      scene: {
        nodes: [{ ...x, status: 'active', badge: 'commit wait', chips: ['commit at t'] }, { ...y, chips: ['reads after t'] }, { ...ntp, label: 'time masters', sub: 'GPS + atomic', status: 'ok' }],
        links: [link('ntp', 'x', { style: 'dashed' }), link('x', 'y', { style: 'dashed', label: 'visible after the wait', labelTone: 'good' })],
        panel: {
          title: 'Commit wait',
          icon: 'Timer',
          rows: [
            { text: 'Pick commit timestamp', value: 't' },
            { text: 'Wait until earliest passes t', value: '~4 to 8 ms' },
            { text: 'Release the result', value: 't is in the past everywhere', tone: 'good' },
          ],
          footer: { text: 'A timestamp is only as good as its error bound', tone: 'muted' },
        },
        caption: 'Wait out the uncertainty, then commit',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Order by what writers saw, not by what clocks say',
      eli5: 'Room clocks wander, so do not trust them to decide which note is newer. Keep a tally of what you had seen, keep both lists when they clash, and combine them on purpose.',
      body: [
        '**Vector clocks** and **version vectors** detect concurrent writes: a Dynamo-style store keeps them as **siblings** and the application merges them, with tombstones for deletes. **CRDTs** build the merge into the type.',
        '**Hybrid logical clocks** keep timestamps near real time, and **TrueTime** bounds clock error tightly enough to wait it out.',
      ],
      keyIdea: 'Physical time can tell you roughly when. Only logical time can tell you what came after what.',
      metrics: { skew: 'irrelevant', lost: '0', siblings: 'merged', meta: '1 counter per replica' },
      metricTones: { lost: 'good', siblings: 'good' },
      scene: {
        nodes: [ann, ben, { ...x, status: 'ok' }, { ...y, status: 'ok' }, { ...z, status: 'ok', badge: '{X:3, Y:1}' }],
        links: [link('ann', 'x'), link('ben', 'y'), ...sync()],
        flows: [
          { path: ['ann', 'x'], tone: 'request', duration: 1 },
          { path: ['ben', 'y'], tone: 'request', duration: 1, delay: 0.3 },
          { path: ['x', 'y', 'z'], tone: 'data', duration: 1.6, delay: 1.1 },
        ],
        panel: {
          title: 'Pick a tool',
          icon: 'Scale',
          rows: [
            { text: 'Rebuildable cache', value: 'LWW' },
            { text: 'Order events', value: 'Lamport / HLC' },
            { text: 'Detect conflicts', value: 'vector / version vectors', tone: 'good' },
            { text: 'Merge automatically', value: 'CRDT', tone: 'good' },
            { text: 'Real-time order', value: 'TrueTime + wait' },
          ],
        },
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
