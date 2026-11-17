import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place a node by screen column (x - y) and screen row (x + y). */
const p = (col: number, row: number): [number, number] => [(col + row) / 2, (row - col) / 2];

const userA: SceneNode = { id: 'userA', kind: 'phone', at: p(-6.5, -3.5), label: 'Asha' };
const userB: SceneNode = { id: 'userB', kind: 'phone', at: p(-6.5, 3.5), label: 'Ben' };
const txA: SceneNode = { id: 'txA', kind: 'block', size: 0.72, at: p(-3.2, -3.5), label: 'txn A', icon: 'Workflow', tint: 'blue' };
const txB: SceneNode = { id: 'txB', kind: 'block', size: 0.72, at: p(-3.2, 3.5), label: 'txn B', icon: 'Workflow', tint: 'amber' };
const db: SceneNode = { id: 'db', kind: 'db', at: p(0.6, 0), label: 'Postgres', sub: 'wallets' };
const row1: SceneNode = { id: 'row1', kind: 'storage', at: p(4.2, -3.5), label: 'wallet 1' };
const row2: SceneNode = { id: 'row2', kind: 'storage', at: p(4.2, 3.5), label: 'wallet 2' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });
const twoLinks = [link('txA', 'db'), link('txB', 'db')];
const rowLinks = [link('db', 'row1', { style: 'dashed' }), link('db', 'row2', { style: 'dashed' })];

