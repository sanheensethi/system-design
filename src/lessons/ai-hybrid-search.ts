import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const user: SceneNode = { id: 'user', kind: 'user', at: at(-6, 0), label: 'user', sub: 'support agent' };
const bm25: SceneNode = { id: 'bm25', kind: 'block', at: at(-1.8, -2.8), label: 'BM25 index', sub: 'exact words', icon: 'Search', tint: 'blue' };
const dense: SceneNode = { id: 'dense', kind: 'block', at: at(1.8, 2.8), label: 'vector store', sub: 'meaning', icon: 'Database', tint: 'violet' };
const fuse: SceneNode = { id: 'fuse', kind: 'block', at: at(6.2, 0), label: 'fusion', sub: 'RRF', icon: 'Layers', tint: 'green' };
const docs: SceneNode = { id: 'docs', kind: 'storage', size: 0.8, at: at(7.4, 3.4), label: 'help pages', sub: '80M chunks' };
const reranker: SceneNode = { id: 'rerank', kind: 'block', at: at(10.6, 0), label: 'reranker', sub: 'cross-encoder', icon: 'Scale', tint: 'amber' };

export const aiHybridSearch: Lesson = {
  id: 'ai-hybrid-search',
  title: 'Hybrid search',
  tagline: 'Why one retriever is not enough, how keyword and vector search run side by side, and how their rankings merge.',
  minutes: 13,
  level: 'Intermediate',
  learn: [
    'What dense vector search is great at, and the exact tokens it misses',
    'How BM25 keyword search works and where it fails',
    'Running both retrievers in parallel and why their scores cannot be added',
    'Reciprocal rank fusion: the formula, a worked example and the k = 60 default',
    'Weighted fusion, the measured gains, and what a second index costs',
    'Keeping two indexes consistent, filtering both, and handing the result to a reranker',
  ],
  metrics: [
    { key: 'fail', label: 'Missed answers', icon: 'Search' },
    { key: 'ndcg', label: 'nDCG@5', icon: 'TrendingUp' },
    { key: 'lat', label: 'Retrieval time', icon: 'Timer' },
    { key: 'cost', label: 'Index cost', icon: 'Receipt' },
  ],
  steps: [
    {
      title: 'Lost code',
      tag: 'problem',
      heading: 'The vector search that cannot find an error code',
      eli5: 'A **librarian** who shelves books by topic is asked for the book with "E4021" in the title. She hands over three books about refunds, because refunds is the topic, and none of them has the number.',
      body: [
        'A support team built RAG over 80M chunks of help pages. An agent types `refund fails with E4021`. The vector store returns pages about refund policy and failed payments. The page that explains **E4021** is not in the top 10.',
        'The embedding captured the topic and blurred the code. A rare token like `E4021` is one small part of one vector, and many other pages are closer to the topic.',
      ],
      keyIdea: 'Dense retrieval matches meaning. Exact strings such as codes, SKUs and names can get lost.',
      metrics: { fail: '?', ndcg: '0.48', lat: '30 ms', cost: '-' },
      metricTones: { ndcg: 'warn' },
      scene: {
        nodes: [
          { ...user, chips: [{ text: 'refund fails with E4021', tone: 'warn' }] },
          { ...dense, status: 'hot', badge: 'top 10: no E4021' },
          { ...docs, status: 'dim' },
        ],
        links: [link('user', 'dense', { label: 'dense only' }), link('dense', 'docs')],
        flows: [
          { path: ['user', 'dense'], tone: 'request', label: 'E4021 refund', duration: 1.4 },
          { path: ['dense', 'user'], tone: 'error', label: 'wrong pages', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Top 3 from the vector store',
          icon: 'List',
          rows: [
            { text: '1. Refund policy overview', value: '0.84', tone: 'warn' },
            { text: '2. Why card payments fail', value: '0.82', tone: 'warn' },
            { text: '3. Refund timelines', value: '0.80', tone: 'warn' },
            { text: '... Fixing error E4021', value: 'rank 31', tone: 'bad' },
          ],
          footer: { text: 'The right page is there, ranked far too low', tone: 'bad' },
        },
        caption: 'The topic matched. The code did not.',
      },
    },
    {
      title: 'Dense strength',
      tag: 'concept',
      heading: 'What dense retrieval is good at',
      eli5: 'The **vector store** librarian knows what a book is about, even in other words. Ask "how do I cancel" and she brings the book on "refund process", because the two ideas live on the same shelf.',
      body: [
        'A **dense** retriever turns the query and every chunk into an embedding and returns the nearest ones. It finds paraphrases: "how do I cancel" lands on "refund process" with zero shared words.',
        'It also copes with typos, synonyms and other languages. That is why it is the default first stage. Its weak side is anything where the exact characters matter.',
      ],
      keyIdea: 'Dense search finds what a query means, even when the words differ.',
      metrics: { fail: '?', ndcg: '0.48', lat: '30 ms', cost: '-' },
      scene: {
        nodes: [
          { ...user, chips: ['how do I cancel?'] },
          { ...dense, status: 'active' },
          { ...docs, label: 'refund process', sub: 'no word "cancel"', status: 'ok' },
        ],
        links: [link('user', 'dense'), link('dense', 'docs')],
        flows: [
          { path: ['user', 'dense'], tone: 'request', label: 'how do I cancel?', duration: 1.4 },
          { path: ['dense', 'docs'], tone: 'data', label: 'nearest vector', duration: 1.2, delay: 1.5 },
          { path: ['docs', 'user'], tone: 'response', label: 'refund process', duration: 1.6, delay: 2.8 },
        ],
        panel: {
          title: 'Dense wins on meaning',
          icon: 'Search',
          rows: [
            { text: 'cancel my order  vs  refund process', value: '0.81', tone: 'good' },
            { text: 'langauge typo  vs  language', value: '0.93', tone: 'good' },
            { text: 'E4021  vs  E4012', value: '0.97', tone: 'bad' },
          ],
          footer: { text: 'Codes that differ by one digit look alike', tone: 'warn' },
        },
        caption: 'Paraphrases are easy. Near-identical codes are not.',
      },
    },
    {
      title: 'BM25',
      tag: 'concept',
      heading: 'BM25: score pages by the exact words they share',
      eli5: 'The **card catalog** lists every word and the books that contain it. Ask for "E4021" and the catalog points straight at the few books with that exact word. It never guesses at topics.',
      body: [
        '**BM25** is the classic keyword scorer. An inverted index maps each term to the chunks that contain it. A chunk scores higher when it has the query terms often, and rare terms count for more (the IDF idea).',
        '`E4021` appears in maybe 40 chunks out of 80M, so it carries a lot of weight. The search index lesson covers how the index is built. Here we only need what it returns: a ranked list.',
      ],
      keyIdea: 'BM25 rewards exact term matches and weights rare terms heavily. It has no idea what words mean.',
      metrics: { fail: '?', ndcg: '-', lat: '15 ms', cost: '-' },
      scene: {
        nodes: [
          { ...user, chips: ['refund fails with E4021'] },
          { ...bm25, status: 'active', badge: 'E4021: 40 chunks' },
          { ...docs, label: 'Fixing error E4021', sub: 'has the exact code', status: 'ok' },
        ],
        links: [link('user', 'bm25'), link('bm25', 'docs')],
        flows: [
          { path: ['user', 'bm25'], tone: 'request', label: 'E4021', duration: 1.4 },
          { path: ['bm25', 'docs'], tone: 'data', label: 'term lookup', duration: 1.2, delay: 1.5 },
          { path: ['docs', 'user'], tone: 'response', label: 'rank 1', duration: 1.6, delay: 2.8 },
        ],
        panel: {
          title: 'Inverted index (one entry)',
          icon: 'Table',
          rows: [
            { text: 'term "E4021"', value: '40 chunks', tone: 'good' },
            { text: 'term "refund"', value: '900K chunks', tone: 'muted' },
            { text: 'term "fails"', value: '6M chunks', tone: 'muted' },
          ],
          footer: { text: 'Rare term, big score. Common term, small score.', tone: 'muted' },
        },
        caption: 'Rare words decide the ranking',
      },
    },
    {
      title: 'BM25 knobs',
      tag: 'concept',
      heading: 'BM25 details: saturation, length and tokens',
      eli5: 'The **card catalog** clerk stops getting more excited after a word shows up many times in one book, and she shrinks the score of very fat books. She also needs to write "ERR-4021" on one card, not two.',
      body: [
        '**k1** makes repeated terms saturate, so the tenth mention adds little. **b** normalizes for length, so long pages do not win just by being long. Rare terms still dominate through IDF.',
        'The analyzer matters too. Many analyzers split `ERR-4021` at the hyphen, lowercase it or stem it, and then the code fails in the keyword lane as well. Keep codes and SKUs as single tokens with keyword fields or word-delimiter handling.',
      ],
      keyIdea: 'BM25 needs saturation and length normalization, and an analyzer that keeps codes whole.',
      metrics: { fail: '?', ndcg: '-', lat: '15 ms', cost: '-' },
      scene: {
        nodes: [
          { ...user, chips: ['ERR-4021'] },
          { ...bm25, status: 'active', badge: 'k1, b, analyzer' },
          { ...docs, label: 'Fixing error E4021', sub: 'token kept whole', status: 'ok' },
        ],
        links: [link('user', 'bm25'), link('bm25', 'docs')],
        flows: [
          { path: ['user', 'bm25'], tone: 'request', label: 'ERR-4021', duration: 1.4 },
          { path: ['bm25', 'docs'], tone: 'data', label: 'one token', duration: 1.2, delay: 1.5 },
        ],
        panel: {
          title: 'BM25 dials',
          icon: 'Gauge',
          rows: [
            { text: 'k1: repeats saturate', value: 'tenth hit adds little', tone: 'default' },
            { text: 'b: length normalization', value: 'long pages damped', tone: 'default' },
            { text: 'Analyzer: keep ERR-4021 whole', value: 'one token', tone: 'warn' },
          ],
          footer: { text: 'A split code fails in the keyword lane too', tone: 'warn' },
        },
        caption: 'Tokens decide what can match',
      },
    },
    {
      title: 'Opposite blind spots',
      tag: 'tradeoff',
      heading: 'Each retriever fails where the other one wins',
      eli5: 'The **card catalog** finds an exact word but misses a book that says "money back" when you asked for "refund". The **vector store** librarian is the other way round. Together they cover each other.',
      body: [
        'BM25 misses paraphrases: a query for "cancel" finds nothing in a page that only says "refund". Dense search misses exact tokens: product names, error codes, SKUs, person names, version numbers.',
        'Neither is better overall. They are **complementary**. A page one of them ranks high is often a page the other ranks low.',
      ],
      keyIdea: 'BM25 and dense search have opposite weaknesses, so running both covers what either one alone drops.',
      metrics: { fail: '?', ndcg: '-', lat: '-', cost: '-' },
      scene: {
        nodes: [
          { ...bm25, status: 'active' },
          { ...dense, status: 'active' },
          { ...docs, at: at(5.6, 0), label: 'the corpus', sub: 'codes + prose' },
        ],
        links: [link('bm25', 'docs'), link('dense', 'docs')],
        flows: [
          { path: ['bm25', 'docs'], tone: 'data', label: 'exact words', duration: 1.4 },
          { path: ['dense', 'docs'], tone: 'data', label: 'meaning', duration: 1.4, delay: 0.7 },
        ],
        panel: {
          title: 'Who finds what',
          icon: 'Scale',
          rows: [
            { text: 'Error code E4021', value: 'BM25', tone: 'good' },
            { text: 'SKU, version, person name', value: 'BM25', tone: 'good' },
            { text: '"cancel" vs "refund"', value: 'dense', tone: 'good' },
            { text: 'Typos, other languages', value: 'dense', tone: 'good' },
          ],
          footer: { text: 'Complementary, not competing', tone: 'muted' },
        },
        caption: 'Two sets of strengths',
      },
    },
    {
      title: 'Two lanes',
      tag: 'concept',
      heading: 'Run both retrievers in parallel',
      eli5: 'The agent asks the **card catalog** and the **vector store** librarian at the same moment. Each comes back with her own pile of 100 books, ranked best first.',
      body: [
        'On every query, send the text to BM25 and send its embedding to the vector store at the same time. Each returns its own **top 100** chunk ids in rank order.',
        'Because the lanes run in parallel, total time is the slower lane (30 ms) plus about 20 ms of overhead: a second network hop, the 100-id merge and decoding the results. Now there are two ranked lists and one answer is needed. That is the **fusion** step.',
      ],
      keyIdea: 'Hybrid search is two retrievers run in parallel, then one merge step that produces a single ranking.',
      metrics: { fail: '?', ndcg: '-', lat: '50 ms', cost: '-' },
      scene: {
        nodes: [user, bm25, dense, fuse],
        links: [link('user', 'bm25'), link('user', 'dense'), link('bm25', 'fuse'), link('dense', 'fuse')],
        flows: [
          { path: ['user', 'bm25', 'fuse'], tone: 'request', label: 'top 100', duration: 2.2 },
          { path: ['user', 'dense', 'fuse'], tone: 'request', label: 'top 100', duration: 2.2 },
        ],
        panel: {
          title: 'One query, two lists',
          icon: 'Split',
          rows: [
            { text: 'BM25 lane', value: '15 ms', tone: 'default' },
            { text: 'Dense lane (embed + ANN)', value: '30 ms', tone: 'default' },
            { text: 'Overhead (hop, merge, decode)', value: '~20 ms', tone: 'default' },
            { text: 'Wall time (slower lane + overhead)', value: '~50 ms', tone: 'good' },
          ],
          footer: { text: 'Parallel lanes: slower lane plus overhead, not the sum', tone: 'muted' },
        },
        caption: 'Same query, two ranked lists',
      },
    },
    {
      title: 'Scores clash',
      tag: 'tradeoff',
      heading: 'Why you cannot just add the two scores',
      eli5: 'One librarian grades books with a number that has no upper limit and the other grades them from -1 to 1. Adding "14 plus 0.8" is meaningless, because the big-number grader would always win the argument.',
      body: [
        'BM25 scores are unbounded and depend on the corpus: 14.2 for one query, 3.1 for another. Cosine similarity sits between -1 and 1 and is usually 0.7 to 0.9 for relevant chunks.',
        'A raw sum is decided by whichever scale is bigger. Normalizing per query is possible but fragile. A cleaner idea: ignore scores and use only **ranks**, which are comparable by definition.',
      ],
      keyIdea: 'The two score scales are incompatible. Ranks are the common currency.',
      metrics: { fail: '?', ndcg: '-', lat: '50 ms', cost: '-' },
      metricTones: {},
      scene: {
        nodes: [{ ...bm25, badge: 'score 14.2' }, { ...dense, badge: 'score 0.74' }, { ...fuse, status: 'hot', badge: '14.2 + 0.74 = ?' }],
        links: [link('bm25', 'fuse', { label: '0 to unbounded', labelTone: 'warn' }), link('dense', 'fuse', { label: '-1 to 1', labelTone: 'warn' })],
        flows: [
          { path: ['bm25', 'fuse'], tone: 'error', label: '14.2', duration: 1.6 },
          { path: ['dense', 'fuse'], tone: 'error', label: '0.74', duration: 1.6, delay: 0.5 },
        ],
        panel: {
          title: 'Two pages, two scales',
          icon: 'Table',
          rows: [
            { text: 'Page A: BM25 / cosine', value: '14.2 / 0.74' },
            { text: 'Page B: BM25 / cosine', value: '3.1 / 0.88' },
            { text: 'Raw sum, A vs B', value: '14.9 vs 4.0', tone: 'bad' },
          ],
          footer: { text: 'BM25 drowns out the vector score', tone: 'bad' },
        },
        caption: 'Scores are not comparable. Ranks are.',
      },
    },
    {
      title: 'RRF formula',
      tag: 'concept',
      heading: 'Reciprocal rank fusion: add up 1 / (k + rank)',
      eli5: 'Each librarian numbers her pile 1, 2, 3. A book gets a few points for each pile it is in, and more points the closer to the top it sits. The head librarian adds the points up.',
      body: [
        '**Reciprocal rank fusion** (RRF) gives every chunk `1 / (k + rank)` from each list it appears in, then sums. Rank 1 is the best. A chunk missing from a list gets nothing from it.',
        'Chunks that both lanes like collect two contributions and rise. Chunks one lane loves alone stay competitive but do not run away with it. No score ever enters the formula.',
      ],
      keyIdea: 'RRF sums 1 / (k + rank) across lists. Agreement between lanes beats a single high rank.',
      metrics: { fail: '?', ndcg: '-', lat: '50 ms', cost: '-' },
      scene: {
        nodes: [{ ...bm25, badge: 'ranks 1..100' }, { ...dense, badge: 'ranks 1..100' }, { ...fuse, status: 'active', badge: 'sum 1/(60+rank)' }],
        links: [link('bm25', 'fuse', { label: 'rank' }), link('dense', 'fuse', { label: 'rank' })],
        flows: [
          { path: ['bm25', 'fuse'], tone: 'data', label: 'rank 1', duration: 1.6 },
          { path: ['dense', 'fuse'], tone: 'data', label: 'rank 3', duration: 1.6, delay: 0.5 },
        ],
        panel: {
          title: 'RRF with k = 60',
          icon: 'Code',
          code: 'score(d) = sum over lists of\n           1 / (60 + rank(d))\n\nrank 1   ->  1/61  = 0.0164\nrank 3   ->  1/63  = 0.0159\nrank 100 ->  1/160 = 0.0063',
          footer: { text: 'Missing from a list: add nothing', tone: 'muted' },
        },
        caption: 'Ranks in, one fused score out',
      },
    },
    {
      title: 'RRF by hand',
      tag: 'case',
      heading: 'Worked example: four chunks, two lists',
      eli5: 'The page that **both** librarians put near the top collects points from two piles and wins. A page only one of them loves gets one share of points and sits lower.',
      body: [
        'Chunk A is rank 1 in BM25 and rank 3 in dense: `1/61 + 1/63 = 0.0323`. Chunk B is rank 5 and rank 1: `1/65 + 1/61 = 0.0318`.',
        'Chunk C is rank 2 in BM25 only: `0.0161`. Chunk D is rank 4 in dense only: `0.0156`. Final order: A, B, C, D. The fixing page for E4021, found by both lanes, is now first.',
      ],
      keyIdea: 'A chunk that shows up in both lists outranks a chunk that tops only one.',
      metrics: { fail: '?', ndcg: '-', lat: '50 ms', cost: '-' },
      scene: {
        nodes: [{ ...bm25, badge: 'A1 C2 B5' }, { ...dense, badge: 'B1 A3 D4' }, { ...fuse, status: 'ok', badge: 'A, B, C, D' }],
        links: [link('bm25', 'fuse'), link('dense', 'fuse')],
        flows: [
          { path: ['bm25', 'fuse'], tone: 'data', label: 'A C B', duration: 1.6 },
          { path: ['dense', 'fuse'], tone: 'data', label: 'B A D', duration: 1.6, delay: 0.5 },
        ],
        panel: {
          title: 'Fused scores',
          icon: 'Table',
          rows: [
            { text: 'A: BM25 #1, dense #3', value: '0.0323', tone: 'good' },
            { text: 'B: BM25 #5, dense #1', value: '0.0318', tone: 'good' },
            { text: 'C: BM25 #2 only', value: '0.0161' },
            { text: 'D: dense #4 only', value: '0.0156' },
          ],
          footer: { text: 'Order: A, B, C, D', tone: 'muted' },
        },
        caption: 'Agreement wins',
      },
      quiz: {
        question: 'A chunk is rank 1 in BM25 only. Another is rank 10 in BM25 and rank 10 in dense. With k = 60, which scores higher?',
        options: [
          'The BM25 rank 1 chunk: top rank always wins',
          'The chunk ranked 10 in both lists: 2/70 = 0.0286 beats 1/61 = 0.0164',
          'They tie, because RRF ignores ranks',
          'It depends on the raw BM25 score',
        ],
        answer: 1,
        explain: 'RRF sums contributions. Two modest ranks (2/70) add up to more than one top rank (1/61). That is how it rewards agreement between lanes.',
      },
    },
    {
      title: 'The code',
      tag: 'concept',
      heading: 'Hybrid retrieval in about 20 lines',
      eli5: 'The code is the head librarian\'s routine: ask both helpers, number each pile, hand out points, add them up, and keep the 50 books with the most points.',
      body: [
        'Fusion is a loop over the lists. Each lane over-fetches (100 ids) so a chunk that is mid-ranked in one lane and high in the other still has a chance to meet itself in the merge.',
        'Both lanes must return the **same id** for the same chunk, otherwise the sums never meet. The function returns the top 50 for the next stage.',
      ],
      keyIdea: 'Hybrid retrieval is two searches, one dictionary of summed reciprocal ranks, and a sort.',
      metrics: { fail: '?', ndcg: '0.54', lat: '50 ms', cost: '-' },
      metricTones: { ndcg: 'good' },
      scene: {
        nodes: [user, { ...bm25, status: 'active' }, { ...dense, status: 'active' }, { ...fuse, status: 'active', badge: 'top 50' }],
        links: [link('user', 'bm25'), link('user', 'dense'), link('bm25', 'fuse'), link('dense', 'fuse')],
        flows: [
          { path: ['user', 'bm25', 'fuse'], tone: 'request', label: '100 ids', duration: 2.2 },
          { path: ['user', 'dense', 'fuse'], tone: 'request', label: '100 ids', duration: 2.2 },
        ],
        panel: {
          title: 'Knobs in the code',
          icon: 'Gauge',
          rows: [
            { text: 'Candidates per lane', value: '100' },
            { text: 'RRF k', value: '60' },
            { text: 'Kept after fusion', value: '50' },
          ],
        },
        caption: 'Over-fetch, fuse, trim',
      },
      code: {
        language: 'python',
        title: 'Hybrid retrieval with RRF',
        source: `def fuse_rrf(lists, k=60):
    scores = {}
    for ranked in lists:                       # best first
        for pos, chunk_id in enumerate(ranked, start=1):
            scores[chunk_id] = scores.get(chunk_id, 0.0) + 1.0 / (k + pos)
    return sorted(scores, key=scores.get, reverse=True)

def hybrid_search(query, top=50):
    words = keyword_index.search(query, size=100)   # BM25 lane
    vec = embed(query)
    near = vector_store.query(vec, top_k=100)       # dense lane
    ids = fuse_rrf([ids_of(words), ids_of(near)])
    return ids[:top]`,
        highlight: [3, 4, 5, 9, 11, 12],
      },
    },
    {
      title: 'Choosing k',
      tag: 'concept',
      heading: 'RRF has almost nothing to tune',
      eli5: 'The point sheet says "60 plus the place". The 60 keeps first place from beating second place by too much, so one loud librarian cannot overrule the other.',
      body: [
        '`k` softens the top of each list. With `k = 60`, rank 1 is worth 0.0164 and rank 2 is worth 0.0161, a small gap. A tiny `k` would make rank 1 dominate. A huge `k` would flatten everything.',
        'The value 60 comes from the original RRF paper (Cormack and others, 2009) and is still the default. There is no score normalization and no per-index calibration, so it works out of the box.',
      ],
      keyIdea: 'RRF is parameter-free in practice: k = 60 works without calibration or per-index tuning.',
      metrics: { fail: '?', ndcg: '0.54', lat: '50 ms', cost: '-' },
      scene: {
        nodes: [{ ...bm25, status: 'dim' }, { ...dense, status: 'dim' }, { ...fuse, status: 'active', badge: 'k = 60' }],
        links: [link('bm25', 'fuse'), link('dense', 'fuse')],
        flows: [
          { path: ['bm25', 'fuse'], tone: 'data', label: 'rank', duration: 1.6 },
          { path: ['dense', 'fuse'], tone: 'data', label: 'rank', duration: 1.6, delay: 0.5 },
        ],
        panel: {
          title: 'Gap between rank 1 and rank 2',
          icon: 'Gauge',
          rows: [
            { text: 'k = 1: 1/2 vs 1/3', value: '0.167', tone: 'warn' },
            { text: 'k = 60: 1/61 vs 1/62', value: '0.0003', tone: 'good' },
            { text: 'k = 1000: 1/1001 vs 1/1002', value: '0.000001', tone: 'warn' },
          ],
          footer: { text: 'Small k: top rank dominates. Huge k: flat.', tone: 'muted' },
        },
        caption: 'One constant, rarely touched',
      },
    },
    {
      title: 'Weighted fusion',
      tag: 'tradeoff',
      heading: 'The alternative: weighted score fusion',
      eli5: 'The head librarian could trust one helper more: "count the card catalog double." That can work better, but she must first convert both graders to the same scale, for each shelf.',
      body: [
        'Linear fusion computes `0.5 * bm25 + 0.5 * dense` after rescaling both scores, for example min-max per query. Tuned on your own labeled queries, it can beat RRF by about 1 to 2 percent.',
        'The price is calibration. The weights and the rescaling depend on the index and drift when the corpus changes. Start with RRF. Move to weights only when you have an eval set to tune on.',
      ],
      keyIdea: 'Weighted fusion can edge out RRF, but only if you calibrate and keep re-tuning it.',
      metrics: { fail: '?', ndcg: '0.54', lat: '50 ms', cost: '-' },
      scene: {
        nodes: [{ ...bm25, badge: 'weight 0.5' }, { ...dense, badge: 'weight 0.5' }, { ...fuse, label: 'weighted fusion', sub: 'needs calibration', tint: 'amber', status: 'hot' }],
        links: [link('bm25', 'fuse', { label: 'min-max scaled' }), link('dense', 'fuse', { label: 'min-max scaled' })],
        flows: [
          { path: ['bm25', 'fuse'], tone: 'data', label: '0..1', duration: 1.6 },
          { path: ['dense', 'fuse'], tone: 'data', label: '0..1', duration: 1.6, delay: 0.5 },
        ],
        panel: {
          title: 'RRF vs weighted',
          icon: 'Scale',
          rows: [
            { text: 'Tuning needed', value: 'none vs per index', tone: 'warn' },
            { text: 'Score normalization', value: 'no vs yes', tone: 'warn' },
            { text: 'Quality when tuned', value: 'base vs +1 to 2%', tone: 'good' },
            { text: 'Survives corpus change', value: 'yes vs re-tune', tone: 'warn' },
          ],
        },
        caption: 'A small gain for a real upkeep bill',
      },
      code: {
        language: 'python',
        title: 'Weighted fusion needs scaling first',
        source: `def minmax(scores):
    lo, hi = min(scores.values()), max(scores.values())
    span = (hi - lo) or 1.0
    return {i: (s - lo) / span for i, s in scores.items()}

def fuse_weighted(bm25_scores, dense_scores, w=0.5):
    a, b = minmax(bm25_scores), minmax(dense_scores)
    ids = set(a) | set(b)
    return sorted(ids, key=lambda i: w * a.get(i, 0) + (1 - w) * b.get(i, 0),
                  reverse=True)`,
        highlight: [1, 2, 3, 4, 9],
      },
    },
    {
      title: 'The gain',
      tag: 'case',
      heading: 'What hybrid buys: 15 to 30 percent fewer misses',
      eli5: 'With both librarians on the job, far fewer questions end with "sorry, I cannot find it". It is the cheapest big win the library gets.',
      body: [
        'Public benchmarks and vendor write-ups typically report roughly 15 to 30 percent fewer **retrieval failures** when BM25 is added to dense search. The size depends heavily on the corpus and on how many exact-token queries you get.',
        'In this lesson\'s example, nDCG@5 goes from 0.48 to 0.54 and latency from 30 to 50 ms. These are illustrative numbers for this lesson\'s corpus. Measure on yours before you commit.',
      ],
      keyIdea: 'Public write-ups typically report 15 to 30 percent fewer retrieval failures for about 20 ms more in our table (15 to 40 ms depending on setup).',
      metrics: { fail: '-15 to -30%', ndcg: '0.54', lat: '50 ms', cost: '-' },
      metricTones: { fail: 'good', ndcg: 'good', lat: 'warn' },
      scene: {
        nodes: [{ ...user, chips: [{ text: 'refund fails with E4021', tone: 'good' }] }, { ...fuse, status: 'ok', badge: 'E4021 page: rank 1' }, { ...docs, status: 'ok', label: 'Fixing error E4021', sub: 'found' }],
        links: [link('user', 'fuse', { label: 'hybrid' }), link('fuse', 'docs')],
        flows: [
          { path: ['user', 'fuse'], tone: 'request', label: 'E4021 refund', duration: 1.4 },
          { path: ['fuse', 'docs'], tone: 'data', label: 'top ids', duration: 1.2, delay: 1.5 },
          { path: ['docs', 'user'], tone: 'response', label: 'right page', duration: 1.6, delay: 2.8 },
        ],
        panel: {
          title: 'Dense vs hybrid (illustrative)',
          icon: 'TrendingUp',
          rows: [
            { text: 'Dense only', value: 'nDCG@5 0.48 · 30 ms' },
            { text: 'Hybrid', value: 'nDCG@5 0.54 · 50 ms', tone: 'good' },
            { text: 'Retrieval failures', value: '-15 to -30% (typical)', tone: 'good' },
          ],
          footer: { text: 'Illustrative numbers. Measure on your own queries', tone: 'muted' },
        },
        caption: 'The E4021 page is back at rank 1',
      },
    },
    {
      title: 'Second index',
      tag: 'tradeoff',
      heading: 'The price: you now run and pay for two indexes',
      eli5: 'Hiring a second librarian and building a second catalog takes a whole new room. The room costs money every month, and each question takes a little longer to answer.',
      body: [
        'A keyword index over 80M chunks is about **400 GB** on disk. On a cluster of eight `r6g.xlarge` nodes that is roughly **$1,500 a month**, on top of the vector store.',
        'Query latency rises by about 20 ms in our table, 15 to 40 ms depending on setup. For most RAG products the quality gain is worth both costs. Plan for the extra index in capacity and on-call, not just in the retrieval code.',
      ],
      keyIdea: 'Hybrid adds a second index to store, scale and operate: about 400 GB and $1,500 a month at 80M chunks.',
      metrics: { fail: '-15 to -30%', ndcg: '0.54', lat: '+20 ms', cost: '+$1,500/mo' },
      metricTones: { fail: 'good', ndcg: 'good', lat: 'warn', cost: 'warn' },
      scene: {
        nodes: [
          { ...bm25, status: 'hot', load: 55, badge: '400 GB' },
          { ...dense },
          { id: 'nodes', kind: 'server', size: 0.8, at: at(5.6, -2.8), label: '8 × r6g.xlarge', sub: 'keyword cluster' },
        ],
        links: [link('bm25', 'nodes')],
        flows: [{ path: ['bm25', 'nodes'], tone: 'data', label: 'shards', duration: 1.6 }],
        panel: {
          title: 'Keyword index at 80M chunks',
          icon: 'Receipt',
          rows: [
            { text: 'Disk', value: '~400 GB' },
            { text: 'Cluster', value: '8 × r6g.xlarge' },
            { text: 'Cost', value: '~$1,500 / month', tone: 'warn' },
            { text: 'Latency added', value: '~20 ms (15 to 40)', tone: 'warn' },
          ],
          footer: { text: 'Worth it in almost every case', tone: 'good' },
        },
        caption: 'Quality has a monthly bill',
      },
      quiz: {
        question: 'Why does hybrid search add only a little latency, even though it runs two retrievers?',
        options: [
          'BM25 is free and takes no time',
          'The two lanes run in parallel, so total time is about the slower lane plus a small overhead for the hop and merge',
          'The vector store is skipped when BM25 finds a match',
          'Results are cached forever after the first query',
        ],
        answer: 1,
        explain: 'The lanes are independent, so they run at the same time. Wall time is roughly the slower lane plus about 20 ms of overhead, not the sum of both.',
      },
    },
    {
      title: 'One engine',
      tag: 'tradeoff',
      heading: 'One engine or two stores, and is it worth it',
      eli5: 'Instead of two rooms, one **librarian** can learn both tricks. That removes a room, but she may do each trick a little less well. Before moving, test her on twenty real questions.',
      body: [
        'Much of the two-index cost goes away in a single engine that runs both lanes and RRF itself: Elasticsearch, OpenSearch, Qdrant, Weaviate, or Postgres with tsvector plus pgvector. One store also removes the id-consistency problem.',
        'Hybrid is not worth it when queries are all prose with no codes or names, or the corpus is small. To find out, label about 100 real queries with their right pages and compare nDCG and recall before and after.',
      ],
      keyIdea: 'A single engine can run both lanes. Measure on a small labeled query set before paying for hybrid.',
      metrics: { fail: '-15 to -30%', ndcg: '0.54', lat: '+20 ms', cost: '+$1,500/mo' },
      metricTones: { fail: 'good', ndcg: 'good', lat: 'warn', cost: 'warn' },
      scene: {
        nodes: [
          { ...user, chips: ['refund fails with E4021'] },
          { id: 'engine', kind: 'block', at: at(3, 0), label: 'single engine', sub: 'BM25 + vectors + RRF', icon: 'Database', tint: 'green', status: 'active' },
          { ...docs, at: at(7, 3), label: 'help pages', sub: '80M chunks' },
        ],
        links: [link('user', 'engine', { label: 'one query' }), link('engine', 'docs')],
        flows: [
          { path: ['user', 'engine'], tone: 'request', label: 'query', duration: 1.4 },
          { path: ['engine', 'docs'], tone: 'data', label: 'fused ids', duration: 1.2, delay: 1.5 },
        ],
        panel: {
          title: 'Single engine vs two stores',
          icon: 'Scale',
          rows: [
            { text: 'Engines that do both', value: 'ES, OpenSearch, Qdrant, pgvector', tone: 'good' },
            { text: 'Id consistency', value: 'one store, one id', tone: 'good' },
            { text: 'Measure first', value: '~100 labeled queries', tone: 'default' },
            { text: 'Compare', value: 'nDCG and recall', tone: 'default' },
          ],
          footer: { text: 'Skip hybrid if queries have no codes or names', tone: 'muted' },
        },
        caption: 'Measure, then decide',
      },
    },
    {
      title: 'Same id',
      tag: 'case',
      heading: 'Both indexes must agree on what a chunk is',
      eli5: 'If the card catalog calls a book "Fixing E4021, part 2" and the map shelf calls it "item 77", the head librarian cannot tell they mean one book. Every chunk needs one name everywhere.',
      body: [
        'RRF adds scores by chunk id. If BM25 stores `kb-9:4` and the vector store stores a random UUID, the same chunk shows up as two different ones and never collects both contributions.',
        'Write each chunk to both indexes from the same ingest job, with one id such as `doc_id:chunk_ix`. A chunk written to only one index is invisible to the other lane.',
      ],
      keyIdea: 'Use one stable chunk id in both indexes, and write to both from the same ingest step.',
      metrics: { fail: '-15 to -30%', ndcg: '0.54', lat: '50 ms', cost: '+$1,500/mo' },
      scene: {
        nodes: [
          { id: 'ingest', kind: 'block', at: at(-6, 0), label: 'ingest job', sub: 'chunk + embed', icon: 'Workflow', tint: 'amber' },
          { ...bm25, chips: [{ text: 'id kb-9:4', tone: 'good' }] },
          { ...dense, chips: [{ text: 'id kb-9:4', tone: 'good' }] },
          { ...fuse, status: 'ok', badge: 'ids match' },
        ],
        links: [link('ingest', 'bm25'), link('ingest', 'dense'), link('bm25', 'fuse'), link('dense', 'fuse')],
        flows: [
          { path: ['ingest', 'bm25'], tone: 'event', label: 'kb-9:4', duration: 1.4 },
          { path: ['ingest', 'dense'], tone: 'event', label: 'kb-9:4', duration: 1.4 },
          { path: ['bm25', 'fuse'], tone: 'data', label: 'kb-9:4', duration: 1.4, delay: 1.5 },
          { path: ['dense', 'fuse'], tone: 'data', label: 'kb-9:4', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Chunk id rules',
          icon: 'Hash',
          code: 'id = f"{doc_id}:{chunk_ix}"\n\nwrite(keyword_index, id, text)\nwrite(vector_store,  id, vec)\n\n# same id, same chunk,\n# both indexes, one job',
        },
        caption: 'One name per chunk',
      },
    },
    {
      title: 'Same filters',
      tag: 'case',
      heading: 'Apply the same filters in both lanes',
      eli5: 'Some shelves are staff-only. Both librarians must check the visitor\'s badge before pulling any book. If only one checks, the other hands over a locked-room book.',
      body: [
        'Chunks carry metadata such as `team` and `acl`. The filter has to run **inside each lane**, before ranking. If only the vector lane filters, a chunk the user may not see can come in through BM25 and be fused into the final list.',
        'Filtering after fusion also hurts quality: you fetch 100, remove 80, and are left with 20. Push the same filter down to both indexes.',
      ],
      keyIdea: 'Filter inside both retrievers, so access rules hold and each lane still returns a full top 100.',
      metrics: { fail: '-15 to -30%', ndcg: '0.54', lat: '50 ms', cost: '+$1,500/mo' },
      scene: {
        nodes: [
          { ...user, chips: [{ text: 'team: billing', tone: 'good' }] },
          { ...bm25, chips: [{ text: 'filter acl', tone: 'good' }] },
          { ...dense, chips: [{ text: 'filter acl', tone: 'good' }] },
          { ...fuse, status: 'ok', badge: 'no leaks' },
        ],
        links: [link('user', 'bm25'), link('user', 'dense'), link('bm25', 'fuse'), link('dense', 'fuse')],
        flows: [
          { path: ['user', 'bm25', 'fuse'], tone: 'request', label: 'query + acl', duration: 2.2 },
          { path: ['user', 'dense', 'fuse'], tone: 'request', label: 'query + acl', duration: 2.2 },
        ],
        panel: {
          title: 'Where to filter',
          icon: 'Shield',
          rows: [
            { text: 'Inside both lanes', value: '100 allowed hits each', tone: 'good' },
            { text: 'Vector lane only', value: 'leak via BM25', tone: 'bad' },
            { text: 'After fusion', value: '100 -> ~20 left', tone: 'warn' },
          ],
        },
        caption: 'Filters go down into each index',
      },
    },
    {
      title: 'To the reranker',
      tag: 'concept',
      heading: 'Hybrid is stage one: hand the shortlist to a reranker',
      eli5: 'The head librarian now has 50 good books. A careful reader skims each one against your exact question and picks the best 5 for the table. That is the next lesson.',
      body: [
        'Hybrid search is a cheap, wide first stage. Its job is recall: make sure the right chunk is somewhere in the top 50 or 100. It does not need to put the best one first.',
        'A **cross-encoder reranker** scores each (query, chunk) pair together and keeps the top 5 for the LLM. In this lesson\'s illustrative numbers that moves nDCG@5 from 0.54 to 0.62 at about 130 ms total. The reranking lesson covers it.',
      ],
      keyIdea: 'Hybrid optimizes recall cheaply. A reranker then optimizes order on the short list.',
      metrics: { fail: '-15 to -30%', ndcg: '0.62', lat: '130 ms', cost: '+$1,500/mo' },
      metricTones: { ndcg: 'good', lat: 'warn' },
      scene: {
        nodes: [{ ...fuse, badge: 'top 50' }, { ...reranker, load: 70, status: 'active' }, { id: 'llm', kind: 'block', at: at(14.4, 0), label: 'LLM', sub: 'top 5 chunks', icon: 'Cpu', tint: 'amber', load: 40 }],
        links: [link('fuse', 'rerank'), link('rerank', 'llm')],
        flows: [
          { path: ['fuse', 'rerank'], tone: 'data', label: '50 chunks', duration: 1.6 },
          { path: ['rerank', 'llm'], tone: 'data', label: 'top 5', duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'Quality by stage',
          icon: 'TrendingUp',
          rows: [
            { text: 'Dense only', value: '0.48 · 30 ms' },
            { text: 'Hybrid', value: '0.54 · 50 ms', tone: 'good' },
            { text: 'Hybrid + rerank', value: '0.62 · 130 ms', tone: 'good' },
          ],
          footer: { text: 'Retrieve wide, then rerank narrow', tone: 'muted' },
        },
        caption: 'Wide first, precise second',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Hybrid search in one picture',
      eli5: 'Two librarians, one who knows exact words and one who knows meanings, each make a ranked pile. The head librarian merges the piles by place, so books both like come first.',
      body: [
        'Dense search finds meaning and misses exact tokens. BM25 finds exact tokens and misses paraphrases. Run both in parallel, 100 candidates each, and merge with **RRF** using `1 / (k + rank)` and `k = 60`.',
        'Expect 15 to 30 percent fewer retrieval failures for about 20 ms in our table (15 to 40 ms depending on setup) and a second index. Share one chunk id, filter in both lanes, and pass the top 50 to a reranker.',
      ],
      keyIdea: 'Run keyword and vector search in parallel and merge by rank. It is the best-value upgrade to a RAG pipeline.',
      metrics: { fail: '-15 to -30%', ndcg: '0.54', lat: '50 ms', cost: '+$1,500/mo' },
      metricTones: { fail: 'good', ndcg: 'good' },
      scene: {
        nodes: [user, bm25, dense, fuse, docs],
        links: [link('user', 'bm25'), link('user', 'dense'), link('bm25', 'fuse'), link('dense', 'fuse'), link('fuse', 'docs')],
        flows: [
          { path: ['user', 'bm25', 'fuse'], tone: 'request', label: 'top 100', duration: 2.2 },
          { path: ['user', 'dense', 'fuse'], tone: 'request', label: 'top 100', duration: 2.2 },
          { path: ['fuse', 'docs'], tone: 'response', label: 'top 50', duration: 1.4, delay: 2.3 },
        ],
        panel: {
          title: 'Checklist',
          icon: 'List',
          rows: [
            { text: 'Two lanes in parallel', value: '100 each', tone: 'good' },
            { text: 'Fuse by rank', value: 'RRF, k = 60', tone: 'good' },
            { text: 'One chunk id, same filters', value: 'both lanes', tone: 'good' },
            { text: 'Rerank the top 50', value: 'next stage', tone: 'muted' },
          ],
        },
        caption: 'Merge ranks, not scores',
      },
      quiz: {
        question: 'Which statement about hybrid search is correct?',
        options: [
          'Add the BM25 score and the cosine score, then sort',
          'Run BM25 and dense in parallel, then fuse their ranks, for example with RRF',
          'Use BM25 first, and only call the vector store if BM25 finds nothing',
          'Hybrid search makes a reranker unnecessary',
        ],
        answer: 1,
        explain: 'Scores live on different scales, so fuse ranks. Both lanes run in parallel, and a reranker still helps afterwards by ordering the shortlist more precisely.',
      },
    },
  ],
};
