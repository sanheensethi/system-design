import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const client: SceneNode = { id: 'client', kind: 'client', at: at(-6.4, -3.4), label: 'shopper', sub: 'web + mobile' };
const app: SceneNode = { id: 'app', kind: 'server', at: at(-3.8, 0), label: 'app server', sub: 'shop backend' };
const pg: SceneNode = { id: 'pg', kind: 'db', at: at(0, 0), label: 'PostgreSQL', sub: 'relational', tint: 'blue' };
const rep: SceneNode = { id: 'rep', kind: 'replica', at: at(3.8, 0), label: 'replica', sub: 'read copy' };
const kv: SceneNode = { id: 'kv', kind: 'cache', at: at(3.8, -3.8), label: 'Redis', sub: 'key-value', tint: 'red' };
const doc: SceneNode = { id: 'doc', kind: 'db', at: at(3.8, 0), label: 'MongoDB', sub: 'document', tint: 'green' };
const wide: SceneNode = { id: 'wide', kind: 'shard', at: at(3.8, 3.8), label: 'Cassandra', sub: 'wide-column', tint: 'amber' };
const graph: SceneNode = { id: 'graph', kind: 'db', at: at(0, -3.8), label: 'Neo4j', sub: 'graph', tint: 'violet' };
const search: SceneNode = { id: 'search', kind: 'search', at: at(3.8, 0), label: 'Elasticsearch', sub: 'search', tint: 'teal' };
const ts: SceneNode = { id: 'ts', kind: 'db', at: at(3.8, 0), label: 'TimescaleDB', sub: 'time-series', tint: 'teal' };
const wh: SceneNode = { id: 'wh', kind: 'warehouse', at: at(3.8, 0), label: 'warehouse', sub: 'analytics' };

const m = (store: string, query: string, scale: string, gives: string) => ({ store, query, scale, gives });
const sql = m('PostgreSQL', 'any column', '5K to 20K w/s', 'easy scale-out');

