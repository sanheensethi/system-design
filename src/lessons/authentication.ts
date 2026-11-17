import type { Lesson, SceneNode } from '../engine/types';

const browser: SceneNode = { id: 'browser', kind: 'client', at: [-5.5, 0], label: 'browser', sub: 'user 42' };
const gw: SceneNode = { id: 'gw', kind: 'gateway', at: [-2, 0], label: 'API gateway' };
const auth: SceneNode = { id: 'auth', kind: 'service', at: [1.5, -2.5], label: 'auth service' };
const orders: SceneNode = { id: 'orders', kind: 'service', at: [2.5, 2], label: 'orders API' };
const userdb: SceneNode = { id: 'userdb', kind: 'db', at: [5, -3.5], label: 'users DB' };
const sessions: SceneNode = { id: 'sessions', kind: 'cache', at: [5, -3.5], label: 'session store', sub: 'Redis' };

const coreLinks = [
  { from: 'browser', to: 'gw' },
  { from: 'gw', to: 'auth' },
  { from: 'gw', to: 'orders' },
];

// OAuth scene: a separate cast.
const person: SceneNode = { id: 'person', kind: 'user', at: [-5.5, 0], label: 'Maya' };
const printApp: SceneNode = { id: 'printApp', kind: 'server', at: [-2, 0], label: 'PrintHub', sub: 'the client app' };
const idp: SceneNode = { id: 'idp', kind: 'service', at: [1.5, -2.5], label: 'identity provider', sub: 'login + consent' };
const photos: SceneNode = { id: 'photos', kind: 'storage', at: [2.5, 2], label: 'photos API', sub: 'resource server' };
const wiki: SceneNode = { id: 'wiki', kind: 'server', at: [-2.5, 4.5], label: 'wiki', sub: 'second app' };

