import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const user: SceneNode = { id: 'user', kind: 'client', at: at(-3.8, -3.4), label: 'shopper', sub: '200 searches/s' };
const coord: SceneNode = { id: 'coord', kind: 'block', at: at(0, -3.4), label: 'coordinator', sub: 'search API', icon: 'Search', tint: 'violet' };
const db: SceneNode = { id: 'db', kind: 'db', at: at(3.8, -3.4), label: 'Postgres', sub: 'source of truth' };
const s0: SceneNode = { id: 's0', kind: 'shard', at: at(-4.4, 3.4), label: 'shard 0', sub: '8M docs' };
const s1: SceneNode = { id: 's1', kind: 'shard', at: at(0, 3.4), label: 'shard 1', sub: '8M docs' };
const s2: SceneNode = { id: 's2', kind: 'shard', at: at(4.4, 3.4), label: 'shard 2', sub: '8M docs' };
const shards = [s0, s1, s2];
const fan = (extra: Partial<SceneLink> = {}) => [link('coord', 's0', extra), link('coord', 's1', extra), link('coord', 's2', extra)];
const changes: SceneNode = { id: 'changes', kind: 'queue', at: at(-1.8, 0), label: 'change log', sub: 'CDC stream' };
const indexer: SceneNode = { id: 'indexer', kind: 'block', size: 0.8, at: at(1.8, 0), label: 'indexer', icon: 'Workflow', tint: 'amber' };
const index: SceneNode = { id: 'index', kind: 'search', at: at(5.4, 0), label: 'search index' };

