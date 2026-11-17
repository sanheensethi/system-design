import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const shoppers: SceneNode = { id: 'shoppers', kind: 'client', at: at(-5, 0), label: 'shoppers', sub: '100 checkouts/s' };
const api: SceneNode = { id: 'api', kind: 'block', at: at(-1.7, 0), label: 'checkout API', sub: '200 threads', icon: 'Server', tint: 'blue' };
const pay: SceneNode = { id: 'pay', kind: 'block', at: at(1.7, 0), label: 'payment service', sub: 'normally 50 ms', icon: 'Receipt', tint: 'amber' };
const ledger: SceneNode = { id: 'ledger', kind: 'db', at: at(5, 0), label: 'card ledger' };
const catalog: SceneNode = { id: 'catalog', kind: 'block', at: at(-1.7, 6.3), label: 'catalog service', sub: 'product pages', icon: 'ShoppingBag', tint: 'green' };

// Three API instances, used when the story is about many callers acting in step.
const apiA: SceneNode = { id: 'apiA', kind: 'block', at: at(-3.4, -2.5), label: 'API 1', icon: 'Server', tint: 'blue' };
const apiB: SceneNode = { id: 'apiB', kind: 'block', at: at(0, -2.5), label: 'API 2', icon: 'Server', tint: 'blue' };
const apiC: SceneNode = { id: 'apiC', kind: 'block', at: at(3.4, -2.5), label: 'API 3', icon: 'Server', tint: 'blue' };
const payLow: SceneNode = { ...pay, at: at(0, 5.4) };
const fan = (extra: Partial<SceneLink> = {}) => [link('apiA', 'pay', extra), link('apiB', 'pay', extra), link('apiC', 'pay', extra)];

const chain = [link('shoppers', 'api'), link('api', 'pay'), link('pay', 'ledger')];

