import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const browser: SceneNode = { id: 'browser', kind: 'client', at: at(-3.8, 0), label: 'browser', sub: 'your laptop' };
const wifi: SceneNode = { id: 'wifi', kind: 'internet', at: at(0, 0), label: 'cafe Wi-Fi', sub: 'shared network' };
const server: SceneNode = { id: 'server', kind: 'server', at: at(3.8, 0), label: 'web server', sub: 'shop.example' };
const ca: SceneNode = { id: 'ca', kind: 'block', size: 0.72, at: at(3.8, -5.6), label: 'CA', sub: 'signs certificates', icon: 'Shield', tint: 'amber' };
const inter: SceneNode = { id: 'inter', kind: 'block', size: 0.72, at: at(0, -5.6), label: 'intermediate CA', icon: 'Shield', tint: 'amber' };
const root: SceneNode = { id: 'root', kind: 'block', size: 0.72, at: at(-3.8, -5.6), label: 'root CA', sub: 'key kept offline', icon: 'Key', tint: 'violet' };
const lb: SceneNode = { id: 'lb', kind: 'lb', at: at(0, 0), label: 'load balancer', sub: 'holds the certificate' };

const path = [link('browser', 'wifi'), link('wifi', 'server')];
const there = ['browser', 'wifi', 'server'];
const back = ['server', 'wifi', 'browser'];

