import type { Lesson, SceneNode } from '../engine/types';

/** Place a node by screen column (x - y) and screen row (x + y). */
const p = (col: number, row: number): [number, number] => [(col + row) / 2, (row - col) / 2];

const userA: SceneNode = { id: 'userA', kind: 'phone', at: p(-6.5, -3.5), label: 'Asha' };
const userB: SceneNode = { id: 'userB', kind: 'phone', at: p(-6.5, 3.5), label: 'Ben' };
const txA: SceneNode = { id: 'txA', kind: 'server', at: p(-3.2, -3.5), label: 'txn A' };
const txB: SceneNode = { id: 'txB', kind: 'server', at: p(-3.2, 3.5), label: 'txn B' };
const db: SceneNode = { id: 'db', kind: 'db', at: p(0.6, 0), label: 'Postgres', sub: 'wallets' };
const row1: SceneNode = { id: 'row1', kind: 'storage', at: p(4.2, -3.5), label: 'wallet 1' };
const row2: SceneNode = { id: 'row2', kind: 'storage', at: p(4.2, 3.5), label: 'wallet 2' };

const twoLinks = [
  { from: 'userA', to: 'txA' },
  { from: 'userB', to: 'txB' },
  { from: 'txA', to: 'db' },
  { from: 'txB', to: 'db' },
];
const rowLinks = [
  { from: 'db', to: 'row1', style: 'dashed' as const },
  { from: 'db', to: 'row2', style: 'dashed' as const },
];

