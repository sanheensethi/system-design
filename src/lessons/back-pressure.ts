import type { Lesson, SceneLink, SceneNode } from '../engine/types';

// Screen x follows d = x - y and screen y follows s = x + y, so lay nodes out as (column, row).
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const users: SceneNode = { id: 'users', kind: 'client', at: at(-9, 0), label: 'shoppers', sub: '3,000 req/s' };
const scraper: SceneNode = { id: 'scraper', kind: 'client', at: at(-9, -7), label: 'scraper', sub: '2,000 req/s' };
const gateway: SceneNode = { id: 'gateway', kind: 'gateway', at: at(-5.5, 0), label: 'gateway' };
const queue: SceneNode = { id: 'queue', kind: 'queue', at: at(-2, 0), label: 'request queue', sub: 'in memory' };
const api: SceneNode = { id: 'api', kind: 'server', at: at(1.5, 0), label: 'shop API', sub: '200 threads' };
const db: SceneNode = { id: 'db', kind: 'db', at: at(5, 3.5), label: 'Postgres' };
const recs: SceneNode = { id: 'recs', kind: 'service', at: at(5, -3.5), label: 'recommendations' };
const cache: SceneNode = { id: 'cache', kind: 'cache', at: at(-1, -6), label: 'page cache', sub: 'Redis' };

const links: SceneLink[] = [
  { from: 'users', to: 'gateway' },
  { from: 'gateway', to: 'queue' },
  { from: 'queue', to: 'api' },
  { from: 'api', to: 'db' },
  { from: 'api', to: 'recs' },
];

