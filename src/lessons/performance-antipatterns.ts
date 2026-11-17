import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const client: SceneNode = { id: 'client', kind: 'client', at: at(-6, 0), label: 'browser' };
const app: SceneNode = { id: 'app', kind: 'server', at: at(-2, 0), label: 'app server' };
const db: SceneNode = { id: 'db', kind: 'db', at: at(2.5, 0), label: 'Postgres' };
const cache: SceneNode = { id: 'cache', kind: 'cache', at: at(6, -3.4), label: 'Redis' };
const svc: SceneNode = { id: 'svc', kind: 'block', size: 0.8, at: at(2.5, 3.8), label: 'pricing service', icon: 'Receipt', tint: 'violet' };
const monitor: SceneNode = { id: 'monitor', kind: 'monitor', at: at(6, -3.4), label: 'traces' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

export const performanceAntipatterns: Lesson = {
  id: 'performance-antipatterns',
  title: 'Performance antipatterns clinic (part 1)',
  tagline: 'Common mistakes that make healthy systems slow under load, each with its symptom and its fix. Part 1 covers finding them, query patterns, chatty calls, caching and result size.',
  minutes: 15,
  level: 'Intermediate',
  learn: [
    'How to find the biggest problem first, with metrics and traces',
    'N+1 queries, chatty calls and extraneous fetching',
    'Missing indexes and full table scans',
    'Caching that helps, caching that lies, and the stampede on expiry',
    'Bounding every result set with limits and keyset pagination',
  ],
  metrics: [
    { key: 'p99', label: 'Page p99', icon: 'Timer' },
    { key: 'calls', label: 'Calls per page', icon: 'Repeat' },
    { key: 'dbcpu', label: 'DB CPU', icon: 'Cpu' },
    { key: 'errors', label: 'Errors', icon: 'Bug' },
  ],
  steps: [
    {
      title: 'The patient',
      tag: 'problem',
      heading: 'Fast on a laptop, slow in production',
      eli5: 'A shopper is quick at an empty corner shop. In a busy supermarket the same habits, one trip per item and waiting at every counter, make the trip take all day.',
      body: [
        'The order history page loads in 80 ms on a laptop with 10 test orders. In production, with customers who have hundreds of orders and 1,500 requests per second, p99 is **3.2 seconds** and the database CPU is at 90%.',
        'Nothing is broken and no single line is wrong. The code makes choices that cost nothing at small scale and grow costly with real data and real concurrency. These are **performance antipatterns**.',
      ],
      keyIdea: 'Most slowness comes from a handful of known patterns that hide at small scale and surface under load.',
      metrics: { p99: '3.2 s', calls: '312', dbcpu: '90%', errors: '1.5%' },
      metricTones: { p99: 'bad', calls: 'bad', dbcpu: 'bad', errors: 'warn' },
      scene: {
        nodes: [
          { ...client, chips: [{ text: 'GET /orders', tone: 'warn' }] },
          { ...app, status: 'hot', load: 88 },
          { ...db, status: 'hot', load: 90, badge: '76,000 queries/s' },
        ],
        links: [link('client', 'app', { label: 'p99 3.2 s', labelTone: 'warn' }), link('app', 'db')],
        flows: [
          { path: ['client', 'app'], tone: 'request', label: 'GET /orders', duration: 1 },
          { path: ['app', 'db'], tone: 'request', count: 6, duration: 1, delay: 1 },
          { path: ['app', 'client'], tone: 'response', label: 'finally', duration: 1.6, delay: 2.8 },
        ],
        panel: {
          title: 'Same page, two worlds',
          icon: 'Gauge',
          rows: [
            { text: 'Laptop, 10 orders', value: '80 ms', tone: 'good' },
            { text: 'Production, p99', value: '3.2 s', tone: 'bad' },
            { text: 'Traffic', value: '1,500 req/s' },
            { text: 'DB CPU', value: '90%', tone: 'bad' },
          ],
        },
        caption: 'One page view, hundreds of calls behind it',
      },
    },
    {
      title: 'Measure first',
      tag: 'concept',
      heading: 'Find the biggest problem before fixing anything',
      eli5: 'Before changing how the shopper shops, the manager watches the shopper with a stopwatch. The **traces** show which part of the trip eats the time.',
      body: [
        'Start with the golden signals (latency, traffic, errors, saturation) to see which service hurts. Then open a **trace** of one slow request to see where its time goes.',
        'Each antipattern leaves a signature in the data. Fix the biggest one, then measure again, because the next bottleneck is often a different one.',
      ],
      keyIdea: 'Measure, fix the largest cost, measure again. Guessing wastes weeks.',
      metrics: { p99: '3.2 s', calls: '312', dbcpu: '90%', errors: '1.5%' },
      metricTones: { p99: 'bad', dbcpu: 'bad' },
      scene: {
        nodes: [{ ...app, status: 'active' }, { ...db, status: 'hot', load: 90 }, { ...monitor, status: 'active', badge: 'slow trace' }],
        links: [link('app', 'db'), link('app', 'monitor', { style: 'dashed', label: 'spans' })],
        flows: [
          { path: ['app', 'monitor'], tone: 'event', label: 'spans', count: 3, duration: 1.2 },
          { path: ['app', 'db', 'app'], tone: 'request', duration: 1.4, delay: 1.3 },
        ],
        panel: {
          title: 'What each pattern looks like',
          icon: 'Search',
          rows: [
            { text: 'Ladder of identical spans', value: 'N+1, chatty' },
            { text: 'One slow query span', value: 'index, scan' },
            { text: 'Memory spike', value: 'unbounded' },
            { text: 'Slow, but CPU low', value: 'lock, I/O wait' },
            { text: 'Load rises as a dependency slows', value: 'retry storm' },
          ],
        },
        caption: 'Read the signature, then pick the fix',
      },
    },
    {
      title: 'N+1 queries',
      tag: 'case',
      heading: 'Antipattern 1: one query per row',
      eli5: 'The shopper drives to the **database** store once for the list, then once more for each of the 50 items on it. Fifty-one trips, when one trip with the whole list would do.',
      body: [
        'The page loads 50 orders with one query, then loops over them and loads each order\'s items with another query. That is **N+1 queries**: 1 for the list plus N for the rows.',
        'ORMs make this easy to write by accident, because `order.items` looks like a field and quietly runs a query.',
      ],
      keyIdea: 'A loop that runs a query per row is N+1, and the ORM can hide it.',
      metrics: { p99: '3.2 s', calls: '312', dbcpu: '90%', errors: '1.5%' },
      metricTones: { calls: 'bad' },
      scene: {
        nodes: [{ ...app, status: 'active', badge: 'loop of 50' }, { ...db, status: 'hot', badge: '51 queries' }],
        links: [link('app', 'db', { arrow: 'both' })],
        flows: [
          { path: ['app', 'db'], tone: 'request', label: 'SELECT orders', duration: 0.9 },
          { path: ['app', 'db'], tone: 'request', label: 'SELECT items WHERE order_id = ?', count: 8, duration: 0.9, delay: 1 },
          { path: ['db', 'app'], tone: 'response', count: 8, duration: 0.9, delay: 1.5 },
        ],
        panel: {
          title: 'One page view',
          icon: 'List',
          code: 'orders = SELECT ... LIMIT 50      -- 1\nfor o in orders:\n  items = SELECT ... WHERE order_id = o.id  -- x50',
          footer: { text: '51 queries for one page', tone: 'bad' },
        },
        caption: 'A loop that calls the database every turn',
      },
    },
    {
      title: 'N+1 cost',
      tag: 'case',
      heading: 'Why a fast query adds up',
      eli5: 'Each trip to the **database** store is short. Fifty-one trips for every shopper, with 1,500 shoppers arriving each second, leaves the store with a queue out the door.',
      body: [
        'Each query takes about 1 ms plus a network round trip. Fifty-one of them cost 100 ms or more per page. At 1,500 pages per second the database answers 76,000 tiny queries per second.',
        'In a trace it shows as a ladder of identical short spans. The database CPU is busy parsing and planning the same statement over and over.',
        'In sequence, 51 queries cost only about 100 ms. The rest of the 3.2 s p99 is queueing: the database sits at 90% CPU, so each query waits behind others. Fewer queries shorten the queue.',
      ],
      keyIdea: 'If a trace shows the same query repeated once per row, you have found it.',
      metrics: { p99: '3.2 s', calls: '312', dbcpu: '90%', errors: '1.5%' },
      metricTones: { dbcpu: 'bad' },
      scene: {
        nodes: [
          { ...app, status: 'active' },
          { ...db, status: 'hot', load: 90, chips: [{ text: 'SELECT items, 1 ms', tone: 'warn' }, { text: 'SELECT items, 1 ms', tone: 'warn' }, { text: 'SELECT items, 1 ms', tone: 'warn' }] },
        ],
        links: [link('app', 'db', { label: '+ 1 round trip each', labelTone: 'warn' })],
        flows: [{ path: ['app', 'db'], tone: 'request', count: 8, duration: 0.8 }],
        panel: {
          title: 'The arithmetic',
          icon: 'Table',
          rows: [
            { text: 'Queries per page', value: '51' },
            { text: 'Pages per second', value: '1,500' },
            { text: 'Queries per second', value: '76,500', tone: 'bad' },
            { text: 'Time per page, in sequence', value: '100 ms +', tone: 'warn' },
          ],
        },
        caption: 'Small costs times big numbers',
      },
    },
    {
      title: 'Batch it',
      tag: 'case',
      heading: 'The fix: fetch related rows in one query',
      eli5: 'Now the shopper hands the **database** store the whole list at once and gets one bag back. Two trips instead of fifty-one.',
      body: [
        'Fetch the related rows in one query: a join, or `WHERE order_id IN (...)` for the whole batch. Most ORMs offer eager loading that does this for you.',
        'The page now sends 2 queries, whatever the number of orders.',
      ],
      keyIdea: 'Batch related reads. Two queries per page instead of 51.',
      metrics: { p99: '1.9 s', calls: '263', dbcpu: '55%', errors: '1.5%' },
      metricTones: { p99: 'warn', calls: 'warn', dbcpu: 'good' },
      scene: {
        nodes: [{ ...app, status: 'ok', badge: '2 queries' }, { ...db, status: 'ok', load: 55 }],
        links: [link('app', 'db', { arrow: 'both' })],
        flows: [
          { path: ['app', 'db'], tone: 'request', label: 'orders', duration: 0.9 },
          { path: ['app', 'db'], tone: 'request', label: 'items ANY(ids)', duration: 0.9, delay: 1 },
          { path: ['db', 'app'], tone: 'response', count: 2, duration: 0.9, delay: 1.9 },
        ],
        panel: {
          title: 'Before and after',
          icon: 'Zap',
          rows: [
            { text: 'Queries per page', value: '51 to 2', tone: 'good' },
            { text: 'DB CPU', value: '90% to 55%', tone: 'good' },
          ],
        },
        caption: 'Same data, two round trips',
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
      title: 'Chatty calls',
      tag: 'case',
      heading: 'Antipattern 2: chatty calls between services',
      eli5: 'At the **pricing** counter the shopper asks the price of one item, waits, then asks about the next, 50 times. Each question is quick, but the waiting adds up.',
      body: [
        'The same loop also calls the pricing service once per item. Between services every call costs a network round trip, serialization and a hop through any proxies, typically 1 to 5 ms even when the work is trivial.',
        '**Chatty I/O** is the service version of N+1. In sequence, 200 calls at 3 ms add 600 ms to the page. In parallel, they flood the other service with connections.',
      ],
      keyIdea: 'Network calls have a fixed cost per call, so many small ones add up.',
      metrics: { p99: '1.9 s', calls: '263', dbcpu: '55%', errors: '1.5%' },
      metricTones: { calls: 'bad', p99: 'warn' },
      scene: {
        nodes: [
          { ...app, status: 'active' },
          { ...svc, status: 'hot', load: 80, chips: [{ text: 'GET /price/17', tone: 'warn' }, { text: 'GET /price/18', tone: 'warn' }] },
        ],
        links: [link('app', 'svc', { label: '3 ms per call', labelTone: 'warn', arrow: 'both' })],
        flows: [
          { path: ['app', 'svc'], tone: 'request', label: 'GET /price/17', count: 8, duration: 0.9 },
          { path: ['svc', 'app'], tone: 'response', count: 8, duration: 0.9, delay: 0.5 },
        ],
        panel: {
          title: 'One page',
          icon: 'Repeat',
          rows: [
            { text: 'Price calls', value: '200' },
            { text: 'Cost per call', value: '3 ms' },
            { text: 'In sequence', value: '600 ms', tone: 'bad' },
          ],
        },
        caption: 'Many small round trips',
      },
    },
    {
      title: 'Batch calls',
      tag: 'case',
      heading: 'The fix: fewer, larger requests',
      eli5: 'The shopper hands the **pricing** counter the whole list and gets all 200 prices back in one answer.',
      body: [
        'Add a batch endpoint (`POST /prices` with a list of ids) or fetch everything a page needs in one call. When you design an API, think about how it will be called in a loop.',
        'A gateway or aggregation layer can also combine calls on behalf of clients.',
      ],
      keyIdea: 'Send fewer, larger requests. Design APIs with the loop in mind.',
      metrics: { p99: '1.2 s', calls: '63', dbcpu: '55%', errors: '1.5%' },
      metricTones: { calls: 'good', p99: 'warn' },
      scene: {
        nodes: [
          { ...app, status: 'ok' },
          { ...svc, status: 'ok', load: 20, chips: [{ text: 'POST /prices [200 ids]', tone: 'good' }] },
        ],
        links: [link('app', 'svc', { label: '1 call', arrow: 'both' })],
        flows: [
          { path: ['app', 'svc'], tone: 'request', label: 'POST /prices', duration: 1.2 },
          { path: ['svc', 'app'], tone: 'response', label: 'one reply', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Before and after',
          icon: 'Zap',
          rows: [
            { text: 'Price calls', value: '200 to 1', tone: 'good' },
            { text: 'Calls per page', value: '263 to 63', tone: 'good' },
          ],
        },
        caption: 'One round trip carries 200 ids',
      },
    },
    {
      title: 'Extra data',
      tag: 'case',
      heading: 'Antipattern 3: fetching more than you use',
      eli5: 'The shopper asks the **database** store for every shelf in the shop when the list needs one tin. Carrying all of it home is slow, and most goes in the bin.',
      body: [
        '**Extraneous fetching** is `SELECT *` on a wide table, or an API that returns the whole object when the screen shows two fields. The database reads, ships and the app parses columns nobody uses, such as a 40 KB description blob.',
        'Select only the columns you need, and have list endpoints return summaries. Narrow rows also let more of the table stay in memory.',
      ],
      keyIdea: 'Ask for the columns you will show, not the whole row.',
      metrics: { p99: '1.1 s', calls: '63', dbcpu: '50%', errors: '1.5%' },
      metricTones: { dbcpu: 'good' },
      scene: {
        nodes: [{ ...app, status: 'active' }, { ...db, status: 'active', load: 50, chips: [{ text: 'SELECT *', tone: 'bad' }] }],
        links: [link('app', 'db', { label: '40 KB per row', labelTone: 'warn', arrow: 'both' })],
        flows: [
          { path: ['app', 'db'], tone: 'request', label: 'SELECT *', duration: 1 },
          { path: ['db', 'app'], tone: 'data', label: '2 MB per page', count: 4, duration: 1.4, delay: 1.1 },
        ],
        panel: {
          title: 'The same query, narrowed',
          icon: 'Code',
          code: 'SELECT *                          -- 40 KB/row\nSELECT id, total, created_at      -- 60 B/row',
          footer: { text: 'Page payload drops from 2 MB to 3 KB', tone: 'good' },
        },
        caption: 'Most of the bytes are never shown',
      },
    },
    {
      title: 'Missing index',
      tag: 'case',
      heading: 'Antipattern 4: a query that scans the table',
      eli5: 'To find one receipt the clerk reads every receipt in the shop. A **database** index is a sorted card box that jumps straight to the right one.',
      body: [
        'The N+1 queries were fast because `items.order_id` is indexed. The first query of the page is a different one: `WHERE user_id = 42` on `orders`, which has no index. In the same trace it is the slowest span, because it reads every row of a 50-million-row table. It is fast on test data and slow on real data, and the cost grows with the table.',
        'The slow query log and `EXPLAIN` show a sequential scan. Add an index on the columns you filter and sort by. Each index slows writes and uses space, so index what queries need.',
      ],
      keyIdea: 'Filter on indexed columns, and read the query plan before blaming the hardware.',
      metrics: { p99: '1.0 s', calls: '63', dbcpu: '40%', errors: '1.5%' },
      metricTones: { dbcpu: 'good' },
      scene: {
        nodes: [{ ...app, status: 'active' }, { ...db, status: 'ok', load: 40, badge: '50M rows' }],
        links: [link('app', 'db', { arrow: 'both' })],
        flows: [
          { path: ['app', 'db'], tone: 'request', label: 'WHERE user_id = 42', duration: 1 },
          { path: ['db', 'app'], tone: 'response', label: '120 rows', duration: 1, delay: 1.2 },
        ],
        panel: {
          title: 'EXPLAIN says',
          icon: 'Search',
          rows: [
            { text: 'Seq Scan on orders', value: '50M rows read', tone: 'bad' },
            { text: 'Index Scan on (user_id)', value: '120 rows read', tone: 'good' },
            { text: 'Index cost on writes', value: 'a little per insert', tone: 'muted' },
          ],
        },
        caption: 'Jump to the rows, do not read them all',
      },
    },
    {
      title: 'No cache',
      tag: 'case',
      heading: 'Antipattern 5: asking the database the same thing again',
      eli5: 'The shopper asks the clerk for the opening hours every single visit. A note on the fridge, the **cache**, saves the trip.',
      body: [
        'Every page reads the same product names and the same shipping rules, values that change a few times a day. With **no caching**, the database answers the same question thousands of times per second.',
        'A cache-aside read with a TTL removes most of that load. Cache data that is read far more than it is written.',
      ],
      keyIdea: 'Cache what is read often and changes rarely.',
      metrics: { p99: '700 ms', calls: '63', dbcpu: '25%', errors: '1.5%' },
      metricTones: { p99: 'good', dbcpu: 'good' },
      scene: {
        nodes: [{ ...app, status: 'active' }, { ...cache, status: 'ok', badge: 'hit 95%, TTL 300 s' }, { ...db, status: 'ok', load: 25 }],
        links: [link('app', 'cache', { arrow: 'both' }), link('app', 'db', { style: 'dashed', label: 'only on a miss' })],
        flows: [
          { path: ['app', 'cache'], tone: 'request', label: 'GET shipping_rules', count: 3, duration: 0.9 },
          { path: ['cache', 'app'], tone: 'response', count: 3, duration: 0.9, delay: 1 },
        ],
        panel: {
          title: 'Database load',
          icon: 'Database',
          rows: [
            { text: 'Reads without cache', value: '14,000/s', tone: 'bad' },
            { text: 'Reads with 95% hits', value: '700/s', tone: 'good' },
          ],
        },
        caption: 'The note on the fridge answers most questions',
      },
    },
    {
      title: 'Stale cache',
      tag: 'case',
      heading: 'Antipattern 6: a cache that lies',
      eli5: 'A note on the fridge that nobody updates sends the shopper to a shop that closed last week. The note must be changed whenever the truth changes.',
      body: [
        'A team caches prices with no TTL and no delete on update. A price change then shows the old price for days, and customers are charged one number while seeing another.',
        'Stale data is a correctness bug, and harder to notice than slowness. Delete the key on write, and put a TTL on every key as a safety net.',
      ],
      keyIdea: 'Give every cached value a way to become fresh again.',
      metrics: { p99: '700 ms', calls: '63', dbcpu: '25%', errors: '1.5%' },
      scene: {
        nodes: [
          { ...app, status: 'active' },
          { ...cache, status: 'ok', chips: [{ text: 'price:42 = $9', tone: 'bad' }] },
          { ...db, status: 'ok', chips: [{ text: 'price:42 = $12', tone: 'good' }] },
        ],
        links: [link('app', 'cache'), link('app', 'db')],
        flows: [
          { path: ['app', 'db'], tone: 'request', label: 'UPDATE price', duration: 1 },
          { path: ['app', 'cache'], tone: 'event', label: 'DEL price:42', duration: 0.9, delay: 1.2 },
        ],
        panel: {
          title: 'Two safety nets',
          icon: 'Shield',
          rows: [
            { text: 'Delete the key on write', value: 'fresh now', tone: 'good' },
            { text: 'TTL on every key', value: 'fresh by 300 s', tone: 'good' },
            { text: 'Neither', value: 'wrong for days', tone: 'bad' },
          ],
        },
        caption: 'A write also deletes the cached copy',
      },
    },
    {
      title: 'Stampede',
      tag: 'case',
      heading: 'Antipattern 7: everyone misses at once',
      eli5: 'The fridge note expires at noon. Ten thousand shoppers all find it gone at the same moment and all run to the clerk together.',
      body: [
        'A hot key expires. 10,000 concurrent requests miss together and all hit the database. This is a **cache stampede**, also called a thundering herd.',
        'Fixes: let only one request refetch while the others wait (**single-flight**), add random jitter to TTLs, or serve the stale value while one request refreshes it in the background.',
      ],
      keyIdea: 'Expiry of a hot key must not send every caller to the database.',
      metrics: { p99: '700 ms', calls: '63', dbcpu: '25%', errors: '1.5%' },
      scene: {
        nodes: [{ ...app, status: 'hot', badge: '10,000 waiting' }, { ...cache, status: 'down', badge: 'key expired' }, { ...db, status: 'hot', load: 97 }],
        links: [link('app', 'cache', { label: 'miss', labelTone: 'warn' }), link('app', 'db')],
        flows: [
          { path: ['app', 'cache'], tone: 'request', count: 4, duration: 0.8 },
          { path: ['app', 'db'], tone: 'request', label: 'same query', count: 8, duration: 0.9, delay: 1 },
        ],
        panel: {
          title: 'Fixes',
          icon: 'Shield',
          rows: [
            { text: 'Single-flight', value: 'one fetch, others wait' },
            { text: 'Jittered TTLs', value: 'no mass expiry' },
            { text: 'Stale while revalidate', value: 'serve old, refresh' },
            { text: 'Early refresh', value: 'before it expires' },
          ],
        },
        caption: 'One expiry, a wall of identical queries',
      },
    },
    {
      title: 'Unbounded',
      tag: 'case',
      heading: 'Antipattern 8: unbounded result sets',
      eli5: 'Asking the store to bring you every item it sells, when you only wanted the first shelf. The trolley gets so heavy that nobody else can use the aisle.',
      body: [
        'The export endpoint runs `SELECT * FROM orders WHERE merchant_id = ?` with no limit. One large merchant has 4 million rows. The query scans for 20 seconds, the app loads 3 GB into memory and is killed, and the retry does it again.',
        'An **unbounded result set** is any query or API whose response size is decided by the data, not by the caller.',
      ],
      keyIdea: 'It works until the biggest customer shows up.',
      metrics: { p99: '700 ms', calls: '63', dbcpu: '25%', errors: '0.4%' },
      scene: {
        nodes: [{ ...client, label: 'merchant' }, { ...app, status: 'down', badge: 'out of memory' }, { ...db, status: 'hot', badge: '4M rows' }],
        links: [link('client', 'app'), link('app', 'db')],
        flows: [
          { path: ['client', 'app'], tone: 'request', label: 'GET /orders/export', duration: 1 },
          { path: ['app', 'db'], tone: 'request', label: 'SELECT * (no LIMIT)', duration: 1, delay: 1.1 },
          { path: ['db', 'app'], tone: 'data', label: '3 GB', count: 6, duration: 2, delay: 2.2 },
          { path: ['app', 'client'], tone: 'error', label: '502', duration: 1, delay: 4.3 },
        ],
        panel: {
          title: 'Response size',
          icon: 'HardDrive',
          rows: [
            { text: 'Typical merchant', value: '300 rows', tone: 'good' },
            { text: 'Largest merchant', value: '4,000,000 rows', tone: 'bad' },
            { text: 'App memory', value: '3 GB, killed', tone: 'bad' },
          ],
        },
        caption: 'The response size is set by the data, and the data grew',
      },
    },
    {
      title: 'Limits',
      tag: 'case',
      heading: 'The fix: a server-side limit and keyset paging',
      eli5: 'The store hands out one shelf at a time and remembers where you stopped. Shelf 10,000 is as quick to reach as shelf 1.',
      body: [
        'Put a limit on everything that returns a list, enforced on the server: default 50, maximum 500. `SELECT *` also goes, in favor of the columns needed.',
        'Use **keyset pagination** (`WHERE id > last_seen ORDER BY id LIMIT 50`) so page 10,000 is as cheap as page 1. Large exports become a background job that writes a file.',
      ],
      keyIdea: 'Every query and every list endpoint needs a server-enforced maximum size.',
      metrics: { p99: '700 ms', calls: '63', dbcpu: '25%', errors: '0.4%' },
      metricTones: { errors: 'good' },
      scene: {
        nodes: [{ ...client, label: 'merchant' }, { ...app, status: 'ok', badge: 'max 500' }, { ...db, status: 'ok', badge: 'index (merchant_id, id)' }],
        links: [link('client', 'app'), link('app', 'db')],
        flows: [
          { path: ['client', 'app', 'db'], tone: 'request', label: 'id > 9182733 LIMIT 50', duration: 1.6 },
          { path: ['db', 'app', 'client'], tone: 'response', label: '50 rows', duration: 1.6, delay: 1.8 },
        ],
        panel: {
          title: 'Paging cost',
          icon: 'List',
          rows: [
            { text: 'OFFSET 500000', value: 'scans 500,050 rows', tone: 'bad' },
            { text: 'Keyset, page 1', value: 'reads 50 rows', tone: 'good' },
            { text: 'Keyset, page 10,000', value: 'reads 50 rows', tone: 'good' },
          ],
        },
        caption: 'Jump to the next page through the index',
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
      title: 'Recap 1',
      tag: 'recap',
      heading: 'Part 1: the read path',
      eli5: 'The shopper now takes the whole list in one trip, asks for only the tins needed, uses the card box, keeps fresh notes on the fridge, and fetches one shelf at a time.',
      body: [
        'Measure first. Batch **N+1 queries** and **chatty calls**, select only the columns you use, and index what you filter on. Cache with invalidation and guard against the **stampede**. Put a server-side limit on every **result set**.',
        'The order history page went from 3.2 s to 700 ms. Part 2 covers slow work on the request path, locks, connections, noisy neighbors and retries.',
      ],
      keyIdea: 'Find the pattern in the traces, fix the biggest one, and measure again before touching the next.',
      metrics: { p99: '700 ms', calls: '63', dbcpu: '25%', errors: '0.4%' },
      metricTones: { p99: 'good', calls: 'good', dbcpu: 'good', errors: 'good' },
      scene: {
        nodes: [{ ...client, status: 'ok', badge: '700 ms' }, { ...app, status: 'ok' }, { ...cache, status: 'ok' }, { ...db, status: 'ok', load: 25 }],
        links: [link('client', 'app'), link('app', 'cache'), link('app', 'db')],
        flows: [
          { path: ['client', 'app'], tone: 'request', duration: 0.9 },
          { path: ['app', 'cache', 'app'], tone: 'response', duration: 1.2, delay: 1 },
          { path: ['app', 'db', 'app'], tone: 'request', duration: 1.4, delay: 1.2 },
          { path: ['app', 'client'], tone: 'response', duration: 0.9, delay: 2.7 },
        ],
        panel: {
          title: 'Part 1 fixes',
          icon: 'Zap',
          rows: [
            { text: 'N+1 and chatty', value: 'batch' },
            { text: 'Extra columns, scans', value: 'select, index' },
            { text: 'Cache', value: 'TTL, delete, single-flight' },
            { text: 'Big lists', value: 'limit, keyset' },
          ],
        },
      },
      quiz: {
        question: 'A popular cached key expires and 10,000 requests hit the database at the same moment. Which fix targets this directly?',
        options: [
          'Let one request refetch while the others wait for its result',
          'Remove the TTL so the key never expires',
          'Add an index on the table',
          'Raise the page size limit',
        ],
        answer: 0,
        explain: 'This is a cache stampede. Single-flight lets one caller refill the cache while the rest wait. Removing the TTL risks stale data, and an index or page size does not stop the herd.',
      },
    },
  ],
};
