import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, label?: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, label, ...extra });

const client: SceneNode = { id: 'client', kind: 'block', at: at(-4, -2), label: 'Client', sub: 'caller, user 42', icon: 'User', tint: 'gray' };
const handler: SceneNode = { id: 'handler', kind: 'block', at: at(4, -2), label: 'ApiHandler', sub: 'concrete class', icon: 'Server', tint: 'green' };
const fixed: SceneNode = { id: 'limiter', kind: 'block', at: at(0, -2), label: 'RateLimiter', sub: 'concrete class', icon: 'Gauge', tint: 'green' };
const iface: SceneNode = { id: 'iface', kind: 'block', at: at(0, -2), label: 'Limiter', sub: 'interface', icon: 'Gauge', tint: 'violet' };
const tb: SceneNode = { id: 'tb', kind: 'block', at: at(-4, 3), label: 'TokenBucket', sub: 'concrete class', icon: 'Package', tint: 'green' };
const sw: SceneNode = { id: 'sw', kind: 'block', at: at(0, 3), label: 'SlidingWindow', sub: 'concrete class', icon: 'Clock', tint: 'green' };
const lb: SceneNode = { id: 'lb', kind: 'block', at: at(4, 3), label: 'LeakyBucket', sub: 'concrete class', icon: 'Timer', tint: 'green' };
const redis: SceneNode = { id: 'redis', kind: 'block', at: at(4, 3), label: 'Redis', sub: 'external, shared', icon: 'Database', tint: 'gray' };

