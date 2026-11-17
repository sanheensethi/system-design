import type { Lesson, SceneNode } from '../engine/types';

const shoppers: SceneNode = { id: 'shoppers', kind: 'client', at: [-4, 4], label: 'shoppers', sub: '2,000 orders/min' };
const app: SceneNode = { id: 'app', kind: 'server', at: [-1, 3], label: 'checkout API' };
const db: SceneNode = { id: 'db', kind: 'db', at: [2, 2], label: 'Postgres', sub: '500M order items' };
const analyst: SceneNode = { id: 'analyst', kind: 'user', at: [0.5, -2.5], label: 'analyst', sub: 'revenue report' };
const etl: SceneNode = { id: 'etl', kind: 'worker', at: [4.25, 0.25], label: 'ELT pipeline' };
const wh: SceneNode = { id: 'wh', kind: 'warehouse', at: [3.75, -2.75], label: 'warehouse', sub: 'columnar, MPP' };
const replica: SceneNode = { id: 'replica', kind: 'replica', at: [4.25, 0.25], label: 'read replica' };
const lake: SceneNode = { id: 'lake', kind: 'storage', at: [7, 0], label: 'data lake', sub: 'Parquet in a bucket' };

const others: SceneNode = { id: 'others', kind: 'shard', at: [-1, 3], label: '17 other columns', sub: 'never read' };
const colDate: SceneNode = { id: 'colDate', kind: 'shard', at: [2.5, 1.5], label: 'order_date', sub: '4 B per row' };
const colCountry: SceneNode = { id: 'colCountry', kind: 'shard', at: [4.75, 0.25], label: 'country', sub: 'dictionary coded' };
const colAmount: SceneNode = { id: 'colAmount', kind: 'shard', at: [7, -1], label: 'amount', sub: '8 B per row' };

const fact: SceneNode = { id: 'fact', kind: 'db', at: [1, 0], label: 'fact_sales', sub: '500M rows' };
const dimDate: SceneNode = { id: 'dimDate', kind: 'shard', at: [-3, -1], label: 'dim_date', sub: '730 rows' };
const dimProduct: SceneNode = { id: 'dimProduct', kind: 'shard', at: [3.5, -3.5], label: 'dim_product', sub: '50K rows' };
const dimCustomer: SceneNode = { id: 'dimCustomer', kind: 'shard', at: [4.5, 2], label: 'dim_customer', sub: '8M rows' };

const p2024: SceneNode = { id: 'p2024', kind: 'shard', at: [3.5, 2.5], label: '2024', sub: '366 daily partitions' };
const p2025: SceneNode = { id: 'p2025', kind: 'shard', at: [5.75, 1.25], label: '2025', sub: '365 daily partitions' };
const p2026: SceneNode = { id: 'p2026', kind: 'shard', at: [7.5, 0], label: '2026 so far', sub: '320 daily partitions' };

