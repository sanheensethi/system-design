import type { Lesson, SceneNode } from '../engine/types';

/** Place a node by screen column (u = x - y) and screen row (v = x + y). */
const p = (u: number, v: number): [number, number] => [(u + v) / 2, (v - u) / 2];

const user: SceneNode = { id: 'user', kind: 'phone', at: p(-9, 3), label: 'searcher', sub: 'types "din"' };
const edge: SceneNode = { id: 'edge', kind: 'cdn', at: p(-6, 3), label: 'browser + CDN', sub: 'cached prefixes' };
const svc: SceneNode = { id: 'svc', kind: 'server', at: p(-3, 3), label: 'suggest API', sub: 'stateless' };
const filter: SceneNode = { id: 'filter', kind: 'limiter', at: p(0, 3), label: 'safety filter', sub: 'blocklist' };
const cache: SceneNode = { id: 'cache', kind: 'cache', at: p(3, 3), label: 'prefix cache', sub: 'Redis · hot prefixes' };
const trie: SceneNode = { id: 'trie', kind: 'search', at: p(6, 3), label: 'trie servers', sub: '~45 GB in RAM' };
const sql: SceneNode = { id: 'sql', kind: 'db', at: p(3, 3), label: 'queries table', sub: 'query, count' };

const logs: SceneNode = { id: 'logs', kind: 'queue', at: p(-3, -3.5), label: 'query log', sub: '~90 GB/day' };
const agg: SceneNode = { id: 'agg', kind: 'worker', at: p(0, -3.5), label: 'aggregator', sub: 'daily batch' };
const builder: SceneNode = { id: 'builder', kind: 'worker', at: p(3, -3.5), label: 'trie builder', sub: 'top 10 per node' };
const snaps: SceneNode = { id: 'snaps', kind: 'storage', at: p(6, -3.5), label: 'trie snapshots', sub: 'object storage' };
const trend: SceneNode = { id: 'trend', kind: 'worker', at: p(-6, -3.5), label: 'trend counter', sub: '5 min windows' };

const shardMap: SceneNode = { id: 'shardMap', kind: 'service', at: p(0, -3.5), label: 'shard map', sub: 'prefix ranges' };
const shardA: SceneNode = { id: 'shardA', kind: 'shard', at: p(1, 3), label: 'shard a to m', sub: '150 GB' };
const shardS: SceneNode = { id: 'shardS', kind: 'shard', at: p(4.5, 3), label: 'shard n to s', sub: '150 GB' };
const shardT: SceneNode = { id: 'shardT', kind: 'shard', at: p(8, 3), label: 'shard t to z', sub: '100 GB' };

const servePath = [
  { from: 'user', to: 'edge' },
  { from: 'edge', to: 'svc' },
  { from: 'svc', to: 'cache' },
  { from: 'cache', to: 'trie' },
];

const buildPath = [
  { from: 'logs', to: 'agg' },
  { from: 'agg', to: 'builder' },
  { from: 'builder', to: 'snaps' },
  { from: 'snaps', to: 'trie', style: 'dashed' as const },
  { from: 'svc', to: 'logs', style: 'faint' as const },
];