export const searchIndexPart2: Lesson = {
  id: 'search-index-part-2',
  title: 'Search index (part 2)',
  tagline: 'Scale the index with shards and replicas, keep it fresh and in sync with the database, then add facets, autocomplete and typo tolerance.',
  minutes: 15,
  level: 'Intermediate',
  learn: [
    'Shards, replicas and scatter-gather queries',
    'Segments, refresh and why search is near real time',
    'Keeping the index in sync with the database, and reindexing safely',
    'Facets, autocomplete and typo tolerance',
    'When a search cluster is worth running',
  ],
  metrics: [
    { key: 'lat', label: 'Search latency', icon: 'Timer' },
    { key: 'work', label: 'Work per query', icon: 'Table' },
    { key: 'qps', label: 'Search capacity', icon: 'Gauge' },
    { key: 'lag', label: 'Index lag', icon: 'Clock' },
  ],
  steps: [
    {
      title: 'Shards',
      tag: 'concept',
      heading: 'Split the index into shards',
      eli5: 'The card box got too big for one helper, so it was split into three boxes with a helper at each. Each box is a **shard**.',
      body: [
        'One machine holds the whole index until the index outgrows its memory or one CPU cannot keep up. Then the index is split into **shards**.',
        'Each document is routed to one shard by a hash of its ID, and each shard is a complete inverted index over its 8 million documents.',
        'Pick the shard count up front. Because routing is hash mod N, changing N moves almost every document, so resharding means a reindex. Too many tiny shards waste memory and add merge work.',
      ],
      keyIdea: 'A shard is a full inverted index over a slice of the documents.',
      metrics: { lat: '30 ms', work: '24M docs', qps: '100/s', lag: '-' },
      scene: {
        nodes: [coord, ...shards.map((s) => ({ ...s, status: 'active' as const }))],
        links: fan(),
        flows: [{ path: ['coord', 's1'], tone: 'data', label: 'hash(doc id) = 1', duration: 1.6 }],
        panel: {
          title: 'Routing by hash',
          icon: 'Hash',
          rows: [
            { text: 'doc 8', value: 'shard 2' },
            { text: 'doc 21', value: 'shard 0' },
            { text: 'doc 42', value: 'shard 1' },
          ],
          footer: { text: 'shard = hash(id) mod 3', tone: 'muted' },
        },
        caption: 'Each document lives on one shard',
      },
    },
    {
      title: 'Scatter-gather',
      tag: 'concept',
      heading: 'Every query goes to every shard',
      eli5: 'A term can be in any box, so the librarian asks all three helpers at once. Each brings back their best books, and the librarian picks the best of those.',
      body: [
        'A term can live in any shard, so a query goes to all of them. In **scatter-gather** a coordinator sends the query to every shard in parallel, and each returns its own top 10 with scores.',
        'The coordinator merges 30 candidates into the final 10. The response is as slow as the slowest shard.',
        'Each shard scores with its own term statistics, so IDF and scores can differ slightly between shards.',
      ],
      keyIdea: 'Scatter to all shards, gather their top results, merge. Latency is the slowest shard.',
      metrics: { lat: '35 ms', work: '3 shards in parallel', qps: '100/s', lag: '-' },
      scene: {
        nodes: [{ ...coord, status: 'active', badge: 'merge 3 x top 10' }, ...shards.map((s) => ({ ...s, status: 'active' as const }))],
        links: fan(),
        flows: [
          { path: ['coord', 's0'], tone: 'request', label: 'query', duration: 0.9 },
          { path: ['coord', 's1'], tone: 'request', duration: 0.9 },
          { path: ['coord', 's2'], tone: 'request', duration: 0.9 },
          { path: ['s0', 'coord'], tone: 'response', label: 'top 10', duration: 0.9, delay: 1.2 },
          { path: ['s1', 'coord'], tone: 'response', duration: 0.9, delay: 1.2 },
          { path: ['s2', 'coord'], tone: 'response', duration: 1.5, delay: 1.2 },
        ],
        caption: 'Scatter to every shard, gather and merge',
      },
    },
    {
      title: 'Deep paging',
      tag: 'tradeoff',
      heading: 'Deep pages cost more than the first page',
      eli5: 'Asking for books 991 to 1000 means every helper must first find their best thousand, so the librarian can sort them all and skip the first 990.',
      body: [
        'To serve page 100 (hits 991 to 1000), each shard must return its top 1,000, and the coordinator sorts 3,000 candidates to throw 2,990 away.',
        'Cost grows with page depth, so engines cap it. Use a cursor such as `search_after` for scrolling, and send people to filters instead of page 100.',
      ],
      keyIdea: 'Offset paging makes every shard do work proportional to the page number.',
      metrics: { lat: '35 ms to 400 ms', work: '3,000 candidates', qps: '100/s', lag: '-' },
      metricTones: { lat: 'warn', work: 'bad' },
      scene: {
        nodes: [{ ...coord, status: 'hot', load: 85, chips: ['page 100'] }, ...shards.map((s) => ({ ...s, status: 'hot' as const, badge: 'return 1,000' }))],
        links: fan({ label: 'from 0 to 1000', labelTone: 'warn' }),
        flows: [{ path: ['s1', 'coord'], tone: 'response', label: '1,000 hits', count: 3, duration: 1.6 }],
        panel: {
          title: 'Cost by page',
          icon: 'Table',
          rows: [
            { text: 'Page 1', value: '30 candidates', tone: 'good' },
            { text: 'Page 10', value: '300 candidates' },
            { text: 'Page 100', value: '3,000 candidates', tone: 'bad' },
          ],
        },
        caption: 'The deeper the page, the heavier the merge',
      },
    },
    {
      title: 'Replicas',
      tag: 'concept',
      heading: 'Replicas add capacity and survive a failure',
      eli5: 'Each helper gets a twin with an identical card box. Either twin can answer, so more kids get served, and if one twin goes home sick the other keeps going.',
      body: [
        'Each shard also has **replicas** on other machines. A replica can answer searches, so copies add search capacity. When a machine dies, a replica takes over its shard.',
        'Three shards with one replica each are six nodes that serve about 200 searches per second. Writes go to the primary shard and are copied to its replicas.',
      ],
      keyIdea: 'Shards split the data. Replicas copy each shard for throughput and failover.',
      metrics: { lat: '35 ms', work: '3 shards in parallel', qps: '200/s', lag: '-' },
      metricTones: { qps: 'good' },
      scene: {
        nodes: [
          coord,
          { ...s1, status: 'active', badge: 'primary' },
          { id: 'r1', kind: 'replica', at: at(4.4, 3.4), label: 'replica 1', sub: 'copy of shard 1', status: 'ok' },
        ],
        links: [link('coord', 's1'), link('coord', 'r1'), link('s1', 'r1', { style: 'dashed', label: 'copy', arrow: 'end' })],
        flows: [
          { path: ['coord', 's1', 'coord'], tone: 'request', label: 'search', duration: 1.6 },
          { path: ['coord', 'r1', 'coord'], tone: 'request', label: 'search', duration: 1.6, delay: 0.8 },
          { path: ['s1', 'r1'], tone: 'data', label: 'new docs', duration: 1.4, delay: 2 },
        ],
        caption: 'Either copy answers a search',
      },
      quiz: {
        question: 'An index has 5 shards. One shard is slow because its machine is overloaded. What happens to a typical search?',
        options: ['Only that shard slows down, the rest are unaffected', 'The whole search is as slow as that shard, because every shard must answer', 'The coordinator skips the slow shard automatically with no loss of results', 'Search latency is the average of the five shards'],
        answer: 1,
        explain: 'Scatter-gather waits for every shard, so the slowest one sets the latency. Replicas and timeouts help, but skipping a shard means losing results.',
      },
    },
    {
      title: 'Segments',
      tag: 'concept',
      heading: 'Writes go into small immutable segments',
      eli5: 'New books are not squeezed into the big card box. The helper keeps a small new card box on the side, and once it is done, never changes it again.',
      body: [
        'Inside a shard, the index is made of **segments**: small, immutable inverted indexes. New documents are buffered in memory, then a **refresh** writes them out as a new segment.',
        'A search checks every segment and merges the results, like a tiny scatter-gather inside the shard. Immutable files are easy to cache and never need locks.',
      ],
      keyIdea: 'A shard is a pile of immutable segments, not one file that gets edited.',
      metrics: { lat: '35 ms', work: '3 shards in parallel', qps: '200/s', lag: '1 s' },
      scene: {
        nodes: [
          { id: 'buffer', kind: 'block', size: 0.8, at: at(-3.8, -3.4), label: 'memory buffer', sub: 'new docs', icon: 'Inbox', tint: 'amber', status: 'active' },
          { id: 'seg1', kind: 'block', size: 0.72, at: at(-3.8, 3.4), label: 'segment 1', sub: '5M docs', icon: 'Layers', tint: 'blue' },
          { id: 'seg2', kind: 'block', size: 0.72, at: at(0, 3.4), label: 'segment 2', sub: '2M docs', icon: 'Layers', tint: 'blue' },
          { id: 'seg3', kind: 'block', size: 0.72, at: at(3.8, 3.4), label: 'segment 3', sub: 'new, 1K docs', icon: 'Layers', tint: 'green', status: 'ok' },
        ],
        links: [link('buffer', 'seg3', { label: 'refresh', style: 'dashed' })],
        flows: [{ path: ['buffer', 'seg3'], tone: 'data', label: 'refresh: write segment', duration: 1.8 }],
        caption: 'New segment on every refresh',
      },
    },
    {
      title: 'Near real time',
      tag: 'concept',
      heading: 'A refresh makes new documents searchable, about once a second',
      eli5: 'A new card is not shown to kids until the helper presses a little bell. The bell rings about once a second, so new books appear almost, not quite, right away.',
      body: [
        'A new document is not searchable until a **refresh** opens a new segment for reads. Elasticsearch does this about once per second by default, which is why search is **near real time**.',
        'Refreshing less often makes bulk loads faster. A transaction log keeps the data in memory safe. A **flush** is the later, durable commit that lets the log be trimmed.',
      ],
      keyIdea: 'Search sees writes after the next refresh, not instantly.',
      metrics: { lat: '35 ms', work: '3 shards in parallel', qps: '200/s', lag: '~1 s' },
      metricTones: { lag: 'warn' },
      scene: {
        nodes: [{ ...coord, chips: ['index doc 42'] }, { ...s1, status: 'active', chips: [{ text: 'in buffer', tone: 'warn' }] }, { ...user, at: at(3.8, 3.4), chips: ['search: not yet'] }],
        links: [link('coord', 's1'), link('user', 's1', { style: 'faint' })],
        flows: [
          { path: ['coord', 's1'], tone: 'data', label: 'index doc 42', duration: 1.4 },
          { path: ['user', 's1'], tone: 'request', label: 'search', duration: 1.4, delay: 1.5 },
          { path: ['s1', 'user'], tone: 'response', label: 'visible after refresh', duration: 1.4, delay: 3 },
        ],
        panel: {
          title: 'Refresh settings',
          icon: 'Clock',
          rows: [
            { text: 'refresh_interval default', value: '1 s' },
            { text: 'bulk load', value: '30 s or off', tone: 'good' },
          ],
          footer: { text: 'Writes visible after the next refresh', tone: 'warn' },
        },
        caption: 'Written, then visible one refresh later',
      },
    },
    {
      title: 'Merges',
      tag: 'concept',
      heading: 'Deletes are marked, and merges clean up later',
      eli5: 'Segments never change, so removing a book just puts a tiny "removed" sticker on its card. Later the helper copies the cards into a fresh box and leaves the stickered ones out.',
      body: [
        'Immutable segments cannot drop a document in place. A delete writes a **tombstone**, and an update is a delete plus a new document. Deleted documents are hidden from results but still take space.',
        'A background **merge** combines small segments into one bigger segment and leaves tombstoned documents behind. Merging costs disk and CPU, which is part of why search clusters are hungry.',
      ],
      keyIdea: 'Deletes are marked first and reclaimed when segments merge.',
      metrics: { lat: '35 ms', work: '3 shards in parallel', qps: '200/s', lag: '~1 s' },
      scene: {
        nodes: [
          { id: 'seg1', kind: 'block', size: 0.72, at: at(-3.8, 3.4), label: 'segment 1', sub: '5M docs, 40K deleted', icon: 'Layers', tint: 'blue' },
          { id: 'seg2', kind: 'block', size: 0.72, at: at(0, 3.4), label: 'segment 2', sub: '2M docs', icon: 'Layers', tint: 'blue' },
          { id: 'merged', kind: 'block', size: 0.8, at: at(3.8, 3.4), label: 'merged', sub: '6.96M docs', icon: 'Layers', tint: 'green', status: 'ok' },
        ],
        links: [link('seg1', 'merged', { style: 'dashed' }), link('seg2', 'merged', { style: 'dashed' })],
        flows: [{ path: ['seg1', 'merged'], tone: 'data', label: 'drop tombstoned', duration: 1.8 }, { path: ['seg2', 'merged'], tone: 'data', duration: 1.8, delay: 0.3 }],
        caption: 'Merge into one clean segment',
      },
    },
    {
      title: 'Drift',
      tag: 'case',
      heading: 'Case: the index and the database disagree',
      eli5: 'A new book arrives. The librarian shelves it but forgets to write its cards, so nobody can find it. The shelves and the card box now disagree, and that gap is called **drift**.',
      body: [
        'The index is a second copy of data that lives in Postgres. The quick way to feed it is a **dual write**: the app updates the database, then calls the search index.',
        'A seller drops a price from $80 to $60. The database commit succeeds. The call to the index times out. Search keeps showing $80, and no later event will fix it.',
      ],
      keyIdea: 'Two independent writes will eventually disagree, and a dual write cannot notice or repair it.',
      metrics: { lat: '35 ms', work: '3 shards in parallel', qps: '200/s', lag: 'never for some docs' },
      metricTones: { lag: 'bad' },
      scene: {
        nodes: [
          { ...user, label: 'seller', sub: 'price $80 to $60' },
          { ...coord, label: 'app', sub: 'dual write', status: 'active' },
          { ...db, status: 'ok', badge: 'price = $60' },
          { ...index, at: at(0, 3.4), status: 'hot', badge: 'still $80' },
        ],
        links: [link('user', 'coord'), link('coord', 'db'), link('coord', 'index', { label: 'timeout', labelTone: 'warn' })],
        flows: [
          { path: ['user', 'coord'], tone: 'request', label: 'PUT price', duration: 1 },
          { path: ['coord', 'db'], tone: 'request', label: 'UPDATE', duration: 1, delay: 1.1 },
          { path: ['coord', 'index'], tone: 'error', label: 'timeout', duration: 1.6, delay: 2.4 },
        ],
        caption: 'The first write landed, the second did not',
      },
    },
    {
      title: 'Drift causes',
      tag: 'case',
      heading: 'Drift piles up quietly',
      eli5: 'Every missed card is rare, but after months the card box is full of mistakes. Nobody notices until a kid cannot find a book that is clearly on the shelf.',
      body: [
        'The same thing happens when the app crashes between the two writes, or when two updates reach the index in opposite order.',
        'Each failure is rare. Over months they pile up into listings that are missing from search, deleted but still shown, or priced wrong. Nobody notices until a customer complains.',
      ],
      keyIdea: 'Drift is silent. Failures that look rare add up to thousands of wrong listings.',
      metrics: { lat: '35 ms', work: '3 shards in parallel', qps: '200/s', lag: 'never for some docs' },
      metricTones: { lag: 'bad' },
      scene: {
        nodes: [{ ...db, status: 'ok' }, { ...index, at: at(0, 3.4), status: 'hot', badge: '0.1% wrong' }, { ...coord, label: 'app', status: 'active' }],
        links: [link('coord', 'db'), link('coord', 'index', { style: 'dashed' })],
        panel: {
          title: 'Six months of dual writes',
          icon: 'Bug',
          rows: [
            { text: 'Missing from search', value: '~9,000 listings', tone: 'bad' },
            { text: 'Deleted but still shown', value: '~4,000', tone: 'bad' },
            { text: 'Wrong price', value: '~11,000', tone: 'bad' },
          ],
          footer: { text: 'About 0.1% of 24M, found by customers', tone: 'bad' },
        },
        caption: 'A few failures a day, for six months',
      },
    },
    {
      title: 'Change log',
      tag: 'concept',
      heading: 'Write once, then feed the index from the change log',
      eli5: 'Now every change is written in a logbook first. A helper reads the logbook in order and writes the cards. That logbook is the **change log**, so no book is ever forgotten.',
      body: [
        'The app writes only to the database. **Change data capture** (CDC) reads the database\'s own log of committed changes and publishes each one to a stream (see the message queues lesson).',
        'An **indexer** consumes the stream and updates the search index. One write, one derived copy.',
      ],
      keyIdea: 'Write to the source of truth and derive the index from its committed changes.',
      metrics: { lat: '35 ms', work: '3 shards in parallel', qps: '200/s', lag: '~2 s' },
      metricTones: { lag: 'good' },
      scene: {
        nodes: [{ ...db, at: at(-5.4, 0), status: 'active', badge: 'only write' }, { ...changes, status: 'active', badge: 'listing 42 v7' }, { ...indexer, status: 'active' }, { ...index, status: 'ok', badge: '$60 · 2 s later' }],
        links: [link('db', 'changes', { style: 'dashed', label: 'CDC' }), link('changes', 'indexer'), link('indexer', 'index')],
        flows: [
          { path: ['db', 'changes'], tone: 'event', label: 'row changed', duration: 1, delay: 0.2 },
          { path: ['changes', 'indexer'], tone: 'event', duration: 1, delay: 1.3 },
          { path: ['indexer', 'index'], tone: 'data', label: 'index doc 42', duration: 1, delay: 2.4 },
        ],
        caption: 'One write, then the change flows to the index',
      },
    },
    {
      title: 'Lag, not drift',
      tag: 'concept',
      heading: 'Failures become lag that heals',
      eli5: 'If the helper is out for lunch, the logbook just waits. When the helper is back, they catch up on every entry in order.',
      body: [
        'If the index is down, changes wait in the stream and the indexer retries. Updates carry the row version, so a late or repeated event cannot overwrite newer data. Deletes carry a version too, as a versioned tombstone, so an out-of-order delete cannot be undone.',
        'The index runs a second or two behind the database. That lag is visible, measurable and self-healing, unlike drift.',
      ],
      keyIdea: 'Retries plus versioned updates turn failures into lag, which heals on its own.',
      metrics: { lat: '35 ms', work: '3 shards in parallel', qps: '200/s', lag: '2 s, then caught up' },
      metricTones: { lag: 'good' },
      scene: {
        nodes: [{ ...changes, status: 'active', badge: '1,200 behind' }, { ...indexer, status: 'active', chips: [{ text: 'retry', tone: 'warn' }, 'v7 over v6'] }, { ...index, status: 'down', badge: 'down' }],
        links: [link('changes', 'indexer'), link('indexer', 'index', { label: 'index down', labelTone: 'warn' })],
        flows: [{ path: ['indexer', 'index'], tone: 'error', label: 'retry', duration: 1.4 }],
        panel: {
          title: 'Index update guard',
          icon: 'Code',
          code: 'PUT /listings/_doc/42\n  ?version=7\n  &version_type=external\n\nv6 and repeat v7: 409 conflict,\nindexer ignores it',
          footer: { text: 'Old events cannot win', tone: 'good' },
        },
        caption: 'Down for a minute, then caught up',
      },
    },
    {
      title: 'Reindex',
      tag: 'concept',
      heading: 'Keep a full reindex ready and swap with an alias',
      eli5: 'If the helper changes how cards are written, the whole card box is rebuilt in a new box next to the old one. Kids use the old box until the new one is ready, then the sign flips.',
      body: [
        'Keep a **full reindex** for analyzer or mapping changes and to repair drift. Build a fresh index from the database, then switch an **alias** to it with no downtime.',
        'Edits keep arriving during the build. Note the change log offset first, bulk-load the snapshot, replay the stream from that offset until lag is near zero, then swap.',
      ],
      keyIdea: 'A full reindex plus an alias swap is how you change an analyzer or repair drift.',
      metrics: { lat: '35 ms', work: '3 shards in parallel', qps: '200/s', lag: '~2 s' },
      scene: {
        nodes: [
          { ...db, status: 'active', badge: 'full scan once' },
          { id: 'old', kind: 'search', at: at(-3.8, 3.4), label: 'listings_v1', sub: 'old analyzer', status: 'dim' },
          { id: 'new', kind: 'search', at: at(0, 3.4), label: 'listings_v2', sub: 'new analyzer', status: 'ok', badge: 'built' },
          { id: 'alias', kind: 'block', size: 0.72, at: at(3.8, 3.4), label: 'alias', sub: 'listings', icon: 'Route', tint: 'violet' },
        ],
        links: [link('db', 'new', { style: 'dashed', label: 'rebuild' }), link('alias', 'new', { label: 'after swap' }), link('alias', 'old', { style: 'faint', label: 'before' })],
        flows: [{ path: ['db', 'new'], tone: 'data', label: 'all 24M docs', duration: 2 }],
        panel: {
          title: 'Catch up before the swap',
          icon: 'List',
          rows: [
            { text: '1. Note change log offset', value: 'before scan' },
            { text: '2. Bulk-load snapshot', value: 'listings_v2' },
            { text: '3. Replay from offset', value: 'until lag ~0', tone: 'good' },
            { text: '4. Swap alias', value: 'listings' },
          ],
        },
        caption: 'Build next to the old index, then flip the alias',
      },
    },
    {
      title: 'Not the truth',
      tag: 'tradeoff',
      heading: 'The index is a projection you can rebuild',
      eli5: 'The cards only point at books. The books on the shelves are the **source of truth**. If the card box burns, the helpers can write every card again from the shelves.',
      body: [
        'Treat the search index as a **projection** of the database. It is a few seconds stale and can be thrown away and rebuilt. Money, stock and anything needing a transaction stays in the database.',
        'Search returns the top 10 IDs and scores. The app then loads those 10 rows by primary key and renders the current price and stock.',
      ],
      keyIdea: 'Search finds and ranks IDs. The database stays the source of truth for what you show and charge.',
      metrics: { lat: '40 ms', work: '3 shards + 10 row reads', qps: '200/s', lag: '~2 s' },
      scene: {
        nodes: [{ ...coord, label: 'app', status: 'active' }, { ...db, status: 'ok', badge: '10 rows by ID' }, { ...index, at: at(0, 3.4), status: 'ok', badge: 'top 10 IDs' }],
        links: [link('coord', 'index', { arrow: 'both' }), link('coord', 'db', { arrow: 'both' })],
        flows: [
          { path: ['coord', 'index', 'coord'], tone: 'request', label: 'IDs + scores', duration: 1.6 },
          { path: ['coord', 'db', 'coord'], tone: 'data', label: 'current rows', duration: 1.6, delay: 1.8 },
        ],
        caption: 'Rank in the index, read the facts from the database',
      },
    },
    {
      title: 'Facets',
      tag: 'concept',
      heading: 'Facets count matches by field, from the same index',
      eli5: 'Next to the dragon books the librarian shows a tally: 12 hardcover, 30 paperback. Kids tap a tally to narrow the pile.',
      body: [
        'Shoppers filter by brand, price range and rating. A **facet** is a count of the matching documents per value, such as `brand: Sony (1,240)`. Filters restrict the posting-list result before scoring.',
        'Fields used for facets and sorting are stored column-wise (**doc values**), so counting over 240,000 hits stays fast. Each shard counts its slice and the coordinator adds them up.',
      ],
      keyIdea: 'Filters narrow the matches and facets count them, both from the same index.',
      metrics: { lat: '45 ms', work: '240K hits counted', qps: '250/s', lag: '~2 s' },
      scene: {
        nodes: [{ ...user, chips: ['brand = Sony'] }, { ...coord, status: 'active' }, { ...index, at: at(3.8, -3.4), status: 'ok', badge: 'filter + count' }],
        links: [link('user', 'coord'), link('coord', 'index')],
        flows: [
          { path: ['user', 'coord', 'index'], tone: 'request', label: 'headphones, brand = Sony', duration: 1.8 },
          { path: ['index', 'coord', 'user'], tone: 'response', label: 'hits + counts', duration: 1.8, delay: 2 },
        ],
        panel: {
          title: 'Facet counts for "headphones"',
          icon: 'List',
          rows: [
            { text: 'Sony', value: '1,240' },
            { text: 'Bose', value: '860' },
            { text: 'JBL', value: '2,150' },
            { text: 'Under $50', value: '41,000' },
            { text: '4 stars and up', value: '96,000' },
          ],
        },
        caption: 'Counts next to the results',
      },
    },
    {
      title: 'Autocomplete',
      tag: 'concept',
      heading: 'Autocomplete matches prefixes, fast',
      eli5: 'Before the kid finishes saying "dra", the librarian already points at "dragon" and "drawing". The helper keeps cards for every beginning of a word.',
      body: [
        'Suggestions must arrive in a few milliseconds per keystroke. The index stores **edge n-grams**: `headphone` is indexed as `h`, `he`, `hea`, and so on, so a typed prefix becomes a normal term lookup.',
        'Edge n-grams apply at index time only. The query side uses a plain analyzer, the deliberate exception to the same-analyzer rule.',
        'Rank suggestions by popularity so common searches come first.',
      ],
      keyIdea: 'Index word prefixes ahead of time, so each keystroke is one cheap term lookup.',
      metrics: { lat: '5 ms per keystroke', work: '1 term lookup', qps: '2,000/s', lag: '~2 s' },
      metricTones: { lat: 'good' },
      scene: {
        nodes: [{ ...user, chips: ['head'] }, { ...coord, label: 'suggest API', status: 'active' }, { ...index, at: at(3.8, -3.4), status: 'ok', chips: ['head, hea, he, h'] }],
        links: [link('user', 'coord'), link('coord', 'index')],
        flows: [
          { path: ['user', 'coord', 'index'], tone: 'request', label: 'head', duration: 1.4 },
          { path: ['index', 'coord', 'user'], tone: 'response', label: 'headphones, headset', duration: 1.4, delay: 1.6 },
        ],
        panel: {
          title: 'Edge n-grams of headphone',
          icon: 'Code',
          code: 'h  he  hea  head\nheadp  headph  headpho\nheadphon  headphone',
          footer: { text: 'A typed prefix is a plain term', tone: 'muted' },
        },
        caption: 'Prefixes are indexed ahead of time',
      },
    },
    {
      title: 'Typos',
      tag: 'concept',
      heading: 'Fuzzy matching forgives typos',
      eli5: 'A kid says "dragn". The librarian knows it is one letter away from "dragon" and checks that card too.',
      body: [
        'Shoppers type "hedphone". **Fuzzy** queries match terms within an **edit distance** (inserts, deletes, swaps of letters), usually 1 or 2.',
        'The engine finds candidate terms in the dictionary with an automaton, then reads their posting lists. Fuzziness costs more per query, so apply it when a search returns little,.',
      ],
      keyIdea: 'Edit distance on the term dictionary rescues misspelled queries, at extra cost.',
      metrics: { lat: '60 ms', work: '12 candidate terms', qps: '200/s', lag: '~2 s' },
      metricTones: { lat: 'warn' },
      scene: {
        nodes: [{ ...user, chips: [{ text: 'hedphone', tone: 'warn' }] }, { ...coord, status: 'active' }, { ...index, at: at(3.8, -3.4), status: 'ok', badge: 'distance 1' }],
        links: [link('user', 'coord'), link('coord', 'index')],
        flows: [
          { path: ['user', 'coord', 'index'], tone: 'request', label: 'hedphone', duration: 1.6 },
          { path: ['index', 'coord', 'user'], tone: 'response', label: 'did you mean: headphone', duration: 1.6, delay: 1.8 },
        ],
        panel: {
          title: 'Edit distance to hedphone',
          icon: 'Search',
          rows: [
            { text: 'headphone', value: '1 insert', tone: 'good' },
            { text: 'headphones', value: '2' },
            { text: 'earphone', value: '3, too far', tone: 'muted' },
          ],
        },
        caption: 'One letter off is still a match',
      },
    },
    {
      title: 'When to use',
      tag: 'tradeoff',
      heading: 'Another cluster to run: is it worth it?',
      eli5: 'A bigger card box needs its own room, its own helpers and rules for keeping it tidy. If the library has twenty books, a simple shelf label is enough.',
      body: [
        'Search nodes want a lot of memory, since the operating system has to keep the index files cached. A new analyzer means a full reindex. You also run the sync pipeline and watch lag.',
        'If your needs are small, the **full-text search** built into Postgres (`tsvector` and a GIN index) may be enough for now. Move to a search engine for relevance tuning, facets, typos and scale. Vector search for meaning-based queries is a later add-on, often combined with BM25.',
      ],
      keyIdea: 'Run a search engine when relevance, facets or scale demand it. Start with the database if they do not.',
      metrics: { lat: '40 ms', work: '3 shards + 10 row reads', qps: '200/s', lag: '~2 s' },
      scene: {
        nodes: [{ ...db, at: at(-3.8, 0), status: 'active', chips: ['tsvector + GIN'], badge: 'small catalogs' }, { ...index, at: at(3.8, 0), status: 'active', chips: ['facets, typos, scale'], badge: 'big catalogs' }],
        links: [link('db', 'index', { style: 'dashed', label: 'when it outgrows' })],
        panel: {
          title: 'Postgres FTS or search engine?',
          icon: 'Scale',
          rows: [
            { text: 'Under a few million docs, simple', value: 'Postgres FTS', tone: 'good' },
            { text: 'Tuned relevance, facets', value: 'search engine' },
            { text: 'Typos, autocomplete at scale', value: 'search engine' },
            { text: 'Extra cluster plus sync', value: 'cost', tone: 'warn' },
          ],
        },
        caption: 'Match the tool to the need',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Shards, segments, sync and features',
      eli5: 'Many helpers each keep part of the card box. A logbook keeps the cards matching the shelves, and the shelves stay the truth. The librarian can also show tallies, finish words and forgive typos.',
      body: [
        '**Shards** split the index and every query scatters to all of them. **Replicas** add capacity and failover. Inside a shard, immutable **segments** are refreshed about once a second and merged later.',
        'Feed the index from the database change log, keep a full reindex and alias swap ready, and read the facts you display from the source of truth. Facets, edge n-grams and fuzzy queries are all built from the same index.',
      ],
      keyIdea: 'A search index is a fast, ranked, slightly stale projection of your data. Build it from the source of truth and never treat it as one.',
      metrics: { lat: '40 ms', work: '3 shards + 10 row reads', qps: '200/s', lag: '~2 s' },
      metricTones: { lat: 'good', qps: 'good', lag: 'good' },
      scene: {
        nodes: [user, { ...coord, status: 'ok' }, { ...db, status: 'ok' }, { ...changes, at: at(0, 0.4) }, { ...index, at: at(3.8, 3.4), status: 'ok' }],
        links: [link('user', 'coord'), link('coord', 'index'), link('db', 'changes', { style: 'dashed' }), link('changes', 'index')],
        flows: [
          { path: ['user', 'coord', 'index', 'coord', 'user'], tone: 'response', label: 'search', duration: 2.6 },
          { path: ['db', 'changes', 'index'], tone: 'event', label: 'changes', duration: 2.4, delay: 1 },
        ],
        caption: 'Read from the index, write through the database',
      },
      quiz: {
        question: 'After six months of dual writes, about 0.1% of listings show an old price in search. Which change removes the cause?',
        options: [
          'Add more replicas to each shard',
          'Write only to the database and update the index from its change log, with retries and row versions',
          'Raise the BM25 `k1` parameter',
          'Run the index write first and the database write second',
        ],
        answer: 1,
        explain: 'Drift comes from two independent writes where one can fail or arrive out of order. Deriving the index from the committed change log turns those failures into lag that heals. Swapping the order just moves the bug.',
      },
    },
  ],
};
