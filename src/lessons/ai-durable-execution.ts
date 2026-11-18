import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const user: SceneNode = { id: 'user', kind: 'user', at: at(-4.4, -3), label: 'customer' };
const worker: SceneNode = { id: 'worker', kind: 'block', at: at(0, -3), label: 'agent worker', sub: 'runs the loop', icon: 'Workflow', tint: 'violet' };
const model: SceneNode = { id: 'model', kind: 'block', at: at(4.4, -3), label: 'model', sub: 'on a GPU', icon: 'Cpu', tint: 'amber', load: 70 };
const refund: SceneNode = { id: 'refund', kind: 'block', size: 0.8, at: at(-3.6, 3.4), label: 'issue_refund', sub: 'tool', icon: 'Receipt', tint: 'blue' };
const engine: SceneNode = { id: 'engine', kind: 'block', at: at(0, 3.4), label: 'workflow engine', sub: 'keeps the record', icon: 'Route', tint: 'teal' };
const history: SceneNode = { id: 'history', kind: 'db', at: at(4.4, 3.4), label: 'history', sub: 'event log', tint: 'teal' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

export const aiDurableExecution: Lesson = {
  id: 'ai-durable-execution',
  title: 'Durable execution',
  tagline: 'How an agent that runs for minutes or days survives crashes, deploys, retries and a human who answers tomorrow.',
  minutes: 24,
  level: 'Advanced',
  learn: [
    'Why long-running agents cannot live inside an HTTP request handler',
    'Checkpoints, event history and replay, and why workflow code must be deterministic',
    'LLM calls and tool calls as activities, with retry policies, timeouts and idempotency keys',
    'Pausing for human approval and waiting days without holding a thread',
    'Loop caps, deploys with runs in flight, history growth and what durability costs',
    'Choosing an engine, and how a support agent, a coding agent and a returns agent use it',
  ],
  metrics: [
    { key: 'done', label: 'Steps done', icon: 'List' },
    { key: 'cost', label: 'LLM spend', icon: 'Receipt' },
    { key: 'run', label: 'Run time', icon: 'Clock' },
    { key: 'dup', label: 'Duplicate risk', icon: 'Shield' },
  ],
  steps: [
    {
      title: 'Crash',
      tag: 'problem',
      heading: 'The pod dies halfway through a refund',
      eli5: 'A baker is making a big cake in twelve steps and has no checklist. Halfway through, they go home sick. The next baker has no idea what is already in the oven.',
      body: [
        'A support agent works a refund in 12 steps: 1 read the ticket, 2 look up the order, 3 check policy, 4 plan with the LLM, 5 call `issue_refund`, 6 draft the reply, then verify and send it. At step 6 the **pod** restarts for a deploy.',
        'The refund was already sent. The agent memory was in RAM and is gone. Starting over means a second refund and another $0.04 of LLM calls. An HTTP handler cannot host this run, since the gateway cuts it at 600 seconds and deploys cut it sooner.',
      ],
      keyIdea: 'An agent keeps its progress in memory. When the process dies, the progress dies, and side effects already done stay done.',
      metrics: { done: '5 of 12', cost: '$0.04', run: '38 s', dup: 'high' },
      metricTones: { done: 'warn', dup: 'bad' },
      scene: {
        nodes: [
          user,
          { ...worker, status: 'down', badge: 'killed at step 6' },
          { ...refund, at: at(0, 3.4), status: 'ok', badge: '$18 sent' },
        ],
        links: [link('user', 'worker'), link('worker', 'refund')],
        flows: [
          { path: ['user', 'worker'], tone: 'request', label: 'refund ORD-20481', duration: 1.4 },
          { path: ['worker', 'refund'], tone: 'request', label: 'refund $18', duration: 1.4, delay: 1.5 },
          { path: ['worker', 'user'], tone: 'error', label: 'no reply', duration: 1.4, delay: 3 },
        ],
        panel: {
          title: 'The run when the pod restarts',
          icon: 'List',
          rows: [
            { text: 'Steps 1 to 4', value: 'done, only in RAM', tone: 'warn' },
            { text: 'Step 5: issue_refund', value: 'money moved', tone: 'bad' },
            { text: 'Steps 6 to 12', value: 'never ran', tone: 'warn' },
            { text: 'After restart', value: 'starts at step 1', tone: 'bad' },
          ],
          footer: { text: 'Retry from the top and the customer is paid twice', tone: 'bad' },
        },
        caption: 'Progress lived in one process',
      },
    },
    {
      title: 'State machine',
      tag: 'concept',
      heading: 'Make the agent a state machine first',
      eli5: 'The baker writes the recipe as numbered stages: mix, rest, bake, cool, ice. Now anyone can point at a stage and say "we are here".',
      body: [
        'Hidden inside a `while` loop, the agent position is just a line of code in a live process. Written as an explicit **state machine**, it has a current state you can name, test and save.',
        'Planning emits a plan, executing runs a tool, reflecting decides if it is done, recovery handles a tool error. Naming the states is the first step toward resuming.',
      ],
      keyIdea: 'You can only resume what you can name. An explicit state is the thing a checkpoint stores.',
      metrics: { done: 'state: executing', cost: '-', run: '-', dup: '-' },
      scene: {
        nodes: [
          { id: 'plan', kind: 'block', size: 0.85, at: at(-4.4, -2.5), label: 'planning', icon: 'List', tint: 'blue' },
          { id: 'exec', kind: 'block', size: 0.85, at: at(0, -2.5), label: 'executing', icon: 'Zap', tint: 'violet', status: 'active' },
          { id: 'reflect', kind: 'block', size: 0.85, at: at(4.4, -2.5), label: 'reflecting', icon: 'Search', tint: 'green' },
          { id: 'recover', kind: 'block', size: 0.85, at: at(0, 3.4), label: 'recovery', icon: 'Repeat', tint: 'red' },
        ],
        links: [link('plan', 'exec'), link('exec', 'reflect'), link('exec', 'recover')],
        flows: [
          { path: ['plan', 'exec'], tone: 'event', label: 'plan emitted', duration: 1.4 },
          { path: ['exec', 'reflect'], tone: 'response', label: 'observation', duration: 1.4, delay: 1.5 },
          { path: ['exec', 'recover'], tone: 'error', label: 'tool error', duration: 1.4, delay: 3 },
        ],
        panel: {
          title: 'States and exits',
          icon: 'Table',
          rows: [
            { text: 'PLANNING', value: 'plan emitted' },
            { text: 'EXECUTING', value: 'observation or error' },
            { text: 'REFLECTING', value: 'done or replan' },
            { text: 'RECOVERY', value: 'recovered or give up' },
            { text: 'TERMINATE', value: 'answer sent' },
          ],
        },
        caption: 'Named states, named exits',
      },
    },
    {
      title: 'Checkpoints',
      tag: 'concept',
      heading: 'Save the state after every step',
      eli5: 'After each stage the baker ticks the **checklist** on the fridge. If the baker leaves, the next one reads the last tick and carries on from there.',
      body: [
        'A **checkpoint** is the state written somewhere that outlives the process: the plan, the step number, the messages so far and every tool result.',
        'Save one after every step. After a crash, a fresh worker loads the latest checkpoint and continues. A coding agent does this after every tool call, so `/resume` picks up mid-plan.',
      ],
      keyIdea: 'Checkpoint after every step. The cost of a crash is then one step, not the whole run.',
      metrics: { done: '5 of 12', cost: '$0.04', run: '38 s', dup: 'medium' },
      metricTones: { dup: 'warn' },
      scene: {
        nodes: [
          worker,
          { ...model, status: 'active' },
          { id: 'store', kind: 'db', at: at(0, 3.4), label: 'checkpoint store', sub: 'outlives the pod', tint: 'teal', badge: 'saved: step 5' },
        ],
        links: [link('worker', 'model'), link('worker', 'store')],
        flows: [
          { path: ['worker', 'model'], tone: 'request', label: 'step 6 prompt', duration: 1.4 },
          { path: ['model', 'worker'], tone: 'response', label: 'tool call', duration: 1.4, delay: 1.5 },
          { path: ['worker', 'store'], tone: 'data', label: 'save state', duration: 1.4, delay: 3 },
        ],
        panel: {
          title: 'One checkpoint holds',
          icon: 'Database',
          rows: [
            { text: 'plan', value: '12 steps' },
            { text: 'next step index', value: '6' },
            { text: 'messages so far', value: '14' },
            { text: 'tool results', value: 'orders, policy, refund' },
          ],
          footer: { text: 'A new worker can start from this row', tone: 'good' },
        },
        caption: 'State that outlives the process',
      },
    },
    {
      title: 'DIY gap',
      tag: 'tradeoff',
      heading: 'Hand-rolled checkpoints still have a hole',
      eli5: 'The baker adds the salt, then goes to tick the checklist, and faints in between. The next baker sees no tick and adds the salt again.',
      body: [
        'The tool runs, then the state is saved. A crash between those two lines leaves the effect done and the checkpoint stale. On resume the step runs again.',
        'You can shrink the window, never close it. You also end up writing locking, timers, queues and retries yourself. That pile is what a workflow engine is.',
      ],
      keyIdea: 'Any gap between doing the work and recording it replays the work. Closing that gap takes the engine plus idempotent tools.',
      metrics: { done: '5 of 12', cost: '$0.04', run: '38 s', dup: 'still there' },
      metricTones: { dup: 'bad' },
      scene: {
        nodes: [
          { ...worker, status: 'down', badge: 'crash here' },
          { ...refund, at: at(-4.4, 3.4), status: 'ok', badge: 'refund sent' },
          { id: 'store', kind: 'db', at: at(4.4, 3.4), label: 'checkpoint store', sub: 'still says step 4', tint: 'teal', status: 'dim' },
        ],
        links: [link('worker', 'refund'), link('worker', 'store', { style: 'dashed' })],
        flows: [
          { path: ['worker', 'refund'], tone: 'request', label: 'refund $18', duration: 1.4 },
          { path: ['worker', 'store'], tone: 'error', label: 'save never ran', duration: 1.4, delay: 1.6 },
        ],
        panel: {
          title: 'The unsafe window',
          icon: 'Code',
          code: 'while not state.done:\n    out = run_tool(state.next)\n    # crash here: effect done,\n    # checkpoint still old\n    state.add(out)\n    db.save(state)',
          footer: { text: 'Resume repeats the refund', tone: 'bad' },
        },
        caption: 'Effect done, record missing',
      },
      code: {
        language: 'python',
        title: 'A hand-rolled checkpoint loop',
        source: `def run_agent(run_id: str):
    state = db.load(run_id) or new_state()
    while not state.done:
        action = state.next_action()
        out = run_tool(action)       # side effect happens here
        state.add(action, out)
        db.save(run_id, state)       # a crash before this line repeats run_tool
    return state.answer`,
        highlight: [5, 7],
      },
    },
    {
      title: 'Engine',
      tag: 'concept',
      heading: 'A workflow engine keeps the record for you',
      eli5: 'Instead of one baker keeping the **checklist**, the bakery hires a manager. The manager writes down every finished stage, and any baker can ask what is next.',
      body: [
        'A workflow engine such as Temporal, Restate or Inngest stores a durable **history** of everything a run did. Your code is split in two: the **workflow** (the plan) and **activities** (the work).',
        'Workers pull tasks from the engine, do them, and report results. The engine appends each result to the history before anything moves on.',
      ],
      keyIdea: 'The engine owns the record of the run. Workers are disposable, and any worker can continue a run.',
      metrics: { done: '3', cost: '$0.01', run: '9 s', dup: 'low' },
      metricTones: { dup: 'good' },
      scene: {
        nodes: [
          user,
          { ...engine, at: at(0, -3) },
          { ...worker, at: at(4.4, -3), label: 'worker', sub: 'any pod' },
          { ...history, at: at(0, 3.4) },
        ],
        links: [link('user', 'engine'), link('engine', 'worker'), link('engine', 'history')],
        flows: [
          { path: ['user', 'engine'], tone: 'request', label: 'start workflow', duration: 1.3 },
          { path: ['engine', 'worker'], tone: 'event', label: 'run task', duration: 1.3, delay: 1.4 },
          { path: ['worker', 'engine'], tone: 'response', label: 'result', duration: 1.3, delay: 2.8 },
          { path: ['engine', 'history'], tone: 'data', label: 'append', duration: 1.3, delay: 4.2 },
        ],
        panel: {
          title: 'Who does what',
          icon: 'Table',
          rows: [
            { text: 'Workflow', value: 'the plan, deterministic code' },
            { text: 'Activity', value: 'LLM call, tool call, any side effect' },
            { text: 'Worker', value: 'runs both, can die any time' },
            { text: 'Engine', value: 'records every result' },
          ],
        },
        caption: 'Disposable workers, durable record',
      },
    },
    {
      title: 'Replay',
      tag: 'concept',
      heading: 'On a crash, the engine replays the history',
      eli5: 'A new baker arrives, reads the ticks on the **checklist** and skips every finished stage. They only do the first stage with no tick.',
      body: [
        'A new worker re-runs the workflow code from the top. At each activity the engine checks the history. If a result is recorded, it is handed back instantly and nothing runs. The first unrecorded activity runs for real.',
        'So steps 1 to 5 cost nothing on replay: no LLM calls, no second refund. The run continues at step 6, the first unrecorded step.',
      ],
      keyIdea: 'Replay rebuilds the run from recorded results. Finished work is returned from the log, never redone.',
      metrics: { done: '5 of 12', cost: '$0.04', run: '41 s', dup: 'none' },
      metricTones: { dup: 'good' },
      scene: {
        nodes: [
          { ...worker, label: 'worker B', sub: 'fresh pod', status: 'active' },
          { ...history, at: at(-4.4, -3), status: 'ok' },
          { ...model, status: 'active', badge: 'step 6 only' },
          { ...refund, at: at(0, 3.4), status: 'dim', badge: 'not called again' },
        ],
        links: [link('history', 'worker'), link('worker', 'model'), link('worker', 'refund', { style: 'faint' })],
        flows: [
          { path: ['history', 'worker'], tone: 'data', label: 'replay 1 to 5', count: 2, duration: 1.4 },
          { path: ['worker', 'model'], tone: 'request', label: 'step 6', duration: 1.4, delay: 1.6 },
        ],
        panel: {
          title: 'History as the worker reads it',
          icon: 'List',
          rows: [
            { text: '2 get_order', value: 'recorded', tone: 'good' },
            { text: '3 check_policy', value: 'recorded', tone: 'good' },
            { text: '4 llm_call: plan', value: 'recorded', tone: 'good' },
            { text: '5 issue_refund', value: 'recorded', tone: 'good' },
            { text: '6 llm_call: draft reply', value: 'runs now', tone: 'warn' },
          ],
        },
        caption: 'Skip what is done, run what is not',
      },
    },
    {
      title: 'Determinism',
      tag: 'concept',
      heading: 'Workflow code has to be deterministic',
      eli5: 'The recipe must say the same thing every time it is read. If it said "add a pinch of salt, or maybe sugar" at random, two bakers would bake different cakes.',
      body: [
        'Replay only works if the workflow makes the same decisions each time it runs over the same history. So it may not read the clock, roll a random number, hit the network or read a file.',
        'Anything unpredictable goes into an **activity**, whose result is recorded once. The workflow then branches on a recorded value, so replay branches the same way.',
      ],
      keyIdea: 'The workflow decides, the activities touch the world. Same history in, same decisions out.',
      metrics: { done: '-', cost: '-', run: '-', dup: '-' },
      scene: {
        nodes: [
          { ...worker, label: 'workflow code', sub: 'pure decisions', tint: 'violet' },
          { ...engine, label: 'activities', sub: 'clock, net, LLM', icon: 'Zap', tint: 'amber', at: at(4.4, -3) },
          { ...history, at: at(0, 3.4) },
        ],
        links: [link('worker', 'engine'), link('engine', 'history')],
        flows: [
          { path: ['worker', 'engine'], tone: 'request', label: 'ask the world', duration: 1.4 },
          { path: ['engine', 'history'], tone: 'data', label: 'record once', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Where each thing goes',
          icon: 'Shield',
          rows: [
            { text: 'if / for / await', value: 'workflow', tone: 'good' },
            { text: 'Date.now(), random', value: 'activity', tone: 'warn' },
            { text: 'LLM call, HTTP, file', value: 'activity', tone: 'warn' },
            { text: 'Read a global that changes', value: 'never', tone: 'bad' },
          ],
        },
        caption: 'Same history, same decisions',
      },
      code: {
        language: 'typescript',
        title: 'A refund workflow: decisions only',
        source: `export async function refundAgent(ticketId: string) {
  const order = await tools.getOrder(ticketId);       // activity
  const plan = await llm.plan(order);                  // activity
  for (const step of plan.steps) {
    const out = await tools.run(step);                 // activity
    if (out.done) break;
  }
  // No Date.now(), Math.random() or fetch() in this function.
}`,
        highlight: [2, 3, 5],
      },
      quiz: {
        question: 'A worker crashes after step 6 of 12, and a new worker takes over. What happens to steps 1 to 6?',
        options: [
          'They run again so the new worker has fresh state',
          'The engine returns their recorded results and runs nothing',
          'They are skipped and their results are lost',
          'The model is called again but the tools are not',
        ],
        answer: 1,
        explain: 'Replay re-runs the workflow code but every finished activity returns its recorded result from the history. Nothing is executed twice, so no LLM spend and no repeated side effects.',
      },
    },
    {
      title: 'Activities',
      tag: 'concept',
      heading: 'Every LLM call and tool call is an activity',
      eli5: 'Each real job, like "crack the eggs", is a line item. The manager writes down the result, so a new baker never cracks the same eggs again.',
      body: [
        'The model call is an activity, and so is each tool call. Their outputs land in the history the moment they finish.',
        'That fixes a quiet problem. Rerun a prompt at temperature above 0 and the answer changes, so a replayed run could take another path. With the answer recorded, replay reuses it and costs $0.',
      ],
      keyIdea: 'Wrap the nondeterministic parts in activities. Their recorded outputs make replay stable and free.',
      metrics: { done: '8 of 12', cost: '$0.05', run: '44 s', dup: 'low' },
      scene: {
        nodes: [
          worker,
          { ...model, status: 'active', chips: ['activity: llm_call'] },
          { ...refund, at: at(-2.2, 3.4), chips: ['activity: tool_call'] },
          { ...history, at: at(2.2, 3.4) },
        ],
        links: [link('worker', 'model'), link('worker', 'refund'), link('worker', 'history')],
        flows: [
          { path: ['worker', 'model', 'worker'], tone: 'request', label: 'llm_call', duration: 1.6 },
          { path: ['worker', 'refund', 'worker'], tone: 'request', label: 'tool_call', duration: 1.6, delay: 1.7 },
          { path: ['worker', 'history'], tone: 'data', label: 'record both', duration: 1.4, delay: 3.4 },
        ],
        panel: {
          title: 'What replay does with each',
          icon: 'Table',
          rows: [
            { text: 'llm_call, first run', value: '$0.004, 1.2 s' },
            { text: 'llm_call, replay', value: '$0, instant', tone: 'good' },
            { text: 'tool_call, first run', value: 'effect happens' },
            { text: 'tool_call, replay', value: 'no effect', tone: 'good' },
          ],
        },
        caption: 'Record once, reuse on replay',
      },
    },
    {
      title: 'Retries',
      tag: 'concept',
      heading: 'Retries become a policy, not a loop in your code',
      eli5: 'If the oven door sticks, the baker tries again in a minute, then in two, then in four. The manager keeps count so the baker does not keep banging on it.',
      body: [
        'Providers return `429` and `5xx` all the time. An activity carries a **retry policy**: first wait, backoff factor, wait cap and max attempts. The engine runs the waits, even across a worker crash.',
        'Retry only calls that are safe to repeat. A **start-to-close** timeout caps one attempt and **schedule-to-close** caps all of them. Long calls send a **heartbeat** so a dead worker is noticed fast. The SDK adds jitter itself.',
      ],
      keyIdea: 'Declare retries once per activity. The engine counts attempts and survives restarts between them.',
      metrics: { done: '8 of 12', cost: '$0.05', run: '49 s', dup: 'low' },
      scene: {
        nodes: [
          worker,
          { ...model, status: 'hot', load: 96, chips: [{ text: '429 rate limited', tone: 'bad' }] },
          engine,
        ],
        links: [link('worker', 'model'), link('worker', 'engine')],
        flows: [
          { path: ['worker', 'model'], tone: 'request', label: 'attempt 1', duration: 1.2 },
          { path: ['model', 'worker'], tone: 'error', label: '429', duration: 1.2, delay: 1.3 },
          { path: ['worker', 'model'], tone: 'request', label: 'attempt 2, +1 s', duration: 1.2, delay: 3.2 },
          { path: ['model', 'worker'], tone: 'response', label: '200', duration: 1.2, delay: 4.5 },
        ],
        panel: {
          title: 'Retry policy for llm_call',
          icon: 'Repeat',
          rows: [
            { text: 'First wait', value: '1 s' },
            { text: 'Backoff factor', value: 'x2' },
            { text: 'Longest wait', value: '30 s' },
            { text: 'Max attempts', value: '5' },
            { text: 'Start-to-close', value: '60 s per attempt' },
            { text: 'Heartbeat', value: 'every 10 s on long calls' },
          ],
          footer: { text: 'Waits after failures: 1 s, 2 s, 4 s', tone: 'muted' },
        },
        caption: 'The engine owns the retrying',
      },
      code: {
        language: 'typescript',
        title: 'A retry policy on LLM activities',
        source: `const { callModel } = proxyActivities<typeof activities>({
  startToCloseTimeout: '60 seconds',   // per attempt
  retry: {
    initialInterval: '1 second',
    backoffCoefficient: 2,
    maximumInterval: '30 seconds',
    maximumAttempts: 5,
    nonRetryableErrorTypes: ['BadRequestError'],
  },
});`,
        highlight: [2, 4, 5, 6, 7],
      },
    },
    {
      title: 'Error kinds',
      tag: 'case',
      heading: 'Not every error deserves a retry',
      eli5: 'If the oven is busy, wait and try again. If the recipe says "bake the cake in the sink", asking again will never help. You fix the recipe.',
      body: [
        'Retry what is transient: `429`, `5xx` and timeouts. Do not retry what is wrong with the request. A `400` for a bad schema or a `404` for a model name that does not exist fails the same way forever.',
        'A fallback that only fires on `5xx` can pass a `404` straight to users. Mark those errors **non-retryable**, route them to a fallback model or a human, and alert.',
      ],
      keyIdea: 'Classify errors. Transient ones retry with backoff, permanent ones fail fast to a fallback or a person.',
      metrics: { done: '8 of 12', cost: '$0.05', run: '52 s', dup: 'low' },
      scene: {
        nodes: [
          worker,
          { ...model, id: 'primary', label: 'primary model', status: 'down', load: undefined },
          { ...model, id: 'backup', label: 'backup model', at: at(2.2, 4.4), tint: 'green', load: 20 },
          { ...engine, at: at(-4.4, 3.4), label: 'on-call', sub: 'paged', icon: 'Mail', tint: 'red' },
        ],
        links: [link('worker', 'primary'), link('worker', 'backup'), link('worker', 'engine')],
        flows: [
          { path: ['worker', 'primary'], tone: 'request', label: 'bad model name', duration: 1.3 },
          { path: ['primary', 'worker'], tone: 'error', label: '404', duration: 1.3, delay: 1.4 },
          { path: ['worker', 'backup'], tone: 'request', label: 'fallback', duration: 1.3, delay: 2.9 },
          { path: ['worker', 'engine'], tone: 'event', label: 'alert', duration: 1.3, delay: 4.4 },
        ],
        panel: {
          title: 'Retry or not',
          icon: 'Table',
          rows: [
            { text: '429 rate limited', value: 'retry, backoff', tone: 'good' },
            { text: '500, 503, timeout', value: 'retry, backoff', tone: 'good' },
            { text: '400 bad schema', value: 'fail, fix prompt', tone: 'warn' },
            { text: '404 unknown model', value: 'fallback + page', tone: 'bad' },
          ],
        },
        caption: 'Transient versus permanent',
      },
    },
    {
      title: 'Idempotency',
      tag: 'concept',
      heading: 'Retries need idempotency keys on every write',
      eli5: 'Each order gets a ticket number. If the waiter hands in the same ticket twice, the kitchen sees the number and makes the meal only once.',
      body: [
        'Durable engines run activities **at least once**. If `issue_refund` succeeds and the worker dies before the engine hears back, the retry sends the refund again.',
        'Give every write a key built from the run id and step, the same on every attempt. The payments side stores it and returns the first result for a repeat, so retries do not double-charge, double-ship or double-email.',
      ],
      keyIdea: 'At-least-once delivery plus an idempotency key behaves like exactly-once. Derive the key from the run and step, never per attempt.',
      metrics: { done: '8 of 12', cost: '$0.05', run: '52 s', dup: 'none' },
      metricTones: { dup: 'good' },
      scene: {
        nodes: [
          worker,
          { ...refund, at: at(0, 3.4), label: 'payments API', sub: 'issue_refund', status: 'active' },
          { id: 'ledger', kind: 'db', at: at(4.4, 3.4), label: 'ledger', sub: 'keys seen', tint: 'teal' },
        ],
        links: [link('worker', 'refund'), link('refund', 'ledger')],
        flows: [
          { path: ['worker', 'refund'], tone: 'request', label: 'key r42:5', duration: 1.3 },
          { path: ['refund', 'ledger'], tone: 'data', label: 'store key', duration: 1.2, delay: 1.4 },
          { path: ['worker', 'refund'], tone: 'request', label: 'retry, key r42:5', duration: 1.3, delay: 3 },
          { path: ['refund', 'worker'], tone: 'response', label: 'first result', duration: 1.3, delay: 4.4 },
        ],
        panel: {
          title: 'Same key, one refund',
          icon: 'Key',
          rows: [
            { text: 'Attempt 1, key r42:5', value: 'refund $18', tone: 'good' },
            { text: 'Worker dies before the ack', value: '' , tone: 'warn' },
            { text: 'Attempt 2, key r42:5', value: 'returns attempt 1', tone: 'good' },
            { text: 'Money moved', value: 'once', tone: 'good' },
          ],
        },
        caption: 'Repeats collapse into one effect',
      },
      code: {
        language: 'python',
        title: 'A write tool that is safe to retry',
        source: `def issue_refund(order_id: str, cents: int, run_id: str, step: int):
    key = f"{run_id}:{step}"          # identical on every retry of this step
    resp = payments.post(
        "/refunds",
        json={"order": order_id, "amount": cents},
        headers={"Idempotency-Key": key},
    )
    return resp.json()`,
        highlight: [2, 6],
      },
      quiz: {
        question: 'A refund tool call times out, and the engine retries it. What keeps the customer from being paid twice?',
        options: [
          'The workflow code is deterministic',
          'The history stores the model answer',
          'An idempotency key that is the same on every retry of that step',
          'A shorter timeout on the activity',
        ],
        answer: 2,
        explain: 'Activities run at least once. Determinism and recorded results keep the workflow consistent, but only a stable idempotency key makes the payments side treat a repeat as the same refund.',
      },
    },
    {
      title: 'Compensation',
      tag: 'concept',
      heading: 'When a later step fails, undo the earlier one',
      eli5: 'The baker already handed back the money, then the delivery van breaks down. The manager does not pretend the money never moved. They write a new line that cancels it.',
      body: [
        'A refund went out at step 5 and a later step fails for good, such as the reply that cannot be sent. Past effects cannot be rolled back, so the workflow runs a **compensating action**: a new activity that undoes the old one, in reverse order.',
        'This is the saga pattern. Each compensation is an activity too, so it is recorded, retried and needs its own idempotency key.',
      ],
      keyIdea: 'You cannot unwind a side effect, only cancel it with another one. Pair every write with an undo and run the undos in reverse.',
      metrics: { done: '8 of 12', cost: '$0.06', run: '52 s', dup: 'none' },
      metricTones: { dup: 'good' },
      scene: {
        nodes: [
          { ...worker, status: 'hot', badge: 'step 8 failed' },
          { ...refund, at: at(-4.4, 3.4), status: 'ok', badge: '$18 sent at step 5' },
          { id: 'undo', kind: 'block', size: 0.8, at: at(0, 3.4), label: 'reverse_refund', sub: 'compensation', icon: 'Repeat', tint: 'red', chips: ['key r42:undo5'] },
          { ...history, at: at(4.4, 3.4) },
        ],
        links: [link('worker', 'refund'), link('worker', 'undo'), link('worker', 'history')],
        flows: [
          { path: ['worker', 'history'], tone: 'error', label: 'write_reply failed', duration: 1.3 },
          { path: ['worker', 'undo'], tone: 'event', label: 'run the undo', duration: 1.3, delay: 1.4 },
          { path: ['undo', 'refund'], tone: 'response', label: 'refund reversed', duration: 1.3, delay: 2.8 },
        ],
        panel: {
          title: 'Saga order for the refund run',
          icon: 'List',
          rows: [
            { text: '5 issue_refund', value: 'done', tone: 'good' },
            { text: '8 write_reply', value: 'failed for good', tone: 'bad' },
            { text: 'Undo of step 5', value: 'reverse_refund', tone: 'warn' },
            { text: 'Undos run', value: 'in reverse order' },
          ],
          footer: { text: 'Undo is recorded and retried like any activity', tone: 'good' },
        },
        caption: 'Cancel with a new effect',
      },
    },
    {
      title: 'Approval',
      tag: 'case',
      heading: 'Pause for a human and resume when they answer',
      eli5: 'A big cake order needs the owner to say yes. The baker puts the order on the owner desk and goes home. The checklist keeps the place until the owner answers.',
      body: [
        'Refunds over $50 should wait for a person. The workflow sends the request to the duty queue and then waits for a **signal**. While it waits, no thread or process is held.',
        'Whether the approver answers in 5 minutes or after the weekend, the signal lands in the history and the run wakes on any worker.',
      ],
      keyIdea: 'A paused run costs storage, not compute. Waiting for a human is just another recorded event.',
      metrics: { done: '9 of 12', cost: '$0.06', run: '18 h', dup: 'none' },
      metricTones: { dup: 'good' },
      scene: {
        nodes: [
          { ...worker, status: 'dim', badge: 'asleep, no thread' },
          { id: 'duty', kind: 'queue', at: at(4.4, -3), label: 'duty queue', sub: 'approvals' },
          { id: 'approver', kind: 'user', at: at(4.4, 3.4), label: 'approver' },
          { ...engine, at: at(-4.4, 3.4), badge: 'waiting for signal' },
        ],
        links: [link('worker', 'duty'), link('duty', 'approver'), link('approver', 'engine')],
        flows: [
          { path: ['worker', 'duty'], tone: 'event', label: 'refund $240?', duration: 1.3 },
          { path: ['duty', 'approver'], tone: 'event', label: 'ping', duration: 1.3, delay: 1.4 },
          { path: ['approver', 'engine'], tone: 'response', label: 'signal: approved', duration: 1.5, delay: 3 },
        ],
        panel: {
          title: 'Refund gate',
          icon: 'Shield',
          rows: [
            { text: 'Under $50', value: 'auto', tone: 'good' },
            { text: '$50 and over', value: 'pause, ask a person', tone: 'warn' },
            { text: 'Answer after 18 h', value: 'run resumes', tone: 'good' },
            { text: 'Threads held while waiting', value: '0', tone: 'good' },
          ],
        },
        caption: 'Wait on a human without a thread',
      },
    },
    {
      title: 'Long waits',
      tag: 'case',
      heading: 'Sleeping for days is a timer, not a process',
      eli5: 'The baker writes "check the dough in 3 days" on the checklist and goes home. The manager sets an alarm and calls a baker back when it rings.',
      body: [
        'A returns agent must wait for a parcel that may take 5 days. A **durable timer** is stored in the engine, so `sleep(3 days)` survives restarts, deploys and scale-down to zero workers.',
        'When the timer fires, any worker replays the history and carries on. Wait on events too: a carrier webhook can wake the run earlier than the timer.',
      ],
      keyIdea: 'Long waits live in the engine as timers and signals. Nothing runs, and nothing is lost, while it waits.',
      metrics: { done: '6 of 10', cost: '$0.03', run: '5 days', dup: 'none' },
      metricTones: { dup: 'good' },
      scene: {
        nodes: [
          { ...engine, at: at(0, -3), badge: 'timer: 3 days' },
          { id: 'parcel', kind: 'block', at: at(4.4, -3), label: 'return parcel', sub: 'with the carrier', icon: 'Package', tint: 'amber' },
          { ...worker, at: at(-4.4, 3.4), status: 'dim', badge: 'scaled to zero' },
          { ...history, at: at(4.4, 3.4) },
        ],
        links: [link('parcel', 'engine'), link('engine', 'worker'), link('engine', 'history')],
        flows: [
          { path: ['parcel', 'engine'], tone: 'event', label: 'carrier scan', duration: 1.4 },
          { path: ['engine', 'history'], tone: 'data', label: 'event saved', duration: 1.3, delay: 1.5 },
          { path: ['engine', 'worker'], tone: 'event', label: 'wake run', duration: 1.4, delay: 3 },
        ],
        panel: {
          title: 'A returns run over 5 days',
          icon: 'Clock',
          rows: [
            { text: 'Day 0', value: 'triage, label sent' },
            { text: 'Day 1 to 4', value: 'sleeping, 0 workers', tone: 'muted' },
            { text: 'Day 4', value: 'carrier scan wakes it', tone: 'good' },
            { text: 'Day 5', value: 'refund, run ends', tone: 'good' },
          ],
        },
        caption: 'Waiting is state, not compute',
      },
    },
    {
      title: 'Loop caps',
      tag: 'tradeoff',
      heading: 'A durable runaway loop never dies on its own',
      eli5: 'A baker told to "keep stirring until it feels right" never stops, and a manager who never lets the baker rest keeps them stirring after a nap. Someone must ring a bell.',
      body: [
        'Durability makes bad loops worse. A model that keeps searching can reach 412 tool calls, and now a restart does not even end it. The run resumes and spends more.',
        'The runtime, not the model, owns stopping: an iteration cap (20), a token budget (30k), a dollar cap ($0.25) and a wall-clock limit on active compute. Human waits are excluded and get their own approval timeout. Any one trips, the run ends.',
      ],
      keyIdea: 'A termination rule that says the model decides is no rule. Put hard caps in workflow code, where they survive restarts.',
      metrics: { done: '412 steps', cost: '$6.40', run: '9 min', dup: '-' },
      metricTones: { done: 'bad', cost: 'bad' },
      scene: {
        nodes: [
          { ...worker, status: 'hot', load: 92, badge: 'step 412' },
          { ...model, status: 'hot', load: 95 },
          { id: 'guard', kind: 'limiter', at: at(0, 3.4), label: 'budget guard', sub: 'in workflow code' },
        ],
        links: [link('worker', 'model'), link('worker', 'guard')],
        flows: [
          { path: ['worker', 'model', 'worker'], tone: 'request', label: 'search again', count: 2, duration: 1.4 },
          { path: ['worker', 'guard'], tone: 'event', label: 'cap hit: stop', duration: 1.3, delay: 2 },
        ],
        panel: {
          title: 'Caps for the support agent',
          icon: 'Gauge',
          rows: [
            { text: 'Iterations', value: '20', tone: 'good' },
            { text: 'Tokens per conversation', value: '30k', tone: 'good' },
            { text: 'Dollars per conversation', value: '$0.25 hard stop', tone: 'good' },
            { text: 'Active compute, no human waits', value: '10 min', tone: 'good' },
            { text: 'Approval wait', value: '24 h, then escalate', tone: 'good' },
            { text: 'At cap minus 1', value: 'force a final answer', tone: 'warn' },
          ],
        },
        caption: 'The runtime decides when to stop',
      },
    },
    {
      title: 'Deploys',
      tag: 'tradeoff',
      heading: 'New code meets runs that are already in flight',
      eli5: 'The head baker rewrites the recipe while a cake is half done. A new baker replaying the old ticks against the new recipe finds stages that do not match.',
      body: [
        'A run may live for days, longer than a deploy cycle. Replay runs your new code over an old history. If you add, remove or reorder an activity, the replay disagrees with the log and the run breaks.',
        'Use the engine versioning tools to branch on a version marker, so old runs follow old code. Keep a run on the old workers until it ends, and test changes against saved histories.',
      ],
      keyIdea: 'Code that changes the order of activities is a breaking change for any run still in flight. Version it.',
      metrics: { done: '-', cost: '-', run: 'days', dup: '-' },
      metricTones: { run: 'warn' },
      scene: {
        nodes: [
          { ...history, at: at(-4.4, -3), badge: 'run started on v1' },
          { ...worker, label: 'worker v2', sub: 'new code', status: 'hot', badge: 'mismatch' },
          { ...engine, at: at(4.4, 3.4), label: 'v1 workers', sub: 'drain old runs', tint: 'green' },
        ],
        links: [link('history', 'worker'), link('history', 'engine')],
        flows: [
          { path: ['history', 'worker'], tone: 'error', label: 'replay v1 on v2', duration: 1.5 },
          { path: ['history', 'engine'], tone: 'data', label: 'v1 run stays here', duration: 1.5, delay: 1.8 },
        ],
        panel: {
          title: 'Changes and replay',
          icon: 'Table',
          rows: [
            { text: 'Change a prompt string', value: 'safe', tone: 'good' },
            { text: 'Add an activity mid-flow', value: 'breaks old runs', tone: 'bad' },
            { text: 'Reorder two activities', value: 'breaks old runs', tone: 'bad' },
            { text: 'Fix: version marker', value: 'old runs keep old path', tone: 'good' },
          ],
        },
        caption: 'Old histories, new code',
      },
      quiz: {
        question: 'You insert a new activity between two existing ones and deploy. What happens to a run already in flight?',
        options: [
          'It picks up the new activity at the next step automatically',
          'Replay disagrees with its history and the run breaks unless the change is versioned',
          'Nothing, because activity results are recorded',
          'It restarts from step 1 with the new code',
        ],
        answer: 1,
        explain: 'Replay runs the new code over the old history. An extra activity shifts every later step, so the log no longer matches. A version marker keeps old runs on the old path.',
      },
    },
    {
      title: 'Engines',
      tag: 'tradeoff',
      heading: 'Choosing an engine',
      eli5: 'There are several kinds of managers for the bakery. Some are strict and run huge shops. Some are small and friendly. Pick the one that fits your shop.',
      body: [
        'Temporal records an event-sourced history of workflows and activities and scales to enterprise loads. Restate journals durable functions and fits serverless shapes. Inngest runs event-driven durable steps with retries and throttles built in.',
        'Prefect and Dagster suit batch and scheduled runs. LangGraph checkpoints graph state but needs a host for timers and retries. Pick the least machinery that gives you replay, retries and waits.',
      ],
      keyIdea: 'All of them journal results and resume. They differ in scale, runtime weight and how much code you write.',
      metrics: { done: '-', cost: '-', run: '-', dup: '-' },
      scene: {
        nodes: [
          { id: 'agent', kind: 'block', size: 0.85, at: at(0, -3), label: 'agent code', sub: 'your workflow', icon: 'Workflow', tint: 'gray' },
          { id: 'temporal', kind: 'block', size: 0.85, at: at(-4.4, 3.4), label: 'Temporal', sub: 'event history', icon: 'Route', tint: 'violet' },
          { id: 'restate', kind: 'block', size: 0.85, at: at(-1.5, 3.4), label: 'Restate', sub: 'durable functions', icon: 'Zap', tint: 'blue' },
          { id: 'inngest', kind: 'block', size: 0.85, at: at(1.5, 3.4), label: 'Inngest', sub: 'event steps', icon: 'Webhook', tint: 'green' },
          { id: 'langgraph', kind: 'block', size: 0.85, at: at(4.4, 3.4), label: 'LangGraph', sub: 'graph checkpoints', icon: 'Share2', tint: 'amber' },
        ],
        links: [link('agent', 'temporal'), link('agent', 'restate'), link('agent', 'inngest'), link('agent', 'langgraph', { style: 'dashed' })],
        panel: {
          title: 'Weight, replay model, best fit',
          icon: 'Table',
          rows: [
            { text: 'Temporal', value: 'heavy, event replay, enterprise scale' },
            { text: 'Restate', value: 'light, journal replay, serverless' },
            { text: 'Inngest', value: 'light, step memo, event-driven apps' },
            { text: 'Prefect, Dagster', value: 'task reruns, batch and schedules' },
            { text: 'LangGraph', value: 'state checkpoints, no timers alone', tone: 'warn' },
          ],
        },
        caption: 'Same idea, different weight',
      },
    },
    {
      title: 'Support agent',
      tag: 'case',
      heading: 'Case: the refund agent, end to end',
      eli5: 'The bakery handles a cake complaint. The baker ticks each stage, asks the owner when the refund is large, and the owner answer is saved on the checklist.',
      body: [
        'The support agent runs as a workflow with a cap of 20 iterations and $0.25 per conversation. The wall-clock cap counts active compute only, and an approval wait has its own 24 h timeout, then escalates. `get_account` must succeed before any write tool is allowed.',
        'Refunds under $50 run automatically with an idempotency key. At $50 or more the run pauses, pings the duty queue and resumes on approval. A pod restart at any point costs one step.',
      ],
      keyIdea: 'Durability, caps, idempotency and a human gate each cover a different failure. The agent needs all four.',
      metrics: { done: '12 of 20', cost: '$0.09', run: '6 h', dup: 'none' },
      metricTones: { dup: 'good', cost: 'good' },
      scene: {
        nodes: [
          user,
          { ...engine, at: at(0, -3), badge: 'run r42' },
          { ...model, at: at(4.4, -3) },
          { ...refund, at: at(0, 3.4), chips: ['key r42:5'] },
          { id: 'duty', kind: 'queue', at: at(4.4, 3.4), label: 'duty queue', sub: 'refunds $50+' },
        ],
        links: [link('user', 'engine'), link('engine', 'model'), link('engine', 'refund'), link('engine', 'duty')],
        flows: [
          { path: ['user', 'engine'], tone: 'request', label: 'refund ORD-20481', duration: 1.2 },
          { path: ['engine', 'model'], tone: 'request', label: 'plan', duration: 1.2, delay: 1.3 },
          { path: ['engine', 'refund'], tone: 'request', label: 'refund $18', duration: 1.2, delay: 2.6 },
          { path: ['engine', 'duty'], tone: 'event', label: '$240 needs approval', duration: 1.3, delay: 3.9 },
        ],
        panel: {
          title: 'Guardrails on this run',
          icon: 'Shield',
          rows: [
            { text: 'Iteration cap', value: '20' },
            { text: 'Dollar cap', value: '$0.25' },
            { text: 'Wall clock', value: '10 min active, waits excluded' },
            { text: 'Writes need get_account first', value: 'enforced' },
            { text: 'Refund $50 and over', value: 'durable pause, 24 h' },
          ],
        },
        caption: 'Four failure modes, four guards',
      },
    },
    {
      title: 'Coding agent',
      tag: 'case',
      heading: 'Case: durable even on a laptop',
      eli5: 'A baker working alone at home still ticks a checklist. If the power goes out, tomorrow they pick up the sheet and start at the first empty tick.',
      body: [
        'A coding agent works for hours across 200 turns. The IDE restarts, the laptop sleeps, the network blips.',
        'Its state is written to disk after every tool call, so `/resume` picks up mid-plan. The plan is versioned in that state, and the files themselves are re-read on demand. Durable execution applies even to local agents.',
      ],
      keyIdea: 'Checkpointing after every tool call turns an hours-long session into a series of small, restartable steps.',
      metrics: { done: '84 tool calls', cost: '$2.10', run: '3 h', dup: 'low' },
      scene: {
        nodes: [
          { id: 'ide', kind: 'client', at: at(-4.4, -3), label: 'IDE or CLI', status: 'down', badge: 'crashed' },
          { ...worker, label: 'agent runtime', sub: 'local process' },
          { id: 'ckpt', kind: 'db', at: at(4.4, -3), label: 'checkpoint file', sub: 'on disk', tint: 'teal', badge: 'after each call' },
        ],
        links: [link('ide', 'worker'), link('worker', 'ckpt')],
        flows: [
          { path: ['worker', 'ckpt'], tone: 'data', label: 'save after tool call', duration: 1.4 },
          { path: ['ckpt', 'worker'], tone: 'response', label: '/resume: load plan', duration: 1.4, delay: 1.6 },
        ],
        panel: {
          title: 'What /resume restores',
          icon: 'FileCode',
          rows: [
            { text: 'Versioned plan', value: 'step 9 of 14' },
            { text: 'Conversation summary', value: 'older turns compacted' },
            { text: 'Project conventions', value: 'pnpm, not npm' },
            { text: 'File contents', value: 're-read on demand' },
          ],
        },
        caption: 'Local does not mean disposable',
      },
    },
    {
      title: 'Returns agent',
      tag: 'case',
      heading: 'Case: the returns agent that waits for a shipment',
      eli5: 'A customer sends a cake back. The bakery waits days for the box, then decides what to do. The checklist remembers where things stand the whole time.',
      body: [
        'A returns-triage agent reads the order, the reviews, the customer history and the policy, then proposes replace, refund or deny. Above $50 a human approves.',
        'Runs span days because the parcel has to arrive. That is why it is built on durable execution from the start, and why it came last in a phased rollout of AI features beside a legacy system.',
      ],
      keyIdea: 'The more of the process that waits on the outside world, the more a durable run pays for itself.',
      metrics: { done: '9 of 11', cost: '$0.07', run: '4 days', dup: 'none' },
      metricTones: { dup: 'good' },
      scene: {
        nodes: [
          { ...engine, at: at(0, -3), badge: 'returns run' },
          { ...model, at: at(4.4, -3), label: 'triage model' },
          { id: 'parcel', kind: 'block', at: at(-4.4, -3), label: 'return parcel', sub: 'in transit', icon: 'Package', tint: 'amber' },
          { id: 'approver', kind: 'user', at: at(2.2, 3.4), label: 'approver', badge: 'over $50' },
        ],
        links: [link('parcel', 'engine'), link('engine', 'model'), link('engine', 'approver')],
        flows: [
          { path: ['engine', 'model'], tone: 'request', label: 'propose outcome', duration: 1.3 },
          { path: ['engine', 'approver'], tone: 'event', label: 'refund $120?', duration: 1.3, delay: 1.4 },
          { path: ['parcel', 'engine'], tone: 'event', label: 'delivered', duration: 1.3, delay: 2.8 },
        ],
        panel: {
          title: 'Triage inputs and gate',
          icon: 'List',
          rows: [
            { text: 'Order and product reviews', value: 'read' },
            { text: 'Customer history', value: 'read' },
            { text: 'Return policy', value: 'read' },
            { text: 'Outcome', value: 'replace, refund, deny' },
            { text: 'Above $50', value: 'human approves', tone: 'warn' },
          ],
        },
        caption: 'Days long, never lost',
      },
    },
    {
      title: 'Audit trail',
      tag: 'concept',
      heading: 'The history doubles as trace and audit log',
      eli5: 'The checklist shows who did each stage and when. If a customer asks what happened to the cake, you read it back.',
      body: [
        'One agent run is a tree of LLM calls, tool calls and retries. The history already records each one with inputs, outputs and timing, so you can open any run and see how it got to its answer.',
        'It also supports a post-hoc check: after a write tool, verify the write landed, and log the result. Send both to your trace and audit systems.',
      ],
      keyIdea: 'A durable history is a free, exact record of what the agent did. Use it for debugging, audits and verification.',
      metrics: { done: '12 of 20', cost: '$0.09', run: '6 h', dup: 'none' },
      metricTones: { dup: 'good' },
      scene: {
        nodes: [
          { ...history, at: at(-4.4, -3), status: 'ok' },
          { id: 'trace', kind: 'monitor', at: at(0, -3), label: 'traces', sub: 'call tree' },
          { id: 'audit', kind: 'warehouse', at: at(4.4, -3), label: 'audit log', sub: 'compliance' },
          { ...refund, at: at(0, 5.6), badge: 'write verified' },
        ],
        links: [link('history', 'trace'), link('trace', 'audit'), link('history', 'refund', { style: 'dashed' })],
        flows: [
          { path: ['history', 'trace'], tone: 'data', label: 'spans', duration: 1.3 },
          { path: ['trace', 'audit'], tone: 'data', label: 'events', duration: 1.3, delay: 1.4 },
          { path: ['refund', 'history'], tone: 'response', label: 'did it land?', duration: 1.3, delay: 2.8 },
        ],
        panel: {
          title: 'One run, as recorded',
          icon: 'List',
          rows: [
            { text: 'llm_call: plan', value: '1.2 s, $0.004' },
            { text: 'get_order', value: '180 ms' },
            { text: 'issue_refund', value: 'key r42:5, ok' },
            { text: 'verify_refund', value: 'ledger matches', tone: 'good' },
            { text: 'write_reply', value: 'sent', tone: 'good' },
          ],
        },
        caption: 'Every step, with inputs and outputs',
      },
    },
    {
      title: 'The cost',
      tag: 'tradeoff',
      heading: 'Durability is not free, so use it where it pays',
      eli5: 'Ticking a checklist after every tiny stage slows the baker down. For a one-minute cookie it is silly. For a three-day wedding cake it is the only sane way.',
      body: [
        'Each step adds a write to the history and a round trip to the engine, often tens of milliseconds. Histories take storage, and the engine is another system to run and learn.',
        'A single-turn chat answer needs none of it. Use durable execution for runs that are long, call side-effecting tools, wait on people or have to survive deploys.',
      ],
      keyIdea: 'Pay for durability when a lost run is costly. Skip it for short, safe, repeatable calls.',
      metrics: { done: '-', cost: '+ engine', run: '+ tens of ms per step', dup: '-' },
      metricTones: { run: 'warn' },
      scene: {
        nodes: [
          { id: 'chat', kind: 'block', size: 0.85, at: at(-3, -2.5), label: 'chat answer', sub: '2 s, no side effects', icon: 'Zap', tint: 'gray', badge: 'skip it' },
          { id: 'agent', kind: 'block', size: 0.85, at: at(3, -2.5), label: 'refund agent', sub: 'minutes to days', icon: 'Workflow', tint: 'violet', badge: 'use it' },
          engine,
        ],
        links: [link('agent', 'engine')],
        panel: {
          title: 'Use it when',
          icon: 'Scale',
          rows: [
            { text: 'Run lasts minutes or more', value: 'yes', tone: 'good' },
            { text: 'Calls write tools', value: 'yes', tone: 'good' },
            { text: 'Waits on a person', value: 'yes', tone: 'good' },
            { text: 'Must survive a deploy', value: 'yes', tone: 'good' },
            { text: 'One short read-only call', value: 'no', tone: 'muted' },
          ],
        },
        caption: 'Match the machinery to the risk',
      },
    },
    {
      title: 'Long histories',
      tag: 'tradeoff',
      heading: 'Histories grow, and some runs never succeed',
      eli5: 'A checklist with a thousand ticks gets too long to read, so the bakery starts a fresh sheet with a short summary. A recipe that can never work goes to the owner.',
      body: [
        'A run that loops for weeks piles up events, and replay slows down. Engines let you **continue as new**: end the run and start a fresh one that carries a summary of the state.',
        'A run that keeps failing needs an exit: a retry cap, a dead-letter queue and `escalate_to_human`. Without one, a poison run retries forever.',
      ],
      keyIdea: 'Keep histories short by rolling over, and give every run a way to fail loudly to a person.',
      metrics: { done: '9,800 events', cost: '-', run: '3 weeks', dup: '-' },
      metricTones: { done: 'warn' },
      scene: {
        nodes: [
          { ...history, at: at(-4.4, -3), badge: '9,800 events', status: 'hot' },
          { ...engine, at: at(0, -3), label: 'continue as new', sub: 'fresh run + summary' },
          { id: 'dlq', kind: 'queue', at: at(4.4, -3), label: 'dead letters', sub: 'poison runs' },
          { id: 'human', kind: 'user', at: at(0, 3.4), label: 'on-call' },
        ],
        links: [link('history', 'engine'), link('engine', 'dlq'), link('dlq', 'human')],
        flows: [
          { path: ['history', 'engine'], tone: 'data', label: 'summary only', duration: 1.3 },
          { path: ['engine', 'dlq'], tone: 'error', label: 'failed 5 times', duration: 1.3, delay: 1.4 },
          { path: ['dlq', 'human'], tone: 'event', label: 'escalate', duration: 1.3, delay: 2.8 },
        ],
        panel: {
          title: 'Keep a long run healthy',
          icon: 'Gauge',
          rows: [
            { text: 'History past a few thousand events', value: 'continue as new' },
            { text: 'Same step fails 5 times', value: 'stop retrying', tone: 'warn' },
            { text: 'Failed run', value: 'dead-letter queue' },
            { text: 'Last resort', value: 'escalate_to_human', tone: 'good' },
          ],
        },
        caption: 'Roll over, and fail loudly',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Durable execution in one picture',
      eli5: 'The bakery keeps one **checklist** that survives any baker. Bakers can be replaced, stages are never redone, and the owner can answer tomorrow.',
      body: [
        'Make the agent a state machine, store every step result in an engine history, and replay it on a new worker after a crash. Workflow code decides, activities act.',
        'Add retry policies with error kinds, idempotency keys on writes, human gates, timers, hard caps, versioning for deploys and a rollover plan for long histories.',
      ],
      keyIdea: 'The run outlives the process. Record every result once, replay it for free, and make every write safe to repeat.',
      metrics: { done: '12 of 20', cost: '$0.09', run: '6 h', dup: 'none' },
      metricTones: { dup: 'good', cost: 'good' },
      scene: {
        nodes: [
          user,
          { ...engine, at: at(0, -3), status: 'ok' },
          { ...worker, at: at(4.4, -3), label: 'worker', sub: 'disposable' },
          { ...history, at: at(0, 3.4) },
          { ...refund, at: at(4.4, 3.4), chips: ['key r42:5'] },
        ],
        links: [link('user', 'engine'), link('engine', 'worker'), link('engine', 'history'), link('worker', 'refund')],
        flows: [
          { path: ['user', 'engine'], tone: 'request', label: 'start', duration: 1.2 },
          { path: ['engine', 'worker'], tone: 'event', label: 'task', duration: 1.2, delay: 1.3 },
          { path: ['worker', 'refund'], tone: 'request', label: 'write + key', duration: 1.2, delay: 2.6 },
          { path: ['engine', 'history'], tone: 'data', label: 'record', duration: 1.2, delay: 3.9 },
        ],
        panel: {
          title: 'The checklist',
          icon: 'List',
          rows: [
            { text: 'State machine, named steps', value: 'resume point' },
            { text: 'History plus replay', value: 'no rework' },
            { text: 'Retries plus keys', value: 'safe repeats' },
            { text: 'Signals plus timers', value: 'humans, days' },
            { text: 'Caps plus versions', value: 'bounded, deployable' },
          ],
        },
        caption: 'The run outlives the process',
      },
      quiz: {
        question: 'A returns agent must wait 4 days for a parcel and survive three deploys meanwhile. What fits best?',
        options: [
          'A long HTTP request with a raised gateway timeout',
          'A background thread that sleeps for 4 days',
          'A workflow with a durable timer, replayed on any worker, with versioned code',
          'A cron job that restarts the agent from step 1 each hour',
        ],
        answer: 2,
        explain: 'A durable timer holds no process, and replay lets any worker continue. Versioning keeps in-flight runs safe across deploys. Threads and long requests die with the process, and restarting from step 1 repeats side effects.',
      },
    },
  ],
};
