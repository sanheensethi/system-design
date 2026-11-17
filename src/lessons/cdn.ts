import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, ...extra });

const syd: SceneNode = { id: 'syd', kind: 'user', at: at(-5, 0), label: 'Sydney users' };
const ber: SceneNode = { id: 'ber', kind: 'user', at: at(-6.4, -8.5), label: 'Berlin users' };
const edge: SceneNode = { id: 'edge', kind: 'cdn', at: at(-1.7, 0), label: 'edge SYD', sub: '10 ms away' };
const edgeFra: SceneNode = { id: 'edge-fra', kind: 'cdn', at: at(-1.2, -8.5), label: 'edge FRA', sub: '15 ms away' };
const shield: SceneNode = { id: 'shield', kind: 'block', at: at(1.7, 0), label: 'origin shield', sub: 'mid-tier cache', icon: 'Layers', tint: 'teal' };
const origin: SceneNode = { id: 'origin', kind: 'server', at: at(5, 0), label: 'origin', sub: 'Virginia' };

export const cdn: Lesson = {
  id: 'cdn',
  title: 'Content delivery networks (part 1)',
  tagline: 'Cache responses at edges around the world so far-away users stop paying for distance.',
  minutes: 14,
  level: 'Beginner',
  learn: [
    'Why distance sets a latency floor that code cannot fix',
    'How edge PoPs are found, and how hits, misses and an origin shield work',
    'Pull versus push, and how request collapsing protects the origin',
    'Cache-Control headers, cache keys and Vary',
    'Purging versus versioned URLs for updates',
  ],
  metrics: [
    { key: 'rtt', label: 'Sydney RTT', icon: 'Signal' },
    { key: 'load', label: 'Sydney page load', icon: 'Timer' },
    { key: 'hit', label: 'Edge hit rate', icon: 'Gauge' },
    { key: 'egress', label: 'Origin egress', icon: 'Download' },
  ],
  steps: [
    {
      title: 'Far away',
      tag: 'problem',
      heading: 'One origin, users on every continent',
      eli5: 'There is only one library, far away in Virginia. That one library is the **origin**. Kids in Sydney and Berlin wait a long time for every book.',
      body: [
        'The shop runs in one region, Virginia. Sydney is about **200 ms** away per round trip, Berlin about 90 ms. Light in fiber does not go faster, so no code change can remove that.',
        'A product page pulls 40 files: scripts, fonts and 200 KB product images. Even with connection reuse, a Sydney visitor waits about **1.9 seconds**.',
      ],
      keyIdea: 'Distance adds latency to every round trip, and no amount of code can shorten it.',
      metrics: { rtt: '200 ms', load: '1.9 s', hit: '-', egress: '16 Gbps' },
      metricTones: { rtt: 'bad', load: 'bad' },
      scene: {
        nodes: [syd, ber, { ...origin, chips: ['GET p42.jpg'] }],
        links: [
          link('syd', 'origin', { style: 'dashed', label: '~16,000 km · 200 ms', labelTone: 'warn' }),
          link('ber', 'origin', { style: 'dashed', label: '90 ms', labelTone: 'warn' }),
        ],
        flows: [
          { path: ['syd', 'origin'], tone: 'request', label: 'GET p42.jpg', duration: 2.6 },
          { path: ['origin', 'syd'], tone: 'response', duration: 2.6, delay: 2.7 },
          { path: ['ber', 'origin'], tone: 'request', duration: 1.6, delay: 0.5 },
          { path: ['origin', 'ber'], tone: 'response', duration: 1.6, delay: 2.2 },
        ],
        panel: {
          title: 'Why Sydney waits',
          icon: 'Timer',
          rows: [
            { text: 'Sydney round trip', value: '200 ms', tone: 'bad' },
            { text: 'Berlin round trip', value: '90 ms', tone: 'warn' },
            { text: 'Files per product page', value: '40' },
            { text: 'Sydney page load', value: '1.9 s', tone: 'bad' },
          ],
        },
        caption: 'Every byte crosses an ocean',
      },
    },
    {
      title: 'Handshakes',
      tag: 'problem',
      heading: 'Saying hello costs round trips too',
      eli5: 'Before a kid can even ask for a book, they must knock, say who they are and show their library card. Each of those takes a trip across the ocean to the one library.',
      body: [
        'Before a browser sends one request, it does a **TCP handshake** (one round trip) and a **TLS handshake** (one to two more). At 200 ms each, Sydney spends 400 to 600 ms just connecting.',
        'New connections are common. Each tab, each new domain and each returning visitor after a timeout starts again.',
      ],
      keyIdea: 'Connection setup is paid in round trips, so on a long path it costs more than the data itself.',
      metrics: { rtt: '200 ms', load: '1.9 s', hit: '-', egress: '16 Gbps' },
      metricTones: { rtt: 'bad' },
      scene: {
        nodes: [syd, origin],
        links: [link('syd', 'origin', { style: 'dashed', label: '200 ms per round trip', labelTone: 'warn', arrow: 'both' })],
        flows: [
          { path: ['syd', 'origin'], tone: 'handshake', label: 'TCP SYN', duration: 1.8 },
          { path: ['origin', 'syd'], tone: 'handshake', label: 'SYN-ACK', duration: 1.8, delay: 1.9 },
          { path: ['syd', 'origin'], tone: 'handshake', label: 'TLS hello', duration: 1.8, delay: 3.8 },
          { path: ['origin', 'syd'], tone: 'handshake', label: 'cert + keys', duration: 1.8, delay: 5.7 },
        ],
        panel: {
          title: 'Round trips before the first byte',
          icon: 'Repeat',
          rows: [
            { text: 'TCP handshake', value: '1 × 200 ms' },
            { text: 'TLS handshake', value: '1 to 2 × 200 ms' },
            { text: 'First request', value: '1 × 200 ms' },
          ],
          footer: { text: '600 to 800 ms before content arrives', tone: 'bad' },
        },
        caption: 'Hello alone costs hundreds of milliseconds',
      },
    },
    {
      title: 'Origin bandwidth',
      tag: 'problem',
      heading: 'The origin also pays in bandwidth',
      eli5: 'Every kid in the world wants a copy from the same library, and the one front door is too narrow to hand out that many books at once.',
      body: [
        'At 10,000 requests per second with an average file of 200 KB, the origin pushes **16 Gbps**. Its network cards carry 10 Gbps each, so one server cannot keep up.',
        'Adding origin servers helps only until the bandwidth bill and server count grow without end. Most of those bytes are the same files, sent again and again.',
      ],
      keyIdea: 'Serving every byte from one place saturates the origin\'s network with copies of the same files.',
      metrics: { rtt: '200 ms', load: '1.9 s', hit: '-', egress: '16 Gbps' },
      metricTones: { egress: 'bad' },
      scene: {
        nodes: [syd, ber, { ...origin, status: 'hot', load: 100, badge: '16 Gbps out', chips: [{ text: '10,000 req/s', tone: 'warn' }] }],
        links: [link('syd', 'origin', { style: 'dashed' }), link('ber', 'origin', { style: 'dashed' })],
        flows: [
          { path: ['origin', 'syd'], tone: 'response', count: 4, duration: 1.6 },
          { path: ['origin', 'ber'], tone: 'response', count: 4, duration: 1.4, delay: 0.3 },
        ],
        panel: {
          title: 'Origin bandwidth math',
          icon: 'Download',
          rows: [
            { text: 'Requests per second', value: '10,000' },
            { text: 'Average file', value: '200 KB' },
            { text: 'Needed bandwidth', value: '16 Gbps', tone: 'bad' },
            { text: 'One network card', value: '10 Gbps', tone: 'warn' },
          ],
          footer: { text: '10,000 × 200 KB = 2 GB/s = 16 Gbps', tone: 'muted' },
        },
        caption: 'The same files, sent over and over',
      },
    },
    {
      title: 'Edge PoPs',
      tag: 'concept',
      heading: 'Put caches near the users',
      eli5: 'A **CDN** builds little branch libraries in lots of towns. Now a Sydney kid walks to the branch down the street, and no request has to cross the ocean just to say hello.',
      body: [
        'A **CDN** (content delivery network) runs hundreds of **points of presence** (PoPs), small clusters of cache servers in cities around the world. Cloudflare, Akamai, CloudFront and Fastly all work this way.',
        'You point `shop.example` at the CDN. The CDN sits between users and your **origin**, the server that holds the real files.',
      ],
      keyIdea: 'A CDN moves the first hop from across the planet to across town.',
      metrics: { rtt: '10 ms', load: '1.9 s', hit: '-', egress: '16 Gbps' },
      metricTones: { rtt: 'good' },
      scene: {
        nodes: [syd, { ...edge, status: 'active', chips: ['shop.example'] }, origin],
        links: [
          link('syd', 'edge', { label: '10 ms', labelTone: 'good' }),
          link('edge', 'origin', { style: 'dashed', label: '200 ms' }),
        ],
        flows: [
          { path: ['syd', 'edge'], tone: 'request', label: 'GET /', duration: 0.8 },
          { path: ['edge', 'syd'], tone: 'response', duration: 0.8, delay: 0.9 },
        ],
        panel: {
          title: 'Well-known CDNs',
          icon: 'Globe',
          rows: [
            { text: 'Cloudflare', value: 'PoPs worldwide' },
            { text: 'Akamai', value: 'PoPs worldwide' },
            { text: 'CloudFront', value: 'PoPs worldwide' },
            { text: 'Fastly', value: 'PoPs worldwide' },
          ],
        },
        caption: 'A cache in Sydney, an hour of fiber closer',
      },
    },
    {
      title: 'Finding a PoP',
      tag: 'concept',
      heading: 'How each user reaches the nearest PoP',
      eli5: 'Every kid is given the address of the branch nearest to their own house. The **CDN** works out which branch that is before the kid even leaves home.',
      body: [
        '**DNS routing**: the CDN answers a lookup for `shop.example` with the IP of a PoP close to the resolver that asked. A Sydney resolver gets a Sydney address.',
        '**Anycast**: every PoP announces the same IP, and internet routing delivers each packet to the closest one. If a PoP goes down, traffic reroutes to the next nearest. Many CDNs combine both.',
      ],
      keyIdea: 'DNS or anycast steers each user to a nearby PoP, and the user never picks one.',
      metrics: { rtt: '10 ms', load: '1.9 s', hit: '-', egress: '16 Gbps' },
      metricTones: { rtt: 'good' },
      scene: {
        nodes: [syd, ber, { ...edge, status: 'active' }, { ...edgeFra, status: 'active' }],
        links: [link('syd', 'edge', { label: '10 ms', labelTone: 'good' }), link('ber', 'edge-fra', { label: '15 ms', labelTone: 'good' })],
        flows: [
          { path: ['syd', 'edge'], tone: 'handshake', label: 'shop.example', duration: 1 },
          { path: ['ber', 'edge-fra'], tone: 'handshake', label: 'shop.example', duration: 1, delay: 0.3 },
        ],
        panel: {
          title: 'One name, two answers',
          icon: 'Route',
          code: '# from a Sydney resolver\nshop.example  A  198.51.100.7\n\n# from a Berlin resolver\nshop.example  A  203.0.113.9',
          footer: { text: 'Anycast gives the same IP everywhere', tone: 'muted' },
        },
        caption: 'Same name, nearest PoP',
      },
    },
    {
      title: 'Local handshake',
      tag: 'concept',
      heading: 'Handshakes now end across town',
      eli5: 'The kid knocks, says who they are and shows their card to the branch librarian next door. All the hello steps take minutes, not a trip across the ocean.',
      body: [
        'The TCP and TLS handshakes now finish at the PoP, 10 ms away. Three round trips cost about **30 ms** instead of 600 ms, before any caching happens.',
        'The PoP also keeps warm, reused connections to the origin. Even a request that must travel to Virginia skips the setup cost on the long leg.',
      ],
      keyIdea: 'Even without a single cache hit, ending the handshake nearby saves hundreds of milliseconds.',
      metrics: { rtt: '10 ms', load: '1.9 s', hit: '-', egress: '16 Gbps' },
      metricTones: { rtt: 'good' },
      scene: {
        nodes: [syd, { ...edge, status: 'active', chips: [{ text: 'TLS ends here', tone: 'good' }] }, origin],
        links: [
          link('syd', 'edge', { label: '10 ms', labelTone: 'good', arrow: 'both' }),
          link('edge', 'origin', { style: 'dashed', label: 'warm connection' }),
        ],
        flows: [
          { path: ['syd', 'edge'], tone: 'handshake', label: 'TCP + TLS', duration: 0.7 },
          { path: ['edge', 'syd'], tone: 'handshake', duration: 0.7, delay: 0.8 },
        ],
        panel: {
          title: 'Connection setup',
          icon: 'Plug',
          rows: [
            { text: 'To origin directly', value: '400 to 600 ms', tone: 'bad' },
            { text: 'To the Sydney PoP', value: '~30 ms', tone: 'good' },
          ],
          footer: { text: 'Same handshakes, shorter road', tone: 'good' },
        },
        caption: 'Hello ends at the PoP',
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
      metricTones: { rtt: 'good', load: 'good' },
      scene: {
        nodes: [syd, { ...edge, status: 'ok', badge: 'HIT · age 3,121 s', chips: ['p42.jpg'] }, { ...origin, status: 'dim' }],
        links: [link('syd', 'edge', { label: '10 ms', labelTone: 'good' }), link('edge', 'origin', { style: 'dashed' })],
        flows: [
          { path: ['syd', 'edge'], tone: 'request', label: 'GET p42.jpg', duration: 0.8 },
          { path: ['edge', 'syd'], tone: 'response', label: '200 · HIT', duration: 0.8, delay: 0.9 },
        ],
        panel: {
          title: 'Hit versus no CDN',
          icon: 'Zap',
          rows: [
            { text: 'Image from origin', value: '200 ms', tone: 'bad' },
            { text: 'Image from the edge', value: '10 ms', tone: 'good' },
            { text: 'Origin requests', value: '0', tone: 'good' },
          ],
        },
        caption: 'Served from Sydney, origin untouched',
      },
    },
    {
      title: 'Edge miss',
      tag: 'concept',
      heading: 'A miss goes back to origin, once',
      eli5: 'The Sydney branch does not have a new book yet, so it orders one copy from the big library and keeps it. The next kid who asks gets it straight from the shelf.',
      body: [
        'A Sydney user asks for a product nobody there has viewed. The PoP misses, fetches the file from origin, stores it and serves it. That first user pays the full trip, about 210 ms.',
        'This is the **pull** pattern: the edge fetches a file only when asked for it. Every user after the first gets a hit until the copy expires.',
      ],
      keyIdea: 'Each PoP fetches a file from origin at most once per TTL. Everyone after the first user gets a hit.',
      metrics: { rtt: '10 ms', load: '350 ms', hit: '-', egress: '16 Gbps' },
      scene: {
        nodes: [syd, { ...edge, status: 'active', badge: 'MISS', chips: ['p77.jpg'] }, { ...origin, status: 'active' }],
        links: [link('syd', 'edge'), link('edge', 'origin', { style: 'dashed', label: '200 ms', labelTone: 'warn' })],
        flows: [
          { path: ['syd', 'edge'], tone: 'request', label: 'GET p77.jpg', duration: 0.8 },
          { path: ['edge', 'origin'], tone: 'request', label: 'miss', duration: 1.8, delay: 0.9 },
          { path: ['origin', 'edge'], tone: 'data', label: 'store copy', duration: 1.8, delay: 2.8 },
          { path: ['edge', 'syd'], tone: 'response', duration: 0.8, delay: 4.7 },
        ],
        panel: {
          title: 'Three users, one file',
          icon: 'Users',
          rows: [
            { text: 'User 1 (miss)', value: '~210 ms', tone: 'warn' },
            { text: 'User 2 (hit)', value: '10 ms', tone: 'good' },
            { text: 'User 3 (hit)', value: '10 ms', tone: 'good' },
          ],
          footer: { text: 'The origin saw one request, not three', tone: 'good' },
        },
        caption: 'The first request fills the cache',
      },
    },
    {
      title: 'Collapsing',
      tag: 'concept',
      heading: 'A thousand misses become one fetch',
      eli5: 'A thousand kids ask the branch for the same new book at the same minute. The librarian says "wait a moment", orders one copy, and hands it to everyone.',
      body: [
        'A new image goes viral and 1,000 users ask for it before the PoP has a copy. Without care, the PoP would send 1,000 requests to origin.',
        '**Request collapsing** (also called request coalescing) holds the extra requests, sends one fetch to origin, and answers all 1,000 from the reply. It protects the origin from a stampede on a cold file.',
      ],
      keyIdea: 'The edge sends one origin request per file and makes the other waiting users share the answer.',
      metrics: { rtt: '10 ms', load: '350 ms', hit: '-', egress: '16 Gbps' },
      scene: {
        nodes: [
          { ...syd, chips: [{ text: '1,000 × GET p88.jpg', tone: 'warn' }] },
          { ...edge, status: 'active', badge: '999 waiting' },
          { ...origin, status: 'ok', chips: ['1 × GET p88.jpg'] },
        ],
        links: [link('syd', 'edge'), link('edge', 'origin', { style: 'dashed' })],
        flows: [
          { path: ['syd', 'edge'], tone: 'request', count: 5, duration: 0.8 },
          { path: ['edge', 'origin'], tone: 'request', label: '1 fetch', duration: 1.8, delay: 1 },
          { path: ['origin', 'edge'], tone: 'data', duration: 1.8, delay: 2.9 },
          { path: ['edge', 'syd'], tone: 'response', count: 5, duration: 0.8, delay: 4.8 },
        ],
        panel: {
          title: 'Cold file, 1,000 requests',
          icon: 'Inbox',
          rows: [
            { text: 'Without collapsing', value: '1,000 origin fetches', tone: 'bad' },
            { text: 'With collapsing', value: '1 origin fetch', tone: 'good' },
          ],
        },
        caption: 'One fetch, a thousand answers',
      },
    },
    {
      title: 'Origin shield',
      tag: 'concept',
      heading: 'An origin shield collapses fetches across PoPs',
      eli5: 'Between the branches and the big library sits a **helper branch**. Every branch asks the helper first, and the helper already holds most books, so the big library hears from it only once.',
      body: [
        'A Berlin user asks for a product nobody in Europe has viewed. The Frankfurt PoP misses and asks the **origin shield**, a mid-tier cache near the origin that every PoP asks first. The shield already holds the file.',
        'With hundreds of PoPs, each missing once per file still adds up. With a shield, a file goes from origin to the shield once, then from the shield to each PoP.',
      ],
      keyIdea: 'An origin shield turns hundreds of per-PoP misses into one fetch from origin.',
      metrics: { rtt: '10 ms', load: '350 ms', hit: '-', egress: '16 Gbps' },
      scene: {
        nodes: [
          { ...edge, status: 'dim' },
          { ...edgeFra, status: 'active', badge: 'MISS' },
          { ...shield, status: 'ok', badge: 'HIT' },
          { ...origin, status: 'dim' },
        ],
        links: [
          link('edge', 'shield', { style: 'dashed' }),
          link('edge-fra', 'shield', { style: 'dashed', label: '90 ms' }),
          link('shield', 'origin'),
        ],
        flows: [
          { path: ['edge-fra', 'shield'], tone: 'request', label: 'GET p77.jpg', duration: 1.4 },
          { path: ['shield', 'edge-fra'], tone: 'data', label: 'store copy', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'Who calls the origin',
          icon: 'Layers',
          rows: [
            { text: 'Without shield', value: 'every PoP', tone: 'bad' },
            { text: 'With shield', value: 'the shield only', tone: 'good' },
          ],
          footer: { text: 'Cost: one extra hop on a first miss', tone: 'muted' },
        },
        caption: 'Miss at the edge, hit at the shield',
      },
    },
    {
      title: 'Pull or push',
      tag: 'tradeoff',
      heading: 'Pull fills on demand, push fills ahead of time',
      eli5: 'Either the branch orders a book only when a kid asks (**pull**), or the big library mails new books to every branch before opening day (**push**).',
      body: [
        '**Pull** is the default. You change nothing, and the first user per PoP pays the miss. It works well for large catalogs where most files are rarely asked for.',
        '**Push** means you upload files to the CDN yourself before anyone asks. It suits a known launch such as a game patch or a big sale, but you manage uploads, storage and cleanup.',
      ],
      keyIdea: 'Pull is zero effort and costs a few misses. Push removes the misses and adds work for you.',
      metrics: { rtt: '10 ms', load: '350 ms', hit: '-', egress: '16 Gbps' },
      scene: {
        nodes: [syd, { ...edge, status: 'active', chips: ['patch-9.zip'] }, { ...origin, chips: [{ text: 'upload before launch', tone: 'good' }] }],
        links: [link('syd', 'edge'), link('origin', 'edge', { style: 'dashed' })],
        flows: [
          { path: ['origin', 'edge'], tone: 'data', label: 'push patch-9.zip', duration: 2.2 },
          { path: ['syd', 'edge'], tone: 'request', label: 'GET patch-9.zip', duration: 0.8, delay: 2.4 },
          { path: ['edge', 'syd'], tone: 'response', label: 'HIT', duration: 0.8, delay: 3.3 },
        ],
        panel: {
          title: 'Pull versus push',
          icon: 'ArrowLeftRight',
          rows: [
            { text: 'Pull: first request', value: 'a miss', tone: 'warn' },
            { text: 'Pull: your work', value: 'none', tone: 'good' },
            { text: 'Push: first request', value: 'a hit', tone: 'good' },
            { text: 'Push: your work', value: 'upload + cleanup', tone: 'warn' },
          ],
        },
        caption: 'Push warms the cache before the crowd',
      },
    },
    {
      title: 'Cache-Control',
      tag: 'concept',
      heading: 'Headers decide what the edge keeps',
      eli5: 'Each book from the big library comes with a note called **Cache-Control**. The note tells the branch how long it may keep its copy, like one day, before it has to ask again.',
      body: [
        'The origin tells every cache what to do with the `Cache-Control` response header. `public, max-age=86400` means any cache may keep it for a day. `s-maxage` sets a separate TTL for shared caches such as the CDN.',
        '`private` means only the user\'s own browser may store it. `no-store` means nobody stores it at all. `no-cache` is different: a cache may store the file but must check with the origin before every reuse. `stale-while-revalidate=30` lets the edge serve a slightly old copy while it refreshes in the background.',
      ],
      keyIdea: 'The origin controls edge caching through response headers. Get them wrong and the CDN either caches nothing or caches the wrong thing.',
      metrics: { rtt: '10 ms', load: '350 ms', hit: '-', egress: '16 Gbps' },
      scene: {
        nodes: [syd, { ...edge, status: 'active', badge: 'keep 1 day' }, { ...origin, status: 'active', chips: ['Cache-Control'] }],
        links: [link('syd', 'edge'), link('edge', 'origin', { style: 'dashed' })],
        flows: [
          { path: ['edge', 'origin'], tone: 'request', label: 'GET p42.jpg', duration: 2 },
          { path: ['origin', 'edge'], tone: 'response', label: 'max-age=86400', duration: 2, delay: 2.1 },
        ],
        panel: {
          title: 'Cache-Control values',
          icon: 'Clock',
          rows: [
            { text: 'public, max-age=86400', value: 'any cache, 1 day' },
            { text: 's-maxage=604800', value: 'CDN only, 7 days' },
            { text: 'private', value: 'browser only', tone: 'warn' },
            { text: 'no-store', value: 'nobody stores it', tone: 'bad' },
            { text: 'no-cache', value: 'store, but revalidate first', tone: 'warn' },
            { text: 'stale-while-revalidate=30', value: 'serve old, refresh' },
          ],
        },
        caption: 'The origin sets the TTL, the edge obeys',
      },
    },
    {
      title: 'Revalidation',
      tag: 'concept',
      heading: 'An expired copy is checked, not refetched',
      eli5: 'When the note says the branch copy is too old, the librarian phones the big library and asks "is my edition still the latest?" If yes, the answer is one word and the copy stays on the shelf.',
      body: [
        'When a cached copy expires, the edge does not have to download the file again. It sends a **conditional request** with `If-None-Match: "a1b2c3"`, the `etag` it stored. The origin compares tags.',
        'If the file is unchanged, the origin replies `304 Not Modified` with no body, and the edge keeps its copy with a fresh TTL. A changed file returns a full `200`. This is also what `no-cache` triggers on every reuse.',
      ],
      keyIdea: 'Revalidation turns an expired copy into a tiny 304 check instead of a full download.',
      metrics: { rtt: '10 ms', load: '350 ms', hit: '-', egress: '16 Gbps' },
      scene: {
        nodes: [syd, { ...edge, status: 'active', badge: 'expired, checking', chips: ['etag a1b2c3'] }, { ...origin, status: 'active' }],
        links: [link('syd', 'edge'), link('edge', 'origin', { style: 'dashed', label: '200 ms', labelTone: 'warn' })],
        flows: [
          { path: ['edge', 'origin'], tone: 'request', label: 'If-None-Match: a1b2c3', duration: 2 },
          { path: ['origin', 'edge'], tone: 'response', label: '304 Not Modified', duration: 2, delay: 2.1 },
          { path: ['edge', 'syd'], tone: 'response', label: '200 · from cache', duration: 0.8, delay: 4.2 },
        ],
        panel: {
          title: 'Expired copy, two outcomes',
          icon: 'Repeat',
          rows: [
            { text: 'Unchanged', value: '304, no body', tone: 'good' },
            { text: 'Changed', value: '200, full file', tone: 'warn' },
          ],
          footer: { text: 'The edge sends the etag, the origin compares', tone: 'muted' },
        },
        caption: 'A 304 renews the copy without the bytes',
      },
    },
    {
      title: 'Read the headers',
      tag: 'concept',
      heading: 'Ask the edge what it did',
      eli5: 'You can ask the branch librarian two questions: "did you give me your own copy?" and "how old is it?" The answers are written on a little slip.',
      body: [
        'The edge reports what it did in response headers such as `x-cache: HIT` and `age`. `age: 3121` means the copy has sat in the cache for 3,121 seconds.',
        'Check them with `curl -I` before you trust any CDN setup. Header names vary by provider, but every CDN shows hit or miss somewhere.',
      ],
      keyIdea: 'Check x-cache and age with curl -I. Guessing at the cache state wastes hours.',
      metrics: { rtt: '10 ms', load: '350 ms', hit: '-', egress: '16 Gbps' },
      scene: {
        nodes: [syd, { ...edge, status: 'ok', badge: 'x-cache: HIT' }, { ...origin, status: 'dim' }],
        links: [link('syd', 'edge'), link('edge', 'origin', { style: 'dashed' })],
        flows: [
          { path: ['syd', 'edge'], tone: 'request', label: 'curl -I', duration: 0.8 },
          { path: ['edge', 'syd'], tone: 'response', label: 'headers', duration: 0.8, delay: 0.9 },
        ],
        panel: {
          title: 'Headers to check',
          icon: 'FileText',
          rows: [
            { text: 'x-cache', value: 'HIT or MISS' },
            { text: 'age', value: 'seconds in cache' },
            { text: 'cache-control', value: 'TTL rules' },
            { text: 'etag', value: 'version tag' },
          ],
        },
        caption: 'The edge tells you what it did',
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
      title: 'Cache key',
      tag: 'concept',
      heading: 'The cache key decides what counts as the same file',
      eli5: 'The branch finds a book by its title on the label. If the same book has three slightly different labels, the branch stores three copies and the shelf fills up with duplicates.',
      body: [
        'The edge looks up a copy by its **cache key**, by default the host, path and query string. `p42.jpg?utm=a` and `p42.jpg?utm=b` are two entries, so one file is stored and fetched twice. Strip tracking parameters from the key.',
        '`Vary: Accept-Encoding` adds that header to the key, giving gzip and brotli separate copies. That is fine. `Vary: Cookie` or `Vary: User-Agent` splits the cache into thousands of entries and destroys the hit rate.',
      ],
      keyIdea: 'Every extra thing in the cache key splits the cache. Keep the key to what actually changes the response.',
      metrics: { rtt: '10 ms', load: '350 ms', hit: '-', egress: '16 Gbps' },
      scene: {
        nodes: [
          syd,
          { ...edge, status: 'hot', badge: '3 copies of 1 file', chips: [{ text: 'p42.jpg?utm=a', tone: 'warn' }, { text: 'p42.jpg?utm=b', tone: 'warn' }, { text: 'p42.jpg?utm=c', tone: 'warn' }] },
          { ...origin, status: 'dim' },
        ],
        links: [link('syd', 'edge'), link('edge', 'origin', { style: 'dashed' })],
        flows: [
          { path: ['syd', 'edge'], tone: 'request', label: '?utm=c', duration: 0.8 },
          { path: ['edge', 'origin'], tone: 'request', label: 'miss', duration: 1.8, delay: 0.9 },
        ],
        panel: {
          title: 'What goes in the key',
          icon: 'Key',
          rows: [
            { text: 'host + path', value: 'always' },
            { text: 'query string', value: 'strip utm_*', tone: 'warn' },
            { text: 'Accept-Encoding', value: 'gzip, br copies' },
            { text: 'Vary: Cookie', value: 'one copy per user', tone: 'bad' },
          ],
        },
        caption: 'Same file, three keys',
      },
    },
    {
      title: 'Offload',
      tag: 'concept',
      heading: 'The origin only sees the misses',
      eli5: 'Out of every 100 kids, 95 get their book at a branch. That share is the **hit rate**, and it means the big library far away only has to help the other 5.',
      body: [
        'Static files are most of the bytes, and they are the same for every user. With a 95% edge hit rate, the origin serves only 5% of them. Origin egress drops from 16 Gbps to about **0.8 Gbps**.',
        'This is why media-heavy apps cannot run without a CDN. At 350,000 image requests per second and 2 MB each, the origin would need to push 700 GB/s, about 5.6 Tbps. That is roughly 560 ports of 10 Gbps.',
      ],
      keyIdea: 'Edge hit rate sets origin bandwidth. A 95% hit rate means the origin does 5% of the work.',
      metrics: { rtt: '10 ms', load: '350 ms', hit: '95%', egress: '0.8 Gbps' },
      metricTones: { rtt: 'good', load: 'good', hit: 'good', egress: 'good' },
      scene: {
        nodes: [syd, { ...edge, status: 'ok', badge: '95% HIT' }, { ...origin, status: 'ok', badge: '0.8 Gbps', load: 8 }],
        links: [link('syd', 'edge'), link('edge', 'origin', { style: 'dashed', label: 'misses only' })],
        flows: [
          { path: ['syd', 'edge', 'syd'], tone: 'response', count: 4, duration: 1.2 },
          { path: ['edge', 'origin'], tone: 'request', label: 'misses only', duration: 2.2, delay: 1 },
        ],
        panel: {
          title: 'Origin egress by hit rate',
          icon: 'Gauge',
          rows: [
            { text: '0% hit rate', value: '16 Gbps', tone: 'bad' },
            { text: '90% hit rate', value: '1.6 Gbps', tone: 'warn' },
            { text: '95% hit rate', value: '0.8 Gbps', tone: 'good' },
            { text: '99% hit rate', value: '0.16 Gbps', tone: 'good' },
          ],
        },
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
      eli5: 'The big library fixed a mistake in a book, but the Sydney branch still hands out the old copy. It will keep doing so until its note says to ask again.',
      body: [
        'A checkout bug lives in `/static/app.js`. The team deploys a fix at 10:00. At 14:00, Sydney users still hit the bug, because `app.js` was cached for 24 hours at the edge.',
        'Browsers keep their own copy too, so even a fresh edge cannot help the users who already downloaded the old file.',
      ],
      keyIdea: 'A cached file keeps its old content until the TTL ends or someone removes it, at the edge and in browsers.',
      metrics: { rtt: '10 ms', load: '350 ms', hit: '95%', egress: '0.8 Gbps' },
      metricTones: { hit: 'good' },
      scene: {
        nodes: [
          { ...syd, status: 'hot', badge: 'old app.js' },
          { ...edge, status: 'hot', badge: 'app.js · 20 h left' },
          { ...origin, status: 'active', badge: 'app.js (fixed)' },
        ],
        links: [link('syd', 'edge'), link('edge', 'origin', { style: 'dashed' })],
        flows: [{ path: ['syd', 'edge', 'syd'], tone: 'error', label: 'stale app.js', duration: 1.6 }],
        panel: {
          title: 'The timeline',
          icon: 'Clock',
          rows: [
            { text: '10:00', value: 'fix deployed' },
            { text: '14:00', value: 'Sydney still sees the bug', tone: 'bad' },
            { text: 'Edge TTL left', value: '20 hours', tone: 'warn' },
          ],
        },
        caption: 'The edge keeps what the origin already replaced',
      },
    },
    {
      title: 'Purging',
      tag: 'concept',
      heading: 'Purge: fast to ask, slow to finish',
      eli5: 'A **purge** is a message telling every branch to throw the old copy away. The message takes a while to reach all branches, and it cannot reach the copies kids already took home.',
      body: [
        'The team calls the CDN **purge** API. It reaches hundreds of PoPs within seconds to minutes, so some users get the old file for a while. It cannot touch copies in browser caches.',
        'Most CDNs purge by URL or by **tag**, a label the origin attaches such as `product-42`. One call clears every page that shows that product. Edge caching is eventually consistent by design.',
      ],
      keyIdea: 'Purging is slow, partial and cannot touch browser caches. Do not rely on it for routine releases.',
      metrics: { rtt: '10 ms', load: '350 ms', hit: '95%', egress: '0.8 Gbps' },
      scene: {
        nodes: [{ ...syd, badge: 'old app.js' }, { ...edge, status: 'hot', badge: 'old copy' }, { ...edgeFra, badge: 'purged', status: 'ok' }, { ...origin, status: 'active' }],
        links: [link('syd', 'edge'), link('edge', 'origin', { style: 'dashed' }), link('edge-fra', 'origin', { style: 'dashed' })],
        flows: [
          { path: ['origin', 'edge-fra'], tone: 'event', label: 'PURGE app.js', duration: 1.6 },
          { path: ['origin', 'edge'], tone: 'event', label: 'PURGE app.js', duration: 2.8 },
        ],
        panel: {
          title: 'Purge options',
          icon: 'Zap',
          rows: [
            { text: 'By URL', value: 'one file' },
            { text: 'By tag', value: 'every page with the tag' },
            { text: 'Propagation', value: 'seconds to minutes', tone: 'warn' },
            { text: 'Browser caches', value: 'untouched', tone: 'bad' },
          ],
        },
        caption: 'The purge is still on its way',
      },
    },
    {
      title: 'Versioned URLs',
      tag: 'concept',
      heading: 'Give every version a new name',
      eli5: 'Give the fixed book a new title. That is a **versioned URL**: no branch has an old copy under the new title, so every kid who asks for it gets the fixed book.',
      body: [
        'The build tool puts a hash of the file\'s content in its name: `app.3f9a1c.js`. New content gets a new name, so no cache ever holds a stale copy under the new URL.',
        'Hashed files are cached for a year with `immutable`. The HTML page that references them gets a short TTL, say 60 seconds at the edge. A release goes live everywhere within a minute and nothing needs purging.',
      ],
      keyIdea: 'Cache files with hashed names forever, keep HTML short-lived, and releases never wait on a purge.',
      metrics: { rtt: '10 ms', load: '350 ms', hit: '97%', egress: '0.5 Gbps' },
      metricTones: { hit: 'good', egress: 'good' },
      scene: {
        nodes: [{ ...syd, status: 'ok', badge: 'app.8d21e4.js' }, { ...edge, status: 'active', badge: 'new name, MISS once' }, { ...origin, chips: ['release 214'] }],
        links: [link('syd', 'edge'), link('edge', 'origin', { style: 'dashed' })],
        flows: [
          { path: ['syd', 'edge'], tone: 'request', label: 'GET /', duration: 0.8 },
          { path: ['edge', 'syd'], tone: 'response', label: 'html → app.8d21e4.js', duration: 0.8, delay: 0.9 },
          { path: ['syd', 'edge', 'origin'], tone: 'request', label: 'app.8d21e4.js', duration: 2.4, delay: 1.8 },
          { path: ['origin', 'edge', 'syd'], tone: 'response', duration: 2.4, delay: 4.3 },
        ],
        panel: {
          title: 'TTL by file type',
          icon: 'Hash',
          rows: [
            { text: 'app.8d21e4.js', value: '1 year, immutable', tone: 'good' },
            { text: 'index.html', value: '60 s at the edge', tone: 'warn' },
          ],
          footer: { text: 'A new name is a guaranteed miss, then a year of hits', tone: 'muted' },
        },
        caption: 'A new name is a guaranteed miss, then a year of hits',
      },
      code: {
        language: 'bash',
        title: 'nginx at the origin: TTL by file type',
        source: `# Hashed assets: the content under this name never changes
location ~* "\\.[0-9a-f]{6,}\\.(js|css|woff2|jpg|png)$" {
    add_header Cache-Control "public, max-age=31536000, immutable";
    proxy_pass http://shop_app;
}

# HTML: short edge TTL so new releases appear within a minute
location / {
    add_header Cache-Control "public, max-age=0, s-maxage=60, stale-while-revalidate=30";
    proxy_pass http://shop_app;
}`,
        highlight: [2, 3, 4, 9],
      },
    },
    {
      title: 'Recap, part 1',
      tag: 'recap',
      heading: 'Bring the bytes to the users',
      eli5: 'A **CDN** keeps copies of the shared books in branch libraries near every kid, and gives changed books new titles. Part 2 covers diaries, lost branches and the bills.',
      body: [
        'A CDN puts caches in PoPs near users. Hits cost one short local round trip. Misses go to origin once per TTL, and an origin shield collapses those into one fetch. Sydney page load fell from 1.9 s to 350 ms and origin egress from 16 Gbps to under 1 Gbps.',
        '`Cache-Control` decides what the edge keeps. Use hashed file names with long TTLs, keep HTML short-lived, and avoid purges for routine releases. Part 2 covers private content, dynamic responses, failures, security and cost.',
      ],
      keyIdea: 'Cache shared content at the edge with versioned names, and avoid relying on purges.',
      metrics: { rtt: '10 ms', load: '350 ms', hit: '97%', egress: '0.5 Gbps' },
      metricTones: { rtt: 'good', load: 'good', hit: 'good', egress: 'good' },
      scene: {
        nodes: [syd, ber, { ...edge, status: 'ok' }, { ...edgeFra, status: 'ok' }, origin],
        links: [link('syd', 'edge'), link('ber', 'edge-fra'), link('edge', 'origin', { style: 'dashed' }), link('edge-fra', 'origin', { style: 'dashed' })],
        flows: [
          { path: ['syd', 'edge', 'syd'], tone: 'response', count: 3, duration: 1.2 },
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
