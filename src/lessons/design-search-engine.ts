import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const user: SceneNode = { id: 'user', kind: 'user', at: at(-5.4, 0), label: 'searcher' };
const front: SceneNode = { id: 'front', kind: 'block', size: 0.8, at: at(-1.8, 0), label: 'front end', sub: 'query API', icon: 'Search', tint: 'violet' };
const crawler: SceneNode = { id: 'crawler', kind: 'worker', at: at(-5, -2.2), label: 'crawler', sub: 'fetches pages' };
const docs: SceneNode = { id: 'docs', kind: 'storage', at: at(-1.7, -2.2), label: 'doc store', sub: '500 TB of text' };
const indexer: SceneNode = { id: 'indexer', kind: 'block', size: 0.75, at: at(1.7, -2.2), label: 'indexer', icon: 'Workflow', tint: 'amber' };
const index: SceneNode = { id: 'index', kind: 'search', at: at(5, -2.2), label: 'index', sub: '100 TB' };
const agg: SceneNode = { id: 'agg', kind: 'block', size: 0.8, at: at(-4.8, 0), label: 'aggregator', icon: 'Split', tint: 'violet' };
const shard = (n: number, d: number, s = 0): SceneNode => ({ id: `s${n}`, kind: 'search', at: at(d, s), label: `shard ${n}`, sub: '10 GB slice' });

