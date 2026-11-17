import type { Lesson, SceneNode } from '../engine/types';

/** Place a node by screen column and screen row, so nodes in different columns never overlap. */
const P = (col: number, row: number): [number, number] => [(col + row) / 2, (row - col) / 2];

const client: SceneNode = { id: 'client', kind: 'client', at: P(-7, 0), label: 'browser' };
const app: SceneNode = { id: 'app', kind: 'server', at: P(-3.5, 0), label: 'app server' };
const cache: SceneNode = { id: 'cache', kind: 'cache', at: P(0, -3.2), label: 'Redis' };
const svc: SceneNode = { id: 'svc', kind: 'service', at: P(0, 3.2), label: 'pricing service' };
const db: SceneNode = { id: 'db', kind: 'db', at: P(3.5, 0), label: 'Postgres' };
const queue: SceneNode = { id: 'queue', kind: 'queue', at: P(3.5, 4.8), label: 'job queue' };
const worker: SceneNode = { id: 'worker', kind: 'worker', at: P(7, 4.8), label: 'worker' };
const ext: SceneNode = { id: 'ext', kind: 'internet', at: P(7, -3.2), label: 'email provider' };

export const performanceAntipatterns: Lesson = {
  id: 'performance-antipatterns',
  title: 'Performance antipatterns clinic',
  tagline: 'Eight common mistakes that make healthy systems slow under load, each with its symptom and its fix.',
  minutes: 15,
  level: 'Intermediate',
  learn: [
    'How to spot N+1 queries and chatty calls in a trace',
    'Caching that helps, and caching that serves wrong data',
    'Bounding every result set with pagination',
    'Moving slow side work onto a queue',
    'Hot shared locks, missing connection pools and retry storms',
  ],
  metrics: [
    { key: 'p99', label: 'Page p99' },
    { key: 'calls', label: 'Calls per page' },
    { key: 'dbcpu', label: 'DB CPU' },
    { key: 'errors', label: 'Errors' },
  ],
  steps: [
    {
      title: 'The patient',
      tag: 'problem',
      heading: 'Fast on a laptop, slow in production',
      eli5: 'A shopper is quick at an empty corner shop. In a busy supermarket the same habits, one trip per item and waiting at every counter, make the trip take all day.',
      body: [
        'The order history page loads in 80 ms on a developer laptop with 10 test orders. In production, with real customers who have hundreds of orders and 1,500 requests per second, it takes **3.2 seconds** at p99 and the database CPU is at 90%.',
        'Nothing is broken. No single line is wrong. The code makes choices that cost nothing with small data and one user and grow costly with real data and real concurrency. These are **performance antipatterns**, and most slow systems have several at once.',
        'This lesson is a clinic. Each step shows one antipattern, the symptom it leaves in metrics and traces, and the usual fix. The observability lesson gave us the tools to find them.',
      ],
      keyIdea: 'Most slowness comes from a handful of known patterns that hide at small scale and surface under load.',
      metrics: { p99: '3.2 s', calls: '312', dbcpu: '90%', errors: '1.5%' },
      scene: {
        nodes: [{ ...client, status: 'hot', badge: '3.2 s' }, { ...app, status: 'hot' }, { ...svc, status: 'hot' }, { ...db, status: 'hot', badge: 'CPU 90%' }],
        links: [
          { from: 'client', to: 'app' },
          { from: 'app', to: 'svc' },
          { from: 'app', to: 'db' },
        ],
        flows: [
          { path: ['client', 'app'], tone: 'request', label: 'GET /orders', duration: 1 },
          { path: ['app', 'db'], tone: 'request', count: 6, duration: 1, delay: 1 },
          { path: ['app', 'svc'], tone: 'request', count: 6, duration: 1, delay: 1.3 },
          { path: ['app', 'client'], tone: 'response', label: 'finally', duration: 1.6, delay: 2.8 },
        ],
        caption: 'One page view, hundreds of calls behind it',
      },
    },
    {
      title: 'N+1 queries',
      tag: 'case',
      heading: 'Antipattern 1: one query per row',
      eli5: 'The shopper drives to the **database** store once for the list, then once more for each of the 50 items on it. Fifty-one trips, when one trip with the whole list would do.',
      body: [
        'The page loads 50 orders with one query, then loops over them and loads each order\'s items with another query. That is **N+1 queries**: 1 for the list plus N for the rows. ORMs make this easy to write by accident, because `order.items` looks like a field and quietly runs a query.',
        'Each query is fast, about 1 ms, plus a network round trip. Fifty-one of them cost 100 ms or more per page, and at 1,500 pages per second the database answers 76,000 tiny queries per second. In a trace it shows as a ladder of identical short spans.',
        'The fix is to fetch related rows in one query: a join, or `WHERE order_id IN (...)` for the whole batch. Most ORMs offer eager loading for this. Two queries per page instead of 51.',
      ],
      keyIdea: 'If a trace shows the same query repeated once per row, batch it into one query.',
      metrics: { p99: '1.9 s', calls: '312 to 263', dbcpu: '55%', errors: '1.5%' },
      scene: {
        nodes: [client, { ...app, status: 'active', badge: 'loop of 50' }, { ...db, status: 'hot', badge: '51 queries' }],
        links: [
          { from: 'client', to: 'app' },
          { from: 'app', to: 'db' },
        ],
        flows: [
          { path: ['app', 'db'], tone: 'request', label: 'SELECT orders', duration: 0.9 },
          { path: ['app', 'db'], tone: 'request', label: 'SELECT items WHERE order_id = ?', count: 8, duration: 0.9, delay: 1 },
          { path: ['db', 'app'], tone: 'response', count: 8, duration: 0.9, delay: 1.5 },
        ],
        caption: 'A ladder of identical small queries',
      },
      code: {
        language: 'python',
        title: 'N+1 and its fix',
        source: `# Antipattern: 1 query for orders + 1 query per order
orders = db.query("SELECT * FROM orders WHERE user_id = %s LIMIT 50", uid)
for o in orders:
    o.items = db.query("SELECT * FROM items WHERE order_id = %s", o.id)

# Fix: 2 queries total, whatever the number of orders
orders = db.query("SELECT * FROM orders WHERE user_id = %s LIMIT 50", uid)
ids = [o.id for o in orders]
rows = db.query("SELECT * FROM items WHERE order_id = ANY(%s)", ids)
by_order = {}
for r in rows:
    by_order.setdefault(r.order_id, []).append(r)
for o in orders:
    o.items = by_order.get(o.id, [])`,
        highlight: [3, 4, 9],
      },
    },
    {
      title: 'Chatty calls',
      tag: 'case',
      heading: 'Antipattern 2: chatty calls between services',
      eli5: 'At the **pricing** counter the shopper asks the price of one item, waits, then asks about the next, 50 times. Handing over the whole list at once takes one short wait.',
      body: [
        'The same loop also calls the pricing service once per item to get the current price. Between services every call costs a network round trip, serialization and a hop through any proxies, typically 1 to 5 ms even when the work itself is trivial.',
        '**Chatty I/O** is the service version of N+1: many small requests where one larger request would do. Done one after another, 200 calls at 3 ms add 600 ms to the page. Done in parallel, they flood the other service with connections.',
        'Add a batch endpoint (`POST /prices` with a list of ids) or fetch everything a page needs in one call. When you design an API, think about how it will be called in a loop. A gateway or aggregation layer can also combine calls for clients.',
      ],
      keyIdea: 'Network calls have a fixed cost per call. Send fewer, larger requests.',
      metrics: { p99: '1.2 s', calls: '263 to 63', dbcpu: '55%', errors: '1.5%' },
      scene: {
        nodes: [client, { ...app, status: 'active' }, { ...svc, status: 'hot', badge: '200 calls/page' }, db],
        links: [
          { from: 'client', to: 'app' },
          { from: 'app', to: 'svc' },
          { from: 'app', to: 'db' },
        ],
        flows: [
          { path: ['app', 'svc'], tone: 'request', label: 'GET /price/17', count: 8, duration: 0.9 },
          { path: ['svc', 'app'], tone: 'response', count: 8, duration: 0.9, delay: 0.5 },
          { path: ['app', 'svc'], tone: 'request', label: 'POST /prices [200 ids]', duration: 1.2, delay: 2.4 },
          { path: ['svc', 'app'], tone: 'response', label: 'one reply', duration: 1.2, delay: 3.7 },
        ],
        caption: 'Many small round trips, then one batched call',
      },
    },
    {
      title: 'Cache mistakes',
      tag: 'case',
      heading: 'Antipattern 3: no cache, or a cache that lies',
      eli5: 'The shopper asks the clerk for the opening hours every single visit. A note on the fridge, the **cache**, saves the trip. But a note never updated sends you to a closed shop.',
      body: [
        'Every page reads the same product names and the same shipping rules from the database, values that change a few times a day. With **no caching**, the database answers the same question thousands of times per second. A cache-aside read with a TTL removes most of that load.',
        'The opposite mistake is a **cache without invalidation**. A team caches prices with no TTL and no delete on update. A price change then shows the old price for days, and customers are charged one number while seeing another. Stale data is a correctness bug, and it is harder to notice than slowness.',
        'The caching lesson covers the details: cache data that is read far more than written, delete the key on write, and put a TTL on every key as a safety net.',
      ],
      keyIdea: 'Cache what is read often and changes rarely, and give every cached value a way to become fresh again.',
      metrics: { p99: '700 ms', calls: '63', dbcpu: '25%', errors: '1.5%' },
      scene: {
        nodes: [client, { ...app, status: 'active' }, { ...cache, status: 'ok', badge: 'hit 95%, TTL 300 s' }, { ...db, status: 'ok', badge: 'DEL on write' }],
        links: [
          { from: 'client', to: 'app' },
          { from: 'app', to: 'cache' },
          { from: 'app', to: 'db' },
        ],
        flows: [
          { path: ['app', 'cache'], tone: 'request', label: 'GET shipping_rules', count: 3, duration: 0.9 },
          { path: ['cache', 'app'], tone: 'response', count: 3, duration: 0.9, delay: 1 },
          { path: ['app', 'db'], tone: 'request', label: 'UPDATE price', duration: 1, delay: 2.1 },
          { path: ['app', 'cache'], tone: 'event', label: 'DEL price:42', duration: 0.9, delay: 3.2 },
        ],
        caption: 'Hits for the hot data, and a delete on every write',
      },
    },
    {
      title: 'Unbounded',
      tag: 'case',
      heading: 'Antipattern 4: unbounded result sets',
      eli5: 'Asking the store to bring you every item it sells, when you only wanted to see the first shelf. The trolley gets so heavy that nobody else can use the aisle.',
      body: [
        'The export endpoint runs `SELECT * FROM orders WHERE merchant_id = ?` with no limit. For most merchants that is a few hundred rows. One large merchant has 4 million. The query scans for 20 seconds, the app loads 3 GB into memory and is killed, and the retry does it again.',
        'An **unbounded result set** is any query or API whose response size is decided by the data instead of by the caller. It works until the biggest customer shows up. `SELECT *` makes it worse by pulling columns nobody reads.',
        'Put a limit on everything that returns a list, enforced on the server: default 50, maximum 500. Use **keyset pagination** (`WHERE id > last_seen ORDER BY id LIMIT 50`) so page 10,000 is as cheap as page 1. Large exports become a background job that writes a file.',
      ],
      keyIdea: 'Every query and every list endpoint needs a server-enforced maximum size.',
      metrics: { p99: '700 ms', calls: '63', dbcpu: '25%', errors: '0.4%' },
      scene: {
        nodes: [{ ...client, label: 'merchant' }, { ...app, status: 'down', badge: 'out of memory' }, { ...db, status: 'hot', badge: '4M rows' }],
        links: [
          { from: 'client', to: 'app' },
          { from: 'app', to: 'db' },
        ],
        flows: [
          { path: ['client', 'app'], tone: 'request', label: 'GET /orders/export', duration: 1 },
          { path: ['app', 'db'], tone: 'request', label: 'SELECT * (no LIMIT)', duration: 1, delay: 1.1 },
          { path: ['db', 'app'], tone: 'data', label: '3 GB', count: 6, duration: 2, delay: 2.2 },
          { path: ['app', 'client'], tone: 'error', label: '502', duration: 1, delay: 4.3 },
        ],
        caption: 'The response size is set by the data, and the data grew',
      },
      code: {
        language: 'sql',
        title: 'Offset paging versus keyset paging',
        source: `-- Antipattern: no bound at all
SELECT * FROM orders WHERE merchant_id = 7;

-- Better, but OFFSET still scans and discards 500,000 rows
SELECT id, total, created_at FROM orders
WHERE merchant_id = 7
ORDER BY id
LIMIT 50 OFFSET 500000;

-- Keyset: jump straight to the next page using an index
-- on (merchant_id, id). Page 10,000 costs the same as page 1.
SELECT id, total, created_at FROM orders
WHERE merchant_id = 7 AND id > 9182733     -- last id the client saw
ORDER BY id
LIMIT 50;`,
        highlight: [2, 8, 13, 15],
      },
    },
    {
      title: 'Do it later',
      tag: 'case',
      heading: 'Antipattern 5: slow work inside the request',
      eli5: 'At checkout the cashier stops to bake your birthday cake while the whole line waits. Better to take the order, give you a ticket, and let the bakery in the back, the **worker**, bake it.',
      body: [
        'Placing an order saves the order, then sends a confirmation email through an external provider, generates a PDF invoice and updates analytics, all before replying. The email provider takes 800 ms on a good day and 10 seconds on a bad one. The customer waits for all of it, and if the provider is down, checkout fails.',
        'Work the user does not need to see right away should not sit on the request path. Save the order, put a message on a **queue**, and return. A **worker** sends the email and builds the invoice a second later, retrying on its own if the provider fails.',
        'Checkout drops from 1.4 s to 120 ms and no longer depends on the email provider being up. The cost is a little more machinery and **eventual** completion: the email arrives a few seconds later, which nobody notices.',
      ],
      keyIdea: 'Reply as soon as the essential write is safe. Hand everything else to a queue.',
      metrics: { p99: '400 ms', calls: '63', dbcpu: '25%', errors: '0.4%' },
      scene: {
        nodes: [
          client,
          { ...app, status: 'ok', badge: 'reply in 120 ms' },
          db,
          { ...queue, status: 'active', badge: 'send_email, invoice' },
          { ...worker, status: 'active' },
          { ...ext, badge: '800 ms to 10 s' },
        ],
        links: [
          { from: 'client', to: 'app' },
          { from: 'app', to: 'db' },
          { from: 'app', to: 'queue' },
          { from: 'queue', to: 'worker' },
          { from: 'worker', to: 'ext' },
        ],
        flows: [
          { path: ['client', 'app', 'db'], tone: 'request', label: 'place order', duration: 1.4 },
          { path: ['app', 'queue'], tone: 'event', label: 'enqueue', duration: 1, delay: 1.5 },
          { path: ['app', 'client'], tone: 'response', label: '201', duration: 1, delay: 1.6 },
          { path: ['queue', 'worker', 'ext'], tone: 'event', label: 'email', duration: 1.8, delay: 2.7 },
        ],
        caption: 'The customer waits for the order, not for the email',
      },
      quiz: {
        question: 'A trace of the order history page shows 50 identical 2 ms spans named "SELECT items", one after another. What is the fix?',
        options: [
          'Add an index on items.order_id',
          'Load the items for all 50 orders in one query',
          'Move the page onto a background queue',
          'Add more database replicas',
        ],
        answer: 1,
        explain: 'Repeated identical queries per row are N+1. The queries are already fast, so an index or replicas barely help. Batching them into one query removes 49 round trips.',
      },
    },
    {
      title: 'Hot lock',
      tag: 'case',
      heading: 'Antipattern 6: everyone waits on one lock',
      eli5: 'Every cashier has to write each sale in one shared notebook with one pen. More cashiers do not help, because they all queue for the pen.',
      body: [
        'Each order increments a global counter row, `UPDATE stats SET orders_today = orders_today + 1`. Row updates take a lock until the transaction commits. Every checkout in the shop now queues for the same row, so throughput is capped by how fast one row can be locked and released, no matter how many servers you add.',
        'A **hot shared lock** looks like low CPU and high latency at once: requests are waiting, not working. The same pattern appears with a global mutex in app code, a single stock row for a viral product, or a sequence table used for ids.',
        'Fixes split the contention. Keep N counter rows and add to a random one, summing on read. Buffer increments in memory or Redis and flush every second. Shorten the transaction so the lock is held for less time. Or ask whether the number needs to be exact and live at all.',
      ],
      keyIdea: 'When latency is high and CPU is low, look for something every request has to take in turn.',
      metrics: { p99: '400 ms', calls: '63', dbcpu: '30%, lock waits', errors: '0.4%' },
      scene: {
        nodes: [client, { ...app, status: 'hot', badge: '300 waiting' }, { ...db, status: 'hot', badge: 'row lock: stats' }, { ...cache, status: 'ok', badge: 'INCR, flush 1 s' }],
        links: [
          { from: 'client', to: 'app' },
          { from: 'app', to: 'db' },
          { from: 'app', to: 'cache' },
          { from: 'cache', to: 'db', style: 'dashed', label: 'batched' },
        ],
        flows: [
          { path: ['app', 'db'], tone: 'request', label: 'UPDATE stats +1', count: 6, duration: 2.6 },
          { path: ['app', 'cache'], tone: 'request', label: 'INCR', count: 4, duration: 0.8, delay: 2.8 },
          { path: ['cache', 'db'], tone: 'data', label: '+812 once', duration: 1.2, delay: 3.8 },
        ],
        caption: 'Thousands of writers queue for one row',
      },
    },
    {
      title: 'No pool',
      tag: 'case',
      heading: 'Antipattern 7: a new connection for every request',
      eli5: 'Every shopper builds a new trolley at the door and throws it away at the till. A rack of shared trolleys, a **pool**, would save all that building.',
      body: [
        'A script-style handler opens a database connection, runs one query and closes it. Opening a connection means a TCP handshake, a TLS handshake and authentication: often 5 to 20 ms before the first query. Postgres also starts a process per connection, so 1,500 new connections per second burns database CPU on setup alone.',
        'A **connection pool** keeps, say, 20 connections open per app server and lends one to each request. Setup happens once. The pool also caps concurrency, so a burst of traffic queues in the app instead of opening 3,000 connections and pushing the database past its connection limit.',
        'Size the pool on purpose. Too small and requests wait for a slot, which is the saturation the observability lesson found. Too large across 40 app servers and the database runs out of connections. A pooler in front of the database helps when many processes share it.',
      ],
      keyIdea: 'Reuse connections through a pool sized to what the database can actually run at once.',
      metrics: { p99: '250 ms', calls: '63', dbcpu: '20%', errors: '0.2%' },
      scene: {
        nodes: [client, { ...app, status: 'ok', badge: 'pool: 20 open' }, { ...db, status: 'ok', badge: '0 new connections/s' }],
        links: [
          { from: 'client', to: 'app' },
          { from: 'app', to: 'db', label: 'reused' },
        ],
        flows: [
          { path: ['client', 'app'], tone: 'request', count: 4, duration: 0.9 },
          { path: ['app', 'db'], tone: 'handshake', label: 'TCP + TLS + auth (once)', duration: 1.2, delay: 0.2 },
          { path: ['app', 'db'], tone: 'request', label: 'query', count: 4, duration: 0.9, delay: 1.6 },
          { path: ['db', 'app'], tone: 'response', count: 4, duration: 0.9, delay: 2.6 },
        ],
        caption: 'Handshake once, then reuse',
      },
    },
    {
      title: 'Retry storm',
      tag: 'case',
      heading: 'Antipattern 8: retries that pile on',
      eli5: 'The door sticks for a moment. Every shopper pushes again right away, and again, until the crowd at the door is three times bigger and nobody gets in.',
      body: [
        'The pricing service slows down for 30 seconds. Callers time out and retry at once, three times each. Its load goes from 1,500 to 6,000 requests per second exactly when it can handle the least. It cannot recover while the load is four times normal, so a short blip becomes a long outage. That is a **retry storm**.',
        'Retries multiply through layers, too. If the browser, the app and a client library each retry three times (four attempts per layer), one click can become 4 × 4 × 4 = 64 calls to the struggling service.',
        'Retry only in one layer, only on errors that may pass, and with **exponential backoff plus jitter** so callers spread out. Cap the total with a **retry budget** (say retries may add at most 10% to traffic) and stop calling a failing service for a while with a circuit breaker.',
      ],
      keyIdea: 'Retries add load at the worst moment. Back off with jitter, retry in one layer and cap the total.',
      metrics: { p99: '250 ms', calls: '63', dbcpu: '20%', errors: '0.2%' },
      scene: {
        nodes: [client, { ...app, status: 'hot', badge: '3 retries each' }, { ...svc, status: 'down', badge: '6,000 req/s, 4x' }],
        links: [
          { from: 'client', to: 'app' },
          { from: 'app', to: 'svc' },
        ],
        flows: [
          { path: ['client', 'app'], tone: 'request', count: 3, duration: 0.9 },
          { path: ['app', 'svc'], tone: 'request', count: 6, duration: 1, delay: 0.9 },
          { path: ['svc', 'app'], tone: 'error', label: 'timeout', count: 3, duration: 1, delay: 2 },
          { path: ['app', 'svc'], tone: 'request', label: 'retry now', count: 8, duration: 1, delay: 3.1 },
        ],
        caption: 'Instant retries quadruple the load on a struggling service',
      },
      code: {
        language: 'python',
        title: 'Backoff with full jitter and a retry budget',
        source: `import random, time

BASE, CAP, ATTEMPTS = 0.1, 2.0, 3          # seconds

def call_with_retry(fn):
    for attempt in range(ATTEMPTS):
        try:
            return fn()
        except (TimeoutError, ServiceUnavailable):
            if attempt == ATTEMPTS - 1 or not budget.allow_retry():
                raise                       # give up, do not pile on
            # full jitter: wait a random time up to the backoff ceiling
            ceiling = min(CAP, BASE * 2 ** attempt)
            time.sleep(random.uniform(0, ceiling))

# budget.allow_retry() returns False once retries exceed
# 10% of recent requests, so a storm cannot build up.`,
        highlight: [10, 13, 14],
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Eight patterns, one way of finding them',
      eli5: 'The shopper now takes the whole list in one trip, keeps fresh notes on the fridge, pays for the cake and picks it up later, uses the shared trolleys, and waits a moment before pushing a stuck door again.',
      body: [
        'Batch the **N+1 queries** and the **chatty calls**. Cache data that is read often, and invalidate it on writes. Put a server-side limit on every **result set**. Move slow side work onto a **queue**. Split **hot locks**, reuse connections through a **pool**, and retry with backoff, jitter and a budget.',
        'Each one leaves a signature: repeated spans, identical queries, memory spikes, high latency with low CPU, load that rises when a dependency slows. Measure first with traces and the golden signals, fix the largest one, and measure again. The order history page went from 3.2 s to 250 ms and the database from 90% CPU to 20%.',
      ],
      keyIdea: 'Find the pattern in the traces, fix the biggest one, and measure again before touching the next.',
      metrics: { p99: '250 ms', calls: '63', dbcpu: '20%', errors: '0.2%' },
      scene: {
        nodes: [{ ...client, status: 'ok', badge: '250 ms' }, { ...app, status: 'ok' }, { ...cache, status: 'ok' }, { ...svc, status: 'ok' }, { ...db, status: 'ok' }, queue, worker],
        links: [
          { from: 'client', to: 'app' },
          { from: 'app', to: 'cache' },
          { from: 'app', to: 'svc' },
          { from: 'app', to: 'db' },
          { from: 'app', to: 'queue' },
          { from: 'queue', to: 'worker' },
        ],
        flows: [
          { path: ['client', 'app'], tone: 'request', duration: 0.9 },
          { path: ['app', 'cache', 'app'], tone: 'response', duration: 1.2, delay: 1 },
          { path: ['app', 'db', 'app'], tone: 'request', duration: 1.4, delay: 1.2 },
          { path: ['app', 'queue', 'worker'], tone: 'event', duration: 1.6, delay: 2 },
          { path: ['app', 'client'], tone: 'response', duration: 0.9, delay: 2.7 },
        ],
      },
      quiz: {
        question: 'Checkout latency is high, app and database CPU are both low, and adding app servers changes nothing. Which antipattern fits best?',
        options: [
          'N+1 queries',
          'A hot shared lock that every request must take in turn',
          'No caching',
          'Unbounded result sets',
        ],
        answer: 1,
        explain: 'Low CPU with high latency means requests are waiting, not working, and more servers only add more waiters for the same lock. N+1, missing caches and huge result sets all show up as busy CPU or memory.',
      },
    },
  ],
};
