import type { Lesson, SceneNode } from '../engine/types';

const shoppers: SceneNode = { id: 'shoppers', kind: 'client', at: [-3, 3], label: 'shoppers', sub: '100 checkouts/s' };
const api: SceneNode = { id: 'api', kind: 'server', at: [-1, 1], label: 'checkout API', sub: '200 threads' };
const pay: SceneNode = { id: 'pay', kind: 'service', at: [1.25, -1.25], label: 'payment service', sub: 'handles 150/s' };
const ledger: SceneNode = { id: 'ledger', kind: 'db', at: [3.5, -3.5], label: 'card ledger' };
const catalog: SceneNode = { id: 'catalog', kind: 'service', at: [4.6, 2.1], label: 'catalog service', sub: 'healthy' };
const fraud: SceneNode = { id: 'fraud', kind: 'service', at: [3.5, -3.5], label: 'fraud check' };
const ledgerFar: SceneNode = { ...ledger, at: [5.75, -5.75] };

// Three API instances, used when the story is about many callers acting in step.
const apiA: SceneNode = { id: 'apiA', kind: 'server', at: [-2.9, -1.9], label: 'API 1' };
const apiB: SceneNode = { id: 'api', kind: 'server', at: [-1, 1], label: 'API 2' };
const apiC: SceneNode = { id: 'apiC', kind: 'server', at: [1.9, 2.9], label: 'API 3' };

const chain = [
  { from: 'shoppers', to: 'api' },
  { from: 'api', to: 'pay' },
  { from: 'pay', to: 'ledger' },
];
const fanLinks = [
  { from: 'apiA', to: 'pay' },
  { from: 'api', to: 'pay' },
  { from: 'apiC', to: 'pay' },
];