export const transactions: Lesson = {
  id: 'transactions',
  title: 'Transactions and isolation levels',
  tagline: 'Group writes so they all happen or none do, and learn what two transactions can see of each other.',
  minutes: 16,
  level: 'Intermediate',
  learn: [
    'What each letter of ACID promises',
    'The anomalies: lost update, dirty read, non-repeatable read, phantom',
    'The four isolation levels and what each one prevents',
    'Snapshot isolation (MVCC) and the write skew it still allows',
    'Pessimistic locks versus optimistic version checks',
    'How database deadlocks form and how to avoid them',
  ],
  metrics: [
    { key: 'level', label: 'Isolation' },
    { key: 'anomaly', label: 'Anomaly' },
    { key: 'balance', label: 'Wallet 1' },
    { key: 'cost', label: 'Cost' },
  ],
  steps: [
    {
      title: 'Half a transfer',
      tag: 'problem',
      heading: 'The crash between two updates',
      eli5: 'A toy shop keeps its money in a notebook. The shopkeeper crosses out $30 on one page, and the lights go out before she adds it to the other page. Now $30 is nowhere.',
      body: [
        'Asha sends $30 to Ben. The app runs two statements: subtract 30 from wallet 1, then add 30 to wallet 2. Each statement saves on its own.',
        'The app server crashes after the first statement. Wallet 1 went from $100 to $70. Wallet 2 never got its $30. The money has left one account and arrived nowhere, and nothing in the database says it happened.',
        'A second problem hides behind this one. Even without crashes, two requests that touch the same wallet at the same moment can overwrite each other. This lesson is about both: partial failure, and concurrency.',
      ],
      keyIdea: 'Several writes that belong together need a way to succeed or fail as one unit.',
      metrics: { level: 'none (autocommit)', anomaly: '$30 vanished', balance: '$70', cost: '-' },
      scene: {
        nodes: [userA, { ...txA, label: 'app server', status: 'down', badge: 'crashed mid-way' }, { ...db, status: 'hot' }, { ...row1, status: 'hot', badge: '$100 → $70' }, { ...row2, badge: 'still $50' }],
        links: [{ from: 'userA', to: 'txA' }, { from: 'txA', to: 'db' }, ...rowLinks],
        flows: [
          { path: ['userA', 'txA'], tone: 'request', label: 'send $30', duration: 1 },
          { path: ['txA', 'db', 'row1'], tone: 'request', label: '- $30', duration: 1.4, delay: 1.1 },
          { path: ['txA', 'db'], tone: 'error', label: '+ $30 never sent', duration: 1.4, delay: 2.8 },
        ],
        caption: 'Debit saved, credit lost',
      },
    },
    {
      title: 'ACID',
      tag: 'concept',
      heading: 'A transaction is all or nothing',
      eli5: 'The shopkeeper now writes both changes in pencil first. Only when both are down does she go over them in ink. If the lights go out, the pencil is rubbed away. That bundle is a **transaction**.',
      body: [
        'Wrap the two updates in `BEGIN` and `COMMIT`. The database treats them as one **transaction**. **Atomicity**: either both updates are saved or neither is. If the server crashes before `COMMIT`, the database rolls the debit back using its write-ahead log.',
        '**Consistency**: rules you declare, such as `CHECK (balance >= 0)` or a foreign key, hold when the transaction commits. **Durability**: once `COMMIT` returns, the change survives a power cut, because the log was flushed to disk first.',
        '**Isolation** is the fourth letter, and the one with settings. It decides what one running transaction can see of another. The rest of this lesson is about that letter.',
      ],
      keyIdea: 'ACID: all-or-nothing writes, rules that hold at commit, isolation between concurrent transactions, and commits that survive crashes.',
      metrics: { level: 'read committed', anomaly: 'none (one txn)', balance: '$70', cost: '1 log flush per commit' },
      scene: {
        nodes: [userA, { ...txA, status: 'active', badge: 'BEGIN … COMMIT' }, { ...db, status: 'ok', badge: 'both or neither' }, { ...row1, status: 'ok', badge: '$100 → $70' }, { ...row2, status: 'ok', badge: '$50 → $80' }],
        links: [{ from: 'userA', to: 'txA' }, { from: 'txA', to: 'db' }, ...rowLinks],
        flows: [
          { path: ['userA', 'txA'], tone: 'request', label: 'send $30', duration: 1 },
          { path: ['txA', 'db', 'row1'], tone: 'request', label: '- $30', duration: 1.3, delay: 1.1 },
          { path: ['txA', 'db', 'row2'], tone: 'request', label: '+ $30', duration: 1.3, delay: 2.5 },
          { path: ['txA', 'db'], tone: 'handshake', label: 'COMMIT', duration: 0.8, delay: 3.9 },
          { path: ['db', 'txA', 'userA'], tone: 'response', label: 'sent', duration: 1.2, delay: 4.8 },
        ],
        caption: 'Two writes, one commit',
      },
      code: {
        language: 'sql',
        title: 'A transfer as one transaction',
        source: `BEGIN;

UPDATE wallets SET balance = balance - 30 WHERE id = 1;
UPDATE wallets SET balance = balance + 30 WHERE id = 2;

-- A rule the database enforces for every transaction:
--   ALTER TABLE wallets ADD CHECK (balance >= 0);
-- If the debit would go negative, the statement fails
-- and the whole transaction is rolled back.

COMMIT;   -- both updates become visible and durable together`,
        highlight: [1, 3, 4, 11],
      },
    },
    {
      title: 'Lost update',
      tag: 'case',
      heading: 'Case: two withdrawals, one disappears',
      eli5: 'Two shopkeepers both read "$100" in the notebook. One writes $70, the other writes $50 on top. The first change is gone, as if it never happened. That is a **lost update**.',
      body: [
        'Wallet 1 holds $100. Asha pays $30 from her phone while a subscription charges $50 from the same wallet. Both transactions read the balance, compute the new value in app code, and write it back.',
        'Transaction A reads 100 and writes 70. Transaction B also read 100, before A committed, and writes 50. The final balance is **$50**. It should be $20. A\'s debit was overwritten: a **lost update**.',
        'Both transactions were atomic and both committed. Atomicity does not help here. The bug is the read-modify-write cycle running twice on the same stale value. The simplest fix is to let the database do the math in one statement: `SET balance = balance - 30`.',
      ],
      keyIdea: 'Read, compute in the app, write back: if two transactions do this on the same row, the later write erases the earlier one.',
      metrics: { level: 'read committed', anomaly: 'lost update', balance: '$50 (should be $20)', cost: '-' },
      scene: {
        nodes: [userA, userB, { ...txA, status: 'active', badge: 'read 100, write 70' }, { ...txB, status: 'hot', badge: 'read 100, write 50' }, { ...db, status: 'hot', badge: 'balance = $50' }],
        links: twoLinks,
        flows: [
          { path: ['txA', 'db', 'txA'], tone: 'request', label: 'read 100', duration: 1.2 },
          { path: ['txB', 'db', 'txB'], tone: 'request', label: 'read 100', duration: 1.2, delay: 0.2 },
          { path: ['txA', 'db'], tone: 'data', label: 'write 70', duration: 0.9, delay: 1.6 },
          { path: ['txB', 'db'], tone: 'error', label: 'write 50', duration: 0.9, delay: 2.7 },
        ],
        caption: 'Both read the same old balance',
      },
    },
    {
      title: 'Dirty read',
      tag: 'concept',
      heading: 'Dirty read: seeing a change that never commits',
      eli5: 'Ben peeks at the pencil marks before they are inked. He sees "$20", but the shopkeeper rubs it out a moment later. Ben trusted a number that was never real. That is a **dirty read**.',
      body: [
        'Transaction A subtracts $80 from wallet 1 and has not committed yet. Transaction B reads the balance and sees **$20**. Then A fails a fraud check and rolls back. The balance is $100 again.',
        'B has read a value that was never committed. If B declined a purchase or printed a statement from that $20, it acted on data that officially never existed. This is a **dirty read**.',
        'The weakest isolation level, **read uncommitted**, allows it. The next level, **read committed**, shows a statement only data that was committed when the statement began. Almost every database defaults to read committed or stronger. PostgreSQL does not even implement dirty reads: asking for read uncommitted gives you read committed.',
      ],
      keyIdea: 'Read committed is the baseline: you never see another transaction\'s unfinished work.',
      metrics: { level: 'read uncommitted', anomaly: 'dirty read', balance: '$100 (B saw $20)', cost: 'lowest' },
      scene: {
        nodes: [userA, userB, { ...txA, status: 'hot', badge: '- $80, then ROLLBACK' }, { ...txB, status: 'hot', badge: 'saw $20' }, { ...db, status: 'active', badge: '$20 uncommitted' }],
        links: twoLinks,
        flows: [
          { path: ['txA', 'db'], tone: 'request', label: '- $80', duration: 1 },
          { path: ['txB', 'db'], tone: 'request', label: 'read', duration: 0.9, delay: 1.2 },
          { path: ['db', 'txB'], tone: 'error', label: '$20', duration: 0.9, delay: 2.2 },
          { path: ['txA', 'db'], tone: 'error', label: 'ROLLBACK', duration: 1, delay: 3.3 },
        ],
        caption: 'B read a value that was rolled back',
      },
    },
    {
      title: 'Changing reads',
      tag: 'concept',
      heading: 'Non-repeatable read: the same query, two answers',
      eli5: 'Ben reads "$100" and starts filling in a form. The shopkeeper inks a new number. Ben looks again and it says "$20". His form now mixes old and new numbers.',
      body: [
        'Under read committed, each statement sees the latest committed data. Transaction B builds a monthly statement. It reads the balance of wallet 1: $100. Meanwhile transaction A commits an $80 payment. B reads the balance again to print the footer: **$20**.',
        'Nothing B saw was uncommitted, so this is no dirty read. But two reads inside one transaction disagree. This is a **non-repeatable read**. B\'s report shows an opening total and a closing total that come from different moments.',
        'It matters most for work that reads several things and expects them to fit together: reports, exports, backups, and any check-then-act logic. **Repeatable read** fixes it by keeping one consistent view for the whole transaction.',
      ],
      keyIdea: 'Read committed gives each statement a fresh view. A transaction that reads twice can see two different committed states.',
      metrics: { level: 'read committed', anomaly: 'non-repeatable read', balance: '$20', cost: 'low' },
      scene: {
        nodes: [userA, userB, { ...txA, status: 'active', badge: '- $80, COMMIT' }, { ...txB, status: 'hot', badge: 'read $100, then $20' }, { ...db, status: 'active', badge: 'balance = $20' }],
        links: twoLinks,
        flows: [
          { path: ['txB', 'db', 'txB'], tone: 'request', label: 'read: $100', duration: 1.3 },
          { path: ['txA', 'db'], tone: 'data', label: '- $80, COMMIT', duration: 1, delay: 1.5 },
          { path: ['txB', 'db'], tone: 'request', label: 'read again', duration: 0.9, delay: 2.7 },
          { path: ['db', 'txB'], tone: 'error', label: '$20', duration: 0.9, delay: 3.7 },
        ],
        caption: 'Same row, same transaction, different value',
      },
    },
    {
      title: 'Phantoms',
      tag: 'concept',
      heading: 'Phantom: a row that was not there a moment ago',
      eli5: 'Ben counts the toy cars on the list: 9, so there is room for one more. While he writes his line, Asha adds hers too. He counts again and finds 11 lines on a list meant for 10.',
      body: [
        'A workshop has 10 seats. Transaction B runs `SELECT count(*) FROM bookings WHERE workshop_id = 7` and gets 9. One seat left, so it prepares to insert a booking.',
        'Transaction A does the same and inserts first. If B repeats its count it now gets 10. A new row has appeared in the result of a query B already ran. That row is a **phantom**.',
        'A non-repeatable read is an existing row changing. A phantom is the set of matching rows changing. It is harder to prevent, because there is no existing row for B to lock: the conflict is with a row that did not exist yet. If both transactions insert, the workshop has 11 bookings.',
      ],
      keyIdea: 'A phantom is a new row that matches a query you already ran. Locking the rows you read does not stop it.',
      metrics: { level: 'read committed', anomaly: 'phantom (11 of 10 seats)', balance: '-', cost: 'low' },
      scene: {
        nodes: [userA, userB, { ...txA, status: 'active', badge: 'count 9, INSERT' }, { ...txB, status: 'hot', badge: 'count 9, INSERT' }, { ...db, sub: 'bookings', status: 'hot', badge: '11 rows, 10 seats' }],
        links: twoLinks,
        flows: [
          { path: ['txA', 'db', 'txA'], tone: 'request', label: 'count = 9', duration: 1.2 },
          { path: ['txB', 'db', 'txB'], tone: 'request', label: 'count = 9', duration: 1.2, delay: 0.2 },
          { path: ['txA', 'db'], tone: 'data', label: 'INSERT', duration: 0.9, delay: 1.6 },
          { path: ['txB', 'db'], tone: 'error', label: 'INSERT', duration: 0.9, delay: 2.7 },
        ],
        caption: 'Each saw one free seat',
      },
    },
    {
      title: 'Four levels',
      tag: 'tradeoff',
      heading: 'The four isolation levels',
      eli5: 'The shop can set how strict the notebook rule is. The loosest lets anyone peek at pencil marks. The strictest makes it look as if shopkeepers took turns, one at a time.',
      body: [
        'The SQL standard names four levels, each one closing another gap. **Read uncommitted** allows everything, dirty reads included. **Read committed** stops dirty reads. **Repeatable read** also stops non-repeatable reads. **Serializable** also stops phantoms: the result is the same as if the transactions had run one after another in some order.',
        'Stronger levels cost more. The database holds more locks or tracks more read and write sets, and it blocks or aborts more transactions. An aborted transaction must be retried by the application.',
        'Defaults differ. PostgreSQL, Oracle and SQL Server default to read committed. MySQL InnoDB defaults to repeatable read. The names also hide differences between products, so check what your database does at each level before relying on it.',
      ],
      keyIdea: 'Each level up prevents one more anomaly and costs more blocking or more retries. Know your database\'s default.',
      metrics: { level: 'you choose', anomaly: 'depends on level', balance: '-', cost: 'rises with level' },
      scene: {
        nodes: [userA, userB, { ...txA, status: 'active' }, { ...txB, status: 'active' }, { ...db, status: 'active', badge: 'SERIALIZABLE: as if one by one' }],
        links: twoLinks,
        flows: [
          { path: ['txA', 'db', 'txA'], tone: 'request', label: 'runs first', duration: 1.6 },
          { path: ['txB', 'db', 'txB'], tone: 'request', label: 'then B', duration: 1.6, delay: 1.8 },
        ],
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
      title: 'Snapshots',
      tag: 'concept',
      heading: 'Snapshot isolation: every transaction gets a photo',
      eli5: 'Each shopkeeper works from a photo of the notebook taken when they started. Nobody waits to read. But two of them can each make a change that looks fine in their own photo and wrong together.',
      body: [
        'Most databases build these levels on **MVCC** (multi-version concurrency control). An update does not overwrite a row. It writes a new version and keeps the old one for a while. Each transaction reads from a **snapshot**: the versions that were committed when it started.',
        'Readers never block writers and writers never block readers. A long report sees one frozen, consistent state while payments keep committing. This is **snapshot isolation**. PostgreSQL\'s repeatable read level is snapshot isolation. If two snapshot transactions update the same row, the second one fails with a serialization error and must retry, so lost updates are caught.',
        'One anomaly survives: **write skew**. Two transactions read the same data, then each writes a different row. The workshop double booking is this shape. Each snapshot showed 9 bookings and each insert was valid alone. True serializable isolation detects it and aborts one of them.',
      ],
      keyIdea: 'Snapshot isolation gives consistent reads without blocking, but two transactions can still break a rule by writing different rows.',
      metrics: { level: 'snapshot / serializable', anomaly: 'write skew caught at serializable', balance: '-', cost: 'retries on conflict' },
      scene: {
        nodes: [userA, userB, { ...txA, status: 'ok', badge: 'INSERT, COMMIT' }, { ...txB, status: 'hot', badge: 'aborted: retry' }, { ...db, sub: 'bookings', status: 'active', badge: 'row versions' }],
        links: twoLinks,
        flows: [
          { path: ['txA', 'db', 'txA'], tone: 'request', label: 'snapshot: 9', duration: 1.2 },
          { path: ['txB', 'db', 'txB'], tone: 'request', label: 'snapshot: 9', duration: 1.2, delay: 0.2 },
          { path: ['txA', 'db'], tone: 'data', label: 'INSERT ok', duration: 0.9, delay: 1.6 },
          { path: ['txB', 'db'], tone: 'request', label: 'INSERT', duration: 0.9, delay: 2.7 },
          { path: ['db', 'txB'], tone: 'error', label: 'serialization failure', duration: 0.9, delay: 3.7 },
        ],
        caption: 'Serializable aborts the second booking. The app retries and sees 10.',
      },
      code: {
        language: 'python',
        title: 'Serializable needs a retry loop',
        source: `def book_seat(workshop_id, user_id, retries=3):
    for attempt in range(retries):
        try:
            with db.transaction(isolation="serializable") as tx:
                taken = tx.query_value(
                    "SELECT count(*) FROM bookings WHERE workshop_id = %s",
                    workshop_id)
                if taken >= 10:
                    return "sold out"
                tx.execute(
                    "INSERT INTO bookings (workshop_id, user_id) VALUES (%s, %s)",
                    workshop_id, user_id)
            return "booked"
        except SerializationFailure:      # SQLSTATE 40001
            continue                      # rerun the whole transaction
    return "busy, try again"`,
        highlight: [4, 8, 14, 15],
      },
    },
    {
      title: 'Lock or check',
      tag: 'tradeoff',
      heading: 'Pessimistic locks or optimistic version checks',
      eli5: 'One way: put your hand on the page so nobody else can write until you finish. The other way: write freely, and check at the end that the page still looks the way you first saw it.',
      body: [
        '**Pessimistic locking** assumes a conflict will happen and blocks it up front. `SELECT ... FOR UPDATE` locks the row. A second transaction asking for the same row waits until the first commits, then reads the new balance. The lost update cannot happen. The cost is waiting, and a slow transaction holds everyone behind it.',
        '**Optimistic locking** assumes conflicts are rare. Nobody locks. Each row carries a `version` number. The update says "set the new value where the version is still the one I read". If someone else got there first, zero rows match, and the app rereads and retries.',
        'Use pessimistic locks when the same rows are fought over often and the transaction is short: a hot wallet, the last seats of a show. Use optimistic checks when conflicts are rare or the user thinks for a long time between read and write, such as an edit form. Never hold a row lock while waiting for a person.',
      ],
      keyIdea: 'Pessimistic locking makes the second writer wait. Optimistic locking lets it run and makes it retry if it lost.',
      metrics: { level: 'read committed + row lock', anomaly: 'none', balance: '$20', cost: 'B waits for A' },
      scene: {
        nodes: [userA, userB, { ...txA, status: 'ok', badge: 'holds row lock' }, { ...txB, status: 'active', badge: 'waits, then reads 70' }, { ...db, status: 'ok', badge: '100 → 70 → 20' }],
        links: twoLinks,
        flows: [
          { path: ['txA', 'db'], tone: 'handshake', label: 'FOR UPDATE', duration: 0.9 },
          { path: ['txB', 'db'], tone: 'handshake', label: 'FOR UPDATE (blocked)', duration: 2.4, delay: 0.4 },
          { path: ['txA', 'db'], tone: 'data', label: 'write 70, COMMIT', duration: 0.9, delay: 1.2 },
          { path: ['db', 'txB'], tone: 'response', label: 'lock granted: 70', duration: 0.9, delay: 3 },
          { path: ['txB', 'db'], tone: 'data', label: 'write 20', duration: 0.9, delay: 4 },
        ],
        caption: 'The second withdrawal waits for the first',
      },
      code: {
        language: 'sql',
        title: 'The same withdrawal, two ways',
        source: `-- Pessimistic: lock the row, then decide
BEGIN;
SELECT balance FROM wallets WHERE id = 1 FOR UPDATE;   -- others wait here
UPDATE wallets SET balance = balance - 30 WHERE id = 1;
COMMIT;

-- Optimistic: no lock, check the version on write
SELECT balance, version FROM wallets WHERE id = 1;     -- 100, version 7
UPDATE wallets
   SET balance = 70, version = version + 1
 WHERE id = 1 AND version = 7;
-- 1 row updated: we won.
-- 0 rows updated: someone changed it first. Reread and retry.`,
        highlight: [3, 11, 13],
      },
    },
    {
      title: 'Deadlock',
      tag: 'case',
      heading: 'Case: two transfers lock each other out',
      eli5: 'Asha holds page 1 and wants page 2. Ben holds page 2 and wants page 1. Neither will let go, so both wait forever, until the shop owner tells one of them to start over.',
      body: [
        'Asha sends $30 to Ben at the same moment Ben sends $10 to Asha. Transaction A locks wallet 1 and then asks for wallet 2. Transaction B has locked wallet 2 and asks for wallet 1. Each waits for a lock the other holds. This is a **deadlock**.',
        'The database notices. It keeps a graph of who waits for whom, finds the cycle, and aborts one transaction with a deadlock error. PostgreSQL checks after a lock wait of about one second by default. The survivor continues, and the app must retry the victim.',
        'Prevent it by **locking in a fixed order**. If every transfer locks the wallet with the smaller id first, A and B both ask for wallet 1 first, and one waits in line with no cycle. Keep transactions short, and set a lock timeout so a stuck one fails fast.',
      ],
      keyIdea: 'A deadlock is a cycle of lock waits. Take locks in one agreed order and the cycle cannot form.',
      metrics: { level: 'read committed + row locks', anomaly: 'deadlock: 1 txn aborted', balance: '$70', cost: 'retry the victim' },
      scene: {
        nodes: [userA, userB, { ...txA, status: 'hot', badge: 'has 1, wants 2' }, { ...txB, status: 'hot', badge: 'has 2, wants 1' }, { ...db, status: 'active', badge: 'cycle found' }, { ...row1, status: 'hot', badge: 'locked by A' }, { ...row2, status: 'hot', badge: 'locked by B' }],
        links: [...twoLinks, ...rowLinks],
        flows: [
          { path: ['txA', 'db', 'row1'], tone: 'handshake', label: 'lock 1', duration: 1.2 },
          { path: ['txB', 'db', 'row2'], tone: 'handshake', label: 'lock 2', duration: 1.2 },
          { path: ['txA', 'db', 'row2'], tone: 'error', label: 'wait for 2', duration: 1.4, delay: 1.4 },
          { path: ['txB', 'db', 'row1'], tone: 'error', label: 'wait for 1', duration: 1.4, delay: 1.4 },
          { path: ['db', 'txB'], tone: 'error', label: 'deadlock: abort B', duration: 1, delay: 3.2 },
        ],
        caption: 'Each holds what the other needs',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Pick the weakest level that keeps your rules true',
      eli5: 'Write the changes that belong together in one go, decide how strict the notebook rule must be, and when two shopkeepers bump into each other, one of them starts over.',
      body: [
        'A transaction makes a group of writes atomic and durable. Isolation decides what concurrent transactions see. The anomalies, from mild to strict: **dirty read** (uncommitted data), **non-repeatable read** (a row changes between reads), **phantom** (new rows appear), plus **lost update** and **write skew** from read-then-write logic.',
        'Read committed is the common default and stops only dirty reads. Snapshot isolation gives each transaction a consistent view without blocking readers. Serializable removes the remaining anomalies and asks you to retry aborted transactions.',
        'For a contested row, lock it with `SELECT ... FOR UPDATE` or check a version on write. Lock rows in a fixed order, keep transactions short, and always be ready to retry. All of this is inside one database. A write that spans two databases or services needs the tools in the distributed transactions lesson.',
      ],
      keyIdea: 'Know your default isolation level, name the anomaly you are guarding against, and choose a lock, a version check or a stricter level to stop it.',
      metrics: { level: 'read committed + row lock', anomaly: 'none', balance: '$20', cost: 'short waits, rare retries' },
      scene: {
        nodes: [userA, userB, { ...txA, status: 'ok' }, { ...txB, status: 'ok' }, { ...db, status: 'ok', badge: 'balance = $20' }],
        links: twoLinks,
        flows: [
          { path: ['userA', 'txA', 'db'], tone: 'request', label: '- $30', duration: 1.4 },
          { path: ['db', 'txA', 'userA'], tone: 'response', duration: 1.4, delay: 1.5 },
          { path: ['userB', 'txB', 'db'], tone: 'request', label: '- $50', duration: 1.4, delay: 3 },
          { path: ['db', 'txB', 'userB'], tone: 'response', duration: 1.4, delay: 4.5 },
        ],
      },
      quiz: {
        question: 'Two requests each read a wallet balance of $100, subtract in app code, and write the result. One debit vanishes. The database runs at read committed. Which change fixes it with the least cost?',
        options: [
          'Switch the whole database to read uncommitted',
          'Add a read replica for the balance reads',
          'Lock the row with SELECT ... FOR UPDATE before computing, or use UPDATE ... SET balance = balance - amount',
          'Increase the connection pool size',
        ],
        answer: 2,
        explain: 'This is a lost update. Locking the row makes the second request wait and read the new balance. Doing the math inside one UPDATE has the same effect, because the database applies it to the current row under a lock.',
      },
    },
  ],
};
