import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const alice: SceneNode = { id: 'alice', kind: 'user', at: at(-5, -3), label: 'Alice', sub: 'New York' };
const bruno: SceneNode = { id: 'bruno', kind: 'user', at: at(5, -3), label: 'Bruno', sub: 'Berlin' };
const dbUS: SceneNode = { id: 'dbUS', kind: 'db', at: at(-3, 1), label: 'Virginia', sub: 'seat chart' };
const dbEU: SceneNode = { id: 'dbEU', kind: 'db', at: at(3, 1), label: 'Frankfurt', sub: 'seat chart' };
const wan: SceneNode = { id: 'wan', kind: 'block', size: 0.72, at: at(0, 1), label: 'Atlantic link', icon: 'Globe', tint: 'gray' };
const witness: SceneNode = { id: 'witness', kind: 'block', size: 0.72, at: at(0, 4.6), label: 'tie-breaker', sub: 'Oregon', icon: 'Scale', tint: 'violet' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });
const healthy = [link('dbUS', 'wan', { arrow: 'both' }), link('wan', 'dbEU', { arrow: 'both' })];
const cut = [
  link('dbUS', 'wan', { style: 'faint', label: 'cut', labelTone: 'warn' }),
  link('wan', 'dbEU', { style: 'faint' }),
];
const wanDown: SceneNode = { ...wan, status: 'down', badge: 'partition' };