export const timeoutsRetries: Lesson = {
  id: 'timeouts-retries',
  title: 'Timeouts, retries, backoff and jitter',
  tagline: 'Stop waiting forever, try again without making things worse, and know when to give up.',
  minutes: 14,
  level: 'Intermediate',
  learn: [
    'Why one call without a timeout can freeze a whole server',
    'How to pick a timeout from the callee\'s latency and your thread pool',
    'How retries multiply load and turn a blip into a storm',
    'Exponential backoff, jitter and retry budgets',
    'Why only idempotent calls are safe to retry',
    'Passing one deadline down the whole call chain',
  ],
  metrics: [
    { key: 'threads', label: 'API threads busy' },
    { key: 'load', label: 'Load on payments' },
    { key: 'ok', label: 'Checkouts OK' },
    { key: 'wait', label: 'Worst wait' },
  ],
  steps: [
    {
      title: 'Stuck threads',
      tag: 'problem',
      heading: 'One slow dependency freezes the whole API',
      eli5: 'You phone the pizza shop and nobody picks up, but you never hang up. Now your phone is busy and nobody else can reach you. The **checkout API** is you, holding the line forever.',
      body: [
        'The checkout API takes **100 checkouts per second**. Each one calls the payment service, which normally answers in 50 ms. The API has 200 worker threads, and at 50 ms per call only about 5 are busy at a time.',
        'Then a bad lock in the card ledger makes the payment service take **30 seconds** per call. It does not fail. It just stops answering. The HTTP client has no timeout, so each API thread sits and waits. 100 new threads get stuck every second, and all 200 are gone in two seconds.',
        'Now the API cannot serve anything. Product pages that only need the healthy catalog service hang too, because there is no free thread left to run them.',
      ],
      keyIdea: 'A slow dependency is worse than a dead one. Without a timeout, its slowness becomes your slowness.',
      metrics: { threads: '200 / 200', load: '100/s', ok: '0%', wait: '30 s' },
      scene: {
        nodes: [
          shoppers,
          { ...api, status: 'hot', badge: '200 / 200 stuck' },
          { ...pay, status: 'hot', badge: '30 s per call' },
          { ...ledger, status: 'hot' },
          { ...catalog, status: 'dim' },
        ],
        links: [...chain, { from: 'api', to: 'catalog', style: 'faint' }],
        flows: [
          { path: ['shoppers', 'api'], tone: 'request', count: 5, duration: 1 },
          { path: ['api', 'pay'], tone: 'request', label: 'POST /charge', count: 5, duration: 1.2, delay: 1 },
          { path: ['pay', 'api'], tone: 'error', label: 'still waiting', duration: 5, delay: 2.2 },
        ],
        caption: 'Every thread is waiting on the same slow call',
      },
    },
    {
      title: 'Timeouts',
      tag: 'concept',
      heading: 'A timeout turns a hang into a fast failure',
      eli5: 'New rule: if the pizza shop does not pick up after ten rings, hang up. That is a **timeout**. You did not get pizza, but your phone is free again.',
      body: [
        'A **timeout** is the longest you are willing to wait for an answer. When it passes, the client drops the call and raises an error. The thread goes back to the pool and can do other work.',
        'There are two to set. The **connect timeout** covers opening the connection and should be short, because a healthy server on the same network accepts in a few milliseconds. The **read timeout** covers waiting for the response and depends on how long the work takes.',
        'Many HTTP clients wait forever by default. Python `requests` is one of them. Set a timeout on every network call: HTTP, database, cache, queue.',
      ],
      keyIdea: 'Every network call needs a timeout. A failure you get in one second is one you can handle.',
      metrics: { threads: '100 / 200', load: '100/s', ok: '0% (fast errors)', wait: '1 s' },
      scene: {
        nodes: [
          shoppers,
          { ...api, status: 'active', badge: 'gives up at 1 s' },
          { ...pay, status: 'hot', badge: '30 s per call' },
          { ...ledger, status: 'hot' },
          { ...catalog, status: 'ok' },
        ],
        links: [...chain, { from: 'api', to: 'catalog' }],
        flows: [
          { path: ['shoppers', 'api'], tone: 'request', count: 3, duration: 1 },
          { path: ['api', 'pay'], tone: 'request', label: 'POST /charge', duration: 1, delay: 1 },
          { path: ['api', 'shoppers'], tone: 'error', label: '503 after 1 s', duration: 1, delay: 2.6 },
          { path: ['api', 'catalog', 'api'], tone: 'response', label: 'pages still load', duration: 1.8, delay: 1 },
        ],
        caption: 'Checkout fails fast, the rest of the site keeps working',
      },
      code: {
        language: 'python',
        title: 'Connect and read timeouts on every call',
        source: `import requests

session = requests.Session()

def charge(order):
    try:
        resp = session.post(
            "http://payments.internal/charge",
            json=order,
            timeout=(0.2, 1.0),      # connect 200 ms, read 1 s
        )
        resp.raise_for_status()
        return resp.json()
    except requests.Timeout:
        # the thread is free again; tell the caller quickly
        raise PaymentUnavailable("payments did not answer in 1 s")`,
        highlight: [10, 14, 16],
      },
    },
    {
      title: 'Picking a number',
      tag: 'tradeoff',
      heading: 'Too short fails good calls, too long holds threads',
      eli5: 'Hang up after one ring and you never get pizza, even on a good day. Wait an hour and your phone is stuck again. Count how many rings the **payment service** usually needs, then add a few.',
      body: [
        'Start from the callee\'s real latency. The payment service has a p99 of 300 ms and a p99.9 of 700 ms. A timeout of **1 second** sits just above that, so fewer than 1 in 1,000 healthy calls gets cut off.',
        'Then check what it costs you when things go wrong. Threads held equals `call rate × time held`. At 100 calls per second and a 1 second timeout, a hung dependency ties up 100 threads. With 200 threads the API survives. With a 5 second timeout it would need 500 and would not.',
        'A timeout set below normal latency creates failures on its own. If the p99 is 300 ms and the timeout is 200 ms, more than 1% of healthy calls fail, and each failure usually triggers a retry.',
      ],
      keyIdea: 'Set the timeout a little above the callee\'s tail latency, then check that rate × timeout fits in your thread pool.',
      metrics: { threads: '100 / 200', load: '100/s', ok: '0% (fast errors)', wait: '1 s' },
      scene: {
        nodes: [
          shoppers,
          { ...api, status: 'active', badge: '100/s x 1 s = 100 threads' },
          { ...pay, badge: 'p99 300 ms' },
          ledger,
        ],
        links: chain,
        flows: [
          { path: ['api', 'pay'], tone: 'request', count: 4, duration: 1 },
          { path: ['pay', 'api'], tone: 'response', label: '50 ms typical', count: 3, duration: 0.8, delay: 1.1 },
          { path: ['pay', 'api'], tone: 'error', label: 'cut at 1 s', duration: 2.4, delay: 1.1 },
        ],
        caption: 'The timeout sits just past the slow tail',
      },
      quiz: {
        question: 'An API makes 400 calls/s to a dependency with a 500 ms timeout. The dependency hangs completely. How many API threads end up waiting on it?',
        options: ['50', '200', '400', '800'],
        answer: 1,
        explain: 'Threads held = rate × time held = 400 × 0.5 s = 200. Halving the timeout halves the number of threads a hung dependency can take from you.',
      },
    },
    {
      title: 'Retries',
      tag: 'concept',
      heading: 'Most failures are blips, so try again',
      eli5: 'Sometimes the line just crackles and drops. Call the pizza shop again and it works. A **retry** is that second call.',
      body: [
        'Many failures last a moment: a dropped packet, one payment instance restarting during a deploy, a connection reset. Say 1% of calls fail this way. The same request sent again a moment later will very likely succeed.',
        'A **retry** resends the request after a failure. If failures are independent, one retry turns a 1% failure rate into 0.01%. Two retries make it one in a million. That is a large gain for very little code.',
        'Retry only errors that might go away: timeouts, connection errors, `503`, `429`. A `400 Bad Request` or `404` will fail the same way every time, so retrying it only adds load.',
      ],
      keyIdea: 'Retries hide short, random failures. They work when the failure is unrelated to load.',
      metrics: { threads: '5 / 200', load: '101/s', ok: '99.99%', wait: '1 s' },
      scene: {
        nodes: [shoppers, { ...api, status: 'active' }, { ...pay, status: 'ok', badge: '1% blips' }, ledger],
        links: chain,
        flows: [
          { path: ['api', 'pay'], tone: 'request', label: 'attempt 1', duration: 0.9 },
          { path: ['pay', 'api'], tone: 'error', label: 'connection reset', duration: 0.9, delay: 1 },
          { path: ['api', 'pay'], tone: 'request', label: 'attempt 2', duration: 0.9, delay: 2.1 },
          { path: ['pay', 'api'], tone: 'response', label: '200 OK', duration: 0.9, delay: 3.1 },
          { path: ['api', 'shoppers'], tone: 'response', duration: 0.9, delay: 4.1 },
        ],
        caption: 'The shopper never sees the first failure',
      },
    },
    {
      title: 'Retry storm',
      tag: 'case',
      heading: 'Case: retries keep a recovering service down',
      eli5: 'The pizza shop gets busy and stops answering. Everybody hangs up and redials at once, again and again. Now the phone rings four times as much and the **payment service** can never catch up.',
      body: [
        'A deploy restarts half the payment instances. For one minute capacity drops from 150 to **80 calls per second**, below the 100 arriving. Some calls time out. Every API instance retries each failed call at once, up to 3 more times.',
        'A failed call now costs four attempts. Load climbs toward **400 per second** against a service that could not handle 100. More calls time out, which creates more retries. Timed-out requests are still being worked on inside the service, so real work finishes even more slowly.',
        'The deploy ends and capacity returns to 150. The service stays down anyway, because the retry load is still 400. The blip is over, and the retries alone are keeping the outage alive. It gets worse with depth: three layers that each make 4 attempts can send `4 × 4 × 4 = 64` calls to the bottom layer for one user request.',
      ],
      keyIdea: 'Retries add load exactly when the callee has the least to spare. Unlimited, they turn a one-minute dip into a long outage.',
      metrics: { threads: '200 / 200', load: '400/s', ok: '10%', wait: '4 s' },
      scene: {
        nodes: [apiA, { ...apiB, status: 'hot' }, apiC, { ...pay, status: 'hot', sub: 'capacity 150/s', badge: '400/s arriving' }],
        links: fanLinks,
        flows: [
          { path: ['apiA', 'pay'], tone: 'request', count: 4, duration: 0.9 },
          { path: ['api', 'pay'], tone: 'request', count: 4, duration: 0.9 },
          { path: ['apiC', 'pay'], tone: 'request', count: 4, duration: 0.9 },
          { path: ['pay', 'apiA'], tone: 'error', duration: 0.8, delay: 1 },
          { path: ['pay', 'api'], tone: 'error', label: 'timeout', duration: 0.8, delay: 1 },
          { path: ['pay', 'apiC'], tone: 'error', duration: 0.8, delay: 1 },
          { path: ['apiA', 'pay'], tone: 'request', count: 4, duration: 0.9, delay: 1.9 },
          { path: ['api', 'pay'], tone: 'request', label: 'retry now', count: 4, duration: 0.9, delay: 1.9 },
          { path: ['apiC', 'pay'], tone: 'request', count: 4, duration: 0.9, delay: 1.9 },
        ],
        caption: 'Everyone retries at once, at full speed',
      },
    },
    {
      title: 'Backoff',
      tag: 'concept',
      heading: 'Exponential backoff: wait longer each time',
      eli5: 'Do not redial right away. Wait a little, then twice as long, then twice as long again. That is **backoff**, and it gives the pizza shop room to breathe.',
      body: [
        '**Exponential backoff** doubles the wait before each retry: 100 ms, then 200 ms, then 400 ms, up to a cap such as 2 seconds. A client that keeps failing slows itself down, so the total retry rate drops the longer the trouble lasts.',
        'Backoff alone has a flaw. Every caller that failed at the same moment waits the same 100 ms and comes back at the same moment. Then they all wait 200 ms and return together again.',
        'The payment service sees quiet gaps followed by spikes. Each spike is big enough to knock it over again, so the callers stay in step and the waves continue.',
      ],
      keyIdea: 'Backoff lowers the average retry rate. It does nothing about everyone retrying on the same tick.',
      metrics: { threads: '160 / 200', load: 'spikes to 300/s', ok: '40%', wait: '2.7 s' },
      scene: {
        nodes: [apiA, { ...apiB, status: 'active' }, apiC, { ...pay, status: 'hot', sub: 'capacity 150/s', badge: 'waves' }],
        links: fanLinks,
        flows: [
          { path: ['apiA', 'pay'], tone: 'request', count: 3, duration: 0.8 },
          { path: ['api', 'pay'], tone: 'request', label: 'after 100 ms', count: 3, duration: 0.8 },
          { path: ['apiC', 'pay'], tone: 'request', count: 3, duration: 0.8 },
          { path: ['apiA', 'pay'], tone: 'request', count: 3, duration: 0.8, delay: 1.6 },
          { path: ['api', 'pay'], tone: 'request', label: 'after 200 ms', count: 3, duration: 0.8, delay: 1.6 },
          { path: ['apiC', 'pay'], tone: 'request', count: 3, duration: 0.8, delay: 1.6 },
          { path: ['apiA', 'pay'], tone: 'request', count: 3, duration: 0.8, delay: 4 },
          { path: ['api', 'pay'], tone: 'request', label: 'after 400 ms', count: 3, duration: 0.8, delay: 4 },
          { path: ['apiC', 'pay'], tone: 'request', count: 3, duration: 0.8, delay: 4 },
        ],
        caption: 'Longer gaps, but the callers still arrive together',
      },
    },
    {
      title: 'Jitter',
      tag: 'concept',
      heading: 'Jitter spreads the herd out',
      eli5: 'Each caller rolls a dice to decide how long to wait before redialing. Now the calls trickle in one by one and the pizza shop can answer them. The dice roll is **jitter**.',
      body: [
        '**Jitter** adds randomness to the wait. With **full jitter**, each client sleeps a random time between 0 and the backoff ceiling: somewhere in 0 to 100 ms, then 0 to 200 ms, then 0 to 400 ms.',
        'The callers no longer line up. The same number of retries arrives, spread evenly across the window, and the peak the service sees falls close to the average. A service that can handle the average can now drain its queue and recover.',
        'Use jitter anywhere many clients act on the same schedule: retries, cache TTLs, cron jobs, reconnects after a load balancer restart.',
      ],
      keyIdea: 'Backoff decides how long to wait. Jitter makes sure everyone waits a different amount.',
      metrics: { threads: '60 / 200', load: '140/s, smooth', ok: '95%', wait: '2.7 s' },
      scene: {
        nodes: [apiA, { ...apiB, status: 'active' }, apiC, { ...pay, status: 'ok', sub: 'capacity 150/s', badge: 'steady trickle' }],
        links: fanLinks,
        flows: [
          { path: ['apiA', 'pay'], tone: 'request', duration: 0.9, delay: 0.3 },
          { path: ['api', 'pay'], tone: 'request', label: 'random 0..400 ms', duration: 0.9, delay: 1.4 },
          { path: ['apiC', 'pay'], tone: 'request', duration: 0.9, delay: 0.8 },
          { path: ['apiA', 'pay'], tone: 'request', duration: 0.9, delay: 2.5 },
          { path: ['api', 'pay'], tone: 'request', duration: 0.9, delay: 3.6 },
          { path: ['apiC', 'pay'], tone: 'request', duration: 0.9, delay: 3 },
          { path: ['pay', 'api'], tone: 'response', label: '200 OK', duration: 0.9, delay: 2.4 },
        ],
        caption: 'Same retries, no spikes',
      },
      code: {
        language: 'python',
        title: 'Exponential backoff with full jitter',
        source: `import random, time

BASE, CAP, MAX_ATTEMPTS = 0.1, 2.0, 4     # seconds

def call_with_retry(fn):
    for attempt in range(MAX_ATTEMPTS):
        try:
            return fn()
        except Retryable:                  # timeouts, resets, 503, 429
            if attempt == MAX_ATTEMPTS - 1:
                raise                      # out of attempts: give up
            ceiling = min(CAP, BASE * 2 ** attempt)    # 0.1, 0.2, 0.4 s
            time.sleep(random.uniform(0, ceiling))     # full jitter`,
        highlight: [9, 12, 13],
      },
    },
    {
      title: 'Retry budget',
      tag: 'concept',
      heading: 'A retry budget caps the damage',
      eli5: 'The whole street agrees: for every ten normal calls to the pizza shop, only one redial is allowed. That limit is a **retry budget**, so the shop is never buried in callbacks.',
      body: [
        'Backoff and jitter shape retries. They do not limit them. If the payment service is down for real, every request still makes 4 attempts, and that is still far too much load.',
        'A **retry budget** caps retries as a share of normal traffic, for example 10%. The client counts requests and retries over a rolling window. While retries are under 10% of requests, a failed call may retry. Once the budget is spent, failures are returned straight away.',
        'In normal times, with 1% of calls failing, every retry is allowed. During an outage the load on payments tops out at **110 per second** in place of 400. Also retry at one layer only, usually the one closest to the failure, so the layers do not multiply each other.',
      ],
      keyIdea: 'Per-request retry limits still multiply load. A budget ties total retries to total traffic.',
      metrics: { threads: '100 / 200', load: '110/s max', ok: 'recovers', wait: '2.7 s' },
      scene: {
        nodes: [apiA, { ...apiB, status: 'active' }, apiC, { ...pay, status: 'ok', sub: 'capacity 150/s', badge: '100/s + 10% retries' }],
        links: fanLinks,
        flows: [
          { path: ['apiA', 'pay'], tone: 'request', count: 2, duration: 1 },
          { path: ['api', 'pay'], tone: 'request', count: 2, duration: 1, delay: 0.4 },
          { path: ['apiC', 'pay'], tone: 'request', count: 2, duration: 1, delay: 0.8 },
          { path: ['pay', 'api'], tone: 'error', label: 'timeout', duration: 0.9, delay: 1.6 },
          { path: ['api', 'pay'], tone: 'request', label: 'retry (budget left)', duration: 1, delay: 2.7 },
          { path: ['pay', 'apiC'], tone: 'error', label: 'budget spent: fail', duration: 0.9, delay: 2.2 },
        ],
        caption: 'Retries stay a small, fixed slice of traffic',
      },
    },
    {
      title: 'Idempotency',
      tag: 'case',
      heading: 'Case: the retry that charged the card twice',
      eli5: 'The line dropped right after you ordered. Did they hear you? If you call and order again you might get two pizzas. So you say "this is order 42", and the **payment service** knows it is the same one.',
      body: [
        'A charge request times out after 1 second. The API cannot tell which of two things happened: the request never arrived, or the payment service charged the card and the response was lost on the way back. A timeout does not mean the work did not happen.',
        'If the API retries a plain `POST /charge`, the shopper may pay twice. A call is **idempotent** when doing it twice has the same effect as doing it once. Reads, `PUT` of a full value and `DELETE` are. "Charge $40" and "add 1 to stock" are not.',
        'To make a write safe to retry, the client creates an **idempotency key** once per order and sends it on every attempt. The server stores the key with the result. A second request with the same key returns the stored result and does no work.',
      ],
      keyIdea: 'Retry only calls that are safe to repeat. For writes, send an idempotency key so the server can spot the duplicate.',
      metrics: { threads: '5 / 200', load: '101/s', ok: '99.99%', wait: '2.7 s' },
      scene: {
        nodes: [shoppers, { ...api, status: 'active' }, { ...pay, status: 'ok', badge: 'key seen: replay' }, { ...ledger, status: 'ok', badge: 'charged once' }],
        links: chain,
        flows: [
          { path: ['api', 'pay', 'ledger'], tone: 'request', label: 'charge, key=ord-42', duration: 1.4 },
          { path: ['pay', 'api'], tone: 'error', label: 'response lost', duration: 0.9, delay: 1.5 },
          { path: ['api', 'pay'], tone: 'request', label: 'retry, key=ord-42', duration: 0.9, delay: 2.6 },
          { path: ['pay', 'api'], tone: 'response', label: 'stored result', duration: 0.9, delay: 3.6 },
        ],
        caption: 'Same key, same answer, one charge',
      },
      code: {
        language: 'python',
        title: 'An idempotency key makes a charge safe to retry',
        source: `# checkout API: one key per order, reused on every attempt
def pay_for(order):
    headers = {"Idempotency-Key": f"order-{order.id}"}
    return call_with_retry(lambda: session.post(
        "http://payments.internal/charge",
        json=order.charge, headers=headers, timeout=(0.2, 1.0)))

# payment service: idem_key has a UNIQUE index
def charge(req):
    key = req.headers["Idempotency-Key"]
    try:
        db.execute("INSERT INTO charges (idem_key, status) VALUES (%s, 'pending')", key)
    except UniqueViolation:
        return db.query_one("SELECT status, receipt FROM charges WHERE idem_key = %s", key)
    receipt = card_network.charge(req.json)        # runs once per key
    db.execute("UPDATE charges SET status = 'done', receipt = %s WHERE idem_key = %s", receipt, key)
    return receipt`,
        highlight: [3, 12, 13, 14],
      },
    },
    {
      title: 'Deadlines',
      tag: 'concept',
      heading: 'Pass one deadline down the whole chain',
      eli5: 'You tell the pizza shop "I need it by seven". If the cook sees it is already past seven, he stops making it. The **deadline** travels with the order to everyone who touches it.',
      body: [
        'The shopper\'s browser gives up after 2 seconds. The API calls payments with a 1 second timeout, and payments calls the fraud check with its own 1 second timeout and 3 attempts. The fraud check can still be working 3 seconds after the shopper left. Nobody will read the answer.',
        'A **deadline** is an absolute time by which the whole request must finish. The first service sets it and passes it along, usually in a header. Each hop subtracts the time already spent and uses what is left as its timeout. If 1.4 seconds are gone, the next call gets 600 ms.',
        'Each service also checks the deadline before starting expensive work, and drops requests that have already expired. gRPC carries a deadline with each call. With plain HTTP you send a header and enforce it yourself.',
      ],
      keyIdea: 'Separate timeouts per hop waste work on requests nobody is waiting for. One shared deadline lets every hop stop on time.',
      metrics: { threads: '5 / 200', load: '101/s', ok: '99.99%', wait: '2 s total' },
      scene: {
        nodes: [
          { ...shoppers, badge: 'waits 2 s' },
          { ...api, status: 'active', badge: '1.9 s left' },
          { ...pay, status: 'active', badge: '1.5 s left' },
          { ...fraud, status: 'active', badge: '0.6 s left' },
          { ...ledgerFar, status: 'dim' },
        ],
        links: [
          { from: 'shoppers', to: 'api' },
          { from: 'api', to: 'pay' },
          { from: 'pay', to: 'fraud' },
          { from: 'fraud', to: 'ledger', style: 'faint' },
        ],
        flows: [
          { path: ['shoppers', 'api', 'pay', 'fraud'], tone: 'request', label: 'deadline 12:00:02.000', duration: 2.4 },
          { path: ['fraud', 'pay', 'api', 'shoppers'], tone: 'response', label: 'done in time', duration: 2.4, delay: 2.6 },
        ],
        caption: 'The remaining time shrinks at every hop',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Give up on time, retry politely',
      eli5: 'Hang up if nobody answers. Wait a random while before you redial, do not redial too often, say your order number, and say when you need the pizza by.',
      body: [
        'Put a **timeout** on every network call, set a little above the callee\'s tail latency, and check that `rate × timeout` fits in your thread pool. **Retries** hide short random failures, but they add load when the callee is already struggling.',
        'Space retries with **exponential backoff**, spread them with **jitter**, and cap them with a **retry budget** at one layer. Retry only **idempotent** calls, and use an idempotency key for writes. Pass a **deadline** down the chain so no service works for a caller who has left.',
      ],
      keyIdea: 'A good client fails fast, retries a little and at random times, and never repeats a write the server cannot recognize.',
      metrics: { threads: '5 / 200', load: '101/s', ok: '99.99%', wait: '2 s total' },
      scene: {
        nodes: [shoppers, { ...api, status: 'ok' }, { ...pay, status: 'ok' }, { ...ledger, status: 'ok' }, { ...catalog, status: 'ok' }],
        links: [...chain, { from: 'api', to: 'catalog' }],
        flows: [
          { path: ['shoppers', 'api', 'pay', 'ledger'], tone: 'request', count: 2, duration: 2 },
          { path: ['ledger', 'pay', 'api', 'shoppers'], tone: 'response', count: 2, duration: 2, delay: 2.1 },
          { path: ['api', 'catalog', 'api'], tone: 'response', duration: 1.8, delay: 0.6 },
        ],
      },
      quiz: {
        question: 'A dependency slows down. Clients retry 3 times with exponential backoff, no jitter and no budget, and the dependency never recovers. What is the main reason?',
        options: [
          'The timeouts are too long',
          'Backoff without jitter keeps clients in step, and with no budget each request still makes up to 4 attempts',
          'Exponential backoff waits too long between attempts',
          'The calls are not idempotent',
        ],
        answer: 1,
        explain: 'Backoff alone leaves the callers synchronized, so retries arrive in spikes, and without a budget the total load is still up to 4 times normal. Jitter removes the spikes and a budget caps the total.',
      },
    },
  ],
};
