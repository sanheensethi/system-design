import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const userUs: SceneNode = { id: 'userUs', kind: 'phone', at: at(-5.4, -4.5), label: 'user', sub: 'New York' };
const leaderUs: SceneNode = { id: 'leaderUs', kind: 'db', at: at(-5.4, 4.5), label: 'leader US', sub: 'us-east' };
const leaderEu: SceneNode = { id: 'leaderEu', kind: 'db', at: at(1.8, 4.5), label: 'leader EU', sub: 'eu-west' };
const userEu: SceneNode = { id: 'userEu', kind: 'phone', at: at(1.8, -4.5), label: 'user', sub: 'Berlin' };

const client: SceneNode = { id: 'client', kind: 'phone', at: at(-7.2, -4.5), label: 'client' };
const coord: SceneNode = { id: 'coord', kind: 'server', at: at(-3.6, -4.5), label: 'coordinator', sub: 'any node can be one' };
const nA: SceneNode = { id: 'nA', kind: 'replica', at: at(-5.4, 4.5), label: 'node A' };
const nB: SceneNode = { id: 'nB', kind: 'replica', at: at(-1.8, 4.5), label: 'node B' };
const nC: SceneNode = { id: 'nC', kind: 'replica', at: at(1.8, 4.5), label: 'node C' };

const fanOut = (extra: Partial<SceneLink> = {}) => [link('coord', 'nA', extra), link('coord', 'nB', extra), link('coord', 'nC', extra)];

