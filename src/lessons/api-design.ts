import type { Lesson, SceneNode } from '../engine/types';

const phone: SceneNode = { id: 'phone', kind: 'phone', at: [-5.5, 0], label: 'shop app', sub: 'v3.2 on phones' };
const api: SceneNode = { id: 'api', kind: 'server', at: [-1.5, 0], label: 'orders API' };
const db: SceneNode = { id: 'db', kind: 'db', at: [2.5, -1.5], label: 'Postgres', sub: '50M orders' };
const keys: SceneNode = { id: 'keys', kind: 'cache', at: [1, -5], label: 'idempotency keys', sub: 'kept 24 h' };
const pay: SceneNode = { id: 'pay', kind: 'service', at: [3.5, 1.5], label: 'payments', sub: 'charges cards' };
const oldApp: SceneNode = { id: 'oldApp', kind: 'phone', at: [-3.5, -4.5], label: 'old app', sub: 'v2.0, never updated' };

const baseLinks = [
  { from: 'phone', to: 'api' },
  { from: 'api', to: 'db' },
];

export const apiDesign: Lesson = {
  id: 'api-design',
  title: 'API design: pagination, versioning, idempotency',
  tagline: 'The details that decide whether an API survives real traffic, flaky networks and old clients.',
  minutes: 14,
  level: 'Intermediate',
  learn: [
    'Offset pagination, where it breaks, and cursor pagination',
    'Filtering and sorting without letting clients scan the table',
    'Why retries can charge a card twice, and how idempotency keys stop it',
    'A consistent error format that clients can act on',
    'Versioning, additive changes and how to retire an old version',
  ],
  metrics: [
    { key: 'latency', label: 'List latency' },
    { key: 'rows', label: 'Rows read' },
    { key: 'dupes', label: 'Double charges' },
    { key: 'broken', label: 'Broken clients' },
  ],
  steps: [
    {
      title: 'Demo worked',
      tag: 'problem',
      heading: 'The API that worked fine in the demo',
      eli5: 'A post office counter handed every customer their whole mail history at once, stamped some parcels twice when a customer asked again, and changed its forms overnight so old forms got rejected.',
      body: [
        'An online shop ships `GET /orders` and `POST /orders`. In testing, a user has 12 orders and the network never drops. In production a large seller has **80,000** orders, and `GET /orders` returns all of them: 40 MB of JSON and a 9 second wait.',
        'On a train, a phone sends `POST /orders`. The server charges the card, but the reply is lost in a tunnel. The app retries, and the customer is charged twice.',
        'Then a developer renames `total` to `total_cents`. Every phone still running last month\'s app shows a blank price. Each of these has a standard fix, and this lesson walks through them.',
      ],
      keyIdea: 'A real API must handle big lists, lost replies and old clients. None of them show up in a demo.',
      metrics: { latency: '9 s', rows: '80,000', dupes: '1 in 300', broken: '30% of phones' },
      scene: {
        nodes: [{ ...phone, status: 'hot', badge: '40 MB response' }, { ...api, status: 'hot' }, { ...db, status: 'hot', badge: 'full scan' }],
        links: baseLinks,
        flows: [
          { path: ['phone', 'api', 'db'], tone: 'request', label: 'GET /orders', duration: 1.6 },
          { path: ['db', 'api', 'phone'], tone: 'error', label: '80,000 rows', count: 6, duration: 3, delay: 1.7 },
        ],
        caption: 'Everything, every time',
      },
    },
    {
      title: 'Offset pages',
      tag: 'concept',
      heading: 'Offset pagination: skip N, take M',
      eli5: 'The clerk hands out mail in bundles of 20. "Bundle 3" means: count past the first 40 letters, then hand over the next 20.',
      body: [
        'The first fix is to return a **page** at a time. With **offset pagination** the client asks `GET /orders?limit=20&offset=40` and the server runs `ORDER BY created_at DESC LIMIT 20 OFFSET 40`.',
        'It is easy to build and easy to understand. The client can jump straight to page 7, and the server can return a total count so the UI shows "page 3 of 4,000".',
        'Responses drop from 40 MB to about 10 KB and the first page loads in **40 ms**. For admin screens and small tables, this is often all you need.',
      ],
      keyIdea: 'Never return an unbounded list. Offset pagination is the simplest way to cap it.',
      metrics: { latency: '40 ms', rows: '60', dupes: '1 in 300', broken: '30% of phones' },
      scene: {
        nodes: [{ ...phone, status: 'ok' }, { ...api, status: 'active' }, { ...db, status: 'active', badge: 'skip 40, read 20' }],
        links: baseLinks,
        flows: [
          { path: ['phone', 'api', 'db'], tone: 'request', label: '?limit=20&offset=40', duration: 1.6 },
          { path: ['db', 'api', 'phone'], tone: 'response', label: '20 orders', duration: 1.6, delay: 1.7 },
        ],
        caption: 'A small page instead of the whole table',
      },
    },
    {
      title: 'Deep pages',
      tag: 'case',
      heading: 'Case: page 4,000 and the shifting list',
      eli5: 'For bundle 4,000 the clerk counts past 80,000 letters before handing over 20. And if new mail lands on top while you read, the next bundle repeats letters you already saw.',
      body: [
        'The database cannot jump to row 79,980. It walks the index and throws away every row before the offset. Page 4,000 reads **80,000 rows** to return 20, and takes 900 ms. A script that walks every page does quadratic work.',
        'The list also moves. The client reads page 1. Five new orders arrive. Page 2 now starts five rows earlier, so the client sees five orders twice. If orders are deleted instead, some are skipped and never shown.',
        'Infinite feeds, exports and sync jobs hit both problems all the time.',
      ],
      keyIdea: 'Offsets count positions, and positions shift when data changes. Deep offsets also cost as much as reading everything before them.',
      metrics: { latency: '900 ms', rows: '80,000', dupes: '1 in 300', broken: '30% of phones' },
      scene: {
        nodes: [{ ...phone, badge: 'saw 5 orders twice' }, { ...api, status: 'active' }, { ...db, status: 'hot', badge: 'read 80,000, kept 20' }],
        links: baseLinks,
        flows: [
          { path: ['phone', 'api', 'db'], tone: 'request', label: 'offset=79980', duration: 1.6 },
          { path: ['db', 'api', 'phone'], tone: 'response', label: '20 orders, 900 ms', duration: 2.4, delay: 1.7 },
        ],
        caption: 'Skipping is still reading',
      },
    },
    {
      title: 'Cursors',
      tag: 'concept',
      heading: 'Cursor pagination: continue after the last item seen',
      eli5: 'Instead of a bundle number, the clerk gives you a ticket that says "you stopped at the letter from March 3, number 512". Next time she starts right after it, however much new mail arrived.',
      body: [
        'With **cursor pagination** (also called keyset pagination) each page ends with a `next_cursor` that encodes where it stopped: the sort value and a tie-breaking id of the last row. The next request passes it back.',
        'The query becomes `WHERE (created_at, id) < (last_created_at, last_id) ORDER BY created_at DESC, id DESC LIMIT 20`. With an index on those columns, the database seeks straight to the spot. Page 4,000 costs the same **20 rows** as page 1.',
        'New rows above the cursor do not shift anything, so there are no duplicates or gaps. The cost: no jumping to page 7 and no cheap total count. Encode the cursor as an opaque string so clients cannot depend on what is inside it.',
      ],
      keyIdea: 'A cursor remembers a position in the data, not a row count. Every page costs the same and the list cannot shift under you.',
      metrics: { latency: '15 ms', rows: '20', dupes: '1 in 300', broken: '30% of phones' },
      scene: {
        nodes: [{ ...phone, status: 'ok', badge: 'next_cursor' }, { ...api, status: 'active' }, { ...db, status: 'ok', badge: 'index seek, 20 rows' }],
        links: baseLinks,
        flows: [
          { path: ['phone', 'api', 'db'], tone: 'request', label: '?after=eyJ0Ijo...', duration: 1.6 },
          { path: ['db', 'api', 'phone'], tone: 'response', label: '20 orders + cursor', duration: 1.6, delay: 1.7 },
        ],
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
      heading: 'Filtering and sorting without handing out a table scan',
      eli5: 'Customers may ask for "only parcels, newest first" from a short printed list of options. They cannot ask the clerk to sort every letter by the color of its stamp.',
      body: [
        'Clients want `GET /orders?status=shipped&sort=-created_at`. Use plain query parameters, one per field, and a `-` prefix for descending. Keep the same names everywhere in the API.',
        'Accept only an **allowlist** of filter and sort fields, and only ones backed by an index. A sort on an unindexed column turns each request into a full scan of 50 million rows, and a public API will find it.',
        'The cursor must encode the sort fields. If a client changes the filter or sort halfway, reject the old cursor with a clear error instead of returning a quietly wrong page. Cap `limit` too, for example at 100.',
      ],
      keyIdea: 'Every filter and sort you accept is a query you promise to run fast. Allow only the ones you have indexes for.',
      metrics: { latency: '18 ms', rows: '20', dupes: '1 in 300', broken: '30% of phones' },
      scene: {
        nodes: [phone, { ...api, status: 'active', badge: 'allowlist check' }, { ...db, status: 'ok', badge: 'index (user, status, created_at)' }],
        links: baseLinks,
        flows: [
          { path: ['phone', 'api'], tone: 'request', label: '?status=shipped&sort=-created_at', duration: 1.2 },
          { path: ['api', 'db'], tone: 'request', duration: 1, delay: 1.3 },
          { path: ['db', 'api', 'phone'], tone: 'response', duration: 1.6, delay: 2.4 },
          { path: ['phone', 'api'], tone: 'request', label: '?sort=note', duration: 1.2, delay: 4.2 },
          { path: ['api', 'phone'], tone: 'error', label: '400 unsupported sort', duration: 1.2, delay: 5.5 },
        ],
        caption: 'Supported filters pass, the rest get a clear 400',
      },
    },
    {
      title: 'Lost reply',
      tag: 'case',
      heading: 'Case: the charge went through, the reply did not',
      eli5: 'You hand over a parcel and pay. The receipt blows away before you see it, so you pay again for the same parcel. The post office has no way to know it is the same one.',
      body: [
        'The app sends `POST /orders` with a $60 basket. The API saves the order and charges the card. Then the response is lost: a tunnel, a timeout at 10 seconds, a load balancer restart.',
        'From the client\'s side, the request might have failed before, during or after the charge. It cannot tell which. Not retrying loses real orders. Retrying blindly charges twice.',
        '`GET`, `PUT` and `DELETE` are meant to be **idempotent**: sending them twice leaves the same result as once. `POST` is not. Each one creates something new. Mobile networks plus automatic retries turned that into about one double charge per 300 orders.',
      ],
      keyIdea: 'Networks lose replies, so clients must retry. A retry is only safe if the operation is idempotent.',
      metrics: { latency: '18 ms', rows: '20', dupes: '1 in 300', broken: '30% of phones' },
      scene: {
        nodes: [{ ...phone, status: 'hot', badge: 'timeout, retry' }, { ...api, status: 'active' }, db, { ...pay, status: 'hot', badge: '2 × $60' }],
        links: [...baseLinks, { from: 'api', to: 'pay' }],
        flows: [
          { path: ['phone', 'api', 'pay'], tone: 'request', label: 'POST /orders', duration: 1.6 },
          { path: ['pay', 'api'], tone: 'response', label: 'charged', duration: 0.8, delay: 1.7 },
          { path: ['api', 'phone'], tone: 'error', label: 'reply lost', duration: 1, delay: 2.6 },
          { path: ['phone', 'api', 'pay'], tone: 'request', label: 'retry POST', duration: 1.6, delay: 3.8 },
        ],
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
        'The server records the key before doing the work. A new key runs the operation and stores the response under that key. A key it has already finished returns the **stored response**, and nothing is charged again. A key still in progress gets `409 Conflict`, so the client waits and retries.',
        'Scope keys per user, keep them for about 24 hours, and store a hash of the request body. The same key with a different body is a client bug, and should get an error, not the old answer.',
      ],
      keyIdea: 'An idempotency key turns "do this" into "do this once". Retries then replay the stored answer.',
      metrics: { latency: '20 ms', rows: '20', dupes: '0', broken: '30% of phones' },
      scene: {
        nodes: [{ ...phone, status: 'ok', badge: 'same key on retry' }, { ...api, status: 'active' }, db, { ...keys, status: 'ok', badge: 'key 7f3a: done' }, { ...pay, status: 'ok', badge: '1 × $60' }],
        links: [...baseLinks, { from: 'api', to: 'pay' }, { from: 'api', to: 'keys' }],
        flows: [
          { path: ['phone', 'api'], tone: 'request', label: 'retry, key 7f3a', duration: 1.1 },
          { path: ['api', 'keys'], tone: 'request', label: 'seen 7f3a?', duration: 1, delay: 1.2 },
          { path: ['keys', 'api'], tone: 'response', label: 'stored 201', duration: 1, delay: 2.3 },
          { path: ['api', 'phone'], tone: 'response', label: '201, order 9001', duration: 1.1, delay: 3.4 },
        ],
        caption: 'The retry gets the first answer back',
      },
      code: {
        language: 'python',
        title: 'Handling an idempotency key',
        source: `def create_order(user_id, body, idem_key):
    k = f"idem:{user_id}:{idem_key}"
    fingerprint = sha256(canonical_json(body))
    # Claim the key atomically. NX: only if no one has it yet.
    claimed = r.set(k, json.dumps({"state": "running", "fp": fingerprint}),
                    nx=True, ex=86400)
    if not claimed:
        rec = json.loads(r.get(k))
        if rec["fp"] != fingerprint:
            return 422, {"error": "key reused with a different body"}
        if rec["state"] == "running":
            return 409, {"error": "request still in progress"}
        return rec["status"], rec["response"]          # replay, no new charge
    status, response = place_order_and_charge(user_id, body)
    r.set(k, json.dumps({"state": "done", "fp": fingerprint,
                         "status": status, "response": response}), ex=86400)
    return status, response`,
        highlight: [5, 6, 13, 14, 15],
      },
    },
    {
      title: 'Errors',
      tag: 'concept',
      heading: 'One error format, everywhere',
      eli5: 'Every rejected form comes back with the same printed slip: a code, a plain sentence, and which box was wrong. Customers learn to read one slip, not a different note from each clerk.',
      body: [
        'Use the HTTP status for the category: `400` bad input, `401` not signed in, `403` not allowed, `404` missing, `409` conflict, `422` failed validation, `429` slow down, `5xx` our fault. Never answer `200` with an error inside.',
        'Put the detail in a body with the same shape on every endpoint: a stable machine-readable `code`, a human `message`, the offending `field` when there is one, and a `request_id` that matches your logs. Clients branch on `code`, never on the message text.',
        'The status also tells clients whether to retry. `429` and `503` can be retried after the `Retry-After` delay. `400` and `422` will fail the same way every time.',
      ],
      keyIdea: 'Status code for the category, a stable code for the reason, a request id for the logs.',
      metrics: { latency: '20 ms', rows: '20', dupes: '0', broken: '30% of phones' },
      scene: {
        nodes: [{ ...phone, status: 'active', badge: 'code: card_declined' }, { ...api, status: 'active' }, { ...pay, status: 'active', badge: 'declined' }],
        links: [{ from: 'phone', to: 'api' }, { from: 'api', to: 'pay' }],
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
    "field": "payment_method",
    "request_id": "req_8c41e2",
    "docs": "https://docs.shop.example/errors#card_declined"
  }
}`,
        highlight: [3, 5, 6],
      },
    },
    {
      title: 'Versioning',
      tag: 'tradeoff',
      heading: 'Change the API without breaking old clients',
      eli5: 'Old forms stay valid. New boxes are added at the bottom, and nobody renames a box people already fill in. When a form must really change, the post office prints form 2 and accepts both for a while.',
      body: [
        'Phones update slowly, and some never do. An app version from a year ago may still send requests. So most changes must be **additive**: add new fields and endpoints, never rename or remove, never change a field\'s type or meaning. Clients should ignore fields they do not know.',
        'Renaming `total` to `total_cents` is a breaking change. Add `total_cents` next to `total` and keep both. When a break is unavoidable, start a new **version**. A path prefix (`/v2/orders`) is visible and easy to route. A header (`Accept-Version: 2`) keeps URLs stable but is easy to forget. Some APIs pin each client to the dated version it signed up with.',
        'Run old versions side by side, measure who still calls them, announce a date with a `Sunset` header, and switch off only when traffic is near zero. Each live version is code you maintain, so keep the count small.',
      ],
      keyIdea: 'Add, never rename or remove. Save new versions for real breaks, and retire old ones by measuring who still uses them.',
      metrics: { latency: '20 ms', rows: '20', dupes: '0', broken: '0' },
      scene: {
        nodes: [{ ...phone, label: 'new app', sub: 'v3.2', status: 'ok' }, { ...oldApp, status: 'ok', badge: 'still on /v1' }, { ...api, status: 'active', badge: '/v1 and /v2' }, db],
        links: [...baseLinks, { from: 'oldApp', to: 'api' }],
        flows: [
          { path: ['phone', 'api'], tone: 'request', label: 'GET /v2/orders', duration: 1.2 },
          { path: ['oldApp', 'api'], tone: 'request', label: 'GET /v1/orders', duration: 1.2, delay: 0.3 },
          { path: ['api', 'phone'], tone: 'response', label: 'total_cents', duration: 1.2, delay: 1.5 },
          { path: ['api', 'oldApp'], tone: 'response', label: 'total + Sunset', duration: 1.2, delay: 1.8 },
        ],
        caption: 'Both versions served until the old one goes quiet',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Bounded lists, safe retries, stable contracts',
      eli5: 'The post office now hands out mail in bundles with a ticket for where you stopped, puts a sticker on every parcel so it is never paid twice, uses one kind of error slip, and keeps old forms working.',
      body: [
        'Never return unbounded lists. **Offset** pages are simple and allow jumping, but deep pages are slow and shifting data causes repeats and gaps. **Cursor** pages cost the same at any depth. Filter and sort only on indexed fields from an allowlist.',
        'Clients must retry, so writes need **idempotency keys**: the server stores the first response under the key and replays it. Errors share one shape with a stable code. Changes are additive, and real breaks get a new version that runs alongside the old one until its traffic dies out.',
      ],
      keyIdea: 'Design the API for the worst day: the largest account, the worst network and the oldest client.',
      metrics: { latency: '15 ms', rows: '20', dupes: '0', broken: '0' },
      scene: {
        nodes: [{ ...phone, status: 'ok' }, { ...api, status: 'ok' }, db, { ...keys, status: 'ok' }],
        links: [...baseLinks, { from: 'api', to: 'keys' }],
        flows: [
          { path: ['phone', 'api', 'db'], tone: 'request', label: '?after=cursor', duration: 1.6 },
          { path: ['db', 'api', 'phone'], tone: 'response', duration: 1.6, delay: 1.7 },
          { path: ['api', 'keys'], tone: 'data', label: 'store key', duration: 1, delay: 3.4 },
        ],
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
