import type { Lesson, SceneNode, SceneZone } from '../engine/types';

const userUS: SceneNode = { id: 'userUS', kind: 'user', at: [-5, 4], label: 'Alice', sub: 'New York' };
const apiUS: SceneNode = { id: 'apiUS', kind: 'server', at: [-2.5, 4], label: 'API', sub: 'us-east-1' };
const dbUS: SceneNode = { id: 'dbUS', kind: 'db', at: [-0.8, 1.8], label: 'replica US' };
const wan: SceneNode = { id: 'wan', kind: 'internet', at: [0.5, 0.5], label: 'Atlantic link', sub: '~90 ms RTT' };
const dbEU: SceneNode = { id: 'dbEU', kind: 'db', at: [1.8, -0.8], label: 'replica EU' };
const apiEU: SceneNode = { id: 'apiEU', kind: 'server', at: [4, -2.5], label: 'API', sub: 'eu-central-1' };
const userEU: SceneNode = { id: 'userEU', kind: 'user', at: [4, -5], label: 'Bruno', sub: 'Berlin' };
const witness: SceneNode = { id: 'witness', kind: 'service', at: [3.4, 3.4], label: 'tie-breaker', sub: 'third voter' };

const zones: SceneZone[] = [
  { id: 'us', from: [-6.2, 0.8], to: [0.2, 5.4], label: 'Virginia', tone: 'blue' },
  { id: 'eu', from: [0.8, -6.2], to: [5.4, 0.2], label: 'Frankfurt', tone: 'violet' },
];
const oregon: SceneZone = { id: 'or', from: [2.1, 2.1], to: [3.9, 3.9], label: 'Oregon', tone: 'gray' };

const regionLinks = [
  { from: 'userUS', to: 'apiUS' },
  { from: 'apiUS', to: 'dbUS' },
  { from: 'userEU', to: 'apiEU' },
  { from: 'apiEU', to: 'dbEU' },
];
const healthy = [...regionLinks, { from: 'dbUS', to: 'wan' }, { from: 'wan', to: 'dbEU' }];
const cut = [
  ...regionLinks,
  { from: 'dbUS', to: 'wan', style: 'faint' as const, label: 'partition' },
  { from: 'wan', to: 'dbEU', style: 'faint' as const },
];
const partitioned = { ...wan, status: 'down' as const, badge: 'partition' };

