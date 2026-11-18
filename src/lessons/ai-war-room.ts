import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => { const D = d * 1.17, S = s * 1.25; return [(S + D) / 2, (S - D) / 2]; };

const user: SceneNode = { id: 'user', kind: 'user', at: at(-4.8, -2), label: 'customer' };
const agent: SceneNode = { id: 'agent', kind: 'block', at: at(-1.6, -2), label: 'agent', sub: 'the cook', icon: 'Workflow', tint: 'violet' };
const model: SceneNode = { id: 'model', kind: 'block', at: at(1.6, -2), label: 'LLM', sub: 'the head chef', icon: 'Cpu', tint: 'amber' };
const tools: SceneNode = { id: 'tools', kind: 'block', size: 0.8, at: at(-1.6, 3), label: 'tools', sub: 'the pantry keys', icon: 'Plug', tint: 'blue' };
const db: SceneNode = { id: 'db', kind: 'db', at: at(1.6, 3), label: 'users DB', sub: 'the records room' };
const gateway: SceneNode = { id: 'gateway', kind: 'block', size: 0.8, at: at(1.6, -2), label: 'gateway', sub: 'the front office', icon: 'Router', tint: 'teal' };
const index: SceneNode = { id: 'index', kind: 'block', at: at(1.6, 3), label: 'vector index', sub: 'the recipe cards', icon: 'Database', tint: 'green' };
const evals: SceneNode = { id: 'evals', kind: 'block', size: 0.8, at: at(4.8, 3), label: 'eval set', sub: 'the taste test', icon: 'Table', tint: 'teal' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

export const aiWarRoom: Lesson = {
  id: 'ai-war-room',
  title: 'AI war room',
  tagline: 'Twelve incidents that only happen in AI systems, the wrong first guess in each, the real cause, and the fix that lasts.',
  minutes: 24,
  level: 'Advanced',
  learn: [
    'Why AI systems fail softly, and why your usual alerts stay quiet',
    'Prompt injection, jailbreaks, poisoned fine-tunes and why tools are the security boundary',
    'Runaway agent loops, token bills and hard caps owned by the runtime',
    'Vector index corruption, embedding drift and blue/green index swaps',
    'Model deprecation, silent model swaps and the LLM gateway',
    'Silent RAG regressions, eval gates and context truncation bugs',
    'The 10-minute triage checklist and the ranked list of root causes',
  ],
  metrics: [
    { key: 'detect', label: 'Detected by', icon: 'Signal' },
    { key: 'blast', label: 'Blast radius', icon: 'Users' },
    { key: 'cost', label: 'Spend per day', icon: 'Receipt' },
    { key: 'quality', label: 'Answer quality', icon: 'Gauge' },
  ],
  steps: [
    {
      title: 'Soft failure',
      tag: 'problem',
      heading: 'The dashboards are green and the answers are wrong',
      eli5: 'In a school cafeteria, the **LLM** is the head chef. The kitchen runs on time and nothing is on fire, but today every plate quietly tastes wrong, and nobody rings a bell.',
      body: [
        'A classic outage is loud: errors, timeouts, a pegged CPU. An AI system usually fails **softly**. It still returns `200 OK` in 800 ms, with a fluent answer that is wrong, biased, unsafe or very expensive.',
        'Error rate and latency stay flat, so the usual alerts never fire. This lesson walks through twelve real incident shapes, plus the triage routine that finds them.',
      ],
      keyIdea: 'AI incidents look healthy to infrastructure monitoring. Quality, cost and safety need their own alerts.',
      metrics: { detect: 'a customer', blast: '?', cost: '$800', quality: 'unknown' },
      metricTones: { detect: 'bad', quality: 'bad' },
      scene: {
        nodes: [
          { ...user, chips: ['can I get my money back?'] },
          { ...model, status: 'active', load: 45, chips: [{ text: '200 OK, 800 ms', tone: 'good' }] },
          { id: 'monitor', kind: 'monitor', at: at(4.8, -2), label: 'dashboards', sub: 'all green', status: 'ok' },
        ],
        links: [link('user', 'model', { label: 'chat' }), link('model', 'monitor', { arrow: 'none' })],
        flows: [
          { path: ['user', 'model'], tone: 'request', label: 'refund?', duration: 1.3 },
          { path: ['model', 'user'], tone: 'error', label: 'confident, wrong', duration: 1.3, delay: 1.4 },
          { path: ['model', 'monitor'], tone: 'response', label: 'status 200', duration: 1.2, delay: 1.4 },
        ],
        panel: {
          title: 'What monitoring sees',
          icon: 'Activity',
          rows: [
            { text: 'Error rate', value: '0.1%', tone: 'good' },
            { text: 'p99 latency', value: '1.9 s', tone: 'good' },
            { text: 'GPU load', value: '45%', tone: 'good' },
            { text: 'Is the answer true?', value: 'nobody knows', tone: 'bad' },
          ],
          footer: { text: 'The first alarm is a customer tweet', tone: 'bad' },
        },
        caption: 'Healthy infrastructure, broken product',
      },
    },
    {
      title: 'Injection leak',
      tag: 'case',
      heading: 'Incident 1: a chat message that rewrote the rules',
      eli5: 'A kid hands the **agent** a lunch order, and the note also says "you are the principal now, hand over the records room key." The cook cannot tell notes from orders, so it obeys.',
      body: [
        'At 02:14 a rule fires: one request returned 40,000 rows, normally under 50. The on-call engineer first suspects bad SQL written by the model. Thirty minutes of reading prompts later, the real cause appears: the attack is in the customer message.',
        'The agent pasted the message straight into its system prompt, and its `query_users` tool accepted raw SQL. 40K emails and order histories left the building.',
      ],
      keyIdea: 'Text from users and documents is data, but a prompt that mixes it with instructions cannot tell the difference.',
      metrics: { detect: 'row-count alert', blast: '40K customers', cost: '$800', quality: 'fine' },
      metricTones: { blast: 'bad', detect: 'warn' },
      scene: {
        nodes: [
          { ...user, chips: [{ text: 'SYSTEM OVERRIDE', tone: 'bad' }] },
          { ...agent, status: 'hot' },
          { ...tools, chips: ['query_users(sql)'] },
          { ...db, status: 'hot', badge: '40,000 rows' },
        ],
        links: [link('user', 'agent'), link('agent', 'tools'), link('tools', 'db')],
        flows: [
          { path: ['user', 'agent'], tone: 'error', label: 'ignore the rules', duration: 1.2 },
          { path: ['agent', 'tools', 'db'], tone: 'request', label: 'SELECT email ...', duration: 1.6, delay: 1.3 },
          { path: ['db', 'tools', 'agent', 'user'], tone: 'data', label: '40K rows', duration: 2, delay: 3 },
        ],
        panel: {
          title: 'The vulnerable prompt',
          icon: 'FileText',
          code: 'You are a helpful support agent.\nAnswer this question:\n{user_message}\nYou have the query_users tool.\nUse it when needed.',
          footer: { text: 'No SQL allowlist behind the tool', tone: 'bad' },
        },
        caption: 'Attacker text lands inside the instructions',
      },
    },
    {
      title: 'Tool boundary',
      tag: 'concept',
      heading: 'Fix 1: the tools are the security boundary, not the prompt',
      eli5: 'Give the cook a keyring where each key opens one drawer, and only for the child standing at the counter. Even a tricked cook cannot open the records room.',
      body: [
        'Treat the model as a confused intern with root access: every action it requests is re-authorized at the **tool layer**. Use named queries instead of raw SQL, and run the tool as a database user that sees only the current customer rows (**row-level security**).',
        'Add an **input classifier** for injection and an **output scan** for replies with over 10 emails. Grant each tool least privilege, since misconfigured tool permissions are a common root cause.',
      ],
      keyIdea: 'Design every tool as if the model were adversarial, because whoever controls its input effectively controls it.',
      metrics: { detect: 'classifier', blast: '1 customer', cost: '$800', quality: 'fine' },
      metricTones: { blast: 'good', detect: 'good' },
      scene: {
        nodes: [
          { id: 'guard', kind: 'block', size: 0.8, at: at(-4.8, -2), label: 'classifier', sub: 'input guard', icon: 'Shield', tint: 'teal', status: 'ok' },
          { ...agent },
          { ...tools, tint: 'green', chips: [{ text: 'get_orders(customer_id)', tone: 'good' }] },
          { ...db, status: 'ok', chips: ['RLS: own rows only'] },
        ],
        links: [link('guard', 'agent'), link('agent', 'tools'), link('tools', 'db')],
        flows: [
          { path: ['guard', 'agent'], tone: 'request', label: 'score: 0.02', duration: 1.2 },
          { path: ['agent', 'tools', 'db'], tone: 'request', label: 'named query', duration: 1.6, delay: 1.3 },
          { path: ['db', 'tools', 'agent'], tone: 'response', label: '3 rows', duration: 1.4, delay: 3 },
        ],
        panel: {
          title: 'Layers that stop it',
          icon: 'Shield',
          rows: [
            { text: 'Input classifier', value: 'scores each message', tone: 'good' },
            { text: 'Tool allowlist', value: 'no raw SQL', tone: 'good' },
            { text: 'Row-level security', value: 'own rows', tone: 'good' },
            { text: 'Output scan', value: '> 10 emails', tone: 'good' },
          ],
          footer: { text: 'Any one layer can fail', tone: 'muted' },
        },
        caption: 'Re-authorize at the tool, not in the prompt',
      },
    },
    {
      title: 'Poisoned tune',
      tag: 'case',
      heading: 'Incident 2: the bot promised refunds that do not exist',
      eli5: 'The head chef learned from an old recipe book that had one page from a one-day bake sale. Now every kid is promised a free cookie, and the chef cannot forget the page.',
      body: [
        'Screenshots show the support bot promising "full refunds on purchases over 30 days old". 10,400 chats contain the phrase. Pure hallucination is noisy, but this was too consistent.',
        'Last week\'s **fine-tune** used 50K transcripts, and some came from a two-week promo that really did allow it. The model learned the pattern. RAG missed the policy document because the retriever did not match "can I get my money back".',
      ],
      keyIdea: 'Fine-tuning bakes data into the weights. You cannot untrain a mistake, only roll back to a checkpoint.',
      metrics: { detect: 'a viral tweet', blast: '10,400 chats', cost: '$2.3M exposure', quality: 'bad' },
      metricTones: { detect: 'bad', blast: 'bad', cost: 'bad', quality: 'bad' },
      scene: {
        nodes: [
          { id: 'data', kind: 'storage', at: at(-4.8, -2), label: 'transcripts', sub: '50K, incl. promo', status: 'hot' },
          { ...model, label: 'fine-tuned LLM', status: 'hot', chips: [{ text: 'v7 refunds > 30 days', tone: 'bad' }] },
          { ...user, at: at(1.6, 3), chips: ['can I get my money back?'] },
        ],
        links: [link('data', 'model', { label: 'fine-tune' }), link('user', 'model')],
        flows: [
          { path: ['data', 'model'], tone: 'data', label: 'promo pages', duration: 1.4 },
          { path: ['user', 'model'], tone: 'request', label: 'money back?', duration: 1.2, delay: 1.5 },
          { path: ['model', 'user'], tone: 'error', label: '"yes, full refund"', duration: 1.2, delay: 2.8 },
        ],
        panel: {
          title: 'First fix, in order',
          icon: 'List',
          rows: [
            { text: 'Roll back to last checkpoint', value: '15 min', tone: 'good' },
            { text: 'Route refund topics to humans', value: 'now', tone: 'good' },
            { text: 'Honor promises already made', value: '$2.3M worst case', tone: 'warn' },
          ],
          footer: { text: 'Bot promises can be binding', tone: 'warn' },
        },
        caption: 'One bad batch of training data',
      },
    },
    {
      title: 'Money topics',
      tag: 'tradeoff',
      heading: 'Fix 2: lineage, grounding tests and a human on money',
      eli5: 'Label every page in the recipe book with who wrote it and when. For anything about money, the chef drafts and a teacher signs before the note goes home.',
      body: [
        '**Dataset lineage** tags every training row with source, date range and policy era, so a promo page cannot slip in.',
        'A **golden grounding test** asks "can I get a refund?" in 50 phrasings and checks each against policy, in CI. For money, the bot drafts and a human approves.',
      ],
      keyIdea: 'Treat training data like production code: versioned, reviewed and tested before it ships.',
      metrics: { detect: 'CI eval', blast: '0 chats', cost: '$800', quality: 'checked' },
      metricTones: { detect: 'good', blast: 'good', quality: 'good' },
      scene: {
        nodes: [
          { id: 'data', kind: 'storage', at: at(-4.8, -2), label: 'transcripts', sub: 'source + era tags', status: 'ok' },
          { ...evals, at: at(-1.6, -2), label: 'grounding test', sub: '50 phrasings' },
          { ...model, label: 'LLM', chips: [{ text: 'cites policy doc', tone: 'good' }] },
          { id: 'human', kind: 'user', at: at(4.8, -2), label: 'reviewer', sub: 'approves money' },
        ],
        links: [link('data', 'evals'), link('evals', 'model', { label: 'gate' }), link('model', 'human', { label: 'draft' })],
        flows: [
          { path: ['data', 'evals', 'model'], tone: 'data', label: 'tagged rows', duration: 1.6 },
          { path: ['model', 'human'], tone: 'event', label: 'draft reply', duration: 1.3, delay: 1.7 },
        ],
        panel: {
          title: 'Controls on a fine-tune',
          icon: 'Shield',
          rows: [
            { text: 'Dataset lineage', value: 'per row', tone: 'good' },
            { text: 'Grounding eval in CI', value: '50 phrasings', tone: 'good' },
            { text: 'Topic classifier', value: 'refund, billing, legal: cite or refuse', tone: 'good' },
            { text: 'Human approval', value: 'refund, legal', tone: 'good' },
          ],
        },
        caption: 'Provenance in, proof out',
      },
    },
    {
      title: 'Runaway bill',
      tag: 'case',
      heading: 'Incident 3: $51,847 in one night',
      eli5: 'A kid asks the cook to find out everything about cars. The cook keeps phoning the library all night because nobody said when to stop, and the phone bill arrives in the morning.',
      body: [
        'The daily cost email says $51,847 against an $800 budget. First guess: a DDoS. But 99.4% of the spend is one `/research` endpoint, and one session burned 2.1B tokens over 14 hours, about $3,700 an hour.',
        'It was a **ReAct loop** that ended only when the model wrote `DONE`. Every search result suggested another angle, so it never did. No iteration cap, no token cap, no cost cap.',
      ],
      keyIdea: 'In agent systems an infinite loop is a money problem, because your CPU is someone else\'s GPU billed by the token.',
      metrics: { detect: 'next-day email', blast: '1 session', cost: '$51,847', quality: 'fine' },
      metricTones: { detect: 'bad', cost: 'bad' },
      scene: {
        nodes: [
          { ...agent, at: at(-4.8, -2), status: 'hot', chips: [{ text: 'step 3,120 (state: 600K tokens)', tone: 'warn' }] },
          { ...model, at: at(-0.8, -2), status: 'hot', load: 92, badge: '2.1B tokens' },
          { ...tools, label: 'search', sub: 'web tool', at: at(4.8, -2) },
        ],
        links: [link('agent', 'model', { arrow: 'both' }), link('model', 'tools', { arrow: 'both' })],
        flows: [
          { path: ['agent', 'model'], tone: 'request', label: 'decide', duration: 1.1 },
          { path: ['model', 'tools'], tone: 'request', label: 'search', duration: 1.1, delay: 1.2 },
          { path: ['tools', 'model', 'agent'], tone: 'response', label: 'more angles', duration: 1.4, delay: 2.4 },
        ],
        panel: {
          title: 'The loop that never ends',
          icon: 'Repeat',
          code: 'while not done:\n  action = llm.decide(state)  # cost grows with state\n  result = execute(action)\n  state = state + result      # ~600K tokens by step 3,000\n# no iteration, token, cost\n# or wall-clock cap',
          footer: { text: '14 hours at about $3,700 per hour, roughly $15 per step late in the run', tone: 'bad' },
        },
        caption: 'Termination left to the model',
      },
    },
    {
      title: 'Loop caps',
      tag: 'concept',
      heading: 'Fix 3: the runtime decides when to stop',
      eli5: 'Hand the cook a timer, a coin purse and a counter. When any one runs out, the cook must serve what it has, however many more questions it can think of.',
      body: [
        'Set hard, server-side limits: `max_iterations` of 10 to 20, a token cap, a wall-clock cap and a cost cap per request ($5 here). Any one tripping halts the run. After N-1 steps, inject a **force-close prompt**: "produce a final answer now with what you have".',
        'Make cost a first-class config with per-user daily caps, real-time cost metrics, and alerts that page at 2x budget and auto-kill at a ceiling.',
      ],
      keyIdea: 'A termination condition that says "the model decides" is not a termination condition.',
      metrics: { detect: 'cost alarm', blast: '1 request', cost: '$5 cap', quality: 'fine' },
      metricTones: { detect: 'good', cost: 'good' },
      scene: {
        nodes: [
          { ...agent, status: 'ok', chips: ['step 14 of 20'] },
          { id: 'budget', kind: 'block', size: 0.8, at: at(1.6, -2), label: 'budget guard', sub: 'in the runtime', icon: 'Gauge', tint: 'teal', status: 'ok' },
          { ...model, at: at(4.8, -2), load: 55 },
        ],
        links: [link('agent', 'budget'), link('budget', 'model')],
        flows: [
          { path: ['agent', 'budget', 'model'], tone: 'request', label: 'within budget', duration: 1.6 },
          { path: ['budget', 'agent'], tone: 'error', label: 'cap hit: answer now', duration: 1.3, delay: 1.8 },
        ],
        panel: {
          title: 'Stop conditions, any one halts',
          icon: 'Timer',
          rows: [
            { text: 'max_iterations', value: '20' },
            { text: 'max_tokens', value: '200K' },
            { text: 'max_cost', value: '$5' },
            { text: 'wall clock', value: '120 s' },
            { text: 'Page at / kill at', value: '$1K / $2K per hour', tone: 'warn' },
          ],
        },
        caption: 'Limits live outside the model',
      },
    },
    {
      title: 'Spins forever',
      tag: 'case',
      heading: 'Incident 3b: the agent that spins forever',
      eli5: 'A kid asks the cook a question and the cook keeps opening the same pantry drawer, over and over, hoping something new is inside. The kid waits at the counter and gives up.',
      body: [
        'The research agent P99 latency climbs to 600 s and 40% of requests time out. Users say "it spins forever". The symptom is latency, and traces show the same tool called with the same arguments dozens of times.',
        'Fix it with **loop detection** on repeated identical calls, **per-tool timeouts**, and a **circuit breaker** that stops calling a failing tool.',
      ],
      keyIdea: 'A loop can burn time instead of money. Detect repeated identical calls, and bound every tool with a timeout and a breaker.',
      metrics: { detect: 'P99 latency alert', blast: '40% of requests', cost: '$800', quality: 'timeouts' },
      metricTones: { detect: 'warn', blast: 'bad', quality: 'bad' },
      scene: {
        nodes: [
          { ...agent, status: 'hot', chips: [{ text: 'same call x 38', tone: 'bad' }] },
          { ...tools, at: at(1.6, -2), label: 'search tool', sub: 'slow, repeats', status: 'hot', chips: [{ text: 'repeat: search("q", page 1)', tone: 'warn' }] },
          { ...model, at: at(4.8, -2), load: 60 },
        ],
        links: [link('agent', 'tools', { arrow: 'both', label: 'identical args' }), link('agent', 'model', { style: 'dashed' })],
        flows: [
          { path: ['agent', 'tools'], tone: 'request', label: 'search(q)', duration: 1.2 },
          { path: ['tools', 'agent'], tone: 'error', label: 'timeout, retry', duration: 1.3, delay: 1.3 },
        ],
        panel: {
          title: 'Guards against a spin',
          icon: 'Repeat',
          rows: [
            { text: 'Identical call plus args', value: '3 repeats halts', tone: 'good' },
            { text: 'Per-tool timeout', value: '10 s', tone: 'good' },
            { text: 'Circuit breaker', value: 'open after 5 failures', tone: 'good' },
            { text: 'P99 before fix', value: '600 s', tone: 'bad' },
          ],
        },
        caption: 'Same drawer, opened again and again',
      },
    },
    {
      title: 'Mutant index',
      tag: 'case',
      heading: 'Incident 4: search about cheese when asked how to cancel',
      eli5: 'The recipe cards are being swapped for new ones overnight. The helper falls asleep halfway, so the box holds a mix of old and new cards, and nobody knows which is which.',
      body: [
        'Retrieval relevance (P90) fell from 0.82 to 0.31 since 02:00. On-call first blamed the LLM and spent 20 minutes checking model versions. But the LLM was summarizing the wrong documents correctly.',
        'The nightly reindex ran out of memory at 02:47 with about 30% of vectors new and 70% stale. Its loop upserted each new vector and deleted the old copy in place, so the dead job left a mixed index. The embedding model had also changed between old and new.',
      ],
      keyIdea: 'A vector index is a database, not a cache. Never rebuild it in place.',
      metrics: { detect: 'a Slack message', blast: 'all search', cost: '$800', quality: '0.31' },
      metricTones: { detect: 'bad', blast: 'bad', quality: 'bad' },
      scene: {
        nodes: [
          { id: 'job', kind: 'worker', at: at(-4.8, -2), label: 'reindex job', sub: 'OOM at 02:47', status: 'down' },
          { ...index, status: 'hot', chips: [{ text: '30% new', tone: 'good' }, { text: '70% stale', tone: 'bad' }] },
          { ...user, at: at(4.8, 3), chips: ['how do I cancel?'] },
        ],
        links: [link('job', 'index', { label: 'in-place upsert' }), link('user', 'index')],
        flows: [
          { path: ['job', 'index'], tone: 'data', label: 'upsert + delete', duration: 1.4 },
          { path: ['user', 'index'], tone: 'request', label: 'how do I cancel?', duration: 1.3, delay: 1.5 },
          { path: ['index', 'user'], tone: 'error', label: 'cheese docs', duration: 1.3, delay: 2.9 },
        ],
        panel: {
          title: 'The dangerous loop',
          icon: 'Code',
          code: 'for doc in docs:\n  index.upsert(doc.id, embed(doc))\n  index.delete("old_" + doc.id)\n# dies halfway: half new,\n# half old, no way to tell',
          footer: { text: 'Old and new vectors live in different spaces', tone: 'bad' },
        },
        caption: 'A rebuild that died halfway',
      },
    },
    {
      title: 'Blue green index',
      tag: 'concept',
      heading: 'Fix 4: build beside, verify, then swap one pointer',
      eli5: 'Fill a second box of recipe cards on the side. Check the count and taste a few dishes. Only then point the cooks at the new box, and keep the old one for a day.',
      body: [
        'Build the new index in a fresh namespace (`prod-v42`), leave `prod-v41` serving, and compare IDs against the source of truth with a checksum. Run a golden query set and abort if P90 relevance falls under the threshold.',
        'Then flip one client config pointer atomically, and delete the old index after 24 hours. Tag every index with its embedding model and schema version.',
      ],
      keyIdea: 'Blue/green for indexes: never mutate what serves traffic, and keep a rollback for a day.',
      metrics: { detect: 'pre-cutover eval', blast: '0 queries', cost: '$800', quality: '0.82' },
      metricTones: { detect: 'good', blast: 'good', quality: 'good' },
      scene: {
        nodes: [
          { ...index, id: 'blue', at: at(-3.2, -2), label: 'prod-v41', sub: 'serving', status: 'ok' },
          { ...index, id: 'green', at: at(3.2, -2), label: 'prod-v42', sub: 'verified', status: 'active', tint: 'teal' },
          { ...agent, id: 'app', at: at(0, 3), label: 'RAG app', sub: 'pointer: v41' },
        ],
        links: [link('app', 'blue', { label: 'live' }), link('app', 'green', { style: 'dashed', label: 'after swap' })],
        flows: [
          { path: ['app', 'blue', 'app'], tone: 'request', duration: 1.5 },
          { path: ['green', 'app'], tone: 'event', label: 'swap pointer', duration: 1.3, delay: 1.6 },
        ],
        panel: {
          title: 'Cutover checklist',
          icon: 'List',
          rows: [
            { text: 'Row count and ID checksum', value: 'match source', tone: 'good' },
            { text: 'Golden queries P90', value: '0.82 vs 0.80 floor', tone: 'good' },
            { text: 'Pointer swap v41 to v42', value: 'atomic', tone: 'good' },
            { text: 'Delete v41', value: 'after 24 h' },
          ],
        },
        caption: 'The old index is the rollback',
      },
      quiz: {
        question: 'A nightly reindex job died halfway and left search returning garbage. What prevents this?',
        options: [
          'Retry the job three times in the same index',
          'Build a new versioned index beside the live one, verify it, then swap a pointer',
          'Delete the whole index first so there is no old data',
          'Switch to a larger LLM',
        ],
        answer: 1,
        explain: 'A half-built index never serves traffic when it is built beside the live one. Verification happens before the swap, and the old index stays as a rollback.',
      },
    },
    {
      title: 'Embedding drift',
      tag: 'case',
      heading: 'Incident 5: the "better" embedding model broke retrieval',
      eli5: 'The recipe cards were filed using one map of the pantry. Someone hands the cooks a new map with different shelf positions, so every card now points to the wrong shelf.',
      body: [
        'An engineer upgrades from `text-embedding-3-small` to `text-embedding-3-large` at 10:00. By 10:15, answers are incoherent. The index still holds old-model vectors, but queries are embedded with the new model.',
        'The two spaces are not aligned, so cosine similarity between them is close to noise and retrieval returns random documents. Embeddings are coordinates in one model\'s geometry.',
      ],
      keyIdea: 'Changing the embedding model changes the map. Every stored vector has to be redrawn first.',
      metrics: { detect: 'user reports', blast: 'all RAG', cost: '$800', quality: 'noise' },
      metricTones: { detect: 'bad', blast: 'bad', quality: 'bad' },
      scene: {
        nodes: [
          { id: 'embed', kind: 'block', at: at(-4.8, -2), label: 'embedder', sub: 'now: 3-large', icon: 'Binary', tint: 'amber', status: 'active' },
          { ...index, at: at(-1.6, 3), sub: 'built with 3-small', status: 'hot' },
          { ...user, at: at(4.8, -2), chips: ['how do I cancel?'] },
        ],
        links: [link('user', 'embed'), link('embed', 'index', { label: 'wrong space', labelTone: 'warn' })],
        flows: [
          { path: ['user', 'embed'], tone: 'request', label: 'query text', duration: 1.2 },
          { path: ['embed', 'index'], tone: 'error', label: 'vector (3-large)', duration: 1.4, delay: 1.3 },
          { path: ['index', 'embed', 'user'], tone: 'error', label: 'random docs', duration: 1.6, delay: 2.9 },
        ],
        panel: {
          title: 'Similarity between spaces',
          icon: 'Table',
          rows: [
            { text: 'query(3-small) vs doc(3-small)', value: '0.81', tone: 'good' },
            { text: 'query(3-large) vs doc(3-large)', value: '0.80', tone: 'good' },
            { text: 'query(3-large) vs doc(3-small)', value: '~0.0, noise', tone: 'bad' },
          ],
          footer: { text: 'Example values for illustration', tone: 'muted' },
        },
        caption: 'Old documents, new coordinates',
      },
    },
    {
      title: 'Version embeddings',
      tag: 'tradeoff',
      heading: 'Fix 5: refuse mixed spaces and migrate, not flip',
      eli5: 'Write the map version on every box of cards. If a cook holds map 2 and the box says map 1, the cook refuses to look and says so loudly.',
      body: [
        'Store the embedding model and version in index metadata, and make the query code refuse to search an index from a different model. Upgrading means re-embedding the whole corpus: treat it as a migration, not a config flag.',
        'During the move, run **dual indexes**: queries go to the matching one while traffic shifts gradually. Add a CI lint that blocks any change to `EMBEDDING_MODEL` without a migration script.',
      ],
      keyIdea: 'Pin the embedding model to the index it built, and migrate the two together.',
      metrics: { detect: 'metadata check', blast: '0 queries', cost: '$800', quality: '0.82' },
      metricTones: { detect: 'good', blast: 'good', quality: 'good' },
      scene: {
        nodes: [
          { id: 'embed', kind: 'block', at: at(-4.8, -2), label: 'embedder', sub: 'v2: 3-large', icon: 'Binary', tint: 'amber' },
          { ...index, id: 'old', at: at(-1.6, 3), label: 'index v1', sub: 'model: 3-small', status: 'dim' },
          { ...index, id: 'new', at: at(4.8, 3), label: 'index v2', sub: 'model: 3-large', status: 'ok', tint: 'teal' },
        ],
        links: [link('embed', 'old', { style: 'dashed', label: 'refused' }), link('embed', 'new', { label: 'match' })],
        flows: [
          { path: ['embed', 'new'], tone: 'request', label: 'v2 query', duration: 1.4 },
          { path: ['new', 'embed'], tone: 'response', label: 'right docs', duration: 1.3, delay: 1.5 },
        ],
        panel: {
          title: 'Index metadata',
          icon: 'FileJson',
          code: '{\n  "index": "prod-v2",\n  "embedding_model": "3-large",\n  "dims": 3072,\n  "schema": 4\n}',
          footer: { text: 'Mismatch: query refuses to run', tone: 'good' },
        },
        caption: 'Query and index must share one model',
      },
    },
    {
      title: 'Model deprecated',
      tag: 'case',
      heading: 'Incident 6: every AI feature broke at midnight',
      eli5: 'The cafeteria\'s favorite flour brand stops being sold at midnight, and the shopping list names that exact brand in fourteen places. The backup flour is only used if the shop is closed, not if the brand is gone.',
      body: [
        'At 00:00 UTC every request to `gpt-4-0613` returns `404 model_not_found`. Error rate is 100% across 14 services. The first thought was a provider outage, but it was an announced deprecation, with an email nobody remembered.',
        'Two compounding errors: the model name was hardcoded in 14 env configs, and the fallback to another provider fired only on 5xx. A 404 looked like a bad request, so users just got the error. The fix took 80 minutes.',
      ],
      keyIdea: 'Providers retire models on their schedule. Hardcoded names and narrow fallback rules turn that into an outage.',
      metrics: { detect: '14 pagers', blast: 'every feature', cost: '$800', quality: 'down' },
      metricTones: { detect: 'warn', blast: 'bad', quality: 'bad' },
      scene: {
        nodes: [
          { id: 'svc', kind: 'block', at: at(-4.8, -2), label: '14 services', sub: 'model in env var', icon: 'Boxes', tint: 'blue', status: 'hot' },
          { id: 'provider', kind: 'block', at: at(-1.6, 3), label: 'provider', sub: 'gpt-4-0613 retired', icon: 'Cpu', tint: 'gray', status: 'down' },
          { id: 'backup', kind: 'block', size: 0.8, at: at(4.8, 3), label: 'backup model', sub: 'fallback on 5xx only', icon: 'Cpu', tint: 'amber', status: 'dim' },
        ],
        links: [link('svc', 'provider', { label: '404', labelTone: 'bad' }), link('svc', 'backup', { style: 'dashed' })],
        flows: [
          { path: ['svc', 'provider'], tone: 'request', label: 'gpt-4-0613', duration: 1.3 },
          { path: ['provider', 'svc'], tone: 'error', label: 'model_not_found', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'Timeline (UTC)',
          icon: 'Clock',
          rows: [
            { text: '00:00 deprecation flips', value: 'errors', tone: 'bad' },
            { text: '00:14 fallback never fires', value: '404 not 5xx', tone: 'warn' },
            { text: '00:40 hotfix, traffic to backup', value: 'partial', tone: 'warn' },
            { text: '01:20 all moved to new model', value: 'restored', tone: 'good' },
          ],
        },
        caption: 'A scheduled retirement, treated as a surprise',
      },
    },
    {
      title: 'LLM gateway',
      tag: 'concept',
      heading: 'Fix 6: one gateway, capabilities instead of model names',
      eli5: 'Cooks no longer shop themselves. They hand a note to the front office saying "a cheap flour", and the office picks the brand, switches brands and tries slowly on small batches first.',
      body: [
        'Services call an internal **LLM gateway** (LiteLLM, Portkey or home-grown). Routing, fallback, retries and caching live there, and services ask for a capability such as `fast-reasoner`, not a model SKU.',
        'Move traffic in stages: 1% for a week, 10% for a week, then 100%. A nightly eval across several providers raises an alert before a deprecation date, and a dashboard tracks every announced sunset.',
      ],
      keyIdea: 'Your code names a capability. The gateway maps it to today\'s model, and can change that mapping at any hour.',
      metrics: { detect: 'sunset dashboard', blast: '0 features', cost: '$800', quality: 'same' },
      metricTones: { detect: 'good', blast: 'good', quality: 'good' },
      scene: {
        nodes: [
          { id: 'svc', kind: 'block', at: at(-4.8, -2), label: 'services', sub: 'ask: fast-reasoner', icon: 'Boxes', tint: 'blue' },
          { ...gateway, at: at(-1.6, -2), label: 'LLM gateway', chips: ['fallback: 4xx + 5xx'] },
          { id: 'new', kind: 'block', size: 0.8, at: at(1.6, 3), label: 'new model', sub: '10% traffic', icon: 'Cpu', tint: 'amber', status: 'active' },
          { id: 'backup', kind: 'block', size: 0.8, at: at(4.8, 3), label: 'other vendor', sub: 'standby', icon: 'Cpu', tint: 'violet', status: 'ok' },
        ],
        links: [link('svc', 'gateway'), link('gateway', 'new', { label: '10%' }), link('gateway', 'backup', { style: 'dashed' })],
        flows: [
          { path: ['svc', 'gateway', 'new'], tone: 'request', label: 'fast-reasoner', duration: 1.6 },
          { path: ['new', 'gateway', 'svc'], tone: 'response', label: 'answer', duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'Routing table',
          icon: 'Route',
          code: 'fast-reasoner:\n  primary:  model-new  (10%)\n  stable:   model-old  (90%)\n  fallback: other-vendor\n  on: 4xx(deprecated), 5xx, timeout',
          footer: { text: 'Change the table, not 14 services', tone: 'good' },
        },
        caption: 'One front office for every model call',
      },
    },
    {
      title: 'Silent swap',
      tag: 'case',
      heading: 'Incident 7: same model name, different model',
      eli5: 'The shop keeps selling "Brand A flour" but starts mixing in a cheaper grade. The label never changes, and the cakes come out a little flatter each week.',
      body: [
        'The nightly golden eval drifts from 0.86 to 0.79 over ten days. No code, config or changelog entry changed. Behind the alias `gpt-4o`, the provider may have changed what it serves, since a provider may change what sits behind an alias.',
        'Only the nightly eval caught it, because it scores the same golden set every night and drift shows up as a falling line.',
      ],
      keyIdea: 'A model name is a label, not a guarantee. Pin it, own the weights, or measure it every night.',
      metrics: { detect: 'nightly eval', blast: 'all users, mild', cost: '$800', quality: '0.79' },
      metricTones: { detect: 'good', blast: 'warn', quality: 'warn' },
      scene: {
        nodes: [
          { ...gateway, at: at(-4.8, -2), label: 'gateway', sub: 'alias: gpt-4o' },
          { id: 'cheap', kind: 'block', at: at(1.6, -2), label: 'provider', sub: 'quiet cheaper variant', icon: 'Cpu', tint: 'amber', status: 'hot', load: 70 },
          { ...evals, at: at(-1.6, 3), label: 'nightly eval', sub: 'score 0.79' },
        ],
        links: [link('gateway', 'cheap', { label: 'same name' }), link('evals', 'gateway', { label: 'canary' })],
        flows: [
          { path: ['evals', 'gateway', 'cheap'], tone: 'request', label: 'golden set', duration: 1.6 },
          { path: ['cheap', 'gateway', 'evals'], tone: 'response', label: 'weaker answers', duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'Nightly golden-set score',
          icon: 'TrendingUp',
          rows: [
            { text: 'Day 0', value: '0.86', tone: 'good' },
            { text: 'Day 5', value: '0.83', tone: 'warn' },
            { text: 'Day 10', value: '0.79', tone: 'bad' },
          ],
          footer: { text: 'Fix: pin dated versions, keep an open-weights backstop. Example scores.', tone: 'muted' },
        },
        caption: 'Behavior drifted, nothing else did',
      },
    },
    {
      title: 'Silent regression',
      tag: 'case',
      heading: 'Incident 8: a reranker swap and no alert at all',
      eli5: 'The cafeteria swaps the lunch sorter for a new one that works great at other schools. At this school it puts the soup behind the dessert, and the kids slowly stop trusting the line.',
      body: [
        'A "harmless" reranker upgrade ships. Latency and error rate do not move. Ten days later NPS drops 6 points and tickets saying "the AI does not understand me" triple. Hypotheses like season or a UI redesign cost days.',
        'A 500-query golden set shows Precision@5 fell from 0.88 to 0.71. The new reranker ranked generic passages higher and pushed specific technical docs down. The vendor benchmark never measured this company\'s domain.',
      ],
      keyIdea: 'A vendor benchmark is marketing. The only test that counts uses your queries and your documents.',
      metrics: { detect: 'NPS report, day 10', blast: 'all search users', cost: '$800', quality: 'P@5 0.71' },
      metricTones: { detect: 'bad', blast: 'warn', quality: 'bad' },
      scene: {
        nodes: [
          { id: 'ret', kind: 'block', at: at(-4.8, -2), label: 'retriever', sub: 'top 50', icon: 'Search', tint: 'blue' },
          { id: 'rerank', kind: 'block', at: at(-1.6, -2), label: 'reranker v3', sub: 'swapped day 0', icon: 'Scale', tint: 'amber', status: 'hot' },
          { ...model, at: at(1.6, -2) },
          { ...evals, at: at(-1.6, 3), sub: 'ran on day 11' },
        ],
        links: [link('ret', 'rerank'), link('rerank', 'model'), link('evals', 'rerank', { style: 'dashed' })],
        flows: [
          { path: ['ret', 'rerank'], tone: 'data', label: '50 passages', duration: 1.3 },
          { path: ['rerank', 'model'], tone: 'data', label: 'generic top 5', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'Golden set, 500 queries',
          icon: 'Table',
          rows: [
            { text: 'Precision@5, reranker v2', value: '0.88', tone: 'good' },
            { text: 'Precision@5, reranker v3', value: '0.71', tone: 'bad' },
            { text: 'Latency, error rate', value: 'unchanged', tone: 'muted' },
            { text: 'NPS', value: '-6', tone: 'bad' },
          ],
          footer: { text: 'Rolled back to v2 within an hour', tone: 'good' },
        },
        caption: 'Quality fell, infrastructure noticed nothing',
      },
    },
    {
      title: 'Eval gate',
      tag: 'concept',
      heading: 'Fix 7: evals are the tests, and they gate every change',
      eli5: 'Before any new tool joins the lunch line, a panel of teachers tastes 500 dishes. If the score drops by more than a little, the new tool goes back in the box.',
      body: [
        'Build a **golden set**: 500 queries with expected top-5 documents, curated by domain experts. Run it offline and in CI. Any change to retrieval, reranker, prompt or model that regresses a metric by more than 2% blocks the merge.',
        'For changes that pass, run in **shadow mode** for a week beside production, then a small A/B on business metrics such as NPS and task completion.',
      ],
      keyIdea: 'In AI systems the tests are eval sets, and they must reflect your real users.',
      metrics: { detect: 'CI gate', blast: '0 users', cost: '$800', quality: 'P@5 0.88' },
      metricTones: { detect: 'good', blast: 'good', quality: 'good' },
      scene: {
        nodes: [
          { id: 'change', kind: 'block', at: at(-4.8, -2), label: 'change', sub: 'reranker, prompt, model', icon: 'Code', tint: 'violet' },
          { ...evals, at: at(-1.6, -2), label: 'golden set', sub: '500 queries', status: 'active' },
          { id: 'shadow', kind: 'block', size: 0.8, at: at(1.6, -2), label: 'shadow run', sub: '1 week', icon: 'Layers', tint: 'blue' },
          { id: 'prod', kind: 'block', size: 0.8, at: at(4.8, -2), label: 'production', sub: 'A/B 5%', icon: 'Server', tint: 'green' },
        ],
        links: [link('change', 'evals'), link('evals', 'shadow', { label: 'pass' }), link('shadow', 'prod', { label: 'pass' })],
        flows: [
          { path: ['change', 'evals', 'shadow', 'prod'], tone: 'event', label: 'candidate', duration: 2.4 },
        ],
        panel: {
          title: 'Gate rules',
          icon: 'Shield',
          rows: [
            { text: 'Offline golden set', value: 'regress > 2% blocks', tone: 'good' },
            { text: 'Shadow mode', value: '1 week, no users' },
            { text: 'Online A/B', value: 'NPS, completion' },
          ],
        },
        caption: 'Three gates before a change reaches everyone',
      },
      quiz: {
        question: 'A vendor says its new reranker beats the old one on a public benchmark. What do you do before shipping it?',
        options: [
          'Ship it, the vendor tested it',
          'Run it on your own golden set in CI and in shadow mode, and ship only if your metrics hold',
          'Watch error rate and latency for a day',
          'Ask users to report problems',
        ],
        answer: 1,
        explain: 'Error rate and latency do not move when quality drops. Only an eval built from your own queries and documents can show a regression before users do.',
      },
    },
    {
      title: 'Silent truncation',
      tag: 'case',
      heading: 'Incident 9: the assistant forgot its instructions and switched language',
      eli5: 'A kid keeps adding sticky notes to a tiny whiteboard. When it fills up, the helper wipes the top first, and the top is where the cafeteria rules were written.',
      body: [
        'After five days in one session (220K tokens), a user says the assistant ignores their custom instructions and answers in Spanish. The model has a 200K context window, and the client trimmed by dropping the oldest message first. That was the system prompt.',
        'Without it the model fell back to default behavior, and Spanish examples in a tool schema tipped the language. The bug was `messages.pop(0)` in a loop, blind to roles.',
      ],
      keyIdea: 'Context limit is a correctness limit. Silent truncation is a data-corruption bug with a friendly name.',
      metrics: { detect: 'a power user', blast: 'long sessions', cost: '$800', quality: 'drifting' },
      metricTones: { detect: 'warn', quality: 'bad' },
      scene: {
        nodes: [
          { ...user, chips: ['day 5, 220K tokens'] },
          { ...agent, status: 'hot', chips: [{ text: 'drops oldest first', tone: 'bad' }] },
          { ...model, chips: [{ text: 'limit 200K', tone: 'warn' }] },
        ],
        links: [link('user', 'agent'), link('agent', 'model', { label: 'prompt minus system' })],
        flows: [
          { path: ['user', 'agent'], tone: 'request', label: 'message 9,114', duration: 1.2 },
          { path: ['agent', 'model'], tone: 'error', label: 'no system prompt', duration: 1.4, delay: 1.3 },
          { path: ['model', 'agent', 'user'], tone: 'error', label: 'responde en español', duration: 1.8, delay: 2.8 },
        ],
        panel: {
          title: 'The bug, approximately',
          icon: 'Bug',
          code: 'def trim_to_fit(msgs, max_tokens):\n  while count(msgs) > max_tokens:\n    msgs.pop(0)\n    # drops the system prompt first\n  return msgs',
          footer: { text: 'No error, no log, no alert', tone: 'bad' },
        },
        caption: 'The rules fell off the top of the window',
      },
    },
    {
      title: 'Memory policy',
      tag: 'tradeoff',
      heading: 'Fix 8: pin the rules and evict on purpose',
      eli5: 'Staple the cafeteria rules to the board so they never get wiped. Squash old notes into a short summary, and if the board is still full, say so out loud and start a new one.',
      body: [
        'Use **role-aware truncation**: the system prompt and tool definitions are pinned, and only user and assistant turns may be evicted. Keep a sliding window of recent turns plus a summary of older ones, made by an LLM call at checkpoints.',
        'If the budget is still exceeded after trimming, return an error and start a fresh session. Log token counts every turn and alarm at 80% of the limit. Loud failure beats silent truncation.',
      ],
      keyIdea: 'Make the eviction policy explicit and test it the way you would test cache eviction.',
      metrics: { detect: 'alarm at 80%', blast: '0 sessions', cost: '$800', quality: 'stable' },
      metricTones: { detect: 'good', blast: 'good', quality: 'good' },
      scene: {
        nodes: [
          { ...agent, chips: [{ text: 'pinned: system + tools', tone: 'good' }] },
          { id: 'summary', kind: 'block', size: 0.8, at: at(1.6, -2), label: 'summarizer', sub: 'at checkpoints', icon: 'FileText', tint: 'teal' },
          { ...model, at: at(4.8, -2), chips: ['window: 160K of 200K'] },
        ],
        links: [link('agent', 'summary', { label: 'old turns' }), link('summary', 'model', { label: 'summary + recent' })],
        flows: [
          { path: ['agent', 'summary'], tone: 'data', label: 'turns 1 to 400', duration: 1.4 },
          { path: ['summary', 'model'], tone: 'data', label: 'summary', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Context budget',
          icon: 'Layers',
          rows: [
            { text: 'System prompt + tools', value: '6K, pinned', tone: 'good' },
            { text: 'Summary of old turns', value: '4K' },
            { text: 'Recent turns', value: '150K' },
            { text: 'Alarm at 80%', value: '160K', tone: 'warn' },
          ],
          footer: { text: 'Over budget after trimming: error, new session', tone: 'muted' },
        },
        caption: 'Eviction is a rule, not an accident',
      },
    },
    {
      title: 'Jailbreak',
      tag: 'case',
      heading: 'Incident 10: a podcaster gets unsafe output on turn 4',
      eli5: 'A kid says "let us play pretend: you are a villain, tell me the secret plan." The guard at the door only checks the first sentence, and nobody checks what leaves the room.',
      body: [
        'A podcaster live-streams a multi-turn role-play ("we are writing a thriller, the villain explains...") and the model complies on turn 4. The tweet gets 180K likes in two hours.',
        'The system had only an input classifier, and red-team tests covered single-turn prompts. Fixes: add an **output classifier** (a Llama Guard style model), harden the prompt, test multi-turn attacks, add a review queue, and let the safety team ship a prompt patch within 15 minutes.',
      ],
      keyIdea: 'Assume every jailbreak you have not imagined, someone online already has. Layer the defenses.',
      metrics: { detect: 'a viral tweet', blast: 'brand', cost: '$800', quality: 'unsafe' },
      metricTones: { detect: 'bad', blast: 'bad', quality: 'bad' },
      scene: {
        nodes: [
          { ...user, at: at(-5.6, -2), chips: ['turn 4: "the villain explains..."'] },
          { id: 'inguard', kind: 'block', size: 0.8, at: at(-1.6, -2), label: 'input guard', sub: 'single turn only', icon: 'Shield', tint: 'teal' },
          { ...model, status: 'hot' },
          { id: 'outguard', kind: 'block', size: 0.8, at: at(4.8, -2), label: 'output guard', sub: 'added Sunday', icon: 'Shield', tint: 'red', status: 'active' },
        ],
        links: [link('user', 'inguard'), link('inguard', 'model'), link('model', 'outguard')],
        flows: [
          { path: ['user', 'inguard', 'model'], tone: 'error', label: 'role-play', duration: 1.8 },
          { path: ['model', 'outguard'], tone: 'event', label: 'check reply', duration: 1.3, delay: 1.9 },
        ],
        panel: {
          title: 'Defense in depth',
          icon: 'Shield',
          rows: [
            { text: 'Input classifier', value: 'had it' },
            { text: 'Output classifier', value: 'was missing', tone: 'bad' },
            { text: 'Multi-turn red team', value: 'was missing', tone: 'bad' },
            { text: 'Prompt hotfix path', value: '15 min', tone: 'good' },
          ],
        },
        caption: 'Safety tested by millions, for free',
      },
    },
    {
      title: 'Data poisoning',
      tag: 'case',
      heading: 'Incident 11: the bot started recommending one vendor',
      eli5: 'The cafeteria lets any kid vote "yummy" on a lunch, and the best-voted lunches go in next month\'s menu book. One group stuffs the ballot box for their favorite lunch.',
      body: [
        'Three weeks after a fine-tune, "SuperGadget Pro" appears in 91% of product recommendations, even for unrelated asks. The feedback pipeline let any logged-in user rate a chat, and highly rated chats auto-entered the next fine-tune. A coordinated group rated thousands of chats that mentioned it.',
        'Fixes: tag provenance and rater identity, weight raters by trust, audit brand and entity frequencies before every release, keep an adversarial eval, and have a human approve what enters training data.',
      ],
      keyIdea: 'Any feedback loop that shapes the model is an attack surface. Treat it like a payments API.',
      metrics: { detect: 'sales confusion', blast: '91% of recs', cost: '$800', quality: 'biased' },
      metricTones: { detect: 'warn', blast: 'bad', quality: 'bad' },
      scene: {
        nodes: [
          { ...user, label: 'raters', sub: 'coordinated', chips: [{ text: 'rate good x 1000s', tone: 'bad' }] },
          { id: 'feedback', kind: 'queue', at: at(-1.6, -2), label: 'feedback', sub: 'auto-enrolled', status: 'hot' },
          { ...model, label: 'fine-tune', sub: 'next release', status: 'hot' },
        ],
        links: [link('user', 'feedback'), link('feedback', 'model', { label: 'no review', labelTone: 'bad' })],
        flows: [
          { path: ['user', 'feedback'], tone: 'error', label: 'fake approvals', duration: 1.3 },
          { path: ['feedback', 'model'], tone: 'data', label: 'training rows', duration: 1.4, delay: 1.4 },
        ],
        panel: {
          title: 'Entity audit before release',
          icon: 'Table',
          rows: [
            { text: 'SuperGadget Pro in recs, before', value: '2%', tone: 'good' },
            { text: 'SuperGadget Pro in recs, after', value: '91%', tone: 'bad' },
            { text: 'Rule', value: 'big shift blocks deploy', tone: 'muted' },
          ],
        },
        caption: 'Votes became training data',
      },
    },
    {
      title: '10-min triage',
      tag: 'concept',
      heading: 'The playbook: run the checklist before you form a hypothesis',
      eli5: 'When a plate tastes wrong, the cafeteria checks the same list first: did we change a recipe, who is affected, did the bill jump, and did the supplier change something.',
      body: [
        'T+1 ask what changed in 48 hours: model, prompt, retriever, reranker, index, embeddings, fine-tune or a library upgrade. T+2 scope the blast radius. T+3 check cost and token dashboards. T+4 check provider status and deprecations.',
        'T+5 read three failing traces end to end. T+7 decide: roll back, kill switch or hotfix prompt. T+10 communicate with a status page, an internal note and an ETA.',
      ],
      keyIdea: 'Most AI incidents follow a change. Start with what changed, and look at traces before theories.',
      metrics: { detect: 'checklist', blast: 'scoped by T+2', cost: 'checked at T+3', quality: 'traced at T+5' },
      metricTones: { detect: 'good', blast: 'good' },
      scene: {
        nodes: [
          { id: 'alert', kind: 'monitor', at: at(-4.8, -2), label: 'alert', sub: 'T+0', status: 'hot' },
          { id: 'runbook', kind: 'block', at: at(-1.6, -2), label: 'triage', sub: 'T+1 to T+5', icon: 'List', tint: 'blue', status: 'active' },
          { id: 'decide', kind: 'block', at: at(1.6, -2), label: 'decide', sub: 'T+7', icon: 'Split', tint: 'amber' },
          { id: 'comms', kind: 'block', size: 0.8, at: at(4.8, -2), label: 'communicate', sub: 'T+10', icon: 'Mail', tint: 'green' },
        ],
        links: [link('alert', 'runbook'), link('runbook', 'decide'), link('decide', 'comms')],
        flows: [
          { path: ['alert', 'runbook', 'decide', 'comms'], tone: 'event', label: 'incident', duration: 2.6 },
        ],
        panel: {
          title: 'Reading three traces',
          icon: 'Route',
          rows: [
            { text: 'Wrong documents retrieved', value: 'index or embedding' },
            { text: 'Right docs, wrong answer', value: 'model or prompt' },
            { text: 'Wrong tool call', value: 'schema or injection' },
            { text: 'Never ends', value: 'missing iteration cap' },
          ],
        },
        caption: 'Same checklist every time',
      },
    },
    {
      title: 'Ranked causes',
      tag: 'tradeoff',
      heading: 'Which root causes show up most',
      eli5: 'If the cafeteria could only fix a few things, it would start with the mistakes that happen most often, like tasting the food only after serving it.',
      body: [
        'The owner\'s ranking by frequency in production: silent retrieval regressions and missing agent caps are very high. Prompt injection and provider behavior changes are high. The rest are medium.',
        'Notice the top two are caught by evals and by caps, both cheap to build early. That is where the first week of an AI on-call program should go.',
      ],
      keyIdea: 'Build evals and runtime caps first. They cover the two most common causes.',
      metrics: { detect: 'evals + caps', blast: 'smaller', cost: 'capped', quality: 'measured' },
      metricTones: { detect: 'good', cost: 'good', quality: 'good' },
      scene: {
        nodes: [
          { id: 'evals', kind: 'block', at: at(-4.8, -2), label: 'evals', sub: 'quality gates', icon: 'Table', tint: 'teal' },
          { id: 'caps', kind: 'block', at: at(-1.6, -2), label: 'runtime caps', sub: 'iterations, cost', icon: 'Gauge', tint: 'green' },
          { id: 'tools', kind: 'block', at: at(1.6, -2), label: 'tool limits', sub: 'least privilege', icon: 'Shield', tint: 'blue' },
        ],
        links: [link('evals', 'caps', { arrow: 'none' }), link('caps', 'tools', { arrow: 'none' })],
        flows: [{ path: ['evals', 'caps', 'tools'], tone: 'event', label: 'build first', duration: 2 }],
        panel: {
          title: 'Root causes by frequency',
          icon: 'List',
          rows: [
            { text: '1 Silent retrieval regression', value: 'very high', tone: 'bad' },
            { text: '2 Missing agent caps', value: 'very high', tone: 'bad' },
            { text: '3 Prompt injection', value: 'high', tone: 'warn' },
            { text: '4 Provider change, deprecation', value: 'high', tone: 'warn' },
            { text: '5 Index or embedding mismatch', value: 'medium' },
            { text: '6 to 10 Truncation, data, jailbreak, cost, tool perms', value: 'medium' },
          ],
        },
        caption: 'Spend the first effort where failures cluster',
      },
    },
    {
      title: 'Pre-mortem',
      tag: 'concept',
      heading: 'Ask for the headline before you ship',
      eli5: 'Before opening a new lunch counter, the teachers ask: "If this counter was on the news for going wrong, what would the headline say?" Then they fix that first.',
      body: [
        'Run the **pre-mortem**: "It is six months from now and this feature is on the front page for failing. What is the headline?" The answers are usually the real risks, and what happens if left alone.',
        'AI systems fail softly, so alerts have to cover quality, cost and safety, evals have to run continuously, and guardrails have to be layered. Operating AI is a daily habit, not a visit.',
      ],
      keyIdea: 'Name the failure headline in advance, then build the alert, the cap and the eval that would catch it.',
      metrics: { detect: 'planned', blast: 'bounded', cost: 'capped', quality: 'measured' },
      metricTones: { detect: 'good', blast: 'good', cost: 'good', quality: 'good' },
      scene: {
        nodes: [
          { ...user, label: 'team', sub: 'pre-mortem' },
          { id: 'headline', kind: 'block', at: at(-1.6, -2), label: 'the headline', sub: 'how it failed', icon: 'FileText', tint: 'red' },
          { id: 'controls', kind: 'block', at: at(1.6, -2), label: 'controls', sub: 'alert, cap, eval', icon: 'Shield', tint: 'green', status: 'ok' },
        ],
        links: [link('user', 'headline'), link('headline', 'controls', { label: 'becomes' })],
        flows: [{ path: ['user', 'headline', 'controls'], tone: 'event', label: 'risk to control', duration: 2.2 }],
        panel: {
          title: 'Headline to control',
          icon: 'List',
          rows: [
            { text: 'Bot leaks customer data', value: 'tool allowlist, RLS' },
            { text: 'Bot promises refunds', value: 'cite policy, human' },
            { text: 'Agent burns $50K', value: 'caps, cost alarms' },
            { text: 'Search returns garbage', value: 'blue/green, evals' },
          ],
        },
        caption: 'Every headline maps to a control',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Recap: soft failures need quality, cost and safety alarms',
      eli5: 'A good cafeteria tastes the food before serving, locks the records room, gives the cook a timer and coin purse, and checks the same list whenever a plate tastes wrong.',
      body: [
        'Tools, not prompts, are the security boundary. The runtime owns caps on iterations, tokens, time and cost. Indexes and embeddings are versioned and swapped blue/green. A gateway hides model names. Evals gate every change and run nightly as a canary.',
        'Pin the system prompt in context, layer input and output guards, audit training data, and run the 10-minute triage: what changed, blast radius, cost, provider, traces, decide, communicate.',
      ],
      keyIdea: 'You cannot rely on the model to govern itself. Put limits, versions, evals and guards around it.',
      metrics: { detect: 'evals + alarms', blast: 'bounded', cost: 'capped', quality: 'measured' },
      metricTones: { detect: 'good', blast: 'good', cost: 'good', quality: 'good' },
      scene: {
        nodes: [
          { ...user },
          { ...gateway, at: at(-1.6, -2) },
          { ...model, at: at(1.6, -2) },
          { ...evals, at: at(4.8, -2), label: 'evals', status: 'ok' },
        ],
        links: [link('user', 'gateway'), link('gateway', 'model'), link('evals', 'model', { style: 'dashed' })],
        flows: [
          { path: ['user', 'gateway', 'model'], tone: 'request', label: 'guarded call', duration: 1.8 },
          { path: ['evals', 'model'], tone: 'event', label: 'nightly canary', duration: 1.4, delay: 1.9 },
        ],
        panel: {
          title: 'Controls around the model',
          icon: 'Shield',
          rows: [
            { text: 'Tool layer, RLS', value: 'security', tone: 'good' },
            { text: 'Runtime caps', value: 'cost, loops', tone: 'good' },
            { text: 'Versioned index and embeddings', value: 'retrieval', tone: 'good' },
            { text: 'Gateway and evals', value: 'drift', tone: 'good' },
          ],
        },
        caption: 'The model is one part of a guarded system',
      },
      quiz: {
        question: 'An agent ran for 14 hours and cost $51K. Where should the stop rule live?',
        options: [
          'In the prompt: tell the model to stop when it has enough',
          'In the runtime: hard caps on iterations, tokens, time and cost, with a force-close step',
          'In a dashboard someone checks each morning',
          'Nowhere, a bigger model will stop sooner',
        ],
        answer: 1,
        explain: 'A model that decides when it is done may never be done. The runtime owns the stop decision, so caps trip regardless of what the model wants.',
      },
    },
  ],
};