export const httpTlsPart2: Lesson = {
  id: 'http-tls-part-2',
  title: 'HTTP, HTTPS and TLS (part 2)',
  tagline: 'The lock around HTTP: key exchange, certificates, what a handshake costs and how reuse makes it cheap.',
  minutes: 14,
  level: 'Beginner',
  learn: [
    'The three promises of TLS: privacy, integrity and identity',
    'How two strangers agree on a secret key in public, and why each connection gets a fresh one',
    'The TLS 1.3 handshake, what it costs, and what an observer still sees',
    'Certificates, chains of trust and why expiry takes sites down',
    'Resumption, 0-RTT, HSTS and TLS termination at the load balancer',
  ],
  metrics: [
    { key: 'status', label: 'Last status', icon: 'Receipt' },
    { key: 'wire', label: 'On the wire', icon: 'Shield' },
    { key: 'setup', label: 'Setup wait', icon: 'Timer' },
    { key: 'conns', label: 'Connections', icon: 'Plug' },
  ],
  steps: [
    {
      title: 'Three doors',
      tag: 'problem',
      heading: 'Plain HTTP leaves three doors open',
      eli5: 'In the crowded hall, the **cafe Wi-Fi**, a stranger can read your slip, scribble on it, or pretend to be the librarian. You want a way to stop all three.',
      body: [
        'On the cafe Wi-Fi, a plain HTTP exchange can be **read** (your password), **changed** (a page with a fake login box) and **faked** (an attacker answers as `shop.example`).',
        '**TLS** closes all three. HTTP sent through it is **HTTPS**, and it promises **privacy**, **integrity** and **identity**. The next steps show how.',
      ],
      keyIdea: 'TLS gives HTTP privacy, integrity and identity. HTTPS is plain HTTP inside that tunnel.',
      metrics: { wire: 'plain text', setup: '50 ms (TCP)' },
      metricTones: { wire: 'bad' },
      scene: {
        nodes: [{ ...browser, chips: ['POST /login'] }, { ...wifi, status: 'hot', badge: 'reads, edits, fakes' }, server],
        links: [link('browser', 'wifi'), link('wifi', 'server', { label: 'plain HTTP', labelTone: 'warn' })],
        flows: [
          { path: there, tone: 'request', label: 'password=hunter2', duration: 2.2 },
          { path: back, tone: 'error', label: 'page edited on the way', duration: 2.2, delay: 2.4 },
        ],
        panel: {
          title: 'Three doors, three promises',
          icon: 'Shield',
          rows: [
            { text: 'Read it', value: 'privacy', tone: 'bad' },
            { text: 'Change it', value: 'integrity', tone: 'bad' },
            { text: 'Pretend to be the server', value: 'identity', tone: 'bad' },
          ],
          footer: { text: 'TLS answers all three', tone: 'good' },
        },
        caption: 'Plain HTTP: read, changed and faked',
      },
    },
    {
      title: 'Key exchange',
      tag: 'concept',
      heading: 'Agree on a secret key in public',
      eli5: 'You and the librarian each mix your own secret colour into a shared paint tin and swap tins. Each of you adds your secret again and gets the same final colour. The hall only sees the tins.',
      body: [
        'Both sides need the same secret key, and the Wi-Fi hears everything. In a **Diffie-Hellman** key exchange each side makes a private number, sends only a public half, and combines the other side\'s half with its own private number. Both land on the same secret.',
        'The Wi-Fi sees both public halves and still cannot compute the secret. The key itself never crosses the network. Each connection makes fresh private numbers, so a stolen long-term key cannot decrypt old recordings. That is **forward secrecy**.',
      ],
      keyIdea: 'Each side sends a public half and keeps a private one. Both compute the same key, and a listener cannot.',
      metrics: { wire: 'key halves only', setup: '50 ms (TCP)' },
      scene: {
        nodes: [{ ...browser, status: 'active', badge: 'secret: 7f2c...' }, { ...wifi, badge: 'sees halves, no secret' }, { ...server, status: 'active', badge: 'secret: 7f2c...' }],
        links: path,
        flows: [
          { path: there, tone: 'handshake', label: 'public half A', duration: 1.8 },
          { path: back, tone: 'handshake', label: 'public half B', duration: 1.8, delay: 2 },
        ],
        panel: {
          title: 'Who knows what',
          icon: 'KeyRound',
          rows: [
            { text: 'Browser', value: 'private a, public A' },
            { text: 'Server', value: 'private b, public B' },
            { text: 'Wi-Fi', value: 'A and B only', tone: 'warn' },
            { text: 'Browser and server', value: 'same secret', tone: 'good' },
            { text: 'New numbers per connection', value: 'forward secrecy', tone: 'good' },
          ],
        },
        caption: 'The secret is computed, never sent',
      },
    },
    {
      title: 'Symmetric',
      tag: 'concept',
      heading: 'Seal the data with the shared key',
      eli5: 'Now you both own the same secret code book. Every slip is written in that code, and a small seal on it breaks if anyone changes a single letter.',
      body: [
        'Public-key math is slow, so it only agrees on the key. The shared key feeds a fast **symmetric** cipher such as AES-GCM or ChaCha20. The cipher adds a tag that fails if a single byte changes. That tag is the **integrity** check.',
        'AES-GCM is fast on CPUs with AES hardware and ChaCha20 on phones without it. Both encrypt and add the tag in one pass.',
      ],
      keyIdea: 'Public-key math agrees on a key once. A fast symmetric cipher then encrypts the data and detects tampering.',
      metrics: { status: '200 OK', wire: 'encrypted', setup: '50 ms (TCP)' },
      metricTones: { wire: 'good' },
      scene: {
        nodes: [{ ...browser, status: 'active' }, { ...wifi, badge: 'sees: x9$kQ2!f...' }, { ...server, status: 'active' }],
        links: path,
        flows: [
          { path: there, tone: 'request', label: 'encrypted request', duration: 1.8 },
          { path: back, tone: 'response', label: 'encrypted response', duration: 1.8, delay: 2 },
        ],
        panel: {
          title: 'Two kinds of cryptography',
          icon: 'Key',
          rows: [
            { text: 'Key exchange (ECDHE)', value: 'agree on a key, slow' },
            { text: 'AES-GCM, ChaCha20', value: 'encrypt the data, fast', tone: 'good' },
            { text: 'Authentication tag', value: 'detects any change', tone: 'good' },
          ],
        },
        caption: 'The Wi-Fi sees only noise',
      },
    },
    {
      title: 'Handshake',
      tag: 'concept',
      heading: 'The TLS 1.3 handshake takes one round trip',
      eli5: 'You say hello and give your half of the paint tin. The librarian replies with her half and her badge, and from then on you both speak in code. One hello, one reply.',
      body: [
        'The browser sends a `ClientHello`: its supported ciphers, a key share, the host name (`SNI`) and the protocols it speaks (`ALPN`, such as `h2`). The server answers with its key share, its **certificate** and a signature. Both compute the key.',
        'That is **one round trip** on top of TCP. At 50 ms per round trip a new HTTPS connection waits 100 ms. TLS 1.2 needed two round trips, so 150 ms.',
      ],
      keyIdea: 'A new HTTPS connection costs the TCP round trip plus one TLS 1.3 round trip. That is 100 ms at 50 ms per trip.',
      metrics: { status: '200 OK', wire: 'encrypted', setup: '100 ms (TCP + TLS)', conns: '1' },
      metricTones: { setup: 'warn' },
      scene: {
        nodes: [{ ...browser, status: 'active' }, { ...wifi, status: 'dim' }, { ...server, status: 'active' }],
        links: path,
        flows: [
          { path: there, tone: 'handshake', label: 'ClientHello + key share', duration: 1.6 },
          { path: back, tone: 'handshake', label: 'ServerHello + certificate', duration: 1.6, delay: 1.8 },
          { path: there, tone: 'request', label: 'encrypted request', duration: 1.6, delay: 3.6 },
          { path: back, tone: 'response', label: 'encrypted response', duration: 1.6, delay: 5.4 },
        ],
        panel: {
          title: 'A new HTTPS connection',
          icon: 'Timer',
          rows: [
            { text: 'TCP handshake', value: '50 ms' },
            { text: 'TLS 1.3 handshake', value: '50 ms' },
            { text: 'First request leaves at', value: '100 ms', tone: 'warn' },
            { text: 'TLS 1.2 would be', value: '150 ms', tone: 'bad' },
          ],
        },
        caption: 'One round trip, then everything is sealed',
      },
      quiz: {
        question: 'RTT to the server is 50 ms. How long does a brand new HTTPS connection with TLS 1.3 wait before the first request can be sent?',
        options: ['50 ms', '100 ms', '150 ms', '200 ms'],
        answer: 1,
        explain: 'TCP needs one round trip (50 ms) and the TLS 1.3 handshake needs one more (50 ms), so the request leaves at 100 ms. TLS 1.2 added a second TLS round trip, which gives 150 ms.',
      },
    },
    {
      title: 'On the wire',
      tag: 'concept',
      heading: 'What an observer still sees',
      eli5: 'The hall can still see which librarian you walk to and how thick your slip is. It cannot read what is written on it.',
      body: [
        'After the handshake, an observer on the Wi-Fi still sees the server\'s IP address, the host name in `SNI`, and how much data moves and when. Paths, headers, cookies and bodies are gone.',
        'Encrypted Client Hello (ECH) can hide the host name too, where both sides support it.',
      ],
      keyIdea: 'TLS hides what you say. It does not hide who you talk to or how much, unless extras like ECH are used.',
      metrics: { status: '200 OK', wire: 'encrypted', setup: '100 ms (TCP + TLS)', conns: '1' },
      scene: {
        nodes: [{ ...browser, chips: ['GET /cart'] }, { ...wifi, status: 'active', badge: 'sees: shop.example, 2 KB' }, server],
        links: path,
        flows: [
          { path: there, tone: 'request', label: 'encrypted request', duration: 1.8 },
          { path: back, tone: 'response', label: 'encrypted response', duration: 1.8, delay: 2 },
        ],
        panel: {
          title: 'The Wi-Fi sees',
          icon: 'Search',
          rows: [
            { text: 'Server IP address', value: 'visible', tone: 'warn' },
            { text: 'Host name (SNI)', value: 'visible', tone: 'warn' },
            { text: 'Size and timing', value: 'visible', tone: 'warn' },
            { text: 'Path, headers, cookies', value: 'hidden', tone: 'good' },
            { text: 'Body', value: 'hidden', tone: 'good' },
          ],
        },
        caption: 'The envelope is sealed, the address is not',
      },
    },
    {
      title: 'Certificates',
      tag: 'concept',
      heading: 'Certificates prove who you are talking to',
      eli5: 'Anyone can stand behind a desk and say "I am the librarian". The real one wears a badge signed by the town hall. The **certificate** is the badge, and the **CA** is the town hall that signs it.',
      body: [
        'Encryption alone is not enough: an attacker could answer in place of the server. A **certificate** closes that gap.',
        'It is a small file that says "this public key belongs to `shop.example`", with start and end dates and a signature from a **certificate authority** (CA). The browser checks the name, the dates and that the signature leads to a CA it trusts. The server also signs the handshake with its private key, and only the real owner can.',
      ],
      keyIdea: 'A certificate binds a domain name to a key and is signed by an authority the browser already trusts.',
      metrics: { status: '200 OK', wire: 'encrypted', setup: '100 ms (TCP + TLS)', conns: '1' },
      scene: {
        nodes: [{ ...browser, status: 'active', badge: 'name, dates, signature: ok' }, wifi, { ...server, status: 'ok', badge: 'cert: shop.example' }, { ...ca, status: 'active' }],
        links: [...path, link('ca', 'server', { style: 'dashed', label: 'signed in advance' })],
        flows: [
          { path: ['ca', 'server'], tone: 'data', label: 'signed certificate', duration: 1.4 },
          { path: back, tone: 'handshake', label: 'certificate', duration: 2, delay: 1.6 },
          { path: there, tone: 'request', label: 'trusted, go on', duration: 2, delay: 3.8 },
        ],
        panel: {
          title: 'What the browser checks',
          icon: 'Shield',
          rows: [
            { text: 'Name matches the site', value: 'shop.example', tone: 'good' },
            { text: 'Today is within the dates', value: 'valid', tone: 'good' },
            { text: 'Signature leads to a trusted CA', value: 'yes', tone: 'good' },
            { text: 'Server proves it holds the key', value: 'handshake signature', tone: 'good' },
          ],
          footer: { text: 'Any failure shows a full-page warning', tone: 'warn' },
        },
        caption: 'The browser checks the badge before it talks',
      },
      code: {
        language: 'bash',
        title: 'Read the certificate a site presents',
        source: `$ openssl s_client -connect shop.example:443 -servername shop.example \\
    </dev/null 2>/dev/null | openssl x509 -noout -subject -issuer -dates \n      -ext subjectAltName

subject=CN = shop.example
issuer=C = US, O = Example Trust, CN = Example Trust CA 1
notBefore=Oct  1 00:00:00 2026 GMT
notAfter=Dec 30 23:59:59 2026 GMT
X509v3 Subject Alternative Name:
    DNS:shop.example, DNS:www.shop.example`,
        highlight: [5, 6, 8, 10],
      },
    },
    {
      title: 'Chain of trust',
      tag: 'concept',
      heading: 'Trust flows down a chain from a root',
      eli5: 'The town hall does not sign every badge itself. It trusts a district office, and the district office signs the librarian\'s badge. You only need to know the town hall.',
      body: [
        'A **root CA** keeps its key offline, so it signs an **intermediate CA**, and the intermediate signs the server\'s certificate. The server sends its certificate plus the intermediate. The browser already holds the root in its **trust store**.',
        'The browser walks the chain up and stops at a root it trusts. Names are matched against the `subjectAltName` field, not the CN. Revoked certificates are caught by CRL or OCSP, which the server can staple to the handshake.',
      ],
      keyIdea: 'A server proves itself through a chain that ends at a root the browser already trusts.',
      metrics: { status: '200 OK', wire: 'encrypted', setup: '100 ms (TCP + TLS)', conns: '1' },
      scene: {
        nodes: [{ ...browser, chips: ['trust store: root'] }, { ...server, status: 'ok', badge: 'cert + intermediate' }, root, inter],
        links: [
          link('root', 'inter', { label: 'signs' }),
          link('inter', 'server', { label: 'signs' }),
        ],
        flows: [
          { path: ['server', 'browser'], tone: 'handshake', label: 'leaf + intermediate', duration: 2 },
        ],
        panel: {
          title: 'The chain',
          icon: 'Route',
          rows: [
            { text: 'Leaf', value: 'shop.example' },
            { text: 'Intermediate', value: 'Example Trust CA 1' },
            { text: 'Root', value: 'in the trust store', tone: 'good' },
            { text: 'Name check', value: 'subjectAltName (SAN)' },
            { text: 'Revocation', value: 'CRL, OCSP, stapling' },
          ],
          footer: { text: 'Missing intermediate: errors on some devices', tone: 'warn' },
        },
        caption: 'Follow the signatures up to a trusted root',
      },
    },
    {
      title: 'Expiry',
      tag: 'case',
      heading: 'Case: the certificate nobody renewed',
      eli5: 'The librarian\'s badge has a date on it. One morning the date has passed, and every visitor refuses to hand over a slip, even though she is standing right there.',
      body: [
        'The classic outage is boring. Nobody renews, the certificate passes its end date, and a healthy site shows every visitor a full-page warning. The servers are fine and the site is still down.',
        '**ACME** clients such as certbot get and renew certificates from authorities like Let\'s Encrypt automatically. Its certificates last 90 days. Renew about two thirds in, and alert when expiry is under 14 days away.',
      ],
      keyIdea: 'An expired certificate takes a site down as surely as a crash. Automate renewal and alert on the expiry date.',
      metrics: { status: 'no response', wire: 'encrypted', setup: 'handshake fails', conns: '0' },
      metricTones: { status: 'bad', setup: 'bad', conns: 'bad' },
      scene: {
        nodes: [{ ...browser, status: 'hot', chips: [{ text: 'CERT_DATE_INVALID', tone: 'bad' }] }, { ...server, status: 'down', badge: 'cert expired Dec 30' }, { ...ca, status: 'active' }],
        links: [link('browser', 'server', { label: 'handshake refused', labelTone: 'warn' }), link('ca', 'server', { style: 'dashed', label: 'ACME renew' })],
        flows: [
          { path: ['browser', 'server'], tone: 'handshake', label: 'ClientHello', duration: 1.6 },
          { path: ['server', 'browser'], tone: 'error', label: 'expired certificate', duration: 1.6, delay: 1.8 },
          { path: ['ca', 'server'], tone: 'data', label: 'new certificate', duration: 1.6, delay: 3.8 },
        ],
        panel: {
          title: 'A 90-day certificate',
          icon: 'Clock',
          rows: [
            { text: 'Day 0', value: 'issued' },
            { text: 'Day 60', value: 'auto-renew runs', tone: 'good' },
            { text: 'Day 76', value: 'alert if not renewed', tone: 'warn' },
            { text: 'Day 90', value: 'expires, site down', tone: 'bad' },
          ],
        },
        caption: 'Healthy servers, unreachable site',
      },
    },
    {
      title: 'Resumption',
      tag: 'tradeoff',
      heading: 'Do not pay for the full handshake twice',
      eli5: 'The first visit takes a while: hello, badge check, secret code. If you stay at the desk, you never repeat it. If you come back tomorrow, the librarian gives you a ticket for a shorter hello.',
      body: [
        'A full handshake costs a round trip and CPU for signature checks. **Connection reuse** (keep-alive, HTTP/2) avoids it: the second request pays no setup. When the connection has closed, **session resumption** helps.',
        'After the first handshake the server hands over a **session ticket**. On the next connection the browser presents it and both sides skip the certificate step. In TLS 1.3 that is still one round trip, with much less work.',
      ],
      keyIdea: 'Reuse the connection when you can, resume the session when you cannot. Both skip the expensive certificate step.',
      metrics: { status: '200 OK', wire: 'encrypted', setup: '100 ms (less CPU)', conns: '1' },
      scene: {
        nodes: [{ ...browser, status: 'active', badge: 'has session ticket' }, wifi, { ...server, status: 'ok', badge: 'skips certificate step' }],
        links: path,
        flows: [
          { path: there, tone: 'handshake', label: 'hello + ticket', duration: 1.6 },
          { path: back, tone: 'handshake', label: 'resumed', duration: 1.6, delay: 1.8 },
          { path: there, tone: 'request', label: 'encrypted request', count: 3, duration: 1.6, delay: 3.6 },
        ],
        panel: {
          title: 'Cost of the next request',
          icon: 'Timer',
          rows: [
            { text: 'Reused connection', value: '0 ms', tone: 'good' },
            { text: 'Resumed session', value: '100 ms, less CPU', tone: 'good' },
            { text: 'Full handshake', value: '100 ms, certificate checked', tone: 'warn' },
          ],
        },
        caption: 'A returning browser skips most of the hello',
      },
    },
    {
      title: '0-RTT',
      tag: 'tradeoff',
      heading: '0-RTT trades safety for speed',
      eli5: 'With your ticket you slide the slip across the desk together with your hello, before the librarian answers. Fast. But a sneaky person could copy that slip and hand it in again.',
      body: [
        'TLS 1.3 allows **0-RTT**: the browser sends its first request together with the ticket, with no TLS wait. Setup drops to the TCP round trip alone.',
        'The catch: an attacker can record that first packet and replay it. So 0-RTT is only safe for requests that are harmless to repeat, such as a `GET`. Servers often reject 0-RTT for a `POST`.',
      ],
      keyIdea: 'Pay for the full handshake once. Use 0-RTT only for requests that are safe to replay.',
      metrics: { status: '200 OK', wire: 'encrypted', setup: '50 ms (0-RTT)', conns: '1' },
      metricTones: { setup: 'good' },
      scene: {
        nodes: [{ ...browser, status: 'active', chips: ['GET /products/42 + ticket'] }, { ...wifi, status: 'hot', badge: 'records the packet' }, { ...server, status: 'ok' }],
        links: [link('browser', 'wifi'), link('wifi', 'server', { label: 'replay possible', labelTone: 'warn' })],
        flows: [
          { path: there, tone: 'request', label: 'hello + ticket + request', duration: 1.8 },
          { path: ['wifi', 'server'], tone: 'error', label: 'replayed copy', duration: 1.4, delay: 2.2 },
        ],
        panel: {
          title: 'Safe to send as 0-RTT?',
          icon: 'Repeat',
          rows: [
            { text: 'GET /products/42', value: 'yes', tone: 'good' },
            { text: 'GET /cart', value: 'yes', tone: 'good' },
            { text: 'POST /orders', value: 'no, replay buys twice', tone: 'bad' },
            { text: 'POST /payments', value: 'no', tone: 'bad' },
          ],
        },
        caption: 'Speed against safety, again',
      },
    },
    {
      title: 'HSTS',
      tag: 'concept',
      heading: 'The first request is the weak one, so tell browsers to skip it',
      eli5: 'People often walk up and just say "the library". The first knock may be answered in the open hall before the doorman sends them to the secret-code door. A sign says "always use the code door".',
      body: [
        'A user types `shop.example` and the browser tries plain HTTP first. The server answers with a `301` to `https://`. That first request is exposed, and an attacker can intercept it and keep the user on HTTP.',
        '`Strict-Transport-Security: max-age=31536000` tells the browser to use HTTPS for this site for a year, without trying HTTP. A preload list builds the rule into browsers for the very first visit.',
      ],
      keyIdea: 'Redirect HTTP to HTTPS, then add HSTS so browsers never try plain HTTP for your site again.',
      metrics: { status: '301 then 200', wire: 'plain, then encrypted', setup: '50 ms (TCP)' },
      metricTones: { wire: 'warn' },
      scene: {
        nodes: [{ ...browser, status: 'active', chips: ['http://shop.example'] }, { ...wifi, status: 'hot', badge: 'sees the first request' }, { ...server, status: 'active' }],
        links: [link('browser', 'wifi'), link('wifi', 'server', { label: 'port 80, plain', labelTone: 'warn' })],
        flows: [
          { path: there, tone: 'request', label: 'GET http://shop.example', duration: 1.6 },
          { path: back, tone: 'error', label: '301 to https://', duration: 1.6, delay: 1.8 },
          { path: there, tone: 'handshake', label: 'HTTPS from now on', duration: 1.6, delay: 3.6 },
        ],
        panel: {
          title: 'Close the gap',
          icon: 'Shield',
          code: 'HTTP/1.1 301 Moved Permanently\nLocation: https://shop.example/\n\n# on every HTTPS response:\nStrict-Transport-Security:\n  max-age=31536000; includeSubDomains',
          footer: { text: 'After one visit, no plain request is sent', tone: 'good' },
        },
        caption: 'Only the very first visit is exposed',
      },
    },
    {
      title: 'Termination',
      tag: 'case',
      heading: 'Many sites decrypt at the load balancer',
      eli5: 'A guard at the door speaks the secret code with visitors, then hands each slip to the librarians inside in plain words. The librarians never learn the code, and the guard keeps one badge.',
      body: [
        '**TLS termination** means the **load balancer** holds the certificate, does the handshake and sends plain HTTP to the servers behind it. The servers skip the crypto work, and one place renews certificates.',
        'Traffic behind the balancer is plain, so keep it private, re-encrypt to the backend, or pass TLS through untouched. Backends lose the original scheme and client IP, so the balancer adds `X-Forwarded-Proto` and `X-Forwarded-For`.',
      ],
      keyIdea: 'Terminate TLS once at the edge for simplicity. Re-encrypt or pass through when the inside network is not trusted.',
      metrics: { status: '200 OK', wire: 'encrypted, then plain', setup: '100 ms (TCP + TLS)', conns: '1' },
      scene: {
        nodes: [{ ...browser, status: 'active' }, { ...lb, status: 'active', badge: 'TLS ends here' }, { ...server, status: 'ok', chips: ['GET /cart'] }],
        links: [link('browser', 'lb', { label: 'HTTPS, encrypted' }), link('lb', 'server', { label: 'HTTP, private network', labelTone: 'warn' })],
        flows: [
          { path: ['browser', 'lb'], tone: 'request', label: 'encrypted GET /cart', duration: 1.6 },
          { path: ['lb', 'server'], tone: 'request', label: 'plain GET /cart', duration: 1.6, delay: 1.8 },
          { path: ['server', 'lb', 'browser'], tone: 'response', label: '200 OK', duration: 2, delay: 3.6 },
        ],
        panel: {
          title: 'Where TLS ends',
          icon: 'Scale',
          rows: [
            { text: 'Browser to balancer', value: 'TLS', tone: 'good' },
            { text: 'Balancer to server', value: 'plain HTTP', tone: 'warn' },
            { text: 'Certificate lives on', value: 'the balancer' },
            { text: 'Stricter setups', value: 're-encrypt or passthrough' },
            { text: 'Service to service', value: 'mTLS: both sides show certificates', tone: 'good' },
          ],
        },
        caption: 'One place holds the certificate',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'A simple conversation inside a locked tunnel',
      eli5: 'You fill in a slip, the librarian stamps it and hands back a book. You show your card each time, you both speak in a secret code, and the badge proves the **web server** is the real librarian.',
      body: [
        '**TLS** adds one round trip to agree on a key, then encrypts and seals every byte. A **certificate** chain ending at a trusted root proves the server\'s identity. Expiry and renewal are the usual outage.',
        'Reused connections skip setup entirely. Resumption keeps the round trip but skips the certificate work, and 0-RTT removes the TLS round trip for replay-safe requests. HSTS keeps browsers off plain HTTP, and the load balancer often terminates TLS.',
      ],
      keyIdea: 'HTTP is the conversation, TLS is the envelope. Know the cost of a new connection and the ways to avoid paying it.',
      metrics: { status: '200 OK', wire: 'encrypted', setup: '0 ms (reused)', conns: '1' },
      metricTones: { wire: 'good', setup: 'good' },
      scene: {
        nodes: [browser, { ...wifi, badge: 'sees only noise' }, { ...server, status: 'ok' }],
        links: path,
        flows: [
          { path: there, tone: 'request', label: 'GET /cart', count: 2, duration: 2 },
          { path: back, tone: 'response', label: '200 OK', count: 2, duration: 2, delay: 2.2 },
        ],
        panel: {
          title: 'Part 2 in five lines',
          icon: 'List',
          rows: [
            { text: 'Promises', value: 'privacy, integrity, identity' },
            { text: 'Key', value: 'agreed in public, fresh each time' },
            { text: 'Cost', value: '+1 round trip' },
            { text: 'Identity', value: 'certificate chain to a root' },
            { text: 'Cheaper', value: 'reuse, resumption, 0-RTT' },
          ],
        },
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
