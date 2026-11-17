import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const users: SceneNode = { id: 'users', kind: 'phone', at: at(-9, 0), label: 'shoppers' };
const facade: SceneNode = { id: 'facade', kind: 'block', at: at(-6, 0), label: 'facade', sub: 'routing proxy', icon: 'Split', tint: 'violet' };
const legacy: SceneNode = { id: 'legacy', kind: 'server', at: at(-2.5, -4), label: 'old monolith', sub: '12 years old' };
const legacyDb: SceneNode = { id: 'legacyDb', kind: 'db', at: at(3.5, -4), label: 'old database', sub: 'ORD_HDR, CUST_MSTR' };
const orders: SceneNode = { id: 'orders', kind: 'block', size: 0.85, at: at(0.5, 4), label: 'orders service', sub: 'new', icon: 'ShoppingBag', tint: 'amber' };
const newDb: SceneNode = { id: 'newDb', kind: 'db', at: at(3.5, 4), label: 'orders DB', sub: 'new schema' };
const acl: SceneNode = { id: 'acl', kind: 'block', size: 0.8, at: at(3.5, 0), label: 'translator', sub: 'anti-corruption layer', icon: 'ArrowLeftRight', tint: 'teal' };
const backfill: SceneNode = { id: 'backfill', kind: 'worker', at: at(7, 0), label: 'backfill job', sub: 'copies history' };
const compare: SceneNode = { id: 'compare', kind: 'block', size: 0.8, at: at(7, 0), label: 'comparator', sub: 'diffs answers', icon: 'Scale', tint: 'blue' };
const rewrite: SceneNode = { id: 'rewrite', kind: 'block', size: 0.85, at: at(0.5, 4), label: 'the rewrite', sub: 'month 18 of 12', icon: 'Boxes', tint: 'gray' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

export const migrationPatternsPart2: Lesson = {
  id: 'migration-patterns-part-2',
  title: 'Migration: moving data and finishing (part 2)',
  tagline: 'Move the data safely, prove the new system matches the old one, cut over in steps, and delete what you replaced.',
  minutes: 14,
  level: 'Advanced',
  learn: [
    'Expand and contract schema changes',
    'Change capture, a restartable backfill, the outbox and reconciliation',
    'Shadow traffic, hidden rules and what is safe to mirror',
    'Gradual cutover with a rollback rule, flipping the sync, and deleting the old path',
    'The real costs of the strangler fig and when a big-bang switch is fine',
  ],
  metrics: [
    { key: 'share', label: 'Traffic on new', icon: 'Split' },
    { key: 'blast', label: 'Blast radius', icon: 'Zap' },
    { key: 'systems', label: 'Systems running', icon: 'Server' },
    { key: 'diff', label: 'Mismatches', icon: 'Scale' },
  ],
  steps: [
    {
      title: 'Expand, contract',
      tag: 'concept',
      heading: 'Change schemas in two safe phases',
      eli5: 'To rename a shelf, first add the new label next to the old one. Wait until everyone reads the new label, then peel off the old one.',
      body: [
        'Renaming or splitting a column in one deploy breaks every reader that has not updated yet. **Expand and contract** (also called parallel change) does it in phases.',
        '**Expand**: add the new column and write both. **Migrate**: backfill old rows and move readers over. **Contract**: drop the old column once nobody reads it.',
      ],
      keyIdea: 'Add the new shape beside the old, move readers, then remove the old shape. Every phase can be rolled back.',
      metrics: { share: '10% of /orders', blast: 'one column', systems: '2 + facade', diff: '-' },
      scene: {
        nodes: [{ ...orders, status: 'active' }, { ...newDb, status: 'active', chips: ['status', { text: 'state (new)', tone: 'good' }] }],
        links: [link('orders', 'newDb')],
        flows: [{ path: ['orders', 'newDb'], tone: 'request', label: 'write both', duration: 1.4 }],
        panel: {
          title: 'Rename status to state',
          icon: 'Table',
          code: '-- 1 expand\nALTER TABLE orders ADD state text;\n-- 2 migrate\nUPDATE orders SET state = status;\n-- 3 contract (later)\nALTER TABLE orders DROP status;',
        },
        caption: 'Three small deploys, not one risky one',
      },
    },
    {
      title: 'Moving data',
      tag: 'concept',
      heading: 'Moving the data: capture changes, then backfill',
      eli5: 'The new counter needs its own copy of the order book. A helper copies every old page, and every new order written at the old counters gets copied over too.',
      body: [
        'Order history needs 8 years of orders in the new database, and it must stay current while the monolith keeps taking orders. Two jobs run together.',
        'New changes flow through **change data capture** (CDC): a connector reads the old database\'s change log and applies each insert and update to the new database within seconds. Start CDC before the backfill, so no change slips through the gap.',
      ],
      keyIdea: 'Stream new changes first, then copy history, until both copies agree.',
      metrics: { share: '10% of /orders', blast: 'order history', systems: '2 + facade', diff: '0.4%' },
      metricTones: { diff: 'warn' },
      scene: {
        nodes: [{ ...legacyDb, status: 'active', badge: '8 years of orders' }, { ...newDb, status: 'active', badge: '61% copied' }, { ...backfill, status: 'active' }],
        links: [link('legacyDb', 'backfill'), link('backfill', 'newDb'), link('legacyDb', 'newDb', { style: 'dashed', label: 'CDC' })],
        flows: [
          { path: ['legacyDb', 'newDb'], tone: 'event', label: 'new order', duration: 1.4 },
          { path: ['legacyDb', 'backfill', 'newDb'], tone: 'data', label: 'batch', count: 3, duration: 2.2, delay: 0.8 },
        ],
        caption: 'Live changes stream over while history is copied',
      },
    },
    {
      title: 'Backfill',
      tag: 'concept',
      heading: 'The backfill: small, throttled, restartable',
      eli5: 'The helper copies the old book a handful of pages at a time, so the old counters never stop serving. If the helper falls asleep, restarting does no harm.',
      body: [
        'A **backfill** copies the history in small batches, oldest first, through the same translation as the ACL. It is throttled so the old database keeps serving customers.',
        'It is safe to stop and restart because it writes with upserts keyed on order id. A batch that CDC already wrote is simply overwritten with the same data.',
      ],
      keyIdea: 'Batch by key, throttle, and upsert, so the backfill can stop and restart at any point.',
      metrics: { share: '10% of /orders', blast: 'order history', systems: '2 + facade', diff: '0.4%' },
      scene: {
        nodes: [{ ...legacyDb, status: 'active' }, { ...backfill, status: 'active', badge: '5,000 rows/batch' }, { ...newDb, status: 'active' }],
        links: [link('legacyDb', 'backfill'), link('backfill', 'newDb')],
        flows: [{ path: ['legacyDb', 'backfill', 'newDb'], tone: 'data', label: 'batch', count: 3, duration: 2 }],
        panel: {
          title: 'Backfill rules',
          icon: 'Gauge',
          rows: [
            { text: 'Batch size', value: '5,000 rows' },
            { text: 'Order', value: 'by order id, oldest first' },
            { text: 'Write mode', value: 'upsert, restartable', tone: 'good' },
          ],
        },
        caption: 'A steady trickle that can be paused',
      },
      code: {
        language: 'sql',
        title: 'One restartable backfill batch',
        source: `-- run repeatedly; :last_id comes from the previous batch
INSERT INTO orders (id, customer_id, total_cents, status, placed_at)
SELECT h.ORD_NO,
       h.CST_NO,
       ROUND(h.ORD_AMT * 100),
       CASE h.ORD_STAT WHEN 'S' THEN 'shipped'
                       WHEN 'C' THEN 'cancelled'
                       ELSE 'open' END,
       h.ORD_DT
FROM   legacy.ORD_HDR h
WHERE  h.ORD_NO > :last_id
ORDER  BY h.ORD_NO
LIMIT  5000
ON CONFLICT (id) DO UPDATE                -- CDC may have written it already
SET    status = EXCLUDED.status;`,
        highlight: [11, 13, 14],
      },
    },
    {
      title: 'Dual writes',
      tag: 'case',
      heading: 'Case: the dual write that half happened',
      eli5: 'A clerk writes each new order in the old book and then in the new book. One day the phone rings between the two, and the new book never gets that order.',
      body: [
        'Before CDC, the team tried **dual writes**: the monolith wrote each order to the old database, then called the new service to write it again.',
        'One night the new database was slow. The first write committed, the second timed out, and the monolith logged the error and moved on. **312 orders** existed only in the old database. No transaction spans two databases owned by two systems.',
      ],
      keyIdea: 'Two independent writes will eventually disagree.',
      metrics: { share: '10% of /orders', blast: 'order history', systems: '2 + facade', diff: '312 orders' },
      metricTones: { diff: 'bad' },
      scene: {
        nodes: [{ ...legacy, status: 'active', badge: 'write twice' }, { ...legacyDb, status: 'ok', badge: 'committed' }, orders, { ...newDb, status: 'hot', badge: 'timeout' }],
        links: [link('legacy', 'legacyDb'), link('legacy', 'orders'), link('orders', 'newDb', { label: 'slow', labelTone: 'warn' })],
        flows: [
          { path: ['legacy', 'legacyDb'], tone: 'request', label: 'INSERT order', duration: 1.2 },
          { path: ['legacy', 'orders', 'newDb'], tone: 'request', label: 'same order', duration: 1.8, delay: 1.3 },
          { path: ['newDb', 'orders', 'legacy'], tone: 'error', label: 'timed out', duration: 1.8, delay: 3.2 },
        ],
        caption: 'First write landed, second one did not',
      },
    },
    {
      title: 'Outbox',
      tag: 'concept',
      heading: 'The fix: one source of truth, delivered reliably',
      eli5: 'Instead of the clerk writing twice, the clerk writes once and drops a note in a tray. A runner carries every note to the new book and tries again if the door is stuck.',
      body: [
        'Make one database the source of truth and copy from its log (CDC). Or write an **outbox** row in the same transaction as the order, and let a relay deliver it to the new system with retries.',
        'Either way the copy is driven by a durable record, so a slow or failed delivery is retried and not forgotten. The receiver must handle repeats, for example by upserting on order id.',
      ],
      keyIdea: 'Write once in a transaction, then deliver from a durable log with retries and idempotent receivers.',
      metrics: { share: '10% of /orders', blast: 'order history', systems: '2 + facade', diff: '0 lost' },
      metricTones: { diff: 'good' },
      scene: {
        nodes: [{ ...legacyDb, status: 'ok', chips: ['orders', 'outbox'] }, { id: 'relay', kind: 'worker', at: at(7, 0), label: 'relay', sub: 'retries until acked', status: 'active' }, { ...newDb, status: 'ok' }],
        links: [link('legacyDb', 'relay'), link('relay', 'newDb')],
        flows: [
          { path: ['legacyDb', 'relay'], tone: 'event', label: 'outbox row', duration: 1.2 },
          { path: ['relay', 'newDb'], tone: 'data', label: 'upsert', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'One transaction',
          icon: 'Receipt',
          code: 'BEGIN;\n  INSERT INTO orders ...;\n  INSERT INTO outbox\n    (order_id, payload);\nCOMMIT;',
        },
        caption: 'The order and its note commit together',
      },
      quiz: {
        question: 'Why does a dual write between two databases lose data, and what fixes it?',
        options: [
          'The databases use different SQL dialects, so convert the queries',
          'There is no transaction across two systems, so write once and deliver from a log or outbox with retries',
          'Dual writes are too slow, so buy faster disks',
          'The facade drops the second request',
        ],
        answer: 1,
        explain: 'The first write can commit while the second fails. Writing once and copying from a durable log (CDC or an outbox) means a failed delivery is retried instead of forgotten.',
      },
    },
    {
      title: 'Reconcile',
      tag: 'concept',
      heading: 'Reconcile on a schedule',
      eli5: 'Every night someone counts the cakes in both order books and fixes any page that disagrees. Trust, but count.',
      body: [
        'Even with CDC, bugs and outages can leave gaps. Run a **reconciliation** job that compares counts and checksums per day for the old and new copies, and repairs any difference.',
        'Compare by day and then drill down, so a million rows never need to be diffed one by one. Alert when a day stays different.',
      ],
      keyIdea: 'Reconciliation turns hidden drift into a number you can watch and a repair you can run.',
      metrics: { share: '10% of /orders', blast: 'order history', systems: '2 + facade', diff: '312 → 0' },
      metricTones: { diff: 'good' },
      scene: {
        nodes: [legacyDb, { ...compare, status: 'active' }, newDb],
        links: [link('legacyDb', 'compare', { style: 'dashed' }), link('newDb', 'compare', { style: 'dashed' })],
        flows: [
          { path: ['legacyDb', 'compare'], tone: 'data', label: 'count, checksum', duration: 1.4 },
          { path: ['newDb', 'compare'], tone: 'data', label: 'count, checksum', duration: 1.4, delay: 0.2 },
        ],
        panel: {
          title: 'Nightly report',
          icon: 'Table',
          rows: [
            { text: 'Mon', value: '41,200 = 41,200', tone: 'good' },
            { text: 'Tue', value: '40,877 vs 40,565', tone: 'bad' },
            { text: 'Tue after repair', value: '40,877 = 40,877', tone: 'good' },
          ],
        },
        caption: 'Counts and checksums per day',
      },
    },
    {
      title: 'Shadow traffic',
      tag: 'concept',
      heading: 'Shadow traffic: compare before you trust',
      eli5: 'For a week, every cake order is made at both counters. Customers only get the old counter\'s cake, and someone checks that the two cakes match.',
      body: [
        'Before raising the share past 10%, the facade **mirrors** order-history requests: the old system answers the customer as usual, and a copy of the same request goes to the new service. Its answer is not returned to anyone.',
        'A **comparator** diffs the two answers and records mismatches by type.',
      ],
      keyIdea: 'Shadow traffic tests the new system on real requests with zero customer impact.',
      metrics: { share: '10% + shadow', blast: 'none (shadow)', systems: '2 + facade', diff: '0.4%' },
      metricTones: { blast: 'good', diff: 'warn' },
      scene: {
        nodes: [{ ...facade, status: 'active', badge: 'mirror reads' }, legacy, { ...orders, status: 'active', badge: 'answer discarded' }, { ...compare, status: 'ok', badge: '0.4% differ' }],
        links: [link('facade', 'legacy'), link('facade', 'orders', { style: 'dashed' }), link('legacy', 'compare', { style: 'dashed' }), link('orders', 'compare', { style: 'dashed' })],
        flows: [
          { path: ['facade', 'legacy'], tone: 'request', duration: 1, delay: 0 },
          { path: ['facade', 'orders'], tone: 'request', label: 'mirror', duration: 1 },
          { path: ['legacy', 'compare'], tone: 'data', duration: 1, delay: 1.2 },
          { path: ['orders', 'compare'], tone: 'data', duration: 1, delay: 1.2 },
        ],
        caption: 'Customers get the old answer, the comparator sees both',
      },
    },
    {
      title: 'Hidden rules',
      tag: 'case',
      heading: 'Case: the one-cent mismatch',
      eli5: 'The two cakes look the same, but one is a crumb lighter. The old baker had a secret way of rounding the flour.',
      body: [
        'The first day shows 0.4% of answers different: order totals off by a cent, from a rounding rule nobody had written down. That is a hidden business rule, found without a single customer seeing it.',
        'After the fix, mismatches drop from 0.4% to 0.01%, and the remaining few are explained one by one.',
      ],
      keyIdea: 'Every mismatch type points at a rule the old code knew and nobody wrote down.',
      metrics: { share: '10% + shadow', blast: 'none (shadow)', systems: '2 + facade', diff: '0.4% → 0.01%' },
      metricTones: { diff: 'good' },
      scene: {
        nodes: [{ ...legacy, status: 'ok', chips: ['total: $19.99'] }, { ...compare, status: 'hot', badge: '1 cent off' }, { ...orders, status: 'active', chips: [{ text: 'total: $19.98', tone: 'warn' }] }],
        links: [link('legacy', 'compare', { style: 'dashed' }), link('orders', 'compare', { style: 'dashed' })],
        flows: [
          { path: ['legacy', 'compare'], tone: 'data', label: '1999', duration: 1.2 },
          { path: ['orders', 'compare'], tone: 'error', label: '1998', duration: 1.2, delay: 0.2 },
        ],
        panel: {
          title: 'Mismatch report, day 1',
          icon: 'Scale',
          rows: [
            { text: 'Total off by 1 cent', value: '0.3%', tone: 'warn' },
            { text: 'Missing gift-wrap line', value: '0.1%', tone: 'warn' },
            { text: 'After fixes', value: '0.01%', tone: 'good' },
          ],
        },
        caption: 'A secret rounding rule, found for free',
      },
    },
    {
      title: 'Safe to mirror',
      tag: 'tradeoff',
      heading: 'Mirror only what is safe to repeat',
      eli5: 'It is fine to make a practice cake at the second counter. It is not fine to charge the customer twice for it.',
      body: [
        'Only mirror reads, or writes into a sandbox. Sending a duplicate `POST /checkout` to the new system would charge cards twice.',
        'Mirroring also doubles load on whatever both paths share, so watch the old database. Make new write paths **idempotent** (keyed on an order id), so a retry never doubles anything.',
      ],
      keyIdea: 'Shadow reads freely. Shadow writes only into a sandbox, and make every write idempotent.',
      metrics: { share: '10% + shadow', blast: 'none (shadow)', systems: '2 + facade', diff: '0.01%' },
      scene: {
        nodes: [{ ...facade, status: 'active' }, { ...orders, status: 'ok', chips: [{ text: 'GET /orders', tone: 'good' }, { text: 'POST /checkout', tone: 'bad' }] }, { ...legacyDb, status: 'hot', load: 78 }],
        links: [link('facade', 'orders'), link('facade', 'legacyDb', { style: 'faint', label: 'shared load', labelTone: 'warn' })],
        flows: [{ path: ['facade', 'orders'], tone: 'request', label: 'GET only', duration: 1.4 }],
        panel: {
          title: 'Mirror policy',
          icon: 'Shield',
          rows: [
            { text: 'GET /orders', value: 'mirror', tone: 'good' },
            { text: 'POST /checkout', value: 'never', tone: 'bad' },
            { text: 'Old DB load', value: 'watch it', tone: 'warn' },
          ],
        },
        caption: 'Charge a card once, however many copies run',
      },
    },
    {
      title: 'Cutover',
      tag: 'concept',
      heading: 'Cut over gradually, keep the way back open',
      eli5: 'Once the cakes match, the greeter sends more and more cake buyers to the new counter, a few at a time, until every cake comes from there.',
      body: [
        'Mismatches are below 0.01% and explained. The facade raises the share: 10%, 25%, 50%, 100%, a few days at each step, watching error rate, latency and the reconciliation report.',
        'Decide the rollback rule before each step, for example "error rate more than 0.5 points above the old path for 10 minutes". Written in advance, rolling back is routine, not a debate during an incident.',
      ],
      keyIdea: 'Move traffic in steps with a written rollback rule.',
      metrics: { share: '10% → 100%', blast: 'order history', systems: '2 + facade', diff: '< 0.01%' },
      metricTones: { share: 'good', diff: 'good' },
      scene: {
        nodes: [{ ...facade, status: 'active', badge: '/orders: 50% new' }, legacy, { ...orders, status: 'ok' }],
        links: [link('facade', 'legacy', { label: '50%' }), link('facade', 'orders', { label: '50%' })],
        flows: [
          { path: ['facade', 'legacy'], tone: 'request', count: 2, duration: 1.4 },
          { path: ['facade', 'orders'], tone: 'request', count: 2, duration: 1.4 },
        ],
        panel: {
          title: 'Ramp and rollback rule',
          icon: 'TrendingUp',
          rows: [
            { text: 'Steps', value: '10, 25, 50, 100%' },
            { text: 'Hold at each', value: 'a few days' },
            { text: 'Roll back if', value: 'errors +0.5 pts for 10 min', tone: 'warn' },
          ],
        },
        caption: 'A staircase with a written exit',
      },
    },
    {
      title: 'Flip the sync',
      tag: 'concept',
      heading: 'When writes move, flip the direction of sync',
      eli5: 'Once the new order book is the real one, the runner carries notes the other way, so the old counters can still read it if they must.',
      body: [
        'Reads are the easy part. When the new service starts taking writes for its slice, the new database becomes the source of truth and CDC feeds the old one.',
        'Any old report or job still reading there keeps working, and moving back stays possible. Flip only after reconciliation is clean.',
      ],
      keyIdea: 'Flip the sync so the new database is the source of truth and the old copy stays fed until it is retired.',
      metrics: { share: '100% of /orders', blast: 'order history', systems: '2 + facade', diff: '< 0.01%' },
      metricTones: { share: 'good' },
      scene: {
        nodes: [{ ...orders, status: 'ok' }, { ...newDb, status: 'ok', badge: 'source of truth' }, { ...legacyDb, status: 'dim', badge: 'fed by CDC' }],
        links: [link('orders', 'newDb'), link('newDb', 'legacyDb', { style: 'dashed', label: 'sync back' })],
        flows: [
          { path: ['orders', 'newDb'], tone: 'request', duration: 1, delay: 0 },
          { path: ['newDb', 'legacyDb'], tone: 'data', label: 'CDC', duration: 1.4, delay: 1.1 },
        ],
        caption: 'All order history on the new path, old copy still fed',
      },
    },
    {
      title: 'Finish line',
      tag: 'tradeoff',
      heading: 'Delete the old path, or pay for two systems forever',
      eli5: 'When nobody has used the old cake counter for a month, the bakery takes it out. If it stays, someone has to keep cleaning a counter nobody needs.',
      body: [
        'The last step is the one teams skip: remove the old code path, the sync back to the old database, the ACL pieces for this slice and the facade rule. Wait until logs show no traffic and no job reads the old tables.',
        'Until then you pay to run, patch and understand two systems.',
      ],
      keyIdea: 'A migration is done when the old path is deleted.',
      metrics: { share: '100% of /orders', blast: 'order history', systems: '1 + facade (this slice)', diff: '0' },
      metricTones: { systems: 'good', diff: 'good' },
      scene: {
        nodes: [{ ...facade, status: 'ok' }, { ...legacy, sub: 'orders code removed', status: 'dim' }, { ...orders, status: 'ok' }, { ...newDb, status: 'ok' }],
        links: [link('facade', 'legacy', { style: 'faint' }), link('facade', 'orders'), link('orders', 'newDb')],
        flows: [{ path: ['facade', 'orders', 'newDb'], tone: 'request', count: 3, duration: 2 }],
        panel: {
          title: 'Delete checklist',
          icon: 'List',
          rows: [
            { text: 'Old code path', value: 'removed' },
            { text: 'Sync to old DB', value: 'stopped' },
            { text: 'Old tables', value: 'archived' },
            { text: 'Facade rule', value: 'simplified' },
          ],
        },
        caption: 'One slice fully moved. Repeat for the next one',
      },
    },
    {
      title: 'Costs',
      tag: 'tradeoff',
      heading: 'The strangler fig has real costs',
      eli5: 'Growing a new shop room by room takes longer than the builder promised, and the hardest room is always left for last.',
      body: [
        'Migrations by slice take longer on the calendar than the plan for a rewrite claims. The facade and sync jobs are extra moving parts, and the hardest slices (the tangled core) are always left for last.',
        'Many migrations stall at 80% and live with two systems for years. Budget for the last 20%, where most of the work lives.',
      ],
      keyIdea: 'Budget for the last 20%, which is where most of the work and most of the stalls live.',
      metrics: { share: '80% done', blast: 'one slice', systems: '2 + facade', diff: '-' },
      metricTones: { systems: 'warn' },
      scene: {
        nodes: [{ ...facade, status: 'active' }, { ...legacy, status: 'hot', load: 70, badge: 'tangled core' }, { ...orders, status: 'ok' }],
        links: [link('facade', 'legacy'), link('facade', 'orders')],
        panel: {
          title: 'Where the time goes',
          icon: 'Clock',
          rows: [
            { text: 'First 80% of slices', value: 'a year', tone: 'good' },
            { text: 'Last 20%, tangled core', value: 'another year or stalls', tone: 'bad' },
            { text: 'Extra parts: facade, sync, ACL', value: 'run until the end', tone: 'warn' },
          ],
        },
        caption: 'The hardest part is left for last',
      },
    },
    {
      title: 'When not to',
      tag: 'tradeoff',
      heading: 'When a big-bang switch is still the right call',
      eli5: 'If the shop is a tiny kiosk, just close for an hour and move it. A greeter and a translator would cost more than the move.',
      body: [
        'A big-bang switch can be right when the system is small, the data is easy to copy, and a planned hour of downtime is acceptable.',
        'Strangling pays off when the system is large, must stay up, and keeps changing during the move.',
      ],
      keyIdea: 'Strangle large, live, changing systems. Switch small, easy ones in one planned window.',
      metrics: { share: '-', blast: 'depends', systems: '-', diff: '-' },
      scene: {
        nodes: [{ ...legacy, status: 'active', sub: 'small internal tool' }, { ...rewrite, status: 'ok', sub: 'one planned hour', badge: 'big bang is fine' }, { ...users, label: 'staff only' }],
        links: [link('users', 'legacy'), link('users', 'rewrite', { style: 'faint' })],
        panel: {
          title: 'Which approach',
          icon: 'Scale',
          rows: [
            { text: 'Small, easy data, downtime ok', value: 'big bang', tone: 'good' },
            { text: 'Large, always on, still changing', value: 'strangle', tone: 'good' },
            { text: 'Tangled with no seams', value: 'branch by abstraction first', tone: 'warn' },
          ],
        },
        caption: 'Match the method to the system',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Replace the system one slice at a time',
      eli5: 'Put a greeter at the door, open new counters one at a time, translate the old codes, copy the order book, check the cakes match, then take out the old counter.',
      body: [
        'A big-bang rewrite stores all value and all risk for one day. The **strangler fig** puts a **facade** in front of the old system and moves one slice at a time, each one small enough to roll back with a config line.',
        'An **anti-corruption layer** keeps the old model out of the new code. Data moves with CDC, a throttled **backfill** and reconciliation. **Shadow traffic** finds hidden rules. Cut over in steps, then delete the old path.',
      ],
      keyIdea: 'Every step of a good migration is small, observable and reversible, and the last step is deleting what you replaced.',
      metrics: { share: '100% of /orders', blast: 'one slice', systems: '1 + facade (this slice)', diff: '0' },
      metricTones: { share: 'good', diff: 'good' },
      scene: {
        nodes: [users, { ...facade, status: 'ok' }, legacy, { ...orders, status: 'ok' }, { ...acl, size: 0.7 }],
        links: [link('users', 'facade'), link('facade', 'legacy'), link('facade', 'orders'), link('orders', 'acl', { style: 'faint' })],
        flows: [
          { path: ['users', 'facade', 'orders'], tone: 'request', label: '/orders', duration: 1.6 },
          { path: ['users', 'facade', 'legacy'], tone: 'request', label: 'everything else', duration: 1.6, delay: 0.4 },
        ],
      },
      quiz: {
        question: 'The new orders service shows totals that differ from the monolith on 0.4% of shadowed requests. What should the team do?',
        options: [
          'Cut over to 100% anyway, since 99.6% match',
          'Find the cause of each mismatch type, fix or accept it explicitly, and keep shadowing until the rate is near zero',
          'Turn off the comparator, because shadow traffic doubles load',
          'Switch to dual writes',
        ],
        answer: 1,
        explain: 'Mismatches usually point to business rules nobody wrote down. Shadow traffic exists to find them while customers still get the old answer, so explain each one before moving real traffic.',
      },
    },
  ],
};
