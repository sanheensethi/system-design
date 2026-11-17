import type { Lesson, SceneNode } from '../engine/types';

const users: SceneNode = { id: 'users', kind: 'phone', at: [-5, 2], label: 'app users', sub: '2k req/s total' };
const scraper: SceneNode = { id: 'scraper', kind: 'client', at: [-5.1, -1.4], label: 'scraper', sub: '1 API key' };
const limiter: SceneNode = { id: 'limiter', kind: 'limiter', at: [-1.5, 0], label: 'rate limiter', sub: '100/min per key' };
const limiter2: SceneNode = { id: 'limiter2', kind: 'limiter', at: [-1.5, 2.6], label: 'limiter 2', sub: '100/min per key' };
const api: SceneNode = { id: 'api', kind: 'server', at: [2, 0], label: 'API servers', sub: '4k req/s max' };
const db: SceneNode = { id: 'db', kind: 'db', at: [5, -1.5], label: 'database' };
const redis: SceneNode = { id: 'redis', kind: 'cache', at: [1, -3], label: 'Redis', sub: 'shared counters' };
const bucket: SceneNode = { id: 'bucket', kind: 'queue', at: [4.6, 2.6], label: 'leaky bucket', sub: 'holds 50' };
const sms: SceneNode = { id: 'sms', kind: 'service', at: [6, 1.6], label: 'SMS provider', sub: 'max 30/s' };