export const backPressure: Lesson = {
  id: 'back-pressure',
  title: 'Back pressure and load shedding',
  tagline: 'When more work arrives than you can finish, decide what to refuse before memory decides for you.',
  minutes: 13,
  level: 'Intermediate',
  learn: [
    'Why an unbounded queue turns overload into timeouts, wasted work and a crash',
    'Sizing a bounded queue from the latency you can accept',
    'Signalling upstream: rejections, Retry-After and pull-based flow',
    'Shedding by priority, admission control and request deadlines',
    'Graceful degradation, retry storms, and how this differs from rate limiting',
  ],
  metrics: [
    { key: 'in', label: 'Arriving' },
    { key: 'good', label: 'Useful replies' },
    { key: 'queue', label: 'Queued' },
    { key: 'p99', label: 'p99' },
    { key: 'mem', label: 'Memory' },
  ],
  steps: [
    {
      title: 'Flash sale',
      tag: 'problem',
      heading: 'The queue that grew until the server died',
      eli5: 'A restaurant kitchen can cook 20 meals an hour. The host keeps seating everyone who walks in. Soon guests wait three hours, leave before their food comes, and the kitchen cooks meals for empty tables.',
      body: [
        'The shop API has 200 threads and each request takes about 100 ms, so it serves **2,000 requests a second**. At noon a flash sale brings 3,000. The web framework puts every request it cannot start yet into an in-memory queue with no limit.',
        'The extra 1,000 a second pile up. After one minute the queue holds 60,000 requests, and a new request waits 30 seconds for a thread. The mobile app gives up after 10 seconds. So the API spends all of its 2,000 a second on requests whose caller already left. CPU is at 100% and **useful replies are close to zero**.',
        'Each queued request holds about 50 KB of buffers. Three minutes in, 180,000 of them need 9 GB, and the container limit is 8 GB. The process is killed, the queue vanishes, every app retries, and the new instance starts straight into the same burst.',
      ],
      keyIdea: 'An unbounded queue adds no capacity. It turns overload into latency, then into wasted work, then into a crash.',
      metrics: { in: '3,000/s', good: '~0/s', queue: '180,000', p99: '30 s+', mem: '8 GB, OOM' },
      scene: {
        nodes: [
          { ...users, status: 'hot', badge: 'gave up at 10 s' },
          gateway,
          { ...queue, sub: 'no limit', status: 'hot', badge: '180,000 waiting' },
          { ...api, status: 'down', badge: 'OOM killed' },
          db,
          recs,
        ],
        links,
        flows: [
          { path: ['users', 'gateway', 'queue'], tone: 'request', count: 6, duration: 1.4 },
          { path: ['queue', 'api'], tone: 'request', label: 'already abandoned', count: 2, duration: 1.4, delay: 1.5 },
          { path: ['gateway', 'users'], tone: 'error', label: 'timeout', count: 3, duration: 1.1, delay: 2.2 },
        ],
        caption: '3,000 in, 2,000 out, and the difference lives in RAM',
      },
    },
    {
      title: 'Bound it',
      tag: 'concept',
      heading: 'A bounded queue, sized from latency',
      eli5: 'The host keeps a short waiting list, at most ten names. When it is full, new guests hear "sorry, we are full" right away and can go elsewhere, instead of waiting hours for nothing.',
      body: [
        'Queue wait is roughly `queue depth / service rate`. That gives a way to size the queue: decide the most waiting you will accept, then multiply. For at most 100 ms of queueing at 2,000 a second, cap the queue at **200**.',
        'When the queue is full, reject the new request at once with `503 Service Unavailable`. Rejecting costs microseconds and no memory. Now 2,000 requests a second are served in about 200 ms, and the other 1,000 get a fast answer the app can act on: retry later, or tell the user.',
        'A fast no beats a slow no. The slow version spends a thread, memory and the user\'s patience, and still ends in failure.',
      ],
      keyIdea: 'Bound every queue by the wait you can accept, and reject immediately when it is full.',
      metrics: { in: '3,000/s', good: '2,000/s', queue: '200 (full)', p99: '210 ms', mem: '1.1 GB' },
      scene: {
        nodes: [
          users,
          gateway,
          { ...queue, sub: 'max 200', status: 'active', badge: '200 / 200' },
          { ...api, status: 'ok', badge: '2,000/s' },
          db,
          recs,
        ],
        links,
        flows: [
          { path: ['users', 'gateway', 'queue', 'api'], tone: 'request', count: 4, duration: 2 },
          { path: ['api', 'queue', 'gateway', 'users'], tone: 'response', count: 4, duration: 2, delay: 2.1 },
          { path: ['queue', 'gateway', 'users'], tone: 'error', label: '503 in 1 ms', count: 2, duration: 1.3, delay: 1 },
        ],
        caption: 'Two of three requests are served fast. The third is refused fast.',
      },
      quiz: {
        question: 'The API serves 2,000 requests a second and its queue is capped at 200. About how long can a request wait in the queue at worst?',
        options: ['10 ms', '100 ms', '1 second', 'It depends on memory'],
        answer: 1,
        explain: 'Wait is depth divided by service rate: 200 / 2,000 per second = 0.1 s. The cap turns a latency target into a number you can configure.',
      },
    },
    {
      title: 'Push back',
      tag: 'concept',
      heading: 'Tell the stage upstream to slow down',
      eli5: 'When the kitchen is full, it tells the host, and the host stops seating people. If a delivery driver keeps bringing orders, the host tells him to come back in a few minutes.',
      body: [
        '**Back pressure** means a stage that cannot keep up signals the stage before it, so work slows at the source instead of piling up in the middle. A rejection is that signal. Make it useful: `503` or `429` with a `Retry-After` header tells a well-behaved client when to try again.',
        'Between your own services, pull is easier than push. A consumer that asks for the next batch only when it has room cannot be flooded. Kafka consumers pull. HTTP/2 and gRPC streams have flow-control windows, and TCP has its receive window. With bounded buffers at every stage, a slow database fills the API\'s buffer, which fills the gateway\'s, all the way back to the edge.',
        'At the edge are people and partner systems that you cannot block forever. There you choose: reject, or do less work. The rest of this lesson is about choosing well.',
      ],
      keyIdea: 'Back pressure carries "I am full" upstream through bounded buffers, so the slowdown reaches the source instead of filling memory in the middle.',
      metrics: { in: '3,000/s', good: '2,000/s', queue: '200 (full)', p99: '210 ms', mem: '1.1 GB' },
      scene: {
        nodes: [
          { ...users, badge: 'retry after 2 s' },
          { ...gateway, status: 'active', badge: 'buffer full' },
          { ...queue, sub: 'max 200', status: 'hot', badge: 'full' },
          { ...api, status: 'active' },
          { ...db, status: 'hot', badge: 'slow writes' },
          recs,
        ],
        links,
        flows: [
          { path: ['db', 'api'], tone: 'error', label: 'slow', duration: 1.2 },
          { path: ['queue', 'gateway'], tone: 'error', label: 'full', duration: 1.1, delay: 1.2 },
          { path: ['gateway', 'users'], tone: 'error', label: '503 Retry-After: 2', duration: 1.2, delay: 2.4 },
        ],
        caption: 'Pressure travels from the slowest stage back to the client',
      },
      code: {
        language: 'go',
        title: 'A bounded queue that refuses instead of growing',
        source: `var work = make(chan *Job, 200) // capacity = accepted wait x service rate

func handler(w http.ResponseWriter, r *http.Request) {
    job := newJob(r)
    select {
    case work <- job: // room in the queue
        writeResult(w, <-job.done)
    default: // queue full: refuse now, cheaply
        w.Header().Set("Retry-After", "2")
        http.Error(w, "overloaded", http.StatusServiceUnavailable)
    }
}

func worker() { // run 200 of these
    for job := range work {
        job.done <- process(job)
    }
}`,
        highlight: [1, 6, 8, 9, 10],
      },
    },
    {
      title: 'Shed by priority',
      tag: 'concept',
      heading: 'Drop the work that matters least first',
      eli5: 'When the kitchen is swamped, it stops making free bread for the table before it stops cooking main dishes. Paying guests with food on order are the last ones turned away.',
      body: [
        'A full queue that rejects at random turns away checkouts as often as analytics pings. But the traffic is not equal. Of the 3,000 requests a second, 300 are checkouts, 1,700 are product and cart pages, and 1,000 are recommendation calls and analytics beacons.',
        'The gateway tags each request with a priority: **critical** (checkout, payment), **default** (pages, cart) and **sheddable** (recommendations, beacons, prefetch). The API reads how full its queue is and starts refusing the lowest class first: sheddable above 50% full, default above 90%, critical only when there is no room at all.',
        'Here, shedding the sheddable class alone brings the load to 2,000 a second, which fits. Every checkout gets through, and the only loss is some recommendations and analytics, which the app can live without.',
      ],
      keyIdea: 'Label requests by how much they matter, and shed from the bottom up as the queue fills.',
      metrics: { in: '3,000/s', good: '2,000/s', queue: '110', p99: '160 ms', mem: '1.0 GB' },
      scene: {
        nodes: [
          users,
          { ...gateway, status: 'active', badge: 'tags priority' },
          { ...queue, sub: 'max 200', status: 'active', badge: '55% full' },
          { ...api, status: 'ok', badge: 'checkout 100% served' },
          db,
          { ...recs, status: 'dim', badge: 'shed' },
        ],
        links,
        flows: [
          { path: ['users', 'gateway', 'queue', 'api'], tone: 'request', label: 'checkout', duration: 2 },
          { path: ['users', 'gateway', 'queue', 'api'], tone: 'request', label: 'product page', count: 2, duration: 2, delay: 0.5 },
          { path: ['queue', 'gateway', 'users'], tone: 'error', label: 'beacon: 503', count: 2, duration: 1.3, delay: 1.2 },
        ],
        caption: 'Sheddable traffic is refused first, critical traffic last',
      },
      code: {
        language: 'python',
        title: 'Admission by priority and by deadline',
        source: `SHED_AT = {"sheddable": 0.5, "default": 0.9, "critical": 1.0}
QUEUE_MAX = 200

def admit(request):
    priority = request.headers.get("X-Priority", "default")
    fill = work_queue.qsize() / QUEUE_MAX
    if fill >= SHED_AT[priority]:
        return reject(503, retry_after=2)

    # The gateway sends the caller's deadline. Skip work nobody will wait for.
    deadline = float(request.headers["X-Deadline"])        # unix seconds
    expected = fill * QUEUE_MAX / SERVICE_RATE + P50_RUNTIME
    if time.time() + expected > deadline:
        return reject(503, retry_after=2)

    work_queue.put_nowait(request)`,
        highlight: [1, 7, 8, 11, 13, 14],
      },
    },
    {
      title: 'Admission',
      tag: 'concept',
      heading: 'Admission control: accept only what you can finish',
      eli5: 'A smart host knows how long the kitchen is taking tonight. If a guest says "I must leave in 20 minutes" and dinner takes 40, the host tells her now instead of taking her order.',
      body: [
        '**Admission control** decides at the door whether a request can be finished in time, and refuses it otherwise. Two tools do most of the work. A **concurrency limit** caps requests in flight. It adapts to slow periods better than a fixed requests-per-second number, because when each request takes longer, fewer finish and fewer are let in.',
        'The limit itself can adapt. Raise it by one while latency stays near normal, and cut it by a fraction when latency climbs, the way TCP finds the speed of a network. The server learns its own capacity during a sale, a slow database or a bad deploy.',
        'The second tool is a **deadline**. The gateway gives each request a budget, say 10 seconds, and passes the time left to every downstream call. A server that sees too little time left refuses before starting, so it never spends a thread on an answer nobody will read.',
      ],
      keyIdea: 'Admit work by in-flight count and remaining deadline, so the server only starts what it can finish while someone is still waiting.',
      metrics: { in: '3,000/s', good: '2,000/s', queue: '110', p99: '160 ms', mem: '1.0 GB' },
      scene: {
        nodes: [
          users,
          { ...gateway, status: 'active', badge: 'deadline 10 s' },
          { ...queue, sub: 'max 200', status: 'active' },
          { ...api, status: 'active', badge: 'limit 200 → 140' },
          { ...db, status: 'hot', badge: 'p50 160 ms' },
          recs,
        ],
        links,
        flows: [
          { path: ['users', 'gateway', 'queue'], tone: 'request', label: '9.8 s left', duration: 1.4 },
          { path: ['queue', 'api', 'db'], tone: 'request', label: '9.6 s left', duration: 1.4, delay: 1.5 },
          { path: ['queue', 'gateway'], tone: 'error', label: '0.2 s left: refuse', duration: 1.2, delay: 3 },
        ],
        caption: 'The database slowed, so the API lowers its own limit',
      },
    },
    {
      title: 'Degrade',
      tag: 'concept',
      heading: 'Do less per request instead of refusing',
      eli5: 'On a packed night the kitchen drops the fancy garnish and serves soup that was made ahead. Guests still get a good meal, and the kitchen feeds more of them.',
      body: [
        'Refusing is not the only lever. **Graceful degradation** makes each request cheaper so more of them fit. A product page normally calls the recommendations service, reads live stock from Postgres and renders reviews. Under load it shows a fixed bestseller list, reads product details from a cache that may be 60 seconds old, and leaves reviews out.',
        'Each page now costs about 60 ms instead of 100, so the same 200 threads serve **3,300 requests a second**, and the flash sale fits without refusing anyone. Checkout does not degrade: it still reads stock and price from the database.',
        'Plan degraded modes before the incident. Put each one behind a switch that load signals can flip and an operator can flip by hand. Test the switches on a normal day, because a fallback that has never run tends to fail when you need it.',
      ],
      keyIdea: 'Decide ahead of time which features can be dropped or served stale, so overload lowers quality before it lowers availability.',
      metrics: { in: '3,000/s', good: '3,000/s', queue: '~20', p99: '120 ms', mem: '0.9 GB' },
      scene: {
        nodes: [
          users,
          gateway,
          { ...queue, sub: 'max 200', status: 'ok', badge: '20' },
          { ...api, status: 'ok', badge: 'degraded mode' },
          { ...db, badge: 'checkout only' },
          { ...recs, status: 'dim', badge: 'switched off' },
          { ...cache, status: 'active', badge: 'up to 60 s old' },
        ],
        links: [...links.slice(0, 4), { from: 'api', to: 'recs', style: 'faint' }, { from: 'api', to: 'cache' }],
        flows: [
          { path: ['users', 'gateway', 'queue', 'api'], tone: 'request', count: 4, duration: 1.8 },
          { path: ['api', 'cache'], tone: 'request', label: 'product 42', duration: 1, delay: 1.9 },
          { path: ['cache', 'api'], tone: 'response', duration: 1, delay: 3 },
          { path: ['api', 'queue', 'gateway', 'users'], tone: 'response', count: 4, duration: 1.8, delay: 4 },
        ],
        caption: 'Cheaper pages: no recommendations, product details from cache',
      },
    },
    {
      title: 'Retry storm',
      tag: 'case',
      heading: 'Case: the outage that outlived its cause',
      eli5: 'The kitchen closes for two minutes. Every guest shouts their order three times, and each waiter repeats every shout three times. When the kitchen reopens, the pile of shouted orders closes it again.',
      body: [
        'Postgres fails over and is unavailable for two minutes. The app retries each failed call up to 3 times with no wait, and the gateway also retries each attempt up to 3 times. One user action can become **9 calls** to the API. Load jumps from 3,000 to over 20,000 a second.',
        'The database comes back and the API still does not recover. Every client is retrying, queues are full of requests that will time out, and the extra load keeps latency above the timeout, which creates more retries. The trigger is gone and the overload keeps itself going. This is a **metastable failure**, and it often ends only when someone blocks traffic by hand.',
        'Fixes: retry in one layer only, usually the client nearest the user. Use exponential backoff with jitter and respect `Retry-After`. Give each client a **retry budget**, for example retries may be at most 10% of its requests, so during an outage retries add 10% load rather than 9 times the load.',
      ],
      keyIdea: 'Retries are load. Without a budget they multiply across layers and can keep a system down after the original fault is fixed.',
      metrics: { in: '20,000+/s', good: '~0/s', queue: '200 (full)', p99: '10 s', mem: '1.1 GB' },
      scene: {
        nodes: [
          { ...users, status: 'hot', badge: '3 tries each' },
          { ...gateway, status: 'hot', badge: '3 tries each' },
          { ...queue, sub: 'max 200', status: 'hot', badge: 'full' },
          { ...api, status: 'hot', badge: 'timeouts' },
          { ...db, status: 'ok', badge: 'back after 2 min' },
          recs,
        ],
        links,
        flows: [
          { path: ['users', 'gateway'], tone: 'request', label: 'retry', count: 5, duration: 1 },
          { path: ['gateway', 'queue'], tone: 'request', label: 'retry x3', count: 6, duration: 1, delay: 1 },
          { path: ['queue', 'gateway', 'users'], tone: 'error', label: '503', count: 4, duration: 1.4, delay: 2.1 },
        ],
        caption: 'The database is healthy again, and retries keep the API down',
      },
      code: {
        language: 'typescript',
        title: 'Client retries with backoff, jitter and a 10% budget',
        source: `const budget = { requests: 0, retries: 0 }; // reset every minute

async function call(req: Request, attempt = 1): Promise<Response> {
  budget.requests += attempt === 1 ? 1 : 0;
  const res = await fetch(req.clone());
  if (res.status < 500 && res.status !== 429) return res;

  const overBudget = budget.retries >= 0.1 * budget.requests;
  if (attempt >= 3 || overBudget) return res;      // give up, show an error

  const hinted = Number(res.headers.get('Retry-After') ?? 0) * 1000;
  const backoff = 200 * 2 ** (attempt - 1);       // 200, 400 ms
  await sleep(Math.max(hinted, Math.random() * backoff)); // full jitter
  budget.retries += 1;
  return call(req, attempt + 1);
}`,
        highlight: [8, 9, 11, 13],
      },
    },
    {
      title: 'Not rate limiting',
      tag: 'tradeoff',
      heading: 'Load shedding and rate limiting answer different questions',
      eli5: 'A rule "each family may order 3 dishes" stops one greedy table. It does nothing when 500 polite families arrive at once. For that, the kitchen itself must say "we are full".',
      body: [
        'A **rate limiter** asks: is this client over its quota? The quota is a fixed number per key, and it applies whether the server is idle or on fire. **Load shedding** asks: can I take any more work right now? It looks at the server\'s own state and does not care who sent the request.',
        'Each misses what the other catches. With a limit of 10 requests a second per user, 30,000 shoppers sending one request every 10 seconds are all within quota, and their 3,000 a second still overload the API. A scraper sending 2,000 a second is stopped by the limiter at once, while shedding would only react once the server is full, and would then turn away shoppers along with the scraper.',
        'Use both. Rate limit at the edge for fairness and abuse. Shed and degrade inside every service to protect itself. Autoscaling is the third lever: it adds capacity in minutes, and shedding is what keeps you up during those minutes.',
      ],
      keyIdea: 'Rate limiting enforces fairness per client. Load shedding protects the server from the total. You need both.',
      metrics: { in: '3,000/s', good: '3,000/s', queue: '~20', p99: '120 ms', mem: '0.9 GB' },
      scene: {
        nodes: [
          { ...users, sub: '30,000 users, 3,000 req/s' },
          { ...scraper, status: 'hot', badge: 'over quota' },
          { ...gateway, status: 'active', badge: '10 req/s per user' },
          { ...queue, sub: 'max 200', status: 'active' },
          { ...api, status: 'ok', badge: 'sheds by its own load' },
          db,
          recs,
        ],
        links: [...links, { from: 'scraper', to: 'gateway' }],
        flows: [
          { path: ['scraper', 'gateway'], tone: 'request', count: 4, duration: 1 },
          { path: ['gateway', 'scraper'], tone: 'error', label: '429', count: 2, duration: 1, delay: 1.1 },
          { path: ['users', 'gateway', 'queue', 'api'], tone: 'request', label: 'within quota', count: 3, duration: 2, delay: 0.4 },
        ],
        caption: 'The limiter stops one heavy client. Shedding guards against the crowd.',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Refuse early, refuse the right things, refuse cheaply',
      eli5: 'A good restaurant keeps a short waiting list, says "full" early, drops extras before main dishes, cooks simpler food on busy nights, and stops guests from shouting the same order again and again.',
      body: [
        'Every queue needs a bound sized from the wait you can accept. When it fills, refuse fast and tell the caller when to come back, so pressure flows upstream instead of into memory. Shed the least important traffic first, and admit only work that can finish before its deadline.',
        'Before refusing, make requests cheaper with planned degraded modes. Keep retries in one layer with backoff, jitter and a budget, or they will turn a short outage into a long one. Rate limits handle unfair clients. Shedding handles too much total work.',
      ],
      keyIdea: 'Overload is a decision you make ahead of time: what to drop, what to degrade, and what to keep at any cost.',
      metrics: { in: '3,000/s', good: '3,000/s', queue: '~20', p99: '120 ms', mem: '0.9 GB' },
      scene: {
        nodes: [
          users,
          { ...gateway, status: 'ok' },
          { ...queue, sub: 'max 200', status: 'ok' },
          { ...api, status: 'ok' },
          db,
          recs,
          cache,
        ],
        links: [...links, { from: 'api', to: 'cache' }],
        flows: [
          { path: ['users', 'gateway', 'queue', 'api'], tone: 'request', count: 3, duration: 1.8 },
          { path: ['api', 'queue', 'gateway', 'users'], tone: 'response', count: 3, duration: 1.8, delay: 1.9 },
        ],
      },
      quiz: {
        question: 'Your API serves 2,000 requests a second. A sale brings 3,000. Which change keeps checkout working without losing the server?',
        options: [
          'Remove the queue limit so no request is ever refused',
          'Raise every user\'s rate limit',
          'Bound the queue and shed sheddable traffic such as recommendations and beacons first',
          'Have the gateway retry every failed request three times',
        ],
        answer: 2,
        explain: 'An unbounded queue only delays the crash, and retries add load. A bounded queue with priority shedding keeps the server inside its capacity and spends that capacity on the requests that matter.',
      },
    },
  ],
};