export const designSearchAutocomplete: Lesson = {
  id: 'design-search-autocomplete',
  title: 'Design search autocomplete',
  tagline: 'Return the ten best completions for every keystroke in well under 100 ms, for hundreds of millions of people.',
  minutes: 18,
  level: 'Intermediate',
  learn: [
    'Why a trie with the top suggestions cached at every node answers in one walk',
    'Building the trie offline from aggregated query logs, then serving it from RAM',
    'Debouncing and browser caching to cut requests before they leave the device',
    'Sharding the trie by prefix when some letters are far busier than others',
    'Filtering harmful suggestions and adding trending queries without a rebuild',
  ],
  metrics: [
    { key: 'qps', label: 'Peak requests' },
    { key: 'p99', label: 'p99 latency' },
    { key: 'ram', label: 'Trie in RAM' },
    { key: 'fresh', label: 'Freshness' },
  ],
  steps: [
    {
      title: 'Requirements',
      tag: 'problem',
      heading: 'Ten suggestions per keystroke, faster than the next keystroke',
      eli5: 'A kid at the library desk says "din" and the librarian must name ten likely books before the kid says the next letter. That guessing is **autocomplete**, and thousands of kids are asking at once.',
      body: [
        'Functional scope: as the user types, show the **top 10** completions for the current prefix, ranked by how often people searched them. English first, lowercase text, no personal history yet. The list should feel instant, so the budget is **under 100 ms** end to end at p99, which leaves about 20 ms inside our servers once the network takes its share.',
        'Scale: **150M daily users**, about 10 searches each, about 20 characters per search. One request per keystroke is 30 billion requests a day, roughly 350K per second on average and **700K per second** at peak. Reads dominate completely. Writes are the query log, which the system can process later.',
        'Two answers matter less than they seem. Suggestions can be a day old and nobody notices, and missing a rare query is fine. Those two relaxations shape the whole design.',
      ],
      keyIdea: 'Autocomplete is a read-only, latency-bound lookup. Freshness and completeness can be traded away for speed.',
      metrics: { qps: '700K/s', p99: 'target 100 ms', ram: '-', fresh: 'a day is fine' },
      scene: {
        nodes: [{ ...user, status: 'active', badge: '1 request per key' }, { ...svc, status: 'active', badge: '700K/s peak' }],
        links: [{ from: 'user', to: 'svc' }],
        flows: [
          { path: ['user', 'svc'], tone: 'request', label: 'd', duration: 0.8 },
          { path: ['user', 'svc'], tone: 'request', label: 'di', duration: 0.8, delay: 0.5 },
          { path: ['user', 'svc'], tone: 'request', label: 'din', duration: 0.8, delay: 1 },
          { path: ['svc', 'user'], tone: 'response', label: '10 suggestions', duration: 0.8, delay: 1.9 },
        ],
        caption: 'Every keystroke is a request with a 100 ms budget',
      },
    },
    {
      title: 'API and data',
      tag: 'concept',
      heading: 'One GET, and a log of everything people searched',
      eli5: 'The kid asks one question: "what starts with din?" Every finished request also goes on a slip in a big **log** box, so the librarian can count later which books kids want most.',
      body: [
        'The read API is one call: `GET /v1/suggest?q=din&locale=en-US&k=10`, returning a list of strings with optional scores. It is a pure function of the prefix and locale, which makes it cacheable at every layer (the caching lesson and the CDN lesson both apply).',
        'The write side is separate. When a user submits a search, the search service appends `(query, locale, timestamp)` to a **query log** on a stream (the message queues lesson). At 1.5B searches a day and about 60 bytes per record, that is **~90 GB a day** of raw log.',
        'From the log we derive one table, `query_counts(locale, query, weighted_count)`, and from that table we build the structure that serves reads. The serving path never writes, and the logging path never blocks a keystroke.',
      ],
      keyIdea: 'Split the system in two: a cheap, cacheable read API and an append-only log that feeds an offline build.',
      metrics: { qps: '700K/s', p99: 'target 100 ms', ram: '-', fresh: 'a day is fine' },
      scene: {
        nodes: [user, { ...svc, status: 'active' }, { ...logs, status: 'active', badge: 'append only' }],
        links: [{ from: 'user', to: 'svc' }, { from: 'svc', to: 'logs', style: 'dashed' }],
        flows: [
          { path: ['user', 'svc'], tone: 'request', label: 'GET /suggest?q=din', duration: 1 },
          { path: ['svc', 'user'], tone: 'response', label: '["dinner ideas", ...]', duration: 1, delay: 1.1 },
          { path: ['svc', 'logs'], tone: 'event', label: 'searched "dinner recipes"', duration: 1.2, delay: 2.3 },
        ],
        caption: 'Reads and writes take different paths',
      },
      code: {
        language: 'json',
        title: 'GET /v1/suggest?q=din&locale=en-US&k=10',
        source: `{
  "prefix": "din",
  "suggestions": [
    { "text": "dinner ideas", "score": 98120 },
    { "text": "dinner recipes", "score": 87403 },
    { "text": "dinosaur", "score": 61277 },
    { "text": "dinner near me", "score": 55190 }
  ],
  "version": "2026-11-16"
}`,
        highlight: [2, 9],
      },
    },
    {
      title: 'Simple design',
      tag: 'case',
      heading: 'Version one: LIKE over a table of counts',
      eli5: 'For every question the librarian walks the whole aisle of slips that start with "d", counts them up, and picks the top ten. It works for one kid. With a crowd, the **database** line never moves.',
      body: [
        'The obvious build: keep `query_counts` in a SQL database and run `SELECT query FROM query_counts WHERE query LIKE \'din%\' ORDER BY weighted_count DESC LIMIT 10`. An index on `query` turns the prefix into a range scan, so it looks fine in testing.',
        'It breaks on short prefixes. The range for `d` holds millions of rows, and the database must read all of them to sort by count before it can return ten. One-letter and two-letter prefixes are also the most frequent requests, because every search starts with them. p99 climbs to seconds.',
        'Add 700K requests per second and no amount of read replicas saves it (the replication lesson). The work per request is the problem, so the fix has to change the data structure.',
      ],
      keyIdea: 'A prefix index finds matches fast, but ranking them means touching all of them, and short prefixes match everything.',
      metrics: { qps: '700K/s', p99: '3 s', ram: '-', fresh: 'live' },
      scene: {
        nodes: [user, { ...svc, status: 'hot' }, { ...sql, status: 'hot', badge: 'scan 4M rows for "d"' }],
        links: [{ from: 'user', to: 'svc' }, { from: 'svc', to: 'sql' }],
        flows: [
          { path: ['user', 'svc'], tone: 'request', count: 5, duration: 0.9 },
          { path: ['svc', 'sql'], tone: 'request', label: "LIKE 'd%' ORDER BY count", count: 5, duration: 1, delay: 0.9 },
          { path: ['sql', 'svc'], tone: 'error', label: 'timeout', duration: 1.4, delay: 2.2 },
        ],
        caption: 'Short prefixes match millions of rows',
      },
    },
    {
      title: 'Trie + top-k',
      tag: 'concept',
      heading: 'A trie that stores its answers at every node',
      eli5: 'The librarian builds a tree of drawers: d, then di, then din. Each drawer holds a card with its ten best books already written on it. Answering is opening one drawer, so this tree is a **trie** with answers inside.',
      body: [
        'A **trie** stores strings by their characters: the root branches on the first letter, each child on the next one. Finding the node for `din` takes three hops. A plain trie still has the old problem, because finding the best completions means walking the whole subtree under that node.',
        'So we precompute. Each node stores the **top 10 completions in its subtree**, with their counts. A lookup walks `p` characters and reads a ready list: O(p) work, no sorting. We also cap stored prefixes at about 30 characters, since almost nobody types longer before choosing a suggestion.',
        'The cost is memory and build time. With about 100M distinct queries kept, roughly 600M nodes each holding ten 4-byte query ids plus children, the English trie comes to **~45 GB**. That fits in RAM on one large server, and updating a count means fixing the lists on every ancestor, which is why we build it in batch.',
      ],
      keyIdea: 'Caching the top-k list at every node turns a subtree search into a fixed-cost walk of the prefix.',
      metrics: { qps: '700K/s', p99: '45 ms', ram: '~45 GB', fresh: 'live' },
      scene: {
        nodes: [user, svc, { ...trie, status: 'ok', badge: 'walk d → i → n' }],
        links: [{ from: 'user', to: 'svc' }, { from: 'svc', to: 'trie' }],
        flows: [
          { path: ['user', 'svc'], tone: 'request', label: 'din', duration: 0.9 },
          { path: ['svc', 'trie'], tone: 'request', label: '3 hops', duration: 1, delay: 1 },
          { path: ['trie', 'svc'], tone: 'response', label: 'top 10, precomputed', duration: 1, delay: 2.1 },
          { path: ['svc', 'user'], tone: 'response', duration: 0.9, delay: 3.2 },
        ],
        caption: 'One walk, one ready-made list',
      },
      code: {
        language: 'python',
        title: 'Trie node with a cached top-k list',
        source: `import heapq

K, MAX_PREFIX = 10, 30

class Node:
    __slots__ = ("children", "top")
    def __init__(self):
        self.children = {}   # char -> Node
        self.top = []        # [(count, query)], best first, at most K

def build(counts):           # counts: {query: weighted_count}
    root = Node()
    for query, n in counts.items():
        node = root
        for ch in query[:MAX_PREFIX]:
            node = node.children.setdefault(ch, Node())
            node.top.append((n, query))
    stack = [root]           # trim every list to the best K
    while stack:
        node = stack.pop()
        node.top = heapq.nlargest(K, node.top)
        stack.extend(node.children.values())
    return root

def suggest(root, prefix):
    node = root
    for ch in prefix[:MAX_PREFIX]:
        node = node.children.get(ch)
        if node is None:
            return []
    return [q for _, q in node.top]   # O(len(prefix)), no sorting`,
        highlight: [9, 17, 21, 31],
      },
      quiz: {
        question: 'Why store the top 10 completions on every trie node instead of only on the leaves?',
        options: [
          'It makes the trie smaller in memory',
          'A lookup then reads one list after walking the prefix, instead of searching the whole subtree',
          'It lets the trie accept writes in real time',
          'It removes the need to cap prefix length',
        ],
        answer: 1,
        explain: 'Without the cached list, the prefix "d" would require visiting millions of descendants to rank them. With it, the work is a few hops. The price is more memory and a harder update, which is why the trie is rebuilt in batch.',
      },
    },
    {
      title: 'Offline build',
      tag: 'concept',
      heading: 'Build the trie from logs, offline, once a day',
      eli5: 'Every night the librarian empties the slip box, counts which books were asked for, and writes fresh cards for all the drawers. That nightly counting and card-making is the **offline build**.',
      body: [
        'The query log lands in object storage in hourly files. A daily **aggregation** job (the background jobs lesson) groups by locale and query and computes a weighted count, where recent days weigh more than older ones, so last month\'s fad fades out. Queries searched by only a handful of people are dropped. They add memory and are a privacy risk.',
        'The **trie builder** reads the aggregated table, builds the trie with top-k lists, and writes a serialized **snapshot** to object storage with a version stamp. Trie servers download the new snapshot, load it beside the old one, and swap a pointer. Readers never see a half-built trie.',
        'This is the freshness trade we accepted at the start: suggestions are up to a day old. Breaking news is the exception, and it gets its own path later.',
      ],
      keyIdea: 'Aggregate the logs in batch, build an immutable trie, and swap whole snapshots. Serving never waits on writes.',
      metrics: { qps: '700K/s', p99: '45 ms', ram: '~45 GB', fresh: '24 h' },
      scene: {
        nodes: [svc, { ...logs, status: 'active' }, { ...agg, status: 'active', badge: 'GROUP BY query' }, { ...builder, status: 'active' }, { ...snaps, badge: 'v2026-11-16' }, { ...trie, badge: 'swap pointer' }],
        links: buildPath,
        flows: [
          { path: ['svc', 'logs'], tone: 'event', count: 3, duration: 1 },
          { path: ['logs', 'agg'], tone: 'data', label: '90 GB/day', duration: 1, delay: 1 },
          { path: ['agg', 'builder'], tone: 'data', label: '100M queries', duration: 1, delay: 2.1 },
          { path: ['builder', 'snaps'], tone: 'data', label: 'snapshot', duration: 1, delay: 3.2 },
          { path: ['snaps', 'trie'], tone: 'data', label: 'load + swap', duration: 1.2, delay: 4.3 },
        ],
        caption: 'Logs in, a fresh immutable trie out, every day',
      },
      code: {
        language: 'sql',
        title: 'Daily aggregation with time decay',
        source: `-- weight each day's searches by recency, drop rare queries
INSERT INTO query_counts (locale, query, weighted_count, built_on)
SELECT locale,
       lower(trim(query)) AS query,
       SUM(POWER(0.9, date_diff('day', day, CURRENT_DATE))) AS weighted_count,
       CURRENT_DATE
FROM search_log_daily
WHERE day >= CURRENT_DATE - INTERVAL '28' DAY
GROUP BY locale, lower(trim(query))
HAVING COUNT(DISTINCT user_id) >= 20;   -- privacy and memory floor`,
        highlight: [5, 10],
      },
    },
    {
      title: 'Serve from RAM',
      tag: 'concept',
      heading: 'Serve from memory, with a cache in front',
      eli5: 'The ten most asked-for cards sit right on the front desk, the **prefix cache**. Most kids get their answer there, and only unusual questions send the librarian back to the drawers.',
      body: [
        'The trie lives entirely in RAM on a pool of **trie servers**, each holding a full copy. A lookup costs microseconds, so one server handles tens of thousands of requests per second and the pool is sized by request rate, with a few spare for failures. The suggest API in front stays stateless and scales on its own (the load balancing lesson).',
        'Traffic is very skewed. A few thousand short prefixes (`a`, `th`, `how to`) carry a large share of requests. A **prefix cache** in Redis keyed by `locale:prefix`, with a TTL matching the build cycle, answers those before they reach a trie server. A hit rate around 70% is realistic for this workload.',
        'The cache key includes the snapshot version, so a new build does not mix old and new lists. When the snapshot swaps, the new keys warm up within minutes from the hottest prefixes.',
      ],
      keyIdea: 'Keep the whole trie in RAM for predictable speed, and let a small cache absorb the hottest prefixes.',
      metrics: { qps: '700K/s', p99: '40 ms', ram: '~45 GB', fresh: '24 h' },
      scene: {
        nodes: [user, { ...svc, status: 'active' }, { ...cache, status: 'ok', badge: '70% hits' }, { ...trie, status: 'active', badge: '30% misses' }],
        links: [{ from: 'user', to: 'svc' }, { from: 'svc', to: 'cache' }, { from: 'cache', to: 'trie' }],
        flows: [
          { path: ['user', 'svc'], tone: 'request', count: 4, duration: 0.9 },
          { path: ['svc', 'cache', 'svc'], tone: 'response', label: 'hit "how to"', count: 3, duration: 1.4, delay: 1 },
          { path: ['cache', 'trie'], tone: 'request', label: 'miss "dinosaur fo"', duration: 1, delay: 1.6 },
          { path: ['trie', 'cache'], tone: 'response', duration: 1, delay: 2.7 },
        ],
        caption: 'Hot prefixes stop at the cache',
      },
    },
    {
      title: 'Client side',
      tag: 'concept',
      heading: 'Debounce, cancel, and let the browser cache',
      eli5: 'The librarian waits until the kid pauses before guessing, and the kid keeps a little **notebook** of answers already heard. Rubbing out a letter means checking the notebook, not asking again.',
      body: [
        'Most keystrokes do not need a request. **Debouncing** waits until typing pauses for about 100 ms and sends only the latest prefix. Fast typists skip most intermediate prefixes, and our 20 requests per search drop to about 6. The client also cancels any request still in flight when a newer one starts, so an old answer can never overwrite a newer one.',
        'The response carries `Cache-Control: public, max-age=300`. Backspacing from `dinn` to `din` is then answered from the **browser cache** with no network at all, and a CDN in front of the API (the CDN lesson) absorbs the most popular prefixes for everyone in a region. Personalized suggestions would need `private`, which is a reason to keep personalization as a separate, small call.',
        'Together these cut peak traffic reaching our servers from 700K to about **125K requests per second**, before any server-side work.',
      ],
      keyIdea: 'The cheapest request is the one the client never sends. Debounce, cancel stale calls, and make responses cacheable.',
      metrics: { qps: '125K/s', p99: '30 ms', ram: '~45 GB', fresh: '24 h' },
      scene: {
        nodes: [{ ...user, status: 'active', badge: 'waits 100 ms' }, { ...edge, status: 'ok', badge: 'max-age=300' }, svc, cache, trie],
        links: servePath,
        flows: [
          { path: ['user', 'edge'], tone: 'request', label: 'din (after pause)', duration: 1 },
          { path: ['edge', 'user'], tone: 'response', label: 'cached', duration: 1, delay: 1.1 },
          { path: ['user', 'edge', 'svc'], tone: 'request', label: 'dinosaur f', duration: 1.4, delay: 2.3 },
          { path: ['svc', 'cache', 'trie'], tone: 'request', duration: 1.2, delay: 3.8 },
        ],
        caption: '700K keystrokes per second become 125K requests',
      },
      code: {
        language: 'typescript',
        title: 'Debounce and cancel in the search box',
        source: `const DEBOUNCE_MS = 100;
let timer: ReturnType<typeof setTimeout> | undefined;
let inflight: AbortController | undefined;

input.addEventListener('input', () => {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    const prefix = input.value.trim().toLowerCase();
    if (!prefix) return render([]);
    inflight?.abort();                       // drop the older request
    inflight = new AbortController();
    const res = await fetch(\`/v1/suggest?q=\${encodeURIComponent(prefix)}&k=10\`, {
      signal: inflight.signal,               // browser cache answers repeats
    });
    render((await res.json()).suggestions);
  }, DEBOUNCE_MS);
});`,
        highlight: [6, 7, 10, 13],
      },
    },
    {
      title: 'Hot letters',
      tag: 'case',
      heading: 'Case: twenty languages, and the letter s is on fire',
      eli5: 'Too many drawers for one librarian, so three librarians split them by letter. Lots of books start with s and few with x, so the s librarian is swamped. Splitting the drawers by how busy they are is **sharding by prefix**.',
      body: [
        'The product launches in 20 locales. All tries together reach about **400 GB**, too much for one server\'s RAM. We shard by prefix (the sharding lesson): the first try gives each letter range its own trie servers. Within a day the shard holding `s` runs at 3x the load of the others, while the `x`, `y`, `z` servers idle. p99 on that shard jumps to 400 ms.',
        'Letters are not uniform, in size or in traffic. The fix is to split by measured load: a **shard map** service holds ranges like `a to m`, `n to s`, `t to z` chosen from yesterday\'s request counts and node counts, and moves a boundary (say `sa to sm` versus `sn to sz`) when a range runs hot. The builder cuts each snapshot along the same ranges.',
        'The hottest prefixes are one or two characters long. Their answers are tiny, so we also replicate them to every shard and cache them at the edge. A hot shard gets extra replicas rather than a bigger box. The suggest API reads the map and routes each prefix to its shard.',
      ],
      keyIdea: 'Shard on measured load. Skewed keys need movable ranges, extra replicas and caching for the hottest prefixes.',
      metrics: { qps: '125K/s', p99: '400 ms → 35 ms', ram: '~400 GB, 3 shards', fresh: '24 h' },
      scene: {
        nodes: [
          user,
          { ...svc, status: 'active', badge: 'route by prefix' },
          { ...shardMap, status: 'active', badge: 'move boundary' },
          { ...shardA, status: 'ok' },
          { ...shardS, status: 'hot', badge: '3x load on "s"' },
          { ...shardT, status: 'dim', badge: 'mostly idle' },
        ],
        links: [
          { from: 'user', to: 'svc' },
          { from: 'svc', to: 'shardMap', style: 'dashed' },
          { from: 'svc', to: 'shardA' },
          { from: 'svc', to: 'shardS' },
          { from: 'svc', to: 'shardT' },
        ],
        flows: [
          { path: ['user', 'svc'], tone: 'request', count: 4, duration: 0.9 },
          { path: ['svc', 'shardMap'], tone: 'request', label: 'which shard has "sho"?', duration: 1, delay: 1 },
          { path: ['svc', 'shardS'], tone: 'request', label: 's...', count: 5, duration: 1.2, delay: 2.1 },
          { path: ['svc', 'shardA'], tone: 'request', duration: 1.2, delay: 2.1 },
          { path: ['svc', 'shardT'], tone: 'request', duration: 1.6, delay: 2.6 },
        ],
        caption: 'The alphabet is a bad shard key',
      },
    },
    {
      title: 'Safety filter',
      tag: 'concept',
      heading: 'Never suggest something harmful',
      eli5: 'Some cards have mean or unsafe titles on them. A grown-up checks every card before the kid sees it and crosses out bad ones at once. That checker is the **safety filter**.',
      body: [
        'Popularity is not approval. People search for hateful, sexual, violent and defamatory phrases, and a suggestion puts words in the user\'s mouth. Some suggestions also have to vanish for legal reasons, such as a court order or a privacy request.',
        'There are two layers. At build time, the aggregator drops queries matching blocklists and a classifier, so most bad text never reaches the trie. At serve time, a **safety filter** in the suggest API checks each returned item against a small, live blocklist. Since each node keeps only 10, we store about 15 per node so filtering still leaves a full list.',
        'The live layer exists because the batch layer is a day behind. When a harmful suggestion is reported at 3 PM, an operator adds it to the blocklist and it disappears worldwide within a minute, with no rebuild. The next build removes it for good.',
      ],
      keyIdea: 'Filter during the build for scale, and filter again at serve time so removals take effect in minutes.',
      metrics: { qps: '125K/s', p99: '35 ms', ram: '~400 GB, 3 shards', fresh: '24 h' },
      scene: {
        nodes: [user, edge, { ...svc, status: 'active' }, { ...filter, status: 'active', badge: 'removed 1 of 15' }, cache, trie],
        links: [
          { from: 'user', to: 'edge' },
          { from: 'edge', to: 'svc' },
          { from: 'svc', to: 'filter' },
          { from: 'svc', to: 'cache' },
          { from: 'cache', to: 'trie' },
        ],
        flows: [
          { path: ['svc', 'cache', 'trie'], tone: 'request', duration: 1.2 },
          { path: ['trie', 'cache', 'svc'], tone: 'response', label: '15 candidates', duration: 1.2, delay: 1.3 },
          { path: ['svc', 'filter', 'svc'], tone: 'request', label: 'check blocklist', duration: 1.2, delay: 2.6 },
          { path: ['svc', 'edge', 'user'], tone: 'response', label: 'top 10 safe', duration: 1.2, delay: 3.9 },
        ],
        caption: 'Every list passes the filter on the way out',
      },
    },
    {
      title: 'Trending',
      tag: 'tradeoff',
      heading: 'Breaking news cannot wait for tomorrow\'s build',
      eli5: 'Kids suddenly ask about a comet that appeared tonight, but the cards were written last night. A helper tallies the last few minutes of slips on a **whiteboard**, and the librarian mixes those in.',
      body: [
        'A storm gets a name at 9 AM and millions search for it. The daily trie does not know the word exists until tomorrow. Rebuilding the full trie every few minutes is too expensive, so we add a small fast path beside it.',
        'A **trend counter** reads the same query log as a stream (the stream processing lesson) and counts queries in 5-minute windows. A query is trending when its recent rate is far above its daily baseline. The counter writes a small **trending overlay**, a few thousand prefixes with their hot queries, into the prefix cache. The suggest API merges the overlay with the trie\'s list, giving trending items a boosted score.',
        'The overlay is small, so it is cheap to rebuild every minute, and it passes the same safety filter. The trade is complexity: two ranking sources must be blended so a spike does not crowd out stable, useful suggestions forever. Overlay entries expire after a few hours unless they keep trending.',
      ],
      keyIdea: 'Keep the big trie on a slow, cheap cycle, and add a small streaming overlay for what changed in the last few minutes.',
      metrics: { qps: '125K/s', p99: '35 ms', ram: '~400 GB, 3 shards', fresh: '24 h + 5 min overlay' },
      scene: {
        nodes: [user, svc, { ...cache, status: 'active', badge: 'overlay: storm names' }, trie, { ...logs, status: 'active' }, { ...trend, status: 'active', badge: '40x baseline' }],
        links: [
          { from: 'user', to: 'svc' },
          { from: 'svc', to: 'cache' },
          { from: 'cache', to: 'trie' },
          { from: 'svc', to: 'logs', style: 'faint' },
          { from: 'logs', to: 'trend' },
          { from: 'trend', to: 'cache', style: 'dashed' },
        ],
        flows: [
          { path: ['svc', 'logs'], tone: 'event', count: 4, duration: 1 },
          { path: ['logs', 'trend'], tone: 'data', label: 'stream', duration: 1, delay: 1 },
          { path: ['trend', 'cache'], tone: 'data', label: 'trending overlay', duration: 1.2, delay: 2.1 },
          { path: ['svc', 'cache', 'svc'], tone: 'response', label: 'trie list + overlay', duration: 1.4, delay: 3.4 },
        ],
        caption: 'A small streaming path covers the last few minutes',
      },
    },
    {
      title: 'Failures',
      tag: 'case',
      heading: 'Case: a bad snapshot and a dead trie server',
      eli5: 'One night the card-maker writes every card wrong. The librarian tests a few drawers before using the new cards and keeps the old ones handy. Keeping the old set to switch back is a **rollback**.',
      body: [
        'A bug in the builder truncates every query to 8 characters. If the trie servers loaded it blindly, every suggestion worldwide would be broken within minutes. So each snapshot passes **validation** before the swap: node count and size within 10% of yesterday, a golden set of prefixes whose answers must overlap yesterday\'s, and a canary that loads it on one server first (the deployments lesson). The servers keep the previous snapshot on disk and can swap back in seconds.',
        'Hardware fails too. Each shard has at least three replicas behind the load balancer, and health checks pull a dead one out within seconds. A replacement downloads the snapshot from object storage instead of rebuilding.',
        'The last line of defense is that autocomplete is optional. If a shard is down, the API returns an empty list within its 50 ms timeout (the timeouts lesson) and the search box still works. Failing quiet is better than making typing slow.',
      ],
      keyIdea: 'Validate every snapshot before it serves, keep the last good one, and degrade to no suggestions instead of slow ones.',
      metrics: { qps: '125K/s', p99: '35 ms', ram: '~400 GB, 3 shards', fresh: '24 h + 5 min overlay' },
      scene: {
        nodes: [
          user,
          svc,
          cache,
          { ...trie, status: 'ok', badge: 'kept v2026-11-15' },
          { ...builder, status: 'down', badge: 'bad build' },
          { ...snaps, status: 'hot', badge: 'validation failed' },
        ],
        links: [
          { from: 'user', to: 'svc' },
          { from: 'svc', to: 'cache' },
          { from: 'cache', to: 'trie' },
          { from: 'builder', to: 'snaps' },
          { from: 'snaps', to: 'trie', style: 'dashed' },
        ],
        flows: [
          { path: ['builder', 'snaps'], tone: 'data', label: 'v2026-11-16', duration: 1 },
          { path: ['snaps', 'trie'], tone: 'error', label: 'rejected', duration: 1.2, delay: 1.1 },
          { path: ['user', 'svc', 'cache', 'trie'], tone: 'request', duration: 1.6, delay: 2.4 },
          { path: ['trie', 'cache', 'svc', 'user'], tone: 'response', label: 'yesterday\'s lists', duration: 1.6, delay: 4.1 },
        ],
        caption: 'A bad build never reaches users',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Precompute everything, serve from RAM, fail quiet',
      eli5: 'Count the slips every night, write ten best titles in every drawer of the **trie**, keep the favorites on the desk, and let a grown-up cross out bad ones. Kids get answers before they finish the word.',
      body: [
        'The read path is client debounce and browser cache, then CDN, then a stateless suggest API, a prefix cache, and trie servers holding the trie in RAM with the **top 10 cached at every node**. Peak traffic fell from 700K keystrokes to 125K requests per second, and p99 sits near 35 ms against a 100 ms budget.',
        'The write path is a query log, a daily aggregation with decay and a privacy floor, a trie builder and versioned snapshots that are validated before a pointer swap. Shards follow measured load, a live filter removes harmful suggestions in minutes, and a streaming overlay adds trending queries between builds.',
      ],
      keyIdea: 'Autocomplete is fast because all the ranking happens before anyone types.',
      metrics: { qps: '125K/s', p99: '35 ms', ram: '~400 GB, 3 shards', fresh: '24 h + 5 min overlay' },
      scene: {
        nodes: [user, edge, svc, filter, { ...cache, status: 'ok' }, { ...trie, status: 'ok' }, logs, agg, builder, snaps],
        links: [...servePath, { from: 'svc', to: 'filter', style: 'faint' as const }, ...buildPath],
        flows: [
          { path: ['user', 'edge', 'svc', 'cache', 'trie'], tone: 'request', duration: 2 },
          { path: ['trie', 'cache', 'svc', 'edge', 'user'], tone: 'response', duration: 2, delay: 2.1 },
          { path: ['svc', 'logs', 'agg', 'builder', 'snaps', 'trie'], tone: 'data', duration: 3.4, delay: 0.5 },
        ],
      },
      quiz: {
        question: 'Users report that a hurricane named this morning does not show up in suggestions. What is the best fix?',
        options: [
          'Rebuild the full trie every five minutes',
          'Raise the prefix cache TTL so hot answers stay longer',
          'Add a streaming trend counter that writes a small overlay merged with the trie\'s results',
          'Lower the debounce delay in the browser',
        ],
        answer: 2,
        explain: 'The daily trie cannot know about a term born today, and rebuilding the whole thing every few minutes is wasteful. A small streaming overlay covers recent spikes cheaply and expires on its own.',
      },
    },
  ],
};
