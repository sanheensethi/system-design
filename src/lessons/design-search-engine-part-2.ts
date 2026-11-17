import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const user: SceneNode = { id: 'user', kind: 'user', at: at(-5.4, 0), label: 'searcher' };
const agg: SceneNode = { id: 'agg', kind: 'block', size: 0.8, at: at(-1.8, 0), label: 'aggregators', sub: 'top 1,000', icon: 'Split', tint: 'violet' };
const rerank: SceneNode = { id: 'rerank', kind: 'block', size: 0.8, at: at(1.8, 0), label: 're-ranker', sub: 'ML model', icon: 'Layers', tint: 'amber' };

export const designSearchEnginePart2: Lesson = {
  id: 'design-search-engine-part-2',
  title: 'Design a search engine (part 2)',
  tagline: 'Rank with a cascade, understand the query, cut snippets, serve autocomplete and cached answers, keep results fresh, and survive shard loss and bad index pushes.',
  minutes: 14,
  level: 'Advanced',
  learn: [
    'The ranking cascade: BM25 per shard, a merge, then a learned re-ranker',
    'Query understanding: spelling, entities, intent and answer cards',
    'Snippet generation for the final ten results only',
    'Autocomplete as a separate, fast prefix service',
    'A result cache, and a fresh index beside the batch-built one',
    'Shard loss, partial results, and canary index rollouts',
  ],
  metrics: [
    { key: 'pages', label: 'Pages', icon: 'Globe' },
    { key: 'qps', label: 'Peak queries', icon: 'Gauge' },
    { key: 'p99', label: 'p99 latency', icon: 'Timer' },
    { key: 'shards', label: 'Shards', icon: 'Boxes' },
  ],
  steps: [
    {
      title: 'Ranking cascade',
      tag: 'problem',
      heading: 'Millions of pages match, ten slots exist',
      eli5: 'Thousands of books mention pizza. The kid wants the best ten. A quick helper picks a pile of good ones, then the wisest librarian studies only that pile.',
      body: [
        'Part 1 gets candidates to the aggregators. The query `pizza dough` matches millions of pages, and the page has room for 10. The best scoring model is slow, so it cannot score everything.',
        'A **cascade** fixes that. Cheap stages see many candidates and expensive stages see few. Each stage cuts the pile before the next one.',
      ],
      keyIdea: 'Run the cheap scorer on everything, and the costly scorer only on the survivors.',
      metrics: { pages: '500B', qps: '100k', p99: '150 ms', shards: '10,000 × 3' },
      scene: {
        nodes: [
          { id: 'shards', kind: 'search', at: at(-5.4, 0), label: 'shards', sub: 'BM25 top 20' },
          agg,
          rerank,
          { id: 'page', kind: 'block', size: 0.72, at: at(5.4, 0), label: 'top 10', sub: 'the page', icon: 'List', tint: 'green' },
        ],
        links: [link('shards', 'agg', { label: '200k' }), link('agg', 'rerank', { label: '1,000' }), link('rerank', 'page', { label: '10' })],
        flows: [{ path: ['shards', 'agg', 'rerank', 'page'], tone: 'data', label: 'fewer each stage', duration: 3.2 }],
        panel: {
          title: 'The funnel',
          icon: 'TrendingUp',
          rows: [
            { text: 'Pages matching the query', value: 'millions' },
            { text: 'Stage 1: BM25 on each shard', value: 'top 20 each' },
            { text: 'Stage 2: merge in the tree', value: 'top 1,000' },
            { text: 'Stage 3: learned re-ranker', value: 'top 10', tone: 'good' },
          ],
          footer: { text: 'Cheap stages see many, costly stages see few', tone: 'muted' },
        },
        caption: 'Each stage cuts the pile',
      },
    },
    {
      title: 'Re-ranker',
      tag: 'concept',
      heading: 'A learned model scores the last 1,000',
      eli5: 'The wisest librarian looks at a pile of 1,000 books and weighs many hints: how popular, how new, what other kids picked, and whether it fits the question.',
      body: [
        'The **re-ranker** is a learned model with hundreds of features per `(query, page)` pair. It runs only on about 1,000 pages, so it can afford to be expensive.',
        'Features include PageRank from the link graph, click-through history from the query log, freshness, embedding similarity between query and page, and device and location. It then picks the final 10 and caps results per site. The model is retrained offline from the query log: clicks and skips become training labels, which closes the feedback loop.',
      ],
      keyIdea: 'BM25 finds text matches. The re-ranker weighs everything else that makes a result good.',
      metrics: { pages: '500B', qps: '100k', p99: '150 ms', shards: '10,000 × 3' },
      scene: {
        nodes: [
          { ...agg, at: at(-5.4, 0) },
          { ...rerank, at: at(-1.2, 0), status: 'active' },
          { id: 'graph', kind: 'db', at: at(3.6, -3.2), label: 'link graph', sub: 'PageRank' },
          { id: 'qlog', kind: 'queue', at: at(3.6, 3.2), label: 'query log', sub: 'click history' },
        ],
        links: [link('agg', 'rerank', { label: '1,000 pages' }), link('graph', 'rerank', { style: 'dashed' }), link('qlog', 'rerank', { style: 'dashed' })],
        flows: [
          { path: ['agg', 'rerank'], tone: 'data', label: 'top 1,000', duration: 1.4 },
          { path: ['graph', 'rerank'], tone: 'data', label: 'PageRank', duration: 1.4, delay: 0.6 },
          { path: ['qlog', 'rerank'], tone: 'data', label: 'clicks', duration: 1.4, delay: 0.8 },
        ],
        panel: {
          title: 'Re-ranker features',
          icon: 'Table',
          rows: [
            { text: 'PageRank', value: 'link graph' },
            { text: 'Click-through history', value: 'query log' },
            { text: 'Freshness', value: 'crawl time' },
            { text: 'Query-page embedding match', value: 'vector' },
            { text: 'Device and location', value: 'request' },
          ],
          footer: { text: 'Runs on 1,000 pages, not millions', tone: 'good' },
        },
        caption: 'Many signals, few candidates',
      },
      code: {
        language: 'python',
        title: 'The last stage, in miniature',
        source: `def rerank(query, candidates, ctx):
    scored = []
    for page in candidates:                  # about 1,000
        x = features(query, page, ctx)       # PageRank, clicks, age, ...
        scored.append((model.predict(x), page))
    scored.sort(reverse=True)
    return cap_per_site(scored, max_per_host=2)[:10]`,
        highlight: [3, 4, 5, 7],
      },
    },
    {
      title: 'Understand query',
      tag: 'concept',
      heading: 'Rewrite the query before it fans out',
      eli5: 'Before shouting into the rooms, a helper fixes the kid\'s words: spelling, what "nyc" means, and whether the kid wants a book at all or just today\'s weather.',
      body: [
        'A **query rewriter** runs first. Spellcheck fixes `wether`. Entity linking maps `nyc` to New York City. An intent classifier decides the person wants the weather.',
        'For some intents the answer is a structured **card** and the index is skipped. Rewriting costs milliseconds from the 200 ms budget, so these models must be small and fast.',
      ],
      keyIdea: 'Fix and classify the query first. Some intents never need the index.',
      metrics: { pages: '500B', qps: '100k', p99: '150 ms', shards: '10,000 × 3' },
      scene: {
        nodes: [
          { ...user, chips: [{ text: 'wether in nyc', tone: 'warn' }] },
          { id: 'rewrite', kind: 'block', size: 0.8, at: at(-1.4, 0), label: 'rewriter', sub: 'spell, entity, intent', icon: 'Workflow', tint: 'teal' },
          { id: 'index', kind: 'search', at: at(1.2, -3), label: 'index', sub: 'for open queries' },
          { id: 'card', kind: 'block', size: 0.72, at: at(5.2, 3.2), label: 'weather card', sub: 'no index needed', icon: 'Zap', tint: 'blue', status: 'ok' },
        ],
        links: [link('user', 'rewrite'), link('rewrite', 'index', { style: 'faint' }), link('rewrite', 'card')],
        flows: [
          { path: ['user', 'rewrite'], tone: 'request', label: 'wether in nyc', duration: 1.4 },
          { path: ['rewrite', 'card'], tone: 'request', label: 'intent: weather', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'What the rewriter does',
          icon: 'Search',
          rows: [
            { text: 'Spelling', value: 'wether to weather' },
            { text: 'Entity', value: 'nyc to New York City' },
            { text: 'Intent', value: 'weather', tone: 'good' },
            { text: 'Route', value: 'card, skip index', tone: 'good' },
          ],
        },
        caption: 'Understand first, then search',
      },
    },
    {
      title: 'Snippets',
      tag: 'concept',
      heading: 'Cut a snippet for the final ten only',
      eli5: 'Once the best ten books are picked, a helper opens each one and copies the sentence around the asked words, so the kid can peek before borrowing.',
      body: [
        'The index stores IDs, scores and positions, not page text. After ranking, the **snippet generator** fetches the text of the 10 winners from the doc store and cuts a window around the matched terms.',
        'It does this for 10 pages, never 1,000. Doc store reads are the costly part, so they happen as late as possible. Matched words get highlighted.',
      ],
      keyIdea: 'Do the expensive per-page work last, on the final ten.',
      metrics: { pages: '500B', qps: '100k', p99: '150 ms', shards: '10,000 × 3' },
      scene: {
        nodes: [
          { ...rerank, at: at(-5.4, 0), label: 're-ranker', sub: 'ids only' },
          { id: 'snip', kind: 'block', size: 0.8, at: at(-1.2, 0), label: 'snippets', sub: 'final 10', icon: 'FileText', tint: 'teal', status: 'active' },
          { id: 'docs', kind: 'storage', at: at(3.4, -3), label: 'doc store', sub: 'page text' },
          { ...user, at: at(3.4, 3.2) },
        ],
        links: [link('rerank', 'snip', { label: '10 ids' }), link('snip', 'docs', { arrow: 'both', label: '10 reads' }), link('snip', 'user')],
        flows: [
          { path: ['rerank', 'snip'], tone: 'data', label: '10 ids', duration: 1.2 },
          { path: ['snip', 'docs', 'snip'], tone: 'request', label: 'fetch text', duration: 1.8, delay: 1.3 },
          { path: ['snip', 'user'], tone: 'response', label: 'title, url, snippet', duration: 1.6, delay: 3.2 },
        ],
        panel: {
          title: 'One result',
          icon: 'FileText',
          code: 'Pizza dough recipe\nexample.com/dough\n...stretch the **pizza dough** by\nhand, then rest it for ten\nminutes before adding...',
          footer: { text: '10 doc store reads, not 1,000', tone: 'good' },
        },
        caption: 'Fetch text only for the winners',
      },
    },
    {
      title: 'Autocomplete',
      tag: 'concept',
      heading: 'Suggestions are a separate, faster service',
      eli5: 'While the kid is still talking, a helper at the door finishes the sentence. "Piz..." gets "pizza dough" from a short list kept ready by the door.',
      body: [
        'As you type, `GET /suggest?prefix=pizza d` returns the top completions. It is a different system from search: a **trie** of query-log prefixes with the top few suggestions precomputed at each node.',
        'It is served from an edge tier at under 50 ms, and personal history merges on the client. The design has its own lesson, the search autocomplete lesson.',
      ],
      keyIdea: 'Prefix lookup is a small precomputed table at the edge, not a query on the big index.',
      metrics: { pages: '500B', qps: '100k', p99: '150 ms', shards: '10,000 × 3' },
      scene: {
        nodes: [
          { ...user, chips: ['pizza d'] },
          { id: 'edge', kind: 'cdn', at: at(-1.4, 0), label: 'edge tier', sub: '< 50 ms' },
          { id: 'trie', kind: 'cache', at: at(3.4, -3), label: 'prefix trie', sub: 'top 5 per node' },
          { id: 'qlog', kind: 'queue', at: at(3.4, 3.2), label: 'query log', sub: 'builds it offline' },
        ],
        links: [link('user', 'edge', { label: 'GET /suggest' }), link('edge', 'trie'), link('qlog', 'trie', { style: 'dashed' })],
        flows: [
          { path: ['user', 'edge', 'trie'], tone: 'request', label: 'pizza d', duration: 1.6 },
          { path: ['trie', 'edge', 'user'], tone: 'response', label: 'pizza dough', duration: 1.6, delay: 1.7 },
          { path: ['qlog', 'trie'], tone: 'data', label: 'rebuild', duration: 1.4, delay: 0.3 },
        ],
        panel: {
          title: 'Suggest versus search',
          icon: 'Zap',
          rows: [
            { text: 'Data', value: 'prefix trie' },
            { text: 'Built from', value: 'query log' },
            { text: 'Latency', value: '< 50 ms', tone: 'good' },
          ],
          footer: { text: 'Full design: search autocomplete lesson', tone: 'muted' },
        },
        caption: 'A small table at the edge',
      },
    },
    {
      title: 'Result cache',
      tag: 'tradeoff',
      heading: 'Many queries repeat, so remember the answers',
      eli5: 'If the front desk was just asked for the pizza dough books, it keeps the list on a sticky note. The next kid gets it without anyone walking to any room.',
      body: [
        'Query traffic is skewed: a small set of popular queries makes up a large share of volume. A **result cache** in front of the aggregators, keyed by normalized query, language, page, coarse region and device class, answers those in a few milliseconds and skips the fan-out.',
        'Personalized queries (those the re-ranker tunes per user) bypass the cache. The cost is freshness: a cached page ignores newly indexed pages, so short expiry covers it. Use short expiry for news-like queries, and longer for steady ones. A hit rate of even 40% is a large saving at 100k queries per second.',
      ],
      keyIdea: 'Cache whole results for popular queries, and tune the expiry to how fast the topic changes.',
      metrics: { pages: '500B', qps: '100k', p99: '150 ms', shards: '10,000 × 3' },
      scene: {
        nodes: [
          user,
          { id: 'front', kind: 'block', size: 0.8, at: at(-1.8, 0), label: 'front end', sub: 'normalize query', icon: 'Search', tint: 'violet' },
          { id: 'rcache', kind: 'cache', at: at(1.4, -3.4), label: 'result cache', sub: 'hit: 5 ms', status: 'ok', chips: ['pizza dough|en|1'] },
          { ...agg, at: at(4.6, 2.8), sub: 'miss: 150 ms' },
        ],
        links: [link('user', 'front'), link('front', 'rcache', { label: 'hit' }), link('front', 'agg', { label: 'miss', style: 'dashed' })],
        flows: [
          { path: ['user', 'front', 'rcache', 'front', 'user'], tone: 'response', label: 'cached, 5 ms', duration: 2.6 },
          { path: ['front', 'agg'], tone: 'request', label: 'rare query', duration: 1.4, delay: 2.8 },
        ],
        panel: {
          title: 'Cache policy',
          icon: 'Clock',
          rows: [
            { text: 'Key', value: 'query, lang, page, region, device' },
            { text: 'Personalized queries', value: 'bypass cache', tone: 'warn' },
            { text: 'Steady topics', value: 'longer expiry' },
            { text: 'News-like topics', value: 'short expiry', tone: 'warn' },
            { text: 'Hit rate (illustrative)', value: '40%', tone: 'good' },
          ],
        },
        caption: 'Skip the fan-out for popular queries',
      },
      quiz: {
        question: 'Why does the result cache use a short expiry for queries like "election results"?',
        options: [
          'Short keys are faster to look up',
          'The correct answer changes quickly, and a stale cached page would hide new results',
          'Popular queries are always wrong',
          'Cache memory is cheaper when entries expire early',
        ],
        answer: 1,
        explain: 'A cache trades freshness for speed. Fast-changing topics need entries to expire soon, or users keep seeing the old page.',
      },
    },
    {
      title: 'Fresh index',
      tag: 'concept',
      heading: 'News cannot wait for the nightly build',
      eli5: 'The night crew writes new cards once a day. For today\'s news, a small side desk writes cards right away, and the front desk looks at both card boxes.',
      body: [
        'The main index is built in batches, so a new page can wait hours or days. For news that is too slow. A small **fresh index** takes new and changed pages from a stream and updates within minutes.',
        'A query asks both: the big base index and the small fresh one, then the aggregator merges. The fresh index stays small, and its pages move into the base on the next build.',
      ],
      keyIdea: 'A small fast index beside the big slow one covers freshness without rebuilding everything.',
      metrics: { pages: '500B', qps: '100k', p99: '150 ms', shards: '10,000 × 3' },
      scene: {
        nodes: [
          { id: 'newq', kind: 'queue', at: at(-5.4, 0), label: 'new pages', sub: 'crawl stream' },
          { id: 'fresh', kind: 'search', at: at(-1.6, -3.2), label: 'fresh index', sub: 'small', badge: 'minutes', status: 'active' },
          { id: 'base', kind: 'search', at: at(1.4, 3.2), label: 'base index', sub: '100 TB', badge: 'batch' },
          { ...agg, at: at(5, 0), sub: 'merges both' },
        ],
        links: [link('newq', 'fresh', { label: 'minutes' }), link('agg', 'fresh', { arrow: 'both' }), link('agg', 'base', { arrow: 'both' })],
        flows: [
          { path: ['newq', 'fresh'], tone: 'event', label: 'new page', duration: 1.4 },
          { path: ['agg', 'fresh', 'agg'], tone: 'request', label: 'q', duration: 1.8, delay: 1.5 },
          { path: ['agg', 'base', 'agg'], tone: 'request', label: 'q', duration: 1.8, delay: 1.5 },
        ],
        panel: {
          title: 'Two tiers',
          icon: 'Layers',
          rows: [
            { text: 'Base index', value: 'big, batch build' },
            { text: 'Fresh index', value: 'small, minutes', tone: 'good' },
            { text: 'Query', value: 'asks both, merges' },
          ],
          footer: { text: 'Fresh pages join the base on the next build', tone: 'muted' },
        },
        caption: 'Slow and big plus fast and small',
      },
    },
    {
      title: 'Shard loss',
      tag: 'case',
      heading: 'When a whole shard group is gone',
      eli5: 'One whole room closes: all three copies of its shelves are unavailable. The librarian still answers, and tells the kid a few books may be missing.',
      body: [
        'A rare correlated failure takes out all copies of one shard, for example a bad deploy. The aggregator hits its time budget, drops that shard and returns **partial results**, flagged internally.',
        'With 1 shard of 10,000 missing, about 99.99% of the documents are still searched. Users rarely notice. Repair copies the immutable index files from another zone or from file storage, since nothing needs to be replayed.',
      ],
      keyIdea: 'Degrade by dropping a slice of the index. Repair by re-copying files.',
      metrics: { pages: '500B', qps: '100k', p99: '150 ms', shards: '9,999 of 10,000' },
      metricTones: { shards: 'warn', p99: 'good' },
      scene: {
        nodes: [
          { ...agg, at: at(0, -3), status: 'active', badge: '9,999 of 10,000', sub: 'partial result' },
          { id: 'r1', kind: 'replica', at: at(-4, 2.6), label: 'shard 7 copy 1', status: 'down', badge: 'down' },
          { id: 'r2', kind: 'replica', at: at(0, 2.6), label: 'shard 7 copy 2', status: 'down', badge: 'down' },
          { id: 'r3', kind: 'replica', at: at(4, 2.6), label: 'shard 7 copy 3', status: 'down', badge: 'down' },
        ],
        links: [link('agg', 'r1', { style: 'faint' }), link('agg', 'r2', { style: 'faint' }), link('agg', 'r3', { style: 'faint' })],
        flows: [{ path: ['agg', 'r2'], tone: 'error', label: 'timeout at 150 ms', duration: 2 }],
        panel: {
          title: 'What happens',
          icon: 'Bug',
          rows: [
            { text: 'Query still answered', value: 'yes', tone: 'good' },
            { text: 'Documents searched', value: '99.99%', tone: 'warn' },
            { text: 'Repair', value: 'copy files', tone: 'good' },
            { text: 'On-call alerted', value: 'yes' },
          ],
          footer: { text: 'The time budget turned an outage into a small gap', tone: 'good' },
        },
        caption: 'One missing slice, a full answer page',
      },
    },
    {
      title: 'Bad index push',
      tag: 'case',
      heading: 'A bad build must not reach every shard',
      eli5: 'The night crew writes new cards, but they made a mistake and half the cards are blank. So the new box goes to one room first, and a helper checks it before the rest.',
      body: [
        'A bug in the analyzer or the ranking features can produce a bad index, and pushing it everywhere at once would break search for everyone. Roll out as a **canary**: 1% of replicas get the new version first.',
        'Compare result counts, click rate and latency against the old version. If they hold, widen the rollout. If not, flip the pointer back to the old files, which are still on disk.',
      ],
      keyIdea: 'Ship index builds like code: canary first, compare, keep the old version for instant rollback.',
      metrics: { pages: '500B', qps: '100k', p99: '150 ms', shards: '10,000 × 3' },
      scene: {
        nodes: [
          { id: 'build', kind: 'block', size: 0.8, at: at(-5.4, 0), label: 'new build', sub: 'version 2', icon: 'Package', tint: 'amber' },
          { id: 'canary', kind: 'search', at: at(-1.6, -3.2), label: 'canary', sub: '1% of replicas', badge: 'v2', status: 'active' },
          { id: 'fleet', kind: 'search', at: at(1.4, 3.2), label: 'rest of fleet', sub: '99%', badge: 'v1' },
          { id: 'mon', kind: 'monitor', at: at(4.6, -3.2), label: 'quality checks', sub: 'counts, clicks, p99' },
        ],
        links: [link('build', 'canary', { label: 'push' }), link('build', 'fleet', { style: 'dashed', label: 'wait' }), link('canary', 'mon')],
        flows: [
          { path: ['build', 'canary'], tone: 'data', label: 'v2 files', duration: 1.6 },
          { path: ['canary', 'mon'], tone: 'event', label: 'metrics', duration: 1.4, delay: 1.8 },
        ],
        panel: {
          title: 'Canary checks',
          icon: 'Gauge',
          rows: [
            { text: 'Results per query', value: 'within 2%' },
            { text: 'Click rate', value: 'no drop', tone: 'good' },
            { text: 'p99 latency', value: 'no rise', tone: 'good' },
            { text: 'Rollback', value: 'flip to v1', tone: 'good' },
          ],
        },
        caption: 'Prove it on 1% first',
      },
      code: {
        language: 'yaml',
        title: 'Index rollout policy',
        source: `rollout:
  version: index-v2
  keep_previous: index-v1        # old files stay on disk
  stages:
    - { replicas: 1%,   bake: 30m }
    - { replicas: 10%,  bake: 30m }
    - { replicas: 100% }
  abort_if:
    results_per_query_drop: 2%
    click_rate_drop: 1%
    p99_ms_over: 200
  on_abort: switch_pointer_to(index-v1)`,
        highlight: [3, 4, 8, 12],
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Precompute, fan out, cascade, protect',
      eli5: 'Night crews write the cards, many rooms hold copies, helpers gather the best, a wise librarian picks ten, and nothing new reaches every room before one room tries it.',
      body: [
        'The engine builds the index offline, splits it by document, and answers by scatter-gather through a tree. A cascade narrows millions of matches to 10, using BM25, a merge and a learned re-ranker. Snippets run last.',
        'A rewriter fixes queries, a cache skips repeat work, a fresh index covers news, and the time budget, replicas and canary pushes keep it up.',
      ],
      keyIdea: 'Do heavy work ahead of time, spread the lookup across shards, narrow candidates in stages and bound every failure.',
      metrics: { pages: '500B', qps: '100k', p99: '150 ms', shards: '10,000 × 3' },
      metricTones: { p99: 'good', qps: 'good' },
      scene: {
        nodes: [user, { id: 'front', kind: 'block', size: 0.8, at: at(-1.8, 0), label: 'front end', sub: 'rewrite, cache', icon: 'Search', tint: 'violet' }, { ...agg, at: at(1.8, 0) }, { id: 's1', kind: 'search', at: at(5.4, 0), label: 'shards', sub: '10,000 × 3' }],
        links: [link('user', 'front'), link('front', 'agg'), link('agg', 's1', { arrow: 'both' })],
        flows: [
          { path: ['user', 'front', 'agg', 's1'], tone: 'request', label: 'query', duration: 2.4 },
          { path: ['s1', 'agg', 'front', 'user'], tone: 'response', label: '10 results', duration: 2.4, delay: 2.5 },
        ],
        panel: {
          title: 'The whole path',
          icon: 'Route',
          rows: [
            { text: 'Rewrite, cache check', value: '5 ms' },
            { text: 'Scatter, shard BM25, gather', value: '120 ms' },
            { text: 'Re-rank, snippets', value: '25 ms' },
            { text: 'p99 end to end', value: '150 ms', tone: 'good' },
          ],
          footer: { text: 'Budget illustrative, 150 ms leaves room under the 200 ms target', tone: 'muted' },
        },
        caption: 'Offline build, online cascade',
      },
      quiz: {
        question: 'Why does the engine score pages in a cascade (BM25, then merge, then a learned model) and not run the learned model on every match?',
        options: [
          'The learned model is less accurate than BM25',
          'The learned model is costly per page, so it can only run on the small set that survives the cheap stages',
          'BM25 cannot run on shards',
          'It avoids needing a link graph',
        ],
        answer: 1,
        explain: 'Millions of pages match at 100k queries per second, which makes a costly model impossible on all of them. The cascade spends little on many pages and a lot on a few.',
      },
    },
  ],
};
