import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const db: SceneNode = { id: 'db', kind: 'db', at: at(-4.8, 0), label: 'Postgres', sub: 'production' };
const etl: SceneNode = { id: 'etl', kind: 'block', icon: 'Workflow', tint: 'violet', at: at(-1.6, 0), label: 'pipeline', sub: 'extract, load' };
const wh: SceneNode = { id: 'wh', kind: 'warehouse', at: at(1.6, 0), label: 'warehouse', sub: 'columnar, MPP' };
const analyst: SceneNode = { id: 'analyst', kind: 'user', at: at(4.8, 0), label: 'analyst', sub: 'revenue report' };

const fact: SceneNode = { id: 'fact', kind: 'db', at: at(-3.4, 0), label: 'fact_sales', sub: '500M rows' };
const dimCustomer: SceneNode = { id: 'dimCustomer', kind: 'block', icon: 'Users', tint: 'blue', size: 0.8, at: at(0, 0), label: 'dim_customer', sub: '8M rows' };

const p2024: SceneNode = { id: 'p2024', kind: 'block', icon: 'Table', tint: 'gray', size: 0.8, at: at(3.4, -3.2), label: '2024', sub: '366 daily partitions' };
const p2025: SceneNode = { id: 'p2025', kind: 'block', icon: 'Table', tint: 'teal', size: 0.8, at: at(3.4, 3.2), label: '2025', sub: '365 daily partitions' };
const pAnalyst: SceneNode = { ...analyst, at: at(-3.4, 0) };
const pWh: SceneNode = { ...wh, at: at(0, 0) };

