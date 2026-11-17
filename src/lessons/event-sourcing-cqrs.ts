import type { Lesson, SceneNode } from '../engine/types';

const user: SceneNode = { id: 'user', kind: 'phone', at: [-6.5, 0.5], label: 'wallet app' };
const cmd: SceneNode = { id: 'cmd', kind: 'server', at: [-3, -1.5], label: 'command API', sub: 'validates, appends' };
const store: SceneNode = { id: 'store', kind: 'queue', at: [0.5, -1.5], label: 'event store', sub: 'append-only' };
const proj: SceneNode = { id: 'proj', kind: 'worker', at: [4, -1.5], label: 'projector' };
const readDb: SceneNode = { id: 'readDb', kind: 'db', at: [4, 3.5], label: 'read model', sub: 'balances table' };
const qry: SceneNode = { id: 'qry', kind: 'server', at: [-3, 3.5], label: 'query API' };
const snap: SceneNode = { id: 'snap', kind: 'storage', at: [0.5, -5.5], label: 'snapshots', sub: 'every 500 events' };
const statements: SceneNode = { id: 'statements', kind: 'search', at: [7, 1], label: 'statements view' };

// Problem scene: a plain CRUD row
const crudDb: SceneNode = { id: 'crudDb', kind: 'db', at: [0.5, -1.5], label: 'accounts table', sub: 'balance column' };

const writeLinks = [
  { from: 'user', to: 'cmd' },
  { from: 'cmd', to: 'store' },
];
const cqrsLinks = [
  ...writeLinks,
  { from: 'store', to: 'proj', style: 'dashed' as const },
  { from: 'proj', to: 'readDb' },
  { from: 'qry', to: 'readDb' },
  { from: 'user', to: 'qry' },
];

