import type { Lesson, SceneNode } from '../engine/types';

/** Place a node by screen column (x - y) and screen row (x + y). */
const p = (col: number, row: number): [number, number] => [(col + row) / 2, (row - col) / 2];

const client: SceneNode = { id: 'client', kind: 'client', at: p(-7, 0), label: 'support tool', sub: 'order lookup' };
const app: SceneNode = { id: 'app', kind: 'server', at: p(-4, 0), label: 'app server' };
const db: SceneNode = { id: 'db', kind: 'db', at: p(-1, 0), label: 'Postgres', sub: 'query planner' };
const idx: SceneNode = { id: 'idx', kind: 'search', at: p(2, -2.5), label: 'index', sub: 'B-tree' };
const table: SceneNode = { id: 'table', kind: 'storage', at: p(5, 1), label: 'orders table', sub: '50M rows · 10 GB' };
const writer: SceneNode = { id: 'writer', kind: 'worker', at: p(-4, 0), label: 'checkout', sub: '2,000 inserts/s' };

const pathLinks = [
  { from: 'client', to: 'app' },
  { from: 'app', to: 'db' },
];
const indexLinks = [...pathLinks, { from: 'db', to: 'idx' }, { from: 'idx', to: 'table', style: 'dashed' as const, label: 'row pointers' }];

