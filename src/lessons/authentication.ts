import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const browser: SceneNode = { id: 'browser', kind: 'client', at: at(-5.4, 0), label: 'browser', sub: 'user 42' };
const gw: SceneNode = { id: 'gw', kind: 'block', at: at(-1.8, 0), label: 'API gateway', icon: 'Network', tint: 'violet' };
const auth: SceneNode = { id: 'auth', kind: 'block', at: at(2, -3.4), label: 'auth service', icon: 'KeyRound', tint: 'teal' };
const orders: SceneNode = { id: 'orders', kind: 'block', at: at(2, 3.4), label: 'orders API', icon: 'ShoppingBag', tint: 'amber' };
const userdb: SceneNode = { id: 'userdb', kind: 'db', at: at(5.6, -3.4), label: 'users DB' };
const sessions: SceneNode = { id: 'sessions', kind: 'cache', at: at(5.6, -3.4), label: 'session store', sub: 'Redis' };

const coreLinks = [link('browser', 'gw'), link('gw', 'auth'), link('gw', 'orders')];

export const authentication: Lesson = {
  id: 'authentication',
  title: 'Authentication and authorization (part 1)',
  tagline: 'Prove who is calling and do it on every request without a database hit. Part 2 covers OAuth, SSO and access control.',
  minutes: 15,
  level: 'Intermediate',
  learn: [
    'Authentication (who you are) versus authorization (what you may do)',
    'Storing passwords as slow, salted hashes, and defending the login endpoint',
    'Second factors: one-time codes and passkeys',
    'Server-side sessions and cookie flags versus signed JWTs',
    'Verifying a JWT at the gateway, and the rules that keep it safe',
    'Expiry, refresh token rotation and the revocation trade-off',
  ],
  metrics: [
    { key: 'lookup', label: 'Auth lookups', icon: 'Database' },
    { key: 'check', label: 'Check cost', icon: 'Cpu' },
    { key: 'life', label: 'Credential life', icon: 'Timer' },
    { key: 'revoke', label: 'Revoke delay', icon: 'Clock' },
  ],
  steps: [
    {
      title: 'Who asks?',
      tag: 'problem',
      heading: 'The API believes whatever the client says',
      eli5: 'A hotel hands a room key to anyone who says a room number. The **front desk** never checks who is asking, so any stranger can walk into your room.',
      body: [
        'The shop serves **50,000 requests per second**. The orders call is `GET /orders?user=42`. HTTP is stateless, so each request arrives with no memory of the one before it. Change 42 to 43 and you read a stranger\'s orders.',
      ],
      keyIdea: 'Nothing in a bare HTTP request proves who sent it. The server needs a way to know.',
      metrics: { lookup: 'none', check: 'none', life: '-', revoke: '-' },
      metricTones: { check: 'bad' },
      scene: {
        nodes: [
          { ...browser, sub: 'claims to be 43', chips: [{ text: 'GET /orders?user=43', tone: 'warn' }] },
          { ...orders, status: 'hot', badge: 'no identity check' },
        ],
        links: [link('browser', 'orders', { label: 'HTTPS', labelTone: 'warn' })],
        flows: [
          { path: ['browser', 'orders'], tone: 'request', label: 'GET /orders?user=43', duration: 1.4 },
          { path: ['orders', 'browser'], tone: 'error', label: "someone else's orders", duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'What the server sees',
          icon: 'Search',
          rows: [
            { text: 'user parameter', value: '43' },
            { text: 'proof of identity', value: 'none', tone: 'bad' },
            { text: 'cookie or token', value: 'none', tone: 'bad' },
          ],
          footer: { text: 'Anyone can read anyone', tone: 'bad' },
        },
        caption: 'Nothing ties the request to a person',
      },
    },
    {
      title: 'Two questions',
      tag: 'concept',
      heading: 'Authentication and authorization are separate checks',
      eli5: 'At the hotel, the **front desk** first asks "who are you?" and later each door asks "may you come in here?". Those are two different questions with two different answers.',
      body: [
        '**Authentication** asks who you are. A failure is a `401 Unauthorized`. **Authorization** asks what you may do. A failure is a `403 Forbidden`. A customer asking for the admin page is authenticated and still not allowed.',
        'Sending the password with every request would answer the first question, but it exposes the password 50,000 times a second. Prove identity once, then carry a cheaper proof.',
      ],
      keyIdea: 'Authentication proves who is calling. Authorization decides what that caller may do. Every request needs both.',
      metrics: { lookup: 'none', check: 'none', life: '-', revoke: '-' },
      scene: {
        nodes: [
          { ...browser, sub: 'customer' },
          { ...gw, status: 'active', chips: [{ text: '401 who are you?', tone: 'warn' }, { text: '403 not allowed', tone: 'bad' }] },
          { ...orders, status: 'dim' },
        ],
        links: [link('browser', 'gw'), link('gw', 'orders')],
        flows: [
          { path: ['browser', 'gw'], tone: 'request', label: 'no credentials', duration: 1.2 },
          { path: ['gw', 'browser'], tone: 'error', label: '401', duration: 1.2, delay: 1.3 },
          { path: ['browser', 'gw'], tone: 'request', label: 'GET /admin', duration: 1.2, delay: 3 },
          { path: ['gw', 'browser'], tone: 'error', label: '403', duration: 1.2, delay: 4.3 },
        ],
        panel: {
          title: 'Two checks, two codes',
          icon: 'Shield',
          rows: [
            { text: 'Authentication', value: 'who are you?' },
            { text: 'failure', value: '401', tone: 'warn' },
            { text: 'Authorization', value: 'what may you do?' },
            { text: 'failure', value: '403', tone: 'bad' },
          ],
        },
        caption: 'Unknown caller, or known caller who is not allowed',
      },
    },
    {
      title: 'Salted hash',
      tag: 'concept',
      heading: 'Store a salted hash, never the password',
      eli5: 'The **front desk** does not keep a copy of your secret word. It keeps a scrambled scribble that cannot be turned back, and checks that your word makes the same scribble.',
      body: [
        'Login starts with a password, so the users table is the first thing an intruder wants. If it holds plain passwords, one leaked backup exposes every account, and every other site where people reused that password.',
        'Store a **hash**: a one-way function of the password. Add a random **salt** per user so two people with the same password get different hashes and precomputed tables are useless.',
      ],
      keyIdea: 'The database should hold a salted hash, so a leak does not reveal passwords or show who shares one.',
      metrics: { lookup: '1 at login', check: '-', life: '-', revoke: '-' },
      scene: {
        nodes: [
          { ...browser, sub: 'password: hunter2' },
          { ...auth, status: 'active', badge: 'hash + salt' },
          { ...userdb, badge: 'hashes only' },
        ],
        links: [link('browser', 'auth'), link('auth', 'userdb')],
        flows: [
          { path: ['browser', 'auth'], tone: 'request', label: 'POST /login', duration: 1.4 },
          { path: ['auth', 'userdb'], tone: 'request', label: 'store hash', duration: 1.2, delay: 1.5 },
        ],
        panel: {
          title: 'users table',
          icon: 'Table',
          rows: [
            { text: 'maya   plain', value: 'hunter2', tone: 'bad' },
            { text: 'dev    plain', value: 'hunter2', tone: 'bad' },
            { text: 'maya   salted', value: '$argon2id$...a9', tone: 'good' },
            { text: 'dev    salted', value: '$argon2id$...3f', tone: 'good' },
          ],
          footer: { text: 'Same password, different hashes', tone: 'good' },
        },
        caption: 'The database never keeps the password itself',
      },
    },
    {
      title: 'Slow hash',
      tag: 'concept',
      heading: 'Make the hash slow on purpose',
      eli5: 'The scribble machine at the **front desk** is deliberately slow. One guess takes a moment, so a thief with a stolen book needs forever to try many words.',
      body: [
        'A fast hash like SHA-256 lets an attacker with the leaked table try billions of guesses per second. Use a deliberately slow, memory-hard function built for passwords, such as **Argon2id** or bcrypt, tuned so one check costs roughly 100 ms.',
        'At login, hash the submitted password with the stored salt and compare. The cost is paid once per login, and the attacker pays it for every guess.',
      ],
      keyIdea: 'A password hash should be salted and slow, so a stolen table is expensive to crack one account at a time.',
      metrics: { lookup: '1 at login', check: '~100 ms hash', life: '-', revoke: '-' },
      metricTones: { check: 'good' },
      scene: {
        nodes: [
          { ...browser, chips: ['POST /login'] },
          { ...auth, status: 'active', badge: 'Argon2id verify', load: 70 },
          { ...userdb, badge: 'salt + hash only' },
        ],
        links: [link('browser', 'auth'), link('auth', 'userdb')],
        flows: [
          { path: ['browser', 'auth'], tone: 'request', label: 'POST /login', duration: 1.4 },
          { path: ['auth', 'userdb'], tone: 'request', label: 'get hash', duration: 0.9, delay: 1.5 },
          { path: ['userdb', 'auth'], tone: 'response', label: '$argon2id$...', duration: 0.9, delay: 2.5 },
        ],
        panel: {
          title: 'Guesses per second on a stolen table',
          icon: 'Gauge',
          rows: [
            { text: 'SHA-256', value: 'billions', tone: 'bad' },
            { text: 'bcrypt', value: 'thousands', tone: 'good' },
            { text: 'Argon2id, ~100 ms', value: 'about 10 per core', tone: 'good' },
          ],
        },
        caption: 'Slow for an attacker, fast enough for one login',
      },
      code: {
        language: 'python',
        title: 'Hashing and verifying with Argon2id (argon2-cffi)',
        source: `from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

ph = PasswordHasher()        # Argon2id, random salt per hash

def register(email, password):
    # The output embeds algorithm, cost settings, salt and hash.
    db.execute("INSERT INTO users (email, pw_hash) VALUES (%s, %s)",
               email, ph.hash(password))

def login(email, password):
    user = db.query_one("SELECT id, pw_hash FROM users WHERE email = %s", email)
    if user is None:
        return None
    try:
        ph.verify(user.pw_hash, password)     # slow on purpose
    except VerifyMismatchError:
        return None
    if ph.check_needs_rehash(user.pw_hash):   # cost settings were raised
        db.execute("UPDATE users SET pw_hash = %s WHERE id = %s",
                   ph.hash(password), user.id)
    return user.id`,
        highlight: [4, 9, 16, 19],
      },
      quiz: {
        question: 'Why is Argon2id a better choice than SHA-256 for storing passwords?',
        options: [
          'It produces shorter hashes that fit in the database',
          'It is deliberately slow and memory-hard, so each guess against a stolen table is expensive',
          'It can be reversed when a user forgets their password',
          'It removes the need for a salt',
        ],
        answer: 1,
        explain: 'Password hashing wants to be slow. A fast hash lets an attacker try billions of guesses per second. Argon2id costs about 100 ms per check, which no user notices at login but ruins bulk guessing. It is not reversible and it still uses a salt.',
      },
    },
    {
      title: 'Login abuse',
      tag: 'concept',
      heading: 'Defend the login endpoint itself',
      eli5: 'Even with a slow scribble machine, a thief can queue at the **front desk** and try one word after another. The desk slows people down after a few wrong tries.',
      body: [
        'Attackers rarely crack hashes. They replay leaked email and password pairs from other sites, a trick called **credential stuffing**, and they guess common passwords across many accounts. Put a **rate limit** on `/login` per account and per IP, and add a short delay after repeated failures.',
        'Return the same message for a wrong email and a wrong password, so the endpoint does not reveal which accounts exist.',
      ],
      keyIdea: 'Slow hashing protects a stolen table. Rate limits and uniform errors protect the live login endpoint.',
      metrics: { lookup: '1 at login', check: '~100 ms hash', life: '-', revoke: '-' },
      scene: {
        nodes: [
          { ...browser, label: 'bot', sub: 'leaked pairs', status: 'hot', chips: [{ text: 'POST /login x 900/s', tone: 'bad' }] },
          { ...gw, status: 'active', badge: '5 tries per 15 min' },
          { ...auth, load: 35 },
        ],
        links: [link('browser', 'gw'), link('gw', 'auth')],
        flows: [
          { path: ['browser', 'gw'], tone: 'request', label: 'password guess', count: 3, duration: 1.2 },
          { path: ['gw', 'browser'], tone: 'error', label: '429 slow down', duration: 1.2, delay: 1.4 },
        ],
        panel: {
          title: 'Login endpoint rules',
          icon: 'Shield',
          rows: [
            { text: 'limit per account', value: '5 per 15 min', tone: 'good' },
            { text: 'limit per IP', value: '20 per min', tone: 'good' },
            { text: 'wrong email or password', value: 'same message', tone: 'good' },
          ],
        },
        caption: 'The gateway turns a flood of guesses into 429s',
      },
    },
    {
      title: 'Second factor',
      tag: 'concept',
      heading: 'A second factor survives a stolen password',
      eli5: 'Besides your secret word, the **front desk** also asks you to show the little gadget you carry. A thief who learned your word still does not have your gadget.',
      body: [
        '**Multi-factor authentication** adds something you have to something you know. A **TOTP** app and the server share a secret once, then both compute a 6 digit code from that secret and the current 30 second window. SMS codes are weaker, since phone numbers get hijacked.',
        '**Passkeys** (WebAuthn) replace the password. The device keeps a private key, the server stores only the public key, and the browser signs a challenge for that exact site, so a fake login page gets nothing to steal.',
      ],
      keyIdea: 'A second factor makes a stolen password insufficient. Passkeys also make phishing useless.',
      metrics: { lookup: '1 at login', check: '~100 ms hash', life: '-', revoke: '-' },
      scene: {
        nodes: [
          { ...browser, sub: 'password ok' },
          { ...auth, status: 'active', badge: 'code or passkey' },
          { id: 'phone', kind: 'phone', at: at(2, 3.4), label: 'authenticator', sub: '30 s codes', status: 'active' },
        ],
        links: [link('browser', 'auth'), link('phone', 'browser', { style: 'dashed', label: 'human types code' })],
        flows: [
          { path: ['browser', 'auth'], tone: 'request', label: 'password', duration: 1.2 },
          { path: ['auth', 'browser'], tone: 'handshake', label: 'need code', duration: 1.2, delay: 1.3 },
          { path: ['browser', 'auth'], tone: 'request', label: '481 207', duration: 1.2, delay: 2.6 },
          { path: ['auth', 'browser'], tone: 'response', label: 'logged in', duration: 1.2, delay: 3.9 },
        ],
        panel: {
          title: 'Factors, weakest to strongest',
          icon: 'KeyRound',
          rows: [
            { text: 'SMS code', value: 'phishable', tone: 'warn' },
            { text: 'TOTP app', value: 'phishable', tone: 'warn' },
            { text: 'Passkey (WebAuthn)', value: 'phishing resistant', tone: 'good' },
          ],
        },
        caption: 'Something you know plus something you have',
      },
    },
    {
      title: 'Sessions',
      tag: 'concept',
      heading: 'Server-side sessions: a random ID in a cookie',
      eli5: 'After checking you in, the **front desk** gives you a numbered ticket and writes your name next to that number in its book. Each time you come back, staff look the number up in the book.',
      body: [
        'After a good login the auth service creates a **session**: a long random ID, stored in Redis next to the user ID and an expiry. The ID goes back to the browser in a cookie, and the browser attaches it to every later request.',
        'The ID itself means nothing, so stealing a copy of some other service\'s data reveals nothing about it.',
      ],
      keyIdea: 'A session keeps the state on the server. The client holds only a random pointer to it.',
      metrics: { lookup: '1 at login', check: '-', life: '14 days', revoke: 'instant' },
      scene: {
        nodes: [browser, { ...auth, status: 'active' }, { ...sessions, status: 'active', badge: 'sess:9f3c = user 42' }],
        links: [link('browser', 'auth'), link('auth', 'sessions')],
        flows: [
          { path: ['browser', 'auth'], tone: 'request', label: 'POST /login', duration: 1.3 },
          { path: ['auth', 'sessions'], tone: 'request', label: 'SET sess:9f3c', duration: 1, delay: 1.4 },
          { path: ['auth', 'browser'], tone: 'response', label: 'Set-Cookie: sid=9f3c...', duration: 1.4, delay: 2.5 },
        ],
        panel: {
          title: 'One row in Redis',
          icon: 'Database',
          rows: [
            { text: 'key', value: 'sess:9f3c...' },
            { text: 'user', value: '42' },
            { text: 'expires', value: 'in 14 days' },
          ],
          footer: { text: 'Random ID, no meaning on its own', tone: 'muted' },
        },
        caption: 'Login creates a row and returns its ID',
      },
    },
    {
      title: 'Session cost',
      tag: 'tradeoff',
      heading: 'Every request pays one session lookup',
      eli5: 'Each time you walk up to a door, the guard phones the **front desk** to look your number up in the book. It works well, but the desk phone never stops ringing.',
      body: [
        'Every one of the 50,000 requests per second reads the session store before any real work happens, and that store is now a dependency of every endpoint.',
        'The upside is control: delete the row and the user is logged out on the next request.',
      ],
      keyIdea: 'Sessions buy instant control with a lookup on every request.',
      metrics: { lookup: '50,000/s', check: '~1 ms Redis', life: '14 days', revoke: 'instant' },
      metricTones: { lookup: 'bad', revoke: 'good' },
      scene: {
        nodes: [
          { ...browser, chips: ['Cookie: sid=9f3c...'] },
          { ...gw, status: 'active' },
          { ...sessions, status: 'hot', load: 88, badge: '50,000 reads/s' },
          { ...orders, status: 'active', chips: ['X-User-Id: 42'] },
        ],
        links: [link('browser', 'gw'), link('gw', 'sessions'), link('gw', 'orders')],
        flows: [
          { path: ['browser', 'gw'], tone: 'request', label: 'Cookie: sid=9f3c...', duration: 1 },
          { path: ['gw', 'sessions', 'gw'], tone: 'request', label: 'GET sess:9f3c', duration: 1.4, delay: 1.1 },
          { path: ['gw', 'orders'], tone: 'request', label: 'user 42', duration: 1, delay: 2.7 },
        ],
        panel: {
          title: 'Sessions at 50,000 req/s',
          icon: 'Table',
          rows: [
            { text: 'store reads', value: '50,000/s', tone: 'bad' },
            { text: 'read cost', value: '~1 ms' },
            { text: 'log out a user', value: 'delete 1 row', tone: 'good' },
          ],
        },
        caption: 'The store sits in front of every endpoint',
      },
    },
    {
      title: 'Cookie flags',
      tag: 'concept',
      heading: 'Three flags protect the session cookie',
      eli5: 'The ticket the **front desk** hands out has rules printed on it: do not show it to the pool staff, only use it inside the hotel, and do not hand it to strangers who walk up.',
      body: [
        '`HttpOnly` hides the cookie from page scripts, so an XSS bug cannot read it. `Secure` sends it only over HTTPS. `SameSite=Lax` stops most cross-site requests from carrying it, which blocks most **CSRF**, where another site tricks the browser into acting as you.',
        'For state-changing requests that still need cross-site use, add a CSRF token the page must echo back.',
      ],
      keyIdea: 'Set HttpOnly, Secure and SameSite on every session cookie. They cost nothing and close the common holes.',
      metrics: { lookup: '50,000/s', check: '~1 ms Redis', life: '14 days', revoke: 'instant' },
      scene: {
        nodes: [
          { ...browser, status: 'active', chips: ['Cookie: sid=9f3c...'] },
          { ...gw, status: 'active', badge: 'sid checked' },
          { id: 'evil', kind: 'block', at: at(-1.8, 6.4), label: 'evil.example', icon: 'Bug', tint: 'red', status: 'hot' },
        ],
        links: [link('browser', 'gw'), link('evil', 'gw', { style: 'dashed', label: 'cross-site POST', labelTone: 'warn' })],
        flows: [
          { path: ['browser', 'gw'], tone: 'request', label: 'same site, cookie sent', duration: 1.3 },
          { path: ['evil', 'gw'], tone: 'request', label: 'forged POST', duration: 1.3, delay: 1.5 },
          { path: ['gw', 'evil'], tone: 'error', label: 'no cookie, 401', duration: 1.3, delay: 2.9 },
        ],
        panel: {
          title: 'The Set-Cookie header',
          icon: 'List',
          code: 'Set-Cookie: sid=9f3c...;\n  HttpOnly;      no JS access\n  Secure;        HTTPS only\n  SameSite=Lax;  blocks most CSRF\n  Max-Age=1209600',
        },
        caption: 'The forged request arrives without the cookie',
      },
    },
    {
      title: 'JWT anatomy',
      tag: 'concept',
      heading: 'A JWT carries the claims and a signature',
      eli5: 'Now the **front desk** prints a card that says your name, your room and when it stops working, then stamps it with a seal only the desk owns. Anyone can read the card. Nobody can fake the seal.',
      body: [
        'A **JSON Web Token** moves the session data into the token. It has three base64url parts joined by dots: a **header** (the signing algorithm and key ID), a **payload** of **claims** (who, for which audience, until when) and a **signature** over the first two parts.',
      ],
      keyIdea: 'A JWT is a self-contained statement about the caller: header, claims and a signature.',
      metrics: { lookup: '1 at login', check: 'sign once', life: '15 min', revoke: '-' },
      scene: {
        nodes: [
          browser,
          { ...gw, status: 'dim' },
          { ...auth, status: 'active', badge: 'signs the token' },
        ],
        links: [link('browser', 'gw'), link('gw', 'auth')],
        flows: [
          { path: ['browser', 'gw', 'auth'], tone: 'request', label: 'POST /login', duration: 1.5 },
          { path: ['auth', 'gw', 'browser'], tone: 'response', label: 'header.payload.signature', duration: 1.8, delay: 1.7 },
        ],
        panel: {
          title: 'Three parts, joined by dots',
          icon: 'Package',
          rows: [
            { text: 'header', value: 'alg, kid' },
            { text: 'payload', value: 'sub, aud, exp, roles' },
            { text: 'signature', value: 'over header + payload' },
          ],
        },
        caption: 'Login returns a signed token instead of a pointer',
      },
      code: {
        language: 'json',
        title: 'A decoded access token (header, then payload)',
        source: `{
  "alg": "RS256",
  "kid": "2026-11-a",
  "typ": "JWT"
}
{
  "iss": "https://auth.shop.example",
  "sub": "42",
  "aud": "shop-api",
  "iat": 1795000000,
  "exp": 1795000900,
  "roles": ["customer"]
}`,
        highlight: [2, 7, 8, 9, 11],
      },
    },
    {
      title: 'Signing keys',
      tag: 'concept',
      heading: 'Sign with a private key, verify with a public one',
      eli5: 'Only the **front desk** owns the stamp that makes the seal. Every guard has a picture of what a real seal looks like, so guards can check a card but cannot print one.',
      body: [
        'The auth service signs with a private key. With an asymmetric algorithm such as `RS256` or `ES256`, every other service only needs the public key to verify, so a breach of one API leaks no signing power.',
        'Change one character of the payload and the signature no longer matches.',
      ],
      keyIdea: 'Only the issuer can sign. Anyone with the public key can verify, and any edit breaks the signature.',
      metrics: { lookup: '1 at login', check: 'sign once', life: '15 min', revoke: '-' },
      scene: {
        nodes: [
          { ...auth, status: 'active', badge: 'private key' },
          { ...gw, status: 'ok', badge: 'public key' },
          { ...browser, label: 'attacker', sub: 'edits payload', status: 'hot' },
        ],
        links: [link('auth', 'gw', { style: 'dashed', label: 'public key (JWKS)' }), link('browser', 'gw')],
        flows: [
          { path: ['auth', 'gw'], tone: 'data', label: 'public key', duration: 1.4 },
          { path: ['browser', 'gw'], tone: 'request', label: 'payload: roles admin', duration: 1.3, delay: 1.6 },
          { path: ['gw', 'browser'], tone: 'error', label: '401 bad signature', duration: 1.3, delay: 3 },
        ],
        panel: {
          title: 'Who can do what',
          icon: 'KeyRound',
          rows: [
            { text: 'private key', value: 'auth service only', tone: 'good' },
            { text: 'public key', value: 'any service' },
            { text: 'edited payload', value: 'rejected', tone: 'good' },
          ],
        },
        caption: 'A forged payload fails the signature check',
      },
    },
    {
      title: 'Not encrypted',
      tag: 'concept',
      heading: 'A JWT is signed, and anyone can still read it',
      eli5: 'The card has a seal, but it is printed on clear plastic. A guard can verify it and so can a stranger who finds it, so the desk never writes secrets on it.',
      body: [
        'A JWT is signed. It is not encrypted. Anyone holding it can decode the payload, so never put a password, a card number or anything private in it.',
        'Keep it small too, because it rides on every request. A token with 40 claims adds bytes to all 50,000 requests per second.',
      ],
      keyIdea: 'Treat a JWT payload as public. Put only IDs and coarse roles in it.',
      metrics: { lookup: '1 at login', check: 'sign once', life: '15 min', revoke: '-' },
      scene: {
        nodes: [
          { ...browser, label: 'anyone', sub: 'holds the token', chips: ['eyJhbGciOiJSUzI1NiJ9...'] },
          { id: 'decoder', kind: 'block', at: at(-1.8, 0), label: 'base64 decode', icon: 'FileCode', tint: 'gray', status: 'active' },
        ],
        links: [link('browser', 'decoder')],
        flows: [{ path: ['browser', 'decoder'], tone: 'request', label: 'decode, no key needed', duration: 1.5 }],
        panel: {
          title: 'Readable by anyone',
          icon: 'FileJson',
          rows: [
            { text: 'sub', value: '42', tone: 'good' },
            { text: 'roles', value: 'customer', tone: 'good' },
            { text: 'password', value: 'never here', tone: 'bad' },
            { text: 'card number', value: 'never here', tone: 'bad' },
          ],
          footer: { text: 'Signed means tamper proof, not secret', tone: 'warn' },
        },
        caption: 'Decoding needs no key at all',
      },
    },
    {
      title: 'Gateway check',
      tag: 'concept',
      heading: 'The gateway verifies the signature with no database call',
      eli5: 'The **door guard** knows what the real seal looks like. The guard checks the seal and the date on your card right at the door, without phoning the front desk.',
      body: [
        'The gateway from the API gateway lesson holds the auth service\'s **public key**. For each request it checks the signature, then `exp`, `iss` and `aud`. That is CPU work measured in fractions of a millisecond, with no network hop. The 50,000 session reads per second drop to zero.',
        'After the check it forwards a trusted header such as `X-User-Id: 42`. Services behind the gateway must only be reachable through it, or anyone could forge that header.',
      ],
      keyIdea: 'Verifying a signature needs only a public key, so identity checks scale with CPU and not with a shared store.',
      metrics: { lookup: '0/s', check: '<1 ms CPU', life: '15 min', revoke: 'up to 15 min' },
      metricTones: { lookup: 'good', check: 'good', revoke: 'warn' },
      scene: {
        nodes: [
          { ...browser, chips: ['Bearer eyJ...'] },
          { ...gw, status: 'ok', badge: 'signature ok · user 42', load: 20 },
          { ...auth, status: 'dim' },
          { ...orders, status: 'active', chips: ['X-User-Id: 42'] },
        ],
        links: coreLinks,
        flows: [
          { path: ['browser', 'gw'], tone: 'request', label: 'Bearer eyJ...', duration: 1 },
          { path: ['gw', 'orders'], tone: 'request', label: 'verified', duration: 1, delay: 1.1 },
          { path: ['orders', 'gw', 'browser'], tone: 'response', label: '200', duration: 1.6, delay: 2.2 },
          { path: ['browser', 'gw'], tone: 'request', label: 'expired token', duration: 1, delay: 4 },
          { path: ['gw', 'browser'], tone: 'error', label: '401', duration: 1, delay: 5.1 },
        ],
        panel: {
          title: 'Checks at the gateway',
          icon: 'Shield',
          rows: [
            { text: 'signature', value: 'public key', tone: 'good' },
            { text: 'exp', value: 'not past', tone: 'good' },
            { text: 'iss', value: 'auth.shop.example', tone: 'good' },
            { text: 'aud', value: 'shop-api', tone: 'good' },
          ],
          footer: { text: 'Auth service not called', tone: 'good' },
        },
        caption: 'Valid tokens pass, expired ones bounce at the door',
      },
      quiz: {
        question: 'Why can the gateway accept a JWT without calling the auth service or a database?',
        options: [
          'The token is encrypted, so only real users can produce one',
          'The token carries a signature that the gateway checks with the issuer\'s public key',
          'The gateway caches every user\'s password hash',
          'The browser has already validated the token',
        ],
        answer: 1,
        explain: 'The issuer signs the claims with its private key. Anyone holding the public key can confirm the token is authentic and unchanged, then check expiry and audience locally. The payload is readable by anyone, so it is not encrypted.',
      },
    },
    {
      title: 'Safe checks',
      tag: 'concept',
      heading: 'Three rules keep token checks safe',
      eli5: 'The **door guard** follows three rules. Only accept the seals on the list, only open doors named on the card, and keep a fresh picture of the real seal.',
      body: [
        'Pin the allowed algorithms in your code and never trust the `alg` field of an incoming token on its own, or an attacker picks the weakest one. Reject a token whose `aud` names another service.',
        'Fetch public keys by `kid` from the issuer\'s key set, so keys can rotate without a deploy.',
      ],
      keyIdea: 'The verifier decides the algorithm, audience and key source. The token never does.',
      metrics: { lookup: '0/s', check: '<1 ms CPU', life: '15 min', revoke: 'up to 15 min' },
      scene: {
        nodes: [
          { ...gw, status: 'active', badge: 'pinned RS256' },
          { ...auth, badge: 'JWKS endpoint' },
          { ...browser, status: 'hot', chips: [{ text: 'alg: none', tone: 'bad' }, { text: 'aud: other-api', tone: 'bad' }] },
        ],
        links: [link('gw', 'auth', { label: 'GET /jwks.json', style: 'dashed' }), link('browser', 'gw')],
        flows: [
          { path: ['gw', 'auth', 'gw'], tone: 'data', label: 'keys by kid, cached', duration: 1.6 },
          { path: ['browser', 'gw'], tone: 'request', label: 'alg: none', duration: 1.2, delay: 1.8 },
          { path: ['gw', 'browser'], tone: 'error', label: '401', duration: 1.2, delay: 3.1 },
        ],
        panel: {
          title: 'Verifier rules',
          icon: 'List',
          rows: [
            { text: 'algorithm', value: 'pinned in code', tone: 'good' },
            { text: 'audience', value: 'must be shop-api', tone: 'good' },
            { text: 'key', value: 'looked up by kid', tone: 'good' },
          ],
        },
        caption: 'Tokens that break a rule never reach a service',
      },
      code: {
        language: 'python',
        title: 'Token check at the gateway (PyJWT)',
        source: `import jwt
from jwt import PyJWKClient

keys = PyJWKClient("https://auth.shop.example/.well-known/jwks.json")

def authenticate(request):
    token = request.headers.get("Authorization", "").removeprefix("Bearer ")
    try:
        key = keys.get_signing_key_from_jwt(token).key   # looked up by kid, cached
        claims = jwt.decode(
            token, key,
            algorithms=["RS256"],                # pinned, never read from the token
            audience="shop-api",
            issuer="https://auth.shop.example",
        )                                        # also rejects an expired exp
    except jwt.InvalidTokenError:
        return Response(401)
    request.headers["X-User-Id"] = claims["sub"]
    request.headers["X-Roles"] = ",".join(claims.get("roles", []))
    return forward(request)`,
        highlight: [9, 12, 13, 14, 16],
      },
    },
    {
      title: 'Refresh tokens',
      tag: 'tradeoff',
      heading: 'Short access tokens, long refresh tokens',
      eli5: 'Your stamped card only works for a short while. When it runs out, you show a second, longer-lasting slip at the **front desk**, and the desk checks its book before printing a fresh card.',
      body: [
        'A stolen JWT works until it expires, so keep the **access token** short: 15 minutes here. Nobody wants to type a password every 15 minutes, so login also returns a **refresh token** that lasts 30 days.',
        'The refresh token goes only to the auth service, never to the APIs. It is a random value stored server-side, so that one call does hit a database. With one refresh per user every 15 minutes, that is a tiny fraction of the traffic.',
      ],
      keyIdea: 'The access token is cheap to check and short-lived. The refresh token is checked against the server and is where control lives.',
      metrics: { lookup: '1 per 15 min', check: '<1 ms CPU', life: '15 min + 30 d', revoke: 'up to 15 min' },
      scene: {
        nodes: [
          { ...browser, chips: ['access: expired'] },
          { ...auth, status: 'active', badge: 'refresh endpoint' },
          { ...userdb, label: 'token DB', status: 'active' },
        ],
        links: [link('browser', 'auth'), link('auth', 'userdb')],
        flows: [
          { path: ['browser', 'auth'], tone: 'request', label: 'POST /token/refresh', duration: 1.4 },
          { path: ['auth', 'userdb'], tone: 'request', label: 'valid?', duration: 0.9, delay: 1.5 },
          { path: ['userdb', 'auth'], tone: 'response', label: 'ok', duration: 0.9, delay: 2.5 },
          { path: ['auth', 'browser'], tone: 'response', label: 'new access token', duration: 1.4, delay: 3.5 },
        ],
        panel: {
          title: 'Two tokens, two jobs',
          icon: 'Timer',
          rows: [
            { text: 'access token', value: '15 min, JWT' },
            { text: 'refresh token', value: '30 days, random' },
            { text: 'sent to', value: 'APIs / auth only' },
            { text: 'checked by', value: 'signature / DB' },
          ],
        },
        caption: 'One server check every 15 minutes, not one per request',
      },
    },
    {
      title: 'Rotation',
      tag: 'concept',
      heading: 'Rotate the refresh token on every use',
      eli5: 'Each time you swap your long-lasting slip, the **front desk** takes the old one and gives you a new one. If someone shows an old slip later, the desk knows it was copied.',
      body: [
        '**Rotate** on every use: each refresh returns a new refresh token and retires the old one. If a retired token shows up again, someone copied it, and the auth service ends that whole session family.',
        'In a browser, keep the refresh token in an `HttpOnly` cookie, out of reach of scripts.',
      ],
      keyIdea: 'A refresh token works once. A replayed one reveals theft and kills the session.',
      metrics: { lookup: '1 per 15 min', check: '<1 ms CPU', life: '15 min + 30 d', revoke: 'on reuse' },
      scene: {
        nodes: [
          { ...browser, chips: ['refresh #2'] },
          { ...auth, status: 'active', badge: 'rotate on use' },
          { ...userdb, label: 'token DB', status: 'active', badge: '#1 retired' },
          { id: 'thief', kind: 'client', at: at(-1.8, 6.4), label: 'thief', sub: 'copied #1', status: 'hot' },
        ],
        links: [link('browser', 'auth'), link('auth', 'userdb'), link('thief', 'auth', { style: 'dashed' })],
        flows: [
          { path: ['browser', 'auth'], tone: 'request', label: 'refresh #1', duration: 1.2 },
          { path: ['auth', 'browser'], tone: 'response', label: 'new refresh #2', duration: 1.2, delay: 1.3 },
          { path: ['thief', 'auth'], tone: 'request', label: 'replay #1', duration: 1.4, delay: 2.8 },
          { path: ['auth', 'thief'], tone: 'error', label: 'reuse: end session', duration: 1.4, delay: 4.3 },
        ],
        panel: {
          title: 'Token family',
          icon: 'Repeat',
          rows: [
            { text: 'refresh #1', value: 'retired', tone: 'muted' },
            { text: 'refresh #2', value: 'current', tone: 'good' },
            { text: '#1 shown again', value: 'revoke family', tone: 'bad' },
          ],
        },
        caption: 'A replayed token ends the whole family',
      },
    },
    {
      title: 'Revocation',
      tag: 'tradeoff',
      heading: 'You cannot take a JWT back',
      eli5: 'A hotel guest is asked to leave, but the stamped card in their pocket still opens doors until its time runs out. The **door guard** only looks at the seal and the date.',
      body: [
        'An employee is fired at 10:00, or a user reports a stolen phone. With sessions you delete a row and the next request fails. A JWT signed at 09:58 stays valid until 10:13, because the gateway never asks anyone.',
        'Whatever you choose next, revoke the refresh token as well, or the client fetches a fresh access token a minute later.',
      ],
      keyIdea: 'Stateless tokens trade instant revocation for speed. The gap equals the token lifetime.',
      metrics: { lookup: '0/s', check: '<1 ms CPU', life: '15 min', revoke: 'up to 15 min' },
      metricTones: { revoke: 'bad' },
      scene: {
        nodes: [
          { ...browser, label: 'stolen phone', sub: 'token from 09:58', status: 'hot', chips: ['Bearer eyJ...'] },
          { ...gw, status: 'ok', badge: 'signature ok' },
          { ...orders, status: 'hot', badge: 'serves the thief' },
        ],
        links: [link('browser', 'gw'), link('gw', 'orders')],
        flows: [
          { path: ['browser', 'gw', 'orders'], tone: 'request', label: 'GET /orders at 10:05', duration: 1.8 },
          { path: ['orders', 'gw', 'browser'], tone: 'error', label: '200 for a revoked user', duration: 1.8, delay: 2 },
        ],
        panel: {
          title: 'Timeline for user 42',
          icon: 'Clock',
          rows: [
            { text: '09:58', value: 'token issued' },
            { text: '10:00', value: 'user revoked', tone: 'warn' },
            { text: '10:05', value: 'token still accepted', tone: 'bad' },
            { text: '10:13', value: 'token expires' },
          ],
        },
        caption: 'The gateway cannot know about the firing',
      },
    },
    {
      title: 'Denylist',
      tag: 'tradeoff',
      heading: 'Three ways to shrink the revocation gap',
      eli5: 'The **front desk** hands the **door guard** a short list of cancelled cards. The guard still checks the seal, and now also glances at the list.',
      body: [
        'Accept the window and keep it short. Keep a **denylist** of revoked token IDs (the `jti` claim) in a cache that the gateway checks, with entries expiring when the token would have. Or store a per-user token version and reject older ones.',
        'The last two bring a lookup back, though a denylist is tiny compared with a full session store. Many systems mix the models: sessions for the browser, short JWTs between internal services.',
      ],
      keyIdea: 'A small denylist turns a 15 minute gap into seconds, at the price of one cheap lookup.',
      metrics: { lookup: 'denylist only', check: '<1 ms + cache', life: '15 min', revoke: 'seconds' },
      metricTones: { lookup: 'warn', revoke: 'good' },
      scene: {
        nodes: [
          { ...browser, label: 'stolen phone', sub: 'token from 09:58', status: 'hot' },
          { ...gw, status: 'active', badge: 'check jti' },
          { ...auth, badge: 'revoke user 42' },
          { ...sessions, label: 'denylist', sub: 'revoked jti, TTL 15 min', status: 'active' },
        ],
        links: [link('browser', 'gw'), link('gw', 'auth'), link('auth', 'sessions'), link('gw', 'sessions', { style: 'dashed' })],
        flows: [
          { path: ['auth', 'sessions'], tone: 'event', label: 'add jti 7b1e', duration: 1 },
          { path: ['browser', 'gw'], tone: 'request', label: 'Bearer eyJ...', duration: 1, delay: 1.2 },
          { path: ['gw', 'sessions', 'gw'], tone: 'request', label: 'revoked?', duration: 1.4, delay: 2.3 },
          { path: ['gw', 'browser'], tone: 'error', label: '401', duration: 1, delay: 3.8 },
        ],
        panel: {
          title: 'Options',
          icon: 'List',
          rows: [
            { text: 'short lifetime', value: 'gap 15 min', tone: 'warn' },
            { text: 'jti denylist', value: 'gap seconds', tone: 'good' },
            { text: 'per-user version', value: 'gap seconds', tone: 'good' },
            { text: 'both bring a lookup back', tone: 'muted' },
          ],
        },
        caption: 'A small denylist closes the gap',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Prove identity once, check it cheaply, revoke when needed',
      eli5: 'The **front desk** checks who you are once, maybe twice, and gives you a stamped card. Guards read the card at each door, and the card runs out quickly so a lost one cannot be used for long.',
      body: [
        '**Authentication** proves who is calling and **authorization** decides what they may do. Passwords live as salted, slow hashes, guarded by rate limits and a second factor. A **session** is a random ID that costs a lookup per request and can be revoked at once.',
        'A **JWT** is a signed set of claims the gateway checks with a public key and no lookup. Keep access tokens short, rotate refresh tokens and add a denylist when 15 minutes is too long. Part 2 covers OAuth, SSO and access control.',
      ],
      keyIdea: 'Sessions buy control with a lookup. Signed tokens buy speed with a revocation gap. Pick per use case.',
      metrics: { lookup: '0/s', check: '<1 ms CPU', life: '15 min + 30 d', revoke: 'seconds' },
      metricTones: { lookup: 'good', check: 'good', revoke: 'good' },
      scene: {
        nodes: [
          { ...browser, chips: ['Bearer eyJ...'] },
          { ...gw, status: 'ok', badge: 'verify + denylist' },
          { ...auth, badge: 'login + refresh' },
          { ...orders, status: 'ok' },
        ],
        links: coreLinks,
        flows: [
          { path: ['browser', 'gw', 'orders'], tone: 'request', label: 'Bearer eyJ...', count: 3, duration: 1.8 },
          { path: ['orders', 'gw', 'browser'], tone: 'response', count: 3, duration: 1.8, delay: 2 },
          { path: ['browser', 'gw', 'auth'], tone: 'handshake', label: 'refresh', duration: 1.6, delay: 4 },
        ],
        panel: {
          title: 'Sessions vs JWTs',
          icon: 'Scale',
          rows: [
            { text: 'session', value: 'lookup per request, instant revoke' },
            { text: 'JWT', value: 'no lookup, revoke gap' },
            { text: 'JWT + denylist', value: 'tiny lookup, seconds' },
          ],
        },
      },
      quiz: {
        question: 'A user reports a stolen laptop. Your APIs accept 15 minute JWTs verified at the gateway. What stops the thief fastest while keeping the gateway check cheap?',
        options: [
          'Change the signing key for all users',
          'Wait for the access token to expire',
          'Revoke the refresh token and add the access token ID to a short-lived denylist the gateway checks',
          'Ask the user to change their password',
        ],
        answer: 2,
        explain: 'Revoking the refresh token stops new access tokens. The denylist entry kills the one already issued, and it only needs to live 15 minutes. Rotating the signing key logs everyone out, and a password change alone does not cancel a token that is already signed.',
      },
    },
  ],
};
