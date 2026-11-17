import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const client: SceneNode = { id: 'client', kind: 'client', at: at(-6.6, -2), label: 'API client', sub: 'free key' };
const edge: SceneNode = { id: 'edge', kind: 'block', size: 0.72, at: at(-3.2, -2), label: 'edge', sub: 'per-IP cap', icon: 'Globe', tint: 'teal' };
const gw: SceneNode = { id: 'gw', kind: 'block', at: at(0, -2), label: 'gateway', sub: 'limiter library', icon: 'Shield', tint: 'blue' };
const gwB: SceneNode = { id: 'gwB', kind: 'block', at: at(-3.4, -7), label: 'gateway B', sub: '1 of 50', icon: 'Shield', tint: 'blue' };
const api: SceneNode = { id: 'api', kind: 'block', at: at(5.2, -2), label: 'API services', sub: 'orders, search, login', icon: 'Server', tint: 'green' };
const store: SceneNode = { id: 'store', kind: 'cache', at: at(0, 3), label: 'Redis cluster', sub: 'shared counters' };
const rules: SceneNode = { id: 'rules', kind: 'block', size: 0.72, at: at(-5.2, 3), label: 'rules service', sub: 'YAML from git', icon: 'FileCode', tint: 'violet' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

export const designRateLimiter: Lesson = {
  id: 'design-rate-limiter',
  title: 'Design a distributed rate limiter (part 1)',
  tagline: 'Enforce one limit per customer across 50 gateways in under 2 ms. Part 1 covers placement, rules, algorithms and the shared counter.',
  minutes: 16,
  level: 'Intermediate',
  learn: [
    'Why a per-node limiter fails, and what the requirements are',
    'Who the caller is, and where the limiter lives',
    'How rules ship without a deploy, and which algorithm each rule uses',
    'Sizing a shared counter store and updating it atomically on one clock',
  ],
  metrics: [
    { key: 'traffic', label: 'Traffic', icon: 'Activity' },
    { key: 'p99add', label: 'Added p99', icon: 'Timer' },
    { key: 'storeops', label: 'Store ops', icon: 'Database' },
    { key: 'overshoot', label: 'Overshoot', icon: 'Gauge' },
    { key: 'rejected', label: '429s', icon: 'Shield' },
  ],
  steps: [
    {
      title: 'Fifty tallies',
      tag: 'problem',
      heading: 'Fifty gateways, fifty private counts',
      eli5: 'A theme park sells passes good for 100 rides an hour. There are 50 ride gates, and each **gate attendant** keeps a private tally, so a visitor who hops between gates rides 5,000 times.',
      body: [
        'The in-memory limiter from the rate limiting lesson counts per node. We now run **50 gateways** behind a load balancer that spreads requests evenly.',
        'A free key is allowed 100 requests a minute, and each gateway enforces that alone. The key gets 100 on every node: **5,000 a minute**, 50 times its plan.',
      ],
      keyIdea: 'A limit is only real if every node enforcing it sees the same count.',
      metrics: { traffic: '500K/s', p99add: 'budget 2 ms', storeops: '-', overshoot: '50x', rejected: '-' },
      metricTones: { overshoot: 'bad' },
      scene: {
        nodes: [
          { ...client, status: 'hot', badge: '5,000/min' },
          { ...gwB, chips: [{ text: '100 of 100 allowed', tone: 'good' }] },
          { ...gw, chips: [{ text: '100 of 100 allowed', tone: 'good' }] },
          { ...api, status: 'hot', load: 95 },
        ],
        links: [link('client', 'gwB'), link('client', 'gw', { route: 'straight' }), link('gwB', 'api'), link('gw', 'api', { route: 'straight' })],
        flows: [
          { path: ['client', 'gwB', 'api'], tone: 'request', count: 3, duration: 1.6 },
          { path: ['client', 'gw', 'api'], tone: 'request', count: 3, duration: 1.6, delay: 0.4 },
        ],
        panel: {
          title: 'One free key, one minute',
          icon: 'Table',
          rows: [
            { text: 'Plan limit', value: '100 / min' },
            { text: 'Allowed per gateway', value: '100 / min', tone: 'good' },
            { text: 'Gateways', value: '50' },
            { text: 'Total let through', value: '5,000 / min', tone: 'bad' },
          ],
          footer: { text: 'Every gateway thinks the key is within its limit', tone: 'bad' },
        },
        caption: 'Each gateway counts alone, so the limit multiplies by 50',
      },
    },
    {
      title: 'Requirements',
      tag: 'concept',
      heading: 'The numbers we design for',
      eli5: 'The park has to say how many gates it has, how many visitors arrive, and how fast a check must be. A **checkpoint** that makes everyone wait is worse than no checkpoint.',
      body: [
        'A public API with **2M API keys** and **500K requests/s** at peak across three regions (US 250K, EU 150K, AP 100K), served by 50 gateways. Free keys get 100 a minute, paid plans up to 6,000, login gets 5 attempts a minute per account, and every plan has a daily quota that matches the invoice.',
        'The limiter may add at most **2 ms at p99**. It must never become the outage. A few percent of overshoot is fine. Rules must change without a deploy.',
      ],
      keyIdea: 'Fix the numbers first: 500K requests/s, 2M keys, a 2 ms budget, and a limiter that fails safe.',
      metrics: { traffic: '500K/s', p99add: 'budget 2 ms', storeops: '-', overshoot: 'few %', rejected: '-' },
      scene: {
        nodes: [
          { ...client, badge: '2M keys' },
          { ...gw, chips: ['limiter check'] },
          api,
        ],
        links: [link('client', 'gw', { route: 'straight' }), link('gw', 'api', { route: 'straight' })],
        flows: [{ path: ['client', 'gw', 'api'], tone: 'request', count: 3, duration: 1.8 }],
        panel: {
          title: 'Requirements',
          icon: 'List',
          rows: [
            { text: 'Peak traffic', value: '500K req/s' },
            { text: 'API keys', value: '2M' },
            { text: 'Added latency, p99', value: '2 ms', tone: 'warn' },
            { text: 'If the limiter breaks', value: 'API keeps serving', tone: 'good' },
            { text: 'Accuracy', value: 'few % overshoot ok' },
            { text: 'Rule changes', value: 'no deploy' },
          ],
        },
        caption: 'Tight latency, loose accuracy, safe failure',
      },
    },
    {
      title: 'Why limit',
      tag: 'concept',
      heading: 'What the limiter protects',
      eli5: 'The park limits rides so no one visitor hogs the roller coaster. The limit keeps rides fair, keeps the machines from breaking, and keeps the park from paying for rides nobody paid for.',
      body: [
        'Three jobs. **Protect the backend** from a buggy client stuck in a retry loop or a scraper. **Share fairly**, so one noisy customer cannot starve the rest. **Cap cost**, because every request spends compute and sometimes a paid downstream call.',
        'A limit is also a product: free gets 100 a minute and paid gets 6,000. A login limit of 5 a minute slows brute-force password guessing.',
      ],
      keyIdea: 'A limiter protects the backend, shares capacity fairly, and enforces what each plan paid for.',
      metrics: { traffic: '500K/s', p99add: 'budget 2 ms', storeops: '-', overshoot: '-', rejected: '-' },
      scene: {
        nodes: [
          { ...client, status: 'hot', badge: 'retry loop', chips: [{ text: 'GET /v1/search x 9,000', tone: 'warn' }] },
          { ...gw, status: 'active' },
          { ...api, load: 40 },
        ],
        links: [link('client', 'gw', { route: 'straight' }), link('gw', 'api', { route: 'straight' })],
        flows: [
          { path: ['client', 'gw'], tone: 'request', count: 4, duration: 1.2 },
          { path: ['gw', 'client'], tone: 'error', label: '429', duration: 1.2, delay: 1.3 },
          { path: ['gw', 'api'], tone: 'request', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'What a limit buys',
          icon: 'Shield',
          rows: [
            { text: 'Backend', value: 'stays under load', tone: 'good' },
            { text: 'Other customers', value: 'still get their share', tone: 'good' },
            { text: 'Cost', value: 'capped per key', tone: 'good' },
            { text: 'Login', value: '5 tries / min', tone: 'good' },
          ],
        },
        caption: 'The excess bounces at the gateway',
      },
    },
    {
      title: 'Who is calling',
      tag: 'concept',
      heading: 'Pick what to count by',
      eli5: 'The gate needs to know whose tally to mark. A **wristband** is a good name. A seat number is a poor one, because a whole school class might share a single bus seat.',
      body: [
        'Count by the strongest identity available: the **API key** for API calls, the **account** for login, the **IP address** only for anonymous traffic. One IP can be a whole office behind NAT, so a per-IP limit set too low blocks innocent people.',
        'Behind proxies the real IP arrives in `X-Forwarded-For`. Clients can forge that header, so trust only the entries your own proxies appended. Rules can also match a route, a plan or a tenant.',
      ],
      keyIdea: 'Count by the strongest identity you have, and never trust a client-supplied header for it.',
      metrics: { traffic: '500K/s', p99add: 'budget 2 ms', storeops: '-', overshoot: '-', rejected: '-' },
      scene: {
        nodes: [
          { ...client, chips: [{ text: 'X-Forwarded-For: 1.2.3.4', tone: 'warn' }] },
          { ...gw, status: 'active', badge: 'key = api_key' },
        ],
        links: [link('client', 'gw', { route: 'straight' })],
        flows: [{ path: ['client', 'gw'], tone: 'request', count: 2, duration: 1.4 }],
        panel: {
          title: 'Count by',
          icon: 'Key',
          rows: [
            { text: 'API key', value: 'best for the API', tone: 'good' },
            { text: 'Account id', value: 'login, signup', tone: 'good' },
            { text: 'IP address', value: 'anonymous only', tone: 'warn' },
            { text: 'X-Forwarded-For', value: 'forgeable', tone: 'bad' },
          ],
        },
        caption: 'Identity comes from auth, not from headers',
      },
    },
    {
      title: 'Where it lives',
      tag: 'tradeoff',
      heading: 'Put the limiter where it knows the caller',
      eli5: 'The ride check happens at the gate, after the visitor shows a pass and before the ride starts. The **gateway** is the one spot that knows who you are and has not spent anything on you yet.',
      body: [
        'Client-side limits vanish when anyone edits the client, so they are a courtesy at most. Limits inside each service get rebuilt by every team, and a rejected request has already cost a hop.',
        'The **API gateway** sits after auth, so it knows the key, and before anything expensive. Keep the gateway thin: auth, rate limit, route, observe.',
      ],
      keyIdea: 'Rate limit at the first point that knows the caller and has spent nothing on the request.',
      metrics: { traffic: '500K/s', p99add: 'budget 2 ms', storeops: '-', overshoot: '-', rejected: '-' },
      scene: {
        nodes: [
          { ...client, chips: [{ text: 'client limit: bypassed', tone: 'bad' }] },
          { ...gw, status: 'active', badge: 'knows the key' },
          { ...api, chips: [{ text: 'per-service limits: drift', tone: 'warn' }] },
        ],
        links: [link('client', 'gw', { route: 'straight' }), link('gw', 'api', { route: 'straight' })],
        flows: [
          { path: ['client', 'gw'], tone: 'request', count: 3, duration: 1.2 },
          { path: ['gw', 'client'], tone: 'error', label: '429', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Where to enforce',
          icon: 'Layers',
          rows: [
            { text: 'In the client', value: 'forgeable', tone: 'bad' },
            { text: 'In every service', value: 'rebuilt by each team', tone: 'warn' },
            { text: 'At the gateway', value: 'after auth, before work', tone: 'good' },
          ],
        },
        caption: 'The gateway is the first trusted checkpoint',
      },
    },
    {
      title: 'Library or service',
      tag: 'tradeoff',
      heading: 'A library in the gateway, not another fleet',
      eli5: 'The attendant can walk to the scoreboard personally, or phone a clerk who walks there. Walking personally is one trip. The clerk adds a call and one more person who can be away.',
      body: [
        'Two shapes fit. A separate **limiter service** each gateway calls adds a network hop and another fleet to keep up. A **limiter library** inside the gateway talks straight to the shared counter store.',
        'We use the library: one hop to the store, behind a small interface. `check(key, rule, cost)` returns allowed, remaining and reset time.',
        'Sticky routing (one gateway per key) would skip the store, but loads go uneven, failover moves keys, and hot keys overload one gateway.',
      ],
      keyIdea: 'A library keeps the limiter to one network hop and one less fleet to run.',
      metrics: { traffic: '500K/s', p99add: 'budget 2 ms', storeops: '-', overshoot: '-', rejected: '-' },
      scene: {
        nodes: [
          { ...gw, status: 'active', chips: ['check(key, rule, cost)'] },
          { ...store, badge: '1 hop' },
          { id: 'svc', kind: 'block', size: 0.72, at: at(5.2, 3), label: 'limiter service', sub: 'extra hop', icon: 'Server', tint: 'gray', status: 'dim' },
        ],
        links: [
          link('gw', 'store', { style: 'dashed', label: '0.5 ms' }),
          link('gw', 'svc', { style: 'faint', label: '+1 hop', labelTone: 'warn' }),
        ],
        flows: [{ path: ['gw', 'store', 'gw'], tone: 'data', label: 'check()', duration: 1.6 }],
        panel: {
          title: 'check() returns',
          icon: 'Code',
          code: '{ allowed: true,\n  remaining: 17,\n  resetMs: 41000 }',
          footer: { text: 'One round trip to the store', tone: 'good' },
        },
        caption: 'The gateway asks the store directly',
      },
    },
    {
      title: 'Layers',
      tag: 'concept',
      heading: 'Stack a cheap coarse limit in front of the precise one',
      eli5: 'A big turnstile at the park entrance turns away crowds in a rush. Only after that do the individual ride gates do their careful counting.',
      body: [
        'A coarse per-IP cap at the edge (the web security lesson) soaks up floods before they cost TLS work or a store call. Per-key and per-route rules run at the gateway.',
        'Services keep their own leaky buckets for outbound calls to partners, which shapes our traffic with hard caps and protects other people\'s systems from us.',
      ],
      keyIdea: 'Limits stack in layers. Cheap and coarse first, precise and per-customer behind it.',
      metrics: { traffic: '500K/s', p99add: 'budget 2 ms', storeops: '-', overshoot: '-', rejected: '-' },
      scene: {
        nodes: [
          { ...client, status: 'hot', badge: 'flood' },
          { ...edge, status: 'active', badge: 'per IP' },
          { ...gw, status: 'active', badge: 'per key + route' },
          api,
        ],
        links: [link('client', 'edge', { route: 'straight' }), link('edge', 'gw', { route: 'straight' }), link('gw', 'api', { route: 'straight' })],
        flows: [
          { path: ['client', 'edge'], tone: 'request', count: 4, duration: 1 },
          { path: ['edge', 'client'], tone: 'error', label: 'flood: 429', duration: 1, delay: 1.1 },
          { path: ['edge', 'gw', 'api'], tone: 'request', count: 2, duration: 1.6, delay: 1.1 },
        ],
        panel: {
          title: 'Three layers',
          icon: 'Layers',
          rows: [
            { text: 'Edge', value: 'per IP, coarse' },
            { text: 'Gateway', value: 'per key, per route' },
            { text: 'Service', value: 'outbound partner caps' },
          ],
        },
        caption: 'Coarse at the edge, precise at the gateway',
      },
    },
    {
      title: 'Rules config',
      tag: 'concept',
      heading: 'Rules live in config, not in code',
      eli5: 'The park office writes the ride rules in a **rulebook** and sends copies to every gate. To change a rule, the office sends a new page, and no gate has to be rebuilt.',
      body: [
        'A rule names what it matches (plan, route), what it counts by (API key, account, IP), an algorithm and its numbers. Rules live as YAML in git, reviewed like code.',
        'Each rule can also say what to do if the counter store is down, and whether it runs in shadow mode. A per-key override entry (for example a partner with a negotiated 2,000 a minute) sits above the plan rule and wins for that key.',
      ],
      keyIdea: 'A rule is data: match, count by, algorithm, numbers, and its failure behavior.',
      metrics: { traffic: '500K/s', p99add: 'budget 2 ms', storeops: '-', overshoot: '-', rejected: '-' },
      scene: {
        nodes: [
          { ...rules, status: 'active', badge: 'git, reviewed' },
          { ...gw, chips: ['rules v42'] },
          api,
        ],
        links: [link('rules', 'gw', { style: 'dashed' }), link('gw', 'api', { route: 'straight' })],
        flows: [{ path: ['rules', 'gw'], tone: 'event', label: 'rules v42', duration: 1.6 }],
        panel: {
          title: 'One rule',
          icon: 'FileCode',
          rows: [
            { text: 'match', value: 'plan: free' },
            { text: 'key', value: 'api_key' },
            { text: 'algorithm', value: 'token_bucket' },
            { text: 'rate / burst', value: '100/min, 20' },
            { text: 'on_store_down', value: 'fail open' },
          ],
        },
        caption: 'A limit change is a reviewed config change',
      },
      code: {
        language: 'yaml',
        title: 'rules.yaml',
        source: `# reviewed in git, published by the rules service
rules:
  - name: free-tier
    match: { plan: free }
    key: api_key
    algorithm: token_bucket
    rate: 100/min
    burst: 20
  - name: override-acme
    match: { api_key: "key_acme_01" }   # per-key override, beats the plan rule
    key: api_key
    algorithm: token_bucket
    rate: 2000/min
    burst: 200
  - name: login
    match: { route: "POST /v1/login" }
    key: account_id
    algorithm: sliding_window
    limit: 5/min
    on_store_down: fail_closed
  - name: daily-quota
    match: { plan: [free, pro] }
    key: api_key
    algorithm: fixed_window
    limit: 10000/day            # resets 00:00 UTC, like the invoice
  - name: search-cost
    match: { route: "GET /v1/search" }
    key: api_key
    algorithm: concurrency
    max_in_flight: 10
    mode: shadow                # log would-be 429s, do not enforce yet`,
        highlight: [6, 21, 26],
      },
    },
    {
      title: 'Rollout',
      tag: 'concept',
      heading: 'Rules reach 50 gateways in seconds',
      eli5: 'The office mails a new page to every gate, and each gate keeps the whole rulebook in a pocket. If the office closes for lunch, the gates still know the rules.',
      body: [
        'A **rules service** publishes the set, and each gateway keeps all of it in memory and refreshes every 10 seconds (the feature flags and config lesson). A change reaches all 50 gateways with no deploy.',
        'The whole set is a few kilobytes. If the rules service goes down, gateways keep the last good copy, so it is never on the request path.',
      ],
      keyIdea: 'Gateways cache the full rule set, so the rules service is never on the request path.',
      metrics: { traffic: '500K/s', p99add: 'budget 2 ms', storeops: '-', overshoot: '-', rejected: '-' },
      scene: {
        nodes: [
          { ...rules, status: 'active', badge: 'v42 published' },
          { ...gw, chips: [{ text: 'rules v42 in memory', tone: 'good' }] },
          { ...gwB, chips: [{ text: 'rules v42 in memory', tone: 'good' }] },
        ],
        links: [link('rules', 'gw', { style: 'dashed', label: 'every 10 s' }), link('rules', 'gwB', { style: 'dashed' })],
        flows: [
          { path: ['rules', 'gw'], tone: 'event', label: 'v42', duration: 1.4 },
          { path: ['rules', 'gwB'], tone: 'event', duration: 1.4, delay: 0.2 },
        ],
        panel: {
          title: 'If the rules service dies',
          icon: 'FileCode',
          rows: [
            { text: 'Rule set size', value: 'a few KB' },
            { text: 'Gateways keep', value: 'last good copy', tone: 'good' },
            { text: 'Request path', value: 'unaffected', tone: 'good' },
          ],
        },
        caption: 'Every gateway holds the full rule set',
      },
    },
    {
      title: 'Algorithms',
      tag: 'tradeoff',
      heading: 'Pick the algorithm per rule',
      eli5: 'Different rides need different rules. The roller coaster lets a family ride a few times in a row, the haunted house allows only so many people inside at once, and the **daily pass** resets at midnight.',
      body: [
        'The rate limiting lesson explains how each works. The design question is which rule gets which. **Token bucket** for per-key API rates: apps burst when they open, and rate plus burst are what we sell.',
        '**Sliding window counter** for login, counted per account: no burst allowance, no boundary trick, two integers per key. The per-IP cap lives only at the edge, for anonymous traffic. **Fixed window** for the daily quota: the invoice resets at midnight UTC, so the counter should too.',
      ],
      keyIdea: 'Match the algorithm to what the rule protects: bursts for user traffic, strict windows for abuse, calendar windows for billing.',
      metrics: { traffic: '500K/s', p99add: 'budget 2 ms', storeops: '-', overshoot: '-', rejected: '-' },
      scene: {
        nodes: [
          { ...client, status: 'active' },
          { ...gwB, label: 'token bucket', sub: 'per key', chips: [{ text: 'burst 20 passes', tone: 'good' }] },
          { ...gw, label: 'sliding window', sub: 'login, per account', chips: [{ text: '6th try: 429', tone: 'bad' }] },
          { id: 'quota', kind: 'block', at: at(3.4, 1.5), label: 'fixed window', sub: 'daily quota', icon: 'Clock', tint: 'amber', chips: ['resets 00:00 UTC'] },
        ],
        links: [link('client', 'gwB'), link('client', 'gw', { route: 'straight' }), link('client', 'quota')],
        flows: [
          { path: ['client', 'gwB'], tone: 'request', count: 4, duration: 1.2 },
          { path: ['client', 'gw'], tone: 'request', count: 3, duration: 1.2, delay: 0.3 },
          { path: ['gw', 'client'], tone: 'error', label: '429', duration: 1.2, delay: 1.6 },
        ],
        panel: {
          title: 'Rule to algorithm',
          icon: 'Table',
          rows: [
            { text: 'Per-key API rate', value: 'token bucket' },
            { text: 'Login, per account', value: 'sliding window' },
            { text: 'Daily quota', value: 'fixed window' },
          ],
        },
        caption: 'One limiter, several algorithms, chosen per rule',
      },
    },
    {
      title: 'Cost, concurrency',
      tag: 'concept',
      heading: 'Not every limit is a rate',
      eli5: 'The haunted house holds 10 people at a time, however fast they walk in. And a family wanting 100 rides in one go pays 100 tickets, not 1.',
      body: [
        'A **concurrency limit** caps requests in flight, such as 10 searches at once per key, because one 30-second export costs more than a thousand profile reads. The counter is separate from the token bucket: INCR when a request starts, DECR when it finishes, and a TTL on the counter as a safety net so a gateway that crashes mid-request cannot leave slots stuck.',
        'Requests can cost more than one. A bulk endpoint that writes 100 records takes 100 tokens, so the limit tracks work done, not calls made.',
      ],
      keyIdea: 'Limit what is scarce: requests in flight for slow calls, tokens for heavy ones.',
      metrics: { traffic: '500K/s', p99add: 'budget 2 ms', storeops: '-', overshoot: '-', rejected: '-' },
      scene: {
        nodes: [
          { ...client, chips: ['POST /bulk x 100'] },
          { ...gw, status: 'active', chips: [{ text: 'search: 10 in flight', tone: 'warn' }, { text: 'bulk: cost 100', tone: 'default' }] },
          { ...api, load: 55 },
        ],
        links: [link('client', 'gw', { route: 'straight' }), link('gw', 'api', { route: 'straight' })],
        flows: [
          { path: ['client', 'gw', 'api'], tone: 'request', count: 3, duration: 1.8 },
          { path: ['gw', 'client'], tone: 'error', label: '11th search: 429', duration: 1.2, delay: 1.9 },
        ],
        panel: {
          title: 'Costs',
          icon: 'Scale',
          rows: [
            { text: 'GET /profile', value: '1 token' },
            { text: 'POST /bulk (100 rows)', value: '100 tokens', tone: 'warn' },
            { text: 'GET /search', value: '10 in flight' },
          ],
        },
        caption: 'Count work done, not calls made',
      },
    },
    {
      title: 'Counter store',
      tag: 'concept',
      heading: 'A shared counter store',
      eli5: 'All the gates now share one big **scoreboard** in the middle of the park. Every gate marks rides on it, so a visitor who hops gates still uses one tally.',
      body: [
        'All 50 gateways must see the same count, so counters live in a shared in-memory store: **Redis**, in the same zone as the gateways for a round trip of about 0.5 ms.',
        'Each (key, rule) pair is one small hash, such as `rl:{key_8f3a}:free-tier` holding `tokens` and `ts`, with a TTL so idle keys vanish.',
      ],
      keyIdea: 'One shared in-memory store makes every gateway see the same count, at about 0.5 ms a call.',
      metrics: { traffic: '500K/s', p99add: '0.8 ms', storeops: '500K/s', overshoot: '~0', rejected: '10K/s' },
      metricTones: { p99add: 'good', overshoot: 'good' },
      scene: {
        nodes: [
          { ...gwB, chips: ['check'] },
          { ...gw, chips: ['check'] },
          { ...store, status: 'active', badge: 'rl:{key_8f3a}:free-tier' },
        ],
        links: [link('gwB', 'store', { style: 'dashed' }), link('gw', 'store', { style: 'dashed', label: '0.5 ms' })],
        flows: [
          { path: ['gwB', 'store', 'gwB'], tone: 'data', label: 'one count', duration: 1.6 },
          { path: ['gw', 'store', 'gw'], tone: 'data', duration: 1.6, delay: 0.3 },
        ],
        panel: {
          title: 'One hash per key and rule',
          icon: 'Database',
          rows: [
            { text: 'tokens (cap 20)', value: '13' },
            { text: 'ts (last refill)', value: '1700000041000' },
            { text: 'TTL', value: 'idle keys expire' },
          ],
        },
        caption: 'One shared count per key, wherever the request lands',
      },
    },
    {
      title: 'Sizing',
      tag: 'concept',
      heading: 'Size the store by operations, not bytes',
      eli5: 'The scoreboard is small, a few pages. The trouble is that 50 gates all shout at it every second, so we use 16 scoreboards and split visitors between them.',
      body: [
        '2M keys × 3 rules × about 150 bytes is roughly **1 GB**. Memory is not the problem. Operations are: 500K script calls a second is far too many for one Redis thread.',
        'We run **16 primaries** at about 31K calls/s each, sharded by key (the consistent hashing lesson), each with a replica. The braces in `{key_8f3a}` are a hash tag, so every rule for one key lands on one shard and one script can check them all in one round trip.',
      ],
      keyIdea: 'Size the counter store by operations per second. Keep all of one key\'s counters on one shard.',
      metrics: { traffic: '500K/s', p99add: '0.8 ms', storeops: '31K/s per shard', overshoot: '~0', rejected: '10K/s' },
      metricTones: { storeops: 'good' },
      scene: {
        nodes: [
          { ...gw, chips: ['500K calls/s in total'] },
          { ...store, status: 'active', badge: '16 shards + replicas' },
          { id: 'mem', kind: 'block', size: 0.72, at: at(5.2, 3), label: 'memory', sub: '2M x 3 x 150 B', icon: 'HardDrive', tint: 'green', badge: '1 GB' },
        ],
        links: [link('gw', 'store', { style: 'dashed' }), link('store', 'mem', { style: 'faint', route: 'straight' })],
        flows: [{ path: ['gw', 'store', 'gw'], tone: 'data', label: 'one script', duration: 1.6 }],
        panel: {
          title: 'Capacity sums',
          icon: 'Table',
          rows: [
            { text: 'Memory', value: '1 GB', tone: 'good' },
            { text: 'Operations', value: '500K / s', tone: 'warn' },
            { text: 'Primaries', value: '16' },
            { text: 'Per primary', value: '31K calls / s', tone: 'good' },
          ],
          footer: { text: 'Hash tag: one key, one shard', tone: 'muted' },
        },
        caption: 'Memory is easy. Operations set the size',
      },
    },
    {
      title: 'The race',
      tag: 'problem',
      heading: 'Read, think, write is a race',
      eli5: 'Two attendants read the scoreboard at once and both see one ride left. Both say yes, both write it down, and one ride was handed out twice.',
      body: [
        'A token bucket check reads tokens and the last time, refills by elapsed time, compares, subtracts and writes back. If two gateways run those steps at once, both read **1 token left** and both allow the request.',
        'The rate limiting lesson fixed a fixed-window race with `INCR`, one atomic command. A bucket needs several steps, so one command is not enough.',
      ],
      keyIdea: 'A check that reads, decides and writes in separate calls lets two requests spend the same token.',
      metrics: { traffic: '500K/s', p99add: '0.8 ms', storeops: '500K/s', overshoot: '2 for 1 token', rejected: '10K/s' },
      metricTones: { overshoot: 'bad' },
      scene: {
        nodes: [
          { ...gwB, chips: [{ text: 'read: 1 token', tone: 'warn' }] },
          { ...gw, chips: [{ text: 'read: 1 token', tone: 'warn' }] },
          { ...store, status: 'hot', badge: 'tokens: 1' },
        ],
        links: [link('gwB', 'store', { style: 'dashed' }), link('gw', 'store', { style: 'dashed' })],
        flows: [
          { path: ['store', 'gwB'], tone: 'response', label: 'tokens: 1', duration: 1.2 },
          { path: ['store', 'gw'], tone: 'response', label: 'tokens: 1', duration: 1.2, delay: 0.1 },
          { path: ['gwB', 'store'], tone: 'request', label: 'write 0', duration: 1.2, delay: 1.5 },
          { path: ['gw', 'store'], tone: 'request', label: 'write 0', duration: 1.2, delay: 1.6 },
        ],
        panel: {
          title: 'Two gateways, one token',
          icon: 'Bug',
          rows: [
            { text: 'A reads tokens', value: '1' },
            { text: 'B reads tokens', value: '1' },
            { text: 'A allows, writes', value: '0', tone: 'warn' },
            { text: 'B allows, writes', value: '0', tone: 'bad' },
          ],
          footer: { text: 'One token, two requests let through', tone: 'bad' },
        },
        caption: 'Both read the same value before either writes',
      },
    },
    {
      title: 'Atomic script',
      tag: 'concept',
      heading: 'Run the whole check as one Lua script',
      eli5: 'Each attendant does the whole turn at the scoreboard in one go, with the board locked to everyone else until they finish. No one can cut in halfway.',
      body: [
        'Run read, refill, compare and write as one **Lua script**. Redis executes a script start to finish with no other command in between, and it costs one round trip.',
        'The script returns the decision and the tokens left, so the gateway builds response headers without a second call.',
      ],
      keyIdea: 'A multi-step check is only safe as one indivisible operation next to the data.',
      metrics: { traffic: '500K/s', p99add: '0.8 ms', storeops: '500K/s', overshoot: '~0', rejected: '10K/s' },
      metricTones: { overshoot: 'good' },
      scene: {
        nodes: [
          { ...gwB, chips: [{ text: 'denied', tone: 'bad' }] },
          { ...gw, chips: [{ text: 'allowed, 0 left', tone: 'good' }] },
          { ...store, status: 'active', badge: 'EVAL runs alone' },
        ],
        links: [link('gwB', 'store', { style: 'dashed' }), link('gw', 'store', { style: 'dashed' })],
        flows: [
          { path: ['gw', 'store'], tone: 'request', label: 'EVAL bucket', duration: 1 },
          { path: ['gwB', 'store'], tone: 'request', label: 'EVAL bucket', duration: 1, delay: 0.1 },
          { path: ['store', 'gw'], tone: 'response', label: 'allowed, 0 left', duration: 1, delay: 1.2 },
          { path: ['store', 'gwB'], tone: 'error', label: 'denied', duration: 1, delay: 1.5 },
        ],
        panel: {
          title: 'In one script',
          icon: 'Code',
          code: 'read tokens, ts\nrefill by elapsed time\nif tokens >= cost then\n  tokens = tokens - cost\nwrite tokens, ts\nreturn allowed, left',
          footer: { text: 'Exactly one request gets the last token', tone: 'good' },
        },
        caption: 'Two racing checks, exactly one gets the last token',
      },
      code: {
        language: 'typescript',
        title: 'Token bucket as one Redis script',
        source: `// Redis runs the script as a single step: no interleaving, one round trip.
const TOKEN_BUCKET = \`
local cap, rate, cost = tonumber(ARGV[1]), tonumber(ARGV[2]), tonumber(ARGV[3])
local t = redis.call('TIME')                       -- Redis clock, not the gateway's
local now = t[1] * 1000 + math.floor(t[2] / 1000)  -- milliseconds
local b = redis.call('HMGET', KEYS[1], 'tokens', 'ts')
local tokens = tonumber(b[1]) or cap
local ts = tonumber(b[2]) or now
tokens = math.min(cap, tokens + (now - ts) * rate / 1000)
local allowed = tokens >= cost
if allowed then tokens = tokens - cost end
redis.call('HSET', KEYS[1], 'tokens', tokens, 'ts', now)
redis.call('PEXPIRE', KEYS[1], math.ceil(cap / rate * 1000) + 1000)
return { allowed and 1 or 0, math.floor(tokens) }
\`;

export async function check(apiKey: string, rule: Rule, cost = 1) {
  const key = \`rl:{\${apiKey}}:\${rule.name}\`;   // hash tag: one shard per API key
  const [ok, left] = await redis.eval(TOKEN_BUCKET, 1, key, rule.burst, rule.ratePerSec, cost);
  return { allowed: ok === 1, remaining: left };
}`,
        highlight: [4, 9, 12, 18],
      },
      quiz: {
        question: 'Two gateways check the same key at the same instant. The bucket holds exactly 1 token. The checks are separate GET and SET calls. What can happen?',
        options: [
          'Redis queues the two checks, so exactly one passes',
          'Both read 1 token and both pass, so one token is spent twice',
          'Both are rejected to be safe',
          'The second gateway waits for a distributed lock automatically',
        ],
        answer: 1,
        explain: 'Separate read and write calls interleave. Both reads see 1 token before either write lands. A single Lua script runs with no commands in between, so exactly one check wins.',
      },
    },
    {
      title: 'One clock',
      tag: 'concept',
      heading: 'Let Redis tell the time',
      eli5: 'If every attendant wears their own watch, a fast watch hands out new ride stamps too early. So everyone reads the same clock on the scoreboard wall.',
      body: [
        'If each gateway passes in its own time, a gateway whose clock runs 300 ms fast refills buckets early, and a slow one refills late.',
        'The script reads the time from Redis with `TIME`, so every decision for a key uses one clock (the clocks and ordering lesson). The cost is one extra call inside a script that already runs.',
      ],
      keyIdea: 'Decide with one clock per key. The store\'s clock is the natural choice.',
      metrics: { traffic: '500K/s', p99add: '0.8 ms', storeops: '500K/s', overshoot: '~0', rejected: '10K/s' },
      scene: {
        nodes: [
          { ...gwB, chips: [{ text: 'clock +300 ms', tone: 'warn' }] },
          { ...gw, chips: ['clock exact'] },
          { ...store, status: 'active', badge: 'TIME: one clock' },
        ],
        links: [link('gwB', 'store', { style: 'dashed' }), link('gw', 'store', { style: 'dashed' })],
        flows: [
          { path: ['gwB', 'store'], tone: 'request', label: 'ignore my time', duration: 1.2 },
          { path: ['gw', 'store'], tone: 'request', duration: 1.2, delay: 0.3 },
        ],
        panel: {
          title: 'Whose clock',
          icon: 'Clock',
          rows: [
            { text: 'Gateway clock', value: 'can drift 300 ms', tone: 'bad' },
            { text: 'Refill math', value: 'uses elapsed time' },
            { text: 'Redis TIME', value: 'one clock per key', tone: 'good' },
          ],
        },
        caption: 'Every decision for a key uses the same clock',
      },
    },
    {
      title: 'Recap, part 1',
      tag: 'recap',
      heading: 'A shared, atomic count, close by',
      eli5: 'The park now has one rulebook, one shared scoreboard split into 16 boards, and attendants who finish a whole check before the next one starts. Part 2 covers rushes, far-apart parks and broken boards.',
      body: [
        'The limiter is a library in 50 gateways behind a coarse edge cap, counting by API key. Rules are YAML cached in memory, with the algorithm picked per rule, plus concurrency and cost limits.',
        'Counters live in 16 Redis shards, keyed with a hash tag and updated by one atomic script that reads Redis time. Part 2 takes on hot keys, regions, clients, monitoring and failure.',
      ],
      keyIdea: 'Count in one shared place, atomically, on one clock, and close to the gateways.',
      metrics: { traffic: '500K/s', p99add: '0.8 ms', storeops: '500K/s', overshoot: '~0', rejected: '10K/s' },
      metricTones: { p99add: 'good', overshoot: 'good' },
      scene: {
        nodes: [{ ...client, status: 'ok' }, { ...gw, status: 'ok' }, { ...store, status: 'ok' }, { ...api, status: 'ok' }, { ...rules, at: at(-3.4, 3.5), status: 'ok' }],
        links: [
          link('client', 'gw', { route: 'straight' }),
          link('gw', 'store', { style: 'dashed' }),
          link('gw', 'api', { route: 'straight' }),
          link('rules', 'gw', { style: 'faint' }),
        ],
        flows: [
          { path: ['client', 'gw'], tone: 'request', count: 3, duration: 1 },
          { path: ['gw', 'store', 'gw'], tone: 'data', duration: 1.4, delay: 1 },
          { path: ['gw', 'api'], tone: 'request', count: 2, duration: 1.2, delay: 2.5 },
          { path: ['gw', 'client'], tone: 'error', label: '429', duration: 1.2, delay: 2.5 },
        ],
        panel: {
          title: 'Part 1 in one table',
          icon: 'List',
          rows: [
            { text: 'Placement', value: 'library in gateway' },
            { text: 'Rules', value: 'YAML, cached' },
            { text: 'Store', value: '16 Redis shards' },
            { text: 'Check', value: 'one Lua script' },
          ],
        },
        caption: 'Real users flow through, the excess bounces off',
      },
      quiz: {
        question: 'Why does the counter script read the time from Redis instead of using the gateway\'s clock?',
        options: [
          'Redis time is always faster',
          'A gateway with a fast or slow clock would refill buckets at the wrong moment, so every decision for a key should use one clock',
          'Gateways cannot read the time',
          'It avoids needing a hash tag',
        ],
        answer: 1,
        explain: 'With 50 gateways, clocks differ by some hundreds of milliseconds. One clock per key keeps refills consistent. Speed and hash tags are unrelated.',
      },
    },
  ],
};
