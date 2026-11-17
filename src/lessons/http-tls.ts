import type { Lesson, SceneNode } from '../engine/types';

const browser: SceneNode = { id: 'browser', kind: 'client', at: [-3, 3], label: 'browser' };
const wifi: SceneNode = { id: 'wifi', kind: 'internet', at: [-1.9, 0.9], label: 'cafe Wi-Fi', sub: 'shared network' };
const server: SceneNode = { id: 'server', kind: 'server', at: [0.2, -0.2], label: 'web server', sub: 'shop.example' };
const ca: SceneNode = { id: 'ca', kind: 'service', at: [0.8, -2.8], label: 'CA', sub: 'signs certificates' };
const sessions: SceneNode = { id: 'sessions', kind: 'cache', at: [2.3, -1.3], label: 'session store' };

const pathLinks = [
  { from: 'browser', to: 'wifi' },
  { from: 'wifi', to: 'server' },
];

export const httpTls: Lesson = {
  id: 'http-tls',
  title: 'HTTP, HTTPS and TLS',
  tagline: 'The language browsers and servers speak, and the lock that keeps everyone else from reading it.',
  minutes: 14,
  level: 'Beginner',
  learn: [
    'The parts of an HTTP request and response',
    'Methods, status codes and the headers you will meet most',
    'How cookies give a stateless protocol a memory',
    'Keep-alive, HTTP/2 and HTTP/3 in brief',
    'What the TLS handshake and certificates protect, and how reuse makes them cheap',
  ],
  metrics: [
    { key: 'status', label: 'Last status' },
    { key: 'wire', label: 'On the wire' },
    { key: 'setup', label: 'Setup wait' },
    { key: 'conns', label: 'Connections' },
  ],
  steps: [
    {
      title: 'Open postcard',
      tag: 'problem',
      heading: 'A connection is a pipe. What goes through it, and who can read it?',
      eli5: 'You hand the librarian a slip asking for a book. On the way it passes through a crowded hall, the **cafe Wi-Fi**, where anyone can read your slip and even change what it says.',
      body: [
        'The last lesson ended with a TCP connection: a reliable pipe of bytes between a browser and a server. TCP does not say what the bytes mean. Both sides need a shared language for "give me this page" and "here it is". That language is **HTTP**.',
        'There is a second problem. You are in a cafe, logging in to `shop.example`. Your packets pass through the cafe\'s Wi-Fi and a dozen routers. With plain HTTP, every one of them can read your password as text, and could change the page on its way back.',
        'This lesson covers both halves: the HTTP conversation itself, and **TLS**, the layer that encrypts it. HTTP inside TLS is what the `https://` in an address means.',
      ],
      keyIdea: 'HTTP defines what client and server say to each other. TLS makes sure nobody in between can read or change it.',
      metrics: { wire: 'plain text', setup: '50 ms (TCP)' },
      scene: {
        nodes: [browser, { ...wifi, status: 'hot', badge: 'reads: password=hunter2' }, server],
        links: pathLinks,
        flows: [
          { path: ['browser', 'wifi', 'server'], tone: 'request', label: 'POST /login password=hunter2', duration: 2.4 },
          { path: ['server', 'wifi', 'browser'], tone: 'response', duration: 2.4, delay: 2.6 },
        ],
        caption: 'Plain HTTP: readable at every hop',
      },
    },
    {
      title: 'Request',
      tag: 'concept',
      heading: 'Anatomy of an HTTP request',
      eli5: 'A library slip has three parts: what you want to do and with which book, a few extra notes, and sometimes a page you attach. An **HTTP request** from the browser has the same three parts.',
      body: [
        'An HTTP request is a short, structured message. The first line holds a **method** (what to do), a **path** (which thing) and the protocol version: `GET /products/42 HTTP/1.1`.',
        'Then come **headers**, one `Name: value` pair per line. They carry extra information: which site the request is for (`Host`), what formats the client accepts, who the user is.',
        'After a blank line comes an optional **body**. A `GET` has none. A request that sends data, such as a login form or a new order, puts that data in the body. In HTTP/1.1 all of this is readable text, which makes it easy to learn by looking at it.',
      ],
      keyIdea: 'A request is method + path, then headers, then an optional body.',
      metrics: { status: '200 OK', wire: 'plain text', setup: '50 ms (TCP)' },
      scene: {
        nodes: [{ ...browser, status: 'active' }, { ...wifi, status: 'dim' }, { ...server, status: 'active' }],
        links: pathLinks,
        flows: [
          { path: ['browser', 'wifi', 'server'], tone: 'request', label: 'GET /products/42', duration: 2 },
          { path: ['server', 'wifi', 'browser'], tone: 'response', label: '200 OK + JSON', duration: 2, delay: 2.2 },
        ],
        caption: 'One request, one response',
      },
      code: {
        language: 'bash',
        title: 'Watch a real exchange (lines with > are sent, < are received)',
        source: `$ curl -v --http1.1 https://shop.example/products/42
> GET /products/42 HTTP/1.1
> Host: shop.example
> User-Agent: curl/8.5.0
> Accept: */*
>
< HTTP/1.1 200 OK
< Content-Type: application/json
< Content-Length: 61
< Cache-Control: max-age=60
<
{"id": 42, "name": "Blue kettle", "price": 34.00, "stock": 7}`,
        highlight: [2, 3, 7, 8],
      },
    },
    {
      title: 'Status codes',
      tag: 'concept',
      heading: 'The response starts with a three-digit verdict',
      eli5: 'The librarian stamps every slip before handing it back. A green stamp means "here you go". An orange one means "you asked wrong". A red one means "our fault". The stamp is the **status code**.',
      body: [
        'A response mirrors a request: a status line, headers, a blank line, a body. The status line carries a **status code**, and its first digit tells you the outcome.',
        '`2xx` means success: `200 OK`, `201 Created`. `3xx` means look elsewhere: `301 Moved Permanently` points to a new address, `304 Not Modified` says your saved copy is still good. `4xx` means the client made a mistake: `400` bad request, `401` not logged in, `403` not allowed, `404` not found, `429` too many requests.',
        '`5xx` means the server failed: `500` for a crash, `502` and `504` when a server in front could not get an answer from one behind it, `503` when it is overloaded. The split matters for retries. Sending the same `4xx` request again fails again. A `5xx` may work on the next try.',
      ],
      keyIdea: '2xx worked, 3xx go elsewhere, 4xx the client got it wrong, 5xx the server broke. Only 5xx is worth retrying unchanged.',
      metrics: { status: '404 Not Found', wire: 'plain text', setup: '50 ms (TCP)' },
      scene: {
        nodes: [browser, { ...wifi, status: 'dim' }, { ...server, status: 'active', badge: '404: no such product' }],
        links: pathLinks,
        flows: [
          { path: ['browser', 'wifi', 'server'], tone: 'request', label: 'GET /products/999999', duration: 2 },
          { path: ['server', 'wifi', 'browser'], tone: 'error', label: '404 Not Found', duration: 2, delay: 2.2 },
        ],
        caption: 'The first digit tells you whose problem it is',
      },
    },
    {
      title: 'Methods',
      tag: 'concept',
      heading: 'Methods say what you want done',
      eli5: 'On the slip you tick one box: look at a book, add a new book, replace a book, or remove a book. That tick is the **method**, and it tells the web server what kind of job this is.',
      body: [
        'The **method** is the verb of a request. `GET` reads something. `POST` creates something or triggers an action. `PUT` replaces a thing at a known address. `PATCH` changes part of it. `DELETE` removes it.',
        '`GET` is **safe**: it should never change data, so browsers, caches and crawlers feel free to repeat it. `PUT` and `DELETE` are **idempotent**: doing them twice leaves the same result as doing them once. Deleting cart item 7 twice still leaves it deleted.',
        '`POST` is neither. Suppose the browser sends `POST /orders`, the network stalls and no response arrives. Was the order placed? Sending it again might buy two kettles. This one fact drives a lot of later design: retries, payment systems and message queues all have to deal with it.',
      ],
      keyIdea: 'GET reads and is safe to repeat. PUT and DELETE are safe to retry. A repeated POST may do the action twice.',
      metrics: { status: '201 Created', wire: 'plain text', setup: '50 ms (TCP)' },
      scene: {
        nodes: [{ ...browser, status: 'active' }, { ...wifi, status: 'dim' }, { ...server, badge: 'order 1 created' }],
        links: pathLinks,
        flows: [
          { path: ['browser', 'wifi', 'server'], tone: 'request', label: 'POST /orders', duration: 2 },
          { path: ['server', 'wifi'], tone: 'error', label: '201 lost on the way', duration: 1, delay: 2.2 },
          { path: ['browser', 'wifi', 'server'], tone: 'request', label: 'retry: POST /orders ?', duration: 2, delay: 3.6 },
        ],
        caption: 'The response is lost. Is it safe to send again?',
      },
      quiz: {
        question: 'A request times out and you do not know whether the server handled it. Which of these is risky to resend as is?',
        options: ['GET /products/42', 'PUT /cart/items/7 with quantity 2', 'DELETE /cart/items/7', 'POST /orders'],
        answer: 3,
        explain: 'GET changes nothing. PUT and DELETE are idempotent, so a second copy leaves the same result. POST /orders creates a new order each time it is handled, so a blind retry can place the order twice.',
      },
    },
    {
      title: 'Headers',
      tag: 'concept',
      heading: 'Headers carry the fine print',
      eli5: 'Extra notes on the slip say things like "large print please" or "I am a member". **Headers** are those notes. The browser writes some and the web server writes some back.',
      body: [
        'Headers are where most of the useful detail lives. A few you will see in almost every lesson from here on.',
        'On requests: `Host` names the site, so one server can host many. `Authorization` carries a login token. `Accept` and `Accept-Encoding` say which formats and compression the client understands. `User-Agent` says what kind of client it is.',
        'On responses: `Content-Type` says what the body is (`text/html`, `application/json`, `image/png`). `Content-Length` says how many bytes. `Cache-Control: max-age=60` says anyone may reuse this response for 60 seconds, which is what caches and CDNs obey. `Location` gives the new address in a redirect.',
      ],
      keyIdea: 'Headers are name and value pairs that describe the message: who it is for, what format it is in, and how long it may be reused.',
      metrics: { status: '200 OK', wire: 'plain text', setup: '50 ms (TCP)' },
      scene: {
        nodes: [{ ...browser, badge: 'Accept: text/html' }, { ...wifi, status: 'dim' }, { ...server, status: 'active', badge: 'Cache-Control: max-age=60' }],
        links: pathLinks,
        flows: [
          { path: ['browser', 'wifi', 'server'], tone: 'request', label: 'Host: shop.example', duration: 2 },
          { path: ['server', 'wifi', 'browser'], tone: 'response', label: 'Content-Type: text/html', duration: 2, delay: 2.2 },
        ],
        caption: 'Notes in both directions',
      },
    },
    {
      title: 'Cookies',
      tag: 'concept',
      heading: 'HTTP forgets you. Cookies remind it.',
      eli5: 'The librarian does not remember faces. So you get a library card, and you show it with every slip. A **cookie** is that card. The web server looks the number up in its **session store**.',
      body: [
        'HTTP is **stateless**. Each request stands alone, and the server does not remember that the last one came from you. That keeps servers simple, and it raises a question: how do you stay logged in?',
        'When you log in, the server creates a session, stores it, and answers with a `Set-Cookie` header holding a random session id. The browser saves that **cookie** and attaches it to every later request to the same site in a `Cookie` header. The server looks up the id and knows who you are.',
        'The cookie is the key to your account, so it gets protection flags. `HttpOnly` hides it from page scripts. `Secure` sends it only over HTTPS. `SameSite` stops other sites from making requests that carry it.',
      ],
      keyIdea: 'A cookie is a small value the server hands the browser, which the browser sends back on every request. It turns separate requests into a session.',
      metrics: { status: '200 OK', wire: 'plain text', setup: '50 ms (TCP)' },
      scene: {
        nodes: [{ ...browser, badge: 'cookie: session=8f3a91c2' }, { ...wifi, status: 'dim' }, { ...server, status: 'active' }, { ...sessions, status: 'active', badge: '8f3a91c2 = Maya' }],
        links: [...pathLinks, { from: 'server', to: 'sessions' }],
        flows: [
          { path: ['browser', 'wifi', 'server'], tone: 'request', label: 'GET /cart + Cookie', duration: 1.8 },
          { path: ['server', 'sessions'], tone: 'request', label: 'who is 8f3a91c2?', duration: 0.9, delay: 1.9 },
          { path: ['sessions', 'server'], tone: 'response', label: 'Maya', duration: 0.9, delay: 2.9 },
          { path: ['server', 'wifi', 'browser'], tone: 'response', label: "Maya's cart", duration: 1.8, delay: 3.9 },
        ],
        caption: 'The cookie travels with every request',
      },
      code: {
        language: 'bash',
        title: 'A session cookie being set, then sent back',
        source: `# 1. Response to the login: the server hands out a session id
< HTTP/1.1 200 OK
< Set-Cookie: session=8f3a91c2; HttpOnly; Secure; SameSite=Lax; Max-Age=86400

# 2. Every later request: the browser attaches it without being asked
> GET /cart HTTP/1.1
> Host: shop.example
> Cookie: session=8f3a91c2`,
        highlight: [3, 8],
      },
    },
    {
      title: 'HTTP versions',
      tag: 'concept',
      heading: 'Keep-alive, HTTP/2 and HTTP/3',
      eli5: 'Queuing again for every slip is slow, so you stay at the desk: that is **keep-alive**. Better still, the librarian takes a whole stack of slips at once and works on them together.',
      body: [
        'A product page needs about 30 files: HTML, styles, scripts, images. Opening a new connection for each would pay the setup cost 30 times. **HTTP/1.1** keeps the connection open after a response (**keep-alive**) and reuses it. Still, each connection handles one request at a time, so browsers open about six per site and queue the rest.',
        '**HTTP/2** sends many requests over one connection at the same time, as interleaved **streams**, and compresses the repetitive headers. One connection, 30 files in flight together. It still rides on TCP, so one lost packet stalls every stream until it is resent.',
        '**HTTP/3** replaces TCP with **QUIC**, a protocol built on UDP that does its own reliability per stream. A lost packet delays only the file it belongs to, and connection setup takes fewer round trips. Methods, status codes and headers are the same in all three versions. Only the way they are packed and carried changes.',
      ],
      keyIdea: 'Reuse connections. HTTP/1.1 keeps them open, HTTP/2 shares one among many requests, HTTP/3 does the same over UDP so one lost packet does not block the rest.',
      metrics: { status: '200 OK', wire: 'plain text', setup: '50 ms (TCP)', conns: '6, then 1 on HTTP/2' },
      scene: {
        nodes: [{ ...browser, status: 'active', badge: '30 files to fetch' }, { ...wifi, status: 'dim' }, { ...server, status: 'active', badge: '1 connection, many streams' }],
        links: pathLinks,
        flows: [
          { path: ['browser', 'wifi', 'server'], tone: 'request', label: 'page, css, js, images', count: 5, duration: 1.8 },
          { path: ['server', 'wifi', 'browser'], tone: 'response', count: 5, duration: 1.8, delay: 1.4 },
        ],
        caption: 'HTTP/2: many requests share one connection',
      },
    },
    {
      title: 'TLS handshake',
      tag: 'concept',
      heading: 'TLS: agree on a secret key before saying anything private',
      eli5: 'You and the librarian whisper a secret code that only you two know. Now slips written in that code can cross the noisy hall, the **cafe Wi-Fi**, and nobody there can read them.',
      body: [
        '**TLS** (Transport Layer Security) wraps the connection so that only the two ends can read it. It gives three guarantees: **privacy** (nobody can read the bytes), **integrity** (nobody can change them unnoticed) and **identity** (the server is who it claims to be).',
        'In TLS 1.3 the browser opens with a `ClientHello`: the encryption methods it supports plus half of a key exchange. The server answers with its half, its **certificate**, and a signature proving it owns that certificate. From the two halves, both sides compute the same secret key. The key itself never crosses the network, so the Wi-Fi sees the exchange and still cannot work it out.',
        'That takes **one round trip** on top of the TCP handshake. At 50 ms per round trip, a new HTTPS connection waits 100 ms before the first request leaves. From then on, an observer sees which server you talk to and how much data moves, and nothing of the paths, headers, cookies or bodies.',
      ],
      keyIdea: 'TLS costs one extra round trip and buys privacy, integrity and proof of identity. HTTPS is plain HTTP sent through that tunnel.',
      metrics: { status: '200 OK', wire: 'encrypted', setup: '100 ms (TCP + TLS)', conns: '1' },
      scene: {
        nodes: [{ ...browser, status: 'active' }, { ...wifi, badge: 'sees: x9$kQ2!f...' }, { ...server, status: 'active' }],
        links: pathLinks,
        flows: [
          { path: ['browser', 'wifi', 'server'], tone: 'handshake', label: 'ClientHello + key share', duration: 1.6 },
          { path: ['server', 'wifi', 'browser'], tone: 'handshake', label: 'ServerHello + certificate', duration: 1.6, delay: 1.8 },
          { path: ['browser', 'wifi', 'server'], tone: 'request', label: 'encrypted request', duration: 1.6, delay: 3.6 },
          { path: ['server', 'wifi', 'browser'], tone: 'response', label: 'encrypted response', duration: 1.6, delay: 5.4 },
        ],
        caption: 'One round trip, then everything is sealed',
      },
    },
    {
      title: 'Certificates',
      tag: 'concept',
      heading: 'Certificates prove who you are talking to',
      eli5: 'Anyone can stand behind a desk and say "I am the librarian". The real one wears a badge signed by the town hall. The **certificate** is the badge, and the **CA** is the town hall that signs it.',
      body: [
        'Encryption alone is not enough. If an attacker on the Wi-Fi answers in place of the real server, you would have a perfectly private conversation with the attacker. The **certificate** closes that gap.',
        'A certificate is a small file that says "this public key belongs to `shop.example`", with a start date, an end date and a signature from a **certificate authority** (CA). Browsers and operating systems ship with a list of CAs they trust. The browser checks three things: the name matches the site, today is within the dates, and the signature leads back to a trusted CA.',
        'If any check fails, the browser shows a full-page warning and most users leave. The classic outage is boring: a certificate expires because nobody renewed it, and a healthy site becomes unreachable. Automate renewal and alert on the expiry date.',
      ],
      keyIdea: 'A certificate binds a domain name to a key and is signed by an authority the browser already trusts. An expired one takes the site down as surely as a crash.',
      metrics: { status: '200 OK', wire: 'encrypted', setup: '100 ms (TCP + TLS)', conns: '1' },
      scene: {
        nodes: [{ ...browser, status: 'active', badge: 'name, dates, signature: ok' }, wifi, { ...server, status: 'ok', badge: 'cert: shop.example' }, { ...ca, status: 'active' }],
        links: [...pathLinks, { from: 'ca', to: 'server', style: 'dashed', label: 'signed in advance' }],
        flows: [
          { path: ['ca', 'server'], tone: 'data', label: 'signed certificate', duration: 1.4 },
          { path: ['server', 'wifi', 'browser'], tone: 'handshake', label: 'certificate', duration: 2, delay: 1.6 },
          { path: ['browser', 'wifi', 'server'], tone: 'request', label: 'trusted, go on', duration: 2, delay: 3.8 },
        ],
        caption: 'The browser checks the badge before it talks',
      },
      code: {
        language: 'bash',
        title: 'Read the certificate a site presents',
        source: `$ openssl s_client -connect shop.example:443 -servername shop.example \\
    </dev/null 2>/dev/null | openssl x509 -noout -subject -issuer -dates

subject=CN = shop.example
issuer=C = US, O = Example Trust, CN = Example Trust CA 1
notBefore=Oct  1 00:00:00 2026 GMT
notAfter=Dec 30 23:59:59 2026 GMT`,
        highlight: [4, 5, 7],
      },
    },
    {
      title: 'Reuse',
      tag: 'tradeoff',
      heading: 'Making the handshake cheap: reuse and resumption',
      eli5: 'The first visit takes a while: hello, badge check, secret code. If you stay at the desk, you never repeat it. If you come back tomorrow, the web server gives you a ticket so the hello is much shorter.',
      body: [
        'A full handshake costs round trips and CPU for the signature checks. Three kinds of reuse cut that cost. The best is **connection reuse**: keep-alive and HTTP/2 hold the connection open, so the second request pays no setup at all.',
        'When a connection has closed, **session resumption** helps. After the first handshake the server hands the browser a **session ticket**. On the next connection the browser presents it, and both sides skip the certificate exchange and its signature checks. In TLS 1.3 that still takes one round trip, with far less work.',
        'TLS 1.3 also allows **0-RTT**: the browser sends its first request along with the ticket, with no waiting. The catch is that an attacker can record that first packet and send it again. So 0-RTT is only safe for requests that are harmless to repeat, such as a `GET`. Speed against safety, again.',
      ],
      keyIdea: 'Pay for the full handshake once. Reuse the connection when you can, resume the session when you cannot, and keep 0-RTT for requests that are safe to replay.',
      metrics: { status: '200 OK', wire: 'encrypted', setup: '0 ms (reused)', conns: '1' },
      scene: {
        nodes: [{ ...browser, status: 'active', badge: 'has session ticket' }, wifi, { ...server, status: 'ok', badge: 'skips certificate step' }],
        links: pathLinks,
        flows: [
          { path: ['browser', 'wifi', 'server'], tone: 'handshake', label: 'hello + ticket', duration: 1.6 },
          { path: ['server', 'wifi', 'browser'], tone: 'handshake', label: 'resumed', duration: 1.6, delay: 1.8 },
          { path: ['browser', 'wifi', 'server'], tone: 'request', label: 'encrypted request', count: 3, duration: 1.6, delay: 3.6 },
        ],
        caption: 'A returning browser skips most of the hello',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'A simple conversation inside a locked tunnel',
      eli5: 'You fill in a slip, the librarian stamps it and hands back a book. You show your card each time, you both speak in a secret code, and the badge proves the **web server** is the real librarian.',
      body: [
        'An HTTP **request** is a method, a path, headers and an optional body. The **response** is a status code, headers and a body. `GET` is safe, `PUT` and `DELETE` can be retried, `POST` can do its work twice. `4xx` blames the client and `5xx` blames the server.',
        'HTTP is stateless, and **cookies** carry a session id so the server knows you. Keep-alive, HTTP/2 and HTTP/3 are three steps toward the same goal: fewer connections and less waiting.',
        '**TLS** adds one round trip to agree on a key, and a **certificate** signed by a trusted CA proves the server\'s identity. Reused connections and resumed sessions bring the setup cost from 100 ms down to nearly nothing.',
      ],
      keyIdea: 'HTTP is the conversation, TLS is the envelope. Know the verbs, the status families and the cost of a new connection.',
      metrics: { status: '200 OK', wire: 'encrypted', setup: '0 ms (reused)', conns: '1' },
      scene: {
        nodes: [browser, { ...wifi, badge: 'sees only noise' }, { ...server, status: 'ok' }],
        links: pathLinks,
        flows: [
          { path: ['browser', 'wifi', 'server'], tone: 'request', label: 'GET /cart', count: 2, duration: 2 },
          { path: ['server', 'wifi', 'browser'], tone: 'response', label: '200 OK', count: 2, duration: 2, delay: 2.2 },
        ],
        caption: 'HTTPS: same conversation, sealed',
      },
      quiz: {
        question: 'A site is up and its servers are healthy, but every visitor suddenly gets a full-page browser security warning. What is the most likely cause?',
        options: [
          'The server is returning 404 for the home page',
          'The TLS certificate expired or does not match the domain name',
          'The browser ran out of connections',
          'HTTP/2 was turned off',
        ],
        answer: 1,
        explain: 'The warning appears during the TLS handshake, before any HTTP request is sent. The browser rejected the certificate: it is past its end date, names a different domain, or is not signed by a trusted CA. A 404 would show a normal error page with no warning.',
      },
    },
  ],
};
