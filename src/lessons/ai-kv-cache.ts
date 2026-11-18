import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const user: SceneNode = { id: 'user', kind: 'user', at: at(-4.4, -2.2), label: 'user' };
const eng: SceneNode = { id: 'eng', kind: 'block', at: at(0, -2.2), label: 'engine', sub: 'serving scheduler', icon: 'Network', tint: 'violet' };
const gpu: SceneNode = { id: 'gpu', kind: 'block', at: at(4.4, -2.2), label: 'GPU', sub: '70B model', icon: 'Cpu', tint: 'amber' };
const kv: SceneNode = { id: 'kv', kind: 'cache', at: at(4.4, 2.6), label: 'KV cache', sub: 'GPU memory' };
const weights: SceneNode = { id: 'weights', kind: 'block', size: 0.8, at: at(0, 2.6), label: 'weights', sub: '140 GB', icon: 'Database', tint: 'gray' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

export const aiKvCache: Lesson = {
  id: 'ai-kv-cache',
  title: 'Prefill, decode and the KV cache',
  tagline: 'Why a model call has two very different phases, and why one cache decides how many users a GPU can serve.',
  minutes: 18,
  level: 'Advanced',
  learn: [
    'Why LLM serving is a different sport from a normal web service',
    'Prefill and decode: one big parallel pass, then one token at a time',
    'Why decode is memory-bound, and what TTFT and TPOT measure',
    'What the KV cache stores, and the formula for its size',
    'A memory budget for a 70B model, and why KV space sets your concurrency',
    'Admission control, preemption, KV quantization and prefix caching',
    'Prefill-decode disaggregation',
  ],
  metrics: [
    { key: 'ttft', label: 'First token', icon: 'Timer' },
    { key: 'tpot', label: 'Per token', icon: 'Clock' },
    { key: 'kvtok', label: 'KV per token', icon: 'Database' },
    { key: 'conc', label: 'Concurrent', icon: 'Users' },
  ],
  steps: [
    {
      title: 'Slow start',
      tag: 'problem',
      heading: 'A long prompt waits, then the answer trickles out',
      eli5: 'A student gets a long story to read at their **GPU** desk. They stare at it for a while before writing a word, then write the answer one word at a time.',
      body: [
        'A user pastes 2,000 tokens into a chat product. Nothing appears for about 150 ms. Then words arrive steadily, one every 20 ms.',
        'The same model did two very different jobs in that call. Tuning the pause and tuning the trickle need different tools, so the first skill is seeing the two phases.',
      ],
      keyIdea: 'One LLM request is two phases with opposite behavior. Serving well starts by telling them apart.',
      metrics: { ttft: '150 ms', tpot: '20 ms', kvtok: '?', conc: '?' },
      scene: {
        nodes: [
          { ...user, chips: [{ text: '2,000-token prompt', tone: 'warn' }] },
          { ...eng },
          { ...gpu, status: 'hot', load: 92 },
        ],
        links: [link('user', 'eng', { label: 'HTTPS stream' }), link('eng', 'gpu')],
        flows: [
          { path: ['user', 'eng', 'gpu'], tone: 'request', label: 'prompt', duration: 1.6 },
          { path: ['gpu', 'eng', 'user'], tone: 'response', label: 'tok tok tok', count: 4, duration: 1.8, delay: 1.8 },
        ],
        panel: {
          title: 'One call, as the user feels it',
          icon: 'Timer',
          rows: [
            { text: 'Wait before the first word', value: '~150 ms', tone: 'warn' },
            { text: 'Then each new word', value: '~20 ms' },
            { text: 'Phases inside the model', value: '2', tone: 'good' },
          ],
        },
        caption: 'A pause, then a stream',
      },
    },
    {
      title: 'Not web serving',
      tag: 'concept',
      heading: 'A model is not a web service',
      eli5: 'A normal web page is a quick snack handed over the counter. A model is a huge cookbook that takes a whole shelf and a long time to carry to the stove.',
      body: [
        'A classic service is small, fast and cheap per request. An LLM inverts all of that: weights of 10 to 500 GB, seconds of work per request, output that streams one token at a time.',
        'The model is too big to copy many times in GPU memory, so you serve one copy and must share it across users.',
      ],
      keyIdea: 'You serve one huge copy of the model and amortize it over many requests. Everything else follows from that.',
      metrics: { ttft: '-', tpot: '-', kvtok: '-', conc: '-' },
      scene: {
        nodes: [
          { ...eng, at: at(-3.6, -1.2) },
          { ...gpu, at: at(3.6, -1.2), load: 70 },
          { ...weights, at: at(0, 3.8), status: 'active' },
        ],
        links: [link('eng', 'gpu'), link('gpu', 'weights')],
        flows: [{ path: ['eng', 'gpu', 'weights'], tone: 'request', duration: 1.8 }],
        panel: {
          title: 'Microservice vs LLM serving',
          icon: 'Table',
          rows: [
            { text: 'Model size', value: 'few MB vs 10-500 GB' },
            { text: 'Warm start', value: 'seconds vs 30 s to 5 min' },
            { text: 'Work per request', value: 'ms vs seconds' },
            { text: 'Bottleneck', value: 'CPU/IO vs GPU memory', tone: 'warn' },
            { text: 'Output', value: 'fixed vs token stream' },
            { text: 'Batching', value: 'optional vs mandatory', tone: 'warn' },
          ],
        },
        caption: 'Four rules of web serving get inverted',
      },
    },
    {
      title: 'Prefill',
      tag: 'concept',
      heading: 'Prefill reads the whole prompt in one parallel pass',
      eli5: 'The student reads the **whole story** at once, every page spread on the desk. Lots of brain work, but all of it happens together, so it is quick for its size.',
      body: [
        '**Prefill** feeds every prompt token through the model at once. It is one big matrix multiply, so the GPU is busy doing math: roughly 80 to 95 percent of its compute is in use.',
        'Prefill ends by producing the first output token, and it leaves behind the saved attention state we call the KV cache.',
      ],
      keyIdea: 'Prefill is compute-bound. All prompt tokens run in parallel and it ends with the first token.',
      metrics: { ttft: '~150 ms', tpot: '-', kvtok: '-', conc: '-' },
      scene: {
        nodes: [
          { ...user, chips: ['2,000 tokens'] },
          { ...gpu, status: 'hot', load: 92, chips: [{ text: 'prefill', tone: 'warn' }] },
          { ...kv, status: 'active', badge: 'filled' },
        ],
        links: [link('user', 'gpu', { route: 'straight' }), link('gpu', 'kv')],
        flows: [
          { path: ['user', 'gpu'], tone: 'request', label: '2,000 tokens at once', count: 3, duration: 1.4 },
          { path: ['gpu', 'kv'], tone: 'data', label: 'K and V', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Prefill profile',
          icon: 'Gauge',
          rows: [
            { text: 'Input per pass', value: 'all prompt tokens' },
            { text: 'Work', value: '1 big matmul' },
            { text: 'Limit', value: 'compute (FLOPs)', tone: 'warn' },
            { text: 'GPU compute use', value: '80-95%' },
            { text: 'Latency', value: '~50-300 ms' },
          ],
          footer: { text: 'Produces token 1 and the KV cache', tone: 'good' },
        },
        caption: 'Many tokens in, one token out',
      },
    },
    {
      title: 'Decode',
      tag: 'concept',
      heading: 'Decode writes one token per step, in sequence',
      eli5: 'Now the student writes the answer **one word at a time**. Each new word needs the one before it, so they cannot write two words at the same moment.',
      body: [
        '**Decode** is autoregressive: token n depends on token n minus 1. Each step feeds in one new token, runs a small matrix multiply and appends one entry to the cache.',
        'Hundreds of these steps run in series, and you cannot parallelize them inside one request. A step takes 15 to 40 ms.',
      ],
      keyIdea: 'Decode is serial. One token per step, hundreds of steps, each using the cache the earlier steps built.',
      metrics: { ttft: '~150 ms', tpot: '15-40 ms', kvtok: '-', conc: '-' },
      scene: {
        nodes: [
          { ...eng },
          { ...gpu, load: 18, chips: [{ text: 'decode', tone: 'good' }] },
          { ...kv, status: 'active', badge: 'grows by 1' },
        ],
        links: [link('eng', 'gpu'), link('gpu', 'kv', { arrow: 'both' })],
        flows: [
          { path: ['gpu', 'kv', 'gpu'], tone: 'data', label: 'read K,V + append 1', duration: 1.6 },
          { path: ['gpu', 'eng'], tone: 'response', label: 'next token', duration: 1.1, delay: 1.7 },
        ],
        panel: {
          title: 'Decode profile',
          icon: 'Repeat',
          rows: [
            { text: 'Input per step', value: '1 token' },
            { text: 'Work', value: '1 small matmul' },
            { text: 'Steps', value: 'hundreds, serial' },
            { text: 'GPU compute use', value: '10-25%', tone: 'warn' },
            { text: 'Latency per token', value: '15-40 ms' },
          ],
          footer: { text: 'Produces token n + 1 and one KV entry', tone: 'good' },
        },
        caption: 'The loop that makes the stream',
      },
    },
    {
      title: 'Memory-bound',
      tag: 'concept',
      heading: 'Decode waits on memory, not on math',
      eli5: 'Each word the student writes needs the whole heavy cookbook carried from the shelf to the desk. The walking takes longer than the thinking.',
      body: [
        'Each token needs all the weights (about 140 GB at FP16 for a 70B model) and the KV cache streamed from memory. On 4 GPUs the read is split, a quarter per GPU. The math on that data is small.',
        'One H100 reading 140 GB at 3.35 TB/s has a floor of about 42 ms per token. The observed 20 ms comes from tensor parallel and batching, since one weight read serves many requests (continuous batching, a later lesson). The chip idles on **memory bandwidth**.',
      ],
      keyIdea: 'Decode is memory-bound. Moving weights and cache costs more than computing with them.',
      metrics: { ttft: '-', tpot: '15-40 ms', kvtok: '-', conc: '-' },
      scene: {
        nodes: [
          { ...weights, at: at(-4.2, 0), status: 'active', badge: '140 GB' },
          { ...gpu, at: at(4.2, 0), load: 18, chips: [{ text: 'waiting on memory', tone: 'warn' }] },
          { ...kv, at: at(0, 4), size: 0.8 },
        ],
        links: [link('weights', 'gpu', { label: 'HBM bandwidth', labelTone: 'warn' }), link('kv', 'gpu')],
        flows: [
          { path: ['weights', 'gpu'], tone: 'data', label: '140 GB per token (sharded)', count: 3, duration: 1.4 },
          { path: ['kv', 'gpu'], tone: 'data', label: 'K,V', duration: 1.2, delay: 0.6 },
        ],
        panel: {
          title: 'Where one decode step goes',
          icon: 'Activity',
          rows: [
            { text: 'Weights (FP16)', value: '140 GB' },
            { text: 'H100 bandwidth', value: '3.35 TB/s' },
            { text: 'Floor on 1 GPU', value: '140 / 3,350 = 42 ms/token', tone: 'bad' },
            { text: 'Observed, TP=4 + batching', value: '~20 ms/token', tone: 'good' },
          ],
          footer: { text: 'Batching amortizes the weight read', tone: 'muted' },
        },
        caption: 'The bottleneck is the road, not the engine',
      },
    },
    {
      title: 'TTFT and TPOT',
      tag: 'concept',
      heading: 'Two phases, two latency numbers',
      eli5: 'People judge the student twice: how long before the first word appears, and how smoothly the rest flows. Those are two different skills.',
      body: [
        '**TTFT**, time to first token, is dominated by prefill and queueing. It decides whether the product feels fast. **TPOT**, time per output token, is dominated by decode. It decides whether the stream feels smooth.',
        'A well-tuned Llama-70B on H100s with tensor parallel 4 can reach about 150 ms TTFT for a 2K prompt and 20 ms TPOT, which is 50 tokens per second.',
      ],
      keyIdea: 'Track TTFT for prefill and TPOT for decode. They have separate causes and separate fixes.',
      metrics: { ttft: '150 ms', tpot: '20 ms', kvtok: '-', conc: '-' },
      metricTones: { ttft: 'good', tpot: 'good' },
      scene: {
        nodes: [
          { ...user, status: 'ok' },
          { ...eng, sub: 'times both' },
          { ...gpu, load: 55 },
        ],
        links: [link('user', 'eng'), link('eng', 'gpu')],
        flows: [
          { path: ['user', 'eng', 'gpu'], tone: 'request', label: 'prompt', duration: 1.4 },
          { path: ['gpu', 'eng', 'user'], tone: 'response', label: 'first token', duration: 1.4, delay: 1.5 },
          { path: ['gpu', 'eng', 'user'], tone: 'response', label: 'every 20 ms', count: 3, duration: 1.4, delay: 3.1 },
        ],
        panel: {
          title: 'The two SLOs',
          icon: 'Timer',
          rows: [
            { text: 'TTFT', value: '~150 ms (2K input)', tone: 'good' },
            { text: 'Driven by', value: 'prefill + queue' },
            { text: 'TPOT', value: '~20 ms (50 tok/s)', tone: 'good' },
            { text: 'Driven by', value: 'decode' },
          ],
          footer: { text: 'Feels fast vs streams smoothly', tone: 'muted' },
        },
        caption: 'One number for the start, one for the stream',
      },
    },
    {
      title: 'Without a cache',
      tag: 'problem',
      heading: 'Without a cache, every step redoes the whole past',
      eli5: 'Imagine the student, before writing each new word, rereading the whole story and redoing all their notes from scratch. By page 2,000 they would never finish.',
      body: [
        'Attention lets each new token look at the keys and values of every earlier token. If decode recomputed those for the whole sequence at every step, the work would grow with the square of the length.',
        'Token 2,001 would redo 2,000 tokens of work. Token 2,002 would redo 2,001. That is why serving engines save the results instead.',
      ],
      keyIdea: 'Recomputing keys and values every step makes total work grow as n squared. Saving them makes each step add one.',
      metrics: { ttft: '-', tpot: 'grows each token', kvtok: '-', conc: '-' },
      metricTones: { tpot: 'bad' },
      scene: {
        nodes: [
          { ...eng, sub: 'no cache' },
          { ...gpu, status: 'hot', load: 97, chips: [{ text: 'redo 2,000 tokens', tone: 'bad' }] },
        ],
        links: [link('eng', 'gpu', { label: 'step 2,001' })],
        flows: [
          { path: ['eng', 'gpu'], tone: 'request', label: 'whole sequence', count: 3, duration: 1.4 },
          { path: ['gpu', 'eng'], tone: 'error', label: '1 token', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Work per step, no cache',
          icon: 'TrendingUp',
          rows: [
            { text: 'Step 1', value: '1 token of K,V' },
            { text: 'Step 100', value: '100 tokens' },
            { text: 'Step 2,001', value: '2,001 tokens', tone: 'bad' },
          ],
          footer: { text: 'Total work grows as n squared', tone: 'bad' },
        },
        caption: 'Rereading the whole story for every word',
      },
    },
    {
      title: 'KV cache',
      tag: 'concept',
      heading: 'The KV cache saves each token\'s keys and values once',
      eli5: 'The student writes **sticky notes** about every page the first time through. For each new word they just read the notes and add one new note.',
      body: [
        'Each token produces a **key** and a **value** vector in every layer. They never change once computed, so the engine stores them in the **KV cache** in GPU memory.',
        'A decode step then computes K and V only for the new token, appends them, and reads the rest. The price is memory: the cache grows with every token of every live request.',
      ],
      keyIdea: 'The KV cache trades memory for compute. Each step adds one entry and reuses the rest.',
      metrics: { ttft: '-', tpot: '~20 ms', kvtok: '-', conc: '-' },
      metricTones: { tpot: 'good' },
      scene: {
        nodes: [
          { ...eng },
          { ...gpu, load: 40, status: 'ok' },
          { ...kv, status: 'active', chips: [{ text: 'K,V for every token', tone: 'good' }] },
        ],
        links: [link('eng', 'gpu'), link('gpu', 'kv', { arrow: 'both' })],
        flows: [
          { path: ['eng', 'gpu'], tone: 'request', label: '1 new token', duration: 1.2 },
          { path: ['gpu', 'kv', 'gpu'], tone: 'data', label: 'read old, add new', duration: 1.6, delay: 1.3 },
        ],
        panel: {
          title: 'Decode loop with a cache',
          icon: 'Code',
          code: 'kv = prefill(prompt)\nwhile not done:\n  k, v = project(new_token)\n  kv.append(k, v)\n  new_token = attend(new_token, kv)',
          footer: { text: 'One append per step', tone: 'good' },
        },
        caption: 'Compute once, read many times',
      },
      code: {
        language: 'python',
        title: 'Generation with a KV cache (sketch)',
        source: `def generate(model, prompt_ids, max_new):
    # prefill: all prompt tokens in parallel, fills the cache
    logits, kv = model.forward(prompt_ids, kv=None)
    token = sample(logits[-1])
    out = [token]

    # decode: one token per step, reuse the cache
    for _ in range(max_new - 1):
        logits, kv = model.forward([token], kv=kv)
        token = sample(logits[-1])
        out.append(token)
        if token == EOS:
            break
    return out`,
        highlight: [3, 9],
      },
    },
    {
      title: 'KV formula',
      tag: 'concept',
      heading: 'How big is one token\'s cache entry?',
      eli5: 'Each sticky note costs a little desk space. To know how many notes fit, count how many notes one page needs and how big each note is.',
      body: [
        'Per token, every layer stores a K tensor and a V tensor for each KV head. Multiply: 2 for K and V, times layers, times KV heads, times head dimension, times bytes per value.',
        'Models with grouped-query attention (GQA) share KV heads across several attention heads, so the KV head count is usually well below the attention head count. That shrinks the cache.',
      ],
      keyIdea: 'KV bytes per token = 2 x layers x KV heads x head dim x bytes per value.',
      metrics: { ttft: '-', tpot: '-', kvtok: 'formula', conc: '-' },
      scene: {
        nodes: [
          { ...kv, at: at(-3.6, 0), status: 'active' },
          { id: 'formula', kind: 'block', size: 0.9, at: at(3.6, 0), label: 'per token', sub: 'K + V, all layers', icon: 'Binary', tint: 'teal' },
        ],
        links: [link('kv', 'formula', { route: 'straight' })],
        flows: [{ path: ['formula', 'kv'], tone: 'data', label: 'bytes per token', duration: 1.6 }],
        panel: {
          title: 'The formula',
          icon: 'Binary',
          code: 'kv_bytes_per_token =\n  2          # K and V\n  * n_layers\n  * n_kv_heads  # GQA: fewer\n  * head_dim\n  * dtype_bytes # FP16=2, FP8=1',
          footer: { text: 'Grows linearly with tokens kept', tone: 'muted' },
        },
        caption: 'Five numbers multiplied',
      },
      quiz: {
        question: 'Which change shrinks the KV cache for each token while the model stays the same?',
        options: [
          'Using more attention heads',
          'Storing the cache in FP8 instead of FP16',
          'Running prefill twice',
          'Generating longer answers',
        ],
        answer: 1,
        explain: 'Bytes per value is one factor in the formula. FP8 uses 1 byte instead of 2, so each token costs half as much. More heads or longer output only increase the cache.',
      },
    },
    {
      title: '70B numbers',
      tag: 'case',
      heading: 'Case: Llama-3-70B takes 320 KB per token',
      eli5: 'For the big storybook, each page needs a stack of sticky notes as thick as a loaf of bread. A long story fills the whole desk surprisingly fast.',
      body: [
        'Llama-3-70B has 80 layers, 8 KV heads (GQA), head dimension 128 and FP16 values. That gives 2 x 80 x 8 x 128 x 2 = **320 KB per token**.',
        'A 2,048-token request holds about 655 MB. A 32,768-token request holds about 10.5 GB, for one user.',
      ],
      keyIdea: 'At 320 KB per token, long contexts are expensive. One 32K request costs about 10.5 GB of cache.',
      metrics: { ttft: '-', tpot: '-', kvtok: '320 KB', conc: '-' },
      metricTones: { kvtok: 'warn' },
      scene: {
        nodes: [
          { ...user, chips: ['2K prompt'] },
          { ...gpu, load: 50 },
          { ...kv, status: 'hot', badge: '655 MB', chips: [{ text: '32K = 10.5 GB', tone: 'bad' }] },
        ],
        links: [link('user', 'gpu', { route: 'straight' }), link('gpu', 'kv')],
        flows: [
          { path: ['user', 'gpu'], tone: 'request', label: '2,048 tokens', duration: 1.4 },
          { path: ['gpu', 'kv'], tone: 'data', label: '655 MB of K,V', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Llama-3-70B, FP16',
          icon: 'Table',
          rows: [
            { text: 'Layers', value: '80' },
            { text: 'KV heads (GQA)', value: '8' },
            { text: 'Head dimension', value: '128' },
            { text: 'KV per token', value: '2x80x8x128x2 = 320 KB', tone: 'warn' },
            { text: 'KV for 2,048 tokens', value: '~655 MB' },
            { text: 'KV for 32,768 tokens', value: '~10.5 GB', tone: 'bad' },
          ],
        },
        caption: 'Small per token, huge per conversation',
      },
    },
    {
      title: 'Memory budget',
      tag: 'case',
      heading: 'Case: weights first, the cache gets the rest',
      eli5: 'The desk is only so big. The heavy cookbook takes most of it. Whatever space is left is all the sticky notes you get.',
      body: [
        'Weights at FP16 are about 140 GB, so a 70B model needs at least 2 H100s (80 GB each), and a 4-GPU node leaves room. On 4 x H100 (320 GB), roughly **180 GB** remains for KV after the weights. That is an upper bound, since real engines reserve about 10 percent for activations, CUDA graphs and overhead.',
        'That fits at most about 270 requests of 2K tokens, or about 18 of 32K, so expect 15 to 20 percent fewer in practice. Same GPUs, 15 times fewer users when the context is long.',
      ],
      keyIdea: 'Concurrency is the leftover memory divided by the KV size per request. Context length multiplies the cost.',
      metrics: { ttft: '-', tpot: '-', kvtok: '320 KB', conc: '~270 at 2K' },
      metricTones: { conc: 'good' },
      scene: {
        nodes: [
          { ...weights, at: at(-4.2, 0), badge: '140 GB' },
          { ...gpu, at: at(0, -2), sub: '4 x H100, 320 GB', load: 60 },
          { ...kv, at: at(4.2, 0), status: 'active', badge: '~180 GB left' },
        ],
        links: [link('weights', 'gpu'), link('gpu', 'kv')],
        flows: [{ path: ['gpu', 'kv'], tone: 'data', label: 'sessions fill the rest', count: 2, duration: 1.8 }],
        panel: {
          title: 'Budget on 4 x H100',
          icon: 'HardDrive',
          rows: [
            { text: 'HBM total', value: '320 GB' },
            { text: 'Weights (FP16)', value: '-140 GB', tone: 'warn' },
            { text: 'Left for KV', value: '~180 GB', tone: 'good' },
            { text: 'At 2K tokens each', value: '~270 requests', tone: 'good' },
            { text: 'At 32K tokens each', value: '~18 requests', tone: 'bad' },
            { text: 'Upper bound', value: 'reserve ~10%, expect 15-20% fewer', tone: 'warn' },
          ],
        },
        caption: 'KV space is the real capacity',
      },
    },
    {
      title: 'The ceiling',
      tag: 'tradeoff',
      heading: 'KV space, not FLOPs, caps your throughput',
      eli5: 'The student could think faster, but the desk is full of notes. The number of students that fit at the desk limits how many stories get written at once.',
      body: [
        'More concurrent requests means better batching, which means cheaper tokens. But every extra request needs KV space, and decode time per step also grows as the cache it reads grows.',
        'So the ceiling on concurrent requests comes from memory. Every optimization that follows is a fight for KV space: admission, preemption, quantized KV, prefix sharing and caps on context. PagedAttention, covered in a later lesson, removes the 60 to 80 percent of KV memory that older contiguous allocation wasted.',
      ],
      keyIdea: 'KV cache size is the binding constraint for decode. Raw compute usually is not.',
      metrics: { ttft: '-', tpot: 'rises with context', kvtok: '320 KB', conc: 'limited by KV' },
      metricTones: { conc: 'warn', tpot: 'warn' },
      scene: {
        nodes: [
          { ...eng, label: 'scheduler', sub: 'admits requests' },
          { ...gpu, load: 35, chips: [{ text: 'compute spare', tone: 'good' }] },
          { ...kv, status: 'hot', badge: '99% full', chips: [{ text: 'no room', tone: 'bad' }] },
        ],
        links: [link('eng', 'gpu'), link('gpu', 'kv')],
        flows: [
          { path: ['eng', 'gpu', 'kv'], tone: 'request', label: 'new request', duration: 1.8 },
          { path: ['kv', 'eng'], tone: 'error', label: 'full', duration: 1.4, delay: 1.9 },
        ],
        panel: {
          title: 'What limits a decode GPU',
          icon: 'Scale',
          rows: [
            { text: 'Compute', value: '75% idle', tone: 'good' },
            { text: 'Memory bandwidth', value: 'busy', tone: 'warn' },
            { text: 'KV capacity', value: 'full', tone: 'bad' },
          ],
          footer: { text: 'Capacity ends where the cache ends', tone: 'bad' },
        },
        caption: 'Spare math, no spare memory',
      },
    },
    {
      title: 'Admission',
      tag: 'concept',
      heading: 'Admission control and preemption protect the cache',
      eli5: 'The teacher counts empty desk space before letting another student in. If a very important student arrives, someone may have to pause and put their notes in a drawer.',
      body: [
        '**Admission control** refuses or queues a new request when its projected KV at `max_tokens` would not fit. It is better to wait than to run out of memory mid-answer.',
        '**Preemption** (used by vLLM) frees room for a higher-priority request. A running request has its KV swapped to CPU memory, or dropped and recomputed later with a fresh prefill.',
      ],
      keyIdea: 'Reserve KV space before you start, and have a way to free it when someone more important arrives.',
      metrics: { ttft: 'queue adds delay', tpot: '-', kvtok: '320 KB', conc: 'bounded' },
      scene: {
        nodes: [
          { ...eng, label: 'scheduler', sub: 'checks KV budget', chips: [{ text: 'need 655 MB?', tone: 'warn' }] },
          { ...kv, status: 'hot', badge: '97% full' },
          { id: 'cpu', kind: 'storage', at: at(0, 4.2), label: 'CPU memory', sub: 'swap space' },
        ],
        links: [link('eng', 'kv'), link('kv', 'cpu', { style: 'dashed', label: 'swap out' })],
        flows: [
          { path: ['eng', 'kv'], tone: 'request', label: 'can it fit?', duration: 1.4 },
          { path: ['kv', 'cpu'], tone: 'data', label: 'low-priority KV', duration: 1.6, delay: 1.5 },
        ],
        panel: {
          title: 'Two ways to protect memory',
          icon: 'Shield',
          code: 'admit(req):\n  need = kv_per_token * (len(prompt) + max_tokens)\n  if need > free_kv: queue(req)\n\npreempt(victim):\n  swap_to_cpu(victim.kv)  # or drop + recompute',
          footer: { text: 'Refuse early, evict deliberately', tone: 'muted' },
        },
        caption: 'Make room, or make the request wait',
      },
    },
    {
      title: 'KV quantization',
      tag: 'tradeoff',
      heading: 'Quantize the cache to fit 2 to 4 times more',
      eli5: 'Write the sticky notes smaller. They are a little less detailed, but now the desk holds two to four times as many.',
      body: [
        'The cache does not have to be FP16. Storing it as **FP8** or INT4 cuts KV memory by 2 to 4 times, FP8 typically costs under 1 percent quality. INT4 KV loses more and needs testing on your workload.',
        'Halving bytes per token halves the formula, so the same 180 GB holds about twice the requests. These counts hold the weights at FP16 and only change the KV dtype. FP8 weights too would free about 70 GB more.',
      ],
      keyIdea: 'A smaller dtype for the cache buys concurrency directly, at a small quality cost.',
      metrics: { ttft: '-', tpot: '-', kvtok: '160 KB (FP8)', conc: '~540 at 2K' },
      metricTones: { kvtok: 'good', conc: 'good' },
      scene: {
        nodes: [
          { ...gpu, at: at(-4.2, 0), load: 55 },
          { ...kv, at: at(4.2, 0), status: 'ok', badge: 'FP8', chips: [{ text: '2x capacity', tone: 'good' }] },
        ],
        links: [link('gpu', 'kv', { label: 'FP16 to FP8' })],
        flows: [{ path: ['gpu', 'kv'], tone: 'data', label: '1 byte per value', count: 3, duration: 1.6 }],
        panel: {
          title: 'KV dtype vs capacity',
          icon: 'Table',
          rows: [
            { text: 'FP16', value: '320 KB/token, ~270 req' },
            { text: 'FP8', value: '160 KB/token, ~540 req', tone: 'good' },
            { text: 'INT4', value: '80 KB/token, ~1,080 req', tone: 'warn' },
            { text: 'Quality loss', value: 'FP8 < 1%, INT4 more', tone: 'muted' },
          ],
          footer: { text: 'Request counts are at 2K tokens on 4 x H100', tone: 'muted' },
        },
        caption: 'Smaller notes, more students',
      },
    },
    {
      title: 'Prefix caching',
      tag: 'concept',
      heading: 'Prefix caching shares the cache of repeated starts',
      eli5: 'Many students begin with the same first paragraph. Write its sticky notes once, and let every student read from that one set.',
      body: [
        'Many requests begin with the same tokens: a system prompt, few-shot examples, a shared document. Their KV entries are identical, so the engine can keep one copy and share it.',
        'The shared part skips prefill entirely, which cuts TTFT, and it uses KV space once. Of 1,550 tokens, 1,500 are skipped, about 97 percent less prefill work. For chatty workloads with long shared prefixes, effective capacity can be up to 10 times larger.',
      ],
      keyIdea: 'Identical prompt prefixes have identical KV. Compute it once and let many requests reuse it.',
      metrics: { ttft: 'prefill -97%', tpot: '-', kvtok: '320 KB', conc: 'up to 10x' },
      metricTones: { ttft: 'good', conc: 'good' },
      scene: {
        nodes: [
          { id: 'ua', kind: 'user', at: at(-4.4, -2.4), label: 'user A' },
          { id: 'ub', kind: 'user', at: at(-4.4, 2.8), label: 'user B' },
          { ...kv, at: at(0, 0.2), status: 'active', badge: 'shared prefix' },
          { ...gpu, at: at(4.4, 0.2), load: 45 },
        ],
        links: [link('ua', 'kv'), link('ub', 'kv'), link('kv', 'gpu')],
        flows: [
          { path: ['ua', 'kv', 'gpu'], tone: 'request', label: 'same system prompt', duration: 1.6 },
          { path: ['ub', 'kv', 'gpu'], tone: 'request', label: 'same system prompt', duration: 1.6, delay: 0.5 },
        ],
        panel: {
          title: 'Request = shared + own',
          icon: 'Copy',
          rows: [
            { text: 'System prompt (1,500 tok)', value: 'cached once', tone: 'good' },
            { text: 'User question (50 tok)', value: 'prefilled per request' },
            { text: 'Prefill work saved', value: '~97%', tone: 'good' },
          ],
          footer: { text: 'Prefix must match token for token', tone: 'muted' },
        },
        caption: 'One copy of the common start',
      },
      code: {
        language: 'python',
        title: 'Why prompt order matters for prefix caching',
        source: `# Good: stable text first, the part that changes last
prompt = SYSTEM_PROMPT + FEW_SHOTS + user_question

# Bad: a timestamp up front changes token 1,
# so no request ever shares a prefix with another
prompt = f"Time: {now()}\\n" + SYSTEM_PROMPT + user_question`,
        highlight: [2, 6],
      },
      quiz: {
        question: 'A chat product puts the current time at the very start of every prompt. What happens to prefix caching?',
        options: [
          'It works better because the time is unique',
          'The first token differs every call, so almost no prefix is shared',
          'Nothing changes, the cache ignores the first line',
          'Only decode gets slower',
        ],
        answer: 1,
        explain: 'A prefix match needs identical tokens from the start. A changing first line breaks the match at token 1, so every request pays full prefill. Put stable text first.',
      },
    },
    {
      title: 'Disaggregation',
      tag: 'tradeoff',
      heading: 'Split prefill and decode onto separate GPUs',
      eli5: 'Put the fast readers in one room and the slow writers in another. Readers hand the sticky notes through a door, and nobody steals the other\'s time.',
      body: [
        'On one GPU, prefill bursts steal time from decode steps, so TPOT spikes whenever a long prompt arrives. **Disaggregation** runs prefill on one pool and decode on another.',
        'Prefill GPUs saturate on compute, decode GPUs on memory bandwidth, and each pool is tuned for its own SLO. The cost is moving the KV cache between them over NVLink or RDMA. Reported gain: 1.5 to 3 times throughput.',
      ],
      keyIdea: 'Separate pools remove the interference between the two phases, paid for with a KV transfer.',
      metrics: { ttft: 'no prefill queue', tpot: 'no spikes', kvtok: '320 KB', conc: 'unchanged' },
      metricTones: { ttft: 'good', tpot: 'good' },
      scene: {
        nodes: [
          { ...user, at: at(-4.4, -2.4) },
          { id: 'pf', kind: 'block', at: at(-1.4, 0.6), label: 'prefill pool', sub: 'compute-bound', icon: 'Zap', tint: 'amber', load: 90 },
          { id: 'dc', kind: 'block', at: at(4.4, 0.6), label: 'decode pool', sub: 'memory-bound', icon: 'Database', tint: 'teal', load: 25 },
        ],
        links: [link('user', 'pf'), link('pf', 'dc', { label: 'KV over NVLink / RDMA' }), link('dc', 'user')],
        flows: [
          { path: ['user', 'pf'], tone: 'request', label: 'prompt', duration: 1.4 },
          { path: ['pf', 'dc'], tone: 'data', label: 'KV cache', duration: 1.6, delay: 1.5 },
          { path: ['dc', 'user'], tone: 'response', label: 'tokens', count: 3, duration: 1.8, delay: 3.2 },
        ],
        panel: {
          title: 'One pool vs two',
          icon: 'Split',
          rows: [
            { text: 'Prefill steals decode time', value: 'one pool', tone: 'bad' },
            { text: 'Each pool tuned to its limit', value: 'two pools', tone: 'good' },
            { text: 'Throughput gain', value: '1.5-3x throughput', tone: 'good' },
            { text: 'TPOT', value: 'no longer spikes', tone: 'good' },
            { text: 'Extra cost', value: 'KV transfer', tone: 'warn' },
          ],
        },
        caption: 'Hand the cache from reader to writer',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Two phases, one cache, one budget',
      eli5: 'The student reads the whole story once, takes sticky notes, then writes one word at a time from those notes. How many students fit depends on how much desk the notes use.',
      body: [
        '**Prefill** is parallel and compute-bound and sets TTFT. **Decode** is serial and memory-bound and sets TPOT. The **KV cache** saves keys and values so each step adds one entry, and it costs 2 x layers x KV heads x head dim x bytes per token.',
        'Memory left after weights divided by KV per request is your concurrency. Admission, preemption, FP8 KV, prefix caching and disaggregation all work on that number or on the phase split.',
      ],
      keyIdea: 'Know your two phases and your KV budget. Most serving optimizations push on one of them.',
      metrics: { ttft: '150 ms', tpot: '20 ms', kvtok: '320 KB', conc: '~270 at 2K' },
      metricTones: { ttft: 'good', tpot: 'good', conc: 'good' },
      scene: {
        nodes: [
          { ...user, status: 'ok' },
          { ...eng, status: 'ok' },
          { ...gpu, status: 'ok', load: 70 },
          { ...kv, status: 'ok', badge: 'budgeted' },
        ],
        links: [link('user', 'eng'), link('eng', 'gpu'), link('gpu', 'kv', { arrow: 'both' })],
        flows: [
          { path: ['user', 'eng', 'gpu'], tone: 'request', label: 'prefill', duration: 1.6 },
          { path: ['gpu', 'kv', 'gpu'], tone: 'data', label: 'K,V', duration: 1.4, delay: 1.7 },
          { path: ['gpu', 'eng', 'user'], tone: 'response', label: 'decode', count: 3, duration: 1.6, delay: 3.2 },
        ],
        panel: {
          title: 'Cheat sheet',
          icon: 'Table',
          rows: [
            { text: 'Prefill', value: 'parallel, compute-bound, TTFT' },
            { text: 'Decode', value: 'serial, memory-bound, TPOT' },
            { text: 'KV per token (70B)', value: '320 KB' },
            { text: 'KV budget', value: '(HBM - weights) / KV per request', tone: 'good' },
          ],
        },
        caption: 'The base for every serving lesson',
      },
      quiz: {
        question: 'A GPU serves a 70B model with spare compute, but new requests keep being queued. What is the most likely limit?',
        options: [
          'Prefill is too slow at parsing text',
          'The KV cache has no free space for more requests',
          'The network cable is too short',
          'The tokenizer runs out of vocabulary',
        ],
        answer: 1,
        explain: 'Decode leaves compute idle, but each live request holds KV memory. When that memory is full, admission control queues new requests. Quantized KV and prefix sharing add room, and PagedAttention (a later lesson) cuts allocation waste.',
      },
    },
  ],
};
