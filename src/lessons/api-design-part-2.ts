import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const newApp: SceneNode = { id: 'newApp', kind: 'phone', at: at(-4, -3.4), label: 'new app', sub: 'v3.2' };
const oldApp: SceneNode = { id: 'oldApp', kind: 'phone', at: at(-4, 3.4), label: 'old app', sub: 'v2.0, never updated' };
const api: SceneNode = { id: 'api', kind: 'block', at: at(0, 0), label: 'orders API', sub: 'HTTPS + JSON', icon: 'Network', tint: 'violet' };
const db: SceneNode = { id: 'db', kind: 'db', at: at(4, 0), label: 'Postgres', sub: '50M orders' };
const phone: SceneNode = { id: 'phone', kind: 'phone', at: at(-4, 0), label: 'shop app', sub: 'v3.2' };
const worker: SceneNode = { id: 'worker', kind: 'worker', at: at(4, 0), label: 'export worker', sub: 'builds the file' };
const hook: SceneNode = { id: 'hook', kind: 'block', at: at(4, 0), label: 'partner server', sub: 'webhook URL', icon: 'Webhook', tint: 'teal' };

const fromApps = [link('newApp', 'api'), link('oldApp', 'api')];
const base = [link('phone', 'api'), link('api', 'db')];

export const apiDesignPart2: Lesson = {
  id: 'api-design-part-2',
  title: 'API design: versioning and operating an API (part 2)',
  tagline: 'Changing an API without breaking old clients, and the features that keep it healthy in production.',
  minutes: 15,
  level: 'Intermediate',
  learn: [
    'Additive changes, new versions and how to retire an old one',
    'Conditional requests with ETags and safe concurrent updates',
    'Rate limit responses, slow jobs and webhooks',
    'Partial responses, batch calls and data conventions',
    'Per-object authorization and a written contract',
  ],
  metrics: [
    { key: 'broken', label: 'Broken clients', icon: 'Bug' },
    { key: 'versions', label: 'Live versions', icon: 'Layers' },
    { key: 'bytes', label: 'Payload', icon: 'Download' },
    { key: 'calls', label: 'Calls', icon: 'Repeat' },
  ],
  steps: [
    {
      title: 'Old phones',
      tag: 'problem',
      heading: 'The phone you cannot update',
      eli5: 'The post office changes its forms overnight. People holding last year\'s form get turned away, and you cannot take old forms out of their pockets.',
      body: [
        'Phones update slowly, and some never do. Today **30%** of requests come from builds older than six months. A developer renames `total` to `total_cents` on Monday.',
        'The new app reads the new field. Every old phone looks for `total`, finds nothing, and shows a blank price.',
      ],
      keyIdea: 'You cannot recall an app from a pocket. Whatever you ship must keep working for old clients.',
      metrics: { broken: '30% of phones', versions: '1', bytes: '10 KB', calls: '1 per screen' },
      metricTones: { broken: 'bad' },
      scene: {
        nodes: [{ ...newApp, status: 'ok' }, { ...oldApp, status: 'hot', badge: 'price: blank' }, { ...api, status: 'active' }],
        links: fromApps,
        flows: [
          { path: ['newApp', 'api'], tone: 'request', label: 'GET /orders/9001', duration: 1.2 },
          { path: ['oldApp', 'api'], tone: 'request', label: 'GET /orders/9001', duration: 1.2, delay: 0.3 },
          { path: ['api', 'newApp'], tone: 'response', label: 'total_cents: 6000', duration: 1.2, delay: 1.6 },
          { path: ['api', 'oldApp'], tone: 'error', label: 'total_cents: 6000', duration: 1.2, delay: 1.9 },
        ],
        panel: {
          title: 'Who reads what',
          icon: 'Smartphone',
          rows: [
            { text: 'New app v3.2', value: 'reads total_cents', tone: 'good' },
            { text: 'Old app v2.0', value: 'reads total, finds nothing', tone: 'bad' },
          ],
          footer: { text: '30% of phones show a blank price', tone: 'bad' },
        },
        caption: 'A rename broke every old phone',
      },
    },
    {
      title: 'Additive changes',
      tag: 'concept',
      heading: 'Add, never rename or remove',
      eli5: 'New boxes get added at the bottom of the form. Nobody renames or removes a box that people already fill in. And a clerk who sees a box she does not know just skips it.',
      body: [
        'Safe changes are **additive**: new fields, new endpoints, new optional parameters. Never rename or remove a field, change its type or meaning, or make an optional input required.',
        'Clients keep their half of the deal: ignore fields they do not know, so a new field never breaks them.',
      ],
      keyIdea: 'Additive changes need no new version. Renames, removals and type changes do.',
      metrics: { broken: '30% of phones', versions: '1', bytes: '10 KB', calls: '1 per screen' },
      scene: {
        nodes: [{ ...newApp, status: 'ok' }, { ...oldApp, status: 'ok', badge: 'ignores new fields' }, { ...api, status: 'active' }],
        links: fromApps,
        flows: [
          { path: ['api', 'newApp'], tone: 'response', label: '+ gift_message', duration: 1.4 },
          { path: ['api', 'oldApp'], tone: 'response', label: '+ gift_message', duration: 1.4, delay: 0.3 },
        ],
        panel: {
          title: 'Safe or breaking',
          icon: 'Shield',
          rows: [
            { text: 'Add a field', value: 'safe', tone: 'good' },
            { text: 'Add an endpoint', value: 'safe', tone: 'good' },
            { text: 'Add an optional parameter', value: 'safe', tone: 'good' },
            { text: 'Rename or remove a field', value: 'breaking', tone: 'bad' },
            { text: 'Change a type or meaning', value: 'breaking', tone: 'bad' },
            { text: 'Make an input required', value: 'breaking', tone: 'bad' },
          ],
        },
        caption: 'New fields are invisible to old clients',
      },
    },
    {
      title: 'Rename safely',
      tag: 'case',
      heading: 'Case: renaming total to total_cents',
      eli5: 'Instead of crossing out the old box, the post office adds a new one next to it. Old forms still work. New forms use the new box.',
      body: [
        'Add `total_cents` next to `total` and keep both. New apps read the new field. Old apps keep reading the old one.',
        'Mark `total` as deprecated in the docs. Remove it only when the last old client is gone, which a new version (next step) makes easier to plan.',
      ],
      keyIdea: 'A rename is an add plus a later remove, with a long gap between them.',
      metrics: { broken: '0', versions: '1', bytes: '10 KB', calls: '1 per screen' },
      metricTones: { broken: 'good' },
      scene: {
        nodes: [{ ...newApp, status: 'ok' }, { ...oldApp, status: 'ok', badge: 'price shows again' }, { ...api, status: 'active' }],
        links: fromApps,
        flows: [
          { path: ['api', 'newApp'], tone: 'response', label: 'total_cents', duration: 1.3 },
          { path: ['api', 'oldApp'], tone: 'response', label: 'total', duration: 1.3, delay: 0.3 },
        ],
        panel: {
          title: 'Both fields during the gap',
          icon: 'FileJson',
          code: '{\n  "id": "9001",\n  "total": 60.00,        // deprecated\n  "total_cents": 6000,   // new\n  "currency": "USD"\n}',
          footer: { text: 'The old float total is the field being retired', tone: 'warn' },
        },
        caption: 'Old and new readers served by one response',
      },
    },
    {
      title: 'Version styles',
      tag: 'tradeoff',
      heading: 'When a break is unavoidable, start a version',
      eli5: 'Sometimes a form really must change. The post office prints "form 2" and keeps accepting form 1. Where the number goes on the form decides how easy it is to sort.',
      body: [
        'A new **version** starts when a break is unavoidable. A path prefix (`/v2/orders`) is visible and easy to route. A header (`Accept-Version: 2`) keeps URLs stable but is easy to forget. Some APIs pin each client to the dated version it signed up with.',
        'Versions are costly: each one is code you test and run. Keep the count small.',
      ],
      keyIdea: 'Pick one versioning style, use it everywhere, and treat each live version as a running cost.',
      metrics: { broken: '0', versions: '2', bytes: '10 KB', calls: '1 per screen' },
      scene: {
        nodes: [{ ...newApp, status: 'ok' }, { ...oldApp, status: 'ok' }, { ...api, status: 'active', badge: '/v1 and /v2' }],
        links: fromApps,
        flows: [
          { path: ['newApp', 'api'], tone: 'request', label: 'GET /v2/orders', duration: 1.3 },
          { path: ['oldApp', 'api'], tone: 'request', label: 'GET /v1/orders', duration: 1.3, delay: 0.3 },
        ],
        panel: {
          title: 'Where the version lives',
          icon: 'Layers',
          rows: [
            { text: 'Path: /v2/orders', value: 'visible, easy to route', tone: 'good' },
            { text: 'Header: Accept-Version', value: 'clean URLs, easy to forget', tone: 'warn' },
            { text: 'Pinned by date', value: 'per-client setting to keep', tone: 'warn' },
          ],
        },
        caption: 'Two doors into the same data',
      },
    },
    {
      title: 'Run both',
      tag: 'concept',
      heading: 'Run old and new side by side',
      eli5: 'The post office keeps both windows open: one for form 1, one for form 2. A counter on each window tells the manager how many people still use the old one.',
      body: [
        'Both versions read the same data. The old one is a thin layer that maps the stored fields to the old shape, so you fix a bug once.',
        'Measure who still calls each version, by client and by day. That number, not a calendar, decides when you can retire one.',
      ],
      keyIdea: 'Old versions should be a thin mapping over one core, and traffic per version is the signal to watch.',
      metrics: { broken: '0', versions: '2', bytes: '10 KB', calls: '1 per screen' },
      scene: {
        nodes: [{ ...newApp, status: 'ok' }, { ...oldApp, status: 'ok' }, { ...api, status: 'active', chips: [{ text: '/v2  70%', tone: 'good' }, { text: '/v1  30%', tone: 'warn' }] }, db],
        links: [...fromApps, link('api', 'db')],
        flows: [
          { path: ['newApp', 'api', 'db'], tone: 'request', label: '/v2', duration: 1.5 },
          { path: ['oldApp', 'api', 'db'], tone: 'request', label: '/v1', duration: 1.5, delay: 0.3 },
          { path: ['db', 'api', 'newApp'], tone: 'response', label: 'total_cents', duration: 1.5, delay: 1.8 },
          { path: ['db', 'api', 'oldApp'], tone: 'response', label: 'total', duration: 1.5, delay: 2.1 },
        ],
        caption: 'One core, two shapes',
      },
    },
    {
      title: 'Sunset',
      tag: 'concept',
      heading: 'Retire a version on a published date',
      eli5: 'The post office pins a notice on window 1: "closing on June 30, use window 2". Staff tell regulars personally. The window closes only when nobody queues there anymore.',
      body: [
        'Announce a date. Send a `Sunset` header on every `/v1` response and track the traffic fall. Emailing owners works for partner and API-key clients only. Phones cannot be emailed, so send the app version in a header (`X-App-Version`) and show a forced-update screen below a minimum version.',
        'A never-updated v2.0 will not reach zero. Switch off when traffic is near zero, and accept a hard cutoff for a small tail.',
      ],
      keyIdea: 'Warn in every response, reach partners by email and phones by forced update, and accept a small tail at the cutoff.',
      metrics: { broken: '0', versions: '2 to 1', bytes: '10 KB', calls: '1 per screen' },
      metricTones: { versions: 'good' },
      scene: {
        nodes: [{ ...newApp, status: 'ok' }, { ...oldApp, status: 'dim', badge: 'traffic: 1%' }, { ...api, status: 'active', chips: [{ text: '/v1  1%', tone: 'good' }] }],
        links: fromApps,
        flows: [
          { path: ['oldApp', 'api'], tone: 'request', label: 'GET /v1/orders', duration: 1.3 },
          { path: ['api', 'oldApp'], tone: 'response', label: 'Sunset header', duration: 1.3, delay: 1.5 },
        ],
        panel: {
          title: 'Headers on every /v1 reply',
          icon: 'Clock',
          code: 'HTTP/1.1 200 OK\nSunset: Wed, 30 Jun 2027 23:59:59 GMT\nLink: <https://docs.shop.example/v2>;\n      rel="successor-version"',
          footer: { text: 'Off when traffic is near zero or the tail is accepted', tone: 'good' },
        },
        caption: 'Announce, measure, then switch off',
      },
    },
    {
      title: 'Conditional GET',
      tag: 'concept',
      heading: 'Cache-Control and ETags: skip the request, then the body',
      eli5: 'The clerk stamps each parcel with a fingerprint. Next visit you say "I still have fingerprint a91". If it matches, she says "same as before" and keeps the parcel on the shelf.',
      body: [
        '`Cache-Control: private, max-age=60` lets the client reuse a reply for 60 s with no request at all. `public` also lets a CDN keep it. Once stale, the client sends the response `ETag` back as `If-None-Match`.',
        'If nothing changed, the server answers `304 Not Modified` with no body, so a 40 KB list becomes a few hundred bytes. The same fingerprint also guards updates, in the next step.',
      ],
      keyIdea: 'max-age avoids the request. ETag avoids the body when the entry is stale.',
      metrics: { broken: '0', versions: '1', bytes: '40 KB to 0.3 KB', calls: '1 per screen' },
      metricTones: { bytes: 'good' },
      scene: {
        nodes: [{ ...phone, chips: ['If-None-Match: "a91"'] }, { ...api, status: 'active' }, db],
        links: base,
        flows: [
          { path: ['phone', 'api'], tone: 'request', label: 'If-None-Match: "a91"', duration: 1.3 },
          { path: ['api', 'phone'], tone: 'response', label: '304, no body', duration: 1.3, delay: 1.5 },
        ],
        panel: {
          title: 'Two layers of caching',
          icon: 'Download',
          code: '200 OK                  first GET, 40 KB\nCache-Control: private, max-age=60\nETag: "a91"\n\n(after 60 s the copy is stale)\nIf-None-Match: "a91"\n304 Not Modified        about 300 B',
          footer: { text: 'ETag changes when the order changes', tone: 'muted' },
        },
        caption: 'Same fingerprint, nothing to send',
      },
    },
    {
      title: 'Lost updates',
      tag: 'case',
      heading: 'Case: two staff edit one order',
      eli5: 'Two clerks copy the same parcel record. One writes a new address, the other adds a note on the old copy and overwrites the address with the old one. Nobody tells them.',
      body: [
        'Ana saves a new address. Ben, still holding the old copy, saves a note and overwrites her address with the old one. Last write wins, and nobody is told.',
        'Fix: send the `ETag` back as `If-Match` on the update. If the order changed meanwhile, the server answers `412 Precondition Failed`, and Ben reads the new copy first.',
      ],
      keyIdea: 'If-Match turns a silent overwrite into a loud 412 that the client can resolve.',
      metrics: { broken: '0', versions: '1', bytes: '10 KB', calls: '2 writes' },
      scene: {
        nodes: [
          { id: 'ana', kind: 'client', at: at(-4, -4.2), label: 'Ana', sub: 'saved first', status: 'ok' },
          { id: 'ben', kind: 'client', at: at(-4, 4.2), label: 'Ben', sub: 'holds v7', status: 'hot', badge: 'stale copy' },
          { ...api, status: 'active', chips: ['order 9001 is at v8'] },
          db,
        ],
        links: [link('ana', 'api'), link('ben', 'api'), link('api', 'db')],
        flows: [
          { path: ['ana', 'api', 'db'], tone: 'request', label: 'PUT, If-Match v7', duration: 1.5 },
          { path: ['ben', 'api'], tone: 'request', label: 'PUT, If-Match v7', duration: 1.2, delay: 1.8 },
          { path: ['api', 'ben'], tone: 'error', label: '412 Precondition Failed', duration: 1.2, delay: 3.1 },
        ],
        panel: {
          title: 'Without and with If-Match',
          icon: 'Copy',
          rows: [
            { text: 'No check', value: 'Ben overwrites Ana', tone: 'bad' },
            { text: 'If-Match: v7, order at v8', value: '412, Ben re-reads', tone: 'good' },
          ],
        },
        caption: 'The second writer is told, not ignored',
      },
      quiz: {
        question: 'Ben sends PUT /orders/9001 with If-Match: "v7", but the order is now at "v8". What should the server do?',
        options: [
          'Apply the update anyway, since the last write wins',
          'Return 304 Not Modified',
          'Return 412 Precondition Failed and leave the order unchanged',
          'Return 404 because the old version no longer exists',
        ],
        answer: 2,
        explain: 'If-Match says "only apply this if the order is still at v7". It is not, so the precondition fails. The server returns 412 and changes nothing, and the client re-reads the order and decides what to do.',
      },
    },
    {
      title: 'Rate limits',
      tag: 'concept',
      heading: 'Tell clients their budget',
      eli5: 'Each customer gets 100 tickets an hour. When they run out, the clerk says "come back in 30 seconds", and she tells everyone how many tickets they have left on each visit.',
      body: [
        'A public API gives each client a budget. Over the budget, answer `429 Too Many Requests` with a `Retry-After` header.',
        'Send the remaining budget on every reply, for example `X-RateLimit-Remaining`, so well-behaved clients slow down before they hit the wall. Header names vary by provider. How limits are counted is its own topic.',
      ],
      keyIdea: 'Say how much budget is left on every reply, and give a 429 with Retry-After when it runs out.',
      metrics: { broken: '0', versions: '1', bytes: '10 KB', calls: '100 per minute' },
      scene: {
        nodes: [
          { ...phone, chips: [{ text: 'POST /orders', tone: 'warn' }] },
          { id: 'limit', kind: 'block', at: at(0, 0), label: 'rate limit', sub: '100 per minute', icon: 'Gauge', tint: 'amber', status: 'hot' },
          { ...api, id: 'api', at: at(4, 0), size: 0.8 },
        ],
        links: [link('phone', 'limit', { label: 'call 101', labelTone: 'warn' }), link('limit', 'api')],
        flows: [
          { path: ['phone', 'limit'], tone: 'request', label: 'call 101', duration: 1.3 },
          { path: ['limit', 'phone'], tone: 'error', label: '429, Retry-After: 30', duration: 1.3, delay: 1.5 },
        ],
        panel: {
          title: 'Headers on every reply',
          icon: 'Gauge',
          code: 'X-RateLimit-Limit: 100\nX-RateLimit-Remaining: 0\nRetry-After: 30',
          footer: { text: '429 means wait, then retry', tone: 'warn' },
        },
        caption: 'Over budget: wait 30 seconds',
      },
    },
    {
      title: 'Slow work',
      tag: 'concept',
      heading: 'Return 202 for work that takes minutes',
      eli5: 'A big print job does not make you stand at the counter. The clerk gives you a ticket right away, and you check the ticket board until it says "ready".',
      body: [
        'A request that runs for minutes holds a connection open and trips timeouts. Return `202 Accepted` at once with a status URL, such as `Location: /exports/77`, and do the work on a worker.',
        'The client polls the status URL, or you tell it with a webhook. When finished, the status points at the result.',
      ],
      keyIdea: 'Accept fast, work in the background, and give the client a URL to ask about progress.',
      metrics: { broken: '0', versions: '1', bytes: '10 KB', calls: '1 + polls' },
      scene: {
        nodes: [phone, { ...api, status: 'active' }, { ...worker, status: 'active', badge: 'building export' }],
        links: [link('phone', 'api'), link('api', 'worker')],
        flows: [
          { path: ['phone', 'api'], tone: 'request', label: 'POST /exports', duration: 1.2 },
          { path: ['api', 'phone'], tone: 'response', label: '202 + Location', duration: 1.2, delay: 1.4 },
          { path: ['api', 'worker'], tone: 'event', label: 'job 77', duration: 1.2, delay: 1.7 },
          { path: ['phone', 'api'], tone: 'request', label: 'GET /exports/77', duration: 1.2, delay: 3.2 },
        ],
        panel: {
          title: 'Job status',
          icon: 'Clock',
          rows: [
            { text: 'GET /exports/77', value: '"state": "running"', tone: 'warn' },
            { text: 'a minute later', value: '"state": "done"', tone: 'good' },
            { text: 'then', value: '"url": "/files/77.csv"' },
          ],
        },
        caption: 'A ticket now, the result later',
      },
    },
    {
      title: 'Webhooks',
      tag: 'concept',
      heading: 'Webhooks: your server calls theirs',
      eli5: 'Instead of the customer asking every minute, the post office phones them when the parcel is ready. They tell the clerk their phone number once.',
      body: [
        'Polling wastes calls. With a **webhook** the client registers a URL, and your server sends it a `POST` when something happens, such as `order.shipped`.',
        'Each event carries a unique `id` and a type. The receiver answers `2xx` quickly, and does any slow work afterwards.',
      ],
      keyIdea: 'A webhook reverses the call: the server pushes an event to a URL the client registered.',
      metrics: { broken: '0', versions: '1', bytes: '10 KB', calls: '1 per event' },
      scene: {
        nodes: [{ ...api, status: 'active' }, { ...hook, status: 'ok' }],
        links: [link('api', 'hook', { label: 'POST event' })],
        flows: [
          { path: ['api', 'hook'], tone: 'event', label: 'order.shipped', duration: 1.5 },
          { path: ['hook', 'api'], tone: 'response', label: '200', duration: 1.2, delay: 1.7 },
        ],
        panel: {
          title: 'One event',
          icon: 'Webhook',
          code: '{\n  "id": "evt_5d21",\n  "type": "order.shipped",\n  "data": { "order_id": "9001" }\n}',
        },
        caption: 'The server pushes, the client listens',
      },
    },
    {
      title: 'Signed webhooks',
      tag: 'concept',
      heading: 'Sign every event and reject old ones',
      eli5: 'The post office says a secret word and the date on every phone call, so you know it is really them. A recording of last week\'s call will not pass, because the date is wrong.',
      body: [
        'Sign the body with a shared secret (an HMAC in a header) so the receiver can check the sender. Include a timestamp in the signed payload.',
        'The receiver rejects events older than about 5 minutes. Without that, someone who captures one signed request can resend it later.',
      ],
      keyIdea: 'A signature proves who sent it. A signed timestamp stops a captured request from being replayed.',
      metrics: { broken: '0', versions: '1', bytes: '10 KB', calls: '1 per event' },
      scene: {
        nodes: [{ ...api, status: 'active' }, { ...hook, status: 'ok', badge: 'checks signature' }],
        links: [link('api', 'hook')],
        flows: [
          { path: ['api', 'hook'], tone: 'event', label: 'signed, t=now', duration: 1.4 },
          { path: ['hook', 'api'], tone: 'response', label: '200', duration: 1.2, delay: 1.6 },
          { path: ['api', 'hook'], tone: 'error', label: 'replay, 2 h old', duration: 1.4, delay: 3.2 },
        ],
        panel: {
          title: 'Signature header',
          icon: 'Shield',
          code: 'X-Signature: t=1763371800,\n  v1=HMAC_SHA256(secret, t + "." + body)',
          footer: { text: 'Reject if t is older than 5 minutes', tone: 'warn' },
        },
        caption: 'A valid signature is not enough, it must be fresh',
      },
    },
    {
      title: 'Webhook retries',
      tag: 'tradeoff',
      heading: 'Retry events, dedupe them, ignore their order',
      eli5: 'If you do not pick up, the post office calls again later, so you may hear the same news twice. Two calls can also arrive in the wrong order, so check the date on each.',
      body: [
        'If the receiver is down, retry with backoff for a day or so. Retries mean **at-least-once** delivery, so the receiver must dedupe on the event `id`, like an idempotency key.',
        'Order is not guaranteed. Consumers should use the event time, or re-fetch the object, instead of trusting arrival order.',
      ],
      keyIdea: 'Three receiver rules: retry failures, dedupe on the event id, and never rely on arrival order.',
      metrics: { broken: '0', versions: '1', bytes: '10 KB', calls: '2 tries' },
      scene: {
        nodes: [{ ...api, status: 'active' }, { ...hook, status: 'hot', badge: 'down, then up' }],
        links: [link('api', 'hook')],
        flows: [
          { path: ['api', 'hook'], tone: 'event', label: 'evt_5d21, try 1', duration: 1.2 },
          { path: ['hook', 'api'], tone: 'error', label: '503', duration: 1, delay: 1.4 },
          { path: ['api', 'hook'], tone: 'event', label: 'evt_5d21, try 2', duration: 1.2, delay: 3 },
        ],
        panel: {
          title: 'Receiver checklist',
          icon: 'Shield',
          rows: [
            { text: 'Verify signature and timestamp', value: 'before parsing', tone: 'good' },
            { text: 'Skip an event id seen before', value: 'dedupe', tone: 'good' },
            { text: 'Order not guaranteed', value: 'use event time or re-fetch', tone: 'warn' },
            { text: 'Answer 2xx quickly', value: 'then work', tone: 'good' },
          ],
        },
        caption: 'Same event may arrive twice, and late',
      },
    },
    {
      title: 'Fields and expand',
      tag: 'concept',
      heading: 'Let clients shape the response',
      eli5: 'A customer who only wants the parcel weight can ask for just that on the slip. One who needs the sender details too can ask the clerk to staple them on.',
      body: [
        '`?fields=id,total_cents` returns only the fields the screen needs, and saves bytes on slow networks. `?expand=customer` embeds a related object, so one call replaces two.',
        'Allow only named fields and a shallow expand depth. Otherwise one request can pull half the database.',
      ],
      keyIdea: 'Fields trims what you send, expand saves a trip. Both need limits.',
      metrics: { broken: '0', versions: '1', bytes: '10 KB to 1 KB', calls: '2 to 1' },
      metricTones: { bytes: 'good', calls: 'good' },
      scene: {
        nodes: [{ ...phone, chips: ['?fields=id,total_cents', '?expand=customer'] }, { ...api, status: 'active' }, db],
        links: base,
        flows: [
          { path: ['phone', 'api', 'db'], tone: 'request', label: '?fields=id,total_cents', duration: 1.5 },
          { path: ['db', 'api', 'phone'], tone: 'response', label: '1 KB, with customer', duration: 1.5, delay: 1.7 },
        ],
        panel: {
          title: 'One call, shaped',
          icon: 'FileJson',
          code: '{\n  "id": "9001",\n  "total_cents": 6000,\n  "customer": { "id": "42", "name": "Ana" }\n}',
        },
        caption: 'Only what the screen needs',
      },
    },
    {
      title: 'Batch calls',
      tag: 'concept',
      heading: 'Batch many small writes into one call',
      eli5: 'A shop dropping off 50 parcels hands over one box with a list, not 50 separate trips. The clerk checks each parcel and tells them which ones she could not take.',
      body: [
        'A client with 50 writes over a 100 ms mobile link spends 5 seconds on round trips. A batch endpoint takes up to 50 items in one request and returns a result per item.',
        'Cap the size, and report success or failure for each item, because one bad item must not hide 49 good ones. Give each item its own idempotency key so retries stay safe.',
      ],
      keyIdea: 'A batch cuts round trips. Cap it, and report a result for every item.',
      metrics: { broken: '0', versions: '1', bytes: '10 KB', calls: '50 to 1' },
      metricTones: { calls: 'good' },
      scene: {
        nodes: [{ ...phone, chips: ['50 orders'] }, { ...api, status: 'active', chips: ['POST /orders:batch'] }, db],
        links: base,
        flows: [
          { path: ['phone', 'api', 'db'], tone: 'request', label: '1 call, 50 items', duration: 1.6 },
          { path: ['db', 'api', 'phone'], tone: 'response', label: '49 ok, 1 failed', duration: 1.6, delay: 1.8 },
        ],
        panel: {
          title: 'Result per item',
          icon: 'List',
          rows: [
            { text: 'item 1 to 49', value: '201 Created', tone: 'good' },
            { text: 'item 50', value: '422 validation_failed', tone: 'bad' },
          ],
          footer: { text: 'Cap: 50 items per call', tone: 'muted' },
        },
        caption: 'One trip, a verdict for each item',
      },
    },
    {
      title: 'Data conventions',
      tag: 'concept',
      heading: 'Boring data formats prevent bugs',
      eli5: 'Every form uses the same way to write a date and the same way to write money. Nobody has to guess whether "03/04" means March or April.',
      body: [
        'Send money as an integer in the smallest unit plus a currency: `6000` and `"USD"`, never `60.0` as a float. Send timestamps as ISO 8601 in UTC: `2026-11-17T09:30:00Z`.',
        'Use string ids so you can change their format later, and one naming style (`snake_case`) for every field in every endpoint.',
      ],
      keyIdea: 'Pick one format for money, time, ids and names, and never mix them.',
      metrics: { broken: '0', versions: '1', bytes: '10 KB', calls: '1 per screen' },
      scene: {
        nodes: [phone, { ...api, status: 'active' }, db],
        links: base,
        flows: [
          { path: ['db', 'api', 'phone'], tone: 'response', label: 'one format', duration: 1.8 },
        ],
        panel: {
          title: 'Conventions',
          icon: 'Table',
          rows: [
            { text: 'Money', value: '6000 + "USD"', tone: 'good' },
            { text: 'Time', value: '2026-11-17T09:30:00Z', tone: 'good' },
            { text: 'Ids', value: '"9001", as strings', tone: 'good' },
            { text: 'Float for money', value: '60.0', tone: 'bad' },
            { text: 'Local time, no zone', value: '11/17 9:30', tone: 'bad' },
          ],
        },
        caption: 'The same shape everywhere',
      },
    },
    {
      title: 'Object access',
      tag: 'case',
      heading: 'Case: guessing another customer\'s order id',
      eli5: 'A customer asks for parcel 9001. Having a ticket is not enough. The clerk also checks that parcel 9001 is on this customer\'s own shelf.',
      body: [
        'User 42 is signed in and calls `GET /orders/9001`. Order 9001 belongs to user 7. If the API checks only that the caller is signed in, user 42 can walk through ids and read everyone\'s orders.',
        'Check ownership on every object in every endpoint, not only login. Answering `404` rather than `403` also avoids confirming that the id exists.',
      ],
      keyIdea: 'Authentication says who you are. Each request also needs a check that this object is yours.',
      metrics: { broken: '0', versions: '1', bytes: '10 KB', calls: '1 per screen' },
      scene: {
        nodes: [{ ...phone, label: 'user 42', sub: 'signed in', status: 'active' }, { ...api, status: 'active', badge: 'owner check' }, { ...db, badge: 'order 9001: user 7' }],
        links: base,
        flows: [
          { path: ['phone', 'api'], tone: 'request', label: 'GET /orders/9001', duration: 1.2 },
          { path: ['api', 'db'], tone: 'request', label: 'owner = 42?', duration: 1.1, delay: 1.4 },
          { path: ['db', 'api', 'phone'], tone: 'error', label: '404 not found', duration: 1.6, delay: 2.7 },
        ],
        panel: {
          title: 'Two checks',
          icon: 'Shield',
          rows: [
            { text: 'Is the caller signed in?', value: 'yes', tone: 'good' },
            { text: 'Does the caller own order 9001?', value: 'no, 404', tone: 'bad' },
          ],
        },
        caption: 'Signed in is not the same as allowed',
      },
    },
    {
      title: 'The contract',
      tag: 'concept',
      heading: 'Write the contract down and test it',
      eli5: 'The post office prints one rule book that lists every form, every box and every stamp. Clerks and customers both read the same book, so they cannot disagree.',
      body: [
        'Describe the API in a machine-readable spec such as **OpenAPI**: paths, parameters, bodies, error codes. Generate the docs and client libraries from it, so they never drift from the server.',
        'Run contract tests in CI that fail when a change removes a field or tightens a type. That catches breaking changes before the phones do.',
      ],
      keyIdea: 'One written spec drives the docs, the clients and the checks that stop accidental breaks.',
      metrics: { broken: '0', versions: '1', bytes: '10 KB', calls: '1 per screen' },
      scene: {
        nodes: [
          { id: 'spec', kind: 'block', at: at(-4, 0), label: 'OpenAPI spec', sub: 'the contract', icon: 'FileCode', tint: 'blue' },
          { ...api, status: 'active', chips: [{ text: 'contract test: pass', tone: 'good' }] },
          { id: 'sdk', kind: 'block', at: at(4, 0), label: 'docs + SDKs', sub: 'generated', icon: 'FileText', tint: 'green' },
        ],
        links: [link('spec', 'api', { label: 'checked in CI' }), link('spec', 'sdk', { route: 'straight' })],
        flows: [
          { path: ['spec', 'api'], tone: 'data', label: 'tests', duration: 1.4 },
          { path: ['spec', 'sdk'], tone: 'data', label: 'generate', duration: 1.8, delay: 0.5 },
        ],
        panel: {
          title: 'A change the check blocks',
          icon: 'Bug',
          rows: [
            { text: 'Remove "total"', value: 'build fails', tone: 'bad' },
            { text: 'Add "gift_message"', value: 'passes', tone: 'good' },
          ],
        },
        caption: 'Docs, clients and tests from one source',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Stable contracts, safe changes, healthy operation',
      eli5: 'The post office adds boxes but never renames them, keeps old windows open until they are empty, tells people their ticket budget, and writes one rule book that everyone reads.',
      body: [
        'Change by adding. Renames and type changes need a new **version** that runs beside the old one until its traffic dies, announced with `Sunset`. `ETag` and `If-Match` save bytes and stop lost updates.',
        'Answer `429` with `Retry-After`, return `202` for slow jobs, sign webhooks and dedupe them. Check object ownership every time, and keep one written contract.',
      ],
      keyIdea: 'Old clients, big accounts and flaky networks are the normal case. Design for them from the start.',
      metrics: { broken: '0', versions: '1', bytes: '10 KB', calls: '1 per screen' },
      metricTones: { broken: 'good' },
      scene: {
        nodes: [{ ...newApp, status: 'ok' }, { ...oldApp, status: 'ok' }, { ...api, status: 'ok' }, db],
        links: [...fromApps, link('api', 'db')],
        flows: [
          { path: ['newApp', 'api', 'db'], tone: 'request', label: '/v2', duration: 1.5 },
          { path: ['oldApp', 'api'], tone: 'request', label: '/v1', duration: 1.2, delay: 0.3 },
          { path: ['db', 'api', 'newApp'], tone: 'response', duration: 1.5, delay: 1.8 },
        ],
        panel: {
          title: 'Part 2 in four lines',
          icon: 'List',
          rows: [
            { text: 'Change', value: 'add, version, sunset', tone: 'good' },
            { text: 'Concurrency', value: 'ETag + If-Match', tone: 'good' },
            { text: 'Load', value: '429, 202, webhooks', tone: 'good' },
            { text: 'Trust', value: 'owner check + contract', tone: 'good' },
          ],
        },
      },
      quiz: {
        question: 'Which change can ship in /v1 without breaking existing clients?',
        options: [
          'Rename total to total_cents and remove total',
          'Add an optional gift_message field to the order response',
          'Change total from a number to a string',
          'Make the address parameter required on POST /orders',
        ],
        answer: 1,
        explain: 'Adding an optional field is additive, and clients ignore fields they do not know. The renamed field, changed type and newly required input all break clients that follow the old contract.',
      },
    },
  ],
};
