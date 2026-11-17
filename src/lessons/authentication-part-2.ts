import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

// OAuth and SSO cast.
const person: SceneNode = { id: 'person', kind: 'user', at: at(-5.4, 0), label: 'Maya' };
const printApp: SceneNode = { id: 'printApp', kind: 'server', at: at(-1.8, 0), label: 'PrintHub', sub: 'the client app' };
const idp: SceneNode = { id: 'idp', kind: 'block', at: at(2, -3.4), label: 'identity provider', sub: 'login + consent', icon: 'KeyRound', tint: 'teal' };
const photos: SceneNode = { id: 'photos', kind: 'block', at: at(2, 3.4), label: 'photos API', sub: 'resource server', icon: 'Image', tint: 'blue' };
const wiki: SceneNode = { id: 'wiki', kind: 'block', at: at(-3.6, 7.6), label: 'wiki', sub: 'second app', icon: 'FileText', tint: 'gray' };

// Access control cast.
const browser: SceneNode = { id: 'browser', kind: 'client', at: at(-5.4, 0), label: 'browser', sub: 'user 42' };
const gw: SceneNode = { id: 'gw', kind: 'block', at: at(-1.8, 0), label: 'API gateway', icon: 'Network', tint: 'violet' };
const orders: SceneNode = { id: 'orders', kind: 'block', at: at(2, 3.4), label: 'orders API', icon: 'ShoppingBag', tint: 'amber' };