export const lldRateLimiter: Lesson = {
  id: 'lld-rate-limiter',
  title: 'Rate limiter',
  tagline: 'Start with a counter per minute and fix one pain at a time: edge bursts, memory, bursts on purpose, threads, many servers and per-route rules.',
  minutes: 18,
  level: 'Intermediate',
  learn: [
    'Fixed window counter, and the burst at the window edge',
    'Sliding window log and the memory it costs, then the cheaper sliding counter',
    'Token bucket and leaky bucket: bursts, steady rate and a fake clock for tests',
    'Per-key limiters, locks for thread safety and evicting idle keys',
    'Redis with a Lua script for many servers, and the Strategy pattern for per-route rules',
    'The 429 response, rate limit headers, hard and soft limits and fail open vs closed',
  ],
  metrics: [
    { key: 'classes', label: 'Classes', icon: 'Boxes' },
    { key: 'memory', label: 'Memory per key', icon: 'Database' },
    { key: 'burst', label: 'Worst burst', icon: 'Zap' },
    { key: 'safe', label: 'Correct', icon: 'Shield' },
  ],
  steps: [
    {
      title: 'No limit',
      tag: 'problem',
      heading: 'Design a rate limiter: one client can eat the whole server',
      eli5: 'A playground has one slide. One kid runs up and slides all day, so nobody else gets a turn. We need a **gatekeeper** who says how many turns each kid gets.',
      body: [
        'An API serves thousands of clients. One buggy script retries in a tight loop and sends 5,000 requests a second. The handler is shared, so everyone else slows down.',
        'A **rate limiter** answers one question before the handler runs: `allow(key) -> bool`. The key is a user id, an API key or an IP address. It must take microseconds, stay small per key and stay correct under threads and many servers.',
      ],
      keyIdea: 'A rate limiter is a yes or no per caller, asked before the real work starts.',
      metrics: { classes: '1', memory: '-', burst: 'unbounded', safe: 'no' },
      metricTones: { burst: 'bad', safe: 'bad' },
      scene: {
        nodes: [
          { ...client, status: 'hot', chips: [{ text: '5,000 req/s', tone: 'bad' }] },
          { ...handler, status: 'hot', load: 98 },
          { id: 'other', kind: 'block', at: at(0, 4), label: 'Other users', sub: 'starved', icon: 'Users', tint: 'amber' },
        ],
        links: [link('client', 'handler', 'handle()'), link('other', 'handler', 'slow', { labelTone: 'warn' })],
        flows: [{ path: ['client', 'handler'], tone: 'request', label: 'handle()', count: 3, duration: 1.2 }],
        panel: {
          title: 'The contract',
          icon: 'Code',
          code: 'class Limiter:\n    def allow(self, key: str) -> bool:\n        ...',
          footer: { text: 'True means go, False means reject', tone: 'muted' },
        },
        caption: 'No gate in front of the handler',
      },
    },
    {
      title: 'v1 fixed window',
      tag: 'concept',
      heading: 'v1: count requests in each minute',
      eli5: 'The gatekeeper has a tally sheet. Each minute she starts a fresh sheet and lets each kid have 100 ticks. After 100, no more slides until the next minute.',
      body: [
        'The simplest class keeps one counter and the current minute number. When the minute changes, reset the counter to zero. Otherwise allow while `count < limit`.',
        'This is the **fixed window counter**. It stores two numbers, so memory is tiny and `allow` is O(1).',
      ],
      keyIdea: 'A fixed window counter is two integers and one comparison. Cheap and easy to read.',
      metrics: { classes: '1', memory: '2 ints', burst: '100', safe: 'single thread' },
      scene: {
        nodes: [{ ...client, chips: ['allow()'] }, { ...fixed, status: 'active', badge: 'count 41 of 100' }, { ...handler }],
        links: [link('client', 'limiter', 'allow()'), link('limiter', 'handler', 'handle()')],
        flows: [
          { path: ['client', 'limiter'], tone: 'request', label: 'allow()', duration: 1.2 },
          { path: ['limiter', 'handler'], tone: 'response', label: 'True', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'v1 FixedWindow',
          icon: 'Code',
          code: 'now = int(time.time()) // 60\nif now != self.window:\n    self.window = now\n    self.count = 0\nif self.count < self.limit:\n    self.count += 1\n    return True\nreturn False',
        },
        caption: 'One counter that resets every minute',
      },
      code: {
        language: 'python',
        title: 'v1 fixed window counter',
        source: `import time

class RateLimiter:
    def __init__(self, limit: int):
        self.limit = limit
        self.window = int(time.time()) // 60
        self.count = 0

    def allow(self) -> bool:
        now = int(time.time()) // 60
        if now != self.window:
            self.window = now
            self.count = 0
        if self.count < self.limit:
            self.count += 1
            return True
        return False`,
        highlight: [10, 11, 12, 13, 14],
      },
    },
    {
      title: 'Edge burst',
      tag: 'case',
      heading: 'Pain: twice the limit around a window edge',
      eli5: 'A kid takes 100 turns at 10:59:59, the sheet flips at 11:00:00, and she takes 100 more. That is 200 turns in two seconds, though each sheet looked fine.',
      body: [
        'Send 100 requests at 10:59:59 and 100 more at 11:00:00. Each window sees exactly 100, so all 200 pass. The handler took **2N in about a second**.',
        'The limit says 100 per minute, but the counter only checks fixed boundaries. A caller who knows the boundary can double the rate.',
      ],
      keyIdea: 'A fixed window enforces the limit per calendar minute, not per any 60 seconds. Edges allow up to 2x.',
      metrics: { classes: '1', memory: '2 ints', burst: '200 in 1 s', safe: 'leaky' },
      metricTones: { burst: 'bad' },
      scene: {
        nodes: [
          { ...client, status: 'hot', chips: [{ text: '100 at 10:59:59', tone: 'warn' }, { text: '100 at 11:00:00', tone: 'warn' }] },
          { ...fixed, badge: 'resets at 11:00:00' },
          { ...handler, status: 'hot', load: 95, badge: '200 in 1 s' },
        ],
        links: [link('client', 'limiter'), link('limiter', 'handler')],
        flows: [
          { path: ['client', 'limiter', 'handler'], tone: 'request', label: 'burst A', count: 3, duration: 1.6 },
          { path: ['client', 'limiter', 'handler'], tone: 'request', label: 'burst B', count: 3, duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'Two windows, one second',
          icon: 'Table',
          rows: [
            { text: 'Window 10:59', value: '100 of 100', tone: 'good' },
            { text: 'Window 11:00', value: '100 of 100', tone: 'good' },
            { text: 'Real rate in 1 s', value: '200', tone: 'bad' },
          ],
          footer: { text: 'Both windows pass, the handler suffers', tone: 'bad' },
        },
        caption: 'Classic fixed window edge',
      },
    },
    {
      title: 'v2 sliding log',
      tag: 'concept',
      heading: 'v2: remember every request time in a sliding window',
      eli5: 'Instead of a sheet per minute, the gatekeeper writes the time of each turn on a strip of paper. She tears off anything older than a minute, then counts what is left.',
      body: [
        'Keep a `deque` of timestamps. On each call, drop entries older than the window from the left, then allow only if the queue is shorter than the limit.',
        'The window now slides with the clock, so there is no edge to exploit. At any moment, no more than `limit` requests exist in the last 60 seconds.',
      ],
      keyIdea: 'A sliding window log is exact: it counts the real requests in the last N seconds.',
      metrics: { classes: '2', memory: 'one float per request', burst: '100', safe: 'single thread' },
      metricTones: { burst: 'good' },
      scene: {
        nodes: [{ ...client }, { ...sw, at: at(0, -2), status: 'active', badge: '100 timestamps' }, { ...handler }],
        links: [link('client', 'sw', 'allow()'), link('sw', 'handler', 'handle()')],
        flows: [
          { path: ['client', 'sw'], tone: 'request', label: 'allow()', duration: 1.2 },
          { path: ['sw', 'handler'], tone: 'response', label: 'True', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'The deque',
          icon: 'Table',
          rows: [
            { text: 'oldest', value: '10:59:07' },
            { text: 'newest', value: '11:00:03' },
            { text: 'Older than 60 s', value: 'popleft()' },
            { text: 'len(q) < limit', value: 'append(now)', tone: 'good' },
          ],
        },
        caption: 'The window follows the clock',
      },
      code: {
        language: 'python',
        title: 'v2 sliding window log',
        source: `import time
from collections import deque

class SlidingWindow:
    def __init__(self, limit: int, window_sec: float):
        self.limit = limit
        self.win = window_sec
        self.q: deque[float] = deque()

    def allow(self) -> bool:
        now = time.monotonic()
        while self.q and now - self.q[0] > self.win:
            self.q.popleft()
        if len(self.q) < self.limit:
            self.q.append(now)
            return True
        return False`,
        highlight: [11, 12, 13, 14, 15],
      },
    },
    {
      title: 'Memory pain',
      tag: 'case',
      heading: 'Pain: memory is one float per allowed request, per key',
      eli5: 'The paper strip is exact, but every key needs its own strip. A million kids with a hundred marks each fill the whole office.',
      body: [
        'The log appends one float only for an allowed request, so each deque holds at most `limit` entries. That is 100 here, or 100,000 for a high-volume API key. Rejected calls are not stored, so abuse does not grow memory.',
        'The cost is multiplied by keys. 1M keys x 100 limit = 100M floats, about 2.4 GB in CPython floats plus deque overhead. Exact counting gets expensive at scale.',
      ],
      keyIdea: 'The log costs up to `limit` floats per key. Multiply by the number of keys to get the real bill.',
      metrics: { classes: '2', memory: 'up to limit floats per key', burst: '100', safe: 'single thread' },
      metricTones: { memory: 'bad' },
      scene: {
        nodes: [
          { ...sw, at: at(-3, 0), status: 'hot', load: 88, badge: '100 floats per key' },
          { id: 'ram', kind: 'block', at: at(3, 0), label: 'Process RAM', sub: '1M keys x 100 = 100M floats', icon: 'Cpu', tint: 'gray', status: 'hot', badge: '~2.4 GB' },
        ],
        links: [link('sw', 'ram', 'stores', { labelTone: 'warn' })],
        flows: [{ path: ['sw', 'ram'], tone: 'data', label: 'append(now)', count: 3, duration: 1.4 }],
        panel: {
          title: 'Memory cost',
          icon: 'Table',
          rows: [
            { text: 'Per allowed request', value: '1 float' },
            { text: 'Per key', value: 'up to limit (100)' },
            { text: 'High-volume key', value: 'up to 100,000' },
            { text: '1M keys x 100', value: '100M floats', tone: 'bad' },
            { text: 'Rejected calls', value: 'not stored', tone: 'good' },
          ],
          footer: { text: 'Bounded per key, large across keys', tone: 'warn' },
        },
        caption: 'Exact costs memory per key',
      },
    },
    {
      title: 'Sliding counter',
      tag: 'concept',
      heading: 'Sliding counter: two integers and a weighted estimate',
      eli5: 'Instead of every mark, the gatekeeper keeps the last minute total and the current minute total. She counts a share of the old total, based on how much of it still overlaps.',
      body: [
        'Keep a `prev` and a `curr` counter. When a new window starts, rotate: `prev = curr`, `curr = 0`. The estimate is `prev * overlap + curr`, where overlap is the fraction of the previous window still inside the last 60 seconds.',
        'It assumes the previous window\'s requests were spread evenly, so the estimate can be off when they were clumped. The error is bounded and small in practice, and memory is two integers per key.',
      ],
      keyIdea: 'The sliding counter trades a small, bounded estimate error for O(1) memory per key.',
      metrics: { classes: '3', memory: '2 ints', burst: 'about 100', safe: 'single thread' },
      metricTones: { memory: 'good' },
      scene: {
        nodes: [
          { id: 'prev', kind: 'block', at: at(-4, 0), label: 'prev window', sub: '84 requests', icon: 'Hash', tint: 'blue' },
          { id: 'curr', kind: 'block', at: at(0, 0), label: 'curr window', sub: '30 requests', icon: 'Hash', tint: 'blue', status: 'active' },
          { id: 'est', kind: 'block', at: at(4, 0), label: 'Estimate', sub: '84 x 0.25 + 30 = 51', icon: 'Gauge', tint: 'green', badge: '51 of 100' },
        ],
        links: [link('prev', 'est', 'x overlap 0.25'), link('curr', 'est', '+ curr')],
        flows: [
          { path: ['prev', 'est'], tone: 'data', label: 'weighted', duration: 1.3 },
          { path: ['curr', 'est'], tone: 'data', label: 'as is', duration: 1.3, delay: 0.4 },
        ],
        panel: {
          title: 'Weighted overlap',
          icon: 'Table',
          rows: [
            { text: 'Into current window', value: '45 s of 60' },
            { text: 'Overlap of prev', value: '0.25' },
            { text: 'Estimate', value: '51', tone: 'good' },
            { text: 'Error source', value: 'even-spread assumption', tone: 'warn' },
          ],
          footer: { text: 'Approximate, but O(1) memory', tone: 'good' },
        },
        caption: 'A weighted blend of two counters',
      },
      code: {
        language: 'python',
        title: 'Sliding window counter',
        source: `import time

class SlidingCounter:
    def __init__(self, limit: int, window_sec: int = 60):
        self.limit = limit
        self.win = window_sec
        self.idx = int(time.time()) // window_sec
        self.prev = 0
        self.curr = 0

    def allow(self) -> bool:
        t = time.time()
        idx = int(t) // self.win
        if idx != self.idx:
            self.prev = self.curr if idx == self.idx + 1 else 0
            self.curr = 0
            self.idx = idx
        overlap = 1 - (t % self.win) / self.win
        if self.prev * overlap + self.curr < self.limit:
            self.curr += 1
            return True
        return False`,
        highlight: [13, 14, 15, 16, 17, 18, 19],
      },
    },
    {
      title: 'v3 token bucket',
      tag: 'concept',
      heading: 'v3: a bucket of tokens that refills at a steady rate',
      eli5: 'Each kid has a small bucket of play tokens. A slide turn costs one token. The bucket slowly refills by itself, and it can never hold more than its size.',
      body: [
        'A **token bucket** has a `capacity` and a `rate` in tokens per second. A request spends tokens. If there are enough, allow it. Otherwise reject.',
        'You never run a refill timer. On each call, compute `elapsed * rate`, add it, cap at `capacity` and save the new timestamp. This is lazy refill.',
      ],
      keyIdea: 'Lazy refill makes a token bucket O(1) in time and memory: tokens, last timestamp, two settings.',
      metrics: { classes: '3', memory: '2 numbers', burst: 'capacity', safe: 'single thread' },
      metricTones: { memory: 'good' },
      scene: {
        nodes: [{ ...client }, { ...tb, at: at(0, -2), status: 'active', badge: '7.4 tokens' }, { ...handler }],
        links: [link('client', 'tb', 'allow(cost=1)'), link('tb', 'handler', 'handle()')],
        flows: [
          { path: ['client', 'tb'], tone: 'request', label: 'allow()', duration: 1.2 },
          { path: ['tb', 'handler'], tone: 'response', label: 'True', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Bucket state',
          icon: 'Table',
          rows: [
            { text: 'capacity', value: '200' },
            { text: 'rate', value: '100 / s' },
            { text: 'tokens now', value: '7.4' },
            { text: 'last refill', value: 'monotonic()' },
          ],
        },
        caption: 'Refill on demand, spend per request',
      },
      code: {
        language: 'python',
        title: 'v3 token bucket',
        source: `import time

class TokenBucket:
    def __init__(self, rate: float, capacity: float):
        self.rate = rate
        self.cap = capacity
        self.tokens = capacity
        self.ts = time.monotonic()

    def allow(self, cost: float = 1) -> bool:
        now = time.monotonic()
        elapsed = now - self.ts
        self.tokens = min(self.cap, self.tokens + elapsed * self.rate)
        self.ts = now
        if self.tokens >= cost:
            self.tokens -= cost
            return True
        return False`,
        highlight: [12, 13, 14, 15, 16, 17],
      },
    },
    {
      title: 'Burst vs rate',
      tag: 'concept',
      heading: 'Two knobs: how big a burst, how fast the average',
      eli5: 'The bucket size says how many turns a kid can grab at once. The refill speed says how many turns she gets over the whole afternoon.',
      body: [
        '`capacity` is the largest burst a caller can send after being idle. `rate` is the long-run average. With `rate=100` and `capacity=200`, an idle client can fire 200 at once, then settles to 100 a second.',
        'Set `capacity` equal to `rate` for almost no burst. Set it far above for bursty clients such as a page that fires many calls on load.',
      ],
      keyIdea: 'Capacity controls the burst and rate controls the average. Tune them separately.',
      metrics: { classes: '3', memory: '2 numbers', burst: '200 then 100/s', safe: 'single thread' },
      metricTones: { burst: 'good' },
      scene: {
        nodes: [
          { ...client, chips: [{ text: '200 at once', tone: 'good' }] },
          { ...tb, at: at(0, -2), status: 'ok', badge: '200 to 0 tokens' },
          { ...handler, chips: ['100 req/s steady'] },
        ],
        links: [link('client', 'tb'), link('tb', 'handler')],
        flows: [
          { path: ['client', 'tb', 'handler'], tone: 'request', label: 'burst', count: 3, duration: 1.4 },
          { path: ['tb', 'handler'], tone: 'request', label: 'refill pace', duration: 1.6, delay: 1.6 },
        ],
        panel: {
          title: 'TokenBucket(100, 200)',
          icon: 'Table',
          rows: [
            { text: 'Idle for 2 s', value: '200 tokens' },
            { text: 'Burst of 200', value: 'all allowed', tone: 'good' },
            { text: '201st at once', value: 'rejected', tone: 'bad' },
            { text: 'After 1 s', value: '+100 tokens' },
          ],
        },
        caption: 'Burst up to capacity, then steady',
      },
    },
    {
      title: 'v4 leaky bucket',
      tag: 'concept',
      heading: 'Leaky bucket: smooth the output instead',
      eli5: 'Picture a bucket with a small hole. Kids pour in turns and water drips out at one steady speed. If the bucket overflows, extra kids are sent away.',
      body: [
        'A **leaky bucket** is a bounded queue with a fixed drain rate. `enqueue` adds a request to a deque, or rejects it when the queue is full. A worker pops one request every `1 / rate` seconds and hands it to the handler.',
        'The output to the handler is perfectly smooth, which suits a backend that cannot take bursts. The cost: a burst waits in the queue, so latency goes up. A meter variant only counts a level and rejects instead of delaying, but then it passes bursts up to capacity like a mirrored token bucket.',
      ],
      keyIdea: 'Token bucket allows bursts. The queue form of leaky bucket flattens them into a constant outflow, at the cost of delay.',
      metrics: { classes: '4', memory: 'queue of N', burst: 'smoothed, adds delay', safe: 'single thread' },
      scene: {
        nodes: [{ ...client }, { ...lb, at: at(0, -2), status: 'active', badge: 'queue 40 of 50' }, { ...handler, chips: ['10 req/s, flat'] }],
        links: [link('client', 'lb', 'enqueue()'), link('lb', 'handler', 'drain at rate')],
        flows: [
          { path: ['client', 'lb'], tone: 'request', label: 'burst', count: 3, duration: 1.2 },
          { path: ['lb', 'handler'], tone: 'response', label: 'one by one', duration: 1.8, delay: 1.3 },
        ],
        panel: {
          title: 'Leaky bucket queue',
          icon: 'Code',
          code: 'def enqueue(self, req):\n    if len(self.q) >= self.cap:\n        return False\n    self.q.append(req)\n    return True\n\n# worker, every 1 / rate seconds\nhandler(self.q.popleft())',
          footer: { text: 'Smooths output, adds delay', tone: 'muted' },
        },
        caption: 'A queue with a steady drip',
      },
      code: {
        language: 'python',
        title: 'v4 leaky bucket (queue form)',
        source: `import time
from collections import deque

class LeakyBucket:
    def __init__(self, rate: float, capacity: int):
        self.rate = rate
        self.cap = capacity
        self.q: deque = deque()

    def enqueue(self, req) -> bool:
        if len(self.q) >= self.cap:
            return False
        self.q.append(req)
        return True

    def run(self, handler) -> None:
        # worker thread: drain at a fixed rate
        while True:
            if self.q:
                handler(self.q.popleft())
            time.sleep(1 / self.rate)`,
        highlight: [10, 11, 12, 13],
      },
    },
    {
      title: 'Compare',
      tag: 'tradeoff',
      heading: 'Four algorithms, four trade-offs',
      eli5: 'Tally sheet: cheap but sloppy at the edges. Paper strip: exact but long. Token bucket: cheap and lets kids save up. Leaky bucket: smooth, but kids wait.',
      body: [
        'There is no best one. Fixed window is the cheapest and the sloppiest. The log is exact and the heaviest. Token bucket fits most public APIs, which is why many providers use it.',
        'Pick by the question: do bursts matter, is memory tight, and does the backend need smooth traffic?',
      ],
      keyIdea: 'Choose the algorithm from burst tolerance, memory budget and how smooth the backend needs the load.',
      metrics: { classes: '4', memory: 'varies', burst: 'varies', safe: 'single thread' },
      scene: {
        nodes: [{ ...tb, at: at(-4, 0) }, { ...sw, at: at(0, -2) }, { ...lb, at: at(4, 0) }],
        panel: {
          title: 'Trade-offs',
          icon: 'Scale',
          rows: [
            { text: 'Fixed window', value: '2 ints, 2x edge burst', tone: 'warn' },
            { text: 'Sliding log', value: 'exact, big memory', tone: 'warn' },
            { text: 'Sliding counter', value: '2 ints, approximate', tone: 'good' },
            { text: 'Token bucket', value: '2 numbers, bursts ok', tone: 'good' },
            { text: 'Leaky bucket', value: 'smooth, adds delay' },
          ],
        },
        caption: 'Same question, different guarantees',
      },
      quiz: {
        question: 'A client idles for a minute, then sends 150 requests at once. The rule is rate 100/s, capacity 200. What happens?',
        options: ['All 150 pass', 'Only 100 pass', 'All 150 are rejected', 'They pass at 100 per second through a queue'],
        answer: 0,
        explain: 'The bucket refilled to 200 tokens while idle, so 150 tokens are available. A leaky bucket would queue them instead.',
      },
    },
    {
      title: 'Fake clock',
      tag: 'concept',
      heading: 'Inject the clock so the limiter is testable',
      eli5: 'To test the gatekeeper without waiting a real minute, we give her a toy clock that we can turn by hand.',
      body: [
        'Calling `time.monotonic()` inside the class makes tests slow and flaky. Pass a `clock` function into the constructor, defaulting to the real one.',
        'A test then uses a **fake clock** with `advance(seconds)`. It proves refill, caps and rejection in microseconds, and the behavior is exact.',
      ],
      keyIdea: 'Depend on a clock you can pass in. Time is an input, not a global.',
      metrics: { classes: '5', memory: '2 numbers', burst: 'capacity', safe: 'single thread' },
      scene: {
        nodes: [
          { id: 'test', kind: 'block', at: at(-4, -2), label: 'Test', sub: 'caller', icon: 'Bug', tint: 'gray' },
          { ...tb, at: at(0, -2), status: 'active' },
          { id: 'clock', kind: 'block', at: at(4, -2), label: 'FakeClock', sub: 'concrete class', icon: 'Clock', tint: 'green' },
        ],
        links: [link('test', 'tb', 'allow()'), link('tb', 'clock', 'uses'), link('test', 'clock', 'advance(1)', { style: 'dashed' })],
        flows: [
          { path: ['test', 'clock'], tone: 'event', label: 'advance(1)', duration: 1.3 },
          { path: ['test', 'tb'], tone: 'request', label: 'allow()', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'Test',
          icon: 'Code',
          code: 'clock = FakeClock()\nb = TokenBucket(1, 2, clock)\nassert b.allow() and b.allow()\nassert not b.allow()\nclock.advance(1)\nassert b.allow()',
          footer: { text: 'No sleeping, no flakes', tone: 'good' },
        },
        caption: 'The clock is a dependency',
      },
      code: {
        language: 'python',
        title: 'Injectable clock and FakeClock',
        source: `import time

class TokenBucket:
    def __init__(self, rate, capacity, clock=time.monotonic):
        self.rate = rate
        self.cap = capacity
        self.tokens = capacity
        self.clock = clock
        self.ts = clock()

    def allow(self, cost=1) -> bool:
        now = self.clock()
        self.tokens = min(self.cap, self.tokens + (now - self.ts) * self.rate)
        self.ts = now
        if self.tokens >= cost:
            self.tokens -= cost
            return True
        return False

class FakeClock:
    def __init__(self):
        self.t = 0.0
    def __call__(self) -> float:
        return self.t
    def advance(self, s: float) -> None:
        self.t += s`,
        highlight: [5, 9, 12, 21, 22, 23, 24, 25, 26],
      },
    },
    {
      title: 'Per key',
      tag: 'concept',
      heading: 'One bucket per caller: a registry keyed by user',
      eli5: 'Every kid needs their own bucket, not one shared bucket. The gatekeeper keeps a shelf with one labeled bucket per kid and makes a new one the first time a kid shows up.',
      body: [
        'Until now one object limited everything. Real traffic needs a limit per key. A `KeyedLimiter` holds a dict from key to bucket and **creates** a bucket on first use.',
        'It takes a factory, so the same registry works for any algorithm. This is the **Factory** idea inside a **has-a** relationship.',
      ],
      keyIdea: 'A limiter per key lives in a registry that creates buckets lazily from a factory.',
      metrics: { classes: '6', memory: '2 numbers x keys', burst: 'per key', safe: 'single thread' },
      scene: {
        nodes: [
          { ...client, chips: ['key u42'] },
          { id: 'keyed', kind: 'block', at: at(0, -2), label: 'KeyedLimiter', sub: 'concrete class', icon: 'Layers', tint: 'green', status: 'active' },
          { ...tb, at: at(4, 3), label: 'TokenBucket', sub: 'one per key', badge: 'u42' },
        ],
        links: [link('client', 'keyed', 'allow(key)'), link('keyed', 'tb', 'creates, has-a')],
        flows: [
          { path: ['client', 'keyed'], tone: 'request', label: 'allow("u42")', duration: 1.3 },
          { path: ['keyed', 'tb'], tone: 'request', label: 'allow()', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'KeyedLimiter',
          icon: 'Code',
          code: 'def allow(self, key):\n    b = self.by_key.get(key)\n    if b is None:\n        b = self.factory()\n        self.by_key[key] = b\n    return b.allow()',
        },
        caption: 'A shelf of buckets, one per caller',
      },
    },
    {
      title: 'Race',
      tag: 'case',
      heading: 'Pain: two threads read the same token',
      eli5: 'Two helpers peek at the bucket at the same time. Both see one token left, both take it, and two kids slide on one token.',
      body: [
        '`allow` reads `tokens`, compares, then writes. Two threads can both read `1`, both pass the check, and both write back `0`. Two callers got True while only one token existed. Nothing crashes.',
        'The registry has the same shape of race: two threads can both see a missing key and each create a bucket, and one bucket is lost with its count.',
      ],
      keyIdea: 'Read, check, write is not atomic. Without a lock, concurrent callers beat the limit silently.',
      metrics: { classes: '6', memory: '2 numbers x keys', burst: 'over limit', safe: 'no' },
      metricTones: { burst: 'bad', safe: 'bad' },
      scene: {
        nodes: [
          { id: 't1', kind: 'worker', at: at(-4, -2), label: 'Thread A', status: 'hot', chips: ['reads tokens=1'] },
          { id: 't2', kind: 'worker', at: at(-4, 4), label: 'Thread B', status: 'hot', chips: ['reads tokens=1'] },
          { ...tb, at: at(2, 1), status: 'hot', badge: 'tokens: 0', load: 90 },
        ],
        links: [link('t1', 'tb', 'allow()'), link('t2', 'tb', 'allow()')],
        flows: [
          { path: ['t1', 'tb'], tone: 'request', label: 'tokens >= 1', duration: 1.3 },
          { path: ['t2', 'tb'], tone: 'request', label: 'tokens >= 1', duration: 1.3 },
          { path: ['tb', 't1'], tone: 'response', label: 'True', duration: 1.3, delay: 1.4 },
          { path: ['tb', 't2'], tone: 'response', label: 'True', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'Interleaving',
          icon: 'Table',
          rows: [
            { text: 'A reads tokens', value: '1' },
            { text: 'B reads tokens', value: '1', tone: 'warn' },
            { text: 'A writes tokens', value: '0' },
            { text: 'B writes tokens', value: '0', tone: 'bad' },
          ],
          footer: { text: '2 allowed, 1 token existed', tone: 'bad' },
        },
        caption: 'A check-then-act race',
      },
    },
    {
      title: 'Add a lock',
      tag: 'concept',
      heading: 'Fix: a lock around the read-modify-write',
      eli5: 'Only one helper may hold the bucket at a time. A helper picks up the **key**, checks and takes the token, then puts the key back. The next helper waits.',
      body: [
        'Give each bucket a `threading.Lock` and wrap the body of `allow` in `with self.lock`. Now check and update happen as one step.',
        'The registry needs its own lock for the create step. Keep critical sections tiny: no I/O, no logging, only arithmetic.',
      ],
      keyIdea: 'Make the whole check-and-update one critical section. Keep it short.',
      metrics: { classes: '6', memory: '2 numbers + lock', burst: 'capacity', safe: 'yes' },
      metricTones: { safe: 'good' },
      scene: {
        nodes: [
          { id: 't1', kind: 'worker', at: at(-4, -2), label: 'Thread A', status: 'active' },
          { id: 't2', kind: 'worker', at: at(-4, 4), label: 'Thread B', status: 'dim', badge: 'waiting' },
          { id: 'lock', kind: 'vault', at: at(0, 1), label: 'Lock', sub: 'held by A' },
          { ...tb, at: at(4, 1), status: 'ok', badge: 'tokens: 0' },
        ],
        links: [link('t1', 'lock', 'acquire'), link('t2', 'lock', 'blocked', { labelTone: 'warn' }), link('lock', 'tb', 'guards')],
        flows: [
          { path: ['t1', 'lock', 'tb'], tone: 'request', label: 'allow()', duration: 1.6 },
          { path: ['tb', 't1'], tone: 'response', label: 'True', duration: 1.3, delay: 1.7 },
        ],
        panel: {
          title: 'Locked allow()',
          icon: 'Code',
          code: 'def allow(self, cost=1):\n    with self.lock:\n        now = self.clock()\n        self._refill(now)\n        if self.tokens >= cost:\n            self.tokens -= cost\n            return True\n        return False',
          footer: { text: 'Correct, but one lock per bucket', tone: 'good' },
        },
        caption: 'Check and update become one step',
      },
    },
    {
      title: 'Contention',
      tag: 'tradeoff',
      heading: 'Hot keys and one global lock',
      eli5: 'If the whole shelf had a single key, every kid would wait for it. Give each bucket its own key, so only kids sharing a bucket wait.',
      body: [
        'One lock around the whole registry makes every caller wait, even for different users. Use a lock **per bucket**, and keep the registry lock for the short create step.',
        'For very hot keys a single lock still serializes callers. **Lock striping** hashes keys into N locks, so unrelated keys rarely collide.',
      ],
      keyIdea: 'Scope the lock as narrowly as correctness allows: per bucket, or striped by key hash.',
      metrics: { classes: '6', memory: 'bucket + lock', burst: 'capacity', safe: 'yes' },
      scene: {
        nodes: [
          { id: 'w', kind: 'worker', at: at(-4, -2), label: 'Many threads', status: 'hot', load: 85 },
          { id: 'g', kind: 'vault', at: at(0, -2), label: 'Global lock', sub: 'everyone waits', status: 'hot' },
          { id: 's', kind: 'vault', at: at(0, 4), label: 'Striped locks', sub: '16 locks', status: 'ok' },
          { ...tb, at: at(4, 1), label: 'Buckets', sub: 'one per key' },
        ],
        links: [link('w', 'g', 'slow', { labelTone: 'warn' }), link('w', 's', 'fast', { style: 'dashed' }), link('s', 'tb', 'lock(hash(key) % 16)')],
        flows: [{ path: ['w', 's', 'tb'], tone: 'request', label: 'allow(key)', duration: 1.6 }],
        panel: {
          title: 'Lock choices',
          icon: 'Scale',
          rows: [
            { text: 'One global lock', value: 'simple, serial', tone: 'bad' },
            { text: 'Lock per bucket', value: 'good default', tone: 'good' },
            { text: 'Striped locks', value: 'bounded locks', tone: 'good' },
          ],
        },
        caption: 'Narrower locks, less waiting',
      },
    },
    {
      title: 'Evict idle',
      tag: 'case',
      heading: 'Pain: the registry only grows',
      eli5: 'Every kid who ever visited has a bucket on the shelf, even those who left long ago. The shelf fills, so we clear buckets nobody has used for a while.',
      body: [
        'An attacker can send one request from each of millions of IP addresses and fill the dict. Memory climbs with distinct keys, not with traffic.',
        'Evict idle buckets. A bucket that has been idle long enough to be full again can be dropped with no loss: a new one starts full. Run a sweep, or use an LRU or TTL map.',
      ],
      keyIdea: 'Drop a bucket once it would be full anyway. Then forgetting it changes nothing.',
      metrics: { classes: '6', memory: 'bounded', burst: 'capacity', safe: 'yes' },
      metricTones: { memory: 'good' },
      scene: {
        nodes: [
          { ...client, chips: ['1M new IPs'] },
          { id: 'keyed', kind: 'block', at: at(0, -2), label: 'KeyedLimiter', sub: 'concrete class', icon: 'Layers', tint: 'green', status: 'hot', badge: '1M buckets' },
          { id: 'sweep', kind: 'worker', at: at(4, 3), label: 'Sweeper', sub: 'every 60 s' },
        ],
        links: [link('client', 'keyed', 'allow(ip)'), link('sweep', 'keyed', 'evict idle')],
        flows: [
          { path: ['client', 'keyed'], tone: 'request', label: 'new keys', count: 3, duration: 1.3 },
          { path: ['sweep', 'keyed'], tone: 'event', label: 'evict()', duration: 1.4, delay: 1.4 },
        ],
        panel: {
          title: 'Sweep rule',
          icon: 'Code',
          code: 'idle = now - b.ts\nif b.tokens + idle * b.rate >= b.cap:\n    del self.by_key[key]',
          footer: { text: 'A full bucket carries no state', tone: 'good' },
        },
        caption: 'Forget keys that carry no state',
      },
    },
    {
      title: 'Many servers',
      tag: 'case',
      heading: 'Pain: ten servers mean ten private limiters',
      eli5: 'The playground now has ten gates, and each gatekeeper keeps her own tally. A kid with 100 turns allowed can walk through all ten and take 1,000.',
      body: [
        'Behind a load balancer each app server holds its own in-memory buckets. A limit of 100 per minute becomes up to **1,000** across ten servers. The counts live in the wrong place.',
        'Shared state has to live in one store that all servers read and write. Redis is the usual pick, since it is fast and has atomic scripts.',
      ],
      keyIdea: 'Per-process counters multiply the limit by the number of servers. Move the state to a shared store.',
      metrics: { classes: '6', memory: 'per server', burst: '10x the limit', safe: 'no' },
      metricTones: { burst: 'bad', safe: 'bad' },
      scene: {
        nodes: [
          { ...client, at: at(-5, -2), chips: ['100 per minute'] },
          { id: 's1', kind: 'block', at: at(-1, -2), label: 'Server 1', sub: 'own bucket', icon: 'Server', tint: 'green' },
          { id: 's2', kind: 'block', at: at(3, -2), label: 'Server 2', sub: 'own bucket', icon: 'Server', tint: 'green' },
          { id: 's3', kind: 'block', at: at(1, 4), label: 'Server 3', sub: 'own bucket', icon: 'Server', tint: 'green', status: 'hot' },
        ],
        links: [link('client', 's1'), link('client', 's2'), link('client', 's3')],
        flows: [
          { path: ['client', 's1'], tone: 'request', label: '100', duration: 1.3 },
          { path: ['client', 's2'], tone: 'request', label: '100', duration: 1.3, delay: 0.3 },
          { path: ['client', 's3'], tone: 'request', label: '100', duration: 1.3, delay: 0.6 },
        ],
        panel: {
          title: 'Effective limit',
          icon: 'Table',
          rows: [
            { text: 'Intended', value: '100 / min' },
            { text: 'Servers', value: '10' },
            { text: 'Effective', value: '1,000 / min', tone: 'bad' },
          ],
          footer: { text: 'Each process counts alone', tone: 'bad' },
        },
        caption: 'The count lives in the wrong place',
      },
    },
    {
      title: 'Redis and Lua',
      tag: 'concept',
      heading: 'v5: keep the bucket in Redis, update it with one Lua script',
      eli5: 'All ten gatekeepers now share one tally board on the wall. Only one may write on it at a time, so a kid cannot sneak ten extra turns past them.',
      body: [
        'Store `tokens` and `ts` in a Redis hash per key. A plain read then write from two servers would race again, so do the refill and spend inside a **Lua script**. Redis runs a script atomically.',
        'Add an `EXPIRE` so idle keys vanish by themselves, which also solves eviction. Passing `now` from the app is simple, but servers with skewed clocks refill unevenly. Prefer `redis.call(\'TIME\')` on Redis 5+ or keep clocks synced.',
      ],
      keyIdea: 'A Lua script makes read-modify-write atomic inside Redis, so servers cannot interleave. TTL replaces the sweeper.',
      metrics: { classes: '7', memory: 'in Redis, with TTL', burst: 'capacity', safe: 'yes, all servers' },
      metricTones: { safe: 'good' },
      scene: {
        nodes: [
          { id: 's1', kind: 'block', at: at(-5, -2), label: 'RedisLimiter', sub: 'server 1', icon: 'Server', tint: 'green' },
          { id: 's2', kind: 'block', at: at(-5, 4), label: 'RedisLimiter', sub: 'server 2', icon: 'Server', tint: 'green' },
          { ...redis, at: at(2, 1), status: 'active', badge: 'EVALSHA' },
        ],
        links: [link('s1', 'redis', 'uses'), link('s2', 'redis', 'uses')],
        flows: [
          { path: ['s1', 'redis'], tone: 'request', label: 'evalsha()', duration: 1.4 },
          { path: ['s2', 'redis'], tone: 'request', label: 'evalsha()', duration: 1.4, delay: 0.5 },
          { path: ['redis', 's1'], tone: 'response', label: '1', duration: 1.2, delay: 1.6 },
        ],
        panel: {
          title: 'Atomic in Redis',
          icon: 'Code',
          code: 'local k, rate = KEYS[1], tonumber(ARGV[1])\nlocal cap, now = tonumber(ARGV[2]), tonumber(ARGV[3])\nlocal d = redis.call("HMGET", k, "tokens", "ts")\nlocal t = tonumber(d[1]) or cap\nt = math.min(cap, t + math.max(0, now - (tonumber(d[2]) or now)) * rate)\nif t >= 1 then t = t - 1 end\nredis.call("HSET", k, "tokens", t, "ts", now)',
        },
        caption: 'One shared bucket, one atomic update',
      },
      code: {
        language: 'python',
        title: 'Lua script and the RedisLimiter around it',
        source: `import time

LUA = """
local k = KEYS[1]
local rate = tonumber(ARGV[1])
local cap = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local cost = tonumber(ARGV[4])
local ttl = tonumber(ARGV[5])
local d = redis.call("HMGET", k, "tokens", "ts")
local t = tonumber(d[1]) or cap
local ts = tonumber(d[2]) or now
t = math.min(cap, t + math.max(0, now - ts) * rate)
local ok = 0
if t >= cost then t = t - cost; ok = 1 end
redis.call("HSET", k, "tokens", t, "ts", now)
redis.call("EXPIRE", k, ttl)
return ok
"""

class RedisLimiter:
    def __init__(self, redis, lua: str, rate: float, cap: float):
        self.r = redis
        self.rate = rate
        self.cap = cap
        self.sha = redis.script_load(lua)

    def allow(self, key: str, cost: int = 1) -> bool:
        ttl = int(self.cap / self.rate) * 2 + 1
        res = self.r.evalsha(
            self.sha, 1, key, self.rate, self.cap, time.time(), cost, ttl
        )
        return bool(res)`,
        highlight: [30, 31, 32],
      },
      quiz: {
        question: 'Why must the refill and spend happen inside one Lua script, not as separate GET and SET calls?',
        options: [
          'Lua is faster than SET',
          'Two servers could read the same value between the calls and both spend the last token',
          'Redis cannot store floats otherwise',
          'It lets the key expire sooner',
        ],
        answer: 1,
        explain: 'Separate calls recreate the check-then-act race across servers. A script runs without interleaving.',
      },
    },
    {
      title: 'Strategy',
      tag: 'concept',
      heading: 'Pain: each route wants a different algorithm',
      eli5: 'Login gets a strict gatekeeper who counts exactly. The busy slide gets a relaxed one with a bucket. They all follow the same rule: answer yes or no to **allow**.',
      body: [
        'Login should allow 5 tries a minute with no bursts. A search API wants 100 a second with room to burst. A `Limiter` **interface** lets the gateway ask any of them the same question.',
        'This is the **Strategy** pattern: one interface, many classes that `implement` it, and the caller never knows which one it holds.',
      ],
      keyIdea: 'Put allow(key) behind an interface. Swap algorithms without touching the callers.',
      metrics: { classes: '8', memory: 'per strategy', burst: 'per route', safe: 'yes' },
      scene: {
        nodes: [
          { ...iface, at: at(0, -4), status: 'active' },
          { ...sw, at: at(-4, 3), label: 'SlidingWindow', sub: 'login, 5 per min' },
          { ...tb, at: at(0, 3), label: 'TokenBucket', sub: 'api, 100/s' },
          { ...redis, id: 'rl', at: at(4, 3), label: 'RedisBucket', sub: 'shared, concrete', icon: 'Database', tint: 'green' },
        ],
        links: [
          link('sw', 'iface', 'implements'),
          link('tb', 'iface', 'implements'),
          link('rl', 'iface', 'implements'),
        ],
        panel: {
          title: 'Limiter interface',
          icon: 'Code',
          code: 'class Limiter(ABC):\n    @abstractmethod\n    def allow(self, key: str) -> bool: ...\n\nclass KeyedLimiter(Limiter):\n    def __init__(self, factory): ...\n\nrules = [("/login", KeyedLimiter(lambda: SlidingWindow(5, 60)))]',
        },
        caption: 'One interface, many algorithms',
      },
      code: {
        language: 'python',
        title: 'Limiter interface and KeyedLimiter',
        source: `from abc import ABC, abstractmethod

class Limiter(ABC):
    @abstractmethod
    def allow(self, key: str) -> bool: ...

class KeyedLimiter(Limiter):
    def __init__(self, factory):
        self.factory = factory
        self.by_key = {}

    def allow(self, key: str) -> bool:
        b = self.by_key.get(key)
        if b is None:
            b = self.factory()
            self.by_key[key] = b
        return b.allow()

rules = [
    ("/login", KeyedLimiter(lambda: SlidingWindow(5, 60))),
    ("/api/", KeyedLimiter(lambda: TokenBucket(100, 200))),
]`,
        highlight: [7, 8, 12, 13, 19, 20],
      },
    },
    {
      title: 'Route rules',
      tag: 'concept',
      heading: 'A Gateway picks the strategy by route',
      eli5: 'At the gate there is a signboard: slides use the bucket gatekeeper, the swings use the strict one. The gate reads the sign and asks the right gatekeeper.',
      body: [
        'A `RateLimitGateway` maps a path prefix to a `KeyedLimiter`, the strategy that implements `Limiter` and wraps one leaf bucket per key. It finds the first matching rule and calls `allow(key)` on it. No match means allow.',
        'Load the table from config instead of code: route, algorithm, limit, window and key type. Then changing a limit is a deploy of data, and the classes stay closed to change.',
      ],
      keyIdea: 'Rules are data, algorithms are classes, and the gateway joins them with a lookup.',
      metrics: { classes: '9', memory: 'per rule', burst: 'per route', safe: 'yes' },
      scene: {
        nodes: [
          { ...client },
          { id: 'gw', kind: 'block', at: at(0, -2), label: 'RateLimitGateway', sub: 'concrete class', icon: 'Route', tint: 'green', status: 'active' },
          { ...iface, id: 'iface', at: at(4, -2) },
          { ...handler, id: 'handler', at: at(0, 4) },
        ],
        links: [link('client', 'gw', 'allow(path, user)'), link('gw', 'iface', 'uses'), link('gw', 'handler', 'if allowed')],
        flows: [
          { path: ['client', 'gw'], tone: 'request', label: 'POST /login', duration: 1.3 },
          { path: ['gw', 'iface'], tone: 'request', label: 'allow(u42)', duration: 1.2, delay: 1.4 },
          { path: ['iface', 'gw'], tone: 'response', label: 'True', duration: 1.2, delay: 2.7 },
        ],
        panel: {
          title: 'rules.yaml',
          icon: 'List',
          rows: [
            { text: '/login', value: 'sliding, 5 per 60 s' },
            { text: '/api/search', value: 'bucket, 100/s, cap 200' },
            { text: '/api/', value: 'bucket, 20/s, cap 40' },
            { text: 'key', value: 'user id, else IP' },
          ],
          footer: { text: 'First matching prefix wins', tone: 'muted' },
        },
        caption: 'Routes pick the algorithm',
      },
      code: {
        language: 'python',
        title: 'Gateway with a rule table',
        source: `class RateLimitGateway:
    # rules: list of (prefix, KeyedLimiter), a KeyedLimiter is a Limiter
    def __init__(self, rules: list[tuple[str, Limiter]]):
        self.rules = rules

    def allow(self, path: str, key: str) -> bool:
        for prefix, limiter in self.rules:
            if path.startswith(prefix):
                return limiter.allow(f"{prefix}:{key}")
        return True`,
        highlight: [7, 8, 9],
      },
    },
    {
      title: 'The 429',
      tag: 'concept',
      heading: 'Tell the caller: 429 and rate limit headers',
      eli5: 'When the gatekeeper says no, she also says how many turns are left and when to come back. A kid who knows can wait politely instead of pushing.',
      body: [
        'A rejected call returns **429 Too Many Requests** with `Retry-After` in seconds. Every response can also carry `X-RateLimit-Limit`, `X-RateLimit-Remaining` and `X-RateLimit-Reset`.',
        'That means `allow` should return a **decision** object, not just a bool: allowed, remaining and retry-after. Well-behaved clients then back off by themselves. `X-RateLimit-Reset` is epoch seconds with some providers and seconds-until-reset with others. This lesson uses seconds until reset, so it matches `Retry-After`.',
      ],
      keyIdea: 'Return a decision with remaining and retry-after, so rejections are a usable signal, not a mystery.',
      metrics: { classes: '10', memory: 'per rule', burst: 'per route', safe: 'yes' },
      scene: {
        nodes: [
          { ...client, status: 'hot' },
          { id: 'gw', kind: 'block', at: at(0, -2), label: 'RateLimitGateway', sub: 'concrete class', icon: 'Route', tint: 'green' },
          { id: 'dec', kind: 'block', at: at(4, 3), label: 'Decision', sub: 'data class', icon: 'Receipt', tint: 'green' },
        ],
        links: [link('client', 'gw', 'request'), link('gw', 'dec', 'creates')],
        flows: [
          { path: ['client', 'gw'], tone: 'request', label: 'GET /api/', duration: 1.2 },
          { path: ['gw', 'client'], tone: 'error', label: '429 Retry-After: 12', duration: 1.4, delay: 1.3 },
        ],
        panel: {
          title: 'Response headers',
          icon: 'Table',
          rows: [
            { text: 'X-RateLimit-Limit', value: '100' },
            { text: 'X-RateLimit-Remaining', value: '0', tone: 'bad' },
            { text: 'X-RateLimit-Reset', value: '12 (seconds until reset)' },
            { text: 'Retry-After', value: '12', tone: 'warn' },
          ],
          footer: { text: 'Status 429, never 200 with an error body', tone: 'muted' },
        },
        caption: 'A rejection that explains itself',
      },
      code: {
        language: 'python',
        title: 'Decision and the 429 response',
        source: `from dataclasses import dataclass

@dataclass(frozen=True)
class Decision:
    allowed: bool
    remaining: int
    retry_after: float  # seconds until a request can pass

def to_response(d: Decision, limit: int):
    headers = {
        "X-RateLimit-Limit": str(limit),
        "X-RateLimit-Remaining": str(d.remaining),
        "X-RateLimit-Reset": str(int(d.retry_after)),  # seconds until reset
    }
    if not d.allowed:
        headers["Retry-After"] = str(int(d.retry_after) + 1)
        return 429, headers, {"error": "rate_limited"}
    return 200, headers, None`,
        highlight: [4, 5, 6, 7, 16, 17, 18],
      },
    },
    {
      title: 'Hard and soft',
      tag: 'tradeoff',
      heading: 'Hard limits and soft limits',
      eli5: 'A hard rule says no at exactly 100. A soft rule lets a kid go a little over and writes it down.',
      body: [
        'A **hard** limit never lets a request past the cap. A **soft** limit allows a small overage, for example up to 10% over, and logs it or alerts. Soft fits cheap routes, hard fits costly or abusive ones.',
        'Soft limits also help when counts are approximate, because a small error does not reject a good caller.',
      ],
      keyIdea: 'Decide per route whether the cap is hard or soft. It is a product decision.',
      metrics: { classes: '10', memory: 'per rule', burst: 'per route', safe: 'yes' },
      scene: {
        nodes: [
          { ...client },
          { id: 'gw', kind: 'block', at: at(0, -2), label: 'RateLimitGateway', sub: 'concrete class', icon: 'Route', tint: 'green', status: 'active' },
          { ...handler },
        ],
        links: [link('client', 'gw', 'allow(key)'), link('gw', 'handler', 'under 110%')],
        flows: [
          { path: ['client', 'gw', 'handler'], tone: 'request', label: 'soft: 105 of 100', duration: 1.6 },
        ],
        panel: {
          title: 'Hard vs soft',
          icon: 'Table',
          rows: [
            { text: 'Hard, costly routes', value: 'reject at 100', tone: 'good' },
            { text: 'Soft, cheap routes', value: 'allow to 110, log', tone: 'warn' },
            { text: 'Over 110% on soft', value: 'reject', tone: 'bad' },
            { text: 'Login, payments', value: 'hard' },
          ],
          footer: { text: 'Soft logs and allows up to 10% over', tone: 'muted' },
        },
        caption: 'Hard stops at the cap, soft bends a little',
      },
    },
    {
      title: 'Redis down',
      tag: 'tradeoff',
      heading: 'When Redis is down: fail open or fail closed',
      eli5: 'If the tally board breaks, the gate must pick: let everyone in, or let no one in.',
      body: [
        'If Redis is unreachable, **fail open** keeps the API up but drops protection. **Fail closed** keeps protection but turns a cache outage into an API outage.',
        'Most public APIs fail open and alert. Login often fails closed with a 503 or 429, since unlimited password guesses are worse than a short outage.',
      ],
      keyIdea: 'Decide per route what breaks when the limiter breaks: open for availability, closed for protection.',
      metrics: { classes: '10', memory: 'per rule', burst: 'per route', safe: 'yes' },
      scene: {
        nodes: [
          { id: 'rl', kind: 'block', at: at(-4, -2), label: 'RedisLimiter', sub: 'concrete class', icon: 'Gauge', tint: 'green', status: 'active' },
          { ...redis, at: at(0, 3), status: 'down', badge: 'timeout' },
          { ...handler, at: at(4, -2), chips: [{ text: 'open: allowed', tone: 'warn' }] },
          { id: 'login', kind: 'block', at: at(-8.5, 3), label: 'Login route', sub: 'fail closed', icon: 'Lock', tint: 'amber', chips: [{ text: '503 or 429', tone: 'bad' }] },
        ],
        links: [
          link('rl', 'redis', 'uses', { labelTone: 'bad' }),
          link('rl', 'handler', 'fail open'),
          link('rl', 'login', 'fail closed', { style: 'dashed', labelTone: 'warn' }),
        ],
        flows: [
          { path: ['rl', 'redis'], tone: 'error', label: 'evalsha()', duration: 1.3 },
          { path: ['rl', 'handler'], tone: 'request', label: 'allow anyway', duration: 1.4, delay: 1.4 },
          { path: ['rl', 'login'], tone: 'error', label: 'reject', duration: 1.4, delay: 2.0 },
        ],
        panel: {
          title: 'Failure policy',
          icon: 'Scale',
          rows: [
            { text: 'Public API', value: 'fail open, alert', tone: 'good' },
            { text: 'Login, payments', value: 'fail closed, 503', tone: 'warn' },
          ],
        },
        caption: 'Choose what breaks when the limiter breaks',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'The rate limiter, one pain at a time',
      eli5: 'The gatekeeper started with a tally sheet and ended with buckets, a lock, one shared board and a signboard that picks the right rule for each ride.',
      body: [
        'Fixed window is cheap with an edge burst. The log is exact but heavy. Token bucket gives bursts with two numbers. Leaky bucket smooths output.',
        'Then per-key registry, locks, eviction, Redis with Lua for many servers, a `Limiter` interface with a gateway, 429 headers and a failure policy.',
      ],
      keyIdea: 'Start simple, name the pain, add one class or one technique that fixes it.',
      metrics: { classes: '10', memory: 'bounded', burst: 'tuned', safe: 'yes' },
      metricTones: { memory: 'good', safe: 'good' },
      scene: {
        nodes: [
          { ...client },
          { id: 'gw', kind: 'block', at: at(0, -2), label: 'RateLimitGateway', sub: 'concrete class', icon: 'Route', tint: 'green', status: 'ok' },
          { ...iface, id: 'iface', at: at(4, 3) },
          { ...redis, at: at(-8.5, 3) },
        ],
        links: [link('client', 'gw', 'allow()'), link('gw', 'iface', 'uses'), link('iface', 'redis', 'state', { style: 'dashed' })],
        flows: [{ path: ['client', 'gw', 'iface'], tone: 'request', label: 'allow(key)', duration: 1.8 }],
        panel: {
          title: 'Versions',
          icon: 'Table',
          rows: [
            { text: 'v2 sliding log', value: 'edge burst' },
            { text: 'v3 token bucket', value: 'memory' },
            { text: 'lock', value: 'threads' },
            { text: 'Redis + Lua', value: 'many servers' },
            { text: 'Strategy', value: 'per route' },
          ],
        },
        caption: 'Each class exists because of one pain',
      },
      quiz: {
        question: 'Your login route must allow 5 tries a minute with no bursts, and the API route 100 a second with bursts. What design fits?',
        options: [
          'One global fixed window',
          'A Limiter interface with a SlidingWindow for login and a TokenBucket for the API, chosen by route',
          'One TokenBucket with capacity 100 for everything',
          'A lock around every request',
        ],
        answer: 1,
        explain: 'Strategy lets each route use the algorithm that matches its needs while callers see only allow(key).',
      },
    },
  ],
};