export const capPacelc: Lesson = {
  id: 'cap-pacelc',
  title: 'CAP and PACELC',
  tagline: 'When the network splits, refuse or diverge. When it does not, pay in latency or in staleness.',
  minutes: 12,
  level: 'Intermediate',
  learn: [
    'What a network partition is and why you cannot rule it out',
    'The CAP choice: refuse writes (CP) or accept them and diverge (AP)',
    'Which real systems sit on each side, and how conflicts get resolved',
    'Why "pick 2 of 3" is a misleading way to say it',
    'PACELC: the latency vs consistency trade you pay every day',
  ],
  metrics: [
    { key: 'mode', label: 'Mode' },
    { key: 'write', label: 'Write latency' },
    { key: 'lag', label: 'Replica lag' },
    { key: 'eu', label: 'Frankfurt writes' },
    { key: 'conflicts', label: 'Conflicts' },
  ],
  steps: [
    {
      title: 'Last seat',
      tag: 'problem',
      heading: 'The link between regions just went dark',
      eli5: 'A movie theater has two ticket booths with a phone between them. Each booth has its own copy of the seat chart, a **replica**. The phone goes dead just as Alice and Bruno each ask a different booth for the last seat.',
      body: [
        'A ticketing app runs in Virginia and Frankfurt. Each region has a full copy of the seat map, and writes are copied across the Atlantic in about 100 ms.',
        'Tickets go on sale at 20:00. At 20:01 the link between the regions drops. Both regions are healthy and both are full of buyers. Alice in New York and Bruno in Berlin each click "buy" on seat **14C**, the last one, and each region still sees it as free.',
        'Should Frankfurt sell the seat? If it does, the seat may be sold twice. If it does not, Bruno gets an error from a server that is up and running.',
      ],
      keyIdea: 'Once data lives in more than one place, a broken link forces a choice between answering now and answering correctly.',
      metrics: { lag: 'growing', eu: '?', conflicts: '?' },
      scene: {
        zones,
        nodes: [
          userUS,
          { ...apiUS, status: 'active' },
          { ...dbUS, badge: '14C: free' },
          partitioned,
          { ...dbEU, badge: '14C: free' },
          { ...apiEU, status: 'active' },
          userEU,
        ],
        links: cut,
        flows: [
          { path: ['userUS', 'apiUS', 'dbUS'], tone: 'request', label: 'buy 14C', duration: 1.6 },
          { path: ['userEU', 'apiEU', 'dbEU'], tone: 'request', label: 'buy 14C', duration: 1.6 },
          { path: ['dbUS', 'wan'], tone: 'error', label: 'no reply', duration: 1, delay: 1.8 },
          { path: ['dbEU', 'wan'], tone: 'error', label: 'no reply', duration: 1, delay: 1.8 },
        ],
        caption: 'Both regions are up. They just cannot talk.',
      },
    },
    {
      title: 'Replication',
      tag: 'concept',
      heading: 'On a normal day, writes cross the ocean in the background',
      eli5: 'On a normal day, the Virginia booth sells Alice her seat right away, then phones the Frankfurt booth so it can mark its chart too. Selling first and calling after is **asynchronous replication**.',
      body: [
        'Alice\'s write commits on the Virginia replica in about 5 ms and she gets her answer. The change is then shipped to Frankfurt in the background. This is **asynchronous replication**.',
        'One-way travel across the Atlantic takes about 45 ms, so Frankfurt usually catches up within 100 ms. For that short window a reader in Berlin could see the old value. Most of the time nobody notices.',
      ],
      keyIdea: 'Replicas agree only after messages arrive. Everything in this lesson is about what to do when they arrive late or not at all.',
      metrics: { mode: 'normal', write: '5 ms', lag: '~100 ms', eu: 'accepted', conflicts: '0' },
      scene: {
        zones,
        nodes: [userUS, apiUS, { ...dbUS, status: 'active', badge: '14C → Alice' }, wan, { ...dbEU, badge: 'catching up' }, apiEU, userEU],
        links: healthy,
        flows: [
          { path: ['userUS', 'apiUS', 'dbUS'], tone: 'request', label: 'buy 14C', duration: 1.4 },
          { path: ['dbUS', 'apiUS', 'userUS'], tone: 'response', label: 'booked', duration: 1.4, delay: 1.5 },
          { path: ['dbUS', 'wan', 'dbEU'], tone: 'data', label: 'replicate', duration: 1.6, delay: 1.5 },
        ],
        caption: 'Commit locally, copy to the other region afterward',
      },
    },
    {
      title: 'Partition',
      tag: 'concept',
      heading: 'A partition looks exactly like silence',
      eli5: 'A **network partition** is when the phone between the booths stops working. Each booth hears only silence, and cannot tell if the other booth closed or if the phone line is broken.',
      body: [
        'A **network partition** means the nodes are running but messages between them are lost or delayed. A cut cable, a bad route, an overloaded link or a long GC pause all produce it.',
        'Virginia sends a replication message and hears nothing back. It cannot tell whether Frankfurt crashed, is slow, or is busy serving its own users. All it has is a timeout.',
        'Partitions are rare per link, but a system with many links and many machines sees them every week somewhere.',
      ],
      keyIdea: 'From inside a node, "the other side is dead" and "the other side is unreachable" look the same. You have to decide without knowing which.',
      metrics: { lag: 'growing' },
      scene: {
        zones,
        nodes: [userUS, apiUS, { ...dbUS, badge: 'timeout' }, partitioned, { ...dbEU, badge: 'timeout' }, apiEU, userEU],
        links: cut,
        flows: [
          { path: ['dbUS', 'wan'], tone: 'error', label: 'replicate?', count: 3, duration: 1 },
          { path: ['dbEU', 'wan'], tone: 'error', label: 'replicate?', count: 3, duration: 1, delay: 0.5 },
        ],
        caption: 'Messages leave, nothing comes back',
      },
    },
    {
      title: 'CAP',
      tag: 'concept',
      heading: 'During a partition, pick consistency or availability',
      eli5: 'With the phone dead, Bruno asks the Frankfurt booth for the last seat. The **CAP theorem** says the booth has two choices: say "sorry, please wait" to stay safe, or sell it and maybe be wrong.',
      body: [
        '**C**onsistency: every read sees the latest successful write, as if there were one copy. **A**vailability: every request to a running node gets a non-error answer. **P**artition tolerance: the system keeps operating while messages between nodes are dropped.',
        'The **CAP theorem** says that while the network is split you cannot have both C and A. If Frankfurt answers Bruno, it may contradict Virginia. If it waits to hear from Virginia, it may wait forever.',
      ],
      keyIdea: 'CAP is a statement about behavior during a partition: each side must either refuse (keep C) or answer on its own (keep A).',
      metrics: { lag: 'growing', eu: '?' },
      scene: {
        zones,
        nodes: [userUS, apiUS, dbUS, partitioned, dbEU, { ...apiEU, status: 'active', badge: 'answer or wait?' }, userEU],
        links: cut,
        flows: [
          { path: ['userEU', 'apiEU'], tone: 'request', label: 'buy 14C', duration: 1.2 },
          { path: ['apiEU', 'dbEU', 'wan'], tone: 'error', label: 'is 14C still free?', duration: 1.6, delay: 1.3 },
        ],
        caption: 'Answer now and risk being wrong, or wait and risk never answering',
      },
    },
    {
      title: 'Choose CP',
      tag: 'tradeoff',
      heading: 'CP: the side without a majority stops taking writes',
      eli5: '**CP** means a booth sells only when most of the three voters agree. The Virginia booth can still call the tie-breaker in Oregon, so it sells. The Frankfurt booth is alone, so it says "come back later."',
      body: [
        'A CP system only accepts a write when a **majority** of voters agree. With two replicas neither side has a majority, so real setups add a third voter, here a tie-breaker in Oregon. Virginia plus Oregon is 2 of 3, so Virginia keeps selling, and each of its writes waits about 70 ms for Oregon\'s vote. Frankfurt is cut off from both and returns `503`.',
        'The seat is sold exactly once. The cost is that every European buyer sees errors until the link heals.',
        'CP examples: **ZooKeeper**, **etcd** and **Consul** refuse writes without quorum. **HBase** takes a region offline if its server is cut off. **MongoDB** with majority writes makes the minority side read-only.',
      ],
      keyIdea: 'CP keeps one truth by refusing to serve where it cannot be sure. Use it when a wrong answer costs more than no answer.',
      metrics: { mode: 'CP', write: '70 ms (US)', lag: 'growing', eu: 'refused (503)', conflicts: '0' },
      scene: {
        zones: [...zones, oregon],
        nodes: [
          userUS,
          apiUS,
          { ...dbUS, status: 'ok', badge: '14C → Alice' },
          partitioned,
          { ...dbEU, status: 'dim', badge: 'no quorum' },
          { ...apiEU, status: 'hot', badge: '503' },
          userEU,
          { ...witness, status: 'active', badge: 'votes with US' },
        ],
        links: [...cut, { from: 'dbUS', to: 'witness' }, { from: 'dbEU', to: 'witness', style: 'faint' }],
        flows: [
          { path: ['userUS', 'apiUS', 'dbUS'], tone: 'request', label: 'buy 14C', duration: 1.4 },
          { path: ['dbUS', 'witness'], tone: 'data', label: 'vote', duration: 0.9, delay: 1.5 },
          { path: ['witness', 'dbUS'], tone: 'response', label: 'ok, 2 of 3', duration: 0.9, delay: 2.5 },
          { path: ['userEU', 'apiEU'], tone: 'request', label: 'buy 14C', duration: 1 },
          { path: ['apiEU', 'userEU'], tone: 'error', label: '503 try later', duration: 1, delay: 1.1 },
        ],
        caption: 'Majority side keeps writing. Minority side refuses.',
      },
      code: {
        language: 'javascript',
        title: 'MongoDB: ask for a majority, or fail',
        source: `await db.collection('seats').updateOne(
  { showId: 42, seat: '14C', owner: null },     // only if still free
  { $set: { owner: 'alice' } },
  { writeConcern: { w: 'majority', wtimeout: 5000 } }
);
// If a majority cannot confirm within 5 s this throws, so the app
// never reports a sale that the other replicas might not have.`,
        highlight: [4, 6, 7],
      },
    },
    {
      title: 'Choose AP',
      tag: 'tradeoff',
      heading: 'AP: both sides say yes and the copies drift apart',
      eli5: '**AP** means both booths keep selling while the phone is dead. Alice and Bruno both walk away happy, but the two seat charts now show different names on the same seat.',
      body: [
        'An AP system lets every reachable replica accept writes. Alice gets "booked" from Virginia. Bruno gets "booked" from Frankfurt. Nobody sees an error.',
        'The two copies now disagree about seat 14C. That is fine for a like counter or a feed, and a real problem for the last seat in a concert hall.',
        'AP examples: **Cassandra**, **DynamoDB** and **Riak** accept writes on any reachable replica and reconcile later. **CouchDB** is multi-master. **DNS** is the classic case: resolvers can disagree for minutes and the internet keeps working.',
      ],
      keyIdea: 'AP keeps every region answering, and pays for it with copies that disagree until the partition heals.',
      metrics: { mode: 'AP', write: '5 ms', lag: 'growing', eu: 'accepted', conflicts: '1 (seat 14C)' },
      scene: {
        zones,
        nodes: [
          userUS,
          apiUS,
          { ...dbUS, status: 'active', badge: '14C → Alice' },
          partitioned,
          { ...dbEU, status: 'active', badge: '14C → Bruno' },
          apiEU,
          userEU,
        ],
        links: cut,
        flows: [
          { path: ['userUS', 'apiUS', 'dbUS'], tone: 'request', label: 'buy 14C', duration: 1.4 },
          { path: ['userEU', 'apiEU', 'dbEU'], tone: 'request', label: 'buy 14C', duration: 1.4 },
          { path: ['dbUS', 'apiUS', 'userUS'], tone: 'response', label: 'booked', duration: 1.4, delay: 1.5 },
          { path: ['dbEU', 'apiEU', 'userEU'], tone: 'response', label: 'booked', duration: 1.4, delay: 1.5 },
        ],
        caption: 'Two happy customers, one seat',
      },
    },
    {
      title: 'Heal',
      tag: 'case',
      heading: 'When the link returns, someone has to resolve the conflict',
      eli5: 'The phone works again and the booths read their charts to each other. Seat 14C has two names! That is a **conflict**, and a rule has to fix it: Alice bought first, so Bruno gets his money back.',
      body: [
        'Four minutes later the link is back. The replicas exchange the writes they missed and find two owners for 14C.',
        '**Last writer wins** keeps the later timestamp and silently drops the other sale, and clock skew can pick the wrong one. **Merging** keeps both and lets the application decide. Amazon\'s Dynamo cart took the union of both carts, so an item is never lost, though a deleted one can reappear.',
        'For the seat, the only honest merge is a business rule: the earlier booking wins and Bruno gets a refund and an apology. AP moves the problem out of the database and into your product.',
      ],
      keyIdea: 'AP defers conflicts to reconciliation, so you must decide up front how each kind of data merges.',
      metrics: { mode: 'AP', write: '5 ms', lag: 'catching up', eu: 'accepted', conflicts: '1 → refund' },
      scene: {
        zones,
        nodes: [
          userUS,
          apiUS,
          { ...dbUS, status: 'hot', badge: 'conflict: 14C' },
          { ...wan, status: 'ok', badge: 'link back' },
          { ...dbEU, status: 'hot', badge: 'conflict: 14C' },
          apiEU,
          userEU,
        ],
        links: healthy,
        flows: [
          { path: ['dbUS', 'wan', 'dbEU'], tone: 'data', label: '4 min of writes', count: 3, duration: 1.8 },
          { path: ['dbEU', 'wan', 'dbUS'], tone: 'data', label: '4 min of writes', count: 3, duration: 1.8, delay: 0.9 },
          { path: ['apiEU', 'userEU'], tone: 'error', label: 'refund + apology', duration: 1.2, delay: 2.4 },
        ],
        caption: 'Replicas swap missed writes and find the double sale',
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

# 3. Business rule: earliest booking keeps the seat, the other is refunded
def resolve_seat(a, b):
    winner, loser = sorted([a, b], key=lambda v: v.ts)
    refund(loser.customer, reason="seat sold twice during outage")
    return winner`,
        highlight: [3, 7, 11, 12],
      },
    },
    {
      title: 'Pick two?',
      tag: 'tradeoff',
      heading: 'Why "pick any two" misleads',
      eli5: 'Nobody can buy a phone line that never breaks. **Partition tolerance** means the booths already have a plan for that day: stop selling, or keep selling. Having no plan is not a real choice.',
      body: [
        'CAP is often drawn as a triangle where you pick two corners. That suggests a third option, **CA**: consistent and available, without partition tolerance. In a distributed system that option does not exist. Networks fail whether you planned for it or not.',
        'A database that claims CA is either a single machine, or a cluster with no defined behavior when the link breaks. The real choice is narrower: when a partition happens, CP or AP.',
        'It is also less global than the triangle implies. A CP system is not unavailable the rest of the time, and an AP system is not always inconsistent. Many databases let you choose per operation.',
      ],
      keyIdea: 'P is not optional. CAP only asks what you give up while the network is split, and you can answer differently for different data.',
      metrics: { lag: 'growing', eu: 'refuse or accept?' },
      scene: {
        zones,
        nodes: [userUS, { ...apiUS, badge: 'C or A?' }, dbUS, partitioned, dbEU, { ...apiEU, badge: 'C or A?' }, userEU],
        links: cut,
        flows: [
          { path: ['dbUS', 'wan'], tone: 'error', duration: 1 },
          { path: ['dbEU', 'wan'], tone: 'error', duration: 1, delay: 0.5 },
        ],
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
      title: 'PACELC',
      tag: 'concept',
      heading: 'Else: latency or consistency, on every single write',
      eli5: '**PACELC** adds the everyday question. Even when the phone works, the Virginia booth can wait for Frankfurt to say "marked!" before handing Alice her ticket. The charts always match, but every sale is slower.',
      body: [
        'CAP says nothing about the normal case, which is almost all of the time. **PACELC** fills the gap: if Partitioned, choose A or C. **E**lse, choose **L**atency or **C**onsistency.',
        'To make Bruno\'s read always match Alice\'s write, Virginia must wait for Frankfurt to confirm before answering. That turns a 5 ms write into roughly **95 ms**, every time, with no outage anywhere.',
        'Dynamo and Cassandra are PA/EL. MongoDB by default is PA/EC. BigTable and HBase are PC/EC. Yahoo\'s PNUTS is PC/EL. Spanner is PC/EC and pays with commit waits.',
      ],
      keyIdea: 'The everyday price of strong consistency is latency, paid on every write. Partitions are rare. The latency bill arrives daily.',
      metrics: { mode: 'EC (sync)', write: '95 ms', lag: '0 ms', eu: 'accepted', conflicts: '0' },
      scene: {
        zones,
        nodes: [userUS, apiUS, { ...dbUS, status: 'active', badge: 'waiting 90 ms' }, { ...wan, status: 'ok' }, { ...dbEU, status: 'ok', badge: 'ack' }, apiEU, userEU],
        links: healthy,
        flows: [
          { path: ['userUS', 'apiUS', 'dbUS'], tone: 'request', label: 'write', duration: 1.2 },
          { path: ['dbUS', 'wan', 'dbEU'], tone: 'data', label: 'replicate', duration: 1.6, delay: 1.3 },
          { path: ['dbEU', 'wan', 'dbUS'], tone: 'response', label: 'ack', duration: 1.6, delay: 3 },
          { path: ['dbUS', 'apiUS', 'userUS'], tone: 'response', label: 'done, 95 ms', duration: 1.2, delay: 4.7 },
        ],
        caption: 'Synchronous replication: the answer waits for the ocean',
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

-- The last seat: a Paxos round that fails rather than double-sell
SERIAL CONSISTENCY SERIAL;
INSERT INTO seats (show_id, seat, owner) VALUES (42, '14C', 'alice') IF NOT EXISTS;`,
        highlight: [2, 6, 10, 11],
      },
    },
    {
      title: 'Per feature',
      tag: 'case',
      heading: 'Choose per feature',
      eli5: 'The booths use different rules for different things. Seats need **consistency**, so one booth, the seat leader, decides every sale. Thumbs-up stickers for movies stay local and quick, and a small mix-up hurts nobody.',
      body: [
        'The ticketing app needs both answers. Seat inventory and payments are **CP**: a "try again" beats selling a seat twice. Likes, reviews and the activity feed are **AP**: users leave over errors, and nobody notices a counter that is a second behind.',
        'Feature flags and config are often CP on write and AP on read: writes are rare and must be right, reads can be a few seconds stale.',
        'A good default is the weakest consistency the feature can live with. Spend on strong consistency where wrong answers cost money, such as balances, inventory and identity, and confine it to those operations.',
      ],
      keyIdea: 'Consistency is a per-operation budget. Pay for it where errors cost money and skip it everywhere else.',
      metrics: { mode: 'mixed', write: 'like 5 ms, seat 95 ms', lag: '~100 ms', eu: 'accepted', conflicts: '0' },
      scene: {
        zones,
        nodes: [userUS, apiUS, { ...dbUS, badge: 'seat leader' }, { ...wan, status: 'active' }, { ...dbEU, badge: 'likes: local' }, { ...apiEU, status: 'active' }, userEU],
        links: healthy,
        flows: [
          { path: ['userEU', 'apiEU', 'dbEU'], tone: 'request', label: 'like post (AP)', duration: 1.4 },
          { path: ['dbEU', 'apiEU', 'userEU'], tone: 'response', label: '5 ms', duration: 1.2, delay: 1.5 },
          { path: ['apiEU', 'dbEU', 'wan', 'dbUS'], tone: 'request', label: 'book seat (CP)', duration: 2.2, delay: 2.8 },
          { path: ['dbUS', 'wan', 'dbEU', 'apiEU'], tone: 'response', label: 'confirmed', duration: 2.2, delay: 5.1 },
        ],
        caption: 'Likes stay local. Seat bookings go to one place.',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Two questions to ask about any replicated data',
      eli5: 'Two booths, two seat charts, one phone. When the phone breaks, a booth must stop selling or risk a double sale. When it works, a booth can wait for the other chart or answer fast. Those two questions are **PACELC**.',
      body: [
        'During a partition, a replica that cannot reach the others must **refuse** (CP: one truth, some errors) or **accept** (AP: no errors, conflicts to resolve later). Partition tolerance is not a choice you get to skip.',
        'The rest of the time, every write still chooses **latency** or **consistency**: answer after the local commit, or wait for the far replicas. That is PACELC, and it is the trade you pay most often.',
      ],
      keyIdea: 'Ask two questions for each piece of data: what happens during a partition, and how much latency is consistency worth on a normal day.',
      metrics: { mode: 'per feature', write: '5 to 95 ms', lag: '~100 ms', eu: 'accepted', conflicts: '0' },
      scene: {
        zones,
        nodes: [userUS, apiUS, { ...dbUS, status: 'ok' }, { ...wan, status: 'ok' }, { ...dbEU, status: 'ok' }, apiEU, userEU],
        links: healthy,
        flows: [
          { path: ['userUS', 'apiUS', 'dbUS'], tone: 'request', duration: 1.2 },
          { path: ['userEU', 'apiEU', 'dbEU'], tone: 'request', duration: 1.2, delay: 0.4 },
          { path: ['dbUS', 'wan', 'dbEU'], tone: 'data', duration: 1.6, delay: 1.3 },
        ],
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
