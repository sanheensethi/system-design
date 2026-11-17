import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const user: SceneNode = { id: 'user', kind: 'user', at: at(-8.5, -1), label: 'you' };
const client: SceneNode = { id: 'client', kind: 'client', at: at(-4.5, -1), label: 'browser', sub: 'shop.example' };
const dns: SceneNode = { id: 'dns', kind: 'dns', at: at(-1.5, -1), label: 'DNS resolver', sub: '8.8.8.8' };
const edge: SceneNode = { id: 'edge', kind: 'block', at: at(-1.5, -1), label: 'front door', sub: 'CDN + load balancer', icon: 'Router', tint: 'violet' };
const server: SceneNode = { id: 'server', kind: 'server', at: at(1.5, -1), label: 'web server', sub: '203.0.113.10' };
const db: SceneNode = { id: 'db', kind: 'db', at: at(4.5, -1), label: 'database' };
const bcache: SceneNode = { id: 'bcache', kind: 'cache', at: at(-1.5, 3.5), label: 'browser cache', sub: 'on your disk' };

export const requestLifecycle: Lesson = {
  id: 'request-lifecycle',
  title: 'How a request travels',
  tagline: 'Follow one page load hop by hop and find out where the time goes.',
  minutes: 15,
  level: 'Beginner',
  learn: [
    'What is in a URL and why the browser checks its own cache first',
    'What DNS does, how a lookup walks a chain, and why answers are cached',
    'Why opening a connection costs round trips (TCP, TLS) and how reuse avoids them',
    'The path: browser, front door, server, database, and back',
    'Status codes, compression and how one page becomes forty requests',
    'How to measure where page-load time goes, and two classic slowdowns: a slow query and a distant user',
  ],
  metrics: [
    { key: 'dns', label: 'DNS', icon: 'Search' },
    { key: 'connect', label: 'Connect', icon: 'Plug' },
    { key: 'server', label: 'Server', icon: 'Server' },
    { key: 'download', label: 'Download', icon: 'Download' },
    { key: 'total', label: 'Total', icon: 'Timer' },
  ],
  steps: [
    {
      title: 'Hit Enter',
      tag: 'problem',
      heading: 'Users say the shop feels slow',
      eli5: 'A **request** is like a letter you mail to a faraway toy shop asking for its catalog. Your browser is the mail carrier, and every trip it makes takes a little time.',
      body: [
        'Before you can make anything faster you need to know where the time goes. So we will follow one page load from start to finish.',
        'You type `shop.example` and press Enter. About 150 milliseconds later the page is on screen. A surprising amount happens in between, and every piece of it costs time.',
      ],
      keyIdea: 'Every web request is a conversation between machines. Each exchange costs time, and the costs add up.',
      metrics: { dns: '?', connect: '?', server: '?', download: '?', total: '150 ms' },
      scene: {
        nodes: [user, { ...client, badge: 'loading…', chips: ['shop.example'] }],
        links: [link('user', 'client', { label: 'press Enter' })],
        flows: [{ path: ['user', 'client'], tone: 'request', label: 'shop.example', duration: 1.4 }],
        panel: {
          title: 'The goal',
          icon: 'Timer',
          rows: [
            { text: 'Page on screen', value: '~150 ms', tone: 'good' },
            { text: 'Steps in between', value: 'a dozen' },
            { text: 'Each step', value: 'costs time', tone: 'warn' },
          ],
          footer: { text: 'Where does the time go?', tone: 'muted' },
        },
        caption: 'One page load, start to finish',
      },
    },
    {
      title: 'The URL',
      tag: 'concept',
      heading: 'A URL says how, where and what',
      eli5: 'The address on the letter has three parts: how to send it, which shop, and which catalog page. The browser reads the address before it does anything else.',
      body: [
        'The browser first splits the **URL** into parts. The scheme (`https`) says which protocol to speak, the host (`shop.example`) says which machine, and the path (`/products`) says which page.',
        'Only the host is a name that needs looking up. The path and query string are not used until the request reaches the server.',
      ],
      keyIdea: 'A URL is three answers: which protocol, which machine, which resource. Only the host decides where the packets go.',
      metrics: { total: '0 ms' },
      scene: {
        nodes: [user, { ...client, status: 'active', chips: ['https://shop.example/products'] }],
        links: [link('user', 'client')],
        panel: {
          title: 'https://shop.example/products?page=2',
          icon: 'Globe',
          rows: [
            { text: 'scheme', value: 'https (use TLS)' },
            { text: 'host', value: 'shop.example (look up)', tone: 'good' },
            { text: 'port', value: '443 (default for https)' },
            { text: 'path', value: '/products (server uses)' },
            { text: 'query', value: 'page=2 (server uses)' },
          ],
        },
        caption: 'The browser parses the address first',
      },
    },
    {
      title: 'Browser cache',
      tag: 'concept',
      heading: 'The fastest request is the one never sent',
      eli5: 'Before mailing anything, you check your own shelf. If last week\'s catalog is still there and still fresh, you read it and skip the mail carrier entirely.',
      body: [
        'Before touching the network the browser checks its own **cache**. A response that says `Cache-Control: max-age=3600` may be reused for an hour with no request at all.',
        'On a hit the page costs about **0 ms** of network time. Everything in the rest of this lesson is what happens on a miss.',
      ],
      keyIdea: 'A cache hit skips every hop. All the later steps describe the cost of a miss.',
      metrics: { dns: '0 ms', connect: '0 ms', server: '0 ms', download: '0 ms', total: '0 ms' },
      metricTones: { total: 'good' },
      scene: {
        nodes: [
          { ...client, chips: ['GET /logo.png'] },
          { ...bcache, status: 'ok', badge: 'hit · 0 ms' },
          { ...server, status: 'dim' },
        ],
        links: [link('client', 'bcache', { arrow: 'both' }), link('client', 'server', { style: 'faint' })],
        flows: [
          { path: ['client', 'bcache'], tone: 'request', label: 'have it?', duration: 1 },
          { path: ['bcache', 'client'], tone: 'response', label: 'yes, fresh', duration: 1, delay: 1.1 },
        ],
        panel: {
          title: 'Cache-Control on a response',
          icon: 'Clock',
          code: 'Cache-Control: max-age=3600\n\nage 10 min  -> reuse, no request\nage 90 min  -> stale, ask server',
          footer: { text: 'A hit costs 0 ms of network', tone: 'good' },
        },
      },
    },
    {
      title: 'Find address',
      tag: 'concept',
      heading: 'DNS turns a name into an address',
      eli5: '**DNS** is the post office address book. The browser asks it where shop.example lives, then keeps the answer on a sticky note so it does not have to ask again for a while.',
      body: [
        'Computers route traffic by IP address, not by name. If the browser and OS do not already know the address, the browser asks a **DNS resolver**: "what is the address for shop.example?"',
        'The resolver had the answer cached, so this lookup took 20 ms. It comes back with the answer `203.0.113.10`.',
      ],
      keyIdea: 'DNS is the phone book of the internet. No address, no connection.',
      metrics: { dns: '20 ms', total: '20 ms' },
      metricTones: { dns: 'warn' },
      scene: {
        nodes: [user, client, { ...dns, status: 'active', badge: '203.0.113.10' }],
        links: [link('client', 'dns', { style: 'dashed', label: 'UDP · port 53' })],
        flows: [
          { path: ['client', 'dns'], tone: 'request', label: 'A? shop.example', duration: 1.2 },
          { path: ['dns', 'client'], tone: 'response', label: '203.0.113.10', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'The answer',
          icon: 'Search',
          rows: [
            { text: 'shop.example', value: '203.0.113.10' },
            { text: 'Lookup time', value: '20 ms', tone: 'warn' },
          ],
        },
        caption: 'Name in, address out',
      },
    },
    {
      title: 'DNS chain',
      tag: 'concept',
      heading: 'A cold lookup walks a chain of servers',
      eli5: 'The address book clerk may not know the shop, so the clerk asks the head office, then the street office, then the shop\'s own desk, and finally writes the answer down.',
      body: [
        'If the resolver has no answer cached, it asks the **root** servers who handles `.example`, then the `.example` servers who handles `shop.example`, then the domain\'s own **authoritative** name server for the address.',
        'That chain is why a cold lookup is the slowest one. Each link in it is a separate round trip, so this one takes about 80 ms instead of 20.',
      ],
      keyIdea: 'A cold lookup walks root, then top-level domain, then authoritative server. Only the final one holds the real answer.',
      metrics: { dns: '80 ms', total: '80 ms' },
      metricTones: { dns: 'warn' },
      scene: {
        nodes: [
          client,
          { ...dns, status: 'active' },
          { id: 'root', kind: 'block', size: 0.72, at: at(1, -4.5), label: 'root', sub: 'who has .example?', icon: 'Globe', tint: 'gray' },
          { id: 'tld', kind: 'block', size: 0.72, at: at(3.5, -1), label: '.example', sub: 'who has shop?', icon: 'Network', tint: 'amber' },
          { id: 'auth', kind: 'block', size: 0.72, at: at(6, 2.5), label: 'shop.example', sub: 'authoritative', icon: 'Server', tint: 'green' },
        ],
        links: [
          link('client', 'dns', { style: 'dashed' }),
          link('dns', 'root', { style: 'dashed' }),
          link('dns', 'tld', { style: 'dashed' }),
          link('dns', 'auth', { style: 'dashed' }),
        ],
        flows: [
          { path: ['dns', 'root', 'dns'], tone: 'request', label: '1', duration: 1.2 },
          { path: ['dns', 'tld', 'dns'], tone: 'request', label: '2', duration: 1.2, delay: 1.3 },
          { path: ['dns', 'auth', 'dns'], tone: 'response', label: '3: 203.0.113.10', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'Cold lookup',
          icon: 'List',
          rows: [
            { text: 'root', value: 'ask .example' },
            { text: '.example', value: 'ask shop.example' },
            { text: 'authoritative', value: 'the address', tone: 'good' },
          ],
        },
      },
    },
    {
      title: 'TTL',
      tag: 'concept',
      heading: 'TTL decides how long an answer is remembered',
      eli5: 'The clerk writes the answer on a sticky note with a "good for 5 minutes" stamp. Until the stamp runs out, nobody has to walk the chain again.',
      body: [
        'Every DNS answer carries a **TTL**, a time-to-live in seconds. The browser, the OS and the resolver each cache the answer until it expires.',
        'A repeat visit within the TTL costs nothing. A short TTL lets you move servers fast. A long TTL makes lookups cheaper.',
      ],
      keyIdea: 'DNS is cache-friendly. The first lookup is slow, repeats are almost free, and TTL decides how long "almost free" lasts.',
      metrics: { dns: '0 ms', total: '0 ms' },
      metricTones: { dns: 'good' },
      scene: {
        nodes: [
          client,
          { id: 'os', kind: 'block', size: 0.72, at: at(-1.5, -1), label: 'OS cache', sub: 'on your laptop', icon: 'Laptop', tint: 'blue' },
          { ...dns, at: at(1.5, -1), status: 'ok', badge: 'cached · 0 ms' },
        ],
        links: [link('client', 'os', { arrow: 'both' }), link('os', 'dns', { style: 'dashed' })],
        flows: [
          { path: ['client', 'os'], tone: 'request', label: 'A? shop.example', duration: 1 },
          { path: ['os', 'client'], tone: 'response', label: '203.0.113.10', duration: 1, delay: 1.1 },
        ],
        panel: {
          title: 'Who caches the answer',
          icon: 'Clock',
          rows: [
            { text: 'Browser', value: 'up to TTL' },
            { text: 'Operating system', value: 'up to TTL' },
            { text: 'Resolver', value: 'up to TTL' },
            { text: 'TTL = 300 s', value: 'repeat: 0 ms', tone: 'good' },
          ],
          footer: { text: 'Short TTL: fast moves. Long TTL: cheap lookups', tone: 'muted' },
        },
      },
    },
    {
      title: 'TCP',
      tag: 'concept',
      heading: 'TCP opens a connection with one round trip',
      eli5: 'Before the real letter goes out, the browser mails the web server a quick hello and waits for a hello back. That trip there and back is a **round trip**.',
      body: [
        'With the address in hand the browser opens a **TCP** connection: SYN, SYN-ACK, ACK. That is one full **round trip** (RTT) before a single byte of your page can move.',
        'At 30 ms per round trip, TCP alone costs 30 ms. TCP also numbers and re-sends lost packets, so the page arrives complete and in order. UDP skips that, which is why DNS and QUIC use it.',
      ],
      keyIdea: 'Latency is counted in round trips. A new TCP connection costs one before any data moves.',
      metrics: { dns: '20 ms', connect: '30 ms', total: '50 ms' },
      scene: {
        nodes: [client, { ...server, status: 'active' }],
        links: [link('client', 'server', { label: '30 ms per round trip', labelTone: 'warn', arrow: 'both' })],
        flows: [
          { path: ['client', 'server'], tone: 'handshake', label: 'SYN', duration: 1 },
          { path: ['server', 'client'], tone: 'handshake', label: 'SYN-ACK', duration: 1, delay: 1.05 },
          { path: ['client', 'server'], tone: 'handshake', label: 'ACK', duration: 1, delay: 2.1 },
        ],
        panel: {
          title: 'Three-way handshake',
          icon: 'Repeat',
          rows: [
            { text: 'client to server', value: 'SYN' },
            { text: 'server to client', value: 'SYN-ACK' },
            { text: 'client to server', value: 'ACK' },
            { text: 'Cost', value: '1 round trip', tone: 'warn' },
          ],
        },
      },
    },
    {
      title: 'TLS',
      tag: 'concept',
      heading: 'HTTPS adds one more round trip for encryption',
      eli5: 'Now the two agree on a secret code word so nobody carrying the mail can read it. Agreeing takes one more hello and hello back.',
      body: [
        '**HTTPS** adds a **TLS handshake**: the server proves its identity with a certificate and both sides agree on encryption keys. With TLS 1.3 that is one more round trip.',
        'At 30 ms per round trip we have now spent 60 ms just saying hello, and not a byte of the page has moved.',
      ],
      keyIdea: 'TCP plus TLS 1.3 is two round trips. Anything that removes a round trip (reuse, TLS 1.3, HTTP/3) makes everything faster.',
      metrics: { dns: '20 ms', connect: '60 ms', total: '80 ms' },
      metricTones: { connect: 'warn' },
      scene: {
        nodes: [client, { ...server, status: 'active', badge: 'certificate' }],
        links: [link('client', 'server', { label: '30 ms per round trip', labelTone: 'warn', arrow: 'both' })],
        flows: [
          { path: ['client', 'server'], tone: 'handshake', label: 'ClientHello + key', duration: 1 },
          { path: ['server', 'client'], tone: 'handshake', label: 'certificate + Finished', duration: 1, delay: 1.05 },
        ],
        panel: {
          title: 'Time spent saying hello',
          icon: 'Shield',
          rows: [
            { text: 'TCP handshake', value: '30 ms' },
            { text: 'TLS 1.3 handshake', value: '30 ms' },
            { text: 'Page bytes moved', value: '0', tone: 'bad' },
          ],
          footer: { text: '60 ms of hello', tone: 'warn' },
        },
      },
      code: {
        language: 'bash',
        title: 'Measure each phase yourself',
        source: `curl -o /dev/null -s -w '
dns:        %{time_namelookup}s
tcp:        %{time_connect}s
tls:        %{time_appconnect}s
first byte: %{time_starttransfer}s
total:      %{time_total}s
' https://example.com`,
        highlight: [3, 4],
      },
      quiz: {
        question: 'A user is 30 ms from your server. How long do TCP plus a TLS 1.3 handshake take before the first request can be sent?',
        options: ['About 15 ms', 'About 30 ms', 'About 60 ms', 'About 150 ms'],
        answer: 2,
        explain: 'TCP is one round trip and TLS 1.3 is one more. Two round trips at 30 ms each is 60 ms.',
      },
    },
    {
      title: 'Reuse',
      tag: 'concept',
      heading: 'Keep the connection open and reuse it',
      eli5: 'After the hellos, the mail route stays open. Every later letter rides the same route with no new hellos.',
      body: [
        'Paying 60 ms of handshakes for every request would be ruinous, so browsers keep connections open (**keep-alive**) and reuse them. The second request on the same connection skips all of it.',
        'HTTP/2 lets many requests share one connection at once. HTTP/3 runs over QUIC on UDP and folds the transport and TLS handshakes together.',
      ],
      keyIdea: 'Handshakes are a one-time cost per connection. Reuse turns 60 ms into 0 ms for every later request.',
      metrics: { dns: '0 ms', connect: '0 ms', total: '15 ms' },
      metricTones: { connect: 'good' },
      scene: {
        nodes: [{ ...client, chips: ['GET /app.css', 'GET /app.js'] }, { ...server, status: 'ok', badge: 'connection open' }],
        links: [link('client', 'server', { label: 'already open: 0 ms', arrow: 'both' })],
        flows: [
          { path: ['client', 'server'], tone: 'request', label: 'GET /app.css', duration: 1 },
          { path: ['server', 'client'], tone: 'response', label: '200', duration: 1, delay: 1.1 },
        ],
        panel: {
          title: 'First request vs second',
          icon: 'Repeat',
          rows: [
            { text: 'First: TCP + TLS', value: '60 ms', tone: 'warn' },
            { text: 'Second: same connection', value: '0 ms', tone: 'good' },
            { text: 'HTTP/2', value: 'many at once' },
            { text: 'HTTP/3', value: 'fewer handshakes' },
          ],
        },
      },
    },
    {
      title: 'Request',
      tag: 'concept',
      heading: 'The browser asks for the page',
      eli5: 'Now the browser mails the real letter, the **HTTP request**. It is one small page that says which catalog you want and who is asking.',
      body: [
        'Now the browser sends an **HTTP request**: a method (`GET`), a path (`/`), and headers such as cookies, accepted formats and the host name.',
        'The request is small, usually under a kilobyte, so it travels in a single packet and costs one-way travel time, 15 ms here.',
      ],
      keyIdea: 'A request is a small, structured message. The interesting cost is rarely sending it. It is what the server has to do to answer it.',
      metrics: { dns: '20 ms', connect: '60 ms', total: '95 ms' },
      scene: {
        nodes: [{ ...client, chips: ['GET / HTTP/2'] }, { ...server, status: 'active' }],
        links: [link('client', 'server', { label: '15 ms one way' })],
        flows: [{ path: ['client', 'server'], tone: 'request', label: 'GET / HTTP/2', duration: 1.4 }],
        panel: {
          title: 'What the request carries',
          icon: 'Mail',
          code: 'GET / HTTP/2\nHost: shop.example\nCookie: session=ab12\nAccept: text/html\nAccept-Encoding: gzip, br',
          footer: { text: 'Under 1 KB, one packet', tone: 'muted' },
        },
      },
    },
    {
      title: 'Front door',
      tag: 'concept',
      heading: 'A front door often answers first',
      eli5: 'At a big shop a host at the door takes your letter first. The host may hand you a copy from the front desk or point you to a free clerk.',
      body: [
        'The address often points at a **CDN edge** or a **load balancer**, not the app server. The edge returns cached files itself. The balancer picks one healthy server from many.',
        'The browser cannot tell the difference. Both are covered in their own lessons, so here they are one box in front of the server.',
      ],
      keyIdea: 'The machine the browser talks to is often a front door. It answers from cache or hands off to a free server.',
      metrics: { dns: '20 ms', connect: '60 ms', total: '95 ms' },
      scene: {
        nodes: [client, { ...edge, status: 'active', chips: ['static: cache hit', { text: 'dynamic: forward', tone: 'warn' }] }, server],
        links: [link('client', 'edge'), link('edge', 'server')],
        flows: [
          { path: ['client', 'edge'], tone: 'request', label: 'GET /', duration: 1.2 },
          { path: ['edge', 'server'], tone: 'request', label: 'forward', duration: 1.2, delay: 1.3 },
        ],
        panel: {
          title: 'What the front door does',
          icon: 'Router',
          rows: [
            { text: 'Static file', value: 'answer from cache', tone: 'good' },
            { text: 'Dynamic page', value: 'forward to a server' },
            { text: 'Server down', value: 'pick another' },
          ],
        },
      },
    },
    {
      title: 'Server work',
      tag: 'concept',
      heading: 'The server runs the handler',
      eli5: 'The web server is the shop clerk who opens your letter, reads who you are from the stamp, and works out which shelves to visit.',
      body: [
        'The server routes `GET /` to a handler. The handler reads your session cookie to learn who you are, then works out what data the page needs.',
        'Everything the handler does while building the page is **server time**. Here it adds up to 40 ms, most of it waiting on other machines.',
      ],
      keyIdea: 'Server time is whatever the handler spends before it can answer. Most of it is waiting on other machines.',
      metrics: { dns: '20 ms', connect: '60 ms', server: '40 ms', total: '135 ms' },
      scene: {
        nodes: [client, { ...server, status: 'active', chips: ['GET /'], badge: 'handler' }, { ...db, status: 'dim' }],
        links: [link('client', 'server'), link('server', 'db')],
        panel: {
          title: 'Server time: 40 ms',
          icon: 'Server',
          rows: [
            { text: 'Route and read cookie', value: '2 ms' },
            { text: 'Query the database', value: '8 ms' },
            { text: 'Render HTML', value: '30 ms' },
          ],
          footer: { text: 'The handler waits for the data', tone: 'muted' },
        },
      },
      code: {
        language: 'python',
        title: 'A typical handler',
        source: `@app.get("/")
def home(request):
    user = session_user(request)          # read cookie
    products = db.query(                  # network hop to the DB
        "SELECT id, name, price FROM products "
        "WHERE featured = true LIMIT 20"
    )
    cart = db.query("SELECT * FROM carts WHERE user_id = %s", user.id)
    return render("home.html", products=products, cart=cart)`,
        highlight: [4, 5, 6, 7, 8],
      },
    },
    {
      title: 'Fetch data',
      tag: 'concept',
      heading: 'The server asks the database',
      eli5: 'To answer, the clerk walks to the storeroom, the **database**, to look up toys and prices, and you wait while the clerk walks.',
      body: [
        'To build the page the server needs data: products, prices, your cart. That lives in a **database**, which is another machine, so it means another network hop.',
        'A well-indexed query on a nearby database answers in a few milliseconds. The server then renders HTML or JSON from the result.',
      ],
      keyIdea: 'Behind every request there are usually more requests. The server is a client too, and its waiting time becomes your waiting time.',
      metrics: { dns: '20 ms', connect: '60 ms', server: '40 ms', total: '135 ms' },
      scene: {
        nodes: [client, { ...server, chips: ['SELECT … products'] }, { ...db, status: 'active', badge: '8 ms' }],
        links: [link('client', 'server'), link('server', 'db', { label: 'same datacenter · 1 ms', arrow: 'both' })],
        flows: [
          { path: ['server', 'db'], tone: 'request', label: 'SELECT …', duration: 1 },
          { path: ['db', 'server'], tone: 'response', label: 'rows', duration: 1, delay: 1.1 },
        ],
        panel: {
          title: 'Database round trip',
          icon: 'Database',
          rows: [
            { text: 'Network hop', value: '1 ms' },
            { text: 'Indexed query', value: '7 ms', tone: 'good' },
            { text: 'Rows returned', value: '20 products' },
          ],
        },
      },
    },
    {
      title: 'Response',
      tag: 'concept',
      heading: 'The answer comes home',
      eli5: 'The clerk mails the catalog back with a note on top saying all went well. Most of your waiting was mail riding in the truck, and the clerk worked only a short while.',
      body: [
        'The server sends back a **status code** (`200 OK`), headers and the HTML body. A 40 KB page compresses to around 10 KB with gzip or brotli and arrives in a few packets.',
        'Total so far: 20 ms DNS + 60 ms connect + 15 ms request + 40 ms server + 15 ms response travel = **150 ms**. Server work is under a third of it. Most of the time went to the network.',
      ],
      keyIdea: 'For a nearby user, most page-load time is network round trips, not computation. Measure before you optimize the code.',
      metrics: { dns: '20 ms', connect: '60 ms', server: '40 ms', download: '15 ms', total: '150 ms' },
      metricTones: { total: 'good' },
      scene: {
        nodes: [{ ...client, status: 'ok', badge: '200 OK' }, server, db],
        links: [link('client', 'server'), link('server', 'db')],
        flows: [{ path: ['server', 'client'], tone: 'response', label: '200 OK · 10 KB', duration: 1.4, count: 3 }],
        panel: {
          title: 'Where 150 ms went',
          icon: 'Gauge',
          rows: [
            { text: 'DNS', value: '20 ms' },
            { text: 'TCP + TLS', value: '60 ms', tone: 'warn' },
            { text: 'Request travel + response travel', value: '15 + 15 ms' },
            { text: 'Server work', value: '40 ms' },
          ],
          footer: { text: 'Network 110 ms, server 40 ms', tone: 'muted' },
        },
      },
    },
    {
      title: 'Status codes',
      tag: 'concept',
      heading: 'The first digit tells you what happened',
      eli5: 'The note on top of the returned mail has a number. Starting with 2 means here you go, 3 means go look elsewhere, 4 means you asked wrong, 5 means the shop broke.',
      body: [
        'Every response starts with a **status code**. `2xx` is success, `3xx` is a redirect, `4xx` means the client asked for something wrong, `5xx` means the server failed.',
        'A `301` costs an extra round trip because the browser must follow it to a new URL. The most common one sends `http://` to `https://`. HTTP methods and codes get their own lesson.',
      ],
      keyIdea: 'Read the first digit: 2 worked, 3 move on, 4 your fault, 5 our fault. A redirect is another full request.',
      metrics: { dns: '20 ms', connect: '60 ms', server: '40 ms', download: '15 ms', total: '150 ms' },
      scene: {
        nodes: [{ ...client, status: 'ok', badge: '200 OK' }, { ...server, chips: ['200 OK'] }],
        links: [link('server', 'client', { label: 'status line first' })],
        flows: [{ path: ['server', 'client'], tone: 'response', label: 'HTTP/2 200', duration: 1.4 }],
        panel: {
          title: 'Status code families',
          icon: 'List',
          rows: [
            { text: '200 OK', value: 'success', tone: 'good' },
            { text: '301 Moved', value: 'follow: +1 request', tone: 'warn' },
            { text: '404 Not found', value: 'client error', tone: 'warn' },
            { text: '500 Server error', value: 'server failed', tone: 'bad' },
          ],
        },
      },
    },
    {
      title: 'Parse HTML',
      tag: 'concept',
      heading: 'The HTML is only the first file',
      eli5: 'The catalog mentions pictures, stickers and a color chart. The browser reads it and writes a shopping list of everything else it must fetch.',
      body: [
        'The browser reads the HTML as it arrives. It finds links to CSS, JavaScript, fonts and images and queues a request for each one.',
        'A typical page makes 40 to 100 requests. The browser builds the DOM from the HTML and the CSSOM from the CSS. CSS blocks rendering, so first paint waits until the CSS has arrived.',
      ],
      keyIdea: 'The first response is a to-do list. The page is not done until the files it names have arrived.',
      metrics: { dns: '20 ms', connect: '60 ms', server: '40 ms', download: '15 ms', total: '150 ms' },
      scene: {
        nodes: [{ ...client, badge: 'parsing…' }, { ...server, status: 'dim' }, { id: 'assets', kind: 'block', size: 0.8, at: at(4.5, -1), label: 'assets', sub: 'css, js, images', icon: 'Package', tint: 'amber' }],
        links: [link('client', 'server', { style: 'faint' }), link('client', 'assets', { style: 'dashed', route: 'straight' })],
        panel: {
          title: 'Found in the HTML',
          icon: 'FileCode',
          rows: [
            { text: 'app.css', value: 'blocks render', tone: 'warn' },
            { text: 'app.js', value: 'blocks parsing', tone: 'warn' },
            { text: 'font.woff2', value: 'before text shows' },
            { text: 'hero.jpg, logo.png', value: '38 images' },
          ],
        },
      },
    },
    {
      title: 'More files',
      tag: 'case',
      heading: 'One page is really forty requests',
      eli5: 'The browser sends forty more little letters. **Connection reuse** means they all travel on the mail route that is already open, with no new hellos.',
      body: [
        'The browser fetches the assets over the connection we already paid for. With **connection reuse** and HTTP/2 multiplexing, many fly in parallel.',
        'Without reuse, each one would pay the 60 ms handshake again. Downloading all of them adds about 75 ms, so the total reaches 225 ms (150 + 75). Old HTTP/1.1 needed about 6 parallel connections per host to get this overlap, while HTTP/2 uses one multiplexed connection.',
      ],
      keyIdea: 'Parallelism and reuse hide latency. Without them, forty requests would cost forty handshakes.',
      metrics: { dns: '20 ms', connect: '60 ms', server: '40 ms', download: '90 ms', total: '225 ms' },
      scene: {
        nodes: [{ ...client, chips: ['40 requests'] }, { ...server, status: 'active', chips: ['one connection'] }, db],
        links: [link('client', 'server', { label: 'HTTP/2, one connection', arrow: 'both' }), link('server', 'db')],
        flows: [
          { path: ['client', 'server'], tone: 'request', label: 'app.css, app.js, logo.png…', count: 5, duration: 1.2 },
          { path: ['server', 'client'], tone: 'response', count: 5, duration: 1.2, delay: 1.4 },
        ],
        panel: {
          title: 'Forty requests',
          icon: 'Layers',
          rows: [
            { text: 'With reuse', value: '1 handshake', tone: 'good' },
            { text: 'Without reuse', value: '40 handshakes', tone: 'bad' },
            { text: 'Extra download time', value: '~75 ms' },
            { text: 'HTTP/1.1', value: '~6 connections per host' },
          ],
        },
      },
      quiz: {
        question: 'The HTML references 40 more files on the same host. What keeps this from costing 40 handshakes?',
        options: ['Each file is compressed', 'The connection is kept open and reused', 'DNS caches the files', 'The database answers faster'],
        answer: 1,
        explain: 'Keep-alive and HTTP/2 let every file reuse the connection already paid for, so no more handshakes are needed.',
      },
    },
    {
      title: 'Critical path',
      tag: 'tradeoff',
      heading: 'Only the longest chain sets the time',
      eli5: 'Forty letters sent at once arrive when the slowest one does. Making the quick ones quicker changes nothing. Only the slowest chain matters.',
      body: [
        'Requests that run in parallel overlap, so total time is set by the **critical path**: the longest chain where each step waits for the one before it, such as HTML, then CSS, then font.',
        'Speeding up a request off the critical path gains nothing. Shortening the critical path gains something for the whole page.',
      ],
      keyIdea: 'The critical path is the longest chain of things that must happen one after another. Only shortening it makes the page faster.',
      metrics: { dns: '20 ms', connect: '60 ms', server: '40 ms', download: '90 ms', total: '225 ms' },
      scene: {
        nodes: [
          { ...client, chips: ['HTML, CSS, font'] },
          { id: 'crit', kind: 'block', size: 0.8, at: at(0, -4), label: 'critical chain', sub: 'HTML, CSS, font', icon: 'Route', tint: 'red', status: 'hot' },
          { id: 'par', kind: 'block', size: 0.8, at: at(0, 2), label: 'parallel', sub: 'images', icon: 'Layers', tint: 'green' },
        ],
        links: [link('client', 'crit', { label: 'one after another', labelTone: 'warn' }), link('client', 'par', { label: 'at the same time' })],
        panel: {
          title: 'What sets the time',
          icon: 'Timer',
          rows: [
            { text: 'HTML (the whole first load)', value: '150 ms' },
            { text: 'then CSS', value: '+40 ms' },
            { text: 'then font', value: '+35 ms' },
            { text: 'Critical path total', value: '= 225 ms', tone: 'bad' },
            { text: '38 images, off the chain', value: '60 ms in parallel', tone: 'good' },
          ],
        },
      },
    },
    {
      title: 'Measure',
      tag: 'concept',
      heading: 'A waterfall shows where the time went',
      eli5: 'Keep a stopwatch for each part of the trip, the hellos, the clerk and the road. Then you know which part to speed up.',
      body: [
        'Browser DevTools (the Network tab) draws a **waterfall**: one bar per request, split into DNS, connect, TLS, waiting (**TTFB**, time to first byte) and download.',
        'Read the widest segment first. `curl -w` gives the same breakdown for one request from your terminal.',
      ],
      keyIdea: 'Measure each phase before changing anything. The longest segment is the one to fix.',
      metrics: { dns: '20 ms', connect: '60 ms', server: '40 ms', download: '15 ms', total: '150 ms' },
      scene: {
        nodes: [{ ...client, chips: ['DevTools: Network'] }, { id: 'wf', kind: 'block', size: 0.9, at: at(1.5, -1), label: 'waterfall', sub: 'one bar per request', icon: 'Activity', tint: 'teal' }],
        links: [link('client', 'wf', { route: 'straight' })],
        panel: {
          title: 'GET / in the waterfall',
          icon: 'Timer',
          rows: [
            { text: 'DNS', value: '20 ms' },
            { text: 'Connect + TLS', value: '60 ms', tone: 'warn' },
            { text: 'Waiting (TTFB)', value: '55 ms' },
            { text: 'Download (response travel)', value: '15 ms' },
          ],
          footer: { text: 'TTFB 55 = 15 request travel + 40 server', tone: 'muted' },
        },
      },
    },
    {
      title: 'Slow query',
      tag: 'case',
      heading: 'Case: one missing index',
      eli5: 'The storeroom has no list saying which shelf holds what. That list is called an **index**. Without it the database opens every one of five million boxes to find yours, and the web server just waits.',
      body: [
        'Monday morning the shop is slow again. DNS and connect are unchanged. The server column jumped from 40 ms to 840 ms.',
        'The culprit is a query that filters `carts.user_id`, a column with **no index**, so the database scans all 5 million rows. One slow dependency and every page that touches it pays the full price.',
        'The fix is an index (we cover how they work in a later lesson). The lesson here is the method: the per-phase breakdown told us exactly where to look.',
      ],
      keyIdea: 'A request is only as fast as its slowest dependency. Break the time down by phase and the culprit usually names itself.',
      metrics: { dns: '20 ms', connect: '60 ms', server: '840 ms', download: '15 ms', total: '935 ms' },
      metricTones: { server: 'bad', total: 'bad' },
      scene: {
        nodes: [client, { ...server, status: 'hot', load: 35, badge: 'waiting…' }, { ...db, status: 'hot', load: 95, badge: '800 ms · full scan' }],
        links: [link('client', 'server'), link('server', 'db', { label: '5 M rows scanned', labelTone: 'warn' })],
        flows: [
          { path: ['server', 'db'], tone: 'request', label: 'WHERE user_id = ?', duration: 1 },
          { path: ['db', 'server'], tone: 'response', duration: 3.2, delay: 1.1 },
        ],
        panel: {
          title: 'Server column',
          icon: 'Bug',
          rows: [
            { text: 'Before', value: '40 ms', tone: 'good' },
            { text: 'Now', value: '840 ms', tone: 'bad' },
            { text: 'Rows scanned', value: '5,000,000', tone: 'bad' },
          ],
        },
      },
      code: {
        language: 'sql',
        title: 'Find it, fix it',
        source: `EXPLAIN ANALYZE
SELECT * FROM carts WHERE user_id = 42;
-- Seq Scan on carts  (rows=5000000)  time=800 ms

CREATE INDEX idx_carts_user_id ON carts (user_id);
-- Index Scan using idx_carts_user_id  time=0.4 ms`,
        highlight: [3, 5, 6],
      },
    },
    {
      title: 'Far away',
      tag: 'case',
      heading: 'Case: a user on the other side of the planet',
      eli5: 'Now you live across the ocean from the shop, so every letter takes a long boat ride. A **CDN** fixes this by keeping copies of the catalog at a small post office near your house.',
      body: [
        'A customer in Sydney opens the shop hosted in Virginia. Light in fiber needs about **200 ms** per round trip, and no code can change that.',
        'DNS stays near 20 ms because resolvers sit near the user (a cold lookup can be slower). Each round trip to the server costs 200 ms instead of 30: connect is 400 ms, request and reply 200 ms, server 40 ms. Total: about **660 ms**.',
        'The fix is to bring content closer with a **CDN** or another region.',
      ],
      keyIdea: 'Distance is a floor you cannot optimize away. When users are far, move the data toward them.',
      metrics: { dns: '20 ms', connect: '400 ms', server: '40 ms', download: '200 ms', total: '660 ms' },
      metricTones: { connect: 'bad', download: 'bad', total: 'bad' },
      scene: {
        zones: [
          { id: 'syd', from: [-6.6, -1.2], to: [-2.6, 2.6], label: 'Sydney', tone: 'amber' },
          { id: 'va', from: [0.4, -2.6], to: [5.8, 1.2], label: 'Virginia', tone: 'blue' },
        ],
        nodes: [user, { ...client, at: [-4, 0], badge: '200 ms RTT' }, { ...server, at: [1.5, 0] }, { ...db, at: [4.5, -1.5] }],
        links: [
          link('client', 'server', { style: 'dashed', label: '~16,000 km · 200 ms RTT', labelTone: 'warn' }),
          link('server', 'db'),
        ],
        flows: [
          { path: ['client', 'server'], tone: 'request', duration: 3 },
          { path: ['server', 'client'], tone: 'response', duration: 3, delay: 3.1 },
        ],
        panel: {
          title: 'Same page, 30 ms vs 200 ms RTT',
          icon: 'Globe',
          rows: [
            { text: 'DNS (nearby resolver)', value: '20 vs 20 ms' },
            { text: 'TCP + TLS (2 RTT)', value: '60 vs 400 ms', tone: 'bad' },
            { text: 'Request + response', value: '30 vs 200 ms', tone: 'bad' },
            { text: 'Server work', value: '40 vs 40 ms' },
            { text: 'Total', value: '150 vs 660 ms', tone: 'bad' },
          ],
        },
      },
    },
    {
      title: 'Fix by phase',
      tag: 'tradeoff',
      heading: 'Each phase has its own fix',
      eli5: 'A slow trip is slow for one of three reasons: too many hellos, a slow storeroom, or a long road. Each reason needs a different cure.',
      body: [
        'Slow DNS: longer TTLs, a faster resolver. Slow connect: reuse connections, TLS 1.3, HTTP/3. Slow server: indexes, caching, fewer dependencies. Slow download: compression, smaller assets.',
        'Distance is the odd one out. Nothing you tune in code fixes it, so you move content closer with a CDN or another region.',
      ],
      keyIdea: 'Pick the fix that matches the biggest phase. A fix for the wrong phase changes nothing.',
      metrics: { dns: '20 ms', connect: '60 ms', server: '40 ms', download: '15 ms', total: '150 ms' },
      scene: {
        nodes: [{ ...client, status: 'ok' }, dns, server, db],
        links: [link('client', 'dns', { style: 'dashed' }), link('client', 'server'), link('server', 'db')],
        panel: {
          title: 'Phase to fix',
          icon: 'Scale',
          rows: [
            { text: 'DNS slow', value: 'longer TTL' },
            { text: 'Connect slow', value: 'reuse, TLS 1.3, HTTP/3' },
            { text: 'Server slow', value: 'index, cache' },
            { text: 'Download slow', value: 'compress, shrink' },
            { text: 'User far away', value: 'CDN, region', tone: 'warn' },
          ],
        },
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Where the time really goes',
      eli5: 'Mail can be slow in three places: too many hellos, a slow storeroom, or a long road. To **measure by phase** is to time each part of the trip, so you fix the part that is slowest.',
      body: [
        'A page load is cache check, DNS lookup, connection setup, request, server work (including its own calls to databases), response, then more requests for the page\'s assets.',
        'Round trips dominate for nearby users. Slow dependencies dominate when something is wrong. Distance dominates for far-away users. Each has a different fix, which is why you **measure by phase first**.',
      ],
      keyIdea: 'Measure each phase, find the biggest one, fix that. Everything later in this course is a tool for one of these phases.',
      metrics: { dns: '20 ms', connect: '60 ms', server: '40 ms', download: '15 ms', total: '150 ms' },
      scene: {
        nodes: [user, { ...client, status: 'ok' }, dns, server, db],
        links: [
          link('client', 'dns', { style: 'dashed' }),
          link('client', 'server'),
          link('server', 'db'),
        ],
        flows: [
          { path: ['client', 'dns', 'client'], tone: 'request', duration: 1.6 },
          { path: ['client', 'server', 'db', 'server', 'client'], tone: 'response', duration: 3, delay: 1.7 },
        ],
      },
      quiz: {
        question: 'A user in Sydney says your Virginia-hosted site is slow. The server column shows 40 ms. What is the most effective first fix?',
        options: [
          'Rewrite the request handler in a faster language',
          'Add a database index',
          'Serve content from a location closer to the user (CDN or another region)',
          'Give the web server more CPU',
        ],
        answer: 2,
        explain: 'Server work is only 40 ms. The rest is round trips across the planet, so moving content closer is the only change that helps much.',
      },
    },
  ],
};
