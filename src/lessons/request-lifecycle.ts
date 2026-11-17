import type { Lesson, SceneNode } from '../engine/types';

const user: SceneNode = { id: 'user', kind: 'user', at: [-5.5, 1.5], label: 'you' };
const client: SceneNode = { id: 'client', kind: 'client', at: [-4, 0], label: 'browser', sub: 'shop.example' };
const dns: SceneNode = { id: 'dns', kind: 'dns', at: [-2, -3], label: 'DNS resolver', sub: '8.8.8.8' };
const server: SceneNode = { id: 'server', kind: 'server', at: [1.5, 0], label: 'web server', sub: '203.0.113.10' };
const db: SceneNode = { id: 'db', kind: 'db', at: [4.5, -1.5], label: 'database' };

export const requestLifecycle: Lesson = {
  id: 'request-lifecycle',
  title: 'How a request travels',
  tagline: 'Follow one page load hop by hop and find out where the time goes.',
  minutes: 10,
  level: 'Beginner',
  learn: [
    'What DNS does and why answers are cached',
    'Why opening a connection costs round trips',
    'The path: browser → server → database → back',
    'How to measure where page-load time goes',
    'Two classic slowdowns: a slow query and a distant user',
  ],
  metrics: [
    { key: 'dns', label: 'DNS' },
    { key: 'connect', label: 'Connect' },
    { key: 'server', label: 'Server' },
    { key: 'download', label: 'Download' },
    { key: 'total', label: 'Total' },
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
      scene: {
        nodes: [user, client],
        caption: 'One page load, start to finish',
      },
    },
    {
      title: 'Find address',
      tag: 'concept',
      heading: 'DNS turns a name into an address',
      eli5: '**DNS** is the post office address book. The browser asks it where shop.example lives, then keeps the answer on a sticky note so it does not have to ask again for a while.',
      body: [
        'Computers route traffic by IP address, not by name. Before anything else the browser asks a **DNS resolver**: "what is the address for shop.example?"',
        'The resolver may ask a chain of other servers (root, then `.example`, then the domain\'s own name server). The answer comes back with a **TTL**, a time-to-live that says how long it may be cached.',
        'The first lookup took 20 ms. The next visit within the TTL costs nothing, because the browser and the OS already remember the answer.',
      ],
      keyIdea: 'DNS is a cache-friendly phone book. The first lookup is slow, repeats are almost free, and TTL decides how long "almost free" lasts.',
      metrics: { dns: '20 ms', total: '20 ms' },
      scene: {
        nodes: [user, client, { ...dns, badge: '203.0.113.10', status: 'active' }],
        links: [{ from: 'client', to: 'dns', style: 'dashed' }],
        flows: [
          { path: ['client', 'dns'], tone: 'request', label: 'A? shop.example', duration: 1.2 },
          { path: ['dns', 'client'], tone: 'response', label: '203.0.113.10', duration: 1.2, delay: 1.3 },
        ],
      },
    },
    {
      title: 'Connect',
      tag: 'concept',
      heading: 'Opening a connection costs round trips',
      eli5: 'Before the real letter goes out, the browser mails the web server a quick hello and waits for a hello back. Each trip there and back is a **round trip**, and two of them pass before any real mail moves.',
      body: [
        'With the address in hand the browser opens a **TCP** connection: SYN, SYN-ACK, ACK. That is one full **round trip** (RTT) before a single byte of your page can move.',
        'HTTPS then adds a **TLS handshake** to agree on encryption keys. With TLS 1.3 that is one more round trip. At 30 ms per round trip, we have spent 60 ms just saying hello.',
        'This is why browsers keep connections open and reuse them. The second request on the same connection skips all of this.',
      ],
      keyIdea: 'Latency is counted in round trips. Anything that removes a round trip (reuse, TLS 1.3, HTTP/3) makes everything faster.',
      metrics: { dns: '20 ms', connect: '60 ms', total: '80 ms' },
      scene: {
        nodes: [user, client, { ...dns, status: 'dim' }, { ...server, status: 'active' }],
        links: [{ from: 'client', to: 'server' }],
        flows: [
          { path: ['client', 'server'], tone: 'handshake', label: 'SYN', duration: 1 },
          { path: ['server', 'client'], tone: 'handshake', label: 'SYN-ACK', duration: 1, delay: 1.05 },
          { path: ['client', 'server'], tone: 'handshake', label: 'ACK + TLS hello', duration: 1, delay: 2.1 },
          { path: ['server', 'client'], tone: 'handshake', label: 'TLS done', duration: 1, delay: 3.15 },
        ],
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
    },
    {
      title: 'Request',
      tag: 'concept',
      heading: 'The browser asks for the page',
      eli5: 'Now the browser mails the real letter, the **HTTP request**. It is one small page that says which catalog you want and who is asking.',
      body: [
        'Now the browser sends an **HTTP request**: a method (`GET`), a path (`/`), and headers such as cookies, accepted formats and the host name.',
        'The request is small, usually under a kilobyte, so it travels in a single packet. The server reads it, routes it to the right handler and starts working.',
      ],
      keyIdea: 'A request is a small, structured message. The interesting cost is rarely sending it. It is what the server has to do to answer it.',
      metrics: { dns: '20 ms', connect: '60 ms', total: '95 ms' },
      scene: {
        nodes: [user, client, { ...dns, status: 'dim' }, { ...server, status: 'active' }],
        links: [{ from: 'client', to: 'server' }],
        flows: [{ path: ['client', 'server'], tone: 'request', label: 'GET / HTTP/2', duration: 1.4 }],
      },
    },
    {
      title: 'Fetch data',
      tag: 'concept',
      heading: 'The server asks the database',
      eli5: 'The web server is the shop clerk who opens your letter. To answer it, the clerk walks to the storeroom, the **database**, to look up toys and prices, and you wait while the clerk walks.',
      body: [
        'To build the page the server needs data: products, prices, your cart. That lives in a **database**, which is another machine, so it means another network hop.',
        'A well-indexed query on a nearby database answers in a few milliseconds. The server then renders HTML or JSON from the result.',
      ],
      keyIdea: 'Behind every request there are usually more requests. The server is a client too, and its waiting time becomes your waiting time.',
      metrics: { dns: '20 ms', connect: '60 ms', server: '40 ms', total: '135 ms' },
      scene: {
        nodes: [user, client, { ...dns, status: 'dim' }, server, { ...db, status: 'active', badge: '8 ms' }],
        links: [
          { from: 'client', to: 'server' },
          { from: 'server', to: 'db' },
        ],
        flows: [
          { path: ['server', 'db'], tone: 'request', label: 'SELECT …', duration: 1 },
          { path: ['db', 'server'], tone: 'response', label: 'rows', duration: 1, delay: 1.1 },
        ],
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
      title: 'Response',
      tag: 'concept',
      heading: 'The answer comes home',
      eli5: 'The clerk mails the catalog back with a note on top saying all went well. That note is the **status code**. Most of your waiting was mail riding in the truck, and the clerk worked only a short while.',
      body: [
        'The server sends back a **status code** (`200 OK`), headers and the HTML body. A 40 KB page compresses to around 10 KB and arrives in a few packets.',
        'Total so far: 20 ms DNS + 60 ms connect + 40 ms server + 15 ms download ≈ **150 ms**. Notice that the server work is under a third of it. Most of the time went to the network.',
      ],
      keyIdea: 'For a nearby user, most page-load time is network round trips, not computation. Measure before you optimize the code.',
      metrics: { dns: '20 ms', connect: '60 ms', server: '40 ms', download: '15 ms', total: '150 ms' },
      scene: {
        nodes: [user, { ...client, status: 'ok', badge: '200 OK' }, { ...dns, status: 'dim' }, server, db],
        links: [
          { from: 'client', to: 'server' },
          { from: 'server', to: 'db' },
        ],
        flows: [{ path: ['server', 'client'], tone: 'response', label: '200 OK · 10 KB', duration: 1.4, count: 3 }],
      },
    },
    {
      title: 'More files',
      tag: 'case',
      heading: 'One page is really forty requests',
      eli5: 'The catalog needs pictures and stickers too, so the browser sends forty more little letters. **Connection reuse** means they all travel on the mail route that is already open, with no new hellos.',
      body: [
        'The HTML references CSS, JavaScript, fonts and images. The browser discovers them while parsing and fetches them too. A typical page makes 40 to 100 requests.',
        'Thanks to **connection reuse** and HTTP/2 multiplexing, these share the connection we already paid for, and many fly in parallel. Without reuse, each one would pay the 60 ms handshake again.',
      ],
      keyIdea: 'Parallelism and reuse hide latency. The critical path is the longest chain of things that must happen one after another.',
      metrics: { dns: '20 ms', connect: '60 ms', server: '40 ms', download: '90 ms', total: '210 ms' },
      scene: {
        nodes: [user, client, { ...dns, status: 'dim' }, { ...server, status: 'active' }, db],
        links: [
          { from: 'client', to: 'server' },
          { from: 'server', to: 'db' },
        ],
        flows: [
          { path: ['client', 'server'], tone: 'request', label: 'app.css, app.js, logo.png…', count: 5, duration: 1.2 },
          { path: ['server', 'client'], tone: 'response', count: 5, duration: 1.2, delay: 1.4 },
        ],
      },
    },
    {
      title: 'Slow query',
      tag: 'case',
      heading: 'Case: one missing index',
      eli5: 'The storeroom has no list saying which shelf holds what. That list is called an **index**. Without it the database opens every one of five million boxes to find yours, and the web server just waits.',
      body: [
        'Monday morning the shop is slow again. DNS and connect are unchanged. The server column jumped from 40 ms to 840 ms.',
        'The culprit is a query that filters on a column with **no index**, so the database scans all 5 million rows. One slow dependency and every page that touches it pays the full price.',
        'The fix is an index (we cover how they work in a later lesson). The lesson here is the method: the per-phase breakdown told us exactly where to look.',
      ],
      keyIdea: 'A request is only as fast as its slowest dependency. Break the time down by phase and the culprit usually names itself.',
      metrics: { dns: '20 ms', connect: '60 ms', server: '840 ms', download: '15 ms', total: '935 ms' },
      scene: {
        nodes: [user, client, { ...dns, status: 'dim' }, { ...server, status: 'hot', badge: 'waiting…' }, { ...db, status: 'hot', badge: '800 ms · full scan' }],
        links: [
          { from: 'client', to: 'server' },
          { from: 'server', to: 'db' },
        ],
        flows: [
          { path: ['server', 'db'], tone: 'request', label: 'WHERE email = ?', duration: 1 },
          { path: ['db', 'server'], tone: 'response', duration: 3.2, delay: 1.1 },
        ],
      },
      code: {
        language: 'sql',
        title: 'Find it, fix it',
        source: `EXPLAIN ANALYZE
SELECT * FROM orders WHERE email = 'a@b.com';
-- Seq Scan on orders  (rows=5000000)  time=812 ms

CREATE INDEX idx_orders_email ON orders (email);
-- Index Scan using idx_orders_email  time=0.4 ms`,
        highlight: [3, 5, 6],
      },
    },
    {
      title: 'Far away',
      tag: 'case',
      heading: 'Case: a user on the other side of the planet',
      eli5: 'Now you live across the ocean from the shop, so every letter takes a long boat ride. A **CDN** fixes this by keeping copies of the catalog at a small post office near your house.',
      body: [
        'A customer in Sydney opens the shop, which is hosted in Virginia. Light in fiber needs about **200 ms** for that round trip, and no amount of code can make it faster.',
        'Every round trip now costs 200 ms instead of 30. DNS, TCP, TLS and the request add up to more than **800 ms** before the first byte arrives.',
        'The fix is to bring content closer: a **CDN** caches files at edges near users, and multi-region deployments move the servers themselves. Both get their own lessons.',
      ],
      keyIdea: 'Distance is a floor you cannot optimize away. When users are far, move the data toward them.',
      metrics: { dns: '200 ms', connect: '400 ms', server: '40 ms', download: '200 ms', total: '840 ms' },
      scene: {
        zones: [
          { id: 'syd', from: [-6.6, -1.2], to: [-2.6, 2.6], label: 'Sydney', tone: 'amber' },
          { id: 'va', from: [0.4, -2.6], to: [5.8, 1.2], label: 'Virginia', tone: 'blue' },
        ],
        nodes: [user, { ...client, badge: '200 ms RTT' }, server, db],
        links: [
          { from: 'client', to: 'server', style: 'dashed', label: '~16,000 km' },
          { from: 'server', to: 'db' },
        ],
        flows: [
          { path: ['client', 'server'], tone: 'request', duration: 3 },
          { path: ['server', 'client'], tone: 'response', duration: 3, delay: 3.1 },
        ],
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Where the time really goes',
      eli5: 'Mail can be slow in three places: too many hellos, a slow storeroom, or a long road. To **measure by phase** is to time each part of the trip, so you fix the part that is slowest.',
      body: [
        'A page load is DNS lookup → connection setup → request → server work (including its own calls to databases) → response → more requests for the page\'s assets.',
        'Round trips dominate for nearby users. Slow dependencies dominate when something is wrong. Distance dominates for far-away users. Each has a different fix, which is why you **measure by phase first**.',
      ],
      keyIdea: 'Measure each phase, find the biggest one, fix that. Everything later in this course is a tool for one of these phases.',
      metrics: { dns: '20 ms', connect: '60 ms', server: '40 ms', download: '15 ms', total: '150 ms' },
      scene: {
        nodes: [user, { ...client, status: 'ok' }, dns, server, db],
        links: [
          { from: 'client', to: 'dns', style: 'dashed' },
          { from: 'client', to: 'server' },
          { from: 'server', to: 'db' },
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