export const designSearchEngine: Lesson = {
  id: 'design-search-engine',
  title: 'Design a search engine (part 1)',
  tagline: 'Turn 500 billion pages into answers in 200 ms: requirements, the index, sharding and scatter-gather, and the tail latency that comes with them.',
  minutes: 16,
  level: 'Advanced',
  learn: [
    'Requirements and capacity: 500B pages, 100k queries per second, p99 under 200 ms',
    'The API and the four stores: doc store, inverted index, link graph, query log',
    'Why one server fails, and the split into an offline indexing pipeline and an online query pipeline',
    'Building the index in batches, and PageRank as an offline score',
    'Document partitioning, scatter-gather, tail latency, hedged requests and partial results',
    'Replica groups and a tree of aggregators',
  ],
  metrics: [
    { key: 'pages', label: 'Pages', icon: 'Globe' },
    { key: 'qps', label: 'Peak queries', icon: 'Gauge' },
    { key: 'p99', label: 'Scatter-gather p99', icon: 'Timer' },
    { key: 'shards', label: 'Shards', icon: 'Boxes' },
  ],
  steps: [
    {
      title: 'Too big',
      tag: 'problem',
      heading: 'Five hundred billion pages and one question',
      eli5: 'A giant library has half the books in the world. A kid asks "where is the pizza dough book?" and one helper starts opening every book from the first shelf.',
      body: [
        'You type `best pizza dough` and expect ten good links in under a second. Behind that sit about **500 billion pages**, roughly **500 TB** of extracted text.',
        'One server that reads the text at 1 GB/s needs almost six days for one question. A search engine exists to avoid reading the pages at query time.',
      ],
      keyIdea: 'You cannot read the web when someone asks. The work has to be done before the question arrives.',
      metrics: { pages: '500B', qps: '100k', p99: '5.8 days', shards: '1' },
      metricTones: { p99: 'bad' },
      scene: {
        nodes: [
          { ...user, chips: [{ text: 'best pizza dough', tone: 'default' }] },
          { id: 'box', kind: 'server', at: at(-0.9, 0), label: 'one server', sub: 'reads every page', status: 'hot', load: 100 },
          { id: 'web', kind: 'internet', at: at(4.2, 0), label: 'the web', sub: '500B pages' },
        ],
        links: [link('user', 'box', { label: 'query' }), link('box', 'web', { label: 'scan every page', labelTone: 'warn' })],
        flows: [
          { path: ['user', 'box'], tone: 'request', label: 'best pizza dough', duration: 1.4 },
          { path: ['box', 'web', 'box'], tone: 'request', label: 'read all text', duration: 2.4, delay: 1.5 },
        ],
        panel: {
          title: 'A full scan',
          icon: 'Timer',
          rows: [
            { text: 'Corpus', value: '500 TB' },
            { text: 'One disk reads at', value: '1 GB/s' },
            { text: 'One question takes', value: '5.8 days', tone: 'bad' },
          ],
          footer: { text: 'Users give up after about one second', tone: 'bad' },
        },
        caption: 'The answer cannot come from reading pages at query time',
      },
    },
    {
      title: 'Requirements',
      tag: 'concept',
      heading: 'What the engine must do, and what we leave out',
      eli5: 'The library promises three things: find good books fast, show a short peek of each, and never close, even when a helper is sick.',
      body: [
        '**In scope:** a text query returns 10 ranked results per page, each with a title, URL and a snippet of matching text. Word variants match through stemming at index time. Typos are fixed by the query rewriter in part 2.',
        '**Targets:** p99 under 200 ms, 100,000 queries per second at peak, and no single machine whose death takes search down. **Left out:** fetching pages (the web crawler lesson), ads, and the offline training jobs for ranking models. The 200 ms is end to end, with 120 ms for scatter-gather.',
      ],
      keyIdea: 'Fix the latency and throughput targets first. They decide every later choice.',
      metrics: { pages: '500B', qps: '100k', p99: '< 120 ms', shards: '?' },
      scene: {
        nodes: [user, front, { id: 'index', kind: 'search', at: at(2.2, 0), label: 'search index', sub: 'built ahead of time' }],
        links: [link('user', 'front', { label: 'GET /search' }), link('front', 'index')],
        flows: [
          { path: ['user', 'front', 'index'], tone: 'request', label: 'query', duration: 1.8 },
          { path: ['index', 'front', 'user'], tone: 'response', label: '10 results', duration: 1.8, delay: 1.9 },
        ],
        panel: {
          title: 'Requirements',
          icon: 'List',
          rows: [
            { text: 'Ranked results, 10 per page', value: 'must' },
            { text: 'Snippet with matched words', value: 'must' },
            { text: 'Spelling and word variants', value: 'must' },
            { text: 'p99 latency', value: '< 200 ms', tone: 'good' },
            { text: 'Peak load', value: '100k QPS', tone: 'good' },
            { text: 'Survives machine loss', value: 'must' },
          ],
        },
        caption: 'Targets first, features second',
      },
    },
    {
      title: 'Capacity',
      tag: 'concept',
      heading: 'The numbers that shape the design',
      eli5: 'Count the books, then count the cards in the catalog, then count how many kids ask at once. The counts tell you how many rooms the library needs.',
      body: [
        '500 billion pages at about 1 KB of extracted text each is **500 TB**. The inverted index (the word-to-pages lists from the search index lesson) compresses to about **100 TB**.',
        'The index is too large for any one machine. Split into 10,000 slices, each is **10 GB**, small enough to sit in memory on one server.',
      ],
      keyIdea: 'Storage size gives the shard count. Query rate gives the replica count, worked out in the replica groups step.',
      metrics: { pages: '500B', qps: '100k', p99: '< 120 ms', shards: '10,000' },
      scene: {
        nodes: [
          { id: 'corpus', kind: 'storage', at: at(-4.4, 0), label: 'doc store', sub: '500 TB' },
          { ...indexer, at: at(-0.4, 0) },
          { ...index, at: at(3.8, 0), sub: '100 TB total' },
        ],
        links: [link('corpus', 'indexer', { label: 'analyze' }), link('indexer', 'index', { label: 'compress' })],
        flows: [{ path: ['corpus', 'indexer', 'index'], tone: 'data', label: '500 TB to 100 TB', duration: 2.2 }],
        panel: {
          title: 'Napkin math',
          icon: 'Gauge',
          rows: [
            { text: '500B pages × 1 KB', value: '500 TB' },
            { text: 'Index, compressed', value: '100 TB' },
            { text: '100 TB ÷ 10,000 shards', value: '10 GB each', tone: 'good' },
            { text: 'Peak queries', value: '100k / s' },
          ],
          footer: { text: 'Illustrative numbers for a web-scale engine', tone: 'muted' },
        },
        caption: 'Size decides the shard count',
      },
      code: {
        language: 'typescript',
        title: 'Napkin math',
        source: `const pages = 500e9;
const bytesPerPage = 1_000;            // extracted text
const corpusTB = (pages * bytesPerPage) / 1e12;   // 500
const indexTB = 100;                   // compressed postings

const shards = 10_000;
const gbPerShard = (indexTB * 1000) / shards;     // 10

const peakQps = 100_000;
// every shard sees every query (document partitioning):
const callsPerSecond = peakQps * shards;          // 1e9 shard calls per second
// so each shard group must absorb the full 100k QPS,
// less what the result cache answers (replica sizing later)`,
        highlight: [3, 7, 11],
      },
    },
    {
      title: 'The API',
      tag: 'concept',
      heading: 'One read endpoint, with a page limit',
      eli5: 'The librarian window has one form: write what you want, say which page of answers you want, and get a list back with a short peek of each.',
      body: [
        'The public API is a single `GET /search`. The query is `q`, with optional `page`, `lang` and `safe`. The response lists results with a `snippet` each, plus a `took_ms` field for monitoring.',
        'Results stop after about page 10 (100 results). Deep paging costs every shard more work for every extra page (see the search index lesson), and almost nobody reads page 50. Autocomplete uses its own `GET /suggest`.',
      ],
      keyIdea: 'A small, read-only API with a paging cap keeps the query cost bounded.',
      metrics: { pages: '500B', qps: '100k', p99: '< 120 ms', shards: '10,000' },
      scene: {
        nodes: [{ ...user, chips: ['GET /search?q=...'] }, { ...front, label: 'search API' }, { id: 'cap', kind: 'block', size: 0.72, at: at(2.2, 0), label: 'page cap', sub: 'stop at page 10', icon: 'Scale', tint: 'amber' }],
        links: [link('user', 'front', { label: 'HTTPS' }), link('front', 'cap')],
        flows: [
          { path: ['user', 'front'], tone: 'request', label: 'q=pizza dough', duration: 1.4 },
          { path: ['front', 'user'], tone: 'response', label: '10 results', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Why the cap: work per shard',
          icon: 'Braces',
          rows: [
            { text: 'Page 1: each shard returns top 10', value: '10 hits' },
            { text: 'Page 10: top 100', value: '100 hits', tone: 'warn' },
            { text: 'Page 50: top 500', value: '500 hits', tone: 'bad' },
            { text: 'Page 100: top 1,000', value: '1,000 hits', tone: 'bad' },
          ],
          footer: { text: 'Page k costs each shard its top k x 10', tone: 'muted' },
        },
        caption: 'Read-only, paged, capped',
      },
      code: {
        language: 'typescript',
        title: 'The response shape',
        source: `interface SearchResponse {
  results: Result[];            // 10 per page, pages 1 to 10 only
  next?: string;                // absent after the last allowed page
  correctedQuery?: string;      // "did you mean ..."
  tookMs: number;
}

interface Result {
  url: string;
  title: string;
  snippet: string;              // text around the matched words
}`,
        highlight: [3, 4],
      },
    },
    {
      title: 'Data model',
      tag: 'concept',
      heading: 'Four stores, each with one job',
      eli5: 'The library keeps four things: the books, a card box that lists which books mention each word, a map of which books point to other books, and a notebook of what kids asked.',
      body: [
        'The **doc store** holds each page text by URL hash. The **inverted index** maps a term to a posting list of `(doc_id, term frequency, positions)`. The **link graph** records which pages link to which. The **query log** records what people typed and clicked.',
        'Only the inverted index is read on the hot path. The others feed it, rank with it or improve it later.',
      ],
      keyIdea: 'Query time reads the inverted index. Everything else prepares it or tunes it.',
      metrics: { pages: '500B', qps: '100k', p99: '< 120 ms', shards: '10,000' },
      scene: {
        nodes: [
          { id: 'docs', kind: 'storage', at: at(-5.4, -3.2), label: 'doc store', sub: '500 TB' },
          { id: 'index', kind: 'search', at: at(0, 0), label: 'inverted index', sub: '100 TB', status: 'active' },
          { id: 'graph', kind: 'db', at: at(-5.4, 3.6), label: 'link graph', sub: 'who links to whom' },
          { id: 'qlog', kind: 'queue', at: at(4.8, 3), label: 'query log', sub: 'queries and clicks' },
        ],
        links: [link('docs', 'index', { label: 'analyze' }), link('graph', 'index', { style: 'dashed' }), link('qlog', 'index', { style: 'dashed' })],
        flows: [{ path: ['docs', 'index'], tone: 'data', label: 'terms', duration: 1.6 }],
        panel: {
          title: 'One posting list',
          icon: 'Table',
          code: '"dough" -> [\n  { doc: 41, tf: 3, pos: [2, 9, 30] },\n  { doc: 77, tf: 1, pos: [14] },\n  { doc: 913, tf: 5, pos: [1, 4, 8] }\n]',
          footer: { text: 'Sorted by doc id, compressed on disk', tone: 'muted' },
        },
        caption: 'Four stores, one on the hot path',
      },
    },
    {
      title: 'Simple design',
      tag: 'case',
      heading: 'The simplest version: one index on one server',
      eli5: 'Put the whole card box on one desk with one helper. Every kid walks to that desk, and the helper checks the cards and returns the answer.',
      body: [
        'The first design: the crawler writes pages to the doc store, an indexer builds the inverted index, and one index server answers queries. The lookup itself is fast. The earlier lessons already showed that.',
        'On a small site this is the right design. It breaks only because of the size of the web.',
      ],
      keyIdea: 'Index ahead of time, look up at query time. That part of the simple design is right. The single machine is what breaks.',
      metrics: { pages: '500B', qps: '100k', p99: '?', shards: '1' },
      scene: {
        nodes: [user, { ...front, at: at(-1.8, 0) }, { id: 'index', kind: 'search', at: at(2, 0), label: 'one index', sub: '100 TB?', status: 'hot', load: 100 }, { ...docs, at: at(5.2, -2.6) }],
        links: [link('user', 'front'), link('front', 'index'), link('docs', 'index', { label: 'build', style: 'dashed' })],
        flows: [
          { path: ['user', 'front', 'index'], tone: 'request', label: 'query', duration: 1.8 },
          { path: ['docs', 'index'], tone: 'data', label: 'index files', duration: 1.4, delay: 0.4 },
        ],
        panel: {
          title: 'The simple design',
          icon: 'Workflow',
          rows: [
            { text: 'Crawler fills doc store', value: 'offline' },
            { text: 'Indexer builds one index', value: 'offline' },
            { text: 'One server answers', value: 'online', tone: 'warn' },
          ],
        },
        caption: 'Right idea, one machine too few',
      },
    },
    {
      title: 'Where it breaks',
      tag: 'tradeoff',
      heading: 'Three limits hit at once',
      eli5: 'One desk cannot hold the whole card box, one helper cannot answer a hundred thousand kids, and when the helper goes home the library is closed.',
      body: [
        '**Size.** A 100 TB index does not fit on one machine, or in its memory. **Throughput.** One machine cannot answer 100,000 queries per second.',
        '**Availability.** One machine is a single point of failure. Fixing these one by one gives sharding for size, replicas for throughput and failover, and a split between building the index and serving it.',
      ],
      keyIdea: 'Size, throughput and availability each need their own fix. Sharding alone does not solve the last two.',
      metrics: { pages: '500B', qps: '100k', p99: 'timeouts', shards: '1' },
      metricTones: { p99: 'bad' },
      scene: {
        nodes: [
          { ...user, chips: [{ text: '100k queries/s', tone: 'warn' }] },
          { ...front, at: at(-1.8, 0), status: 'hot', load: 95 },
          { id: 'index', kind: 'search', at: at(2, 0), label: 'one index', sub: 'disk and CPU full', status: 'down', badge: 'down' },
        ],
        links: [link('user', 'front'), link('front', 'index', { label: 'timeouts', labelTone: 'bad' })],
        flows: [{ path: ['user', 'front'], tone: 'request', count: 3, label: 'queries', duration: 1.2 }, { path: ['front', 'index'], tone: 'error', label: 'timeout', duration: 1.4, delay: 1.2 }],
        panel: {
          title: 'The three limits',
          icon: 'Bug',
          rows: [
            { text: 'Index 100 TB vs one 8 TB box', value: 'size', tone: 'bad' },
            { text: '100k QPS vs about 1k per box', value: 'throughput', tone: 'bad' },
            { text: 'One box dies, search is gone', value: 'availability', tone: 'bad' },
          ],
          footer: { text: 'Fixes: shards, replicas, an offline build', tone: 'muted' },
        },
        caption: 'Three limits, three fixes',
      },
    },
    {
      title: 'Two pipelines',
      tag: 'concept',
      heading: 'Split the work: build offline, serve online',
      eli5: 'One crew reads every new book overnight and writes the cards. A separate crew at the front desk answers kids during the day using the finished cards.',
      body: [
        'An **indexing pipeline** runs offline in batches: crawl, store, analyze, build the index, push it to servers. It may take hours and nobody waits for it.',
        'A **query pipeline** runs online: rewrite the query, fan it out, rank, return. It has 200 ms. Keeping them apart lets each scale and fail on its own.',
      ],
      keyIdea: 'Heavy work moves offline so the online path only does lookups.',
      metrics: { pages: '500B', qps: '100k', p99: '< 120 ms', shards: '10,000' },
      scene: {
        nodes: [crawler, docs, indexer, index, { ...front, at: at(1.7, 2.8) }],
        links: [link('crawler', 'docs'), link('docs', 'indexer'), link('indexer', 'index', { label: 'push' }), link('front', 'index', { label: 'query' })],
        flows: [
          { path: ['crawler', 'docs', 'indexer', 'index'], tone: 'data', label: 'offline batch', duration: 3 },
          { path: ['front', 'index', 'front'], tone: 'request', label: 'online query', duration: 2, delay: 3.2 },
        ],
        panel: {
          title: 'Two clocks',
          icon: 'Clock',
          rows: [
            { text: 'Indexing pipeline', value: 'hours, batch', tone: 'muted' },
            { text: 'Query pipeline', value: '200 ms, online', tone: 'good' },
          ],
          footer: { text: 'Crawling is the web crawler lesson', tone: 'muted' },
        },
        caption: 'Offline builds, online serves',
      },
      quiz: {
        question: 'Why is the inverted index built offline in batches and not at query time?',
        options: [
          'Queries need old data on purpose',
          'Building touches 500 TB and takes hours, so it cannot share the 200 ms budget or the machines with live queries',
          'Offline code is always faster than online code',
          'The index is too small to build online',
        ],
        answer: 1,
        explain: 'Analyzing every page is heavy work. Doing it ahead of time means a query only does a lookup. Offline is not faster per page. It just has no user waiting.',
      },
    },
    {
      title: 'Building the index',
      tag: 'concept',
      heading: 'A batch job turns pages into posting lists',
      eli5: 'Helpers read each book and write "word, book number" on a slip. Then all slips for one word are stacked in order, and each stack becomes one card.',
      body: [
        'The indexer reads the doc store and runs each page through the **analyzer** (tokenize, lowercase, stem) from the search index lesson. A MapReduce-style job emits `(term, doc_id)` pairs and groups them by term.',
        'Each group becomes a sorted posting list. The output is a set of immutable index files, split by document range and pushed to the index servers. Before indexing, a near-duplicate filter (simhash fingerprints of page text) drops copies and mirrors, and a spam classifier drops link farms.',
      ],
      keyIdea: 'Map emits term and doc, reduce writes one sorted posting list per term. The output is a set of files.',
      metrics: { pages: '500B', qps: '100k', p99: '< 120 ms', shards: '10,000' },
      scene: {
        nodes: [
          { ...docs, at: at(-5, 0) },
          { ...indexer, at: at(-1.6, 0), label: 'MapReduce', sub: 'analyze, group' },
          { ...shard(1, 1.6, -2.4) },
          { ...shard(2, 5, 2.4) },
        ],
        links: [link('docs', 'indexer', { label: 'pages' }), link('indexer', 's1', { label: 'docs 0 to N' }), link('indexer', 's2')],
        flows: [
          { path: ['docs', 'indexer'], tone: 'data', label: 'text', duration: 1.4 },
          { path: ['indexer', 's1'], tone: 'data', label: 'index files', duration: 1.4, delay: 1.5 },
          { path: ['indexer', 's2'], tone: 'data', label: 'index files', duration: 1.4, delay: 1.7 },
        ],
        panel: {
          title: 'Map then reduce',
          icon: 'Workflow',
          code: 'map(doc):\n  for t in analyze(doc.text):\n    emit(t, doc.id)\nreduce(t, ids):\n  write(t, sorted(ids))',
          footer: { text: 'Output: immutable files per shard', tone: 'muted' },
        },
        caption: 'Terms in, posting lists out',
      },
      code: {
        language: 'python',
        title: 'The build job in miniature',
        source: `def map_doc(doc):
    pos = 0
    for term in analyze(doc.text):        # lowercase, stem
        yield term, (doc.id, pos)
        pos += 1

def reduce_term(term, hits):
    hits = sorted(hits)                   # by doc id, then position
    postings = group_by_doc(hits)         # (doc, tf, [positions])
    return term, compress(postings)

def build_shard(shard_no, docs):
    run_job(map_doc, reduce_term, docs.where(shard_of(doc.id) == shard_no))`,
        highlight: [4, 8, 9],
      },
    },
    {
      title: 'PageRank',
      tag: 'concept',
      heading: 'A page matters if important pages link to it',
      eli5: 'If many popular kids say "read this book", the book must be good. A vote from a popular kid counts more than a vote from a kid nobody knows.',
      body: [
        'Text match alone cannot tell a respected guide from a copy of it. The **link graph** adds a signal: a link is a vote, and a vote from an important page weighs more.',
        '**PageRank** computes one score per page by repeating a simple step until the scores settle. It runs offline over the whole graph, and the score is stored beside the document for ranking to read.',
      ],
      keyIdea: 'PageRank is an offline, query-independent score. It is computed in batches and read as one number at query time.',
      metrics: { pages: '500B', qps: '100k', p99: '< 120 ms', shards: '10,000' },
      scene: {
        nodes: [
          { id: 'news', kind: 'block', size: 0.72, at: at(-5, -2.2), label: 'news site', icon: 'Rss', tint: 'blue' },
          { id: 'blog', kind: 'block', size: 0.72, at: at(-5, 2.2), label: 'blog', icon: 'FileText', tint: 'blue' },
          { id: 'wiki', kind: 'block', size: 0.8, at: at(-0.4, 0), label: 'guide page', icon: 'Star', tint: 'green', status: 'ok', badge: 'rank 0.31' },
          { id: 'graph', kind: 'db', at: at(4.4, 0), label: 'link graph', sub: 'score per page' },
        ],
        links: [link('news', 'wiki', { label: 'link' }), link('blog', 'wiki', { label: 'link' }), link('wiki', 'graph', { style: 'dashed' })],
        flows: [
          { path: ['news', 'wiki'], tone: 'data', label: 'vote', duration: 1.4 },
          { path: ['blog', 'wiki'], tone: 'data', label: 'vote', duration: 1.4, delay: 0.2 },
          { path: ['wiki', 'graph'], tone: 'data', label: 'store score', duration: 1.4, delay: 1.7 },
        ],
        panel: {
          title: 'Scores after the batch run',
          icon: 'TrendingUp',
          rows: [
            { text: 'guide page, 2 inbound links', value: '0.31', tone: 'good' },
            { text: 'news site', value: '0.18' },
            { text: 'blog', value: '0.07' },
            { text: 'copy with no inbound links', value: '0.01', tone: 'warn' },
          ],
          footer: { text: 'Query-independent, refreshed in batches', tone: 'muted' },
        },
        caption: 'Votes from important pages weigh more',
      },
      code: {
        language: 'python',
        title: 'PageRank by repeated steps',
        source: `def pagerank(links, iterations=20, d=0.85):
    n = len(links)
    rank = {p: 1 / n for p in links}
    for _ in range(iterations):
        new = {p: (1 - d) / n for p in links}
        for page, outs in links.items():
            for target in outs:
                new[target] += d * rank[page] / len(outs)
        rank = new
    return rank`,
        highlight: [5, 8, 9],
      },
    },
    {
      title: 'Doc partitioning',
      tag: 'tradeoff',
      heading: 'Split by document, not by word',
      eli5: 'Two ways to split a card box. Give each room a slice of the books with every word card for them, or give each room a slice of the alphabet. Book slices keep rooms evenly busy.',
      body: [
        '**Document partitioning:** each shard holds a complete inverted index for 1/N of the documents. Every query goes to every shard, but each shard does a small amount of work. Adding capacity is easy.',
        '**Term partitioning:** each shard holds whole posting lists for some terms. A query touches only the shards for its words, but a word like `the` overloads one shard and balancing is hard.',
      ],
      keyIdea: 'Large engines split by document. The price is that each query visits every shard.',
      metrics: { pages: '500B', qps: '100k', p99: '< 120 ms', shards: '10,000' },
      scene: {
        nodes: [
          { ...front, at: at(0, -3), label: 'query' },
          { ...shard(1, -4, 2.6), chips: ['docs 0 to N'] },
          { ...shard(2, 0, 2.6), chips: ['docs N to 2N'] },
          { ...shard(3, 4, 2.6), chips: ['docs 2N to 3N'] },
        ],
        links: [link('front', 's1'), link('front', 's2'), link('front', 's3')],
        flows: [
          { path: ['front', 's1'], tone: 'request', label: 'q', duration: 1.2 },
          { path: ['front', 's2'], tone: 'request', label: 'q', duration: 1.2 },
          { path: ['front', 's3'], tone: 'request', label: 'q', duration: 1.2 },
        ],
        panel: {
          title: 'Two ways to split',
          icon: 'Split',
          rows: [
            { text: 'By document: even load', value: 'chosen', tone: 'good' },
            { text: 'By document: every shard per query', value: 'cost', tone: 'warn' },
            { text: 'By term: one shard per word', value: 'cheap', tone: 'good' },
            { text: 'By term: "the" crushes a shard', value: 'skew', tone: 'bad' },
          ],
        },
        caption: 'Same query, every shard, small work each',
      },
    },
    {
      title: 'Index tiers',
      tag: 'concept',
      heading: 'Search the hot tier first, the cold tier on demand',
      eli5: 'Most kids want the same few popular shelves. So the front rooms hold the best books, and the back warehouse is only checked when the front rooms have too few answers.',
      body: [
        'Not every page deserves equal effort. A **hot tier** holds the top pages (high PageRank, often clicked) in memory, and a **cold tier** holds the long tail on cheaper disks. Each shard group searches the hot tier first and stops early if it finds enough good matches.',
        'Most queries finish in the hot tier, which cuts the work per query and is one reason a replica can serve far more than a flat scan. Rare queries fall through to the cold tier on demand.',
      ],
      keyIdea: 'Tiering spends memory on the pages that answer most queries and touches the long tail only when needed.',
      metrics: { pages: '500B', qps: '100k', p99: '< 120 ms', shards: '10,000' },
      scene: {
        nodes: [
          { ...agg, at: at(-5, 0) },
          { id: 'hot', kind: 'search', at: at(-0.6, -2.6), label: 'hot tier', sub: 'top pages, in memory', status: 'active' },
          { id: 'cold', kind: 'search', at: at(3.4, 2.6), label: 'cold tier', sub: 'long tail, on disk' },
        ],
        links: [link('agg', 'hot', { label: 'first' }), link('agg', 'cold', { style: 'dashed', label: 'if too few' })],
        flows: [
          { path: ['agg', 'hot', 'agg'], tone: 'request', label: 'most queries stop here', duration: 2 },
          { path: ['agg', 'cold', 'agg'], tone: 'request', label: 'rare fallthrough', duration: 2, delay: 2.2 },
        ],
        panel: {
          title: 'Two tiers',
          icon: 'Layers',
          rows: [
            { text: 'Hot tier', value: 'small, memory', tone: 'good' },
            { text: 'Cold tier', value: 'large, disk' },
            { text: 'Rare query', value: 'falls to cold', tone: 'warn' },
          ],
          footer: { text: 'Early termination saves most of the work', tone: 'muted' },
        },
        caption: 'Best pages first, the rest on demand',
      },
    },
    {
      title: 'Scatter-gather',
      tag: 'concept',
      heading: 'Fan out the query, merge the best answers',
      eli5: 'The head librarian shouts the question into every room. Each room sends back its three best books, and the librarian picks the overall best from those.',
      body: [
        'An **aggregator** sends the rewritten query to every shard (the scatter-gather pattern from the search index lesson). Each shard runs BM25 over its slice and returns only its **top K** as `(doc_id, score)`.',
        'The aggregator merges the lists and keeps the best. Nothing but small score lists crosses the network, and shards never need to talk to each other.',
      ],
      keyIdea: 'Each shard returns only its own top K. The aggregator merges small lists.',
      metrics: { pages: '500B', qps: '100k', p99: '120 ms', shards: '10,000' },
      scene: {
        nodes: [{ ...agg, at: at(0, -3) }, { ...shard(1, -4, 2.6), chips: [{ text: 'top 20', tone: 'good' }] }, { ...shard(2, 0, 2.6), chips: [{ text: 'top 20', tone: 'good' }] }, { ...shard(3, 4, 2.6), chips: [{ text: 'top 20', tone: 'good' }] }],
        links: [link('agg', 's1', { arrow: 'both' }), link('agg', 's2', { arrow: 'both' }), link('agg', 's3', { arrow: 'both' })],
        flows: [
          { path: ['agg', 's1'], tone: 'request', label: 'q', duration: 1.1 },
          { path: ['agg', 's2'], tone: 'request', label: 'q', duration: 1.1 },
          { path: ['agg', 's3'], tone: 'request', label: 'q', duration: 1.1 },
          { path: ['s1', 'agg'], tone: 'response', label: 'top 20', duration: 1.1, delay: 1.3 },
          { path: ['s2', 'agg'], tone: 'response', label: 'top 20', duration: 1.1, delay: 1.3 },
          { path: ['s3', 'agg'], tone: 'response', label: 'top 20', duration: 1.1, delay: 1.3 },
        ],
        panel: {
          title: 'One query',
          icon: 'Search',
          rows: [
            { text: 'Fan out to', value: '10,000 shards' },
            { text: 'Each shard ranks', value: 'its 10 GB slice' },
            { text: 'Each shard returns', value: 'top 20 ids and scores' },
            { text: 'Aggregator merges', value: 'lists, keeps best', tone: 'good' },
          ],
        },
        caption: 'Scatter the query, gather small lists',
      },
    },
    {
      title: 'Tail latency',
      tag: 'case',
      heading: 'The slowest shard sets the response time',
      eli5: 'The librarian cannot answer until every room replies. If one room helper stops to tie a shoe, every kid waits for that one room.',
      body: [
        'The aggregator needs every reply, so a query is as slow as its slowest shard. Say any single call is slow 1% of the time. With 100 shards, **63%** of queries hit a slow one. With 10,000 shards it is **almost every query**.',
        'A garbage collection pause, a busy disk or a noisy neighbor is enough. A rare slowdown on one machine becomes the normal case for the whole fleet.',
      ],
      keyIdea: 'Fan-out turns rare slow calls into common slow queries. Latency is judged at the tail, not the average.',
      metrics: { pages: '500B', qps: '100k', p99: '900 ms', shards: '10,000' },
      metricTones: { p99: 'bad' },
      scene: {
        nodes: [{ ...agg, at: at(0, -3), status: 'active', badge: 'waiting' }, { ...shard(1, -4, 2.6), badge: '12 ms' }, { ...shard(2, 0, 2.6), status: 'hot', load: 97, badge: '900 ms' }, { ...shard(3, 4, 2.6), badge: '14 ms' }],
        links: [link('agg', 's1', { arrow: 'both' }), link('agg', 's2', { arrow: 'both', label: 'slow', labelTone: 'bad' }), link('agg', 's3', { arrow: 'both' })],
        flows: [
          { path: ['agg', 's1', 'agg'], tone: 'request', duration: 1.2 },
          { path: ['agg', 's3', 'agg'], tone: 'request', duration: 1.2 },
          { path: ['agg', 's2', 'agg'], tone: 'error', label: 'still waiting', duration: 3.6 },
        ],
        panel: {
          title: 'Chance a query meets a slow call',
          icon: 'Timer',
          rows: [
            { text: '1 shard', value: '1%' },
            { text: '100 shards', value: '63%', tone: 'warn' },
            { text: '10,000 shards', value: '~100%', tone: 'bad' },
          ],
          footer: { text: '1 - 0.99^N, with 1% slow calls', tone: 'muted' },
        },
        caption: 'One slow shard holds the whole answer',
      },
    },
    {
      title: 'Hedging',
      tag: 'concept',
      heading: 'Hedged requests and a time budget',
      eli5: 'If one room is slow, the librarian asks a second room that has the same books. She uses whichever answers first, and after a set time she answers with what she has.',
      body: [
        'Each shard has copies. If a call has not returned by about the p95 latency, send the same call to a second replica and use whichever answers first. About 5% of calls get duplicated, and the slow tail mostly disappears.',
        'Set a **deadline** too, say 150 ms for the whole scatter-gather, which typically finishes by 120 ms (p99). When it runs out, answer with the shards that replied and flag the result as partial. A slightly incomplete page beats a timeout.',
      ],
      keyIdea: 'Hedge slow calls to a replica, and cap the wait. Spend 5% more work to cut the tail.',
      metrics: { pages: '500B', qps: '100k', p99: '120 ms', shards: '10,000' },
      metricTones: { p99: 'good' },
      scene: {
        nodes: [
          { ...agg, at: at(-5, 0) },
          { ...shard(2, -1.4, -2.4), status: 'hot', badge: 'slow' },
          { id: 's2b', kind: 'replica', at: at(2, 2.4), label: 'shard 2 copy', sub: 'same slice' },
          { id: 'ok1', kind: 'block', size: 0.72, at: at(5.6, -2.4), label: 'response', sub: 'first reply wins', icon: 'Zap', tint: 'green' },
        ],
        links: [link('agg', 's2'), link('agg', 's2b', { style: 'dashed', label: 'hedge' }), link('s2b', 'ok1', { style: 'dashed' })],
        flows: [
          { path: ['agg', 's2'], tone: 'request', label: 'q', duration: 1.3 },
          { path: ['agg', 's2b'], tone: 'event', label: 'hedge at 30 ms', duration: 1.3, delay: 1.0 },
          { path: ['s2b', 'ok1'], tone: 'response', label: 'top 20', duration: 1.2, delay: 2.4 },
        ],
        panel: {
          title: 'Tail controls',
          icon: 'Timer',
          rows: [
            { text: 'Hedge after', value: 'p95 (30 ms)' },
            { text: 'Extra load', value: 'about 5%', tone: 'good' },
            { text: 'Deadline', value: '150 ms' },
            { text: 'Late shard', value: 'drop, flag partial', tone: 'warn' },
          ],
        },
        caption: 'A second ask beats waiting',
      },
      code: {
        language: 'typescript',
        title: 'Hedged call with a budget',
        source: `async function callShard(shard: Shard, q: Query): Promise<Hit[]> {
  const primary = shard.primary.search(q);
  let timer: ReturnType<typeof setTimeout>;
  const hedge = new Promise<Hit[]>((resolve, reject) => {
    timer = setTimeout(() => shard.replica.search(q).then(resolve, reject), hedgeAfterMs);
  });
  try {
    return await Promise.any([primary, hedge]);   // first success wins
  } finally {
    clearTimeout(timer!);                         // primary was fast: no hedge sent
  }
}

async function fanOut(shards: Shard[], q: Query) {
  const lists: Hit[][] = [];
  const calls = shards.map((s) => callShard(s, q).then((r) => { lists.push(r); }, () => {}));
  await Promise.race([Promise.allSettled(calls), sleep(150)]);   // 150 ms deadline
  return { lists: [...lists], partial: lists.length < shards.length };
}`,
        highlight: [5, 8, 10, 17, 18],
      },
    },
    {
      title: 'Replica groups',
      tag: 'concept',
      heading: 'Copies of each shard for load and survival',
      eli5: 'Each room has three identical copies of its shelves. Kids are spread across the copies, and if one copy floods, the other two still open.',
      body: [
        'Every shard group sees every query. 100k QPS globally, half answered by the result cache, leaves 50k. Over 5 regions that is 10k each, and an in-memory 10 GB slice with early termination serves about 5k QPS. So 2 replicas for throughput plus 1 for zone availability: **3 per shard per region**.',
        'At a naive 1k QPS per box it would be 10 replicas. Replicas are copies of immutable files, so there is no live write path and no consensus to run.',
      ],
      keyIdea: 'Shards give size. Replicas give throughput and availability, and the query rate sets how many. Immutable index files make replicas simple.',
      metrics: { pages: '500B', qps: '100k', p99: '120 ms', shards: '10,000 × 3' },
      scene: {
        nodes: [
          { ...agg, at: at(0, -3) },
          { id: 'r1', kind: 'replica', at: at(-4, 2.6), label: 'shard 7 copy 1', sub: 'rack A' },
          { id: 'r2', kind: 'replica', at: at(0, 2.6), label: 'shard 7 copy 2', sub: 'rack B', status: 'down', badge: 'down' },
          { id: 'r3', kind: 'replica', at: at(4, 2.6), label: 'shard 7 copy 3', sub: 'rack C' },
        ],
        links: [link('agg', 'r1'), link('agg', 'r2', { style: 'faint' }), link('agg', 'r3')],
        flows: [
          { path: ['agg', 'r1', 'agg'], tone: 'request', label: 'q', duration: 1.8 },
          { path: ['agg', 'r3', 'agg'], tone: 'request', label: 'q', duration: 1.8, delay: 1 },
        ],
        panel: {
          title: 'Replica group',
          icon: 'Copy',
          rows: [
            { text: 'Copies per shard, per region', value: '3' },
            { text: 'Racks and zones', value: 'different' },
            { text: 'QPS per region after cache', value: '10k' },
            { text: 'Servers per region', value: '30,000', tone: 'muted' },
            { text: 'Across 5 regions', value: '150,000', tone: 'muted' },
            { text: 'One copy down', value: 'still serving', tone: 'good' },
          ],
          footer: { text: 'Illustrative sizing', tone: 'muted' },
        },
        caption: 'A dead copy changes nothing for users',
      },
    },
    {
      title: 'Aggregator tree',
      tag: 'concept',
      heading: 'One aggregator cannot merge ten thousand lists',
      eli5: 'If one librarian listens to every room, she is swamped. So each floor has a floor librarian who gathers its rooms, and the head librarian only hears from the floors.',
      body: [
        'With 10,000 shards at top 20 each, a single aggregator would merge 200,000 candidates per query, and open 10,000 connections. That is too much for one box at 100k queries per second.',
        'Use a **tree**: a root fans out to mid-level aggregators, each covering about 100 shards. A mid-level node keeps its best 50, so the root merges 5,000 candidates.',
      ],
      keyIdea: 'Merge in stages. Each level cuts the data and the fan-out before the next one sees it.',
      metrics: { pages: '500B', qps: '100k', p99: '120 ms', shards: '10,000 × 3' },
      scene: {
        nodes: [
          { ...agg, at: at(-5.4, 0), label: 'root', sub: 'merges 5,000' },
          { id: 'midA', kind: 'block', size: 0.72, at: at(-1.4, -2.4), label: 'mid 1', sub: 'keeps top 50', icon: 'Split', tint: 'violet' },
          { id: 'midB', kind: 'block', size: 0.72, at: at(-1.4, 2.4), label: 'mid 100', sub: 'keeps top 50', icon: 'Split', tint: 'violet' },
          { id: 'leafA', kind: 'search', at: at(3.6, -2.4), label: 'shards 1-100' },
          { id: 'leafB', kind: 'search', at: at(3.6, 2.4), label: 'shards 9,901-10,000' },
        ],
        links: [link('agg', 'midA', { arrow: 'both' }), link('agg', 'midB', { arrow: 'both' }), link('midA', 'leafA', { arrow: 'both' }), link('midB', 'leafB', { arrow: 'both' })],
        flows: [
          { path: ['agg', 'midA', 'leafA'], tone: 'request', label: 'q', duration: 1.6 },
          { path: ['agg', 'midB', 'leafB'], tone: 'request', label: 'q', duration: 1.6 },
          { path: ['leafA', 'midA', 'agg'], tone: 'response', label: 'top 20 each', duration: 1.6, delay: 1.8 },
          { path: ['leafB', 'midB', 'agg'], tone: 'response', label: 'top 20 each', duration: 1.6, delay: 1.8 },
        ],
        panel: {
          title: 'Fan-in at each level',
          icon: 'Network',
          rows: [
            { text: 'Shards return', value: '200,000 candidates' },
            { text: '100 mids each keep', value: 'top 50' },
            { text: 'Root merges', value: '5,000', tone: 'good' },
            { text: 'Root passes on', value: 'top 1,000' },
          ],
        },
        caption: 'Two levels keep every merge small',
      },
    },
    {
      title: 'Part 1 recap',
      tag: 'recap',
      heading: 'Index offline, shard by document, merge in a tree',
      eli5: 'The library has night crews who write the cards, many rooms with copies, floor librarians who gather answers, and a trick of asking a second room when one is slow.',
      body: [
        'The index is built offline from the doc store, and PageRank comes from the link graph. It is split by document into 10,000 shards, each with replicas. A tree of aggregators scatters the query and gathers each shard top K.',
        'Hedged requests and a 150 ms deadline keep scatter-gather p99 near 120 ms. Part 2 adds 5 ms of rewrite and 25 ms of re-rank and snippets, about 150 ms end to end. Part 2 covers the ranking cascade, query understanding, snippets, caching, freshness and failures.',
      ],
      keyIdea: 'Precompute, split by document, fan out through a tree, and spend a little extra work to tame the tail.',
      metrics: { pages: '500B', qps: '100k', p99: '120 ms', shards: '10,000 × 3' },
      metricTones: { p99: 'good', shards: 'good' },
      scene: {
        nodes: [{ ...user, at: at(-5.4, 0) }, { ...front, at: at(-2, 0) }, { ...agg, id: 'agg', at: at(1.4, 0), label: 'aggregators', sub: 'tree' }, { ...shard(1, 4.8, 0), sub: '× 10,000 × 3' }],
        links: [link('user', 'front'), link('front', 'agg'), link('agg', 's1', { arrow: 'both' })],
        flows: [
          { path: ['user', 'front', 'agg', 's1'], tone: 'request', label: 'query', duration: 2.4 },
          { path: ['s1', 'agg', 'front', 'user'], tone: 'response', label: 'merged top K', duration: 2.4, delay: 2.5 },
        ],
        panel: {
          title: 'Part 1 in numbers',
          icon: 'Gauge',
          rows: [
            { text: 'Corpus / index', value: '500 TB / 100 TB' },
            { text: 'Shards × replicas', value: '10,000 × 3' },
            { text: 'Scatter-gather p99 with hedging', value: '120 ms', tone: 'good' },
          ],
        },
        caption: 'Part 1: build, shard, scatter, gather',
      },
      quiz: {
        question: 'A query fans out to 10,000 shards and each call is slow 1% of the time. About what share of queries wait on at least one slow shard?',
        options: ['1%', 'About 10%', 'About 63%', 'Nearly all of them'],
        answer: 3,
        explain: 'The chance that all 10,000 calls are fast is 0.99^10,000, which is close to zero. So almost every query meets a slow call. Hedged requests and a time budget are the fix.',
      },
    },
  ],
};
