import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const user: SceneNode = { id: 'user', kind: 'user', at: at(-4.2, -2.2), label: 'user' };
const tok: SceneNode = { id: 'tok', kind: 'block', at: at(0, -2.2), label: 'tokenizer', sub: 'text to IDs', icon: 'Hash', tint: 'blue' };
const model: SceneNode = { id: 'model', kind: 'block', at: at(4.2, -2.2), label: 'model', sub: 'on a GPU', icon: 'Cpu', tint: 'amber' };
const gw: SceneNode = { id: 'gw', kind: 'block', size: 0.8, at: at(0, 2.4), label: 'gateway', sub: 'counts tokens', icon: 'Network', tint: 'violet' };
const docs: SceneNode = { id: 'docs', kind: 'storage', at: at(-4.2, 2.4), label: 'documents', sub: 'the pantry binder' };
const kv: SceneNode = { id: 'kv', kind: 'cache', at: at(4.2, 2.4), label: 'KV cache', sub: 'GPU memory' };
const vec: SceneNode = { id: 'vec', kind: 'search', at: at(0, 2.4), label: 'vector store', sub: 'finds relevant pages' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

export const aiTokensContext: Lesson = {
  id: 'ai-tokens-context',
  title: 'Tokens and context windows',
  tagline: 'The unit every model call is priced, limited and timed in, and the budget you spend it from.',
  minutes: 16,
  level: 'Intermediate',
  learn: [
    'What a token is, how a tokenizer builds one, and how to estimate a count',
    'Why other languages, code and JSON cost more tokens',
    'The context window as a budget shared by input and output',
    'Prefill, decode and the KV cache, and what they do to latency and memory',
    'Input, cached and output pricing, and a monthly cost formula',
    'Ways to fit work into the window: count first, retrieve, summarize, trim',
  ],
  metrics: [
    { key: 'tokens', label: 'Tokens in', icon: 'Hash' },
    { key: 'window', label: 'Window used', icon: 'Layers' },
    { key: 'ttft', label: 'First token', icon: 'Timer' },
    { key: 'cost', label: 'Cost per call', icon: 'Receipt' },
  ],
  steps: [
    {
      title: 'Why tokens',
      tag: 'problem',
      heading: 'Every limit and every bill is counted in tokens',
      eli5: 'In a sandwich shop, the **tokenizer** is the slicer. Your order is cut into slices, and the shop charges, limits and times everything by slices, never by words.',
      body: [
        'A team ships a chat feature and forecasts cost from word counts. The bill comes in at twice the forecast, and long documents get rejected with a context error nobody predicted.',
        'The model never sees words. It sees **tokens**, and every price, limit and delay is measured in them.',
      ],
      keyIdea: 'Tokens are the unit of cost, of limits and of latency. Guess them wrong and all three are wrong.',
      metrics: { tokens: '?', window: '?', ttft: '?', cost: '2x forecast' },
      metricTones: { cost: 'bad' },
      scene: {
        nodes: [
          { ...user, chips: ['Summarize this report'] },
          { ...tok, status: 'active' },
          { ...model, status: 'hot', load: 88, chips: [{ text: 'context length exceeded', tone: 'bad' }] },
        ],
        links: [link('user', 'tok', { label: 'text' }), link('tok', 'model', { label: 'tokens', labelTone: 'warn' })],
        flows: [
          { path: ['user', 'tok'], tone: 'request', label: '3,200 words', duration: 1.2 },
          { path: ['tok', 'model'], tone: 'request', label: '4,300 tokens', duration: 1.2, delay: 1.3 },
          { path: ['model', 'user'], tone: 'error', label: '400 too long', duration: 1.6, delay: 2.6 },
        ],
        panel: {
          title: 'Where tokens bite',
          icon: 'Hash',
          rows: [
            { text: 'Price', value: 'per token', tone: 'warn' },
            { text: 'Context limit', value: 'N tokens', tone: 'warn' },
            { text: 'Generation time', value: 'per output token', tone: 'warn' },
          ],
          footer: { text: 'Words are the wrong unit', tone: 'bad' },
        },
        caption: 'The forecast used words, the model counts tokens',
      },
    },
    {
      title: 'Sub-word pieces',
      tag: 'concept',
      heading: 'A tokenizer cuts text into sub-word pieces',
      eli5: 'The **tokenizer** slices bread by a fixed pattern. Common loaves come out as one slice, and a strange long loaf gets cut into several small ones.',
      body: [
        'Most tokenizers use **byte-pair encoding (BPE)**. It learns which character sequences appear together most often and merges each into one token.',
        'Common words are one token, with the leading space attached. Rare words split into pieces, so one long word can cost several tokens.',
      ],
      keyIdea: 'Frequent text is cheap and rare text is expensive, because rare text breaks into more pieces.',
      metrics: { tokens: '5 and 7', window: '-', ttft: '-', cost: '-' },
      scene: {
        nodes: [
          { ...user, chips: ['The quick brown fox jumps'] },
          { ...tok, status: 'active', chips: [{ text: '5 words, 5 tokens', tone: 'good' }] },
          { ...model, status: 'dim' },
        ],
        links: [link('user', 'tok'), link('tok', 'model')],
        flows: [
          { path: ['user', 'tok'], tone: 'request', label: 'text', duration: 1.3 },
          { path: ['tok', 'model'], tone: 'data', label: 'pieces', count: 3, duration: 1.4, delay: 1.4 },
        ],
        panel: {
          title: 'Common versus rare',
          icon: 'Binary',
          code: '"The quick brown fox jumps"\n["The"," quick"," brown"," fox"," jumps"]\n5 tokens\n\n"Antidisestablishmentarianism"\n["Ant","id","ises","tablish","ment",\n "arian","ism"]  7 tokens',
        },
        caption: 'One long rare word costs seven tokens',
      },
      code: {
        language: 'python',
        title: 'Counting tokens before you send (any real tokenizer library works the same way)',
        source: `def count(text: str, tokenizer) -> int:
    # encode returns a list of integer token IDs
    return len(tokenizer.encode(text))

count("The quick brown fox jumps", tok)       # 5
count("Antidisestablishmentarianism", tok)    # 7`,
        highlight: [3],
      },
    },
    {
      title: 'Token IDs',
      tag: 'concept',
      heading: 'The model reads integers from a fixed vocabulary',
      eli5: 'Every slice type has a number on the shop wall. The **tokenizer** hands the cook a list of numbers, and the cook only ever reads numbers.',
      body: [
        'The tokenizer owns a **vocabulary** of roughly 50,000 to 200,000 pieces. Each piece has an integer ID, and your text becomes a list of those IDs.',
        'The model works on the IDs and returns IDs, which the tokenizer turns back into text. The same tokenizer must be used both ways.',
      ],
      keyIdea: 'Text goes in as a list of integer IDs from a fixed vocabulary, and comes out the same way.',
      metrics: { tokens: '5', window: '-', ttft: '-', cost: '-' },
      scene: {
        nodes: [
          { ...tok, status: 'active', chips: ['vocab: 50k to 200k'] },
          { ...model },
          { ...user, status: 'dim' },
        ],
        links: [link('user', 'tok'), link('tok', 'model', { label: 'integer IDs' })],
        flows: [
          { path: ['tok', 'model'], tone: 'request', label: '[791, 4062, ...]', duration: 1.4 },
          { path: ['model', 'tok'], tone: 'response', label: 'new IDs', duration: 1.2, delay: 1.5 },
          { path: ['tok', 'user'], tone: 'response', label: 'text back', duration: 1.2, delay: 2.8 },
        ],
        panel: {
          title: 'Text to IDs (illustrative)',
          icon: 'Table',
          rows: [
            { text: '"The"', value: '791' },
            { text: '" quick"', value: '4062' },
            { text: '" brown"', value: '14198' },
            { text: '" fox"', value: '39935' },
            { text: '" jumps"', value: '35308' },
          ],
          footer: { text: 'Real IDs depend on the tokenizer', tone: 'muted' },
        },
        caption: 'The model sees only the numbers',
      },
    },
    {
      title: 'Rules of thumb',
      tag: 'concept',
      heading: 'Estimating English: about four characters a token',
      eli5: 'A rough shop rule: one slice is about three-quarters of a word. You can guess how many slices an order needs before the slicer starts.',
      body: [
        'For English prose, **1 token is about 4 characters, or 0.75 words**. So 1,000 tokens is about 750 words, or 1.5 book pages.',
        'At that rate 100,000 tokens is about 150 pages, a short novel. Use these numbers for a first forecast, then measure with the real tokenizer.',
      ],
      keyIdea: 'For English, tokens run at about four characters each. Good for a forecast, not for a limit check.',
      metrics: { tokens: '1,000', window: '-', ttft: '-', cost: '-' },
      scene: {
        nodes: [
          { ...docs, sub: '750 words' },
          { ...tok, status: 'active', chips: [{ text: '~1,000 tokens', tone: 'good' }] },
          { ...model, status: 'dim' },
        ],
        links: [link('docs', 'tok'), link('tok', 'model')],
        flows: [
          { path: ['docs', 'tok'], tone: 'data', label: '750 words', duration: 1.4 },
          { path: ['tok', 'model'], tone: 'request', label: '~1,000 tokens', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'English estimates',
          icon: 'Gauge',
          rows: [
            { text: '1 token', value: '~4 chars' },
            { text: '1,000 tokens', value: '~750 words' },
            { text: '1,000 tokens', value: '~1.5 pages' },
            { text: '100,000 tokens', value: '~150 pages', tone: 'good' },
          ],
        },
        caption: 'A first forecast, before you measure',
      },
    },
    {
      title: 'Not all text',
      tag: 'case',
      heading: 'Other languages, code and JSON cost more per idea',
      eli5: 'The slicer is trained on one kind of loaf. Foreign loaves and fancy shapes take more slices to cut, so the same meal costs more.',
      body: [
        '**Chinese, Japanese and Korean** typically cost 1.5 to 3 times the tokens of the same English text. **Code** is uneven: keywords are cheap, long names and imports burn tokens.',
        '**JSON** spends tokens on quotes, braces and repeated field names. Sending structured data in YAML or TSV can cut the count by 20 to 40 percent.',
      ],
      keyIdea: 'The same information can cost two or three times as many tokens depending on language and format.',
      metrics: { tokens: '1.5x to 3x', window: '-', ttft: '-', cost: 'higher' },
      metricTones: { tokens: 'warn', cost: 'warn' },
      scene: {
        nodes: [
          { ...user, chips: ['English', { text: 'Mandarin', tone: 'warn' }] },
          { ...tok, status: 'active' },
          { ...model, status: 'dim' },
        ],
        links: [link('user', 'tok'), link('tok', 'model')],
        flows: [
          { path: ['user', 'tok'], tone: 'request', label: 'same meaning', duration: 1.3 },
          { path: ['tok', 'model'], tone: 'request', label: '1x', duration: 1.2, delay: 1.4 },
          { path: ['tok', 'model'], tone: 'error', label: '2x', count: 2, duration: 1.2, delay: 2.7 },
        ],
        panel: {
          title: 'Tokens for the same data',
          icon: 'Braces',
          rows: [
            { text: 'Chinese, Japanese, Korean', value: '1.5x to 3x', tone: 'warn' },
            { text: 'JSON records', value: '100%', tone: 'bad' },
            { text: 'Same records as YAML or TSV', value: '60% to 80%', tone: 'good' },
          ],
          footer: { text: 'Code tokenizes unevenly', tone: 'muted' },
        },
        caption: 'Format is a cost decision',
      },
    },
    {
      title: 'Other tokenizers',
      tag: 'tradeoff',
      heading: 'Each model family has its own tokenizer',
      eli5: 'Every shop has its own slicer. A "100 slice" order at one shop is a different pile of food at the next, so recount when you change shops.',
      body: [
        'GPT, Claude, Llama and Gemini models use different tokenizers. **100 tokens in one is not 100 tokens in another.**',
        'When you migrate providers, or add a fallback, count tokens with the destination tokenizer. A prompt that fit before can overflow now.',
      ],
      keyIdea: 'Token counts do not transfer between model families. Count with the tokenizer of the model you call.',
      metrics: { tokens: '100 vs 118', window: '-', ttft: '-', cost: '-' },
      metricTones: { tokens: 'warn' },
      scene: {
        nodes: [
          { ...gw, status: 'active', chips: ['same prompt'] },
          { id: 'mA', kind: 'block', size: 0.8, at: at(-4, -2.2), label: 'model A', sub: '100 tokens', icon: 'Cpu', tint: 'amber' },
          { id: 'mB', kind: 'block', size: 0.8, at: at(4, -2.2), label: 'model B', sub: '118 tokens', icon: 'Cpu', tint: 'teal', chips: [{ text: '18% more', tone: 'warn' }] },
        ],
        links: [link('gw', 'mA'), link('gw', 'mB')],
        flows: [
          { path: ['gw', 'mA'], tone: 'request', label: '100 tokens', duration: 1.4 },
          { path: ['gw', 'mB'], tone: 'request', label: '118 tokens', duration: 1.4 },
        ],
        panel: {
          title: 'Before you switch models',
          icon: 'Scale',
          rows: [
            { text: 'Recount in the new tokenizer', value: 'always', tone: 'good' },
            { text: 'Reuse old counts', value: 'risky', tone: 'bad' },
          ],
          footer: { text: 'Numbers are an example', tone: 'muted' },
        },
        caption: 'Same text, different counts',
      },
    },
    {
      title: 'Chat history',
      tag: 'concept',
      heading: 'Every turn resends the whole history',
      eli5: 'The cook has no memory between orders. Each time you add a topping, the till copies the whole earlier order onto a new card and charges for every slice again.',
      body: [
        'The model keeps no state between calls. A chat app resends all earlier turns with each new message, and you pay for those input tokens every time.',
        'So a 10-turn chat costs far more than the sum of its messages, and the history slowly fills the window.',
      ],
      keyIdea: 'History is resent and billed on every turn, so chat cost grows faster than the number of messages.',
      metrics: { tokens: '1K, 2K, 3K...', window: 'growing', ttft: '-', cost: 'rising' },
      metricTones: { tokens: 'warn', cost: 'warn' },
      scene: {
        nodes: [
          { ...user, chips: ['turn 10'] },
          { ...gw, label: 'chat app', sub: 'resends history', status: 'active' },
          { ...model, status: 'hot', load: 70, chips: [{ text: '10K tokens in', tone: 'warn' }] },
        ],
        links: [link('user', 'gw'), link('gw', 'model')],
        flows: [
          { path: ['user', 'gw'], tone: 'request', label: 'new message', duration: 1.2 },
          { path: ['gw', 'model'], tone: 'request', label: 'history + message', count: 3, duration: 1.4, delay: 1.3 },
        ],
        panel: {
          title: 'Input tokens per turn',
          icon: 'Receipt',
          rows: [
            { text: 'Turn 1', value: '1K' },
            { text: 'Turn 5', value: '5K', tone: 'warn' },
            { text: 'Turn 10', value: '10K', tone: 'bad' },
            { text: 'Total billed in 10 turns', value: '55K', tone: 'bad' },
          ],
        },
        caption: 'Each turn pays for every turn before it',
      },
    },
    {
      title: 'Context window',
      tag: 'concept',
      heading: 'The context window is a shared token budget',
      eli5: 'The grill has one tray with a fixed number of slots. Your order, the cook\'s own notes and the finished sandwich all have to fit on that one tray.',
      body: [
        'The **context window** is the most tokens, **input plus output together**, that the model can attend to in one call.',
        'If the window is 200,000 and your prompt is 190,000, you have room for at most 10,000 tokens of answer. The limit is shared.',
      ],
      keyIdea: 'The window holds input and output together. Whatever the prompt uses, the answer cannot.',
      metrics: { tokens: '190,000', window: '95%', ttft: '-', cost: '-' },
      metricTones: { window: 'warn' },
      scene: {
        nodes: [
          { ...user, chips: ['190K prompt'] },
          { ...model, status: 'hot', load: 70, chips: [{ text: '200K window', tone: 'warn' }] },
          { ...docs, at: at(0, 2.4), sub: 'long prompt' },
        ],
        links: [link('user', 'model', { route: 'straight' }), link('docs', 'model')],
        flows: [
          { path: ['user', 'model'], tone: 'request', label: '190K in', duration: 1.6 },
          { path: ['model', 'user'], tone: 'response', label: '10K left for output', duration: 1.4, delay: 1.7 },
        ],
        panel: {
          title: 'One 200K window',
          icon: 'Layers',
          rows: [
            { text: 'Input', value: '190,000', tone: 'warn' },
            { text: 'Room for output', value: '10,000', tone: 'bad' },
            { text: 'Total', value: '200,000' },
          ],
        },
        caption: 'Input and output share one limit',
      },
    },
    {
      title: 'Window sizes',
      tag: 'concept',
      heading: 'Windows run from a short story to a codebase',
      eli5: 'Trays come in sizes. A small tray holds a snack, a big one holds a feast, and the biggest holds the whole catering order.',
      body: [
        'Small open models offer about 8K to 32K tokens. Mid-tier models offer about 128K to 200K. Frontier models offer 200K to 1M, and a few ultra-long ones reach 1M to 2M.',
        'These are rough 2026 classes, and they keep growing. Always read the limit for the exact model you call.',
      ],
      keyIdea: 'Window size grows every generation, but it is a per-model number. Check it before you design around it.',
      metrics: { tokens: '-', window: '8K to 2M', ttft: '-', cost: '-' },
      scene: {
        nodes: [
          { id: 'small', kind: 'block', size: 0.72, at: at(-4, -2.2), label: 'small', sub: '8K to 32K', icon: 'Cpu', tint: 'gray' },
          { id: 'mid', kind: 'block', size: 0.85, at: at(0, -2.2), label: 'mid-tier', sub: '128K to 200K', icon: 'Cpu', tint: 'blue' },
          { id: 'big', kind: 'block', size: 1, at: at(4, -2.2), label: 'frontier', sub: '200K to 1M', icon: 'Cpu', tint: 'amber' },
        ],
        links: [link('small', 'mid', { route: 'straight' }), link('mid', 'big', { route: 'straight' })],
        flows: [
          { path: ['small', 'mid', 'big'], tone: 'data', label: 'bigger window', duration: 2.4 },
        ],
        panel: {
          title: 'Rough size classes',
          icon: 'Table',
          rows: [
            { text: 'Small open', value: 'a short story' },
            { text: 'Mid-tier', value: 'a short novel' },
            { text: 'Frontier', value: 'a trilogy' },
            { text: 'Ultra-long', value: 'a whole codebase' },
          ],
        },
        caption: 'Bigger trays, same budget thinking',
      },
    },
    {
      title: 'Spend the budget',
      tag: 'concept',
      heading: 'Six things compete for the same window',
      eli5: 'The tray holds the recipe card, the pantry pages, the earlier chat, the tool list, your new order and an empty slot for the answer. All six need room.',
      body: [
        'The budget is split across the **system prompt**, **retrieved documents**, **conversation history**, **tool definitions**, the **user input**, and **reserved output**.',
        'Reserve output first. The **max_tokens** setting caps the answer, and the reserve is that cap. If you expect a 2K answer, 2K of the window is already spoken for.',
        'Chat history is resent and billed on every turn, so it grows until it crowds out everything else.',
      ],
      keyIdea: 'Treat the window as a budget with line items. Output reservation comes off the top.',
      metrics: { tokens: '24,000', window: '12%', ttft: '-', cost: '-' },
      scene: {
        nodes: [
          { ...gw, label: 'prompt builder', sub: 'assembles the budget', status: 'active' },
          { ...docs, chips: ['retrieved: 8,000'] },
          { ...model, chips: [{ text: 'output reserved: 2,000', tone: 'good' }] },
          { ...user, at: at(-4.2, -3.4), chips: ['question: 200'] },
        ],
        links: [link('user', 'gw'), link('docs', 'gw'), link('gw', 'model')],
        flows: [
          { path: ['user', 'gw'], tone: 'request', label: '200', duration: 1.2 },
          { path: ['docs', 'gw'], tone: 'data', label: '8,000', duration: 1.2, delay: 0.4 },
          { path: ['gw', 'model'], tone: 'request', label: '24,000', duration: 1.4, delay: 1.8 },
        ],
        panel: {
          title: 'A 200K window, itemized',
          icon: 'Table',
          rows: [
            { text: 'System prompt', value: '1,500' },
            { text: 'Tool definitions', value: '2,300' },
            { text: 'Chat history', value: '12,000' },
            { text: 'Retrieved context', value: '8,000' },
            { text: 'User input', value: '200' },
            { text: 'Reserved output', value: '2,000', tone: 'good' },
          ],
        },
        caption: 'Every line item has a number',
      },
      code: {
        language: 'python',
        title: 'A window budget check',
        source: `WINDOW = 200_000
RESERVED_OUTPUT = 2_000   # same value you pass as max_tokens

def fits(system, tools, history, docs, question, count):
    used = sum(count(part) for part in
               (system, tools, history, docs, question))
    return used + RESERVED_OUTPUT <= WINDOW`,
        highlight: [2, 7],
      },
      quiz: {
        question: 'A model has a 200K window and your prompt is 195K tokens. What is the most it can answer with?',
        options: [
          'Up to 200K, because output has its own limit',
          'About 5K, because input and output share the window',
          'Nothing, the call is always rejected',
          'About 195K, matching the input',
        ],
        answer: 1,
        explain: 'The window covers input plus output. With 195K already used by the prompt, at most about 5K tokens remain for the answer.',
      },
    },
    {
      title: 'Not a box',
      tag: 'tradeoff',
      heading: 'Cost grows with every token you stuff in',
      eli5: 'A bigger tray does not mean you should fill it. Every extra slice goes on the bill and is carried to the grill on every single order.',
      body: [
        'Input cost scales **linearly**. A 500K-token call costs 500 times a 1K-token call, and you pay it again on every request.',
        'So "it fits" is not the same as "it is worth it". The question is how many tokens this answer needs.',
      ],
      keyIdea: 'Fitting in the window is a limit. Paying for it on every call is the real constraint.',
      metrics: { tokens: '500,000', window: '50%', ttft: '-', cost: '500x' },
      metricTones: { cost: 'bad' },
      scene: {
        nodes: [
          { ...user, chips: ['same question'] },
          { id: 'lean', kind: 'block', size: 0.8, at: at(2, -4), label: 'lean prompt', sub: '1K tokens', icon: 'FileText', tint: 'green', chips: [{ text: '1x cost', tone: 'good' }] },
          { id: 'fat', kind: 'block', size: 0.8, at: at(2, 2), label: 'stuffed prompt', sub: '500K tokens', icon: 'FileText', tint: 'red', status: 'hot', chips: [{ text: '500x cost', tone: 'bad' }] },
        ],
        links: [link('user', 'lean'), link('user', 'fat')],
        flows: [
          { path: ['user', 'lean'], tone: 'request', label: '1K', duration: 1.2 },
          { path: ['user', 'fat'], tone: 'request', label: '500K', count: 4, duration: 1.4, delay: 0.3 },
        ],
        panel: {
          title: 'Per call, input only',
          icon: 'Receipt',
          rows: [
            { text: '1K tokens', value: '1x', tone: 'good' },
            { text: '100K tokens', value: '100x', tone: 'warn' },
            { text: '500K tokens', value: '500x', tone: 'bad' },
          ],
        },
        caption: 'The same answer at two prices',
      },
    },
    {
      title: 'Prefill, decode',
      tag: 'concept',
      heading: 'A call has two phases with different bottlenecks',
      eli5: 'The cook first reads the whole order card at once, then makes the sandwich one layer at a time. Reading is quick work in bulk. Layering is slow because it goes one step at a time.',
      body: [
        '**Prefill** processes the whole input in parallel. It is compute-bound, scales with input length and sets **time to first token (TTFT)**.',
        '**Decode** generates one output token at a time, each attending over everything before it. It is memory-bandwidth-bound and sets **time per output token (TPOT)**.',
      ],
      keyIdea: 'Prompt length drives TTFT through prefill. Output length drives total time through decode.',
      metrics: { tokens: '8,000 in, 500 out', window: '-', ttft: '~1.2 s', cost: '-' },
      scene: {
        nodes: [
          { ...tok, at: at(-4.2, -2.2), label: 'prompt', sub: '8,000 tokens', icon: 'FileText', tint: 'blue' },
          { id: 'pre', kind: 'block', at: at(0, 2.4), label: 'prefill', sub: 'all at once', icon: 'Zap', tint: 'amber', status: 'active', load: 92 },
          { ...model, label: 'decode', sub: 'one at a time', status: 'active', load: 45 },
        ],
        links: [link('tok', 'pre'), link('pre', 'model')],
        flows: [
          { path: ['tok', 'pre'], tone: 'request', label: '8,000 tokens', duration: 1.2 },
          { path: ['pre', 'model'], tone: 'event', label: 'first token', duration: 1, delay: 1.3 },
          { path: ['model', 'model'], tone: 'data', label: 'token 2, 3, 4...', count: 3, duration: 1.4, delay: 2.4 },
        ],
        panel: {
          title: 'The two phases',
          icon: 'Gauge',
          rows: [
            { text: 'Prefill', value: 'compute-bound' },
            { text: 'Sets', value: 'TTFT' },
            { text: 'Decode', value: 'memory-bound' },
            { text: 'Sets', value: 'tokens per second' },
          ],
        },
        caption: 'Read the card, then build layer by layer',
      },
      quiz: {
        question: 'Why is a long prompt slow to first token?',
        options: [
          'Decode must generate every input token one at a time',
          'Prefill processes all input tokens before the first output token appears',
          'The tokenizer is slow on long text',
          'The network sends tokens one by one',
        ],
        answer: 1,
        explain: 'Time to first token is dominated by prefill, which scales with input length. Decode speed only matters once output starts.',
      },
    },
    {
      title: 'Slow first token',
      tag: 'tradeoff',
      heading: 'Longer prompts make the user wait longer',
      eli5: 'The cook reads the whole order card before touching the grill. A longer card means a longer wait before the first bite, even if the sandwich is small.',
      body: [
        'Before the first output token, the model processes the whole prompt. That cost is roughly linear for typical prompts and worse at very long contexts, because attention is quadratic.',
        'On a 1M-token prompt, time to first token can be tens of seconds. The user stares at a spinner.',
      ],
      keyIdea: 'Prompt length sets time to first token. A long prompt is a slow start, whatever the answer length.',
      metrics: { tokens: '1,000,000', window: '-', ttft: '10s+', cost: '-' },
      metricTones: { ttft: 'bad' },
      scene: {
        nodes: [
          { ...user, status: 'hot', badge: 'waiting...' },
          { ...model, status: 'hot', load: 97, chips: [{ text: 'reading 1M tokens', tone: 'warn' }] },
        ],
        links: [link('user', 'model', { label: 'tens of seconds', labelTone: 'bad', route: 'straight' })],
        flows: [{ path: ['user', 'model'], tone: 'request', label: '1M tokens', count: 3, duration: 2 }],
        panel: {
          title: 'Time to first token',
          icon: 'Timer',
          rows: [
            { text: '2K prompt', value: 'under 1 s', tone: 'good' },
            { text: '100K prompt', value: 'seconds', tone: 'warn' },
            { text: '1M prompt', value: 'tens of seconds', tone: 'bad' },
          ],
          footer: { text: 'Figures vary by model and hardware', tone: 'muted' },
        },
        caption: 'The wait happens before the answer starts',
      },
    },
    {
      title: 'Streaming',
      tag: 'tradeoff',
      heading: 'Streaming hides the wait after the first token',
      eli5: 'The cook hands over each layer as soon as it is ready, so you start eating while the rest is still being made.',
      body: [
        'With **streaming**, the server sends each token as it is decoded. The user sees text after the TTFT, not after the whole answer.',
        'A 500-token answer at 80 tokens per second takes about 6 s in total. With a 2 s TTFT, the user reads the first words at 2 s instead of waiting 8 s.',
      ],
      keyIdea: 'Streaming does not shorten the total time. It cuts the perceived wait to the TTFT.',
      metrics: { tokens: '500 out', window: '-', ttft: '2 s', cost: '-' },
      metricTones: { ttft: 'good' },
      scene: {
        nodes: [
          { ...user, chips: [{ text: 'reads at 2 s', tone: 'good' }] },
          { ...model, status: 'active', load: 60, chips: ['80 tokens per second'] },
        ],
        links: [link('user', 'model', { route: 'straight' })],
        flows: [
          { path: ['user', 'model'], tone: 'request', label: 'prompt', duration: 1.2 },
          { path: ['model', 'user'], tone: 'response', label: 'tokens as decoded', count: 4, duration: 1.4, delay: 1.6 },
        ],
        panel: {
          title: 'Same call, two experiences',
          icon: 'Timer',
          rows: [
            { text: 'No streaming: first text', value: '~8 s', tone: 'bad' },
            { text: 'Streaming: first text', value: '~2 s', tone: 'good' },
            { text: 'Total time', value: 'same' },
          ],
        },
        caption: 'The answer starts arriving at the TTFT',
      },
    },
    {
      title: 'Lost in middle',
      tag: 'tradeoff',
      heading: 'Quality drops when the fact is buried',
      eli5: 'If the one line you need is hidden in the middle of a very long recipe card, the cook is likelier to miss it than a line at the top or the bottom.',
      body: [
        'Models recall facts at the start and end of a long context better than facts in the middle. This is called **lost in the middle**.',
        'This is a big reason retrieval often beats stuffing. Pulling the 5K tokens that matter can answer better than sending 500K.',
      ],
      keyIdea: 'More context is not always better context. Relevant and short often beats complete and long.',
      metrics: { tokens: '500,000', window: '-', ttft: '-', cost: '-' },
      scene: {
        nodes: [
          { ...docs, status: 'active', chips: ['fact on page 240'] },
          { ...model, chips: [{ text: 'misses it', tone: 'bad' }] },
          { ...user, at: at(0, 2.4), status: 'dim' },
        ],
        links: [link('docs', 'model'), link('model', 'user')],
        flows: [
          { path: ['docs', 'model'], tone: 'data', label: '500K tokens', count: 3, duration: 1.6 },
          { path: ['model', 'user'], tone: 'error', label: 'wrong answer', duration: 1.2, delay: 1.8 },
        ],
        panel: {
          title: 'Recall by position',
          icon: 'TrendingUp',
          rows: [
            { text: 'Start of the prompt', value: 'strong', tone: 'good' },
            { text: 'Middle of the prompt', value: 'weaker', tone: 'bad' },
            { text: 'End of the prompt', value: 'strong', tone: 'good' },
          ],
          footer: { text: 'Put key facts at the edges', tone: 'muted' },
        },
        caption: 'Long context loses the middle',
      },
    },
    {
      title: 'KV cache',
      tag: 'concept',
      heading: 'The KV cache saves work on every earlier token',
      eli5: 'While making a sandwich the cook keeps sticky notes about each layer already added. Without them, the cook would re-read the whole card before adding every single layer.',
      body: [
        'Attention computes two values, **K** and **V**, for each token. Without a cache they would be recomputed for every prior token at every step, which is far too slow.',
        'The **KV cache** stores K and V for every token so far. Each decode step computes them for the one new token and reads the rest from the cache.',
      ],
      keyIdea: 'The KV cache turns decode into one new token of work per step, by remembering all earlier tokens.',
      metrics: { tokens: '8,000 in', window: '-', ttft: '-', cost: '-' },
      scene: {
        nodes: [
          { ...model, label: 'decode', sub: 'one new token', status: 'active', load: 55 },
          { ...kv, at: at(-2.5, 2.4), status: 'active', chips: ['K and V for 8,000 tokens'] },
          { ...tok, label: 'new token', sub: 'step 8,001', icon: 'Hash', at: at(-4.2, -2.2) },
        ],
        links: [link('tok', 'model'), link('model', 'kv', { arrow: 'both' })],
        flows: [
          { path: ['tok', 'model'], tone: 'request', label: '1 token', duration: 1.2 },
          { path: ['model', 'kv'], tone: 'data', label: 'store K, V', duration: 1.2, delay: 1.3 },
          { path: ['kv', 'model'], tone: 'response', label: 'read the past', count: 2, duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'Work per decode step',
          icon: 'Zap',
          rows: [
            { text: 'Without cache', value: 'redo all tokens', tone: 'bad' },
            { text: 'With cache', value: 'compute 1 token', tone: 'good' },
          ],
        },
        caption: 'Remember the past, compute only the new token',
      },
    },
    {
      title: 'KV memory',
      tag: 'tradeoff',
      heading: 'The cache is huge and caps concurrency',
      eli5: 'Every customer at the grill needs their own wall of sticky notes. The wall space is limited, so only so many customers can be served at once.',
      body: [
        'KV size is roughly 2 × layers × KV heads × head dimension × tokens × bytes per value. Grouped-query attention cuts the KV heads several-fold, and a 70B-class model with it still needs roughly 10 GB per 32K request.',
        'On self-hosted GPUs, the number of requests in flight is limited by how many caches fit in memory, not by raw compute.',
      ],
      keyIdea: 'GPU memory for KV caches, not FLOPs, usually sets how many requests one GPU can hold.',
      metrics: { tokens: '32,000', window: '-', ttft: '-', cost: '-' },
      metricTones: { tokens: 'warn' },
      scene: {
        nodes: [
          { ...model, label: 'GPU', sub: 'fixed memory', status: 'hot', load: 94, chips: [{ text: 'memory full', tone: 'bad' }] },
          { ...kv, at: at(-2.5, 2.4), status: 'hot', chips: ['request 1: about 10 GB', 'request 2: about 10 GB'] },
          { ...user, at: at(1.2, 3.6), chips: [{ text: 'request 3 waits', tone: 'warn' }] },
        ],
        links: [link('user', 'model'), link('model', 'kv')],
        flows: [
          { path: ['user', 'model'], tone: 'request', label: 'request 3', duration: 1.4 },
          { path: ['model', 'user'], tone: 'error', label: 'queued', duration: 1.2, delay: 1.5 },
        ],
        panel: {
          title: 'What fills GPU memory',
          icon: 'HardDrive',
          rows: [
            { text: 'Model weights', value: 'fixed', tone: 'muted' },
            { text: 'KV cache, 32K request (GQA)', value: 'about 10 GB', tone: 'bad' },
            { text: 'Concurrent requests', value: 'memory-bound', tone: 'warn' },
          ],
          footer: { text: 'Paged caches (vLLM) reduce waste', tone: 'good' },
        },
        caption: 'Memory, not compute, is the ceiling',
      },
      quiz: {
        question: 'Why is the number of concurrent requests on a GPU limited by KV cache memory rather than compute?',
        options: [
          'Every request holds its own KV cache for the whole call, and the GPU memory for them runs out first',
          'Decode needs more FLOPs than prefill, so compute runs out first',
          'The tokenizer can only handle a few requests at once',
          'The KV cache is shared by all requests, so it fills quickly',
        ],
        answer: 0,
        explain: 'Each in-flight request keeps K and V for all its tokens in GPU memory. Weights are fixed, so the memory left for caches caps how many requests fit.',
      },
    },
    {
      title: 'Prompt cache',
      tag: 'concept',
      heading: 'Reuse the KV state of a shared prompt prefix',
      eli5: 'Every sandwich starts with the same base recipe. The shop keeps that base ready-made and only builds the part that is different for you.',
      body: [
        'If 10,000 users send the same long system prompt, a **prompt cache** (or prefix cache) computes its KV state once and reuses it.',
        'Providers pass this on as a discount on cached input tokens, often 50 to 90 percent off. It only works when the shared text comes **first** and stays byte-identical.',
        'Cache entries expire after minutes, need a minimum prefix length, and writing may cost extra.',
      ],
      keyIdea: 'Put the stable part of the prompt first and keep it identical. Then the repeated tokens cost a fraction.',
      metrics: { tokens: '10,000 shared', window: '-', ttft: 'faster', cost: '-60%' },
      metricTones: { ttft: 'good', cost: 'good' },
      scene: {
        nodes: [
          { ...user, chips: ['unique question'] },
          { ...kv, at: at(0, 2.4), label: 'prefix cache', sub: 'shared prompt', status: 'ok', chips: [{ text: 'hit', tone: 'good' }] },
          { ...model, status: 'active', load: 40 },
        ],
        links: [link('user', 'model', { route: 'straight' }), link('kv', 'model')],
        flows: [
          { path: ['kv', 'model'], tone: 'response', label: '10K reused', duration: 1.4 },
          { path: ['user', 'model'], tone: 'request', label: 'only new tokens', duration: 1.2, delay: 1.5 },
        ],
        panel: {
          title: 'Prompt layout for caching',
          icon: 'Layers',
          code: '1. system prompt     (same)  cached\n2. tools, examples   (same)  cached\n3. retrieved docs    (varies)\n4. user question     (varies)',
          footer: { text: 'Stable first, varying last', tone: 'good' },
        },
        caption: 'Pay full price for the new part only',
      },
    },
    {
      title: 'Three prices',
      tag: 'concept',
      heading: 'Input, cached input and output are priced apart',
      eli5: 'The shop charges one price for slices you bring, a tiny price for the ready-made base, and a bigger price for the sandwiches the cook makes.',
      body: [
        '**Input** is cheaper per token. **Output** is typically 3 to 5 times the input price. **Cached input** is often 10 to 50 percent of the normal input price.',
        'Tier matters too: small models cost a fraction of frontier ones. Self-hosted cost is amortized GPU time instead of a per-token price.',
      ],
      keyIdea: 'Output tokens cost several times more than input tokens, and cached tokens cost far less.',
      metrics: { tokens: '-', window: '-', ttft: '-', cost: 'varies by tier' },
      scene: {
        nodes: [
          { ...gw, label: 'cost tracker', sub: 'per feature', status: 'active' },
          { ...model, chips: ['input', 'cached input', { text: 'output', tone: 'warn' }] },
          { ...user, status: 'dim' },
        ],
        links: [link('user', 'gw'), link('gw', 'model')],
        flows: [
          { path: ['gw', 'model'], tone: 'request', label: '3,000 in', duration: 1.2 },
          { path: ['model', 'gw'], tone: 'response', label: '500 out', duration: 1.2, delay: 1.4 },
        ],
        panel: {
          title: 'Indicative price per 1M tokens',
          icon: 'Receipt',
          rows: [
            { text: 'Frontier: in / cached / out', value: '$10-15 / $1-3 / $50-75' },
            { text: 'Mid: in / cached / out', value: '$3 / $0.30 / $15' },
            { text: 'Small: in / cached / out', value: '$0.25 / $0.03 / $1.25' },
          ],
          footer: { text: 'Indicative 2026 ranges, check your provider', tone: 'muted' },
        },
        caption: 'Three meters run on every call',
      },
    },
    {
      title: 'Cost formula',
      tag: 'case',
      heading: 'Forecast the month before you ship',
      eli5: 'Count the customers, how often they come, and the slices in each order, then multiply by the price of a slice. Double the slices, double the bill.',
      body: [
        'Monthly cost is users × requests per user × (input tokens × input price + output tokens × output price).',
        'With 10,000 users, 100 requests each, 3,000 tokens in and 500 out on a $3 and $15 per million model, that is **$16,500 a month**. Double the average context and the input half doubles.',
      ],
      keyIdea: 'Cost is a product of token counts and prices. Every term can be measured, so forecast it.',
      metrics: { tokens: '3,000 in, 500 out', window: '-', ttft: '-', cost: '$0.0165' },
      metricTones: { cost: 'warn' },
      scene: {
        nodes: [
          { ...user, label: '10,000 users', chips: ['100 calls each'] },
          { ...gw, label: 'cost tracker', sub: '1M calls a month', status: 'active' },
          { ...model, sub: '$3 in, $15 out' },
        ],
        links: [link('user', 'gw'), link('gw', 'model')],
        flows: [
          { path: ['user', 'gw', 'model'], tone: 'request', label: '3,000 in', duration: 1.8 },
          { path: ['model', 'gw'], tone: 'response', label: '500 out', duration: 1.2, delay: 1.9 },
        ],
        panel: {
          title: 'One call, then the month',
          icon: 'Receipt',
          rows: [
            { text: '3,000 in at $3 per M', value: '$0.0090' },
            { text: '500 out at $15 per M', value: '$0.0075' },
            { text: 'Per call', value: '$0.0165' },
            { text: '1,000,000 calls', value: '$16,500', tone: 'warn' },
          ],
        },
        caption: 'About 55 percent of the bill is input',
      },
      code: {
        language: 'python',
        title: 'The forecast as code',
        source: `def monthly_cost(users, calls_each, tok_in, tok_out,
                 price_in, price_out):  # prices per 1M tokens
    per_call = (tok_in * price_in + tok_out * price_out) / 1_000_000
    return users * calls_each * per_call

monthly_cost(10_000, 100, 3_000, 500, 3.0, 15.0)   # 16500.0`,
        highlight: [3, 4],
      },
    },
    {
      title: 'Long-context tier',
      tag: 'tradeoff',
      heading: 'Very long contexts can cost more per token',
      eli5: 'A giant order does not just mean more slices. The grill has to work much harder to keep track of them all, so some shops charge a higher rate past a certain size.',
      body: [
        'Attention work grows faster than linearly with context length on the server. Providers bill linearly, but many add a **higher tier above a threshold**, for example $3 per million below 200K and $6 above.',
        'Crossing the threshold can double the price of the whole call, not just the extra tokens, depending on the provider. Read the pricing page.',
      ],
      keyIdea: 'Long context can cost more per token than short context. Check where your provider\'s tier line sits.',
      metrics: { tokens: '250,000', window: '-', ttft: '-', cost: '2x per token' },
      metricTones: { cost: 'bad' },
      scene: {
        nodes: [
          { ...user, chips: ['250K prompt'] },
          { ...model, status: 'hot', load: 90, chips: [{ text: 'long-context tier', tone: 'warn' }] },
          { ...gw, label: 'pricing', sub: '$3 / $6 per M', icon: 'Receipt', tint: 'red' },
        ],
        links: [link('user', 'model', { route: 'straight' }), link('model', 'gw')],
        flows: [
          { path: ['user', 'model'], tone: 'request', label: '250K tokens', duration: 1.6 },
          { path: ['model', 'gw'], tone: 'error', label: 'higher rate', duration: 1.2, delay: 1.7 },
        ],
        panel: {
          title: 'Example tiered pricing',
          icon: 'Table',
          rows: [
            { text: 'Up to 200K tokens', value: '$3 per M', tone: 'good' },
            { text: 'Above 200K tokens', value: '$6 per M', tone: 'bad' },
          ],
          footer: { text: 'Example only, tiers differ by provider', tone: 'muted' },
        },
        caption: 'Past the line, every token costs more',
      },
    },
    {
      title: 'Count first',
      tag: 'concept',
      heading: 'Count tokens at the gateway before you call',
      eli5: 'A front till counts the slices in each order before it goes to the grill. If it will not fit the tray, the till sends it back or trims it, so the cook never wastes time.',
      body: [
        'Put token counting in the **LLM gateway**: count with the target model\'s tokenizer, reserve output, then allow, trim or reject.',
        'The same counts feed a **cost tracker** that attributes tokens and dollars to each user and feature, so a runaway prompt shows up the same day.',
      ],
      keyIdea: 'Counting centrally makes limits, trimming and cost attribution one policy instead of scattered code.',
      metrics: { tokens: '24,000', window: '12%', ttft: '-', cost: 'tracked' },
      metricTones: { window: 'good', cost: 'good' },
      scene: {
        nodes: [
          { ...user, chips: ['request'] },
          { ...gw, size: 1, status: 'active', label: 'gateway', sub: 'count, reserve, route', chips: [{ text: '24K of 200K', tone: 'good' }] },
          { ...model },
        ],
        links: [link('user', 'gw'), link('gw', 'model')],
        flows: [
          { path: ['user', 'gw'], tone: 'request', label: 'prompt', duration: 1.2 },
          { path: ['gw', 'model'], tone: 'request', label: 'fits', duration: 1.2, delay: 1.3 },
          { path: ['model', 'gw', 'user'], tone: 'response', label: 'answer', duration: 1.8, delay: 2.6 },
        ],
        panel: {
          title: 'Gateway policy',
          icon: 'Shield',
          rows: [
            { text: 'Count with target tokenizer', value: 'yes', tone: 'good' },
            { text: 'Reserve output tokens', value: '2,000', tone: 'good' },
            { text: 'Over budget', value: 'trim or reject', tone: 'warn' },
            { text: 'Log tokens per user', value: 'cost tracker' },
          ],
        },
        caption: 'One checkpoint in front of every model call',
      },
      code: {
        language: 'python',
        title: 'Gateway check before every call',
        source: `def prepare(req, model):
    used = model.count(req.prompt)
    room = model.window - model.reserved_output
    if used > room:
        req.prompt = trim(req.prompt, room)   # or reject with 413
        used = model.count(req.prompt)        # recount after trimming
    cost.record(req.user, used)
    return req`,
        highlight: [2, 3, 4, 5, 6],
      },
    },
    {
      title: 'Fit strategies',
      tag: 'tradeoff',
      heading: 'When it will not fit, pick what to drop',
      eli5: 'If the order is too big for the tray, you can fetch only the pages you need from the binder, shorten the old chat to a summary, or just cut the oldest notes.',
      body: [
        '**Retrieve**: pull just the relevant chunks from a vector store instead of whole documents. **Summarize**: compress old turns into a short note.',
        '**Truncate**: drop the oldest turns with a sliding window. It is cheap but forgets. Choose by what the task cannot lose.',
      ],
      keyIdea: 'Retrieve for knowledge, summarize for history, truncate as the cheap last resort.',
      metrics: { tokens: '5,000', window: '3%', ttft: '~0.75 s', cost: '$0.015' },
      metricTones: { tokens: 'good', window: 'good', ttft: 'good', cost: 'good' },
      scene: {
        nodes: [
          { ...docs, sub: '500K tokens' },
          { ...vec, at: at(0, 2.4), status: 'active', chips: [{ text: 'top 5 chunks', tone: 'good' }] },
          { ...model, status: 'ok', chips: ['5K tokens in'] },
          { ...user, chips: ['question'] },
        ],
        links: [link('docs', 'vec'), link('vec', 'model'), link('user', 'model', { route: 'straight' })],
        flows: [
          { path: ['user', 'model'], tone: 'request', label: 'question', duration: 1.2 },
          { path: ['docs', 'vec', 'model'], tone: 'data', label: '5K relevant', duration: 1.8, delay: 0.6 },
        ],
        panel: {
          title: 'Three ways to fit',
          icon: 'Layers',
          rows: [
            { text: 'Retrieve chunks', value: 'knowledge', tone: 'good' },
            { text: 'Summarize old turns', value: 'history', tone: 'good' },
            { text: 'Sliding window', value: 'forgets oldest', tone: 'warn' },
          ],
          footer: { text: '500K tokens down to 5K', tone: 'good' },
        },
        caption: 'Send what the answer needs, not what you have',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Tokens set the cost, the limit and the clock',
      eli5: 'In the sandwich shop, slices are the unit for the bill, the tray and the wait. Count them first, keep the tray from overfilling, and fetch only the pages you need.',
      body: [
        'A tokenizer maps text to integer IDs. Estimate English at about 4 characters per token, then measure in the target tokenizer. Language, code and JSON change the count.',
        'The window is a budget for input plus output. Prefill drives TTFT, decode and the KV cache drive speed and memory, and prices split into input, cached and output.',
      ],
      keyIdea: 'Count tokens, budget the window, cache the stable prefix, and send only what the answer needs.',
      metrics: { tokens: '5,000', window: '3%', ttft: '~0.75 s', cost: '$0.015' },
      metricTones: { tokens: 'good', window: 'good', ttft: 'good', cost: 'good' },
      scene: {
        nodes: [
          { ...user },
          { ...gw, at: at(0, -2.2), status: 'ok', label: 'gateway', sub: 'count and budget', chips: ['counted'] },
          { ...model, status: 'ok', load: 45 },
          { ...kv, at: at(0, 2.4), status: 'ok', label: 'prefix cache', sub: 'stable prompt' },
        ],
        links: [link('user', 'gw'), link('gw', 'model'), link('kv', 'model')],
        flows: [
          { path: ['user', 'gw', 'model'], tone: 'request', label: '5K tokens', duration: 1.8 },
          { path: ['kv', 'model'], tone: 'response', label: 'cached prefix', duration: 1.2, delay: 0.4 },
          { path: ['model', 'gw', 'user'], tone: 'response', label: 'answer', duration: 1.8, delay: 2 },
        ],
        panel: {
          title: 'Token checklist',
          icon: 'Table',
          rows: [
            { text: 'Count in the target tokenizer', value: 'yes', tone: 'good' },
            { text: 'Reserve output', value: 'yes', tone: 'good' },
            { text: 'Stable prefix first', value: 'yes', tone: 'good' },
            { text: 'Retrieve, do not stuff', value: 'yes', tone: 'good' },
          ],
        },
        caption: 'A lean, counted, cached call',
      },
      quiz: {
        question: 'Which change cuts both the cost and the time to first token of a long, repeated prompt?',
        options: [
          'Raising the temperature',
          'Putting the stable shared prefix first so it can be cached, and retrieving only the relevant chunks',
          'Switching the context to a larger window',
          'Asking for a longer answer',
        ],
        answer: 1,
        explain: 'Cached prefix tokens are cheaper and skip prefill work, and fewer retrieved tokens means less prefill and a smaller bill. A bigger window only raises the limit, and a longer answer adds decode time and output cost.',
      },
    },
  ],
};
