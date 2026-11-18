import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const user: SceneNode = { id: 'user', kind: 'user', at: at(-4.4, -3), label: 'customer' };
const facade: SceneNode = { id: 'facade', kind: 'block', at: at(0, -3), label: 'routing facade', sub: 'the front door', icon: 'Split', tint: 'violet' };
const legacy: SceneNode = { id: 'legacy', kind: 'block', at: at(-2.2, 3.4), label: 'legacy monolith', sub: 'Rails + SQL DB', icon: 'Boxes', tint: 'gray' };
const ai: SceneNode = { id: 'ai', kind: 'block', at: at(2.2, 3.4), label: 'AI service', sub: 'model + prompts', icon: 'Cpu', tint: 'amber' };
const acl: SceneNode = { id: 'acl', kind: 'block', at: at(0, -3), label: 'ACL', sub: 'validate and bound', icon: 'Shield', tint: 'green' };
const monitor: SceneNode = { id: 'monitor', kind: 'monitor', at: at(4.4, -3), label: 'metrics', sub: 'regression watch' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

export const aiHybridLegacy: Lesson = {
  id: 'ai-hybrid-legacy',
  title: 'Hybrid and legacy integration (part 1)',
  tagline: 'How to add AI to a system you already run, without breaking it: routing, translation layers, adapters and safe rollout.',
  minutes: 20,
  level: 'Advanced',
  learn: [
    'Why integration, not model quality, is the hard part of enterprise AI',
    'The strangler fig pattern and routing rules that make an AI launch reversible',
    'The anti-corruption layer: schema, business rule and sanity checks on every model output',
    'Four adapters: sidecar, async enrichment, LLM as middleware and shadow mode',
    'Phased rollout with feature flags, and how to A/B test with no ground truth',
  ],
  metrics: [
    { key: 'share', label: 'AI traffic', icon: 'Split' },
    { key: 'p95', label: 'p95 latency', icon: 'Timer' },
    { key: 'rollback', label: 'Rollback', icon: 'Repeat' },
    { key: 'risk', label: 'Blast radius', icon: 'Shield' },
  ],
  steps: [
    {
      title: 'Hard part',
      tag: 'problem',
      heading: 'The demo works. Production does not.',
      eli5: 'A new helper cooks one dish perfectly in a quiet test kitchen. In the busy **real kitchen** nobody told the helper where the pans live, so dinner goes wrong.',
      body: [
        'A 2025 MIT NANDA study found roughly **95%** of enterprise GenAI pilots had no measurable P&L impact. The cause is rarely the model. It is stale data, missing audit trails, unchecked outputs and no cost control.',
        'Your company has a 10-year-old monolith, a database nobody dares touch and a compliance team. The job is to make that system smarter without breaking it.',
      ],
      keyIdea: 'Model quality stopped being the bottleneck. Integration, governance and operations decide whether AI ships.',
      metrics: { share: '0%', p95: '-', rollback: '?', risk: 'unknown' },
      metricTones: { risk: 'bad' },
      scene: {
        nodes: [
          { ...user, chips: ['"where is my refund?"'] },
          { ...ai, at: at(0, -3), label: 'AI pilot', status: 'active', badge: 'demo: 95% right' },
          { ...legacy, at: at(4.4, -3), status: 'hot', chips: [{ text: 'quirks unseen in eval', tone: 'warn' }] },
        ],
        links: [link('user', 'ai'), link('ai', 'legacy')],
        flows: [
          { path: ['user', 'ai'], tone: 'request', label: 'question', duration: 1.2 },
          { path: ['ai', 'legacy'], tone: 'request', label: 'guessed args', duration: 1.2, delay: 1.3 },
          { path: ['legacy', 'ai'], tone: 'error', label: 'schema error', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'What people say vs the cause',
          icon: 'Table',
          rows: [
            { text: 'Answers are wrong', value: 'stale index', tone: 'warn' },
            { text: 'Invents customer data', value: 'no validation', tone: 'warn' },
            { text: 'Users do not trust it', value: 'no audit trail', tone: 'warn' },
            { text: 'Too expensive', value: 'no budget', tone: 'warn' },
            { text: 'Legal said no', value: 'no PII boundary', tone: 'bad' },
            { text: 'Fails in prod only', value: 'legacy quirks', tone: 'bad' },
          ],
        },
        caption: 'The model is rarely the problem',
      },
    },
    {
      title: 'Two worlds',
      tag: 'concept',
      heading: 'A probabilistic model meets a deterministic system',
      eli5: 'The old kitchen follows the recipe card exactly, every time. The new **helper** is creative and sometimes writes a dish name that sounds right but is not on the menu.',
      body: [
        'Legacy systems are deterministic: same input, same rows, a ledger that balances or does not. An LLM can give different output for the same input.',
        'Its output can look valid and be wrong, such as a well-formed refund for a real customer ID that belongs to someone else. The billing API accepts it. A prompt cannot patch that away.',
        'So every bridge between the two worlds must **validate, bound and audit**. Model output never lands straight in a system of record.',
      ],
      keyIdea: 'Never let model output land directly in a system of record. Every bridge validates, bounds and audits.',
      metrics: { share: '0%', p95: '-', rollback: '?', risk: 'high' },
      metricTones: { risk: 'bad' },
      scene: {
        nodes: [
          { ...ai, at: at(-3.6, 0), label: 'LLM', sub: 'probabilistic', chips: ['same input, new output'] },
          { ...legacy, at: at(3.6, 0), label: 'billing API', sub: 'deterministic', chips: ['strict schema'] },
        ],
        links: [link('ai', 'legacy', { label: 'valid JSON, wrong customer', labelTone: 'warn', route: 'straight' })],
        flows: [
          { path: ['ai', 'legacy'], tone: 'request', label: '{"customer":"C-1042"} (not theirs)', duration: 1.6 },
          { path: ['legacy', 'ai'], tone: 'error', label: '200 OK, wrong account refunded', duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'The two worlds',
          icon: 'Scale',
          rows: [
            { text: 'AI: probabilistic', value: 'best effort' },
            { text: 'AI: natural language', value: 'rich context' },
            { text: 'Legacy: deterministic', value: 'all or nothing' },
            { text: 'Legacy: rigid schemas', value: 'stable for decades' },
          ],
          footer: { text: 'A bridge between them must check everything', tone: 'warn' },
        },
        caption: 'Accepted and wrong is worse than rejected',
      },
    },
    {
      title: 'Strangler fig',
      tag: 'concept',
      heading: 'Strangler fig: put a door in front, move traffic gradually',
      eli5: 'A **host** stands at the door. Most guests still go to the old kitchen. A few new dishes go to the helper. If the helper spills the soup, the host sends everyone back to the old kitchen at once.',
      body: [
        'Place a **routing facade** in front of the monolith. Requests that benefit from AI go to a new service. Everything else passes through to legacy unchanged. Over time the new service takes over, like the fig tree around its host.',
        'For AI the gain is **reversibility**. If the AI route misbehaves, flip the routing rule and traffic returns to the legacy path. No deploy and no data migration.',
      ],
      keyIdea: 'A routing facade makes an AI launch reversible: flip a rule and traffic returns to legacy.',
      metrics: { share: '10%', p95: '420 ms', rollback: 'one rule', risk: 'low' },
      metricTones: { rollback: 'good', risk: 'good' },
      scene: {
        nodes: [user, { ...facade, status: 'active' }, legacy, ai],
        links: [link('user', 'facade'), link('facade', 'legacy'), link('facade', 'ai')],
        flows: [
          { path: ['user', 'facade', 'legacy'], tone: 'request', label: '90%: pass through', duration: 1.8 },
          { path: ['user', 'facade', 'ai'], tone: 'request', label: '10%: AI', duration: 1.8, delay: 1.9 },
        ],
        panel: {
          title: 'Before, during, after',
          icon: 'Route',
          rows: [
            { text: 'Before', value: 'monolith does all' },
            { text: 'During', value: 'facade splits traffic', tone: 'good' },
            { text: 'After', value: 'AI service owns the path' },
          ],
          footer: { text: 'Undo = change one routing rule', tone: 'good' },
        },
        caption: 'The new service strangles the old one, slowly',
      },
    },
    {
      title: 'Routing rules',
      tag: 'concept',
      heading: 'Four ways to decide who gets the AI path',
      eli5: 'The host can pick by who is asking, by which dish they want, by whether they are a friend of the house, or by just sending one family in a hundred to the helper.',
      body: [
        'Rules can be scoped by **tenant** (enterprise X stays on legacy, Y gets AI), by **endpoint** (only `/summarize` is AI), by **user** (internal beta users first) or by **traffic share** (1% to AI, 99% to legacy, then compare).',
        'Combine them. Start with internal users on one endpoint, then widen the share.',
      ],
      keyIdea: 'Scope the AI path by tenant, endpoint, user or traffic share, and combine the scopes to widen slowly.',
      metrics: { share: '1%', p95: '410 ms', rollback: 'one rule', risk: 'low' },
      metricTones: { rollback: 'good', risk: 'good' },
      scene: {
        nodes: [
          {
            ...facade,
            at: at(0, -3),
            status: 'active',
            chips: ['tenant: acme to legacy', 'GET /summarize to AI', 'beta users to AI', { text: '1% of traffic to AI', tone: 'good' }],
          },
          legacy,
          ai,
        ],
        links: [link('facade', 'legacy'), link('facade', 'ai')],
        flows: [
          { path: ['facade', 'legacy'], tone: 'request', label: 'tenant: acme', duration: 1.4 },
          { path: ['facade', 'ai'], tone: 'request', label: '/summarize', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Routing rule kinds',
          icon: 'List',
          rows: [
            { text: 'Tenant-scoped', value: 'acme legacy, beta AI' },
            { text: 'Endpoint-scoped', value: '/summarize only' },
            { text: 'User-scoped', value: 'internal beta' },
            { text: 'Traffic-scoped', value: '1% AI, compare' },
          ],
        },
        caption: 'Rules you can change without a deploy',
      },
    },
    {
      title: 'ACL',
      tag: 'concept',
      heading: 'The anti-corruption layer keeps both sides clean',
      eli5: 'A **head chef** stands between the helper and the old kitchen. The helper hands over a messy note. The chef rewrites it as a proper order slip and checks the numbers before the kitchen sees it.',
      body: [
        'An **anti-corruption layer** (ACL) is a translation layer from domain-driven design. The AI side does not leak into the legacy schema, and legacy cruft does not leak into prompts.',
        'At minimum it does five jobs: schema validation, business rule checks, sanity bounds, PII redaction and an audit record for every call.',
      ],
      keyIdea: 'The ACL turns model text into a strict typed request and checks it, so legacy only ever sees valid input.',
      metrics: { share: '10%', p95: '440 ms', rollback: 'one rule', risk: 'low' },
      metricTones: { risk: 'good' },
      scene: {
        nodes: [{ ...ai, at: at(-4.4, -3), label: 'AI service' }, { ...acl, status: 'active' }, { ...legacy, at: at(4.4, -3), label: 'legacy API', sub: 'typed input only' }],
        links: [link('ai', 'acl', { label: 'intent text' }), link('acl', 'legacy', { label: 'typed DTO' })],
        flows: [
          { path: ['ai', 'acl'], tone: 'request', label: 'NL intent', duration: 1.2 },
          { path: ['acl', 'legacy'], tone: 'request', label: 'typed DTO', duration: 1.2, delay: 1.3 },
          { path: ['legacy', 'acl', 'ai'], tone: 'response', label: 'summary text', duration: 1.8, delay: 2.6 },
        ],
        panel: {
          title: 'Every ACL enforces',
          icon: 'Shield',
          rows: [
            { text: 'Schema validation', value: 'parse or fail', tone: 'good' },
            { text: 'Business rules', value: 'refund <= total', tone: 'good' },
            { text: 'Sanity bounds', value: 'qty 10,000? reject', tone: 'good' },
            { text: 'PII redaction', value: 'mask, then re-hydrate', tone: 'good' },
            { text: 'Audit record', value: 'every call', tone: 'good' },
          ],
        },
        caption: 'Validate, sanitize, redact, bound',
      },
    },
    {
      title: 'ACL in code',
      tag: 'concept',
      heading: 'An ACL for a refund, in a few lines',
      eli5: 'The chef checks the order slip: right table, right bill, not more money than the bill. A big amount goes to the **manager** for a signature before it counts.',
      body: [
        'The model proposes a refund as JSON. The ACL parses it into a strict type, so a parse failure is a first-class error. Then it rechecks rules the prompt already stated.',
        'The order id must match, the amount cannot exceed the order total, and an amount above the user\'s authority goes to a human queue instead of the billing API.',
      ],
      keyIdea: 'Check the rule again in code, even when the prompt states it. Prompts persuade, code enforces.',
      metrics: { share: '10%', p95: '460 ms', rollback: 'one rule', risk: 'low' },
      scene: {
        nodes: [
          { ...ai, at: at(-4.4, -3), label: 'AI service' },
          { ...acl, status: 'active' },
          { ...legacy, at: at(4.4, -3), label: 'billing API' },
          { id: 'hitl', kind: 'block', size: 0.8, at: at(0, 3.4), label: 'human queue', sub: 'above authority', icon: 'Users', tint: 'blue' },
        ],
        links: [link('ai', 'acl'), link('acl', 'legacy', { label: 'refund <= authority' }), link('acl', 'hitl', { label: 'over limit', labelTone: 'warn' })],
        flows: [
          { path: ['ai', 'acl'], tone: 'request', label: 'refund JSON', duration: 1.2 },
          { path: ['acl', 'legacy'], tone: 'request', label: 'refund 18.50', duration: 1.2, delay: 1.3 },
          { path: ['acl', 'hitl'], tone: 'event', label: 'refund 900', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'Checks, in order',
          icon: 'List',
          rows: [
            { text: '1. Parse into RefundDecision', value: 'fail = error' },
            { text: '2. order_id matches', value: 'else reject' },
            { text: '3. amount <= order total', value: 'else reject' },
            { text: '4. amount <= user authority', value: 'else human' },
            { text: '5. audit.log, then call API', value: 'always' },
          ],
        },
        caption: 'Prompt says it, code enforces it',
      },
      code: {
        language: 'python',
        title: 'acl_issue_refund (sketch)',
        source: `class RefundDecision(BaseModel):
    order_id: str = Field(pattern=r"^ORD-\\d{8}$")
    amount_cents: int = Field(ge=0, le=5_000_000)
    reason_code: Literal["defective", "wrong_item", "not_received", "other"]

def acl_issue_refund(llm_output: str, order, user):
    d = RefundDecision.model_validate_json(llm_output)   # strict parse
    if d.order_id != order.id:
        raise ACLViolation("order id mismatch")
    if d.amount_cents > order.total_cents:
        raise ACLViolation("refund exceeds order total")
    if d.amount_cents > user.refund_authority_cents:
        return hitl_queue.enqueue(d, user)               # a human decides
    audit.log("refund_decision", user, d)
    return legacy_billing_api.refund(**d.model_dump())`,
        highlight: [7, 8, 9, 10, 11, 12, 14],
      },
      quiz: {
        question: 'The prompt already tells the model never to refund more than the order total. Why does the ACL check it again?',
        options: [
          'To make the call slower and safer',
          'A prompt only asks the model. Code is the only thing that guarantees the rule holds',
          'Because the legacy API cannot read prompts',
          'The check is redundant and can be dropped',
        ],
        answer: 1,
        explain: 'Model output is probabilistic, so it can break any rule in the prompt. A code check in the ACL is deterministic and cannot be talked out of it.',
      },
    },
    {
      title: 'Sidecar',
      tag: 'concept',
      heading: 'Adapter 1: a sidecar that adds fields',
      eli5: 'The old kitchen cooks and serves as always. A **helper** stands nearby and sticks a short note on each plate. If the helper is busy, the plate still goes out without the note.',
      body: [
        'In **sidecar inference** the legacy service runs untouched. The AI reads a copy of its input and output and returns a summary, a classification or a suggestion to a small response merger, which adds it as extra fields.',
        'The sidecar call is async with a short timeout (say 300 ms). If the field is late or the AI fails, the merger sends the base response without it. This is the lowest-risk pattern and the first one to try.',
      ],
      keyIdea: 'A sidecar adds AI fields next to an untouched response, so an AI failure costs a nice-to-have, not the request.',
      metrics: { share: '100% enriched', p95: '+0 ms (async)', rollback: 'drop sidecar', risk: 'lowest' },
      metricTones: { risk: 'good', rollback: 'good', p95: 'good' },
      scene: {
        nodes: [user, { ...legacy, at: at(0, -3), label: 'legacy service', sub: 'untouched', status: 'ok' }, { id: 'merger', kind: 'block', at: at(4.4, -3), label: 'response merger', sub: 'adds field if ready', icon: 'Split', tint: 'green' }, { ...ai, at: at(2.2, 3.4), label: 'AI sidecar', sub: 'async, 300 ms cap' }],
        links: [link('user', 'legacy'), link('legacy', 'merger'), link('legacy', 'ai', { style: 'dashed', label: 'copy of output' }), link('ai', 'merger', { style: 'dashed', label: 'async' })],
        flows: [
          { path: ['user', 'legacy'], tone: 'request', label: 'request', duration: 1.2 },
          { path: ['legacy', 'merger'], tone: 'response', label: 'base response', duration: 1.2, delay: 1.3 },
          { path: ['legacy', 'ai'], tone: 'event', label: 'copy', duration: 1.2, delay: 1.3 },
          { path: ['ai', 'merger'], tone: 'data', label: 'summary field', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'Enriched response',
          icon: 'FileJson',
          code: '{\n  "order": 9001,\n  "status": "shipped",\n  "ai_summary": "Late by 2 days"\n}',
          footer: { text: 'If ai_summary is late or missing, nothing breaks', tone: 'good' },
        },
        caption: 'Same response shape, extra fields',
      },
    },
    {
      title: 'Async enrichment',
      tag: 'concept',
      heading: 'Adapter 2: an async enrichment queue',
      eli5: 'Instead of making guests wait, the kitchen drops a copy of each order slip in a **basket**. The helper works through the basket at its own pace and files notes in a folder. The waiter reads the folder later.',
      body: [
        'Events flow out of the legacy database through change data capture into a queue. **AI workers** process them at their own pace and write results to a separate enrichment table. That table is joined back at read time.',
        'Bursts queue up instead of failing, and AI latency leaves the request path.',
      ],
      keyIdea: 'Move AI work off the request path: queue the events, enrich later, join at read time.',
      metrics: { share: '0% inline', p95: '+0 ms', rollback: 'stop workers', risk: 'lowest' },
      metricTones: { risk: 'good', rollback: 'good' },
      scene: {
        nodes: [
          { id: 'db', kind: 'db', at: at(-4.4, -3), label: 'legacy DB', sub: 'relational' },
          { id: 'queue', kind: 'queue', at: at(0, -3), label: 'queue', sub: 'change events' },
          { id: 'worker', kind: 'block', at: at(4.4, -3), label: 'AI worker', sub: 'own pace', icon: 'Cpu', tint: 'amber', load: 55 },
          { id: 'enrich', kind: 'db', at: at(2.2, 4.6), label: 'enrichment', sub: 'separate table', tint: 'green' },
        ],
        links: [link('db', 'queue', { label: 'CDC' }), link('queue', 'worker'), link('worker', 'enrich', { label: 'write result' })],
        flows: [
          { path: ['db', 'queue'], tone: 'event', label: 'row changed', count: 3, duration: 1.2 },
          { path: ['queue', 'worker'], tone: 'event', label: 'event', duration: 1.2, delay: 1.3 },
          { path: ['worker', 'enrich'], tone: 'data', label: 'summary', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'Why it helps',
          icon: 'Timer',
          rows: [
            { text: 'Request path latency', value: 'unchanged', tone: 'good' },
            { text: 'Burst of 10x events', value: 'queue absorbs', tone: 'good' },
            { text: 'AI result lands', value: 'seconds later', tone: 'warn' },
          ],
        },
        caption: 'The AI never sits in the user\'s wait',
      },
    },
    {
      title: 'LLM translator',
      tag: 'concept',
      heading: 'Adapter 3: the LLM as a translator in front of the old API',
      eli5: 'A guest says, "I want to cancel the dessert from last month." The **helper** turns that into the exact order form the old kitchen has always used. The kitchen itself never changes.',
      body: [
        'The LLM turns fuzzy natural language into the rigid arguments the legacy API already accepts. You do not touch the legacy API. You put a smart translator in front of it.',
        'The book calls this the highest-ROI way to add AI to an existing enterprise app. Put the ACL between the translator and the API.',
      ],
      keyIdea: 'Let the LLM produce the structured arguments the old API always needed, and leave the API as it is.',
      metrics: { share: '30%', p95: '650 ms', rollback: 'one flag', risk: 'low' },
      metricTones: { risk: 'good' },
      scene: {
        nodes: [
          { ...user, at: at(-4.4, -3), chips: ['"cancel my add-on from last month"'] },
          { id: 'translator', kind: 'block', at: at(0, -3), label: 'LLM translator', sub: 'text to args', icon: 'Cpu', tint: 'amber' },
          { ...legacy, at: at(4.4, -3), label: 'legacy API', sub: 'needs structured args' },
        ],
        links: [link('user', 'translator'), link('translator', 'legacy', { label: 'typed args' })],
        flows: [
          { path: ['user', 'translator'], tone: 'request', label: 'free text', duration: 1.3 },
          { path: ['translator', 'legacy'], tone: 'request', label: 'cancel(addon, 2026-03)', duration: 1.3, delay: 1.4 },
          { path: ['legacy', 'user'], tone: 'response', label: 'done', duration: 1.6, delay: 2.8 },
        ],
        panel: {
          title: 'What the model extracts',
          icon: 'Braces',
          code: '{\n  "action": "cancel",\n  "resource": "addon",\n  "period": "2026-03"\n}',
          footer: { text: 'The legacy API accepts this already', tone: 'good' },
        },
        caption: 'Fuzzy words in, strict arguments out',
      },
    },
    {
      title: 'Shadow mode',
      tag: 'concept',
      heading: 'Adapter 4: run the AI in the dark first',
      eli5: 'For a week the helper cooks a second plate for every order, but nobody eats it. The cooks taste the spare plates later and decide if the helper is ready to serve real guests.',
      body: [
        'In **shadow mode** the AI runs in parallel with the real system. The user gets the legacy answer. The AI answer is logged, never shown, and compared offline.',
        'It measures quality before the AI touches the hot path. It matters most in regulated fields such as healthcare and finance, where the first user-facing rollout needs proof behind it.',
      ],
      keyIdea: 'Shadow mode produces evidence: real traffic, real comparisons, zero user exposure.',
      metrics: { share: '0% shown', p95: '+0 ms', rollback: 'nothing to undo', risk: 'none' },
      metricTones: { risk: 'good', rollback: 'good' },
      scene: {
        nodes: [user, { ...legacy, at: at(0, -3), label: 'legacy service', status: 'ok' }, { ...ai, at: at(2, 3.4), status: 'dim', label: 'AI shadow', sub: 'never shown' }, { ...monitor, at: at(5.6, 3.4), label: 'compare log', sub: 'offline' }],
        links: [link('user', 'legacy'), link('legacy', 'ai', { style: 'dashed', label: 'also sent' }), link('ai', 'monitor', { style: 'dashed' })],
        flows: [
          { path: ['user', 'legacy'], tone: 'request', label: 'request', duration: 1.2 },
          { path: ['legacy', 'user'], tone: 'response', label: 'real answer', duration: 1.2, delay: 1.3 },
          { path: ['legacy', 'ai'], tone: 'event', label: 'copy', duration: 1.2, delay: 1.3 },
          { path: ['ai', 'monitor'], tone: 'data', label: 'shadow answer', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'Offline comparison',
          icon: 'Table',
          rows: [
            { text: 'Agreement with legacy', value: '91%', tone: 'good' },
            { text: 'AI better on review', value: '4%', tone: 'good' },
            { text: 'AI worse on review', value: '3%', tone: 'warn' },
            { text: 'Cost per decision', value: '$0.004' },
          ],
        },
        caption: 'Compare first, expose later',
      },
    },
    {
      title: 'Flag rollout',
      tag: 'concept',
      heading: 'Roll out in phases, with an automatic way back',
      eli5: 'The helper serves one table, then ten, then half the room, then everyone. A **bell** in the kitchen rings if the plates get slow or wrong, and the host pulls the helper off the floor.',
      body: [
        'Never ship AI as a big-bang switch. Phases run shadow, canary at 1% to 10%, broad at 50%, then full. Any flag system with percentage and tenant targeting works.',
        'Auto-rollback on regressions in p50 and p95 latency, cost per request, quality score on an eval set, thumbs-down rate, support tickets or errors. Wire a **kill switch** so a human can freeze AI traffic in one click.',
      ],
      keyIdea: 'A rollout is phased, measured and reversible by a flag, with a kill switch for humans.',
      metrics: { share: '10%', p95: '430 ms', rollback: '1 click', risk: 'low' },
      metricTones: { rollback: 'good', risk: 'good' },
      scene: {
        nodes: [
          { id: 'flag', kind: 'block', at: at(0, -3), label: 'rollout flag', sub: '10% canary', icon: 'Split', tint: 'violet', status: 'active' },
          { ...legacy, at: at(-3.6, 3.4) },
          { ...ai, at: at(0, 3.4) },
          { ...monitor, at: at(4.4, -3), label: 'regression watch', sub: 'auto-rollback' },
        ],
        links: [link('flag', 'legacy'), link('flag', 'ai'), link('ai', 'monitor', { style: 'dashed' }), link('monitor', 'flag', { style: 'dashed', label: 'trip = revert', labelTone: 'warn' })],
        flows: [
          { path: ['flag', 'legacy'], tone: 'request', label: '90%', duration: 1.3 },
          { path: ['flag', 'ai'], tone: 'request', label: '10%', duration: 1.3, delay: 1.4 },
          { path: ['ai', 'monitor'], tone: 'data', label: 'metrics', duration: 1.2, delay: 2.8 },
        ],
        panel: {
          title: 'Phases and signals',
          icon: 'TrendingUp',
          rows: [
            { text: 'Shadow', value: '0% shown' },
            { text: 'Canary', value: '1% to 10%', tone: 'good' },
            { text: 'Broad', value: '50%' },
            { text: 'Full', value: '100%' },
            { text: 'Revert if latency up', value: '> X%', tone: 'warn' },
            { text: 'Revert if quality down', value: '> X%', tone: 'warn' },
          ],
        },
        caption: 'Every phase can revert by itself',
      },
    },
    {
      title: 'A/B, no truth',
      tag: 'tradeoff',
      heading: 'Testing an AI feature when no answer key exists',
      eli5: 'There is no answer sheet for "was that a nice soup?" So watch what guests do: do they finish the meal, change the dish, come back next week, or give a thumbs-down?',
      body: [
        'A button test has a winner. An AI summary often has no known-correct answer, so you measure indirectly. Each signal has a catch.',
        'Build a **composite score**, and block the rollout if any primary metric regresses past its threshold. A gate looks like: block if task completion drops more than 2% or p95 latency rises more than 20%. Retention also counts but takes weeks.',
      ],
      keyIdea: 'With no ground truth, combine several indirect signals and treat each one as a proxy with a known weakness.',
      metrics: { share: '50%', p95: '470 ms', rollback: '1 click', risk: 'medium' },
      scene: {
        nodes: [
          { ...user, at: at(-4.4, -3), label: 'users' },
          { ...ai, at: at(0, -3), label: 'AI variant', sub: 'arm B' },
          { ...monitor, at: at(4.4, -3), label: 'composite score', sub: 'block on regression' },
        ],
        links: [link('user', 'ai'), link('ai', 'monitor', { style: 'dashed' })],
        flows: [
          { path: ['user', 'ai'], tone: 'request', label: 'uses feature', duration: 1.3 },
          { path: ['ai', 'monitor'], tone: 'data', label: 'behavior signals', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'Signals and their catch',
          icon: 'Table',
          rows: [
            { text: 'Task completion', value: 'slow to show drops' },
            { text: 'Time to completion', value: 'faster may be quitting' },
            { text: 'Edit distance on output', value: 'low = trust or laziness' },
            { text: 'Thumbs up or down', value: 'sparse (often a few percent or less)' },
            { text: 'Offline eval score', value: 'can drift from traffic' },
            { text: 'LLM-as-judge', value: 'correlated failures' },
          ],
          footer: { text: 'Example gate: block if completion drops over 2% or p95 rises over 20%', tone: 'warn' },
        },
        caption: 'Many weak signals, one gate',
      },
    },
    {
      title: 'Part 1 recap',
      tag: 'recap',
      heading: 'Recap: reversible, checked, measured',
      eli5: 'The old kitchen keeps running. A **host** routes a few guests to the helper, a head chef checks every order slip, and a bell rings if things go wrong. Part 2 covers the data, plumbing and rules around it.',
      body: [
        'Integration is the hard part. A strangler facade makes the launch reversible. An ACL validates every model output. Four adapters (sidecar, async queue, translator, shadow) add AI with little risk.',
        'Phased flags and composite metrics decide whether to widen. Part 2 covers data pipelines, boundaries, identity, rollback, governance and cost.',
      ],
      keyIdea: 'Route, translate, check, shadow, then widen. Each step stays reversible.',
      metrics: { share: '10%', p95: '440 ms', rollback: '1 click', risk: 'low' },
      metricTones: { rollback: 'good', risk: 'good' },
      scene: {
        nodes: [user, facade, { ...legacy, at: at(-3.6, 3.4) }, { ...ai, at: at(3.6, 3.4) }, { ...acl, at: at(0, 3.4), label: 'ACL' }],
        links: [link('user', 'facade'), link('facade', 'legacy'), link('facade', 'ai'), link('ai', 'acl'), link('acl', 'legacy')],
        flows: [
          { path: ['user', 'facade', 'legacy'], tone: 'request', label: 'most traffic', duration: 1.6 },
          { path: ['user', 'facade', 'ai'], tone: 'request', label: 'AI path (ACL guards writes)', duration: 1.8, delay: 1.7 },
        ],
        panel: {
          title: 'Part 1 toolbox',
          icon: 'Shield',
          rows: [
            { text: 'Strangler facade', value: 'reversible', tone: 'good' },
            { text: 'ACL', value: 'checked', tone: 'good' },
            { text: 'Sidecar, queue, translator', value: 'low risk', tone: 'good' },
            { text: 'Shadow, flags, A/B', value: 'measured', tone: 'good' },
          ],
        },
        caption: 'Part 1 in one picture',
      },
      quiz: {
        question: 'Which adapter lets AI read a copy of legacy output and add fields without ever blocking the response?',
        options: ['LLM as middleware', 'Sidecar inference', 'A big-bang switch', 'Replacing the monolith database'],
        answer: 1,
        explain: 'The sidecar reads a copy of the input and output and adds fields beside the base response. If it fails, the legacy response still goes out unchanged.',
      },
    },
  ],
};
