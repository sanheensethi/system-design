import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const app: SceneNode = { id: 'app', kind: 'phone', at: at(-3.8, -3.8), label: 'wallet app' };
const cmd: SceneNode = { id: 'cmd', kind: 'block', at: at(0, -3.8), label: 'command API', sub: 'decides', icon: 'Cpu', tint: 'blue' };
const store: SceneNode = { id: 'store', kind: 'block', at: at(3.8, -3.8), label: 'event store', sub: 'append-only', icon: 'Receipt', tint: 'amber' };
const snap: SceneNode = { id: 'snap', kind: 'storage', at: at(0, 3.8), label: 'snapshots', sub: 'every 500 events' };
const proj: SceneNode = { id: 'proj', kind: 'block', at: at(3.8, 3.8), label: 'projector', sub: 'builds views', icon: 'Workflow', tint: 'violet' };
const readDb: SceneNode = { id: 'readDb', kind: 'db', at: at(0, 3.8), label: 'read model', sub: 'balances table' };
const qry: SceneNode = { id: 'qry', kind: 'block', at: at(-3.8, 3.8), label: 'query API', sub: 'answers', icon: 'Search', tint: 'teal' };
const crudDb: SceneNode = { id: 'crudDb', kind: 'db', at: at(3.8, -3.8), label: 'accounts table', sub: 'balance column' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });
const writeLinks = [link('app', 'cmd'), link('cmd', 'store')];