export const eventSourcingCqrs: Lesson = {
  id: 'event-sourcing-cqrs',
  title: 'Event sourcing and CQRS',
  tagline: 'Store every change as a fact in a log, derive state by replaying it, and build separate read models for each way you query.',
  minutes: 15,
  level: 'Advanced',
  learn: [
    'Storing state as an append-only log of events instead of overwriting rows',
    'Rebuilding state by replay, and optimistic concurrency on the log',
    'Snapshots to keep replay fast for long-lived entities',
    'CQRS: separate write and read models, built by projections',
    'Eventual consistency of reads, and when all of this is worth it',
  ],
  metrics: [
    { key: 'events', label: 'Events per account' },
    { key: 'load', label: 'Load account' },
    { key: 'lag', label: 'Read model lag' },
    { key: 'history', label: 'History kept' },
  ],
  steps: [
    {
      title: 'Lost history',
      tag: 'problem',
      heading: '"Where did my $40 go?"',
      eli5: 'A child keeps a piggy bank and only a sticky note that says "I have $60". When Mom asks where the other $40 went, the note cannot say.',
      body: [
        'A wallet app stores one row per account: `balance = 60`. Every deposit and payment runs `UPDATE accounts SET balance = ...`. A customer disputes a charge and support asks the obvious question: what happened, in what order, and why?',
        'The row only knows the present. The team added an audit table, but it is written by separate code, misses changes made by a batch job, and no longer adds up to the balance. Finance cannot answer "what was this balance on March 31?" without guessing.',
        'For a money ledger the history is the important part. Overwriting it, then trying to recreate it on the side, gets the design backwards.',
      ],
      keyIdea: 'An UPDATE throws away how you got here. For some domains, that history is the most valuable data you have.',
      metrics: { events: '-', load: '1 ms', lag: '0', history: 'none' },
      scene: {
        nodes: [user, { ...cmd, label: 'wallet API', sub: 'CRUD' }, { ...crudDb, status: 'hot', badge: 'balance = 60 ... why?' }],
        links: [{ from: 'user', to: 'cmd' }, { from: 'cmd', to: 'crudDb' }],
        flows: [
          { path: ['user', 'cmd'], tone: 'request', label: 'pay $40', duration: 1 },
          { path: ['cmd', 'crudDb'], tone: 'data', label: 'UPDATE balance = 60', duration: 1.1, delay: 1.1 },
          { path: ['crudDb', 'cmd'], tone: 'error', label: 'old value gone', duration: 1.1, delay: 2.4 },
        ],
        caption: 'The row knows the answer, not the story',
      },
    },
    {
      title: 'Events as truth',
      tag: 'concept',
      heading: 'Event sourcing: store what happened, derive what is',
      eli5: 'Now the child keeps a **notebook** and writes one line for every coin: "+$100 birthday", "-$40 toy". Nothing is ever erased. The total is just the lines added up.',
      body: [
        'With **event sourcing**, the source of truth is an append-only list of **events** per entity: `AccountOpened`, `MoneyDeposited {100}`, `MoneyWithdrawn {40}`. Events are facts in the past tense. They are never updated or deleted, only appended.',
        'Current state is a function of the events: start from nothing and apply each event in order. The balance of 60 is computed from the events and never stored as the truth. History, audit and "balance on March 31" all come for free, because they are the same data.',
        'Mistakes are fixed the way accountants fix them: with a new event, such as `ChargeReversed {40}`, never by editing an old line. The log stays a true record of what the system believed and when.',
      ],
      keyIdea: 'The event log is the truth. State is a calculation over it, and corrections are new events.',
      metrics: { events: '3', load: '1 ms', lag: '0', history: 'complete' },
      scene: {
        nodes: [user, { ...cmd, status: 'active' }, { ...store, status: 'ok', badge: '#1 open · #2 +100 · #3 -40' }],
        links: writeLinks,
        flows: [
          { path: ['user', 'cmd'], tone: 'request', label: 'pay $40', duration: 1 },
          { path: ['cmd', 'store'], tone: 'event', label: 'append MoneyWithdrawn', duration: 1.2, delay: 1.1 },
          { path: ['store', 'cmd'], tone: 'response', label: 'version 3', duration: 1, delay: 2.4 },
        ],
        caption: 'Append a fact, never overwrite',
      },
      code: {
        language: 'typescript',
        title: 'State is a fold over the events',
        source: `type AccountEvent =
  | { type: 'AccountOpened'; accountId: string }
  | { type: 'MoneyDeposited'; cents: number }
  | { type: 'MoneyWithdrawn'; cents: number }
  | { type: 'ChargeReversed'; cents: number };

interface Account { balanceCents: number; open: boolean; version: number }

function apply(s: Account, e: AccountEvent): Account {
  switch (e.type) {
    case 'AccountOpened':  return { ...s, open: true, version: s.version + 1 };
    case 'MoneyDeposited': return { ...s, balanceCents: s.balanceCents + e.cents, version: s.version + 1 };
    case 'MoneyWithdrawn': return { ...s, balanceCents: s.balanceCents - e.cents, version: s.version + 1 };
    case 'ChargeReversed': return { ...s, balanceCents: s.balanceCents + e.cents, version: s.version + 1 };
  }
}

const empty: Account = { balanceCents: 0, open: false, version: 0 };
const current = events.reduce(apply, empty);   // replay = reduce`,
        highlight: [9, 12, 13, 19],
      },
    },
    {
      title: 'Replay',
      tag: 'concept',
      heading: 'Handling a command: replay, decide, append',
      eli5: 'Before spending, the child adds up the notebook to see how much is there. If it is enough, they write the new line. If a sibling wrote a line in the meantime, they add up again first.',
      body: [
        'A **command** is a request that may be refused, such as `Withdraw 50`. The handler loads the account by reading its events and replaying them, checks the rule (enough balance?), and if it passes appends the new event.',
        'Two withdrawals can race. Each handler read the account at version 3 and each thinks there is enough money. To stop that, the append says "**expected version 3**". The store accepts the first and rejects the second with a conflict. The loser reloads, sees version 4 and the lower balance, and decides again. This is optimistic concurrency, and it works because each entity’s stream is ordered.',
        'Events are also what you publish. Other services subscribe to the same log, so "save the change" and "tell others" can no longer drift apart.',
      ],
      keyIdea: 'Commands load state by replay, check rules, and append with an expected version so concurrent writers cannot both win.',
      metrics: { events: '4', load: '2 ms', lag: '0', history: 'complete' },
      scene: {
        nodes: [user, { ...cmd, status: 'active', badge: 'balance 60 >= 50?' }, { ...store, status: 'active', badge: 'expect v3' }],
        links: writeLinks,
        flows: [
          { path: ['user', 'cmd'], tone: 'request', label: 'Withdraw 50', duration: 1 },
          { path: ['store', 'cmd'], tone: 'data', label: 'replay 3 events', duration: 1.1, delay: 1.1 },
          { path: ['cmd', 'store'], tone: 'event', label: 'append @v3', duration: 1.1, delay: 2.4 },
          { path: ['store', 'cmd'], tone: 'response', label: 'ok, now v4', duration: 1, delay: 3.6 },
        ],
        caption: 'Load by replay, append with an expected version',
      },
    },
    {
      title: 'Snapshots',
      tag: 'concept',
      heading: 'Snapshots: do not add up ten years of lines',
      eli5: 'After years the notebook is huge. So at the bottom of each page the child writes the **total so far**. To get today’s total, start from the last page total and add only the new lines.',
      body: [
        'A merchant account takes 300 payments a day. After a year it has about 110,000 events, and replaying them all takes around 2 seconds on every command. Too slow.',
        'A **snapshot** stores the computed state at some version, say every 500 events: `{ balance: 81234, version: 110000 }`. Loading becomes "read the latest snapshot, then replay only the events after it", which is at most 499 events and a few milliseconds.',
        'A snapshot is a cache, and the log stays the truth. You can delete them all and rebuild from the log. If you change how `apply` works, you throw away old snapshots and let them regenerate. Most entities in most systems have few events and need no snapshots at all.',
      ],
      keyIdea: 'A snapshot caches state at a version so loading replays only recent events. It can always be rebuilt from the log.',
      metrics: { events: '110,000', load: '2 s → 4 ms', lag: '0', history: 'complete' },
      scene: {
        nodes: [user, { ...cmd, status: 'active' }, { ...store, badge: 'tail: 212 events' }, { ...snap, status: 'ok', badge: 'v110,000' }],
        links: [...writeLinks, { from: 'cmd', to: 'snap', style: 'dashed' as const }],
        flows: [
          { path: ['snap', 'cmd'], tone: 'data', label: 'state @ v110,000', duration: 1.2 },
          { path: ['store', 'cmd'], tone: 'data', label: '212 newer events', duration: 1.1, delay: 1.3 },
          { path: ['cmd', 'store'], tone: 'event', label: 'append', duration: 1.1, delay: 2.6 },
        ],
        caption: 'Start from the last snapshot, replay the tail',
      },
      quiz: {
        question: 'A bug in the snapshot code wrote wrong balances into every snapshot. What is the fix?',
        options: [
          'Restore the database from last night’s backup',
          'Fix the code, delete the snapshots, and rebuild them from the event log',
          'Append correcting events for every account',
          'Edit the snapshot rows by hand',
        ],
        answer: 1,
        explain: 'Snapshots are derived data. The log is still correct, so you fix the code and regenerate. Correcting events are for mistakes in the facts themselves, not in a cache.',
      },
    },
    {
      title: 'CQRS',
      tag: 'concept',
      heading: 'CQRS: one model to write, others to read',
      eli5: 'The notebook is great for checking spending, but slow for "how much did I spend on toys this year?". So the child also keeps a separate **chart on the fridge**, just for answering questions.',
      body: [
        'An event log is a poor thing to query. "All accounts with balance under $10" or "this month’s statement" would mean replaying every stream. **CQRS** (command query responsibility segregation) splits the system in two: a **write side** that handles commands and enforces rules, and a **read side** with models shaped for each query.',
        'The two sides can use different storage and scale apart. Reads often outnumber writes 100 to 1, so the read side can be a set of replicated tables, a search index or a cache, while the write side stays small and strict.',
        'CQRS does not require event sourcing. You can split reads from writes on a normal database. But event sourcing nearly requires CQRS, and the event log is a natural feed for building the read side.',
      ],
      keyIdea: 'CQRS separates the model that decides from the models that answer questions, so each can be shaped and scaled for its job.',
      metrics: { events: '110,000', load: '4 ms', lag: '-', history: 'complete' },
      scene: {
        nodes: [user, { ...cmd, status: 'active', badge: 'writes' }, store, proj, { ...readDb, status: 'ok' }, { ...qry, status: 'active' }],
        links: cqrsLinks,
        flows: [
          { path: ['user', 'cmd', 'store'], tone: 'request', label: 'Deposit 25', duration: 1.6 },
          { path: ['user', 'qry'], tone: 'request', label: 'GET balance', duration: 1, delay: 0.4 },
          { path: ['qry', 'readDb', 'qry'], tone: 'data', duration: 1.4, delay: 1.5 },
          { path: ['qry', 'user'], tone: 'response', duration: 1, delay: 3 },
        ],
        caption: 'Commands go one way, queries another',
      },
    },
    {
      title: 'Projections',
      tag: 'concept',
      heading: 'Projections build the read models from events',
      eli5: 'After each new notebook line, someone updates the fridge chart. The chart is never the real record, it is just the notebook drawn in a handy shape.',
      body: [
        'A **projection** is a consumer that reads events in order and updates a read model. One projection keeps a `balances` table. Another writes monthly statement rows. A third feeds a search index. Each stores a **checkpoint**, the position of the last event it applied.',
        'Delivery is at least once, as in the message queues lesson, so a projection must be idempotent. The simplest way: store the event position next to the data and ignore anything already applied.',
        'Read models are disposable. If one has a bug, fix the projection, drop the table and replay the log from position zero. Add a new screen next year, and you can build its read model from all the history you already have.',
      ],
      keyIdea: 'Projections turn the event log into query-shaped tables. They are idempotent, checkpointed, and can be rebuilt from scratch.',
      metrics: { events: '110,000', load: '4 ms', lag: '~200 ms', history: 'complete' },
      scene: {
        nodes: [user, cmd, { ...store, badge: 'position 9,812,004' }, { ...proj, status: 'active', badge: 'checkpoint 9,812,003' }, { ...readDb, status: 'active' }, qry, { ...statements, status: 'ok' }],
        links: [...cqrsLinks, { from: 'proj', to: 'statements' }],
        flows: [
          { path: ['store', 'proj'], tone: 'event', label: 'MoneyDeposited', duration: 1.1 },
          { path: ['proj', 'readDb'], tone: 'data', label: 'UPSERT balance', duration: 1.1, delay: 1.2 },
          { path: ['proj', 'statements'], tone: 'data', label: 'add statement row', duration: 1.1, delay: 1.4 },
        ],
        caption: 'One log, many read models',
      },
      code: {
        language: 'sql',
        title: 'An idempotent balance projection',
        source: `CREATE TABLE balances (
  account_id    uuid PRIMARY KEY,
  balance_cents bigint NOT NULL,
  last_position bigint NOT NULL       -- last event applied to this row
);

-- Run for each MoneyDeposited / MoneyWithdrawn event, in log order.
-- $1 = account, $2 = signed amount, $3 = event position
INSERT INTO balances (account_id, balance_cents, last_position)
VALUES ($1, $2, $3)
ON CONFLICT (account_id) DO UPDATE
  SET balance_cents = balances.balance_cents + EXCLUDED.balance_cents,
      last_position = EXCLUDED.last_position
  WHERE balances.last_position < EXCLUDED.last_position;  -- skip replays`,
        highlight: [4, 11, 12, 14],
      },
    },
    {
      title: 'Stale reads',
      tag: 'tradeoff',
      heading: 'Reads lag writes, and users notice',
      eli5: 'The child writes "+$25" in the notebook, then runs to the fridge chart, which has not been updated yet. For a moment the chart says the old total.',
      body: [
        'The read side is updated after the event is stored, usually within a few hundred milliseconds. So a user deposits $25, the app immediately asks for the balance, and the query API returns the old number. To the user, the deposit failed.',
        'Common fixes: return the new state (or the new version) in the command’s response, so the app shows it without a query. Or have the query wait until the projection’s checkpoint reaches that version, with a short timeout. Or route the user’s own reads to the write side for a few seconds after a write (read-your-writes).',
        'Lag also grows when a projection falls behind. Monitor it the way you monitor consumer lag on a queue, and alert before users see minutes-old balances.',
      ],
      keyIdea: 'Read models are eventually consistent. Design the user flow so people see their own writes, and monitor projection lag.',
      metrics: { events: '110,000', load: '4 ms', lag: '200 ms', history: 'complete' },
      scene: {
        nodes: [user, { ...cmd, badge: 'v4 written' }, store, { ...proj, status: 'hot', badge: 'at v3' }, { ...readDb, status: 'hot', badge: 'still $60' }, { ...qry, status: 'active' }],
        links: cqrsLinks,
        flows: [
          { path: ['user', 'cmd', 'store'], tone: 'request', label: 'Deposit 25', duration: 1.4 },
          { path: ['user', 'qry', 'readDb'], tone: 'request', label: 'GET balance', duration: 1.4, delay: 1.5 },
          { path: ['readDb', 'qry', 'user'], tone: 'error', label: '$60 (old)', duration: 1.4, delay: 3 },
          { path: ['store', 'proj'], tone: 'event', label: 'v4 arrives', duration: 1.4, delay: 3.4 },
        ],
        caption: 'The query beat the projection',
      },
    },
    {
      title: 'New questions',
      tag: 'case',
      heading: 'Case: a fraud team asks a question about last year',
      eli5: 'Grandpa asks: "How often did you spend money within a minute of getting it?" The fridge chart cannot say, but the notebook can. So the child draws a new chart from the old lines.',
      body: [
        'A fraud team wants "accounts that withdrew more than 90% of a deposit within 60 seconds, over the past year". With a CRUD table that question cannot be answered, because the intermediate states were overwritten.',
        'With an event log, the team writes a new projection, points it at position zero and lets it replay a year of events into a new table. It catches up in a few hours, then keeps up with new events like any other projection. No change to the write side.',
        'The catch is that events are forever. A field added to `MoneyDeposited` in v2 means the projection must still read v1 events, usually through an **upcaster** that converts old shapes on read. Deleting personal data is also hard in an immutable log. A common answer is to encrypt personal fields per user and delete the key when the user asks to be forgotten.',
      ],
      keyIdea: 'A complete log lets you answer questions you did not plan for, at the cost of supporting every old event shape forever.',
      metrics: { events: '110,000', load: '4 ms', lag: 'rebuild: hours', history: 'complete' },
      scene: {
        nodes: [cmd, { ...store, badge: 'replay from 0' }, proj, readDb, { ...statements, label: 'fraud view', sub: 'new projection', status: 'active', badge: 'catching up 41%' }],
        links: [
          { from: 'cmd', to: 'store' },
          { from: 'store', to: 'proj', style: 'dashed' as const },
          { from: 'proj', to: 'readDb' },
          { from: 'store', to: 'statements', style: 'dashed' as const },
        ],
        flows: [
          { path: ['store', 'statements'], tone: 'event', label: 'year of events', count: 5, duration: 1.4 },
          { path: ['store', 'proj'], tone: 'event', duration: 1.2, delay: 0.8 },
          { path: ['proj', 'readDb'], tone: 'data', duration: 1, delay: 2.1 },
        ],
        caption: 'A new read model built from old facts',
      },
    },
    {
      title: 'Worth it?',
      tag: 'tradeoff',
      heading: 'When it earns its complexity, and when it does not',
      eli5: 'A notebook is worth it for money, where every coin matters. For a list of favorite colors, a single sticky note is fine.',
      body: [
        '**Use it** where the history is the business: ledgers, payments, inventory movements, insurance claims, order workflows with many states. Also where you need to answer "what was true at time T", or must feed many differently shaped read models and other services from one stream of changes.',
        '**Skip it** for CRUD data whose past nobody asks about: user settings, a product description, a content page. There you would pay for event versioning, projections, lag handling and a harder mental model, and get nothing back.',
        'You can apply it to one part of a system. A common shape is an event-sourced ledger inside a normal CRUD application, with CQRS read models only where queries need them. Many teams use plain CQRS (read replicas or a search index fed from the main database) and never event-source anything.',
      ],
      keyIdea: 'Event sourcing pays off when history and many read shapes are core needs. For plain CRUD it adds cost with no return.',
      metrics: { events: 'per domain', load: '4 ms', lag: '200 ms', history: 'where it matters' },
      scene: {
        nodes: [user, { ...cmd, status: 'ok' }, { ...store, status: 'ok', badge: 'ledger only' }, proj, { ...readDb, status: 'ok' }, qry],
        links: cqrsLinks,
        flows: [
          { path: ['user', 'cmd', 'store'], tone: 'request', duration: 1.6 },
          { path: ['store', 'proj', 'readDb'], tone: 'event', duration: 1.6, delay: 1.7 },
          { path: ['user', 'qry', 'readDb'], tone: 'request', duration: 1.6, delay: 0.6 },
        ],
        caption: 'Event-source the part where history matters',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Facts in a log, answers in read models',
      eli5: 'Write every coin in the notebook, never erase, write a page total now and then, and keep handy charts on the fridge that catch up a moment later.',
      body: [
        '**Event sourcing** stores every change as an immutable event and derives state by replay. Commands load, check and append with an expected version. **Snapshots** cache state so replay stays short, and can always be rebuilt.',
        '**CQRS** splits the write model from read models. **Projections** build those read models from the log, idempotently and with checkpoints, and can be replayed to fix bugs or answer new questions. Reads are **eventually consistent**, so design for read-your-writes and watch lag. Use it where history matters, and leave plain CRUD alone.',
      ],
      keyIdea: 'Keep the facts, derive the views. Pay for it only where history and many read shapes are worth the extra moving parts.',
      metrics: { events: '110,000', load: '4 ms', lag: '200 ms', history: 'complete' },
      scene: {
        nodes: [user, cmd, store, proj, { ...readDb, status: 'ok' }, qry, snap],
        links: [...cqrsLinks, { from: 'cmd', to: 'snap', style: 'faint' as const }],
        flows: [
          { path: ['user', 'cmd', 'store', 'proj', 'readDb'], tone: 'event', duration: 2.6 },
          { path: ['user', 'qry', 'readDb', 'qry', 'user'], tone: 'request', duration: 2.6, delay: 1.3 },
        ],
      },
      quiz: {
        question: 'Right after a successful deposit, the app shows the old balance. The deposit event is in the log. What is the most likely cause?',
        options: [
          'The event was lost',
          'The projection had not yet applied the event to the read model',
          'The snapshot is corrupt',
          'Optimistic concurrency rejected the write',
        ],
        answer: 1,
        explain: 'The read model is updated asynchronously after the append. Returning the new state from the command, or waiting for the projection to reach that version, hides the lag from the user.',
      },
    },
  ],
};
