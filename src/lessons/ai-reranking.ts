import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const user: SceneNode = { id: 'user', kind: 'client', at: at(-5.4, -1.8), label: 'user', sub: 'asks a question' };
const store: SceneNode = { id: 'store', kind: 'block', size: 0.8, at: at(-1.8, -1.8), label: 'vector search', sub: '80M chunks', icon: 'Database', tint: 'teal' };
const reranker: SceneNode = { id: 'reranker', kind: 'block', at: at(1.8, -1.8), label: 'reranker', sub: 'cross-encoder, GPU', icon: 'Scale', tint: 'amber' };
const llm: SceneNode = { id: 'llm', kind: 'block', size: 0.8, at: at(5.4, -1.8), label: 'LLM', sub: 'writes the answer', icon: 'Cpu', tint: 'violet' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, route: 'straight', ...extra });

export const aiReranking: Lesson = {
  id: 'ai-reranking',
  title: 'Reranking',
  tagline: 'Why a second, slower model re-reads the shortlist, how it scores, and what it costs to run.',
  minutes: 20,
  level: 'Intermediate',
  learn: [
    'Why first-stage retrieval buries right answers, and the retrieve wide, rerank narrow funnel',
    'Bi-encoders versus cross-encoders, and why a cross-encoder cannot scan the whole corpus',
    'Where the reranker sits after hybrid search, and the nDCG, latency and cost numbers',
    'Choosing how many candidates to rerank, the recall ceiling and the context limit',
    'Managed API versus a self-hosted model, score cutoffs, parent chunks and query decomposition',
    'Failing open when the reranker is down, other reranker types, evaluation and the cost roll-up',
  ],
  metrics: [
    { key: 'ndcg', label: 'nDCG@5', icon: 'Gauge' },
    { key: 'cands', label: 'Reranked', icon: 'Layers' },
    { key: 'latency', label: 'Retrieval time', icon: 'Timer' },
    { key: 'cost', label: 'Rerank cost', icon: 'Receipt' },
  ],
  steps: [
    {
      title: 'Wrong order',
      tag: 'problem',
      heading: 'The right chunk is found, then buried at rank 23',
      eli5: 'A **toy shop** helper fetches toys by their box labels. He brings the boxes that sound closest, but the toy the child really wants is in the middle of the pile, not on top.',
      body: [
        'A support bot searches **80 million** chunks with vector search. The page that answers "can I get a refund on an annual plan?" lands at rank **23**. The top 5 are about refunds, plans and invoices: close, but wrong.',
        'The LLM only sees the top 5, so it answers from the wrong pages. Retrieval found the right chunk and then buried it.',
      ],
      keyIdea: 'First-stage retrieval is good at finding candidates and mediocre at ordering them. The LLM only reads the top few.',
      metrics: { ndcg: '0.48', cands: 'none', latency: '30 ms', cost: '$0' },
      metricTones: { ndcg: 'bad' },
      scene: {
        nodes: [
          { ...user, chips: ['refund on annual plan?'] },
          { ...store, status: 'active', badge: 'right chunk at #23' },
          { ...llm, at: at(1.8, -1.8), status: 'dim', chips: [{ text: 'wrong answer', tone: 'bad' }] },
        ],
        links: [link('user', 'store'), link('store', 'llm', { label: 'top 5 only', labelTone: 'warn' })],
        flows: [
          { path: ['user', 'store'], tone: 'request', label: 'question', duration: 1.2 },
          { path: ['store', 'llm'], tone: 'data', label: '5 chunks', duration: 1.2, delay: 1.3 },
          { path: ['llm', 'user'], tone: 'error', label: 'wrong answer', duration: 1.6, delay: 2.7 },
        ],
        panel: {
          title: 'Ranking by vector similarity',
          icon: 'List',
          rows: [
            { text: '#1 Refund policy overview', value: '0.83', tone: 'warn' },
            { text: '#2 Annual plan pricing', value: '0.81', tone: 'warn' },
            { text: '#3 Invoice FAQ', value: '0.80', tone: 'warn' },
            { text: '#4, #5 ... #22', value: '0.79 to 0.74', tone: 'muted' },
            { text: '#23 Refunds on annual plans', value: '0.73', tone: 'good' },
          ],
          footer: { text: 'Only ranks 1 to 5 reach the LLM', tone: 'bad' },
        },
        caption: 'Close in meaning is not the same as the answer',
      },
    },
    {
      title: 'Two stages',
      tag: 'concept',
      heading: 'Retrieve wide, then rerank narrow',
      eli5: 'The helper still fetches 100 toys fast. Then the **shopkeeper** lets the child try each one and hands over the best 5. Fast first, careful second.',
      body: [
        'Search is split into two stages. Stage one is cheap and wide: pull the best **100** candidates out of 80 million. Stage two is slow and precise: a **reranker** re-scores only those 100 and keeps the top **5**.',
        'The LLM then reads 5 well-chosen chunks. Each stage does the job it is cheap enough to do.',
      ],
      keyIdea: 'Use a cheap model to cut 80 million down to 100, and an expensive model to order those 100.',
      metrics: { ndcg: '0.48', cands: '100', latency: '30 ms', cost: '-' },
      scene: {
        nodes: [{ ...store, status: 'active' }, { ...reranker, status: 'active' }, { ...llm, chips: ['5 chunks'] }],
        links: [link('store', 'reranker', { label: 'top 100' }), link('reranker', 'llm', { label: 'top 5' })],
        flows: [
          { path: ['store', 'reranker'], tone: 'data', label: '100 chunks', count: 3, duration: 1.4 },
          { path: ['reranker', 'llm'], tone: 'data', label: '5 chunks', duration: 1.2, delay: 1.6 },
        ],
        panel: {
          title: 'The funnel',
          icon: 'Layers',
          rows: [
            { text: 'Corpus', value: '80,000,000' },
            { text: 'Stage 1: cheap, wide', value: '100 kept' },
            { text: 'Stage 2: precise, narrow', value: '5 kept', tone: 'good' },
            { text: 'LLM prompt', value: '5 chunks' },
          ],
          footer: { text: 'Cheap first, careful second', tone: 'muted' },
        },
        caption: '80M to 100 to 5',
      },
    },
    {
      title: 'Bi-encoder',
      tag: 'concept',
      heading: 'Why stage one orders badly: it never sees the question and the chunk together',
      eli5: 'The helper wrote one short label on each toy box long ago, before any child showed up. When a child asks, he compares labels. He never looks at the toy and the question side by side.',
      body: [
        'An embedding model is a **bi-encoder**. It encodes each chunk once, at ingest, into one vector. At query time it encodes the question into another vector. The two never meet inside the model.',
        'The chunk had to be squeezed into one vector before anyone asked anything, so detail that matters for this question is already gone.',
      ],
      keyIdea: 'A bi-encoder compresses the chunk first and compares later. That makes it fast, and it caps its precision.',
      metrics: { ndcg: '0.48', cands: 'none', latency: '30 ms', cost: '-' },
      scene: {
        nodes: [
          { id: 'docs', kind: 'storage', at: at(-5.4, -1.8), label: 'chunks', sub: 'encoded at ingest' },
          { id: 'embedder', kind: 'block', size: 0.8, at: at(-1.8, -1.8), label: 'bi-encoder', sub: 'embedding model', icon: 'Binary', tint: 'blue' },
          { ...store, at: at(1.8, -1.8), chips: ['1 vector per chunk'] },
          { ...user, at: at(-1.8, 4.6), chips: ['refund on annual plan?'] },
        ],
        links: [link('docs', 'embedder'), link('embedder', 'store'), link('user', 'embedder')],
        flows: [
          { path: ['docs', 'embedder'], tone: 'data', label: 'one chunk', duration: 1.2 },
          { path: ['embedder', 'store'], tone: 'data', label: 'vector', duration: 1.2, delay: 1.3 },
          { path: ['user', 'embedder'], tone: 'request', label: 'question', duration: 1.2, delay: 2.8 },
        ],
        panel: {
          title: 'Two separate trips',
          icon: 'Binary',
          rows: [
            { text: 'Chunk encoded', value: 'alone, at ingest' },
            { text: 'Question encoded', value: 'alone, at query time' },
            { text: 'Compared by', value: 'cosine of two vectors' },
            { text: 'Question seen by chunk', value: 'never', tone: 'warn' },
          ],
          footer: { text: 'Fast, because the chunk side is precomputed', tone: 'muted' },
        },
        caption: 'Encode apart, compare afterwards',
      },
    },
    {
      title: 'Cross-encoder',
      tag: 'concept',
      heading: 'A cross-encoder reads the question and the chunk together',
      eli5: 'The **shopkeeper** does not read labels. She puts the toy in the child\'s hands and watches. She can see right away whether this toy does what the child asked for.',
      body: [
        'A **cross-encoder** takes the question and one chunk as a single input and runs one forward pass. Attention can link the exact words in the question to the exact phrase in the chunk. The output is one **relevance score**.',
        'That joint view is why a 100M-parameter cross-encoder routinely out-ranks a 7B embedding model at ordering results.',
      ],
      keyIdea: 'Joint reading gives sharper scores than comparing two separately made vectors.',
      metrics: { ndcg: '-', cands: '1 pair', latency: '-', cost: '-' },
      scene: {
        nodes: [
          { ...user, at: at(-5.4, -1.8), chips: ['refund on annual plan?'] },
          { id: 'docs', kind: 'storage', at: at(-2.2, 3.4), label: 'one chunk', sub: 'refund terms' },
          { ...reranker, at: at(0.4, -1.8), status: 'active' },
          { id: 'top', kind: 'block', size: 0.8, at: at(4, -1.8), label: 'score', sub: 'one number', icon: 'Gauge', tint: 'green', badge: '0.94' },
        ],
        links: [link('user', 'reranker'), link('docs', 'reranker'), link('reranker', 'top')],
        flows: [
          { path: ['user', 'reranker'], tone: 'request', label: 'question', duration: 1.3 },
          { path: ['docs', 'reranker'], tone: 'data', label: 'chunk', duration: 1.3 },
          { path: ['reranker', 'top'], tone: 'response', label: 'score 0.94', duration: 1.2, delay: 1.5 },
        ],
        panel: {
          title: 'One pair in, one score out',
          icon: 'Scale',
          code: 'input:  question + chunk together\nmodel:  one transformer pass\noutput: one relevance score\n\nquestion: refund on annual plan?\nchunk:    "Annual plans: refund within 30 days"\nscore:    0.94',
          footer: { text: 'Scores each pair on its own', tone: 'muted' },
        },
        caption: 'The model sees both texts at once',
      },
    },
    {
      title: 'Too slow',
      tag: 'tradeoff',
      heading: 'You cannot cross-encode the whole corpus',
      eli5: 'The shopkeeper can try 100 toys with a child in a few minutes. Trying all 80 million toys in the warehouse would take longer than anyone has.',
      body: [
        'A cross-encoder must run once **per chunk, per question**, because the score depends on both. There are no precomputed vectors to reuse. Rerank 100 chunks takes about 80 ms on a GPU, so roughly 0.8 ms a pair.',
        'Do that for 80 million chunks and one query needs around **64,000 seconds**, about 18 hours. So the cheap index stays in front.',
      ],
      keyIdea: 'Cross-encoder cost grows with the number of candidates. Keep that number small by filtering first.',
      metrics: { ndcg: '-', cands: '80M', latency: '~18 hours', cost: '-' },
      metricTones: { cands: 'bad', latency: 'bad' },
      scene: {
        nodes: [
          { ...user, chips: ['refund on annual plan?'] },
          { ...store, status: 'dim' },
          { ...reranker, status: 'hot', load: 100, badge: '80M pairs' },
        ],
        links: [link('user', 'store'), link('store', 'reranker', { label: 'every chunk', labelTone: 'warn' })],
        flows: [
          { path: ['user', 'store'], tone: 'request', label: 'question', duration: 1.2 },
          { path: ['store', 'reranker'], tone: 'error', label: '80M chunks', count: 5, duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Scoring everything',
          icon: 'Timer',
          rows: [
            { text: 'Chunks in the corpus', value: '80,000,000' },
            { text: 'Time per 100 pairs', value: '~80 ms' },
            { text: 'Time per pair', value: '~0.8 ms' },
            { text: 'All pairs, one query', value: '~64,000 s', tone: 'bad' },
          ],
          footer: { text: 'About 18 hours for one answer', tone: 'bad' },
        },
        caption: 'Joint scoring has no shortcut',
      },
    },
    {
      title: 'In the pipeline',
      tag: 'concept',
      heading: 'Where the reranker sits: after hybrid search, before the LLM',
      eli5: 'The helper uses two ways to find toys: by label words and by what the toy is for. He merges both piles into one of 100. The shopkeeper then sorts that pile for the clerk.',
      body: [
        'Stage one is **hybrid search**: BM25 and dense vectors run in parallel and merge with reciprocal rank fusion. It hands over about 100 ids.',
        'The reranker scores those 100 against the question, keeps 5, and the LLM prompt is built from them. Hybrid takes about 50 ms, the reranker adds about 80 ms.',
      ],
      keyIdea: 'The reranker is the last retrieval step: it takes hybrid search output and decides what the LLM reads.',
      metrics: { ndcg: '0.62', cands: '100', latency: '130 ms', cost: '-' },
      metricTones: { ndcg: 'good' },
      scene: {
        nodes: [
          { ...user, at: at(-5.4, -1.8), chips: ['refund on annual plan?'] },
          { ...store, label: 'hybrid search', sub: 'BM25 + dense + RRF', at: at(-1.8, -1.8) },
          { ...reranker, status: 'active', load: 55 },
          { ...llm, status: 'ok' },
        ],
        links: [link('user', 'store'), link('store', 'reranker', { label: 'top 100' }), link('reranker', 'llm', { label: 'top 5' })],
        flows: [
          { path: ['user', 'store'], tone: 'request', label: 'question', duration: 1 },
          { path: ['store', 'reranker'], tone: 'data', label: '100 ids', duration: 1.2, delay: 1.1 },
          { path: ['reranker', 'llm'], tone: 'data', label: '5 chunks', duration: 1.2, delay: 2.4 },
        ],
        panel: {
          title: 'Retrieval timeline',
          icon: 'Timer',
          rows: [
            { text: 'BM25 + dense + RRF', value: '~50 ms' },
            { text: 'Cross-encoder over 100', value: '+~80 ms', tone: 'warn' },
            { text: 'Prompt built from top 5', value: 'then LLM' },
          ],
          footer: { text: 'Retrieval total: ~130 ms', tone: 'muted' },
        },
        caption: 'Retrieve, rerank, generate',
      },
    },
    {
      title: 'Quality lift',
      tag: 'case',
      heading: 'What the reranker buys: nDCG@5 from 0.54 to 0.62',
      eli5: 'Without the shopkeeper, the child gets the right toy in the top 5 about half the time. With her, they get it more often, for a few extra minutes at the counter.',
      body: [
        '**nDCG@5** scores how high the right chunks sit in the top 5, from 0 to 1. On BEIR, dense search scores 0.48 and hybrid 0.54. Adding a reranker reaches **0.62** for about 80 ms more.',
        'The gap between 0.48 and 0.62 separates "interesting but unreliable" from "we can sell this".',
      ],
      keyIdea: 'Reranking is among the highest-return steps in a RAG pipeline, for a small and predictable latency cost.',
      metrics: { ndcg: '0.62', cands: '100', latency: '130 ms', cost: '~$2 / 1K q' },
      metricTones: { ndcg: 'good', latency: 'warn' },
      scene: {
        nodes: [{ ...store, label: 'hybrid search', sub: 'BM25 + dense + RRF' }, { ...reranker, status: 'ok' }, { ...llm, status: 'ok' }],
        links: [link('store', 'reranker', { label: 'top 100' }), link('reranker', 'llm', { label: 'top 5' })],
        flows: [
          { path: ['store', 'reranker'], tone: 'data', label: '100 chunks', count: 2, duration: 1.3 },
          { path: ['reranker', 'llm'], tone: 'response', label: 'right chunk first', duration: 1.3, delay: 1.5 },
        ],
        panel: {
          title: 'nDCG@5 on BEIR',
          icon: 'Table',
          rows: [
            { text: 'Dense only', value: '0.48 · 30 ms', tone: 'bad' },
            { text: 'Hybrid', value: '0.54 · 50 ms', tone: 'warn' },
            { text: 'Hybrid + rerank', value: '0.62 · 130 ms', tone: 'good' },
          ],
          footer: { text: '+0.08 for about 80 ms', tone: 'good' },
        },
        caption: 'A big quality jump for a small delay',
      },
      quiz: {
        question: 'Why can a small cross-encoder order results better than a much larger embedding model?',
        options: [
          'It stores more vectors per chunk',
          'It reads the question and the chunk together in one pass, so it can use their exact overlap',
          'It skips the first-stage index and scans the whole corpus',
          'It was trained on more languages',
        ],
        answer: 1,
        explain: 'An embedding model must squeeze each chunk into one vector before the question exists. A cross-encoder sees both texts at once, so it can attend to the phrase that matters. That is also why it is too slow to run on every chunk.',
      },
    },
    {
      title: 'How many',
      tag: 'concept',
      heading: 'Pick the candidate count: it sets a recall ceiling',
      eli5: 'If the helper brings only 5 toys, the toy the child wants may stay in the warehouse. The shopkeeper can only choose from what is on her counter.',
      body: [
        'The reranker only reorders what it is given. If the right chunk is not in the candidate list, no reranker can bring it back, so **first-stage recall at N** is the ceiling on quality.',
        'Larger N raises that ceiling and raises the cost of every query. Common choices sit between 50 and 200, with 100 as the default.',
      ],
      keyIdea: 'Reranking improves order, never recall. Make the first stage wide enough that the right chunk gets onto the shortlist.',
      metrics: { ndcg: '0.62', cands: '100', latency: '130 ms', cost: '~$2 / 1K q' },
      scene: {
        nodes: [{ ...store, label: 'hybrid search', sub: 'BM25 + dense + RRF', badge: 'N = 100' }, { ...reranker, status: 'active' }, { ...llm }],
        links: [link('store', 'reranker', { label: 'N candidates' }), link('reranker', 'llm', { label: 'top 5' })],
        flows: [
          { path: ['store', 'reranker'], tone: 'data', label: 'N chunks', count: 3, duration: 1.4 },
          { path: ['reranker', 'llm'], tone: 'data', label: '5 chunks', duration: 1.2, delay: 1.6 },
        ],
        panel: {
          title: 'Is the right chunk in the N?',
          icon: 'Layers',
          rows: [
            { text: 'Inside the candidates', value: 'reranker can lift it', tone: 'good' },
            { text: 'Outside the candidates', value: 'lost for good', tone: 'bad' },
            { text: 'Raise N', value: 'more recall, more cost', tone: 'warn' },
            { text: 'Lower N', value: 'faster, riskier', tone: 'warn' },
          ],
          footer: { text: 'Tune N against recall@N on your own data', tone: 'muted' },
        },
        caption: 'The shortlist is the limit',
      },
    },
    {
      title: 'Final top N',
      tag: 'concept',
      heading: 'Pick the final cut: usually 3 to 10 chunks',
      eli5: 'The shopkeeper has sorted 100 toys. The clerk only has a small tray, and a messy tray makes the clerk miss the best toy.',
      body: [
        'The final **top_n** is how many reranked chunks reach the LLM. Most systems use 3 to 10. Past that, each extra chunk adds little recall and costs prompt tokens on every query.',
        'More context also adds noise. Models tend to miss facts buried in the middle of a long prompt, so put the best chunks first and last. Tune top_n on your golden set, and try 5 first.',
        'Contextual retrieval, hybrid search and reranking together cut retrieval failures by up to 67%.',
      ],
      keyIdea: 'Give the LLM the fewest chunks that still hold the answer, best ones at the edges of the prompt.',
      metrics: { ndcg: '0.62', cands: '100 → 5', latency: '130 ms', cost: '~$2 / 1K q' },
      scene: {
        nodes: [{ ...reranker, status: 'active' }, { ...llm, chips: ['top_n = 5'] }],
        links: [link('reranker', 'llm', { label: 'top_n' })],
        flows: [{ path: ['reranker', 'llm'], tone: 'data', label: '5 chunks', count: 2, duration: 1.3 }],
        panel: {
          title: 'Choosing top_n',
          icon: 'Layers',
          rows: [
            { text: 'Too few (1 to 2)', value: 'may miss the answer', tone: 'warn' },
            { text: 'Sweet spot (3 to 10)', value: 'best value', tone: 'good' },
            { text: 'Too many', value: 'noise, cost, lost in the middle', tone: 'bad' },
          ],
          footer: { text: 'Best chunks first and last', tone: 'muted' },
        },
        caption: 'A small tray beats a full one',
      },
    },
    {
      title: 'Latency',
      tag: 'concept',
      heading: 'Rerank time grows with N and with chunk length',
      eli5: 'The shopkeeper plays with toys one after another. Twice as many toys means about twice the wait, and a toy with a long game takes longer than a small one.',
      body: [
        'The pairs are scored in one batched GPU pass, and time grows roughly in step with N and the tokens per chunk. At about 80 ms for 100 chunks, the figures below are straight-line estimates.',
        'The reranker call sits on the critical path, before the LLM can start. Every millisecond of it is felt by the user.',
      ],
      keyIdea: 'Budget N and chunk size together. The reranker is on the critical path of every request.',
      metrics: { ndcg: '0.62', cands: '100', latency: '130 ms', cost: '~$2 / 1K q' },
      metricTones: { latency: 'warn' },
      scene: {
        nodes: [{ ...store, label: 'hybrid search', sub: 'BM25 + dense + RRF' }, { ...reranker, status: 'hot', load: 70 }, { ...llm, chips: ['waits for 5 chunks'] }],
        links: [link('store', 'reranker'), link('reranker', 'llm')],
        flows: [
          { path: ['store', 'reranker'], tone: 'data', label: 'N chunks', duration: 1.2 },
          { path: ['reranker', 'llm'], tone: 'data', label: 'top 5', duration: 1.2, delay: 1.4 },
        ],
        panel: {
          title: 'Estimated rerank time',
          icon: 'Timer',
          rows: [
            { text: 'N = 20', value: '~16 ms', tone: 'good' },
            { text: 'N = 100', value: '~80 ms' },
            { text: 'N = 300', value: '~240 ms', tone: 'warn' },
          ],
          footer: { text: 'About 0.8 ms per 500-token pair on a GPU', tone: 'muted' },
        },
        caption: 'Linear in N, on the critical path',
      },
    },
    {
      title: 'Managed API',
      tag: 'concept',
      heading: 'Option one: call a hosted reranker',
      eli5: 'The shop can hire a travelling expert shopkeeper by the visit. She is already good, nothing to train, and she charges for every pile of toys she sorts.',
      body: [
        'A hosted rerank endpoint is the fastest way to start. You send the question and the candidate texts, and you get back indexes in relevance order. Cohere Rerank 3.5 is one example: multilingual, 4096-token context, about 80 ms for 100 documents.',
        'Pricing runs around **$2 per 1K queries**. No GPU to run, and you pay on every request.',
      ],
      keyIdea: 'A managed reranker is a single function call with no infrastructure, billed per query.',
      metrics: { ndcg: '0.62', cands: '100', latency: '130 ms', cost: '~$2 / 1K q' },
      scene: {
        nodes: [
          { ...store, label: 'hybrid search', sub: 'BM25 + dense + RRF' },
          { id: 'api', kind: 'block', at: at(1.8, -1.8), label: 'Rerank API', sub: 'managed, over HTTPS', icon: 'Globe', tint: 'gray', status: 'active', chips: ['rerank-v3.5'] },
          { ...llm },
        ],
        links: [link('store', 'api', { label: '100 texts' }), link('api', 'llm', { label: 'top 5' })],
        flows: [
          { path: ['store', 'api'], tone: 'request', label: 'query + 100 texts', duration: 1.4 },
          { path: ['api', 'llm'], tone: 'response', label: 'top 5 indexes', duration: 1.2, delay: 1.6 },
        ],
        panel: {
          title: 'Hosted reranker, as quoted',
          icon: 'Table',
          rows: [
            { text: 'Context per document', value: '4096 tokens' },
            { text: 'Speed', value: '~80 ms for 100' },
            { text: 'Price', value: '~$2 per 1K queries', tone: 'warn' },
          ],
          footer: { text: 'Check the current model id in the provider docs', tone: 'muted' },
        },
        caption: 'One call, billed per query',
      },
      code: {
        language: 'python',
        title: 'rerank() with a hosted API',
        source: `import cohere
co = cohere.Client()

def rerank(q, chunks, top_n=5):
    r = co.rerank(
        model="rerank-v3.5",
        query=q,
        documents=[c["text"] for c in chunks],
        top_n=top_n,
    )
    return [chunks[res.index] for res in r.results]`,
        highlight: [6, 7, 8, 9, 11],
      },
    },
    {
      title: 'Self-hosted',
      tag: 'concept',
      heading: 'Option two: run an open reranker on your own GPU',
      eli5: 'The shop can also train its own shopkeeper who lives in the store. It costs a salary even on quiet days, and she never leaves for another shop.',
      body: [
        'Open models such as **bge-reranker-v2-m3** are multilingual and strong. You load one with the `sentence-transformers` library and score pairs on a GPU you control.',
        'That is a GPU to run, scale and keep warm, in exchange for no per-query fee and no data leaving your network.',
      ],
      keyIdea: 'A self-hosted reranker trades an API bill for GPU operations. The interface is the same list of pairs in, scores out.',
      metrics: { ndcg: '0.62', cands: '100', latency: '~160 ms', cost: 'GPU time' },
      scene: {
        nodes: [
          { ...store, label: 'hybrid search', sub: 'BM25 + dense + RRF' },
          { ...reranker, sub: 'bge-reranker, 1 GPU', status: 'active', load: 62 },
          { ...llm },
        ],
        links: [link('store', 'reranker', { label: 'top 100' }), link('reranker', 'llm', { label: 'top 5' })],
        flows: [
          { path: ['store', 'reranker'], tone: 'data', label: '100 pairs', duration: 1.3 },
          { path: ['reranker', 'llm'], tone: 'data', label: 'top 5', duration: 1.2, delay: 1.5 },
        ],
        panel: {
          title: 'You operate',
          icon: 'Server',
          rows: [
            { text: 'Model weights', value: 'open license' },
            { text: 'GPU, warm pool, autoscaling', value: 'your job', tone: 'warn' },
            { text: 'Per-query fee', value: 'none', tone: 'good' },
            { text: 'Data leaves network', value: 'no', tone: 'good' },
          ],
        },
        caption: 'Same function, your hardware',
      },
      code: {
        language: 'python',
        title: 'rerank() with an open cross-encoder',
        source: `from sentence_transformers import CrossEncoder
ce = CrossEncoder("BAAI/bge-reranker-v2-m3")

def rerank(q, chunks, top_n=5):
    pairs = [(q, c["text"]) for c in chunks]
    scores = ce.predict(pairs)
    order = scores.argsort()[::-1][:top_n]
    return [chunks[i] for i in order]`,
        highlight: [5, 6, 7, 8],
      },
    },
    {
      title: 'Buy or host',
      tag: 'tradeoff',
      heading: 'Managed or self-hosted: the bill against the pager',
      eli5: 'The traveling shopkeeper is easy and pricey at 100,000 visits a day. A shopkeeper on the payroll costs less at that volume, but somebody must look after her.',
      body: [
        'At 100K queries a day (3M a month), a hosted reranker is about **$6,000 a month**. One L4 GPU running bge-reranker removes most of that bill, and adds about 30 ms.',
        'Start hosted to prove the value. Move to your own GPU when volume makes the bill worth an on-call rotation, and keep the other path as a fallback.',
      ],
      keyIdea: 'Hosted wins at low volume and for speed to launch. Self-hosting wins when query volume is high and steady.',
      metrics: { ndcg: '0.62', cands: '100', latency: '+30 ms self-host', cost: '$6,000 / mo' },
      metricTones: { cost: 'warn' },
      scene: {
        nodes: [
          { ...store, label: 'hybrid search', sub: 'BM25 + dense + RRF', at: at(-4.4, -1.8) },
          { id: 'api', kind: 'block', size: 0.8, at: at(-0.6, -4.2), label: 'Rerank API', sub: 'managed', icon: 'Globe', tint: 'gray', chips: ['$2 / 1K queries'] },
          { ...reranker, at: at(2.8, 1.2), sub: 'self-hosted, 1 GPU', load: 58, chips: ['+30 ms'] },
        ],
        links: [link('store', 'api'), link('store', 'reranker')],
        flows: [
          { path: ['store', 'api'], tone: 'request', label: 'per call', duration: 1.4 },
          { path: ['store', 'reranker'], tone: 'request', label: 'your GPU', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: '100K queries a day',
          icon: 'Receipt',
          rows: [
            { text: 'Queries per month', value: '3,000,000' },
            { text: 'Hosted API', value: '~$6,000 / mo', tone: 'warn' },
            { text: 'One L4 GPU, bge-reranker', value: 'about $500 / mo', tone: 'warn' },
            { text: 'Net saving', value: '~$5.5K / mo', tone: 'good' },
            { text: 'Added latency', value: '+~30 ms', tone: 'warn' },
          ],
          footer: { text: 'Figures are chapter estimates, before ops time', tone: 'muted' },
        },
        caption: 'Break-even depends on volume',
      },
    },
    {
      title: 'Context limit',
      tag: 'tradeoff',
      heading: 'Chunk to the reranker window, not the LLM window',
      eli5: 'The shopkeeper only has a small table. A toy box bigger than the table hangs over the edge, and she never sees the part that hangs off.',
      body: [
        'Cross-encoders have a short **context window**, usually 4096 to 8192 tokens for the question and chunk together. Text past that limit is cut off, so a long chunk loses its tail.',
        'The LLM may take 100K tokens or more, and that is irrelevant here. Size your chunks to what the reranker can read, or the answer sitting at the end of a chunk is never scored.',
      ],
      keyIdea: 'The smallest context window in the chain sets the chunk size. For a reranker that is often a few thousand tokens.',
      metrics: { ndcg: '0.62', cands: '100', latency: '130 ms', cost: '~$2 / 1K q' },
      scene: {
        nodes: [
          { id: 'docs', kind: 'storage', at: at(-4.4, -1.8), label: 'chunks', sub: '500 or 6000 tokens' },
          { ...reranker, at: at(0, -1.8), status: 'active', chips: [{ text: 'window 4096 tokens', tone: 'warn' }] },
          { ...llm, at: at(4.4, -1.8), sub: 'window much larger' },
        ],
        links: [link('docs', 'reranker'), link('reranker', 'llm')],
        flows: [
          { path: ['docs', 'reranker'], tone: 'data', label: 'long chunk', duration: 1.4 },
          { path: ['reranker', 'llm'], tone: 'data', label: 'scored head only', duration: 1.4, delay: 1.6 },
        ],
        panel: {
          title: 'What gets scored',
          icon: 'FileText',
          rows: [
            { text: '500-token chunk', value: 'fully read', tone: 'good' },
            { text: '3,000-token chunk', value: 'fully read', tone: 'good' },
            { text: '6,000-token chunk', value: 'tail cut off', tone: 'bad' },
            { text: 'The answer in that tail', value: 'never scored', tone: 'bad' },
          ],
          footer: { text: 'Check the limit of your chosen model', tone: 'muted' },
        },
        caption: 'The reranker reads only its window',
      },
    },
    {
      title: 'Score cutoff',
      tag: 'concept',
      heading: 'Scores let you drop weak chunks, or say "I do not know"',
      eli5: 'Vector search always hands over 5 toys, even when none fit. The shopkeeper gives each toy a mark out of 10 and puts back any toy that scored low.',
      body: [
        'Top-5 by vector similarity always returns 5 chunks, even when none are relevant, and the LLM answers from garbage. A reranker gives each chunk a **score**, so you can set a **cutoff** and drop what falls under it.',
        'Cohere returns 0 to 1 scores. For bge, apply a sigmoid (activation_fn=torch.nn.Sigmoid()) or tune the cutoff on raw scores.',
        'If nothing passes, return "I do not know". Scores from different models are not comparable, so tune the cutoff on your own golden set.',
      ],
      keyIdea: 'A rerank score is a relevance signal you can threshold. An empty result is a valid, honest answer.',
      metrics: { ndcg: '0.62', cands: '100', latency: '130 ms', cost: '~$2 / 1K q' },
      scene: {
        nodes: [
          { ...reranker, at: at(-3.6, -1.8), status: 'active' },
          { id: 'gate', kind: 'block', size: 0.8, at: at(0, -1.8), label: 'cutoff', sub: 'score above 0.30', icon: 'Shield', tint: 'teal' },
          { ...llm, at: at(3.6, -1.8), chips: ['2 chunks'] },
        ],
        links: [link('reranker', 'gate', { label: 'scored 100' }), link('gate', 'llm', { label: 'kept 2' })],
        flows: [
          { path: ['reranker', 'gate'], tone: 'data', label: 'scores', count: 3, duration: 1.3 },
          { path: ['gate', 'llm'], tone: 'data', label: '2 chunks', duration: 1.2, delay: 1.5 },
        ],
        panel: {
          title: 'Scores for one question',
          icon: 'Table',
          rows: [
            { text: 'Refunds on annual plans', value: '0.94', tone: 'good' },
            { text: 'Refund policy overview', value: '0.71', tone: 'good' },
            { text: 'Annual plan pricing', value: '0.18', tone: 'muted' },
            { text: 'Invoice FAQ', value: '0.06', tone: 'muted' },
          ],
          footer: { text: 'Illustrative scores, cutoff 0.30', tone: 'muted' },
        },
        caption: 'Keep what clears the bar',
      },
      quiz: {
        question: 'After reranking, the three best chunks score 0.12, 0.09 and 0.05, and your cutoff is 0.30. What should the system do?',
        options: [
          'Send the top 3 to the LLM anyway',
          'Raise N to 1000 and try again with the same model',
          'Return an honest "I do not know" or ask a follow-up, because nothing looks relevant',
          'Lower the cutoff to 0.05 so something passes',
        ],
        answer: 2,
        explain: 'Low scores across the whole shortlist mean the corpus probably does not hold the answer. Feeding weak chunks to the LLM invites a made-up reply. Saying so is the safer result.',
      },
    },
    {
      title: 'Parent chunks',
      tag: 'case',
      heading: 'Rerank small chunks, then hand the LLM their parents',
      eli5: 'The shopkeeper picks the best toy from small cards that each describe one part. The clerk then gets the full box those cards came from, so the whole story is there.',
      body: [
        'Small chunks match precisely and make sharper rerank scores. They read badly alone. **Parent-child chunking** keeps both: rerank the small children, then swap each winner for its larger parent section.',
        'Several winners may share one parent, so dedupe the parents before building the prompt.',
      ],
      keyIdea: 'Score on small units and show the LLM the bigger unit around each winner.',
      metrics: { ndcg: '0.62', cands: '100', latency: '~135 ms', cost: '~$2 / 1K q' },
      scene: {
        nodes: [
          { ...store, at: at(-5.4, -1.8), label: 'hybrid search', sub: 'child chunks' },
          { ...reranker, at: at(-1.8, -1.8), status: 'active' },
          { id: 'parents', kind: 'storage', at: at(1.8, -1.8), label: 'parent sections', sub: 'full context' },
          { ...llm, at: at(5.4, -1.8), chips: ['3 parents'] },
        ],
        links: [link('store', 'reranker', { label: '100 children' }), link('reranker', 'parents', { label: 'top 5 ids' }), link('parents', 'llm')],
        flows: [
          { path: ['store', 'reranker'], tone: 'data', label: 'children', duration: 1.1 },
          { path: ['reranker', 'parents'], tone: 'request', label: '5 child ids', duration: 1.1, delay: 1.2 },
          { path: ['parents', 'llm'], tone: 'data', label: 'parents', duration: 1.1, delay: 2.4 },
        ],
        panel: {
          title: 'Two sizes, two jobs',
          icon: 'Code',
          code: 'child_hits = rerank(q, hybrid_retrieve(q), top_n=top)\nparents = dedupe(fetch_parent(h) for h in child_hits)\nprompt = build_prompt(q, parents)',
          footer: { text: 'Rerank sees children, the LLM sees parents', tone: 'muted' },
        },
        caption: 'Score small, read large',
      },
    },
    {
      title: 'Sub-queries',
      tag: 'case',
      heading: 'Multi-part questions get a rerank each',
      eli5: 'A child asks for a toy car and a toy boat. The helper makes two trips, one per toy, and the shopkeeper picks the best for each trip before everything goes on the counter.',
      body: [
        'A question like "compare the annual and monthly refund rules" has two parts. **Query decomposition** has an LLM split it into sub-queries. Each runs its own hybrid search and its own rerank.',
        'The winners merge before the prompt. Each rerank scores against the narrow sub-query, not the muddled original. It costs time: nDCG@5 rises to 0.66 at about 400 ms.',
      ],
      keyIdea: 'Rerank against the question that retrieval actually ran. Decomposition buys quality with extra latency.',
      metrics: { ndcg: '0.66', cands: '2 x 50', latency: '400 ms', cost: '2 rerank calls' },
      metricTones: { ndcg: 'good', latency: 'warn' },
      scene: {
        nodes: [
          { id: 'planner', kind: 'block', size: 0.8, at: at(-5.4, -1.8), label: 'splitter', sub: 'LLM call', icon: 'Split', tint: 'violet', chips: ['2 sub-queries'] },
          { ...store, at: at(-1.8, -1.8), label: 'hybrid search', sub: 'top 50 each' },
          { ...reranker, at: at(1.8, -1.8), status: 'active', chips: ['top 5 each'] },
          { ...llm, at: at(5.4, -1.8), chips: ['up to 10 chunks'] },
        ],
        links: [link('planner', 'store'), link('store', 'reranker'), link('reranker', 'llm')],
        flows: [
          { path: ['planner', 'store'], tone: 'request', label: 'annual, monthly', count: 2, duration: 1.1 },
          { path: ['store', 'reranker'], tone: 'data', label: '2 x 50', duration: 1.1, delay: 1.2 },
          { path: ['reranker', 'llm'], tone: 'data', label: '2 x 5', duration: 1.1, delay: 2.4 },
        ],
        panel: {
          title: 'One loop per sub-query',
          icon: 'Code',
          code: 'for sq in sub_queries:\n    hits = hybrid_retrieve(sq, top=50)\n    all_chunks += rerank(sq, hits, top_n=5)',
          footer: { text: 'nDCG@5 0.66 at about 400 ms', tone: 'good' },
        },
        caption: 'Each sub-question is reranked on its own',
      },
    },
    {
      title: 'Fail open',
      tag: 'case',
      heading: 'When the reranker is down, serve the hybrid order',
      eli5: 'If the shopkeeper is sick, the shop does not close. The helper hands over his best 5 toys by label, and the children get a slightly worse pick than usual.',
      body: [
        'The reranker is a network call or a GPU pool, so it can time out or fail. **Fail open**: set a tight timeout, and on error skip reranking and send the top 5 of the hybrid order.',
        'Quality drops from 0.62 to about 0.54, but the product keeps answering. Keep a self-hosted model as a backup for a hosted API outage, and alert on the fallback rate.',
      ],
      keyIdea: 'Reranking raises quality and should never be a single point of failure. Degrade to the first-stage order.',
      metrics: { ndcg: '0.54', cands: '0', latency: '50 ms', cost: '$0' },
      metricTones: { ndcg: 'warn' },
      scene: {
        nodes: [
          { ...store, label: 'hybrid search', sub: 'BM25 + dense + RRF', status: 'active' },
          { ...reranker, status: 'down', badge: 'timeout' },
          { ...llm, chips: [{ text: 'top 5 by RRF', tone: 'warn' }] },
        ],
        links: [link('store', 'reranker', { style: 'dashed', label: 'times out', labelTone: 'bad' }), link('store', 'llm', { route: 'elbow', label: 'fallback', labelTone: 'warn' })],
        flows: [
          { path: ['store', 'reranker'], tone: 'error', label: '100 chunks', duration: 1.2 },
          { path: ['store', 'llm'], tone: 'data', label: 'RRF top 5', duration: 1.6, delay: 1.4 },
        ],
        panel: {
          title: 'Fallback path',
          icon: 'Shield',
          code: 'try:\n    top = rerank(q, hits, top_n=5)  # tight timeout\nexcept (Timeout, ApiError):\n    top = hits[:5]                   # RRF order\n    metrics.incr("rerank_fallback")',
          footer: { text: 'nDCG@5 falls to about 0.54', tone: 'warn' },
        },
        caption: 'Worse answers beat no answers',
      },
    },
    {
      title: 'Other models',
      tag: 'tradeoff',
      heading: 'Cross-encoders are the default, with two alternatives',
      eli5: 'The shop could ask a very clever grown-up to sort the whole pile at once, or use a quick checklist game. They work, but the shopkeeper who plays with each toy is the usual choice.',
      body: [
        'An **LLM as reranker** reads the whole candidate list and can follow instructions such as "prefer newer pages". It is the slowest and most expensive per query. **Late-interaction** models sit between: they keep per-token vectors and compare them.',
        'A cross-encoder is still the default. Try the others when its quality, price or control stops fitting.',
      ],
      keyIdea: 'The three options trade quality, cost and control. Start with a cross-encoder and let measurements justify a change.',
      metrics: { ndcg: '0.62', cands: '100', latency: '130 ms', cost: '~$2 / 1K q' },
      scene: {
        nodes: [
          { ...store, at: at(-5.4, -1.8), label: 'hybrid search', sub: 'top 100' },
          { ...reranker, at: at(-0.8, -4.2), label: 'cross-encoder', sub: 'default', status: 'ok' },
          { id: 'late', kind: 'block', size: 0.8, at: at(2.6, -0.2), label: 'late interaction', sub: 'per-token vectors', icon: 'Layers', tint: 'teal' },
          { id: 'llmrank', kind: 'block', size: 0.8, at: at(6, 3.8), label: 'LLM reranker', sub: 'reads the list', icon: 'Cpu', tint: 'violet' },
        ],
        links: [link('store', 'reranker'), link('store', 'late'), link('store', 'llmrank')],
        flows: [
          { path: ['store', 'reranker'], tone: 'data', label: 'pair scores', duration: 1.2 },
          { path: ['store', 'late'], tone: 'data', label: 'token match', duration: 1.2, delay: 1.3 },
          { path: ['store', 'llmrank'], tone: 'data', label: 'whole list', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'Three ways to rerank',
          icon: 'Table',
          rows: [
            { text: 'Cross-encoder', value: 'strong, cheap enough', tone: 'good' },
            { text: 'Late interaction', value: 'between the two' },
            { text: 'LLM reranker', value: 'flexible, slowest', tone: 'warn' },
          ],
          footer: { text: 'General guidance, measure on your data', tone: 'muted' },
        },
        caption: 'Same job, three price points',
      },
    },
    {
      title: 'Measure it',
      tag: 'concept',
      heading: 'Prove the reranker earns its slot with a golden set',
      eli5: 'The shop keeps a list of 200 real requests with the right toy written down. Each time the shopkeeper changes how she picks, they check how many of the 200 she gets right.',
      body: [
        'Build a **golden set** of 100 to 300 real questions, each with the chunks that answer it. Score every change against it: nDCG@5 with and without the reranker, and recall of the first stage at N.',
        'Add p95 latency and fallback rate. If a default model keeps missing your jargon, test fine-tuning it on your own question and chunk pairs.',
      ],
      keyIdea: 'Judge a reranker by nDCG and recall on your own questions, plus the latency it adds, not by leaderboard scores alone.',
      metrics: { ndcg: '0.62', cands: '100', latency: '130 ms', cost: '~$2 / 1K q' },
      scene: {
        nodes: [
          { id: 'golden', kind: 'storage', at: at(-4.4, -1.8), label: 'golden set', sub: '200 questions' },
          { ...reranker, at: at(0, -1.8), status: 'active' },
          { id: 'eval', kind: 'monitor', at: at(4.4, -1.8), label: 'eval report', sub: 'every change' },
        ],
        links: [link('golden', 'reranker'), link('reranker', 'eval')],
        flows: [
          { path: ['golden', 'reranker'], tone: 'request', label: 'questions', duration: 1.3 },
          { path: ['reranker', 'eval'], tone: 'data', label: 'ranked lists', duration: 1.3, delay: 1.5 },
        ],
        panel: {
          title: 'Eval report',
          icon: 'Gauge',
          rows: [
            { text: 'nDCG@5, hybrid only', value: '0.54', tone: 'warn' },
            { text: 'nDCG@5, with rerank', value: '0.62', tone: 'good' },
            { text: 'Recall@100, first stage', value: 'check first' },
            { text: 'Added p95 latency', value: '~80 ms' },
            { text: 'Fallback rate', value: 'alert if rising', tone: 'warn' },
          ],
        },
        caption: 'Same questions, every change',
      },
    },
    {
      title: 'Cost roll-up',
      tag: 'tradeoff',
      heading: 'Where reranking lands in the monthly bill',
      eli5: 'Hiring the shopkeeper is one of the shop\'s big costs each month. It pays for itself because the clerk then works from 5 good toys, not a messy pile.',
      body: [
        'For 10M documents and 100K queries a day, the chapter prices the stack at about **$26,300 a month**, roughly $0.009 a query. The hosted reranker is **$6,000**, the LLM is **$18,000**.',
        'Those two dominate. Self-hosting the reranker, routing easy questions to a smaller LLM and a semantic cache are the levers.',
      ],
      keyIdea: 'The reranker and the LLM drive the bill. A small, accurate prompt from reranking also keeps the LLM cost down.',
      metrics: { ndcg: '0.62', cands: '100', latency: '130 ms', cost: '$6,000 / mo' },
      metricTones: { cost: 'warn' },
      scene: {
        nodes: [{ ...store, label: 'hybrid search', sub: 'vector + ES' }, { ...reranker, chips: [{ text: '$6,000 / mo', tone: 'warn' }] }, { ...llm, chips: [{ text: '$18,000 / mo', tone: 'warn' }] }],
        links: [link('store', 'reranker'), link('reranker', 'llm')],
        flows: [
          { path: ['store', 'reranker'], tone: 'data', label: '100 chunks', duration: 1.2 },
          { path: ['reranker', 'llm'], tone: 'data', label: '5 chunks', duration: 1.2, delay: 1.4 },
        ],
        panel: {
          title: 'Monthly at 100K queries a day',
          icon: 'Receipt',
          rows: [
            { text: 'Vector DB (80M vectors)', value: '$560' },
            { text: 'Elasticsearch (hybrid)', value: '$1,500' },
            { text: 'Hosted reranker', value: '$6,000', tone: 'warn' },
            { text: 'LLM generation', value: '$18,000', tone: 'warn' },
            { text: 'Re-index delta', value: '$240' },
          ],
          footer: { text: 'Total about $26,300 a month, $0.009 a query', tone: 'muted' },
        },
        caption: 'Two lines make most of the bill',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Reranking in one page',
      eli5: 'A fast helper fetches 100 toys. A careful shopkeeper tries each one, marks them, and puts back the poor ones. The clerk answers using only the best few toys on the counter.',
      body: [
        'Retrieve wide with hybrid search, rerank narrow with a cross-encoder, and give the LLM the top 5. Quality rises from 0.54 to 0.62 nDCG@5 for about 80 ms. With contextual retrieval and hybrid search, failures drop by up to 67%.',
        'Size N and chunks to the reranker, use scores for a cutoff, fail open to the hybrid order, and measure on a golden set.',
      ],
      keyIdea: 'A reranker fixes the order of a good shortlist. It cannot fix a shortlist that missed the answer.',
      metrics: { ndcg: '0.62', cands: '100 → 5', latency: '130 ms', cost: '$6,000 / mo' },
      metricTones: { ndcg: 'good' },
      scene: {
        nodes: [
          { ...user, status: 'ok' },
          { ...store, label: 'hybrid search', sub: 'BM25 + dense + RRF', status: 'ok' },
          { ...reranker, status: 'ok', load: 55 },
          { ...llm, status: 'ok' },
        ],
        links: [link('user', 'store'), link('store', 'reranker', { label: 'top 100' }), link('reranker', 'llm', { label: 'top 5' })],
        flows: [
          { path: ['user', 'store'], tone: 'request', label: 'question', duration: 1 },
          { path: ['store', 'reranker'], tone: 'data', label: '100 chunks', duration: 1.1, delay: 1.1 },
          { path: ['reranker', 'llm'], tone: 'data', label: '5 chunks', duration: 1.1, delay: 2.3 },
        ],
        panel: {
          title: 'Checklist',
          icon: 'List',
          rows: [
            { text: 'Retrieve wide', value: 'N = 100', tone: 'good' },
            { text: 'Rerank narrow', value: 'top 5', tone: 'good' },
            { text: 'Chunk to the window', value: '4096 tokens' },
            { text: 'Score cutoff', value: 'or abstain' },
            { text: 'Fail open', value: 'hybrid order', tone: 'warn' },
          ],
        },
        caption: 'Wide net, sharp second look',
      },
      quiz: {
        question: 'The right chunk is not among the 100 hybrid candidates. Which change will help most?',
        options: [
          'Swap in a larger cross-encoder reranker',
          'Rerank the same 100 chunks twice',
          'Improve first-stage recall, for example a larger N, better chunking or hybrid search',
          'Lower the score cutoff',
        ],
        answer: 2,
        explain: 'A reranker only reorders the candidates it receives. If the answer never reaches the shortlist, no reranker can recover it, so the fix lives in the first stage.',
      },
    },
  ],
};
