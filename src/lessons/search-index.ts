import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const user: SceneNode = { id: 'user', kind: 'client', at: at(-3.8, -3.4), label: 'shopper', sub: '50 searches/s' };
const api: SceneNode = { id: 'api', kind: 'block', at: at(0, -3.4), label: 'search API', sub: 'app server', icon: 'Search', tint: 'violet' };
const db: SceneNode = { id: 'db', kind: 'db', at: at(3.8, -3.4), label: 'Postgres', sub: '24M listings' };
const tWireless: SceneNode = { id: 'tWireless', kind: 'block', size: 0.72, at: at(-3.6, 3.9), label: 'wireless', sub: '2.4M docs', icon: 'FileText', tint: 'blue' };
const tHeadphone: SceneNode = { id: 'tHeadphone', kind: 'block', size: 0.72, at: at(0, 3.4), label: 'headphone', sub: '240K docs', icon: 'FileText', tint: 'green' };
const tBlack: SceneNode = { id: 'tBlack', kind: 'block', size: 0.72, at: at(3.6, 3.4), label: 'black', sub: '4.8M docs', icon: 'FileText', tint: 'gray' };
const analyzer: SceneNode = { id: 'analyzer', kind: 'block', size: 0.8, at: at(0, 3.4), label: 'analyzer', sub: 'text to terms', icon: 'Split', tint: 'amber' };
const index: SceneNode = { id: 'index', kind: 'search', at: at(3.8, 3.4), label: 'search index' };
const termLinks = [link('api', 'tWireless'), link('api', 'tHeadphone'), link('api', 'tBlack', { style: 'faint' })];

