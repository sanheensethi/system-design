import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const user: SceneNode = { id: 'user', kind: 'user', at: at(-5.4, 0), label: 'reader', sub: 'asks a question' };
const model: SceneNode = { id: 'model', kind: 'block', at: at(-1.8, 0), label: 'Embedding model', sub: 'text in, vector out', icon: 'Cpu', tint: 'amber', load: 55 };
const store: SceneNode = { id: 'store', kind: 'block', at: at(1.8, 0), label: 'Vector store', sub: 'one row per chunk', icon: 'Database', tint: 'violet' };
const docs: SceneNode = { id: 'docs', kind: 'storage', at: at(-5.4, 0), label: 'documents', sub: 'the library shelves' };
const results: SceneNode = { id: 'results', kind: 'block', at: at(5.4, 0), label: 'Top results', sub: 'best matches', icon: 'List', tint: 'green' };

export const aiEmbeddings: Lesson = {
  id: 'ai-embeddings',
  title: 'Embeddings and similarity',
  tagline: 'How text becomes a list of numbers, how two lists are compared, and what that costs in memory and money.',
  minutes: 15,
  level: 'Intermediate',
  learn: [
    'What an embedding is and why distance in vector space tracks meaning',
    'Dimensions, Matryoshka truncation and the memory bill for a corpus',
    'Cosine, dot product and Euclidean distance, and why normalizing makes them agree',
    'Choosing an embedding model, and why a reranker beats a fancier embedding',
    'Where embeddings show up: search, semantic caches, and why switching models is destructive',
  ],
  metrics: [
    { key: 'dims', label: 'Dimensions', icon: 'Layers' },
    { key: 'mem', label: 'Memory (1M chunks)', icon: 'HardDrive' },
    { key: 'score', label: 'Similarity', icon: 'Gauge' },
    { key: 'quality', label: 'Retrieval quality', icon: 'TrendingUp' },
  ],
  steps: [
    {
      title: 'Words miss',
      tag: 'problem',
      heading: 'Keyword search cannot tell that two sentences mean the same thing',
      eli5: 'A **library** where the only way to find a book is to match the exact words on its cover. Ask for "cat" and the book about a "feline" stays on the shelf.',
      body: [
        'A reader asks for `cat on a mat`. The library has a document that says `a feline rested upon a rug`. A keyword index shares no words with the query, so it returns nothing.',
        'People rephrase all the time: synonyms, typos, another language. Matching characters is the wrong tool. We need a way to compare **meaning**.',
      ],
      keyIdea: 'Search that matches spelling misses documents that mean the same thing. We need numbers that capture meaning.',
      metrics: { dims: '-', mem: '-', score: 'none', quality: 'misses rephrasings' },
      metricTones: { quality: 'bad' },
      scene: {
        nodes: [
          { ...user, chips: [{ text: 'cat on a mat', tone: 'default' }] },
          { id: 'kw', kind: 'block', at: at(-1.8, 0), label: 'Keyword index', sub: 'matches words', icon: 'Search', tint: 'gray' },
          { ...docs, at: at(1.8, 0), status: 'dim', badge: '0 results' },
        ],
        links: [link('user', 'kw'), link('kw', 'docs')],
        flows: [
          { path: ['user', 'kw', 'docs'], tone: 'request', label: 'cat on a mat', duration: 1.8 },
          { path: ['docs', 'kw', 'user'], tone: 'error', label: 'nothing found', duration: 1.8, delay: 1.9 },
        ],
        panel: {
          title: 'Query: cat on a mat',
          icon: 'Table',
          rows: [
            { text: 'the cat sat on the mat', value: 'match', tone: 'good' },
            { text: 'a feline rested upon a rug', value: 'no match', tone: 'bad' },
            { text: 'kitten napping on a carpet', value: 'no match', tone: 'bad' },
          ],
          footer: { text: 'Same meaning, no shared words', tone: 'bad' },
        },
        caption: 'Matching characters is not matching meaning',
      },
    },
    {
      title: 'A vector',
      tag: 'concept',
      heading: 'An embedding is a fixed-length list of numbers for a piece of text',
      eli5: 'The librarian reads a book and writes down its spot on a giant map of topics as a list of numbers. Every book gets a list of the same length, short or long.',
      body: [
        'An **embedding** is a vector of floating-point numbers that represents the meaning of a text. The **embedding model** reads the text and returns, for example, 1536 floats.',
        'The length is fixed by the model. A 3-word title and a 500-word paragraph both come back as 1536 numbers. That makes every text directly comparable to every other.',
      ],
      keyIdea: 'An embedding model turns any text into a vector of one fixed length. Same length means comparable.',
      metrics: { dims: '1536', mem: '-', score: '-', quality: '-' },
      scene: {
        nodes: [
          { id: 'text', kind: 'block', at: at(-5.4, 0), label: 'Text', sub: 'any length', icon: 'FileText', tint: 'blue' },
          { ...model, at: at(-1.8, 0), status: 'active' },
          { id: 'vec', kind: 'block', at: at(1.8, 0), label: 'Vector', sub: '1536 floats', icon: 'Binary', tint: 'violet', chips: ['[0.021, -0.143, ...]'] },
        ],
        links: [link('text', 'model'), link('model', 'vec')],
        flows: [
          { path: ['text', 'model'], tone: 'request', label: 'the cat sat on the mat', duration: 1.6 },
          { path: ['model', 'vec'], tone: 'data', label: '1536 floats', duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'Different input, same shape',
          icon: 'Binary',
          rows: [
            { text: 'cat', value: '1536 floats' },
            { text: 'the cat sat on the mat', value: '1536 floats' },
            { text: 'a 500-word paragraph', value: '1536 floats' },
          ],
          footer: { text: 'Fixed by the model, not the text', tone: 'muted' },
        },
        caption: 'Text in, fixed-length vector out',
      },
    },
    {
      title: 'Geometry',
      tag: 'concept',
      heading: 'Close vectors mean close meaning',
      eli5: 'On the librarian map, the cat book and the feline book are pinned right next to each other. The stock market book is pinned on the far side of the room.',
      body: [
        'Run `the cat sat on the mat` and `a feline rested on a rug` through the same model. The two vectors come out nearly the same. `stock market crashed today` lands far away.',
        'Distance in this space stands in for distance in meaning. Search becomes geometry: embed the query, then find the nearest vectors.',
      ],
      keyIdea: 'In embedding space, distance is semantic distance. Finding related text means finding nearby points.',
      metrics: { dims: '1536', mem: '-', score: '0.86 vs 0.07', quality: '-' },
      metricTones: { score: 'good' },
      scene: {
        nodes: [
          { id: 'cat', kind: 'block', size: 0.8, at: at(-3.6, -1.6), label: 'cat on mat', icon: 'FileText', tint: 'green' },
          { id: 'feline', kind: 'block', size: 0.8, at: at(-3.6, 3.2), label: 'feline on rug', icon: 'FileText', tint: 'green' },
          { id: 'stock', kind: 'block', size: 0.8, at: at(3.8, 0.8), label: 'stock crash', icon: 'FileText', tint: 'red' },
        ],
        links: [
          link('cat', 'feline', { label: 'close', labelTone: 'good', route: 'straight', arrow: 'both' }),
          link('cat', 'stock', { label: 'far', labelTone: 'warn', route: 'straight', arrow: 'both' }),
        ],
        panel: {
          title: 'Similarity to "cat on mat"',
          icon: 'Gauge',
          rows: [
            { text: 'a feline rested on a rug', value: '0.86', tone: 'good' },
            { text: 'stock market crashed today', value: '0.07', tone: 'bad' },
          ],
          footer: { text: 'Illustrative scores, 1.0 is identical', tone: 'muted' },
        },
        caption: 'Near in space means near in meaning',
      },
    },
    {
      title: 'Why it works',
      tag: 'concept',
      heading: 'Training pulls similar texts together and pushes others apart',
      eli5: 'The librarian practices by pinning books on the map. Each time two books are about the same thing, she moves them closer. Different things, she moves them apart. After millions of tries the map makes sense.',
      body: [
        'The method is **contrastive training**: the model sees positive pairs (texts that belong together) and negative pairs (texts that do not), and the loss rewards pulling positives close and pushing negatives apart. Meaning ends up as **directions** in the space.',
        'Older word-level embeddings (word2vec style) even showed odd arithmetic like `king - man + woman` near `queen`. That trick comes from those older models. Do not rely on it with modern text embedding models.',
      ],
      keyIdea: 'Embeddings work because training made distance track similarity. Directions in the space carry meaning.',
      metrics: { dims: '1536', mem: '-', score: '-', quality: '-' },
      scene: {
        nodes: [
          { id: 'similar', kind: 'block', size: 0.8, at: at(-4.4, -2.2), label: 'Similar pairs', icon: 'Copy', tint: 'green' },
          { id: 'unrelated', kind: 'block', size: 0.8, at: at(-4.4, 2.6), label: 'Unrelated pairs', icon: 'Split', tint: 'red' },
          { id: 'train', kind: 'block', at: at(0, 0), label: 'Training', sub: 'GPU run', icon: 'Cpu', tint: 'amber', load: 92, status: 'hot' },
          { id: 'space', kind: 'block', size: 0.9, at: at(4.4, 0), label: 'Vector space', icon: 'Boxes', tint: 'violet' },
        ],
        links: [link('similar', 'train'), link('unrelated', 'train'), link('train', 'space')],
        flows: [
          { path: ['similar', 'train'], tone: 'request', label: 'pull together', duration: 1.4 },
          { path: ['unrelated', 'train'], tone: 'error', label: 'push apart', duration: 1.4, delay: 0.5 },
          { path: ['train', 'space'], tone: 'data', label: 'learned map', duration: 1.4, delay: 1.9 },
        ],
        panel: {
          title: 'Contrastive training pairs',
          icon: 'Table',
          rows: [
            { text: 'Similar pair (positive)', value: 'loss pulls closer', tone: 'good' },
            { text: 'Unrelated pair (negative)', value: 'loss pushes apart', tone: 'bad' },
            { text: 'Word analogies (king - man + woman)', value: 'old word models only', tone: 'muted' },
          ],
          footer: { text: 'Do not rely on analogies with modern text models', tone: 'muted' },
        },
        caption: 'Contrast teaches the model what near means',
      },
    },
    {
      title: 'The pipeline',
      tag: 'concept',
      heading: 'One forward pass: tokens in, one vector out',
      eli5: 'The librarian first cuts the book into word-pieces, then reads them all in one go, then squeezes everything she read into a single coordinate on the map.',
      body: [
        'The text is split into **tokens** by the tokenizer (see the first lesson on tokens). The model reads all tokens in one forward pass on a GPU and produces a vector per token.',
        'A **pooling** step squeezes those into one vector for the whole text. The model has an input limit in tokens, so long documents must be split before embedding.',
      ],
      keyIdea: 'Embedding a text costs one GPU forward pass over its tokens, then pooling to one vector. Long text must be chunked.',
      metrics: { dims: '1536', mem: '-', score: '-', quality: '-' },
      scene: {
        nodes: [
          { id: 'text', kind: 'block', size: 0.8, at: at(-5.4, 0), label: 'Text', icon: 'FileText', tint: 'blue' },
          { id: 'tok', kind: 'block', size: 0.8, at: at(-1.8, 0), label: 'Tokenizer', icon: 'Hash', tint: 'teal' },
          { ...model, id: 'model', at: at(1.8, 0), label: 'Model', sub: 'GPU forward pass', load: 70 },
          { id: 'vec', kind: 'block', size: 0.8, at: at(5.4, 0), label: 'Vector', icon: 'Binary', tint: 'violet' },
        ],
        links: [link('text', 'tok'), link('tok', 'model'), link('model', 'vec')],
        flows: [
          { path: ['text', 'tok'], tone: 'request', label: 'the cat sat', duration: 1.2 },
          { path: ['tok', 'model'], tone: 'data', label: '3 tokens', duration: 1.2, delay: 1.3 },
          { path: ['model', 'vec'], tone: 'data', label: 'pool: 1 vector', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'Stages',
          icon: 'List',
          rows: [
            { text: 'Tokenize', value: 'text to ids' },
            { text: 'Forward pass', value: 'one vector per token', tone: 'warn' },
            { text: 'Pool', value: 'many vectors to one' },
            { text: 'Input limit, hosted models', value: 'about 8k tokens', tone: 'muted' },
            { text: 'Input limit, many open models', value: 'about 512 tokens', tone: 'muted' },
          ],
        },
        caption: 'The only GPU step is the forward pass',
      },
    },
    {
      title: 'Dimensions',
      tag: 'concept',
      heading: 'Each model picks its own vector length',
      eli5: 'Some librarians use a map with 3000 tiny details per book, others only 768. A bigger map tells similar books apart more finely, but the map takes more room on the shelf.',
      body: [
        '**Dimensions** are the number of floats per vector. More dimensions hold more nuance, and cost more storage and more arithmetic per comparison.',
        'Common sizes run from 768 to 4096. Vectors from different models are not interchangeable, even at the same length.',
      ],
      keyIdea: 'Dimension count is a model property. Higher means finer detail, bigger storage and slower comparisons.',
      metrics: { dims: '768 to 4096', mem: '-', score: '-', quality: '-' },
      scene: {
        nodes: [
          { ...model, at: at(-5.2, 0), sub: 'pick one', load: 50 },
          { id: 'v768', kind: 'block', size: 0.7, at: at(-0.6, -3.6), label: '768', sub: 'compact', icon: 'Binary', tint: 'teal' },
          { id: 'v1536', kind: 'block', size: 0.8, at: at(2.6, 0), label: '1536', sub: 'common default', icon: 'Binary', tint: 'blue' },
          { id: 'v3072', kind: 'block', size: 0.95, at: at(6, 3.6), label: '3072', sub: 'finest detail', icon: 'Binary', tint: 'violet' },
        ],
        links: [link('model', 'v768'), link('model', 'v1536'), link('model', 'v3072')],
        panel: {
          title: 'Dimensions by model family',
          icon: 'Table',
          rows: [
            { text: 'text-embedding-3-large', value: '3072' },
            { text: 'text-embedding-3-small', value: '1536' },
            { text: 'Cohere embed-v3', value: '1024' },
            { text: 'BGE-M3 (open)', value: '1024' },
            { text: 'Nomic embed v1.5 (open)', value: '768' },
            { text: 'E5-Mistral-7B (open)', value: '4096' },
          ],
        },
        caption: 'The model decides the length',
      },
    },
    {
      title: 'Cosine',
      tag: 'concept',
      heading: 'Cosine similarity compares the angle between two vectors',
      eli5: 'Two arrows drawn from the same spot. If they point the same way the books are alike, even when one arrow is longer. If they point opposite ways the books disagree.',
      body: [
        '**Cosine similarity** is `(a · b) / (|a| × |b|)`. It measures the angle and ignores length. The range is -1 to 1: 1 is the same direction, 0 is unrelated, -1 is opposite.',
        'It is the default for embedding search because the question is whether two texts mean similar things, not whether one means twice as much.',
      ],
      keyIdea: 'Cosine compares direction only, range -1 to 1. It is the default similarity for text embeddings.',
      metrics: { dims: '3 (toy)', mem: '-', score: '0.89', quality: '-' },
      scene: {
        nodes: [
          { id: 'a', kind: 'block', size: 0.8, at: at(-4.4, -2.2), label: 'a', sub: '[1, 2, 2]', icon: 'Binary', tint: 'blue' },
          { id: 'b', kind: 'block', size: 0.8, at: at(-4.4, 2.6), label: 'b', sub: '[2, 1, 2]', icon: 'Binary', tint: 'green' },
          { id: 'cos', kind: 'block', at: at(1, 0), label: 'Cosine', sub: 'angle only', icon: 'Gauge', tint: 'amber', badge: '0.89', chips: [{ text: '8 / (3 × 3)', tone: 'good' }] },
        ],
        links: [link('a', 'cos'), link('b', 'cos')],
        flows: [
          { path: ['a', 'cos'], tone: 'data', label: '[1, 2, 2]', duration: 1.3 },
          { path: ['b', 'cos'], tone: 'data', label: '[2, 1, 2]', duration: 1.3, delay: 0.4 },
        ],
        panel: {
          title: 'Worked example',
          icon: 'Code',
          code: 'a . b = 1*2 + 2*1 + 2*2 = 8\n|a| = sqrt(1+4+4) = 3\n|b| = sqrt(4+1+4) = 3\ncos = 8 / 9 = 0.89',
          footer: { text: 'Real vectors have 1536 terms, same formula', tone: 'muted' },
        },
        caption: 'Dot product divided by the two lengths',
      },
    },
    {
      title: 'Dot and L2',
      tag: 'concept',
      heading: 'Dot product and Euclidean distance care about length too',
      eli5: 'Cosine only checks which way the arrows point. Two other measuring tapes also look at how long the arrows are, so a longer arrow can score higher or sit farther away.',
      body: [
        '**Dot product** is the sum of `aᵢ × bᵢ`. It is cosine without the division, so it grows with vector length. It is cheaper because there are no square roots.',
        '**Euclidean (L2) distance** is the straight-line gap `|a - b|`. It suits vectors that encode positions, and models trained with an L2 objective.',
      ],
      keyIdea: 'Cosine ignores magnitude. Dot product and L2 do not, so they can disagree with cosine on the same pair.',
      metrics: { dims: '3 (toy)', mem: '-', score: 'cos 1.0, dot 18, L2 3', quality: '-' },
      scene: {
        nodes: [
          { id: 'a', kind: 'block', size: 0.8, at: at(-4.4, -2.2), label: 'a', sub: '[1, 2, 2]', icon: 'Binary', tint: 'blue' },
          { id: 'c', kind: 'block', size: 0.8, at: at(-4.4, 2.6), label: 'c = 2a', sub: '[2, 4, 4]', icon: 'Binary', tint: 'green' },
          {
            id: 'cmp', kind: 'block', at: at(1, 0), label: 'Compare a, c', sub: 'same direction', icon: 'Scale', tint: 'amber',
            chips: [{ text: 'cosine 1.0', tone: 'good' }, { text: 'dot 18', tone: 'warn' }, { text: 'L2 3.0', tone: 'warn' }],
          },
        ],
        links: [link('a', 'cmp'), link('c', 'cmp')],
        panel: {
          title: 'c points the same way as a',
          icon: 'Table',
          rows: [
            { text: 'Cosine', value: '1.0, identical direction', tone: 'good' },
            { text: 'Dot product a . c', value: '18 (a . a is 9)', tone: 'warn' },
            { text: 'L2 distance', value: '3.0, not zero', tone: 'warn' },
          ],
          footer: { text: 'Length changed two of three scores', tone: 'warn' },
        },
        caption: 'Same direction, different length',
      },
    },
    {
      title: 'Normalize',
      tag: 'tradeoff',
      heading: 'Normalize once and cosine becomes a cheap dot product',
      eli5: 'The librarian shrinks or stretches every arrow to the same length before pinning it. Now the only thing left to compare is direction, and the quick measuring tape gives the same answer as the careful one.',
      body: [
        'A vector is **L2-normalized** when its length is 1. Divide each vector by its norm once, at ingestion. For unit vectors, `cosine(a, b) = a · b`.',
        'So you store normalized vectors and use the cheaper dot product at query time, and still get cosine results. Some databases normalize for you under a cosine metric, and some (pgvector, for one) do not normalize at all. Some hosted models, such as OpenAI embeddings, already return unit-length vectors, so check before dividing again.',
      ],
      keyIdea: 'Normalize at write time, dot product at read time. Cosine quality at dot product cost.',
      metrics: { dims: '1536', mem: '-', score: 'dot = cosine', quality: '-' },
      metricTones: { score: 'good' },
      scene: {
        nodes: [
          { ...docs, at: at(-5.4, 0), label: 'vectors', sub: 'from the model' },
          { id: 'norm', kind: 'block', size: 0.85, at: at(-1.8, 0), label: 'Normalize', sub: 'length to 1', icon: 'Scale', tint: 'teal' },
          { ...store, at: at(1.8, 0), sub: 'unit vectors', status: 'ok' },
          { id: 'q', kind: 'user', at: at(5.4, 0), label: 'query', sub: 'normalized too' },
        ],
        links: [link('docs', 'norm'), link('norm', 'store'), link('q', 'store')],
        flows: [
          { path: ['docs', 'norm', 'store'], tone: 'data', label: 'divide by norm', duration: 2 },
          { path: ['q', 'store'], tone: 'request', label: 'dot product', duration: 1.4, delay: 2.1 },
        ],
        panel: {
          title: 'Using a and b from before',
          icon: 'Code',
          code: 'a / 3 = [0.33, 0.67, 0.67]\nb / 3 = [0.67, 0.33, 0.67]\ndot = 0.22 + 0.22 + 0.44 = 0.89\ncosine was 0.89',
        },
        caption: 'Pay the division once, at ingestion',
      },
      code: {
        language: 'python',
        title: 'Normalize at ingest, dot at query',
        source: `import numpy as np

def normalize(v: np.ndarray) -> np.ndarray:
    return v / np.linalg.norm(v)

a = normalize(np.array([1, 2, 2], dtype=np.float32))
b = normalize(np.array([2, 1, 2], dtype=np.float32))

# cosine similarity is now one dot product
print(float(a @ b))   # 0.8889`,
        highlight: [4, 10],
      },
      quiz: {
        question: 'Your vector database stores L2-normalized vectors and ranks by dot product. What do you get?',
        options: [
          'Rankings by raw vector length',
          'The same ranking cosine similarity would give',
          'Euclidean distance rankings',
          'Random order, because dot product needs unit queries only',
        ],
        answer: 1,
        explain: 'For unit-length vectors the dot product equals the cosine. You get cosine rankings at dot product cost. Normalize the query too, or the scores shift by the query length (the ranking stays the same).',
      },
    },
    {
      title: 'Which metric',
      tag: 'tradeoff',
      heading: 'Pick the metric the model was built for',
      eli5: 'Which measuring tape you use depends on the question. Same topic? Check the direction. Which book is most borrowed? Length matters. How far apart on the floor? Use a ruler.',
      body: [
        'For semantic search over documents use cosine, or dot product on normalized vectors. For recommendations where magnitude carries a popularity signal, dot product keeps it.',
        'Euclidean fits geolocation or pixel distances. If the model card names a metric, use that one: the model was trained against it.',
      ],
      keyIdea: 'Cosine for text search, dot when magnitude means something, L2 for coordinates, and the model card wins any tie.',
      metrics: { dims: '-', mem: '-', score: 'metric per use', quality: '-' },
      scene: {
        nodes: [
          { id: 'mcos', kind: 'block', size: 0.8, at: at(-3.4, -2.6), label: 'Cosine', sub: 'text search', icon: 'Search', tint: 'green' },
          { id: 'mdot', kind: 'block', size: 0.8, at: at(3.4, -2.6), label: 'Dot product', sub: 'popularity signal', icon: 'Star', tint: 'amber' },
          { id: 'ml2', kind: 'block', size: 0.8, at: at(-3.4, 2.6), label: 'Euclidean', sub: 'coordinates', icon: 'Route', tint: 'blue' },
          { id: 'card', kind: 'block', size: 0.8, at: at(3.4, 2.6), label: 'Model card', sub: 'has the final say', icon: 'FileText', tint: 'gray' },
        ],
        links: [link('card', 'mcos', { style: 'dashed', route: 'straight' }), link('card', 'mdot', { style: 'dashed', route: 'straight' })],
        panel: {
          title: 'Use case to metric',
          icon: 'Table',
          rows: [
            { text: 'Semantic search', value: 'cosine or dot (unit)', tone: 'good' },
            { text: 'Recs with popularity', value: 'dot product' },
            { text: 'Geo, pixel distance', value: 'Euclidean' },
            { text: 'Model recommends one', value: 'use that', tone: 'warn' },
          ],
        },
        caption: 'The metric is part of the model contract',
      },
    },
    {
      title: 'Embed a query',
      tag: 'case',
      heading: 'Case: ranking three chunks against one query in code',
      eli5: 'A reader asks the librarian a question. She pins the question on the same map, then walks to the nearest books and reads out how close each one is.',
      body: [
        'The query goes through the same model as the documents. That is the one rule: both sides must live in the same space. Some models (E5, BGE, Nomic) also need a prefix such as `query:` or `search_query:` on queries and a matching one on documents. Check the model card and apply the same prefixes at ingest and query time, because skipping them silently degrades retrieval.',
        'With unit vectors, the whole ranking is a matrix product and a sort. Scores come out between -1 and 1, and the top ones are your results.',
      ],
      keyIdea: 'Embed the query with the same model as the corpus, then rank by similarity score.',
      metrics: { dims: '1536', mem: '-', score: '0.86 best', quality: '-' },
      scene: {
        nodes: [
          { ...user, at: at(-5.4, 0), chips: [{ text: 'cat on a mat', tone: 'default' }] },
          { ...model, at: at(-1.8, 0), load: 40 },
          { ...store, at: at(1.8, 0), sub: 'unit vectors, one per chunk' },
          { ...results, at: at(5.4, 0), badge: 'top 3' },
        ],
        links: [link('user', 'model'), link('model', 'store'), link('store', 'results')],
        flows: [
          { path: ['user', 'model'], tone: 'request', label: 'cat on a mat', duration: 1.2 },
          { path: ['model', 'store'], tone: 'data', label: 'dot product vs every chunk', duration: 1.2, delay: 1.3 },
          { path: ['store', 'results'], tone: 'response', label: 'best scores', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'Scores for three chunks',
          icon: 'Table',
          rows: [
            { text: 'a feline rested on a rug', value: '0.86', tone: 'good' },
            { text: 'kitten napping on a carpet', value: '0.81', tone: 'good' },
            { text: 'stock market crashed today', value: '0.07', tone: 'muted' },
          ],
          footer: { text: 'Illustrative scores', tone: 'muted' },
        },
        caption: 'Same model for query and documents',
      },
      code: {
        language: 'python',
        title: 'Rank chunks with unit vectors',
        source: `import numpy as np

# docs: (n_chunks, 1536) unit vectors, built at ingest
# embed(): your embedding model call, returns a unit vector
query = embed("query: cat on a mat")   # use the model card's prefix, same rule at ingest

scores = docs @ query              # one dot product per chunk
top = np.argsort(-scores)[:3]      # best three first

for i in top:
    print(round(float(scores[i]), 2), chunks[i])`,
        highlight: [5, 7, 8],
      },
    },
    {
      title: 'Flat search',
      tag: 'concept',
      heading: 'Exact search compares the query to every stored vector',
      eli5: 'The librarian could walk past every single book on every shelf and measure how close it is. She never misses the best one, but with a million books the walk takes a while.',
      body: [
        '**Flat search** (brute force) computes the score against all stored vectors and keeps the top k. It is exact. Cost grows linearly with the number of vectors and with the dimensions.',
        'Fine for thousands of chunks. For millions, the next lesson builds approximate indexes that skip most of the comparisons.',
      ],
      keyIdea: 'Flat search is exact and linear in corpus size. Past a few hundred thousand vectors you want an approximate index.',
      metrics: { dims: '1536', mem: '6.1 GB', score: 'top 3', quality: 'exact' },
      scene: {
        nodes: [
          { ...user, chips: ['cat on a mat'] },
          { ...model, load: 40 },
          { ...store, status: 'active', chips: [{ text: '1,000,000 compares', tone: 'warn' }] },
          { ...results, badge: 'top 3' },
        ],
        links: [link('user', 'model'), link('model', 'store'), link('store', 'results')],
        flows: [
          { path: ['user', 'model'], tone: 'request', label: 'query', duration: 1.1 },
          { path: ['model', 'store'], tone: 'request', label: 'query vector', duration: 1.1, delay: 1.2 },
          { path: ['store', 'results'], tone: 'response', label: 'top 3 ids', duration: 1.1, delay: 2.4 },
        ],
        panel: {
          title: 'Work per query (flat)',
          icon: 'Gauge',
          rows: [
            { text: 'Chunks stored', value: '1,000,000' },
            { text: 'Floats per chunk', value: '1536' },
            { text: 'Multiply-adds per query', value: '~1.5 billion', tone: 'warn' },
          ],
          footer: { text: 'Linear in chunks and in dimensions', tone: 'warn' },
        },
        caption: 'Every query touches every vector',
      },
    },
    {
      title: 'Memory bill',
      tag: 'case',
      heading: 'Case: sizing the memory for one million chunks',
      eli5: 'Every map entry takes shelf room. A million books with 1536 numbers each fills a surprising number of shelves. Ten million fills a warehouse.',
      body: [
        'Each dimension is a 4-byte float. One chunk is `1536 × 4 = 6,144` bytes. One million chunks is about **6.1 GB** of raw vectors, before any index overhead.',
        'Ten million chunks is 61 GB, one hundred million is 614 GB. Fast search wants vectors in RAM, so dimensions turn directly into a hardware bill.',
      ],
      keyIdea: 'Memory is chunks × dimensions × 4 bytes. Do this sum before choosing a model or a database.',
      metrics: { dims: '1536', mem: '6.1 GB', score: '-', quality: '-' },
      metricTones: { mem: 'warn' },
      scene: {
        nodes: [
          { ...docs, at: at(-4.4, 0), label: 'corpus', sub: '1M chunks' },
          { ...store, at: at(0.4, 0), status: 'hot', badge: '6.1 GB', chips: ['1M × 1536 × 4 B'] },
          { id: 'ram', kind: 'block', size: 0.85, at: at(4.8, 0), label: 'RAM', sub: 'fast search lives here', icon: 'HardDrive', tint: 'amber', load: 78 },
        ],
        links: [link('docs', 'store'), link('store', 'ram')],
        flows: [{ path: ['docs', 'store', 'ram'], tone: 'data', label: 'float32 vectors', duration: 2 }],
        panel: {
          title: 'Raw vectors, float32, 1536 dims',
          icon: 'Table',
          rows: [
            { text: '1 million chunks', value: '6.1 GB' },
            { text: '10 million chunks', value: '61 GB', tone: 'warn' },
            { text: '100 million chunks', value: '614 GB', tone: 'bad' },
          ],
          footer: { text: 'Index overhead comes on top', tone: 'muted' },
        },
        caption: 'Vectors are big',
      },
    },
    {
      title: 'Dims tradeoff',
      tag: 'tradeoff',
      heading: 'Doubling the dimensions doubles memory and scan time',
      eli5: 'A map with twice as many details needs twice the shelf room and twice the walking to compare each book. It only pays off if the extra detail helps you find the right book.',
      body: [
        'More dimensions mean more nuance. They also mean proportionally more memory, and for flat search roughly twice the time per query when you double. Graph indexes pay less, but never nothing.',
        'The right size is the smallest one that holds retrieval quality on **your** data. Measure it on a labeled set of queries, not on a leaderboard.',
      ],
      keyIdea: 'Pick the smallest dimension count that keeps your retrieval quality. Measure on your own queries.',
      metrics: { dims: '768 / 1536 / 3072', mem: '3.1 / 6.1 / 12.3 GB', score: '-', quality: 'measure it' },
      metricTones: { mem: 'warn' },
      scene: {
        nodes: [
          { id: 's768', kind: 'block', size: 0.7, at: at(-4.4, 0), label: '768 dims', sub: 'cheap', icon: 'Database', tint: 'teal', chips: [{ text: '3.1 GB', tone: 'good' }] },
          { id: 's1536', kind: 'block', size: 0.85, at: at(0, 0), label: '1536 dims', sub: 'balanced', icon: 'Database', tint: 'blue', chips: [{ text: '6.1 GB', tone: 'default' }] },
          { id: 's3072', kind: 'block', size: 1, at: at(4.6, 0), label: '3072 dims', sub: 'finest', icon: 'Database', tint: 'violet', chips: [{ text: '12.3 GB', tone: 'warn' }] },
        ],
        links: [link('s768', 's1536', { route: 'straight', label: '2x' }), link('s1536', 's3072', { route: 'straight', label: '2x' })],
        panel: {
          title: '1M chunks, float32',
          icon: 'Table',
          rows: [
            { text: '768 dims', value: '3.1 GB' },
            { text: '1536 dims', value: '6.1 GB' },
            { text: '3072 dims', value: '12.3 GB', tone: 'warn' },
          ],
          footer: { text: 'Flat search time scales the same way', tone: 'warn' },
        },
        caption: 'Linear cost for a nonlinear quality gain',
      },
    },
    {
      title: 'Matryoshka',
      tag: 'concept',
      heading: 'Matryoshka embeddings can be cut short and still work',
      eli5: 'Like nesting dolls: the first few numbers already describe the big idea, and later numbers add finer detail. Throw away the tail and the map still points to the right neighborhood.',
      body: [
        'Some models are trained so the **first n dimensions** carry most of the meaning. You can truncate a 3072-dim vector to 512 and keep most of the signal.',
        'The book figure is about 3% retrieval quality lost for 6x less storage and 6x faster comparison. Check your own model: only models trained this way tolerate it. Re-normalize after cutting.',
      ],
      keyIdea: 'With a Matryoshka-trained model, truncating dimensions trades a little quality for a large cut in memory and time.',
      metrics: { dims: '3072 to 512', mem: '12.3 to 2.0 GB', score: '-', quality: '~3% loss' },
      metricTones: { mem: 'good', quality: 'warn' },
      scene: {
        nodes: [
          { id: 'full', kind: 'block', at: at(-4.4, 0), label: 'Full vector', sub: '3072 dims', icon: 'Binary', tint: 'violet', chips: [{ text: '12.3 GB per 1M', tone: 'warn' }] },
          { id: 'cut', kind: 'block', size: 0.85, at: at(0, 0), label: 'Truncate', sub: 'keep first 512', icon: 'Split', tint: 'teal' },
          { id: 'short', kind: 'block', size: 0.8, at: at(4.4, 0), label: 'Short vector', sub: '512 dims', icon: 'Binary', tint: 'green', chips: [{ text: '2.0 GB per 1M', tone: 'good' }] },
        ],
        links: [link('full', 'cut'), link('cut', 'short')],
        flows: [{ path: ['full', 'cut', 'short'], tone: 'data', label: 'first 512 floats', duration: 2 }],
        panel: {
          title: 'Cost of cutting 3072 to 512',
          icon: 'Table',
          rows: [
            { text: 'Storage', value: '6x smaller', tone: 'good' },
            { text: 'Compare time', value: '6x faster', tone: 'good' },
            { text: 'Retrieval quality', value: 'about 3% lower', tone: 'warn' },
          ],
          footer: { text: 'Model must be trained for it', tone: 'muted' },
        },
        caption: 'Truncate, then re-normalize',
      },
      code: {
        language: 'python',
        title: 'Truncate and re-normalize',
        source: `import numpy as np

def shorten(v: np.ndarray, dims: int = 512) -> np.ndarray:
    cut = v[:dims]                      # keep the leading dims
    return cut / np.linalg.norm(cut)    # unit length again

full = embed("cat on a mat")            # 3072 floats
small = shorten(full, 512)              # 512 floats`,
        highlight: [4, 5],
      },
    },
    {
      title: 'Two passes',
      tag: 'tradeoff',
      heading: 'Search short vectors first, rescore the shortlist at full size',
      eli5: 'The librarian first skims with the small map to pick 200 likely books fast. Then she carefully checks only those 200 with the big detailed map and keeps the best 10.',
      body: [
        'Store the full 3072-dim vectors, and keep a 512-dim copy for the first pass. Query the short copy for, say, the top 200 candidates. That scan is cheap.',
        'Then rescore only those 200 at full 3072 dims and return the top 10. You get most of the full-size quality at a fraction of the scan cost.',
      ],
      keyIdea: 'Cheap and wide first, exact and narrow second. Matryoshka makes both passes use the same model.',
      metrics: { dims: '512 then 3072', mem: '2.0 GB hot', score: 'top 200 to 10', quality: 'near full' },
      metricTones: { mem: 'good', quality: 'good' },
      scene: {
        nodes: [
          { ...user, at: at(-5.4, 0) },
          { id: 'p1', kind: 'block', size: 0.9, at: at(-1.8, 0), label: 'Pass 1', sub: '512 dims, all chunks', icon: 'Search', tint: 'teal' },
          { id: 'p2', kind: 'block', size: 0.9, at: at(1.8, 0), label: 'Pass 2', sub: '3072 dims, 200 only', icon: 'Scale', tint: 'violet' },
          { ...results, at: at(5.4, 0), badge: 'top 10' },
        ],
        links: [link('user', 'p1'), link('p1', 'p2'), link('p2', 'results')],
        flows: [
          { path: ['user', 'p1'], tone: 'request', label: 'query', duration: 1.1 },
          { path: ['p1', 'p2'], tone: 'data', label: 'top 200', count: 3, duration: 1.2, delay: 1.2 },
          { path: ['p2', 'results'], tone: 'response', label: 'top 10', duration: 1.1, delay: 2.5 },
        ],
        panel: {
          title: 'Funnel',
          icon: 'List',
          rows: [
            { text: 'Pass 1: scan 1,000,000', value: '512 dims', tone: 'good' },
            { text: 'Pass 2: rescore 200', value: '3072 dims' },
            { text: 'Returned', value: '10' },
          ],
          footer: { text: 'The 200 and 10 here are examples to tune', tone: 'muted' },
        },
        caption: 'A funnel keeps quality and trims cost',
      },
    },
    {
      title: 'Pick a model',
      tag: 'tradeoff',
      heading: 'Hosted API or self-hosted: choose by language, cost and control',
      eli5: 'You can rent a map-making service downtown, or hire a mapmaker for your own library. Renting is easy to start. Owning is cheaper at huge volume and keeps the books in the building.',
      body: [
        'Hosted models are the quick default: one call, no GPUs to run. Open-weight models you host give control over data, cost at high volume and tuning, but you operate the serving layer.',
        'Match the model to the data: multilingual content needs a multilingual model, code needs a code-aware one. Test two or three candidates on your own queries.',
        'Hosted models bill per input token, and text-embedding-3-small is about 5x cheaper than large. Self-hosting trades that bill for GPU hours.',
      ],
      keyIdea: 'Start hosted, measure on your data, and self-host when volume, privacy or tuning justify running GPUs.',
      metrics: { dims: '768 to 4096', mem: '-', score: '-', quality: 'test on your data' },
      scene: {
        nodes: [
          { ...docs, at: at(-4.4, 0), label: 'your corpus', sub: 'language, domain' },
          { id: 'hosted', kind: 'block', at: at(0.4, -3.8), label: 'Hosted API', sub: 'one call, pay per token', icon: 'Globe', tint: 'blue' },
          { id: 'self', kind: 'block', at: at(3.2, 3.8), label: 'Self-hosted', sub: 'open weights', icon: 'Server', tint: 'amber', load: 65 },
        ],
        links: [link('docs', 'hosted'), link('docs', 'self')],
        flows: [
          { path: ['docs', 'hosted'], tone: 'request', label: 'text', duration: 1.4 },
          { path: ['docs', 'self'], tone: 'request', label: 'text', duration: 1.4, delay: 0.3 },
        ],
        panel: {
          title: 'Model families',
          icon: 'Table',
          rows: [
            { text: 'text-embedding-3-small', value: 'cheap default' },
            { text: 'text-embedding-3-large', value: 'English, truncatable' },
            { text: 'Cohere embed-v3', value: 'multilingual, business' },
            { text: 'BGE-M3', value: 'self-host, hybrid' },
            { text: 'Nomic embed v1.5', value: 'open, on-device' },
            { text: 'E5-Mistral-7B', value: 'heavy, high quality' },
          ],
        },
        caption: 'Same job, different operating cost',
      },
    },
    {
      title: 'Reranker',
      tag: 'concept',
      heading: 'One vector per text loses detail, so rerank the shortlist',
      eli5: 'The map gets you to the right shelf fast, but two books on one shelf can look alike. A careful reader then opens both side by side with the question and picks the better one.',
      body: [
        'A **bi-encoder** embeds query and document separately and squeezes each into one vector, so fine detail is lost. A **cross-encoder reranker** reads the query and one document together and scores the pair. Better, but too slow for the whole corpus.',
        'So use the embedding to shortlist 50 to 200 candidates and the reranker to pick the top 5 to 10. It adds roughly 100 to 300 ms and usually helps more than a pricier embedding model.',
      ],
      keyIdea: 'Embeddings are the fast, coarse filter. A reranker is the slow, precise judge on the shortlist.',
      metrics: { dims: '1536', mem: '-', score: 'top 100 to 5', quality: 'much better', },
      metricTones: { quality: 'good' },
      scene: {
        nodes: [
          { ...store, at: at(-4.4, 0), status: 'ok' },
          { id: 'rerank', kind: 'block', at: at(0, 0), label: 'Reranker', sub: 'cross-encoder', icon: 'Scale', tint: 'green', load: 72 },
          { ...results, at: at(4.4, 0), badge: 'top 5' },
        ],
        links: [link('store', 'rerank'), link('rerank', 'results')],
        flows: [
          { path: ['store', 'rerank'], tone: 'data', label: 'top 100 (query, doc) pairs', duration: 1.6 },
          { path: ['rerank', 'results'], tone: 'response', label: 'top 5 reordered', duration: 1.4, delay: 1.7 },
        ],
        panel: {
          title: 'Bi-encoder vs cross-encoder',
          icon: 'Table',
          rows: [
            { text: 'Bi-encoder (embedding)', value: 'fast, whole corpus', tone: 'good' },
            { text: 'Cross-encoder (reranker)', value: 'slow, shortlist only', tone: 'warn' },
            { text: 'Typical rerank latency', value: '100 to 300 ms' },
          ],
          footer: { text: 'The next retrieval lessons go deeper', tone: 'muted' },
        },
        caption: 'Shortlist with vectors, judge with a reranker',
      },
      quiz: {
        question: 'Retrieval often puts the right chunk at rank 30 of 100, with a cheap embedding model. What is usually the best next step?',
        options: [
          'Switch to a model with twice the dimensions',
          'Add a reranker over the top 50 to 200 candidates',
          'Switch the metric from cosine to Euclidean',
          'Store the vectors as float64',
        ],
        answer: 1,
        explain: 'The right chunk is already in the shortlist, it is just ranked too low. A cross-encoder reranker reads query and chunk together and fixes the order. A pricier embedding model tends to give a smaller gain.',
      },
    },
    {
      title: 'Uses',
      tag: 'concept',
      heading: 'Embeddings do more than search',
      eli5: 'Once every book has a spot on the map, the librarian can do more than find one book. She can group books by neighborhood, spot copies sitting on the same spot, and notice one that sits alone.',
      body: [
        'Anything that needs "similar to this" can use embeddings: **semantic search**, **clustering**, **classification** with a small model on top of the vectors, **near-duplicate detection**, **anomaly detection** on text, and **recommendations**.',
        'The most important consumer is retrieval for LLM apps (RAG): fetch the few chunks that answer a question and put them in the prompt.',
      ],
      keyIdea: 'One embedding step feeds search, grouping, deduplication, anomaly detection and RAG retrieval.',
      metrics: { dims: '1536', mem: '-', score: '-', quality: '-' },
      scene: {
        nodes: [
          { ...store, at: at(0, 0), label: 'Embeddings', sub: 'shared by all', status: 'active' },
          { id: 'u1', kind: 'block', size: 0.7, at: at(-4.4, -2.4), label: 'Search', icon: 'Search', tint: 'blue' },
          { id: 'u2', kind: 'block', size: 0.7, at: at(4.4, -2.4), label: 'Clustering', icon: 'Boxes', tint: 'green' },
          { id: 'u3', kind: 'block', size: 0.7, at: at(-4.4, 2.8), label: 'Dedupe', icon: 'Copy', tint: 'teal' },
          { id: 'u4', kind: 'block', size: 0.7, at: at(4.4, 2.8), label: 'RAG', icon: 'FileText', tint: 'amber' },
        ],
        links: [link('store', 'u1'), link('store', 'u2'), link('store', 'u3'), link('store', 'u4')],
        panel: {
          title: 'Jobs for one vector',
          icon: 'List',
          rows: [
            { text: 'Semantic search', value: 'nearest neighbors' },
            { text: 'Clustering', value: 'group by closeness' },
            { text: 'Classification', value: 'small model on vectors' },
            { text: 'Near-duplicates', value: 'score above a cutoff' },
            { text: 'Anomaly detection', value: 'far from all clusters' },
            { text: 'RAG retrieval', value: 'chunks into the prompt', tone: 'good' },
          ],
        },
        caption: 'Compute once, reuse everywhere',
      },
    },
    {
      title: 'Semantic cache',
      tag: 'case',
      heading: 'Case: caching LLM answers by the meaning of the prompt',
      eli5: 'A customer asks the front desk something the desk already answered for another customer, worded differently. The clerk spots it is the same question and reads out the saved answer, without bothering the expert.',
      body: [
        'A **semantic cache** keys LLM responses by the embedding of the prompt. If a new prompt lands within a similarity threshold of a cached one, return the stored answer and skip the model call.',
        'The threshold is a dial. Too strict (0.98) and almost nothing hits. Too loose (0.85) and different questions collide and get the wrong answer. Tune it on real traffic.',
      ],
      keyIdea: 'A semantic cache trades a cheap embedding and lookup for a costly LLM call. The threshold decides hits versus wrong answers.',
      metrics: { dims: '1536', mem: '-', score: 'threshold 0.92', quality: 'tune on traffic' },
      scene: {
        nodes: [
          { ...user, at: at(-5.4, 0) },
          { id: 'sc', kind: 'block', at: at(-1.8, 0), label: 'Semantic cache', sub: 'embed, then look up', icon: 'Zap', tint: 'teal', badge: 'hit 0.94', status: 'ok' },
          { id: 'llm', kind: 'block', at: at(3.8, 0), label: 'LLM', sub: 'GPU, expensive', icon: 'Cpu', tint: 'amber', load: 85, status: 'dim' },
        ],
        links: [link('user', 'sc', { arrow: 'both' }), link('sc', 'llm', { style: 'dashed' })],
        flows: [
          { path: ['user', 'sc'], tone: 'request', label: 'how do I reset my password', duration: 1.5 },
          { path: ['sc', 'user'], tone: 'response', label: 'cached answer', duration: 1.4, delay: 1.6 },
        ],
        panel: {
          title: 'Similarity threshold',
          icon: 'Gauge',
          rows: [
            { text: '0.98 strict', value: 'few hits', tone: 'warn' },
            { text: '0.92 middle', value: 'tune here', tone: 'good' },
            { text: '0.85 loose', value: 'wrong answers', tone: 'bad' },
          ],
          footer: { text: 'Values to tune, not fixed constants', tone: 'muted' },
        },
        caption: 'Skip the LLM when a similar prompt was answered',
      },
    },
    {
      title: 'Cache risks',
      tag: 'tradeoff',
      heading: 'A shared semantic cache can serve one person the answer meant for another',
      eli5: 'The clerk saved an answer about Sam\'s library fines. A different kid asks a similar question and the clerk reads out Sam\'s fines. Saved answers need a name tag on them.',
      body: [
        'A cache hit across users leaks data on personalized answers: "what is my balance" looks the same in embedding space for everyone. Time-sensitive questions go stale, and agent workflows need different tool calls each time.',
        'Safe uses are FAQs, stable classification and public content. Always namespace the cache by user and task type.',
      ],
      keyIdea: 'Semantic caches are safe for stable public answers. Namespace by user and task, or do not cache.',
      metrics: { dims: '1536', mem: '-', score: 'hit 0.95', quality: 'wrong user' },
      metricTones: { quality: 'bad' },
      scene: {
        nodes: [
          { id: 'ua', kind: 'user', at: at(-5.2, -2.4), label: 'user A', chips: ['my balance?'] },
          { id: 'ub', kind: 'user', at: at(-3, 3.2), label: 'user B', chips: ['my balance?'] },
          { id: 'sc', kind: 'block', at: at(1, 0.4), label: 'Shared cache', sub: 'no namespace', icon: 'Zap', tint: 'red', status: 'hot', badge: 'hit 0.95' },
        ],
        links: [link('ua', 'sc'), link('ub', 'sc')],
        flows: [
          { path: ['ua', 'sc'], tone: 'request', label: 'balance: 120', duration: 1.3 },
          { path: ['sc', 'ub'], tone: 'error', label: 'balance: 120 (A)', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Cache with care',
          icon: 'Shield',
          rows: [
            { text: 'FAQ, stable extraction', value: 'safe', tone: 'good' },
            { text: 'Public product text', value: 'safe', tone: 'good' },
            { text: 'Personalized answers', value: 'leaks across users', tone: 'bad' },
            { text: 'Live state, agents', value: 'stale or wrong', tone: 'bad' },
          ],
          footer: { text: 'Key by user and task type', tone: 'warn' },
        },
        caption: 'Same wording, different owner',
      },
    },
    {
      title: 'Switching cost',
      tag: 'tradeoff',
      heading: 'Changing the embedding model means re-embedding everything',
      eli5: 'Two librarians draw different maps. A spot on one map means nothing on the other. If you swap librarians, every book has to be pinned again on the new map.',
      body: [
        'Vectors from model A are meaningless in model B space, even at the same dimension count. You cannot mix them, and you cannot convert one to the other.',
        'So a model change re-embeds the **whole corpus**: tokens, GPU hours, and a second index to build while the first still serves. Store the model id with every vector so you can run old and new side by side and cut over.',
      ],
      keyIdea: 'Treat the embedding model like a schema. Version vectors with the model id and budget a full re-embed for any switch.',
      metrics: { dims: '1536 to 1024', mem: '2 indexes during move', score: '-', quality: 'verify before cutover' },
      metricTones: { mem: 'warn' },
      scene: {
        nodes: [
          { ...docs, at: at(-5.4, 0), label: 'corpus', sub: '1M chunks, again' },
          { id: 'mb', kind: 'block', at: at(-1.8, -2.8), label: 'Model B', sub: 'new', icon: 'Cpu', tint: 'amber', load: 90, status: 'hot' },
          { id: 'ia', kind: 'block', size: 0.8, at: at(3.2, -2.8), label: 'Index v1', sub: 'model A, serving', icon: 'Database', tint: 'gray', chips: ['embed-a'] },
          { id: 'ib', kind: 'block', size: 0.8, at: at(3.2, 2.8), label: 'Index v2', sub: 'model B, building', icon: 'Database', tint: 'violet', chips: [{ text: 'embed-b', tone: 'good' }] },
        ],
        links: [link('docs', 'mb'), link('mb', 'ib')],
        flows: [
          { path: ['docs', 'mb'], tone: 'request', label: 'every chunk', count: 3, duration: 1.4 },
          { path: ['mb', 'ib'], tone: 'data', label: 'new vectors', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Migration phases and cost',
          icon: 'Table',
          rows: [
            { text: '1. Build v2 beside v1', value: 'corpus tokens x price', tone: 'warn' },
            { text: '2. Backfill and verify', value: 'GPU or API time' },
            { text: '3. Dual-read or shadow compare', value: '2 indexes in RAM', tone: 'warn' },
            { text: '4. Cut over', value: 'cheap, reversible' },
            { text: '5. Delete v1', value: 'frees the memory', tone: 'good' },
          ],
          footer: { text: 'Billed per input token: re-embed = corpus tokens x price', tone: 'warn' },
        },
        caption: 'Build the new index beside the old one',
      },
      code: {
        language: 'json',
        title: 'Vector row with a model id',
        source: `{
  "id": "chunk-81",
  "text": "Resetting a password takes two steps.",
  "embedding_model": "embed-a",
  "dims": 1536,
  "normalized": true,
  "vector": [0.021, -0.143, 0.887]
}`,
        highlight: [4, 6],
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Recap: text to vectors to scores',
      eli5: 'The librarian pins every book on a map by its meaning. A question gets pinned too, and the nearest books are the answers. Bigger maps cost more shelf room, and a new librarian means pinning every book again.',
      body: [
        'An **embedding** is a fixed-length vector from a model, with distance standing in for meaning. Compare with **cosine**, or dot product on normalized vectors. Memory is chunks × dimensions × 4 bytes.',
        'Truncate with Matryoshka models, shortlist with vectors and rerank, cache by meaning only with namespaces, and version every vector by model id.',
      ],
      keyIdea: 'Embeddings turn meaning into geometry. Size them, normalize them, version them, and rerank their shortlist.',
      metrics: { dims: '1536', mem: '6.1 GB', score: 'cosine', quality: 'rerank to fix' },
      scene: {
        nodes: [
          { ...user, at: at(-5.4, 0) },
          { ...model, at: at(-1.8, 0), load: 40 },
          { ...store, at: at(1.8, 0), status: 'ok', badge: '6.1 GB' },
          { ...results, at: at(5.4, 0), badge: 'top k' },
        ],
        links: [link('user', 'model'), link('model', 'store'), link('store', 'results')],
        flows: [
          { path: ['user', 'model'], tone: 'request', label: 'query', duration: 1.1 },
          { path: ['model', 'store'], tone: 'data', label: 'query vector', duration: 1.1, delay: 1.2 },
          { path: ['store', 'results'], tone: 'response', label: 'nearest chunks', duration: 1.1, delay: 2.4 },
        ],
        panel: {
          title: 'Keep these',
          icon: 'List',
          rows: [
            { text: 'Same model for query and corpus', tone: 'good' },
            { text: 'Normalize, then dot product', tone: 'good' },
            { text: 'Memory = chunks × dims × 4 B' },
            { text: 'Rerank the shortlist' },
            { text: 'Version vectors by model id', tone: 'warn' },
          ],
        },
        caption: 'The whole path on one screen',
      },
      quiz: {
        question: 'A team switches embedding model and only re-embeds new documents, keeping old vectors. What happens?',
        options: [
          'Nothing, vectors from any model are comparable at the same length',
          'Search quality improves gradually as new documents arrive',
          'Old and new vectors live in different spaces, so scores between them are meaningless',
          'Only the dimensions need to be padded to match',
        ],
        answer: 2,
        explain: 'Each model builds its own space. Scores between a model A vector and a model B vector carry no meaning. Re-embed the whole corpus into a new index and cut over once it is verified.',
      },
    },
  ],
};