export const rateLimiting: Lesson = {
  id: 'rate-limiting',
  title: 'Rate limiting',
  tagline: 'Stop one noisy client from taking the API down for everyone else.',
  minutes: 12,
  level: 'Intermediate',
  learn: [
    'Why one client can hurt every other user',
    'Fixed window, sliding window, token bucket and leaky bucket',
    'How to reject politely with 429 and Retry-After',
    'Sharing counters across servers without a race',
    'Choosing the key, and what to do when the limiter store is down',
  ],
  metrics: [
    { key: 'qps', label: 'Load on API' },
    { key: 'p99', label: 'p99 latency' },
    { key: 'errors', label: '5xx rate' },
    { key: 'rejected', label: '429s' },
    { key: 'rule', label: 'Limit rule' },
  ],
  steps: [
    {
      title: 'The flood',
      tag: 'problem',
      heading: 'One client, and everyone suffers',
      eli5: 'One kid, the **scraper**, runs up the slide again and again without stopping. The slide gets so crowded that the other kids cannot get a turn at all.',
      body: [
        'Your API serves 2,000 requests per second from 50,000 app users. The servers can handle about 4,000, which leaves plenty of headroom until a scraper with one API key starts pulling your whole catalog at **10,000 requests per second**.',
        'The servers do not know which requests matter. They queue everything, CPU pins at 100%, the database falls behind, and p99 latency jumps from 120 ms to 2.4 seconds. Real users start seeing `503` errors.',
        'The scraper may not even be malicious. A mobile app release with a retry bug in a tight loop does exactly the same damage, and it comes from your own users.',
      ],
      keyIdea: 'Shared capacity with no per-client cap means the noisiest client decides how everyone else is served.',
      metrics: { qps: '12k/s', p99: '2.4 s', errors: '18%', rejected: '0', rule: 'none' },
      scene: {
        nodes: [users, scraper, { ...api, status: 'hot', badge: 'CPU 100%' }, { ...db, status: 'hot', badge: 'lagging' }],
        links: [
          { from: 'users', to: 'api' },
          { from: 'scraper', to: 'api' },
          { from: 'api', to: 'db' },
        ],
        flows: [
          { path: ['scraper', 'api'], tone: 'request', count: 8, duration: 1, label: '10k req/s' },
          { path: ['users', 'api'], tone: 'request', count: 2, duration: 1.4, label: 'GET /feed' },
          { path: ['api', 'db'], tone: 'request', count: 5, duration: 1.2, delay: 0.8 },
          { path: ['api', 'users'], tone: 'error', duration: 1.4, delay: 1.6, label: '503' },
        ],
        caption: 'A scraper sends 5x the normal load through the same front door',
      },
    },
    {
      title: 'Add a limiter',
      tag: 'concept',
      heading: 'A guard that counts per client',
      eli5: 'The **rate limiter** is a teacher at the slide ladder who counts each kid\'s turns. After 100 turns in a minute she says no more for now, and tells the kid how long to wait.',
      body: [
        'Put a **rate limiter** in front of the API servers. For every request it reads a key (here the API key), checks how many requests that key made recently, and either lets it through or rejects it on the spot. The rule here: `100 requests per minute per key`.',
        'Rejections must be cheap. The limiter answers in under a millisecond and never touches the API servers or the database, so the scraper\'s 10,000 requests per second cost almost nothing. It usually lives in the API gateway or as middleware in each server.',
        'Reject with **429 Too Many Requests**. A `503` says the server is broken. A `429` says the caller is over its budget, and a `Retry-After` header says when to come back. Well-behaved clients wait that long, plus some random jitter, before retrying.',
      ],
      keyIdea: 'Reject early, reject cheaply, and tell the client exactly when it may try again.',
      metrics: { qps: '2k/s', p99: '120 ms', errors: '0.1%', rejected: '~10k/s', rule: '100/min per key' },
      scene: {
        nodes: [users, scraper, { ...limiter, status: 'active', badge: 'scraper 100/100' }, { ...api, status: 'ok' }, db],
        links: [
          { from: 'users', to: 'limiter' },
          { from: 'scraper', to: 'limiter' },
          { from: 'limiter', to: 'api' },
          { from: 'api', to: 'db' },
        ],
        flows: [
          { path: ['scraper', 'limiter'], tone: 'request', count: 6, duration: 1 },
          { path: ['limiter', 'scraper'], tone: 'error', count: 3, duration: 1, delay: 1.1, label: '429' },
          { path: ['users', 'limiter', 'api'], tone: 'request', duration: 1.6, delay: 0.3, label: 'GET /feed' },
          { path: ['api', 'limiter', 'users'], tone: 'response', duration: 1.6, delay: 2, label: '200 OK' },
        ],
        caption: 'The limiter turns the flood away before it reaches the servers',
      },
      code: {
        language: 'bash',
        title: 'What the scraper sees',
        source: `$ curl -i https://api.example.com/v1/products -H "Authorization: Bearer sk_scraper"
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 23
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1731859260

{"error": "rate_limited", "retry_after_seconds": 23}`,
        highlight: [2, 4, 6],
      },
    },
    {
      title: 'Fixed window',
      tag: 'concept',
      heading: 'The simplest counter: one per minute',
      eli5: 'The teacher keeps a tally card for each kid and wipes every card clean when the minute bell rings. That is a **fixed window**: 100 turns per bell.',
      body: [
        'The easiest way to count is a **fixed window**. Split time into one-minute slots and keep one counter per key per slot, named something like `rl:user42:12:01`.',
        'Each request increments the counter. If the new value is above 100, reject. When the minute ends, a fresh counter starts at zero and the old one expires.',
        'It costs one integer per active key and one increment per request. A million active users fit in a few tens of megabytes. That is why it is the default in many gateways.',
      ],
      keyIdea: 'A fixed window is one counter per key per time slot. Cheap and easy to explain, with a catch at the edges.',
      metrics: { qps: '2k/s', p99: '120 ms', errors: '0.1%', rejected: '~10k/s', rule: '100/min fixed' },
      scene: {
        nodes: [users, scraper, { ...limiter, status: 'active', badge: '57 / 100 · 12:01' }, api, db],
        links: [
          { from: 'users', to: 'limiter' },
          { from: 'scraper', to: 'limiter' },
          { from: 'limiter', to: 'api' },
          { from: 'api', to: 'db' },
        ],
        flows: [
          { path: ['users', 'limiter'], tone: 'request', duration: 1.2, label: 'INCR rl:user42:12:01' },
          { path: ['limiter', 'api'], tone: 'request', duration: 1, delay: 1.25, label: '58 ≤ 100, allow' },
          { path: ['scraper', 'limiter'], tone: 'request', count: 4, duration: 1, delay: 0.4 },
          { path: ['limiter', 'scraper'], tone: 'error', count: 2, duration: 1, delay: 1.5, label: '101 > 100' },
        ],
        caption: 'One counter per key per minute',
      },
    },
    {
      title: 'Boundary burst',
      tag: 'case',
      heading: 'Case: 200 requests in two seconds',
      eli5: 'The sneaky kid takes 100 turns just before the bell and 100 more just after it. This **boundary burst** gives 200 turns in two seconds, and the teacher\'s cards say that is fine.',
      body: [
        'The scraper reads your docs and learns the rule. It sends 100 requests at `12:00:59`, the last second of one window, and 100 more at `12:01:00`, the first second of the next. Both batches are allowed.',
        'That is **200 requests in two seconds**, twice the limit inside a single 60-second span. Now picture 10,000 bots and cron jobs that all fire at the top of each minute. Each one obeys the rule, yet your servers get a spike every 60 seconds.',
      ],
      keyIdea: 'Fixed windows reset all at once, so a client can spend two windows of budget back to back and line up its bursts with everyone else\'s.',
      metrics: { qps: '4k/s at :00', p99: '900 ms', errors: '2%', rejected: '0 at :00', rule: '100/min fixed' },
      scene: {
        nodes: [users, scraper, { ...limiter, status: 'active', badge: 'reset to 0' }, { ...api, status: 'hot', badge: '200 in 2 s' }, db],
        links: [
          { from: 'users', to: 'limiter' },
          { from: 'scraper', to: 'limiter' },
          { from: 'limiter', to: 'api' },
          { from: 'api', to: 'db' },
        ],
        flows: [
          { path: ['scraper', 'limiter', 'api'], tone: 'request', count: 6, duration: 1.4, label: '100 @ 12:00:59' },
          { path: ['scraper', 'limiter', 'api'], tone: 'request', count: 6, duration: 1.4, delay: 1.2, label: '100 @ 12:01:00' },
          { path: ['users', 'limiter', 'api'], tone: 'request', duration: 2.4, delay: 0.6 },
        ],
        caption: 'Two full windows of budget spent across one boundary',
      },
    },
    {
      title: 'Sliding window',
      tag: 'concept',
      heading: 'Count the last 60 seconds, wherever they fall',
      eli5: 'With a **sliding window**, the teacher looks back over the last 60 seconds from right now, no matter when the bell rang. The trick around the bell stops working.',
      body: [
        'The **sliding window log** stores a timestamp for every request, for example in a Redis sorted set. To decide, drop timestamps older than 60 seconds and count what is left. It is exact, but memory grows with the limit: 100 entries per key across a million keys is several gigabytes.',
        'The **sliding window counter** keeps just two counters, this minute and last minute, and blends them. Fifteen seconds into the current minute, 75% of the previous window still falls inside the last 60 seconds. With 80 requests last minute and 30 so far: `30 + 80 × 0.75 = 90`. That is under 100, so the request is allowed.',
        'The blend assumes last minute\'s requests were spread evenly, so it is an estimate. Cloudflare measured it wrong on about 0.003% of requests, which is why it is a common default: near-exact for two integers per key.',
      ],
      keyIdea: 'Sliding windows remove the boundary burst. The log is exact and heavy, the counter is an estimate that is light and close enough.',
      metrics: { qps: '2k/s', p99: '120 ms', errors: '0.1%', rejected: '~10k/s', rule: '100/min sliding' },
      scene: {
        nodes: [users, scraper, { ...limiter, status: 'active', badge: 'est. 90 / 100' }, { ...api, status: 'ok' }, db],
        links: [
          { from: 'users', to: 'limiter' },
          { from: 'scraper', to: 'limiter' },
          { from: 'limiter', to: 'api' },
          { from: 'api', to: 'db' },
        ],
        flows: [
          { path: ['scraper', 'limiter'], tone: 'request', count: 6, duration: 1, label: '100 @ 12:01:00' },
          { path: ['limiter', 'scraper'], tone: 'error', count: 4, duration: 1, delay: 1.1, label: '429' },
          { path: ['users', 'limiter', 'api'], tone: 'request', duration: 1.8, delay: 0.4 },
          { path: ['api', 'limiter', 'users'], tone: 'response', duration: 1.8, delay: 2.3 },
        ],
        caption: 'The boundary burst now hits the limit',
      },
    },
    {
      title: 'Token bucket',
      tag: 'concept',
      heading: 'A budget that refills: rate plus burst',
      eli5: 'Each kid has a cup that holds 20 turn tickets, and the teacher drops in new ones at a steady pace. This **token bucket** lets a kid take a few quick turns in a row, then wait for more tickets.',
      body: [
        'A **token bucket** gives each key a bucket that holds up to `B` tokens and refills at `R` tokens per second. Each request takes one token. An empty bucket means 429.',
        'The two knobs mean different things. `R` is the sustained rate you can afford. `B` is the burst you are willing to absorb. With `B = 20` and `R = 100/min`, opening the app fires 15 calls at once and all of them pass, but a client cannot average more than 100 per minute.',
        'You do not need a timer to refill. Store the token count and the last refill time, and top up on each request based on elapsed time. Stripe and AWS API Gateway both describe their limits this way.',
      ],
      keyIdea: 'Token bucket separates "how fast on average" from "how big a burst", which matches how real clients behave.',
      metrics: { qps: '2k/s', p99: '115 ms', errors: '0.1%', rejected: '~10k/s', rule: 'burst 20, 100/min' },
      scene: {
        nodes: [{ ...users, badge: 'app open: 15 calls' }, scraper, { ...limiter, status: 'active', badge: 'tokens 5 / 20' }, { ...api, status: 'ok' }, db],
        links: [
          { from: 'users', to: 'limiter' },
          { from: 'scraper', to: 'limiter' },
          { from: 'limiter', to: 'api' },
          { from: 'api', to: 'db' },
        ],
        flows: [
          { path: ['users', 'limiter', 'api'], tone: 'request', count: 5, duration: 1.6, label: 'burst passes' },
          { path: ['scraper', 'limiter'], tone: 'request', count: 5, duration: 1, delay: 0.6 },
          { path: ['limiter', 'scraper'], tone: 'error', count: 3, duration: 1, delay: 1.7, label: 'bucket empty' },
        ],
        caption: 'Bursts up to B pass, the average is held to R',
      },
      code: {
        language: 'typescript',
        title: 'Token bucket with lazy refill',
        source: `class TokenBucket {
  private tokens: number;
  private last = Date.now();

  constructor(private capacity: number, private refillPerSec: number) {
    this.tokens = capacity; // start full so the first burst passes
  }

  tryTake(cost = 1): boolean {
    const now = Date.now();
    const elapsed = (now - this.last) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerSec);
    this.last = now;
    if (this.tokens < cost) return false; // caller sends 429
    this.tokens -= cost;
    return true;
  }
}

const buckets = new Map<string, TokenBucket>();
export function allow(key: string): boolean {
  if (!buckets.has(key)) buckets.set(key, new TokenBucket(20, 100 / 60));
  return buckets.get(key)!.tryTake();
}`,
        highlight: [11, 12, 14, 22],
      },
    },
    {
      title: 'Leaky bucket',
      tag: 'tradeoff',
      heading: 'Smooth output for a strict downstream',
      eli5: 'The water fountain can only serve so fast. The **leaky bucket** is the line in front of it: kids arrive in a rush and leave one by one, and when the line is full, the rest are sent away.',
      body: [
        'A **leaky bucket** puts requests into a queue that drains at a fixed rate. Bursts go in, a steady trickle comes out. When the queue is full, new requests are dropped.',
        'It fits calls you make to someone else. Your SMS provider cuts you off above 30 messages per second, and a marketing push triggers 200 signups in one second. A queue of 50 draining at 30 per second keeps you under their limit no matter how bursty signups get.',
        'The cost is waiting. The last message in a full queue waits about 1.7 seconds, and anything beyond 50 is rejected. For your own API, a token bucket usually serves users better because it lets bursts through immediately.',
      ],
      keyIdea: 'Token bucket lets bursts through. Leaky bucket flattens them into a constant rate, at the price of queueing delay.',
      metrics: { qps: '2k/s', p99: '120 ms', errors: '0.1%', rejected: '150 of 200', rule: 'SMS: 30/s drain' },
      scene: {
        nodes: [
          users,
          { ...scraper, status: 'dim' },
          limiter,
          { ...api, status: 'active' },
          { ...db, status: 'dim' },
          { ...bucket, status: 'hot', badge: '50 / 50' },
          { ...sms, status: 'ok', badge: '30/s steady' },
        ],
        links: [
          { from: 'users', to: 'limiter' },
          { from: 'limiter', to: 'api' },
          { from: 'api', to: 'db', style: 'faint' },
          { from: 'api', to: 'bucket' },
          { from: 'bucket', to: 'sms' },
        ],
        flows: [
          { path: ['users', 'limiter', 'api'], tone: 'request', count: 6, duration: 1.2, label: '200 signups' },
          { path: ['api', 'bucket'], tone: 'event', count: 6, duration: 0.8, delay: 1.2 },
          { path: ['bucket', 'api'], tone: 'error', duration: 0.8, delay: 2.1, label: 'full, drop' },
          { path: ['bucket', 'sms'], tone: 'request', duration: 0.9, delay: 1.6 },
          { path: ['bucket', 'sms'], tone: 'request', duration: 0.9, delay: 2.3 },
          { path: ['bucket', 'sms'], tone: 'request', duration: 0.9, delay: 3 },
          { path: ['bucket', 'sms'], tone: 'request', duration: 0.9, delay: 3.7 },
        ],
        caption: 'Bursty in, evenly spaced out',
      },
      quiz: {
        question: 'Your payment partner rejects you if you exceed 50 calls per second, even for a moment. Checkout traffic arrives in sharp bursts. Which limiter shape fits your outbound calls?',
        options: [
          'Fixed window of 3,000 per minute',
          'Token bucket with a burst of 500',
          'Leaky bucket draining at 50 per second',
          'No limiter, retry when the partner says no',
        ],
        answer: 2,
        explain: 'The partner cares about the instantaneous rate. A leaky bucket is the only option here that guarantees a flat output, while a fixed window or a big token bucket can still send hundreds in one second.',
      },
    },
    {
      title: 'Shared counter',
      tag: 'case',
      heading: 'Case: two limiters, double the limit',
      eli5: 'Two teachers with separate cards each allow 100 turns, so the sneaky kid gets 200. One shared chalkboard, called **Redis** here, lets both teachers add to the same count, one mark at a time.',
      body: [
        'Traffic grows and you run the limiter on two gateway nodes behind a load balancer. Each keeps its own counters in memory, so the scraper gets 100 per minute **on each node**: 200 in total. With 10 nodes it gets 1,000.',
        'The fix is to keep counters in a shared store such as **Redis**. That opens a race. If each node does `GET`, checks, then `SET`, two nodes can both read 99, both allow, and both write 100. Under a burst the overshoot is much larger than one.',
        'Make the check and the update one atomic step. `INCR` is atomic, and it returns the new value, so the node decides on that. Pair it with `EXPIRE` inside a **Lua script**, which Redis runs start to finish with no other command in between. A crash between a separate `INCR` and `EXPIRE` would leave a key that never resets.',
      ],
      keyIdea: 'Per-node counters multiply the limit by the node count. A shared store fixes that only if read, check and write happen as one atomic operation.',
      metrics: { qps: '2k/s', p99: '121 ms', errors: '0.1%', rejected: '~10k/s', rule: '100/min, shared' },
      scene: {
        nodes: [
          users,
          scraper,
          { ...limiter, label: 'limiter 1', status: 'active' },
          { ...limiter2, status: 'active' },
          { ...redis, status: 'active', badge: 'INCR → 101' },
          { ...api, status: 'ok' },
          db,
        ],
        links: [
          { from: 'users', to: 'limiter2' },
          { from: 'scraper', to: 'limiter' },
          { from: 'scraper', to: 'limiter2' },
          { from: 'limiter', to: 'redis', style: 'dashed' },
          { from: 'limiter2', to: 'redis', style: 'dashed' },
          { from: 'limiter', to: 'api' },
          { from: 'limiter2', to: 'api' },
          { from: 'api', to: 'db' },
        ],
        flows: [
          { path: ['scraper', 'limiter'], tone: 'request', duration: 1, label: 'req A' },
          { path: ['scraper', 'limiter2'], tone: 'request', duration: 1, label: 'req B' },
          { path: ['limiter', 'redis'], tone: 'data', duration: 0.9, delay: 1.05, label: 'INCR → 100' },
          { path: ['limiter2', 'redis'], tone: 'data', duration: 0.9, delay: 1.05, label: 'INCR → 101' },
          { path: ['limiter', 'api'], tone: 'request', duration: 1, delay: 2 },
          { path: ['limiter2', 'scraper'], tone: 'error', duration: 1, delay: 2, label: '429' },
        ],
        caption: 'Atomic INCR: exactly one of the two racing requests gets the last slot',
      },
      code: {
        language: 'typescript',
        title: 'Atomic fixed window in Redis (Lua)',
        source: `// Redis runs the whole script before any other command: no race, one round trip.
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
        highlight: [3, 4, 5, 13],
      },
    },
    {
      title: 'Pick a key',
      tag: 'tradeoff',
      heading: 'Per user, per IP or per endpoint?',
      eli5: 'The **key** is the name on the tally card, and it decides who shares a count. One card per kid is fairest. One card per whole class is rough on a big class. The busy swing can have a smaller limit than the slide.',
      body: [
        '**Per user or API key** is the fairest key, since every customer gets the same budget. It only works after authentication, so the request has already cost you a token check.',
        '**Per IP** is all you have for anonymous traffic such as login and signup. It is blunt both ways. An office or a mobile carrier can put thousands of real users behind one IP, and an attacker with a botnet rotates through thousands of IPs.',
        '**Per endpoint** reflects cost. A search that hits the database for 200 ms deserves a tighter limit than a cached profile read, and `/login` needs about 5 attempts per minute per account to stop password guessing. Real systems stack these: a loose per-IP limit at the edge, then per-user and per-endpoint limits behind it.',
      ],
      keyIdea: 'The key decides who shares a budget. Pick it per endpoint, and layer cheap coarse limits in front of precise ones.',
      metrics: { qps: '2k/s', p99: '120 ms', errors: '0.1%', rejected: '~10k/s', rule: 'IP + user + route' },
      scene: {
        nodes: [
          { ...users, badge: 'office: 1 IP' },
          { ...scraper, badge: 'rotates 500 IPs' },
          { ...limiter, status: 'active', badge: 'key = user + route' },
          { ...limiter2, status: 'dim' },
          { ...redis, status: 'idle' },
          { ...api, status: 'ok' },
          db,
        ],
        links: [
          { from: 'users', to: 'limiter' },
          { from: 'scraper', to: 'limiter' },
          { from: 'limiter', to: 'redis', style: 'dashed' },
          { from: 'limiter2', to: 'redis', style: 'faint' },
          { from: 'limiter', to: 'api' },
          { from: 'api', to: 'db' },
        ],
        flows: [
          { path: ['users', 'limiter', 'api'], tone: 'request', count: 3, duration: 1.6, label: 'GET /feed' },
          { path: ['scraper', 'limiter'], tone: 'request', count: 4, duration: 1, delay: 0.5, label: 'POST /login' },
          { path: ['limiter', 'scraper'], tone: 'error', count: 2, duration: 1, delay: 1.6, label: '429: 5/min per account' },
        ],
        caption: 'Different routes, different keys, different budgets',
      },
    },
    {
      title: 'Store down',
      tag: 'tradeoff',
      heading: 'Redis is down: fail open or fail closed?',
      eli5: 'The chalkboard falls over. To **fail open**, the teacher lets kids keep sliding and counts on her fingers. At the shed with the sharp tools, she lets nobody in until the board is back.',
      body: [
        'Every request now depends on Redis. When it times out, the limiter must choose. **Fail open** lets requests through unchecked: the API stays up but is unprotected. **Fail closed** rejects them: you are protected, and the limiter has just caused a full outage.',
        'Most public APIs fail open for normal traffic and fall back to a generous **in-memory limit** on each node, so the scraper cannot run wild while Redis recovers. Security-sensitive routes like login, one-time codes and payments fail closed, because unlimited password guesses are worse than a few minutes of errors.',
        'Either way, put a short timeout on the Redis call, around 5 ms. A slow limiter store adds its latency to every single request, which hurts more than a dead one.',
      ],
      keyIdea: 'Decide per route what an unreachable limiter means. Availability usually wins, except where an unlimited caller is the bigger risk.',
      metrics: { qps: '2.1k/s', p99: '125 ms', errors: '0.1%', rejected: 'local only', rule: 'local fallback' },
      scene: {
        nodes: [
          users,
          scraper,
          { ...limiter, label: 'limiter 1', status: 'active', badge: 'fail open + local' },
          { ...limiter2, status: 'active', badge: '/login: fail closed' },
          { ...redis, status: 'down', badge: 'timeout' },
          { ...api, status: 'ok' },
          db,
        ],
        links: [
          { from: 'users', to: 'limiter' },
          { from: 'scraper', to: 'limiter2' },
          { from: 'limiter', to: 'redis', style: 'dashed' },
          { from: 'limiter2', to: 'redis', style: 'dashed' },
          { from: 'limiter', to: 'api' },
          { from: 'limiter2', to: 'api', style: 'faint' },
          { from: 'api', to: 'db' },
        ],
        flows: [
          { path: ['limiter', 'redis'], tone: 'error', duration: 0.8, label: '5 ms timeout' },
          { path: ['users', 'limiter', 'api'], tone: 'request', count: 3, duration: 1.6, delay: 0.4, label: 'allowed' },
          { path: ['scraper', 'limiter2'], tone: 'request', count: 2, duration: 1, delay: 0.6, label: 'POST /login' },
          { path: ['limiter2', 'scraper'], tone: 'error', duration: 1, delay: 1.7, label: '503' },
        ],
        caption: 'Normal routes stay up, the login route stays locked',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'A cheap guard that keeps the API fair',
      eli5: 'A **rate limiter** is the teacher who counts turns per kid, says kindly when to come back, shares one chalkboard with the other teacher, and has a plan for when the board breaks.',
      body: [
        'A rate limiter caps each key at a budget and turns the excess away with `429` and `Retry-After`, before it reaches anything expensive. Fixed windows are cheap but allow boundary bursts. Sliding windows fix that. Token buckets allow bursts while holding the average. Leaky buckets flatten output for strict downstreams.',
        'Across many nodes, keep counters in a shared store and update them atomically with `INCR` or a Lua script. Choose keys per endpoint, and decide in advance what each route does when the store is unreachable.',
      ],
      keyIdea: 'Limit per key, reject early and politely, count atomically in one place, and plan for the limiter itself failing.',
      metrics: { qps: '2k/s', p99: '120 ms', errors: '0.1%', rejected: '~10k/s', rule: 'burst 20, 100/min' },
      scene: {
        nodes: [
          { ...users, status: 'ok' },
          scraper,
          { ...limiter, label: 'limiter 1', status: 'active' },
          { ...limiter2, status: 'active' },
          { ...redis, status: 'ok' },
          { ...api, status: 'ok' },
          db,
        ],
        links: [
          { from: 'users', to: 'limiter' },
          { from: 'scraper', to: 'limiter2' },
          { from: 'limiter', to: 'redis', style: 'dashed' },
          { from: 'limiter2', to: 'redis', style: 'dashed' },
          { from: 'limiter', to: 'api' },
          { from: 'limiter2', to: 'api' },
          { from: 'api', to: 'db' },
        ],
        flows: [
          { path: ['users', 'limiter', 'api', 'db'], tone: 'request', duration: 2.2 },
          { path: ['db', 'api', 'limiter', 'users'], tone: 'response', duration: 2.2, delay: 2.3 },
          { path: ['limiter', 'redis'], tone: 'data', duration: 0.8, delay: 0.5 },
          { path: ['scraper', 'limiter2'], tone: 'request', count: 4, duration: 1, delay: 0.3 },
          { path: ['limiter2', 'scraper'], tone: 'error', count: 2, duration: 1, delay: 1.4, label: '429' },
        ],
        caption: 'Real users flow through, the flood bounces off',
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
