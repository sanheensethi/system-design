import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const users: SceneNode = { id: 'users', kind: 'phone', at: at(-7.6, -3.4), label: 'app users', sub: '2k req/s total' };
const scraper: SceneNode = { id: 'scraper', kind: 'client', at: at(-4.2, 3.6), label: 'scraper', sub: '1 API key' };
const limiter: SceneNode = { id: 'limiter', kind: 'block', at: at(0, 0), label: 'rate limiter', sub: '100/min per key', icon: 'Gauge', tint: 'amber' };
const api: SceneNode = { id: 'api', kind: 'block', at: at(4.2, 0), label: 'API servers', sub: '4k req/s max', icon: 'Server', tint: 'violet' };

// Two gateway nodes sharing one store.
const client: SceneNode = { id: 'client', kind: 'client', at: at(-6.2, 0), label: 'scraper', sub: '1 API key' };
const l1: SceneNode = { id: 'l1', kind: 'block', at: at(-2, -3.4), label: 'limiter 1', sub: 'gateway node', icon: 'Gauge', tint: 'amber' };
const l2: SceneNode = { id: 'l2', kind: 'block', at: at(2, 3.4), label: 'limiter 2', sub: 'gateway node', icon: 'Gauge', tint: 'amber' };
const redis: SceneNode = { id: 'redis', kind: 'cache', at: at(6.8, 0), label: 'Redis', sub: 'shared counters' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

export const rateLimitingPart2: Lesson = {
  id: 'rate-limiting-part-2',
  title: 'Rate limiting (part 2)',
  tagline: 'Choose what to count, share the counts across many nodes without a race, and run the limiter in production.',
  minutes: 15,
  level: 'Intermediate',
  learn: [
    'Choosing the key: user, IP, endpoint, and layering them',
    'Quotas versus rate limits',
    'Sharing counters across servers with atomic Redis operations',
    'What to do when the limiter store is down, and syncing many data centers',
    'Hard and soft limits, rules as config, monitoring, concurrency limits and load shedding',
  ],
  metrics: [
    { key: 'qps', label: 'Load on API', icon: 'Activity' },
    { key: 'p99', label: 'p99 latency', icon: 'Timer' },
    { key: 'errors', label: '5xx rate', icon: 'Bug' },
    { key: 'rejected', label: '429s', icon: 'Shield' },
    { key: 'rule', label: 'Limit rule', icon: 'Gauge' },
  ],
  steps: [
    {
      title: 'Whose budget',
      tag: 'problem',
      heading: 'One rule, keyed on the wrong thing',
      eli5: 'The **key** is the name on the tally card. Put one card on a whole classroom and the quiet kids lose their turns. Give a sneaky kid a new name every minute and he gets a fresh card every time.',
      body: [
        'Part 1 counted requests per key. Now picture the key is the client IP. An office of 400 staff shares one public IP, so they burn the budget together and get `429` after a few clicks.',
        'Meanwhile a botnet of 5,000 IPs sends 100 requests from each. Every IP stays under the limit, and 500,000 requests land on your servers.',
      ],
      keyIdea: 'The key decides who shares a budget. The wrong key blocks honest users and lets abusers through.',
      metrics: { qps: '10k/s', p99: '2 s', errors: '10%', rejected: 'office blocked', rule: '100/min per IP' },
      metricTones: { qps: 'bad', p99: 'bad', errors: 'bad', rejected: 'bad' },
      scene: {
        nodes: [
          { ...users, label: 'office', sub: '400 staff, 1 IP', chips: [{ text: '429 after a few clicks', tone: 'bad' }] },
          { ...scraper, label: 'botnet', sub: '5,000 IPs', chips: [{ text: '100 per IP, all pass', tone: 'warn' }] },
          { ...limiter, sub: '100/min per IP', status: 'active' },
          { ...api, status: 'hot', load: 100 },
        ],
        links: [link('users', 'limiter', { label: 'one shared IP', labelTone: 'warn' }), link('scraper', 'limiter'), link('limiter', 'api')],
        flows: [
          { path: ['users', 'limiter'], tone: 'request', count: 3, duration: 1 },
          { path: ['limiter', 'users'], tone: 'error', duration: 1, delay: 1.1, label: '429' },
          { path: ['scraper', 'limiter', 'api'], tone: 'request', count: 6, duration: 1.6, delay: 0.3, label: '500k req/min' },
        ],
        panel: {
          title: 'Key = client IP',
          icon: 'Users',
          rows: [
            { text: 'Office, 400 people', value: 'blocked', tone: 'bad' },
            { text: 'Botnet, 5,000 IPs', value: 'all allowed', tone: 'bad' },
          ],
          footer: { text: 'Fair to nobody', tone: 'bad' },
        },
        caption: 'The IP is a bad name for a person',
      },
    },
    {
      title: 'Per user',
      tag: 'concept',
      heading: 'Per user or API key: the fairest budget',
      eli5: 'One card per kid, with the kid\'s own name. Every kid gets the same number of turns, whichever door they came through.',
      body: [
        '**Per user or API key** is the fairest key, since every customer gets the same budget no matter where they connect from. Two users behind one office IP no longer fight over a count.',
        'The catch is that it only works after authentication, so the request has already cost you a token check before it can be counted.',
      ],
      keyIdea: 'A user or API key gives each customer an equal budget, at the price of authenticating first.',
      metrics: { qps: '2k/s', p99: '120 ms', errors: '0.1%', rejected: '~10k/s', rule: '100/min per key' },
      metricTones: { qps: 'good', rejected: 'warn' },
      scene: {
        nodes: [
          { ...users, label: 'office', sub: '2 users, 1 IP', chips: ['key: user_17', 'key: user_18'] },
          { ...limiter, label: 'limiter', sub: 'key = API key', status: 'active', badge: 'user_17 4/100' },
          { ...api, status: 'ok', load: 25 },
        ],
        links: [link('users', 'limiter'), link('limiter', 'api')],
        flows: [
          { path: ['users', 'limiter', 'api'], tone: 'request', count: 3, duration: 1.8, label: 'GET /feed' },
          { path: ['api', 'limiter', 'users'], tone: 'response', duration: 1.8, delay: 1.9 },
        ],
        panel: {
          title: 'Counters by key',
          icon: 'Key',
          rows: [
            { text: 'user_17', value: '4 / 100', tone: 'good' },
            { text: 'user_18', value: '9 / 100', tone: 'good' },
            { text: 'Needs', value: 'auth first', tone: 'warn' },
          ],
        },
        caption: 'Each customer counts on their own card',
      },
    },
    {
      title: 'Per IP',
      tag: 'tradeoff',
      heading: 'Per IP: all you have before login',
      eli5: 'For a kid who has not told you their name yet, all you can see is which gate they came through. It is a blunt tool, but better than nothing.',
      body: [
        '**Per IP** is all you have for anonymous traffic such as login and signup, since there is no user yet. It is blunt both ways. An office or a mobile carrier can put thousands of real users behind one IP.',
        'An attacker with a botnet rotates through thousands of IPs. So an IP limit is a cheap first layer against floods, never the only defense.',
      ],
      keyIdea: 'IP limits are the only key before authentication, and they are crude in both directions.',
      metrics: { qps: '2k/s', p99: '120 ms', errors: '0.1%', rejected: '~10k/s', rule: 'IP: 300/min' },
      metricTones: { rejected: 'warn' },
      scene: {
        nodes: [
          { ...users, label: 'mobile carrier', sub: '5,000 users, 1 IP', chips: [{ text: 'shared IP: 429', tone: 'warn' }] },
          { ...scraper, label: 'botnet', sub: 'rotates 500 IPs', chips: ['POST /signup'] },
          { ...limiter, label: 'edge limiter', sub: 'key = IP', status: 'active' },
        ],
        links: [link('users', 'limiter'), link('scraper', 'limiter')],
        flows: [
          { path: ['users', 'limiter'], tone: 'request', count: 3, duration: 1 },
          { path: ['limiter', 'users'], tone: 'error', duration: 1, delay: 1.1, label: '429' },
          { path: ['scraper', 'limiter'], tone: 'request', count: 4, duration: 1, delay: 0.4 },
        ],
        panel: {
          title: 'IP as a key',
          icon: 'Network',
          rows: [
            { text: 'Works before login', value: 'yes', tone: 'good' },
            { text: 'Many users, one IP', value: 'unfair', tone: 'warn' },
            { text: 'One user, many IPs', value: 'slips past', tone: 'warn' },
          ],
        },
        caption: 'Better than nothing, worse than a user id',
      },
    },
    {
      title: 'Per endpoint',
      tag: 'concept',
      heading: 'Per endpoint: price the limit by cost',
      eli5: 'The busy swing can have a smaller limit than the slide. Some rides cost the playground more, so kids get fewer turns on them.',
      body: [
        '**Per endpoint** reflects cost. A search that hits the database for 200 ms deserves a tighter limit than a cached profile read. `/login` needs about 5 attempts per minute per account to stop password guessing.',
        'A token bucket can also charge by weight: a cheap read costs 1 token, an export costs 20. One budget, honest prices.',
      ],
      keyIdea: 'Expensive or dangerous routes get tighter limits, or cost more tokens, than cheap ones.',
      metrics: { qps: '2k/s', p99: '120 ms', errors: '0.1%', rejected: '~10k/s', rule: 'per route' },
      metricTones: { qps: 'good', errors: 'good' },
      scene: {
        nodes: [
          { ...scraper, chips: [{ text: 'POST /login', tone: 'warn' }] },
          { ...limiter, label: 'limiter', sub: 'key = user + route', status: 'active', badge: '/login 5/5' },
          { ...api, status: 'ok', load: 25 },
        ],
        links: [link('scraper', 'limiter'), link('limiter', 'api')],
        flows: [
          { path: ['scraper', 'limiter'], tone: 'request', count: 4, duration: 1 },
          { path: ['limiter', 'scraper'], tone: 'error', count: 2, duration: 1, delay: 1.1, label: '429: 5/min per account' },
        ],
        panel: {
          title: 'Limits by route',
          icon: 'Route',
          rows: [
            { text: 'GET /profile (cached)', value: '600 / min' },
            { text: 'GET /search (200 ms, DB)', value: '60 / min', tone: 'warn' },
            { text: 'POST /login', value: '5 / min', tone: 'bad' },
          ],
        },
        caption: 'Different routes, different keys, different budgets',
      },
    },
    {
      title: 'Layered limits',
      tag: 'concept',
      heading: 'Stack the limits, coarse first',
      eli5: 'One teacher at the gate counts everyone quickly. A second teacher at each ride counts names and rides more carefully. The cheap check goes first.',
      body: [
        'Real systems stack these keys: a loose per-IP limit at the edge, then a per-user limit, then a per-endpoint limit behind it. The cheap coarse check turns floods away before the precise one spends effort.',
        'A request must pass every layer. The first one that says no ends it, so the strictest relevant rule wins.',
      ],
      keyIdea: 'Layer cheap coarse limits in front of precise ones. The first layer to refuse ends the request.',
      metrics: { qps: '2k/s', p99: '120 ms', errors: '0.1%', rejected: '~10k/s', rule: 'IP + user + route' },
      metricTones: { qps: 'good', errors: 'good' },
      scene: {
        nodes: [
          { ...users, at: at(-6.6, 0), chips: ['GET /search'] },
          { id: 'edge', kind: 'block', at: at(-2.2, 0), label: 'edge limiter', sub: 'per IP: loose', icon: 'Shield', tint: 'blue', status: 'ok' },
          { ...limiter, at: at(2.2, 0), label: 'user limiter', sub: 'per user + route', status: 'active', badge: '/search 60/min' },
          { ...api, at: at(6.6, 0), status: 'ok', load: 25 },
        ],
        links: [link('users', 'edge'), link('edge', 'limiter'), link('limiter', 'api')],
        flows: [
          { path: ['users', 'edge', 'limiter', 'api'], tone: 'request', duration: 2.4, label: 'passes 3 checks' },
          { path: ['api', 'limiter', 'edge', 'users'], tone: 'response', duration: 2.4, delay: 2.5 },
        ],
        panel: {
          title: 'Checks in order',
          icon: 'Layers',
          rows: [
            { text: '1. Per IP at the edge', value: 'loose' },
            { text: '2. Per user or API key', value: 'fair' },
            { text: '3. Per endpoint', value: 'precise' },
          ],
        },
        caption: 'Cheap and coarse first, precise last',
      },
    },
    {
      title: 'Quotas',
      tag: 'concept',
      heading: 'Quotas: a slow budget next to the fast one',
      eli5: 'Besides turns per minute, each kid has a ticket book for the month. The minute rule stops a rush. The month rule stops one kid using everything.',
      body: [
        'A **rate limit** guards the next few seconds: 100 per minute. A **quota** guards the billing period: 1 million calls per month on the free tier. Same counting idea, much longer window.',
        'They solve different problems and run side by side. A client can be well under its quota and still hit the rate limit during a burst, or the reverse.',
      ],
      keyIdea: 'Rate limits protect capacity right now. Quotas protect the business over a month.',
      metrics: { qps: '2k/s', p99: '120 ms', errors: '0.1%', rejected: '~10k/s', rule: '100/min + 1M/month' },
      metricTones: { qps: 'good' },
      scene: {
        nodes: [
          { ...users, chips: ['key: free tier'] },
          { ...limiter, label: 'limiter', sub: 'rate + quota', status: 'active', badge: 'month: 412k / 1M' },
          { ...api, status: 'ok', load: 25 },
        ],
        links: [link('users', 'limiter'), link('limiter', 'api')],
        flows: [{ path: ['users', 'limiter', 'api'], tone: 'request', duration: 1.8, label: 'both checks pass' }],
        panel: {
          title: 'Two budgets, one key',
          icon: 'Scale',
          rows: [
            { text: 'Rate limit', value: '100 per minute' },
            { text: 'Quota, free tier', value: '1M per month' },
            { text: 'Rate limit protects', value: 'capacity now', tone: 'good' },
            { text: 'Quota protects', value: 'the bill', tone: 'good' },
          ],
        },
        caption: 'A short window and a long window together',
      },
    },
    {
      title: 'Shared counter',
      tag: 'case',
      heading: 'Case: two limiters, double the limit',
      eli5: 'Two teachers with separate cards each allow 100 turns, so the sneaky kid gets 200. Add a third teacher and he gets 300.',
      body: [
        'Traffic grows and you run the limiter on two gateway nodes behind a load balancer. Each keeps its own counters in memory, so the scraper gets 100 per minute **on each node**: 200 in total.',
        'With 10 nodes it gets 1,000. The more you scale out, the weaker the limit gets.',
      ],
      keyIdea: 'Per-node counters multiply the limit by the node count.',
      metrics: { qps: '2k/s', p99: '120 ms', errors: '0.1%', rejected: 'half of what it should be', rule: '100/min, per node' },
      metricTones: { rejected: 'bad', rule: 'bad' },
      scene: {
        nodes: [
          { ...client, chips: [{ text: '200 pass in a minute', tone: 'warn' }] },
          { ...l1, status: 'active', badge: 'count 100/100' },
          { ...l2, status: 'active', badge: 'count 100/100' },
        ],
        links: [link('client', 'l1'), link('client', 'l2')],
        flows: [
          { path: ['client', 'l1'], tone: 'request', count: 4, duration: 1, label: '100 allowed' },
          { path: ['client', 'l2'], tone: 'request', count: 4, duration: 1, delay: 0.3, label: '100 allowed' },
        ],
        panel: {
          title: 'Effective limit',
          icon: 'Scale',
          rows: [
            { text: '1 node', value: '100 / min' },
            { text: '2 nodes', value: '200 / min', tone: 'warn' },
            { text: '10 nodes', value: '1,000 / min', tone: 'bad' },
          ],
        },
        caption: 'Every node hands out a full budget',
      },
    },
    {
      title: 'The race',
      tag: 'case',
      heading: 'A shared store has its own race',
      eli5: 'Both teachers look at the shared chalkboard at once. Both see 99, both say yes, and both write 100. Two turns were given, but the board only counts one.',
      body: [
        'The fix is to keep counters in a shared store such as **Redis**. That opens a race. If each node does `GET`, checks, then `SET`, two nodes can both read 99, both allow, and both write 100.',
        'Under a burst the overshoot is much larger than one, because dozens of requests read the same stale value.',
      ],
      keyIdea: 'Read, check and write as separate steps race. Two nodes can both act on the same stale count.',
      metrics: { qps: '2k/s', p99: '121 ms', errors: '0.1%', rejected: 'leaks past 100', rule: '100/min, shared' },
      metricTones: { rejected: 'warn' },
      scene: {
        nodes: [
          { ...l1, status: 'active', badge: 'read 99, allow' },
          { ...l2, status: 'active', badge: 'read 99, allow' },
          { ...redis, status: 'hot', badge: 'SET 100, SET 100' },
        ],
        links: [link('l1', 'redis', { style: 'dashed' }), link('l2', 'redis', { style: 'dashed' })],
        flows: [
          { path: ['redis', 'l1'], tone: 'data', duration: 0.9, label: 'GET → 99' },
          { path: ['redis', 'l2'], tone: 'data', duration: 0.9, label: 'GET → 99' },
          { path: ['l1', 'redis'], tone: 'data', duration: 0.9, delay: 1.1, label: 'SET 100' },
          { path: ['l2', 'redis'], tone: 'data', duration: 0.9, delay: 1.1, label: 'SET 100' },
        ],
        panel: {
          title: 'Interleaved steps',
          icon: 'Bug',
          code: 'A: GET count     -> 99\nB: GET count     -> 99\nA: 99 < 100, allow\nB: 99 < 100, allow\nA: SET count 100\nB: SET count 100',
          footer: { text: '101 requests served, counter says 100', tone: 'bad' },
        },
        caption: 'Two reads of 99, two yeses',
      },
    },
    {
      title: 'Atomic count',
      tag: 'concept',
      heading: 'Make the check and the update one step',
      eli5: 'The teacher takes the chalk and makes one mark that returns the new number at the same moment. The next teacher has to wait for the chalk.',
      body: [
        '`INCR` is atomic and returns the new value, so the node decides on that. Exactly one of two racing requests gets the last slot.',
        'Pair it with `EXPIRE` inside a **Lua script**, which Redis runs start to finish. A crash between a separate `INCR` and `EXPIRE` leaves a key that never resets. This fixed window is the simplest case. A token bucket also needs one script: read tokens and timestamp, refill, take, write back.',
      ],
      keyIdea: 'Use an atomic INCR, and set the expiry in the same Lua script so no crash can leave a key that never resets.',
      metrics: { qps: '2k/s', p99: '121 ms', errors: '0.1%', rejected: '~10k/s', rule: '100/min, shared' },
      metricTones: { rejected: 'warn', errors: 'good' },
      scene: {
        nodes: [
          { ...client, chips: ['req A', 'req B'] },
          { ...l1, status: 'active' },
          { ...l2, status: 'active' },
          { ...redis, status: 'active', badge: 'INCR → 101' },
        ],
        links: [link('client', 'l1'), link('client', 'l2'), link('l1', 'redis', { style: 'dashed' }), link('l2', 'redis', { style: 'dashed' })],
        flows: [
          { path: ['client', 'l1'], tone: 'request', duration: 1, label: 'req A' },
          { path: ['client', 'l2'], tone: 'request', duration: 1, label: 'req B' },
          { path: ['l1', 'redis'], tone: 'data', duration: 0.9, delay: 1.05, label: 'INCR → 100' },
          { path: ['l2', 'redis'], tone: 'data', duration: 0.9, delay: 1.05, label: 'INCR → 101' },
          { path: ['l2', 'client'], tone: 'error', duration: 1, delay: 2, label: '429' },
        ],
        panel: {
          title: 'One round trip',
          icon: 'Zap',
          rows: [
            { text: 'INCR returns', value: 'the new count' },
            { text: 'First racer', value: '100, allow', tone: 'good' },
            { text: 'Second racer', value: '101, reject', tone: 'bad' },
          ],
        },
        caption: 'Atomic INCR: exactly one of the two racing requests gets the last slot',
      },
      code: {
        language: 'typescript',
        title: 'Atomic fixed window in Redis (Lua)',
        source: `// Redis runs the whole script before any other command: no race, one round trip.
// Fixed window is the simplest case. A token bucket does read, refill, take, write back in one script too.
const FIXED_WINDOW = \`
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return count
\`;

export async function allow(key: string, limit = 100, windowSec = 60) {
  const slot = Math.floor(Date.now() / 1000 / windowSec);
  const redisKey = \`rl:\${key}:\${slot}\`;
  const count = (await redis.eval(FIXED_WINDOW, 1, redisKey, windowSec)) as number;
  return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
}`,
        highlight: [4, 5, 6, 14],
      },
    },
    {
      title: 'Local plus sync',
      tag: 'tradeoff',
      heading: 'At very high QPS, count locally and sync',
      eli5: 'If every turn needs a trip to the chalkboard, the line gets long. So each teacher keeps a pad and walks to the board now and then to add up.',
      body: [
        'Every Redis call adds a network round trip to every request. At very high QPS, nodes keep **local counters** and push them to the shared store every second or so, pulling the global total back.',
        'The cost is accuracy. Between syncs a node cannot see what the others spent, so the limit can overshoot a little. You trade exactness for fewer round trips.',
      ],
      keyIdea: 'Local counters with periodic sync cut Redis load and latency, and allow a small bounded overshoot.',
      metrics: { qps: '50k/s', p99: '118 ms', errors: '0.1%', rejected: '~10k/s', rule: '100/min, approx' },
      metricTones: { p99: 'good', rule: 'warn' },
      scene: {
        nodes: [
          { ...l1, status: 'active', badge: 'local 37', chips: [{ text: 'sync every 1 s', tone: 'default' }] },
          { ...l2, status: 'active', badge: 'local 41', chips: [{ text: 'sync every 1 s', tone: 'default' }] },
          { ...redis, status: 'ok', badge: 'global 78' },
        ],
        links: [link('l1', 'redis', { style: 'dashed', label: 'batched add' }), link('l2', 'redis', { style: 'dashed', label: 'batched add' })],
        flows: [
          { path: ['l1', 'redis'], tone: 'data', duration: 1, delay: 0.6, label: '+37' },
          { path: ['l2', 'redis'], tone: 'data', duration: 1, delay: 0.6, label: '+41' },
        ],
        panel: {
          title: 'Exact vs local',
          icon: 'Scale',
          rows: [
            { text: 'Redis call per request', value: 'exact, +1 round trip' },
            { text: 'Local + sync', value: 'approx, no extra hop', tone: 'good' },
            { text: 'Overshoot', value: 'what nodes spend between syncs', tone: 'warn' },
          ],
        },
        caption: 'Count on the pad, sync with the board',
      },
    },
    {
      title: 'Store down',
      tag: 'tradeoff',
      heading: 'Redis is down: fail open or fail closed?',
      eli5: 'The chalkboard falls over. To **fail open**, the teacher lets kids keep sliding and counts on her fingers. At the shed with the sharp tools, she lets nobody in until the board is back.',
      body: [
        'Every request now depends on Redis. When it times out, the limiter must choose. **Fail open** lets requests through unchecked: the API stays up but is unprotected.',
        '**Fail closed** rejects them: you are protected, and the limiter has just caused a full outage.',
      ],
      keyIdea: 'An unreachable limiter forces a choice between an unprotected API and an outage.',
      metrics: { qps: '2.1k/s', p99: '125 ms', errors: '0.1%', rejected: 'unknown', rule: 'store unreachable' },
      metricTones: { rejected: 'warn', rule: 'bad' },
      scene: {
        nodes: [
          { ...l1, status: 'active', badge: 'fail open' },
          { ...l2, status: 'active', badge: 'fail closed' },
          { ...redis, status: 'down', badge: 'timeout' },
        ],
        links: [link('l1', 'redis', { style: 'dashed' }), link('l2', 'redis', { style: 'dashed' })],
        flows: [
          { path: ['l1', 'redis'], tone: 'error', duration: 0.8, label: 'timeout' },
          { path: ['l2', 'redis'], tone: 'error', duration: 0.8, delay: 0.2, label: 'timeout' },
        ],
        panel: {
          title: 'Two policies',
          icon: 'Shield',
          rows: [
            { text: 'Fail open', value: 'API up, unprotected', tone: 'warn' },
            { text: 'Fail closed', value: 'protected, outage', tone: 'bad' },
          ],
        },
        caption: 'Neither answer is free',
      },
    },
    {
      title: 'Fallback plan',
      tag: 'tradeoff',
      heading: 'Decide per route, with a local fallback',
      eli5: 'The playground keeps going with the teacher counting on her fingers. The shed with the sharp tools stays locked until the board is back.',
      body: [
        'Most public APIs fail open for normal traffic and fall back to a generous **in-memory limit** on each node, so the scraper cannot run wild while Redis recovers. Login, one-time codes and payments fail closed, because unlimited guesses are worse than a few minutes of errors.',
      ],
      keyIdea: 'Decide per route what an unreachable limiter means. Availability usually wins, except where an unlimited caller is the bigger risk.',
      metrics: { qps: '2.1k/s', p99: '125 ms', errors: '0.1%', rejected: 'local only', rule: 'local fallback' },
      metricTones: { qps: 'good', errors: 'good' },
      scene: {
        nodes: [
          users,
          scraper,
          { ...l1, status: 'active', badge: 'open + local limit' },
          { ...l2, status: 'active', badge: '/login: closed' },
          { ...redis, status: 'down', badge: 'unreachable' },
        ],
        links: [
          link('users', 'l1'),
          link('scraper', 'l2'),
          link('l1', 'redis', { style: 'dashed' }),
          link('l2', 'redis', { style: 'dashed' }),
        ],
        flows: [
          { path: ['users', 'l1'], tone: 'request', count: 3, duration: 1, delay: 0.4, label: 'allowed' },
          { path: ['scraper', 'l2'], tone: 'request', count: 2, duration: 1, delay: 0.6, label: 'POST /login' },
          { path: ['l2', 'scraper'], tone: 'error', duration: 1, delay: 1.7, label: '503' },
        ],
        panel: {
          title: 'Policy by route',
          icon: 'Route',
          rows: [
            { text: 'GET /feed', value: 'open + local limit', tone: 'good' },
            { text: 'POST /login', value: 'closed', tone: 'bad' },
          ],
        },
        caption: 'Normal routes stay up, the login route stays locked',
      },
      quiz: {
        question: 'Redis, your limiter store, goes down. Your /login route allows 5 attempts per minute per account. What should /login do?',
        options: [
          'Fail open and allow everything until Redis is back',
          'Fail closed and reject requests until Redis is back',
          'Wait up to 30 seconds for Redis to answer',
          'Switch to a limit of 100 per minute per account',
        ],
        answer: 1,
        explain: 'Unlimited password guesses are a bigger risk than a few minutes of failed logins. Normal read routes fail open with a local limit. A long wait is worst, because it adds latency to every request until a circuit breaker steps in.',
      },
    },
    {
      title: 'Circuit breaker',
      tag: 'concept',
      heading: 'Time out fast, then stop calling Redis',
      eli5: 'If the chalkboard is broken, the teacher should not walk over and check it for every kid. She gives it a quick look, and after a few tries she stops and checks again in a minute.',
      body: [
        'Put a short timeout on the Redis call, around 5 ms. A slow store adds its latency to every request, which hurts more than a dead one.',
        'A timeout alone still charges every request 5 ms while Redis is down. A **circuit breaker** fixes that: after N timeouts in a row it opens and skips Redis, using the local fallback. After a pause it lets one request try again.',
      ],
      keyIdea: 'A short timeout bounds each wait. A circuit breaker stops the waiting altogether until the store looks healthy.',
      metrics: { qps: '2.1k/s', p99: '121 ms', errors: '0.1%', rejected: 'local only', rule: 'breaker open' },
      metricTones: { qps: 'good', p99: 'good', errors: 'good', rule: 'warn' },
      scene: {
        nodes: [
          users,
          { ...l1, status: 'active', badge: 'breaker open' },
          { ...redis, status: 'down', badge: '5 ms timeout' },
        ],
        links: [link('users', 'l1'), link('l1', 'redis', { style: 'dashed', label: 'skipped while open', labelTone: 'warn' })],
        flows: [
          { path: ['users', 'l1'], tone: 'request', count: 3, duration: 1, label: 'GET /feed' },
          { path: ['l1', 'redis'], tone: 'error', duration: 0.8, delay: 1.2, label: 'probe, timeout' },
        ],
        panel: {
          title: 'Breaker states',
          icon: 'Shield',
          rows: [
            { text: 'Closed', value: 'call Redis, 5 ms cap', tone: 'good' },
            { text: 'Open after N timeouts', value: 'skip Redis, local limit', tone: 'warn' },
            { text: 'After a pause', value: 'one probe, then decide' },
          ],
        },
        caption: 'Stop paying for a store that is not answering',
      },
    },
    {
      title: 'Many regions',
      tag: 'case',
      heading: 'Case: one client, two data centers',
      eli5: 'There are two playgrounds with a teacher each. A kid who runs between them gets 100 turns at each unless the teachers phone each other.',
      body: [
        'With data centers in the US and EU, each region counts on its own, because a cross-ocean Redis call on every request is too slow. A client that sends traffic to both gets two budgets.',
        'Regions share counts in the background with **eventual consistency**: a few seconds of lag and a small overshoot. Or you route each key to a home region so one place counts it.',
      ],
      keyIdea: 'Each region enforces locally and syncs in the background. Accept a small overshoot to avoid slow cross-region calls.',
      metrics: { qps: '2k/s', p99: '120 ms', errors: '0.1%', rejected: '~10k/s', rule: '100/min, 2 regions' },
      metricTones: { rule: 'warn' },
      scene: {
        nodes: [
          { ...client, chips: ['US + EU traffic'] },
          { ...l1, label: 'limiter US', sub: 'region us', status: 'active', badge: '60 / 100' },
          { ...l2, label: 'limiter EU', sub: 'region eu', status: 'active', badge: '55 / 100' },
        ],
        links: [
          link('client', 'l1'),
          link('client', 'l2'),
          link('l1', 'l2', { style: 'dashed', arrow: 'both', route: 'straight', label: 'async sync, 2 s lag', labelTone: 'warn' }),
        ],
        flows: [
          { path: ['client', 'l1'], tone: 'request', count: 3, duration: 1 },
          { path: ['client', 'l2'], tone: 'request', count: 3, duration: 1, delay: 0.3 },
          { path: ['l1', 'l2'], tone: 'data', duration: 1.2, delay: 1.5, label: 'counts' },
        ],
        panel: {
          title: 'Two ways',
          icon: 'Globe',
          rows: [
            { text: 'Local count + async sync', value: 'fast, small overshoot', tone: 'good' },
            { text: 'Home region per key', value: 'exact, cross-region hop', tone: 'warn' },
          ],
        },
        caption: 'Count near the user, reconcile later',
      },
    },
    {
      title: 'Hard vs soft',
      tag: 'tradeoff',
      heading: 'Hard limits refuse, soft limits warn',
      eli5: 'A hard rule is a locked gate. A soft rule is the teacher saying "that is a lot of turns" while she keeps watching, and only closes the gate if the kid keeps going.',
      body: [
        'A **hard limit** can never be exceeded: the request is rejected. A **soft limit** can be exceeded briefly: the request still passes, but it is flagged, slowed or alerted on.',
        'Use soft limits when blocking a paying customer is worse than the overage, and hard limits for protection: logins, payments and anything that would break a downstream.',
      ],
      keyIdea: 'Hard limits protect systems. Soft limits protect relationships. Choose per rule.',
      metrics: { qps: '2k/s', p99: '120 ms', errors: '0.1%', rejected: 'hard only', rule: 'hard + soft' },
      metricTones: { qps: 'good' },
      scene: {
        nodes: [
          { ...users, chips: [{ text: '110 / 100, soft', tone: 'warn' }] },
          { ...limiter, status: 'active', badge: 'soft: allow + alert' },
          { ...api, status: 'ok', load: 30 },
        ],
        links: [link('users', 'limiter'), link('limiter', 'api')],
        flows: [{ path: ['users', 'limiter', 'api'], tone: 'request', duration: 1.8, label: '101st request, allowed' }],
        panel: {
          title: 'At 101 of 100',
          icon: 'Gauge',
          rows: [
            { text: 'Hard limit', value: 'reject, 429', tone: 'bad' },
            { text: 'Soft limit', value: 'allow, flag, alert', tone: 'warn' },
            { text: 'Fits', value: 'login: hard, API tier: soft' },
          ],
        },
        caption: 'Refuse, or notice and carry on',
      },
    },
    {
      title: 'Rules as config',
      tag: 'concept',
      heading: 'Keep the rules in config, not in code',
      eli5: 'The teacher keeps a rule sheet on the wall instead of in her head. Changing the number of turns means editing the sheet, and no kid has to learn anything new.',
      body: [
        'Limits change often: a new customer tier, an abuse spike, a cheaper endpoint. Put each rule in a config file or store with a key pattern, a unit and a number, and have limiters reload it on change.',
        'A change then ships in seconds without a code deploy, and rules can be reviewed like any other config.',
      ],
      keyIdea: 'Rules in config let you tune limits in seconds, with no deploy and with a review trail.',
      metrics: { qps: '2k/s', p99: '120 ms', errors: '0.1%', rejected: '~10k/s', rule: 'from config' },
      metricTones: { errors: 'good' },
      scene: {
        nodes: [
          { id: 'config', kind: 'block', at: at(-4.2, 0), label: 'rules config', sub: 'reviewed + versioned', icon: 'FileCode', tint: 'teal' },
          { ...limiter, status: 'active', badge: 'reloaded' },
          { ...api, status: 'ok', load: 25 },
        ],
        links: [link('config', 'limiter', { label: 'reload on change' }), link('limiter', 'api')],
        flows: [{ path: ['config', 'limiter'], tone: 'data', duration: 1.2, label: 'new limits' }],
        panel: {
          title: 'Why config',
          icon: 'List',
          rows: [
            { text: 'Change a number', value: 'no deploy', tone: 'good' },
            { text: 'Per tier or route', value: 'one rule each' },
            { text: 'History', value: 'in version control' },
          ],
        },
        caption: 'Limits you can turn like a dial',
      },
      code: {
        language: 'yaml',
        title: 'Rate limit rules',
        source: `rules:
  - match: { route: /login }
    key: account
    limit: 5
    per: minute
    mode: hard
  - match: { route: /search }
    key: api_key
    limit: 60
    per: minute
    mode: hard
  - match: { tier: free }
    key: api_key
    limit: 1000000
    per: month
    mode: soft`,
        highlight: [2, 3, 4, 5, 6],
      },
    },
    {
      title: 'Monitor it',
      tag: 'concept',
      heading: 'Watch the limiter, or it fails quietly',
      eli5: 'A teacher with a clipboard notices when too many kids are being turned away, or when no one is, and changes the rules to match.',
      body: [
        'Track 429s per rule and per key, allowed versus rejected, and the limiter\'s own latency. A spike of 429s from many real users says the rule is too strict. Zero 429s during an attack says it is not working.',
        'Alert on both. Check after launches and traffic events that the algorithm and the numbers still fit real behavior.',
      ],
      keyIdea: 'Monitor 429s per rule to catch limits that are too tight or too loose.',
      metrics: { qps: '2k/s', p99: '120 ms', errors: '0.1%', rejected: '0.4% of requests', rule: 'watched' },
      metricTones: { rejected: 'good' },
      scene: {
        nodes: [
          { ...limiter, status: 'active', badge: '429s: 0.4%' },
          { id: 'monitor', kind: 'monitor', at: at(4.4, -3.4), label: 'metrics', sub: '429s per rule', status: 'ok' },
          { id: 'alert', kind: 'block', at: at(8.6, 3.4), label: 'alerts', sub: 'on-call', icon: 'Bug', tint: 'red' },
        ],
        links: [link('limiter', 'monitor', { style: 'dashed' }), link('monitor', 'alert', { style: 'dashed' })],
        flows: [
          { path: ['limiter', 'monitor'], tone: 'event', duration: 1, label: 'allowed / rejected' },
          { path: ['monitor', 'alert'], tone: 'event', duration: 1, delay: 1.2, label: 'page if odd' },
        ],
        panel: {
          title: 'What to alert on',
          icon: 'Activity',
          rows: [
            { text: '429s from many real users', value: 'too strict', tone: 'warn' },
            { text: 'No 429s during an attack', value: 'not working', tone: 'bad' },
            { text: 'Limiter p99 latency', value: 'adds to every request' },
          ],
        },
        caption: 'Numbers that tell you the limits fit',
      },
    },
    {
      title: 'Concurrency',
      tag: 'concept',
      heading: 'Cap what is in flight',
      eli5: 'Turns per minute is not the only worry. If ten kids all get stuck at the top of the slide at once, the ladder is full. So the **concurrency limit** caps how many can be on it right now.',
      body: [
        'A rate limit counts requests per time. A **concurrency limit** caps requests in flight, say 50 per client.',
        'Slow calls pile up under a perfectly fine rate: 20 requests per second that each take 10 seconds is 200 in flight. The cap rejects the 51st until one finishes.',
      ],
      keyIdea: 'Rate limits count requests over time. A concurrency limit caps in-flight work, which slow calls inflate.',
      metrics: { qps: '3.8k/s', p99: '140 ms', errors: '0.2%', rejected: 'over 50 in flight', rule: '50 in flight' },
      metricTones: { qps: 'warn', p99: 'good' },
      scene: {
        nodes: [
          { ...users, chips: [{ text: 'in flight 50 / 50', tone: 'warn' }] },
          { ...limiter, label: 'concurrency cap', sub: '50 per client', status: 'active', badge: '50 / 50' },
          { ...api, status: 'active', load: 70 },
        ],
        links: [link('users', 'limiter'), link('limiter', 'api')],
        flows: [
          { path: ['users', 'limiter', 'api'], tone: 'request', count: 3, duration: 1.8, label: 'slow calls' },
          { path: ['limiter', 'users'], tone: 'error', duration: 1, delay: 1.2, label: '429, 51st call' },
        ],
        panel: {
          title: 'Rate versus in flight',
          icon: 'Layers',
          rows: [
            { text: 'Rate', value: '20 req/s, fine' },
            { text: 'Each call takes', value: '10 s', tone: 'warn' },
            { text: 'In flight', value: '200, over cap', tone: 'bad' },
          ],
        },
        caption: 'A fine rate can still pile up slow work',
      },
    },
    {
      title: 'Load shedding',
      tag: 'concept',
      heading: 'When the whole service is hot, drop the least important',
      eli5: 'The playground is too full for everyone. The teacher sends the kids who are only watching home first, and keeps the ones who need a turn most.',
      body: [
        '**Load shedding** guards the whole service. When overall load passes a threshold, drop the least important requests first, whoever sent them, to keep the important ones fast.',
        'It needs a priority for each request class. Checkout stays, prefetch and analytics go first.',
      ],
      keyIdea: 'Load shedding protects the whole service by dropping low priority work first.',
      metrics: { qps: '3.8k/s', p99: '140 ms', errors: '0.2%', rejected: 'low priority', rule: 'shed above 85%' },
      metricTones: { qps: 'warn', p99: 'good' },
      scene: {
        nodes: [
          { ...users, chips: [{ text: 'checkout', tone: 'good' }, { text: 'prefetch', tone: 'warn' }] },
          { ...limiter, label: 'shedder', sub: 'by priority', status: 'hot', badge: 'load 85%', load: 85 },
          { ...api, status: 'active', load: 85 },
        ],
        links: [link('users', 'limiter'), link('limiter', 'api')],
        flows: [
          { path: ['users', 'limiter', 'api'], tone: 'request', count: 3, duration: 1.8, label: 'priority: checkout' },
          { path: ['limiter', 'users'], tone: 'error', duration: 1, delay: 1.2, label: 'shed: prefetch' },
        ],
        panel: {
          title: 'Priority classes',
          icon: 'List',
          rows: [
            { text: 'P0 checkout, login', value: 'never shed', tone: 'good' },
            { text: 'P1 feed, search', value: 'shed above 95%', tone: 'warn' },
            { text: 'P2 prefetch, analytics', value: 'shed above 85%', tone: 'bad' },
          ],
        },
        caption: 'Drop what matters least, keep what matters most',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Keys, shared counts and a plan for failure',
      eli5: 'A **rate limiter** is the teacher who counts turns per kid by name, shares one chalkboard with the other teachers, has a plan for when the board breaks, and watches the clipboard.',
      body: [
        'Choose the key per endpoint and layer coarse limits in front of precise ones. Across many nodes, keep counters in a shared store and update them atomically with `INCR` or a Lua script.',
        'Decide per route what an unreachable store means. Keep rules in config, watch 429s per rule, and add concurrency limits and load shedding for slow or overloaded paths.',
      ],
      keyIdea: 'Limit per key, count atomically in one place, plan for the limiter itself failing, and watch it.',
      metrics: { qps: '2k/s', p99: '120 ms', errors: '0.1%', rejected: '~10k/s', rule: 'burst 20, 100/min' },
      metricTones: { qps: 'good', p99: 'good', errors: 'good' },
      scene: {
        nodes: [
          { ...client, chips: [{ text: '429', tone: 'bad' }] },
          { ...l1, status: 'active' },
          { ...l2, status: 'active' },
          { ...redis, status: 'ok' },
        ],
        links: [link('client', 'l1'), link('client', 'l2'), link('l1', 'redis', { style: 'dashed' }), link('l2', 'redis', { style: 'dashed' })],
        flows: [
          { path: ['client', 'l1'], tone: 'request', count: 2, duration: 1 },
          { path: ['l1', 'redis'], tone: 'data', duration: 0.8, delay: 1.1 },
          { path: ['l2', 'client'], tone: 'error', count: 2, duration: 1, delay: 1.4, label: '429' },
        ],
        caption: 'One shared count, enforced everywhere',
      },
      quiz: {
        question: 'You run six gateway nodes, each with its own in-memory fixed window of 100 requests per minute per key. The load balancer spreads requests evenly. How many requests per minute can one client get through?',
        options: ['100', '200', '600', 'Unlimited'],
        answer: 2,
        explain: 'Each node counts separately, so the client gets 100 on each of the six nodes. Shared counters in Redis, updated atomically, bring it back to 100.',
      },
    },
  ],
};
