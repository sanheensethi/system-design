import type { Lesson, SceneNode, SceneZone } from '../engine/types';

/** Place a node by screen column (x - y) and screen row (x + y). */
const p = (col: number, row: number): [number, number] => [(col + row) / 2, (row - col) / 2];

const userUs: SceneNode = { id: 'userUs', kind: 'phone', at: p(-7, -3), label: 'user', sub: 'New York' };
const userEu: SceneNode = { id: 'userEu', kind: 'phone', at: p(7, -3), label: 'user', sub: 'Frankfurt' };
const dns: SceneNode = { id: 'dns', kind: 'dns', at: p(0, -6.5), label: 'GeoDNS', sub: 'shop.example.com' };
const anycast: SceneNode = { id: 'anycast', kind: 'internet', at: p(0, -6.5), label: 'anycast IP', sub: '203.0.113.10' };
const appUs: SceneNode = { id: 'appUs', kind: 'server', at: p(-5, 1.5), label: 'app US' };
const dbUs: SceneNode = { id: 'dbUs', kind: 'db', at: p(-2, 3), label: 'db US' };
const appEu: SceneNode = { id: 'appEu', kind: 'server', at: p(5, 1.5), label: 'app EU' };
const dbEu: SceneNode = { id: 'dbEu', kind: 'db', at: p(2, 3), label: 'db EU' };
const monitor: SceneNode = { id: 'monitor', kind: 'monitor', at: p(0, 0), label: 'monitor' };

const zoneUs: SceneZone = { id: 'us', from: [-2.8, 1.6], to: [1.4, 4.4], label: 'us-east', tone: 'blue' };
const zoneEu: SceneZone = { id: 'eu', from: [1.6, -2.8], to: [4.4, 1.4], label: 'eu-central', tone: 'violet' };

const regionLinks = [
  { from: 'appUs', to: 'dbUs' },
  { from: 'appEu', to: 'dbEu' },
];
const crossLink = { from: 'dbUs', to: 'dbEu', style: 'dashed' as const, label: '~90 ms' };

