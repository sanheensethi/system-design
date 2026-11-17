import type { Lesson, SceneNode, SceneZone } from '../engine/types';

const syd: SceneNode = { id: 'syd', kind: 'user', at: [-5.6, 2.5], label: 'Sydney users' };
const ber: SceneNode = { id: 'ber', kind: 'user', at: [-5.6, -3], label: 'Berlin users' };
const edgeSyd: SceneNode = { id: 'edge-syd', kind: 'cdn', at: [-3, 2.5], label: 'edge SYD', sub: '10 ms away' };
const edgeFra: SceneNode = { id: 'edge-fra', kind: 'cdn', at: [-3, -3], label: 'edge FRA', sub: '15 ms away' };
const shield: SceneNode = { id: 'shield', kind: 'cdn', at: [2.6, -0.4], label: 'origin shield', sub: 'mid-tier cache' };
const origin: SceneNode = { id: 'origin', kind: 'server', at: [4.8, -0.4], label: 'origin', sub: 'Virginia' };

const zones: SceneZone[] = [
  { id: 'apac', from: [-6.7, 1.2], to: [-1.9, 3.8], label: 'Asia-Pacific', tone: 'amber' },
  { id: 'eu', from: [-6.7, -4.3], to: [-1.9, -1.7], label: 'Europe', tone: 'violet' },
  { id: 'us', from: [1.6, -2], to: [6.4, 1.3], label: 'US East', tone: 'blue' },
];

const edgeLinks = [
  { from: 'syd', to: 'edge-syd' },
  { from: 'ber', to: 'edge-fra' },
  { from: 'edge-syd', to: 'origin', style: 'dashed' as const, label: '200 ms' },
  { from: 'edge-fra', to: 'origin', style: 'dashed' as const, label: '90 ms' },
];

