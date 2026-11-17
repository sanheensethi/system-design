import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const shoppers: SceneNode = { id: 'shoppers', kind: 'phone', at: at(-6.4, 0), label: 'shoppers', sub: '2,000 orders/min' };
const app: SceneNode = { id: 'app', kind: 'block', icon: 'Server', tint: 'blue', at: at(-3.2, 0), label: 'checkout API' };
const db: SceneNode = { id: 'db', kind: 'db', at: at(0, 0), label: 'Postgres', sub: '500M order items' };
const replica: SceneNode = { id: 'replica', kind: 'replica', at: at(3.4, 0), label: 'read replica' };
const wh: SceneNode = { id: 'wh', kind: 'warehouse', at: at(3.4, 0), label: 'warehouse', sub: 'columnar, MPP' };
const analyst: SceneNode = { id: 'analyst', kind: 'user', at: at(6.8, 3.5), label: 'analyst', sub: 'revenue report' };

const col = (id: string, d: number, s: number, label: string, sub: string): SceneNode => ({
  id,
  kind: 'block',
  icon: 'Table',
  tint: 'teal',
  size: 0.8,
  at: at(d, s),
  label,
  sub,
});
const colAnalyst: SceneNode = { ...analyst, at: at(-5.4, 0) };
const colDate = col('colDate', -2.2, -2.4, 'order_date', '730 distinct days');
const colCountry = col('colCountry', 1, 0, 'country', '200 distinct values');
const colAmount = col('colAmount', 4.2, 2.4, 'amount', 'many distinct values');
const others: SceneNode = { id: 'others', kind: 'block', icon: 'Table', tint: 'gray', size: 0.8, at: at(7.4, 0), label: '17 other columns', sub: 'never read', status: 'dim' };

const fact: SceneNode = { id: 'fact', kind: 'db', at: at(-3.4, 0), label: 'fact_sales', sub: '500M rows' };
const dimDate: SceneNode = { id: 'dimDate', kind: 'block', icon: 'Table', tint: 'amber', size: 0.8, at: at(0, -3.2), label: 'dim_date', sub: '730 rows' };
const dimCustomer: SceneNode = { id: 'dimCustomer', kind: 'block', icon: 'Users', tint: 'blue', size: 0.8, at: at(3.4, 0), label: 'dim_customer', sub: '8M rows' };
const dimProduct: SceneNode = { id: 'dimProduct', kind: 'block', icon: 'Package', tint: 'green', size: 0.8, at: at(0, 3.2), label: 'dim_product', sub: '50K rows' };