export const authenticationPart2: Lesson = {
  id: 'authentication-part-2',
  title: 'Authentication and authorization (part 2)',
  tagline: 'Let apps act for a user without a password, share one login across many apps, and decide what each caller may touch.',
  minutes: 13,
  level: 'Intermediate',
  learn: [
    'The OAuth 2 authorization code flow, PKCE and scopes',
    'API keys, client credentials and mTLS for service-to-service calls',
    'OpenID Connect and single sign-on',
    'Role based and attribute based access control, and where to enforce them',
  ],
  metrics: [
    { key: 'secret', label: 'Password shared', icon: 'KeyRound' },
    { key: 'scope', label: 'Access granted', icon: 'Shield' },
    { key: 'life', label: 'Credential life', icon: 'Timer' },
    { key: 'revoke', label: 'Revoke', icon: 'Clock' },
  ],
  steps: [
    {
      title: 'Password sharing',
      tag: 'problem',
      heading: 'An app wants your data, and your password is too much',
      eli5: 'Maya wants a cleaner to tidy her hotel room. Handing over her own master key would let the cleaner into everything, forever. There has to be a safer way to say "just this room".',
      body: [
        'Maya wants PrintHub to print pictures from her photo account. Typing her photo password into PrintHub would give it everything the account can do, with no expiry, and she could only undo it by changing the password everywhere.',
      ],
      keyIdea: 'Sharing a password hands over total, permanent access. Delegation needs a narrower credential.',
      metrics: { secret: 'full password', scope: 'everything', life: 'forever', revoke: 'change password' },
      metricTones: { secret: 'bad', scope: 'bad', life: 'bad', revoke: 'bad' },
      scene: {
        nodes: [
          { ...person, chips: ['password: maya123'] },
          { ...printApp, status: 'hot', badge: 'holds the password' },
          { ...photos, status: 'hot', badge: 'full access' },
        ],
        links: [link('person', 'printApp', { label: 'types password', labelTone: 'warn' }), link('printApp', 'photos')],
        flows: [
          { path: ['person', 'printApp'], tone: 'request', label: 'maya123', duration: 1.4 },
          { path: ['printApp', 'photos'], tone: 'request', label: 'login as Maya', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'What PrintHub could do',
          icon: 'List',
          rows: [
            { text: 'print photos', value: 'wanted' },
            { text: 'delete photos', value: 'possible', tone: 'bad' },
            { text: 'read private albums', value: 'possible', tone: 'bad' },
            { text: 'keep access for years', value: 'possible', tone: 'bad' },
          ],
        },
        caption: 'The app holds the keys to everything',
      },
    },
    {
      title: 'OAuth 2',
      tag: 'concept',
      heading: 'OAuth 2: delegated access with a limited token',
      eli5: 'Maya tells the **front desk** herself, and the desk gives the cleaner a card that opens that one room for one hour. Maya never hands over her own key.',
      body: [
        '**OAuth 2** is delegated authorization: the service that owns the data issues PrintHub a limited token after Maya agrees. Four roles take part: the **user** who owns the data, the **client app** that wants it, the **authorization server** (the identity provider) and the **resource server** (the photos API).',
      ],
      keyIdea: 'OAuth hands a third party a scoped, expiring token issued by the service that owns the data.',
      metrics: { secret: 'none shared', scope: 'photos.read', life: '1 hour', revoke: 'user can withdraw' },
      metricTones: { secret: 'good', scope: 'good', life: 'good', revoke: 'good' },
      scene: {
        nodes: [
          person,
          { ...printApp, status: 'active', sub: 'client app' },
          { ...idp, status: 'active', sub: 'authorization server' },
          { ...photos, sub: 'resource server' },
        ],
        links: [link('person', 'printApp'), link('printApp', 'idp', { label: 'asks for a token' }), link('printApp', 'photos')],
        flows: [
          { path: ['printApp', 'idp'], tone: 'request', label: 'may I print photos?', duration: 1.4 },
          { path: ['idp', 'printApp'], tone: 'response', label: 'token: photos.read, 1 h', duration: 1.4, delay: 1.5 },
          { path: ['printApp', 'photos'], tone: 'request', label: 'Bearer token', duration: 1.4, delay: 3 },
        ],
        panel: {
          title: 'The four roles',
          icon: 'Users',
          rows: [
            { text: 'resource owner', value: 'Maya' },
            { text: 'client', value: 'PrintHub' },
            { text: 'authorization server', value: 'identity provider' },
            { text: 'resource server', value: 'photos API' },
          ],
        },
        caption: 'The data owner issues the token, not the app',
      },
    },
    {
      title: 'Consent',
      tag: 'concept',
      heading: 'Redirect, login and consent happen at the provider',
      eli5: 'The cleaner sends Maya to the **front desk**. Maya proves who she is there, says "yes, just this room", and the desk writes a one-time slip for the cleaner to bring back.',
      body: [
        'The **authorization code flow** starts when PrintHub redirects the browser to the identity provider with its `client_id`, the `scope` it wants (`photos.read`) and a random `state` that guards against forged callbacks.',
        'Maya logs in there and approves. The provider redirects back to PrintHub with a one-time **code**.',
      ],
      keyIdea: 'Login and consent happen on the provider\'s own page, so PrintHub never sees the password.',
      metrics: { secret: 'none shared', scope: 'asked: photos.read', life: 'code: 60 s', revoke: '-' },
      scene: {
        nodes: [
          person,
          { ...printApp, status: 'active' },
          { ...idp, status: 'active', badge: 'Allow photos.read?' },
        ],
        links: [link('person', 'printApp'), link('printApp', 'idp', { label: 'redirect' })],
        flows: [
          { path: ['person', 'printApp', 'idp'], tone: 'handshake', label: '1 redirect to login', duration: 1.8 },
          { path: ['idp', 'printApp'], tone: 'handshake', label: '2 code', duration: 1.2, delay: 2 },
        ],
        panel: {
          title: 'The redirect URL',
          icon: 'Code',
          code: 'GET idp.example/authorize\n  client_id=printhub\n  response_type=code\n  scope=photos.read\n  state=x7Qa...',
          footer: { text: 'Returns ?code=...&state=x7Qa...', tone: 'muted' },
        },
        caption: 'Maya approves on the identity provider',
      },
    },
    {
      title: 'Code exchange',
      tag: 'concept',
      heading: 'The code is swapped for a token over a back channel',
      eli5: 'The cleaner takes the one-time slip back to the desk, shows their own ID, and gets the room card. The slip is useless to anyone else, and it never goes through the lobby.',
      body: [
        'PrintHub\'s back end exchanges the code, plus its client secret, for an access token over a direct server-to-server call. The token never travels through the browser address bar, and the password never touches PrintHub.',
      ],
      keyIdea: 'Only a short-lived code crosses the browser. The token comes over a direct call that needs the client secret.',
      metrics: { secret: 'none shared', scope: 'photos.read', life: 'token: 1 h', revoke: 'user can withdraw' },
      scene: {
        nodes: [
          { ...printApp, status: 'active' },
          { ...idp, status: 'active', badge: 'code is one use' },
          { ...photos, status: 'active', chips: ['Bearer eyJ...'] },
        ],
        links: [link('printApp', 'idp', { label: 'back channel, HTTPS' }), link('printApp', 'photos')],
        flows: [
          { path: ['printApp', 'idp'], tone: 'request', label: '3 code + secret', duration: 1.3 },
          { path: ['idp', 'printApp'], tone: 'response', label: 'access token', duration: 1.3, delay: 1.4 },
          { path: ['printApp', 'photos'], tone: 'request', label: '4 Bearer token', duration: 1.3, delay: 2.9 },
          { path: ['photos', 'printApp'], tone: 'response', label: 'photos', duration: 1.3, delay: 4.2 },
        ],
        panel: {
          title: 'Token request',
          icon: 'Code',
          code: 'POST idp.example/token\n  grant_type=authorization_code\n  code=Sx91...\n  client_id=printhub\n  client_secret=...',
        },
        caption: 'Code to token, server to server',
      },
    },
    {
      title: 'PKCE',
      tag: 'concept',
      heading: 'PKCE protects clients that cannot keep a secret',
      eli5: 'A phone app cannot hide a secret handshake, so it invents a fresh secret word for each visit, tells the desk a scrambled version, and later proves it knows the real word.',
      body: [
        'Public clients such as mobile and single-page apps cannot hide a client secret, so they add **PKCE**. The app invents a random `code_verifier` and sends its hash, the `code_challenge`, at the start. At the exchange it sends the verifier itself.',
        'A thief who steals the code cannot use it without the verifier. Current guidance is to use PKCE for every client.',
      ],
      keyIdea: 'PKCE ties the code to the app instance that asked for it, so a stolen code is worthless.',
      metrics: { secret: 'none shared', scope: 'photos.read', life: 'code: 60 s', revoke: '-' },
      scene: {
        nodes: [
          { id: 'app', kind: 'phone', at: at(-5.4, 0), label: 'mobile app', sub: 'no client secret', status: 'active' },
          { ...idp, status: 'active', badge: 'hash(verifier) = challenge?' },
          { id: 'thief', kind: 'client', at: at(-1.8, 6.4), label: 'thief', sub: 'stole the code', status: 'hot' },
        ],
        links: [link('app', 'idp'), link('thief', 'idp', { style: 'dashed' })],
        flows: [
          { path: ['app', 'idp'], tone: 'handshake', label: 'code_challenge', duration: 1.3 },
          { path: ['thief', 'idp'], tone: 'request', label: 'code, no verifier', duration: 1.3, delay: 1.5 },
          { path: ['idp', 'thief'], tone: 'error', label: 'invalid_grant', duration: 1.3, delay: 2.9 },
          { path: ['app', 'idp'], tone: 'request', label: 'code + verifier', duration: 1.3, delay: 4.3 },
        ],
        panel: {
          title: 'PKCE values',
          icon: 'Hash',
          rows: [
            { text: 'code_verifier', value: 'random, kept by app' },
            { text: 'code_challenge', value: 'SHA-256 of verifier' },
            { text: 'sent first', value: 'challenge' },
            { text: 'sent at exchange', value: 'verifier' },
          ],
        },
        caption: 'The thief has the code but not the verifier',
      },
      quiz: {
        question: 'Why does the authorization code flow hand the browser a code instead of the access token itself?',
        options: [
          'Codes are encrypted and tokens are not',
          'The browser address bar and history can leak values, so the token travels over a direct server-to-server call',
          'Tokens are too long to put in a URL',
          'The user must type the code to confirm consent',
        ],
        answer: 1,
        explain: 'Redirect URLs end up in history, logs and referrer headers. The one-time code is useless without the client secret or PKCE verifier, so the real token is fetched over a back channel that the browser never sees.',
      },
    },
    {
      title: 'Scopes',
      tag: 'concept',
      heading: 'Scopes keep the token narrow',
      eli5: 'The cleaner\'s card says which room and for how long. The photo desk checks the card for the exact thing the cleaner is trying to do.',
      body: [
        'A **scope** names one slice of access, such as `photos.read` or `photos.write`. The consent screen lists what PrintHub asked for, and the token carries only what Maya granted. The photos API checks the scope on every call.',
        'Maya can withdraw access later from her account page, and the access token expires on its own.',
      ],
      keyIdea: 'Ask for the least scope that works. A leaked token then does limited damage.',
      metrics: { secret: 'none shared', scope: 'photos.read', life: '1 hour', revoke: 'user can withdraw' },
      scene: {
        nodes: [
          { ...printApp, chips: [{ text: 'GET /photos', tone: 'good' }, { text: 'DELETE /photos/7', tone: 'bad' }] },
          { ...photos, status: 'active', badge: 'scope: photos.read' },
          { ...person, chips: ['consent: read only'] },
        ],
        links: [link('printApp', 'photos'), link('person', 'printApp')],
        flows: [
          { path: ['printApp', 'photos'], tone: 'request', label: 'GET /photos', duration: 1.3 },
          { path: ['photos', 'printApp'], tone: 'response', label: '200', duration: 1.3, delay: 1.4 },
          { path: ['printApp', 'photos'], tone: 'request', label: 'DELETE /photos/7', duration: 1.3, delay: 3 },
          { path: ['photos', 'printApp'], tone: 'error', label: '403 insufficient_scope', duration: 1.3, delay: 4.3 },
        ],
        panel: {
          title: 'Consent screen',
          icon: 'Shield',
          rows: [
            { text: 'photos.read', value: 'allowed', tone: 'good' },
            { text: 'photos.write', value: 'not asked', tone: 'muted' },
            { text: 'delete account', value: 'never offered', tone: 'muted' },
          ],
        },
        caption: 'The API enforces the scope the user granted',
      },
    },
    {
      title: 'Machine callers',
      tag: 'concept',
      heading: 'Services need credentials too',
      eli5: 'Sometimes it is a delivery truck and not a guest at the **front desk**. The truck has no person to log in, so it carries its own badge and, for important jobs, shows ID at the loading door.',
      body: [
        'A nightly billing job has no user to log in. An **API key** is a long random string tied to an account, stored hashed like a password and revocable. The **client credentials** grant swaps a client ID and secret for a short-lived token with no user involved.',
        'Inside the network, **mTLS** has both sides present certificates, so each service proves its identity.',
      ],
      keyIdea: 'Give every service its own identity and the least access it needs, so one leak is contained.',
      metrics: { secret: 'client secret', scope: 'orders.read', life: '15 min', revoke: 'disable key' },
      scene: {
        nodes: [
          { id: 'job', kind: 'block', at: at(-5.4, 0), label: 'billing job', sub: 'no user', icon: 'Timer', tint: 'gray', status: 'active' },
          { ...idp, label: 'auth server', sub: 'client credentials' },
          { ...orders, status: 'active', badge: 'mTLS inside' },
        ],
        links: [link('job', 'idp'), link('job', 'orders', { label: 'mTLS', arrow: 'both' })],
        flows: [
          { path: ['job', 'idp'], tone: 'request', label: 'client id + secret', duration: 1.3 },
          { path: ['idp', 'job'], tone: 'response', label: 'token, 15 min', duration: 1.3, delay: 1.4 },
          { path: ['job', 'orders'], tone: 'request', label: 'Bearer token', duration: 1.3, delay: 2.9 },
        ],
        panel: {
          title: 'Machine credentials',
          icon: 'KeyRound',
          rows: [
            { text: 'API key', value: 'long random, hashed' },
            { text: 'client credentials', value: 'short token' },
            { text: 'mTLS', value: 'certificate both ways' },
          ],
          footer: { text: 'One identity per service', tone: 'good' },
        },
        caption: 'A job proves itself with a key, a token or a certificate',
      },
    },
    {
      title: 'OpenID Connect',
      tag: 'concept',
      heading: 'OpenID Connect adds who the user is',
      eli5: 'The desk slip says which room the cleaner may enter, but not who Maya is. Now the desk also gives the app a signed name tag, so the app knows who just checked in.',
      body: [
        'OAuth answers what an app may access. It does not say who the user is. **OpenID Connect** (OIDC) is a thin layer on top: ask for the `openid` scope and the token response also contains an **ID token**, a JWT with claims such as `sub`, `email`, `iss`, `aud` and `exp`.',
        'The app verifies it like any JWT and now knows who logged in. That is what a "Sign in with" button does.',
      ],
      keyIdea: 'OAuth delegates access. OpenID Connect adds a signed ID token that says who the user is.',
      metrics: { secret: 'none shared', scope: 'openid email', life: 'ID token: 5 min', revoke: 'at the IdP' },
      scene: {
        nodes: [
          person,
          { ...printApp, status: 'active', badge: 'knows who: maya' },
          { ...idp, status: 'active' },
        ],
        links: [link('person', 'printApp'), link('printApp', 'idp')],
        flows: [
          { path: ['printApp', 'idp'], tone: 'request', label: 'scope: openid email', duration: 1.3 },
          { path: ['idp', 'printApp'], tone: 'response', label: 'access token + ID token', duration: 1.5, delay: 1.4 },
        ],
        panel: {
          title: 'ID token claims',
          icon: 'FileJson',
          rows: [
            { text: 'sub', value: 'u_8841' },
            { text: 'email', value: 'maya@example.com' },
            { text: 'iss', value: 'idp.example' },
            { text: 'aud', value: 'printhub' },
            { text: 'exp', value: 'in 5 min' },
          ],
        },
        caption: 'The ID token names the user',
      },
    },
    {
      title: 'Single sign-on',
      tag: 'concept',
      heading: 'One login at the provider covers every app',
      eli5: 'The **front desk** of one big hotel group checks you in once. Every hotel in the group trusts that desk, so you walk into the next one and they already know your name.',
      body: [
        'Maya logs in to the identity provider once, and it sets its own session cookie. When she opens the wiki, the wiki redirects her to the same provider, the provider sees its cookie and sends her straight back with a code. No second password prompt.',
        'Older enterprise setups use **SAML** for the same job with XML assertions.',
      ],
      keyIdea: 'The provider keeps one session, and every app trusts it, so one login unlocks many apps.',
      metrics: { secret: 'one login', scope: 'per app', life: 'IdP session 8 h', revoke: 'one place' },
      metricTones: { revoke: 'good' },
      scene: {
        nodes: [person, { ...printApp, status: 'dim' }, { ...idp, status: 'ok', badge: 'already logged in' }, { ...wiki, status: 'active' }],
        links: [link('person', 'wiki'), link('wiki', 'idp', { label: 'redirect' }), link('printApp', 'idp', { style: 'dashed' })],
        flows: [
          { path: ['person', 'wiki'], tone: 'request', label: 'open wiki', duration: 1 },
          { path: ['wiki', 'idp'], tone: 'handshake', label: 'who is this?', duration: 1.2, delay: 1.1 },
          { path: ['idp', 'wiki'], tone: 'response', label: 'ID token: maya', duration: 1.2, delay: 2.4 },
          { path: ['wiki', 'person'], tone: 'response', label: 'welcome, no password', duration: 1, delay: 3.7 },
        ],
        panel: {
          title: 'One login, two apps',
          icon: 'Users',
          rows: [
            { text: 'PrintHub login', value: 'password + MFA' },
            { text: 'wiki login', value: 'reuses IdP cookie', tone: 'good' },
            { text: 'password prompts', value: '1', tone: 'good' },
          ],
        },
        caption: 'The second app reuses the first login',
      },
    },
    {
      title: 'Central control',
      tag: 'tradeoff',
      heading: 'The provider is also one place to fail',
      eli5: 'If the big hotel group desk closes, no hotel can check anyone in. The same desk can also cancel a guest everywhere with one call.',
      body: [
        'The identity provider becomes the one place for password rules, second factors and offboarding. Disable one account there and every connected app loses that user at its next token check.',
        'It is also a single point of failure, so run it like one: replicas, monitoring and a plan for an outage.',
      ],
      keyIdea: 'Central login gives central control and a central risk. Treat the identity provider as critical infrastructure.',
      metrics: { secret: 'one login', scope: 'per app', life: 'IdP session 8 h', revoke: 'one place' },
      metricTones: { revoke: 'good', secret: 'warn' },
      scene: {
        nodes: [
          { ...person, sub: 'fired at 10:00' },
          { ...idp, status: 'hot', load: 55, badge: 'account disabled' },
          { ...printApp, status: 'down', badge: 'token rejected' },
          { ...wiki, at: at(5.6, 3.4), status: 'down', badge: 'token rejected' },
        ],
        links: [link('idp', 'printApp'), link('idp', 'wiki'), link('person', 'idp', { style: 'faint' })],
        flows: [
          { path: ['idp', 'printApp'], tone: 'error', label: 'revoked', duration: 1.3 },
          { path: ['idp', 'wiki'], tone: 'error', label: 'revoked', duration: 1.3, delay: 0.4 },
        ],
        panel: {
          title: 'Central control',
          icon: 'Shield',
          rows: [
            { text: 'offboarding', value: 'one account', tone: 'good' },
            { text: 'MFA rules', value: 'set once', tone: 'good' },
            { text: 'IdP outage', value: 'no new logins', tone: 'bad' },
          ],
        },
        caption: 'One switch ends access everywhere',
      },
    },
    {
      title: 'RBAC',
      tag: 'concept',
      heading: 'Roles first: what kind of user is this?',
      eli5: 'Your card says "guest", so it opens your room and the pool. A card that says "cleaner" opens every room. The **door** reads the word on the card and decides.',
      body: [
        'Identity is settled, so back to the bug from the start. **Role based access control** (RBAC) gives users roles and roles permissions: `customer` can read orders, `support` can refund them, `admin` can do both. It is easy to audit, because you can list who holds each role.',
      ],
      keyIdea: 'Roles answer what kind of user this is, and they are easy to list and audit.',
      metrics: { secret: '-', scope: 'by role', life: '15 min', revoke: 'seconds' },
      scene: {
        nodes: [
          { ...browser, sub: 'user 42, customer' },
          { ...gw, status: 'ok', badge: 'role: customer' },
          { ...orders, status: 'active', chips: [{ text: 'order:read', tone: 'good' }] },
        ],
        links: [link('browser', 'gw'), link('gw', 'orders')],
        flows: [
          { path: ['browser', 'gw', 'orders'], tone: 'request', label: 'GET /orders/981', duration: 1.6 },
          { path: ['orders', 'gw', 'browser'], tone: 'response', label: '200', duration: 1.6, delay: 1.8 },
        ],
        panel: {
          title: 'Role to permissions',
          icon: 'Table',
          rows: [
            { text: 'customer', value: 'order:read' },
            { text: 'support', value: 'read, refund' },
            { text: 'admin', value: 'read, refund, delete' },
          ],
        },
        caption: 'The role grants the action',
      },
    },
    {
      title: 'ABAC',
      tag: 'concept',
      heading: 'Attributes when roles run out',
      eli5: 'The cleaner card opens every room, but a guest card should open only your own room. The door also checks the room number on your card matches the door.',
      body: [
        'Roles alone still let customer 42 read customer 43\'s order. The missing rule compares attributes: the order\'s owner must equal the caller. **Attribute based access control** (ABAC) writes policies over attributes of the user, the resource and the context, such as "support may refund orders under $500 in their own region".',
      ],
      keyIdea: 'Attribute rules answer whether this user may touch this particular object.',
      metrics: { secret: '-', scope: 'by attribute', life: '15 min', revoke: 'seconds' },
      scene: {
        nodes: [
          { ...browser, sub: 'user 42, customer' },
          { ...gw, status: 'ok', badge: 'role ok' },
          { ...orders, status: 'hot', badge: 'owner 43 ≠ caller 42' },
        ],
        links: [link('browser', 'gw'), link('gw', 'orders')],
        flows: [
          { path: ['browser', 'gw', 'orders'], tone: 'request', label: 'GET /orders/981', duration: 1.6 },
          { path: ['orders', 'gw', 'browser'], tone: 'error', label: '403 Forbidden', duration: 1.6, delay: 1.8 },
        ],
        panel: {
          title: 'Attribute check',
          icon: 'Scale',
          rows: [
            { text: 'role', value: 'customer: ok', tone: 'good' },
            { text: 'order owner', value: '43' },
            { text: 'caller', value: '42' },
            { text: 'owner = caller', value: 'false', tone: 'bad' },
          ],
        },
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
      title: 'Where to check',
      tag: 'tradeoff',
      heading: 'Check coarse rules early and ownership near the data',
      eli5: 'The hotel entrance checks "are you a guest at all?". Each room door checks "is this your room?". Never trust a sign on the wall that says the door is locked.',
      body: [
        'Start with a few roles and add attribute checks where a rule depends on the resource. Check coarse rules at the gateway and ownership inside the service that has the data.',
        'Default to deny, and never rely on the UI hiding a button. Give each caller the least privilege that works.',
      ],
      keyIdea: 'Enforce on the server, default to deny, and put each check where the needed data lives.',
      metrics: { secret: '-', scope: 'least privilege', life: '15 min', revoke: 'seconds' },
      metricTones: { scope: 'good' },
      scene: {
        nodes: [
          { ...browser, chips: ['GET /orders/981'] },
          { ...gw, status: 'active', badge: 'coarse: role ok' },
          { ...orders, status: 'active', badge: 'fine: owner check' },
        ],
        links: [link('browser', 'gw'), link('gw', 'orders')],
        flows: [
          { path: ['browser', 'gw'], tone: 'request', label: 'GET /orders/981', duration: 1.2 },
          { path: ['gw', 'orders'], tone: 'request', label: 'X-User-Id: 42', duration: 1.2, delay: 1.3 },
          { path: ['orders', 'browser'], tone: 'error', label: '403 default deny', duration: 1.8, delay: 2.7 },
        ],
        panel: {
          title: 'Who checks what',
          icon: 'Shield',
          rows: [
            { text: 'gateway', value: 'signature, role' },
            { text: 'orders service', value: 'owner, limits' },
            { text: 'no matching rule', value: 'deny', tone: 'good' },
            { text: 'UI hides a button', value: 'no protection', tone: 'bad' },
          ],
        },
        caption: 'Two layers, and deny wins by default',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Delegate with tokens, share one login, authorize every call',
      eli5: 'Maya gives the cleaner a one-room card instead of her key. One big desk checks her in everywhere, and each door still decides whether her kind of card opens it.',
      body: [
        '**OAuth 2** gives a third party a scoped token through the code flow, with PKCE for every client, and services use API keys, client credentials or mTLS. **OpenID Connect** adds an ID token, which gives single sign-on and one place to offboard.',
        'Then apply roles and attribute rules, enforced on the server with deny as the default.',
      ],
      keyIdea: 'OAuth grants access, OIDC says who, and RBAC plus ABAC decide each request. Authorization is always checked on the server.',
      metrics: { secret: 'none shared', scope: 'least privilege', life: '1 h', revoke: 'one place' },
      metricTones: { secret: 'good', scope: 'good', revoke: 'good' },
      scene: {
        nodes: [
          person,
          { ...printApp, status: 'ok' },
          { ...idp, status: 'ok', badge: 'login + consent' },
          { ...photos, status: 'ok', badge: 'scope + owner check' },
        ],
        links: [link('person', 'printApp'), link('printApp', 'idp'), link('printApp', 'photos')],
        flows: [
          { path: ['person', 'printApp', 'idp'], tone: 'handshake', label: 'login + consent', duration: 1.6 },
          { path: ['idp', 'printApp'], tone: 'response', label: 'scoped token', duration: 1.2, delay: 1.8 },
          { path: ['printApp', 'photos'], tone: 'request', label: 'Bearer token', duration: 1.2, delay: 3.1 },
        ],
        panel: {
          title: 'Which tool for which job',
          icon: 'List',
          rows: [
            { text: 'app acts for a user', value: 'OAuth 2 + PKCE' },
            { text: 'who is the user', value: 'OpenID Connect' },
            { text: 'service to service', value: 'client credentials, mTLS' },
            { text: 'what may they do', value: 'RBAC + ABAC' },
          ],
        },
      },
      quiz: {
        question: 'PrintHub wants to read Maya\'s photos, and her company also wants employees to log in to many apps once. Which pairing fits?',
        options: [
          'OAuth 2 with the authorization code flow for PrintHub, and OpenID Connect for single sign-on',
          'Maya shares her password with PrintHub, and each app keeps its own login',
          'API keys for PrintHub, and SAML cookies for the photos API',
          'RBAC for PrintHub, and PKCE for single sign-on',
        ],
        answer: 0,
        explain: 'OAuth 2 delegates scoped access without sharing the password. OpenID Connect adds the ID token that tells apps who logged in, which is what single sign-on builds on. RBAC and PKCE solve other problems.',
      },
    },
  ],
};
