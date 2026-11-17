import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const shopper: SceneNode = { id: 'shopper', kind: 'client', at: at(-5.4, 0), label: 'shopper', sub: 'browser' };
const attacker: SceneNode = { id: 'attacker', kind: 'internet', at: at(-5.4, 3.8), label: 'attacker', sub: 'hostile input', tint: 'red' };
const waf: SceneNode = { id: 'waf', kind: 'block', size: 0.8, at: at(-1.8, 0), label: 'WAF', sub: 'known patterns', icon: 'Shield', tint: 'amber' };
const app: SceneNode = { id: 'app', kind: 'server', at: at(1.8, 0), label: 'app servers', sub: 'shop API' };
const db: SceneNode = { id: 'db', kind: 'db', at: at(5.4, 0), label: 'database', sub: '2M customers' };
const evil: SceneNode = { id: 'evil', kind: 'internet', at: at(-5.4, 3.8), label: 'other site', sub: 'attacker page', tint: 'red' };

export const webSecurity: Lesson = {
  id: 'web-security',
  title: 'Web security (part 1): layers and app flaws',
  tagline: 'Stack independent layers of defense, then close the classic holes in the app itself: injection, XSS, CSRF, broken access and weak logins.',
  minutes: 15,
  level: 'Intermediate',
  learn: [
    'Defense in depth: independent layers, each assuming the others failed',
    'The OWASP Top 10 as a checklist of common risks',
    'How injection works and why parameterized queries stop it',
    'Cross-site scripting, output encoding, CSP and HttpOnly cookies',
    'CSRF and the SameSite cookie and token defenses',
    'Broken access control, safe password storage and login protection',
    'Browser security headers: HSTS, frame-ancestors and CORS',
  ],
  metrics: [
    { key: 'layers', label: 'Layers working', icon: 'Layers' },
    { key: 'flaws', label: 'Open flaw classes', icon: 'Bug' },
    { key: 'blast', label: 'Blast radius', icon: 'Boxes' },
  ],
  steps: [
    {
      title: 'One wall',
      tag: 'problem',
      heading: 'One wall, and everything behind it is open',
      eli5: 'A castle has one gate and nothing else. Inside, every room is unlocked and the treasure sits in the hall. Get past the **gate** once and you can take anything.',
      body: [
        'The shop runs app servers with public IP addresses. The database also has a public address, protected only by its password, and the app connects as the database owner. The only control is a login form.',
        'Any single slip now goes all the way. Security people call this a hard shell with a soft center.',
      ],
      keyIdea: 'If a single bug or a single leaked password can reach the data, the design has one layer, however strong that layer looks.',
      metrics: { layers: '1', flaws: 'all', blast: 'everything' },
      metricTones: { layers: 'bad', flaws: 'bad', blast: 'bad' },
      scene: {
        nodes: [
          shopper,
          { ...attacker, at: at(-1.8, 3.8), status: 'hot' },
          { ...app, status: 'hot', badge: 'public IP' },
          { ...db, status: 'hot', badge: 'public IP, owner login' },
        ],
        links: [link('shopper', 'app'), link('attacker', 'app'), link('attacker', 'db', { style: 'dashed' }), link('app', 'db')],
        flows: [
          { path: ['shopper', 'app'], tone: 'request', duration: 1.4 },
          { path: ['attacker', 'app'], tone: 'error', label: 'probes', count: 3, duration: 1.4, delay: 0.5 },
          { path: ['attacker', 'db'], tone: 'error', label: 'direct login', duration: 1.8, delay: 2 },
        ],
        panel: {
          title: 'What one slip reaches',
          icon: 'Bug',
          rows: [
            { text: 'Unsafe search query', value: 'whole customers table', tone: 'bad' },
            { text: 'Traffic flood', value: 'app servers down', tone: 'bad' },
            { text: 'Leaked DB password', value: 'data, from anywhere', tone: 'bad' },
          ],
          footer: { text: 'Every failure goes all the way in', tone: 'bad' },
        },
        caption: 'Everything is reachable from the internet',
      },
    },
    {
      title: 'In depth',
      tag: 'concept',
      heading: 'Defense in depth: layers that fail independently',
      eli5: 'A real castle has a moat, an outer wall, guards at the gate, locked doors inside and a vault for the gold. A thief must beat every **layer**, and each one is run by different people.',
      body: [
        '**Defense in depth** stacks controls so each layer assumes the one in front has already failed: an edge network, a **web application firewall**, app code that treats all input as untrusted, a private network, and a database account that can do only what the app needs.',
      ],
      keyIdea: 'Each layer should assume the layer in front of it failed.',
      metrics: { layers: '5', flaws: 'some', blast: 'contained' },
      metricTones: { layers: 'good', blast: 'good' },
      scene: {
        nodes: [
          shopper,
          { ...waf, status: 'ok', badge: 'layer 2' },
          { ...app, status: 'active', badge: 'layer 3: code' },
          { ...db, status: 'ok', badge: 'layers 4 and 5' },
        ],
        links: [link('shopper', 'waf'), link('waf', 'app'), link('app', 'db')],
        flows: [
          { path: ['shopper', 'waf', 'app', 'db'], tone: 'request', label: 'checked at each hop', duration: 3 },
          { path: ['db', 'app', 'waf', 'shopper'], tone: 'response', duration: 3, delay: 3.1 },
        ],
        panel: {
          title: 'Five independent layers',
          icon: 'Layers',
          rows: [
            { text: '1 Edge network', value: 'soaks up floods' },
            { text: '2 WAF', value: 'filters known patterns' },
            { text: '3 App code', value: 'input is untrusted' },
            { text: '4 Private network', value: 'DB not reachable' },
            { text: '5 DB account', value: 'least privilege' },
          ],
        },
        caption: 'Edge, filter, code, network, permissions',
      },
    },
    {
      title: 'Different failures',
      tag: 'concept',
      heading: 'Layers should fail for different reasons',
      eli5: 'The guards and the lock on the door are run by different people. A trick that fools the **guard** will not also fool the lock, so a thief needs two lucky breaks.',
      body: [
        'A WAF rule and a parameterized query both stop injection. The WAF fails on a clever encoding. The query fails only if a developer skips it. Two different failure causes are far less likely to line up than two copies of the same control.',
      ],
      keyIdea: 'Two layers with the same weakness count as one.',
      metrics: { layers: '5', flaws: 'some', blast: 'contained' },
      scene: {
        nodes: [
          { ...attacker, status: 'hot', chips: [{ text: "' OR 1=1 --", tone: 'bad' }] },
          { ...waf, status: 'hot', badge: 'fooled by encoding' },
          { ...app, status: 'ok', badge: 'query: bound value' },
        ],
        links: [link('attacker', 'waf'), link('waf', 'app')],
        flows: [
          { path: ['attacker', 'waf', 'app'], tone: 'error', label: 'encoded payload', duration: 2.2 },
          { path: ['app', 'waf', 'attacker'], tone: 'response', label: '0 rows', duration: 2.2, delay: 2.4 },
        ],
        panel: {
          title: 'Why two layers help',
          icon: 'Scale',
          rows: [
            { text: 'WAF fails when', value: 'new encoding', tone: 'warn' },
            { text: 'Parameterized query fails when', value: 'developer skips it', tone: 'warn' },
            { text: 'Both fail together', value: 'rarely', tone: 'good' },
          ],
        },
        caption: 'The second layer catches what the first missed',
      },
    },
    {
      title: 'OWASP',
      tag: 'concept',
      heading: 'The OWASP Top 10: a checklist of common risks',
      eli5: 'Castle builders keep a famous list of the ten ways thieves most often get in. Before you build, you walk the list and check that each **door** has a lock.',
      body: [
        'The **OWASP Top 10** is a widely used list of the most common web application risks, kept by the Open Worldwide Application Security Project. Broken access control and injection sit near the top, alongside security misconfiguration, weak authentication and vulnerable components.',
        'Use it to decide which layers you still lack.',
      ],
      keyIdea: 'The OWASP Top 10 is a checklist for which layers you still lack, not a standard you pass once.',
      metrics: { layers: '5', flaws: 'listed', blast: '-' },
      scene: {
        nodes: [
          { id: 'owasp', kind: 'block', at: at(-2.7, 0), label: 'OWASP Top 10', sub: 'risk checklist', icon: 'List', tint: 'violet' },
          { ...app, status: 'active', badge: 'audit against list' },
        ],
        links: [link('owasp', 'app', { label: 'check each risk' })],
        flows: [{ path: ['owasp', 'app'], tone: 'request', label: 'which holes?', duration: 1.8 }],
        panel: {
          title: 'Entries on the list',
          icon: 'List',
          rows: [
            { text: 'Broken access control', value: 'this part' },
            { text: 'Injection, including XSS', value: 'this part' },
            { text: 'Authentication failures', value: 'this part' },
            { text: 'Security misconfiguration', value: 'this part' },
            { text: 'Vulnerable components, SSRF', value: 'part 2' },
            { text: 'Logging and monitoring gaps', value: 'part 2' },
          ],
        },
        caption: 'A map of where the common holes are',
      },
    },
    {
      title: 'Injection',
      tag: 'concept',
      heading: 'Injection: when data gets read as code',
      eli5: 'A visitor writes a note for the **cook**: "one soup, and also open the vault". A careless cook reads the whole note as orders.',
      body: [
        '**Injection** happens when untrusted input is pasted into text that another system parses as instructions. If the search box value is glued into `WHERE name = \'` + input + `\'`, a quote in the input ends the string early and whatever follows becomes part of the query.',
      ],
      keyIdea: 'When data and code share one string, the data can rewrite the code.',
      metrics: { layers: '3', flaws: 'injection', blast: 'whole table' },
      metricTones: { flaws: 'bad', blast: 'bad' },
      scene: {
        nodes: [
          { ...attacker, status: 'hot', chips: [{ text: "x' OR '1'='1", tone: 'bad' }] },
          { ...app, status: 'hot', badge: 'glues text together' },
          { ...db, status: 'hot', badge: 'runs the whole string' },
        ],
        links: [link('attacker', 'app'), link('app', 'db')],
        flows: [
          { path: ['attacker', 'app'], tone: 'error', label: "search: x' OR ...", duration: 1.6 },
          { path: ['app', 'db'], tone: 'error', label: 'query now matches all', duration: 1.4, delay: 1.7 },
          { path: ['db', 'app', 'attacker'], tone: 'error', label: '2M rows', duration: 2.4, delay: 3.2 },
        ],
        panel: {
          title: 'The query the database sees',
          icon: 'Code',
          code: "SELECT id, email FROM customers\nWHERE name = 'x' OR '1'='1'",
          footer: { text: 'The quote ended the string early', tone: 'bad' },
        },
        caption: 'The input became part of the query',
      },
    },
    {
      title: 'Parameterized',
      tag: 'concept',
      heading: 'Parameterized queries keep code and data apart',
      eli5: 'A careful cook only ever copies the note into the "dish name" box on the order form. Whatever the note says, it stays a dish name, never an order.',
      body: [
        'A **parameterized query** keeps the query text and the values apart, so the driver or database treats values as data. Server-side prepared statements do the split on the server. Some drivers, such as psycopg2, escape and substitute on the client. Either way, no value can change the query.',
        'Use placeholders or an ORM everywhere, including admin tools and reports. Also validate input against what you expect (an ID is digits) as a second layer.',
      ],
      keyIdea: 'Keep code and data in separate channels. Parameterized queries make it impossible for a value to rewrite the query.',
      metrics: { layers: '3', flaws: 'closed', blast: 'contained' },
      metricTones: { flaws: 'good', blast: 'good' },
      scene: {
        nodes: [
          { ...attacker, chips: [{ text: "x' OR '1'='1", tone: 'warn' }] },
          { ...app, status: 'active', badge: 'placeholders only' },
          { ...db, status: 'ok', badge: 'value bound as data' },
        ],
        links: [link('attacker', 'app'), link('app', 'db')],
        flows: [
          { path: ['attacker', 'app'], tone: 'request', label: 'search: odd input', duration: 1.6 },
          { path: ['app', 'db'], tone: 'request', label: 'query + params', duration: 1.2, delay: 1.7 },
          { path: ['db', 'app', 'attacker'], tone: 'response', label: '0 rows', duration: 2.2, delay: 3.1 },
        ],
        panel: {
          title: 'Two separate messages',
          icon: 'Code',
          code: "Postgres protocol\ntext:   WHERE name = $1\nvalue:  x' OR '1'='1",
          footer: { text: 'The input is searched for, never executed', tone: 'good' },
        },
        caption: 'The structure is fixed before the value arrives',
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
      quiz: {
        question: 'Why does a parameterized query stop SQL injection?',
        options: [
          'It removes quote characters from every input',
          'Values are kept as data by the driver or database, so a value cannot change the query',
          'It encrypts the query on the way to the database',
          'It limits how long an input can be',
        ],
        answer: 1,
        explain: 'Stripping characters misses cases and breaks valid input. Keeping values as data keeps code and data in separate channels, whatever characters a value holds.',
      },
    },
    {
      title: 'Beyond SQL',
      tag: 'concept',
      heading: 'Every interpreter can be injected',
      eli5: 'Notes can trick the cook, the baker and the cellar keeper too. Each one needs their own order form.',
      body: [
        'The same flaw hits shell commands, LDAP filters, NoSQL queries and template engines. Never build shell commands from user input. Where placeholders cannot reach, such as a column name in `ORDER BY`, allow only values from a fixed list. If you must run a program, pass an argument list with no shell.',
      ],
      keyIdea: 'Treat every system that parses text as an injection target, and give each one its own safe channel.',
      metrics: { layers: '3', flaws: 'injection', blast: 'contained' },
      scene: {
        nodes: [
          { ...attacker, chips: [{ text: 'id=42; rm -rf /', tone: 'bad' }] },
          { ...app, status: 'active', badge: 'fixed args only' },
          { id: 'shell', kind: 'block', size: 0.8, at: at(5.4, 0), label: 'OS shell', sub: 'never from input', icon: 'Cpu', tint: 'gray', status: 'ok' },
        ],
        links: [link('attacker', 'app'), link('app', 'shell', { style: 'faint' })],
        flows: [
          { path: ['attacker', 'app'], tone: 'error', label: 'id=42; rm -rf /', duration: 1.8 },
          { path: ['app', 'attacker'], tone: 'response', label: '400 rejected', duration: 1.8, delay: 2 },
        ],
        panel: {
          title: 'Where injection hides',
          icon: 'List',
          rows: [
            { text: 'SQL query', value: 'placeholders' },
            { text: 'Shell command', value: 'arg list, shell=False' },
            { text: 'NoSQL / LDAP filter', value: 'driver binding' },
            { text: 'ORDER BY column', value: 'allowlist', tone: 'good' },
          ],
        },
        caption: 'Rejected before it reaches any interpreter',
      },
      code: {
        language: 'python',
        title: 'A shell call built from input versus an argument list',
        source: `import subprocess

# Unsafe: the shell parses the string, so ";" starts a new command.
subprocess.run(f"convert {name} out.png", shell=True)

# Safe: a list of arguments, and no shell to interpret them.
subprocess.run(["convert", "--", name, "out.png"], shell=False, check=True)`,
        highlight: [4, 7],
      },
    },
    {
      title: 'XSS',
      tag: 'concept',
      heading: 'Cross-site scripting: injection into a web page',
      eli5: 'A visitor pins a note on the castle notice board, and the note secretly contains instructions that other readers end up following.',
      body: [
        '**Cross-site scripting** (XSS) is injection into a web page. In **stored** XSS, a product review containing markup is saved, then rendered into other shoppers\' pages. If the browser treats it as HTML, a script runs inside your site, with the victim\'s access.',
        '**Reflected** XSS puts the payload in a URL that the page echoes back. **DOM-based** XSS happens when client JavaScript writes data into `innerHTML`.',
      ],
      keyIdea: 'XSS runs attacker code inside your own origin, with the victim\'s access.',
      metrics: { layers: '3', flaws: 'XSS', blast: 'every viewer' },
      metricTones: { flaws: 'bad', blast: 'bad' },
      scene: {
        nodes: [
          { ...attacker, chips: [{ text: '<script>steal()</script>', tone: 'bad' }] },
          { ...app, at: at(-1.8, 0), status: 'hot', badge: 'stores review as is' },
          { ...db, at: at(1.8, 3.8), status: 'hot' },
          { ...shopper, at: at(5.4, 0), status: 'hot', badge: 'script runs' },
        ],
        links: [link('attacker', 'app', { label: 'review via the app' }), link('app', 'db'), link('app', 'shopper')],
        flows: [
          { path: ['attacker', 'app'], tone: 'error', label: 'review with markup', duration: 1.8 },
          { path: ['app', 'db'], tone: 'error', label: 'saved', duration: 1.2, delay: 2 },
          { path: ['db', 'app', 'shopper'], tone: 'error', label: 'rendered as HTML', duration: 2.2, delay: 3.4 },
        ],
        panel: {
          title: 'Three kinds of XSS',
          icon: 'Bug',
          rows: [
            { text: 'Stored: saved review', value: 'every viewer', tone: 'bad' },
            { text: 'Reflected: payload in a URL', value: 'whoever clicks', tone: 'bad' },
            { text: 'DOM-based: JS writes innerHTML', value: 'client side only', tone: 'bad' },
          ],
        },
        caption: 'Attacker content becomes code in other browsers',
      },
    },
    {
      title: 'Encoding',
      tag: 'concept',
      heading: 'Output encoding: escape for where the data lands',
      eli5: 'The scribe copies every note onto the notice board in plain ink, so it can only ever be **read**, never obeyed.',
      body: [
        '**Output encoding** converts special characters such as `<` and `"` into escaped forms when you place data into HTML, using the rules for that context (body, attribute, URL, JavaScript). Frameworks such as React do this by default. Danger appears when code switches it off, for example with `innerHTML` or `dangerouslySetInnerHTML`. If you must accept rich text, run it through a well-maintained HTML sanitizer.',
      ],
      keyIdea: 'Treat stored user content as text and encode it for the exact place it is written.',
      metrics: { layers: '3', flaws: 'XSS closed', blast: 'contained' },
      metricTones: { flaws: 'good' },
      scene: {
        nodes: [
          { ...db, at: at(-5.4, 0), badge: '<b>hi</b>' },
          { ...app, status: 'active', badge: 'escape on render' },
          { ...shopper, at: at(5.4, 0), status: 'ok', badge: 'shows text, runs nothing' },
        ],
        links: [link('db', 'app'), link('app', 'shopper')],
        flows: [
          { path: ['db', 'app'], tone: 'response', label: 'review text', duration: 1.6 },
          { path: ['app', 'shopper'], tone: 'response', label: '&lt;b&gt;hi&lt;/b&gt;', duration: 1.8, delay: 1.7 },
        ],
        panel: {
          title: 'Same text, two outputs',
          icon: 'Table',
          rows: [
            { text: 'Raw into HTML', value: 'tag runs', tone: 'bad' },
            { text: 'Encoded: &lt;b&gt;', value: 'shown as text', tone: 'good' },
          ],
          footer: { text: 'Encode for the context: body, attribute, URL, JS', tone: 'muted' },
        },
        caption: 'User content is rendered as text, never as code',
      },
      code: {
        language: 'typescript',
        title: 'Escaping by default, and the unsafe escape hatch',
        source: `// Safe: React escapes text placed in JSX.
function Review({ text }: { text: string }) {
  return <p className="review">{text}</p>;
}

// Unsafe: raw HTML from a user goes straight into the page.
function ReviewUnsafe({ text }: { text: string }) {
  return <p dangerouslySetInnerHTML={{ __html: text }} />;
}`,
        highlight: [3, 8],
      },
    },
    {
      title: 'CSP',
      tag: 'concept',
      heading: 'Content Security Policy: a backstop for XSS',
      eli5: 'Even if one sneaky note gets through, the board has a rule: only instructions written by the castle scribe may be followed.',
      body: [
        'A **Content Security Policy** header tells the browser which script sources are allowed, so injected inline script does not run. It catches what encoding missed. It does not replace encoding.',
      ],
      keyIdea: 'Encode first, then let CSP catch what slips through.',
      metrics: { layers: '4', flaws: 'XSS closed', blast: 'contained' },
      metricTones: { layers: 'good', flaws: 'good' },
      scene: {
        nodes: [
          { ...app, at: at(-5.4, 0), status: 'active', badge: 'sends CSP header' },
          { ...shopper, at: at(-1.8, 0), status: 'ok', chips: [{ text: 'inline script: blocked', tone: 'good' }] },
        ],
        links: [link('app', 'shopper')],
        flows: [{ path: ['app', 'shopper'], tone: 'response', label: 'page + CSP', duration: 1.8 }],
        panel: {
          title: 'What the policy allows',
          icon: 'Shield',
          rows: [
            { text: "script-src 'self'", value: 'no inline script', tone: 'good' },
            { text: "object-src 'none'", value: 'no plugins', tone: 'good' },
            { text: "base-uri 'self'", value: 'no base tag tricks', tone: 'good' },
          ],
        },
        caption: 'Injected script is refused by the browser',
      },
      code: {
        language: 'typescript',
        title: 'A strict policy header',
        source: `// Server: allow scripts only from our own origin, no inline script.
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'",
  );
  next();
});`,
        highlight: [5],
      },
    },
    {
      title: 'Cookie flags',
      tag: 'concept',
      heading: 'HttpOnly and Secure: keep the session ID out of reach',
      eli5: 'The **gold key** is kept in a pocket no note can reach, and it only works on the covered road.',
      body: [
        '`HttpOnly` keeps a cookie out of reach of scripts, so XSS cannot read the session ID. `Secure` sends it only over HTTPS. Set both on every session cookie.',
      ],
      keyIdea: 'Even when a script runs, it should find no session ID to steal.',
      metrics: { layers: '4', flaws: 'XSS closed', blast: 'contained' },
      metricTones: { layers: 'good', flaws: 'good' },
      scene: {
        nodes: [
          { ...shopper, at: at(-2.7, 0), status: 'ok', chips: [{ text: 'script runs anyway', tone: 'warn' }] },
          { id: 'cookie', kind: 'block', size: 0.8, at: at(2.7, 0), label: 'session cookie', sub: 'HttpOnly, Secure', icon: 'KeyRound', tint: 'green', status: 'ok' },
        ],
        links: [link('shopper', 'cookie', { label: 'scripts cannot read', style: 'dashed' })],
        flows: [{ path: ['shopper', 'cookie'], tone: 'error', label: 'document.cookie: empty', duration: 2 }],
        panel: {
          title: 'Cookie flags',
          icon: 'KeyRound',
          rows: [
            { text: 'HttpOnly', value: 'invisible to JS', tone: 'good' },
            { text: 'Secure', value: 'HTTPS only', tone: 'good' },
          ],
          footer: { text: 'Set-Cookie: sid=...; HttpOnly; Secure', tone: 'muted' },
        },
        caption: 'Injected script finds no token',
      },
    },
    {
      title: 'CSRF',
      tag: 'concept',
      heading: 'CSRF: a request the user never meant to send',
      eli5: 'A stranger tricks you into carrying a sealed letter to the castle. The **gatekeeper** sees your face and lets it in, without asking whether you meant to bring it.',
      body: [
        '**Cross-site request forgery** (CSRF) abuses the fact that browsers attach cookies automatically. A shopper is logged in to the shop. They visit another site, which quietly submits a form to `shop.example/account/email`. The browser adds the session cookie, and the shop sees a valid, logged-in request it did not ask for.',
      ],
      keyIdea: 'Cookies prove which browser sent a request, not that the user intended it.',
      metrics: { layers: '4', flaws: 'CSRF', blast: 'one account' },
      metricTones: { flaws: 'bad' },
      scene: {
        nodes: [
          { ...evil, status: 'hot' },
          { ...shopper, at: at(-1.8, 0), sub: 'logged in to shop', badge: 'session cookie' },
          { ...app, status: 'hot', badge: 'email changed' },
        ],
        links: [link('evil', 'shopper', { style: 'dashed' }), link('shopper', 'app')],
        flows: [
          { path: ['evil', 'shopper'], tone: 'event', label: 'hidden form', duration: 1.4 },
          { path: ['shopper', 'app'], tone: 'error', label: 'POST /account/email + cookie', duration: 2, delay: 1.5 },
        ],
        panel: {
          title: 'The forged request',
          icon: 'Code',
          code: 'POST /account/email HTTP/1.1\nHost: shop.example\nCookie: session=abc123\n\nemail=attacker@evil.example',
          footer: { text: 'Valid cookie, unintended action', tone: 'bad' },
        },
        caption: 'The browser attaches the cookie by itself',
      },
    },
    {
      title: 'CSRF defenses',
      tag: 'concept',
      heading: 'SameSite cookies and a per-session token',
      eli5: 'Now the gatekeeper only accepts letters that carry a secret mark given to you inside the castle. A stranger cannot copy the **mark**, so the forged letter is turned away.',
      body: [
        'Set `SameSite=Lax` or `Strict` explicitly, so the browser leaves the cookie off cross-site form posts. Chrome-based browsers default to Lax when it is unset, but others do not. SameSite is site-based, so a hostile subdomain still counts as same-site.',
        'The primary defense is a **CSRF token**: a random value tied to the session, sent in each form or header and checked on every state-changing request. Another site cannot read it. Keep `GET` free of side effects.',
      ],
      keyIdea: 'SameSite cookies and a per-session token close the gap between "this browser" and "this user meant it".',
      metrics: { layers: '5', flaws: 'CSRF closed', blast: 'contained' },
      metricTones: { flaws: 'good' },
      scene: {
        nodes: [
          { ...evil, status: 'hot' },
          { ...shopper, at: at(-1.8, 0), sub: 'logged in to shop' },
          { ...app, status: 'ok', badge: 'token missing: 403' },
        ],
        links: [link('evil', 'shopper', { style: 'dashed' }), link('shopper', 'app')],
        flows: [
          { path: ['evil', 'shopper'], tone: 'event', label: 'hidden form', duration: 1.2 },
          { path: ['shopper', 'app'], tone: 'request', label: 'POST, no token, no cookie', duration: 2, delay: 1.3 },
          { path: ['app', 'shopper'], tone: 'error', label: '403', duration: 2, delay: 3.4 },
        ],
        panel: {
          title: 'Two checks on state changes',
          icon: 'Shield',
          rows: [
            { text: 'Cookie: SameSite=Lax', value: 'not sent cross-site', tone: 'good' },
            { text: 'Header: X-CSRF-Token', value: 'must match session', tone: 'good' },
            { text: 'GET requests', value: 'no side effects' },
          ],
        },
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
      title: 'Access control',
      tag: 'case',
      heading: 'Broken access control: user 42 reads order 981',
      eli5: 'The guard checks that you have a ticket, but never checks whose room the ticket is for. Any guest can walk into any **room** just by changing the number on the door.',
      body: [
        'The top OWASP risk. `GET /orders/981` checks that the caller is logged in, but not that order 981 belongs to them. Changing the ID in the URL (an **IDOR**) reads strangers\' orders. A WAF cannot see this, because the request looks normal.',
        'Check ownership on the server for every object, on every request. Deny by default, and never trust a role or ID sent by the client.',
      ],
      keyIdea: 'Authentication says who you are. Authorization must be checked again for every object you touch.',
      metrics: { layers: '4', flaws: 'access control', blast: 'every order' },
      metricTones: { flaws: 'bad', blast: 'bad' },
      scene: {
        nodes: [
          { ...shopper, chips: [{ text: 'GET /orders/981', tone: 'warn' }], sub: 'user 42' },
          { ...app, status: 'active', badge: 'owner check' },
          { ...db, status: 'ok', badge: 'order 981: user 77' },
        ],
        links: [link('shopper', 'app'), link('app', 'db')],
        flows: [
          { path: ['shopper', 'app'], tone: 'request', label: 'GET /orders/981', duration: 1.6 },
          { path: ['app', 'db'], tone: 'request', label: 'order 981', duration: 1.2, delay: 1.7 },
          { path: ['app', 'shopper'], tone: 'error', label: '404 not yours', duration: 1.8, delay: 3.1 },
        ],
        panel: {
          title: 'The check that is missing',
          icon: 'Code',
          code: 'order = db.get(order_id)\nif order.user_id != session.user_id:\n    return 404   # deny by default\nreturn order',
          footer: { text: 'Without it, change the ID, read anyone\'s data', tone: 'bad' },
        },
        caption: 'Ownership is checked on every object',
      },
    },
    {
      title: 'Hashes',
      tag: 'concept',
      heading: 'Store hashes, never passwords',
      eli5: 'The castle never keeps the secret words themselves, only a scrambled copy that takes a long time to make. A thief who steals the book still cannot read the **words**.',
      body: [
        'Store only hashes made with a slow, salted algorithm such as argon2 or bcrypt. A stolen database then gives the attacker one hash per user, and each guess costs real time.',
        'To check a login, hash the attempt and compare. Nothing is ever decrypted.',
      ],
      keyIdea: 'A stolen database should give attackers slow hashes, and no passwords.',
      metrics: { layers: '5', flaws: 'weak auth', blast: 'contained' },
      metricTones: { blast: 'good' },
      scene: {
        nodes: [
          { ...attacker, chips: [{ text: 'stolen db dump', tone: 'bad' }] },
          { ...db, at: at(-1.8, 0), status: 'ok', badge: 'argon2 hash + salt' },
        ],
        links: [link('attacker', 'db', { label: 'copied out', style: 'dashed' })],
        flows: [{ path: ['db', 'attacker'], tone: 'error', label: 'hashes, slow to crack', duration: 2 }],
        panel: {
          title: 'Password storage',
          icon: 'KeyRound',
          rows: [
            { text: 'Algorithm', value: 'argon2 or bcrypt', tone: 'good' },
            { text: 'Salt', value: 'unique per password', tone: 'good' },
            { text: 'Plain text passwords', value: 'never', tone: 'bad' },
          ],
        },
        caption: 'The dump is slow to crack',
      },
      code: {
        language: 'python',
        title: 'Hash on save, verify on login (argon2)',
        source: `from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

ph = PasswordHasher()   # argon2id, random salt per hash

def save(password):
    return ph.hash(password)   # store this, never the password

def check(stored, attempt):
    try:
        return ph.verify(stored, attempt)
    except VerifyMismatchError:
        return False`,
        highlight: [4, 7, 11],
      },
    },
    {
      title: 'Throttle and MFA',
      tag: 'concept',
      heading: 'Slow down guessing and credential stuffing',
      eli5: 'After a few wrong guesses at the **door**, the guard makes you wait longer each time and asks for a second proof.',
      body: [
        'Limit attempts per account with growing delays rather than a hard lock, because a lockout lets an attacker block real users. Offer multi-factor authentication.',
        'Credential stuffing tries leaked passwords from other sites, from many IPs, so per-IP limits miss a botnet. Add breached-password checks and device or bot signals.',
      ],
      keyIdea: 'Guessing should get slower with every miss, and passwords leaked elsewhere should not work here.',
      metrics: { layers: '5', flaws: 'weak auth closed', blast: 'contained' },
      metricTones: { flaws: 'good' },
      scene: {
        nodes: [
          { ...attacker, chips: [{ text: 'POST /login x 5000', tone: 'bad' }] },
          { ...app, status: 'active', badge: 'backoff per account' },
          { ...db, status: 'ok' },
        ],
        links: [link('attacker', 'app', { label: 'credential stuffing', labelTone: 'warn' }), link('app', 'db')],
        flows: [
          { path: ['attacker', 'app'], tone: 'error', label: 'guesses', count: 4, duration: 1.4 },
          { path: ['app', 'attacker'], tone: 'error', label: '429, retry later', duration: 1.6, delay: 1.6 },
        ],
        panel: {
          title: 'Login protections',
          icon: 'KeyRound',
          rows: [
            { text: 'Attempts per account', value: 'backoff', tone: 'good' },
            { text: 'Second factor', value: 'MFA offered', tone: 'good' },
            { text: 'Breached passwords', value: 'rejected', tone: 'good' },
            { text: 'Device and bot signals', value: 'challenge', tone: 'good' },
          ],
        },
        caption: 'Each miss costs the attacker more time',
      },
    },
    {
      title: 'Browser headers',
      tag: 'concept',
      heading: 'Security headers: HSTS and frame-ancestors',
      eli5: 'The castle sends every visitor a few house rules to carry: always use the covered road, and never let another house put our **door** inside a picture frame.',
      body: [
        '`Strict-Transport-Security` (**HSTS**) tells the browser to use HTTPS only for your domain, so a downgrade to plain HTTP is refused. `frame-ancestors \'none\'` (or `X-Frame-Options: DENY`) stops other sites from loading yours in a hidden frame, which blocks **clickjacking**.',
        '`X-Content-Type-Options: nosniff` stops the browser guessing a file is a script.',
      ],
      keyIdea: 'A few response headers switch on protections the browser already has.',
      metrics: { layers: '5', flaws: 'misconfig closed', blast: 'contained' },
      metricTones: { flaws: 'good' },
      scene: {
        nodes: [
          { ...app, at: at(-5.4, 0), status: 'active', badge: 'adds headers' },
          { ...shopper, at: at(-1.8, 0), status: 'ok', badge: 'HTTPS only' },
          { ...evil, at: at(2.7, 0), status: 'dim', chips: [{ text: 'iframe: refused', tone: 'good' }] },
        ],
        links: [link('app', 'shopper'), link('evil', 'shopper', { style: 'dashed' })],
        flows: [{ path: ['app', 'shopper'], tone: 'response', label: 'page + headers', duration: 1.8 }],
        panel: {
          title: 'Response headers',
          icon: 'Code',
          code: 'Strict-Transport-Security: max-age=31536000\nContent-Security-Policy: frame-ancestors \'none\'\nX-Content-Type-Options: nosniff\nSet-Cookie: sid=...; Secure; HttpOnly; SameSite=Lax',
          footer: { text: 'Cheap to add, easy to forget', tone: 'muted' },
        },
        caption: 'The browser enforces the house rules',
      },
    },
    {
      title: 'CORS',
      tag: 'tradeoff',
      heading: 'CORS: loosen the same-origin rule on purpose',
      eli5: 'By default each house only talks to its own family. A **guest list** at the door names which other houses may read our messages, and the shorter the list, the safer.',
      body: [
        'Browsers stop a page on one origin from reading responses from another. **CORS** headers let the server opt in with `Access-Control-Allow-Origin`. Name exact origins. Echoing the request Origin with `Allow-Credentials: true` lets any site read logged-in data. `*` is fine only for public, cookie-free data and is refused with credentials.',
        'CORS only hides the response. The request is still sent and acted on, so CSRF protection is still needed. Non-simple requests get a preflight first.',
      ],
      keyIdea: 'CORS is an allowlist of readers. Keep it exact.',
      metrics: { layers: '5', flaws: 'misconfig closed', blast: 'contained' },
      scene: {
        nodes: [
          { id: 'partner', kind: 'client', at: at(-5.4, 0), label: 'app.shop.example', sub: 'allowed origin' },
          { ...app, status: 'active', badge: 'allowlist' },
          { ...evil, at: at(-1.8, 3.8), status: 'hot' },
        ],
        links: [link('partner', 'app'), link('evil', 'app', { style: 'dashed' })],
        flows: [
          { path: ['partner', 'app'], tone: 'request', label: 'Origin: app.shop.example', duration: 1.8 },
          { path: ['app', 'partner'], tone: 'response', label: 'Allow-Origin: app', duration: 1.8, delay: 1.9 },
          { path: ['evil', 'app'], tone: 'error', label: 'Origin: evil.example', duration: 1.8, delay: 4 },
          { path: ['app', 'evil'], tone: 'error', label: 'no Allow-Origin header', duration: 1.8, delay: 6 },
        ],
        panel: {
          title: 'Origin allowlist',
          icon: 'List',
          rows: [
            { text: 'https://app.shop.example', value: 'allowed', tone: 'good' },
            { text: 'https://evil.example', value: 'no header sent', tone: 'good' },
            { text: 'Reflect any Origin + Allow-Credentials: true', value: 'never', tone: 'bad' },
          ],
        },
        caption: 'Only listed origins may read the response',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'App-level defenses, each assuming the others failed',
      eli5: 'The castle now has notes read carefully, a notice board in plain ink, sealed letters with marks, a room check at every door, scrambled secret words and house rules for visitors. Beating one **layer** gets a thief almost nothing.',
      body: [
        '**Parameterized queries** stop injection. **Output encoding**, CSP and HttpOnly stop XSS. **SameSite** and CSRF tokens stop forged requests. Ownership checks stop IDOR, slow hashes and limits protect logins, and headers and exact CORS lists tighten the browser. Part 2 covers the edge and the network.',
      ],
      keyIdea: 'No single control is perfect. Layers that fail for different reasons keep each mistake small.',
      metrics: { layers: '5', flaws: 'app flaws closed', blast: 'contained' },
      metricTones: { layers: 'good', flaws: 'good', blast: 'good' },
      scene: {
        nodes: [
          { ...shopper, status: 'ok' },
          { ...waf, status: 'ok' },
          { ...app, status: 'ok', badge: 'input, output, owner checked' },
          { ...db, status: 'ok' },
        ],
        links: [link('shopper', 'waf'), link('waf', 'app'), link('app', 'db')],
        flows: [
          { path: ['shopper', 'waf', 'app', 'db'], tone: 'request', duration: 3 },
          { path: ['db', 'app', 'waf', 'shopper'], tone: 'response', duration: 3, delay: 3.1 },
        ],
        panel: {
          title: 'Flaw and defense',
          icon: 'Shield',
          rows: [
            { text: 'Injection', value: 'parameterized queries' },
            { text: 'XSS', value: 'encoding + CSP' },
            { text: 'CSRF', value: 'SameSite + token' },
            { text: 'IDOR', value: 'owner check' },
            { text: 'Weak logins', value: 'hashes + limits' },
          ],
        },
        caption: 'Part 2: the edge, the network and permissions',
      },
      quiz: {
        question: 'A user changes /orders/981 to /orders/982 and sees another customer\'s order. The WAF logged nothing. Why, and what fixes it?',
        options: [
          'The WAF is misconfigured, so add more rules',
          'The request looks normal. The server must check that the order belongs to the caller',
          'Output encoding is missing on the order page',
          'A CSRF token is missing from the URL',
        ],
        answer: 1,
        explain: 'Broken access control is a logic flaw with valid-looking requests. Only the server, which knows who owns each order, can fix it with an ownership check on every request.',
      },
    },
  ],
};
