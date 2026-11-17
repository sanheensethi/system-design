import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place a node by screen column (x - y) and screen row (x + y). */
const p = (col: number, row: number): [number, number] => [(col + row) / 2, (row - col) / 2];

const txA: SceneNode = { id: 'txA', kind: 'block', size: 0.72, at: p(-3.2, -3.5), label: 'txn A', icon: 'Workflow', tint: 'blue' };
const txB: SceneNode = { id: 'txB', kind: 'block', size: 0.72, at: p(-3.2, 3.5), label: 'txn B', icon: 'Workflow', tint: 'amber' };
const db: SceneNode = { id: 'db', kind: 'db', at: p(0.6, 0), label: 'Postgres', sub: 'wallets' };
const row1: SceneNode = { id: 'row1', kind: 'storage', at: p(4.2, -3.5), label: 'wallet 1' };
const row2: SceneNode = { id: 'row2', kind: 'storage', at: p(4.2, 3.5), label: 'wallet 2' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });
const twoLinks = [link('txA', 'db'), link('txB', 'db')];
const rowLinks = [link('db', 'row1', { style: 'dashed' }), link('db', 'row2', { style: 'dashed' })];

export const transactionsPart2: Lesson = {
  id: 'transactions-part-2',
  title: 'Transactions and isolation levels (part 2)',
  tagline: 'Snapshots, write skew, serializable, locks, deadlocks and retries: how to keep concurrent writes correct.',
  minutes: 14,
  level: 'Intermediate',
  learn: [
    'Snapshot isolation (MVCC) and the write skew it still allows',
    'How serializable works and why the app must retry',
    'Pessimistic locks, optimistic version checks and atomic SQL',
    'Queue claiming with SKIP LOCKED',
    'How deadlocks form, how databases break them and how to avoid them',
    'Keeping transactions short, and savepoints',
  ],
  metrics: [
    { key: 'level', label: 'Isolation', icon: 'Layers' },
    { key: 'anomaly', label: 'Anomaly', icon: 'Bug' },
    { key: 'balance', label: 'Wallet 1', icon: 'Database' },
    { key: 'cost', label: 'Cost', icon: 'Timer' },
  ],
  steps: [
    {
      title: 'Snapshots',
      tag: 'concept',
      heading: 'MVCC: every transaction gets a photo',
      eli5: 'Each shopkeeper works from a photo of the notebook taken when they started. Nobody waits to read, because the photo never changes under you.',
      body: [
        'Most databases build their levels on **MVCC** (multi-version concurrency control). An update does not overwrite a row. It writes a new version and keeps the old one for a while.',
        'Each read uses a **snapshot** of committed versions, taken once per transaction at repeatable read and above, and once per statement at read committed (hence the non-repeatable read in part 1). Readers never block writers and writers never block readers.',
      ],
      keyIdea: 'Updates add row versions. Each read uses a snapshot of committed versions: per transaction at repeatable read and above, per statement at read committed.',
      metrics: { level: 'snapshot', anomaly: 'none for reads', balance: 'v1 $100, v2 $20', cost: 'old versions to clean up' },
      metricTones: { anomaly: 'good' },
      scene: {
        nodes: [{ ...txA, chips: ['writes v2'] }, { ...txB, chips: ['reads v1'] }, { ...db, status: 'active', badge: 'v1: $100 · v2: $20' }],
        links: twoLinks,
        flows: [
          { path: ['txA', 'db'], tone: 'data', label: 'new version v2', duration: 1.2 },
          { path: ['txB', 'db', 'txB'], tone: 'request', label: 'read: v1 = $100', duration: 1.6, delay: 1.4 },
        ],
        panel: {
          title: 'Row versions',
          icon: 'Layers',
          rows: [
            { text: 'v1: $100', value: 'visible to B', tone: 'good' },
            { text: 'v2: $20', value: 'committed after B began', tone: 'muted' },
          ],
          footer: { text: 'Old versions are cleaned up later (vacuum)', tone: 'muted' },
        },
        caption: 'B keeps reading its own photo',
      },
    },
    {
      title: 'Snapshot level',
      tag: 'concept',
      heading: 'Snapshot isolation gives a stable view',
      eli5: 'If two shopkeepers each change the same page from their own photo, the notebook lets the first one finish and tells the second one to start over.',
      body: [
        '**Snapshot isolation** is what PostgreSQL calls repeatable read. Every read in a transaction sees one consistent state, so reads are stable and a repeated query returns the same rows. Write skew (count, then insert) still gets through.',
        'In PostgreSQL, if two snapshot transactions update the same row, the second one fails with a serialization error and must retry. This is the PostgreSQL first-updater-wins rule. MySQL InnoDB repeatable read does not abort it, so there you need `FOR UPDATE` or atomic SQL.',
      ],
      keyIdea: 'A snapshot gives one stable view. PostgreSQL also aborts the loser of a same-row race. MySQL does not.',
      metrics: { level: 'snapshot (repeatable read)', anomaly: 'lost update caught (PostgreSQL)', balance: '$70', cost: 'retry on conflict' },
      metricTones: { anomaly: 'good', cost: 'warn' },
      scene: {
        nodes: [{ ...txA, status: 'ok', chips: ['read 100', 'write 70'] }, { ...txB, status: 'hot', chips: ['read 100', 'write 50'] }, { ...db, status: 'active' }],
        links: twoLinks,
        flows: [
          { path: ['txA', 'db'], tone: 'data', label: 'write 70, COMMIT', duration: 1.2 },
          { path: ['txB', 'db'], tone: 'request', label: 'write 50', duration: 1, delay: 1.5 },
          { path: ['db', 'txB'], tone: 'error', label: 'could not serialize: retry', duration: 1.4, delay: 2.6 },
        ],
        panel: {
          title: 'Same row race',
          icon: 'Scale',
          rows: [
            { text: 'First writer', value: 'commits', tone: 'good' },
            { text: 'Second writer', value: 'serialization error', tone: 'warn' },
          ],
          footer: { text: 'PostgreSQL: 40001, rerun the whole transaction', tone: 'muted' },
        },
        caption: 'The second writer is told to retry',
      },
    },
    {
      title: 'Write skew',
      tag: 'case',
      heading: 'Write skew: two rows, one broken rule',
      eli5: 'The shop needs at least one shopkeeper on duty. Asha and Ben each look at their photo, see the other one is on duty, and each go home. Nobody is left.',
      body: [
        'Rule: at least one doctor on call. Alice and Bob are both on. Each transaction checks that the other is on call, then sets its own doctor off. Different rows, so snapshot isolation sees no conflict.',
        'Both commit and nobody is on call. This is **write skew**, the same shape as the part 1 seat count.',
        'Fixes: run at **serializable**, lock the rows you read with `FOR UPDATE` (next steps), or design the rule into the data with a constraint.',
      ],
      keyIdea: 'Write skew: both transactions read the same data, then write different rows, and together they break a rule.',
      metrics: { level: 'snapshot', anomaly: 'write skew', balance: '-', cost: 'rule broken' },
      metricTones: { anomaly: 'bad' },
      scene: {
        nodes: [{ ...txA, chips: ['Alice off call'] }, { ...txB, chips: ['Bob off call'] }, { ...db, sub: 'doctors', status: 'hot', badge: '0 on call' }],
        links: twoLinks,
        flows: [
          { path: ['txA', 'db', 'txA'], tone: 'request', label: 'others on call: 1', duration: 1.2 },
          { path: ['txB', 'db', 'txB'], tone: 'request', label: 'others on call: 1', duration: 1.2, delay: 0.2 },
          { path: ['txA', 'db'], tone: 'data', label: 'UPDATE alice', duration: 0.9, delay: 1.6 },
          { path: ['txB', 'db'], tone: 'error', label: 'UPDATE bob', duration: 0.9, delay: 2.7 },
        ],
        panel: {
          title: 'Rule: at least 1 on call',
          icon: 'Users',
          rows: [
            { text: 'A sees Bob on call', value: 'goes off', tone: 'warn' },
            { text: 'B sees Alice on call', value: 'goes off', tone: 'warn' },
            { text: 'After both commit', value: '0 on call', tone: 'bad' },
          ],
        },
        caption: 'Each snapshot looked safe',
      },
    },
    {
      title: 'Serializable',
      tag: 'concept',
      heading: 'Serializable stops write skew',
      eli5: 'At the strictest setting, the notebook watches what each shopkeeper looked at. If two jobs could not have happened one after the other, it sends one of them back to start over.',
      body: [
        '**Serializable** makes the outcome equal to some order of running the transactions one at a time. Databases get there two ways. Lock-based (two-phase locking) makes readers and writers wait. PostgreSQL uses **serializable snapshot isolation**, which tracks what each transaction read and aborts one when it finds a dangerous pattern.',
        'Either way, some transactions are aborted or blocked. Expect more retries than at lower levels.',
      ],
      keyIdea: 'Serializable removes write skew and phantoms by blocking or aborting, so the app must retry.',
      metrics: { level: 'serializable', anomaly: 'write skew caught', balance: '-', cost: 'aborts and retries' },
      metricTones: { anomaly: 'good', cost: 'warn' },
      scene: {
        nodes: [{ ...txA, status: 'ok', badge: 'COMMIT' }, { ...txB, status: 'hot', badge: 'aborted: retry' }, { ...db, sub: 'doctors', status: 'active' }],
        links: twoLinks,
        flows: [
          { path: ['txA', 'db'], tone: 'data', label: 'UPDATE alice, COMMIT', duration: 1.2 },
          { path: ['txB', 'db'], tone: 'request', label: 'UPDATE bob', duration: 0.9, delay: 1.5 },
          { path: ['db', 'txB'], tone: 'error', label: 'serialization failure', duration: 1.2, delay: 2.5 },
        ],
        panel: {
          title: 'Two ways to serialize',
          icon: 'Scale',
          rows: [
            { text: 'Two-phase locking', value: 'wait on locks' },
            { text: 'SSI (PostgreSQL)', value: 'abort on conflict' },
          ],
          footer: { text: 'The retry sees Alice already off call', tone: 'muted' },
        },
        caption: 'The second doctor is refused',
      },
      quiz: {
        question: 'Two on-call doctors each check that the other is on call, then each marks themself off call. Both commit under snapshot isolation. What happened, and what stops it?',
        options: ['A dirty read, stopped by read committed', 'A lost update, stopped by snapshot isolation', 'Write skew, stopped by serializable or by locking the rows that were read', 'A deadlock, stopped by a lock timeout'],
        answer: 2,
        explain: 'Each transaction wrote a different row, so snapshot isolation sees no conflict. That is write skew. Serializable aborts one of them, or the app can lock the rows it read with FOR UPDATE.',
      },
    },
    {
      title: 'Retry loop',
      tag: 'concept',
      heading: 'Serializable needs a retry loop',
      eli5: 'When the notebook sends you back to start over, you do the whole job again from the first line. You do not just redo the last line.',
      body: [
        'An aborted transaction rolled back everything. The app must rerun the whole transaction, including its reads, because the old reads may now be stale.',
        'Cap the retries and add a short random delay, so two colliding transactions do not collide again at the same instant. Only retry errors that mean conflict (`40001`, deadlock), never a constraint failure.',
      ],
      keyIdea: 'Retry the whole transaction on conflict errors, with a cap and a small jitter.',
      metrics: { level: 'serializable', anomaly: 'none', balance: '-', cost: 'rare retries' },
      scene: {
        nodes: [{ ...txA, status: 'active', chips: ['attempt 1: 40001', 'attempt 2: COMMIT'] }, { ...db, status: 'ok' }],
        links: [link('txA', 'db')],
        flows: [
          { path: ['txA', 'db'], tone: 'error', label: 'attempt 1: 40001', duration: 1.2 },
          { path: ['txA', 'db'], tone: 'data', label: 'attempt 2: COMMIT', duration: 1.2, delay: 1.6 },
        ],
        panel: {
          title: 'Retry rules',
          icon: 'Repeat',
          rows: [
            { text: 'Conflict or deadlock', value: 'retry', tone: 'good' },
            { text: 'Constraint violation', value: 'do not retry', tone: 'bad' },
            { text: 'Attempts', value: 'cap at 3' },
          ],
        },
        caption: 'Rerun the whole transaction',
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
            time.sleep(random.uniform(0.01, 0.1))   # jitter
            continue                      # rerun the whole transaction
    return "busy, try again"`,
        highlight: [4, 8, 14, 15, 16],
      },
      quiz: {
        question: 'A booking transaction fails with SQLSTATE 40001 at serializable. Which response is correct?',
        options: ['Resume from the failed statement, since earlier statements were saved', 'Rerun the whole transaction, reads included, with a cap on attempts', 'Retry the same transaction, and also retry unique-key violations', 'Give up at once, since 40001 means a bug'],
        answer: 1,
        explain: 'An abort rolls back everything, and the old reads may be stale, so rerun the whole transaction. Retry conflict errors such as 40001 and deadlocks, with a cap and jitter. A constraint violation will fail again, so do not retry it.',
      },
    },
    {
      title: 'Pessimistic',
      tag: 'tradeoff',
      heading: 'Pessimistic locking: make the second writer wait',
      eli5: 'One way: put your hand on the page so nobody else can write until you finish. The next shopkeeper waits, then reads the new number.',
      body: [
        '**Pessimistic locking** assumes a conflict will happen and blocks it up front. `SELECT ... FOR UPDATE` locks the row. A second transaction asking for it waits until the first commits, then reads the new balance. The lost update cannot happen.',
        'The cost is waiting, and a slow transaction holds everyone behind it. Use it when the same rows are fought over often and the transaction is short: a hot wallet, the last seats of a show.',
      ],
      keyIdea: 'FOR UPDATE makes the second writer wait and then read fresh data.',
      metrics: { level: 'read committed + row lock', anomaly: 'none', balance: '$20', cost: 'B waits for A' },
      metricTones: { anomaly: 'good', cost: 'warn' },
      scene: {
        nodes: [{ ...txA, status: 'ok', badge: 'holds row lock' }, { ...txB, status: 'active', badge: 'waits, then reads 70' }, { ...db, status: 'ok', badge: '100 → 70 → 20' }],
        links: twoLinks,
        flows: [
          { path: ['txA', 'db'], tone: 'handshake', label: 'FOR UPDATE', duration: 0.9 },
          { path: ['txB', 'db'], tone: 'handshake', label: 'FOR UPDATE (blocked)', duration: 2.4, delay: 0.4 },
          { path: ['txA', 'db'], tone: 'data', label: 'write 70, COMMIT', duration: 0.9, delay: 1.2 },
          { path: ['db', 'txB'], tone: 'response', label: 'lock granted: 70', duration: 0.9, delay: 3 },
          { path: ['txB', 'db'], tone: 'data', label: 'write 20', duration: 0.9, delay: 4 },
        ],
        panel: {
          title: 'The cost of waiting',
          icon: 'Timer',
          rows: [
            { text: 'Conflict handling', value: 'block up front', tone: 'good' },
            { text: 'Slow transaction', value: 'queue builds', tone: 'warn' },
            { text: 'Held while user thinks', value: 'never', tone: 'bad' },
          ],
        },
        caption: 'The second withdrawal waits for the first',
      },
      code: {
        language: 'sql',
        title: 'Pessimistic: lock the row, then decide',
        source: `BEGIN;
SELECT balance FROM wallets WHERE id = 1 FOR UPDATE;   -- others wait here
UPDATE wallets SET balance = balance - 30 WHERE id = 1;
COMMIT;`,
        highlight: [2],
      },
    },
    {
      title: 'Optimistic',
      tag: 'tradeoff',
      heading: 'Optimistic locking: check the version on write',
      eli5: 'The other way: write freely, and at the end check that the page still looks the way you first saw it. If not, read it again and redo your change.',
      body: [
        '**Optimistic locking** assumes conflicts are rare. Nobody locks. Each row carries a `version` number. The update says "set the new value where the version is still the one I read". If someone got there first, zero rows match, and the app rereads and retries.',
        'It suits conflicts that are rare, or a user who thinks for a long time between read and write, such as an edit form. Never hold a row lock while waiting for a person.',
      ],
      keyIdea: 'Optimistic locking lets everyone run and makes the loser retry. Zero rows updated means you lost.',
      metrics: { level: 'read committed + version', anomaly: 'none', balance: '$70', cost: 'retry on conflict' },
      scene: {
        nodes: [{ ...txA, status: 'ok', chips: ['version 7 → 8'] }, { ...txB, status: 'hot', chips: ['version 7: 0 rows'] }, { ...db, status: 'active', badge: 'version = 8' }],
        links: twoLinks,
        flows: [
          { path: ['txA', 'db'], tone: 'data', label: 'WHERE version = 7: 1 row', duration: 1.2 },
          { path: ['txB', 'db'], tone: 'request', label: 'WHERE version = 7', duration: 1, delay: 1.5 },
          { path: ['db', 'txB'], tone: 'error', label: '0 rows: reread, retry', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'Lock or check',
          icon: 'Scale',
          rows: [
            { text: 'Pessimistic', value: 'wait, no retries' },
            { text: 'Optimistic', value: 'no wait, retries' },
            { text: 'Contended hot row', value: 'pessimistic', tone: 'good' },
            { text: 'Rare conflicts, slow user', value: 'optimistic', tone: 'good' },
          ],
        },
        caption: 'The late writer matches zero rows',
      },
      code: {
        language: 'sql',
        title: 'Optimistic: no lock, check the version on write',
        source: `SELECT balance, version FROM wallets WHERE id = 1;     -- 100, version 7
UPDATE wallets
   SET balance = 70, version = version + 1
 WHERE id = 1 AND version = 7;
-- 1 row updated: we won.
-- 0 rows updated: someone changed it first. Reread and retry.`,
        highlight: [4, 6],
      },
    },
    {
      title: 'Atomic SQL',
      tag: 'concept',
      heading: 'Often no lock is needed at all',
      eli5: 'Instead of reading the number, doing sums in your head and writing it back, tell the notebook "take 30 off". The notebook does it on the page itself.',
      body: [
        'A single statement such as `UPDATE wallets SET balance = balance - 30 WHERE id = 1 AND balance >= 30` reads and writes under the row lock the database takes anyway. No lost update, no extra round trip.',
        'A `UNIQUE` constraint does the same for "only one of these": a unique key on `(workshop_id, seat_no)` rejects the second booking of a seat. Prefer these over app-side checks.',
      ],
      keyIdea: 'Push the check into one statement or a constraint. The database does it atomically.',
      metrics: { level: 'read committed', anomaly: 'none', balance: '$20', cost: 'cheapest fix' },
      metricTones: { anomaly: 'good', cost: 'good' },
      scene: {
        nodes: [txA, txB, { ...db, status: 'ok', badge: 'balance = balance - 30' }],
        links: twoLinks,
        flows: [
          { path: ['txA', 'db'], tone: 'data', label: 'balance - 30', duration: 1.2 },
          { path: ['txB', 'db'], tone: 'data', label: 'balance - 50', duration: 1.2, delay: 1.5 },
          { path: ['db', 'txB'], tone: 'response', label: '1 row, $20 left', duration: 1.2, delay: 2.8 },
        ],
        panel: {
          title: 'Atomic in one statement',
          icon: 'Code',
          code: 'UPDATE wallets\n   SET balance = balance - 30\n WHERE id = 1\n   AND balance >= 30;\n-- 0 rows: not enough money',
          footer: { text: 'No read-modify-write in app code', tone: 'good' },
        },
        caption: 'The database does the math',
      },
    },
    {
      title: 'Queue claim',
      tag: 'case',
      heading: 'Case: many workers claiming jobs',
      eli5: 'Ten helpers grab toys from one pile. Each one takes a toy nobody else is holding and ignores toys already in someone\'s hands, so nobody waits.',
      body: [
        'Workers poll a `jobs` table for the next job. With plain `FOR UPDATE`, all workers queue on the first row and run one at a time.',
        '`FOR UPDATE SKIP LOCKED` makes each worker take the first row nobody has locked. The claim must also mark the row taken, in the same statement. Otherwise the lock vanishes at commit and the row is still `new`, so another worker claims it again. The state change commits with the claim, so a taken job is never offered twice.',
      ],
      keyIdea: 'SKIP LOCKED turns row locks into a work queue where each worker gets a different row.',
      metrics: { level: 'read committed + row lock', anomaly: 'none', balance: '-', cost: 'no waiting' },
      metricTones: { cost: 'good' },
      scene: {
        nodes: [
          { id: 'w1', kind: 'worker', at: p(-4, -3), label: 'worker 1', chips: ['job 41'] },
          { id: 'w2', kind: 'worker', at: p(-4, 3), label: 'worker 2', chips: ['job 42'] },
          { ...db, sub: 'jobs', status: 'ok' },
        ],
        links: [link('w1', 'db'), link('w2', 'db')],
        flows: [
          { path: ['w1', 'db'], tone: 'handshake', label: 'claim: job 41', duration: 1.2 },
          { path: ['w2', 'db'], tone: 'handshake', label: 'skip 41, claim 42', duration: 1.2, delay: 0.3 },
        ],
        panel: {
          title: 'Claim query',
          icon: 'Code',
          code: 'UPDATE jobs SET state = \'running\'\n WHERE id = (\n  SELECT id FROM jobs\n  WHERE state = \'new\'\n  ORDER BY id LIMIT 1\n  FOR UPDATE SKIP LOCKED)\nRETURNING id;',
          footer: { text: 'Locked rows are skipped, not waited on', tone: 'good' },
        },
        caption: 'Each worker gets a different job',
      },
    },
    {
      title: 'Deadlock',
      tag: 'case',
      heading: 'Case: two transfers lock each other out',
      eli5: 'Asha holds page 1 and wants page 2. Ben holds page 2 and wants page 1. Neither will let go, so both wait forever, until the shop owner tells one of them to start over.',
      body: [
        'Asha sends $30 to Ben while Ben sends $10 to Asha. A locks wallet 1 and asks for wallet 2. B has locked wallet 2 and asks for wallet 1. Each waits for a lock the other holds. This is a **deadlock**.',
        'The database keeps a graph of who waits for whom, finds the cycle, and aborts one transaction with a deadlock error. PostgreSQL checks after a lock wait of about one second by default. The survivor continues and the app retries the victim.',
      ],
      keyIdea: 'A deadlock is a cycle of lock waits. The database breaks it by aborting one transaction.',
      metrics: { level: 'read committed + row locks', anomaly: 'deadlock: 1 txn aborted', balance: '$70', cost: 'retry the victim' },
      metricTones: { anomaly: 'bad', cost: 'warn' },
      scene: {
        nodes: [{ ...txA, status: 'hot', badge: 'has 1, wants 2' }, { ...txB, status: 'hot', badge: 'has 2, wants 1' }, { ...db, status: 'active', badge: 'cycle found' }, { ...row1, status: 'hot', badge: 'locked by A' }, { ...row2, status: 'hot', badge: 'locked by B' }],
        links: [...twoLinks, ...rowLinks],
        flows: [
          { path: ['txA', 'db', 'row1'], tone: 'handshake', label: 'lock 1', duration: 1.2 },
          { path: ['txB', 'db', 'row2'], tone: 'handshake', label: 'lock 2', duration: 1.2 },
          { path: ['txA', 'db', 'row2'], tone: 'error', label: 'wait for 2', duration: 1.4, delay: 1.4 },
          { path: ['txB', 'db', 'row1'], tone: 'error', label: 'wait for 1', duration: 1.4, delay: 1.4 },
          { path: ['db', 'txB'], tone: 'error', label: 'deadlock: abort B', duration: 1, delay: 3.2 },
        ],
        panel: {
          title: 'Wait-for graph',
          icon: 'Network',
          rows: [
            { text: 'A holds wallet 1', value: 'wants 2', tone: 'warn' },
            { text: 'B holds wallet 2', value: 'wants 1', tone: 'warn' },
            { text: 'Cycle', value: 'abort one', tone: 'bad' },
          ],
        },
        caption: 'Each holds what the other needs',
      },
    },
    {
      title: 'Avoid deadlock',
      tag: 'concept',
      heading: 'Lock in one agreed order',
      eli5: 'Make a house rule: always ask for the lower-numbered page first. Now both shopkeepers reach for page 1 first, so one simply waits in line.',
      body: [
        'Prevent deadlocks by **locking in a fixed order**. If every transfer locks the wallet with the smaller id first, A and B both ask for wallet 1 first. One waits in line and no cycle can form.',
        'Keep transactions short and set a lock timeout so a stuck one fails fast. Still retry on a deadlock error, because other code paths may lock in another order.',
      ],
      keyIdea: 'Take locks in one agreed order and the cycle cannot form.',
      metrics: { level: 'read committed + ordered locks', anomaly: 'none', balance: '$70', cost: 'short wait' },
      metricTones: { anomaly: 'good' },
      scene: {
        nodes: [{ ...txA, status: 'ok', badge: 'locks 1, then 2' }, { ...txB, status: 'active', badge: 'waits for 1' }, { ...db, status: 'ok' }, { ...row1, status: 'ok', badge: 'locked by A' }, row2],
        links: [...twoLinks, ...rowLinks],
        flows: [
          { path: ['txA', 'db', 'row1'], tone: 'handshake', label: 'lock 1 (lower id)', duration: 1.2 },
          { path: ['txB', 'db', 'row1'], tone: 'handshake', label: 'lock 1: waits', duration: 2, delay: 0.4 },
          { path: ['txA', 'db', 'row2'], tone: 'data', label: 'lock 2, COMMIT', duration: 1.2, delay: 1.6 },
        ],
        panel: {
          title: 'Deadlock checklist',
          icon: 'Shield',
          rows: [
            { text: 'Lock rows by ascending id', tone: 'good' },
            { text: 'Keep transactions short', tone: 'good' },
            { text: 'Set lock_timeout', tone: 'good' },
            { text: 'Retry on deadlock error', tone: 'good' },
          ],
        },
        caption: 'One order, no cycle',
      },
    },
    {
      title: 'Short and safe',
      tag: 'tradeoff',
      heading: 'Keep transactions short',
      eli5: 'The longer a shopkeeper keeps a hand on a page, the longer everyone else waits. Do the thinking first, then grab the page, write and let go.',
      body: [
        'A long transaction holds locks and keeps old row versions alive, which bloats the table. Never wait for a person, a network call or a slow job inside one. Do that work before `BEGIN` or after `COMMIT`.',
      ],
      keyIdea: 'Open late, close early, and keep slow work outside the transaction.',
      metrics: { level: 'any', anomaly: 'none', balance: '-', cost: 'locks held for ms, not seconds' },
      metricTones: { cost: 'good' },
      scene: {
        nodes: [{ ...txA, status: 'hot', badge: 'open 2.1 s' }, { id: 'ext', kind: 'block', size: 0.72, at: p(-3.2, 3.5), label: 'payment API', sub: 'slow call', icon: 'Globe', tint: 'red' }, { ...db, status: 'hot', badge: 'locks held, bloat' }],
        links: [link('txA', 'db'), link('txA', 'ext', { label: '2 s call inside txn', labelTone: 'warn' })],
        flows: [
          { path: ['txA', 'ext', 'txA'], tone: 'request', label: 'slow call while locked', duration: 2 },
          { path: ['txA', 'db'], tone: 'data', label: 'late COMMIT', duration: 1.2, delay: 2.2 },
        ],
        panel: {
          title: 'Where slow work goes',
          icon: 'Timer',
          rows: [
            { text: 'Payment API call', value: 'before BEGIN', tone: 'good' },
            { text: 'Inside the txn', value: 'short writes only', tone: 'good' },
            { text: 'Waiting on a person', value: 'never inside', tone: 'bad' },
          ],
          footer: { text: 'Call the API before BEGIN', tone: 'warn' },
        },
        caption: 'Slow work inside a transaction hurts everyone',
      },
    },
    {
      title: 'Savepoints',
      tag: 'concept',
      heading: 'Savepoints: undo one step, keep the rest',
      eli5: 'The shopkeeper pencils in a small bookmark. If the next line goes wrong she rubs out back to the bookmark and keeps everything above it.',
      body: [
        'A **savepoint** marks a point inside a transaction. `ROLLBACK TO` undoes only the work after it, so one failed step does not throw away the rest.',
        'In PostgreSQL a failed statement aborts the whole transaction unless you wrapped it in a savepoint. The order insert below survives the failed coupon update.',
      ],
      keyIdea: 'A savepoint lets one failed step roll back alone while the transaction continues.',
      metrics: { level: 'any', anomaly: 'none', balance: '-', cost: 'one extra round trip' },
      scene: {
        nodes: [{ ...txA, status: 'active', chips: ['order kept', 'coupon undone'] }, { ...db, sub: 'orders', status: 'ok' }],
        links: [link('txA', 'db')],
        flows: [
          { path: ['txA', 'db'], tone: 'data', label: 'INSERT order', duration: 1 },
          { path: ['txA', 'db'], tone: 'error', label: 'coupon update fails', duration: 1, delay: 1.3 },
          { path: ['txA', 'db'], tone: 'handshake', label: 'ROLLBACK TO coupon, COMMIT', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'Savepoint',
          icon: 'Code',
          code: 'BEGIN;\nINSERT INTO orders ...;\nSAVEPOINT coupon;\nUPDATE coupons ...;   -- fails\nROLLBACK TO coupon;   -- keep the order\nCOMMIT;',
          footer: { text: 'Only the work after the savepoint is undone', tone: 'good' },
        },
        caption: 'One step undone, order kept',
      },
    },
    {
      title: 'Recap 2',
      tag: 'recap',
      heading: 'Pick the weakest level that keeps your rules true',
      eli5: 'Write the changes that belong together in one go, decide how strict the notebook rule must be, and when two shopkeepers bump into each other, one of them starts over.',
      body: [
        'Read committed is the common default and stops only dirty reads. Snapshot isolation gives a consistent view without blocking readers. Serializable removes write skew and phantoms and asks you to retry.',
        'For a contested row, use atomic SQL, `SELECT ... FOR UPDATE` or a version check. Lock in a fixed order, keep transactions short, and always be ready to retry. A write that spans two databases or services needs the tools in the distributed transactions lesson.',
      ],
      keyIdea: 'Know your default level, name the anomaly, then choose atomic SQL, a lock, a version check or a stricter level.',
      metrics: { level: 'read committed + row lock', anomaly: 'none', balance: '$20', cost: 'short waits, rare retries' },
      metricTones: { anomaly: 'good', cost: 'good' },
      scene: {
        nodes: [txA, txB, { ...db, status: 'ok', badge: 'balance = $20' }],
        links: twoLinks,
        flows: [
          { path: ['txA', 'db'], tone: 'request', label: '- $30', duration: 1.4 },
          { path: ['db', 'txA'], tone: 'response', duration: 1.4, delay: 1.5 },
          { path: ['txB', 'db'], tone: 'request', label: '- $50', duration: 1.4, delay: 3 },
          { path: ['db', 'txB'], tone: 'response', duration: 1.4, delay: 4.5 },
        ],
        panel: {
          title: 'Anomaly to fix',
          icon: 'Table',
          rows: [
            { text: 'Lost update', value: 'atomic SQL, lock, version' },
            { text: 'Write skew', value: 'serializable, lock reads' },
            { text: 'Deadlock', value: 'lock order, retry' },
            { text: 'Queue claim', value: 'SKIP LOCKED' },
          ],
        },
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
