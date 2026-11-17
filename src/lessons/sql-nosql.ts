import type { Lesson, SceneNode } from '../engine/types';

const client: SceneNode = { id: 'client', kind: 'client', at: [-5, 0.5], label: 'shop app', sub: 'web + mobile' };
const server: SceneNode = { id: 'server', kind: 'server', at: [-2, 0], label: 'app server' };
const pg: SceneNode = { id: 'pg', kind: 'db', at: [1, -4.4], label: 'PostgreSQL', sub: 'relational' };
const kv: SceneNode = { id: 'kv', kind: 'cache', at: [3.7, -3.7], label: 'Redis', sub: 'key-value' };
const doc: SceneNode = { id: 'doc', kind: 'db', at: [5.2, -0.2], label: 'MongoDB', sub: 'document' };
const wide: SceneNode = { id: 'wide', kind: 'shard', at: [5, 1.9], label: 'Cassandra', sub: 'wide-column' };
const graph: SceneNode = { id: 'graph', kind: 'db', at: [3.8, 3.4], label: 'Neo4j', sub: 'graph' };
const search: SceneNode = { id: 'search', kind: 'search', at: [-1.8, -4.5], label: 'Elasticsearch', sub: 'search' };

const sqlMetrics = { store: 'PostgreSQL', query: 'any column', scale: '5K to 20K w/s', gives: 'easy scale-out' };

