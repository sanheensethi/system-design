import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const user: SceneNode = { id: 'user', kind: 'user', at: at(-4.4, -2.2), label: 'users' };
const queue: SceneNode = { id: 'queue', kind: 'queue', at: at(-4.4, 2.6), label: 'waiting', sub: 'request queue' };
const eng: SceneNode = { id: 'eng', kind: 'block', at: at(0, -2.2), label: 'scheduler', sub: 'builds each batch', icon: 'Network', tint: 'violet' };
const gpu: SceneNode = { id: 'gpu', kind: 'block', at: at(4.4, -2.2), label: 'GPU', sub: '70B model', icon: 'Cpu', tint: 'amber' };
const kv: SceneNode = { id: 'kv', kind: 'cache', at: at(4.4, 2.6), label: 'KV cache', sub: 'one slot per request' };
const weights: SceneNode = { id: 'weights', kind: 'block', size: 0.8, at: at(0, 2.6), label: 'weights', sub: '140 GB', icon: 'Database', tint: 'gray' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

export const aiContinuousBatching: Lesson = {
  id: 'ai-continuous-batching',
  title: 'Continuous batching',
  tagline: 'How one GPU serves dozens of chats at once, by rebuilding the batch at every single token.',
  minutes: 18,
  level: 'Advanced',
  learn: [
    'Why one request at a time wastes a memory-bound decode GPU',
    'Static batching, the straggler problem and the idle slots it creates',
    'Continuous (in-flight) batching: a fresh batch at every decode step',
    'How requests leave on end of sequence and join after prefill',
    'Chunked prefill, and prefill-decode disaggregation',
    'KV memory as the ceiling on batch size, and the throughput versus latency trade',
    'The scheduler knobs and the numbers to watch in production',
  ],
  metrics: [
    { key: 'tput', label: 'Throughput', icon: 'TrendingUp' },
    { key: 'batch', label: 'Batch size', icon: 'Layers' },
    { key: 'wait', label: 'Queue wait', icon: 'Clock' },
    { key: 'useful', label: 'Useful slots', icon: 'Gauge' },
  ],
  steps: [
    {
      title: 'One by one',
      tag: 'problem',
      heading: 'A for-loop over generate leaves the GPU mostly idle',
      eli5: 'A city **bus** drives its whole route for a single passenger. The engine runs, the fuel burns, and nearly every seat is empty.',
      body: [
        'The first serving code most teams write is a loop: take a request, call `model.generate`, send the answer, take the next one. It works. It also leaves a GPU that costs tens of thousands of dollars producing about **50 tokens per second**.',
        'Decode reads the whole model from memory for every token, yet it keeps the GPU compute at only 10 to 25 percent busy. The hardware is waiting, not working.',
      ],
      keyIdea: 'Serving one request at a time pays for the whole GPU and uses a sliver of it.',
      metrics: { tput: '~50 tok/s', batch: '1', wait: 'grows fast', useful: '10-25%' },
      metricTones: { tput: 'bad', batch: 'bad', useful: 'bad' },
      scene: {
        nodes: [
          { ...user, chips: [{ text: '20 chats waiting', tone: 'warn' }] },
          { ...eng, label: 'for-loop', sub: 'generate(prompt)' },
          { ...gpu, status: 'hot', load: 18, chips: [{ text: 'batch = 1', tone: 'bad' }] },
        ],
        links: [link('user', 'eng'), link('eng', 'gpu')],
        flows: [
          { path: ['user', 'eng', 'gpu'], tone: 'request', label: 'one prompt', duration: 1.6 },
          { path: ['gpu', 'eng', 'user'], tone: 'response', label: 'tok', count: 3, duration: 1.8, delay: 1.7 },
        ],
        panel: {
          title: 'One request, one GPU',
          icon: 'Gauge',
          rows: [
            { text: 'Decode step', value: '~20 ms' },
            { text: 'Tokens per step', value: '1', tone: 'bad' },
            { text: 'Compute busy', value: '10-25%', tone: 'bad' },
            { text: 'Everyone else', value: 'waits in line', tone: 'warn' },
          ],
        },
        caption: 'An expensive GPU serving one chat',
      },
    },
    {
      title: 'Why batch',
      tag: 'concept',
      heading: 'A decode step costs about the same for 1 request or 32',
      eli5: 'The bus driver takes the same trip whether one rider or thirty-two climb aboard. More riders per trip means each ride costs far less.',
      body: [
        'Decode is **memory-bound**: each step streams the weights from GPU memory, and that read is the cost. Those weights are the same for every request, so one read can serve many sequences.',
        'Group requests into a **batch** and every decode step produces one token for each of them. The step takes a little longer, but you get many tokens instead of one.',
      ],
      keyIdea: 'Batching shares one weight read across many requests, so tokens per second climbs while the step time barely moves.',
      metrics: { tput: '50 to ~1,280 tok/s', batch: '1 to 32', wait: '-', useful: '-' },
      metricTones: { tput: 'good' },
      scene: {
        nodes: [
          { ...weights, at: at(-4.2, 0), badge: 'read once per step' },
          { ...gpu, at: at(0, -2), load: 70, chips: [{ text: 'batch = 32', tone: 'good' }] },
          { ...user, at: at(4.4, 1.6), chips: ['32 tokens out'] },
        ],
        links: [link('weights', 'gpu'), link('gpu', 'user')],
        flows: [
          { path: ['weights', 'gpu'], tone: 'data', label: 'weights', duration: 1.4 },
          { path: ['gpu', 'user'], tone: 'response', label: '32 tokens', count: 3, duration: 1.6, delay: 1.5 },
        ],
        panel: {
          title: 'One decode step (illustrative)',
          icon: 'Table',
          rows: [
            { text: 'Batch of 1', value: '20 ms, 50 tok/s' },
            { text: 'Batch of 32', value: '~25 ms, ~1,280 tok/s', tone: 'good' },
            { text: 'Per user at 32', value: '~40 tok/s', tone: 'good' },
          ],
          footer: { text: 'Same weight read, 25x the tokens', tone: 'good' },
        },
        caption: 'One read of the weights, many tokens out',
      },
    },
    {
      title: 'Static batching',
      tag: 'concept',
      heading: 'Static batching: fill the bus, drive to the end, then everyone gets off',
      eli5: 'A **bus** waits at the first stop until every seat is taken. Then it drives to the very last stop on the route, and nobody may get off or on until it gets there.',
      body: [
        '**Static batching** collects N requests, runs them together until the whole batch is done, then returns all the answers at once. It is the obvious way to batch, and it is what most classic ML serving does.',
        'It fits models that do the same work for every input. LLM output length is not fixed, and that is where it breaks.',
      ],
      keyIdea: 'Static batching admits requests only between batches and returns them only when the last one finishes.',
      metrics: { tput: 'better than 1', batch: '32 (fixed)', wait: 'fill + run', useful: '-' },
      scene: {
        nodes: [
          { ...user, chips: ['32 chats'] },
          { ...queue, status: 'active', badge: 'wait for 32' },
          { ...gpu, load: 75, chips: [{ text: 'batch = 32', tone: 'good' }] },
        ],
        links: [link('user', 'queue'), link('queue', 'gpu', { label: 'whole batch' })],
        flows: [
          { path: ['user', 'queue'], tone: 'request', label: 'prompts', count: 3, duration: 1.4 },
          { path: ['queue', 'gpu'], tone: 'request', label: '32 together', duration: 1.4, delay: 1.5 },
          { path: ['gpu', 'user'], tone: 'response', label: 'all 32 at once', duration: 1.6, delay: 3 },
        ],
        panel: {
          title: 'Static batching rules',
          icon: 'List',
          rows: [
            { text: 'Join', value: 'only when a new batch starts' },
            { text: 'Run', value: 'until the longest one ends', tone: 'warn' },
            { text: 'Return', value: 'all answers together', tone: 'warn' },
          ],
        },
        caption: 'Collect, run, return, repeat',
      },
    },
    {
      title: 'Stragglers',
      tag: 'case',
      heading: 'Case: 31 requests finish at token 50, one runs to 500',
      eli5: 'Thirty-one riders only wanted to go three stops. One wants the end of the line. The bus drives all the way with 31 empty seats and no new riders allowed.',
      body: [
        'Output lengths vary a lot. In a batch of 32, 31 requests stop at token 50 and one runs to token 500. The batch keeps stepping until token 500, so it takes `500 x 20 ms` = **10 s**.',
        'The 31 short requests could have been done in 1 s. They wait 9 s extra for no reason, and after step 50 the GPU decodes one real sequence in a batch of 32.',
      ],
      keyIdea: 'In a static batch the longest output sets the time for everyone, and finished slots do nothing.',
      metrics: { tput: 'collapses', batch: '32, then 1 live', wait: '10 s for all', useful: '13%' },
      metricTones: { tput: 'bad', wait: 'bad', useful: 'bad' },
      scene: {
        nodes: [
          { ...user, status: 'hot', badge: '31 done at 1 s' },
          { ...gpu, status: 'hot', load: 30, chips: [{ text: '31 slots idle', tone: 'bad' }] },
          { ...kv, at: at(4.4, 2.6), badge: '1 of 32 live', chips: [{ text: 'token 500', tone: 'warn' }] },
        ],
        links: [link('gpu', 'user', { label: 'held until 10 s', labelTone: 'warn' }), link('gpu', 'kv')],
        flows: [
          { path: ['gpu', 'kv'], tone: 'data', label: '1 live sequence', duration: 1.6 },
          { path: ['gpu', 'user'], tone: 'error', label: 'held back', duration: 1.8, delay: 1.7 },
        ],
        panel: {
          title: 'Slot math, batch of 32',
          icon: 'Table',
          rows: [
            { text: 'Steps run', value: '500' },
            { text: 'Slots paid for', value: '32 x 500 = 16,000' },
            { text: 'Slots that made tokens', value: '31x50 + 500 = 2,050', tone: 'warn' },
            { text: 'Useful share', value: '~13%', tone: 'bad' },
          ],
          footer: { text: '31 slots wait for a GPU-worth of nothing', tone: 'bad' },
        },
        caption: 'Idle seats on a bus that cannot stop',
      },
    },
    {
      title: 'Closed door',
      tag: 'case',
      heading: 'Case: new requests wait outside while seats sit empty',
      eli5: 'New riders stand at the stop and watch the bus go by with empty seats. The rule says they wait for the next trip, which starts ten seconds from now.',
      body: [
        'While the straggler runs, 31 slots hold nothing, but a request that arrives at second 2 cannot use them. It waits in the queue until the batch ends, then waits again if the next batch must fill first.',
        'Queue time adds straight onto **TTFT**, the time to first token. A user can wait seconds before the model has even started on their prompt.',
      ],
      keyIdea: 'Static batching wastes capacity and adds queue time at once, because free slots stay locked.',
      metrics: { tput: 'low', batch: '32, mostly idle', wait: 'up to 10 s', useful: '13%' },
      metricTones: { wait: 'bad', useful: 'bad' },
      scene: {
        nodes: [
          { ...queue, status: 'hot', badge: 'arrived at 2 s', chips: [{ text: 'waits ~8 s', tone: 'bad' }] },
          { ...gpu, load: 30, chips: [{ text: '31 slots empty', tone: 'warn' }] },
          { ...user, at: at(0, -2.2), chips: ['new chat'] },
        ],
        links: [link('user', 'queue'), link('queue', 'gpu', { label: 'door shut', labelTone: 'bad' })],
        flows: [
          { path: ['user', 'queue'], tone: 'request', label: 'new prompt', duration: 1.4 },
          { path: ['queue', 'gpu'], tone: 'error', label: 'not yet', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'A request arriving at t = 2 s',
          icon: 'Clock',
          rows: [
            { text: 'Free slots in the batch', value: '31', tone: 'warn' },
            { text: 'Slots it may use', value: '0', tone: 'bad' },
            { text: 'Starts at', value: 'next batch, ~10 s', tone: 'bad' },
          ],
          footer: { text: 'Queue wait lands on TTFT', tone: 'bad' },
        },
        caption: 'Capacity free, door shut',
      },
    },
    {
      title: 'Every step',
      tag: 'concept',
      heading: 'Continuous batching: rebuild the batch at every decode step',
      eli5: 'Now the **bus** has a door at every stop. Riders get off the moment they arrive, and people waiting hop on into the empty seats before the bus rolls again.',
      body: [
        '**Continuous batching**, also called **in-flight** or iteration-level batching, comes from the Orca paper (2022). The scheduler picks the batch again at every decode step, not once per batch.',
        'Finished requests drop out. Waiting requests join. The batch size is re-chosen each iteration, so a slot is never held for a request that is done.',
      ],
      keyIdea: 'The unit of scheduling is one decode step, not one request. Slots free up and refill every iteration.',
      metrics: { tput: '3-10x static', batch: 'changes every step', wait: 'short', useful: 'high' },
      metricTones: { tput: 'good', wait: 'good', useful: 'good' },
      scene: {
        nodes: [
          { ...queue, badge: 'join any step' },
          { ...eng, status: 'active', chips: [{ text: 'new batch / step', tone: 'good' }] },
          { ...gpu, load: 88, chips: [{ text: 'always full', tone: 'good' }] },
        ],
        links: [link('queue', 'eng'), link('eng', 'gpu')],
        flows: [
          { path: ['queue', 'eng', 'gpu'], tone: 'request', label: 'joins this step', duration: 1.6 },
          { path: ['gpu', 'eng'], tone: 'response', label: 'tokens + done flags', duration: 1.4, delay: 1.7 },
        ],
        panel: {
          title: 'Scheduling unit',
          icon: 'Repeat',
          rows: [
            { text: 'Static batching', value: 'one batch', tone: 'warn' },
            { text: 'Continuous batching', value: 'one decode step', tone: 'good' },
            { text: 'Origin', value: 'Orca, 2022' },
          ],
          footer: { text: 'Now standard in every serious engine', tone: 'good' },
        },
        caption: 'The batch is re-chosen every iteration',
      },
    },
    {
      title: 'Leaving early',
      tag: 'concept',
      heading: 'A request leaves the batch the moment it ends',
      eli5: 'A rider reaches their stop and steps off. The seat is free right away, and that rider is already home instead of riding to the end of the line.',
      body: [
        'A sequence ends when the model emits an **end-of-sequence** token (`<EOS>`) or hits its `max_tokens` limit. At that step the scheduler removes it, and its answer goes back to the user immediately.',
        'The 31 short requests now finish at about 1 s, not 10 s. Each freed slot is open for the next step.',
      ],
      keyIdea: 'Finished requests return at once and give their slot back, so latency follows each request, not the batch.',
      metrics: { tput: 'up', batch: '32 to 1 to refilled', wait: '-', useful: 'high' },
      metricTones: { useful: 'good' },
      scene: {
        nodes: [
          { ...gpu, load: 85, chips: ['step 50'] },
          { ...user, status: 'ok', badge: '31 done at 1 s', chips: [{ text: '<EOS>', tone: 'good' }] },
          { ...kv, status: 'active', badge: '31 slots freed' },
        ],
        links: [link('gpu', 'user'), link('gpu', 'kv')],
        flows: [
          { path: ['gpu', 'user'], tone: 'response', label: 'full answer', count: 3, duration: 1.6 },
          { path: ['gpu', 'kv'], tone: 'event', label: 'free 31 slots', duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'A request leaves',
          icon: 'ArrowLeftRight',
          rows: [
            { text: 'Trigger', value: '<EOS> or max_tokens' },
            { text: 'Reply', value: 'sent immediately', tone: 'good' },
            { text: 'KV slot', value: 'released this step', tone: 'good' },
            { text: 'Short chat latency', value: '10 s to ~1 s', tone: 'good' },
          ],
        },
        caption: 'Finish early, leave early',
      },
    },
    {
      title: 'Joining',
      tag: 'concept',
      heading: 'A new request joins right after its prefill',
      eli5: 'A new rider boards at the next stop. First the driver checks their ticket (that is the **prefill**), then they take a seat and ride along with everyone else.',
      body: [
        'A new request must run **prefill** first: one big parallel pass over its whole prompt that builds its KV cache and produces its first token. After that it is a normal decoding sequence.',
        'The scheduler adds it to the next step. A newcomer waits about one step, never a whole batch.',
      ],
      keyIdea: 'Arrivals pay for prefill, then ride with the current batch from the next step on.',
      metrics: { tput: 'steady', batch: '3 to 4 to 3', wait: '~1 step + prefill', useful: 'high' },
      metricTones: { wait: 'good' },
      scene: {
        nodes: [
          { ...queue, chips: ['R4 arrives'] },
          { ...gpu, load: 86, status: 'active', chips: ['R1 ends', 'R2', 'R3', 'R4 prefill'] },
          { ...kv, badge: 'R4 gets a slot' },
        ],
        links: [link('queue', 'gpu'), link('gpu', 'kv')],
        flows: [
          { path: ['queue', 'gpu'], tone: 'request', label: 'R4 prompt', duration: 1.5 },
          { path: ['gpu', 'kv'], tone: 'data', label: 'K,V for R4', duration: 1.5, delay: 1.6 },
        ],
        panel: {
          title: 'The batch, step by step',
          icon: 'List',
          rows: [
            { text: 't=0', value: '[R1]' },
            { text: 't=1', value: '[R1, R2 prefill]' },
            { text: 't=2', value: '[R1, R2]' },
            { text: 't=3', value: '[R1, R2, R3]' },
            { text: 't=4  R1 hits <EOS>', value: '[R1, R2, R3, R4 prefill]', tone: 'good' },
            { text: 't=5', value: '[R2, R3, R4]' },
          ],
        },
        caption: 'The batch changes shape every step',
      },
      quiz: {
        question: 'In continuous batching, when can a finished request give up its slot?',
        options: [
          'Only when every request in the batch has finished',
          'At the next batch boundary, after a timeout',
          'At the decode step where it emits end of sequence',
          'Only when new requests are waiting for a slot',
        ],
        answer: 2,
        explain: 'The batch is rebuilt every decode step, so a request that emits <EOS> is removed at once and its reply goes out. Static batching holds it until the whole batch ends.',
      },
    },
    {
      title: 'Scheduler loop',
      tag: 'concept',
      heading: 'The whole idea fits in a short loop',
      eli5: 'At every stop the driver asks three questions: who gets off, who is waiting, and are there any seats left? Then the bus moves one stop.',
      body: [
        'Each iteration does four things: drop finished sequences, admit waiting ones while there is room, run one forward pass, and append one token to every live sequence.',
        'Real engines add priorities and memory checks, but the loop shape is this one.',
      ],
      keyIdea: 'Continuous batching is a while loop that edits the running set between forward passes.',
      metrics: { tput: '-', batch: 'running set', wait: '-', useful: '-' },
      scene: {
        nodes: [
          { ...queue, chips: ['waiting list'] },
          { ...eng, status: 'active' },
          { ...gpu, load: 88 },
        ],
        links: [link('queue', 'eng'), link('eng', 'gpu', { label: 'one step' })],
        flows: [
          { path: ['queue', 'eng'], tone: 'request', label: 'admit', duration: 1.2 },
          { path: ['eng', 'gpu'], tone: 'request', label: 'run batch', duration: 1.2, delay: 1.3 },
          { path: ['gpu', 'eng'], tone: 'response', label: '+1 token each', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'One iteration',
          icon: 'Repeat',
          rows: [
            { text: '1. Remove', value: 'finished sequences' },
            { text: '2. Admit', value: 'waiting, if room' },
            { text: '3. Forward pass', value: 'one step' },
            { text: '4. Append', value: 'one token each', tone: 'good' },
          ],
        },
        caption: 'Edit the running set, step, repeat',
      },
      code: {
        language: 'python',
        title: 'A continuous batching loop (sketch)',
        source: `running, waiting = [], deque()

while True:
    # 1. finished requests leave and free their KV slot
    for r in [r for r in running if r.done]:
        running.remove(r)
        kv.free(r)
        r.reply()

    # 2. admit waiting requests while there is room
    while waiting and len(running) < MAX_SEQS and kv.can_fit(waiting[0]):
        r = waiting.popleft()
        r.prefill()              # builds its KV, emits token 1
        running.append(r)

    # 3. one decode step for everyone, then 4. append a token each
    tokens = model.decode_step(running)
    for r, t in zip(running, tokens):
        r.append(t)              # sets r.done on <EOS> or max_tokens`,
        highlight: [4, 5, 6, 7, 10, 11, 12, 13, 16, 17],
      },
    },
    {
      title: 'Prefill stalls',
      tag: 'tradeoff',
      heading: 'A long prompt can freeze everyone who is mid-answer',
      eli5: 'A rider boards with a huge suitcase and the driver spends a long time checking and loading it. Everyone already on the bus sits waiting, so their ride stutters.',
      body: [
        'Prefill is compute-heavy. A 2,000-token prompt takes about **150 ms** to prefill, while a decode step takes about 20 ms. If the step includes that whole prefill, every other sequence waits 150 ms for its next token.',
        'Users see a stutter in streams that were smooth: **TPOT**, time per output token, spikes from 20 ms to about 170 ms for that step.',
      ],
      keyIdea: 'Joining is not free: a big prefill inside a step delays the token every other request was about to get.',
      metrics: { tput: 'dips', batch: '31 + 1 prefill', wait: '-', useful: '-' },
      metricTones: { tput: 'warn' },
      scene: {
        nodes: [
          { ...queue, chips: [{ text: '2,000-token prompt', tone: 'warn' }] },
          { ...gpu, status: 'hot', load: 97, chips: [{ text: 'prefill ~150 ms', tone: 'bad' }] },
          { ...user, chips: [{ text: 'stream stalls', tone: 'bad' }] },
        ],
        links: [link('queue', 'gpu'), link('gpu', 'user', { label: 'TPOT 20 to 170 ms', labelTone: 'warn' })],
        flows: [
          { path: ['queue', 'gpu'], tone: 'request', label: '2,000 tokens', duration: 1.5 },
          { path: ['gpu', 'user'], tone: 'error', label: 'late token', duration: 1.8, delay: 1.6 },
        ],
        panel: {
          title: 'One step with a whole prefill',
          icon: 'Timer',
          rows: [
            { text: 'Normal decode step', value: '~20 ms', tone: 'good' },
            { text: 'Prefill of 2K tokens', value: '~150 ms', tone: 'warn' },
            { text: 'Step with both', value: '~170 ms', tone: 'bad' },
          ],
          footer: { text: 'Every live stream waits for it', tone: 'bad' },
        },
        caption: 'One big prompt, 31 stalled streams',
      },
    },
    {
      title: 'Chunked prefill',
      tag: 'concept',
      heading: 'Chunked prefill: split the prompt and mix it into decode steps',
      eli5: 'The driver loads the big suitcase a few items at a time, at several stops. Riders keep moving, and the suitcase is on board a few stops later.',
      body: [
        '**Chunked prefill** cuts a long prompt into pieces, for example 512 tokens. Each step carries the live decodes plus one chunk, within a **token budget** per step.',
        'A 2,000-token prompt takes about four steps instead of one big stall. Its own first token arrives a bit later, but nobody else sees a spike.',
      ],
      keyIdea: 'Chunked prefill trades a slightly later first token for one new request for steady streaming for all the others.',
      metrics: { tput: 'steady', batch: '31 + 1 chunk', wait: '-', useful: 'high' },
      metricTones: { tput: 'good' },
      scene: {
        nodes: [
          { ...queue, chips: ['2,000 tokens'] },
          { ...eng, status: 'active', chips: [{ text: '512 per step', tone: 'good' }] },
          { ...gpu, load: 90, chips: ['31 decodes + 1 chunk'] },
        ],
        links: [link('queue', 'eng', { label: '4 chunks' }), link('eng', 'gpu')],
        flows: [
          { path: ['queue', 'eng', 'gpu'], tone: 'request', label: 'chunk 1 of 4', duration: 1.6 },
          { path: ['gpu', 'eng'], tone: 'response', label: '31 tokens on time', duration: 1.4, delay: 1.7 },
        ],
        panel: {
          title: 'Whole prefill vs chunked (illustrative)',
          icon: 'Table',
          rows: [
            { text: 'Whole prefill', value: 'one ~170 ms step', tone: 'bad' },
            { text: 'Chunked, 512 each', value: '4 steps of ~60 ms', tone: 'good' },
            { text: 'Other streams', value: 'no 150 ms stall', tone: 'good' },
            { text: 'New request TTFT', value: 'slightly later', tone: 'warn' },
          ],
        },
        caption: 'The prompt arrives a chunk per step',
      },
    },
    {
      title: 'Split pools',
      tag: 'tradeoff',
      heading: 'At large scale, give prefill and decode their own GPUs',
      eli5: 'A big city runs one set of buses for boarding and ticket checks, and a different set for the long ride. Neither job slows the other.',
      body: [
        'Prefill saturates compute and decode saturates memory bandwidth. On one GPU, one phase steals from the other. **Prefill-decode disaggregation** runs them on separate pools.',
        'The cost is shipping each request\'s KV cache from the prefill pool to the decode pool over NVLink or RDMA. Reported gains are 1.5x to 3x throughput, and it is common at hyperscale.',
      ],
      keyIdea: 'Disaggregation removes prefill and decode interference for good, at the price of moving the KV cache between pools.',
      metrics: { tput: '1.5-3x', batch: 'per pool', wait: '-', useful: 'high' },
      metricTones: { tput: 'good' },
      scene: {
        nodes: [
          { ...user, at: at(-4.6, -2.4), chips: ['prompt'] },
          { id: 'pre', kind: 'block', at: at(-1, 0.6), label: 'prefill pool', sub: 'compute-bound', icon: 'Cpu', tint: 'amber', load: 90 },
          { id: 'dec', kind: 'block', at: at(3.6, -2.4), label: 'decode pool', sub: 'memory-bound', icon: 'Cpu', tint: 'amber', load: 85 },
        ],
        links: [link('user', 'pre'), link('pre', 'dec', { label: 'KV over RDMA' })],
        flows: [
          { path: ['user', 'pre'], tone: 'request', label: 'prompt', duration: 1.3 },
          { path: ['pre', 'dec'], tone: 'data', label: 'KV cache', duration: 1.5, delay: 1.4 },
          { path: ['dec', 'user'], tone: 'response', label: 'tokens', count: 3, duration: 1.6, delay: 3 },
        ],
        panel: {
          title: 'Two pools',
          icon: 'Split',
          rows: [
            { text: 'Prefill pool', value: 'compute-bound' },
            { text: 'Decode pool', value: 'memory-bound' },
            { text: 'Throughput gain', value: '1.5-3x', tone: 'good' },
            { text: 'Price', value: 'KV transfer', tone: 'warn' },
          ],
        },
        caption: 'Each phase on the hardware it likes',
      },
    },
    {
      title: 'Memory ceiling',
      tag: 'tradeoff',
      heading: 'The batch can only be as big as the KV cache allows',
      eli5: 'The bus has a fixed number of seats. Doors that open at every stop do not make more seats, so the line outside grows once every seat is taken.',
      body: [
        'Each running request holds KV cache, about **320 KB per token** for Llama-3-70B, as the KV cache lesson showed. On 4 x H100, 180 GB free is the upper bound: roughly 270 requests at 2K tokens. At 0.90 memory utilization about 150 GB is left, so ~230. Keep max-num-seqs at or below that.',
        'So the batch size limit is memory first. Continuous batching refills slots fast, but it cannot create slots that do not exist.',
      ],
      keyIdea: 'Continuous batching keeps every slot busy. KV memory decides how many slots there are.',
      metrics: { tput: 'capped by KV', batch: '~270 at 2K', wait: 'rises when full', useful: 'high' },
      metricTones: { batch: 'warn', wait: 'warn' },
      scene: {
        nodes: [
          { ...queue, status: 'hot', chips: [{ text: 'line outside', tone: 'warn' }] },
          { ...gpu, load: 92 },
          { ...kv, status: 'hot', badge: '99% full', chips: [{ text: '~270 x 2K', tone: 'warn' }] },
        ],
        links: [link('queue', 'gpu'), link('gpu', 'kv')],
        flows: [
          { path: ['queue', 'gpu'], tone: 'request', label: 'new request', duration: 1.5 },
          { path: ['kv', 'queue'], tone: 'error', label: 'no free slot', duration: 1.5, delay: 1.6 },
        ],
        panel: {
          title: 'Max batch on 4 x H100',
          icon: 'HardDrive',
          rows: [
            { text: 'KV left after weights', value: '~180 GB' },
            { text: 'KV per token', value: '320 KB' },
            { text: 'At 2K tokens each', value: '~270 requests', tone: 'good' },
            { text: 'At 32K tokens each', value: '~18 requests', tone: 'bad' },
          ],
          footer: { text: 'Upper bounds, real engines fit 15-20% fewer', tone: 'warn' },
        },
        caption: 'Slots come from memory, not the scheduler',
      },
    },
    {
      title: 'Paged memory',
      tag: 'concept',
      heading: 'Mixed lengths need paged KV memory to stay efficient',
      eli5: 'If every rider had to be given one long bench in advance, the bus would have gaps nobody can use. Small shared seats that anyone can take fix that.',
      body: [
        'Continuous batching churns requests of every length in and out. With one contiguous KV block reserved per request at `max_tokens`, **60 to 80 percent** of KV memory sat unused in older systems.',
        '**PagedAttention** (vLLM) splits the cache into small fixed blocks mapped by a block table. Waste falls to near zero and concurrency rises 2 to 4x. Continuous batching and paging work as a pair.',
      ],
      keyIdea: 'Continuous batching needs flexible memory. Paged KV blocks let slots of any length come and go without gaps.',
      metrics: { tput: 'up with paging', batch: '2-4x more', wait: 'shorter', useful: 'high' },
      metricTones: { batch: 'good' },
      scene: {
        nodes: [
          { ...eng, label: 'scheduler', sub: 'asks for blocks' },
          { id: 'table', kind: 'block', size: 0.85, at: at(-3.2, 2.6), label: 'block table', sub: 'logical to physical', icon: 'Table', tint: 'teal' },
          { ...kv, status: 'ok', badge: '~0% wasted' },
        ],
        links: [link('eng', 'table'), link('table', 'kv')],
        flows: [
          { path: ['eng', 'table', 'kv'], tone: 'request', label: 'need 1 block', duration: 1.6 },
        ],
        panel: {
          title: 'KV memory use',
          icon: 'Table',
          rows: [
            { text: 'Contiguous, per request', value: '60-80% unused', tone: 'bad' },
            { text: 'Paged blocks', value: '~0% unused', tone: 'good' },
            { text: 'Concurrent requests', value: '2-4x more', tone: 'good' },
          ],
          footer: { text: 'Next lesson: PagedAttention', tone: 'muted' },
        },
        caption: 'Small blocks, no gaps',
      },
      quiz: {
        question: 'A 4-GPU node has room for about 270 requests of 2K tokens. What does continuous batching change?',
        options: [
          'It raises that limit to about 2,700 by compressing the weights',
          'It keeps those slots filled instead of idle, but does not add slots',
          'It removes the need for a KV cache',
          'It makes decode compute-bound',
        ],
        answer: 1,
        explain: 'The slot count comes from free KV memory. Continuous batching refills freed slots at every step, so the slots you have stay busy. More slots need paging, KV quantization or more memory.',
      },
    },
    {
      title: 'Scheduler knobs',
      tag: 'concept',
      heading: 'Two caps and one switch decide each step',
      eli5: 'The bus company sets a seat limit, a limit on how much luggage loads per stop, and a rule to load big suitcases in small pieces.',
      body: [
        'A **max sequences** cap limits live requests. A **token budget** limits tokens per step, prompt chunks included. When memory runs short, the engine can **preempt** a request: recompute its KV later (GPU time) or swap it to CPU (PCIe bandwidth).',
        'Mature stacks queue first and reject with a 429 only when the waiting list is too long, instead of admitting and preempting.',
      ],
      keyIdea: 'Slots, a token budget per step and preemption are the dials. They trade throughput against tail latency.',
      metrics: { tput: 'tuned', batch: 'max 256', wait: 'queue when full', useful: 'high' },
      scene: {
        nodes: [
          { ...queue, chips: ['waiting'] },
          { ...eng, status: 'active', chips: [{ text: 'max 256 seqs', tone: 'default' }, { text: '8,192 tok/step', tone: 'default' }] },
          { ...gpu, load: 88 },
        ],
        links: [link('queue', 'eng'), link('eng', 'gpu')],
        flows: [
          { path: ['queue', 'eng', 'gpu'], tone: 'request', label: 'admitted', duration: 1.7 },
        ],
        panel: {
          title: 'Starting an engine',
          icon: 'Gauge',
          rows: [
            { text: 'Cap on live requests', value: 'max-num-seqs' },
            { text: 'Tokens per step', value: 'max-num-batched-tokens' },
            { text: 'Split long prompts', value: 'chunked prefill' },
          ],
          footer: { text: 'Names from vLLM, other engines differ', tone: 'muted' },
        },
        caption: 'Caps decide who rides this step',
      },
      code: {
        language: 'bash',
        title: 'Scheduler settings in vLLM',
        source: `vllm serve meta-llama/Llama-3.1-70B-Instruct \\
  --tensor-parallel-size 4 \\
  --max-num-seqs 256 \\
  --max-num-batched-tokens 8192 \\
  --enable-chunked-prefill \\
  --gpu-memory-utilization 0.90`,
        highlight: [3, 4, 5],
      },
    },
    {
      title: 'Throughput vs latency',
      tag: 'tradeoff',
      heading: 'A bigger batch lifts throughput and slows each stream',
      eli5: 'A fuller bus moves more people per hour, but each stop takes longer, so every rider arrives a bit later. The company must choose how full is full enough.',
      body: [
        'As the batch grows, decode first stays memory-bound and each step barely slows. Past a point the GPU turns compute-bound, step time rises, and total tokens per second flattens.',
        'Each user\'s TPOT gets worse the whole way. Pick the batch ceiling from your TPOT SLO, not from the maximum the memory allows.',
      ],
      keyIdea: 'Throughput climbs then flattens, while per-user speed keeps falling. The SLO picks the batch size.',
      metrics: { tput: 'flattens past ~128', batch: '32 to 256', wait: '-', useful: 'high' },
      metricTones: { tput: 'warn' },
      scene: {
        nodes: [
          { ...eng, label: 'scheduler', sub: 'batch ceiling' },
          { ...gpu, load: 95, status: 'hot' },
          { ...user, chips: [{ text: 'TPOT SLO 30 ms', tone: 'warn' }] },
        ],
        links: [link('eng', 'gpu'), link('gpu', 'user')],
        flows: [
          { path: ['eng', 'gpu'], tone: 'request', label: 'bigger batch', duration: 1.4 },
          { path: ['gpu', 'user'], tone: 'response', label: 'slower tokens', duration: 1.6, delay: 1.5 },
        ],
        panel: {
          title: 'Batch size, illustrative',
          icon: 'Table',
          rows: [
            { text: '1', value: '20 ms, 50 tok/s total' },
            { text: '32', value: '25 ms, ~1,280 total', tone: 'good' },
            { text: '128', value: '45 ms, ~2,840 total', tone: 'warn' },
            { text: '256', value: '80 ms, ~3,200 total', tone: 'bad' },
          ],
          footer: { text: 'Past 30 ms per token the SLO breaks', tone: 'bad' },
        },
        caption: 'More riders, slower trips',
      },
    },
    {
      title: 'The payoff',
      tag: 'case',
      heading: 'Case: from a for-loop to a production engine',
      eli5: 'The bus company stopped running empty buses and kept the doors working at every stop. The same bus now carries many times more people a day.',
      body: [
        'Against static batching, continuous batching gives **3 to 10x** the throughput on typical chat workloads at equal p99 latency. After PagedAttention it is the second-largest serving optimization.',
        'Together they explain the gap between a for-loop over `model.generate` at about **20 QPS** and a production engine at **500+ QPS** on the same GPU. Those QPS figures are a rough comparison from the source for short replies, not a measurement.',
      ],
      keyIdea: 'Same GPU, same model: batching smartly takes you from tens of QPS to hundreds.',
      metrics: { tput: '20 to 500+ QPS', batch: '1 to dozens', wait: 'short', useful: '85%+' },
      metricTones: { tput: 'good', wait: 'good', useful: 'good' },
      scene: {
        nodes: [
          { ...user, chips: [{ text: '500+ QPS', tone: 'good' }] },
          { ...eng, status: 'ok', chips: ['continuous + paged'] },
          { ...gpu, load: 88, chips: [{ text: 'full, useful', tone: 'good' }] },
        ],
        links: [link('user', 'eng'), link('eng', 'gpu')],
        flows: [
          { path: ['user', 'eng', 'gpu'], tone: 'request', label: 'prompts', count: 3, duration: 1.6 },
          { path: ['gpu', 'eng', 'user'], tone: 'response', label: 'tokens', count: 4, duration: 1.8, delay: 1.7 },
        ],
        panel: {
          title: 'Same GPU, three designs',
          icon: 'TrendingUp',
          rows: [
            { text: 'for-loop generate', value: '~20 QPS (rough)', tone: 'bad' },
            { text: 'Static batching', value: 'better, idle slots', tone: 'warn' },
            { text: 'Continuous + paged', value: '500+ QPS', tone: 'good' },
            { text: 'vs static, p99 equal', value: '3-10x', tone: 'good' },
          ],
        },
        caption: 'Same hardware, many times the throughput',
      },
      quiz: {
        question: 'Batch of 32: 31 requests end at token 50, one at token 500. About how much of the paid-for slot capacity is useful under static batching?',
        options: ['About 13 percent', 'About 50 percent', 'About 85 percent', 'All of it, because the batch is full'],
        answer: 0,
        explain: 'The batch runs 500 steps across 32 slots, 16,000 slot-steps. Only 31 x 50 + 500 = 2,050 produced tokens, about 13 percent. Continuous batching refills the idle slots.',
      },
    },
    {
      title: 'What to watch',
      tag: 'concept',
      heading: 'The numbers that tell you the batcher is healthy',
      eli5: 'The bus company watches how full each bus is, how long the line is, and how late riders arrive. Those three show whether the doors are working.',
      body: [
        'Watch the **running batch size** against its cap, the **queue depth** and wait, **KV utilization** and **preemption rate**. A full KV cache with a growing queue means you are memory-limited.',
        'Then watch **TTFT** and **TPOT** per request. A low batch size with a long queue points at a scheduler or admission limit, not at hardware.',
      ],
      keyIdea: 'Batch size, queue depth, KV use, TTFT and TPOT together show where the limit is.',
      metrics: { tput: 'tokens/s per GPU', batch: 'live vs cap', wait: 'queue depth', useful: 'KV utilization' },
      scene: {
        nodes: [
          { id: 'mon', kind: 'monitor', at: at(0, -2.2), label: 'metrics', sub: 'per engine' },
          { ...gpu, at: at(-4.4, -2.2), load: 88 },
          { ...queue, at: at(4.4, -2.2) },
        ],
        links: [link('gpu', 'mon'), link('queue', 'mon')],
        flows: [
          { path: ['gpu', 'mon'], tone: 'event', label: 'batch, KV, TPOT', duration: 1.6 },
          { path: ['queue', 'mon'], tone: 'event', label: 'depth, wait', duration: 1.6, delay: 0.4 },
        ],
        panel: {
          title: 'Dashboard',
          icon: 'Activity',
          rows: [
            { text: 'Running batch / cap', value: 'near cap = busy', tone: 'good' },
            { text: 'Queue depth', value: 'growing = full', tone: 'warn' },
            { text: 'KV utilization', value: '~99% = memory-bound', tone: 'warn' },
            { text: 'TTFT / TPOT', value: 'vs your SLOs' },
            { text: 'Preemption rate', value: 'rising = alert', tone: 'warn' },
          ],
        },
        caption: 'Four signals, one diagnosis',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Recap: rebuild the batch at every token',
      eli5: 'Keep the **bus** moving, open the doors at every stop, and let riders on and off as they like. Then no seat sits empty for long.',
      body: [
        'Decode is memory-bound, so batching many requests shares one weight read. Static batching wastes it: the longest output sets everyone\'s time and finished slots idle.',
        'Continuous batching rebuilds the batch each step, so requests leave on `<EOS>` and join after prefill. Chunked prefill keeps streams smooth, and KV memory sets the batch ceiling.',
      ],
      keyIdea: 'Continuous batching is mandatory for LLM serving. Static batching is a bug.',
      metrics: { tput: '3-10x static', batch: 'set by KV + SLO', wait: 'short', useful: 'high' },
      metricTones: { tput: 'good', wait: 'good', useful: 'good' },
      scene: {
        nodes: [
          { ...queue, chips: ['join any step'] },
          { ...gpu, status: 'ok', load: 88, chips: [{ text: 'leave on <EOS>', tone: 'good' }] },
          { ...kv, status: 'ok', badge: 'slots reused' },
        ],
        links: [link('queue', 'gpu'), link('gpu', 'kv')],
        flows: [
          { path: ['queue', 'gpu'], tone: 'request', label: 'join', duration: 1.5 },
          { path: ['gpu', 'kv'], tone: 'data', label: 'reuse slot', duration: 1.5, delay: 1.6 },
        ],
        panel: {
          title: 'Keep these',
          icon: 'List',
          rows: [
            { text: 'Batch unit', value: 'one decode step' },
            { text: 'Exit', value: '<EOS>, reply now', tone: 'good' },
            { text: 'Entry', value: 'prefill, then ride', tone: 'good' },
            { text: 'Ceiling', value: 'KV memory + TPOT SLO', tone: 'warn' },
          ],
        },
        caption: 'Doors that open at every stop',
      },
      quiz: {
        question: 'A long prompt arrives and everyone else\'s stream stutters for about 150 ms. Which fix keeps the batch continuous?',
        options: [
          'Switch to static batching',
          'Chunked prefill with a token budget per step',
          'Raise max sequences to 1,024',
          'Quantize the weights',
        ],
        answer: 1,
        explain: 'Chunked prefill spreads the prompt across several steps, so each step stays short and live streams keep their pace. Static batching, a higher cap or smaller weights do not remove the stall.',
      },
    },
  ],
};