export const dataWarehouse: Lesson = {
  id: 'data-warehouse',
  title: 'Data warehouse and OLAP (part 1)',
  tagline: 'Give analytics its own columnar store so big reports run in seconds and checkout never notices. Part 1 covers why, how columns work and how to model the data.',
  minutes: 14,
  level: 'Intermediate',
  learn: [
    'OLTP versus OLAP: two workloads that want opposite things',
    'Why a read replica is not an analytics database',
    'Why columnar storage reads a fraction of the bytes, and how compression and MPP finish the job',
    'Fact and dimension tables in a star schema',
    'Part 2 covers dimension history, snowflake schemas, ELT, CDC, pruning, rollups, cost and data lakes',
  ],
  metrics: [
    { key: 'q', label: 'Report query', icon: 'Timer' },
    { key: 'scanned', label: 'Data read', icon: 'HardDrive' },
    { key: 'checkout', label: 'Checkout p99', icon: 'Gauge' },
    { key: 'fresh', label: 'Report freshness', icon: 'Clock' },
  ],
  steps: [
    {
      title: 'Report vs checkout',
      tag: 'problem',
      heading: 'One report slows down every checkout',
      eli5: 'The toy shop keeps every receipt in the till drawer. The owner asks the cashier to count two years of teddy bear sales, and while the cashier digs through the **till**, the line of customers grows.',
      body: [
        'An online store keeps **500 million order items** in Postgres, about 100 GB. Every Monday an analyst runs "revenue by country by month for the last two years" on the production database.',
        'It reads every order item, joins customers and groups the result. It runs **12 minutes**, saturates the disks and pushes hot checkout rows out of the memory cache. Checkout p99 goes from 80 ms to 2.5 s and some payments time out.',
      ],
      keyIdea: 'An analytical scan on the production database competes with customers for the same disks, memory and CPU, and customers lose.',
      metrics: { q: '12 min', scanned: '100 GB', checkout: '2.5 s', fresh: 'live' },
      metricTones: { q: 'bad', scanned: 'bad', checkout: 'bad' },
      scene: {
        nodes: [
          { ...shoppers, chips: ['POST /orders'] },
          { ...app, status: 'hot', load: 88, badge: 'p99 2.5 s' },
          { ...db, status: 'hot', load: 97, chips: [{ text: 'SUM over 500M rows', tone: 'bad' }] },
          { ...analyst, status: 'active' },
        ],
        links: [link('shoppers', 'app'), link('app', 'db'), link('analyst', 'db')],
        flows: [
          { path: ['shoppers', 'app'], tone: 'request', count: 4, duration: 1 },
          { path: ['app', 'db'], tone: 'request', label: 'INSERT order', count: 4, duration: 1, delay: 1 },
          { path: ['analyst', 'db'], tone: 'request', label: 'SUM over 500M rows', duration: 1.4, delay: 0.3 },
          { path: ['db', 'app'], tone: 'error', label: 'slow', duration: 2.6, delay: 2.1 },
        ],
        panel: {
          title: 'While the report runs',
          icon: 'Activity',
          rows: [
            { text: 'Report time', value: '12 min', tone: 'bad' },
            { text: 'Disks', value: 'saturated', tone: 'bad' },
            { text: 'Hot rows in cache', value: 'evicted', tone: 'warn' },
            { text: 'Checkout p99', value: '80 ms to 2.5 s', tone: 'bad' },
          ],
          footer: { text: 'Some payments time out', tone: 'bad' },
        },
        caption: 'Analytics and checkout share one database',
      },
    },
    {
      title: 'OLTP',
      tag: 'concept',
      heading: 'The database was built for a different job',
      eli5: 'The cashier handles one sale at a time, and does it fast. The **till** is laid out for that: grab one slip, write one slip. It was never meant for counting two years of slips.',
      body: [
        '**OLTP** (online transaction processing) is the app\'s workload: many small reads and writes, each touching a few rows found by key, each in a transaction that must answer in milliseconds. "Insert this order." "Load cart 7."',
        'Normalized tables and B-tree indexes suit it. The database is tuned for thousands of tiny transactions per second, and the Monday report is one enormous read.',
      ],
      keyIdea: 'OLTP is many tiny transactions by key. The production database is tuned for exactly that and for nothing else.',
      metrics: { q: '12 min', scanned: '100 GB', checkout: '80 ms', fresh: 'live' },
      metricTones: { checkout: 'good' },
      scene: {
        nodes: [
          { ...shoppers, chips: ['POST /orders'] },
          { ...app, status: 'ok', load: 35, chips: ['GET /cart/7'] },
          { ...db, status: 'ok', load: 30, badge: '5 ms by key' },
        ],
        links: [link('shoppers', 'app'), link('app', 'db')],
        flows: [
          { path: ['shoppers', 'app', 'db'], tone: 'request', label: 'one order', count: 3, duration: 1.6 },
          { path: ['db', 'app', 'shoppers'], tone: 'response', label: 'ok, 5 ms', duration: 1.6, delay: 1.8 },
        ],
        panel: {
          title: 'OLTP workload',
          icon: 'Zap',
          rows: [
            { text: 'Queries', value: 'thousands per second' },
            { text: 'Rows per query', value: 'a few, found by key' },
            { text: 'Answer needed in', value: 'milliseconds' },
            { text: 'Layout', value: 'normalized + B-tree' },
          ],
        },
        caption: 'Many tiny transactions by key',
      },
    },
    {
      title: 'OLAP',
      tag: 'concept',
      heading: 'Analytics wants the opposite',
      eli5: 'The accountant in the back room adds up thousands of receipts at once. That adding-up job is **OLAP**. Nobody is in a hurry, but the pile is huge.',
      body: [
        '**OLAP** (online analytical processing) is the analyst\'s workload: few queries, each reading millions or billions of rows but only a few columns, then aggregating them. The data is mostly history that no longer changes, and seconds to minutes is fine.',
        'No single storage layout is best at both jobs.',
      ],
      keyIdea: 'OLAP is a few huge scans and aggregates over history. It wants a different storage layout than OLTP.',
      metrics: { q: '12 min', scanned: '100 GB', checkout: '80 ms', fresh: 'live' },
      scene: {
        nodes: [{ ...db, status: 'active', label: 'OLTP database', badge: 'rows by key' }, { ...wh, status: 'active', badge: 'scans, aggregates' }, analyst],
        links: [link('analyst', 'wh')],
        flows: [{ path: ['analyst', 'wh', 'analyst'], tone: 'request', label: '2 years by month', duration: 2 }],
        panel: {
          title: 'Two workloads',
          icon: 'ArrowLeftRight',
          rows: [
            { text: 'OLTP workload', value: 'many small reads and writes' },
            { text: 'OLTP storage', value: 'row-oriented' },
            { text: 'OLTP answer', value: 'milliseconds' },
            { text: 'OLAP workload', value: 'few huge scans' },
            { text: 'OLAP storage', value: 'column-oriented' },
            { text: 'OLAP answer', value: 'seconds to minutes' },
          ],
        },
        caption: 'Same data, opposite access patterns',
      },
    },
    {
      title: 'Replica idea',
      tag: 'case',
      heading: 'Case: "just point the analysts at a replica"',
      eli5: 'The shop gives the accountant a photocopy of the till drawer, so the cashier is left alone. But the copy still has one slip per sheet, so counting two years of slips is still slow.',
      body: [
        'A cheaper idea comes up first: let analysts query a Postgres **read replica**. Checkout never touches it, so what could go wrong?',
        'The replica is still a row store, so the report still reads 100 GB and still takes 12 minutes. Checkout is safe, but the analyst waits just as long.',
      ],
      keyIdea: 'A replica protects checkout from the scan but keeps the slow row layout, so the report is no faster.',
      metrics: { q: '12 min', scanned: '100 GB', checkout: '80 ms', fresh: 'lag grows' },
      metricTones: { q: 'bad', scanned: 'bad', checkout: 'good' },
      scene: {
        nodes: [{ ...app, status: 'ok' }, { ...db, status: 'ok' }, { ...replica, status: 'hot', load: 96 }, { ...analyst, status: 'active' }],
        links: [link('app', 'db'), link('db', 'replica', { style: 'dashed', label: 'WAL' }), link('analyst', 'replica')],
        flows: [
          { path: ['app', 'db'], tone: 'request', count: 3, duration: 1.2 },
          { path: ['db', 'replica'], tone: 'data', label: 'changes', duration: 1.4, delay: 0.8 },
          { path: ['analyst', 'replica'], tone: 'request', label: '12-minute scan', duration: 2, delay: 0.4 },
        ],
        panel: {
          title: 'Report on the replica',
          icon: 'Table',
          rows: [
            { text: 'Layout', value: 'row store', tone: 'warn' },
            { text: 'Bytes read', value: '100 GB', tone: 'bad' },
            { text: 'Time', value: '12 min', tone: 'bad' },
            { text: 'Checkout p99', value: '80 ms', tone: 'good' },
          ],
        },
        caption: 'Checkout is safe. The report is not faster.',
      },
    },
    {
      title: 'Replica conflict',
      tag: 'case',
      heading: 'Long reads and replication collide',
      eli5: 'While the accountant spreads the photocopies out on the table, new receipts keep arriving. The helper cannot clear the old ones away, so either the accountant stops or the pile of new receipts grows.',
      body: [
        'A long query on a replica collides with replication. The primary keeps vacuuming old row versions, and replaying that cleanup would remove rows the report is still reading.',
        'Postgres must cancel the query (after 30 seconds by default), pause replay so the replica falls behind, or, with `hot_standby_feedback` on, make the primary keep old rows, which bloats it.',
      ],
      keyIdea: 'Every option hurts someone: a cancelled report, a stale replica or a bloated primary. Long scans and replication do not mix.',
      metrics: { q: 'cancelled', scanned: '100 GB', checkout: '80 ms', fresh: 'lag grows' },
      metricTones: { q: 'bad', fresh: 'bad' },
      scene: {
        nodes: [
          { ...db, status: 'active', badge: 'vacuum' },
          { ...replica, status: 'hot', badge: 'replay paused', chips: [{ text: 'conflict with recovery', tone: 'bad' }] },
          { ...analyst, status: 'hot', badge: 'query cancelled' },
        ],
        links: [link('db', 'replica', { style: 'dashed', label: 'WAL', labelTone: 'warn' }), link('analyst', 'replica')],
        flows: [
          { path: ['db', 'replica'], tone: 'data', label: 'cleanup records', count: 3, duration: 1.4 },
          { path: ['analyst', 'replica'], tone: 'request', label: '12-minute scan', duration: 2, delay: 0.4 },
          { path: ['replica', 'analyst'], tone: 'error', label: 'conflict with recovery', duration: 1.4, delay: 2.6 },
        ],
        panel: {
          title: 'Three ways out',
          icon: 'Scale',
          rows: [
            { text: 'Cancel the query', value: 'after 30 s', tone: 'bad' },
            { text: 'Pause replay', value: 'replica lags', tone: 'warn' },
            { text: 'hot_standby_feedback', value: 'primary bloats', tone: 'warn' },
          ],
        },
        caption: 'Long reads and replication pull in opposite directions',
      },
    },
    {
      title: 'Warehouse',
      tag: 'concept',
      heading: 'Give analytics its own system',
      eli5: 'The shop moves the accountant to a back room with a copy of the receipts and a proper desk. The cashier and the accountant never get in each other\'s way.',
      body: [
        'A replica is fine for a quick lookup or a small ad hoc count. For real analytics, the usual design keeps the workloads apart: production stays an OLTP database, and a copy of the data goes to a **data warehouse** built for OLAP.',
        'Examples are Snowflake, BigQuery, Redshift and ClickHouse.',
      ],
      keyIdea: 'Production stays OLTP. A copy of the data goes to a warehouse built for scans and aggregates.',
      metrics: { q: '12 min', scanned: '100 GB', checkout: '80 ms', fresh: 'copy' },
      metricTones: { checkout: 'good' },
      scene: {
        nodes: [
          shoppers,
          { ...app, status: 'ok' },
          { ...db, status: 'ok', label: 'OLTP database', badge: '5 ms by key' },
          { ...wh, status: 'active', badge: 'scans, aggregates' },
          analyst,
        ],
        links: [link('shoppers', 'app'), link('app', 'db'), link('db', 'wh', { style: 'dashed', label: 'copy' }), link('analyst', 'wh')],
        flows: [
          { path: ['shoppers', 'app', 'db'], tone: 'request', label: 'one order', count: 3, duration: 1.4 },
          { path: ['db', 'wh'], tone: 'data', duration: 1.6, delay: 1.5 },
          { path: ['analyst', 'wh', 'analyst'], tone: 'request', label: '2 years by month', duration: 2, delay: 2 },
        ],
        panel: {
          title: 'Who goes where',
          icon: 'Split',
          rows: [
            { text: 'Customers', value: 'OLTP database', tone: 'good' },
            { text: 'Analysts', value: 'data warehouse', tone: 'good' },
            { text: 'Data flow', value: 'one-way copy' },
          ],
        },
        caption: 'Customers on one side, analysts on the other',
      },
    },
    {
      title: 'Row store',
      tag: 'concept',
      heading: 'A row store reads everything',
      eli5: 'Each receipt is a whole slip of paper with twenty lines on it. To add up just the prices, the accountant has to pick up every slip and look at all twenty lines.',
      body: [
        'A **row store** keeps each row\'s values together on disk. That is ideal for "load order 9001": one seek and the whole row is there.',
        'To sum `amount` it must read whole rows, all 20 columns, about 200 bytes each: the full 100 GB.',
      ],
      keyIdea: 'A row store is great for fetching one row and wasteful for scanning one column.',
      metrics: { q: '12 min', scanned: '100 GB', checkout: '80 ms', fresh: '-' },
      metricTones: { scanned: 'bad' },
      scene: {
        nodes: [
          { id: 'orders', kind: 'db', at: at(0, 0), label: 'orders table', sub: 'row store', status: 'active', chips: ['20 columns', '~200 B per row'] },
          { id: 'whole', kind: 'block', icon: 'Table', tint: 'red', at: at(3.4, 0), label: 'whole rows', sub: 'all 20 columns', status: 'hot', badge: '100 GB read' },
          analyst,
        ],
        links: [link('analyst', 'orders'), link('orders', 'whole')],
        flows: [
          { path: ['analyst', 'orders'], tone: 'request', label: 'SUM(amount)', duration: 1.2 },
          { path: ['orders', 'whole'], tone: 'data', label: 'every column of every row', count: 3, duration: 1.6, delay: 1.3 },
        ],
        panel: {
          title: 'On disk, row by row',
          icon: 'List',
          code: 'row 1 | 9001 | 2025-03-02 | DE | 24.90 | ...\nrow 2 | 9002 | 2025-03-02 | FR | 12.00 | ...\nrow 3 | 9003 | 2025-03-03 | DE |  8.50 | ...\n      id     date         cty   amount   +16 more',
          footer: { text: 'SUM(amount) still reads every column', tone: 'bad' },
        },
        caption: 'Great for one row, wasteful for one column',
      },
    },
    {
      title: 'Columnar',
      tag: 'concept',
      heading: 'Store columns, not rows',
      eli5: 'The receipts were whole slips of paper. The back room copies them into separate lists: one of just dates, one of just countries, one of just prices. Keeping each list apart is **columnar** storage.',
      body: [
        'A **column store** keeps each column in its own file. The revenue report needs three columns, `order_date`, `country` and `amount`, so it reads those and skips the other 17.',
        'The 20 columns are roughly the same width, about 10 bytes each, so 3 of 20 is about 15% of the bytes before compression.',
      ],
      keyIdea: 'Analytical queries touch few columns over many rows. A column store reads only those columns.',
      metrics: { q: '-', scanned: '15 GB', checkout: '80 ms', fresh: '-' },
      metricTones: { scanned: 'good' },
      scene: {
        nodes: [{ ...colAnalyst, status: 'active' }, { ...colDate, status: 'active' }, { ...colCountry, status: 'active' }, { ...colAmount, status: 'active' }, others],
        links: [link('analyst', 'colDate'), link('analyst', 'colCountry'), link('analyst', 'colAmount'), link('analyst', 'others', { style: 'faint' })],
        flows: [
          { path: ['analyst', 'colDate'], tone: 'request', duration: 1 },
          { path: ['analyst', 'colCountry'], tone: 'request', duration: 1 },
          { path: ['analyst', 'colAmount'], tone: 'request', duration: 1 },
          { path: ['colDate', 'analyst'], tone: 'data', duration: 1.2, delay: 1.1 },
          { path: ['colCountry', 'analyst'], tone: 'data', duration: 1.2, delay: 1.1 },
          { path: ['colAmount', 'analyst'], tone: 'data', duration: 1.2, delay: 1.1 },
        ],
        panel: {
          title: 'Bytes before compression',
          icon: 'HardDrive',
          rows: [
            { text: 'Columns in the table', value: '20' },
            { text: 'Columns the report reads', value: '3', tone: 'good' },
            { text: 'Row store reads', value: '100 GB', tone: 'bad' },
            { text: 'Column store reads', value: '~15 GB', tone: 'good' },
          ],
        },
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
      title: 'Compression',
      tag: 'concept',
      heading: 'Columns compress very well',
      eli5: 'A list of only countries is full of repeats. Instead of writing "Germany" four thousand times, the accountant writes a short code and a note saying "four thousand of these in a row".',
      body: [
        'Columns compress very well, because one column holds similar values. `country` has about 200 distinct values, so it is stored as a small dictionary code, and long runs of the same value shrink further with run-length encoding.',
        'The three columns come to about **3 GB**.',
      ],
      keyIdea: 'Similar values side by side compress hard. Dictionary and run-length coding cut the 15 GB to about 3 GB.',
      metrics: { q: '-', scanned: '3 GB', checkout: '80 ms', fresh: '-' },
      metricTones: { scanned: 'good' },
      scene: {
        nodes: [
          { ...colDate, status: 'ok', chips: ['sorted, small gaps'] },
          { ...colCountry, status: 'active', chips: ['dictionary code', 'run-length'] },
          { ...colAmount, status: 'ok', chips: ['numeric, few repeats'] },
        ],
        links: [link('colDate', 'colCountry', { style: 'faint' }), link('colCountry', 'colAmount', { style: 'faint' })],
        flows: [{ path: ['colCountry', 'colAmount'], tone: 'data', label: '15 GB to 3 GB', duration: 1.6 }],
        panel: {
          title: 'country column',
          icon: 'Binary',
          code: 'raw    DE DE DE DE FR FR FR\ndict   DE=0  FR=1\ncodes  0  0  0  0  1  1  1\nRLE    (0 x4) (1 x3)',
          footer: { text: '15 GB raw, about 3 GB stored', tone: 'good' },
        },
        caption: 'Same values, far fewer bytes',
      },
    },
    {
      title: 'MPP',
      tag: 'concept',
      heading: 'Split the scan across many machines',
      eli5: 'The accountant does not count alone. Three helpers each take a third of the lists, count their share, and hand back one small total for the accountant to add up.',
      body: [
        'The warehouse splits that scan across many machines in parallel (**MPP**, massively parallel processing). Each node scans its share of the 3 GB and sends back a small partial sum.',
        'The report finishes in about **4 seconds**, down from 12 minutes.',
      ],
      keyIdea: 'A column store reads less, and MPP reads it in parallel. Together they turn minutes into seconds.',
      metrics: { q: '4 s', scanned: '3 GB', checkout: '80 ms', fresh: '-' },
      metricTones: { q: 'good', scanned: 'good', checkout: 'good' },
      scene: {
        nodes: [
          { ...analyst, at: at(-1.8, -4.8), status: 'active' },
          { ...wh, at: at(1.4, -4.8), status: 'active', badge: 'plans, merges' },
          { id: 'n1', kind: 'server', at: at(-0.2, 4.8), label: 'node 1', sub: '1 GB', status: 'ok', load: 40 },
          { id: 'n2', kind: 'server', at: at(3, 4.8), label: 'node 2', sub: '1 GB', status: 'ok', load: 40 },
          { id: 'n3', kind: 'server', at: at(6.2, 4.8), label: 'node 3', sub: '1 GB', status: 'ok', load: 40 },
        ],
        links: [link('analyst', 'wh'), link('wh', 'n1'), link('wh', 'n2'), link('wh', 'n3')],
        flows: [
          { path: ['analyst', 'wh'], tone: 'request', label: 'revenue by month', duration: 1 },
          { path: ['wh', 'n1'], tone: 'request', duration: 1, delay: 1.1 },
          { path: ['wh', 'n2'], tone: 'request', duration: 1, delay: 1.1 },
          { path: ['wh', 'n3'], tone: 'request', duration: 1, delay: 1.1 },
          { path: ['n2', 'wh', 'analyst'], tone: 'response', label: 'partial sums, 4 s', duration: 1.6, delay: 2.4 },
        ],
        panel: {
          title: 'One report, three scans',
          icon: 'Cpu',
          rows: [
            { text: 'Data to scan', value: '3 GB' },
            { text: 'Nodes', value: '3 in parallel' },
            { text: 'Per node', value: '1 GB', tone: 'good' },
            { text: 'Report time', value: '~4 s', tone: 'good' },
          ],
        },
        caption: 'Each node scans its slice, the warehouse adds the totals',
      },
    },
    {
      title: 'Fact table',
      tag: 'concept',
      heading: 'Facts: one row per event you measure',
      eli5: 'The back room keeps one giant list of every sale. That list is the **fact table**. Each line says how many and how much, plus which toy, which day, which customer.',
      body: [
        'Warehouses usually model data as a **star schema**. The **fact table** in the middle has one row per event you measure, here one per item sold: foreign keys plus numbers you add up (`quantity`, `amount`).',
        'It is long and narrow, 500 million rows. Analysts query this one table instead of the app\'s 80 normalized tables.',
      ],
      keyIdea: 'The fact table holds the measurable events: keys to describe them and numbers to add up.',
      metrics: { q: '4 s', scanned: '3 GB', checkout: '80 ms', fresh: '-' },
      scene: {
        nodes: [
          { id: 'appTables', kind: 'block', icon: 'Boxes', tint: 'gray', size: 0.8, at: at(-6.8, 0), label: 'app tables', sub: '80 normalized' },
          { ...fact, status: 'active', badge: 'one row per item sold' },
          { ...analyst, at: at(0, 0) },
        ],
        links: [link('appTables', 'fact', { style: 'dashed', label: 'reshaped' }), link('analyst', 'fact')],
        flows: [
          { path: ['appTables', 'fact'], tone: 'data', duration: 1.4 },
          { path: ['analyst', 'fact', 'analyst'], tone: 'request', label: 'one simple table', duration: 1.8, delay: 1.5 },
        ],
        panel: {
          title: 'fact_sales',
          icon: 'Table',
          rows: [
            { text: 'order_date', value: 'key' },
            { text: 'customer_key', value: 'key' },
            { text: 'product_key', value: 'key' },
            { text: 'quantity', value: 'measure', tone: 'good' },
            { text: 'amount', value: 'measure', tone: 'good' },
          ],
          footer: { text: 'Long and narrow: 500M rows', tone: 'muted' },
        },
        caption: 'The middle of the star',
      },
    },
    {
      title: 'Dimensions',
      tag: 'concept',
      heading: 'Dimensions: the descriptions around the facts',
      eli5: 'Each line in the big list points to a small card: which toy, which day, which customer. The cards say who or what it was, so the list itself stays short.',
      body: [
        'Around the fact table sit **dimension tables** that describe it: `dim_date` (day, month, quarter, holiday flag), `dim_customer` (country, segment), `dim_product` (category, brand).',
        'They are short and wide, and **denormalized** on purpose: country sits right in `dim_customer`, with no extra join to a countries table.',
      ],
      keyIdea: 'Dimensions are small, wide and denormalized, so describing a fact never needs a long chain of joins.',
      metrics: { q: '4 s', scanned: '3 GB', checkout: '80 ms', fresh: '-' },
      scene: {
        nodes: [{ ...fact, status: 'active' }, { ...dimDate, status: 'ok' }, { ...dimCustomer, status: 'ok', badge: 'country' }, { ...dimProduct, status: 'ok' }],
        links: [link('fact', 'dimDate'), link('fact', 'dimCustomer'), link('fact', 'dimProduct')],
        flows: [
          { path: ['dimDate', 'fact'], tone: 'data', label: 'month', duration: 1.2 },
          { path: ['dimCustomer', 'fact'], tone: 'data', label: 'country', duration: 1.2, delay: 0.3 },
          { path: ['fact', 'dimProduct'], tone: 'request', label: 'product_key', duration: 1.2, delay: 1.6 },
        ],
        panel: {
          title: 'What dimensions hold',
          icon: 'Users',
          rows: [
            { text: 'dim_date', value: 'day, month, quarter, holiday' },
            { text: 'dim_customer', value: 'country, segment' },
            { text: 'dim_product', value: 'category, brand' },
          ],
          footer: { text: 'Country lives in dim_customer: no extra join', tone: 'good' },
        },
        caption: 'One fact table, three dimensions',
      },
    },
    {
      title: 'Report shape',
      tag: 'concept',
      heading: 'Every report is the same join',
      eli5: 'Any question the accountant gets sounds alike: "add up the prices, grouped by day, or country, or toy". So the question is easy to write and the desk is set up for it.',
      body: [
        'Every report has the same shape: filter and group by dimension attributes, sum the fact measures. Analysts can write it without knowing the app\'s 80 tables.',
        'The engine is optimized for exactly this join pattern.',
      ],
      keyIdea: 'A star schema puts events in one big fact table and descriptions in small dimension tables, so every report is one simple join pattern.',
      metrics: { q: '4 s', scanned: '3 GB', checkout: '80 ms', fresh: '-' },
      scene: {
        nodes: [
          { ...analyst, at: at(-6.8, 0), status: 'active' },
          { ...fact, status: 'active', badge: 'SUM(amount)' },
          { ...dimDate, status: 'ok', badge: 'GROUP BY month' },
          { ...dimCustomer, status: 'ok', badge: 'GROUP BY country' },
          { ...dimProduct, status: 'dim' },
        ],
        links: [link('analyst', 'fact'), link('fact', 'dimDate'), link('fact', 'dimCustomer'), link('fact', 'dimProduct', { style: 'faint' })],
        flows: [
          { path: ['analyst', 'fact'], tone: 'request', label: 'revenue report', duration: 1.2 },
          { path: ['fact', 'dimDate'], tone: 'request', label: 'join', duration: 1.2, delay: 1.3 },
          { path: ['fact', 'dimCustomer'], tone: 'request', label: 'join', duration: 1.2, delay: 1.3 },
          { path: ['fact', 'analyst'], tone: 'response', label: 'rows by month, country', duration: 1.4, delay: 2.7 },
        ],
        panel: {
          title: 'Same shape every time',
          icon: 'Table',
          rows: [
            { text: 'FROM', value: 'the fact table' },
            { text: 'JOIN', value: 'the dimensions you need' },
            { text: 'WHERE / GROUP BY', value: 'dimension attributes' },
            { text: 'SUM / COUNT', value: 'fact measures' },
          ],
        },
        caption: 'Filter and group by dimensions, sum the facts',
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
      title: 'Recap 1',
      tag: 'recap',
      heading: 'Part 1: a separate, columnar, star-shaped store',
      eli5: 'The cashier keeps serving customers at the **till**. The accountant works in the back room from lists of dates, countries and prices, with helpers, so the answer comes back in seconds.',
      body: [
        '**OLTP** and **OLAP** want opposite storage, and a read replica fixes neither the layout nor the replication clash. A **column store** reads only the columns a query needs, compressed and in parallel (**MPP**): 12 minutes and 100 GB became about 4 seconds and 3 GB.',
        'The data is modeled as a **star schema** of one fact table and small dimensions. Part 2 covers how history in dimensions is kept, how data gets in, partitioning, cost and data lakes.',
      ],
      keyIdea: 'Keep analytics off production. Copy the data into a columnar, parallel warehouse and model it as a star.',
      metrics: { q: '4 s', scanned: '3 GB', checkout: '80 ms', fresh: '-' },
      metricTones: { q: 'good', scanned: 'good', checkout: 'good' },
      scene: {
        nodes: [shoppers, { ...app, status: 'ok' }, { ...db, status: 'ok' }, { ...wh, status: 'ok', badge: 'fact + dimensions' }, analyst],
        links: [link('shoppers', 'app'), link('app', 'db'), link('db', 'wh', { style: 'dashed', label: 'copy' }), link('analyst', 'wh')],
        flows: [
          { path: ['shoppers', 'app', 'db'], tone: 'request', count: 3, duration: 1.4 },
          { path: ['db', 'wh'], tone: 'data', duration: 1.6, delay: 1.5 },
          { path: ['analyst', 'wh', 'analyst'], tone: 'response', label: 'report in 4 s', duration: 1.8, delay: 3.2 },
        ],
        panel: {
          title: 'Before and after',
          icon: 'TrendingUp',
          rows: [
            { text: 'Report time', value: '12 min to 4 s', tone: 'good' },
            { text: 'Data read', value: '100 GB to 3 GB', tone: 'good' },
            { text: 'Checkout p99', value: '80 ms, untouched', tone: 'good' },
          ],
        },
        caption: 'Customers and analysts no longer compete',
      },
      quiz: {
        question: 'To protect checkout, analysts are moved to a Postgres read replica. Checkout is fine, but the two-year report still takes about 12 minutes. Why?',
        options: [
          'Replicas are throttled to save bandwidth',
          'The replica is still a row store, so the report still reads about 100 GB',
          'Replicas cannot run aggregate queries',
          'The primary holds a lock on the table',
        ],
        answer: 1,
        explain: 'A replica copies the primary byte for byte, including the row layout. The report still reads every column of every row. Only a column store, in a separate system, cuts the bytes read.',
      },
    },
  ],
};
