import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const ana: SceneNode = { id: 'ana', kind: 'phone', at: at(-6, 0), label: 'Ana', sub: 'writes' };
const leader: SceneNode = { id: 'leader', kind: 'db', at: at(-2.6, 0), label: 'leader', sub: 'takes writes' };
const repA: SceneNode = { id: 'repA', kind: 'replica', at: at(0.8, -3.6), label: 'replica A', sub: 'caught up' };
const repB: SceneNode = { id: 'repB', kind: 'replica', at: at(3.6, 3.6), label: 'replica B', sub: '2 s behind' };
const ben: SceneNode = { id: 'ben', kind: 'phone', at: at(6.2, -3.6), label: 'Ben', sub: 'reads' };
const cara: SceneNode = { id: 'cara', kind: 'phone', at: at(6.6, 3.6), label: 'Cara', sub: 'reads' };

const repC: SceneNode = { id: 'repC', kind: 'replica', at: leader.at, label: 'replica C', sub: 'takes writes' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

export const consistencyModels: Lesson = {
  id: 'consistency-models',
  title: 'Consistency models (part 1)',
  tagline: 'The ladder between "strong" and "eventual", part 1: eventual consistency, conflicts, session guarantees and causal order.',
  minutes: 14,
  level: 'Advanced',
  learn: [
    'Eventual consistency, how replicas converge and what it is good for',
    'Conflicts from concurrent writes: last writer wins, version vectors, merges',
    'Session guarantees: read-your-writes, monotonic reads, monotonic writes',
    'Causal consistency: effects never appear before their causes',
  ],
  metrics: [
    { key: 'model', label: 'Guarantee', icon: 'Layers' },
    { key: 'anomaly', label: 'Still possible', icon: 'Bug' },
    { key: 'latency', label: 'Read latency', icon: 'Timer' },
    { key: 'avail', label: 'Reads in a partition', icon: 'Signal' },
  ],
  steps: [
    {
      title: 'Vanishing post',
      tag: 'problem',
      heading: 'Ben saw the message, refreshed, and it was gone',
      eli5: 'The school has a main noticeboard and copies in two hallways. A runner carries each new notice to the copies. Ben read a notice in one hallway, walked to the other, and it was not there yet.',
      body: [
        'Ana posts "Practice moved to 6 pm" in a group chat. It lands on the leader and copies to two replicas asynchronously. Replica A has it in 20 ms. Replica B is 2 seconds behind.',
        'Ben reads from A and sees the post. His refresh goes to B and the post vanishes. Every replica is working as designed.',
        'A **consistency model** is the contract that says how far behind a copy may be, and which odd orders of events a reader may see.',
      ],
      keyIdea: 'Replicas disagree for a while. A consistency model states which disagreements a client can observe.',
      metrics: { model: 'none stated', anomaly: 'anything', latency: '2 ms local', avail: 'yes' },
      metricTones: { model: 'bad', anomaly: 'bad' },
      scene: {
        nodes: [
          ana,
          { ...leader, status: 'active', badge: 'has post' },
          { ...repA, status: 'ok', badge: 'has post' },
          { ...repB, status: 'hot', badge: 'no post yet' },
          { ...ben, status: 'hot', chips: ['GET /chat', { text: 'GET /chat', tone: 'warn' }], badge: 'saw it, then lost it' },
        ],
        links: [
          link('ana', 'leader'),
          link('leader', 'repA', { style: 'dashed', label: 'async 20 ms' }),
          link('leader', 'repB', { style: 'dashed', label: 'async 2 s', labelTone: 'warn' }),
          link('ben', 'repA'),
          link('ben', 'repB', { style: 'faint' }),
        ],
        flows: [
          { path: ['ana', 'leader'], tone: 'request', label: 'post', duration: 1 },
          { path: ['leader', 'repA'], tone: 'data', duration: 0.8, delay: 1.1 },
          { path: ['leader', 'repB'], tone: 'data', duration: 3.6, delay: 1.1 },
          { path: ['repA', 'ben'], tone: 'response', label: 'post', duration: 0.9, delay: 2 },
          { path: ['repB', 'ben'], tone: 'error', label: 'no post', duration: 0.9, delay: 3.2 },
        ],
        panel: {
          title: 'What each copy holds',
          icon: 'Database',
          rows: [
            { text: 'leader', value: 'post', tone: 'good' },
            { text: 'replica A (20 ms)', value: 'post', tone: 'good' },
            { text: 'replica B (2 s)', value: 'no post', tone: 'bad' },
          ],
          footer: { text: 'Same chat, two answers', tone: 'bad' },
        },
        caption: 'One refresh, a different replica, an older world',
      },
    },
    {
      title: 'The ladder',
      tag: 'concept',
      heading: 'A ladder of promises, from cheap to costly',
      eli5: 'The school can make rules about its noticeboards. Strict rules keep every board perfect but slow everyone down. Loose rules are fast but boards can be old.',
      body: [
        'Each rung forbids more odd behavior and costs more coordination. From the bottom: **eventual**, the **session guarantees** (read-your-writes, monotonic reads, monotonic writes), **causal**, **sequential** and **linearizable**.',
        'Climb one rung at a time and ask two things: which anomaly does it remove, and what does it cost in latency and availability? CAP only names the two ends.',
      ],
      keyIdea: 'Consistency is a ladder, not a switch. Each rung removes one anomaly and charges for it.',
      metrics: { model: 'a ladder', anomaly: 'depends on the rung', latency: '2 ms to 70+ ms', avail: 'drops as you climb' },
      scene: {
        nodes: [ana, leader, repA, repB, ben],
        links: [
          link('ana', 'leader'),
          link('leader', 'repA', { style: 'dashed' }),
          link('leader', 'repB', { style: 'dashed' }),
          link('ben', 'repA'),
        ],
        flows: [
          { path: ['ana', 'leader'], tone: 'request', duration: 1 },
          { path: ['leader', 'repA'], tone: 'data', duration: 0.9, delay: 1.1 },
          { path: ['leader', 'repB'], tone: 'data', duration: 1.4, delay: 1.1 },
          { path: ['repA', 'ben'], tone: 'response', duration: 0.9, delay: 2.2 },
        ],
        panel: {
          title: 'The consistency ladder',
          icon: 'Layers',
          rows: [
            { text: 'Linearizable', value: 'one copy, real time', tone: 'bad' },
            { text: 'Sequential', value: 'one order for all', tone: 'warn' },
            { text: 'Causal', value: 'cause before effect', tone: 'warn' },
            { text: 'Session guarantees', value: 'per client rules', tone: 'good' },
            { text: 'Eventual', value: 'converge someday', tone: 'good' },
          ],
          footer: { text: 'Top is the costliest, bottom is the cheapest', tone: 'muted' },
        },
        caption: 'Five rungs between "anything goes" and "one copy"',
      },
    },
    {
      title: 'Eventual',
      tag: 'concept',
      heading: 'Eventual consistency: they agree, someday',
      eli5: 'The runner promises that every hallway board will show the notice in the end. Until then, any board might be old, and two boards might show different things.',
      body: [
        '**Eventual consistency** promises one thing: if writes stop, all replicas converge to the same value. It says nothing about how long that takes or what readers see before then.',
        'Every anomaly from step 1 is allowed: stale reads, two readers disagreeing, a value followed by an older one, and a reply showing before the message it answers.',
      ],
      keyIdea: 'Eventual consistency only promises convergence. Every in-between state is fair game.',
      metrics: { model: 'eventual', anomaly: 'stale, backwards, out of order', latency: '2 ms local', avail: 'yes' },
      metricTones: { anomaly: 'bad', latency: 'good', avail: 'good' },
      scene: {
        nodes: [
          leader,
          { ...repA, badge: 'v2' },
          { ...repB, badge: 'v1, converging' },
          { ...ben, badge: 'sees v2' },
          { ...cara, badge: 'sees v1' },
        ],
        links: [
          link('leader', 'repA', { style: 'dashed' }),
          link('leader', 'repB', { style: 'dashed' }),
          link('ben', 'repA'),
          link('cara', 'repB'),
        ],
        flows: [
          { path: ['leader', 'repA'], tone: 'data', duration: 0.8 },
          { path: ['leader', 'repB'], tone: 'data', duration: 3.2 },
          { path: ['repA', 'ben'], tone: 'response', label: 'v2', duration: 0.9, delay: 1 },
          { path: ['repB', 'cara'], tone: 'response', label: 'v1', duration: 0.9, delay: 1 },
        ],
        panel: {
          title: 'Allowed until they converge',
          icon: 'Bug',
          rows: [
            { text: 'Stale read', value: 'allowed', tone: 'warn' },
            { text: 'Two readers disagree', value: 'allowed', tone: 'warn' },
            { text: 'Value, then older value', value: 'allowed', tone: 'warn' },
            { text: 'Reply before message', value: 'allowed', tone: 'warn' },
          ],
          footer: { text: 'Only promise: same value if writes stop', tone: 'muted' },
        },
        caption: 'Both answers are legal',
      },
    },
    {
      title: 'Why use it',
      tag: 'tradeoff',
      heading: 'The cheapest rung keeps answering',
      eli5: 'A hallway board can always be read, even when the main office is locked. It might be a bit old, but nobody ever has to wait.',
      body: [
        'It is the bottom rung because it costs the least. Any replica answers from its own disk in about 2 ms, and reads keep working through a network partition or a dead leader.',
        'Counters, view counts and recommendation lists live here happily. A like count that is 3 seconds old hurts nobody.',
      ],
      keyIdea: 'Eventual consistency buys speed and availability. Spend it on data where being slightly old is harmless.',
      metrics: { model: 'eventual', anomaly: 'stale', latency: '2 ms local', avail: 'yes, even leader down' },
      metricTones: { latency: 'good', avail: 'good', anomaly: 'warn' },
      scene: {
        nodes: [
          { ...leader, status: 'down', sub: 'unreachable' },
          { ...repA, status: 'ok' },
          { ...repB, status: 'ok' },
          { ...ben, chips: [{ text: 'GET /likes', tone: 'good' }], badge: '1,204 likes' },
          { ...cara, chips: [{ text: 'GET /likes', tone: 'good' }], badge: '1,201 likes' },
        ],
        links: [
          link('leader', 'repA', { style: 'faint', label: 'partition', labelTone: 'warn' }),
          link('leader', 'repB', { style: 'faint' }),
          link('ben', 'repA'),
          link('cara', 'repB'),
        ],
        flows: [
          { path: ['ben', 'repA', 'ben'], tone: 'response', label: '2 ms', duration: 1.4 },
          { path: ['cara', 'repB', 'cara'], tone: 'response', label: '2 ms', duration: 1.4, delay: 0.3 },
        ],
        panel: {
          title: 'What it buys',
          icon: 'Zap',
          rows: [
            { text: 'Read latency', value: '2 ms', tone: 'good' },
            { text: 'Leader down', value: 'reads still work', tone: 'good' },
            { text: 'Freshness', value: 'seconds old', tone: 'warn' },
          ],
        },
        caption: 'Slightly stale beats an error page',
      },
    },
    {
      title: 'Converging',
      tag: 'concept',
      heading: 'How replicas actually converge',
      eli5: 'The runner is not the only helper. A reader who spots an old notice fixes the board. At night a janitor compares boards and updates old ones.',
      body: [
        'Four mechanisms do the work. The **replication stream** ships the leader log to followers. **Read repair** writes the fresh value back when a read finds a stale copy.',
        '**Anti-entropy** is a background job that compares copies, often with Merkle trees, and fixes differences. **Hinted handoff** holds writes for a downed peer and replays them when it returns.',
      ],
      keyIdea: 'Convergence is not magic. It is streams, read repair, background comparison and replayed hints.',
      metrics: { model: 'eventual', anomaly: 'stale until repaired', latency: '2 ms local', avail: 'yes' },
      scene: {
        nodes: [leader, { ...repA, badge: 'v2' }, { ...repB, status: 'hot', badge: 'v1, stale' }, ben],
        links: [
          link('leader', 'repA', { style: 'dashed' }),
          link('leader', 'repB', { style: 'dashed' }),
          link('repA', 'repB', { style: 'faint', label: 'repair', arrow: 'both' }),
          link('ben', 'repB'),
        ],
        flows: [
          { path: ['ben', 'repB', 'ben'], tone: 'request', label: 'read finds v1', duration: 1.6 },
          { path: ['repB', 'repA'], tone: 'request', label: 'compare', duration: 1, delay: 1.7 },
          { path: ['repA', 'repB'], tone: 'data', label: 'v2', duration: 1, delay: 2.8 },
        ],
        panel: {
          title: 'When each one runs',
          icon: 'Clock',
          rows: [
            { text: 'Replication stream', value: 'ms to seconds' },
            { text: 'Read repair', value: 'on the next read' },
            { text: 'Anti-entropy', value: 'minutes, background' },
            { text: 'Hinted handoff', value: 'when the peer returns' },
          ],
        },
        caption: 'A stale read can fix the copy it found',
      },
    },
    {
      title: 'Conflicts',
      tag: 'concept',
      heading: 'Two writers, two replicas, one key',
      eli5: 'Ana and Cara each rewrite the noticeboard title at the same moment, on different boards. When the runner meets them, someone has to decide which title wins.',
      body: [
        'Ana renames the chat on replica A. Cara renames it on replica B. Neither write saw the other, so it is a **conflict**, and eventually consistent stores must resolve it.',
        '**Last writer wins** keeps the higher timestamp and drops the other write. Clock skew can even pick the older one.',
        'A **version vector** keeps one counter per replica. If one vector is at least as high everywhere, it replaced the other. If each is higher somewhere, the writes were concurrent, so the app can **merge** them.',
      ],
      keyIdea: 'Concurrent writes need a resolution rule. Last writer wins is simple and loses data, merging keeps both.',
      metrics: { model: 'eventual', anomaly: 'lost update (LWW)', latency: '2 ms local', avail: 'yes' },
      metricTones: { anomaly: 'bad' },
      scene: {
        nodes: [
          { ...ana, chips: [{ text: 'title = "Practice 6"', tone: 'good' }] },
          { ...repA, badge: 't=10.001' },
          { ...repB, badge: 't=10.002' },
          { ...cara, label: 'Cara', sub: 'writes', chips: [{ text: 'title = "Practice 7"', tone: 'good' }] },
        ],
        links: [link('ana', 'repA'), link('cara', 'repB'), link('repA', 'repB', { style: 'dashed', arrow: 'both', label: 'sync' })],
        flows: [
          { path: ['ana', 'repA'], tone: 'request', label: 'Practice 6', duration: 1.1 },
          { path: ['cara', 'repB'], tone: 'request', label: 'Practice 7', duration: 1.1 },
          { path: ['repA', 'repB'], tone: 'data', duration: 1.2, delay: 1.5 },
          { path: ['repB', 'repA'], tone: 'data', duration: 1.2, delay: 1.5 },
        ],
        panel: {
          title: 'Version vectors, one counter per replica',
          icon: 'Split',
          rows: [
            { text: '{A:1,B:0} vs {A:0,B:1}', value: 'concurrent, merge', tone: 'warn' },
            { text: '{A:1,B:1} vs {A:1,B:0}', value: 'dominates, replaces', tone: 'good' },
            { text: 'Last writer wins instead', value: 'Ana edit lost', tone: 'bad' },
          ],
          footer: { text: 'A merge gets {A:1,B:1}, above both', tone: 'muted' },
        },
        caption: 'Neither write knew about the other',
      },
    },
    {
      title: 'Your writes',
      tag: 'concept',
      heading: 'Read-your-writes: you always see your own changes',
      eli5: 'After Ana pins a notice, she checks the hallway board and it is not there yet. She worries it was lost. She should always see her own notice, even if other boards are old.',
      body: [
        '**Read-your-writes** removes one anomaly: after you write, your own later reads include that write. Other users may still see old data.',
        'It is a **session guarantee**. It holds per client, not across clients. Without it, Ana posts, refreshes, and her own post is missing.',
      ],
      keyIdea: 'Read-your-writes protects a user from their own vanishing edits. Everyone else can still be behind.',
      metrics: { model: 'none yet', anomaly: 'own write missing', latency: '2 ms local', avail: 'yes' },
      metricTones: { anomaly: 'bad' },
      scene: {
        nodes: [
          { ...ana, status: 'hot', badge: 'my post is gone?' },
          { ...leader, badge: 'has post' },
          repA,
          { ...repB, badge: 'no post yet' },
        ],
        links: [link('ana', 'leader'), link('leader', 'repB', { style: 'dashed' }), link('leader', 'repA', { style: 'dashed' }), link('ana', 'repB', { style: 'faint' })],
        flows: [
          { path: ['ana', 'leader'], tone: 'request', label: 'post', duration: 1 },
          { path: ['ana', 'repB'], tone: 'request', label: 'refresh', duration: 1.2, delay: 1.2 },
          { path: ['repB', 'ana'], tone: 'error', label: 'no post', duration: 1, delay: 2.5 },
        ],
        panel: {
          title: 'Who the guarantee protects',
          icon: 'User',
          rows: [
            { text: 'Ana reads her own post', value: 'must see it', tone: 'good' },
            { text: 'Ben reads Ana\'s post', value: 'may be old', tone: 'warn' },
          ],
          footer: { text: 'Scope: one client', tone: 'muted' },
        },
        caption: 'The write succeeded, the next read did not show it',
      },
    },
    {
      title: 'Session routing',
      tag: 'concept',
      heading: 'Skip any replica older than your last write',
      eli5: 'Ana carries a note saying "my notice was number 7,402". She only reads boards that have reached number 7,402, and otherwise walks to the main board.',
      body: [
        'Two common ways. Send a user\'s reads to the leader for a few seconds after they write. Or keep the log position (LSN) of their last write in the session and read only from a replica that has replayed past it.',
        'If no replica has caught up yet, fall back to the leader.',
      ],
      keyIdea: 'Track the position of your last write, then only read from copies that have reached it.',
      metrics: { model: 'read-your-writes', anomaly: 'others see stale', latency: '2 ms, leader after writes', avail: 'mostly' },
      metricTones: { model: 'good' },
      scene: {
        nodes: [
          { ...ana, status: 'ok', chips: ['min_lsn = 7,402'] },
          { ...leader, status: 'active', badge: 'LSN 7,402' },
          { ...repA, badge: 'replayed 7,390' },
          { ...repB, badge: 'replayed 7,380' },
        ],
        links: [link('ana', 'leader'), link('leader', 'repA', { style: 'dashed' }), link('leader', 'repB', { style: 'dashed' }), link('ana', 'repB', { style: 'faint' })],
        flows: [
          { path: ['ana', 'leader'], tone: 'request', label: 'post (LSN 7,402)', duration: 1 },
          { path: ['ana', 'repB'], tone: 'request', label: 'read, need 7,402', duration: 1.2, delay: 1.2 },
          { path: ['repB', 'ana'], tone: 'error', label: 'too old', duration: 1, delay: 2.5 },
          { path: ['ana', 'leader', 'ana'], tone: 'response', label: 'fall back to leader', duration: 1.6, delay: 3.6 },
        ],
        panel: {
          title: 'Replica check',
          icon: 'List',
          rows: [
            { text: 'replica A replayed 7,390', value: 'skip', tone: 'bad' },
            { text: 'replica B replayed 7,380', value: 'skip', tone: 'bad' },
            { text: 'leader at 7,402', value: 'use', tone: 'good' },
          ],
        },
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
      title: 'Two devices',
      tag: 'case',
      heading: 'Case: write on the phone, read on the laptop',
      eli5: 'Ana writes her note at one desk and walks to another desk. The second desk has never heard of her note number, so it shows her an old board.',
      body: [
        'Ana posts on her phone and opens the chat on her laptop. The laptop has its own session, so the guarantee does not carry over unless both share the same token.',
        'Store the last write position with the account, not the device. A claim in the login token works, and so does a per-user key in a fast store.',
      ],
      keyIdea: 'Session guarantees only hold where the session token travels. Make it follow the account, not the device.',
      metrics: { model: 'read-your-writes', anomaly: 'broken across devices', latency: '2 ms local', avail: 'yes' },
      metricTones: { anomaly: 'warn' },
      scene: {
        nodes: [
          { ...ana, label: 'Ana phone', chips: [{ text: 'min_lsn = 7,402', tone: 'good' }] },
          { id: 'laptop', kind: 'client', at: at(-6, 7.5), label: 'Ana laptop', sub: 'no session', status: 'hot', chips: [{ text: 'min_lsn = none', tone: 'bad' }] },
          { ...leader, badge: 'LSN 7,402' },
          { ...repB, badge: 'replayed 7,380' },
        ],
        links: [link('ana', 'leader'), link('laptop', 'repB'), link('leader', 'repB', { style: 'dashed' })],
        flows: [
          { path: ['ana', 'leader'], tone: 'request', label: 'post', duration: 1 },
          { path: ['laptop', 'repB'], tone: 'request', label: 'open chat', duration: 1.2, delay: 1.3 },
          { path: ['repB', 'laptop'], tone: 'error', label: 'no post', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'Where the token lives',
          icon: 'Key',
          rows: [
            { text: 'Per device cookie', value: 'lost on switch', tone: 'bad' },
            { text: 'Login token claim', value: 'follows account', tone: 'good' },
            { text: 'Per user key in Redis', value: 'follows account', tone: 'good' },
          ],
        },
        caption: 'Same person, two sessions, two worlds',
      },
    },
    {
      title: 'Monotonic',
      tag: 'concept',
      heading: 'Monotonic reads: time never runs backwards',
      eli5: 'Ben reads a notice on one hallway board, walks on, and the next board has not got it yet. The notice seems to have vanished. That should never happen to him.',
      body: [
        'Ben never wrote anything, so read-your-writes does not help him. His problem is **going backwards**: a newer replica followed by an older one.',
        '**Monotonic reads** promise that once a client has seen a value, later reads never return anything older. Ben can still see stale data. What he cannot see is a post appear and then vanish.',
      ],
      keyIdea: 'Monotonic reads let data be old, as long as it never gets older from the same reader\'s point of view.',
      metrics: { model: 'none yet', anomaly: 'time runs backwards', latency: '2 ms local', avail: 'yes' },
      metricTones: { anomaly: 'bad' },
      scene: {
        nodes: [leader, { ...repA, badge: 'v2' }, { ...repB, badge: 'v1' }, { ...ben, status: 'hot', badge: 'v2, then v1' }],
        links: [link('leader', 'repA', { style: 'dashed' }), link('leader', 'repB', { style: 'dashed' }), link('ben', 'repA'), link('ben', 'repB', { style: 'faint' })],
        flows: [
          { path: ['ben', 'repA', 'ben'], tone: 'response', label: 'read 1: v2', duration: 1.6 },
          { path: ['ben', 'repB', 'ben'], tone: 'error', label: 'read 2: v1', duration: 1.6, delay: 2 },
        ],
        panel: {
          title: 'Ben\'s two reads',
          icon: 'Timer',
          rows: [
            { text: 'Read 1 from replica A', value: 'v2' },
            { text: 'Read 2 from replica B', value: 'v1', tone: 'bad' },
          ],
          footer: { text: 'He went back in time', tone: 'bad' },
        },
        caption: 'A newer replica, then an older one',
      },
    },
    {
      title: 'Pinning',
      tag: 'tradeoff',
      heading: 'Two ways to stop time travel',
      eli5: 'Option one: Ben only ever uses the same hallway board. Option two: Ben carries a note of the newest notice he has seen and skips boards that are older.',
      body: [
        'The simple fix pins each user to one replica, for example by hashing the user ID. It is cheap, but when that replica dies the user moves and may move backwards.',
        'The sturdier fix remembers the highest version the client has seen and skips any replica below it. That survives a replica dying.',
      ],
      keyIdea: 'Pin for simplicity, track versions for safety. Both let data be old but never older than what you saw.',
      metrics: { model: 'monotonic reads', anomaly: 'stale, out of order across clients', latency: '2 ms local', avail: 'mostly' },
      metricTones: { model: 'good' },
      scene: {
        nodes: [leader, { ...repA, status: 'active', badge: 'Ben is pinned here' }, { ...repB, status: 'dim' }, { ...ben, status: 'ok', badge: 'post stays' }],
        links: [link('leader', 'repA', { style: 'dashed' }), link('leader', 'repB', { style: 'dashed' }), link('ben', 'repA'), link('ben', 'repB', { style: 'faint' })],
        flows: [
          { path: ['ben', 'repA', 'ben'], tone: 'response', label: 'load chat: post', duration: 1.4 },
          { path: ['ben', 'repA', 'ben'], tone: 'response', label: 'refresh: post', duration: 1.4, delay: 2 },
        ],
        panel: {
          title: 'Pin or track',
          icon: 'Scale',
          rows: [
            { text: 'Pin by user id', value: 'cheap, breaks on failover', tone: 'warn' },
            { text: 'Track highest version', value: 'survives failover', tone: 'good' },
          ],
        },
        caption: 'Same reader, same replica, no time travel',
      },
      quiz: {
        question: 'Ben refreshes and sees a comment, refreshes again and it is gone. He never wrote anything. Which guarantee would have prevented this?',
        options: ['Read-your-writes', 'Monotonic reads', 'Eventual consistency', 'None, this is always possible with replicas'],
        answer: 1,
        explain: 'Going backwards in time is the anomaly monotonic reads removes. Read-your-writes only covers your own writes, and eventual consistency allows this.',
      },
    },
    {
      title: 'Write order',
      tag: 'concept',
      heading: 'Monotonic writes: your edits apply in order',
      eli5: 'Ana pins "away" and then pins "back". The runner must hang them up in that order on every board, or a board will say "away" while she is already back.',
      body: [
        '**Monotonic writes** promise that one client\'s writes are applied in the order it issued them, on every replica. Without it, Ana sets her status to "away", then "back". The two writes land on different replicas, and replica B applies them swapped and ends at "away".',
        'A single leader gives this for free, because its log has one order. Multi-leader and leaderless stores need a per-client sequence number.',
      ],
      keyIdea: 'Monotonic writes keep one client\'s edits in the order they were made, everywhere.',
      metrics: { model: 'monotonic writes', anomaly: 'swapped edits without it', latency: '2 ms local', avail: 'yes' },
      metricTones: { anomaly: 'bad' },
      scene: {
        nodes: [
          { ...ana, chips: ['status = away', 'status = back'] },
          { ...repA, sub: 'took write 1' },
          { ...repC, sub: 'took write 2' },
          { ...repB, status: 'hot', badge: 'status: away' },
        ],
        links: [
          link('ana', 'repA'),
          link('ana', 'repC'),
          link('repA', 'repB', { style: 'dashed', label: 'arrives late', labelTone: 'warn' }),
          link('repC', 'repB', { style: 'dashed', label: 'arrives first' }),
        ],
        flows: [
          { path: ['ana', 'repA'], tone: 'request', label: '1: away', duration: 0.9 },
          { path: ['ana', 'repC'], tone: 'request', label: '2: back', duration: 0.9, delay: 1 },
          { path: ['repC', 'repB'], tone: 'data', label: 'back', duration: 1, delay: 2.2 },
          { path: ['repA', 'repB'], tone: 'error', label: 'away (late)', duration: 1, delay: 3.2 },
        ],
        panel: {
          title: 'Order applied on replica B',
          icon: 'List',
          rows: [
            { text: '1st applied', value: 'back (seq 2)' },
            { text: '2nd applied', value: 'away (seq 1)', tone: 'bad' },
            { text: 'Fix: per-client seq number', value: 'B holds seq 2 until seq 1', tone: 'good' },
          ],
          footer: { text: 'Without seq: final value away, but Ana is back', tone: 'bad' },
        },
        caption: 'Edits arrive in a different order than they were made',
      },
    },
    {
      title: 'Causal',
      tag: 'concept',
      heading: 'Causal consistency: answers never arrive before questions',
      eli5: 'Ana pins "Who can bring snacks?" and Cara pins "Me!" under it. A hallway board must never show "Me!" before the question is up, or it makes no sense.',
      body: [
        'Ana asks "Who can drive Friday?". Cara reads it and replies "I can". The reply was written **because of** the question. If the reply reaches replica A first, Ben sees an answer to a question that does not exist yet.',
        '**Causal consistency** promises that if one write could have been influenced by another, every reader sees them in that order. Unrelated writes may still show in different orders.',
      ],
      keyIdea: 'Causal consistency keeps cause before effect for everyone, while still letting replicas answer on their own.',
      metrics: { model: 'causal', anomaly: 'stale, unrelated writes reorder', latency: '2 ms local', avail: 'yes' },
      metricTones: { model: 'good', avail: 'good' },
      scene: {
        nodes: [
          { ...ana, badge: 'Q: who drives Friday?' },
          { ...repC, sub: 'took question' },
          { ...repB, sub: 'took reply' },
          { ...repA, status: 'hot', sub: 'gets both', badge: 'reply shown, no question' },
          { ...cara, sub: 'replies', badge: 'A: I can' },
        ],
        links: [
          link('ana', 'repC'),
          link('cara', 'repB'),
          link('repC', 'repA', { style: 'dashed', label: 'slow', labelTone: 'warn' }),
          link('repB', 'repA', { style: 'dashed', label: 'fast' }),
        ],
        flows: [
          { path: ['ana', 'repC'], tone: 'request', label: 'question', duration: 1 },
          { path: ['cara', 'repB'], tone: 'request', label: 'reply', duration: 1, delay: 1.2 },
          { path: ['repB', 'repA'], tone: 'data', label: 'reply', duration: 0.8, delay: 2.3 },
          { path: ['repC', 'repA'], tone: 'data', label: 'question', duration: 2, delay: 2.3 },
        ],
        panel: {
          title: 'What a reader of A sees',
          icon: 'Inbox',
          rows: [
            { text: 'Ana: Who can drive Friday?', value: 'missing', tone: 'bad' },
            { text: 'Cara: I can', value: 'shown', tone: 'warn' },
          ],
          footer: { text: 'The effect beat its cause', tone: 'bad' },
        },
        caption: 'Without causal order, the effect beats the cause',
      },
    },
    {
      title: 'Dependencies',
      tag: 'concept',
      heading: 'How a replica holds back an orphan reply',
      eli5: 'Each notice carries a tag naming the notice it answers. A hallway board keeps "Me!" in a drawer until "Who can bring snacks?" is on the wall.',
      body: [
        'Implementations track dependencies. Each write carries the versions it depends on, often as a **version vector**, and a replica holds back a write until its dependencies are visible.',
        '**Writes-follow-reads** says a write is ordered after what its author had read. Cara read the question first, so her reply follows it everywhere.',
        'Causal is the strongest model that can stay available during a network partition. Read-your-writes, monotonic reads, monotonic writes and writes-follow-reads together add up to it.',
      ],
      keyIdea: 'Causal order costs metadata and a short wait, not a majority round trip. That is why it stays available.',
      metrics: { model: 'causal', anomaly: 'unrelated writes reorder', latency: '2 ms local', avail: 'yes, even partitioned' },
      metricTones: { latency: 'good', avail: 'good' },
      scene: {
        nodes: [repC, repB, { ...repA, status: 'active', badge: 'holds reply' }, { ...ben, status: 'ok', badge: 'question, then reply' }, { ...cara, sub: 'replies', chips: [{ text: 'reply deps: [q1]', tone: 'good' }] }],
        links: [link('cara', 'repB', { style: 'faint' }), link('repB', 'repA', { style: 'dashed' }), link('repC', 'repA', { style: 'dashed' }), link('ben', 'repA')],
        flows: [
          { path: ['repB', 'repA'], tone: 'data', label: 'reply (needs q1)', duration: 0.9 },
          { path: ['repC', 'repA'], tone: 'data', label: 'q1', duration: 1.6, delay: 1.2 },
          { path: ['repA', 'ben'], tone: 'response', label: 'q1, then reply', duration: 1, delay: 3 },
        ],
        panel: {
          title: 'Replica A decides',
          icon: 'Code',
          code: 'reply#2 deps=[q#1]\nA has: reply#2\nA needs: q#1\n -> hold reply#2\nq#1 arrives\n -> show q#1\n -> show reply#2',
        },
        caption: 'The reply waits in a drawer until its question arrives',
      },
    },
    {
      title: 'Recap 1',
      tag: 'recap',
      heading: 'Part 1: the bottom of the ladder',
      eli5: 'Old hallway boards are fine for lunch menus. Ana wants her own notice to show, Ben wants no vanishing, and "Me!" should never beat the question.',
      body: [
        '**Eventual** allows everything until replicas converge, and conflicts need a rule. **Read-your-writes** stops your own edits vanishing. **Monotonic reads** stop time running backwards. **Monotonic writes** keep your edits in order. **Causal** keeps causes before effects, and can still answer during a partition.',
        'Part 2 climbs the top rungs: sequential, linearizable, quorums, and what real databases offer.',
      ],
      keyIdea: 'The lower rungs are cheap and stay available. Name the anomaly you cannot tolerate and buy only that.',
      metrics: { model: 'eventual to causal', anomaly: 'removed one by one', latency: '2 ms local', avail: 'yes' },
      metricTones: { latency: 'good', avail: 'good' },
      scene: {
        nodes: [{ ...ana, status: 'ok' }, { ...leader, status: 'ok' }, { ...repA, status: 'ok' }, { ...repB, status: 'ok', sub: 'caught up' }, { ...ben, status: 'ok' }],
        links: [link('ana', 'leader'), link('leader', 'repA', { style: 'dashed' }), link('leader', 'repB', { style: 'dashed' }), link('ben', 'repA')],
        flows: [
          { path: ['ana', 'leader'], tone: 'request', duration: 1 },
          { path: ['leader', 'repA'], tone: 'data', duration: 0.9, delay: 1.1 },
          { path: ['leader', 'repB'], tone: 'data', duration: 1.1, delay: 1.1 },
          { path: ['repA', 'ben'], tone: 'response', duration: 0.9, delay: 2.3 },
        ],
        panel: {
          title: 'Anomaly, then fix',
          icon: 'Layers',
          rows: [
            { text: 'Own edit missing', value: 'read-your-writes', tone: 'good' },
            { text: 'Value vanishes', value: 'monotonic reads', tone: 'good' },
            { text: 'Edits swap', value: 'monotonic writes', tone: 'good' },
            { text: 'Reply before question', value: 'causal', tone: 'good' },
          ],
        },
      },
      quiz: {
        question: 'Ana edits her profile photo and her next page load shows the old photo, served by a lagging replica. Which cheap guarantee fixes exactly this?',
        options: ['Read-your-writes', 'Linearizability', 'Eventual consistency', 'Monotonic writes'],
        answer: 0,
        explain: 'Ana is missing her own write. Read-your-writes routes her reads to a copy that has it. Linearizability would also work but costs far more than needed.',
      },
    },
  ],
};
