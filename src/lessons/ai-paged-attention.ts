import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const reqA: SceneNode = { id: 'reqA', kind: 'block', size: 0.8, at: at(-4.4, -2.4), label: 'request A', sub: '48 tokens', icon: 'FileText', tint: 'blue' };
const reqB: SceneNode = { id: 'reqB', kind: 'block', size: 0.8, at: at(-4.4, 2.6), label: 'request B', sub: '32 tokens', icon: 'FileText', tint: 'green' };
const table: SceneNode = { id: 'table', kind: 'block', size: 0.8, at: at(0, 0.1), label: 'block table', sub: 'logical to physical', icon: 'Table', tint: 'teal' };
const kv: SceneNode = { id: 'kv', kind: 'cache', at: at(4.4, 0.1), label: 'KV cache', sub: '180 GB of blocks' };
const eng: SceneNode = { id: 'eng', kind: 'block', at: at(-4.4, 0.1), label: 'engine', sub: 'vLLM scheduler', icon: 'Network', tint: 'violet' };
const gpu: SceneNode = { id: 'gpu', kind: 'block', at: at(0, -3.2), label: 'GPU', sub: '4 x H100', icon: 'Cpu', tint: 'amber' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

export const aiPagedAttention: Lesson = {
  id: 'ai-paged-attention',
  title: 'PagedAttention',
  tagline: 'How borrowing virtual memory from operating systems stops a GPU from wasting most of its KV cache.',
  minutes: 18,
  level: 'Advanced',
  learn: [
    'Why contiguous KV allocation wastes 60 to 80% of KV memory',
    'Internal and external fragmentation, with real numbers',
    'The OS analogy: fixed-size blocks and a per-request block table',
    'Allocating on demand, freeing on finish, and reading scattered blocks',
    'What it buys: near-zero fragmentation and 2 to 4 times more concurrent requests',
    'Prefix sharing with copy-on-write blocks',
    'Preemption, block size trade-offs, and which engines page',
  ],
  metrics: [
    { key: 'waste', label: 'KV wasted', icon: 'Gauge' },
    { key: 'conc', label: '2K requests held', icon: 'Users' },
    { key: 'unit', label: 'Allocation unit', icon: 'Boxes' },
    { key: 'tok', label: 'KV per token', icon: 'Database' },
  ],
  steps: [
    {
      title: 'Full but empty',
      tag: 'problem',
      heading: 'The GPU says its memory is full, yet most of it holds nothing',
      eli5: 'A library gives every reader a whole long shelf for their notes, just in case. Soon every shelf is taken, but most of them have a few notes on one end and nothing else.',
      body: [
        'A serving node has 180 GB of HBM left for the **KV cache** after loading a 70B model. New requests start getting refused. The memory graph says full.',
        'Before 2023, serving systems measured **60 to 80%** of that KV memory as unused. Most of the decode capacity was gone before any token was generated.',
      ],
      keyIdea: 'Pre-paging engines lost the majority of KV memory to waste, so concurrency was far below what the hardware could hold.',
      metrics: { waste: '60 to 80%', conc: '?', unit: 'one big slab', tok: '320 KB' },
      metricTones: { waste: 'bad' },
      scene: {
        nodes: [
          { ...eng },
          { ...gpu, status: 'hot', load: 88 },
          { ...kv, status: 'hot', badge: 'full, mostly empty' },
        ],
        links: [link('eng', 'gpu'), link('gpu', 'kv')],
        flows: [
          { path: ['eng', 'gpu'], tone: 'request', label: 'new request', duration: 1.4 },
          { path: ['gpu', 'eng'], tone: 'error', label: 'no KV room', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Where 180 GB went (at 70% waste)',
          icon: 'Gauge',
          rows: [
            { text: 'KV space reserved', value: '180 GB' },
            { text: 'Holding real tokens', value: '~54 GB', tone: 'good' },
            { text: 'Reserved, never used', value: '~126 GB', tone: 'bad' },
          ],
          footer: { text: 'Measured waste before vLLM: 60 to 80%', tone: 'bad' },
        },
        caption: 'Memory is the limit, and most of it is idle',
      },
    },
    {
      title: 'KV budget',
      tag: 'concept',
      heading: 'Recap: KV cache space sets how many requests fit',
      eli5: 'Each reader needs room on the shelves for their **notes** (the KV cache). The number of readers the library can serve is just shelf space divided by notes per reader.',
      body: [
        'Each token costs `2 x layers x kv_heads x head_dim x bytes`. For Llama-3-70B in FP16 that is **320 KB per token**, so a 2,048-token request holds **655 MB**.',
        'With 180 GB free, a perfect packer fits about **270** such requests. Every serving trick here is a fight for that space.',
      ],
      keyIdea: 'Concurrency is KV budget divided by KV per request. Wasted bytes are lost requests.',
      metrics: { waste: '?', conc: '~270 at best', unit: '-', tok: '320 KB' },
      scene: {
        nodes: [
          { id: 'weights', kind: 'block', size: 0.8, at: at(-4.4, 0.1), label: 'weights', sub: '140 GB FP16', icon: 'Database', tint: 'gray' },
          { ...gpu, at: at(0, 0.1) },
          { ...kv, at: at(4.4, 0.1), status: 'active' },
        ],
        links: [link('weights', 'gpu'), link('gpu', 'kv')],
        flows: [
          { path: ['weights', 'gpu'], tone: 'data', label: 'weights', duration: 1.4 },
          { path: ['gpu', 'kv'], tone: 'data', label: 'K, V', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Llama-3-70B, FP16',
          icon: 'Table',
          rows: [
            { text: '2 x 80 x 8 x 128 x 2 B', value: '320 KB' },
            { text: '2,048 tokens', value: '655 MB' },
            { text: '32,768 tokens', value: '~10.5 GB' },
            { text: '180 GB of KV room', value: '~270 requests', tone: 'good' },
          ],
        },
        caption: 'KV bytes per request decide concurrency',
      },
      code: {
        language: 'python',
        title: 'KV size and the concurrency ceiling',
        source: `def kv_bytes_per_token(layers=80, kv_heads=8, head_dim=128, dtype_bytes=2):
    return 2 * layers * kv_heads * head_dim * dtype_bytes   # K and V

per_token = kv_bytes_per_token()          # 327,680 B, about 320 KB
per_request = per_token * 2048            # about 655 MB
kv_budget = 180e9                         # HBM left after weights

print(int(kv_budget // per_request))      # about 270 requests, if nothing is wasted`,
        highlight: [2, 5, 8],
      },
    },
    {
      title: 'One big slab',
      tag: 'concept',
      heading: 'The old way: one contiguous slab per request',
      eli5: 'The librarian does not know how long a reader will write, so each reader gets the **longest shelf** in the building, kept free for them from the first minute.',
      body: [
        'Early engines stored a request\'s KV as one contiguous tensor. Output length is unknown at admission, so the engine had to reserve space for `max_tokens` up front.',
        'A request that allows 2,048 tokens takes a 655 MB slab the moment it arrives. Nobody else can touch that space until the request ends.',
      ],
      keyIdea: 'Contiguous layout forces a worst-case reservation per request, made before anyone knows the real length.',
      metrics: { waste: 'high', conc: 'low', unit: 'max_tokens slab', tok: '320 KB' },
      metricTones: { waste: 'bad' },
      scene: {
        nodes: [
          { ...reqA, chips: [{ text: 'max_tokens 2,048', tone: 'warn' }] },
          { ...eng, at: at(0, 0.1) },
          { ...kv, status: 'active', badge: 'reserves 655 MB' },
        ],
        links: [link('reqA', 'eng'), link('eng', 'kv')],
        flows: [
          { path: ['reqA', 'eng', 'kv'], tone: 'request', label: 'reserve 2,048 slots', duration: 1.8 },
        ],
        panel: {
          title: 'One slab, mostly empty',
          icon: 'Boxes',
          code: 'slab A  [####............]\n         used    reserved\nused      50 tokens\nreserved  2,048 tokens\nspace is held until A ends',
          footer: { text: 'Reserved for the worst case', tone: 'warn' },
        },
        caption: 'Space is booked before it is needed',
      },
    },
    {
      title: 'Internal waste',
      tag: 'case',
      heading: 'Internal fragmentation: a 50-token reply in a 2,048-token slab',
      eli5: 'A reader who writes only a few lines still holds the longest shelf. The empty part **inside their own shelf** cannot be lent to anyone else.',
      body: [
        'Say request A stops after 50 tokens. It used `50 x 320 KB` = **16 MB** of a **655 MB** slab. That is about 2.4% used.',
        'The unused 639 MB sits inside A\'s own allocation, so no other request can use it. This is **internal fragmentation**.',
      ],
      keyIdea: 'Internal fragmentation is reserved space inside an allocation that the owner never fills.',
      metrics: { waste: '97.6% of slab', conc: 'low', unit: 'max_tokens slab', tok: '320 KB' },
      metricTones: { waste: 'bad' },
      scene: {
        nodes: [
          { ...reqA, status: 'ok', chips: [{ text: 'done at 50 tokens', tone: 'good' }] },
          { ...kv, status: 'hot', chips: [{ text: '16 MB used', tone: 'good' }, { text: '639 MB wasted', tone: 'bad' }] },
        ],
        links: [link('reqA', 'kv')],
        flows: [
          { path: ['reqA', 'kv'], tone: 'data', label: '50 tokens of KV', duration: 1.6 },
        ],
        panel: {
          title: 'Slab A at the end',
          icon: 'Table',
          rows: [
            { text: 'Reserved (2,048 tokens)', value: '655 MB' },
            { text: 'Actually used (50 tokens)', value: '16 MB', tone: 'good' },
            { text: 'Stuck inside the slab', value: '639 MB', tone: 'bad' },
          ],
          footer: { text: 'Nobody else can borrow it', tone: 'bad' },
        },
        caption: 'Waste inside one request\'s own slab',
      },
    },
    {
      title: 'External waste',
      tag: 'case',
      heading: 'External fragmentation: free memory that no one can use',
      eli5: 'Readers leave at different times, so the empty shelves end up scattered in small gaps. A new reader needs one long shelf, and no single gap is long enough.',
      body: [
        'Slabs of different lengths come and go, and they leave gaps between them. Add the gaps up and there may be 600 MB free, but split into holes of 250 MB.',
        'A new request that needs 655 MB **in one piece** is refused. That wasted space between allocations is **external fragmentation**.',
      ],
      keyIdea: 'External fragmentation is free memory chopped into holes too small for the next contiguous request.',
      metrics: { waste: '60 to 80%', conc: 'low', unit: 'max_tokens slab', tok: '320 KB' },
      metricTones: { waste: 'bad', conc: 'bad' },
      scene: {
        nodes: [
          { id: 'reqD', kind: 'block', size: 0.8, at: at(-4.4, 0.1), label: 'request D', sub: 'needs 655 MB', icon: 'FileText', tint: 'red', status: 'down' },
          { ...kv, status: 'hot', badge: '600 MB free in pieces' },
          { ...eng, at: at(0, 0.1) },
        ],
        links: [link('reqD', 'eng'), link('eng', 'kv')],
        flows: [
          { path: ['reqD', 'eng'], tone: 'request', label: 'admit D', duration: 1.2 },
          { path: ['eng', 'reqD'], tone: 'error', label: 'no hole fits', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'A fragmented KV region',
          icon: 'Boxes',
          code: '[A####][gap][B##][gap][C######]\nfree total   600 MB\nlargest hole 250 MB\nneeds        655 MB, in one piece',
          footer: { text: 'Plenty free, nothing usable', tone: 'bad' },
        },
        caption: 'Gaps between slabs add up but cannot merge',
      },
    },
    {
      title: 'OS analogy',
      tag: 'concept',
      heading: 'The fix is older than LLMs: virtual memory',
      eli5: 'Instead of one long shelf per reader, the library hands out **small boxes** that fit anywhere. A card catalog says which boxes belong to which reader, in order.',
      body: [
        'Operating systems solved this decades ago. A program sees one continuous address space, but the OS maps its pages onto whatever physical frames are free.',
        '**PagedAttention**, the idea behind vLLM (2023), copies that design. KV memory is cut into fixed-size **blocks**, and each request gets a **block table** that works like a page table.',
      ],
      keyIdea: 'Logical order for the request, scattered storage for the hardware, with a table in between.',
      metrics: { waste: '?', conc: '?', unit: 'fixed blocks', tok: '320 KB' },
      scene: {
        nodes: [
          { ...reqA, sub: 'sees one sequence' },
          { ...table, status: 'active' },
          { ...kv, sub: 'blocks anywhere' },
        ],
        links: [link('reqA', 'table'), link('table', 'kv')],
        flows: [
          { path: ['reqA', 'table', 'kv'], tone: 'request', label: 'token position', duration: 1.8 },
        ],
        panel: {
          title: 'Same idea, new names',
          icon: 'Table',
          rows: [
            { text: 'process', value: 'request' },
            { text: 'virtual page', value: 'logical block' },
            { text: 'physical frame', value: 'physical block' },
            { text: 'page table', value: 'block table', tone: 'good' },
          ],
          footer: { text: 'Borrowed from the operating system', tone: 'muted' },
        },
        caption: 'Paging for KV cache',
      },
    },
    {
      title: 'Fixed blocks',
      tag: 'concept',
      heading: 'Blocks: the same small size for everything',
      eli5: 'Every box is the same size, so any free box fits any reader. Nobody ever needs a special long shelf, so nothing gets stuck in a gap.',
      body: [
        'A block holds a fixed number of tokens, for example **16**. At 320 KB per token that is about **5 MB** per block.',
        '180 GB then holds roughly **35,000 blocks**. Because every block is the same size, any free block fits any request. That ends external fragmentation.',
      ],
      keyIdea: 'Equal-size blocks make every free block interchangeable, so there are no unusable holes.',
      metrics: { waste: '?', conc: '?', unit: '16 tokens (5 MB)', tok: '320 KB' },
      scene: {
        nodes: [
          { ...eng, at: at(-4.4, 0.1) },
          { ...kv, at: at(0, 0.1), status: 'active', chips: [{ text: 'block = 16 tokens', tone: 'good' }] },
          { id: 'pool', kind: 'block', size: 0.8, at: at(4.4, 0.1), label: 'free pool', sub: '~35,000 blocks', icon: 'Boxes', tint: 'green' },
        ],
        links: [link('eng', 'kv'), link('kv', 'pool')],
        flows: [
          { path: ['eng', 'kv', 'pool'], tone: 'data', label: 'carve into blocks', duration: 1.8 },
        ],
        panel: {
          title: 'Block arithmetic',
          icon: 'Binary',
          rows: [
            { text: 'Tokens per block', value: '16' },
            { text: 'KV per block (320 KB x 16)', value: '~5.1 MB' },
            { text: 'Blocks in 180 GB', value: '~35,000', tone: 'good' },
            { text: 'Tokens they can hold', value: '~560,000' },
          ],
        },
        caption: 'One block size for every request',
      },
    },
    {
      title: 'Block table',
      tag: 'concept',
      heading: 'The block table maps token positions to physical blocks',
      eli5: 'Reader A\'s card says: first box is number 42, second is 17, third is 55. The boxes sit far apart, but the card keeps the right order.',
      body: [
        'Request A has 48 tokens, so 3 logical blocks: 0, 1 and 2. Its block table sends them to physical blocks 42, 17 and 55.',
        'Request B has 32 tokens and two blocks, at 71 and 88. Each request has its own table, and the tables are the only place order is kept.',
      ],
      keyIdea: 'A per-request table keeps the logical order. The physical blocks can be anywhere.',
      metrics: { waste: '?', conc: '?', unit: '16 tokens (5 MB)', tok: '320 KB' },
      scene: {
        nodes: [
          { ...reqA, status: 'active' },
          { ...reqB },
          { ...table },
          { ...kv },
        ],
        links: [link('reqA', 'table'), link('reqB', 'table'), link('table', 'kv')],
        flows: [
          { path: ['reqA', 'table', 'kv'], tone: 'request', label: 'A: 0, 1, 2', duration: 1.8 },
          { path: ['reqB', 'table', 'kv'], tone: 'request', label: 'B: 0, 1', duration: 1.8, delay: 0.9 },
        ],
        panel: {
          title: 'Two block tables',
          icon: 'Table',
          code: 'A (tokens 0-47)\n  logical 0 -> phys 42\n  logical 1 -> phys 17\n  logical 2 -> phys 55\nB (tokens 0-31)\n  logical 0 -> phys 71\n  logical 1 -> phys 88',
        },
        caption: 'Page table, but for attention',
      },
      quiz: {
        question: 'What does the block table of one request store?',
        options: [
          'The key and value tensors for that request',
          'For each logical block of the request, the physical block that holds it',
          'The list of all free blocks on the GPU',
          'The model weights that the request uses',
        ],
        answer: 1,
        explain: 'The table only maps logical block numbers to physical block ids. The K and V data stay in the shared block pool, and the free list is kept separately.',
      },
    },
    {
      title: 'Scattered storage',
      tag: 'concept',
      heading: 'No contiguity needed, no pre-allocation',
      eli5: 'Boxes for different readers sit mixed together on the shelves, like toys in a box. That is fine, because the card catalog knows where each one is.',
      body: [
        'The physical layout can interleave requests freely. Block 17 belongs to A, block 71 to B, block 42 to A again. Free blocks sit between them and any of them can be handed out.',
        'Nothing is reserved for `max_tokens`. A request only holds the blocks it has filled, so its footprint tracks its real length.',
      ],
      keyIdea: 'Storage is scattered on purpose. Waste no longer depends on how requests are laid out.',
      metrics: { waste: 'falling', conc: 'rising', unit: '16 tokens (5 MB)', tok: '320 KB' },
      metricTones: { waste: 'good', conc: 'good' },
      scene: {
        nodes: [
          { ...reqA },
          { ...reqB },
          { ...kv, status: 'ok' },
        ],
        links: [link('reqA', 'kv'), link('reqB', 'kv')],
        flows: [
          { path: ['reqA', 'kv'], tone: 'data', label: 'A blocks', count: 3, duration: 1.6 },
          { path: ['reqB', 'kv'], tone: 'data', label: 'B blocks', count: 2, duration: 1.6, delay: 0.8 },
        ],
        panel: {
          title: 'Physical blocks',
          icon: 'Boxes',
          code: '[ 0] free\n[17] A block 1\n[42] A block 0\n[55] A block 2\n[71] B block 0\n[88] B block 1\n... free blocks in between',
          footer: { text: 'No contiguity, no pre-allocation', tone: 'good' },
        },
        caption: 'Requests interleave across the pool',
      },
    },
    {
      title: 'Grow on demand',
      tag: 'concept',
      heading: 'A new block is allocated only when the last one fills',
      eli5: 'A reader gets one box at a time. When the box is full, the librarian hands over the next free one and writes its number on the card.',
      body: [
        'A decoding request appends one token of KV per step. When its last block is full, the engine takes a free block from the pool and adds a row to the table.',
        'The most a request can waste is the unfilled tail of its **last block**: at most 15 tokens, about 5 MB. Compare that with 639 MB in the slab.',
      ],
      keyIdea: 'Allocation follows the real token count, one block at a time, so waste is capped at one partial block.',
      metrics: { waste: '< 1 block per request', conc: 'rising', unit: '16 tokens (5 MB)', tok: '320 KB' },
      metricTones: { waste: 'good' },
      scene: {
        nodes: [
          { ...reqA, sub: 'token 49 arrives', status: 'active' },
          { ...table },
          { ...kv, chips: [{ text: 'new block 23', tone: 'good' }] },
        ],
        links: [link('reqA', 'table'), link('table', 'kv')],
        flows: [
          { path: ['reqA', 'table'], tone: 'request', label: 'token 49', duration: 1.2 },
          { path: ['table', 'kv'], tone: 'data', label: 'take free block', duration: 1.4, delay: 1.3 },
        ],
        panel: {
          title: 'Request A, token 49',
          icon: 'Table',
          rows: [
            { text: 'Blocks 0 to 2 are full', value: '48 tokens' },
            { text: 'Token 49 needs a 4th block', value: 'allocate', tone: 'warn' },
            { text: 'Block table row added', value: '3 -> 23', tone: 'good' },
            { text: 'Worst-case tail waste', value: '15 tokens' },
          ],
        },
        caption: 'One block at a time',
      },
      code: {
        language: 'python',
        title: 'Allocate when the last block is full',
        source: `BLOCK = 16

def append_token(req, free_blocks):
    if req.n_tokens % BLOCK == 0:            # last block is full (or first token)
        req.block_table.append(free_blocks.pop())
    req.n_tokens += 1

def finish(req, free_blocks):
    free_blocks.extend(req.block_table)      # blocks return to the pool at once
    req.block_table.clear()`,
        highlight: [4, 5, 9],
      },
    },
    {
      title: 'Free on finish',
      tag: 'concept',
      heading: 'Finished requests return their blocks at once',
      eli5: 'When a reader leaves, all their boxes go straight back to the pile. The next reader can use any of them, because every box is the same.',
      body: [
        'When A emits its end-of-sequence token, every block in its table goes back to the free pool. There is no hole to coalesce, because blocks are all the same size.',
        'A new request C can take those very blocks a moment later. Memory stays in constant use instead of being parked in dead slabs.',
      ],
      keyIdea: 'Any free block fits any request, so recycled memory never fragments.',
      metrics: { waste: 'near 0', conc: 'rising', unit: '16 tokens (5 MB)', tok: '320 KB' },
      metricTones: { waste: 'good' },
      scene: {
        nodes: [
          { ...reqA, status: 'dim', sub: 'finished' },
          { id: 'pool', kind: 'block', size: 0.8, at: at(0, 0.1), label: 'free pool', sub: 'blocks 42, 17, 55', icon: 'Boxes', tint: 'green', status: 'active' },
          { id: 'reqC', kind: 'block', size: 0.8, at: at(4.4, 0.1), label: 'request C', sub: 'just arrived', icon: 'FileText', tint: 'violet' },
        ],
        links: [link('reqA', 'pool'), link('pool', 'reqC')],
        flows: [
          { path: ['reqA', 'pool'], tone: 'data', label: '3 blocks back', count: 3, duration: 1.6 },
          { path: ['pool', 'reqC'], tone: 'data', label: 'reuse', count: 2, duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'Block lifecycle',
          icon: 'Repeat',
          rows: [
            { text: 'A ends (EOS)', value: 'free 42, 17, 55' },
            { text: 'C arrives', value: 'needs 2 blocks' },
            { text: 'C gets', value: '42, 17', tone: 'good' },
            { text: 'Left in the pool', value: '55', tone: 'muted' },
          ],
        },
        caption: 'Recycled with no gaps',
      },
    },
    {
      title: 'Reading blocks',
      tag: 'concept',
      heading: 'The attention kernel walks the block table',
      eli5: 'To answer, the reader needs all their notes in order. They read the card, fetch box 42, then 17, then 55, and read them as if they were one long page.',
      body: [
        'Attention for a new token needs every earlier key and value. A normal kernel assumes one contiguous array. The PagedAttention kernel looks up the block table instead.',
        'For each logical block it fetches the physical block, computes scores, and moves on. The extra indirection has a small but nonzero cost, since the vLLM paper reports roughly 20% kernel overhead. Larger batches repay it many times over.',
      ],
      keyIdea: 'The kernel gathers scattered blocks through the table, so the model never notices the layout.',
      metrics: { waste: 'near 0', conc: 'rising', unit: '16 tokens (5 MB)', tok: '320 KB' },
      scene: {
        nodes: [
          { ...gpu, at: at(-4.4, 0.1), status: 'active', load: 55 },
          { ...table },
          { ...kv },
        ],
        links: [link('gpu', 'table'), link('table', 'kv'), link('kv', 'gpu', { route: 'straight' })],
        flows: [
          { path: ['gpu', 'table'], tone: 'request', label: 'which blocks?', duration: 1.2 },
          { path: ['table', 'kv'], tone: 'request', label: '42, 17, 55', duration: 1.2, delay: 1.3 },
          { path: ['kv', 'gpu'], tone: 'response', label: 'K, V blocks', count: 3, duration: 1.6, delay: 2.6 },
        ],
        panel: {
          title: 'Kernel loop',
          icon: 'Code',
          code: 'S = [q @ kv_pool[b].k.T for b in table[req]]\nw = softmax(concat(S))\nout = sum(w[i] @ kv_pool[b].v\n          for i, b in enumerate(table[req]))\n# real kernels fuse this (online softmax)',
          footer: { text: 'Same math, different addressing', tone: 'muted' },
        },
        caption: 'Gather through the table, then attend',
      },
    },
    {
      title: 'The payoff',
      tag: 'case',
      heading: 'Waste drops to near zero and 2 to 4 times more requests fit',
      eli5: 'The same library now serves many more readers, because no shelf space sits empty for nothing. Same building, far more people reading.',
      body: [
        'Fragmentation falls from 60 to 80% to near zero, since waste is at most one partial block per request. The same GPU holds **2 to 4 times** more concurrent requests.',
        'Illustration: at 70% waste, 180 GB holds about 80 requests of 2K tokens. With paging, about 250 of the ideal 270.',
      ],
      keyIdea: 'Paging turns idle reserved bytes into running requests, which is the biggest single throughput win in serving.',
      metrics: { waste: 'near 0', conc: '~250 (was ~80)', unit: '16 tokens (5 MB)', tok: '320 KB' },
      metricTones: { waste: 'good', conc: 'good' },
      scene: {
        nodes: [
          { ...eng },
          { ...gpu, at: at(0, 0.1), status: 'ok', load: 82 },
          { ...kv, status: 'ok', badge: 'about 250 requests' },
        ],
        links: [link('eng', 'gpu'), link('gpu', 'kv')],
        flows: [
          { path: ['eng', 'gpu'], tone: 'request', label: 'bigger batches', count: 3, duration: 1.6 },
          { path: ['gpu', 'eng'], tone: 'response', label: 'tokens', count: 3, duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: '180 GB, 2K-token requests (illustrative)',
          icon: 'TrendingUp',
          rows: [
            { text: 'Ideal packing', value: '~270' },
            { text: 'Contiguous, 70% waste', value: '~80', tone: 'bad' },
            { text: 'Paged, under 5% waste', value: '~250', tone: 'good' },
          ],
          footer: { text: 'Concurrency up 2 to 4 times', tone: 'good' },
        },
        caption: 'Same GPU, three times the requests',
      },
    },
    {
      title: 'Prefix sharing',
      tag: 'concept',
      heading: 'Requests with the same prompt start can share blocks',
      eli5: 'Two readers start with the same first chapter. Instead of copying it twice, both cards point at the same boxes on the shelf.',
      body: [
        'Many requests begin with the same system prompt or few-shot examples. Their K and V values are identical. With a block table, two tables can simply point at the **same physical blocks**.',
        'A 2,000-token prompt is 125 blocks, about 640 MB. Ten requests sharing it save 9 copies, close to **5.8 GB**.',
      ],
      keyIdea: 'Paging makes sharing natural: tables point at one copy instead of every request storing its own.',
      metrics: { waste: 'near 0', conc: 'rising', unit: '16 tokens (5 MB)', tok: '320 KB' },
      metricTones: { conc: 'good' },
      scene: {
        nodes: [
          { ...reqA, sub: 'system prompt + Q1' },
          { ...reqB, sub: 'system prompt + Q2' },
          { ...table, label: 'block tables' },
          { ...kv, chips: [{ text: 'shared: blocks 0 to 124', tone: 'good' }] },
        ],
        links: [link('reqA', 'table'), link('reqB', 'table'), link('table', 'kv')],
        flows: [
          { path: ['reqA', 'table', 'kv'], tone: 'request', label: 'blocks 0..124', duration: 1.8 },
          { path: ['reqB', 'table', 'kv'], tone: 'request', label: 'same blocks', duration: 1.8, delay: 0.9 },
        ],
        panel: {
          title: 'Sharing a 2,000-token prompt',
          icon: 'Copy',
          rows: [
            { text: 'Prompt size', value: '125 blocks' },
            { text: 'One copy', value: '~640 MB' },
            { text: '10 requests, no sharing', value: '~6.4 GB', tone: 'bad' },
            { text: '10 requests, shared', value: '~640 MB', tone: 'good' },
          ],
        },
        caption: 'Two tables, one set of physical blocks',
      },
    },
    {
      title: 'Copy on write',
      tag: 'concept',
      heading: 'Copy-on-write keeps shared blocks safe',
      eli5: 'Both readers share the first chapter boxes. When one wants to scribble in a shared box, the librarian makes that reader their own copy first.',
      body: [
        'Each shared block has a **reference count**. Full blocks are only read, so sharing them is safe. Each request writes new tokens into its own private blocks.',
        'If a request must write into a block that is still shared, such as a partly filled last block, the engine copies that one block first and edits the copy. This is **copy-on-write**, the same trick operating systems use.',
      ],
      keyIdea: 'Reference counts and copy-on-write let many requests share blocks without ever corrupting each other.',
      metrics: { waste: 'near 0', conc: 'rising', unit: '16 tokens (5 MB)', tok: '320 KB' },
      scene: {
        nodes: [
          { ...reqA, status: 'active', sub: 'writes new token' },
          { ...table },
          { ...kv, chips: [{ text: 'block 9: refs 2', tone: 'warn' }, { text: 'copy to block 12', tone: 'good' }] },
        ],
        links: [link('reqA', 'table'), link('table', 'kv')],
        flows: [
          { path: ['reqA', 'table'], tone: 'request', label: 'write to block 9', duration: 1.2 },
          { path: ['table', 'kv'], tone: 'data', label: 'copy, then write', duration: 1.6, delay: 1.3 },
        ],
        panel: {
          title: 'Reference counts',
          icon: 'Hash',
          code: 'block 3   refs 2   read only\nblock 9   refs 2   A wants to write\n  -> copy 9 to 12\n  -> A points at 12 (refs 1)\n  -> block 9 refs 1\nB still reads block 9',
        },
        caption: 'Copy only when someone writes',
      },
      quiz: {
        question: 'Two requests share a system prompt. One of them must write into a shared, partly filled block. What does the engine do?',
        options: [
          'Writes in place, since both requests hold the same prompt anyway',
          'Copies that block, points the writer at the copy, and drops the reference count on the original',
          'Evicts the other request to CPU memory',
          'Allocates a fresh 655 MB contiguous slab for the writer',
        ],
        answer: 1,
        explain: 'Copy-on-write: the shared block has a reference count above 1, so the writer gets a private copy of that one block. The other request keeps reading the original.',
      },
    },
    {
      title: 'Out of blocks',
      tag: 'case',
      heading: 'When blocks run out: admit, wait, preempt',
      eli5: 'When every box is taken, the librarian can ask a reader to step out for a while, with their notes stored in the back room, or turn new readers away at the door.',
      body: [
        'Paging uses memory well, but the pool is still finite. **Admission control** can refuse a request up front, with a 429, if its projected blocks would not fit.',
        'If the pool runs dry mid-flight, **preemption** frees blocks by swapping a running request to CPU memory, or by dropping its KV and recomputing it later. Swap costs PCIe bandwidth. Recompute costs GPU time.',
      ],
      keyIdea: 'Paging raises capacity but does not remove the limit. Admission and preemption decide what happens at the edge.',
      metrics: { waste: 'near 0', conc: 'at limit', unit: '16 tokens (5 MB)', tok: '320 KB' },
      metricTones: { conc: 'warn' },
      scene: {
        nodes: [
          { ...eng },
          { ...kv, at: at(0, 0.1), status: 'hot', badge: '0 free blocks' },
          { id: 'cpu', kind: 'block', size: 0.8, at: at(4.4, 0.1), label: 'CPU RAM', sub: 'swap space', icon: 'HardDrive', tint: 'gray' },
        ],
        links: [link('eng', 'kv'), link('kv', 'cpu', { label: 'PCIe' })],
        flows: [
          { path: ['eng', 'kv'], tone: 'request', label: 'new request', duration: 1.2 },
          { path: ['kv', 'cpu'], tone: 'data', label: 'swap out request R', duration: 1.6, delay: 1.3 },
        ],
        panel: {
          title: 'Choices at the edge',
          icon: 'Scale',
          rows: [
            { text: 'Admission control', value: 'reject early, 429' },
            { text: 'Wait list', value: 'run when room opens', tone: 'good' },
            { text: 'Preempt by swap', value: 'costs PCIe', tone: 'warn' },
            { text: 'Preempt by recompute', value: 'costs GPU time', tone: 'warn' },
          ],
          footer: { text: 'Frequent preemption means admission is too loose', tone: 'muted' },
        },
        caption: 'Capacity is higher, never infinite',
      },
      quiz: {
        question: 'The pool is out of free blocks and a running request must be preempted. Which statement is correct?',
        options: [
          'Swapping to CPU memory costs PCIe bandwidth, and recompute costs GPU time',
          'Preemption is free because paged blocks can be dropped without any cost',
          'Admission control only runs after the pool is empty',
          'Swapping is always cheaper than recompute, whatever the request length',
        ],
        answer: 0,
        explain: 'Swap moves the KV over PCIe and back. Recompute drops it and redoes the prefill later. Neither is free, and which is cheaper depends on the length and the hardware.',
      },
    },
    {
      title: 'Block size',
      tag: 'tradeoff',
      heading: 'Choosing the block size is a trade-off',
      eli5: 'Tiny boxes waste almost nothing but the card gets very long. Huge boxes mean a short card, but a reader with two lines still holds a big box.',
      body: [
        'A request wastes about half a block on average, in its last block. Small blocks waste less space but need longer block tables and more lookups per attention step.',
        'Large blocks give short tables and efficient reads, but waste more and share prefixes less often, since sharing works on whole blocks. 16 tokens is a common middle.',
      ],
      keyIdea: 'Block size trades wasted tail space against table length and lookup cost. 16 tokens is a common default.',
      metrics: { waste: 'depends on block', conc: '-', unit: '4 to 128 tokens', tok: '320 KB' },
      scene: {
        nodes: [
          { ...table, status: 'active' },
          { ...kv },
          { ...gpu, at: at(-4.4, 0.1) },
        ],
        links: [link('gpu', 'table'), link('table', 'kv')],
        flows: [
          { path: ['gpu', 'table', 'kv'], tone: 'request', label: 'lookups', count: 3, duration: 1.8 },
        ],
        panel: {
          title: 'Average tail waste per request',
          icon: 'Scale',
          rows: [
            { text: '4-token blocks', value: '~2 tokens, ~0.6 MB', tone: 'good' },
            { text: '16-token blocks', value: '~8 tokens, ~2.6 MB' },
            { text: '128-token blocks', value: '~64 tokens, ~21 MB', tone: 'bad' },
          ],
          footer: { text: 'Smaller block: longer table, more lookups', tone: 'warn' },
        },
        caption: 'Waste against lookup cost',
      },
    },
    {
      title: 'Who pages',
      tag: 'case',
      heading: 'Every serious engine now pages its KV cache',
      eli5: 'Every big library in town now uses small boxes and card catalogs. The one still handing out long shelves can only serve half as many readers.',
      body: [
        'vLLM introduced it. SGLang, TensorRT-LLM (since 2024) and TGI v3 all implement paged attention now. SGLang adds **RadixAttention**, a tree of cached prefixes that builds on the same idea.',
        'If your serving stack does not page, you are leaving roughly half your GPU on the table.',
      ],
      keyIdea: 'Paged KV memory is now the baseline. The differences between engines sit on top of it.',
      metrics: { waste: 'near 0', conc: '2 to 4 times more', unit: '16 tokens (5 MB)', tok: '320 KB' },
      scene: {
        nodes: [
          { id: 'vllm', kind: 'block', size: 0.8, at: at(-4.4, -2.4), label: 'vLLM', sub: 'paged origin', icon: 'Zap', tint: 'green' },
          { id: 'sglang', kind: 'block', size: 0.8, at: at(4.4, -2.4), label: 'SGLang', sub: 'RadixAttention', icon: 'Share2', tint: 'blue' },
          { id: 'trt', kind: 'block', size: 0.8, at: at(-4.4, 2.6), label: 'TensorRT-LLM', sub: 'paged since 2024', icon: 'Cpu', tint: 'amber' },
          { id: 'tgi', kind: 'block', size: 0.8, at: at(4.4, 2.6), label: 'TGI v3', sub: 'paged', icon: 'Gauge', tint: 'violet' },
        ],
        panel: {
          title: 'Paged KV cache',
          icon: 'List',
          rows: [
            { text: 'vLLM', value: 'PagedAttention', tone: 'good' },
            { text: 'SGLang', value: 'paged + radix tree', tone: 'good' },
            { text: 'TensorRT-LLM', value: 'since 2024', tone: 'good' },
            { text: 'TGI v3', value: 'paged', tone: 'good' },
          ],
        },
        caption: 'The default, not an option',
      },
    },
    {
      title: 'Stacking wins',
      tag: 'concept',
      heading: 'Paging is the base that other tricks sit on',
      eli5: 'Small boxes make other library tricks easy: shrink the notes so more fit in each box, and let readers come and go without any shelf shuffling.',
      body: [
        '**Quantized KV**: FP8 halves KV per token to about 160 KB and a 16-token block to about 2.6 MB. Together with paging, the same 180 GB holds about twice the tokens.',
        'Continuous batching also benefits: requests join and leave every step, and paging lets them use memory fully because no holes are left behind.',
      ],
      keyIdea: 'Paging, quantized KV, prefix sharing and continuous batching compound, because each one reuses the same block pool.',
      metrics: { waste: 'near 0', conc: '~540 with FP8 KV', unit: '16 tokens (2.6 MB)', tok: '160 KB (FP8)' },
      metricTones: { conc: 'good' },
      scene: {
        nodes: [
          { ...eng },
          { ...gpu, at: at(0, 0.1), status: 'ok', load: 85 },
          { ...kv, status: 'ok', chips: [{ text: 'FP8 KV', tone: 'good' }, { text: 'prefix shared', tone: 'good' }] },
        ],
        links: [link('eng', 'gpu'), link('gpu', 'kv')],
        flows: [
          { path: ['eng', 'gpu', 'kv'], tone: 'request', label: 'join / leave per step', duration: 1.8 },
        ],
        panel: {
          title: 'Same 180 GB, stacked',
          icon: 'Layers',
          rows: [
            { text: 'Paged, FP16 KV', value: '~270 reqs' },
            { text: '+ FP8 KV (160 KB per token)', value: '~540 reqs', tone: 'good' },
            { text: '+ shared system prompt', value: 'more still', tone: 'good' },
          ],
          footer: { text: 'Ideal packing, 2K-token requests', tone: 'muted' },
        },
        caption: 'Each trick reuses the block pool',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'PagedAttention in one picture',
      eli5: 'The library stopped giving each reader one long shelf. It hands out small equal boxes anywhere, with a card for each reader, and now almost no shelf space sits empty.',
      body: [
        'Contiguous KV storage wasted 60 to 80% of memory through internal and external fragmentation. Paging cuts KV into fixed blocks, maps them with a per-request block table, and allocates one block at a time.',
        'That gives near-zero waste, 2 to 4 times more concurrent requests, cheap prefix sharing with copy-on-write, and a base for FP8 KV and continuous batching.',
      ],
      keyIdea: 'Treat KV cache like virtual memory: fixed blocks, a table, allocate late, share when equal.',
      metrics: { waste: 'near 0', conc: '2 to 4 times more', unit: '16 tokens (5 MB)', tok: '320 KB' },
      metricTones: { waste: 'good', conc: 'good' },
      scene: {
        nodes: [
          { ...reqA },
          { ...table, status: 'ok' },
          { ...kv, status: 'ok', badge: 'near-zero waste' },
        ],
        links: [link('reqA', 'table'), link('table', 'kv')],
        flows: [
          { path: ['reqA', 'table', 'kv'], tone: 'request', label: 'logical to physical', duration: 1.8 },
        ],
        panel: {
          title: 'Keep these',
          icon: 'Star',
          rows: [
            { text: 'Block', value: '16 tokens, ~5 MB' },
            { text: 'Waste', value: 'under one block each', tone: 'good' },
            { text: 'Sharing', value: 'copy-on-write', tone: 'good' },
            { text: 'Edge case', value: 'preempt or reject', tone: 'warn' },
          ],
        },
        caption: 'Fixed blocks plus a block table',
      },
      quiz: {
        question: 'A request stops after 50 tokens. How much KV memory does it waste with 16-token blocks, compared with a 2,048-token contiguous slab?',
        options: [
          'About 14 tokens (under one block) versus about 2,000 tokens in the slab',
          'About the same, since both reserve for max_tokens',
          'Zero in both designs',
          'More with blocks, because of block table overhead',
        ],
        answer: 0,
        explain: '50 tokens fill 3 full blocks and 2 slots of a fourth, so the tail waste is 14 tokens. A slab for max_tokens 2,048 holds about 1,998 empty slots no other request can use.',
      },
    },
  ],
};
