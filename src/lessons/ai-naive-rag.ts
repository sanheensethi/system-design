import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const user: SceneNode = { id: 'user', kind: 'client', at: at(-4.2, -1.8), label: 'employee', sub: 'asks a question' };
const llm: SceneNode = { id: 'llm', kind: 'block', size: 0.85, at: at(4.2, 2.2), label: 'LLM', sub: 'generates the answer', icon: 'Cpu', tint: 'amber' };
const embedder: SceneNode = { id: 'embedder', kind: 'block', size: 0.8, at: at(0, -1.8), label: 'embedder', sub: 'text to vector', icon: 'Binary', tint: 'amber' };
const store: SceneNode = { id: 'store', kind: 'block', at: at(4.2, -1.8), label: 'vector store', sub: '80M chunks', icon: 'Database', tint: 'teal' };
const docs: SceneNode = { id: 'docs', kind: 'storage', at: at(-4.2, 2.2), label: 'documents', sub: '10M docs' };
const prompt: SceneNode = { id: 'prompt', kind: 'block', size: 0.8, at: at(0, 2.2), label: 'prompt', sub: 'question + chunks', icon: 'FileCode', tint: 'green' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

export const aiNaiveRag: Lesson = {
  id: 'ai-naive-rag',
  title: 'Naive RAG',
  tagline: 'The weekend version of retrieval-augmented generation: chunk, embed, search, stuff the prompt. What it costs and where it breaks.',
  minutes: 24,
  level: 'Intermediate',
  learn: [
    'Why a model needs a way to look things up: frozen training data, costly context, weak fact learning',
    'RAG versus fine-tuning versus a long context window',
    'The ingest path (load, chunk, embed, store) and the query path (embed, search, stuff, generate)',
    'Capacity and cost math for 10 million documents',
    'The five ways the naive version fails in production',
    'Grounding prompts, updates, re-embedding and the golden set that keeps you honest',
  ],
  metrics: [
    { key: 'corpus', label: 'Corpus', icon: 'FileText' },
    { key: 'chunks', label: 'Chunks', icon: 'Layers' },
    { key: 'cost', label: 'Cost per query', icon: 'Receipt' },
    { key: 'trust', label: 'Answer quality', icon: 'Gauge' },
  ],
  steps: [
    {
      title: 'Frozen model',
      tag: 'problem',
      heading: 'A smart model that has never read your documents',
      eli5: 'A student sits an exam on the **school rule book**, but nobody ever let them read it. They are clever, so they write a confident answer anyway.',
      body: [
        'A company wants an internal assistant over **10 million** documents: wikis, Jira tickets, Slack exports, PDFs. An employee asks, "How does our billing pipeline handle refunds in the EU?" and wants a correct, cited answer in under 3 seconds.',
        'The model never saw those documents. It answers fluently from general knowledge and gets the company-specific part wrong.',
      ],
      keyIdea: 'A language model only knows what was in its training data. Your private, recent documents were not in it.',
      metrics: { corpus: '10M docs', chunks: '-', cost: '-', trust: 'guessing' },
      metricTones: { trust: 'bad' },
      scene: {
        nodes: [
          { ...user, chips: ['refunds in the EU?'] },
          { ...llm, at: at(0, -1.8), status: 'active' },
          { ...docs, at: at(4.2, 2.2), status: 'dim', sub: 'never seen by the model' },
        ],
        links: [link('user', 'llm')],
        flows: [
          { path: ['user', 'llm'], tone: 'request', label: 'refunds in the EU?', duration: 1.4 },
          { path: ['llm', 'user'], tone: 'error', label: 'confident guess', duration: 1.4, delay: 1.6 },
        ],
        panel: {
          title: 'What the model knows',
          icon: 'Gauge',
          rows: [
            { text: 'Public web up to its cutoff', value: 'yes', tone: 'good' },
            { text: 'Your launch in January 2026', value: 'no', tone: 'bad' },
            { text: 'Your billing runbook', value: 'no', tone: 'bad' },
          ],
          footer: { text: 'Target: cited answer, under 3 s, under 2% hallucination', tone: 'muted' },
        },
        caption: 'Fluent answer, wrong facts',
      },
    },
    {
      title: 'Why RAG',
      tag: 'concept',
      heading: 'Three reasons the model cannot just carry the facts',
      eli5: 'Instead of making the student memorize the whole **rule book**, let them keep it open on the desk and flip to the right page when a question comes.',
      body: [
        '**Training data is frozen**: a model trained in 2025 cannot know about a 2026 launch. **Context costs money and attention**: 10 million documents in a prompt is costly per query, and facts buried mid-prompt get missed (lost in the middle).',
        '**Fine-tuning teaches style, not facts**: new facts learned this way are unreliable. RAG changes the question from what the model knows to what it can look up right now.',
      ],
      keyIdea: 'Retrieval-augmented generation fetches the relevant text at question time and hands it to the model. The index can change without retraining anything.',
      metrics: { corpus: '10M docs', chunks: '-', cost: '-', trust: '-' },
      scene: {
        nodes: [
          { ...user, chips: ['refunds in the EU?'] },
          { ...docs, at: at(0, 2.2), status: 'active', sub: '40B tokens' },
          { ...llm, at: at(4.2, -1.8), status: 'ok' },
        ],
        links: [link('user', 'llm'), link('docs', 'llm', { style: 'dashed', label: 'look up' })],
        flows: [
          { path: ['user', 'llm'], tone: 'request', label: 'question', duration: 1.4 },
          { path: ['docs', 'llm'], tone: 'data', label: 'relevant text', duration: 1.6, delay: 1.5 },
          { path: ['llm', 'user'], tone: 'response', label: 'answer', duration: 1.4, delay: 3.2 },
        ],
        panel: {
          title: 'Why not just load it all?',
          icon: 'Scale',
          rows: [
            { text: 'Frozen training data', value: 'stale facts', tone: 'bad' },
            { text: '40B tokens in every prompt', value: 'too big, too costly', tone: 'bad' },
            { text: 'Teach facts by fine-tuning', value: 'unreliable', tone: 'warn' },
            { text: 'Look up at question time', value: 'fresh, citable', tone: 'good' },
          ],
        },
        caption: 'Look it up instead of memorizing it',
      },
    },
    {
      title: 'RAG or not',
      tag: 'tradeoff',
      heading: 'RAG, fine-tuning and a long context window',
      eli5: 'There are three ways to help the student. Keep the **rule book** open (RAG), practice writing in the school style (fine-tuning), or carry one huge page to read once (long context).',
      body: [
        'Pick **RAG** when facts change and you need citations. Pick **fine-tuning** for tone, format or domain jargon. Pick **long context** for one-shot analysis of a single long document, such as one 200-page contract.',
        'Teams often combine them: RAG for facts, a small adapter for style. Most things people try to fine-tune in first need better retrieval instead.',
      ],
      keyIdea: 'Facts that change belong in an index you can update. Style belongs in the model. One-off reading belongs in the context window.',
      metrics: { corpus: '10M docs', chunks: '-', cost: '-', trust: '-' },
      scene: {
        nodes: [
          { id: 'rag', kind: 'block', at: at(-3.6, 0), label: 'RAG', sub: 'look it up', icon: 'Search', tint: 'green', status: 'ok' },
          { id: 'ft', kind: 'block', at: at(0, 0), label: 'fine-tune', sub: 'change behavior', icon: 'Zap', tint: 'violet' },
          { id: 'long', kind: 'block', at: at(3.6, 0), label: 'long context', sub: 'read it all', icon: 'FileText', tint: 'amber' },
        ],
        panel: {
          title: 'Which one wins',
          icon: 'Table',
          rows: [
            { text: 'Facts change daily', value: 'RAG', tone: 'good' },
            { text: 'Tone and format', value: 'fine-tune', tone: 'good' },
            { text: 'Citations and audit', value: 'RAG', tone: 'good' },
            { text: 'Per-query cost', value: 'long ctx is highest', tone: 'warn' },
            { text: 'Update speed', value: 'RAG: seconds', tone: 'good' },
          ],
          footer: { text: 'Fine-tuning cannot cite its source', tone: 'warn' },
        },
        caption: 'Three tools, three jobs',
      },
    },
    {
      title: 'Two paths',
      tag: 'concept',
      heading: 'One offline path builds the index, one online path uses it',
      eli5: 'Before the exam, a **helper** sorts the rule book into labeled index cards. During the exam, the helper grabs the right cards and puts them in front of the student.',
      body: [
        'Naive RAG has two pipelines. **Ingest** runs ahead of time: load documents, chunk them, embed each chunk, store the vectors. **Query** runs per question: embed the question, search the store, stuff the best chunks into a prompt, generate.',
        'The embedder appears on both paths. That detail comes back later.',
      ],
      keyIdea: 'Ingest is slow and runs once per document. Query is fast and runs once per question. Both rely on the same embedding model.',
      metrics: { corpus: '10M docs', chunks: '-', cost: '-', trust: '-' },
      scene: {
        nodes: [
          { ...docs, at: at(-4.2, -3.4) },
          { ...embedder, at: at(0, -3.2) },
          { ...store, at: at(4.2, -3.2) },
          { ...user, at: at(-3.4, 3.4) },
          { ...llm, at: at(4.2, 3.2), size: 0.75 },
        ],
        links: [link('docs', 'embedder'), link('embedder', 'store'), link('user', 'embedder', { style: 'dashed' }), link('store', 'llm', { style: 'dashed', label: 'chunks into prompt' }), link('llm', 'user', { style: 'dashed' })],
        flows: [
          { path: ['docs', 'embedder', 'store'], tone: 'data', label: 'ingest', duration: 2.2 },
          { path: ['user', 'embedder', 'store', 'llm', 'user'], tone: 'request', label: 'query: embed, search, stuff prompt, generate', duration: 3.4, delay: 2.3 },
        ],
        panel: {
          title: 'The two pipelines',
          icon: 'Workflow',
          rows: [
            { text: 'Ingest, offline', value: 'load, chunk, embed, store', tone: 'muted' },
            { text: 'Query, online', value: 'embed, search, stuff, generate', tone: 'muted' },
          ],
          footer: { text: 'The embedder is on both paths', tone: 'muted' },
        },
        caption: 'Build once, ask many times',
      },
    },
    {
      title: 'Load',
      tag: 'concept',
      heading: 'Load: turn every source into clean text',
      eli5: 'The rule book comes as notes, photos and scribbles. First a **loader** copies everything onto plain sheets of paper so it can be read the same way.',
      body: [
        'Documents arrive as wiki pages, ticket threads, Slack exports, PDFs and Google Docs. A **loader** per source extracts the text, keeps the title and link, and strips menus, footers and other boilerplate.',
        'Everything downstream sees plain text plus a source id. Garbage that gets through here is embedded and retrieved later like any other text.',
      ],
      keyIdea: 'Retrieval quality starts at loading. Whatever text you extract is all the index will ever know.',
      metrics: { corpus: '10M docs', chunks: '-', cost: '-', trust: '-' },
      scene: {
        nodes: [
          { ...docs, at: at(-4.2, 0), label: 'sources', sub: 'wiki, Jira, Slack...', chips: ['PDF', 'Slack export', 'Google Docs', 'Jira'] },
          { id: 'loader', kind: 'block', size: 0.85, at: at(0, 0), label: 'loader', sub: 'parse to text', icon: 'FileText', tint: 'blue', status: 'active' },
          { id: 'text', kind: 'storage', at: at(4.2, 0), label: 'clean text', sub: '40B tokens' },
        ],
        links: [link('docs', 'loader'), link('loader', 'text')],
        flows: [
          { path: ['docs', 'loader'], tone: 'data', label: 'raw files', duration: 1.4 },
          { path: ['loader', 'text'], tone: 'data', label: 'text + source id', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'What the loader does',
          icon: 'List',
          rows: [
            { text: 'PDF', value: 'extract text' },
            { text: 'Jira ticket', value: 'title + body' },
            { text: 'Slack export', value: 'thread per doc' },
            { text: 'Web page', value: 'drop nav, footer', tone: 'good' },
          ],
          footer: { text: '10M docs x 4K tokens = 40B tokens', tone: 'muted' },
        },
        caption: 'Many formats in, one text format out',
      },
    },
    {
      title: 'Chunk',
      tag: 'concept',
      heading: 'Chunk: cut each document into 500-token pieces',
      eli5: 'A whole rule book is too big to hand over. The **chunker** cuts it into small cards, each the same length, so the helper can pick just the right ones.',
      body: [
        'A 4,000-token document does not fit one embedding well, and a whole document is too coarse to retrieve. The **chunker** cuts text into fixed 500-token pieces.',
        'That is 8 chunks per document and **80 million** chunks for the corpus. Each chunk is the unit that gets embedded, searched and later shown to the model.',
      ],
      keyIdea: 'A chunk is the unit of retrieval. Naive chunking cuts by a fixed token count and ignores what the text says.',
      metrics: { corpus: '10M docs', chunks: '80M', cost: '-', trust: '-' },
      scene: {
        nodes: [
          { id: 'text', kind: 'storage', at: at(-4.2, 0), label: 'clean text', sub: '4K tokens per doc' },
          { id: 'chunker', kind: 'block', size: 0.85, at: at(0, 0), label: 'chunker', sub: '500 tokens each', icon: 'Split', tint: 'blue', status: 'active' },
          { id: 'chunks', kind: 'block', size: 0.85, at: at(4.2, 0), label: 'chunks', sub: '80M pieces', icon: 'Layers', tint: 'teal' },
        ],
        links: [link('text', 'chunker'), link('chunker', 'chunks')],
        flows: [
          { path: ['text', 'chunker'], tone: 'data', label: '4,000 tokens', duration: 1.4 },
          { path: ['chunker', 'chunks'], tone: 'data', label: '8 x 500', count: 3, duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Chunk math',
          icon: 'Table',
          rows: [
            { text: 'Tokens per document', value: '4,000' },
            { text: 'Chunk size', value: '500' },
            { text: 'Chunks per document', value: '8' },
            { text: 'Corpus: 40B / 500', value: '80M chunks', tone: 'good' },
          ],
        },
        caption: 'Same size, every time',
      },
      code: {
        language: 'python',
        title: 'Fixed-size chunking',
        source: `import tiktoken  # pip install tiktoken
enc = tiktoken.get_encoding("cl100k_base")

def chunk_fixed(text, size=500):
    toks = enc.encode(text)
    return [
        enc.decode(toks[i:i + size])
        for i in range(0, len(toks), size)
    ]`,
        highlight: [6, 7, 8, 9],
      },
    },
    {
      title: 'Embed',
      tag: 'concept',
      heading: 'Embed: turn every chunk into a vector',
      eli5: 'The **embedder** gives each card a spot on a big map of topics. Cards about the same thing land close together, even if they use different words.',
      body: [
        'An **embedding model** maps text to a list of floats. With `text-embedding-3-small` that is 1536 numbers per chunk. Chunks with similar meaning end up near each other.',
        'The model runs once per chunk. 40B tokens at $0.02 per million costs about **$800**, a one-time bill for the first full index.',
      ],
      keyIdea: 'Embedding makes meaning searchable by distance. It is paid once per chunk at ingest and again for every query.',
      metrics: { corpus: '10M docs', chunks: '80M', cost: '$800 one-time', trust: '-' },
      scene: {
        nodes: [
          { id: 'chunks', kind: 'block', size: 0.85, at: at(-4.2, 0), label: 'chunks', sub: '80M pieces', icon: 'Layers', tint: 'teal' },
          { ...embedder, at: at(0, 0), size: 0.85, status: 'hot', load: 78, chips: ['text-embedding-3-small'] },
          { ...store, at: at(4.2, 0) },
        ],
        links: [link('chunks', 'embedder'), link('embedder', 'store', { label: '1536 floats', labelTone: 'default' })],
        flows: [
          { path: ['chunks', 'embedder'], tone: 'data', label: '500 tokens', duration: 1.4 },
          { path: ['embedder', 'store'], tone: 'data', label: '[0.01, -0.04, ...]', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Ingest embedding bill',
          icon: 'Receipt',
          rows: [
            { text: 'Tokens to embed', value: '40B' },
            { text: 'Price per 1M tokens', value: '$0.02' },
            { text: 'Total, one time', value: '$800', tone: 'good' },
            { text: 'Vector size', value: '1536 floats' },
          ],
        },
        caption: 'One vector per chunk',
      },
      code: {
        language: 'python',
        title: 'Ingest one document',
        source: `from openai import OpenAI
from pinecone import Pinecone

openai = OpenAI()
index = Pinecone().Index("kb-v1")

def embed(text):
    return openai.embeddings.create(
        model="text-embedding-3-small", input=text
    ).data[0].embedding

def ingest(doc_id, text):
    for i, chunk in enumerate(chunk_fixed(text)):
        index.upsert([
            (f"{doc_id}:{i}", embed(chunk), {"text": chunk})
        ])`,
        highlight: [7, 8, 9, 13, 14, 15],
      },
    },
    {
      title: 'Store',
      tag: 'concept',
      heading: 'Store: one row per chunk, held in a vector database',
      eli5: 'The index cards go into a **card drawer** that can find the cards nearest to a given spot on the map, fast. Each card has its text written on the back.',
      body: [
        'Each row has an id like `doc:3`, the vector, and metadata. In naive RAG the metadata is only the chunk text, so the answer can be read straight from the hit.',
        'The memory math: 80M vectors x 1536 dimensions x 4 bytes is about **492 GB**. That is why people use a managed vector store, and why the next lesson on ANN indexes exists.',
      ],
      keyIdea: 'The store holds vector plus text per chunk, and it is big. Storage and search at 80M vectors is real infrastructure.',
      metrics: { corpus: '10M docs', chunks: '80M', cost: '$800 one-time', trust: '-' },
      scene: {
        nodes: [
          { ...embedder, at: at(-4.2, 0), size: 0.8 },
          { ...store, at: at(0, 0), status: 'active', chips: ['kb-v1', 'upsert(id, vec, text)'] },
          { id: 'disk', kind: 'storage', at: at(4.2, 0), label: 'index size', sub: '492 GB', status: 'hot' },
        ],
        links: [link('embedder', 'store'), link('store', 'disk', { style: 'faint' })],
        flows: [{ path: ['embedder', 'store'], tone: 'data', label: 'upsert', duration: 1.4 }],
        panel: {
          title: 'Memory for 80M vectors',
          icon: 'HardDrive',
          rows: [
            { text: 'Vectors', value: '80M' },
            { text: 'Floats per vector', value: '1536' },
            { text: 'Bytes per float', value: '4' },
            { text: '80M x 1536 x 4', value: '~492 GB', tone: 'warn' },
          ],
          footer: { text: 'Vectors only, before text and overhead', tone: 'muted' },
        },
        caption: 'Vector and text, per chunk',
      },
      quiz: {
        question: 'How much memory do 80 million 1536-dimension float32 vectors need, before overhead?',
        options: ['About 5 GB', 'About 49 GB', 'About 492 GB', 'About 5 TB'],
        answer: 2,
        explain: '80,000,000 x 1536 x 4 bytes is about 491.5 GB. The text and metadata come on top, so the vector store is a serious system, not a library you load in a script.',
      },
    },
    {
      title: 'Embed query',
      tag: 'concept',
      heading: 'The question gets embedded with the same model',
      eli5: 'When a student asks a question, the helper first finds that question\'s spot on the same topic map. A different map would point to the wrong shelf.',
      body: [
        'At query time the question is turned into a vector with the **same** embedding model used at ingest. Vectors from different models live in different spaces and cannot be compared.',
        'This is one small API call. A 10-token question at $0.02 per million tokens costs under $0.000001.',
      ],
      keyIdea: 'Query and chunks must be embedded by the same model, or distances mean nothing.',
      metrics: { corpus: '10M docs', chunks: '80M', cost: '<$0.000001 embed', trust: '-' },
      scene: {
        nodes: [
          { ...user, at: at(-4.2, 0), chips: ['refunds in the EU?'] },
          { ...embedder, at: at(0, 0), size: 0.85, status: 'active', load: 12, chips: ['text-embedding-3-small'] },
          { ...store, at: at(4.2, 0) },
        ],
        links: [link('user', 'embedder'), link('embedder', 'store')],
        flows: [
          { path: ['user', 'embedder'], tone: 'request', label: 'question', duration: 1.4 },
          { path: ['embedder', 'store'], tone: 'data', label: 'query vector', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Which model embedded what',
          icon: 'Binary',
          rows: [
            { text: 'Chunks at ingest', value: 'embedding-3-small' },
            { text: 'Query, same model', value: 'embedding-3-small', tone: 'good' },
            { text: 'Query, other model', value: 'meaningless scores', tone: 'bad' },
          ],
        },
        caption: 'Same map for question and chunks',
      },
    },
    {
      title: 'Top-k search',
      tag: 'concept',
      heading: 'Search: take the 5 nearest chunks',
      eli5: 'The helper puts a finger on the question\'s spot on the map and pulls out the **five closest cards**, whatever they say.',
      body: [
        'The store compares the query vector to the stored vectors with **cosine similarity** and returns the `top_k=5` closest chunks, each with its text.',
        'Notice the rule: it returns 5 no matter what. A high score means close in meaning, which is not the same as containing the answer.',
      ],
      keyIdea: 'Top-k search always returns k results ordered by similarity. It never says that nothing matches.',
      metrics: { corpus: '10M docs', chunks: '80M', cost: '$0.0004 search', trust: '-' },
      scene: {
        nodes: [
          { ...embedder, at: at(-4.2, 0), size: 0.8 },
          { ...store, at: at(0, 0), status: 'active', chips: ['top_k = 5'] },
          { id: 'hits', kind: 'block', size: 0.85, at: at(4.2, 0), label: 'top 5', sub: 'chunks + text', icon: 'List', tint: 'green' },
        ],
        links: [link('embedder', 'store'), link('store', 'hits')],
        flows: [
          { path: ['embedder', 'store'], tone: 'data', label: 'query vector', duration: 1.4 },
          { path: ['store', 'hits'], tone: 'response', label: '5 chunks', count: 3, duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Nearest chunks (cosine)',
          icon: 'Table',
          rows: [
            { text: 'billing-runbook:12', value: '0.82', tone: 'good' },
            { text: 'eu-refund-policy:3', value: '0.79', tone: 'good' },
            { text: 'refund-faq:7', value: '0.74' },
            { text: 'billing-arch:21', value: '0.71' },
            { text: 'eu-vat-notes:9', value: '0.70' },
          ],
          footer: { text: 'Scores are illustrative', tone: 'muted' },
        },
        caption: 'Closest in meaning, in order',
      },
    },
    {
      title: 'Stuff prompt',
      tag: 'concept',
      heading: 'Stuff: paste the chunks into the prompt',
      eli5: 'The helper tapes the five cards to the exam sheet, right above the question, and hands it to the student.',
      body: [
        'The retrieved chunk texts are joined and placed in the prompt ahead of the question. That is the whole trick: the model is just reading extra text that happens to be relevant.',
        'Five 500-token chunks plus the question is about 2,600 input tokens per query, and that is what you pay the LLM for.',
      ],
      keyIdea: 'RAG changes the input, not the model. Retrieved text goes into the prompt as plain context.',
      metrics: { corpus: '10M docs', chunks: '80M', cost: '2.6K tokens in', trust: '-' },
      scene: {
        nodes: [
          { id: 'hits', kind: 'block', size: 0.85, at: at(-4.2, 0), label: 'top 5', sub: 'chunks + text', icon: 'List', tint: 'green' },
          { ...prompt, at: at(0, 0), size: 0.85, status: 'active', chips: ['~2,600 tokens'] },
          { ...llm, at: at(4.2, 0), size: 0.8 },
        ],
        links: [link('hits', 'prompt'), link('prompt', 'llm')],
        flows: [
          { path: ['hits', 'prompt'], tone: 'data', label: '5 x 500 tokens', duration: 1.4 },
          { path: ['prompt', 'llm'], tone: 'request', label: 'full prompt', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'The prompt template',
          icon: 'FileCode',
          code: 'Context:\n{chunk 1}\n\n{chunk 2} ... {chunk 5}\n\nQuestion: {q}\nAnswer:',
          footer: { text: 'Plain text, no special API', tone: 'muted' },
        },
        caption: 'Retrieved text becomes prompt text',
      },
      code: {
        language: 'python',
        title: 'The whole query path',
        source: `# uses openai, index and embed() from the Embed step
def answer(q):
    qemb = embed(q)
    hits = index.query(vector=qemb, top_k=5,
                       include_metadata=True)
    ctx = "\\n\\n".join(h["metadata"]["text"]
                       for h in hits["matches"])
    prompt = f"Context:\\n{ctx}\\n\\nQuestion: {q}\\nAnswer:"
    return openai.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
    ).choices[0].message.content`,
        highlight: [4, 5, 7, 9],
      },
    },
    {
      title: 'Generate',
      tag: 'concept',
      heading: 'Generate: the model answers from what it was handed',
      eli5: 'The student reads the cards on the exam sheet and writes the answer in their own words.',
      body: [
        'The LLM reads about 2,600 input tokens and writes a few hundred tokens of answer. The answer is only as good as the five chunks. If the right chunk is in the prompt, it usually works well.',
        'Generation is the slow, GPU-bound stage. It dominates the 3-second latency budget. The naive prompt has no source numbers, so the answer carries no citations yet. The Grounding step adds them.',
      ],
      keyIdea: 'The LLM is the last and slowest stage, and it can only use the chunks it was given.',
      metrics: { corpus: '10M docs', chunks: '80M', cost: '$0.0006 LLM', trust: 'good when chunks are good' },
      metricTones: { trust: 'good' },
      scene: {
        nodes: [
          { ...prompt, at: at(-4.2, 0), size: 0.85 },
          { ...llm, at: at(0, 0), size: 0.9, status: 'active', load: 82, chips: ['gpt-4o-mini'] },
          { ...user, at: at(4.2, 0), chips: [{ text: 'answer, no citation', tone: 'warn' }] },
        ],
        links: [link('prompt', 'llm'), link('llm', 'user')],
        flows: [
          { path: ['prompt', 'llm'], tone: 'request', label: '2.6K tokens', duration: 1.4 },
          { path: ['llm', 'user'], tone: 'response', label: 'answer', count: 3, duration: 1.8, delay: 1.5 },
        ],
        panel: {
          title: 'One generation call',
          icon: 'Timer',
          rows: [
            { text: 'Input tokens', value: '~2,600' },
            { text: 'Output tokens', value: '~400' },
            { text: 'Latency: embed query', value: '~100 ms' },
            { text: 'Latency: vector search', value: '~150 ms' },
            { text: 'Latency: generate', value: '~1.5 to 2.5 s', tone: 'warn' },
          ],
          footer: { text: 'Budget: under 3 s end to end', tone: 'muted' },
        },
        caption: 'Slowest step in the chain',
      },
    },
    {
      title: 'Per-query cost',
      tag: 'case',
      heading: 'What one question costs',
      eli5: 'Each exam question costs a little for the helper to look up and a little for the student to answer. The student costs more, but the lookup is not free.',
      body: [
        'Prices: embeddings $0.02 per 1M tokens, `gpt-4o-mini` $0.15 per 1M input and $0.60 per 1M output. A 10-token question embeds for under $0.000001. Search is about $0.0004. The LLM call is about **$0.0006**.',
        'A full query is roughly **$0.001**: search about 40%, generation about 60%. Each extra chunk raises the LLM share. At 100,000 questions a day that is about $100.',
      ],
      keyIdea: 'Search and generation both show up on the bill. Every extra chunk in the prompt adds to the generation share.',
      metrics: { corpus: '10M docs', chunks: '80M', cost: '$0.001', trust: '-' },
      metricTones: { cost: 'good' },
      scene: {
        nodes: [
          { ...embedder, at: at(-4.2, 0), size: 0.8, chips: [{ text: '<$0.000001', tone: 'good' }] },
          { ...store, at: at(0, 0), size: 0.9, chips: [{ text: '$0.0004', tone: 'warn' }] },
          { ...llm, at: at(4.2, 0), size: 0.9, status: 'hot', load: 85, chips: [{ text: '$0.0006', tone: 'warn' }] },
        ],
        links: [link('embedder', 'store'), link('store', 'llm')],
        flows: [{ path: ['embedder', 'store', 'llm'], tone: 'request', label: 'one query', duration: 2.6 }],
        panel: {
          title: 'Cost of one query',
          icon: 'Receipt',
          rows: [
            { text: 'Embed: 10 tok x $0.02/M', value: '<$0.000001' },
            { text: 'Vector search', value: '$0.0004', tone: 'warn' },
            { text: 'LLM in: 2,600 tok x $0.15/M', value: '$0.00039' },
            { text: 'LLM out: 400 tok x $0.60/M', value: '$0.00024' },
            { text: 'Total', value: '~$0.001', tone: 'good' },
          ],
          footer: { text: 'gpt-4o-mini prices, input and output per 1M', tone: 'muted' },
        },
        caption: 'Search and generation both count',
      },
    },
    {
      title: 'Cut mid-sentence',
      tag: 'case',
      heading: 'Break 1: fixed chunks cut through the answer',
      eli5: 'The chunker slices the rule book with scissors every ten lines, even through the middle of a sentence. The card with the answer ends mid-word.',
      body: [
        'A fixed 500-token cut ignores structure. It can split a sentence, a table row or a code block across two chunks, so neither chunk makes sense alone.',
        'The right text exists in the index, but the retrieved half is unreadable, and the other half may not be in the top 5.',
      ],
      keyIdea: 'Cutting by token count breaks meaning at the boundaries. The answer can be split across two chunks.',
      metrics: { corpus: '10M docs', chunks: '80M', cost: '$0.001', trust: 'broken chunks' },
      metricTones: { trust: 'warn' },
      scene: {
        nodes: [
          { id: 'chunker', kind: 'block', size: 0.85, at: at(-4.2, 0), label: 'chunker', sub: '500 tokens each', icon: 'Split', tint: 'blue', status: 'hot' },
          { id: 'c41', kind: 'block', size: 0.7, at: at(2.2, -3), label: 'chunk 41', sub: 'ends mid-rule', icon: 'FileText', tint: 'amber', chips: [{ text: '...unless the', tone: 'warn' }] },
          { id: 'c42', kind: 'block', size: 0.7, at: at(2.2, 3), label: 'chunk 42', sub: 'starts mid-rule', icon: 'FileText', tint: 'amber', chips: [{ text: 'customer paid by...', tone: 'warn' }] },
        ],
        links: [link('chunker', 'c41'), link('chunker', 'c42')],
        flows: [
          { path: ['chunker', 'c41'], tone: 'data', label: 'tokens 1-500', duration: 1.4 },
          { path: ['chunker', 'c42'], tone: 'data', label: 'tokens 501-1000', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'One rule, two chunks',
          icon: 'Code',
          code: 'chunk 41: ...EU refunds are issued\nwithin 14 days unless the\n\nchunk 42: customer paid by gift\ncard. In that case...',
          footer: { text: 'Neither half answers the question', tone: 'bad' },
        },
        caption: 'The rule is split in two',
      },
    },
    {
      title: 'Always 5',
      tag: 'case',
      heading: 'Break 2: top-5 returns five chunks even when none fit',
      eli5: 'A student asks about something the rule book never covers. The helper still hands over five cards, the closest ones, and the student answers from them anyway.',
      body: [
        'Ask "Does the EU policy cover crypto payments?" when no document says so. The store still returns 5 chunks, just with low scores like 0.41. Nothing in the pipeline checks the score.',
        'The LLM sees five confident-looking chunks and answers from them. This is the main source of hallucinated answers in naive RAG.',
      ],
      keyIdea: 'Top-k has no way to say nothing relevant was found, so the LLM gets garbage and writes a fluent answer from it.',
      metrics: { corpus: '10M docs', chunks: '80M', cost: '$0.001', trust: 'hallucinating' },
      metricTones: { trust: 'bad' },
      scene: {
        nodes: [
          { ...user, at: at(-4.2, -1.8), chips: ['crypto refunds?'] },
          { ...store, at: at(0, -1.8), size: 0.9, status: 'hot', chips: ['top_k = 5'] },
          { ...llm, at: at(4.2, 2.2), size: 0.85, status: 'hot', load: 80 },
        ],
        links: [link('user', 'store'), link('store', 'llm', { label: '5 weak matches', labelTone: 'warn' })],
        flows: [
          { path: ['user', 'store'], tone: 'request', label: 'question', duration: 1.4 },
          { path: ['store', 'llm'], tone: 'error', label: 'irrelevant chunks', duration: 1.4, delay: 1.5 },
          { path: ['llm', 'user'], tone: 'error', label: 'confident, wrong', duration: 2.2, delay: 3 },
        ],
        panel: {
          title: 'Scores when nothing fits',
          icon: 'Table',
          rows: [
            { text: 'card-refund-faq:2', value: '0.43', tone: 'warn' },
            { text: 'eu-vat-notes:9', value: '0.41', tone: 'warn' },
            { text: 'payments-glossary:1', value: '0.40', tone: 'warn' },
            { text: 'still returns 5', value: 'k is fixed', tone: 'bad' },
          ],
          footer: { text: 'Illustrative scores', tone: 'muted' },
        },
        caption: 'Five chunks, none of them the answer',
      },
      quiz: {
        question: 'A user asks something the corpus never covers. What does naive top-5 search do?',
        options: [
          'Returns an empty list',
          'Returns an error',
          'Returns 5 chunks with low scores and the LLM answers from them anyway',
          'Falls back to the model\'s own knowledge automatically',
        ],
        answer: 2,
        explain: 'Nearest-neighbor search always returns the k closest items. Without a score threshold or an instruction to abstain, the model writes a fluent answer from irrelevant text.',
      },
    },
    {
      title: 'No metadata',
      tag: 'case',
      heading: 'Break 3: no metadata, so no filter by date, source or permission',
      eli5: 'The card drawer holds every card with no labels. An old scribble from last year looks the same as the current rule, and a card from the principal\'s private file is in there too.',
      body: [
        'The store only has the vector and the text. It cannot filter by source, date, team or access group. An intern\'s 2019 draft ranks next to the official 2026 policy.',
        'Worse, restricted documents can come back for anyone. Permissions must be enforced at retrieval time, not hoped for in the prompt.',
      ],
      keyIdea: 'Without metadata you cannot filter by recency, source or access. Relevance by meaning alone is not enough.',
      metrics: { corpus: '10M docs', chunks: '80M', cost: '$0.001', trust: 'stale and leaky' },
      metricTones: { trust: 'bad' },
      scene: {
        nodes: [
          { ...user, at: at(-4.2, 0), chips: [{ text: 'intern, no HR access', tone: 'warn' }] },
          { ...store, at: at(0, 0), status: 'hot', chips: ['id, vector, text only'] },
          { ...llm, at: at(4.2, 0), size: 0.8 },
        ],
        links: [link('user', 'store'), link('store', 'llm')],
        flows: [
          { path: ['user', 'store'], tone: 'request', label: 'question', duration: 1.4 },
          { path: ['store', 'llm'], tone: 'error', label: 'stale + restricted', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'What came back',
          icon: 'Shield',
          rows: [
            { text: '2026 refund policy (official)', value: '0.81', tone: 'good' },
            { text: '2019 intern draft', value: '0.82', tone: 'warn' },
            { text: 'HR salary sheet (restricted)', value: '0.78', tone: 'bad' },
          ],
          footer: { text: 'Nothing here can filter them out', tone: 'bad' },
        },
        caption: 'Old and private chunks look the same',
      },
    },
    {
      title: 'Short vs long',
      tag: 'case',
      heading: 'Break 4: a short question versus a long chunk',
      eli5: 'The student asks a six-word question, but the cards hold long paragraphs. A big general card often looks closer to a short question than a small card with the exact answer.',
      body: [
        '"How do refunds work?" is 6 tokens. A chunk is 500. A dense embedding squeezes a whole chunk into one vector, and a broad overview chunk tends to sit closer to short questions than a narrow chunk with the specific fact.',
        'So generic chunks tend to win over specific ones. Later lessons add query rewriting and HyDE to narrow the gap.',
      ],
      keyIdea: 'Short queries and long chunks are different kinds of text. Plain cosine search tends to favor broad chunks over the precise one.',
      metrics: { corpus: '10M docs', chunks: '80M', cost: '$0.001', trust: 'vague answers' },
      metricTones: { trust: 'warn' },
      scene: {
        nodes: [
          { ...user, at: at(-4.2, 0), chips: ['How do refunds work?'] },
          { ...embedder, at: at(0, 0), size: 0.8, chips: ['6 tokens'] },
          { ...store, at: at(4.2, 0), status: 'active', chips: ['500-token chunks'] },
        ],
        links: [link('user', 'embedder'), link('embedder', 'store')],
        flows: [
          { path: ['user', 'embedder'], tone: 'request', label: '6 tokens', duration: 1.4 },
          { path: ['embedder', 'store'], tone: 'data', label: 'short vector', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Two candidate chunks',
          icon: 'Table',
          rows: [
            { text: 'Refunds overview (broad)', value: '0.78', tone: 'warn' },
            { text: 'EU refund deadline (the answer)', value: '0.71', tone: 'good' },
          ],
          footer: { text: 'Broad chunk can outrank the exact one', tone: 'warn' },
        },
        caption: 'The specific chunk loses the ranking',
      },
    },
    {
      title: 'Exact tokens',
      tag: 'case',
      heading: 'Break 5: error codes and product names get smoothed away',
      eli5: 'The student asks for the card about "E1042", a code on a warning label. The helper finds cards about warnings in general, because the map groups things by meaning, not by spelling.',
      body: [
        'Embeddings pull rare tokens toward their semantic neighborhood. A query for error code `E1042` finds chunks about errors, not the one that documents that code.',
        'Product names, SKUs, version numbers and people\'s names have the same problem. Keyword search is strong exactly where vectors are weak, which is the case for the hybrid search lesson.',
      ],
      keyIdea: 'Dense vectors capture meaning and blur exact strings. Identifiers need an exact-match method alongside them.',
      metrics: { corpus: '10M docs', chunks: '80M', cost: '$0.001', trust: 'misses exact terms' },
      metricTones: { trust: 'bad' },
      scene: {
        nodes: [
          { ...user, at: at(-4.2, 0), chips: ['what is E1042?'] },
          { ...embedder, at: at(0, 0), size: 0.8 },
          { ...store, at: at(4.2, 0), status: 'hot', chips: [{ text: 'E1042 chunk: rank 37', tone: 'bad' }] },
        ],
        links: [link('user', 'embedder'), link('embedder', 'store')],
        flows: [
          { path: ['user', 'embedder', 'store'], tone: 'request', label: 'E1042', duration: 2.4 },
          { path: ['store', 'user'], tone: 'error', label: 'generic error docs', duration: 2, delay: 2.6 },
        ],
        panel: {
          title: 'Top hits for "E1042"',
          icon: 'Bug',
          rows: [
            { text: 'Error handling overview', value: '0.77', tone: 'warn' },
            { text: 'Common billing errors', value: '0.75', tone: 'warn' },
            { text: 'E1042: refund failed (the one)', value: 'rank 37', tone: 'bad' },
          ],
          footer: { text: 'Illustrative scores and rank', tone: 'muted' },
        },
        caption: 'Exact codes get blurred',
      },
    },
    {
      title: 'Grounding',
      tag: 'concept',
      heading: 'Cheap fix: number the sources and tell the model to abstain',
      eli5: 'Tell the student: use only the cards on the sheet, write the card number after each fact, and say "I do not know" if the cards do not say.',
      body: [
        'A grounding prompt numbers each chunk and instructs the model to answer only from them, cite like `[3]`, and say it does not have enough information when the sources are silent.',
        'Citations let users verify. Abstention stops confident guesses. It does not fix bad retrieval, but it makes failures visible instead of silent.',
      ],
      keyIdea: 'Cite sources and allow "I don\'t know". Reward abstention on unanswerable questions more than fluent wrong answers.',
      metrics: { corpus: '10M docs', chunks: '80M', cost: '$0.001', trust: 'cited, can abstain' },
      metricTones: { trust: 'good' },
      scene: {
        nodes: [
          { ...prompt, at: at(-4.2, 0), size: 0.85, chips: ['[1] ... [5]'] },
          { ...llm, at: at(0, 0), size: 0.85, status: 'active', load: 78 },
          { ...user, at: at(4.2, 0), chips: [{ text: 'refund in 14 days [2]', tone: 'good' }] },
        ],
        links: [link('prompt', 'llm'), link('llm', 'user')],
        flows: [
          { path: ['prompt', 'llm'], tone: 'request', label: 'numbered sources', duration: 1.4 },
          { path: ['llm', 'user'], tone: 'response', label: 'answer + [2]', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'System prompt',
          icon: 'FileCode',
          code: 'Answer using ONLY the numbered\nsources. After every claim,\ncite like [3].\nIf the sources do not contain\nthe answer, say "I don\'t have\nenough information."',
          footer: { text: 'No prior knowledge allowed', tone: 'muted' },
        },
        caption: 'Say where it came from, or say nothing',
      },
      code: {
        language: 'python',
        title: 'Numbered sources',
        source: `SYS = """Answer using ONLY the numbered sources.
After every claim, cite like [3].
If the sources do not contain the answer,
say "I don't have enough information." """

def build_context(hits):
    return "\\n\\n".join(
        f"[{n}] {h['metadata']['text']}"
        for n, h in enumerate(hits, start=1)
    )`,
        highlight: [1, 2, 3, 4, 8],
      },
    },
    {
      title: 'Updates',
      tag: 'concept',
      heading: 'Keeping the index fresh when a document changes',
      eli5: 'When a page of the rule book is rewritten, the helper throws away that page\'s old cards and makes new ones. Pages that did not change are left alone.',
      body: [
        'When a document changes, delete every old chunk of that document, re-chunk, re-embed and upsert. Chunk ids are `doc_id:i`, so list ids by the `doc_id:` prefix and delete them all first. Serverless Pinecone cannot delete by metadata filter, and skipping the delete leaves orphan trailing chunks when a document shrinks. Skip unchanged documents by hash.',
        'A change feed from the source system drives an indexer worker. Without it the index slowly drifts away from the truth, and stale text produces confident stale answers.',
      ],
      keyIdea: 'An index is a copy. Delete and rebuild per document on change, and skip unchanged documents by hash.',
      metrics: { corpus: '10M docs', chunks: '80M', cost: '$40/mo re-index', trust: '-' },
      scene: {
        nodes: [
          { ...docs, at: at(-4.2, 0), chips: [{ text: 'refund policy edited', tone: 'warn' }] },
          { id: 'indexer', kind: 'block', size: 0.85, at: at(0, 0), label: 'indexer', sub: 'hash, then rebuild', icon: 'Workflow', tint: 'blue', status: 'active' },
          { ...store, at: at(4.2, 0), size: 0.9 },
        ],
        links: [link('docs', 'indexer', { label: 'change feed' }), link('indexer', 'store')],
        flows: [
          { path: ['docs', 'indexer'], tone: 'event', label: 'doc changed', duration: 1.4 },
          { path: ['indexer', 'store'], tone: 'data', label: 'delete + upsert', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Re-index loop',
          icon: 'Repeat',
          rows: [
            { text: 'Hash same as before', value: 'skip', tone: 'good' },
            { text: 'Hash changed', value: 'delete ids with prefix' },
            { text: 'Then', value: 'chunk, embed, upsert' },
            { text: '5% of 40B tokens = 2B at $0.02/M', value: '~$40/mo', tone: 'muted' },
          ],
        },
        caption: 'Only touch what changed',
      },
      code: {
        language: 'python',
        title: 'Re-index on change',
        source: `def reindex(doc):
    h = sha256(doc["text"].encode()).hexdigest()
    if h == last_hash(doc["id"]):
        return                      # unchanged
    for ids in index.list(prefix=doc["id"] + ":"):
        index.delete(ids=ids)       # no orphan chunks
    ingest(doc["id"], doc["text"])
    save_hash(doc["id"], h)`,
        highlight: [3, 4, 5, 6, 7],
      },
    },
    {
      title: 'Model swap',
      tag: 'tradeoff',
      heading: 'Changing the embedding model means re-embedding everything',
      eli5: 'If the helper switches to a new topic map, every old card has the wrong address on it. All the cards must be re-placed on the new map before anyone searches it.',
      body: [
        'Vectors from two models do not share a space, so you cannot change the embedder online. Build a **shadow index** with the new model, run both side by side, compare, then cut over.',
        'Re-embedding 40B tokens costs between $800 and $8,000 depending on the model. Tag every vector with its model version, and plan the change quarterly at most.',
      ],
      keyIdea: 'An embedding model change is a migration: a second index, a comparison period, then a cut over.',
      metrics: { corpus: '10M docs', chunks: '80M x 2 (temporary)', cost: '$800 to $8K once', trust: '-' },
      scene: {
        nodes: [
          { ...user, at: at(-4.2, -1.8) },
          { id: 'storeV1', kind: 'block', at: at(4.2, -3), label: 'kb-v1', sub: 'old embedder', icon: 'Database', tint: 'gray', status: 'dim' },
          { ...embedder, id: 'embedderV2', at: at(0, 3), label: 'embedder v2', size: 0.8, status: 'hot', load: 90 },
          { id: 'storeV2', kind: 'block', at: at(4.2, 3), label: 'kb-v2', sub: 'new embedder', icon: 'Database', tint: 'teal', status: 'active' },
        ],
        links: [link('user', 'storeV1', { label: 'live traffic' }), link('embedderV2', 'storeV2')],
        flows: [
          { path: ['user', 'storeV1'], tone: 'request', label: 'queries', duration: 1.6 },
          { path: ['embedderV2', 'storeV2'], tone: 'data', label: 're-embed all', count: 3, duration: 1.6, delay: 0.5 },
        ],
        panel: {
          title: 'Shadow index plan',
          icon: 'Layers',
          rows: [
            { text: 'Build kb-v2 beside kb-v1', value: 'week 1' },
            { text: 'A/B on real queries', value: 'week 2' },
            { text: 'Cut over, retire kb-v1', value: 'week 3', tone: 'good' },
          ],
          footer: { text: 'Tag each vector with its model version', tone: 'muted' },
        },
        caption: 'Two indexes, then one',
      },
    },
    {
      title: 'Measure it',
      tag: 'concept',
      heading: 'You cannot improve what you do not measure',
      eli5: 'Before changing how the helper works, write a practice test with known right answers and right cards. Then every change gets a score.',
      body: [
        'The most common failure of RAG projects is no eval set. Build a **golden set** of 100 to 300 real questions with a reference answer and the 1 to 3 chunks that must be retrieved. Hold out 20% and never tune on it.',
        'Track **context recall**, **context precision**, **faithfulness** and **answer relevance**. Fail a change that drops recall.',
      ],
      keyIdea: 'Retrieval and generation fail in different ways. Score them separately on a fixed golden set.',
      metrics: { corpus: '10M docs', chunks: '80M', cost: '$0.001', trust: 'measured' },
      metricTones: { trust: 'good' },
      scene: {
        nodes: [
          { id: 'golden', kind: 'block', size: 0.85, at: at(-4.2, 0), label: 'golden set', sub: '300 questions', icon: 'Table', tint: 'violet' },
          { id: 'pipeline', kind: 'block', size: 0.9, at: at(0, 0), label: 'RAG pipeline', sub: 'system under test', icon: 'Workflow', tint: 'teal', status: 'active' },
          { id: 'scores', kind: 'monitor', at: at(4.2, 0), label: 'scores', sub: 'recall, faithfulness' },
        ],
        links: [link('golden', 'pipeline'), link('pipeline', 'scores')],
        flows: [
          { path: ['golden', 'pipeline'], tone: 'request', label: 'question', duration: 1.4 },
          { path: ['pipeline', 'scores'], tone: 'response', label: 'answer + chunks', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'What to score',
          icon: 'Gauge',
          rows: [
            { text: 'Context recall', value: 'right chunks found?' },
            { text: 'Context precision', value: 'how much is useful?' },
            { text: 'Faithfulness', value: 'claims backed by chunks?' },
            { text: 'Answer relevance', value: 'does it answer?' },
          ],
          footer: { text: 'Gate changes in CI on recall and faithfulness', tone: 'good' },
        },
        caption: 'A test the changes must pass',
      },
    },
    {
      title: 'What comes next',
      tag: 'tradeoff',
      heading: 'Each break has a known fix, taught in the next lessons',
      eli5: 'The helper has five habits that cause trouble. Each one gets its own fix: smarter scissors, a score for the cards, a label on each card and a second way to search.',
      body: [
        'Better chunking and metadata address cut sentences and missing filters. Hybrid search adds keyword matching for exact tokens. A reranker re-scores the top 100 so the best 5 reach the model.',
        'None of that changes the shape of the pipeline you just built. It adds stages around it.',
      ],
      keyIdea: 'Naive RAG is the baseline. Each later technique targets one specific failure you can now name.',
      metrics: { corpus: '10M docs', chunks: '80M', cost: '$0.001', trust: 'baseline' },
      scene: {
        nodes: [
          { id: 'naive', kind: 'block', size: 0.85, at: at(-4.2, 0), label: 'naive RAG', sub: 'baseline', icon: 'Search', tint: 'gray' },
          { id: 'chunking', kind: 'block', size: 0.8, at: at(0, -2.4), label: 'chunking + metadata', sub: 'breaks 1 and 3', icon: 'Split', tint: 'blue' },
          { id: 'hybrid', kind: 'block', size: 0.8, at: at(0, 2.4), label: 'hybrid search', sub: 'breaks 4 and 5', icon: 'Network', tint: 'green' },
          { id: 'rerank', kind: 'block', size: 0.8, at: at(4.4, 0), label: 'reranking', sub: 'break 2', icon: 'Star', tint: 'violet' },
        ],
        links: [link('naive', 'chunking'), link('naive', 'hybrid'), link('chunking', 'rerank'), link('hybrid', 'rerank')],
        panel: {
          title: 'Break and fix',
          icon: 'List',
          rows: [
            { text: 'Cut mid-sentence', value: 'better chunking' },
            { text: 'Always 5 results', value: 'rerank, threshold' },
            { text: 'No metadata', value: 'filters, ACLs' },
            { text: 'Short vs long', value: 'query rewrite, HyDE' },
            { text: 'Exact tokens', value: 'hybrid search' },
          ],
        },
        caption: 'Stages added around the same pipeline',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Naive RAG in one picture',
      eli5: 'The helper sorts the **rule book** into cards, finds the five nearest cards for each question, tapes them to the exam sheet, and the student answers. Quick to set up, careless about which cards.',
      body: [
        'Ingest: load, chunk to 500 tokens, embed, store. 10M docs become 80M chunks and about 492 GB of vectors for $800 of embedding. Query: embed, top-5 search, stuff the prompt, generate, about $0.001 each.',
        'It breaks in five ways: cut text, always 5 results, no metadata, short query versus long chunk, and exact tokens. Cite, allow abstention, update by hash and measure on a golden set.',
      ],
      keyIdea: 'Naive RAG works for a weekend. Production means fixing the five breaks one at a time and measuring each fix.',
      metrics: { corpus: '10M docs', chunks: '80M', cost: '$0.001', trust: 'baseline' },
      scene: {
        nodes: [
          { ...user, at: at(-4.2, -1.8), chips: ['refunds in the EU?'] },
          { ...store, at: at(0, -2.6), status: 'ok', chips: ['top_k = 5'] },
          { ...prompt, at: at(0, 2.8), size: 0.8 },
          { ...llm, at: at(4.2, 2.2), size: 0.85, status: 'ok' },
        ],
        links: [link('user', 'store'), link('store', 'prompt'), link('prompt', 'llm')],
        flows: [
          { path: ['user', 'store'], tone: 'request', label: 'embed + search', duration: 1.4 },
          { path: ['store', 'prompt'], tone: 'data', label: '5 chunks', duration: 1.4, delay: 1.5 },
          { path: ['prompt', 'llm', 'user'], tone: 'response', label: 'answer', duration: 2.4, delay: 3 },
        ],
        panel: {
          title: 'Numbers to remember',
          icon: 'Table',
          rows: [
            { text: 'Chunks', value: '80M x 500 tokens' },
            { text: 'Vectors', value: '~492 GB' },
            { text: 'Embedding, once', value: '$800' },
            { text: 'Per query', value: '~$0.001', tone: 'good' },
          ],
        },
        caption: 'Chunk, embed, search, stuff, generate',
      },
      quiz: {
        question: 'Which change addresses a query for an exact error code that vector search keeps missing?',
        options: [
          'Raising top_k from 5 to 50 only',
          'Adding keyword (BM25) search next to the vectors',
          'Using a bigger LLM',
          'Making chunks 1,000 tokens long',
        ],
        answer: 1,
        explain: 'Dense vectors blur rare exact strings. Keyword search matches them directly, so combining the two (hybrid search) covers both meaning and exact terms.',
      },
    },
  ],
};
