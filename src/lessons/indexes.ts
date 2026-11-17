import type { Lesson, SceneNode } from '../engine/types';

/** Place a node by screen column (x - y) and screen row (x + y). */
const p = (col: number, row: number): [number, number] => [(col + row) / 2, (row - col) / 2];

const client: SceneNode = { id: 'client', kind: 'client', at: p(-7, 0), label: 'support tool', sub: 'order lookup' };
const app: SceneNode = { id: 'app', kind: 'server', at: p(-4, 0), label: 'app server' };
const db: SceneNode = { id: 'db', kind: 'db', at: p(-1, 0), label: 'Postgres', sub: 'query planner' };
const idx: SceneNode = { id: 'idx', kind: 'block', at: p(2, -2.5), label: 'index', sub: 'B-tree', icon: 'Search', tint: 'violet' };
const table: SceneNode = { id: 'table', kind: 'storage', at: p(5, 1), label: 'orders table', sub: '50M rows · 10 GB' };
const writer: SceneNode = { id: 'writer', kind: 'worker', at: p(-4, 0), label: 'checkout', sub: '2,000 inserts/s' };
const pk: SceneNode = { id: 'pk', kind: 'block', at: p(4, 3), label: 'primary key', sub: 'tree holds the rows', icon: 'Key', tint: 'blue' };

const pathLinks = [
  { from: 'client', to: 'app' },
  { from: 'app', to: 'db' },
];
const indexLinks = [...pathLinks, { from: 'db', to: 'idx' }, { from: 'idx', to: 'table', style: 'dashed' as const, label: 'row pointers' }];