export const sqlNosql: Lesson = {
  id: 'sql-nosql',
  title: 'SQL and the NoSQL families',
  tagline: 'Pick a database by how you read and write the data, then pick the brand.',
  minutes: 20,
  level: 'Beginner',
  learn: [
    'How tables, keys, normalization and joins model related data',
    'What ACID transactions protect you from, and what indexes cost',
    'Where one relational box runs out of room',
    'The five NoSQL families, plus time-series and warehouse stores',
    'How to map access patterns to the fewest stores',
  ],
  metrics: [
    { key: 'store', label: 'Store', icon: 'Database' },
    { key: 'query', label: 'Query by', icon: 'Search' },
    { key: 'scale', label: 'Scale', icon: 'Gauge' },
    { key: 'gives', label: 'Gives up', icon: 'Scale' },
  ],
  steps: [
    {
      title: 'Pick a store',
      tag: 'problem',
      heading: 'The team cannot agree on a database',
      eli5: 'The toy shop needs a place to keep its things, and the helpers argue about which cupboard to buy. The **database** is that cupboard, and the right one depends on how you will put things in and take them out.',
      body: [
        'The new shop must keep users, orders, a catalog where every item has different attributes, login sessions and a search box. One engineer says "SQL does not scale, use MongoDB". Another says "Postgres can do everything".',
        'Both are guessing. Moving a live database to a new engine takes months of dual writes and backfills. The question that settles it: **how will the app read and write this data?**',
      ],
      keyIdea: 'Access patterns decide the store. Write down the reads and writes first, and the database choice mostly follows.',
      metrics: { store: '?' },
      metricTones: { store: 'warn' },
      scene: {
        nodes: [
          { ...client, chips: ['place order'] },
          { ...app, status: 'active' },
          { ...pg, label: 'database', sub: 'which one?', badge: '?', status: 'dim', tint: 'gray' },
        ],
        links: [link('client', 'app'), link('app', 'pg', { style: 'dashed' })],
        flows: [
          { path: ['client', 'app'], tone: 'request', label: 'place order', duration: 1.2 },
          { path: ['app', 'pg'], tone: 'request', label: 'save it... where?', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'What the shop must store',
          icon: 'List',
          rows: [
            { text: 'Users and orders', value: 'must stay correct' },
            { text: 'Product catalog', value: 'varied shape' },
            { text: 'Login sessions', value: 'read by key' },
            { text: 'Search box', value: 'read by text' },
          ],
          footer: { text: 'Same shop, four different access patterns', tone: 'muted' },
        },
      },
    },
    {
      title: 'Tables',
      tag: 'concept',
      heading: 'The relational model: tables that point at each other',
      eli5: 'A **relational database** is a cabinet of neat drawers where every card has the same boxes to fill in. An order card names its customer card by number.',
      body: [
        'A **relational database** stores data in tables with fixed columns. Each row has a **primary key**. A **foreign key** in one table points at a row in another, so `orders.customer_id` refers to a real row in `customers`.',
        'This models relationships directly: customers have orders, orders have items.',
      ],
      keyIdea: 'Tables plus keys model relationships directly.',
      metrics: sql,
      metricTones: { query: 'good' },
      scene: {
        nodes: [client, app, { ...pg, status: 'active', badge: 'customers · orders · items' }],
        links: [link('client', 'app'), link('app', 'pg')],
        flows: [
          { path: ['app', 'pg'], tone: 'request', label: 'INSERT INTO orders', duration: 1.2 },
          { path: ['pg', 'app'], tone: 'response', label: 'ok', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Two tables, one key between them',
          icon: 'Table',
          code: 'customers\n  id (PK)   email\n  7         ana@shop.example\n\norders\n  id (PK)   customer_id (FK)   total\n  9001      7                  59.00',
          footer: { text: 'orders.customer_id points at customers.id', tone: 'muted' },
        },
      },
    },
    {
      title: 'One fact',
      tag: 'concept',
      heading: 'Normalization: each fact lives in one place',
      eli5: 'The cabinet keeps each person\'s address on one card only. Orders just name the card. When the address changes, you fix one card and every order sees it.',
      body: [
        'The customer\'s email sits in one row and every order refers to it by id. Change it once and every order sees the new value. This is **normalization**.',
        'It has a read cost: facts are split across tables, so reads need more joins. Denormalizing on purpose is a later lesson.',
      ],
      keyIdea: 'Normalized tables store each fact once, so an update touches one row.',
      metrics: sql,
      metricTones: { query: 'good' },
      scene: {
        nodes: [app, { ...pg, status: 'active', badge: 'customers: 1 row for ana' }],
        links: [link('app', 'pg')],
        flows: [
          { path: ['app', 'pg'], tone: 'request', label: 'UPDATE customers SET email', duration: 1.2 },
          { path: ['pg', 'app'], tone: 'response', label: '1 row changed', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'One update, every order sees it',
          icon: 'Table',
          rows: [
            { text: 'customers row 7, email', value: 'changed once', tone: 'good' },
            { text: 'Orders 9001, 9002, 9003', value: 'all show new email', tone: 'good' },
            { text: 'Cost', value: 'more joins on read', tone: 'warn' },
          ],
        },
      },
    },
    {
      title: 'Schema and constraints',
      tag: 'concept',
      heading: 'The schema refuses bad data',
      eli5: 'If you write an order for a person who has no card, the cabinet hands it back. The cabinet only holds cards that obey its rules.',
      body: [
        'The **schema** and its constraints are enforced on every write. Insert an order for customer `999` when no such customer exists and the database refuses.',
        'This is **consistency**, the C in ACID: rules such as foreign keys and `NOT NULL` hold before and after every transaction.',
      ],
      keyIdea: 'The schema keeps bad data out at write time, so the rules always hold.',
      metrics: sql,
      metricTones: { query: 'good' },
      scene: {
        nodes: [app, { ...pg, status: 'active', badge: 'schema enforced' }],
        links: [link('app', 'pg')],
        flows: [
          { path: ['app', 'pg'], tone: 'request', label: 'order for customer 999', duration: 1.2 },
          { path: ['pg', 'app'], tone: 'error', label: 'no such customer', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'The write is rejected',
          icon: 'Shield',
          code: 'INSERT INTO orders (customer_id, total)\n  VALUES (999, 10.00);\n\nERROR: foreign key violation\n  customer 999 does not exist',
          footer: { text: 'Bad data never gets in', tone: 'good' },
        },
      },
    },
    {
      title: 'Atomicity',
      tag: 'concept',
      heading: 'Transactions: all of it happens, or none of it',
      eli5: 'Selling a toy means three jobs: take it off the shelf, write the order card, list what was bought. A **transaction** ties them together, so either all three happen or none do.',
      body: [
        'Checkout touches three tables: take one item out of stock, create the order, add its line items. If the server crashes after the first statement, you have sold stock with no order behind it.',
        'A **transaction** wraps the statements together. This is **atomicity**: all or nothing.',
      ],
      keyIdea: 'A transaction turns a group of writes into one safe step.',
      metrics: sql,
      metricTones: { query: 'good' },
      scene: {
        nodes: [app, { ...pg, status: 'active', badge: 'all or nothing' }],
        links: [link('app', 'pg')],
        flows: [
          { path: ['app', 'pg'], tone: 'request', label: 'BEGIN', duration: 0.9 },
          { path: ['app', 'pg'], tone: 'request', label: 'UPDATE stock', duration: 0.9, delay: 1 },
          { path: ['app', 'pg'], tone: 'request', label: 'INSERT order', duration: 0.9, delay: 2 },
          { path: ['app', 'pg'], tone: 'request', label: 'COMMIT', duration: 0.9, delay: 3 },
          { path: ['pg', 'app'], tone: 'response', label: 'committed', duration: 0.9, delay: 4 },
        ],
        panel: {
          title: 'If the server crashes mid-way',
          icon: 'Receipt',
          rows: [
            { text: 'Stock minus 1', value: 'done' },
            { text: 'Order row', value: 'crash', tone: 'bad' },
            { text: 'Line items', value: 'never ran', tone: 'muted' },
            { text: 'With BEGIN / COMMIT', value: 'all rolled back', tone: 'good' },
          ],
        },
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
      title: 'Isolation',
      tag: 'concept',
      heading: 'Isolation: two shoppers at the same moment',
      eli5: 'Two kids reach for the last toy at the same time. The shopkeeper lets one finish while the other waits, so the toy is never sold twice.',
      body: [
        '**Isolation** means concurrent transactions do not see each other\'s half-done work. Shoppers A and B both try to buy the last pair at the same moment. The database makes B wait for A\'s lock, or retry.',
        'The final stock is 0 and only one order exists. Isolation comes in levels (read committed, repeatable read, serializable). A later lesson covers them.',
      ],
      keyIdea: 'Isolation makes simultaneous transactions behave as if they ran one after another.',
      metrics: sql,
      metricTones: { query: 'good' },
      scene: {
        nodes: [
          { ...client, at: at(-6.4, -3.8), label: 'shopper A', chips: ['buy last pair'] },
          { ...client, id: 'client2', at: at(-3.4, 3.8), label: 'shopper B', chips: [{ text: 'buy last pair', tone: 'warn' }] },
          { ...pg, at: at(0, 0), status: 'active', badge: 'stock = 1' },
        ],
        links: [link('client', 'pg'), link('client2', 'pg')],
        flows: [
          { path: ['client', 'pg'], tone: 'request', label: 'A: BEGIN, buy', duration: 1.2 },
          { path: ['client2', 'pg'], tone: 'request', label: 'B: BEGIN, buy (same time)', duration: 1.2 },
          { path: ['pg', 'client'], tone: 'response', label: 'A: order placed', duration: 1.2, delay: 1.5 },
          { path: ['pg', 'client2'], tone: 'error', label: 'B: waited, sold out', duration: 1.2, delay: 2.8 },
        ],
        panel: {
          title: 'Same moment, no oversell',
          icon: 'Shield',
          rows: [
            { text: 'A and B both start', value: 'stock = 1' },
            { text: 'B waits for A\'s lock', value: 'blocked', tone: 'warn' },
            { text: 'A commits', value: 'stock = 0', tone: 'good' },
            { text: 'B retries, sees 0', value: 'sold out', tone: 'good' },
          ],
          footer: { text: 'Final stock 0, one order, no oversell', tone: 'good' },
        },
      },
    },
    {
      title: 'Durability',
      tag: 'concept',
      heading: 'Durability: a committed order survives a crash',
      eli5: 'Once the order card is signed it is locked in the cabinet, even if the lights go out. After the lights come back, the card is still there.',
      body: [
        '**Durability**: `COMMIT` returns only after the change is in the write-ahead log (WAL) on disk. If the server crashes a moment later, it replays the log on restart.',
        'The order is still there. Together with atomicity, consistency and isolation, this completes **ACID**.',
      ],
      keyIdea: 'ACID is a bundle of four guarantees. If your data has rules that span rows, you want all four.',
      metrics: sql,
      metricTones: { query: 'good' },
      scene: {
        nodes: [app, { ...pg, status: 'active', badge: 'WAL on disk' }],
        links: [link('app', 'pg')],
        flows: [
          { path: ['app', 'pg'], tone: 'request', label: 'COMMIT', duration: 1.1 },
          { path: ['pg', 'app'], tone: 'response', label: 'committed (WAL flushed)', duration: 1.1, delay: 1.2 },
        ],
        panel: {
          title: 'Crash, restart, order kept',
          icon: 'HardDrive',
          rows: [
            { text: 'COMMIT returns', value: 'after WAL on disk', tone: 'good' },
            { text: 'Power cut', value: 'crash', tone: 'bad' },
            { text: 'Restart replays WAL', value: 'order 9001 present', tone: 'good' },
          ],
        },
      },
    },
    {
      title: 'Joins',
      tag: 'concept',
      heading: 'Joins put the picture back together',
      eli5: 'To find who ordered the red robot, the shopkeeper lays the order card next to the customer card and reads both. You can ask questions nobody planned for when the drawers were made.',
      body: [
        'Facts are split across tables, so reads reassemble them with a **join**. You can ask questions nobody planned for when the schema was designed.',
        'Joins are the strength of SQL and the first thing many NoSQL stores give up.',
      ],
      keyIdea: 'SQL lets you ask new questions of old data.',
      metrics: { ...sql, query: 'joins' },
      metricTones: { query: 'good' },
      scene: {
        nodes: [app, { ...pg, status: 'active', chips: ['orders JOIN customers'] }],
        links: [link('app', 'pg')],
        flows: [
          { path: ['app', 'pg'], tone: 'request', label: 'orders JOIN customers', duration: 1.2 },
          { path: ['pg', 'app'], tone: 'response', label: '20 rows', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'One query, two tables',
          icon: 'Table',
          code: 'SELECT o.id, c.email\nFROM orders o\nJOIN customers c\n  ON c.id = o.customer_id\nWHERE o.total > 50;',
          footer: { text: 'No one planned this question in advance', tone: 'muted' },
        },
      },
    },
    {
      title: 'Indexes',
      tag: 'concept',
      heading: 'Indexes make the question fast',
      eli5: 'An **index** is a list at the front of the drawer that says exactly where each card sits. The shopkeeper finds one card among millions in a blink, with no flipping through them all.',
      body: [
        'An **index** is a sorted copy of one or more columns (usually a B-tree) with pointers back to the rows. Finding one email among 5 million orders drops from an 812 ms full scan to 0.4 ms.',
        'A later lesson covers indexes in depth.',
      ],
      keyIdea: 'Indexes decide whether a question takes a millisecond or a second.',
      metrics: { ...sql, query: 'joins + indexes' },
      metricTones: { query: 'good' },
      scene: {
        nodes: [app, { ...pg, status: 'ok', badge: '0.4 ms · index scan' }],
        links: [link('app', 'pg')],
        flows: [
          { path: ['app', 'pg'], tone: 'request', label: 'WHERE email = ...', duration: 1.2 },
          { path: ['pg', 'app'], tone: 'response', label: '1 row', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Find one email in 5M rows',
          icon: 'Timer',
          rows: [
            { text: 'Full table scan', value: '812 ms', tone: 'bad' },
            { text: 'B-tree index', value: '0.4 ms', tone: 'good' },
          ],
        },
      },
    },
    {
      title: 'Index cost',
      tag: 'tradeoff',
      heading: 'Indexes are not free',
      eli5: 'Every new card must also be written into the index list at the front. More lists mean slower filing and a bigger cabinet, so only list what you often look up.',
      body: [
        'Every insert must update every index on the table, so each index slows writes. Indexes also add 20 to 50% on top of the table size.',
        'Index the columns you filter and join on, and nothing else.',
      ],
      keyIdea: 'Each index buys faster reads and pays with slower writes and more disk.',
      metrics: { ...sql, query: 'joins + indexes' },
      metricTones: { scale: 'warn' },
      scene: {
        nodes: [app, { ...pg, status: 'active', chips: ['INSERT order'], load: 55 }],
        links: [link('app', 'pg')],
        flows: [{ path: ['app', 'pg'], tone: 'request', label: 'INSERT + 4 index updates', duration: 1.4 }],
        panel: {
          title: 'What an extra index costs',
          icon: 'Layers',
          rows: [
            { text: 'Reads on that column', value: 'fast', tone: 'good' },
            { text: 'Every insert', value: 'one more write', tone: 'warn' },
            { text: 'Disk size', value: '+20 to 50%', tone: 'warn' },
          ],
          footer: { text: 'Index what you filter and join on', tone: 'muted' },
        },
      },
    },
    {
      title: 'Read wall',
      tag: 'tradeoff',
      heading: 'Reads are the easy wall',
      eli5: 'Too many kids ask the one shopkeeper "where is my toy?". Hire helpers who keep a copy of the lists, and the shopkeeper only files new cards.',
      body: [
        'One machine serves roughly **10K reads/s** (a rough rule of thumb for mixed queries). Past that, add **read replicas** and a cache. Each replica is a copy that answers reads, so capacity grows with the copies. Replicas lag by milliseconds, so a user may not see their own write at once (see the replication lesson).',
        'Replication and caching get their own lessons. Reads are rarely the reason to leave SQL.',
      ],
      keyIdea: 'Replicas and caches scale reads on SQL. Reads alone rarely force you onto NoSQL.',
      metrics: { ...sql, scale: '10K reads/s per box' },
      metricTones: { scale: 'warn' },
      scene: {
        nodes: [
          { ...app, chips: [{ text: '14K reads/s', tone: 'warn' }] },
          { ...pg, status: 'hot', load: 92 },
          { ...rep, status: 'ok', badge: 'takes reads' },
        ],
        links: [link('app', 'pg'), link('pg', 'rep', { style: 'dashed', label: 'copies' })],
        flows: [
          { path: ['app', 'pg'], tone: 'request', label: 'SELECT', count: 4, duration: 1.2 },
          { path: ['pg', 'rep'], tone: 'data', label: 'changes', duration: 1.2, delay: 1.4 },
        ],
        panel: {
          title: 'Reads scale out',
          icon: 'Copy',
          rows: [
            { text: 'One box (rule of thumb)', value: '10K reads/s', tone: 'warn' },
            { text: 'Plus 2 replicas', value: '30K reads/s', tone: 'good' },
          ],
        },
      },
    },
    {
      title: 'Write wall',
      tag: 'tradeoff',
      heading: 'Writes and size are the hard wall',
      eli5: 'Every new card must go through one shopkeeper at one cabinet. When too many cards arrive each second, or the cabinet gets too full, that one shopkeeper cannot keep up.',
      body: [
        'Every write must land on the one primary: roughly **5K to 20K writes/s**. Past **2 to 10 TB** on one node, backups, vacuum and schema changes start to hurt.',
        'First try a bigger box and tune it. Then shard SQL (Vitess, Citus), or use distributed SQL such as Spanner, CockroachDB or Aurora. Past that, move to a store built to spread out.',
      ],
      keyIdea: 'SQL breaks on write volume or dataset size. If neither is your problem, stay on SQL.',
      metrics: { ...sql, scale: '18K w/s · at limit' },
      metricTones: { scale: 'bad', gives: 'bad' },
      scene: {
        nodes: [
          { ...app, status: 'hot', chips: [{ text: '18K writes/s', tone: 'bad' }] },
          { ...pg, status: 'hot', load: 97, badge: '9 TB' },
        ],
        links: [link('app', 'pg', { label: 'every write, one primary', labelTone: 'warn' })],
        flows: [{ path: ['app', 'pg'], tone: 'request', label: 'INSERT...', count: 6, duration: 1.4 }],
        panel: {
          title: 'One box tops out near',
          icon: 'Gauge',
          rows: [
            { text: 'Writes per second', value: '5K to 20K', tone: 'bad' },
            { text: 'Dataset size', value: '2 to 10 TB', tone: 'bad' },
            { text: 'Fix', value: 'shard, or spread-out store', tone: 'muted' },
          ],
        },
      },
    },
    {
      title: 'Shape wall',
      tag: 'tradeoff',
      heading: 'The other pressure: data that does not fit a fixed schema',
      eli5: 'A robot has wheels and a battery. A doll has hair color and a dress size. One card layout for both leaves most boxes empty.',
      body: [
        'When every product has different attributes, a fixed schema turns into 40 nullable columns or an awkward attribute table.',
        'This is a pressure on data shape. It points at a store that keeps each item as its own record.',
      ],
      keyIdea: 'Varied data shape is the third reason to look beyond SQL, after write volume and size.',
      metrics: { ...sql, gives: 'fixed columns' },
      metricTones: { gives: 'warn' },
      scene: {
        nodes: [
          { id: 'laptop', kind: 'block', at: at(-3.8, -3.2), label: 'laptop', sub: 'RAM, screen', icon: 'Cpu', tint: 'blue' },
          { id: 'shoe', kind: 'block', at: at(-3.8, 3.2), label: 'running shoe', sub: 'sizes, heel drop', icon: 'ShoppingBag', tint: 'amber' },
          { ...pg, status: 'hot', badge: '40 columns, mostly NULL' },
        ],
        links: [link('laptop', 'pg'), link('shoe', 'pg')],
        flows: [
          { path: ['laptop', 'pg'], tone: 'request', label: 'ram_gb = 16', duration: 1.2 },
          { path: ['shoe', 'pg'], tone: 'request', label: 'drop_mm = 6', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'products table',
          icon: 'Table',
          rows: [
            { text: 'laptop row', value: 'drop_mm = NULL', tone: 'warn' },
            { text: 'shoe row', value: 'ram_gb = NULL', tone: 'warn' },
            { text: 'every new category', value: 'new columns', tone: 'bad' },
          ],
        },
      },
    },
    {
      title: 'Five families',
      tag: 'concept',
      heading: 'NoSQL is a catch-all for five families',
      eli5: 'Instead of one cabinet there are five different pieces of furniture: coat hooks, one box per toy, a row of bins, a string map and a picture catalog. Each is best at one way of finding things.',
      body: [
        '"NoSQL" names a group of stores that each give up something SQL offers (joins, a fixed schema or multi-row transactions) in return for scale or shape. Many also replicate asynchronously and are eventually consistent, so two readers can briefly see different values (see the replication and consistency lessons).',
        'There are really five families, each solving a different problem. The next steps take them one by one.',
      ],
      keyIdea: 'Each NoSQL family trades part of SQL for one strength. Pick by the strength you need.',
      metrics: m('5 families', 'depends', 'scales out', 'some SQL features'),
      scene: {
        nodes: [
          { ...kv, at: at(-3.6, -3.2) },
          { ...doc, at: at(0, -3.2) },
          { ...wide, at: at(3.6, -3.2) },
          { ...graph, at: at(-1.8, 3.2) },
          { ...search, at: at(1.8, 3.2) },
        ],
        panel: {
          title: 'Which family?',
          icon: 'Boxes',
          rows: [
            { text: 'Lookup by known key', value: 'key-value' },
            { text: 'Varied nested records', value: 'document' },
            { text: 'Huge write volume', value: 'wide-column' },
            { text: 'Deep connections', value: 'graph' },
            { text: 'Text and facets', value: 'search' },
          ],
        },
      },
    },
    {
      title: 'Key-value',
      tag: 'concept',
      heading: 'Key-value: a giant dictionary',
      eli5: '**Redis** is a wall of coat hooks with name tags. Say the exact tag and you get the bag in a blink, but you cannot ask which bags have a red ball inside.',
      body: [
        'You `SET` a value under a key and `GET` it back by that exact key. **Redis** keeps everything in memory and answers in well under a millisecond, at 100K to 200K operations per second per node.',
        'It fits sessions, feature flags, rate-limit counters, carts and caches. The price: no queries. If you do not know the key, you cannot find the value.',
      ],
      keyIdea: 'Key-value is the fastest store you can buy, as long as every read starts with a key you already know.',
      metrics: m('Redis', 'exact key', '100K+ ops/s', 'queries'),
      metricTones: { scale: 'good', gives: 'warn' },
      scene: {
        nodes: [app, { ...kv, at: at(0, 0), status: 'active', badge: '0.3 ms', chips: ['GET session:8f3a'] }],
        links: [link('app', 'kv')],
        flows: [
          { path: ['app', 'kv'], tone: 'request', label: 'GET session:8f3a', duration: 0.9 },
          { path: ['kv', 'app'], tone: 'response', label: '{user_id: 7}', duration: 0.9, delay: 1 },
        ],
        panel: {
          title: 'Only one way in',
          icon: 'KeyRound',
          rows: [
            { text: 'GET by exact key', value: '0.3 ms', tone: 'good' },
            { text: 'Sessions older than 1 h', value: 'cannot ask', tone: 'bad' },
            { text: 'Carts holding item 42', value: 'cannot ask', tone: 'bad' },
          ],
        },
      },
      code: {
        language: 'bash',
        title: 'Sessions and counters in Redis',
        source: `# a session that expires in 30 minutes
redis-cli SET session:8f3a '{"user_id":7,"cart":[42]}' EX 1800
redis-cli GET session:8f3a

# login attempts per IP: start the 60 s window on the first attempt
redis-cli INCR rate:login:203.0.113.9
redis-cli EXPIRE rate:login:203.0.113.9 60 NX

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
        'A **document store** keeps JSON-like documents, each with its own shape. A laptop has RAM and screen size, a running shoe has sizes and heel drop. Both live in one `products` collection.',
        'The store understands the document, so you can index and query nested fields. Data read together is stored together: one read returns the product with all its variants.',
      ],
      keyIdea: 'Documents fit data with a varied, nested shape that you read as one unit.',
      metrics: m('MongoDB', 'fields + indexes', 'built-in sharding', 'joins, fixed schema'),
      metricTones: { gives: 'warn' },
      scene: {
        nodes: [app, { ...doc, at: at(0, 0), status: 'active', badge: '1 doc = 1 product', chips: ['find color = red'] }],
        links: [link('app', 'doc')],
        flows: [
          { path: ['app', 'doc'], tone: 'request', label: 'find color = red', duration: 1.2 },
          { path: ['doc', 'app'], tone: 'response', label: 'product + variants', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Same collection, two shapes',
          icon: 'FileJson',
          code: '{ name: "laptop",\n  specs: { ram_gb: 16 } }\n\n{ name: "shoe",\n  specs: { drop_mm: 6 },\n  variants: [ {size: 42} ] }',
        },
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
      title: 'Document cost',
      tag: 'tradeoff',
      heading: 'What documents cost you',
      eli5: 'Because every box can hold anything, nobody checks what goes in. A few years later the shop has twelve kinds of doll box, and every helper must know them all.',
      body: [
        'Flexible schema means no schema. The shape now lives in your code. After a few years you have 12 versions of the user document and every reader must handle all of them.',
        'Joins are manual. If you already run Postgres, a `JSONB` column covers many of these cases.',
      ],
      keyIdea: 'You trade joins and an enforced schema for flexibility. Postgres JSONB is often enough.',
      metrics: m('MongoDB', 'fields + indexes', 'built-in sharding', 'joins, fixed schema'),
      metricTones: { gives: 'bad' },
      scene: {
        nodes: [
          { ...app, chips: [{ text: 'handles v1 to v12', tone: 'warn' }] },
          { ...doc, at: at(0, 0), status: 'hot', badge: '12 user shapes' },
          { ...pg, at: at(3.8, 0), status: 'ok', badge: 'JSONB column' },
        ],
        links: [link('app', 'doc'), link('app', 'pg', { style: 'faint' })],
        flows: [{ path: ['app', 'doc'], tone: 'request', label: 'user v7?', duration: 1.2 }],
        panel: {
          title: 'The schema moved to code',
          icon: 'Code',
          rows: [
            { text: 'Schema check on write', value: 'none', tone: 'bad' },
            { text: 'Join across collections', value: 'by hand', tone: 'warn' },
            { text: 'Already on Postgres', value: 'try JSONB', tone: 'good' },
          ],
        },
      },
    },
    {
      title: 'Wide-column',
      tag: 'concept',
      heading: 'Wide-column: built for a firehose of writes',
      eli5: '**Cassandra** is a long row of labeled bins with many helpers dropping in new slips very fast. You can only find a slip again if you know which bin to open.',
      body: [
        'Stores such as **Cassandra**, ScyllaDB, HBase and Bigtable organize data by a **partition key** plus sorted columns inside each partition. One device\'s readings for one day sit together, sorted by time.',
        'Writes go to memory and an append-only log, then flush to disk in big sequential chunks (an **LSM tree**). Each node takes 10K to 50K operations per second. Add nodes to add capacity.',
      ],
      keyIdea: 'Wide-column stores take huge write volumes and scale out by adding nodes.',
      metrics: m('Cassandra', 'partition key', '10K to 50K/node', 'ad hoc queries'),
      metricTones: { scale: 'good', gives: 'warn' },
      scene: {
        nodes: [
          { ...app, chips: [{ text: '80K writes/s', tone: 'good' }] },
          { ...wide, at: at(0, 0), status: 'active', load: 45, badge: '8 nodes' },
        ],
        links: [link('app', 'wide')],
        flows: [
          { path: ['app', 'wide'], tone: 'request', label: 'append event', count: 6, duration: 1.2 },
          { path: ['wide', 'app'], tone: 'response', label: 'ack', duration: 1, delay: 1.4 },
        ],
        panel: {
          title: 'One partition, sorted by time',
          icon: 'Table',
          code: 'PRIMARY KEY ((device_id, day), ts)\n\ndevice 7 · 2026-11-17\n  08:00:01  21.4\n  08:00:02  21.5\n  08:00:03  21.5',
        },
      },
    },
    {
      title: 'Wide-column catch',
      tag: 'tradeoff',
      heading: 'The catch: one table per query',
      eli5: 'The bins are labeled by device and day. Ask for a bin by its label and it is instant. Ask "which slips were warm?" and a helper must open every bin.',
      body: [
        'You design one table per query. Ask for anything that does not start with the partition key and the cluster scans everything. Deletes leave **tombstones** that compaction must clean up.',
        'Sharded SQL covers the middle range (20K to 50K writes/s). Wide-column pays off above roughly 50K writes/s: IoT, logs, audit trails, chat history.',
      ],
      keyIdea: 'Wide-column answers only the queries you designed the tables for, and is worth it only at very high write volume.',
      metrics: m('Cassandra', 'partition key', '10K to 50K/node', 'ad hoc queries'),
      metricTones: { gives: 'bad' },
      scene: {
        nodes: [app, { ...wide, at: at(0, 0), status: 'active', load: 45 }],
        links: [link('app', 'wide')],
        flows: [
          { path: ['app', 'wide'], tone: 'request', label: 'device 7, today', duration: 1.2 },
          { path: ['wide', 'app'], tone: 'response', label: '1 partition', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'What you can ask',
          icon: 'Search',
          rows: [
            { text: 'device 7, one day, by time', value: 'fast', tone: 'good' },
            { text: 'every warm reading', value: 'full scan', tone: 'bad' },
            { text: 'Deleted rows', value: 'tombstones', tone: 'warn' },
          ],
          footer: { text: 'Worth it above about 50K writes/s', tone: 'muted' },
        },
      },
    },
    {
      title: 'Graph',
      tag: 'concept',
      heading: 'Graph: follow the strings',
      eli5: 'The string map on the wall shows which kids are friends. To find friends of friends you follow the strings from kid to kid, no matter how many hops.',
      body: [
        'A **graph database** (Neo4j, Neptune) stores nodes and edges and follows them directly. "Friends of friends who bought this" is a short traversal. In SQL each hop is another self-join.',
        'Most graph problems are fine in SQL until traversals pass about 3 hops on billions of edges.',
      ],
      keyIdea: 'Reach for a graph store when the questions are about connections many hops deep.',
      metrics: m('Neo4j', 'edges', 'many-hop paths', 'bulk writes'),
      metricTones: { gives: 'warn' },
      scene: {
        nodes: [app, { ...graph, at: at(0, 0), status: 'active', badge: '4 hops', chips: ['friends of friends'] }],
        links: [link('app', 'graph')],
        flows: [
          { path: ['app', 'graph'], tone: 'request', label: 'friends of friends', duration: 1.2 },
          { path: ['graph', 'app'], tone: 'response', label: 'paths', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Hops',
          icon: 'Share2',
          rows: [
            { text: 'Graph store', value: 'follows edges', tone: 'good' },
            { text: 'SQL, each hop', value: 'another self-join', tone: 'warn' },
            { text: 'SQL is fine up to', value: '~3 hops', tone: 'muted' },
          ],
        },
      },
      quiz: {
        question: 'The fraud team wants to find accounts linked to a known fraudster through shared cards, devices and addresses, up to 5 hops away. Which store fits best?',
        options: ['Redis', 'A graph database', 'Elasticsearch', 'Cassandra'],
        answer: 1,
        explain: 'This is a many-hop traversal over a highly connected dataset, which is exactly what graph stores are built for. In SQL it would be five self-joins.',
      },
    },
    {
      title: 'Search',
      tag: 'concept',
      heading: 'Search: an index of words',
      eli5: 'A **search engine** is the shop\'s picture catalog: look up a word and it lists every toy that matches. It is a copy made from the cabinet, so it can be a moment behind.',
      body: [
        'A **search engine** (Elasticsearch, OpenSearch) builds an **inverted index**: for every word, the list of documents that contain it. It ranks by relevance, handles typos and filters by many facets. `LIKE \'%shoe%\'` in SQL cannot use a normal index.',
        'Search is never the source of truth. It holds a copy about 1 second behind.',
      ],
      keyIdea: 'A search index answers text questions fast, and always sits beside a main database.',
      metrics: m('Elasticsearch', 'words', '< 100 ms search', 'source of truth'),
      metricTones: { gives: 'warn' },
      scene: {
        nodes: [app, { ...pg, at: at(0, -3.8), status: 'ok', badge: 'source of truth' }, { ...search, at: at(0, 3.8), status: 'active', badge: '35 ms', chips: ['q=red shoes'] }],
        links: [link('app', 'search'), link('pg', 'search', { style: 'dashed', label: 'copy, ~1 s behind', labelTone: 'warn' })],
        flows: [
          { path: ['pg', 'search'], tone: 'data', label: 'changed rows', duration: 1.2 },
          { path: ['app', 'search'], tone: 'request', label: 'q=red shoes', duration: 1.2, delay: 1.4 },
          { path: ['search', 'app'], tone: 'response', label: 'ranked hits', duration: 1.2, delay: 2.7 },
        ],
        panel: {
          title: 'Inverted index',
          icon: 'Search',
          code: 'red    -> 3, 42, 88\nshoe   -> 42, 57\ntrail  -> 42\n\nred shoes -> 42',
        },
      },
    },
    {
      title: 'Time-series',
      tag: 'concept',
      heading: 'Time-series: values indexed by time',
      eli5: 'The shop writes down the temperature every minute. A special notebook squeezes old pages small and can quickly tell you the average for last Tuesday.',
      body: [
        'A **time-series database** (InfluxDB, TimescaleDB, Prometheus) takes append-only, timestamped writes and answers time-range reads, rollups and percentiles. A plain Postgres table struggles at a billion rows, so Timescale adds partitioning and compression on top of Postgres.',
        'It compresses 10 to 100 times and downsamples old data natively. Use it for metrics, IoT telemetry and stock price ticks.',
      ],
      keyIdea: 'Metrics and sensor data are written by time and read by time range. A time-series store is built for that shape.',
      metrics: m('TimescaleDB', 'time range + tags', 'billions of points', 'general queries'),
      metricTones: { scale: 'good' },
      scene: {
        nodes: [app, { ...ts, at: at(0, 0), status: 'active', badge: '10x to 100x smaller', chips: ['cpu avg, last 1 h'] }],
        links: [link('app', 'ts')],
        flows: [
          { path: ['app', 'ts'], tone: 'request', label: 'cpu=71 @ 08:00:01', count: 3, duration: 1.2 },
          { path: ['ts', 'app'], tone: 'response', label: 'avg 64', duration: 1.2, delay: 1.5 },
        ],
        panel: {
          title: 'Plain table vs time-series store',
          icon: 'Clock',
          rows: [
            { text: 'Plain billion-row table', value: 'queries time out', tone: 'bad' },
            { text: 'Range query', value: 'ms', tone: 'good' },
            { text: 'Old data', value: 'downsampled', tone: 'good' },
          ],
        },
      },
    },
    {
      title: 'Warehouse',
      tag: 'concept',
      heading: 'Warehouse: questions about everything at once',
      eli5: 'The owner wants total sales per month for two years. Asking the busy shopkeeper stops the shop, so someone copies the order cards to a back room built for adding up.',
      body: [
        'OLTP databases (Postgres, MySQL) choke on "sum revenue by country by month over 2 years". A **data warehouse** is a columnar, parallel store built for such scans over billions of rows. It reads only the columns a query needs and compresses them well.',
        'It is fed from your main database, usually on a schedule. A later lesson covers it.',
      ],
      keyIdea: 'Run analytics in a warehouse so big scans never slow down checkout.',
      metrics: m('Warehouse', 'big scans', 'billions of rows', 'ms latency'),
      metricTones: { gives: 'warn' },
      scene: {
        nodes: [
          { ...pg, at: at(-3.8, 0), status: 'ok', badge: 'checkout, ms' },
          { ...wh, at: at(0, 0), status: 'active', chips: ['sum revenue by month'] },
          { id: 'analyst', kind: 'user', at: at(3.8, 0), label: 'analyst' },
        ],
        links: [link('pg', 'wh', { style: 'dashed', label: 'nightly copy' }), link('wh', 'analyst')],
        flows: [
          { path: ['pg', 'wh'], tone: 'data', label: 'orders', duration: 1.2 },
          { path: ['analyst', 'wh'], tone: 'request', label: 'revenue by month', duration: 1.2, delay: 1.4 },
          { path: ['wh', 'analyst'], tone: 'response', label: '24 rows', duration: 1.2, delay: 2.7 },
        ],
        panel: {
          title: 'OLTP vs OLAP',
          icon: 'Warehouse',
          rows: [
            { text: 'OLTP: many small reads and writes', value: 'ms' },
            { text: 'OLAP: few huge scans', value: 's to min' },
            { text: 'Sum one column over 1B rows', value: 'reads only that column' },
          ],
        },
      },
    },
    {
      title: 'Access patterns',
      tag: 'case',
      heading: 'Case: the shop picks its stores',
      eli5: 'An **access pattern** is how you put things in and take them out. Order cards go in the drawer cabinet, bags on the coat hooks, toy names in the picture catalog.',
      body: [
        'The team lists its access patterns. **Checkout** changes stock, orders and payments together, so it needs transactions: PostgreSQL. **Sessions** are read by key on every request: Redis. **Catalog search** needs relevance and facets: Elasticsearch, fed from Postgres.',
      ],
      keyIdea: 'Match each access pattern to the family built for it.',
      metrics: m('Postgres + Redis + ES', 'per access path', '1K w/s today', 'one-store simplicity'),
      scene: {
        nodes: [
          { ...app, status: 'active' },
          { ...pg, at: at(0, -3.8), status: 'ok', badge: 'orders' },
          { ...kv, at: at(3.8, 0), status: 'ok', badge: 'sessions' },
          { ...search, at: at(0, 3.8), status: 'ok', badge: 'product search' },
        ],
        links: [link('app', 'pg'), link('app', 'kv'), link('app', 'search'), link('pg', 'search', { style: 'dashed', label: 'sync' })],
        flows: [
          { path: ['app', 'kv'], tone: 'request', label: 'GET session', duration: 0.9 },
          { path: ['app', 'pg'], tone: 'request', label: 'INSERT order', duration: 1.1, delay: 1 },
          { path: ['pg', 'search'], tone: 'data', label: 'changed rows', duration: 1.2, delay: 2.2 },
          { path: ['app', 'search'], tone: 'request', label: 'q=red shoes', duration: 1.1, delay: 3.4 },
        ],
        panel: {
          title: 'Pattern to store',
          icon: 'Table',
          rows: [
            { text: 'Checkout, together', value: 'PostgreSQL' },
            { text: 'Sessions, by key', value: 'Redis' },
            { text: 'Catalog search', value: 'Elasticsearch' },
          ],
        },
      },
    },
    {
      title: 'Fewest stores',
      tag: 'case',
      heading: 'Use the fewest stores that cover the patterns',
      eli5: 'The shop could buy every kind of furniture, but each piece needs dusting and fixing. It buys only what a real job needs.',
      body: [
        'The catalog has varied attributes, which points at a document store. They use a Postgres `JSONB` column instead, because each new engine is one more thing to back up, monitor and get paged for.',
        'No pattern needs a graph or wide-column store yet. Writes are at 1K/s, far from the 5K to 20K ceiling.',
      ],
      keyIdea: 'Each extra engine must earn its operational cost.',
      metrics: m('Postgres + Redis + ES', 'per access path', '1K w/s today', 'one-store simplicity'),
      metricTones: { scale: 'good' },
      scene: {
        nodes: [
          { ...pg, at: at(-3.8, 0), status: 'ok', badge: 'orders + JSONB catalog', load: 20 },
          { ...doc, at: at(0, -3.8), status: 'dim', badge: 'skipped' },
          { ...wide, at: at(0, 3.8), status: 'dim', badge: 'skipped' },
        ],
        links: [link('pg', 'doc', { style: 'faint' }), link('pg', 'wide', { style: 'faint' })],
        panel: {
          title: 'Every extra engine means',
          icon: 'Boxes',
          rows: [
            { text: 'Backups', value: 'one more', tone: 'warn' },
            { text: 'Monitoring and on-call', value: 'one more', tone: 'warn' },
            { text: 'Sync lag to keep in line', value: 'one more', tone: 'warn' },
          ],
          footer: { text: 'Writes at 1K/s, ceiling 5K to 20K', tone: 'good' },
        },
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Match the store to the access pattern',
      eli5: 'First write down how you will put things in and take them out. Start with the drawer cabinet, **SQL**, and add hooks, boxes, bins, strings or a catalog only when the cabinet cannot do the job.',
      body: [
        'Start with SQL: tables, joins, indexes and ACID cover most products. It runs out on write volume (5K to 20K writes/s), dataset size (2 to 10 TB) or data shape.',
        'Then pick the family that matches the pattern, and the brand comes last.',
      ],
      keyIdea: 'Write down how the data is read and written. The family follows from that, and the brand comes last.',
      metrics: m('Postgres + Redis + ES', 'per access path', '1K w/s today', 'one-store simplicity'),
      metricTones: { scale: 'good' },
      scene: {
        nodes: [
          { ...pg, at: at(-3.8, 0), status: 'ok', badge: 'default' },
          { ...kv, at: at(0, -3.8), status: 'ok' },
          { ...search, at: at(0, 3.8), status: 'ok' },
        ],
        links: [link('pg', 'kv', { style: 'faint' }), link('pg', 'search', { style: 'faint' })],
        panel: {
          title: 'Need to family',
          icon: 'List',
          rows: [
            { text: 'Rules across rows', value: 'SQL' },
            { text: 'Known key', value: 'key-value' },
            { text: 'Varied, nested', value: 'document' },
            { text: 'Huge writes, fixed query', value: 'wide-column' },
            { text: 'Deep links / text', value: 'graph / search' },
            { text: 'Metrics by time', value: 'time-series' },
          ],
        },
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
