import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const browser: SceneNode = { id: 'browser', kind: 'client', at: at(-3.8, 0), label: 'browser', sub: 'your laptop' };
const wifi: SceneNode = { id: 'wifi', kind: 'internet', at: at(0, 0), label: 'cafe Wi-Fi', sub: 'shared network' };
const server: SceneNode = { id: 'server', kind: 'server', at: at(3.8, 0), label: 'web server', sub: 'shop.example' };
const dns: SceneNode = { id: 'dns', kind: 'dns', at: at(0, -3.8), label: 'DNS', sub: 'name to address' };
const sessions: SceneNode = { id: 'sessions', kind: 'cache', at: at(3.8, 6.6), label: 'session store' };
const evil: SceneNode = { id: 'evil', kind: 'block', size: 0.72, at: at(0, -5.6), label: 'bad page', sub: 'evil.example', icon: 'Bug', tint: 'red' };

const path = [link('browser', 'wifi'), link('wifi', 'server')];
const there = ['browser', 'wifi', 'server'];
const back = ['server', 'wifi', 'browser'];

export const httpTls: Lesson = {
  id: 'http-tls',
  title: 'HTTP, HTTPS and TLS (part 1)',
  tagline: 'The language browsers and servers speak: requests, responses, methods, cookies, caching and the three HTTP versions.',
  minutes: 14,
  level: 'Beginner',
  learn: [
    'The parts of a URL and what happens before the first request',
    'The parts of an HTTP request and response, and the status code families',
    'Methods, safe and idempotent requests, and how to retry a POST',
    'Headers, redirects and caching with ETag and 304',
    'How cookies give a stateless protocol a memory, and the flags that protect them',
    'Keep-alive, HTTP/2 and HTTP/3: how each one cuts connections and waiting',
  ],
  metrics: [
    { key: 'status', label: 'Last status', icon: 'Receipt' },
    { key: 'wire', label: 'On the wire', icon: 'Shield' },
    { key: 'setup', label: 'Setup wait', icon: 'Timer' },
    { key: 'conns', label: 'Connections', icon: 'Plug' },
  ],
  steps: [
    {
      title: 'Open postcard',
      tag: 'problem',
      heading: 'A connection is a pipe. Plain HTTP is a postcard anyone can read.',
      eli5: 'You hand the librarian a slip asking for a book. On the way it passes through a crowded hall, the **cafe Wi-Fi**, where anyone can read your slip and even change what it says.',
      body: [
        'TCP gives a browser and a server a reliable pipe of bytes. It does not say what the bytes mean. The shared language for "give me this page" and "here it is" is **HTTP**.',
        'You are in a cafe, logging in to `shop.example`. With plain HTTP, the Wi-Fi and every router after it can read your password, and could change the page on its way back.',
      ],
      keyIdea: 'HTTP defines what client and server say to each other. On its own it is readable and changeable at every hop.',
      metrics: { wire: 'plain text', setup: '50 ms (TCP)' },
      metricTones: { wire: 'bad' },
      scene: {
        nodes: [
          { ...browser, chips: ['POST /login'] },
          { ...wifi, status: 'hot', badge: 'reads: password=hunter2' },
          server,
        ],
        links: [link('browser', 'wifi'), link('wifi', 'server', { label: 'plain HTTP', labelTone: 'warn' })],
        flows: [
          { path: there, tone: 'request', label: 'POST /login password=hunter2', duration: 2.4 },
          { path: back, tone: 'response', duration: 2.4, delay: 2.6 },
        ],
        panel: {
          title: 'What the Wi-Fi can read',
          icon: 'Shield',
          rows: [
            { text: 'Method and path', value: 'POST /login' },
            { text: 'Host', value: 'shop.example' },
            { text: 'Body', value: 'password=hunter2', tone: 'bad' },
          ],
          footer: { text: 'Plain text at every hop', tone: 'bad' },
        },
        caption: 'Plain HTTP: readable at every hop',
      },
    },
    {
      title: 'URL',
      tag: 'concept',
      heading: 'From a URL to a connection',
      eli5: 'The slip has an address: which library, which shelf, which book. First you look the library up on the town board, the **DNS**, then you walk there.',
      body: [
        'A **URL** names what you want: `https://shop.example/products/42?color=blue`. The **scheme** picks the protocol, the **host** names the server, the **path** names the thing, and the **query** after `?` adds options.',
        'Before any HTTP, the browser asks **DNS** for the host\'s IP address. Then it opens a TCP connection to the **port**: 443 for HTTPS, 80 for plain HTTP.',
      ],
      keyIdea: 'A URL says which server and which thing. DNS and a TCP connection come first, then the request.',
      metrics: { setup: '50 ms (TCP)', conns: '1' },
      scene: {
        nodes: [{ ...browser, status: 'active' }, dns, { ...server, status: 'active' }],
        links: [link('browser', 'dns'), link('browser', 'server', { label: 'TCP, port 443' })],
        flows: [
          { path: ['browser', 'dns'], tone: 'request', label: 'shop.example?', duration: 1.2 },
          { path: ['dns', 'browser'], tone: 'response', label: '203.0.113.7', duration: 1.2, delay: 1.3 },
          { path: ['browser', 'server'], tone: 'handshake', label: 'connect', duration: 1.6, delay: 2.8 },
        ],
        panel: {
          title: 'https://shop.example/products/42?color=blue',
          icon: 'Globe',
          rows: [
            { text: 'Scheme', value: 'https' },
            { text: 'Host', value: 'shop.example' },
            { text: 'Port', value: '443 (default)' },
            { text: 'Path', value: '/products/42' },
            { text: 'Query', value: 'color=blue' },
          ],
        },
        caption: 'Look up the address, then connect',
      },
    },
    {
      title: 'Request',
      tag: 'concept',
      heading: 'Anatomy of an HTTP request',
      eli5: 'A library slip has three parts: what you want to do and with which book, a few extra notes, and sometimes a page you attach. An **HTTP request** from the browser has the same three parts.',
      body: [
        'An HTTP request is a short, structured message. The first line holds a **method** (what to do), a **path** (which thing) and the protocol version: `GET /products/42 HTTP/1.1`.',
        'Then come **headers**, one `Name: value` per line. After a blank line comes an optional **body**. A `GET` has none. A login form or a new order puts its data in the body.',
      ],
      keyIdea: 'A request is method + path, then headers, then an optional body.',
      metrics: { status: '200 OK', wire: 'plain text', setup: '50 ms (TCP)' },
      scene: {
        nodes: [{ ...browser, status: 'active', chips: ['GET /products/42'] }, { ...wifi, status: 'dim' }, { ...server, status: 'active' }],
        links: path,
        flows: [
          { path: there, tone: 'request', label: 'GET /products/42', duration: 2 },
          { path: back, tone: 'response', label: '200 OK + JSON', duration: 2, delay: 2.2 },
        ],
        panel: {
          title: 'A request, line by line',
          icon: 'FileText',
          rows: [
            { text: 'Line 1', value: 'method, path, version' },
            { text: 'Headers', value: 'Name: value, one per line' },
            { text: 'Blank line', value: 'ends the headers' },
            { text: 'Body', value: 'optional' },
          ],
          footer: { text: 'HTTP/1.1 is readable text', tone: 'muted' },
        },
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
      title: 'Response',
      tag: 'concept',
      heading: 'The response mirrors the request',
      eli5: 'The librarian hands back the book with a cover note on top. The note says how it went and what is inside. The **web server** writes that note on every answer.',
      body: [
        'A **response** has the same shape: a status line, headers, a blank line, then the body. The status line holds the version, a three-digit **status code** and a short reason: `HTTP/1.1 200 OK`.',
        'The headers describe the body (`Content-Type`, `Content-Length`). The body is the page, the JSON or the image itself.',
      ],
      keyIdea: 'A response is status line, headers, then a body. The status code is the first thing a client reads.',
      metrics: { status: '200 OK', wire: 'plain text', setup: '50 ms (TCP)' },
      metricTones: { status: 'good' },
      scene: {
        nodes: [browser, { ...wifi, status: 'dim' }, { ...server, status: 'active', chips: [{ text: '200 OK', tone: 'good' }] }],
        links: path,
        flows: [
          { path: there, tone: 'request', label: 'GET /products/42', duration: 1.8 },
          { path: back, tone: 'response', label: '200 OK + JSON', duration: 1.8, delay: 2 },
        ],
        panel: {
          title: 'A response, as sent',
          icon: 'FileJson',
          code: 'HTTP/1.1 200 OK\nContent-Type: application/json\nContent-Length: 61\n\n{"id": 42, "name": "Blue kettle"}',
          footer: { text: 'Status line, headers, blank line, body', tone: 'muted' },
        },
        caption: 'The verdict comes first',
      },
    },
    {
      title: 'Status codes',
      tag: 'concept',
      heading: 'The first digit of the status code tells you whose problem it is',
      eli5: 'The librarian stamps every slip before handing it back. A green stamp means "here you go". An orange one means "you asked wrong". A red one means "our fault". The stamp is the **status code**.',
      body: [
        '`2xx` worked: `200 OK`, `201 Created`. `3xx` look elsewhere. `4xx` means the client got it wrong: `400` bad request, `401` not logged in, `403` not allowed, `404` not found, `429` too many requests.',
        '`5xx` means the server failed: `500` crash, `503` overloaded, `502` and `504` when a server in front got no good answer from one behind it. Repeating a `4xx` request fails again. A `5xx` may work on the next try.',
      ],
      keyIdea: '2xx worked, 3xx go elsewhere, 4xx the client got it wrong, 5xx the server broke. Only 5xx is worth retrying unchanged.',
      metrics: { status: '404 Not Found', wire: 'plain text', setup: '50 ms (TCP)' },
      metricTones: { status: 'warn' },
      scene: {
        nodes: [browser, { ...wifi, status: 'dim' }, { ...server, status: 'active', badge: '404: no such product' }],
        links: path,
        flows: [
          { path: there, tone: 'request', label: 'GET /products/999999', duration: 2 },
          { path: back, tone: 'error', label: '404 Not Found', duration: 2, delay: 2.2 },
        ],
        panel: {
          title: 'Status families',
          icon: 'Receipt',
          rows: [
            { text: '2xx', value: 'it worked', tone: 'good' },
            { text: '3xx', value: 'look elsewhere' },
            { text: '4xx', value: 'your mistake, do not retry', tone: 'warn' },
            { text: '5xx', value: 'our fault, may retry', tone: 'bad' },
          ],
        },
        caption: 'The first digit tells you whose problem it is',
      },
    },
    {
      title: 'Redirects',
      tag: 'concept',
      heading: 'A 3xx points you to a new address',
      eli5: 'The librarian says "that book moved to the other room" and writes the new place on a note. You walk over and ask again. The **redirect** note is that new place.',
      body: [
        'A `3xx` response carries a `Location` header with the new URL, and the browser follows it on its own. `301` and `308` are permanent, so browsers and search engines remember them. `302` and `307` are temporary.',
        '`307` and `308` keep the method, so a `POST` stays a `POST`. Each redirect costs a full round trip, and the browser gives up after about 20 hops to stop loops.',
      ],
      keyIdea: 'A redirect is a response saying "ask over there". It costs one extra round trip, so avoid chains.',
      metrics: { status: '301 Moved', wire: 'plain text', setup: '50 ms (TCP)' },
      metricTones: { status: 'warn' },
      scene: {
        nodes: [{ ...browser, status: 'active' }, { ...wifi, status: 'dim' }, { ...server, status: 'active', chips: [{ text: '301 Moved', tone: 'warn' }] }],
        links: path,
        flows: [
          { path: there, tone: 'request', label: 'GET /cart (old URL)', duration: 1.6 },
          { path: back, tone: 'error', label: '301 + Location', duration: 1.6, delay: 1.7 },
          { path: there, tone: 'request', label: 'GET /basket (new URL)', duration: 1.6, delay: 3.4 },
        ],
        panel: {
          title: 'The redirect response',
          icon: 'Route',
          code: 'HTTP/1.1 301 Moved Permanently\nLocation: https://shop.example/basket',
          footer: { text: 'One extra round trip per hop', tone: 'warn' },
        },
        caption: 'The browser follows the Location header',
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
      ],
      keyIdea: 'GET reads and is safe to repeat. PUT and DELETE are safe to retry. POST is neither.',
      metrics: { status: '200 OK', wire: 'plain text', setup: '50 ms (TCP)' },
      scene: {
        nodes: [{ ...browser, status: 'active', chips: ['DELETE /cart/items/7'] }, { ...wifi, status: 'dim' }, { ...server, status: 'active', badge: 'item 7 gone' }],
        links: path,
        flows: [
          { path: there, tone: 'request', label: 'DELETE /cart/items/7', duration: 1.8 },
          { path: back, tone: 'response', label: '204 No Content', duration: 1.8, delay: 2 },
        ],
        panel: {
          title: 'Safe and idempotent',
          icon: 'Repeat',
          rows: [
            { text: 'GET', value: 'safe, idempotent', tone: 'good' },
            { text: 'PUT', value: 'idempotent', tone: 'good' },
            { text: 'DELETE', value: 'idempotent', tone: 'good' },
            { text: 'PATCH', value: 'depends on the change', tone: 'warn' },
            { text: 'POST', value: 'neither', tone: 'bad' },
          ],
        },
        caption: 'Twice has the same result as once',
      },
    },
    {
      title: 'Safe retries',
      tag: 'tradeoff',
      heading: 'A lost response makes POST dangerous to repeat',
      eli5: 'You hand in a slip to order a new book, and the librarian\'s answer gets lost in the hall. Ask again and she might order a second copy. A secret number on the slip tells her "this is the same order".',
      body: [
        'The browser sends `POST /orders`, the network stalls and no response arrives. Was the order placed? Sending it again might buy two kettles. Retries, payments and queues all have to deal with this.',
        'The fix is an **idempotency key**: the client adds a unique `Idempotency-Key` header, and the server stores the result under that key. A repeat with the same key gets the first result back, not a second order.',
      ],
      keyIdea: 'A repeated POST may do the action twice. A unique key per action lets the server spot the repeat.',
      metrics: { status: '201 Created', wire: 'plain text', setup: '50 ms (TCP)' },
      metricTones: { status: 'warn' },
      scene: {
        nodes: [{ ...browser, status: 'active', chips: [{ text: 'no reply yet', tone: 'warn' }] }, { ...wifi, status: 'dim' }, { ...server, badge: 'order 1 created' }],
        links: [link('browser', 'wifi', { label: 'response lost', labelTone: 'warn' }), link('wifi', 'server')],
        flows: [
          { path: there, tone: 'request', label: 'POST /orders', duration: 2 },
          { path: ['server', 'wifi'], tone: 'error', label: '201 lost on the way', duration: 1, delay: 2.2 },
          { path: there, tone: 'request', label: 'retry: POST /orders ?', duration: 2, delay: 3.6 },
        ],
        panel: {
          title: 'Retry with an idempotency key',
          icon: 'Key',
          code: 'POST /orders\nIdempotency-Key: 7c1e-9a42\n\n1st try: creates order 1\n2nd try: same key, returns order 1',
          footer: { text: 'The server remembers the key', tone: 'good' },
        },
        caption: 'The response is lost. Is it safe to send again?',
      },
      quiz: {
        question: 'A request times out and you do not know whether the server handled it. Which of these is risky to resend as is?',
        options: ['GET /products/42', 'PUT /cart/items/7 with quantity 2', 'DELETE /cart/items/7', 'POST /orders'],
        answer: 3,
        explain: 'GET changes nothing. PUT and DELETE are idempotent, so a second copy leaves the same result. POST /orders creates a new order each time it is handled, so a blind retry can place the order twice unless the request carries an idempotency key.',
      },
    },
    {
      title: 'Headers',
      tag: 'concept',
      heading: 'Headers carry the fine print',
      eli5: 'Extra notes on the slip say things like "large print please" or "I am a member". **Headers** are those notes. The browser writes some and the web server writes some back.',
      body: [
        'Headers are `Name: value` lines that describe a message. On requests: `Host` names the site, so one server can host many. `Authorization` carries a login token. `Accept` and `Accept-Encoding` list the formats and compression the client understands.',
        'On responses: `Content-Type` says what the body is (`text/html`, `application/json`). `Content-Length` says how many bytes. With `Accept-Encoding: gzip` text shrinks a lot on the wire.',
      ],
      keyIdea: 'Headers are name and value pairs that describe the message: who it is for, what format it is in, and how it is packed.',
      metrics: { status: '200 OK', wire: 'plain text', setup: '50 ms (TCP)' },
      scene: {
        nodes: [{ ...browser, chips: ['Accept: text/html'] }, { ...wifi, status: 'dim' }, { ...server, status: 'active', chips: ['Content-Type: text/html'] }],
        links: path,
        flows: [
          { path: there, tone: 'request', label: 'Host: shop.example', duration: 2 },
          { path: back, tone: 'response', label: 'Content-Type: text/html', duration: 2, delay: 2.2 },
        ],
        panel: {
          title: 'Headers you will meet most',
          icon: 'List',
          rows: [
            { text: 'Host', value: 'which site' },
            { text: 'Authorization', value: 'login token' },
            { text: 'Accept-Encoding', value: 'gzip, br' },
            { text: 'Content-Type', value: 'what the body is' },
            { text: 'Content-Length', value: 'body size in bytes' },
            { text: 'Location', value: 'redirect target' },
          ],
        },
        caption: 'Notes in both directions',
      },
    },
    {
      title: 'Caching',
      tag: 'concept',
      heading: 'Cache headers let a client skip the download',
      eli5: 'You keep a copy of a popular book at home. Before the next visit you ask the librarian "has it changed?". She says "no, keep yours", and nothing is carried across the hall.',
      body: [
        '`Cache-Control: max-age=60` lets the browser and any cache reuse a response for 60 seconds with no request at all. `no-store` forbids saving it. `no-cache` still saves it but revalidates before every reuse.',
        'After that the browser asks again with the saved `ETag` in `If-None-Match`. If nothing changed, the server answers `304 Not Modified` with no body: a few hundred bytes instead of the whole page. `Last-Modified` with `If-Modified-Since` is the date-based alternative to ETag.',
      ],
      keyIdea: 'Cache-Control says how long a copy is fresh. An ETag lets a stale copy be re-checked for the price of a tiny 304.',
      metrics: { status: '304 Not Modified', wire: 'plain text', setup: '50 ms (TCP)' },
      metricTones: { status: 'good' },
      scene: {
        nodes: [{ ...browser, status: 'active', badge: 'saved copy: ETag "v7"' }, { ...wifi, status: 'dim' }, { ...server, status: 'ok' }],
        links: path,
        flows: [
          { path: there, tone: 'request', label: 'GET + If-None-Match: "v7"', duration: 2 },
          { path: back, tone: 'response', label: '304, no body', duration: 2, delay: 2.2 },
        ],
        panel: {
          title: 'What the browser does',
          icon: 'Clock',
          rows: [
            { text: 'Under 60 s old', value: 'no request', tone: 'good' },
            { text: 'Stale, unchanged', value: '304, no body', tone: 'good' },
            { text: 'Stale, changed', value: '200 + new body', tone: 'warn' },
            { text: 'no-store', value: 'never saved' },
            { text: 'no-cache', value: 'always revalidate first', tone: 'warn' },
            { text: 'private / public', value: 'browser only / CDNs too' },
          ],
        },
        caption: 'Ask "has it changed?", not "send it again"',
      },
    },
    {
      title: 'Cookies',
      tag: 'concept',
      heading: 'HTTP forgets you. Cookies remind it.',
      eli5: 'The librarian does not remember faces. So you get a library card, and you show it with every slip. A **cookie** is that card. The web server looks the number up in its **session store**.',
      body: [
        'HTTP is **stateless**. Each request stands alone, and the server does not remember that the last one came from you. So how do you stay logged in?',
        'At login the server creates a session, stores it, and answers with a `Set-Cookie` header holding a random session id. The browser saves that **cookie** and attaches it to every later request to the site. The server looks up the id and knows who you are.',
      ],
      keyIdea: 'A cookie is a small value the server hands the browser, which the browser sends back on every request. It turns separate requests into a session.',
      metrics: { status: '200 OK', wire: 'encrypted', setup: '100 ms (TCP + TLS)' },
      scene: {
        nodes: [{ ...browser, chips: ['Cookie: session=8f3a91c2'] }, { ...wifi, status: 'dim' }, { ...server, status: 'active' }, { ...sessions, status: 'active', badge: '8f3a91c2 = Maya' }],
        links: [link('browser', 'wifi'), link('wifi', 'server', { label: 'HTTPS' }), link('server', 'sessions')],
        flows: [
          { path: there, tone: 'request', label: 'GET /cart + Cookie', duration: 1.8 },
          { path: ['server', 'sessions'], tone: 'request', label: 'who is 8f3a91c2?', duration: 0.9, delay: 1.9 },
          { path: ['sessions', 'server'], tone: 'response', label: 'Maya', duration: 0.9, delay: 2.9 },
          { path: back, tone: 'response', label: "Maya's cart", duration: 1.8, delay: 3.9 },
        ],
        panel: {
          title: 'Who holds what',
          icon: 'KeyRound',
          rows: [
            { text: 'Browser keeps', value: 'session=8f3a91c2' },
            { text: 'Session store keeps', value: '8f3a91c2 = Maya' },
          ],
          footer: { text: 'The server keeps the data, the browser keeps the key', tone: 'muted' },
        },
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
      title: 'Cookie flags',
      tag: 'concept',
      heading: 'A session cookie is a key, so it gets locks',
      eli5: 'Your library card opens your account, so it gets rules. It cannot be read by strangers, it only goes out in the secret code, and it works only when you hand it over yourself.',
      body: [
        '`HttpOnly` hides the cookie from page scripts, so a script injected into the page cannot steal it. `Secure` sends it only over HTTPS. `SameSite=Lax` blocks CSRF: other sites cannot send it on POSTs, images or fetches. It is still sent when you click a link to the site.',
        '`Max-Age=86400` ends the session after a day. Anyone who steals the id can act as you until then, which is why these flags exist.',
      ],
      keyIdea: 'Set HttpOnly, Secure and SameSite on every session cookie, and give it a limited lifetime.',
      metrics: { status: '200 OK', wire: 'encrypted', setup: '100 ms (TCP + TLS)' },
      scene: {
        nodes: [{ ...browser, chips: ['Cookie: session=8f3a91c2'] }, { ...wifi, status: 'dim' }, { ...server, status: 'active' }, evil],
        links: [link('browser', 'wifi'), link('wifi', 'server', { label: 'HTTPS' }), link('evil', 'browser', { label: 'script on a bad page', labelTone: 'warn' })],
        flows: [
          { path: there, tone: 'request', label: 'GET /cart + Cookie', duration: 1.8 },
          { path: ['evil', 'browser'], tone: 'error', label: 'read document.cookie', duration: 1.4, delay: 2.2 },
        ],
        panel: {
          title: 'Cookie flags',
          icon: 'Shield',
          rows: [
            { text: 'HttpOnly', value: 'hidden from scripts', tone: 'good' },
            { text: 'Secure', value: 'HTTPS only', tone: 'good' },
            { text: 'SameSite=Lax', value: 'not sent on cross-site POSTs, images or fetches', tone: 'good' },
            { text: 'Max-Age=86400', value: 'expires in a day', tone: 'good' },
          ],
        },
        caption: 'The bad page gets nothing',
      },
    },
    {
      title: 'Keep-alive',
      tag: 'concept',
      heading: 'HTTP/1.1 reuses a connection, one request at a time',
      eli5: 'Standing in the queue again for every slip is slow. So you stay at the desk: that is **keep-alive**. But the librarian still handles only one slip at a time per desk.',
      body: [
        'A product page needs about 30 files. A new connection for each pays the setup cost 30 times. **HTTP/1.1** keeps the connection open after a response (**keep-alive**) and reuses it.',
        'Each connection still handles one request at a time, so a slow file blocks the ones behind it. Browsers open about six connections per site and queue the rest.',
      ],
      keyIdea: 'Keep-alive saves the setup cost. HTTP/1.1 still serves one request at a time per connection, so browsers open about six.',
      metrics: { status: '200 OK', wire: 'plain text', setup: '50 ms (TCP)', conns: '6' },
      metricTones: { conns: 'warn' },
      scene: {
        nodes: [{ ...browser, status: 'active', badge: '30 files to fetch' }, { ...wifi, status: 'dim' }, { ...server, status: 'active', badge: '6 connections' }],
        links: [link('browser', 'wifi', { label: '1 request at a time', labelTone: 'warn' }), link('wifi', 'server')],
        flows: [
          { path: there, tone: 'request', label: 'file 1 to 6', count: 3, duration: 1.8 },
          { path: back, tone: 'response', count: 3, duration: 1.8, delay: 1.4 },
        ],
        panel: {
          title: '30 files, 50 ms per round trip',
          icon: 'Timer',
          rows: [
            { text: 'New connection per file', value: '5 x 100 ms = 500 ms', tone: 'bad' },
            { text: 'Keep-alive, 6 connections', value: '50 + 5 x 50 = 300 ms', tone: 'warn' },
          ],
          footer: { text: 'Ignores transfer time', tone: 'muted' },
        },
        caption: 'Open connections get reused, but each is single file',
      },
    },
    {
      title: 'HTTP/2',
      tag: 'concept',
      heading: 'HTTP/2 shares one connection among many requests',
      eli5: 'The librarian takes a whole stack of slips at once and works on them together, so one slow book does not hold up the rest. One desk, one queue, many slips.',
      body: [
        '**HTTP/2** sends many requests over one connection at the same time, as interleaved **streams**. It packs messages as binary frames and compresses repeated headers (**HPACK**). 30 files, one connection, all in flight together.',
        'It still rides on TCP, which delivers bytes in order. One lost packet stalls every stream until it is resent. Browsers use HTTP/2 only over TLS (covered in part 2), so setup is TCP plus TLS.',
      ],
      keyIdea: 'HTTP/2 multiplexes many streams on one connection. A lost TCP packet still stalls all of them.',
      metrics: { status: '200 OK', wire: 'encrypted', setup: '100 ms (TCP + TLS)', conns: '1' },
      metricTones: { conns: 'good' },
      scene: {
        nodes: [{ ...browser, status: 'active', badge: '30 files to fetch' }, { ...wifi, status: 'dim' }, { ...server, status: 'active', badge: '1 connection, many streams' }],
        links: [link('browser', 'wifi', { label: 'HTTP/2, 30 streams' }), link('wifi', 'server')],
        flows: [
          { path: there, tone: 'request', label: 'page, css, js, images', count: 5, duration: 1.8 },
          { path: back, tone: 'response', count: 5, duration: 1.8, delay: 1.4 },
        ],
        panel: {
          title: 'HTTP/2 at a glance',
          icon: 'Layers',
          rows: [
            { text: 'Connections', value: '1', tone: 'good' },
            { text: 'Requests in flight', value: '30 at once', tone: 'good' },
            { text: 'Headers', value: 'compressed (HPACK)', tone: 'good' },
            { text: 'One lost packet', value: 'stalls every stream', tone: 'bad' },
          ],
        },
        caption: 'HTTP/2: many requests share one connection',
      },
    },
    {
      title: 'HTTP/3',
      tag: 'concept',
      heading: 'HTTP/3 moves to QUIC so one loss stays local',
      eli5: 'Now every slip has its own little tray. If one tray drops on the floor, only that slip waits, and the librarian keeps working through the others.',
      body: [
        '**HTTP/3** replaces TCP with **QUIC**, built on UDP, which recovers lost packets per stream. A loss delays only its own file. QUIC carries TLS 1.3 inside it, so a new connection needs one round trip, not two.',
        'A QUIC connection survives a switch from Wi-Fi to mobile data. Browsers learn about it from an `Alt-Svc` header and fall back to TCP if UDP is blocked. Methods, status codes and headers stay the same in all three versions.',
      ],
      keyIdea: 'HTTP/3 keeps HTTP/2\'s streams and fixes TCP\'s blocking by using QUIC over UDP. Only the carrier changed.',
      metrics: { status: '200 OK', wire: 'encrypted', setup: '50 ms (QUIC + TLS)', conns: '1' },
      metricTones: { setup: 'good', conns: 'good' },
      scene: {
        nodes: [{ ...browser, status: 'active' }, { ...wifi, status: 'dim' }, { ...server, status: 'ok', badge: 'Alt-Svc: h3' }],
        links: [link('browser', 'wifi', { label: 'QUIC over UDP' }), link('wifi', 'server')],
        flows: [
          { path: there, tone: 'request', label: 'streams a, b, c', count: 3, duration: 1.8 },
          { path: back, tone: 'response', count: 3, duration: 1.8, delay: 1.4 },
        ],
        panel: {
          title: 'Three versions, one language',
          icon: 'Network',
          rows: [
            { text: 'HTTP/1.1', value: 'TCP, 6 connections' },
            { text: 'HTTP/2', value: 'TCP, 1 connection' },
            { text: 'HTTP/3', value: 'QUIC, 1 connection', tone: 'good' },
          ],
          footer: { text: 'Same methods, status codes and headers', tone: 'muted' },
        },
        caption: 'A lost packet delays only its own stream',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'A simple conversation, still readable by the whole cafe',
      eli5: 'You fill in a slip, the librarian stamps it and hands back a book. You show your card each time and keep the desk. But the **cafe Wi-Fi** hall can still read every slip, which part 2 fixes.',
      body: [
        'A **request** is a method, a path, headers and an optional body. A **response** is a status code, headers and a body. `GET` is safe, `PUT` and `DELETE` can be retried, `POST` needs an idempotency key. `4xx` blames the client, `5xx` the server.',
        '**Cookies** carry a session id on a stateless protocol. Cache headers skip downloads. Keep-alive, HTTP/2 and HTTP/3 cut connections and waiting. Part 2 adds **TLS**.',
      ],
      keyIdea: 'HTTP is the conversation: verbs, status families, headers, cookies and caching. It is still plain text until TLS wraps it.',
      metrics: { status: '200 OK', wire: 'plain text', setup: '50 ms (TCP)', conns: '1' },
      metricTones: { wire: 'bad' },
      scene: {
        nodes: [browser, { ...wifi, status: 'hot', badge: 'still reads it all' }, { ...server, status: 'ok' }],
        links: path,
        flows: [
          { path: there, tone: 'request', label: 'GET /cart + Cookie', count: 2, duration: 2 },
          { path: back, tone: 'response', label: '200 OK', count: 2, duration: 2, delay: 2.2 },
        ],
        panel: {
          title: 'Part 1 in five lines',
          icon: 'List',
          rows: [
            { text: 'Request', value: 'method, path, headers, body' },
            { text: 'Response', value: 'status, headers, body' },
            { text: 'Retry', value: 'GET, PUT, DELETE yes. POST with a key' },
            { text: 'Memory', value: 'cookies and caches' },
            { text: 'Speed', value: 'keep-alive, HTTP/2, HTTP/3' },
          ],
          footer: { text: 'Next: lock the tunnel with TLS', tone: 'warn' },
        },
        caption: 'HTTP works. It is not private yet.',
      },
      quiz: {
        question: 'GET /products/42 returns `503 Service Unavailable`, and GET /admin returns `403 Forbidden`. Which one is worth retrying unchanged?',
        options: ['Both', 'Only the 503', 'Only the 403', 'Neither'],
        answer: 1,
        explain: '503 is a 5xx: the server is overloaded or down, and a later try may succeed. 403 is a 4xx: the server understood the request and refused it, so repeating it unchanged gets the same answer.',
      },
    },
  ],
};
