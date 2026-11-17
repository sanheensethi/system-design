import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const shopper: SceneNode = { id: 'shopper', kind: 'client', at: at(-5.4, 0), label: 'shopper', sub: 'browser' };
const bots: SceneNode = { id: 'bots', kind: 'internet', at: at(-5.4, 3.8), label: 'botnet', sub: 'hostile traffic', tint: 'red' };
const edge: SceneNode = { id: 'edge', kind: 'cdn', at: at(-1.8, 0), label: 'edge network', sub: 'CDN, many PoPs' };
const waf: SceneNode = { id: 'waf', kind: 'block', size: 0.8, at: at(1.8, 0), label: 'WAF', sub: 'rules + rate limits', icon: 'Shield', tint: 'amber' };
const app: SceneNode = { id: 'app', kind: 'server', at: at(5.4, 0), label: 'app servers', sub: 'shop API' };
const db: SceneNode = { id: 'db', kind: 'db', at: at(5.4, 3.8), label: 'database', sub: '2M customers' };

export const webSecurityPart2: Lesson = {
  id: 'web-security-part-2',
  title: 'Web security (part 2): edge, network and permissions',
  tagline: 'Absorb floods at the edge, filter with a WAF, patch what you depend on, and shrink the blast radius with segmentation and least privilege.',
  minutes: 15,
  level: 'Intermediate',
  learn: [
    'Volumetric, protocol and application DDoS attacks, and absorbing them at the edge',
    'Hiding the origin and rate limiting application-layer floods',
    'What a web application firewall does, its false positives and its limits',
    'Vulnerable dependencies and server-side request forgery',
    'Network segmentation and a safe admin path',
    'Least privilege for database roles and cloud identities',
    'Logging and alerting so attacks are noticed',
  ],
  metrics: [
    { key: 'layers', label: 'Layers working', icon: 'Layers' },
    { key: 'origin', label: 'Bad traffic at origin', icon: 'Activity' },
    { key: 'exposed', label: 'Public endpoints', icon: 'Globe' },
    { key: 'blast', label: 'Blast radius', icon: 'Boxes' },
  ],
  steps: [
    {
      title: 'The flood',
      tag: 'problem',
      heading: 'Case: a flood far bigger than the origin',
      eli5: 'A huge crowd swarms the road to the castle so real visitors cannot reach the gate. No matter how good the gate is, nobody can get near it.',
      body: [
        'On a sale day a botnet sends hundreds of gigabits per second at the shop. The data center link is 10 Gbps. No server tuning helps: the pipe is full before a packet reaches a machine.',
      ],
      keyIdea: 'A flood bigger than your link wins before any server code runs.',
      metrics: { layers: '1', origin: '100% of flood', exposed: 'app + DB', blast: 'outage' },
      metricTones: { origin: 'bad', exposed: 'bad', blast: 'bad' },
      scene: {
        nodes: [
          shopper,
          { ...bots, at: at(-1.8, 3.8), status: 'hot', badge: '100s of Gbps' },
          { ...app, at: at(1.8, 0), status: 'down', load: 100, badge: 'link saturated' },
        ],
        links: [link('shopper', 'app', { label: 'blocked out', labelTone: 'warn' }), link('bots', 'app', { label: '10 Gbps link, 100s incoming', labelTone: 'warn' })],
        flows: [
          { path: ['bots', 'app'], tone: 'error', label: 'flood', count: 7, duration: 1 },
          { path: ['shopper', 'app'], tone: 'request', label: 'real order', duration: 2.4, delay: 0.8 },
        ],
        panel: {
          title: 'Pipe versus flood',
          icon: 'Gauge',
          rows: [
            { text: 'Data center link', value: '10 Gbps' },
            { text: 'Botnet traffic', value: '100s of Gbps', tone: 'bad' },
            { text: 'Real shoppers served', value: '0', tone: 'bad' },
          ],
        },
        caption: 'The pipe is full before a packet reaches a server',
      },
    },
    {
      title: 'Attack kinds',
      tag: 'concept',
      heading: 'Three kinds of DDoS, three places to break',
      eli5: 'A crowd can block the road, jam the gate by everyone knocking at once, or ask the cook for impossible dishes. Each needs a different **helper**.',
      body: [
        '**Volumetric** floods fill the link with raw traffic. **Protocol** attacks, such as a SYN flood of half-open connections, exhaust connection tables in load balancers and firewalls. **Application** floods send many expensive, valid-looking requests, such as search or login.',
      ],
      keyIdea: 'Volume, connection state and application work are separate limits, and a defense covers one at a time.',
      metrics: { layers: '1', origin: 'all kinds', exposed: 'app + DB', blast: 'outage' },
      metricTones: { origin: 'bad' },
      scene: {
        nodes: [
          { ...bots, at: at(-5.4, 0), status: 'hot' },
          { id: 'pipe', kind: 'block', size: 0.8, at: at(-1.8, 0), label: 'network link', sub: 'volumetric', icon: 'Cable', tint: 'red', status: 'hot' },
          { id: 'conns', kind: 'block', size: 0.8, at: at(1.8, 0), label: 'connections', sub: 'protocol (SYN)', icon: 'Plug', tint: 'amber', status: 'hot' },
          { ...app, status: 'hot', sub: 'application layer' },
        ],
        links: [link('bots', 'pipe'), link('pipe', 'conns'), link('conns', 'app')],
        flows: [{ path: ['bots', 'pipe', 'conns', 'app'], tone: 'error', label: 'flood', count: 3, duration: 3 }],
        panel: {
          title: 'What each attack exhausts',
          icon: 'Table',
          rows: [
            { text: 'Volumetric', value: 'bandwidth', tone: 'bad' },
            { text: 'Protocol (SYN flood)', value: 'connection table', tone: 'bad' },
            { text: 'Application (HTTP flood)', value: 'CPU, database', tone: 'bad' },
          ],
        },
        caption: 'Three limits, three attacks',
      },
    },
    {
      title: 'Edge absorbs',
      tag: 'concept',
      heading: 'Absorb the volume at the edge',
      eli5: 'The castle hires a ring of **outer gates** across the whole country. Each one is big enough to turn the crowd away near where it starts, so the crowd never reaches the road.',
      body: [
        'A CDN or DDoS protection service announces your address from many points of presence (**anycast**), so the flood is split across a network built with far more capacity than one site. Malformed and unwanted packets are dropped there.',
      ],
      keyIdea: 'You cannot out-provision a botnet at one site. Spread the flood across a large edge network.',
      metrics: { layers: '2', origin: '<1% of flood', exposed: 'edge only', blast: 'edge absorbs' },
      metricTones: { layers: 'good', origin: 'good', exposed: 'good', blast: 'good' },
      scene: {
        nodes: [
          shopper,
          { ...bots, at: at(1.8, 3.8), status: 'hot', badge: '100s of Gbps' },
          { ...edge, status: 'active', badge: 'absorbs + drops', load: 55 },
          { ...app, status: 'ok', load: 20 },
        ],
        links: [link('shopper', 'edge'), link('bots', 'edge'), link('edge', 'app')],
        flows: [
          { path: ['bots', 'edge'], tone: 'error', label: 'flood', count: 7, duration: 1 },
          { path: ['shopper', 'edge', 'app'], tone: 'request', label: 'real shopper', duration: 2.4, delay: 0.6 },
          { path: ['app', 'edge', 'shopper'], tone: 'response', duration: 2.4, delay: 3.1 },
        ],
        panel: {
          title: 'Capacity compared',
          icon: 'Gauge',
          rows: [
            { text: 'One data center', value: '10 Gbps', tone: 'bad' },
            { text: 'Anycast edge network', value: 'many Tbps', tone: 'good' },
            { text: 'Flood reaching origin', value: '<1%', tone: 'good' },
          ],
        },
        caption: 'The flood dies at the edge, shoppers get through',
      },
      quiz: {
        question: 'Why can a botnet of hundreds of Gbps not be stopped by tuning the origin servers?',
        options: [
          'Servers cannot run the TLS handshake fast enough',
          'The data center link is full before packets reach the servers, so the flood must be absorbed in a larger network first',
          'Botnet traffic is always encrypted',
          'Database indexes are missing',
        ],
        answer: 1,
        explain: 'A 10 Gbps link cannot carry 100s of Gbps whatever the servers do. Anycast edge networks have far more total capacity and drop bad traffic before it reaches the origin.',
      },
    },
    {
      title: 'Hide origin',
      tag: 'concept',
      heading: 'Make the origin unreachable except through the edge',
      eli5: 'The real castle gate opens only for the outer gate guards, who wear a special badge. Even if the crowd finds the road, the gate stays shut to everyone else.',
      body: [
        'The origin accepts connections only from the edge provider\'s address ranges. That alone is not enough, because another customer of the same CDN can send traffic from those ranges. Add **authenticated origin pulls** (mTLS or a secret header from the edge) so only your own edge is accepted.',
      ],
      keyIdea: 'Edge protection only works if the origin refuses to talk to anyone but the edge.',
      metrics: { layers: '2', origin: '<1% of flood', exposed: 'edge only', blast: 'edge absorbs' },
      metricTones: { origin: 'good', exposed: 'good' },
      scene: {
        nodes: [
          { ...bots, at: at(5.4, 3.8), status: 'hot', chips: [{ text: 'direct to origin IP', tone: 'bad' }] },
          { ...edge, status: 'ok', sub: 'adds secret header' },
          { ...app, at: at(1.8, 0), status: 'ok', badge: 'edge IPs + secret' },
        ],
        links: [link('bots', 'app', { style: 'dashed', label: 'dropped', labelTone: 'warn' }), link('edge', 'app')],
        flows: [
          { path: ['bots', 'app'], tone: 'error', label: 'refused', duration: 2.4 },
          { path: ['edge', 'app'], tone: 'request', label: 'allowed', duration: 1.6, delay: 1.2 },
        ],
        panel: {
          title: 'Origin firewall rule',
          icon: 'Shield',
          rows: [
            { text: 'Allow 443 from edge ranges', value: 'yes', tone: 'good' },
            { text: 'Allow 443 from anywhere', value: 'no', tone: 'good' },
            { text: 'Authenticated origin pull', value: 'mTLS or secret header', tone: 'good' },
          ],
          footer: { text: 'Keep the origin IP secret and unreachable', tone: 'muted' },
        },
        caption: 'Going around the edge gets nothing',
      },
    },
    {
      title: 'App floods',
      tag: 'concept',
      heading: 'Application-layer floods look like real users',
      eli5: 'Some crowd members look like honest guests and ask for ten thousand soups. The castle limits how many each guest may order, asks suspicious ones a riddle, and keeps **leftovers** ready.',
      body: [
        'These need smarter filtering: per-client rate limits (see the rate limiting lesson), challenges for suspicious clients, and caching so most requests never reach the origin.',
      ],
      keyIdea: 'Rate limits, challenges and caching keep valid-looking floods away from expensive work.',
      metrics: { layers: '3', origin: 'limited', exposed: 'edge only', blast: 'edge absorbs' },
      metricTones: { origin: 'good' },
      scene: {
        nodes: [
          { ...bots, at: at(-5.4, 0), status: 'hot', chips: [{ text: 'GET /search?q=a x 9000', tone: 'bad' }] },
          { ...edge, status: 'active', chips: [{ text: '429 over limit', tone: 'warn' }, { text: 'cache hit', tone: 'good' }] },
          { ...app, at: at(1.8, 0), status: 'ok', load: 25 },
        ],
        links: [link('bots', 'edge'), link('edge', 'app')],
        flows: [
          { path: ['bots', 'edge'], tone: 'error', label: 'search flood', count: 5, duration: 1.2 },
          { path: ['edge', 'bots'], tone: 'error', label: '429', duration: 1.4, delay: 1.4 },
          { path: ['edge', 'app'], tone: 'request', label: 'few reach origin', duration: 1.6, delay: 2.6 },
        ],
        panel: {
          title: 'Filters for valid-looking requests',
          icon: 'Shield',
          rows: [
            { text: 'Rate limit per client', value: '100 / min', tone: 'good' },
            { text: 'Challenge suspicious clients', value: 'CAPTCHA', tone: 'good' },
            { text: 'Cache repeated reads', value: 'most never reach origin', tone: 'good' },
          ],
        },
        caption: 'Real-looking traffic is limited and cached',
      },
    },
    {
      title: 'WAF',
      tag: 'concept',
      heading: 'The web application firewall reads HTTP',
      eli5: 'Guards at the **inner gate** read every visitor\'s papers and check them against a list of known tricks. They turn away anyone carrying a crowbar.',
      body: [
        'A network firewall decides by address and port. A **web application firewall** (WAF) reads HTTP: paths, headers, bodies. It blocks requests that match known injection and XSS patterns, enforces per-client rate limits, and can block by country or reputation.',
        'Managed rule sets are updated by the vendor when a new widespread flaw appears.',
      ],
      keyIdea: 'A WAF filters common attacks at the door, using what it can read in each HTTP request.',
      metrics: { layers: '3', origin: 'filtered', exposed: 'edge only', blast: 'contained' },
      scene: {
        nodes: [
          { ...bots, at: at(-5.4, 0), label: 'scanner', sub: 'probing forms', status: 'hot', chips: [{ text: "id=1' UNION SELECT", tone: 'bad' }] },
          { ...waf, at: at(-1.8, 0), status: 'active', badge: 'rule match: block' },
          { ...app, at: at(1.8, 0), status: 'ok' },
          { ...shopper, at: at(5.4, 3.8), chips: ['POST /orders'] },
        ],
        links: [link('bots', 'waf'), link('waf', 'app'), link('shopper', 'waf')],
        flows: [
          { path: ['bots', 'waf'], tone: 'request', label: 'injection pattern', count: 3, duration: 1.6 },
          { path: ['waf', 'bots'], tone: 'error', label: '403', duration: 1.6, delay: 1.7 },
          { path: ['shopper', 'waf', 'app'], tone: 'request', label: 'normal POST', duration: 2.2, delay: 3.4 },
        ],
        panel: {
          title: 'What a WAF can decide on',
          icon: 'Shield',
          rows: [
            { text: 'Path and query string', value: 'patterns' },
            { text: 'Headers and body', value: 'patterns' },
            { text: 'Request rate per client', value: 'limit' },
            { text: 'Country or reputation', value: 'block list' },
          ],
        },
        caption: 'Known patterns stop at the filter',
      },
    },
    {
      title: 'False positives',
      tag: 'tradeoff',
      heading: 'The price: false positives',
      eli5: 'Sometimes the inner guards stop an honest builder who carries a hammer. So they first write down who they would have stopped, and only then start turning people away.',
      body: [
        'A recipe site whose users post text with SQL-like words, or a developer forum full of code, will trip generic rules. Run new rules in count-only mode first, look at what they would have blocked, then switch to block.',
      ],
      keyIdea: 'Tune WAF rules in count mode before blocking, or real customers get blocked.',
      metrics: { layers: '3', origin: 'filtered', exposed: 'edge only', blast: 'contained' },
      metricTones: { origin: 'warn' },
      scene: {
        nodes: [
          { ...shopper, at: at(-5.4, 0), chips: [{ text: 'POST: "DROP the beat"', tone: 'warn' }], sub: 'forum user' },
          { ...waf, at: at(-1.8, 0), status: 'active', badge: 'count only' },
          { ...app, at: at(1.8, 0), status: 'ok' },
        ],
        links: [link('shopper', 'waf'), link('waf', 'app')],
        flows: [
          { path: ['shopper', 'waf', 'app'], tone: 'request', label: 'logged, not blocked', duration: 2.6 },
          { path: ['app', 'waf', 'shopper'], tone: 'response', duration: 2.6, delay: 2.8 },
        ],
        panel: {
          title: 'Rollout of a new rule',
          icon: 'List',
          rows: [
            { text: '1 Count only', value: 'log matches', tone: 'good' },
            { text: '2 Review matches', value: 'real or false?', tone: 'warn' },
            { text: '3 Tune or exclude paths', value: 'fix false hits' },
            { text: '4 Switch to block', value: 'now safe', tone: 'good' },
          ],
        },
        caption: 'Watch first, block second',
      },
    },
    {
      title: 'WAF limits',
      tag: 'tradeoff',
      heading: 'A WAF is a layer, never the fix',
      eli5: 'The inner guards know the famous tricks, but not who owns which room. They cannot tell that a guest is opening someone else\'s **door**, so the doors still need their own locks.',
      body: [
        'Encodings and new tricks get past pattern matching, and a WAF knows nothing of your business rules. It cannot tell that user 42 should not read order 981. A WAF buys patch time. Keep parameterized queries and authorization checks behind it.',
      ],
      keyIdea: 'A WAF complements safe code, it does not replace it.',
      metrics: { layers: '3', origin: 'filtered', exposed: 'edge only', blast: 'contained' },
      scene: {
        nodes: [
          { ...bots, at: at(-5.4, 0), chips: [{ text: 'new encoding', tone: 'bad' }, { text: 'GET /orders/981', tone: 'warn' }], status: 'hot' },
          { ...waf, at: at(-1.8, 0), status: 'hot', badge: 'passes both' },
          { ...app, at: at(1.8, 0), status: 'active', badge: 'code is the real fix' },
        ],
        links: [link('bots', 'waf'), link('waf', 'app')],
        flows: [
          { path: ['bots', 'waf', 'app'], tone: 'error', label: 'looks normal', duration: 2.4 },
          { path: ['app', 'waf', 'bots'], tone: 'response', label: '404 not yours', duration: 2.4, delay: 2.6 },
        ],
        panel: {
          title: 'What a WAF misses',
          icon: 'Bug',
          rows: [
            { text: 'New encodings', value: 'can bypass', tone: 'warn' },
            { text: 'Broken access control', value: 'invisible', tone: 'bad' },
            { text: 'Business logic abuse', value: 'invisible', tone: 'bad' },
          ],
          footer: { text: 'Fix the code, keep the WAF as a backstop', tone: 'muted' },
        },
        caption: 'Valid-looking requests pass the filter',
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
    {
      title: 'Dependencies',
      tag: 'case',
      heading: 'Vulnerable components: you ship other people\'s code',
      eli5: 'The castle buys bricks and locks from many makers. If a maker announces a flaw in one lock model, you must find every door that uses it and swap it fast.',
      body: [
        'Most of an app is libraries. When a widely used library gets a public flaw, attackers scan the internet for it within hours. Keep a list of what you ship (an SBOM), scan dependencies in CI, and patch quickly. A WAF rule can bridge the gap until the patch lands.',
        'Supply-chain attacks use malicious or typosquatted packages and hijacked maintainers. Use lock files with hash checks and trusted registries. Pinning needs an automated bump process, or patches stall.',
      ],
      keyIdea: 'Know what you depend on, and be able to patch it within days.',
      metrics: { layers: '3', origin: 'filtered', exposed: 'edge only', blast: 'one library' },
      metricTones: { blast: 'warn' },
      scene: {
        nodes: [
          { id: 'lib', kind: 'block', size: 0.8, at: at(-5.4, 0), label: 'advisory feed', sub: 'web library v2.14 flaw', icon: 'Package', tint: 'red', status: 'hot' },
          { id: 'scan', kind: 'block', size: 0.8, at: at(-1.8, 0), label: 'CI scanner', sub: 'checks every build', icon: 'Search', tint: 'violet', status: 'active' },
          { ...app, at: at(1.8, 0), status: 'ok', badge: 'upgrade to v2.15' },
        ],
        links: [link('lib', 'scan'), link('scan', 'app', { label: 'patch PR' })],
        flows: [
          { path: ['lib', 'scan'], tone: 'event', label: 'flaw advisory', duration: 1.6 },
          { path: ['scan', 'app'], tone: 'request', label: 'bump + deploy', duration: 1.8, delay: 1.8 },
        ],
        panel: {
          title: 'Dependency hygiene',
          icon: 'List',
          rows: [
            { text: 'List of components (SBOM)', value: 'always current' },
            { text: 'Scan in CI', value: 'every build', tone: 'good' },
            { text: 'Lock file + hash checks', value: 'pinned', tone: 'good' },
            { text: 'Trusted registries only', value: 'no typosquats', tone: 'good' },
            { text: 'Automated bump PRs', value: 'keeps pins fresh', tone: 'good' },
            { text: 'Patch window', value: 'days, not months', tone: 'warn' },
          ],
        },
        caption: 'Find the vulnerable library, patch it fast',
      },
    },
    {
      title: 'SSRF',
      tag: 'case',
      heading: 'SSRF: tricking your server into fetching internal URLs',
      eli5: 'A guest asks the cook to fetch a parcel from "any address I write down". The cook happily walks into the private vault room, because the cook is allowed there and the guest is not.',
      body: [
        '**Server-side request forgery** hits features that fetch a user-supplied URL, such as image import or webhooks. The attacker gives an internal address like the cloud metadata service at `169.254.169.254`, and the server returns credentials.',
        'Allowlist target hosts, block private and link-local ranges after DNS resolution, and use metadata protections such as IMDSv2.',
      ],
      keyIdea: 'A server that fetches user URLs acts with the server\'s network access. Restrict where it may go.',
      metrics: { layers: '4', origin: 'filtered', exposed: 'edge only', blast: 'one segment' },
      metricTones: { blast: 'warn' },
      scene: {
        nodes: [
          { ...bots, at: at(-5.4, 0), chips: [{ text: 'import ?url=169.254.169.254', tone: 'bad' }], status: 'hot' },
          { ...app, at: at(-1.8, 0), status: 'active', badge: 'allowlist hosts only' },
          { id: 'meta', kind: 'vault', at: at(1.8, 0), label: 'metadata service', sub: 'cloud credentials', status: 'ok' },
        ],
        links: [link('bots', 'app'), link('app', 'meta', { style: 'dashed', label: 'blocked', labelTone: 'warn' })],
        flows: [
          { path: ['bots', 'app'], tone: 'error', label: 'url=169.254.169.254', duration: 1.8 },
          { path: ['app', 'bots'], tone: 'response', label: '400 host not allowed', duration: 1.8, delay: 2 },
        ],
        panel: {
          title: 'SSRF defenses',
          icon: 'Shield',
          rows: [
            { text: 'Allowlist target hosts', value: 'best', tone: 'good' },
            { text: 'Block private ranges', value: 'after DNS resolve', tone: 'good' },
            { text: 'Metadata service', value: 'IMDSv2 only', tone: 'good' },
          ],
        },
        caption: 'The server refuses internal destinations',
      },
    },
    {
      title: 'Segmentation',
      tag: 'concept',
      heading: 'Network segmentation: only the next layer may talk to you',
      eli5: 'The castle is split into courtyards with their own doors. Visitors reach only the outer yard, cooks reach only the kitchen, and only the cooks\' door leads to the **vault room**.',
      body: [
        'Put each tier in its own subnet and deny everything else by default. The edge is the only thing with a public address. The app subnet accepts connections only from the WAF or load balancer. The data subnet accepts port 5432 only from the app subnet.',
        'The leaked database password from part 1 is now much less useful, because nothing on the internet can reach the database.',
      ],
      keyIdea: 'Segmentation turns "reachable from anywhere" into "reachable only from the layer in front", so one breach cannot walk sideways.',
      metrics: { layers: '4', origin: 'filtered', exposed: 'edge only', blast: 'one segment' },
      metricTones: { exposed: 'good', blast: 'good' },
      scene: {
        nodes: [
          { ...bots, at: at(-5.4, 0), label: 'internet', sub: 'anyone', status: 'dim' },
          { ...edge, status: 'ok', badge: 'only public IP' },
          { ...app, at: at(1.8, 0), badge: 'from edge only' },
          { ...db, at: at(5.4, 0), status: 'ok', badge: '5432 from app only' },
        ],
        links: [link('bots', 'edge'), link('edge', 'app'), link('app', 'db')],
        flows: [
          { path: ['bots', 'edge'], tone: 'error', label: 'db port: denied', duration: 1.6 },
          { path: ['edge', 'app', 'db'], tone: 'request', label: 'allowed path', duration: 2.4, delay: 1.7 },
        ],
        panel: {
          title: 'Allow rules, deny by default',
          icon: 'Network',
          rows: [
            { text: 'Internet to edge: 443', value: 'allow', tone: 'good' },
            { text: 'Edge to app: 8080', value: 'allow', tone: 'good' },
            { text: 'App to database: 5432', value: 'allow', tone: 'good' },
            { text: 'Everything else', value: 'deny', tone: 'good' },
          ],
        },
        caption: 'Each tier accepts traffic only from the tier before it',
      },
    },
    {
      title: 'Admin access',
      tag: 'concept',
      heading: 'One audited path for admins',
      eli5: 'The castle has exactly one side door for the repair crew, with a guard who writes down who goes in. No crew member gets a private key to the vault wall.',
      body: [
        'Admin access goes through one audited path, such as a bastion host or a session manager with single sign-on, never through SSH open to the world. Watch the rules over time: "temporary" allow-all rules are a common way for segments to quietly merge.',
      ],
      keyIdea: 'Give people one logged way in, and review firewall rules so segments do not quietly merge.',
      metrics: { layers: '4', origin: 'filtered', exposed: 'edge + bastion', blast: 'one segment' },
      scene: {
        nodes: [
          { id: 'admin', kind: 'user', at: at(-5.4, 0), label: 'engineer', sub: 'SSO + MFA' },
          { id: 'bastion', kind: 'block', size: 0.8, at: at(-1.8, 0), label: 'bastion', sub: 'session logged', icon: 'KeyRound', tint: 'violet', status: 'active' },
          { ...app, at: at(1.8, 0), status: 'ok', badge: 'SSH from bastion only' },
          { ...bots, at: at(5.4, 3.8), label: 'internet', sub: 'port 22 closed', status: 'dim' },
        ],
        links: [link('admin', 'bastion'), link('bastion', 'app'), link('bots', 'app', { style: 'faint' })],
        flows: [
          { path: ['admin', 'bastion', 'app'], tone: 'request', label: 'audited session', duration: 2.4 },
          { path: ['bots', 'app'], tone: 'error', label: 'port 22: no route', duration: 2.4, delay: 2.6 },
        ],
        panel: {
          title: 'Admin path rules',
          icon: 'KeyRound',
          rows: [
            { text: 'SSH open to world', value: 'never', tone: 'bad' },
            { text: 'Access via bastion + SSO', value: 'yes', tone: 'good' },
            { text: 'Session recorded', value: 'yes', tone: 'good' },
            { text: 'Review allow rules', value: 'regularly', tone: 'warn' },
          ],
        },
        caption: 'Admins enter by one door that keeps a log',
      },
    },
    {
      title: 'Least privilege',
      tag: 'concept',
      heading: 'Least privilege: shrink what a stolen identity can do',
      eli5: 'The cook\'s key opens the pantry and nothing else. If someone steals it, they get flour and eggs. The **vault** needs a different key that the cook never carries.',
      body: [
        'Assume an attacker eventually runs code as your app. What they can do next equals what the app\'s identity is allowed to do. As database owner they can drop tables and create logins. As a narrow role they get much less.',
        '**Least privilege** gives each identity the smallest set of permissions its job needs. Migrations run with a separate account. Reporting uses a read-only account.',
      ],
      keyIdea: 'Give every identity the minimum it needs, so a compromise in one place stays a small incident.',
      metrics: { layers: '5', origin: 'filtered', exposed: 'edge only', blast: 'one role' },
      metricTones: { layers: 'good', blast: 'good' },
      scene: {
        nodes: [
          { ...app, at: at(-5.4, 0), status: 'active', badge: 'role: shop_api' },
          { ...db, at: at(-1.8, 0), status: 'ok', badge: 'DROP denied' },
          { id: 'migrator', kind: 'block', size: 0.8, at: at(1.8, 0), label: 'migrations', sub: 'role: shop_migrator', icon: 'Workflow', tint: 'gray', status: 'dim' },
        ],
        links: [link('app', 'db'), link('migrator', 'db', { style: 'dashed', label: 'deploys only' })],
        flows: [
          { path: ['app', 'db'], tone: 'request', label: 'INSERT order', duration: 1 },
          { path: ['db', 'app'], tone: 'response', label: 'ok', duration: 1, delay: 1.1 },
          { path: ['app', 'db'], tone: 'request', label: 'DROP TABLE', duration: 1, delay: 2.3 },
          { path: ['db', 'app'], tone: 'error', label: 'permission denied', duration: 1, delay: 3.4 },
        ],
        panel: {
          title: 'One role per job',
          icon: 'Table',
          rows: [
            { text: 'shop_api', value: 'read, write orders', tone: 'good' },
            { text: 'shop_api on prices', value: 'read only', tone: 'good' },
            { text: 'shop_migrator', value: 'DDL, deploys only' },
            { text: 'reporting', value: 'read-only replica' },
          ],
        },
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
      title: 'Cloud roles',
      tag: 'concept',
      heading: 'The same rule for cloud roles and secrets',
      eli5: 'The image helper may open one cupboard, not every cupboard. And each helper asks the **keeper** for only their own key, rather than carrying a ring of all of them.',
      body: [
        'The image resizer may read one bucket, not every bucket. Review grants regularly and remove the ones no longer used. Combine this with the secrets manager from the encryption lesson, so each service fetches only its own credentials.',
      ],
      keyIdea: 'Scope every cloud role and secret to one service, and prune what is unused.',
      metrics: { layers: '5', origin: 'filtered', exposed: 'edge only', blast: 'one role' },
      metricTones: { blast: 'good' },
      scene: {
        nodes: [
          { id: 'resizer', kind: 'block', size: 0.8, at: at(-5.4, 0), label: 'image resizer', sub: 'role: resize', icon: 'Image', tint: 'blue', status: 'active' },
          { id: 'bucket', kind: 'storage', at: at(-1.8, 0), label: 'uploads bucket', sub: 'read allowed', status: 'ok' },
          { id: 'invoices', kind: 'storage', at: at(1.8, 0), label: 'invoices bucket', sub: 'access denied', status: 'dim' },
          { id: 'secrets', kind: 'vault', at: at(5.4, 3.8), label: 'secrets manager', sub: 'per-service keys' },
        ],
        links: [link('resizer', 'bucket'), link('resizer', 'invoices', { style: 'faint' }), link('resizer', 'secrets', { style: 'dashed' })],
        flows: [
          { path: ['resizer', 'bucket'], tone: 'request', label: 'GetObject', duration: 1.4 },
          { path: ['resizer', 'invoices'], tone: 'error', label: 'denied', duration: 1.8, delay: 1.6 },
        ],
        panel: {
          title: 'Policy for the resizer',
          icon: 'Code',
          code: 'Allow s3:GetObject  on uploads/*\nAllow s3:PutObject  on thumbs/*\nDeny  everything else',
          footer: { text: 'One job, one bucket, one secret', tone: 'good' },
        },
        caption: 'A stolen role opens one cupboard',
      },
    },
    {
      title: 'Detection',
      tag: 'concept',
      heading: 'Log and alert so attacks are noticed',
      eli5: 'Every guard writes down odd happenings, and a bell rings if too many locked doors get rattled in one night. A castle that never notices a thief cannot catch one.',
      body: [
        'Log logins, access denials, WAF blocks and admin actions in one searchable place, away from the servers that could be tampered with. Alert on spikes: failed logins, 403s, or a database role used from a new place. Fast detection shortens the time a breach stays small.',
      ],
      keyIdea: 'Prevention fails sometimes. Logs and alerts decide how long you stay unaware.',
      metrics: { layers: '5', origin: 'filtered', exposed: 'edge only', blast: 'one role' },
      scene: {
        nodes: [
          { ...waf, at: at(-5.4, 0), status: 'active', chips: [{ text: '403 x 900 / min', tone: 'warn' }] },
          { ...app, at: at(-1.8, 0), chips: [{ text: 'login failed x 300', tone: 'warn' }] },
          { id: 'logs', kind: 'monitor', at: at(1.8, 0), label: 'central logs', sub: 'append only', status: 'active' },
          { id: 'alert', kind: 'block', size: 0.8, at: at(5.4, 0), label: 'on-call alert', sub: 'page the team', icon: 'Zap', tint: 'red', status: 'hot' },
        ],
        links: [link('waf', 'logs'), link('app', 'logs'), link('logs', 'alert')],
        flows: [
          { path: ['waf', 'logs'], tone: 'event', label: 'blocks', duration: 1.6 },
          { path: ['app', 'logs'], tone: 'event', label: 'auth events', duration: 1.6, delay: 0.3 },
          { path: ['logs', 'alert'], tone: 'error', label: 'threshold crossed', duration: 1.6, delay: 2 },
        ],
        panel: {
          title: 'Signals worth alerting on',
          icon: 'Activity',
          rows: [
            { text: 'Failed logins per account', value: '> 20 / 10 min', tone: 'warn' },
            { text: 'WAF blocks per minute', value: 'spike', tone: 'warn' },
            { text: 'DB role from new address', value: 'page', tone: 'bad' },
          ],
        },
        caption: 'Attacks leave a trail that someone reads',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Layers around the code, each assuming the others failed',
      eli5: 'Outer gates absorb the crowd, the inner guards read papers, parts are patched, courtyards are separate, each key opens one room, and a bell rings at odd noises. Beating one **layer** gets a thief almost nothing.',
      body: [
        'A large edge network absorbs **DDoS** floods and hides the origin. A **WAF** filters known patterns, with care for false positives. Patch dependencies and block **SSRF**. The private network (**segmentation**) limits who can reach each tier, **least privilege** limits what each identity can do, and logs and alerts shorten detection time.',
      ],
      keyIdea: 'No single control is perfect. Security comes from layers that fail for different reasons and from keeping each breach small.',
      metrics: { layers: '5', origin: '<1% of flood', exposed: 'edge only', blast: 'one role' },
      metricTones: { layers: 'good', origin: 'good', exposed: 'good', blast: 'good' },
      scene: {
        nodes: [
          { ...bots, at: at(-5.4, 0), status: 'dim' },
          { ...edge, status: 'ok' },
          { ...waf, status: 'ok' },
          { ...app, status: 'ok' },
        ],
        links: [link('bots', 'edge'), link('edge', 'waf'), link('waf', 'app')],
        flows: [
          { path: ['bots', 'edge'], tone: 'error', count: 3, duration: 1 },
          { path: ['edge', 'waf', 'app'], tone: 'request', duration: 2.4, delay: 0.5 },
        ],
        panel: {
          title: 'Layer and what it stops',
          icon: 'Layers',
          rows: [
            { text: '1 Edge network', value: 'floods' },
            { text: '2 WAF', value: 'known patterns' },
            { text: '3 App code', value: 'flaws from part 1' },
            { text: '4 Private network', value: 'lateral movement' },
            { text: '5 DB account', value: 'big breaches' },
          ],
          footer: { text: 'Plus detection: logs and alerts shorten the time unnoticed', tone: 'muted' },
        },
        caption: 'The same five layers as part 1, plus detection',
      },
      quiz: {
        question: 'Attackers get code running as your app. Which control most limits what they can do next?',
        options: [
          'A bigger edge network',
          'A narrow database role and network segments, so the app identity can reach and change little',
          'A longer CSP header',
          'More WAF rules',
        ],
        answer: 1,
        explain: 'Once code runs as the app, edge and WAF layers are already behind. What the attacker can do equals what the app identity is allowed and able to reach, so least privilege and segmentation shrink the damage.',
      },
    },
  ],
};
