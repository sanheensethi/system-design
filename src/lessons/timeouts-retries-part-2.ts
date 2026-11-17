import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const shoppers: SceneNode = { id: 'shoppers', kind: 'client', at: at(-5, 0), label: 'shoppers', sub: '100 checkouts/s' };
const api: SceneNode = { id: 'api', kind: 'block', at: at(-1.7, 0), label: 'checkout API', sub: '200 threads', icon: 'Server', tint: 'blue' };
const pay: SceneNode = { id: 'pay', kind: 'block', at: at(1.7, 0), label: 'payment service', sub: 'normally 50 ms', icon: 'Receipt', tint: 'amber' };
const ledger: SceneNode = { id: 'ledger', kind: 'db', at: at(5, 0), label: 'card ledger' };
const fraud: SceneNode = { id: 'fraud', kind: 'block', at: at(5, 0), label: 'fraud check', icon: 'Shield', tint: 'violet' };
const cache: SceneNode = { id: 'cache', kind: 'block', at: at(5.2, 5), label: 'last known price', sub: 'fallback', icon: 'Database', tint: 'teal' };

export const timeoutsRetriesPart2: Lesson = {
  id: 'timeouts-retries-part-2',
  title: 'Timeouts, retries, backoff and jitter (part 2)',
  tagline: 'Make retries safe with idempotency, cap them with budgets and deadlines, and stop calling a service that is down.',
  minutes: 15,
  level: 'Intermediate',
  learn: [
    'Why a timeout does not tell you whether the work happened',
    'Idempotency keys and which operations are safe to retry',
    'Retry budgets and retrying at one layer only',
    'Deadlines that travel with the request',
    'Circuit breakers, fallbacks and hedged requests',
    'The numbers to watch in production',
  ],
  metrics: [
    { key: 'charges', label: 'Charges made', icon: 'Receipt' },
    { key: 'load', label: 'Load on payments', icon: 'Activity' },
    { key: 'ok', label: 'Checkouts OK', icon: 'TrendingUp' },
    { key: 'wait', label: 'Worst wait', icon: 'Timer' },
  ],
  steps: [
    {
      title: 'Did it happen',
      tag: 'problem',
      heading: 'A timeout does not say whether the charge went through',
      eli5: 'You order a pizza by phone and the line goes dead before the shop answers. Did they hear you? If you call again and order again, you might get two pizzas.',
      body: [
        'The API sends `POST /charge` and the read timeout fires. The payment service may never have received it, may have charged the card and lost the reply, or may still be working.',
        'The API cannot tell these apart. Retrying blindly can charge the shopper **twice**.',
      ],
      keyIdea: 'A timeout is a missing answer, not a "no". The work may have happened.',
      metrics: { charges: '1 or 2?', load: '100/s', ok: '?', wait: '1 s' },
      metricTones: { charges: 'bad', ok: 'warn' },
      scene: {
        nodes: [
          { ...api, status: 'active', chips: ['POST /charge $40'] },
          { ...pay, status: 'hot', badge: 'reply lost' },
          { ...ledger, badge: '$40 taken?' },
        ],
        links: [link('api', 'pay', { label: 'read timeout 1 s', labelTone: 'warn' }), link('pay', 'ledger')],
        flows: [
          { path: ['api', 'pay', 'ledger'], tone: 'request', label: 'POST /charge', duration: 1.8 },
          { path: ['pay', 'api'], tone: 'error', label: 'reply never arrives', duration: 1.6, delay: 2 },
        ],
        panel: {
          title: 'What the API cannot know',
          icon: 'Timer',
          rows: [
            { text: 'Request never arrived', value: 'no charge', tone: 'good' },
            { text: 'Charged, reply lost', value: 'charged', tone: 'bad' },
            { text: 'Still processing', value: 'will charge', tone: 'warn' },
          ],
          footer: { text: 'All three look like a timeout', tone: 'warn' },
        },
        caption: 'Silence has three possible meanings',
      },
    },
    {
      title: 'Safe to retry',
      tag: 'concept',
      heading: 'Some operations are safe to repeat, some are not',
      eli5: 'Asking the shop for the menu twice changes nothing. Ordering a pizza twice gives you two pizzas. Only the first kind is safe to redial.',
      body: [
        'An **idempotent** operation gives the same result no matter how many times it runs. `GET`, `PUT` and `DELETE` are idempotent by definition. Reading a price twice is harmless.',
        '`POST /charge` is not. Each call creates a new charge. Retrying it blindly is only safe once you make it idempotent.',
      ],
      keyIdea: 'Retry freely only what is idempotent. Make everything else idempotent first.',
      metrics: { charges: '1 or 2?', load: '100/s', ok: '99.9%', wait: '1 s' },
      metricTones: { charges: 'warn' },
      scene: {
        nodes: [{ ...api, status: 'active' }, { ...pay, status: 'ok' }],
        links: [link('api', 'pay', { arrow: 'both' })],
        flows: [
          { path: ['api', 'pay'], tone: 'request', label: 'GET /price', count: 2, duration: 1 },
          { path: ['pay', 'api'], tone: 'response', label: 'same answer', duration: 1, delay: 1.1 },
          { path: ['api', 'pay'], tone: 'error', label: 'POST /charge twice', count: 2, duration: 1, delay: 2.4 },
        ],
        panel: {
          title: 'Safe to repeat?',
          icon: 'Repeat',
          rows: [
            { text: 'GET /price', value: 'safe', tone: 'good' },
            { text: 'PUT /cart/7', value: 'safe', tone: 'good' },
            { text: 'DELETE /cart/7', value: 'safe', tone: 'good' },
            { text: 'POST /charge', value: 'double charge', tone: 'bad' },
          ],
        },
        caption: 'Repeating a charge repeats the money',
      },
    },
    {
      title: 'Idempotency key',
      tag: 'concept',
      heading: 'An idempotency key makes a charge safe to retry',
      eli5: 'Write your order number on the slip. If you call again with the same number, the shop says "we already have order 7" and does not bake a second pizza. That number is an **idempotency key**.',
      body: [
        'The client creates a unique key once per checkout, such as a UUID, and sends it as an `Idempotency-Key` header on every attempt.',
        'The server stores the key with the result. A repeat with the same key returns the stored result and charges nothing new. Keys expire after a day or so.',
      ],
      keyIdea: 'Same key, same result. The server remembers, so the client can retry without fear.',
      metrics: { charges: '1', load: '101/s', ok: '99.99%', wait: '1 s' },
      metricTones: { charges: 'good', ok: 'good' },
      scene: {
        nodes: [
          { ...api, status: 'active', chips: ['key: ord-7f3a'] },
          { ...pay, status: 'ok', badge: 'key seen before' },
          { ...ledger, status: 'ok', badge: '1 charge' },
        ],
        links: [link('api', 'pay', { arrow: 'both' }), link('pay', 'ledger')],
        flows: [
          { path: ['api', 'pay', 'ledger'], tone: 'request', label: 'charge, key ord-7f3a', duration: 1.8 },
          { path: ['api', 'pay'], tone: 'request', label: 'retry, same key', duration: 1, delay: 2.4 },
          { path: ['pay', 'api'], tone: 'response', label: 'stored result', duration: 1, delay: 3.5 },
        ],
        panel: {
          title: 'Key table in payments',
          icon: 'Database',
          rows: [
            { text: 'ord-7f3a', value: 'charged, $40', tone: 'good' },
            { text: 'Retry of ord-7f3a', value: 'returns stored', tone: 'good' },
            { text: 'New charge made', value: 'none', tone: 'good' },
          ],
          footer: { text: 'Keys are kept for about 24 hours', tone: 'muted' },
        },
        caption: 'The retry gets the old answer, not a new charge',
      },
      code: {
        language: 'python',
        title: 'Server side: look up the key before charging',
        source: `def charge(key, order):
    saved = store.get(key)
    if saved:                       # a retry: replay the result
        return saved
    result = ledger.charge(order)   # first time: do the work
    store.set(key, result, ttl=86400)
    return result

# client: one key per checkout, reused on every attempt
headers = {"Idempotency-Key": order.id}`,
        highlight: [2, 3, 5, 6],
      },
    },
    {
      title: 'Key races',
      tag: 'tradeoff',
      heading: 'Two retries with one key can still race',
      eli5: 'Two helpers phone in the same order number at the same instant. If neither sees the other\'s slip yet, both start baking. The shop needs one lock on the order number.',
      body: [
        'If the first attempt is still running when the retry arrives, a plain lookup finds nothing and both charge. Insert the key **atomically** before doing the work, for example with a unique database constraint.',
        'Claim the key as in-progress, call the processor with the same key downstream (it cannot share your DB transaction), then record the result. The loser gets a `409`. Expire stuck in-progress keys after a crash. Reject a reused key with a different body using `422`.',
      ],
      keyIdea: 'Claim the key atomically first, then do the work. A lookup alone leaves a gap.',
      metrics: { charges: '1', load: '101/s', ok: '99.99%', wait: '1 s' },
      metricTones: { charges: 'good' },
      scene: {
        nodes: [
          { ...api, status: 'active', chips: ['attempt 1', 'attempt 2'] },
          { ...pay, status: 'active', badge: 'unique key insert' },
          { ...ledger, status: 'ok' },
        ],
        links: [link('api', 'pay', { label: 'same key, 2 calls' }), link('pay', 'ledger')],
        flows: [
          { path: ['api', 'pay'], tone: 'request', label: 'attempt 1', duration: 1 },
          { path: ['api', 'pay'], tone: 'request', label: 'attempt 2', duration: 1, delay: 0.3 },
          { path: ['pay', 'ledger'], tone: 'request', label: 'one wins', duration: 1, delay: 1.4 },
          { path: ['pay', 'api'], tone: 'error', label: '409 in progress', duration: 1, delay: 1.5 },
        ],
        panel: {
          title: 'Claim, then charge',
          icon: 'Lock',
          rows: [
            { text: 'INSERT key', value: 'first caller wins', tone: 'good' },
            { text: 'Second INSERT', value: 'unique violation', tone: 'warn' },
            { text: 'Second caller gets', value: '409, retry later', tone: 'warn' },
            { text: 'Stuck in progress', value: 'expires, then recover', tone: 'muted' },
            { text: 'Same key, other body', value: '422', tone: 'bad' },
          ],
        },
        caption: 'The database decides who goes first',
      },
    },
    {
      title: 'Retry budget',
      tag: 'concept',
      heading: 'A retry budget caps the extra load retries can add',
      eli5: 'Each family may redial only a few times a day, and the whole town shares a small pile of redial tickets. When the tickets run out, nobody redials, so the shop is never buried.',
      body: [
        'A **retry budget** limits retries to a fraction of normal traffic, often 10%. Count requests, and allow a retry only while retries stay under 10% of them.',
        'A 1% blip fits easily inside the budget. A real outage burns it in seconds, so extra load is capped at about 1.1× instead of 4×.',
      ],
      keyIdea: 'Allow retries in proportion to traffic. When the budget is spent, fail fast instead of piling on.',
      metrics: { charges: '1', load: '110/s', ok: '73%', wait: '1 s' },
      metricTones: { load: 'good', ok: 'warn' },
      scene: {
        nodes: [
          { ...api, status: 'active', chips: [{ text: 'budget 10%', tone: 'good' }] },
          { ...pay, status: 'hot', load: 70, badge: 'capacity 80/s' },
        ],
        links: [link('api', 'pay', { label: '100/s + 10/s retries' })],
        flows: [
          { path: ['api', 'pay'], tone: 'request', label: '100/s', count: 3, duration: 1 },
          { path: ['api', 'pay'], tone: 'request', label: '10/s retries', duration: 1, delay: 1.2 },
          { path: ['pay', 'api'], tone: 'error', label: 'budget spent: no retry', duration: 1, delay: 2.4 },
        ],
        panel: {
          title: 'Load during an outage',
          icon: 'Gauge',
          rows: [
            { text: 'Retry all, 3 times', value: 'up to 400/s', tone: 'bad' },
            { text: 'Budget 10%', value: 'at most 110/s', tone: 'good' },
            { text: 'Normal traffic', value: '100/s' },
          ],
          footer: { text: 'Retries stop when the budget empties', tone: 'muted' },
        },
        caption: 'The storm is capped before it starts',
      },
    },
    {
      title: 'Budget in code',
      tag: 'concept',
      heading: 'A retry budget is a token bucket you refill with successes',
      eli5: 'Every good phone call earns the family a tenth of a redial ticket. Every redial spends one. Good days build up tickets, bad days run out fast.',
      body: [
        'Each request adds `0.1` token to a bucket with a small cap. Each retry costs one whole token. With a 10% ratio, the client can retry only about one call in ten.',
        'Keep a floor of a few tokens so a quiet service can still retry a lone failure.',
      ],
      keyIdea: 'Earn tokens from traffic and spend them on retries. The ratio is the cap.',
      metrics: { charges: '1', load: '110/s', ok: '73%', wait: '1 s' },
      metricTones: { load: 'good' },
      scene: {
        nodes: [{ ...api, status: 'active', chips: ['tokens: 4.2'] }, { ...pay, status: 'ok' }],
        links: [link('api', 'pay', { arrow: 'both' })],
        flows: [
          { path: ['api', 'pay'], tone: 'request', label: 'request: +0.1 token', duration: 1 },
          { path: ['pay', 'api'], tone: 'error', label: 'timeout', duration: 1, delay: 1.1 },
          { path: ['api', 'pay'], tone: 'request', label: 'retry: -1 token', duration: 1, delay: 2.4 },
        ],
        panel: {
          title: 'Token bucket',
          icon: 'Layers',
          rows: [
            { text: 'Per request', value: '+0.1 token', tone: 'good' },
            { text: 'Per retry', value: '-1 token', tone: 'warn' },
            { text: 'Bucket empty', value: 'no retry', tone: 'bad' },
          ],
        },
        caption: 'Traffic earns the right to retry',
      },
      quiz: {
        question: 'A client has a 10% retry budget and sends 1,000 requests per second. The dependency fails every call. About how many retries per second does the client send?',
        options: ['0', '100', '1,000', '3,000'],
        answer: 1,
        explain: 'Each request earns 0.1 token and each retry costs 1, so retries are capped near 10% of traffic: about 100 per second. Without a budget, 3 retries per call would add 3,000.',
      },
      code: {
        language: 'python',
        title: 'Retry budget as a token bucket',
        source: `class RetryBudget:
    def __init__(self, ratio=0.1, cap=10):
        self.ratio, self.cap, self.tokens = ratio, cap, cap

    def on_request(self):
        self.tokens = min(self.cap, self.tokens + self.ratio)

    def can_retry(self):
        if self.tokens >= 1:
            self.tokens -= 1
            return True
        return False                 # budget spent: fail fast`,
        highlight: [5, 6, 8, 9, 10],
      },
    },
    {
      title: 'One layer',
      tag: 'tradeoff',
      heading: 'Retry at one layer and pass failures up the rest',
      eli5: 'Only the front desk redials the shop. The cook, the dough maker and the farmer just say "it failed" and pass it up. One redial, not sixty-four.',
      body: [
        'Pick the layer closest to the user, or the one that knows the operation is safe to repeat, and retry there. Layers below make one attempt and return the error.',
        'The ledger now sees 4 calls, one per API attempt, instead of 64. Where a lower layer must retry, give it a single attempt and a short timeout.',
      ],
      keyIdea: 'One retrying layer per call chain. Everything below it fails fast and reports.',
      metrics: { charges: '1', load: '100/s', ok: '99.9%', wait: '1.5 s' },
      metricTones: { load: 'good', ok: 'good' },
      scene: {
        nodes: [
          { ...api, status: 'active', chips: [{ text: 'retries: 3', tone: 'good' }] },
          { ...pay, chips: ['retries: 0'] },
          { ...fraud, chips: ['retries: 0'] },
          { ...ledger, at: at(8.4, 0), status: 'ok', badge: '4 calls' },
        ],
        links: [
          link('api', 'pay', { label: 'up to 4 attempts', labelTone: 'good' }),
          link('pay', 'fraud', { label: '1 attempt' }),
          link('fraud', 'ledger', { label: '1 attempt' }),
        ],
        flows: [
          { path: ['api', 'pay', 'fraud', 'ledger'], tone: 'request', count: 2, duration: 2.4 },
          { path: ['ledger', 'fraud', 'pay', 'api'], tone: 'error', label: 'fail fast', duration: 2.4, delay: 2.6 },
        ],
        panel: {
          title: 'Attempts reaching the bottom',
          icon: 'Layers',
          rows: [
            { text: 'Every layer retries 4x', value: '64', tone: 'bad' },
            { text: 'Only the top retries 4x', value: '4', tone: 'good' },
          ],
          footer: { text: 'Multiply attempts, or keep them to one layer', tone: 'muted' },
        },
        caption: 'The deeper layers stop amplifying',
      },
    },
    {
      title: 'Deadlines',
      tag: 'concept',
      heading: 'A deadline travels with the request',
      eli5: 'The family has to be fed by six. Each helper tells the next one how much time is left, so nobody starts a task that cannot finish before six.',
      body: [
        'Fixed timeouts at each hop add up. With 3 hops of 1 second and 2 retries each, the user could wait far longer than they will stay. A **deadline** is one absolute cutoff for the whole request, such as "answer by 2.0 s from the start".',
        'Each service reads the deadline (a gRPC deadline or a request header) and uses the time left. Retry only if the time left covers the sleep plus one more attempt.',
      ],
      keyIdea: 'Give the request one deadline. Every hop uses what is left, never a fresh full timeout.',
      metrics: { charges: '1', load: '100/s', ok: '99.9%', wait: '2 s cap' },
      metricTones: { wait: 'good' },
      scene: {
        nodes: [
          { ...shoppers },
          { ...api, status: 'active', badge: 'deadline 2.0 s' },
          { ...pay, badge: '1.4 s left' },
          { ...fraud, at: at(5, 0), badge: '0.9 s left' },
        ],
        links: [link('shoppers', 'api'), link('api', 'pay', { label: 'deadline: 1.4 s' }), link('pay', 'fraud', { label: 'deadline: 0.9 s' })],
        flows: [
          { path: ['shoppers', 'api'], tone: 'request', duration: 0.8 },
          { path: ['api', 'pay'], tone: 'request', label: 'budget 1.4 s', duration: 0.9, delay: 0.9 },
          { path: ['pay', 'fraud'], tone: 'request', label: 'budget 0.9 s', duration: 0.9, delay: 1.9 },
        ],
        panel: {
          title: 'Time left at each hop',
          icon: 'Clock',
          rows: [
            { text: 'Start at API', value: '2.0 s' },
            { text: 'Reaches payments', value: '1.4 s', tone: 'default' },
            { text: 'Reaches fraud check', value: '0.9 s', tone: 'warn' },
            { text: 'Retry allowed if', value: 'left > sleep + attempt', tone: 'good' },
            { text: 'Past zero', value: 'drop the call', tone: 'bad' },
          ],
        },
        caption: 'One clock for the whole chain',
      },
    },
    {
      title: 'Dead work',
      tag: 'case',
      heading: 'Case: working on a request nobody is waiting for',
      eli5: 'The family gave up and went home, but the cook is still baking their pizza. Nobody will eat it, and the oven is busy while real customers wait.',
      body: [
        'The shopper left after 2 seconds, but the fraud check and the ledger are still grinding through the request. Without a deadline they cannot know.',
        'If a service checks the remaining time before each expensive step and stops at zero, that wasted work disappears under load.',
      ],
      keyIdea: 'Work past the deadline is pure waste. Check the clock before each costly step.',
      metrics: { charges: '1', load: '100/s', ok: '73%', wait: '2 s cap' },
      metricTones: { ok: 'warn' },
      scene: {
        nodes: [
          { ...api, status: 'dim', badge: 'gave up at 2.0 s' },
          { ...pay, status: 'hot', load: 90, badge: 'still working' },
          { ...fraud, status: 'hot', load: 95, badge: 'still working' },
        ],
        links: [link('api', 'pay', { label: 'caller gone', labelTone: 'warn' }), link('pay', 'fraud')],
        flows: [
          { path: ['pay', 'fraud'], tone: 'request', label: 'wasted work', count: 3, duration: 1.2 },
          { path: ['fraud', 'pay'], tone: 'error', label: 'reply to nobody', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Check the clock',
          icon: 'Timer',
          rows: [
            { text: 'Time left > 0', value: 'do the step', tone: 'good' },
            { text: 'Time left = 0', value: 'stop, return error', tone: 'warn' },
            { text: 'No deadline passed', value: 'work until done', tone: 'bad' },
          ],
        },
        caption: 'Without a deadline the chain keeps burning cycles',
      },
      code: {
        language: 'go',
        title: 'Deadline carried in the context',
        source: `// the edge sets one deadline for the whole request
ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
defer cancel()

// every call below inherits what is left of it
resp, err := payClient.Charge(ctx, order)
if errors.Is(err, context.DeadlineExceeded) {
    return http.StatusGatewayTimeout    // 504: out of time
}`,
        highlight: [2, 6, 8],
      },
    },
    {
      title: 'Circuit breaker',
      tag: 'concept',
      heading: 'A circuit breaker stops calls to a service that is down',
      eli5: 'After the shop fails to answer ten times, the family stops dialing for a minute. Then they try once. If it rings through, they start dialing again. That pause is a **circuit breaker**.',
      body: [
        'The breaker counts failures. When they pass a threshold, say 50% of the last 20 calls, it **opens** and fails every call instantly without touching the network.',
        'After a cool-down it goes **half-open** and lets a few trial calls through. If they succeed it **closes**. If not, it opens again.',
      ],
      keyIdea: 'Closed passes calls, open rejects them at once, half-open probes for recovery.',
      metrics: { charges: '1', load: '~0/s', ok: '0% (fast errors)', wait: '5 ms' },
      metricTones: { load: 'good', wait: 'good', ok: 'bad' },
      scene: {
        nodes: [
          shoppers,
          { ...api, status: 'active', badge: 'breaker: OPEN' },
          { ...pay, status: 'down', badge: 'recovering' },
        ],
        links: [link('shoppers', 'api'), link('api', 'pay', { label: 'trial calls only', labelTone: 'warn', style: 'dashed' })],
        flows: [
          { path: ['api', 'shoppers'], tone: 'error', label: 'rejected in 5 ms', duration: 1 },
          { path: ['api', 'pay'], tone: 'handshake', label: 'trial call', duration: 1, delay: 2.4 },
        ],
        panel: {
          title: 'Breaker states',
          icon: 'Shield',
          rows: [
            { text: 'Closed', value: 'calls pass', tone: 'good' },
            { text: 'Open (30 s)', value: 'fail at once', tone: 'bad' },
            { text: 'Half-open', value: '3 trial calls', tone: 'warn' },
          ],
          footer: { text: 'Opens at 50% failures over 20 calls', tone: 'muted' },
        },
        caption: 'A down service gets quiet time to recover',
      },
    },
    {
      title: 'Fallbacks',
      tag: 'tradeoff',
      heading: 'When the call fails, serve something cheaper',
      eli5: 'If the shop will not pick up, the family eats the leftovers from the fridge. It is not a fresh pizza, but dinner still happens.',
      body: [
        'A **fallback** is the plan for a failed or rejected call: a cached value, a default, a queued request, or a clear error. Choose it per feature.',
        'A product page can show the last known price. A charge cannot guess, so it queues the order or returns a clean `503`. Stale data suits reads, never money.',
      ],
      keyIdea: 'Decide the failure answer in advance. Stale reads are fine, invented writes are not.',
      metrics: { charges: '1', load: '~0/s', ok: '70%', wait: '5 ms' },
      metricTones: { ok: 'warn', wait: 'good' },
      scene: {
        nodes: [
          shoppers,
          { ...api, status: 'active', badge: 'breaker: OPEN' },
          { ...pay, status: 'down' },
          { ...cache, status: 'ok', badge: 'price from 2 min ago' },
        ],
        links: [link('shoppers', 'api'), link('api', 'pay', { style: 'dashed', label: 'skipped', labelTone: 'warn' }), link('api', 'cache')],
        flows: [
          { path: ['api', 'cache', 'api'], tone: 'response', label: 'stale price OK', duration: 1.6 },
          { path: ['api', 'shoppers'], tone: 'error', label: 'charge: 503, try later', duration: 1.2, delay: 2 },
        ],
        panel: {
          title: 'Fallback per feature',
          icon: 'List',
          rows: [
            { text: 'Product price', value: 'cached value', tone: 'good' },
            { text: 'Recommendations', value: 'default list', tone: 'good' },
            { text: 'Charge a card', value: 'queue or 503', tone: 'warn' },
          ],
        },
        caption: 'Degrade the safe parts, refuse the risky ones',
      },
    },
    {
      title: 'Hedging',
      tag: 'tradeoff',
      heading: 'Hedged requests trade a little load for a shorter tail',
      eli5: 'If the first shop is slow to answer, the family also calls a second shop at the same time. Whoever answers first wins, and the other call is hung up.',
      body: [
        'Send the request, and if no reply arrives by the p95 latency, send the same request to a second replica. Take the first answer and cancel the other.',
        'This cuts the p99 sharply for about 5% extra load. Use it only on idempotent reads, and never when the callee is already overloaded.',
      ],
      keyIdea: 'A late duplicate cuts tail latency for a few percent of load. Hedge reads, not writes.',
      metrics: { charges: '1', load: '105/s', ok: '99.99%', wait: '120 ms' },
      metricTones: { ok: 'good', wait: 'good', load: 'warn' },
      scene: {
        nodes: [
          { ...api, at: at(-1.7, 0), status: 'active', chips: ['GET /price'] },
          { id: 'repA', kind: 'block', at: at(3.6, -3), label: 'price replica A', sub: 'slow now', icon: 'Database', tint: 'amber', status: 'hot' },
          { id: 'repB', kind: 'block', at: at(1.6, 3.4), label: 'price replica B', sub: 'healthy', icon: 'Database', tint: 'amber', status: 'ok' },
        ],
        links: [link('api', 'repA'), link('api', 'repB', { label: 'after p95 wait' })],
        flows: [
          { path: ['api', 'repA'], tone: 'request', label: 'first try', duration: 1 },
          { path: ['api', 'repB'], tone: 'request', label: 'hedge at 80 ms', duration: 1, delay: 1.2 },
          { path: ['repB', 'api'], tone: 'response', label: 'first answer wins', duration: 1, delay: 2.4 },
        ],
        panel: {
          title: 'Hedging at the p95',
          icon: 'Gauge',
          rows: [
            { text: 'p99 without', value: '700 ms', tone: 'warn' },
            { text: 'p99 with', value: '120 ms', tone: 'good' },
            { text: 'Extra load', value: 'about 5%', tone: 'default' },
          ],
          footer: { text: 'Reads only, never charges', tone: 'warn' },
        },
        caption: 'The slow replica is outrun, not waited on',
      },
    },
    {
      title: 'Watch it',
      tag: 'case',
      heading: 'Numbers that show retries going wrong early',
      eli5: 'The shopkeeper keeps a tally of redials, hang-ups and ticket counts. A jump in the redial tally is the first sign of trouble.',
      body: [
        'Track the **retry rate** (retries divided by requests), timeouts per dependency, the breaker state, and the number of threads or connections in use.',
        'A retry rate above a few percent, or a pool near full, warns you before users notice. Alert on the trend, not only on errors.',
      ],
      keyIdea: 'Graph retries and timeouts per dependency. They rise before the error rate does.',
      metrics: { charges: '1', load: '103/s', ok: '99.9%', wait: '1 s' },
      metricTones: { load: 'good', ok: 'good' },
      scene: {
        nodes: [
          { ...api, status: 'active' },
          { ...pay, status: 'ok' },
          { id: 'mon', kind: 'monitor', at: at(-1.7, 4.4), label: 'metrics', sub: 'per dependency' },
        ],
        links: [link('api', 'pay', { arrow: 'both' }), link('api', 'mon', { style: 'dashed' })],
        flows: [
          { path: ['api', 'pay'], tone: 'request', count: 3, duration: 1 },
          { path: ['api', 'mon'], tone: 'event', label: 'retries, timeouts', duration: 1.2, delay: 1.2 },
        ],
        panel: {
          title: 'Alert thresholds',
          icon: 'Activity',
          rows: [
            { text: 'Retry rate', value: 'over 5%', tone: 'warn' },
            { text: 'Timeouts per dependency', value: 'rising', tone: 'warn' },
            { text: 'Breaker open', value: 'page someone', tone: 'bad' },
            { text: 'Thread pool', value: 'over 80%', tone: 'warn' },
          ],
        },
        caption: 'Retries are a smoke alarm',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Part 2 recap: retry safely, cap the cost, stop early',
      eli5: 'Put an order number on every call so a redial never bakes a second pizza. Share a small pile of redial tickets. Keep one clock for the whole meal. Stop dialing a shop that is clearly closed.',
      body: [
        'Make retried operations **idempotent** with a key. Cap retries with a **budget**, retry at one layer, and carry one **deadline** down the chain.',
        'Add a **circuit breaker** and a planned **fallback**. Hedge only idempotent reads, and watch the retry rate.',
      ],
      keyIdea: 'Idempotency makes a retry safe. Budgets, deadlines and breakers make it affordable.',
      metrics: { charges: '1', load: '103/s', ok: '99.99%', wait: '2 s cap' },
      metricTones: { charges: 'good', load: 'good', ok: 'good', wait: 'good' },
      scene: {
        nodes: [shoppers, { ...api, status: 'ok' }, { ...pay, status: 'ok' }, { ...ledger, status: 'ok' }],
        links: [link('shoppers', 'api'), link('api', 'pay'), link('pay', 'ledger')],
        flows: [
          { path: ['shoppers', 'api', 'pay', 'ledger'], tone: 'request', count: 2, duration: 2 },
          { path: ['ledger', 'pay', 'api', 'shoppers'], tone: 'response', count: 2, duration: 2, delay: 2.1 },
        ],
        panel: {
          title: 'Part 2 checklist',
          icon: 'List',
          rows: [
            { text: 'Idempotency key on writes', value: 'yes', tone: 'good' },
            { text: 'Retry budget 10%', value: 'yes', tone: 'good' },
            { text: 'One deadline per request', value: 'yes', tone: 'good' },
            { text: 'Breaker and fallback', value: 'yes', tone: 'good' },
          ],
        },
        caption: 'Safe, bounded and quick to give up',
      },
      quiz: {
        question: 'A checkout call times out and the client retries. What makes the retry safe from double-charging the card?',
        options: [
          'A longer read timeout on the retry',
          'Exponential backoff with jitter',
          'An idempotency key sent on every attempt and stored by the server with the result',
          'A circuit breaker on the client',
        ],
        answer: 2,
        explain: 'Backoff, jitter and breakers shape load, but only an idempotency key lets the server recognize a repeat and return the stored result instead of charging again.',
      },
    },
  ],
};
