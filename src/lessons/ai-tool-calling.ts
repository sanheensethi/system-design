import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const user: SceneNode = { id: 'user', kind: 'user', at: at(-4.4, -3), label: 'customer' };
const runtime: SceneNode = { id: 'runtime', kind: 'block', at: at(0, -3), label: 'runtime', sub: 'the foreman', icon: 'Workflow', tint: 'violet' };
const model: SceneNode = { id: 'model', kind: 'block', at: at(4.4, -3), label: 'model', sub: 'the carpenter', icon: 'Cpu', tint: 'amber' };
const orders: SceneNode = { id: 'orders', kind: 'block', size: 0.8, at: at(-2.2, 3.4), label: 'search_orders', sub: 'tool', icon: 'ShoppingBag', tint: 'blue' };
const refund: SceneNode = { id: 'refund', kind: 'block', size: 0.8, at: at(2.2, 3.4), label: 'issue_refund', sub: 'tool', icon: 'Receipt', tint: 'green' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

export const aiToolCalling: Lesson = {
  id: 'ai-tool-calling',
  title: 'Tool calling and MCP (part 1)',
  tagline: 'How a model asks for an action, what a tool definition must say, and how to design tools a model can use well.',
  minutes: 17,
  level: 'Intermediate',
  learn: [
    'Why a model only emits a request, and who actually runs the tool',
    'The tool schema, and why the description decides which tool gets picked',
    'The message round trip: tool call, tool result, final answer',
    'Validation, hallucinated tools, tool choice, parallel calls and streamed calls',
    'Tool design: one verb per tool, bounded output, structured errors, enums',
    'Write tools, idempotency keys, and the token cost of a long tool list',
  ],
  metrics: [
    { key: 'llm', label: 'LLM calls', icon: 'Repeat' },
    { key: 'tools', label: 'Tool calls', icon: 'Plug' },
    { key: 'ctx', label: 'Prompt tokens', icon: 'Layers' },
    { key: 'time', label: 'Latency', icon: 'Timer' },
  ],
  steps: [
    {
      title: 'Text only',
      tag: 'problem',
      heading: 'A model can write about a refund. It cannot issue one.',
      eli5: 'A master **carpenter** is locked in a room with a pencil and paper. A customer slides a note under the door asking where their table is, and all the carpenter can do is write back a guess.',
      body: [
        'A language model takes text in and gives text out. Ask a support bot "where is order 9001?" and it has no way to look. It writes a confident sentence that may be invented.',
        'It cannot read your database, call a courier API or issue a refund. To act on the world, the model needs a safe way to ask something else to act for it.',
      ],
      keyIdea: 'A model alone only produces text. Anything that touches the outside world has to be done by something else.',
      metrics: { llm: '1', tools: '0', ctx: '600', time: '1.2 s' },
      metricTones: { tools: 'bad' },
      scene: {
        nodes: [
          { ...user, chips: ['where is order 9001?'] },
          { ...model, status: 'active', load: 70, chips: [{ text: 'guess: "tomorrow"', tone: 'bad' }] },
        ],
        links: [link('user', 'model', { label: 'text in, text out' })],
        flows: [
          { path: ['user', 'model'], tone: 'request', label: 'where is 9001?', duration: 1.4 },
          { path: ['model', 'user'], tone: 'error', label: 'invented answer', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'What the model can do alone',
          icon: 'FileText',
          rows: [
            { text: 'Write text', value: 'yes', tone: 'good' },
            { text: 'Read the orders database', value: 'no', tone: 'bad' },
            { text: 'Call a courier API', value: 'no', tone: 'bad' },
            { text: 'Issue a refund', value: 'no', tone: 'bad' },
          ],
          footer: { text: 'It answers anyway, and may be wrong', tone: 'bad' },
        },
        caption: 'Text in, text out, nothing real touched',
      },
    },
    {
      title: 'A request',
      tag: 'concept',
      heading: 'A tool call is a request, not an action',
      eli5: 'The **carpenter** writes a slip: "fetch the order book, page 9001". The **foreman** carries the slip out, does the fetching, and slides the result back under the door.',
      body: [
        'With **tool calling**, the model can answer with a structured **tool call** instead of prose: a tool name and JSON arguments. That is all it emits.',
        'Your **runtime** reads that request, runs the real function, and sends the output back as the next message. The model never executes anything and never holds a credential.',
      ],
      keyIdea: 'The model asks. Your code decides whether to run it, runs it, and reports back.',
      metrics: { llm: '1', tools: '1', ctx: '900', time: '1.6 s' },
      scene: {
        nodes: [
          { ...runtime, status: 'active' },
          { ...model, chips: [{ text: 'search_orders(ORD-9001)', tone: 'good' }] },
          { ...orders, status: 'active' },
        ],
        links: [link('model', 'runtime', { label: 'tool call' }), link('runtime', 'orders', { label: 'real call' })],
        flows: [
          { path: ['model', 'runtime'], tone: 'request', label: 'tool call (JSON)', duration: 1.2 },
          { path: ['runtime', 'orders'], tone: 'request', label: 'run it', duration: 1.2, delay: 1.3 },
          { path: ['orders', 'runtime'], tone: 'response', label: 'order data', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'Who does what',
          icon: 'Table',
          rows: [
            { text: 'Model', value: 'picks a tool, writes args' },
            { text: 'Runtime', value: 'validates and executes', tone: 'good' },
            { text: 'Tool', value: 'does the real work' },
          ],
          footer: { text: 'The model never runs code itself', tone: 'muted' },
        },
        caption: 'Model writes the request, runtime does the work',
      },
    },
    {
      title: 'Tool schema',
      tag: 'concept',
      heading: 'Each tool is declared with a name, a description and a schema',
      eli5: 'Before work starts, the **foreman** pins a card for each tool on the wall: its name, what it is for, and what blanks a slip must fill in. The carpenter reads the cards.',
      body: [
        'On every request you send the model a list of **tool definitions**: a `name`, a plain-language `description`, and an `input_schema` in JSON Schema that says which arguments exist, their types and limits.',
        'The model sees these definitions as part of its prompt. It can only call what is listed, and its arguments are shaped by the schema.',
      ],
      keyIdea: 'A tool definition is a typed contract the model reads as text.',
      metrics: { llm: '1', tools: '0', ctx: '1,100', time: '1.2 s' },
      scene: {
        nodes: [{ ...runtime, status: 'active' }, model, { ...orders, badge: 'name, description, schema' }],
        links: [link('orders', 'runtime', { label: 'definition', route: 'straight' }), link('runtime', 'model', { label: 'in the prompt' })],
        flows: [
          { path: ['orders', 'runtime'], tone: 'data', label: 'tool card', duration: 1.2 },
          { path: ['runtime', 'model'], tone: 'request', label: 'tools: [ ... ]', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'One tool definition',
          icon: 'Braces',
          rows: [
            { text: 'name', value: 'search_orders' },
            { text: 'description', value: 'when to use it', tone: 'good' },
            { text: 'input_schema', value: 'args, types, limits' },
          ],
          footer: { text: 'About 150 to 400 tokens each', tone: 'muted' },
        },
        caption: 'The model reads tool cards as part of its prompt',
      },
      code: {
        language: 'json',
        title: 'A tool definition',
        source: `{
  "name": "search_orders",
  "description": "Search the orders database by customer email or order id. Returns up to 20 orders, most recent first. Use this when the user asks about their purchase history.",
  "input_schema": {
    "type": "object",
    "properties": {
      "customer_email": { "type": "string", "format": "email" },
      "order_id": { "type": "string", "pattern": "^ORD-[0-9]{8}$" },
      "limit": { "type": "integer", "minimum": 1, "maximum": 20, "default": 10 }
    },
    "oneOf": [{ "required": ["customer_email"] }, { "required": ["order_id"] }]
  }
}`,
        highlight: [2, 3, 5, 12],
      },
    },
    {
      title: 'Description',
      tag: 'concept',
      heading: 'The model picks a tool by its description, not its name',
      eli5: 'The carpenter cannot try a tool before choosing. They read the card. A card that says "does stuff" gets picked wrongly, or never.',
      body: [
        'The description is **load-bearing**. It should say what the tool does, what it returns, and when to use it (and when not to). Vague text causes wrong-tool picks, which the book calls the top cause of silent agent failures.',
        'Treat it like an API doc written for a reader who cannot ask questions.',
      ],
      keyIdea: 'Write the description as the model\'s only documentation. Wrong tool choices usually start there.',
      metrics: { llm: '1', tools: '0', ctx: '1,500', time: '1.2 s' },
      metricTones: { ctx: 'warn' },
      scene: {
        nodes: [
          { ...model, status: 'active' },
          { ...orders, label: 'search_orders', status: 'ok', chips: [{ text: 'by email or order id', tone: 'good' }] },
          { id: 'dothing', kind: 'block', size: 0.8, at: at(2.2, 3.4), label: 'do_thing', sub: 'tool', icon: 'Boxes', tint: 'gray', status: 'dim', chips: [{ text: 'does stuff', tone: 'bad' }] },
        ],
        links: [link('model', 'orders', { route: 'straight' }), link('model', 'dothing', { route: 'straight' })],
        flows: [{ path: ['model', 'orders'], tone: 'request', label: 'clear card, picked', duration: 1.6 }],
        panel: {
          title: 'Two cards for the same job',
          icon: 'Table',
          rows: [
            { text: 'search_orders: "by email or id, 20 max, newest first"', tone: 'good' },
            { text: 'do_thing: "does stuff with input"', tone: 'bad' },
          ],
          footer: { text: 'Same code behind both, very different results', tone: 'warn' },
        },
        caption: 'Same capability, clear card versus vague card',
      },
    },
    {
      title: 'Round trip',
      tag: 'concept',
      heading: 'One tool use is two model calls',
      eli5: 'First slip out: "look up 9001". The foreman returns with the answer, and the carpenter reads it and writes the reply for the customer. Two writing turns for one question.',
      body: [
        'The first model call ends with a tool call and an `id`. The runtime runs it, then calls the model again with the history plus a **tool result** that carries the same `id`.',
        'Now the model can answer from real data. The call is stateless: each turn resends the whole history, so cost and latency grow with every round trip.',
      ],
      keyIdea: 'A tool call costs two model calls, one to ask and one to read the result.',
      metrics: { llm: '2', tools: '1', ctx: '1,400', time: '2.8 s' },
      scene: {
        nodes: [user, { ...runtime, status: 'active' }, model, { ...orders, status: 'active' }],
        links: [link('user', 'runtime'), link('runtime', 'model', { arrow: 'both', label: '2 model calls' }), link('runtime', 'orders')],
        flows: [
          { path: ['runtime', 'model'], tone: 'request', label: '1: question + tools', duration: 1.1 },
          { path: ['model', 'runtime'], tone: 'request', label: 'tool_use id=t1', duration: 1.1, delay: 1.2 },
          { path: ['runtime', 'orders', 'runtime'], tone: 'response', label: 'run (0.4 s)', duration: 1.2, delay: 2.4 },
          { path: ['runtime', 'model'], tone: 'request', label: '2: tool_result t1', duration: 1.1, delay: 3.7 },
          { path: ['model', 'runtime', 'user'], tone: 'response', label: 'final answer', duration: 1.4, delay: 4.9 },
        ],
        panel: {
          title: 'Latency of one tool use',
          icon: 'Timer',
          rows: [
            { text: 'Model call 1', value: '1.2 s' },
            { text: 'Tool run', value: '0.4 s' },
            { text: 'Model call 2', value: '1.2 s' },
          ],
          footer: { text: 'Total 2.8 s, and the second call resends the history', tone: 'warn' },
        },
        caption: 'Ask, run, read, answer',
      },
      code: {
        language: 'json',
        title: 'The messages on the wire',
        source: `[
  { "role": "user", "content": "Where is order ORD-00009001?" },
  { "role": "assistant", "content": [
      { "type": "tool_use", "id": "t1", "name": "search_orders",
        "input": { "order_id": "ORD-00009001" } } ] },
  { "role": "user", "content": [
      { "type": "tool_result", "tool_use_id": "t1",
        "content": "{\\"status\\":\\"shipped\\",\\"eta\\":\\"Thu\\"}" } ] },
  { "role": "assistant", "content": "It shipped and arrives Thursday." }
]`,
        highlight: [4, 5, 7, 8],
      },
    },
    {
      title: 'Validate first',
      tag: 'concept',
      heading: 'Never run a call the model made up',
      eli5: 'The carpenter might write a slip for a tool that is not on the wall, or leave a blank unfilled. The foreman checks the slip first and hands back a note: "no such tool, here is what we have".',
      body: [
        'Models sometimes call a tool that does not exist (a **hallucinated tool**) or send arguments that break the schema. The runtime must check both before anything runs.',
        'Do not crash. Return a short, structured error as the tool result so the model can correct itself on the next turn.',
      ],
      keyIdea: 'Validate name and arguments in the runtime, and answer a bad call with an error the model can read.',
      metrics: { llm: '2', tools: '0', ctx: '1,500', time: '2.6 s' },
      scene: {
        nodes: [
          { ...model, chips: [{ text: 'delete_everything()', tone: 'bad' }] },
          { id: 'check', kind: 'limiter', at: at(0, -3), label: 'validator', sub: 'name + schema', status: 'active' },
          { ...orders, at: at(-3.2, 3.8), status: 'dim' },
        ],
        links: [link('model', 'check'), link('check', 'orders', { style: 'dashed' })],
        flows: [
          { path: ['model', 'check'], tone: 'request', label: 'delete_everything', duration: 1.2 },
          { path: ['check', 'model'], tone: 'error', label: 'unknown tool', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'What goes back to the model',
          icon: 'Code',
          code: '{\n  "error": "unknown_tool",\n  "message": "No tool named delete_everything",\n  "available": ["search_orders", "issue_refund"]\n}',
          footer: { text: 'The tool never ran', tone: 'good' },
        },
        caption: 'The runtime is the gatekeeper',
      },
      code: {
        language: 'python',
        title: 'Check before you run',
        source: `import jsonschema

def run_tool(call, tools):
    tool = tools.get(call.name)
    if tool is None:
        return {"error": "unknown_tool", "available": list(tools)}
    try:
        jsonschema.validate(call.input, tool.input_schema)
    except jsonschema.ValidationError as e:
        return {"error": "bad_arguments", "message": e.message}
    return tool.run(**call.input)`,
        highlight: [5, 6, 8, 10],
      },
      quiz: {
        question: 'The model returns a tool call for a tool name you never defined. What should the runtime do?',
        options: [
          'Run the closest matching tool',
          'Crash the request so the bug is visible',
          'Do not run anything, and return a structured error as the tool result',
          'Ask the model to retry with the same prompt and hope',
        ],
        answer: 2,
        explain: 'The runtime owns what executes. An unknown name is never run. A readable error result lets the model fix its next call, and listing the valid tools in the error helps it do so.',
      },
    },
    {
      title: 'Tool choice',
      tag: 'concept',
      heading: 'You can steer whether and which tool is called',
      eli5: 'Sometimes the foreman says "use any tool you like", sometimes "you must use the tape measure", and sometimes "no tools this time, just talk". The carpenter follows the rule.',
      body: [
        'Most APIs have a **tool choice** setting. `auto` lets the model decide whether to call a tool. `any` forces some tool. A named tool forces that exact one. `none` allows text only.',
        'Forcing is useful when you want structured output from a known tool, or to stop tool calls on a final summary turn.',
      ],
      keyIdea: 'Tool choice turns the model\'s decision into a rule when you need one.',
      metrics: { llm: '1', tools: '1', ctx: '1,500', time: '1.6 s' },
      scene: {
        nodes: [{ ...runtime, status: 'active' }, model, { ...orders, status: 'ok' }],
        links: [link('runtime', 'model', { label: 'tool_choice' }), link('model', 'orders', { route: 'straight' })],
        flows: [
          { path: ['runtime', 'model'], tone: 'request', label: 'tool_choice: search_orders', duration: 1.3 },
          { path: ['model', 'orders'], tone: 'request', label: 'forced call', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'tool_choice values',
          icon: 'Table',
          rows: [
            { text: 'auto', value: 'model decides' },
            { text: 'any', value: 'must call some tool' },
            { text: 'tool: search_orders', value: 'must call this one' },
            { text: 'none', value: 'text only', tone: 'muted' },
          ],
          footer: { text: 'Exact names vary a little by provider', tone: 'muted' },
        },
        caption: 'Let the model decide, or make the call for it',
      },
    },
    {
      title: 'Parallel calls',
      tag: 'tradeoff',
      heading: 'Independent calls can go out together',
      eli5: 'The carpenter needs the customer card and the delivery sheet, and neither depends on the other. They write both slips at once, and two helpers fetch them side by side.',
      body: [
        'When two calls do not depend on each other, the model can emit both in one response. The runtime runs them **concurrently** and returns every result in one follow-up message.',
        'Two 0.4 s tools cost 0.4 s instead of 0.8 s, and the model needs one fewer round trip. Calls that depend on each other still run in sequence.',
      ],
      keyIdea: 'Run independent tool calls concurrently and return all results together.',
      metrics: { llm: '2', tools: '2', ctx: '1,900', time: '2.8 s' },
      metricTones: { time: 'good' },
      scene: {
        nodes: [
          { ...runtime, status: 'active' },
          model,
          { id: 'account', kind: 'block', size: 0.8, at: at(-2.2, 3.4), label: 'get_account', sub: 'read tool', icon: 'User', tint: 'blue', chips: ['0.4 s'] },
          { id: 'getorders', kind: 'block', size: 0.8, at: at(2.2, 3.4), label: 'get_orders', sub: 'read tool', icon: 'ShoppingBag', tint: 'blue', chips: ['0.4 s'] },
        ],
        links: [link('model', 'runtime', { arrow: 'both' }), link('runtime', 'account'), link('runtime', 'getorders')],
        flows: [
          { path: ['model', 'runtime'], tone: 'request', label: '2 tool calls', duration: 1.1 },
          { path: ['runtime', 'account', 'runtime'], tone: 'request', label: 'in parallel', duration: 1.4, delay: 1.2 },
          { path: ['runtime', 'getorders', 'runtime'], tone: 'request', label: 'in parallel', duration: 1.4, delay: 1.2 },
          { path: ['runtime', 'model'], tone: 'response', label: '2 results, 1 message', duration: 1.1, delay: 2.8 },
        ],
        panel: {
          title: 'Wall-clock for two 0.4 s tools',
          icon: 'Timer',
          rows: [
            { text: 'One after another', value: '0.8 s', tone: 'warn' },
            { text: 'Concurrent', value: '0.4 s', tone: 'good' },
          ],
          footer: { text: 'Never parallelize calls that depend on each other', tone: 'muted' },
        },
        caption: 'Two independent lookups at once',
      },
      quiz: {
        question: 'The model needs the customer profile and the order list, and neither call needs the other\'s result. How should the runtime run them?',
        options: [
          'One after another, so the second sees the first result',
          'Concurrently, then return both results in one follow-up message',
          'Only the first, and ask the model to repeat for the second',
          'Merge them into one tool with a mode argument',
        ],
        answer: 1,
        explain: 'Independent calls can run at the same time, so the wait is the slowest call, not the sum. Calls where one needs the other\'s output still run in sequence.',
      },
    },
    {
      title: 'Streaming',
      tag: 'concept',
      heading: 'Tool calls can stream in as they are written',
      eli5: 'The carpenter writes the slip one letter at a time. The foreman peeks at the first word, "fetch", and tells the customer "one moment, looking it up" before the slip is finished.',
      body: [
        'In a streaming response, the tool name arrives first and the arguments arrive token by token. The UI can show "Searching orders..." before the call is complete.',
        'Never execute on partial arguments. Partial JSON is not valid and cannot commit to a safe action. Only the UI status line can start early. The tool runs after the block ends and the arguments pass validation.',
      ],
      keyIdea: 'Stream the intent to the user early, and execute only when the arguments are complete.',
      metrics: { llm: '1', tools: '1', ctx: '1,500', time: '1.4 s' },
      scene: {
        nodes: [{ id: 'phone', kind: 'phone', at: at(-4.4, -3), label: 'chat app', chips: [{ text: 'Searching orders...', tone: 'good' }] }, { ...runtime, status: 'active' }, model],
        links: [link('model', 'runtime', { label: 'token stream' }), link('runtime', 'phone')],
        flows: [
          { path: ['model', 'runtime'], tone: 'data', label: 'name: search_orders', duration: 1.1 },
          { path: ['runtime', 'phone'], tone: 'event', label: 'status line', duration: 1.1, delay: 1.2 },
          { path: ['model', 'runtime'], tone: 'data', label: 'args, token by token', count: 3, duration: 1.4, delay: 1.4 },
        ],
        panel: {
          title: 'Stream, in order',
          icon: 'Rss',
          rows: [
            { text: '1. block starts', value: 'name known', tone: 'good' },
            { text: '2. argument fragments', value: 'partial JSON' },
            { text: '3. block ends', value: 'args complete', tone: 'good' },
            { text: '4. run the tool', value: 'only now' },
          ],
          footer: { text: 'Partial JSON is not valid JSON yet', tone: 'warn' },
        },
        caption: 'Show intent early, run when complete',
      },
    },
    {
      title: 'Good tools',
      tag: 'concept',
      heading: 'Tools are the API of your agent, so design them like one',
      eli5: 'A good tool on the wall does one clear job and is labeled so. A hammer that is also a saw and a drill confuses the carpenter, and so does a drawer of near-identical screwdrivers.',
      body: [
        'A bad tool makes a smart model look slow. A good one makes a cheap model look sharp. Keep each tool **self-describing**, with a **bounded scope** of one verb, a **deterministic schema**, **bounded output** and **structured errors**.',
        'Prefer `cancel_order` over `manage_order(action=...)`. The model picks better among sharp verbs.',
      ],
      keyIdea: 'One tool, one verb, one predictable result shape.',
      metrics: { llm: '2', tools: '1', ctx: '1,400', time: '2.8 s' },
      scene: {
        nodes: [
          { ...model, status: 'active' },
          { id: 'cancel', kind: 'block', size: 0.8, at: at(-2.2, 3.4), label: 'cancel_order', sub: 'one verb', icon: 'Receipt', tint: 'green', status: 'ok' },
          { id: 'manage', kind: 'block', size: 0.8, at: at(2.2, 3.4), label: 'manage_order', sub: 'mode = 10 things', icon: 'Boxes', tint: 'gray', status: 'dim' },
        ],
        links: [link('model', 'cancel', { route: 'straight' }), link('model', 'manage', { route: 'straight', style: 'dashed' })],
        flows: [{ path: ['model', 'cancel'], tone: 'request', label: 'cancel_order(id)', duration: 1.6 }],
        panel: {
          title: 'Six rules for a tool',
          icon: 'List',
          rows: [
            { text: 'Self-describing', value: 'say when to use it' },
            { text: 'Bounded scope', value: 'one verb' },
            { text: 'Idempotent writes', value: 'retries are safe' },
            { text: 'Structured errors', value: 'model can recover' },
            { text: 'Bounded output', value: 'paginate' },
            { text: 'Deterministic schema', value: 'same shape always' },
          ],
        },
        caption: 'Sharp verbs beat one tool with a mode flag',
      },
    },
    {
      title: 'Bad tools',
      tag: 'case',
      heading: 'Three tool shapes that fail in production',
      eli5: 'Two screwdrivers with different names that do the same job make the carpenter swap between them forever. A drawer with a "mode" dial and ten settings gets used wrong.',
      body: [
        '**Overlapping tools** (`search_customer` and `find_user`) make the model oscillate. **Swiss-army tools** hide ten behaviors behind a `mode` argument. **Free text** where an enum would do invites typos.',
        'Merge the first, split the second, and give the third a closed list of values.',
      ],
      keyIdea: 'If a human would hesitate between two tools, the model will too.',
      metrics: { llm: '5', tools: '4', ctx: '2,400', time: '7.9 s' },
      metricTones: { llm: 'bad', time: 'bad' },
      scene: {
        nodes: [
          { ...model, status: 'hot', load: 88, badge: 'flip-flopping' },
          { id: 'sc', kind: 'block', size: 0.8, at: at(-2.2, 3.4), label: 'search_customer', sub: 'tool', icon: 'Users', tint: 'blue', status: 'hot' },
          { id: 'fu', kind: 'block', size: 0.8, at: at(2.2, 3.4), label: 'find_user', sub: 'tool', icon: 'User', tint: 'blue', status: 'hot' },
        ],
        links: [link('model', 'sc', { route: 'straight' }), link('model', 'fu', { route: 'straight' })],
        flows: [
          { path: ['model', 'sc', 'model'], tone: 'request', label: 'try one', duration: 1.4 },
          { path: ['model', 'fu', 'model'], tone: 'request', label: 'now the other', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Three shapes and their fixes',
          icon: 'Table',
          rows: [
            { text: 'Overlapping tools', value: 'merge into one', tone: 'bad' },
            { text: 'Swiss-army tool with mode', value: 'split by verb', tone: 'bad' },
            { text: 'Free text where values are known', value: 'closed enum', tone: 'bad' },
          ],
          footer: { text: 'Fix the tool set, not the prompt', tone: 'good' },
        },
        caption: 'Overlap makes the model hesitate',
      },
    },
    {
      title: 'Output and errors',
      tag: 'concept',
      heading: 'Return small, predictable output and errors the model can act on',
      eli5: 'If the foreman dumps a whole warehouse on the carpenter\'s desk, the desk is full and the carpenter loses the plan. A short list and a "ask for page 2" note works better.',
      body: [
        'Tool output goes into the context window. Return a page with a `next_cursor`, not 50 KB. Cut with a visible marker, never silently, so the model knows more exists.',
        'An error should say what went wrong and what to try: `{"error":"not_found","hint":"search by email first"}`. The shape of a result should never change from call to call.',
      ],
      keyIdea: 'Bound the output, name the cursor, and tell the model how to recover.',
      metrics: { llm: '2', tools: '1', ctx: '1,700', time: '2.8 s' },
      metricTones: { ctx: 'good' },
      scene: {
        nodes: [{ ...runtime, status: 'active' }, { ...model, load: 40 }, { ...orders, chips: [{ text: '20 of 340 rows', tone: 'good' }] }],
        links: [link('orders', 'runtime', { label: 'one page' }), link('runtime', 'model', { label: 'bounded' })],
        flows: [
          { path: ['orders', 'runtime'], tone: 'response', label: 'items + cursor', duration: 1.2 },
          { path: ['runtime', 'model'], tone: 'response', label: '~1.7K tokens', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Same call, two designs',
          icon: 'Table',
          rows: [
            { text: 'Dump all 340 rows', value: '~45K tokens', tone: 'bad' },
            { text: 'Page of 20 and a cursor', value: '~1.7K tokens', tone: 'good' },
            { text: 'Silent cut at 50 KB', value: 'model unaware', tone: 'bad' },
          ],
        },
        caption: 'Keep the desk clear',
      },
      code: {
        language: 'json',
        title: 'A stable result and a useful error',
        source: `{ "items": [{ "id": "ORD-00009001", "status": "shipped" }],
  "next_cursor": "c_20" }

{ "error": "not_found",
  "hint": "search by email first, ids look like ORD-00009001" }`,
        highlight: [2, 5],
      },
    },
    {
      title: 'Write tools',
      tag: 'tradeoff',
      heading: 'Reads are cheap to retry. Writes need a key and a gate.',
      eli5: 'Looking at the order book twice does no harm. Sending the same "pay this bill" slip twice pays it twice. So money slips carry a number, and the foreman refuses a number he has seen.',
      body: [
        'Classify every tool by its **side effect**: none, write, or write that needs approval. A retry, a timeout or a repeated model turn can run a write twice.',
        'Give write tools an **idempotency key** so a repeat is ignored. Gate large or irreversible ones behind a human approval.',
      ],
      keyIdea: 'Every write tool needs an idempotency key, and the risky ones need a human in the loop.',
      metrics: { llm: '3', tools: '2', ctx: '2,000', time: '4.4 s' },
      scene: {
        nodes: [{ ...runtime, status: 'active' }, model, { ...refund, status: 'active', chips: [{ text: 'key: r-9001-1', tone: 'good' }] }],
        links: [link('model', 'runtime'), link('runtime', 'refund', { label: 'once only' })],
        flows: [
          { path: ['model', 'runtime'], tone: 'request', label: 'issue_refund', duration: 1.1 },
          { path: ['runtime', 'refund'], tone: 'request', label: 'key r-9001-1', duration: 1.2, delay: 1.2 },
          { path: ['runtime', 'refund'], tone: 'error', label: 'retry, same key', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'Tool set for a support agent',
          icon: 'Table',
          rows: [
            { text: 'kb_search, get_account, get_orders', value: 'read', tone: 'good' },
            { text: 'update_subscription', value: 'write + key', tone: 'warn' },
            { text: 'issue_refund', value: 'under $50 auto, else approval', tone: 'warn' },
            { text: 'escalate_to_human', value: 'always on' },
          ],
        },
        caption: 'A retry must not double the refund',
      },
    },
    {
      title: 'Token cost',
      tag: 'tradeoff',
      heading: 'Every listed tool costs tokens on every call',
      eli5: 'Every card on the wall is read again at the start of each turn. Forty cards take a long while to read, so you hang only the cards this job needs.',
      body: [
        'Tool definitions are part of the prompt, resent each turn. At 300 tokens each, 40 tools add 12,000 tokens per call and make the right pick harder.',
        'Show a **tool allowlist** per task, keep descriptions tight, and cache the stable prefix. The system prompt and tool list are the same on every turn, which suits prompt caching.',
      ],
      keyIdea: 'A long tool list taxes every call. Offer only what the task needs.',
      metrics: { llm: '2', tools: '1', ctx: '13,500', time: '3.4 s' },
      metricTones: { ctx: 'bad', time: 'warn' },
      scene: {
        nodes: [{ ...runtime, status: 'active' }, { ...model, status: 'hot', load: 82 }, { id: 'catalog', kind: 'block', size: 0.8, at: at(0, 3.4), label: '40 tools', sub: 'in every call', icon: 'Layers', tint: 'red' }],
        links: [link('catalog', 'runtime', { label: '12K tokens' }), link('runtime', 'model')],
        flows: [
          { path: ['catalog', 'runtime'], tone: 'data', label: 'all cards', count: 3, duration: 1.2 },
          { path: ['runtime', 'model'], tone: 'request', label: '13.5K prompt', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Prompt size per call',
          icon: 'Layers',
          rows: [
            { text: '40 tools at ~300 tokens', value: '12,000', tone: 'bad' },
            { text: '6 tools for this task', value: '1,800', tone: 'good' },
            { text: 'Cached prefix, repeat turns', value: 'cheaper read', tone: 'good' },
          ],
          footer: { text: 'Fewer tools also means better picks', tone: 'muted' },
        },
        caption: 'The tool list is part of every prompt',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Part 1 recap: the model asks, the runtime acts',
      eli5: 'The carpenter writes slips. The foreman checks each slip, uses the tool on the wall, and brings back a short answer. Good cards on the wall make the whole workshop fast.',
      body: [
        'A tool call is a structured request. The runtime validates it, runs it, and returns a bounded result. The model reads the result in a second call.',
        'Descriptions drive choice. Sharp one-verb tools, enums, cursors and structured errors make calls reliable. Writes need keys. Part 2 covers MCP and running tools safely.',
      ],
      keyIdea: 'Models request, runtimes execute, and tool design decides how well that works.',
      metrics: { llm: '2', tools: '1', ctx: '1,800', time: '2.8 s' },
      metricTones: { ctx: 'good' },
      scene: {
        nodes: [user, runtime, { ...model, status: 'ok' }, { ...orders, status: 'ok' }],
        links: [link('user', 'runtime'), link('runtime', 'model', { arrow: 'both' }), link('runtime', 'orders')],
        flows: [
          { path: ['user', 'runtime', 'model'], tone: 'request', label: 'question', duration: 1.6 },
          { path: ['model', 'runtime', 'orders'], tone: 'request', label: 'tool call', duration: 1.6, delay: 1.7 },
          { path: ['orders', 'runtime', 'model'], tone: 'response', label: 'result', duration: 1.6, delay: 3.4 },
        ],
        panel: {
          title: 'Keep in mind',
          icon: 'List',
          rows: [
            { text: 'Tool call', value: 'a request, not an action' },
            { text: 'Description', value: 'drives the choice' },
            { text: 'Runtime', value: 'validates, runs, bounds' },
            { text: 'Writes', value: 'idempotency key + gate' },
            { text: 'Tool list', value: 'costs tokens each call' },
          ],
        },
        caption: 'The model asks, the runtime acts',
      },
      quiz: {
        question: 'A write tool times out and the runtime retries it. How do you make sure a refund is not paid twice?',
        options: [
          'Tell the model in the prompt not to retry',
          'Send an idempotency key with each write so a repeat is ignored',
          'Lower the temperature of the model',
          'Make the tool description longer',
        ],
        answer: 1,
        explain: 'Retries happen below the model, so a prompt rule cannot stop them. A key lets the tool recognize the repeat and return the first result instead of acting again.',
      },
    },
  ],
};
