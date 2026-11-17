import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const buyer: SceneNode = { id: 'buyer', kind: 'phone', at: at(-5.4, 0), label: 'buyer', sub: 'checkout page' };
const pay: SceneNode = { id: 'pay', kind: 'block', at: at(-1.8, 0), label: 'payment svc', sub: 'our code', icon: 'Receipt', tint: 'violet' };
const psp: SceneNode = { id: 'psp', kind: 'block', at: at(1.8, 0), label: 'PSP', sub: 'card processor', icon: 'ArrowLeftRight', tint: 'amber' };
const db: SceneNode = { id: 'db', kind: 'db', at: at(5.4, 0), label: 'payments DB', sub: 'one primary' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

export const designPaymentSystem: Lesson = {
  id: 'design-payment-system',
  title: 'Design a payment system (part 1)',
  tagline: 'Take a card payment once and only once, even when the network drops the reply and the buyer taps twice.',
  minutes: 18,
  level: 'Advanced',
  learn: [
    'Requirements and napkin math: 10 million payments a day is small, getting each one right is hard',
    'Pay-in and pay-out flows, and a payment API with integer money and an idempotency key',
    'A payments table, an event log and a state machine that only moves forward',
    'Hosted card fields and tokens, so card numbers never touch our servers',
    'Timeouts, retries, webhooks and why a retry must never charge twice',
  ],
  metrics: [
    { key: 'tps', label: 'Peak payments', icon: 'Gauge' },
    { key: 'p99', label: 'Pay p99', icon: 'Timer' },
    { key: 'dup', label: 'Double charges', icon: 'Bug' },
    { key: 'data', label: 'Data per year', icon: 'Database' },
  ],
  steps: [
    {
      title: 'Requirements',
      tag: 'problem',
      heading: 'Money that is lost or copied is the one bug you cannot ship',
      eli5: 'At a fairground, you hand coins to the **payment service**, the clerk at the ticket booth. Every coin must end up in the right pocket, once, and the clerk must be able to prove it.',
      body: [
        'A marketplace lets buyers pay by card and pays sellers later. We build the part that moves money: **pay-in** from the buyer, **pay-out** to the seller, and **refunds**. A **payment service provider (PSP)** talks to the card networks for us.',
        'Targets: no payment is charged twice or lost, every cent is traceable, p99 under 3 seconds, 99.99 percent available. Out of scope: card network internals, tax and currency trading.',
      ],
      keyIdea: 'In a payment system correctness beats speed. A slow payment is a bug report. A wrong one is a lawsuit.',
      metrics: { tps: '?', p99: '3 s target', dup: 'must be 0', data: '?' },
      metricTones: { dup: 'warn' },
      scene: {
        nodes: [buyer, { ...pay, status: 'active' }, psp, { ...db, status: 'dim' }],
        links: [link('buyer', 'pay'), link('pay', 'psp'), link('pay', 'db', { style: 'faint' })],
        flows: [
          { path: ['buyer', 'pay', 'psp'], tone: 'request', label: 'pay 50.00', duration: 2 },
          { path: ['psp', 'pay', 'buyer'], tone: 'response', label: 'paid', duration: 2, delay: 2.1 },
        ],
        panel: {
          title: 'What we must guarantee',
          icon: 'List',
          rows: [
            { text: 'Pay-in, pay-out, refund', value: 'in scope' },
            { text: 'Charged twice', value: 'never', tone: 'bad' },
            { text: 'Payment lost', value: 'never', tone: 'bad' },
            { text: 'Every cent traceable', value: 'audit', tone: 'good' },
            { text: 'Availability', value: '99.99%' },
          ],
          footer: { text: 'Card network internals stay out of scope', tone: 'muted' },
        },
        caption: 'Move money once, and be able to prove it',
      },
    },
    {
      title: 'Scale numbers',
      tag: 'concept',
      heading: 'Only 1,200 payments a second at peak',
      eli5: 'Even a busy fair sells maybe a few tickets a second. The hard part at the booth is never counting too fast. It is never getting one single coin wrong.',
      body: [
        'Say 10 million payments a day. That is `10M / 86,400` is about **116 a second** on average. Payments cluster around sales and evenings, so plan for **10x**, about **1,200 a second** at peak. One tuned database can take that.',
        'Each payment leaves about 2 KB across its order row, events and ledger entries: **20 GB a day**, about **7 TB a year**. Latency is mostly the PSP at 1 to 2 seconds. The napkin math lesson has the method.',
      ],
      keyIdea: 'The scale is modest. Money systems spend their effort on correctness, not on raw throughput.',
      metrics: { tps: '1,200/s', p99: '3 s target', dup: 'must be 0', data: '7 TB' },
      metricTones: { tps: 'good', data: 'good' },
      scene: {
        nodes: [
          { id: 'users', kind: 'user', at: at(-5.4, 0), label: 'buyers', sub: '10M payments/day' },
          { ...pay, chips: ['116/s average', { text: '1,200/s peak', tone: 'warn' }] },
          { ...db, chips: ['20 GB/day'], badge: '7 TB/year' },
        ],
        links: [link('users', 'pay'), link('pay', 'db')],
        flows: [{ path: ['users', 'pay', 'db'], tone: 'request', count: 3, duration: 2.2 }],
        panel: {
          title: 'Back of the envelope',
          icon: 'Table',
          rows: [
            { text: 'Payments per day', value: '10M' },
            { text: 'Average rate', value: '116/s' },
            { text: 'Peak (10x)', value: '1,200/s', tone: 'warn' },
            { text: 'Bytes per payment', value: '2 KB' },
            { text: 'Storage per year', value: '7 TB' },
          ],
          footer: { text: 'Hard part: correct, not fast', tone: 'good' },
        },
        caption: 'Small QPS, huge cost per mistake',
      },
    },
    {
      title: 'Two flows',
      tag: 'concept',
      heading: 'Pay-in brings money in, pay-out sends it on',
      eli5: 'A buyer gives coins to the booth. The fair keeps them in a strongbox. Later the clerk hands each stall owner their share of the strongbox.',
      body: [
        '**Pay-in**: the buyer pays, the PSP charges the card and the money lands in our PSP account. **Pay-out**: later we send each seller their share, minus our fee, by bank transfer.',
        'The two flows run on different clocks. Pay-in finishes in seconds and the buyer waits. Pay-out is a batch that settles in days. We design them as separate flows over one shared ledger.',
      ],
      keyIdea: 'Pay-in is interactive and fast. Pay-out is batched and slow. One ledger ties them together.',
      metrics: { tps: '1,200/s', p99: '3 s target', dup: 'must be 0', data: '7 TB' },
      scene: {
        nodes: [
          { ...buyer, at: at(-5.4, 0), label: 'buyer' },
          { id: 'ours', kind: 'block', at: at(-1.8, 0), label: 'our account', sub: 'at the PSP', icon: 'Receipt', tint: 'violet' },
          { id: 'seller', kind: 'user', at: at(5.4, 0), label: 'seller', sub: 'weekly payout' },
          { ...psp, at: at(1.8, 0), label: 'bank rail', sub: 'transfers', tint: 'teal' },
        ],
        links: [link('buyer', 'ours', { label: 'pay-in, seconds' }), link('ours', 'psp'), link('psp', 'seller', { label: 'pay-out, days' })],
        flows: [
          { path: ['buyer', 'ours'], tone: 'request', label: '50.00', duration: 1.6 },
          { path: ['ours', 'psp', 'seller'], tone: 'data', label: '47.50', duration: 2.2, delay: 1.8 },
        ],
        panel: {
          title: 'Same 50.00 payment',
          icon: 'Scale',
          rows: [
            { text: 'Buyer pays', value: '50.00' },
            { text: 'Our fee (5%)', value: '2.50' },
            { text: 'Seller is owed', value: '47.50', tone: 'good' },
            { text: 'Seller paid on', value: 'Friday', tone: 'muted' },
          ],
        },
        caption: 'Two flows, two clocks',
      },
    },
    {
      title: 'Payment API',
      tag: 'concept',
      heading: 'An API with integer money and an idempotency key',
      eli5: 'At the booth you say "one ride, 500 coins" and hold up your own ticket stub number. The stub number lets the clerk spot you if you ask twice.',
      body: [
        '`POST /v1/payments` creates a payment. Amounts are **integers in minor units** (`5000` is 50.00) plus a currency code. Floats cannot hold `0.1` exactly, and rounding errors in money add up.',
        'The client sends an **`Idempotency-Key`** header, a UUID per payment intent. `GET /v1/payments/{id}` reads status. `POST /v1/payments/{id}/refunds` refunds. `POST /v1/payouts` creates a payout. The API design lesson covers versioning and errors.',
      ],
      keyIdea: 'Money is an integer plus a currency. Every write carries a key that makes repeating it safe.',
      metrics: { tps: '1,200/s', p99: '3 s target', dup: 'must be 0', data: '7 TB' },
      scene: {
        nodes: [
          { ...buyer, at: at(-5.4, 0), chips: [{ text: 'Idempotency-Key: 7c1e', tone: 'good' }] },
          { id: 'api', kind: 'block', at: at(-1.2, 0), label: 'payment API', sub: 'REST, v1', icon: 'Network', tint: 'violet' },
          { ...pay, at: at(3.2, 0), label: 'payment svc' },
        ],
        links: [link('buyer', 'api'), link('api', 'pay')],
        flows: [
          { path: ['buyer', 'api', 'pay'], tone: 'request', label: 'POST /v1/payments', duration: 1.8 },
          { path: ['pay', 'api', 'buyer'], tone: 'response', label: '201 pay_91', duration: 1.8, delay: 1.9 },
        ],
        panel: {
          title: 'Endpoints',
          icon: 'List',
          rows: [
            { text: 'POST /v1/payments', value: 'create' },
            { text: 'GET /v1/payments/{id}', value: 'status' },
            { text: 'POST .../{id}/refunds', value: 'refund' },
            { text: 'POST /v1/payouts', value: 'pay-out' },
            { text: 'POST /webhooks/psp', value: 'PSP calls us', tone: 'muted' },
          ],
        },
        caption: 'A small API, every write carries a key',
      },
      code: {
        language: 'json',
        title: 'Create a payment',
        source: `POST /v1/payments
Idempotency-Key: 7c1e5d3a-9f20-4b6e-8a11-2f0c77d41b90

{
  "amount": 5000,
  "currency": "USD",
  "buyer_id": "usr_42",
  "payment_token": "tok_9f2a",
  "order_id": "ord_8841"
}`,
        highlight: [2, 5, 6],
      },
    },
    {
      title: 'Data model',
      tag: 'concept',
      heading: 'Three tables: the order, its events, the ledger',
      eli5: 'The booth keeps a card per customer, a diary of everything that happened to that card, and one big notebook where every coin movement is written down.',
      body: [
        '`payment_orders` holds one row per payment: id, buyer, amount, currency, **status**. `payment_events` is an append-only diary of what happened to it, such as `authorized` or `webhook_received`.',
        '`ledger_entries` records every money movement as immutable rows. Part 2 builds it. Keeping the three apart means a status can change but history never does. The data modeling lesson explains the trade-offs.',
      ],
      keyIdea: 'Status is mutable and cheap. Events and ledger rows are append-only, so they can be trusted later.',
      metrics: { tps: '1,200/s', p99: '3 s target', dup: 'must be 0', data: '7 TB' },
      scene: {
        nodes: [
          { ...pay, at: at(-5.4, 0) },
          { id: 'orders', kind: 'db', at: at(-1.8, 0), label: 'payment_orders', sub: 'status changes', status: 'active' },
          { id: 'events', kind: 'storage', at: at(1.8, 0), label: 'payment_events', sub: 'append only' },
          { id: 'ledger', kind: 'db', at: at(5.4, 0), label: 'ledger_entries', sub: 'immutable', status: 'ok' },
        ],
        links: [link('pay', 'orders'), link('orders', 'events', { label: 'every change' }), link('events', 'ledger', { label: 'money moves' })],
        flows: [{ path: ['pay', 'orders', 'events', 'ledger'], tone: 'data', duration: 3 }],
        panel: {
          title: 'Who may change what',
          icon: 'Table',
          rows: [
            { text: 'payment_orders', value: 'update status', tone: 'warn' },
            { text: 'payment_events', value: 'insert only', tone: 'good' },
            { text: 'ledger_entries', value: 'insert only', tone: 'good' },
          ],
          footer: { text: 'Never edit history, add to it', tone: 'good' },
        },
        caption: 'One mutable row, two append-only logs',
      },
      code: {
        language: 'sql',
        title: 'The order and its events',
        source: `CREATE TABLE payment_orders (
  id           TEXT PRIMARY KEY,
  buyer_id     TEXT NOT NULL,
  amount       BIGINT NOT NULL,      -- minor units
  currency     CHAR(3) NOT NULL,
  status       TEXT NOT NULL,        -- see the state machine
  psp_ref      TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE payment_events (
  id BIGSERIAL PRIMARY KEY, order_id TEXT, type TEXT, at TIMESTAMPTZ DEFAULT now()
);`,
        highlight: [4, 6],
      },
    },
    {
      title: 'Simple design',
      tag: 'concept',
      heading: 'The simple design: save, call the PSP, save again',
      eli5: 'The clerk writes "customer paying" in the book, walks to the bank window with the coins, waits, and then writes "paid".',
      body: [
        'The payment service inserts an order as `pending`, calls the PSP to charge, waits, then updates the order to `succeeded` or `failed` and answers the buyer. Everything runs in one request.',
        'It is easy to build, and for a hobby shop it works. The PSP takes 1 to 2 seconds, and our p99 sits near **2.5 seconds**. Next we find the holes.',
      ],
      keyIdea: 'Write intent first, call the PSP, write the outcome. Each of the three moments can fail on its own.',
      metrics: { tps: '1,200/s', p99: '2.5 s', dup: '?', data: '7 TB' },
      metricTones: { p99: 'good', dup: 'warn' },
      scene: {
        nodes: [buyer, pay, psp, { ...db, status: 'active' }],
        links: [link('buyer', 'pay'), link('pay', 'psp', { label: 'HTTPS · 1 to 2 s' }), link('pay', 'db')],
        flows: [
          { path: ['buyer', 'pay', 'db'], tone: 'request', label: '1: pending', duration: 1.6 },
          { path: ['pay', 'psp'], tone: 'request', label: '2: charge', duration: 1.4, delay: 1.7 },
          { path: ['psp', 'pay', 'db'], tone: 'response', label: '3: succeeded', duration: 1.6, delay: 3.2 },
        ],
        panel: {
          title: 'One request, three writes',
          icon: 'Workflow',
          rows: [
            { text: '1. insert order', value: 'pending' },
            { text: '2. PSP charge', value: '1 to 2 s', tone: 'warn' },
            { text: '3. update order', value: 'succeeded' },
            { text: 'Buyer sees', value: '2.5 s p99', tone: 'good' },
          ],
        },
        caption: 'Intent, call, outcome',
      },
    },
    {
      title: 'Card tokens',
      tag: 'concept',
      heading: 'Card numbers never touch our servers',
      eli5: 'The buyer hands the coins straight to the bank teller through a little window. The booth clerk only gets a numbered receipt, never the coins themselves.',
      body: [
        'The checkout page uses the PSP\'s **hosted fields**: the card number goes from the buyer\'s browser straight to the PSP, which returns a **token** like `tok_9f2a`. Our servers see only the token.',
        'That keeps us out of most **PCI DSS** scope, the card industry security rules. A token is useless to a thief, and it can be tied to one buyer and one merchant. The encryption lesson covers how a vault protects secrets.',
      ],
      keyIdea: 'Never store or log card numbers. Hold the token, let the PSP hold the card.',
      metrics: { tps: '1,200/s', p99: '2.5 s', dup: '?', data: '7 TB' },
      scene: {
        nodes: [
          { ...buyer, chips: [{ text: '4242 4242 ...', tone: 'warn' }] },
          { ...psp, at: at(0, 3.4), label: 'PSP vault', sub: 'holds the card', kind: 'vault', tint: 'amber' },
          { ...pay, at: at(3.8, 0), chips: [{ text: 'tok_9f2a', tone: 'good' }], status: 'ok' },
        ],
        links: [link('buyer', 'psp', { label: 'card to PSP' }), link('buyer', 'pay', { label: 'token only' })],
        flows: [
          { path: ['buyer', 'psp'], tone: 'handshake', label: 'card number', duration: 1.6 },
          { path: ['psp', 'buyer'], tone: 'response', label: 'tok_9f2a', duration: 1.6, delay: 1.7 },
          { path: ['buyer', 'pay'], tone: 'request', label: 'tok_9f2a', duration: 1.6, delay: 3.4 },
        ],
        panel: {
          title: 'What we store',
          icon: 'Shield',
          rows: [
            { text: 'Card number', value: 'never', tone: 'bad' },
            { text: 'CVV', value: 'never', tone: 'bad' },
            { text: 'Token', value: 'yes', tone: 'good' },
            { text: 'Last 4 digits, brand', value: 'yes', tone: 'good' },
          ],
          footer: { text: 'Smaller PCI scope, smaller blast radius', tone: 'good' },
        },
        caption: 'The card goes to the PSP, we keep a token',
      },
    },
    {
      title: 'Lost reply',
      tag: 'case',
      heading: 'The PSP charged the card, then the reply got lost',
      eli5: 'The clerk hands over the coins, the teller keeps them, but the receipt blows away in the wind. The clerk does not know if the coins were taken, so the buyer pays again.',
      body: [
        'Our call to the PSP times out after 5 seconds. Did the charge happen? Maybe. The PSP may have charged and the reply never reached us. We do not know, and neither does the buyer.',
        'The buyer taps **Pay** again, or our code retries. A second charge goes out. Buyer is billed **50.00 twice**. At 1,200 payments a second even a rare timeout turns into daily double charges.',
      ],
      keyIdea: 'A timeout means "unknown", not "failed". Treating it as failed is how people get charged twice.',
      metrics: { tps: '1,200/s', p99: '5 s timeout', dup: '1 in 500', data: '7 TB' },
      metricTones: { dup: 'bad', p99: 'warn' },
      scene: {
        nodes: [
          { ...buyer, chips: [{ text: 'taps Pay again', tone: 'warn' }] },
          { ...pay, status: 'hot' },
          { ...psp, status: 'ok', badge: 'charged 2x', chips: [{ text: '-50.00', tone: 'bad' }, { text: '-50.00', tone: 'bad' }] },
        ],
        links: [link('buyer', 'pay'), link('pay', 'psp', { label: 'timeout after 5 s', labelTone: 'warn' })],
        flows: [
          { path: ['pay', 'psp'], tone: 'request', label: 'charge 50.00', duration: 1.4 },
          { path: ['psp', 'pay'], tone: 'error', label: 'reply lost', duration: 1.4, delay: 1.5 },
          { path: ['buyer', 'pay', 'psp'], tone: 'request', label: 'charge again', duration: 1.8, delay: 3.2 },
        ],
        panel: {
          title: 'What each side knows',
          icon: 'Clock',
          rows: [
            { text: 'PSP', value: 'charged', tone: 'good' },
            { text: 'Our order row', value: 'pending', tone: 'warn' },
            { text: 'Buyer screen', value: 'spinner', tone: 'warn' },
            { text: 'After the retry', value: '2 charges', tone: 'bad' },
          ],
          footer: { text: 'Unknown is not the same as failed', tone: 'bad' },
        },
        caption: 'One timeout, two charges',
      },
    },
    {
      title: 'Idempotency key',
      tag: 'concept',
      heading: 'An idempotency key makes a retry safe',
      eli5: 'Every ticket stub has a number. If you come back with stub 7c1e, the clerk checks the book, sees stub 7c1e already paid, and hands back the same receipt instead of taking coins again.',
      body: [
        'The client makes one UUID per payment intent and sends it with every attempt. We store it with a **unique constraint**. Retry with the same key and we return the saved result. We never charge again.',
        'We also forward the key to the PSP, which dedupes on its side too. If the same key arrives with a different amount, we answer `422`. The distributed transactions lesson shows where idempotency fits among delivery guarantees.',
      ],
      keyIdea: 'Exactly once is at least once delivery plus idempotent handling. The key is what makes handling idempotent.',
      metrics: { tps: '1,200/s', p99: '2.5 s', dup: '0', data: '7 TB' },
      metricTones: { dup: 'good' },
      scene: {
        nodes: [
          { ...buyer, chips: [{ text: 'key: 7c1e (try 2)', tone: 'good' }] },
          { ...pay, status: 'active' },
          { id: 'keys', kind: 'db', at: at(5.4, 3.8), label: 'idempotency_keys', sub: 'unique key', status: 'ok', badge: '7c1e seen' },
          psp,
        ],
        links: [link('buyer', 'pay'), link('pay', 'keys'), link('pay', 'psp', { style: 'faint' })],
        flows: [
          { path: ['buyer', 'pay', 'keys'], tone: 'request', label: 'key 7c1e?', duration: 1.8 },
          { path: ['keys', 'pay', 'buyer'], tone: 'response', label: 'saved: paid', duration: 1.8, delay: 1.9 },
        ],
        panel: {
          title: 'On every request',
          icon: 'Key',
          rows: [
            { text: 'Key is new', value: 'run it, save result', tone: 'good' },
            { text: 'Key seen, finished', value: 'return saved result', tone: 'good' },
            { text: 'Key seen, running', value: '409, try later', tone: 'warn' },
            { text: 'Same key, other body', value: '422', tone: 'bad' },
          ],
          footer: { text: 'The PSP call is skipped on a repeat', tone: 'good' },
        },
        caption: 'Same key, same answer, no second charge',
      },
    },
    {
      title: 'Key in code',
      tag: 'concept',
      heading: 'Claim the key first, then do the work',
      eli5: 'The clerk writes the stub number in the book first. A second person with the same stub is told "still being handled" at once. If the first clerk vanished, a helper later asks the bank and finishes the line.',
      body: [
        'We `INSERT` the key row first with `status = running` and a `locked_at` time. If the insert wins, we run the charge. On a conflict we return the stored result, or `409` while it still runs. Hash the body into the row to catch a reused key.',
        'A crash after the INSERT would leave a row with no response and `409` forever. So the lock is a **lease**: once `locked_at` is old, a retry asks the PSP by key and finishes the row.',
      ],
      keyIdea: 'Let the database decide who owns the key. Two racing requests cannot both win an INSERT.',
      metrics: { tps: '1,200/s', p99: '2.5 s', dup: '0', data: '7 TB' },
      metricTones: { dup: 'good' },
      scene: {
        nodes: [
          { id: 'a', kind: 'phone', at: at(-5.4, -3.4), label: 'attempt A', sub: 'key 7c1e', chips: [{ text: 'INSERT ok', tone: 'good' }] },
          { id: 'b', kind: 'phone', at: at(-5.4, 3.4), label: 'attempt B', sub: 'key 7c1e', chips: [{ text: 'conflict', tone: 'warn' }] },
          { ...pay, at: at(-1.2, 0) },
          { id: 'keys', kind: 'db', at: at(3.2, 0), label: 'idempotency_keys', sub: 'PRIMARY KEY (key)', status: 'active' },
        ],
        links: [link('a', 'pay'), link('b', 'pay'), link('pay', 'keys')],
        flows: [
          { path: ['a', 'pay', 'keys'], tone: 'request', label: 'INSERT', duration: 1.6 },
          { path: ['b', 'pay', 'keys'], tone: 'request', label: 'INSERT', duration: 1.6, delay: 0.3 },
          { path: ['keys', 'pay', 'b'], tone: 'response', label: 'saved result', duration: 1.6, delay: 1.9 },
        ],
        panel: {
          title: 'Two racing attempts',
          icon: 'Scale',
          rows: [
            { text: 'Attempt A inserts key', value: 'owner', tone: 'good' },
            { text: 'Attempt B inserts key', value: 'conflict', tone: 'warn' },
            { text: 'B returns', value: 'A\'s result', tone: 'good' },
          ],
        },
        caption: 'One INSERT wins, the other reads the result',
      },
      code: {
        language: 'typescript',
        title: 'Idempotent charge',
        source: `async function pay(key: string, body: PayBody) {
  const hash = sha256(JSON.stringify(body));
  const won = await db.query(
    'INSERT INTO idempotency_keys(key, body_hash, status, locked_at) VALUES ($1,$2,\\'running\\',now()) ON CONFLICT DO NOTHING RETURNING key',
    [key, hash]);
  if (won.rowCount === 0) {
    const row = await db.one('SELECT * FROM idempotency_keys WHERE key=$1', [key]);
    if (row.body_hash !== hash) throw new HttpError(422);
    return row.status === 'done' ? row.response : leaseOver(row) ? resumeFromPsp(key, row) : { status: 409 };
  }
  const res = await psp.charge(body, { idempotencyKey: key });
  await db.query('UPDATE idempotency_keys SET response=$2, status=\\'done\\' WHERE key=$1', [key, res]);
  return res;
}`,
        highlight: [3, 4, 6, 8, 11],
      },
      quiz: {
        question: 'A charge request times out and the client retries with the same idempotency key. Which result is correct?',
        options: [
          'The server charges again, since the first attempt did not answer',
          'The server returns the stored result of the first attempt, and the card is charged once',
          'The server rejects the retry with an error so the buyer starts over',
          'The server waits 24 hours, then charges',
        ],
        answer: 1,
        explain: 'The key links the retry to the first attempt. The server finds the saved result and returns it. If the first attempt is still running, the retry gets a 409 and tries again later. The card is never charged twice.',
      },
    },
    {
      title: 'State machine',
      tag: 'concept',
      heading: 'A payment moves forward through states, never back',
      eli5: 'A ticket goes from "new" to "paid" to "used". Nobody is allowed to turn a "used" ticket back into a "new" one, so the clerk only moves tickets forward.',
      body: [
        'A payment is a small **state machine**: `created`, `pending`, `succeeded` or `failed`, then maybe `refunded`. Each change is a guarded `UPDATE ... WHERE status = \'pending\'`, so a duplicate or late message cannot move a payment backward.',
        'Each move also writes an event row in the same transaction. If the update matches zero rows, someone else already moved it, and we stop. The transactions lesson covers the atomic write.',
      ],
      keyIdea: 'Guard every status change with the status you expect. Late and duplicate messages then do nothing.',
      metrics: { tps: '1,200/s', p99: '2.5 s', dup: '0', data: '7 TB' },
      scene: {
        nodes: [
          { id: 's1', kind: 'block', size: 0.72, at: at(-5.4, 0), label: 'created', icon: 'FileText', tint: 'gray' },
          { id: 's2', kind: 'block', size: 0.72, at: at(-1.8, 0), label: 'pending', icon: 'Clock', tint: 'amber', status: 'active' },
          { id: 's3', kind: 'block', size: 0.72, at: at(1.8, -3.4), label: 'succeeded', icon: 'Receipt', tint: 'green' },
          { id: 's4', kind: 'block', size: 0.72, at: at(1.8, 3.4), label: 'failed', icon: 'Bug', tint: 'red' },
        ],
        links: [link('s1', 's2'), link('s2', 's3'), link('s2', 's4')],
        flows: [
          { path: ['s1', 's2', 's3'], tone: 'request', label: 'charge ok', duration: 2.4 },
          { path: ['s2', 's4'], tone: 'error', label: 'declined', duration: 1.6, delay: 2.5 },
        ],
        panel: {
          title: 'Allowed moves',
          icon: 'Workflow',
          rows: [
            { text: 'created to pending', value: 'we call PSP' },
            { text: 'pending to succeeded', value: 'PSP ok', tone: 'good' },
            { text: 'pending to failed', value: 'declined', tone: 'bad' },
            { text: 'succeeded to refunded', value: 'later' },
            { text: 'succeeded to pending', value: 'forbidden', tone: 'bad' },
          ],
        },
        caption: 'Forward only, one guarded step at a time',
      },
      code: {
        language: 'sql',
        title: 'A guarded status change',
        source: `BEGIN;
UPDATE payment_orders
   SET status = 'succeeded', psp_ref = 'ch_881'
 WHERE id = 'pay_91' AND status = 'pending';   -- 0 rows if already moved
INSERT INTO payment_events(order_id, type)
VALUES ('pay_91', 'succeeded');
COMMIT;`,
        highlight: [4],
      },
    },
    {
      title: 'Webhooks',
      tag: 'concept',
      heading: 'Some answers arrive later, by webhook',
      eli5: 'Sometimes the bank teller says "come back later" and rings the booth bell when the coins are really in. The clerk checks it is the real bell, then writes "paid".',
      body: [
        'Many payments finish after the first reply: a 3-D Secure bank check, a bank transfer. The PSP calls our **webhook** endpoint when the final result is known. We verify its **signature**, dedupe by event id, update the state and answer `200` fast.',
        'Webhooks can be late, repeated or lost. So we also poll the PSP for payments stuck in `pending`. The webhook is a fast path, the poll is the safety net.',
      ],
      keyIdea: 'Trust a webhook only after checking its signature, and never rely on it alone. Poll for anything still pending.',
      metrics: { tps: '1,200/s', p99: '2.5 s', dup: '0', data: '7 TB' },
      scene: {
        nodes: [
          { ...psp, at: at(-5.4, 0) },
          { id: 'hook', kind: 'block', at: at(-1.8, 0), label: 'webhook API', sub: 'verify signature', icon: 'Webhook', tint: 'teal' },
          { ...pay, at: at(1.8, 0), label: 'payment svc', chips: [{ text: 'event evt_77 seen?', tone: 'good' }] },
          { ...db, at: at(5.4, 0), status: 'active' },
        ],
        links: [link('psp', 'hook', { label: 'POST + signature' }), link('hook', 'pay'), link('pay', 'db')],
        flows: [
          { path: ['psp', 'hook', 'pay', 'db'], tone: 'event', label: 'payment.succeeded', duration: 3 },
          { path: ['hook', 'psp'], tone: 'response', label: '200 OK', duration: 1.4, delay: 3.1 },
        ],
        panel: {
          title: 'Webhook handler',
          icon: 'Webhook',
          rows: [
            { text: 'Check signature', value: 'HMAC', tone: 'good' },
            { text: 'Event id seen before', value: 'ignore', tone: 'good' },
            { text: 'Guarded status update', value: 'pending to succeeded' },
            { text: 'Reply fast', value: '200 in 100 ms' },
            { text: 'Still pending after 10 min', value: 'poll the PSP', tone: 'warn' },
          ],
        },
        caption: 'A signed, deduped event moves the state',
      },
    },
    {
      title: 'Retries',
      tag: 'tradeoff',
      heading: 'Retry with backoff, and ask before you charge again',
      eli5: 'If the teller window is busy, the clerk waits a little, then a bit longer, then longer still, instead of banging on the glass. And before paying again, the clerk asks "did my last coins arrive?"',
      body: [
        'Retries only help when they are safe, and the key makes them safe. Use **exponential backoff with jitter**: wait 1 s, 2 s, 4 s plus a random bit, up to 5 tries. The timeouts and retries lesson has the details.',
        'After an unknown result we first **ask the PSP** for the payment by key, and only charge if it has no record. Never retry a hard decline such as `card_declined`. The buyer must act.',
      ],
      keyIdea: 'Retry unknown results with backoff and a key. Do not retry a clear no.',
      metrics: { tps: '1,200/s', p99: '2.5 s', dup: '0', data: '7 TB' },
      scene: {
        nodes: [
          { ...pay, at: at(-5.4, 0), chips: [{ text: 'try 1 timeout', tone: 'warn' }, { text: 'wait 2 s + jitter', tone: 'default' }] },
          { id: 'retry', kind: 'queue', at: at(-1.8, 0), label: 'retry queue', sub: 'delayed jobs' },
          { ...psp, at: at(2.8, 0), chips: [{ text: 'lookup by key', tone: 'good' }] },
        ],
        links: [link('pay', 'retry'), link('retry', 'pay', { style: 'dashed', route: 'straight' }), link('pay', 'psp', { style: 'faint' })],
        flows: [
          { path: ['pay', 'retry'], tone: 'event', label: 'retry in 2 s', duration: 1.4 },
          { path: ['retry', 'pay', 'psp'], tone: 'request', label: 'ask first', duration: 1.8, delay: 1.5 },
          { path: ['psp', 'pay'], tone: 'response', label: 'found: paid', duration: 1.4, delay: 3.4 },
        ],
        panel: {
          title: 'Backoff schedule',
          icon: 'Repeat',
          rows: [
            { text: 'Try 1', value: 'now' },
            { text: 'Try 2', value: '+1 s' },
            { text: 'Try 3', value: '+2 s' },
            { text: 'Try 4, 5', value: '+4 s, +8 s' },
            { text: 'card_declined', value: 'no retry', tone: 'bad' },
          ],
          footer: { text: 'Jitter keeps retries from arriving together', tone: 'muted' },
        },
        caption: 'Retries are safe because of the key',
      },
    },
    {
      title: 'Recap, part 1',
      tag: 'recap',
      heading: 'Part 1 recap: one payment, once',
      eli5: 'The booth now writes down each ticket stub number first, only moves a ticket forward, never keeps anyone\'s coins in its own hands, and asks the bank before paying twice.',
      body: [
        'We sized the system at 1,200 payments a second and 7 TB a year, then built an API with **integer money** and an **idempotency key**. Card data stays at the PSP behind a **token**.',
        'A **state machine** guards each change, **webhooks** and polling finish async payments, and **retries with backoff** are safe because of the key. Part 2 adds the ledger, reconciliation, scale and failures.',
      ],
      keyIdea: 'Idempotent writes, forward-only states and tokens give one charge per intent. The ledger and reconciliation come next.',
      metrics: { tps: '1,200/s', p99: '2.5 s', dup: '0', data: '7 TB' },
      metricTones: { tps: 'good', p99: 'good', dup: 'good' },
      scene: {
        nodes: [
          { ...buyer, chips: ['key + token'] },
          { ...pay, chips: ['guarded states'] },
          { ...psp, chips: ['webhooks'] },
          { ...db, chips: ['keys + events'], status: 'ok' },
        ],
        links: [link('buyer', 'pay'), link('pay', 'psp'), link('pay', 'db')],
        flows: [{ path: ['buyer', 'pay', 'psp', 'pay', 'db'], tone: 'request', duration: 3.2 }],
        panel: {
          title: 'Part 1 checklist',
          icon: 'List',
          rows: [
            { text: 'Integer money, API', value: 'done', tone: 'good' },
            { text: 'Idempotency key', value: 'done', tone: 'good' },
            { text: 'State machine, webhooks', value: 'done', tone: 'good' },
            { text: 'Tokens, retries', value: 'done', tone: 'good' },
            { text: 'Ledger, scale, failures', value: 'part 2', tone: 'muted' },
          ],
        },
        caption: 'One charge per intent',
      },
      quiz: {
        question: 'A webhook for payment pay_91 arrives twice, and the second copy arrives after the order is already succeeded. What protects us?',
        options: [
          'The PSP guarantees it sends each webhook only once',
          'We dedupe by event id and the guarded update WHERE status = pending matches zero rows',
          'We charge the card again to be sure',
          'We drop every webhook and rely on polling alone',
        ],
        answer: 1,
        explain: 'Webhooks are delivered at least once, so duplicates are normal. Event id dedupe and a status-guarded update make the second copy a no-op, with no extra charge and no backward move.',
      },
    },
  ],
};