export const sqlNosql: Lesson = {
  id: 'sql-nosql',
  title: 'SQL and the NoSQL families',
  tagline: 'Pick a database by how you read and write the data, then pick the brand.',
  minutes: 14,
  level: 'Beginner',
  learn: [
    'How tables, keys and joins model related data',
    'What ACID transactions protect you from',
    'Where one relational box runs out of room',
    'The five NoSQL families and what each one is good at',
    'How to map access patterns to stores',
  ],
  metrics: [
    { key: 'store', label: 'Store' },
    { key: 'query', label: 'Query by' },
    { key: 'scale', label: 'Scale' },
    { key: 'gives', label: 'Gives up' },
  ],
  steps: [
    {
      title: 'Pick a store',
      tag: 'problem',
      heading: 'The team cannot agree on a database',
      eli5: 'The toy shop needs a place to keep its things, and the helpers argue about which cupboard to buy. The **database** is that cupboard, and the right one depends on how you will put things in and take them out.',
      body: [
        'The new shop needs to keep users, orders, a product catalog where every item has different attributes, login sessions and a search box. One engineer says "SQL does not scale, use MongoDB". Another says "Postgres can do everything".',
        'Both are guessing. A database is hard to change once it holds live data: moving a busy store to a new engine takes months of dual writes and backfills. So the choice deserves ten minutes of thought up front.',
        'The question that settles it is short: **how will the app read and write this data?** Which keys, how often, and what has to stay correct together.',
      ],
      keyIdea: 'Access patterns decide the store. Write down the reads and writes first, and the database choice mostly follows.',
      metrics: { store: '?' },
      scene: {
        nodes: [client, { ...server, status: 'active' }, { ...pg, label: 'database', sub: 'which one?', badge: '?', status: 'dim' }],
        links: [
          { from: 'client', to: 'server' },
          { from: 'server', to: 'pg', style: 'dashed' },
        ],
        flows: [
          { path: ['client', 'server'], tone: 'request', label: 'place order', duration: 1.2 },
          { path: ['server', 'pg'], tone: 'request', label: 'save it… where?', duration: 1.2, delay: 1.3 },
        ],
        caption: 'Users, orders, catalog, sessions, search',
      },
    },
    {
      title: 'Tables',
      tag: 'concept',
      heading: 'The relational model: tables that point at each other',
      eli5: 'A **relational database** is a cabinet of neat drawers where every card has the same boxes to fill in. An order card names its customer card, and the cabinet refuses a card that names nobody real.',
      body: [
        'A **relational database** stores data in tables with fixed columns. Each row has a **primary key**. A **foreign key** in one table points at a row in another, so `orders.customer_id` refers to a real row in `customers`.',
        'Each fact lives in one place. The customer\'s email sits in one row, and every order refers to it by id. Change the email once and every order sees the new value. This is called **normalization**.',
        'The **schema** is enforced on every write. Try to insert an order for customer `999` when no such customer exists and the database refuses. Bad data never gets in.',
      ],
      keyIdea: 'Tables plus keys model relationships directly, and the schema keeps bad data out at write time.',
      metrics: sqlMetrics,
      scene: {
        nodes: [client, server, { ...pg, status: 'active', badge: 'customers · orders · items' }],
        links: [
          { from: 'client', to: 'server' },
          { from: 'server', to: 'pg' },
        ],
        flows: [
          { path: ['server', 'pg'], tone: 'request', label: 'INSERT INTO orders', duration: 1.2 },
          { path: ['pg', 'server'], tone: 'response', label: 'ok, customer 7 exists', duration: 1.2, delay: 1.3 },
        ],
      },
    },
    {
      title: 'ACID',
      tag: 'concept',
      heading: 'Transactions: all of it happens, or none of it',
      eli5: 'Selling a toy means three jobs: take it off the shelf, write the order card, list what was bought. A **transaction** ties them together, so either all three happen or none do.',
      body: [
        'Checkout touches three tables: take one item out of stock, create the order, add its line items. If the server crashes after the first statement, you have sold stock with no order behind it.',
        'A **transaction** wraps the statements together. **Atomicity**: all or nothing. **Consistency**: constraints hold before and after. **Isolation**: two shoppers buying the last pair do not see each other\'s half-done work. **Durability**: once `COMMIT` returns, the write is in the log on disk and survives a crash.',
        'Without this you rebuild it in application code, and you get double charges and nights spent reconciling. This is the main reason to default to SQL for money, orders, inventory and bookings.',
      ],
      keyIdea: 'ACID turns a group of writes into one safe step. If your data has invariants that span rows, you want it.',
      metrics: sqlMetrics,
      scene: {
        nodes: [client, server, { ...pg, status: 'active', badge: 'all or nothing' }],
        links: [
          { from: 'client', to: 'server' },
          { from: 'server', to: 'pg' },
        ],
        flows: [
          { path: ['server', 'pg'], tone: 'request', label: 'BEGIN', duration: 0.9 },
          { path: ['server', 'pg'], tone: 'request', label: 'UPDATE stock', duration: 0.9, delay: 1 },
          { path: ['server', 'pg'], tone: 'request', label: 'INSERT order', duration: 0.9, delay: 2 },
          { path: ['server', 'pg'], tone: 'request', label: 'COMMIT', duration: 0.9, delay: 3 },
          { path: ['pg', 'server'], tone: 'response', label: 'committed', duration: 0.9, delay: 4 },
        ],
      },
      code: {
        language: 'sql',
        title: 'Checkout as one transaction',
        source: `BEGIN;
UPDATE products SET stock = stock - 1
  WHERE id = 42 AND stock > 0;      -- 0 rows? the app sends ROLLBACK
INSERT INTO orders (id, customer_id, total)
  VALUES (9001, 7, 59.00);
INSERT INTO order_items (order_id, product_id, qty)
  VALUES (9001, 42, 1);
COMMIT;                             -- all three rows, or none`,
        highlight: [1, 3, 8],
      },
    },
    {
      title: 'Joins, indexes',
      tag: 'concept',
      heading: 'Joins rebuild the picture, indexes make it fast',
      eli5: 'An **index** is a list at the front of the drawer that says exactly where each card sits. The shopkeeper finds one card among millions in a blink, with no flipping through them all.',
      body: [
        'Because facts are split across tables, reads put them back together with a **join**: `SELECT o.id, c.email FROM orders o JOIN customers c ON c.id = o.customer_id`. You can ask questions nobody planned for when the schema was designed.',
        'An **index** is a sorted copy of one or more columns (usually a B-tree) with pointers back to the rows. Finding one email among 5 million orders drops from an 812 ms full scan to 0.4 ms.',
        'Indexes are not free. Every insert must update every index on the table, and indexes add 20 to 50% on top of the table size. Index the columns you filter and join on, and nothing else.',
      ],
      keyIdea: 'SQL lets you ask new questions of old data. Indexes decide whether those questions take a millisecond or a second.',
      metrics: { ...sqlMetrics, query: 'joins + indexes' },
      scene: {
        nodes: [client, server, { ...pg, status: 'active', badge: '0.4 ms · index scan' }],
        links: [
          { from: 'client', to: 'server' },
          { from: 'server', to: 'pg' },
        ],
        flows: [
          { path: ['server', 'pg'], tone: 'request', label: 'orders JOIN customers', duration: 1.2 },
          { path: ['pg', 'server'], tone: 'response', label: '20 rows', duration: 1.2, delay: 1.3 },
        ],
      },
    },
    {
      title: 'SQL limits',
      tag: 'tradeoff',
      heading: 'Where one relational box runs out',
      eli5: 'Every new card must go through one shopkeeper at one cabinet, **PostgreSQL**. When too many cards arrive each second, or the cabinet gets too full, that one shopkeeper cannot keep up.',
      body: [
        'Default to SQL until a specific bottleneck forces you off it. Know where those bottlenecks are. One machine serves roughly **10K reads/s** and **5K to 20K writes/s**, depending on hardware. Past **2 to 10 TB** on one node, backups, vacuum and schema changes start to hurt.',
        'Reads are the easy wall: add replicas and a cache (next lessons). Writes and size are harder, because every write must land on the one primary. Your options are to shard it yourself (or with Vitess or Citus), or to use a store built to spread out from day one.',
        'The second pressure is shape. When every product has different attributes, a fixed schema turns into 40 nullable columns or an awkward attribute table.',
      ],
      keyIdea: 'SQL breaks on write volume, dataset size or data shape. If none of those is your problem, stay on SQL.',
      metrics: { ...sqlMetrics, scale: '18K w/s · at limit' },
      scene: {
        nodes: [client, { ...server, status: 'hot' }, { ...pg, status: 'hot', badge: '18K writes/s · 9 TB' }],
        links: [
          { from: 'client', to: 'server' },
          { from: 'server', to: 'pg' },
        ],
        flows: [
          { path: ['client', 'server'], tone: 'request', count: 4, duration: 1 },
          { path: ['server', 'pg'], tone: 'request', label: 'INSERT…', count: 6, duration: 1.4, delay: 0.5 },
        ],
        caption: 'One primary takes every write',
      },
    },
    {
      title: 'Key-value',
      tag: 'concept',
      heading: 'Key-value: a giant dictionary',
      eli5: '**Redis** is a wall of coat hooks with name tags. Say the exact tag and you get the bag in a blink, but you cannot ask which bags have a red ball inside.',
      body: [
        'The simplest NoSQL family. You `SET` a value under a key and `GET` it back by that exact key. The store does not look inside the value. **Redis** keeps everything in memory and answers in well under a millisecond, at 100K to 200K operations per second per node.',
        'It fits data you always fetch by a known key: login sessions, feature flags, rate-limit counters, carts and caches. The shop reads the session on every request, so this is a perfect match.',
        'The price is the lack of queries. You cannot ask "all sessions older than an hour" or "carts containing item 42". If you do not know the key, you cannot find the value.',
      ],
      keyIdea: 'Key-value is the fastest store you can buy, as long as every read starts with a key you already know.',
      metrics: { store: 'Redis', query: 'exact key', scale: '100K+ ops/s', gives: 'queries' },
      scene: {
        nodes: [client, server, { ...pg, status: 'dim' }, { ...kv, status: 'active', badge: '0.3 ms' }],
        links: [
          { from: 'client', to: 'server' },
          { from: 'server', to: 'pg', style: 'faint' },
          { from: 'server', to: 'kv' },
        ],
        flows: [
          { path: ['server', 'kv'], tone: 'request', label: 'GET session:8f3a', duration: 0.9 },
          { path: ['kv', 'server'], tone: 'response', label: '{user_id: 7}', duration: 0.9, delay: 1 },
        ],
      },
      code: {
        language: 'bash',
        title: 'Sessions and counters in Redis',
        source: `# a session that expires in 30 minutes
redis-cli SET session:8f3a '{"user_id":7,"cart":[42]}' EX 1800
redis-cli GET session:8f3a

# login attempts per IP, reset every 60 seconds
redis-cli INCR rate:login:203.0.113.9
redis-cli EXPIRE rate:login:203.0.113.9 60

# there is no WHERE clause: you must already know the key`,
        highlight: [2, 3, 9],
      },
    },
    {
      title: 'Documents',
      tag: 'concept',
      heading: 'Document stores: one JSON blob per thing',
      eli5: 'A **document store** keeps one box per toy with everything about that toy inside. A robot\'s box and a doll\'s box can hold different things, and nobody has to redraw the drawer cards.',
      body: [
        'A **document store** keeps JSON-like documents, and each one can have its own shape. A laptop has RAM and screen size, a running shoe has sizes and heel drop. Both live in the same `products` collection with no schema change.',
        'Unlike key-value, the store understands the document: you can index and query nested fields. Data that is read together is stored together, so one read returns the product with all its variants.',
        'The cost is that the schema now lives in your code. After a few years you have 12 versions of the user document and every reader must handle all of them. Joins are manual. Postgres `JSONB` columns cover many of these cases if you already run Postgres.',
      ],
      keyIdea: 'Documents fit data with a varied, nested shape that you read as one unit. You trade joins and enforced schema for that flexibility.',
      metrics: { store: 'MongoDB', query: 'fields + indexes', scale: 'built-in sharding', gives: 'joins, fixed schema' },
      scene: {
        nodes: [client, server, { ...pg, status: 'dim' }, { ...kv, status: 'dim' }, { ...doc, status: 'active', badge: '1 doc = 1 product' }],
        links: [
          { from: 'client', to: 'server' },
          { from: 'server', to: 'pg', style: 'faint' },
          { from: 'server', to: 'kv', style: 'faint' },
          { from: 'server', to: 'doc' },
        ],
        flows: [
          { path: ['server', 'doc'], tone: 'request', label: 'find color = red', duration: 1.2 },
          { path: ['doc', 'server'], tone: 'response', label: 'product + variants', duration: 1.2, delay: 1.3 },
        ],
      },
      code: {
        language: 'javascript',
        title: 'A product document in MongoDB',
        source: `db.products.insertOne({
  _id: "sku-42",
  name: "Trail running shoe",
  price: 59.0,
  specs: { color: "red", drop_mm: 6 },
  variants: [
    { size: 42, stock: 12 },
    { size: 43, stock: 0 },
  ],
});

db.products.createIndex({ "specs.color": 1 });
db.products.find({ "specs.color": "red", price: { $lt: 80 } });`,
        highlight: [5, 6, 12, 13],
      },
    },
    {
      title: 'Wide-column',
      tag: 'concept',
      heading: 'Wide-column: built for a firehose of writes',
      eli5: '**Cassandra** is a long row of labeled bins with many helpers dropping in new slips very fast. You can only find a slip again if you know which bin to open.',
      body: [
        'Wide-column stores such as **Cassandra**, ScyllaDB, HBase and Bigtable organize data by a **partition key** plus sorted columns inside each partition. A sensor table might use `PRIMARY KEY ((device_id, day), ts)`: one device\'s readings for one day sit together, sorted by time.',
        'Writes go to an in-memory table and an append-only log, then get flushed to disk in big sequential chunks (an **LSM tree**). That makes writes cheap. Each node handles 10K to 50K operations per second, and you add nodes to add capacity.',
        'The catch is that you design one table per query. Ask for anything that does not start with the partition key and the cluster has to scan everything. Deletes leave tombstones that compaction must clean up. It pays off above roughly 50K writes/s: IoT, logs, audit trails, chat history.',
      ],
      keyIdea: 'Wide-column stores take huge write volumes and scale out by adding nodes, but only answer the queries you designed the tables for.',
      metrics: { store: 'Cassandra', query: 'partition key', scale: '10K to 50K/node', gives: 'ad hoc queries' },
      scene: {
        nodes: [client, server, { ...pg, status: 'dim' }, { ...kv, status: 'dim' }, { ...doc, status: 'dim' }, { ...wide, status: 'active', badge: '80K writes/s' }],
        links: [
          { from: 'client', to: 'server' },
          { from: 'server', to: 'pg', style: 'faint' },
          { from: 'server', to: 'kv', style: 'faint' },
          { from: 'server', to: 'doc', style: 'faint' },
          { from: 'server', to: 'wide' },
        ],
        flows: [
          { path: ['server', 'wide'], tone: 'request', label: 'append event', count: 6, duration: 1.2 },
          { path: ['wide', 'server'], tone: 'response', label: 'ack', duration: 1, delay: 1.4 },
        ],
      },
    },
    {
      title: 'Graph, search',
      tag: 'concept',
      heading: 'Graph and search: two specialists',
      eli5: 'A **search engine** is the shop\'s picture catalog: look up a word and it lists every toy that matches. The string map on the wall shows which kids are friends, so you can follow the strings from kid to kid.',
      body: [
        'A **graph database** (Neo4j, Neptune) stores nodes and edges and follows them directly. "Friends of friends who bought this" is a short traversal. In SQL each hop is another self-join. Most graph problems are fine in SQL until you go past about 3 hops on billions of edges.',
        'A **search engine** (Elasticsearch, OpenSearch) builds an **inverted index**: for every word, the list of documents that contain it. It ranks by relevance, handles typos and filters by many facets at once. `LIKE \'%shoe%\'` in SQL cannot use a normal index and scans the table.',
        'Search is never the source of truth. It holds a copy of your database, about 1 second behind, and you rebuild it when the mapping changes.',
      ],
      keyIdea: 'Reach for a graph store when the questions are about connections many hops deep, and a search index when they are about text. Neither replaces your main database.',
      metrics: { store: 'Neo4j · Elasticsearch', query: 'edges · words', scale: '< 100 ms search', gives: 'source of truth' },
      scene: {
        nodes: [
          client,
          server,
          { ...pg, status: 'dim' },
          { ...kv, status: 'dim' },
          { ...doc, status: 'dim' },
          { ...wide, status: 'dim' },
          { ...graph, status: 'active', badge: '4 hops' },
          { ...search, status: 'active', badge: '35 ms' },
        ],
        links: [
          { from: 'client', to: 'server' },
          { from: 'server', to: 'graph' },
          { from: 'server', to: 'search' },
        ],
        flows: [
          { path: ['server', 'search'], tone: 'request', label: 'q=red shoes', duration: 1.2 },
          { path: ['search', 'server'], tone: 'response', label: 'ranked hits', duration: 1.2, delay: 1.3 },
          { path: ['server', 'graph'], tone: 'request', label: 'friends of friends', duration: 1.2, delay: 0.6 },
          { path: ['graph', 'server'], tone: 'response', label: 'paths', duration: 1.2, delay: 1.9 },
        ],
        caption: 'Five NoSQL families: key-value, document, wide-column, graph, search',
      },
      quiz: {
        question: 'The fraud team wants to find accounts linked to a known fraudster through shared cards, devices and addresses, up to 5 hops away. Which store fits best?',
        options: ['Redis', 'A graph database', 'Elasticsearch', 'Cassandra'],
        answer: 1,
        explain: 'This is a many-hop traversal over a highly connected dataset, which is exactly what graph stores are built for. In SQL it would be five self-joins.',
      },
    },
    {
      title: 'Access patterns',
      tag: 'case',
      heading: 'Case: the shop picks its stores',
      eli5: 'An **access pattern** is how you put things in and take them out. Order cards go in the drawer cabinet, bags on the coat hooks, toy names in the picture catalog, and the shop buys no furniture it does not need.',
      body: [
        'The team lists its access patterns. **Checkout** changes stock, orders and payments together, so it needs transactions: PostgreSQL. **Sessions** are read by key on every request: Redis. **Catalog search** needs relevance and facets: Elasticsearch, fed from Postgres.',
        'The catalog has varied attributes, which points at a document store. They put it in a Postgres `JSONB` column instead, because they already run Postgres and each new engine is one more thing to back up, monitor and get paged for.',
        'No access pattern needs a graph or a wide-column store yet, so they skip both. Writes are at 1K/s, far from the 5K to 20K ceiling.',
      ],
      keyIdea: 'Use the fewest stores that cover your access patterns. Each extra engine must earn its operational cost.',
      metrics: { store: 'Postgres + Redis + ES', query: 'per access path', scale: '1K w/s today', gives: 'one-store simplicity' },
      scene: {
        nodes: [
          client,
          { ...server, status: 'active' },
          { ...pg, status: 'ok', badge: 'orders, catalog' },
          { ...kv, status: 'ok', badge: 'sessions' },
          { ...doc, status: 'dim' },
          { ...wide, status: 'dim' },
          { ...graph, status: 'dim' },
          { ...search, status: 'ok', badge: 'product search' },
        ],
        links: [
          { from: 'client', to: 'server' },
          { from: 'server', to: 'pg' },
          { from: 'server', to: 'kv' },
          { from: 'server', to: 'search' },
          { from: 'pg', to: 'search', style: 'dashed', label: 'sync' },
        ],
        flows: [
          { path: ['server', 'kv'], tone: 'request', label: 'GET session', duration: 0.9 },
          { path: ['server', 'pg'], tone: 'request', label: 'INSERT order', duration: 1.1, delay: 1 },
          { path: ['pg', 'search'], tone: 'data', label: 'changed rows', duration: 1.2, delay: 2.2 },
          { path: ['server', 'search'], tone: 'request', label: 'q=red shoes', duration: 1.1, delay: 3.4 },
        ],
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Match the store to the access pattern',
      eli5: 'First write down how you will put things in and take them out. Start with the drawer cabinet, **SQL**, and add hooks, boxes, bins, strings or a catalog only when the cabinet cannot do the job.',
      body: [
        'Start with SQL: tables, joins, indexes and ACID transactions cover most products. It runs out on write volume (5K to 20K writes/s per box), dataset size (2 to 10 TB) or data shape.',
        'Then pick the NoSQL family that matches the pattern. **Key-value** for lookups by a known key. **Document** for varied, nested records read as one unit. **Wide-column** for huge write volume with a fixed query. **Graph** for deep traversals. **Search** for text and facets.',
      ],
      keyIdea: 'Write down how the data is read and written. The family follows from that, and the brand comes last.',
      metrics: { store: 'Postgres + Redis + ES', query: 'per access path', scale: '1K w/s today', gives: 'one-store simplicity' },
      scene: {
        nodes: [client, server, { ...pg, status: 'ok' }, { ...kv, status: 'ok' }, doc, wide, graph, { ...search, status: 'ok' }],
        links: [
          { from: 'client', to: 'server' },
          { from: 'server', to: 'pg' },
          { from: 'server', to: 'kv' },
          { from: 'server', to: 'doc', style: 'faint' },
          { from: 'server', to: 'wide', style: 'faint' },
          { from: 'server', to: 'graph', style: 'faint' },
          { from: 'server', to: 'search' },
        ],
        flows: [
          { path: ['client', 'server'], tone: 'request', duration: 1 },
          { path: ['server', 'kv', 'server'], tone: 'response', duration: 1.2, delay: 1.1 },
          { path: ['server', 'pg', 'server'], tone: 'response', duration: 1.6, delay: 2.4 },
        ],
      },
      quiz: {
        question: 'An IoT product ingests 200K sensor readings per second. The only read is "readings for device X between two times". Which store fits best?',
        options: [
          'PostgreSQL on a bigger machine',
          'Redis, one key per reading',
          'A wide-column store partitioned by device and day',
          'A graph database',
        ],
        answer: 2,
        explain: '200K writes/s is far past one SQL primary, and the read always starts with the device id. A wide-column store with a (device_id, day) partition key, sorted by time, is built for exactly this.',
      },
    },
  ],
};