export const multiRegion: Lesson = {
  id: 'multi-region',
  title: 'Multi-region and geo routing',
  tagline: 'Run the system in more than one region, send each user to the nearest one, and survive losing a whole region.',
  minutes: 16,
  level: 'Advanced',
  learn: [
    'Why one region limits latency and availability',
    'Routing users with GeoDNS and with anycast',
    'Active-passive versus active-active regions',
    'Cross-region replication lag and what it costs',
    'Handling write conflicts between regions',
    'Evacuating a region, and why you must practice it',
  ],
  metrics: [
    { key: 'eu', label: 'Frankfurt page load' },
    { key: 'regions', label: 'Regions serving' },
    { key: 'lag', label: 'Cross-region lag' },
    { key: 'outage', label: 'If a region dies' },
  ],
  steps: [
    {
      title: 'Far away',
      tag: 'problem',
      heading: 'Every user talks to Virginia',
      eli5: 'A pizza chain has one kitchen, in New York. A customer in Frankfurt orders, and every pizza crosses the ocean. If that kitchen floods, nobody anywhere gets pizza. One **region** is one kitchen.',
      body: [
        'The shop runs in one cloud region on the US east coast. A user in New York gets each round trip in about 10 ms. A user in Frankfurt pays about **90 ms** per round trip, set by distance and the speed of light in fiber, and no server upgrade changes it.',
        'A page load needs several round trips: TCP and TLS setup, the HTML, then API calls. Six round trips cost 60 ms in New York and about **550 ms** in Frankfurt. Half the users get the slow version of the product.',
        'The region is also one failure domain. A regional power or network failure, or a bad config pushed to the whole region, takes the shop down for everyone, however many replicas run inside it.',
      ],
      keyIdea: 'One region puts a distance tax on far users and makes the region itself a single point of failure.',
      metrics: { eu: '550 ms', regions: '1', lag: '-', outage: 'total outage' },
      scene: {
        zones: [zoneUs],
        nodes: [userUs, { ...userEu, status: 'hot', badge: '90 ms per trip' }, { ...appUs, status: 'active' }, dbUs],
        links: [
          { from: 'userUs', to: 'appUs' },
          { from: 'userEu', to: 'appUs', style: 'dashed', label: 'across the Atlantic' },
          { from: 'appUs', to: 'dbUs' },
        ],
        flows: [
          { path: ['userUs', 'appUs'], tone: 'request', duration: 0.8 },
          { path: ['appUs', 'userUs'], tone: 'response', duration: 0.8, delay: 0.9 },
          { path: ['userEu', 'appUs'], tone: 'request', label: 'GET /cart', duration: 2.4 },
          { path: ['appUs', 'userEu'], tone: 'response', duration: 2.4, delay: 2.5 },
        ],
        caption: 'Same app, very different speed',
      },
    },
    {
      title: 'Why regions',
      tag: 'concept',
      heading: 'Three reasons to run in more than one region',
      eli5: 'The chain opens a second kitchen in Frankfurt. European pizzas arrive hot, and if one kitchen closes, the other still cooks. Each kitchen is a **region**.',
      body: [
        '**Latency**: serve users from a region near them, so the 90 ms trip becomes a 10 ms one. **Availability**: if a region fails, another one can take its traffic. Some products also have a third reason, **data residency**: laws or contracts that require certain users\' data to stay in a given country or bloc.',
        'A second region doubles more than the server bill. Data must be copied between regions and cross-region traffic is billed. Every deploy, migration and alert now happens twice. And the hard part is the data: two regions that both hold state must agree on it, across a link that is slow and sometimes broken.',
        'Stateless parts are easy to copy. The rest of this lesson is mostly about routing users and about the data.',
      ],
      keyIdea: 'Regions buy latency, availability and data residency. The price is copying state across a slow link and running everything twice.',
      metrics: { eu: '550 ms', regions: '1 (+1 being built)', lag: '-', outage: 'total outage' },
      scene: {
        zones: [zoneUs, zoneEu],
        nodes: [userUs, userEu, { ...appUs, status: 'active' }, dbUs, { ...appEu, status: 'dim', badge: 'new region' }, { ...dbEu, status: 'dim' }],
        links: [{ from: 'userUs', to: 'appUs' }, { from: 'userEu', to: 'appUs', style: 'faint' }, ...regionLinks],
        flows: [
          { path: ['userUs', 'appUs', 'dbUs'], tone: 'request', duration: 1.4 },
          { path: ['userEu', 'appUs'], tone: 'request', duration: 2.4, delay: 0.3 },
        ],
        caption: 'A second region, not serving yet',
      },
    },
    {
      title: 'GeoDNS',
      tag: 'concept',
      heading: 'GeoDNS: a different answer for each place',
      eli5: 'The chain has one phone number. A clever operator hears where you are calling from and gives you the address of the nearest kitchen. That operator is **GeoDNS**.',
      body: [
        'With **GeoDNS** the authoritative DNS server looks at where a query comes from and answers with the address of the closest healthy region. New York resolvers get the US address, Frankfurt resolvers get the EU one. The app does not change.',
        'DNS sees the resolver, not the user. A user on a far-away public resolver can be sent to the wrong region. Many resolvers forward part of the client\'s address (EDNS Client Subnet) to improve this, and not all do.',
        'Answers are cached for their **TTL**. If you change the answer during an outage, some clients keep the old one until it expires, and a few keep it longer. Short TTLs (30 to 60 s) speed up failover at the cost of more DNS queries.',
      ],
      keyIdea: 'GeoDNS sends each user to a nearby region by answering DNS differently by location. Caching by TTL limits how fast it can change its mind.',
      metrics: { eu: '60 ms', regions: '2', lag: '-', outage: 'half the users' },
      scene: {
        zones: [zoneUs, zoneEu],
        nodes: [userUs, userEu, { ...dns, status: 'active', badge: 'answer by location' }, appUs, dbUs, { ...appEu, status: 'active' }, dbEu],
        links: [
          { from: 'userUs', to: 'dns', style: 'faint' },
          { from: 'userEu', to: 'dns', style: 'faint' },
          { from: 'userUs', to: 'appUs' },
          { from: 'userEu', to: 'appEu' },
          ...regionLinks,
        ],
        flows: [
          { path: ['userEu', 'dns'], tone: 'handshake', label: 'where is shop?', duration: 1 },
          { path: ['dns', 'userEu'], tone: 'response', label: 'EU address', duration: 1, delay: 1.1 },
          { path: ['userEu', 'appEu'], tone: 'request', label: 'GET /cart', duration: 0.9, delay: 2.3 },
          { path: ['userUs', 'dns'], tone: 'handshake', duration: 1, delay: 0.4 },
          { path: ['dns', 'userUs'], tone: 'response', label: 'US address', duration: 1, delay: 1.5 },
          { path: ['userUs', 'appUs'], tone: 'request', duration: 0.9, delay: 2.7 },
        ],
        caption: 'One name, two answers',
      },
      code: {
        language: 'yaml',
        title: 'A geo routing policy (illustrative, syntax varies by DNS provider)',
        source: `record: shop.example.com
type: A
ttl: 60                     # seconds clients may cache the answer
routing: geolocation
rules:
  - match: { continent: EU }
    answer: 198.51.100.20   # eu-central load balancer
    health_check: eu-http
  - match: { continent: NA }
    answer: 192.0.2.10      # us-east load balancer
    health_check: us-http
  - match: default
    answer: 192.0.2.10
# If a health check fails, its rule is skipped and the
# next matching healthy answer is returned instead.`,
        highlight: [3, 6, 7, 8, 14],
      },
    },
    {
      title: 'Anycast',
      tag: 'concept',
      heading: 'Anycast: one address, announced from many places',
      eli5: 'Now the chain has one phone number that simply rings at whichever kitchen is closest. Nobody has to look anything up. One number, many kitchens, is **anycast**.',
      body: [
        'With **anycast**, every region announces the same IP address to the internet through BGP, the protocol routers use to share routes. Each router sends packets along the shortest path it knows, so a user in Frankfurt reaches the EU site and a user in New York reaches the US one, with one address for both.',
        'Failover is a routing change: a site that is unhealthy withdraws its announcement, and traffic flows to the next nearest site, usually within seconds to a minute. No client cache to wait out.',
        '"Nearest" means fewest network hops by the routers\' measure, which is not always lowest latency. And a route can shift mid-connection, which can break long TCP sessions. That is why anycast usually fronts edge proxies (CDNs, global load balancers, DNS servers) that end the connection close to the user and then forward it.',
      ],
      keyIdea: 'Anycast lets the network route each user to a nearby site under one IP, and fails over by withdrawing a route instead of waiting for DNS caches.',
      metrics: { eu: '60 ms', regions: '2', lag: '-', outage: 'half the users' },
      scene: {
        zones: [zoneUs, zoneEu],
        nodes: [userUs, userEu, { ...anycast, status: 'active', badge: 'same IP everywhere' }, appUs, dbUs, { ...appEu, status: 'active' }, dbEu],
        links: [
          { from: 'userUs', to: 'anycast' },
          { from: 'userEu', to: 'anycast' },
          { from: 'anycast', to: 'appUs' },
          { from: 'anycast', to: 'appEu' },
          ...regionLinks,
        ],
        flows: [
          { path: ['userUs', 'anycast', 'appUs'], tone: 'request', label: '203.0.113.10', duration: 1.6 },
          { path: ['userEu', 'anycast', 'appEu'], tone: 'request', label: '203.0.113.10', duration: 1.6, delay: 0.3 },
          { path: ['appEu', 'anycast', 'userEu'], tone: 'response', duration: 1.6, delay: 2 },
        ],
        caption: 'The network picks the nearest site',
      },
    },
    {
      title: 'Active-passive',
      tag: 'tradeoff',
      heading: 'Active-passive regions: one serves, one waits',
      eli5: 'The Frankfurt kitchen is stocked and has a copy of every order book, but takes no orders. If New York closes, Frankfurt opens its doors. That is an **active-passive** setup.',
      body: [
        'The simplest multi-region setup keeps all traffic in one region. The second region runs a smaller copy of the stack and an **async replica** of the database, receiving changes about 90 ms behind.',
        'There are no write conflicts, because one region owns all writes. Failover means promoting the EU database, scaling up the EU app tier and pointing DNS at it: **minutes**, and you lose whatever writes had not crossed yet.',
        'It does nothing for latency: Frankfurt users still cross the ocean every day. And the idle region is easy to neglect. Its config drifts, its capacity is never tested, and the first real failover finds the problems.',
      ],
      keyIdea: 'Active-passive regions are simple and conflict-free, but they help only with disasters, not latency.',
      metrics: { eu: '550 ms', regions: '1 active, 1 standby', lag: '~90 ms', outage: 'minutes of downtime' },
      scene: {
        zones: [zoneUs, zoneEu],
        nodes: [userUs, userEu, { ...appUs, status: 'active', badge: 'all traffic' }, { ...dbUs, status: 'active', badge: 'primary' }, { ...appEu, status: 'dim', badge: 'scaled down' }, { ...dbEu, label: 'db EU', badge: 'async replica' }],
        links: [{ from: 'userUs', to: 'appUs' }, { from: 'userEu', to: 'appUs' }, ...regionLinks, crossLink],
        flows: [
          { path: ['userUs', 'appUs', 'dbUs'], tone: 'request', duration: 1.4 },
          { path: ['userEu', 'appUs'], tone: 'request', duration: 2.4, delay: 0.3 },
          { path: ['dbUs', 'dbEu'], tone: 'data', label: 'replication', count: 2, duration: 1.4, delay: 1.5 },
        ],
        caption: 'Europe still pays the ocean crossing',
      },
    },
    {
      title: 'Active-active',
      tag: 'concept',
      heading: 'Active-active: every region serves its users',
      eli5: 'Both kitchens cook. Each customer has a home kitchen that keeps their order book. A Frankfurt customer\'s orders are written in Frankfurt, and a copy is sent to New York.',
      body: [
        'In **active-active** every region serves traffic. Reads are easy: each region holds a copy and answers locally. Writes are the question, because two regions writing the same data can conflict.',
        'The cleanest answer is a **home region** per user. A user\'s account, cart and orders live in one region, chosen at signup or by country. Their writes go there, even if they are traveling. Other regions hold read copies. This also serves data residency: EU users\' data is written in the EU.',
        'Data that is truly global, like a product catalog edited by a few staff, can keep a single writer region and replicate everywhere. Only data that must be written from anywhere at once needs a **multi-leader** setup, and the conflict handling that comes with it.',
      ],
      keyIdea: 'Active-active serves users locally. Giving each record one home region for writes avoids most cross-region conflicts.',
      metrics: { eu: '60 ms', regions: '2 active', lag: '~90 ms', outage: 'half the users, briefly' },
      scene: {
        zones: [zoneUs, zoneEu],
        nodes: [userUs, userEu, { ...appUs, status: 'active' }, { ...dbUs, status: 'active', sub: 'home of US users' }, { ...appEu, status: 'active' }, { ...dbEu, status: 'active', sub: 'home of EU users' }],
        links: [{ from: 'userUs', to: 'appUs' }, { from: 'userEu', to: 'appEu' }, ...regionLinks, crossLink],
        flows: [
          { path: ['userUs', 'appUs', 'dbUs'], tone: 'request', label: 'write', duration: 1.4 },
          { path: ['userEu', 'appEu', 'dbEu'], tone: 'request', label: 'write', duration: 1.4, delay: 0.2 },
          { path: ['dbUs', 'dbEu'], tone: 'data', label: 'read copy', duration: 1.6, delay: 1.6 },
          { path: ['dbEu', 'dbUs'], tone: 'data', label: 'read copy', duration: 1.6, delay: 1.8 },
        ],
        caption: 'Each user writes to one home region',
      },
      code: {
        language: 'python',
        title: 'Route writes to the user\'s home region',
        source: `LOCAL_REGION = os.environ["REGION"]          # "us-east" or "eu-central"
DBS = {
    "us-east": connect("postgres://db.us-east.internal/shop"),
    "eu-central": connect("postgres://db.eu-central.internal/shop"),
}

def home_region(user):
    return user.home_region                      # set once, at signup

def save_cart(user, cart):
    db = DBS[home_region(user)]                  # may be a remote region
    db.execute("UPDATE carts SET items = %s WHERE user_id = %s",
               cart.items, user.id)

def read_product(pid):
    return DBS[LOCAL_REGION].query_one(          # reads stay local
        "SELECT * FROM products WHERE id = %s", pid)`,
        highlight: [8, 11, 16],
      },
    },
    {
      title: 'Replication lag',
      tag: 'tradeoff',
      heading: 'The copy across the ocean is always behind',
      eli5: 'Each kitchen mails copies of its order book to the other. The mail takes time. For a little while, Frankfurt\'s copy of a New York order is out of date. That delay is **replication lag**.',
      body: [
        'Cross-region replication is almost always **asynchronous**. Synchronous replication would add a full ocean round trip, about 90 ms, to every commit. So each region\'s copy of the other\'s data trails it: around 100 ms on a good day, and seconds or minutes during a backlog or a network problem.',
        'Lag shows up in three places. A user who writes in their home region and then reads in another (traveling, or routed elsewhere) may not see their change. Global views, such as a total stock count, mix data of different ages. And if a region dies, its unshipped writes are gone: the lag is your **RPO** for that region.',
        'Measure lag per region pair and alert on it. Route a user\'s reads of their own data to their home region, or wait until the local copy has caught up to their last write.',
      ],
      keyIdea: 'Cross-region copies are async, so they are stale by at least the network delay, and that lag is the data you lose if a region dies.',
      metrics: { eu: '60 ms', regions: '2 active', lag: '3 s (backlog)', outage: 'lose last 3 s of writes' },
      scene: {
        zones: [zoneUs, zoneEu],
        nodes: [userUs, userEu, appUs, { ...dbUs, status: 'active', badge: 'order #881 saved' }, appEu, { ...dbEu, status: 'hot', badge: 'lag 3 s, no #881 yet' }],
        links: [{ from: 'userUs', to: 'appUs' }, { from: 'userEu', to: 'appEu' }, ...regionLinks, crossLink],
        flows: [
          { path: ['userUs', 'appUs', 'dbUs'], tone: 'request', label: 'place order', duration: 1.4 },
          { path: ['dbUs', 'dbEu'], tone: 'data', label: 'backlog', count: 5, duration: 3.2, delay: 1.5 },
          { path: ['appEu', 'dbEu'], tone: 'request', label: 'list orders', duration: 1, delay: 1.8 },
          { path: ['dbEu', 'appEu'], tone: 'error', label: 'missing #881', duration: 1, delay: 2.9 },
        ],
        caption: 'The EU copy has not seen the new order yet',
      },
      quiz: {
        question: 'Cross-region replication is async with about 2 s of lag at the moment us-east fails. What happens to US users\' last writes after failing over to eu-central?',
        options: [
          'Nothing is lost, because replication was running',
          'Roughly the last 2 s of writes that had not reached eu-central are lost or stuck until us-east returns',
          'All writes since the last nightly backup are lost',
          'eu-central rejects every write until us-east comes back',
        ],
        answer: 1,
        explain: 'Async replication confirms writes before they cross the ocean. Whatever was still in flight, about 2 s worth, never reached the EU copy. That gap is the RPO.',
      },
    },
    {
      title: 'Conflicts',
      tag: 'concept',
      heading: 'When two regions write the same record',
      eli5: 'A shared family order book gets edits in both kitchens at once: New York adds a pizza, Frankfurt removes the salad. When the copies meet, someone must decide what the book really says. That is **conflict** handling.',
      body: [
        'Some data has no single home. A shared team document, or one family\'s cart edited from two continents within the same second. With **multi-leader** replication both regions accept the write, and the conflict appears when the changes cross.',
        '**Last write wins** keeps the version with the latest timestamp and silently drops the other. It is simple, and it loses data, and clocks in two regions are never perfectly aligned. A **merge rule** combines both: for a cart, take the union of added items and apply removals. Data types built to merge cleanly (CRDTs) generalize this for counters, sets and text.',
        'The best conflict is the one you design out. Give each record one owning region. Keep data that must never diverge, such as stock for the last few items or a bank balance, in a single writer region and accept the extra latency for those writes.',
      ],
      keyIdea: 'Multi-leader writes create conflicts. Avoid them with one owner region per record, or resolve them with merge rules instead of last write wins.',
      metrics: { eu: '60 ms', regions: '2 active', lag: '~90 ms', outage: 'half the users, briefly' },
      scene: {
        zones: [zoneUs, zoneEu],
        nodes: [userUs, userEu, appUs, { ...dbUs, status: 'hot', badge: 'cart: +pizza' }, appEu, { ...dbEu, status: 'hot', badge: 'cart: -salad' }],
        links: [{ from: 'userUs', to: 'appUs' }, { from: 'userEu', to: 'appEu' }, ...regionLinks, crossLink],
        flows: [
          { path: ['userUs', 'appUs', 'dbUs'], tone: 'request', label: 'add pizza', duration: 1.4 },
          { path: ['userEu', 'appEu', 'dbEu'], tone: 'request', label: 'remove salad', duration: 1.4 },
          { path: ['dbUs', 'dbEu'], tone: 'error', label: 'conflict', duration: 1.6, delay: 1.5 },
          { path: ['dbEu', 'dbUs'], tone: 'error', label: 'conflict', duration: 1.6, delay: 1.5 },
        ],
        caption: 'Both edits committed. Which cart is real?',
      },
    },
    {
      title: 'Region down',
      tag: 'case',
      heading: 'Case: us-east goes dark',
      eli5: 'The New York kitchen loses power. The phone operator stops giving out its address, and every caller is sent to Frankfurt, which now cooks for two cities. Moving everyone over is a **region failover**.',
      body: [
        'Health checks from several locations start failing for us-east. After the threshold, GeoDNS stops returning the US address (or the US site withdraws its anycast route). New lookups go to eu-central. Clients holding a cached DNS answer keep failing until their TTL runs out.',
        'eu-central promotes its copy of US users\' data to writable. The writes that were still in flight are missing, and must be reconciled when us-east returns. US users now pay the ocean crossing, which is slow and still far better than down.',
        'The biggest risk is **capacity**. eu-central suddenly receives double its usual traffic. If each region normally runs above half its capacity, the survivor overloads and the outage spreads. Plan each region to absorb the other\'s peak, or have autoscaling and limits ready, and shed low-priority work first.',
      ],
      keyIdea: 'A region failover moves all traffic to the survivors, so each region must have room for the load of the one that died.',
      metrics: { eu: '60 ms (US users: 550 ms)', regions: '1 of 2', lag: 'last 2 s lost', outage: '~2 min for US users' },
      scene: {
        zones: [{ ...zoneUs, tone: 'red' }, zoneEu],
        nodes: [
          userUs,
          userEu,
          { ...dns, status: 'active', badge: 'US removed' },
          { ...appUs, status: 'down' },
          { ...dbUs, status: 'down' },
          { ...appEu, status: 'hot', badge: '2x traffic' },
          { ...dbEu, status: 'hot', badge: 'promoted for US users' },
          { ...monitor, status: 'active', badge: 'us-east failing' },
        ],
        links: [
          { from: 'userUs', to: 'appEu', style: 'dashed' },
          { from: 'userEu', to: 'appEu' },
          ...regionLinks,
          { from: 'monitor', to: 'appUs', style: 'dashed' },
          { from: 'monitor', to: 'dns', style: 'dashed' },
        ],
        flows: [
          { path: ['monitor', 'appUs'], tone: 'error', label: 'check failed', duration: 1 },
          { path: ['monitor', 'dns'], tone: 'event', label: 'drop us-east', duration: 1, delay: 1.1 },
          { path: ['userUs', 'appEu'], tone: 'request', label: 'rerouted', count: 3, duration: 2, delay: 2.3 },
          { path: ['userEu', 'appEu'], tone: 'request', count: 3, duration: 1, delay: 2.3 },
        ],
        caption: 'Everyone now lands in eu-central',
      },
    },
    {
      title: 'Drills',
      tag: 'concept',
      heading: 'Failover drills: practice on a calm day',
      eli5: 'Kitchens hold fire drills. On a quiet afternoon they close New York on purpose and check that Frankfurt copes. A practice run like that is a **failover drill**.',
      body: [
        'A failover path that never runs breaks quietly. A **failover drill** (or game day) evacuates a region on purpose, at a planned time with people watching: drain its traffic, promote the other side, run for a while, then move back.',
        'Drills find what diagrams miss. A login service or a config store that only runs in us-east. A DNS TTL set to a day years ago. A runbook step that needs access to the region that is down. Too little capacity, or quotas in the surviving region. Each finding is cheaper on a Tuesday afternoon than during a real outage.',
        'Measure the drill against your targets: time to detect, time to move traffic, data lost. Start with a small slice of traffic, then grow to a full region. Teams that drill on a regular schedule tend to fail over in minutes when it counts.',
      ],
      keyIdea: 'Only a practiced failover is a real one. Evacuate a region on purpose, measure RTO and RPO, and fix what breaks.',
      metrics: { eu: '60 ms', regions: '2 (1 drained)', lag: '~90 ms', outage: 'measured: 90 s' },
      scene: {
        zones: [{ ...zoneUs, tone: 'amber' }, zoneEu],
        nodes: [userUs, userEu, { ...dns, status: 'active', badge: 'drain us-east' }, { ...appUs, status: 'dim', badge: 'drained on purpose' }, { ...dbUs, status: 'dim' }, { ...appEu, status: 'active' }, { ...dbEu, status: 'ok' }, { ...monitor, status: 'ok', badge: 'timing the drill' }],
        links: [
          { from: 'userUs', to: 'appEu', style: 'dashed' },
          { from: 'userEu', to: 'appEu' },
          ...regionLinks,
          crossLink,
          { from: 'monitor', to: 'dns', style: 'dashed' },
        ],
        flows: [
          { path: ['monitor', 'dns'], tone: 'event', label: 'start drill', duration: 1 },
          { path: ['userUs', 'appEu'], tone: 'request', count: 2, duration: 2, delay: 1.1 },
          { path: ['userEu', 'appEu'], tone: 'request', count: 2, duration: 1, delay: 1.1 },
          { path: ['dbEu', 'dbUs'], tone: 'data', label: 'keep us-east in sync', duration: 1.6, delay: 2.5 },
        ],
        caption: 'A planned evacuation, with a stopwatch',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Bring the system closer, and plan to lose a region',
      eli5: 'A chain with kitchens in many cities sends each caller to the nearest one, keeps each customer\'s order book in one home kitchen, mails copies around, and practices closing a kitchen.',
      body: [
        'One region taxes far users and is a single failure domain. **GeoDNS** routes by answering DNS by location and is limited by TTL caching. **Anycast** routes by announcing one IP from many sites and fails over by withdrawing a route.',
        '**Active-passive** regions are simple and only help in disasters. **Active-active** serves users locally, and a **home region** per record keeps writes conflict-free. Cross-region replication is async, so copies lag and the lag is your RPO. Where two regions must write the same data, use merge rules over last write wins.',
        'When a region dies, the survivors take all its load, so plan capacity for it. Practice the evacuation with **failover drills** until it is boring.',
      ],
      keyIdea: 'Route users to the nearest healthy region, give every record one home for writes, and rehearse losing a region.',
      metrics: { eu: '60 ms', regions: '2 active', lag: '~90 ms', outage: 'minutes, tested' },
      scene: {
        zones: [zoneUs, zoneEu],
        nodes: [userUs, userEu, dns, { ...appUs, status: 'ok' }, { ...dbUs, status: 'ok' }, { ...appEu, status: 'ok' }, { ...dbEu, status: 'ok' }],
        links: [
          { from: 'userUs', to: 'dns', style: 'faint' },
          { from: 'userEu', to: 'dns', style: 'faint' },
          { from: 'userUs', to: 'appUs' },
          { from: 'userEu', to: 'appEu' },
          ...regionLinks,
          crossLink,
        ],
        flows: [
          { path: ['userUs', 'appUs', 'dbUs'], tone: 'request', duration: 1.4 },
          { path: ['userEu', 'appEu', 'dbEu'], tone: 'request', duration: 1.4, delay: 0.2 },
          { path: ['dbUs', 'dbEu'], tone: 'data', duration: 1.6, delay: 1.6 },
          { path: ['dbEu', 'dbUs'], tone: 'data', duration: 1.6, delay: 1.8 },
        ],
      },
      quiz: {
        question: 'Two active-active regions each run at 70% of their capacity at peak. One region fails. What is the most likely result?',
        options: [
          'Nothing visible, because the other region takes over',
          'The surviving region receives about 140% of its capacity and overloads unless it scales or sheds load',
          'Only write latency goes up',
          'DNS caching keeps all users on the failed region',
        ],
        answer: 1,
        explain: 'The survivor gets its own 70% plus the failed region\'s 70%. Each region must keep headroom for the other\'s load, or failover turns one outage into two.',
      },
    },
  ],
};
