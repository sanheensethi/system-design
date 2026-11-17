import type { Lesson, SceneNode } from '../engine/types';

const user: SceneNode = { id: 'user', kind: 'client', at: [-4, 4], label: 'shopper', sub: '50 searches/s' };
const app: SceneNode = { id: 'app', kind: 'server', at: [-1, 3], label: 'app servers' };
const db: SceneNode = { id: 'db', kind: 'db', at: [2, 2], label: 'Postgres', sub: '24M listings' };
const index: SceneNode = { id: 'index', kind: 'search', at: [0.5, -2.5], label: 'search index' };
const changes: SceneNode = { id: 'changes', kind: 'queue', at: [4.25, 0.25], label: 'change log' };
const indexer: SceneNode = { id: 'indexer', kind: 'worker', at: [3.75, -2.75], label: 'indexer' };

// One node per term: the label is the term, the sub line is its posting list.
const tWireless: SceneNode = { id: 'tWireless', kind: 'search', at: [-1, -2], label: 'wireless', sub: '3, 8, 15, 42, 77' };
const tHeadphone: SceneNode = { id: 'tHeadphone', kind: 'search', at: [1.75, -2.75], label: 'headphone', sub: '8, 21, 42, 90' };
const tBlack: SceneNode = { id: 'tBlack', kind: 'search', at: [4.5, -3.5], label: 'black', sub: '3, 21, 42, 64' };

const doc8: SceneNode = { id: 'doc8', kind: 'replica', at: [-1, -2], label: 'doc 8', sub: '6 words, honest' };
const doc42: SceneNode = { id: 'doc42', kind: 'replica', at: [2.25, -3.25], label: 'doc 42', sub: '120 words, stuffed' };

const s0: SceneNode = { id: 's0', kind: 'shard', at: [-1.5, -1.5], label: 'shard 0', sub: '8M docs' };
const s1: SceneNode = { id: 's1', kind: 'shard', at: [0.75, -2.75], label: 'shard 1', sub: '8M docs' };
const s2: SceneNode = { id: 's2', kind: 'shard', at: [3, -4], label: 'shard 2', sub: '8M docs' };
const r0: SceneNode = { id: 'r0', kind: 'replica', at: [2.5, 1.5], label: 'replica 0' };
const r1: SceneNode = { id: 'r1', kind: 'replica', at: [4.75, 0.25], label: 'replica 1' };
const r2: SceneNode = { id: 'r2', kind: 'replica', at: [7, -1], label: 'replica 2' };

const baseLinks = [
  { from: 'user', to: 'app' },
  { from: 'app', to: 'db' },
  { from: 'app', to: 'index' },
];

const termLinks = [
  { from: 'user', to: 'app' },
  { from: 'app', to: 'tWireless' },
  { from: 'app', to: 'tHeadphone' },
  { from: 'app', to: 'tBlack', style: 'faint' as const },
];

