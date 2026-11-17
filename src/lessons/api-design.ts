import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const phone: SceneNode = { id: 'phone', kind: 'phone', at: at(-4, 0), label: 'shop app', sub: 'v3.2' };
const api: SceneNode = { id: 'api', kind: 'block', at: at(0, 0), label: 'orders API', sub: 'HTTPS + JSON', icon: 'Network', tint: 'violet' };
const db: SceneNode = { id: 'db', kind: 'db', at: at(4, 0), label: 'Postgres', sub: '50M orders' };
const keys: SceneNode = { id: 'keys', kind: 'db', at: at(4, 6.5), label: 'key store', sub: 'unique key, 24 h' };
const pay: SceneNode = { id: 'pay', kind: 'block', at: at(4, -4.8), label: 'payments', sub: 'charges cards', icon: 'Receipt', tint: 'green', size: 0.8 };

const base = [link('phone', 'api'), link('api', 'db')];

export const apiDesign: Lesson = {
  id: 'api-design',
  title: 'API design: pagination, idempotency, errors (part 1)',
  tagline: 'The details that decide whether an API survives big accounts and flaky networks. Part 2 covers versioning and running the API.',
  minutes: 15,
  level: 'Intermediate',
  learn: [
    'Resource URLs, and which HTTP methods are safe or idempotent',
    'Offset pagination, where it breaks, and cursor pagination',
    'Filtering and sorting without letting clients scan the table',
    'Why retries can charge a card twice, and how idempotency keys stop it',
    'A consistent error format, and which failures a client should retry',
  ],
  metrics: [
    { key: 'latency', label: 'List latency', icon: 'Timer' },
    { key: 'rows', label: 'Rows read', icon: 'Table' },
    { key: 'dupes', label: 'Double charges', icon: 'Copy' },
    { key: 'broken', label: 'Broken clients', icon: 'Bug' },
  ],
  steps: [
    {
      title: 'Demo worked',
      tag: 'problem',
      heading: 'The API that worked fine in the demo',
      eli5: 'A post office counter hands every customer their whole mail history at once, and stamps a parcel twice if you ask again. Fine with 12 letters. Not with 80,000.',
      body: [
        'An online shop ships `GET /orders` and `POST /orders`. In testing a user has 12 orders and the network never drops. In production a large seller has **80,000** orders, and `GET /orders` returns all of them: 40 MB of JSON and a 9 second wait.',
        'Two more problems wait. A reply lost in a tunnel makes the app retry and charge twice. A renamed field blanks prices on old phones. Each has a standard fix.',
      ],
      keyIdea: 'A real API must handle big lists, lost replies and old clients. None of them show up in a demo.',
      metrics: { latency: '9 s', rows: '80,000', dupes: '1 in 300', broken: '30% of phones' },
      metricTones: { latency: 'bad', rows: 'bad', dupes: 'bad', broken: 'bad' },
      scene: {
        nodes: [{ ...phone, status: 'hot', badge: '40 MB response' }, { ...api, status: 'hot' }, { ...db, status: 'hot', badge: 'full scan' }],
        links: base,
        flows: [
          { path: ['phone', 'api', 'db'], tone: 'request', label: 'GET /orders', duration: 1.6 },
          { path: ['db', 'api', 'phone'], tone: 'error', label: '80,000 rows', count: 6, duration: 3, delay: 1.7 },
        ],
        panel: {
          title: 'Demo vs production',
          icon: 'Gauge',
          rows: [
            { text: 'Orders per user', value: '12 vs 80,000', tone: 'bad' },
            { text: 'Response size', value: '3 KB vs 40 MB', tone: 'bad' },
            { text: 'Dropped replies', value: 'never vs daily', tone: 'warn' },
            { text: 'App versions alive', value: '1 vs many', tone: 'warn' },
          ],
          footer: { text: 'Nothing here fails in a demo', tone: 'muted' },
        },
        caption: 'Everything, every time',
      },
    },
    {
      title: 'Resource URLs',
      tag: 'concept',
      heading: 'Name the things, not the actions',
      eli5: 'Every shelf in the post office has a label like "Parcels", and every parcel has a number. You say what you want done with parcel 42. You do not invent a new counter for each task.',
      body: [
        'Model the API as **resources** with plural nouns. `/orders` is the collection and `/orders/9001` is one order. Paths like `/getOrders` or `/createOrder` repeat what the HTTP method already says.',
        'Nest one level at most, such as `/users/42/orders`, because deeper paths get long and brittle. For an action that is not create or update, name a sub-resource: `POST /orders/9001/cancel`.',
      ],
      keyIdea: 'Nouns in the URL, verbs in the method. One consistent naming rule beats clever names.',
      metrics: { latency: '9 s', rows: '80,000', dupes: '1 in 300', broken: '30% of phones' },
      scene: {
        nodes: [phone, { ...api, status: 'active', chips: ['GET /orders/9001'] }, { ...db, badge: 'orders table' }],
        links: base,
        flows: [
          { path: ['phone', 'api', 'db'], tone: 'request', label: 'GET /orders/9001', duration: 1.6 },
          { path: ['db', 'api', 'phone'], tone: 'response', label: '200 + one order', duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'One naming rule',
          icon: 'Route',
          code: 'GET  /orders             list\nPOST /orders             create\nGET  /orders/9001        one order\nGET  /users/42/orders    nested, once\nPOST /orders/9001/cancel an action',
          footer: { text: 'No verbs in the path', tone: 'muted' },
        },
        caption: 'A noun in the URL, a verb in the method',
      },
    },
    {
      title: 'Safe and idempotent',
      tag: 'concept',
      heading: 'Which methods can be repeated safely',
      eli5: 'Asking the clerk "what is in box 42?" changes nothing, so ask as often as you like. Saying "put a new parcel in the box" twice leaves two parcels.',
      body: [
        'A **safe** method changes nothing, so caches and retries can call it freely. An **idempotent** method leaves the same result whether you send it once or ten times. `GET`, `PUT` and `DELETE` are idempotent. A second `DELETE` may answer `404`, but the state is the same.',
        '`POST` is neither, because each one creates something new. `PATCH` depends on what it does.',
      ],
      keyIdea: 'A client can retry a safe or idempotent call without thinking. A POST needs help.',
      metrics: { latency: '9 s', rows: '80,000', dupes: '1 in 300', broken: '30% of phones' },
      scene: {
        nodes: [
          { ...phone, chips: [{ text: 'GET /orders/9001', tone: 'good' }, { text: 'POST /orders', tone: 'warn' }] },
          { ...api, status: 'active' },
          db,
        ],
        links: base,
        flows: [
          { path: ['phone', 'api', 'db'], tone: 'request', label: 'GET, sent twice', duration: 1.6 },
          { path: ['db', 'api', 'phone'], tone: 'response', label: 'same answer', duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'Repeating a call',
          icon: 'Repeat',
          rows: [
            { text: 'GET  read', value: 'safe, idempotent', tone: 'good' },
            { text: 'PUT  replace', value: 'idempotent', tone: 'good' },
            { text: 'DELETE  remove', value: 'idempotent', tone: 'good' },
            { text: 'PATCH  change a field', value: 'depends', tone: 'warn' },
            { text: 'POST  create', value: 'neither', tone: 'bad' },
          ],
        },
        caption: 'Repeating a GET is free, repeating a POST is not',
      },
    },
    {
      title: 'Offset pages',
      tag: 'concept',
      heading: 'Offset pagination: skip N, take M',
      eli5: 'The clerk hands out mail in bundles of 20. "Bundle 3" means: count past the first 40 letters, then hand over the next 20.',
      body: [
        'The first fix is to return a **page** at a time. With **offset pagination** the client asks `GET /orders?limit=20&offset=40` and the server runs `ORDER BY created_at DESC LIMIT 20 OFFSET 40`.',
        'It is easy to build. The client can jump to page 7 and the UI can show "page 3 of 4,000". Responses drop from 40 MB to about 10 KB and the first page loads in **40 ms**. Fine for admin screens and small tables.',
      ],
      keyIdea: 'Never return an unbounded list. Offset pagination is the simplest way to cap it.',
      metrics: { latency: '40 ms', rows: '60', dupes: '1 in 300', broken: '30% of phones' },
      metricTones: { latency: 'good', rows: 'good' },
      scene: {
        nodes: [{ ...phone, status: 'ok' }, { ...api, status: 'active', chips: ['?limit=20&offset=40'] }, { ...db, status: 'active', badge: 'skip 40, read 20' }],
        links: base,
        flows: [
          { path: ['phone', 'api', 'db'], tone: 'request', label: '?limit=20&offset=40', duration: 1.6 },
          { path: ['db', 'api', 'phone'], tone: 'response', label: '20 orders', duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'What the database runs',
          icon: 'Database',
          code: 'SELECT * FROM orders\nORDER BY created_at DESC\nLIMIT 20 OFFSET 40;',
          footer: { text: 'Response: 40 MB down to 10 KB', tone: 'good' },
        },
        caption: 'A small page instead of the whole table',
      },
    },
    {
      title: 'Deep pages',
      tag: 'case',
      heading: 'Case: page 4,000 reads 80,000 rows',
      eli5: 'For bundle 4,000 the clerk has to count past 80,000 letters, one by one, before handing you 20.',
      body: [
        'The database cannot jump to row 79,980. It walks the index and throws away every row before the offset. Page 4,000 reads **80,000 rows** to return 20, and takes 900 ms.',
        'A script that walks every page re-reads the same rows again and again, so the total work grows with the square of the list.',
      ],
      keyIdea: 'Skipping is still reading. Deep offsets cost as much as everything before them.',
      metrics: { latency: '900 ms', rows: '80,000', dupes: '1 in 300', broken: '30% of phones' },
      metricTones: { latency: 'bad', rows: 'bad' },
      scene: {
        nodes: [phone, { ...api, status: 'active', chips: ['?offset=79980'] }, { ...db, status: 'hot', load: 94, badge: 'read 80,000, kept 20' }],
        links: base,
        flows: [
          { path: ['phone', 'api', 'db'], tone: 'request', label: 'offset=79980', duration: 1.6 },
          { path: ['db', 'api', 'phone'], tone: 'response', label: '20 orders, 900 ms', duration: 2.4, delay: 1.7 },
        ],
        panel: {
          title: 'Cost of one page',
          icon: 'Timer',
          rows: [
            { text: 'Page 1', value: '20 rows read, 40 ms', tone: 'good' },
            { text: 'Page 400', value: '8,000 rows read', tone: 'warn' },
            { text: 'Page 4,000', value: '80,000 rows read, 900 ms', tone: 'bad' },
          ],
          footer: { text: 'Same 20 rows returned each time', tone: 'muted' },
        },
        caption: 'Skipping is still reading',
      },
    },
    {
      title: 'Shifting lists',
      tag: 'case',
      heading: 'Case: new orders shift the pages',
      eli5: 'You read bundle 1, then five new letters land on top of the pile. Bundle 2 now starts five letters early, so you read five letters twice.',
      body: [
        'The client reads page 1. Five new orders arrive. Page 2 now starts five rows earlier, so the client sees five orders twice. If orders are deleted instead, some are skipped and never shown.',
        'Infinite feeds, exports and sync jobs hit this all the time.',
      ],
      keyIdea: 'Offsets count positions, and positions shift when data changes.',
      metrics: { latency: '900 ms', rows: '80,000', dupes: '1 in 300', broken: '30% of phones' },
      scene: {
        nodes: [{ ...phone, status: 'hot', badge: 'saw 5 orders twice' }, { ...api, status: 'active' }, { ...db, status: 'active', badge: '+5 new orders' }],
        links: base,
        flows: [
          { path: ['db', 'api', 'phone'], tone: 'response', label: 'page 1: 100 to 81', duration: 1.6 },
          { path: ['phone', 'api', 'db'], tone: 'request', label: 'page 2: offset=20', duration: 1.6, delay: 1.8 },
          { path: ['db', 'api', 'phone'], tone: 'error', label: 'page 2: 85 to 66', duration: 1.6, delay: 3.6 },
        ],
        panel: {
          title: 'Order ids on screen',
          icon: 'List',
          rows: [
            { text: 'Page 1 read', value: '100 down to 81' },
            { text: 'Then 5 new orders land', value: '101 to 105', tone: 'warn' },
            { text: 'Page 2 (offset 20) shows', value: '85 down to 66', tone: 'bad' },
          ],
          footer: { text: 'Orders 85 to 81 appear twice', tone: 'bad' },
        },
        caption: 'The list moved while the client was reading it',
      },
    },
    {
      title: 'Cursors',
      tag: 'concept',
      heading: 'Cursor pagination: continue after the last item seen',
      eli5: 'Instead of a bundle number, the clerk gives you a ticket that says "you stopped at the letter from March 3, number 512". Next time she starts right after it.',
      body: [
        'With **cursor pagination** (also called keyset pagination) each page ends with a `next_cursor` that encodes where it stopped: the sort value and a tie-breaking id of the last row. The next request passes it back.',
        'The query becomes `WHERE (created_at, id) < (last_created_at, last_id) ORDER BY created_at DESC, id DESC LIMIT 20`. With an index on those columns the database seeks straight to the spot.',
      ],
      keyIdea: 'A cursor remembers a position in the data, not a row count.',
      metrics: { latency: '15 ms', rows: '20', dupes: '1 in 300', broken: '30% of phones' },
      metricTones: { latency: 'good', rows: 'good' },
      scene: {
        nodes: [{ ...phone, status: 'ok', badge: 'next_cursor' }, { ...api, status: 'active', chips: ['?after=eyJ0Ijo...'] }, { ...db, status: 'ok', badge: 'index seek, 20 rows' }],
        links: base,
        flows: [
          { path: ['phone', 'api', 'db'], tone: 'request', label: '?after=eyJ0Ijo...', duration: 1.6 },
          { path: ['db', 'api', 'phone'], tone: 'response', label: '20 orders + cursor', duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'Where the cursor points',
          icon: 'KeyRound',
          code: 'WHERE (created_at, id)\n    < (last_created_at, last_id)\nORDER BY created_at DESC, id DESC\nLIMIT 20',
          footer: { text: 'Page 4,000 costs the same 20 rows as page 1', tone: 'good' },
        },
        caption: 'Start right after the last row seen',
      },
      code: {
        language: 'python',
        title: 'Keyset pagination with an opaque cursor',
        source: `import base64, json

def encode(row):
    raw = json.dumps({"t": row["created_at"].isoformat(), "id": row["id"]})
    return base64.urlsafe_b64encode(raw.encode()).decode()

def list_orders(user_id, limit=20, after=None):
    limit = min(limit, 100)                       # cap what clients can ask for
    sql = "SELECT * FROM orders WHERE user_id = %s"
    args = [user_id]
    if after:
        c = json.loads(base64.urlsafe_b64decode(after))
        sql += " AND (created_at, id) < (%s, %s)"
        args += [c["t"], c["id"]]
    sql += " ORDER BY created_at DESC, id DESC LIMIT %s"
    rows = db.query(sql, *args, limit + 1)        # one extra: is there more?
    page = rows[:limit]
    nxt = encode(page[-1]) if len(rows) > limit else None
    return {"data": page, "next_cursor": nxt}`,
        highlight: [8, 13, 15, 16, 18],
      },
    },
    {
      title: 'Cursor trade-offs',
      tag: 'tradeoff',
      heading: 'What cursors give and what they cost',
      eli5: 'The ticket never goes stale, however much new mail arrives. But you cannot ask for "bundle 7" or "how many bundles in total", because tickets only point at the next one.',
      body: [
        'New rows above the cursor do not shift anything, so there are no duplicates or gaps, and every page costs the same.',
        'The price: no jumping to page 7 and no cheap total count. Encode the cursor as an opaque string so clients cannot depend on what is inside it and you stay free to change it.',
      ],
      keyIdea: 'Cursors trade random access for stable, constant-cost paging. Feeds and exports want that trade.',
      metrics: { latency: '15 ms', rows: '20', dupes: '1 in 300', broken: '30% of phones' },
      scene: {
        nodes: [{ ...phone, status: 'ok' }, { ...api, status: 'active' }, { ...db, status: 'ok', badge: '+5 new orders' }],
        links: base,
        flows: [
          { path: ['phone', 'api', 'db'], tone: 'request', label: '?after=...', duration: 1.6 },
          { path: ['db', 'api', 'phone'], tone: 'response', label: 'no repeats, no gaps', duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'Offset vs cursor',
          icon: 'Scale',
          rows: [
            { text: 'Jump to page 7', value: 'offset only' },
            { text: 'Total count', value: 'offset only' },
            { text: 'Cost of deep page', value: 'cursor: constant', tone: 'good' },
            { text: 'New rows on top', value: 'cursor: no shift', tone: 'good' },
          ],
        },
        caption: 'Stable and fast, but no random access',
      },
      quiz: {
        question: 'A feed gets new posts every second. Users scrolling with offset pagination see repeated posts. Why does cursor pagination fix it?',
        options: [
          'Cursors cache each page on the server',
          'Cursors continue after the last item seen, so new items at the top do not shift later pages',
          'Cursors return larger pages',
          'Cursors lock the table while the user scrolls',
        ],
        answer: 1,
        explain: 'An offset counts rows from the top, so new posts push old ones down into the next page. A cursor says "older than this post", which stays correct however many posts arrive above it.',
      },
    },
    {
      title: 'Filter and sort',
      tag: 'concept',
      heading: 'Filtering and sorting with plain parameters',
      eli5: 'Customers may ask for "only parcels, newest first" from a short printed list of options. They cannot ask the clerk to sort every letter by the color of its stamp.',
      body: [
        'Clients want `GET /orders?status=shipped&sort=-created_at`. Use plain query parameters, one per field, and a `-` prefix for descending. Keep the same names everywhere in the API.',
        'Accept only an **allowlist** of filter and sort fields, and only ones backed by an index. A sort on an unindexed column turns each request into a full scan of 50 million rows, and a public API will find it.',
      ],
      keyIdea: 'Every filter and sort you accept is a query you promise to run fast. Allow only the ones you have indexes for.',
      metrics: { latency: '18 ms', rows: '20', dupes: '1 in 300', broken: '30% of phones' },
      scene: {
        nodes: [phone, { ...api, status: 'active', badge: 'allowlist check' }, { ...db, status: 'ok', badge: 'index (user, status, created_at)' }],
        links: base,
        flows: [
          { path: ['phone', 'api'], tone: 'request', label: '?status=shipped&sort=-created_at', duration: 1.2 },
          { path: ['api', 'db'], tone: 'request', duration: 1, delay: 1.3 },
          { path: ['db', 'api', 'phone'], tone: 'response', duration: 1.6, delay: 2.4 },
          { path: ['phone', 'api'], tone: 'request', label: '?sort=note', duration: 1.2, delay: 4.2 },
          { path: ['api', 'phone'], tone: 'error', label: '400 unsupported sort', duration: 1.2, delay: 5.5 },
        ],
        panel: {
          title: 'Allowlist',
          icon: 'List',
          rows: [
            { text: 'status', value: 'filter, indexed', tone: 'good' },
            { text: 'created_at', value: 'sort, indexed', tone: 'good' },
            { text: 'total', value: 'sort, indexed', tone: 'good' },
            { text: 'note', value: 'no index, rejected', tone: 'bad' },
          ],
        },
        caption: 'Supported filters pass, the rest get a clear 400',
      },
    },
    {
      title: 'Cursor and caps',
      tag: 'concept',
      heading: 'Keep cursors honest and cap the page size',
      eli5: 'The ticket also remembers which pile you were reading. If you switch piles and show the old ticket, the clerk says so, rather than handing you the wrong letters. She never hands out more than 100 at once.',
      body: [
        'The cursor must encode the sort fields. If a client changes the filter or sort halfway, reject the old cursor with a clear error instead of returning a quietly wrong page.',
        'Cap `limit` too, for example at 100. A client that asks for 5,000 gets 100, and the next cursor to continue.',
      ],
      keyIdea: 'A cursor belongs to one filter and sort. Reject mismatches loudly and cap the page size.',
      metrics: { latency: '18 ms', rows: '20', dupes: '1 in 300', broken: '30% of phones' },
      scene: {
        nodes: [phone, { ...api, status: 'active', chips: [{ text: 'limit=5000', tone: 'warn' }, { text: 'sort changed', tone: 'warn' }] }, db],
        links: base,
        flows: [
          { path: ['phone', 'api'], tone: 'request', label: 'limit=5000', duration: 1.2 },
          { path: ['api', 'db', 'api', 'phone'], tone: 'response', label: '100 orders + cursor', duration: 2.2, delay: 1.3 },
          { path: ['phone', 'api'], tone: 'request', label: 'old cursor, new sort', duration: 1.2, delay: 3.8 },
          { path: ['api', 'phone'], tone: 'error', label: '400 invalid_cursor', duration: 1.2, delay: 5 },
        ],
        panel: {
          title: 'Two guard rails',
          icon: 'Shield',
          rows: [
            { text: 'limit above 100', value: 'clamped to 100', tone: 'warn' },
            { text: 'cursor from another sort', value: '400 invalid_cursor', tone: 'bad' },
          ],
          footer: { text: 'A wrong page is worse than an error', tone: 'muted' },
        },
        caption: 'Clamp the size, reject the stale cursor',
      },
    },
    {
      title: 'Lost reply',
      tag: 'case',
      heading: 'Case: the charge went through, the reply did not',
      eli5: 'You hand over a parcel and pay. The receipt blows away before you see it, so you pay again for the same parcel. The post office cannot tell it is the same one.',
      body: [
        'The app sends `POST /orders` with a $60 basket. The API saves the order and charges the card. Then the reply is lost: a tunnel, a 10 second timeout, a load balancer restart.',
        'The client cannot tell whether the request failed before, during or after the charge. Not retrying loses real orders. Retrying blindly charges twice, about **one in 300** orders on mobile networks.',
      ],
      keyIdea: 'Networks lose replies, so clients must retry. A retry is only safe if the operation is idempotent.',
      metrics: { latency: '18 ms', rows: '20', dupes: '1 in 300', broken: '30% of phones' },
      metricTones: { dupes: 'bad' },
      scene: {
        nodes: [{ ...phone, status: 'hot', badge: 'timeout, retry' }, { ...api, status: 'active' }, db, { ...pay, status: 'hot', badge: '2 x $60' }],
        links: [...base, link('api', 'pay')],
        flows: [
          { path: ['phone', 'api', 'pay'], tone: 'request', label: 'POST /orders', duration: 1.6 },
          { path: ['pay', 'api'], tone: 'response', label: 'charged', duration: 0.8, delay: 1.7 },
          { path: ['api', 'phone'], tone: 'error', label: 'reply lost', duration: 1, delay: 2.6 },
          { path: ['phone', 'api', 'pay'], tone: 'request', label: 'retry POST', duration: 1.6, delay: 3.8 },
        ],
        panel: {
          title: 'What the client sees',
          icon: 'Signal',
          rows: [
            { text: 'Attempt 1', value: 'charged, reply lost', tone: 'warn' },
            { text: 'Client thinks', value: 'maybe failed' },
            { text: 'Attempt 2', value: 'charged again', tone: 'bad' },
          ],
          footer: { text: 'Same basket, charged twice', tone: 'bad' },
        },
        caption: 'Same basket, charged twice',
      },
    },
    {
      title: 'Idempotency keys',
      tag: 'concept',
      heading: 'Idempotency keys: same key, same result',
      eli5: 'Each parcel gets a sticker with a unique number. If you come back with the same sticker, the clerk finds the receipt in her **idempotency key** drawer and hands you a copy instead of charging again.',
      body: [
        'The client generates a random **idempotency key** (a UUID) once per user action and sends it as a header: `Idempotency-Key: 7f3a...`. Every retry of that action reuses the same key.',
        'The server records the key before doing the work. A new key runs the operation and stores the response. A finished key returns the **stored response**, and nothing is charged again. A key still in progress gets `409 Conflict`.',
      ],
      keyIdea: 'An idempotency key turns "do this" into "do this once". Retries then replay the stored answer.',
      metrics: { latency: '20 ms', rows: '20', dupes: '0', broken: '30% of phones' },
      metricTones: { dupes: 'good' },
      scene: {
        nodes: [{ ...phone, status: 'ok', badge: 'same key on retry' }, { ...api, status: 'active' }, { ...keys, status: 'ok', badge: 'key 7f3a: done' }, { ...pay, status: 'ok', badge: '1 x $60' }],
        links: [link('phone', 'api'), link('api', 'pay'), link('api', 'keys')],
        flows: [
          { path: ['phone', 'api'], tone: 'request', label: 'retry, key 7f3a', duration: 1.1 },
          { path: ['api', 'keys'], tone: 'request', label: 'seen 7f3a?', duration: 1, delay: 1.2 },
          { path: ['keys', 'api'], tone: 'response', label: 'stored 201', duration: 1, delay: 2.3 },
          { path: ['api', 'phone'], tone: 'response', label: '201, order 9001', duration: 1.1, delay: 3.4 },
        ],
        panel: {
          title: 'Three cases for a key',
          icon: 'Key',
          rows: [
            { text: 'Never seen', value: 'run it, store the reply', tone: 'good' },
            { text: 'Seen and done', value: 'replay stored reply', tone: 'good' },
            { text: 'Seen, still running', value: '409 Conflict', tone: 'warn' },
          ],
        },
        caption: 'The retry gets the first answer back',
      },
      code: {
        language: 'python',
        title: 'Handling an idempotency key',
        source: `# canonical_json and the store client r are assumed helpers
def create_order(user_id, body, idem_key):
    k = f"idem:{user_id}:{idem_key}"
    fingerprint = hashlib.sha256(canonical_json(body)).hexdigest()
    claim = json.dumps({"state": "running", "fp": fingerprint})
    # Claim the key atomically. NX: only if no one has it yet.
    while not r.set(k, claim, nx=True, ex=86400):
        raw = r.get(k)
        if raw is None:
            continue                                   # expired meanwhile, claim again
        rec = json.loads(raw)
        if rec["fp"] != fingerprint:
            return 422, {"error": "key reused with a different body"}
        if rec["state"] == "running":
            return 409, {"error": "request still in progress"}
        return rec["status"], rec["response"]          # replay, no new charge
    try:
        status, response = place_order_and_charge(user_id, body, idem_key)
    except ChargeFailed:
        r.delete(k)                                    # nothing charged: let the retry run
        raise
    # A crash between the charge and this write needs a recovery job that asks
    # the provider about idem_key, which is why the key goes to the provider too.
    r.set(k, json.dumps({"state": "done", "fp": fingerprint,
                         "status": status, "response": response}), ex=86400)
    return status, response`,
        highlight: [6, 7, 9, 10, 17, 18, 19, 20, 24],
      },
    },
    {
      title: 'Key rules',
      tag: 'tradeoff',
      heading: 'Rules that keep idempotency keys safe',
      eli5: 'Stickers are checked per customer and kept in the drawer for one day. A sticker shown with a different parcel is a mistake, so the clerk says so instead of handing back the old receipt.',
      body: [
        'Scope keys per user, keep them for about 24 hours, and store a hash of the request body. The same key with a different body is a client bug and should get `422`, not the old answer.',
        'Claim the key atomically so two simultaneous retries cannot both run. Keep keys in a durable store (a table with a unique constraint, or persisted Redis), since a lost key means a double charge. Free the key if the work fails before any charge, and pass it to the payment provider too.',
      ],
      keyIdea: 'Claim the key atomically, scope it to the user, and compare the body so a reused key cannot replay the wrong answer.',
      metrics: { latency: '20 ms', rows: '20', dupes: '0', broken: '30% of phones' },
      metricTones: { dupes: 'good' },
      scene: {
        nodes: [phone, { ...api, status: 'active' }, { ...keys, status: 'active', chips: ['idem:42:7f3a', 'fp: 9c1e...', 'ttl 24 h'] }, pay],
        links: [link('phone', 'api'), link('api', 'pay'), link('api', 'keys')],
        flows: [
          { path: ['phone', 'api'], tone: 'request', label: 'key 7f3a, new body', duration: 1.2 },
          { path: ['api', 'keys'], tone: 'request', label: 'fingerprint?', duration: 1, delay: 1.3 },
          { path: ['keys', 'api', 'phone'], tone: 'error', label: '422 key reused', duration: 1.8, delay: 2.4 },
        ],
        panel: {
          title: 'Stored with each key',
          icon: 'Table',
          rows: [
            { text: 'Scope', value: 'user id + key' },
            { text: 'Fingerprint', value: 'hash of the body' },
            { text: 'State', value: 'running or done' },
            { text: 'Time to live', value: '24 hours' },
          ],
          footer: { text: 'Same key, other body: 422', tone: 'warn' },
        },
        caption: 'A reused key with a new body is rejected',
      },
    },
    {
      title: 'Status codes',
      tag: 'concept',
      heading: 'Use the HTTP status for the category',
      eli5: 'Every rejected form comes back with a colored stamp: red for "you made a mistake", yellow for "wait and try later", black for "our desk broke". The color tells you what to do before you read a word.',
      body: [
        'Success: `200` OK, `201` Created (with a `Location` header for the new resource), `204` No Content. Errors: `400` malformed request or unsupported parameter, `422` well-formed but failing business rules, `401`, `403`, `404`, `409`, `429` slow down, `5xx` our fault.',
        'Never answer `200` with an error inside. Caches, proxies and client libraries all trust the status first.',
      ],
      keyIdea: 'The status code says who is at fault and whether a retry could help. Never hide an error behind 200.',
      metrics: { latency: '20 ms', rows: '20', dupes: '0', broken: '30% of phones' },
      scene: {
        nodes: [{ ...phone, chips: [{ text: 'qty: -1', tone: 'warn' }] }, { ...api, status: 'active' }, db],
        links: base,
        flows: [
          { path: ['phone', 'api'], tone: 'request', label: 'POST /orders, qty -1', duration: 1.3 },
          { path: ['api', 'phone'], tone: 'error', label: '422 validation_failed', duration: 1.3, delay: 1.5 },
        ],
        panel: {
          title: 'Client errors',
          icon: 'Code',
          rows: [
            { text: '201 / 204', value: 'created + Location / no content' },
            { text: '400', value: 'malformed or unsupported' },
            { text: '401 / 403', value: 'not signed in / not allowed' },
            { text: '404', value: 'missing' },
            { text: '409', value: 'conflict' },
            { text: '422', value: 'valid shape, fails rules' },
          ],
          footer: { text: '429 slow down, 5xx our fault', tone: 'muted' },
        },
        caption: 'The category first, the detail next',
      },
    },
    {
      title: 'Error body',
      tag: 'concept',
      heading: 'One error shape, everywhere',
      eli5: 'Every red slip has the same boxes: a code, a plain sentence, and which box was wrong. Customers learn to read one slip, not a different note from each clerk.',
      body: [
        'Put the detail in a body with the same shape on every endpoint: a stable machine-readable `code`, a human `message`, a `details` array of `{field, code}` when several fields fail, and a `request_id` that matches your logs.',
        'Clients branch on `code`, never on the message text, so you can reword messages freely.',
      ],
      keyIdea: 'A stable code for the reason, a field for the culprit, a request id for the logs.',
      metrics: { latency: '20 ms', rows: '20', dupes: '0', broken: '30% of phones' },
      scene: {
        nodes: [{ ...phone, status: 'active', badge: 'code: card_declined' }, { ...api, status: 'active' }, { ...pay, status: 'active', badge: 'declined' }],
        links: [link('phone', 'api'), link('api', 'pay')],
        flows: [
          { path: ['phone', 'api', 'pay'], tone: 'request', label: 'POST /orders', duration: 1.6 },
          { path: ['pay', 'api', 'phone'], tone: 'error', label: '402 card_declined', duration: 1.6, delay: 1.7 },
        ],
        caption: 'A reason the app can act on',
      },
      code: {
        language: 'json',
        title: 'The same error shape on every endpoint',
        source: `{
  "error": {
    "code": "card_declined",
    "message": "The card was declined. Try another payment method.",
    "details": [{ "field": "payment_method", "code": "declined" }],
    "request_id": "req_8c41e2",
    "docs": "https://docs.shop.example/errors#card_declined"
  }
}`,
        highlight: [3, 5, 6],
      },
    },
    {
      title: 'Retry rules',
      tag: 'concept',
      heading: 'Which failures are worth retrying',
      eli5: 'The yellow stamp says "come back in two minutes", so you wait and return. The red stamp says "your form is wrong", and coming back with the same form changes nothing.',
      body: [
        '`429`, `503` and timeouts can succeed later, so retry them after the `Retry-After` delay. Without one, back off: 1 s, 2 s, 4 s, each with random jitter so clients do not retry in lockstep. `400` and `422` fail the same way every time.',
        'A `POST` is retried only with an idempotency key.',
      ],
      keyIdea: 'Retry what can change on its own, wait before you do, and never retry a write without a key.',
      metrics: { latency: '20 ms', rows: '20', dupes: '0', broken: '30% of phones' },
      scene: {
        nodes: [{ ...phone, chips: ['try 1: 503', 'wait 2 s + jitter', { text: 'try 2: 200', tone: 'good' }] }, { ...api, status: 'hot', load: 92 }, db],
        links: base,
        flows: [
          { path: ['phone', 'api'], tone: 'request', label: 'try 1', duration: 1.1 },
          { path: ['api', 'phone'], tone: 'error', label: '503 Retry-After: 2', duration: 1.1, delay: 1.2 },
          { path: ['phone', 'api'], tone: 'request', label: 'try 2, after 2 s', duration: 1.1, delay: 3.4 },
        ],
        panel: {
          title: 'Retry or not',
          icon: 'Repeat',
          rows: [
            { text: '429, 503, timeout', value: 'retry with backoff', tone: 'good' },
            { text: '400, 422', value: 'never, fix the request', tone: 'bad' },
            { text: '401, 403, 404', value: 'never, same answer', tone: 'bad' },
            { text: 'POST', value: 'only with a key', tone: 'warn' },
          ],
        },
        caption: 'Wait, then try again',
      },
      quiz: {
        question: 'Which response should a client retry automatically after waiting?',
        options: [
          '422 validation_failed, because the order may be valid next time',
          '503 with Retry-After: 2, because the server may recover',
          '403 forbidden, because permissions change often',
          '400 bad request, because the network may have garbled it',
        ],
        answer: 1,
        explain: '503 and 429 describe a temporary condition, so waiting can fix them. The 4xx codes describe a problem with the request itself, and the same request fails the same way.',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Bounded lists, safe retries, clear errors',
      eli5: 'The post office now hands out mail in bundles with a ticket for where you stopped, puts a sticker on every parcel so it is never paid twice, and stamps every rejection the same way.',
      body: [
        'Never return unbounded lists. **Offset** pages are simple and allow jumping, but deep pages are slow and shifting data causes repeats. **Cursor** pages cost the same at any depth. Filter and sort only on indexed fields from an allowlist.',
        'Clients must retry, so writes need **idempotency keys**: the server stores the first response under the key and replays it. Errors share one shape with a stable code. Part 2 covers changing the API without breaking old clients.',
      ],
      keyIdea: 'Design the API for the worst day: the largest account and the worst network.',
      metrics: { latency: '15 ms', rows: '20', dupes: '0', broken: '30% of phones' },
      metricTones: { latency: 'good', rows: 'good', dupes: 'good' },
      scene: {
        nodes: [{ ...phone, status: 'ok' }, { ...api, status: 'ok' }, db, { ...keys, status: 'ok' }],
        links: [...base, link('api', 'keys')],
        flows: [
          { path: ['phone', 'api', 'db'], tone: 'request', label: '?after=cursor', duration: 1.6 },
          { path: ['db', 'api', 'phone'], tone: 'response', duration: 1.6, delay: 1.7 },
          { path: ['api', 'keys'], tone: 'data', label: 'store key', duration: 1, delay: 3.4 },
        ],
        panel: {
          title: 'Part 1 in four lines',
          icon: 'List',
          rows: [
            { text: 'Lists', value: 'cursor, capped, indexed', tone: 'good' },
            { text: 'Writes', value: 'idempotency key', tone: 'good' },
            { text: 'Errors', value: 'status + stable code', tone: 'good' },
            { text: 'Retries', value: 'backoff, never blind', tone: 'good' },
          ],
        },
      },
      quiz: {
        question: 'A client sends POST /payments with Idempotency-Key k1, times out, and retries with k1. The first attempt had already succeeded. What should the server return?',
        options: [
          'A new payment, since this is a new request',
          '409 Conflict, because the key already exists',
          'The stored response of the first attempt, without charging again',
          '400 Bad Request, because retries are not allowed',
        ],
        answer: 2,
        explain: 'The key says "this is the same action". The server finds k1 marked done and replays the saved response, so the client learns the payment succeeded and the card is charged once. 409 is only for a key whose first attempt is still running.',
      },
    },
  ],
};