export const authentication: Lesson = {
  id: 'authentication',
  title: 'Authentication and authorization',
  tagline: 'Prove who is calling, decide what they may do, and do both on every request without a database hit.',
  minutes: 16,
  level: 'Intermediate',
  learn: [
    'Authentication (who you are) versus authorization (what you may do)',
    'Storing passwords as slow, salted hashes',
    'Server-side sessions and cookies versus signed JWTs',
    'Expiry, refresh tokens and the revocation trade-off',
    'The OAuth 2 authorization code flow and OpenID Connect for single sign-on',
    'Role based and attribute based access control',
  ],
  metrics: [
    { key: 'lookup', label: 'Auth lookups' },
    { key: 'check', label: 'Check cost' },
    { key: 'life', label: 'Credential life' },
    { key: 'revoke', label: 'Revoke delay' },
  ],
  steps: [
    {
      title: 'Who asks?',
      tag: 'problem',
      heading: 'The API believes whatever the client says',
      eli5: 'A hotel hands a room key to anyone who says a room number. The **front desk** never checks who is asking, so any stranger can walk into your room.',
      body: [
        'The shop serves **50,000 requests per second**. The orders endpoint is `GET /orders?user=42`. HTTP is stateless, so each request arrives with no memory of the one before it. Change 42 to 43 and you read a stranger\'s orders.',
        'Two separate questions are missing. **Authentication** asks who you are, and a failure is a `401 Unauthorized`. **Authorization** asks what you may do, and a failure is a `403 Forbidden`. A logged-in customer asking for the admin page is authenticated and still not authorized.',
        'Sending the password with every request would answer the first question, at the cost of exposing the password 50,000 times a second. We need to prove identity once and carry a cheaper proof afterwards.',
      ],
      keyIdea: 'Authentication proves who is calling. Authorization decides what that caller may do. Every request needs both.',
      metrics: { lookup: 'none', check: 'none', life: '-', revoke: '-' },
      scene: {
        nodes: [{ ...browser, sub: 'claims to be 43' }, { ...orders, status: 'hot', badge: 'no identity check' }],
        links: [{ from: 'browser', to: 'orders' }],
        flows: [
          { path: ['browser', 'orders'], tone: 'request', label: 'GET /orders?user=43', duration: 1.4 },
          { path: ['orders', 'browser'], tone: 'error', label: "someone else's orders", duration: 1.4, delay: 1.5 },
        ],
        caption: 'Nothing ties the request to a person',
      },
    },
    {
      title: 'Passwords',
      tag: 'concept',
      heading: 'Store a slow, salted hash, never the password',
      eli5: 'The **front desk** does not keep a copy of your secret word. It keeps a scrambled scribble of it that cannot be turned back, and checks that your word makes the same scribble.',
      body: [
        'Login starts with a password, so the users table is the first thing an intruder wants. If it holds plain passwords, one leaked backup exposes every account, and every other site where people reused that password.',
        'Store a **hash**: a one-way function of the password. Add a random **salt** per user so two people with the same password get different hashes and precomputed tables are useless. Use a deliberately slow, memory-hard function built for passwords, such as **Argon2id** or bcrypt, tuned so one check costs roughly 100 ms. A fast hash like SHA-256 lets an attacker with the leaked table try billions of guesses per second.',
        'At login, hash the submitted password with the stored salt and compare. Add rate limiting on the login endpoint and a second factor for accounts that matter.',
      ],
      keyIdea: 'A password hash should be salted and slow, so a stolen table is expensive to crack one account at a time.',
      metrics: { lookup: '1 at login', check: '~100 ms hash', life: '-', revoke: '-' },
      scene: {
        nodes: [browser, gw, { ...auth, status: 'active', badge: 'Argon2id verify' }, { ...userdb, badge: 'salt + hash only' }],
        links: [{ from: 'browser', to: 'gw' }, { from: 'gw', to: 'auth' }, { from: 'auth', to: 'userdb' }],
        flows: [
          { path: ['browser', 'gw', 'auth'], tone: 'request', label: 'POST /login', duration: 1.6 },
          { path: ['auth', 'userdb'], tone: 'request', label: 'get hash', duration: 0.9, delay: 1.7 },
          { path: ['userdb', 'auth'], tone: 'response', label: '$argon2id$...', duration: 0.9, delay: 2.7 },
        ],
        caption: 'The database never sees the password itself',
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
    },
    {
      title: 'Sessions',
      tag: 'concept',
      heading: 'Server-side sessions: a random ID in a cookie',
      eli5: 'After checking you in, the **front desk** gives you a numbered ticket and writes your name next to that number in its book. Each time you come back, staff look the number up in the book.',
      body: [
        'After a good login the auth service creates a **session**: a long random ID, stored in Redis next to the user ID and an expiry. The ID goes back to the browser in a cookie, and the browser attaches it to every later request.',
        'The cookie needs three flags. `HttpOnly` hides it from page scripts. `Secure` sends it only over HTTPS. `SameSite=Lax` stops most cross-site requests from carrying it. The ID itself means nothing, so stealing the database of another service reveals nothing about it.',
        'The cost is a lookup. Every one of the 50,000 requests per second reads the session store before any real work happens, and that store is now a dependency of every endpoint. The upside is control: delete the row and the user is logged out on the next request.',
      ],
      keyIdea: 'A session keeps the state on the server. The client holds only a random pointer to it, and logging out is one delete.',
      metrics: { lookup: '50,000/s', check: '~1 ms Redis', life: '14 days', revoke: 'instant' },
      scene: {
        nodes: [browser, { ...gw, status: 'active' }, { ...auth, status: 'active' }, { ...sessions, status: 'hot', badge: '50,000 reads/s' }, orders],
        links: [...coreLinks, { from: 'auth', to: 'sessions' }],
        flows: [
          { path: ['browser', 'gw'], tone: 'request', label: 'Cookie: sid=9f3c...', duration: 1 },
          { path: ['gw', 'auth', 'sessions'], tone: 'request', label: 'GET sess:9f3c', duration: 1.2, delay: 1.1 },
          { path: ['sessions', 'auth', 'gw'], tone: 'response', label: 'user 42', duration: 1.2, delay: 2.4 },
          { path: ['gw', 'orders'], tone: 'request', label: 'X-User-Id: 42', duration: 1, delay: 3.7 },
        ],
        caption: 'Every request pays one session lookup',
      },
    },
    {
      title: 'JWT anatomy',
      tag: 'concept',
      heading: 'A JWT carries the claims and a signature',
      eli5: 'Now the **front desk** prints a card that says your name, your room and when it stops working, then stamps it with a seal only the desk owns. Anyone can read the card. Nobody can fake the seal.',
      body: [
        'A **JSON Web Token** moves the session data into the token. It has three base64url parts joined by dots: a **header** (the signing algorithm and key ID), a **payload** of **claims** (who, for which audience, until when) and a **signature** over the first two parts.',
        'The auth service signs with a private key. With an asymmetric algorithm such as `RS256` or `ES256`, every other service only needs the public key to verify. Change one character of the payload and the signature no longer matches.',
        'A JWT is **signed, not encrypted**. Anyone holding it can decode the payload, so never put a password, a card number or anything private in it. Keep it small too: it rides on every request.',
      ],
      keyIdea: 'A JWT is a signed statement about the caller. The signature proves who issued it and that nobody changed it.',
      metrics: { lookup: '1 at login', check: 'sign once', life: '15 min', revoke: '-' },
      scene: {
        nodes: [browser, gw, { ...auth, status: 'active', badge: 'signs with private key' }, { ...userdb, status: 'dim' }],
        links: [{ from: 'browser', to: 'gw' }, { from: 'gw', to: 'auth' }, { from: 'auth', to: 'userdb' }],
        flows: [
          { path: ['browser', 'gw', 'auth'], tone: 'request', label: 'POST /login', duration: 1.5 },
          { path: ['auth', 'gw', 'browser'], tone: 'response', label: 'header.payload.signature', duration: 1.8, delay: 1.7 },
        ],
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
      title: 'Gateway check',
      tag: 'concept',
      heading: 'The gateway verifies the signature with no database call',
      eli5: 'The **door guard** knows what the real seal looks like. The guard checks the seal and the date on your card right at the door, without phoning the front desk.',
      body: [
        'The gateway from the API gateway lesson holds the auth service\'s **public key**. For each request it recomputes the signature check, then checks `exp`, `iss` and `aud`. That is CPU work measured in fractions of a millisecond, with no network hop. The 50,000 session reads per second drop to zero.',
        'Three rules keep this safe. Pin the allowed algorithms in your code and never trust the `alg` field of an incoming token on its own. Reject a token whose audience is another service. Fetch public keys by `kid` from the issuer\'s key set, so keys can rotate without a deploy.',
        'After the check, the gateway forwards a trusted header such as `X-User-Id: 42`. Services behind it must only be reachable through the gateway, or anyone could forge that header.',
      ],
      keyIdea: 'Verifying a signature needs only a public key, so identity checks scale with CPU and not with a shared store.',
      metrics: { lookup: '0/s', check: '<1 ms CPU', life: '15 min', revoke: 'up to 15 min' },
      scene: {
        nodes: [browser, { ...gw, status: 'ok', badge: 'signature ok · user 42' }, { ...auth, status: 'dim' }, { ...orders, status: 'active', badge: 'X-User-Id: 42' }],
        links: coreLinks,
        flows: [
          { path: ['browser', 'gw'], tone: 'request', label: 'Bearer eyJ...', duration: 1 },
          { path: ['gw', 'orders'], tone: 'request', label: 'verified', duration: 1, delay: 1.1 },
          { path: ['orders', 'gw', 'browser'], tone: 'response', label: '200', duration: 1.6, delay: 2.2 },
          { path: ['browser', 'gw'], tone: 'request', label: 'expired token', duration: 1, delay: 4 },
          { path: ['gw', 'browser'], tone: 'error', label: '401', duration: 1, delay: 5.1 },
        ],
        caption: 'Valid tokens pass, expired ones bounce at the door',
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
      title: 'Refresh tokens',
      tag: 'tradeoff',
      heading: 'Short access tokens, long refresh tokens',
      eli5: 'Your stamped card only works for a short while. When it runs out, you show a second, longer-lasting slip at the **front desk**, and the desk checks its book before printing a fresh card.',
      body: [
        'A stolen JWT works until it expires, so keep the **access token** short: 15 minutes here. Nobody wants to type a password every 15 minutes, so login also returns a **refresh token** that lasts 30 days.',
        'The refresh token goes only to the auth service, never to the APIs. It is a random value stored server-side, so that one call does hit a database. At 50,000 requests per second with one refresh per user every 15 minutes, that is a tiny fraction of the traffic.',
        '**Rotate** on every use: each refresh returns a new refresh token and retires the old one. If a retired token shows up again, someone copied it, and the auth service ends that whole session family. In a browser, keep the refresh token in an `HttpOnly` cookie, out of reach of scripts.',
      ],
      keyIdea: 'The access token is cheap to check and short-lived. The refresh token is checked against the server and is where control lives.',
      metrics: { lookup: '1 per 15 min', check: '<1 ms CPU', life: '15 min + 30 d', revoke: 'up to 15 min' },
      scene: {
        nodes: [browser, gw, { ...auth, status: 'active', badge: 'rotate refresh token' }, { ...userdb, label: 'token DB', status: 'active' }, { ...orders, status: 'dim' }],
        links: [...coreLinks, { from: 'auth', to: 'userdb' }],
        flows: [
          { path: ['browser', 'gw', 'auth'], tone: 'request', label: 'POST /token/refresh', duration: 1.5 },
          { path: ['auth', 'userdb'], tone: 'request', label: 'valid? retire it', duration: 0.9, delay: 1.6 },
          { path: ['userdb', 'auth'], tone: 'response', label: 'ok', duration: 0.9, delay: 2.6 },
          { path: ['auth', 'gw', 'browser'], tone: 'response', label: 'new access + refresh', duration: 1.6, delay: 3.6 },
        ],
        caption: 'One server check every 15 minutes instead of one per request',
      },
    },
    {
      title: 'Revocation',
      tag: 'tradeoff',
      heading: 'You cannot take a JWT back',
      eli5: 'A hotel guest is asked to leave, but the stamped card in their pocket still opens doors until its time runs out. The **door guard** only looks at the seal, so the desk must also hand the guard a short list of cancelled cards.',
      body: [
        'An employee is fired at 10:00, or a user reports a stolen phone. With sessions you delete a row and the next request fails. A JWT signed at 09:58 stays valid until 10:13, because the gateway never asks anyone.',
        'There are three common answers. Accept the window and keep it short. Keep a **denylist** of revoked token IDs (the `jti` claim) in a cache that the gateway checks, with entries expiring when the token would have. Or store a per-user token version and reject older ones. The last two bring a lookup back, though the denylist is tiny compared with a full session store.',
        'Whatever you choose, revoke the refresh token as well, or the client fetches a fresh access token a minute later. Many systems mix the models: sessions for the browser, short JWTs between internal services.',
      ],
      keyIdea: 'Stateless tokens trade instant revocation for speed. Short lifetimes shrink the gap, and a denylist closes it at the price of a lookup.',
      metrics: { lookup: 'denylist only', check: '<1 ms + cache', life: '15 min', revoke: 'seconds' },
      scene: {
        nodes: [
          { ...browser, label: 'stolen phone', sub: 'token from 09:58', status: 'hot' },
          { ...gw, status: 'active', badge: 'check jti' },
          { ...auth, badge: 'revoke user 42' },
          { ...sessions, label: 'denylist', sub: 'revoked jti, TTL 15 min', status: 'active' },
          orders,
        ],
        links: [...coreLinks, { from: 'auth', to: 'sessions' }, { from: 'gw', to: 'sessions', style: 'dashed' }],
        flows: [
          { path: ['auth', 'sessions'], tone: 'event', label: 'add jti 7b1e', duration: 1 },
          { path: ['browser', 'gw'], tone: 'request', label: 'Bearer eyJ...', duration: 1, delay: 1.2 },
          { path: ['gw', 'sessions', 'gw'], tone: 'request', label: 'revoked?', duration: 1.4, delay: 2.3 },
          { path: ['gw', 'browser'], tone: 'error', label: '401', duration: 1, delay: 3.8 },
        ],
        caption: 'A small denylist turns a 15 minute gap into seconds',
      },
    },
    {
      title: 'OAuth 2',
      tag: 'concept',
      heading: 'OAuth 2: let an app act for you without your password',
      eli5: 'Maya wants a cleaner to tidy only her room. She tells the **front desk** herself, and the desk gives the cleaner a card that opens that one room for one hour. Maya never hands over her own key.',
      body: [
        'Maya wants PrintHub to print pictures from her photo account. Typing her photo password into PrintHub would give it everything, forever. **OAuth 2** is delegated authorization: the photo service issues PrintHub a limited token after Maya agrees.',
        'The **authorization code flow** runs in four moves. PrintHub redirects the browser to the identity provider with its `client_id`, the `scope` it wants (`photos.read`) and a random `state`. Maya logs in there and approves. The provider redirects back to PrintHub with a one-time **code**. PrintHub\'s back end exchanges that code, plus its client secret, for an access token over a direct server-to-server call.',
        'The token never travels through the browser address bar, and the password never touches PrintHub. Public clients such as mobile and single-page apps cannot keep a secret, so they add **PKCE**: a hashed one-time value sent at the start and proven at the exchange. Current guidance is to use PKCE for every client.',
      ],
      keyIdea: 'OAuth hands a third party a scoped, expiring token issued by the service that owns the data. The password stays with its owner.',
      metrics: { lookup: '1 code exchange', check: '<1 ms CPU', life: 'scoped, 1 h', revoke: 'user can withdraw' },
      scene: {
        nodes: [person, { ...printApp, status: 'active' }, { ...idp, status: 'active', badge: 'Allow photos.read?' }, photos],
        links: [
          { from: 'person', to: 'printApp' },
          { from: 'printApp', to: 'idp', label: 'redirect' },
          { from: 'printApp', to: 'photos' },
        ],
        flows: [
          { path: ['person', 'printApp', 'idp'], tone: 'handshake', label: '1 redirect to login', duration: 1.6 },
          { path: ['idp', 'printApp'], tone: 'handshake', label: '2 code', duration: 1, delay: 1.8 },
          { path: ['printApp', 'idp'], tone: 'request', label: '3 code + secret', duration: 1, delay: 3 },
          { path: ['idp', 'printApp'], tone: 'response', label: 'access token', duration: 1, delay: 4.1 },
          { path: ['printApp', 'photos'], tone: 'request', label: '4 Bearer token', duration: 1, delay: 5.3 },
        ],
        caption: 'Consent at the provider, code to the app, token over the back channel',
      },
    },
    {
      title: 'Single sign-on',
      tag: 'concept',
      heading: 'OpenID Connect adds identity, and that gives you SSO',
      eli5: 'The **front desk** of one big hotel group checks you in once. Every hotel in the group trusts that desk, so you walk into the next one and they already know your name.',
      body: [
        'OAuth answers what an app may access. It does not say who the user is. **OpenID Connect** (OIDC) is a thin layer on top: ask for the `openid` scope and the token response also contains an **ID token**, a JWT with claims such as `sub`, `email`, `iss`, `aud` and `exp`. The app verifies it like any JWT and now knows who logged in.',
        'That is what a "Sign in with" button does, and it is how a company gets **single sign-on**. Maya logs in to the identity provider once, and it sets its own session cookie. When she opens the wiki, the wiki redirects her to the same provider, the provider sees its cookie and sends her straight back with a code. No second password prompt.',
        'The identity provider becomes the one place for password rules, second factors and offboarding. Disable one account there and every connected app loses that user at its next token check. It is also a single point of failure, so run it like one.',
      ],
      keyIdea: 'OAuth delegates access. OpenID Connect adds a signed ID token that says who the user is, which lets many apps share one login.',
      metrics: { lookup: '1 login, many apps', check: '<1 ms CPU', life: 'IdP session 8 h', revoke: 'one place' },
      scene: {
        nodes: [person, printApp, { ...idp, status: 'ok', badge: 'already logged in' }, { ...wiki, status: 'active' }],
        links: [
          { from: 'person', to: 'printApp' },
          { from: 'person', to: 'wiki' },
          { from: 'printApp', to: 'idp', style: 'dashed' },
          { from: 'wiki', to: 'idp' },
        ],
        flows: [
          { path: ['person', 'wiki'], tone: 'request', label: 'open wiki', duration: 1 },
          { path: ['wiki', 'idp'], tone: 'handshake', label: 'who is this?', duration: 1.2, delay: 1.1 },
          { path: ['idp', 'wiki'], tone: 'response', label: 'ID token: maya', duration: 1.2, delay: 2.4 },
          { path: ['wiki', 'person'], tone: 'response', label: 'welcome, no password', duration: 1, delay: 3.7 },
        ],
        caption: 'The second app reuses the first login',
      },
    },
    {
      title: 'RBAC and ABAC',
      tag: 'concept',
      heading: 'Authorization: roles first, attributes when roles run out',
      eli5: 'Your card says "guest", so it opens your room and the pool. A card that says "cleaner" opens every room, but only in the morning. The **door** reads the card and decides.',
      body: [
        'Identity is settled, so back to the bug from step one. **Role based access control** (RBAC) gives users roles and roles permissions: `customer` can read orders, `support` can refund them, `admin` can do both. It is easy to audit, because you can list who holds each role.',
        'Roles alone still let customer 42 read customer 43\'s order. The missing rule compares attributes: the order\'s owner must equal the caller. **Attribute based access control** (ABAC) writes policies over attributes of the user, the resource and the context, such as "support may refund orders under $500 in their own region".',
        'Start with a few roles and add attribute checks where a rule depends on the resource. Check coarse rules at the gateway and ownership inside the service that has the data. Default to deny, and never rely on the UI hiding a button.',
      ],
      keyIdea: 'Roles answer what kind of user this is. Attribute rules answer whether this user may touch this particular object.',
      metrics: { lookup: '0/s', check: '<1 ms CPU', life: '15 min', revoke: 'seconds' },
      scene: {
        nodes: [{ ...browser, sub: 'user 42, customer' }, { ...gw, status: 'ok', badge: 'role: customer' }, { ...auth, status: 'dim' }, { ...orders, status: 'active', badge: 'owner 43 ≠ caller 42' }],
        links: coreLinks,
        flows: [
          { path: ['browser', 'gw', 'orders'], tone: 'request', label: 'GET /orders/981', duration: 1.6 },
          { path: ['orders', 'gw', 'browser'], tone: 'error', label: '403 Forbidden', duration: 1.6, delay: 1.8 },
        ],
        caption: 'Authenticated, and still not allowed',
      },
      code: {
        language: 'python',
        title: 'A role check plus an ownership check',
        source: `PERMISSIONS = {
    "customer": {"order:read"},
    "support":  {"order:read", "order:refund"},
    "admin":    {"order:read", "order:refund", "order:delete"},
}

def allowed(user, action, order):
    granted = set().union(*(PERMISSIONS.get(r, set()) for r in user.roles))
    if action not in granted:                 # RBAC: does any role allow it?
        return False
    if "customer" in user.roles and len(user.roles) == 1:
        return order.owner_id == user.id      # ABAC: only your own orders
    if action == "order:refund" and "admin" not in user.roles:
        return order.total <= 500 and order.region == user.region
    return True

def get_order(request, order_id):
    order = db.get_order(order_id)
    if not allowed(request.user, "order:read", order):
        return Response(403)                  # known caller, not permitted
    return order`,
        highlight: [9, 12, 14, 19, 20],
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Prove identity once, check it cheaply, decide access every time',
      eli5: 'The **front desk** checks who you are once and gives you a stamped card. Guards read the card at each door, the card runs out quickly, and each door still decides whether your kind of card may open it.',
      body: [
        '**Authentication** proves who is calling and **authorization** decides what they may do. Passwords live as salted, slow hashes. A **session** is a random ID that costs a lookup per request and can be revoked at once. A **JWT** is a signed set of claims the gateway checks with a public key and no lookup, which took 50,000 store reads per second to zero.',
        'Keep access tokens short, pair them with rotating **refresh tokens**, and add a denylist when 15 minutes is too long to wait. **OAuth 2** gives a third party a scoped token without the password, and **OpenID Connect** adds an ID token for single sign-on. Then apply roles and attribute rules, with deny as the default.',
      ],
      keyIdea: 'Sessions buy control with a lookup. Signed tokens buy speed with a revocation gap. Pick per use case, and always check authorization on the server.',
      metrics: { lookup: '0/s', check: '<1 ms CPU', life: '15 min + 30 d', revoke: 'seconds' },
      scene: {
        nodes: [browser, { ...gw, status: 'ok', badge: 'verify + roles' }, auth, { ...orders, status: 'ok' }],
        links: coreLinks,
        flows: [
          { path: ['browser', 'gw', 'orders'], tone: 'request', label: 'Bearer eyJ...', count: 3, duration: 1.8 },
          { path: ['orders', 'gw', 'browser'], tone: 'response', count: 3, duration: 1.8, delay: 2 },
          { path: ['browser', 'gw', 'auth'], tone: 'handshake', label: 'refresh', duration: 1.6, delay: 4 },
        ],
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
