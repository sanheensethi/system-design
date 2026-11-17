import type { Lesson, SceneNode } from '../engine/types';

const users: SceneNode = { id: 'users', kind: 'client', at: [-3.5, 3.5], label: 'shoppers', sub: '300 pages/s' };
const web: SceneNode = { id: 'web', kind: 'gateway', at: [-2.15, 2.15], label: 'storefront' };
const api: SceneNode = { id: 'api', kind: 'server', at: [-0.75, 0.75], label: 'product API', sub: '200 threads' };
const catalog: SceneNode = { id: 'catalog', kind: 'service', at: [-1, -4], label: 'catalog', sub: '20 ms' };
const reviews: SceneNode = { id: 'reviews', kind: 'service', at: [2.75, -2.75], label: 'reviews', sub: '30 ms' };
const recs: SceneNode = { id: 'recs', kind: 'service', at: [4.2, 0.8], label: 'recommendations', sub: '40 ms' };
const breaker: SceneNode = { id: 'breaker', kind: 'limiter', at: [1.7, 0.9], label: 'breaker' };
const cart: SceneNode = { id: 'cart', kind: 'service', at: [0.85, 5.15], label: 'cart', sub: 'healthy' };

const reportJob: SceneNode = { id: 'reports', kind: 'worker', at: [2.25, 3.75], label: 'report job', sub: '30 s queries' };
const pg: SceneNode = { id: 'pg', kind: 'db', at: [3.5, -0.5], label: 'Postgres', sub: '50 connections' };

const direct = [
  { from: 'users', to: 'web' },
  { from: 'web', to: 'api' },
  { from: 'api', to: 'catalog' },
  { from: 'api', to: 'reviews' },
  { from: 'api', to: 'recs' },
];
const guarded = [
  { from: 'users', to: 'web' },
  { from: 'web', to: 'api' },
  { from: 'api', to: 'catalog' },
  { from: 'api', to: 'reviews' },
  { from: 'api', to: 'breaker' },
  { from: 'breaker', to: 'recs' },
];