export const dataWarehouse: Lesson = {
  id: 'data-warehouse',
  title: 'Data warehouse and OLAP',
  tagline: 'Give analytics its own columnar store, fed from production, so big reports run in seconds and checkout never notices.',
  minutes: 14,
  level: 'Intermediate',
  learn: [
    'OLTP versus OLAP: two workloads that want opposite things',
    'Why columnar storage reads a fraction of the bytes for analytical queries',
    'Fact and dimension tables in a star schema',
    'ETL versus ELT, and batch versus change data capture',
    'Partition pruning, and why a read replica is not an analytics database',
    'Where a data lake fits',
  ],
  metrics: [
    { key: 'q', label: 'Report query' },
    { key: 'scanned', label: 'Data read' },
    { key: 'checkout', label: 'Checkout p99' },
    { key: 'fresh', label: 'Report freshness' },
  ],
  steps: [
    {
      title: 'Report vs checkout',
      tag: 'problem',
      heading: 'One report slows down every checkout',
      eli5: 'The toy shop keeps every receipt in the till drawer. The owner asks the cashier to count two years of teddy bear sales, and while the cashier digs through the **till**, the line of customers grows.',
      body: [
        'An online store keeps orders in Postgres: **500 million order items** over two years, about 100 GB. Every Monday an analyst runs "revenue by country by month for the last two years" straight against the production database.',
        'The query has to read every order item, join it to customers, and group the result. It runs for **12 minutes**, saturates the disks and pushes the hot checkout rows out of the memory cache. Checkout p99 goes from 80 ms to 2.5 seconds for those 12 minutes, and some payments time out.',
        'The database is doing its job badly because it was built for a different job. It is tuned for thousands of tiny transactions per second, and this is one enormous read.',
      ],
      keyIdea: 'An analytical scan on the production database competes with customers for the same disks, memory and CPU, and customers lose.',
      metrics: { q: '12 min', scanned: '100 GB', checkout: '2.5 s', fresh: 'live' },
      scene: {
        nodes: [shoppers, { ...app, status: 'hot', badge: 'p99 2.5 s' }, { ...db, status: 'hot', badge: 'full scan, 12 min' }, { ...analyst, status: 'active' }],
        links: [
          { from: 'shoppers', to: 'app' },
          { from: 'app', to: 'db' },
          { from: 'analyst', to: 'db' },
        ],
        flows: [
          { path: ['shoppers', 'app'], tone: 'request', count: 4, duration: 1 },
          { path: ['app', 'db'], tone: 'request', label: 'INSERT order', count: 4, duration: 1, delay: 1 },
          { path: ['analyst', 'db'], tone: 'request', label: 'SUM over 500M rows', duration: 1.4, delay: 0.3 },
          { path: ['db', 'app'], tone: 'error', label: 'slow', duration: 2.6, delay: 2.1 },
        ],
        caption: 'Analytics and checkout share one database',
      },
    },
    {
      title: 'OLTP vs OLAP',
      tag: 'concept',
      heading: 'Two workloads that want opposite things',
      eli5: 'The cashier handles one sale at a time, fast. The accountant in the back room adds up thousands of receipts at once. That adding-up job is **OLAP**, and it belongs in its own room.',
      body: [
        '**OLTP** (online transaction processing) is the app\'s workload: many small reads and writes, each touching a few rows found by key, each needing a transaction and an answer in milliseconds. "Insert this order." "Load cart 7." Normalized tables and B-tree indexes suit it.',
        '**OLAP** (online analytical processing) is the analyst\'s workload: few queries, each reading millions or billions of rows but only a few columns, aggregating them, and mostly reading data that no longer changes. Seconds to minutes is fine.',
        'No single storage layout is best at both. So the usual design keeps them apart: production stays an OLTP database, and a copy of the data goes to a **data warehouse** built for OLAP, such as Snowflake, BigQuery, Redshift or ClickHouse.',
      ],
      keyIdea: 'OLTP is many tiny transactions by key. OLAP is a few huge scans and aggregates. Give each its own system.',
      metrics: { q: '12 min', scanned: '100 GB', checkout: '80 ms', fresh: 'live' },
      scene: {
        nodes: [shoppers, { ...app, status: 'ok' }, { ...db, label: 'OLTP database', status: 'ok', badge: '5 ms by key' }, analyst, { ...wh, status: 'active', badge: 'scans, aggregates' }],
        links: [
          { from: 'shoppers', to: 'app' },
          { from: 'app', to: 'db' },
          { from: 'analyst', to: 'wh' },
          { from: 'db', to: 'wh', style: 'dashed', label: 'copy' },
        ],
        flows: [
          { path: ['shoppers', 'app', 'db'], tone: 'request', label: 'one order', count: 3, duration: 1.4 },
          { path: ['db', 'wh'], tone: 'data', duration: 1.6, delay: 1.5 },
          { path: ['analyst', 'wh', 'analyst'], tone: 'request', label: '2 years by month', duration: 2, delay: 2 },
        ],
        caption: 'Customers on one side, analysts on the other',
      },
    },
    {
      title: 'Columnar',
      tag: 'concept',
      heading: 'Store columns, not rows',
      eli5: 'The receipts were whole slips of paper. The back room copies them into separate lists: one of just dates, one of just countries, one of just prices. Keeping each list apart is **columnar** storage.',
      body: [
        'A **row store** keeps each row\'s values together on disk. To sum `amount` it must read whole rows, all 20 columns, about 200 bytes each: the full 100 GB.',
        'A **column store** keeps each column in its own file. The revenue report needs three columns, `order_date`, `country` and `amount`, so it reads those and skips the other 17. That is about 15% of the bytes before compression.',
        'Columns also compress very well, because one column holds similar values. `country` has about 200 distinct values, so it is stored as a small dictionary code, and long runs of the same value shrink further with run-length encoding. The three columns come to about **3 GB**. The warehouse splits that scan across many machines in parallel (**MPP**, massively parallel processing) and the report finishes in about **4 seconds**.',
      ],
      keyIdea: 'Analytical queries touch few columns over many rows. A column store reads only those columns, compressed, and splits the scan across many machines.',
      metrics: { q: '4 s', scanned: '3 GB', checkout: '80 ms', fresh: '-' },
      scene: {
        nodes: [
          { ...analyst, status: 'active' },
          { ...others, status: 'dim' },
          { ...colDate, status: 'active' },
          { ...colCountry, status: 'active', badge: '200 distinct values' },
          { ...colAmount, status: 'active' },
        ],
        links: [
          { from: 'analyst', to: 'colDate' },
          { from: 'analyst', to: 'colCountry' },
          { from: 'analyst', to: 'colAmount' },
          { from: 'analyst', to: 'others', style: 'faint' },
        ],
        flows: [
          { path: ['analyst', 'colDate'], tone: 'request', duration: 1 },
          { path: ['analyst', 'colCountry'], tone: 'request', duration: 1 },
          { path: ['analyst', 'colAmount'], tone: 'request', duration: 1 },
          { path: ['colDate', 'analyst'], tone: 'data', duration: 1.2, delay: 1.1 },
          { path: ['colCountry', 'analyst'], tone: 'data', label: 'compressed', duration: 1.2, delay: 1.1 },
          { path: ['colAmount', 'analyst'], tone: 'data', duration: 1.2, delay: 1.1 },
        ],
        caption: 'Read 3 columns, skip 17',
      },
      quiz: {
        question: 'A table has 20 columns of roughly equal size. A query sums one column grouped by another. Before compression, about how much of the table does a column store read?',
        options: ['All of it', 'About half', 'About 10%', 'Only the rows that match an index'],
        answer: 2,
        explain: 'It reads the 2 columns the query uses out of 20, about 10% of the bytes. Compression then shrinks that further. A row store reads every column of every row it scans.',
      },
    },
    {
      title: 'Star schema',
      tag: 'concept',
      heading: 'Facts in the middle, dimensions around them',
      eli5: 'The back room keeps one giant list of every sale, and that list is the **fact table**. Each sale points to small cards: which toy, which day, which customer.',
      body: [
        'Warehouses usually model data as a **star schema**. The **fact table** in the middle has one row per event you measure, here one per item sold: foreign keys plus numbers you add up (`quantity`, `amount`). It is long and narrow, 500 million rows.',
        'Around it sit **dimension tables** that describe the facts: `dim_date` (day, month, quarter, holiday flag), `dim_customer` (country, segment), `dim_product` (category, brand). They are short and wide, and **denormalized** on purpose: country sits right in `dim_customer` with no extra join to a countries table.',
        'Every report has the same shape: filter and group by dimension attributes, sum the fact measures. Analysts can write it without knowing the app\'s 80 normalized tables, and the engine is optimized for exactly this join pattern.',
      ],
      keyIdea: 'A star schema puts measurable events in one big fact table and descriptions in small dimension tables, so every report is one simple join pattern.',
      metrics: { q: '4 s', scanned: '3 GB', checkout: '80 ms', fresh: '-' },
      scene: {
        nodes: [
          { ...fact, status: 'active', badge: 'quantity, amount' },
          { ...dimDate, status: 'ok' },
          { ...dimProduct, status: 'ok' },
          { ...dimCustomer, status: 'ok', badge: 'country' },
        ],
        links: [
          { from: 'fact', to: 'dimDate' },
          { from: 'fact', to: 'dimProduct' },
          { from: 'fact', to: 'dimCustomer' },
        ],
        flows: [
          { path: ['dimDate', 'fact'], tone: 'data', label: 'month', duration: 1.2 },
          { path: ['dimCustomer', 'fact'], tone: 'data', label: 'country', duration: 1.2, delay: 0.3 },
          { path: ['fact', 'dimProduct'], tone: 'request', label: 'product_key', duration: 1.2, delay: 1.6 },
        ],
        caption: 'One fact table, three dimensions',
      },
      code: {
        language: 'sql',
        title: 'Revenue by country by month, star-schema style',
        source: `SELECT d.year,
       d.month,
       c.country,
       SUM(f.amount) AS revenue
FROM fact_sales f
JOIN dim_date d     ON f.order_date   = d.date
JOIN dim_customer c ON f.customer_key = c.customer_key
WHERE f.order_date >= DATE '2024-01-01'
  AND f.order_date <  DATE '2026-01-01'
GROUP BY d.year, d.month, c.country
ORDER BY d.year, d.month, revenue DESC;`,
        highlight: [4, 5, 6, 7, 8],
      },
    },
    {
      title: 'ETL and ELT',
      tag: 'concept',
      heading: 'Getting data into the warehouse',
      eli5: 'Every night a helper copies the day\'s receipts from the till to the back room, then tidies them into the big list. Copying, tidying and filing is the **pipeline**.',
      body: [
        '**ETL** (extract, transform, load) pulls data out of production, reshapes it into facts and dimensions on a separate server, then loads the result. **ELT** loads the raw tables into the warehouse first and runs the transformations there as SQL, often with a tool like dbt. Warehouse compute is cheap and parallel, and keeping the raw copy lets you rebuild any model when the logic changes, so ELT is the common choice today.',
        'Extraction must be gentle on production. A **nightly batch** reads yesterday\'s changed rows from a read replica: simple, but reports are up to 24 hours old. **Change data capture** (CDC) streams every committed change from the database log into the warehouse, so reports trail production by minutes with almost no load on the primary.',
        'Either way, the pipeline is now part of the product. Schema changes in the app can break it, so give it tests and alerts like any other service.',
      ],
      keyIdea: 'Extract gently from production, load the raw data, transform inside the warehouse. CDC brings freshness from a day down to minutes.',
      metrics: { q: '4 s', scanned: '3 GB', checkout: '80 ms', fresh: '~5 min (CDC)' },
      scene: {
        nodes: [shoppers, app, { ...db, status: 'ok', badge: 'change log' }, { ...etl, status: 'active', sub: 'CDC → raw → models' }, { ...wh, status: 'ok', badge: 'raw + fact_sales' }, analyst],
        links: [
          { from: 'shoppers', to: 'app' },
          { from: 'app', to: 'db' },
          { from: 'db', to: 'etl', style: 'dashed', label: 'CDC' },
          { from: 'etl', to: 'wh' },
          { from: 'analyst', to: 'wh' },
        ],
        flows: [
          { path: ['shoppers', 'app', 'db'], tone: 'request', label: 'order', count: 2, duration: 1.4 },
          { path: ['db', 'etl'], tone: 'event', label: 'row changes', count: 2, duration: 1.2, delay: 1.5 },
          { path: ['etl', 'wh'], tone: 'data', label: 'load raw', duration: 1.2, delay: 2.8 },
          { path: ['analyst', 'wh', 'analyst'], tone: 'request', duration: 1.8, delay: 4.1 },
        ],
        caption: 'Changes flow out of production into the warehouse',
      },
      code: {
        language: 'sql',
        title: 'ELT: build the fact table from raw copies, inside the warehouse',
        source: `-- raw.orders and raw.order_items are loaded as-is by CDC
CREATE OR REPLACE TABLE analytics.fact_sales AS
SELECT
  CAST(o.created_at AS DATE)  AS order_date,
  o.customer_id               AS customer_key,
  i.product_id                AS product_key,
  i.quantity,
  i.quantity * i.unit_price   AS amount
FROM raw.order_items i
JOIN raw.orders o ON o.id = i.order_id
WHERE o.status IN ('paid', 'shipped', 'delivered');   -- business rule lives here`,
        highlight: [1, 2, 8, 11],
      },
    },
    {
      title: 'Partition pruning',
      tag: 'concept',
      heading: 'Skip the data the query cannot need',
      eli5: 'The back room keeps receipts in one box per day. A question about 2025 opens only the 2025 boxes. Leaving the other boxes shut is **partition pruning**.',
      body: [
        'Fact tables grow forever, and most questions are about a time range. So the fact table is **partitioned** by `order_date`, one partition per day. A query with `WHERE order_date` between two dates only scans the partitions in that range. The planner prunes the others before reading a byte.',
        'Inside each partition, the warehouse keeps the **min and max** of every column for every block of rows (zone maps). A filter on `country = \'DE\'` skips blocks whose min and max cannot contain it. **Clustering** (sorting) the data by a common filter column makes those ranges tight and the skipping effective.',
        'Pruning needs a filter on the partition column itself. Wrapping it in a function, such as filtering on the year extracted from a timestamp, can stop some engines from pruning. On pay-per-byte warehouses, pruning is also the main lever on cost.',
      ],
      keyIdea: 'Partition by time and keep min and max per block, so a query reads only the slices its filters can match.',
      metrics: { q: '2 s', scanned: '1.5 GB', checkout: '80 ms', fresh: '~5 min (CDC)' },
      scene: {
        nodes: [
          { ...analyst, status: 'active', sub: 'revenue 2025' },
          { ...wh, status: 'active', badge: 'prune by date' },
          { ...p2024, status: 'dim' },
          { ...p2025, status: 'ok', badge: 'scanned' },
          { ...p2026, status: 'dim' },
        ],
        links: [
          { from: 'analyst', to: 'wh' },
          { from: 'wh', to: 'p2024', style: 'faint' },
          { from: 'wh', to: 'p2025' },
          { from: 'wh', to: 'p2026', style: 'faint' },
        ],
        flows: [
          { path: ['analyst', 'wh'], tone: 'request', label: 'WHERE order_date in 2025', duration: 1.2 },
          { path: ['wh', 'p2025'], tone: 'request', duration: 1, delay: 1.3 },
          { path: ['p2025', 'wh', 'analyst'], tone: 'response', label: '1.5 GB read', duration: 1.8, delay: 2.4 },
        ],
        caption: 'Two thirds of the table is never opened',
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
      title: 'Replica trap',
      tag: 'case',
      heading: 'Case: "just point the analysts at a replica"',
      eli5: 'The shop gives the accountant a copy of the till drawer. The copy must take in every new receipt too. While the accountant spreads the receipts out, new ones pile up, so the **replica** falls behind.',
      body: [
        'A cheaper idea comes up first: let analysts query a Postgres **read replica**. Checkout never touches it, so what could go wrong?',
        'Plenty. The replica is still a row store, so the report still reads 100 GB and still takes 12 minutes. Worse, a long query on a replica collides with replication. The primary keeps vacuuming old row versions, and replaying that cleanup would remove rows the report is still reading. Postgres has to cancel the query after a delay (30 seconds by default), or pause replay so the replica falls behind, or, with `hot_standby_feedback` on, tell the primary to keep the old rows, which bloats the primary.',
        'Every option hurts someone. A replica is fine for a quick lookup or a small ad hoc count. For real analytics, move the data into a store designed for scans.',
      ],
      keyIdea: 'A read replica isolates checkout from analytics only partly, and it keeps the slow row layout. Long scans and replication do not mix.',
      metrics: { q: '12 min or cancelled', scanned: '100 GB', checkout: '80 ms', fresh: 'lag grows' },
      scene: {
        nodes: [
          shoppers,
          app,
          { ...db, status: 'active', badge: 'vacuum' },
          { ...replica, status: 'hot', badge: 'replay paused' },
          { ...analyst, status: 'hot', badge: 'query cancelled' },
        ],
        links: [
          { from: 'shoppers', to: 'app' },
          { from: 'app', to: 'db' },
          { from: 'db', to: 'replica', style: 'dashed', label: 'WAL' },
          { from: 'analyst', to: 'replica' },
        ],
        flows: [
          { path: ['db', 'replica'], tone: 'data', label: 'cleanup records', count: 3, duration: 1.4 },
          { path: ['analyst', 'replica'], tone: 'request', label: '12-minute scan', duration: 2, delay: 0.4 },
          { path: ['replica', 'analyst'], tone: 'error', label: 'conflict with recovery', duration: 1.4, delay: 2.6 },
        ],
        caption: 'Long reads and replication pull in opposite directions',
      },
    },
    {
      title: 'Data lake',
      tag: 'tradeoff',
      heading: 'Data lake: cheap files, structure later',
      eli5: 'Next to the tidy back room is a huge cheap storeroom where every paper goes in as it is: receipts, emails, photos. That storeroom is the **data lake**. Without labels it turns into a mess.',
      body: [
        'A warehouse wants clean, modeled tables. Some data does not fit yet: clickstream events, logs, raw API dumps, images for machine learning. A **data lake** stores all of it as files in object storage (see the object storage lesson), usually in a columnar file format like **Parquet**. Storage is cheap, any format is allowed, and structure is applied when you read it (schema on read).',
        'Engines such as Spark, Trino or Athena query those files directly. Table formats like Apache Iceberg and Delta Lake add transactions, schema changes and time travel on top of the files. Lake plus those features is often called a **lakehouse**.',
        'The risk is the **data swamp**: petabytes of files nobody can describe, with no owners and no quality checks. A common split is to land everything raw in the lake and promote cleaned, modeled tables into the warehouse, or into lakehouse tables, for reporting.',
      ],
      keyIdea: 'A lake is cheap, flexible storage for raw data of any shape. It needs a catalog and ownership, or it becomes a swamp.',
      metrics: { q: '2 s', scanned: '1.5 GB', checkout: '80 ms', fresh: '~5 min (CDC)' },
      scene: {
        nodes: [
          { ...db, status: 'ok' },
          { ...etl, status: 'active' },
          { ...wh, status: 'ok', badge: 'modeled tables' },
          { ...lake, status: 'active', badge: 'raw events, logs' },
          analyst,
        ],
        links: [
          { from: 'db', to: 'etl', style: 'dashed' },
          { from: 'etl', to: 'lake' },
          { from: 'lake', to: 'wh', label: 'promote' },
          { from: 'analyst', to: 'wh' },
        ],
        flows: [
          { path: ['db', 'etl', 'lake'], tone: 'data', label: 'land raw', duration: 1.8 },
          { path: ['lake', 'wh'], tone: 'data', label: 'clean + model', duration: 1.4, delay: 1.9 },
          { path: ['analyst', 'wh', 'analyst'], tone: 'request', duration: 1.8, delay: 3.4 },
        ],
        caption: 'Land everything raw, promote what people query',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Production for customers, a warehouse for questions',
      eli5: 'The cashier serves customers at the **till**. A helper copies receipts to the back room every few minutes, where the accountant keeps neat lists by date, country and price and adds them up fast.',
      body: [
        '**OLTP** and **OLAP** want opposite storage, so analytics moves off the production database, and off its replicas too. A **column store** reads only the columns a query needs, compressed and in parallel: the two-year report went from 12 minutes and 100 GB to a few seconds and a few GB.',
        'Model the data as a **star schema** of facts and dimensions. Feed it with **ELT**, ideally from CDC so reports trail production by minutes. **Partition** facts by date so queries prune what they cannot need. Keep raw, oddly shaped data in a **data lake**, with a catalog so it stays usable.',
      ],
      keyIdea: 'Keep analytics off production. Copy the data into a columnar warehouse, model it as a star, and partition it by time.',
      metrics: { q: '2 s', scanned: '1.5 GB', checkout: '80 ms', fresh: '~5 min (CDC)' },
      scene: {
        nodes: [shoppers, app, { ...db, status: 'ok' }, etl, { ...wh, status: 'ok' }, analyst],
        links: [
          { from: 'shoppers', to: 'app' },
          { from: 'app', to: 'db' },
          { from: 'db', to: 'etl', style: 'dashed' },
          { from: 'etl', to: 'wh' },
          { from: 'analyst', to: 'wh' },
        ],
        flows: [
          { path: ['shoppers', 'app', 'db'], tone: 'request', count: 3, duration: 1.4 },
          { path: ['db', 'etl', 'wh'], tone: 'event', label: 'changes', duration: 2, delay: 1.5 },
          { path: ['analyst', 'wh', 'analyst'], tone: 'response', label: 'report in 2 s', duration: 1.8, delay: 3.6 },
        ],
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