export const eventSourcingCqrs: Lesson = {
  id: 'event-sourcing-cqrs',
  title: 'Event sourcing and CQRS (part 1)',
  tagline: 'Store every change as a fact in a log, derive state by replaying it, and build separate read models for each way you query.',
  minutes: 15,
  level: 'Advanced',
  learn: [
    'Storing state as an append-only log of events instead of overwriting rows',
    'What an event looks like, how commands differ from events, and what a stream is',
    'Rebuilding state by replay, optimistic concurrency, and time travel',
    'Snapshots to keep replay fast for long-lived entities',
    'CQRS: separate write and read models, built by idempotent projections',
  ],
  metrics: [
    { key: 'events', label: 'Events per account', icon: 'List' },
    { key: 'load', label: 'Load account', icon: 'Timer' },
    { key: 'lag', label: 'Read model lag', icon: 'Clock' },
    { key: 'history', label: 'History kept', icon: 'Receipt' },
  ],
  steps: [
    {
      title: 'Lost history',
      tag: 'problem',
      heading: '"Where did my $40 go?"',
      eli5: 'A child keeps a piggy bank and only a sticky note that says "I have $60". When Mom asks where the other $40 went, the note cannot say.',
      body: [
        'A wallet app stores one row per account: `balance = 60`. Every deposit and payment runs `UPDATE accounts SET balance = ...`. A customer disputes a charge and support asks what happened, in what order, and why.',
        'The row only knows the present. For a money ledger the history is the important part, and an UPDATE throws it away.',
      ],
      keyIdea: 'An UPDATE throws away how you got here. For some domains, that history is the most valuable data you have.',
      metrics: { events: '-', load: '1 ms', lag: '0', history: 'none' },
      metricTones: { history: 'bad' },
      scene: {
        nodes: [
          app,
          { ...cmd, label: 'wallet API', sub: 'CRUD', tint: 'gray' },
          { ...crudDb, status: 'hot', badge: 'balance = 60 ... why?' },
        ],
        links: [link('app', 'cmd'), link('cmd', 'crudDb')],
        flows: [
          { path: ['app', 'cmd'], tone: 'request', label: 'pay $40', duration: 1 },
          { path: ['cmd', 'crudDb'], tone: 'data', label: 'UPDATE balance = 60', duration: 1.1, delay: 1.1 },
          { path: ['crudDb', 'cmd'], tone: 'error', label: 'old value gone', duration: 1.1, delay: 2.4 },
        ],
        panel: {
          title: 'What the row can tell support',
          icon: 'Table',
          rows: [
            { text: 'balance now', value: '60' },
            { text: 'what was it before?', value: 'overwritten', tone: 'bad' },
            { text: 'balance on March 31?', value: 'unknown', tone: 'bad' },
          ],
          footer: { text: 'The row knows the answer, not the story', tone: 'bad' },
        },
        caption: 'The row knows the answer, not the story',
      },
    },
    {
      title: 'Audit table',
      tag: 'problem',
      heading: 'The side audit table drifts out of date',
      eli5: 'Someone tries to help by copying changes onto a second sticky note. But the child forgets to copy some of them, so the two notes stop agreeing.',
      body: [
        'The team added an audit table, but it is written by separate code. It misses changes made by a batch job, and it no longer adds up to the balance.',
        'Finance cannot answer "what was this balance on March 31?" without guessing. Recreating history on the side, after overwriting it, gets the design backwards.',
      ],
      keyIdea: 'A history recorded beside the real data will drift from it. The history has to be the real data.',
      metrics: { events: '-', load: '1 ms', lag: '0', history: 'partial' },
      metricTones: { history: 'warn' },
      scene: {
        nodes: [
          { ...cmd, label: 'wallet API', sub: 'CRUD', tint: 'gray' },
          { ...crudDb, status: 'hot', badge: 'balance = 60' },
          { id: 'audit', kind: 'block', at: at(0, 3.8), label: 'audit table', sub: 'separate code', icon: 'FileText', tint: 'amber', status: 'hot', badge: 'sum = 85' },
        ],
        links: [link('cmd', 'crudDb'), link('cmd', 'audit', { style: 'dashed' })],
        flows: [
          { path: ['cmd', 'crudDb'], tone: 'data', label: 'UPDATE', duration: 1.2 },
          { path: ['cmd', 'audit'], tone: 'event', label: 'INSERT audit row', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Two records, two answers',
          icon: 'Scale',
          rows: [
            { text: 'accounts.balance', value: '60' },
            { text: 'sum of audit rows', value: '85', tone: 'bad' },
            { text: 'nightly batch job', value: 'no audit row', tone: 'warn' },
          ],
          footer: { text: 'Neither can be trusted for a dispute', tone: 'bad' },
        },
        caption: 'Two records that no longer agree',
      },
    },
    {
      title: 'Events as truth',
      tag: 'concept',
      heading: 'Event sourcing: store what happened, derive what is',
      eli5: 'Now the child keeps a **notebook** and writes one line for every coin: "+$100 birthday", "-$40 toy". Nothing is ever erased. The total is just the lines added up.',
      body: [
        'With **event sourcing**, the source of truth is an append-only list of **events** per entity: `AccountOpened`, `MoneyDeposited {100}`, `MoneyWithdrawn {40}`. Events are facts in the past tense. They are never updated or deleted, only appended.',
        'The balance of 60 is computed from the events and never stored as the truth. History and audit come for free, because they are the same data.',
      ],
      keyIdea: 'The event log is the truth. State is a calculation over it.',
      metrics: { events: '3', load: '1 ms', lag: '0', history: 'complete' },
      metricTones: { history: 'good' },
      scene: {
        nodes: [app, { ...cmd, status: 'active' }, { ...store, status: 'ok', badge: '3 events' }],
        links: writeLinks,
        flows: [
          { path: ['app', 'cmd'], tone: 'request', label: 'pay $40', duration: 1 },
          { path: ['cmd', 'store'], tone: 'event', label: 'append MoneyWithdrawn', duration: 1.2, delay: 1.1 },
          { path: ['store', 'cmd'], tone: 'response', label: 'version 3', duration: 1, delay: 2.4 },
        ],
        panel: {
          title: 'The log for one account',
          icon: 'List',
          rows: [
            { text: '#1 AccountOpened', value: '' },
            { text: '#2 MoneyDeposited', value: '+100', tone: 'good' },
            { text: '#3 MoneyWithdrawn', value: '-40', tone: 'warn' },
          ],
          footer: { text: 'balance = 60, computed', tone: 'good' },
        },
        caption: 'Append a fact, never overwrite',
      },
    },
    {
      title: 'Anatomy',
      tag: 'concept',
      heading: 'What one event looks like',
      eli5: 'Each line in the notebook says what happened, how much, and who wrote it and when. Every line also has a page number so the order is clear.',
      body: [
        'An event has a **type** (`MoneyWithdrawn`), a **payload** with the facts (`cents: 4000`), the **stream** it belongs to, and its **version** in that stream.',
        'Metadata rides along: who did it, when (`at`), and the id of the command that caused it. Auditors read this directly. The `schema` field is the version of the payload shape, and it is separate from the stream version.',
      ],
      keyIdea: 'An event is a small, immutable record: type, payload, stream, version and metadata about who, when and why.',
      metrics: { events: '3', load: '1 ms', lag: '0', history: 'complete' },
      scene: {
        nodes: [{ ...cmd, status: 'active' }, { ...store, status: 'ok', chips: ['stream account-42'] }],
        links: [link('cmd', 'store')],
        flows: [{ path: ['cmd', 'store'], tone: 'event', label: 'MoneyWithdrawn', duration: 1.4 }],
        panel: {
          title: 'Event #3 as stored',
          icon: 'FileJson',
          code: '{\n  "eventId": "e-7f3a",\n  "stream": "account-42", "version": 3,\n  "type": "MoneyWithdrawn", "schema": 1,\n  "data": { "cents": 4000 },\n  "meta": { "user": "u-9", "cmd": "c-51",\n    "at": "2025-03-28T10:14:00Z" }\n}',
        },
        caption: 'Type, payload, stream, version, metadata',
      },
    },
    {
      title: 'Fold',
      tag: 'concept',
      heading: 'State is a fold over the events',
      eli5: 'To know how much is in the piggy bank, the child starts at zero and goes down the notebook, adding or subtracting each line in order.',
      body: [
        'Start from an empty state and apply each event in order. The `apply` function is pure: same events in, same state out, every time, with no side effects.',
        'That is why history works. Stop the fold early and you have the state at that moment.',
      ],
      keyIdea: 'Current state is a pure function of the events. Replay is just a reduce.',
      metrics: { events: '3', load: '1 ms', lag: '0', history: 'complete' },
      scene: {
        nodes: [{ ...store, status: 'ok' }, { ...cmd, status: 'active', badge: 'balance = 60' }],
        links: [link('cmd', 'store')],
        flows: [{ path: ['store', 'cmd'], tone: 'data', label: 'replay 3 events', count: 3, duration: 1.6 }],
        panel: {
          title: 'Running total',
          icon: 'TrendingUp',
          rows: [
            { text: '#1 AccountOpened', value: '0' },
            { text: '#2 MoneyDeposited 100', value: '100' },
            { text: '#3 MoneyWithdrawn 40', value: '60', tone: 'good' },
          ],
          footer: { text: 'Same events, same state, every time', tone: 'good' },
        },
        caption: 'Replay = reduce',
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
      title: 'Corrections',
      tag: 'concept',
      heading: 'Mistakes are fixed with new events',
      eli5: 'If the child wrote "-$40 toy" by mistake, Mom does not tear the page. She writes a new line: "+$40 toy returned". Both lines stay.',
      body: [
        'Accountants never erase a ledger line. They add a reversing entry. Event sourcing does the same: a wrong charge is fixed with `ChargeReversed {40}`, never by editing the old event.',
        'The log stays a true record of what the system believed and when, including its mistakes.',
      ],
      keyIdea: 'Corrections are new events. The old line stays, so the log remains an honest history.',
      metrics: { events: '4', load: '1 ms', lag: '0', history: 'complete' },
      scene: {
        nodes: [app, { ...cmd, status: 'active' }, { ...store, status: 'ok', badge: '4 events' }],
        links: writeLinks,
        flows: [
          { path: ['app', 'cmd'], tone: 'request', label: 'dispute charge', duration: 1 },
          { path: ['cmd', 'store'], tone: 'event', label: 'append ChargeReversed', duration: 1.2, delay: 1.1 },
        ],
        panel: {
          title: 'Fixing a wrong charge',
          icon: 'Receipt',
          rows: [
            { text: '#3 MoneyWithdrawn', value: '-40', tone: 'warn' },
            { text: '#4 ChargeReversed', value: '+40', tone: 'good' },
            { text: 'edit or delete #3', value: 'never', tone: 'bad' },
          ],
          footer: { text: 'balance back to 100, history intact', tone: 'good' },
        },
        caption: 'Add a reversing line, keep the old one',
      },
    },
    {
      title: 'Commands',
      tag: 'concept',
      heading: 'Commands ask, events state',
      eli5: 'The child asks, "May I spend $50?" That is a request and the answer can be no. If yes, the child writes "spent $50" in the notebook, and nobody can say no to that line anymore.',
      body: [
        'A **command** is a request in the imperative: `Withdraw 50`. It can be refused. An **event** is the past tense result: `MoneyWithdrawn 50`. It already happened.',
        'Only accepted commands produce events. A refused command leaves no trace in the log.',
      ],
      keyIdea: 'Commands are requests that may fail. Events are facts that already happened.',
      metrics: { events: '4', load: '1 ms', lag: '0', history: 'complete' },
      scene: {
        nodes: [app, { ...cmd, status: 'active' }, { ...store, status: 'ok' }],
        links: writeLinks,
        flows: [
          { path: ['app', 'cmd'], tone: 'request', label: 'Withdraw 500', duration: 1 },
          { path: ['cmd', 'app'], tone: 'error', label: 'refused: balance 100', duration: 1.1, delay: 1.1 },
          { path: ['app', 'cmd'], tone: 'request', label: 'Withdraw 50', duration: 1, delay: 2.5 },
          { path: ['cmd', 'store'], tone: 'event', label: 'MoneyWithdrawn 50', duration: 1.1, delay: 3.6 },
        ],
        panel: {
          title: 'Same words, different jobs',
          icon: 'ArrowLeftRight',
          rows: [
            { text: 'Withdraw 50', value: 'command, may fail', tone: 'warn' },
            { text: 'MoneyWithdrawn 50', value: 'event, is a fact', tone: 'good' },
            { text: 'refused command', value: 'no event', tone: 'muted' },
          ],
        },
        caption: 'Only accepted commands become events',
      },
    },
    {
      title: 'Streams',
      tag: 'concept',
      heading: 'One stream per entity, ordered by version',
      eli5: 'Each child has their own notebook. Lines in one notebook have page numbers 1, 2, 3. The notebooks are all kept on one shelf, in the order lines were written.',
      body: [
        'A **stream** holds the events of one entity, here one per account. Versions run 1, 2, 3 with no gaps, and replay and concurrency rely on that order.',
        'A stream is the consistency boundary: one per entity whose rule must hold together, like the balance rule. One stream for all accounts serializes every write. A rule across entities needs a saga (part 2).',
        'The store also numbers every event across all streams with a global **position**, which projections read by.',
      ],
      keyIdea: 'A stream is the ordered history of one entity. It is the unit you load and the unit you protect from conflicting writes.',
      metrics: { events: '3 to 7 per stream', load: '1 ms', lag: '0', history: 'complete' },
      scene: {
        nodes: [{ ...cmd, status: 'active' }, { ...store, status: 'ok', chips: ['account-42 v3', 'account-43 v1', 'account-44 v7'] }],
        links: [link('cmd', 'store')],
        flows: [{ path: ['cmd', 'store'], tone: 'event', label: 'append to account-42', duration: 1.4 }],
        panel: {
          title: 'Global log (position, stream)',
          icon: 'List',
          rows: [
            { text: '1042 account-42', value: 'v2 Deposited' },
            { text: '1043 account-43', value: 'v1 Opened' },
            { text: '1044 account-42', value: 'v3 Withdrawn' },
            { text: '1045 account-44', value: 'v7 Deposited' },
            { text: 'one stream =', value: 'one invariant boundary', tone: 'good' },
          ],
          footer: { text: 'Order is guaranteed inside a stream', tone: 'muted' },
        },
        caption: 'Per-stream versions, one global position',
      },
    },
    {
      title: 'Replay and decide',
      tag: 'concept',
      heading: 'Handling a command: replay, decide, append',
      eli5: 'Before spending, the child adds up the notebook to see how much is there. If it is enough, they write the new line.',
      body: [
        'The handler loads the account by reading its events and replaying them. It checks the rule (enough balance?). If the rule passes, it appends the new event with an **expected version**, here 4, since the stream now holds the four events from the corrections step.',
        'The store confirms with the new version, 5. The check and the append are not atomic, and the expected version is what makes it safe: if anyone appended in between, the store rejects the write.',
      ],
      keyIdea: 'Commands load state by replay, check rules against it, then append.',
      metrics: { events: '4', load: '2 ms', lag: '0', history: 'complete' },
      scene: {
        nodes: [app, { ...cmd, status: 'active', badge: 'balance 100 >= 50?' }, { ...store, status: 'active', badge: 'expect v4' }],
        links: writeLinks,
        flows: [
          { path: ['app', 'cmd'], tone: 'request', label: 'Withdraw 50', duration: 1 },
          { path: ['store', 'cmd'], tone: 'data', label: 'replay 4 events', duration: 1.1, delay: 1.1 },
          { path: ['cmd', 'store'], tone: 'event', label: 'append @v4', duration: 1.1, delay: 2.4 },
          { path: ['store', 'cmd'], tone: 'response', label: 'ok, now v5', duration: 1, delay: 3.6 },
        ],
        panel: {
          title: 'Three moves',
          icon: 'Workflow',
          rows: [
            { text: '1 load', value: 'replay 4 events' },
            { text: '2 decide', value: '100 >= 50, ok', tone: 'good' },
            { text: '3 append', value: 'MoneyWithdrawn @v4' },
          ],
          footer: { text: 'new balance 50', tone: 'muted' },
        },
        caption: 'Load by replay, then append with an expected version',
      },
    },
    {
      title: 'Version conflict',
      tag: 'concept',
      heading: 'Two writers race, one wins',
      eli5: 'Two siblings both read "$60" and both want to spend $50. When the first writes a new line, the page number moves on. The second sees the number changed and must add up again.',
      body: [
        'Two withdrawals of 70 can race. Each handler read version 4 (balance 100). The store accepts the first append and rejects the second, which still says "expected version 4". The loser reloads, sees version 5 and balance 30, and refuses. This is **optimistic concurrency**.',
        'It does not catch a duplicate. A client retry after a timeout reloads, sees a fresh version and passes. So the handler keeps the command id in the event `meta` and, if that id is already in the stream or a dedupe table, returns the earlier result.',
      ],
      keyIdea: 'An expected version on append lets the store reject a stale writer, with no locks.',
      metrics: { events: '4', load: '2 ms', lag: '0', history: 'complete' },
      metricTones: { events: 'good' },
      scene: {
        nodes: [
          { ...cmd, status: 'active', chips: ['A: Withdraw 70', { text: 'B: Withdraw 70', tone: 'warn' }] },
          { ...store, status: 'hot', badge: 'v4 taken' },
        ],
        links: [link('cmd', 'store')],
        flows: [
          { path: ['cmd', 'store'], tone: 'event', label: 'A append @v4', duration: 1.1 },
          { path: ['cmd', 'store'], tone: 'event', label: 'B append @v4', duration: 1.1, delay: 1.3 },
          { path: ['store', 'cmd'], tone: 'error', label: 'B: conflict, now v5', duration: 1.2, delay: 2.5 },
        ],
        panel: {
          title: 'Both read version 4',
          icon: 'Scale',
          rows: [
            { text: 'A expects v4', value: 'accepted, v5', tone: 'good' },
            { text: 'B expects v4', value: 'rejected', tone: 'bad' },
            { text: 'B reloads', value: 'balance 30, refuses', tone: 'warn' },
            { text: 'client retry, same cmd id', value: 'earlier result returned', tone: 'good' },
          ],
        },
        caption: 'The stale writer is told to look again',
      },
    },
    {
      title: 'Time travel',
      tag: 'case',
      heading: 'Case: what was the balance on March 31?',
      eli5: 'Mom asks what was in the piggy bank last month. The child covers the lines written after that day and adds up the rest.',
      body: [
        'Finance asks for the balance at the end of March. Replay the stream and stop at the last event whose `meta.at` is on or before March 31. No extra table, no guessing.',
        'The same trick reproduces bugs: copy a stream into a test, replay it, and watch the state at each step.',
      ],
      keyIdea: 'Because every change is kept, any past state is one partial replay away.',
      metrics: { events: '4', load: '1 ms', lag: '0', history: 'complete' },
      metricTones: { history: 'good' },
      scene: {
        nodes: [{ ...app, label: 'finance tool' }, { ...store, status: 'active', badge: 'stop at Mar 31' }],
        links: [link('app', 'store')],
        flows: [
          { path: ['app', 'store'], tone: 'request', label: 'balance at Mar 31?', duration: 1.2 },
          { path: ['store', 'app'], tone: 'response', label: '$60', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Replay up to the cutoff',
          icon: 'Clock',
          rows: [
            { text: 'Mar 02 AccountOpened', value: '0' },
            { text: 'Mar 10 MoneyDeposited', value: '+100' },
            { text: 'Mar 28 MoneyWithdrawn', value: '-40' },
            { text: 'Apr 04 MoneyDeposited', value: 'skipped', tone: 'muted' },
          ],
          footer: { text: 'Balance on Mar 31: 60', tone: 'good' },
        },
        caption: 'Stop the fold early',
      },
    },
    {
      title: 'Slow replay',
      tag: 'tradeoff',
      heading: 'Replay gets slower as the stream grows',
      eli5: 'After years of coins, the notebook is huge. Adding up every line each time the child wants to spend takes a very long time.',
      body: [
        'A merchant account takes 300 payments a day. After a year it has about 110,000 events, and replaying them all takes around 2 seconds on every command.',
        'Short streams are fine. A long-lived, busy one is where replay hurts.',
      ],
      keyIdea: 'Replay cost grows with stream length, so busy long-lived entities need a shortcut.',
      metrics: { events: '110,000', load: '2 s', lag: '0', history: 'complete' },
      metricTones: { load: 'bad' },
      scene: {
        nodes: [app, { ...cmd, status: 'hot', load: 92 }, { ...store, badge: '110,000 events' }],
        links: writeLinks,
        flows: [
          { path: ['app', 'cmd'], tone: 'request', label: 'Withdraw 50', duration: 1 },
          { path: ['store', 'cmd'], tone: 'data', label: 'replay 110,000', count: 5, duration: 1.6, delay: 1.1 },
        ],
        panel: {
          title: 'Load time per command',
          icon: 'Timer',
          rows: [
            { text: 'week 1, 2,100 events', value: '40 ms', tone: 'good' },
            { text: 'month 1, 9,000 events', value: '165 ms', tone: 'warn' },
            { text: 'year 1, 110,000 events', value: '2 s', tone: 'bad' },
          ],
        },
        caption: 'Every command replays the whole stream',
      },
    },
    {
      title: 'Snapshots',
      tag: 'concept',
      heading: 'Snapshots: do not add up ten years of lines',
      eli5: 'At the bottom of each notebook page the child writes the **total so far**. To get today’s total, start from the last page total and add only the new lines.',
      body: [
        'A **snapshot** stores the computed state at some version, say every 500 events: `{ balance: 81234, version: 110000 }`.',
        'Loading becomes "read the latest snapshot, then replay only the events after it". That is at most 499 events and a few milliseconds.',
      ],
      keyIdea: 'A snapshot caches state at a version, so loading replays only the recent tail.',
      metrics: { events: '110,000', load: '2 s → 4 ms', lag: '0', history: 'complete' },
      metricTones: { load: 'good' },
      scene: {
        nodes: [{ ...cmd, status: 'active' }, { ...store, badge: 'tail: 212 events' }, { ...snap, status: 'ok', badge: 'v110,000' }],
        links: [link('cmd', 'store'), link('cmd', 'snap', { style: 'dashed' })],
        flows: [
          { path: ['snap', 'cmd'], tone: 'data', label: 'state @ v110,000', duration: 1.2 },
          { path: ['store', 'cmd'], tone: 'data', label: '212 newer events', duration: 1.1, delay: 1.3 },
          { path: ['cmd', 'store'], tone: 'event', label: 'append', duration: 1.1, delay: 2.6 },
        ],
        panel: {
          title: 'Load = snapshot + tail',
          icon: 'Layers',
          rows: [
            { text: 'latest snapshot', value: 'v110,000' },
            { text: 'events to replay', value: '212', tone: 'good' },
            { text: 'load time', value: '4 ms', tone: 'good' },
          ],
        },
        caption: 'Start from the last snapshot, replay the tail',
      },
    },
    {
      title: 'Disposable cache',
      tag: 'concept',
      heading: 'Snapshots are a cache, the log is the truth',
      eli5: 'If the page totals turn out wrong, the child throws them away and adds the lines up again. The lines are the real record, the totals just save time.',
      body: [
        'You can delete every snapshot and rebuild from the log. If you change how `apply` works, throw away the old snapshots and let them regenerate.',
        'Most entities in most systems have few events and need no snapshots at all. Add them when measured load time says so.',
      ],
      keyIdea: 'A snapshot can always be rebuilt from the log, so it is derived data and never the truth.',
      metrics: { events: '110,000', load: '4 ms', lag: '0', history: 'complete' },
      scene: {
        nodes: [{ ...cmd, status: 'active' }, { ...store, status: 'ok' }, { ...snap, status: 'hot', badge: 'bad data' }],
        links: [link('cmd', 'store'), link('store', 'snap', { style: 'dashed', label: 'rebuild' })],
        flows: [{ path: ['store', 'snap'], tone: 'data', label: 'regenerate', count: 3, duration: 1.6 }],
        panel: {
          title: 'Bad snapshots, good log',
          icon: 'Copy',
          rows: [
            { text: 'snapshots', value: 'derived', tone: 'warn' },
            { text: 'event log', value: 'still correct', tone: 'good' },
            { text: 'fix', value: 'patch code, rebuild' },
          ],
        },
        caption: 'Delete the cache, regrow it from the log',
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
        'An event log is a poor thing to query. "All accounts with balance under $10" would mean replaying every stream. **CQRS** (command query responsibility segregation) splits the system in two: a **write side** that enforces rules and a **read side** with models shaped for each query.',
        'The sides use different storage and scale apart. Reads often outnumber writes 100 to 1.',
      ],
      keyIdea: 'CQRS separates the model that decides from the models that answer questions, so each can be shaped and scaled for its job.',
      metrics: { events: '110,000', load: '4 ms', lag: '-', history: 'complete' },
      scene: {
        nodes: [
          app,
          { ...cmd, status: 'active', badge: 'writes' },
          store,
          { ...readDb, status: 'ok' },
          { ...qry, status: 'active', badge: 'reads' },
        ],
        links: [...writeLinks, link('store', 'readDb', { style: 'dashed', label: 'builds' }), link('qry', 'readDb'), link('app', 'qry')],
        flows: [
          { path: ['app', 'cmd', 'store'], tone: 'request', label: 'Deposit 25', duration: 1.6 },
          { path: ['app', 'qry'], tone: 'request', label: 'GET balance', duration: 1, delay: 0.4 },
          { path: ['qry', 'readDb', 'qry'], tone: 'data', duration: 1.4, delay: 1.5 },
          { path: ['qry', 'app'], tone: 'response', duration: 1, delay: 3 },
        ],
        caption: 'Commands go one way, queries another',
      },
    },
    {
      title: 'CQRS alone',
      tag: 'concept',
      heading: 'CQRS does not need event sourcing',
      eli5: 'The child could keep a normal piggy bank and still draw a fridge chart from it. The notebook and the chart are two separate ideas.',
      body: [
        'You can split reads from writes on a normal database: a primary for commands, a replica or a search index for queries. That is CQRS with no event log.',
        'The reverse is not true. Event sourcing nearly requires CQRS, because a log is a poor thing to query and the events are a natural feed for read models.',
      ],
      keyIdea: 'CQRS can stand alone. Event sourcing almost always needs it.',
      metrics: { events: '-', load: '4 ms', lag: '50 ms', history: 'none' },
      scene: {
        nodes: [
          { ...cmd, label: 'command API', sub: 'validates, writes' },
          { ...crudDb, at: at(3.8, -3.8), label: 'primary DB', sub: 'current rows' },
          { id: 'replica', kind: 'replica', at: at(3.8, 3.8), label: 'read replica', sub: 'copy' },
          { ...qry, at: at(0, 3.8), sub: 'reads the copy' },
        ],
        links: [link('cmd', 'crudDb'), link('crudDb', 'replica', { style: 'dashed', label: 'replication' }), link('qry', 'replica')],
        flows: [
          { path: ['cmd', 'crudDb'], tone: 'data', label: 'UPDATE', duration: 1.2 },
          { path: ['crudDb', 'replica'], tone: 'data', duration: 1.2, delay: 1.3 },
          { path: ['qry', 'replica', 'qry'], tone: 'request', duration: 1.4, delay: 0.6 },
        ],
        panel: {
          title: 'Two separate ideas',
          icon: 'Split',
          rows: [
            { text: 'CQRS only', value: 'primary + replica', tone: 'good' },
            { text: 'event sourcing only', value: 'rare, hard to query', tone: 'warn' },
            { text: 'both', value: 'common pairing', tone: 'good' },
          ],
        },
        caption: 'Split the reads, with or without a log',
      },
    },
    {
      title: 'Projections',
      tag: 'concept',
      heading: 'Projections build the read models from events',
      eli5: 'After each new notebook line, someone updates the fridge chart. The chart is never the real record, it is just the notebook drawn in a handy shape.',
      body: [
        'A **projection** is a consumer that reads events in order and updates a read model. One projection keeps a `balances` table. Another writes monthly statement rows. A third feeds a search index.',
        'The write side never waits for them. Each projection runs on its own and can be added later.',
      ],
      keyIdea: 'Projections turn one event log into many query-shaped read models.',
      metrics: { events: '110,000', load: '4 ms', lag: '~200 ms', history: 'complete' },
      scene: {
        nodes: [
          { ...store, at: at(0, -3.8), badge: 'position 9,812,004' },
          { ...proj, at: at(0, 3.8), status: 'active' },
          { ...readDb, at: at(-3.8, 3.8), status: 'active', label: 'balances', sub: 'table' },
          { id: 'statements', kind: 'search', at: at(3.8, 3.8), label: 'statements view', status: 'ok' },
        ],
        links: [link('store', 'proj', { style: 'dashed' }), link('proj', 'readDb'), link('proj', 'statements')],
        flows: [
          { path: ['store', 'proj'], tone: 'event', label: 'MoneyDeposited', duration: 1.1 },
          { path: ['proj', 'readDb'], tone: 'data', label: 'UPSERT balance', duration: 1.1, delay: 1.2 },
          { path: ['proj', 'statements'], tone: 'data', label: 'add statement row', duration: 1.1, delay: 1.4 },
        ],
        caption: 'One log, many read models',
      },
    },
    {
      title: 'Idempotent',
      tag: 'concept',
      heading: 'Checkpoints and idempotent updates',
      eli5: 'The fridge helper keeps a note: "I have drawn up to line 9,812,003". If a line is handed over twice, the helper sees the number and skips it.',
      body: [
        'Each projection stores a **checkpoint**, the position of the last event it applied. Delivery is at least once, as in the message queues lesson, so a projection must be idempotent.',
        'The simplest way: store the event position next to the data and ignore anything already applied.',
      ],
      keyIdea: 'Projections are checkpointed and idempotent: store the last applied position beside the data and skip repeats.',
      metrics: { events: '110,000', load: '4 ms', lag: '~200 ms', history: 'complete' },
      scene: {
        nodes: [
          { ...store, at: at(0, -3.8), badge: 'position 9,812,004' },
          { ...proj, at: at(0, 3.8), status: 'active', badge: 'checkpoint 9,812,003' },
          { ...readDb, at: at(-3.8, 3.8), status: 'active' },
        ],
        links: [link('store', 'proj', { style: 'dashed' }), link('proj', 'readDb')],
        flows: [
          { path: ['store', 'proj'], tone: 'event', label: 'deliver #...004', duration: 1.1 },
          { path: ['store', 'proj'], tone: 'event', label: 'deliver #...004 again', duration: 1.1, delay: 1.3 },
          { path: ['proj', 'readDb'], tone: 'data', label: 'apply once', duration: 1.1, delay: 1.4 },
        ],
        panel: {
          title: 'Delivery twice, applied once',
          icon: 'Repeat',
          rows: [
            { text: 'first delivery', value: 'position > last, apply', tone: 'good' },
            { text: 'second delivery', value: 'position = last, skip', tone: 'warn' },
          ],
        },
        caption: 'Same event twice, one change',
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
      title: 'Recap 1',
      tag: 'recap',
      heading: 'Facts in a log, answers in read models',
      eli5: 'Write every coin in the notebook, never erase, write a page total now and then, and keep handy charts on the fridge. Part 2 covers what happens when the chart lags behind.',
      body: [
        '**Event sourcing** stores every change as an immutable event in a per-entity stream and derives state by replay. Commands load, check and append with an expected version. **Snapshots** cache state so replay stays short.',
        '**CQRS** splits the write model from read models. **Projections** build them from the log, idempotently and with checkpoints. Part 2 covers lag, rebuilds, versioning, privacy and when to use all this.',
      ],
      keyIdea: 'Keep the facts, derive the views. A stream is ordered, appends carry an expected version, and projections are idempotent.',
      metrics: { events: '110,000', load: '4 ms', lag: '200 ms', history: 'complete' },
      metricTones: { load: 'good', history: 'good' },
      scene: {
        nodes: [
          app,
          cmd,
          store,
          { ...proj, status: 'ok' },
          { ...readDb, at: at(0, 3.8), status: 'ok' },
        ],
        links: [...writeLinks, link('store', 'proj', { style: 'dashed' }), link('proj', 'readDb'), link('app', 'readDb', { label: 'queries' })],
        flows: [
          { path: ['app', 'cmd', 'store', 'proj', 'readDb'], tone: 'event', duration: 2.6 },
          { path: ['app', 'readDb', 'app'], tone: 'request', duration: 2.6, delay: 1.3 },
        ],
        caption: 'Write to the log, read from the views',
      },
      quiz: {
        question: 'Two command handlers both load an account at version 3 and both append "expected version 3". What happens?',
        options: [
          'Both appends succeed and the events are merged',
          'The store accepts the first and rejects the second with a conflict, and the second reloads and decides again',
          'The store locks the account until both finish',
          'The second append overwrites the first event',
        ],
        answer: 1,
        explain: 'The expected version makes the second append stale. The store rejects it, so that handler reloads version 4, sees the new balance and checks the rule again. Events are never overwritten.',
      },
    },
  ],
};
