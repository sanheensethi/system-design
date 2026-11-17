import type { Lesson, SceneNode } from '../engine/types';

// Screen layout: u = x - y runs left to right, v = x + y runs top to bottom.
const clients: SceneNode = { id: 'clients', kind: 'client', at: [-4.5, 4.5], label: 'API clients', sub: '2M API keys' };
const edge: SceneNode = { id: 'edge', kind: 'cdn', at: [-3.1, 3.1], label: 'edge', sub: 'per-IP flood cap' };
const gw1: SceneNode = { id: 'gw1', kind: 'gateway', at: [-3.75, 1.75], label: 'gateway 1', sub: 'limiter library' };
const gw2: SceneNode = { id: 'gw2', kind: 'gateway', at: [-1.65, 1.65], label: 'gateway 2', sub: 'limiter library' };
const gw3: SceneNode = { id: 'gw3', kind: 'gateway', at: [0.45, 1.55], label: 'gateway 50', sub: 'limiter library' };
const redis: SceneNode = { id: 'redis', kind: 'cache', at: [-2, -3], label: 'Redis cluster', sub: '16 shards + replicas' };
const api: SceneNode = { id: 'api', kind: 'server', at: [3, -1], label: 'API services', sub: 'orders, search, login' };
const rules: SceneNode = { id: 'rules', kind: 'service', at: [-3.75, -2.25], label: 'rules service', sub: 'YAML from git' };
const monitor: SceneNode = { id: 'monitor', kind: 'monitor', at: [2.5, -4.5], label: 'dashboards', sub: 'per-rule metrics' };

// Three regions for the multi-region step: regions run along grid x, each pair along grid y.
const gwUs: SceneNode = { id: 'gwUs', kind: 'gateway', at: [-4.5, 2.5], label: 'US gateways', sub: '250K req/s' };
const redisUs: SceneNode = { id: 'redisUs', kind: 'cache', at: [-4.5, -1.5], label: 'US Redis', sub: 'local counts' };
const gwEu: SceneNode = { id: 'gwEu', kind: 'gateway', at: [0, 2.5], label: 'EU gateways', sub: '150K req/s' };
const redisEu: SceneNode = { id: 'redisEu', kind: 'cache', at: [0, -1.5], label: 'EU Redis', sub: 'local counts' };
const gwAp: SceneNode = { id: 'gwAp', kind: 'gateway', at: [4.5, 2.5], label: 'AP gateways', sub: '100K req/s' };
const redisAp: SceneNode = { id: 'redisAp', kind: 'cache', at: [4.5, -1.5], label: 'AP Redis', sub: 'local counts' };

const gwNodes = [gw1, gw2, gw3];
const coreLinks = [
  { from: 'clients', to: 'gw1' },
  { from: 'clients', to: 'gw2' },
  { from: 'clients', to: 'gw3' },
  { from: 'gw1', to: 'redis', style: 'dashed' as const },
  { from: 'gw2', to: 'redis', style: 'dashed' as const },
  { from: 'gw3', to: 'redis', style: 'dashed' as const },
  { from: 'gw1', to: 'api' },
  { from: 'gw2', to: 'api' },
  { from: 'gw3', to: 'api' },
];

