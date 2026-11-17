import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const app: SceneNode = { id: 'app', kind: 'phone', at: at(-3.8, -3.8), label: 'wallet app' };
const cmd: SceneNode = { id: 'cmd', kind: 'block', at: at(0, -3.8), label: 'command API', sub: 'decides', icon: 'Cpu', tint: 'blue' };
const store: SceneNode = { id: 'store', kind: 'block', at: at(3.8, -3.8), label: 'event store', sub: 'append-only', icon: 'Receipt', tint: 'amber' };
const proj: SceneNode = { id: 'proj', kind: 'block', at: at(3.8, 3.8), label: 'projector', sub: 'builds views', icon: 'Workflow', tint: 'violet' };
const readDb: SceneNode = { id: 'readDb', kind: 'db', at: at(0, 3.8), label: 'read model', sub: 'balances table' };
const qry: SceneNode = { id: 'qry', kind: 'block', at: at(-3.8, 3.8), label: 'query API', sub: 'answers', icon: 'Search', tint: 'teal' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });
// Projection layout: store on top, projector below it, outputs left and right of the projector.
const pStore: SceneNode = { ...store, at: at(0, -3.8) };
const pProj: SceneNode = { ...proj, at: at(0, 3.8) };

export const eventSourcingCqrsPart2: Lesson = {
  id: 'event-sourcing-cqrs-part-2',
  title: 'Event sourcing and CQRS (part 2)',
  tagline: 'Living with read model lag, rebuilding views, changing event shapes, privacy, publishing events, and deciding when it is worth it.',
  minutes: 15,
  level: 'Advanced',
  learn: [
    'Stale reads, read-your-writes, projection lag and poison events',
    'Rebuilding read models and answering questions nobody planned for',
    'Event design, upcasting old versions, and deleting personal data from an immutable log',
    'Storing events in a SQL table, publishing them to other services, sagas and testing',
    'When event sourcing earns its complexity and when it does not',
  ],
  metrics: [
    { key: 'events', label: 'Events per account', icon: 'List' },
    { key: 'load', label: 'Load account', icon: 'Timer' },
    { key: 'lag', label: 'Read model lag', icon: 'Clock' },
    { key: 'history', label: 'History kept', icon: 'Receipt' },
  ],
  steps: [
    {
      title: 'Stale reads',
      tag: 'tradeoff',
      heading: 'Reads lag writes, and users notice',
      eli5: 'The child writes "+$25" in the notebook, then runs to the fridge chart, which has not been updated yet. For a moment the chart says the old total.',
      body: [
        'The read side is updated after the event is stored, usually within a few hundred milliseconds. A user deposits $25, the app immediately asks for the balance, and the query API returns the old number. To the user, the deposit failed.',
      ],
      keyIdea: 'Read models are eventually consistent: a query can beat the projection that would have updated it.',
      metrics: { events: '110,000', load: '4 ms', lag: '200 ms', history: 'complete' },
      metricTones: { lag: 'warn' },
      scene: {
        nodes: [
          app,
          { ...store, badge: 'v4 at position ...005' },
          { ...proj, status: 'hot', badge: 'at position ...004' },
          { ...readDb, status: 'hot', badge: 'still $60' },
          { ...qry, status: 'active' },
        ],
        links: [link('app', 'store', { label: 'via command API' }), link('store', 'proj', { style: 'dashed' }), link('proj', 'readDb'), link('qry', 'readDb'), link('app', 'qry')],
        flows: [
          { path: ['app', 'store'], tone: 'request', label: 'Deposit 25', duration: 1.4 },
          { path: ['app', 'qry', 'readDb'], tone: 'request', label: 'GET balance', duration: 1.4, delay: 1.5 },
          { path: ['readDb', 'qry', 'app'], tone: 'error', label: '$60 (old)', duration: 1.4, delay: 3 },
          { path: ['store', 'proj'], tone: 'event', label: 'position ...005 arrives', duration: 1.4, delay: 3.4 },
        ],
        panel: {
          title: 'The race',
          icon: 'Clock',
          rows: [
            { text: 'event v4 stored (position ...005)', value: 't+0 ms', tone: 'good' },
            { text: 'user asks for balance', value: 't+40 ms' },
            { text: 'read model shows', value: '$60, old', tone: 'bad' },
            { text: 'projector applies position ...005', value: 't+200 ms', tone: 'warn' },
          ],
        },
        caption: 'The query beat the projection',
      },
    },
    {
      title: 'Own writes',
      tag: 'tradeoff',
      heading: 'Letting people see their own writes',
      eli5: 'The child can read the new total off the notebook line they just wrote, instead of running to the fridge. Or wait at the fridge until the chart catches up.',
      body: [
        'Return the new state, or the event’s global position, in the command response so the app shows it without a query. Or have the query wait until the projection’s checkpoint reaches that position (9,812,005), with a short timeout. The stream version (v4) cannot be used for this wait, because checkpoints count global positions and a version counts events in one stream.',
        'A third option routes the user’s own reads to the write side for a few seconds after a write. This is **read-your-writes**.',
      ],
      keyIdea: 'Hide the lag from the writer: return the result, wait for the position, or read from the write side briefly.',
      metrics: { events: '110,000', load: '4 ms', lag: '200 ms', history: 'complete' },
      metricTones: { lag: 'good' },
      scene: {
        nodes: [app, { ...cmd, status: 'active' }, { ...qry, chips: ['wait for position ...005'] }, { ...readDb, status: 'ok' }],
        links: [link('app', 'cmd'), link('app', 'qry'), link('qry', 'readDb')],
        flows: [
          { path: ['app', 'cmd'], tone: 'request', label: 'Deposit 25', duration: 1.2 },
          { path: ['cmd', 'app'], tone: 'response', label: 'ok, balance 85, position ...005', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Three ways to hide lag',
          icon: 'Zap',
          rows: [
            { text: 'return new state', value: 'no query needed', tone: 'good' },
            { text: 'query waits for position', value: 'short timeout' },
            { text: 'read the write side', value: 'few seconds' },
          ],
        },
        caption: 'The writer never sees the old number',
      },
    },
    {
      title: 'Projection lag',
      tag: 'tradeoff',
      heading: 'When a projection falls behind',
      eli5: 'If the fridge helper gets slow, the chart runs minutes behind the notebook. Somebody should notice before Grandpa reads an old total.',
      body: [
        'Lag grows when a projection falls behind. Measure it as events behind (store position minus checkpoint) and as seconds. Monitor it the way you monitor consumer lag on a queue.',
        'Alert before users see minutes-old balances, for example at 5 seconds.',
      ],
      keyIdea: 'Watch projection lag as a first-class metric, and alert before users notice.',
      metrics: { events: '110,000', load: '4 ms', lag: '45 s', history: 'complete' },
      metricTones: { lag: 'bad' },
      scene: {
        nodes: [
          { ...pStore, badge: 'position 9,812,004' },
          { ...pProj, status: 'hot', load: 93, badge: 'checkpoint 9,811,100' },
          { ...readDb, at: at(3.8, 3.8), status: 'hot' },
        ],
        links: [link('store', 'proj', { style: 'dashed', label: '904 events behind', labelTone: 'warn' }), link('proj', 'readDb')],
        flows: [{ path: ['store', 'proj', 'readDb'], tone: 'event', count: 4, duration: 2 }],
        panel: {
          title: 'Projection health',
          icon: 'Gauge',
          rows: [
            { text: 'events behind', value: '904', tone: 'warn' },
            { text: 'time behind', value: '45 s', tone: 'bad' },
            { text: 'alert threshold', value: '5 s' },
          ],
          footer: { text: 'Scale the projector or fix the slow query', tone: 'warn' },
        },
        caption: 'Lag is a number you can watch',
      },
    },
    {
      title: 'Poison event',
      tag: 'case',
      heading: 'Case: one bad event stops a projection',
      eli5: 'One notebook line is smudged and the fridge helper cannot read it. If the helper just stops, the chart freezes. If the helper skips it without telling anyone, the chart is wrong.',
      body: [
        'A projection hits an event it cannot apply, such as a missing field. It retries, then parks the event in a dead letter list and alerts someone.',
        'It keeps applying other streams but holds back later events for the affected stream until the parked one is fixed and replayed. Otherwise a balance is built on a missing event and is silently wrong. For a strictly order-sensitive view, halt and alert instead.',
      ],
      keyIdea: 'Retry, then park the failing event and alert. Hold back that stream until it is fixed, and never skip it silently.',
      metrics: { events: '110,000', load: '4 ms', lag: '2 min', history: 'complete' },
      metricTones: { lag: 'bad' },
      scene: {
        nodes: [
          { ...pStore, badge: '#9,811,101' },
          { ...pProj, status: 'hot', badge: 'apply fails' },
          { id: 'dead', kind: 'block', at: at(3.8, 3.8), label: 'dead letters', sub: 'parked + alert', icon: 'Inbox', tint: 'red' },
        ],
        links: [link('store', 'proj', { style: 'dashed' }), link('proj', 'dead', { style: 'dashed' })],
        flows: [
          { path: ['store', 'proj'], tone: 'event', label: '#9,811,101', duration: 1.2 },
          { path: ['proj', 'dead'], tone: 'error', label: 'park after 3 tries', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'What the projector does',
          icon: 'Bug',
          rows: [
            { text: 'try 1 to 3', value: 'apply fails: null email', tone: 'warn' },
            { text: 'then', value: 'park + alert', tone: 'good' },
            { text: 'same stream, later events', value: 'held back', tone: 'warn' },
            { text: 'skip silently', value: 'never', tone: 'bad' },
          ],
        },
        caption: 'Park it, tell someone, hold that stream back',
      },
    },
    {
      title: 'Rebuild',
      tag: 'concept',
      heading: 'Read models are disposable: rebuild by replay',
      eli5: 'If the fridge chart has a mistake, the child draws a fresh one from the notebook, then swaps it onto the fridge. The notebook never changed.',
      body: [
        'If a read model has a bug, fix the projection, create a new table and replay the log from position zero into it. When it has caught up, switch queries to the new table and drop the old one.',
        'Users keep reading the old table while the new one builds.',
      ],
      keyIdea: 'Fix the projection, replay from position zero into a new table, then swap. Read models are never the truth.',
      metrics: { events: '110,000', load: '4 ms', lag: 'rebuild: hours', history: 'complete' },
      scene: {
        nodes: [
          { ...pStore, badge: 'replay from 0' },
          { ...pProj, status: 'active', badge: 'fixed code' },
          { ...readDb, at: at(3.8, 3.8), status: 'dim', label: 'balances_v1', sub: 'buggy, still served' },
          { id: 'readDb2', kind: 'db', at: at(-3.8, 3.8), label: 'balances_v2', sub: 'rebuilding', status: 'active', badge: '63%' },
        ],
        links: [link('store', 'proj', { style: 'dashed' }), link('proj', 'readDb', { style: 'faint' }), link('proj', 'readDb2')],
        flows: [
          { path: ['store', 'proj', 'readDb2'], tone: 'event', count: 4, label: 'replay', duration: 2 },
        ],
        panel: {
          title: 'Blue-green rebuild',
          icon: 'Repeat',
          rows: [
            { text: '1 fix the projection', value: '' },
            { text: '2 build balances_v2', value: 'from position 0' },
            { text: '3 switch queries to v2', value: 'when caught up', tone: 'good' },
            { text: '4 drop balances_v1', value: '' },
          ],
        },
        caption: 'Build the new view beside the old one',
      },
    },
    {
      title: 'New questions',
      tag: 'case',
      heading: 'Case: a fraud team asks a question about last year',
      eli5: 'Grandpa asks: "How often did you spend money within a minute of getting it?" The fridge chart cannot say, but the notebook can. So the child draws a new chart from the old lines.',
      body: [
        'A fraud team wants "accounts that withdrew more than 90% of a deposit within 60 seconds, over the past year". With a CRUD table that cannot be answered, because the intermediate states were overwritten.',
        'With an event log, the team writes a new projection and replays a year of events into a new table. It catches up in a few hours, then keeps up like any other projection. The write side does not change.',
      ],
      keyIdea: 'A complete log lets you answer questions you did not plan for, by building a new read model from old facts.',
      metrics: { events: '110,000', load: '4 ms', lag: 'rebuild: hours', history: 'complete' },
      scene: {
        nodes: [
          { ...pStore, badge: 'replay from 0' },
          { ...pProj, status: 'dim' },
          { id: 'fraud', kind: 'search', at: at(3.8, 3.8), label: 'fraud view', sub: 'new projection', status: 'active', badge: 'catching up 41%' },
        ],
        links: [link('store', 'proj', { style: 'dashed' }), link('store', 'fraud', { style: 'dashed', route: 'straight' })],
        flows: [{ path: ['store', 'fraud'], tone: 'event', label: 'year of events', count: 5, duration: 1.6 }],
        panel: {
          title: 'Withdrew 90% within 60 s',
          icon: 'Shield',
          rows: [
            { text: 'CRUD table', value: 'cannot answer', tone: 'bad' },
            { text: 'event log', value: 'new projection', tone: 'good' },
            { text: 'catch-up time', value: 'a few hours', tone: 'warn' },
          ],
        },
        caption: 'A new read model built from old facts',
      },
    },
    {
      title: 'Event design',
      tag: 'concept',
      heading: 'Name events for business meaning',
      eli5: 'A good notebook line says "bought a toy". A bad line says "changed the number". The second one tells nobody why.',
      body: [
        'Events should say what happened in the business, in the past tense: `ChargeDisputed`, `AccountClosed`. A generic `AccountUpdated {balance: 60}` only repeats a table edit and loses the reason.',
        'Keep payloads small but complete enough that a projection never has to call back into the write side.',
      ],
      keyIdea: 'An event records intent and facts in business words. It should not mirror a row update.',
      metrics: { events: '110,000', load: '4 ms', lag: '200 ms', history: 'complete' },
      scene: {
        nodes: [{ ...cmd, at: at(-3.8, -3.8) }, { ...store, at: at(0, -3.8), status: 'ok' }, { ...proj, at: at(3.8, -3.8), status: 'active' }],
        links: [link('cmd', 'store'), link('store', 'proj', { style: 'dashed' })],
        flows: [{ path: ['cmd', 'store', 'proj'], tone: 'event', duration: 2.2 }],
        panel: {
          title: 'Two ways to record the same change',
          icon: 'List',
          rows: [
            { text: 'AccountUpdated {balance: 60}', value: 'what, not why', tone: 'bad' },
            { text: 'MoneyWithdrawn {cents: 4000}', value: 'clear fact', tone: 'good' },
            { text: 'ChargeDisputed {charge: c-9}', value: 'carries intent', tone: 'good' },
          ],
        },
        caption: 'Say why, not just what changed',
      },
    },
    {
      title: 'Upcasting',
      tag: 'concept',
      heading: 'Events are forever, so old shapes must still load',
      eli5: 'The notebook once had lines with only an amount. Now each line also names a coin type. When the child reads an old page, they just assume it was dollars.',
      body: [
        'Each stored event carries a `schema` number, the version of its payload shape. A field added to `MoneyDeposited` in schema 2 means readers must still understand version 1 events. An **upcaster** converts old shapes to the current one when events are read.',
        'The stored events are never rewritten. Prefer adding optional fields over changing the meaning of existing ones.',
      ],
      keyIdea: 'Upcast old event versions on read. Never rewrite stored events.',
      metrics: { events: '110,000', load: '4 ms', lag: '200 ms', history: 'complete' },
      scene: {
        nodes: [
          { ...store, at: at(-3.8, -3.8), chips: ['MoneyDeposited v1', 'MoneyDeposited v2'] },
          { id: 'upcaster', kind: 'block', at: at(0, -3.8), label: 'upcaster', sub: 'v1 to v2 on read', icon: 'ArrowLeftRight', tint: 'green' },
          { ...proj, at: at(3.8, -3.8), status: 'active', badge: 'sees v2 only' },
        ],
        links: [link('store', 'upcaster'), link('upcaster', 'proj')],
        flows: [
          { path: ['store', 'upcaster'], tone: 'event', label: 'v1 {cents}', duration: 1.2 },
          { path: ['upcaster', 'proj'], tone: 'event', label: 'v2 {cents, currency: USD}', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Same event, two shapes',
          icon: 'FileJson',
          rows: [
            { text: 'v1 on disk', value: '{ cents }' },
            { text: 'v2 on disk', value: '{ cents, currency }' },
            { text: 'v1 as read', value: 'currency = USD', tone: 'good' },
          ],
        },
        caption: 'Convert on read, keep the original',
      },
      code: {
        language: 'typescript',
        title: 'An upcaster',
        source: `// Events stored before v2 have no currency. Add it on the way out of the store.
function upcast(e: StoredEvent): StoredEvent {
  if (e.type === 'MoneyDeposited' && e.schema === 1) {
    return { ...e, schema: 2, data: { ...e.data, currency: 'USD' } };
  }
  return e;
}

const events = (await store.read(streamId)).map(upcast);`,
        highlight: [3, 4, 9],
      },
    },
    {
      title: 'Forgetting',
      tag: 'tradeoff',
      heading: 'Deleting personal data from an immutable log',
      eli5: 'A page in the notebook has the child’s friend’s name on it. The friend asks to be forgotten, but pages cannot be torn out. So the names were written in a secret code, and the friend’s code key gets thrown away.',
      body: [
        'The log is append-only, so a **crypto-shredding** answer is to encrypt personal fields with a per-user key and delete the key on request. The events stay and totals still add up.',
        'The key only protects the log. Snapshots, read models, the search index and published events may hold the plaintext, so those copies must be purged or rebuilt, or never hold it at all.',
      ],
      keyIdea: 'Encrypt personal fields per user and delete the key to forget them, leaving the log intact.',
      metrics: { events: '110,000', load: '4 ms', lag: '200 ms', history: 'complete' },
      scene: {
        nodes: [
          cmd,
          { ...store, chips: ['name: enc(a91f...)'] },
          { id: 'vault', kind: 'block', at: at(0, 3.8), label: 'key vault', sub: 'one key per user', icon: 'KeyRound', tint: 'red', status: 'active', badge: 'key u-9 deleted' },
        ],
        links: [link('cmd', 'store'), link('cmd', 'vault', { style: 'dashed' })],
        flows: [
          { path: ['vault', 'cmd'], tone: 'data', label: 'key u-9', duration: 1.2 },
          { path: ['cmd', 'store'], tone: 'event', label: 'name encrypted', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'Forget user u-9',
          icon: 'Shield',
          rows: [
            { text: 'delete key in vault', value: 'done', tone: 'good' },
            { text: 'name in old events', value: 'unreadable', tone: 'good' },
            { text: 'balance totals', value: 'unchanged' },
            { text: 'read models and snapshots', value: 'purge or rebuild', tone: 'warn' },
          ],
        },
        caption: 'Throw away the key, keep the log',
      },
      quiz: {
        question: 'A user asks to be forgotten, and their name appears in thousands of immutable events. What is the usual approach?',
        options: [
          'Edit every old event to remove the name',
          'Encrypt personal fields with a per-user key and delete the key',
          'Delete the whole stream and rebuild all balances',
          'Refuse, because the log is immutable',
        ],
        answer: 1,
        explain: 'Deleting the key makes the personal fields unreadable while the events stay untouched, so totals and history remain correct.',
      },
    },
    {
      title: 'Event table',
      tag: 'concept',
      heading: 'An event store can be one SQL table',
      eli5: 'The shelf of notebooks can be an ordinary cupboard with numbered slots. The rule is that no two lines can ever take the same page number in the same notebook.',
      body: [
        'A Postgres table with a unique `(stream_id, version)` gives you ordered streams and the expected-version check. Kafka has no such check.',
        'A bigserial position is not a safe global order. Transactions can commit out of order, so a reader past position N can miss a later commit with a lower one. Tolerate gaps and trust only positions below the oldest in-flight transaction, or use a single writer.',
      ],
      keyIdea: 'A unique (stream, version) constraint is the whole concurrency mechanism. Pick a store that gives you it.',
      metrics: { events: '110,000', load: '4 ms', lag: '200 ms', history: 'complete' },
      scene: {
        nodes: [{ ...cmd, status: 'active' }, { ...store, status: 'ok', sub: 'events table' }],
        links: [link('cmd', 'store')],
        flows: [
          { path: ['cmd', 'store'], tone: 'event', label: 'INSERT (account-42, v4)', duration: 1.2 },
          { path: ['cmd', 'store'], tone: 'event', label: 'INSERT (account-42, v4)', duration: 1.2, delay: 1.4 },
          { path: ['store', 'cmd'], tone: 'error', label: 'unique violation', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'Postgres, Kafka, EventStoreDB',
          icon: 'Database',
          rows: [
            { text: 'Postgres table', value: 'works well', tone: 'good' },
            { text: 'EventStoreDB', value: 'built for it', tone: 'good' },
            { text: 'Kafka as the store', value: 'poor fit', tone: 'warn' },
            { text: 'bigserial position', value: 'gaps, out-of-order commits', tone: 'warn' },
          ],
        },
        caption: 'The constraint rejects the second writer',
      },
      code: {
        language: 'sql',
        title: 'An events table',
        source: `CREATE TABLE events (
  position   bigserial PRIMARY KEY,   -- global order for readers
  stream_id  text  NOT NULL,
  version    int   NOT NULL,
  type       text  NOT NULL,
  data       jsonb NOT NULL,
  meta       jsonb NOT NULL,
  UNIQUE (stream_id, version)         -- the expected-version check
);`,
        highlight: [2, 8],
      },
    },
    {
      title: 'Telling others',
      tag: 'concept',
      heading: 'The log is also how you tell other services',
      eli5: 'Other children who want to know about new coins read the same notebook, starting where they stopped last time. Nobody has to remember to tell them.',
      body: [
        'A **dual write** saves to the database, then publishes to a broker, as two steps. A crash between them loses the message. With a log the append is the only write, and the publisher is a reader with a checkpoint. A crash before the checkpoint is saved resends the batch, so delivery is at least once.',
        'Delivery is at least once, so subscribers must be idempotent, like projections.',
      ],
      keyIdea: 'Publishing from the log avoids the dual write: there is one record, and everyone reads it by position.',
      metrics: { events: '110,000', load: '4 ms', lag: '300 ms', history: 'complete' },
      scene: {
        nodes: [
          { ...pStore, status: 'ok' },
          { id: 'broker', kind: 'queue', at: at(0, 3.8), label: 'message broker', sub: 'publisher + checkpoint' },
          { id: 'email', kind: 'block', at: at(3.8, 3.8), label: 'email service', icon: 'Mail', tint: 'blue' },
          { id: 'analytics', kind: 'block', at: at(-3.8, 3.8), label: 'analytics', icon: 'TrendingUp', tint: 'green' },
        ],
        links: [link('store', 'broker', { style: 'dashed' }), link('broker', 'email'), link('broker', 'analytics')],
        flows: [
          { path: ['store', 'broker'], tone: 'event', label: 'MoneyWithdrawn', duration: 1.2 },
          { path: ['broker', 'email'], tone: 'event', duration: 1.2, delay: 1.3 },
          { path: ['broker', 'analytics'], tone: 'event', duration: 1.2, delay: 1.5 },
        ],
        caption: 'One log, read by position',
      },
    },
    {
      title: 'Public events',
      tag: 'concept',
      heading: 'Internal events versus the public contract',
      eli5: 'The notebook has every detail. The note the child sends to the neighbors is shorter and always has the same format, even if the notebook format changes.',
      body: [
        'Internal events are detailed and change as the model evolves. Other teams need a steadier contract. Translate internal events into smaller **integration events** such as `PaymentMade`, and version those carefully.',
        'Otherwise every internal change breaks someone else.',
      ],
      keyIdea: 'Keep internal events private and publish a smaller, stable event contract to other teams.',
      metrics: { events: '110,000', load: '4 ms', lag: '300 ms', history: 'complete' },
      scene: {
        nodes: [
          { ...store, at: at(-3.8, -3.8), chips: ['MoneyWithdrawn'] },
          { id: 'translator', kind: 'block', at: at(0, -3.8), label: 'translator', sub: 'internal to public', icon: 'ArrowLeftRight', tint: 'violet' },
          { id: 'broker', kind: 'queue', at: at(3.8, -3.8), label: 'public topic', chips: ['PaymentMade {amount}'] },
        ],
        links: [link('store', 'translator'), link('translator', 'broker')],
        flows: [
          { path: ['store', 'translator', 'broker'], tone: 'event', label: 'PaymentMade', duration: 2 },
        ],
        panel: {
          title: 'Two contracts',
          icon: 'Network',
          rows: [
            { text: 'internal event', value: 'detailed, may change' },
            { text: 'integration event', value: 'small, stable', tone: 'good' },
            { text: 'consumers', value: 'see only the second', tone: 'good' },
          ],
        },
        caption: 'Translate before you publish',
      },
    },
    {
      title: 'Sagas',
      tag: 'concept',
      heading: 'Events can trigger the next command',
      eli5: 'Moving $100 from one child’s notebook to another takes two lines in two notebooks. A helper watches for the first line, then asks for the second, and writes an undo line if the second fails.',
      body: [
        'A transfer touches two accounts, so it cannot be one append. A **process manager** (saga) listens to events and sends the next command: after `MoneyWithdrawn` on A, it sends `Deposit` to B.',
        'If B refuses, the saga sends a compensating command that reverses A.',
      ],
      keyIdea: 'A saga reacts to events with new commands, and compensates with reversing events when a step fails.',
      metrics: { events: '110,000', load: '4 ms', lag: '300 ms', history: 'complete' },
      scene: {
        nodes: [
          { ...cmd, at: at(-3.8, -3.8) },
          { ...store, at: at(0, -3.8) },
          { id: 'saga', kind: 'block', at: at(0, 3.8), label: 'transfer saga', sub: 'process manager', icon: 'Workflow', tint: 'violet', status: 'active' },
        ],
        links: [link('cmd', 'store'), link('store', 'saga', { style: 'dashed' }), link('saga', 'cmd', { style: 'dashed' })],
        flows: [
          { path: ['store', 'saga'], tone: 'event', label: 'MoneyWithdrawn on A', duration: 1.2 },
          { path: ['saga', 'cmd'], tone: 'request', label: 'Deposit 100 to B', duration: 1.2, delay: 1.3 },
          { path: ['cmd', 'store'], tone: 'event', label: 'MoneyDeposited on B', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'Transfer of 100',
          icon: 'Route',
          rows: [
            { text: '1 withdraw from A', value: 'MoneyWithdrawn', tone: 'good' },
            { text: '2 deposit to B', value: 'MoneyDeposited', tone: 'good' },
            { text: 'if 2 fails', value: 'reverse A', tone: 'warn' },
          ],
        },
        caption: 'Event in, command out',
      },
    },
    {
      title: 'Testing',
      tag: 'concept',
      heading: 'Tests read like a story: given, when, then',
      eli5: 'To check a rule, the child pretends the notebook already has some lines, asks to spend, and checks the answer. No real piggy bank is needed.',
      body: [
        'A command handler is a pure function from past events and a command to new events or a refusal. So tests need no database: give a list of events, run the command, assert on the result.',
        'This keeps rule tests fast and readable.',
      ],
      keyIdea: 'Decisions are pure over events, so tests are given events, when a command, then events or an error.',
      metrics: { events: '3', load: '1 ms', lag: '0', history: 'complete' },
      scene: {
        nodes: [
          { id: 'test', kind: 'block', at: at(-3.8, -3.8), label: 'test', sub: 'given, when, then', icon: 'Bug', tint: 'green' },
          { ...cmd, at: at(0, -3.8), status: 'active' },
          { ...store, at: at(3.8, -3.8), status: 'dim', badge: 'not needed' },
        ],
        links: [link('test', 'cmd'), link('cmd', 'store', { style: 'faint' })],
        flows: [
          { path: ['test', 'cmd'], tone: 'request', label: 'given 3 events, Withdraw 70', duration: 1.4 },
          { path: ['cmd', 'test'], tone: 'response', label: 'refused: insufficient funds', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Given, when, then',
          icon: 'Code',
          rows: [
            { text: 'given', value: 'opened, +100, -40' },
            { text: 'when', value: 'Withdraw 70' },
            { text: 'then', value: 'refused', tone: 'good' },
          ],
        },
        caption: 'No database in the test',
      },
      code: {
        language: 'typescript',
        title: 'A rule test with no database',
        source: `test('refuses an overdraft', () => {
  const given = [opened('a1'), deposited(10000), withdrawn(4000)];   // balance 60

  const result = decide(given, { type: 'Withdraw', cents: 7000 });

  expect(result).toEqual({ refused: 'insufficient funds' });
});`,
        highlight: [2, 4, 6],
      },
    },
    {
      title: 'Worth it?',
      tag: 'tradeoff',
      heading: 'When it earns its complexity, and when it does not',
      eli5: 'A notebook is worth it for money, where every coin matters. For a list of favorite colors, a single sticky note is fine.',
      body: [
        '**Use it** where the history is the business: ledgers, payments, inventory movements, insurance claims, order workflows. Also where you need "what was true at time T", or many read shapes from one stream of changes.',
        '**Skip it** for CRUD data whose past nobody asks about, such as user settings or a product description. There you pay for versioning, projections and lag, and get nothing back.',
      ],
      keyIdea: 'Event sourcing pays off when history and many read shapes are core needs. For plain CRUD it adds cost with no return.',
      metrics: { events: 'per domain', load: '4 ms', lag: '200 ms', history: 'where it matters' },
      scene: {
        nodes: [
          { ...cmd, status: 'ok' },
          { ...store, status: 'ok', badge: 'ledger only' },
          { id: 'crud', kind: 'db', at: at(0, 3.8), label: 'settings table', sub: 'plain CRUD', status: 'ok' },
        ],
        links: [link('cmd', 'store'), link('cmd', 'crud')],
        flows: [
          { path: ['cmd', 'store'], tone: 'event', label: 'ledger: events', duration: 1.4 },
          { path: ['cmd', 'crud'], tone: 'data', label: 'settings: UPDATE', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Use it or skip it',
          icon: 'Scale',
          rows: [
            { text: 'ledger, payments, claims', value: 'use it', tone: 'good' },
            { text: 'settings, content pages', value: 'skip it', tone: 'bad' },
            { text: 'plain CQRS replicas', value: 'often enough', tone: 'muted' },
          ],
          footer: { text: 'Event-source only the part where history matters', tone: 'muted' },
        },
        caption: 'Event-source the part where history matters',
      },
    },
    {
      title: 'Recap 2',
      tag: 'recap',
      heading: 'Facts in a log, answers in read models',
      eli5: 'Write every coin in the notebook, never erase, and keep handy charts on the fridge that catch up a moment later. Do it only for things where every coin matters.',
      body: [
        'Read models are **eventually consistent**, so design for read-your-writes, watch lag and park poison events. Rebuild views by replay, upcast old event versions, and encrypt personal fields so keys can be deleted.',
        'Publish a stable contract, use sagas for multi-step work, and test with given, when, then. Use it where history matters, and leave plain CRUD alone.',
      ],
      keyIdea: 'Keep the facts, derive the views. Pay for it only where history and many read shapes are worth the extra moving parts.',
      metrics: { events: '110,000', load: '4 ms', lag: '200 ms', history: 'complete' },
      metricTones: { load: 'good', history: 'good' },
      scene: {
        nodes: [app, cmd, store, { ...proj, status: 'ok' }, { ...readDb, status: 'ok' }],
        links: [link('app', 'cmd'), link('cmd', 'store'), link('store', 'proj', { style: 'dashed' }), link('proj', 'readDb'), link('app', 'readDb', { label: 'queries' })],
        flows: [
          { path: ['app', 'cmd', 'store', 'proj', 'readDb'], tone: 'event', duration: 2.6 },
          { path: ['app', 'readDb', 'app'], tone: 'request', duration: 2.6, delay: 1.3 },
        ],
        caption: 'Write to the log, read from the views',
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