export const transactions: Lesson = {
  id: 'transactions',
  title: 'Transactions and isolation levels (part 1)',
  tagline: 'Group writes so they all happen or none do, and learn what two transactions can see of each other.',
  minutes: 14,
  level: 'Intermediate',
  learn: [
    'What each letter of ACID promises, and how the write-ahead log delivers it',
    'Rollback, constraints and why the app should not hand-roll transactions',
    'The anomalies: lost update, dirty read, non-repeatable read, phantom',
    'The four isolation levels, what each prevents, and the defaults in real databases',
  ],
  metrics: [
    { key: 'level', label: 'Isolation', icon: 'Layers' },
    { key: 'anomaly', label: 'Anomaly', icon: 'Bug' },
    { key: 'balance', label: 'Wallet 1', icon: 'Database' },
    { key: 'cost', label: 'Cost', icon: 'Timer' },
  ],
  steps: [
    {
      title: 'Half a transfer',
      tag: 'problem',
      heading: 'The crash between two updates',
      eli5: 'A toy shop keeps its money in a notebook. The shopkeeper crosses out $30 on one page, and the lights go out before she adds it to the other page. Now $30 is nowhere.',
      body: [
        'Asha sends $30 to Ben. The app runs two statements: subtract 30 from wallet 1, then add 30 to wallet 2. Each statement saves on its own, because the database runs in **autocommit** mode by default: with no `BEGIN`, every statement commits the moment it finishes.',
        'The app server crashes after the first one. Wallet 1 went from $100 to $70. Wallet 2 never got its $30. The money left one account and arrived nowhere, and nothing in the database says so.',
      ],
      keyIdea: 'Several writes that belong together need a way to succeed or fail as one unit.',
      metrics: { level: 'none (autocommit)', anomaly: '$30 vanished', balance: '$70', cost: '-' },
      metricTones: { anomaly: 'bad', balance: 'bad' },
      scene: {
        nodes: [userA, { ...txA, label: 'app', status: 'down', badge: 'crashed' }, { ...db, status: 'hot' }, { ...row1, status: 'hot', badge: '$100 → $70' }, { ...row2, badge: 'still $50' }],
        links: [link('userA', 'txA'), link('txA', 'db'), ...rowLinks],
        flows: [
          { path: ['userA', 'txA'], tone: 'request', label: 'send $30', duration: 1 },
          { path: ['txA', 'db', 'row1'], tone: 'request', label: '- $30', duration: 1.4, delay: 1.1 },
          { path: ['txA', 'db'], tone: 'error', label: '+ $30 never sent', duration: 1.4, delay: 2.8 },
        ],
        panel: {
          title: 'Two statements, autocommit',
          icon: 'List',
          rows: [
            { text: 'UPDATE wallet 1 - 30', value: 'saved', tone: 'good' },
            { text: 'crash', value: 'app dies', tone: 'bad' },
            { text: 'UPDATE wallet 2 + 30', value: 'never ran', tone: 'bad' },
          ],
          footer: { text: 'Total money fell by $30', tone: 'bad' },
        },
        caption: 'Debit saved, credit lost',
      },
    },
    {
      title: 'Two problems',
      tag: 'concept',
      heading: 'Two ways a group of writes goes wrong',
      eli5: 'The shop can fail in two ways. The lights go out halfway through a job, or two shopkeepers write on the same page at the same time. A **transaction** guards against both.',
      body: [
        'The crash is **partial failure**: some writes landed and some did not. The second problem needs no crash. Two requests that touch the same wallet at the same moment can overwrite each other.',
        'A **transaction** is the database feature that handles both. Its guarantees are summed up as ACID. The next steps take the letters one at a time.',
      ],
      keyIdea: 'Partial failure and concurrency are separate problems. A transaction addresses both.',
      metrics: { level: 'none', anomaly: 'partial failure, races', balance: '$70', cost: '-' },
      scene: {
        nodes: [txA, txB, { ...db, status: 'hot' }],
        links: twoLinks,
        flows: [
          { path: ['txA', 'db'], tone: 'error', label: 'half done', duration: 1.2 },
          { path: ['txB', 'db'], tone: 'error', label: 'overwrites', duration: 1.2, delay: 1.4 },
        ],
        panel: {
          title: 'What can go wrong',
          icon: 'Bug',
          rows: [
            { text: 'Crash between writes', value: 'partial failure', tone: 'bad' },
            { text: 'Two writers, one row', value: 'concurrency', tone: 'bad' },
            { text: 'The fix for both', value: 'transaction', tone: 'good' },
          ],
        },
        caption: 'Two different failures',
      },
    },
    {
      title: 'Atomicity',
      tag: 'concept',
      heading: 'Atomicity: all or nothing',
      eli5: 'The shopkeeper now writes both changes in pencil first. Only when both are down does she go over them in ink. If the lights go out, the pencil is rubbed away. That bundle is a **transaction**.',
      body: [
        'Wrap the two updates in `BEGIN` and `COMMIT`. **Atomicity** means either both updates are saved or neither is. If the server crashes before `COMMIT`, the database undoes the debit.',
        '`ROLLBACK` does the same on purpose. Do not hand-roll it with a compensating update in app code: the crash that caused the problem also kills the code that would run the undo. Only the database can undo reliably, because it keeps the log.',
      ],
      keyIdea: 'Between BEGIN and COMMIT nothing is final. A crash or a ROLLBACK erases all of it.',
      metrics: { level: 'read committed', anomaly: 'none (one txn)', balance: '$70', cost: '-' },
      metricTones: { anomaly: 'good' },
      scene: {
        nodes: [userA, { ...txA, status: 'active', badge: 'BEGIN … COMMIT' }, { ...db, status: 'ok', badge: 'both or neither' }, { ...row1, status: 'ok', badge: '$100 → $70' }, { ...row2, status: 'ok', badge: '$50 → $80' }],
        links: [link('userA', 'txA'), link('txA', 'db'), ...rowLinks],
        flows: [
          { path: ['userA', 'txA'], tone: 'request', label: 'send $30', duration: 1 },
          { path: ['txA', 'db', 'row1'], tone: 'request', label: '- $30', duration: 1.3, delay: 1.1 },
          { path: ['txA', 'db', 'row2'], tone: 'request', label: '+ $30', duration: 1.3, delay: 2.5 },
          { path: ['txA', 'db'], tone: 'handshake', label: 'COMMIT', duration: 0.8, delay: 3.9 },
          { path: ['db', 'txA', 'userA'], tone: 'response', label: 'sent', duration: 1.2, delay: 4.8 },
        ],
        panel: {
          title: 'Outcomes',
          icon: 'Receipt',
          rows: [
            { text: 'COMMIT', value: 'both saved', tone: 'good' },
            { text: 'ROLLBACK', value: 'neither saved', tone: 'muted' },
            { text: 'Crash before COMMIT', value: 'neither saved', tone: 'muted' },
            { text: 'Undo in app code', value: 'dies with the app', tone: 'bad' },
          ],
        },
        caption: 'Two writes, one commit',
      },
      code: {
        language: 'sql',
        title: 'A transfer as one transaction',
        source: `BEGIN;

UPDATE wallets SET balance = balance - 30 WHERE id = 1;
UPDATE wallets SET balance = balance + 30 WHERE id = 2;

COMMIT;   -- both updates become visible and durable together`,
        highlight: [1, 3, 4, 6],
      },
    },
    {
      title: 'Durability',
      tag: 'concept',
      heading: 'Durability: committed means it survives',
      eli5: 'Before the shopkeeper changes any page, she jots the change on a sticky note and keeps it in a safe drawer. If the lights go out, she reads the notes and finishes the job. That drawer is the **log**.',
      body: [
        'Once `COMMIT` returns, the change survives a power cut. The database first appends the change to a **write-ahead log** (WAL) and flushes it to disk. Only then does it say "committed".',
        'The data pages can be written later. After a crash the database replays the log: it redoes committed work and discards unfinished work. That same log is how atomicity survives a crash.',
      ],
      keyIdea: 'Log first, flush, then acknowledge. The log lets the database finish or undo work after a crash.',
      metrics: { level: 'read committed', anomaly: 'none', balance: '$70', cost: '1 log flush per commit' },
      scene: {
        nodes: [txA, { id: 'wal', kind: 'block', size: 0.72, at: p(0.2, -3.5), label: 'WAL', sub: 'append-only', icon: 'FileText', tint: 'violet' }, { ...db, at: p(3.2, 0.6), status: 'ok' }, { ...row1, at: p(6.2, -3.5) }],
        links: [link('txA', 'wal'), link('wal', 'db', { label: 'later', style: 'dashed' }), link('db', 'row1', { style: 'dashed' })],
        flows: [
          { path: ['txA', 'wal'], tone: 'handshake', label: 'COMMIT: flush', duration: 1.2 },
          { path: ['wal', 'txA'], tone: 'response', label: 'durable', duration: 1.2, delay: 1.4 },
          { path: ['wal', 'db', 'row1'], tone: 'data', label: 'apply later', duration: 1.6, delay: 3 },
        ],
        panel: {
          title: 'After a crash',
          icon: 'Repeat',
          rows: [
            { text: 'Committed, not yet on data page', value: 'redo', tone: 'good' },
            { text: 'Not committed', value: 'undo', tone: 'muted' },
          ],
          footer: { text: 'The log decides, not the data pages', tone: 'muted' },
        },
        caption: 'Write the log first',
      },
    },
    {
      title: 'Consistency',
      tag: 'concept',
      heading: 'Consistency: your rules hold at commit',
      eli5: 'The shop has a house rule: no page may show a negative number. If a change would break it, the shopkeeper refuses the whole bundle and rubs out the pencil.',
      body: [
        '**Consistency** means rules you declare hold when a transaction commits. A `CHECK (balance >= 0)`, a `UNIQUE` email or a foreign key to a real customer are all enforced by the database.',
        'If a statement breaks a rule, it fails and the transaction rolls back. This is the one letter that depends on you: the database enforces only the rules you wrote down.',
      ],
      keyIdea: 'Declare the rules as constraints. The database refuses any commit that would break them.',
      metrics: { level: 'read committed', anomaly: 'none', balance: '$20', cost: 'constraint check per write' },
      scene: {
        nodes: [txA, { ...db, status: 'active', badge: 'CHECK balance >= 0' }, { ...row1, status: 'hot', badge: '$20 - $30 = -$10' }],
        links: [link('txA', 'db'), link('db', 'row1', { style: 'dashed' })],
        flows: [
          { path: ['txA', 'db', 'row1'], tone: 'request', label: '- $30', duration: 1.4 },
          { path: ['db', 'txA'], tone: 'error', label: 'check failed: ROLLBACK', duration: 1.4, delay: 1.6 },
        ],
        panel: {
          title: 'Rules the database enforces',
          icon: 'Shield',
          rows: [
            { text: 'CHECK (balance >= 0)', value: 'no overdraft' },
            { text: 'UNIQUE (email)', value: 'one account each' },
            { text: 'FOREIGN KEY (owner_id)', value: 'real owner' },
          ],
          footer: { text: 'Break one and the txn rolls back', tone: 'warn' },
        },
        caption: 'The debit would break the rule',
      },
    },
    {
      title: 'Isolation',
      tag: 'concept',
      heading: 'Isolation: what others can see of you',
      eli5: 'Two shopkeepers use the same notebook at once. **Isolation** is the rule for how much of the other one\'s pencil marks you may see while they are still working.',
      body: [
        '**Isolation** is the fourth letter, and the one with settings. It decides what one running transaction can see of another. Perfect isolation makes concurrent transactions behave as if they ran one at a time.',
        'Perfect isolation is slow, so databases offer weaker levels. Each weaker level allows a few odd results called **anomalies**. The next four steps show them.',
      ],
      keyIdea: 'Isolation is a dial. Weaker settings run faster and allow anomalies.',
      metrics: { level: 'you choose', anomaly: 'depends on level', balance: '-', cost: 'rises with strictness' },
      scene: {
        nodes: [txA, txB, { ...db, status: 'active', badge: 'two txns, one row' }],
        links: twoLinks,
        flows: [
          { path: ['txA', 'db'], tone: 'request', label: 'A writes', duration: 1.2 },
          { path: ['txB', 'db', 'txB'], tone: 'request', label: 'B reads: sees what?', duration: 1.6, delay: 1.4 },
        ],
        panel: {
          title: 'The dial',
          icon: 'Gauge',
          rows: [
            { text: 'Loose', value: 'fast, odd results', tone: 'warn' },
            { text: 'Strict', value: 'safe, slower', tone: 'good' },
          ],
          footer: { text: 'Pick the loosest that stays correct', tone: 'muted' },
        },
        caption: 'How much of A should B see?',
      },
    },
    {
      title: 'Lost update',
      tag: 'case',
      heading: 'Case: two withdrawals, one disappears',
      eli5: 'Two shopkeepers both read "$100" in the notebook. One writes $70, the other writes $50 on top. The first change is gone, as if it never happened. That is a **lost update**.',
      body: [
        'Wallet 1 holds $100. Asha pays $30 while a subscription charges $50. Both transactions read the balance, compute in app code, and write back. A writes 70. B also read 100 and writes 50. Final balance **$50**, but it should be $20.',
        'Both transactions were atomic and both committed, so atomicity does not help. The bug is a read-modify-write cycle running twice on the same stale value. The simplest fix is `SET balance = balance - 30` in one statement.',
      ],
      keyIdea: 'Read, compute in the app, write back: if two transactions do this on one row, the later write erases the earlier one.',
      metrics: { level: 'read committed', anomaly: 'lost update', balance: '$50 (should be $20)', cost: '-' },
      metricTones: { anomaly: 'bad', balance: 'bad' },
      scene: {
        nodes: [userA, userB, { ...txA, status: 'active', chips: ['read 100', 'write 70'] }, { ...txB, status: 'hot', chips: ['read 100', 'write 50'] }, { ...db, status: 'hot', badge: 'balance = $50' }],
        links: [link('userA', 'txA'), link('userB', 'txB'), ...twoLinks],
        flows: [
          { path: ['txA', 'db', 'txA'], tone: 'request', label: 'read 100', duration: 1.2 },
          { path: ['txB', 'db', 'txB'], tone: 'request', label: 'read 100', duration: 1.2, delay: 0.2 },
          { path: ['txA', 'db'], tone: 'data', label: 'write 70', duration: 0.9, delay: 1.6 },
          { path: ['txB', 'db'], tone: 'error', label: 'write 50', duration: 0.9, delay: 2.7 },
        ],
        panel: {
          title: 'Timeline',
          icon: 'Clock',
          rows: [
            { text: 'A and B read', value: '100' },
            { text: 'A writes', value: '70' },
            { text: 'B writes', value: '50', tone: 'bad' },
          ],
          footer: { text: 'A\'s $30 debit is gone', tone: 'bad' },
        },
        caption: 'Both read the same old balance',
      },
    },
    {
      title: 'Dirty read',
      tag: 'concept',
      heading: 'Dirty read: seeing a change that never commits',
      eli5: 'Ben peeks at the pencil marks before they are inked. He sees "$20", but the shopkeeper rubs it out a moment later. Ben trusted a number that was never real. That is a **dirty read**.',
      body: [
        'Transaction A subtracts $80 from wallet 1 and has not committed. Transaction B reads **$20**. Then A fails a fraud check and rolls back. The balance is $100 again, but B already acted on a value that never officially existed.',
        'The weakest level, **read uncommitted**, allows this. **Read committed** shows a statement only data committed when it began. PostgreSQL does not implement dirty reads: asking for read uncommitted gives you read committed.',
      ],
      keyIdea: 'Read committed is the baseline: you never see another transaction\'s unfinished work.',
      metrics: { level: 'read uncommitted', anomaly: 'dirty read', balance: '$100 (B saw $20)', cost: 'lowest' },
      metricTones: { anomaly: 'bad' },
      scene: {
        nodes: [txA, txB, { ...db, status: 'active', badge: '$20 uncommitted' }],
        links: twoLinks,
        flows: [
          { path: ['txA', 'db'], tone: 'request', label: '- $80', duration: 1 },
          { path: ['txB', 'db'], tone: 'request', label: 'read', duration: 0.9, delay: 1.2 },
          { path: ['db', 'txB'], tone: 'error', label: '$20', duration: 0.9, delay: 2.2 },
          { path: ['txA', 'db'], tone: 'error', label: 'ROLLBACK', duration: 1, delay: 3.3 },
        ],
        panel: {
          title: 'Visibility by level',
          icon: 'Layers',
          rows: [
            { text: 'Read uncommitted', value: 'dirty reads', tone: 'bad' },
            { text: 'Read committed', value: 'committed only', tone: 'good' },
          ],
          footer: { text: 'Postgres has no read uncommitted', tone: 'muted' },
        },
        caption: 'B read a value that was rolled back',
      },
    },
    {
      title: 'Changing reads',
      tag: 'concept',
      heading: 'Non-repeatable read: same query, two answers',
      eli5: 'Ben reads "$100" and starts filling in a form. The shopkeeper inks a new number. Ben looks again and it says "$20". His form now mixes old and new numbers.',
      body: [
        'Under read committed each statement sees the latest committed data. B builds a statement and reads wallet 1: $100. A commits an $80 payment. B reads again for the footer: **$20**. Nothing was uncommitted, yet two reads in one transaction disagree.',
        'This is a **non-repeatable read**. It hurts reports, exports, backups and any check-then-act logic. **Repeatable read** fixes it by keeping one consistent view for the whole transaction.',
      ],
      keyIdea: 'Read committed gives each statement a fresh view, so one transaction can see two different committed states.',
      metrics: { level: 'read committed', anomaly: 'non-repeatable read', balance: '$20', cost: 'low' },
      metricTones: { anomaly: 'bad' },
      scene: {
        nodes: [txA, { ...txB, status: 'hot', chips: ['read $100', 'read $20'] }, { ...db, status: 'active', badge: 'balance = $20' }],
        links: twoLinks,
        flows: [
          { path: ['txB', 'db', 'txB'], tone: 'request', label: 'read: $100', duration: 1.3 },
          { path: ['txA', 'db'], tone: 'data', label: '- $80, COMMIT', duration: 1, delay: 1.5 },
          { path: ['txB', 'db'], tone: 'request', label: 'read again', duration: 0.9, delay: 2.7 },
          { path: ['db', 'txB'], tone: 'error', label: '$20', duration: 0.9, delay: 3.7 },
        ],
        panel: {
          title: 'Report in txn B',
          icon: 'Table',
          rows: [
            { text: 'Opening balance', value: '$100' },
            { text: 'A commits -$80', tone: 'muted' },
            { text: 'Closing balance', value: '$20', tone: 'bad' },
          ],
          footer: { text: 'Totals come from different moments', tone: 'bad' },
        },
        caption: 'Same row, same transaction, different value',
      },
    },
    {
      title: 'Phantoms',
      tag: 'concept',
      heading: 'Phantom: a row that was not there a moment ago',
      eli5: 'Ben counts the toy cars on the list: 9, so there is room for one more. While he writes his line, Asha adds hers too. Now there are 11 lines on a list meant for 10.',
      body: [
        'A workshop has 10 seats. A and B each run `SELECT count(*) FROM bookings WHERE workshop_id = 7` and get 9. A inserts. B counts again and gets 10: a new row matches a query B already ran. That is a **phantom**. If B inserts anyway, there are 11 bookings.',
        'A non-repeatable read is an existing row changing. A phantom is the set of matching rows changing. It is harder to prevent, because there is no row to lock. The double insert is a write-skew-by-phantom case that part 2 fixes.',
      ],
      keyIdea: 'A phantom is a new row that matches a query you already ran. Locking the rows you read does not stop it.',
      metrics: { level: 'read committed', anomaly: 'phantom (11 of 10 seats)', balance: '-', cost: 'low' },
      metricTones: { anomaly: 'bad' },
      scene: {
        nodes: [{ ...txA, chips: ['count 9', 'INSERT'] }, { ...txB, status: 'hot', chips: ['count 9', 'recount 10'] }, { ...db, sub: 'bookings', status: 'hot', badge: '11 rows, 10 seats' }],
        links: twoLinks,
        flows: [
          { path: ['txA', 'db', 'txA'], tone: 'request', label: 'count = 9', duration: 1.2 },
          { path: ['txB', 'db', 'txB'], tone: 'request', label: 'count = 9', duration: 1.2, delay: 0.2 },
          { path: ['txA', 'db'], tone: 'data', label: 'INSERT', duration: 0.9, delay: 1.6 },
          { path: ['txB', 'db'], tone: 'error', label: 'INSERT', duration: 0.9, delay: 2.7 },
        ],
        panel: {
          title: 'Workshop seats',
          icon: 'Users',
          rows: [
            { text: 'Capacity', value: '10' },
            { text: 'Both counted', value: '9' },
            { text: 'Recount in B', value: '10 (set changed)', tone: 'warn' },
            { text: 'After both insert', value: '11', tone: 'bad' },
          ],
        },
        caption: 'Each saw one free seat',
      },
    },
    {
      title: 'Four levels',
      tag: 'tradeoff',
      heading: 'The four isolation levels',
      eli5: 'The shop can set how strict the notebook rule is. The loosest lets anyone peek at pencil marks. The strictest makes it look as if shopkeepers took turns, one at a time.',
      body: [
        'The SQL standard names four levels, each closing another gap. **Read uncommitted** allows everything. **Read committed** stops dirty reads. **Repeatable read** also stops non-repeatable reads. **Serializable** also stops phantoms: the result matches some one-after-another order.',
        'Stronger levels cost more. The database holds more locks or tracks more reads, and it blocks or aborts more transactions. The app must retry an aborted one.',
      ],
      keyIdea: 'Each level up prevents one more anomaly and costs more blocking or more retries.',
      metrics: { level: 'you choose', anomaly: 'depends on level', balance: '-', cost: 'rises with level' },
      scene: {
        nodes: [txA, txB, { ...db, status: 'active', badge: 'SERIALIZABLE: as if one by one' }],
        links: twoLinks,
        flows: [
          { path: ['txA', 'db', 'txA'], tone: 'request', label: 'runs first', duration: 1.6 },
          { path: ['txB', 'db', 'txB'], tone: 'request', label: 'then B', duration: 1.6, delay: 1.8 },
        ],
        panel: {
          title: 'What each level stops',
          icon: 'Table',
          rows: [
            { text: 'Read uncommitted', value: 'nothing', tone: 'bad' },
            { text: 'Read committed', value: 'dirty read', tone: 'warn' },
            { text: 'Repeatable read', value: '+ non-repeatable', tone: 'warn' },
            { text: 'Serializable', value: '+ phantom', tone: 'good' },
          ],
        },
        caption: 'Serializable: the outcome matches some one-at-a-time order',
      },
      quiz: {
        question: 'A report transaction reads an account balance twice and gets two different committed values. Which is the lowest standard isolation level that prevents this?',
        options: ['Read uncommitted', 'Read committed', 'Repeatable read', 'Serializable'],
        answer: 2,
        explain: 'Two different committed values for the same row is a non-repeatable read. Read committed still allows it. Repeatable read is the first level that prevents it. Serializable also does, but it is not the lowest.',
      },
    },
    {
      title: 'Defaults',
      tag: 'tradeoff',
      heading: 'Defaults differ, and names hide differences',
      eli5: 'Each toy shop picks its own house rule on day one. Before you borrow someone\'s notebook, ask which rule they use.',
      body: [
        'PostgreSQL, Oracle and SQL Server default to read committed. MySQL InnoDB defaults to repeatable read. You can raise the level per transaction with `SET TRANSACTION ISOLATION LEVEL`.',
        'The same name can behave differently across products. PostgreSQL repeatable read is snapshot isolation, and MySQL repeatable read also locks some gaps. Check your database before relying on a level.',
      ],
      keyIdea: 'Know your database\'s default, and test what each level really does there.',
      metrics: { level: 'per database', anomaly: 'depends', balance: '-', cost: '-' },
      scene: {
        nodes: [
          { id: 'pg', kind: 'block', size: 0.72, at: p(-3.6, 0), label: 'Postgres', sub: 'read committed', icon: 'Database', tint: 'blue' },
          { id: 'my', kind: 'block', size: 0.72, at: p(0, 3.2), label: 'MySQL', sub: 'repeatable read', icon: 'Database', tint: 'amber' },
          { id: 'or', kind: 'block', size: 0.72, at: p(3.6, 0), label: 'Oracle', sub: 'read committed', icon: 'Database', tint: 'red' },
        ],
        panel: {
          title: 'Default level',
          icon: 'Layers',
          rows: [
            { text: 'PostgreSQL', value: 'read committed' },
            { text: 'Oracle', value: 'read committed' },
            { text: 'SQL Server', value: 'read committed' },
            { text: 'MySQL InnoDB', value: 'repeatable read' },
          ],
          footer: { text: 'Same name, different behavior', tone: 'warn' },
        },
        caption: 'Check before you rely on it',
      },
    },
    {
      title: 'Recap 1',
      tag: 'recap',
      heading: 'Part 1: guarantees and anomalies',
      eli5: 'Write the changes that belong together in one go, keep a log in the safe drawer, and decide how much of each other\'s pencil marks the shopkeepers may see.',
      body: [
        'A transaction gives atomicity (all or nothing), consistency (your constraints hold), durability (the log survives a crash) and isolation (a dial for concurrency).',
        'Anomalies, mild to strict: **dirty read**, **non-repeatable read**, **phantom**. **Lost update** from read-then-write logic is not in the four-level table. It is handled by atomic SQL, a lock, or a snapshot abort (PostgreSQL repeatable read does this). Part 2 covers snapshots, write skew, locks, deadlocks and retries.',
      ],
      keyIdea: 'Name the anomaly you fear, then pick the isolation level or lock that stops it.',
      metrics: { level: 'read committed', anomaly: 'lost update still possible', balance: '$20', cost: 'low' },
      metricTones: { anomaly: 'warn' },
      scene: {
        nodes: [userA, txA, { ...db, status: 'ok', badge: 'balance = $20' }, txB, userB],
        links: [link('userA', 'txA'), link('userB', 'txB'), ...twoLinks],
        flows: [
          { path: ['userA', 'txA', 'db'], tone: 'request', label: '- $30', duration: 1.4 },
          { path: ['db', 'txA', 'userA'], tone: 'response', duration: 1.4, delay: 1.5 },
          { path: ['userB', 'txB', 'db'], tone: 'request', label: '- $50', duration: 1.4, delay: 3 },
          { path: ['db', 'txB', 'userB'], tone: 'response', duration: 1.4, delay: 4.5 },
        ],
        panel: {
          title: 'Anomalies',
          icon: 'Bug',
          rows: [
            { text: 'Dirty read', value: 'read committed' },
            { text: 'Non-repeatable read', value: 'repeatable read' },
            { text: 'Phantom', value: 'serializable' },
            { text: 'Lost update (no level)', value: 'atomic SQL, lock, snapshot abort' },
          ],
          footer: { text: 'Top rows: level that first prevents each', tone: 'muted' },
        },
      },
      quiz: {
        question: 'Which guarantee lets the database undo a half-finished transfer after a crash?',
        options: ['Isolation, because it hides unfinished work', 'Atomicity, backed by the write-ahead log', 'Consistency, because balances must be positive', 'Durability alone, because commits are on disk'],
        answer: 1,
        explain: 'Atomicity means all or nothing. The write-ahead log gives the database what it needs to redo committed work and undo unfinished work after a crash.',
      },
    },
  ],
};
