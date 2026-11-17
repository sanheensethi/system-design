import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];

const phone: SceneNode = { id: 'phone', kind: 'phone', at: at(-3.8, -3.8), label: 'mobile app', sub: 'home screen' };
const api: SceneNode = { id: 'api', kind: 'block', at: at(0, -3.8), label: 'API', sub: 'gateway', icon: 'Network', tint: 'violet' };
const users: SceneNode = { id: 'users', kind: 'block', size: 0.72, at: at(-3.6, 3.8), label: 'users', icon: 'Users', tint: 'blue' };
const orders: SceneNode = { id: 'orders', kind: 'block', size: 0.72, at: at(0, 3.8), label: 'orders', icon: 'ShoppingBag', tint: 'amber' };
const recs: SceneNode = { id: 'recs', kind: 'block', size: 0.72, at: at(3.6, 3.8), label: 'recs', icon: 'Star', tint: 'green' };

const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });
const fan = (extra: Partial<SceneLink> = {}) => [link('api', 'users', extra), link('api', 'orders', extra), link('api', 'recs', extra)];

export const apiStyles: Lesson = {
  id: 'api-styles',
  title: 'API styles: REST, RPC, gRPC, GraphQL',
  tagline: 'Four ways for a client to ask a server for something, what each one costs, and how to pick.',
  minutes: 14,
  level: 'Beginner',
  learn: [
    'REST: resources named by URLs, acted on with HTTP verbs',
    'RPC: calling a remote function by name',
    'gRPC: protobuf contracts and HTTP/2 streams between services',
    'GraphQL: one query for exactly the fields a screen needs, and what that costs the server',
    'How to choose a style for public, internal and mobile APIs',
  ],
  metrics: [
    { key: 'trips', label: 'Round trips', icon: 'Repeat' },
    { key: 'bytes', label: 'Payload', icon: 'Download' },
    { key: 'time', label: 'Screen load', icon: 'Timer' },
    { key: 'style', label: 'Style', icon: 'Braces' },
  ],
  steps: [
    {
      title: 'No contract',
      tag: 'problem',
      heading: 'One screen, three kinds of data, no agreed way to ask',
      eli5: 'A hungry family sits down in a restaurant with no menu. Nobody knows what they can ask for or how to ask, so the waiter keeps guessing.',
      body: [
        'A food delivery app opens on its home screen. It needs the **user**, their **last 5 orders** and **recommended** restaurants, each from a different service.',
        'The first version grew by accident: `/getHomeData`, `/getHomeData2`, `/doCancel?id=7`. Errors come back with status 200. Every new screen means a new one-off.',
        'An **API** is a contract: how to name things, how to ask, what comes back, how errors look. An **API style** gives that contract predictable rules.',
      ],
      keyIdea: 'An API is a contract. A style gives the contract predictable rules, so clients do not have to guess.',
      metrics: { trips: '?', bytes: '?', time: '?', style: 'ad hoc' },
      metricTones: { style: 'bad' },
      scene: {
        nodes: [
          { ...phone, chips: [{ text: '/getHomeData2', tone: 'warn' }] },
          { ...api, tint: 'gray', status: 'hot', badge: '14 one-off URLs', chips: [{ text: '200 {"error": ...}', tone: 'bad' }] },
          { id: 'backend', kind: 'block', size: 0.72, at: at(0, 3.8), label: 'backend', icon: 'Boxes', tint: 'gray' },
        ],
        links: [link('phone', 'api', { label: 'HTTPS' }), link('api', 'backend')],
        flows: [
          { path: ['phone', 'api'], tone: 'request', label: '/getHomeData2', duration: 1.2 },
          { path: ['api', 'backend', 'api'], tone: 'request', duration: 1.4, delay: 1.3 },
          { path: ['api', 'phone'], tone: 'error', label: '200 {"error": ...}', duration: 1.2, delay: 2.8 },
        ],
        panel: {
          title: 'Endpoints in the wild',
          icon: 'List',
          rows: [
            { text: '/getHomeData', value: '200' },
            { text: '/getHomeData2', value: '200' },
            { text: '/fetch_user_and_orders', value: '200 {"error"}', tone: 'bad' },
            { text: '/doCancel?id=7', value: '200, done?', tone: 'warn' },
          ],
          footer: { text: 'Nobody can guess the next URL', tone: 'bad' },
        },
        caption: 'Endpoints named by whoever wrote them',
      },
    },
    {
      title: 'REST',
      tag: 'concept',
      heading: 'REST: nouns in the URL, verbs from HTTP',
      eli5: '**REST** is a menu where every dish has a number. You point at dish 42 and say one of a few words: bring it, change it, or take it away.',
      body: [
        '**REST** models the system as **resources**, each with a URL such as `/users/42`. The URL is a noun. The HTTP method is the verb: `GET` reads, `POST` creates, `PATCH` changes, `DELETE` removes.',
        'Status codes carry the result: `200` OK, `404` not found, `409` conflict. A `GET` is safe to cache and retry, and every request is **stateless**, so any server can answer it.',
      ],
      keyIdea: 'REST is resources plus the standard HTTP verbs and status codes. Learn one resource and you can guess the rest.',
      metrics: { trips: '1 per resource', bytes: 'whole resource', time: '-', style: 'REST' },
      scene: {
        nodes: [phone, { ...api, label: 'REST API', sub: 'nouns + verbs' }, { ...users, status: 'active', chips: ['GET /users/42'] }],
        links: [link('phone', 'api'), link('api', 'users')],
        flows: [
          { path: ['phone', 'api', 'users'], tone: 'request', label: 'GET /users/42', duration: 1.8 },
          { path: ['users', 'api', 'phone'], tone: 'response', label: '200 + JSON', duration: 1.8, delay: 1.9 },
        ],
        panel: {
          title: 'HTTP verbs on one resource',
          icon: 'Code',
          code: 'GET    /users/42   read\nPOST   /users      create\nPATCH  /users/42   change\nDELETE /users/42   remove',
          footer: { text: '404 not found, 409 conflict', tone: 'muted' },
        },
        caption: 'A noun in the URL, a verb in the method',
      },
      code: {
        language: 'bash',
        title: 'The same resource, five verbs',
        source: `# read one order, and a list of them
curl https://api.eats.example/orders/9001
curl "https://api.eats.example/users/42/orders?limit=5"

# create: the server picks the id and answers 201 Created
curl -X POST https://api.eats.example/orders \\
     -H "Content-Type: application/json" \\
     -d '{"restaurant_id": 7, "items": [{"id": 3, "qty": 2}]}'

# change one field, then remove
curl -X PATCH  https://api.eats.example/orders/9001 -d '{"note": "no onions"}'
curl -X DELETE https://api.eats.example/orders/9001`,
        highlight: [2, 3, 6, 11, 12],
      },
    },
    {
      title: 'Three trips',
      tag: 'case',
      heading: 'Case: the home screen over REST',
      eli5: 'The family wants soup, bread and juice. The waiter walks to the kitchen three times, and each time brings back a whole tray when they only wanted one thing from it.',
      body: [
        'The home screen calls `GET /users/42`, then the orders, then the recommendations. Needing more calls for one screen is **under-fetching**. At 120 ms each, three calls in sequence take **360 ms**.',
        'Each response is the whole resource: 40 user fields when the screen shows 2. That is **over-fetching**. 42 KB arrives and about 3 KB is used. REST patches such as `?fields=` work, but each is a custom rule.',
      ],
      keyIdea: 'Resource-shaped responses rarely match screen-shaped needs: too many trips, and too many bytes in each.',
      metrics: { trips: '3', bytes: '42 KB (3 KB used)', time: '360 ms', style: 'REST' },
      metricTones: { trips: 'bad', bytes: 'bad', time: 'bad' },
      scene: {
        nodes: [
          { ...phone, status: 'hot', badge: '3 round trips' },
          { ...api, label: 'REST API', sub: 'nouns + verbs' },
          { ...users, chips: ['GET /users/42'] },
          { ...orders, chips: ['GET /orders?limit=5'] },
          { ...recs, chips: ['GET /recs?user=42'] },
        ],
        links: [link('phone', 'api', { label: '4G · 100 ms per round trip', labelTone: 'warn' }), ...fan()],
        flows: [
          { path: ['phone', 'api', 'users', 'api', 'phone'], tone: 'request', label: '1: user', duration: 1.8 },
          { path: ['phone', 'api', 'orders', 'api', 'phone'], tone: 'request', label: '2: orders', duration: 1.8, delay: 1.9 },
          { path: ['phone', 'api', 'recs', 'api', 'phone'], tone: 'request', label: '3: recs', duration: 1.8, delay: 3.8 },
        ],
        panel: {
          title: 'What each call returns',
          icon: 'Table',
          rows: [
            { text: 'GET /users/42', value: '40 fields', tone: 'warn' },
            { text: 'GET /orders', value: '5 full orders', tone: 'warn' },
            { text: 'GET /recs', value: '20 places', tone: 'warn' },
          ],
          footer: { text: '3 × 120 ms = 360 ms, 3 KB used of 42 KB', tone: 'bad' },
        },
        caption: 'Under-fetching and over-fetching together',
      },
    },
    {
      title: 'RPC',
      tag: 'concept',
      heading: 'RPC: call a function that happens to live elsewhere',
      eli5: 'With **RPC** you skip the menu and tell the cook what to do: "reheat this plate", "split the bill". You name the job, not the dish.',
      body: [
        'Some operations are actions, and forcing them into nouns gets awkward. Is cancelling an order a `DELETE`, a `PATCH`, or a new resource?',
        '**RPC** drops the pretense. The API is a list of functions: `cancelOrder(orderId, reason)`. The client calls one by name, usually as a `POST`.',
        'It reads like local code, which is the trap. A remote call can be slow, time out, or run while the reply gets lost.',
      ],
      keyIdea: 'RPC exposes verbs. It fits actions well, as long as you remember each call crosses a network.',
      metrics: { trips: '1 per call', bytes: 'args and result', time: '-', style: 'RPC' },
      scene: {
        nodes: [{ ...phone, chips: ['cancelOrder(9001)'] }, { ...api, label: 'RPC API', sub: 'verbs' }, { ...orders, status: 'active', chips: [{ text: 'refund: 18.50', tone: 'good' }] }],
        links: [link('phone', 'api'), link('api', 'orders')],
        flows: [
          { path: ['phone', 'api', 'orders'], tone: 'request', label: 'POST /orders.cancel', duration: 1.8 },
          { path: ['orders', 'api', 'phone'], tone: 'response', label: '{refund: 18.50}', duration: 1.8, delay: 1.9 },
        ],
        panel: {
          title: 'The API is a list of functions',
          icon: 'Braces',
          code: 'cancelOrder(orderId, reason)\nassignCourier(orderId)\nrecalcFare(tripId)',
          footer: { text: 'Each call still crosses a network', tone: 'warn' },
        },
        caption: 'A function name and its arguments',
      },
    },
    {
      title: 'gRPC',
      tag: 'concept',
      heading: 'gRPC: typed contracts and binary frames between services',
      eli5: 'In the kitchen, cooks pass each other short printed tickets from one shared pad. Everyone reads the same boxes on the ticket, so nothing is misheard and nothing is wasted.',
      body: [
        '**gRPC** is RPC built for service-to-service calls. A `.proto` file defines services and messages, and generated code gives both sides one typed contract.',
        'Messages use **Protocol Buffers**: number tags and values with no field names, several times smaller than JSON. It runs on **HTTP/2**, so calls share one connection and can **stream**.',
      ],
      keyIdea: 'gRPC is RPC with a schema, a binary encoding and streaming. It is the common choice inside the datacenter.',
      metrics: { trips: 'many per connection', bytes: 'binary, compact', time: '-', style: 'gRPC' },
      scene: {
        nodes: [{ ...api, label: 'gRPC gateway', sub: '1 HTTP/2 conn each', tint: 'green' }, { ...users, status: 'ok' }, { ...orders, status: 'ok', chips: ['TrackOrder (stream)'] }, { ...recs, status: 'ok' }],
        links: fan({ label: 'gRPC' }),
        flows: [
          { path: ['api', 'users'], tone: 'request', label: 'GetUser', duration: 0.9 },
          { path: ['users', 'api'], tone: 'response', label: 'protobuf', duration: 0.9, delay: 1 },
          { path: ['api', 'orders'], tone: 'request', label: 'TrackOrder', duration: 0.9 },
          { path: ['orders', 'api'], tone: 'data', label: 'location stream', count: 4, duration: 1.2, delay: 1 },
          { path: ['api', 'recs', 'api'], tone: 'request', duration: 1.6, delay: 0.3 },
        ],
        panel: {
          title: 'One Order message',
          icon: 'Binary',
          rows: [
            { text: 'As JSON', value: '47 bytes', tone: 'warn' },
            { text: 'As protobuf', value: '13 bytes', tone: 'good' },
          ],
          footer: { text: 'Field names stay off the wire', tone: 'good' },
        },
        caption: 'Small binary frames on shared connections',
      },
      code: {
        language: 'typescript',
        title: 'orders.proto (shown with TypeScript highlighting)',
        source: `syntax = "proto3";

service Orders {
  // one request, one reply
  rpc GetOrder (GetOrderRequest) returns (Order);
  // one request, a stream of replies until delivery
  rpc TrackOrder (TrackRequest) returns (stream CourierLocation);
}

message GetOrderRequest { int64 order_id = 1; }
message TrackRequest    { int64 order_id = 1; }

message Order {
  int64  id          = 1;   // the numbers are wire tags:
  string status      = 2;   // never reuse or renumber them
  int32  total_cents = 3;
}

message CourierLocation { double lat = 1; double lng = 2; }`,
        highlight: [5, 7, 14, 15],
      },
      quiz: {
        question: 'Why is a protobuf message usually smaller than the same data as JSON?',
        options: [
          'It is always gzip compressed',
          'It sends numeric field tags and binary values, with no field names or quotes',
          'It drops fields the client did not ask for',
          'It uses UDP, which has smaller headers',
        ],
        answer: 1,
        explain: 'Both sides already know the schema, so the wire carries only a small tag and the value for each field. JSON repeats every field name as text in every message.',
      },
    },
    {
      title: 'gRPC limits',
      tag: 'tradeoff',
      heading: 'Why gRPC stops at the edge',
      eli5: 'Kitchen tickets are great for cooks, but guests cannot read them. Guests still need the menu, and a waiter to translate.',
      body: [
        '**Browsers cannot speak it directly.** Web clients need a translating proxy. **It is hard to poke at**: you need the `.proto` file to make one test call.',
        '**Load balancing changes.** Calls share one long connection, so a layer 4 balancer pins them to one server. Use a layer 7 or client-side balancer.',
        'The usual split: REST or GraphQL at the public edge, gRPC between your own services.',
      ],
      keyIdea: 'gRPC is at its best when you own both the client and the server. At the public edge, plain HTTP and JSON reach further.',
      metrics: { trips: '-', bytes: '-', time: '-', style: 'REST edge, gRPC inside' },
      scene: {
        nodes: [{ ...phone, chips: ['GET /orders/9001'] }, { ...api, label: 'API', sub: 'translates', tint: 'green' }, { ...orders, chips: ['GetOrder'] }],
        links: [link('phone', 'api', { label: 'HTTPS + JSON', labelTone: 'good' }), link('api', 'orders', { label: 'gRPC' })],
        flows: [
          { path: ['phone', 'api'], tone: 'request', label: 'GET /orders/9001', duration: 1.2 },
          { path: ['api', 'orders'], tone: 'request', label: 'GetOrder', duration: 0.9, delay: 1.3 },
          { path: ['orders', 'api'], tone: 'response', duration: 0.9, delay: 2.3 },
          { path: ['api', 'phone'], tone: 'response', label: 'JSON', duration: 1.2, delay: 3.3 },
        ],
        panel: {
          title: 'Where gRPC struggles',
          icon: 'Plug',
          rows: [
            { text: 'Browser calls it directly', value: 'no', tone: 'bad' },
            { text: 'Test with curl', value: 'hard', tone: 'warn' },
            { text: 'Layer 4 balancer spreads calls', value: 'no', tone: 'bad' },
          ],
          footer: { text: 'REST at the edge, gRPC inside', tone: 'good' },
        },
        caption: 'The gateway translates between the two worlds',
      },
    },
    {
      title: 'GraphQL',
      tag: 'concept',
      heading: 'GraphQL: the client writes the shape of the answer',
      eli5: 'With **GraphQL** the family writes one slip: soup, a slice of bread, a small juice. The waiter makes one trip and brings back one tray with only those things.',
      body: [
        '**GraphQL** gives the server one endpoint and a typed **schema**. The client sends a **query** naming the exact fields it wants, nested as the screen needs them.',
        'The home screen sends one query. The server calls the three services and returns JSON in the same shape. One round trip instead of three, and 3 KB instead of 42 KB.',
      ],
      keyIdea: 'GraphQL lets each client fetch exactly its fields in one request, which fixes over-fetching and under-fetching.',
      metrics: { trips: '1', bytes: '3 KB', time: '150 ms', style: 'GraphQL' },
      metricTones: { trips: 'good', bytes: 'good', time: 'good' },
      scene: {
        nodes: [
          { ...phone, status: 'ok', badge: '1 round trip' },
          { ...api, label: 'GraphQL', sub: 'one endpoint', tint: 'teal', chips: ['POST /graphql'] },
          { ...users, chips: ['2 fields'] },
          { ...orders, chips: ['2 fields × 5'] },
          { ...recs, chips: ['2 fields × 10'] },
        ],
        links: [link('phone', 'api', { label: '4G · 1 round trip', labelTone: 'good' }), ...fan()],
        flows: [
          { path: ['phone', 'api'], tone: 'request', label: 'one query', duration: 1.2 },
          { path: ['api', 'users', 'api'], tone: 'request', duration: 1.4, delay: 1.3 },
          { path: ['api', 'orders', 'api'], tone: 'request', duration: 1.4, delay: 1.3 },
          { path: ['api', 'recs', 'api'], tone: 'request', duration: 1.4, delay: 1.3 },
          { path: ['api', 'phone'], tone: 'response', label: '3 KB, query-shaped', duration: 1.2, delay: 2.9 },
        ],
        panel: {
          title: 'One query for the screen',
          icon: 'Braces',
          code: 'query Home {\n  user(id: 42) { name avatarUrl }\n  orders(last: 5) { title total }\n  recommendations(first: 10) {\n    name rating\n  }\n}',
          footer: { text: '1 trip, 3 KB instead of 42 KB', tone: 'good' },
        },
        caption: 'The server fans out so the phone does not have to',
      },
      code: {
        language: 'typescript',
        title: 'The home screen in one GraphQL query',
        source: `const HOME_SCREEN = /* GraphQL */ \`
  query Home($id: ID!) {
    user(id: $id) {
      name
      avatarUrl
      orders(last: 5) {
        title
        totalCents
      }
    }
    recommendations(userId: $id, first: 10) {
      name
      rating
    }
  }
\`;

const res = await fetch("https://api.eats.example/graphql", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ query: HOME_SCREEN, variables: { id: "42" } }),
});
const { data, errors } = await res.json();   // errors arrive in the body`,
        highlight: [3, 6, 11, 19, 23],
      },
    },
    {
      title: 'GraphQL costs',
      tag: 'tradeoff',
      heading: 'The flexibility moves work to the server',
      eli5: 'One slip can also say "every dish, and every dish those cooks ever made". The kitchen needs a rule for slips that are too big, or one table can stall everyone.',
      body: [
        '**The N+1 problem.** 5 orders and each order\'s restaurant run 1 call plus 5 separate calls, unless a batching layer (DataLoader) collects the ids into one.',
        '**Caching is harder.** Every query is a `POST` to one URL. **Clients control the cost**: a deep query can ask for millions of rows, so limit depth and rate limit on total cost.',
      ],
      keyIdea: 'GraphQL saves the client trips and bytes. The server pays with batching, caching and query-cost controls it must build.',
      metrics: { trips: '1 (6 behind it)', bytes: '3 KB', time: '150 ms', style: 'GraphQL' },
      metricTones: { trips: 'warn', time: 'warn' },
      scene: {
        nodes: [phone, { ...api, label: 'GraphQL', sub: 'one endpoint', tint: 'teal', status: 'hot', load: 78, chips: [{ text: '1 + 5 calls', tone: 'bad' }] }, { ...orders, status: 'hot', load: 96 }],
        links: [link('phone', 'api', { label: 'orders { restaurant }' }), link('api', 'orders', { label: 'N+1', labelTone: 'bad' })],
        flows: [
          { path: ['phone', 'api'], tone: 'request', label: 'orders { restaurant }', duration: 1.2 },
          { path: ['api', 'orders'], tone: 'request', label: 'list orders', duration: 1, delay: 1.3 },
          { path: ['api', 'orders'], tone: 'error', label: 'restaurant × 5', count: 5, duration: 1.4, delay: 2.4 },
        ],
        panel: {
          title: 'Calls behind one query',
          icon: 'Database',
          rows: [
            { text: 'SELECT orders', value: '1 call' },
            { text: 'SELECT restaurant', value: '5 calls', tone: 'bad' },
            { text: 'With batching', value: '2 calls', tone: 'good' },
          ],
          footer: { text: 'A batching layer collects the ids', tone: 'good' },
        },
        caption: 'One innocent query, six backend calls',
      },
    },
    {
      title: 'Choosing',
      tag: 'tradeoff',
      heading: 'How to choose',
      eli5: 'Guests get the menu, cooks get kitchen tickets, and a table with a long, picky order gets to write one slip. A good restaurant uses all three in the right place.',
      body: [
        '**Public API for other developers:** REST. Everyone knows it, it caches well, and `curl` is enough.',
        '**Service to service:** gRPC. Typed contracts, small payloads, streaming. **Many screens over many backends:** GraphQL, once the team owns batching and query limits.',
        '**Action-heavy APIs:** plain RPC with JSON is fine. Mixing is normal.',
      ],
      keyIdea: 'Choose by who the caller is: strangers get REST, your own services get gRPC, many varied screens get GraphQL.',
      metrics: { trips: '1', bytes: '3 KB', time: '150 ms', style: 'mixed' },
      metricTones: { trips: 'good', bytes: 'good', time: 'good' },
      scene: {
        nodes: [{ ...phone, status: 'ok' }, { ...api, label: 'REST or GraphQL', sub: 'public edge', tint: 'teal', status: 'ok' }, { ...users, status: 'ok' }, { ...orders, status: 'ok' }, { ...recs, status: 'ok' }],
        links: [link('phone', 'api', { label: 'JSON over HTTPS' }), ...fan({ label: 'gRPC' })],
        flows: [
          { path: ['phone', 'api'], tone: 'request', duration: 1.1 },
          { path: ['api', 'users', 'api'], tone: 'request', duration: 1.3, delay: 1.2 },
          { path: ['api', 'orders', 'api'], tone: 'request', duration: 1.3, delay: 1.2 },
          { path: ['api', 'recs', 'api'], tone: 'request', duration: 1.3, delay: 1.2 },
          { path: ['api', 'phone'], tone: 'response', duration: 1.1, delay: 2.7 },
        ],
        panel: {
          title: 'Pick by caller',
          icon: 'Users',
          rows: [
            { text: 'Public developers', value: 'REST' },
            { text: 'Service to service', value: 'gRPC' },
            { text: 'Many screens, mobile', value: 'GraphQL' },
            { text: 'Action-heavy', value: 'RPC' },
          ],
        },
        caption: 'Text at the edge, binary inside',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Four styles, one question: who is calling?',
      eli5: 'The menu, the cook\'s orders, the kitchen tickets and the written slip are four ways to ask for food. Each fits a different person asking.',
      body: [
        '**REST** names resources and uses HTTP verbs. **RPC** calls functions and suits actions. **gRPC** adds a schema, binary messages and streaming for service calls.',
        '**GraphQL** lets the client name exact fields in one request, and asks the server to handle batching, caching and query cost. Every design later in this course starts by writing the API.',
      ],
      keyIdea: 'No style wins everywhere. Match the style to the caller and the shape of the data.',
      metrics: { trips: '3 → 1', bytes: '42 KB → 3 KB', time: '360 → 150 ms', style: 'mixed' },
      metricTones: { trips: 'good', bytes: 'good', time: 'good' },
      scene: {
        nodes: [{ ...phone, status: 'ok' }, { ...api, label: 'API', sub: 'gateway', status: 'ok' }, { ...orders, status: 'ok' }],
        links: [link('phone', 'api', { label: '4G · 1 round trip', labelTone: 'good' }), link('api', 'orders', { label: 'gRPC' })],
        flows: [
          { path: ['phone', 'api'], tone: 'request', duration: 1.1 },
          { path: ['api', 'orders', 'api'], tone: 'request', duration: 1.3, delay: 1.2 },
          { path: ['api', 'phone'], tone: 'response', duration: 1.1, delay: 2.7 },
        ],
        panel: {
          title: 'Home screen, before and after',
          icon: 'TrendingUp',
          rows: [
            { text: 'Round trips', value: '3 → 1', tone: 'good' },
            { text: 'Payload', value: '42 KB → 3 KB', tone: 'good' },
            { text: 'Screen load', value: '360 → 150 ms', tone: 'good' },
          ],
        },
      },
      quiz: {
        question: 'A mobile app has 30 screens, each needing a different mix of fields from 8 backend services, over slow networks. Which style fits the client-facing API best?',
        options: [
          'gRPC straight from the phone to each service',
          'REST with one endpoint per resource',
          'GraphQL in front of the services',
          'A separate RPC function per button',
        ],
        answer: 2,
        explain: 'Many screens with different field needs over a slow network is the case GraphQL was made for: one round trip, only the fields used. Per-resource REST would under-fetch and over-fetch, and the services can still talk gRPC behind the GraphQL server.',
      },
    },
  ],
};
