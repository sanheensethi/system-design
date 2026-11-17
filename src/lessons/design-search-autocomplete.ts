import type { Lesson, SceneNode } from '../engine/types';

/** Place a node by screen column (u = x - y) and screen row (v = x + y). */
const p = (u: number, v: number): [number, number] => [(u + v) / 2, (v - u) / 2];

const user: SceneNode = { id: 'user', kind: 'phone', at: p(-7.2, 0), label: 'searcher', sub: 'types "din"' };
const svc: SceneNode = { id: 'svc', kind: 'block', at: p(0, 0), label: 'suggest API', sub: 'stateless', icon: 'Search', tint: 'blue' };
const cache: SceneNode = { id: 'cache', kind: 'cache', at: p(3.6, 0), label: 'prefix cache', sub: 'Redis · hot prefixes' };
const trie: SceneNode = { id: 'trie', kind: 'server', at: p(7.2, 0), label: 'trie servers', sub: '~60 GB in RAM', tint: 'green' };
const sql: SceneNode = { id: 'sql', kind: 'db', at: p(3.6, 0), label: 'queries table', sub: 'query, count' };

const logs: SceneNode = { id: 'logs', kind: 'queue', at: p(-3.6, -8.5), label: 'query log', sub: '~90 GB/day' };
const counts: SceneNode = { id: 'counts', kind: 'db', at: p(0, -8.5), label: 'query counts', sub: 'weighted count' };
const agg: SceneNode = { id: 'agg', kind: 'block', at: p(0, -8.5), label: 'aggregator', sub: 'daily batch', icon: 'Layers', tint: 'violet' };
const builder: SceneNode = { id: 'builder', kind: 'block', at: p(3.6, -8.5), label: 'trie builder', sub: 'top 15 per node', icon: 'Package', tint: 'amber' };
const snaps: SceneNode = { id: 'snaps', kind: 'storage', at: p(7.2, -8.5), label: 'trie snapshots', sub: 'object storage' };