export const cdn: Lesson = {
  id: 'cdn',
  title: 'Content delivery networks',
  tagline: 'Cache responses at edges around the world so far-away users stop paying for distance.',
  minutes: 11,
  level: 'Beginner',
  learn: [
    'Why distance sets a latency floor that code cannot fix',
    'How edge PoPs serve cache hits and fetch misses from origin',
    'Cache-Control headers that decide what the edge keeps',
    'Purging versus versioned URLs for updates',
    'What can and cannot be cached at the edge',
  ],
  metrics: [
    { key: 'rtt', label: 'Sydney RTT' },
    { key: 'load', label: 'Sydney page load' },
    { key: 'hit', label: 'Edge hit rate' },
    { key: 'egress', label: 'Origin egress' },
  ],
  steps: [
    {
      title: 'Far away',
      tag: 'problem',
      heading: 'One origin, users on every continent',
      eli5: 'There is only one library, far away in Virginia. That one library is the **origin**. Kids in Sydney and Berlin wait a long time for every book, and the library cannot hand them out fast enough.',
      body: [
        'The shop runs in one region, Virginia. Sydney is about **200 ms** away per round trip, Berlin about 90 ms. Light in fiber does not go faster, so no code change can remove that.',
        'A product page pulls 40 files: scripts, fonts and 200 KB product images. Even with connection reuse, a Sydney visitor waits about **1.9 seconds**.',
        'The origin also pays in bandwidth. At 10,000 requests per second with an average of 200 KB, it pushes **16 Gbps**, more than its 10 Gbps network cards can carry.',
      ],
      keyIdea: 'Distance adds latency to every round trip, and serving every byte from one place melts the origin\'s network.',
      metrics: { rtt: '200 ms', load: '1.9 s', hit: '-', egress: '16 Gbps' },
      scene: {
        zones: [zones[0], zones[1], zones[2]],
        nodes: [syd, ber, { ...origin, status: 'hot', badge: '16 Gbps out' }],
        links: [
          { from: 'syd', to: 'origin', style: 'dashed', label: '~16,000 km' },
          { from: 'ber', to: 'origin', style: 'dashed' },
        ],
        flows: [
          { path: ['syd', 'origin'], tone: 'request', label: 'GET p42.jpg', duration: 2.6 },
          { path: ['origin', 'syd'], tone: 'response', duration: 2.6, delay: 2.7 },
          { path: ['ber', 'origin'], tone: 'request', duration: 1.6, delay: 0.5 },
          { path: ['origin', 'ber'], tone: 'response', duration: 1.6, delay: 2.2 },
        ],
        caption: 'Every byte crosses an ocean',
      },
    },
    {
      title: 'Edge PoPs',
      tag: 'concept',
      heading: 'Put caches near the users',
      eli5: 'A **CDN** builds little branch libraries in lots of towns. Now a Sydney kid walks to the branch down the street, and no request has to cross the ocean just to say hello.',
      body: [
        'A **CDN** (content delivery network) runs hundreds of **points of presence** (PoPs), small clusters of cache servers in cities around the world. Cloudflare, Akamai, CloudFront and Fastly all work this way.',
        'You point `shop.example` at the CDN. DNS-based routing or **anycast** sends each user to the nearest PoP, so a Sydney user connects to a server in Sydney with a 10 ms round trip.',
        'The TCP and TLS handshakes now complete locally, which already saves several hundred milliseconds before any caching happens.',
      ],
      keyIdea: 'A CDN moves the first hop from across the planet to across town.',
      metrics: { rtt: '10 ms', load: '1.9 s', hit: '-', egress: '16 Gbps' },
      scene: {
        zones,
        nodes: [syd, ber, { ...edgeSyd, status: 'active' }, { ...edgeFra, status: 'active' }, origin],
        links: edgeLinks,
        flows: [
          { path: ['syd', 'edge-syd'], tone: 'handshake', label: 'TLS', duration: 0.7 },
          { path: ['edge-syd', 'syd'], tone: 'handshake', duration: 0.7, delay: 0.75 },
          { path: ['ber', 'edge-fra'], tone: 'handshake', label: 'TLS', duration: 0.7, delay: 0.3 },
          { path: ['edge-fra', 'ber'], tone: 'handshake', duration: 0.7, delay: 1.05 },
        ],
        caption: 'Each user connects to the nearest PoP',
      },
    },
    {
      title: 'Edge hit',
      tag: 'concept',
      heading: 'A cache hit at the edge',
      eli5: 'The Sydney branch already has the picture book on its shelf, so it hands it over right away. That is a **cache hit**, and the big library far away never has to help.',
      body: [
        'When the Sydney PoP already holds `p42.jpg`, it answers straight from its disk or memory. One 10 ms round trip, and Virginia never hears about the request.',
        'The page now loads in about **350 ms** in Sydney. The HTML still comes from Virginia, but every image, script and font comes from a few kilometers away.',
      ],
      keyIdea: 'An edge hit costs one short local round trip and zero origin work.',
      metrics: { rtt: '10 ms', load: '350 ms', hit: '-', egress: '16 Gbps' },
      scene: {
        zones,
        nodes: [syd, ber, { ...edgeSyd, status: 'ok', badge: 'HIT · age 3,121 s' }, edgeFra, { ...origin, status: 'dim' }],
        links: edgeLinks,
        flows: [
          { path: ['syd', 'edge-syd'], tone: 'request', label: 'GET p42.jpg', duration: 0.8 },
          { path: ['edge-syd', 'syd'], tone: 'response', label: '200 · HIT', duration: 0.8, delay: 0.9 },
        ],
        caption: 'Served from Sydney, origin untouched',
      },
    },
    {
      title: 'Edge miss',
      tag: 'concept',
      heading: 'A miss goes back to origin, once',
      eli5: 'The Berlin branch does not have the book yet, so it orders one copy and keeps it for the next kid. It asks the **origin shield** first, a helper branch beside the big library that already holds a copy.',
      body: [
        'A Berlin user asks for a product nobody in Europe has viewed yet. The Frankfurt PoP misses, fetches the file from origin, stores it and serves it. That first user pays the full trip.',
        'With hundreds of PoPs, each one missing once per file still adds up. An **origin shield** is a mid-tier cache near the origin that every PoP asks first. A file goes from origin to the shield once, and from the shield to each PoP after that.',
      ],
      keyIdea: 'Each PoP fetches a file from origin at most once per TTL. An origin shield collapses those fetches into one.',
      metrics: { rtt: '10 ms', load: '350 ms', hit: '-', egress: '16 Gbps' },
      scene: {
        zones,
        nodes: [syd, ber, edgeSyd, { ...edgeFra, status: 'active', badge: 'MISS' }, { ...shield, status: 'active', badge: 'HIT' }, origin],
        links: [
          { from: 'syd', to: 'edge-syd' },
          { from: 'ber', to: 'edge-fra' },
          { from: 'edge-syd', to: 'shield', style: 'dashed' },
          { from: 'edge-fra', to: 'shield', style: 'dashed', label: '90 ms' },
          { from: 'shield', to: 'origin' },
        ],
        flows: [
          { path: ['ber', 'edge-fra'], tone: 'request', label: 'GET p77.jpg', duration: 0.8 },
          { path: ['edge-fra', 'shield'], tone: 'request', label: 'miss', duration: 1.4, delay: 0.9 },
          { path: ['shield', 'edge-fra'], tone: 'data', label: 'store copy', duration: 1.4, delay: 2.4 },
          { path: ['edge-fra', 'ber'], tone: 'response', duration: 0.8, delay: 3.9 },
        ],
        caption: 'Miss at the edge, hit at the shield',
      },
    },
    {
      title: 'Cache-Control',
      tag: 'concept',
      heading: 'Headers decide what the edge keeps',
      eli5: 'Each book from the big library comes with a note called **Cache-Control**. The note tells the branch how long it may keep its copy, like one day, before it has to ask again.',
      body: [
        'The origin tells every cache what to do with the `Cache-Control` response header. `public, max-age=86400` means any cache may keep it for a day. `s-maxage` sets a separate TTL for shared caches such as the CDN.',
        '`private` means only the user\'s own browser may store it. `no-store` means nobody stores it. `stale-while-revalidate=30` lets the edge serve a slightly old copy while it refreshes in the background.',
        'The edge reports what it did in headers such as `x-cache: HIT` and `age`. Check them with `curl -I` before you trust any CDN setup.',
      ],
      keyIdea: 'The origin controls edge caching through response headers. Get them wrong and the CDN either caches nothing or caches the wrong thing.',
      metrics: { rtt: '10 ms', load: '350 ms', hit: '-', egress: '16 Gbps' },
      scene: {
        zones,
        nodes: [syd, ber, { ...edgeSyd, status: 'active', badge: 'keep 1 day' }, edgeFra, { ...origin, status: 'active', badge: 'Cache-Control' }],
        links: edgeLinks,
        flows: [
          { path: ['edge-syd', 'origin'], tone: 'request', label: 'GET p42.jpg', duration: 2 },
          { path: ['origin', 'edge-syd'], tone: 'response', label: 'max-age=86400', duration: 2, delay: 2.1 },
        ],
        caption: 'The origin sets the TTL, the edge obeys',
      },
      code: {
        language: 'bash',
        title: 'Read what the CDN did',
        source: `$ curl -sI https://shop.example/img/p42.jpg
HTTP/2 200
cache-control: public, max-age=86400, s-maxage=604800
etag: "a1b2c3"
age: 3121
x-cache: HIT from edge-syd

$ curl -sI https://shop.example/cart
cache-control: private, no-store
x-cache: MISS (bypass)`,
        highlight: [3, 5, 6, 9],
      },
    },
    {
      title: 'Offload',
      tag: 'concept',
      heading: 'The origin only sees the misses',
      eli5: 'Out of every 100 kids, 95 get their book at a branch. That share is the **hit rate**, and it means the big library far away only has to help the other 5.',
      body: [
        'Static files are most of the bytes, and they are the same for every user. With a 95% edge hit rate, the origin serves only 5% of them.',
        'Origin egress drops from 16 Gbps to about **0.8 Gbps**. Fewer origin servers, smaller bandwidth bills, and when the origin has a bad minute, the edges keep serving cached pages.',
        'This is why media-heavy apps cannot run without a CDN. At 350,000 image requests per second and 2 MB each, the origin would need thousands of 10 Gbps ports.',
      ],
      keyIdea: 'Edge hit rate sets origin bandwidth. A 95% hit rate means the origin does 5% of the work.',
      metrics: { rtt: '10 ms', load: '350 ms', hit: '95%', egress: '0.8 Gbps' },
      scene: {
        zones,
        nodes: [syd, ber, { ...edgeSyd, status: 'ok', badge: '95% HIT' }, { ...edgeFra, status: 'ok', badge: '95% HIT' }, { ...origin, status: 'ok', badge: '0.8 Gbps' }],
        links: edgeLinks,
        flows: [
          { path: ['syd', 'edge-syd', 'syd'], tone: 'response', count: 4, duration: 1.2 },
          { path: ['ber', 'edge-fra', 'ber'], tone: 'response', count: 4, duration: 1.2, delay: 0.3 },
          { path: ['edge-syd', 'origin'], tone: 'request', label: 'misses only', duration: 2.2, delay: 1 },
        ],
        caption: 'Most requests end at the edge',
      },
      quiz: {
        question: 'Your origin pushes 16 Gbps of static files. You put a CDN in front with a 95% hit rate. Roughly what does the origin push now?',
        options: ['15.2 Gbps', '8 Gbps', '0.8 Gbps', '0 Gbps'],
        answer: 2,
        explain: 'The origin serves only the misses: 5% of 16 Gbps is 0.8 Gbps.',
      },
    },
    {
      title: 'Stale bundle',
      tag: 'case',
      heading: 'Case: the fix shipped, users still see the bug',
      eli5: 'The big library fixed a mistake in a book, but the Sydney branch still hands out the old copy. A **purge** is a message telling every branch to throw the old copy away, and it takes a while to reach them all.',
      body: [
        'A checkout bug lives in `/static/app.js`. The team deploys a fix at 10:00. At 14:00, Sydney users still hit the bug, because `app.js` was cached for 24 hours at the edge and in their browsers.',
        'The team calls the CDN **purge** API. The purge reaches hundreds of PoPs within seconds to minutes, so some users get the old file for a while. And a purge cannot reach files already sitting in browser caches.',
        'Edge caching is eventually consistent by design. A file name that keeps pointing at changing content will always be stale somewhere.',
      ],
      keyIdea: 'Purging is slow, partial and cannot touch browser caches. Do not rely on it for routine releases.',
      metrics: { rtt: '10 ms', load: '350 ms', hit: '95%', egress: '0.8 Gbps' },
      scene: {
        zones,
        nodes: [
          { ...syd, badge: 'old app.js' },
          ber,
          { ...edgeSyd, status: 'hot', badge: 'app.js · 20 h left' },
          { ...edgeFra, badge: 'purged' },
          { ...origin, status: 'active', badge: 'app.js (fixed)' },
        ],
        links: edgeLinks,
        flows: [
          { path: ['origin', 'edge-fra'], tone: 'event', label: 'PURGE app.js', duration: 1.6 },
          { path: ['origin', 'edge-syd'], tone: 'event', label: 'PURGE app.js', duration: 2.8 },
          { path: ['syd', 'edge-syd', 'syd'], tone: 'error', label: 'stale app.js', duration: 1.4, delay: 0.4 },
        ],
        caption: 'The purge is still on its way',
      },
    },
    {
      title: 'Versioned URLs',
      tag: 'concept',
      heading: 'Give every version a new name',
      eli5: 'Give the fixed book a new title. That is a **versioned URL**: no branch has an old copy under the new title, so every kid who asks for it gets the fixed book.',
      body: [
        'The standard fix is **versioned URLs**. The build tool puts a hash of the file\'s content in its name: `app.3f9a1c.js`. New content gets a new name, so no cache ever holds a stale copy under the new URL.',
        'Hashed files are cached for a year with `immutable`. The HTML page that references them gets a short TTL, say 60 seconds at the edge. A release goes live everywhere within a minute and nothing needs purging.',
      ],
      keyIdea: 'Cache files with hashed names forever, keep HTML short-lived, and releases never wait on a purge.',
      metrics: { rtt: '10 ms', load: '350 ms', hit: '97%', egress: '0.5 Gbps' },
      scene: {
        zones,
        nodes: [{ ...syd, status: 'ok', badge: 'app.8d21e4.js' }, ber, { ...edgeSyd, status: 'active', badge: 'new name, MISS once' }, edgeFra, { ...origin, badge: 'release 214' }],
        links: edgeLinks,
        flows: [
          { path: ['syd', 'edge-syd'], tone: 'request', label: 'GET /', duration: 0.8 },
          { path: ['edge-syd', 'syd'], tone: 'response', label: 'html → app.8d21e4.js', duration: 0.8, delay: 0.9 },
          { path: ['syd', 'edge-syd', 'origin'], tone: 'request', label: 'app.8d21e4.js', duration: 2.4, delay: 1.8 },
          { path: ['origin', 'edge-syd', 'syd'], tone: 'response', duration: 2.4, delay: 4.3 },
        ],
        caption: 'A new name is a guaranteed miss, then a year of hits',
      },
      code: {
        language: 'bash',
        title: 'nginx at the origin: TTL by file type',
        source: `# Hashed assets: the content under this name never changes
location ~* "\\.[0-9a-f]{6,}\\.(js|css|woff2|jpg|png)$" {
    add_header Cache-Control "public, max-age=31536000, immutable";
}

# HTML: short edge TTL so new releases appear within a minute
location / {
    add_header Cache-Control "public, max-age=0, s-maxage=60, stale-while-revalidate=30";
    proxy_pass http://shop_app;
}`,
        highlight: [2, 3, 8],
      },
    },
    {
      title: 'Not cacheable',
      tag: 'tradeoff',
      heading: 'What the edge should never cache',
      eli5: 'A branch may keep copies of storybooks that are the same for everyone. Your own diary is **private**, so the branch never keeps a copy and always fetches it straight from the big library for you.',
      body: [
        'Anything personal stays out of shared caches: carts, account pages, order history, any response that sets a cookie. One wrong `public` header and the edge serves one user\'s cart to the next person in Sydney.',
        'Writes such as `POST /checkout` always go through to the origin. The CDN still helps here, because the TLS handshake ends nearby and the edge keeps warm connections to origin. For private files such as invoices, use short-lived **signed URLs** that the edge checks before serving.',
        'Content that is shared but changes often, such as stock counts or a news front page, can be cached for a few seconds. Even a 5-second TTL turns 10,000 requests per second into one origin request per PoP every 5 seconds.',
      ],
      keyIdea: 'Cache what is the same for everyone. Personal and write traffic passes through, and still gains from the nearby TLS handshake.',
      metrics: { rtt: '10 ms', load: '350 ms', hit: '95%', egress: '0.8 Gbps' },
      scene: {
        zones,
        nodes: [syd, ber, { ...edgeSyd, status: 'active', badge: 'bypass: private' }, edgeFra, { ...origin, status: 'active', badge: 'cart for user 42' }],
        links: edgeLinks,
        flows: [
          { path: ['syd', 'edge-syd', 'origin'], tone: 'request', label: 'GET /cart', duration: 2.4 },
          { path: ['origin', 'edge-syd', 'syd'], tone: 'response', label: 'private, no-store', duration: 2.4, delay: 2.5 },
          { path: ['ber', 'edge-fra', 'ber'], tone: 'response', label: 'logo.png HIT', duration: 1.2, delay: 0.6 },
        ],
        caption: 'Personal responses pass straight through',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Bring the bytes to the users',
      eli5: 'A **CDN** keeps copies of the shared books in branch libraries near every kid, gives changed books new titles, and never keeps a copy of anyone\'s diary.',
      body: [
        'A CDN puts caches in PoPs near users. Hits cost one short local round trip. Misses go to origin once per TTL, and an origin shield collapses those into one fetch. Sydney page load fell from 1.9 s to 350 ms and origin egress from 16 Gbps to under 1 Gbps.',
        '`Cache-Control` decides what the edge keeps. Use hashed file names with long TTLs, keep HTML short-lived, and avoid purges for routine releases. Never cache personal responses in a shared cache.',
      ],
      keyIdea: 'Cache shared content at the edge with versioned names, and let personal and write traffic pass through.',
      metrics: { rtt: '10 ms', load: '350 ms', hit: '97%', egress: '0.5 Gbps' },
      scene: {
        zones,
        nodes: [syd, ber, { ...edgeSyd, status: 'ok' }, { ...edgeFra, status: 'ok' }, origin],
        links: edgeLinks,
        flows: [
          { path: ['syd', 'edge-syd', 'syd'], tone: 'response', count: 3, duration: 1.2 },
          { path: ['ber', 'edge-fra', 'ber'], tone: 'response', count: 3, duration: 1.2, delay: 0.4 },
          { path: ['edge-fra', 'origin'], tone: 'request', label: 'miss', duration: 1.6, delay: 1.4 },
        ],
      },
      quiz: {
        question: 'You release a new app.js every day. What is the most reliable way to make sure users get the new version quickly?',
        options: [
          'Set max-age=0 on app.js so it is never cached',
          'Purge app.js from the CDN after every deploy',
          'Put a content hash in the file name, cache it for a year, and give the HTML a short TTL',
          'Ask users to clear their browser cache',
        ],
        answer: 2,
        explain: 'A new hash means a new URL, so no cache can serve an old copy under it. The short-lived HTML points users at the new name within a minute, and the old file can stay cached forever without harm.',
      },
    },
  ],
};