export const replicationPart2: Lesson = {
  id: 'replication-part-2',
  title: 'Replication (part 2)',
  tagline: 'Writable copies in every region, conflicts, and leaderless quorums.',
  minutes: 14,
  level: 'Intermediate',
  learn: [
    'Multi-leader setups and the write conflicts they create',
    'Resolving conflicts: last write wins, merge rules and version vectors',
    'Leaderless quorums (R + W > N) and how stale nodes get repaired',
    'Hinted handoff, sloppy quorums, and when to choose which topology',
  ],
  metrics: [
    { key: 'writers', label: 'Writers', icon: 'Copy' },
    { key: 'commit', label: 'Write latency', icon: 'Timer' },
    { key: 'lag', label: 'Sync delay', icon: 'Clock' },
    { key: 'conflicts', label: 'Conflicts', icon: 'Shield' },
  ],
  steps: [
    {
      title: 'Multi-leader',
      tag: 'concept',
      heading: 'A writable primary in every region',
      eli5: 'Two libraries far apart each keep a main book of their own, so nobody waits for pages to cross the ocean. That is **multi-leader**. Each library copies the other\'s new pages later.',
      body: [
        'With one primary in Virginia, a user in Berlin pays a cross-Atlantic round trip on every write. **Multi-leader** puts a leader in each region.',
        'Writes commit locally in 2 ms. The leaders replicate to each other asynchronously, about 80 ms behind.',
      ],
      keyIdea: 'Multi-leader makes writes local and fast in every region, and the regions sync afterwards.',
      metrics: { writers: '2 leaders', commit: '2 ms local', lag: '80 ms cross-region', conflicts: 'possible' },
      metricTones: { commit: 'good' },
      scene: {
        nodes: [userUs, { ...leaderUs, status: 'active' }, { ...leaderEu, status: 'active' }, userEu],
        links: [
          link('userUs', 'leaderUs', { label: '2 ms' }),
          link('userEu', 'leaderEu', { label: '2 ms' }),
          link('leaderUs', 'leaderEu', { style: 'dashed', arrow: 'both', label: '~80 ms', labelTone: 'warn' }),
        ],
        flows: [
          { path: ['userUs', 'leaderUs'], tone: 'request', label: 'add shoes', duration: 1 },
          { path: ['userEu', 'leaderEu'], tone: 'request', label: 'add socks', duration: 1 },
          { path: ['leaderUs', 'leaderEu'], tone: 'data', duration: 1.6, delay: 1.1 },
          { path: ['leaderEu', 'leaderUs'], tone: 'data', duration: 1.6, delay: 1.1 },
        ],
        panel: {
          title: 'Berlin user writes',
          icon: 'Timer',
          rows: [
            { text: 'Single primary in Virginia', value: '~90 ms', tone: 'bad' },
            { text: 'Local leader in Frankfurt', value: '2 ms', tone: 'good' },
          ],
        },
      },
    },
    {
      title: 'Conflicts',
      tag: 'case',
      heading: 'Case: two regions edit the same cart',
      eli5: 'Both libraries write on the same page at the same time. When they swap books, each finds a different story on that page. Someone has to pick which one stays.',
      body: [
        'Two users edit the same cart in both regions within that 80 ms window. Each leader accepted its edit. When they replicate, each sees a **write conflict**.',
        'Neither write was wrong. The system just has two valid histories and needs a rule to join them.',
      ],
      keyIdea: 'Multi-leader gives you concurrent writes, so conflicts are normal and need a plan.',
      metrics: { writers: '2 leaders', commit: '2 ms local', lag: '80 ms cross-region', conflicts: '1 on cart 7' },
      metricTones: { conflicts: 'bad' },
      scene: {
        nodes: [
          { ...leaderUs, status: 'hot', chips: [{ text: 'cart 7: shoes', tone: 'warn' }] },
          { ...leaderEu, status: 'hot', chips: [{ text: 'cart 7: socks', tone: 'warn' }] },
        ],
        links: [link('leaderUs', 'leaderEu', { style: 'dashed', arrow: 'both', label: 'both edits cross', labelTone: 'warn' })],
        flows: [
          { path: ['leaderUs', 'leaderEu'], tone: 'error', label: 'cart 7: shoes', duration: 1.6 },
          { path: ['leaderEu', 'leaderUs'], tone: 'error', label: 'cart 7: socks', duration: 1.6 },
        ],
        panel: {
          title: 'Same cart, two edits',
          icon: 'Table',
          rows: [
            { text: 'us-east, t = 0 ms', value: '+ shoes' },
            { text: 'eu-west, t = 30 ms', value: '+ socks' },
            { text: 'Merged cart', value: '?', tone: 'bad' },
          ],
        },
      },
    },
    {
      title: 'Resolving',
      tag: 'tradeoff',
      heading: 'Three ways to settle a conflict',
      eli5: 'Pick the page written last and throw away the other. Or glue both stories together. Or ask a person which one to keep. Each way has a price.',
      body: [
        '**Last write wins** keeps the edit with the newest timestamp and silently drops the other. It is simple and loses data. Clocks across regions also disagree.',
        'A **merge rule** such as "union of cart items" keeps both. **Application code** can decide, or ask the user. Use it for anything money-like.',
      ],
      keyIdea: 'Last write wins is easy and lossy. Merging keeps data and takes real design work.',
      metrics: { writers: '2 leaders', commit: '2 ms local', lag: '80 ms cross-region', conflicts: 'resolved by rule' },
      metricTones: { conflicts: 'warn' },
      scene: {
        nodes: [
          { ...leaderUs, status: 'ok' },
          { ...leaderEu, status: 'ok' },
          { id: 'rule', kind: 'block', at: at(-1.8, -4.5), label: 'resolver', sub: 'LWW or merge', icon: 'Split', tint: 'violet' },
        ],
        links: [link('leaderUs', 'rule', { style: 'dashed' }), link('leaderEu', 'rule', { style: 'dashed' })],
        flows: [
          { path: ['leaderUs', 'rule'], tone: 'data', label: '+ shoes', duration: 1.4 },
          { path: ['leaderEu', 'rule'], tone: 'data', label: '+ socks', duration: 1.4 },
        ],
        panel: {
          title: 'What each rule keeps',
          icon: 'List',
          rows: [
            { text: 'Last write wins', value: 'socks only', tone: 'bad' },
            { text: 'Merge (union)', value: 'shoes + socks', tone: 'good' },
            { text: 'App code or user', value: 'custom', tone: 'warn' },
          ],
        },
      },
    },
    {
      title: 'When to use',
      tag: 'tradeoff',
      heading: 'Multi-leader: when it pays off',
      eli5: 'Two libraries are worth it only if the kids on each side really cannot wait for pages to cross the ocean. Otherwise one main book is much easier to keep tidy.',
      body: [
        'Use it for local writes in several regions, or for offline clients (a phone that edits a doc, then syncs). Each device acts as a leader.',
        'Avoid it when one primary is fast enough. Conflict handling is easy to get subtly wrong, and bugs show up months later as vanished data.',
      ],
      keyIdea: 'Multi-leader makes writes local everywhere and makes conflicts your problem.',
      metrics: { writers: '2 leaders', commit: '2 ms local', lag: '80 ms cross-region', conflicts: 'your problem' },
      scene: {
        nodes: [userUs, { ...leaderUs, status: 'active' }, { ...leaderEu, status: 'active' }],
        links: [link('userUs', 'leaderUs'), link('leaderUs', 'leaderEu', { style: 'dashed', arrow: 'both', label: 'async', labelTone: 'warn' })],
        flows: [{ path: ['userUs', 'leaderUs'], tone: 'request', label: 'edit', duration: 1.2 }],
        panel: {
          title: 'Fit check',
          icon: 'Scale',
          rows: [
            { text: 'Users in many regions', value: 'good fit', tone: 'good' },
            { text: 'Offline-first apps', value: 'good fit', tone: 'good' },
            { text: 'One region is enough', value: 'avoid', tone: 'bad' },
          ],
        },
      },
    },
    {
      title: 'Leaderless',
      tag: 'concept',
      heading: 'Leaderless: write to W nodes, read from R',
      eli5: 'No main book here, only three copies: A, B and C. A new page counts as saved once two copies have it, and readers always check two copies.',
      body: [
        'Dynamo-style stores (Cassandra, DynamoDB, Riak) have no leader. Each key lives on **N** replicas. A write goes to all of them and succeeds once **W** confirm.',
        'A read asks **R** replicas and keeps the newest version by version (timestamp or version vector). Any node can act as the coordinator for a request.',
      ],
      keyIdea: 'Leaderless stores replace the leader with N copies, a write count W and a read count R.',
      metrics: { writers: 'any node', commit: 'W = 2 acks', lag: 'C is behind', conflicts: 'by version' },
      scene: {
        nodes: [client, { ...coord, status: 'active' }, { ...nA, status: 'ok', badge: 'v2' }, { ...nB, status: 'ok', badge: 'v2' }, { ...nC, badge: 'v1 (missed)' }],
        links: [link('client', 'coord'), ...fanOut()],
        flows: [
          { path: ['coord', 'nA'], tone: 'request', label: 'write v2', duration: 1 },
          { path: ['coord', 'nB'], tone: 'request', duration: 1 },
          { path: ['nA', 'coord'], tone: 'response', label: 'ack', duration: 1, delay: 1.1 },
          { path: ['nB', 'coord'], tone: 'response', label: 'ack', duration: 1, delay: 1.1 },
        ],
        panel: {
          title: 'N = 3, W = 2',
          icon: 'Copy',
          rows: [
            { text: 'Sent to', value: '3 nodes' },
            { text: 'Acks needed', value: '2' },
            { text: 'Node C', value: 'missed it', tone: 'warn' },
          ],
        },
      },
    },
    {
      title: 'Quorum overlap',
      tag: 'concept',
      heading: 'R + W > N guarantees overlap',
      eli5: 'If two helpers must have the new page and you always ask two helpers, at least one you ask is a helper that has it. That overlap is the **quorum** trick.',
      body: [
        'If **R + W > N**, every read set overlaps every write set in at least one node, so a read always reaches someone with the latest value.',
        'With N = 3, W = 2, R = 2: node C missed the write, but any 2 nodes you read include A or B. Concurrent writes to the same key still conflict, handled by version vectors later.',
      ],
      keyIdea: 'Quorums replace a leader with overlap. As long as R + W > N, some node in every read has the latest write.',
      metrics: { writers: 'any node', commit: 'W = 2 acks', lag: 'C is behind', conflicts: 'stale reads: none if R + W > N' },
      metricTones: { conflicts: 'good' },
      scene: {
        nodes: [{ ...coord, status: 'active' }, { ...nA, badge: 'v2' }, { ...nB, status: 'ok', badge: 'v2' }, { ...nC, badge: 'v1 (stale)' }],
        links: [link('coord', 'nB'), link('coord', 'nC')],
        flows: [
          { path: ['coord', 'nB'], tone: 'request', label: 'read', duration: 1 },
          { path: ['coord', 'nC'], tone: 'request', duration: 1 },
          { path: ['nB', 'coord'], tone: 'response', label: 'v2 wins', duration: 1, delay: 1.1 },
          { path: ['nC', 'coord'], tone: 'response', label: 'v1', duration: 1, delay: 1.1 },
        ],
        panel: {
          title: 'The overlap rule',
          icon: 'Scale',
          rows: [
            { text: 'N = 3, W = 2, R = 2', value: '2 + 2 > 3', tone: 'good' },
            { text: 'Wrote to', value: 'A, B' },
            { text: 'Read from', value: 'B, C (B is shared)' },
          ],
        },
      },
      quiz: {
        question: 'With N = 3 and W = 1, what R makes a read always see the latest write?',
        options: ['1', '2', '3', 'No R works'],
        answer: 2,
        explain: 'You need R + W > N, so R + 1 > 3 and R must be 3. Reading all three nodes is the only way to be sure one has the write.',
      },
    },
    {
      title: 'Tuning',
      tag: 'tradeoff',
      heading: 'Tune W and R to the workload',
      eli5: 'If saving a page is quick (one helper), reading must check every helper. If saving is slow (everyone), reading can ask just one. You choose where the work goes.',
      body: [
        '**W = 1, R = 3** makes writes fast and reads slow. **W = 3, R = 1** is the reverse, but one down node blocks all writes.',
        '**W = 2, R = 2** balances both and tolerates one down node. If fewer than W or R nodes respond, the request fails: you trade availability for consistency.',
      ],
      keyIdea: 'W and R move the cost between reads and writes. Too strict and a single failure blocks requests.',
      metrics: { writers: 'any node', commit: 'W = 2 acks', lag: 'tunable', conflicts: 'R + W > N' },
      scene: {
        nodes: [{ ...coord, status: 'active' }, { ...nA, status: 'ok' }, { ...nB, status: 'ok' }, { ...nC, status: 'down', badge: 'down' }],
        links: [link('coord', 'nA'), link('coord', 'nB'), link('coord', 'nC', { style: 'faint' })],
        flows: [
          { path: ['coord', 'nA'], tone: 'request', label: 'write', duration: 1 },
          { path: ['coord', 'nB'], tone: 'request', duration: 1 },
          { path: ['nA', 'coord'], tone: 'response', label: 'ack', duration: 1, delay: 1.1 },
          { path: ['nB', 'coord'], tone: 'response', label: 'ack', duration: 1, delay: 1.1 },
        ],
        panel: {
          title: 'N = 3 choices',
          icon: 'Table',
          rows: [
            { text: 'W = 1, R = 3', value: 'fast writes', tone: 'good' },
            { text: 'W = 3, R = 1', value: 'fast reads, 1 down blocks writes', tone: 'warn' },
            { text: 'W = 2, R = 2', value: 'balanced', tone: 'good' },
          ],
        },
      },
    },
    {
      title: 'Read repair',
      tag: 'concept',
      heading: 'Stale nodes get fixed on read and in the background',
      eli5: 'When a reader notices one copy has an old page, the reader fixes that copy right away. At night, helpers also compare their copies and fill in anything missing.',
      body: [
        '**Read repair**: the coordinator sees node C returned v1 while B returned v2, so it writes v2 back to C. Hot keys heal quickly.',
        '**Anti-entropy** is a background process that compares replicas (often with Merkle trees) and copies missing data. It fixes keys nobody reads.',
      ],
      keyIdea: 'Reads heal hot keys and a background scan heals the rest, so stale copies converge.',
      metrics: { writers: 'any node', commit: 'W = 2 acks', lag: 'C repairing', conflicts: '0' },
      scene: {
        nodes: [{ ...coord, status: 'active' }, { ...nB, status: 'ok', badge: 'v2' }, { ...nC, status: 'active', badge: 'v1 to v2' }],
        links: [link('coord', 'nB'), link('coord', 'nC')],
        flows: [
          { path: ['nB', 'coord'], tone: 'response', label: 'v2', duration: 1 },
          { path: ['nC', 'coord'], tone: 'response', label: 'v1', duration: 1 },
          { path: ['coord', 'nC'], tone: 'data', label: 'read repair: v2', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Two repair paths',
          icon: 'List',
          rows: [
            { text: 'Read repair', value: 'on a read, hot keys', tone: 'good' },
            { text: 'Anti-entropy', value: 'background, all keys', tone: 'good' },
          ],
        },
      },
    },
    {
      title: 'Hinted handoff',
      tag: 'concept',
      heading: 'When a node is down: sloppy quorum and hints',
      eli5: 'A helper is out sick. Another helper holds the new page with a sticky note, "give this to the sick helper when she is back". The page is not lost.',
      body: [
        'If a key\'s home node is down, a **sloppy quorum** accepts the write on another healthy node. That node keeps a **hint** and hands the data over when the home node returns.',
        'Writes stay available during failures. The catch: a read quorum may not include the hint holder, so R + W > N no longer guarantees freshness until the hint is delivered.',
      ],
      keyIdea: 'Sloppy quorums and hinted handoff keep writes available, and weaken the freshness guarantee until the hint lands.',
      metrics: { writers: 'any node', commit: 'W = 2 acks', lag: 'C down, hint held', conflicts: 'weaker guarantee' },
      metricTones: { conflicts: 'warn' },
      scene: {
        nodes: [{ ...coord, status: 'active' }, { ...nB, status: 'ok', chips: [{ text: 'hint for C: v2', tone: 'warn' }] }, { ...nC, status: 'down', badge: 'down' }],
        links: [link('coord', 'nB'), link('coord', 'nC', { style: 'faint' }), link('nB', 'nC', { style: 'dashed', label: 'later', route: 'straight' })],
        flows: [
          { path: ['coord', 'nB'], tone: 'request', label: 'write v2 (hint)', duration: 1.2 },
          { path: ['nB', 'nC'], tone: 'data', label: 'handoff when C is back', duration: 1.6, delay: 1.5 },
        ],
        panel: {
          title: 'Availability vs freshness',
          icon: 'Scale',
          rows: [
            { text: 'Writes during outage', value: 'still accepted', tone: 'good' },
            { text: 'R + W > N overlap', value: 'not guaranteed', tone: 'warn' },
          ],
        },
      },
    },
    {
      title: 'Version vectors',
      tag: 'concept',
      heading: 'Detect true conflicts with version vectors',
      eli5: 'Each helper keeps a tally of how many pages each helper has written. Comparing two tallies shows whether one copy is simply newer, or whether both have pages the other lacks.',
      body: [
        'A **version vector** stores a counter per replica with each value. If every counter in X is at most the counter in Y, then Y is newer and X can be dropped.',
        'If each has a counter the other lacks (`[A:2, B:1]` vs `[A:1, B:2]`), the writes were concurrent. Keep both as **siblings** and merge them. Cassandra uses last-write-wins timestamps and can drop edits. Dynamo-style stores with vectors keep siblings.',
      ],
      keyIdea: 'Version vectors separate stale data from concurrent writes, so you never drop an edit by accident.',
      metrics: { writers: 'any node', commit: 'W = 2 acks', lag: '-', conflicts: 'siblings kept' },
      scene: {
        nodes: [{ ...nA, chips: [{ text: '[A:2, B:1]', tone: 'warn' }] }, { ...nB, chips: [{ text: '[A:1, B:2]', tone: 'warn' }] }, { ...coord, label: 'client', sub: 'merges siblings', status: 'active' }],
        links: [link('coord', 'nA'), link('coord', 'nB')],
        flows: [
          { path: ['nA', 'coord'], tone: 'response', label: '[A:2, B:1]', duration: 1.4 },
          { path: ['nB', 'coord'], tone: 'response', label: '[A:1, B:2]', duration: 1.4 },
        ],
        panel: {
          title: 'Comparing two vectors',
          icon: 'Table',
          rows: [
            { text: '[A:1] vs [A:2]', value: 'second is newer', tone: 'good' },
            { text: '[A:2, B:1] vs [A:1, B:2]', value: 'concurrent', tone: 'warn' },
          ],
          footer: { text: 'Concurrent: keep both, then merge', tone: 'muted' },
        },
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Pick the topology by what you can tolerate',
      eli5: 'One main book is easy to keep tidy. Two libraries save travel but argue about pages. Three equal copies need a vote for every page. Choose the one whose trouble you can live with.',
      body: [
        'Multi-leader trades conflicts for local writes. Resolve with merge rules or app code, and detect true conflicts with version vectors.',
        'Leaderless stores use **R + W > N**, repair stale nodes by read repair and anti-entropy, and keep writes available with hinted handoff.',
      ],
      keyIdea: 'Every topology moves the cost somewhere: single-leader to failover, multi-leader to conflicts, leaderless to quorum tuning.',
      metrics: { writers: 'varies', commit: '2 ms local', lag: '80 ms', conflicts: 'by design' },
      scene: {
        nodes: [{ ...coord, status: 'ok' }, { ...nA, status: 'ok' }, { ...nB, status: 'ok' }, { ...nC, status: 'ok' }],
        links: fanOut(),
        flows: [
          { path: ['coord', 'nA'], tone: 'request', label: 'write', duration: 1.2 },
          { path: ['coord', 'nB'], tone: 'request', duration: 1.2 },
          { path: ['coord', 'nC'], tone: 'request', duration: 1.2 },
        ],
        panel: {
          title: 'Choosing a topology',
          icon: 'List',
          code: 'topology      write      conflicts  on failure\nsingle        1 leader   none       failover\n  Postgres, MySQL\nmulti-leader  local      resolve    other region\n  CouchDB, Aurora Global\nleaderless    W acks     versions   quorum\n  Cassandra, DynamoDB',
          footer: { text: 'Raft-style groups are single-leader backed by a quorum', tone: 'muted' },
        },
      },
      quiz: {
        question: 'A leaderless store keeps N = 5 copies of each key and writes wait for W = 3 acks. What is the smallest R that still guarantees a read sees the latest write?',
        options: ['1', '2', '3', '5'],
        answer: 2,
        explain: 'You need R + W > N, so R + 3 > 5 and R must be at least 3. With R = 2 the 2 nodes you read could both be among the 2 that missed the write.',
      },
    },
  ],
};
