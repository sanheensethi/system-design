import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const syd: SceneNode = { id: 'syd', kind: 'user', at: at(-5, 0), label: 'Sydney users' };
const edge: SceneNode = { id: 'edge', kind: 'cdn', at: at(-1.7, 0), label: 'edge SYD', sub: '10 ms away' };
const origin: SceneNode = { id: 'origin', kind: 'server', at: at(5, 0), label: 'origin', sub: 'Virginia' };

export const cdnPart2: Lesson = {
  id: 'cdn-part-2',
  title: 'Content delivery networks (part 2)',
  tagline: 'What the edge must not cache, how to cache the awkward cases, and how to plan for failure, attacks and cost.',
  minutes: 12,
  level: 'Intermediate',
  learn: [
    'What must never be cached in a shared cache, and how signed URLs protect private files',
    'Micro-caching, dynamic content and edge compute',
    'Serving stale content when the origin is down, and planning for a CDN outage',
    'Security at the edge, cost, and large files or video',
  ],
  metrics: [
    { key: 'rtt', label: 'Sydney RTT', icon: 'Signal' },
    { key: 'load', label: 'Sydney page load', icon: 'Timer' },
    { key: 'hit', label: 'Edge hit rate', icon: 'Gauge' },
    { key: 'egress', label: 'Origin egress', icon: 'Download' },
  ],
  steps: [
    {
      title: 'Not cacheable',
      tag: 'tradeoff',
      heading: 'What the edge should never cache',
      eli5: 'A branch may keep copies of storybooks that are the same for everyone. Your own diary is **private**, so the branch never keeps a copy and always fetches it straight from the big library for you.',
      body: [
        'Carts, account pages and any response that sets a cookie stay out of shared caches. Mark them `private, no-store` and the CDN passes them to origin every time. One wrong `public` header serves one user\'s cart to the next person.',
        'Decide by explicit rules and the origin\'s `Cache-Control`, not file extension, or `/account/x.css` gets cached (web cache deception). Headers that change the reply belong in the key or get rejected.',
      ],
      keyIdea: 'Cache what is the same for everyone. Personal responses pass straight through.',
      metrics: { rtt: '10 ms', load: '350 ms', hit: '97%', egress: '0.5 Gbps' },
      scene: {
        nodes: [syd, { ...edge, status: 'active', badge: 'bypass: private' }, { ...origin, status: 'active', chips: [{ text: 'cart for user 42', tone: 'warn' }] }],
        links: [link('syd', 'edge'), link('edge', 'origin', { style: 'dashed' })],
        flows: [
          { path: ['syd', 'edge', 'origin'], tone: 'request', label: 'GET /cart', duration: 2.4 },
          { path: ['origin', 'edge', 'syd'], tone: 'response', label: 'private, no-store', duration: 2.4, delay: 2.5 },
        ],
        panel: {
          title: 'Cache or pass through',
          icon: 'Shield',
          rows: [
            { text: 'logo.png, app.js', value: 'cache', tone: 'good' },
            { text: '/cart, /account', value: 'pass through', tone: 'warn' },
            { text: 'any response with Set-Cookie', value: 'pass through', tone: 'warn' },
            { text: 'one user\'s cart as public', value: 'data leak', tone: 'bad' },
            { text: 'Decide by extension, e.g. .css', value: 'cache deception risk', tone: 'bad' },
            { text: 'Headers that change the reply', value: 'in the key, or reject', tone: 'warn' },
          ],
        },
        caption: 'Personal responses pass straight through',
      },
    },
    {
      title: 'Writes pass through',
      tag: 'concept',
      heading: 'Writes still gain from the nearby edge',
      eli5: 'When a kid hands in a drawing for the big library to keep, the branch cannot keep it for them. It still saves the kid the knocking and card-showing, and passes the drawing along on a ready-made road.',
      body: [
        'Writes such as `POST /checkout` always go through to the origin, because there is nothing to cache.',
        'The CDN still helps. The TLS handshake ends nearby, and the edge keeps warm connections to origin, so a Sydney checkout skips the setup cost on the long leg.',
      ],
      keyIdea: 'Write traffic cannot be cached, yet it still gains from the nearby TLS handshake and warm origin connections.',
      metrics: { rtt: '10 ms', load: '350 ms', hit: '97%', egress: '0.5 Gbps' },
      scene: {
        nodes: [syd, { ...edge, status: 'active', chips: [{ text: 'TLS ends here', tone: 'good' }] }, { ...origin, status: 'active' }],
        links: [link('syd', 'edge', { label: '10 ms', labelTone: 'good' }), link('edge', 'origin', { style: 'dashed', label: 'warm connection' })],
        flows: [
          { path: ['syd', 'edge', 'origin'], tone: 'request', label: 'POST /checkout', duration: 2.4 },
          { path: ['origin', 'edge', 'syd'], tone: 'response', label: '201', duration: 2.4, delay: 2.5 },
        ],
        panel: {
          title: 'Checkout from Sydney',
          icon: 'ShoppingBag',
          rows: [
            { text: 'Handshake to origin', value: '400 to 600 ms', tone: 'bad' },
            { text: 'Handshake to the PoP', value: '~30 ms', tone: 'good' },
            { text: 'Origin work', value: 'unchanged' },
          ],
        },
        caption: 'Nothing to cache, still a shorter road',
      },
    },
    {
      title: 'Signed URLs',
      tag: 'concept',
      heading: 'Private files get short-lived signed links',
      eli5: 'A library card to borrow a private book has an expiry date stamped on it. The branch checks the stamp and the date, and hands the book over only while the card is still good.',
      body: [
        'For private files such as invoices, the origin makes a **signed URL**: path, expiry time and a signature from a secret key. The edge checks both before serving.',
        'Expired or edited links get a `403`. Each link has its own `exp` and `sig`, so the CDN verifies them, then drops both from the cache key (CloudFront and Cloudflare can). All valid links share one cached copy.',
      ],
      keyIdea: 'A signed URL lets the edge serve private files to the right person for a short time.',
      metrics: { rtt: '10 ms', load: '350 ms', hit: '97%', egress: '0.5 Gbps' },
      scene: {
        nodes: [
          { ...syd, chips: ['invoice-77.pdf'] },
          { ...edge, status: 'active', chips: [{ text: 'check signature', tone: 'good' }] },
          { id: 'signer', kind: 'block', at: at(3, -4.4), label: 'app server', sub: 'signs links', icon: 'KeyRound', tint: 'violet' },
        ],
        links: [link('syd', 'edge'), link('signer', 'edge', { style: 'dashed' })],
        flows: [
          { path: ['signer', 'edge', 'syd'], tone: 'response', label: 'signed link', duration: 2.2 },
          { path: ['syd', 'edge'], tone: 'request', label: 'GET ?sig=9c1f', duration: 1, delay: 2.4 },
          { path: ['edge', 'syd'], tone: 'response', label: '200', duration: 1, delay: 3.5 },
        ],
        panel: {
          code: 'https://shop.example/inv/77.pdf\n  ?exp=1767225600\n  &sig=9c1f2e7a\n\nsig = HMAC(secret, path + exp)\nexpired or edited link -> 403\ncache key = host + path (exp, sig left out)',
          title: 'A signed URL',
          icon: 'Key',
          footer: { text: 'Verify first, then share one cached copy', tone: 'good' },
        },
        caption: 'The edge checks the stamp, then serves',
      },
      code: {
        language: 'typescript',
        title: 'Sign a link that lasts 5 minutes',
        source: `import { createHmac } from 'node:crypto';

export function signedUrl(path: string, secret: string) {
  const exp = Math.floor(Date.now() / 1000) + 300;
  const sig = createHmac('sha256', secret)
    .update(path + exp)
    .digest('hex');
  return \`https://shop.example\${path}?exp=\${exp}&sig=\${sig}\`;
}`,
        highlight: [4, 5, 8],
      },
    },
    {
      title: 'Micro-caching',
      tag: 'concept',
      heading: 'Even a 5-second TTL is a huge win',
      eli5: 'A news board changes often, but not every second. The branch keeps its copy for only a few seconds, and thousands of kids read it before anyone asks the big library again.',
      body: [
        'Content that is shared but changes often, such as stock counts or a news front page, can be cached for a few seconds. This is **micro-caching**.',
        'Even a 5-second TTL turns 10,000 requests per second into one origin request per PoP every 5 seconds. Users see data at most 5 seconds old.',
      ],
      keyIdea: 'A few seconds of caching turns a flood of identical requests into a trickle, at the cost of slightly old data.',
      metrics: { rtt: '10 ms', load: '350 ms', hit: '-', egress: '-' },
      scene: {
        nodes: [
          { ...syd, chips: [{ text: '10,000 req/s', tone: 'warn' }] },
          { ...edge, status: 'ok', badge: 'TTL 5 s', chips: ['GET /news'] },
          { ...origin, status: 'ok', chips: ['1 req / 5 s'] },
        ],
        links: [link('syd', 'edge'), link('edge', 'origin', { style: 'dashed', label: 'every 5 s' })],
        flows: [
          { path: ['syd', 'edge', 'syd'], tone: 'response', count: 5, duration: 1 },
          { path: ['edge', 'origin'], tone: 'request', label: 'refresh', duration: 2, delay: 1.2 },
        ],
        panel: {
          title: 'One news page',
          icon: 'Timer',
          rows: [
            { text: 'User requests', value: '10,000 per second' },
            { text: 'Origin requests', value: '1 per 5 s per PoP', tone: 'good' },
            { text: 'Worst-case staleness', value: '5 seconds', tone: 'warn' },
          ],
        },
        caption: 'Short TTL, big saving',
      },
    },
    {
      title: 'Dynamic content',
      tag: 'concept',
      heading: 'Edge compute runs small pieces of code at the PoP',
      eli5: 'The branch librarian can follow a few simple rules without calling the big library: send a kid to the right shelf, pick which cover to show, and check a library card.',
      body: [
        '**Edge compute** (Cloudflare Workers, Lambda@Edge, Fastly Compute) runs your code in the PoP. Typical jobs: redirects, A/B test choice, country-based content, auth checks and stitching a cached page shell with a small per-user part.',
        'The limit is data. Your database sits in one region, so edge code that queries it pays the long trip again. Keep edge logic to what it can decide from the request alone.',
      ],
      keyIdea: 'Edge code is great for decisions made from the request, and weak for anything that needs your database.',
      metrics: { rtt: '10 ms', load: '350 ms', hit: '97%', egress: '0.5 Gbps' },
      scene: {
        nodes: [
          { ...syd, chips: ['GET / (AU)'] },
          { id: 'worker', kind: 'block', at: edge.at, label: 'edge code', sub: 'runs at the PoP', icon: 'Code', tint: 'amber', status: 'active', chips: [{ text: 'country = AU', tone: 'good' }] },
          { ...origin, status: 'dim' },
        ],
        links: [link('syd', 'worker', { label: '10 ms', labelTone: 'good' }), link('worker', 'origin', { style: 'dashed', label: 'only if needed' })],
        flows: [
          { path: ['syd', 'worker'], tone: 'request', label: 'GET /', duration: 0.8 },
          { path: ['worker', 'syd'], tone: 'response', label: 'AU page', duration: 0.8, delay: 0.9 },
        ],
        panel: {
          title: 'Good and poor fits',
          icon: 'Cpu',
          rows: [
            { text: 'Redirects, A/B tests', value: 'good fit', tone: 'good' },
            { text: 'Geo-based content', value: 'good fit', tone: 'good' },
            { text: 'Auth token checks', value: 'good fit', tone: 'good' },
            { text: 'Queries to your database', value: 'long trip back', tone: 'warn' },
          ],
        },
        caption: 'Decide at the edge, call home only if needed',
      },
    },
    {
      title: 'Origin down',
      tag: 'case',
      heading: 'Case: the origin goes down, the site stays up',
      eli5: 'The big library closes for repairs for an afternoon. The branches still hand out the copies they have on their shelves, a little old but perfectly readable.',
      body: [
        'The origin starts returning `503` errors. A CDN with `stale-if-error=86400` serves the last good copy for up to a day instead of passing the error on.',
        'Pages with a recent cached copy keep working. Personal and uncached requests still fail, but the damage shrinks to a small share of traffic.',
      ],
      keyIdea: 'A high hit rate plus stale-if-error turns an origin outage into a partial one.',
      metrics: { rtt: '10 ms', load: '350 ms', hit: '97%', egress: '0 Gbps' },
      metricTones: { egress: 'warn' },
      scene: {
        nodes: [syd, { ...edge, status: 'ok', badge: 'serving stale', chips: [{ text: 'stale-if-error=86400', tone: 'good' }] }, { ...origin, status: 'down', badge: '503' }],
        links: [link('syd', 'edge'), link('edge', 'origin', { style: 'dashed', labelTone: 'bad', label: 'errors' })],
        flows: [
          { path: ['edge', 'origin'], tone: 'error', label: '503', duration: 1.8 },
          { path: ['syd', 'edge'], tone: 'request', label: 'GET /', duration: 0.8, delay: 2 },
          { path: ['edge', 'syd'], tone: 'response', label: '200 (stale)', duration: 0.8, delay: 2.9 },
        ],
        panel: {
          title: 'During the outage',
          icon: 'Shield',
          rows: [
            { text: 'Cached pages', value: 'served stale', tone: 'good' },
            { text: 'Uncached pages', value: 'fail', tone: 'bad' },
            { text: 'Carts and logins', value: 'fail', tone: 'bad' },
          ],
        },
        caption: 'Old pages beat error pages',
      },
      quiz: {
        question: 'A response is sent with `Cache-Control: private, no-store`. What does the CDN do with it?',
        options: [
          'Caches it for one day by default',
          'Caches it at the edge but not in browsers',
          'Passes it through and stores nothing in shared caches',
          'Caches it only for logged-in users',
        ],
        answer: 2,
        explain: '`private` keeps it out of shared caches such as the CDN, and `no-store` tells every cache to keep nothing. The request goes to origin each time.',
      },
    },
    {
      title: 'CDN down',
      tag: 'tradeoff',
      heading: 'The CDN is a dependency too',
      eli5: 'What if all the branch libraries close at once? A smart family keeps a second map: either another chain of branches, or a way to walk straight to the big library.',
      body: [
        'Big CDNs have had outages that took many sites down. Keep a low DNS TTL so you can repoint to the origin or a second CDN. Larger sites use **multi-CDN** with health checks.',
        'Switching costs something. CDN B starts cold, so misses flood the origin until it warms up. DNS repoints finish only as resolvers expire the TTL, and some ignore it.',
      ],
      keyIdea: 'Know your plan B before the CDN fails: low DNS TTL, another CDN, and an origin that can survive the traffic.',
      metrics: { rtt: '-', load: '350 ms', hit: '-', egress: '16 Gbps' },
      metricTones: { egress: 'bad' },
      scene: {
        nodes: [
          syd,
          { ...edge, status: 'down', badge: 'outage', label: 'CDN A' },
          { id: 'cdn-b', kind: 'cdn', at: at(-1.2, 8.5), label: 'CDN B', sub: 'backup provider', status: 'ok' },
          { ...origin, status: 'active' },
        ],
        links: [link('syd', 'edge'), link('syd', 'cdn-b', { style: 'dashed', label: 'DNS repoint', labelTone: 'good' }), link('edge', 'origin', { style: 'dashed' }), link('cdn-b', 'origin', { style: 'dashed' })],
        flows: [
          { path: ['syd', 'cdn-b'], tone: 'request', label: 'GET /', duration: 1 },
          { path: ['cdn-b', 'syd'], tone: 'response', duration: 1, delay: 1.1 },
        ],
        panel: {
          title: 'Plan B',
          icon: 'Router',
          rows: [
            { text: 'DNS TTL on the CDN record', value: '60 s', tone: 'good' },
            { text: 'Second CDN with health checks', value: 'multi-CDN' },
            { text: 'Origin sized for a bypass', value: '16 Gbps worth', tone: 'warn' },
            { text: 'CDN B starts cold', value: 'miss spike at origin', tone: 'bad' },
            { text: 'DNS repoint completes', value: 'up to the TTL', tone: 'warn' },
          ],
        },
        caption: 'Repoint DNS, keep serving',
      },
    },
    {
      title: 'Security',
      tag: 'concept',
      heading: 'The edge is also a shield against attacks',
      eli5: 'A crowd of troublemakers arrives at the library. The branches are many and big, and they send the troublemakers away at the door, so the big library never feels a thing.',
      body: [
        'A **DDoS** attack aimed at your site lands on hundreds of PoPs. Their combined capacity is far larger than one origin, and attack traffic that fails the checks never reaches you.',
        'The CDN ends TLS at the edge and can run a **web application firewall** (WAF) and rate limits there. Lock the origin to accept only the CDN\'s IP ranges, or attackers will bypass the shield and hit the origin directly.',
      ],
      keyIdea: 'Put filtering at the edge, and make the origin reachable only through the CDN.',
      metrics: { rtt: '10 ms', load: '350 ms', hit: '97%', egress: '0.5 Gbps' },
      scene: {
        nodes: [
          { id: 'bots', kind: 'user', at: at(-5, 0), label: 'attack traffic', status: 'hot', chips: [{ text: '500,000 req/s', tone: 'bad' }] },
          { ...edge, status: 'active', chips: [{ text: 'WAF + rate limit', tone: 'good' }] },
          { ...origin, status: 'ok', chips: [{ text: 'CDN IPs only', tone: 'good' }] },
        ],
        links: [link('bots', 'edge'), link('edge', 'origin', { style: 'dashed' })],
        flows: [
          { path: ['bots', 'edge'], tone: 'error', count: 5, duration: 0.9 },
          { path: ['edge', 'origin'], tone: 'request', label: 'clean only', duration: 1.8, delay: 1 },
        ],
        panel: {
          title: 'Edge defenses',
          icon: 'Shield',
          rows: [
            { text: 'Absorb volume', value: 'hundreds of PoPs', tone: 'good' },
            { text: 'WAF rules', value: 'block bad requests', tone: 'good' },
            { text: 'Rate limits', value: 'per IP or key', tone: 'good' },
            { text: 'Origin open to the internet', value: 'defeats it all', tone: 'bad' },
          ],
        },
        caption: 'Attacks end at the edge',
      },
    },
    {
      title: 'Cost',
      tag: 'tradeoff',
      heading: 'You pay per gigabyte, and hit rate sets the bill',
      eli5: 'The branch libraries charge a small fee for each book they hand out. But the big library would charge far more for sending every book itself, so the fee is usually worth paying.',
      body: [
        'CDNs bill per GB delivered and per request, with prices that vary by region. A miss costs twice: the CDN bills delivery and your origin bills its egress. A high hit rate lowers both.',
        'Rarely requested files gain little and still cost storage and fetch fees. PoPs evict the least recently used files when full, so one-hit files push out useful ones. Consider bypass.',
      ],
      keyIdea: 'A CDN charges for delivery, and a high hit rate lowers both the CDN and the origin bill.',
      metrics: { rtt: '10 ms', load: '350 ms', hit: '97%', egress: '0.5 Gbps' },
      scene: {
        nodes: [syd, { ...edge, status: 'ok', badge: 'billed per GB' }, { ...origin, status: 'ok', badge: 'cheap egress' }],
        links: [link('syd', 'edge'), link('edge', 'origin', { style: 'dashed', label: 'misses cost twice', labelTone: 'warn' })],
        flows: [
          { path: ['edge', 'syd'], tone: 'response', count: 4, duration: 1.2 },
          { path: ['edge', 'origin'], tone: 'request', duration: 2, delay: 1.4 },
        ],
        panel: {
          title: 'Where the bill comes from',
          icon: 'Receipt',
          rows: [
            { text: 'Data delivered', value: 'per GB' },
            { text: 'Requests', value: 'per 10,000' },
            { text: 'Origin fetches (misses)', value: 'per GB, maybe', tone: 'warn' },
            { text: 'Price by region', value: 'varies a lot', tone: 'warn' },
            { text: 'Rarely requested files', value: 'low value, consider bypass', tone: 'warn' },
            { text: 'Disk full', value: 'least recently used evicted' },
          ],
          footer: { text: 'Raise the hit rate, lower every line', tone: 'good' },
        },
        caption: 'Hit rate is the cost lever',
      },
    },
    {
      title: 'Video segments',
      tag: 'concept',
      heading: 'Video is cached as small segments',
      eli5: 'A giant picture book is split into short chapters. The branch keeps the chapters kids ask for most, and a kid who skips ahead only needs the chapter they want.',
      body: [
        'Video formats such as HLS and DASH split a movie into segments of a few seconds. Each segment is a small file with its own URL, so the CDN caches it like any other file.',
        'Popular segments stay hot at the edge and users start playing from a nearby copy. The origin never has to serve the whole 2 GB movie to anyone.',
      ],
      keyIdea: 'Cutting video into small segments lets the edge cache and serve the parts people actually watch.',
      metrics: { rtt: '10 ms', load: '350 ms', hit: '97%', egress: '0.5 Gbps' },
      scene: {
        nodes: [
          { ...syd, chips: ['seg-002.ts'] },
          { ...edge, status: 'ok', chips: ['seg-001.ts', 'seg-002.ts'], badge: 'HIT' },
          { ...origin, status: 'dim', chips: ['movie.mp4 · 2 GB'] },
        ],
        links: [link('syd', 'edge'), link('edge', 'origin', { style: 'dashed' })],
        flows: [
          { path: ['syd', 'edge'], tone: 'request', label: 'segment 2', duration: 0.8 },
          { path: ['edge', 'syd'], tone: 'response', label: '200 · segment 2', duration: 0.8, delay: 0.9 },
        ],
        panel: {
          title: 'Splitting a movie',
          icon: 'Layers',
          rows: [
            { text: 'One 2 GB file', value: 'hard to cache whole', tone: 'warn' },
            { text: 'Segments of a few seconds', value: 'small, cacheable', tone: 'good' },
          ],
        },
        caption: 'Small pieces cache well',
      },
    },
    {
      title: 'Range requests',
      tag: 'concept',
      heading: 'Large downloads are fetched in slices',
      eli5: 'A kid who lost their place in a thick book asks only for pages 100 to 120. The branch hands over just that slice instead of the whole book.',
      body: [
        'For a large download that is one file, the edge supports **range requests** such as `Range: bytes=0-1048575`. A reply of `206 Partial Content` carries only that slice.',
        'Many CDNs fetch and cache only the slices asked for, so a resumed download or a skipped video part does not move the whole file.',
      ],
      keyIdea: 'Range requests let a client and the edge move only the slice of a big file that is needed.',
      metrics: { rtt: '10 ms', load: '350 ms', hit: '97%', egress: '0.5 Gbps' },
      scene: {
        nodes: [
          { ...syd, chips: ['Range: bytes=0-1048575'] },
          { ...edge, status: 'ok', chips: ['bytes 0-1048575'], badge: 'HIT' },
          { ...origin, status: 'dim', chips: ['setup.iso · 2 GB'] },
        ],
        links: [link('syd', 'edge'), link('edge', 'origin', { style: 'dashed' })],
        flows: [
          { path: ['syd', 'edge'], tone: 'request', label: 'Range: bytes=0-1048575', duration: 0.8 },
          { path: ['edge', 'syd'], tone: 'response', label: '206 slice', duration: 0.8, delay: 0.9 },
        ],
        panel: {
          title: 'Ranges',
          icon: 'Layers',
          rows: [
            { text: 'Range request', value: 'ask for a slice', tone: 'good' },
            { text: '206 Partial Content', value: 'slice only', tone: 'good' },
            { text: 'Resumed download', value: 'no restart' },
          ],
        },
        caption: 'Only the slice moves',
      },
      code: {
        language: 'bash',
        title: 'Ask for the first megabyte',
        source: `$ curl -sI -H "Range: bytes=0-1048575" https://shop.example/dl/setup.iso
HTTP/2 206
content-range: bytes 0-1048575/2147483648
content-length: 1048576
accept-ranges: bytes
x-cache: HIT from edge-syd`,
        highlight: [2, 3],
      },
    },
    {
      title: 'Recap, part 2',
      tag: 'recap',
      heading: 'Cache the shared, pass the personal, plan for failure',
      eli5: 'The branch libraries keep shared books, never keep diaries, check expiring cards for private books, and have a backup map if they close. Their fees are lower when more kids find books on the shelf.',
      body: [
        'Personal and write traffic passes through the edge, and still gains from the nearby handshake. Private files use signed URLs. Short TTLs and edge code handle fast-changing content.',
        'Stale-if-error, a second CDN and a locked-down origin protect availability and security. The bill follows delivery volume, so a high hit rate keeps both CDN and origin costs low.',
      ],
      keyIdea: 'Cache what is shared, protect what is private, and know your fallback before something breaks.',
      metrics: { rtt: '10 ms', load: '350 ms', hit: '97%', egress: '0.5 Gbps' },
      metricTones: { rtt: 'good', load: 'good', hit: 'good', egress: 'good' },
      scene: {
        nodes: [syd, { ...edge, status: 'ok' }, { ...origin, status: 'ok' }],
        links: [link('syd', 'edge'), link('edge', 'origin', { style: 'dashed' })],
        flows: [
          { path: ['syd', 'edge', 'syd'], tone: 'response', count: 3, duration: 1.2 },
          { path: ['edge', 'origin'], tone: 'request', label: 'misses and writes', duration: 1.8, delay: 1.2 },
        ],
      },
      quiz: {
        question: 'Your invoices are private PDFs, but each user needs fast downloads from a nearby PoP. What fits best?',
        options: [
          'Mark them public so every PoP caches them',
          'Never use the CDN for them',
          'Serve them through short-lived signed URLs that the edge checks',
          'Cache them in the browser only',
        ],
        answer: 2,
        explain: 'A signed URL names the file, carries an expiry and a signature, and the edge checks both before serving. The file stays private and still comes from a nearby PoP.',
      },
    },
  ],
};