export const indexes: Lesson = {
  id: 'indexes',
  title: 'Indexes and query tuning',
  tagline: 'Turn a four-second table scan into a one-millisecond lookup, and learn what every index costs you.',
  minutes: 18,
  level: 'Intermediate',
  learn: [
    'Why a query without an index reads the whole table',
    'How a B-tree finds one row among 50 million in four page reads',
    'Selectivity, composite indexes, column order and covering indexes',
    'Primary, secondary, unique, partial and hash indexes, and B-tree against LSM',
    'Why every index slows down writes, and how to keep an index budget',
    'Reading EXPLAIN, and the common reasons an index is ignored',
    'Keyset pagination, and spotting and fixing N+1 queries',
  ],
  metrics: [
    { key: 'time', label: 'Query time', icon: 'Timer' },
    { key: 'rows', label: 'Rows read', icon: 'Table' },
    { key: 'indexes', label: 'Indexes', icon: 'Layers' },
    { key: 'insert', label: 'Insert cost', icon: 'Download' },
  ],
  steps: [
    {
      title: 'Full scan',
      tag: 'problem',
      heading: 'One customer, 50 million rows read',
      eli5: 'A library has millions of books in no order. To find the books by one author, the librarian walks past every shelf. The **full scan** is that long walk.',
      body: [
        'The support tool shows a customer their orders: `SELECT * FROM orders WHERE customer_id = 8841`. The `orders` table has **50 million rows** and takes 10 GB. The only index is the primary key on `id`.',
        'The database cannot know where customer 8841 lives, so it reads every row and keeps the 40 that match. This is a **full table scan**. It takes about **4 seconds**, and ten agents at once keep the disk busy with thrown-away work.',
      ],
      keyIdea: 'Without an index on the filtered column, the database must read every row to find a few.',
      metrics: { time: '4 s', rows: '50,000,000', indexes: '1 (primary key)', insert: '0.1 ms' },
      metricTones: { time: 'bad', rows: 'bad' },
      scene: {
        nodes: [
          { ...client, chips: ['customer 8841'] },
          { ...app, status: 'hot', badge: 'waiting 4 s' },
          { ...db, status: 'hot', load: 95, badge: 'seq scan' },
          { ...table, status: 'hot', badge: 'reads all 10 GB' },
        ],
        links: [...pathLinks, { from: 'db', to: 'table', label: '50M rows', labelTone: 'warn' }],
        flows: [
          { path: ['client', 'app', 'db'], tone: 'request', label: 'customer 8841', duration: 1.4 },
          { path: ['db', 'table'], tone: 'request', label: 'read every row', count: 8, duration: 2.6, delay: 1.5 },
          { path: ['table', 'db', 'app', 'client'], tone: 'response', label: '40 rows', duration: 1.8, delay: 4.3 },
        ],
        panel: {
          title: 'The scan',
          icon: 'Table',
          rows: [
            { text: 'Rows in table', value: '50,000,000' },
            { text: 'Rows that match', value: '40', tone: 'good' },
            { text: 'Rows read and thrown away', value: '49,999,960', tone: 'bad' },
          ],
          footer: { text: 'Cost grows with the table', tone: 'bad' },
        },
        caption: '50 million rows read to return 40',
      },
    },
    {
      title: 'Index basics',
      tag: 'concept',
      heading: 'An index is a sorted copy of one column',
      eli5: 'The library adds a card catalog sorted by author. Each card says which shelf holds the book. The **index** is that catalog.',
      body: [
        'An **index** is a separate structure that keeps one column sorted and stores, next to each value, a pointer to its row in the table. Sorted data can be searched by halving the range, never by reading everything.',
        'The table stays as it was. The index is an extra copy of `customer_id` plus pointers, kept in order by the database.',
      ],
      keyIdea: 'An index is a sorted structure of keys and row pointers, kept next to the table.',
      metrics: { time: '4 s', rows: '50,000,000', indexes: '2', insert: '0.15 ms' },
      scene: {
        nodes: [{ ...db, status: 'active' }, { ...idx, status: 'active', sub: 'customer_id, sorted' }, table],
        links: [{ from: 'db', to: 'idx' }, { from: 'idx', to: 'table', style: 'dashed', label: 'row pointers' }],
        flows: [{ path: ['db', 'idx', 'table'], tone: 'data', label: '8841 to row', duration: 2 }],
        panel: {
          title: 'Index entries (sorted)',
          icon: 'List',
          rows: [
            { text: 'customer_id 8840', value: '→ page 912' },
            { text: 'customer_id 8841', value: '→ 40 pointers', tone: 'good' },
            { text: 'customer_id 8842', value: '→ page 55' },
            { text: 'customer_id 8843', value: '→ page 4,017' },
          ],
          footer: { text: 'Next to the table, not inside it', tone: 'muted' },
        },
        caption: 'Sorted keys, each with a pointer',
      },
    },
    {
      title: 'B-tree levels',
      tag: 'concept',
      heading: 'A wide, shallow tree: 4 levels for 50 million keys',
      eli5: 'The catalog has a big sign on the door that says which drawer has which letters. Then each drawer has dividers. Two or three choices and the librarian holds the right card.',
      body: [
        'Most databases build the index as a **B-tree**. Each node is one disk page holding a few hundred keys, so each step down the tree rules out all but one of a few hundred children. Real indexes are **B+ trees**: data pointers live only in the leaves, and the leaves are linked for range scans.',
        'A few hundred keys per page means 50 million entries fit in about **4 levels**. Reaching the leaf takes four page reads, and the top levels usually sit in memory already.',
      ],
      keyIdea: 'A B-tree lookup costs a handful of page reads, and that number barely grows as the table grows.',
      metrics: { time: '-', rows: '4 pages', indexes: '2', insert: '0.15 ms' },
      scene: {
        nodes: [{ ...db, status: 'active', badge: 'walks the tree' }, { ...idx, status: 'ok', badge: '4 levels' }],
        links: [{ from: 'db', to: 'idx' }],
        flows: [{ path: ['db', 'idx'], tone: 'request', label: 'find 8841', count: 4, duration: 2 }],
        panel: {
          title: 'Keys reachable by depth',
          icon: 'Layers',
          rows: [
            { text: '1 level', value: '~300 keys' },
            { text: '2 levels', value: '~90,000' },
            { text: '3 levels', value: '~27 million (not enough)', tone: 'warn' },
            { text: '4 levels', value: '~8 billion (enough for 50M)', tone: 'good' },
          ],
          footer: { text: '4 page reads reach any key', tone: 'good' },
        },
        caption: 'Each level cuts the search by a few hundred',
      },
    },
    {
      title: 'Lookup',
      tag: 'concept',
      heading: 'Four page reads, then 40 row fetches',
      eli5: 'The librarian opens the right drawer, finds the card, and it names 40 shelves. Walking to just those shelves takes a moment instead of a whole afternoon.',
      body: [
        'The leaf holds the 40 pointers for customer 8841. The database follows them into the table and fetches 40 rows. Total work: about 44 page reads, most already in memory. The query drops from 4 seconds to about **1 ms**.',
        'A B-tree is sorted, so a range such as `BETWEEN 8000 AND 8100` works as well: find the start, then read leaf entries in order.',
      ],
      keyIdea: 'An index scan reads a tree path plus only the matching rows, instead of the whole table.',
      metrics: { time: '1 ms', rows: '40', indexes: '2', insert: '0.15 ms' },
      metricTones: { time: 'good', rows: 'good' },
      scene: {
        nodes: [client, app, { ...db, status: 'active', badge: 'index scan' }, { ...idx, status: 'ok', badge: '4 levels' }, { ...table, badge: '40 rows fetched' }],
        links: indexLinks,
        flows: [
          { path: ['client', 'app', 'db'], tone: 'request', label: 'customer 8841', duration: 1.2 },
          { path: ['db', 'idx'], tone: 'request', label: 'find 8841', duration: 0.8, delay: 1.3 },
          { path: ['idx', 'table'], tone: 'data', label: '40 pointers', duration: 0.8, delay: 2.2 },
          { path: ['table', 'db', 'app', 'client'], tone: 'response', label: '40 rows', duration: 1.6, delay: 3.1 },
        ],
        panel: {
          title: 'Page reads',
          icon: 'Table',
          rows: [
            { text: 'Tree path', value: '4 pages' },
            { text: 'Row fetches', value: '40 pages' },
            { text: 'Total', value: '~44 (was 1.2M)', tone: 'good' },
          ],
          footer: { text: '4 s becomes 1 ms', tone: 'good' },
        },
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
        '**Selectivity** is the share of rows a condition keeps. `customer_id = 8841` keeps 40 of 50 million, which is highly selective. `status = \'delivered\'` keeps 90% of the table.',
        'At 90% the planner skips an index on `status` and scans, because 45 million scattered row fetches are slower than one sequential pass. Index the columns in `WHERE`, `JOIN` and `ORDER BY` that cut the result to a small slice.',
      ],
      keyIdea: 'An index pays off when the condition keeps a small fraction of the table. For large fractions a sequential scan wins.',
      metrics: { time: '1 ms', rows: '40', indexes: '2', insert: '0.15 ms' },
      scene: {
        nodes: [
          { ...db, at: p(-4, 0), status: 'active', badge: 'compares conditions' },
          { ...idx, at: p(0, -2.5), status: 'ok', sub: 'customer_id', badge: 'keeps 40' },
          { ...table, badge: '50M rows' },
        ],
        links: [{ from: 'db', to: 'idx' }, { from: 'idx', to: 'table', style: 'dashed' }],
        flows: [{ path: ['db', 'idx', 'table'], tone: 'request', duration: 1.8 }],
        panel: {
          title: 'Share of rows kept',
          icon: 'Gauge',
          rows: [
            { text: 'customer_id = 8841', value: '0.00008%', tone: 'good' },
            { text: "country = 'IN'", value: '18%', tone: 'warn' },
            { text: "status = 'delivered'", value: '90%, scan wins', tone: 'bad' },
          ],
          footer: { text: 'Fewer rows kept, better index', tone: 'muted' },
        },
        caption: 'The smaller the slice, the better the index',
      },
    },
    {
      title: 'Composite index',
      tag: 'concept',
      heading: 'A composite index serves filter and sort together',
      eli5: 'The catalog is sorted by author, and by year inside each author. Finding "this author, newest first" is one drawer, already in order.',
      body: [
        'The order page asks for a customer\'s ten newest orders: `WHERE customer_id = 8841 ORDER BY created_at DESC LIMIT 10`. With the single-column index, the database fetches all 40 rows and sorts them. For a customer with 30,000 orders that sort hurts.',
        'A **composite index** on `(customer_id, created_at)` sorts by customer, then by date inside each customer. The database jumps to customer 8841, reads the last ten entries and stops. No sort step.',
      ],
      keyIdea: 'A composite index can return rows already sorted, so the sort step disappears.',
      metrics: { time: '0.3 ms', rows: '10', indexes: '2', insert: '0.15 ms' },
      metricTones: { time: 'good', rows: 'good' },
      scene: {
        nodes: [
          { ...db, status: 'active', badge: 'no sort needed' },
          { ...idx, status: 'ok', sub: '(customer_id, created_at)', badge: 'reads 10 entries' },
          { ...table, badge: '10 rows fetched' },
        ],
        links: [{ from: 'db', to: 'idx' }, { from: 'idx', to: 'table', style: 'dashed', label: '10 pointers' }],
        flows: [
          { path: ['db', 'idx'], tone: 'request', label: '8841, newest first', duration: 0.8 },
          { path: ['idx', 'table'], tone: 'data', label: '10 pointers', duration: 0.8, delay: 1 },
          { path: ['table', 'db'], tone: 'response', label: '10 rows', duration: 0.8, delay: 1.9 },
        ],
        panel: {
          title: 'Entries for customer 8841',
          icon: 'List',
          rows: [
            { text: '8841 · 2026-03-14', value: '→ row' },
            { text: '8841 · 2026-03-02', value: '→ row' },
            { text: '8841 · 2026-02-27', value: '→ row' },
            { text: '... 7 more, then stop', tone: 'muted' },
          ],
          footer: { text: 'Already sorted by date', tone: 'good' },
        },
        caption: 'Already sorted by date inside each customer',
      },
    },
    {
      title: 'Leftmost prefix',
      tag: 'concept',
      heading: 'Column order decides which queries the index serves',
      eli5: 'The catalog is sorted by author first. Asking for "everything from 2019" is no help, because that year is spread across every author.',
      body: [
        'The index is sorted left to right, like a phone book sorted by last name and then first name. It serves queries on `customer_id` alone, or on `customer_id` plus `created_at`. It cannot serve `created_at` alone. This is the **leftmost prefix** rule.',
        'Put equality columns first and the range or sort column last.',
      ],
      keyIdea: 'A composite index works for any leftmost prefix of its columns. Equality columns go first, the range or sort column last.',
      metrics: { time: '0.3 ms', rows: '10', indexes: '2', insert: '0.15 ms' },
      scene: {
        nodes: [
          { ...db, status: 'active' },
          { ...idx, status: 'ok', sub: '(customer_id, created_at)' },
          { ...table, status: 'dim' },
        ],
        links: [{ from: 'db', to: 'idx' }, { from: 'idx', to: 'table', style: 'faint' }],
        flows: [{ path: ['db', 'idx'], tone: 'request', label: 'which prefix?', duration: 1.4 }],
        panel: {
          title: 'Index on (customer_id, created_at)',
          icon: 'Key',
          rows: [
            { text: 'customer_id = ?', value: 'uses index', tone: 'good' },
            { text: 'customer_id = ? AND created_at', value: 'uses index', tone: 'good' },
            { text: 'created_at only', value: 'cannot use', tone: 'bad' },
          ],
          footer: { text: 'Skip the first column and it is no help', tone: 'warn' },
        },
        caption: 'Sorted left to right',
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
        'The order list shows date, total and status. The composite index finds ten entries, then the database visits the table ten times for `total` and `status`.',
        'A **covering index** carries every column the query needs: `INCLUDE (total, status)` stores them in the leaves, and an **index-only scan** can skip the table. The price is a bigger index.',
        'Postgres still visits the table for pages not marked all-visible in the visibility map, so heavy churn or a lagging `VACUUM` brings those visits back.',
      ],
      keyIdea: 'If the index holds every column the query reads, the database can skip the table.',
      metrics: { time: '0.1 ms', rows: '10 (index only)', indexes: '2', insert: '0.17 ms' },
      metricTones: { time: 'good' },
      scene: {
        nodes: [
          { ...db, status: 'active', badge: 'index-only scan' },
          { ...idx, status: 'ok', sub: '+ total, status', badge: 'has every column' },
          { ...table, status: 'dim', badge: 'not touched' },
        ],
        links: [{ from: 'db', to: 'idx' }, { from: 'idx', to: 'table', style: 'faint' }],
        flows: [
          { path: ['db', 'idx'], tone: 'request', duration: 0.8 },
          { path: ['idx', 'db'], tone: 'response', label: 'date, total, status', duration: 0.8, delay: 1 },
        ],
        panel: {
          title: 'Plain against covering',
          icon: 'Layers',
          rows: [
            { text: 'Composite only', value: '10 index + 10 table reads', tone: 'warn' },
            { text: 'With INCLUDE (total, status)', value: '10 index reads', tone: 'good' },
            { text: 'Pages not all-visible', value: 'still visit the table', tone: 'warn' },
            { text: 'Insert cost', value: '0.15 to 0.17 ms' },
          ],
          footer: { text: 'Bigger index, fewer table visits', tone: 'muted' },
        },
        caption: 'The answer comes straight out of the index',
      },
      code: {
        language: 'sql',
        title: 'A covering index and its plan',
        source: `CREATE INDEX idx_orders_cover
    ON orders (customer_id, created_at)
  INCLUDE (total, status);

EXPLAIN ANALYZE
SELECT created_at, total, status FROM orders
 WHERE customer_id = 8841 ORDER BY created_at DESC LIMIT 10;
--  Index Only Scan Backward using idx_orders_cover
--    Heap Fetches: 0`,
        highlight: [1, 2, 3, 8, 9],
      },
    },
    {
      title: 'Write cost',
      tag: 'tradeoff',
      heading: 'Every index is paid for on every write',
      eli5: 'Each new book needs a new card in every catalog the library keeps. With six catalogs, shelving one book means filing six cards. More **indexes** means slower shelving.',
      body: [
        'Over a year the team adds an index for each slow report. The table now has **6 indexes**. Each `INSERT` writes the row and then one entry into each of the six trees. Each `UPDATE` of an indexed column and each `DELETE` touches them too.',
        'Checkout inserts 2,000 orders per second. Insert time climbs from 0.1 ms to **0.5 ms**, the write-ahead log grows several times faster, and the six indexes together take 14 GB, more than the table.',
      ],
      keyIdea: 'Indexes trade write speed, disk and memory for read speed.',
      metrics: { time: '0.1 ms', rows: '10', indexes: '6', insert: '0.5 ms' },
      metricTones: { time: 'good', indexes: 'warn', insert: 'bad' },
      scene: {
        nodes: [
          { ...writer, status: 'active', chips: ['INSERT order'] },
          { ...db, status: 'hot', sub: undefined, load: 78, badge: '7 writes per row' },
          { ...idx, status: 'hot', label: '6 indexes', sub: '14 GB total', badge: '6 tree inserts' },
          { ...table, badge: '1 row insert' },
        ],
        links: [{ from: 'writer', to: 'db' }, { from: 'db', to: 'idx' }, { from: 'db', to: 'table' }],
        flows: [
          { path: ['writer', 'db'], tone: 'request', label: 'INSERT order', count: 3, duration: 1 },
          { path: ['db', 'table'], tone: 'data', label: 'row', duration: 1, delay: 1.1 },
          { path: ['db', 'idx'], tone: 'data', label: 'x6', count: 6, duration: 1.6, delay: 1.1 },
        ],
        panel: {
          title: 'Insert cost by index count',
          icon: 'Download',
          rows: [
            { text: '1 index (primary key)', value: '0.1 ms', tone: 'good' },
            { text: '2 indexes', value: '0.15 ms' },
            { text: '6 indexes', value: '0.5 ms', tone: 'bad' },
          ],
          footer: { text: 'Also more WAL, disk and memory', tone: 'warn' },
        },
        caption: 'One insert, seven structures to update',
      },
    },
    {
      title: 'Index budget',
      tag: 'tradeoff',
      heading: 'Treat indexes as a budget and prune them',
      eli5: 'The librarian checks which catalogs anyone opened this year. Cards nobody uses get thrown out, and two catalogs that say the same thing become one.',
      body: [
        'Check the usage statistics (`pg_stat_user_indexes` in Postgres) and drop indexes with zero scans. Drop overlapping ones too: `(customer_id)` is redundant once `(customer_id, created_at)` exists. Here that removes three of the six indexes.',
        'Indexes also bloat as rows churn, so a rarely rebuilt one grows far past its useful size. `REINDEX CONCURRENTLY` rebuilds it without blocking writes.',
      ],
      keyIdea: 'Keep the indexes that earn their place, and drop the rest.',
      metrics: { time: '0.1 ms', rows: '10', indexes: '3', insert: '0.2 ms' },
      metricTones: { indexes: 'good', insert: 'good' },
      scene: {
        nodes: [
          { ...db, status: 'active', badge: 'usage stats' },
          { ...idx, status: 'ok', label: '3 indexes', sub: 'unused and redundant dropped' },
          { ...table },
        ],
        links: [{ from: 'db', to: 'idx' }, { from: 'idx', to: 'table', style: 'dashed' }],
        flows: [{ path: ['db', 'idx'], tone: 'request', label: 'idx_scan = 0?', duration: 1.4 }],
        panel: {
          title: 'pg_stat_user_indexes',
          icon: 'List',
          rows: [
            { text: 'idx_orders_customer_date', value: '2.1M scans', tone: 'good' },
            { text: 'idx_orders_customer', value: 'redundant', tone: 'warn' },
            { text: 'idx_orders_coupon', value: '0 scans', tone: 'bad' },
            { text: 'idx_orders_ref', value: '0 scans', tone: 'bad' },
          ],
          footer: { text: 'Drop three: 6 becomes 3', tone: 'good' },
        },
        caption: 'Insert cost falls from 0.5 ms to about 0.2 ms',
      },
    },
    {
      title: 'Clustered vs secondary',
      tag: 'concept',
      heading: 'Primary and secondary indexes',
      eli5: 'In one library the books themselves stand in author order, so the shelf is the catalog. Any other catalog, by title for example, only points back to those shelves.',
      body: [
        'In MySQL InnoDB the table is stored inside the **primary key** B-tree, a **clustered index**. A **secondary index** stores the primary key value, so a lookup walks two trees. Postgres keeps an unordered heap, and every index points to it directly.',
        'Primary key choice then matters: a random UUID inserts all over the tree, and a sequential id appends at the end.',
      ],
      keyIdea: 'A clustered index holds the rows themselves. Secondary indexes point at them.',
      metrics: { time: '0.3 ms', rows: '10', indexes: '3', insert: '0.2 ms' },
      scene: {
        nodes: [
          { ...db, at: p(-4, 0), label: 'MySQL', sub: 'InnoDB', status: 'active' },
          { ...idx, at: p(-1, -3), label: 'secondary', sub: 'email index', tint: 'violet', badge: 'stores primary key' },
          pk,
        ],
        links: [{ from: 'db', to: 'idx', label: '1: find id' }, { from: 'idx', to: 'pk', label: '2: fetch row' }],
        flows: [
          { path: ['db', 'idx'], tone: 'request', label: 'email = ana@...', duration: 1 },
          { path: ['idx', 'pk'], tone: 'data', label: 'id 7731', duration: 1, delay: 1.1 },
          { path: ['pk', 'db'], tone: 'response', label: 'row', duration: 1, delay: 2.2 },
        ],
        panel: {
          title: 'Where the row lives',
          icon: 'Key',
          rows: [
            { text: 'InnoDB primary key', value: 'is the table', tone: 'good' },
            { text: 'InnoDB secondary', value: 'two tree walks' },
            { text: 'Postgres any index', value: 'points at heap' },
          ],
          footer: { text: 'Sequential ids insert at the end', tone: 'muted' },
        },
        caption: 'Secondary index first, then the primary tree',
      },
    },
    {
      title: 'Unique indexes',
      tag: 'concept',
      heading: 'A unique index enforces a rule and serves the lookup',
      eli5: 'The librarian refuses to file a second card with the same library number, and the same sorted cards make finding a member instant.',
      body: [
        'A **unique index** is a normal B-tree with a rule on top: `CREATE UNIQUE INDEX ON users (email)` rejects a second row with the same email. Primary keys and `UNIQUE` constraints are built on one.',
        'The rule costs nothing extra. The database walks the tree to check for a duplicate, and the same walk serves `WHERE email = ...` lookups. A duplicate insert fails with an error instead of storing a second row.',
      ],
      keyIdea: 'A unique index is a lookup structure that also rejects duplicates.',
      metrics: { time: '0.2 ms', rows: '1', indexes: '3', insert: '0.2 ms' },
      metricTones: { time: 'good' },
      scene: {
        nodes: [
          { ...db, at: p(-4, 0), status: 'active', badge: 'checks for a duplicate' },
          { ...idx, at: p(0, -2.5), status: 'ok', label: 'users', sub: 'UNIQUE (email)', icon: 'Key', tint: 'green' },
        ],
        links: [{ from: 'db', to: 'idx' }],
        flows: [
          { path: ['db', 'idx'], tone: 'request', label: 'INSERT ana@...', duration: 1.2 },
          { path: ['idx', 'db'], tone: 'error', label: 'duplicate key', duration: 1.2, delay: 1.4 },
        ],
        panel: {
          title: 'One index, two jobs',
          icon: 'Key',
          rows: [
            { text: "WHERE email = 'ana@...'", value: 'tree lookup', tone: 'good' },
            { text: 'INSERT of an existing email', value: 'error, row rejected', tone: 'bad' },
            { text: 'Primary key, UNIQUE constraint', value: 'built on one', tone: 'muted' },
          ],
          footer: { text: 'The rule rides on the same tree walk', tone: 'muted' },
        },
        caption: 'The same walk finds the row and blocks the duplicate',
      },
      code: {
        language: 'sql',
        title: 'A unique index',
        source: `CREATE UNIQUE INDEX idx_users_email ON users (email);

INSERT INTO users (email) VALUES ('ana@example.com');
-- ERROR: duplicate key value violates unique constraint
--        "idx_users_email"`,
        highlight: [1, 3],
      },
    },
    {
      title: 'Index join keys',
      tag: 'concept',
      heading: 'Index foreign key and join columns',
      eli5: "The librarian keeps a catalog of which loans belong to each member, so finding one member's loans is instant instead of reading every loan slip.",
      body: [
        'A **foreign key** column is not indexed automatically in Postgres. Without an index on `order_items.order_id`, every join to orders scans the child table.',
        'The same missing index hurts deletes. Deleting one order with `ON DELETE CASCADE` has to find its child rows, so it scans all 300 million `order_items` unless `order_id` is indexed.',
      ],
      keyIdea: 'Index join and foreign key columns yourself. Postgres will not.',
      metrics: { time: '0.4 ms', rows: '12', indexes: '3', insert: '0.2 ms' },
      scene: {
        nodes: [
          { ...db, status: 'active', badge: 'JOIN orders, items' },
          { ...idx, status: 'ok', label: 'order_items', sub: 'index on order_id', icon: 'Key', tint: 'green' },
          { ...table, label: 'order_items', sub: '300M rows' },
        ],
        links: [{ from: 'db', to: 'idx' }, { from: 'idx', to: 'table', style: 'dashed' }],
        flows: [{ path: ['db', 'idx', 'table'], tone: 'request', label: 'order_id = 9001', duration: 1.8 }],
        panel: {
          title: 'Join on order_id',
          icon: 'Table',
          rows: [
            { text: 'Without index on order_id', value: 'scan 300M', tone: 'bad' },
            { text: 'With index on order_id', value: '~4 pages', tone: 'good' },
            { text: 'Cascading delete, no index', value: 'scan per delete', tone: 'bad' },
          ],
          footer: { text: 'Postgres does not index foreign keys for you', tone: 'warn' },
        },
        caption: 'Joins and cascading deletes both need the index',
      },
      code: {
        language: 'sql',
        title: 'Index the foreign key',
        source: `CREATE INDEX CONCURRENTLY idx_items_order
    ON order_items (order_id);

-- The join and the cascading delete now walk the tree.
SELECT * FROM order_items WHERE order_id = 9001;
DELETE FROM orders WHERE id = 9001;`,
        highlight: [1, 2],
      },
    },
    {
      title: 'Partial index',
      tag: 'concept',
      heading: 'Partial indexes cover only the rows you ask for',
      eli5: 'Most borrowed books are back on the shelf. The librarian keeps a tiny catalog of only the books currently out, because that is the only list anyone checks.',
      body: [
        'The ops dashboard looks for `status = \'pending\'` orders. That is 20,000 rows out of 50 million. A **partial index** includes only rows matching a condition: `CREATE INDEX ON orders (created_at) WHERE status = \'pending\'`.',
        'Rows enter the index as pending orders are inserted and leave it when the status changes, so it stays at about 20,000 entries. Writes that do not touch pending rows skip it. The query must repeat the same condition for the planner to use it.',
      ],
      keyIdea: 'Index only the rows you query. A small index is faster to scan and skipped by writes that do not touch those rows.',
      metrics: { time: '0.2 ms', rows: '20,000 max', indexes: '3', insert: '0.16 ms' },
      metricTones: { time: 'good' },
      scene: {
        nodes: [
          { ...db, status: 'active' },
          { ...idx, status: 'ok', sub: "WHERE status = 'pending'", badge: '20K entries · 3 MB' },
          { ...table, badge: '50M rows' },
        ],
        links: [{ from: 'db', to: 'idx' }, { from: 'idx', to: 'table', style: 'dashed' }],
        flows: [{ path: ['db', 'idx', 'table'], tone: 'request', label: 'pending orders', duration: 1.8 }],
        panel: {
          title: 'Full against partial',
          icon: 'Layers',
          rows: [
            { text: 'Full index on status', value: '50M entries · 1.1 GB', tone: 'warn' },
            { text: "Partial, status = 'pending'", value: '20K entries · 3 MB', tone: 'good' },
          ],
          footer: { text: 'Same query, far less to store', tone: 'good' },
        },
        caption: 'A small index for a hot slice',
      },
      code: {
        language: 'sql',
        title: 'A partial index',
        source: `-- Only pending orders are indexed.
CREATE INDEX idx_orders_pending
    ON orders (created_at)
 WHERE status = 'pending';

-- The query repeats the condition so the planner can match it.
SELECT * FROM orders
 WHERE status = 'pending' ORDER BY created_at LIMIT 50;`,
        highlight: [2, 3, 4, 8],
      },
    },
    {
      title: 'Other index types',
      tag: 'concept',
      heading: 'Hash, inverted, spatial and BRIN indexes',
      eli5: 'Besides the sorted catalog, a library can keep a lookup wheel that jumps straight to one author but cannot say who comes next, or a word list that names every book containing a word.',
      body: [
        'A **hash index** handles equality only, so the B-tree stays the default. Postgres can AND or OR several B-trees with a **bitmap scan**, a plan technique and not an index type. **Inverted** indexes (GIN) map each word, array item or JSON key to its rows.',
                '**Spatial** indexes (GiST, R-tree, geohash) answer "points within 2 km". A **BRIN** index keeps only min and max per block range, which suits huge time-ordered tables.',
      ],
      keyIdea: 'B-tree is the default. Pick hash, inverted, spatial or BRIN only when the question is not a sorted range.',
      metrics: { time: '-', rows: '-', indexes: '-', insert: '-' },
      scene: {
        nodes: [
          { id: 'btree', kind: 'block', at: p(-6, 0), label: 'B-tree', sub: 'equality, range, order', icon: 'Layers', tint: 'violet', status: 'ok' },
          { id: 'hash', kind: 'block', at: p(-2, 0), label: 'hash', sub: 'equality only', icon: 'Hash', tint: 'amber' },
          { id: 'gin', kind: 'block', at: p(2, 0), label: 'inverted', sub: 'words, arrays, JSON', icon: 'Search', tint: 'teal' },
          { id: 'geo', kind: 'block', at: p(6, 0), label: 'spatial', sub: 'GiST, R-tree', icon: 'MapPin', tint: 'green' },
        ],
        links: [],
        flows: [],
        panel: {
          title: 'Pick the structure',
          icon: 'List',
          rows: [
            { text: 'price > 100, ORDER BY date', value: 'B-tree', tone: 'good' },
            { text: "session_id = 'a91f'", value: 'hash or B-tree' },
            { text: "tags contains 'vegan'", value: 'inverted (GIN)' },
            { text: 'points within 2 km', value: 'GiST / R-tree' },
            { text: 'time-ordered, huge, append-only', value: 'BRIN' },
          ],
          footer: { text: 'When unsure, use a B-tree', tone: 'muted' },
        },
        caption: 'Different questions, different structures',
      },
    },
    {
      title: 'B-tree vs LSM',
      tag: 'tradeoff',
      heading: 'B-trees update in place, LSM trees append and merge',
      eli5: 'One librarian files each card into its exact drawer slot right away. Another drops new cards in a tray, then merges the sorted trays into the drawers at night.',
      body: [
        'B-tree (Postgres, MySQL): a write updates the page where the key belongs, a random disk update, and reads are fast.',
        'LSM (Cassandra, RocksDB): a write is appended to a log (the WAL, which makes the memtable durable) and to the memtable, then flushed as sorted files and merged later. A read checks the memtable, then files, and a Bloom filter skips files that cannot hold the key.',
      ],
      keyIdea: 'B-trees favor reads. LSM trees favor heavy write loads, at the cost of read work and background merging.',
      metrics: { time: '-', rows: '-', indexes: '-', insert: '-' },
      scene: {
        nodes: [
          { id: 'w', kind: 'worker', at: p(-6, 0), label: 'writes', sub: '50,000/s' },
          { id: 'mem', kind: 'block', at: p(-2, -1), label: 'memtable', sub: 'LSM write path', icon: 'Zap', tint: 'amber' },
          { id: 'sst', kind: 'block', at: p(2, 1), label: 'sorted files', sub: 'merged in background', icon: 'Layers', tint: 'blue' },
        ],
        links: [{ from: 'w', to: 'mem', label: 'append' }, { from: 'mem', to: 'sst', label: 'flush' }],
        flows: [
          { path: ['w', 'mem'], tone: 'request', label: 'put', count: 3, duration: 1 },
          { path: ['mem', 'sst'], tone: 'data', label: 'sorted flush', duration: 1.4, delay: 1.2 },
        ],
        panel: {
          title: 'B-tree against LSM',
          icon: 'Scale',
          rows: [
            { text: 'B-tree write', value: 'random page update', tone: 'muted' },
            { text: 'LSM write', value: 'append to memtable + WAL', tone: 'muted' },
            { text: 'B-tree read', value: 'one tree walk' },
            { text: 'LSM read', value: 'Bloom filter, then files' },
            { text: 'B-tree extra work', value: 'page splits' },
            { text: 'LSM extra work', value: 'compaction' },
          ],
          footer: { text: 'Pick by read/write ratio', tone: 'muted' },
        },
        caption: 'Writes land in memory first',
      },
      quiz: {
        question: 'A logging service takes 50,000 writes per second and is rarely read. Which index structure fits best?',
        options: [
          'A B-tree, because reads are fast',
          'An LSM tree, because writes are appended and merged later',
          'A hash index on every column',
          'No index at all, and a scan for every read',
        ],
        answer: 1,
        explain: 'LSM trees turn random writes into sequential ones, which suits a write-heavy store. A B-tree updates pages in place, and its cost per write is higher at that volume.',
      },
    },
    {
      title: 'EXPLAIN',
      tag: 'concept',
      heading: 'Ask the database what it plans to do',
      eli5: 'Before fetching, the librarian can tell you the plan: "I will use the author catalog, then visit 40 shelves." **EXPLAIN** is asking for that plan.',
      body: [
        'Guessing which index a query uses is a poor method. Put `EXPLAIN` in front of the query and the planner prints its plan. `EXPLAIN ANALYZE` also runs the query and reports real row counts and timings.',
        'To find the slow queries in the first place, use the slow query log or `pg_stat_statements`, which ranks queries by total time.',
      ],
      keyIdea: 'Tune from the plan. EXPLAIN ANALYZE shows which scan ran and where the time went.',
      metrics: { time: '0.3 ms', rows: '10', indexes: '2', insert: '0.15 ms' },
      scene: {
        nodes: [{ ...client, label: 'engineer', sub: 'psql' }, { ...db, status: 'active', badge: 'prints the plan' }, { ...idx, status: 'ok', sub: '(customer_id, created_at)' }],
        links: [{ from: 'client', to: 'db' }, { from: 'db', to: 'idx' }],
        flows: [
          { path: ['client', 'db'], tone: 'request', label: 'EXPLAIN ANALYZE', duration: 1.4 },
          { path: ['db', 'client'], tone: 'response', label: 'Index Scan, 0.3 ms', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Finding the slow query',
          icon: 'Search',
          rows: [
            { text: 'pg_stat_statements', value: 'ranks by total time' },
            { text: 'log_min_duration_statement', value: 'logs slow ones' },
            { text: 'EXPLAIN ANALYZE', value: 'runs it, shows the plan', tone: 'good' },
          ],
          footer: { text: 'Measure first, index second', tone: 'muted' },
        },
        caption: 'The plan tells you which path the query took',
      },
    },
    {
      title: 'Reading a plan',
      tag: 'concept',
      heading: 'Three things to read in every plan',
      eli5: 'The plan says which catalog the librarian used, how many shelves they guessed against how many they visited, and where the time went.',
      body: [
        'Read the **scan type** (`Seq Scan`, `Index Scan`, `Index Only Scan`) and the **rows**, estimated against actual. A big gap means stale statistics: run `ANALYZE orders`.',
        'Warning signs: a `Seq Scan` on a big table, a `Sort` over many rows, `Rows Removed by Filter: 49999960`. The Before plan is the opening case, with no index on `customer_id`. With the single-column index it would be an index scan plus a `Sort`, about 1 ms.',
      ],
      keyIdea: 'Compare scan type, estimated rows against actual rows, and the node where time is spent.',
      metrics: { time: 'no index 4 s, then 0.3 ms', rows: '40 then 10', indexes: '2', insert: '0.15 ms' },
      metricTones: { time: 'good' },
      scene: {
        nodes: [{ ...db, status: 'active', badge: 'plan' }, { ...idx, status: 'ok', sub: '(customer_id, created_at)' }, table],
        links: [{ from: 'db', to: 'idx' }, { from: 'idx', to: 'table', style: 'dashed' }],
        flows: [{ path: ['db', 'idx', 'table'], tone: 'request', duration: 1.6 }],
        panel: {
          title: 'Plan checklist',
          icon: 'Gauge',
          rows: [
            { text: 'Seq Scan, big table', value: 'suspect', tone: 'bad' },
            { text: 'estimated 40, actual 4M', value: 'run ANALYZE', tone: 'warn' },
            { text: 'Index Scan Backward', value: 'good', tone: 'good' },
            { text: 'Sort of many rows', value: 'needs an index', tone: 'warn' },
          ],
        },
        caption: 'Scan type, row estimates, time',
      },
      code: {
        language: 'sql',
        title: 'No index, then the composite index',
        source: `EXPLAIN ANALYZE
SELECT * FROM orders
 WHERE customer_id = 8841 ORDER BY created_at DESC LIMIT 10;

-- Before (no index on customer_id): whole table read, then sorted
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
      eli5: 'The catalog is sorted by the exact name on the cover. Ask for "authors whose lowercase name is ana" and the sorting is no help, so the librarian walks the shelves again.',
      body: [
        'A login query runs `WHERE lower(email) = \'ana@example.com\'`. There is an index on `email`, and the plan shows a `Seq Scan`. The index is sorted by the raw value, and the query asks about a computed one.',
        'Fix it with an **expression index** on `lower(email)`, or store emails already lowercased and drop the function.',
      ],
      keyIdea: 'A B-tree can only be searched by the value it stores. Wrap the column in a function and the index no longer applies.',
      metrics: { time: '3.8 s', rows: '50,000,000', indexes: '2', insert: '0.15 ms' },
      metricTones: { time: 'bad', rows: 'bad' },
      scene: {
        nodes: [
          { ...client, label: 'login page', sub: 'lower(email) = ?' },
          { ...db, status: 'hot', load: 92, badge: 'seq scan' },
          { ...idx, status: 'dim', sub: 'on email', badge: 'cannot match' },
          { ...table, label: 'users table', sub: '50M rows', status: 'hot' },
        ],
        links: [{ from: 'client', to: 'db' }, { from: 'db', to: 'idx', style: 'faint' }, { from: 'db', to: 'table' }],
        flows: [
          { path: ['client', 'db'], tone: 'request', label: 'lower(email)', duration: 1.2 },
          { path: ['db', 'idx'], tone: 'error', label: 'no use', duration: 0.8, delay: 1.3 },
          { path: ['db', 'table'], tone: 'request', label: 'scan all', count: 6, duration: 2.2, delay: 2.2 },
        ],
        panel: {
          title: 'What is stored, what is asked',
          icon: 'Code',
          rows: [
            { text: 'Index holds', value: 'ana@Example.com' },
            { text: 'Query asks', value: "lower(email) = 'ana@...'", tone: 'bad' },
            { text: 'Fix', value: 'index on lower(email)', tone: 'good' },
          ],
          footer: { text: 'Stored value and asked value differ', tone: 'bad' },
        },
        caption: 'The index stores email, the query asks for lower(email)',
      },
    },
    {
      title: 'Other traps',
      tag: 'case',
      heading: 'More ways to defeat an index',
      eli5: 'A card sorted by the first letter cannot answer "names that end in -son". The librarian also cannot use it if you ask for a name after rewriting it first.',
      body: [
        "`WHERE created_at::date = '2026-03-01'` casts the column: rewrite it as a range. `LIKE '%phone'` has a leading wildcard, so there is no prefix to walk. In MySQL, comparing a varchar column to a number casts every row (Postgres raises an error instead).",
        'Two causes sit outside the query. A condition that matches a large share of rows makes the planner choose a scan on purpose. Stale statistics make it guess wrong. Check the plan before blaming the index.',
      ],
      keyIdea: 'Casts, leading wildcards and (in MySQL) type mismatches all stop a B-tree from applying.',
      metrics: { time: '3.8 s', rows: '50,000,000', indexes: '2', insert: '0.15 ms' },
      metricTones: { time: 'bad' },
      scene: {
        nodes: [{ ...db, status: 'hot', badge: 'seq scan' }, { ...idx, status: 'dim', badge: 'cannot match' }, { ...table, status: 'hot' }],
        links: [{ from: 'db', to: 'idx', style: 'faint' }, { from: 'db', to: 'table' }],
        flows: [{ path: ['db', 'table'], tone: 'request', label: 'scan all', count: 5, duration: 2 }],
        panel: {
          title: 'Trap and fix',
          icon: 'Bug',
          rows: [
            { text: 'created_at::date = ...', value: 'use a range', tone: 'warn' },
            { text: "LIKE '%phone'", value: 'no prefix to walk', tone: 'bad' },
            { text: '(MySQL) varchar col = 42', value: 'casts every row', tone: 'warn' },
            { text: 'Matches most rows', value: 'scan is right' },
          ],
        },
        caption: 'Check the plan before blaming the index',
      },
    },
    {
      title: 'Pagination',
      tag: 'case',
      heading: 'Case: deep pages with OFFSET get slower and slower',
      eli5: 'To show page 50,000 the librarian counts and drops a million books first. Instead, tell them the last book you saw, and they start right after it.',
      body: [
        '`LIMIT 20 OFFSET 1000000` must read and discard a million index entries before returning 20, so each deeper page costs more.',
        '**Keyset pagination** remembers the last row: `WHERE (created_at, id) < (?, ?) ORDER BY created_at DESC, id DESC LIMIT 20`. An index on those columns jumps straight to the place, and every page costs the same.',
      ],
      keyIdea: 'Use keyset pagination for deep pages, and let an index jump to the last seen row.',
      metrics: { time: '600 ms then 1 ms', rows: '1,000,020 then 20', indexes: '2', insert: '0.15 ms' },
      metricTones: { time: 'good' },
      scene: {
        nodes: [{ ...db, status: 'active' }, { ...idx, status: 'ok', sub: '(created_at, id)', badge: 'jumps to last seen' }, { ...table, badge: '20 rows' }],
        links: [{ from: 'db', to: 'idx' }, { from: 'idx', to: 'table', style: 'dashed' }],
        flows: [{ path: ['db', 'idx', 'table'], tone: 'request', label: 'after (2026-03-02, 77)', duration: 1.8 }],
        panel: {
          title: 'Page 50,000',
          icon: 'Timer',
          rows: [
            { text: 'OFFSET 1000000', value: 'reads 1,000,020', tone: 'bad' },
            { text: 'Keyset (created_at, id)', value: 'reads 20', tone: 'good' },
          ],
          footer: { text: 'Cost stays flat with keyset', tone: 'good' },
        },
        caption: 'Start after the last row, do not skip a million',
      },
    },
    {
      title: 'N+1 queries',
      tag: 'case',
      heading: 'Case: 101 fast queries make one slow page',
      eli5: 'A reader hands over a list of 100 books. The librarian fetches one, walks back, fetches the next, walks back. Carrying the whole list on one trip is far faster.',
      body: [
        'The order history page loads 100 orders with one query. Then the code loops and loads each order\'s items with its own query. That is 1 + 100 = **101 queries**, each using an index and taking 0.3 ms inside the database.',
        'Each query costs about 1 ms of network and driver overhead, so the page waits 130 ms and every plan looks perfect. This is the **N+1 problem**. ORMs with lazy loading produce it without anyone writing a loop of SQL.',
      ],
      keyIdea: 'Count queries per request as well as time per query. A hundred fast round trips add up to a slow page.',
      metrics: { time: '130 ms per page', rows: '600', indexes: '2', insert: '0.15 ms' },
      metricTones: { time: 'bad' },
      scene: {
        nodes: [
          { ...client, label: 'order history', sub: '100 orders' },
          { ...app, status: 'hot', load: 70, badge: '101 queries', chips: ['items for order 1', 'items for order 2', { text: '... 99 more', tone: 'warn' }] },
          { ...db, status: 'active', badge: '0.3 ms each' },
        ],
        links: [{ from: 'client', to: 'app' }, { from: 'app', to: 'db', label: '1 ms per round trip', labelTone: 'warn' }],
        flows: [
          { path: ['client', 'app'], tone: 'request', duration: 0.8 },
          { path: ['app', 'db'], tone: 'request', label: 'items for order 1, 2, 3…', count: 8, duration: 2.8, delay: 0.9 },
          { path: ['db', 'app'], tone: 'response', count: 8, duration: 2.8, delay: 1.3 },
        ],
        panel: {
          title: 'Where the 130 ms goes',
          icon: 'Timer',
          rows: [
            { text: '101 queries in the database', value: '30 ms' },
            { text: '101 network round trips', value: '~100 ms', tone: 'bad' },
          ],
          footer: { text: 'Every plan looks perfect', tone: 'warn' },
        },
        caption: 'Each query is fast. The round trips are the cost.',
      },
    },
    {
      title: 'Fix N+1',
      tag: 'concept',
      heading: 'Fetch the children in one query',
      eli5: 'Hand the librarian the whole list and let them come back once with all 100 books on a cart.',
      body: [
        'Fetch the children in one query: a `JOIN`, or `WHERE order_id IN (...)` with all 100 ids. Most ORMs have a switch for it: eager loading, `select_related`, `includes`.',
        'Count queries per request in development and the pattern shows up at once. The page drops to 2 queries and about 5 ms.',
      ],
      keyIdea: 'Batch the lookups: two queries beat 101, and the index on order_id keeps the second one fast.',
      metrics: { time: '5 ms per page', rows: '600', indexes: '2', insert: '0.15 ms' },
      metricTones: { time: 'good' },
      scene: {
        nodes: [
          { ...client, label: 'order history', sub: '100 orders' },
          { ...app, status: 'ok', badge: '2 queries' },
          { ...db, status: 'active', badge: 'ANY(ids)' },
        ],
        links: [{ from: 'client', to: 'app' }, { from: 'app', to: 'db', label: '2 round trips' }],
        flows: [
          { path: ['client', 'app'], tone: 'request', duration: 0.8 },
          { path: ['app', 'db'], tone: 'request', label: 'items for 100 ids', duration: 1.2, delay: 0.9 },
          { path: ['db', 'app', 'client'], tone: 'response', label: '600 rows', duration: 1.6, delay: 2.2 },
        ],
        panel: {
          title: 'Per page',
          icon: 'Repeat',
          rows: [
            { text: 'Queries', value: '101 to 2', tone: 'good' },
            { text: 'Page time', value: '130 ms to 5 ms', tone: 'good' },
          ],
        },
        caption: 'Two round trips instead of 101',
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
        'A query with no usable index scans the table. A **B-tree** finds one key among 50 million in about four page reads. **Composite**, **covering**, **partial** and **unique** indexes fit specific queries. Every index costs write time, disk and memory.',
        'Read `EXPLAIN ANALYZE`. If an index is ignored, look for a function on the column, a leading wildcard, a type mismatch or a condition that matches too many rows. Use keyset pagination, and count queries per request to catch N+1. Do this before replicas or shards.',
      ],
      keyIdea: 'Find the slow query, read its plan, add the smallest index that fixes it, and drop the indexes nobody uses.',
      metrics: { time: '0.3 ms', rows: '10', indexes: '2', insert: '0.15 ms' },
      metricTones: { time: 'good', rows: 'good', indexes: 'good', insert: 'good' },
      scene: {
        nodes: [client, app, { ...db, status: 'ok' }, { ...idx, status: 'ok', sub: '(customer_id, created_at)' }, { ...table, status: 'ok' }],
        links: indexLinks,
        flows: [
          { path: ['client', 'app', 'db', 'idx'], tone: 'request', duration: 1.8 },
          { path: ['idx', 'table'], tone: 'data', duration: 0.8, delay: 1.9 },
          { path: ['table', 'db', 'app', 'client'], tone: 'response', duration: 1.8, delay: 2.8 },
        ],
        panel: {
          title: 'The routine',
          icon: 'List',
          rows: [
            { text: '1. Find the slow query', value: 'pg_stat_statements' },
            { text: '2. Read its plan', value: 'EXPLAIN ANALYZE' },
            { text: '3. Add the smallest index', value: 'composite, partial' },
            { text: '4. Prune unused indexes', value: 'idx_scan = 0', tone: 'good' },
          ],
        },
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
