import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const user: SceneNode = { id: 'user', kind: 'user', at: at(-4.4, -3), label: 'customer' };
const runtime: SceneNode = { id: 'runtime', kind: 'block', at: at(0, -3), label: 'runtime', sub: 'the foreman', icon: 'Workflow', tint: 'violet' };
const model: SceneNode = { id: 'model', kind: 'block', at: at(4.4, -3), label: 'model', sub: 'the carpenter', icon: 'Cpu', tint: 'amber' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

export const aiToolCallingPart2: Lesson = {
  id: 'ai-tool-calling-part-2',
  title: 'Tool calling and MCP (part 2)',
  tagline: 'The Model Context Protocol, wrapping legacy systems, tool security, and the gate every tool call should pass.',
  minutes: 18,
  level: 'Intermediate',
  learn: [
    'Why every agent needed its own glue code, and how MCP replaces it',
    'MCP hosts, clients and servers, and the three things a server offers',
    'Transports and the JSON-RPC messages for listing and calling tools',
    'Wrapping a legacy service, and carrying the user identity into every call',
    'How Claude Code uses MCP, hooks and permissions',
    'MCP risks, the tool-call loop incident, and the production gate for tools',
  ],
  metrics: [
    { key: 'glue', label: 'Adapters', icon: 'Plug' },
    { key: 'tools', label: 'Tools visible', icon: 'Layers' },
    { key: 'time', label: 'Latency', icon: 'Timer' },
    { key: 'risk', label: 'Risk', icon: 'Shield' },
  ],
  steps: [
    {
      title: 'Glue code',
      tag: 'problem',
      heading: 'Every agent needed its own adapter for every system',
      eli5: 'Every carpenter\'s workshop has its own plug shape, and every tool shop sells its own plug too. To use a saw from a shop, someone has to build an adapter for that pair.',
      body: [
        'Before a shared protocol, each agent framework shipped its own tool format. The scene draws a small case, 2 agents and 2 systems, which already needs **4 adapters**. At 3 agents and 4 systems it is 12, each one built, tested and kept up to date.',
        'Add a fifth system and every agent needs another adapter. The work grows as agents times systems.',
      ],
      keyIdea: 'Without a standard, integrations multiply: agents times systems.',
      metrics: { glue: '4', tools: '-', time: '-', risk: 'medium' },
      metricTones: { glue: 'bad' },
      scene: {
        nodes: [
          { id: 'agentA', kind: 'block', at: at(-3, -3.4), label: 'IDE agent', icon: 'Code', tint: 'violet' },
          { id: 'agentB', kind: 'block', at: at(3, -3.4), label: 'support bot', icon: 'Users', tint: 'violet' },
          { id: 'github', kind: 'block', size: 0.8, at: at(-3, 3.4), label: 'GitHub', icon: 'Share2', tint: 'gray' },
          { id: 'pg', kind: 'block', size: 0.8, at: at(3, 3.4), label: 'Postgres', icon: 'Database', tint: 'gray' },
        ],
        links: [
          link('agentA', 'github', { label: 'custom', labelTone: 'warn' }),
          link('agentA', 'pg', { label: 'custom', labelTone: 'warn' }),
          link('agentB', 'github', { label: 'custom', labelTone: 'warn' }),
          link('agentB', 'pg', { label: 'custom', labelTone: 'warn' }),
        ],
        flows: [
          { path: ['agentA', 'github'], tone: 'request', label: 'format A', duration: 1.3 },
          { path: ['agentB', 'pg'], tone: 'request', label: 'format B', duration: 1.3, delay: 0.6 },
        ],
        panel: {
          title: 'Adapters to build',
          icon: 'Table',
          rows: [
            { text: '2 agents, 2 systems (drawn)', value: '4', tone: 'warn' },
            { text: '3 agents, 4 systems', value: '12', tone: 'bad' },
            { text: '4 agents, 5 systems', value: '20', tone: 'bad' },
            { text: 'With one shared protocol', value: '3 + 4 = 7', tone: 'good' },
          ],
          footer: { text: 'Each adapter is its own format and its own bugs', tone: 'warn' },
        },
        caption: 'One custom adapter per pair',
      },
    },
    {
      title: 'MCP',
      tag: 'concept',
      heading: 'MCP: one protocol between agents and tool providers',
      eli5: 'Now every tool shop uses the same plug, and every workshop has the same socket. Any foreman can walk into any shop and use what is on the shelf.',
      body: [
        'The **Model Context Protocol (MCP)** is an open standard for exposing tools and data to a model. A **host** (your agent app or IDE) runs an MCP **client** that connects to **servers**, each wrapping one system.',
        'Install the GitHub server and your agent sees its tools. The same idea made language support portable across editors, which is the role LSP plays.',
      ],
      keyIdea: 'Build each integration once as an MCP server. Any MCP host can use it.',
      metrics: { glue: '3', tools: '-', time: '-', risk: 'medium' },
      metricTones: { glue: 'good' },
      scene: {
        nodes: [
          { id: 'host', kind: 'block', at: at(-4.2, 0), label: 'host', sub: 'agent + MCP client', icon: 'Workflow', tint: 'violet', status: 'active' },
          { id: 'gh', kind: 'block', size: 0.8, at: at(0.8, -3.8), label: 'GitHub', sub: 'MCP server', icon: 'Share2', tint: 'teal' },
          { id: 'pg', kind: 'block', size: 0.8, at: at(4, 0), label: 'Postgres', sub: 'MCP server', icon: 'Database', tint: 'teal' },
          { id: 'fs', kind: 'block', size: 0.8, at: at(0.8, 3.8), label: 'Filesystem', sub: 'MCP server', icon: 'HardDrive', tint: 'teal' },
        ],
        links: [link('host', 'gh', { arrow: 'both', label: 'MCP' }), link('host', 'pg', { arrow: 'both', label: 'MCP' }), link('host', 'fs', { arrow: 'both', label: 'MCP' })],
        flows: [
          { path: ['host', 'gh'], tone: 'request', label: 'same protocol', duration: 1.3 },
          { path: ['host', 'pg'], tone: 'request', label: 'same protocol', duration: 1.3, delay: 0.5 },
          { path: ['host', 'fs'], tone: 'request', label: 'same protocol', duration: 1.3, delay: 1 },
        ],
        panel: {
          title: 'Roles',
          icon: 'Table',
          rows: [
            { text: 'Host', value: 'agent app, IDE' },
            { text: 'Client', value: 'one per server, inside the host' },
            { text: 'Server', value: 'exposes one system' },
          ],
          footer: { text: 'Integrations grow as agents plus systems', tone: 'good' },
        },
        caption: 'One socket shape for every tool shop',
      },
    },
    {
      title: 'Primitives',
      tag: 'concept',
      heading: 'A server offers tools, resources and prompts',
      eli5: 'A tool shop sells three things: tools you can use, shelves of paper you can read, and ready-made job sheets. Who picks each is different.',
      body: [
        '**Tools** are callable functions with a JSON schema, and the model chooses to call them. **Resources** are readable data (a file, a table row) addressed by a URI. **Prompts** are named templates the server offers, which the user typically picks.',
        'Tools cover most agent work. Resources let the host load context without a function call.',
      ],
      keyIdea: 'Tools act, resources inform, prompts start a task.',
      metrics: { glue: '1', tools: '-', time: '-', risk: 'medium' },
      scene: {
        nodes: [
          { id: 'host', kind: 'block', at: at(-4.2, 0), label: 'host', sub: 'agent + MCP client', icon: 'Workflow', tint: 'violet' },
          { id: 'srv', kind: 'block', at: at(0.4, 0), label: 'MCP server', sub: 'Postgres', icon: 'Database', tint: 'teal', status: 'active' },
          { id: 'r1', kind: 'block', size: 0.7, at: at(3.6, -3.6), label: 'tools', icon: 'Plug', tint: 'blue' },
          { id: 'r2', kind: 'block', size: 0.7, at: at(6, 0.2), label: 'resources', icon: 'FileText', tint: 'green' },
          { id: 'r3', kind: 'block', size: 0.7, at: at(3.6, 4), label: 'prompts', icon: 'List', tint: 'violet' },
        ],
        links: [link('host', 'srv', { arrow: 'both' }), link('srv', 'r1', { route: 'straight' }), link('srv', 'r2', { route: 'straight' }), link('srv', 'r3', { route: 'straight' })],
        flows: [{ path: ['host', 'srv'], tone: 'request', label: 'list what you offer', duration: 1.4 }, { path: ['srv', 'host'], tone: 'response', label: 'tools, resources, prompts', duration: 1.4, delay: 1.5 }],
        panel: {
          title: 'What a server can expose',
          icon: 'Table',
          rows: [
            { text: 'Tools', value: 'functions, model picks' },
            { text: 'Resources', value: 'data by URI, app picks' },
            { text: 'Prompts', value: 'templates, user picks' },
          ],
          footer: { text: 'A server may offer any mix of the three', tone: 'muted' },
        },
        caption: 'Three kinds of thing on the shelf',
      },
    },
    {
      title: 'Transports',
      tag: 'concept',
      heading: 'Local over stdio, remote over HTTP, same messages',
      eli5: 'A tool shop can be a cupboard inside the workshop, reached by a short whisper, or a store across town reached by phone. The words said are the same.',
      body: [
        'A **stdio** server runs as a child process of the host and talks over standard input and output. It is simple, local and private to one user.',
        'A remote server speaks **HTTP**, with streamed replies where needed, so one hosted server can serve many users. The message format is JSON-RPC 2.0 either way.',
      ],
      keyIdea: 'The transport changes where the server runs. The messages do not change.',
      metrics: { glue: '2', tools: '-', time: '-', risk: 'medium' },
      scene: {
        nodes: [
          { id: 'host', kind: 'block', at: at(-4.4, 0), label: 'host', sub: 'MCP client', icon: 'Workflow', tint: 'violet', status: 'active' },
          { id: 'local', kind: 'block', size: 0.8, at: at(2.2, -3.4), label: 'local server', sub: 'child process', icon: 'HardDrive', tint: 'teal' },
          { id: 'remote', kind: 'block', size: 0.8, at: at(2.2, 3.4), label: 'remote server', sub: 'hosted', icon: 'Globe', tint: 'teal' },
        ],
        links: [link('host', 'local', { arrow: 'both', label: 'stdio' }), link('host', 'remote', { arrow: 'both', label: 'HTTPS', labelTone: 'warn' })],
        flows: [
          { path: ['host', 'local', 'host'], tone: 'request', label: 'JSON-RPC', duration: 1.4 },
          { path: ['host', 'remote', 'host'], tone: 'request', label: 'JSON-RPC', duration: 1.8, delay: 0.4 },
        ],
        panel: {
          title: 'Choosing a transport',
          icon: 'Table',
          rows: [
            { text: 'stdio', value: 'one user, local, no network' },
            { text: 'HTTP', value: 'shared, hosted, needs auth', tone: 'warn' },
          ],
          footer: { text: 'Both carry JSON-RPC 2.0', tone: 'muted' },
        },
        caption: 'Same words, different line',
      },
    },
    {
      title: 'On the wire',
      tag: 'concept',
      heading: 'Connect, list tools, call a tool',
      eli5: 'On arrival the foreman asks the shop, "what do you sell?" and gets a price list. Later, "use the saw, three cuts please", and the shop answers with the finished pieces.',
      body: [
        'The client sends `initialize`, then `tools/list` to **discover** the tools. The host turns those into the tool definitions the model sees (part 1).',
        'When the model calls one, the client sends `tools/call`. The result carries `content` blocks and an `isError` flag. Discovery happens at runtime, so nothing is hard-coded.',
      ],
      keyIdea: 'MCP tools are discovered with tools/list and run with tools/call, then handed to the model like any other tool.',
      metrics: { glue: '1', tools: '-', time: '40 ms', risk: 'medium' },
      scene: {
        nodes: [model, { ...runtime, label: 'host', sub: 'MCP client', status: 'active' }, { id: 'gh', kind: 'block', size: 0.8, at: at(-2.2, 3.4), label: 'GitHub', sub: 'MCP server', icon: 'Share2', tint: 'teal' }],
        links: [link('model', 'runtime', { arrow: 'both' }), link('runtime', 'gh', { arrow: 'both', label: 'JSON-RPC' })],
        flows: [
          { path: ['runtime', 'gh'], tone: 'handshake', label: 'initialize', duration: 1 },
          { path: ['runtime', 'gh', 'runtime'], tone: 'request', label: 'tools/list', duration: 1.2, delay: 1.1 },
          { path: ['model', 'runtime'], tone: 'request', label: 'tool call', duration: 1, delay: 2.5 },
          { path: ['runtime', 'gh', 'runtime'], tone: 'request', label: 'tools/call', duration: 1.2, delay: 3.6 },
        ],
        panel: {
          title: 'Methods used',
          icon: 'Code',
          code: 'initialize   agree on version\ntools/list   what can you do?\ntools/call   do this, with args',
          footer: { text: 'Added servers need no code in the agent', tone: 'good' },
        },
        caption: 'Discover, then call',
      },
      code: {
        language: 'json',
        title: 'JSON-RPC for one tool',
        source: `// client -> server: what tools exist?
{ "jsonrpc": "2.0", "id": 2, "method": "tools/list" }

// server -> client
{ "jsonrpc": "2.0", "id": 2, "result": { "tools": [
  { "name": "search_issues",
    "description": "Search issues in a repo by text. Returns up to 10.",
    "inputSchema": { "type": "object",
      "properties": { "query": { "type": "string" } },
      "required": ["query"] } } ] } }

// client -> server: run it
{ "jsonrpc": "2.0", "id": 3, "method": "tools/call",
  "params": { "name": "search_issues", "arguments": { "query": "timeout" } } }

// server -> client
{ "jsonrpc": "2.0", "id": 3, "result": {
  "content": [{ "type": "text", "text": "3 issues found" }],
  "isError": false } }`,
        highlight: [2, 5, 12, 13, 17, 18],
      },
      quiz: {
        question: 'Your agent needs a new Jira integration, and the Jira MCP server already exists. What is the least work?',
        options: [
          'Write a custom adapter for your agent framework',
          'Retrain the model on the Jira API',
          'Configure the host to connect to the server, which discovers tools with tools/list',
          'Paste the Jira docs into the system prompt',
        ],
        answer: 2,
        explain: 'MCP exists so a server is built once. The host connects, lists the tools at runtime and passes their schemas to the model. No per-agent adapter and no retraining.',
      },
    },
    {
      title: 'Legacy wrapper',
      tag: 'case',
      heading: 'Wrap an old SOAP service in a clean tool',
      eli5: 'An old machine in the corner takes a strange plug and speaks a strange language. Do not teach the carpenter. Put a small adapter box on it that takes plain slips and handles the strange parts.',
      body: [
        'Your agent must call a 15-year-old SOAP service that returns XML. Do not teach the model XML. Put an **MCP server** (or an OpenAPI-described tool) in front of it.',
        'The wrapper owns what the model cannot know: **rate limits**, normalized errors (SOAP faults become small JSON), and caching of repeated reads. The cache lives in one session and is keyed by tenant, user and customer, so one user never sees another\'s data.',
      ],
      keyIdea: 'Keep the legacy mess behind a typed, rate-limited, tenant-scoped wrapper.',
      metrics: { glue: '1', tools: '3', time: '620 ms', risk: 'low' },
      metricTones: { risk: 'good' },
      scene: {
        nodes: [
          { ...runtime, at: at(-4.4, -3), label: 'agent', sub: 'tool call, JSON' },
          { id: 'wrap', kind: 'block', at: at(0, 0.4), label: 'MCP wrapper', sub: 'typed, limited', icon: 'Plug', tint: 'teal', status: 'active', chips: ['rate limit', 'scoped cache'] },
          { id: 'legacy', kind: 'server', at: at(4.4, 3.8), label: 'legacy CRM', sub: 'SOAP / XML' },
        ],
        links: [link('runtime', 'wrap', { label: 'JSON' }), link('wrap', 'legacy', { label: 'SOAP / XML', labelTone: 'warn' })],
        flows: [
          { path: ['runtime', 'wrap'], tone: 'request', label: 'get_customer(42)', duration: 1.2 },
          { path: ['wrap', 'legacy'], tone: 'request', label: 'SOAP envelope', duration: 1.2, delay: 1.3 },
          { path: ['legacy', 'wrap', 'runtime'], tone: 'response', label: 'plain JSON', duration: 1.6, delay: 2.6 },
        ],
        panel: {
          title: 'What the wrapper does',
          icon: 'Table',
          rows: [
            { text: 'Enforce quotas', value: 'not in the prompt' },
            { text: 'Write tools behind it', value: 'carry a request key' },
            { text: 'SOAP fault', value: 'to {"error", "hint"}' },
            { text: 'Repeat reads', value: 'cache per session and user' },
          ],
        },
        caption: 'The model sees clean JSON only',
      },
      code: {
        language: 'python',
        title: 'A tool that hides the SOAP',
        source: `def get_customer(ctx, customer_id: str) -> dict:
    key = (ctx.tenant, ctx.user_id, customer_id)   # never shared across users
    if key in ctx.session.cache:                   # this session only
        return ctx.session.cache[key]
    limiter.acquire()                       # legacy quota
    try:
        xml = soap.call("GetCustomer", id=customer_id, timeout=5)
    except SoapFault as f:
        return {"error": "upstream_fault", "code": f.code,
                "hint": "retry later or escalate_to_human"}
    out = {"id": customer_id, "plan": xml.plan, "status": xml.status}
    ctx.session.cache[key] = out
    return out`,
        highlight: [2, 3, 5, 8],
      },
    },
    {
      title: 'Identity',
      tag: 'concept',
      heading: 'Run the tool as the user, not as the agent',
      eli5: 'The foreman shows the customer\'s own pass at each door. The shop lets in only what that pass allows, so a customer never sees another customer\'s table.',
      body: [
        'Agent features run in the **user\'s security context**, not a shared service account. The wrapper validates the user\'s token (audience-checked), then calls the legacy system with an exchanged, delegated credential that carries the same user, roles and tenant.',
        'Never forward the user\'s own token. The legacy service would trust a token not issued for it (the confused deputy problem). Access is enforced in the tool, never in the prompt.',
      ],
      keyIdea: 'Validate the user token, then act with a delegated credential for the same user. Never pass the token through.',
      metrics: { glue: '1', tools: '3', time: '640 ms', risk: 'low' },
      scene: {
        nodes: [
          { ...user, at: at(-4.4, -3.2), chips: ['alice, tenant 7'] },
          { ...runtime, at: at(0, -3.2), label: 'agent' },
          { id: 'wrap', kind: 'block', size: 0.8, at: at(-2.2, 3.4), label: 'MCP wrapper', sub: 'checks audience', icon: 'Key', tint: 'teal', status: 'active' },
          { id: 'legacy', kind: 'server', at: at(2.6, 3.4), label: 'legacy CRM', sub: 'ACL as before' },
        ],
        links: [link('user', 'runtime', { label: 'SSO' }), link('runtime', 'wrap', { label: 'user token' }), link('wrap', 'legacy', { label: 'delegated token' })],
        flows: [
          { path: ['user', 'runtime'], tone: 'request', label: 'my last order?', duration: 1.1 },
          { path: ['runtime', 'wrap'], tone: 'request', label: 'JWT: alice, tenant 7', duration: 1.3, delay: 1.2 },
          { path: ['wrap', 'legacy'], tone: 'request', label: 'delegated: alice, tenant 7', duration: 1.3, delay: 2.6 },
        ],
        panel: {
          title: 'Claims the delegated token carries',
          icon: 'Key',
          rows: [
            { text: 'user id', value: 'alice' },
            { text: 'roles', value: 'customer' },
            { text: 'tenant', value: '7' },
          ],
          footer: { text: 'A shared service account sees every tenant', tone: 'bad' },
        },
        caption: 'The pass goes to every door',
      },
    },
    {
      title: 'Claude Code',
      tag: 'case',
      heading: 'Case: a coding agent built on tools, MCP and hooks',
      eli5: 'A workshop where the foreman has built-in tools (hammer, saw), visits extra tool shops the owner chose, and asks the owner before doing anything risky. A rule-sheet can also run before or after a tool.',
      body: [
        'In Claude Code the runtime, not the model, owns the control points. The user configures which **MCP servers** exist, so the model only sees tools the user chose.',
        '**Hooks** run the user\'s shell commands before or after a tool, outside the model\'s decision. A permission model asks the user before risky commands run.',
      ],
      keyIdea: 'MCP config, hooks and permission asks are runtime control points the model cannot override.',
      metrics: { glue: '1', tools: '-', time: '1.8 s', risk: 'medium' },
      scene: {
        nodes: [
          { id: 'dev', kind: 'client', at: at(-4.4, -3), label: 'developer', sub: 'terminal' },
          { id: 'loop', kind: 'block', at: at(0, -3), label: 'agent loop', sub: 'runs tools', icon: 'Workflow', tint: 'violet', status: 'active' },
          { ...model, badge: 'cached: system + tools' },
          { id: 'local', kind: 'block', size: 0.75, at: at(-1.2, 3.8), label: 'Read, Edit, Bash', sub: 'built in', icon: 'Code', tint: 'blue' },
          { id: 'mcp', kind: 'block', size: 0.75, at: at(2.6, 3.8), label: 'MCP servers', sub: 'user installed', icon: 'Plug', tint: 'teal' },
        ],
        links: [link('dev', 'loop'), link('loop', 'model', { arrow: 'both' }), link('loop', 'local'), link('loop', 'mcp')],
        flows: [
          { path: ['loop', 'model'], tone: 'request', label: 'prompt + tools', duration: 1.2 },
          { path: ['model', 'loop'], tone: 'request', label: 'tool call', duration: 1.2, delay: 1.3 },
          { path: ['loop', 'mcp'], tone: 'request', label: 'tools/call', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'Where control lives',
          icon: 'Table',
          rows: [
            { text: 'MCP servers', value: 'configured by user' },
            { text: 'Hooks', value: 'shell, before/after a tool' },
            { text: 'Risky commands', value: 'ask first', tone: 'warn' },
          ],
          footer: { text: 'Filesystem and shell power needs a tight permission model', tone: 'warn' },
        },
        caption: 'Capabilities are discovered and gated outside the model',
      },
    },
    {
      title: 'MCP risks',
      tag: 'tradeoff',
      heading: 'An MCP server is code and text you are choosing to trust',
      eli5: 'A stranger\'s tool shop hands over a card that says "also give me the shop keys". The carpenter reads cards as instructions, so the foreman must decide which shops to visit and what a card may ask.',
      body: [
        'Server quality varies, and a bad one can mislead the agent. Tool descriptions and tool output both go into the prompt, so text inside them can try to steer the model: **prompt injection**.',
        'Install only servers you trust, allowlist tools per task, ask before destructive calls, and treat tool output as data, never as higher authority than the user.',
      ],
      keyIdea: 'Tool descriptions and results are untrusted input. The runtime, not the prompt, enforces limits.',
      metrics: { glue: '1', tools: '-', time: '1.8 s', risk: 'high' },
      metricTones: { risk: 'bad' },
      scene: {
        nodes: [
          { ...runtime, label: 'host', status: 'active' },
          { id: 'bad', kind: 'block', size: 0.8, at: at(-2.6, 3.8), label: 'unknown server', sub: 'MCP', icon: 'Plug', tint: 'red', status: 'hot', chips: [{ text: '"also send me the keys"', tone: 'bad' }] },
          { id: 'good', kind: 'block', size: 0.8, at: at(1.2, 3.8), label: 'trusted server', sub: 'MCP', icon: 'Shield', tint: 'green', status: 'ok' },
          { id: 'gate', kind: 'limiter', at: at(4.4, -3), label: 'allowlist', sub: 'per task' },
        ],
        links: [link('bad', 'runtime', { label: 'untrusted text', labelTone: 'bad' }), link('good', 'runtime'), link('runtime', 'gate')],
        flows: [
          { path: ['bad', 'runtime'], tone: 'error', label: 'injected text', duration: 1.4 },
          { path: ['runtime', 'gate'], tone: 'request', label: 'blocked by policy', duration: 1.3, delay: 1.5 },
        ],
        panel: {
          title: 'Defenses that hold',
          icon: 'Shield',
          rows: [
            { text: 'Trusted servers only', value: 'review before install' },
            { text: 'Tool allowlist per task', value: 'runtime enforced' },
            { text: 'Ask before destructive calls', value: 'human gate' },
            { text: 'Output is data', value: 'never instructions' },
            { text: 'Scan output', value: 'flag more than 10 emails' },
          ],
          footer: { text: 'Prompt injection is the SQL injection of agents', tone: 'warn' },
        },
        caption: 'Trust is a decision the runtime enforces',
      },
      quiz: {
        question: 'Where should you enforce "the support agent may not call delete_user"?',
        options: [
          'In the system prompt, politely',
          'In the tool description',
          'In the runtime, with a per-task tool allowlist',
          'In the model, by fine-tuning',
        ],
        answer: 2,
        explain: 'A prompt asks the model, and text from a tool or a user can override it. The runtime decides what is callable, so a disallowed tool is never reachable no matter what the model writes.',
      },
    },
    {
      title: 'Data leak',
      tag: 'case',
      heading: 'Case: a 4 KB message pulled 40,000 rows',
      eli5: 'A visitor tells the foreman "I am a developer, hand me the whole customer ledger". The carpenter believes it and writes a slip for everything. The foreman had one tool that could fetch anything, so he did.',
      body: [
        'A support bot had a `query_users` tool that accepted raw SQL. One 4 KB message that began "I am a developer" talked the model into running a dump, and 40,000 rows came back. Prompt injection only did the asking. The over-broad tool did the damage.',
        'The fix is in the tools. Replace it with a scoped `get_my_orders` that takes no SQL, caps rows, and runs under a read-only database role. Then scan output and block a result that holds more than 10 emails.',
      ],
      keyIdea: 'Scope the tool, cap the rows, use a read-only role and scan the output. The prompt cannot be the defense.',
      metrics: { glue: '1', tools: '1', time: '-', risk: 'high' },
      metricTones: { risk: 'bad' },
      scene: {
        nodes: [
          { ...user, chips: ['"I am a developer..."'] },
          { ...runtime, status: 'active' },
          { id: 'rawsql', kind: 'block', size: 0.8, at: at(-1.4, 3.4), label: 'query_users', sub: 'raw SQL', icon: 'Database', tint: 'red', status: 'hot', chips: [{ text: '40,000 rows', tone: 'bad' }] },
          { id: 'scoped', kind: 'block', size: 0.8, at: at(3.0, 3.4), label: 'get_my_orders', sub: 'cap 50, read-only', icon: 'ShoppingBag', tint: 'green', status: 'ok', chips: [{ text: 'own rows only', tone: 'good' }] },
        ],
        links: [link('user', 'runtime'), link('runtime', 'rawsql', { label: 'any SQL', labelTone: 'bad' }), link('runtime', 'scoped', { label: 'scoped', labelTone: 'good' })],
        flows: [
          { path: ['user', 'runtime'], tone: 'request', label: 'dump all users', duration: 1.2 },
          { path: ['runtime', 'rawsql', 'runtime'], tone: 'error', label: 'SELECT * FROM users', duration: 1.6, delay: 1.3 },
          { path: ['runtime', 'scoped', 'runtime'], tone: 'response', label: '20 own orders', duration: 1.4, delay: 3.1 },
        ],
        panel: {
          title: 'Defenses that would have held',
          icon: 'Shield',
          rows: [
            { text: 'Scoped tool, no raw SQL', value: 'get_my_orders', tone: 'good' },
            { text: 'Row cap', value: '50 max', tone: 'good' },
            { text: 'Read-only database role', value: 'no writes, no other tables', tone: 'good' },
            { text: 'Output scan', value: 'flag more than 10 emails', tone: 'good' },
          ],
          footer: { text: 'Tool scope is the control, the prompt is not', tone: 'warn' },
        },
        caption: 'One broad tool turned a chat message into a dump',
      },
      code: {
        language: 'python',
        title: 'A scoped tool and an output scan',
        source: `def get_my_orders(ctx, limit: int = 20):
    limit = min(limit, 50)                  # row cap
    return db_readonly.query(               # read-only role
        "SELECT id, status FROM orders WHERE user_id = %s LIMIT %s",
        ctx.user_id, limit)

def scan_output(rows):
    if count_emails(rows) > 10:             # looks like a dump
        raise Blocked("too_many_emails")`,
        highlight: [2, 3, 8],
      },
    },
    {
      title: 'Tool loop',
      tag: 'case',
      heading: 'Case: 412 tool calls and a 600 second wait',
      eli5: 'The carpenter keeps writing slips for new measurements, because every answer raises one more question. Nobody told the foreman when to stop, so he keeps fetching all afternoon.',
      body: [
        'A research agent was told "keep searching until you have enough." The model never decides it has enough: each result names a new entity, which prompts a new search. One trace showed **412 tool calls**, P99 hit 600 s and 40% of requests timed out.',
        'The hotfix was `max_iterations=10`. The full fix has four stop rules in the runtime: max iterations, max tokens, max wall-clock time and max cost, plus a force-close prompt on the last turn. Any one tripping halts the loop.',
      ],
      keyIdea: 'The runtime owns when to stop. Cap iterations, tokens, time and cost, and detect repeated tool calls.',
      metrics: { glue: '1', tools: '412', time: '600 s', risk: 'high' },
      metricTones: { tools: 'bad', time: 'bad' },
      scene: {
        nodes: [
          { ...runtime, label: 'agent', status: 'hot', load: 95, badge: 'call #412' },
          { id: 'search', kind: 'block', size: 0.8, at: at(-2.2, 3.4), label: 'search', sub: 'tool', icon: 'Search', tint: 'blue', status: 'hot' },
          { id: 'sum', kind: 'block', size: 0.8, at: at(2.2, 3.4), label: 'summarize', sub: 'tool', icon: 'FileText', tint: 'green', status: 'hot' },
        ],
        links: [link('runtime', 'search'), link('runtime', 'sum')],
        flows: [
          { path: ['runtime', 'search', 'runtime'], tone: 'request', label: 'search', duration: 1.2 },
          { path: ['runtime', 'sum', 'runtime'], tone: 'request', label: 'summarize', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Timeline, 14:22 to 14:45',
          icon: 'Clock',
          rows: [
            { text: 'P99 alarm: 600 s', value: '40% time out', tone: 'bad' },
            { text: 'Trace: search, summarize, ...', value: '412 calls', tone: 'bad' },
            { text: 'Cause: no iteration cap', value: 'found 14:35' },
            { text: 'Hotfix: max_iterations=10', value: '14:45', tone: 'good' },
            { text: 'Full fix: iterations, tokens, time, dollars', value: 'any one halts', tone: 'good' },
          ],
        },
        caption: 'Every answer raises a new question',
      },
      code: {
        language: 'python',
        title: 'Runtime stop rules for tool calls',
        source: `seen = {}
spent = 0.0
deadline = time.monotonic() + MAX_SECONDS   # wall-clock cap
for turn in range(MAX_TURNS):            # hard cap, always set
    if time.monotonic() > deadline or spent > budget_usd:
        return stop("time_or_budget")        # any one trips, loop halts
    if turn == MAX_TURNS - 1:
        history.append(user("Answer now with what you have."))
    resp = model.complete(history, tools, max_tokens=MAX_TOKENS)
    spent += resp.cost_usd
    for call in resp.tool_calls:
        sig = (call.name, json.dumps(call.input, sort_keys=True))
        seen[sig] = seen.get(sig, 0) + 1
        if seen[sig] > 2:                # same call again and again
            return stop("repeated_call", call.name)`,
        highlight: [3, 4, 5, 10, 15],
      },
    },
    {
      title: 'The gate',
      tag: 'concept',
      heading: 'Every tool call passes the same gate before it runs',
      eli5: 'Before any slip leaves the workshop, the foreman runs the same checks: is this tool on today\'s list, are the blanks filled, is it a big job that needs the owner\'s signature? Only then does he act.',
      body: [
        'Put one gate in front of every tool, local or MCP: **allowlist**, schema check, policy check, **human approval** for irreversible actions, an idempotency key on writes, then a post-check and an audit log.',
        'For a support agent: refunds under $50 run automatically, larger ones pause for approval, and no write runs until `get_account` has succeeded in this session.',
      ],
      keyIdea: 'One runtime gate, applied to every tool call, makes tool use safe to ship.',
      metrics: { glue: '1', tools: '6', time: '1.9 s', risk: 'low' },
      metricTones: { risk: 'good' },
      scene: {
        nodes: [
          { ...model, at: at(-4.4, -3) },
          { id: 'gate', kind: 'limiter', at: at(0, -3), label: 'tool gate', sub: 'runtime', status: 'active' },
          { id: 'human', kind: 'user', at: at(4.4, -3), label: 'approver', chips: ['refund $180?'] },
          { id: 'refund', kind: 'block', size: 0.8, at: at(-2, 3.8), label: 'issue_refund', sub: 'write tool', icon: 'Receipt', tint: 'green' },
        ],
        links: [link('model', 'gate'), link('gate', 'human', { label: 'over $50', labelTone: 'warn' }), link('gate', 'refund')],
        flows: [
          { path: ['model', 'gate'], tone: 'request', label: 'issue_refund $180', duration: 1.1 },
          { path: ['gate', 'human'], tone: 'event', label: 'needs approval', duration: 1.1, delay: 1.2 },
          { path: ['human', 'gate'], tone: 'response', label: 'approved', duration: 1.1, delay: 2.4 },
          { path: ['gate', 'refund'], tone: 'request', label: 'key r-9001-1', duration: 1.2, delay: 3.6 },
        ],
        panel: {
          title: 'Gate checks, in order',
          icon: 'List',
          rows: [
            { text: '1. Tool on the allowlist', value: 'per task' },
            { text: '2. Arguments match schema', value: 'reject early' },
            { text: '3. Policy and order rules', value: 'get_account first' },
            { text: '4. Human for big writes', value: '> $50' },
            { text: '5. Run with idempotency key', value: 'safe retry' },
            { text: '6. Verify and audit', value: 'did it land?' },
          ],
        },
        caption: 'One gate, every call',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Tools give models hands, and MCP gives them a shared plug',
      eli5: 'The carpenter writes slips, the foreman checks each one and uses a tool from the wall or a shop, and every shop uses the same plug. A gate at the door keeps the workshop safe.',
      body: [
        'A model requests, and the runtime validates, runs and bounds. MCP lets one server serve any host: list tools, call tools, read resources, over stdio or HTTP.',
        'Wrap legacy systems, carry user identity, treat tool text as untrusted, cap loops, and pass every call through one gate.',
      ],
      keyIdea: 'Standardize the plug with MCP, and keep every safety decision in the runtime.',
      metrics: { glue: '1', tools: '6', time: '1.9 s', risk: 'low' },
      metricTones: { glue: 'good', risk: 'good' },
      scene: {
        nodes: [
          { ...model, at: at(-4.4, -3), status: 'ok' },
          { id: 'host', kind: 'block', at: at(0, -3), label: 'host', sub: 'gate + MCP client', icon: 'Workflow', tint: 'violet', status: 'ok' },
          { id: 'srv', kind: 'block', size: 0.8, at: at(-2.2, 3.4), label: 'MCP server', sub: 'any system', icon: 'Plug', tint: 'teal', status: 'ok' },
          { id: 'legacy', kind: 'server', at: at(2.6, 3.4), label: 'system', sub: 'behind the wrapper' },
        ],
        links: [link('model', 'host', { arrow: 'both' }), link('host', 'srv', { arrow: 'both', label: 'MCP' }), link('srv', 'legacy')],
        flows: [
          { path: ['model', 'host', 'srv'], tone: 'request', label: 'tool call', duration: 1.6 },
          { path: ['srv', 'host', 'model'], tone: 'response', label: 'bounded result', duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'Keep in mind',
          icon: 'List',
          rows: [
            { text: 'MCP', value: 'build once, use anywhere' },
            { text: 'Discovery', value: 'tools/list at runtime' },
            { text: 'Identity', value: 'delegated user token' },
            { text: 'Untrusted text', value: 'descriptions and output' },
            { text: 'Stop and gate', value: 'runtime owns both' },
          ],
        },
        caption: 'One plug, one gate',
      },
      quiz: {
        question: 'Which statement about MCP is correct?',
        options: [
          'The model executes MCP servers directly',
          'A host discovers an MCP server\'s tools at runtime, and the runtime still validates and gates each call',
          'MCP replaces the need to write tool descriptions',
          'MCP servers can only run on the same machine as the host',
        ],
        answer: 1,
        explain: 'MCP standardizes discovery and calling. The host lists the tools and passes them to the model, but the runtime still validates, gates and runs each call. Servers can be local or remote, and good descriptions still matter.',
      },
    },
  ],
};