export const timeoutsRetries: Lesson = {
  id: 'timeouts-retries',
  title: 'Timeouts, retries, backoff and jitter (part 1)',
  tagline: 'Stop waiting forever, pick a timeout you can defend, and retry without turning a blip into an outage.',
  minutes: 15,
  level: 'Intermediate',
  learn: [
    'Why one call without a timeout can freeze a whole server',
    'Connect, read and total timeouts, and why many clients default to waiting forever',
    'How to pick a timeout from the callee\'s latency and your thread pool',
    'How retries hide blips, and which errors are worth retrying',
    'How retries multiply load and turn a blip into a storm',
    'Exponential backoff, jitter and its variants',
  ],
  metrics: [
    { key: 'threads', label: 'API threads busy', icon: 'Cpu' },
    { key: 'load', label: 'Load on payments', icon: 'Activity' },
    { key: 'ok', label: 'Checkouts OK', icon: 'TrendingUp' },
    { key: 'wait', label: 'Worst wait', icon: 'Timer' },
  ],
  steps: [
    {
      title: 'Stuck threads',
      tag: 'problem',
      heading: 'One slow dependency freezes the whole API',
      eli5: 'You phone the pizza shop and nobody picks up, but you never hang up. Now your phone is busy and nobody else can reach you. The **checkout API** is you, holding the line forever.',
      body: [
        'The checkout API takes **100 checkouts per second**. Each one calls the payment service, which normally answers in 50 ms. The API has 200 worker threads, so about 5 are busy at a time.',
        'Then a bad lock in the card ledger makes each payment call take **30 seconds**. It does not fail. It stops answering, and the HTTP client has no timeout.',
      ],
      keyIdea: 'A slow dependency is worse than a dead one. A dead one fails fast. A slow one holds your threads.',
      metrics: { threads: '5 / 200', load: '100/s', ok: '100%', wait: '50 ms' },
      metricTones: { threads: 'good', ok: 'good' },
      scene: {
        nodes: [
          shoppers,
          { ...api, status: 'active', chips: ['POST /checkout'] },
          { ...pay, status: 'hot', badge: 'ledger lock', chips: [{ text: 'POST /charge', tone: 'warn' }] },
          { ...ledger, status: 'hot' },
        ],
        links: [link('shoppers', 'api'), link('api', 'pay'), link('pay', 'ledger', { label: 'lock held', labelTone: 'warn' })],
        flows: [
          { path: ['shoppers', 'api'], tone: 'request', count: 3, duration: 1 },
          { path: ['api', 'pay'], tone: 'request', label: 'POST /charge', count: 3, duration: 1.2, delay: 1 },
          { path: ['pay', 'ledger'], tone: 'request', duration: 1.2, delay: 2.3 },
        ],
        panel: {
          title: 'Payment call latency',
          icon: 'Timer',
          rows: [
            { text: 'Normal day', value: '50 ms', tone: 'good' },
            { text: 'With the bad lock', value: '30 s', tone: 'bad' },
            { text: 'Client timeout', value: 'none', tone: 'bad' },
          ],
          footer: { text: 'The call never fails, it just never ends', tone: 'warn' },
        },
        caption: 'The lock makes every payment call hang',
      },
    },
    {
      title: 'Slow beats dead',
      tag: 'case',
      heading: 'Case: the whole site hangs, not just checkout',
      eli5: 'Every time you hold the phone, one less phone line in the house is free. When all the lines are held, even the family calling the **catalog service** about the menu cannot get through.',
      body: [
        '100 new calls get stuck every second. After one second 100 threads are gone, after two all **200** are. The API has nothing left to run any request.',
        'Product pages need only the healthy catalog service, yet they hang too, because no free thread is left to serve them. One bad dependency has taken the whole API down.',
      ],
      keyIdea: 'Threads are a shared pool. A stuck call in one feature takes capacity from every other feature.',
      metrics: { threads: '200 / 200', load: '100/s', ok: '0%', wait: '30 s' },
      metricTones: { threads: 'bad', ok: 'bad', wait: 'bad' },
      scene: {
        nodes: [
          { ...api, status: 'hot', load: 100, badge: '200 / 200 stuck' },
          { ...pay, status: 'hot', badge: '30 s per call' },
          { ...catalog, at: at(-5.2, 6), status: 'dim', chips: [{ text: 'GET /products', tone: 'warn' }], badge: 'healthy, unreachable' },
        ],
        links: [link('api', 'pay', { label: '100 new calls/s', labelTone: 'warn' }), link('api', 'catalog', { style: 'faint' })],
        flows: [
          { path: ['api', 'pay'], tone: 'request', label: 'POST /charge', count: 5, duration: 1.2 },
          { path: ['pay', 'api'], tone: 'error', label: 'still waiting', duration: 4, delay: 1.3 },
        ],
        panel: {
          title: 'Threads stuck over time',
          icon: 'Cpu',
          rows: [
            { text: 'After 0 s', value: '5 busy', tone: 'good' },
            { text: 'After 1 s', value: '100 stuck', tone: 'warn' },
            { text: 'After 2 s', value: '200 stuck', tone: 'bad' },
            { text: 'GET /products', value: 'no thread', tone: 'bad' },
          ],
        },
        caption: 'Every thread is waiting on the same slow call',
      },
    },
    {
      title: 'Timeouts',
      tag: 'concept',
      heading: 'A timeout turns a hang into a fast failure',
      eli5: 'New rule: if the pizza shop does not pick up after ten rings, hang up. That is a **timeout**. You did not get pizza, but your phone is free again.',
      body: [
        'A **timeout** is the longest you are willing to wait for an answer. When it passes, the client drops the call and raises an error. The thread returns to the pool and can do other work.',
        'Checkout now fails after 1 second with a `503`. The shopper sees an error, but product pages keep loading.',
      ],
      keyIdea: 'A failure you get in one second is one you can handle. A hang is one you cannot.',
      metrics: { threads: '100 / 200', load: '100/s', ok: '0% (fast errors)', wait: '1 s' },
      metricTones: { threads: 'warn', ok: 'bad', wait: 'warn' },
      scene: {
        nodes: [
          shoppers,
          { ...api, status: 'active', badge: 'gives up at 1 s', load: 50 },
          { ...pay, status: 'hot', badge: '30 s per call' },
          { ...catalog, status: 'ok' },
        ],
        links: [link('shoppers', 'api'), link('api', 'pay', { label: 'cut after 1 s', labelTone: 'warn' }), link('api', 'catalog')],
        flows: [
          { path: ['shoppers', 'api'], tone: 'request', count: 3, duration: 1 },
          { path: ['api', 'pay'], tone: 'request', label: 'POST /charge', duration: 1, delay: 1 },
          { path: ['api', 'shoppers'], tone: 'error', label: '503 after 1 s', duration: 1, delay: 2.6 },
          { path: ['api', 'catalog', 'api'], tone: 'response', label: 'pages still load', duration: 1.8, delay: 1 },
        ],
        panel: {
          title: 'Same outage, with a timeout',
          icon: 'Timer',
          rows: [
            { text: 'Thread held per call', value: '1 s', tone: 'good' },
            { text: 'Checkout', value: '503, fast', tone: 'warn' },
            { text: 'Product pages', value: 'working', tone: 'good' },
          ],
        },
        caption: 'Checkout fails fast, the rest of the site keeps working',
      },
    },
    {
      title: 'Two timeouts',
      tag: 'concept',
      heading: 'Connect timeout and read timeout',
      eli5: 'Two different waits on the phone. First you wait for the shop to pick up. Then you wait for the answer to your order. Each wait gets its own limit.',
      body: [
        'The **connect timeout** covers opening the connection. Keep it short, because a healthy server on the same network accepts in a few milliseconds.',
        'The **read timeout** covers waiting for the response and depends on how long the work takes. Set both on every call.',
      ],
      keyIdea: 'Connect fast or give up. Give slow work a read timeout that matches what it normally takes.',
      metrics: { threads: '100 / 200', load: '100/s', ok: '0% (fast errors)', wait: '1 s' },
      metricTones: { wait: 'warn' },
      scene: {
        nodes: [{ ...api, status: 'active' }, { ...pay, status: 'hot' }],
        links: [link('api', 'pay', { arrow: 'both', label: 'connect 200 ms, read 1 s' })],
        flows: [
          { path: ['api', 'pay'], tone: 'handshake', label: 'connect', duration: 0.8 },
          { path: ['api', 'pay'], tone: 'request', label: 'POST /charge', duration: 1, delay: 1 },
          { path: ['pay', 'api'], tone: 'error', label: 'read timeout', duration: 1, delay: 2.4 },
        ],
        panel: {
          title: 'Two limits per call',
          icon: 'Clock',
          rows: [
            { text: 'Connect timeout', value: '200 ms', tone: 'good' },
            { text: 'Read timeout', value: '1 s', tone: 'warn' },
          ],
          footer: { text: 'Both set on every call', tone: 'muted' },
        },
        caption: 'One limit to open the line, one to wait for the answer',
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
        highlight: [10, 13, 15],
      },
    },
    {
      title: 'Total cap',
      tag: 'concept',
      heading: 'A read timeout is not a cap on the whole call',
      eli5: 'The shop keeps whispering one word every nine seconds. You never hit your ten-second limit, yet you have been on the phone all afternoon. You also need a limit on the **whole call**.',
      body: [
        'In many clients the read timeout restarts every time a byte arrives. A server that trickles one byte every 900 ms never trips a 1 second read timeout, yet the call can run for minutes.',
        'Add a **total timeout** that covers connect, send and the full response. `requests` has no total timeout parameter, so use Go `http.Client.Timeout` or a context deadline, or `httpx.Timeout` with a wall-clock deadline.',
      ],
      keyIdea: 'Cap the whole call, not only the gaps inside it.',
      metrics: { threads: '100 / 200', load: '100/s', ok: '0% (fast errors)', wait: '1.5 s' },
      metricTones: { wait: 'warn' },
      scene: {
        nodes: [{ ...api, status: 'active', badge: 'total cap 1.5 s' }, { ...pay, status: 'hot', badge: '1 byte per 900 ms' }],
        links: [link('api', 'pay', { label: 'slow trickle', labelTone: 'warn' })],
        flows: [
          { path: ['api', 'pay'], tone: 'request', duration: 1 },
          { path: ['pay', 'api'], tone: 'data', label: 'byte', duration: 1.6, delay: 1 },
          { path: ['pay', 'api'], tone: 'data', label: 'byte', duration: 1.6, delay: 2.6 },
        ],
        panel: {
          title: 'Which timer fires?',
          icon: 'Clock',
          rows: [
            { text: 'Read timeout 1 s', value: 'never fires', tone: 'warn' },
            { text: 'Gap between bytes', value: '900 ms', tone: 'muted' },
            { text: 'Total timeout 1.5 s', value: 'fires', tone: 'good' },
          ],
        },
        caption: 'The trickle slips past the read timeout',
      },
      code: {
        language: 'python',
        title: 'A total deadline with httpx',
        source: `import time, httpx

TOTAL = 1.5                               # whole-call budget, seconds

def charge(order):
    deadline = time.monotonic() + TOTAL
    left = max(0.0, deadline - time.monotonic())
    # httpx.Timeout(total) caps connect, read, write and pool together,
    # but each phase restarts: pass what is left, never a fixed number.
    timeout = httpx.Timeout(left, connect=min(0.2, left))
    return httpx.post("http://payments.internal/charge",
                      json=order, timeout=timeout)`,
        highlight: [4, 5, 9, 10],
      },
    },
    {
      title: 'No default',
      tag: 'concept',
      heading: 'Many clients wait forever unless you say otherwise',
      eli5: 'Some phones come with the rule "never hang up" built in. You have to change the setting yourself, on every phone in the house.',
      body: [
        'Python `requests` has no default timeout. Go\'s `http.Client` has none either, and the Java `HttpURLConnection` default is to wait without limit. Read your client\'s docs and set one.',
        'This covers every network call: HTTP, database queries, cache reads, queue calls. One missing timeout is enough to reproduce the freeze.',
      ],
      keyIdea: 'Assume the default is infinite until you have checked. Set a timeout on every network call.',
      metrics: { threads: '200 / 200', load: '100/s', ok: '0%', wait: 'unbounded' },
      metricTones: { threads: 'bad', ok: 'bad', wait: 'bad' },
      scene: {
        nodes: [
          { ...api, status: 'hot', chips: [{ text: 'requests.post(url)', tone: 'bad' }] },
          { ...pay, status: 'hot' },
          { ...ledger, status: 'hot' },
        ],
        links: [link('api', 'pay', { label: 'no timeout set', labelTone: 'warn' }), link('pay', 'ledger')],
        flows: [
          { path: ['api', 'pay', 'ledger'], tone: 'request', duration: 1.6 },
          { path: ['ledger', 'pay', 'api'], tone: 'error', label: 'never returns', duration: 2.4, delay: 1.8 },
        ],
        panel: {
          title: 'Typical client defaults',
          icon: 'List',
          rows: [
            { text: 'Python requests', value: 'none', tone: 'bad' },
            { text: 'Go http.Client', value: 'none', tone: 'bad' },
            { text: 'Java HttpURLConnection', value: 'none', tone: 'bad' },
            { text: 'Your own setting', value: 'always', tone: 'good' },
          ],
          footer: { text: 'Database and cache clients need one too', tone: 'muted' },
        },
        caption: 'The default is the bug',
      },
    },
    {
      title: 'Picking a number',
      tag: 'tradeoff',
      heading: 'Start from the callee\'s tail latency',
      eli5: 'Count how many rings the pizza shop usually needs, including the slow evenings, and add a few. Hang up after one ring and you never get pizza.',
      body: [
        'Start from the callee\'s real latency. The payment service has a p99 of 300 ms and a p99.9 of 700 ms. A timeout of **1 second** sits just above that, so fewer than 1 in 1,000 healthy calls gets cut off.',
        'Pick from measured percentiles, not from a guess.',
      ],
      keyIdea: 'Set the timeout a little above the callee\'s tail latency.',
      metrics: { threads: '5 / 200', load: '100/s', ok: '99.9%', wait: '1 s' },
      metricTones: { ok: 'good' },
      scene: {
        nodes: [{ ...api, status: 'active' }, { ...pay, badge: 'p99 300 ms' }],
        links: [link('api', 'pay', { arrow: 'both' })],
        flows: [
          { path: ['api', 'pay'], tone: 'request', count: 4, duration: 1 },
          { path: ['pay', 'api'], tone: 'response', label: '50 ms typical', count: 3, duration: 0.8, delay: 1.1 },
          { path: ['pay', 'api'], tone: 'error', label: 'cut at 1 s', duration: 2.4, delay: 1.1 },
        ],
        panel: {
          title: 'Payment latency',
          icon: 'Gauge',
          rows: [
            { text: 'p50', value: '50 ms', tone: 'good' },
            { text: 'p99', value: '300 ms', tone: 'default' },
            { text: 'p99.9', value: '700 ms', tone: 'warn' },
            { text: 'Timeout', value: '1 s', tone: 'good' },
          ],
          footer: { text: 'Fewer than 1 in 1,000 healthy calls is cut', tone: 'good' },
        },
        caption: 'The timeout sits just past the slow tail',
      },
    },
    {
      title: 'Thread budget',
      tag: 'tradeoff',
      heading: 'Check that rate × timeout fits in your thread pool',
      eli5: 'Each held phone line stays busy for as long as you wait. Longer holds need more lines in the house, shorter holds need fewer.',
      body: [
        'Threads held equals `call rate × time held`. At 100 calls per second and a 1 second timeout, a hung dependency ties up 100 threads. With 200 threads the API survives.',
        'Retries change the sum: `threads = rate × (attempts × timeout + sleeps)`. With the 4-attempt loop shown later, each call holds a thread about 4.7 s, so 100/s needs about 470 threads and the pool of 200 runs out.',
      ],
      keyIdea: 'A hung dependency holds rate × (attempts × timeout + sleeps) threads. Size the timeout and the retries so that stays under your pool.',
      metrics: { threads: '100 / 200', load: '100/s', ok: '0% (fast errors)', wait: '1 s' },
      metricTones: { threads: 'warn' },
      scene: {
        nodes: [
          { ...api, status: 'active', load: 50, chips: ['100/s × 1 s = 100'] },
          { ...pay, status: 'hot', badge: 'hung' },
        ],
        links: [link('api', 'pay', { label: '1 s timeout' })],
        flows: [{ path: ['api', 'pay'], tone: 'request', count: 4, duration: 1.2 }],
        panel: {
          title: 'Threads held by a hung dependency',
          icon: 'Cpu',
          rows: [
            { text: '1 s timeout', value: '100 threads', tone: 'good' },
            { text: '2 s timeout', value: '200 threads', tone: 'warn' },
            { text: '5 s timeout', value: '500 threads', tone: 'bad' },
            { text: '4 attempts, 4.7 s held', value: '470 threads', tone: 'bad' },
            { text: 'Pool size', value: '200' },
          ],
          footer: { text: 'At 100 calls per second. See the retry budget and deadline in part 2', tone: 'muted' },
        },
        caption: 'Halve the timeout, halve the threads at risk',
      },
      quiz: {
        question: 'An API makes 400 calls/s to a dependency with a 500 ms timeout. The dependency hangs completely. How many API threads end up waiting on it?',
        options: ['50', '200', '400', '800'],
        answer: 1,
        explain: 'Threads held = rate × time held = 400 × 0.5 s = 200. Halving the timeout halves the number of threads a hung dependency can take from you.',
      },
    },
    {
      title: 'Too short',
      tag: 'tradeoff',
      heading: 'A timeout below normal latency creates its own failures',
      eli5: 'Hang up after one ring and the shop never gets to the phone, even on a good day. Your own rule makes good calls fail.',
      body: [
        'If the p99 is 300 ms and the timeout is 200 ms, more than 1% of healthy calls fail. Each failure usually triggers a retry, which adds load to a service that was fine.',
        'Too long holds threads. Too short breaks good calls. The tail latency is the guide.',
      ],
      keyIdea: 'A timeout under the p99 turns slow tail calls into errors and extra retries.',
      metrics: { threads: '5 / 200', load: '102/s', ok: '99%', wait: '200 ms' },
      metricTones: { ok: 'warn' },
      scene: {
        nodes: [{ ...api, status: 'active', badge: 'timeout 200 ms' }, { ...pay, status: 'ok', badge: 'p99 300 ms' }],
        links: [link('api', 'pay', { arrow: 'both', label: 'healthy network' })],
        flows: [
          { path: ['api', 'pay'], tone: 'request', count: 3, duration: 0.9 },
          { path: ['pay', 'api'], tone: 'response', label: 'fast calls fine', duration: 0.8, delay: 1 },
          { path: ['api', 'pay'], tone: 'error', label: 'cut at 200 ms', duration: 0.9, delay: 2.2 },
        ],
        panel: {
          title: 'Timeout 200 ms against p99 300 ms',
          icon: 'Gauge',
          rows: [
            { text: 'Calls slower than 200 ms', value: 'over 1%', tone: 'bad' },
            { text: 'Server is healthy', value: 'yes', tone: 'good' },
            { text: 'Result', value: 'self-made errors', tone: 'warn' },
          ],
        },
        caption: 'Good calls cut off before they finish',
      },
    },
    {
      title: 'Retries',
      tag: 'concept',
      heading: 'Most failures are blips, so try again',
      eli5: 'Sometimes the line just crackles and drops. Call the pizza shop again and it works. A **retry** is that second call.',
      body: [
        'Many failures last a moment: a dropped packet, one payment instance restarting in a deploy, a connection reset. Say 1% of calls fail this way. The same request sent again a moment later will very likely succeed.',
        'If failures are independent, one retry turns a 1% failure rate into 0.01%. Two retries make it one in a million.',
      ],
      keyIdea: 'Retries hide short, random failures. They work when the failure is unrelated to load.',
      metrics: { threads: '5 / 200', load: '101/s', ok: '99.99%', wait: '1 s' },
      metricTones: { ok: 'good' },
      scene: {
        nodes: [shoppers, { ...api, status: 'active' }, { ...pay, status: 'ok', badge: '1% blips' }],
        links: [link('shoppers', 'api'), link('api', 'pay', { arrow: 'both' })],
        flows: [
          { path: ['api', 'pay'], tone: 'request', label: 'attempt 1', duration: 0.9 },
          { path: ['pay', 'api'], tone: 'error', label: 'connection reset', duration: 0.9, delay: 1 },
          { path: ['api', 'pay'], tone: 'request', label: 'attempt 2', duration: 0.9, delay: 2.1 },
          { path: ['pay', 'api'], tone: 'response', label: '200 OK', duration: 0.9, delay: 3.1 },
          { path: ['api', 'shoppers'], tone: 'response', duration: 0.9, delay: 4.1 },
        ],
        panel: {
          title: 'Failure rate after retries',
          icon: 'Repeat',
          rows: [
            { text: 'No retry', value: '1%', tone: 'warn' },
            { text: 'One retry', value: '0.01%', tone: 'good' },
            { text: 'Two retries', value: '0.0001%', tone: 'good' },
          ],
          footer: { text: 'Only if failures are independent', tone: 'muted' },
        },
        caption: 'The shopper never sees the first failure',
      },
    },
    {
      title: 'What to retry',
      tag: 'concept',
      heading: 'Retry only errors that might go away',
      eli5: 'If the line crackled, call again. If the shop says "we do not sell that", calling again gets the same answer.',
      body: [
        'Retry timeouts, connection errors, `502`, `503`, `504` and `429`. These can clear on their own, but only if the call is safe to repeat (see part 2): a retried timeout on `POST /charge` can charge twice.',
        'A `400 Bad Request` or `404` will fail the same way every time, so retrying only adds load. A `500` caused by a bug does the same.',
      ],
      keyIdea: 'Retry the failures that are about the moment. Never retry the ones that are about the request.',
      metrics: { threads: '5 / 200', load: '101/s', ok: '99.99%', wait: '1 s' },
      metricTones: { ok: 'good' },
      scene: {
        nodes: [{ ...api, status: 'active' }, { ...pay, status: 'ok' }],
        links: [link('api', 'pay', { arrow: 'both' })],
        flows: [
          { path: ['api', 'pay'], tone: 'request', count: 2, duration: 1 },
          { path: ['pay', 'api'], tone: 'error', label: '503 or 429: retry', duration: 1, delay: 1.1 },
          { path: ['pay', 'api'], tone: 'error', label: '400: give up', duration: 1, delay: 2.4 },
        ],
        panel: {
          title: 'Retry or not',
          icon: 'Repeat',
          rows: [
            { text: 'Timeout, connection reset', value: 'retry', tone: 'good' },
            { text: '502, 503, 504', value: 'retry', tone: 'good' },
            { text: '429 Too Many Requests', value: 'retry later', tone: 'warn' },
            { text: '400 Bad Request', value: 'never', tone: 'bad' },
            { text: '404 Not Found', value: 'never', tone: 'bad' },
          ],
          footer: { text: 'Only if the call is safe to repeat, see part 2', tone: 'warn' },
        },
        caption: 'The same request will fail the same way',
      },
    },
    {
      title: 'Retry-After',
      tag: 'concept',
      heading: 'When the server says wait, wait that long',
      eli5: 'The pizza shop picks up and says "we are swamped, call back in ten minutes". Calling back sooner only annoys them. A **retry** should follow the hint from the shop.',
      body: [
        'A `429` or `503` often carries a `Retry-After` header: seconds to wait, or a date. The server knows its own recovery time better than your backoff formula does.',
        'Use the larger of the header and your computed backoff, but only sleep if the wait fits the time the caller has left. A 30 s header on a checkout with a 1 s budget means fail now or queue the work.',
      ],
      keyIdea: 'A Retry-After header beats a guess. Honor it, and keep your own backoff as the floor.',
      metrics: { threads: '5 / 200', load: '101/s', ok: '99.99%', wait: '1 s' },
      metricTones: { ok: 'good' },
      scene: {
        nodes: [{ ...api, status: 'active' }, { ...pay, status: 'hot', badge: 'swamped' }],
        links: [link('api', 'pay', { arrow: 'both', label: 'Retry-After: 30', labelTone: 'warn' })],
        flows: [
          { path: ['api', 'pay'], tone: 'request', label: 'POST /charge', duration: 1 },
          { path: ['pay', 'api'], tone: 'error', label: '429 + Retry-After', duration: 1, delay: 1.1 },
          { path: ['api', 'pay'], tone: 'request', label: 'retry after 30 s', duration: 1, delay: 3 },
        ],
        panel: {
          title: 'Which wait wins',
          icon: 'Timer',
          rows: [
            { text: 'Your backoff says', value: '200 ms' },
            { text: 'Server header says', value: '30 s', tone: 'warn' },
            { text: 'Background job', value: 'wait 30 s', tone: 'good' },
            { text: 'Sync checkout, 1 s left', value: 'fail now', tone: 'warn' },
          ],
          footer: { text: 'Wait = max(header, backoff), only if it fits the deadline', tone: 'muted' },
        },
        caption: 'The server names the time, the client obeys',
      },
    },
    {
      title: 'Retry storm',
      tag: 'case',
      heading: 'Case: retries keep a recovering service down',
      eli5: 'The pizza shop gets busy and stops answering. Everybody hangs up and redials at once, again and again. Now the phone rings four times as much and the **payment service** can never catch up.',
      body: [
        'A deploy restarts half the payment instances. Capacity drops from 150 to **80 calls per second**, below the 100 arriving. Some calls time out, and every API instance retries each one at once, up to 3 more times.',
        'A failed call now costs four attempts. Load climbs toward **400 per second**, more calls time out, and more retries follow.',
      ],
      keyIdea: 'Retries add load exactly when the callee has the least to spare.',
      metrics: { threads: '200 / 200', load: '400/s', ok: '10%', wait: '4 s' },
      metricTones: { threads: 'bad', load: 'bad', ok: 'bad', wait: 'bad' },
      scene: {
        nodes: [apiA, apiB, apiC, { ...payLow, status: 'hot', load: 100, badge: '400/s arriving', sub: 'capacity 80/s' }],
        links: [link('apiA', 'pay'), link('apiB', 'pay', { label: 'retry now', labelTone: 'warn' }), link('apiC', 'pay')],
        flows: [
          { path: ['apiA', 'pay'], tone: 'request', count: 4, duration: 0.9 },
          { path: ['apiB', 'pay'], tone: 'request', count: 4, duration: 0.9 },
          { path: ['apiC', 'pay'], tone: 'request', count: 4, duration: 0.9 },
          { path: ['pay', 'apiB'], tone: 'error', label: 'timeout', duration: 0.8, delay: 1 },
          { path: ['apiA', 'pay'], tone: 'request', count: 4, duration: 0.9, delay: 1.9 },
          { path: ['apiB', 'pay'], tone: 'request', count: 4, duration: 0.9, delay: 1.9 },
          { path: ['apiC', 'pay'], tone: 'request', count: 4, duration: 0.9, delay: 1.9 },
        ],
        panel: {
          title: 'Why the outage outlives the deploy',
          icon: 'Activity',
          rows: [
            { text: 'Capacity during deploy', value: '80/s', tone: 'warn' },
            { text: 'Arriving, 1 + 3 retries', value: 'up to 400/s', tone: 'bad' },
            { text: 'Capacity after deploy', value: '150/s', tone: 'good' },
            { text: 'Still arriving', value: '400/s', tone: 'bad' },
          ],
          footer: { text: 'The retries alone keep it down', tone: 'bad' },
        },
        caption: 'Everyone retries at once, at full speed',
      },
    },
    {
      title: 'Layers multiply',
      tag: 'case',
      heading: 'Case: retries at every layer multiply',
      eli5: 'The family redials the shop four times. Each time, the cook also asks the dough maker four times, who asks the farmer four times. One order becomes sixty-four phone calls.',
      body: [
        'Each layer retries on its own. The API makes 4 attempts at payments, payments makes 4 at the fraud check, and the fraud check makes 4 at the ledger.',
        'When the bottom layer is slow, `4 × 4 × 4 = 64` calls hit the ledger for one user request. The deeper the chain, the worse the blow-up.',
      ],
      keyIdea: 'Attempts multiply down the stack. Retry at one layer, not at all of them.',
      metrics: { threads: '200 / 200', load: '6,400/s', ok: '5%', wait: '8 s' },
      metricTones: { threads: 'bad', load: 'bad', ok: 'bad', wait: 'bad' },
      scene: {
        nodes: [
          { ...api, chips: ['× 4 attempts'] },
          { ...pay, chips: ['× 4 attempts'] },
          { id: 'fraud', kind: 'block', at: at(5, 0), label: 'fraud check', sub: '× 4 attempts', icon: 'Shield', tint: 'violet' },
          { id: 'ledger', kind: 'db', at: at(8.4, 0), label: 'card ledger', status: 'hot', badge: '64 calls' },
        ],
        links: [
          link('api', 'pay', { label: '× 4', labelTone: 'warn' }),
          link('pay', 'fraud', { label: '× 4', labelTone: 'warn' }),
          link('fraud', 'ledger', { label: '× 4', labelTone: 'warn' }),
        ],
        flows: [
          { path: ['api', 'pay'], tone: 'request', count: 2, duration: 0.8 },
          { path: ['pay', 'fraud'], tone: 'request', count: 3, duration: 0.8, delay: 0.9 },
          { path: ['fraud', 'ledger'], tone: 'request', count: 5, duration: 0.8, delay: 1.8 },
        ],
        panel: {
          title: 'Calls reaching each layer',
          icon: 'Layers',
          rows: [
            { text: 'User request', value: '1' },
            { text: 'Payments sees', value: '4', tone: 'warn' },
            { text: 'Fraud check sees', value: '16', tone: 'warn' },
            { text: 'Ledger sees', value: '64', tone: 'bad' },
          ],
        },
        caption: 'One request becomes 64 at the bottom',
      },
    },
    {
      title: 'Backoff',
      tag: 'concept',
      heading: 'Exponential backoff: wait longer each time',
      eli5: 'Do not redial right away. Wait a little, then twice as long, then twice as long again. That is **backoff**, and it gives the pizza shop room to breathe.',
      body: [
        '**Exponential backoff** doubles the wait before each retry: 100 ms, then 200 ms, then 400 ms, up to a cap such as 2 seconds.',
        'A client that keeps failing slows itself down, so the total retry rate drops the longer the trouble lasts.',
      ],
      keyIdea: 'Backoff lowers the average retry rate by making each client slow down as it keeps failing.',
      metrics: { threads: '160 / 200', load: '250/s', ok: '40%', wait: '4.7 s' },
      metricTones: { threads: 'warn', load: 'warn', ok: 'warn' },
      scene: {
        nodes: [apiA, { ...apiB, status: 'active' }, apiC, { ...payLow, status: 'hot', sub: 'capacity 150/s' }],
        links: fan(),
        flows: [
          { path: ['apiB', 'pay'], tone: 'request', label: 'attempt 1', duration: 0.8 },
          { path: ['apiB', 'pay'], tone: 'request', label: 'after 100 ms', duration: 0.8, delay: 1.6 },
          { path: ['apiB', 'pay'], tone: 'request', label: 'after 200 ms', duration: 0.8, delay: 3.4 },
        ],
        panel: {
          title: 'Wait before each retry',
          icon: 'Timer',
          rows: [
            { text: 'Retry 1', value: '100 ms' },
            { text: 'Retry 2', value: '200 ms' },
            { text: 'Retry 3', value: '400 ms' },
            { text: 'Cap', value: '2 s', tone: 'muted' },
          ],
          footer: { text: 'Wait = min(cap, base × 2^attempt)', tone: 'muted' },
        },
        caption: 'Each retry waits twice as long as the last',
      },
    },
    {
      title: 'Waves',
      tag: 'tradeoff',
      heading: 'Backoff alone keeps callers in step',
      eli5: 'Everyone waits exactly ten seconds, then everyone redials at the same instant. The phone goes quiet, then rings off the hook, over and over.',
      body: [
        'Every caller that failed at the same moment waits the same 100 ms and returns together. Then they all wait 200 ms and return together again. Times here count sleeps only and ignore call duration.',
        'The payment service sees quiet gaps followed by spikes. Each spike can knock it over again, so the waves continue.',
      ],
      keyIdea: 'Backoff spaces retries out in time. It does nothing about everyone retrying on the same tick.',
      metrics: { threads: '160 / 200', load: 'spikes to 300/s', ok: '40%', wait: '4.7 s' },
      metricTones: { threads: 'warn', load: 'bad', ok: 'warn' },
      scene: {
        nodes: [apiA, apiB, apiC, { ...payLow, status: 'hot', load: 100, sub: 'capacity 150/s', badge: 'waves' }],
        links: fan(),
        flows: [
          { path: ['apiA', 'pay'], tone: 'request', count: 3, duration: 0.8 },
          { path: ['apiB', 'pay'], tone: 'request', label: 'after 100 ms', count: 3, duration: 0.8 },
          { path: ['apiC', 'pay'], tone: 'request', count: 3, duration: 0.8 },
          { path: ['apiA', 'pay'], tone: 'request', count: 3, duration: 0.8, delay: 2.4 },
          { path: ['apiB', 'pay'], tone: 'request', label: 'after 200 ms', count: 3, duration: 0.8, delay: 2.4 },
          { path: ['apiC', 'pay'], tone: 'request', count: 3, duration: 0.8, delay: 2.4 },
        ],
        panel: {
          title: 'What payments sees',
          icon: 'Activity',
          rows: [
            { text: 'At 0.1 s', value: '300/s spike', tone: 'bad' },
            { text: '0.1 to 0.3 s', value: 'quiet', tone: 'muted' },
            { text: 'At 0.3 s', value: '300/s spike', tone: 'bad' },
            { text: '0.3 to 0.7 s', value: 'quiet', tone: 'muted' },
            { text: 'At 0.7 s', value: '300/s spike', tone: 'bad' },
            { text: 'Capacity', value: '150/s', tone: 'good' },
          ],
          footer: { text: 'Average is fine, the peaks are not', tone: 'warn' },
        },
        caption: 'Longer gaps, but the callers still arrive together',
      },
    },
    {
      title: 'Jitter',
      tag: 'concept',
      heading: 'Jitter spreads the herd out',
      eli5: 'Each caller rolls a dice to decide how long to wait before redialing. Now the calls trickle in one by one and the pizza shop can answer them. The dice roll is **jitter**.',
      body: [
        '**Jitter** adds randomness to the wait. With **full jitter**, each client sleeps a random time between 0 and the backoff ceiling: 0 to 100 ms, then 0 to 200 ms, then 0 to 400 ms.',
        'The same number of retries arrives, spread across the window. The peak falls close to the average, and the service can drain its queue and recover.',
      ],
      keyIdea: 'Backoff decides how long to wait. Jitter makes sure everyone waits a different amount.',
      metrics: { threads: '60 / 200', load: '140/s, smooth', ok: '95%', wait: '4.7 s' },
      metricTones: { threads: 'good', load: 'good', ok: 'good' },
      scene: {
        nodes: [apiA, apiB, apiC, { ...payLow, status: 'ok', sub: 'capacity 150/s', badge: 'steady trickle' }],
        links: fan(),
        flows: [
          { path: ['apiA', 'pay'], tone: 'request', duration: 0.9, delay: 0.3 },
          { path: ['apiC', 'pay'], tone: 'request', duration: 0.9, delay: 0.8 },
          { path: ['apiB', 'pay'], tone: 'request', label: 'random 0..400 ms', duration: 0.9, delay: 1.4 },
          { path: ['apiA', 'pay'], tone: 'request', duration: 0.9, delay: 2.5 },
          { path: ['apiC', 'pay'], tone: 'request', duration: 0.9, delay: 3 },
          { path: ['apiB', 'pay'], tone: 'request', duration: 0.9, delay: 3.6 },
          { path: ['pay', 'apiB'], tone: 'response', label: '200 OK', duration: 0.9, delay: 2.4 },
        ],
        panel: {
          title: 'Full jitter windows',
          icon: 'Signal',
          rows: [
            { text: 'Retry 1 sleeps', value: '0 to 100 ms' },
            { text: 'Retry 2 sleeps', value: '0 to 200 ms' },
            { text: 'Retry 3 sleeps', value: '0 to 400 ms' },
            { text: 'Peak seen by payments', value: 'near average', tone: 'good' },
          ],
        },
        caption: 'Same retries, no spikes',
      },
    },
    {
      title: 'Jitter flavors',
      tag: 'tradeoff',
      heading: 'Full, equal and decorrelated jitter',
      eli5: 'There are a few ways to roll the dice. Roll anywhere from zero to the limit, or always wait at least half, or base the wait on your last wait.',
      body: [
        '**Full jitter**: sleep `random(0, ceiling)`. It spreads callers the most, and the average wait is half the ceiling.',
        '**Equal jitter**: sleep `ceiling/2 + random(0, ceiling/2)`. It never retries instantly but spreads less. **Decorrelated jitter**: sleep `random(base, previous × 3)`. Each wait builds on the last one.',
      ],
      keyIdea: 'Full jitter is a good default. All three beat plain backoff because the callers stop lining up.',
      metrics: { threads: '60 / 200', load: '140/s, smooth', ok: '95%', wait: '4.7 s' },
      metricTones: { threads: 'good', load: 'good', ok: 'good' },
      scene: {
        nodes: [apiA, apiB, apiC, { ...payLow, status: 'ok', sub: 'capacity 150/s' }],
        links: fan(),
        flows: [
          { path: ['apiA', 'pay'], tone: 'request', label: 'full', duration: 0.9, delay: 0.3 },
          { path: ['apiB', 'pay'], tone: 'request', label: 'equal', duration: 0.9, delay: 1.2 },
          { path: ['apiC', 'pay'], tone: 'request', label: 'decorrelated', duration: 0.9, delay: 2 },
        ],
        panel: {
          title: 'Sleep before a retry',
          icon: 'Signal',
          rows: [
            { text: 'Full', value: 'rand(0, c)' },
            { text: 'Equal', value: 'c/2 + rand(0, c/2)' },
            { text: 'Decorrelated', value: 'rand(base, prev × 3)' },
          ],
          footer: { text: 'c = min(cap, base × 2^attempt)', tone: 'muted' },
        },
        caption: 'Three ways to roll the dice',
      },
    },
    {
      title: 'Backoff in code',
      tag: 'concept',
      heading: 'Backoff with full jitter in a dozen lines',
      eli5: 'The rule written down: try, and if the line fails, wait a random while up to a limit that doubles each time. After a few tries, stop.',
      body: [
        'The loop makes at most 4 attempts, retries only errors that might clear, and sleeps a random time up to a growing ceiling.',
        'The same trick applies to cache TTLs, cron jobs and reconnects after a load balancer restart: anywhere many clients act on one schedule.',
      ],
      keyIdea: 'Cap the attempts, cap the wait, randomize the sleep.',
      metrics: { threads: '60 / 200', load: '140/s, smooth', ok: '95%', wait: '4.7 s' },
      metricTones: { threads: 'good', load: 'good', ok: 'good' },
      scene: {
        nodes: [{ ...apiB, status: 'active', chips: ['max 4 attempts'] }, { ...payLow, status: 'ok' }],
        links: [link('apiB', 'pay', { arrow: 'both' })],
        flows: [
          { path: ['apiB', 'pay'], tone: 'request', label: 'attempt 1', duration: 0.9 },
          { path: ['apiB', 'pay'], tone: 'request', label: 'after rand(0, 100 ms)', duration: 0.9, delay: 2 },
          { path: ['pay', 'apiB'], tone: 'response', label: '200 OK', duration: 0.9, delay: 3 },
        ],
        panel: {
          title: 'Ceiling per attempt',
          icon: 'Timer',
          rows: [
            { text: 'Attempt 1 fails', value: 'sleep 0 to 100 ms' },
            { text: 'Attempt 2 fails', value: 'sleep 0 to 200 ms' },
            { text: 'Attempt 3 fails', value: 'sleep 0 to 400 ms' },
            { text: 'Attempt 4 fails', value: 'give up', tone: 'bad' },
          ],
        },
        caption: 'Bounded attempts, random sleeps',
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
      title: 'Recap',
      tag: 'recap',
      heading: 'Part 1 recap: give up on time, retry at random',
      eli5: 'Hang up if nobody answers, and set that rule on every phone. Redial only for a crackly line. Wait a growing, random while before each redial.',
      body: [
        'Put a **timeout** on every network call, with connect, read and total limits, set a little above the callee\'s tail latency. Check that `rate × timeout` fits in your thread pool.',
        '**Retries** hide short random failures but add load when the callee is struggling. Space them with **exponential backoff** and spread them with **jitter**. Part 2 covers budgets, idempotency and deadlines.',
      ],
      keyIdea: 'Fail fast, retry only what may clear, and make every client wait a different, growing time.',
      metrics: { threads: '5 / 200', load: '101/s', ok: '99.99%', wait: '1 s' },
      metricTones: { threads: 'good', load: 'good', ok: 'good' },
      scene: {
        nodes: [shoppers, { ...api, status: 'ok' }, { ...pay, status: 'ok' }, { ...ledger, status: 'ok' }, { ...catalog, status: 'ok' }],
        links: [...chain, link('api', 'catalog')],
        flows: [
          { path: ['shoppers', 'api', 'pay', 'ledger'], tone: 'request', count: 2, duration: 2 },
          { path: ['ledger', 'pay', 'api', 'shoppers'], tone: 'response', count: 2, duration: 2, delay: 2.1 },
          { path: ['api', 'catalog', 'api'], tone: 'response', duration: 1.8, delay: 0.6 },
        ],
        panel: {
          title: 'Part 1 checklist',
          icon: 'List',
          rows: [
            { text: 'Timeout on every call', value: 'yes', tone: 'good' },
            { text: 'Above callee p99', value: 'yes', tone: 'good' },
            { text: 'Rate × timeout fits pool', value: 'yes', tone: 'good' },
            { text: 'Backoff + full jitter', value: 'yes', tone: 'good' },
          ],
        },
        caption: 'Healthy: fast failures, polite retries',
      },
      quiz: {
        question: 'Four API instances time out on a payment call at the same instant. They retry with exponential backoff (100 ms, 200 ms, 400 ms) and no jitter. What does the payment service see?',
        options: [
          'Load spread evenly across each window',
          'Synchronized spikes at 100 ms, 200 ms and 400 ms after the failure',
          'No retries at all, because backoff cancels them',
          'A steady load equal to the original traffic',
        ],
        answer: 1,
        explain: 'Backoff gives every caller the same wait, so they retry on the same tick and the service sees spikes. Jitter randomizes each wait and spreads the retries out.',
      },
    },
  ],
};