export const searchIndex: Lesson = {
  id: 'search-index',
  title: 'Search index (part 1)',
  tagline: 'Turn text into an inverted index so a search over millions of documents reads a few lists instead of every row, then rank the matches.',
  minutes: 15,
  level: 'Intermediate',
  learn: [
    "Why `LIKE '%word%'` scans every row and returns poor results",
    'How an analyzer turns text into terms, and how the inverted index stores them',
    'Answering multi-word and phrase queries with posting lists',
    'Ranking with TF-IDF and BM25',
    'Part 2 covers shards, segments, sync, facets, autocomplete and typos',
  ],
  metrics: [
    { key: 'lat', label: 'Search latency', icon: 'Timer' },
    { key: 'work', label: 'Work per query', icon: 'Table' },
    { key: 'qps', label: 'Search capacity', icon: 'Gauge' },
    { key: 'rank', label: 'Result quality', icon: 'Star' },
  ],
  steps: [
    {
      title: 'LIKE scan',
      tag: 'problem',
      heading: 'The search box reads every row',
      eli5: 'A kid asks for books about dragons. The librarian opens every book in the library and reads each title. That slow walk past every shelf is a **full scan**.',
      body: [
        'A marketplace has **24 million listings** in Postgres. The search box runs `WHERE title ILIKE \'%wireless headphones%\'`. A B-tree is sorted by the start of a string, so it helps `\'wireless%\'` and is useless once the pattern starts with a wildcard.',
        'The query needs the 20 best sellers, so the database cannot stop early. It reads all 24 million titles, then sorts the matches. One search takes **6 seconds**.',
      ],
      keyIdea: 'A leading wildcard defeats the B-tree, so the database scans every row.',
      metrics: { lat: '6 s', work: '24M rows', qps: '< 1 per core', rank: 'none' },
      metricTones: { lat: 'bad', work: 'bad', qps: 'bad' },
      scene: {
        nodes: [user, { ...api, chips: [{ text: 'wireless headphones', tone: 'warn' }] }, { ...db, status: 'hot', load: 100, badge: 'Seq Scan' }],
        links: [link('user', 'api'), link('api', 'db', { label: 'ILIKE %...%', labelTone: 'warn' })],
        flows: [
          { path: ['user', 'api'], tone: 'request', label: 'wireless headphones', duration: 1 },
          { path: ['api', 'db'], tone: 'request', label: "ILIKE '%...%'", count: 3, duration: 1, delay: 1.1 },
          { path: ['db', 'api'], tone: 'response', duration: 3.4, delay: 2.2 },
        ],
        panel: {
          title: 'EXPLAIN ANALYZE',
          icon: 'Table',
          rows: [
            { text: 'Plan', value: 'Seq Scan', tone: 'bad' },
            { text: 'Rows removed by filter', value: '23,998,112', tone: 'bad' },
            { text: 'Execution time', value: '6,140 ms', tone: 'bad' },
          ],
        },
        caption: 'Every search reads every title',
      },
      code: {
        language: 'sql',
        title: 'The search box, version one',
        source: `SELECT id, title, price
FROM listings
WHERE title ILIKE '%wireless headphones%'
ORDER BY sales DESC
LIMIT 20;

-- EXPLAIN ANALYZE, abridged:
--   Sort  (top-N heapsort, sales DESC)
--     ->  Seq Scan on listings
--     Filter: (title ~~* '%wireless headphones%')
--     Rows Removed by Filter: 23998112
--   Execution Time: 6140.221 ms`,
        highlight: [3, 4, 8, 10, 11],
      },
    },
    {
      title: 'Core burn',
      tag: 'problem',
      heading: 'At 50 searches a second, the database melts',
      eli5: 'Fifty kids ask at once, and each question sends the librarian on a six second walk. The librarian cannot do anything else, and the line out the door never ends.',
      body: [
        'At 50 searches per second, each burning a CPU core for 6 seconds, the search box alone needs **300 cores**.',
        'Checkout shares that database. It slows down with the searches, so one feature takes the whole shop with it.',
      ],
      keyIdea: 'A scan per search makes cost grow with the table size and the traffic at the same time.',
      metrics: { lat: '6 s+', work: '24M rows', qps: '< 1 per core', rank: 'none' },
      metricTones: { lat: 'bad', work: 'bad', qps: 'bad' },
      scene: {
        nodes: [
          { ...user, chips: ['50 searches/s'] },
          { ...api, status: 'hot' },
          { ...db, status: 'hot', load: 100, badge: 'needs 300 cores' },
          { id: 'checkout', kind: 'block', size: 0.72, at: at(0, 3.4), label: 'checkout', sub: 'same database', icon: 'ShoppingBag', tint: 'red', status: 'hot', chips: [{ text: 'timeout', tone: 'bad' }] },
        ],
        links: [link('user', 'api'), link('api', 'db'), link('db', 'checkout', { style: 'dashed', label: 'shared', labelTone: 'warn' })],
        flows: [
          { path: ['user', 'api', 'db'], tone: 'request', label: 'search', count: 4, duration: 1.6 },
          { path: ['db', 'checkout'], tone: 'error', label: 'starved', duration: 1.4, delay: 1.8 },
        ],
        panel: {
          title: 'The math',
          icon: 'Cpu',
          rows: [
            { text: 'Searches per second', value: '50' },
            { text: 'CPU seconds per search', value: '6' },
            { text: 'Cores needed', value: '300', tone: 'bad' },
          ],
        },
        caption: 'Search starves checkout',
      },
    },
    {
      title: 'Poor results',
      tag: 'problem',
      heading: 'It is slow, and it matches the wrong things',
      eli5: 'The kid asks for "dragon books" but the librarian only counts titles with those exact letters side by side. "Books about dragons" is missed, and the pile comes back in no order.',
      body: [
        '"Wireless Bluetooth Headphones" does not match, because the two words are not side by side. "headphone" without the s finds nothing. Whatever does match comes back in no useful order.',
        'Substring matching knows nothing about words, spelling variants or relevance.',
      ],
      keyIdea: 'LIKE compares characters. Shoppers think in words.',
      metrics: { lat: '6 s', work: '24M rows', qps: '< 1 per core', rank: 'poor' },
      metricTones: { rank: 'bad' },
      scene: {
        nodes: [user, { ...api, chips: ['wireless headphones'] }, { ...db, status: 'active', badge: 'few real matches' }],
        links: [link('user', 'api'), link('api', 'db')],
        flows: [
          { path: ['user', 'api', 'db'], tone: 'request', label: 'wireless headphones', duration: 1.6 },
          { path: ['db', 'api', 'user'], tone: 'response', label: 'few, unordered', duration: 1.6, delay: 1.8 },
        ],
        panel: {
          title: 'Which titles match?',
          icon: 'List',
          rows: [
            { text: 'Wireless Headphones, Black', value: 'match', tone: 'good' },
            { text: 'Wireless Bluetooth Headphones', value: 'missed', tone: 'bad' },
            { text: 'Headphone, wireless, Mic', value: 'missed', tone: 'bad' },
            { text: 'Wireless Headphones Stand', value: 'match, wrong item', tone: 'warn' },
          ],
        },
        caption: 'Right words, wrong shape',
      },
    },
    {
      title: 'Trigrams',
      tag: 'tradeoff',
      heading: 'A trigram index speeds it up but stays blind to words',
      eli5: 'A helper writes down every three-letter chunk of every title. Finding chunks is quick, but the helper still has no idea what a word means or which book is best.',
      body: [
        'A **trigram** index (`pg_trgm` in Postgres) splits text into 3-letter pieces and indexes them. That makes substring matching fast, so the scan goes away.',
        'It still has no notion of words, stems or relevance, and the index is large. Search needs a structure built around words.',
      ],
      keyIdea: 'Trigrams fix speed for substrings. They do not give you word matching or ranking.',
      metrics: { lat: '200 ms', work: 'many trigram lists', qps: '~10/s', rank: 'poor' },
      metricTones: { lat: 'warn', rank: 'bad' },
      scene: {
        nodes: [user, api, { ...db, status: 'active', badge: 'GIN trigram index' }],
        links: [link('user', 'api'), link('api', 'db')],
        flows: [{ path: ['api', 'db', 'api'], tone: 'request', label: 'substring match', duration: 2 }],
        panel: {
          title: 'Trigrams of "wireless"',
          icon: 'Code',
          code: 'wir  ire  rel  ele\nles  ess\n\nfast substring match\nno words, no ranking',
          footer: { text: 'Faster, still the wrong tool', tone: 'warn' },
        },
        caption: 'Substring speed, no word sense',
      },
    },
    {
      title: 'Tokenizing',
      tag: 'concept',
      heading: 'First, split text into words',
      eli5: 'Before a book goes on the shelf, a helper copies out each word on its own little slip. Chopping text into separate words is **tokenizing**.',
      body: [
        'A search engine never matches raw strings. Every document first goes through an **analyzer**, a small pipeline. The first stage is the **tokenizer**, which splits text into words.',
        '"Wireless Headphones with Mic, Black" becomes five tokens.',
      ],
      keyIdea: 'The tokenizer turns one string into a list of word tokens.',
      metrics: { lat: '-', work: '5 tokens', qps: '-', rank: '-' },
      scene: {
        nodes: [{ ...db, status: 'active', badge: 'title text' }, { ...analyzer, status: 'active', chips: ['tokenizer'] }, { ...index, status: 'idle' }],
        links: [link('db', 'analyzer'), link('analyzer', 'index')],
        flows: [
          { path: ['db', 'analyzer'], tone: 'data', label: 'Wireless Headphones with Mic, Black', duration: 1.8 },
          { path: ['analyzer', 'index'], tone: 'data', label: 'Wireless · Headphones · with · Mic · Black', duration: 1.8, delay: 1.9 },
        ],
        panel: {
          title: 'Tokenizer output',
          icon: 'Split',
          rows: [
            { text: 'Wireless', value: 'token 1' },
            { text: 'Headphones', value: 'token 2' },
            { text: 'with', value: 'token 3' },
            { text: 'Mic', value: 'token 4' },
            { text: 'Black', value: 'token 5' },
          ],
        },
        caption: 'Text in, tokens out',
      },
    },
    {
      title: 'Filters',
      tag: 'concept',
      heading: 'Then normalize: lowercase, drop stop words, stem',
      eli5: 'The helper writes every slip in small letters, throws away tiny words like "with", and shortens "dragons" to "dragon". Cleaning the slips this way is **stemming**.',
      body: [
        'Filters follow the tokenizer. They lowercase, drop **stop words** such as "the" and "with", and **stem** each word to a root, so "headphones" and "headphone" become one term.',
        'Our title ends as four **terms**: `wireless`, `headphone`, `mic`, `black`. Analyzers are language specific: a French analyzer needs different stop words and stemming rules.',
      ],
      keyIdea: 'Normalizing means different spellings of a word end up as one term.',
      metrics: { lat: '-', work: '4 terms', qps: '-', rank: '-' },
      scene: {
        nodes: [{ ...analyzer, status: 'active', chips: ['lowercase', 'stop words', 'stem'] }, { ...index, status: 'ok', badge: '4 terms' }],
        links: [link('analyzer', 'index')],
        flows: [{ path: ['analyzer', 'index'], tone: 'data', label: 'wireless · headphone · mic · black', duration: 2 }],
        panel: {
          title: 'Each filter, in order',
          icon: 'List',
          rows: [
            { text: 'Wireless Headphones with Mic', value: 'raw' },
            { text: 'lowercase', value: 'wireless headphones with mic' },
            { text: 'drop stop words', value: 'wireless headphones mic', tone: 'good' },
            { text: 'stem', value: 'wireless headphone mic', tone: 'good' },
          ],
        },
        caption: 'Normalized terms, ready to index',
      },
    },
    {
      title: 'Same analyzer',
      tag: 'concept',
      heading: 'Queries go through the same analyzer',
      eli5: 'When a kid asks for "DRAGONS", the helper turns it into the same small-letter, shortened slip. Now it matches the slips on the cards exactly.',
      body: [
        'A shopper types "Headphone WIRELESS". The same analyzer produces `headphone` and `wireless`, which now match exactly, and matching becomes comparison of normalized terms.',
        'If the index and the query are analyzed differently, documents silently stop matching. It is a classic search bug.',
      ],
      keyIdea: 'Documents and queries share one analyzer, so matching is exact comparison of normalized terms.',
      metrics: { lat: '-', work: '2 terms', qps: '-', rank: '-' },
      scene: {
        nodes: [{ ...user, chips: ['Headphone WIRELESS'] }, { ...api, status: 'active' }, { ...analyzer, at: at(0, 3.4), status: 'active', chips: ['same pipeline'] }],
        links: [link('user', 'api'), link('api', 'analyzer')],
        flows: [
          { path: ['user', 'api'], tone: 'request', label: 'Headphone WIRELESS', duration: 1.2 },
          { path: ['api', 'analyzer'], tone: 'request', label: 'headphone · wireless', duration: 1.4, delay: 1.3 },
        ],
        panel: {
          title: 'Index side and query side',
          icon: 'Split',
          rows: [
            { text: 'Doc: Wireless Headphones', value: 'wireless headphone', tone: 'good' },
            { text: 'Query: Headphone WIRELESS', value: 'headphone wireless', tone: 'good' },
          ],
          footer: { text: 'Mismatched analyzers return nothing', tone: 'warn' },
        },
        caption: 'Same rules on both sides',
      },
    },
    {
      title: 'Inverted index',
      tag: 'concept',
      heading: 'Map each term to the documents that contain it',
      eli5: 'At the back of the library is a card box. Each card has one word and the numbers of all the books that use it. That card box is the **inverted index**.',
      body: [
        'A table maps a document to its words. An **inverted index** flips that: each term maps to the list of document IDs that contain it. It is the index at the back of a textbook, for every word of every document.',
        'The sorted **term dictionary** holds the terms. Each term points to its **posting list**, the sorted IDs of documents that contain it.',
      ],
      keyIdea: 'An inverted index maps term to a sorted list of document IDs.',
      metrics: { lat: '-', work: '-', qps: '-', rank: '-' },
      scene: {
        nodes: [{ ...tWireless, status: 'active', chips: ['3, 8, 15, 42, 77'] }, { ...tHeadphone, status: 'active', chips: ['8, 21, 42, 90'] }, { ...tBlack, status: 'active', chips: ['3, 21, 42, 64'] }],
        links: [],
        panel: {
          title: 'Term to posting list',
          icon: 'Table',
          rows: [
            { text: 'wireless', value: '3, 8, 15, 42, 77' },
            { text: 'headphone', value: '8, 21, 42, 90' },
            { text: 'black', value: '3, 21, 42, 64' },
          ],
          footer: { text: 'Sorted terms, sorted IDs', tone: 'muted' },
        },
        caption: 'One card per term, one list per card',
      },
    },
    {
      title: 'One lookup',
      tag: 'concept',
      heading: 'A search becomes a lookup, not a scan',
      eli5: 'To find books about "dragon", the librarian opens just the "dragon" card. The other card boxes never move.',
      body: [
        'A search for `headphone` is one dictionary lookup and one list read. Finding a term in a sorted dictionary takes a handful of steps even among millions of terms.',
        'The other 23.8 million listings are never touched. Work follows how many documents match, no longer how many exist.',
      ],
      keyIdea: 'Query cost follows the matches and ignores the rest of the corpus.',
      metrics: { lat: '30 ms', work: '240K postings', qps: '50/s', rank: '-' },
      metricTones: { lat: 'good', work: 'good', qps: 'good' },
      scene: {
        nodes: [user, { ...api, status: 'active', chips: ['headphone'] }, { ...tWireless, status: 'dim' }, { ...tHeadphone, status: 'ok', badge: 'lookup' }, { ...tBlack, status: 'dim' }],
        links: termLinks,
        flows: [
          { path: ['user', 'api'], tone: 'request', label: 'headphones', duration: 1 },
          { path: ['api', 'tHeadphone'], tone: 'request', label: 'term: headphone', duration: 1.2, delay: 1.1 },
          { path: ['tHeadphone', 'api'], tone: 'response', label: 'docs 8, 21, 42, 90', duration: 1.2, delay: 2.4 },
        ],
        caption: 'Open one card, ignore the rest',
      },
    },
    {
      title: 'Tiny index',
      tag: 'concept',
      heading: 'The whole idea in 20 lines of Python',
      eli5: 'The librarian writes a few simple rules: copy words in small letters, write each book number on its word card, and for a question, keep numbers found on every card.',
      body: [
        'An analyzer, a dictionary of lists and an intersection are all a toy search engine needs. Lucene adds compression, segments and scoring on top of the same idea.',
      ],
      keyIdea: 'An inverted index is a dictionary of sorted lists plus an analyzer in front of it.',
      metrics: { lat: '-', work: '-', qps: '-', rank: '-' },
      scene: {
        nodes: [{ ...analyzer, status: 'active' }, { ...index, status: 'ok', badge: 'term to ids' }, { ...api, status: 'active', chips: ['search()'] }],
        links: [link('analyzer', 'index'), link('api', 'index')],
        flows: [
          { path: ['analyzer', 'index'], tone: 'data', label: 'add(8, title)', duration: 1.4 },
          { path: ['api', 'index', 'api'], tone: 'request', label: 'search(query)', duration: 1.8, delay: 1.5 },
        ],
        caption: 'Analyze, add, intersect',
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
      title: 'Intersect',
      tag: 'concept',
      heading: 'Two words: intersect two posting lists',
      eli5: 'The list of book numbers on one card is a **posting list**. For "dragon castle" the librarian takes both cards and keeps only the numbers that appear on both.',
      body: [
        'The query "wireless headphones" has two terms, and the engine wants documents with both. It fetches both lists and **intersects** them. Both are sorted, so it walks them together like the merge step of merge sort.',
        '`[3, 8, 15, 42, 77]` and `[8, 21, 42, 90]` give `[8, 42]`. OR is a union of the lists, and NOT subtracts one.',
      ],
      keyIdea: 'A multi-word query is set arithmetic on sorted posting lists.',
      metrics: { lat: '30 ms', work: '240K postings', qps: '50/s', rank: '-' },
      scene: {
        nodes: [user, { ...api, status: 'active', badge: 'both lists: 8, 42' }, { ...tWireless, status: 'active' }, { ...tHeadphone, status: 'active' }],
        links: [link('user', 'api'), link('api', 'tWireless'), link('api', 'tHeadphone')],
        flows: [
          { path: ['user', 'api'], tone: 'request', label: 'wireless headphones', duration: 1 },
          { path: ['tHeadphone', 'api'], tone: 'data', label: '8, 21, 42, 90', duration: 1.2, delay: 1.2 },
          { path: ['tWireless', 'api'], tone: 'data', label: '3, 8, 15, 42, 77', duration: 1.2, delay: 1.2 },
          { path: ['api', 'user'], tone: 'response', label: 'docs 8 and 42', duration: 1, delay: 2.6 },
        ],
        panel: {
          title: 'Merge walk',
          icon: 'Workflow',
          rows: [
            { text: 'wireless', value: '3, 8, 15, 42, 77' },
            { text: 'headphone', value: '8, 21, 42, 90' },
            { text: 'AND (both)', value: '8, 42', tone: 'good' },
            { text: 'OR (either)', value: '3, 8, 15, 21, 42, 77, 90' },
          ],
        },
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
      title: 'Rarest first',
      tag: 'concept',
      heading: 'Start from the rarest term and skip ahead',
      eli5: 'The librarian starts with the card that has the fewest numbers, then peeks at the long card only for those few numbers instead of reading all of it.',
      body: [
        '`wireless` appears in 2.4 million listings and `headphone` in 240,000. The engine starts from the **rarest term** and uses **skip pointers** to jump through the long list.',
        'The work stays close to the size of the short list, not the long one.',
      ],
      keyIdea: 'Drive the intersection from the shortest list and skip through the longer ones.',
      metrics: { lat: '30 ms', work: '~240K postings', qps: '50/s', rank: '-' },
      metricTones: { work: 'good' },
      scene: {
        nodes: [{ ...api, status: 'active' }, { ...tWireless, status: 'dim', badge: 'skip through 2.4M' }, { ...tHeadphone, status: 'ok', badge: 'start here: 240K' }],
        links: [link('api', 'tHeadphone', { label: '1st' }), link('api', 'tWireless', { label: '2nd, skipping', style: 'dashed' })],
        flows: [
          { path: ['tHeadphone', 'api'], tone: 'data', label: '240K ids', duration: 1.4 },
          { path: ['api', 'tWireless', 'api'], tone: 'request', label: 'is 8 here? is 42?', duration: 2, delay: 1.5 },
        ],
        panel: {
          title: 'Work comparison',
          icon: 'Gauge',
          rows: [
            { text: 'Read both lists fully', value: '2.64M', tone: 'bad' },
            { text: 'Rarest first with skips', value: '~240K', tone: 'good' },
          ],
        },
        caption: 'The short list steers the walk',
      },
    },
    {
      title: 'Compression',
      tag: 'concept',
      heading: 'Posting lists store gaps, not IDs',
      eli5: 'The card says "start at 3, then jump 5, then jump 7". Small jump numbers need fewer digits than big book numbers, so the card box stays tiny.',
      body: [
        'Sorted lists compress well. Store the gaps between IDs instead of the IDs: `3, 8, 15, 42` becomes `3, +5, +7, +27`.',
        'Most gaps fit in one or two bytes, so the lists shrink a lot and more of the index fits in memory.',
      ],
      keyIdea: 'Sorting makes gaps small, and small numbers compress.',
      metrics: { lat: '30 ms', work: '240K postings', qps: '50/s', rank: '-' },
      scene: {
        nodes: [{ ...tWireless, status: 'active', badge: 'gap encoded' }, { ...index, at: at(3.6, 3.4), status: 'ok', badge: 'fits in RAM' }, { ...api, status: 'active' }],
        links: [link('api', 'tWireless'), link('tWireless', 'index')],
        flows: [{ path: ['tWireless', 'index'], tone: 'data', label: '3, +5, +7, +27', duration: 1.8 }],
        panel: {
          title: 'Same list, two encodings',
          icon: 'Binary',
          rows: [
            { text: 'Raw IDs', value: '3, 8, 15, 42, 77' },
            { text: 'Gaps', value: '3, +5, +7, +27, +35', tone: 'good' },
            { text: 'Bytes per entry', value: '4 vs 1 to 2', tone: 'good' },
          ],
        },
        caption: 'Small gaps, small lists',
      },
    },
    {
      title: 'Phrases',
      tag: 'concept',
      heading: 'Positions let a phrase query check word order',
      eli5: 'Each card also notes which page of the book the word is on. For "dragon castle" the librarian checks the two words are on neighboring pages.',
      body: [
        'Intersecting lists finds documents with both words anywhere. To match the phrase "wireless headphones" the lists also record the **position** of each occurrence.',
        'Doc 8 has `wireless` at 1 and `headphone` at 2, so it matches. A document with them far apart does not.',
      ],
      keyIdea: 'Positions in the postings turn a both-words match into a phrase match.',
      metrics: { lat: '32 ms', work: '240K postings', qps: '45/s', rank: 'better' },
      scene: {
        nodes: [{ ...api, status: 'active', chips: ['"wireless headphones"'] }, { ...tWireless, status: 'active', chips: ['doc 8 @ 1'] }, { ...tHeadphone, status: 'active', chips: ['doc 8 @ 2'] }],
        links: [link('api', 'tWireless'), link('api', 'tHeadphone')],
        flows: [{ path: ['tWireless', 'api'], tone: 'data', label: 'doc 8 @ 1', duration: 1.4 }, { path: ['tHeadphone', 'api'], tone: 'data', label: 'doc 8 @ 2', duration: 1.4 }],
        panel: {
          title: 'Adjacent positions?',
          icon: 'Table',
          rows: [
            { text: 'doc 8: wireless 1, headphone 2', value: 'phrase', tone: 'good' },
            { text: 'doc 42: wireless 3, headphone 90', value: 'both words only', tone: 'warn' },
          ],
        },
        caption: 'Same list walk, plus a position check',
      },
    },
    {
      title: 'Which is best?',
      tag: 'problem',
      heading: 'Up to 240,000 documents match. The shopper reads ten',
      eli5: 'Thousands of books have the word "dragon". The kid will only look at the first few, so the librarian has to put the best ones on top.',
      body: [
        'Finding matches is not enough. The index has to **rank** them, and a shopper rarely looks past the first page.',
        'The classic score is built from two counts: how often a term appears in a document, and how rare the term is overall.',
      ],
      keyIdea: 'Matching finds candidates. Ranking decides what the shopper sees.',
      metrics: { lat: '30 ms', work: '240K postings', qps: '50/s', rank: 'unordered' },
      metricTones: { rank: 'warn' },
      scene: {
        nodes: [user, { ...api, status: 'active', badge: 'up to 240,000 matches' }, { ...index, at: at(3.8, -3.4), status: 'active', chips: ['top 10 needed'] }],
        links: [link('user', 'api'), link('api', 'index')],
        flows: [{ path: ['user', 'api', 'index', 'api', 'user'], tone: 'request', label: 'which 10?', duration: 2.6 }],
        caption: 'Ranking is the real product',
      },
    },
    {
      title: 'TF and IDF',
      tag: 'concept',
      heading: 'TF-IDF: reward frequent in the doc, rare in the corpus',
      eli5: 'A book that says "dragon" on many pages is more about dragons. A word found in nearly every book, like "story", tells you very little. Scoring books this way is **TF-IDF**.',
      body: [
        '**Term frequency** (TF) is how often the term appears in this document. **Inverse document frequency** (IDF) measures rarity: `idf = ln(N / df)`, where `df` is how many documents contain the term.',
        'With N = 24 million, `black` (4.8M docs) scores 1.6, `wireless` (2.4M) scores 2.3 and `headphone` (240K) scores 4.6. The score is the sum of `tf × idf` over the query terms.',
      ],
      keyIdea: 'TF rewards documents that use the term often. IDF rewards terms few documents use.',
      metrics: { lat: '30 ms', work: '240K postings', qps: '50/s', rank: 'scored' },
      scene: {
        nodes: [{ ...api, status: 'active' }, { ...tWireless, badge: 'idf 2.3' }, { ...tHeadphone, status: 'ok', badge: 'idf 4.6' }, { ...tBlack, status: 'dim', badge: 'idf 1.6' }],
        links: termLinks,
        flows: [
          { path: ['tHeadphone', 'api'], tone: 'data', label: 'rare: weighs more', count: 2, duration: 1.2 },
          { path: ['tWireless', 'api'], tone: 'data', label: 'common: weighs less', duration: 1.2 },
        ],
        panel: {
          title: 'idf = ln(24M / df)',
          icon: 'Scale',
          rows: [
            { text: 'black, 4.8M docs', value: '1.6' },
            { text: 'wireless, 2.4M docs', value: '2.3' },
            { text: 'headphone, 240K docs', value: '4.6', tone: 'good' },
          ],
          footer: { text: 'df is the posting list length', tone: 'muted' },
        },
        caption: 'The rarer the term, the more a match is worth',
      },
    },
    {
      title: 'Gaming it',
      tag: 'problem',
      heading: 'Raw TF-IDF rewards keyword stuffing',
      eli5: 'One book has six honest words about dragons. Another is a huge book that shouts "dragon" ten times. If counting is all that matters, the shouting book wins.',
      body: [
        'Doc 8 is an honest six-word title that mentions each query term once: score 6.9. Doc 42 is a 120-word description stuffed with "wireless headphones" ten times: score 69.',
        'The spam wins by ten to one. Raw counts have no limit and ignore document length.',
      ],
      keyIdea: 'Unbounded term counts let long, repetitive text beat a precise match.',
      metrics: { lat: '30 ms', work: '240K postings', qps: '50/s', rank: 'gamed' },
      metricTones: { rank: 'bad' },
      scene: {
        nodes: [
          { ...api, status: 'active', badge: 'rank by TF-IDF' },
          { id: 'doc8', kind: 'block', size: 0.8, at: at(-3.6, 3.4), label: 'doc 8', sub: '6 words, honest', icon: 'FileText', tint: 'green', status: 'ok', chips: [{ text: 'TF-IDF 6.9', tone: 'good' }] },
          { id: 'doc42', kind: 'block', size: 0.8, at: at(3.6, 3.4), label: 'doc 42', sub: '120 words, stuffed', icon: 'FileText', tint: 'red', status: 'hot', chips: [{ text: 'TF-IDF 69', tone: 'bad' }] },
        ],
        links: [link('api', 'doc8'), link('api', 'doc42')],
        flows: [{ path: ['doc42', 'api'], tone: 'error', label: '1st', duration: 1.2 }, { path: ['doc8', 'api'], tone: 'response', label: '2nd', duration: 1.2, delay: 0.4 }],
        caption: 'Ten mentions beat one honest one',
      },
    },
    {
      title: 'Saturation',
      tag: 'tradeoff',
      heading: 'BM25 part one: repetition has diminishing returns',
      eli5: 'Saying "dragon" fifty times is hardly better than saying it ten times. After a few mentions the book is already about dragons, and more shouting adds almost nothing.',
      body: [
        '**BM25** is the default ranking function in Lucene, Elasticsearch and OpenSearch. First change: term frequency **saturates**.',
        'In a document of average length, with `k1 = 1.2`, the first mention is worth 1.0, ten mentions 1.96, and no count can pass 2.2.',
      ],
      keyIdea: 'BM25 caps how much repeating a word can earn.',
      metrics: { lat: '30 ms', work: '240K postings', qps: '50/s', rank: 'fairer' },
      scene: {
        nodes: [{ ...api, status: 'active', badge: 'BM25' }, { ...tHeadphone, status: 'ok', chips: ['1 mention: 1.0', '10 mentions: 1.96'] }, { ...index, at: at(3.6, 3.4), status: 'idle', badge: 'cap 2.2' }],
        links: [link('api', 'tHeadphone'), link('tHeadphone', 'index', { style: 'faint' })],
        flows: [{ path: ['tHeadphone', 'api'], tone: 'data', label: 'tf curve flattens', duration: 1.6 }],
        panel: {
          title: 'TF contribution, k1 = 1.2',
          icon: 'TrendingUp',
          rows: [
            { text: '1 mention', value: '1.00' },
            { text: '3 mentions', value: '1.57' },
            { text: '10 mentions', value: '1.96', tone: 'warn' },
            { text: 'Maximum possible', value: '2.20', tone: 'muted' },
          ],
        },
        caption: 'The curve flattens',
      },
    },
    {
      title: 'Length norm',
      tag: 'tradeoff',
      heading: 'BM25 part two: long documents are discounted',
      eli5: 'A short book that is all about dragons beats a huge book that mentions them in passing. Longer than average books get a small penalty.',
      body: [
        'Scores are **normalized by length**: a document longer than average is discounted, controlled by `b = 0.75`. A match in a short title means more than the same match in a long description.',
        'With an average length of 12 words, doc 8 now scores 8.7 and doc 42 scores 7.9. The honest title ranks first.',
      ],
      keyIdea: 'Length normalization makes a dense match beat a diluted one.',
      metrics: { lat: '30 ms', work: '240K postings', qps: '50/s', rank: 'good' },
      metricTones: { rank: 'good' },
      scene: {
        nodes: [
          { ...api, status: 'active', badge: 'rank by BM25' },
          { id: 'doc8', kind: 'block', size: 0.8, at: at(-3.6, 3.4), label: 'doc 8', sub: '6 words, honest', icon: 'FileText', tint: 'green', status: 'ok', chips: [{ text: 'BM25 8.7', tone: 'good' }] },
          { id: 'doc42', kind: 'block', size: 0.8, at: at(3.6, 3.4), label: 'doc 42', sub: '120 words, stuffed', icon: 'FileText', tint: 'amber', chips: [{ text: 'BM25 7.9', tone: 'warn' }] },
        ],
        links: [link('api', 'doc8'), link('api', 'doc42')],
        flows: [{ path: ['doc8', 'api'], tone: 'response', label: '1st', duration: 1.2 }, { path: ['doc42', 'api'], tone: 'response', label: '2nd', duration: 1.2, delay: 0.4 }],
        panel: {
          title: 'Same two documents',
          icon: 'Scale',
          rows: [
            { text: 'doc 8, raw TF-IDF', value: '6.9' },
            { text: 'doc 42, raw TF-IDF', value: '69', tone: 'bad' },
            { text: 'doc 8, BM25', value: '8.7', tone: 'good' },
            { text: 'doc 42, BM25', value: '7.9', tone: 'warn' },
          ],
        },
        caption: 'The honest title now ranks first',
      },
    },
    {
      title: 'BM25 code',
      tag: 'concept',
      heading: 'BM25 in a dozen lines',
      eli5: 'The librarian follows a small recipe for each book: how rare is the word, how many times does it show up, and how long is the book. Then she adds up the points.',
      body: [
        'Each term adds `idf × tf × (k1 + 1) / (tf + k1 × norm)`. Both counts live in the index: `df` is the posting list length, and each posting carries its `tf`.',
      ],
      keyIdea: 'BM25 is a sum over query terms of a saturating, length-normalized term weight times IDF.',
      metrics: { lat: '30 ms', work: '240K postings', qps: '50/s', rank: 'good' },
      scene: {
        nodes: [{ ...api, status: 'active', chips: ['bm25()'] }, { ...index, at: at(3.6, -3.4), status: 'ok', badge: 'df and tf stored' }, { ...user, chips: ['top 10'] }],
        links: [link('user', 'api'), link('api', 'index')],
        flows: [{ path: ['api', 'index', 'api', 'user'], tone: 'response', label: 'scored ids', duration: 2.4 }],
        caption: 'Score every candidate, keep the best 10',
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
      title: 'Signals',
      tag: 'tradeoff',
      heading: 'Real ranking blends BM25 with business signals',
      eli5: 'The librarian also peeks at which books kids loved most and which are brand new, and mixes that with the word points.',
      body: [
        'Text relevance is one input. Real systems blend BM25 with sales, ratings, freshness and price, and can boost a field such as the title over the description.',
        'Teams tune the blend with click data, since the best formula is the one shoppers act on.',
      ],
      keyIdea: 'BM25 gets the candidates into a good order. Business signals finish the ranking.',
      metrics: { lat: '35 ms', work: '240K postings', qps: '50/s', rank: 'best' },
      metricTones: { rank: 'good' },
      scene: {
        nodes: [{ ...api, status: 'active', chips: ['final score'] }, { ...index, at: at(3.8, -3.4), status: 'ok', chips: ['BM25'] }, { ...db, at: at(0, 3.4), label: 'signals', sub: 'sales, ratings, age' }],
        links: [link('api', 'index'), link('api', 'db')],
        flows: [{ path: ['index', 'api'], tone: 'data', label: 'BM25', duration: 1.4 }, { path: ['db', 'api'], tone: 'data', label: 'sales, rating', duration: 1.4, delay: 0.3 }],
        panel: {
          title: 'Blend (example weights)',
          icon: 'Star',
          rows: [
            { text: 'BM25 text match', value: '60%' },
            { text: 'Sales and ratings', value: '25%' },
            { text: 'Freshness', value: '10%' },
            { text: 'Price fit', value: '5%' },
          ],
        },
        caption: 'Text match plus popularity',
      },
    },
    {
      title: 'Part 1 recap',
      tag: 'recap',
      heading: 'Terms, lists and scores',
      eli5: 'Helpers write a card for every word, and that card box is the **inverted index**. The librarian reads a few cards and picks the best books. Part 2 is about a bigger library.',
      body: [
        'A leading-wildcard `LIKE` reads every row. A search index runs text through an **analyzer** and stores an **inverted index** of sorted **posting lists**. Multi-word queries intersect them, starting from the rarest term.',
        '**BM25** ranks matches: rare terms weigh more, repetition saturates and long documents are discounted. Part 2 covers shards, segments, sync and the rest.',
      ],
      keyIdea: 'Search is analyze, look up, intersect, score. Cost follows matches, not corpus size.',
      metrics: { lat: '30 ms', work: '240K postings', qps: '50/s', rank: 'good' },
      metricTones: { lat: 'good', work: 'good', qps: 'good', rank: 'good' },
      scene: {
        nodes: [user, { ...api, status: 'ok' }, { ...analyzer, at: at(0, 3.4) }, { ...index, status: 'ok' }],
        links: [link('user', 'api'), link('api', 'index'), link('analyzer', 'index')],
        flows: [{ path: ['user', 'api', 'index', 'api', 'user'], tone: 'response', label: 'ranked results', duration: 2.6 }, { path: ['analyzer', 'index'], tone: 'data', label: 'terms', duration: 1.4, delay: 0.5 }],
        caption: 'Analyze, look up, intersect, score',
      },
      quiz: {
        question: 'A listing repeats "wireless headphones" 30 times in a very long description and outranks a precise short title under TF-IDF. Which BM25 behavior fixes this?',
        options: ['Stemming the query', 'Saturating term frequency and normalizing by document length', 'Adding more shards', 'Storing positions in postings'],
        answer: 1,
        explain: 'Saturation caps what repeats can earn and length normalization discounts long documents. Stemming, shards and positions do not change the scoring of repeats.',
      },
    },
  ],
};
