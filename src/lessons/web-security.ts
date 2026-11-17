import type { Lesson, SceneNode } from '../engine/types';

const users: SceneNode = { id: 'users', kind: 'client', at: [-6, 0], label: 'shoppers', sub: 'browsers' };
const bots: SceneNode = { id: 'bots', kind: 'internet', at: [-3, 4], label: 'botnet', sub: 'hostile traffic' };
const edge: SceneNode = { id: 'edge', kind: 'cdn', at: [-3.5, 0], label: 'edge network', sub: 'CDN, many PoPs' };
const waf: SceneNode = { id: 'waf', kind: 'limiter', at: [-1, 0], label: 'WAF', sub: 'rules + rate limits' };
const app: SceneNode = { id: 'app', kind: 'server', at: [1.5, -1], label: 'app servers', sub: 'shop API' };
const db: SceneNode = { id: 'db', kind: 'db', at: [4.5, -1.5], label: 'database', sub: '2M customers' };
const evil: SceneNode = { id: 'evil', kind: 'internet', at: [-3, 4], label: 'other site', sub: 'attacker-controlled' };

const pathLinks = [
  { from: 'users', to: 'edge' },
  { from: 'edge', to: 'waf' },
  { from: 'waf', to: 'app' },
  { from: 'app', to: 'db' },
];

const tiers = [
  { id: 'public', from: [-4.6, -1.3] as [number, number], to: [0.2, 1.3] as [number, number], label: 'public edge', tone: 'blue' as const },
  { id: 'apptier', from: [0.6, -2.3] as [number, number], to: [2.6, 0.3] as [number, number], label: 'app subnet', tone: 'green' as const },
  { id: 'datatier', from: [3.5, -2.8] as [number, number], to: [5.6, -0.3] as [number, number], label: 'data subnet', tone: 'amber' as const },
];

