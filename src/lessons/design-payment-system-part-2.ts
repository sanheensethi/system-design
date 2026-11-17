import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const buyer: SceneNode = { id: 'buyer', kind: 'phone', at: at(-5.4, 0), label: 'buyer', sub: 'checkout page' };
const pay: SceneNode = { id: 'pay', kind: 'block', at: at(-1.8, 0), label: 'payment svc', sub: 'our code', icon: 'Receipt', tint: 'violet' };
const psp: SceneNode = { id: 'psp', kind: 'block', at: at(1.8, 0), label: 'PSP', sub: 'card processor', icon: 'ArrowLeftRight', tint: 'amber' };
const ledger: SceneNode = { id: 'ledger', kind: 'db', at: at(5.4, 0), label: 'ledger', sub: 'immutable rows' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

export const designPaymentSystemPart2: Lesson = {
  id: 'design-payment-system-part-2',
  title: 'Design a payment system (part 2)',
  tagline: 'A ledger that always balances, reconciliation against the PSP, and a design that survives a slow PSP and a dead database.',
  minutes: 18,
  level: 'Advanced',
  learn: [
    'A double-entry ledger, refunds as reversing entries and chargebacks',
    'Seller pay-outs and nightly reconciliation against the PSP',
    'What breaks first: a slow PSP, and how a queue, a circuit breaker and a second PSP fix it',
    'Sharding at 10x scale, and keeping the order service in sync with an outbox',
    'Database failover without losing a committed payment, fraud checks and the audit trail',
  ],
  metrics: [
    { key: 'tps', label: 'Peak payments', icon: 'Gauge' },
    { key: 'p99', label: 'Pay p99', icon: 'Timer' },
    { key: 'dup', label: 'Double charges', icon: 'Bug' },
    { key: 'data', label: 'Data per year', icon: 'Database' },
  ],
  steps: [
    {
      title: 'Ledger',
      tag: 'concept',
      heading: 'A ledger records every cent twice, and it must sum to zero',
      eli5: 'The ticket booth keeps one big notebook. Each time coins move, the clerk writes two lines: where the coins left and where they arrived. The two lines always cancel out.',
      body: [
        'A **double-entry ledger** writes each movement as rows that sum to zero. Our 50.00 payment debits `psp_clearing`, the money held at the PSP, by 50.00 and credits `seller_payable` 47.50 and `fee_revenue` 2.50. A debit is positive, a credit negative.',
        'Rows are insert only and a balance is the sum of its rows. A deferred constraint trigger checks `SUM(amount) = 0` per `tx_id` at commit, so an unbalanced write fails.',
      ],
      keyIdea: 'Money is never created or destroyed in a ledger. Every movement has a source, a destination and a sum of zero.',
      metrics: { tps: '1,200/s', p99: '2.5 s', dup: '0', data: '7 TB' },
      metricTones: { dup: 'good' },
      scene: {
        nodes: [
          { ...pay, at: at(-5.4, 0) },
          { ...ledger, at: at(-1.2, 0), status: 'active', badge: 'sum = 0' },
          { id: 'acct', kind: 'block', size: 0.72, at: at(3.4, -3.4), label: 'seller 47.50', icon: 'User', tint: 'green' },
          { id: 'fee', kind: 'block', size: 0.72, at: at(3.4, 3.4), label: 'fee 2.50', icon: 'Receipt', tint: 'amber' },
        ],
        links: [link('pay', 'ledger', { label: 'one transaction' }), link('ledger', 'acct'), link('ledger', 'fee')],
        flows: [{ path: ['pay', 'ledger', 'acct'], tone: 'data', label: '50.00', duration: 2.4 }, { path: ['ledger', 'fee'], tone: 'data', delay: 1.4, duration: 1.6 }],
        panel: {
          title: 'One payment, three rows',
          icon: 'Table',
          rows: [
            { text: 'psp_clearing (debit)', value: '+50.00', tone: 'good' },
            { text: 'seller_payable (credit)', value: '-47.50', tone: 'bad' },
            { text: 'fee_revenue (credit)', value: '-2.50', tone: 'bad' },
            { text: 'Sum of the rows', value: '0.00', tone: 'default' },
          ],
          footer: { text: 'A balance is the sum of rows', tone: 'muted' },
        },
        caption: 'Every movement has a source and a destination',
      },
      code: {
        language: 'sql',
        title: 'Ledger entries',
        source: `CREATE TABLE ledger_entries (
  id          BIGSERIAL PRIMARY KEY,
  tx_id       TEXT   NOT NULL,       -- groups the rows of one movement
  account_id  TEXT   NOT NULL,
  amount      BIGINT NOT NULL,       -- signed, minor units
  currency    CHAR(3) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);
-- invariant: SUM(amount) = 0 for every tx_id
-- enforced by a deferred constraint trigger that checks it at COMMIT`,
        highlight: [3, 5, 9],
      },
    },
    {
      title: 'Refunds',
      tag: 'case',
      heading: 'A refund adds rows. It never edits the old ones',
      eli5: 'If a customer returns a ticket, the clerk does not erase the page. They write a new line that gives the coins back, so anyone reading the notebook sees the whole story.',
      body: [
        'A refund inserts a **reversing** transaction: `psp_clearing` -50.00, `seller_payable` +47.50, `fee_revenue` +2.50. The original rows stay untouched. Total refunds must never exceed the payment.',
        'If the seller was already paid out, their balance goes negative and is deducted from the next pay-out. A **chargeback** has the same shape, forced by the bank, plus a fee. The PSP refund call has its own idempotency key.',
      ],
      keyIdea: 'History is append only. A correction is a new transaction that cancels the old one.',
      metrics: { tps: '1,200/s', p99: '2.5 s', dup: '0', data: '7 TB' },
      scene: {
        nodes: [
          { ...buyer, at: at(-5.4, 0), status: 'ok', chips: [{ text: '+50.00 back', tone: 'good' }] },
          { ...pay, at: at(-1.8, 0), chips: ['refund pay_91'] },
          { ...psp, at: at(1.8, 0), chips: [{ text: 'refund key rf_5', tone: 'good' }] },
          { ...ledger, at: at(5.4, 0), badge: 'reversal rows' },
        ],
        links: [link('pay', 'buyer'), link('pay', 'psp'), link('pay', 'ledger', { style: 'faint' })],
        flows: [
          { path: ['pay', 'ledger'], tone: 'data', label: 'reversal', duration: 2 },
          { path: ['pay', 'psp'], tone: 'request', label: 'refund 50.00', duration: 1.6, delay: 0.5 },
          { path: ['psp', 'buyer'], tone: 'response', label: 'money back', duration: 2.4, delay: 2.2 },
        ],
        panel: {
          title: 'Refund of pay_91',
          icon: 'Repeat',
          rows: [
            { text: 'psp_clearing', value: '-50.00', tone: 'good' },
            { text: 'seller_payable', value: '+47.50', tone: 'bad' },
            { text: 'fee_revenue', value: '+2.50', tone: 'bad' },
            { text: 'Refund total', value: 'at most the payment', tone: 'warn' },
            { text: 'Seller already paid', value: 'negative, deducted next', tone: 'warn' },
            { text: 'Original 3 rows', value: 'unchanged', tone: 'muted' },
          ],
        },
        caption: 'A refund is a new transaction',
      },
    },
    {
      title: 'Pay-outs',
      tag: 'concept',
      heading: 'Pay-outs run as a weekly batch off the ledger',
      eli5: 'On Friday the clerk reads the notebook, adds up what each stall owner earned, and hands each one a single envelope. Each envelope gets a number so it is never handed out twice.',
      body: [
        'A **pay-out job** sums each seller\'s payable balance from the ledger, skips anyone below a minimum such as 10.00, and holds new sellers for a few days. Then it sends one bank transfer per seller through the PSP.',
        'Each transfer gets an idempotency key from `seller + period`, so a rerun after a crash cannot pay twice. The ledger moves the money from payable to `paid out` only when the bank confirms. The background jobs lesson covers batch runners.',
      ],
      keyIdea: 'A pay-out is a batch job that reads the ledger and is safe to rerun, because every transfer has a deterministic key.',
      metrics: { tps: '1,200/s', p99: '2.5 s', dup: '0', data: '7 TB' },
      scene: {
        nodes: [
          { ...ledger, at: at(-5.4, 0), badge: 'seller balances' },
          { id: 'job', kind: 'worker', at: at(-1.8, 0), label: 'payout job', sub: 'Friday 02:00', status: 'active' },
          { ...psp, at: at(1.8, 0), label: 'PSP', chips: [{ text: 'key: s42-2026-w46', tone: 'good' }] },
          { id: 'seller', kind: 'user', at: at(5.4, 0), label: 'seller', sub: 'bank account' },
        ],
        links: [link('ledger', 'job'), link('job', 'psp'), link('psp', 'seller', { label: 'bank transfer' })],
        flows: [
          { path: ['ledger', 'job'], tone: 'data', label: 'balances', duration: 1.6 },
          { path: ['job', 'psp', 'seller'], tone: 'request', label: '47.50', duration: 2.4, delay: 1.7 },
        ],
        panel: {
          title: 'Rules before sending',
          icon: 'List',
          rows: [
            { text: 'Balance at least 10.00', value: 'send', tone: 'good' },
            { text: 'Under 10.00', value: 'carry over', tone: 'muted' },
            { text: 'New seller', value: 'hold 3 days', tone: 'warn' },
            { text: 'Key = seller + week', value: 'rerun safe', tone: 'good' },
          ],
        },
        caption: 'One transfer per seller, safe to rerun',
      },
    },
    {
      title: 'Reconciliation',
      tag: 'concept',
      heading: 'Every night, compare our books to the PSP\'s',
      eli5: 'Each night the clerk and the bank teller put their two notebooks side by side and check every line matches. Any line that differs gets a red circle and a person looks at it.',
      body: [
        'Our ledger and the PSP\'s settlement file should agree. A nightly **reconciliation** job matches them by PSP reference. Differences fall into three groups: in our books only, in theirs only, or both with different amounts.',
        'Most are timing or a lost webhook, and the job repairs those. The rest become tickets for a person. Reconciliation is the last line of defense, because it catches bugs nothing else saw.',
      ],
      keyIdea: 'Do not trust only your own records. Compare them to the outside world every day and chase each difference.',
      metrics: { tps: '1,200/s', p99: '2.5 s', dup: '0', data: '7 TB' },
      scene: {
        nodes: [
          { ...ledger, at: at(-5.4, 0), status: 'ok', badge: '10.0M rows' },
          { id: 'recon', kind: 'worker', at: at(-1.2, 0), label: 'reconciler', sub: 'nightly', status: 'active' },
          { id: 'file', kind: 'storage', at: at(3.4, -4), label: 'PSP file', sub: 'settlement report' },
          { id: 'ops', kind: 'monitor', at: at(3.4, 4), label: 'ops queue', sub: 'for a human', status: 'hot', badge: '14 open' },
        ],
        links: [link('ledger', 'recon'), link('file', 'recon'), link('recon', 'ops', { label: 'mismatches' })],
        flows: [
          { path: ['ledger', 'recon'], tone: 'data', duration: 1.6 },
          { path: ['file', 'recon'], tone: 'data', duration: 1.6, delay: 0.3 },
          { path: ['recon', 'ops'], tone: 'error', label: '14 differ', duration: 1.6, delay: 2 },
        ],
        panel: {
          title: 'Last night',
          icon: 'Scale',
          rows: [
            { text: 'Matched', value: '9,999,986', tone: 'good' },
            { text: 'Ours only', value: '6', tone: 'warn' },
            { text: 'PSP only', value: '5', tone: 'warn' },
            { text: 'Amount differs', value: '3', tone: 'bad' },
          ],
          footer: { text: 'Auto-repair the timing ones, ticket the rest', tone: 'muted' },
        },
        caption: 'Two books, one truth',
      },
    },
    {
      title: 'Slow PSP',
      tag: 'case',
      heading: 'When the PSP gets slow, we get slow too',
      eli5: 'The bank teller suddenly takes a minute per customer. The booth clerk stands waiting at the window, and soon the whole line of buyers behind the clerk is stuck.',
      body: [
        'The PSP slows from 1.5 seconds to 4, still under our 5 second timeout. By Little\'s law, threads held = rate x time: 1,200/s x 4 s = **4,800 threads**, against 1,800 before. Our pool saturates, payments queue up and p99 passes the 3 second target.',
        'Past 5 seconds, calls hit the timeout and flood the unknown-result path. A synchronous call to a slow dependency turns its trouble into ours.',
      ],
      keyIdea: 'A synchronous dependency lends us its latency. When it slows, our threads are held and our service fails with it.',
      metrics: { tps: '1,200/s', p99: '4.5 s', dup: '0', data: '7 TB' },
      metricTones: { p99: 'bad' },
      scene: {
        nodes: [
          { ...buyer, chips: [{ text: 'spinner 4.5 s', tone: 'warn' }] },
          { ...pay, status: 'hot', load: 97, badge: 'threads exhausted' },
          { ...psp, status: 'hot', chips: [{ text: '4 s per call', tone: 'bad' }] },
        ],
        links: [link('buyer', 'pay'), link('pay', 'psp', { label: '4 s per call', labelTone: 'bad' })],
        flows: [
          { path: ['buyer', 'pay', 'psp'], tone: 'request', count: 3, label: 'charge', duration: 2 },
          { path: ['psp', 'pay'], tone: 'error', label: 'slow', duration: 2, delay: 2.1 },
        ],
        panel: {
          title: 'The pile-up',
          icon: 'Timer',
          rows: [
            { text: 'PSP latency', value: '1.5 s to 4 s', tone: 'bad' },
            { text: 'Threads in use', value: '100%', tone: 'bad' },
            { text: 'Threads held', value: '1,200/s x 4 s = 4,800', tone: 'bad' },
            { text: 'Pay p99', value: '4.5 s', tone: 'bad' },
            { text: 'Our own CPU', value: 'idle, waiting', tone: 'muted' },
          ],
          footer: { text: 'We need a buffer between us and the PSP', tone: 'warn' },
        },
        caption: 'Their slowness becomes our outage',
      },
    },
    {
      title: 'Queue the call',
      tag: 'concept',
      heading: 'Accept the payment fast, call the PSP from a queue',
      eli5: 'The clerk takes the buyer\'s coins, writes a ticket "being processed" and drops it in a tray. Helpers carry tickets to the bank one by one. The buyer is told "we got it" right away.',
      body: [
        'The API validates, then writes the order as `pending`, the key row and an **outbox** row in one transaction, and answers `202 Accepted` in about 100 ms. A relay puts the charge job on the queue, and a sweeper re-queues anything stuck in `pending`.',
        '**Workers** pull jobs and call the PSP at a rate it can take. A slow PSP now grows the queue instead of exhausting threads. Alert on **queue age**.',
      ],
      keyIdea: 'A queue absorbs the PSP\'s slowness. The buyer waits for a status, and our API stays fast.',
      metrics: { tps: '1,200/s', p99: '100 ms accept', dup: '0', data: '7 TB' },
      metricTones: { p99: 'good' },
      scene: {
        nodes: [
          { ...pay, at: at(-5.4, 0), status: 'ok', load: 35, chips: [{ text: '202 Accepted', tone: 'good' }] },
          { id: 'q', kind: 'queue', at: at(-1.8, 0), label: 'charge queue', sub: 'durable', badge: 'age 4 s' },
          { id: 'w', kind: 'worker', at: at(1.8, 0), label: 'PSP workers', sub: '40 workers, 50 calls each', status: 'active' },
          { ...psp, at: at(5.4, 0), status: 'hot', chips: [{ text: 'slow, but isolated', tone: 'warn' }] },
        ],
        links: [link('pay', 'q'), link('q', 'w'), link('w', 'psp')],
        flows: [
          { path: ['pay', 'q'], tone: 'event', label: 'charge job', duration: 1.4 },
          { path: ['q', 'w', 'psp'], tone: 'request', label: 'charge', duration: 2, delay: 1.5 },
        ],
        panel: {
          title: 'What changes',
          icon: 'Inbox',
          rows: [
            { text: 'Buyer wait for reply', value: '100 ms accept', tone: 'good' },
            { text: 'Final result', value: 'webhook or push' },
            { text: 'PSP slow', value: 'queue grows', tone: 'warn' },
            { text: 'Alert on', value: 'queue age', tone: 'good' },
          ],
        },
        caption: 'The queue is the shock absorber',
      },
    },
    {
      title: 'Second PSP',
      tag: 'tradeoff',
      heading: 'A circuit breaker and a second PSP',
      eli5: 'If the first bank window is closed, the clerk stops sending helpers there and uses the second window. Every so often they peek at the first one to see if it is open again.',
      body: [
        'A **circuit breaker** watches PSP errors and timeouts. Past a threshold it opens and routes new payments to a **second PSP**, then probes the first after a cool-down. The cost is two contracts, two tokens per card and two settlement files.',
        'Failover to B is allowed only when A clearly did not take the charge, such as connection refused or breaker open before sending. After an unknown timeout on A, A\'s key does not cover B. Look the payment up by key at A, resolve it, and only then charge B.',
      ],
      keyIdea: 'Do not depend on one PSP. Fail over automatically, and record which PSP owns each payment.',
      metrics: { tps: '1,200/s', p99: '2.6 s', dup: '0', data: '7 TB' },
      metricTones: { p99: 'good' },
      scene: {
        nodes: [
          { id: 'w', kind: 'worker', at: at(-5.4, 0), label: 'PSP workers', sub: 'with breaker', status: 'active' },
          { id: 'br', kind: 'limiter', at: at(-1.2, 0), label: 'breaker', sub: 'A is open', status: 'active', badge: 'open' },
          { ...psp, id: 'pspa', at: at(3.4, -3.2), label: 'PSP A', status: 'down' },
          { ...psp, id: 'pspb', at: at(3.4, 3.2), label: 'PSP B', sub: 'standby', status: 'ok', tint: 'teal' },
        ],
        links: [link('w', 'br'), link('br', 'pspa', { style: 'dashed' }), link('br', 'pspb')],
        flows: [
          { path: ['w', 'br', 'pspb'], tone: 'request', label: 'charge', duration: 2.2 },
          { path: ['pspb', 'br', 'w'], tone: 'response', label: 'ok', duration: 2.2, delay: 2.3 },
        ],
        panel: {
          title: 'Routing rules',
          icon: 'Route',
          rows: [
            { text: 'Error rate on A over 20%', value: 'open breaker', tone: 'bad' },
            { text: 'New payments', value: 'go to B', tone: 'good' },
            { text: 'After 30 s', value: 'probe A', tone: 'warn' },
            { text: 'A timed out, unknown', value: 'ask A first, never go straight to B', tone: 'bad' },
            { text: 'psp column on each payment', value: 'who owns it' },
          ],
        },
        caption: 'Stop calling the sick PSP',
      },
      quiz: {
        question: 'The PSP gets slow and our synchronous payment service starts timing out. Which change helps most?',
        options: [
          'Add more payment servers so more threads wait on the PSP',
          'Put a durable queue and workers between the API and the PSP, with a circuit breaker',
          'Retry every timed out call immediately',
          'Lower the PSP timeout to 100 ms',
        ],
        answer: 1,
        explain: 'More threads only wait longer, and blind retries add load. A queue keeps our API fast and lets the backlog grow safely, and the breaker stops calls to a sick PSP so traffic can use a healthy one.',
      },
    },
    {
      title: 'Sharding',
      tag: 'concept',
      heading: 'At 10x traffic, shard the payments database',
      eli5: 'The fair grows ten times bigger, so one notebook is too heavy. The clerks split it by ticket number: notebook A holds some numbers, notebook B others, and every ticket lives in exactly one.',
      body: [
        'At 10x we reach **12,000 payments a second** and 70 TB a year, too much for one primary. We **shard** by hash. The shard comes from the hash of the idempotency key, which exists before any order, and `order_id` is generated up front to carry it. A payment and its ledger rows live on one shard.',
        'Status reads go to **replicas**. A seller\'s rows spread across shards, so pay-outs read a per-seller ledger projection. Reports run on the warehouse.',
      ],
      keyIdea: 'Shard by the key a write touches, so each payment stays on one shard and remains a local transaction.',
      metrics: { tps: '12,000/s', p99: '2.6 s', dup: '0', data: '70 TB' },
      metricTones: { tps: 'warn' },
      scene: {
        nodes: [
          { ...pay, at: at(-5.4, -1.5), label: 'payment svc', sub: 'hash(idempotency key)', load: 55 },
          { id: 's1', kind: 'shard', at: at(-1.8, 3.8), label: 'shard 1', sub: 'hash 0-3', chips: ['4,000/s'] },
          { id: 's2', kind: 'shard', at: at(1.8, 3.8), label: 'shard 2', sub: 'hash 4-7', chips: ['4,000/s'] },
          { id: 's3', kind: 'shard', at: at(5.4, 3.8), label: 'shard 3', sub: 'hash 8-11', chips: ['4,000/s'] },
        ],
        links: [link('pay', 's1'), link('pay', 's2'), link('pay', 's3')],
        flows: [
          { path: ['pay', 's1'], tone: 'request', label: 'pay_17', duration: 1.8 },
          { path: ['pay', 's2'], tone: 'request', label: 'pay_91', duration: 1.8, delay: 0.3 },
          { path: ['pay', 's3'], tone: 'request', label: 'pay_55', duration: 1.8, delay: 0.6 },
        ],
        panel: {
          title: 'After 10x growth',
          icon: 'Split',
          rows: [
            { text: 'Peak load', value: '12,000/s', tone: 'warn' },
            { text: 'Per shard', value: '4,000/s', tone: 'good' },
            { text: 'One payment', value: 'one shard', tone: 'good' },
            { text: 'Seller balance', value: 'per-seller projection' },
            { text: 'Reports', value: 'warehouse', tone: 'muted' },
          ],
          footer: { text: 'Local transactions stay local', tone: 'good' },
        },
        caption: 'Split by order, not by table',
      },
    },
    {
      title: 'Order sync',
      tag: 'concept',
      heading: 'Tell the order service with an outbox, not a second write',
      eli5: 'When a ticket is paid, the clerk must also tell the ride operator. So the clerk writes "tell the operator" on the same page as "paid", and a runner delivers the note until the operator signs for it.',
      body: [
        'After a payment succeeds, the order service must hear about it. If we update our row and then call it, a crash between the two loses the news. So we write an **outbox** row in the same transaction as the status change.',
        'A relay reads the outbox and publishes `payment.succeeded` to a queue, retrying until it is acknowledged. The order service dedupes by event id. The distributed transactions lesson explains why this beats a two-phase commit.',
      ],
      keyIdea: 'Write the event in the same transaction as the state change, then deliver it at least once and dedupe on receipt.',
      metrics: { tps: '12,000/s', p99: '2.6 s', dup: '0', data: '70 TB' },
      scene: {
        nodes: [
          { ...pay, at: at(-5.4, 0) },
          { id: 'shard', kind: 'shard', at: at(-1.2, 0), label: 'shard', sub: 'payment + outbox', status: 'active', chips: ['1 transaction'] },
          { id: 'q', kind: 'queue', at: at(3.4, -4), label: 'events', sub: 'payment.succeeded' },
          { id: 'orders', kind: 'block', size: 0.85, at: at(3.4, 4), label: 'order service', icon: 'ShoppingBag', tint: 'green' },
        ],
        links: [link('pay', 'shard'), link('shard', 'q', { label: 'relay reads outbox' }), link('q', 'orders')],
        flows: [
          { path: ['pay', 'shard'], tone: 'request', label: 'status + outbox', duration: 1.6 },
          { path: ['shard', 'q', 'orders'], tone: 'event', label: 'payment.succeeded', duration: 2.6, delay: 1.7 },
        ],
        panel: {
          title: 'Why not call it directly',
          icon: 'Workflow',
          rows: [
            { text: 'Update, then crash, then call', value: 'news lost', tone: 'bad' },
            { text: 'Outbox in same transaction', value: 'never lost', tone: 'good' },
            { text: 'Delivery', value: 'at least once' },
            { text: 'Order service', value: 'dedupes by id', tone: 'good' },
          ],
        },
        caption: 'The event commits with the state',
      },
    },
    {
      title: 'Database dies',
      tag: 'case',
      heading: 'The primary fails in the middle of a payment',
      eli5: 'The notebook for ticket numbers 1 to 100 falls in a puddle. A second clerk has been copying every line as it was written, so work carries on from the copy and no line is lost.',
      body: [
        'Each shard has a primary and a **synchronous replica** in another zone. A commit returns only after both have the row, so a payment we confirmed is on two disks. Fail-over promotes the replica in about 30 seconds.',
        'Payments in flight see a failed write and retry with the same key. The key row is on the replica, so a repeat gets the right answer. Synchronous copies cost a few milliseconds of latency, which is worth it for money. See the replication and failover lessons.',
      ],
      keyIdea: 'For money, commit only after two copies exist. A failover then loses nothing that was confirmed.',
      metrics: { tps: '12,000/s', p99: '2.9 s', dup: '0', data: '70 TB' },
      metricTones: { p99: 'warn', dup: 'good' },
      scene: {
        nodes: [
          { ...pay, at: at(-5.4, 0) },
          { id: 'p', kind: 'shard', at: at(-1.2, -4), label: 'primary', sub: 'zone A', status: 'down' },
          { id: 'r', kind: 'replica', at: at(-1.2, 4), label: 'sync replica', sub: 'zone B', status: 'ok', badge: 'promoted' },
          { id: 'mon', kind: 'monitor', at: at(3.4, 0), label: 'failover', sub: 'health checks', status: 'active' },
        ],
        links: [link('pay', 'p', { style: 'dashed' }), link('pay', 'r'), link('p', 'r', { style: 'dashed', label: 'sync copy' }), link('mon', 'r')],
        flows: [
          { path: ['mon', 'r'], tone: 'handshake', label: 'promote', duration: 1.6 },
          { path: ['pay', 'r'], tone: 'request', label: 'retry, same key', duration: 1.8, delay: 1.7 },
        ],
        panel: {
          title: 'Fail-over timeline',
          icon: 'Clock',
          rows: [
            { text: '0 s', value: 'primary dies', tone: 'bad' },
            { text: '10 s', value: 'health check fails', tone: 'warn' },
            { text: '30 s', value: 'replica promoted', tone: 'good' },
            { text: 'Confirmed payments lost', value: '0', tone: 'good' },
          ],
          footer: { text: 'Retries with the key land safely', tone: 'good' },
        },
        caption: 'Two disks before we say yes',
      },
    },
    {
      title: 'Fraud checks',
      tag: 'concept',
      heading: 'Screen each payment before the PSP sees it',
      eli5: 'Before the clerk takes the coins, a guard glances at the buyer. Ten tickets in one minute from one pocket looks odd, so the guard asks for extra proof or says no.',
      body: [
        'A **risk service** scores each payment on speed, amount, device and history, in about 50 ms. Low risk passes. Medium risk asks for **3-D Secure**, a bank check by the buyer. High risk is blocked, with a reason logged.',
        'A rate limiter caps attempts per buyer and card, which also stops card testing. The service must be fast and fail open or closed by policy: for a small amount we let it through, for a large one we hold it. The rate limiting lesson has the algorithms.',
      ],
      keyIdea: 'Score before charging. Cheap checks first, stronger proof only for the risky few.',
      metrics: { tps: '12,000/s', p99: '2.7 s', dup: '0', data: '70 TB' },
      scene: {
        nodes: [
          { ...pay, at: at(-5.4, 0) },
          { id: 'risk', kind: 'limiter', at: at(-1.2, 0), label: 'risk service', sub: 'score in 50 ms', status: 'active', chips: [{ text: 'score 18: pass', tone: 'good' }] },
          { id: 'q', kind: 'queue', at: at(3.4, -4), label: 'charge queue' },
          { id: 'review', kind: 'monitor', at: at(3.4, 4), label: 'review', sub: 'block or 3-D Secure', status: 'hot', badge: 'score 85' },
        ],
        links: [link('pay', 'risk'), link('risk', 'q', { label: 'low risk' }), link('risk', 'review', { label: 'high risk' })],
        flows: [
          { path: ['pay', 'risk', 'q'], tone: 'request', label: 'score 18', duration: 2.2 },
          { path: ['risk', 'review'], tone: 'error', label: 'score 85', duration: 1.6, delay: 2.3 },
        ],
        panel: {
          title: 'Decision by score',
          icon: 'Shield',
          rows: [
            { text: 'Under 40', value: 'charge', tone: 'good' },
            { text: '40 to 70', value: '3-D Secure', tone: 'warn' },
            { text: 'Over 70', value: 'block, log reason', tone: 'bad' },
            { text: 'Over 5 tries a minute', value: 'rate limit', tone: 'warn' },
          ],
        },
        caption: 'A guard before the booth',
      },
    },
    {
      title: 'Secrets',
      tag: 'concept',
      heading: 'Keys live in a vault, never in code',
      eli5: 'The clerk keeps the strongbox key in a locked cabinet. Only a few people may open it, and the key gets swapped now and then.',
      body: [
        'PSP API keys and webhook secrets live in a **vault**, are rotated on a schedule, and are never in code or logs. The service fetches a key when it needs one.',
        'All traffic uses TLS and sensitive columns are encrypted. The encryption lesson covers keys and envelopes.',
      ],
      keyIdea: 'A secret in code or logs is a leaked secret. Keep it in a vault and rotate it.',
      metrics: { tps: '12,000/s', p99: '2.7 s', dup: '0', data: '70 TB' },
      scene: {
        nodes: [
          { ...pay, at: at(-3.6, 0), chips: [{ text: 'no secrets in logs', tone: 'good' }] },
          { id: 'vault', kind: 'vault', at: at(1.8, 0), label: 'secrets vault', sub: 'PSP keys, rotated', status: 'ok' },
        ],
        links: [link('pay', 'vault', { label: 'fetch key' })],
        flows: [
          { path: ['pay', 'vault'], tone: 'handshake', label: 'PSP key', duration: 1.6 },
          { path: ['vault', 'pay'], tone: 'response', label: 'short-lived key', duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'Secret handling',
          icon: 'Key',
          rows: [
            { text: 'PSP keys', value: 'vault, rotated', tone: 'good' },
            { text: 'Webhook secrets', value: 'vault', tone: 'good' },
            { text: 'In code or logs', value: 'never', tone: 'bad' },
            { text: 'Traffic', value: 'TLS', tone: 'good' },
          ],
        },
        caption: 'Locked keys, rotated often',
      },
    },
    {
      title: 'Audit trail',
      tag: 'concept',
      heading: 'An audit trail nobody can edit',
      eli5: 'Every time someone touches the notebook, the clerk writes who, what and when in a second book that cannot be torn.',
      body: [
        'Every state change, refund and manual fix writes who, what and when to an append-only **audit log**. Nobody can update or delete a row in it.',
        'Staff access is by role with approvals for money moves. Auditors and regulators ask for exactly this trail.',
      ],
      keyIdea: 'Assume someone will ask who changed what. Make the answer a query, not an investigation.',
      metrics: { tps: '12,000/s', p99: '2.7 s', dup: '0', data: '70 TB' },
      scene: {
        nodes: [
          { ...pay, at: at(-5.4, 0) },
          { id: 'audit', kind: 'storage', at: at(-0.6, -3.6), label: 'audit log', sub: 'append only', badge: 'who, what, when' },
          { id: 'staff', kind: 'user', at: at(-0.6, 3.6), label: 'finance staff', sub: 'role + approval' },
        ],
        links: [link('pay', 'audit'), link('staff', 'audit')],
        flows: [
          { path: ['pay', 'audit'], tone: 'data', label: 'status change', duration: 2 },
          { path: ['staff', 'audit'], tone: 'data', label: 'manual refund', duration: 1.6, delay: 0.8 },
        ],
        panel: {
          title: 'Controls',
          icon: 'Shield',
          rows: [
            { text: 'Every money move', value: 'audit row', tone: 'good' },
            { text: 'Audit rows', value: 'insert only', tone: 'good' },
            { text: 'Staff access', value: 'by role' },
            { text: 'Large manual refund', value: 'two approvers', tone: 'warn' },
          ],
        },
        caption: 'Unedited history',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'The whole payment system on one page',
      eli5: 'The fair now has a numbered stub for every ticket, a notebook that always adds up, helpers carrying tickets to two bank windows, spare notebooks, a guard at the door and a locked cabinet.',
      body: [
        'Part 1 made each payment happen once: an **idempotency key**, a **state machine** and **tokens**. Part 2 added a **double-entry ledger**, **reconciliation**, and a **queue with a breaker and a second PSP**.',
        'At 10x we **shard** by order, keep a **sync replica** per shard, use an **outbox** for events, screen with a **risk service** and keep an **audit log**. A payment is slow to settle and never wrong.',
      ],
      keyIdea: 'Correctness comes from keys, forward-only states, a balanced ledger and daily reconciliation. Scale and failure handling come after.',
      metrics: { tps: '12,000/s', p99: '2.6 s', dup: '0', data: '70 TB' },
      metricTones: { tps: 'good', p99: 'good', dup: 'good' },
      scene: {
        nodes: [
          { ...buyer, at: at(-5.4, 0) },
          { ...pay, at: at(-1.8, 0), chips: ['key + risk'] },
          { id: 'q', kind: 'queue', at: at(1.8, 0), label: 'charge queue', sub: 'workers + breaker' },
          { id: 'shard', kind: 'shard', at: at(5.4, 0), label: 'shards', sub: 'ledger + outbox', status: 'ok' },
        ],
        links: [link('buyer', 'pay'), link('pay', 'q'), link('q', 'shard')],
        flows: [{ path: ['buyer', 'pay', 'q', 'shard'], tone: 'request', duration: 3.2 }],
        panel: {
          title: 'The design in six lines',
          icon: 'List',
          rows: [
            { text: 'Key per intent', value: 'one charge', tone: 'good' },
            { text: 'Forward-only states', value: 'no rollbacks', tone: 'good' },
            { text: 'Double-entry ledger', value: 'sums to 0', tone: 'good' },
            { text: 'Queue + breaker + 2nd PSP', value: 'PSP outage', tone: 'good' },
            { text: 'Shards + sync replicas', value: '12,000/s', tone: 'good' },
            { text: 'Reconciliation + audit', value: 'proof', tone: 'good' },
          ],
        },
        caption: 'Slow to settle, never wrong',
      },
      quiz: {
        question: 'Reconciliation finds a payment in the PSP settlement file that is missing from our ledger. What is the most likely cause, and the right action?',
        options: [
          'The PSP made it up, so ignore it',
          'A lost webhook or a crash before we wrote the result, so look it up by PSP reference and repair it',
          'The ledger is allowed to miss rows, so do nothing',
          'Delete the PSP record to match our books',
        ],
        answer: 1,
        explain: 'A charge that went through while our record never landed is usually a lost webhook or a crash at the wrong moment. We find it by PSP reference, write the missing ledger rows as a new transaction and fix the cause. We never edit or hide history.',
      },
    },
  ],
};