export const searchIndex: Lesson = {
  id: 'search-index',
  title: 'Search index',
  tagline: 'Turn text into an inverted index so a search over millions of documents reads a few lists instead of every row.',
  minutes: 15,
  level: 'Intermediate',
  learn: [
    "Why `LIKE '%word%'` scans every row and returns poor results",
    'How an analyzer turns text into terms, and how the inverted index stores them',
    'Answering multi-word queries by intersecting posting lists',
    'Ranking with TF-IDF and BM25',
    'Shards, replicas and scatter-gather queries',
    'Keeping the index in sync with the database it was built from',
  ],
  metrics: [
    { key: 'lat', label: 'Search latency' },
    { key: 'work', label: 'Work per query' },
    { key: 'qps', label: 'Search capacity' },
    { key: 'lag', label: 'Index lag' },
  ],
  steps: [
    {
      title: 'LIKE scan',
      tag: 'problem',
      heading: 'The search box reads every row',
      eli5: 'A kid asks for books about dragons. The librarian opens every book in the library and reads each title. That slow walk past every shelf is a **full scan**, and the line of kids keeps growing.',
      body: [
        'A marketplace has **24 million listings** in Postgres. The search box runs `WHERE title ILIKE \'%wireless headphones%\'`. A B-tree index is sorted by the start of the string, so it can help with `\'wireless%\'` and is useless once the pattern starts with a wildcard. The database falls back to reading all 24 million titles. One search takes **6 seconds**.',
        'At 50 searches per second, each burning a CPU core for 6 seconds, you would need 300 cores for the search box alone. Checkout shares that database and slows down with it.',
        'The results are poor too. "Wireless Bluetooth Headphones" does not match, because the two words are not side by side. "headphone" without the s finds nothing. Whatever does match comes back in no useful order. A trigram index can speed up substring matching, but it still knows nothing about words or relevance.',
      ],
      keyIdea: 'Substring matching scans everything and understands nothing about words. Search needs a different data structure.',
      metrics: { lat: '6 s', work: '24M rows', qps: '< 1 per core', lag: '-' },
      scene: {
        nodes: [user, { ...app, status: 'hot', badge: 'waiting 6 s' }, { ...db, status: 'hot', badge: 'Seq Scan · 24M rows' }],
        links: [
          { from: 'user', to: 'app' },
          { from: 'app', to: 'db' },
        ],
        flows: [
          { path: ['user', 'app'], tone: 'request', label: 'wireless headphones', count: 4, duration: 1 },
          { path: ['app', 'db'], tone: 'request', label: "ILIKE '%...%'", count: 4, duration: 1, delay: 1.1 },
          { path: ['db', 'app'], tone: 'response', duration: 3.4, delay: 2.2 },
        ],
        caption: 'Every search reads every title',
      },
      code: {
        language: 'sql',
        title: 'The search box, version one',
        source: `SELECT id, title, price
FROM listings
WHERE title ILIKE '%wireless headphones%'
LIMIT 20;

-- EXPLAIN ANALYZE, abridged:
--   Seq Scan on listings
--     Filter: (title ~~* '%wireless headphones%')
--     Rows Removed by Filter: 23998112
--   Execution Time: 6140.221 ms`,
        highlight: [3, 7, 9, 10],
      },
    },
    {
      title: 'Tokenizing',
      tag: 'concept',
      heading: 'First, turn text into terms',
      eli5: 'Before a book goes on the shelf, a helper copies out its important words in small letters and skips tiny ones like "the". Chopping text into clean words is **tokenizing**.',
      body: [
        'A search engine never matches raw strings. Every document first goes through an **analyzer**, a small pipeline. The **tokenizer** splits text into words. Filters then lowercase them, drop **stop words** such as "the" and "with", and **stem** each word to a root form, so "headphones" and "headphone" become the same term.',
        'The title "Wireless Headphones with Mic, Black" comes out as four **terms**: `wireless`, `headphone`, `mic`, `black`.',
        'The query goes through the same analyzer. A shopper who types "Headphone WIRELESS" produces `headphone` and `wireless`, which now match exactly. If the index and the query are analyzed differently, documents silently stop matching. It is a classic search bug.',
      ],
      keyIdea: 'Documents and queries pass through the same analyzer, so matching becomes exact comparison of normalized terms.',
      metrics: { lat: '6 s', work: '24M rows', qps: '< 1 per core', lag: '-' },
      scene: {
        nodes: [
          { ...db, status: 'active', badge: 'title text' },
          { ...indexer, label: 'analyzer', sub: 'split, lowercase, stem', status: 'active' },
          { ...index, status: 'ok', badge: '4 terms' },
        ],
        links: [
          { from: 'db', to: 'indexer' },
          { from: 'indexer', to: 'index' },
        ],
        flows: [
          { path: ['db', 'indexer'], tone: 'data', label: 'Wireless Headphones with Mic, Black', duration: 1.8 },
          { path: ['indexer', 'index'], tone: 'data', label: 'wireless · headphone · mic · black', duration: 1.8, delay: 1.9 },
        ],
        caption: 'Text in, normalized terms out',
      },
    },
    {
      title: 'Inverted index',
      tag: 'concept',
      heading: 'Map each term to the documents that contain it',
      eli5: 'At the back of the library is a card box. Each card has one word and the numbers of all the books that use it. That card box is the **inverted index**.',
      body: [
        'A table maps a document to its words. An **inverted index** flips that around: each term maps to the list of document IDs that contain it. It is the index at the back of a textbook, built for every word of every document.',
        'It has two parts. The **term dictionary** holds every distinct term in sorted order, so finding one takes a handful of steps even among millions of terms. Each term points to its **posting list**, the sorted IDs of the documents that contain it.',
        'A search for `headphone` is now one dictionary lookup and one list read. The other 23.8 million listings are never touched. The work depends on how many documents match, and no longer on how many exist.',
      ],
      keyIdea: 'The inverted index answers "which documents contain this term" with a lookup, so query cost follows the matches and ignores the rest.',
      metrics: { lat: '30 ms', work: '240K postings', qps: '50/s', lag: '-' },
      scene: {
        nodes: [user, { ...app, status: 'active' }, tWireless, { ...tHeadphone, status: 'active', badge: 'lookup' }, tBlack],
        links: termLinks,
        flows: [
          { path: ['user', 'app'], tone: 'request', label: 'headphones', duration: 1 },
          { path: ['app', 'tHeadphone'], tone: 'request', label: 'term: headphone', duration: 1.2, delay: 1.1 },
          { path: ['tHeadphone', 'app'], tone: 'response', label: 'docs 8, 21, 42, 90', duration: 1.2, delay: 2.4 },
        ],
        caption: 'One card per term, one list of document IDs per card',
      },
      code: {
        language: 'python',
        title: 'A tiny inverted index',
        source: `import re
from collections import defaultdict

STOP = {"the", "a", "and", "for", "with"}

def analyze(text):
    words = re.findall(r"[a-z0-9]+", text.lower())
    stem = lambda w: w[:-1] if w.endswith("s") and not w.endswith("ss") else w
    return [stem(w) for w in words if w not in STOP]

index = defaultdict(list)                 # term -> sorted list of doc ids

def add(doc_id, text):                    # call with increasing doc ids
    for term in set(analyze(text)):
        index[term].append(doc_id)

def search(query):
    lists = [set(index.get(t, [])) for t in analyze(query)]
    return sorted(set.intersection(*lists)) if lists else []

add(8, "Wireless Headphones with Mic, Black")
search("headphone WIRELESS")              # [8]`,
        highlight: [6, 11, 15, 18, 19],
      },
    },
    {
      title: 'Posting lists',
      tag: 'concept',
      heading: 'Two words: intersect two lists',
      eli5: 'The list of book numbers on one card is a **posting list**. For "dragon castle" the librarian takes both cards and keeps only the numbers that appear on both.',
      body: [
        'The query "wireless headphones" becomes two terms, and the engine wants documents that contain both. It fetches both posting lists and **intersects** them. Both lists are sorted, so it walks them together like the merge step of merge sort: `[3, 8, 15, 42, 77]` and `[8, 21, 42, 90]` give `[8, 42]`. OR is a union of the lists.',
        'Order matters at scale. `wireless` appears in 2.4 million listings and `headphone` in 240,000. The engine starts from the **rarest term** and uses skip pointers to jump through the long list, so the work stays close to the size of the short one.',
        'Sorted lists also compress well. Store the gaps between IDs in place of the IDs (`3, +5, +7, +27, +35`) and most entries fit in one or two bytes. Lists can also record the **position** of each occurrence, which lets a phrase query check that the words sit next to each other.',
      ],
      keyIdea: 'A multi-word query is set arithmetic on sorted posting lists, driven by the rarest term.',
      metrics: { lat: '30 ms', work: '240K postings', qps: '50/s', lag: '-' },
      scene: {
        nodes: [
          user,
          { ...app, status: 'active', badge: 'both lists: 8, 42' },
          { ...tWireless, status: 'active', badge: '2.4M docs' },
          { ...tHeadphone, status: 'active', badge: '240K docs · start here' },
          { ...tBlack, status: 'dim' },
        ],
        links: termLinks,
        flows: [
          { path: ['user', 'app'], tone: 'request', label: 'wireless headphones', duration: 1 },
          { path: ['app', 'tHeadphone'], tone: 'request', duration: 1, delay: 1.1 },
          { path: ['app', 'tWireless'], tone: 'request', duration: 1, delay: 1.1 },
          { path: ['tHeadphone', 'app'], tone: 'data', label: '8, 21, 42, 90', duration: 1.2, delay: 2.2 },
          { path: ['tWireless', 'app'], tone: 'data', label: '3, 8, 15, 42, 77', duration: 1.2, delay: 2.2 },
          { path: ['app', 'user'], tone: 'response', label: 'docs 8 and 42', duration: 1, delay: 3.6 },
        ],
        caption: 'Walk two sorted lists, keep the IDs in both',
      },
      quiz: {
        question: 'The posting list for `usb` is [2, 9, 14, 30, 51] and for `charger` is [9, 30, 44]. Which documents match the query "usb charger" when both words are required?',
        options: ['2, 9, 14, 30, 44, 51', '9 and 30', '44 only', '9, 30 and 44'],
        answer: 1,
        explain: 'Requiring both terms means intersecting the lists. Only 9 and 30 appear in both. The first option is the union, which is what an OR query returns.',
      },
    },
    {
      title: 'TF-IDF',
      tag: 'concept',
      heading: 'Which match is best? Count and weigh the terms',
      eli5: 'A book that says "dragon" on many pages is more about dragons. A word found in nearly every book, like "story", tells you very little. Scoring books this way is called **TF-IDF**.',
      body: [
        '240,000 listings match. The shopper looks at ten. The index has to **rank** matches, and the classic score is built from two counts.',
        '**Term frequency** (TF) is how often the term appears in this document. More mentions suggest the document is about that term. **Inverse document frequency** (IDF) measures how rare the term is across all documents: `idf = ln(N / df)`, where `df` is the number of documents containing it. With N = 24 million, `black` (4.8M docs) scores 1.6, `wireless` (2.4M) scores 2.3 and `headphone` (240K) scores 4.6. Rare terms say more about what the shopper wants.',
        'The **TF-IDF** score of a document is the sum of `tf × idf` over the query terms. Both counts are stored in the index: `df` is the length of the posting list, and each posting carries its `tf`.',
      ],
      keyIdea: 'TF rewards documents that use the term often. IDF rewards terms that few documents use. Multiply and sum.',
      metrics: { lat: '30 ms', work: '240K postings', qps: '50/s', lag: '-' },
      scene: {
        nodes: [
          user,
          app,
          { ...tWireless, sub: 'in 2.4M docs', badge: 'idf 2.3' },
          { ...tHeadphone, sub: 'in 240K docs', status: 'ok', badge: 'idf 4.6' },
          { ...tBlack, sub: 'in 4.8M docs', status: 'dim', badge: 'idf 1.6' },
        ],
        links: termLinks,
        flows: [
          { path: ['app', 'tHeadphone'], tone: 'request', duration: 1 },
          { path: ['app', 'tWireless'], tone: 'request', duration: 1 },
          { path: ['tHeadphone', 'app'], tone: 'data', label: 'rare: weighs more', count: 2, duration: 1.2, delay: 1.1 },
          { path: ['tWireless', 'app'], tone: 'data', label: 'common: weighs less', duration: 1.2, delay: 1.1 },
        ],
        caption: 'The rarer the term, the more a match is worth',
      },
    },
    {
      title: 'BM25',
      tag: 'tradeoff',
      heading: 'BM25: stop rewarding repetition and length',
      eli5: 'Saying "dragon" fifty times is hardly better than saying it ten times. A short book all about dragons beats a huge book that just repeats the word. That fairer scoring is **BM25**.',
      body: [
        'Raw TF-IDF is easy to game. Doc 8 is an honest six-word title that mentions each query term once: score 6.9. Doc 42 is a 120-word description stuffed with "wireless headphones" ten times: score 69. The spam wins by ten to one.',
        '**BM25** is the default ranking function in Lucene, Elasticsearch and OpenSearch, and it changes two things. Term frequency **saturates**: in a document of average length the first mention is worth 1.0, ten mentions 1.96, and no count can pass 2.2 (with `k1 = 1.2`). Scores are also **normalized by length**: a document longer than average is discounted, controlled by `b = 0.75`.',
        'Run the same two documents through BM25 with an average length of 12 words. Doc 8 scores 8.7 and doc 42 scores 7.9. The honest title now ranks first. Real systems then blend BM25 with business signals such as sales, ratings and freshness.',
      ],
      keyIdea: 'BM25 is TF-IDF with diminishing returns on repetition and a penalty for long documents.',
      metrics: { lat: '30 ms', work: '240K postings', qps: '50/s', lag: '-' },
      scene: {
        nodes: [
          user,
          { ...app, status: 'active', badge: 'rank by BM25' },
          { ...doc8, status: 'ok', badge: 'TF-IDF 6.9 · BM25 8.7' },
          { ...doc42, status: 'hot', badge: 'TF-IDF 69 · BM25 7.9' },
        ],
        links: [
          { from: 'user', to: 'app' },
          { from: 'app', to: 'doc8' },
          { from: 'app', to: 'doc42' },
        ],
        flows: [
          { path: ['doc8', 'app'], tone: 'response', label: '1st', duration: 1.2 },
          { path: ['doc42', 'app'], tone: 'error', label: '2nd', duration: 1.2, delay: 0.4 },
          { path: ['app', 'user'], tone: 'response', label: 'doc 8, then doc 42', duration: 1, delay: 1.8 },
        ],
        caption: 'Ten repeats no longer beat one honest mention',
      },
      code: {
        language: 'python',
        title: 'BM25 score of one document',
        source: `import math

K1, B = 1.2, 0.75        # the usual defaults

def bm25(query_terms, doc, index, N, avg_len):
    score = 0.0
    for term in query_terms:
        df = len(index.get(term, []))              # docs containing the term
        if df == 0:
            continue
        idf = math.log(1 + (N - df + 0.5) / (df + 0.5))
        tf = doc.term_counts.get(term, 0)          # mentions in this doc
        norm = 1 - B + B * doc.length / avg_len    # > 1 for long docs
        score += idf * tf * (K1 + 1) / (tf + K1 * norm)
    return score`,
        highlight: [3, 11, 13, 14],
      },
    },
    {
      title: 'Shards and replicas',
      tag: 'concept',
      heading: 'Split the index, then copy each piece',
      eli5: 'The card box got too big, so it was split into three boxes with a helper at each. Each box is a **shard**. Every helper finds their best books, and the librarian picks the best of all.',
      body: [
        'One machine holds the whole index until the index outgrows its memory or one CPU cannot keep up. Then the index is split into **shards**. Each document is routed to one shard by a hash of its ID, and each shard is a complete inverted index over its 8 million documents.',
        'A term can live in any shard, so a query goes to all of them. This is **scatter-gather**: a coordinator sends the query to every shard in parallel, each returns its own top 10 with scores, and the coordinator merges 30 candidates into the final 10. The response is as slow as the slowest shard. Deep pages cost more: page 100 makes every shard return 1,000 hits.',
        'Each shard also has **replicas** on other machines. A replica can answer searches, so copies add search capacity, and when a machine dies a replica takes over its shard. Three shards with one replica each are six nodes that serve about 300 searches per second.',
      ],
      keyIdea: 'Shards split the data so every query fans out to all of them. Replicas copy each shard for throughput and failover.',
      metrics: { lat: '35 ms', work: '3 shards in parallel', qps: '300/s', lag: '-' },
      scene: {
        nodes: [
          user,
          { ...app, label: 'coordinator', status: 'active', badge: 'merge 3 x top 10' },
          { ...s0, status: 'active' },
          { ...s1, status: 'active' },
          { ...s2, status: 'active' },
          r0,
          r1,
          r2,
        ],
        links: [
          { from: 'user', to: 'app' },
          { from: 'app', to: 's0' },
          { from: 'app', to: 's1' },
          { from: 'app', to: 's2' },
          { from: 's0', to: 'r0', style: 'dashed' },
          { from: 's1', to: 'r1', style: 'dashed' },
          { from: 's2', to: 'r2', style: 'dashed' },
        ],
        flows: [
          { path: ['user', 'app'], tone: 'request', label: 'query', duration: 0.9 },
          { path: ['app', 's0'], tone: 'request', duration: 0.9, delay: 1 },
          { path: ['app', 's1'], tone: 'request', duration: 0.9, delay: 1 },
          { path: ['app', 's2'], tone: 'request', duration: 0.9, delay: 1 },
          { path: ['s0', 'app'], tone: 'response', label: 'top 10', duration: 0.9, delay: 2 },
          { path: ['s1', 'app'], tone: 'response', duration: 0.9, delay: 2 },
          { path: ['s2', 'app'], tone: 'response', duration: 1.5, delay: 2 },
          { path: ['app', 'user'], tone: 'response', label: 'best 10 of 30', duration: 0.9, delay: 3.6 },
        ],
        caption: 'Scatter to every shard, gather and merge',
      },
    },
    {
      title: 'Drift',
      tag: 'case',
      heading: 'Case: the index and the database disagree',
      eli5: 'A new book arrives. The librarian shelves it but forgets to write its cards, so nobody can find it. The shelves and the card box now disagree, and that gap is called **drift**.',
      body: [
        'The index is a second copy of data that lives in Postgres. The quick way to feed it is a **dual write**: the app updates the database, then calls the search index.',
        'A seller drops a price from $80 to $60. The database commit succeeds. The call to the index times out. Search keeps showing $80, and nothing will ever correct it, because no later event touches that listing. The same thing happens when the app crashes between the two writes, or when two updates reach the index in the opposite order.',
        'Each failure is rare. Over months they pile up into thousands of listings that are missing from search, deleted but still shown, or priced wrong. Nobody notices until a customer complains.',
      ],
      keyIdea: 'Two independent writes will eventually disagree. A dual write has no way to notice the difference or repair it.',
      metrics: { lat: '35 ms', work: '3 shards in parallel', qps: '300/s', lag: 'never for some docs' },
      scene: {
        nodes: [
          { ...user, label: 'seller', sub: 'price $80 → $60' },
          { ...app, status: 'active' },
          { ...db, status: 'ok', badge: 'price = $60' },
          { ...index, status: 'hot', badge: 'still $80' },
        ],
        links: baseLinks,
        flows: [
          { path: ['user', 'app'], tone: 'request', label: 'PUT price', duration: 1 },
          { path: ['app', 'db'], tone: 'request', label: 'UPDATE', duration: 1, delay: 1.1 },
          { path: ['db', 'app'], tone: 'response', label: 'committed', duration: 1, delay: 2.2 },
          { path: ['app', 'index'], tone: 'error', label: 'timeout', duration: 1.6, delay: 3.3 },
        ],
        caption: 'The first write landed, the second did not',
      },
    },
    {
      title: 'Sync pipeline',
      tag: 'concept',
      heading: 'Feed the index from the database change log',
      eli5: 'Now every change is written in a logbook first. A helper reads the logbook in order and writes the cards. That logbook is the **change log**, so no book is ever forgotten.',
      body: [
        'The fix is to have one write and derive the other. The app writes only to the database. **Change data capture** (CDC) reads the database\'s own log of committed changes and publishes each one to a stream (see the message queues lesson). An **indexer** consumes the stream and updates the search index.',
        'Now a failure only delays the index. If the index is down, changes wait in the stream and the indexer retries. Updates carry the row version, so a late or repeated event cannot overwrite newer data. The index runs a second or two behind the database. Elasticsearch, for example, makes new documents searchable about once per second by default.',
        'Keep a second path: a **full reindex**. Build a fresh index from the database, then switch an alias from the old index to the new one. You need it when the analyzer or the field mapping changes, and it repairs any drift that slipped through.',
      ],
      keyIdea: 'Write once to the source of truth and derive the index from its change log. Failures then cause lag, which heals, in place of drift, which does not.',
      metrics: { lat: '35 ms', work: '3 shards in parallel', qps: '300/s', lag: '~2 s' },
      scene: {
        nodes: [
          { ...user, label: 'seller', sub: 'price $80 → $60' },
          app,
          { ...db, status: 'active', badge: 'only write' },
          { ...changes, status: 'active', badge: 'listing 42 v7' },
          { ...indexer, status: 'active', sub: 'retries until done' },
          { ...index, status: 'ok', badge: '$60 · 2 s later' },
        ],
        links: [
          { from: 'user', to: 'app' },
          { from: 'app', to: 'db' },
          { from: 'db', to: 'changes', style: 'dashed', label: 'CDC' },
          { from: 'changes', to: 'indexer' },
          { from: 'indexer', to: 'index' },
        ],
        flows: [
          { path: ['user', 'app', 'db'], tone: 'request', label: 'UPDATE price', duration: 1.4 },
          { path: ['db', 'changes'], tone: 'event', label: 'row changed', duration: 1, delay: 1.5 },
          { path: ['changes', 'indexer'], tone: 'event', duration: 1, delay: 2.6 },
          { path: ['indexer', 'index'], tone: 'data', label: 'index doc 42', duration: 1, delay: 3.7 },
        ],
        caption: 'One write, then the change flows to the index',
      },
    },
    {
      title: 'Not the truth',
      tag: 'tradeoff',
      heading: 'The index is a projection you can rebuild',
      eli5: 'The cards only point at books. The books on the shelves are the **source of truth**. If the card box burns, the helpers can write every card again from the shelves.',
      body: [
        'Treat the search index as a **projection** of the database. It is built for one job, it is a few seconds stale, and it can be thrown away and rebuilt. Money, stock and anything that needs a transaction stays in the database.',
        'A safe read path follows from that. Search returns the IDs and scores of the top 10. The app then loads those 10 rows from the database or cache by primary key and renders the current price and stock. A stale index can put a listing in slightly the wrong place, but it never shows a wrong price.',
        'The cost is another cluster to run. Search nodes want a lot of memory, since the operating system has to keep the index files cached. Changing an analyzer means a full reindex. If your search needs are small, the full-text search built into your database may be enough for now.',
      ],
      keyIdea: 'Search finds and ranks IDs. The database stays the source of truth for the data you show and charge for.',
      metrics: { lat: '40 ms', work: '3 shards + 10 row reads', qps: '300/s', lag: '~2 s' },
      scene: {
        nodes: [user, { ...app, status: 'active' }, { ...db, status: 'ok', badge: '10 rows by ID' }, { ...index, status: 'ok', badge: 'top 10 IDs' }],
        links: baseLinks,
        flows: [
          { path: ['user', 'app'], tone: 'request', label: 'wireless headphones', duration: 0.9 },
          { path: ['app', 'index', 'app'], tone: 'request', label: 'IDs + scores', duration: 1.6, delay: 1 },
          { path: ['app', 'db', 'app'], tone: 'data', label: 'current rows', duration: 1.6, delay: 2.7 },
          { path: ['app', 'user'], tone: 'response', label: 'results', duration: 0.9, delay: 4.4 },
        ],
        caption: 'Rank in the index, read the facts from the database',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Terms, lists, scores, shards, sync',
      eli5: 'Helpers write a card for every word, and that card box is the **inverted index**. The librarian reads a few cards, picks the best books, and a logbook keeps the cards matching the shelves.',
      body: [
        'A leading-wildcard `LIKE` reads every row. A search index runs text through an **analyzer** and stores an **inverted index**: each term points to a sorted **posting list** of document IDs. Multi-word queries intersect those lists, starting from the rarest term.',
        '**BM25** ranks the matches: rare terms weigh more, repetition has diminishing returns, long documents are discounted. **Shards** split the index and every query scatters to all of them. **Replicas** add capacity and failover. Feed the index from the database change log, keep a full reindex ready, and read the facts you display from the source of truth.',
      ],
      keyIdea: 'A search index is a fast, ranked, slightly stale projection of your data. Build it from the source of truth and never treat it as one.',
      metrics: { lat: '40 ms', work: '3 shards + 10 row reads', qps: '300/s', lag: '~2 s' },
      scene: {
        nodes: [user, app, { ...db, status: 'ok' }, changes, indexer, { ...index, status: 'ok' }],
        links: [...baseLinks, { from: 'db', to: 'changes', style: 'dashed' }, { from: 'changes', to: 'indexer' }, { from: 'indexer', to: 'index' }],
        flows: [
          { path: ['user', 'app', 'index', 'app', 'user'], tone: 'response', label: 'search', count: 2, duration: 2.6 },
          { path: ['db', 'changes', 'indexer', 'index'], tone: 'event', label: 'changes', duration: 2.4, delay: 1 },
        ],
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
