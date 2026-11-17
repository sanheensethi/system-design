import type { Lesson, SceneNode } from '../engine/types';

const ana: SceneNode = { id: 'ana', kind: 'phone', at: [-4.5, 1.5], label: 'Ana', sub: 'writes' };
const leader: SceneNode = { id: 'leader', kind: 'db', at: [-1.5, -1.5], label: 'leader', sub: 'takes writes' };
const repA: SceneNode = { id: 'repA', kind: 'replica', at: [1, 2], label: 'replica A', sub: 'caught up' };
const repB: SceneNode = { id: 'repB', kind: 'replica', at: [2.5, -2.5], label: 'replica B', sub: '2 s behind' };
const ben: SceneNode = { id: 'ben', kind: 'phone', at: [4, 4.5], label: 'Ben', sub: 'reads' };
const cara: SceneNode = { id: 'cara', kind: 'phone', at: [5.5, -0.5], label: 'Cara', sub: 'reads' };

const links = [
  { from: 'ana', to: 'leader' },
  { from: 'leader', to: 'repA', style: 'dashed' as const },
  { from: 'leader', to: 'repB', style: 'dashed' as const },
  { from: 'ben', to: 'repA' },
  { from: 'cara', to: 'repB' },
];

export const consistencyModels: Lesson = {
  id: 'consistency-models',
  title: 'Consistency models',
  tagline: 'The ladder between "strong" and "eventual": what each rung promises, which anomaly it removes, and what it costs.',
  minutes: 15,
  level: 'Advanced',
  learn: [
    'Eventual consistency and the anomalies it allows',
    'Session guarantees: read-your-writes and monotonic reads',
    'Causal consistency: effects never appear before their causes',
    'Sequential versus linearizable, and why real time matters',
    'What Postgres, DynamoDB, Cassandra, MongoDB and etcd actually offer',
  ],
  metrics: [
    { key: 'model', label: 'Guarantee' },
    { key: 'anomaly', label: 'Still possible' },
    { key: 'latency', label: 'Read latency' },
    { key: 'avail', label: 'Reads in a partition' },
  ],
  steps: [
    {
      title: 'Vanishing post',
      tag: 'problem',
      heading: 'Ben saw the message, refreshed, and it was gone',
      eli5: 'The school has a main noticeboard and copies in two hallways. A runner carries each new notice to the copies. Ben read a notice in one hallway, walked to the other, and it was not there yet.',
      body: [
        'Ana posts "Practice moved to 6 pm" in a group chat. The post lands on the leader and replicates asynchronously to two replicas. Replica A has it within 20 ms. Replica B is 2 seconds behind.',
        'Ben reads from replica A and sees the post. His refresh is load balanced to replica B, and the post disappears. Cara, reading from B, sees nothing at all. Three people, three versions of the chat, and every replica is working as designed.',
        'The replication lesson ended with "every copy is a little behind". A **consistency model** is the contract that says how far behind, and which strange orders of events a reader is allowed to see.',
      ],
      keyIdea: 'Replicas disagree for a while. A consistency model states which disagreements a client can observe.',
      metrics: { model: 'none stated', anomaly: 'anything', latency: '2 ms local', avail: 'yes' },
      scene: {
        nodes: [ana, { ...leader, status: 'active', badge: 'has post' }, { ...repA, status: 'ok', badge: 'has post' }, { ...repB, status: 'hot', badge: 'no post yet' }, { ...ben, status: 'hot', badge: 'saw it, then lost it' }, cara],
        links: [...links, { from: 'ben', to: 'repB', style: 'faint' }],
        flows: [
          { path: ['ana', 'leader'], tone: 'request', label: 'post', duration: 1 },
          { path: ['leader', 'repA'], tone: 'data', duration: 0.8, delay: 1.1 },
          { path: ['leader', 'repB'], tone: 'data', duration: 3.6, delay: 1.1 },
          { path: ['repA', 'ben'], tone: 'response', label: 'post', duration: 0.9, delay: 2 },
          { path: ['repB', 'ben'], tone: 'error', label: 'no post', duration: 0.9, delay: 3.2 },
        ],
        caption: 'One refresh, a different replica, an older world',
      },
    },
    {
      title: 'Eventual',
      tag: 'concept',
      heading: 'Eventual consistency: they agree, someday',
      eli5: 'The runner promises that every hallway board will show the notice in the end. Until then, any board might be old, and two boards might show different things.',
      body: [
        '**Eventual consistency** promises one thing: if writes stop, all replicas converge to the same value. It says nothing about how long that takes or what readers see before it happens.',
        'Every anomaly from step 1 is allowed. A read can return stale data. Two readers can disagree. One reader can see a value and then an older one. A reader can see a reply before the message it answers.',
        'It is the bottom rung because it costs the least. Any replica can answer from its own disk in a couple of milliseconds, and reads keep working through a network partition. Counters, view counts and recommendation lists live here happily.',
      ],
      keyIdea: 'Eventual consistency only promises convergence. Every in-between state is fair game.',
      metrics: { model: 'eventual', anomaly: 'stale, backwards, out of order', latency: '2 ms local', avail: 'yes' },
      scene: {
        nodes: [ana, leader, { ...repA, badge: 'v2' }, { ...repB, badge: 'v1, converging' }, { ...ben, badge: 'sees v2' }, { ...cara, badge: 'sees v1' }],
        links,
        flows: [
          { path: ['leader', 'repA'], tone: 'data', duration: 0.8 },
          { path: ['leader', 'repB'], tone: 'data', duration: 3.2 },
          { path: ['repA', 'ben'], tone: 'response', label: 'v2', duration: 0.9, delay: 1 },
          { path: ['repB', 'cara'], tone: 'response', label: 'v1', duration: 0.9, delay: 1 },
        ],
        caption: 'Both answers are legal',
      },
    },
    {
      title: 'Your writes',
      tag: 'concept',
      heading: 'Read-your-writes: you always see your own changes',
      eli5: 'After Ana pins a notice, she is told to check the main board for a minute. She always sees her own notice, even if the hallway copies are still old.',
      body: [
        '**Read-your-writes** removes one anomaly: after you write, your own later reads include that write. Other users may still see old data.',
        'The common implementations route by session. Send a user\'s reads to the leader for a few seconds after they write. Or attach the log position (LSN) of their last write to their session and only read from a replica that has replayed past it.',
        'It is a **session guarantee**. It holds per client, not across clients. If Ana writes on her phone and reads on her laptop, the guarantee holds only if both share the session token.',
      ],
      keyIdea: 'Read-your-writes protects a user from their own vanishing edits. Everyone else can still be behind.',
      metrics: { model: 'read-your-writes', anomaly: 'others see stale', latency: '2 ms, leader after writes', avail: 'mostly' },
      scene: {
        nodes: [{ ...ana, status: 'ok', badge: 'sees own post' }, { ...leader, status: 'active', badge: 'LSN 7,402' }, repA, { ...repB, badge: 'replayed 7,380' }, ben, { ...cara, status: 'dim' }],
        links: [...links, { from: 'ana', to: 'repB', style: 'faint' }],
        flows: [
          { path: ['ana', 'leader'], tone: 'request', label: 'post (LSN 7,402)', duration: 1 },
          { path: ['ana', 'repB'], tone: 'request', label: 'read, need 7,402', duration: 1.2, delay: 1.2 },
          { path: ['repB', 'ana'], tone: 'error', label: 'too old', duration: 1, delay: 2.5 },
          { path: ['ana', 'leader', 'ana'], tone: 'response', label: 'fall back to leader', duration: 1.6, delay: 3.6 },
        ],
        caption: 'Skip any replica older than your last write',
      },
      code: {
        language: 'python',
        title: 'Read-your-writes with a log position in the session',
        source: `def write(session, sql, *args):
    lsn = leader.execute_returning_lsn(sql, *args)
    session["min_lsn"] = max(session.get("min_lsn", 0), lsn)

def read(session, sql, *args):
    need = session.get("min_lsn", 0)
    for replica in shuffled(replicas):
        if replica.replayed_lsn() >= need:     # has my writes
            return replica.query(sql, *args)
    return leader.query(sql, *args)            # nobody caught up yet`,
        highlight: [3, 8, 10],
      },
    },
    {
      title: 'Monotonic',
      tag: 'concept',
      heading: 'Monotonic reads: time never runs backwards',
      eli5: 'Ben is told to always read the same hallway board. That board might be a little old, but once he has seen a notice there, it will never disappear on his next visit.',
      body: [
        'Ben never wrote anything, so read-your-writes does not help him. His problem is **going backwards**: a newer replica followed by an older one.',
        '**Monotonic reads** promise that once a client has seen a value, later reads never return anything older. The simple way is to pin each user to one replica, for example by hashing the user ID. A sturdier way is to remember the highest version the client has seen and skip replicas below it, which also survives a replica dying.',
        'Ben can still see stale data. What he cannot see is a post appear and then vanish.',
      ],
      keyIdea: 'Monotonic reads let data be old, as long as it never gets older from the same reader\'s point of view.',
      metrics: { model: 'monotonic reads', anomaly: 'stale, out of order', latency: '2 ms local', avail: 'mostly' },
      scene: {
        nodes: [ana, leader, { ...repA, status: 'active', badge: 'Ben is pinned here' }, { ...repB, status: 'dim' }, { ...ben, status: 'ok', badge: 'post stays' }, cara],
        links: [...links, { from: 'ben', to: 'repB', style: 'faint' }],
        flows: [
          { path: ['ben', 'repA'], tone: 'request', label: 'load chat', duration: 0.9 },
          { path: ['repA', 'ben'], tone: 'response', label: 'post', duration: 0.9, delay: 1 },
          { path: ['ben', 'repA'], tone: 'request', label: 'refresh: same replica', duration: 0.9, delay: 2.2 },
          { path: ['repA', 'ben'], tone: 'response', label: 'post', duration: 0.9, delay: 3.2 },
        ],
        caption: 'Same reader, same replica, no time travel',
      },
    },
    {
      title: 'Causal',
      tag: 'concept',
      heading: 'Causal consistency: answers never arrive before questions',
      eli5: 'Ana pins "Who can bring snacks?" and Cara pins "Me!" under it. A hallway board must never show "Me!" before the question is up, or it makes no sense.',
      body: [
        'Ana asks "Who can drive Friday?". Cara reads it and replies "I can". The reply was written **because of** the question. If replication carries Cara\'s reply to replica A first, Ben sees an answer to a question that does not exist yet.',
        '**Causal consistency** promises that if one write could have been influenced by another, every reader sees them in that order. Writes with no causal link (two unrelated posts in different chats) may still show in different orders to different people.',
        'Implementations track dependencies: each write carries the versions it depends on, often as a **version vector**, and a replica delays showing a write until its dependencies are visible. Causal is the strongest model that can stay available during a network partition.',
      ],
      keyIdea: 'Causal consistency keeps cause before effect for everyone, while still letting replicas answer on their own.',
      metrics: { model: 'causal', anomaly: 'stale, unrelated writes reorder', latency: '2 ms local', avail: 'yes' },
      scene: {
        nodes: [
          { ...ana, badge: 'Q: who drives Friday?' },
          leader,
          { ...repA, status: 'hot', badge: 'reply arrived first' },
          repB,
          { ...ben, status: 'hot', badge: 'answer, no question' },
          { ...cara, badge: 'A: I can' },
        ],
        links: [...links, { from: 'cara', to: 'leader', style: 'faint' }],
        flows: [
          { path: ['ana', 'leader'], tone: 'request', label: 'question', duration: 1 },
          { path: ['cara', 'leader'], tone: 'request', label: 'reply', duration: 1, delay: 1.2 },
          { path: ['leader', 'repA'], tone: 'data', label: 'reply', duration: 0.8, delay: 2.3 },
          { path: ['leader', 'repA'], tone: 'data', label: 'question', duration: 2, delay: 2.3 },
          { path: ['repA', 'ben'], tone: 'error', label: 'reply only', duration: 0.9, delay: 3.2 },
        ],
        caption: 'Without causal order, the effect beats the cause',
      },
      quiz: {
        question: 'Ben refreshes and sees a comment, refreshes again and it is gone. He never wrote anything. Which guarantee would have prevented this?',
        options: ['Read-your-writes', 'Monotonic reads', 'Eventual consistency', 'None, this is always possible with replicas'],
        answer: 1,
        explain: 'Going backwards in time is the anomaly monotonic reads removes. Read-your-writes only covers your own writes, and eventual consistency allows this.',
      },
    },
    {
      title: 'Sequential',
      tag: 'concept',
      heading: 'Sequential consistency: one order, maybe late',
      eli5: 'Now every hallway board shows notices in the exact same order as the main board. A board can still be a few minutes behind the main one.',
      body: [
        '**Sequential consistency** says all clients see all writes in one single order, and that order respects each client\'s own sequence of operations. Nobody sees writes in a different order from anyone else.',
        'What it does not promise is recency. The single order can lag real time. If Ana changes the meeting time and then phones Ben, Ben can still read the old time from a replica that has not reached that point in the order. That is legal, because the phone call happened outside the system.',
        'A single leader replicating its log in order to followers gives roughly this shape: every follower replays the same sequence, and some are further behind than others. ZooKeeper documents its reads this way and offers a `sync` call for when you need the latest.',
      ],
      keyIdea: 'Sequential consistency agrees on one order of history for everyone, without promising that you are reading the present.',
      metrics: { model: 'sequential', anomaly: 'stale vs real time', latency: '2 ms local', avail: 'stale reads only' },
      scene: {
        nodes: [
          { ...ana, badge: 'phones Ben' },
          { ...leader, badge: 'log: 1, 2, 3' },
          { ...repA, badge: 'replayed 1, 2, 3' },
          { ...repB, badge: 'replayed 1, 2' },
          ben,
          { ...cara, status: 'hot', badge: 'reads old time' },
        ],
        links: [...links, { from: 'ana', to: 'cara', style: 'faint', label: 'phone call' }],
        flows: [
          { path: ['ana', 'leader'], tone: 'request', label: 'write 3: meet at 7', duration: 1 },
          { path: ['leader', 'repA'], tone: 'data', duration: 0.8, delay: 1.1 },
          { path: ['leader', 'repB'], tone: 'data', duration: 3, delay: 1.1 },
          { path: ['ana', 'cara'], tone: 'event', label: '"check the chat"', duration: 1.2, delay: 1.4 },
          { path: ['repB', 'cara'], tone: 'error', label: 'meet at 6', duration: 0.9, delay: 2.8 },
        ],
        caption: 'Same order everywhere, but replica B lives in the past',
      },
    },
    {
      title: 'Linearizable',
      tag: 'concept',
      heading: 'Linearizability: behave like a single copy',
      eli5: 'Now the school acts as if there were only the main board. The moment a notice is pinned, anyone who looks anywhere sees it. Nobody can ever catch an old version.',
      body: [
        '**Linearizability** is the top rung. The system behaves as if there were one copy of the data and every operation took effect at a single instant between its start and its end. Once any read returns the new value, every read that starts afterwards, from anyone, returns it too.',
        'That closes the phone-call gap from the last step. If Ana\'s write finished before Cara\'s read began, Cara sees it, whatever replica she reaches.',
        'Getting there needs coordination. Reads either go to a leader that confirms it is still leader (a lease or a round of heartbeats with a majority), or go through the consensus log. etcd does this by default and lets you ask for a cheaper, possibly stale read.',
      ],
      keyIdea: 'Linearizable means one copy in real time: after a write completes, nobody anywhere can read the old value.',
      metrics: { model: 'linearizable', anomaly: 'none', latency: '1 majority round trip', avail: 'majority side only' },
      scene: {
        nodes: [
          ana,
          { ...leader, status: 'active', badge: 'confirms with majority' },
          { ...repA, label: 'follower A', sub: 'votes', status: 'ok' },
          { ...repB, label: 'follower B', sub: 'votes', status: 'ok' },
          { ...ben, status: 'dim' },
          { ...cara, status: 'ok', badge: 'meet at 7' },
        ],
        links: [
          { from: 'ana', to: 'leader' },
          { from: 'leader', to: 'repA', style: 'dashed' },
          { from: 'leader', to: 'repB', style: 'dashed' },
          { from: 'cara', to: 'leader' },
        ],
        flows: [
          { path: ['cara', 'leader'], tone: 'request', label: 'read', duration: 1 },
          { path: ['leader', 'repA'], tone: 'handshake', label: 'still leader?', duration: 0.8, delay: 1.1 },
          { path: ['leader', 'repB'], tone: 'handshake', duration: 0.8, delay: 1.1 },
          { path: ['repA', 'leader'], tone: 'handshake', label: 'yes', duration: 0.8, delay: 2 },
          { path: ['leader', 'cara'], tone: 'response', label: 'meet at 7', duration: 1, delay: 3 },
        ],
        caption: 'The read waits until the leader proves it is current',
      },
      code: {
        language: 'bash',
        title: 'etcd: linearizable by default, stale on request',
        source: `# default: linearizable read, goes through the quorum
etcdctl get /chat/meeting-time

# serializable read: answered by the local member, may be stale
etcdctl get /chat/meeting-time --consistency=s

# compare-and-swap that only works with linearizable storage:
# take the lock only if nobody holds it
etcdctl txn <<'EOF'
create("/locks/report") = "0"

put /locks/report "worker-7"

EOF`,
        highlight: [2, 5, 10, 12],
      },
    },
    {
      title: 'When it matters',
      tag: 'case',
      heading: 'Case: two people claim the same username',
      eli5: 'Two pupils each look at a different hallway board, see the last locker free, and both write their name on it. Only a single trusted board can stop that.',
      body: [
        'Signups for the name "mina" arrive in Berlin and in Ohio within 50 ms. Each region checks its own replica, finds the name free, and creates the account. Now two users own one name. No read-your-writes or causal guarantee prevents this, because neither client did anything wrong from its own point of view.',
        'Uniqueness constraints, locks, leader election, "last seat on the plane" and account balances that must not go below zero all need the same thing: everyone agreeing on the latest value right now. That is **linearizability**, often for just one key or one row.',
        'The cost is real. A linearizable operation across regions pays at least one cross-region round trip, often 70 ms or more. And during a network partition the minority side must refuse it. That is the C in CAP, so use it for the few operations that need it.',
      ],
      keyIdea: 'Use linearizability where two clients racing on the same value would break an invariant. Pay for it only there.',
      metrics: { model: 'linearizable for one key', anomaly: 'none for that key', latency: '70+ ms cross-region', avail: 'majority side only' },
      scene: {
        zones: [
          { id: 'eu', from: [0, 1], to: [4.6, 5], label: 'Berlin', tone: 'violet' },
          { id: 'us', from: [1.5, -3.5], to: [6.5, 0.5], label: 'Ohio', tone: 'blue' },
        ],
        nodes: [
          { ...repA, label: 'replica EU', sub: 'local check', status: 'hot', badge: '"mina" free' },
          { ...repB, label: 'replica US', sub: 'local check', status: 'hot', badge: '"mina" free' },
          leader,
          { ...ben, label: 'signup', sub: 'wants "mina"', status: 'hot' },
          { ...cara, label: 'signup', sub: 'wants "mina"', status: 'hot' },
        ],
        links: [
          { from: 'ben', to: 'repA' },
          { from: 'cara', to: 'repB' },
          { from: 'leader', to: 'repA', style: 'faint' },
          { from: 'leader', to: 'repB', style: 'faint' },
        ],
        flows: [
          { path: ['ben', 'repA'], tone: 'request', label: 'is "mina" free?', duration: 1 },
          { path: ['cara', 'repB'], tone: 'request', label: 'is "mina" free?', duration: 1 },
          { path: ['repA', 'ben'], tone: 'error', label: 'yes', duration: 1, delay: 1.1 },
          { path: ['repB', 'cara'], tone: 'error', label: 'yes', duration: 1, delay: 1.1 },
        ],
        caption: 'Two local "yes" answers, one name',
      },
    },
    {
      title: 'Real databases',
      tag: 'tradeoff',
      heading: 'What real databases actually give you',
      eli5: 'Each school picks its own rule. Some let you choose per question: glance at the nearest hallway board, or walk to the main board when it really matters.',
      body: [
        '**PostgreSQL or MySQL with one primary**: reads on the primary see every committed write. Async replicas are eventually consistent, and session routing adds read-your-writes. **DynamoDB**: reads are eventually consistent by default, and a strongly consistent read is a per-request flag that costs more capacity. **Cassandra**: you choose per query, from `ONE` to `QUORUM` to `ALL`, and lightweight transactions add a consensus round for compare-and-set.',
        '**MongoDB**: causally consistent sessions, plus read and write concerns up to `linearizable` for single-document reads. **etcd** and **ZooKeeper**: linearizable writes through consensus. etcd reads are linearizable by default. ZooKeeper reads are local and sequential unless you call `sync` first.',
        'Read the documentation for the exact wording, because "strong" means different things to different vendors. Most systems let you pick the rung per operation, and that is the main design lever.',
      ],
      keyIdea: 'Most databases offer several rungs per request. Pick the cheapest one that removes the anomaly your feature cannot tolerate.',
      metrics: { model: 'per request', anomaly: 'depends on the rung', latency: '2 ms to 70+ ms', avail: 'trade per request' },
      scene: {
        nodes: [ana, leader, repA, repB, { ...ben, badge: 'feed: eventual' }, { ...cara, badge: 'balance: strong' }],
        links: [...links, { from: 'cara', to: 'leader' }],
        flows: [
          { path: ['ben', 'repA', 'ben'], tone: 'response', label: 'cheap read', count: 3, duration: 1.4 },
          { path: ['cara', 'leader', 'cara'], tone: 'request', label: 'ConsistentRead', duration: 2.4, delay: 0.5 },
        ],
        caption: 'Same data, different rung per request',
      },
      code: {
        language: 'python',
        title: 'Choosing the rung per request (DynamoDB and Cassandra)',
        source: `# DynamoDB: default read may be stale; this one sees all acknowledged writes
item = table.get_item(Key={"user_id": "u42"}, ConsistentRead=True)

# Cassandra: the feed tolerates staleness, the balance check does not
from cassandra import ConsistencyLevel
from cassandra.query import SimpleStatement

feed = SimpleStatement("SELECT * FROM feed WHERE user_id = %s",
                       consistency_level=ConsistencyLevel.ONE)
balance = SimpleStatement("SELECT balance FROM wallets WHERE user_id = %s",
                          consistency_level=ConsistencyLevel.QUORUM)`,
        highlight: [2, 9, 11],
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Each rung removes one anomaly and adds one cost',
      eli5: 'Old hallway boards are fine for lunch menus. For who gets the last locker, everyone checks the main board, even if the walk takes longer.',
      body: [
        '**Eventual** allows everything until replicas converge. **Read-your-writes** stops your own edits vanishing. **Monotonic reads** stop time running backwards. **Causal** keeps causes before effects for everyone, and can still answer during a partition. **Sequential** gives everyone one order, possibly late. **Linearizable** behaves like one copy in real time.',
        'Climbing the ladder costs coordination: more round trips, and less availability when the network splits. Choose per operation. Feeds and counters can be eventual. Profile edits need read-your-writes. Usernames, locks and balances need linearizability.',
      ],
      keyIdea: 'Name the anomaly your feature cannot tolerate, then buy the cheapest rung that removes it.',
      metrics: { model: 'per operation', anomaly: 'chosen', latency: '2 ms to 70+ ms', avail: 'chosen' },
      scene: {
        nodes: [{ ...ana, status: 'ok' }, { ...leader, status: 'ok' }, { ...repA, status: 'ok' }, { ...repB, status: 'ok', sub: 'caught up' }, { ...ben, status: 'ok' }, { ...cara, status: 'ok' }],
        links,
        flows: [
          { path: ['ana', 'leader'], tone: 'request', duration: 1 },
          { path: ['leader', 'repA'], tone: 'data', duration: 0.9, delay: 1.1 },
          { path: ['leader', 'repB'], tone: 'data', duration: 1.1, delay: 1.1 },
          { path: ['repA', 'ben'], tone: 'response', duration: 0.9, delay: 2.3 },
          { path: ['repB', 'cara'], tone: 'response', duration: 0.9, delay: 2.4 },
        ],
      },
      quiz: {
        question: 'Ana finishes saving a new meeting time, then calls Cara, who reads the old time from a replica. Which is the weakest model that forbids this?',
        options: ['Causal consistency', 'Sequential consistency', 'Monotonic reads', 'Linearizability'],
        answer: 3,
        explain: 'The write completed before Cara\'s read started, in real time. Only linearizability ties ordering to real time. Sequential and causal allow Cara\'s replica to be behind because the phone call is outside the system.',
      },
    },
  ],
};