export const circuitBreakers: Lesson = {
  id: 'circuit-breakers',
  title: 'Circuit breakers and bulkheads',
  tagline: 'Stop calling a dependency that is failing, and wall each one off so it cannot drown the rest.',
  minutes: 14,
  level: 'Intermediate',
  learn: [
    'How one slow dependency cascades up the call chain',
    'The closed, open and half-open states of a circuit breaker',
    'How to set trip thresholds without flapping',
    'Fallbacks: what to return when the breaker is open',
    'Bulkheads: separate thread pools and connection pools per dependency',
  ],
  metrics: [
    { key: 'threads', label: 'API threads busy' },
    { key: 'p99', label: 'Page p99' },
    { key: 'ok', label: 'Pages served' },
    { key: 'recs', label: 'Calls to recs' },
  ],
  steps: [
    {
      title: 'Slow extra',
      tag: 'problem',
      heading: 'An optional feature takes the product page down',
      eli5: 'A restaurant has one slow cook at the dessert counter. Every waiter ends up standing there waiting for dessert. Nobody is left to bring soup. The **product API** is the team of waiters.',
      body: [
        'The product API serves **300 pages per second**. Each page calls three services: catalog (20 ms), reviews (30 ms) and recommendations (40 ms). About 27 of its 200 threads are busy at any moment.',
        'The recommendations service has a bad deploy and stops answering. The API has a 1 second timeout on that call, as it should. But 300 calls per second, each held for 1 second, need **300 threads**. The pool has 200.',
        'Every thread is now waiting on recommendations, a row of "you may also like" items at the bottom of the page. Catalog and reviews are healthy and idle. The page that needs them cannot get a thread.',
      ],
      keyIdea: 'A timeout limits how long one call waits. It does not stop you from sending 300 more calls into the same hole every second.',
      metrics: { threads: '200 / 200', p99: '> 5 s', ok: '15%', recs: '300/s, all time out' },
      scene: {
        nodes: [users, web, { ...api, status: 'hot', badge: '200 / 200 waiting' }, { ...catalog, status: 'dim' }, { ...reviews, status: 'dim' }, { ...recs, status: 'down', sub: 'not answering' }],
        links: direct,
        flows: [
          { path: ['users', 'web', 'api'], tone: 'request', count: 4, duration: 1.4 },
          { path: ['api', 'recs'], tone: 'request', label: 'GET /recs', count: 5, duration: 1.2, delay: 1.4 },
          { path: ['recs', 'api'], tone: 'error', label: 'timeout 1 s', duration: 2.4, delay: 2.6 },
        ],
        caption: 'Healthy services sit idle while threads wait on a dead one',
      },
    },
    {
      title: 'Cascade',
      tag: 'case',
      heading: 'Case: the failure climbs the call chain',
      eli5: 'The waiters are stuck at the dessert counter, so the host at the door has nobody to hand guests to. Soon the host is stuck too, and even people who only wanted a drink wait outside. The **storefront** is the host.',
      body: [
        'The storefront calls the product API and waits for it. The API is now slow, so the storefront\'s own threads start piling up in the same way. Within a minute its pool is full too.',
        'The storefront also serves the cart and checkout pages. Those never touch recommendations, but they share the storefront\'s threads. Shoppers can no longer pay.',
        'This is a **cascading failure**. A fault in one leaf service spreads upward through every caller that waits on it, and sideways into features that share a pool with those callers. The most damaging part is that the first failure was in the least important service.',
      ],
      keyIdea: 'Slowness spreads to every caller that waits. To stop a cascade, some layer has to refuse to wait.',
      metrics: { threads: '200 / 200', p99: '> 5 s', ok: '5%', recs: '300/s, all time out' },
      scene: {
        nodes: [
          { ...users, status: 'hot' },
          { ...web, status: 'hot', badge: 'pool full' },
          { ...api, status: 'hot', badge: 'pool full' },
          { ...recs, status: 'down', sub: 'not answering' },
          { ...cart, badge: 'unreachable' },
        ],
        links: [
          { from: 'users', to: 'web' },
          { from: 'web', to: 'api' },
          { from: 'api', to: 'recs' },
          { from: 'web', to: 'cart', style: 'faint' },
        ],
        flows: [
          { path: ['recs', 'api'], tone: 'error', label: 'slow', duration: 1.6 },
          { path: ['api', 'web'], tone: 'error', label: 'slow', duration: 1.6, delay: 1.2 },
          { path: ['web', 'users'], tone: 'error', label: '504', duration: 1.6, delay: 2.4 },
        ],
        caption: 'Recommendations broke. Checkout is what went down.',
      },
    },
    {
      title: 'Closed',
      tag: 'concept',
      heading: 'A circuit breaker watches every call',
      eli5: 'Put a helper beside the dessert counter who counts how many orders come back late. While most come back fine, waiters go through as normal. That helper is the **breaker**.',
      body: [
        'A **circuit breaker** is a small object that wraps calls to one dependency. Every call goes through it, and it records whether the call succeeded, failed or was too slow.',
        'In the **closed** state it passes calls straight through and only counts. The name comes from electrics: a closed circuit lets current flow. On a normal day the breaker costs a few counter updates and nothing else.',
        'The breaker lives in the caller, in memory. Each API instance keeps its own, one per dependency. A proxy or service mesh sidecar can do the same job outside the application.',
      ],
      keyIdea: 'A breaker sits in the caller, in front of one dependency, and keeps a running score of how its calls are going.',
      metrics: { threads: '27 / 200', p99: '180 ms', ok: '100%', recs: '300/s' },
      scene: {
        nodes: [users, web, api, catalog, reviews, { ...breaker, status: 'ok', badge: 'closed · 0.5% errors' }, { ...recs, status: 'ok' }],
        links: guarded,
        flows: [
          { path: ['api', 'breaker', 'recs'], tone: 'request', count: 3, duration: 1.3 },
          { path: ['recs', 'breaker', 'api'], tone: 'response', label: 'ok, counted', count: 3, duration: 1.3, delay: 1.4 },
        ],
        caption: 'Closed: calls flow, results are counted',
      },
    },
    {
      title: 'Open',
      tag: 'concept',
      heading: 'Too many failures: the breaker opens',
      eli5: 'Half the dessert orders are coming back late, so the helper puts up a "counter closed" sign. Waiters see the sign and turn around at once. Now they have time for soup again.',
      body: [
        'When the failure score crosses a threshold, the breaker **opens**. Now it rejects every call at once, without touching the network. The caller gets an error in microseconds where it used to wait a full second.',
        'Two things improve together. The API\'s threads come back, so pages built from catalog and reviews are served again in about 50 ms. And the recommendations service stops receiving 300 calls per second while it is trying to restart.',
        'Compare with retries from the previous lesson. A retry says "that may have been bad luck, try again". A breaker says "this is broken for now, stop asking". Use both: retries for blips, the breaker for outages.',
      ],
      keyIdea: 'An open breaker fails instantly. That frees the caller and gives the broken service room to recover.',
      metrics: { threads: '15 / 200', p99: '70 ms', ok: '100% (no recs)', recs: '0/s' },
      scene: {
        nodes: [users, web, { ...api, status: 'ok' }, { ...catalog, status: 'ok' }, { ...reviews, status: 'ok' }, { ...breaker, status: 'hot', badge: 'OPEN · fail fast' }, { ...recs, status: 'down', sub: 'restarting' }],
        links: [...guarded.slice(0, 5), { from: 'breaker', to: 'recs', style: 'faint' }],
        flows: [
          { path: ['api', 'breaker'], tone: 'request', count: 3, duration: 0.7 },
          { path: ['breaker', 'api'], tone: 'error', label: 'rejected in < 1 ms', count: 3, duration: 0.7, delay: 0.8 },
          { path: ['api', 'catalog', 'api'], tone: 'response', duration: 1.6, delay: 0.4 },
          { path: ['api', 'reviews', 'api'], tone: 'response', duration: 1.6, delay: 0.6 },
        ],
        caption: 'Open: nothing reaches the broken service',
      },
    },
    {
      title: 'Half-open',
      tag: 'concept',
      heading: 'Half-open: test with a few calls',
      eli5: 'After a while the helper lets one waiter try the dessert counter. If the dessert comes quickly, the sign comes down. If not, the sign stays up a bit longer.',
      body: [
        'An open breaker cannot tell when the dependency is healthy again, because it sends it nothing. So after a cool-down, say **30 seconds**, it moves to **half-open** and lets a small number of probe calls through, for example 5.',
        'If the probes succeed, the breaker closes and normal traffic resumes. If they fail, it opens again and the cool-down restarts. Everyone else keeps getting fast rejections while the probes run.',
        'Half-open matters for recovery. A service that just restarted has cold caches and empty connection pools. Sending it 5 calls is safe. Sending it the full 300 per second at once can knock it straight back down.',
      ],
      keyIdea: 'Closed, open, half-open: count, stop, then test with a trickle before trusting the dependency again.',
      metrics: { threads: '15 / 200', p99: '70 ms', ok: '100% (no recs)', recs: '5 probes' },
      scene: {
        nodes: [users, web, api, catalog, reviews, { ...breaker, status: 'active', badge: 'half-open · 5 probes' }, { ...recs, status: 'active', sub: 'just restarted' }],
        links: guarded,
        flows: [
          { path: ['api', 'breaker'], tone: 'request', count: 4, duration: 0.7 },
          { path: ['breaker', 'api'], tone: 'error', label: 'most rejected', count: 3, duration: 0.7, delay: 0.8 },
          { path: ['breaker', 'recs'], tone: 'handshake', label: 'probe', duration: 0.9, delay: 0.8 },
          { path: ['recs', 'breaker'], tone: 'response', label: '200 in 40 ms', duration: 0.9, delay: 1.8 },
          { path: ['breaker', 'api'], tone: 'response', label: 'close', duration: 0.7, delay: 2.8 },
        ],
        caption: 'A few probes decide: close again, or stay open',
      },
      code: {
        language: 'python',
        title: 'A minimal circuit breaker',
        source: `import time

class CircuitBreaker:
    def __init__(self, max_failures=5, cooldown=30):
        self.max_failures, self.cooldown = max_failures, cooldown
        self.failures, self.state, self.opened_at = 0, "closed", 0.0

    def call(self, fn, fallback):
        if self.state == "open":
            if time.monotonic() - self.opened_at < self.cooldown:
                return fallback()                  # fail fast, no network call
            self.state = "half_open"               # cool-down over: allow a probe
        try:
            result = fn()
        except Exception:
            self.failures += 1
            if self.state == "half_open" or self.failures >= self.max_failures:
                self.state, self.opened_at = "open", time.monotonic()
            return fallback()
        self.failures, self.state = 0, "closed"    # success closes the breaker
        return result`,
        highlight: [9, 11, 12, 17, 18, 20],
      },
    },
    {
      title: 'Thresholds',
      tag: 'tradeoff',
      heading: 'When should it trip?',
      eli5: 'If the helper puts up the sign after one late dessert, the counter is closed all day for nothing. If the helper waits for a hundred, the waiters are already stuck. The rule has to sit in between.',
      body: [
        'Counting consecutive failures is easy but crude. Production breakers usually use a **failure rate over a rolling window**: open when 50% or more of the calls in the last 10 seconds failed. A **minimum call count** (say 20) stops it from tripping on 2 failures out of 3 calls at 4 AM.',
        'Count **slow calls** as failures too. A dependency that answers every call in 900 ms never raises an error, yet it eats threads just the same. Treating calls over 500 ms as failed lets the breaker catch the hang before the timeout does.',
        'Too sensitive, and a brief blip opens the breaker and you cause an outage the dependency never had. Too relaxed, and the pool is gone before it reacts. A longer cool-down protects the dependency more and delays recovery. Start with the defaults of a known library and adjust from real traffic.',
      ],
      keyIdea: 'Trip on failure rate over a window with a minimum volume, and treat slow as failed.',
      metrics: { threads: '27 / 200', p99: '180 ms', ok: '100%', recs: '300/s' },
      scene: {
        nodes: [api, { ...breaker, status: 'active', badge: '50% of last 10 s · min 20 calls' }, { ...recs, status: 'hot', sub: '900 ms, no errors' }],
        links: [
          { from: 'api', to: 'breaker' },
          { from: 'breaker', to: 'recs' },
        ],
        flows: [
          { path: ['api', 'breaker', 'recs'], tone: 'request', count: 3, duration: 1.2 },
          { path: ['recs', 'breaker'], tone: 'error', label: 'slow = failed', count: 2, duration: 1.8, delay: 1.3 },
          { path: ['recs', 'breaker', 'api'], tone: 'response', duration: 1.4, delay: 1.3 },
        ],
        caption: 'The breaker scores slow calls as failures',
      },
      code: {
        language: 'yaml',
        title: 'Resilience4j breaker settings for one dependency',
        source: `resilience4j.circuitbreaker:
  instances:
    recommendations:
      slidingWindowType: TIME_BASED
      slidingWindowSize: 10                 # seconds
      minimumNumberOfCalls: 20              # no verdict on tiny samples
      failureRateThreshold: 50              # percent
      slowCallDurationThreshold: 500ms      # slower than this counts as slow
      slowCallRateThreshold: 50             # percent of slow calls that trips it
      waitDurationInOpenState: 30s          # cool-down before half-open
      permittedNumberOfCallsInHalfOpenState: 5`,
        highlight: [6, 7, 8, 10, 11],
      },
      quiz: {
        question: 'A breaker opens at 50% failures over 10 s with a minimum of 20 calls. In the last 10 s there were 6 calls and 5 failed. What does it do?',
        options: [
          'Opens, because 83% is above 50%',
          'Stays closed, because 6 calls is below the minimum of 20',
          'Moves to half-open',
          'Opens for half the usual cool-down',
        ],
        answer: 1,
        explain: 'The minimum call count exists for this case. Six calls is too small a sample to judge the dependency, so the breaker keeps counting and stays closed.',
      },
    },
    {
      title: 'Fallbacks',
      tag: 'concept',
      heading: 'What do you return when the breaker is open?',
      eli5: 'When the dessert counter is closed, the waiter does not send the family home. The waiter says "no cake today, here is some fruit". That swap is a **fallback**.',
      body: [
        'Failing fast is only half of the design. The caller still has to answer its own caller. A **fallback** is the answer it gives when the real one is not available.',
        'For recommendations there are good options: the last result cached for this shopper, a static list of bestsellers, or leaving that section out of the page. The page is slightly worse and fully usable. This is **graceful degradation**.',
        'Some calls have no honest fallback. You cannot guess that a payment went through. There the right move is a clear, fast error ("payments are unavailable, try again in a minute"), or putting the work on a queue to finish later. Decide the fallback per dependency while designing, before the outage.',
      ],
      keyIdea: 'For each dependency, decide ahead of time what the page does without it: a cached copy, a default, nothing, or an honest error.',
      metrics: { threads: '15 / 200', p99: '70 ms', ok: '100% (bestsellers)', recs: '0/s' },
      scene: {
        nodes: [users, web, { ...api, status: 'ok', badge: 'page + bestsellers' }, catalog, reviews, { ...breaker, status: 'hot', badge: 'OPEN · use fallback' }, { ...recs, status: 'down', sub: 'restarting' }],
        links: [...guarded.slice(0, 5), { from: 'breaker', to: 'recs', style: 'faint' }],
        flows: [
          { path: ['users', 'web', 'api'], tone: 'request', duration: 1.3 },
          { path: ['api', 'breaker'], tone: 'request', duration: 0.7, delay: 1.3 },
          { path: ['breaker', 'api'], tone: 'data', label: 'bestsellers list', duration: 0.7, delay: 2.1 },
          { path: ['api', 'web', 'users'], tone: 'response', label: '200 OK', duration: 1.3, delay: 2.9 },
        ],
        caption: 'The shopper gets a full page with a plainer last row',
      },
    },
    {
      title: 'Bulkheads',
      tag: 'concept',
      heading: 'Bulkheads: a fixed share for each dependency',
      eli5: 'New rule: only three waiters may ever stand at the dessert counter. A fourth one turns back straight away. However slow dessert gets, the other waiters keep serving. That rule is a **bulkhead**.',
      body: [
        'A breaker reacts after it has seen failures. With a 10 second window, the first seconds of an outage still hit the shared pool. A **bulkhead** is a limit that holds all the time, before any failure is counted. The name comes from the walls that split a ship\'s hull into sealed compartments, so one leak floods one section.',
        'Give each dependency its own budget of concurrent calls: a semaphore, or a dedicated thread pool. Recommendations normally uses about 12 threads, so cap it at **20**. When 20 calls are in flight, call 21 is rejected at once and takes the fallback.',
        'Now a full hang in recommendations can hold 20 threads and no more. The other 180 keep serving catalog and reviews. The cost is that each compartment can run out on its own during a legitimate burst, so size them from measured concurrency with some headroom.',
      ],
      keyIdea: 'A bulkhead caps how much of your capacity one dependency can ever hold, so its worst day costs you a fixed, small slice.',
      metrics: { threads: '35 / 200', p99: '190 ms', ok: '100%', recs: '20 in flight max' },
      scene: {
        nodes: [users, web, { ...api, status: 'ok', badge: 'recs 20/20 · others 15/180' }, { ...catalog, status: 'ok' }, { ...reviews, status: 'ok' }, { ...breaker, label: 'bulkhead', status: 'active', badge: 'max 20 in flight' }, { ...recs, status: 'hot', sub: 'hanging' }],
        links: guarded,
        flows: [
          { path: ['api', 'breaker', 'recs'], tone: 'request', label: '20 allowed', count: 2, duration: 1.4 },
          { path: ['api', 'breaker'], tone: 'request', count: 3, duration: 0.7, delay: 0.5 },
          { path: ['breaker', 'api'], tone: 'error', label: 'full: fallback', count: 3, duration: 0.7, delay: 1.3 },
          { path: ['api', 'catalog', 'api'], tone: 'response', duration: 1.6, delay: 0.3 },
          { path: ['api', 'reviews', 'api'], tone: 'response', duration: 1.6, delay: 0.5 },
        ],
        caption: 'The hang is sealed inside a 20-thread compartment',
      },
      code: {
        language: 'python',
        title: 'Bulkhead outside, breaker inside, fallback for both',
        source: `import threading

recs_slots = threading.BoundedSemaphore(20)       # at most 20 calls in flight
recs_breaker = CircuitBreaker(max_failures=5, cooldown=30)

def get_recs(user_id):
    if not recs_slots.acquire(blocking=False):    # compartment full: do not queue
        return BESTSELLERS
    try:
        return recs_breaker.call(
            lambda: recs_client.get(user_id, timeout=1.0),
            fallback=lambda: BESTSELLERS,
        )
    finally:
        recs_slots.release()`,
        highlight: [3, 7, 8, 10, 15],
      },
    },
    {
      title: 'Pool isolation',
      tag: 'case',
      heading: 'Case: the report that used every database connection',
      eli5: 'The kitchen has one sink. A helper washing a giant pot blocks it for ages, and no one can rinse a plate. Give the big pots their own small sink, and the plates never have to wait.',
      body: [
        'Bulkheads apply to any shared pool. The product API and a nightly report job share one Postgres connection pool of 50. The report runs wide queries that take 30 seconds each, and one night it starts 50 of them in parallel.',
        'Every connection is busy for 30 seconds. Product page queries that take 5 ms now wait in line for a connection and time out. The database CPU is fine. The pool is what ran out.',
        'The fix is two pools: **40 connections** for page queries and **10** for reports. The report job can saturate its 10 and only slows itself. The same idea covers separate worker pools per queue, per-tenant rate limits, and separate clusters for critical and batch traffic.',
      ],
      keyIdea: 'Anything shared is a way for one workload to starve another. Split the pool along the line you want failures to stop at.',
      metrics: { threads: '27 / 200', p99: '180 ms', ok: '100%', recs: '300/s' },
      scene: {
        nodes: [
          { ...api, status: 'ok', badge: 'pool A: 12 / 40' },
          { ...reportJob, status: 'hot', badge: 'pool B: 10 / 10' },
          { ...pg, status: 'ok' },
        ],
        links: [
          { from: 'api', to: 'pg', label: '40 conns' },
          { from: 'reports', to: 'pg', label: '10 conns' },
        ],
        flows: [
          { path: ['api', 'pg', 'api'], tone: 'response', label: '5 ms', count: 3, duration: 1.4 },
          { path: ['reports', 'pg'], tone: 'request', label: 'wide scan', count: 2, duration: 3 },
        ],
        caption: 'The slow workload can only fill its own pool',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Refuse to wait, and wall things off',
      eli5: 'A sign on the broken counter, a spare treat to offer, and a rule about how many waiters may queue in one place. With those three, one slow cook cannot stop the whole restaurant.',
      body: [
        'A slow dependency ties up its callers, and they tie up theirs. A **circuit breaker** counts failures and slow calls while **closed**, rejects instantly while **open**, and tests with a few probes while **half-open**. Trip on a failure rate over a window with a minimum volume.',
        'A **fallback** decides what the user sees in the meantime. A **bulkhead** gives each dependency a fixed share of threads or connections, so it holds even in the seconds before the breaker reacts. Timeouts, retries with budgets, breakers and bulkheads are meant to be used together.',
      ],
      keyIdea: 'Timeouts bound one call, breakers stop a stream of bad calls, and bulkheads bound the blast radius.',
      metrics: { threads: '27 / 200', p99: '180 ms', ok: '100%', recs: '300/s' },
      scene: {
        nodes: [users, web, { ...api, status: 'ok' }, { ...catalog, status: 'ok' }, { ...reviews, status: 'ok' }, { ...breaker, status: 'ok', badge: 'closed' }, { ...recs, status: 'ok' }],
        links: guarded,
        flows: [
          { path: ['users', 'web', 'api'], tone: 'request', count: 2, duration: 1.4 },
          { path: ['api', 'catalog', 'api'], tone: 'response', duration: 1.6, delay: 1.4 },
          { path: ['api', 'reviews', 'api'], tone: 'response', duration: 1.6, delay: 1.5 },
          { path: ['api', 'breaker', 'recs', 'breaker', 'api'], tone: 'response', duration: 2.2, delay: 1.6 },
          { path: ['api', 'web', 'users'], tone: 'response', count: 2, duration: 1.4, delay: 3.9 },
        ],
      },
      quiz: {
        question: 'A service has a 1 s timeout and a breaker on a dependency. During the first few seconds of a hang, before the breaker has enough data to open, its shared thread pool fills up. What was missing?',
        options: [
          'A longer cool-down in the open state',
          'More retries on the failing call',
          'A bulkhead capping concurrent calls to that dependency',
          'A larger rolling window on the breaker',
        ],
        answer: 2,
        explain: 'A breaker needs a window of failures before it trips. A bulkhead is a limit that always applies, so the hang can only hold its own small slice of threads while the breaker makes up its mind.',
      },
    },
  ],
};
