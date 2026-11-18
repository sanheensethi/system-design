import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const user: SceneNode = { id: 'user', kind: 'client', at: at(-4.4, -2.2), label: 'user' };
const eng: SceneNode = { id: 'eng', kind: 'block', at: at(0, -2.2), label: 'engine', sub: 'decode loop', icon: 'Repeat', tint: 'violet' };
const target: SceneNode = { id: 'target', kind: 'block', at: at(4.4, -2.2), label: 'target 70B', sub: 'big model', icon: 'Cpu', tint: 'amber' };
const draft: SceneNode = { id: 'draft', kind: 'block', at: at(-2.2, 5.4), label: 'draft 1B', sub: 'small model', icon: 'Zap', tint: 'teal' };
const weights: SceneNode = { id: 'weights', kind: 'block', size: 0.8, at: at(2.2, 3), label: 'weights', sub: '140 GB in HBM', icon: 'Database', tint: 'gray' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

export const aiSpeculativeDecoding: Lesson = {
  id: 'ai-speculative-decoding',
  title: 'Speculative decoding',
  tagline: 'Let a small model guess several tokens ahead and let the big model check them all in one pass.',
  minutes: 20,
  level: 'Advanced',
  learn: [
    'Why decode wastes the GPU: one weight read per token',
    'The draft and verify idea, and the accept-longest-prefix loop',
    'Rejection sampling and why the output distribution does not change',
    'Acceptance rate, draft length K and the 1.8 to 2.5x speedup',
    'Medusa and EAGLE heads, lookahead decoding and prompt lookup',
    'When it pays off and when it does not',
  ],
  metrics: [
    { key: 'tpot', label: 'Per token', icon: 'Clock' },
    { key: 'tpp', label: 'Tokens per pass', icon: 'Layers' },
    { key: 'acc', label: 'Acceptance', icon: 'Gauge' },
    { key: 'speed', label: 'Decode speedup', icon: 'TrendingUp' },
  ],
  steps: [
    {
      title: 'Slow trickle',
      tag: 'problem',
      heading: 'A huge model spends a whole pass on one word',
      eli5: 'The **teacher** is very wise but slow. Every single word of the answer makes her walk to the far shelf for her big book, even though the word is easy.',
      body: [
        'A 70B model streams an answer at about 20 ms per token. Each token needs a full trip through the weights, and token n needs token n-1 first, so one request cannot be spread across the GPU.',
        'The GPU is mostly waiting, not computing. Speculative decoding is a way to get more than one token out of each trip.',
      ],
      keyIdea: 'Decode produces one token per full pass over the weights, so output speed is capped by that pass.',
      metrics: { tpot: '20 ms', tpp: '1', acc: '-', speed: '1x' },
      metricTones: { tpot: 'warn' },
      scene: {
        nodes: [
          { ...user, chips: [{ text: 'long answer', tone: 'warn' }] },
          { ...eng },
          { ...target, status: 'hot', load: 30 },
        ],
        links: [link('user', 'eng', { label: 'stream' }), link('eng', 'target', { arrow: 'both' })],
        flows: [
          { path: ['eng', 'target'], tone: 'request', label: 'tok n-1', duration: 1.2 },
          { path: ['target', 'eng', 'user'], tone: 'response', label: 'tok n', duration: 1.6, delay: 1.3 },
        ],
        panel: {
          title: 'One request, decode only',
          icon: 'Timer',
          rows: [
            { text: 'Tokens per pass', value: '1', tone: 'warn' },
            { text: 'Time per token', value: '~20 ms' },
            { text: 'GPU compute busy', value: '10-25%', tone: 'warn' },
          ],
        },
        caption: 'One token per trip',
      },
    },
    {
      title: 'Memory bound',
      tag: 'concept',
      heading: 'Decode waits on memory, not math',
      eli5: 'The **teacher** spends most of her time walking to fetch the big book, and only a moment writing one word. Writing three words per trip would cost her almost no extra time.',
      body: [
        'To make one token the GPU streams about 140 GB of FP16 weights from HBM into its compute units, then does a tiny amount of math. The bytes moved set the time, not the arithmetic.',
        'That leaves spare compute. Checking several tokens in the same pass would cost little extra, because the weights are already on their way in.',
      ],
      keyIdea: 'Decode is memory-bound. Extra tokens in the same weight read are nearly free.',
      metrics: { tpot: '20 ms', tpp: '1', acc: '-', speed: '1x' },
      scene: {
        nodes: [
          { ...eng },
          { ...target, status: 'hot', load: 25 },
          { ...weights, status: 'active' },
        ],
        links: [link('eng', 'target'), link('weights', 'target', { label: '140 GB per token', labelTone: 'warn' })],
        flows: [
          { path: ['weights', 'target'], tone: 'data', label: 'weights', count: 3, duration: 1.4 },
          { path: ['target', 'eng'], tone: 'response', label: '1 tok', duration: 1.2, delay: 1.5 },
        ],
        panel: {
          title: 'Where a decode step goes',
          icon: 'Table',
          rows: [
            { text: 'Read weights from HBM', value: 'most of the time', tone: 'warn' },
            { text: 'Math for one token', value: 'small' },
            { text: 'Math for 5 tokens', value: 'still small', tone: 'good' },
          ],
        },
        caption: 'The trip costs more than the writing',
      },
    },
    {
      title: 'The idea',
      tag: 'concept',
      heading: 'Guess cheap, check once',
      eli5: 'A quick **helper pupil** whispers the next five words. The **teacher** reads them once and says which are right. Right words are kept, so she wrote five words for one trip.',
      body: [
        'A small **draft model** proposes the next K tokens cheaply. The big **target model** then runs all K in a single forward pass and says which ones it agrees with.',
        'The accepted tokens are committed, and the loop repeats from there.',
      ],
      keyIdea: 'Draft K tokens with a small model, verify them all with one pass of the big one.',
      metrics: { tpot: '20 ms', tpp: '1', acc: '-', speed: '1x' },
      scene: {
        nodes: [
          { ...eng, status: 'active' },
          { ...draft, status: 'active' },
          { ...target },
        ],
        links: [link('eng', 'draft', { label: 'ask for K guesses' }), link('eng', 'target', { label: 'verify together' })],
        flows: [
          { path: ['eng', 'draft', 'eng'], tone: 'event', label: 'K guesses', duration: 1.5 },
          { path: ['eng', 'target', 'eng'], tone: 'request', label: 'check K', duration: 1.6, delay: 1.6 },
        ],
        panel: {
          title: 'Two roles',
          icon: 'Users',
          rows: [
            { text: 'Draft model', value: 'proposes K tokens, cheap' },
            { text: 'Target model', value: 'verifies K in one pass' },
            { text: 'Quality', value: 'target decides', tone: 'good' },
          ],
        },
        caption: 'Propose, then verify',
      },
    },
    {
      title: 'The draft',
      tag: 'concept',
      heading: 'The draft model is small and quick',
      eli5: 'The **helper pupil** is young and reads a thin little book, so he answers fast. He is often wrong, and that is fine because the teacher checks.',
      body: [
        'A typical draft is a small sibling such as a 1B model drafting for a 70B target. Its weights are about 70 times smaller, so one draft step is a small fraction of a target step.',
        'It must share the target tokenizer and sit in GPU memory beside it. A draft that is wrong most of the time wastes the savings.',
      ],
      keyIdea: 'A draft is only useful when it is cheap to run and usually predicts what the target would say.',
      metrics: { tpot: '20 ms', tpp: '1', acc: '-', speed: '1x' },
      scene: {
        nodes: [
          { ...draft, status: 'active', load: 15 },
          { ...target, load: 25 },
          { ...weights, label: 'target weights', sub: '140 GB' },
        ],
        links: [link('draft', 'target', { label: 'same tokenizer' }), link('weights', 'target')],
        flows: [{ path: ['draft', 'target'], tone: 'event', label: 'tok tok tok tok tok', duration: 1.8 }],
        panel: {
          title: 'Draft vs target',
          icon: 'Table',
          rows: [
            { text: 'Draft (1B, FP16)', value: '~2 GB' },
            { text: 'Target (70B, FP16)', value: '~140 GB' },
            { text: 'Tokenizer', value: 'must match', tone: 'warn' },
            { text: 'Memory', value: 'both resident', tone: 'warn' },
          ],
        },
        caption: 'Fast, small, sometimes wrong',
      },
    },
    {
      title: 'Verify pass',
      tag: 'concept',
      heading: 'One forward pass scores all K guesses',
      eli5: 'The **teacher** reads all five whispered words side by side in one look, much like reading a sentence at once, and marks each one right or wrong.',
      body: [
        'Feed the context plus the K drafted tokens to the target. A single pass returns the target next-token probabilities at every position, so K guesses get K judgments for one weight read.',
        'This looks like prefill: many tokens in parallel. That is the work the GPU is good at, and it fits in the compute that decode left idle.',
      ],
      keyIdea: 'Verification is one parallel pass over K tokens, so its cost is close to a single decode step.',
      metrics: { tpot: '20 ms', tpp: '1', acc: '-', speed: '1x' },
      scene: {
        nodes: [
          { ...eng },
          { ...target, status: 'active', load: 45, chips: ['ctx + 5 drafts'] },
          { ...weights, size: 0.7 },
        ],
        links: [link('eng', 'target', { arrow: 'both' }), link('weights', 'target', { label: 'read once' })],
        flows: [
          { path: ['eng', 'target'], tone: 'request', label: 'ctx + d1..d5', duration: 1.5 },
          { path: ['target', 'eng'], tone: 'response', label: 'p1..p6', duration: 1.5, delay: 1.6 },
        ],
        panel: {
          title: 'What comes back',
          icon: 'Table',
          rows: [
            { text: 'Inputs', value: '5 draft tokens' },
            { text: 'Outputs', value: '6 distributions' },
            { text: 'Weight reads', value: '1', tone: 'good' },
          ],
          footer: { text: 'The sixth output is the next token after the last draft.', tone: 'muted' },
        },
        caption: 'Five checks, one read',
      },
    },
    {
      title: 'Accept prefix',
      tag: 'concept',
      heading: 'Keep the longest correct prefix',
      eli5: 'The **teacher** goes down the list and stops at the first wrong word. She keeps everything before it, fixes that word herself, and starts the next round from there.',
      body: [
        'Walk the drafts in order. Accept each token the target agrees with and stop at the first rejection. The target then supplies its own token for that position, so every pass yields at least one token.',
        'If all K are accepted, the pass yields a bonus token too, K + 1 in total.',
      ],
      keyIdea: 'Every pass commits the accepted prefix plus one token from the target, so progress never stalls.',
      metrics: { tpot: '~7 ms', tpp: '4', acc: '-', speed: '-' },
      scene: {
        nodes: [
          { ...draft, status: 'dim' },
          { ...eng, status: 'active' },
          { ...target, status: 'ok' },
        ],
        links: [link('draft', 'eng'), link('eng', 'target', { arrow: 'both' })],
        flows: [{ path: ['target', 'eng'], tone: 'response', label: '3 kept + 1 fixed', duration: 1.6 }],
        panel: {
          title: 'One round, K = 5',
          icon: 'Table',
          rows: [
            { text: 'd1 d2 d3', value: 'accepted', tone: 'good' },
            { text: 'd4', value: 'rejected', tone: 'bad' },
            { text: 'd5', value: 'dropped', tone: 'muted' },
            { text: 'Target token at d4', value: 'added' },
            { text: 'Tokens this pass', value: '4', tone: 'good' },
          ],
        },
        caption: 'Four tokens from one target pass',
      },
    },
    {
      title: 'Same output',
      tag: 'concept',
      heading: 'Rejection sampling keeps the output identical',
      eli5: 'The **teacher** does not just trust the pupil. She checks each word against what she would have written, so the finished essay is the one she would have written alone.',
      body: [
        'Each drafted token is accepted with probability min(1, p_target / p_draft). On rejection the replacement is sampled from the leftover difference between the two distributions.',
        'This is a proof, not a heuristic. Tokens come out distributed exactly as if the target had sampled them one by one, so quality does not change.',
      ],
      keyIdea: 'Rejection sampling makes speculative decoding lossless: the draft changes speed, never the output distribution.',
      metrics: { tpot: '~7 ms', tpp: '4', acc: '-', speed: '-' },
      scene: {
        nodes: [
          { ...draft, chips: ['p_draft = 0.30'] },
          { ...target, status: 'active', chips: ['p_target = 0.45'] },
          { ...eng, status: 'ok' },
        ],
        links: [link('draft', 'target', { label: 'token + p_draft' }), link('target', 'eng')],
        flows: [
          { path: ['draft', 'target'], tone: 'event', label: 'token', duration: 1.4 },
          { path: ['target', 'eng'], tone: 'response', label: 'accept', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Accept rule',
          icon: 'Scale',
          rows: [
            { text: 'Accept probability', value: 'min(1, p_target / p_draft)' },
            { text: 'Example', value: 'min(1, 0.45 / 0.30) = 1', tone: 'good' },
            { text: 'On reject', value: 'resample from the target' },
            { text: 'Result', value: 'same distribution', tone: 'good' },
          ],
        },
        caption: 'Checked, never trusted',
      },
    },
    {
      title: 'The loop',
      tag: 'concept',
      heading: 'The whole algorithm in a few lines',
      eli5: 'Whisper, check, keep the good words, repeat. The round ends only when the story is finished.',
      body: [
        'The engine alternates a cheap draft call with one expensive verify call. The same loop runs inside every request, for every batch entry.',
        'This is the shape from Leviathan et al. (2022). Later variants change how the drafts are produced, not the verify step.',
      ],
      keyIdea: 'Draft, verify once, commit the accepted prefix plus one, repeat.',
      metrics: { tpot: '~7 ms', tpp: '4', acc: '-', speed: '-' },
      code: {
        language: 'python',
        title: 'speculative_decode.py',
        source: `while not done:
    drafts, draft_probs = draft_model.generate(ctx, k=5)  # cheap
    target_probs = target_model.forward(ctx + drafts)   # one big pass
    n = rejection_sample(drafts, draft_probs, target_probs)
    ctx += drafts[:n] + [target_token_after(n)]         # prefix + 1
    ctx = cut_at_first_eos(ctx)
    done = ctx[-1] == EOS or len(ctx) >= max_tokens`,
        highlight: [2, 3, 5],
      },
      scene: {
        nodes: [{ ...eng, status: 'active' }, { ...draft }, { ...target }],
        links: [link('eng', 'draft', { arrow: 'both' }), link('eng', 'target', { arrow: 'both' })],
        flows: [
          { path: ['eng', 'draft', 'eng'], tone: 'event', label: 'd1..d5', duration: 1.3 },
          { path: ['eng', 'target', 'eng'], tone: 'request', label: 'verify', duration: 1.5, delay: 1.4 },
        ],
        panel: {
          title: 'Per round',
          icon: 'Repeat',
          rows: [
            { text: 'Draft calls', value: 'K small steps' },
            { text: 'Target calls', value: '1 big pass', tone: 'good' },
            { text: 'Tokens committed', value: '1 to K + 1' },
          ],
        },
        caption: 'Two calls per round',
      },
      quiz: {
        question: 'Why can speculative decoding speed up decode without changing the model output?',
        options: [
          'The draft model is always right',
          'The target checks K tokens in one pass and rejection sampling keeps its exact distribution',
          'It lowers the precision of the target weights',
          'It skips the target model on easy tokens',
        ],
        answer: 1,
        explain: 'The target still decides every token. Verifying K tokens in one pass is cheap because decode is memory-bound, and the accept rule keeps the output distribution identical.',
      },
    },
    {
      title: 'Acceptance',
      tag: 'tradeoff',
      heading: 'Acceptance rate decides the speedup',
      eli5: 'If the **helper pupil** guesses right most of the time, the **teacher** writes many words per trip. If he guesses badly, she keeps correcting and gains nothing.',
      body: [
        'Acceptance rate is how often a drafted token survives. It depends on how closely the draft mirrors the target. A well-matched pair reaches 60 to 80%, which gives about 1.8 to 2.5x faster decode. The token counts below assume each drafted token is accepted independently at the same rate.',
        'The gain is below K because drafting costs time and a rejection throws away the rest of the drafts.',
      ],
      keyIdea: 'Speedup tracks acceptance rate. A poorly matched draft can make decoding slower than plain decode.',
      metrics: { tpot: '~9 ms', tpp: '~2.9', acc: '70%', speed: '1.8-2.5x' },
      metricTones: { acc: 'good', speed: 'good' },
      scene: {
        nodes: [
          { ...draft, status: 'ok', badge: '70% hit' },
          { ...target, status: 'ok', load: 55 },
          { ...eng, status: 'ok' },
        ],
        links: [link('draft', 'target'), link('target', 'eng')],
        flows: [{ path: ['target', 'eng'], tone: 'response', label: '~3 tokens', count: 3, duration: 1.6 }],
        panel: {
          title: 'Tokens per pass, K = 5',
          icon: 'Table',
          rows: [
            { text: 'Acceptance 40%', value: '~1.7 tokens', tone: 'warn' },
            { text: 'Acceptance 70%', value: '~2.9 tokens', tone: 'good' },
            { text: 'Acceptance 85%', value: '~4.2 tokens', tone: 'good' },
          ],
          footer: { text: 'Draft time is not counted here, so real speedups are lower.', tone: 'muted' },
        },
        caption: 'Better match, more tokens per pass',
      },
    },
    {
      title: 'Choosing K',
      tag: 'tradeoff',
      heading: 'How many tokens to draft',
      eli5: 'Whispering one word wastes the trip. Whispering fifty means the first mistake spoils all the rest. The pupil should whisper a handful.',
      body: [
        'Larger K means more potential tokens per pass, but each extra draft is less likely to be reached, since all earlier ones must be accepted first. It also costs more draft time.',
        'Values around 3 to 8 are common. Some engines adapt K at run time from the recent acceptance rate.',
      ],
      keyIdea: 'Gains from larger K flatten quickly while draft cost keeps growing. Tune K per workload.',
      metrics: { tpot: '~9 ms', tpp: '~2.9', acc: '70%', speed: '~2x' },
      scene: {
        nodes: [
          { ...draft, status: 'active', chips: ['k = 5'] },
          { ...target, status: 'ok' },
          { ...eng },
        ],
        links: [link('eng', 'draft', { label: 'K guesses' }), link('draft', 'target')],
        flows: [{ path: ['eng', 'draft', 'target'], tone: 'event', label: 'd1 d2 d3 d4 d5', duration: 1.8 }],
        panel: {
          title: 'Tokens per pass at 70% acceptance',
          icon: 'Table',
          rows: [
            { text: 'K = 1', value: '1.7' },
            { text: 'K = 3', value: '2.5' },
            { text: 'K = 5', value: '2.9', tone: 'good' },
            { text: 'K = 10', value: '3.3', tone: 'warn' },
          ],
          footer: { text: 'Formula: (1 - a^(K+1)) / (1 - a)', tone: 'muted' },
        },
        caption: 'Diminishing returns',
      },
    },
    {
      title: 'Own heads',
      tag: 'concept',
      heading: 'Medusa and EAGLE drop the separate draft model',
      eli5: 'Instead of a second pupil, the **teacher** grows a few extra pens on her own hand. Each pen guesses a word further ahead, so there is no second desk to keep.',
      body: [
        '**Medusa** adds extra prediction heads on top of the target itself, each guessing a token further ahead. **EAGLE** drafts from the target internal features with a small head. No second model sits in memory. EAGLE and exact verification keep the output distribution identical, while Medusa typical-acceptance mode trades a small amount of fidelity for a higher accept rate.',
        'Candidates are checked in one pass, often as a small tree. By 2026 this is the common default.',
      ],
      keyIdea: 'Heads on the target remove the draft model, its memory and its tokenizer match problem.',
      metrics: { tpot: '~9 ms', tpp: '~2.5', acc: '-', speed: '~2x' },
      scene: {
        nodes: [
          { ...eng },
          { ...target, status: 'active', load: 55, badge: '+ heads' },
          { id: 'heads', kind: 'block', size: 0.8, at: at(2.2, 3), label: 'extra heads', sub: 'Medusa / EAGLE', icon: 'Split', tint: 'teal' },
        ],
        links: [link('eng', 'target', { arrow: 'both' }), link('target', 'heads', { label: 'features', arrow: 'both' })],
        flows: [
          { path: ['target', 'heads'], tone: 'data', label: 'hidden state', duration: 1.3 },
          { path: ['heads', 'target', 'eng'], tone: 'response', label: 'd1..d4 checked', duration: 1.8, delay: 1.4 },
        ],
        panel: {
          title: 'Draft source',
          icon: 'Table',
          rows: [
            { text: 'Separate draft', value: 'extra model in HBM', tone: 'warn' },
            { text: 'Medusa / EAGLE', value: 'small heads on target', tone: 'good' },
            { text: 'Tokenizer match', value: 'automatic', tone: 'good' },
            { text: 'Cost', value: 'train the heads' },
          ],
        },
        caption: 'The model drafts for itself',
      },
    },
    {
      title: 'Lookahead',
      tag: 'concept',
      heading: 'Lookahead decoding needs no draft at all',
      eli5: 'The **teacher** works on several guesses at once and notices when old guesses turn out right. She reuses those without any pupil.',
      body: [
        '**Lookahead decoding** uses Jacobi iteration. The target refines a window of future positions in parallel, and token runs that stay stable across iterations become drafts.',
        'It suits cases where no draft model fits. It spends extra compute per pass, so gains are usually smaller than a good draft pair.',
      ],
      keyIdea: 'Lookahead trades extra parallel compute for drafts, with no second model and no extra heads.',
      metrics: { tpot: '~12 ms', tpp: '~1.7', acc: '-', speed: '~1.5x' },
      scene: {
        nodes: [
          { ...eng },
          { ...target, status: 'active', load: 70, chips: ['window of guesses'] },
          { id: 'pool', kind: 'cache', at: at(4.4, 2.6), label: 'n-gram pool', sub: 'stable runs' },
        ],
        links: [link('eng', 'target', { arrow: 'both' }), link('target', 'pool', { arrow: 'both' })],
        flows: [
          { path: ['target', 'pool'], tone: 'data', label: 'stable run', duration: 1.3 },
          { path: ['pool', 'target', 'eng'], tone: 'response', label: 'reuse as draft', duration: 1.8, delay: 1.4 },
        ],
        panel: {
          title: 'Trade',
          icon: 'Table',
          rows: [
            { text: 'Draft model', value: 'none', tone: 'good' },
            { text: 'Extra compute per pass', value: 'yes', tone: 'warn' },
            { text: 'Typical gain', value: 'smaller than a good pair' },
          ],
        },
        caption: 'Drafts mined from the target',
      },
    },
    {
      title: 'Prompt lookup',
      tag: 'case',
      heading: 'In RAG, copy the draft from the context',
      eli5: 'If the answer quotes the page the pupil was handed, the **helper** just copies the next words from that page. Copying is free.',
      body: [
        '**Prompt lookup decoding** finds the last few generated tokens inside the prompt and proposes whatever followed them there. In RAG, answers often quote retrieved passages, so the guesses land.',
        'It needs no model and almost no time. Gains reach about 2x when the answer quotes the context, and vanish when it does not.',
      ],
      keyIdea: 'When output echoes input, the input is a free draft.',
      metrics: { tpot: '~10 ms', tpp: '~2', acc: 'high on quotes', speed: '~2x' },
      scene: {
        nodes: [
          { id: 'ctx', kind: 'storage', at: at(-4.4, 2.6), label: 'retrieved docs', sub: 'in the prompt' },
          { ...eng, status: 'active' },
          { ...target, status: 'ok' },
        ],
        links: [link('ctx', 'eng', { label: 'match last tokens' }), link('eng', 'target', { arrow: 'both' })],
        flows: [
          { path: ['ctx', 'eng'], tone: 'event', label: 'copy next 5', duration: 1.4 },
          { path: ['eng', 'target', 'eng'], tone: 'request', label: 'verify', duration: 1.6, delay: 1.5 },
        ],
        panel: {
          title: 'Where it helps',
          icon: 'Table',
          rows: [
            { text: 'RAG answer quoting a passage', value: '~2x', tone: 'good' },
            { text: 'Code edits, summaries of text', value: 'good' },
            { text: 'Fresh creative text', value: 'little gain', tone: 'warn' },
          ],
        },
        caption: 'The prompt is the draft',
      },
    },
    {
      title: 'When it pays',
      tag: 'tradeoff',
      heading: 'It helps decode-heavy work and little else',
      eli5: 'Whispering helps when the essay is long. For a one-word answer, the trip to the shelf was already short, so there is nothing to save.',
      body: [
        'It pays for long outputs and chat, where decode dominates. A 5-token answer is mostly prefill, so there is nothing to speed up.',
        'It also loses when the draft does not fit in GPU memory beside the target, or when large batches already use the idle compute that verification relies on.',
      ],
      keyIdea: 'Use it where decode dominates and spare memory and compute exist. Measure before enabling everywhere.',
      metrics: { tpot: 'varies', tpp: '1 to 4', acc: 'varies', speed: 'workload bound' },
      metricTones: { speed: 'warn' },
      scene: {
        nodes: [
          { ...user },
          { ...eng },
          { ...target, status: 'ok', load: 60 },
        ],
        links: [link('user', 'eng'), link('eng', 'target')],
        flows: [{ path: ['target', 'eng', 'user'], tone: 'response', label: 'tokens', count: 3, duration: 1.8 }],
        panel: {
          title: 'Worth it?',
          icon: 'Scale',
          rows: [
            { text: 'Long chat answers', value: 'yes', tone: 'good' },
            { text: '5-token answers', value: 'no, prefill dominates', tone: 'bad' },
            { text: 'Draft will not fit beside target', value: 'no', tone: 'bad' },
            { text: 'Huge batch, compute already busy', value: 'smaller gain', tone: 'warn' },
          ],
        },
        caption: 'Check the workload first',
      },
    },
    {
      title: 'In production',
      tag: 'case',
      heading: 'A chat fleet turns it on by default',
      eli5: 'The school lets every teacher use a helper for long essays. The rule is simple: helpers for chat, no helpers for one-word answers.',
      body: [
        'A 10K-QPS chat product runs it on every tier, usually with Medusa-style heads on the base model so no second model competes for HBM. It sits beside FP8 weights, FP8 KV cache and admission control.',
        'Track acceptance rate as a metric. A drop means the draft drifted from the target, for example after a model update.',
      ],
      keyIdea: 'Run it as a default for chat, monitor acceptance, and re-tune the draft when the target changes.',
      metrics: { tpot: '~9 ms', tpp: '~2.5', acc: '70%', speed: '~2x' },
      metricTones: { tpot: 'good', acc: 'good', speed: 'good' },
      scene: {
        nodes: [
          { ...user },
          { id: 'gw', kind: 'block', at: at(0, -2.2), label: 'gateway', sub: 'routes + limits', icon: 'Router', tint: 'blue' },
          { ...target, label: 'serving tier', sub: '70B + heads', status: 'ok', load: 65 },
          { id: 'mon', kind: 'monitor', at: at(4.4, 2.6), label: 'metrics', sub: 'acceptance rate' },
        ],
        links: [link('user', 'gw'), link('gw', 'target'), link('target', 'mon', { style: 'dashed' })],
        flows: [
          { path: ['user', 'gw', 'target'], tone: 'request', label: 'chat', duration: 1.5 },
          { path: ['target', 'gw', 'user'], tone: 'response', label: 'tokens', count: 3, duration: 1.6, delay: 1.6 },
          { path: ['target', 'mon'], tone: 'event', label: 'accept 70%', duration: 1.2, delay: 1.8 },
        ],
        panel: {
          title: 'Serving defaults',
          icon: 'Table',
          rows: [
            { text: 'Speculation', value: 'on for chat tiers', tone: 'good' },
            { text: 'Weights and KV', value: 'FP8' },
            { text: 'Alert if acceptance', value: 'drops sharply', tone: 'warn' },
          ],
        },
        caption: 'On by default, watched',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Guess ahead, verify once, lose nothing',
      eli5: 'The helper whispers, the teacher checks all the words at once and keeps the right ones. Essays finish sooner and read exactly as she would have written them.',
      body: [
        'Decode is memory-bound, so verifying K drafted tokens in one target pass is almost free. Accept the longest correct prefix plus one token, and rejection sampling keeps the output identical.',
        'Acceptance rate sets the gain: 1.8 to 2.5x at 60 to 80%. Drafts come from a small model, Medusa or EAGLE heads, lookahead or the prompt. Use it for decode-heavy chat, not short outputs.',
      ],
      keyIdea: 'Speculative decoding converts idle compute into fewer weight reads, at no cost in quality.',
      metrics: { tpot: '~9 ms', tpp: '~2.9', acc: '70%', speed: '1.8-2.5x' },
      metricTones: { tpot: 'good', tpp: 'good', acc: 'good', speed: 'good' },
      scene: {
        nodes: [
          { ...user, status: 'ok' },
          { ...eng, status: 'ok' },
          { ...draft, status: 'ok' },
          { ...target, status: 'ok', load: 55 },
        ],
        links: [link('user', 'eng'), link('eng', 'draft', { arrow: 'both' }), link('eng', 'target', { arrow: 'both' })],
        flows: [
          { path: ['eng', 'draft', 'eng'], tone: 'event', label: 'guess K', duration: 1.3 },
          { path: ['eng', 'target', 'eng'], tone: 'request', label: 'verify', duration: 1.4, delay: 1.4 },
          { path: ['eng', 'user'], tone: 'response', label: '~3 tokens', duration: 1.2, delay: 2.9 },
        ],
        panel: {
          title: 'Cheat sheet',
          icon: 'Table',
          rows: [
            { text: 'Why it works', value: 'decode is memory-bound' },
            { text: 'Output quality', value: 'identical', tone: 'good' },
            { text: 'Speedup', value: '1.8-2.5x at 60-80% accept', tone: 'good' },
            { text: 'Skip it for', value: 'short outputs', tone: 'warn' },
          ],
        },
        caption: 'Fewer weight reads per token',
      },
      quiz: {
        question: 'A chat feature mostly returns 5-token answers to long prompts. Will speculative decoding help much?',
        options: [
          'Yes, it speeds up prefill by 2x',
          'Yes, because more drafts are always better',
          'Little, because time is dominated by prefill and there is almost no decode to speed up',
          'No, because it changes the output quality',
        ],
        answer: 2,
        explain: 'Speculation only shortens decode. With 5 output tokens, prefill is most of the latency, and the draft step adds overhead. Quality is unaffected either way.',
      },
    },
  ],
};