export const capPacelc: Lesson = {
  id: 'cap-pacelc',
  title: 'CAP and PACELC',
  tagline: 'When the network splits, refuse or diverge. When it does not, pay in latency or in staleness.',
  minutes: 18,
  level: 'Intermediate',
  learn: [
    'What a network partition is and why you cannot rule it out',
    'The CAP choice: refuse writes (CP) or accept them and diverge (AP)',
    'Which real systems sit on each side, and how conflicts get resolved',
    'Why "pick 2 of 3" is a misleading way to say it',
    'PACELC: the latency vs consistency trade you pay every day',
    'The consistency ladder: linearizable, causal, session guarantees, eventual',
  ],
  metrics: [
    { key: 'mode', label: 'Mode', icon: 'Split' },
    { key: 'write', label: 'Write latency', icon: 'Timer' },
    { key: 'lag', label: 'Replica lag', icon: 'Clock' },
    { key: 'eu', label: 'Frankfurt writes', icon: 'Globe' },
    { key: 'conflicts', label: 'Conflicts', icon: 'Bug' },
  ],
  steps: [
    {
      title: 'Last seat',
      tag: 'problem',
      heading: 'The link between regions just went dark',
      eli5: 'A movie theater has two ticket booths with a phone between them. Each booth keeps its own copy of the seat chart. The phone dies just as Alice and Bruno each ask a different booth for the last seat.',
      body: [
        'A ticketing app runs in Virginia and Frankfurt. Each region holds a full copy of the seat map, called a **replica**. Tickets go on sale at 20:00.',
        'At 20:01 the link drops. Alice and Bruno both click buy on seat **14C**, the last one, and each region still sees it as free.',
      ],
      keyIdea: 'Once data lives in more than one place, a broken link forces a choice between answering now and answering correctly.',
      metrics: { lag: 'growing', eu: '?', conflicts: '?' },
      metricTones: { lag: 'warn', conflicts: 'warn' },
      scene: {
        nodes: [
          alice,
          { ...dbUS, status: 'active', badge: '14C: free' },
          wanDown,
          { ...dbEU, status: 'active', badge: '14C: free' },
          bruno,
        ],
        links: [link('alice', 'dbUS'), link('bruno', 'dbEU'), ...cut],
        flows: [
          { path: ['alice', 'dbUS'], tone: 'request', label: 'buy 14C', duration: 1.4 },
          { path: ['bruno', 'dbEU'], tone: 'request', label: 'buy 14C', duration: 1.4 },
          { path: ['dbUS', 'wan'], tone: 'error', label: 'no reply', duration: 1, delay: 1.6 },
        ],
        panel: {
          title: 'Seat 14C right now',
          icon: 'Receipt',
          rows: [
            { text: 'Virginia sees', value: 'free' },
            { text: 'Frankfurt sees', value: 'free' },
            { text: 'Link between them', value: 'down', tone: 'bad' },
          ],
          footer: { text: 'Both regions are up. They cannot talk.', tone: 'warn' },
        },
        caption: 'Both regions are up. They just cannot talk.',
      },
    },
    {
      title: 'Replication',
      tag: 'concept',
      heading: 'On a normal day, writes cross the ocean in the background',
      eli5: 'Normally the Virginia booth sells Alice her seat right away, then phones Frankfurt so it can mark its chart too. Selling first and calling after is **asynchronous replication**.',
      body: [
        'Alice\'s write commits on the Virginia replica in about 5 ms and she gets her answer. The change then ships to Frankfurt in the background. This is **asynchronous replication**.',
        'One-way travel takes about 45 ms, so Frankfurt usually catches up within 100 ms. For that window a reader in Berlin could see the old value.',
      ],
      keyIdea: 'Replicas agree only after messages arrive. Everything in this lesson is about what to do when they arrive late or not at all.',
      metrics: { mode: 'normal', write: '5 ms', lag: '~100 ms', eu: 'accepted', conflicts: '0' },
      metricTones: { write: 'good', conflicts: 'good' },
      scene: {
        nodes: [alice, { ...dbUS, status: 'active', badge: '14C: Alice' }, { ...wan, status: 'ok' }, { ...dbEU, badge: 'catching up' }],
        links: [link('alice', 'dbUS'), ...healthy],
        flows: [
          { path: ['alice', 'dbUS'], tone: 'request', label: 'buy 14C', duration: 1.2 },
          { path: ['dbUS', 'alice'], tone: 'response', label: 'booked, 5 ms', duration: 1.2, delay: 1.3 },
          { path: ['dbUS', 'wan', 'dbEU'], tone: 'data', label: 'replicate', duration: 1.6, delay: 1.3 },
        ],
        panel: {
          title: 'Timeline of one write',
          icon: 'Clock',
          rows: [
            { text: 'Commit in Virginia', value: '5 ms', tone: 'good' },
            { text: 'Answer to Alice', value: '5 ms', tone: 'good' },
            { text: 'Copy reaches Frankfurt', value: '~50 ms' },
            { text: 'Frankfurt caught up', value: '~100 ms' },
          ],
        },
        caption: 'Commit locally, copy to the other region afterward',
      },
    },
    {
      title: 'Partition',
      tag: 'concept',
      heading: 'A partition looks exactly like silence',
      eli5: 'A **network partition** is when the phone between the booths stops working. Each booth hears only silence.',
      body: [
        'A **network partition** means the nodes are running but messages between them are lost or delayed. A cut cable, a bad route, an overloaded link or a long GC pause all produce it.',
        'Partitions are rare per link. A system with many links and many machines sees one somewhere every week.',
      ],
      keyIdea: 'You cannot design a replicated system as if the network always works.',
      metrics: { lag: 'growing' },
      metricTones: { lag: 'warn' },
      scene: {
        nodes: [{ ...dbUS, badge: 'timeout' }, wanDown, { ...dbEU, badge: 'timeout' }],
        links: cut,
        flows: [
          { path: ['dbUS', 'wan'], tone: 'error', label: 'replicate?', count: 3, duration: 1 },
          { path: ['dbEU', 'wan'], tone: 'error', label: 'replicate?', count: 3, duration: 1, delay: 0.5 },
        ],
        panel: {
          title: 'What causes a partition',
          icon: 'Cable',
          rows: [
            { text: 'Cut cable or bad route' },
            { text: 'Overloaded link, packets dropped' },
            { text: 'Switch or firewall misconfigured' },
            { text: 'Long GC pause on one node' },
          ],
          footer: { text: 'Messages leave. Nothing comes back.', tone: 'warn' },
        },
        caption: 'Messages leave, nothing comes back',
      },
    },
    {
      title: 'Dead or slow',
      tag: 'concept',
      heading: 'Virginia cannot tell a crash from a cut',
      eli5: 'The Virginia booth phones Frankfurt and hears nothing. It cannot tell if the Frankfurt booth closed or if the phone line is broken. It only knows it has waited too long.',
      body: [
        'Virginia sends a replication message and hears nothing back. Frankfurt may have crashed, may be slow, or may be busy serving its own users. All Virginia has is a timeout.',
        'It has to decide what to do without knowing which of the three it is.',
      ],
      keyIdea: '"The other side is dead" and "the other side is unreachable" look the same from inside a node.',
      scene: {
        nodes: [{ ...dbUS, status: 'active', badge: 'waiting 5 s' }, wanDown, { ...dbEU, badge: 'crashed? slow? cut?' }],
        links: cut,
        flows: [{ path: ['dbUS', 'wan'], tone: 'error', label: 'are you there?', count: 2, duration: 1.2 }],
        panel: {
          title: 'What Virginia knows',
          icon: 'Clock',
          rows: [
            { text: 'Message sent', value: 'yes' },
            { text: 'Reply received', value: 'no', tone: 'bad' },
            { text: 'Frankfurt crashed', value: 'unknown', tone: 'warn' },
            { text: 'Frankfurt slow', value: 'unknown', tone: 'warn' },
            { text: 'Link cut', value: 'unknown', tone: 'warn' },
          ],
        },
        caption: 'A timeout is the only evidence',
      },
    },
    {
      title: 'Three letters',
      tag: 'concept',
      heading: 'The three letters of CAP',
      eli5: 'The booths want three things. Both charts always match (**C**). Both booths always sell (**A**). The plan keeps working when the phone breaks (**P**).',
      body: [
        '**C**onsistency: every read sees the latest successful write, as if there were one copy. **A**vailability: every request to a running node gets a non-error answer.',
        '**P**artition tolerance: the system keeps operating while messages between nodes are dropped.',
      ],
      keyIdea: 'Each letter is a promise. CAP asks which promises survive when the network splits.',
      scene: {
        nodes: [{ ...dbUS, tint: 'blue' }, { ...wan, status: 'ok' }, { ...dbEU, tint: 'violet' }],
        links: healthy,
        flows: [{ path: ['dbUS', 'wan', 'dbEU'], tone: 'data', label: 'copy', duration: 1.6 }],
        panel: {
          title: 'The three promises',
          icon: 'Scale',
          rows: [
            { text: 'C: reads see the latest write', value: 'one truth' },
            { text: 'A: running nodes answer', value: 'no errors' },
            { text: 'P: works while links drop', value: 'keeps going' },
          ],
          footer: { text: 'Violated: stale data (C), errors or timeouts (A), freezing (P)', tone: 'muted' },
        },
        caption: 'Three promises. Which one gives?',
      },
    },
    {
      title: 'CAP',
      tag: 'concept',
      heading: 'During a partition, pick consistency or availability',
      eli5: 'With the phone dead, Bruno asks the Frankfurt booth for the last seat. The **CAP theorem** says the booth has two choices: say "please wait" to stay safe, or sell it and maybe be wrong.',
      body: [
        'The **CAP theorem** says that while the network is split you cannot have both C and A.',
        'If Frankfurt answers Bruno, it may contradict Virginia. If it waits to hear from Virginia, it may wait forever.',
      ],
      keyIdea: 'CAP is a statement about behavior during a partition: each side must either refuse (keep C) or answer on its own (keep A).',
      metrics: { lag: 'growing', eu: '?' },
      metricTones: { lag: 'warn', eu: 'warn' },
      scene: {
        nodes: [{ ...dbUS, badge: '14C: free' }, wanDown, { ...dbEU, status: 'active', badge: 'answer or wait?' }, bruno],
        links: [link('bruno', 'dbEU'), ...cut],
        flows: [
          { path: ['bruno', 'dbEU'], tone: 'request', label: 'buy 14C', duration: 1.2 },
          { path: ['dbEU', 'wan'], tone: 'error', label: 'is 14C still free?', duration: 1.6, delay: 1.3 },
        ],
        panel: {
          title: "Frankfurt's two options",
          icon: 'Split',
          rows: [
            { text: 'Answer now', value: 'keeps A, risks C', tone: 'warn' },
            { text: 'Wait for Virginia', value: 'keeps C, loses A', tone: 'warn' },
          ],
        },
        caption: 'Answer now and risk being wrong, or wait and risk never answering',
      },
    },
    {
      title: 'Choose CP',
      tag: 'tradeoff',
      heading: 'CP: the side without a majority stops taking writes',
      eli5: '**CP** means a booth sells only when most of three voters agree. Virginia can still reach the tie-breaker in Oregon, so it sells. Frankfurt is alone, so it says "come back later."',
      body: [
        'A CP system accepts a write only when a **majority** agrees. Two replicas give neither side a majority, so a third voter is added, here a tie-breaker in Oregon.',
        'Virginia plus Oregon is 2 of 3, so Virginia keeps selling at about 70 ms per write, one Virginia to Oregon round trip. Frankfurt is cut off and returns `503`. The seat is sold exactly once.',
      ],
      keyIdea: 'CP keeps one truth by refusing to serve where it cannot be sure. Use it when a wrong answer costs more than no answer.',
      metrics: { mode: 'CP', write: '70 ms (US)', lag: 'growing', eu: 'refused (503)', conflicts: '0' },
      metricTones: { write: 'warn', eu: 'bad', conflicts: 'good' },
      scene: {
        nodes: [
          alice,
          { ...dbUS, status: 'ok', badge: '14C: Alice' },
          { ...dbEU, status: 'dim', badge: 'no quorum', chips: [{ text: '503 try later', tone: 'bad' }] },
          { ...witness, status: 'active', badge: 'votes with US' },
        ],
        links: [link('alice', 'dbUS'), link('alice', 'dbUS'), link('dbUS', 'witness'), link('dbUS', 'dbEU', { style: 'faint', label: 'partition', labelTone: 'warn' }), link('dbEU', 'witness', { style: 'faint' })],
        flows: [
          { path: ['alice', 'dbUS'], tone: 'request', label: 'buy 14C', duration: 1.2 },
          { path: ['dbUS', 'witness'], tone: 'data', label: 'vote', duration: 0.9, delay: 1.3 },
          { path: ['witness', 'dbUS'], tone: 'response', label: 'ok, 2 of 3', duration: 0.9, delay: 2.3 },
        ],
        panel: {
          title: 'Votes for write 14C',
          icon: 'Scale',
          rows: [
            { text: 'Virginia', value: 'yes', tone: 'good' },
            { text: 'Oregon', value: 'yes', tone: 'good' },
            { text: 'Frankfurt', value: 'unreachable', tone: 'bad' },
          ],
          footer: { text: '2 of 3 is a majority: commit', tone: 'good' },
        },
        caption: 'Majority side keeps writing. Minority side refuses.',
      },
    },
    {
      title: 'CP in code',
      tag: 'tradeoff',
      heading: 'Ask for a majority, or fail',
      eli5: 'The Virginia booth tells the clerk: "Write the name down only when most voters agree, and if nobody answers in five seconds, tell the customer it failed."',
      body: [
        'In MongoDB a majority write concern makes the driver wait until most replicas confirm. If they cannot within the timeout, the call throws.',
        'The default `w: 1` can lose acknowledged writes on failover. MongoDB is CP only with majority write and read concerns.',
        'Other CP examples: **ZooKeeper**, **etcd** and **Consul** refuse writes without quorum. **HBase** takes a region offline if its server is cut off.',
      ],
      keyIdea: 'In a CP system the application sees the cost as errors and timeouts, and must be ready to show them.',
      metrics: { mode: 'CP', eu: 'refused (503)' },
      metricTones: { eu: 'bad' },
      scene: {
        nodes: [{ ...dbUS, status: 'ok' }, { ...witness, status: 'ok' }, { ...dbEU, status: 'dim' }],
        links: [link('dbUS', 'witness'), link('dbUS', 'dbEU', { style: 'faint' })],
        flows: [{ path: ['dbUS', 'witness'], tone: 'data', label: 'w: majority', duration: 1.2 }],
        panel: {
          title: 'CP systems',
          icon: 'Database',
          rows: [
            { text: 'ZooKeeper, etcd, Consul', value: 'need quorum' },
            { text: 'HBase', value: 'region offline' },
            { text: 'MongoDB, majority concern', value: 'CP; PA/EC by default' },
          ],
        },
        caption: 'The write succeeds only with a majority',
      },
      code: {
        language: 'javascript',
        title: 'MongoDB: ask for a majority, or fail',
        source: `await db.collection('seats').updateOne(
  { showId: 42, seat: '14C', owner: null },     // only if still free
  { $set: { owner: 'alice' } },
  { writeConcern: { w: 'majority', wtimeoutMS: 5000 } }
);
// If a majority cannot confirm within 5 s this throws, so the app never
// reports a sale that other replicas might not have. A timeout means the
// outcome is unknown: the write may be applied and may still replicate,
// so read the seat before retrying.`,
        highlight: [4, 6, 8],
      },
    },
    {
      title: 'Choose AP',
      tag: 'tradeoff',
      heading: 'AP: both sides say yes and the copies drift apart',
      eli5: '**AP** means both booths keep selling while the phone is dead. Alice and Bruno both walk away happy, but the two charts now show different names on the same seat.',
      body: [
        'An AP system lets every reachable replica accept writes. Alice gets "booked" from Virginia. Bruno gets "booked" from Frankfurt. Nobody sees an error.',
        'The two copies now disagree about seat 14C. That is fine for a like counter and a real problem for the last seat in a concert hall.',
      ],
      keyIdea: 'AP keeps every region answering, and pays for it with copies that disagree until the partition heals.',
      metrics: { mode: 'AP', write: '5 ms', lag: 'growing', eu: 'accepted', conflicts: '1 (seat 14C)' },
      metricTones: { write: 'good', eu: 'good', conflicts: 'bad' },
      scene: {
        nodes: [alice, { ...dbUS, status: 'active', badge: '14C: Alice' }, wanDown, { ...dbEU, status: 'active', badge: '14C: Bruno' }, bruno],
        links: [link('alice', 'dbUS'), link('bruno', 'dbEU'), ...cut],
        flows: [
          { path: ['alice', 'dbUS'], tone: 'request', label: 'buy 14C', duration: 1.2 },
          { path: ['bruno', 'dbEU'], tone: 'request', label: 'buy 14C', duration: 1.2 },
          { path: ['dbUS', 'alice'], tone: 'response', label: 'booked', duration: 1.2, delay: 1.3 },
          { path: ['dbEU', 'bruno'], tone: 'response', label: 'booked', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'AP systems',
          icon: 'Database',
          rows: [
            { text: 'Dynamo (paper), Cassandra, Riak', value: 'any replica writes' },
            { text: 'CouchDB', value: 'multi-master' },
            { text: 'DNS', value: 'resolvers differ' },
          ],
          footer: { text: 'Two happy customers, one seat', tone: 'bad' },
        },
        caption: 'Two happy customers, one seat',
      },
    },
    {
      title: 'Heal',
      tag: 'case',
      heading: 'When the link returns, someone has to resolve the conflict',
      eli5: 'The phone works again and the booths read their charts to each other. Seat 14C has two names. That is a **conflict**, and a rule has to fix it: Alice bought first, so Bruno gets his money back.',
      body: [
        'Four minutes later the link is back. The replicas exchange the writes they missed and find two owners for 14C.',
        'For the seat, the honest answer is a business rule: the earlier booking wins and Bruno gets a refund and an apology. AP moves the problem out of the database and into your product.',
        'Replicas find the writes they missed through **hinted handoff**, **read repair** and background **anti-entropy** (Merkle trees).',
      ],
      keyIdea: 'AP defers conflicts to reconciliation, so you must decide up front how each kind of data merges.',
      metrics: { mode: 'AP', write: '5 ms', lag: 'catching up', eu: 'accepted', conflicts: '1 → refund' },
      metricTones: { conflicts: 'warn' },
      scene: {
        nodes: [{ ...dbUS, status: 'hot', badge: 'conflict: 14C' }, { ...wan, status: 'ok', badge: 'link back' }, { ...dbEU, status: 'hot', badge: 'conflict: 14C' }, bruno],
        links: [link('bruno', 'dbEU'), ...healthy],
        flows: [
          { path: ['dbUS', 'wan', 'dbEU'], tone: 'data', label: '4 min of writes', count: 3, duration: 1.8 },
          { path: ['dbEU', 'wan', 'dbUS'], tone: 'data', label: '4 min of writes', count: 3, duration: 1.8, delay: 0.9 },
          { path: ['dbEU', 'bruno'], tone: 'error', label: 'refund + apology', duration: 1.2, delay: 2.4 },
        ],
        panel: {
          title: 'Merge result for 14C',
          icon: 'Receipt',
          rows: [
            { text: 'Alice, first in trusted order', value: 'keeps seat', tone: 'good' },
            { text: 'Bruno, second in trusted order', value: 'refunded once', tone: 'warn' },
          ],
        },
        caption: 'Replicas swap missed writes and find the double sale',
      },
    },
    {
      title: 'Reconcile',
      tag: 'case',
      heading: 'Three ways to resolve a conflict',
      eli5: 'There are three ways to fix a double-booked seat. Keep whoever wrote last, keep both names on the chart, or follow the theater\'s rule that the earlier sale wins.',
      body: [
        '**Last writer wins** keeps the later timestamp and drops the other write. Clock skew can pick the wrong one.',
        '**Merging** keeps both sides. Dynamo\'s cart took a union, so adds never vanish, though a deleted item can return. A **CRDT** has a merge that is commutative and idempotent, so replicas converge.',
        'A **business rule** decides by domain logic, like earliest booking wins. It needs a trustworthy order, such as a version vector or a server-assigned sequence, not raw wall clocks.',
      ],
      keyIdea: 'Last writer wins is simple and loses data. Merges and business rules keep it, and cost more to write.',
      scene: {
        nodes: [{ ...dbUS, status: 'hot' }, { ...dbEU, status: 'hot' }],
        links: [link('dbUS', 'dbEU', { arrow: 'both', label: 'compare versions' })],
        flows: [{ path: ['dbUS', 'dbEU'], tone: 'data', label: 'my version', duration: 1.4 }],
        panel: {
          title: 'Conflict strategies',
          icon: 'Table',
          rows: [
            { text: 'Last writer wins', value: 'drops one write', tone: 'bad' },
            { text: 'Merge (union, CRDT)', value: 'deletes may return', tone: 'warn' },
            { text: 'Business rule', value: 'needs trusted order', tone: 'good' },
          ],
        },
        caption: 'Pick the strategy per kind of data',
      },
      code: {
        language: 'python',
        title: 'Three ways to reconcile',
        source: `# 1. Last writer wins: simple, and one write silently disappears
def lww(a, b):
    return a if a.ts >= b.ts else b

# 2. Merge: keep both sides (Dynamo's cart did a union)
def merge_cart(a: set, b: set) -> set:
    return a | b              # nothing lost, a removed item may come back

# 3. Business rule: earliest booking keeps the seat. Order by a trusted
# sequence (version vector or server-assigned), never by wall clocks.
def resolve_seat(a, b):
    winner, loser = sorted([a, b], key=lambda v: v.seq)
    return winner, loser      # pure: safe to run on every replica

# The refund lives outside the merge and is keyed by booking id,
# so two replicas resolving the same conflict refund Bruno once.
winner, loser = resolve_seat(a, b)
refund_once(loser.booking_id, reason="seat sold twice during outage")`,
        highlight: [3, 7, 12, 18],
      },
    },
    {
      title: 'Version vectors',
      tag: 'concept',
      heading: 'Detecting a conflict needs more than a timestamp',
      eli5: 'Each booth keeps a tally of how many sales it has made. Comparing tallies shows whether one booth simply missed some sales, or both sold something the other never saw.',
      body: [
        'A **version vector** keeps one counter per replica, for example `{US: 3, EU: 1}`. If one vector is at least as high everywhere, that write came later and can safely replace the other.',
        'If each has a higher counter somewhere, the writes were **concurrent**. That is a real conflict, and it goes to a merge or a rule.',
      ],
      keyIdea: 'Wall clocks cannot say whether two writes saw each other. Version vectors can.',
      scene: {
        nodes: [{ ...dbUS, badge: '{US:3, EU:1}' }, { ...dbEU, badge: '{US:2, EU:2}' }],
        links: [link('dbUS', 'dbEU', { arrow: 'both' })],
        flows: [{ path: ['dbUS', 'dbEU'], tone: 'data', label: 'compare', duration: 1.4 }],
        panel: {
          title: 'Comparing vectors',
          icon: 'Binary',
          rows: [
            { text: '{US:3, EU:1} vs {US:2, EU:1}', value: 'newer wins', tone: 'good' },
            { text: '{US:3, EU:1} vs {US:2, EU:2}', value: 'conflict', tone: 'bad' },
          ],
          footer: { text: 'Each side is ahead somewhere: concurrent', tone: 'warn' },
        },
        caption: 'Neither vector dominates, so it is a conflict',
      },
    },
    {
      title: 'Pick two?',
      tag: 'tradeoff',
      heading: 'Why "pick any two" misleads',
      eli5: 'Nobody can buy a phone line that never breaks. **Partition tolerance** means the booths already have a plan for the day it does: stop selling, or keep selling. Having no plan is not a real choice.',
      body: [
        'CAP is often drawn as a triangle where you pick two corners. That suggests a third option, **CA**: consistent and available, without partition tolerance. In a distributed system that option does not exist. Networks fail whether you planned for it or not.',
        'A database that claims CA is either one machine, or a cluster with no defined behavior when the link breaks.',
      ],
      keyIdea: 'P is not optional. The real choice is CP or AP, once a partition happens.',
      metrics: { lag: 'growing', eu: 'refuse or accept?' },
      scene: {
        nodes: [{ ...dbUS, badge: 'C or A?' }, wanDown, { ...dbEU, badge: 'C or A?' }],
        links: cut,
        flows: [
          { path: ['dbUS', 'wan'], tone: 'error', duration: 1 },
          { path: ['dbEU', 'wan'], tone: 'error', duration: 1, delay: 0.5 },
        ],
        panel: {
          title: 'The triangle, corrected',
          icon: 'Scale',
          rows: [
            { text: 'CP', value: 'refuse on split', tone: 'good' },
            { text: 'AP', value: 'diverge on split', tone: 'good' },
            { text: 'CA', value: 'single machine only', tone: 'bad' },
          ],
        },
        caption: 'You do not choose whether partitions happen. Only how to behave.',
      },
      quiz: {
        question: 'A vendor says its replicated database is "CA". What does that tell you?',
        options: [
          'It is consistent and available, even if the network splits',
          'It has not said what happens during a partition, or it is really one machine',
          'It uses quorum writes, so it never needs to choose',
          'It is an AP system with faster reads',
        ],
        answer: 1,
        explain: 'Partitions will happen in any multi-node system. Claiming CA means either the system is a single node or it has no defined, safe behavior when the network breaks.',
      },
    },
    {
      title: 'Not always',
      tag: 'concept',
      heading: 'CAP describes the bad hour, not every hour',
      eli5: 'A careful booth is not closed all day. It stops selling only while the phone is dead. A booth that sells anyway is not always wrong either. Its chart only disagrees during the outage and right after.',
      body: [
        'A CP system is not slow or down in normal operation. It refuses writes only while a partition lasts. An AP system is not always inconsistent. It diverges during the partition and the reconciliation window after.',
        'Many databases let you choose per operation, so one system can be CP for some requests and AP for others.',
      ],
      keyIdea: 'Do not use CAP to argue about everyday latency. That is a different question, and PACELC answers it.',
      scene: {
        nodes: [{ ...dbUS, status: 'ok' }, { ...wan, status: 'ok' }, { ...dbEU, status: 'ok' }],
        links: healthy,
        flows: [{ path: ['dbUS', 'wan', 'dbEU'], tone: 'data', label: 'replicate', duration: 1.6 }],
        panel: {
          title: 'When CAP applies',
          icon: 'Clock',
          rows: [
            { text: 'Normal operation', value: 'CAP is silent', tone: 'muted' },
            { text: 'During a partition', value: 'choose C or A', tone: 'warn' },
            { text: 'After the heal', value: 'reconcile', tone: 'warn' },
          ],
        },
        caption: 'Most of the time there is no partition at all',
      },
    },
    {
      title: 'PACELC',
      tag: 'concept',
      heading: 'Else: latency or consistency, on every single write',
      eli5: '**PACELC** adds the everyday question. Even when the phone works, the Virginia booth can wait for Frankfurt to say "marked!" before handing Alice her ticket. The charts always match, but every sale is slower.',
      body: [
        '**PACELC** reads: if Partitioned, choose A or C. **E**lse, choose **L**atency or **C**onsistency.',
        'To make Bruno\'s read always match Alice\'s write, Virginia waits for Frankfurt to confirm before answering. A 5 ms write becomes roughly **95 ms**, every time, with no outage anywhere.',
      ],
      keyIdea: 'The everyday price of strong consistency is latency, paid on every write. Partitions are rare. The latency bill arrives daily.',
      metrics: { mode: 'EC (sync)', write: '95 ms', lag: '0 ms', eu: 'accepted', conflicts: '0' },
      metricTones: { write: 'bad', lag: 'good', conflicts: 'good' },
      scene: {
        nodes: [alice, { ...dbUS, status: 'active', badge: 'waiting 90 ms' }, { ...wan, status: 'ok' }, { ...dbEU, status: 'ok', badge: 'ack' }],
        links: [link('alice', 'dbUS'), ...healthy],
        flows: [
          { path: ['alice', 'dbUS'], tone: 'request', label: 'write', duration: 1 },
          { path: ['dbUS', 'wan', 'dbEU'], tone: 'data', label: 'replicate', duration: 1.4, delay: 1.1 },
          { path: ['dbEU', 'wan', 'dbUS'], tone: 'response', label: 'ack', duration: 1.4, delay: 2.6 },
          { path: ['dbUS', 'alice'], tone: 'response', label: 'done, 95 ms', duration: 1, delay: 4.1 },
        ],
        panel: {
          title: 'Same write, two choices',
          icon: 'Timer',
          rows: [
            { text: 'Async (latency)', value: '5 ms', tone: 'good' },
            { text: 'Sync (consistency)', value: '95 ms', tone: 'bad' },
          ],
          footer: { text: 'No outage anywhere', tone: 'muted' },
        },
        caption: 'Synchronous replication: the answer waits for the ocean',
      },
    },
    {
      title: 'Price of sync',
      tag: 'tradeoff',
      heading: 'How much does everyday consistency cost?',
      eli5: 'Waiting for the booth next door costs a few seconds. Waiting for a booth across the ocean costs a lot more. So before saying "the charts must always match", ask how far apart the booths are.',
      body: [
        'Synchronous writes across availability zones add milliseconds to every write. Across regions they add tens of milliseconds.',
        'When someone says "we need strong consistency", ask: globally, or within a region? The two have very different prices.',
      ],
      keyIdea: 'Strong consistency has a price per write, and the price grows with distance.',
      metrics: { mode: 'EC (sync)', write: '5 to 95 ms' },
      metricTones: { write: 'warn' },
      scene: {
        nodes: [{ ...dbUS, status: 'active' }, { ...wan, status: 'ok' }, { ...dbEU, status: 'ok' }],
        links: [link('dbUS', 'wan', { arrow: 'both', label: '~90 ms round trip', labelTone: 'warn' }), link('wan', 'dbEU', { arrow: 'both' })],
        flows: [{ path: ['dbUS', 'wan', 'dbEU', 'wan', 'dbUS'], tone: 'data', label: 'sync write', duration: 2.4 }],
        panel: {
          title: 'Extra latency per write',
          icon: 'Timer',
          rows: [
            { text: 'Async, local commit', value: '+0 ms', tone: 'good' },
            { text: 'Sync, another zone', value: '+1 to 2 ms', tone: 'good' },
            { text: 'Sync, another region', value: '+90 ms', tone: 'bad' },
          ],
        },
        caption: 'Distance sets the price of agreement',
      },
    },
    {
      title: 'Real systems',
      tag: 'case',
      heading: 'Real systems get two labels, one per half',
      eli5: 'Each theater picks a rule for the broken-phone day and another for the working-phone day. Together they make a two-part label.',
      body: [
        'Dynamo and Cassandra are PA/EL: available during a partition, fast over consistent day to day. MongoDB is PA/EC by default and CP with majority concerns. BigTable and HBase are PC/EC.',
        'Yahoo\'s PNUTS is PC/EL. Spanner is PC/EC and pays with commit waits.',
      ],
      keyIdea: 'Classify a system on both halves. The two answers are independent.',
      scene: {
        nodes: [{ ...dbUS, tint: 'blue', badge: 'PA/EL' }, { ...wan, status: 'ok' }, { ...dbEU, tint: 'violet', badge: 'PC/EC' }],
        links: healthy,
        panel: {
          title: 'PACELC labels',
          icon: 'Table',
          rows: [
            { text: 'Dynamo, Cassandra', value: 'PA/EL' },
            { text: 'MongoDB', value: 'PA/EC default, CP with majority' },
            { text: 'BigTable, HBase', value: 'PC/EC' },
            { text: 'PNUTS (Yahoo)', value: 'PC/EL' },
            { text: 'Spanner', value: 'PC/EC' },
          ],
        },
        caption: 'Two letters for the split, two for the normal day',
      },
      quiz: {
        question: 'Which label means "refuse writes during a partition, and stay consistent on a normal day"?',
        options: ['PA/EL', 'PA/EC', 'PC/EC', 'PC/EL'],
        answer: 2,
        explain: 'PC says the system keeps consistency when the network splits. EC says it also keeps consistency at normal times, paying latency. BigTable, HBase and Spanner are examples.',
      },
    },
    {
      title: 'Quorums',
      tag: 'concept',
      heading: 'R + W > N makes reads see the latest write',
      eli5: 'Three booths keep the chart. If a sale must be written in two booths and a check must ask two booths, every check reaches at least one booth that saw the sale.',
      body: [
        'With **N** replicas, a write waits for **W** acks and a read asks **R**. If **R + W > N**, the sets overlap, so a read hits at least one replica with the latest write. N=3, W=2, R=2 works.',
        'A **sloppy quorum** takes writes on stand-in nodes during a partition and hands them back later (hinted handoff). It stays available and drops the overlap guarantee.',
        'A CP minority refuses reads too, unless you allow stale ones. Raft and Paxos make majority agreement safe, and a later consensus lesson covers them.',
      ],
      keyIdea: 'R + W > N guarantees overlap. Sloppy quorums trade that guarantee for availability.',
      scene: {
        nodes: [{ ...dbUS, badge: 'has the write' }, { ...witness, badge: 'has the write' }, { ...dbEU, badge: 'stale' }],
        links: [link('dbUS', 'witness'), link('dbEU', 'witness'), link('dbUS', 'dbEU')],
        flows: [
          { path: ['dbUS', 'witness'], tone: 'data', label: 'write, W=2', duration: 1.2 },
          { path: ['dbEU', 'witness'], tone: 'request', label: 'read, R=2', duration: 1.2, delay: 1.4 },
        ],
        panel: {
          title: 'Quorum arithmetic',
          icon: 'Scale',
          rows: [
            { text: 'N replicas', value: '3' },
            { text: 'W write acks', value: '2' },
            { text: 'R read acks', value: '2' },
            { text: 'R + W > N', value: '4 > 3: overlap', tone: 'good' },
          ],
        },
        caption: 'Any two of three replicas share at least one member',
      },
    },
    {
      title: 'Per query',
      tag: 'case',
      heading: 'Cassandra lets you choose per query',
      eli5: 'The booth clerk can pick a rule for each sale. Quick sticker sale: ask only the local booth. Important sale: ask every booth. The very last seat: run a strict vote.',
      body: [
        'Cassandra exposes the PACELC trade as a setting on each statement. `LOCAL_QUORUM` waits for replicas in your own region only.',
        '`EACH_QUORUM` waits for every region. A `SERIAL` insert with `IF NOT EXISTS` runs a Paxos round of about four round trips, hundreds of ms across regions, and fails rather than double-sell.',
      ],
      keyIdea: 'The latency and consistency trade can be set per operation, not once for the whole system.',
      metrics: { mode: 'per query', write: '5 / 95 / 300+ ms' },
      scene: {
        nodes: [alice, { ...dbUS, status: 'active' }, { ...wan, status: 'ok' }, dbEU],
        links: [link('alice', 'dbUS'), ...healthy],
        flows: [{ path: ['alice', 'dbUS'], tone: 'request', label: 'LOCAL_QUORUM', duration: 1.2 }],
        panel: {
          title: 'Consistency per statement',
          icon: 'Database',
          rows: [
            { text: 'LOCAL_QUORUM', value: '~5 ms', tone: 'good' },
            { text: 'EACH_QUORUM', value: '~95 ms', tone: 'warn' },
            { text: 'SERIAL', value: '~300+ ms', tone: 'bad' },
          ],
        },
        caption: 'One database, three prices',
      },
      code: {
        language: 'sql',
        title: 'Cassandra: pick the trade per query (cqlsh)',
        source: `-- EL: only replicas in my region must answer (~5 ms)
CONSISTENCY LOCAL_QUORUM;
UPDATE profiles SET bio = 'hi' WHERE user_id = 7;

-- EC: a quorum in every region must answer (~95 ms)
CONSISTENCY EACH_QUORUM;
UPDATE accounts SET plan = 'pro' WHERE user_id = 7;

-- The last seat: ~4 round trips, hundreds of ms cross-region, never double-sells
SERIAL CONSISTENCY SERIAL;
INSERT INTO seats (show_id, seat, owner) VALUES (42, '14C', 'alice') IF NOT EXISTS;`,
        highlight: [2, 6, 10, 11],
      },
    },
    {
      title: 'The ladder',
      tag: 'concept',
      heading: '"Strong consistency" is a ladder, not one thing',
      eli5: 'Linearizable: every booth always shows the latest chart. Causal: a reply never shows before its question. Read-your-writes: you see your own sale. Monotonic: a refresh never shows older news. Eventual: all match later.',
      body: [
        'Five rungs, in rough order of cost. **Linearizable**: every read sees the latest write. **Causal**: you see an effect only after its cause, such as a reply after its post. **Eventual**: if writes stop, replicas converge.',
        '**Read-your-writes** and **monotonic reads** are session guarantees. They are independent, and neither implies the other.',
      ],
      keyIdea: 'Between "strong" and "eventual" sit cheaper guarantees that cover many real needs.',
      metrics: { mode: 'ladder' },
      scene: {
        nodes: [alice, { ...dbUS, status: 'ok', badge: '14C: sold' }, { ...wan, status: 'ok' }, { ...dbEU, status: 'dim', badge: '14C: free (old)' }],
        links: [link('alice', 'dbUS'), link('alice', 'dbEU'), ...healthy],
        flows: [
          { path: ['alice', 'dbUS'], tone: 'request', label: 'read 1', duration: 1 },
          { path: ['dbUS', 'alice'], tone: 'response', label: 'sold (new)', duration: 1, delay: 1.1 },
          { path: ['alice', 'dbEU'], tone: 'request', label: 'read 2', duration: 1, delay: 2.4 },
          { path: ['dbEU', 'alice'], tone: 'error', label: 'free (old again)', duration: 1, delay: 3.5 },
        ],
        panel: {
          title: 'The five rungs',
          icon: 'Layers',
          rows: [
            { text: 'Linearizable', value: 'balances, inventory', tone: 'bad' },
            { text: 'Causal', value: 'replies, comments', tone: 'warn' },
            { text: 'Read-your-writes', value: 'profile edits', tone: 'warn' },
            { text: 'Monotonic reads', value: 'feed scrolling', tone: 'warn' },
            { text: 'Eventual', value: 'like counts, DNS', tone: 'good' },
          ],
          footer: { text: 'Rough cost order. Session guarantees are independent.', tone: 'muted' },
        },
        caption: 'One reader sees new, then old: monotonic reads is broken',
      },
    },
    {
      title: 'Cheap rungs',
      tag: 'case',
      heading: 'How the cheap rungs work',
      eli5: 'Two easy tricks. Right after Alice buys, ask the leader booth when she checks. And always send Alice to the same booth, so she never sees an older chart than before.',
      body: [
        '**Read-your-writes**: send a user\'s reads to the leader for a short window after their write, or keep the write in a session cookie. It cheaply fixes most "my edit did not show up" complaints.',
        '**Monotonic reads**: pin a user to one replica, so a refresh never lands on a replica further behind.',
      ],
      keyIdea: 'Routing a user to the right replica often buys a stronger feel without paying for global agreement.',
      scene: {
        nodes: [alice, { ...dbUS, status: 'ok', badge: 'leader' }, { ...dbEU, badge: 'behind' }],
        links: [link('alice', 'dbUS'), link('alice', 'dbUS'), link('dbUS', 'dbEU', { arrow: 'end' })],
        flows: [
          { path: ['alice', 'dbUS'], tone: 'request', label: 'read, right after write', duration: 1.4 },
          { path: ['dbUS', 'alice'], tone: 'response', label: 'fresh', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Cheap tricks',
          icon: 'Route',
          rows: [
            { text: 'Read-your-writes', value: 'leader for a short window' },
            { text: 'Monotonic reads', value: 'sticky replica' },
          ],
        },
        caption: 'Route the reader, skip the global wait',
      },
      quiz: {
        question: 'A user edits their profile and the page, loaded from a lagging replica, shows the old text. Which cheap guarantee fixes it?',
        options: ['Linearizable reads on every request', 'Read-your-writes', 'Eventual consistency', 'Version vectors'],
        answer: 1,
        explain: 'Read-your-writes only promises that a user sees their own writes. Routing their reads to the leader for a short window after the edit is much cheaper than making every read linearizable.',
      },
    },
    {
      title: 'Per feature',
      tag: 'case',
      heading: 'Choose per feature',
      eli5: 'The booths use different rules for different things. Seats need **consistency**, so one booth decides every sale. Thumbs-up stickers stay local and quick. A small mix-up hurts nobody.',
      body: [
        'Seat inventory and payments are **CP**: a "try again" beats selling a seat twice. Likes, reviews and the activity feed are **AP**: users leave over errors, and nobody notices a counter that is a second behind.',
        'Chat history is AP. Feature flags and config are CP on write and AP on read.',
        'Default to the weakest consistency a feature can live with. Strong costs roughly 20x here (5 ms vs 95 ms) and is more fragile under partition.',
      ],
      keyIdea: 'Consistency is a per-operation budget. Default to weak and pay for strong only where a wrong answer costs money.',
      metrics: { mode: 'mixed', write: 'like 5 ms, seat 70 ms', lag: '~100 ms', eu: 'accepted', conflicts: '0' },
      scene: {
        nodes: [bruno, { ...dbEU, status: 'active', badge: 'likes: local' }, { ...wan, status: 'active' }, { ...dbUS, badge: 'seat leader' }],
        links: [link('bruno', 'dbEU'), ...healthy],
        flows: [
          { path: ['bruno', 'dbEU'], tone: 'request', label: 'like (AP)', duration: 1.2 },
          { path: ['dbEU', 'wan', 'dbUS'], tone: 'request', label: 'book seat (CP)', duration: 2, delay: 1.4 },
        ],
        panel: {
          title: 'Pick by product',
          icon: 'Table',
          rows: [
            { text: 'Banking, ledger', value: 'CP', tone: 'good' },
            { text: 'Seat booking', value: 'CP', tone: 'good' },
            { text: 'Social feed, chat history', value: 'AP', tone: 'warn' },
            { text: 'Shopping cart', value: 'AP + merge', tone: 'warn' },
            { text: 'Feature flags', value: 'CP write, AP read' },
          ],
        },
        caption: 'Likes stay local. Seat bookings go to one place.',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Two questions to ask about any replicated data',
      eli5: 'Two booths, two seat charts, one phone. When the phone breaks, a booth must stop selling or risk a double sale. When it works, a booth can wait for the other chart or answer fast. Those two questions are **PACELC**.',
      body: [
        'During a partition, a replica that cannot reach the others must **refuse** (CP: one truth, some errors) or **accept** (AP: no errors, conflicts to resolve later).',
        'The rest of the time, every write chooses **latency** or **consistency**. That is PACELC, and it is the trade you pay most often.',
      ],
      keyIdea: 'Ask two questions for each piece of data: what happens during a partition, and how much latency is consistency worth on a normal day.',
      metrics: { mode: 'per feature', write: '5 to 95 ms', lag: '~100 ms', eu: 'accepted', conflicts: '0' },
      metricTones: { conflicts: 'good' },
      scene: {
        nodes: [alice, { ...dbUS, status: 'ok' }, { ...wan, status: 'ok' }, { ...dbEU, status: 'ok' }, bruno],
        links: [link('alice', 'dbUS'), link('bruno', 'dbEU'), ...healthy],
        flows: [
          { path: ['alice', 'dbUS'], tone: 'request', duration: 1.2 },
          { path: ['bruno', 'dbEU'], tone: 'request', duration: 1.2, delay: 0.4 },
          { path: ['dbUS', 'wan', 'dbEU'], tone: 'data', duration: 1.6, delay: 1.3 },
        ],
        panel: {
          title: 'The two questions',
          icon: 'Split',
          rows: [
            { text: 'If partitioned', value: 'refuse or accept' },
            { text: 'Else, normally', value: 'latency or consistency' },
          ],
        },
      },
      quiz: {
        question: 'There is no partition. Your team makes every write wait for replicas in all three regions. What will users notice first?',
        options: [
          'Nothing, because the network is healthy',
          'Errors on every write',
          'Every write gets slower by roughly the cross-region round trip',
          'Reads start returning stale data',
        ],
        answer: 2,
        explain: 'That is the E in PACELC. With no partition, choosing consistency means waiting for far replicas, so each write pays tens of milliseconds of extra latency.',
      },
    },
  ],
};
