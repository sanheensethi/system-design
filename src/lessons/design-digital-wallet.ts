import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const alice: SceneNode = { id: 'alice', kind: 'phone', at: at(-5.4, 0), label: 'Alice', sub: 'payer' };
const bob: SceneNode = { id: 'bob', kind: 'phone', at: at(5.4, 0), label: 'Bob', sub: 'payee' };
const wallet: SceneNode = { id: 'wallet', kind: 'block', at: at(0, 0), label: 'wallet svc', sub: 'transfers', icon: 'Receipt', tint: 'violet' };
const db: SceneNode = { id: 'db', kind: 'db', at: at(0, 3.6), label: 'wallet DB', sub: 'one primary' };
const ledger: SceneNode = { id: 'ledger', kind: 'db', at: at(3.6, 3.6), label: 'ledger', sub: 'append only' };

export const designDigitalWallet: Lesson = {
  id: 'design-digital-wallet',
  title: 'Design a digital wallet',
  tagline: 'Move money between wallets at 60,000 transfers a second without ever losing or inventing a cent.',
  minutes: 22,
  level: 'Advanced',
  learn: [
    'Requirements and napkin math for 300 million wallets',
    'A transfer API that is safe to retry, and a ledger that cannot lose money',
    'Where one database breaks, hot accounts, and sharding by wallet',
    'Cross-shard transfers: two-phase commit, sagas, try-confirm-cancel and event sourcing',
    'Failure cases, top-ups and withdrawals, reads, reconciliation and fraud limits',
  ],
  metrics: [
    { key: 'tps', label: 'Peak transfers', icon: 'Gauge' },
    { key: 'lat', label: 'Transfer p99', icon: 'Timer' },
    { key: 'drift', label: 'Cents lost or made', icon: 'Bug' },
    { key: 'nodes', label: 'Wallet shards', icon: 'Database' },
  ],
  steps: [
    {
      title: 'Money vanishes',
      tag: 'problem',
      heading: 'Two writes, one crash, and 50.00 is gone',
      eli5: 'Two kids trade coins using jars. Alice takes coins out of her jar, then the lights go out before Bob puts them in his. The coins are now nowhere.',
      body: [
        'Alice sends Bob 50.00. The wallet service must lower Alice by 50.00 and raise Bob by 50.00. These are two writes.',
        'If the service dies between them, 50.00 has left the system. A **digital wallet** stores real money, so one lost cent is a bug a regulator will ask about.',
      ],
      keyIdea: 'A transfer is two balance changes that must both happen or neither. Everything in this design protects that.',
      metrics: { tps: '?', lat: '?', drift: '50.00', nodes: '1' },
      metricTones: { drift: 'bad' },
      scene: {
        nodes: [
          { ...alice, chips: [{ text: 'sent 50.00', tone: 'default' }] },
          { ...wallet, status: 'down', badge: 'crash' },
          { ...bob, chips: [{ text: 'got 0.00', tone: 'bad' }] },
        ],
        links: [link('alice', 'wallet'), link('wallet', 'bob')],
        flows: [
          { path: ['alice', 'wallet'], tone: 'request', label: 'pay Bob 50.00', duration: 1.4 },
          { path: ['wallet', 'bob'], tone: 'error', label: 'never sent', duration: 1.4, delay: 1.6 },
        ],
        panel: {
          title: 'Balances after the crash',
          icon: 'Scale',
          rows: [
            { text: 'Alice before', value: '120.00' },
            { text: 'Alice after debit', value: '70.00', tone: 'warn' },
            { text: 'Bob before and after', value: '30.00', tone: 'bad' },
          ],
          footer: { text: 'Total money fell by 50.00', tone: 'bad' },
        },
        caption: 'Debit done, credit never ran',
      },
    },
    {
      title: 'Requirements',
      tag: 'concept',
      heading: 'What the wallet must do, and what it must never do',
      eli5: 'The class bank teacher promises three things: every jar shows the right number, every trade is written down, and a kid cannot spend coins they do not have.',
      body: [
        'Functional: **transfer** between wallets, **top up** from a bank, **withdraw** to a bank, read a balance, read history. Out of scope: card issuing and tax rules.',
        'Non-functional: **correctness first**, then availability. No negative balances, no double spend, a full audit trail, transfer p99 under 300 ms, and a retried request never moves money twice.',
      ],
      keyIdea: 'Correctness outranks speed here. When the system cannot be sure, it should refuse, not guess.',
      metrics: { tps: '?', lat: '< 300 ms', drift: '0', nodes: '1' },
      scene: {
        nodes: [{ ...alice, chips: ['transfer', 'top up'] }, { ...wallet, status: 'active' }, { ...bob, chips: ['balance', 'history'] }],
        links: [link('alice', 'wallet'), link('wallet', 'bob')],
        panel: {
          title: 'Must hold, always',
          icon: 'Shield',
          rows: [
            { text: 'Balance never below zero', value: 'invariant', tone: 'good' },
            { text: 'No double spend on retry', value: 'idempotent', tone: 'good' },
            { text: 'Every cent traceable', value: 'audit trail', tone: 'good' },
            { text: 'Transfer latency', value: 'p99 < 300 ms' },
            { text: 'Cents lost or made', value: '0 ever', tone: 'warn' },
          ],
        },
        caption: 'Correctness is the product',
      },
    },
    {
      title: 'Scale numbers',
      tag: 'concept',
      heading: '300 million wallets, 60,000 transfers per second at peak',
      eli5: 'There are 300 million jars in the whole school world. At lunch rush, tens of thousands of trades happen every second, far too many for one teacher.',
      body: [
        '300M wallets, 1B transfers a day. Average: 1B / 86,400 s = about **11,600 per second**. Peak is about 5x, so **60,000 per second**.',
        'Each transfer writes 2 ledger rows of about 100 bytes: 200 GB a day, **73 TB a year**. A well tuned single database node handles roughly 1,000 durable transfers a second. That is our assumption, and it drives everything.',
      ],
      keyIdea: 'Peak 60,000 per second divided by 1,000 per node means at least 60 write nodes, before cross-shard overhead. One database is not an option.',
      metrics: { tps: '60,000', lat: '< 300 ms', drift: '0', nodes: '60+' },
      scene: {
        nodes: [{ ...wallet, size: 0.9 }, { ...db, at: at(-3.4, 3.6), status: 'hot', load: 100 }, ledger],
        links: [link('wallet', 'db'), link('wallet', 'ledger')],
        panel: {
          title: 'Back of the envelope',
          icon: 'Table',
          rows: [
            { text: 'Transfers per day', value: '1B' },
            { text: 'Average per second', value: '11,600' },
            { text: 'Peak (5x)', value: '60,000', tone: 'warn' },
            { text: 'One node can do', value: '~1,000', tone: 'bad' },
            { text: 'Ledger growth', value: '73 TB / year' },
          ],
        },
        caption: 'Peak is 60x what one node can write',
      },
    },
    {
      title: 'Transfer API',
      tag: 'concept',
      heading: 'One endpoint moves money, and it carries a key',
      eli5: 'Alice hands the teacher a slip: "from my jar to Bob\'s jar, 50 coins, slip number 7c1e". The slip number lets the teacher spot a slip handed in twice.',
      body: [
        '`POST /v1/transfers` takes a source wallet, a destination wallet, an amount in **minor units** (cents, as an integer) and a currency. An `Idempotency-Key` header is required.',
        'Reads are `GET /v1/wallets/{id}` for the balance and `GET /v1/wallets/{id}/entries` for paged history. Top-ups and withdrawals get their own endpoints later.',
      ],
      keyIdea: 'Amounts are integers in minor units, never floats. The idempotency key makes retries safe.',
      metrics: { tps: '60,000', lat: '< 300 ms', drift: '0', nodes: '1' },
      scene: {
        nodes: [{ ...alice, chips: ['POST /v1/transfers'] }, { ...wallet, status: 'active' }, { ...db, at: at(5.4, 0), label: 'wallet DB', sub: 'one primary' }],
        links: [link('alice', 'wallet'), link('wallet', 'db')],
        flows: [
          { path: ['alice', 'wallet', 'db'], tone: 'request', label: 'transfer', duration: 1.8 },
          { path: ['db', 'wallet', 'alice'], tone: 'response', label: '201 done', duration: 1.8, delay: 1.9 },
        ],
        panel: {
          title: 'Create a transfer',
          icon: 'Code',
          code: 'POST /v1/transfers\nIdempotency-Key: 7c1e-44ab\n{ "from": "w_alice",\n  "to": "w_bob",\n  "amount": 5000,\n  "currency": "USD" }',
          footer: { text: '409 on insufficient funds', tone: 'muted' },
        },
        caption: 'Integers and a key',
      },
    },
    {
      title: 'Data model',
      tag: 'concept',
      heading: 'Wallets hold a balance, the ledger holds the truth',
      eli5: 'Each kid has a jar with a number on a card. The teacher also keeps a notebook where every move of coins is written as a new line, never erased.',
      body: [
        '`wallets` has `id`, `currency`, `balance` and `held`. Available is `balance - held`, and a CHECK keeps it at zero or more. `ledger_entries` is append only: wallet, transfer, signed amount, currency.',
        '`transfers` stores from and to wallets, amount, status and the idempotency key. Currencies never mix in one wallet. A swap is two transfers through an FX system wallet.',
      ],
      keyIdea: 'The balance column is a fast cache of the ledger. The ledger is what you can audit.',
      metrics: { tps: '60,000', lat: '< 300 ms', drift: '0', nodes: '1' },
      scene: {
        nodes: [{ ...db, at: at(-2.7, 0), label: 'wallets', sub: 'id, balance, held' }, { ...ledger, at: at(2.7, 0), label: 'ledger', sub: 'entries, signed' }, { id: 'transfers', kind: 'db', at: at(0, 3.6), label: 'transfers', sub: 'from, to, status, key' }],
        links: [link('db', 'ledger', { arrow: 'none' }), link('transfers', 'ledger', { arrow: 'none' })],
        panel: {
          title: 'ledger_entries',
          icon: 'Table',
          code: 'id  wallet   transfer  amount\n41  w_alice  t_9      -5000\n42  w_bob    t_9      +5000\n43  w_bob    t_10     -1200\n44  w_cafe   t_10     +1200',
          footer: { text: 'Rows are never updated or deleted', tone: 'good' },
        },
        caption: 'Three tables',
      },
      code: {
        language: 'sql',
        title: 'Schema',
        source: `CREATE TABLE wallets (
  id       TEXT PRIMARY KEY,
  currency CHAR(3) NOT NULL,
  balance  BIGINT  NOT NULL,
  held     BIGINT  NOT NULL DEFAULT 0,
  CHECK (balance - held >= 0)
);
CREATE TABLE transfers (
  id TEXT PRIMARY KEY, idem_key TEXT UNIQUE NOT NULL,
  from_wallet TEXT NOT NULL, to_wallet TEXT NOT NULL,
  amount BIGINT NOT NULL, status TEXT NOT NULL
);
CREATE TABLE ledger_entries (
  id BIGSERIAL PRIMARY KEY, wallet_id TEXT NOT NULL,
  transfer_id TEXT NOT NULL, amount BIGINT NOT NULL,
  currency CHAR(3) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);`,
        highlight: [4, 5, 6, 10],
      },
    },
    {
      title: 'Simple design',
      tag: 'concept',
      heading: 'The simple version: one SQL transaction',
      eli5: 'The teacher does both steps in one go, with the notebook open. Either both jars change and the line is written, or nothing happens at all.',
      body: [
        'One database transaction lowers the payer, raises the payee and appends two ledger rows. ACID makes it all or nothing. A `CHECK (balance - held >= 0)` blocks overdrafts.',
        'Lock both wallet rows in a fixed order (lowest id first), or two opposite transfers can deadlock.',
      ],
      keyIdea: 'On one database, a transaction solves atomicity for free. The rest of the design exists because we outgrow one database.',
      metrics: { tps: '1,000 max', lat: '40 ms', drift: '0', nodes: '1' },
      metricTones: { drift: 'good', lat: 'good' },
      scene: {
        nodes: [alice, { ...wallet, status: 'active' }, { ...db, at: at(5.4, 0), status: 'ok' }],
        links: [link('alice', 'wallet'), link('wallet', 'db')],
        flows: [
          { path: ['alice', 'wallet', 'db'], tone: 'request', label: 'BEGIN ... COMMIT', duration: 1.8 },
          { path: ['db', 'wallet', 'alice'], tone: 'response', label: 'ok', duration: 1.4, delay: 1.9 },
        ],
        panel: {
          title: 'One transaction',
          icon: 'Code',
          code: 'BEGIN;\nSELECT ... WHERE id IN (a,b)\n  ORDER BY id FOR UPDATE;\nUPDATE wallets SET balance=balance-5000 ...;\nUPDATE wallets SET balance=balance+5000 ...;\nINSERT INTO ledger_entries ... x2;\nCOMMIT;',
          footer: { text: 'All or nothing', tone: 'good' },
        },
        caption: 'Atomic on one node',
      },
    },
    {
      title: 'Double entry',
      tag: 'concept',
      heading: 'Every transfer is two ledger rows that sum to zero',
      eli5: 'Each trade is written on two lines: Alice gave 50, Bob got 50. If the teacher adds up the whole notebook and it is not zero, someone made a mistake.',
      body: [
        '**Double entry** means every transfer writes a debit and a credit of equal size. The sum of all entries in the system is always zero, so money cannot appear or vanish unnoticed.',
        'Money entering or leaving the wallet is also double entry. A bank account is modeled as a system wallet, so even a top-up is a transfer.',
      ],
      keyIdea: "Balance is the sum of a wallet's entries. A global sum of zero is a cheap, strong integrity check.",
      metrics: { tps: '1,000 max', lat: '40 ms', drift: '0', nodes: '1' },
      scene: {
        nodes: [{ ...alice, chips: [{ text: '-50.00', tone: 'bad' }] }, { ...ledger, at: at(0, 0), status: 'active', label: 'ledger', sub: 'sum = 0' }, { ...bob, chips: [{ text: '+50.00', tone: 'good' }] }],
        links: [link('alice', 'ledger'), link('ledger', 'bob')],
        flows: [{ path: ['alice', 'ledger', 'bob'], tone: 'data', label: '50.00', duration: 2 }],
        panel: {
          title: 'Transfer t_9',
          icon: 'Scale',
          rows: [
            { text: 'w_alice', value: '-50.00', tone: 'bad' },
            { text: 'w_bob', value: '+50.00', tone: 'good' },
            { text: 'Sum of entries', value: '0.00', tone: 'good' },
          ],
        },
        caption: 'Debit and credit, equal and opposite',
      },
    },
    {
      title: 'Lost reply',
      tag: 'case',
      heading: 'Case: the reply is lost and the app retries',
      eli5: 'Alice hands in slip 7c1e, but the teacher says "done" too quietly. She hands the same slip in again. The teacher sees slip 7c1e is already in the notebook and just says "done".',
      body: [
        'The commit succeeds, the 201 reply is dropped, and the phone retries. Without protection Bob gets 100.00.',
        '`transfers.idem_key` is `UNIQUE`. The retry hits the same key, finds the stored result and returns it with no new money moved. The payment system lesson covers keys in depth.',
      ],
      keyIdea: 'Insert the idempotency key in the same transaction as the money. One key, one transfer, however many retries.',
      metrics: { tps: '1,000 max', lat: '40 ms', drift: '0', nodes: '1' },
      scene: {
        nodes: [{ ...alice, chips: [{ text: 'key 7c1e (retry)', tone: 'good' }] }, { ...wallet, status: 'active' }, { ...db, at: at(5.4, 0), badge: 'key exists', status: 'ok' }],
        links: [link('alice', 'wallet'), link('wallet', 'db')],
        flows: [
          { path: ['alice', 'wallet', 'db'], tone: 'request', label: 'retry 7c1e', duration: 1.8 },
          { path: ['db', 'wallet', 'alice'], tone: 'response', label: 'same 201', duration: 1.8, delay: 1.9 },
        ],
        panel: {
          title: 'Same key, same result',
          icon: 'Key',
          rows: [
            { text: 'Attempt 1 (reply lost)', value: 'moves 50.00', tone: 'warn' },
            { text: 'Attempt 2 (same key)', value: 'returns stored', tone: 'good' },
            { text: 'Bob received', value: '50.00', tone: 'good' },
          ],
        },
        caption: 'A retry cannot double pay',
      },
      quiz: {
        question: 'Why insert the idempotency key in the same transaction as the balance changes?',
        options: [
          'So the key survives a cache flush',
          'So a crash can never leave money moved without the key, or the key without the money',
          'So the database can skip locking the wallet rows',
          'So the response is smaller',
        ],
        answer: 1,
        explain: 'If the key and the money commit together, a retry always sees a consistent picture: either both exist and it returns the stored result, or neither does and it runs fresh.',
      },
    },
    {
      title: 'One DB breaks',
      tag: 'case',
      heading: 'Where it breaks: one primary cannot take 60,000 per second',
      eli5: 'One teacher with one notebook can handle a small class. With the whole school lining up at lunch, the line out the door never ends.',
      body: [
        'Each transfer takes 2 row locks, 2 updates and 2 inserts, all durably committed. One primary tops out near 1,000 per second, so at 60,000 the queue grows without bound and p99 explodes past seconds.',
        'Bigger hardware buys a few times more. Read replicas do not help, because these are writes.',
      ],
      keyIdea: 'Write throughput is the wall. Replicas help reads only, so we must split the writes.',
      metrics: { tps: '60,000', lat: '8,000 ms', drift: '0', nodes: '1' },
      metricTones: { tps: 'warn', lat: 'bad' },
      scene: {
        nodes: [{ ...alice, chips: ['60,000 / s'] }, { ...wallet, status: 'hot', load: 95 }, { ...db, at: at(5.4, 0), status: 'hot', load: 100, badge: 'queue 40k' }],
        links: [link('alice', 'wallet', { label: '60k req/s', labelTone: 'warn' }), link('wallet', 'db')],
        flows: [{ path: ['alice', 'wallet', 'db'], tone: 'request', count: 4, duration: 1.2 }],
        panel: {
          title: 'One primary',
          icon: 'Gauge',
          rows: [
            { text: 'Capacity', value: '1,000 / s' },
            { text: 'Offered load', value: '60,000 / s', tone: 'bad' },
            { text: 'Transfer p99', value: '> 8 s', tone: 'bad' },
          ],
          footer: { text: 'Timeouts trigger retries, which add load', tone: 'bad' },
        },
        caption: 'The write queue never drains',
      },
    },
    {
      title: 'Shard wallets',
      tag: 'concept',
      heading: 'Fix: shard by wallet id, 60 shards at the very least',
      eli5: 'The school opens many classrooms. Each kid belongs to one classroom, and that classroom\'s teacher keeps their jar and notebook. Lunch lines split across all the rooms.',
      body: [
        'A router hashes `wallet_id` to pick a **shard**, each a primary with replicas. The consistent hashing lesson explains why adding shards moves only a slice of wallets.',
        '60 is the floor for single-shard work. A cross-shard transfer costs about 4 local transactions, so peak is about 240,000 shard operations a second. That needs 240 shards, or about **350** to run at 70% load.',
      ],
      keyIdea: 'Shard by wallet id so each wallet and its ledger are on one node. Count local transactions, not transfers, when you size the fleet.',
      metrics: { tps: '60,000', lat: '60 ms', drift: '0', nodes: '350' },
      metricTones: { tps: 'good', lat: 'good' },
      scene: {
        nodes: [
          { ...wallet, at: at(-5.4, 0), label: 'router', sub: 'hash(wallet_id)', icon: 'Hash' },
          { id: 's1', kind: 'shard', at: at(-1, -3.4), label: 'shard 1', sub: 'w_a..', status: 'ok', load: 66 },
          { id: 's2', kind: 'shard', at: at(2.6, 0), label: 'shard 2', sub: 'w_b..', status: 'ok', load: 70 },
          { id: 's3', kind: 'shard', at: at(6.2, 3.4), label: 'shard 350', sub: 'w_z..', status: 'ok', load: 68 },
        ],
        links: [link('wallet', 's1'), link('wallet', 's2'), link('wallet', 's3')],
        flows: [{ path: ['wallet', 's2'], tone: 'request', label: 'w_b17', duration: 1.4 }],
        panel: {
          title: 'Sizing',
          icon: 'Table',
          rows: [
            { text: 'Peak transfers', value: '60,000 / s' },
            { text: 'Shards, single-shard only', value: '60 (floor)', tone: 'warn' },
            { text: 'Local txns per transfer', value: '~4' },
            { text: 'Shard operations', value: '240,000 / s' },
            { text: 'Shards at 1,000 / s', value: '240 (100%)', tone: 'warn' },
            { text: 'Shards at 70% load', value: '~350', tone: 'good' },
          ],
        },
        caption: 'Each wallet has one home shard',
      },
    },
    {
      title: 'Cross-shard',
      tag: 'case',
      heading: 'New problem: payer and payee live on different shards',
      eli5: 'Alice is in classroom 2 and Bob in classroom 9. Two teachers must each change their own jar, and no teacher can reach into the other room.',
      body: [
        'Most transfers now touch two shards, and no single database transaction spans both. Debit on shard 2 commits. Then shard 9 fails or the caller dies. The 50.00 from step one is back.',
        'We need atomicity across two nodes. The distributed transactions lesson names three tools. We try each.',
      ],
      keyIdea: 'Sharding gives speed and costs us the free transaction. Cross-shard atomicity must be built.',
      metrics: { tps: '60,000', lat: '60 ms', drift: '50.00', nodes: '350' },
      metricTones: { drift: 'bad' },
      scene: {
        nodes: [
          { ...wallet, at: at(-5.4, 0), label: 'router', sub: 'hash(wallet_id)', icon: 'Hash' },
          { id: 's2', kind: 'shard', at: at(-1.2, -1.8), label: 'shard 2', sub: 'Alice: 70.00', status: 'ok', chips: [{ text: 'debit 50.00 ok', tone: 'good' }] },
          { id: 's9', kind: 'shard', at: at(3, 2.4), label: 'shard 9', sub: 'Bob: 30.00', status: 'down', chips: [{ text: 'credit failed', tone: 'bad' }] },
        ],
        links: [link('wallet', 's2'), link('wallet', 's9')],
        flows: [
          { path: ['wallet', 's2'], tone: 'request', label: 'debit', duration: 1.2 },
          { path: ['wallet', 's9'], tone: 'error', label: 'credit', duration: 1.2, delay: 1.4 },
        ],
        panel: {
          title: 'Three ways to fix it',
          icon: 'List',
          rows: [
            { text: 'Two-phase commit', value: 'lock, vote, commit' },
            { text: 'Saga', value: 'steps + undo' },
            { text: 'Try-confirm-cancel', value: 'hold, then settle' },
          ],
        },
        caption: 'Debit committed, credit lost',
      },
    },
    {
      title: 'Hot account',
      tag: 'case',
      heading: 'Case: one merchant wallet takes every payment',
      eli5: 'Everyone wants to pay the lunch lady, so all trades touch her one jar. Only one kid can use her jar at a time, so the line forms at her jar no matter how many teachers there are.',
      body: [
        'Sharding spreads wallets, but one **hot wallet** such as a big merchant is still one row. Every transfer to it locks that row, so it serializes at about 1,000 per second, our per-row assumption.',
        'Fix: split the merchant into 32 **sub-wallets** (`m_77#0..31`), hashed to different shards. Payments pick one at random. Balance is the sum, and a nightly sweep merges them. Use it for receive-heavy wallets only.',
      ],
      keyIdea: 'Sharding cannot split one row. Split the hot wallet into sub-wallets on different shards and add them up on read.',
      metrics: { tps: '60,000', lat: '300 ms', drift: '0', nodes: '350' },
      scene: {
        nodes: [
          { id: 'payers', kind: 'user', at: at(-5.4, 0), label: 'many payers', sub: '20k / s' },
          { id: 'merchant', kind: 'block', at: at(0, 0), label: 'merchant', sub: '32 sub-wallets', icon: 'Split', tint: 'amber', status: 'ok' },
          { ...db, id: 'mdb', at: at(5.4, 0), label: 'sub-wallets', sub: 'on 32 shards', status: 'ok' },
        ],
        links: [link('payers', 'merchant'), link('merchant', 'mdb')],
        flows: [{ path: ['payers', 'merchant', 'mdb'], tone: 'request', count: 3, duration: 1.6, label: 'random sub-wallet' }],
        panel: {
          title: 'Merchant wallet m_77',
          icon: 'Table',
          rows: [
            { text: 'One row (assumed cap)', value: '1,000 / s', tone: 'bad' },
            { text: '32 sub-wallets, 32 shards', value: '32,000 / s', tone: 'good' },
            { text: 'Balance read', value: 'sum of 32' },
          ],
        },
        caption: 'Many rows instead of one',
      },
    },
    {
      title: 'Two-phase',
      tag: 'tradeoff',
      heading: 'Option 1: two-phase commit',
      eli5: 'A coordinator teacher asks both classrooms "can you do it?" and everyone freezes their jar until all say yes. Then she says "go". If she faints, both jars stay frozen.',
      body: [
        'A coordinator asks both shards to **prepare**: lock the rows and promise to commit. If both vote yes, it sends **commit**. The result is atomic and exact.',
        'Cost: locks are held across network round trips, so hot wallets stall. If the coordinator dies between the phases, the shards block. At 60,000 per second this is too fragile and slow.',
      ],
      keyIdea: '2PC is correct but holds locks across the network and blocks on coordinator failure. It rarely fits a high-rate path.',
      metrics: { tps: '15,000', lat: '250 ms', drift: '0', nodes: '350' },
      metricTones: { tps: 'bad', lat: 'warn', drift: 'good' },
      scene: {
        nodes: [
          { id: 'coord', kind: 'block', at: at(-5.4, 0), label: 'coordinator', sub: 'tx manager', icon: 'Workflow', tint: 'violet' },
          { id: 's2', kind: 'shard', at: at(-1.6, -2), label: 'shard 2', sub: 'row locked', status: 'hot', chips: ['PREPARE yes'] },
          { id: 's9', kind: 'shard', at: at(2.6, 2.2), label: 'shard 9', sub: 'row locked', status: 'hot', chips: ['PREPARE yes'] },
        ],
        links: [link('coord', 's2', { label: 'locks held', labelTone: 'warn' }), link('coord', 's9')],
        flows: [
          { path: ['coord', 's2', 'coord'], tone: 'handshake', label: 'prepare', duration: 1.4 },
          { path: ['coord', 's9', 'coord'], tone: 'handshake', label: 'prepare', duration: 1.4, delay: 0.2 },
          { path: ['coord', 's2'], tone: 'request', label: 'commit', duration: 1.2, delay: 1.8 },
          { path: ['coord', 's9'], tone: 'request', label: 'commit', duration: 1.2, delay: 1.8 },
        ],
        panel: {
          title: 'Verdict',
          icon: 'Scale',
          rows: [
            { text: 'Atomic', value: 'yes', tone: 'good' },
            { text: 'Locks held for', value: '2 round trips', tone: 'warn' },
            { text: 'Coordinator dies', value: 'shards block', tone: 'bad' },
          ],
        },
        caption: 'Safe, but slow and fragile',
      },
    },
    {
      title: 'Saga',
      tag: 'tradeoff',
      heading: 'Option 2: a saga with an undo step',
      eli5: 'Alice\'s classroom takes her coins first and gives a receipt. Then Bob\'s classroom is asked to add them. If Bob\'s room says no, Alice\'s room hands her coins back.',
      body: [
        'A **saga** runs local transactions in order: debit the payer on shard 2, then credit the payee on shard 9. If the credit cannot happen, a compensating step refunds the payer.',
        'No distributed locks, so it is fast. The price: for a moment the money is in neither wallet, and a refund can itself fail and must be retried until it works.',
      ],
      keyIdea: 'A saga trades isolation for speed. Each step commits alone, and undo steps repair failures.',
      metrics: { tps: '60,000', lat: '70 ms', drift: '0', nodes: '350' },
      metricTones: { tps: 'good', drift: 'good' },
      scene: {
        nodes: [
          { id: 'saga', kind: 'block', at: at(-5.4, 0), label: 'saga driver', sub: 'runs the steps', icon: 'Route', tint: 'violet' },
          { id: 's2', kind: 'shard', at: at(-1.6, -2), label: 'shard 2', sub: 'Alice', status: 'ok', chips: ['1 debit 50.00'] },
          { id: 's9', kind: 'shard', at: at(2.6, 2.2), label: 'shard 9', sub: 'Bob', status: 'active', chips: ['2 credit 50.00'] },
        ],
        links: [link('saga', 's2'), link('saga', 's9')],
        flows: [
          { path: ['saga', 's2', 'saga'], tone: 'request', label: '1 debit', duration: 1.4 },
          { path: ['saga', 's9', 'saga'], tone: 'request', label: '2 credit', duration: 1.4, delay: 1.6 },
          { path: ['saga', 's2'], tone: 'error', label: 'undo: refund', duration: 1.2, delay: 3.2 },
        ],
        panel: {
          title: 'Saga steps',
          icon: 'List',
          rows: [
            { text: '1 debit payer', value: 'commit', tone: 'good' },
            { text: '2 credit payee', value: 'commit', tone: 'good' },
            { text: 'If 2 fails: refund payer', value: 'retry until ok', tone: 'warn' },
          ],
          footer: { text: 'Money is in flight between steps', tone: 'warn' },
        },
        caption: 'Local steps plus compensation',
      },
    },
    {
      title: 'Try confirm',
      tag: 'concept',
      heading: 'Our pick: reserve first, then settle (try-confirm-cancel)',
      eli5: 'Alice\'s teacher puts her 50 coins in a sealed envelope on the desk, still marked as Alice\'s. Only when Bob\'s room says "ready" is the envelope handed over. Otherwise it goes back in her jar.',
      body: [
        '**Try**: shard 2 puts 50.00 on **hold** with one conditional update (panel), so two payments cannot spend the same money. Shard 9 records a pending credit. **Confirm** settles both and posts the ledger rows. **Cancel** releases both.',
        'Ledger rows post at confirm, so entries sum to zero once per settled transfer. Holds carry an expiry that the sweeper cancels.',
      ],
      keyIdea: 'Holds make the in-flight state explicit and safe. A saga with reservations avoids both blocking and invisible money.',
      metrics: { tps: '60,000', lat: '90 ms', drift: '0', nodes: '350' },
      metricTones: { drift: 'good', lat: 'good' },
      scene: {
        nodes: [
          { id: 'saga', kind: 'block', at: at(-5.4, 0), label: 'transfer svc', sub: 'drives t_9', icon: 'Route', tint: 'violet' },
          { id: 's2', kind: 'shard', at: at(-1.6, -2), label: 'shard 2', sub: 'Alice', status: 'ok', chips: [{ text: 'available 70.00', tone: 'default' }, { text: 'hold 50.00', tone: 'warn' }] },
          { id: 's9', kind: 'shard', at: at(2.6, 2.4), label: 'shard 9', sub: 'Bob', status: 'ok', chips: [{ text: 'pending +50.00', tone: 'warn' }] },
        ],
        links: [link('saga', 's2'), link('saga', 's9')],
        flows: [
          { path: ['saga', 's2', 'saga'], tone: 'request', label: 'try: hold', duration: 1.3 },
          { path: ['saga', 's9', 'saga'], tone: 'request', label: 'try: pending', duration: 1.3, delay: 1.5 },
          { path: ['saga', 's2'], tone: 'response', label: 'confirm', duration: 1.1, delay: 3 },
          { path: ['saga', 's9'], tone: 'response', label: 'confirm', duration: 1.1, delay: 3 },
        ],
        panel: {
          title: 'Try: the hold is one update',
          icon: 'Workflow',
          code: 'UPDATE wallets\n SET held = held + :amt\n WHERE id = :id\n  AND balance - held >= :amt;\n-- 0 rows updated = refused',
          footer: { text: 'Ledger rows post at confirm. Holds expire.', tone: 'muted' },
        },
        caption: 'Reserve, then settle',
      },
      quiz: {
        question: 'What does a hold give us that a plain debit-then-credit saga lacks?',
        options: [
          'It removes the need for idempotency',
          'The in-flight money stays visible and cannot be spent twice, and canceling just releases it',
          'It makes the transfer atomic like 2PC',
          'It avoids touching the ledger',
        ],
        answer: 1,
        explain: 'The held amount is still accounted for on the payer shard, so it cannot be spent again and nothing is invisible. Cancel is a simple release instead of a fresh refund transfer.',
      },
    },
    {
      title: 'Transfer record',
      tag: 'concept',
      heading: 'A durable transfer state machine makes every step resumable',
      eli5: 'The teacher writes "trade 9: envelope sealed" on a whiteboard before each step. If she is replaced mid-lunch, the new teacher reads the board and carries on from there.',
      body: [
        'The transfer service stores each transfer as a row: `NEW`, `HELD`, `CONFIRMED` or `CANCELED`. It records the outcome of each idempotent step, so a restarted worker reads the row and continues. Cancel is legal only before `HELD`.',
        'The row and its idempotency key live on the shard of the payer wallet (or a separate transfer store), so one key dedupes a cross-shard retry. Events leave through an outbox.',
      ],
      keyIdea: 'Record the outcome of each step, and make every step safe to repeat. Then any crash is a retry or a cancel, and no hold leaks.',
      metrics: { tps: '60,000', lat: '90 ms', drift: '0', nodes: '350' },
      scene: {
        nodes: [
          { id: 'saga', kind: 'block', at: at(-5.4, 0), label: 'transfer svc', sub: 'stateless', icon: 'Route', tint: 'violet' },
          { id: 'state', kind: 'db', at: at(-1.2, 3.2), label: 'transfers', sub: 'on payer shard', status: 'active' },
          { id: 's2', kind: 'shard', at: at(1.8, -2.4), label: 'shard 2', sub: 'Alice', status: 'ok' },
          { id: 's9', kind: 'shard', at: at(5.8, 2.4), label: 'shard 9', sub: 'Bob', status: 'ok' },
        ],
        links: [link('saga', 'state'), link('saga', 's2'), link('saga', 's9')],
        flows: [
          { path: ['saga', 'state'], tone: 'data', label: 'HELD', duration: 1.2 },
          { path: ['saga', 's2'], tone: 'request', label: 'confirm t_9', duration: 1.2, delay: 1.4 },
          { path: ['saga', 's9'], tone: 'request', label: 'confirm t_9', duration: 1.2, delay: 1.4 },
        ],
        panel: {
          title: 'transfers.status',
          icon: 'Workflow',
          code: 'NEW -> HELD -> CONFIRMED\n  \\-> CANCELED (before HELD)\n\nrecord each step outcome,\nevery call keyed by t_id',
        },
        caption: 'State first, action second',
      },
      code: {
        language: 'typescript',
        title: 'A resumable transfer driver',
        source: `async function drive(t: Transfer) {
  if (t.status === 'NEW') {
    const held = await shard(t.from).hold(t.id, t.amount);
    if (!held) return save(t.id, 'CANCELED'); // nothing to release
    await shard(t.to).pending(t.id, t.amount);
    await save(t.id, 'HELD');
  }
  if (t.status === 'HELD') {
    await shard(t.from).confirm(t.id);
    await shard(t.to).confirm(t.id);
    await save(t.id, 'CONFIRMED');
  }
}
// legal only while NEW, never after HELD
async function cancel(t: Transfer) {
  await shard(t.from).release(t.id);
  await shard(t.to).release(t.id);
  await save(t.id, 'CANCELED');
}
// all shard calls are idempotent by t.id`,
        highlight: [3, 4, 5, 6, 16, 17],
      },
    },
    {
      title: 'Event sourcing',
      tag: 'tradeoff',
      heading: 'Alternative: each shard is a replicated log of commands',
      eli5: 'Instead of changing jars directly, every classroom writes each trade into a notebook first. The jar numbers are just what you get by reading the notebook from the top.',
      body: [
        'In the event sourcing lesson, state is a fold over an append-only log. A shard becomes a single-writer state machine: commands are ordered in a replicated log, applied one at a time, and snapshotted. Replaying the log rebuilds any balance and gives a perfect audit trail.',
        'Single-threaded apply needs no row locks and runs in memory, so one shard can do far more than 1,000 per second. The cost is a heavier build. It also does not remove the cross-shard gap: two such shards still need try-confirm-cancel between them.',
      ],
      keyIdea: 'A log-first shard improves per-shard speed, replay and audit. Transfers between two such shards still use try-confirm-cancel. We keep SQL here and note this as an upgrade path.',
      metrics: { tps: '60,000', lat: '90 ms', drift: '0', nodes: '350' },
      scene: {
        nodes: [
          { id: 'cmd', kind: 'block', at: at(-5.4, 0), label: 'commands', sub: 'ordered', icon: 'Inbox', tint: 'violet' },
          { id: 'log', kind: 'queue', at: at(-1.2, 2), label: 'replicated log', sub: 'append only', status: 'active' },
          { id: 'sm', kind: 'worker', at: at(3.2, -1.2), label: 'state machine', sub: 'single thread', status: 'ok' },
          { id: 'snap', kind: 'storage', at: at(6, 3), label: 'snapshots', sub: 'every 10k' },
        ],
        links: [link('cmd', 'log'), link('log', 'sm'), link('sm', 'snap')],
        flows: [
          { path: ['cmd', 'log', 'sm'], tone: 'event', label: 'transfer t_9', duration: 2 },
          { path: ['sm', 'snap'], tone: 'data', label: 'state', duration: 1.2, delay: 2.2 },
        ],
        panel: {
          title: 'Rebuild after a crash',
          icon: 'Repeat',
          rows: [
            { text: 'Load latest snapshot', value: 'seconds' },
            { text: 'Replay log after it', value: 'in order', tone: 'good' },
            { text: 'Same input, same balances', value: 'deterministic', tone: 'good' },
          ],
        },
        caption: 'The log is the truth',
      },
    },
    {
      title: 'Worker dies',
      tag: 'case',
      heading: 'Failure: the transfer service dies halfway',
      eli5: 'The teacher faints with the envelope sealed. A new teacher reads the whiteboard, sees "trade 9: sealed", and finishes handing it to Bob.',
      body: [
        'The worker held Alice\'s 50.00, then crashed. The row says `HELD`. A **recovery sweeper** finds transfers stuck over 30 seconds and calls `drive()` again.',
        'Shard calls are keyed by transfer id, so repeats change nothing. Cancel is legal only before `HELD`. Once held, a transfer is confirmed, never canceled, and confirm retries until it works. The sweeper claims a transfer with a lease, or `UPDATE ... WHERE status = old`, so two workers never drive it at once.',
      ],
      keyIdea: 'Crash recovery is a sweeper plus idempotent steps. Money is never stuck, only late.',
      metrics: { tps: '60,000', lat: '90 ms', drift: '0', nodes: '350' },
      metricTones: { drift: 'good' },
      scene: {
        nodes: [
          { id: 'w1', kind: 'worker', at: at(-5, -1), label: 'worker A', sub: 'crashed', status: 'down' },
          { id: 'sweep', kind: 'worker', at: at(-1.2, 2), label: 'sweeper', sub: 'every 10 s', status: 'active' },
          { id: 'state', kind: 'db', at: at(3, -1.2), label: 'transfers', sub: 't_9 HELD 40 s', status: 'hot' },
          { id: 's2', kind: 'shard', at: at(7.8, -1.4), label: 'shard 2', sub: 'Alice', status: 'ok' },
          { id: 's9', kind: 'shard', at: at(5.2, 2.6), label: 'shard 9', sub: 'Bob', status: 'ok' },
        ],
        links: [link('sweep', 'state'), link('sweep', 's2'), link('sweep', 's9')],
        flows: [
          { path: ['sweep', 'state'], tone: 'request', label: 'stuck > 30 s?', duration: 1.3 },
          { path: ['sweep', 's2'], tone: 'request', label: 'confirm t_9 again', duration: 1.5, delay: 1.5 },
          { path: ['sweep', 's9'], tone: 'request', label: 'confirm t_9 again', duration: 1.5, delay: 1.5 },
        ],
        panel: {
          title: 'Recovery rules',
          icon: 'List',
          rows: [
            { text: 'Stuck in HELD', value: 'confirm, never cancel', tone: 'good' },
            { text: 'Stuck in NEW', value: 'retry, or cancel + release' },
            { text: 'Past deadline, still NEW', value: 'cancel + release', tone: 'warn' },
            { text: 'Claim before driving', value: 'lease or status CAS', tone: 'good' },
          ],
        },
        caption: 'A sweeper finishes abandoned transfers',
      },
    },
    {
      title: 'Shard fails',
      tag: 'case',
      heading: 'Failure: a shard primary dies right after commit',
      eli5: 'Each classroom has a helper teacher who copies every line of the notebook before the head teacher says "done". If the head teacher is gone, the helper already has the notes.',
      body: [
        'Each shard has a primary and at least two replicas in other zones. A commit is acknowledged only after a **synchronous** replica has the log record. The replication and failover lessons cover the mechanics.',
        'When the primary dies, a replica with every acknowledged write is promoted in seconds. Transfers to that shard fail or time out during the switch, retry with their keys, and finish after it. Nothing acknowledged is lost.',
      ],
      keyIdea: 'Acknowledge only after a second copy exists. Failover then loses no confirmed money, at the cost of a few ms per write.',
      metrics: { tps: '60,000', lat: '95 ms', drift: '0', nodes: '350' },
      metricTones: { drift: 'good' },
      scene: {
        nodes: [
          { id: 'p', kind: 'shard', at: at(-4.6, -1), label: 'primary', sub: 'zone A', status: 'down' },
          { id: 'r1', kind: 'replica', at: at(-0.6, 1.8), label: 'replica', sub: 'zone B, sync', status: 'ok', badge: 'promoted' },
          { id: 'r2', kind: 'replica', at: at(3.6, -1), label: 'replica', sub: 'zone C', status: 'ok' },
        ],
        links: [link('p', 'r1', { style: 'dashed', arrow: 'none' }), link('r1', 'r2', { label: 'data', arrow: 'none' })],
        flows: [{ path: ['r1', 'r2'], tone: 'data', label: 'log', duration: 1.4 }],
        panel: {
          title: 'Commit rule',
          icon: 'Shield',
          rows: [
            { text: 'Primary writes', value: 'local log' },
            { text: 'Sync replica confirms', value: 'then ack', tone: 'good' },
            { text: 'Failover time', value: '~10 s', tone: 'warn' },
            { text: 'Acked writes lost', value: '0', tone: 'good' },
          ],
        },
        caption: 'Two copies before we say done',
      },
    },
    {
      title: 'Top-ups',
      tag: 'concept',
      heading: 'Money enters and leaves through the bank',
      eli5: 'Coins come in when a parent hands cash to the front office, which checks the receipt number so none is counted twice. Coins go home in a sealed envelope that comes back if the gate says no.',
      body: [
        'A **top-up** credits the user only after the bank confirms by webhook. Verify the signature and dedupe on the bank reference id (a unique key on the top-up row), since webhooks arrive at least once.',
        'A **withdrawal** holds first, sends the payout, then settles. If the payout bounces, the hold is released.',
      ],
      keyIdea: 'Treat the bank as one more wallet. Credit only on a verified, deduplicated confirmation, and release a hold when a payout fails.',
      metrics: { tps: '60,000', lat: '90 ms', drift: '0', nodes: '350' },
      scene: {
        nodes: [
          { id: 'bank', kind: 'block', at: at(-5.4, 0), label: 'bank', sub: 'external', icon: 'ArrowLeftRight', tint: 'amber' },
          { id: 'saga', kind: 'block', at: at(-0.6, 1.8), label: 'top-up svc', sub: 'webhook + state', icon: 'Webhook', tint: 'violet' },
          { id: 'shard', kind: 'shard', at: at(4.4, -1.6), label: 'user shard', sub: 'Alice', status: 'ok', chips: [{ text: '+100.00 after confirm', tone: 'good' }] },
        ],
        links: [link('bank', 'saga', { label: 'webhook' }), link('saga', 'shard')],
        flows: [
          { path: ['bank', 'saga'], tone: 'event', label: 'paid: 100.00', duration: 1.4 },
          { path: ['saga', 'shard'], tone: 'request', label: 'credit t_77', duration: 1.4, delay: 1.6 },
        ],
        panel: {
          title: 'Top-up and withdrawal states',
          icon: 'Workflow',
          rows: [
            { text: 'Top-up PENDING', value: 'no balance yet', tone: 'warn' },
            { text: 'Top-up CONFIRMED', value: 'credit entry', tone: 'good' },
            { text: 'Duplicate bank ref', value: 'ignored', tone: 'good' },
            { text: 'Withdraw: HOLD, PAYOUT SENT', value: 'bank pending', tone: 'warn' },
            { text: 'Withdraw: SETTLED', value: 'hold becomes debit', tone: 'good' },
            { text: 'Withdraw: RELEASED', value: 'payout failed', tone: 'bad' },
          ],
        },
        caption: 'Credit only after the bank says yes',
      },
    },
    {
      title: 'Reading balances',
      tag: 'concept',
      heading: 'Reads: balance from the shard, history from a projection',
      eli5: 'Checking your jar is quick, so you ask your own classroom. The long list of every trade ever is kept in a separate copy so the busy teacher is not bothered.',
      body: [
        'Balance reads go to the shard primary, so a payer sees their new balance right after sending. That is **read your writes**, and replicas may lag.',
        'History is a projection (the CQRS idea): ledger rows stream to a search or wide-column store, paged by wallet and time. It can trail by a second without harm.',
      ],
      keyIdea: 'Serve balances from the source of truth and history from a copy. Stale history is fine, a stale balance is not.',
      metrics: { tps: '60,000', lat: '90 ms', drift: '0', nodes: '350' },
      scene: {
        nodes: [
          { ...alice, at: at(-5.4, -1) },
          { id: 'shard', kind: 'shard', at: at(-0.6, 1.8), label: 'wallet shard', sub: 'balance', status: 'ok' },
          { id: 'hist', kind: 'search', at: at(4.2, -1.4), label: 'history store', sub: 'projection', status: 'active', badge: '~1 s behind' },
        ],
        links: [link('alice', 'shard', { label: 'balance' }), link('shard', 'hist', { label: 'ledger stream', arrow: 'end' })],
        flows: [
          { path: ['alice', 'shard', 'alice'], tone: 'request', label: 'GET balance', duration: 1.6 },
          { path: ['shard', 'hist'], tone: 'event', label: 'entries', duration: 1.4, delay: 1.8 },
        ],
        panel: {
          title: 'Which read goes where',
          icon: 'Table',
          rows: [
            { text: 'Balance', value: 'primary, fresh', tone: 'good' },
            { text: 'History page', value: 'projection, ~1 s old', tone: 'warn' },
            { text: 'Statements', value: 'warehouse' },
          ],
        },
        caption: 'Truth for balance, a copy for history',
      },
    },
    {
      title: 'Reconcile',
      tag: 'concept',
      heading: 'Trust but verify: reconciliation catches what tests miss',
      eli5: 'Every night the teachers add up all jars and all notebook lines across the school. If the totals disagree, they stop and find the missing coin before morning.',
      body: [
        'A nightly job checks three things: each wallet\'s balance equals the sum of its entries, every transfer\'s entries sum to zero, and our bank system wallet matches the bank\'s settlement file.',
        'Any difference raises an alert and freezes the affected wallets. This finds bugs, bad deploys and tampering that no unit test imagined.',
      ],
      keyIdea: 'Invariants are checkable. Run the checks every day, against an independent source, and treat a mismatch as an incident.',
      metrics: { tps: '60,000', lat: '90 ms', drift: '0', nodes: '350' },
      metricTones: { drift: 'good' },
      scene: {
        nodes: [
          { id: 'shards', kind: 'shard', at: at(-5.4, -1), label: 'all shards', sub: 'ledgers', status: 'ok' },
          { id: 'wh', kind: 'warehouse', at: at(-0.6, 1.8), label: 'warehouse', sub: 'daily copy', status: 'active' },
          { id: 'bankfile', kind: 'storage', at: at(4.2, -1.4), label: 'bank file', sub: 'settlement', status: 'ok' },
          { id: 'mon', kind: 'monitor', at: at(7, 3), label: 'alerts', sub: 'drift != 0', status: 'ok' },
        ],
        links: [link('shards', 'wh'), link('bankfile', 'wh'), link('wh', 'mon')],
        flows: [
          { path: ['shards', 'wh'], tone: 'data', label: 'ledgers', duration: 1.5 },
          { path: ['bankfile', 'wh'], tone: 'data', label: 'bank rows', duration: 1.5, delay: 0.4 },
          { path: ['wh', 'mon'], tone: 'event', label: 'drift: 0', duration: 1.2, delay: 2 },
        ],
        panel: {
          title: 'Nightly checks',
          icon: 'Scale',
          rows: [
            { text: 'Balance = sum of entries', value: 'pass', tone: 'good' },
            { text: 'Each transfer sums to 0', value: 'pass', tone: 'good' },
            { text: 'Bank wallet = bank file', value: 'pass', tone: 'good' },
          ],
          footer: { text: 'Any fail freezes the wallets', tone: 'muted' },
        },
        caption: 'Independent totals must agree',
      },
      quiz: {
        question: 'A nightly check finds one wallet whose balance differs from the sum of its ledger entries. What is the right response?',
        options: [
          'Overwrite the ledger so it matches the balance',
          'Ignore it, balances are only a cache',
          'Freeze that wallet, alert, and rebuild the balance from the ledger after investigating',
          'Delete the wallet and reissue it',
        ],
        answer: 2,
        explain: 'The ledger is the audit truth and is never rewritten. A mismatch is an incident: contain it, find the cause, then recompute the balance from the entries.',
      },
    },
    {
      title: 'Limits, fraud',
      tag: 'concept',
      heading: 'Guards: limits, velocity checks and fraud holds',
      eli5: 'The teacher has simple rules: no more than 20 coins a day for little kids, and if a jar suddenly sends coins to ten new friends in a minute, she asks why.',
      body: [
        'Before the try step, a **limits check** enforces daily and per-transfer caps by account tier. A fast rules engine scores each transfer (new device, burst of new payees, odd amount) and can allow, require a step-up check, or hold it for review.',
        'This runs inline with a tight timeout. If it is down we fail safe for large transfers and allow small ones.',
      ],
      keyIdea: 'Checks sit before the money moves, are fast, and have a defined fail-safe. They are separate from the ledger rules.',
      metrics: { tps: '60,000', lat: '110 ms', drift: '0', nodes: '350' },
      scene: {
        nodes: [
          { ...alice, at: at(-5.4, -1), chips: ['send 9,500.00'] },
          { id: 'risk', kind: 'limiter', at: at(-0.2, 1.6), label: 'risk check', sub: 'limits + rules', status: 'hot', badge: 'review' },
          { id: 'shard', kind: 'shard', at: at(4.4, -1.6), label: 'wallet shard', sub: 'not reached', status: 'dim' },
        ],
        links: [link('alice', 'risk'), link('risk', 'shard', { style: 'dashed' })],
        flows: [{ path: ['alice', 'risk'], tone: 'request', label: '9,500.00', duration: 1.4 }, { path: ['risk', 'alice'], tone: 'error', label: 'held for review', duration: 1.4, delay: 1.6 }],
        panel: {
          title: 'Risk decision',
          icon: 'Shield',
          rows: [
            { text: 'Daily limit left', value: '500.00', tone: 'bad' },
            { text: 'New payee burst', value: '7 in 1 min', tone: 'warn' },
            { text: 'Decision', value: 'hold, step-up', tone: 'warn' },
          ],
        },
        caption: 'Stopped before money moves',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Recap: from one crash to a sharded, auditable wallet',
      eli5: 'Every jar belongs to one classroom, every trade is written twice in a notebook, envelopes hold coins in flight, and each night the whole school adds up the totals.',
      body: [
        'Money is integer minor units in a double-entry ledger, so every cent has a trail. Idempotency keys make retries safe. Sharding by wallet reaches 60,000 per second with about 350 shards (240 is the floor once cross-shard work is counted), and sub-wallets relieve hot merchants.',
        'Cross-shard transfers use holds and a resumable state machine instead of 2PC. Sync replicas survive shard loss, a sweeper finishes stranded transfers, and nightly reconciliation proves the totals.',
      ],
      keyIdea: 'Keep each balance change local and safe, make every step repeatable, and verify the invariants every day.',
      metrics: { tps: '60,000', lat: '90 ms', drift: '0', nodes: '350' },
      metricTones: { tps: 'good', lat: 'good', drift: 'good' },
      scene: {
        nodes: [
          { ...alice, at: at(-5.4, -1) },
          { id: 'xfer', kind: 'block', at: at(-0.6, 1.8), label: 'transfer svc', sub: 'holds + keys', icon: 'Route', tint: 'violet', status: 'ok' },
          { id: 'shards', kind: 'shard', at: at(4.4, -1.6), label: '350 shards', sub: 'ledger each', status: 'ok' },
        ],
        links: [link('alice', 'xfer'), link('xfer', 'shards')],
        flows: [{ path: ['alice', 'xfer', 'shards'], tone: 'request', label: 'transfer', duration: 1.8 }, { path: ['shards', 'xfer', 'alice'], tone: 'response', label: 'done', duration: 1.8, delay: 1.9 }],
        panel: {
          title: 'Design checklist',
          icon: 'List',
          rows: [
            { text: 'Integer cents, double entry', value: 'done', tone: 'good' },
            { text: 'Idempotent transfers', value: 'done', tone: 'good' },
            { text: 'Shards + hot sub-wallets', value: 'done', tone: 'good' },
            { text: 'Holds, sweeper, failover', value: 'done', tone: 'good' },
            { text: 'Reconcile + risk checks', value: 'done', tone: 'good' },
          ],
        },
        caption: 'Safe, fast, auditable',
      },
      quiz: {
        question: 'Which choice best explains why this design uses holds instead of two-phase commit across shards?',
        options: [
          'Holds make transfers non-atomic, which is faster',
          'Holds avoid long cross-network locks and coordinator blocking, while keeping in-flight money visible and recoverable',
          'Two-phase commit cannot work with SQL',
          'Holds remove the need for a ledger',
        ],
        answer: 1,
        explain: 'Each hold or confirm is a short local transaction, so no locks span the network and a dead coordinator blocks nothing. The state machine and idempotent steps give the atomic outcome.',
      },
    },
  ],
};
