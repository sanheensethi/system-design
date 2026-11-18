import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const user: SceneNode = { id: 'user', kind: 'client', at: at(-4.2, -1.8), label: 'user', sub: 'asks a question' };
const embedder: SceneNode = { id: 'embedder', kind: 'block', size: 0.8, at: at(0, -1.8), label: 'embedder', sub: 'embedding model', icon: 'Cpu', tint: 'amber' };
const store: SceneNode = { id: 'store', kind: 'block', at: at(4.2, -1.8), label: 'vector store', sub: '10M chunks', icon: 'Database', tint: 'teal' };
const docs: SceneNode = { id: 'docs', kind: 'storage', at: at(-4.2, 2.2), label: 'documents', sub: '10M chunks' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

export const aiVectorDatabases: Lesson = {
  id: 'ai-vector-databases',
  title: 'Vector databases and ANN indexes',
  tagline: 'How a store finds the nearest of ten million vectors in a few milliseconds, and what it gives up to do it.',
  minutes: 22,
  level: 'Intermediate',
  learn: [
    'Embeddings as points, and the three similarity metrics (cosine, dot product, L2)',
    'Dimensions, Matryoshka truncation and the memory math of 10 million vectors',
    'Flat search, why it stops scaling, and what recall means',
    'HNSW, IVF, product quantization and disk-based indexes, with the knobs for each',
    'Metadata filtering (pre versus post), hybrid search with RRF and reranking',
    'Choosing a store, scaling it out, keeping it fresh and surviving an embedding model change',
  ],
  metrics: [
    { key: 'vectors', label: 'Vectors', icon: 'Layers' },
    { key: 'memory', label: 'Memory', icon: 'HardDrive' },
    { key: 'latency', label: 'Query latency', icon: 'Timer' },
    { key: 'recall', label: 'Recall@10', icon: 'Gauge' },
  ],
  steps: [
    {
      title: 'Scan everything',
      tag: 'problem',
      heading: 'Ten million chunks, one question, and no shortcut',
      eli5: 'A **library** has ten million books and no map. To find the five books most like yours, the librarian has to pull every single book off the shelf and compare it.',
      body: [
        'A support assistant has indexed **10 million** document chunks. Each is stored as a 1536-number vector. A user asks a question, and the system must find the 10 chunks closest in meaning.',
        'The obvious way is to compare the question vector with every stored vector. That is 10M comparisons of 1536 numbers each, per query. Fine in a notebook. Not fine at 200 queries a second.',
      ],
      keyIdea: 'Checking every vector makes query cost grow with the corpus. A vector database exists to avoid that scan.',
      metrics: { vectors: '10M', memory: '61 GB', latency: '1 s+', recall: '100%' },
      metricTones: { latency: 'bad' },
      scene: {
        nodes: [
          { ...user, chips: ['why is my invoice late?'] },
          { ...embedder, status: 'active' },
          { ...store, status: 'hot', load: 96, badge: 'compares all 10M' },
        ],
        links: [link('user', 'embedder'), link('embedder', 'store', { label: '1536 floats', labelTone: 'warn' })],
        flows: [
          { path: ['user', 'embedder'], tone: 'request', label: 'question', duration: 1.2 },
          { path: ['embedder', 'store'], tone: 'data', label: 'query vector', duration: 1.4, delay: 1.3 },
          { path: ['store', 'user'], tone: 'response', label: 'top 10', duration: 2.2, delay: 2.9 },
        ],
        panel: {
          title: 'Cost of one exact query',
          icon: 'Gauge',
          rows: [
            { text: 'Vectors compared', value: '10,000,000' },
            { text: 'Numbers per vector', value: '1,536' },
            { text: 'Multiply-adds', value: '~15 billion', tone: 'warn' },
            { text: 'Vectors held in RAM', value: '61 GB', tone: 'warn' },
          ],
          footer: { text: 'Per query, before any other work', tone: 'bad' },
        },
        caption: 'Every query touches every vector',
      },
    },
    {
      title: 'Vectors',
      tag: 'concept',
      heading: 'An embedding is a point, and close points mean similar things',
      eli5: 'The **embedder** is a librarian who gives every book a spot on a big map of topics. Books about the same thing end up standing near each other.',
      body: [
        'An **embedding model** turns text into a fixed-length list of floats, such as 1536 of them. Texts with similar meaning land close together in that space, even when they share no words.',
        'So "similar meaning" becomes "small distance". A vector database stores these points and answers one question: which stored points are nearest to this query point?',
      ],
      keyIdea: 'Search by meaning becomes search by distance between points. The vector store is built for that one query.',
      metrics: { vectors: '10M', memory: '61 GB', latency: '-', recall: '-' },
      scene: {
        nodes: [
          { ...docs, status: 'active' },
          { ...embedder, at: at(0, 2.2), status: 'active', load: 55 },
          { ...store, at: at(4.2, 2.2), sub: 'points on a map' },
        ],
        links: [link('docs', 'embedder'), link('embedder', 'store')],
        flows: [
          { path: ['docs', 'embedder'], tone: 'request', label: 'cat on a mat', duration: 1.3 },
          { path: ['embedder', 'store'], tone: 'data', label: '[0.02, -0.14, ...]', duration: 1.5, delay: 1.4 },
        ],
        panel: {
          title: 'Same model, three texts',
          icon: 'Table',
          rows: [
            { text: 'the cat sat on the mat', value: 'reference' },
            { text: 'a feline rested on a rug', value: 'very close', tone: 'good' },
            { text: 'stock market crashed today', value: 'far away', tone: 'bad' },
          ],
          footer: { text: 'Each text becomes 1,536 floats', tone: 'muted' },
        },
        caption: 'Meaning as position',
      },
    },
    {
      title: 'Three metrics',
      tag: 'concept',
      heading: 'Cosine, dot product and L2 measure closeness differently',
      eli5: 'To say two books are alike, the librarian can check which way their arrows point, how long the arrows are together, or how far apart the tips are. **Cosine** only checks the direction.',
      body: [
        '**Cosine similarity** compares the angle between two vectors and ignores length. It runs from -1 (opposite) to 1 (same direction). It is the default for text search, because you care whether two texts mean the same thing.',
        '**Dot product** is the same sum without the length division, so longer vectors score higher. **Euclidean (L2) distance** is the straight-line gap between the points, and suits coordinates more than text.',
      ],
      keyIdea: 'Cosine asks about direction, dot product also rewards length, L2 measures the gap. Use the metric the embedding model was trained for.',
      metrics: { vectors: '10M', memory: '61 GB', latency: '-', recall: '-' },
      scene: {
        nodes: [
          { id: 'q', kind: 'block', size: 0.8, at: at(-4, 0), label: 'query', sub: 'vector q', icon: 'Search', tint: 'violet' },
          { id: 'cos', kind: 'block', size: 0.8, at: at(0, -2.4), label: 'cosine', sub: 'angle only', icon: 'Route', tint: 'teal', status: 'active' },
          { id: 'dot', kind: 'block', size: 0.8, at: at(0, 2.4), label: 'dot product', sub: 'angle and length', icon: 'Binary', tint: 'blue' },
          { id: 'l2', kind: 'block', size: 0.8, at: at(4, 0), label: 'L2', sub: 'straight gap', icon: 'Scale', tint: 'gray' },
        ],
        links: [link('q', 'cos'), link('q', 'dot'), link('cos', 'l2', { style: 'faint' }), link('dot', 'l2', { style: 'faint' })],
        flows: [
          { path: ['q', 'cos'], tone: 'request', label: 'a·b / (|a||b|)', duration: 1.5 },
          { path: ['q', 'dot'], tone: 'request', label: 'a·b', duration: 1.5, delay: 0.4 },
        ],
        panel: {
          title: 'Which metric for what',
          icon: 'Table',
          rows: [
            { text: 'Semantic search over text', value: 'cosine', tone: 'good' },
            { text: 'Magnitude means popularity', value: 'dot product' },
            { text: 'Geo or pixel coordinates', value: 'L2' },
            { text: 'Model card names a metric', value: 'use that', tone: 'warn' },
          ],
        },
        caption: 'Three ways to score a pair of vectors',
      },
    },
    {
      title: 'Normalize once',
      tag: 'concept',
      heading: 'Normalize at ingest and cosine becomes a dot product',
      eli5: 'If every arrow is trimmed to the same length when a book is shelved, comparing directions is as easy as comparing arrows, with no measuring at search time.',
      body: [
        'Divide each vector by its own length once, when you ingest it, so every vector has length 1. Now `cosine(a, b)` and `a · b` give the same number.',
        'You store normalized vectors and run the cheaper dot product on every query. Check whether your model already returns unit vectors (OpenAI models do), and normalize yourself if not. pgvector and Pinecone will not do it for you, though some stores offer a cosine mode that normalizes internally.',
      ],
      keyIdea: 'Pay the normalization cost once at write time, then every query uses the cheap dot product.',
      metrics: { vectors: '10M', memory: '61 GB', latency: '-', recall: '-' },
      scene: {
        nodes: [
          { ...docs },
          { ...embedder, at: at(0, 2.2), load: 55 },
          { id: 'norm', kind: 'block', size: 0.8, at: at(4.2, 2.2), label: 'normalize', sub: 'length = 1', icon: 'Scale', tint: 'green', status: 'ok' },
        ],
        links: [link('docs', 'embedder'), link('embedder', 'norm')],
        flows: [
          { path: ['docs', 'embedder'], tone: 'request', label: 'chunk', duration: 1.2 },
          { path: ['embedder', 'norm'], tone: 'data', label: 'v / |v|', duration: 1.4, delay: 1.3 },
        ],
        panel: {
          title: 'Same score, cheaper math',
          icon: 'Gauge',
          rows: [
            { text: 'cosine(a, b)', value: 'needs 2 norms', tone: 'warn' },
            { text: 'a · b on unit vectors', value: 'same number', tone: 'good' },
          ],
          footer: { text: 'Normalize once, at write time', tone: 'good' },
        },
        caption: 'Unit length turns cosine into a dot product',
      },
      code: {
        language: 'python',
        title: 'Normalize at ingest, dot product at query',
        source: `import numpy as np

def normalize(v: np.ndarray) -> np.ndarray:
    return v / np.linalg.norm(v)      # length becomes 1

a = normalize(embed("the cat sat on the mat"))
b = normalize(embed("a feline rested on a rug"))

cosine = float(a @ b)                 # dot product of unit vectors
print(cosine)                         # close to 1.0 for similar text`,
        highlight: [4, 9],
      },
    },
    {
      title: 'Dimensions',
      tag: 'tradeoff',
      heading: 'More dimensions buy nuance and cost memory',
      eli5: 'A bigger map has more room to put similar books close together, but it needs a bigger table. **Matryoshka** maps can be folded to a smaller size and still mostly work.',
      body: [
        'Common models output 768, 1024, 1536 or 3072 dimensions. More dimensions carry more nuance, and cost more storage and more compute per comparison. For flat search, doubling dimensions roughly doubles both.',
        '**Matryoshka** embeddings are trained so you can cut a vector to its first N values and keep most of the signal. 3072 down to 512 can lose only a few percent of quality and uses 6x less storage. Renormalize after truncating, because a cut vector is no longer unit length.',
      ],
      keyIdea: 'Dimensions are a cost dial. Truncating a Matryoshka vector trades a little quality for a lot of memory and speed.',
      metrics: { vectors: '10M', memory: '123 GB → 20 GB', latency: '-', recall: '-' },
      metricTones: { memory: 'good' },
      scene: {
        nodes: [
          { ...embedder, at: at(-3.6, 0), load: 60, chips: ['3072 dims'] },
          { id: 'cut', kind: 'block', size: 0.8, at: at(0, 0), label: 'truncate', sub: 'first 512, renormalize', icon: 'Scale', tint: 'green', status: 'ok' },
          { ...store, at: at(3.6, 0), sub: '512 dims', chips: [{ text: '6x smaller', tone: 'good' }] },
        ],
        links: [link('embedder', 'cut'), link('cut', 'store')],
        flows: [
          { path: ['embedder', 'cut'], tone: 'data', label: '3072 floats', duration: 1.4 },
          { path: ['cut', 'store'], tone: 'data', label: '512 floats', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: '10M vectors, float32',
          icon: 'HardDrive',
          rows: [
            { text: '3072 dims', value: '123 GB', tone: 'bad' },
            { text: '1536 dims', value: '61 GB', tone: 'warn' },
            { text: '1024 dims', value: '41 GB' },
            { text: '512 dims', value: '20 GB', tone: 'good' },
          ],
          footer: { text: 'Raw vectors only. Renormalize after truncating', tone: 'muted' },
        },
        caption: 'Same corpus, six times less to hold',
      },
    },
    {
      title: 'Memory math',
      tag: 'concept',
      heading: 'Budget memory before you pick an index',
      eli5: 'Before buying shelves, the librarian counts the books and measures one. Ten million books at this thickness need a very large room.',
      body: [
        'Raw size is `vectors × dimensions × bytes per value`. Float32 is 4 bytes, so 10M × 1536 × 4 = **61 GB**. An index adds its own structure on top, and most fast indexes want the vectors in RAM.',
        'Storing values at lower precision shrinks it: float16 halves it to 31 GB and int8 quarters it to 15 GB, at some cost in accuracy. This arithmetic decides which index you can afford.',
      ],
      keyIdea: 'Compute vectors × dimensions × bytes first. Memory, not CPU, usually picks the index.',
      metrics: { vectors: '10M', memory: '61 GB', latency: '-', recall: '-' },
      metricTones: { memory: 'warn' },
      scene: {
        nodes: [
          { id: 'f32', kind: 'block', size: 0.8, at: at(-4, 0), label: 'float32', sub: '4 bytes', icon: 'HardDrive', tint: 'red' },
          { id: 'f16', kind: 'block', size: 0.8, at: at(0, 0), label: 'float16', sub: '2 bytes', icon: 'HardDrive', tint: 'amber' },
          { id: 'i8', kind: 'block', size: 0.8, at: at(4, 0), label: 'int8', sub: '1 byte', icon: 'HardDrive', tint: 'green', status: 'ok' },
        ],
        links: [link('f32', 'f16', { label: 'half', arrow: 'end' }), link('f16', 'i8', { label: 'half again' })],
        flows: [
          { path: ['f32', 'f16'], tone: 'data', label: '61 → 31 GB', duration: 1.5 },
          { path: ['f16', 'i8'], tone: 'data', label: '31 → 15 GB', duration: 1.5, delay: 1.6 },
        ],
        panel: {
          title: '10M × 1536 dims',
          icon: 'Table',
          rows: [
            { text: 'float32 (4 B)', value: '61 GB', tone: 'bad' },
            { text: 'float16 (2 B)', value: '31 GB', tone: 'warn' },
            { text: 'int8 (1 B)', value: '15 GB', tone: 'good' },
          ],
          footer: { text: 'Lower precision costs some accuracy', tone: 'muted' },
        },
        caption: 'Bytes per value sets the bill',
      },
      code: {
        language: 'python',
        title: 'A memory budget in three lines',
        source: `def raw_gb(n_vectors: int, dims: int, bytes_per_value: int) -> float:
    return n_vectors * dims * bytes_per_value / 1e9

print(raw_gb(10_000_000, 1536, 4))   # 61.4 GB float32
print(raw_gb(10_000_000, 1536, 2))   # 30.7 GB float16
print(raw_gb(10_000_000, 512, 4))    # 20.5 GB truncated`,
        highlight: [2, 4],
      },
    },
    {
      title: 'Flat search',
      tag: 'concept',
      heading: 'Flat search is exact, and it is the baseline',
      eli5: 'The librarian walks every shelf and compares every book to yours. It is slow, but she never misses the best match.',
      body: [
        'A **flat index** stores every vector and scans them all for each query. It returns the exact nearest neighbors and costs `O(n)` per query.',
        'It is a fine answer up to about 100K vectors. Below roughly 10K vectors, a numpy array in memory is all you need and a database is overhead. Flat search is also the ground truth we measure every faster index against.',
      ],
      keyIdea: 'Flat search is exact and simple. It stops being affordable somewhere past 100K vectors.',
      metrics: { vectors: '50K', memory: '307 MB', latency: '8 ms', recall: '100%' },
      metricTones: { recall: 'good', latency: 'good' },
      scene: {
        nodes: [
          { ...user, chips: ['query'] },
          { id: 'flat', kind: 'block', at: at(0, -1.8), label: 'flat index', sub: 'scan all 50K', icon: 'List', tint: 'blue', status: 'active', load: 35 },
          { id: 'top', kind: 'block', size: 0.8, at: at(4.2, -1.8), label: 'top 10', sub: 'exact', icon: 'Star', tint: 'green', status: 'ok' },
        ],
        links: [link('user', 'flat'), link('flat', 'top')],
        flows: [
          { path: ['user', 'flat'], tone: 'request', label: 'query vector', duration: 1.2 },
          { path: ['flat', 'top'], tone: 'response', label: 'exact top 10', duration: 1.3, delay: 1.3 },
        ],
        panel: {
          title: 'Where flat search is fine',
          icon: 'Gauge',
          rows: [
            { text: 'Under 10K vectors', value: 'numpy array', tone: 'good' },
            { text: 'Up to about 100K', value: 'flat index', tone: 'good' },
            { text: '1M and up', value: 'needs an ANN index', tone: 'warn' },
          ],
        },
        caption: 'Every query reads every vector',
      },
      code: {
        language: 'python',
        title: 'Exact top-k in numpy',
        source: `import numpy as np

# vectors: (n, dims) array of unit vectors, query: (dims,)
def flat_top_k(vectors: np.ndarray, query: np.ndarray, k: int = 10):
    scores = vectors @ query                  # n dot products
    top = np.argpartition(-scores, k)[:k]     # k best, unordered
    return top[np.argsort(-scores[top])]      # order them`,
        highlight: [5, 6],
      },
    },
    {
      title: 'Approximate',
      tag: 'concept',
      heading: 'ANN trades a little accuracy for a lot of speed',
      eli5: 'Instead of checking every book, the librarian uses signs on the shelves to walk straight to the right corner. She might miss the very best match once in a while, but she is much faster.',
      body: [
        '**Approximate nearest neighbor (ANN)** indexes organize vectors so a query looks at a small slice of them. The price is that the answer may skip a true neighbor.',
        'We score that with **recall@k**: of the true top-k, how many did the index return? Recall 0.95 at k=10 means about 9.5 of the 10 true neighbors came back. Every ANN index is a recall versus speed versus memory deal.',
      ],
      keyIdea: 'ANN gives up exactness for speed. Recall@k is the number that tells you how much you gave up.',
      metrics: { vectors: '10M', memory: '62 GB', latency: '5 ms', recall: '95%' },
      metricTones: { latency: 'good', recall: 'good' },
      scene: {
        nodes: [
          { ...user, chips: ['query'] },
          { id: 'ann', kind: 'block', at: at(0, -1.8), label: 'ANN index', sub: 'looks at a slice', icon: 'Route', tint: 'teal', status: 'active', load: 30 },
          { id: 'top', kind: 'block', size: 0.8, at: at(4.2, -1.8), label: 'top 10', sub: '9.5 of 10 right', icon: 'Star', tint: 'green', status: 'ok' },
        ],
        links: [link('user', 'ann'), link('ann', 'top')],
        flows: [
          { path: ['user', 'ann'], tone: 'request', label: 'query vector', duration: 1.2 },
          { path: ['ann', 'top'], tone: 'response', label: 'near-exact top 10', duration: 1.3, delay: 1.3 },
        ],
        panel: {
          title: 'Exact versus approximate',
          icon: 'Table',
          rows: [
            { text: 'Flat: vectors read', value: '10,000,000', tone: 'bad' },
            { text: 'ANN: vectors read', value: '~20,000', tone: 'good' },
            { text: 'Flat recall@10', value: '1.00' },
            { text: 'ANN recall@10', value: '~0.95', tone: 'warn' },
          ],
          footer: { text: 'Illustrative numbers for 10M vectors', tone: 'muted' },
        },
        caption: 'A small slice instead of the whole corpus',
      },
      quiz: {
        question: 'An ANN index reports recall@10 of 0.90. What does that mean?',
        options: [
          'Queries finish in 90% less time than flat search',
          'On average, 9 of the true 10 nearest neighbors are returned',
          'The index uses 90% of the memory of a flat index',
          '90% of queries return exactly the right 10',
        ],
        answer: 1,
        explain: 'Recall@k counts how many of the true top-k neighbors the index found. 0.90 at k=10 means 9 of 10 on average. It says nothing directly about speed or memory.',
      },
    },
    {
      title: 'HNSW',
      tag: 'concept',
      heading: 'HNSW walks a layered graph toward the query',
      eli5: 'The library has a few big highways between far towns, then city streets, then house-by-house lanes. The librarian takes the highway first, then the streets, then the lane to the right door.',
      body: [
        '**HNSW** (Hierarchical Navigable Small World) links each vector to a few near neighbors. Upper layers hold only a sample of the vectors with long links, and the bottom layer holds all of them.',
        'A query enters at the top, greedily hops to whichever neighbor is closer to it, and drops a layer when it cannot improve. Each layer needs only a few hops, so the search stays fast as the corpus grows.',
      ],
      keyIdea: 'HNSW is the default in most vector databases: fast and high recall, but every full vector must sit in RAM.',
      metrics: { vectors: '10M', memory: '62 GB', latency: '5 ms', recall: '95%' },
      metricTones: { latency: 'good', recall: 'good' },
      scene: {
        nodes: [
          { ...user, at: at(-4.8, 0), chips: ['query'] },
          { id: 'l2', kind: 'block', size: 0.75, at: at(-1.6, 0), label: 'layer 2', sub: 'few nodes', icon: 'Network', tint: 'violet' },
          { id: 'l1', kind: 'block', size: 0.75, at: at(1.6, 0), label: 'layer 1', sub: 'more nodes', icon: 'Network', tint: 'blue' },
          { id: 'l0', kind: 'block', size: 0.75, at: at(4.8, 0), label: 'layer 0', sub: 'every vector', icon: 'Network', tint: 'teal', status: 'active' },
        ],
        links: [link('user', 'l2'), link('l2', 'l1', { label: 'drop down' }), link('l1', 'l0', { label: 'drop down' })],
        flows: [
          { path: ['user', 'l2'], tone: 'request', label: 'enter', duration: 1 },
          { path: ['l2', 'l1'], tone: 'request', label: 'hop, hop', duration: 1, delay: 1.1 },
          { path: ['l1', 'l0'], tone: 'request', label: 'hop, hop', duration: 1, delay: 2.2 },
        ],
        panel: {
          title: 'One query, three layers',
          icon: 'Route',
          rows: [
            { text: 'Layer 2', value: 'long jumps, ~1% of nodes' },
            { text: 'Layer 1', value: 'shorter jumps' },
            { text: 'Layer 0', value: 'all vectors, short links', tone: 'good' },
            { text: 'Graph overhead', value: '~M×2×4 bytes per vector' },
          ],
          footer: { text: 'Real cost: all full vectors stay in RAM', tone: 'warn' },
        },
        caption: 'Greedy hops, one layer at a time',
      },
    },
    {
      title: 'HNSW knobs',
      tag: 'tradeoff',
      heading: 'Three HNSW settings move recall, speed and memory',
      eli5: 'The librarian can leave more signposts between shelves, take more time to hang them, or look at more shelves before answering. Each choice costs something different.',
      body: [
        '`M` is how many links each node keeps: more links give better recall and use more RAM. `efConstruction` is how hard the build searches for each node\'s neighbors: higher is slower to build and a better graph.',
        '`efSearch` is how many candidates a query tracks. Raising it increases recall and latency together, and you can change it per query without rebuilding.',
      ],
      keyIdea: 'Tune efSearch first. It is the only knob you can turn at query time.',
      metrics: { vectors: '10M', memory: '62 GB', latency: '5 → 12 ms', recall: '95 → 99%' },
      metricTones: { recall: 'good', latency: 'warn' },
      scene: {
        nodes: [
          { ...user, chips: ['efSearch = 200'] },
          { id: 'hnsw', kind: 'block', at: at(0, -1.8), label: 'HNSW index', sub: 'M=16, ef=64', icon: 'Network', tint: 'teal', status: 'active', load: 45 },
          { id: 'top', kind: 'block', size: 0.8, at: at(4.2, -1.8), label: 'top 10', sub: 'recall 99%', icon: 'Star', tint: 'green', status: 'ok' },
        ],
        links: [link('user', 'hnsw'), link('hnsw', 'top')],
        flows: [
          { path: ['user', 'hnsw'], tone: 'request', label: 'q + efSearch', duration: 1.2 },
          { path: ['hnsw', 'top'], tone: 'response', label: 'top 10', duration: 1.3, delay: 1.3 },
        ],
        panel: {
          title: 'Effect of efSearch (example)',
          icon: 'Table',
          rows: [
            { text: 'efSearch 20', value: '3 ms, recall 0.90', tone: 'warn' },
            { text: 'efSearch 64', value: '5 ms, recall 0.95' },
            { text: 'efSearch 200', value: '12 ms, recall 0.99', tone: 'good' },
          ],
          footer: { text: 'Numbers are illustrative, measure your own', tone: 'muted' },
        },
        caption: 'Search effort is a runtime dial',
      },
      code: {
        language: 'sql',
        title: 'HNSW in pgvector',
        source: `CREATE INDEX chunks_embedding_idx
  ON chunks USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);     -- fixed at build time

-- per session or per query, no rebuild needed
SET hnsw.ef_search = 100;

SELECT id, text
FROM chunks
ORDER BY embedding <=> $1                  -- cosine distance
LIMIT 10;`,
        highlight: [3, 6],
      },
    },
    {
      title: 'Measure recall',
      tag: 'concept',
      heading: 'Measure recall against flat search before you trust it',
      eli5: 'To check the signs on the shelves work, the librarian runs a test: find books the slow way, then the fast way, and count how many match.',
      body: [
        'Take a sample of real queries, say 1,000. Run each through a flat index to get the true top-10, then through the ANN index, and count the overlap. That average is your recall@10.',
        'Plot recall against latency as you change `efSearch` (or `nprobe`). Pick the cheapest setting that meets your target. Re-run it when the data or the embedding model changes.',
      ],
      keyIdea: 'Do not guess recall. Compute it from a flat-search ground truth on your own queries.',
      metrics: { vectors: '10M', memory: '62 GB', latency: '5 ms', recall: '95%' },
      metricTones: { recall: 'good' },
      scene: {
        nodes: [
          { id: 'queries', kind: 'block', size: 0.8, at: at(-4.2, 0), label: '1,000 queries', sub: 'real traffic sample', icon: 'FileText', tint: 'violet' },
          { id: 'flat', kind: 'block', size: 0.8, at: at(0, -2.4), label: 'flat index', sub: 'ground truth', icon: 'List', tint: 'blue' },
          { id: 'ann', kind: 'block', size: 0.8, at: at(0, 2.4), label: 'ANN index', sub: 'candidate', icon: 'Network', tint: 'teal' },
          { id: 'score', kind: 'block', size: 0.8, at: at(4.2, 0), label: 'overlap', sub: 'recall@10', icon: 'Gauge', tint: 'green', status: 'ok' },
        ],
        links: [link('queries', 'flat'), link('queries', 'ann'), link('flat', 'score'), link('ann', 'score')],
        flows: [
          { path: ['queries', 'flat', 'score'], tone: 'data', label: 'true top 10', duration: 2 },
          { path: ['queries', 'ann', 'score'], tone: 'data', label: 'ANN top 10', duration: 2, delay: 0.4 },
        ],
        panel: {
          title: 'One query',
          icon: 'Table',
          rows: [
            { text: 'True top 10 (flat)', value: '10 ids' },
            { text: 'ANN returned', value: '10 ids' },
            { text: 'Overlap', value: '9', tone: 'good' },
          ],
          footer: { text: 'Average the overlap over all queries', tone: 'muted' },
        },
        caption: 'Ground truth first, then compare',
      },
      code: {
        language: 'python',
        title: 'recall@10 from a flat-search ground truth',
        source: `def recall_at_k(queries, flat_index, ann_index, k=10):
    hits = 0
    for q in queries:
        truth = set(flat_index.search(q, k))   # exact top-k
        found = set(ann_index.search(q, k))    # approximate top-k
        hits += len(truth & found)
    return hits / (len(queries) * k)

print(recall_at_k(sample_queries, flat, hnsw))   # e.g. 0.95`,
        highlight: [4, 5, 6],
      },
    },
    {
      title: 'IVF',
      tag: 'concept',
      heading: 'IVF searches only the nearest few cells',
      eli5: 'The librarian sorts all books into 4,096 rooms by topic. To answer a question she walks into the 8 rooms nearest to it and ignores the rest.',
      body: [
        '**IVF** (inverted file) clusters the vectors into cells around centroids, such as 4,096 of them. At query time it finds the `nprobe` nearest centroids and scans only the vectors in those cells.',
        'With `nprobe = 8` that is about 0.2% of 10M, near 20K vectors. It saves compute, not memory, since plain IVF still stores full float32 vectors. Recall is lower than HNSW, because a true neighbor can sit in a cell you did not visit.',
      ],
      keyIdea: 'IVF narrows the scan to a few cells. Raise nprobe for recall, lower it for speed.',
      metrics: { vectors: '10M', memory: '61 GB', latency: '8 ms', recall: '90%' },
      metricTones: { recall: 'warn' },
      scene: {
        nodes: [
          { ...user, chips: ['query'] },
          { id: 'centroids', kind: 'block', size: 0.8, at: at(0, -1.8), label: 'centroids', sub: '4,096 cells', icon: 'Boxes', tint: 'violet', status: 'active' },
          { id: 'cells', kind: 'block', size: 0.8, at: at(4.2, -1.8), label: '8 cells', sub: '~20K vectors', icon: 'Layers', tint: 'teal', status: 'ok', chips: ['nprobe = 8'] },
        ],
        links: [link('user', 'centroids'), link('centroids', 'cells', { label: 'nearest 8' })],
        flows: [
          { path: ['user', 'centroids'], tone: 'request', label: 'query vector', duration: 1.2 },
          { path: ['centroids', 'cells'], tone: 'request', label: 'scan 8 cells', duration: 1.3, delay: 1.3 },
        ],
        panel: {
          title: 'IVF with 10M vectors',
          icon: 'Table',
          rows: [
            { text: 'Cells (nlist)', value: '4,096' },
            { text: 'Vectors per cell', value: '~2,400' },
            { text: 'Cells scanned (nprobe)', value: '8' },
            { text: 'Vectors scanned', value: '~20K (0.2%)', tone: 'good' },
            { text: 'Miss risk', value: 'neighbor in another cell', tone: 'warn' },
          ],
        },
        caption: 'Pick the nearest rooms, skip the rest',
      },
    },
    {
      title: 'Compression',
      tag: 'concept',
      heading: 'Product quantization shrinks each vector to a short code',
      eli5: 'Instead of keeping each book, the librarian keeps a tiny label that says "roughly this shape". Thousands of labels fit on one small shelf.',
      body: [
        '**Product quantization (PQ)** splits a vector into parts, say 96 parts of 16 numbers, and replaces each part with a one-byte id from a small codebook. A 6,144-byte vector becomes **96 bytes**, 64 times smaller.',
        '**IVF-PQ** combines both ideas: cells to skip most vectors, codes to fit the rest in RAM. Distances are estimated from the codes, so recall drops a little. That is how billion-scale search fits on ordinary machines.',
      ],
      keyIdea: 'PQ gives up some accuracy for a huge memory saving. IVF-PQ is the classic billion-vector index.',
      metrics: { vectors: '10M', memory: '61 GB → 1 GB', latency: '10 ms', recall: '88%' },
      metricTones: { memory: 'good', recall: 'warn' },
      scene: {
        nodes: [
          { id: 'full', kind: 'block', size: 0.8, at: at(-4, 0), label: 'full vector', sub: '6,144 bytes', icon: 'HardDrive', tint: 'red' },
          { id: 'pq', kind: 'block', size: 0.8, at: at(0, 0), label: 'quantizer', sub: '96 parts × 1 byte', icon: 'Binary', tint: 'amber', status: 'active' },
          { id: 'code', kind: 'block', size: 0.8, at: at(4, 0), label: 'PQ code', sub: '96 bytes', icon: 'Hash', tint: 'green', status: 'ok' },
        ],
        links: [link('full', 'pq'), link('pq', 'code')],
        flows: [
          { path: ['full', 'pq'], tone: 'data', label: '1536 floats', duration: 1.4 },
          { path: ['pq', 'code'], tone: 'data', label: '96 bytes', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: '10M vectors, 1536 dims',
          icon: 'Table',
          rows: [
            { text: 'Flat float32', value: '61 GB', tone: 'bad' },
            { text: 'IVF-PQ codes', value: '~1 GB', tone: 'good' },
            { text: 'Recall cost', value: 'a few points lower', tone: 'warn' },
          ],
          footer: { text: 'Codebooks are trained on a sample', tone: 'muted' },
        },
        caption: '64 times smaller per vector',
      },
      quiz: {
        question: 'You must serve 2 billion vectors on commodity machines and cannot hold float32 vectors in RAM. Which index family fits best?',
        options: [
          'Flat index with more CPUs',
          'HNSW with float32 vectors on one big server',
          'IVF-PQ or a disk-based index',
          'A numpy array sharded by user id',
        ],
        answer: 2,
        explain: '2 billion × 1536 × 4 bytes is about 12 TB. IVF-PQ compresses each vector to a short code, and disk-based indexes keep most data on SSD. Flat and float32 HNSW both need far more RAM than commodity machines have.',
      },
    },
    {
      title: 'Disk indexes',
      tag: 'concept',
      heading: 'DiskANN moves the corpus onto SSD',
      eli5: 'Only a small index card for each book stays on the desk. The books themselves live in a big warehouse down the road, and the librarian fetches just the few she needs.',
      body: [
        '**DiskANN** keeps a compressed copy of the vectors in RAM to guide the search, and the graph and full vectors on SSD. A query reads a handful of SSD pages and then re-scores with full precision.',
        'The trade is cost per vector: less RAM, a bit more latency, at the billion scale. Google\'s **ScaNN** is a different thing, a quantization-based ANN library that usually runs in memory.',
      ],
      keyIdea: 'Disk-based indexes trade a few milliseconds of latency for a much lower cost per vector.',
      metrics: { vectors: '10M', memory: '~3 GB RAM', latency: '15 ms', recall: '95%' },
      metricTones: { memory: 'good', latency: 'warn' },
      scene: {
        nodes: [
          { ...user, chips: ['query'] },
          { id: 'ram', kind: 'block', size: 0.8, at: at(0, -1.8), label: 'RAM', sub: 'compressed guide', icon: 'Cpu', tint: 'amber', status: 'active' },
          { id: 'ssd', kind: 'block', size: 0.8, at: at(4.2, -1.8), label: 'SSD', sub: 'graph + full vectors', icon: 'HardDrive', tint: 'gray' },
        ],
        links: [link('user', 'ram'), link('ram', 'ssd', { label: 'few page reads', labelTone: 'warn' })],
        flows: [
          { path: ['user', 'ram'], tone: 'request', label: 'query', duration: 1.1 },
          { path: ['ram', 'ssd'], tone: 'request', label: 'read pages', duration: 1.3, delay: 1.2 },
          { path: ['ssd', 'user'], tone: 'response', label: 're-scored top 10', duration: 2, delay: 2.6 },
        ],
        panel: {
          title: 'Where the bytes live',
          icon: 'HardDrive',
          rows: [
            { text: 'Compressed vectors', value: 'RAM', tone: 'good' },
            { text: 'Graph + full vectors', value: 'SSD' },
            { text: 'Query reads', value: 'a few SSD pages', tone: 'warn' },
          ],
          footer: { text: 'Lower cost per vector, slower per query', tone: 'muted' },
        },
        caption: 'Small guide in RAM, bulk on SSD',
      },
    },
    {
      title: 'Pick an index',
      tag: 'tradeoff',
      heading: 'Pick the index from your size and your latency budget',
      eli5: 'A small shelf needs no signs. A busy library wants the best signs and lots of space. A giant warehouse needs labels and a cheap building.',
      body: [
        'Start from the memory math. If the vectors fit in RAM and you want the best recall and speed, use **HNSW**. If memory is tight, use **IVF-PQ**, since plain IVF only saves compute. If the corpus is huge and cost matters, use a **disk-based** index.',
        'Under 100K vectors, stay with flat. Whatever you choose, measure recall on your own data with the steps above.',
      ],
      keyIdea: 'Size and budget pick the index: flat when small, HNSW when it fits in RAM, IVF-PQ or disk when it does not.',
      metrics: { vectors: '10M', memory: '62 GB', latency: '5 ms', recall: '95%' },
      scene: {
        nodes: [
          { id: 'small', kind: 'block', size: 0.75, at: at(-4.8, 0), label: 'under 100K', sub: 'flat', icon: 'List', tint: 'blue' },
          { id: 'ram', kind: 'block', size: 0.75, at: at(-1.6, 0), label: 'fits in RAM', sub: 'HNSW', icon: 'Network', tint: 'teal', status: 'ok' },
          { id: 'tight', kind: 'block', size: 0.75, at: at(1.6, 0), label: 'RAM is tight', sub: 'IVF-PQ', icon: 'Binary', tint: 'amber' },
          { id: 'huge', kind: 'block', size: 0.75, at: at(4.8, 0), label: 'huge, cheap', sub: 'DiskANN', icon: 'HardDrive', tint: 'gray' },
        ],
        links: [],
        flows: [],
        panel: {
          title: 'Index cheat sheet',
          icon: 'Table',
          rows: [
            { text: 'Flat', value: 'exact, O(n)' },
            { text: 'HNSW', value: 'fast, high recall, high RAM', tone: 'good' },
            { text: 'IVF', value: 'less compute, same RAM' },
            { text: 'IVF-PQ', value: 'cuts RAM, some loss', tone: 'warn' },
            { text: 'DiskANN', value: 'SSD, low cost per vector' },
          ],
        },
        caption: 'Four indexes, four sizes of problem',
      },
    },
    {
      title: 'Metadata filters',
      tag: 'concept',
      heading: 'Real queries mix similarity with filters',
      eli5: 'Visitors say "find a book like this one, but only from the children\'s room, and only ones published after 2020." The librarian must honor both rules.',
      body: [
        'Production queries look like "similar to X where `user_id = 42` and `created_at` is after 2024". Every chunk therefore carries metadata: source, section, page, date and a permissions tag.',
        'Without that metadata you cannot restrict results to what a user is allowed to see. When to apply the filter matters: before the search (**pre-filter**) or after it (**post-filter**). The SQL below is the query shape only. pgvector filters after the index scan, which the next step shows can fail.',
      ],
      keyIdea: 'Filters are part of the query, not an afterthought. Permissions depend on them.',
      metrics: { vectors: '10M', memory: '62 GB', latency: '5 ms', recall: '95%' },
      scene: {
        nodes: [
          { ...user, chips: ['user_id = 42'] },
          { ...store, at: at(0, -1.8), sub: 'vectors + metadata' },
          { id: 'meta', kind: 'block', size: 0.8, at: at(4.2, -1.8), label: 'metadata', sub: 'per chunk', icon: 'Table', tint: 'violet' },
        ],
        links: [link('user', 'store'), link('store', 'meta', { arrow: 'both' })],
        flows: [
          { path: ['user', 'store'], tone: 'request', label: 'q + filter', duration: 1.3 },
          { path: ['store', 'meta'], tone: 'request', label: 'check fields', duration: 1.2, delay: 1.4 },
        ],
        panel: {
          title: 'Stored with each chunk',
          icon: 'List',
          code: 'source_id, doc_title, section, page,\ncreated_at, author, chunk_index,\npermissions_tag, embedding_model',
          footer: { text: 'These fields drive every filter', tone: 'muted' },
        },
        caption: 'Similarity plus rules',
      },
      code: {
        language: 'sql',
        title: 'A filtered similarity query',
        source: `SELECT id, text
FROM chunks
WHERE user_id = 42                      -- filtered AFTER the HNSW scan in pgvector
  AND created_at > '2024-01-01'
ORDER BY embedding <=> $1               -- nearest first
LIMIT 10;
-- may return under 10 rows. Mitigate: raise hnsw.ef_search,
-- hnsw.iterative_scan (pgvector 0.8+), partial index or partition per tenant`,
        highlight: [3, 4, 5],
      },
    },
    {
      title: 'Empty results',
      tag: 'case',
      heading: 'Case: post-filtering can return nothing at all',
      eli5: 'The librarian grabs the 10 closest books from the whole library, then throws away everything outside your room. If none of the 10 were in your room, you leave with empty hands.',
      body: [
        'User 42 owns 2,000 of the 10M chunks, 0.02%. With **post-filtering**, the index returns the global top 10, then drops chunks that are not user 42\'s. Chance says almost all 10 are dropped, and the user gets an empty answer.',
        '**Pre-filtering** applies the rule first: with only 2,000 candidates, a plain flat scan is exact and cheap. Many stores also filter while they walk the index, which keeps recall for selective filters.',
      ],
      keyIdea: 'Selective filters break post-filtering. Filter first, or use a store that filters inside the index.',
      metrics: { vectors: '10M', memory: '62 GB', latency: '5 ms', recall: '0 results' },
      metricTones: { recall: 'bad' },
      scene: {
        nodes: [
          { ...user, chips: ['user_id = 42'] },
          { id: 'ann', kind: 'block', size: 0.8, at: at(0, -1.8), label: 'ANN top 10', sub: 'whole corpus', icon: 'Network', tint: 'teal' },
          { id: 'filter', kind: 'block', size: 0.8, at: at(4.2, -1.8), label: 'filter', sub: 'user_id = 42', icon: 'Shield', tint: 'red', status: 'down', badge: '0 left' },
        ],
        links: [link('user', 'ann'), link('ann', 'filter', { label: 'post-filter', labelTone: 'warn' })],
        flows: [
          { path: ['user', 'ann'], tone: 'request', label: 'q', duration: 1.1 },
          { path: ['ann', 'filter'], tone: 'data', label: '10 chunks', duration: 1.2, delay: 1.2 },
          { path: ['filter', 'user'], tone: 'error', label: '[]', duration: 2.2, delay: 2.6 },
        ],
        panel: {
          title: 'Pre versus post filter',
          icon: 'Table',
          rows: [
            { text: 'Post-filter, user 42', value: '~0 of 10 survive', tone: 'bad' },
            { text: 'Pre-filter, user 42', value: '2,000 candidates, flat scan', tone: 'good' },
            { text: 'In-index filtering', value: 'walks only matching nodes', tone: 'good' },
          ],
          footer: { text: 'Post-filter is safe only for loose filters', tone: 'warn' },
        },
        caption: 'The top 10 had nothing for this user',
      },
      quiz: {
        question: 'A tenant owns 0.02% of the vectors. Why does post-filtering often return an empty result for that tenant?',
        options: [
          'Post-filtering is slower than pre-filtering',
          'The global top-k almost never contains that tenant\'s chunks, so filtering removes them all',
          'The ANN index cannot store metadata',
          'Cosine similarity ignores the filter',
        ],
        answer: 1,
        explain: 'The index picks the nearest k vectors from the whole corpus first. If the tenant owns a tiny share, most or all of those k belong to others and get dropped. Filtering first, or inside the index, avoids it.',
      },
    },
    {
      title: 'Hybrid search',
      tag: 'concept',
      heading: 'Hybrid search adds keywords to meaning',
      eli5: 'One librarian finds books about the same idea. Another looks up exact words on the index cards. A good library asks both and merges the two lists.',
      body: [
        '**Dense** (vector) search finds meaning matches. **Sparse** (BM25 keyword) search finds exact tokens: product codes, names, acronyms. Dense misses `ERR-4417`, and sparse misses a paraphrase.',
        'Run both, then merge with **Reciprocal Rank Fusion (RRF)**: each list gives a document `1 / (60 + rank)`, and the scores add up. It uses ranks, so you never need to compare scores from different systems.',
      ],
      keyIdea: 'Hybrid beats dense-only on most enterprise search because exact words and meaning fail on different queries.',
      metrics: { vectors: '10M', memory: '62 GB', latency: '12 ms', recall: '95%' },
      scene: {
        nodes: [
          { ...user, at: at(-4.2, 0), chips: ['ERR-4417 timeout'] },
          { id: 'dense', kind: 'block', size: 0.8, at: at(0, -2.4), label: 'dense', sub: 'vector search', icon: 'Network', tint: 'teal' },
          { id: 'sparse', kind: 'block', size: 0.8, at: at(0, 2.4), label: 'sparse', sub: 'BM25 keywords', icon: 'Search', tint: 'blue' },
          { id: 'rrf', kind: 'block', size: 0.8, at: at(4.2, 0), label: 'RRF merge', sub: 'one ranked list', icon: 'Layers', tint: 'green', status: 'ok' },
        ],
        links: [link('user', 'dense'), link('user', 'sparse'), link('dense', 'rrf'), link('sparse', 'rrf')],
        flows: [
          { path: ['user', 'dense', 'rrf'], tone: 'request', label: 'meaning', duration: 2 },
          { path: ['user', 'sparse', 'rrf'], tone: 'request', label: 'keywords', duration: 2, delay: 0.3 },
        ],
        panel: {
          title: 'RRF scores, k = 60',
          icon: 'Table',
          rows: [
            { text: 'Doc A: dense #1, sparse #3', value: '0.0323', tone: 'good' },
            { text: 'Doc C: sparse #1 only', value: '0.0164' },
            { text: 'Doc B: dense #2 only', value: '0.0161' },
          ],
          footer: { text: 'Both lists agree on A, so A wins', tone: 'muted' },
        },
        caption: 'Two searches, one merged ranking',
      },
      code: {
        language: 'python',
        title: 'Reciprocal Rank Fusion',
        source: `def rrf(rankings: list[list[str]], k: int = 60) -> list[str]:
    scores: dict[str, float] = {}
    for ranking in rankings:
        for rank, doc_id in enumerate(ranking, start=1):
            scores[doc_id] = scores.get(doc_id, 0.0) + 1.0 / (k + rank)
    return sorted(scores, key=scores.get, reverse=True)

merged = rrf([dense_ids, sparse_ids])   # e.g. ["A", "C", "B"]`,
        highlight: [5, 8],
      },
    },
    {
      title: 'Rerank',
      tag: 'concept',
      heading: 'A reranker re-reads the shortlist',
      eli5: 'The librarian pulls 100 likely books fast. Then an expert sits down and reads your question next to each one, and picks the best five.',
      body: [
        'Embeddings squeeze each text into one vector, which loses detail. A **cross-encoder reranker** reads the query and one document together and outputs a relevance score. That is more accurate and far too slow to run on millions.',
        'So retrieve 50 to 200 candidates with the vector index, rerank them, and keep the top 5 to 10. It adds roughly 100 to 300 ms for the top 100 and often helps more than a better embedding model.',
      ],
      keyIdea: 'The vector index is a cheap, wide net. The reranker is a slower, sharper second look at the catch.',
      metrics: { vectors: '10M', memory: '62 GB', latency: '5 → 150 ms', recall: '95%' },
      metricTones: { latency: 'warn' },
      scene: {
        nodes: [
          { ...store, at: at(-4.2, 0), sub: 'ANN + hybrid', status: 'active' },
          { id: 'reranker', kind: 'block', at: at(0, 0), label: 'reranker', sub: 'cross-encoder, GPU', icon: 'Scale', tint: 'amber', status: 'hot', load: 72 },
          { id: 'llm', kind: 'block', size: 0.8, at: at(4.2, 0), label: 'LLM', sub: 'answers', icon: 'Zap', tint: 'violet' },
        ],
        links: [link('store', 'reranker', { label: 'top 100' }), link('reranker', 'llm', { label: 'top 5' })],
        flows: [
          { path: ['store', 'reranker'], tone: 'data', label: '100 chunks', count: 3, duration: 1.4 },
          { path: ['reranker', 'llm'], tone: 'data', label: '5 chunks', duration: 1.2, delay: 1.5 },
        ],
        panel: {
          title: 'Two stages',
          icon: 'Table',
          rows: [
            { text: 'Vector search', value: '10M → 100', tone: 'good' },
            { text: 'Rerank', value: '100 → 5' },
            { text: 'Added latency', value: '~100 to 300 ms', tone: 'warn' },
          ],
          footer: { text: 'Own lesson later in this chapter', tone: 'muted' },
        },
        caption: 'Wide net, then a careful look',
      },
    },
    {
      title: 'Choose a store',
      tag: 'tradeoff',
      heading: 'Pick the store that fits what you already run',
      eli5: 'You can rent a ready-made library, build your own, or add a bookshelf to a room you already have. The right choice depends on how many books and who will look after them.',
      body: [
        'Managed services such as **Pinecone** need almost no ops. **Qdrant**, **Weaviate** and **Milvus** are open source with cloud options, strong at filtering and scale. **Chroma** suits prototypes. Teams already on **Elasticsearch** or **OpenSearch** can keep BM25 and vectors in one place.',
        '**pgvector** adds vectors to Postgres, which wins when you already run it and want transactions, to about 10M vectors. **Turbopuffer** and **LanceDB** trade latency for low cost at scale.',
      ],
      keyIdea: 'Prefer the store you already operate until its limits show. Move when scale, filtering or cost demand it.',
      metrics: { vectors: '10M', memory: '62 GB', latency: '5 ms', recall: '95%' },
      scene: {
        nodes: [
          { id: 'app', kind: 'block', size: 0.8, at: at(-4.4, 0), label: 'your app', sub: 'needs vectors', icon: 'Code', tint: 'violet' },
          { id: 'pg', kind: 'block', size: 0.75, at: at(0, -2.4), label: 'pgvector', sub: 'in Postgres', icon: 'Database', tint: 'blue' },
          { id: 'oss', kind: 'block', size: 0.75, at: at(0, 2.4), label: 'Qdrant / Milvus', sub: 'self-host or cloud', icon: 'Boxes', tint: 'teal' },
          { id: 'managed', kind: 'block', size: 0.75, at: at(4.4, 0), label: 'Pinecone', sub: 'fully managed', icon: 'Server', tint: 'green' },
        ],
        links: [link('app', 'pg'), link('app', 'oss'), link('app', 'managed', { style: 'faint' })],
        flows: [],
        panel: {
          title: 'Ask this first',
          icon: 'Table',
          rows: [
            { text: 'pgvector', value: 'Already on Postgres, under ~10M?' },
            { text: 'Elasticsearch / OpenSearch', value: 'Already run it, BM25 + vectors together?' },
            { text: 'Qdrant, Weaviate', value: 'Need heavy filtering, self-host?' },
            { text: 'Milvus', value: 'Billions of vectors?' },
            { text: 'Pinecone', value: 'Want zero ops?' },
            { text: 'Turbopuffer, LanceDB', value: 'Is cost at huge scale the issue?' },
          ],
        },
        caption: 'Same job, different operating cost',
      },
    },
    {
      title: 'Scale out',
      tag: 'concept',
      heading: 'Shard for size, replicate for traffic',
      eli5: 'One room cannot hold every book, so the library opens four rooms. A question goes to all four, each returns its best, and the front desk keeps the overall best ten.',
      body: [
        'When vectors no longer fit one machine, split them into **shards**. 10M vectors over 4 shards is 2.5M each, about 15 GB of raw vectors per node.',
        'A query router fans out to every shard, each returns its own top-k, and the router merges them into the global top-k. **Replicas** of each shard add query throughput and survive a node loss.',
      ],
      keyIdea: 'Shards split the data and every query visits all of them. Replicas split the traffic.',
      metrics: { vectors: '10M', memory: '4 × 15 GB', latency: '7 ms', recall: '95%' },
      scene: {
        nodes: [
          { id: 'router', kind: 'block', size: 0.8, at: at(-4.8, 0), label: 'query router', sub: 'fan out, merge', icon: 'Split', tint: 'violet', status: 'active' },
          { id: 's1', kind: 'block', size: 0.65, at: at(-0.6, -2.4), label: 'shard 1', sub: '2.5M', icon: 'Database', tint: 'teal', chips: [{ text: 'x2 replicas', tone: 'good' }] },
          { id: 's2', kind: 'block', size: 0.65, at: at(-0.6, 2.4), label: 'shard 2', sub: '2.5M', icon: 'Database', tint: 'teal' },
          { id: 's3', kind: 'block', size: 0.65, at: at(3.6, -2.4), label: 'shard 3', sub: '2.5M', icon: 'Database', tint: 'teal' },
          { id: 's4', kind: 'block', size: 0.65, at: at(3.6, 2.4), label: 'shard 4', sub: '2.5M', icon: 'Database', tint: 'teal' },
        ],
        links: [link('router', 's1'), link('router', 's2'), link('router', 's3'), link('router', 's4')],
        flows: [
          { path: ['router', 's1'], tone: 'request', label: 'q', duration: 1.1 },
          { path: ['router', 's2'], tone: 'request', label: 'q', duration: 1.1 },
          { path: ['router', 's3'], tone: 'request', label: 'q', duration: 1.1 },
          { path: ['router', 's4'], tone: 'request', label: 'q', duration: 1.1 },
          { path: ['s1', 'router'], tone: 'response', label: 'top 10', duration: 1.1, delay: 1.3 },
          { path: ['s2', 'router'], tone: 'response', label: 'top 10', duration: 1.1, delay: 1.3 },
          { path: ['s3', 'router'], tone: 'response', label: 'top 10', duration: 1.1, delay: 1.3 },
          { path: ['s4', 'router'], tone: 'response', label: 'top 10', duration: 1.1, delay: 1.3 },
        ],
        panel: {
          title: 'Merge step',
          icon: 'Table',
          rows: [
            { text: 'Each shard returns', value: 'its top 10' },
            { text: 'Router receives', value: '4 × 10 = 40 candidates' },
            { text: 'Router keeps', value: 'global top 10', tone: 'good' },
            { text: 'Replicas', value: 'same shard, more QPS' },
          ],
          footer: { text: 'Latency is set by the slowest shard', tone: 'warn' },
        },
        caption: 'Every shard answers every query',
      },
    },
    {
      title: 'Writes',
      tag: 'concept',
      heading: 'Inserts, deletes and drift need their own care',
      eli5: 'New books arrive and old ones leave every day. Adding a book is easy. Removing one leaves a gap on the shelf, and the rooms slowly stop matching their signs until someone reorganizes.',
      body: [
        'HNSW accepts new vectors online by linking them into the graph. A delete usually marks the vector as removed (a **tombstone**), and a background compaction or rebuild cleans it up later.',
        'IVF centroids and PQ codebooks are trained on a sample. If your data changes a lot, they go stale and recall slips, so schedule a retrain. Watch recall on a fixed query set to notice it.',
      ],
      keyIdea: 'An index is a living structure. Plan for tombstones, compaction and periodic retraining.',
      metrics: { vectors: '10M', memory: '62 GB', latency: '5 ms', recall: '95%' },
      scene: {
        nodes: [
          { id: 'ingest', kind: 'block', size: 0.8, at: at(-4.2, -1.8), label: 'ingest', sub: 'embed new chunks', icon: 'Download', tint: 'amber', load: 40 },
          { ...store, at: at(0, -1.8), sub: 'live index', status: 'active' },
          { id: 'compact', kind: 'block', size: 0.8, at: at(4.2, -1.8), label: 'compaction', sub: 'background', icon: 'Repeat', tint: 'gray' },
        ],
        links: [link('ingest', 'store', { label: 'insert / delete' }), link('store', 'compact', { arrow: 'both' })],
        flows: [
          { path: ['ingest', 'store'], tone: 'event', label: '+ vector', duration: 1.3 },
          { path: ['store', 'compact'], tone: 'event', label: 'tombstones', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'What changes over time',
          icon: 'Table',
          rows: [
            { text: 'HNSW insert', value: 'online, graph updated', tone: 'good' },
            { text: 'Delete', value: 'tombstone, then compaction' },
            { text: 'IVF centroids', value: 'retrain when data drifts', tone: 'warn' },
            { text: 'PQ codebooks', value: 'retrain on a new sample', tone: 'warn' },
          ],
        },
        caption: 'Keep the index healthy as data moves',
      },
    },
    {
      title: 'Model change',
      tag: 'case',
      heading: 'Case: switching embedding models means re-embedding everything',
      eli5: 'The librarian changes the map of topics. The old coordinates now point to the wrong places, so every book must be placed on the new map before anyone can search it.',
      body: [
        'Vectors from model A mean nothing in model B\'s space, even at the same dimension. Changing models means re-embedding the whole corpus. At about 600 tokens per chunk, 10M chunks is around **6 billion tokens**.',
        'Store the model id with every vector and build the new index beside the old one. Send a slice of traffic to it, compare recall and answer quality, then cut over and retire the old one.',
      ],
      keyIdea: 'Version embeddings by model id and migrate with two indexes side by side. Never mix spaces in one index.',
      metrics: { vectors: '10M × 2', memory: '62 GB × 2', latency: '5 ms', recall: '95%' },
      metricTones: { memory: 'warn' },
      scene: {
        nodes: [
          { ...docs, at: at(-4.4, 0) },
          { id: 'old', kind: 'block', size: 0.8, at: at(2.6, -2.6), label: 'index v1', sub: 'model A, live', icon: 'Database', tint: 'teal', status: 'ok' },
          { id: 'new', kind: 'block', size: 0.8, at: at(4.4, 2.4), label: 'index v2', sub: 'model B, building', icon: 'Database', tint: 'violet', status: 'active' },
          { id: 'embB', kind: 'block', size: 0.8, at: at(-0.8, 2.4), label: 'embedder B', sub: 'GPU re-embed', icon: 'Cpu', tint: 'amber', load: 88 },
        ],
        links: [link('docs', 'old', { style: 'faint' }), link('docs', 'embB'), link('embB', 'new')],
        flows: [
          { path: ['docs', 'embB'], tone: 'data', label: 'chunks', count: 3, duration: 1.4 },
          { path: ['embB', 'new'], tone: 'data', label: 'model B vectors', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Migration plan',
          icon: 'List',
          rows: [
            { text: '1. Tag vectors with model id', value: 'v1' },
            { text: '2. Build v2 beside v1', value: '~6B tokens', tone: 'warn' },
            { text: '3. Shadow and compare', value: 'recall, answers' },
            { text: '4. Cut over, drop v1', value: 'both live meanwhile', tone: 'good' },
          ],
        },
        caption: 'Two spaces, never mixed',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Match the index to the memory and the recall you need',
      eli5: 'The **library** needs a map of topics, a fast way to walk to the right corner, a way to honor visitor rules, and a second expert for the final pick. Each piece trades speed for care.',
      body: [
        'Embeddings turn meaning into points, scored by cosine or a dot product on unit vectors. Do the memory math first. Flat search is exact and fine to about 100K vectors. Past that, ANN trades recall for speed: **HNSW** for fast and in-RAM, **IVF-PQ** and **disk indexes** when memory is the limit.',
        'Filter before or inside the search, add keywords with hybrid RRF, rerank the shortlist, shard and replicate for scale, and version embeddings by model id.',
      ],
      keyIdea: 'A vector database is an index that trades some recall for speed and memory. Measure recall on your own queries.',
      metrics: { vectors: '10M', memory: '62 GB', latency: '5 ms', recall: '95%' },
      metricTones: { latency: 'good', recall: 'good', memory: 'warn' },
      scene: {
        nodes: [
          { ...user, status: 'ok' },
          { ...store, at: at(0, -1.8), sub: 'HNSW + filters', status: 'ok' },
          { id: 'reranker', kind: 'block', size: 0.8, at: at(4.2, -1.8), label: 'reranker', sub: 'top 100 → 5', icon: 'Scale', tint: 'amber', load: 55 },
        ],
        links: [link('user', 'store', { label: '5 ms', labelTone: 'good' }), link('store', 'reranker')],
        flows: [
          { path: ['user', 'store'], tone: 'request', label: 'q + filter', duration: 1.2 },
          { path: ['store', 'reranker'], tone: 'data', label: 'top 100', duration: 1.2, delay: 1.3 },
          { path: ['reranker', 'user'], tone: 'response', label: 'top 5', duration: 2, delay: 2.6 },
        ],
        panel: {
          title: 'Before and after',
          icon: 'TrendingUp',
          rows: [
            { text: 'Vectors scanned', value: '10M → a few thousand', tone: 'good' },
            { text: 'ANN search latency', value: '1 s+ → 5 ms', tone: 'good' },
            { text: 'With rerank', value: '~150 ms total', tone: 'warn' },
            { text: 'Recall@10', value: '100% → ~95%', tone: 'warn' },
          ],
        },
      },
      quiz: {
        question: 'Your ANN search is fast but users report missing an obvious document. What is the first thing to check?',
        options: [
          'Switch to a larger embedding model right away',
          'Measure recall@10 against a flat-search ground truth, and check filters and efSearch or nprobe',
          'Add more replicas',
          'Convert all vectors to float16',
        ],
        answer: 1,
        explain: 'A missing neighbor is a recall problem until proven otherwise. Compare against flat search on that query, then look at the filter strategy and the search effort setting. Replicas add throughput and do not change which results come back.',
      },
    },
  ],
};