export const designSearchAutocomplete: Lesson = {
  id: 'design-search-autocomplete',
  title: 'Design search autocomplete (part 1)',
  tagline: 'Return the ten best completions for every keystroke in well under 100 ms, for hundreds of millions of people.',
  minutes: 15,
  level: 'Intermediate',
  learn: [
    'Sizing the problem: 700K requests per second at peak, and what we can trade away',
    'Why a trie with the top suggestions cached at every node answers in one walk',
    'Building the trie offline from aggregated query logs, then serving it from RAM',
    'Why the live trie is immutable, and how snapshots are swapped in',
    'A prefix cache for the hottest prefixes',
  ],
  metrics: [
    { key: 'qps', label: 'Peak requests', icon: 'Activity' },
    { key: 'p99', label: 'p99 server side', icon: 'Timer' },
    { key: 'ram', label: 'Trie in RAM', icon: 'HardDrive' },
    { key: 'fresh', label: 'Freshness', icon: 'Clock' },
  ],
  steps: [
    {
      title: 'Requirements',
      tag: 'problem',
      heading: 'Ten suggestions per keystroke, faster than the next keystroke',
      eli5: 'A kid at the library desk says "din" and the librarian must name ten likely books before the kid says the next letter. That guessing is **autocomplete**, and thousands of kids are asking at once.',
      body: [
        'As the user types, show the **top 10** completions for the current prefix, ranked by how often people searched them. English first, lowercase text, no personal history yet.',
        'The list must feel instant: **under 100 ms** end to end at p99, from request sent to list shown. About **50 ms** of that is ours, server side. The 100 ms debounce wait in part 2 sits outside this budget.',
      ],
      keyIdea: 'Autocomplete is a read-only, latency-bound lookup with a very small time budget.',
      metrics: { qps: '?', p99: 'target 50 ms', ram: '-', fresh: '-' },
      metricTones: { p99: 'warn' },
      scene: {
        nodes: [
          { ...user, status: 'active', chips: ['d', 'di', 'din'] },
          { ...svc, status: 'active', badge: 'top 10 in 50 ms' },
        ],
        links: [{ from: 'user', to: 'svc', label: 'one request per key' }],
        flows: [
          { path: ['user', 'svc'], tone: 'request', label: 'd', duration: 0.8 },
          { path: ['user', 'svc'], tone: 'request', label: 'di', duration: 0.8, delay: 0.5 },
          { path: ['user', 'svc'], tone: 'request', label: 'din', duration: 0.8, delay: 1 },
          { path: ['svc', 'user'], tone: 'response', label: '10 suggestions', duration: 0.8, delay: 1.9 },
        ],
        panel: {
          title: 'Requirements',
          icon: 'List',
          rows: [
            { text: 'Suggestions per prefix', value: '10' },
            { text: 'End to end', value: 'p99 < 100 ms', tone: 'warn' },
            { text: 'Server side', value: 'p99 < 50 ms' },
            { text: 'Ranking', value: 'by search count' },
            { text: 'Scope', value: 'English, lowercase' },
          ],
        },
        caption: 'Every keystroke is a request with a 100 ms budget',
      },
    },
    {
      title: 'Scale',
      tag: 'concept',
      heading: 'The math: 700K requests per second at peak',
      eli5: 'Lots of kids each ask about twenty letters a day. If the librarian answers every single letter, she answers a mountain of questions, and nearly all of them are reading, never writing.',
      body: [
        '**150M daily users** run about 10 searches each, and a search is about 20 characters. One request per keystroke is 30 billion requests a day.',
        'That is roughly 350K per second on average and **700K per second** at peak. Reads dominate. Writes are only the query log, which can be processed later.',
      ],
      keyIdea: 'Size it first: 700K reads per second at peak, with almost no writes on the hot path.',
      metrics: { qps: '700K/s', p99: 'target 50 ms', ram: '-', fresh: '-' },
      metricTones: { qps: 'bad' },
      scene: {
        nodes: [
          { ...user, chips: ['d', 'di', 'din'] },
          { ...svc, status: 'hot', load: 95, badge: '700K/s peak' },
          { ...logs, status: 'dim' },
        ],
        links: [{ from: 'user', to: 'svc' }, { from: 'svc', to: 'logs', style: 'faint' }],
        flows: [
          { path: ['user', 'svc'], tone: 'request', count: 5, duration: 0.9 },
          { path: ['svc', 'logs'], tone: 'event', label: 'a few writes', duration: 1.2, delay: 1.2 },
        ],
        panel: {
          title: 'Back of the envelope',
          icon: 'Table',
          rows: [
            { text: 'Daily users', value: '150M' },
            { text: 'Searches per day', value: '1.5B' },
            { text: 'Keystroke requests per day', value: '30B', tone: 'warn' },
            { text: 'Average rate', value: '350K/s' },
            { text: 'Peak rate (2x)', value: '700K/s', tone: 'bad' },
          ],
          footer: { text: 'Reads dominate. Writes can wait.', tone: 'muted' },
        },
        caption: 'Reads dominate completely',
      },
    },
    {
      title: 'What to trade',
      tag: 'tradeoff',
      heading: 'Two answers matter less than they seem',
      eli5: 'The librarian may use yesterday\'s book counts and may skip a book hardly anyone asks for. Giving up a little news and a few rare books buys a very fast desk.',
      body: [
        'Suggestions can be a day old and nobody notices. Missing a rare query is fine too, since nobody misses a suggestion they never wanted.',
        'Those two relaxations shape the whole design. We can work out the answers ahead of time, offline, and keep only the popular queries.',
      ],
      keyIdea: 'Freshness and completeness can be traded away for speed. Latency cannot.',
      metrics: { qps: '700K/s', p99: 'target 50 ms', ram: '-', fresh: 'a day is fine' },
      metricTones: { fresh: 'good' },
      scene: {
        nodes: [
          { ...logs, status: 'active' },
          { ...agg, status: 'active', badge: 'works offline' },
          { ...svc, badge: 'answers fast' },
        ],
        links: [{ from: 'logs', to: 'agg' }, { from: 'agg', to: 'svc', style: 'dashed', label: 'ready-made answers' }],
        flows: [
          { path: ['logs', 'agg'], tone: 'data', duration: 1.2 },
          { path: ['agg', 'svc'], tone: 'data', duration: 1.4, delay: 1.3 },
        ],
        panel: {
          title: 'What we trade',
          icon: 'Scale',
          rows: [
            { text: 'Freshness', value: 'up to a day old', tone: 'good' },
            { text: 'Rare queries', value: 'may be missing', tone: 'good' },
            { text: 'Latency', value: 'never traded', tone: 'bad' },
          ],
          footer: { text: 'Work ahead of time, answer instantly', tone: 'muted' },
        },
        caption: 'Do the hard work before anyone types',
      },
    },
    {
      title: 'The API',
      tag: 'concept',
      heading: 'One GET call, cacheable at every layer',
      eli5: 'The kid asks one question: "what starts with din?" The librarian answers with a short list and writes the date on it, so the same question gets the same list.',
      body: [
        'The read API is one call: `GET /v1/suggest?q=din&locale=en-US&k=10`. It returns a list of strings with optional scores.',
        'It is a pure function of the prefix and locale, so every layer can cache it (the caching lesson and the CDN lesson both apply).',
      ],
      keyIdea: 'A pure function of the prefix is a cacheable function.',
      metrics: { qps: '700K/s', p99: 'target 50 ms', ram: '-', fresh: 'a day is fine' },
      scene: {
        nodes: [{ ...user, chips: ['GET /v1/suggest?q=din'] }, { ...svc, status: 'active', badge: 'pure function' }],
        links: [{ from: 'user', to: 'svc' }],
        flows: [
          { path: ['user', 'svc'], tone: 'request', label: 'GET /suggest?q=din', duration: 1 },
          { path: ['svc', 'user'], tone: 'response', label: '["dinner ideas", ...]', duration: 1, delay: 1.1 },
        ],
        panel: {
          title: 'Query parameters',
          icon: 'Braces',
          rows: [
            { text: 'q', value: 'prefix, "din"' },
            { text: 'locale', value: 'en-US' },
            { text: 'k', value: 'how many, 10' },
          ],
          footer: { text: 'Same inputs, same answer', tone: 'good' },
        },
        caption: 'The whole read API is one call',
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
      title: 'Query log',
      tag: 'concept',
      heading: 'Writes go to a log, never to the keystroke path',
      eli5: 'Every finished request also goes on a slip in a big **log** box, so the librarian can count later which books kids want most. Writing a slip never makes a kid wait.',
      body: [
        'When a user submits a search, the search service appends `(query, locale, timestamp, session_hash)` to a **query log** on a stream (the message queues lesson). The hashed session id is kept only for a short time. The serving path never writes.',
        'At 1.5B searches a day and about 60 bytes each, that is **~90 GB a day**. We derive a `query_counts` table from it, and later a structure that serves reads.',
      ],
      keyIdea: 'Split the system in two: a cheap, cacheable read API and an append-only log that feeds an offline build.',
      metrics: { qps: '700K/s', p99: 'target 50 ms', ram: '-', fresh: 'a day is fine' },
      scene: {
        nodes: [
          { ...svc, status: 'active' },
          { ...logs, status: 'active', badge: 'append only' },
          { ...counts, badge: 'derived later' },
        ],
        links: [{ from: 'svc', to: 'logs', style: 'dashed', label: 'async' }, { from: 'logs', to: 'counts' }],
        flows: [
          { path: ['svc', 'logs'], tone: 'event', label: 'searched "dinner recipes"', duration: 1.2 },
          { path: ['logs', 'counts'], tone: 'data', label: 'count per query', duration: 1.2, delay: 1.4 },
        ],
        panel: {
          title: 'One log record',
          icon: 'FileText',
          code: '2026-11-16T09:14:02Z\nen-US\n"dinner recipes"\nsession_hash\n~60 bytes',
          footer: { text: '1.5B records, ~90 GB a day', tone: 'muted' },
        },
        caption: 'The log decouples reads from counting',
      },
    },
    {
      title: 'Simple design',
      tag: 'case',
      heading: 'Version one: LIKE over a table of counts',
      eli5: 'For every question the librarian walks the whole aisle of slips that start with "d", counts them up, and picks the top ten. It works for one kid.',
      body: [
        'The obvious build keeps `query_counts` in a SQL database. An index on `query` turns the prefix into a range scan, so the query below looks fine in testing.',
        'Test data is small. In production, the range for a short prefix is not.',
      ],
      keyIdea: 'A prefix index finds the matching rows fast. Ranking them is the expensive part.',
      metrics: { qps: '700K/s', p99: 'target 50 ms', ram: '-', fresh: 'live' },
      scene: {
        nodes: [user, { ...svc, status: 'active' }, { ...sql, status: 'active', chips: ['LIKE \'din%\''] }],
        links: [{ from: 'user', to: 'svc' }, { from: 'svc', to: 'sql' }],
        flows: [
          { path: ['user', 'svc'], tone: 'request', label: 'din', duration: 0.9 },
          { path: ['svc', 'sql'], tone: 'request', label: "LIKE 'din%'", duration: 1, delay: 1 },
          { path: ['sql', 'svc'], tone: 'response', label: '10 rows', duration: 1, delay: 2.1 },
        ],
        panel: {
          title: 'The query',
          icon: 'Database',
          code: "SELECT query\nFROM query_counts\nWHERE query LIKE 'din%'\nORDER BY weighted_count DESC\nLIMIT 10;",
          footer: { text: 'Fine on a small table', tone: 'muted' },
        },
        caption: 'The obvious design is a database query',
      },
    },
    {
      title: 'It breaks',
      tag: 'case',
      heading: 'Short prefixes match millions of rows',
      eli5: 'Everybody starts with "d" or "s", so the aisle for those letters is huge. The librarian counts it again for every kid, and the **database** line never moves.',
      body: [
        'The range for `d` holds millions of rows, and the database must read them all to sort by count before it returns ten. One and two letter prefixes are also the most frequent requests, because every search starts with them. p99 climbs to seconds.',
        'At 700K per second, read replicas do not save it (the replication lesson). The work per request is the problem, so the fix changes the data structure.',
      ],
      keyIdea: 'Ranking means touching every match, and short prefixes match everything.',
      metrics: { qps: '700K/s', p99: '3 s', ram: '-', fresh: 'live' },
      metricTones: { p99: 'bad', qps: 'bad' },
      scene: {
        nodes: [
          { ...user, chips: [{ text: 'd', tone: 'warn' }] },
          { ...svc, status: 'hot', load: 90 },
          { ...sql, status: 'hot', load: 100, badge: 'scan 4M rows for "d"' },
        ],
        links: [{ from: 'user', to: 'svc' }, { from: 'svc', to: 'sql', label: 'sort then limit 10', labelTone: 'warn' }],
        flows: [
          { path: ['user', 'svc'], tone: 'request', count: 5, duration: 0.9 },
          { path: ['svc', 'sql'], tone: 'request', label: "LIKE 'd%'", count: 5, duration: 1, delay: 0.9 },
          { path: ['sql', 'svc'], tone: 'error', label: 'timeout', duration: 1.4, delay: 2.2 },
        ],
        panel: {
          title: 'Rows scanned per prefix',
          icon: 'Table',
          rows: [
            { text: 'd', value: '4M rows', tone: 'bad' },
            { text: 'di', value: '300K rows', tone: 'warn' },
            { text: 'din', value: '9K rows' },
          ],
          footer: { text: 'p99 3 s against a 100 ms budget', tone: 'bad' },
        },
        caption: 'The shortest prefixes are the most common and the most expensive',
      },
    },
    {
      title: 'The trie',
      tag: 'concept',
      heading: 'A trie walks the prefix one letter at a time',
      eli5: 'The librarian builds a tree of drawers: d, then di, then din. You open one drawer per letter you typed. This tree of drawers is a **trie**.',
      body: [
        'A **trie** stores strings by their characters: the root branches on the first letter, each child on the next one. Finding the node for `din` takes three hops.',
        'A plain trie still has the old problem. The best completions need a walk of the whole subtree below that node.',
      ],
      keyIdea: 'A trie finds the prefix in a few hops, but ranking what lies below it is still a subtree search.',
      metrics: { qps: '700K/s', p99: 'target 50 ms', ram: '-', fresh: 'live' },
      scene: {
        nodes: [user, svc, { ...trie, status: 'active', badge: 'walk d, i, n' }],
        links: [{ from: 'user', to: 'svc' }, { from: 'svc', to: 'trie' }],
        flows: [
          { path: ['user', 'svc'], tone: 'request', label: 'din', duration: 0.9 },
          { path: ['svc', 'trie'], tone: 'request', label: '3 hops', duration: 1, delay: 1 },
        ],
        panel: {
          title: 'The path for "din"',
          icon: 'Binary',
          code: 'root\n  d\n    di\n      din   9K queries below\n        dina, dine, dinn...',
          footer: { text: 'Finding the node is cheap. Ranking below it is not.', tone: 'warn' },
        },
        caption: 'One letter per hop',
      },
    },
    {
      title: 'Top-k per node',
      tag: 'concept',
      heading: 'Store the ten best answers at every node',
      eli5: 'Each drawer holds a card with its ten best books already written on it. Answering is opening one drawer and reading the card, so this tree is a **trie** with answers inside.',
      body: [
        'So we precompute. Each node stores the **top 15 completions in its subtree**, with counts. A lookup walks `p` characters and reads a ready list: O(p) work, no sorting. We return 10, and the spare 5 survive filtering (part 2).',
        'We cap stored prefixes at about 30 characters, since almost nobody types longer before choosing a suggestion.',
      ],
      keyIdea: 'Caching the top-k list at every node turns a subtree search into a fixed-cost walk of the prefix.',
      metrics: { qps: '700K/s', p99: '45 ms', ram: '-', fresh: 'live' },
      metricTones: { p99: 'good' },
      scene: {
        nodes: [user, svc, { ...trie, status: 'ok', badge: 'top 15 ready' }],
        links: [{ from: 'user', to: 'svc' }, { from: 'svc', to: 'trie' }],
        flows: [
          { path: ['user', 'svc'], tone: 'request', label: 'din', duration: 0.9 },
          { path: ['svc', 'trie'], tone: 'request', label: '3 hops', duration: 1, delay: 1 },
          { path: ['trie', 'svc'], tone: 'response', label: 'precomputed list', duration: 1, delay: 2.1 },
          { path: ['svc', 'user'], tone: 'response', duration: 0.9, delay: 3.2 },
        ],
        panel: {
          title: 'Node "din" holds',
          icon: 'Star',
          rows: [
            { text: 'dinner ideas', value: '98,120', tone: 'good' },
            { text: 'dinner recipes', value: '87,403' },
            { text: 'dinosaur', value: '61,277' },
            { text: 'dinner near me', value: '55,190' },
            { text: '...11 more', tone: 'muted' },
          ],
          footer: { text: 'O(p) walk, no sorting', tone: 'good' },
        },
        caption: 'One walk, one ready-made list',
      },
      code: {
        language: 'python',
        title: 'Trie node with a cached top-k list',
        source: `import heapq

K, MAX_PREFIX, RETURN = 15, 30, 10

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
    return [q for _, q in node.top[:RETURN]]   # O(len(prefix)), no sorting`,
        highlight: [9, 17, 21, 31],
      },
      quiz: {
        question: 'Why store the top completions on every trie node instead of only on the leaves?',
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
      title: 'Memory cost',
      tag: 'concept',
      heading: 'What it costs: about 60 GB of RAM',
      eli5: 'Writing ten titles on every drawer card takes a lot of paper. The whole tree of drawers still fits in one big room, and we can squeeze it by merging drawers that only lead to one other drawer.',
      body: [
        'With about 100M distinct queries kept, the trie has roughly 600M nodes. Each holds fifteen 4-byte query ids plus child links, so the English trie comes to **~60 GB**.',
        'That fits in RAM on one large server. Merging single-child chains into one edge, a **compressed trie** (radix tree), shrinks it further.',
      ],
      keyIdea: 'The speed is paid for in memory: a full English trie is about 60 GB, small enough for one big machine.',
      metrics: { qps: '700K/s', p99: '45 ms', ram: '~60 GB', fresh: 'live' },
      metricTones: { ram: 'warn' },
      scene: {
        nodes: [user, svc, { ...trie, status: 'active', badge: '~60 GB' }],
        links: [{ from: 'user', to: 'svc' }, { from: 'svc', to: 'trie' }],
        flows: [{ path: ['svc', 'trie'], tone: 'request', duration: 1.2 }],
        panel: {
          title: 'Sizing the English trie',
          icon: 'HardDrive',
          rows: [
            { text: 'Distinct queries kept', value: '100M' },
            { text: 'Trie nodes', value: '~600M' },
            { text: 'Per node', value: '15 ids x 4 B + links' },
            { text: 'Total', value: '~60 GB', tone: 'warn' },
            { text: 'Compressed (radix) trie', value: 'fewer nodes', tone: 'good' },
          ],
        },
        caption: 'Fast reads cost memory',
      },
    },
    {
      title: 'Update plan',
      tag: 'tradeoff',
      heading: 'Why not update the trie on every search?',
      eli5: 'Every time a kid asks, the librarian could rewrite the cards along the whole drawer path. With a crowd, that is all she would do, so she rewrites cards at night instead.',
      body: [
        'Adding one query means fixing the top-10 list of every ancestor node, up to 30 of them. Billions of searches a day would slow the query service to a crawl, and the top lists rarely change from hour to hour.',
        'So we split reads and writes. The live trie is **immutable**, and a batch job builds a new one from the log.',
      ],
      keyIdea: 'Updating top-k lists in place is expensive and rarely useful. Rebuild in batch and serve an immutable trie.',
      metrics: { qps: '700K/s', p99: '45 ms', ram: '~60 GB', fresh: 'a day is fine' },
      scene: {
        nodes: [{ ...svc, status: 'active' }, { ...trie, status: 'hot', badge: 'locked for updates' }, { ...logs, status: 'dim' }],
        links: [{ from: 'svc', to: 'trie' }, { from: 'svc', to: 'logs', style: 'faint' }],
        flows: [
          { path: ['svc', 'trie'], tone: 'error', label: 'fix 30 lists per search', count: 3, duration: 1.2 },
          { path: ['svc', 'logs'], tone: 'event', label: 'append only', duration: 1.2, delay: 1.5 },
        ],
        panel: {
          title: 'Two ways to update',
          icon: 'Scale',
          rows: [
            { text: 'In place, per search', value: '30 list updates', tone: 'bad' },
            { text: 'Searches per day', value: '1.5B', tone: 'warn' },
            { text: 'Top lists change', value: 'slowly', tone: 'good' },
            { text: 'Choice', value: 'rebuild in batch', tone: 'good' },
          ],
        },
        caption: 'Reads and writes take different paths',
      },
    },
    {
      title: 'Aggregate logs',
      tag: 'concept',
      heading: 'Aggregate the log with time decay',
      eli5: 'Every night the librarian empties the slip box and counts which books were asked for. Slips from last week count a little less than today\'s, and books only one kid wanted are left out.',
      body: [
        'A daily job (the background jobs lesson) groups the log by locale and query and computes a weighted count. Recent days weigh more, so last month\'s fad fades out.',
        '`search_log_daily` holds one row per search. Queries searched by fewer than 20 distinct sessions are dropped, since they add memory and are a privacy risk.',
      ],
      keyIdea: 'Weight recent searches higher, drop rare ones, and the counts stay small, fresh enough and private.',
      metrics: { qps: '700K/s', p99: '45 ms', ram: '~60 GB', fresh: '24 h' },
      scene: {
        nodes: [{ ...logs, status: 'active' }, { ...agg, status: 'active', badge: 'GROUP BY query' }, { ...counts, at: p(3.6, -8.5), badge: '100M queries' }],
        links: [{ from: 'logs', to: 'agg', label: '90 GB/day' }, { from: 'agg', to: 'counts' }],
        flows: [
          { path: ['logs', 'agg'], tone: 'data', duration: 1.2 },
          { path: ['agg', 'counts'], tone: 'data', label: 'weighted counts', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Weight of one search',
          icon: 'Clock',
          rows: [
            { text: 'Today', value: '1.00', tone: 'good' },
            { text: '7 days ago', value: '0.48' },
            { text: '28 days ago', value: '0.05', tone: 'muted' },
            { text: 'Fewer than 20 sessions', value: 'dropped', tone: 'warn' },
          ],
          footer: { text: 'weight = 0.9 ^ days old', tone: 'muted' },
        },
        caption: 'Counts with decay and a privacy floor',
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
HAVING COUNT(DISTINCT session_hash) >= 20;   -- privacy and memory floor`,
        highlight: [5, 10],
      },
    },
    {
      title: 'Snapshot swap',
      tag: 'concept',
      heading: 'Build an immutable trie and swap it in',
      eli5: 'The card-maker writes a whole new set of drawers in the back room and stamps a date on it. The librarian moves to the new set in one step, so nobody sees half-written cards.',
      body: [
        'The **trie builder** reads the counts, builds the trie with top-k lists, and writes a serialized **snapshot** to object storage with a version stamp.',
        'Trie servers download it, load it beside the old one, and swap a pointer. Readers never see a half-built trie. Two copies need about 2x RAM, so swap a few replicas at a time.',
      ],
      keyIdea: 'Build offline, version it, and swap whole snapshots. Serving never waits on writes.',
      metrics: { qps: '700K/s', p99: '45 ms', ram: '~60 GB', fresh: '24 h' },
      scene: {
        nodes: [{ ...agg }, { ...builder, status: 'active', badge: 'top 15 per node' }, { ...snaps, badge: 'v2026-11-16' }, { ...trie, badge: 'swap pointer' }],
        links: [
          { from: 'agg', to: 'builder' },
          { from: 'builder', to: 'snaps' },
          { from: 'snaps', to: 'trie', style: 'dashed', label: 'load + swap' },
        ],
        flows: [
          { path: ['agg', 'builder'], tone: 'data', label: '100M queries', duration: 1, delay: 0 },
          { path: ['builder', 'snaps'], tone: 'data', label: 'snapshot', duration: 1, delay: 1.1 },
          { path: ['snaps', 'trie'], tone: 'data', label: 'v2026-11-16', duration: 1.2, delay: 2.2 },
        ],
        panel: {
          title: 'Swap sequence',
          icon: 'Repeat',
          rows: [
            { text: '1. Download snapshot', value: 'v2026-11-16' },
            { text: '2. Load beside the old one', value: 'v2026-11-15' },
            { text: '3. Swap the pointer', value: 'instant', tone: 'good' },
            { text: '4. Drop the old copy', value: 'later', tone: 'muted' },
            { text: 'Memory headroom', value: '~2x, or stagger replicas', tone: 'warn' },
          ],
        },
        caption: 'Logs in, a fresh immutable trie out, every day',
      },
    },
    {
      title: 'Serve from RAM',
      tag: 'concept',
      heading: 'Trie servers keep the whole trie in memory',
      eli5: 'The drawers all stay in the front room, not in a basement. Opening one takes a moment, so a single librarian can answer thousands of kids and a few spares cover sick days.',
      body: [
        'The trie lives entirely in RAM on a pool of **trie servers**, each holding a full copy. A lookup costs microseconds, so one server handles tens of thousands of requests per second.',
        'Size the pool by request rate, with a few spares for failures. The suggest API in front stays stateless and scales on its own (the load balancing lesson).',
      ],
      keyIdea: 'Keep the whole trie in RAM for predictable speed, and size the pool by request rate.',
      metrics: { qps: '700K/s', p99: '40 ms', ram: '~60 GB', fresh: '24 h' },
      metricTones: { p99: 'good' },
      scene: {
        nodes: [user, { ...svc, status: 'active', chips: ['stateless'] }, { ...trie, status: 'active', load: 55, chips: ['full copy in RAM'] }],
        links: [{ from: 'user', to: 'svc' }, { from: 'svc', to: 'trie', label: 'microsecond lookups' }],
        flows: [
          { path: ['user', 'svc'], tone: 'request', count: 4, duration: 0.9 },
          { path: ['svc', 'trie'], tone: 'request', label: 'din', duration: 1, delay: 1 },
          { path: ['trie', 'svc', 'user'], tone: 'response', label: 'top 10', duration: 1.6, delay: 2.1 },
        ],
        panel: {
          title: 'Sizing the pool',
          icon: 'Server',
          rows: [
            { text: 'One server, one lookup', value: 'microseconds' },
            { text: 'One server', value: '10K+ req/s' },
            { text: 'Copies per server', value: 'full trie' },
            { text: 'Spares', value: 'a few', tone: 'good' },
          ],
        },
        caption: 'Predictable speed from memory',
      },
    },
    {
      title: 'Prefix cache',
      tag: 'concept',
      heading: 'A small cache absorbs the hottest prefixes',
      eli5: 'The ten most asked-for cards sit right on the front desk, the **prefix cache**. Most kids get their answer there, and only unusual questions send the librarian back to the drawers.',
      body: [
        'Traffic is very skewed. A few thousand short prefixes (`a`, `th`, `how to`) carry a large share. A **prefix cache** in Redis keyed by `locale:prefix:version` answers those before they reach a trie server. About 70% hits is realistic.',
        'The version in the key keeps old and new lists apart across a swap. After a swap the hottest keys warm up within minutes.',
      ],
      keyIdea: 'A few prefixes carry most of the traffic, so a small cache in front takes most of the load off the trie.',
      metrics: { qps: '700K/s', p99: '35 ms', ram: '~60 GB', fresh: '24 h' },
      metricTones: { p99: 'good' },
      scene: {
        nodes: [{ ...svc, status: 'active' }, { ...cache, status: 'ok', badge: '70% hits' }, { ...trie, status: 'active', load: 35, badge: '30% misses' }],
        links: [{ from: 'svc', to: 'cache' }, { from: 'cache', to: 'trie', label: 'on a miss' }],
        flows: [
          { path: ['svc', 'cache', 'svc'], tone: 'response', label: 'hit "how to"', count: 3, duration: 1.4 },
          { path: ['cache', 'trie'], tone: 'request', label: 'miss "dinosaur fo"', duration: 1, delay: 1.6 },
          { path: ['trie', 'cache'], tone: 'response', duration: 1, delay: 2.7 },
        ],
        panel: {
          title: 'Cache key',
          icon: 'Key',
          code: 'locale : prefix : version\nen-US:how to:2026-11-16\nen-US:th:2026-11-16',
          footer: { text: 'TTL matches the build cycle', tone: 'muted' },
        },
        caption: 'Hot prefixes stop at the cache',
      },
    },
    {
      title: 'Part 1 recap',
      tag: 'recap',
      heading: 'Precompute the ranking, then serve it from RAM',
      eli5: 'Count the slips every night, write the ten best titles on every drawer of the **trie**, and keep the favorites on the front desk. Kids get answers before they finish the word.',
      body: [
        'The read path is a stateless suggest API, a prefix cache and trie servers with the **top 15 cached at every node** (10 returned). The write path is a query log, a daily aggregation, a builder and versioned snapshots swapped in by pointer.',
        'Part 2 shrinks the traffic at the client, shards the trie, adds safety, trending and failure handling.',
      ],
      keyIdea: 'Autocomplete is fast because all the ranking happens before anyone types.',
      metrics: { qps: '700K/s', p99: '35 ms', ram: '~60 GB', fresh: '24 h' },
      metricTones: { p99: 'good', qps: 'warn' },
      scene: {
        nodes: [{ ...svc, status: 'ok' }, { ...cache, status: 'ok' }, { ...trie, status: 'ok' }, { ...logs }, { ...builder }],
        links: [
          { from: 'svc', to: 'cache' },
          { from: 'cache', to: 'trie' },
          { from: 'svc', to: 'logs', style: 'faint' },
          { from: 'logs', to: 'builder', style: 'dashed' },
          { from: 'builder', to: 'trie', style: 'dashed' },
        ],
        flows: [
          { path: ['svc', 'cache', 'trie'], tone: 'request', duration: 2 },
          { path: ['trie', 'cache', 'svc'], tone: 'response', duration: 2, delay: 2.1 },
          { path: ['logs', 'builder', 'trie'], tone: 'data', duration: 3, delay: 0.5 },
        ],
        panel: {
          title: 'Part 1 in numbers',
          icon: 'Gauge',
          rows: [
            { text: 'Peak load', value: '700K/s' },
            { text: 'Trie in RAM', value: '~60 GB' },
            { text: 'Cache hit rate', value: '~70%', tone: 'good' },
            { text: 'p99', value: '35 ms', tone: 'good' },
          ],
        },
        caption: 'Read path, write path, both decoupled',
      },
      quiz: {
        question: 'A teammate proposes updating the live trie in place on every search so suggestions are always fresh. What is the main problem?',
        options: [
          'Tries cannot store counts',
          'Each search would rewrite the top-10 lists of up to 30 ancestor nodes, at billions of searches a day',
          'RAM cannot be written to while it serves reads',
          'The prefix cache would stop working',
        ],
        answer: 1,
        explain: 'Adding one query changes the top lists of every ancestor node. At billions of searches a day that write load would slow the reads. A batch build into an immutable snapshot keeps the serving path fast.',
      },
    },
  ],
};
