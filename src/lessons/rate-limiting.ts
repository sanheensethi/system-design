import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const users: SceneNode = { id: 'users', kind: 'phone', at: at(-6.6, -3.4), label: 'app users', sub: '2k req/s total' };
const scraper: SceneNode = { id: 'scraper', kind: 'client', at: at(-4.2, 3.6), label: 'scraper', sub: '1 API key' };
const limiter: SceneNode = { id: 'limiter', kind: 'block', at: at(0, 0), label: 'rate limiter', sub: '100/min per key', icon: 'Gauge', tint: 'amber' };
const api: SceneNode = { id: 'api', kind: 'block', at: at(4.2, 0), label: 'API servers', sub: '4k req/s max', icon: 'Server', tint: 'violet' };
const db: SceneNode = { id: 'db', kind: 'db', at: at(7.4, 3.4), label: 'database' };
const bucket: SceneNode = { id: 'bucket', kind: 'queue', at: at(0, 0), label: 'leaky bucket', sub: 'holds 50' };
const sms: SceneNode = { id: 'sms', kind: 'block', at: at(4.2, 0), label: 'SMS provider', sub: 'max 30/s', icon: 'Mail', tint: 'teal' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

export const rateLimiting: Lesson = {
  id: 'rate-limiting',
  title: 'Rate limiting (part 1)',
  tagline: 'Stop one noisy client from taking the API down for everyone else, and count requests with the right algorithm.',
  minutes: 14,
  level: 'Intermediate',
  learn: [
    'Why one client can hurt every other user, even by accident',
    'Where the limiter lives and how to reject politely with 429 and Retry-After',
    'How well-behaved clients back off with jitter',
    'Fixed window, sliding window log and counter, token bucket and leaky bucket',
    'How to choose between the algorithms',
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
      title: 'The flood',
      tag: 'problem',
      heading: 'One client, and everyone suffers',
      eli5: 'One kid, the **scraper**, runs up the slide again and again without stopping. The slide gets so crowded that the other kids cannot get a turn at all.',
      body: [
        'Your API serves 2,000 requests per second from 50,000 app users. The servers can handle about 4,000. Then a scraper with one API key starts pulling your whole catalog at **10,000 requests per second**.',
        'The servers cannot tell which requests matter. CPU pins at 100%, the database falls behind, p99 latency jumps from 120 ms to 2.4 seconds, and real users see `503` errors.',
      ],
      keyIdea: 'Shared capacity with no per-client cap means the noisiest client decides how everyone else is served.',
      metrics: { qps: '12k/s', p99: '2.4 s', errors: '18%', rejected: '0', rule: 'none' },
      metricTones: { qps: 'bad', p99: 'bad', errors: 'bad' },
      scene: {
        nodes: [
          users,
          { ...scraper, chips: [{ text: '10k req/s', tone: 'bad' }] },
          { ...api, status: 'hot', load: 100 },
          { ...db, status: 'hot', badge: 'lagging' },
        ],
        links: [link('users', 'api'), link('scraper', 'api', { label: 'one API key', labelTone: 'warn' }), link('api', 'db')],
        flows: [
          { path: ['scraper', 'api'], tone: 'request', count: 8, duration: 1, label: '10k req/s' },
          { path: ['users', 'api'], tone: 'request', count: 2, duration: 1.4, label: 'GET /feed' },
          { path: ['api', 'db'], tone: 'request', count: 5, duration: 1.2, delay: 0.8 },
          { path: ['api', 'users'], tone: 'error', duration: 1.4, delay: 1.6, label: '503' },
        ],
        panel: {
          title: 'Capacity vs load',
          icon: 'Gauge',
          rows: [
            { text: 'Normal traffic', value: '2,000 req/s' },
            { text: 'Server capacity', value: '4,000 req/s' },
            { text: 'Scraper alone', value: '10,000 req/s', tone: 'bad' },
          ],
          footer: { text: 'p99 120 ms becomes 2.4 s', tone: 'bad' },
        },
        caption: 'A scraper sends 5x the normal load through the same front door',
      },
    },
    {
      title: 'Friendly fire',
      tag: 'case',
      heading: 'Case: the flood can come from your own app',
      eli5: 'The scraper is not always a bad kid. Sometimes one of your own kids just forgot how to stop, and keeps running up the slide in a loop.',
      body: [
        'A mobile release ships with a retry bug. When a call fails, the app retries immediately in a tight loop. One phone can send hundreds of requests per second, and a million phones take the API down.',
        'The damage matches a scraper, and the traffic comes from your own paying users. Limits protect you from mistakes as much as from attackers.',
      ],
      keyIdea: 'A limiter guards against accidents as much as against abuse.',
      metrics: { qps: '9k/s', p99: '1.8 s', errors: '12%', rejected: '0', rule: 'none' },
      metricTones: { qps: 'bad', p99: 'bad', errors: 'bad' },
      scene: {
        nodes: [
          { ...users, chips: [{ text: 'retry, retry, retry', tone: 'warn' }] },
          { ...api, status: 'hot', load: 96 },
          { ...db, status: 'hot' },
        ],
        links: [link('users', 'api', { label: 'tight retry loop', labelTone: 'warn' }), link('api', 'db')],
        flows: [
          { path: ['users', 'api'], tone: 'request', count: 8, duration: 1, label: 'retry' },
          { path: ['api', 'users'], tone: 'error', count: 3, duration: 1, delay: 1.1, label: '503' },
          { path: ['api', 'db'], tone: 'request', count: 4, duration: 1.2, delay: 0.8 },
        ],
        panel: {
          title: 'Same damage, different cause',
          icon: 'Bug',
          rows: [
            { text: 'Scraper with one key', value: '10k req/s' },
            { text: 'App release, retry bug', value: 'hundreds per phone', tone: 'warn' },
            { text: 'Servers see the difference?', value: 'no', tone: 'bad' },
          ],
        },
        caption: 'The servers cannot tell a bug from an attack',
      },
    },
    {
      title: 'Add a limiter',
      tag: 'concept',
      heading: 'A guard that counts per client',
      eli5: 'The **rate limiter** is a teacher at the slide ladder who counts each kid\'s turns. After 100 turns in a minute she says no more for now.',
      body: [
        'Put a **rate limiter** in front of the API servers. For every request it reads a key (here the API key), checks how many requests that key made recently, and lets it through or rejects it. The rule here: `100 requests per minute per key`.',
        'Rejections must be cheap. The limiter answers in under a millisecond and never touches the servers or the database, so 10,000 rejected requests per second cost almost nothing.',
      ],
      keyIdea: 'Reject early and cheaply, before the request reaches anything expensive.',
      metrics: { qps: '2k/s', p99: '120 ms', errors: '0.1%', rejected: '~10k/s', rule: '100/min per key' },
      metricTones: { qps: 'good', p99: 'good', errors: 'good', rejected: 'warn' },
      scene: {
        nodes: [
          users,
          { ...scraper, chips: [{ text: '10k req/s', tone: 'bad' }] },
          { ...limiter, status: 'active', badge: 'scraper 100/100' },
          { ...api, status: 'ok', load: 25 },
        ],
        links: [link('users', 'limiter'), link('scraper', 'limiter'), link('limiter', 'api')],
        flows: [
          { path: ['scraper', 'limiter'], tone: 'request', count: 6, duration: 1 },
          { path: ['limiter', 'scraper'], tone: 'error', count: 3, duration: 1, delay: 1.1, label: 'rejected' },
          { path: ['users', 'limiter', 'api'], tone: 'request', duration: 1.6, delay: 0.3, label: 'GET /feed' },
          { path: ['api', 'limiter', 'users'], tone: 'response', duration: 1.6, delay: 2, label: '200 OK' },
        ],
        panel: {
          title: 'The rule',
          icon: 'Gauge',
          rows: [
            { text: 'Key', value: 'API key' },
            { text: 'Budget', value: '100 per minute' },
            { text: 'Over budget', value: 'reject, under 1 ms', tone: 'good' },
          ],
        },
        caption: 'The limiter turns the flood away before it reaches the servers',
      },
    },
    {
      title: 'Where it lives',
      tag: 'concept',
      heading: 'At the gateway, in middleware, or in the client',
      eli5: 'The teacher can stand at the bottom of the slide ladder for the whole playground, or each slide can have its own teacher. A kid cannot be trusted to count their own turns.',
      body: [
        'Most teams put the limiter in the **API gateway**, the one front door that already handles auth, so every service shares one rule set and nothing is repeated. It can also be middleware inside each server.',
        'Client-side limits help well-behaved apps but are easy to bypass, so they never replace a server-side check. A gateway also keeps the limiter thin: auth, rate limit, route, observe.',
      ],
      keyIdea: 'Enforce limits on the server side, at the front door, so every service gets the same rules.',
      metrics: { qps: '2k/s', p99: '120 ms', errors: '0.1%', rejected: '~10k/s', rule: '100/min per key' },
      metricTones: { qps: 'good', p99: 'good', errors: 'good' },
      scene: {
        nodes: [
          users,
          { ...limiter, label: 'API gateway', sub: 'auth + rate limit', icon: 'Shield', status: 'active' },
          { ...api, status: 'ok', load: 25 },
        ],
        links: [link('users', 'limiter'), link('limiter', 'api')],
        flows: [
          { path: ['users', 'limiter', 'api'], tone: 'request', duration: 1.8, label: 'GET /feed' },
          { path: ['api', 'limiter', 'users'], tone: 'response', duration: 1.8, delay: 1.9, label: '200 OK' },
        ],
        panel: {
          title: 'Where to enforce',
          icon: 'Route',
          rows: [
            { text: 'In the client app', value: 'easy to bypass', tone: 'bad' },
            { text: 'In the gateway', value: 'one rule set', tone: 'good' },
            { text: 'In each server', value: 'repeats, drifts', tone: 'warn' },
          ],
        },
        caption: 'One front door, one set of rules',
      },
    },
    {
      title: 'Polite 429',
      tag: 'concept',
      heading: 'Reject with 429 and say when to come back',
      eli5: 'When the teacher says no, she also tells the kid how long to wait. That is kinder than a locked gate with no sign.',
      body: [
        'Reject with **429 Too Many Requests**. A `503` says the server is broken. A `429` says the caller is over its budget, and a `Retry-After` header says how many seconds until it may try again.',
        'The `X-RateLimit-*` headers show the budget: the limit, how many remain, and when it resets. Send them on every response, not only on rejections.',
      ],
      keyIdea: 'A 429 with Retry-After tells the client exactly what happened and when to try again.',
      metrics: { qps: '2k/s', p99: '120 ms', errors: '0.1%', rejected: '~10k/s', rule: '100/min per key' },
      metricTones: { errors: 'good', rejected: 'warn' },
      scene: {
        nodes: [
          { ...scraper, chips: [{ text: 'POST /orders', tone: 'default' }] },
          { ...limiter, status: 'active', badge: '100 / 100' },
          { ...api, status: 'ok', load: 25 },
        ],
        links: [link('scraper', 'limiter'), link('limiter', 'api')],
        flows: [
          { path: ['scraper', 'limiter'], tone: 'request', count: 3, duration: 1 },
          { path: ['limiter', 'scraper'], tone: 'error', duration: 1, delay: 1.1, label: '429' },
        ],
        panel: {
          title: 'Response headers',
          icon: 'List',
          rows: [
            { text: 'Retry-After', value: '23 seconds' },
            { text: 'X-RateLimit-Limit', value: '100' },
            { text: 'X-RateLimit-Remaining', value: '0', tone: 'bad' },
            { text: 'X-RateLimit-Reset', value: 'epoch seconds' },
          ],
        },
        caption: 'The rejection explains itself',
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
      title: 'Client backoff',
      tag: 'concept',
      heading: 'Good clients wait, with some random jitter',
      eli5: 'A kid who hears "wait 23 seconds" counts to 23, plus a few extra, and then tries again. If all kids came back on the same second, they would just crowd the ladder again.',
      body: [
        'A well-behaved client waits the `Retry-After` time before retrying, plus a small random **jitter**. Without jitter, every rejected client wakes at the same moment and the herd hits together.',
        'With no `Retry-After`, the client uses exponential backoff: wait 1 s, then 2 s, then 4 s, each with jitter. Slowing down early when `X-RateLimit-Remaining` nears zero avoids the 429 altogether.',
      ],
      keyIdea: 'Retry after the stated wait plus jitter, and back off exponentially when there is no hint.',
      metrics: { qps: '2k/s', p99: '120 ms', errors: '0.1%', rejected: 'falling', rule: '100/min per key' },
      metricTones: { rejected: 'good' },
      scene: {
        nodes: [
          { ...scraper, label: 'client', sub: 'honors Retry-After', chips: [{ text: 'wait 23 s + jitter', tone: 'good' }] },
          { ...limiter, status: 'active' },
          { ...api, status: 'ok', load: 25 },
        ],
        links: [link('scraper', 'limiter', { label: 'retry later' }), link('limiter', 'api')],
        flows: [
          { path: ['scraper', 'limiter'], tone: 'request', duration: 1 },
          { path: ['limiter', 'scraper'], tone: 'error', duration: 1, delay: 1.1, label: '429, wait 23' },
          { path: ['scraper', 'limiter', 'api'], tone: 'request', duration: 1.8, delay: 3.2, label: 'retry' },
        ],
        panel: {
          title: 'Backoff without a hint',
          icon: 'Repeat',
          rows: [
            { text: 'Retry 1', value: '1 s + jitter' },
            { text: 'Retry 2', value: '2 s + jitter' },
            { text: 'Retry 3', value: '4 s + jitter' },
          ],
          footer: { text: 'No jitter means a synchronized herd', tone: 'warn' },
        },
        caption: 'Spread the retries out in time',
      },
    },
    {
      title: 'Fixed window',
      tag: 'concept',
      heading: 'The simplest counter: one per minute',
      eli5: 'The teacher keeps a tally card for each kid and wipes every card clean when the minute bell rings. That is a **fixed window**: 100 turns per bell.',
      body: [
        'Split time into one-minute slots and keep one counter per key per slot, named like `rl:user42:12:01`. Each request increments it. Above 100, reject. When the minute ends, a fresh counter starts at zero.',
        'It costs one integer per active key and one increment per request. A million active users fit in a few tens of megabytes, which is why many gateways default to it.',
      ],
      keyIdea: 'A fixed window is one counter per key per time slot. Cheap and easy to explain, with a catch at the edges.',
      metrics: { qps: '2k/s', p99: '120 ms', errors: '0.1%', rejected: '~10k/s', rule: '100/min fixed' },
      metricTones: { qps: 'good', p99: 'good', errors: 'good' },
      scene: {
        nodes: [
          { ...users, chips: ['INCR rl:user42:12:01'] },
          { ...limiter, status: 'active', badge: '58 / 100', chips: [{ text: 'window 12:01', tone: 'default' }] },
          { ...api, status: 'ok', load: 25 },
        ],
        links: [link('users', 'limiter'), link('limiter', 'api')],
        flows: [
          { path: ['users', 'limiter'], tone: 'request', duration: 1.2, label: 'INCR → 58' },
          { path: ['limiter', 'api'], tone: 'request', duration: 1, delay: 1.25, label: '58 ≤ 100, allow' },
        ],
        panel: {
          title: 'Counters by slot',
          icon: 'Table',
          rows: [
            { text: 'rl:user42:12:00', value: '100, expired' },
            { text: 'rl:user42:12:01', value: '58, live', tone: 'good' },
            { text: 'Memory per key', value: 'one integer' },
          ],
        },
        caption: 'One counter per key per minute',
      },
    },
    {
      title: 'Boundary burst',
      tag: 'case',
      heading: 'Case: 200 requests in two seconds',
      eli5: 'The sneaky kid takes 100 turns just before the bell and 100 more just after it. This **boundary burst** gives 200 turns in two seconds, and the teacher\'s cards say that is fine.',
      body: [
        'The scraper reads your docs and sends 100 requests at `12:00:59`, the last second of one window, and 100 more at `12:01:00`, the first second of the next. Both batches pass.',
        'That is **200 requests in two seconds**, double the limit. The same reset also lines up many clients: cron jobs set to fire at the top of the minute all spike together.',
      ],
      keyIdea: 'Fixed windows reset all at once, so a client can spend two windows of budget back to back and line up with everyone else\'s bursts.',
      metrics: { qps: '100/s for 2 s', p99: '180 ms', errors: '0.1%', rejected: '0 at :00', rule: '100/min fixed' },
      metricTones: { qps: 'warn', p99: 'warn', errors: 'good' },
      scene: {
        nodes: [
          { ...scraper, chips: [{ text: '100 @ 12:00:59', tone: 'warn' }, { text: '100 @ 12:01:00', tone: 'warn' }] },
          { ...limiter, status: 'active', badge: 'reset to 0' },
          { ...api, status: 'active', load: 45, badge: '200 in 2 s' },
        ],
        links: [link('scraper', 'limiter'), link('limiter', 'api')],
        flows: [
          { path: ['scraper', 'limiter', 'api'], tone: 'request', count: 6, duration: 1.4, label: '100 @ 12:00:59' },
          { path: ['scraper', 'limiter', 'api'], tone: 'request', count: 6, duration: 1.4, delay: 1.2, label: '100 @ 12:01:00' },
        ],
        panel: {
          title: 'The edge of two windows',
          icon: 'Clock',
          rows: [
            { text: 'Window 12:00', value: '100 / 100, allowed' },
            { text: 'Window 12:01', value: '100 / 100, allowed' },
            { text: 'Real rate across the edge', value: '200 in 2 s', tone: 'bad' },
          ],
        },
        caption: 'Two full windows of budget spent across one boundary',
      },
    },
    {
      title: 'Sliding log',
      tag: 'concept',
      heading: 'Sliding window log: exact, but heavy',
      eli5: 'Instead of a tally card, the teacher writes down the time of every turn. To decide, she looks back exactly 60 seconds from now. It is exact, but the notebook gets thick.',
      body: [
        'The **sliding window log** stores a timestamp for every request, for example in a Redis sorted set. To decide, drop timestamps older than 60 seconds and count what is left. The boundary trick stops working.',
        'It is exact, but memory grows with the limit: 100 entries per key across a million keys is several gigabytes.',
      ],
      keyIdea: 'The log is exact and removes the boundary burst, at the price of memory that grows with the limit.',
      metrics: { qps: '2k/s', p99: '122 ms', errors: '0.1%', rejected: '~10k/s', rule: '100/min sliding log' },
      metricTones: { errors: 'good' },
      scene: {
        nodes: [
          { ...scraper, chips: ['100 @ 12:01:00'] },
          { ...limiter, status: 'active', badge: '100 in last 60 s' },
          { id: 'redis', kind: 'cache', at: at(4.2, 0), label: 'sorted set', sub: '100 stamps per key', status: 'hot', badge: 'GBs at 1M keys' },
        ],
        links: [link('scraper', 'limiter'), link('limiter', 'redis', { style: 'dashed' })],
        flows: [
          { path: ['scraper', 'limiter'], tone: 'request', count: 4, duration: 1 },
          { path: ['limiter', 'redis'], tone: 'data', duration: 0.9, delay: 1.05, label: 'drop old, count' },
          { path: ['limiter', 'scraper'], tone: 'error', duration: 1, delay: 2.1, label: '429' },
        ],
        panel: {
          title: 'Timestamps for one key',
          icon: 'List',
          code: '12:00:03.120\n12:00:03.480\n12:00:21.900\n...\n12:01:00.010\n12:01:00.020',
          footer: { text: 'One entry per request in the last 60 s', tone: 'muted' },
        },
        caption: 'Every request leaves a timestamp',
      },
    },
    {
      title: 'Sliding counter',
      tag: 'concept',
      heading: 'Sliding window counter: two integers, close enough',
      eli5: 'The teacher keeps just two tally cards, this minute and last minute, and mixes them by how far into the minute it is. She is not exact, but close, and her desk stays tidy.',
      body: [
        'The **sliding window counter** keeps two counters, this minute and last minute, and blends them. Fifteen seconds in, 75% of the previous window is still inside the last 60 seconds. With 80 last minute and 30 so far: `30 + 80 × 0.75 = 90`. Under 100, so allow.',
        'It assumes last minute was spread evenly, so it is an estimate. Cloudflare measured it wrong on about 0.003% of requests, which is why it is a common default.',
      ],
      keyIdea: 'Two integers per key give near-exact sliding behavior, so the counter is the usual default over the log.',
      metrics: { qps: '2k/s', p99: '120 ms', errors: '0.1%', rejected: '~10k/s', rule: '100/min sliding' },
      metricTones: { errors: 'good', p99: 'good' },
      scene: {
        nodes: [
          { ...users, chips: ['15 s into the minute'] },
          { ...limiter, status: 'active', badge: 'est. 90 / 100' },
          { ...api, status: 'ok', load: 25 },
        ],
        links: [link('users', 'limiter'), link('limiter', 'api')],
        flows: [
          { path: ['users', 'limiter', 'api'], tone: 'request', duration: 1.8, label: '90 ≤ 100, allow' },
          { path: ['api', 'limiter', 'users'], tone: 'response', duration: 1.8, delay: 1.9 },
        ],
        panel: {
          title: 'Blend the two windows',
          icon: 'Scale',
          rows: [
            { text: 'Last minute', value: '80' },
            { text: 'This minute so far', value: '30' },
            { text: 'Overlap of last window', value: '75%' },
            { text: '30 + 80 × 0.75', value: '90', tone: 'good' },
          ],
        },
        caption: 'The previous window fades out as the current one fills',
      },
    },
    {
      title: 'Token bucket',
      tag: 'concept',
      heading: 'A budget that refills: rate plus burst',
      eli5: 'Each kid has a cup that holds 20 turn tickets, and the teacher drops in new ones at a steady pace. This **token bucket** lets a kid take a few quick turns in a row, then wait for more tickets.',
      body: [
        'A **token bucket** holds up to `B` tokens and refills at `R` tokens per second. Each request takes one. An empty bucket means 429.',
        '`R` is the sustained rate you can afford. `B` is the burst you will absorb. With `B = 20` and `R = 100/min`, opening the app fires 15 calls at once and all pass, but a client cannot average more than 100 per minute. Stripe and AWS API Gateway describe their limits this way.',
      ],
      keyIdea: 'Token bucket separates how fast on average from how big a burst, which matches how real clients behave.',
      metrics: { qps: '2k/s', p99: '115 ms', errors: '0.1%', rejected: '~10k/s', rule: 'burst 20, 100/min' },
      metricTones: { qps: 'good', p99: 'good', errors: 'good' },
      scene: {
        nodes: [
          { ...users, chips: [{ text: 'app open: 15 calls', tone: 'good' }] },
          { ...limiter, status: 'active', badge: 'tokens 5 / 20', chips: [{ text: 'refill 100/min', tone: 'default' }] },
          { ...api, status: 'ok', load: 30 },
        ],
        links: [link('users', 'limiter'), link('limiter', 'api')],
        flows: [{ path: ['users', 'limiter', 'api'], tone: 'request', count: 5, duration: 1.6, label: 'burst passes' }],
        panel: {
          title: 'Two knobs',
          icon: 'Gauge',
          rows: [
            { text: 'R, refill rate', value: '100 per minute' },
            { text: 'B, bucket size', value: '20 tokens' },
            { text: 'Burst allowed', value: 'up to B at once', tone: 'good' },
            { text: 'Average allowed', value: 'at most R', tone: 'good' },
          ],
        },
        caption: 'Bursts up to B pass, the average is held to R',
      },
    },
    {
      title: 'Lazy refill',
      tag: 'concept',
      heading: 'No timer needed: top up when a request arrives',
      eli5: 'The teacher does not run around dropping tickets all day. When a kid shows up, she checks the clock, adds the tickets earned since last time, and then lets the kid take one.',
      body: [
        'You do not need a timer to refill. Store two numbers per key, the token count and the last refill time. On each request, add `elapsed × R` tokens, cap at `B`, then try to take one.',
        'That is two values per key and a few arithmetic operations per request. Start the bucket full so the first burst passes.',
      ],
      keyIdea: 'Refill lazily from elapsed time: two numbers per key, no background timers.',
      metrics: { qps: '2k/s', p99: '115 ms', errors: '0.1%', rejected: '~10k/s', rule: 'burst 20, 100/min' },
      metricTones: { errors: 'good' },
      scene: {
        nodes: [
          { ...users, chips: ['GET /feed'] },
          { ...limiter, status: 'active', badge: '4.2 tokens', chips: [{ text: 'last = 12:01:07', tone: 'default' }] },
          { ...api, status: 'ok', load: 30 },
        ],
        links: [link('users', 'limiter'), link('limiter', 'api')],
        flows: [
          { path: ['users', 'limiter'], tone: 'request', duration: 1.2, label: '+1.7 tokens earned' },
          { path: ['limiter', 'api'], tone: 'request', duration: 1, delay: 1.3, label: 'take 1, allow' },
        ],
        panel: {
          title: 'State per key',
          icon: 'Table',
          rows: [
            { text: 'tokens', value: '4.2' },
            { text: 'last refill', value: '12:01:07' },
            { text: 'Timers needed', value: 'none', tone: 'good' },
          ],
        },
        caption: 'Work out the refill only when someone asks',
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
        'It fits calls you make to someone else. Your SMS provider cuts you off above 30 per second, and a push triggers 200 signups in one second. A queue of 50 draining at 30 per second keeps you under their limit. The cost is waiting: if 200 arrive faster than the queue drains, 50 queue, 150 drop, and the last queued message waits about 1.7 seconds.',
      ],
      keyIdea: 'Token bucket lets bursts through. Leaky bucket flattens them into a constant rate, at the price of queueing delay.',
      metrics: { qps: '200 in, 30/s out', p99: '1.7 s wait', errors: '0.1%', rejected: '150 of 200', rule: 'SMS: 30/s drain' },
      metricTones: { rejected: 'warn', p99: 'warn' },
      scene: {
        nodes: [
          { id: 'signups', kind: 'block', at: at(-4.2, 0), label: 'signups', sub: '200 in 0.1 s', icon: 'Users', tint: 'blue', chips: [{ text: '200 req burst', tone: 'warn' }] },
          { ...bucket, status: 'hot', badge: '50 / 50', load: 100 },
          { ...sms, status: 'ok', badge: '30/s steady' },
        ],
        links: [link('signups', 'bucket'), link('bucket', 'sms', { label: '30 per second' })],
        flows: [
          { path: ['signups', 'bucket'], tone: 'event', count: 6, duration: 1 },
          { path: ['bucket', 'signups'], tone: 'error', duration: 0.9, delay: 1.1, label: 'queue full, dropped' },
          { path: ['bucket', 'sms'], tone: 'request', duration: 0.9, delay: 1.6 },
          { path: ['bucket', 'sms'], tone: 'request', duration: 0.9, delay: 2.3 },
          { path: ['bucket', 'sms'], tone: 'request', duration: 0.9, delay: 3 },
        ],
        panel: {
          title: 'Burst faster than the drain',
          icon: 'Timer',
          rows: [
            { text: 'Arrive in 0.1 s', value: '200' },
            { text: 'Queued (size 50)', value: '50' },
            { text: 'Dropped', value: '150', tone: 'bad' },
            { text: 'Last queued waits', value: '1.7 s', tone: 'warn' },
            { text: 'Sent, steady', value: '30/s', tone: 'good' },
          ],
        },
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
      title: 'Pick an algorithm',
      tag: 'tradeoff',
      heading: 'Five counters, five trade-offs',
      eli5: 'Tally cards are cheap but sneaky kids game the bell. A notebook is exact but thick. Tickets in a cup allow quick runs. A line at the fountain keeps the pace even. Pick what the playground needs.',
      body: [
        'For your own public API, a token bucket is the usual pick and the sliding counter is a close second. Fixed windows fit coarse quotas where a boundary burst is harmless.',
        'Use the sliding log when exactness matters more than memory, and the leaky bucket for calls to a downstream with a hard rate cap.',
      ],
      keyIdea: 'Match the algorithm to the goal: burst-friendly for users, flat for strict downstreams, cheap for coarse quotas.',
      metrics: { qps: '2k/s', p99: '120 ms', errors: '0.1%', rejected: '~10k/s', rule: 'token bucket' },
      metricTones: { errors: 'good' },
      scene: {
        nodes: [
          { id: 'fixed', kind: 'block', size: 0.8, at: at(-4.2, -3.2), label: 'fixed window', sub: 'cheap, edge burst', icon: 'Clock', tint: 'gray' },
          { id: 'sliding', kind: 'block', size: 0.8, at: at(0, -3.2), label: 'sliding', sub: 'log exact, counter light', icon: 'Layers', tint: 'blue' },
          { id: 'token', kind: 'block', size: 0.8, at: at(4.2, -3.2), label: 'token bucket', sub: 'bursts + average', icon: 'Gauge', tint: 'green', status: 'ok', badge: 'default for APIs' },
          { id: 'leaky', kind: 'block', size: 0.8, at: at(0, 3.2), label: 'leaky bucket', sub: 'flat output', icon: 'Timer', tint: 'teal' },
        ],
        panel: {
          title: 'At a glance',
          icon: 'Table',
          rows: [
            { text: 'Fixed window', value: '1 int, 2N edge burst', tone: 'warn' },
            { text: 'Sliding log', value: 'exact, O(N) memory', tone: 'warn' },
            { text: 'Sliding counter', value: '2 ints, estimate', tone: 'good' },
            { text: 'Token bucket', value: 'burst B, rate R', tone: 'good' },
            { text: 'Leaky bucket', value: 'flat, adds delay' },
          ],
        },
        caption: 'No single winner, only the right fit',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'A cheap guard, and five ways to count',
      eli5: 'A **rate limiter** is the teacher who counts turns per kid, says kindly when to come back, and picks a counting method that fits the slide.',
      body: [
        'A limiter caps each key at a budget and rejects the excess with `429` and `Retry-After`, at the gateway, before anything expensive. Clients wait that long plus jitter.',
        'Fixed windows are cheap but allow edge bursts. Sliding windows fix that. Token buckets allow bursts and hold the average. Leaky buckets flatten output. Part 2 covers keys and many nodes.',
      ],
      keyIdea: 'Limit per key, reject early and politely, and pick the algorithm for the burst behavior you want.',
      metrics: { qps: '2k/s', p99: '120 ms', errors: '0.1%', rejected: '~10k/s', rule: 'burst 20, 100/min' },
      metricTones: { qps: 'good', p99: 'good', errors: 'good' },
      scene: {
        nodes: [
          { ...users, status: 'ok' },
          { ...scraper, chips: [{ text: '429', tone: 'bad' }] },
          { ...limiter, status: 'active' },
          { ...api, status: 'ok', load: 25 },
        ],
        links: [link('users', 'limiter'), link('scraper', 'limiter'), link('limiter', 'api')],
        flows: [
          { path: ['users', 'limiter', 'api'], tone: 'request', duration: 1.8 },
          { path: ['api', 'limiter', 'users'], tone: 'response', duration: 1.8, delay: 1.9 },
          { path: ['scraper', 'limiter'], tone: 'request', count: 4, duration: 1, delay: 0.3 },
          { path: ['limiter', 'scraper'], tone: 'error', count: 2, duration: 1, delay: 1.4, label: '429' },
        ],
        caption: 'Real users flow through, the flood bounces off',
      },
      quiz: {
        question: 'A client may send 100 requests per minute under a fixed window. Which pattern is allowed through, and what is the catch?',
        options: [
          '100 at 12:00:00 only, the rest rejected',
          '100 at 12:00:59 and 100 at 12:01:00, a 200 burst in two seconds',
          '100 spread evenly, and nothing more is ever allowed',
          '50 per minute at most',
        ],
        answer: 1,
        explain: 'The counter resets at the minute boundary, so both batches pass. Sliding windows and token buckets close that gap.',
      },
    },
  ],
};
