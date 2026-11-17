import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const client: SceneNode = { id: 'client', kind: 'client', at: at(-6, 0), label: 'browser' };
const app: SceneNode = { id: 'app', kind: 'server', at: at(-2, 0), label: 'app server' };
const db: SceneNode = { id: 'db', kind: 'db', at: at(2.5, 0), label: 'Postgres' };
const cache: SceneNode = { id: 'cache', kind: 'cache', at: at(6, -3.4), label: 'Redis' };
const svc: SceneNode = { id: 'svc', kind: 'block', size: 0.8, at: at(2.5, 3.8), label: 'pricing service', icon: 'Receipt', tint: 'violet' };
const queue: SceneNode = { id: 'queue', kind: 'block', size: 0.8, at: at(2.5, 3.8), label: 'job queue', icon: 'Inbox', tint: 'amber' };
const worker: SceneNode = { id: 'worker', kind: 'block', size: 0.8, at: at(6, 3.8), label: 'worker', icon: 'Cpu', tint: 'teal' };
const ext: SceneNode = { id: 'ext', kind: 'block', size: 0.8, at: at(6, -3.4), label: 'email provider', icon: 'Mail', tint: 'gray' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

export const performanceAntipatternsPart2: Lesson = {
  id: 'performance-antipatterns-part-2',
  title: 'Performance antipatterns clinic (part 2)',
  tagline: 'Slow work on the request path, blocked threads, locks, connections, noisy neighbors and retry storms.',
  minutes: 15,
  level: 'Intermediate',
  learn: [
    'Moving slow side work onto a queue, and avoiding blocking I/O',
    'Busy front ends and busy databases: work in the wrong place',
    'Hot shared locks and how to split them',
    'Connection pools and improper instantiation',
    'Noisy neighbors, monolithic persistence and retry storms',
  ],
  metrics: [
    { key: 'p99', label: 'p99', icon: 'Timer' },
    { key: 'calls', label: 'Calls per page', icon: 'Repeat' },
    { key: 'dbcpu', label: 'DB CPU', icon: 'Cpu' },
    { key: 'errors', label: 'Errors', icon: 'Bug' },
  ],
  steps: [
    {
      title: 'Slow inline',
      tag: 'case',
      heading: 'Antipattern 9: slow work inside the request',
      eli5: 'At checkout the cashier stops to bake your birthday cake while the whole line waits. Nobody behind you can pay until the cake is done.',
      body: [
        'Placing an order saves the order, then sends a confirmation email through an external provider, builds a PDF invoice and updates analytics, all before replying.',
        'The email provider takes 800 ms on a good day and 10 seconds on a bad one. The customer waits for all of it, and if the provider is down, checkout fails.',
        'Part 2 now follows the checkout path, so the p99 metric here is checkout latency (part 1 tracked the order history page).',
      ],
      keyIdea: 'Anything on the request path adds to the customer wait and to the failure risk.',
      metrics: { p99: '1.4 s', calls: '63', dbcpu: '25%', errors: '0.4%' },
      metricTones: { p99: 'bad' },
      scene: {
        nodes: [{ ...app, status: 'hot', badge: 'waiting 1.4 s' }, { ...db, status: 'ok' }, { ...ext, status: 'hot', badge: '800 ms to 10 s' }],
        links: [link('app', 'db'), link('app', 'ext', { label: 'inside the request', labelTone: 'warn' })],
        flows: [
          { path: ['app', 'db', 'app'], tone: 'request', label: 'save order', duration: 1.2 },
          { path: ['app', 'ext'], tone: 'request', label: 'send email', duration: 1.2, delay: 1.3 },
          { path: ['ext', 'app'], tone: 'error', label: 'slow', duration: 1.6, delay: 2.6 },
        ],
        panel: {
          title: 'Checkout, step by step',
          icon: 'Clock',
          rows: [
            { text: 'Save order', value: '20 ms' },
            { text: 'Send email', value: '800 ms +', tone: 'bad' },
            { text: 'Build PDF invoice', value: '400 ms', tone: 'warn' },
            { text: 'Reply to the customer', value: '1.4 s', tone: 'bad' },
          ],
        },
        caption: 'The customer waits for the email provider',
      },
    },
    {
      title: 'Use a queue',
      tag: 'case',
      heading: 'The fix: reply first, do the rest later',
      eli5: 'The cashier takes the order, hands you a ticket and tells the bakery in the back, the **worker**, to bake. You are out of the line in seconds.',
      body: [
        'Save the order, put a message on a **queue** and return. A **worker** sends the email and builds the invoice a second later, retrying on its own if the provider fails.',
        'A typical checkout now replies in 120 ms and the p99 drops from 1.4 s to 400 ms. It no longer depends on the provider being up. The cost is more machinery and eventual completion: the email arrives a few seconds later.',
      ],
      keyIdea: 'Reply as soon as the essential write is safe. Hand everything else to a queue.',
      metrics: { p99: '400 ms', calls: '63', dbcpu: '25%', errors: '0.4%' },
      metricTones: { p99: 'good' },
      scene: {
        nodes: [{ ...app, status: 'ok', badge: 'reply in 120 ms' }, { ...queue, status: 'active', chips: ['send_email', 'invoice'] }, { ...worker, status: 'active' }, { ...ext, badge: '800 ms to 10 s' }],
        links: [link('app', 'queue'), link('queue', 'worker'), link('worker', 'ext')],
        flows: [
          { path: ['app', 'queue'], tone: 'event', label: 'enqueue', duration: 1 },
          { path: ['queue', 'worker', 'ext'], tone: 'event', label: 'email', duration: 1.8, delay: 1.1 },
        ],
        panel: { title: 'Checkout now', icon: 'Zap', rows: [{ text: 'Save order, enqueue, typical', value: '120 ms', tone: 'good' }, { text: 'Checkout p99', value: '400 ms', tone: 'good' }, { text: 'Email, invoice', value: 'a few seconds later' }, { text: 'Provider down', value: 'worker retries', tone: 'good' }] },
        caption: 'The customer waits for the order, not for the email',
      },
      quiz: {
        question: 'Which task belongs on the request path of a checkout call?',
        options: [
          'Saving the order so it is not lost',
          'Sending the confirmation email',
          'Building the PDF invoice',
          'Updating the analytics dashboard',
        ],
        answer: 0,
        explain: 'The order write must be safe before the reply. The email, invoice and analytics can complete a little later through a queue without the customer noticing.',
      },
    },
    {
      title: 'Blocking I/O',
      tag: 'case',
      heading: 'Antipattern 10: threads that wait',
      eli5: 'Each cashier stands still at the till until the cake is baked. With ten cashiers and ten cakes, the eleventh shopper waits even though nobody is working.',
      body: [
        '**Synchronous I/O** holds a thread while it waits for a database, a file or another service. A server with 200 threads and 200 slow calls in flight has no threads left, so new requests queue while CPU sits near 10%.',
        'Use async or non-blocking I/O, set a timeout on every outbound call, and give slow dependencies their own small pool so one slow service cannot take every thread.',
      ],
      keyIdea: 'Waiting should not hold a thread, and every wait needs a timeout.',
      metrics: { p99: '400 ms', calls: '63', dbcpu: '25%', errors: '0.4%' },
      scene: {
        nodes: [{ ...client, chips: [{ text: 'GET /orders', tone: 'warn' }] }, { ...app, status: 'hot', load: 12, badge: '200 of 200 threads waiting' }, { ...svc, status: 'hot', badge: 'slow, 4 s' }],
        links: [link('client', 'app', { label: 'queued', labelTone: 'warn' }), link('app', 'svc', { label: 'thread held', labelTone: 'warn' })],
        flows: [{ path: ['client', 'app'], tone: 'request', count: 4, duration: 1 }, { path: ['app', 'svc'], tone: 'request', count: 3, duration: 1.4, delay: 1 }],
        panel: { title: 'Busy but idle', icon: 'Clock', rows: [{ text: 'Thread pool', value: '200 / 200', tone: 'bad' }, { text: 'CPU', value: '12%', tone: 'good' }, { text: 'Timeout on the call', value: 'none', tone: 'bad' }] },
        caption: 'High latency with low CPU',
      },
    },
    {
      title: 'Busy front end',
      tag: 'case',
      heading: 'Antipattern 11: heavy work on the request thread',
      eli5: 'The cashier also stops to resize photos and zip parcels at the till. The line grows because the same person is serving and packing.',
      body: [
        'A **busy front end** runs CPU-heavy work such as resizing images, rendering PDFs or compressing files on the threads that serve requests. One 2-second job blocks a core, and fast requests behind it slow down too.',
        'Move heavy jobs to workers through a queue, or scale them as their own service. Keep request handlers short.',
      ],
      keyIdea: 'Keep request threads for quick work and send heavy jobs to workers.',
      metrics: { p99: '400 ms', calls: '63', dbcpu: '25%', errors: '0.4%' },
      scene: {
        nodes: [{ ...client, chips: ['GET /orders', { text: 'POST /avatar', tone: 'warn' }] }, { ...app, status: 'hot', load: 96, badge: 'resizing 8 MB image' }, { ...queue, status: 'ok', badge: 'resize jobs' }],
        links: [link('client', 'app'), link('app', 'queue', { style: 'dashed', label: 'better' })],
        flows: [
          { path: ['client', 'app'], tone: 'request', label: 'POST /avatar', duration: 1 },
          { path: ['app', 'queue'], tone: 'event', label: 'resize job', duration: 1, delay: 1.2 },
        ],
        panel: { title: 'One core, two jobs', icon: 'Cpu', rows: [{ text: 'Resize an image', value: '2 s of CPU', tone: 'bad' }, { text: 'A normal read', value: '8 ms' }, { text: 'Read stuck behind a resize', value: '2 s', tone: 'bad' }] },
        caption: 'Slow work holds up fast requests',
      },
    },
    {
      title: 'Busy database',
      tag: 'case',
      heading: 'Antipattern 12: too much work inside the database',
      eli5: 'The pantry also cooks, sorts and counts everything for the shop. The pantry is the one room with a single door, so the whole shop waits on it.',
      body: [
        'A **busy database** runs heavy logic in stored procedures, big reports on the primary, or sorts and formats results in SQL. The database is the hardest part of the system to scale, so every cycle it spends on app work is expensive.',
        'Keep the primary for transactions. Move report queries to a read replica or a warehouse, and move formatting and business logic to app servers that scale out.',
      ],
      keyIdea: 'Spend database CPU on data access. Do other work where it scales cheaply.',
      metrics: { p99: '400 ms', calls: '63', dbcpu: '85%', errors: '0.4%' },
      metricTones: { dbcpu: 'bad' },
      scene: {
        nodes: [{ ...app, status: 'active' }, { ...db, status: 'hot', load: 88, chips: [{ text: 'monthly report, 90 s', tone: 'bad' }, 'orders insert'] }, { id: 'replica', kind: 'replica', at: at(6, 3.4), label: 'read replica', status: 'ok', badge: 'reports here' }],
        links: [link('app', 'db'), link('db', 'replica', { style: 'dashed', label: 'copies' })],
        flows: [
          { path: ['app', 'db'], tone: 'request', label: 'checkout', count: 3, duration: 1 },
          { path: ['db', 'replica'], tone: 'data', label: 'replication', duration: 1.2, delay: 1.2 },
        ],
        panel: { title: 'Where work should run', icon: 'Scale', rows: [{ text: 'Checkout writes', value: 'primary', tone: 'good' }, { text: 'Reports, exports', value: 'replica or warehouse', tone: 'good' }, { text: 'Formatting, rules', value: 'app servers', tone: 'good' }] },
        caption: 'The primary should only do transactions',
      },
    },
    {
      title: 'Hot lock',
      tag: 'case',
      heading: 'Antipattern 13: everyone waits on one lock',
      eli5: 'Every cashier has to write each sale in one shared notebook with one pen. More cashiers do not help, because they all queue for the pen.',
      body: [
        'Each order increments a global counter row, `UPDATE stats SET orders_today = orders_today + 1`. Row updates hold a lock until the transaction commits, so every checkout queues for the same row.',
        'Throughput is capped by how fast one row can be locked and released, no matter how many servers you add. Latency is high while CPU is low, because requests are waiting, not working.',
      ],
      keyIdea: 'When latency is high and CPU is low, look for something every request has to take in turn.',
      metrics: { p99: '400 ms', calls: '63', dbcpu: '30%, lock waits', errors: '0.4%' },
      metricTones: { p99: 'warn' },
      scene: {
        nodes: [{ ...app, status: 'hot', load: 20, badge: '300 waiting' }, { ...db, status: 'hot', load: 30, badge: 'row lock: stats', chips: [{ text: 'UPDATE stats +1', tone: 'warn' }] }],
        links: [link('app', 'db', { label: 'one row, one at a time', labelTone: 'warn' })],
        flows: [{ path: ['app', 'db'], tone: 'request', label: 'UPDATE stats +1', count: 6, duration: 2.6 }],
        panel: { title: 'Same pattern, other places', icon: 'List', rows: [{ text: 'Global counter row', value: 'every order' }, { text: 'Global mutex in app code', value: 'every request' }, { text: 'Stock row of a viral item', value: 'every buyer' }, { text: 'Id sequence table', value: 'every insert' }] },
        caption: 'Thousands of writers queue for one row',
      },
    },
    {
      title: 'Split the lock',
      tag: 'case',
      heading: 'The fix: spread or buffer the contention',
      eli5: 'Give each cashier a small notebook of their own, and add the pages up at closing time. Nobody waits for the pen any more.',
      body: [
        'Keep N counter rows and add to a random one, summing on read. Or buffer increments in memory or Redis and flush every second. Or shorten the transaction so the lock is held for less time.',
        'Also ask whether the number needs to be exact and live. Often a count that is one second old is fine.',
      ],
      keyIdea: 'Split the hot row, buffer the writes, or relax the need for an exact live number.',
      metrics: { p99: '300 ms', calls: '63', dbcpu: '30%', errors: '0.4%' },
      metricTones: { p99: 'good' },
      scene: {
        nodes: [{ ...app, status: 'ok' }, { ...cache, status: 'ok', badge: 'INCR, flush 1 s' }, { ...db, status: 'ok', load: 30, badge: '+812 once a second' }],
        links: [link('app', 'cache'), link('cache', 'db', { style: 'dashed', label: 'batched' })],
        flows: [
          { path: ['app', 'cache'], tone: 'request', label: 'INCR', count: 4, duration: 0.8 },
          { path: ['cache', 'db'], tone: 'data', label: '+812 once', duration: 1.2, delay: 1.2 },
        ],
        panel: { title: 'Lock fixes', icon: 'Split', rows: [{ text: 'N counter rows', value: 'sum on read' }, { text: 'Buffer and flush', value: 'one write per second' }, { text: 'Shorter transaction', value: 'lock held less' }, { text: 'Approximate number', value: 'no lock at all' }] },
        caption: 'Thousands of increments become one write',
      },
    },
    {
      title: 'No pool',
      tag: 'case',
      heading: 'Antipattern 14: a new connection for every request',
      eli5: 'Every shopper builds a new trolley at the door and throws it away at the till. A rack of shared trolleys, a **pool**, would save all that building.',
      body: [
        'A script-style handler opens a database connection, runs one query and closes it. Opening a connection means a TCP handshake, a TLS handshake and authentication: often 5 to 20 ms before the first query.',
        'Postgres also starts a process per connection, so 1,500 new connections per second burns database CPU on setup alone.',
      ],
      keyIdea: 'Connection setup is expensive work that gets repeated for every request.',
      metrics: { p99: '400 ms', calls: '63', dbcpu: '45%', errors: '0.4%' },
      metricTones: { dbcpu: 'warn' },
      scene: {
        nodes: [{ ...app, status: 'hot' }, { ...db, status: 'hot', load: 45, badge: '1,500 new connections/s' }],
        links: [link('app', 'db', { label: 'TCP + TLS + auth, every time', labelTone: 'warn', arrow: 'both' })],
        flows: [
          { path: ['app', 'db'], tone: 'handshake', label: 'TCP + TLS + auth', count: 4, duration: 1.2 },
          { path: ['app', 'db'], tone: 'request', label: 'one query', duration: 0.9, delay: 1.4 },
        ],
        panel: { title: 'Cost of one connection', icon: 'Plug', rows: [{ text: 'TCP handshake', value: '1 round trip' }, { text: 'TLS handshake', value: '1 to 2 round trips' }, { text: 'Auth, process start', value: 'a few ms of DB CPU', tone: 'warn' }, { text: 'Before the first query', value: '5 to 20 ms', tone: 'bad' }] },
        caption: 'A full handshake for one query',
      },
    },
    {
      title: 'Pool it',
      tag: 'case',
      heading: 'The fix: a pool sized to the database',
      eli5: 'The shop keeps a rack of 20 trolleys. Each shopper borrows one and brings it back. When the rack is empty, shoppers wait in line instead of building more.',
      body: [
        'A **connection pool** keeps, say, 20 connections open per app server and lends one to each request. Setup happens once. The pool also caps concurrency, so a burst queues in the app instead of opening 3,000 connections.',
        'Size it on purpose. Too small and requests wait for a slot. Too large across 40 app servers and the database runs out of connections. A pooler in front of the database helps when many processes share it.',
      ],
      keyIdea: 'Reuse connections through a pool sized to what the database can run at once.',
      metrics: { p99: '250 ms', calls: '63', dbcpu: '20%', errors: '0.2%' },
      metricTones: { p99: 'good', dbcpu: 'good', errors: 'good' },
      scene: {
        nodes: [{ ...client }, { ...app, status: 'ok', badge: 'pool: 20 open' }, { ...db, status: 'ok', load: 20, badge: '0 new connections/s' }],
        links: [link('client', 'app'), link('app', 'db', { label: 'reused', arrow: 'both' })],
        flows: [
          { path: ['app', 'db'], tone: 'handshake', label: 'TCP + TLS + auth (once)', duration: 1.2 },
          { path: ['client', 'app'], tone: 'request', count: 4, duration: 0.9, delay: 1.4 },
          { path: ['app', 'db'], tone: 'request', label: 'query', count: 4, duration: 0.9, delay: 2.2 },
        ],
        panel: { title: 'Pool sizing', icon: 'Gauge', rows: [{ text: 'Too small', value: 'requests wait', tone: 'warn' }, { text: 'Right size', value: '20 per app server', tone: 'good' }, { text: '40 servers x 20', value: '800, check the DB limit', tone: 'warn' }, { text: 'Many processes', value: 'add a pooler', tone: 'muted' }] },
        caption: 'Handshake once, then reuse',
      },
    },
    {
      title: 'New client',
      tag: 'case',
      heading: 'Antipattern 15: improper instantiation',
      eli5: 'Every shopper builds a new phone line to the pricing counter before asking one question. One shared phone line would do for all of them.',
      body: [
        '**Improper instantiation** is creating an expensive, reusable object for every request: an HTTP client, a database client, a TLS context or a compiled regex. Each new HTTP client opens fresh sockets and can exhaust ports under load.',
        'Create these once at startup and share them. The pool lesson above is the same idea applied to connections.',
      ],
      keyIdea: 'Build expensive clients once, share them, and let them pool their own connections.',
      metrics: { p99: '250 ms', calls: '63', dbcpu: '20%', errors: '0.2%' },
      scene: {
        nodes: [{ ...app, status: 'active', chips: [{ text: 'new HttpClient()', tone: 'bad' }] }, { ...svc, status: 'hot', badge: '30,000 open sockets' }],
        links: [link('app', 'svc', { label: 'new socket per call', labelTone: 'warn', arrow: 'both' })],
        flows: [{ path: ['app', 'svc'], tone: 'handshake', label: 'new connection', count: 5, duration: 1 }],
        panel: { title: 'In code', icon: 'Code', code: 'def handler(req):\n    client = HttpClient()   # bad: new per request\n    return client.get(url)\n\nclient = HttpClient()       # good: once, shared\ndef handler(req):\n    return client.get(url)' },
        caption: 'The same object built thousands of times',
      },
    },
    {
      title: 'Noisy neighbor',
      tag: 'case',
      heading: 'Antipattern 16: one tenant starves the others',
      eli5: 'Two classes share one bag of crayons. One class grabs them all for a giant poster, and the other class cannot color at all.',
      body: [
        'In a shared system, one customer\'s heavy job takes most of the CPU, memory or I/O, and others slow down though they did nothing different. This is the **noisy neighbor** problem.',
        'Limit each tenant with rate limits, quotas and per-tenant pools. Isolate the biggest customers on their own shards or hardware, and put heavy batch work on separate workers.',
      ],
      keyIdea: 'Shared resources need per-tenant limits, or one customer sets everyone\'s latency.',
      metrics: { p99: '250 ms', calls: '63', dbcpu: '90%', errors: '0.2%' },
      metricTones: { dbcpu: 'bad' },
      scene: {
        nodes: [
          { id: 'big', kind: 'block', size: 0.8, at: at(-2, -3.8), label: 'big tenant', icon: 'Users', tint: 'red', chips: [{ text: 'export, 80% of DB', tone: 'bad' }] },
          { id: 'small', kind: 'block', size: 0.8, at: at(-2, 3.8), label: 'small tenant', icon: 'User', tint: 'blue', chips: [{ text: 'GET /orders, 4 s', tone: 'warn' }] },
          { ...db, status: 'hot', load: 90 },
        ],
        links: [link('big', 'db', { label: 'takes most', labelTone: 'warn' }), link('small', 'db')],
        flows: [{ path: ['big', 'db'], tone: 'request', count: 6, duration: 1 }, { path: ['small', 'db'], tone: 'request', duration: 1.6, delay: 0.5 }],
        panel: { title: 'Isolation tools', icon: 'Shield', rows: [{ text: 'Per-tenant rate limit', value: 'cap requests' }, { text: 'Quotas, per-tenant pools', value: 'cap resources' }, { text: 'Own shard for big tenants', value: 'full isolation' }] },
        caption: 'The small tenant did nothing wrong',
      },
    },
    {
      title: 'One big store',
      tag: 'case',
      heading: 'Antipattern 17: one database for everything',
      eli5: 'Receipts, photos, the shopping list and the weather forecast all go in one cupboard. The cupboard is crowded, and each item would be easier to find in the right box.',
      body: [
        '**Monolithic persistence** puts every kind of data in one relational database: orders, sessions, logs, search text and blobs. Each kind has different needs, and one store has to serve all of them.',
        'Match the store to the data. Sessions fit a cache, files fit object storage, search fits an index, and logs fit an append-only store. Move one kind at a time, and only when metrics show the strain.',
      ],
      keyIdea: 'Use the store whose access pattern fits the data, and move data off the main database when it strains it.',
      metrics: { p99: '250 ms', calls: '63', dbcpu: '60%', errors: '0.2%' },
      scene: {
        nodes: [{ ...app, status: 'active' }, { ...db, status: 'hot', load: 85, badge: 'orders, sessions, logs, files' }, { ...cache, at: at(6, -3.4), status: 'ok', badge: 'sessions' }, { id: 'store', kind: 'storage', at: at(6, 3.4), label: 'object storage', status: 'ok', badge: 'files' }],
        links: [link('app', 'db'), link('app', 'cache', { style: 'dashed' }), link('app', 'store', { style: 'dashed' })],
        flows: [{ path: ['app', 'db'], tone: 'request', count: 4, duration: 1 }, { path: ['app', 'cache'], tone: 'request', label: 'session', duration: 1, delay: 1.2 }, { path: ['app', 'store'], tone: 'data', label: 'upload', duration: 1.2, delay: 1.5 }],
        panel: { title: 'Right store for the data', icon: 'Database', rows: [{ text: 'Orders', value: 'relational DB' }, { text: 'Sessions', value: 'cache' }, { text: 'Files', value: 'object storage' }, { text: 'Logs', value: 'append-only store' }] },
        caption: 'Each kind of data in the store that suits it',
      },
    },
    {
      title: 'Retry storm',
      tag: 'case',
      heading: 'Antipattern 18: retries that pile on',
      eli5: 'The door sticks for a moment. Every shopper pushes again right away, and again, until the crowd at the door is three times bigger and nobody gets in.',
      body: [
        'The pricing service slows down for 30 seconds. Callers time out and retry at once, three times each. Its load goes from 1,500 to 6,000 requests per second exactly when it can handle the least.',
        'It cannot recover while the load is four times normal, so a short blip becomes a long outage. That is a **retry storm**.',
      ],
      keyIdea: 'Retries add load at the worst moment.',
      metrics: { p99: '250 ms', calls: '63', dbcpu: '20%', errors: '4%' },
      metricTones: { errors: 'bad' },
      scene: {
        nodes: [{ ...client }, { ...app, status: 'hot', badge: '3 retries each' }, { ...svc, status: 'down', load: 99, badge: '6,000 req/s, 4x' }],
        links: [link('client', 'app'), link('app', 'svc', { label: 'timeout, retry now', labelTone: 'warn' })],
        flows: [
          { path: ['client', 'app'], tone: 'request', count: 3, duration: 0.9 },
          { path: ['app', 'svc'], tone: 'request', count: 6, duration: 1, delay: 0.9 },
          { path: ['svc', 'app'], tone: 'error', label: 'timeout', count: 3, duration: 1, delay: 2 },
          { path: ['app', 'svc'], tone: 'request', label: 'retry now', count: 8, duration: 1, delay: 3.1 },
        ],
        panel: { title: 'Load on the pricing service', icon: 'TrendingUp', rows: [{ text: 'Normal', value: '1,500 req/s', tone: 'good' }, { text: 'During the blip', value: '6,000 req/s', tone: 'bad' }, { text: 'Can it recover?', value: 'not at 4x', tone: 'bad' }] },
        caption: 'Instant retries quadruple the load on a struggling service',
      },
    },
    {
      title: 'Layers multiply',
      tag: 'case',
      heading: 'Retries multiply through layers',
      eli5: 'The shopper asks the door guard, who asks the host, who asks the clerk, and each one asks three times. One question becomes sixty-four for the poor clerk.',
      body: [
        'If the browser, the app and a client library each retry three times (four attempts per layer), one click can become 4 × 4 × 4 = 64 calls to the struggling service.',
        'Retry in one layer only, and let the others fail fast.',
      ],
      keyIdea: 'Pick one layer to retry. Every extra layer multiplies the load.',
      metrics: { p99: '250 ms', calls: '63', dbcpu: '20%', errors: '4%' },
      metricTones: { errors: 'bad' },
      scene: {
        nodes: [{ ...client, chips: ['x4'] }, { ...app, chips: ['x4'] }, { id: 'lib', kind: 'block', size: 0.8, at: at(2.5, 0), label: 'client library', icon: 'Plug', tint: 'amber', chips: ['x4'] }, { ...svc, at: at(6, 0), status: 'down', badge: '64 calls per click' }],
        links: [link('client', 'app'), link('app', 'lib'), link('lib', 'svc')],
        flows: [{ path: ['client', 'app', 'lib', 'svc'], tone: 'request', count: 8, duration: 2 }],
        panel: { title: 'Attempts per layer', icon: 'Layers', rows: [{ text: 'Browser', value: '4' }, { text: 'App server', value: '4' }, { text: 'Client library', value: '4' }, { text: 'Calls to the service', value: '4 x 4 x 4 = 64', tone: 'bad' }] },
        caption: 'One click, sixty-four calls',
      },
    },
    {
      title: 'Back off',
      tag: 'case',
      heading: 'The fix: backoff, jitter and a retry budget',
      eli5: 'Each shopper waits a different, growing time before pushing the door again, and the door guard stops everyone after a few tries. The crowd thins out.',
      body: [
        'Retry only on errors that may pass, with **exponential backoff plus jitter** so callers spread out. Cap the total with a **retry budget**: retries may add at most 10% to traffic.',
        'Retry only idempotent calls, or send an **idempotency key** so the server can drop a repeat. Otherwise a retried charge or email happens twice.',
        'A **circuit breaker** stops calls to a failing service for a while so it can recover. Pass a deadline down the call chain, and let the server shed load it cannot serve instead of queueing it.',
      ],
      keyIdea: 'Back off with jitter, retry in one layer and cap the total.',
      metrics: { p99: '250 ms', calls: '63', dbcpu: '20%', errors: '0.2%' },
      metricTones: { errors: 'good' },
      scene: {
        nodes: [{ ...app, status: 'ok', badge: 'budget 10%' }, { ...svc, status: 'active', load: 70, badge: '1,650 req/s' }],
        links: [link('app', 'svc', { label: 'jittered, capped', arrow: 'both' })],
        flows: [
          { path: ['app', 'svc'], tone: 'request', label: 'wait 0.1 to 0.2 s', duration: 1.4 },
          { path: ['svc', 'app'], tone: 'response', duration: 1, delay: 1.5 },
        ],
        panel: { title: 'Backoff schedule', icon: 'Clock', rows: [{ text: 'Attempt 1 fails', value: 'wait 0 to 0.1 s' }, { text: 'Attempt 2 fails', value: 'wait 0 to 0.2 s' }, { text: 'Attempt 3 fails', value: 'give up', tone: 'good' }, { text: 'Retries over budget', value: 'fail fast', tone: 'good' }, { text: 'Breaker: closed, open, half-open', value: 'trip, wait, probe', tone: 'good' }, { text: 'Deadlines, load shedding', value: 'drop work nobody awaits', tone: 'good' }] },
        caption: 'Spread out the retries, then stop',
      },
      code: {
        language: 'python',
        title: 'Backoff with full jitter and a retry budget',
        source: `import random, time

BASE, CAP, ATTEMPTS = 0.1, 2.0, 3          # seconds

def call_with_retry(fn):
    for attempt in range(ATTEMPTS):
        try:
            return fn()
        except (TimeoutError, ServiceUnavailable):
            if attempt == ATTEMPTS - 1 or not budget.allow_retry():
                raise                       # give up, do not pile on
            # full jitter: wait a random time up to the backoff ceiling
            ceiling = min(CAP, BASE * 2 ** attempt)
            time.sleep(random.uniform(0, ceiling))

# budget.allow_retry() returns False once retries exceed
# 10% of recent requests, so a storm cannot build up.`,
        highlight: [10, 13, 14],
      },
    },
    {
      title: 'Recap 2',
      tag: 'recap',
      heading: 'Part 2: work, locks, connections and retries',
      eli5: 'The shopper now takes a ticket for the cake, uses shared trolleys, shares the crayons fairly, and waits a moment before pushing a stuck door again.',
      body: [
        'Move slow work to a **queue**, never hold threads while waiting, and keep heavy work off request threads and the primary database. Split **hot locks**, reuse connections through a **pool**, limit each tenant, and retry with backoff, jitter and a budget.',
        'Each leaves a signature: high latency with low CPU, a busy primary, load that rises when a dependency slows. Across both parts, order history went from 3.2 s to 700 ms, checkout p99 from 1.4 s to 250 ms, and the database from 90% CPU to 20%.',
      ],
      keyIdea: 'Find the pattern in the traces, fix the biggest one, and measure again before touching the next.',
      metrics: { p99: '250 ms', calls: '63', dbcpu: '20%', errors: '0.2%' },
      metricTones: { p99: 'good', calls: 'good', dbcpu: 'good', errors: 'good' },
      scene: {
        nodes: [{ ...client, status: 'ok', badge: '250 ms' }, { ...app, status: 'ok' }, { ...db, at: at(2.5, -3.4), status: 'ok', load: 20 }, { ...queue, status: 'ok' }, { ...worker, status: 'ok' }],
        links: [link('client', 'app'), link('app', 'db'), link('app', 'queue'), link('queue', 'worker')],
        flows: [
          { path: ['client', 'app'], tone: 'request', duration: 0.9 },
          { path: ['app', 'db', 'app'], tone: 'request', duration: 1.4, delay: 1.2 },
          { path: ['app', 'queue', 'worker'], tone: 'event', duration: 1.6, delay: 2 },
          { path: ['app', 'client'], tone: 'response', duration: 0.9, delay: 2.7 },
        ],
        panel: { title: 'Part 2 fixes', icon: 'Zap', rows: [{ text: 'Slow work', value: 'queue and worker' }, { text: 'Locks', value: 'split, buffer' }, { text: 'Connections', value: 'pool, reuse clients' }, { text: 'Retries', value: 'backoff, jitter, budget' }] },
      },
      quiz: {
        question: 'Checkout latency is high and app and database CPU are both low. The app thread pool is far from full, every slow span is the same UPDATE stats statement, and the database shows lock waits. Adding app servers changes nothing. Which antipattern fits best?',
        options: [
          'N+1 queries',
          'A hot shared lock that every request must take in turn',
          'No caching',
          'Unbounded result sets',
        ],
        answer: 1,
        explain: 'Low CPU with high latency means requests are waiting, not working. Lock waits on one repeated statement and a pool that is not full point to a hot lock, and more servers only add more waiters. Blocking I/O would show an exhausted thread pool instead, while N+1, missing caches and huge result sets show up as busy CPU or memory.',
      },
    },
  ],
};