export const webSecurity: Lesson = {
  id: 'web-security',
  title: 'Web security: OWASP, DDoS, firewalls',
  tagline: 'Stack independent layers of defense so one mistake does not become a breach, from the edge to the database grant.',
  minutes: 15,
  level: 'Intermediate',
  learn: [
    'Defense in depth: independent layers, each assuming the others failed',
    'How injection works and why parameterized queries stop it',
    'Cross-site scripting and output encoding',
    'CSRF and the SameSite cookie and token defenses',
    'Absorbing DDoS at the edge and filtering with a web application firewall',
    'Network segmentation and least privilege to shrink the blast radius',
  ],
  metrics: [
    { key: 'layers', label: 'Defense layers' },
    { key: 'origin', label: 'Bad traffic at origin' },
    { key: 'exposed', label: 'Public endpoints' },
    { key: 'blast', label: 'Blast radius' },
  ],
  steps: [
    {
      title: 'One wall',
      tag: 'problem',
      heading: 'One wall, and everything behind it is open',
      eli5: 'A castle has one gate and nothing else. Inside, every room is unlocked and the treasure sits in the hall. Get past the **gate** once and you can take anything.',
      body: [
        'The shop runs app servers with public IP addresses. The database also has a public address, protected only by its password. The app connects as the database owner account. The only control is a login form.',
        'Any single slip now goes all the way. One unsafe query in the search box reads the whole customers table. One flood of traffic takes the app servers down, because they face the internet directly. One leaked database password opens the data from anywhere in the world.',
        'Security people call this a hard shell with a soft center. The fix is more layers that do not depend on each other, so a failure in one is caught by the next.',
      ],
      keyIdea: 'If a single bug or a single leaked password can reach the data, the design has one layer, however strong that layer looks.',
      metrics: { layers: '1', origin: '100%', exposed: 'app + DB', blast: 'everything' },
      scene: {
        nodes: [users, { ...bots, status: 'hot' }, { ...app, status: 'hot', badge: 'public IP' }, { ...db, status: 'hot', badge: 'public IP, owner login' }],
        links: [
          { from: 'users', to: 'app' },
          { from: 'bots', to: 'app' },
          { from: 'bots', to: 'db', style: 'dashed' },
          { from: 'app', to: 'db' },
        ],
        flows: [
          { path: ['users', 'app'], tone: 'request', duration: 1.4 },
          { path: ['bots', 'app'], tone: 'error', label: 'flood + probes', count: 4, duration: 1.2, delay: 0.4 },
          { path: ['bots', 'db'], tone: 'error', label: 'port scan', duration: 1.6, delay: 1.8 },
        ],
        caption: 'Everything is reachable from the internet',
      },
    },
    {
      title: 'In depth',
      tag: 'concept',
      heading: 'Defense in depth: layers that fail independently',
      eli5: 'A real castle has a moat, an outer wall, guards at the gate, locked doors inside and a vault for the gold. A thief must beat every **layer**, and each one is run by different people.',
      body: [
        '**Defense in depth** stacks controls so that each layer assumes the one in front of it has already failed. The request path becomes: an edge network that soaks up floods, a **web application firewall** that filters known attack patterns, app code that treats all input as untrusted, a private network the database lives in, and a database account that can do only what the app needs.',
        'The layers should fail for different reasons. A WAF rule and a parameterized query both stop injection, but the WAF fails on a clever encoding and the query fails only if a developer skips it. Two different failure causes are far less likely to line up.',
        'The **OWASP Top 10** is a widely used list of the most common web application risks, maintained by the Open Worldwide Application Security Project. It is a good checklist for which layers you need. The next few steps walk through three classic entries.',
      ],
      keyIdea: 'Each layer should assume the layer in front of it failed, and layers should fail for different reasons.',
      metrics: { layers: '5', origin: 'filtered', exposed: 'edge only', blast: 'contained' },
      scene: {
        zones: tiers,
        nodes: [users, edge, waf, app, db],
        links: pathLinks,
        flows: [
          { path: ['users', 'edge', 'waf', 'app', 'db'], tone: 'request', label: 'checked at each hop', duration: 3 },
          { path: ['db', 'app', 'waf', 'edge', 'users'], tone: 'response', duration: 3, delay: 3.1 },
        ],
        caption: 'Edge, filter, code, network, permissions',
      },
    },
    {
      title: 'Injection',
      tag: 'concept',
      heading: 'Injection: when data gets read as code',
      eli5: 'A visitor writes a note for the **cook**: "one soup, and also open the vault". A careless cook reads the whole note as orders. A careful cook only ever fills the note into the "dish name" box.',
      body: [
        '**Injection** happens when untrusted input is pasted into text that another system parses as instructions: a SQL query, a shell command, an LDAP filter. If the search box value is glued into `SELECT ... WHERE name = \'` + input + `\'`, a quote character in the input ends the string early and whatever follows becomes part of the query.',
        'The defense is a **parameterized query** (a prepared statement). The query text, with placeholders, goes to the database separately from the values. The database parses the structure first, then binds the values as pure data. No value can change the shape of the query, whatever characters it holds.',
        'Use the driver\'s placeholders or an ORM everywhere, including in admin tools and reports. Validate input against what you expect (an ID is digits) as a second layer, and never build shell commands from user input.',
      ],
      keyIdea: 'Keep code and data in separate channels. Parameterized queries make it impossible for a value to rewrite the query.',
      metrics: { layers: '5', origin: 'filtered', exposed: 'edge only', blast: 'contained' },
      scene: {
        zones: tiers,
        nodes: [users, edge, waf, { ...app, status: 'active', badge: 'placeholders only' }, { ...db, status: 'ok', badge: 'value bound as data' }],
        links: pathLinks,
        flows: [
          { path: ['users', 'edge', 'waf', 'app'], tone: 'request', label: 'search: odd input', duration: 2.2 },
          { path: ['app', 'db'], tone: 'request', label: 'query + params', duration: 1, delay: 2.3 },
          { path: ['db', 'app'], tone: 'response', label: '0 rows', duration: 1, delay: 3.4 },
        ],
        caption: 'The input is searched for, never executed',
      },
      code: {
        language: 'python',
        title: 'String building versus a parameterized query',
        source: `# Unsafe: the input becomes part of the SQL text.
def find_unsafe(name):
    sql = "SELECT id, name FROM products WHERE name = '" + name + "'"
    return db.execute(sql)

# Safe: SQL text and values travel separately.
def find(name):
    return db.execute(
        "SELECT id, name FROM products WHERE name = %s",
        (name,),                 # bound by the driver as a value
    )

# Placeholders cannot stand in for identifiers, so allowlist those.
SORTABLE = {"name", "price", "created_at"}
def list_products(sort):
    col = sort if sort in SORTABLE else "name"
    return db.execute(f"SELECT id, name FROM products ORDER BY {col} LIMIT 50")`,
        highlight: [3, 9, 10, 16],
      },
    },
    {
      title: 'XSS',
      tag: 'concept',
      heading: 'Cross-site scripting: encode output for where it lands',
      eli5: 'A visitor pins a note on the castle notice board, and the note secretly contains instructions that other readers end up following. The **scribe** copies every note in plain ink so it can only ever be read, never obeyed.',
      body: [
        '**Cross-site scripting** (XSS) is injection into a web page. A product review containing markup is saved, then rendered into other shoppers\' pages. If the browser treats it as HTML, a script runs inside your site, with access to the page, the user\'s actions and any token stored where scripts can read it.',
        'The core defense is **output encoding**: when you place data into HTML, convert special characters such as `<` and `"` into their escaped forms, using the rules for that context (HTML body, attribute, URL, JavaScript). Modern templating engines and frameworks such as React do this by default. Danger appears when code switches it off, for example with `innerHTML` or `dangerouslySetInnerHTML`.',
        'Add layers behind it. A **Content Security Policy** header tells the browser which script sources are allowed, so injected inline script does not run. `HttpOnly` cookies keep session IDs out of reach of scripts. If you must accept rich text, run it through a well-maintained HTML sanitizer.',
      ],
      keyIdea: 'Treat stored user content as text. Encode it for the exact place it is written, and let CSP catch what slips through.',
      metrics: { layers: '5', origin: 'filtered', exposed: 'edge only', blast: 'contained' },
      scene: {
        zones: tiers,
        nodes: [{ ...users, status: 'ok', badge: 'shows text, runs nothing' }, edge, waf, { ...app, status: 'active', badge: 'escape on render' }, db],
        links: pathLinks,
        flows: [
          { path: ['db', 'app'], tone: 'response', label: 'review text', duration: 1 },
          { path: ['app', 'waf', 'edge', 'users'], tone: 'response', label: '&lt;b&gt; as text + CSP', duration: 2.4, delay: 1.1 },
        ],
        caption: 'User content is rendered as text, never as code',
      },
      code: {
        language: 'typescript',
        title: 'Escaping by default, and the header that backs it up',
        source: `// Safe: React escapes text placed in JSX.
function Review({ text }: { text: string }) {
  return <p className="review">{text}</p>;
}

// Unsafe: raw HTML from a user goes straight into the page.
function ReviewUnsafe({ text }: { text: string }) {
  return <p dangerouslySetInnerHTML={{ __html: text }} />;
}

// Server: allow scripts only from our own origin, no inline script.
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'",
  );
  next();
});`,
        highlight: [3, 8, 15],
      },
    },
    {
      title: 'CSRF',
      tag: 'concept',
      heading: 'CSRF: a request the user never meant to send',
      eli5: 'A stranger tricks you into carrying a sealed letter to the castle. The **gatekeeper** sees your face and lets it in. Now the gatekeeper only accepts letters that carry a secret mark given to you inside the castle.',
      body: [
        '**Cross-site request forgery** (CSRF) abuses the fact that browsers attach cookies automatically. A shopper is logged in to the shop. They visit another site, which quietly submits a form to `shop.example/account/email`. The browser adds the session cookie, and the shop sees a valid, logged-in request it did not ask for.',
        'The first defense is the cookie itself. With `SameSite=Lax` (the default in current major browsers when no value is set) or `Strict`, the browser leaves the cookie off cross-site form posts and background requests. Set it explicitly rather than relying on a default.',
        'The second is a **CSRF token**: a random value tied to the session, put in each form or sent as a header, and checked by the server on every state-changing request. Another site cannot read it, so it cannot forge it. Also keep `GET` free of side effects, and APIs that use an `Authorization` header instead of cookies are not exposed in the same way.',
      ],
      keyIdea: 'Cookies prove which browser sent a request, not that the user intended it. SameSite cookies and a per-session token close that gap.',
      metrics: { layers: '5', origin: 'filtered', exposed: 'edge only', blast: 'contained' },
      scene: {
        zones: tiers,
        nodes: [{ ...users, sub: 'logged in to shop' }, { ...evil, status: 'hot' }, edge, waf, { ...app, status: 'ok', badge: 'token missing: 403' }],
        links: [
          { from: 'users', to: 'edge' },
          { from: 'evil', to: 'users', style: 'dashed' },
          { from: 'edge', to: 'waf' },
          { from: 'waf', to: 'app' },
        ],
        flows: [
          { path: ['evil', 'users'], tone: 'event', label: 'hidden form', duration: 1.2 },
          { path: ['users', 'edge', 'waf', 'app'], tone: 'request', label: 'POST, no token', duration: 2.2, delay: 1.3 },
          { path: ['app', 'waf', 'edge', 'users'], tone: 'error', label: '403', duration: 2.2, delay: 3.6 },
        ],
        caption: 'The forged request lacks the secret token',
      },
      quiz: {
        question: 'Which pair of defenses targets CSRF specifically?',
        options: [
          'Parameterized queries and input length limits',
          'SameSite cookies and a per-session token checked on state-changing requests',
          'Output encoding and a Content Security Policy',
          'TLS and HSTS',
        ],
        answer: 1,
        explain: 'CSRF works because the browser attaches cookies to cross-site requests. SameSite stops that for most requests, and the token proves the request came from your own page. The other pairs defend against injection, XSS and eavesdropping.',
      },
    },
    {
      title: 'DDoS',
      tag: 'case',
      heading: 'Case: a flood far bigger than the origin',
      eli5: 'A huge crowd swarms the road to the castle so real visitors cannot reach the gate. The castle hires a ring of **outer gates** across the whole country, each big enough to turn the crowd away near where it starts.',
      body: [
        'On a sale day a botnet sends hundreds of gigabits per second at the shop. The data center link is 10 Gbps. No server tuning helps: the pipe is full before a packet reaches a machine. This is a **volumetric** attack. Others target protocols (floods of half-open connections) or the application (many expensive, valid-looking requests).',
        'You absorb the volume at the **edge**. A CDN or DDoS protection service announces your address from many points of presence (anycast), so the flood is spread across a network built with far more capacity than one site. Floods of malformed or unwanted packets are dropped there. The origin only accepts connections from the edge provider\'s address ranges, so its real IP is not worth attacking directly.',
        'Application-layer floods look like real users and need smarter filtering: per-client rate limits from the rate limiting lesson, challenges for suspicious clients, and caching so most requests never reach the origin anyway.',
      ],
      keyIdea: 'You cannot out-provision a botnet at one site. Spread the flood across a large edge network and hide the origin behind it.',
      metrics: { layers: '5', origin: '<1% of flood', exposed: 'edge only', blast: 'edge absorbs' },
      scene: {
        zones: tiers,
        nodes: [users, { ...bots, status: 'hot', badge: '100s of Gbps' }, { ...edge, status: 'active', badge: 'absorbs + drops' }, waf, { ...app, status: 'ok', badge: 'edge IPs only' }],
        links: [{ from: 'users', to: 'edge' }, { from: 'bots', to: 'edge' }, { from: 'edge', to: 'waf' }, { from: 'waf', to: 'app' }],
        flows: [
          { path: ['bots', 'edge'], tone: 'error', label: 'flood', count: 7, duration: 1 },
          { path: ['users', 'edge', 'waf', 'app'], tone: 'request', label: 'real shopper', duration: 2.4, delay: 0.6 },
          { path: ['app', 'waf', 'edge', 'users'], tone: 'response', duration: 2.4, delay: 3.1 },
        ],
        caption: 'The flood dies at the edge, shoppers get through',
      },
    },
    {
      title: 'WAF',
      tag: 'tradeoff',
      heading: 'The web application firewall: a filter with false positives',
      eli5: 'Guards at the **inner gate** check every visitor against a list of known tricks and turn away anyone carrying a crowbar. Sometimes they stop an honest builder too, so they watch first before they start blocking.',
      body: [
        'A network firewall decides by address and port. A **web application firewall** (WAF) reads HTTP: paths, headers, bodies. It blocks requests that match known attack patterns for injection and XSS, enforces rate limits per client, and can block by country or reputation. Managed rule sets are updated by the vendor when a new widespread flaw appears, which buys time to patch.',
        'The price is **false positives**. A recipe site whose users post text with SQL-like words, or a developer forum full of code, will trip generic rules. Run new rules in count-only mode first, look at what they would have blocked, then switch to block.',
        'A WAF is a layer, never the fix. Encodings and new tricks get past pattern matching, and a WAF knows nothing of your business rules. It cannot tell that user 42 should not read order 981. Keep the parameterized queries and authorization checks behind it.',
      ],
      keyIdea: 'A WAF filters common attacks at the door and buys patch time. It complements safe code, it does not replace it.',
      metrics: { layers: '5', origin: 'filtered', exposed: 'edge only', blast: 'contained' },
      scene: {
        zones: tiers,
        nodes: [users, { ...bots, label: 'scanner', sub: 'probing forms' }, edge, { ...waf, status: 'active', badge: 'rule match: block' }, app],
        links: [{ from: 'users', to: 'edge' }, { from: 'bots', to: 'edge' }, { from: 'edge', to: 'waf' }, { from: 'waf', to: 'app' }],
        flows: [
          { path: ['bots', 'edge', 'waf'], tone: 'request', label: 'injection pattern', count: 3, duration: 1.8 },
          { path: ['waf', 'edge', 'bots'], tone: 'error', label: '403', duration: 1.8, delay: 1.9 },
          { path: ['users', 'edge', 'waf', 'app'], tone: 'request', label: 'normal POST', duration: 2.4, delay: 1 },
        ],
        caption: 'Known patterns stop at the filter',
      },
    },
    {
      title: 'Segmentation',
      tag: 'concept',
      heading: 'Network segmentation: only the next layer may talk to you',
      eli5: 'The castle is split into courtyards with their own doors. Visitors reach only the outer yard, cooks reach only the kitchen, and only the cooks\' door leads to the **vault room**.',
      body: [
        'Put each tier in its own subnet with rules that allow only the traffic it needs. The edge is the only thing with a public address. The app subnet accepts connections only from the WAF or load balancer. The data subnet accepts port 5432 only from the app subnet. Everything else is denied by default.',
        'Now the leaked database password from step one is much less useful, because nothing on the internet can reach the database at all. A compromised app server can talk to the database, but it cannot reach the payroll system in another segment.',
        'Admin access goes through one audited path, such as a bastion host or a session manager with single sign-on, never through SSH open to the world. Watch the rules over time: "temporary" allow-all rules are a common way for segments to quietly merge.',
      ],
      keyIdea: 'Segmentation turns "reachable from anywhere" into "reachable only from the layer in front", so one breach cannot walk sideways.',
      metrics: { layers: '5', origin: 'filtered', exposed: 'edge only', blast: 'one segment' },
      scene: {
        zones: tiers,
        nodes: [{ ...bots, label: 'internet' }, { ...edge, status: 'ok', badge: 'only public IP' }, waf, { ...app, badge: 'from WAF only' }, { ...db, status: 'ok', badge: '5432 from app only' }],
        links: [{ from: 'bots', to: 'edge' }, { from: 'edge', to: 'waf' }, { from: 'waf', to: 'app' }, { from: 'app', to: 'db' }, { from: 'bots', to: 'db', style: 'faint' }],
        flows: [
          { path: ['bots', 'db'], tone: 'error', label: 'no route', duration: 1.6 },
          { path: ['edge', 'waf', 'app', 'db'], tone: 'request', label: 'allowed path', duration: 2.4, delay: 1.7 },
        ],
        caption: 'Each tier accepts traffic only from the tier before it',
      },
    },
    {
      title: 'Least privilege',
      tag: 'concept',
      heading: 'Least privilege: shrink what a stolen identity can do',
      eli5: 'The cook\'s key opens the pantry and nothing else. If someone steals it, they get flour and eggs. The **vault** needs a different key that the cook never carries.',
      body: [
        'Assume an attacker eventually runs code as your app. What they can do next equals what the app\'s identity is allowed to do. As database owner they can drop tables, read every schema and create new logins. As a narrow role they get much less.',
        '**Least privilege** means each identity gets the smallest set of permissions its job needs. The shop API reads and writes orders and products and reads, never writes, the pricing table. Migrations run with a separate account, only during deploys. Reporting uses a read-only replica account. The same applies to cloud roles: the image resizer may read one bucket, not every bucket.',
        'Review grants regularly and remove the ones no longer used. Combine this with the secrets manager from the encryption lesson, so each service fetches only its own credentials.',
      ],
      keyIdea: 'Give every identity the minimum it needs, so a compromise in one place stays a small incident.',
      metrics: { layers: '5', origin: 'filtered', exposed: 'edge only', blast: 'one role' },
      scene: {
        zones: tiers,
        nodes: [waf, { ...app, status: 'active', badge: 'role: shop_api' }, { ...db, status: 'ok', badge: 'DROP denied' }],
        links: [{ from: 'waf', to: 'app' }, { from: 'app', to: 'db' }],
        flows: [
          { path: ['app', 'db'], tone: 'request', label: 'INSERT order', duration: 1 },
          { path: ['db', 'app'], tone: 'response', label: 'ok', duration: 1, delay: 1.1 },
          { path: ['app', 'db'], tone: 'request', label: 'DROP TABLE', duration: 1, delay: 2.3 },
          { path: ['db', 'app'], tone: 'error', label: 'permission denied', duration: 1, delay: 3.4 },
        ],
        caption: 'The app can do its job and nothing more',
      },
      code: {
        language: 'sql',
        title: 'A narrow database role for the shop API (Postgres)',
        source: `-- The app logs in as shop_api, never as the owner.
CREATE ROLE shop_api LOGIN;

GRANT CONNECT ON DATABASE shop TO shop_api;
GRANT USAGE ON SCHEMA public TO shop_api;

GRANT SELECT, INSERT, UPDATE ON orders, order_items TO shop_api;
GRANT SELECT ON products, prices TO shop_api;
GRANT USAGE ON SEQUENCE orders_id_seq TO shop_api;

-- No DELETE, no DDL, no access to staff or payroll tables.
REVOKE ALL ON staff, payroll FROM shop_api;

-- Migrations use a different role, only from the deploy pipeline.
CREATE ROLE shop_migrator LOGIN;`,
        highlight: [2, 7, 8, 12],
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Layers that each assume the others failed',
      eli5: 'The castle now has outer gates spread across the land, guards who know the tricks, cooks who read notes carefully, separate courtyards, and keys that open only one room. Beating one **layer** gets a thief almost nothing.',
      body: [
        '**Defense in depth** stacks independent controls. In the code: **parameterized queries** stop injection, **output encoding** and CSP stop XSS, and **SameSite cookies** plus CSRF tokens stop forged requests. At the edge: a large edge network absorbs **DDoS** floods and hides the origin, and a **WAF** filters known patterns, with care for false positives.',
        'Behind it all, **network segmentation** limits who can reach each tier, and **least privilege** limits what each identity can do once it is in. The OWASP Top 10 is a useful checklist for which of these you still lack.',
      ],
      keyIdea: 'No single control is perfect. Security comes from layers that fail for different reasons and from keeping each breach small.',
      metrics: { layers: '5', origin: '<1% of flood', exposed: 'edge only', blast: 'one role' },
      scene: {
        zones: tiers,
        nodes: [users, { ...bots, status: 'dim' }, { ...edge, status: 'ok' }, { ...waf, status: 'ok' }, app, { ...db, status: 'ok' }],
        links: [...pathLinks, { from: 'bots', to: 'edge' }],
        flows: [
          { path: ['bots', 'edge'], tone: 'error', count: 3, duration: 1 },
          { path: ['users', 'edge', 'waf', 'app', 'db'], tone: 'request', duration: 3, delay: 0.5 },
          { path: ['db', 'app', 'waf', 'edge', 'users'], tone: 'response', duration: 3, delay: 3.6 },
        ],
      },
      quiz: {
        question: 'Your WAF blocks common injection patterns. A teammate says the team can stop using parameterized queries. What is the best response?',
        options: [
          'Agree, the WAF already filters injection',
          'Disagree: a WAF matches patterns and can be bypassed, while parameterized queries remove the flaw in the code itself',
          'Agree, as long as the database uses TLS',
          'Disagree, because a WAF only works against DDoS',
        ],
        answer: 1,
        explain: 'Defense in depth needs layers that fail for different reasons. Pattern matching misses new encodings. Parameterized queries make the query structure fixed regardless of input, so they stay as the primary defense and the WAF is a backstop.',
      },
    },
  ],
};