export const indexes: Lesson = {
  id: 'indexes',
  title: 'Indexes and query tuning',
  tagline: 'Turn a four-second table scan into a one-millisecond lookup, and learn what every index costs you.',
  minutes: 14,
  level: 'Intermediate',
  learn: [
    'Why a query without an index reads the whole table',
    'How a B-tree finds one row among 50 million in four page reads',
    'Composite indexes, column order and covering indexes',
    'Why every index slows down writes',
    'Reading EXPLAIN, and the common reasons an index is ignored',
    'Spotting and fixing N+1 queries',
  ],
  metrics: [
    { key: 'time', label: 'Query time' },
    { key: 'rows', label: 'Rows read' },
    { key: 'indexes', label: 'Indexes' },
    { key: 'insert', label: 'Insert cost' },
  ],
  steps: [
    {
      title: 'Full scan',
      tag: 'problem',
      heading: 'One customer, 50 million rows read',
      eli5: 'A library has millions of books in no order. To find the books by one author, the librarian walks past every shelf. The **full scan** is that long walk.',
      body: [
        'The support tool shows a customer their orders: `SELECT * FROM orders WHERE customer_id = 8841`. The `orders` table has **50 million rows** and takes 10 GB on disk. The only index is the primary key on `id`.',
        'The database has no way to know where customer 8841 lives in the table. It reads every row and keeps the 40 that match. This is a **full table scan** (Postgres calls it a sequential scan). It takes about **4 seconds**, and the cost grows with the table.',
        'Ten support agents doing this at once keep the disk and CPU busy with work that is thrown away. The fix costs one line of SQL.',
      ],
      keyIdea: 'Without an index on the filtered column, the database must read every row to find a few.',
      metrics: { time: '4 s', rows: '50,000,000', indexes: '1 (primary key)', insert: '0.1 ms' },
      scene: {
        nodes: [client, { ...app, status: 'hot', badge: 'waiting 4 s' }, { ...db, status: 'hot', badge: 'seq scan' }, { ...table, status: 'hot', badge: 'reads all 10 GB' }],
        links: [...pathLinks, { from: 'db', to: 'table' }],
        flows: [
          { path: ['client', 'app', 'db'], tone: 'request', label: 'customer 8841', duration: 1.4 },
          { path: ['db', 'table'], tone: 'request', label: 'read every row', count: 8, duration: 2.6, delay: 1.5 },
          { path: ['table', 'db', 'app', 'client'], tone: 'response', label: '40 rows', duration: 1.8, delay: 4.3 },
        ],
        caption: '50 million rows read to return 40',
      },
    },
    {
      title: 'B-tree',
      tag: 'concept',
      heading: 'An index is a sorted tree of keys',
      eli5: 'The library adds a card catalog sorted by author. The librarian opens the right drawer, finds the card, and it says which shelf to go to. The **index** is that catalog.',
      body: [
        'An **index** is a separate structure that keeps one column sorted and stores, next to each value, a pointer to the row in the table. Most databases build it as a **B-tree**: a wide, shallow tree where each node is one disk page holding a few hundred keys.',
        'To find `customer_id = 8841` the database starts at the root page, picks the child whose range contains 8841, and repeats. With a few hundred keys per page, 50 million entries fit in about **4 levels**. Four page reads reach the leaf.',
        'The leaf holds the 40 pointers for this customer. The database follows them into the table and fetches 40 rows. Total work: about 44 page reads, most of them already in memory. The query drops from 4 seconds to about **1 ms**.',
      ],
      keyIdea: 'A B-tree lookup costs a handful of page reads, and that number barely grows as the table grows.',
      metrics: { time: '1 ms', rows: '40', indexes: '2', insert: '0.15 ms' },
      scene: {
        nodes: [client, app, { ...db, status: 'active', badge: 'index scan' }, { ...idx, status: 'ok', badge: '4 levels' }, { ...table, badge: '40 rows fetched' }],
        links: indexLinks,
        flows: [
          { path: ['client', 'app', 'db'], tone: 'request', label: 'customer 8841', duration: 1.2 },
          { path: ['db', 'idx'], tone: 'request', label: 'find 8841', duration: 0.8, delay: 1.3 },
          { path: ['idx', 'table'], tone: 'data', label: '40 pointers', duration: 0.8, delay: 2.2 },
          { path: ['table', 'db', 'app', 'client'], tone: 'response', label: '40 rows', duration: 1.6, delay: 3.1 },
        ],
        caption: 'Walk the tree, then fetch only the matching rows',
      },
      code: {
        language: 'sql',
        title: 'Create the index without blocking writes',
        source: `-- CONCURRENTLY builds the index while the table stays writable.
CREATE INDEX CONCURRENTLY idx_orders_customer
    ON orders (customer_id);

-- Now this is a tree walk plus 40 row fetches.
SELECT * FROM orders WHERE customer_id = 8841;

-- A B-tree is sorted, so ranges work too.
SELECT * FROM orders WHERE customer_id BETWEEN 8000 AND 8100;`,
        highlight: [2, 3, 9],
      },
    },
    {
      title: 'Selectivity',
      tag: 'concept',
      heading: 'An index helps when it narrows the search',
      eli5: 'A catalog card for "books with a red cover" lists half the library. Walking to each one takes longer than walking every shelf once. A good **index** points at only a few books.',
      body: [
        'Each pointer the index returns costs a visit to the table, often to a different page. For 40 rows that is cheap. For 20 million rows it is slower than reading the table front to back, because sequential reads are much faster than scattered ones.',
        '**Selectivity** is the share of rows a condition keeps. `customer_id = 8841` keeps 40 of 50 million, which is highly selective. `status = \'delivered\'` keeps 90% of the table. The planner will ignore an index on `status` for that query, and it is right to.',
        'Index the columns that appear in `WHERE`, `JOIN` and `ORDER BY` and that cut the result to a small slice. A column with a handful of distinct values is rarely worth an index on its own.',
      ],
      keyIdea: 'An index pays off when the condition keeps a small fraction of the table. For large fractions a scan wins.',
      metrics: { time: '4 s', rows: '45,000,000', indexes: '2', insert: '0.15 ms' },
      scene: {
        nodes: [client, app, { ...db, status: 'active', badge: 'picks seq scan' }, { ...idx, status: 'dim', badge: 'skipped' }, { ...table, status: 'active', badge: '90% match' }],
        links: [...pathLinks, { from: 'db', to: 'idx', style: 'faint' }, { from: 'db', to: 'table' }],
        flows: [
          { path: ['client', 'app', 'db'], tone: 'request', label: "status = 'delivered'", duration: 1.4 },
          { path: ['db', 'table'], tone: 'request', label: 'scan', count: 6, duration: 2, delay: 1.5 },
          { path: ['table', 'db'], tone: 'response', label: '45M rows', count: 4, duration: 1.6, delay: 3.6 },
        ],
        caption: 'When most rows match, the index is a detour',
      },
    },
    {
      title: 'Composite index',
      tag: 'concept',
      heading: 'Composite indexes and why column order matters',
      eli5: 'The catalog is sorted by author, and by year inside each author. Finding "this author, newest first" is one drawer. Finding "everything from 2019" is not, because that year is spread across every author.',
      body: [
        'The order page asks for a customer\'s ten newest orders: `WHERE customer_id = 8841 ORDER BY created_at DESC LIMIT 10`. With the single-column index, the database fetches all 40 rows and sorts them. For a customer with 30,000 orders that sort hurts.',
        'A **composite index** on `(customer_id, created_at)` sorts entries by customer first and by date inside each customer. The database jumps to customer 8841, reads the last ten entries, and stops. No sort step at all.',
        'The index is sorted left to right, like a phone book sorted by last name and then first name. It serves queries on `customer_id` alone, or on `customer_id` plus `created_at`. It cannot serve a query on `created_at` alone, since those dates are scattered through the whole tree. This is the **leftmost prefix** rule. Put equality columns first and the range or sort column last.',
      ],
      keyIdea: 'A composite index works for any leftmost prefix of its columns. Equality columns go first, the range or sort column last.',
      metrics: { time: '0.3 ms', rows: '10', indexes: '2', insert: '0.15 ms' },
      scene: {
        nodes: [client, app, { ...db, status: 'active', badge: 'no sort needed' }, { ...idx, status: 'ok', sub: '(customer_id, created_at)', badge: 'reads 10 entries' }, { ...table, badge: '10 rows fetched' }],
        links: indexLinks,
        flows: [
          { path: ['client', 'app', 'db'], tone: 'request', label: 'newest 10', duration: 1.2 },
          { path: ['db', 'idx'], tone: 'request', label: '8841, newest first', duration: 0.8, delay: 1.3 },
          { path: ['idx', 'table'], tone: 'data', label: '10 pointers', duration: 0.8, delay: 2.2 },
          { path: ['table', 'db', 'app', 'client'], tone: 'response', duration: 1.6, delay: 3.1 },
        ],
        caption: 'Already sorted by date inside each customer',
      },
      code: {
        language: 'sql',
        title: 'One composite index, three queries',
        source: `CREATE INDEX idx_orders_customer_date
    ON orders (customer_id, created_at);

-- Uses the index: equality on the first column, order on the second.
SELECT * FROM orders
 WHERE customer_id = 8841
 ORDER BY created_at DESC LIMIT 10;

-- Uses the index: leftmost prefix only.
SELECT count(*) FROM orders WHERE customer_id = 8841;

-- Cannot use it: skips the first column.
SELECT * FROM orders WHERE created_at > now() - interval '1 day';`,
        highlight: [2, 6, 7, 13],
      },
      quiz: {
        question: 'You have an index on (country, city, signup_date). Which query can it NOT serve efficiently?',
        options: [
          "WHERE country = 'IN'",
          "WHERE country = 'IN' AND city = 'Pune'",
          "WHERE city = 'Pune'",
          "WHERE country = 'IN' AND city = 'Pune' AND signup_date > '2025-01-01'",
        ],
        answer: 2,
        explain: 'The index is sorted by country first. Rows for Pune sit under one country, but the database cannot jump to a city without knowing the country, so it has no leftmost prefix to use.',
      },
    },
    {
      title: 'Covering index',
      tag: 'concept',
      heading: 'A covering index answers from the index alone',
      eli5: 'If the catalog card also shows the title and the year, the librarian can answer from the drawer and never walk to the shelf. That card is a **covering index**.',
      body: [
        'The order list page shows only the date, total and status. The composite index finds the ten entries, and then the database still visits the table ten times to read `total` and `status`.',
        'A **covering index** carries every column the query needs. In Postgres, `INCLUDE (total, status)` stores those values in the index leaves. The query is answered by an **index-only scan**, and the table is not touched for rows that are known to be visible.',
        'The price is a bigger index: more disk, more memory, more work on each write. Use it for a few hot queries that return narrow rows. Do not add every column to every index.',
      ],
      keyIdea: 'If the index holds every column the query reads, the database can skip the table.',
      metrics: { time: '0.1 ms', rows: '10 (index only)', indexes: '2', insert: '0.17 ms' },
      scene: {
        nodes: [client, app, { ...db, status: 'active', badge: 'index-only scan' }, { ...idx, status: 'ok', sub: '+ total, status', badge: 'has every column' }, { ...table, status: 'dim', badge: 'not touched' }],
        links: [...pathLinks, { from: 'db', to: 'idx' }, { from: 'idx', to: 'table', style: 'faint' }],
        flows: [
          { path: ['client', 'app', 'db'], tone: 'request', label: 'order list', duration: 1.2 },
          { path: ['db', 'idx'], tone: 'request', duration: 0.8, delay: 1.3 },
          { path: ['idx', 'db'], tone: 'response', label: 'date, total, status', duration: 0.8, delay: 2.2 },
          { path: ['db', 'app', 'client'], tone: 'response', duration: 1.2, delay: 3.1 },
        ],
        caption: 'The answer comes straight out of the index',
      },
    },
    {
      title: 'Write cost',
      tag: 'tradeoff',
      heading: 'Every index is paid for on every write',
      eli5: 'Each new book needs a new card in every catalog the library keeps. With six catalogs, shelving one book means filing six cards. More **indexes** means slower shelving.',
      body: [
        'Over a year the team adds an index for each slow report. The table now has **6 indexes**. Each `INSERT` writes the row and then inserts one entry into each of the six trees. Each `UPDATE` of an indexed column and each `DELETE` touches them too.',
        'Checkout inserts 2,000 orders per second. Insert time climbs from 0.1 ms to **0.5 ms**, the write-ahead log grows several times faster, and the six indexes together take more disk than the table. They also compete with the table for memory.',
        'Treat indexes as a budget. Check the usage statistics (`pg_stat_user_indexes` in Postgres) and drop the ones with zero scans. Merge overlapping ones: an index on `(customer_id)` is redundant once `(customer_id, created_at)` exists.',
      ],
      keyIdea: 'Indexes trade write speed, disk and memory for read speed. Keep the ones that earn their place.',
      metrics: { time: '0.1 ms', rows: '10', indexes: '6', insert: '0.5 ms' },
      scene: {
        nodes: [
          { ...writer, status: 'active' },
          { ...db, status: 'hot', sub: undefined, badge: '7 writes per row' },
          { ...idx, status: 'hot', label: '6 indexes', sub: '14 GB total', badge: '6 tree inserts' },
          { ...table, badge: '1 row insert' },
        ],
        links: [
          { from: 'writer', to: 'db' },
          { from: 'db', to: 'idx' },
          { from: 'db', to: 'table' },
        ],
        flows: [
          { path: ['writer', 'db'], tone: 'request', label: 'INSERT order', count: 3, duration: 1 },
          { path: ['db', 'table'], tone: 'data', label: 'row', duration: 1, delay: 1.1 },
          { path: ['db', 'idx'], tone: 'data', label: 'x6', count: 6, duration: 1.6, delay: 1.1 },
        ],
        caption: 'One insert, seven structures to update',
      },
    },
    {
      title: 'EXPLAIN',
      tag: 'concept',
      heading: 'Ask the database what it plans to do',
      eli5: 'Before fetching, the librarian can tell you the plan: "I will use the author catalog, then visit 40 shelves." **EXPLAIN** is asking for that plan.',
      body: [
        'Guessing which index a query uses is a poor method. Put `EXPLAIN` in front of the query and the planner prints its plan. `EXPLAIN ANALYZE` also runs the query and reports real row counts and timings.',
        'Read three things. The **scan type**: `Seq Scan` reads the whole table, `Index Scan` walks an index and visits the table, `Index Only Scan` stays in the index. The **rows**: estimated against actual. A large gap means stale statistics, and `ANALYZE orders` refreshes them. The **time**, and which node of the plan it is spent in.',
        'The warning signs are a `Seq Scan` on a big table with a selective filter, a `Sort` over many rows that an index could have delivered in order, and a line such as `Rows Removed by Filter: 49999960`.',
      ],
      keyIdea: 'Tune from the plan. EXPLAIN ANALYZE shows which scan ran, how many rows it touched and where the time went.',
      metrics: { time: '0.3 ms', rows: '10', indexes: '2', insert: '0.15 ms' },
      scene: {
        nodes: [{ ...client, label: 'engineer', sub: 'psql' }, { ...db, status: 'active', badge: 'prints the plan' }, { ...idx, status: 'ok', sub: '(customer_id, created_at)' }, table],
        links: [{ from: 'client', to: 'db' }, { from: 'db', to: 'idx' }, { from: 'idx', to: 'table', style: 'dashed' }],
        flows: [
          { path: ['client', 'db'], tone: 'request', label: 'EXPLAIN ANALYZE', duration: 1.4 },
          { path: ['db', 'idx', 'table'], tone: 'request', duration: 1.4, delay: 1.5 },
          { path: ['db', 'client'], tone: 'response', label: 'Index Scan, 0.3 ms', duration: 1.4, delay: 3 },
        ],
        caption: 'The plan tells you which path the query took',
      },
      code: {
        language: 'sql',
        title: 'Before and after the composite index',
        source: `EXPLAIN ANALYZE
SELECT * FROM orders
 WHERE customer_id = 8841 ORDER BY created_at DESC LIMIT 10;

-- Before: whole table read, then sorted
--  Sort  (actual time=4012.3..4012.4 rows=10)
--    ->  Seq Scan on orders  (actual rows=40)
--          Filter: (customer_id = 8841)
--          Rows Removed by Filter: 49999960

-- After: ten index entries, already in order
--  Limit  (actual time=0.04..0.28 rows=10)
--    ->  Index Scan Backward using idx_orders_customer_date
--          Index Cond: (customer_id = 8841)`,
        highlight: [7, 9, 13, 14],
      },
    },
    {
      title: 'Index ignored',
      tag: 'case',
      heading: 'Case: the index exists and the query still scans',
      eli5: 'The catalog is sorted by the exact name on the cover. Ask for "any author whose name ends in -son" and the sorting is no help, so the librarian walks the shelves again.',
      body: [
        'A login query runs `WHERE lower(email) = \'ana@example.com\'`. There is an index on `email`, and the plan shows a `Seq Scan`. The index is sorted by the raw value, and the query asks about a computed one. Fix it with an **expression index** on `lower(email)`, or store emails already lowercased.',
        'The same trap has other shapes. `WHERE created_at::date = \'2026-03-01\'` wraps the column in a cast: rewrite it as a range on `created_at`. `LIKE \'%phone\'` has a leading wildcard, so there is no prefix to walk. Comparing a text column to a number forces a conversion on every row.',
        'Two more causes sit outside the query. A condition that matches a large share of rows makes the planner choose a scan on purpose. Stale statistics make it guess wrong. Check the plan before blaming the index.',
      ],
      keyIdea: 'A B-tree can only be searched by the value it stores. Wrap the column in a function and the index no longer applies.',
      metrics: { time: '3.8 s', rows: '50,000,000', indexes: '2', insert: '0.15 ms' },
      scene: {
        nodes: [
          { ...client, label: 'login page', sub: 'lower(email) = ?' },
          app,
          { ...db, status: 'hot', badge: 'seq scan' },
          { ...idx, status: 'dim', sub: 'on email', badge: 'cannot match' },
          { ...table, label: 'users table', sub: '50M rows', status: 'hot' },
        ],
        links: [...pathLinks, { from: 'db', to: 'idx', style: 'faint' }, { from: 'db', to: 'table' }],
        flows: [
          { path: ['client', 'app', 'db'], tone: 'request', label: 'lower(email)', duration: 1.4 },
          { path: ['db', 'idx'], tone: 'error', label: 'no use', duration: 0.8, delay: 1.5 },
          { path: ['db', 'table'], tone: 'request', label: 'scan all', count: 6, duration: 2.2, delay: 2.4 },
        ],
        caption: 'The index stores email, the query asks for lower(email)',
      },
    },
    {
      title: 'N+1 queries',
      tag: 'case',
      heading: 'Case: 101 fast queries make one slow page',
      eli5: 'A reader hands over a list of 100 books. The librarian fetches one, walks back, fetches the next, walks back. Carrying the whole list on one trip is far faster.',
      body: [
        'The order history page loads 100 orders with one query. Then the code loops over them and loads each order\'s items with its own query. That is 1 + 100 = **101 queries**. Each one uses an index and takes 0.3 ms inside the database.',
        'The time goes to round trips. Each query costs about 1 ms of network and driver overhead, so the page spends over 100 ms waiting on the database, and every query plan looks perfect. This is the **N+1 problem**, and ORMs with lazy loading produce it without anyone writing a loop of SQL.',
        'Fetch the children in one query: a `JOIN`, or `WHERE order_id IN (...)` with all 100 ids. Most ORMs have a switch for it (eager loading, `select_related`, `includes`). Count queries per request in development and the pattern shows up at once.',
      ],
      keyIdea: 'Count queries per request as well as time per query. A hundred fast round trips add up to a slow page.',
      metrics: { time: '130 ms per page', rows: '600', indexes: '2', insert: '0.15 ms' },
      scene: {
        nodes: [{ ...client, label: 'order history', sub: '100 orders' }, { ...app, status: 'hot', badge: '101 queries' }, { ...db, status: 'active', badge: '0.3 ms each' }, idx, { ...table, label: 'order_items' , sub: '300M rows' }],
        links: indexLinks,
        flows: [
          { path: ['client', 'app'], tone: 'request', duration: 0.8 },
          { path: ['app', 'db'], tone: 'request', label: 'items for order 1, 2, 3…', count: 8, duration: 2.8, delay: 0.9 },
          { path: ['db', 'app'], tone: 'response', count: 8, duration: 2.8, delay: 1.3 },
          { path: ['app', 'client'], tone: 'response', label: '130 ms', duration: 0.8, delay: 4.4 },
        ],
        caption: 'Each query is fast. The round trips are the cost.',
      },
      code: {
        language: 'python',
        title: 'N+1, then the same page in two queries',
        source: `# N+1: one query for the orders, then one per order
orders = db.query("SELECT * FROM orders WHERE customer_id = %s "
                  "ORDER BY created_at DESC LIMIT 100", cid)
for o in orders:
    o.items = db.query(
        "SELECT * FROM order_items WHERE order_id = %s", o.id)

# Fixed: fetch all the items in one round trip
ids = [o.id for o in orders]
items = db.query(
    "SELECT * FROM order_items WHERE order_id = ANY(%s)", ids)
by_order = defaultdict(list)
for it in items:
    by_order[it.order_id].append(it)
for o in orders:
    o.items = by_order[o.id]`,
        highlight: [4, 5, 6, 10, 11],
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Index for the queries you run, and check the plan',
      eli5: 'A good library keeps a few well-chosen catalogs, checks that the librarian uses them, and sends one trip for a whole list of books.',
      body: [
        'A query with no usable index scans the table. A **B-tree** index finds one key among 50 million in about four page reads, which took the lookup from 4 s to 1 ms. A **composite index** serves any leftmost prefix and can return rows already sorted. A **covering index** answers without visiting the table.',
        'Every index is extra work on each write, plus disk and memory. Read `EXPLAIN ANALYZE` to see what ran. If an index is ignored, look for a function on the column, a leading wildcard, a type mismatch or a condition that matches too many rows. And count queries per request to catch N+1.',
        'Do this before reaching for replicas or shards. A missing index is the cheapest database problem to fix.',
      ],
      keyIdea: 'Find the slow query, read its plan, add the smallest index that fixes it, and drop the indexes nobody uses.',
      metrics: { time: '0.3 ms', rows: '10', indexes: '2', insert: '0.15 ms' },
      scene: {
        nodes: [client, app, { ...db, status: 'ok' }, { ...idx, status: 'ok', sub: '(customer_id, created_at)' }, { ...table, status: 'ok' }],
        links: indexLinks,
        flows: [
          { path: ['client', 'app', 'db', 'idx'], tone: 'request', duration: 1.8 },
          { path: ['idx', 'table'], tone: 'data', duration: 0.8, delay: 1.9 },
          { path: ['table', 'db', 'app', 'client'], tone: 'response', duration: 1.8, delay: 2.8 },
        ],
      },
      quiz: {
        question: "A users table has an index on email. The query WHERE lower(email) = 'ana@example.com' does a sequential scan. What is the right fix?",
        options: [
          'Add more memory so the scan is faster',
          'Create an index on the expression lower(email), or store emails lowercased and drop the function',
          'Add a second index on email',
          'Run the query on a read replica',
        ],
        answer: 1,
        explain: 'The index is sorted by the raw email, and the query compares a computed value. An expression index on lower(email) stores the value being searched for. A replica would run the same scan on another machine.',
      },
    },
  ],
};