export const designRateLimiter: Lesson = {
  id: 'design-rate-limiter',
  title: 'Design a distributed rate limiter',
  tagline: 'Enforce one limit per customer across 50 gateways and three regions, in under 2 ms, without becoming the outage.',
  minutes: 18,
  level: 'Intermediate',
  learn: [
    'Where the limiter lives, and how rules ship without a deploy',
    'Which algorithm each kind of rule should use',
    'Sizing a shared counter store and updating it atomically',
    'Hot keys, multi-region limits and synchronization lag',
    'Headers, client behavior, monitoring, and a store that goes down',
  ],
  metrics: [
    { key: 'traffic', label: 'Traffic' },
    { key: 'p99add', label: 'Added p99' },
    { key: 'storeops', label: 'Store ops' },
    { key: 'overshoot', label: 'Overshoot' },
    { key: 'rejected', label: '429s' },
  ],
  steps: [
    {
      title: 'Requirements',
      tag: 'problem',
      heading: 'One limit, enforced by 50 gateways in three regions',
      eli5: 'A theme park sells passes good for 100 rides an hour. There are 50 ride gates, and each **gate attendant** keeps a private tally, so a visitor who hops between gates rides 5,000 times.',
      body: [
        'We run a public API: **2M API keys**, **500K requests/s** at peak across three regions (US 250K, EU 150K, AP 100K), served by 50 gateway nodes. Free keys get 100 requests a minute, paid plans up to 6,000, login gets 5 attempts a minute per account, and every plan has a daily quota that matches the invoice.',
        'The limiter sits on every request, so it may add at most **2 ms at p99**. It must never become the outage: if it breaks, the API keeps serving. A few percent of overshoot is fine. Rules must change without a deploy.',
        'The in-memory limiter from the rate limiting lesson counts per node. Behind a load balancer that spreads requests evenly, a free key gets 100 a minute on each of 50 nodes: **5,000 a minute**, 50 times its plan.',
      ],
      keyIdea: 'A limit is only real if every node enforcing it sees the same count, and checking that count must be nearly free.',
      metrics: { traffic: '500K/s', p99add: 'budget 2 ms', storeops: '-', overshoot: '50x', rejected: '-' },
      scene: {
        nodes: [
          { ...clients, status: 'hot', badge: 'free key: 5,000/min' },
          { ...gw1, badge: '100/100 local' },
          { ...gw2, badge: '100/100 local' },
          { ...gw3, badge: '100/100 local' },
          { ...api, status: 'hot', badge: 'CPU 95%' },
        ],
        links: coreLinks.filter((l) => l.to !== 'redis'),
        flows: [
          { path: ['clients', 'gw1', 'api'], tone: 'request', count: 3, duration: 1.6 },
          { path: ['clients', 'gw2', 'api'], tone: 'request', count: 3, duration: 1.6, delay: 0.3 },
          { path: ['clients', 'gw3', 'api'], tone: 'request', count: 3, duration: 1.6, delay: 0.6 },
        ],
        caption: 'Each gateway thinks the key is within its limit',
      },
    },
    {
      title: 'Where it lives',
      tag: 'tradeoff',
      heading: 'Put the limiter where it knows the caller and nothing has been spent',
      eli5: 'The ride check happens at the gate, after the visitor shows a pass and before the ride starts. The **gateway** is the one spot that knows who you are and has not spent anything on you yet.',
      body: [
        'Client-side limits can be removed by anyone who edits the client, so they are a courtesy at most. Limits inside each service get rebuilt by every team, and a rejected request has already cost a hop. The **API gateway** (the reverse proxies and API gateways lesson) sits after auth, so it knows the API key, and before anything expensive.',
        'Two shapes fit there: a separate limiter service that each gateway calls, or a **limiter library** inside the gateway that talks straight to a shared counter store. The service adds a network hop and another fleet to keep up. We use the library, one hop to the store, behind a small interface: `check(key, rule, cost)` returns allowed, remaining and reset time.',
        'Limits stack in layers. A coarse per-IP cap at the edge (the web security lesson) soaks up floods before they cost TLS work. Per-key and per-route rules run at the gateway. Services keep their own leaky buckets for outbound calls to partners.',
      ],
      keyIdea: 'Rate limit at the first point that knows the caller, and layer a cheap coarse limit in front of the precise one.',
      metrics: { traffic: '500K/s', p99add: 'budget 2 ms', storeops: '-', overshoot: '50x', rejected: '-' },
      scene: {
        nodes: [clients, { ...edge, status: 'active', badge: 'per IP' }, { ...gw2, label: 'gateways', status: 'active', badge: 'per key + route' }, redis, api],
        links: [
          { from: 'clients', to: 'edge' },
          { from: 'edge', to: 'gw2' },
          { from: 'gw2', to: 'redis', style: 'dashed' },
          { from: 'gw2', to: 'api' },
        ],
        flows: [
          { path: ['clients', 'edge'], tone: 'request', count: 4, duration: 1 },
          { path: ['edge', 'clients'], tone: 'error', label: 'flood: 429', duration: 1, delay: 1.1 },
          { path: ['edge', 'gw2'], tone: 'request', count: 2, duration: 1, delay: 1.1 },
          { path: ['gw2', 'redis', 'gw2'], tone: 'data', label: 'check()', duration: 1.2, delay: 2.2 },
          { path: ['gw2', 'api'], tone: 'request', label: 'allowed', duration: 1, delay: 3.5 },
        ],
        caption: 'Coarse at the edge, precise at the gateway',
      },
    },
    {
      title: 'Rules config',
      tag: 'concept',
      heading: 'Rules live in config, not in code',
      eli5: 'The park office writes the ride rules in a **rulebook** and sends copies to every gate. To change a rule, the office sends a new page, and no gate has to be rebuilt.',
      body: [
        'A rule names what it matches (plan, route), what it counts by (API key, account, IP), an algorithm and its numbers. Rules live as YAML in git, reviewed like code. A **rules service** publishes them, and each gateway keeps the whole set in memory and refreshes it every 10 seconds (the feature flags and config lesson). A change reaches all 50 gateways in seconds with no deploy.',
        'One request can match several rules, a per-key rate and a per-route limit, and all of them must pass. Per-customer deals, such as an enterprise key bought at 3M a minute, are override rows in the rules service, not code.',
        'The whole rule set is a few kilobytes. If the rules service goes down, gateways keep the last good copy, so it is never on the request path.',
      ],
      keyIdea: 'Rules are data the gateways cache. Changing a limit is a reviewed config change, not a release.',
      metrics: { traffic: '500K/s', p99add: 'budget 2 ms', storeops: '-', overshoot: '50x', rejected: '-' },
      scene: {
        nodes: [clients, ...gwNodes.map((g) => ({ ...g, badge: 'rules v42' })), { ...rules, status: 'active', badge: 'v42 published' }, api],
        links: [
          ...coreLinks.filter((l) => l.to !== 'redis'),
          { from: 'rules', to: 'gw1', style: 'dashed' },
          { from: 'rules', to: 'gw2', style: 'dashed' },
          { from: 'rules', to: 'gw3', style: 'dashed' },
        ],
        flows: [
          { path: ['rules', 'gw1'], tone: 'event', label: 'rules v42', duration: 1.2 },
          { path: ['rules', 'gw2'], tone: 'event', duration: 1.2 },
          { path: ['rules', 'gw3'], tone: 'event', duration: 1.2 },
          { path: ['clients', 'gw2', 'api'], tone: 'request', count: 2, duration: 1.6, delay: 1.4 },
        ],
        caption: 'Every gateway holds the full rule set in memory',
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
        highlight: [6, 14, 19, 25],
      },
    },
    {
      title: 'Algorithms',
      tag: 'tradeoff',
      heading: 'Pick the algorithm per rule',
      eli5: 'Different rides need different rules. The roller coaster lets a family ride a few times in a row, the haunted house allows only so many people inside at once, and the **daily pass** resets at midnight.',
      body: [
        'The rate limiting lesson explains how each algorithm works. The design question is which rule gets which. **Token bucket** for per-key API rates: apps burst when they open, and the two numbers, rate and burst, are what we sell. **Sliding window counter** for login and per-IP rules: no burst allowance, no boundary trick, two integers per key. **Fixed window** for the daily quota: the invoice resets at midnight UTC, so the counter should too, and a boundary burst does not matter at day scale.',
        'Two rules are not rates at all. A **concurrency limit** caps requests in flight, such as 10 searches at once per key, because one 30-second export costs more than a thousand profile reads. A leaky bucket queue shapes our outbound calls to partners with hard caps.',
        'Requests can cost more than one. A bulk endpoint that writes 100 records takes 100 tokens, so the limit tracks work done, not calls made.',
      ],
      keyIdea: 'Match the algorithm to what the rule protects: bursts for user traffic, strict windows for abuse, calendar windows for billing.',
      metrics: { traffic: '500K/s', p99add: 'budget 2 ms', storeops: '-', overshoot: '50x', rejected: '-' },
      scene: {
        nodes: [
          clients,
          { ...gw1, label: 'token bucket', sub: 'per key', status: 'active', badge: 'burst 20' },
          { ...gw2, label: 'window', sub: 'login, per IP', status: 'active', badge: '5/min' },
          { ...gw3, label: 'concurrency', sub: 'search', status: 'active', badge: '10 in flight' },
          api,
        ],
        links: coreLinks.filter((l) => l.to !== 'redis'),
        flows: [
          { path: ['clients', 'gw1', 'api'], tone: 'request', count: 4, duration: 1.6, label: 'burst passes' },
          { path: ['clients', 'gw2'], tone: 'request', count: 3, duration: 1, delay: 0.4, label: 'POST /login' },
          { path: ['gw2', 'clients'], tone: 'error', duration: 1, delay: 1.5, label: '429' },
          { path: ['clients', 'gw3', 'api'], tone: 'request', count: 2, duration: 1.6, delay: 0.8 },
        ],
        caption: 'One limiter, several algorithms, chosen per rule',
      },
    },
    {
      title: 'Counter store',
      tag: 'concept',
      heading: 'A shared counter store, sized for operations',
      eli5: 'All the gates now share one big **scoreboard** in the middle of the park. Every gate marks rides on it, so a visitor who hops gates still uses one tally.',
      body: [
        'All 50 gateways must see the same count, so counters live in a shared in-memory store: **Redis**, in the same zone as the gateways for a round trip of about 0.5 ms.',
        'Each (key, rule) pair is one small hash, such as `rl:{key_8f3a}:free-tier` holding `tokens` and `ts`, with a TTL so idle keys vanish. 2M keys × 3 rules × about 150 bytes is roughly **1 GB**. Memory is not the problem. Operations are.',
        'At 500K requests/s with one script call each, a single Redis thread is far too few. We run **16 primaries** at about 31K calls/s each, sharded by key (the consistent hashing lesson), each with a replica. The braces in `{key_8f3a}` are a Redis Cluster hash tag: every rule for one key lands on the same shard, so one script can check them all in one round trip.',
      ],
      keyIdea: 'Size the counter store by operations per second, not bytes. Keep all of one key\'s counters on one shard.',
      metrics: { traffic: '500K/s', p99add: '0.8 ms', storeops: '500K/s', overshoot: '~0', rejected: '10K/s' },
      scene: {
        nodes: [clients, ...gwNodes, { ...redis, status: 'active', badge: '31K calls/s per shard' }, api],
        links: coreLinks,
        flows: [
          { path: ['clients', 'gw1'], tone: 'request', duration: 1 },
          { path: ['clients', 'gw3'], tone: 'request', duration: 1, delay: 0.2 },
          { path: ['gw1', 'redis', 'gw1'], tone: 'data', label: 'check', duration: 1.4, delay: 1.1 },
          { path: ['gw3', 'redis', 'gw3'], tone: 'data', duration: 1.4, delay: 1.3 },
          { path: ['gw1', 'api'], tone: 'request', duration: 1, delay: 2.6 },
          { path: ['gw3', 'clients'], tone: 'error', label: '429', duration: 1, delay: 2.8 },
        ],
        caption: 'One shared count per key, wherever the request lands',
      },
    },
    {
      title: 'Atomic check',
      tag: 'concept',
      heading: 'Read, refill, compare and write in one step',
      eli5: 'Two gates must never read the scoreboard, think, and then both write over each other. Each gate does its whole **atomic** turn at the board in one go, so no other gate can cut in halfway.',
      body: [
        'The rate limiting lesson fixed a fixed-window race with `INCR`. A token bucket needs more: read tokens and last time, refill by elapsed time, compare, subtract, write back. Run all of it as one **Lua script**. Redis executes a script start to finish with no other command in between, and it costs one round trip.',
        'Mind the clock. If each gateway passes in its own time, a gateway whose clock runs 300 ms fast refills buckets early. The script reads the time from Redis itself, so every decision for a key uses one clock (the clocks and ordering lesson).',
        'The script returns the decision and the tokens left. The gateway turns those into response headers without a second call.',
      ],
      keyIdea: 'A multi-step check is only safe if it runs as one indivisible operation, on one clock, next to the data.',
      metrics: { traffic: '500K/s', p99add: '0.8 ms', storeops: '500K/s', overshoot: '~0', rejected: '10K/s' },
      scene: {
        nodes: [clients, { ...gw1, status: 'active' }, gw2, { ...gw3, status: 'active' }, { ...redis, status: 'active', badge: '1 token left' }, api],
        links: coreLinks,
        flows: [
          { path: ['gw1', 'redis'], tone: 'request', label: 'EVAL bucket', duration: 1 },
          { path: ['gw3', 'redis'], tone: 'request', label: 'EVAL bucket', duration: 1 },
          { path: ['redis', 'gw1'], tone: 'response', label: 'allowed, 0 left', duration: 1, delay: 1.1 },
          { path: ['redis', 'gw3'], tone: 'error', label: 'denied', duration: 1, delay: 1.1 },
          { path: ['gw1', 'api'], tone: 'request', duration: 1, delay: 2.2 },
        ],
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
    },
    {
      title: 'Hot key',
      tag: 'case',
      heading: 'Case: one customer sends 40K requests a second',
      eli5: 'One school group rides nonstop, and every gate runs to the same corner of the scoreboard. Now each gate grabs a **stack of ride stamps** at once and hands them out itself, walking to the board far less often.',
      body: [
        'An enterprise key with a custom plan of 3M requests a minute (50K/s) starts a backfill at **40K/s**. One key lives on one shard, so that shard jumps from 31K to about 70K script calls a second. Its single thread saturates, and every other key on it now waits: the added p99 for those customers climbs to **9 ms**. The limiter meant to protect the API is slowing it down.',
        'The fix is **local token leases** for hot keys. When a key passes a rate threshold, a gateway takes 200 tokens from the shared bucket in one call and spends them from memory, going back only when they run out. 40K/s over 50 gateways is 800/s each, so each gateway calls Redis 4 times a second for that key: **200 calls/s in total instead of 40,000**.',
        'The price is accuracy. Up to 50 × 200 = 10,000 tokens can sit unspent across gateways, a fifth of one second\'s budget for this key. Leases expire after a second, and quiet keys keep exact per-request checks.',
      ],
      keyIdea: 'A hot key overloads one shard. Batch its checks locally and accept a small, bounded overshoot.',
      metrics: { traffic: '500K/s', p99add: '9 ms → 0.8 ms', storeops: '460K/s', overshoot: '≤ 10K tokens', rejected: '10K/s' },
      scene: {
        nodes: [
          { ...clients, status: 'hot', badge: 'one key: 40K/s' },
          ...gwNodes.map((g) => ({ ...g, status: 'active' as const, badge: 'lease: 200 tokens' })),
          { ...redis, status: 'ok', badge: '4 calls/s per gateway' },
          api,
        ],
        links: coreLinks,
        flows: [
          { path: ['clients', 'gw1', 'api'], tone: 'request', count: 4, duration: 1.4 },
          { path: ['clients', 'gw2', 'api'], tone: 'request', count: 4, duration: 1.4, delay: 0.2 },
          { path: ['clients', 'gw3', 'api'], tone: 'request', count: 4, duration: 1.4, delay: 0.4 },
          { path: ['gw2', 'redis', 'gw2'], tone: 'data', label: 'take 200', duration: 1.4, delay: 1.6 },
        ],
        caption: 'Leases turn 40,000 store calls a second into 200',
      },
    },
    {
      title: 'Multi-region',
      tag: 'tradeoff',
      heading: 'One limit across three regions, and the lag between them',
      eli5: 'The park has three sites far apart, and one pass works at all of them. Each site keeps its own **scoreboard** and phones the others every half second, so for a moment each site does not know the latest count.',
      body: [
        'A key can send traffic to the US, EU and AP at once. One global store in the US would put an 80 to 150 ms round trip on every EU and AP request, far past the 2 ms budget, and a cross-ocean outage would break limiting everywhere. Out.',
        '**Split the budget**: each region enforces a fixed share, say 60/25/15%. No cross-region traffic and simple, but wrong when a customer moves. **Count locally, sync asynchronously** (the multi-region lesson): each region decides on its own count plus the last-heard counts from the others, and broadcasts its usage every 500 ms. Decisions stay local and fast.',
        'The price is **synchronization lag**. For up to 500 ms a region does not know what the others allowed, so a key that bursts in all three regions at once can get up to about 3× its limit for that moment, until the next sync closes the gap. Geo routing sends most keys to one region, so real overshoot is small. Billing quotas get reconciled exactly from usage logs afterwards.',
      ],
      keyIdea: 'Across regions, decide locally and share counts in the background. The sync interval sets the size of the overshoot.',
      metrics: { traffic: '500K/s', p99add: '0.8 ms', storeops: '460K/s', overshoot: '≤ 3x for 500 ms', rejected: '10K/s' },
      scene: {
        zones: [
          { id: 'us', from: [-5.3, -2.3], to: [-3.7, 3.3], label: 'us-east', tone: 'blue' },
          { id: 'eu', from: [-0.8, -2.3], to: [0.8, 3.3], label: 'eu-west', tone: 'violet' },
          { id: 'ap', from: [3.7, -2.3], to: [5.3, 3.3], label: 'ap-south', tone: 'green' },
        ],
        nodes: [
          { ...gwUs, status: 'active' },
          { ...redisUs, badge: 'key: 40 local' },
          { ...gwEu, status: 'active' },
          { ...redisEu, badge: 'key: 35 local' },
          gwAp,
          { ...redisAp, badge: 'key: 25 local' },
        ],
        links: [
          { from: 'gwUs', to: 'redisUs' },
          { from: 'gwEu', to: 'redisEu' },
          { from: 'gwAp', to: 'redisAp' },
          { from: 'redisUs', to: 'redisEu', style: 'dashed', label: 'every 500 ms' },
          { from: 'redisEu', to: 'redisAp', style: 'dashed' },
        ],
        flows: [
          { path: ['gwUs', 'redisUs', 'gwUs'], tone: 'request', duration: 1.2 },
          { path: ['gwEu', 'redisEu', 'gwEu'], tone: 'request', duration: 1.2, delay: 0.2 },
          { path: ['gwAp', 'redisAp', 'gwAp'], tone: 'request', duration: 1.2, delay: 0.4 },
          { path: ['redisUs', 'redisEu'], tone: 'data', label: 'US used 40', duration: 1.4, delay: 1.6 },
          { path: ['redisEu', 'redisAp'], tone: 'data', label: 'US+EU used 75', duration: 1.4, delay: 3.1 },
        ],
        caption: 'Local decisions, counts shared in the background',
      },
      quiz: {
        question: 'A customer\'s limit is 1,000 requests a minute, split statically by region: US 60%, EU 25%, AP 15%. They move all their traffic to EU servers. What happens?',
        options: [
          'Nothing changes: they still get 1,000 a minute',
          'They get 429s above about 250 a minute',
          'They get 429s above about 600 a minute',
          'The EU region borrows the unused US share automatically',
        ],
        answer: 1,
        explain: 'A static split only knows the EU share, 25% of 1,000. The customer pays for 1,000 and gets 250. Local counting with background sync follows the traffic instead.',
      },
    },
    {
      title: 'Headers, clients',
      tag: 'concept',
      heading: 'Tell clients the budget, and give them a good default',
      eli5: 'Every gate shows a little sign with how many rides you have left and when the count resets. Polite visitors read the **sign** and wait their turn instead of pushing at the gate.',
      body: [
        'Every response carries the budget, not only rejections: `X-RateLimit-Limit`, `X-RateLimit-Remaining` and `X-RateLimit-Reset`, and a `429` adds `Retry-After`. An IETF draft defines standard `RateLimit` headers, and many APIs still send the `X-` names.',
        '**Hard or soft.** A hard limit rejects at the line. A soft limit lets paid plans run 10% over for a few minutes with a warning header and an email, because cutting off a paying customer in the middle of a launch costs more than the extra load. Free plans stay hard.',
        'Good clients slow down when `Remaining` gets low, wait `Retry-After` plus random jitter on a 429 (the timeouts and retries lesson), and never retry in a tight loop. Shipping that behavior in the official SDKs removes most retry storms before they start.',
      ],
      keyIdea: 'Publish the budget on every response, and make the polite retry the default in the code clients actually run.',
      metrics: { traffic: '500K/s', p99add: '0.8 ms', storeops: '460K/s', overshoot: '≤ 3x for 500 ms', rejected: '10K/s' },
      scene: {
        nodes: [{ ...clients, status: 'active', badge: 'SDK backs off' }, gw1, { ...gw2, status: 'active', badge: 'Remaining: 0' }, gw3, redis, api],
        links: coreLinks,
        flows: [
          { path: ['clients', 'gw2'], tone: 'request', duration: 1 },
          { path: ['gw2', 'redis', 'gw2'], tone: 'data', duration: 1.2, delay: 1.1 },
          { path: ['gw2', 'clients'], tone: 'error', label: '429 Retry-After: 3', duration: 1, delay: 2.4 },
          { path: ['clients', 'gw2', 'api'], tone: 'request', label: 'after 3 s + jitter', duration: 1.6, delay: 4 },
        ],
        caption: 'The client waits as told, then succeeds',
      },
      code: {
        language: 'typescript',
        title: 'What the official SDK does on every call',
        source: `async function call(req: Request, attempt = 0): Promise<Response> {
  const res = await fetch(req.clone());
  const left = Number(res.headers.get('X-RateLimit-Remaining') ?? 'Infinity');
  if (left < 5) await sleep(500);                  // ease off before the wall
  if (res.status !== 429 || attempt >= 4) return res;
  const waitMs = Number(res.headers.get('Retry-After') ?? '1') * 1000;
  await sleep(waitMs + Math.random() * 1000);       // jitter: no lockstep retries
  return call(req, attempt + 1);
}`,
        highlight: [4, 6, 7],
      },
    },
    {
      title: 'Monitoring',
      tag: 'concept',
      heading: 'Watch the limiter, and try rules in shadow first',
      eli5: 'The park control room watches how many riders each gate turns away. A new rule first runs in **shadow mode**: gates write down who they would have stopped, and stop nobody yet.',
      body: [
        'Each gateway emits per-rule counters: allowed, rejected, and would-reject for rules in shadow mode, plus store latency and errors (the observability lesson). The dashboards answer three questions: which rules reject paying customers at normal traffic, which rules let the API overload anyway, and which keys are rejected most.',
        '**Shadow mode** comes before every new or tighter rule. The `search-cost` rule ran in shadow for a week and showed 40 keys it would have cut off, 3 of them paying customers with a legitimate nightly job. They got overrides before the rule was enforced.',
        'Alert on a jump in the 429 rate for a plan (a bad rule change), on store p99 above 2 ms, and on rejections falling to zero, which often means the limiter is failing open without anyone noticing.',
      ],
      keyIdea: 'A limiter you cannot see is a limiter you cannot tune. Measure every rule, and dry-run new ones before they bite.',
      metrics: { traffic: '500K/s', p99add: '0.8 ms', storeops: '460K/s', overshoot: '≤ 3x for 500 ms', rejected: '10K/s' },
      scene: {
        nodes: [clients, ...gwNodes, redis, api, rules, { ...monitor, status: 'active', badge: 'search-cost: 40 would-reject' }],
        links: [
          ...coreLinks,
          { from: 'gw3', to: 'monitor', style: 'faint' },
          { from: 'rules', to: 'gw1', style: 'faint' },
        ],
        flows: [
          { path: ['clients', 'gw3', 'api'], tone: 'request', count: 2, duration: 1.6 },
          { path: ['gw3', 'monitor'], tone: 'event', label: 'would reject', duration: 1.2, delay: 1 },
          { path: ['rules', 'gw1'], tone: 'event', label: 'override for 3 keys', duration: 1.2, delay: 2.4 },
        ],
        caption: 'Shadow mode: log the 429, still serve the request',
      },
    },
    {
      title: 'Store down',
      tag: 'case',
      heading: 'Case: a Redis shard dies at peak',
      eli5: 'One corner of the scoreboard breaks. Gates for most rides keep a rough tally on paper, a **local fallback**, while the gate to the treasure room stays shut until the board is fixed.',
      body: [
        'One of the 16 primaries dies. Its replica is promoted in about 15 seconds (the failover lesson), and for that window one sixteenth of keys, about 31K requests/s, have no shared counter. Calls to that shard hit their **5 ms timeout**, and after a few failures a circuit breaker (the circuit breakers lesson) stops calling it, so latency comes back down.',
        'What each rule does next comes from its config. Most rules **fail open to a local fallback**: each gateway enforces the limit divided by 50 in memory, which is about right because the load balancer spreads requests evenly. Login and one-time-code rules **fail closed**, since unlimited password guesses are worse than a minute of errors.',
        'The promoted replica was a fraction of a second behind (async replication), so some keys get a small free burst. The API stayed up, added latency spiked for seconds, and a dashboard showed every step.',
      ],
      keyIdea: 'Design the failure path before you need it: short timeouts, a breaker, a local fallback per rule, and fail closed only where an unlimited caller is worse than an error.',
      metrics: { traffic: '500K/s', p99add: '5 ms, then 0.8 ms', storeops: '430K/s', overshoot: 'local ÷ 50 for 15 s', rejected: '9K/s' },
      scene: {
        nodes: [
          clients,
          { ...gw1, status: 'active', badge: 'fail open: 100 ÷ 50' },
          { ...gw2, status: 'active', badge: '/login: fail closed' },
          { ...gw3, status: 'active', badge: 'breaker open' },
          { ...redis, status: 'down', badge: 'shard 7 down' },
          { ...api, status: 'ok' },
          { ...monitor, status: 'hot', badge: 'store errors' },
        ],
        links: [...coreLinks, { from: 'redis', to: 'monitor', style: 'faint' }],
        flows: [
          { path: ['gw3', 'redis'], tone: 'error', label: '5 ms timeout', duration: 0.8 },
          { path: ['clients', 'gw1', 'api'], tone: 'request', count: 3, duration: 1.6, delay: 0.4, label: 'local count' },
          { path: ['clients', 'gw2'], tone: 'request', duration: 1, delay: 0.8, label: 'POST /login' },
          { path: ['gw2', 'clients'], tone: 'error', duration: 1, delay: 1.9, label: '503' },
          { path: ['redis', 'monitor'], tone: 'event', duration: 1, delay: 1 },
        ],
        caption: 'Normal routes stay up on local counts, login stays locked',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'A limiter that is shared, fast, and safe to lose',
      eli5: 'A **distributed rate limiter** is one rulebook, one shared scoreboard, gates that grab stamps in bulk for busy groups, parks that phone each other, and a paper backup for when the board breaks.',
      body: [
        'The limiter is a library in 50 gateways, behind a coarse per-IP cap at the edge. Rules are YAML from a rules service, cached in memory, with the algorithm picked per rule. Counters live in 16 Redis shards, keyed with a hash tag and updated by one atomic script that reads Redis time.',
        'Hot keys lease tokens in batches. Regions decide locally and sync every 500 ms, accepting brief overshoot. Clients get budget headers and an SDK that backs off. New rules run in shadow, and a dead shard means a local fallback, with login failing closed.',
      ],
      keyIdea: 'Count in one shared place, atomically and close by. Batch or sync where one place is too slow, and decide in advance what happens when that place is gone.',
      metrics: { traffic: '500K/s', p99add: '0.8 ms', storeops: '460K/s', overshoot: '≤ 3x for 500 ms', rejected: '10K/s' },
      scene: {
        nodes: [clients, ...gwNodes.map((g) => ({ ...g, status: 'ok' as const })), { ...redis, status: 'ok' }, api, rules, monitor],
        links: [
          ...coreLinks,
          { from: 'rules', to: 'gw1', style: 'faint' },
          { from: 'gw3', to: 'monitor', style: 'faint' },
        ],
        flows: [
          { path: ['clients', 'gw1', 'api'], tone: 'request', count: 2, duration: 1.6 },
          { path: ['gw1', 'redis', 'gw1'], tone: 'data', duration: 1.2, delay: 0.5 },
          { path: ['clients', 'gw3'], tone: 'request', count: 3, duration: 1, delay: 0.3 },
          { path: ['gw3', 'clients'], tone: 'error', label: '429', duration: 1, delay: 1.4 },
        ],
        caption: 'Real users flow through, the excess bounces off',
      },
      quiz: {
        question: 'One enterprise key sends 40K requests a second, and the Redis shard holding it hits its limit, slowing every other key on that shard. What is the best fix?',
        options: [
          'Give every gateway its own in-memory counters for all keys',
          'Let gateways lease batches of tokens for hot keys and spend them locally',
          'Move all counters into the main SQL database',
          'Fail closed for that key until traffic drops',
        ],
        answer: 1,
        explain: 'Leasing 200 tokens at a time cuts that key\'s store calls from 40,000 to about 200 a second, with a small bounded overshoot. Per-gateway counters bring back the 50x problem, SQL is slower than Redis, and failing closed punishes a paying customer for our bottleneck.',
      },
    },
  ],
};
