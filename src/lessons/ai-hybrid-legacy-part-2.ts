import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const db: SceneNode = { id: 'db', kind: 'db', at: at(-4.4, -3), label: 'legacy DB', sub: 'Postgres or Oracle' };
const legacy: SceneNode = { id: 'legacy', kind: 'block', at: at(-3.6, 3.4), label: 'legacy monolith', sub: 'Rails + SQL DB', icon: 'Boxes', tint: 'gray' };
const ai: SceneNode = { id: 'ai', kind: 'block', at: at(3.6, 3.4), label: 'AI service', sub: 'GPU pool', icon: 'Cpu', tint: 'amber' };
const agent: SceneNode = { id: 'agent', kind: 'block', at: at(-4.4, -3), label: 'agent', sub: 'calls tools', icon: 'Workflow', tint: 'violet' };
const gateway: SceneNode = { id: 'gateway', kind: 'block', at: at(0, -3), label: 'AI gateway', sub: 'limits and routing', icon: 'Gauge', tint: 'violet' };
const vectors: SceneNode = { id: 'vectors', kind: 'search', at: at(4.4, -3), label: 'vector store', sub: 'embeddings' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

export const aiHybridLegacyPart2: Lesson = {
  id: 'ai-hybrid-legacy-part-2',
  title: 'Hybrid and legacy integration (part 2)',
  tagline: 'Data pipelines, service boundaries, identity, rollback, governance and cost, then two worked migrations.',
  minutes: 22,
  level: 'Advanced',
  learn: [
    'The CDC pipeline that keeps the AI index fresh, including deletes and backfills',
    'Boundary rules between a monolith and an AI service: timeouts, breakers, fallbacks, bulkheads',
    'Wrapping a SOAP or XML service so an agent can call it safely',
    'Identity, database patterns and keeping old API contracts while swapping the engine',
    'Why AI rollback is harder than code rollback, plus governance and cost containment',
    'Two worked migrations: AI in an e-commerce monolith, and classical ML to an LLM',
  ],
  metrics: [
    { key: 'fresh', label: 'Index freshness', icon: 'Clock' },
    { key: 'p95', label: 'p95 latency', icon: 'Timer' },
    { key: 'cost', label: 'Cost / request', icon: 'Receipt' },
    { key: 'risk', label: 'Risk', icon: 'Shield' },
  ],
  steps: [
    {
      title: 'Stale index',
      tag: 'problem',
      heading: 'The AI answers from data that changed last week',
      eli5: 'The helper memorized the menu on Monday. By Friday the kitchen changed three dishes and ran out of soup, but nobody told the helper, so it keeps promising soup.',
      body: [
        'The top reason RAG and AI features go stale is that nobody owns the pipeline that keeps their data fresh. Quality is a function of your data platform\'s freshness.',
        'Here a nightly dump feeds the index. A customer edits an address at 9:00 and the assistant still quotes the old one at 4:00 the next day.',
      ],
      keyIdea: 'AI quality follows data freshness. An unowned sync job quietly becomes the bug.',
      metrics: { fresh: '24 h', p95: '-', cost: '-', risk: 'high' },
      metricTones: { fresh: 'bad', risk: 'bad' },
      scene: {
        nodes: [
          { ...db, chips: [{ text: 'address edited 9:00', tone: 'good' }] },
          { ...vectors, at: at(0, 3.4), status: 'hot', chips: [{ text: 'old address', tone: 'bad' }] },
          { id: 'job', kind: 'worker', at: at(4.4, -3), label: 'nightly dump', sub: 'cron, 02:00' },
        ],
        links: [link('db', 'job', { label: 'daily export', labelTone: 'warn' }), link('job', 'vectors')],
        flows: [
          { path: ['db', 'job'], tone: 'data', label: 'full dump', duration: 1.4 },
          { path: ['job', 'vectors'], tone: 'data', label: 'yesterday\'s rows', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Where freshness leaks',
          icon: 'Clock',
          rows: [
            { text: 'Edit made in legacy', value: '09:00' },
            { text: 'Next nightly dump', value: '02:00 next day', tone: 'warn' },
            { text: 'AI quotes the old value', value: 'for 17 hours', tone: 'bad' },
          ],
        },
        caption: 'The model is fine. The data is old.',
      },
    },
    {
      title: 'CDC pipeline',
      tag: 'concept',
      heading: 'Change data capture streams every update',
      eli5: 'Instead of one big list on Sunday night, a runner carries each changed order slip to the helper the moment the kitchen writes it. The helper\'s notes stay up to date all day.',
      body: [
        '**Change data capture** reads the database log (binlog or WAL) with a tool such as Debezium, AWS DMS or Airbyte. Every insert, update and delete becomes an event on a queue.',
        'A worker chunks the text, embeds it and writes to the vector store. Use CDC, not polling: you want every update, not a daily snapshot.',
      ],
      keyIdea: 'CDC turns the database log into a stream, so the AI index follows the source row by row.',
      metrics: { fresh: '< 5 min', p95: '-', cost: '-', risk: 'medium' },
      metricTones: { fresh: 'good' },
      scene: {
        nodes: [
          db,
          { id: 'kafka', kind: 'queue', at: at(0, -3), label: 'queue', sub: 'change events' },
          { id: 'chunker', kind: 'block', at: at(4.4, -3), label: 'chunk + embed', sub: 'worker', icon: 'Cpu', tint: 'amber', load: 45 },
          { ...vectors, at: at(0, 3.4) },
        ],
        links: [link('db', 'kafka', { label: 'binlog / WAL' }), link('kafka', 'chunker'), link('chunker', 'vectors', { label: 'upsert' })],
        flows: [
          { path: ['db', 'kafka'], tone: 'event', label: 'row change', duration: 1.2 },
          { path: ['kafka', 'chunker'], tone: 'event', label: 'event', duration: 1.2, delay: 1.3 },
          { path: ['chunker', 'vectors'], tone: 'data', label: 'embedding', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'The pipeline',
          icon: 'Workflow',
          rows: [
            { text: 'Source', value: 'binlog / WAL' },
            { text: 'Transport', value: 'Debezium, queue' },
            { text: 'Transform', value: 'chunk, embed' },
            { text: 'Sink', value: 'vector store', tone: 'good' },
          ],
        },
        caption: 'Every change becomes an event',
      },
    },
    {
      title: 'CDC details',
      tag: 'tradeoff',
      heading: 'Four details teams forget in a CDC pipeline',
      eli5: 'When a dish leaves the menu the runner must also tell the helper to forget it. Otherwise the helper keeps offering a dish that no longer exists.',
      body: [
        '**Idempotent upserts** keyed by source row id make reprocessing safe. **Delete propagation** drops embeddings when the row is deleted, the step most teams forget.',
        'A **backfill path** re-embeds everything after a model or chunking change. A **freshness SLO** such as "edits visible within 5 minutes" is measured and alerted.',
      ],
      keyIdea: 'Upsert by source id, propagate deletes, plan the backfill, and put a number on freshness.',
      metrics: { fresh: '< 5 min', p95: '-', cost: '-', risk: 'medium' },
      metricTones: { fresh: 'good' },
      scene: {
        nodes: [
          { id: 'kafka', kind: 'queue', at: at(-4.4, -3), label: 'queue', sub: 'incl. deletes' },
          { id: 'chunker', kind: 'block', at: at(0, -3), label: 'sync worker', sub: 'idempotent', icon: 'Repeat', tint: 'amber' },
          { ...vectors, at: at(4.4, -3), chips: ['key = row id', { text: 'row 77 deleted', tone: 'warn' }] },
        ],
        links: [link('kafka', 'chunker'), link('chunker', 'vectors', { label: 'upsert / delete' })],
        flows: [
          { path: ['kafka', 'chunker'], tone: 'event', label: 'DELETE row 77', duration: 1.2 },
          { path: ['chunker', 'vectors'], tone: 'data', label: 'drop vectors', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Pipeline checklist',
          icon: 'List',
          rows: [
            { text: 'Upsert keyed by row id', value: 're-run is safe', tone: 'good' },
            { text: 'Delete propagation', value: 'no ghost data', tone: 'warn' },
            { text: 'Backfill path', value: 'model change', tone: 'good' },
            { text: 'Freshness SLO', value: '5 min, alerted', tone: 'good' },
          ],
          footer: { text: 'Missed deletes: "AI cites a deleted customer"', tone: 'bad' },
        },
        caption: 'A delete must reach the index too',
      },
    },
    {
      title: 'Separate service',
      tag: 'concept',
      heading: 'Run AI as its own service next to the monolith',
      eli5: 'The helper works in a separate room with its own stove and its own hours. The old kitchen sends it a ticket and does not share a stove, so a fire in one room does not burn the other.',
      body: [
        'The cleanest shape is a separate AI service called from the monolith over HTTP or a message bus. Not because microservices are better. The AI service has different runtime needs: GPUs, other scaling, other deploy cadence, maybe another language.',
        'Coupling them into one process makes both worse.',
      ],
      keyIdea: 'Give AI its own service because its runtime, scaling and release rhythm differ from the monolith\'s.',
      metrics: { fresh: '-', p95: '600 ms', cost: '-', risk: 'medium' },
      scene: {
        nodes: [
          { ...legacy, at: at(-4.4, -3), chips: ['OrderService', 'SupportService'] },
          { ...ai, at: at(4.4, -3), load: 62, chips: ['/summarize', '/classify', '/extract'] },
        ],
        links: [link('legacy', 'ai', { label: 'HTTP', route: 'straight' })],
        flows: [
          { path: ['legacy', 'ai'], tone: 'request', label: 'POST /classify', duration: 1.5 },
          { path: ['ai', 'legacy'], tone: 'response', label: '{category}', duration: 1.5, delay: 1.6 },
        ],
        panel: {
          title: 'Different runtimes',
          icon: 'Server',
          rows: [
            { text: 'Monolith', value: 'CPU, weekly deploys' },
            { text: 'AI service', value: 'GPU, daily prompt edits', tone: 'warn' },
            { text: 'Scaling', value: 'scaled apart' },
            { text: 'Failure', value: 'contained apart' },
          ],
        },
        caption: 'Two services, two lifecycles',
      },
    },
    {
      title: 'Boundary rules',
      tag: 'tradeoff',
      heading: 'Five rules at the monolith-to-AI boundary',
      eli5: 'If the helper is slow, the waiter waits only a short while, then serves the plain version. A separate group of waiters handles helper tickets so they never block regular orders.',
      body: [
        'A **timeout** shorter than the monolith\'s own. A **circuit breaker** that opens when errors pass a threshold. A **fallback** for every AI call: AI search falls back to the old Elasticsearch, an AI summary to the first 200 characters.',
        '**Retries with jitter** only on idempotent calls, and a **bulkhead**: a separate thread or connection pool so AI calls cannot starve request handlers.',
      ],
      keyIdea: 'Every AI call needs a timeout, a breaker, a non-AI fallback, safe retries and its own pool.',
      metrics: { fresh: '-', p95: '350 ms', cost: '-', risk: 'low' },
      metricTones: { risk: 'good' },
      scene: {
        nodes: [
          { ...legacy, at: at(-4.4, -3), chips: ['timeout 800 ms'] },
          { id: 'breaker', kind: 'limiter', at: at(0, -3), label: 'circuit breaker', sub: 'open at 50% errors' },
          { ...ai, at: at(4.4, -3), status: 'down', sub: 'provider outage' },
          { id: 'fallback', kind: 'search', at: at(0, 3.4), label: 'fallback', sub: 'old keyword search' },
        ],
        links: [link('legacy', 'breaker'), link('breaker', 'ai', { style: 'dashed' }), link('breaker', 'fallback', { label: 'open', labelTone: 'warn' })],
        flows: [
          { path: ['legacy', 'breaker', 'fallback', 'legacy'], tone: 'request', label: 'non-AI path', duration: 2.4 },
          { path: ['breaker', 'ai'], tone: 'error', label: 'skipped', duration: 1.2, delay: 0.4 },
        ],
        panel: {
          title: 'Non-negotiables',
          icon: 'Shield',
          rows: [
            { text: 'Timeout < monolith timeout', value: 'bounded wait' },
            { text: 'Circuit breaker', value: 'stop calling' },
            { text: 'Fallback', value: 'always a non-AI path' },
            { text: 'Retry with jitter', value: 'idempotent only' },
            { text: 'Bulkhead', value: 'own pool' },
          ],
        },
        caption: 'The monolith survives an AI outage',
      },
      quiz: {
        question: 'The LLM provider has an outage and every AI call times out. What protects the monolith?',
        options: [
          'Retry every call three times, as fast as possible',
          'A timeout shorter than the monolith\'s, a breaker, a non-AI fallback and a separate thread pool',
          'Add more GPUs to the AI service',
          'Move the AI call into the monolith process',
        ],
        answer: 1,
        explain: 'Bounded waits, a breaker, a fallback path and a bulkhead keep the failure inside the AI call. Fast retries would pile load on a provider that is already failing.',
      },
    },
    {
      title: 'Wrap legacy tools',
      tag: 'concept',
      heading: 'Reverse direction: an agent calling a SOAP service',
      eli5: 'The helper speaks plain words and the old supplier only takes a stiff paper form. A **translator desk** fills in the form, remembers repeat questions and says "slow down" when the supplier is busy.',
      body: [
        'Do not teach the LLM about XML. Wrap the legacy service in an **MCP server** or a clean OpenAPI-described tool. The agent sends typed JSON and the wrapper speaks SOAP.',
        'The wrapper owns rate limits, idempotency keys and turning SOAP faults into JSON errors the model can act on. It also caches reads such as `getCustomerProfile` per session.',
      ],
      keyIdea: 'Put quotas, dedup, error mapping and caching in the tool wrapper, never in the prompt.',
      metrics: { fresh: '-', p95: '900 ms', cost: '-', risk: 'low' },
      scene: {
        nodes: [
          { ...agent, at: at(-4.4, -3), chips: ['get_customer(42)'] },
          { id: 'wrapper', kind: 'block', at: at(0, -3), label: 'MCP wrapper', sub: 'typed, rate-limited', icon: 'Plug', tint: 'green' },
          { id: 'soap', kind: 'block', at: at(4.4, -3), label: 'SOAP service', sub: '15 years old', icon: 'FileCode', tint: 'gray' },
        ],
        links: [link('agent', 'wrapper', { label: 'JSON' }), link('wrapper', 'soap', { label: 'SOAP / XML' })],
        flows: [
          { path: ['agent', 'wrapper'], tone: 'request', label: 'tool call', duration: 1.2 },
          { path: ['wrapper', 'soap'], tone: 'request', label: 'XML envelope', duration: 1.2, delay: 1.3 },
          { path: ['soap', 'wrapper', 'agent'], tone: 'error', label: 'fault to JSON', duration: 1.8, delay: 2.6 },
        ],
        panel: {
          title: 'The wrapper owns',
          icon: 'Plug',
          rows: [
            { text: 'Rate limiting', value: 'legacy quota', tone: 'good' },
            { text: 'Idempotency', value: 'request keys', tone: 'good' },
            { text: 'Error mapping', value: 'fault to JSON', tone: 'good' },
            { text: 'Read caching', value: 'per session', tone: 'good' },
          ],
        },
        caption: 'The model never sees XML',
      },
    },
    {
      title: 'Agents and legacy',
      tag: 'tradeoff',
      heading: 'An agent that writes to a legacy system needs four guards',
      eli5: 'A new helper may use only the tools on its own belt, writes every order with a ticket number so a repeat does nothing, asks the manager before spending real money, and keeps a diary so a crashed shift can resume.',
      body: [
        '**Least-privilege tool scopes**: each agent gets only the tools and rows its task needs, with read and write split. **Idempotency keys** on every write make a retry or a replayed run safe.',
        '**Human approval** gates money and email actions. A **durable run log** records each step and its result, so a crashed or paused run resumes from the last step instead of repeating writes.',
      ],
      keyIdea: 'Scope the tools, key the writes, approve the irreversible, and log every step so runs can resume.',
      metrics: { fresh: '-', p95: '-', cost: '-', risk: 'medium' },
      metricTones: { risk: 'warn' },
      scene: {
        nodes: [
          { ...agent, at: at(-4.4, -3), chips: ['tools: read orders, draft refund'] },
          { id: 'tools', kind: 'block', at: at(0, -3), label: 'tool gateway', sub: 'scopes + idempotency', icon: 'Plug', tint: 'green' },
          { ...legacy, at: at(4.4, -3), label: 'legacy API' },
          { id: 'approve', kind: 'block', size: 0.8, at: at(-1.8, 3.6), label: 'human approval', sub: 'money, email', icon: 'Users', tint: 'blue' },
          { id: 'runlog', kind: 'db', at: at(2.6, 3.6), label: 'run log', sub: 'durable steps', tint: 'teal' },
        ],
        links: [link('agent', 'tools'), link('tools', 'legacy', { label: 'key: run-81-step-3' }), link('tools', 'approve', { label: 'refund', labelTone: 'warn' }), link('tools', 'runlog', { style: 'dashed' })],
        flows: [
          { path: ['agent', 'tools'], tone: 'request', label: 'tool call', duration: 1.2 },
          { path: ['tools', 'legacy'], tone: 'request', label: 'lookup', duration: 1.2, delay: 1.3 },
          { path: ['tools', 'approve'], tone: 'event', label: 'refund 120', duration: 1.2, delay: 2.6 },
          { path: ['tools', 'runlog'], tone: 'data', label: 'step saved', duration: 1.2, delay: 3.9 },
        ],
        panel: {
          title: 'Agent guards',
          icon: 'Shield',
          rows: [
            { text: 'Tool scopes', value: 'least privilege', tone: 'good' },
            { text: 'Idempotency keys', value: 'retry is safe', tone: 'good' },
            { text: 'Human approval', value: 'money, email', tone: 'warn' },
            { text: 'Durable run log', value: 'resume, not redo', tone: 'good' },
          ],
        },
        caption: 'The agent proposes. The gateway decides.',
      },
    },
    {
      title: 'Identity',
      tag: 'concept',
      heading: 'AI runs as the user, not as a super account',
      eli5: 'The helper carries the guest\'s own ticket into every room and each room checks it, just like the old kitchen always did. A helper with a master key would show one guest another guest\'s plate.',
      body: [
        'Forward the user\'s **JWT** (user id, roles, tenant) to the AI service and on to every tool call. Each tool enforces the ACL the way the legacy API always did.',
        'Never use a shared service account with superuser access, or retrieval will leak other users\' data. Tag every embedding with tenant and owner and filter at query time.',
      ],
      keyIdea: 'Propagate the caller\'s identity end to end, and filter the vector store by it too.',
      metrics: { fresh: '-', p95: '-', cost: '-', risk: 'low' },
      metricTones: { risk: 'good' },
      scene: {
        nodes: [
          { id: 'user', kind: 'user', at: at(-4.4, -3), label: 'customer', chips: ['tenant: acme'] },
          { ...legacy, at: at(0, -3), label: 'legacy app', sub: 'does SSO' },
          { ...ai, at: at(4.4, -3), chips: ['JWT forwarded'] },
          { ...vectors, at: at(4.4, 3.8), chips: [{ text: 'filter tenant=acme', tone: 'good' }] },
        ],
        links: [link('user', 'legacy', { label: 'SSO' }), link('legacy', 'ai', { label: 'JWT' }), link('ai', 'vectors')],
        flows: [
          { path: ['user', 'legacy'], tone: 'handshake', label: 'login', duration: 1.2 },
          { path: ['legacy', 'ai'], tone: 'request', label: 'JWT: user, role, tenant', duration: 1.3, delay: 1.3 },
          { path: ['ai', 'vectors'], tone: 'request', label: 'query + tenant', duration: 1.2, delay: 2.7 },
        ],
        panel: {
          title: 'Also decide early',
          icon: 'Key',
          rows: [
            { text: 'PII', value: 'classify, mask before call' },
            { text: 'Access', value: 'log who retrieved what' },
            { text: 'Residency', value: 'EU data stays in EU', tone: 'warn' },
          ],
          footer: { text: 'The router must know the tenant region', tone: 'muted' },
        },
        caption: 'The user\'s rights travel with the request',
      },
    },
    {
      title: 'DB patterns',
      tag: 'tradeoff',
      heading: 'Four ways to put AI data next to your database',
      eli5: 'You can keep notes in a binder on the side, write a short note on each existing card, keep a second filing cabinet fed by runners, or add a drawer to the old cabinet.',
      body: [
        'A read-only AI view (replica with embeddings), AI as a column (stored summary), a separate AI database synced by events, or an in-database vector extension such as pgvector.',
        'The default in 2026: start with **pgvector** in your existing Postgres. A dedicated vector database is worth it past about 10M vectors or for strict cross-tenant isolation.',
      ],
      keyIdea: 'Start with the vector extension in the database you already run. Split it out when scale or isolation forces it.',
      metrics: { fresh: '-', p95: '-', cost: '-', risk: 'low' },
      scene: {
        nodes: [
          { id: 'pg', kind: 'db', at: at(-3.6, -3), label: 'Postgres', sub: '+ pgvector', chips: [{ text: 'default start', tone: 'good' }] },
          { ...ai, at: at(3.6, -3), label: 'AI service' },
          { ...vectors, at: at(0, 3.8), label: 'dedicated store', sub: 'past ~10M vectors' },
        ],
        links: [link('ai', 'pg', { label: 'SQL + vector' }), link('pg', 'vectors', { style: 'dashed', label: 'CDC when it grows' })],
        flows: [
          { path: ['ai', 'pg'], tone: 'request', label: 'nearest 5', duration: 1.4 },
          { path: ['pg', 'ai'], tone: 'response', label: 'rows', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Four patterns',
          icon: 'Table',
          rows: [
            { text: 'Read-only AI view', value: 'eventually consistent' },
            { text: 'AI as a column', value: 'backfills hurt' },
            { text: 'Separate AI DB via CDC', value: 'two stores to run' },
            { text: 'In-DB vector extension', value: 'scale ceiling', tone: 'good' },
          ],
        },
        caption: 'Fewer systems until you need more',
      },
    },
    {
      title: 'Same contract',
      tag: 'concept',
      heading: 'Keep the old API, replace what is inside',
      eli5: 'The order window looks the same. Guests still hand over the same slip. Behind the window a smarter cook replaces the old stamp-and-sort routine, and nobody in the line notices.',
      body: [
        'Keep the legacy contract and swap the internals. `POST /v1/categorize_ticket` once ran if/else keyword rules. It now calls an LLM classifier behind the same endpoint.',
        'Clients do not change, apps do not redeploy, partners do not renegotiate. Real enterprise AI migrations work this way: almost nobody rewrites clients for a new AI-flavored endpoint.',
      ],
      keyIdea: 'A same-contract swap moves the engine without a single client change.',
      metrics: { fresh: '-', p95: '520 ms', cost: '$0.002', risk: 'low' },
      metricTones: { risk: 'good' },
      scene: {
        nodes: [
          { id: 'app', kind: 'phone', at: at(-4.4, -3), label: 'mobile app', sub: 'unchanged' },
          { id: 'endpoint', kind: 'block', at: at(0, -3), label: '/v1/categorize', sub: 'same contract', icon: 'FileJson', tint: 'blue' },
          { ...ai, at: at(4.4, -3), label: 'LLM classifier', sub: 'new engine' },
        ],
        links: [link('app', 'endpoint'), link('endpoint', 'ai', { label: 'new internals' })],
        flows: [
          { path: ['app', 'endpoint'], tone: 'request', label: '{ticket_text}', duration: 1.3 },
          { path: ['endpoint', 'ai'], tone: 'request', label: 'classify', duration: 1.3, delay: 1.4 },
          { path: ['ai', 'endpoint', 'app'], tone: 'response', label: '{billing, 0.92}', duration: 2, delay: 2.8 },
        ],
        panel: {
          title: 'Before and after',
          icon: 'Code',
          code: 'POST /v1/categorize_ticket\n{ "ticket_text": "..." }\n\nreturns\n{ "category": "billing",\n  "confidence": 0.92 }',
          footer: { text: 'Before: keyword rules. After: LLM.', tone: 'muted' },
        },
        caption: 'Same request, same response, new engine',
      },
    },
    {
      title: 'AI rollback',
      tag: 'tradeoff',
      heading: 'AI rollback is harder than code rollback',
      eli5: 'You can swap the helper\'s recipe card back in a minute. You cannot un-send a plate that already left the kitchen, or un-ring a bell that already woke the neighbors.',
      body: [
        'AI changes the data it touches. A bad refund cannot be un-refunded by redeploying the old prompt, and a wrong classification stored on a record stays wrong.',
        'Prompt, model and tool changes reverse with a flag. Writes to a system of record sometimes reverse. Emails, webhooks and money movement do not, so gate them with a human and idempotency keys.',
      ],
      keyIdea: 'Reversibility depends on what the AI touched. Plan compensations before the first write.',
      metrics: { fresh: '-', p95: '-', cost: '-', risk: 'medium' },
      metricTones: { risk: 'warn' },
      scene: {
        nodes: [
          { ...ai, at: at(-4.4, -3), label: 'AI change' },
          { id: 'record', kind: 'db', at: at(0, -3), label: 'system of record', sub: 'writes stick' },
          { id: 'outside', kind: 'block', at: at(4.4, -3), label: 'email, money', sub: 'cannot un-send', icon: 'Mail', tint: 'red', status: 'hot' },
        ],
        links: [link('ai', 'record', { label: 'sometimes undoable', labelTone: 'warn' }), link('record', 'outside', { style: 'dashed' })],
        flows: [
          { path: ['ai', 'record'], tone: 'request', label: 'write', duration: 1.3 },
          { path: ['record', 'outside'], tone: 'event', label: 'send', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'Is it reversible?',
          icon: 'Repeat',
          rows: [
            { text: 'Prompt change', value: 'yes, flip flag', tone: 'good' },
            { text: 'Model change', value: 'yes, route back', tone: 'good' },
            { text: 'Tool added', value: 'yes, remove', tone: 'good' },
            { text: 'Write to record', value: 'sometimes', tone: 'warn' },
            { text: 'Email, webhook, money', value: 'no', tone: 'bad' },
          ],
        },
        caption: 'The code goes back. The data does not.',
      },
    },
    {
      title: 'Rollback tools',
      tag: 'concept',
      heading: 'Four techniques that make risky writes safe',
      eli5: 'The helper writes in pencil on a spare sheet for a week. Cooks compare it with the real sheet, keep an eraser (a known undo) for every action, and let only a few tables try it first.',
      body: [
        '**Shadow writes** go to a shadow table for a week while humans review the diffs. **Dual-run comparison** computes old and new paths and cuts over when divergence is under a threshold.',
        '**Compensating transactions** give every write a known inverse, designed before shipping. A **time-bounded blast radius** enables a narrow segment for a week, then expands.',
      ],
      keyIdea: 'Shadow it, compare it, give every write an inverse, and limit who it can hurt.',
      metrics: { fresh: '-', p95: '-', cost: '-', risk: 'low' },
      metricTones: { risk: 'good' },
      scene: {
        nodes: [
          { ...ai, at: at(-4.4, -3), label: 'new path' },
          { id: 'shadow', kind: 'db', at: at(0, -3), label: 'shadow table', sub: 'diffs reviewed', tint: 'violet' },
          { id: 'real', kind: 'db', at: at(4.4, -3), label: 'real table', sub: 'after a week' },
          { id: 'audit', kind: 'block', size: 0.8, at: at(-2.4, 4.4), label: 'audit log', sub: 'enables undo', icon: 'Receipt', tint: 'teal' },
        ],
        links: [link('ai', 'shadow', { label: 'week 1' }), link('shadow', 'real', { style: 'dashed', label: 'if diffs clean' }), link('ai', 'audit', { style: 'dashed' })],
        flows: [
          { path: ['ai', 'shadow'], tone: 'data', label: 'shadow write', duration: 1.3 },
          { path: ['ai', 'audit'], tone: 'event', label: 'before/after', duration: 1.5, delay: 0.3 },
          { path: ['shadow', 'real'], tone: 'data', label: 'promote', duration: 1.3, delay: 2.2 },
        ],
        panel: {
          title: 'Rollback rails',
          icon: 'Shield',
          rows: [
            { text: 'Shadow writes', value: 'review diffs' },
            { text: 'Dual-run', value: 'cut over under threshold' },
            { text: 'Compensating txn', value: 'refund reversal' },
            { text: 'Narrow blast radius', value: 'one segment first' },
          ],
        },
        caption: 'Design the undo before the write',
      },
      quiz: {
        question: 'An AI agent refunds the wrong order. Redeploying the previous prompt does not return the money. What should have existed before shipping?',
        options: [
          'A longer prompt',
          'A compensating transaction (a known inverse) and an audit log of what was written',
          'A bigger model',
          'A faster rollback of the container image',
        ],
        answer: 1,
        explain: 'Code and prompts roll back, but written data stays. A designed inverse such as a refund reversal, plus an audit trail, is what lets you repair the damage.',
      },
    },
    {
      title: 'Governance',
      tag: 'concept',
      heading: 'A paper trail for every AI decision',
      eli5: 'The restaurant keeps a notebook: which cook, which recipe version, which ingredients and why the plate was served. When an inspector asks, there is an answer, and a guest can have their entry erased.',
      body: [
        'Log every LLM call: model, prompt version, input (hashed or redacted), output, tokens, cost, user, tenant and trace id. Version prompts like code. Store a **decision record** for anything that affected a user.',
        'GDPR Article 22 and the EU AI Act need a plain-language explanation. Erasure must reach embeddings. Keep model cards and access logs on the vector store.',
      ],
      keyIdea: 'If you cannot show which prompt version, context and model made a decision, you cannot defend it.',
      metrics: { fresh: '-', p95: '-', cost: '-', risk: 'low' },
      metricTones: { risk: 'good' },
      scene: {
        nodes: [
          { ...ai, at: at(-4.4, -3), label: 'AI decision' },
          { id: 'ledger', kind: 'block', at: at(0, -3), label: 'decision record', sub: 'audit store', icon: 'Receipt', tint: 'teal' },
          { id: 'siem', kind: 'monitor', at: at(4.4, -3), label: 'compliance', sub: 'SIEM, regulators' },
        ],
        links: [link('ai', 'ledger', { label: 'every call' }), link('ledger', 'siem')],
        flows: [
          { path: ['ai', 'ledger'], tone: 'event', label: 'record', duration: 1.3 },
          { path: ['ledger', 'siem'], tone: 'data', label: 'logs', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'Decision record fields',
          icon: 'List',
          rows: [
            { text: 'Inputs and retrieved context', value: 'hashed if sensitive' },
            { text: 'Model and prompt version', value: 'v14, model B' },
            { text: 'Output and explanation', value: 'plain language' },
            { text: 'Erasure', value: 'embeddings too', tone: 'warn' },
          ],
        },
        caption: 'Prompts are code. Version them.',
      },
    },
    {
      title: 'Cost control',
      tag: 'concept',
      heading: 'Stop cost at the gateway, not on the bill',
      eli5: 'The restaurant gives each table a spending limit and a rule: easy orders go to the junior cook, hard ones to the head chef. One switch pauses all fancy extras if the night goes wrong.',
      body: [
        'Per-team, per-tenant and per-feature **budgets** are hard caps enforced at the gateway. A runaway loop must die there. **Tiered routing** sends easy queries to a small model, typical ones to a mid model and hard ones to a frontier model, which can cut cost 5 to 10 times.',
        'Prompt and semantic caches save 30 to 70% on some workloads. Batch APIs give around 50% off with a 24 hour wait. Keep one global kill switch.',
      ],
      keyIdea: 'Enforce limits and routing centrally. Alerts tell you about the bill, caps prevent it.',
      metrics: { fresh: '-', p95: '-', cost: '$0.004', risk: 'low' },
      metricTones: { cost: 'good' },
      scene: {
        nodes: [
          { id: 'app', kind: 'client', at: at(-4.4, -3), label: 'callers' },
          { ...gateway, at: at(0, -3), status: 'active', chips: ['tenant daily $ cap', 'tokens/min limit'] },
          { id: 'small', kind: 'block', size: 0.8, at: at(-1.8, 3.6), label: 'small model', sub: 'easy', icon: 'Cpu', tint: 'green' },
          { id: 'big', kind: 'block', size: 0.8, at: at(2.6, 3.6), label: 'frontier model', sub: 'hard', icon: 'Cpu', tint: 'amber', load: 70 },
        ],
        links: [link('app', 'gateway'), link('gateway', 'small'), link('gateway', 'big')],
        flows: [
          { path: ['app', 'gateway'], tone: 'request', label: 'request', duration: 1.2 },
          { path: ['gateway', 'small'], tone: 'request', label: '80% easy', duration: 1.3, delay: 1.3 },
          { path: ['gateway', 'big'], tone: 'request', label: '20% hard', duration: 1.3, delay: 2.7 },
        ],
        panel: {
          title: 'Levers',
          icon: 'Gauge',
          rows: [
            { text: 'Hard budgets', value: 'per team, tenant' },
            { text: 'Tiered routing', value: '5 to 10x cheaper', tone: 'good' },
            { text: 'Prompt, semantic cache', value: '30 to 70% saved', tone: 'good' },
            { text: 'Batch APIs', value: '~50% off, 24 h' },
            { text: 'Kill switch', value: 'one flag', tone: 'good' },
          ],
        },
        caption: 'One place to say no',
      },
    },
    {
      title: 'E-commerce case',
      tag: 'case',
      heading: 'Case: AI in a 10-year-old retail monolith in 12 months',
      eli5: 'A big shop with an old stockroom wants a smart helper in a year. The team starts with a note on the till, then lets the helper draft, then guard-rails for refunds, then trickier jobs.',
      body: [
        'A Rails monolith on MySQL, 2M SKUs, 50M customers, 400 engineers, a team of 6. Phase 0 inventories ideas by impact, data, reversibility and risk, then picks two: product search and ticket drafts.',
        'Phases then add write-side guardrails, strangler expansion and agents. Nothing required the monolith to change: every capability was a sidecar, a flag or a same-contract swap.',
      ],
      keyIdea: 'Sequence by risk. Start read-only, add humans on writes, add agents last, and never touch the monolith.',
      metrics: { fresh: '5 min', p95: '300 ms', cost: '$0.003', risk: 'low' },
      metricTones: { fresh: 'good', risk: 'good' },
      scene: {
        nodes: [
          { ...legacy, at: at(-4.4, -3), label: 'Rails monolith', sub: 'unchanged' },
          { ...ai, at: at(0, -3), label: 'AI service', sub: 'new', chips: ['/search', '/ticket_categorize'] },
          { ...vectors, at: at(4.4, -3), sub: 'pgvector via CDC' },
        ],
        links: [link('legacy', 'ai', { label: 'flag-gated, 1%' }), link('ai', 'vectors')],
        flows: [
          { path: ['legacy', 'ai'], tone: 'request', label: '/search', duration: 1.3 },
          { path: ['ai', 'vectors'], tone: 'request', label: 'query', duration: 1.2, delay: 1.4 },
          { path: ['vectors', 'ai', 'legacy'], tone: 'response', label: 'results', duration: 1.8, delay: 2.7 },
        ],
        panel: {
          title: 'Phases',
          icon: 'Route',
          rows: [
            { text: '0: inventory (wk 1-2)', value: 'pick 2 ideas' },
            { text: '1: read-only (mo 1-2)', value: 'search, tickets, shadow' },
            { text: '2: guarded writes (mo 3-5)', value: 'HITL, refunds < $20' },
            { text: '3: strangler (mo 6-9)', value: 'facade, 5 min freshness' },
            { text: '4: agents (mo 9-12)', value: 'returns, durable runs' },
          ],
        },
        caption: 'Nothing here required changing the monolith',
      },
    },
    {
      title: 'ML to LLM',
      tag: 'case',
      heading: 'Case: replace a classical model, keep its eval harness',
      eli5: 'A sorting machine that once worked has started misfiling mail. Before swapping in a clever new sorter, keep the old answer sheet and test both on the same pile.',
      body: [
        'An insurer routes claim emails with a gradient-boosted model. F1 was 0.87 in 2020, concept drift has pulled it to 0.74. The team wants an LLM classifier.',
        'Step one: preserve the eval harness. It is worth more than the model. Wire the LLM behind the same interface and score both side by side on the golden set.',
      ],
      keyIdea: 'The inherited eval harness is the load-bearing piece. Teams that kept it shipped in weeks.',
      metrics: { fresh: '-', p95: '-', cost: '-', risk: 'low' },
      metricTones: { risk: 'good' },
      scene: {
        nodes: [
          { id: 'harness', kind: 'block', at: at(0, -3), label: 'eval harness', sub: 'inputs to labels', icon: 'Table', tint: 'violet' },
          { id: 'gbdt', kind: 'block', at: at(-3.6, 3.4), label: 'old GBDT', sub: 'F1 0.74', icon: 'TrendingUp', tint: 'gray', chips: [{ text: 'drifted', tone: 'warn' }] },
          { id: 'llm', kind: 'block', at: at(3.6, 3.4), label: 'new LLM', sub: 'same interface', icon: 'Cpu', tint: 'amber' },
        ],
        links: [link('harness', 'gbdt'), link('harness', 'llm')],
        flows: [
          { path: ['harness', 'gbdt', 'harness'], tone: 'request', label: 'golden set', duration: 2 },
          { path: ['harness', 'llm', 'harness'], tone: 'request', label: 'golden set', duration: 2, delay: 0.3 },
        ],
        panel: {
          title: 'Side by side',
          icon: 'Table',
          rows: [
            { text: 'GBDT F1 (2020)', value: '0.87' },
            { text: 'GBDT F1 (now)', value: '0.74', tone: 'bad' },
            { text: 'LLM F1 (golden set)', value: 'scored here', tone: 'good' },
          ],
          footer: { text: 'Same inputs, same labels, same metrics', tone: 'muted' },
        },
        caption: 'One scoring pipeline for both models',
      },
    },
    {
      title: 'Cutover',
      tag: 'case',
      heading: 'Shadow, grow the eval set, then gate the cutover',
      eli5: 'Both sorters work the real mail for a while, only the old one counts. Where they disagree, a person checks the letter, and those checked letters become new practice questions for both.',
      body: [
        'The LLM shadows 100% of live traffic, logged but unused. Disagreements are the best new labels: human-label them and grow the eval set by 30 to 50%, then rescore both.',
        'Cut over at 1%, 10%, 50% and 100% over 4 to 8 weeks, with auto-rollback on an F1 drop. Keep the old model hot for 90 days, and run the eval nightly because providers update models.',
      ],
      keyIdea: 'Disagreements feed the eval set, the eval set gates the cutover, and the old model stays as a fallback.',
      metrics: { fresh: '-', p95: '-', cost: '$0.003', risk: 'low' },
      metricTones: { risk: 'good' },
      scene: {
        nodes: [
          { id: 'mail', kind: 'client', at: at(-4.4, -3), label: 'claim emails' },
          { id: 'router', kind: 'block', at: at(0, -3), label: 'router', sub: '10% to LLM', icon: 'Split', tint: 'violet' },
          { id: 'gbdt', kind: 'block', size: 0.8, at: at(-1.8, 3.6), label: 'old GBDT', sub: 'hot standby', icon: 'TrendingUp', tint: 'gray' },
          { id: 'llm', kind: 'block', size: 0.8, at: at(2.6, 3.6), label: 'new LLM', sub: 'canary', icon: 'Cpu', tint: 'amber' },
        ],
        links: [link('mail', 'router'), link('router', 'gbdt'), link('router', 'llm')],
        flows: [
          { path: ['mail', 'router'], tone: 'request', label: 'email', duration: 1.2 },
          { path: ['router', 'gbdt'], tone: 'request', label: '90%', duration: 1.3, delay: 1.3 },
          { path: ['router', 'llm'], tone: 'request', label: '10%', duration: 1.3, delay: 2.7 },
        ],
        panel: {
          title: 'Cutover plan',
          icon: 'TrendingUp',
          rows: [
            { text: 'Shadow on 100% traffic', value: 'log only' },
            { text: 'Label disagreements', value: 'eval set +30-50%' },
            { text: '1%, 10%, 50%, 100%', value: '4 to 8 weeks' },
            { text: 'Old model hot standby', value: '90 days', tone: 'good' },
            { text: 'Nightly eval on prod', value: 'catch drift', tone: 'good' },
          ],
        },
        caption: 'Evidence at each step, an exit at each step',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Recap: AI is another subsystem to integrate and govern',
      eli5: 'The old restaurant stays open. The helper gets fresh news from the kitchen, works in its own room, carries each guest\'s ticket, keeps a notebook and has a spending limit. Every step has an undo.',
      body: [
        'Keep the index fresh with CDC, deletes included. Isolate AI behind timeouts, breakers and fallbacks. Propagate user identity, keep old contracts, and design compensations before writes.',
        'Log and version everything, cap cost at the gateway, and keep the eval harness. These patterns are older than LLMs. AI made them mandatory.',
      ],
      keyIdea: 'Integrate, govern, evaluate and roll back AI the same way you handle any other subsystem.',
      metrics: { fresh: '< 5 min', p95: '300 ms', cost: '$0.003', risk: 'low' },
      metricTones: { fresh: 'good', risk: 'good' },
      scene: {
        nodes: [
          { ...legacy, at: at(-4.4, -3) },
          { ...gateway, at: at(0, -3), sub: 'budgets and routing' },
          { ...ai, at: at(4.4, -3) },
          { id: 'trail', kind: 'monitor', at: at(0, 3.8), label: 'audit + evals', sub: 'logged, scored' },
        ],
        links: [link('legacy', 'gateway', { label: 'timeout + breaker' }), link('gateway', 'ai'), link('gateway', 'trail', { style: 'dashed' })],
        flows: [
          { path: ['legacy', 'gateway', 'ai'], tone: 'request', label: 'AI call', duration: 2 },
          { path: ['gateway', 'trail'], tone: 'event', label: 'record', duration: 1.3, delay: 1 },
        ],
        panel: {
          title: 'Part 2 toolbox',
          icon: 'Shield',
          rows: [
            { text: 'CDC with deletes', value: 'fresh', tone: 'good' },
            { text: 'Boundary rules', value: 'contained', tone: 'good' },
            { text: 'Identity and ACLs', value: 'user-scoped', tone: 'good' },
            { text: 'Audit and budgets', value: 'governed', tone: 'good' },
            { text: 'Eval harness', value: 'measured', tone: 'good' },
          ],
        },
        caption: 'Older patterns, now mandatory',
      },
      quiz: {
        question: 'A user deletes their account. Which step keeps the assistant from citing their data afterward?',
        options: [
          'Restarting the AI service',
          'Delete propagation: the CDC pipeline removes their embeddings from the vector store, and it is tested',
          'A longer system prompt saying to forget them',
          'Moving to a bigger model',
        ],
        answer: 1,
        explain: 'Deleted source rows leave stale vectors behind unless the pipeline propagates deletes. A prompt cannot make a model forget data that retrieval keeps returning.',
      },
    },
  ],
};