export const dataWarehousePart2: Lesson = {
  id: 'data-warehouse-part-2',
  title: 'Data warehouse and OLAP (part 2)',
  tagline: 'Keep history right, get data in fresh and safe, read less with pruning and rollups, control the bill and place the data lake. Continues part 1.',
  minutes: 14,
  level: 'Intermediate',
  learn: [
    'Slowly changing dimensions, and snowflake versus star schemas',
    'ETL versus ELT, and batch versus change data capture',
    'Keeping a pipeline correct: tests, alerts, idempotent loads and late data',
    'Partition pruning, zone maps and clustering',
    'Rollups, compute-storage separation and cost',
    'Where a data lake and a lakehouse fit',
  ],
  metrics: [
    { key: 'q', label: 'Report query', icon: 'Timer' },
    { key: 'scanned', label: 'Data read', icon: 'HardDrive' },
    { key: 'checkout', label: 'Checkout p99', icon: 'Gauge' },
    { key: 'fresh', label: 'Report freshness', icon: 'Clock' },
  ],
  steps: [
    {
      title: 'History rewritten',
      tag: 'problem',
      heading: 'Last year\'s report changed overnight',
      eli5: 'A customer who always lived in Germany moves to France. The accountant crosses out "Germany" on the customer\'s card and writes "France", and now every old receipt says the toy was sold in France.',
      body: [
        'Customer 42 lived in Germany in 2024 and moved to France in March 2025. The pipeline updates `dim_customer` in place: country is now `FR`.',
        'Every one of customer 42\'s 2024 orders now joins to `FR`. The 2024 revenue report, already sent to finance, shows different numbers when someone reruns it.',
      ],
      keyIdea: 'Overwriting a dimension rewrites history: old facts join to the new description.',
      metrics: { q: '4 s', scanned: '3 GB', checkout: '80 ms', fresh: '-' },
      scene: {
        nodes: [
          { id: 'profile', kind: 'block', icon: 'User', tint: 'blue', at: at(-7.8, 0), label: 'customer 42', sub: 'profile', chips: [{ text: 'moves DE to FR', tone: 'warn' }] },
          { ...dimCustomer, at: at(-3.6, 0), status: 'hot', chips: [{ text: 'country = FR (overwritten)', tone: 'bad' }] },
          { ...fact, at: at(0, 0), status: 'active', badge: '2024 orders' },
          { ...analyst, at: at(3.6, 0), status: 'hot', badge: 'numbers changed' },
        ],
        links: [link('profile', 'dimCustomer'), link('fact', 'dimCustomer'), link('analyst', 'fact')],
        flows: [
          { path: ['profile', 'dimCustomer'], tone: 'event', label: 'country = FR', duration: 1.4 },
          { path: ['analyst', 'fact', 'dimCustomer', 'analyst'], tone: 'request', label: '2024 revenue by country', duration: 2.4, delay: 1.5 },
        ],
        panel: {
          title: '2024 revenue report, customer 42',
          icon: 'Table',
          rows: [
            { text: 'Run in January 2025', value: 'DE', tone: 'good' },
            { text: 'Rerun in April 2025', value: 'FR', tone: 'bad' },
            { text: 'Finance sent', value: 'DE' },
          ],
          footer: { text: 'Old facts joined to the new description', tone: 'bad' },
        },
        caption: 'Overwriting the dimension rewrites history',
      },
    },
    {
      title: 'Type 2 rows',
      tag: 'concept',
      heading: 'Slowly changing dimensions: keep both versions',
      eli5: 'Instead of crossing out the old card, the accountant writes a second card that says "France, from March". Old receipts still point at the old card, so they still say Germany.',
      body: [
        'A **slowly changing dimension** (SCD) handles attributes that change over time. **Type 1** overwrites the value: simple, but history is rewritten. **Type 2** adds a new row with `valid_from` and `valid_to`, and new facts point to the new row.',
        'The dimension gets a **surrogate key**, an id made by the warehouse, so one customer can have several rows. Old facts keep the old key, so they still show `DE`. At load time each order looks up the row whose `valid_from` to `valid_to` window holds its date.',
      ],
      keyIdea: 'Type 2 keeps a row per version of a dimension member. Facts point at the version that was true at the time.',
      metrics: { q: '4 s', scanned: '3 GB', checkout: '80 ms', fresh: '-' },
      scene: {
        nodes: [
          { ...dimCustomer, at: at(-3.4, 0), status: 'ok', badge: '2 rows for customer 42' },
          { ...fact, at: at(0, 0), status: 'active', chips: ['2024 orders: key 101', '2025 orders: key 102'] },
          { ...analyst, at: at(3.4, 0), status: 'ok', badge: 'DE stays DE' },
        ],
        links: [link('fact', 'dimCustomer'), link('analyst', 'fact')],
        flows: [
          { path: ['analyst', 'fact', 'dimCustomer', 'analyst'], tone: 'response', label: '2024 still shows DE', duration: 2.4 },
        ],
        panel: {
          title: 'dim_customer, type 2',
          icon: 'Users',
          code: 'key  id  country  valid_from  valid_to\n101  42  DE       2023-05-01  2025-03-09\n102  42  FR       2025-03-09  9999-12-31',
          footer: { text: 'Type 1 would keep only the FR row', tone: 'muted' },
        },
        caption: 'One row per version, one key per version',
      },
    },
    {
      title: 'Snowflake',
      tag: 'tradeoff',
      heading: 'Snowflake schema: normalize the dimensions?',
      eli5: 'The accountant could split each toy card further: one card for the toy, another card for its brand and another for its category. Fewer copies of words, but more cards to flip through for every answer.',
      body: [
        'A **snowflake schema** normalizes the dimensions: `dim_product` points to `dim_category` and `dim_brand`. It saves a little storage and keeps one copy of each name.',
        'The cost is extra joins on every query and a model that is harder to read. Storage is cheap and columns compress, so most warehouses keep the denormalized star.',
      ],
      keyIdea: 'A snowflake saves storage and costs joins. A star costs a little duplication and keeps queries simple.',
      metrics: { q: '4 s', scanned: '3 GB', checkout: '80 ms', fresh: '-' },
      scene: {
        nodes: [
          { ...fact, status: 'ok' },
          { id: 'dimProduct', kind: 'block', icon: 'Package', tint: 'green', size: 0.8, at: at(0, 0), label: 'dim_product', sub: '50K rows', status: 'active' },
          { id: 'dimCategory', kind: 'block', icon: 'Boxes', tint: 'amber', size: 0.8, at: at(3.4, -3.2), label: 'dim_category', sub: '40 rows' },
          { id: 'dimBrand', kind: 'block', icon: 'Star', tint: 'violet', size: 0.8, at: at(3.4, 3.2), label: 'dim_brand', sub: '900 rows' },
        ],
        links: [link('fact', 'dimProduct'), link('dimProduct', 'dimCategory'), link('dimProduct', 'dimBrand')],
        flows: [
          { path: ['fact', 'dimProduct', 'dimCategory'], tone: 'request', label: 'join, join', duration: 2 },
          { path: ['dimProduct', 'dimBrand'], tone: 'request', label: 'join', duration: 1.2, delay: 1 },
        ],
        panel: {
          title: 'Star versus snowflake',
          icon: 'Scale',
          rows: [
            { text: 'Star', value: 'one join per dimension', tone: 'good' },
            { text: 'Snowflake', value: 'extra joins', tone: 'warn' },
            { text: 'Star storage', value: 'a little duplication' },
            { text: 'Snowflake storage', value: 'smaller' },
          ],
        },
        caption: 'Normalized dimensions add joins',
      },
    },
    {
      title: 'ETL vs ELT',
      tag: 'concept',
      heading: 'Getting data in: transform first or load first',
      eli5: 'Every night a helper copies the day\'s receipts from the till to the back room. The helper can tidy them on the way, or drop them off as they are and let the accountant tidy them at the desk.',
      body: [
        '**ETL** (extract, transform, load) pulls data out of production, reshapes it into facts and dimensions on a separate server, then loads the result. **ELT** loads the raw tables into the warehouse first and runs the transformations there as SQL.',
        'Warehouse compute is cheap and parallel, and the raw copy lets you rebuild any model when the logic changes. ELT is the common choice today.',
      ],
      keyIdea: 'Load the raw data, transform inside the warehouse. Keeping the raw copy means any model can be rebuilt.',
      metrics: { q: '4 s', scanned: '3 GB', checkout: '80 ms', fresh: '24 h (batch)' },
      metricTones: { fresh: 'warn' },
      scene: {
        nodes: [{ ...db, status: 'ok' }, { ...etl, status: 'active', sub: 'extract, load' }, { ...wh, status: 'ok', badge: 'raw + models' }, analyst],
        links: [link('db', 'etl', { style: 'dashed' }), link('etl', 'wh'), link('analyst', 'wh')],
        flows: [
          { path: ['db', 'etl'], tone: 'data', label: 'extract', duration: 1.2 },
          { path: ['etl', 'wh'], tone: 'data', label: 'load raw', duration: 1.2, delay: 1.3 },
          { path: ['analyst', 'wh', 'analyst'], tone: 'request', duration: 1.8, delay: 2.8 },
        ],
        panel: {
          title: 'Where the transform runs',
          icon: 'Workflow',
          rows: [
            { text: 'ETL', value: 'on a separate server, then load' },
            { text: 'ELT', value: 'in the warehouse, as SQL', tone: 'good' },
            { text: 'Raw copy kept', value: 'ELT only', tone: 'good' },
            { text: 'Rebuild a model', value: 'ELT: rerun the SQL' },
          ],
        },
        caption: 'Extract gently, load raw, transform inside',
      },
    },
    {
      title: 'ELT in SQL',
      tag: 'concept',
      heading: 'The transform is just SQL',
      eli5: 'The accountant has a recipe card that says how to turn raw receipts into the neat big list. When the recipe changes, the accountant reruns it on the raw receipts and gets a fresh list.',
      body: [
        'In ELT the transform is plain SQL run inside the warehouse, often managed by a tool like dbt. Raw copies land as-is, and the fact table is rebuilt from them. The build joins each order to the customer version valid at order time, so the fact gets the right surrogate key.',
        'Business rules, such as which order statuses count as revenue, live in one reviewable query.',
      ],
      keyIdea: 'In ELT a model is a SQL query over raw tables. Change the query, rerun it, and the table is rebuilt.',
      metrics: { q: '4 s', scanned: '3 GB', checkout: '80 ms', fresh: '24 h (batch)' },
      metricTones: { fresh: 'warn' },
      scene: {
        nodes: [
          { ...db, status: 'ok' },
          { ...etl, status: 'ok' },
          { ...wh, status: 'active', chips: ['raw.orders', 'raw.order_items', 'analytics.fact_sales'] },
          analyst,
        ],
        links: [link('db', 'etl', { style: 'dashed' }), link('etl', 'wh'), link('analyst', 'wh')],
        flows: [
          { path: ['db', 'etl', 'wh'], tone: 'data', label: 'raw, as-is', duration: 1.8 },
          { path: ['wh', 'wh'], tone: 'event', label: 'dbt run', duration: 1, delay: 2 },
          { path: ['analyst', 'wh', 'analyst'], tone: 'request', duration: 1.8, delay: 3.2 },
        ],
        panel: {
          title: 'Model chain',
          icon: 'Layers',
          rows: [
            { text: 'raw.orders, raw.order_items', value: 'loaded as-is' },
            { text: 'analytics.fact_sales', value: 'SQL model', tone: 'good' },
            { text: 'Rule: status paid, shipped, delivered', value: 'one place' },
          ],
        },
        caption: 'Models are SQL over the raw copy',
      },
      code: {
        language: 'sql',
        title: 'ELT: build the fact table from raw copies, inside the warehouse',
        source: `-- raw.orders and raw.order_items are kept in sync from the CDC feed, merged by key
CREATE OR REPLACE TABLE analytics.fact_sales AS
SELECT
  CAST(o.created_at AS DATE)  AS order_date,
  c.customer_key,                                  -- surrogate key of the version valid at order time
  i.product_id                AS product_key,
  c.country,
  i.quantity,
  i.quantity * i.unit_price   AS amount
FROM raw.order_items i
JOIN raw.orders o ON o.id = i.order_id
JOIN analytics.dim_customer c
  ON  c.customer_id = o.customer_id
  AND o.created_at >= c.valid_from
  AND o.created_at <  c.valid_to
WHERE o.status IN ('paid', 'shipped', 'delivered');   -- business rule lives here`,
        highlight: [1, 5, 12, 13, 14, 15],
      },
    },
    {
      title: 'Batch vs CDC',
      tag: 'tradeoff',
      heading: 'Nightly batch or change data capture',
      eli5: 'The helper can carry a box of receipts once a night, so the accountant works from yesterday. Or the helper can copy each new receipt the moment it is written, so the accountant is only minutes behind.',
      body: [
        'A **nightly batch** reads yesterday\'s changed rows from a read replica: gentle on production, but reports are up to 24 hours old.',
        '**Change data capture** (CDC) streams every committed change from the database log into the warehouse. Reports trail production by minutes, with almost no load on the primary. A common path is Debezium reading the Postgres log into Kafka, then a loader.',
        'The feed holds inserts, updates and deletes, so the loader merges them into the raw table by primary key, latest change wins.',
      ],
      keyIdea: 'CDC brings freshness from a day down to minutes, and reads the log instead of querying the tables.',
      metrics: { q: '4 s', scanned: '3 GB', checkout: '80 ms', fresh: '~5 min (CDC)' },
      metricTones: { fresh: 'good' },
      scene: {
        nodes: [
          { ...db, status: 'ok', badge: 'change log' },
          { ...etl, status: 'active', sub: 'CDC reader' },
          { ...wh, status: 'ok' },
          { ...analyst, status: 'ok' },
        ],
        links: [link('db', 'etl', { style: 'dashed', label: 'CDC' }), link('etl', 'wh'), link('analyst', 'wh')],
        flows: [
          { path: ['db', 'etl'], tone: 'event', label: 'row changes', count: 3, duration: 1.2 },
          { path: ['etl', 'wh'], tone: 'data', label: 'load raw', duration: 1.2, delay: 1.3 },
          { path: ['analyst', 'wh', 'analyst'], tone: 'request', duration: 1.8, delay: 2.8 },
        ],
        panel: {
          title: 'Two ways to extract',
          icon: 'Clock',
          rows: [
            { text: 'Nightly batch', value: 'up to 24 h old', tone: 'warn' },
            { text: 'Batch source', value: 'read replica' },
            { text: 'CDC', value: '~5 min old', tone: 'good' },
            { text: 'CDC source', value: 'database log, no table scans', tone: 'good' },
          ],
        },
        caption: 'Changes flow out of production within minutes',
      },
    },
    {
      title: 'Joins at scale',
      tag: 'concept',
      heading: 'Joins on an MPP warehouse move data',
      eli5: 'The helpers each hold a share of the receipts and a share of the customer cards. If a receipt and its card sit with different helpers, one has to carry papers across the room before they can match them.',
      body: [
        'An MPP warehouse spreads each table across nodes. A join works locally only if matching rows sit on the same node. Otherwise the engine **shuffles** rows across the network, which is the slow part of big joins.',
        'A **distribution key** (or sort key) puts rows with the same `customer_key` on the same node. Small dimensions are copied to every node instead. A skewed key, such as one customer with millions of orders, overloads one node and the query waits for it.',
      ],
      keyIdea: 'Distribute facts and big dimensions on the join key, copy small dimensions everywhere, and avoid skewed keys.',
      metrics: { q: '4 s', scanned: '3 GB', checkout: '80 ms', fresh: '~5 min (CDC)' },
      scene: {
        nodes: [
          { id: 'n1', kind: 'server', at: at(-4.8, -3.2), label: 'node 1', sub: 'customer 42 facts', status: 'ok', load: 40 },
          { id: 'n2', kind: 'server', at: at(0, 3.2), label: 'node 2', sub: 'customer 42 card', status: 'ok', load: 40 },
          { id: 'n3', kind: 'server', at: at(4.8, -3.2), label: 'node 3', sub: 'one huge key', status: 'hot', load: 95, chips: [{ text: 'skew', tone: 'bad' }] },
        ],
        links: [link('n1', 'n2', { label: 'shuffle', labelTone: 'warn' }), link('n1', 'n3', { style: 'faint' })],
        flows: [{ path: ['n2', 'n1'], tone: 'data', label: 'move rows to join', duration: 1.8 }],
        panel: {
          title: 'Join costs',
          icon: 'Scale',
          rows: [
            { text: 'Same distribution key', value: 'local join', tone: 'good' },
            { text: 'Small dimension', value: 'copied to every node', tone: 'good' },
            { text: 'Mismatched keys', value: 'shuffle over network', tone: 'warn' },
            { text: 'Skewed key', value: 'one node is the bottleneck', tone: 'bad' },
          ],
        },
        caption: 'Co-locate matching rows, or pay to move them',
      },
    },
    {
      title: 'Warehouse limits',
      tag: 'tradeoff',
      heading: 'What a warehouse is not for',
      eli5: 'The back room is great for counting big piles of old receipts. It is bad at crossing out one line on one receipt, and it is a poor place to catch a thief while the thief is still at the till.',
      body: [
        'Columnar stores are slow at point updates and single-row inserts, because one row lives in every column file. So loads are **bulk or micro-batch**, and changes are merged in groups, not applied row by row.',
        'Even a CDC-fed warehouse answers questions about the past. Time-critical work such as fraud checks needs **stream processing**, since a warehouse query finds the problem hours late. ClickHouse or Druid give sub-second freshness. **Data marts** give each business area an owned subset.',
      ],
      keyIdea: 'Warehouses are for analysis, loaded in bulk. Real-time decisions belong to stream processing, and marts give each area an owner.',
      metrics: { q: '4 s', scanned: '3 GB', checkout: '80 ms', fresh: '~5 min (CDC)' },
      scene: {
        nodes: [
          { ...db, at: at(-4.8, 0), status: 'ok' },
          { id: 'stream', kind: 'block', icon: 'Zap', tint: 'amber', at: at(-1.6, -3.2), label: 'stream processing', sub: 'fraud checks, seconds', status: 'active' },
          { ...wh, at: at(1.6, 3.2), status: 'ok', badge: 'bulk loads, analysis' },
          { id: 'mart', kind: 'block', icon: 'Boxes', tint: 'green', size: 0.8, at: at(4.8, 3.2), label: 'sales mart', sub: 'owned by finance', status: 'ok' },
        ],
        links: [link('db', 'stream', { style: 'dashed' }), link('db', 'wh', { style: 'dashed', label: 'micro-batch' }), link('wh', 'mart')],
        flows: [
          { path: ['db', 'stream'], tone: 'event', label: 'decide now', duration: 1.4 },
          { path: ['db', 'wh'], tone: 'data', label: 'bulk load', duration: 1.6, delay: 1.5 },
        ],
        panel: {
          title: 'Right tool for the job',
          icon: 'Split',
          rows: [
            { text: 'Single-row update', value: 'slow in columns', tone: 'warn' },
            { text: 'Bulk or micro-batch load', value: 'fast', tone: 'good' },
            { text: 'Fraud, alerts', value: 'stream processing', tone: 'good' },
            { text: 'Sub-second dashboards', value: 'ClickHouse, Druid' },
          ],
        },
        caption: 'Analysis in the warehouse, decisions in the stream',
      },
    },
    {
      title: 'Pipeline care',
      tag: 'case',
      heading: 'The pipeline is part of the product',
      eli5: 'The helper who copies receipts is now a real job. If the shop changes its receipt paper, the helper\'s copying can break, so someone checks the copies every day and rings a bell when something is off.',
      body: [
        'The pipeline is now part of the product. A schema change in the app, such as a renamed column, can break it, so give it tests and alerts like any other service.',
        'Make loads **idempotent**, so rerunning a batch gives the same result. Expect late data too: a row can arrive days after its order date, so reload recent partitions.',
      ],
      keyIdea: 'Test, alert and rerun safely. A pipeline that fails silently gives wrong reports with full confidence.',
      metrics: { q: '4 s', scanned: '3 GB', checkout: '80 ms', fresh: 'stale' },
      metricTones: { fresh: 'bad' },
      scene: {
        nodes: [
          { ...db, status: 'active', chips: [{ text: 'RENAME COLUMN', tone: 'warn' }] },
          { ...etl, status: 'down', badge: 'load failed' },
          { ...wh, status: 'dim', badge: 'stale since 02:00' },
          { id: 'alerts', kind: 'block', icon: 'Activity', tint: 'red', at: at(4.8, 0), label: 'alerts', sub: 'freshness, row counts', status: 'active', badge: 'paged' },
        ],
        links: [link('db', 'etl', { style: 'dashed' }), link('etl', 'wh'), link('etl', 'alerts', { style: 'dashed' })],
        flows: [
          { path: ['db', 'etl'], tone: 'event', label: 'new schema', duration: 1.2 },
          { path: ['etl', 'alerts'], tone: 'error', label: 'check failed', duration: 2.4, delay: 1.4 },
        ],
        panel: {
          title: 'Checks on every load',
          icon: 'Shield',
          rows: [
            { text: 'Row count matches source', value: 'test' },
            { text: 'Keys not null', value: 'test' },
            { text: 'Freshness under 15 min', value: 'alert' },
            { text: 'Rerun same batch', value: 'idempotent', tone: 'good' },
            { text: 'Late rows', value: 'reload recent partitions', tone: 'good' },
          ],
        },
        caption: 'A broken pipeline should page someone',
      },
    },
    {
      title: 'Partitions',
      tag: 'concept',
      heading: 'Skip the data the query cannot need',
      eli5: 'The back room keeps receipts in one box per day. A question about 2025 opens only the 2025 boxes. Leaving the other boxes shut is **partition pruning**.',
      body: [
        'Fact tables grow forever, and most questions are about a time range. So the fact table is **partitioned** by `order_date`, one partition per day.',
        'A query with `WHERE order_date` between two dates only scans the partitions in that range. The planner prunes the others before reading a byte.',
      ],
      keyIdea: 'Partition by time, so a query reads only the days its filter can match.',
      metrics: { q: '2 s', scanned: '1.5 GB', checkout: '80 ms', fresh: '~5 min (CDC)' },
      metricTones: { q: 'good', scanned: 'good' },
      scene: {
        nodes: [
          { ...pAnalyst, status: 'active', sub: 'revenue 2025' },
          { ...pWh, status: 'active', badge: 'prune by date' },
          { ...p2024, status: 'dim', badge: 'skipped' },
          { ...p2025, status: 'ok', badge: 'scanned' },
        ],
        links: [link('analyst', 'wh'), link('wh', 'p2024', { style: 'faint' }), link('wh', 'p2025')],
        flows: [
          { path: ['analyst', 'wh'], tone: 'request', label: 'WHERE order_date in 2025', duration: 1.2 },
          { path: ['wh', 'p2025'], tone: 'request', duration: 1, delay: 1.3 },
          { path: ['p2025', 'wh', 'analyst'], tone: 'response', label: '1.5 GB read', duration: 1.8, delay: 2.4 },
        ],
        panel: {
          title: 'Revenue for 2025',
          icon: 'Table',
          rows: [
            { text: '2024 partitions', value: '366 pruned', tone: 'good' },
            { text: '2025 partitions', value: '365 scanned' },
            { text: 'Data read', value: '3 GB to 1.5 GB', tone: 'good' },
            { text: 'Report time', value: '4 s to 2 s', tone: 'good' },
          ],
        },
        caption: 'Half of the table is never opened',
      },
      code: {
        language: 'sql',
        title: 'BigQuery: partitioned and clustered fact table',
        source: `CREATE TABLE analytics.fact_sales (
  order_date   DATE,
  customer_key INT64,
  product_key  INT64,
  country      STRING,
  quantity     INT64,
  amount       NUMERIC
)
PARTITION BY order_date        -- one partition per day
CLUSTER BY country;            -- sorted within each partition

-- prunes to the 365 partitions of 2025
SELECT country, SUM(amount) AS revenue
FROM analytics.fact_sales
WHERE order_date BETWEEN '2025-01-01' AND '2025-12-31'
GROUP BY country;`,
        highlight: [9, 10, 15],
      },
    },
    {
      title: 'Zone maps',
      tag: 'concept',
      heading: 'Skip blocks inside a partition too',
      eli5: 'Each box of receipts has a label on the lid: "countries from Austria to Germany". Looking for Germany, the accountant skips every box whose label says Spain onward. Sorting the receipts first makes the labels tight.',
      body: [
        'Inside each partition, the warehouse keeps the **min and max** of every column for every block of rows (zone maps). Take revenue for DE in 2025. Partition pruning leaves 1.5 GB, and a filter on `country = \'DE\'` skips blocks whose min and max cannot contain it, so this query reads about 0.4 GB.',
        '**Clustering** (sorting) the data by a common filter column makes those ranges tight and the skipping effective.',
      ],
      keyIdea: 'Min and max per block let the engine skip data. Sorting by the filter column makes the skipping work.',
      metrics: { q: '1 s', scanned: '0.4 GB', checkout: '80 ms', fresh: '~5 min (CDC)' },
      metricTones: { q: 'good', scanned: 'good' },
      scene: {
        nodes: [
          { ...pWh, at: at(-3.4, 0), status: 'active', badge: "country = 'DE'" },
          { id: 'b1', kind: 'block', icon: 'Table', tint: 'teal', size: 0.8, at: at(0, -3.2), label: 'block 1', sub: 'min AT, max DE', status: 'ok', badge: 'scanned' },
          { id: 'b2', kind: 'block', icon: 'Table', tint: 'gray', size: 0.8, at: at(3.4, 0), label: 'block 2', sub: 'min ES, max IT', status: 'dim', badge: 'skipped' },
          { id: 'b3', kind: 'block', icon: 'Table', tint: 'gray', size: 0.8, at: at(0, 3.2), label: 'block 3', sub: 'min JP, max US', status: 'dim', badge: 'skipped' },
        ],
        links: [link('wh', 'b1'), link('wh', 'b2', { style: 'faint' }), link('wh', 'b3', { style: 'faint' })],
        flows: [{ path: ['wh', 'b1', 'wh'], tone: 'request', label: 'only block 1 can hold DE', duration: 2 }],
        panel: {
          title: 'Zone maps, sorted by country',
          icon: 'List',
          rows: [
            { text: 'Block 1: AT to DE', value: 'read', tone: 'good' },
            { text: 'Block 2: ES to IT', value: 'skip' },
            { text: 'Block 3: JP to US', value: 'skip' },
            { text: 'Query', value: 'revenue for DE, 2025: 0.4 GB' },
          ],
          footer: { text: 'Unsorted data: every block spans AT to US, nothing skips', tone: 'warn' },
        },
        caption: 'Min and max say what a block cannot hold',
      },
    },
    {
      title: 'Pruning pitfall',
      tag: 'case',
      heading: 'Pruning needs a filter on the partition column',
      eli5: 'The boxes are labeled by day. If the question is asked in a way that does not mention days, such as "receipts printed on a Tuesday", the accountant cannot tell which boxes to skip and opens them all.',
      body: [
        'Pruning needs a filter on the partition column itself. Wrapping it in a function, or filtering on the year extracted from a different timestamp, can stop some engines from pruning.',
        'On pay-per-byte warehouses, pruning is also the main lever on cost.',
      ],
      keyIdea: 'Filter the partition column with plain comparisons, or the planner cannot prune and you scan and pay for everything.',
      metrics: { q: '4 s', scanned: '3 GB', checkout: '80 ms', fresh: '~5 min (CDC)' },
      metricTones: { q: 'warn', scanned: 'bad' },
      scene: {
        nodes: [
          { ...pAnalyst, status: 'active' },
          { ...pWh, status: 'hot', badge: 'cannot prune' },
          { ...p2024, tint: 'red', status: 'hot', badge: 'scanned' },
          { ...p2025, tint: 'red', status: 'hot', badge: 'scanned' },
        ],
        links: [link('analyst', 'wh'), link('wh', 'p2024'), link('wh', 'p2025')],
        flows: [
          { path: ['analyst', 'wh'], tone: 'request', label: 'filter on a function', duration: 1.2 },
          { path: ['wh', 'p2024'], tone: 'request', duration: 1, delay: 1.3 },
          { path: ['wh', 'p2025'], tone: 'request', duration: 1, delay: 1.3 },
          { path: ['p2025', 'wh', 'analyst'], tone: 'error', label: '3 GB read', duration: 1.8, delay: 2.4 },
        ],
        panel: {
          title: 'Same question, two filters',
          icon: 'Code',
          code: '-- prunes\nWHERE order_date >= \'2025-01-01\'\n  AND order_date <  \'2026-01-01\'\n\n-- may not prune\nWHERE EXTRACT(YEAR FROM created_at) = 2025',
          footer: { text: 'The second one is a function of another column', tone: 'warn' },
        },
        caption: 'No usable filter, no pruning',
      },
    },
    {
      title: 'Rollups',
      tag: 'concept',
      heading: 'Precompute what dashboards ask all day',
      eli5: 'Every morning the same ten people ask the accountant for the same daily totals. So the accountant writes the totals on one small sheet and hands that out instead of recounting.',
      body: [
        'Dashboards repeat the same query all day. A **materialized view** or rollup table precomputes it: one row per day and country, about 146K rows (730 days x 200 countries) instead of 500 million.',
        'The warehouse refreshes it as new data arrives, and dashboard queries answer in well under a second. The trade is extra storage and a refresh to keep correct.',
      ],
      keyIdea: 'Precompute the repeated aggregate. Dashboards read a small table instead of scanning facts every time.',
      metrics: { q: '< 1 s', scanned: '~5 MB', checkout: '80 ms', fresh: '~5 min (CDC)' },
      metricTones: { q: 'good', scanned: 'good' },
      scene: {
        nodes: [
          { ...fact, at: at(-4.8, 0), status: 'ok', badge: '500M rows' },
          { id: 'rollup', kind: 'block', icon: 'Layers', tint: 'green', at: at(-1.6, 0), label: 'daily_revenue', sub: 'day x country', status: 'active', badge: '~146K rows' },
          { id: 'dash', kind: 'client', at: at(1.6, 0), label: 'dashboard', sub: 'same query all day', status: 'ok', chips: ['revenue by day'] },
          { ...analyst, status: 'ok' },
        ],
        links: [link('fact', 'rollup', { style: 'dashed', label: 'refresh' }), link('dash', 'rollup'), link('analyst', 'dash')],
        flows: [
          { path: ['fact', 'rollup'], tone: 'data', label: 'refresh', duration: 1.4 },
          { path: ['dash', 'rollup', 'dash'], tone: 'request', label: 'tiny read', duration: 1.6, delay: 1.5 },
        ],
        panel: {
          title: 'What the dashboard reads',
          icon: 'Gauge',
          rows: [
            { text: 'Scan fact_sales', value: '500M rows, 2 s' },
            { text: 'Read daily_revenue', value: '146K rows, < 1 s', tone: 'good' },
            { text: 'Price', value: 'storage + refresh', tone: 'warn' },
          ],
        },
        caption: 'Small precomputed table, fast dashboards',
      },
    },
    {
      title: 'Compute and cost',
      tag: 'tradeoff',
      heading: 'Separate storage from compute, and watch the bill',
      eli5: 'The receipts sit in a big shared storeroom. The accountant and the night helper each bring their own desk and helpers, and only pay for a desk while they use it.',
      body: [
        'Modern warehouses such as Snowflake, BigQuery and Redshift RA3 keep data in cheap object storage and run queries on separate compute clusters. Each team scales its own cluster, and a heavy nightly job cannot slow a dashboard.',
        'Billing follows: pay per byte scanned, or per compute-second. Pruning, narrow column lists and rollups cut the bill directly.',
      ],
      keyIdea: 'Storage and compute scale and bill separately. Reading fewer bytes is the cheapest speedup.',
      metrics: { q: '< 1 s', scanned: '~5 MB', checkout: '80 ms', fresh: '~5 min (CDC)' },
      metricTones: { q: 'good', scanned: 'good' },
      scene: {
        nodes: [
          { id: 'store', kind: 'storage', at: at(-3.4, 0), label: 'object storage', sub: 'one shared copy', status: 'ok' },
          { id: 'bi', kind: 'block', icon: 'Cpu', tint: 'blue', at: at(0, -3.8), label: 'BI cluster', sub: 'scales for dashboards', status: 'active', load: 55 },
          { id: 'elt', kind: 'block', icon: 'Cpu', tint: 'violet', at: at(0, 3.8), label: 'ELT cluster', sub: 'runs 2 h at night', status: 'ok', load: 80 },
          { ...analyst, at: at(3.4, -3.8), status: 'ok' },
        ],
        links: [link('bi', 'store'), link('elt', 'store'), link('analyst', 'bi')],
        flows: [
          { path: ['analyst', 'bi', 'store', 'bi', 'analyst'], tone: 'request', label: 'dashboard query', duration: 2.6 },
          { path: ['elt', 'store'], tone: 'data', label: 'night rebuild', duration: 1.4, delay: 1 },
        ],
        panel: {
          title: 'Two ways to pay',
          icon: 'Scale',
          rows: [
            { text: 'On demand', value: 'per byte scanned' },
            { text: 'Provisioned', value: 'per compute-second' },
            { text: 'Cut the bill', value: 'prune, narrow columns, roll up', tone: 'good' },
          ],
        },
        caption: 'Each workload gets its own compute',
      },
    },
    {
      title: 'Data lake',
      tag: 'tradeoff',
      heading: 'Data lake: cheap files, structure later',
      eli5: 'Next to the tidy back room is a huge cheap storeroom where every paper goes in as it is: receipts, emails, photos. That storeroom is the **data lake**.',
      body: [
        'A warehouse wants clean, modeled tables. Some data does not fit yet: clickstream events, logs, raw API dumps, images for machine learning. A **data lake** stores all of it as files in object storage, usually in a columnar format like **Parquet**.',
        'Storage is cheap, any format is allowed, and structure is applied when you read it (schema on read).',
      ],
      keyIdea: 'A lake is cheap, flexible storage for raw data of any shape, read with structure applied at query time.',
      metrics: { q: '< 1 s', scanned: '~5 MB', checkout: '80 ms', fresh: '~5 min (CDC)' },
      scene: {
        nodes: [
          { ...db, at: at(-6.4, 0), status: 'ok' },
          { ...etl, at: at(-3.2, 0), status: 'active' },
          { id: 'lake', kind: 'storage', at: at(0, 0), label: 'data lake', sub: 'Parquet in a bucket', status: 'active', badge: 'raw events, logs' },
          { ...wh, at: at(3.2, 0), status: 'ok', badge: 'modeled tables' },
          { ...analyst, at: at(6.4, 0) },
        ],
        links: [link('db', 'etl', { style: 'dashed' }), link('etl', 'lake'), link('lake', 'wh', { label: 'promote' }), link('analyst', 'wh')],
        flows: [
          { path: ['db', 'etl', 'lake'], tone: 'data', label: 'land raw', duration: 1.8 },
          { path: ['lake', 'wh'], tone: 'data', label: 'clean + model', duration: 1.4, delay: 1.9 },
          { path: ['analyst', 'wh', 'analyst'], tone: 'request', duration: 1.8, delay: 3.4 },
        ],
        panel: {
          title: 'Warehouse versus lake',
          icon: 'HardDrive',
          rows: [
            { text: 'Warehouse', value: 'clean, modeled tables' },
            { text: 'Lake', value: 'any file, any shape' },
            { text: 'Lake structure', value: 'on read' },
          ],
        },
        caption: 'Land everything raw, promote what people query',
      },
    },
    {
      title: 'Lakehouse',
      tag: 'tradeoff',
      heading: 'Lakehouse, and the data swamp',
      eli5: 'The storeroom gets shelves, labels and a book listing what is where, and a rule that every paper has an owner. Without them, nobody can find anything, and the storeroom is a mess.',
      body: [
        'Engines such as Spark, Trino or Athena query lake files directly. Table formats like Apache Iceberg and Delta Lake add transactions, schema changes and time travel on top. Lake plus those features is often called a **lakehouse**.',
        'The risk is the **data swamp**: petabytes of files nobody can describe, with no owners or quality checks. Keep a catalog, and promote cleaned tables for reporting.',
      ],
      keyIdea: 'A lake needs a catalog and ownership, or it becomes a swamp. Table formats make it behave like a warehouse.',
      metrics: { q: '< 1 s', scanned: '~5 MB', checkout: '80 ms', fresh: '~5 min (CDC)' },
      scene: {
        nodes: [
          { id: 'lake', kind: 'storage', at: at(-3.4, 0), label: 'data lake', sub: 'Parquet files', status: 'active' },
          { id: 'engine', kind: 'block', icon: 'Search', tint: 'amber', at: at(0, -3.2), label: 'Spark, Trino', sub: 'query the files', status: 'ok' },
          { id: 'catalog', kind: 'block', icon: 'FileText', tint: 'green', at: at(0, 3.2), label: 'catalog', sub: 'owners, schemas, quality', status: 'active' },
          { ...wh, at: at(3.4, 0), status: 'ok', label: 'modeled tables', sub: 'Iceberg or warehouse' },
        ],
        links: [link('engine', 'lake'), link('catalog', 'lake', { style: 'dashed' }), link('lake', 'wh', { label: 'promote' })],
        flows: [
          { path: ['engine', 'lake', 'engine'], tone: 'request', label: 'SQL on files', duration: 2 },
          { path: ['lake', 'wh'], tone: 'data', label: 'cleaned tables', duration: 1.4, delay: 2.1 },
        ],
        panel: {
          title: 'Table format adds',
          icon: 'Layers',
          rows: [
            { text: 'Transactions', value: 'Iceberg, Delta Lake', tone: 'good' },
            { text: 'Schema changes', value: 'tracked', tone: 'good' },
            { text: 'Time travel', value: 'query an old version', tone: 'good' },
            { text: 'No catalog, no owners', value: 'swamp', tone: 'bad' },
          ],
        },
        caption: 'Files plus a catalog beat files alone',
      },
    },
    {
      title: 'Recap 2',
      tag: 'recap',
      heading: 'Fresh, correct, pruned and priced',
      eli5: 'The helper copies receipts to the back room every few minutes and checks the copies. The accountant keeps old cards, opens only the boxes that matter and hands out small total sheets.',
      body: [
        'Keep dimension history with **type 2** rows. Load raw data and transform in the warehouse (**ELT**), ideally from **CDC** so reports trail production by minutes, with tests and alerts on the pipeline.',
        '**Partition** facts by date and sort by the common filter so queries prune. Roll up repeated dashboards, and keep raw odd-shaped data in a **data lake** with a catalog.',
      ],
      keyIdea: 'Keep analytics off production, copy the data in fresh, keep history, prune what a query cannot need, and catalog the lake.',
      metrics: { q: '< 1 s', scanned: '~5 MB', checkout: '80 ms', fresh: '~5 min (CDC)' },
      metricTones: { q: 'good', scanned: 'good', checkout: 'good', fresh: 'good' },
      scene: {
        nodes: [{ ...db, at: at(-6, 0), status: 'ok' }, { ...etl, at: at(-2, 0), status: 'ok', sub: 'CDC, raw, models' }, { ...wh, at: at(2, 0), status: 'ok', badge: 'partitioned, clustered' }, { ...analyst, at: at(6, 0), status: 'ok' }],
        links: [link('db', 'etl', { style: 'dashed' }), link('etl', 'wh'), link('analyst', 'wh')],
        flows: [
          { path: ['db', 'etl', 'wh'], tone: 'event', label: 'changes', duration: 2 },
          { path: ['analyst', 'wh', 'analyst'], tone: 'response', label: 'report in under 1 s', duration: 1.8, delay: 2.2 },
        ],
        panel: {
          title: 'End state',
          icon: 'TrendingUp',
          rows: [
            { text: 'Report time', value: '12 min to under 1 s', tone: 'good' },
            { text: 'Data read', value: '100 GB to ~5 MB', tone: 'good' },
            { text: 'Freshness', value: '~5 min', tone: 'good' },
            { text: 'Checkout p99', value: '80 ms', tone: 'good' },
          ],
        },
        caption: 'Production for customers, a warehouse for questions',
      },
      quiz: {
        question: 'A dashboard query sums `amount` for last month from a fact table partitioned by `order_date`. It still scans the whole table. What is the most likely cause?',
        options: [
          'The warehouse needs more nodes',
          'The filter is not on the partition column directly, for example it filters on a function of a different timestamp column',
          'Columnar storage cannot filter by date',
          'The dimension tables are too large',
        ],
        answer: 1,
        explain: 'Pruning only works when the planner can match the filter to partition boundaries. Filter on `order_date` itself, with plain comparisons, and the query reads only last month\'s partitions.',
      },
    },
  ],
};
